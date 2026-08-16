// ============================================================================
//  Convierte las 9 extracciones de presupuestos en renglones del BANCO DE
//  PRECIOS. El banco muestra el PRECIO DE LISTA (el que se cobra):
//   · presupuesto con columna Desc. 40% → su P.Unitario es "precio 2" → ×0.60
//   · presupuesto sin columna de descuento → su P.Unitario YA es el de lista
//  Escribe el bloque JS listo para pegar en src/datos/banco.js.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const DIR = '/private/tmp/claude-501/-Users-rodrigodelcastillo-Documents/9bc9c4f4-68fb-4f82-814d-c99d09a93ccd/scratchpad/extraccion';
const N = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

const docs = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  try { docs.push({ archivo: f, ...JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }); } catch { /* ignora */ }
}
const conDescuento = (d) => (d.renglones || []).some((r) => (r.descuento_pct || 0) >= 5);

function categoria(r) {
  const t = N(`${r.descripcion_literal} ${r.producto} ${r.concepto}`);
  if (r.familia === 'silleria' || /\bSILLA\b|SILLON|SOFA|BANCO\b|TABURETE|POUF/.test(t)) return 'Sillería';
  if (/CANCEL|PUERTA DE |WAND|MAMPARA|MURO /.test(t)) return 'Cancelería y muros';
  if (/ELECTRIF|SISTEMA ELECTRICO|CAJA ELECTRICA|CONTACTO|BYRNE|ACOMETIDA/.test(t)) return 'Electrificación';
  if (/GAVETA|ARCHIVER|CREDENZA|ARMARIO|LOCKER|LIBRERO|GABINETE|GUARDA|PEDESTAL|TORRE|CAJONERA/.test(t)) return 'Guardas y archivo';
  if (/MESA DE JUNTAS|MESA DE CONSEJO|MESA COMEDOR|MESA CIRCULAR|MESA DE TRABAJO|TEAMSPACE/.test(t)) return 'Mesas de juntas';
  if (/BENCH|BANCA|OPERATIVO|MODULO OPERATIVO|ESTACION/.test(t)) return 'Operativos / Bench';
  if (/ESCRITORIO|GERENTE|DIRECTIVO|RECEPCION|MODULO GERENC/.test(t)) return 'Escritorios';
  // Refacciones: sólo si la descripción EMPIEZA con la pieza. Con la regla
  // suelta, "SOPORTERIA METALICA" al final de un bench mandaba el módulo
  // completo a refacciones.
  if (/^(OMEGA|PATA|RIEL|TORNILL|PLACA|SOPORTE|CANTO|MANEJACABLE|PORTA ?CPU|CUBIERTA|CONDUCTO|NIVELADOR|JALADERA|BISAGRA|CERRADURA|TAPA|ZOCLO|REMATE|POSTE|GAJO)/.test(t)) return 'Componentes y refacciones';
  if (/MESA/.test(t)) return 'Mesas y complementos';
  return 'Mesas y complementos';
}
const TIPO = {
  'Sillería': 'silla', 'Guardas y archivo': 'guarda', 'Mesas de juntas': 'mesa',
  'Operativos / Bench': 'modulo', 'Escritorios': 'modulo', 'Electrificación': 'especial',
  'Componentes y refacciones': 'especial', 'Cancelería y muros': 'especial', 'Mesas y complementos': 'mesa',
};

