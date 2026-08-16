// Inserta/reemplaza el bloque RENDER_IA + FICHA_RENDER dentro de
// src/datos/imagenes.js, entre marcadores, para poder regenerarlo sin romper
// el resto del archivo.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';

const INI = '// <<< RENDER_IA generado por scratchpad/aplicar_manifiesto.mjs — no editar a mano';
const FIN = '// >>> fin RENDER_IA';

const cat = JSON.parse(readFileSync('scratchpad/catalogo_render.json', 'utf8'));
const hay = new Set(
  readdirSync('scratchpad/final')
    .filter((f) => f.endsWith('.jpg') && statSync(`scratchpad/final/${f}`).size > 15000)
    .map((f) => f.replace(/\.jpg$/, '')),
);

const porRuta = {}, fichas = [];
for (const i of cat.items) {
  if (!hay.has(`${i.ruta}-${i.prodId}`)) continue;
  (porRuta[i.ruta] = porRuta[i.ruta] || []).push(i.prodId);
  fichas.push(`  '${i.ruta}/${i.prodId}': { w: ${i.w}, d: ${i.d}, alto: ${i.alto}, tipo: '${i.tipo}', medidas: '${i.medidas}' },`);
}
const lineas = Object.entries(porRuta).sort().map(([r, ps]) => `  ${r}: [${ps.sort().map((p) => `'${p}'`).join(', ')}],`);

const bloque = `${INI}
// Render de catálogo por producto: se generó con Gemini usando la FOTO REAL como
// referencia y luego se encuadró igual para todos (fondo plano, misma escala).
const RENDER_IA_BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/render-ia';

export const RENDER_IA = {
${lineas.join('\n')}
};

// Medidas reales del producto tal como se ve en el render (configuración
// representativa), calculadas por el mismo motor que cotiza.
export const FICHA_RENDER = {
${fichas.join('\n')}
};

export const renderIA = (ruta, prodId) =>
  (RENDER_IA[ruta] || []).includes(prodId) ? \`\${RENDER_IA_BASE}/\${ruta}/\${prodId}.jpg\` : null;

export const fichaRender = (ruta, prodId) => FICHA_RENDER[\`\${ruta}/\${prodId}\`] || null;
${FIN}`;

const p = 'src/datos/imagenes.js';
let s = readFileSync(p, 'utf8');
if (s.includes(INI)) {
  s = s.slice(0, s.indexOf(INI)) + bloque + s.slice(s.indexOf(FIN) + FIN.length);
} else {
  s = s.trimEnd() + '\n\n' + bloque + '\n';
}
writeFileSync(p, s);
console.log(`RENDER_IA aplicado: ${fichas.length} productos en ${lineas.length} líneas`);
