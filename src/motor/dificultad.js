// ============================================================================
//  DIFICULTAD sobre la fórmula Alba V1 (Dirección, 2026-10-13)
//  "Con % cada uno, pero si es un mueble más difícil que suba, más fácil baja… que se pueda por horas
//  y por %, que den lo mismo en ambos valores, que vayan de la mano."
//
//  La fórmula Alba (formulaAlba.js) es NÚCLEO PROTEGIDO y no se toca: aquí sólo se ESCALA su resultado.
//  La dificultad multiplica la MO de Alba y, con ella, los indirectos (3×MO). En cristal/compra-venta
//  los indirectos son 5 % fijo del material: la dificultad sólo mueve su MO.
//
//  Niveles calibrados con 15 piezas reales del cotizador ERP (lab/applt/componentes), comparando el %
//  de Alba contra horas estándar × MO real por área + indirectos UNA vez (tarifa de planta):
//    cubiertas 1500/1800 y faldones (material caro, poco trabajo) ≈ 0.4–0.6 → MUY FÁCIL
//    omega ATOM4 ≈ 0.7 → FÁCIL · cubierta 1200 y omega ATOM3 ≈ 0.9 → NORMAL
//    patas U ≈ 1.2–1.4 → DIFÍCIL · acometida ATACM (mucho trabajo, poco material) ≈ 1.7 → MUY DIFÍCIL
//  Por omisión NORMAL (×1) = exactamente la fórmula de siempre.
// ============================================================================
import { costoAlba } from './formulaAlba.js';

export const DIFICULTAD = Object.freeze({ muy_facil: 0.5, facil: 0.75, normal: 1, dificil: 1.3, muy_dificil: 1.6 });

/** Nivel ('facil'…) o número → multiplicador acotado [0.25, 3]. Ausente o basura → 1 (normal), nunca NaN. */
export function factorDificultad(d) {
  const v = typeof d === 'string' ? DIFICULTAD[d] : Number(d);
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.min(3, Math.max(0.25, v));
}

// NOVEDAD / PRIMERA VEZ (2026-11-12 · PROVISIONAL, pendiente de calibrar con 3–5 trabajos bespoke reales:
// horas de la 1ª vez vs sus horas estándar después, igual que las tarifas de cristal quedaron provisionales).
// Un mueble nunca hecho lleva MÁS tiempo la primera vez (setup, programar máquina, entenderla, reprocesos del
// 1er intento). Es un eje DISTINTO de la dificultad: la dificultad mide "esta pieza tiene mucho trabajo"
// (calibrada contra horas estándar de piezas CONOCIDAS); la novedad agrega SOLO la rebanada de "primera vez".
// Valores moderados a propósito: VH es taller experto (lo nuevo suele ser variación) y la dificultad ya cobra
// lo complejo — la novedad NO re-cobra la dificultad. Default `conocido` (×1) = exactamente la cuenta de siempre.
export const NOVEDAD = Object.freeze({ conocido: 1, primera_vez: 1.15, nuevo: 1.35, muy_nuevo: 1.6 });

/** Nivel ('primera_vez'…) o número → multiplicador acotado [1, 2]. La novedad NUNCA abarata (≥1).
 *  Ausente o basura → 1 (conocido), nunca NaN. */
export function factorNovedad(n) {
  const v = typeof n === 'string' ? NOVEDAD[n] : Number(n);
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.min(2, Math.max(1, v));
}

const giFijo = (tipo) => tipo === 'cristal' || tipo === 'compraventa';

/** costoAlba × dificultad × novedad. Con dificultad y novedad normales devuelve EXACTAMENTE lo mismo que
 *  costoAlba. La novedad escala la MANO DE OBRA igual que la dificultad (es más TRABAJO la primera vez),
 *  NUNCA el material. `dificultad` y `novedad` se reportan por separado; lo que se aplica es su producto. */
export function costoAlbaDificultad(material, tipo = 'general', dificultad = 1, novedad = 1) {
  const base = costoAlba(material, tipo);
  const fd = factorDificultad(dificultad), fn = factorNovedad(novedad);
  const f = fd * fn;
  if (f === 1) return { ...base, dificultad: 1, novedad: 1 };
  const mo = base.mo * f;
  const gi = giFijo(tipo) ? base.gi : base.gi * f;
  return { ...base, mo, gi, fab: base.material + mo + gi, dificultad: fd, novedad: fn };
}

/** Tarifas de planta (regla de Dirección): MO real por área y UN solo indirecto de planta por hora. */
export const TARIFAS_PLANTA = Object.freeze({
  mo: Object.freeze({ pm: 92.38, carpinteria: 82.61, acabados: 74.99, pintura: 371.30 }),
  indirectoHora: 82.374303,   // 1 / Σ(1/ind_área) del pedido 38247: el gasto de planta contado UNA vez
});

/** Costo de fabricación POR HORAS con la regla de Dirección. horas = { pm, carpinteria, acabados, pintura }.
 *  Auditoría externa 2026-10-13: un área SIN dato (ausente, null, '' o no numérica) contaba como 0 h en silencio.
 *  Ahora se suma igual (subtotal), pero se reporta en `faltan` y `completo:false`: quien lo use como costo debe
 *  tratarlo como incompleto. Un 0 EXPLÍCITO sí es dato (pieza de metal sin carpintería). */
export function costoPorHoras(material, horas = {}, t = TARIFAS_PLANTA, novedad = 1) {
  const mat = Number(material) || 0;
  const fn = factorNovedad(novedad);   // 1ª vez = más HORAS → más MO y más indirectos (tiempo de planta)
  let mo = 0, h = 0; const faltan = [];
  for (const [area, tarifa] of Object.entries(t.mo)) {
    const v = horas?.[area]; const x = v === null || v === undefined || v === '' ? NaN : Number(v);
    if (!Number.isFinite(x) || x < 0) { faltan.push(area); continue; }
    const hx = x * fn;
    mo += hx * tarifa; h += hx;
  }
  const gi = h * t.indirectoHora;
  return { material: mat, mo, gi, fab: mat + mo + gi, horas: h, faltan, completo: faltan.length === 0, novedad: fn };
}

/** La dificultad con la que el % de Alba da EXACTAMENTE el costo por horas (sin acotar: un valor fuera de
 *  0.25–3 delata un dato de horas incompleto). null si no hay material. */
export function dificultadEquivalente(material, tipo, horas, t = TARIFAS_PLANTA) {
  const mat = Number(material) || 0;
  if (!(mat > 0)) return null;
  const objetivo = costoPorHoras(mat, horas, t).fab - mat;   // MO + GI por horas
  const base = costoAlba(mat, tipo);
  const fijo = giFijo(tipo) ? base.gi : 0;
  const variable = base.mo + (base.gi - fijo);               // lo que escala con la dificultad
  return variable > 0 ? Math.max(0, (objetivo - fijo) / variable) : null;
}

/** Nivel más cercano a un multiplicador (para decirlo en palabras). */
export function nivelDificultad(f) {
  let mejor = 'normal', d = Infinity;
  for (const [k, v] of Object.entries(DIFICULTAD)) if (Math.abs(v - f) < d) { d = Math.abs(v - f); mejor = k; }
  return mejor;
}
