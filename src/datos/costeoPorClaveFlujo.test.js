// BLOQUE 6 (orden #6): flujo COSTEAR por CLAVE end-to-end, determinista.
//   cargar BOM → costear → (guardar) → reabrir → recostear  debe dar EL MISMO número.
// Cubre los riesgos de FASE 6/7 del auditor: "errores al reabrir", "costos diferentes
// entre pantallas", "recalcular/comparar resultados". El flujo VONI (foto/plano) en
// navegador real está gated a CI con cuentas de prueba (e2e/*.e2e.js) — aquí se prueba
// la parte determinista del motor por clave, sin IA ni red.
import { describe, it, expect } from 'vitest';
import { costearBOM } from './productoMaestro.js';
import bomEntcb from './fixtures/bom/ENTCBCALP.json';
import bomHoriz from './fixtures/bom/TELCEL-VH-HORIZONTAL.json';

// Agregado real reconstruido desde claves_resumen (TELCEL-VH-ISLA): 1 línea = material, factores 10/25.
const bomIslaAgregado = {
  clave: 'TELCEL-VH-ISLA', tipo_bom: 'AGREGADO_HISTORICO',
  factor_mo: 0.10, factor_gif: 0.25, material_real: 3297.84, cos_fab_real: 4452.07,
  lineas: [{ desc: 'Material total (agregado de estimaciones)', cantidad: 1, precioConfirmado: 3297.84, esCompraVenta: false }],
};

const reabrir = (bom, insumos = {}) => costearBOM(JSON.parse(JSON.stringify(bom)), insumos); // copia = "reabrir de la DB"

describe('FLUJO por clave · reabrir y recostear dan el MISMO número (sin drift)', () => {
  for (const [nombre, bom, detallado] of [
    ['ENTCBCALP (detallado)', bomEntcb, true],
    ['TELCEL Horizontal (detallado)', bomHoriz, true],
    ['TELCEL Isla (agregado)', bomIslaAgregado, false],
  ]) {
    it(`${nombre}: costear = reabrir+recostear, byte a byte`, () => {
      const primera = costearBOM(bom, {});
      const reabierta = reabrir(bom, {});
      expect(JSON.stringify(reabierta)).toBe(JSON.stringify(primera));      // determinista, sin drift
      expect(reabierta.costoFabricacion).toBe(primera.costoFabricacion);    // mismo número entre "pantallas"
    });

    it(`${nombre}: reproduce su hoja ±1% y las banderas del contrato son correctas`, () => {
      const r = costearBOM(bom, {});
      expect(Math.abs(r.deltaPct)).toBeLessThanOrEqual(1);   // reproduce el cos_fab guardado
      expect(r.emitible).toBe(true);
      expect(r.orientativo).toBe(true);                       // sin catálogo vigente = precio histórico
      expect(r.certificable).toBe(false);                     // orientativo (y agregado) nunca certificable
      expect(r.tipoBom).toBe(detallado ? 'BOM_DETALLADO_VERIFICADO' : 'AGREGADO_HISTORICO');
    });
  }

  it('recostear tras un cambio de precio del catálogo se refleja (no queda pegado al histórico)', () => {
    // "reabrir" con un catálogo que ahora SÍ tiene precio vigente para una línea del Horizontal.
    const insumoId = bomHoriz.lineas[0].articulo;             // usa el artículo ERP como id de catálogo simulado
    const unidad = bomHoriz.lineas[0].unidad;                 // misma unidad que la línea (sin bloqueo de unidad)
    const bomConId = { ...bomHoriz, lineas: bomHoriz.lineas.map((l, i) => i === 0 ? { ...l, insumoId } : l) };
    const sinCat = costearBOM(bomConId, {});
    const conCat = costearBOM(bomConId, { [insumoId]: { id: insumoId, precio: bomHoriz.lineas[0].precioConfirmado * 2, unidad } });
    expect(conCat.costoFabricacion).toBeGreaterThan(sinCat.costoFabricacion); // el precio vigente manda
    expect(conCat.lineas[0].estado).toBe('precio_vigente');
  });
});
