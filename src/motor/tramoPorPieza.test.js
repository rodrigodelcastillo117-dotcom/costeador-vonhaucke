// ============================================================================
//  Tramo vendido por PIEZA (14-oct-2026). Intelisis compra 142 perfiles/tubulares por "PIEZA DE 6000 mm" (unidad pza).
//  El consumo del motor va en metros; el precio por metro es $/pieza ÷ 6. Paridad contra el cotizador Intelisis real
//  (fixtures/intelisis_alba_2026-08-12.json: TRE181123 $383.28/pieza en las patas U ATPU2M/75M/3M) con la merma de
//  corte que se calculó de esos mismos tres reportes (6.94 %, autorizada por Dirección el 14-oct).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { calcular, precioPorTramo, unidadDeConsumo, precioPorUnidadDeConsumo, costoNetoComponente, conTramoPorPieza, esTubularD2, incompatibilidadUnidad } from './calculo.js';
import intelisis from './fixtures/intelisis_alba_2026-08-12.json';

const TRE = { id: 'erp-tre181123', nombre: 'TUBULAR INDUSTRIAL RECTANGULAR 1 1/2" X 3" CALIBRE 18 PIEZA DE 6000 mm - "TRE181123"', seccion: 'metal',
  unidad: 'pza', precio: 383.28, formato: { tipo: 'tramo', nombre: 'tramo de 6 m', corto: 'tramo', medida: 6 }, mermaCorte: 6.94 };
const tubo = (r) => r.detalleInsumos.find((d) => d.insumoId === TRE.id);

describe('precio por metro de un tramo vendido por pieza', () => {
  it('sólo con formato tramo y unidad de pieza; un insumo en metros o sin formato no cambia', () => {
    expect(precioPorTramo(TRE)).toBe(true);
    expect(precioPorUnidadDeConsumo(TRE)).toBeCloseTo(63.88, 2);
    expect(unidadDeConsumo(TRE)).toBe('m');
    const enMetros = { ...TRE, unidad: 'm', precio: 40 };
    expect(precioPorTramo(enMetros)).toBe(false); expect(precioPorUnidadDeConsumo(enMetros)).toBe(40); expect(unidadDeConsumo(enMetros)).toBe('m');
    const sinFormato = { ...TRE, formato: null };
    expect(precioPorTramo(sinFormato)).toBe(false); expect(unidadDeConsumo(sinFormato)).toBe('pza');
    const tablero = { ...TRE, formato: { tipo: 'tablero', medida: 2.9768 } };
    expect(precioPorTramo(tablero)).toBe(false);
  });
});

describe('paridad con Intelisis en las patas U (TRE181123)', () => {
  // Pata U = dos patas de 720 mm + travesaño del ancho del modelo.
  const casos = [['ATPU2M', 600], ['ATPU75M', 750], ['ATPU3M', 900]];
  for (const [art, ancho] of casos) {
    it(`${art}: costo del tubular dentro de ±1.5 % del cotizador Intelisis`, () => {
      const fila = intelisis.find((x) => x.articulo === art);
      const mat = fila.materiales.find((m) => /TRE181123/.test(m.descripcion));
      const intelisisCosto = mat.cantidad * mat.ultimo_costo;
      const metros = (2 * 720 + ancho) / 1000;
      const r = calcular({ componentes: [{ nombre: 'Pata U', insumoId: TRE.id, cantidad: metros, forma: 'lineal' }] }, 1, { [TRE.id]: TRE });
      const d = tubo(r);
      expect(d.reglaTramo).toBe('FRACCION_D2');
      expect(d.costo).toBeCloseTo(metros * 1.0694 / 6 * 383.28, 6);
      expect(Math.abs(d.costo - intelisisCosto) / intelisisCosto).toBeLessThan(0.015);
      expect(r.componentesIgnorados).toEqual([]);
    });
  }

  it('sin la conversión el mismo tubular costaría 6 veces más (metros × $/pieza): el guard de regresión', () => {
    const r = calcular({ componentes: [{ nombre: 'Pata U', insumoId: TRE.id, cantidad: 2.04, forma: 'lineal' }] }, 1, { [TRE.id]: TRE });
    expect(tubo(r).costo).toBeLessThan(150);              // antes del cambio: 2.04 × 1.0694 × 383.28 ≈ $836
    expect(costoNetoComponente({ insumoId: TRE.id, cantidad: 2.04 }, TRE)).toBeCloseTo(2.04 * 63.88, 6);
  });

  it('un lote de 10 patas sigue por fracción (no redondea a tramos enteros por mueble)', () => {
    const r = calcular({ componentes: [{ nombre: 'Pata U', insumoId: TRE.id, cantidad: 2.04, forma: 'lineal' }] }, 10, { [TRE.id]: TRE });
    expect(tubo(r).costo).toBeCloseTo(10 * 2.04 * 1.0694 / 6 * 383.28, 4);
  });
});

