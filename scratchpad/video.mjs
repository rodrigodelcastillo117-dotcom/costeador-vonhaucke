// Genera UN video de producto con Veo, arrancando desde el render de catálogo
// del propio mueble (así el video es de NUESTRO producto, no de uno parecido).
// Uso: node scratchpad/video.mjs applt banca_doble
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const FN = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/generar-video';
const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const RENDER = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/render-ia';

const [ruta, prodId] = process.argv.slice(2);
const cat = JSON.parse(readFileSync('scratchpad/catalogo_render.json', 'utf8'));
const it = cat.items.find((i) => i.ruta === ruta && i.prodId === prodId);
if (!it) { console.error('No existe', ruta, prodId); process.exit(1); }

// El prompt que corrige lo que confundió a Veo: "detalle" NO es acercarse.
const prompt =
  `Cinematic product video of one piece of office furniture on a seamless light-grey studio cyclorama. ` +
  `Slow continuous 40-degree orbit around the piece, constant speed, no cuts, camera at eye level slightly above the top surface. ` +
  `CRITICAL: the ENTIRE piece stays fully inside the frame for the whole shot, with clear empty margin on all four sides. ` +
  `Never crop it and never push in on a detail — "detail" here means sharp focus and true materials, not a close-up. ` +
  `The piece: ${it.nombre} (Von Haucke ${it.linea}), ${it.medidas}. ` +
  (it.materiales?.length ? `Materials: ${it.materiales.join(', ')}. ` : '') +
  `Keep the design, proportions, configuration and materials EXACTLY as in the reference image. ` +
  `Do not redesign it, do not add or remove modules, do not change the wood tone, nothing appears or disappears mid-shot. ` +
  `Lighting: large soft key from upper left, gentle fill from the right, neutral white balance, soft contact shadow under the piece. ` +
  `Nothing else in frame: no people, no plants, no laptops, no text, no logos. ` +
  `Leave generous empty floor space in the lower part of the frame.`;

const post = (b) => fetch(FN, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: LLAVE, Authorization: `Bearer ${LLAVE}` },
  body: JSON.stringify(b),
}).then((r) => r.json());

const foto = await fetch(`${RENDER}/${ruta}/${prodId}.jpg`)
  .then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()).toString('base64') : null));
if (!foto) { console.error('No se pudo bajar el render de referencia'); process.exit(1); }

console.log('producto :', it.nombre);
console.log('medidas  :', it.medidas);
const t0 = Date.now();
const ini = await post({ accion: 'iniciar', prompt, imagen: foto, aspecto: '16:9', segundos: 8 });
if (!ini.ok) { console.error('✗', ini.error); process.exit(1); }
console.log('operación:', ini.operacion);

let n = 0;
while (n++ < 60) {
  await new Promise((r) => setTimeout(r, 10000));
  const e = await post({ accion: 'estado', operacion: ini.operacion });
  if (!e.ok) { console.error('✗', e.error); process.exit(1); }
  if (!e.listo) { process.stdout.write('.'); continue; }
  mkdirSync('scratchpad/videos', { recursive: true });
  const f = `scratchpad/videos/${ruta}-${prodId}.mp4`;
  writeFileSync(f, Buffer.from(e.base64, 'base64'));
  console.log(`\n✓ ${f} — ${(e.bytes / 1048576).toFixed(2)} MB en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(0);
}
console.error('\n✗ se pasó del tiempo de espera');
process.exit(1);
