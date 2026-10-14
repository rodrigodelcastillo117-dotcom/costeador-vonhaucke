// VH-148b · la parte PURA del fail-closed: qué es un conflicto de versión, el resultado único 409, el texto
// exacto para la persona y la orquestación del guardado de un expediente (dependencias inyectadas que
// devuelven lo mismo que nube.js; el recorrido contra el SQL real está en supabase/tests/vh148FailClosedCliente.test.js).
import { describe, it, expect } from 'vitest';
import {
  esConflictoVersion, resultadoConflictoVersion, resultadoDeErrorEscritura, mensajeEscritura, errorDeEscritura,
  revisionEsperadaPara, crearRegistroVersiones, revisionDeError, esperadoParaGuardar,
  MENSAJE_VERSION_CONFLICT, CODIGO_VERSION_CONFLICT, ESTADO_VERSION_CONFLICT,
} from './conflictoGuardado.js';
import { guardarExpedienteEditado, guardarExpedienteNuevo } from './expedienteVersionado.js';

const MENSAJE = 'Existe una versión más reciente. Recarga o compara antes de guardar.';
// Errores como los entrega PostgREST (forma { code, message, details, hint }) para cada SQLSTATE del servidor.
const E40001 = { code: '40001', message: 'CONFLICTO_VERSION: el expediente cambió en el servidor (revisión 3)', details: 'revision=3', hint: 'Recarga…' };
const E23505 = { code: '23505', message: 'duplicate key value violates unique constraint "expediente_revisiones_expediente_rev_uidx"', details: 'Key (expediente_id, rev)=(7, 2) already exists.', hint: null };
const E22004 = { code: '22004', message: 'VERSION_REQUIRED: falta p_revision_esperada', details: null, hint: null };
const E42501 = { code: '42501', message: 'permission denied for table cotizaciones', details: null, hint: null };

describe('contrato del conflicto de versión', () => {
  it('constantes: código, 409 y el texto EXACTO acordado', () => {
    expect(CODIGO_VERSION_CONFLICT).toBe('VERSION_CONFLICT');
    expect(ESTADO_VERSION_CONFLICT).toBe(409);
    expect(MENSAJE_VERSION_CONFLICT).toBe(MENSAJE);
  });
  it('PT409 (HTTP 409 de PostgREST, el código que usa el SQL) es conflicto aunque el mensaje no diga CONFLICTO', () => {
    expect(esConflictoVersion({ code: 'PT409', message: 'x' })).toBe(true);
    expect(resultadoDeErrorEscritura({ code: 'PT409', message: 'x', details: 'revision=7' })).toEqual({ ok: false, code: 'VERSION_CONFLICT', status: 409, error: MENSAJE, revisionServidor: 7 });
  });
  it('40001, 23505 y VERSION_REQUIRED son conflicto; permisos, red y "no existe" NO', () => {
    for (const e of [E40001, E23505, E22004, { message: 'CONFLICTO_VERSION: x' }, { code: 'VERSION_CONFLICT' }]) expect(esConflictoVersion(e), JSON.stringify(e)).toBe(true);
    for (const e of [E42501, new Error('fetch failed'), { code: 'P0001', message: 'expediente no existe' }, { code: '22004', message: 'null value' }, null, undefined]) expect(esConflictoVersion(e), String(e?.message)).toBe(false);
  });
  it('resultadoDeErrorEscritura: conflicto → { ok:false, code, status:409, error: texto exacto } (+ la revisión del servidor si viene)', () => {
    expect(resultadoDeErrorEscritura(E40001)).toEqual({ ok: false, code: 'VERSION_CONFLICT', status: 409, error: MENSAJE, revisionServidor: 3 });
    expect(resultadoDeErrorEscritura(E23505)).toEqual({ ok: false, code: 'VERSION_CONFLICT', status: 409, error: MENSAJE });
    expect(resultadoDeErrorEscritura(E22004)).toEqual({ ok: false, code: 'VERSION_CONFLICT', status: 409, error: MENSAJE });
    expect(resultadoDeErrorEscritura({ code: '40001', message: 'CONFLICTO_VERSION: (x)', details: 'actualizado=2026-10-14T05:20:00.123456+00:00' }))
      .toEqual({ ok: false, code: 'VERSION_CONFLICT', status: 409, error: MENSAJE, actualizadoServidor: '2026-10-14T05:20:00.123456+00:00' });
    expect(resultadoDeErrorEscritura(E42501)).toEqual({ ok: false, error: 'permission denied for table cotizaciones' });
  });
  it('resultadoConflictoVersion no deja que `extra` pise el código ni el estado', () => {
    expect(resultadoConflictoVersion({ ok: true, code: 'X', status: 200, sinVersion: true })).toEqual({ ok: false, code: 'VERSION_CONFLICT', status: 409, error: MENSAJE, sinVersion: true });
  });
  it('revisionDeError lee DETAIL revision=N (PostgREST: details; pg: detail)', () => {
    expect(revisionDeError(E40001)).toBe(3);
    expect(revisionDeError({ detail: 'revision=12' })).toBe(12);
    expect(revisionDeError({})).toBeNull();
  });
  it('mensajeEscritura: el conflicto SIEMPRE con el texto exacto; lo demás con el prefijo de la pantalla', () => {
    expect(mensajeEscritura(resultadoConflictoVersion(), 'No se pudo guardar')).toBe(MENSAJE);
    expect(mensajeEscritura(errorDeEscritura(resultadoConflictoVersion()), 'No se agregó a la cotización')).toBe(MENSAJE);
    expect(mensajeEscritura(E23505, 'No se pudo guardar')).toBe(MENSAJE);
    expect(mensajeEscritura({ ok: false, error: 'rol sin permiso' }, 'No se pudo guardar')).toBe('No se pudo guardar: rol sin permiso');
    expect(mensajeEscritura(new Error('fetch failed'), 'No se pudo costear en el servidor')).toBe('No se pudo costear en el servidor: fetch failed');
    expect(mensajeEscritura(null, 'No se pudo guardar')).toBe('No se pudo guardar.');
  });
  it('errorDeEscritura conserva código y estado para quien propaga con throw', () => {
    const e = errorDeEscritura(resultadoConflictoVersion());
    expect(e).toBeInstanceOf(Error);
    expect([e.message, e.code, e.status]).toEqual([MENSAJE, 'VERSION_CONFLICT', 409]);
    expect(errorDeEscritura({ ok: false, error: 'x' }).message).toBe('x');
    expect(errorDeEscritura(null, 'por omisión').message).toBe('por omisión');
  });
});

