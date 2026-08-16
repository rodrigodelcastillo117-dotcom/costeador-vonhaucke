import { costearItem, LINEAS_REG } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
const E={insumos:mapaInsumos(INSUMOS_SEMILLA),parametros:PARAMETROS_DEFAULT,piezas:{}};
const q=(ruta,producto,sel)=>costearItem(E,{ruta,producto,cantidad:1,seleccion:Object.entries(sel).map(([clave,valor])=>({clave,valor:String(valor)}))});
const mx=(n)=>'$'+Math.round(n).toLocaleString('es-MX');
console.log('### NO DECIR EL BIOMBO TIRA EL PRECIO (el ancla se salta)');
for(const [prod,base] of [['banca_sencilla',{largoMM:1200,fondoMM:600,usuarios:2}],['banca_sencilla',{largoMM:1200,fondoMM:600,usuarios:1}],['banca_sencilla',{largoMM:1200,fondoMM:600,usuarios:3}],['banca_doble',{largoMM:1200,fondoMM:1200,usuarios:6}],['banca_doble',{largoMM:1500,fondoMM:1200,usuarios:4}]]){
  const sin=q('applt',prod,base), pet=q('applt',prod,{...base,biombo:'pet'}), mel=q('applt',prod,{...base,biombo:'melamina'}), cri=q('applt',prod,{...base,biombo:'cristal'});
  console.log(` applt/${prod} ${JSON.stringify(base)}`);
  for(const [n,r] of [['(sin decir biombo)',sin],['biombo=pet',pet],['biombo=melamina',mel],['biombo=cristal',cri]]) if(r) console.log(`    ${n.padEnd(20)} ${mx(r.precioUnitario).padStart(11)} ${r.precioReal?'FIRME':'modelo'}   ${sin&&r!==sin?((r.precioUnitario/sin.precioUnitario-1)*100).toFixed(0)+'% vs sin decir':''}`);
}
console.log('\n### ALBA BENCH: ¿cuestan los usuarios?');
const alba=LINEAS_REG.alba.productos.find(p=>p.id==='bench');
console.log(' selects:',JSON.stringify(alba.selects?.map(s=>({k:s.key,o:s.opciones.map(o=>o.id)}))));
for(const u of (alba.selects?.find(s=>s.key==='usuarios')?.opciones||[]).map(o=>o.id)){
  const r=q('alba','bench',{usuarios:u}); console.log('   usuarios='+u, r?mx(r.precioUnitario)+'  '+r.nombre:'--');
}
console.log('\n### LATERALES en banca_doble: el papel dice +15%, el motor dice:');
const a=q('applt','banca_doble',{largoMM:1500,fondoMM:1200,usuarios:4,biombo:'melamina'});
const b=q('applt','banca_doble',{largoMM:1500,fondoMM:1200,usuarios:4,biombo:'melamina',laterales:'si'});
console.log('   sin laterales',mx(a.precioUnitario),a.precioReal?'FIRME':'modelo');
console.log('   con laterales',mx(b.precioUnitario),b.precioReal?'FIRME':'modelo',' -> ',((b.precioUnitario/a.precioUnitario-1)*100).toFixed(1)+'%   (papel: 22590 -> 25980 = +15.0%)');
