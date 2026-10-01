import fs from 'fs';
import { INSUMOS_SEMILLA, mapaInsumos } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/datos/insumos.js';
import { calcular, modeloParaPieza } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/motor/calculo.js';
const URL='https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/analizar-mueble';
const KEY='sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const dir='scratchpad/alpura_plano';
const imgs=fs.readdirSync(dir).filter(f=>/pg-\d+\.jpg/.test(f)).sort((a,b)=>(+a.match(/\d+/))-(+b.match(/\d+/))).map(f=>fs.readFileSync(`${dir}/${f}`).toString('base64'));
const catalogo=INSUMOS_SEMILLA.map(c=>({id:c.id,nombre:c.nombre,seccion:c.seccion,unidad:c.unidad}));
const ins=mapaInsumos(INSUMOS_SEMILLA);
const call=async(body)=>{const r=await fetch(URL,{method:'POST',headers:{'content-type':'application/json','apikey':KEY,'authorization':'Bearer '+KEY},body:JSON.stringify(body)});return r.json();};
const costo=(p)=>{const pieza={componentes:p.piezas.map(x=>{const c={insumoId:x.insumoId,nombre:x.nombre,cantidad:x.cantidad,piezas:1,forma:x.forma};if(x.forma==='area'){c.largoMM=x.largoMM;c.anchoMM=x.anchoMM;c.piezas=x.cantidad||1;c.cantidad=1;if(x.hojas>0)c.hojas=x.hojas;}return c;})};return calcular(pieza,1,ins,modeloParaPieza({},pieza).par);};

console.log('PASO 1: analizar…');
const v1=await call({catalogo,imagenes:imgs});
if(!v1.ok){console.log('err1',v1);process.exit(1);}
const c1=costo(v1.propuesta);
console.log('  v1: piezas',v1.propuesta.piezas.length,'| material',Math.round(c1.materialTotal),'| fab',Math.round(c1.costoUnitario));

console.log('PASO 2: verificar contra cotas…');
const v2=await call({catalogo,imagenes:imgs,revisar:v1.propuesta});
if(!v2.ok){console.log('err2 (se queda v1):',v2.error);process.exit(0);}
const c2=costo(v2.propuesta);
console.log('  v2: piezas',v2.propuesta.piezas.length,'| material',Math.round(c2.materialTotal),'| fab',Math.round(c2.costoUnitario));
console.log('\nREAL: material 12316 | fab 18749\n');
console.log('DESPIECE v2 con RAZONAMIENTO:');
for(const x of v2.propuesta.piezas) console.log(`  ${x.cantidad}x ${x.nombre} [${x.insumoId||'—'}] hojas=${x.hojas??0} (${x.confianza})\n     📐 ${x.razonamiento||'(sin razonamiento)'}`);
