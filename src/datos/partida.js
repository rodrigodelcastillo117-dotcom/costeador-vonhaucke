// ============================================================================
//  CONTRATO ÚNICO DE PARTIDA (mandato §11 #2, 2026-10-11 · VH-044)
//
//  Había 6 constructores en App.jsx y 6 pre-formas en lineas.js/CotizadorIA, cada
//  uno con su propia idea de qué campos lleva un renglón: la identidad de Producto
//  Maestro se perdía al pasar por Voni (`partidasDeItemsIA` no la copiaba), Banco
//  sembraba costo al vendedor, los nombres chocaban (`productoId` = clave de línea
//  en un lado y Producto Maestro en otro; `productVersionId` vs
//  `producto_version_id`) y nada validaba nada.
//
//  Desde hoy TODO renglón pasa por `crearPartida(entrada, { veCostos, origen })`:
//   - un solo esquema de campos (abajo), nombres canónicos snake_case para la
//     identidad de Producto Maestro, camelCase para lo demás;
//   - la ECONOMÍA (costoUnitario, margen, costoDerivado, factores, horas…) sólo
//     existe si `veCostos`; para el vendedor se elimina (misma regla que el servidor:
//     jsonb_sin_economia) y se marca `sellerSafe`;
//   - `precioReal` y `precio_lista_snapshot` NO son economía interna: son procedencia
//     del precio de venta y se conservan;
//   - cantidad entera ≥ 1; precio finito > 0 o null (nunca 0 como "sin precio");
//   - `render` sólo URL (nunca base64 en el estado ni en la nube);
//   - `origen` dice de dónde vino el renglón.
//  `validarPartida` devuelve los problemas que la emisión encontraría.
// ============================================================================
import { idNuevo } from '../util.js';
import { sinEconomiaServidor as sinEconomia } from './economia.js';

export const ORIGENES = ['costeo', 'linea', 'ia', 'banco', 'catalogo', 'cocrear', 'addon', 'manual'];

const num = (x) => (x == null || x === '' ? NaN : Number(x));
const precioValido = (x) => (Number.isFinite(num(x)) && num(x) > 0 ? num(x) : null);
const entero1 = (x) => Math.max(1, Math.round(Number.isFinite(num(x)) ? num(x) : 1));
const textoONull = (x) => (typeof x === 'string' && x.trim() ? x.trim() : null);
const esNumerico = (x) => x != null && x !== '' && /^[0-9]+$/.test(String(x));

function inferirOrigen(e) {
  if (e.origen && ORIGENES.includes(e.origen)) return e.origen;
  if (e.deBanco || e.source_type === 'banco') return 'banco';
  if (typeof e.piezaId === 'string' && e.piezaId.startsWith('addon-')) return 'addon';
  if (e.deLinea) return 'linea';
  if (e.loteIA || e.sugerido || e.confianza) return 'ia';
  if (e.catalogo || e.precioReal) return 'catalogo';
  return 'costeo';
}

