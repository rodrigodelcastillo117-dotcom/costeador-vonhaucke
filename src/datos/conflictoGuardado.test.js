// VH-148 · la parte pura del control optimista: bandera, clasificación del error, versión opaca,
// texto del aviso, respaldo local y proyección de la fila del servidor.
import { describe, it, expect } from 'vitest';
import {
  controlOptimistaActivo, esperadoParaGuardar, esConflictoGuardado, actualizadoDeError, horaDe,
  mensajeConflicto, conflictoDesdeResultado, claveRespaldoConflicto, respaldoConflicto, aplicarFilaServidor,
  CLAVE_FLAG_LOCAL, VERSION_RESPALDO_CONFLICTO,
} from './conflictoGuardado.js';

const storageCon = (obj) => ({ getItem: (k) => (k in obj ? obj[k] : null) });
const ISO = '2026-10-13T05:20:00.123456+00:00';   // como lo manda cotizacion_segura (to_json)

describe('bandera', () => {
  it('apagada por omisión (sin env ni storage)', () => {
    expect(controlOptimistaActivo({ env: {}, storage: storageCon({}) })).toBe(false);
    expect(controlOptimistaActivo({ env: {}, storage: null })).toBe(false);
  });
  it('VITE_CONTROL_OPTIMISTA=1 la prende; cualquier otro valor no', () => {
    expect(controlOptimistaActivo({ env: { VITE_CONTROL_OPTIMISTA: '1' }, storage: storageCon({}) })).toBe(true);
    expect(controlOptimistaActivo({ env: { VITE_CONTROL_OPTIMISTA: 'true' }, storage: storageCon({}) })).toBe(false);
    expect(controlOptimistaActivo({ env: { VITE_CONTROL_OPTIMISTA: '0' }, storage: storageCon({}) })).toBe(false);
  });
  it("localStorage['vh:controlOptimista']='1' la prende en runtime (para QA y E2E con el dev server corriendo)", () => {
    expect(CLAVE_FLAG_LOCAL).toBe('vh:controlOptimista');
    expect(controlOptimistaActivo({ env: {}, storage: storageCon({ [CLAVE_FLAG_LOCAL]: '1' }) })).toBe(true);
    expect(controlOptimistaActivo({ env: {}, storage: storageCon({ [CLAVE_FLAG_LOCAL]: '0' }) })).toBe(false);
  });
  it('un storage que lanza (modo privado) no rompe: apagada', () => {
    expect(controlOptimistaActivo({ env: {}, storage: { getItem() { throw new Error('bloqueado'); } } })).toBe(false);
  });
});

describe('qué versión se manda', () => {
  it('bandera apagada → nunca se manda el parámetro (firma vieja)', () => {
    expect(esperadoParaGuardar(ISO, false)).toBeUndefined();
  });
  it('bandera prendida sin versión conocida → tampoco (degradación segura contra el servidor viejo)', () => {
    expect(esperadoParaGuardar(null, true)).toBeUndefined();
    expect(esperadoParaGuardar(undefined, true)).toBeUndefined();
    expect(esperadoParaGuardar('', true)).toBeUndefined();
    expect(esperadoParaGuardar(123, true)).toBeUndefined();
  });
  it('bandera prendida con versión → la cadena TAL CUAL (no se pasa por Date: conserva microsegundos)', () => {
    expect(esperadoParaGuardar(ISO, true)).toBe(ISO);
  });
});

describe('el error de conflicto del servidor', () => {
  const errPostgrest = { code: '40001', message: `CONFLICTO_VERSION: la cotización cambió en el servidor (${ISO}). Recarga antes de guardar.`, details: `actualizado=${ISO}`, hint: 'Vuelve a cargar…' };
  it('se reconoce por SQLSTATE 40001 o por el texto CONFLICTO', () => {
    expect(esConflictoGuardado(errPostgrest)).toBe(true);
    expect(esConflictoGuardado({ code: '40001', message: 'x' })).toBe(true);
    expect(esConflictoGuardado({ message: 'CONFLICTO_VERSION: …' })).toBe(true);
    expect(esConflictoGuardado(new Error('CONFLICTO: cambió'))).toBe(true);
  });
  it('los demás errores NO son conflicto (sin acceso, no existe, red)', () => {
    expect(esConflictoGuardado({ code: 'P0001', message: 'sin acceso' })).toBe(false);
    expect(esConflictoGuardado(new Error('cotizacion no existe'))).toBe(false);
    expect(esConflictoGuardado(new Error('fetch failed'))).toBe(false);
    expect(esConflictoGuardado(null)).toBe(false);
  });
  it('la versión del servidor sale del DETAIL tal cual; si no hay DETAIL, del paréntesis del mensaje', () => {
    expect(actualizadoDeError(errPostgrest)).toBe(ISO);
    expect(actualizadoDeError({ code: '40001', message: errPostgrest.message })).toBe(ISO);
    expect(actualizadoDeError({ code: '40001', message: 'CONFLICTO_VERSION sin fecha' })).toBeNull();
    // PGlite/pg entregan `detail`; PostgREST/supabase-js entregan `details`.
    expect(actualizadoDeError({ code: '40001', detail: `actualizado=${ISO}` })).toBe(ISO);
  });
});

