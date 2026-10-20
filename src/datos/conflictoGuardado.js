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
 * La versión que se manda al servidor en este intento.
 *  - bandera apagada → undefined: NO se manda el parámetro (firma vieja; el servidor de producción sin VH-148).
 *  - bandera prendida con versión conocida → la cadena TAL CUAL.
 *  - bandera prendida SIN versión conocida → null (VH-148b · fail-closed): "hace falta versión y no la tengo".
 *    guardarCotizacion NO escribe a ciegas con null: lo trata como conflicto (la persona recarga o compara).
 *    Antes devolvía undefined y el guardado caía en la firma de dos argumentos, sin control (hueco H1 cliente).
 */
export function esperadoParaGuardar(actualizadoConocido, activo) {
  if (!activo) return undefined;
  if (typeof actualizadoConocido !== 'string' || !actualizadoConocido.trim()) return null;
  return actualizadoConocido;
}

// ============================================================================
//  VH-148b · RESULTADO ÚNICO DE "VERSIÓN EN CONFLICTO" para TODAS las escrituras versionadas
//  (cotizaciones, expedientes y sus revisiones, cocreaciones). El servidor lo señala con:
//   · SQLSTATE PT409 'CONFLICTO_VERSION' (otra persona guardó antes; HTTP 409 en PostgREST),
//   · SQLSTATE 23505 (el número de revisión ya existe: índice único expediente_id, rev),
//   · SQLSTATE 22004 'VERSION_REQUIRED' (se pidió escribir sin decir desde qué versión).
//  El cliente lo convierte SIEMPRE en { ok:false, code:'VERSION_CONFLICT', status:409 } y la UI muestra
//  EXACTAMENTE MENSAJE_VERSION_CONFLICT. Sin reintento silencioso ni fusión automática.
// ============================================================================
export const CODIGO_VERSION_CONFLICT = 'VERSION_CONFLICT';
export const ESTADO_VERSION_CONFLICT = 409;
export const MENSAJE_VERSION_CONFLICT = 'Existe una versión más reciente. Recarga o compara antes de guardar.';

/** ¿Este error del servidor (PostgREST / pg) es un conflicto de versión? */
export function esConflictoVersion(e) {
  if (!e) return false;
  if (e.code === CODIGO_VERSION_CONFLICT) return true;
  const code = String(e.code ?? e.error?.code ?? '');
  // PT409: el servidor responde HTTP 409 (PostgREST). 40001 se acepta por compatibilidad: PostgREST lo REINTENTA y
  // no debe usarse en el SQL (docs/auditoria/VH148_DOS_CONEXIONES_20261014.md).
  if (code === 'PT409' || code === '40001' || code === '23505') return true;
  const m = String(e.message || e.error?.message || e || '');
  return /VERSION_REQUIRED|CONFLICTO_VERSION/.test(m);
}

/** El resultado de una escritura rechazada por versión. `extra` se agrega (p. ej. la versión del servidor). */
export function resultadoConflictoVersion(extra = {}) {
  return { ...extra, ok: false, code: CODIGO_VERSION_CONFLICT, status: ESTADO_VERSION_CONFLICT, error: MENSAJE_VERSION_CONFLICT };
}

/** La revisión del servidor que viaja en el DETAIL ('revision=N') de un 40001 de expedientes, o null. */
export function revisionDeError(e) {
  const det = String(e?.details ?? e?.detail ?? '');
  const m = /revision=(\d+)/.exec(det);
  return m ? Number(m[1]) : null;
}

/** Convierte `{ error }` de PostgREST en el resultado de la escritura: conflicto (409) u otro error. */
export function resultadoDeErrorEscritura(error) {
  if (esConflictoVersion(error)) {
    const revisionServidor = revisionDeError(error);
    const actualizadoServidor = actualizadoDeError(error);
    return resultadoConflictoVersion({ ...(revisionServidor != null ? { revisionServidor } : {}), ...(actualizadoServidor ? { actualizadoServidor } : {}) });
  }
  return { ok: false, error: String(error?.message || error || 'error desconocido') };
}

