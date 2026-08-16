// ============================================================================
//  BATCH de renders de catálogo (los 67 productos con foto).
//  Por producto: foto real como referencia -> Gemini (modo catalogo, fondo
//  plano) -> encuadre determinista en Python -> scratchpad/final/<ruta>-<prod>.jpg
//  Reintenta los que fallen. Escribe scratchpad/batch_reporte.json.
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const URL_FN = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/generar-render';
const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const PARALELO = 3;
const INTENTOS = 3;

const cat = JSON.parse(readFileSync('scratchpad/catalogo_render.json', 'utf8'));
mkdirSync('scratchpad/renders', { recursive: true });
mkdirSync('scratchpad/final', { recursive: true });

const descripcionDe = (i) =>
  `${i.nombre} (línea Von Haucke ${i.linea}). Dimensiones exactas: ${i.medidas}.` +
  (i.materiales.length ? ` Materiales: ${i.materiales.join(', ')}.` : '');

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function fotoRef(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('foto ' + r.status);
  return Buffer.from(await r.arrayBuffer()).toString('base64');
}

async function generar(it) {
  const imagen = await fotoRef(it.foto);
  const r = await fetch(URL_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: LLAVE, Authorization: `Bearer ${LLAVE}` },
    body: JSON.stringify({
      descripcion: descripcionDe(it), tipo: it.tipo, medidas: it.medidas,
      materiales: it.materiales, imagen, mediaType: 'image/jpeg', modo: 'catalogo',
    }),
  });
  const j = await r.json();
  if (!j.ok || !j.dataUrl) throw new Error(j.error || 'sin imagen');
  return Buffer.from(j.dataUrl.split(',')[1], 'base64');
}

async function unProducto(it) {
  const base = `${it.ruta}-${it.prodId}`;
  const crudo = `scratchpad/renders/${base}.jpg`;
  const fin = `scratchpad/final/${base}.jpg`;
  if (existsSync(fin) && statSync(fin).size > 15000 && !process.env.REHACER) {
    return { ...ident(it), estado: 'ya-estaba', kb: Math.round(statSync(fin).size / 1024) };
  }
  let ultimo = '';
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      writeFileSync(crudo, await generar(it));
      const enc = execFileSync('python3', ['scratchpad/encuadrar.py', crudo, fin], { encoding: 'utf8' }).trim();
      return { ...ident(it), estado: 'ok', intento, encuadre: enc, kb: Math.round(statSync(fin).size / 1024) };
    } catch (e) {
      ultimo = String(e.message || e);
      await dormir(1500 * intento);
    }
  }
  return { ...ident(it), estado: 'FALLO', error: ultimo };
}

const ident = (it) => ({ ruta: it.ruta, prodId: it.prodId, nombre: it.nombre, medidas: it.medidas, tipo: it.tipo });

const cola = cat.items.slice();
const hechos = [];
let n = 0;
async function trabajador(id) {
  while (cola.length) {
    const it = cola.shift();
    const r = await unProducto(it);
    hechos.push(r);
    n++;
    const marca = r.estado === 'ok' ? '✓' : r.estado === 'ya-estaba' ? '·' : '✗';
    console.log(`${marca} [${String(n).padStart(2)}/${cat.items.length}] ${(r.ruta + '/' + r.prodId).padEnd(28)} ${r.estado}${r.error ? ' — ' + r.error : ''}`);
  }
}

const t0 = Date.now();
await Promise.all(Array.from({ length: PARALELO }, (_, i) => trabajador(i)));
const fallos = hechos.filter((h) => h.estado === 'FALLO');
writeFileSync('scratchpad/batch_reporte.json', JSON.stringify({
  total: hechos.length, ok: hechos.filter((h) => h.estado === 'ok').length,
  yaEstaban: hechos.filter((h) => h.estado === 'ya-estaba').length,
  fallos: fallos.length, minutos: +((Date.now() - t0) / 60000).toFixed(1), items: hechos,
}, null, 1));
console.log(`\nLISTO en ${((Date.now() - t0) / 60000).toFixed(1)} min — ok ${hechos.filter((h) => h.estado === 'ok').length}, ya estaban ${hechos.filter((h) => h.estado === 'ya-estaba').length}, fallos ${fallos.length}`);
for (const f of fallos) console.log('  ✗', f.ruta + '/' + f.prodId, f.error);
