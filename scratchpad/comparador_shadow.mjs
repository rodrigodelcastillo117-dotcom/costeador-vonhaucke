// Comparador shadow en 3 gates (ChatGPT/Rodrigo, 2026-10-01). NO toca config ni catalogo.
// Gate 1 PARIDAD DE MOTOR:  misma fuente (config) por ambos ensamblados -> debe dar $0.00.
// Gate 2 IMPACTO CATALOGO:  mismo motor, config legado vs catalogo_vigente (precio normalizado a la unidad de config).
// Gate 3 REALIDAD:          ancla T.D.C. humana Alpura (nivel formula Alba; mapeo por-insumo = follow-up).
import { calcular } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/motor/calculo.js';

const parametros = { kerfMM:4, costoHora:40.6, tipoCambio:17.5, utilidadPct:20, margenMinimo:25, mermaProceso:0,
  modeloCosteo:'clasico', ivaPorcentaje:16, eficienciaReal:80, jornadaSemanal:48, margenObjetivo:40, minMarkupLinea:45,
  tableroAnchoMM:1220, tableroLargoMM:2440, empaquePorPieza:0, fletePorcentaje:10, recorteOrillaMM:10, usarCostoPorArea:false,
  factorPrecioLista:3, anticipoPorcentaje:50, gastosOperacionPct:30, descuentoPorcentaje:0, maniobrasPorcentaje:3,
  aprovechamientoCorte:80, factorManoObraDirecta:17, contingenciaPorcentaje:0, factorIndirectosFabrica:34, factorManoObraIndirecta:12 };

// --- 17 insumos de config (legado) usados por las 3 piezas benchmark ---
const F_TABLERO = { tipo:'tablero', corto:'tablero', medida:2.9768, nombre:'tablero 1.22 x 2.44', anchoMM:1220, largoMM:2440 };
const legado = {
  'barniz':{id:'barniz',precio:95,unidad:'m2',seccion:'acabados',mermaCorte:0},
  'caja-electrica':{id:'caja-electrica',precio:650,unidad:'pza',seccion:'electrico',mermaCorte:0},
  'cerradura-electronica':{id:'cerradura-electronica',precio:1850,unidad:'pza',seccion:'herrajes',mermaCorte:0},
  'chapa-madera':{id:'chapa-madera',precio:850,unidad:'m2',seccion:'cubiertas',mermaCorte:8,veta:true,formato:F_TABLERO},
  'corredera':{id:'corredera',precio:95,unidad:'par',seccion:'herrajes',mermaCorte:0},
  'divisor-melamina':{id:'divisor-melamina',precio:320,unidad:'m2',seccion:'mamparas',mermaCorte:6,formato:F_TABLERO},
  'ecopiel':{id:'ecopiel',precio:340,unidad:'m',seccion:'tapiceria',mermaCorte:0},
  'jaladera':{id:'jaladera',precio:45,unidad:'pza',seccion:'herrajes',mermaCorte:0},
  'lamina-20':{id:'lamina-20',precio:32,unidad:'kg',seccion:'metal',mermaCorte:8,formato:{tipo:'lamina',corto:'lamina',medida:21.3,nombre:'lamina 1.22 x 2.44'}},
  'melamina-19':{id:'melamina-19',precio:320,unidad:'m2',seccion:'cubiertas',mermaCorte:6,formato:F_TABLERO},
  'nivelador':{id:'nivelador',precio:12,unidad:'pza',seccion:'herrajes',mermaCorte:0},
  'nogal':{id:'nogal',precio:420,unidad:'pie_tab',seccion:'tapiceria',mermaCorte:0},
  'pasacables':{id:'pasacables',precio:35,unidad:'pza',seccion:'electrico',mermaCorte:0},
  'pintura-electrostatica':{id:'pintura-electrostatica',precio:110,unidad:'m2',seccion:'acabados',mermaCorte:0},
  'ptr':{id:'ptr',precio:42,unidad:'m',seccion:'metal',mermaCorte:5,formato:{tipo:'tramo',corto:'tramo',medida:6,nombre:'tramo de 6 m'}},
  'tapacanto':{id:'tapacanto',precio:10,unidad:'m',seccion:'cubiertas',mermaCorte:4,inventario:true,formato:{tipo:'rollo',corto:'rollo',medida:50,nombre:'rollo de 50 m'}},
  'tornilleria':{id:'tornilleria',precio:45,unidad:'juego',seccion:'herrajes',mermaCorte:0},
};

