// Prueba UN render de catálogo end-to-end (foto real como referencia → Gemini).
// Uso: node scratchpad/render_uno.mjs applt banca_doble
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const URL_FN = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/generar-render';
const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';

const [ruta, prodId] = process.argv.slice(2);
const cat = JSON.parse(readFileSync('scratchpad/catalogo_render.json', 'utf8'));
const it = cat.items.find((i) => i.ruta === ruta && i.prodId === prodId);
if (!it) { console.error('No existe', ruta, prodId); process.exit(1); }

// Descripción rica: producto + línea + medidas exactas + materiales reales.
export function descripcionDe(i) {
  return `${i.nombre} (línea Von Haucke ${i.linea}). Dimensiones exactas: ${i.medidas}.` +
    (i.materiales.length ? ` Materiales: ${i.materiales.join(', ')}.` : '');
}

const fotoB64 = await (async () => {
  const r = await fetch(it.foto);
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer()).toString('base64');
})();
if (!fotoB64) { console.error('No se pudo bajar la foto de referencia:', it.foto); process.exit(1); }

const t0 = Date.now();
const res = await fetch(URL_FN, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: LLAVE, Authorization: `Bearer ${LLAVE}` },
  body: JSON.stringify({
    descripcion: descripcionDe(it), tipo: it.tipo, medidas: it.medidas,
    materiales: it.materiales, imagen: fotoB64, mediaType: 'image/jpeg', modo: 'catalogo',
  }),
});
const j = await res.json();
console.log('http', res.status, '| ok', j.ok, '| ms', Date.now() - t0, j.error ? '| ' + j.error : '');
if (j.ok && j.dataUrl) {
  mkdirSync('scratchpad/renders', { recursive: true });
  const b = Buffer.from(j.dataUrl.split(',')[1], 'base64');
  const f = `scratchpad/renders/${ruta}-${prodId}.jpg`;
  writeFileSync(f, b);
  console.log('guardado', f, (b.length / 1024).toFixed(0) + ' KB');
}
