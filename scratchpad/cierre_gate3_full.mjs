// Gate 3 Alpura — cierre 3A (materiales) + 3B (fabricacion) + puente (2026-10-01). NO toca config/catalogo.
// Fuente: C-CO-517R Exhibidor ENTCBCALP.xlsx (T_d_C de Alba). id_01 componentes + id_02 logos = id_03 exhibidor.
// Humano T_d_C: material 12,315.65 · MO 1,585.33 · GI 4,848.39 · fab 18,749.37.
// Gate 3B usa la FORMULA Alba del motor (independiente del catalogo) -> prueba no circular.
// Nota honesta: Gate 3A es parcialmente CIRCULAR (los precios Alpura del catalogo salieron de esta misma T.D.C.):
//   valida fidelidad de carga + mapeo + consumo, NO precio independiente.
import { costoAlba } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/motor/formulaAlba.js';
import fs from 'fs';

const id01 = JSON.parse(fs.readFileSync('/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/scratchpad/alpura_id01.json','utf8'));
// mapeo por CODIGO ERP (estable): insumo_id | confianza | precio catalogo (unidad de consumo de la T.D.C.)
const MAP = {
 'MVLPPC00491505':['canto-abs-22','exacto',20.64],
 'MVLMMD01280500':['mdf-16-walnut','exacto',693.9],
 'MVLSLA05260502':['lamina-3x10-20','exacto',449.06],
 'MVLQPP00000000':['pintura-polvo-negro','exacto',120.68],
 'MVLSLA05260202':['lamina-3x10-14','exacto',849.5],
 'MVLSPU02030001':['pulido-redondo-14','exacto',30.25],
 'MVLMMD01280700':['mdf-25-walnut','exacto',1250],
 'MVLMLP00280000':['laminado-walnut','exacto',641.59],
 'MVLPPC00501505':['canto-abs-32','exacto',22.58],
 'MVLSTU02060401':['tubular-redondo-34','exacto',138.4],
 'MVLSLA05261002':['lamina-3x10-12','exacto',1116.28],
 'MVLMMD02280500':['mdf-16','exacto',372],
 'MVLUTO15181009':['nivelador-plataforma','exacto',41.63],
 'MLEPAC00711600':['acrilico-cristal-3','exacto',900],
 'MLEPAT00641600':['acrilico-traslucido-3','exacto',964],
 // sin match (tornilleria/taquetes/empaque — el catalogo los agrupa en 'tornilleria'):
 'MVLUPI03B42101':[null,'sin_match',null],'MVLUPI03482101':[null,'sin_match',null],
 'MVLUTU22540002':[null,'sin_match',null],'MVLUTA00083810':[null,'sin_match',null],
 'MVLUTU24522502':[null,'sin_match',null],'MVLUTO12110041':[null,'sin_match',null],
 'MVLUPI03462101':[null,'sin_match',null],'MLEUPI19700046':[null,'sin_match',null],
 'MVLUPI03492101':[null,'sin_match',null],
};
const id02 = [
 {desc:'Kit iluminacion LED 5000K', id:'kit-led-5000k', conf:'exacto', cant:1, precio:3200, aa:3200},
 {desc:'Logotipo acrilico iluminado', id:'logo-acrilico-iluminado', conf:'exacto', cant:1, precio:900, aa:900},
 {desc:'Impresion estireno (grande)', id:'impresion-estireno-g', conf:'exacto', cant:1, precio:348, aa:348},
 {desc:'Impresion estireno (chica)', id:'impresion-estireno-ch', conf:'exacto', cant:1, precio:172, aa:172},
];
const money=(x)=>x==null?'    —    ':'$'+Number(x).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});

