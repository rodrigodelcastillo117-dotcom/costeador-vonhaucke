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
  return Array.from({ length: enteros }, (_, i) => ({
    nombre: enteros === 1 ? `Mi espacio (${m2} m²)` : `Piso ${i + 1} (${m2} m²)`,
    ancho, largo, m2,
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
