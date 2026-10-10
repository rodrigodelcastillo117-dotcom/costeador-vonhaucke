import { describe, expect, it } from 'vitest';
import { proxyTableroParaEstimar } from './proxyTableroEstimado.js';
import { familiaDeMaterial, aplicarPoliticaMaterial, MATCH } from './materialMatch.js';
import { calcular, costeoEmitible } from '../motor/calculo.js';

// Datos sintéticos PARA PRUEBA, no costos comerciales reales.
const hoja = { tipo: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const activo = {
  'melamina-9': { id: 'melamina-9', nombre: 'Melamina 9 mm (biombo)', precio: 50, unidad: 'hoja', formato: hoja, seccion: 'cubiertas' },
  'melamina-16': { id: 'melamina-16', nombre: 'Melamina 16 mm', precio: 50, unidad: 'hoja', formato: hoja, seccion: 'cubiertas' },
  'melamina-19': { id: 'melamina-19', nombre: 'Melamina / EcoLegno 19 mm', precio: 100, unidad: 'hoja', formato: hoja, seccion: 'cubiertas' },
  'melamina-28': { id: 'melamina-28', nombre: 'Melamina ABS 28 mm (cubierta APP LT)', precio: 50, unidad: 'hoja', formato: hoja, seccion: 'cubiertas' },
  'divisor-melamina': { id: 'divisor-melamina', nombre: 'Divisor de melamina', precio: 50, unidad: 'hoja', formato: hoja, seccion: 'mamparas' },
  'faldon-melamina': { id: 'faldon-melamina', nombre: 'Faldon melamina', precio: 50, unidad: 'hoja', formato: hoja, seccion: 'cubiertas' },
};
describe('costo provisional automático cuando el plano pide 18mm nogal', () => {
  it('corrige familia Melamina/EcoLegno y respeta HPL explícito', () => {
    expect(familiaDeMaterial('Melamina / EcoLegno 19 mm')).toBe('melamina');
    expect(familiaDeMaterial('Laminado HPL EcoLegno')).toBe('laminado_hpl');
  });
  it('elige 19 mm configurado sin escoger divisor/9/16/28 mm', () => {
    const proxy = proxyTableroParaEstimar('Melamina 18 mm nogal claro', activo);
    expect(proxy.id).toBe('melamina-19');
    expect(proxy.modo).toBe('COSTEO_PROVISIONAL_18_A_19');
  });
  it('COSTEA en el motor PERO BLOQUEA la emisión', () => {
    const solicitado = 'Melamina 18 mm nogal claro';
    const proxy = proxyTableroParaEstimar(solicitado, activo);
    const base = aplicarPoliticaMaterial({
      nombre: 'Puertas exhibidor', insumoId: proxy.id,
      material_solicitado: solicitado, material_confirmado: false,
    }, id => activo[id], Object.values(activo));
    expect(base.insumoId).toBe('melamina-19');
    expect(base.material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(base.material_confirmado).not.toBe(true);
    const comp = { ...base, forma: 'area', largoMM: 800, anchoMM: 400, piezas: 2, cantidad: 1 };
    const resultado = calcular({ nombre: 'Mueble QA', componentes: [comp], piezas: 1, modoManoObra: 'porcentaje' }, 1, activo);
    expect(Number.isFinite(resultado.costoUnitario)).toBe(true);
    expect(resultado.costoUnitario).toBeGreaterThan(0);
    const gate = costeoEmitible(resultado);
    expect(gate.emitible).toBe(false);
    expect(gate.costoTotal).toBeNull();
    expect(gate.bloqueos.materiales_por_confirmar.length).toBeGreaterThan(0);
  });
  it('no inventa precio cero ni usa candidato no aprobado por el catálogo activo', () => {
    expect(proxyTableroParaEstimar('Melamina 18 mm nogal claro', {
      ...activo, 'melamina-19': { ...activo['melamina-19'], precio: null, precioBase: null },
    })).toBeNull();
  });
  it('no simula automáticamente acero/PTR de otro calibre, herrajes ni vidrio', () => {
    for (const pedido of ['Estructura PTR cal.16', 'Lámina cal.14', 'Bisagra negra', 'Cristal templado 8 mm']) {
      expect(proxyTableroParaEstimar(pedido, activo)).toBeNull();
    }
  });
  it('no usa melamina blanca para suplir nogal', () => {
    const blanco = {
      ...activo, 'melamina-19': { ...activo['melamina-19'], nombre: 'Melamina BLANCA / EcoLegno 19 mm' },
    };
    expect(proxyTableroParaEstimar('Melamina 18 mm nogal claro', blanco)).toBeNull();
  });
  it('no elige entre 2 insumos iguales/ambiguos por precio menor', () => {
    const ambiguo = {
      ...activo,
      'melamina-19-color': { ...activo['melamina-19'], id: 'melamina-19-color', nombre: 'Melamina / EcoLegno 19 mm' },
    };
    expect(proxyTableroParaEstimar('Melamina 18 mm nogal claro', ambiguo)).toBeNull();
  });
});
