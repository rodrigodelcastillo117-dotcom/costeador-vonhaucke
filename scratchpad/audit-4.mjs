import { acomodarLocal } from '../src/datos/planner.js';
import { dimsPieza } from '../src/datos/espacio.js';
import { regla } from '../src/datos/reglas.js';

const piezas = [
  { id:'d1', nombre:'Eclipse Escritorio 2.10', w:2100, d:900, tipo:'escritorio' },
  { id:'d2', nombre:'Eclipse Escritorio 2.10', w:2100, d:900, tipo:'escritorio' },
  { id:'g1', nombre:'Archivero', w:750, d:476, tipo:'guarda' },
  { id:'g2', nombre:'Archivero', w:750, d:476, tipo:'guarda' },
  { id:'g3', nombre:'Archivero', w:750, d:476, tipo:'guarda' },
  { id:'s1', nombre:'Silla Pac', w:600, d:600, tipo:'asiento' },
  { id:'s2', nombre:'Silla Pac', w:600, d:600, tipo:'asiento' },
];
const r = acomodarLocal([{ nombre:'Mi espacio', ancho:8000, largo:6000 }], piezas, { ajustar:true });
const byId = Object.fromEntries(piezas.map(p=>[p.id,p]));
const cajas = r.colocacion.map(c=>{const {pw,ph}=dimsPieza(byId[c.id],c.rot);return {id:c.id,x0:c.x,y0:c.y,x1:c.x+pw,y1:c.y+ph};});
console.log('RUTA POR OMISIÓN (1 clic, un solo espacio) — NO pasa por la malla ni por las reglas\n');
console.log('regla circulacion_min =', regla('circulacion_min'), 'mm');
let peor = Infinity, par=null;
for (let i=0;i<cajas.length;i++) for (let j=i+1;j<cajas.length;j++){
  const a=cajas[i],b=cajas[j];
  const dx=Math.max(a.x0-b.x1,b.x0-a.x1,0), dy=Math.max(a.y0-b.y1,b.y0-a.y1,0);
  const d=Math.hypot(dx,dy); if(d<peor){peor=d;par=[a.id,b.id];}
}
for (const c of cajas) console.log(`  ${c.id}  x=${c.x0} y=${c.y0}`);
console.log('\n  separación MÍNIMA entre dos muebles:', peor, 'mm', par, peor>=900?'OK':'*** VIOLA LA REGLA DE 900 mm ***');
console.log('  margen contra el muro (PERIM):', Math.min(...cajas.map(c=>c.x0)), 'mm', '→ la regla pide 900');
console.log('\n  lo que la app le enseña al proyectista:');
for (const a of r.auditoria) console.log(`    ${a.ok?'✓':'⚠'} ${a.check} · ${a.detalle}`);
console.log('  resumen:', r.resumen);
