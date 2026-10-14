// ============================================================================
//  SEG-01c rev4 · promesa_comercial_v1 — lo que una partida PROMETE al cliente (qué se fabrica y se entrega).
//
//  Una sola definición conceptual con DOS implementaciones que deben dar EXACTAMENTE lo mismo:
//    · JS:  promesaComercialDeCosteo(x)      (este archivo; cliente y Edge costear-servidor-rc)
//    · SQL: private_api.promesa_partida(p)   (PROPUESTA_seg01c_vinculo_costeo_partida.sql)
//  Las fixtures doradas de supabase/tests/fixtures/promesaComercialGolden.json se corren contra ambas
//  (src/datos/promesaComercial.test.js y supabase/tests/seg01cVinculoCosteo.test.js).
//
//  Entrada: una partida (cotizaciones.partidas[]), un costeo del Costeador o la propia promesa (es idempotente:
//  promesa(promesa(x)) = promesa(x)). Salida: objeto con las MISMAS claves que la partida, sin nulos:
//    { v:'v1', nombre, w, d, h, medidas, material, acabado, descripcion, usuarios, config, catalogo:{clave},
//      producto_id, producto_version_id, productoId, claveLinea, materiales[], piezas[], nombresExcluidos[] }
//
//  Inventario de campos (CAMPO → entra/no entra → razón): docs/auditoria/SEG01C_REV4_PROMESA_COMERCIAL.md.
//
//  Reglas de normalización (idénticas en SQL):
//    · texto: sólo si es string; se recortan espacios, tab, CR y LF de los extremos; '' = ausente.
//    · número: número JSON o texto con dígitos (^[0-9]+(\.[0-9]+)?$); 120 = 120.0 = "120". Otro tipo = ausente.
//    · identificadores (producto_id, …): texto recortado; un número se escribe como número ("12").
//    · config: el objeto tal cual, sin campos nulos (a cualquier profundidad); {} = ausente.
//    · listas (materiales, piezas, nombresExcluidos): texto recortado, sin vacíos, sin repetidos y en orden de
//      punto de código (= COLLATE "C" en SQL); [] = ausente.
//    · materiales = insumoId de TODO el despiece (componentes y pieza.componentes) ∪ `materiales`.
//    · nombresExcluidos = `nombresExcluidos` ∪ nombre de cada componente con excluida === true
//      (sin nombre: 'Partida excluida', como el motor).
//    · piezas = nombre de cada componente ∪ `piezas`, MENOS los nombres excluidos.
//      (El servidor no recibe la bandera `excluida`: por eso la resta es por nombre, igual en ambos lados.)
// ============================================================================

export const PROMESA_VERSION = 'v1';

const ESPACIOS = /^[ \t\n\r]+|[ \t\n\r]+$/g;
const NUMERO_TEXTO = /^[0-9]+(\.[0-9]+)?$/;

const esObjeto = (x) => x != null && typeof x === 'object' && !Array.isArray(x);
const texto = (x) => {
  if (typeof x !== 'string') return null;
  const t = x.replace(ESPACIOS, '');
  return t === '' ? null : t;
};
const numero = (x) => {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  const t = texto(x);
  return t != null && NUMERO_TEXTO.test(t) ? Number(t) : null;
};
const ident = (x) => {
  if (typeof x === 'number') return Number.isFinite(x) ? String(x) : null;
  return texto(x);
};
// Primer valor no nulo (JSON null también cuenta como ausente, como nullif(…, 'null') en SQL).
const primero = (...xs) => xs.find((x) => x !== undefined && x !== null) ?? null;

// Orden por punto de código (UTF-8 byte a byte = COLLATE "C"). El < de JS compara unidades UTF-16.
function porPuntoDeCodigo(a, b) {
  const A = [...a];
  const B = [...b];
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    const d = A[i].codePointAt(0) - B[i].codePointAt(0);
    if (d !== 0) return d;
  }
  return A.length - B.length;
}
const lista = (xs) => {
  const s = [...new Set(xs.map(texto).filter((t) => t != null))].sort(porPuntoDeCodigo);
  return s.length ? s : null;
};
const textos = (x) => (Array.isArray(x) ? x : []);

