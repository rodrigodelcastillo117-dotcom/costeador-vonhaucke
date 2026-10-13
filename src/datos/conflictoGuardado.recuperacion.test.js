// VH-148 (segunda vuelta) · recuperación explícita del respaldo de conflicto: fusión de tres vías por
// campo, resumen de diferencias, textos de confirmación y ciclo de vida del respaldo en localStorage
// (pila, descartar sólo con confirmación, retirar sólo tras guardado confirmado).
import { describe, it, expect } from 'vitest';
import {
  CAMPOS_MEZCLA, camposMezcla, mismoValor, mezclarRespaldo, textoMezcla, confirmacionRecuperar, confirmacionDescartar,
  resumenDiferencias, leerRespaldoConflicto, guardarRespaldoConflicto, apilarRespaldo, siguienteRespaldo,
  descartarRespaldoConflicto, retirarRespaldoRecuperado, respaldoConflicto, claveRespaldoConflicto, VERSION_RESPALDO_CONFLICTO,
} from './conflictoGuardado.js';

const ISO = '2026-10-13T05:20:00.123456+00:00';
const P1 = { id: 'p1', nombre: 'Banca APP LT', cantidad: 1, precioUnitario: 48000 };
const P2 = { id: 'p2', nombre: 'Mesa Río', cantidad: 2, precioUnitario: 10000 };
const BASE = { cliente: 'Tradeco', folio: '', partidas: [P1], acomodo: null, descuentoPct: 0, ivaPct: 16 };

function storageMem(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    has: (k) => m.has(k),
    size: () => m.size,
  };
}

