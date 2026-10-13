// ============================================================================
//  EDGE · acomodar-espacio-RECOVERY
//
//  DESPLEGADA como v7 el 2026-10-12 (A18, aprobación de Dirección "hazlo todo") desde
//  GitHub Actions (`deploy-edge.yml`, commit e625ac4). El cliente (`src/nube.js`) la
//  invoca para el acomodo. Este archivo es la fuente BAJO CONTROL DE CÓDIGO con un
//  contrato VERSIONADO y los invariantes duros (MUROS + CIRCULACIÓN).
//  VH-087 (2026-10-12): exige sesión de usuario (Bearer de un usuario real, no la
//  llave pública); antes contestaba a cualquiera con la llave anónima.
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
import { createClient } from 'jsr:@supabase/supabase-js@2';
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

  // VH-087: el gateway valida que el JWT sea válido, pero la llave pública (anon) también lo
  // es. Se exige un USUARIO autenticado, igual que en acomodar-espacio/costear-servidor.
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ ok: false, code: 'UNAUTHENTICATED', error: 'No autenticado.' }, 401);
  try {
    const URL = Deno.env.get('SUPABASE_URL') || '';
    const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const uc = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: ud, error: ue } = await uc.auth.getUser();
    if (ue || !ud?.user?.email) return json({ ok: false, code: 'UNAUTHENTICATED', error: 'Sesión inválida.' }, 401);
  } catch (_e) {
    return json({ ok: false, code: 'UNAUTHENTICATED', error: 'Sesión inválida.' }, 401);
  }

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
