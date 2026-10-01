import { tipoAlba, costoAlba } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/motor/formulaAlba.js';
// id_01 "componentes" (fabricado) — material real por línea (Explo_MP de Rafa)
const id01 = [
 ['PERFIL DE CANTO ABS 22mm',618.58],['MDF MELAMINA 16mm Walnut',2594.49],
 ['LAMINA NEGRA cal 20',470.17],['PINTURA EN POLVO',64.81],['PIJA 8x5/8',15.36],
 ['PIJA 8x1/2',5.76],['LAMINA NEGRA cal 14',91.75],['PULIDO REDONDO 1/4',18.57],
 ['TUERCA 3/8',3.54],['MDF MELAMINA 25mm Walnut',1935],['LAMINADO PLASTICO 4x8',162.96],
 ['PERFIL DE CANTO ABS 32mm',205.3],['TAQUETE 8',48.3],['TUERCA INSERTO 1/4',29.04],
 ['TUBULAR REDONDO 3/4 cal18',38.34],['LAMINA NEGRA cal 12',10.05],['MDF NATURAL 16mm',21.95],
 ['TORNILLO NIVELADOR 3/8',249.78],['ACRILICO CRISTAL 3mm',428.4],['ACRILICO TRASLUCIDO 3mm',417.41],
 ['TORNILLO ALLEN 1/4',14.4],['PIJA 8x1 1/2',14],['PIJA FIJADORA 8x1/2',2.2],
 ['PIJA 8x3/4',9.5],['empaque jgo',225.99],
];
let mat=0,mo=0,gi=0; const raros=[];
for(const [nombre,c] of id01){
  const t=tipoAlba({nombre});
  const r=costoAlba(c,t==='cristal'?'cristal':(t==='cubierta'?'cubierta':(t==='metal'?'metal':'general')));
  mat+=c; mo+=r.mo; gi+=r.gi;
  if(t!=='general'&&t!=='metal') raros.push(`${nombre} -> tipo=${t} MO%=${r.moPct} (mo ${r.mo.toFixed(2)}, gi ${r.gi.toFixed(2)})`);
}
const fab=mat+mo+gi;
console.log('MOTOR id_01:  material',mat.toFixed(2),'| MO',mo.toFixed(2),'| GI',gi.toFixed(2),'| fab',fab.toFixed(2));
console.log('ALBA  id_01:  material 7695.65 | MO 1539.13 | GI 4617.39 | fab 13852.17');
console.log('DIF fab:', (fab-13852.17).toFixed(2));
console.log('\nLíneas clasificadas NO-general (posible divergencia):');
raros.forEach(x=>console.log('  '+x));
// si todo fuera flat 20%:
console.log('\nFlat 20%/x3:  MO',(mat*0.2).toFixed(2),'GI',(mat*0.6).toFixed(2),'fab',(mat*1.8).toFixed(2));
