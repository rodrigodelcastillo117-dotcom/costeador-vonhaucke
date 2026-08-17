// ============================================================================
//  DE CUÁNTOS M² ESTAMOS HABLANDO  ·  el arranque de un proyecto sin plano.
//
//  Rodrigo, 2026-08-17: "que primero sea REALMENTE el plano que quieres; si no
//  hay, que mínimo pregunte cuántos m². Normalmente son de 50, 100, 200, 400 y
//  así hasta 2000. Y ¿qué pasa si son 2 o 3 pisos? ¿O medio piso?"
//
//  Antes la app NO preguntaba: se inventaba un rectángulo del tamaño justo de
//  los muebles ("Mi espacio 13 × 14.03 m") y acomodaba encima. Un número que
//  nadie escribió, con dos decimales, es lo que hace que una propuesta se lea
//  como adivinada. Aquí no se inventa: se pregunta.
// ============================================================================

// Los tamaños con los que de verdad se habla en una llamada de venta.
export const M2_TIPICOS = [50, 100, 200, 400, 600, 800, 1200, 2000];
export const M2_MIN = 20;
export const M2_MAX = 5000;

// Proporción de una planta de oficina real: más larga que ancha, no un cuadrado.
const PROPORCION = 1.5;

export const limpiaM2 = (v) => Math.min(M2_MAX, Math.max(M2_MIN, Math.round(Number(v) || 0)));

/** Ancho × largo (en metros) de una planta de `m2`, redondeado a 10 cm. */
export function ladosDe(m2) {
  const s = limpiaM2(m2);
  const ancho = Math.sqrt(s * PROPORCION);
  return { ancho: Math.round(ancho * 10) / 10, largo: Math.round((s / ancho) * 10) / 10 };
}

/**
 * Las ÁREAS de un proyecto descrito por m² y pisos.
 *
 * `pisos` acepta **0.5**: medio piso es un caso real —el cliente renta la mitad
 * de una planta de la torre— y no es lo mismo que un piso chico, porque el
 * vecino de junto pone un muro. Medio piso se modela como UNA planta de la
 * mitad de los m², y se dice en el nombre para que el proyectista lo vea.
 *
 * @param {number} m2PorPiso  metros cuadrados de CADA piso
 * @param {number} pisos      0.5, 1, 2, 3…
 * @returns {Array} áreas en METROS, listas para el editor de siempre
 */
export function areasDeM2(m2PorPiso, pisos = 1) {
  const n = Number(pisos) || 1;
  if (n <= 0.5) {
    const m2 = limpiaM2(m2PorPiso / 2);
    return [{ nombre: `Medio piso (${m2} m²)`, ...ladosDe(m2), m2 }];
  }
  const enteros = Math.max(1, Math.round(n));
  const m2 = limpiaM2(m2PorPiso);
  const { ancho, largo } = ladosDe(m2);
  // `nivel` es lo que hace que el 3D los APILE en vez de acostarlos uno junto a
  // otro. Con un solo piso no se pone: no hay torre que dibujar.
  return Array.from({ length: enteros }, (_, i) => ({
    nombre: enteros === 1 ? `Mi espacio (${m2} m²)` : `Piso ${i + 1} (${m2} m²)`,
    ancho, largo, m2,
    ...(enteros > 1 ? { nivel: i } : {}),
  }));
}

/** Total del proyecto, para enseñarlo mientras se elige. */
export const totalM2 = (m2PorPiso, pisos) => (
  Number(pisos) <= 0.5 ? limpiaM2(m2PorPiso / 2) : limpiaM2(m2PorPiso) * Math.max(1, Math.round(Number(pisos) || 1))
);

/**
 * Los m² que de verdad ocupa lo cotizado, con su circulación. Sirve para
 * avisar —sin bloquear— cuando el espacio que escribió no le va a alcanzar:
 * mejor decirlo antes de mandar la propuesta que después.
 * Se usa ~35% de ocupación, que es lo que da una oficina que se puede caminar.
 */
export function m2QueNecesita(piezas) {
  const foot = piezas.reduce((s, p) => s + (p.w || 1000) * (p.d || 700), 0) / 1e6;  // m²
  return Math.ceil(foot / 0.35);
}


// ============================================================================
//  DEL PROGRAMA A LOS CUARTOS
//
//  Rodrigo: "¿espacio incluye cuántos privados, cuántas salas de juntas?".
//  Sí, y ahí va la respuesta: un privado ES UN CUARTO —tiene muros, tiene
//  metros, es parte del plano—; un operativo es una PERSONA, ocupa un pedazo
//  del open space. Prueba de que va aquí: si subes el plano real, los privados
//  vienen del plano, no los tecleas.
//
//  ⚠️ ESTO ARREGLA ALGO GRANDE. Hasta hoy, decir "400 m²" creaba UN SOLO
//  RECTÁNGULO, y por eso el 3D se veía como una bodega: no había cuartos, había
//  un galerón. Con los cuartos de verdad, el acomodo tiene dónde repartir, las
//  reglas de oficio funcionan (las sillas de visita a los privados, la gaveta
//  con su escritorio), el 3D se ve como una oficina y el render tiene cuartos
//  que fotografiar. Un cambio, cuatro cosas.
// ============================================================================

// Medidas de oficio, para no preguntar lo que se puede proponer.
export const M2_PRIVADO = 12;              // oficina cerrada de un directivo
export const M2_POR_PAX_JUNTAS = 2.5;      // mesa + silla + paso, por persona
export const M2_RECEPCION = 15;
export const M2_BREAK = 20;

export const m2Juntas = (pax) => Math.max(12, Math.round((pax || 0) * M2_POR_PAX_JUNTAS));

/**
 * Las ÁREAS de un piso a partir del programa. Lo que sobra después de los
 * cuartos cerrados es el OPEN SPACE, que es donde van los operativos.
 * @returns {{areas: Array, openM2: number, cerradoM2: number}}
 */
export function cuartosDePrograma({
  m2 = 200, privados = 0, m2Privado = M2_PRIVADO,
  juntas = 0, paxJuntas = 12, recepcion = false, breakRoom = false,
} = {}) {
  const total = limpiaM2(m2);
  const areas = [];
  const conMedida = (nombre, metros) => {
    const m = Math.max(4, Math.round(metros));
    areas.push({ nombre, ...ladosDe(m), m2: m });
  };

  const mJuntas = m2Juntas(paxJuntas);
  const cerrado = privados * m2Privado + juntas * mJuntas
    + (recepcion ? M2_RECEPCION : 0) + (breakRoom ? M2_BREAK : 0);
  // Lo que queda para trabajar. Si los cuartos se comieron todo, se avisa
  // arriba (en la pantalla) en vez de inventar un open space de 0.
  const open = Math.max(0, total - cerrado);

  if (open >= 6) conMedida(`Open space (${Math.round(open)} m²)`, open);
  for (let i = 0; i < privados; i++) conMedida(`Privado ${i + 1}`, m2Privado);
  for (let i = 0; i < juntas; i++) {
    conMedida(juntas === 1 ? `Sala de juntas (${paxJuntas} personas)` : `Sala de juntas ${i + 1} (${paxJuntas} personas)`, mJuntas);
  }
  if (recepcion) conMedida('Recepción', M2_RECEPCION);
  if (breakRoom) conMedida('Break room', M2_BREAK);

  // Sin nada, al menos el espacio completo: nunca se devuelve vacío.
  if (!areas.length) conMedida(`Mi espacio (${total} m²)`, total);
  return { areas, openM2: open, cerradoM2: cerrado };
}
