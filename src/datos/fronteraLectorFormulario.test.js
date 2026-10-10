import { describe, it, expect } from 'vitest';
import { bloqueGeometria, areasCanonicas, aMM, aMetros, cuantizar } from './floorPlan.js';
import { programaDelPlano } from './programaDelPlano.js';

// ============================================================================
//  COT-P0-003 · FRONTERA lector → acomodo.areasM → formulario de Voni
//  Evidencia E2E real (e2e/evidence/torre-sur-leer-plano.json, 2026-10-10 13:22Z):
//  el lector devolvió ÁREA OPERATIVA puestos=8 (contado del dibujo), pero el texto
//  que el formulario mandó a cotizar-texto decía "10 lugares de trabajo… 10 WIN…
//  10 gavetas". Causa: Voni guarda `bloqueGeometria(r.areas)` y aMM/aMetros
//  enumeran campos a mano y TIRAN `puestos` → programaDelPlano cae a geometría:
//  8 m / 1.5 m = 5 por hilera × 2 hileras = 10. El 10 no está en el plano.
// ============================================================================
// Áreas tal como las devolvió el lector para Torre Sur (en metros, mismos valores).
const LECTOR_TORRE_SUR = [
  { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4, largo: 3.2, puestos: 1, confianza: 'media' },
  { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2, puestos: 0, confianza: 'media' },
  { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 8, confianza: 'media' },
  { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 4, largo: 2.4, puestos: 0, confianza: 'baja' },
  { nombre: 'SITE (IT)', tipo: 'servicio', ancho: 4, largo: 2.4, puestos: 0, confianza: 'media' },
];

describe('COT-P0-003 · el conteo del lector sobrevive hasta el formulario', () => {
  it('RED→GREEN: tras guardar como Voni (bloqueGeometria) y recargar (areasCanonicas), el formulario propone 8 (DETECTADO), no 10 (estimado)', () => {
    const guardado = bloqueGeometria(LECTOR_TORRE_SUR);          // lo que Voni persiste en cot.acomodo
    const alFormulario = areasCanonicas(guardado);                // lo que recibe ProgramaProyecto
    const op = alFormulario.find((a) => a.nombre === 'ÁREA OPERATIVA');
    expect(op.puestos, 'puestos del lector perdidos en aMM/aMetros').toBe(8);
    const p = programaDelPlano(alFormulario, { largoPuesto: 1500 });
    expect(p.operativos).toBe(8);                                 // antes: 10 (geometría)
    expect(p.fuente.operativos).toBe('detectado');                // antes: 'estimado'
    expect(p.sugeridos.gavetas).toBe(8);
    expect(p.sugeridos.sillasOperativas).toBe(8);
    expect(p.privados).toBe(1);
    expect(p.recepcion).toBe(true);
  });

  it('sin conteo del lector, la geometría sigue mandando (no se inventa un "detectado")', () => {
    const sinPuestos = LECTOR_TORRE_SUR.map(({ puestos, ...a }) => a);
    const p = programaDelPlano(areasCanonicas(bloqueGeometria(sinPuestos)), { largoPuesto: 1500 });
    expect(p.operativos).toBe(10);                                // 8 m / 1.5 × 2 hileras
    expect(p.fuente.operativos).toBe('estimado');
  });

  it('aMM/aMetros conservan puestos y confianza sólo cuando existen; cuantizar sigue idempotente', () => {
    const mm = aMM(LECTOR_TORRE_SUR);
    expect(mm[2].puestos).toBe(8);
    expect(mm[2].confianza).toBe('media');
    expect(mm[1].puestos).toBe(0);
    const back = aMetros(mm);
    expect(back[2].puestos).toBe(8);
    const canon = cuantizar(LECTOR_TORRE_SUR);
    expect(cuantizar(canon)).toEqual(canon);
    // un área sin esos campos no los recibe (no se siembra undefined)
    const limpio = aMM([{ nombre: 'X', ancho: 3, largo: 3 }])[0];
    expect('puestos' in limpio).toBe(false);
    expect('confianza' in limpio).toBe(false);
  });

  it('LÍMITE DOCUMENTADO (COT-P0-001/006): la sala de consejo llega con puestos=0 (el lector no cuenta asientos de juntas) y la capacidad sale por m² (22.4 m² → 4), aunque el plano dibuje 8 asientos', () => {
    const p = programaDelPlano(areasCanonicas(bloqueGeometria(LECTOR_TORRE_SUR)), { largoPuesto: 1500 });
    expect(p.salas).toEqual([4]);   // geometría, NO observación — queda registrado, no se "arregla" inventando 8
  });
});