export function crearPartida(entrada = {}, { veCostos = false, origen } = {}) {
  const e = entrada || {};
  // Identidad de Producto Maestro: acepta las tres grafías que circulan y las unifica.
  const producto_id = e.producto_id ?? e.product_id ?? (esNumerico(e.productoId) ? Number(e.productoId) : null);
  const producto_version_id = e.producto_version_id ?? e.productVersionId ?? e.product_version_id ?? null;
  const lista_precio_item_id = e.lista_precio_item_id ?? e.listaPrecioItemId ?? null;
  const render = typeof e.render === 'string' && /^https?:\/\//.test(e.render) ? e.render : null;
  const base = {
    id: e.id || idNuevo('p'),
    origen: origen && ORIGENES.includes(origen) ? origen : inferirOrigen(e),
    piezaId: e.piezaId ?? null,
    nombre: textoONull(e.nombre) || 'Mueble',
    ruta: e.ruta ?? null,
    linea: e.linea ?? null,
    // Clave de línea (string) — NO es el id de Producto Maestro.
    productoId: esNumerico(e.productoId) ? null : (e.productoId ?? e.claveLinea ?? e.producto ?? null),
    claveLinea: e.claveLinea ?? (esNumerico(e.productoId) ? null : e.productoId ?? null) ?? e.producto ?? null,
    // Identidad canónica (snake_case). El servidor exige version cuando hay producto_id.
    producto_id: producto_id != null && producto_id !== '' ? Number(producto_id) : null,
    producto_version_id: producto_version_id != null && producto_version_id !== '' ? Number(producto_version_id) : null,
    source_type: e.source_type ?? null,
    source_ref: e.source_ref ?? null,
    lista_precio_item_id: lista_precio_item_id != null && lista_precio_item_id !== '' ? Number(lista_precio_item_id) : null,
    precio_lista_snapshot: precioValido(e.precio_lista_snapshot),
    w: Number.isFinite(num(e.w)) ? num(e.w) : null,
    d: Number.isFinite(num(e.d)) ? num(e.d) : null,
    cantidad: entero1(e.cantidad),
    precioUnitario: precioValido(e.precioUnitario),
    // Procedencia del precio (no economía interna): se conserva para el sello.
    precioReal: !!e.precioReal,
    deBanco: !!e.deBanco,
    deLinea: !!e.deLinea,
    sugerido: !!e.sugerido,
    sinPrecioAutorizado: !!e.sinPrecioAutorizado,
    candadoUsuarios: !!e.candadoUsuarios,
    requiereProyectista: !!e.requiereProyectista,
    config: e.config ?? null,
    catalogo: e.catalogo ? { clave: e.catalogo.clave ?? null, lista: e.catalogo.lista ?? null, minimo: e.catalogo.minimo ?? null, ...(veCostos && e.catalogo.full != null ? { full: e.catalogo.full } : {}) } : null,
    variantes: Array.isArray(e.variantes) ? e.variantes : null,
    render,
    nota: e.nota ?? null,
    confianza: e.confianza ?? null,
    avisos: Array.isArray(e.avisos) ? e.avisos : [],
    // Completitud del costeo (bloquea emisión, no guardado) y exclusiones ($0 por decisión).
    piezasSinMaterial: Number.isFinite(num(e.piezasSinMaterial)) ? num(e.piezasSinMaterial) : (Array.isArray(e.nombresSinMaterial) ? e.nombresSinMaterial.length : 0),
    nombresSinMaterial: Array.isArray(e.nombresSinMaterial) ? e.nombresSinMaterial : [],
    nombresExcluidos: Array.isArray(e.nombresExcluidos) ? e.nombresExcluidos : [],
    estadoCosto: e.estadoCosto ?? null,
  };
  if (!veCostos) {
    // Vendedor: NUNCA economía interna en su estado — ni siquiera la clave en null
    // (misma regla que el servidor: jsonb_sin_economia quita la clave).
    const limpia = sinEconomia({ ...base, pieza: e.pieza ?? null });
    let pieza = null;
    if (e.pieza) { const { factorDirecta, factorIndirecta, horas, modoManoObra, preparacionHoras, ...pz } = e.pieza; pieza = sinEconomia(pz); }
    return { ...limpia, precioReal: base.precioReal, precio_lista_snapshot: base.precio_lista_snapshot, sellerSafe: true, pieza };
  }
  const costo = num(e.costoUnitario);
  return {
    ...base,
    costoUnitario: Number.isFinite(costo) && costo > 0 ? costo : null,   // 0/NaN = desconocido, nunca "gratis"
    margen: Number.isFinite(num(e.margen)) ? num(e.margen) : null,
    costoDerivado: !!e.costoDerivado,
    pieza: e.pieza ?? null,
    sellerSafe: false,
  };
}

/** Problemas que harían fallar la emisión. [] = partida bien formada. */
export function validarPartida(p) {
  const issues = [];
  if (!p || typeof p !== 'object') return [{ campo: 'partida', msg: 'No es una partida.' }];
  if (!textoONull(p.nombre)) issues.push({ campo: 'nombre', msg: 'La partida no tiene nombre.' });
  if (!(Number.isInteger(p.cantidad) && p.cantidad >= 1)) issues.push({ campo: 'cantidad', msg: 'La cantidad debe ser un entero ≥ 1.' });
  if (!(Number.isFinite(p.precioUnitario) && p.precioUnitario > 0)) issues.push({ campo: 'precioUnitario', msg: p.sinPrecioAutorizado ? 'Sin precio autorizado: requiere costeo.' : 'Sin precio válido.' });
  if (p.producto_id != null && p.producto_version_id == null) issues.push({ campo: 'producto_version_id', msg: 'Producto Maestro sin versión canónica.' });
  if (p.producto_version_id != null && p.producto_id == null) issues.push({ campo: 'producto_id', msg: 'Versión sin producto.' });
  if ((p.piezasSinMaterial || 0) > 0) issues.push({ campo: 'piezasSinMaterial', msg: `${p.piezasSinMaterial} pieza(s) del despiece sin costear.` });
  if (typeof p.render === 'string' && p.render.startsWith('data:')) issues.push({ campo: 'render', msg: 'El render es base64; debe ser URL.' });
  if (p.sellerSafe && (p.costoUnitario != null || p.margen != null)) issues.push({ campo: 'costoUnitario', msg: 'Partida seller-safe con economía.' });
  return issues;
}
