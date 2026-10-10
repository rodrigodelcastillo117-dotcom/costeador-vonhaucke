import { describe, it, expect } from 'vitest';
import { programaDelPlano, avisosDeSala, resumenDelPlano } from './programaDelPlano.js';
import { aMM, aMetros } from './floorPlan.js';
import { areasDeLectura } from './planoLeido.js';

// ============================================================================
//  COT-P0-001 / 006b · AUTORIDAD FÍSICA DE LA SALA (Parte XI §5).
//  Evidencia real (e2e/evidence/torre-sur-pdf-leer-plano.json, 15:17Z): el lector
//  devuelve SALA DE CONSEJO con puestos=0 (regla 5: "sillas de juntas no son puestos")
//  y observed_program=[] → el cliente ESTIMA la sala por m² (22 m² → 4) aunque el
//  plano dibuja 8 símbolos de asiento. Contrato: `asientos` = símbolos de asiento
//  OBSERVADOS por área (distinto de `puestos`); gobierna la capacidad de la sala
//  cuando existe; si no, la estimación por m² queda marcada INFERRED y se pide
//  confirmación. Lo observado y lo pedido son DOS hechos: no se igualan solos.
// ============================================================================
const SALA = { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2 };
const OP = { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 8 };

describe('COT-P0-001 · sala: asientos observados vs estimación por m²', () => {
  it('RED→GREEN: con asientos=8 contados del plano, la sala es para 8 (OBSERVED), no 4 por m²', () => {
    const pr = programaDelPlano([OP, { ...SALA, asientos: 8 }]);
    expect(pr.salas).toEqual([8]);
    expect(pr.juntas).toBe(8);
    expect(pr.fuente.juntas).toBe('detectado');
    expect(pr.salasInfo[0]).toMatchObject({ nombre: 'SALA DE CONSEJO', asientos: 8, caben: 8, origen: 'OBSERVED' });
    expect(resumenDelPlano(pr)).toMatch(/sala de juntas \(8\)/);
    expect(resumenDelPlano(pr)).toMatch(/asientos contados del plano/);
  });

  it('sin asientos observados: estimación por m² marcada INFERRED y se pide confirmar', () => {
    const pr = programaDelPlano([OP, SALA]);
    expect(pr.salas[0]).toBeGreaterThan(0);          // estimación por m² (22.4 m²)
    expect(pr.fuente.juntas).toBe('estimado');
    expect(pr.salasInfo[0]).toMatchObject({ origen: 'INFERRED', asientos: null });
    expect(resumenDelPlano(pr)).toMatch(/Estimé.*sala.*confírmame/i);
  });

  it('asientos=0 explícito NO es observación de "sala sin sillas": vuelve a la estimación (lector sin vocabulario)', () => {
    const pr = programaDelPlano([OP, { ...SALA, asientos: 0 }]);
    expect(pr.fuente.juntas).toBe('estimado');
    expect(pr.salasInfo[0].origen).toBe('INFERRED');
  });

  it('OBSERVED (8) ≠ USER_REQUESTED (6): se avisa la divergencia y NO se cambia ninguno', () => {
    const pr = programaDelPlano([OP, { ...SALA, asientos: 8 }]);
    const av = avisosDeSala(pr, 6);
    expect(av.some((t) => /dibuja 8 asientos/.test(t) && /pediste 6/.test(t))).toBe(true);
    expect(pr.salas).toEqual([8]);                   // lo observado no se tocó
    // pedir exactamente lo observado → sin divergencia
    expect(avisosDeSala(pr, 8).some((t) => /dibuja 8 asientos/.test(t))).toBe(false);
  });

  it('el contrato del plano conserva `asientos` en mm y en metros (floorPlan) y desde la lectura (planoLeido)', () => {
    const mm = aMM([{ ...SALA, asientos: 8 }]);
    expect(mm[0].asientos).toBe(8);
    expect(aMetros(mm)[0].asientos).toBe(8);
    const lectura = {
      envolvente: { ancho: 15000, largo: 8800 },
      areas: [{ nombre: 'SALA DE CONSEJO', tipo: 'juntas', forma: 'poligono', puntos: [{ x: 0, y: 0 }, { x: 7000, y: 0 }, { x: 7000, y: 3200 }, { x: 0, y: 3200 }], dentroDe: '', puestos: 0, asientos: 8, confianza: 'media' }],
      puertas: [],
    };
    const { areas } = areasDeLectura(lectura);
    expect(areas[0].asientos).toBe(8);
    expect(areas[0].puestos).toBeUndefined();        // puestos=0 no es un conteo
  });
});