describe('aviso y estado de conflicto', () => {
  it('conflictoDesdeResultado sólo para motivo "conflicto", con la versión del servidor y la hora de detección', () => {
    const c = conflictoDesdeResultado({ id: 1372, guardado: false, motivo: 'conflicto', actualizadoServidor: ISO }, { ahora: () => 'T0' });
    expect(c).toEqual({ id: 1372, actualizadoServidor: ISO, detectadoEn: 'T0' });
    expect(conflictoDesdeResultado({ id: 1372, guardado: true })).toBeNull();
    expect(conflictoDesdeResultado({ motivo: 'red' })).toBeNull();
    expect(conflictoDesdeResultado(null)).toBeNull();
  });
  it('horaDe formatea HH:MM en la zona pedida y aguanta basura', () => {
    expect(horaDe(ISO, { timeZone: 'UTC' })).toBe('05:20');
    expect(horaDe(ISO, { timeZone: 'America/Mexico_City' })).toBe('23:20');
    expect(horaDe('no-es-fecha')).toBe('');
    expect(horaDe(null)).toBe('');
  });
  it('el texto del aviso es el acordado con Dirección', () => {
    expect(mensajeConflicto({ actualizadoServidor: ISO }, { timeZone: 'UTC' }))
      .toBe('Otra persona cambió esta cotización a las 05:20. Tus cambios siguen en esta computadora.');
    expect(mensajeConflicto({ actualizadoServidor: null }))
      .toBe('Otra persona cambió esta cotización. Tus cambios siguen en esta computadora.');
  });
});

describe('respaldo local antes de "Ver la versión del servidor"', () => {
  it('la clave lleva el id de la cotización', () => {
    expect(claveRespaldoConflicto(1372)).toBe('costeador-vonhaucke-conflicto-1372');
    expect(claveRespaldoConflicto(null)).toBe('costeador-vonhaucke-conflicto-sin-id');
  });
  it('guarda la cotización local TAL CUAL (lo que la persona tenía), con versión y motivo', () => {
    const estado = { insumos: { a: 1 }, cotizacion: { id: 1372, cliente: 'Tradeco Sur', partidas: [{ id: 'p1', cantidad: 3 }], actualizado: 'viejo' } };
    const r = respaldoConflicto(estado, { actualizadoServidor: ISO }, { ahora: () => 'T1' });
    expect(r).toEqual({ version: VERSION_RESPALDO_CONFLICTO, guardadoEn: 'T1', motivo: 'conflicto-de-version', actualizadoServidor: ISO, cotizacion: estado.cotizacion });
    expect(r).not.toHaveProperty('insumos');
  });
});

describe('aplicarFilaServidor: la fila del servidor encima de lo local, misma proyección que "Abrir"', () => {
  const local = { id: 1372, cliente: 'Tradeco Sur', folio: 'F-1', partidas: [{ id: 'p1', cantidad: 3 }], acomodo: { x: 1 }, descuentoPct: 10, ivaPct: 16, fecha: '10 de octubre de 2026', claveCreacion: 'k', actualizado: 'viejo' };
  const fila = { ok: true, id: 1372, cliente: 'Tradeco Norte', folio: null, partidas: [{ id: 'p1', cantidad: 1 }], acomodo: null, totales: { descuentoPct: 5 }, actualizado: ISO };
  it('toma cliente/folio/partidas/acomodo/porcentajes del servidor y conserva lo que no viaja (fecha, clave)', () => {
    const r = aplicarFilaServidor(local, fila);
    expect(r).toMatchObject({ id: 1372, cliente: 'Tradeco Norte', folio: '', partidas: [{ id: 'p1', cantidad: 1 }], acomodo: null, descuentoPct: 5, ivaPct: 16, fecha: '10 de octubre de 2026', claveCreacion: 'k' });
  });
  it('fija `actualizado` a la versión del servidor (cadena) o null si el servidor viejo no la manda', () => {
    expect(aplicarFilaServidor(local, fila).actualizado).toBe(ISO);
    expect(aplicarFilaServidor(local, { ...fila, actualizado: undefined }).actualizado).toBeNull();
  });
  it('no muta la cotización local', () => {
    const copia = JSON.parse(JSON.stringify(local));
    aplicarFilaServidor(local, fila);
    expect(local).toEqual(copia);
  });
});
