// ============================================================================
//  SEG-01c rev5 · spec_tecnica_v1 — la definición técnica EXACTA que costeó el motor.
//
//  Dos autoridades separadas (reauditoría final, P0):
//    · promesa_comercial_v1 (promesaComercial.js): ¿qué producto/alcance se le promete al cliente?
//    · spec_tecnica_v1 (este archivo):            ¿qué despiece exacto costeó el servidor?
//  La promesa no distingue "1 × Entrepaño MDF18" de "3 × Entrepaño MDF18" ni un lateral de 700 de uno de 900 (mismos
//  nombres, mismos insumos): la spec sí.
//
//  Entrada: la pieza SANEADA por validarIntentCosteo (lo que de verdad entra al motor: intent.pieza), o la propia
//  spec (idempotente: spec(spec(x)) = spec(x)). Salida: { v:'v1', componentes:[...], horas?, dificultad? } o null.
//  La huella la calcula SÓLO el servidor (SQL, private_api.huella_spec_tecnica) sobre su propia re-proyección; este JS
//  arma el objeto que viaja (Edge → costeos_servidor.spec_tecnica_origen; Costear → partida.especificacion_tecnica).
//  Mismo contrato en SQL (PROPUESTA_seg01c_vinculo_costeo_partida.sql, bloque `spec_v1`), demostrado con las fixtures
//  doradas supabase/tests/fixtures/specTecnicaGolden.json.
//
//  Inventario CAMPO → entra/no entra → por qué: docs/auditoria/SEG01C_REV5_SPEC_TECNICA.md.
//
//  Reglas (idénticas en SQL):
//    · Entra TODO lo que cruza la frontera del DTO (allowlist de validarIntentCosteo) y nada más.
//    · texto: string recortado (espacio, tab, CR, LF); '' = ausente. Otro tipo presente ⇒ fuera de contrato.
//    · número: SÓLO número JSON, finito, ≥ 0, ≤ 2^53−1 y (0 ó ≥ 1e-6). Otro valor presente ⇒ fuera de contrato.
//    · bandera: true = presente; false = ausente; otro tipo ⇒ fuera de contrato.
//    · texto (valores y centros de horas): sólo escalares Unicode válidos y sin U+0000 (lo que jsonb puede guardar);
//      un sustituto UTF-16 suelto o U+0000 ⇒ fuera de contrato (en SQL ni siquiera entra: jsonb lo rechaza).
//    · componentes: arreglo NO vacío de objetos. El ORDEN no cuenta (se ordenan por una clave canónica INYECTIVA: cada
//      campo se escribe con su longitud, `<n>:<valor>`, o `-` si está ausente; ningún contenido puede imitar otro campo,
//      ni siquiera con U+001F); la MULTIPLICIDAD sí: dos renglones idénticos "cantidad 1" ≠ un renglón "cantidad 2"
//      (el motor redondea por renglón: hojas, tramos y mermas; fusionarlos podría esconder una diferencia de costo).
//    · horas: { centro: número } (centro recortado, no vacío, sin repetirse); {} = ausente. Sólo propiedades PROPIAS:
//      `toString`, `constructor`, `__proto__`… son centros como cualquier otro (antes `k in {}` los veía heredados).
//      dificultad: nivel conocido o número 0.25–3.
//    · Fuera de contrato ⇒ null (sin spec no hay vínculo: falla cerrada).
// ============================================================================

export const SPEC_VERSION = 'v1';

// Orden FIJO de la clave canónica (el mismo en SQL). Es exactamente la allowlist del DTO + `pendiente`.
export const SPEC_CAMPOS = [
  'insumoId', 'nombre', 'cantidad', 'piezas', 'largoMM', 'anchoMM', 'hojas', 'areaPintadaM2', 'tubular',
  'material_solicitado', 'material_match', 'material_confirmado', 'engineering_override', 'override_motivo',
  'procedencia', 'pieza_confirmada', 'pendiente',
];
const TEXTO = new Set(['insumoId', 'nombre', 'material_solicitado', 'material_match', 'override_motivo', 'procedencia']);
const NUMERO = new Set(['cantidad', 'piezas', 'largoMM', 'anchoMM', 'hojas', 'areaPintadaM2']);
const BANDERA = new Set(['tubular', 'material_confirmado', 'engineering_override', 'pieza_confirmada', 'pendiente']);
const NIVELES = ['muy_facil', 'facil', 'normal', 'dificil', 'muy_dificil'];
const ESPACIOS = /^[ \t\n\r]+|[ \t\n\r]+$/g;