describe('camposMezcla / mismoValor', () => {
  it('sólo los campos que viajan, normalizados (null y "" de texto son lo mismo)', () => {
    const c = camposMezcla({ id: 9, cliente: null, folio: undefined, partidas: undefined, fecha: 'x', claveCreacion: 'k', actualizado: ISO });
    expect(Object.keys(c)).toEqual(CAMPOS_MEZCLA);
    expect(c).toMatchObject({ cliente: '', folio: '', partidas: [], acomodo: null, descuentoPct: null });
    expect(camposMezcla(null).partidas).toEqual([]);
  });
  it('el orden de llaves y los undefined no son "un cambio"; un valor distinto sí', () => {
    expect(mismoValor({ a: 1, b: { c: 2, d: undefined } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(mismoValor([{ id: 'p1', cantidad: 1 }], [{ cantidad: 1, id: 'p1' }])).toBe(true);
    expect(mismoValor([{ id: 'p1', cantidad: 1 }], [{ id: 'p1', cantidad: 3 }])).toBe(false);
    expect(mismoValor(null, undefined)).toBe(true);
  });
});

describe('mezclarRespaldo: tres vías por campo de primer nivel', () => {
  it('B cambió el folio, A cambió el cliente → se aplica el folio de B y se queda el cliente de A, sin choque', () => {
    const local = { ...BASE, folio: 'F-B' };
    const servidor = { ...BASE, cliente: 'Tradeco Norte' };
    const m = mezclarRespaldo({ base: BASE, local, servidor });
    expect(m.baseConocida).toBe(true);
    expect(m.aplicados).toEqual(['folio']);
    expect(m.conservados).toEqual(['cliente']);
    expect(m.choques).toEqual([]);
    expect(m.cotizacion).toMatchObject({ cliente: 'Tradeco Norte', folio: 'F-B', partidas: [P1] });
    expect(confirmacionRecuperar(m)).toBeNull();   // no se reemplaza nada ajeno: no hace falta confirmar
  });
  it('los dos cambiaron el mismo campo → CHOQUE: se aplicaría lo local y se exige confirmación', () => {
    const m = mezclarRespaldo({ base: BASE, local: { ...BASE, cliente: 'Tradeco Sur' }, servidor: { ...BASE, cliente: 'Tradeco Norte' } });
    expect(m.aplicados).toEqual(['cliente']);
    expect(m.choques).toEqual(['cliente']);
    expect(m.cotizacion.cliente).toBe('Tradeco Sur');
    expect(confirmacionRecuperar(m)).toMatch(/La otra persona también cambió: Cliente\./);
    expect(confirmacionRecuperar(m)).toMatch(/TU versión de esos campos reemplazará la del servidor/);
  });
  it('partidas son UNA unidad: B agrega un renglón y A cambia una cantidad → choque en Partidas (no se mezclan renglones)', () => {
    const local = { ...BASE, partidas: [P1, P2] };
    const servidor = { ...BASE, partidas: [{ ...P1, cantidad: 3 }] };
    const m = mezclarRespaldo({ base: BASE, local, servidor });
    expect(m.choques).toEqual(['partidas']);
    expect(m.cotizacion.partidas).toEqual([P1, P2]);   // la versión completa de B, no una mezcla
  });
  it('lo que los dos dejaron igual o cambiaron al mismo valor no cuenta', () => {
    const m = mezclarRespaldo({ base: BASE, local: { ...BASE, folio: 'F-1' }, servidor: { ...BASE, folio: 'F-1' } });
    expect(m).toMatchObject({ aplicados: [], conservados: [], choques: [] });
    expect(textoMezcla(m)[0]).toMatch(/ya coincide con la versión del servidor/);
  });
  it('sin base conocida → todo campo distinto es choque (documento completo para esos campos) y se confirma', () => {
    const m = mezclarRespaldo({ base: null, local: { ...BASE, folio: 'F-B' }, servidor: { ...BASE, cliente: 'Tradeco Norte' } });
    expect(m.baseConocida).toBe(false);
    expect(m.aplicados.sort()).toEqual(['cliente', 'folio']);
    expect(m.choques.sort()).toEqual(['cliente', 'folio']);
    expect(m.cotizacion).toMatchObject({ cliente: 'Tradeco', folio: 'F-B' });
    expect(confirmacionRecuperar(m)).toMatch(/El servidor tiene otra versión de/);
    expect(textoMezcla(m).join(' ')).toMatch(/No se sabe desde qué versión editabas/);
  });
  it('no muta ninguna de las tres versiones', () => {
    const local = { ...BASE, folio: 'F-B', partidas: [P1, P2] }; const servidor = { ...BASE, cliente: 'X' };
    const copias = JSON.stringify([BASE, local, servidor]);
    mezclarRespaldo({ base: BASE, local, servidor });
    expect(JSON.stringify([BASE, local, servidor])).toBe(copias);
  });
  it('normalizar: un % vacío local ("el de parámetros") y el efectivo del servidor no son un cambio fantasma', () => {
    const efectivo = (c) => ({ ...c, ivaPct: c.ivaPct ?? 16 });
    const base = { ...BASE, ivaPct: undefined };
    const local = { ...base, folio: 'F-B' };
    const servidor = { ...BASE, cliente: 'Norte', ivaPct: 16 };
    expect(mezclarRespaldo({ base, local, servidor }).conservados).toEqual(['cliente', 'ivaPct']);   // sin normalizar: ruido
    const m = mezclarRespaldo({ base, local, servidor, normalizar: efectivo });
    expect(m).toMatchObject({ aplicados: ['folio'], conservados: ['cliente'], choques: [] });
    expect(resumenDiferencias(local, servidor, { normalizar: efectivo }).map((f) => f.campo)).toEqual(['cliente', 'folio', 'partidas']);
  });
  it('textoMezcla dice qué se aplica, qué se queda y qué choca', () => {
    const m = mezclarRespaldo({ base: BASE, local: { ...BASE, folio: 'F-B', ivaPct: 8 }, servidor: { ...BASE, cliente: 'Norte', ivaPct: 0 } });
    expect(textoMezcla(m)).toEqual([
      'Se aplicarán tus cambios en: Folio, IVA %.',
      'Se queda lo de la otra persona en: Cliente.',
      'Los dos cambiaron IVA %: tu versión REEMPLAZARÁ la de la otra persona (se pide confirmación).',
    ]);
  });
});

describe('resumenDiferencias: lo que ve la persona para decidir', () => {
  const totalDe = (c) => (c.partidas || []).reduce((a, p) => a + p.cantidad * p.precioUnitario, 0);
  it('siempre Cliente, Partidas y Total; Folio/Acomodo/% sólo si difieren', () => {
    const filas = resumenDiferencias({ ...BASE, folio: 'F-B', partidas: [P1, P2] }, { ...BASE, cliente: 'Tradeco Norte' }, { totalDe });
    expect(filas.map((f) => f.campo)).toEqual(['cliente', 'folio', 'partidas', 'total']);
    expect(filas[0]).toMatchObject({ respaldo: 'Tradeco', servidor: 'Tradeco Norte', distinto: true });
    expect(filas[1]).toMatchObject({ respaldo: 'F-B', servidor: '(sin folio)', distinto: true });
    expect(filas[2]).toMatchObject({ respaldo: '2 partidas · 3 pzas', servidor: '1 partida · 1 pzas', distinto: true });
    expect(filas[3].distinto).toBe(true);
    expect(filas[3].respaldo).toMatch(/68,000/);
    expect(filas[3].servidor).toMatch(/48,000/);
  });
  it('sin totalDe no hay fila de total; iguales → distinto:false', () => {
    const filas = resumenDiferencias(BASE, BASE);
    expect(filas.map((f) => f.campo)).toEqual(['cliente', 'partidas']);
    expect(filas.every((f) => !f.distinto)).toBe(true);
  });
  it('acomodo y porcentajes aparecen cuando cambian', () => {
    const filas = resumenDiferencias({ ...BASE, acomodo: { plan: 1 }, descuentoPct: 5 }, BASE);
    expect(filas.map((f) => f.campo)).toEqual(['cliente', 'partidas', 'acomodo', 'descuentoPct']);
    expect(filas[2]).toMatchObject({ respaldo: 'con acomodo', servidor: 'sin acomodo' });
    expect(filas[3]).toMatchObject({ respaldo: '5%', servidor: '0%' });
  });
  it('un totalDe que lanza no rompe el resumen', () => {
    const filas = resumenDiferencias(BASE, BASE, { totalDe: () => { throw new Error('x'); } });
    expect(filas.find((f) => f.campo === 'total')).toMatchObject({ respaldo: '—', servidor: '—', distinto: false });
  });
});

describe('ciclo de vida del respaldo (localStorage)', () => {
  const resp = (cliente, t) => respaldoConflicto({ cotizacion: { id: 7, cliente } }, { actualizadoServidor: ISO }, { ahora: () => t, base: BASE });
  it('respaldoConflicto guarda la base (sólo campos comparables) cuando se conoce', () => {
    const r = resp('Sur', 'T1');
    expect(r.base).toEqual(camposMezcla(BASE));
    expect(respaldoConflicto({ cotizacion: {} }, null, { ahora: () => 'T' })).not.toHaveProperty('base');
  });
  it('leer: null sin clave, con JSON roto, con versión desconocida o con storage que lanza', () => {
    const k = claveRespaldoConflicto(7);
    expect(leerRespaldoConflicto(storageMem(), 7)).toBeNull();
    expect(leerRespaldoConflicto(storageMem({ [k]: '{roto' }), 7)).toBeNull();
    expect(leerRespaldoConflicto(storageMem({ [k]: JSON.stringify({ version: 'otra', cotizacion: {} }) }), 7)).toBeNull();
    expect(leerRespaldoConflicto({ getItem() { throw new Error('bloqueado'); } }, 7)).toBeNull();
    expect(leerRespaldoConflicto(storageMem(), null)).toBeNull();
    const s = storageMem({ [k]: JSON.stringify(resp('Sur', 'T1')) });
    expect(leerRespaldoConflicto(s, 7)).toMatchObject({ version: VERSION_RESPALDO_CONFLICTO, cotizacion: { cliente: 'Sur' } });
  });
  it('un segundo conflicto NO pisa el respaldo anterior: se apila; resolver el de arriba deja ver el siguiente', () => {
    const s = storageMem();
    expect(guardarRespaldoConflicto(s, 7, resp('Uno', 'T1'))).toBe(true);
    expect(guardarRespaldoConflicto(s, 7, resp('Dos', 'T2'))).toBe(true);
    const r = leerRespaldoConflicto(s, 7);
    expect(r.cotizacion.cliente).toBe('Dos');
    expect(r.anteriores.map((a) => a.cotizacion.cliente)).toEqual(['Uno']);
    expect(retirarRespaldoRecuperado(s, 7, { guardado: true })).toBe(true);
    expect(leerRespaldoConflicto(s, 7)).toMatchObject({ cotizacion: { cliente: 'Uno' } });
    expect(leerRespaldoConflicto(s, 7)).not.toHaveProperty('anteriores');
    expect(retirarRespaldoRecuperado(s, 7, { guardado: true })).toBe(true);
    expect(s.has(claveRespaldoConflicto(7))).toBe(false);
  });
  it('apilar/siguiente son puros y conservan el orden (más nuevo primero)', () => {
    const a = { cotizacion: { cliente: 'A' } }, b = { cotizacion: { cliente: 'B' } }, c = { cotizacion: { cliente: 'C' } };
    const pila = apilarRespaldo(apilarRespaldo(apilarRespaldo(null, a), b), c);
    expect(pila.anteriores.map((x) => x.cotizacion.cliente)).toEqual(['B', 'A']);
    expect(siguienteRespaldo(pila)).toEqual({ ...b, anteriores: [a] });
    expect(siguienteRespaldo(siguienteRespaldo(pila))).toEqual(a);
    expect(siguienteRespaldo(a)).toBeNull();
  });
  it('descartar SÓLO con confirmación: sin función, con "no" o con algo que no es true, la clave se queda', () => {
    const k = claveRespaldoConflicto(7);
    const s = storageMem({ [k]: JSON.stringify(resp('Sur', 'T1')) });
    expect(descartarRespaldoConflicto(s, 7)).toBe(false);
    expect(descartarRespaldoConflicto(s, 7, () => false)).toBe(false);
    expect(descartarRespaldoConflicto(s, 7, () => 'sí')).toBe(false);
    expect(s.has(k)).toBe(true);
    let visto = null;
    expect(descartarRespaldoConflicto(s, 7, (r) => { visto = r; return true; })).toBe(true);
    expect(visto.cotizacion.cliente).toBe('Sur');   // el confirm ve qué respaldo se va
    expect(s.has(k)).toBe(false);
    expect(descartarRespaldoConflicto(s, 7, () => true)).toBe(false);   // ya no hay nada que descartar
  });
  it('tras recuperar, el respaldo se retira SÓLO si el servidor confirmó el guardado', () => {
    const k = claveRespaldoConflicto(7);
    const s = storageMem({ [k]: JSON.stringify(resp('Sur', 'T1')) });
    for (const r of [null, { guardado: false, motivo: 'conflicto' }, { guardado: false, motivo: 'red' }, { motivo: 'epoca' }]) {
      expect(retirarRespaldoRecuperado(s, 7, r)).toBe(false);
      expect(s.has(k)).toBe(true);
    }
    expect(retirarRespaldoRecuperado(s, 7, { id: 7, guardado: true })).toBe(true);
    expect(s.has(k)).toBe(false);
  });
  it('un storage que lanza al escribir no rompe: false', () => {
    const malo = { getItem: () => null, setItem() { throw new Error('cuota'); }, removeItem() { throw new Error('x'); } };
    expect(guardarRespaldoConflicto(malo, 7, resp('Sur', 'T1'))).toBe(false);
    expect(guardarRespaldoConflicto(null, 7, resp('Sur', 'T1'))).toBe(false);
  });
  it('el texto de descartar avisa que no se puede deshacer y que el servidor no cambia', () => {
    const t = confirmacionDescartar({ guardadoEn: ISO }, { timeZone: 'UTC' });
    expect(t).toMatch(/^¿Descartar tu respaldo de las 05:20\?/);
    expect(t).toMatch(/NO se puede recuperar\. La versión del servidor no cambia\./);
    expect(confirmacionDescartar({})).toMatch(/^¿Descartar tu respaldo\?/);
  });
});
