import { expandirPiezas, contarBajoEscritorio } from '../src/datos/espacio.js';
import { areasDeLectura } from '../src/datos/planoLeido.js';

console.log('=== A · topes silenciosos de expandirPiezas');
const partidas = [
  { id: 'p1', nombre: 'Silla Pac', ruta: 'pac', w: 600, d: 600, cantidad: 50 },
  { id: 'p2', nombre: 'App LT · Estación 1.50', ruta: 'applt', w: 1500, d: 750, cantidad: 40 },
];
const pz = expandirPiezas(partidas);
console.log('  cotización: 90 piezas → expandirPiezas devuelve', pz.length);
console.log('  por partida:', Object.entries(pz.reduce((a,p)=>{const k=p.id.replace(/-\d+$/,'');a[k]=(a[k]||0)+1;return a;},{})));
console.log('  >>> se pierden 30 en silencio (tope 60) y 10+10 más por el cap de 30/partida');

console.log('\n=== B · areaDe() de PlanoAcomodo con un cuarto DENTRO de otro');
const lectura = {
  envolvente: { ancho: 30000, largo: 20000 },
  areas: [
    { nombre: 'Open space', forma: 'poligono', puntos: [{x:0,y:0},{x:20000,y:0},{x:20000,y:15000},{x:0,y:15000}] },
    { nombre: 'Sala de juntas', forma: 'circulo', circulo: { cx: 10000, cy: 7000, r: 3500 } },
  ], puertas: [],
};
const { areas } = areasDeLectura(lectura);
const mm = areas.map(a=>({nombre:a.nombre, x:Math.round(a.x*1000), y:Math.round(a.y*1000), ancho:Math.round(a.ancho*1000), largo:Math.round(a.largo*1000)}));
// layoutAreas con coordenadas reales:
const minX = Math.min(...mm.map(a=>a.x)), minY = Math.min(...mm.map(a=>a.y));
const offs = mm.map(a=>({x:a.x-minX, y:a.y-minY}));
const areaDe = (x,y)=>{ for(let i=0;i<mm.length;i++){const o=offs[i]; if(x>=o.x&&x<=o.x+mm[i].ancho&&y>=o.y&&y<=o.y+mm[i].largo) return i;} return null; };
console.log('  áreas:', mm);
console.log('  suelto la MESA DE JUNTAS en el centro de la sala circular (10000,7000):');
const i = areaDe(10000,7000);
console.log(`  → la app la guarda en area=${i} ("${mm[i].nombre}")  ${i===1?'CORRECTO':'MAL: la manda al cuarto equivocado'}`);
