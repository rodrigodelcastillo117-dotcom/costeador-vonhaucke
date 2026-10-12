// VH-088 · Carga del ERP completo al catálogo · aplicado en producción el 2026-10-12.
// Rastro reproducible del script usado (rutas relativas al repo). Entrada: el JSON derivado de
// "Costos de Materia Prima Ultima Compra al 10082026.xlsx" (Drive de Compras) con la forma
// { "ARTICULO|OPCION": { desc, opc_desc, unidad, clave, estatus, fecha_uc, costo_uc } } y el cruce
// contra la semilla (ids ya certificados en A11 se omiten). Salida: erp_cat.json (insumos_catalogo),
// erp_precios.json (insumo_precios DATA_TRUTH_V1) y seed_attrs.json (atributos del motor para los 259
// ids de la semilla). Se subieron por PostgREST con sesión de rol dirección en lotes de 500.
// Uso: node supabase/datos/2026-10-12_vh088_erp_carga.mjs <dir con erp_dl/ultima_compra.json y erp_dl/cruce.json>
import fs from 'node:fs';
import { INSUMOS_SEMILLA } from '../../src/datos/insumos.js';
import { familiaDeMaterial } from '../../src/datos/materialMatch.js';
const S = process.argv[2];
const erp = JSON.parse(fs.readFileSync(`${S}/erp_dl/ultima_compra.json`, 'utf8'));
const cruce = JSON.parse(fs.readFileSync(`${S}/erp_dl/cruce.json`, 'utf8'));
const DOC = 'ERP Intelisis · Costos de Materia Prima Ultima Compra al 10082026.xlsx (Drive, Compras)';
const CORTE = new Date('2024-10-12');
const yaCargados = new Set(cruce.filter((r) => r.estado === 'IGUAL' || r.estado === 'DIFIERE').map((r) => `${r.art}|${r.opc}`));
const TABLERO = { tipo: 'tablero', nombre: 'tablero 1.22 x 2.44', corto: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const TRAMO6 = { tipo: 'tramo', nombre: 'tramo de 6 m', corto: 'tramo', medida: 6 };
const UNIDAD = { pieza: 'pza', pza: 'pza', hoja: 'hoja', m: 'm', jgo: 'juego', kg: 'kg', lt: 'lt', m2: 'm2', caja: 'caja', 'dm²': 'dm2', rollo: 'rollo', 'ud./serv.': 'servicio', ft: 'ft', yd: 'yd', lb: 'lb' };
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function seccionDe(desc, fam) {
  const d = desc.toLowerCase();
  if (['melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'madera_solida', 'superficie_solida', 'acrilico', 'policarbonato', 'termoformado', 'marmol_piedra', 'cristal'].includes(fam)) return 'cubiertas';
  if (['metal_lamina', 'acero_inoxidable', 'aluminio'].includes(fam)) return 'metal';
  if (fam === 'tapiceria') return 'tapiceria';
  if (fam === 'pet_acustico') return 'ecoacustic';
  if (/pintura|primer|thinner|diluyente|barniz|laca|sellador|tinta|esmalte|catalizador|resina/.test(d)) return 'acabados';
  if (/cable|contacto|led|luminaria|conector|usb|arn[eé]s|clavija|transformador|fuente de poder|interruptor|bal[aá]str|l[aá]mpara|el[eé]ctric/.test(d)) return 'electrico';
  if (/bisagra|corredera|jaladera|cerradura|chapa |tornill|pija|tuerca|rondana|remache|nivelador|rodaja|riel|soporte|escuadra|taquete|tapón|tapon|regat[oó]n|perno|ancla/.test(d)) return 'herrajes';
  return 'erp-otros';
}
const catRows = [], precioRows = [], ids = new Set(), colisiones = [];
let n = 0, sinUnidad = {};
for (const [key, v] of Object.entries(erp)) {
  const costo = v.costo_uc == null ? null : Number(v.costo_uc);
  if (!(costo > 0)) continue;
  if (yaCargados.has(key)) continue;
  const [art, opc] = key.split('|');
  const desc = String(v.desc || '').replace(/\s+/g, ' ').trim() || art;
  const opcDesc = String(v.opc_desc || '').replace(/\s+/g, ' ').trim();
  const uRaw = String(v.unidad || '').trim().toLowerCase();
  const unidad = UNIDAD[uRaw];
  if (!unidad) { sinUnidad[uRaw] = (sinUnidad[uRaw] || 0) + 1; continue; }
  const clave = String(v.clave || '').trim();
  let id = 'erp-' + slug(clave || art) + (opc ? '-' + slug(opc) : '');
  if (ids.has(id)) { const alt = 'erp-' + slug(art) + (opc ? '-' + slug(opc) : ''); colisiones.push([id, alt]); id = alt; }
  if (ids.has(id)) { colisiones.push([id, 'DUP']); continue; }
  ids.add(id);
  const nombre = (opcDesc ? `${desc} · ${opcDesc}` : desc).slice(0, 180);
  const fam = familiaDeMaterial(nombre);
  const seccion = seccionDe(nombre, fam);
  const activo = v.estatus === 'ALTA';
  const d = nombre.toLowerCase();
  let formato = null, fraccion = false, mermaCorte = 0;
  if (unidad === 'hoja' && ['melamina', 'mdf', 'laminado_hpl', 'chapa_madera'].includes(fam) && /4\s*x\s*8|1\.?22|2\.?44/.test(d)) { formato = TABLERO; fraccion = true; mermaCorte = 6; }
  else if (unidad === 'hoja' && fam === 'metal_lamina') { mermaCorte = 8; }
  else if (unidad === 'm' && /\bptr\b|tubular|\btubo\b|perfil|[aá]ngulo|solera|redondo|cuadrado/.test(d) && seccion === 'metal') { formato = TRAMO6; mermaCorte = 5; }
  const clase = (seccion === 'herrajes' || seccion === 'electrico') ? 'indirecta' : 'directa';
  const fecha = String(v.fecha_uc || '').slice(0, 10);
  const reciente = fecha && new Date(fecha) >= CORTE;
  catRows.push({ id, nombre, seccion, unidad_costeo: unidad, activo, clasificacion: 'erp', familia: fam || null,
    atributos: { unidad, clase, formato, fraccion, mermaCorte, veta: false, inventario: false, erp: { articulo: art, opcion: opc || null, clave: clave || null, estatus: v.estatus, fecha_uc: fecha || null } } });
  if (!fecha) continue; // DATA_TRUTH exige vigente_desde: sin fecha de compra no hay fila de precio (queda "sin precio", nunca $0)
  precioRows.push({ insumo_id: id, precio: 0, contract_status: 'DATA_TRUTH_V1', source_system: 'erp_intelisis', source_document: DOC, source_record_id: key,
    source_price: costo, source_currency: 'MXN', source_unit: uRaw, source_units_per_cost_unit: 1, cost_unit: unidad, vigente_desde: fecha,
    estado: reciente ? 'propuesto' : 'propuesto_validado', confidence: 'alta', evidence_status: 'documentada',
    evidencia: `ERP última compra ${fecha} · ${clave || art}${opcDesc ? ' ' + opcDesc : ''}` + (reciente ? '' : ' · ANTIGUA >24 meses: re-cotizar con Compras antes de certificar') + (activo ? '' : ' · BLOQUEADO en ERP'),
    fuente: 'Compras · ERP Intelisis última compra (corte 2026-08-10)', creado_por: 'vh088-erp-2026-10-12', requiere_validacion_compras: false });
  n++;
}
// atributos de la semilla para los 259 ids existentes
const seedAttrs = INSUMOS_SEMILLA.map((i) => ({ id: i.id, atributos: { unidad: i.unidad, clase: i.clase, formato: i.formato || null, fraccion: !!i.fraccion, mermaCorte: i.mermaCorte || 0, veta: !!i.veta, inventario: !!i.inventario, moneda: i.moneda || 'MXN', articulo: i.articulo || null } }));
fs.writeFileSync(`${S}/vh088/erp_cat.json`, JSON.stringify(catRows));
fs.writeFileSync(`${S}/vh088/erp_precios.json`, JSON.stringify(precioRows));
fs.writeFileSync(`${S}/vh088/seed_attrs.json`, JSON.stringify(seedAttrs));
const cnt = (arr, f) => { const c = {}; for (const x of arr) { const k = f(x); c[k] = (c[k] || 0) + 1; } return c; };
console.log('catalogo', catRows.length, 'precios', precioRows.length, 'colisiones', colisiones.length, 'sinUnidad', sinUnidad);
console.log('secciones', cnt(catRows, (r) => r.seccion));
console.log('formato', cnt(catRows, (r) => r.atributos.formato ? r.atributos.formato.tipo : '-'));
console.log('activo', cnt(catRows, (r) => r.activo), 'estado', cnt(precioRows, (r) => r.estado));
console.log('ej', JSON.stringify(catRows[100]), JSON.stringify(precioRows[100]));
