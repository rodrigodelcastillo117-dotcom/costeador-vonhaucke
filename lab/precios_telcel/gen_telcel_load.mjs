// Genera el paquete SQL de carga TELCEL (49 AUTO_CARGABLE) SIN inventar nada.
// Fuentes: LOAD_PLAN.md (lista vetada) + cata_mp.csv (descripción/nombre real).
// Uso: node -I gen_telcel_load.mjs <LOAD_PLAN.md> <cata_mp.csv> <out.sql>
import { readFileSync, writeFileSync } from 'node:fs';
const [planPath, csvPath, outPath] = process.argv.slice(2);

// --- Parse AUTO_CARGABLE del LOAD_PLAN.md ---
const plan = readFileSync(planPath, 'utf8');
const lines = plan.split('\n');
const targets = [];
let inAuto = false;
for (const ln of lines) {
  if (/## AUTO_CARGABLE/.test(ln)) { inAuto = true; continue; }
  if (inAuto && /^## /.test(ln)) break;                 // fin de sección
  const m = ln.match(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*\$?([\d.]+)\s*\|\s*([^|]*?)\s*\|\s*([\d-]+)\s*[\d:]*\s*\|\s*(\d+)\s*\|/);
  if (!m) continue;
  const [, n, articulo, opcionRaw, claveRaw, precio, unidad, fecha, fila] = m;
  const opcion = (opcionRaw === '—' || opcionRaw === '-' || opcionRaw === '') ? '' : opcionRaw.trim();
  const clave = (claveRaw === 'NULL' || claveRaw === '—' || claveRaw === '') ? '' : claveRaw.trim();
  targets.push({ n: +n, articulo: articulo.trim(), opcion, clave, precio: +precio, unidad: unidad.trim(), fecha: fecha.trim(), fila: +fila });
}

// --- Parser CSV mínimo RFC4180 (maneja comillas y "" escapadas) ---
function parseCSV(text) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c === '\r') { /* skip */ }
      else f += c;
    }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const csv = parseCSV(readFileSync(csvPath, 'utf8'));
// Columnas posicionales: 2=articulo 3=desc 4=opcion 6=unidad 7=fecha 8=precio 12=clave
const norm = (s) => String(s ?? '').trim();
const normOpc = (s) => { const t = norm(s); return (t === '-' || t === '—') ? '' : t; };
const toDate = (s) => norm(s).slice(0, 10);

// Índice: articulo|opcion -> filas candidatas
const idx = new Map();
csv.forEach((r, i) => {
  const art = norm(r[2]); if (!art) return;
  const key = art + '|' + normOpc(r[4]);
  if (!idx.has(key)) idx.set(key, []);
  idx.get(key).push({ i: i + 1, desc: norm(r[3]), unidad: norm(r[6]), fecha: toDate(r[7]), precio: r[8] === '' ? null : Number(r[8]), clave: norm(r[12]) });
});

const catalogo = []; const precios = []; const flags = [];
for (const t of targets) {
  const cands = idx.get(t.articulo + '|' + t.opcion) || [];
  // Debe coincidir precio (±0.005) y fecha exacta con lo vetado.
  const hit = cands.find((c) => c.precio != null && Math.abs(c.precio - t.precio) < 0.005 && c.fecha === t.fecha);
  if (!hit) { flags.push({ ...t, motivo: `sin coincidencia exacta en cata_mp (cands=${cands.length})` }); continue; }
  if (hit.unidad && t.unidad && hit.unidad.toLowerCase() !== t.unidad.toLowerCase()) {
    flags.push({ ...t, motivo: `unidad difiere CSV='${hit.unidad}' plan='${t.unidad}'` }); continue;
  }
  const id = 'erp-' + (t.articulo + (t.opcion ? '-' + t.opcion : '')).toLowerCase();
  const atribErp = { articulo: t.articulo, opcion: t.opcion, clave_comercial: hit.clave || t.clave || null, unidad: hit.unidad, descripcion: hit.desc };
  catalogo.push({ id, nombre: hit.desc, seccion: 'MATERIALES', unidad_costeo: hit.unidad, activo: true, clasificacion: 'erp', familia: 'TELCEL C-CO-320R', atributos: { erp: atribErp } });
  precios.push({
    source_record_id: t.articulo + '|' + t.opcion,
    source_price: t.precio, vigente_desde: t.fecha,
    source_unit: hit.unidad, cost_unit: hit.unidad,
    estado: 'propuesto_validado', requiere_validacion_compras: true,
    evidencia: `TELCEL C-CO-320R · cata_mp fila ${hit.i} · clave ${hit.clave || t.clave || 's/clave'} · última compra ${t.fecha}`,
    insumo_id: id,
  });
}

const DOC = 'C-CO-320R DATS TELCEL DIV-MATERIALES 20261002.xlsx';
const sql = `-- PAQUETE DE CARGA TELCEL (C-CO-320R) — LISTO PARA QUE DIRECCIÓN LO APLIQUE
-- Generado determinísticamente desde cata_mp.csv + TELCEL_LOAD_PLAN.md. NADA inventado.
-- Prerrequisito: aplicar antes supabase/migrations/PROPUESTA_20261026_workbook_proyecto_preliminar.sql
--   (define cargar_erp_ultima_compra con el candado requiere_validacion_compras).
-- Los ${precios.length} precios entran como PRELIMINARES (propuesto_validado + requiere_validacion_compras=true):
--   NO se auto-aprueban, NO se certifican hasta que Compras los revalide. Dedup por (record_id+precio+fecha).
-- Correr como Dirección (puede_certificar_costo()). Idempotente: re-correr no duplica.

select public.cargar_erp_ultima_compra(
  ${sqlLit(DOC)},
  ${sqlLit(JSON.stringify(catalogo))}::jsonb,
  ${sqlLit(JSON.stringify(precios))}::jsonb
) as resultado;

-- Verificación (debe mostrar ${precios.length} precios preliminares TELCEL, 0 certificados):
-- select estado, requiere_validacion_compras, count(*)
--   from insumo_precios where source_document = 'ERP Intelisis · ${DOC}'
--   group by 1,2 order by 1;
-- Rollback (si hiciera falta, sólo Dirección):
-- delete from insumo_precios where source_document = 'ERP Intelisis · ${DOC}';
`;
function sqlLit(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

writeFileSync(outPath, sql);
console.log(JSON.stringify({ targets: targets.length, cargables: precios.length, flagged: flags.length, flags }, null, 2));
