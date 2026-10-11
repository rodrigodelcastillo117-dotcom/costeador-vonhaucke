// ============================================================================
//  LO QUE VONI APRENDE
//
//  Rodrigo, 2026-08-16: "es importante que VONI aprenda siempre".
//
//  Hasta hoy no aprendía nada, y no era por el modelo: **no había dónde
//  guardar**. La base tenía cuatro tablas y ninguna almacenaba un pedido ni una
//  corrección; la aclaración que escribía el vendedor se pegaba a un `useState`
//  y moría al recargar la página. Voni cometía el mismo error todos los días.
//
//  CÓMO APRENDE, en dos velocidades:
//
//  1) SIEMPRE Y SOLA (sin que nadie apruebe nada). Cada corrección se anota y
//     las más recientes viajan de vuelta dentro del siguiente pedido. Voni ve
//     "esto ya te lo corrigieron" y no lo repite. Es inmediato y es reversible:
//     si una lección resultó mala, se desactiva y desaparece del prompt.
//
//  2) CON REVISIÓN, para lo permanente. Cuando una lección se repite, la
//     Dirección la convierte en REGLA desde "Lo que Voni sabe". Una regla pesa
//     más que una lección y ya no caduca.
//
//  Por qué NO aprende sola a nivel de regla: una corrección de un vendedor en un
//  proyecto raro se volvería ley para los nueve. Aprender rápido y olvidar
//  rápido es seguro; grabar en piedra sin que nadie mire, no.
//
//  REGLA DE ORO DE ESTE ARCHIVO: anotar NUNCA puede romper una cotización. Si la
//  nube falla, se traga el error y el vendedor no se entera. Aprender es
//  secundario; cotizar es el trabajo.
// ============================================================================
import { nube } from '../nube.js';
import { veCostosCosteo, normalizarRol } from './roles.js';

let CACHE = [];          // lecciones vigentes, cargadas al abrir
let cargado = false;

// ---------------------------------------------------------------------------
//  VH-059 · QUIÉN ANOTA. La RLS de `aprendizajes` exige `usuario = correo de la
//  sesión` y `aprobado_para_ia = puede_editar_config()`. El cliente mandaba
//  `usuario: null` (leía un campo que no existe) y nunca `aprobado_para_ia`, así
//  que desde que la base se endureció NINGUNA lección se guardaba y nadie lo veía
//  (anotar traga errores a propósito). Aquí se resuelve la sesión y el rol una vez.
// ---------------------------------------------------------------------------
let QUIEN = null;        // { email, rol } de la sesión, con caché
export async function quienAnota() {
  try {
    const { data } = await nube.auth.getSession();
    const email = data?.session?.user?.email || null;
    if (!email) { QUIEN = null; return null; }
    if (QUIEN && QUIEN.email === email) return QUIEN;
    const { data: p } = await nube.from('permitidos').select('rol').eq('email', email).maybeSingle();
    QUIEN = { email, rol: normalizarRol(p?.rol) };
    return QUIEN;
  } catch (e) { return QUIEN; }
}
export function olvidarQuien() { QUIEN = null; }

// Cuántas lecciones se le recuerdan al modelo. Más que esto y el prompt empieza
// a pesar más que el catálogo, que es lo que de verdad tiene que leer.
const MAX_EN_PROMPT = 25;

export async function cargarAprendizajes() {
  try {
    const { data, error } = await nube
      .from('aprendizajes')
      .select('*')
      .eq('activo', true)
      .order('creado', { ascending: false })
      .limit(120);
    if (!error && data) { CACHE = data; cargado = true; }
  } catch (e) { /* sin nube se sigue cotizando igual */ }
  return CACHE;
}

export const aprendizajes = () => CACHE;
export const yaCargado = () => cargado;

// Las lecciones que se le recuerdan al modelo en el siguiente pedido.
// Las más repetidas primero: si algo se corrigió cinco veces, importa más que
// algo que se corrigió una.
// Sólo lo APROBADO para la IA entra al prompt (mandato §6: evidencia, procedencia,
// revisión). Una lección recién anotada por un vendedor queda PENDIENTE hasta que
// Dirección/Diseño la apruebe en "Lo que Voni sabe"; la suya propia tampoco se le
// inyecta: la regla es la misma que la de la base (`aprobado_para_ia`).
export const aprobadas = () => CACHE.filter((a) => a.aprobado_para_ia === true);
export const pendientesDeRevision = () => CACHE.filter((a) => a.aprobado_para_ia !== true);

