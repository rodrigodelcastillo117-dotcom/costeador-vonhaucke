// ============================================================================
//  VONI host live cost context (comportamiento, 2026-10-14).
//  Antes: buscaba `calcularCosteoVivo(estado, costeo).resultado` y `costing: veCostos ? voniCosting : null` en
//  el TEXTO de App.jsx. Ahora ejecuta las funciones que App usa para armar el contexto de Voni
//  (datos/contextoVoni.js) con el motor REAL y con los tres roles.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { costeoVivoParaVoni, partidasLocalesVoni, economiaVoni } from '../datos/contextoVoni.js';
import { calcularCosteoVivo } from '../motor/costeoVivo.js';
import { veCostosCosteo } from '../datos/roles.js';

const estado = {
  parametros: { margenObjetivo: 50, factorIndirectosFabrica: 12, mermaProceso: 5, empaquePorPieza: 0 },
  insumos: { mdf: { id: 'mdf', nombre: 'MDF', seccion: 'cubiertas', clase: 'directa', unidad: 'm2', precio: 300, fraccion: true, mermaCorte: 0 } },
};
const costeo = {
  nombre: 'Mesa prueba', piezas: 2, modoManoObra: 'porcentaje', factorDirecta: null, factorIndirecta: null, preparacionHoras: 0,
  horas: { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0 },
  componentes: [{ nombre: 'Cubierta', insumoId: 'mdf', cantidad: 1, piezas: 1, largoMM: 1200, anchoMM: 600 }],
};

describe('VONI host live cost context', () => {
  it('uses the shared live cost path: el costeo de Voni ES el resultado vivo del Costeador', () => {
    const v = costeoVivoParaVoni({ veCostos: true, estado, costeo });
    expect(v).toEqual(calcularCosteoVivo(estado, costeo).resultado);
    expect(v.costoUnitario).toBeGreaterThan(0);
    // y no un recálculo paralelo: si el motor vivo cambia, Voni ve el cambio.
    const espia = vi.fn(() => ({ resultado: { costoUnitario: 123.45 } }));
    expect(costeoVivoParaVoni({ veCostos: true, estado, costeo }, espia)).toEqual({ costoUnitario: 123.45 });
    expect(espia).toHaveBeenCalledWith(estado, costeo);
  });

  it('sin BOM o con motor que falla ⇒ null (no inventa costo)', () => {
    expect(costeoVivoParaVoni({ veCostos: true, estado, costeo: { ...costeo, componentes: [] } })).toBeNull();
    expect(costeoVivoParaVoni({ veCostos: true, estado, costeo: null })).toBeNull();
    expect(costeoVivoParaVoni({ veCostos: true, estado, costeo }, () => { throw new Error('x'); })).toBeNull();
  });

  it('only injects economic context when the host already allows cost visibility', () => {
    const espia = vi.fn(() => ({ resultado: { costoUnitario: 1 } }));
    for (const rol of ['vendedor', 'ventas', 'cfo', '', null]) {
      const veCostos = veCostosCosteo(rol);
      expect(veCostos, String(rol)).toBe(false);
      expect(costeoVivoParaVoni({ veCostos, estado, costeo }, espia)).toBeNull();
      expect(economiaVoni({ veCostos, costeo, voniCosting: { costoUnitario: 1 } })).toEqual({ bom: null, costing: null });
    }
    expect(espia).not.toHaveBeenCalled();                     // al vendedor ni siquiera se le corre el motor
    for (const rol of ['direccion', 'diseno', 'Diseño']) {
      const veCostos = veCostosCosteo(rol);
      expect(veCostos, rol).toBe(true);
      expect(economiaVoni({ veCostos, costeo, voniCosting: { costoUnitario: 9 } })).toEqual({ bom: costeo.componentes, costing: { costoUnitario: 9 } });
    }
  });

  it('las partidas en pantalla viajan a Voni sin costo ni margen', () => {
    const r = partidasLocalesVoni([{ nombre: 'Mesa', cantidad: 2, precioUnitario: 1000, costoUnitario: 600, margen: 40, costoDerivado: true }, { nombre: 'Silla', cantidad: 1, precioUnitario: null }]);
    expect(r).toEqual([
      { nombre: 'Mesa', cantidad: 2, precioUnitario: 1000, sinPrecioAutorizado: false },
      { nombre: 'Silla', cantidad: 1, precioUnitario: null, sinPrecioAutorizado: true },
    ]);
    expect(partidasLocalesVoni(undefined)).toEqual([]);
  });

  // STATIC GUARD: App.jsx no se monta en node (sin jsdom). Sólo el CABLEADO: veCostos sale de los roles y el
  // contexto de Voni se arma con las funciones probadas arriba.
  it('cableado: App arma el contexto de Voni con las funciones probadas', () => {
    const s = fs.readFileSync('src/App.jsx', 'utf8');
    expect(s).toContain('const veCostos = esDireccion || esDiseno');
    expect(s).toContain('costeoVivoParaVoni({ veCostos, estado, costeo })');
    expect(s).toContain('partidasLocales: partidasLocalesVoni(estado.cotizacion?.partidas)');
    expect(s).toContain('...economiaVoni({ veCostos, costeo, voniCosting })');
  });
});
