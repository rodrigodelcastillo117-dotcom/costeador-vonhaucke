// COSTEAR 100 · FASE 21 — VONI ingeniería de valor (segundo cerebro).
// Propone mejoras (menos desperdicio / mejor fabricación / sustitución) SIN cambiar
// el diseño ni el costo original. Honestidad: ahorro sólo con datos reales; lo
// desconocido es HIPÓTESIS, nunca un número inventado.
import { describe, it, expect } from 'vitest';
import { analizarValor } from './ingenieriaValor.js';

const op = (r, regla) => r.oportunidades.find((o) => o.regla === regla);

describe('ingenieriaValor · oportunidades', () => {
  it('módulo metálico con muchas uniones → "reducir soldaduras" (requiere Ingeniería, HIPÓTESIS)', () => {
    const r = analizarValor({ piezas: [
      { nombre: 'Lámina negra calibre 18' }, { nombre: 'Lámina negra calibre 14' },
      { nombre: 'Tubular 1"' }, { nombre: 'Perfil ángulo' },
    ] });
    const o = op(r, 'reducir_soldaduras');
    expect(o).toBeTruthy();
    expect(o.requiere_validacion_ingenieria).toBe(true);
    expect(o.ahorro.fuente).toBe('HIPOTESIS');
    expect(o.ahorro.monto).toBeUndefined(); // nunca inventa un monto
  });

  it('muchas piezas de tablero → "nesting / agrupar cortes" (sin validación de diseño)', () => {
    const r = analizarValor({ piezas: [
      { nombre: 'Cubierta melamina', semantic_role: 'cubierta' },
      { nombre: 'Lateral melamina', semantic_role: 'lateral' },
      { nombre: 'Entrepaño melamina', semantic_role: 'entrepano' },
      { nombre: 'Fondo melamina', semantic_role: 'fondo' },
    ] });
    const o = op(r, 'nesting_tableros');
    expect(o).toBeTruthy();
    expect(o.requiere_validacion_ingenieria).toBe(false);
  });

  it('pieza repetida ≥3× → "estandarizar" (señal factual, confianza ALTA)', () => {
    const rep = { nombre: 'Entrepaño 900×300', semantic_role: 'entrepano', largoMM: 900, anchoMM: 300, insumoId: 'mel16' };
    const r = analizarValor({ piezas: [rep, { ...rep }, { ...rep }, { ...rep }] });
    const o = op(r, 'estandarizar_repetidas');
    expect(o).toBeTruthy();
    expect(o.confianza).toBe('ALTA');
    expect(o.porque).toMatch(/4/);
  });

  it('MDF con laca → sustitución por durabilidad: es mejora de CALIDAD, ahorro=null, pide confirmación', () => {
    const r = analizarValor({ piezas: [
      { nombre: 'Puerta MDF', semantic_role: 'puerta' },
      { nombre: 'Laca poliuretano mate' },
    ] });
    const o = op(r, 'material_durabilidad');
    expect(o).toBeTruthy();
    expect(o.ahorro).toBeNull();               // calidad, no ahorro
    expect(o.requiere_confirmacion).toBe(true);
  });

  it('cantidad ≥2 → "fabricar por lote"', () => {
    const r = analizarValor({ piezas: [{ nombre: 'Cubierta melamina', semantic_role: 'cubierta' }], cantidad: 10 });
    expect(op(r, 'fabricacion_lote')).toBeTruthy();
  });
});

describe('ingenieriaValor · honestidad (no inventa ahorros; no cambia el diseño)', () => {
  it('NINGÚN ahorro con monto CALCULADO sin datos reales; resumen lo declara', () => {
    const r = analizarValor({ piezas: [
      { nombre: 'Lámina negra 18' }, { nombre: 'Lámina negra 14' }, { nombre: 'Tubular 1"' }, { nombre: 'Perfil' },
    ], cantidad: 5 });
    for (const o of r.oportunidades) {
      if (o.ahorro) {
        expect(['HIPOTESIS', 'CALCULADO']).toContain(o.ahorro.fuente);
        if (o.ahorro.fuente === 'HIPOTESIS') expect(o.ahorro.monto).toBeUndefined();
      }
    }
    expect(r.resumen.ahorros_calculados).toBe(0); // hoy, sin datos reales, 0 montos calculados
    expect(r.resumen.hipotesis).toBeGreaterThan(0);
  });

  it('palanca de costo: con costos cargados, identifica dónde se concentra el material (contexto CALCULADO, no ahorro)', () => {
    const r = analizarValor({ piezas: [
      { nombre: 'Lámina negra 18', costo: 2000 },
      { nombre: 'Cubierta melamina', semantic_role: 'cubierta', costo: 300 },
      { nombre: 'Bisagra', semantic_role: 'herraje', costo: 50 },
    ] });
    expect(r.resumen.palanca_de_costo).toBeTruthy();
    expect(r.resumen.palanca_de_costo.subsistema).toBe('estructura'); // la lámina domina
    expect(r.resumen.palanca_de_costo.pct).toBeGreaterThan(50);
  });

  it('sin costos cargados → palanca null (no inventa participación)', () => {
    const r = analizarValor({ piezas: [{ nombre: 'Lámina negra 18' }] });
    expect(r.resumen.palanca_de_costo).toBeNull();
  });
});

describe('ingenieriaValor · módulo REAL TELCEL (Almacenamiento) no dispara falsa sustitución de material', () => {
  it('la pintura en polvo del metal NO dispara "MDF→HPL" (es acabado del acero, no del MDF)', () => {
    const r = analizarValor({ piezas: [
      { nombre: 'LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - LN1838' },
      { nombre: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - LN18310' },
      { nombre: 'LAMINA NEGRA HOJA 4 X 8 CALIBRE 18 ACERO 1008 - LN1848' },
      { nombre: 'LAMINA NEGRA HOJA 4 X 10 CALIBRE 18 ACERO 1008 - LN18410' },
      { nombre: 'PINTURA EN POLVO - PPH BLANCO 9016 TELCEL' },
      { nombre: 'BISAGRA BIDIMENSIONAL 110° - BIBI', semantic_role: 'herraje' },
      { nombre: 'Superficie de trabajo, cubierta MDF 12mm laminado blanco', semantic_role: 'cubierta' },
    ] });
    expect(op(r, 'material_durabilidad')).toBeFalsy();      // no hay laca/barniz sobre MDF
    expect(op(r, 'reducir_soldaduras')).toBeTruthy();       // 4 láminas → sí evaluar uniones
  });
});
