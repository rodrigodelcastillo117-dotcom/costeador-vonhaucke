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
//    · componentes: arreglo NO vacío de objetos. El ORDEN no cuenta (se ordenan por una clave canónica); la
//      MULTIPLICIDAD sí: dos renglones idénticos "cantidad 1" ≠ un renglón "cantidad 2" (el motor redondea por renglón:
//      hojas, tramos y mermas; fusionarlos podría esconder una diferencia de costo; a lo sumo obliga a recostear).
//    · horas: { centro: número } (centro recortado, no vacío, sin repetirse); {} = ausente. dificultad: nivel conocido o número 0.25–3.
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
const texto = (x) => (typeof x === 'string' ? (x.replace(ESPACIOS, '') || null) : FUERA);
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
    if (!presente(c[k])) continue;
    const v = TEXTO.has(k) ? texto(c[k]) : NUMERO.has(k) ? numero(c[k]) : bandera(c[k]);
    if (v === FUERA) return FUERA;
    if (v !== null) o[k] = v;
  }
  return o;
}

// Clave de orden: "campo=valor" de los campos presentes, en el orden fijo, separados por U+001F (igual en SQL).
export function claveComponente(o) {
  return SPEC_CAMPOS.filter((k) => k in o).map((k) => `${k}=${String(o[k])}`).join('\u001f');
}

/**
 * spec_tecnica_v1 de una pieza saneada (o de una spec). Pura y determinista.
 * @param {object} pieza  { componentes:[...], horas?, dificultad? }
 * @returns {object|null}
 */
export function specTecnicaDeCosteo(pieza) {
  if (!esObjeto(pieza) || !Array.isArray(pieza.componentes) || pieza.componentes.length === 0) return null;
  const comps = [];
  for (const c of pieza.componentes) {
    const o = componente(c);
    if (o === FUERA) return null;
    comps.push(o);
  }
  comps.sort((a, b) => porPuntoDeCodigo(claveComponente(a), claveComponente(b)));
  const spec = { v: SPEC_VERSION, componentes: comps };
  if (presente(pieza.horas)) {
    if (!esObjeto(pieza.horas)) return null;
    const horas = {};
    for (const [centro, h] of Object.entries(pieza.horas)) {
      const k = centro.replace(ESPACIOS, '');
      if (!k || k in horas || !enDominio(h)) return null;   // centro vacío, repetido tras recortar o fuera de dominio
      horas[k] = h;
    }
    if (Object.keys(horas).length) spec.horas = horas;
  }
  if (presente(pieza.dificultad)) {
    const d = pieza.dificultad;
    if (typeof d === 'string' && NIVELES.includes(d)) spec.dificultad = d;
    else if (typeof d === 'number' && Number.isFinite(d) && d >= 0.25 && d <= 3) spec.dificultad = d;
    else return null;
  }
  return spec;
}