// --- catalogo_vigente, precio NORMALIZADO a la unidad de config (conversion fisica) + metadatos ---
const AREA_HOJA = 2.9768;
const cat = {
  'barniz':{precio:70,estado:'propuesto',cert:false},
  'caja-electrica':{precio:649,estado:'propuesto',cert:false},
  'cerradura-electronica':{precio:2835,estado:'propuesto',cert:false},
  'chapa-madera':{precio:540/AREA_HOJA,estado:'propuesto',cert:false,nota:'cat 540/hoja -> $/m2'},
  'corredera':{precio:70,estado:'propuesto',cert:false,nota:'par=juego'},
  'divisor-melamina':{precio:665/AREA_HOJA,estado:'propuesto',cert:false,nota:'cat 665/hoja -> $/m2'},
  'ecopiel':{precio:90,estado:'propuesto',cert:false},
  'jaladera':{precio:37.9,estado:'propuesto',cert:false},
  'lamina-20':{precio:455.82/21.3,estado:'propuesto',cert:false,nota:'cat 455.82/hoja -> $/kg = 21.40'},
  'melamina-19':{precio:544/AREA_HOJA,estado:'propuesto',cert:false,nota:'cat 544/hoja -> $/m2'},
  'nivelador':{precio:17.73,estado:'propuesto_validado',cert:false},
  'nogal':{precio:345.05,estado:'propuesto',cert:false},
  'pasacables':{precio:6.3,estado:'propuesto',cert:false},
  'pintura-electrostatica':{precio:100,estado:'propuesto',cert:false},
  'ptr':{precio:38.19,estado:'propuesto',cert:false},
  'tapacanto':{precio:3.04,estado:'propuesto',cert:false},
  'tornilleria':{precio:45,estado:'aprobado',cert:true},
};
// mapa nuevo = clon de legado con precio del catalogo (misma unidad/formato -> impacto PURO de precio)
const nuevo = {};
for (const id of Object.keys(legado)) nuevo[id] = { ...legado[id], precio: cat[id].precio };

// --- 3 piezas benchmark (de config.datos.piezas) ---
const piezas = {
 'bench-app-lt-3u':{id:'bench-app-lt-3u',nombre:'Bench App LT 3 usuarios',modoManoObra:'horas',factorDirecta:17,factorIndirecta:12,preparacionHoras:0,
   horas:{pm:10.45,pintura:0.08,acabados:1.32,tapiceria:0,carpinteria:2.81},componentes:[
   {nombre:'Cubiertas (3)',piezas:3,cantidad:3.36,insumoId:'melamina-19'},{nombre:'Tapacanto',cantidad:13.8,insumoId:'tapacanto'},
   {nombre:'Estructura lamina',cantidad:12.6,insumoId:'lamina-20'},{nombre:'Patas y corrida PTR',cantidad:9.6,insumoId:'ptr'},
   {nombre:'Pintura estructura',cantidad:2.7,insumoId:'pintura-electrostatica'},{nombre:'Divisores',cantidad:1.4,insumoId:'divisor-melamina'},
   {nombre:'Pasacables',cantidad:1,insumoId:'pasacables'},{nombre:'Niveladores',cantidad:8,insumoId:'nivelador'},{nombre:'Tornilleria',cantidad:3,insumoId:'tornilleria'}]},
 'eclipse-cantilever':{id:'eclipse-cantilever',nombre:'Eclipse Cantilever 2.40 x 2.40',modoManoObra:'horas',factorDirecta:17,factorIndirecta:12,preparacionHoras:4,
   horas:{pm:0.68,pintura:0.04,acabados:0.2,tapiceria:3.74,carpinteria:67.51},componentes:[
   {nombre:'Cubierta chapa',piezas:1,anchoMM:750,largoMM:2400,cantidad:2.2,insumoId:'chapa-madera'},{nombre:'Credenza y cajones',cantidad:3.4,insumoId:'chapa-madera'},
   {nombre:'Detalles nogal',cantidad:6,insumoId:'nogal'},{nombre:'Ecopiel cubierta y tapas',cantidad:4.5,insumoId:'ecopiel'},
   {nombre:'Estructura',cantidad:8.5,insumoId:'lamina-20'},{nombre:'Barniz',cantidad:5.8,insumoId:'barniz'},
   {nombre:'Correderas',cantidad:4,insumoId:'corredera'},{nombre:'Cerradura StealthLock',cantidad:1,insumoId:'cerradura-electronica'},
   {nombre:'Caja electrica',cantidad:1,insumoId:'caja-electrica'},{nombre:'Jaladeras',cantidad:4,insumoId:'jaladera'},{nombre:'Niveladores',cantidad:4,insumoId:'nivelador'}]},
 'escritorio-app-lt-160':{id:'escritorio-app-lt-160',nombre:'Escritorio App LT 1.60 x 0.70',modoManoObra:'horas',factorDirecta:17,factorIndirecta:12,preparacionHoras:0,
   horas:{pm:4.77,pintura:0.04,acabados:0.61,tapiceria:0,carpinteria:0.94},componentes:[
   {cantos:3,nombre:'Cubierta',piezas:1,anchoMM:700,largoMM:1600,cantidad:1.12,insumoId:'melamina-19'},{nombre:'Faldon',cantidad:0.32,insumoId:'melamina-19'},
   {nombre:'Tapacanto',cantidad:4.6,insumoId:'tapacanto'},{nombre:'Estructura lamina',cantidad:4.2,insumoId:'lamina-20'},
   {nombre:'Patas PTR',cantidad:3.2,insumoId:'ptr'},{nombre:'Pintura estructura',cantidad:0.9,insumoId:'pintura-electrostatica'},
   {nombre:'Correderas cajonera',cantidad:2,insumoId:'corredera'},{nombre:'Jaladeras',cantidad:2,insumoId:'jaladera'},
   {nombre:'Niveladores',cantidad:4,insumoId:'nivelador'},{nombre:'Tornilleria',cantidad:1,insumoId:'tornilleria'}]},
};