const FUERA = Symbol('fuera de contrato');
const esObjeto = (x) => x != null && typeof x === 'object' && !Array.isArray(x);
const presente = (x) => x !== undefined && x !== null;
// Sólo propiedades PROPIAS (como `->` en jsonb): nada heredado de Object.prototype.
const propio = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
// Texto que jsonb puede guardar: sin U+0000 y sin sustitutos UTF-16 sueltos.
const SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|\u0000/;
export const textoValido = (x) => typeof x === 'string' && !SUELTO.test(x);
const texto = (x) => (textoValido(x) ? (x.replace(ESPACIOS, '') || null) : FUERA);
// Dominio numérico del contrato: dentro de él, JS (String(n)) y SQL (trim_scale(n)::text) escriben el mismo texto.
export const enDominio = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER && (n === 0 || n >= 1e-6);
const numero = (x) => (enDominio(x) ? x : FUERA);
const bandera = (x) => (x === true ? true : x === false ? null : FUERA);

function porPuntoDeCodigo(a, b) {
  const A = [...a]; const B = [...b];
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    const d = A[i].codePointAt(0) - B[i].codePointAt(0);
    if (d !== 0) return d;
  }
  return A.length - B.length;
}

function componente(c) {
  if (!esObjeto(c)) return FUERA;
  const o = {};
  for (const k of SPEC_CAMPOS) {
    const x = propio(c, k);
    if (!presente(x)) continue;
    const v = TEXTO.has(k) ? texto(x) : NUMERO.has(k) ? numero(x) : bandera(x);
    if (v === FUERA) return FUERA;
    if (v !== null) o[k] = v;
  }
  return o;
}

// Clave de orden INYECTIVA (igual en SQL): por cada campo de SPEC_CAMPOS, en orden fijo, `-` si está ausente o
// `<longitud en puntos de código>:<valor>` si está presente. La longitud delimita el valor: ningún contenido (U+001F,
// `|`, `=`, `:`, saltos de línea, emoji) puede hacerse pasar por otro campo. Claves iguales ⇔ componentes iguales, así que
// el orden de entrada nunca cambia el resultado. (rev5 unía `campo=valor` con U+001F: un `nombre` con U+001F chocaba.)
const largo = (s) => [...s].length;
export function claveComponente(o) {
  return SPEC_CAMPOS.map((k) => {
    if (!Object.prototype.hasOwnProperty.call(o, k)) return '-';
    const s = String(o[k]);
    return `${largo(s)}:${s}`;
  }).join('');
}

/**
 * spec_tecnica_v1 de una pieza saneada (o de una spec). Pura y determinista.
 * @param {object} pieza  { componentes:[...], horas?, dificultad? }
 * @returns {object|null}
 */
export function specTecnicaDeCosteo(pieza) {
  if (!esObjeto(pieza)) return null;
  const componentes = propio(pieza, 'componentes');
  if (!Array.isArray(componentes) || componentes.length === 0) return null;
  const comps = [];
  for (const c of componentes) {
    const o = componente(c);
    if (o === FUERA) return null;
    comps.push(o);
  }
  comps.sort((a, b) => porPuntoDeCodigo(claveComponente(a), claveComponente(b)));
  const spec = { v: SPEC_VERSION, componentes: comps };
  const horasIn = propio(pieza, 'horas');
  if (presente(horasIn)) {
    if (!esObjeto(horasIn)) return null;
    // Sin prototipo: `toString`, `constructor`, `__proto__`… son claves de datos, igual que en jsonb.
    const horas = Object.create(null);
    for (const centro of Object.keys(horasIn)) {
      const h = horasIn[centro];
      if (!textoValido(centro)) return null;
      const k = centro.replace(ESPACIOS, '');
      if (!k || Object.prototype.hasOwnProperty.call(horas, k) || !enDominio(h)) return null;   // vacío, repetido o fuera de dominio
      horas[k] = h;
    }
    if (Object.keys(horas).length) spec.horas = horas;
  }
  const d = propio(pieza, 'dificultad');
  if (presente(d)) {
    if (typeof d === 'string' && NIVELES.includes(d)) spec.dificultad = d;
    else if (typeof d === 'number' && Number.isFinite(d) && d >= 0.25 && d <= 3) spec.dificultad = d;
    else return null;
  }
  return spec;
}