// ---- LÍNEA CANÓNICA -------------------------------------------------------
// Los presupuestos escriben la misma línea de seis formas: "APP LT", "app lt",
// "applt", "apps lt", "ap lt", "tipo applt". Sin unificar, un vendedor no
// encuentra su módulo. Aquí se detecta SIEMPRE y se guarda con un solo nombre.
// El orden importa: "App LT" tiene que probarse ANTES que "App".
const LINEAS = [
  [/\bAPP?S?\s*-?\s*LT\b|\bAPPLT\b|\bAP\s*LT\b/, 'App LT'],
  [/\bECLIPSE\s+DRIFT\b|\bDRIFT\b/, 'Eclipse Drift'],
  [/\bECLIPSE\b/, 'Eclipse'],
  [/\bERGONOVA\s*4?\b|\bE4[A-Z]/, 'Ergonova 4'],
  [/\bWORK\s*LOUNGE\b|\bWLOHM\b/, 'Work Lounge'],
  [/\bTEAMSPACE\b/, 'TeamSpace II'],
  [/\bPRIVACY\s*4\b/, 'Privacy 4'],
  [/\bMODULOR\b|\bMOA[HP]|\bMOGARC/, 'Modulor'],
  [/\bMOX\b|\bMOXGAR/, 'Mox'],
  [/\bCIRQUE\b|\bCI[A-Z]{2,}\d/, 'Cirque'],
  [/\bFEATHER\b/, 'Feather'],
  [/\bSPINE\b/, 'Spine'],
  [/\bANTEO\b|\bAN[BCGM][A-Z]/, 'Anteo'],
  [/\bLUNA\b/, 'Luna'],
  [/\bALBA\b|\bABPATA|\bALPA/, 'Alba'],
  [/\bPEBBLE/, 'Pebble'],
  [/\bACCENTS\b|\bAC[GM][A-Z]/, 'Accents'],
  [/\bTETRIS\b/, 'Tetris'],
  [/\bARLEQUIN\b/, 'Arlequín'],
  [/\bPAC\b|\bPACSOINT\b/, 'Pac'],
  [/\bR[IÍ]O\b/, 'Río'],
  [/\bV[IÍ]A\b/, 'Vía'],
  [/\bWAND\b/, 'Wand'],
  [/\bBESPOKE\b|\bOCTA-?BACU/, 'Bespoke'],
  [/\bAPP\b|\bTAP[GOS]|\bTATO/, 'App'],
];
function lineaDe(r) {
  const t = N(`${r.linea_vh || ''} ${r.descripcion_literal || ''} ${r.clave || ''} ${r.modelo || ''}`);
  for (const [re, nombre] of LINEAS) if (re.test(t)) return nombre;
  return null;
}

// ---- NOMBRE CORTO Y BUSCABLE ----------------------------------------------
// "Modulo operativo , tipo applt 4 usuarios, bases metal, cubiertas, biomb…"
// no le sirve a nadie. Se arma: <Línea> · <Qué es> <medida> <N usuarios>.
// La descripción literal completa se conserva aparte, para no perder nada.
const QUE_ES = [
  [/MESA\s+DE\s+CONSEJO/, 'Mesa de consejo'], [/MESA\s+DE\s+JUNTAS|MODULO\s+DE\s+JUNTAS|MODULO\s+MESA\s+DE\s+JUNTAS/, 'Mesa de juntas'],
  [/MESA\s+CIRCULAR|CUBIERTA\s+CIRCULAR/, 'Mesa circular'], [/MESA\s+COMEDOR/, 'Mesa comedor'],
  [/MESA\s+ALTA|BARRA/, 'Mesa alta / barra'], [/MESA\s+DE\s+APOYO|MESA\s+LATERAL/, 'Mesa de apoyo'],
  [/MESA\s+DE\s+CENTRO/, 'Mesa de centro'], [/MESA\s+DE\s+TRABAJO/, 'Mesa de trabajo'],
  [/CABINA\s+TELEF/, 'Cabina telefónica'],
  [/RECEPCION/, 'Recepción'], [/DIRECTIVO/, 'Escritorio directivo'], [/GERENTE|GERENC/, 'Escritorio gerencial'],
  [/ESCRITORIO\s+EN\s+"?L"?|EN\s+"L"/, 'Escritorio en L'], [/ESCRITORIO/, 'Escritorio'],
  [/BANCA\s+DOBLE|BENCH\s+DOBLE/, 'Bench doble'], [/BANCA\s+SENCILLA|BENCH\s+SENCILLO/, 'Bench sencillo'],
  [/OPERATIVO|BENCH|BANCA/, 'Módulo operativo'], [/ESTACION/, 'Estación'],
  [/GAVETA\s+RODANTE/, 'Gaveta rodante'], [/GAVETA\s+PEDESTAL|PEDESTAL/, 'Gaveta pedestal'], [/GAVETA/, 'Gaveta'],
  [/ARCHIVERO\s+REGISTRO\s+LATERAL/, 'Archivero registro lateral'], [/ARCHIVERO/, 'Archivero'],
  [/CREDENZA/, 'Credenza'], [/ARMARIO|ROPERO/, 'Armario'], [/LOCKER/, 'Locker'], [/LIBRERO/, 'Librero'],
  [/GABINETE/, 'Gabinete'], [/MODULO\s+GUARDA|GUARDA/, 'Módulo guarda'], [/TORRE/, 'Torre'],
  [/PORTA\s*CPU/, 'Porta CPU'], [/ORGANIZADOR/, 'Organizador'], [/MACETA/, 'Maceta'],
  [/CANCEL/, 'Cancel'], [/PUERTA/, 'Puerta'], [/MAMPARA|SEMIMAMPARA/, 'Mampara'], [/MURO|LAMBRIN/, 'Muro'],
  [/SISTEMA\s+ELECTRICO|ELECTRIFICACION|CONTACTO/, 'Sistema eléctrico'], [/CAJA\s+ELECTRICA/, 'Caja eléctrica'],
  [/ACOMETIDA/, 'Acometida'], [/CONDUCTO|FALDON/, 'Conducto / faldón'],
  [/SILLA\s+OPERATIVA/, 'Silla operativa'], [/SILLA\s+EJECUTIVA|SILLA\s+DIRECTIVA/, 'Silla ejecutiva'],
  [/SILLA\s+PLEGABLE/, 'Silla plegable'], [/SILLA\s+PARA\s+VISITAS|SILLA\s+DE\s+VISITA|VISITAS/, 'Silla de visita'],
  [/BANCO\s+ALTO|BANCO/, 'Banco'], [/SILLA/, 'Silla'],
  [/SOFA\s+DE\s+2|2\s+PLAZAS/, 'Sofá 2 plazas'], [/SOFA|SILLON/, 'Sillón'],
  [/OMEGA/, 'Omega'], [/PATA/, 'Pata'], [/RIEL/, 'Riel'], [/CUBIERTA/, 'Cubierta'],
  [/BIOMBO/, 'Biombo'], [/SOPORTE/, 'Soporte'], [/COJIN/, 'Cojín'], [/TAPA/, 'Tapa'],
];
function queEs(r) {
  const t = N(`${r.descripcion_literal || ''} ${r.producto || ''} ${r.concepto || ''}`);
  for (const [re, nombre] of QUE_ES) if (re.test(t)) return nombre;
  return 'Producto';
}
// Modelo comercial que a veces trae la descripción (GAMMA-E, WIN-CAB, SONATA…).
function modeloDe(r) {
  const t = String(r.descripcion_literal || '');
  const m = /\bMODELO\s+"?([A-Z0-9][A-Z0-9\-\.]{2,18})"?/i.exec(t);
  if (!m) return null;
  const v = m[1].toUpperCase();
  if (/^(APP|APPLT|APPS|MODULOR|MOX|CIRQUE|ECLIPSE|ANTEO|ALBA|LUNA|RIO|VIA|ACCENTS|PEBBLE|TETRIS|PAC)$/.test(v)) return null;
  return v;
}