describe('qué versión viaja (fail-closed)', () => {
  it('cotización: bandera apagada → undefined (firma vieja); prendida sin versión → null (no se escribe); con versión → tal cual', () => {
    expect(esperadoParaGuardar('2026-10-14T05:20:00.123456+00:00', false)).toBeUndefined();
    expect(esperadoParaGuardar(null, true)).toBeNull();
    expect(esperadoParaGuardar('2026-10-14T05:20:00.123456+00:00', true)).toBe('2026-10-14T05:20:00.123456+00:00');
  });
  it('expediente/cocreación: entero positivo o null; apagada → undefined', () => {
    expect(revisionEsperadaPara(3, false)).toBeUndefined();
    expect(revisionEsperadaPara(3, true)).toBe(3);
    for (const v of [null, undefined, 0, -1, 2.5, '3']) expect(revisionEsperadaPara(v, true), String(v)).toBeNull();
  });
  it('registro de revisiones por pestaña: recuerda la última vista, por id (número o texto)', () => {
    const r = crearRegistroVersiones();
    expect(r.esperada(7)).toBeNull();
    r.recordar(7, 1); r.recordar('7', 2);
    expect(r.esperada(7)).toBe(2);
    r.recordar(8, 'basura');
    expect(r.esperada(8)).toBeNull();
    r.olvidar(7);
    expect(r.esperada(7)).toBeNull();
    expect(r.esperada(null)).toBeNull();
  });
});