// jsonb_strip_nulls: quita los campos nulos de objetos a cualquier profundidad (también dentro de arreglos);
// los nulos que son elementos de un arreglo se quedan.
function sinNulos(x) {
  if (Array.isArray(x)) return x.map(sinNulos);
  if (esObjeto(x)) {
    const o = {};
    for (const [k, v] of Object.entries(x)) if (v !== null && v !== undefined) o[k] = sinNulos(v);
    return o;
  }
  return x;
}

function componentes(x) {
  const de = (arr) => (Array.isArray(arr) ? arr.filter(esObjeto) : []);
  return [...de(x.componentes), ...(esObjeto(x.pieza) ? de(x.pieza.componentes) : [])];
}

/**
 * Promesa comercial v1 de una partida / costeo. Pura y determinista.
 * @param {object} x
 * @returns {object|null}  null si `x` no es un objeto
 */
export function promesaComercialDeCosteo(x) {
  if (!esObjeto(x)) return null;
  const comps = componentes(x);
  const excluidas = lista([
    ...textos(x.nombresExcluidos),
    ...comps.filter((c) => c.excluida === true).map((c) => texto(c.nombre) ?? 'Partida excluida'),
  ]);
  const fuera = new Set(excluidas ?? []);
  const piezas = (lista([...textos(x.piezas), ...comps.map((c) => c.nombre)]) ?? []).filter((n) => !fuera.has(n));
  const config = esObjeto(x.config) ? sinNulos(x.config) : null;
  const clave = esObjeto(x.catalogo) ? texto(x.catalogo.clave) : null;
  const p = {
    v: PROMESA_VERSION,
    nombre: texto(x.nombre),
    w: numero(x.w), d: numero(x.d), h: numero(x.h),
    medidas: texto(x.medidas), material: texto(x.material), acabado: texto(x.acabado), descripcion: texto(x.descripcion),
    usuarios: numero(x.usuarios),
    config: config && Object.keys(config).length ? config : null,
    catalogo: clave != null ? { clave } : null,
    producto_id: ident(primero(x.producto_id, x.product_id)),
    producto_version_id: ident(primero(x.producto_version_id, x.productVersionId, x.product_version_id)),
    productoId: ident(x.productoId),
    claveLinea: ident(x.claveLinea),
    materiales: lista([...textos(x.materiales), ...comps.map((c) => c.insumoId)]),
    piezas: piezas.length ? piezas : null,
    nombresExcluidos: excluidas,
  };
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null));
}

// Lo que el NAVEGADOR declara al costear (intentDesdePieza). El servidor descarta materiales/piezas/despiece
// declarados y los vuelve a sacar del despiece que costea (validarIntentCosteo → promesaDeIntent).
export const PROMESA_DECLARABLE = ['nombre', 'w', 'd', 'h', 'medidas', 'material', 'acabado', 'descripcion', 'usuarios', 'config',
  'catalogo', 'producto_id', 'producto_version_id', 'productoId', 'claveLinea', 'nombresExcluidos'];

/**
 * Promesa de origen de un costeo: lo declarado (sólo PROMESA_DECLARABLE) + el despiece que de verdad se costea.
 * La usan validarIntentCosteo (cliente y Edge) y partidaAutoritativaDeCosteo, para que la partida y el costeo
 * salgan de la MISMA función con los MISMOS datos.
 */
export function promesaDeOrigen(declarada, componentesCosteados) {
  if (!esObjeto(declarada)) return null;
  const base = {};
  for (const k of PROMESA_DECLARABLE) if (declarada[k] !== undefined) base[k] = declarada[k];
  return promesaComercialDeCosteo({ ...base, componentes: Array.isArray(componentesCosteados) ? componentesCosteados : [] });
}
