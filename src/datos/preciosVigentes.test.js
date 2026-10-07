import { describe, it, expect } from 'vitest';
import { fusionarInsumos } from './preciosVigentes.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { calcular } from '../motor/calculo.js';

const BASE = mapaInsumos(INSUMOS_SEMILLA);
const fila = (insumo_id, precio, unidad_costeo, extra = {}) => ({
  insumo_id, precio: String(precio), unidad_costeo, estado: 'aprobado', certificable: true,
  fuente: 'Compras Intelisis', vigente_desde: '2026-10-06', ...extra,
});

describe('fusionarInsumos — el costeo toma el precio del catálogo de la base', () => {
  it('la copia vieja de config (MDF por m² sin fracción) ya no manda: forma del código, precio de la base', () => {
    const config = { mdf: { id: 'mdf', nombre: 'MDF', unidad: 'm2', precio: 100, actualizado: '2026-08-11' } };
    const { insumos } = fusionarInsumos(BASE, config, [fila('mdf', 512.5, 'hoja')]);
    expect(insumos.mdf.unidad).toBe('hoja');
    expect(insumos.mdf.fraccion).toBe(true);
    expect(insumos.mdf.precio).toBe(512.5);
    expect(insumos.mdf.origenPrecio).toBe('catalogo_bd');
  });

  it('no se pierden los insumos que la config no traía (colores de melamina, etc.)', () => {
    const config = { mdf: { id: 'mdf', unidad: 'm2', precio: 100, actualizado: '2026-08-11' } };
    const { insumos } = fusionarInsumos(BASE, config, []);
    expect(Object.keys(insumos).length).toBe(Object.keys(BASE).length);
    expect(insumos['melamina-16-color']).toBeTruthy();
  });

  it('si la unidad de la base no coincide con la del código, se queda el precio del código y se reporta', () => {
    const { insumos, resumen } = fusionarInsumos(BASE, {}, [fila('mdf', 100, 'm2')]);
    expect(insumos.mdf.precio).toBe(BASE.mdf.precio);
    expect(resumen.unidadDistinta).toEqual([{ id: 'mdf', codigo: 'hoja', bd: 'm2' }]);
  });

  it('un precio editado en la app gana solo si es más nuevo que el de la base y trae la misma unidad', () => {
    const vig = [fila('mdf', 500, 'hoja', { vigente_desde: '2026-10-06' })];
    const nuevo = fusionarInsumos(BASE, { mdf: { unidad: 'hoja', precio: 520, actualizado: '2026-10-08' } }, vig);
    expect(nuevo.insumos.mdf.precio).toBe(520);
    expect(nuevo.insumos.mdf.origenPrecio).toBe('editado_en_app');
    const viejo = fusionarInsumos(BASE, { mdf: { unidad: 'hoja', precio: 520, actualizado: '2026-10-01' } }, vig);
    expect(viejo.insumos.mdf.precio).toBe(500);
    const otraUnidad = fusionarInsumos(BASE, { mdf: { unidad: 'm2', precio: 999, actualizado: '2026-12-01' } }, vig);
    expect(otraUnidad.insumos.mdf.precio).toBe(500);
  });

  it('un insumo dado de alta solo en la app se conserva', () => {
    const alta = { id: 'herraje-x', nombre: 'Herraje X', unidad: 'pza', precio: 12 };
    const { insumos, resumen } = fusionarInsumos(BASE, { 'herraje-x': alta }, []);
    expect(insumos['herraje-x']).toEqual(alta);
    expect(resumen.soloEnConfig).toEqual(['herraje-x']);
  });

  it('ignora precios vacíos o cero', () => {
    const { insumos, resumen } = fusionarInsumos(BASE, {}, [fila('mdf', 0, 'hoja'), fila('no-existe', 0, 'pza'), { insumo_id: 'mdf-16', precio: null, unidad_costeo: 'hoja' }]);
    expect(insumos.mdf.precio).toBe(BASE.mdf.precio);
    expect(insumos['mdf-16'].precio).toBe(BASE['mdf-16'].precio);
    expect(insumos['no-existe']).toBeUndefined();
    expect(resumen.sinFormaEnCodigo).toEqual(['no-existe']);
  });

  it('un insumo dado de alta solo en la base entra con su unidad de compra y se puede costear', () => {
    const { insumos, resumen } = fusionarInsumos(BASE, {}, [fila('erp-x1', 12.5, 'pza', { nombre: 'Tornillo X', seccion: 'herrajes' })]);
    expect(insumos['erp-x1']).toMatchObject({ nombre: 'Tornillo X', seccion: 'herrajes', unidad: 'pza', precio: 12.5, fraccion: false, altaEnBD: true });
    expect(resumen.altasDesdeBD).toEqual(['erp-x1']);
    const r = calcular({ componentes: [{ insumoId: 'erp-x1', nombre: 'Tornillo', cantidad: 8 }], modoManoObra: 'porcentaje' }, 1, insumos);
    expect(r.materialDirecto).toBeCloseTo(100, 6);
  });

  it('no muta la semilla', () => {
    const antes = BASE.mdf.precio;
    fusionarInsumos(BASE, {}, [fila('mdf', 1, 'hoja')]);
    expect(BASE.mdf.precio).toBe(antes);
  });

  it('repisa 40x20 (3 piezas, lote de 4): con la copia vieja cobraba una hoja entera; con el catálogo cobra la fracción', () => {
    // Misma forma que `config.datos.insumos.mdf` en producción (2026-10-07); precios ficticios.
    const viejo = { mdf: { id: 'mdf', clase: 'directa', nombre: 'MDF', precio: 100, unidad: 'm2', mermaCorte: 6, actualizado: '2026-08-11',
      formato: { tipo: 'tablero', corto: 'tablero', medida: 2.9768, nombre: 'tablero 1.22 x 2.44', anchoMM: 1220, largoMM: 2440 } } };
    const { insumos } = fusionarInsumos(BASE, viejo, [fila('mdf', 300, 'hoja')]);
    const pieza = { componentes: [{ insumoId: 'mdf', nombre: 'Repisa', largoMM: 400, anchoMM: 200, piezas: 3 }], modoManoObra: 'porcentaje' };
    const antes = calcular(pieza, 4, viejo).materialDirecto;
    const ahora = calcular(pieza, 4, insumos).materialDirecto;
    expect(antes).toBeCloseTo(100 * 2.9768, 2);
    expect(ahora).toBeGreaterThan(0);
    expect(ahora).toBeLessThan(antes / 2);
  });
});
