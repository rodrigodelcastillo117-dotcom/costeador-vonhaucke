// ============================================================================
//  NUBE - datos compartidos en Supabase.
//  Los precios, recetas, parametros y la nomina (cifrada) viven en un solo
//  renglon. Cuando alguien lo actualiza, a todos se les propaga en vivo.
//  Si no hay internet, la app sigue con lo local (ver almacen.js).
// ============================================================================
import { reglasTexto } from './datos/reglas.js';
import { aprendizajesTexto } from './datos/aprendizaje.js';
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

export async function leerConfig() {
  const { data, error } = await nube.from('config').select('datos').eq('id', 'vonhaucke').single();
  if (error) throw error;
  return data?.datos || {};
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
  try { await nube.auth.signOut({ scope: 'others' }); return true; } catch (e) { return false; }
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
export async function miPermiso(email) {
  const { data, error } = await nube.from('permitidos').select('rol, nombre').eq('email', email).maybeSingle();
  if (error) throw error;
  return data || null;
}
// Las contraseñas temporales que se han ido dando de alta (solo Dirección las
// lee — RLS). Sirve para el Excel de "Descargar credenciales": Rodrigo, dando
// de alta a su equipo el mismo día que se lo iba a enseñar: "solo requiero un
// excel con sus contraseñas, y cada vez que demos de alta a alguien, se guarde
// en ese excel automáticamente". El guardado ya pasa solo (edge function
// `usuarios`, acción `crear`); esto es sólo la lectura para exportarlo.
export async function credencialesTemporales() {
  const { data, error } = await nube.from('credenciales_temporales').select('email, nombre, rol, password_temporal, actualizado');
  if (error) console.error('credencialesTemporales:', error);
  return (data || []).sort((a, b) =>
    (a.nombre || a.email || '').localeCompare(b.nombre || b.email || '', 'es', { sensitivity: 'base' }));
}
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
