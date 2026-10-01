// Dashboard shadow — 33 cotizaciones historicas, 3 cohortes (2026-10-01). NO toca config/catalogo.
// A recalculable = 22 modulor (regenero BOM via generarModulor). C = 251 linea. otro = 17.
// Recalcula material/fab con motor+legado vs motor+catalogo_vigente. Δ = impacto PURO del catalogo
// (misma cantidad comprada ambos lados; solo cambia el precio). Fab via formula Alba del motor.
import { calcular } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/motor/calculo.js';
import { generarModulor } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/datos/modulor.js';
import { INSUMOS_SEMILLA } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/datos/insumos.js';

const SEM = {}; for (const i of INSUMOS_SEMILLA) SEM[i.id] = i;

// config(legado) ⋈ catalogo_vigente para los insumos que tocan estos modulor ABS
const D = [
 {id:'lamina-20',cfgP:32,cfgU:'kg',med:21.3,catP:455.82,catF:21.3,catU:'hoja',est:'propuesto',cert:false},
 {id:'tapacanto',cfgP:10,cfgU:'m',med:50,catP:3.04,catF:1,catU:'m',est:'propuesto',cert:false},
 {id:'pintura-electrostatica',cfgP:110,cfgU:'m2',med:null,catP:100,catF:1,catU:'m2',est:'propuesto',cert:false},
 {id:'melamina-19',cfgP:320,cfgU:'m2',med:2.9768,catP:544,catF:1,catU:'hoja',est:'propuesto',cert:false},
 {id:'mdf-16',cfgP:560,cfgU:'hoja',med:2.9768,catP:372,catF:1,catU:'hoja',est:'propuesto',cert:false},
 {id:'espuma',cfgP:260,cfgU:'m2',med:null,catP:396.8,catF:1,catU:'m2',est:'propuesto',cert:false},
 {id:'tela',cfgP:280,cfgU:'m',med:null,catP:95,catF:1,catU:'m',est:'propuesto',cert:false},
 {id:'corredera',cfgP:95,cfgU:'par',med:null,catP:70,catF:1,catU:'juego',est:'propuesto',cert:false},
 {id:'jaladera',cfgP:45,cfgU:'pza',med:null,catP:37.9,catF:1,catU:'pza',est:'propuesto',cert:false},
 {id:'nivelador',cfgP:12,cfgU:'pza',med:null,catP:17.73,catF:1,catU:'pza',est:'propuesto_validado',cert:false},
 {id:'cerradura',cfgP:110,cfgU:'pza',med:null,catP:120,catF:1,catU:'pza',est:'propuesto',cert:false},
 {id:'rodaja',cfgP:22,cfgU:'pza',med:null,catP:78,catF:1,catU:'pza',est:'propuesto',cert:false},
 {id:'riel',cfgP:1250,cfgU:'juego',med:null,catP:1250,catF:1,catU:'juego',est:'aprobado',cert:true},
];
const nuevoPrecio = (r) => {
  if (r.catP==null) return r.cfgP;
  if (r.cfgU==='m2' && r.catU==='hoja') return r.catP / r.med;
  if (r.cfgU==='kg' && r.catU==='hoja') return r.catP / r.catF;
  return r.catP;
};
const mkInsumo = (r, precio) => ({
  id:r.id, precio, unidad:r.cfgU, seccion:SEM[r.id]?.seccion||'otros', clase:SEM[r.id]?.clase||'directa',
  mermaCorte:SEM[r.id]?.mermaCorte||0,
  formato: (r.cfgU==='m2'||r.cfgU==='hoja') && r.med ? {tipo:'tablero',medida:r.med,largoMM:2440,anchoMM:1220}
         : (r.cfgU==='kg' && r.med) ? {tipo:'lamina',medida:r.med}
         : (r.cfgU==='m' && r.med===6) ? {tipo:'tramo',medida:6}
         : (r.cfgU==='m' && r.med===50) ? {tipo:'rollo',medida:50} : undefined,
});
const legado={}, nuevo={}, META={};
for (const r of D){ legado[r.id]=mkInsumo(r,r.cfgP); nuevo[r.id]=mkInsumo(r,nuevoPrecio(r)); META[r.id]={est:r.est,cert:r.cert}; }

const FAMILIA = (id) => /melamina|mdf|chapa|laminado|aglomerado/.test(id)?'Melamina/tableros'
  : /lamina-|inoxidable|ptr|tubular|pulido|perfil/.test(id)?'Lámina/metal'
  : /pintura|barniz|canto|tapacanto|membrana|foil/.test(id)?'Acabados/cantos'
  : /corredera|jaladera|nivelador|cerradura|rodaja|riel|bisagra/.test(id)?'Herrajes'
  : /espuma|tela|ecopiel|piel/.test(id)?'Tapicería':'Otros';

