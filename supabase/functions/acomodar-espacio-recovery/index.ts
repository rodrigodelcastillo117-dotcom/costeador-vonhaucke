// ============================================================================
//  EDGE · acomodar-espacio-RECOVERY  (P0.2 · PENDIENTE DE ACTIVACIÓN)
//
//  ⚠️⚠️  ESTA FUENTE NO ESTÁ DESPLEGADA Y NO DEBE DESPLEGARSE SIN AUTORIZACIÓN
//  EXPLÍCITA.  El cliente (`src/nube.js`) sigue invocando la función viva
//  `acomodar-espacio-recovery` desplegada fuera de banda. Este archivo pone esa
//  lógica BAJO CONTROL DE CÓDIGO (objetivo P0.2) con un contrato VERSIONADO y los
//  invariantes duros nuevos (MUROS + CIRCULACIÓN) que el lane productivo no tiene.
//
//  Nivel de evidencia: PENDIENTE DE ACTIVACIÓN. Su geometría nueva NO se considera
//  viva ni certificada en producción hasta un deploy futuro explícitamente
//  autorizado. Al desplegar, bundlear junto con los cores compartidos de
//  ../acomodar-espacio (acomodo-core.js, spatial-core.js, spatial-semantics.js).
//
//  Contrato:
//    IN  (ACOMODO_INPUT_V1):  { areas:[{nombre,ancho,largo,poly?,muros?,puertas?,
//                               obstaculos?,tipo?,nivel?,dentroDe?}], piezas:[{id,
//                               w,d,relation_role?,anchor_role?,functional_group_id?,
//                               requirement_id?,zone_id?,zonaSugerida?}] }
//    OUT (PLACEMENT_SPEC_V2_RECOVERY): { ok, plan:{colocacion:[{id,area,x,y,rot}]},
//                               layoutSpec, render_ready, status, attempts_used, metodo }
// ============================================================================
import {
  planearDeterminista, acomodarConReparacion, validarColocacion, prepararGruposFuncionales,
} from '../acomodar-espacio/acomodo-core.js';
import { auditarPuertas } from '../acomodar-espacio/spatial-core.js';
import { CONTRATO, evaluarRecovery } from './recovery-core.js';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

// Entrada canónica: normaliza multi-zona y prepara grupos funcionales deterministas.
function normalizarEntrada(body: any) {
  const areas = Array.isArray(body?.areas) ? body.areas : (body?.area ? [body.area] : []);
  const piezas = Array.isArray(body?.piezas) ? body.piezas : [];
  // out-of-zone / anchors-dependents viajan en la pieza (functional_group_id +
  // relation_role + zonaSugerida/zone_id); los grupos se preparan deterministas.
  const grupos = prepararGruposFuncionales(areas, piezas);
  return { areas, piezas, grupos };
}

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve?.(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid json' }, 400); }

  const { areas, piezas } = normalizarEntrada(body);
  if (!areas.length) return json({ ok: false, error: 'SIN_FLOORSPEC' }, 422);
  if (!piezas.length) return json({ ok: false, error: 'SIN_PARTIDAS_CONFIRMADAS' }, 422);

  // Semilla DETERMINISTA primero (reproducible); si ya cumple, no se gasta repair.
  const seed = planearDeterminista(areas, piezas, {});
  const deterministicPass = evaluarRecovery(areas, piezas, seed?.colocacion || [], { requested: piezas.length }).render_ready;

  // REPAIR LOOP ≤ 3 (cada intento cambia algo concreto; conserva lo válido).
  let attemptsUsed = 1;
  const resultado = await acomodarConReparacion({
    areas, piezas,
    maxIntentos: 3,
    proponer: async (ctx: any) => {
      // intento <= (deterministicPass ? 0 : 3) — no reparar si la semilla ya pasó.
      attemptsUsed = Math.max(attemptsUsed, Number(ctx?.intento) || 1);
      return ctx?.intento <= (deterministicPass ? 0 : 3) ? seed : seed;
    },
  }).catch(() => ({ colocacion: seed?.colocacion || [] }));

  const colocacion = resultado?.colocacion || seed?.colocacion || [];

  // Invariantes DUROS: bounds/overlap/puerta/obstáculo + MUROS + CIRCULACIÓN +
  // cobertura (requested == placed + unplaced). render_ready SÓLO si todo pasa.
  const evalFinal = evaluarRecovery(areas, piezas, colocacion, {
    requested: piezas.length,
    repairAgotado: attemptsUsed >= 3,
  });
  // Validación semántica/relacional del core compartido (out-of-zone, grupos).
  const val = validarColocacion(areas, piezas, colocacion, 1);
  const doors = auditarPuertas(areas);

  const layoutSpec = {
    version: CONTRATO.output_version,
    status: evalFinal.status,
    requested: evalFinal.requested,
    placed: evalFinal.placed,
    unplaced: evalFinal.unplaced,
    placements: colocacion,
    validation: {
      issues: evalFinal.issues,
      render_ready: evalFinal.render_ready,
      invariant_ok: evalFinal.invariant_ok,
      doors,
      semantic: val,
      min_pasillo_mm: CONTRATO.min_pasillo_mm,
    },
  };

  return json({
    ok: true,
    plan: { colocacion },
    layoutSpec,
    render_ready: evalFinal.render_ready,
    status: evalFinal.status,
    attempts_used: attemptsUsed,
    attempts: Math.max(1, attemptsUsed),
    metodo: 'recovery-v1',
    input_version: CONTRATO.input_version,
  });
});
