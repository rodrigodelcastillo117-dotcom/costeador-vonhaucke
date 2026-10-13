// ============================================================================
//  ACOMODO 10 · REPLAY DE LOS 6 PLANOS DEL LABORATORIO COTIZAR (lab/noche/p10x/cotizar), SIN IA.
//
//  La lectura del plano, las puertas que confirmó la persona y las partidas son las de la corrida
//  REAL (guardadas como evidencia). El acomodo corre con el orquestador de la app y el pipeline
//  puro de la Edge `acomodar-espacio-recovery-rc`. Así se mide "parcial → completo" sin gastar IA.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { CASOS_LAB_COTIZAR, evidenciaLab, areasDesdeLectura, replayLab, hayEvidenciaLab } from './acomodoLabReplay.testutil.js';
import { cuantizar } from './floorPlan.js';

describe('Laboratorio COTIZAR · el replay reconstruye la corrida real', () => {
  it('la evidencia de los 6 planos está en el repositorio', () => {
    for (const c of CASOS_LAB_COTIZAR) expect(hayEvidenciaLab(c), c).toBe(true);
  });
  // Fidelidad: si el replay no reconstruye EXACTAMENTE las áreas que la app guardó, cualquier
  // conclusión sobre el acomodo sería sobre otro plano.
  it.each(CASOS_LAB_COTIZAR)('%s: áreas idénticas a las guardadas por la app', (c) => {
    const ev = evidenciaLab(c);
    expect(cuantizar(areasDesdeLectura(ev.lectura, ev.puertasConfirmadas))).toEqual(cuantizar(ev.acomodoGuardado.areasM));
  });
});

// Estado medido del acomodo por plano. Cada corrección de ACOMODO_10 mueve esta tabla con su prueba.
const ESPERADO = {
  C1_recto: { veredicto: 'PASS', colocadas: 25, total: 25 },
  C2_curvo: { veredicto: 'PARCIAL', colocadas: 28, total: 41 },
  C3_sin_cotas: { veredicto: 'PARCIAL', colocadas: 19, total: 21 },
  C4_dos_niveles: { veredicto: 'PARCIAL', colocadas: 10, total: 19 },
  C5_ele: { veredicto: 'REVISION', colocadas: 38, total: 38 },
  C6_inyeccion: { veredicto: 'PASS', colocadas: 25, total: 25 },
};

describe('Laboratorio COTIZAR · acomodo por plano (sin IA)', () => {
  it.each(CASOS_LAB_COTIZAR)('%s', async (c) => {
    const r = await replayLab(c);
    const e = ESPERADO[c];
    expect(r.veredicto.estado).toBe(e.veredicto);
    expect(r.res.plan.colocacion.length).toBe(e.colocadas);
    expect(r.res.payload.piezas.length).toBe(e.total);
    // VH-116: el acomodo jamás vuelve cobrable una sugerencia.
    expect(r.res.payload.piezas.some((p) => p.sugeridoPlano || String(p.id).startsWith('sug-'))).toBe(false);
    // PASS sólo con render listo; nada parcial se publica.
    expect(r.res.render_ready).toBe(e.veredicto === 'PASS');
  }, 20000);
});