// Nombre corto y legible a partir de la descripción del presupuesto.
// Los presupuestos vienen EN MAYÚSCULAS y con la clave pegada al final. Aquí se
// arma un nombre corto y legible: se corta en la primera coma (lo de después es
// el detalle de materiales, que ya va en su propio campo), se pasa a minúsculas
// y se restauran los nombres propios de línea y modelo.
const PROPIOS = ['App LT', 'App', 'Modulor', 'Mox', 'Cirque', 'Eclipse', 'Anteo', 'Alba', 'Luna',
  'Río', 'Rio', 'Vía', 'Via', 'Feather', 'Spine', 'Ergonova', 'Pebble', 'Accents', 'Tetris',
  'Arlequín', 'Pac', 'Work Lounge', 'Privacy 4', 'TeamSpace', 'Wand', 'Byrne', 'Drift'];
function nombre(r) {
  let t = String(r.descripcion_literal || r.producto || '')
    .replace(/[\uFFFD]/g, '')                          // basura de codificación
    .replace(/\s+/g, ' ').trim();
  t = t.split(/\s+--+\s*/)[0];                        // corta la clave del final
  t = t.replace(/\bDE\s+[\d.,]+\s*[Xx]\s*[\d.,]+(\s*[Xx]\s*[\d.,]+)?\s*(mm|MM|m)?\b/g, ' ');
  const corte = t.indexOf(',');
  if (corte > 22) t = t.slice(0, corte);                // el resto es material
  t = t.replace(/\s*[;:]\s*$/, '').replace(/\s+/g, ' ').replace(/^[,;\s]+|[,;\s]+$/g, '');
  t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  for (const w of PROPIOS) t = t.replace(new RegExp(`\\b${w.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}\\b`, 'gi'), w);
  if (t.length > 72) t = t.slice(0, 71).trimEnd() + '…';
  return t || 'Producto';
}
// El nombre que VE el vendedor: línea + qué es + modelo. Corto y ordenable.
function nombreCorto(f) {
  const p = [f.linea, f.queEs];
  if (f.modelo) p.push(f.modelo);
  return p.filter(Boolean).join(' · ');
}
function medidas(r) {
  const p = [r.largo_mm, r.fondo_mm, r.alto_mm].filter((x) => Number.isFinite(x) && x > 0);
  if (!p.length) return '';
  return p.join(' × ') + ' mm';
}
function material(r) {
  const m = [...(r.materiales || []), ...(r.acabados || []), ...(r.incluye || [])];
  const t = [...new Set(m.map((x) => String(x).replace(/[\uFFFD]/g, '').trim()).filter(Boolean))].join(', ');
  return t.length > 110 ? t.slice(0, 109) + '…' : t;
}