describe('guardarExpedienteEditado / guardarExpedienteNuevo (orquestación, sin red)', () => {
  const exp = { nombre: 'Credenza', bom: [] };
  const snap = (id, rev) => ({ expediente_id: id, rev, nombre: exp.nombre });
  const registro = () => {
    const llamadas = [];
    const f = (nombre, r) => async (...a) => { llamadas.push([nombre, a]); return typeof r === 'function' ? r(...a) : r; };
    return { llamadas, f };
  };

  it('bandera prendida: UNA llamada a la RPC con la revisión esperada; ok → la revisión nueva', async () => {
    const { llamadas, f } = registro();
    const r = await guardarExpedienteEditado({ id: 7, exp, revActual: 3, controlOptimista: true,
      deps: { actualizarExpedienteSeguro: f('rpc', { ok: true, revision: 4 }), actualizarExpediente: f('directo', null), guardarRevisionExpediente: f('snap', null) } });
    expect(r).toEqual({ ok: true, revision: 4 });
    expect(llamadas).toEqual([['rpc', [7, exp, 3]]]);
  });
  it('bandera prendida y conflicto: { ok:false, code, status, mensaje EXACTO } y nada más se llama (sin reintento)', async () => {
    const { llamadas, f } = registro();
    const r = await guardarExpedienteEditado({ id: 7, exp, revActual: 3, controlOptimista: true,
      deps: { actualizarExpedienteSeguro: f('rpc', resultadoDeErrorEscritura(E40001)), actualizarExpediente: f('directo', null), guardarRevisionExpediente: f('snap', null) } });
    expect(r).toEqual({ ok: false, code: 'VERSION_CONFLICT', status: 409, mensaje: MENSAJE });
    expect(llamadas.map(([n]) => n)).toEqual(['rpc']);
  });
  it('bandera apagada: UPDATE directo con revActual+1 y luego el snapshot de ESA revisión', async () => {
    const { llamadas, f } = registro();
    const r = await guardarExpedienteEditado({ id: 7, exp, revActual: 3, quien: 'd@vh.mx', snap, controlOptimista: false,
      deps: { actualizarExpediente: f('directo', { ok: true }), guardarRevisionExpediente: f('snap', { ok: true }), actualizarExpedienteSeguro: f('rpc', null) } });
    expect(r).toEqual({ ok: true, revision: 4 });
    expect(llamadas).toEqual([['directo', [7, { ...exp, revision: 4, actualizado_por: 'd@vh.mx' }]], ['snap', [{ expediente_id: 7, rev: 4, nombre: 'Credenza' }]]]);
  });
  it('bandera apagada: el snapshot duplicado (23505) ya NO se reporta como "✓ Actualizado"', async () => {
    const { f } = registro();
    const r = await guardarExpedienteEditado({ id: 7, exp, revActual: 3, snap, controlOptimista: false,
      deps: { actualizarExpediente: f('directo', { ok: true }), guardarRevisionExpediente: f('snap', resultadoDeErrorEscritura(E23505)), actualizarExpedienteSeguro: f('rpc', null) } });
    expect(r).toEqual({ ok: false, code: 'VERSION_CONFLICT', status: 409, mensaje: MENSAJE });
  });
  it('bandera apagada: el UPDATE directo rechazado por el CAS del servidor (40001) no escribe el snapshot', async () => {
    const { llamadas, f } = registro();
    const r = await guardarExpedienteEditado({ id: 7, exp, revActual: 3, snap, controlOptimista: false,
      deps: { actualizarExpediente: f('directo', resultadoDeErrorEscritura(E40001)), guardarRevisionExpediente: f('snap', { ok: true }), actualizarExpedienteSeguro: f('rpc', null) } });
    expect(r.mensaje).toBe(MENSAJE);
    expect(llamadas.map(([n]) => n)).toEqual(['directo']);
  });
  it('un error que no es de versión conserva su texto con el prefijo', async () => {
    const { f } = registro();
    const r = await guardarExpedienteEditado({ id: 7, exp, revActual: 3, controlOptimista: true,
      deps: { actualizarExpedienteSeguro: f('rpc', { ok: false, error: 'rol sin permiso' }) } });
    expect(r).toEqual({ ok: false, mensaje: 'No se pudo actualizar: rol sin permiso' });
  });
  it('nuevo: si la revisión 1 falla se avisa (y se devuelve el id para no crear otro expediente)', async () => {
    const { f } = registro();
    const ok = await guardarExpedienteNuevo({ exp, snap, deps: { guardarExpediente: f('ins', { ok: true, id: 9 }), guardarRevisionExpediente: f('snap', { ok: true }) } });
    expect(ok).toEqual({ ok: true, id: 9, revision: 1 });
    const malo = await guardarExpedienteNuevo({ exp, snap, deps: { guardarExpediente: f('ins', { ok: true, id: 9 }), guardarRevisionExpediente: f('snap', resultadoDeErrorEscritura(E23505)) } });
    expect(malo).toEqual({ ok: false, code: 'VERSION_CONFLICT', status: 409, mensaje: MENSAJE, id: 9 });
  });
});