describe('perfil por pieza que NO es tubular D2 (ángulo): tramos enteros, al precio de la pieza', () => {
  it('1.5 m de ángulo compra 1 tramo y cuesta una pieza', () => {
    const AN = { id: 'erp-an13166', nombre: 'ANGULO LADOS IGUALES DE 1" ESPESOR 3/16" PIEZA DE 6000 mm', seccion: 'metal', unidad: 'pza', precio: 300,
      formato: { tipo: 'tramo', medida: 6 }, mermaCorte: 5 };
    const r = calcular({ componentes: [{ nombre: 'Refuerzo', insumoId: AN.id, cantidad: 1.5, forma: 'lineal' }] }, 1, { [AN.id]: AN });
    const d = r.detalleInsumos.find((x) => x.insumoId === AN.id);
    expect(d.unidades).toBe(1); expect(d.costo).toBeCloseTo(300, 6);
  });
});

describe('como lo declara el catálogo: atributos.tramoPorPieza + mermaTramo (el motor anterior lo ignora)', () => {
  // Así llega de catalogo_motor: formato null, mermaCorte 0 y las dos llaves nuevas.
  const CAT = { ...TRE, formato: null, mermaCorte: 0, tramoPorPieza: { tipo: 'tramo', nombre: 'pieza de 6000 mm', corto: 'pieza', medida: 6 }, mermaTramo: 6.94 };
  it('se adopta como formato con su merma; un formato ya declarado manda', () => {
    expect(conTramoPorPieza(CAT).formato.medida).toBe(6); expect(conTramoPorPieza(CAT).mermaCorte).toBe(6.94);
    const conFormato = { ...CAT, formato: { tipo: 'tablero', medida: 2.9768 } };
    expect(conTramoPorPieza(conFormato)).toBe(conFormato);
    expect(conTramoPorPieza({ ...CAT, tramoPorPieza: { tipo: 'tramo', medida: 0 } }).formato).toBeNull();
    expect(esTubularD2(CAT)).toBe(true); expect(unidadDeConsumo(CAT)).toBe('m');
  });
  it('cuesta igual que con formato explícito (ATPU2M)', () => {
    const a = calcular({ componentes: [{ nombre: 'Pata U', insumoId: TRE.id, cantidad: 2.04, forma: 'lineal' }] }, 1, { [TRE.id]: CAT });
    const b = calcular({ componentes: [{ nombre: 'Pata U', insumoId: TRE.id, cantidad: 2.04, forma: 'lineal' }] }, 1, { [TRE.id]: TRE });
    expect(tubo(a).costo).toBeCloseTo(tubo(b).costo, 9);
    expect(a.costoTotal ?? a.total ?? 0).toBeCloseTo(b.costoTotal ?? b.total ?? 0, 9);
  });
  it('largo×ancho sobre un tubular queda pendiente con motivo (no es un tablero: m² × $/m no significa nada)', () => {
    expect(incompatibilidadUnidad({ largoMM: 720, anchoMM: 600 }, CAT)).toMatch(/largo de cada corte/);
    expect(incompatibilidadUnidad({ largoMM: 720, anchoMM: 600 }, TRE)).toMatch(/largo de cada corte/);
    expect(incompatibilidadUnidad({ cantidad: 2.04 }, CAT)).toBeNull();
  });
});

describe('merma D2 de política: 6.94 % en todo tubular de acero por fracción (Dirección, 14-oct)', () => {
  const PTR = { id: 'ptr', nombre: 'Tubo / PTR 1"x2" cal. 16', seccion: 'metal', precio: 38.19, unidad: 'm', formato: { tipo: 'tramo', medida: 6 }, mermaCorte: 5 };
  it('el PTR curado (ficha 5 %) se costea con 6.94 %', () => {
    const r = calcular({ componentes: [{ nombre: 'Bastidor', insumoId: 'ptr', cantidad: 6, forma: 'lineal' }] }, 1, { ptr: PTR });
    expect(r.detalleInsumos[0].costo).toBeCloseTo(6 * 1.0694 * 38.19, 6);
  });
  it('conduit, cobre, poliflex y aluminio conservan su merma (no son tubular de acero)', () => {
    for (const nombre of ['TUBO CONDUIT FLEXIBLE Ø 3/8" METALICO GALVANIZADO', 'TUBO DE COBRE Ø 1" TIPO M', 'TUBO POLIFLEX Ø 3/8"', 'Tubo de aluminio 1"']) {
      const ins = { ...PTR, id: 'x', nombre, precio: 10 };
      const r = calcular({ componentes: [{ nombre: 'Tramo', insumoId: 'x', cantidad: 6, forma: 'lineal' }] }, 1, { x: ins });
      // aluminio no es D2: tramo entero (6 m × 1.05 = 6.3 m → 2 tramos = 12 m × $10); los demás: fracción con su 5 %.
      expect(r.detalleInsumos[0].costo).toBeCloseTo(/alumin/i.test(nombre) ? 120 : 6 * 1.05 * 10, 6);
    }
  });
});