const filas = [];
for (const d of docs) {
  const factor = conDescuento(d) ? 0.6 : 1;          // precio 2 → precio de lista
  const pres = d.encabezado?.presupuesto || d.documento || d.archivo;
  const fecha = d.encabezado?.fecha || '';
  for (const r of d.renglones || []) {
    if (r.familia === 'maniobras') continue;
    const precio = Math.round((r.p_unitario || 0) * factor);
    if (!(precio > 0)) continue;
    const cat = categoria(r);
    filas.push({
      cat, tipo: TIPO[cat] || 'especial',
      linea: lineaDe(r), usuarios: Number.isFinite(r.usuarios) ? r.usuarios : null,
      queEs: queEs(r), modelo: modeloDe(r),
      nombre: nombre(r), medidas: medidas(r), material: material(r),
      precio, fuente: pres, fecha, clave: r.clave || null,
    });
  }
}

// Dedup: mismo nombre + medidas + precio. Se queda el más reciente.
const vistos = new Map();
for (const f of filas.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) {
  f.corto = nombreCorto(f);
  // Mismo producto y misma medida = un solo renglón (se queda el más reciente).
  vistos.set(`${N(f.corto)}|${f.medidas}|${f.usuarios || ''}|${f.precio}`, f);
}
const unicos = [...vistos.values()];

const ORDEN = ['Operativos / Bench', 'Escritorios', 'Mesas de juntas', 'Guardas y archivo',
  'Mesas y complementos', 'Electrificación', 'Cancelería y muros', 'Componentes y refacciones', 'Sillería'];
unicos.sort((a, b) => (ORDEN.indexOf(a.cat) - ORDEN.indexOf(b.cat))
  || String(a.linea || 'zz').localeCompare(String(b.linea || 'zz'))
  || String(a.queEs).localeCompare(String(b.queEs))
  || a.precio - b.precio);

const slug = (s) => N(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34);
const usados = new Set();
const lineas = unicos.map((f, i) => {
  let id = `p9-${slug(f.corto)}-${f.precio}`;
  while (usados.has(id)) id += `-${i}`;
  usados.add(id);
  const campos = [
    `id: '${id}'`, `categoria: '${f.cat}'`, `tipo: '${f.tipo}'`,
    f.linea ? `linea: '${String(f.linea).replace(/'/g, '')}'` : null,
    f.usuarios ? `usuarios: ${f.usuarios}` : null,
    `nombre: ${JSON.stringify(f.corto)}`,
    `descripcion: ${JSON.stringify(f.nombre)}`,
    f.medidas ? `medidas: '${f.medidas}'` : null,
    f.material ? `material: ${JSON.stringify(f.material)}` : null,
    `precio: ${f.precio}`, `fuente: '${f.fuente}'`,
    f.clave ? `clave: '${f.clave}'` : null,
  ].filter(Boolean);
  return `  { ${campos.join(', ')} },`;
});

const porCat = {};
for (const f of unicos) porCat[f.cat] = (porCat[f.cat] || 0) + 1;
console.error(`${filas.length} renglones → ${unicos.length} únicos`);
for (const [c, n] of Object.entries(porCat)) console.error(`  ${String(n).padStart(3)}  ${c}`);
const sinLinea = unicos.filter((f) => !f.linea);
console.error(`  sin línea identificada: ${sinLinea.length}`);
for (const f of sinLinea.slice(0, 12)) console.error(`      ${f.corto}  ·  ${String(f.nombre).slice(0, 60)}`);
const lineas2 = {};
for (const f of unicos) lineas2[f.linea || '—'] = (lineas2[f.linea || '—'] || 0) + 1;
console.error('  por línea: ' + Object.entries(lineas2).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));

console.log(lineas.join('\n'));
