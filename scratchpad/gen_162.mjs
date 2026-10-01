// Carga los 162 solo-codigo al catalogo versionado (audit 2026-10-01). NO toca config.
// Todos son vigente/nuevo (0 requieren decision humana). Con fuente = etiqueta, NO doc adjunto,
// por eso estado 'propuesto_validado' (nunca 'aprobado'); sin fuente = 'propuesto' + bloqueador.
import { INSUMOS_SEMILLA } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/datos/insumos.js';
import fs from 'fs';
const b = JSON.parse(fs.readFileSync('/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/scratchpad/clasificacion_162.json','utf8'));
const clasifDe = {};
for (const x of b.vigente) clasifDe[x.id] = 'vigente';
for (const x of b.nuevo)   clasifDe[x.id] = 'nuevo';
for (const x of b.revisar) clasifDe[x.id] = 'revisar';

const q = (s) => s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
const cod = {}; for (const i of INSUMOS_SEMILLA) cod[i.id] = i;

function propiedades(i) {
  const f = i.formato || {};
  if (i.seccion === 'metal' && f.medida) {
    const calibre = (String(i.nombre).match(/cal\.?\s*(\d+)/i) || [])[1] || null;
    return { calibre, peso_hoja_kg: f.medida, modelo: 'compra kg -> costeo hoja/fraccion' };
  }
  if ((i.seccion === 'cubiertas' || i.seccion === 'mamparas') && f.largoMM) {
    return { largo_mm: f.largoMM, ancho_mm: f.anchoMM, area_m2: f.medida, modelo: 'compra hoja -> costeo fraccion/nesting' };
  }
  return null;
}
function compra(i) {
  const f = i.formato || {};
  if (i.seccion === 'metal' && f.medida && i.unidad === 'hoja')
    return { unidad_compra: 'kg', precio_compra: +(i.precio / f.medida).toFixed(4), factor_conversion: f.medida };
  if (i.unidad === 'hoja') return { unidad_compra: 'hoja', precio_compra: i.precio, factor_conversion: 1 };
  return { unidad_compra: i.unidad, precio_compra: i.precio, factor_conversion: 1 };
}

const catVals = [], preVals = [];
let nVal=0, nProp=0;
for (const id of Object.keys(clasifDe)) {
  const i = cod[id];
  const tieneFuente = !!i.fuente;
  const estado = tieneFuente ? 'propuesto_validado' : 'propuesto';
  const evid = tieneFuente ? 'referenciada' : 'sin_evidencia';
  const conf = tieneFuente ? 'media' : 'baja';
  const flag = tieneFuente ? 'false' : 'true';
  const c = compra(i), props = propiedades(i);
  const propsSql = props ? q(JSON.stringify(props))+'::jsonb' : 'null';
  catVals.push(`(${q(id)},${q(i.nombre)},${q(i.seccion)},${q(i.unidad)},${q(clasifDe[id])})`);
  preVals.push(`(${q(id)},${i.precio},${q(c.unidad_compra)},${c.precio_compra},${c.factor_conversion},${propsSql},${q(i.fuente||i.articulo||'codigo SEMILLA')},${q('solo-codigo '+clasifDe[id])},current_date,${q(estado)},${q(evid)},${q(conf)},${flag},'reconciliacion')`);
  if (tieneFuente) nVal++; else nProp++;
}
const sql =
`insert into public.insumos_catalogo (id,nombre,seccion,unidad_costeo,clasificacion) values\n${catVals.join(',\n')}\non conflict (id) do nothing;\n\n` +
`insert into public.insumo_precios (insumo_id,precio,unidad_compra,precio_compra,factor_conversion,propiedades,fuente,evidencia,vigente_desde,estado,evidence_status,confidence,requiere_validacion_compras,creado_por) values\n${preVals.join(',\n')};\n`;
fs.writeFileSync('/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/scratchpad/carga_162.sql', sql);
console.log(`total=${nVal+nProp}  propuesto_validado=${nVal}  propuesto(sin fuente)=${nProp}  bytes=${sql.length}`);
