// Gate 3 — cierre Alpura por insumo_id (2026-10-01). NO toca config/catalogo.
// Mapea la T.D.C. humana (id_01, Explo_MP de Rafa) a insumo_id con CONFIANZA, sin forzar.
// Autopsia honesta: escenario A (config legado) NO corre porque los materiales Alpura no estan en config.
// Para la autopsia cuantitativa por linea (motor cost por escenario) falta la CANTIDAD humana (columna qty del Explo_MP).

// Humano id_01: [nombre T.D.C., costo material humano, insumo_id|null, confianza]  (costos reales; NO hay cantidad)
const H = [
 ['PERFIL DE CANTO ABS 22mm',618.58,'canto-abs-22','exacto'],
 ['MDF MELAMINA 16mm Walnut',2594.49,'mdf-16-walnut','exacto'],
 ['LAMINA NEGRA cal 20',470.17,'lamina-3x10-20','exacto'],
 ['PINTURA EN POLVO',64.81,'pintura-polvo','equivalente'],
 ['PIJA 8x5/8',15.36,null,'sin_match'],
 ['PIJA 8x1/2',5.76,null,'sin_match'],
 ['LAMINA NEGRA cal 14',91.75,'lamina-3x10-14','exacto'],
 ['PULIDO REDONDO 1/4',18.57,'pulido-redondo-14','exacto'],
 ['TUERCA 3/8',3.54,null,'sin_match'],
 ['MDF MELAMINA 25mm Walnut',1935,'mdf-25-walnut','exacto'],
 ['LAMINADO PLASTICO 4x8',162.96,'laminado-walnut','aproximado'],
 ['PERFIL DE CANTO ABS 32mm',205.3,'canto-abs-32','exacto'],
 ['TAQUETE 8',48.3,null,'sin_match'],
 ['TUERCA INSERTO 1/4',29.04,null,'sin_match'],
 ['TUBULAR REDONDO 3/4 cal18',38.34,'tubular-redondo-34','exacto'],
 ['LAMINA NEGRA cal 12',10.05,'lamina-3x10-12','exacto'],
 ['MDF NATURAL 16mm',21.95,'mdf-16','aproximado'],
 ['TORNILLO NIVELADOR 3/8',249.78,'nivelador-plataforma','equivalente'],
 ['ACRILICO CRISTAL 3mm',428.4,'acrilico-cristal-3','exacto'],
 ['ACRILICO TRASLUCIDO 3mm',417.41,'acrilico-traslucido-3','exacto'],
 ['TORNILLO ALLEN 1/4',14.4,null,'sin_match'],
 ['PIJA 8x1 1/2',14,null,'sin_match'],
 ['PIJA FIJADORA 8x1/2',2.2,null,'sin_match'],
 ['PIJA 8x3/4',9.5,null,'sin_match'],
 ['empaque jgo',225.99,null,'sin_match'],
];
// precios: cat = catalogo_vigente (unidad), cfg = config legado (null = NO existia en produccion)
const PR = {
 'canto-abs-22':{cat:20.64,u:'m',cfg:null}, 'mdf-16-walnut':{cat:693.9,u:'hoja',cfg:null},
 'lamina-3x10-20':{cat:449.06,u:'kg',cfg:null}, 'pintura-polvo':{cat:6.69,u:'kg',cfg:null},
 'lamina-3x10-14':{cat:849.5,u:'kg',cfg:null}, 'pulido-redondo-14':{cat:30.25,u:'tramo',cfg:null},
 'mdf-25-walnut':{cat:1250,u:'hoja',cfg:null}, 'laminado-walnut':{cat:641.59,u:'hoja',cfg:null},
 'canto-abs-32':{cat:22.58,u:'m',cfg:null}, 'tubular-redondo-34':{cat:138.4,u:'tramo',cfg:null},
 'lamina-3x10-12':{cat:1116.28,u:'kg',cfg:null}, 'mdf-16':{cat:372,u:'hoja',cfg:560},
 'nivelador-plataforma':{cat:41.63,u:'pza',cfg:null}, 'acrilico-cristal-3':{cat:900,u:'hoja',cfg:null},
 'acrilico-traslucido-3':{cat:964,u:'hoja',cfg:null},
};
const money=(x)=>x==null?'   —   ':'$'+Number(x).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});

console.log('GATE 3 — MAPEO T.D.C. humana Alpura (id_01) -> insumo_id\n');
console.log('linea T.D.C.'.padEnd(26),'insumo_id'.padEnd(22),'conf'.padEnd(11),'costo_hum'.padStart(11),'cat(u)'.padStart(16),'cfg_legado'.padStart(11));
let matHum=0, matMap=0, matSin=0, enConfig=0, mapeadas=0;
for (const [nom,costo,id,conf] of H) {
  matHum+=costo;
  const p = id?PR[id]:null;
  if (id){ mapeadas++; matMap+=costo; if(p&&p.cfg!=null) enConfig++; } else matSin+=costo;
  const catStr = p? (money(p.cat)+'/'+p.u) : '';
  console.log(nom.padEnd(26), (id||'(sin match)').padEnd(22), conf.padEnd(11), money(costo).padStart(11), catStr.padStart(16), money(p?p.cfg:null).padStart(11));
}
console.log('\n--- Cobertura id_01 (material humano $'+matHum.toFixed(2)+') ---');
console.log(`  lineas mapeadas: ${mapeadas}/${H.length}  (${(100*matMap/matHum).toFixed(1)}% del costo material)`);
console.log(`  sin_match: ${H.length-mapeadas} lineas = $${matSin.toFixed(2)} (${(100*matSin/matHum).toFixed(1)}%) — tornilleria/taquetes/empaque (el catalogo los agrupa en 'tornilleria')`);
console.log(`  de los ${mapeadas} materiales mapeados, en config LEGADO existian: ${enConfig} (solo mdf-16, variante distinta)`);
console.log(`  => 14/15 materiales Alpura NO estaban en config de produccion. Todos preliminar (0 certificados).`);

console.log('\n--- AUTOPSIA (3 escenarios) — estado honesto ---');
console.log('  A) Motor + config LEGADO: NO corre para Alpura — 14/15 insumos ausentes de config.');
console.log('     Hallazgo: el sobrecosteo historico ($42,701 vs $18,749) NO vino de precios de config en estos');
console.log('     materiales (config no los tenia); vino de la ruta IA/estimacion (consumos y fallback).');
console.log('  B) Motor + catalogo RECONCILIADO: ya es posible (los 15 estan en catalogo), pero requiere');
console.log('     la CANTIDAD humana por linea (columna qty del Explo_MP) para costear sin inventar.');
console.log('  C) T.D.C. humana: material $12,316 · fab $18,749 (exhibidor completo).');
console.log('\n  BLOQUEADOR para cerrar B/C cuantitativo: falta el Explo_MP con columna de CANTIDAD.');
console.log('  Opciones: (1) Rodrigo comparte el xlsx T.D.C. con cantidades; (2) usar el despiece IA como');
console.log('  fuente de cantidades (marcado ESTIMADO, no T.D.C. humana). No se deriva qty de costo/precio (circular).');