const money = (x)=>'$'+Number(x).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
const costoDe = (pieza, mapa) => { const r = calcular(pieza, 1, mapa, parametros); return r.costoUnitario ?? r.costo ?? r.costoTotal ?? null; };

// ===================== GATE 1: PARIDAD DE MOTOR =====================
const clientAssembly = (datos) => (datos.insumos && Object.keys(datos.insumos).length) ? datos.insumos : null;
const serverAssembly = (datos) => (datos.insumos && Object.keys(datos.insumos).length) ? datos.insumos : null;
const datos = { insumos: legado };
const mapaCliente = clientAssembly(datos), mapaServidor = serverAssembly(datos);
console.log('===== GATE 1 — PARIDAD DE MOTOR (misma fuente: config) =====');
let maxDiff = 0, exactos = 0;
for (const id of Object.keys(piezas)) {
  const a = costoDe(piezas[id], mapaCliente), b = costoDe(piezas[id], mapaServidor);
  const d = Math.abs(a - b); maxDiff = Math.max(maxDiff, d); if (d < 0.005) exactos++;
  console.log(`  ${piezas[id].nombre.padEnd(34)} cliente ${money(a)}  servidor ${money(b)}  diff ${money(d)}`);
}
console.log(`  -> casos ${Object.keys(piezas).length} · exactos ${exactos} · max diff ${money(maxDiff)} · ${maxDiff<0.005?'PASS':'FAIL'}`);
console.log('  (nota: prueba determinismo + ensamblado identico en node; paridad HTTP por-rol sigue pendiente de sesiones de Rodrigo)');

// ===================== GATE 2: IMPACTO DEL CATALOGO =====================
console.log('\n===== GATE 2 — IMPACTO DEL CATALOGO NUEVO (config legado vs catalogo_vigente) =====');
let sumLeg=0,sumNue=0;
for (const id of Object.keys(piezas)) {
  const cl = costoDe(piezas[id], legado), cn = costoDe(piezas[id], nuevo);
  sumLeg+=cl; sumNue+=cn;
  const d = cn-cl, pct = cl? 100*d/cl : 0;
  console.log(`  ${piezas[id].nombre.padEnd(34)} legado ${money(cl)}  nuevo ${money(cn)}  Δ ${money(d)}  ${pct.toFixed(1)}%`);
}
const dTot = sumNue-sumLeg;
console.log(`  -> total legado ${money(sumLeg)}  nuevo ${money(sumNue)}  Δ ${money(dTot)}  ${(100*dTot/sumLeg).toFixed(1)}%`);
console.log('\n  Insumos que explican la diferencia (Δ precio en unidad de config):');
const rows = Object.keys(legado).map(id=>({id, u:legado[id].unidad, leg:legado[id].precio, nue:nuevo[id].precio, estado:cat[id].estado, cert:cat[id].cert, nota:cat[id].nota||''}))
  .filter(r=>Math.abs(r.leg-r.nue)>0.005).sort((a,b)=>Math.abs(b.nue-b.leg)-Math.abs(a.nue-a.leg));
for (const r of rows) console.log(`    ${r.id.padEnd(22)} ${r.u.padEnd(7)} ${money(r.leg)} -> ${money(r.nue)}  (${((r.nue-r.leg)/r.leg*100).toFixed(0)}%)  [${r.estado}${r.cert?'/CERT':''}] ${r.nota}`);
const certCount = Object.values(cat).filter(c=>c.cert).length;
console.log(`  -> de ${Object.keys(cat).length} insumos del benchmark, ${certCount} certificable(s); el resto preliminar (sin documento).`);

// ===================== GATE 3: REALIDAD DE CAMPO (Alpura) =====================
console.log('\n===== GATE 3 — REALIDAD DE CAMPO (Alpura, ancla T.D.C. humana) =====');
console.log('  T.D.C. humana Exhibidor Alpura (Rafa/Alba): fab id_01 $13,852.17 ; exhibidor completo fab ~$18,749.37');
console.log('  Validado previamente a nivel formula Alba (val_alpura.mjs): el motor reproduce esos fab al centavo.');
console.log('  PENDIENTE honesto: mapear el BOM de Alpura a insumo-ids del catalogo para correr calcular() y');
console.log('  comparar contra $18,749 con atribucion por insumo (lamina/acrilico/herrajes/merma). Requiere el despiece por-id.');
