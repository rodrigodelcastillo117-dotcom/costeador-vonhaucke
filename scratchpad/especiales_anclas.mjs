// Contrasta lo que la app cobra por los materiales de un ESPECIAL contra lo que
// Von Haucke pagó de verdad (ERP, última compra). Sólo lectura.
import fs from 'node:fs';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { calcular, precioDe, PARAMETROS_DEFAULT } from '../src/motor/calculo.js';

const insumos = mapaInsumos(INSUMOS_SEMILLA);
const $ = (n) => '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });

console.log('=== ANCLAS REALES DEL ERP vs. LO QUE COBRA LA APP ===\n');

const anclas = [
  { que: 'CUARZO / ecomármol (NO EXISTE en la app)', erp: 'MVLSHJ05050000 HOJA ECOMARMOL SILESTONE ETERNAL SERENA 3170x1580x12', costo: 24022.13, m2: 3.170 * 1.580, app: null },
  { que: 'CUARZO cubierta terminada', erp: 'MACMCU064204G1 CUBIERTA PEBBLE 1000x625 en ECOMARMOL SILESTONE', costo: 4002, m2: 1.0 * 0.625, app: null },
  { que: 'DEKTON', erp: 'MVLSHJ03060000 HOJA ECOMARMOL DEKTON 3200x1440x12', costo: 39616.02, m2: 3.2 * 1.44, app: null },
  { que: 'MÁRMOL cubierta terminada', erp: 'MDMACU01250212 CUBIERTA RECT 2100x900x20 mármol', costo: 14698, m2: 2.1 * 0.9, app: insumos['marmol'].precio },
  { que: 'MÁRMOL cubierta terminada (2)', erp: 'MANMCU032824K4 CUBIERTA RECT 2100x900x20 canto ala de avión', costo: 18960, m2: 2.1 * 0.9, app: insumos['marmol'].precio },
  { que: 'CRISTAL TEMPLADO 9mm cortado', erp: 'MABCCR06HZ020J CRISTAL TRANSP 1493x426x9 cantos pulidos templado', costo: 1169, m2: 1.493 * 0.426, app: insumos['cristal-templado'].precio },
];
for (const a of anclas) {
  const real = a.costo / a.m2;
  console.log(`${a.que}`);
  console.log(`   ERP: ${a.erp}`);
  console.log(`   real ${$(a.costo)} / ${a.m2.toFixed(3)} m² = ${$(real)} el m²   |   app: ${a.app ? $(a.app) + ' el m² → ' + (real / a.app).toFixed(1) + '× MÁS BARATA' : 'NO EXISTE'}`);
  console.log('');
}

// INOX: el formato de la app está atado a una hoja 4x8 de acero al carbón.
const inox = insumos['inoxidable'];
const kgHojaApp = inox.formato.medida;                 // 21.3 kg (hoja 4x8 cal 20 acero)
const m2_4x10 = 1.219 * 3.048;
const kg_4x10 = m2_4x10 * 0.000912 * 8000;             // cal 20 = 0.912 mm, inox 8000 kg/m3
console.log('INOXIDABLE');
console.log(`   app: ${$(inox.precio)} por "hoja" de ${kgHojaApp} kg = ${$(inox.precio / kgHojaApp)}/kg  [fuente: ${inox.fuente || 'NINGUNA'}]`);
console.log(`   ERP: MVLSLA06270503 LAMINA INOX HOJA 4x10 CAL 20 SATINADO P3 T-304 = $1,770 (2026-01-07)`);
console.log(`        esa hoja son ${m2_4x10.toFixed(2)} m² ≈ ${kg_4x10.toFixed(1)} kg → ${$(1770 / kg_4x10)}/kg`);
console.log(`   → la app está ${((inox.precio / kgHojaApp) / (1770 / kg_4x10) * 100 - 100).toFixed(0)}% ALTA, y su formato es una hoja 4x8 que Compras no compra en inox.\n`);

// ---- Qué pasa si el mármol se pone a precio real ----
const mesa = (precioMarmol) => {
  const ins = { ...insumos, marmol: { ...insumos.marmol, precio: precioMarmol } };
  const p = {
    nombre: 'Mesa juntas 5m',
    componentes: [
      { nombre: 'Cubierta mármol', insumoId: 'marmol', largoMM: 2500, anchoMM: 1400, piezas: 2 },
      { nombre: 'Base inox', insumoId: 'inoxidable', cantidad: 45 },
      { nombre: 'PTR', insumoId: 'ptr-3-14', cantidad: 12 },
      { nombre: 'Byrne', insumoId: 'caja-byrne', cantidad: 2 },
      { nombre: 'Niveladores', insumoId: 'nivelador', cantidad: 8 },
    ],
    modoManoObra: 'porcentaje', factorDirecta: 70, factorIndirecta: 12,
  };
  return calcular(p, 1, ins, PARAMETROS_DEFAULT);
};
const a = mesa(2000), b = mesa(7777);
console.log('MESA DE JUNTAS 5 m — el efecto de un solo precio mal puesto');
console.log(`   con mármol a $2,000/m² (lo que trae la app): costo ${$(a.costoUnitario)} → precio 50% ${$(precioDe(a.costoUnitario, 50))}`);
console.log(`   con mármol a $7,777/m² (ancla ERP):          costo ${$(b.costoUnitario)} → precio 50% ${$(precioDe(b.costoUnitario, 50))}`);
console.log(`   DIFERENCIA DE PRECIO: ${$(precioDe(b.costoUnitario, 50) - precioDe(a.costoUnitario, 50))} que hoy la app NO cobra.\n`);

// ---- Maniobras en los presupuestos reales ----
console.log('MANIOBRAS (instalación) EN LOS PRESUPUESTOS REALES — la app no tiene este renglón');
const pres = [
  ['226050048 (cancelería Wand)', 295340, 0, 8861],
  ['226050047', 115588, 114552, 6905],
  ['226010047', 62280, 7400, 2100],
  ['226030018 (con RECEPCIÓN + SALA DE JUNTAS)', 358905, 306366, 80360],
];
for (const [n, mob, sil, man] of pres) {
  console.log(`   ${n.padEnd(44)} maniobras ${$(man).padStart(10)} = ${(man / (mob + sil) * 100).toFixed(1)}% del proyecto`);
}
