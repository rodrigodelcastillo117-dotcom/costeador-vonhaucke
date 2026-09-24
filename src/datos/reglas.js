// ============================================================================
//  LO QUE VONI SABE  ·  las reglas de oficio de Von Haucke, en un solo lugar.
//
//  Rodrigo (2026-08-16): "crea un sistema para que VONI APRENDA con cada uno de
//  los planos o cosas que subamos... que cada cosa le ayude, recuerde, guarde
//  en backend, y en caso de necesitarlo lo recuerde y use. Esto es para todo."
//
//  CÓMO FUNCIONA. Cada regla sirve para dos cosas a la vez:
//   · si trae `clave` y `valor`, es un NÚMERO que el motor aplica solo
//     (circulación mínima, sillas de visita por privado, margen mínimo…);
//   · su `texto` se le manda al modelo en los prompts de su ámbito, para lo
//     que no cabe en un número ("los escritorios ven a la puerta").
//
//  POR QUÉ ASÍ. Una regla escrita dentro del prompt de un archivo se pierde:
//  nadie la vuelve a abrir y nadie sabe que existe. Aquí Rodrigo la dicta una
//  vez, queda en la base, se ve en pantalla, se puede corregir, y el motor y el
//  modelo la usan sin que nadie se acuerde de copiarla.
//
//  Los VALORES POR OMISIÓN de abajo son la red: si la base no responde (sin
//  internet, o antes de que cargue), el motor sigue costeando con los mismos
//  números en vez de inventarse otros.
// ============================================================================
import { nube } from '../nube.js';

export const REGLAS_DEFAULT = {
  circulacion_min: 900,        // mm libres para que pase una persona
  pasillo_principal: 1200,     // mm: por ahí se cruzan dos
  barrido_puerta: 900,         // mm libres delante de una puerta
  holgura_juntas: 900,         // mm alrededor de la mesa, para las sillas
  holgura_guarda: 600,         // mm para abrir cajones
  escritorio_ve_a_puerta: 1,
  l_contra_muro: 1,
  sillas_visita_privado: 2,
  descuento_precio2: 40,
  margen_min: 25,
};

// Caché en memoria: el motor consulta esto en caliente, dentro de bucles.
let VIGENTES = { ...REGLAS_DEFAULT };
let TEXTOS = [];

// Número de una regla. Si la base no la trae, el valor por omisión.
export const regla = (clave) => (VIGENTES[clave] ?? REGLAS_DEFAULT[clave]);

// Las reglas de un ámbito, en texto, para inyectarlas en un prompt.
export const reglasTexto = (ambito) => TEXTOS
  .filter((r) => r.ambito === ambito || r.ambito === 'general')
  .map((r) => '· ' + r.texto);

export const todasLasReglas = () => TEXTOS;

export async function cargarReglas() {
  try {
    const { data, error } = await nube.from('reglas').select('*').eq('activa', true).order('ambito');
    if (error || !data) return VIGENTES;
    TEXTOS = data;
    const v = { ...REGLAS_DEFAULT };
    for (const r of data) if (r.clave && r.valor != null) v[r.clave] = Number(r.valor);
    VIGENTES = v;
  } catch (e) { /* sin conexión: se quedan los valores por omisión */ }
  return VIGENTES;
}

export async function guardarRegla(r) {
  const fila = {
    ambito: r.ambito || 'general',
    texto: r.texto,
    clave: r.clave || null,
    valor: r.valor === '' || r.valor == null ? null : Number(r.valor),
    unidad: r.unidad || null,
    origen: r.origen || 'rodrigo',
    fuente: r.fuente || null,
    activa: r.activa !== false,
    actualizada: new Date().toISOString(),
  };
  const q = r.id
    ? nube.from('reglas').update(fila).eq('id', r.id).select()
    : nube.from('reglas').insert(fila).select();
  const { data, error } = await q;
  if (error) throw error;
  await cargarReglas();
  return data?.[0] || null;
}

export async function borrarRegla(id) {
  const { error } = await nube.from('reglas').delete().eq('id', id);
  if (error) throw error;
  await cargarReglas();
}