export function aprendizajesTexto() {
  return aprobadas()
    .slice()
    .sort((a, b) => (b.veces || 1) - (a.veces || 1))
    .slice(0, MAX_EN_PROMPT)
    .map((a) => '· ' + a.texto + ((a.veces || 1) > 1 ? ` (te lo han corregido ${a.veces} veces)` : ''));
}

// ---------------------------------------------------------------------------
//  ANOTAR UNA CORRECCIÓN
//  Si la misma lección ya existe, se le suma una raya en vez de duplicarla: así
//  la repetición se vuelve la señal de qué merece ser regla.
// ---------------------------------------------------------------------------
export async function anotar({ tipo, pedido, propuso, quedo, texto, usuario } = {}) {
  const leccion = String(texto || '').trim();
  if (!leccion) return null;
  try {
    const quien = await quienAnota();
    const email = (usuario || quien?.email || '').trim().toLowerCase();
    if (!email) return null;                       // sin sesión no hay a quién atribuirlo (la RLS lo exige)
    const igual = CACHE.find((a) => a.texto === leccion);
    if (igual) {
      const veces = (igual.veces || 1) + 1;
      const { error } = await nube.from('aprendizajes').update({ veces }).eq('id', igual.id);
      if (!error) igual.veces = veces;
      return igual;
    }
    const fila = {
      tipo: tipo || 'aclaracion',
      pedido: pedido ? String(pedido).slice(0, 4000) : null,
      propuso: propuso || null,
      quedo: quedo || null,
      texto: leccion.slice(0, 600),
      usuario: email,
      // Misma regla que la RLS: Dirección/Diseño anotan aprobado; el vendedor, pendiente.
      aprobado_para_ia: veCostosCosteo(quien?.rol),
    };
    const { data, error } = await nube.from('aprendizajes').insert(fila).select().single();
    if (error) return null;
    CACHE = [data, ...CACHE];
    return data;
  } catch (e) {
    return null;   // aprender nunca puede tumbar una cotización
  }
}

// Dirección/Diseño aprueban una lección pendiente para que entre al prompt.
export async function aprobar(id) {
  try {
    const { error } = await nube.from('aprendizajes').update({ aprobado_para_ia: true }).eq('id', id);
    if (error) return false;
    const a = CACHE.find((x) => x.id === id); if (a) a.aprobado_para_ia = true;
    return true;
  } catch (e) { return false; }
}

// Desactiva una lección (la Dirección la juzgó mala). No se borra: el historial
// de en qué se equivocó Voni vale para saber si de verdad está mejorando.
export async function olvidar(id) {
  try {
    await nube.from('aprendizajes').update({ activo: false }).eq('id', id);
    CACHE = CACHE.filter((a) => a.id !== id);
  } catch (e) { /* nada */ }
}

// Deja constancia de que una lección se volvió regla permanente.
export async function marcarComoRegla(id, claveRegla) {
  try {
    await nube.from('aprendizajes').update({ regla_clave: claveRegla }).eq('id', id);
    const a = CACHE.find((x) => x.id === id);
    if (a) a.regla_clave = claveRegla;
  } catch (e) { /* nada */ }
}

// ---------------------------------------------------------------------------
//  DE UNA CORRECCIÓN A UNA LECCIÓN EN ESPAÑOL
//  Voni no aprende de un diff en JSON: aprende de una frase. Estas dos funciones
//  convierten lo que hizo el vendedor en algo que un modelo puede obedecer y que
//  un humano puede leer en la pantalla "Lo que Voni sabe" y decir "sí" o "no".
// ---------------------------------------------------------------------------
export function leccionDeQuita(partida) {
  const n = partida?.nombre || 'ese mueble';
  return `Cuando el pedido se parezca a éste, NO incluyas "${n}": el vendedor lo quitó de la cotización.`;
}

export function leccionDeCambio(antes, despues) {
  if (!antes || !despues) return '';
  const a = antes.nombre || '', d = despues.nombre || '';
  if (a && d && a !== d) return `Donde propusiste "${a}", el vendedor lo cambió por "${d}". Prefiere el segundo.`;
  if (antes.cantidad !== despues.cantidad) {
    return `En un pedido como éste propusiste ${antes.cantidad} de "${a}" y el vendedor lo dejó en ${despues.cantidad}.`;
  }
  return '';
}
