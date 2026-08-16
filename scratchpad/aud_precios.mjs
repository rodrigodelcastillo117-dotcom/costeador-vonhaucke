import { costearItem } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { PRECIOS_VENTA, precioDeLista } from '../src/datos/preciosVenta.js';
const E = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, piezas: {} };
const mx=(n)=>'$'+Math.round(n).toLocaleString('es-MX');
const q=(ruta,producto,sel,cant=1)=>costearItem(E,{ruta,producto,cantidad:cant,seleccion:Object.entries(sel).map(([clave,valor])=>({clave,valor:String(valor)}))});

console.log('### 1. ¿MUEVE EL PRECIO LA OPCION `divisores`?');
for(const [prod,base] of [['banca_doble',{largoMM:1200,usuarios:6,biombo:'pet'}],['banca_sencilla',{largoMM:1200,usuarios:3,biombo:'pet'}]]){
  const sin=q('applt',prod,base), con=q('applt',prod,{...base,divisores:'si'});
  console.log(`  applt/${prod} ${JSON.stringify(base)}`);
  console.log(`     sin divisores ${mx(sin.precioUnitario).padStart(10)} real=${sin.precioReal}`);
  console.log(`     CON divisores ${mx(con.precioUnitario).padStart(10)} real=${con.precioReal}   -> delta ${((con.precioUnitario/sin.precioUnitario-1)*100).toFixed(1)}%`);
}
console.log('\n### 2. BANCA SENCILLA APP LT — modelo vs ancla de papel ($8,750/usuario de lista)');
const anclaU = precioDeLista(14583);
for(const u of [1,2,3,4,6]){
  const r=q('applt','banca_sencilla',{largoMM:1500,fondoMM:600,usuarios:u});
  const esperado = anclaU*u;
  console.log(`  ${u}u -> ${mx(r.precioUnitario).padStart(10)} (${mx(r.precioUnitario/u)}/usuario)  ancla ${mx(esperado)}  ERROR ${((r.precioUnitario/esperado-1)*100).toFixed(0)}%  real=${r.precioReal}`);
}
console.log('\n### 3. ¿UN EJECUTIVO SALE MAS BARATO QUE UN OPERATIVO?');
const casos=[
 ['applt','escritorio',{largoMM:1500,fondoMM:600},'App LT operativo 1.50 (sin nada)'],
 ['applt','escritorio',{largoMM:1200,fondoMM:600},'App LT operativo 1.20'],
 ['drift','escritorio',{cubierta:'1800x750',mano:'derecho',credenza:'cajonera120',finish:'ABS'},'Eclipse Drift EJECUTIVO 1.80 + credenza'],
 ['drift','escritorio',{cubierta:'1800x750',mano:'derecho',finish:'ABS'},'Eclipse Drift EJECUTIVO 1.80 sin credenza'],
 ['eclipse','escritorio',{},'Eclipse escritorio (defaults)'],
];
for(const [ru,pr,sel,et] of casos){
  const r=q(ru,pr,sel);
  console.log(r? `  ${mx(r.precioUnitario).padStart(11)}  ${et.padEnd(42)} [${r.precioReal?'FIRME':'modelo'}] ${r.nombre}` : `  --  ${et} NO COSTEABLE`);
}
console.log('\n### 4. TODAS LAS ANCLAS DEL PRICE-BOOK vs LO QUE ESCUPE EL MOTOR');
let mal=0;
for(const f of PRECIOS_VENTA){
  const sel={};
  if(f.largoMM) sel.largoMM=f.largoMM;
  if(f.fondoMM) sel.fondoMM=f.fondoMM;
  if(f.usuarios) sel.usuarios=f.usuarios;
  if(f.biombo) sel.biombo=f.biombo;
  Object.assign(sel, f.sel||{});
  const r=q(f.linea,f.producto,sel);
  const esperado=precioDeLista(f.lista);
  if(!r){console.log(`  [X] ${f.linea}/${f.producto} ${JSON.stringify(sel)} NO COSTEABLE (ancla ${mx(esperado)})`);mal++;continue;}
  const err=(r.precioUnitario/esperado-1)*100;
  const flag=Math.abs(err)>3?'  <<< ':'';
  if(Math.abs(err)>3)mal++;
  console.log(`  ${(err>=0?'+':'')+err.toFixed(1)+'%'} ${String(mx(r.precioUnitario)).padStart(10)} vs ancla ${String(mx(esperado)).padStart(10)}  ${f.linea}/${f.producto} ${JSON.stringify(sel)} [${r.precioReal?'FIRME':'modelo'}]${flag}`);
}
console.log('anclas fuera de +-3%:',mal,'de',PRECIOS_VENTA.length);