/**
 * Texto para la persona tras una escritura fallida: el conflicto de versión SIEMPRE con el texto exacto;
 * cualquier otro error con el prefijo de la pantalla. Acepta un resultado `{ code, error }` o un Error.
 */
export function mensajeEscritura(r, prefijo = 'No se pudo guardar') {
  if (r?.code === CODIGO_VERSION_CONFLICT || esConflictoVersion(r)) return MENSAJE_VERSION_CONFLICT;
  const det = String(r?.error || r?.message || r || '').trim();
  return det ? `${prefijo}: ${det}` : `${prefijo}.`;
}

/** Un Error que conserva el código del resultado (para los flujos que propagan con throw). */
export function errorDeEscritura(r, porOmision = 'No se pudo guardar') {
  const e = new Error(r?.code === CODIGO_VERSION_CONFLICT ? MENSAJE_VERSION_CONFLICT : (r?.error || porOmision));
  if (r?.code) e.code = r.code;
  if (r?.status) e.status = r.status;
  return e;
}

/**
 * Revisión entera que se manda como p_revision_esperada: undefined con la bandera apagada (firma vieja);
 * null si está prendida y no se conoce (fail-closed: no se escribe); el entero si se conoce.
 */
export function revisionEsperadaPara(revisionConocida, activo) {
  if (!activo) return undefined;
  return Number.isInteger(revisionConocida) && revisionConocida > 0 ? revisionConocida : null;
}

/** Registro (por pestaña) de la última revisión vista de cada expediente/cocreación. Puro, sin red. */
export function crearRegistroVersiones() {
  const m = new Map();
  return {
    recordar(id, revision) { if (id != null && Number.isInteger(Number(revision))) m.set(String(id), Number(revision)); },
    esperada(id) { return id == null ? null : (m.has(String(id)) ? m.get(String(id)) : null); },
    olvidar(id) { m.delete(String(id)); },
  };
}

