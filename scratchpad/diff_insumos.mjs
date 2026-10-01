// Diff SEMILLA (código, 254) ↔ nube (config.datos.insumos, 92) — audit 2026-10-01.
// Categoriza: igual / cambió (precio o unidad) / solo_codigo / solo_nube.
import { INSUMOS_SEMILLA } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/datos/insumos.js';

// Snapshot de la nube (config.datos.insumos) tomado por MCP el 2026-10-01.
const NUBE = {
 'acab-satinado':{p:120,u:'m2'},'acometida':{p:850,u:'pza'},'acrilico':{p:890,u:'m2'},'acrilico-12':{p:1180,u:'m2'},'acrilico-6':{p:690,u:'m2'},'aglomerado':{p:480,u:'hoja'},'anodizado':{p:45,u:'m'},'archivo-lateral':{p:4200,u:'pza'},'arnes':{p:1450,u:'pza'},'barniz':{p:95,u:'m2'},'base-motorizada':{p:5885,u:'pza'},'bastidor-madera':{p:420,u:'pza'},'bastidor-mampara':{p:680,u:'m2'},'bisagra':{p:85,u:'pza'},'byrne-interlink':{p:3012,u:'pza'},'byrne-node':{p:1607,u:'pza'},'byrne-phase2':{p:700,u:'pza'},'caja-electrica':{p:650,u:'pza'},'cajonera-movil':{p:2100,u:'pza'},'cerradura':{p:110,u:'pza'},'cerradura-electronica':{p:1850,u:'pza'},'chapa-madera':{p:850,u:'m2'},'chapa-walnut':{p:716,u:'hoja'},'charola':{p:145,u:'m'},'chicote':{p:38,u:'m'},'contacto':{p:95,u:'pza'},'corredera':{p:95,u:'par'},'credenza':{p:6500,u:'pza'},'cristal-flotado':{p:760,u:'m2'},'cristal-satinado':{p:780,u:'m2'},'cristal-templado':{p:980,u:'m2'},'cristal-templado-12':{p:1240,u:'m2'},'cristal-templado-6':{p:720,u:'m2'},'divisor-melamina':{p:320,u:'m2'},'ducto':{p:180,u:'m'},'ecocrom':{p:180,u:'m2'},'ecopiel':{p:340,u:'m'},'escuadra':{p:28,u:'pza'},'espuma':{p:260,u:'m2'},'espuma-termoformada':{p:580,u:'pza'},'faldon-abs':{p:180,u:'pza'},'faldon-melamina':{p:320,u:'m2'},'foil-pvc':{p:290,u:'m2'},'frente-metal':{p:520,u:'m2'},'frente-tela':{p:420,u:'m2'},'granallado':{p:55,u:'m2'},'inoxidable':{p:135,u:'kg'},'jaladera':{p:45,u:'pza'},'lamina-10':{p:33,u:'kg'},'lamina-12':{p:33,u:'kg'},'lamina-14':{p:33,u:'kg'},'lamina-18':{p:34,u:'kg'},'lamina-20':{p:32,u:'kg'},'lamina-22':{p:33,u:'kg'},'laminado':{p:420,u:'m2'},'marmol':{p:2400,u:'m2'},'marmol-premium':{p:2800,u:'m2'},'mdf':{p:210,u:'m2'},'mdf-16':{p:560,u:'hoja'},'melamina-16':{p:900,u:'hoja'},'melamina-19':{p:320,u:'m2'},'melamina-28':{p:1280,u:'hoja'},'melamina-9':{p:625,u:'hoja'},'membrana-pvc':{p:260,u:'m2'},'nivelador':{p:12,u:'pza'},'nogal':{p:420,u:'pie_tab'},'pasacables':{p:35,u:'pza'},'pata-metalica':{p:380,u:'pza'},'pedestal':{p:1850,u:'pza'},'perfil-aluminio':{p:95,u:'m'},'pet-acustico':{p:1150,u:'m2'},'piel-napa':{p:1900,u:'m2'},'pintura-electrostatica':{p:110,u:'m2'},'policarbonato':{p:1012.6,u:'m2'},'ptr':{p:42,u:'m'},'ptr-10':{p:70,u:'m'},'ptr-12':{p:58,u:'m'},'ptr-14':{p:48,u:'m'},'remate-aluminio':{p:95,u:'m'},'riel':{p:1250,u:'juego'},'rodaja':{p:22,u:'pza'},'serigrafia':{p:150,u:'m2'},'silicon':{p:180,u:'pza'},'soldadura':{p:65,u:'kg'},'tapa-abatible':{p:320,u:'pza'},'tapacanto':{p:10,u:'m'},'tapacanto-3mm':{p:25,u:'m'},'tela':{p:280,u:'m'},'tornilleria':{p:45,u:'juego'},'torre':{p:5600,u:'pza'},'usb-hdmi':{p:320,u:'pza'},'wally':{p:1900,u:'pza'},
};

const cod = {};
for (const i of INSUMOS_SEMILLA) cod[i.id] = { p: Number(i.precio), u: i.unidad };

const soloCodigo=[], soloNube=[], cambio=[], igual=[];
for (const id of Object.keys(cod)) {
  if (!(id in NUBE)) { soloCodigo.push(id); continue; }
  const c=cod[id], n=NUBE[id];
  if (Math.abs(c.p-n.p)>0.005 || c.u!==n.u) cambio.push({id, cod:`${c.p} ${c.u}`, nube:`${n.p} ${n.u}`, unidadDistinta: c.u!==n.u});
  else igual.push(id);
}
for (const id of Object.keys(NUBE)) if (!(id in cod)) soloNube.push(id);

console.log(`SEMILLA(codigo): ${Object.keys(cod).length}  ·  NUBE: ${Object.keys(NUBE).length}`);
console.log(`\nigual_en_ambos: ${igual.length}`);
console.log(`cambio (precio/unidad): ${cambio.length}`);
console.log(`solo_codigo: ${soloCodigo.length}`);
console.log(`solo_nube: ${soloNube.length}`);

const unidadDif = cambio.filter(c=>c.unidadDistinta);
console.log(`\n** CAMBIO LA UNIDAD (riesgo de costeo, ${unidadDif.length}):`);
for (const c of unidadDif) console.log(`  ${c.id}: codigo ${c.cod}  vs  nube ${c.nube}`);

console.log(`\nCAMBIO SOLO PRECIO (muestra 15 de ${cambio.length-unidadDif.length}):`);
for (const c of cambio.filter(c=>!c.unidadDistinta).slice(0,15)) console.log(`  ${c.id}: codigo ${c.cod}  vs  nube ${c.nube}`);

console.log(`\nsolo_nube (en el app vivo, NO en codigo): ${soloNube.join(', ') || '(ninguno)'}`);
console.log(`\nsolo_codigo: ${soloCodigo.length} ids (acabados generados + retail nuevos + calibres).`);
