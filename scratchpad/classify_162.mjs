// Clasifica automaticamente los solo-codigo (en SEMILLA, no en nube) para reducir
// la decision humana (audit 2026-10-01). NO toca config ni el catalogo.
// Señales: (1) uso real = referenciado en modelos de src/ ; (2) fuente ; (3) fecha/categoria.
// Buckets: vigente (usado) | nuevo (sin uso pero con fuente reciente/retail) | revisar (sin uso ni fuente).
import { INSUMOS_SEMILLA } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/datos/insumos.js';
import fs from 'fs';
import path from 'path';

const NUBE_IDS = new Set(['acab-satinado','acometida','acrilico','acrilico-12','acrilico-6','aglomerado','anodizado','archivo-lateral','arnes','barniz','base-motorizada','bastidor-madera','bastidor-mampara','bisagra','byrne-interlink','byrne-node','byrne-phase2','caja-electrica','cajonera-movil','cerradura','cerradura-electronica','chapa-madera','chapa-walnut','charola','chicote','contacto','corredera','credenza','cristal-flotado','cristal-satinado','cristal-templado','cristal-templado-12','cristal-templado-6','divisor-melamina','ducto','ecocrom','ecopiel','escuadra','espuma','espuma-termoformada','faldon-abs','faldon-melamina','foil-pvc','frente-metal','frente-tela','granallado','inoxidable','jaladera','lamina-10','lamina-12','lamina-14','lamina-18','lamina-20','lamina-22','laminado','marmol','marmol-premium','mdf','mdf-16','melamina-16','melamina-19','melamina-28','melamina-9','membrana-pvc','nivelador','nogal','pasacables','pata-metalica','pedestal','perfil-aluminio','pet-acustico','piel-napa','pintura-electrostatica','policarbonato','ptr','ptr-10','ptr-12','ptr-14','remate-aluminio','riel','rodaja','serigrafia','silicon','soldadura','tapa-abatible','tapacanto','tapacanto-3mm','tela','tornilleria','torre','usb-hdmi','wally']);

// Concatena todo src/ EXCEPTO la definicion insumos.js (para medir uso real en modelos).
const SRC = '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src';
let blob = '';
(function walk(dir){
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name) && e.name !== 'insumos.js') blob += '\n' + fs.readFileSync(p,'utf8');
  }
})(SRC);
// + las 3 piezas custom de config (referencian insumoIds)
try { blob += '\n' + fs.readFileSync('/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/scratchpad/config_piezas.txt','utf8'); } catch {}

const usado = (id) => blob.includes(`"${id}"`) || blob.includes(`'${id}'`) || blob.includes('`'+id+'`');

const cod = {}; for (const i of INSUMOS_SEMILLA) cod[i.id] = i;
const solo = Object.keys(cod).filter(id => !NUBE_IDS.has(id));

// Regla conservadora: solo el campo fuente REAL cuenta como evidencia de "nuevo".
const buckets = { vigente: [], nuevo: [], revisar: [] };
for (const id of solo) {
  const i = cod[id];
  const tieneFuente = !!i.fuente;
  if (usado(id)) buckets.vigente.push({id, f:tieneFuente, fuente:i.fuente||null});
  else if (tieneFuente) buckets.nuevo.push({id, f:true, fuente:i.fuente});
  else buckets.revisar.push({id, seccion:i.seccion, nombre:i.nombre});
}

console.log(`solo-codigo total: ${solo.length}`);
console.log(`  vigente (usado en modelos de src): ${buckets.vigente.length}  -> ENTRAN`);
console.log(`  nuevo   (sin uso, con fuente/retail reciente): ${buckets.nuevo.length}  -> ENTRAN`);
console.log(`  revisar (sin uso y sin fuente): ${buckets.revisar.length}  -> DECISION HUMANA`);
console.log(`\n== REVISAR (${buckets.revisar.length}) por seccion ==`);
const porSeccion = {};
for (const r of buckets.revisar) (porSeccion[r.seccion] = porSeccion[r.seccion]||[]).push(r.id);
for (const s of Object.keys(porSeccion).sort()) console.log(`  [${s}] ${porSeccion[s].join(', ')}`);
console.log(`\n== VIGENTE sin fuente (entran por uso, pero precio no certificable) ==`);
console.log('  ' + buckets.vigente.filter(x=>!x.f).map(x=>x.id).join(', '));

fs.writeFileSync('/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/scratchpad/clasificacion_162.json', JSON.stringify(buckets,null,1));
