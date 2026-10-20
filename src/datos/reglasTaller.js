// ============================================================================
//  REGLAS DE CASA (taller Von Haucke) · propuesta del 2026-10-12 aprobada por Dirección
//  ("si tú recomiendas que lleve, ponlo"; "siempre es el mismo canto"; "todo es visible";
//  "lleva pintura electro"; "los herrajes vienen en la lista de compras"; "sí autorizo que
//  la IA amarre"). Son DEFAULTS deterministas, visibles en pantalla y editables pieza por
//  pieza; ninguna inventa precio (el precio sale del catálogo) ni oculta un supuesto: cada
//  partida que nace de una regla lleva `_regla` con la regla y el cálculo.
// ============================================================================

export const REGLAS_TALLER = Object.freeze({
  version: 'casa-2026-10-12',
  origen: 'Propuesta del 12-oct-2026 aprobada por Dirección; cada regla es editable.',
  // Tapacanto: "siempre es el mismo canto" → el insumo estándar del catálogo; el color iguala
  // el acabado. Cantos VISIBLES por rol de pieza ("todo es visible" salvo lo que da a la pared
  // o al interior): cuántos lados del rectángulo llevan canto.
  canto: Object.freeze({
    insumoIdEstandar: 'tapacanto',
    ladosPorRol: Object.freeze({ cubierta: 4, puerta: 4, frente_cajon: 4, faldon: 4, costado: 2, entrepano: 1, gaveta: 0, respaldo: 0, fondo: 0, otro: 1 }),
  }),
  // Acero: todo el acero visible lleva pintura electrostática (línea aparte; el PTR y la
  // lámina van crudos). Perímetro del perfil cuando no se declara: 1" × 1".
  acero: Object.freeze({
    pinturaSiempre: true,
    perfilDefaultMM: Object.freeze({ a: 25.4, b: 25.4 }),
    pinturaSolicitada: 'Pintura electrostática en polvo',
    carasLamina: 2,
  }),
  // Niveladores: 4 por módulo apoyado en base/zoclo/patas.
  niveladores: Object.freeze({ porModulo: 4, solicitado: 'Nivelador' }),
  // Zoclo: en gabinete bajo sin base/patas se recomienda (durabilidad y vista), 100 mm.
  // VH-169: "gabinete BAJO" = costado de hasta 1100 mm (credenza, gabinete bajo). Un librero o gabinete alto no recibe zoclo solo.
  // Cierre v3 (cocrear-5): un zoclo más largo que la hoja se corta en tramos iguales de hasta 2400 mm (hoja 2440 − corte).
  zoclo: Object.freeze({ altoMM: 100, gabineteBajoMaxMM: 1100, tramoMaxMM: 2400 }),
  // Refuerzo: entrepaño/repisa con claro ≥ 800 mm → recomendar travesaño trasero (por coherencia
  // con la carga que irá en el estante; no se agrega solo).
  refuerzo: Object.freeze({ claroMM: 800 }),
  // Respaldo/fondo: más de 12 mm suele ser sobre-espesor (se avisa; no se cambia solo).
  respaldo: Object.freeze({ espesorMaxMM: 12 }),
  // Herrajes: ante varios candidatos del catálogo sin variante pedida, el genérico es el de casa.
  herrajes: Object.freeze({ preferirGenerico: true }),
});

/** Lados con canto para un rol de pieza (ver `rolDe` en revisionEstructural). */
export function ladosConCanto(rol) {
  const t = REGLAS_TALLER.canto.ladosPorRol;
  return Object.prototype.hasOwnProperty.call(t, rol) ? t[rol] : t.otro;
}

/**
 * Metros de canto de una pieza rectangular según sus lados visibles.
 * 4 lados = perímetro; 2 = un largo + un ancho (frente y canto superior del costado);
 * 1 = el largo (frente del entrepaño). Devuelve metros (no mm).
 */
export function metrosDeCanto({ largoMM, anchoMM, piezas = 1, rol = 'otro' }) {
  const l = Number(largoMM) / 1000, a = Number(anchoMM) / 1000, n = Math.max(1, Number(piezas) || 1);
  if (!(l > 0) || !(a > 0)) return 0;
  const lados = ladosConCanto(rol);
  const m = lados >= 4 ? 2 * (l + a) : lados === 3 ? 2 * l + a : lados === 2 ? l + a : lados === 1 ? l : 0;
  return m * n;
}

const PULG = 25.4;
function pulgadasANumero(txt) {
  // "1 1/2" → 1.5 · "1/2" → 0.5 · "2" → 2
  const t = String(txt).trim();
  const mix = t.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (mix) return Number(mix[1]) + Number(mix[2]) / Number(mix[3]);
  const fr = t.match(/^(\d+)\/(\d+)$/); if (fr) return Number(fr[1]) / Number(fr[2]);
  const n = Number(t.replace(',', '.')); return Number.isFinite(n) ? n : null;
}

/**
 * Perímetro (mm por metro lineal) del perfil de un tubo/PTR a partir del texto
 * ("PTR 1\"x2\" cal. 14", "tubo 1 1/2\"", "PTR 38x38"). Sin perfil declarado → 1"×1" y
 * `declarado:false` para que la pantalla lo diga.
 */
export function perimetroPerfilMM(texto = '') {
  const t = String(texto || '');
  const inch = t.match(/(\d+(?:\s+\d+\/\d+|\/\d+)?)\s*["”]\s*(?:x|×)\s*(\d+(?:\s+\d+\/\d+|\/\d+)?)\s*["”]/i);
  if (inch) { const a = pulgadasANumero(inch[1]), b = pulgadasANumero(inch[2]); if (a && b) return { mm: 2 * (a + b) * PULG, declarado: true, perfil: `${inch[1]}" × ${inch[2]}"` }; }
  const inch1 = t.match(/(\d+(?:\s+\d+\/\d+|\/\d+)?)\s*["”]/);
  // VH-164b: el tubo REDONDO tiene perímetro π·d, no 4·d (antes salía +27 % de área a pintar).
  const redondo = /redond|circular|\bround\b|ø|diám/i.test(t);
  if (inch1) { const a = pulgadasANumero(inch1[1]); if (a) return redondo ? { mm: Math.PI * a * PULG, declarado: true, perfil: `Ø${inch1[1]}"` } : { mm: 4 * a * PULG, declarado: true, perfil: `${inch1[1]}" × ${inch1[1]}"` }; }
  const mm2 = t.match(/(\d{2,3})\s*(?:x|×)\s*(\d{2,3})\s*(?:mm)?\b/i);
  if (mm2) { const a = Number(mm2[1]), b = Number(mm2[2]); if (a >= 10 && b >= 10 && a <= 200 && b <= 200) return { mm: 2 * (a + b), declarado: true, perfil: `${a} × ${b} mm` }; }
  const d = REGLAS_TALLER.acero.perfilDefaultMM;
  return { mm: 2 * (d.a + d.b), declarado: false, perfil: '1" × 1" (supuesto de casa)' };
}

/** m² a pintar de un tubo/PTR: metros × perímetro del perfil. */
export function areaPintadaTubularM2(metros, texto = '') {
  const m = Number(metros); if (!(m > 0)) return { m2: 0, ...perimetroPerfilMM(texto) };
  const p = perimetroPerfilMM(texto);
  return { m2: m * (p.mm / 1000), ...p };
}
