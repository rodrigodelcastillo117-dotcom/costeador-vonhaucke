// ============================================================================
//  NUBE - datos compartidos en Supabase.
//  Los precios, recetas, parametros y la nomina (cifrada) viven en un solo
//  renglon. Cuando alguien lo actualiza, a todos se les propaga en vivo.
//  Si no hay internet, la app sigue con lo local (ver almacen.js).
// ============================================================================
import { reglasTexto } from './datos/reglas.js';
import { aprendizajesTexto } from './datos/aprendizaje.js';
import { validarIntentCosteo, intentDesdePieza } from './datos/validarIntentCosteo.js';
import { createClient } from '@supabase/supabase-js';

const URL = 'https://mtuvnbgljwbsaizjjgzs.supabase.co';
const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';

export const nube = createClient(URL, LLAVE, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 2 } },
});

// Campos que se comparten (el resto es de cada quien: cotizacion, historial...)
export const CAMPOS_COMPARTIDOS = ['insumos', 'piezas', 'parametros', 'dir', 'finanzas'];

export function soloCompartido(estado) {
  const c = {};
  for (const k of CAMPOS_COMPARTIDOS) if (estado[k] !== undefined) c[k] = estado[k];
  return c;
}

// El SERVIDOR decide qué config recibe cada rol (no el navegador): Dirección/Diseño
// reciben la config COMPLETA (con costos, para despiece); el vendedor recibe la
// versión SELLER-SAFE (sin precio/precioBase/proveedor de insumos, sin factores ni
// economía). Ver RPC `config_para_rol` (SECURITY DEFINER, resuelve el rol por el JWT).
// Así el costo NO viaja al navegador del vendedor por esta vía.
export async function leerConfig() {
  const { data, error } = await nube.rpc('config_para_rol');
  if (error) throw error;
  return data || {};
}

export async function escribirConfig(datosCompartidos) {
  const { error } = await nube
    .from('config')
    .update({ datos: datosCompartidos, actualizado: new Date().toISOString() })
    .eq('id', 'vonhaucke');
  if (error) throw error;
}

// ---- Sesion / acceso (control de quien entra) ----
// --- BOVEDA DE DIRECCION -----------------------------------------------------
// Nomina y estados financieros. La base solo entrega esta tabla a quien tiene
// rol 'direccion' (se resuelve por el correo del que entro). Si un vendedor la
// pide, no obtiene nada: no es que se le esconda en pantalla, es que no le llega.
export async function leerDireccion() {
  const { data, error } = await nube.from('direccion').select('datos').eq('id', 1).maybeSingle();
  if (error) { console.error('leerDireccion:', error); return null; }
  return data?.datos || null;
}

export async function escribirDireccion(datos) {
  const { error } = await nube.from('direccion').upsert({ id: 1, datos, actualizado: new Date().toISOString() });
  if (error) throw error;
}

export async function sesionActual() {
  const { data } = await nube.auth.getSession();
  return data.session || null;
}
export function alCambiarSesion(cb) {
  const { data } = nube.auth.onAuthStateChange((evento, s) => cb(s || null, evento));
  return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
}
export async function entrar(email, password) {
  const { data, error } = await nube.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}
export async function salir() { try { await nube.auth.signOut(); } catch (e) {} }

// El usuario cambia SU propia contraseña (ya está autenticado).
// Manda el correo para restablecer la contraseña. El enlace regresa a la app
// con una sesión de recuperación: ahí se pone la nueva SIN pedir la anterior
// (justo porque no la recuerda).
export async function pedirRecuperacion(email) {
  const { error } = await nube.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) return { ok: false, error: error.message || 'No se pudo enviar el correo.' };
  return { ok: true };
}

// Re-autentica al usuario con su contraseña ACTUAL. Sin esto, cualquiera que
// se encuentre una sesión abierta puede cambiar la clave y quedarse la cuenta.
export async function verificarContrasena(email, actual) {
  const { error } = await nube.auth.signInWithPassword({ email, password: actual });
  return !error;
}

// Cierra la sesión en los DEMÁS dispositivos, no en éste.
export async function cerrarOtrasSesiones() {
  // signOut DEVUELVE {error} (no lanza) cuando falla: el try/catch solo atrapaba
  // excepciones, así que un fallo del servidor devolvía true igual -> la UI decía
  // "cerré tus otras sesiones" sin haberlo hecho. Ahora se revisa el error real.
  try {
    const { error } = await nube.auth.signOut({ scope: 'others' });
    return !error;
  } catch (e) { return false; }
}

