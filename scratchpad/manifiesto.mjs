// Genera el bloque RENDER_IA de src/datos/imagenes.js a partir de lo que quedó
// en scratchpad/final/, con las medidas del catálogo canónico.
// Uso: node scratchpad/manifiesto.mjs   (imprime el bloque para pegar)
import { readFileSync, readdirSync, statSync } from 'node:fs';

const cat = JSON.parse(readFileSync('scratchpad/catalogo_render.json', 'utf8'));
const hay = new Set(
  readdirSync('scratchpad/final')
    .filter((f) => f.endsWith('.jpg') && statSync(`scratchpad/final/${f}`).size > 15000)
    .map((f) => f.replace(/\.jpg$/, '')),
);

const porRuta = {};
const fichas = [];
for (const i of cat.items) {
  if (!hay.has(`${i.ruta}-${i.prodId}`)) continue;
  (porRuta[i.ruta] = porRuta[i.ruta] || []).push(i.prodId);
  fichas.push(`  '${i.ruta}/${i.prodId}': { w: ${i.w}, d: ${i.d}, alto: ${i.alto}, tipo: '${i.tipo}', medidas: '${i.medidas}' },`);
}

const lineas = Object.entries(porRuta)
  .sort()
  .map(([r, ps]) => `  ${r}: [${ps.sort().map((p) => `'${p}'`).join(', ')}],`);

console.log(`// Renders de catálogo generados con IA (fondo plano, encuadre uniforme).
// Archivos en el bucket público 'app', prefijo: render-ia/<ruta>/<producto>.jpg
const RENDER_IA_BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/render-ia';

// Productos que YA tienen render de catálogo con IA.
export const RENDER_IA = {
${lineas.join('\n')}
};

// Ficha técnica del render: medidas reales del producto en la configuración
// representativa (las calcula el mismo motor que cotiza).
export const FICHA_RENDER = {
${fichas.join('\n')}
};

export const renderIA = (ruta, prodId) =>
  (RENDER_IA[ruta] || []).includes(prodId) ? \`\${RENDER_IA_BASE}/\${ruta}/\${prodId}.jpg\` : null;

export const fichaRender = (ruta, prodId) => FICHA_RENDER[\`\${ruta}/\${prodId}\`] || null;`);

console.error(`\n-> ${fichas.length} productos con render listo, en ${lineas.length} líneas`);
