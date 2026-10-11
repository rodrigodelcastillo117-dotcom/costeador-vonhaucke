// VH-050: un costo DERIVADO del precio (price-book / escalón por usuario) nunca se
// presenta como costo medido. La banca App LT es el caso real: su costo sale de
// precio/0.6/3.6, y antes la pantalla lo etiquetaba "real".
import { describe, it, expect } from 'vitest';
import { costearItem, costearConfig, precioDePieza } from './lineas.js';
import { mapaInsumos, INSUMOS_SEMILLA } from './insumos.js';
import { PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { claseCosto } from '../util.js';
import { crearPartida } from './partida.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, piezas: {} };
const bancaLT = { ruta: 'applt', producto: 'banca_doble', cantidad: 1, seleccion: [{ clave: 'usuarios', valor: '6' }, { clave: 'largoMM', valor: '1500' }] };

describe('costoDerivado viaja con la partida', () => {
  it('banca App LT (precio por usuario): el costo es derivado y la clase lo dice', () => {
    const r = costearItem(estado, bancaLT);
    expect(r.costoUnitario).toBeCloseTo(9125, 0);
    expect(r.costoDerivado).toBe(true);
    const p = crearPartida(r, { veCostos: true });
    expect(p.costoDerivado).toBe(true);
    expect(claseCosto(p)).toMatchObject({ clase: 'derivado', aprox: true });
  });
  it('recostear con config (EditarPartida) conserva la marca', () => {
    const r = costearItem(estado, bancaLT);
    const n = costearConfig(estado, 'applt', 'banca_doble', r.config, 1);
    expect(n.costoDerivado).toBe(true);
    expect(n.costoUnitario).toBeCloseTo(r.costoUnitario, 2);
  });
  it('precio de MODELO (sin price-book ni escalón): costo medido, no derivado', () => {
    const insumos = { tablero: { id: 'tablero', nombre: 'Tablero', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 } };
    const g = { nombre: 'Mueble', componentes: [{ nombre: 'Cubierta', insumoId: 'tablero', largoMM: 1200, anchoMM: 600, piezas: 1 }] };
    const pr = precioDePieza({ insumos, parametros: { ...PARAMETROS_DEFAULT, margenObjetivo: 50 } }, 'zzz-sin-catalogo', g, { ...g, modoManoObra: 'porcentaje' }, 1, {});
    expect(pr.costoDerivado).toBe(false);
    expect(pr.costo).toBeGreaterThan(0);
    expect(claseCosto({ costoUnitario: pr.costo, margen: pr.margen, precioUnitario: pr.precio })).toMatchObject({ clase: 'real' });
  });
});
