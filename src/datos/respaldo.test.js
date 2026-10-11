import { describe, it, expect } from 'vitest';
import { armarRespaldo, validarRespaldo, aplicarRespaldo, sinEconomia, nombreArchivoRespaldo, RESPALDO_VERSION } from './respaldo.js';
import { PARAMS_SENSIBLES } from '../almacen.js';

const estadoDireccion = {
  insumos: { mdf: { id: 'mdf', precio: 900, proveedor: 'Masisa' } },
  piezas: { x: { id: 'x' } },
  parametros: { ivaPorcentaje: 16, margenObjetivo: 50, nominaSemanalTotal: 999999, costoHoraArea: { pm: 1 } },
  finanzas: { ingresos: 74700000 },
  historial: [{ id: 'h1', costo: 10 }],
  cotizacion: {
    id: 77, claveCreacion: 'cot-abc-1234567', cliente: 'Tradeco', folio: 'T-1',
    partidas: [{ id: 'p1', nombre: 'Banca', cantidad: 1, precioUnitario: 2000, costoUnitario: 1000, margen: 30, config: { costoHora: 5 } }],
    acomodo: { areasM: [{ nombre: 'Open', ancho: 6, largo: 4 }] },
  },
};

describe('sinEconomia replica la regla del servidor', () => {
  it('quita costo/margen/proveedor a cualquier profundidad y deja el resto', () => {
    const r = sinEconomia({ costoUnitario: 1, Margen: 2, precioUnitario: 3, nombre: 'a', config: { costoHora: 5, color: 'x' }, items: [{ proveedor: 'p', q: 1 }] });
    expect(r).toEqual({ precioUnitario: 3, nombre: 'a', config: { color: 'x' }, items: [{ q: 1 }] });
  });
});

describe('armarRespaldo respeta el rol', () => {
  it('vendedor: cotización sin economía y SIN insumos/parámetros/finanzas', () => {
    const r = armarRespaldo(estadoDireccion, { veCostos: false, usuario: 'v@vh.mx' });
    expect(r.version).toBe(RESPALDO_VERSION);
    expect(r.incluyeEconomia).toBe(false);
    expect(r.cotizacion.id).toBe(77);
    expect(r.cotizacion.claveCreacion).toBe('cot-abc-1234567');
    expect(r.cotizacion.partidas[0]).not.toHaveProperty('costoUnitario');
    expect(r.cotizacion.partidas[0]).not.toHaveProperty('margen');
    expect(r.cotizacion.partidas[0].config).toEqual({});
    expect(r).not.toHaveProperty('insumos');
    expect(r).not.toHaveProperty('parametros');
    expect(r).not.toHaveProperty('finanzas');
    expect(r).not.toHaveProperty('historial');
  });

  it('dirección: lleva economía, insumos, piezas, parámetros… pero NUNCA la nómina ni finanzas', () => {
    const r = armarRespaldo(estadoDireccion, { veCostos: true, usuario: 'r@vh.mx' });
    expect(r.incluyeEconomia).toBe(true);
    expect(r.cotizacion.partidas[0].costoUnitario).toBe(1000);
    expect(r.insumos.mdf.precio).toBe(900);
    expect(r.parametros.margenObjetivo).toBe(50);
    for (const f of PARAMS_SENSIBLES) expect(r.parametros).not.toHaveProperty(f);
    expect(r).not.toHaveProperty('finanzas');
    expect(r.historial).toHaveLength(1);
  });

  it('el nombre del archivo es legible y seguro', () => {
    expect(nombreArchivoRespaldo({ cotizacion: { cliente: 'Tradeco S.A. de C.V.' }, creado: '2026-10-10T12:00:00Z' }))
      .toBe('respaldo-vonhaucke-tradeco-s-a-de-c-v-2026-10-10.json');
  });
});

describe('validarRespaldo', () => {
  it('rechaza basura, versiones desconocidas y respaldos sin renglones', () => {
    expect(validarRespaldo(null).ok).toBe(false);
    expect(validarRespaldo({ version: 'otra', cotizacion: { partidas: [] } }).ok).toBe(false);
    expect(validarRespaldo({ version: RESPALDO_VERSION }).ok).toBe(false);
    expect(validarRespaldo({ version: RESPALDO_VERSION, cotizacion: { partidas: 'x' } }).ok).toBe(false);
    expect(validarRespaldo({ version: RESPALDO_VERSION, cotizacion: { id: 'abc', partidas: [] } }).ok).toBe(false);
  });
  it('acepta uno bien formado', () => {
    expect(validarRespaldo(armarRespaldo(estadoDireccion, { veCostos: true })).ok).toBe(true);
  });
});

describe('aplicarRespaldo', () => {
  const vacio = { insumos: {}, piezas: {}, parametros: { ivaPorcentaje: 16 }, historial: [], cotizacion: { cliente: '', partidas: [] } };

  it('restaura la MISMA cotización (id y clave) en otra computadora', () => {
    const r = armarRespaldo(estadoDireccion, { veCostos: true });
    const e = aplicarRespaldo(vacio, r, { veCostos: true });
    expect(e.cotizacion.id).toBe(77);
    expect(e.cotizacion.claveCreacion).toBe('cot-abc-1234567');
    expect(e.cotizacion.partidas[0].costoUnitario).toBe(1000);
    expect(e.insumos.mdf.precio).toBe(900);
    expect(e.historial).toHaveLength(1);
  });

  it('un vendedor que restaura el archivo de Dirección NO recibe economía ni insumos', () => {
    const r = armarRespaldo(estadoDireccion, { veCostos: true });   // archivo con todo
    const e = aplicarRespaldo(vacio, r, { veCostos: false });
    expect(e.cotizacion.partidas[0]).not.toHaveProperty('costoUnitario');
    expect(e.insumos).toEqual({});
    expect(e.parametros).toEqual({ ivaPorcentaje: 16 });
  });

  it('la nómina jamás entra aunque alguien la meta a mano en el archivo', () => {
    const r = armarRespaldo(estadoDireccion, { veCostos: true });
    r.parametros.nominaSemanalTotal = 123;
    const e = aplicarRespaldo(vacio, r, { veCostos: true });
    expect(e.parametros).not.toHaveProperty('nominaSemanalTotal');
  });

  it('un respaldo inválido lanza con motivo legible', () => {
    expect(() => aplicarRespaldo(vacio, { version: 'x' })).toThrow(/Versión/);
  });
});
