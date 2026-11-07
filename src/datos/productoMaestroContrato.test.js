// CONTRATO SEGURO DE LÍNEA (P1 auditoría 2026-11-07) · RED → GREEN.
// Un BOM NUNCA debe presentar un costo incompleto como oficial. Cada línea cae en
// un estado explícito; los estados que NO se pueden costear BLOQUEAN la emisión.
//   precio_vigente     — catálogo con precio usable > 0            (ok, certificable)
//   precio_historico   — precioConfirmado > 0, sin catálogo usable (ok, ORIENTATIVO, no oficial)
//   cero_real          — línea excluida / suministrada por cliente (ok, cuesta 0 legítimo)
//   cantidad_invalida  — cantidad no finita o <= 0 sin exclusión   (BLOQUEA)
//   unidad_incompatible— unidad de línea ≠ catálogo sin conversión (BLOQUEA)
//   precio_faltante    — sin vigente, sin histórico, sin cero_real (BLOQUEA; incluye precio 0 no declarado)
import { describe, it, expect } from 'vitest';
import { costearBOM, precioLineaBOM, clasificarLineaBOM } from './productoMaestro.js';

describe('CONTRATO DE LÍNEA · ningún costo incompleto es oficial', () => {
  it('cantidad inválida (0 / negativa / NaN) BLOQUEA, no se trata como 0 en silencio', () => {
    for (const cant of [0, -2, NaN, undefined, 'x']) {
      const bom = { clave: 'T', lineas: [{ desc: 'lámina', cantidad: cant, precioConfirmado: 100 }] };
      const r = costearBOM(bom, {});
      expect(r.emitible, `cantidad=${cant}`).toBe(false);
      expect(r.bloqueos.some((b) => b.estado === 'cantidad_invalida')).toBe(true);
    }
  });

  it('precio faltante (sin catálogo ni confirmado) BLOQUEA', () => {
    const bom = { clave: 'T', lineas: [{ desc: 'x', insumoId: 'noexiste', cantidad: 1 }] };
    const r = costearBOM(bom, {});
    expect(r.emitible).toBe(false);
    expect(r.bloqueos.some((b) => b.estado === 'precio_faltante')).toBe(true);
  });

  it('precio de catálogo === 0 NO es "vigente": cuenta como precio_faltante y BLOQUEA', () => {
    const insumos = { 'kit': { id: 'kit', precio: 0, seccion: 'graficos', unidad: 'pza' } };
    const bom = { clave: 'T', lineas: [{ desc: 'kit led', insumoId: 'kit', cantidad: 1 }] };
    const r = costearBOM(bom, insumos);
    expect(r.emitible).toBe(false);
    expect(r.bloqueos.some((b) => b.estado === 'precio_faltante')).toBe(true);
  });

  it('línea excluida / suministrada por cliente = cero_real: cuesta 0 legítimo y NO bloquea', () => {
    const bom = { clave: 'T', lineas: [
      { desc: 'equipo refrigeración (cliente)', cantidad: 1, excluido: true },
      { desc: 'lámina', cantidad: 1, precioConfirmado: 100 },
    ] };
    const r = costearBOM(bom, {});
    expect(r.emitible).toBe(true);
    const cero = r.lineas.find((l) => l.estado === 'cero_real');
    expect(cero && cero.costo).toBe(0);
  });

  it('precio histórico (precioConfirmado) es ORIENTATIVO: emitible pero NO certificable', () => {
    const bom = { clave: 'T', lineas: [{ desc: 'lámina', cantidad: 2, precioConfirmado: 100 }] };
    const r = costearBOM(bom, {});
    expect(r.emitible).toBe(true);
    expect(r.orientativo).toBe(true);        // usa precio histórico
    expect(r.certificable).toBe(false);      // histórico ≠ oficial
  });

  it('precio vigente del catálogo (>0) es certificable por precio', () => {
    const insumos = { 'lam': { id: 'lam', precio: 50, seccion: 'metal', unidad: 'pza' } };
    const bom = { clave: 'T', lineas: [{ desc: 'lámina', insumoId: 'lam', cantidad: 2 }] };
    const r = costearBOM(bom, insumos);
    expect(r.emitible).toBe(true);
    expect(r.orientativo).toBe(false);
    expect(r.lineas[0].estado).toBe('precio_vigente');
  });

  it('unidad incompatible entre línea y catálogo BLOQUEA (no convierte en silencio)', () => {
    const insumos = { 'rollo': { id: 'rollo', precio: 500, seccion: 'metal', unidad: 'rollo' } };
    const bom = { clave: 'T', lineas: [{ desc: 'vinil', insumoId: 'rollo', cantidad: 3, unidad: 'm2' }] };
    const r = costearBOM(bom, insumos);
    expect(r.emitible).toBe(false);
    expect(r.bloqueos.some((b) => b.estado === 'unidad_incompatible')).toBe(true);
  });

  it('clasificarLineaBOM es puro y expone el estado por línea', () => {
    expect(clasificarLineaBOM({ insumoId: 'x', cantidad: 1 }, { x: { precio: 10, unidad: 'pza' } }).estado).toBe('precio_vigente');
    expect(clasificarLineaBOM({ cantidad: 1, precioConfirmado: 5 }, {}).estado).toBe('precio_historico');
    expect(clasificarLineaBOM({ cantidad: 0, precioConfirmado: 5 }, {}).estado).toBe('cantidad_invalida');
    expect(clasificarLineaBOM({ cantidad: 1 }, {}).estado).toBe('precio_faltante');
    expect(clasificarLineaBOM({ cantidad: 1, excluido: true }, {}).estado).toBe('cero_real');
  });

  it('AGREGADO_HISTORICO nunca es certificable, aunque tenga un número (orden #2)', () => {
    const bom = { clave: 'T', tipo_bom: 'AGREGADO_HISTORICO', factor_mo: 0.1, factor_gif: 0.25,
      lineas: [{ desc: 'Material total (agregado de estimaciones)', cantidad: 1, precioConfirmado: 1000 }] };
    const r = costearBOM(bom, {});
    expect(r.emitible).toBe(true);          // hay un número orientativo
    expect(r.tipoBom).toBe('AGREGADO_HISTORICO');
    expect(r.certificable).toBe(false);     // pero un agregado NO se certifica por materiales
  });

  it('BOM_DETALLADO_VERIFICADO con precios VIGENTES sí es certificable', () => {
    const insumos = { a: { id: 'a', precio: 10, unidad: 'pza' }, b: { id: 'b', precio: 20, unidad: 'pza' } };
    const bom = { clave: 'T', tipo_bom: 'BOM_DETALLADO_VERIFICADO',
      lineas: [{ desc: 'x', insumoId: 'a', cantidad: 1 }, { desc: 'y', insumoId: 'b', cantidad: 1 }] };
    const r = costearBOM(bom, insumos);
    expect(r.emitible).toBe(true);
    expect(r.orientativo).toBe(false);      // todo precio vigente
    expect(r.certificable).toBe(true);
  });

  it('back-compat: fuente y cobertura siguen existiendo para la UI', () => {
    const bom = { clave: 'T', lineas: [{ desc: 'lámina', cantidad: 1, precioConfirmado: 100 }] };
    const r = costearBOM(bom, {});
    expect(r.cobertura).toBeDefined();
    expect(r.lineas[0].fuente).toBe('confirmado');
  });
});
