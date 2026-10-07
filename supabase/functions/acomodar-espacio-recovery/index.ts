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
// Cores VENDORIZADOS en este directorio (cada función Edge de Supabase se empaqueta
// desde su PROPIO directorio: los imports cruzados a ../acomodar-espacio fallaban al
// desplegar). Copias de acomodar-espacio/{acomodo-core,spatial-core}.js.
import {
  planearDeterminista, validarColocacion, prepararGruposFuncionales,
} from './acomodo-core.js';
import { auditarPuertas } from './spatial-core.js';
import { CONTRATO, evaluarRecovery, proponerReparacion } from './recovery-core.js';

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

  const fails = (ev: any) => (ev?.issues || []).filter((i: any) => i.severity === 'fail').map((i: any) => i.code);

  // Semilla DETERMINISTA (reproducible).
  let colocacion = (planearDeterminista(areas, piezas, {}) as any)?.colocacion || [];
  let evalActual = evaluarRecovery(areas, piezas, colocacion, { requested: piezas.length });
  const repairTrace: any[] = [{
    intento: 1, status: evalActual.status, invariantesFallados: fails(evalActual),
    piezasMovidas: colocacion.map((c: any) => String(c.id)), porque: 'semilla determinista',
  }];

  // REPAIR LOOP REAL ≤ 3: cada intento CONSERVA las válidas y RE-COLOCA las
  // inválidas/faltantes en espacio libre. Si no cambia nada concreto, NO se finge
  // un intento. Tras el 3º inválido → NEEDS_REVIEW.
  let attemptsUsed = 1;
  while (!evalActual.render_ready && attemptsUsed < 3) {
    const rep = proponerReparacion({ areas, piezas, colocacionPrev: colocacion, evalPrev: evalActual });
    if (!rep.movidas.length) {
      repairTrace.push({ intento: attemptsUsed + 1, status: evalActual.status, invariantesFallados: fails(evalActual), piezasMovidas: [], porque: 'sin cambio reparable; no se finge intento' });
      break;
    }
    attemptsUsed += 1;
    colocacion = rep.colocacion;
    evalActual = evaluarRecovery(areas, piezas, colocacion, { requested: piezas.length, repairAgotado: attemptsUsed >= 3 });
    repairTrace.push({ intento: attemptsUsed, status: evalActual.status, invariantesFallados: fails(evalActual), piezasMovidas: rep.movidas, porque: 'reparación: conserva válidas, recoloca inválidas/faltantes' });
  }
  const evalFinal = evalActual;
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
      repair_trace: repairTrace,   // audit F: rastro real de cada intento
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