const CFG22 = [
 {c:{finish:'ABS',modelo:'MOA2CA',producto:'archivero_lateral',cerradura:true},cant:35},
 {c:{finish:'ABS',modelo:'MOA2CA',producto:'archivero_lateral',cerradura:true},cant:35},
 {c:{finish:'ABS',modelo:'cajones75',producto:'archivero_h',cerradura:false},cant:35},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:25},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:2},
 {c:{finish:'ABS',modelo:'vert150',producto:'librero'},cant:1},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:true},cant:35},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:true},cant:35},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:53},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:25},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:7},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:35},
 {c:{finish:'ABS',modelo:'cajones75',producto:'archivero_h',cerradura:true},cant:35},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:25},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:53},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:25},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:true},cant:2},
 {c:{finish:'ABS',modelo:'fijo75',producto:'librero'},cant:1},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:7},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:35},
 {c:{finish:'ABS',modelo:'puertas75',producto:'archivero_h',cerradura:false},cant:25},
 {c:{finish:'ABS',modelo:'MOA2CA',producto:'archivero_lateral',cerradura:false},cant:53},
];
const PAR = { aprovechamientoCorte:80, tableroLargoMM:2440, tableroAnchoMM:1220, recorteOrillaMM:10, kerfMM:4,
  factorManoObraDirecta:17, factorManoObraIndirecta:12 };
const money=(x)=>'$'+Number(x).toLocaleString('es-MX',{maximumFractionDigits:0});

let matLegTot=0, matNueTot=0, fabLegTot=0, fabNueTot=0; const ignorados=new Set();
const causaFam={}; let matCert=0, matTotLeg=0;
for (const {c,cant} of CFG22) {
  const pieza = generarModulor(c);
  const rl = calcular(pieza, 1, legado, PAR);
  const rn = calcular(pieza, 1, nuevo, PAR);
  for (const x of rl.componentesIgnorados||[]) ignorados.add(x);
  matLegTot += rl.materialTotal*cant; matNueTot += rn.materialTotal*cant;
  fabLegTot += rl.costoUnitario*cant;  fabNueTot += rn.costoUnitario*cant;
  for (const d of rl.detalleInsumos) {
    const pL = legado[d.insumoId]?.precio, pN = nuevo[d.insumoId]?.precio;
    if (pL==null||pN==null) continue;
    const dCost = (d.comprado) * (pN - pL) * cant;
    causaFam[FAMILIA(d.insumoId)] = (causaFam[FAMILIA(d.insumoId)]||0) + dCost;
    matTotLeg += d.costo*cant;
    if (META[d.insumoId]?.cert) matCert += d.costo*cant;
  }
}

console.log('===== DASHBOARD — 33 COTIZACIONES HISTORICAS =====');
console.log('  290 partidas en 33 cotizaciones. (0 partidas guardan BOM)');
console.log('  A recalculable (modulor):  22 partidas  ·  costo hist $1,831,362');
console.log('  C no reconstruible (línea):251 partidas ·  costo hist $6,680,583');
console.log('  otro (sin BOM claro):       17 partidas ·  costo hist $363,287');

console.log('\n===== IMPACTO EN COHORTE A (recalculable, legado vs catálogo) =====');
console.log(`  Material legado:  ${money(matLegTot)}   nuevo: ${money(matNueTot)}   Δ ${money(matNueTot-matLegTot)} (${((matNueTot-matLegTot)/matLegTot*100).toFixed(1)}%)`);
console.log(`  Fab legado:       ${money(fabLegTot)}   nuevo: ${money(fabNueTot)}   Δ ${money(fabNueTot-fabLegTot)} (${((fabNueTot-fabLegTot)/fabLegTot*100).toFixed(1)}%)`);
console.log('\n  Top causas del cambio (Δ material por familia):');
for (const [f,v] of Object.entries(causaFam).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])))
  console.log(`    ${f.padEnd(20)} ${money(v)}`);

console.log('\n===== % DEL COSTO EXPLICADO CON EVIDENCIA =====');
const totalHist = 1831362+6680583+363287;
console.log(`  Recalculable con catálogo versionado: $1,831,362 / $${totalHist.toLocaleString('es-MX')} = ${(1831362/totalHist*100).toFixed(1)}% del costo histórico`);
console.log(`  Dentro de A, material CERTIFICABLE (estado aprobado): ${money(matCert)} / ${money(matTotLeg)} = ${(matCert/matTotLeg*100).toFixed(1)}%`);
console.log('  (el resto es preliminar: precios con fuente pero sin documento adjunto)');
if (ignorados.size) console.log('\n  AVISO insumos sin match en mapa:', [...ignorados]);
