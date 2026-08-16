// ============================================================================
//  RENDERS DE LOS PRODUCTOS SIN FOTO
//
//  51 de los 118 productos del catálogo no tienen NI foto NI render: salen en
//  blanco en la paleta, en las pantallas de línea y en el catálogo.
//  Como no hay foto de esa pieza, no se puede bloquear su geometría con una
//  imagen. Lo que sí se puede: darle como referencia la foto de OTRO producto
//  de LA MISMA LÍNEA, para que herede el lenguaje de la familia (perfil de pata,
//  tono de madera, canto, herrajes) aunque la pieza sea distinta; y describir la
//  pieza con sus MEDIDAS y MATERIALES reales, sacados de su propio despiece.
//
//    node scratchpad/faltantes.mjs            → genera los que faltan
//    REHACER=1 node scratchpad/faltantes.mjs  → rehace todos
// ============================================================================
import { writeFileSync, existsSync, statSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { LINEAS_REG, configDesde } from '../src/datos/lineas.js';
import { imagenProducto, fotoProducto } from '../src/datos/imagenes.js';

const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const URL_FN = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/generar-render';
const PARALELO = 3;
const INTENTOS = 3;
mkdirSync('scratchpad/renders', { recursive: true });
mkdirSync('scratchpad/final', { recursive: true });

// Una foto REAL de la misma línea, para heredar el lenguaje de la familia.
function refDeLinea(ruta) {
  const L = LINEAS_REG[ruta];
  for (const p of L.productos || []) {
    const u = imagenProducto(ruta, p.id);
    if (u) return u;
  }
  return null;
}

// Medidas y materiales REALES de la pieza, de su propio despiece.
function fichaDe(ruta, prod) {
  const g = LINEAS_REG[ruta].generar(configDesde(prod, {}));
  let w = 0, d = 0, area = 0, alto = 0;
  const mats = new Set();
  for (const c of g.componentes || []) {
    if (c.insumoId) mats.add(String(c.insumoId).replace(/-\d+$/, '').replace(/-/g, ' '));
    if (c.largoMM && c.anchoMM) {
      const a = c.largoMM * c.anchoMM;
      if (a > area) { area = a; w = c.largoMM; d = c.anchoMM; }
    }
  }
  alto = g.alto || 0;
  const m = [];
  if (w && d) m.push(`${(w / 1000).toFixed(2)} × ${(d / 1000).toFixed(2)} m`);
  if (alto) m.push(`alto ${(alto / 1000).toFixed(2)} m`);
  return { nombre: g.nombre, medidas: m.join(' · '), materiales: [...mats].slice(0, 6), claves: (g.claves || []).slice(0, 4) };
}

const pend = [];
for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  const ref = refDeLinea(ruta);
  for (const p of L.productos || []) {
    if (imagenProducto(ruta, p.id) || fotoProducto?.(ruta, p.id)) continue;
    const f = fichaDe(ruta, p);
    pend.push({ ruta, prodId: p.id, linea: L.titulo, ref, ...f });
  }
}
console.log(`${pend.length} productos sin imagen · ${pend.filter((x) => x.ref).length} con foto hermana de su línea`);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function b64(url) {
  const r = await fetch(url); if (!r.ok) throw new Error('foto ' + r.status);
  return Buffer.from(await r.arrayBuffer()).toString('base64');
}

async function generar(it) {
  const imagen = it.ref ? await b64(it.ref) : '';
  // Con foto hermana el modo es 'catalogo' (misma puesta en escena que los 67
  // que ya existen) pero se le avisa que la referencia es de OTRA pieza: si no,
  // copia la pieza de la foto y devuelve un duplicado.
  const desc = imagen
    ? `IMPORTANT: the reference image shows a DIFFERENT product of the same Von Haucke line (${it.linea}). ` +
      `Use it ONLY for the family language — leg profile, wood tone, edge banding, hardware, proportions of detail — ` +
      `NOT for the shape. The product to render is: ${it.nombre}. Build THAT piece.`
    : `${it.nombre} (línea Von Haucke ${it.linea}).`;
  const r = await fetch(URL_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: LLAVE, Authorization: `Bearer ${LLAVE}` },
    body: JSON.stringify({
      descripcion: desc, medidas: it.medidas, materiales: it.materiales,
      ...(imagen ? { imagen, mediaType: 'image/jpeg' } : {}),
      modo: 'catalogo', aspecto: '4:3',
    }),
  });
  const j = await r.json();
  if (!j.ok || !j.dataUrl) throw new Error(j.error || 'sin imagen');
  return Buffer.from(j.dataUrl.split(',')[1], 'base64');
}

async function uno(it) {
  const base = `${it.ruta}-${it.prodId}`;
  const crudo = `scratchpad/renders/${base}.jpg`;
  const fin = `scratchpad/final/${base}.jpg`;
  if (existsSync(fin) && statSync(fin).size > 15000 && !process.env.REHACER) return 'ya estaba';
  for (let i = 1; i <= INTENTOS; i++) {
    try {
      writeFileSync(crudo, await generar(it));
      execFileSync('python3', ['scratchpad/encuadrar.py', crudo, fin], { encoding: 'utf8' });
      return 'ok';
    } catch (e) {
      if (i === INTENTOS) throw e;
      await dormir(1500 * i);
    }
  }
}

let ok = 0, mal = 0, n = 0;
const cola = [...pend];
async function trabajador() {
  while (cola.length) {
    const it = cola.shift(); n++;
    const etq = `[${n}/${pend.length}] ${it.ruta}/${it.prodId}`;
    try { const r = await uno(it); ok++; console.log(`✓ ${etq.padEnd(38)} ${r}`); }
    catch (e) { mal++; console.log(`✗ ${etq.padEnd(38)} ${String(e.message).slice(0, 70)}`); }
  }
}
await Promise.all(Array.from({ length: PARALELO }, trabajador));
console.log(`\nLISTO — ok ${ok}, fallos ${mal}`);
writeFileSync('scratchpad/faltantes_reporte.json', JSON.stringify({ pend: pend.map((p) => `${p.ruta}/${p.prodId}`), ok, mal }, null, 1));