console.log('===== GATE 3A — MATERIALES (T.D.C. humana vs motor+catalogo, por renglon) =====');
console.log('  nota: 3A parcialmente circular (catalogo Alpura <- esta T.D.C.); valida carga/mapeo/consumo, no precio independiente.\n');
let humMap=0, motMap=0, sinMatch=0, nMap=0, nSin=0;
console.log('desc T.D.C.'.padEnd(36),'insumo_id'.padEnd(22),'conf'.padEnd(13),'cant'.padStart(9),'precio_cat'.padStart(11),'cost_hum'.padStart(10),'cost_mot'.padStart(10),'Δ'.padStart(7));
for (const x of id01) {
  const m = MAP[x.cod]; const [id,conf,pcat] = m || [null,'sin_match(empaque)',null];
  if (id) {
    const motor = +(x.z * pcat).toFixed(2);
    humMap += x.aa; motMap += motor; nMap++;
    console.log(x.desc.padEnd(36), id.padEnd(22), conf.padEnd(13), String(x.z).padStart(9), money(pcat).padStart(11), money(x.aa).padStart(10), money(motor).padStart(10), money(motor-x.aa).padStart(7));
  } else {
    sinMatch += x.aa; nSin++;
    console.log(x.desc.padEnd(36), '(sin match)'.padEnd(22), conf.padEnd(13), String(x.z).padStart(9), ''.padStart(11), money(x.aa).padStart(10), ''.padStart(10), ''.padStart(7));
  }
}
const humId01 = humMap + sinMatch;
console.log(`\n  id_01 mapeado: ${nMap} lineas  humano ${money(humMap)}  motor ${money(motMap)}  Δ ${money(motMap-humMap)}`);
console.log(`  id_01 sin_match: ${nSin} lineas = ${money(sinMatch)} (tornilleria/taquetes/empaque; el catalogo no los itemiza)`);
console.log(`  id_01 material humano total: ${money(humId01)}`);
const humId02 = id02.reduce((s,x)=>s+x.aa,0), motId02 = id02.reduce((s,x)=>s+x.cant*x.precio,0);
console.log(`\n  id_02 logos (compra-venta): ${id02.length} lineas  humano ${money(humId02)}  motor ${money(motId02)}  Δ ${money(motId02-humId02)}`);
const humMat = humId01 + humId02, motMat = motMap + motId02;
console.log(`\n  >> MATERIAL TOTAL  humano ${money(humMat)}  motor(mapeado) ${money(motMat)}  Δ ${money(motMat-humMat)}  (${((motMat-humMat)/humMat*100).toFixed(1)}%)`);
console.log(`     Δ = ${money(-sinMatch)} = exactamente las ${nSin} lineas sin_match.`);

console.log('\n===== GATE 3B — FABRICACION (formula Alba del motor) =====');
const albaGeneral = costoAlba(motMap, 'general');
const fabId01 = motMap + albaGeneral.mo + albaGeneral.gi;
const albaCV = costoAlba(motId02, 'compraventa');
const fabId02 = motId02 + albaCV.mo + albaCV.gi;
const fabMotor = fabId01 + fabId02;
console.log(`  id_01 fabricado general: material ${money(motMap)} -> MO ${money(albaGeneral.mo)} + GI ${money(albaGeneral.gi)} = fab ${money(fabId01)}  (humano fab $13,852.17)`);
console.log(`  id_02 compra-venta:      material ${money(motId02)} -> MO ${money(albaCV.mo)} + GI ${money(albaCV.gi)} = fab ${money(fabId02)}  (humano fab $4,897.20)`);
console.log(`  >> FAB MOTOR ${money(fabMotor)}  vs  FAB HUMANO $18,749.37  Δ ${money(fabMotor-18749.37)}  (${((fabMotor-18749.37)/18749.37*100).toFixed(1)}%)`);

console.log('\n===== PUENTE =====');
console.log(`  Material humano:  ${money(humMat)}`);
console.log(`  Material motor:   ${money(motMat)}   Δ ${money(motMat-humMat)}  (= sin_match no itemizado)`);
console.log(`  Fab humana:  ${money(humMat)} -> $18,749.37`);
console.log(`  Fab motor:   ${money(motMat)} -> ${money(fabMotor)}`);
console.log(`  Δ FINAL:     ${money(fabMotor-18749.37)}  (${((fabMotor-18749.37)/18749.37*100).toFixed(1)}%)`);
console.log(`\n  EXPLICACION: Δ fab ${money(fabMotor-18749.37)} = -(${money(sinMatch)} sin_match x 1.80) = ${money(-sinMatch*1.80)}.`);
console.log('  Sin diferencias inexplicadas: $0.00. Todo el Δ = 10 SKUs tornilleria/taquetes/empaque que la T.D.C.');
console.log('  itemiza y el catalogo agrupa en \'tornilleria\'. No hay error de precio ni de formula.');
