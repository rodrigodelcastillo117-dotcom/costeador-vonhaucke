// ============================================================================
//  EDGE · acomodar-espacio-RECOVERY
//
//  ESTADO REAL (2026-10-10): DESPLEGADA por Rodrigo como **v6** (ezbr d430fcb28c86…,
//  fuente = commit 595bde1: juez acepta visitas en DESK + semantic_issues expuestos).
//  Esta FUENTE es la **v7 candidata (COT-P0-027b/027c)**: acceso de sillas y frente de
//  guardado en el conjunto legal del solver, búsqueda completa con backjumping, ranking
//  completitud > review, orientaciones 180/270, topología STORAGE, calidad de acceso
//  graduada y veredicto NO_CABE_DEMOSTRADO / NO_SE_ENCONTRO_SOLUCION /
//  INFORMACION_INSUFICIENTE. ⚠️ NO DESPLEGAR SIN AUTORIZACIÓN EXPLÍCITA de Rodrigo:
//    supabase functions deploy acomodar-espacio-recovery --project-ref mtuvnbgljwbsaizjjgzs --use-api
//  El cliente (`src/nube.js`) invoca la función viva; hasta el deploy, el E2E real
//  seguirá reflejando v6 (Torre Sur 15/22) aunque el pipeline local dé 22/22 PASS.
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
import { prepararGruposFuncionales } from './acomodo-core.js';
import { construirRespuestaAcomodo } from './recoveryPipeline.js';

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

  // MOTOR KIT-SOLVER MULTI (P0.2c BLOCK 5): el pipeline PURO está en recoveryPipeline.js
  // (testeable sin deploy). resolverKitsMulti → jueces en capas (HARD → SEMANTIC →
  // COMPLETENESS → QUALITY) → GANADOR; layoutSpec/render_ready/status/mensaje_vendedor
  // se calculan SOBRE EL GANADOR.
  return json(construirRespuestaAcomodo(areas, piezas));
});