/** ¿Este error del guardado de la cotización es un conflicto de versión? (40001 / 23505 / VERSION_REQUIRED / CONFLICTO_VERSION) */
export function esConflictoGuardado(e) {
  if (esConflictoVersion(e)) return true;
  // Compatibilidad VH-148: cualquier mensaje con "CONFLICTO" del guardado de la cotización.
  return !!e && /CONFLICTO/i.test(String(e.message || e.error?.message || e || ''));
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

/** El texto del aviso, una sola verdad para la UI y las pruebas (VH-148b: EXACTAMENTE el acordado). */
export function mensajeConflicto() {
  return MENSAJE_VERSION_CONFLICT;
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

/**
 * Lo que se guarda en esa clave antes de cargar la versión del servidor: la cotización local tal cual.
 * `base` (opcional): lo que esta pestaña sabía del servidor cuando empezó a editar; con ella la
 * recuperación sabe QUÉ campos cambió la persona (fusión de tres vías, ver CAMPOS_MEZCLA).
 */
export function respaldoConflicto(estado, conflicto, { ahora = () => new Date().toISOString(), base = null } = {}) {
  return {
    version: VERSION_RESPALDO_CONFLICTO,
    guardadoEn: ahora(),
    motivo: 'conflicto-de-version',
    actualizadoServidor: conflicto?.actualizadoServidor ?? null,
    cotizacion: estado?.cotizacion || {},
    ...(base ? { base: camposMezcla(base) } : {}),
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

// ============================================================================
//  VH-148 (segunda vuelta) · RECUPERACIÓN EXPLÍCITA DEL RESPALDO Y REAPERTURA.
//
//  Auditoría de Dirección: "Ante conflicto, conserva ambas versiones y exige resolución explícita."
//  Tras "Ver la versión del servidor" quedan DOS versiones: la del servidor (en pantalla) y la local
//  (respaldo `costeador-vonhaucke-conflicto-<id>`). Ninguna se borra sola. La persona decide:
//   · "Recuperar mis cambios": el respaldo se aplica como una edición NUEVA encima de la versión
//     ACTUAL del servidor (se relee la fila y se guarda con SU `actualizado`: nunca a ciegas).
//   · "Descartar mi respaldo": pide confirmación; sólo entonces se borra la clave.
//
//  SEMÁNTICA DE LA MEZCLA (la que se implementa, sin adivinar dentro de los campos):
//   Fusión de TRES VÍAS POR CAMPO DE PRIMER NIVEL de la cotización (CAMPOS_MEZCLA), con
//     base     = lo que esta pestaña sabía del servidor cuando empezó a editar (abrir / último guardado),
//     local    = el respaldo (lo que la persona tenía escrito),
//     servidor = la fila ACTUAL del servidor, releída al pulsar "Recuperar".
//   Por campo:
//     · local = servidor                  → nada que hacer.
//     · local ≠ base, servidor = base     → se aplica lo local      (sólo tú lo cambiaste).
//     · local = base, servidor ≠ base     → se queda lo del servidor (sólo la otra persona lo cambió).
//     · local ≠ base, servidor ≠ base     → CHOQUE: los dos lo cambiaron; se aplicaría lo local y eso
//                                           REEMPLAZA lo de la otra persona → exige confirmación.
//     · sin base conocida (p. ej. se recargó la página antes del conflicto) → todo campo distinto se
//       trata como choque: recuperación de DOCUMENTO COMPLETO para esos campos, con confirmación.
//   `partidas` y `acomodo` son UNA unidad cada uno (no se mezclan renglones de BOM/costos/acomodos:
//   decisión de Dirección). Si los dos tocaron las partidas, gana la versión completa que confirme
//   la persona, nunca una mezcla renglón por renglón.
// ============================================================================

/** Campos de primer nivel que viajan con la cotización y que la recuperación compara. */
export const CAMPOS_MEZCLA = ['cliente', 'folio', 'partidas', 'acomodo', 'descuentoPct', 'contingenciaPct', 'maniobrasPct', 'fletePct', 'ivaPct', 'anticipoPct'];

export const ETIQUETAS_CAMPO = {
  cliente: 'Cliente', folio: 'Folio', partidas: 'Partidas', acomodo: 'Acomodo',
  descuentoPct: 'Descuento %', contingenciaPct: 'Contingencia %', maniobrasPct: 'Maniobras %',
  fletePct: 'Flete %', ivaPct: 'IVA %', anticipoPct: 'Anticipo %',
};

/** Sólo los campos comparables, normalizados (null/'' de texto son lo mismo; sin partidas = []). */
export function camposMezcla(cot) {
  const c = cot || {};
  return {
    cliente: c.cliente || '',
    folio: c.folio || '',
    partidas: Array.isArray(c.partidas) ? c.partidas : [],
    acomodo: c.acomodo ?? null,
    descuentoPct: c.descuentoPct ?? null,
    contingenciaPct: c.contingenciaPct ?? null,
    maniobrasPct: c.maniobrasPct ?? null,
    fletePct: c.fletePct ?? null,
    ivaPct: c.ivaPct ?? null,
    anticipoPct: c.anticipoPct ?? null,
  };
}

// JSON canónico (llaves ordenadas, sin undefined): el orden de llaves de la nube no es "un cambio".
function canon(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}
export function mismoValor(a, b) { return canon(a) === canon(b); }

/**
 * Fusión de tres vías por campo (ver arriba). `base` puede ser null (desconocida).
 * `normalizar` (opcional, cot → cot): lleva las tres versiones a la misma representación antes de
 * comparar. La app lo usa para los porcentajes: localmente `ivaPct` puede venir vacío ("usa el de
 * parámetros") y el servidor guarda el EFECTIVO (16); sin normalizar serían "cambios" fantasma.
 * Devuelve { cotizacion (sólo CAMPOS_MEZCLA), aplicados, conservados, choques, baseConocida }.
 * Pura: no muta nada.
 */
export function mezclarRespaldo({ base, local, servidor, normalizar = (c) => c }) {
  const b = base ? camposMezcla(normalizar(base)) : null;
  const l = camposMezcla(normalizar(local));
  const s = camposMezcla(normalizar(servidor));
  const cotizacion = {}; const aplicados = []; const conservados = []; const choques = [];
  for (const k of CAMPOS_MEZCLA) {
    if (mismoValor(l[k], s[k])) { cotizacion[k] = s[k]; continue; }
    if (!b) { cotizacion[k] = l[k]; aplicados.push(k); choques.push(k); continue; }
    const editoLocal = !mismoValor(l[k], b[k]);
    const editoServidor = !mismoValor(s[k], b[k]);
    if (editoLocal) {
      cotizacion[k] = l[k]; aplicados.push(k);
      if (editoServidor) choques.push(k);
    } else {
      cotizacion[k] = s[k]; conservados.push(k);
    }
  }
  return { cotizacion, aplicados, conservados, choques, baseConocida: !!b };
}

const lista = (campos) => campos.map((k) => ETIQUETAS_CAMPO[k] || k).join(', ');

/** Frases para la UI: qué hará "Recuperar mis cambios" con esta mezcla. */
export function textoMezcla(m) {
  if (!m) return [];
  const out = [];
  if (!m.aplicados.length) out.push('Tu respaldo ya coincide con la versión del servidor: no hay nada que recuperar.');
  else out.push(`Se aplicarán tus cambios en: ${lista(m.aplicados)}.`);
  if (m.conservados.length) out.push(`Se queda lo de la otra persona en: ${lista(m.conservados)}.`);
  if (m.choques.length) {
    out.push(m.baseConocida
      ? `Los dos cambiaron ${lista(m.choques)}: tu versión REEMPLAZARÁ la de la otra persona (se pide confirmación).`
      : `No se sabe desde qué versión editabas: en ${lista(m.choques)} tu versión REEMPLAZARÁ la del servidor (se pide confirmación).`);
  }
  return out;
}

/** El texto del confirm() antes de recuperar, o null si no hay choque (no se reemplaza nada ajeno). */
export function confirmacionRecuperar(m) {
  if (!m || !m.choques.length) return null;
  return `${m.baseConocida ? 'La otra persona también cambió' : 'El servidor tiene otra versión de'}: ${lista(m.choques)}.\n\n`
    + 'Si recuperas, TU versión de esos campos reemplazará la del servidor (los demás campos se mezclan como se indica en el aviso).\n\n'
    + '¿Recuperar mis cambios de todos modos?';
}

/** El texto del confirm() antes de descartar el respaldo. */
export function confirmacionDescartar(respaldo, opts) {
  const hora = horaDe(respaldo?.guardadoEn, opts);
  return `¿Descartar tu respaldo${hora ? ` de las ${hora}` : ''}?\n\n`
    + 'Se borra de esta computadora y NO se puede recuperar. La versión del servidor no cambia.';
}

const fmtMoneda = (n) => {
  if (!Number.isFinite(n)) return '—';
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n); }
  catch { return `$${Math.round(n)}`; }
};
const piezasDe = (partidas) => (partidas || []).reduce((a, p) => a + (Number(p?.cantidad) || 0), 0);

/**
 * Resumen legible de lo que difiere entre el respaldo y la versión en pantalla (la del servidor).
 * Siempre: Cliente, Partidas (renglones · piezas), Total (si se inyecta `totalDe`). Sólo si difieren:
 * Folio, Acomodo y porcentajes. Filas: { campo, etiqueta, respaldo, servidor, distinto }.
 */
export function resumenDiferencias(respaldoCot, servidorCot, { totalDe, normalizar = (c) => c } = {}) {
  const r = camposMezcla(normalizar(respaldoCot)); const s = camposMezcla(normalizar(servidorCot));
  const filas = [];
  const fila = (campo, etiqueta, vr, vs, distinto, siempre) => { if (siempre || distinto) filas.push({ campo, etiqueta, respaldo: vr, servidor: vs, distinto }); };
  fila('cliente', 'Cliente', r.cliente || '(sin cliente)', s.cliente || '(sin cliente)', r.cliente !== s.cliente, true);
  fila('folio', 'Folio', r.folio || '(sin folio)', s.folio || '(sin folio)', r.folio !== s.folio, false);
  const txtPartidas = (p) => `${p.length} ${p.length === 1 ? 'partida' : 'partidas'} · ${piezasDe(p)} pzas`;
  fila('partidas', 'Partidas', txtPartidas(r.partidas), txtPartidas(s.partidas), !mismoValor(r.partidas, s.partidas), true);
  if (typeof totalDe === 'function') {
    let tr = NaN, ts = NaN;
    try { tr = Number(totalDe(respaldoCot || {})); } catch { /* total ilegible */ }
    try { ts = Number(totalDe(servidorCot || {})); } catch { /* total ilegible */ }
    fila('total', 'Total', fmtMoneda(tr), fmtMoneda(ts), !(tr === ts || (Number.isNaN(tr) && Number.isNaN(ts))), true);
  }
  fila('acomodo', 'Acomodo', r.acomodo ? 'con acomodo' : 'sin acomodo', s.acomodo ? 'con acomodo' : 'sin acomodo', !mismoValor(r.acomodo, s.acomodo), false);
  for (const k of ['descuentoPct', 'contingenciaPct', 'maniobrasPct', 'fletePct', 'ivaPct', 'anticipoPct']) {
    fila(k, ETIQUETAS_CAMPO[k], r[k] == null ? '—' : `${r[k]}%`, s[k] == null ? '—' : `${s[k]}%`, !mismoValor(r[k], s[k]), false);
  }
  return filas;
}

// ---------------------------------------------------------------------------
//  Ciclo de vida del respaldo en localStorage (storage inyectable; nunca lanza).
//  Una PILA por cotización: si ya había un respaldo sin resolver y hay otro conflicto, el nuevo se
//  pone encima y el anterior viaja en `anteriores` (nunca se pisa en silencio). Resolver el de
//  arriba (recuperar o descartar con confirmación) deja visible el siguiente.
// ---------------------------------------------------------------------------

/** El respaldo de esa cotización, o null (sin clave, JSON roto, versión desconocida o storage bloqueado). */
export function leerRespaldoConflicto(storage, id) {
  try {
    if (!storage || id == null) return null;
    const raw = storage.getItem(claveRespaldoConflicto(id));
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (!r || r.version !== VERSION_RESPALDO_CONFLICTO || !r.cotizacion || typeof r.cotizacion !== 'object') return null;
    return r;
  } catch {
    return null;
  }
}

// P1-REL-02 (cierre ChatGPT v3): un conflicto SIN RESOLVER sobrevive a recargar la página. Antes, al recargar, lo local
// se volvía a enviar, el aviso reaparecía y la versión del servidor nunca se mostraba. Con la marca, al volver a abrir se
// respalda lo local y se carga la versión del servidor (lo mismo que "Ver la versión del servidor").
export const PREFIJO_CONFLICTO_ABIERTO = 'costeador-vonhaucke-conflicto-abierto-';
/** Marca (c) o retira (null) el conflicto abierto de esa cotización. Nunca lanza. */
export function marcarConflictoAbierto(storage, id, c) {
  try {
    if (!storage || id == null) return false;
    if (c) storage.setItem(PREFIJO_CONFLICTO_ABIERTO + id, JSON.stringify({ ...c, marcado: new Date().toISOString() }));
    else storage.removeItem(PREFIJO_CONFLICTO_ABIERTO + id);
    return true;
  } catch { return false; }
}
/** El conflicto abierto que quedó al recargar, o null. */
export function leerConflictoAbierto(storage, id) {
  try {
    if (!storage || id == null) return null;
    const raw = storage.getItem(PREFIJO_CONFLICTO_ABIERTO + id);
    const c = raw ? JSON.parse(raw) : null;
    return c && typeof c === 'object' ? c : null;
  } catch { return null; }
}
// "Volver a aplicar mis cambios" guarda el documento COMPLETO encima de lo de la otra persona: se confirma.
export const CONFIRMACION_REAPLICAR = 'Vas a guardar TU versión completa encima de la que guardó la otra persona: lo que ella cambió se pierde. ¿Seguro? (Para conservar lo de los dos usa "Ver la versión del servidor" y luego "Recuperar mis cambios".)';

/** Respaldo nuevo encima del previo (si había): el previo no se pierde. */
export function apilarRespaldo(previo, nuevo) {
  if (!previo) return nuevo;
  const { anteriores = [], ...cabeza } = previo;
  return { ...nuevo, anteriores: [cabeza, ...anteriores] };
}

/** Lo que queda tras resolver el respaldo de arriba: el siguiente de la pila, o null. */
export function siguienteRespaldo(respaldo) {
  const [sig, ...resto] = Array.isArray(respaldo?.anteriores) ? respaldo.anteriores : [];
  if (!sig) return null;
  return resto.length ? { ...sig, anteriores: resto } : sig;
}

/** Escribe el respaldo apilándolo sobre el que ya hubiera. true si quedó escrito. */
export function guardarRespaldoConflicto(storage, id, respaldo) {
  try {
    if (!storage) return false;
    const previo = leerRespaldoConflicto(storage, id);
    // Cierre v3 (lab A–L contra la preview, carrera real): recargar mientras "Ver la versión del servidor" todavía cargaba
    // volvía a respaldar EL MISMO documento, encima y SIN base → "Recuperar" lo trataba todo como choque y pisaba lo de la
    // otra persona; el primer respaldo quedaba huérfano. El mismo documento no se apila: se conserva el previo (con su base).
    if (previo && JSON.stringify(camposMezcla(previo.cotizacion)) === JSON.stringify(camposMezcla(respaldo?.cotizacion))) {
      storage.setItem(claveRespaldoConflicto(id), JSON.stringify({ ...previo, ...(previo.base ? {} : respaldo?.base ? { base: respaldo.base } : {}) }));
      return true;
    }
    storage.setItem(claveRespaldoConflicto(id), JSON.stringify(apilarRespaldo(previo, respaldo)));
    return true;
  } catch {
    return false;
  }
}

// Quita el de arriba: deja el siguiente o borra la clave si era el último.
function retirarCabeza(storage, id, respaldo) {
  const sig = siguienteRespaldo(respaldo);
  if (sig) storage.setItem(claveRespaldoConflicto(id), JSON.stringify(sig));
  else storage.removeItem(claveRespaldoConflicto(id));
  return true;
}

/**
 * "Descartar mi respaldo": SÓLO si `confirmar()` devuelve true se retira. Sin confirmación (o si
 * `confirmar` no es función) no se toca nada. Devuelve true si se retiró.
 */
export function descartarRespaldoConflicto(storage, id, confirmar) {
  try {
    const r = leerRespaldoConflicto(storage, id);
    if (!r) return false;
    if (typeof confirmar !== 'function' || confirmar(r) !== true) return false;
    return retirarCabeza(storage, id, r);
  } catch {
    return false;
  }
}

/**
 * Tras "Recuperar mis cambios": el respaldo se retira SÓLO si el servidor confirmó el guardado
 * (`resultado.guardado === true`). Conflicto nuevo, red, etc. → el respaldo se queda.
 */
export function retirarRespaldoRecuperado(storage, id, resultado) {
  try {
    if (!resultado || resultado.guardado !== true) return false;
    const r = leerRespaldoConflicto(storage, id);
    if (!r) return false;
    return retirarCabeza(storage, id, r);
  } catch {
    return false;
  }
}
