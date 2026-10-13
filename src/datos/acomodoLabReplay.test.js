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
  it.each(CASOS_LAB_COTIZAR.filter((c) => c !== 'C4_dos_niveles'))('%s: áreas idénticas a las guardadas por la app', (c) => {
    const ev = evidenciaLab(c);
    expect(cuantizar(areasDesdeLectura(ev.lectura, ev.puertasConfirmadas))).toEqual(cuantizar(ev.acomodoGuardado.areasM));
  });
  // VH-A10-01: en C4 la app guardó artefactos del NIVEL 2 dentro de los cuartos del nivel 1. Con la corrección,
  // la única diferencia contra lo guardado es que ya no están; forma, medidas y puertas de la hoja 1 son iguales.
  it('C4_dos_niveles: sin artefactos del nivel 2; lo demás idéntico a lo guardado', () => {
    const ev = evidenciaLab('C4_dos_niveles');
    const nuevas = cuantizar(areasDesdeLectura(ev.lectura, ev.puertasConfirmadas));
    const guardadas = cuantizar(ev.acomodoGuardado.areasM);
    expect(nuevas.map((a) => a.nombre)).toEqual(guardadas.map((a) => a.nombre));
    expect(nuevas.every((a) => a.nivel === 'NIVEL 1' && !a.dentroDe && !a.contiene)).toBe(true);
    expect(nuevas.flatMap((a) => a.obstaculos || []).filter((o) => o.tipo !== 'puerta')).toEqual([]);   // ni "cuarto" ni la columna P1 del nivel 2
    // Las puertas de la hoja 2 (x = 10 m) ya no caen en cuartos del nivel 1.
    const hoja1 = (a) => (a.puertas || []).filter((p) => !(Math.abs(p.x + a.x - 10) < 0.01));
    guardadas.forEach((g, i) => {
      const n = nuevas[i];
      expect([n.x, n.y, n.ancho, n.largo, n.poly, n.tipo]).toEqual([g.x, g.y, g.ancho, g.largo, g.poly, g.tipo]);
      expect(n.puertas || []).toEqual(hoja1(g));
    });
  });
});

// Estado medido del acomodo por plano. Cada corrección de ACOMODO_10 mueve esta tabla con su prueba.
const ESPERADO = {
  C1_recto: { veredicto: 'PASS', colocadas: 25, total: 25 },
  C2_curvo: { veredicto: 'PARCIAL', colocadas: 29, total: 41 },         // VH-A10-02: la mesa de consejo entra; sus 12 sillas no (sala circular de 5 m)
  C3_sin_cotas: { veredicto: 'PARCIAL', colocadas: 20, total: 21 },     // VH-A10-02: el módulo directivo de PRIVADO B entra; su silla no
  C4_dos_niveles: { veredicto: 'PASS', colocadas: 19, total: 19 },        // VH-A10-01 (antes PARCIAL 10/19)
  C5_ele: { veredicto: 'PASS', colocadas: 38, total: 38 },              // VH-A10-02 (columna) + VH-A10-03 (consejo 6+6): antes REVISION
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
