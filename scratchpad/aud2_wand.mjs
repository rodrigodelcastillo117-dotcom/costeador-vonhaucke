// ============================================================================
//  AUD2 — encargo 2 (muro de cancelería) contra el presupuesto REAL 226050048
//  "cancelería Wand". Ancla limpia: la PUERTA de 1.00 x 2.40 m.
// ============================================================================
import { calcular, precioDe, PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';

const insumos = mapaInsumos(INSUMOS_SEMILLA);
const par = { ...PARAMETROS_DEFAULT };
const $ = (n) => '$' + Math.round(Number(n)).toLocaleString('es-MX');

// --- REAL, del PDF 226050048 (21/05/2026) ---
const REAL = {
  puertaWand: 12680,        // P. Unitario, 4 pzas = $50,720
  cancelWand: 244620,       // 1 modulo
  mobiliario: 295340,
  maniobras: 8861,          // 3.0%
};

// --- La MISMA puerta, armada en la app tal como se puede hoy ---
const puerta = {
  nombre: 'Puerta 1.00 x 2.40 m tipo Wand (cristal + estructura metalica + cerradura)',
  piezas: 1,
  componentes: [
    { nombre: 'Hoja de cristal templado 12 mm', insumoId: 'cristal-templado-12', largoMM: 2400, anchoMM: 1000, piezas: 1 },
    // estructura metalica negra: lo mas cercano que hay es el perfil generico
    { nombre: 'Estructura metalica (perfil aluminio generico)', insumoId: 'perfil-aluminio', cantidad: 6.8 },
    { nombre: 'Cerradura', insumoId: 'cerradura', cantidad: 1 },
    { nombre: 'Bisagras / pivote', insumoId: 'bisagra', cantidad: 3 },
    { nombre: 'Silicon', insumoId: 'silicon', cantidad: 2 },
  ],
  modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12,
};

const r = calcular(puerta, 1, insumos, par);
const p50 = precioDe(r.costoUnitario, 50);
const p40 = precioDe(r.costoUnitario, 40);

console.log('\n=== ENCARGO 2 · la PUERTA, como la cobra Von Haucke vs como la costea la app ===\n');
console.log(`REAL   presupuesto 226050048, puerta Wand 1000x2400x60, derecha,`);
console.log(`       con cerradura y estructura metalica negra, cristal transparente`);
console.log(`       P. UNITARIO DE LISTA  ................  ${$(REAL.puertaWand)}   (4 pzas = ${$(REAL.puertaWand * 4)})\n`);
console.log(`APP    misma puerta, con los insumos que SI existen hoy:`);
console.log(`       costo unitario ........................  ${$(r.costoUnitario)}`);
console.log(`       precio a 40% margen ...................  ${$(p40)}`);
console.log(`       precio a 50% margen ...................  ${$(p50)}\n`);
console.log(`       LA APP SE QUEDA CORTA POR ............  ${$(REAL.puertaWand - p50)}  (${(REAL.puertaWand / p50).toFixed(1)}x)`);
console.log(`       En las 4 puertas del proyecto: .......  ${$((REAL.puertaWand - p50) * 4)}\n`);

console.log('   Desglose de material que si encontro la app:');
for (const c of (r.componentes || r.detalle || [])) {
  console.log(`     ${(c.nombre || '').padEnd(52)} ${$(c.costo ?? c.importe ?? 0)}`);
}

console.log('\n=== Lo que el proyecto real trae y la app NO tiene renglon para cobrar ===');
console.log(`   Maniobras / instalacion ...............  ${$(REAL.maniobras)}  = ${(REAL.maniobras / REAL.mobiliario * 100).toFixed(1)}% del mobiliario`);
console.log(`   (la app NO tiene renglon de maniobras: Cotizacion.jsx:134-142)`);

console.log('\n=== El muro completo del encargo 2 (6.00 x 2.40 m = 14.4 m2) ===');
const muro = {
  nombre: 'Muro divisorio 6.00 x 2.40 m',
  piezas: 1,
  componentes: [
    { nombre: 'Cristal templado 6mm (5 panos)', insumoId: 'cristal-templado-6', largoMM: 2400, anchoMM: 1000, piezas: 5 },
    { nombre: 'Hoja de puerta cristal', insumoId: 'cristal-templado-12', largoMM: 2100, anchoMM: 900, piezas: 1 },
    { nombre: 'Perfil aluminio canceleria (SUSTITUTO generico)', insumoId: 'perfil-aluminio', cantidad: 28.8 },
    { nombre: 'Silicon', insumoId: 'silicon', cantidad: 6 },
    { nombre: 'Cerradura puerta', insumoId: 'cerradura', cantidad: 1 },
    { nombre: 'Bisagras / pivote', insumoId: 'bisagra', cantidad: 3 },
  ],
  modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12,
};
const rm = calcular(muro, 1, insumos, par);
const pm50 = precioDe(rm.costoUnitario, 50);
console.log(`   APP:  costo ${$(rm.costoUnitario)}  precio 50% ${$(pm50)}  =  ${$(pm50 / 14.4)} el m2`);
console.log(`   REAL: la puerta Wand sola son ${$(REAL.puertaWand / 2.4)} el m2 (2.4 m2 por puerta)`);
console.log(`   -> el muro ENTERO de la app sale a ${(REAL.puertaWand / 2.4 / (pm50 / 14.4)).toFixed(1)}x menos por m2 que UNA PUERTA real,`);
console.log(`      y encima sin maniobras (${$(pm50 * 0.03)} al 3%) y sin perfil de canceleria de verdad.`);
