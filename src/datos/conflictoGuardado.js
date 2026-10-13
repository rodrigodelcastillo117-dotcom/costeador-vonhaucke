// ============================================================================
//  VH-148 · CONTROL OPTIMISTA DEL GUARDADO — la parte PURA (sin React, sin red).
//
//  Defecto (2026-10-13, cotización 1372): dos pestañas sobre la misma cotización se pisaban en
//  silencio (autosave cada 1.5 s, el servidor escribía lo último que llegaba). Decisión de Dirección:
//  la segunda edición debe DETECTAR el conflicto, CONSERVAR lo local y ofrecer recuperación explícita.
//  Nada de fusionar BOM/costos/acomodos a ciegas: la persona decide.
//
//  Contrato con el servidor (PROPUESTA_vh148_control_optimista_cotizacion.sql):
//   · `cotizacion_segura` devuelve `actualizado` (ISO con zona, microsegundos).
//   · `actualizar_cotizacion_segura(p_cotizacion_id, p_patch, p_actualizado_esperado)`: si la fila ya
//     no es esa versión → error SQLSTATE 40001, mensaje 'CONFLICTO_VERSION: ... (<ISO>)', DETAIL
//     'actualizado=<ISO>'. Nada se escribe.
//
//  ⚠️ La versión se trata como CADENA OPACA: se devuelve TAL CUAL al servidor. Pasarla por `new Date()`
//  perdería los microsegundos y provocaría conflictos falsos (Postgres compara al microsegundo).
//
//  BANDERA (producción sigue con la RPC de dos argumentos hasta que Dirección despliegue el SQL):
//   · build: VITE_CONTROL_OPTIMISTA=1
//   · runtime (QA / E2E con el dev server ya corriendo): localStorage['vh:controlOptimista'] = '1'
//  Con la bandera apagada el cliente NUNCA manda p_actualizado_esperado (= comportamiento actual).
//  Con la bandera prendida sólo lo manda cuando CONOCE la versión; si el servidor viejo no la devuelve,
//  la app sigue funcionando sin control (degradación segura, sin errores de "función no existe").
// ============================================================================

export const CLAVE_FLAG_LOCAL = 'vh:controlOptimista';
export const PREFIJO_RESPALDO_CONFLICTO = 'costeador-vonhaucke-conflicto-';
export const VERSION_RESPALDO_CONFLICTO = 'conflicto-vh-1';

/** ¿Está prendido el control optimista? Fuentes inyectables para pruebas. */
export function controlOptimistaActivo({ env, storage } = {}) {
  try {
    const e = env !== undefined ? env : (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {});
    if (e && String(e.VITE_CONTROL_OPTIMISTA) === '1') return true;
  } catch { /* sin env */ }
  try {
    const s = storage !== undefined ? storage : (typeof localStorage !== 'undefined' ? localStorage : null);
    return !!s && s.getItem(CLAVE_FLAG_LOCAL) === '1';
  } catch {
    return false;
  }
}

/**
 * La versión que se manda al servidor en este intento, o `undefined` para NO mandar el parámetro.
 *  - bandera apagada → undefined (firma vieja, siempre).
 *  - bandera prendida pero no se conoce la versión (servidor viejo, cotización recién creada
 *    por un cliente sin `actualizado`) → undefined (degradación segura).
 *  - si no, la cadena tal cual.
 */
export function esperadoParaGuardar(actualizadoConocido, activo) {
  if (!activo) return undefined;
  if (typeof actualizadoConocido !== 'string' || !actualizadoConocido.trim()) return undefined;
  return actualizadoConocido;
}

/** ¿Este error del servidor es el conflicto de versión (40001 / CONFLICTO_VERSION)? */
export function esConflictoGuardado(e) {
  if (!e) return false;
  const code = String(e.code ?? e.error?.code ?? '');
  if (code === '40001') return true;
  const m = String(e.message || e.error?.message || e || '');
  return /CONFLICTO_VERSION|CONFLICTO/i.test(m);
}

const ISO_RE = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;

/**
 * El `actualizado` del servidor que viaja en el error de conflicto, TAL CUAL (cadena).
 * Primero el DETAIL ('actualizado=<ISO>'), después el paréntesis del mensaje. null si no viene.
 */
export function actualizadoDeError(e) {
  if (!e) return null;
  const det = String(e.details ?? e.detail ?? e.error?.details ?? '');
  const md = /actualizado=(\S+)/.exec(det);
  if (md) return md[1];
  const msg = String(e.message || e.error?.message || '');
  const mm = ISO_RE.exec(msg);
  return mm ? mm[0] : null;
}

/** "HH:MM" local de una versión ISO, para el aviso. `''` si no se puede leer. */
export function horaDe(iso, { locale = 'es-MX', timeZone } = {}) {
  const t = Date.parse(String(iso || ''));
  if (Number.isNaN(t)) return '';
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, ...(timeZone ? { timeZone } : {}) }).format(new Date(t));
  } catch {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/** El texto del aviso, una sola verdad para la UI y las pruebas. */
export function mensajeConflicto(conflicto, opts) {
  const hora = horaDe(conflicto?.actualizadoServidor, opts);
  return `Otra persona cambió esta cotización${hora ? ` a las ${hora}` : ''}. Tus cambios siguen en esta computadora.`;
}

/** Estado de conflicto que guarda la app mientras la persona decide. */
export function conflictoDesdeResultado(r, { ahora = () => new Date().toISOString() } = {}) {
  if (!r || r.motivo !== 'conflicto') return null;
  return {
    id: r.id ?? null,
    actualizadoServidor: r.actualizadoServidor ?? null,
    detectadoEn: ahora(),
  };
}

/** Clave de localStorage del respaldo local de la cotización en conflicto. */
export function claveRespaldoConflicto(id) {
  return `${PREFIJO_RESPALDO_CONFLICTO}${id ?? 'sin-id'}`;
}

/** Lo que se guarda en esa clave antes de cargar la versión del servidor: la cotización local tal cual. */
export function respaldoConflicto(estado, conflicto, { ahora = () => new Date().toISOString() } = {}) {
  return {
    version: VERSION_RESPALDO_CONFLICTO,
    guardadoEn: ahora(),
    motivo: 'conflicto-de-version',
    actualizadoServidor: conflicto?.actualizadoServidor ?? null,
    cotizacion: estado?.cotizacion || {},
  };
}

/**
 * La cotización local con la FILA del servidor encima (misma proyección que "Abrir" del Archivo),
 * más la versión `actualizado` para el siguiente guardado. Pura: no toca estado.
 */
export function aplicarFilaServidor(cotizacionLocal, fila) {
  const cot = cotizacionLocal || {};
  const t = fila?.totales || {};
  return {
    ...cot,
    id: fila?.id ?? cot.id ?? null,
    cliente: fila?.cliente || '',
    folio: fila?.folio || '',
    partidas: Array.isArray(fila?.partidas) ? fila.partidas : [],
    acomodo: fila?.acomodo || null,
    descuentoPct: t.descuentoPct ?? cot.descuentoPct,
    contingenciaPct: t.contingenciaPct ?? cot.contingenciaPct,
    maniobrasPct: t.maniobrasPct ?? cot.maniobrasPct,
    fletePct: t.fletePct ?? cot.fletePct,
    ivaPct: t.ivaPct ?? cot.ivaPct,
    anticipoPct: t.anticipoPct ?? cot.anticipoPct,
    actualizado: typeof fila?.actualizado === 'string' ? fila.actualizado : null,
  };
}
