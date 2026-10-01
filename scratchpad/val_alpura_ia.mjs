import fs from 'fs';
import { INSUMOS_SEMILLA, mapaInsumos } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/datos/insumos.js';
import { calcular, modeloParaPieza, componentesSinMaterial } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/motor/calculo.js';

const URL='https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/analizar-mueble';
const KEY='sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const dir='scratchpad/alpura_plano';
const imgs=fs.readdirSync(dir).filter(f=>/pg-\d+\.jpg/.test(f)).sort((a,b)=>(+a.match(/\d+/))-(+b.match(/\d+/)))
  .map(f=>fs.readFileSync(`${dir}/${f}`).toString('base64'));
console.log('hojas:',imgs.length);
const catalogo=INSUMOS_SEMILLA.map(c=>({id:c.id,nombre:c.nombre,seccion:c.seccion,unidad:c.unidad}));
console.log('catalogo:',catalogo.length,'insumos');

const r=await fetch(URL,{method:'POST',headers:{'content-type':'application/json','apikey':KEY,'authorization':'Bearer '+KEY},
  body:JSON.stringify({imagenes:imgs,catalogo})});
const j=await r.json();
if(!j.ok){console.log('ERROR:',JSON.stringify(j).slice(0,500));process.exit(1);}
const p=j.propuesta;
console.log('\nPRODUCTO IA:',p.producto,'| tipo:',p.tipo,'| confianza:',p.confianzaGeneral);
console.log('piezas IA:',p.piezas.length,'| sin mapear:',p.piezas.filter(x=>!x.insumoId).length);
console.log('\nDESPIECE IA:');
for(const x of p.piezas) console.log(`  ${x.cantidad}x ${x.nombre} [${x.insumoId||'SIN MAPEAR'}] ${x.forma} ${x.largoMM||''}x${x.anchoMM||''} (${x.confianza})`);
// costo por el motor
const ins=mapaInsumos(INSUMOS_SEMILLA);
const pieza={componentes:p.piezas.map(x=>{const c={insumoId:x.insumoId,nombre:x.nombre,cantidad:x.cantidad,piezas:1,forma:x.forma};if(x.forma==='area'){c.largoMM=x.largoMM;c.anchoMM=x.anchoMM;c.piezas=x.cantidad||1;c.cantidad=1;if(x.hojas>0)c.hojas=x.hojas;}return c;})};
const res=calcular(pieza,1,ins,modeloParaPieza({},pieza).par);
console.log('\nMOTOR sobre el despiece IA:');
console.log('  material:',Math.round(res.materialTotal),'| MO:',Math.round(res.manoObra),'| GI:',Math.round(res.indirectosFabrica),'| COSTO FAB:',Math.round(res.costoUnitario));
console.log('  piezas ignoradas (sin material):',res.componentesIgnorados.length, res.componentesIgnorados.slice(0,8));
console.log('\nREAL (Alba T.D.C.): material 12316 | MO 1585 | GI 4848 | COSTO FAB 18749');
if(p.materiales?.length) console.log('\nmateriales (cliente):',p.materiales.join(', '));
if(p.preguntas?.length) console.log('\npreguntas IA:',p.preguntas.slice(0,5).join(' | '));
