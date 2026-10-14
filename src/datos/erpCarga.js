// ============================================================================
//  CARGA DEL ERP (VH-089) · del reporte "Costos de Materia Prima Última Compra" a filas
//  listas para el catálogo del motor. Es la MISMA lógica con la que se cargó el ERP el
//  2026-10-12 (supabase/datos/2026-10-12_vh088_erp_carga.mjs), ahora compartida con la
//  pantalla "Cargar compras del ERP" (Dirección). Puro: no toca red.
// ============================================================================
import { familiaDeMaterial } from './materialMatch.js';

export const DOC_ERP_PREFIJO = 'ERP Intelisis · ';
const TABLERO = { tipo: 'tablero', nombre: 'tablero 1.22 x 2.44', corto: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
// VH-146: hoja 5 x 8 ft (1.525 x 2.44 m) = 3.721 m². Antes sólo se reconocía 4 x 8 y sin la comilla de pie ("4' X 8'").
const TABLERO5X8 = { tipo: 'tablero', nombre: 'tablero 1.52 x 2.44', corto: 'tablero 5x8', medida: 3.721, largoMM: 2440, anchoMM: 1525 };
export const RE_HOJA_4X8 = /(?:^|[^0-9])4\s*'?\s*x\s*'?\s*8(?![0-9])|1\.?22\b|2\.?44\b/;
export const RE_HOJA_5X8 = /(?:^|[^0-9])5\s*'?\s*x\s*'?\s*8(?![0-9])|1\.?52(?:5)?\b/;
const TRAMO6 = { tipo: 'tramo', nombre: 'tramo de 6 m', corto: 'tramo', medida: 6 };

// TRAMO VENDIDO POR PIEZA (14-oct-2026): perfil/tubular de acero que Intelisis vende por "PIEZA DE 6000 mm" (unidad pza).
// Va en `atributos.tramoPorPieza` (no en `formato`) para que el motor anterior no lo cobre como metros × $/pieza; el motor
// 2026-10-14a lo adopta (calculo.js · conTramoPorPieza). Sólo barras comerciales (≥ 2,400 mm): "CORTE CON LASER ... X 1230 mm"
// es una pieza ya cortada y se consume por pieza. Merma: tubular D2 6.94 % (calculada de los reportes Intelisis de las
// patas U ATPU2M/75M/3M, autorizada por Dirección el 14-oct); otros perfiles 5 % (la misma regla que los tramos en metros).
export const MERMA_TUBULAR_D2 = 6.94;
const RE_PERFIL = /(ptr|tubular|tubo|perfil|[aá]ngulo|solera|redondo|cuadrado|barra|canal|monten|zeta)/i;
const RE_LARGO_BARRA = /(?:pieza de|x|ø[^x]*x)\s*([0-9]{4,5})\s?mm|([0-9]{4,5})\s?mm de largo/i;
export function tramoPorPiezaDe(nombre, { unidad, seccion } = {}) {
  if (unidad !== 'pza' || seccion !== 'metal' || !RE_PERFIL.test(nombre || '') || /cart[oó]n/i.test(nombre || '')) return null;
  const m = String(nombre).match(RE_LARGO_BARRA);
  const mm = m ? Number(m[1] || m[2]) : 0;
  if (!(mm >= 2400 && mm <= 12000)) return null;
  const d2 = /(ptr|tubular|\btubo\b)/i.test(nombre) && !/alumin/i.test(nombre);
  return { tramoPorPieza: { tipo: 'tramo', nombre: `pieza de ${mm} mm`, corto: 'pieza', medida: mm / 1000 }, mermaTramo: d2 ? MERMA_TUBULAR_D2 : 5 };
}
export const UNIDAD_ERP = { pieza: 'pza', pza: 'pza', hoja: 'hoja', m: 'm', mt: 'm', mts: 'm', jgo: 'juego', juego: 'juego', kg: 'kg', lt: 'lt', l: 'lt', m2: 'm2', 'm²': 'm2', caja: 'caja', 'dm²': 'dm2', dm2: 'dm2', rollo: 'rollo', 'ud./serv.': 'servicio', servicio: 'servicio', ft: 'ft', yd: 'yd', lb: 'lb', par: 'par' };
export const MESES_CERTIFICABLE = 24;

export const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function seccionDe(desc, fam) {
  const d = String(desc || '').toLowerCase();
  if (['melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'madera_solida', 'superficie_solida', 'acrilico', 'policarbonato', 'termoformado', 'marmol_piedra', 'cristal'].includes(fam)) return 'cubiertas';
  if (['metal_lamina', 'acero_inoxidable', 'aluminio'].includes(fam)) return 'metal';
  if (fam === 'tapiceria') return 'tapiceria';
  if (fam === 'pet_acustico') return 'ecoacustic';
  if (/pintura|primer|thinner|diluyente|barniz|laca|sellador|tinta|esmalte|catalizador|resina/.test(d)) return 'acabados';
  if (/cable|contacto|led|luminaria|conector|usb|arn[eé]s|clavija|transformador|fuente de poder|interruptor|bal[aá]str|l[aá]mpara|el[eé]ctric/.test(d)) return 'electrico';
  if (/bisagra|corredera|jaladera|cerradura|chapa |tornill|pija|tuerca|rondana|remache|nivelador|rodaja|riel|soporte|escuadra|taquete|tapón|tapon|regat[oó]n|perno|ancla/.test(d)) return 'herrajes';
  return 'erp-otros';
}

/** Un registro del reporte (objeto por encabezado) → registro normalizado o null si no es fila de artículo. */
export function registroDesdeFila(o) {
  const art = String(o['Articulo'] ?? o['Artículo'] ?? '').trim();
  if (!art) return null;
  const costoRaw = o['Costo Última Compra'] ?? o['Costo Ultima Compra'] ?? o['costo_uc'];
  const costo = costoRaw == null || costoRaw === '' ? null : Number(costoRaw);
  return {
    articulo: art,
    opcion: String(o['Opción'] ?? o['Opcion'] ?? '').trim(),
    desc: String(o['Descripcion'] ?? o['Descripción'] ?? '').replace(/\s+/g, ' ').trim(),
    opc_desc: String(o['Opción Descripción'] ?? o['Opcion Descripcion'] ?? '').replace(/\s+/g, ' ').trim(),
    unidad: String(o['Unidad'] ?? '').trim(),
    clave: String(o['Clave Comercial'] ?? o['Clave'] ?? '').trim(),
    estatus: String(o['Estatus'] ?? '').trim().toUpperCase(),
    fecha_uc: o['Fecha Última Compra'] ?? o['Fecha Ultima Compra'] ?? null,
    costo_uc: Number.isFinite(costo) ? costo : null,
  };
}

export function idErp(r) {
  return 'erp-' + slug(r.clave || r.articulo) + (r.opcion ? '-' + slug(r.opcion) : '');
}

/**
 * Prepara la carga: catálogo (una fila por registro con costo) y precios DATA_TRUTH_V1.
 * @param {Array} registros  salida de registroDesdeFila (ya filtrada de nulls)
 * @param {{documento:string, hoy?:Date}} opts
 */
export function prepararCargaErp(registros, { documento, hoy = new Date() } = {}) {
  const corte = new Date(hoy.getTime()); corte.setMonth(corte.getMonth() - MESES_CERTIFICABLE);
  const corteISO = corte.toISOString().slice(0, 10);
  const catalogo = [], precios = [], ids = new Set();
  const resumen = { filas: registros.length, sinCosto: 0, sinUnidad: {}, sinFecha: 0, recientes: 0, antiguos: 0, bloqueados: 0, duplicados: 0 };
  for (const r of registros) {
    if (!(r.costo_uc > 0)) { resumen.sinCosto++; continue; }
    const uRaw = r.unidad.toLowerCase();
    const unidad = UNIDAD_ERP[uRaw];
    if (!unidad) { resumen.sinUnidad[uRaw] = (resumen.sinUnidad[uRaw] || 0) + 1; continue; }
    let id = idErp(r);
    if (ids.has(id)) { const alt = 'erp-' + slug(r.articulo) + (r.opcion ? '-' + slug(r.opcion) : ''); if (ids.has(alt)) { resumen.duplicados++; continue; } id = alt; }
    ids.add(id);
    const nombre = (r.opc_desc ? `${r.desc || r.articulo} · ${r.opc_desc}` : (r.desc || r.articulo)).slice(0, 180);
    const fam = familiaDeMaterial(nombre);
    const seccion = seccionDe(nombre, fam);
    const activo = r.estatus === 'ALTA';
    if (!activo) resumen.bloqueados++;
    const d = nombre.toLowerCase();
    let formato = null, fraccion = false, mermaCorte = 0;
    // VH-146b: 5×8 PRIMERO (más específico). Una hoja 5×8 descrita en metros ("1.52 X 2.44") también casa con
    // el patrón 4×8 por el "2.44"; probado en supabase/tests/formatoHojasErp.test.js. Un 4×8 nunca trae 5 X 8 / 1.52.
    if (unidad === 'hoja' && ['melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'acrilico'].includes(fam) && RE_HOJA_5X8.test(d)) { formato = TABLERO5X8; fraccion = true; mermaCorte = 6; }
    else if (unidad === 'hoja' && ['melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'acrilico'].includes(fam) && RE_HOJA_4X8.test(d)) { formato = TABLERO; fraccion = true; mermaCorte = 6; }
    else if (unidad === 'hoja' && fam === 'metal_lamina') { mermaCorte = 8; }
    else if (unidad === 'm' && seccion === 'metal' && /\bptr\b|tubular|\btubo\b|perfil|[aá]ngulo|solera|redondo|cuadrado/.test(d)) { formato = TRAMO6; mermaCorte = 5; }
    const tramoPza = formato ? null : tramoPorPiezaDe(nombre, { unidad, seccion });
    const clase = (seccion === 'herrajes' || seccion === 'electrico') ? 'indirecta' : 'directa';
    const key = `${r.articulo}|${r.opcion}`;
    catalogo.push({ id, nombre, seccion, unidad_costeo: unidad, activo, clasificacion: 'erp', familia: fam || null,
      atributos: { unidad, clase, formato, fraccion, mermaCorte, ...(tramoPza || {}), veta: false, inventario: false, erp: { articulo: r.articulo, opcion: r.opcion || null, clave: r.clave || null, estatus: r.estatus, fecha_uc: r.fecha_uc || null } } });
    if (!r.fecha_uc) { resumen.sinFecha++; continue; }
    const reciente = r.fecha_uc >= corteISO;
    if (reciente) resumen.recientes++; else resumen.antiguos++;
    precios.push({ insumo_id: id, source_record_id: key, source_price: r.costo_uc, source_unit: uRaw, cost_unit: unidad, vigente_desde: r.fecha_uc,
      estado: reciente ? 'propuesto' : 'propuesto_validado',
      evidencia: `ERP última compra ${r.fecha_uc} · ${r.clave || r.articulo}${r.opc_desc ? ' ' + r.opc_desc : ''}` + (reciente ? '' : ` · ANTIGUA >${MESES_CERTIFICABLE} meses: re-cotizar con Compras antes de certificar`) + (activo ? '' : ' · BLOQUEADO en ERP'),
      documento: DOC_ERP_PREFIJO + (documento || 'Costos de Materia Prima Última Compra') });
  }
  return { catalogo, precios, resumen };
}
