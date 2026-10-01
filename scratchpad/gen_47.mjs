// Tabla de los 47 conflictos de SOLO PRECIO (misma unidad), ordenada por |Δ| — audit 2026-10-01.
import { INSUMOS_SEMILLA } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/datos/insumos.js';
const NUBE = {
 'acab-satinado':{p:120,u:'m2'},'acometida':{p:850,u:'pza'},'acrilico':{p:890,u:'m2'},'acrilico-12':{p:1180,u:'m2'},'acrilico-6':{p:690,u:'m2'},'aglomerado':{p:480,u:'hoja'},'anodizado':{p:45,u:'m'},'archivo-lateral':{p:4200,u:'pza'},'arnes':{p:1450,u:'pza'},'barniz':{p:95,u:'m2'},'base-motorizada':{p:5885,u:'pza'},'bastidor-madera':{p:420,u:'pza'},'bastidor-mampara':{p:680,u:'m2'},'bisagra':{p:85,u:'pza'},'byrne-interlink':{p:3012,u:'pza'},'byrne-node':{p:1607,u:'pza'},'byrne-phase2':{p:700,u:'pza'},'caja-electrica':{p:650,u:'pza'},'cajonera-movil':{p:2100,u:'pza'},'cerradura':{p:110,u:'pza'},'cerradura-electronica':{p:1850,u:'pza'},'chapa-madera':{p:850,u:'m2'},'chapa-walnut':{p:716,u:'hoja'},'charola':{p:145,u:'m'},'chicote':{p:38,u:'m'},'contacto':{p:95,u:'pza'},'corredera':{p:95,u:'par'},'credenza':{p:6500,u:'pza'},'cristal-flotado':{p:760,u:'m2'},'cristal-satinado':{p:780,u:'m2'},'cristal-templado':{p:980,u:'m2'},'cristal-templado-12':{p:1240,u:'m2'},'cristal-templado-6':{p:720,u:'m2'},'divisor-melamina':{p:320,u:'m2'},'ducto':{p:180,u:'m'},'ecocrom':{p:180,u:'m2'},'ecopiel':{p:340,u:'m'},'escuadra':{p:28,u:'pza'},'espuma':{p:260,u:'m2'},'espuma-termoformada':{p:580,u:'pza'},'faldon-abs':{p:180,u:'pza'},'faldon-melamina':{p:320,u:'m2'},'foil-pvc':{p:290,u:'m2'},'frente-metal':{p:520,u:'m2'},'frente-tela':{p:420,u:'m2'},'granallado':{p:55,u:'m2'},'inoxidable':{p:135,u:'kg'},'jaladera':{p:45,u:'pza'},'lamina-10':{p:33,u:'kg'},'lamina-12':{p:33,u:'kg'},'lamina-14':{p:33,u:'kg'},'lamina-18':{p:34,u:'kg'},'lamina-20':{p:32,u:'kg'},'lamina-22':{p:33,u:'kg'},'laminado':{p:420,u:'m2'},'marmol':{p:2400,u:'m2'},'marmol-premium':{p:2800,u:'m2'},'mdf':{p:210,u:'m2'},'mdf-16':{p:560,u:'hoja'},'melamina-16':{p:900,u:'hoja'},'melamina-19':{p:320,u:'m2'},'melamina-28':{p:1280,u:'hoja'},'melamina-9':{p:625,u:'hoja'},'membrana-pvc':{p:260,u:'m2'},'nivelador':{p:12,u:'pza'},'nogal':{p:420,u:'pie_tab'},'pasacables':{p:35,u:'pza'},'pata-metalica':{p:380,u:'pza'},'pedestal':{p:1850,u:'pza'},'perfil-aluminio':{p:95,u:'m'},'pet-acustico':{p:1150,u:'m2'},'piel-napa':{p:1900,u:'m2'},'pintura-electrostatica':{p:110,u:'m2'},'policarbonato':{p:1012.6,u:'m2'},'ptr':{p:42,u:'m'},'ptr-10':{p:70,u:'m'},'ptr-12':{p:58,u:'m'},'ptr-14':{p:48,u:'m'},'remate-aluminio':{p:95,u:'m'},'riel':{p:1250,u:'juego'},'rodaja':{p:22,u:'pza'},'serigrafia':{p:150,u:'m2'},'silicon':{p:180,u:'pza'},'soldadura':{p:65,u:'kg'},'tapa-abatible':{p:320,u:'pza'},'tapacanto':{p:10,u:'m'},'tapacanto-3mm':{p:25,u:'m'},'tela':{p:280,u:'m'},'tornilleria':{p:45,u:'juego'},'torre':{p:5600,u:'pza'},'usb-hdmi':{p:320,u:'pza'},'wally':{p:1900,u:'pza'},
};
const USOS = {nivelador:3,'melamina-19':3,'lamina-20':3,tornilleria:2,'chapa-madera':2,corredera:2,jaladera:2,'pintura-electrostatica':2,ptr:2,tapacanto:2,'caja-electrica':1,nogal:1,pasacables:1,ecopiel:1,barniz:1,'divisor-melamina':1,'cerradura-electronica':1};
const cod = {}; for (const i of INSUMOS_SEMILLA) cod[i.id] = i;
const rows = [];
for (const id of Object.keys(cod)) {
  const i = cod[id], nu = NUBE[id];
  if (!nu) continue;
  if (i.unidad !== nu.u) continue;
  if (Math.abs(+i.precio - nu.p) <= 0.005) continue;
  const delta = +i.precio - nu.p;
  rows.push({ id, u: i.unidad, cod: +i.precio, nube: nu.p, delta, pct: Math.round(100*delta/nu.p), fuente: i.fuente||i.articulo||'(codigo sin fuente)', usos: USOS[id]||0 });
}
rows.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
console.log(`47 conflictos de SOLO precio (ordenados por |delta|):\n`);
console.log('id'.padEnd(24),'u'.padEnd(6),'codigo'.padStart(9),'nube'.padStart(9),'delta'.padStart(9),'d%'.padStart(6),'usos'.padStart(5),' fuente(codigo)');
for (const r of rows) console.log(
  r.id.padEnd(24), r.u.padEnd(6), String(r.cod).padStart(9), String(r.nube).padStart(9),
  String(r.delta.toFixed(0)).padStart(9), String(r.pct).padStart(5)+'%', String(r.usos).padStart(5), ' '+r.fuente.slice(0,34));
console.log(`\nTotal: ${rows.length}`);