export async function cambiarContrasena(nueva) {
  const { error } = await nube.auth.updateUser({ password: nueva });
  if (error) return { ok: false, error: error.message || 'No se pudo cambiar la contraseña.' };
  return { ok: true };
}

// Devuelve el permiso del correo (rol/nombre) o null si de verdad no esta en
// la lista. Si la CONSULTA falla (red, RLS) se LANZA en vez de devolver null:
// null es "no tienes acceso" y se enseña como tal en App.jsx ("Pídele a
// Dirección que te dé de alta"), un mensaje FALSO para alguien que sí está
// dado de alta pero pescó un error de red. Quien llama distingue los dos
// casos con try/catch (antes no se podía: los dos volvían null).
// Timeout de cliente: una consulta que se cuelga (red intermitente, servidor sin
// responder) dejaba al usuario atorado en "Un momento…" PARA SIEMPRE, porque la
// promesa nunca resolvía. Con esto, a los 8 s lanza y el llamador (gate de acceso)
// lo trata como error transitorio -> reintenta. Falla CERRADO: un timeout nunca
// concede acceso, sólo deja de colgar.
function conTimeout(promesa, ms = 8000, etiqueta = 'operación') {
  return Promise.race([
    promesa,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`Tiempo agotado (${etiqueta}).`)), ms)),
  ]);
}

