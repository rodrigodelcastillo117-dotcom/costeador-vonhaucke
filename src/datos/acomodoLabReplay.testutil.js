// ============================================================================
//  REPLAY DE LABORATORIO (sin IA en vivo) · lab/noche/p10x/cotizar/C1..C6
//
//  Reconstruye cada proyecto del laboratorio COTIZAR exactamente como lo hizo la app, pero con
//  la evidencia GUARDADA de la corrida real (no se llama a ninguna Edge de IA):
//    1. `lectura` = respuesta real de `leer-plano-rc` (edges.json) → `areasDeLectura`.
//    2. Puertas confirmadas por la persona (1b-puertas-confirmadas.json), en el MISMO orden en que
//       la compuerta las ofreció (`puertasSinConfirmar`) y con lo que el E2E pulsó: una hoja o doble,
//       "hacia adentro", bisagra por omisión del control (izquierda).
//    3. Documento con varios niveles → sólo el primero (misma regla que Voni.jsx).
//    4. Partidas = las que la app dejó tras "Aplicar programa detectado" (3-partidas-tras-programa.json).
//    5. Acomodo = orquestador real (`resolverAcomodo`) con el pipeline PURO de la Edge
//       `acomodar-espacio-recovery-rc` como `solve` (mismo código que se despliega), y el veredicto
//       que enseña la pantalla (`explicarAcomodo`).
//
//  Sólo para pruebas (lee archivos del disco). La app no lo importa.
// ============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { areasDeLectura, nivelesDeLectura, areasDelNivelUsado } from './planoLeido.js';
import { confirmarPuertaEnArea, puertasSinConfirmar } from './puertasConfirmar.js';
import { bloqueGeometria } from './floorPlan.js';
import { resolverAcomodo } from './acomodoOrquestador.js';
import { interpretarAcomodoServidor } from './acomodoServidor.js';
import { explicarAcomodo } from './acomodoVeredicto.js';
import { construirRespuestaAcomodo } from '../../supabase/functions/acomodar-espacio-recovery-rc/recoveryPipeline.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../lab/noche/p10x/cotizar');
export const CASOS_LAB_COTIZAR = ['C1_recto', 'C2_curvo', 'C3_sin_cotas', 'C4_dos_niveles', 'C5_ele', 'C6_inyeccion'];

const leer = (caso, archivo) => JSON.parse(readFileSync(path.join(RAIZ, caso, archivo), 'utf8'));
export const hayEvidenciaLab = (caso) => existsSync(path.join(RAIZ, caso, 'edges.json'));

/** Evidencia guardada de la corrida real. */
export function evidenciaLab(caso) {
  const edges = leer(caso, 'edges.json');
  const lectura = JSON.parse(edges['leer-plano-rc'][0].body).lectura;
  return {
    lectura,
    puertasConfirmadas: leer(caso, '1b-puertas-confirmadas.json'),
    partidas: leer(caso, '3-partidas-tras-programa.json'),
    acomodoGuardado: leer(caso, '4-acomodo.json'),
  };
}

/** Áreas (metros) que la app guardó tras confirmar la lectura, reconstruidas desde la lectura real. */
export function areasDesdeLectura(lectura, puertasConfirmadas = []) {
  let areas = areasDeLectura(lectura).areas;
  for (const d of puertasConfirmadas) {
    const pend = puertasSinConfirmar(areas)[0];
    if (!pend) break;
    areas = areas.map((a, i) => (i === pend.areaIdx ? confirmarPuertaEnArea(a, pend.idx, { doble: !!d.doble, bisagra: 'izquierda', abre: d.abre || 'adentro' }) : a));
  }
  const usadas = areasDelNivelUsado(areas, nivelesDeLectura(lectura));
  return bloqueGeometria(usadas).areasM;
}

/** Corre el acomodo real (orquestador + pipeline puro de la Edge RC) y el veredicto de pantalla. */
export async function acomodarLab({ partidas, areasM }) {
  let respuesta = null;
  const solve = async (payload) => {
    const r = construirRespuestaAcomodo(payload.areas, payload.piezas);
    respuesta = r;
    const i = interpretarAcomodoServidor(r, payload.piezas);
    if (!i.ok) { const e = new Error(i.error); e.veredictoServidor = true; throw e; }
    return { ...i.plan, unassigned: r.unassigned || [], no_cupieron: r.no_cupieron || [], layoutSpec: r.layoutSpec || null, render_ready: r.render_ready === true, strictPlacement: true };
  };
  const res = await resolverAcomodo({ partidas, areasM, solve });
  const plan = res.plan ? { ...res.plan, render_ready: res.render_ready === true, layoutSpec: { ...(res.plan.layoutSpec || {}), status: res.status } } : null;
  const veredicto = plan ? explicarAcomodo({ plan, evaluacion: res.evaluacion, referencias: res.payload?.referencias || [], preliminar: !!res.payload?.preliminar, huellasEstandar: res.payload?.huellasEstandar || 0 }) : null;
  return { res, respuesta, veredicto };
}

/** Replay completo de un caso: lectura → puertas → nivel → partidas → acomodo → veredicto. */
export async function replayLab(caso) {
  const ev = evidenciaLab(caso);
  const areasM = areasDesdeLectura(ev.lectura, ev.puertasConfirmadas);
  const out = await acomodarLab({ partidas: ev.partidas, areasM });
  return { ...out, areasM, evidencia: ev };
}