export async function miPermiso(email) {
  const { data, error } = await conTimeout(
    nube.from('permitidos').select('rol, nombre').eq('email', email).maybeSingle(),
    8000, 'permiso',
  );
  if (error) throw error;
  return data || null;
}
// P0-09 / FASE 14 — el "Excel con todas las contraseñas temporales" SE ELIMINÓ.
// Guardar contraseñas en texto plano (aunque fuera solo-Dirección por RLS) es la
// arquitectura prohibida: Supabase Auth es la única autoridad de contraseña. Ahora,
// al dar de alta, la contraseña se muestra UNA vez para compartirla y no se guarda
// en ningún lado (ver edge `usuarios` → `password_una_vez`). La tabla
// `credenciales_temporales` quedó sin lectores y se elimina en la DB.
export async function listaPermitidos() {
  const { data, error } = await nube.from('permitidos').select('email, nombre, rol, creado');
  if (error) console.error('listaPermitidos:', error);
  // ALFABÉTICA por nombre (Rodrigo, 2026-08-16). Antes salían por fecha de alta,
  // así que buscar a alguien en la lista era leerla entera. Se ordena aquí y no
  // en la pantalla para que cualquiera que pida la lista la reciba ya ordenada,
  // y así quien se dé de alta después cae solo en su lugar.
  return (data || []).sort((a, b) =>
    (a.nombre || a.email || '').localeCompare(b.nombre || b.email || '', 'es', { sensitivity: 'base' }));
}
// Administrar usuarios (solo Direccion): crear / eliminar via la funcion segura.
// ⚠️ SIN try/catch NI REVISAR r.ok, LOS BOTONES DE Usuarios.jsx SE QUEDABAN
// "cargando" PARA SIEMPRE (auditoría 2026-08-19) — justo el día que se dio de
// alta a todo el equipo, si la red fallaba a media alta. Mismo contrato
// {ok, error} que ya usan todas las demás funciones de este archivo.
export async function adminUsuarios(accion, payload) {
  try {
    const s = await sesionActual();
    const r = await fetch(`${URL}/functions/v1/usuarios`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s?.access_token || ''}` },
      body: JSON.stringify({ accion, ...payload }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: j?.error || `Error del servidor (${r.status}).` };
    return j?.ok === false ? j : { ok: true, ...j };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar. Revisa tu internet y vuelve a intentar.' };
  }
}

// Analiza una imagen (render/foto) con IA y devuelve un despiece propuesto.
// La función 'analizar-mueble' (mega analizador COO/DFM) llama a Claude (visión)
// con verify_jwt: manda la sesión del usuario. Devuelve { ok, propuesta } con
// { piezas, informe (Markdown), descripcionCliente, materiales, ... } o { ok:false, error }.
export async function analizarRender(catalogo, image, mediaType) {
  const { data, error } = await nube.functions.invoke('analizar-mueble', {
    body: { catalogo, image, mediaType },
  });
  if (error) {
    // El cuerpo de error de la función suele venir en error.context
    let msg = error.message || 'No se pudo analizar la imagen.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    return { ok: false, error: msg };
  }
  return data;
}

// Varias HOJAS del MISMO mueble (plano multipágina rasterizado a imágenes). La IA
// las integra en un solo despiece. Mismo retorno que analizarRender.
export async function analizarRenderImagenes(catalogo, imagenes) {
  const { data, error } = await nube.functions.invoke('analizar-mueble', {
    body: { catalogo, imagenes },
  });
  if (error) {
    let msg = error.message || 'No se pudo analizar el plano.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    return { ok: false, error: msg };
  }
  return data;
}

// SÓLO TEXTO: el cliente describe el mueble ("banca de aeropuerto 4 plazas, aluminio,
// asiento y respaldo tapizados, conector cada 2 asientos") y la IA lo interpreta como
// OBJETO (analizar-mueble v17, modo texto). Devuelve el MISMO { ok, propuesta } que la
// ruta de imagen, ya con design_intent + semantic_role por pieza. Sin imagen.
export async function analizarTexto(catalogo, descripcion) {
  const { data, error } = await nube.functions.invoke('analizar-mueble', {
    body: { catalogo, descripcion },
  });
  if (error) {
    let msg = error.message || 'No se pudo interpretar la descripción.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    return { ok: false, error: msg };
  }
  return data;
}

// SEGUNDA PASADA (verificadora): la IA recibe su propio despiece + las mismas hojas
// y lo CRITICA contra las cotas (infla/baja/duplica/inventa), lo corrige y llena el
// 'razonamiento' de consumo por pieza. Si falla, se devuelve la propuesta original
// (la verificación es una mejora, no un requisito — nunca deja al usuario sin nada).
export async function verificarDespiece(catalogo, imagenes, propuesta) {
  try {
    const { data, error } = await nube.functions.invoke('analizar-mueble', {
      body: { catalogo, imagenes, revisar: propuesta },
    });
    if (error || !data?.ok) return { ok: true, propuesta, verificado: false };
    return { ...data, verificado: true };
  } catch (e) {
    return { ok: true, propuesta, verificado: false };
  }
}

// Re-costea el despiece aplicando las RESPUESTAS del usuario a las preguntas de la IA
// (verdad confirmada: sobrescribe supuestos). respuestas = [{pregunta, respuesta}].
export async function responderDespiece(catalogo, imagenes, propuesta, respuestas) {
  try {
    const { data, error } = await nube.functions.invoke('analizar-mueble', {
      body: { catalogo, imagenes, revisar: propuesta, respuestas },
    });
    if (error || !data?.ok) {
      let msg = error?.message; try { const j = await error?.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
      return { ok: false, error: msg || data?.error || 'No se pudo aplicar las respuestas.' };
    }
    return { ...data, verificado: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Guarda la trazabilidad de confirmaciones del usuario (pregunta→respuesta, valor anterior, etc.).
export async function guardarConfirmaciones(rows) {
  try { if (Array.isArray(rows) && rows.length) await nube.from('confirmaciones').insert(rows); } catch (e) { /* no bloquea */ }
}

// Cotizador conversacional: texto natural -> items estructurados (Claude).
export async function cotizarTexto(texto, catalogo) {
  // Las reglas de oficio que Rodrigo dicta en "Lo que Voni sabe" viajan CON el
  // pedido. Sin esta línea la pantalla enseñaba reglas que el modelo nunca veía.
  const { data, error } = await nube.functions.invoke('cotizar-texto', {
    body: { texto, catalogo, reglas: reglasTexto('cotizacion'), aprendizajes: aprendizajesTexto() },
  });
  if (error) {
    let msg = error.message || 'No se pudo interpretar el texto.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    return { ok: false, error: msg };
  }
  return data;
}

// Acomodo de mobiliario en una o varias áreas (Claude propone posiciones).
export async function acomodarEspacio(areas, piezas) {
  const { data, error } = await nube.functions.invoke('acomodar-espacio', {
    body: { areas, piezas },
  });
  if (error) {
    let msg = error.message || 'No se pudo acomodar el espacio.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    return { ok: false, error: msg };
  }
  return data;
}

// Lee un plano (imagen) y devuelve las áreas con medidas (Claude visión).
export async function leerPlano(image, mediaType, refMM) {
  const { data, error } = await nube.functions.invoke('leer-plano', {
    body: { image, mediaType, refMM },
  });
  if (error) {
    let msg = error.message || 'No se pudo leer el plano.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    return { ok: false, error: msg };
  }
  return data;
}

// La voz de Voni sobre señales YA CALCULADAS (Fase 2 de "Voni Cerebro",
// src/datos/senales.js) — nunca manda datos crudos, solo el resumen
// determinístico que ya se armó en el cliente. `alcance`: 'cotizacion' o
// 'negocio' (este último trae candado de rol del lado del servidor).
export async function analizarNegocio(senales, alcance = 'cotizacion') {
  const { data, error } = await nube.functions.invoke('analizar-negocio', {
    body: { senales, alcance, reglas: reglasTexto('negocio'), aprendizajes: aprendizajesTexto() },
  });
  if (error) {
    let msg = error.message || 'No se pudo conectar con Voni.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    return { ok: false, error: msg };
  }
  return data;
}

// Genera un render fotorrealista del mueble descrito (Gemini). extra: {materiales, medidas, tipo, imagen, mediaType}.
export async function generarRender(descripcion, extra = {}) {
  const { data, error } = await nube.functions.invoke('generar-render', {
    body: { descripcion, ...extra },
  });
  if (error) {
    let msg = error.message || 'No se pudo generar el render.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    return { ok: false, error: msg };
  }
  return data;
}

// --- SHADOW costear-servidor (Fase 3) ----------------------------------------
// Llama al motor autoritativo del servidor con el JWT real del usuario. El servidor
// resuelve rol/costos server-side e ignora lo que mande el browser. Fire-and-forget.
export async function costearServidor(pieza, cantidad = 1) {
  // VH-036: se manda la INTENCIÓN TÉCNICA saneada (sin margen/factores/modelo) y se
  // valida ANTES de salir con el mismo validador que espeja el servidor.
  const intent = intentDesdePieza(pieza, cantidad);
  const v = validarIntentCosteo(intent);
  if (!v.ok) return { ok: false, error: v.issues?.[0]?.msg || v.code, code: v.code, issues: v.issues, status: 400 };
  const { data, error } = await nube.functions.invoke('costear-servidor', {
    body: v.intent,
  });
  if (error) {
    let msg = error.message || 'No se pudo costear en el servidor.';
    let status = error.context?.status;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) {}
    return { ok: false, error: msg, status };
  }
  return data;
}

// Registra la comparación cliente vs servidor SIN datos sensibles (ni tokens ni passwords).
// Nunca lanza: el shadow jamás debe romper el flujo del usuario.
export async function registrarSombra(reg) {
  try { await nube.from('shadow_costeo').insert(reg); } catch (e) { /* shadow silencioso */ }
}

// --- RENDER V1: subir imagen a Storage (NO base64 en JSON) + guardar metadata ---
// Convierte un dataUrl base64 a Blob y lo sube al bucket 'renders'. Devuelve {ok, path, url}.
export async function subirRender(dataUrl, path) {
  try {
    const [cab, b64] = String(dataUrl).split(',');
    const mime = (cab.match(/data:(.*?);/) || [])[1] || 'image/png';
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const { error } = await nube.storage.from('renders').upload(path, u8, { contentType: mime, upsert: true });
    if (error) return { ok: false, error: error.message };
    const { data } = nube.storage.from('renders').getPublicUrl(path);
    return { ok: true, path, url: data?.publicUrl || null };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Guarda la metadata del render (técnico, sin base64). Devuelve {ok, id}.
export async function guardarRender(meta) {
  const { data, error } = await nube.from('renders').insert(meta).select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

// --- BIBLIOTECA DE EXPEDIENTES ------------------------------------------------
// Sube una página de plano (base64 raw) a Storage; devuelve su URL pública.
export async function subirPlano(base64, path) {
  return subirRender('data:image/jpeg;base64,' + base64, path);
}
// Crea un expediente nuevo. Devuelve {ok,id}.
export async function guardarExpediente(exp) {
  const { data, error } = await nube.from('expedientes').insert(exp).select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}
// Actualiza un expediente existente (edición del equipo de diseño).
export async function actualizarExpediente(id, patch) {
  const { error } = await nube.from('expedientes').update({ ...patch, actualizado: new Date().toISOString() }).eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
// Lista expedientes (más recientes primero) y filtra por palabra clave (nombre o etiquetas) en cliente.
export async function listarExpedientes(q) {
  const { data, error } = await nube.from('expedientes')
    .select('id,creado,actualizado,nombre,etiquetas,estado,producto_tipo,render_aislado_url,costo')
    .order('creado', { ascending: false }).limit(80);
  if (error) return { ok: false, error: error.message, items: [] };
  const term = (q || '').trim().toLowerCase();
  const items = term
    ? (data || []).filter((x) => (x.nombre || '').toLowerCase().includes(term) || (x.etiquetas || []).some((t) => String(t).toLowerCase().includes(term)))
    : (data || []);
  return { ok: true, items };
}
// Trae un expediente completo (para reabrir/duplicar/re-costear).
export async function obtenerExpediente(id) {
  const { data, error } = await nube.from('expedientes').select('*').eq('id', id).maybeSingle();
  return error ? { ok: false, error: error.message } : { ok: true, expediente: data };
}
// Guarda un snapshot INMUTABLE de revisión (no pisa el anterior).
export async function guardarRevisionExpediente(row) {
  try { await nube.from('expediente_revisiones').insert(row); } catch (e) { /* no bloquea */ }
}
// Historial de revisiones de un expediente (rev desc).
export async function listarRevisiones(expedienteId) {
  const { data, error } = await nube.from('expediente_revisiones')
    .select('rev,creado,creado_por,costo').eq('expediente_id', expedienteId).order('rev', { ascending: false });
  return error ? [] : (data || []);
}

// --- COCREAR · RPCs SEGUROS (server-authority, seller-safe, revisiones inmutables).
//     El backend valida rol/propiedad, despoja economía al vendedor y versiona.
// Guarda/actualiza una co-creación. id=null crea; id crea una revisión nueva (rev+1)
// salvo que el contenido sea idéntico (idempotente por hash). Devuelve {ok, expediente_id, revision, ...}.
export async function guardarCocrearSeguro(expedienteId, payload) {
  const { data, error } = await nube.rpc('guardar_cocrear_seguro', { p_expediente_id: expedienteId ?? null, p_payload: payload });
  if (error) return { ok: false, error: error.message };
  return data;
}
// Carga una co-creación completa (sin economía si el rol no la ve). {ok, id, cocrear, historia, ...}.
export async function cargarCocrearSeguro(expedienteId) {
  const { data, error } = await nube.rpc('cocrear_seguro', { p_expediente_id: expedienteId });
  if (error) return { ok: false, error: error.message };
  return data;
}
// Lista las CO-CREACIONES guardadas (expedientes con payload cocrear). RLS aplica
// (Dirección/Diseño ven las suyas). Liviano: sin traer el jsonb completo.
export async function listarCocreaciones(limite = 12) {
  const { data, error } = await nube.from('expedientes')
    .select('id,nombre,producto_tipo,estado,actualizado,creado')
    .not('cocrear', 'is', null)
    .order('actualizado', { ascending: false, nullsFirst: false }).limit(limite);
  if (error) return { ok: false, error: error.message, items: [] };
  return { ok: true, items: data || [] };
}
// Registra/reutiliza la ProductRevision canónica desde el expediente (una sola verdad de producto).
export async function registrarProductoDesdeExpediente(expedienteId) {
  const { data, error } = await nube.rpc('registrar_producto_desde_expediente', { p_expediente_id: expedienteId });
  if (error) return { ok: false, error: error.message };
  return data;
}

// RENDER CANÓNICO · sube la imagen al Storage (bucket público `renders`) y la registra
// contra la ProductVersion exacta (spec_hash, prompt_version, stale). No guarda base64
// pesado en JSON. Devuelve {ok, storage_url, storage_path, ...} o {ok:false, error}.
export async function subirRenderCanonico({ expedienteId, productoId, productoVersionId, dataUrl, promptVersion, modo = 'render', specHash, geometryHash = null, inputs = {} }) {
  try {
    if (!dataUrl) return { ok: false, error: 'sin imagen' };
    const blob = await (await fetch(dataUrl)).blob();
    const ext = ((blob.type || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg');
    // Path ÚNICO (insert simple): evita el camino de UPSERT (que exigiría también la
    // policy de UPDATE). Sólo requiere `renders_insert` (authenticated, bucket=renders).
    const path = `cocrear/${expedienteId || 'tmp'}/${specHash || 'r'}-${Date.now()}.${ext}`;
    const up = await nube.storage.from('renders').upload(path, blob, { upsert: false, contentType: blob.type || 'image/png' });
    if (up.error) return { ok: false, error: up.error.message };
    const storageUrl = nube.storage.from('renders').getPublicUrl(path)?.data?.publicUrl || null;
    const { data, error } = await nube.rpc('registrar_render_canonico', {
      p_producto_id: productoId ?? null, p_producto_version_id: productoVersionId ?? null, p_expediente_id: expedienteId ?? null,
      p_storage_path: path, p_storage_url: storageUrl, p_prompt_version: promptVersion || null, p_modo: modo,
      p_spec_hash: specHash || null, p_geometry_hash: geometryHash, p_inputs: inputs || {},
    });
    if (error) return { ok: false, error: error.message, storage_url: storageUrl, storage_path: path };
    return { ok: true, ...(data || {}), storage_url: storageUrl, storage_path: path };
  } catch (e) { return { ok: false, error: String(e?.message || e) }; }
}

// GATE DE EMISIÓN autoritativo (server-side). Devuelve { ok, estado, motivos[], economics[], hash }.
// estado ∈ ALLOWED | ECONOMICS_INCOMPLETE | APPROVAL_REQUIRED | BLOCKED. Seller-safe
// (no trae cifras de costo/margen, sólo razones). Degrada: si falla, { ok:false, estado:'DESCONOCIDO' }.
export async function cotizacionEmitible(cotizacionId) {
  if (!cotizacionId) return { ok: false, estado: 'SIN_GUARDAR', motivos: ['sin_guardar'] };
  const { data, error } = await nube.rpc('cotizacion_emitible', { p_cotizacion_id: cotizacionId });
  if (error || !data) return { ok: false, estado: 'DESCONOCIDO', motivos: [], error: error?.message };
  return data;
}

// VONI COUNCIL · capa de razonamiento multi-modelo (edge `voni-council`, JWT).
// Recibe { task, request, context, constraints, lenses } y devuelve PROPUESTA/CRÍTICA
// ({ council:{status,decision,...}, opinions:[...], execution:'PROPOSAL_ONLY' }). El
// servidor sanitiza el contexto por rol. El front NUNCA ejecuta por esto; sólo propone.
export async function voniCouncil(payload) {
  try {
    const { data, error } = await nube.functions.invoke('voni-council', { body: payload });
    if (error) return { ok: false, error: error.message || String(error) };
    return data || { ok: false, error: 'sin respuesta del council' };
  } catch (e) { return { ok: false, error: String(e?.message || e) }; }
}

// RENDER CANÓNICO (lectura). Trae las filas de `renders` de UNAS revisiones exactas
// (por producto_version_id) vía RPC SECURITY DEFINER `resolver_renders_canonicos`
// (la tabla tiene RLS deny-all para el front). Devuelve { [versionId]: filas[] }; el
// contrato de VIGENTE/STALE/none lo decide src/datos/renderCanonico.js. Degrada a {}.
export async function resolverRendersCanonicos(versionIds = []) {
  const ids = [...new Set((versionIds || []).map((v) => Number(v)).filter((v) => Number.isFinite(v)))];
  if (!ids.length) return {};
  const { data, error } = await nube.rpc('resolver_renders_canonicos', { p_version_ids: ids });
  if (error || !Array.isArray(data)) return {};
  const porVersion = {};
  for (const fila of data) {
    const k = fila.producto_version_id;
    (porVersion[k] = porVersion[k] || []).push(fila);
  }
  return porVersion;
}
// Descarga una imagen de Storage y la vuelve base64 raw (para re-render con el plano original).
export async function urlABase64(url) {
  try {
    const r = await fetch(url); const b = await r.blob();
    return await new Promise((res) => { const fr = new FileReader(); fr.onloadend = () => res(String(fr.result).split(',')[1] || null); fr.onerror = () => res(null); fr.readAsDataURL(b); });
  } catch (e) { return null; }
}

// hash corto y estable del input (djb2) para correlacionar cliente/servidor sin guardar el BOM.
export function hashInput(obj) {
  const t = JSON.stringify(obj ?? {});
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
  return 'in' + h.toString(36);
}

// Llama cb(datosCompartidos) cada vez que alguien mas actualiza la config.
export function suscribirConfig(cb) {
  const canal = nube
    .channel('config-vonhaucke')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'config', filter: 'id=eq.vonhaucke' },
      (payload) => cb(payload.new?.datos)
    )
    .subscribe();
  return () => { try { nube.removeChannel(canal); } catch (e) {} };
}
