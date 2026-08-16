// ¿CUÁNTO DINERO MUEVE el choque de unidad de la lámina?
// lamina-20: formato.medida = 21.3 KG por hoja de 1.22x2.44 (= 2.9768 m2)
//            => 21.3 / 2.9768 = 7.155 kg/m2.
// Cuando el despiece manda un componente con largoMM x anchoMM, netoComponente
// devuelve M2 y el motor lo divide entre 21.3 KG como si fueran kg.
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT, calcular } from '../src/motor/calculo.js';

const base = mapaInsumos(INSUMOS_SEMILLA);
const estado = { insumos: base, parametros: PARAMETROS_DEFAULT };
const KG_M2 = { 'lamina-20': 21.3 / 2.9768, 'lamina-14': 44.4 / 2.9768, 'lamina-18': 28.4 / 2.9768, 'lamina-22': 17.7 / 2.9768 };

const CASOS = [
  ['rio', 'bench_curvo_doble', { usuarios: '8', largo: '1200', biombo: 'LP' }],
  ['rio', 'bench_curvo_doble', { usuarios: '6', largo: '1200' }],
  ['rio', 'bench_recto_doble', { usuarios: '8', largo: '1200', biombo: 'LP' }],
  ['rio', 'bench_recto_sencillo', { usuarios: '4', largo: '1200' }],
  ['luna','escritorio',{ credenza:'baja' }],['luna','escritorio',{ tipo:'movil' }],
];

const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');
console.log('Lámina consumida como M2 cuando el formato está en KG (factor 7.155 kg/m2 en cal.20)\n');

for (const [ruta, prod, sel] of CASOS) {
  const L = LINEAS_REG[ruta];
  const p = L.productos.find((x) => x.id === prod);
  const cfg = configDesde(p, sel);
  const g = L.generar(cfg);
  // Componentes de lámina mandados como ÁREA
  const malos = (g.componentes || []).filter((c) => KG_M2[c.insumoId] && c.largoMM && c.anchoMM);
  if (!malos.length) { console.log(`${ruta}.${prod}: sin componentes de lámina por área`); continue; }

  // Despiece corregido: convertir esos componentes de m2 -> kg
  const gFix = { ...g, componentes: g.componentes.map((c) => {
    if (!(KG_M2[c.insumoId] && c.largoMM && c.anchoMM)) return c;
    const m2 = (c.largoMM / 1000) * (c.anchoMM / 1000) * (c.piezas || 1);
    return { insumoId: c.insumoId, nombre: c.nombre, cantidad: m2 * KG_M2[c.insumoId] };
  }) };

  const par = g.modeloCosteo === 'intelisis'
    ? { ...PARAMETROS_DEFAULT, modeloCosteo: 'intelisis', usarCostoPorArea: true, ...(g.parModelo || {}) }
    : PARAMETROS_DEFAULT;
  const mk = (gg) => calcular({ nombre: gg.nombre, componentes: gg.componentes, horas: gg.horas, modoManoObra: gg.modoManoObra, modeloCosteo: gg.modeloCosteo, factorDirecta: gg.factorDirecta, factorIndirecta: gg.factorIndirecta }, 1, base, par);
  const a = mk(g), b = mk(gFix);

  console.log(`### ${ruta}.${prod}  ${JSON.stringify(sel)}`);
  for (const c of malos) {
    const m2 = (c.largoMM / 1000) * (c.anchoMM / 1000) * (c.piezas || 1);
    console.log(`   ${c.nombre}`);
    console.log(`      ${c.largoMM}×${c.anchoMM}×${c.piezas || 1} = ${m2.toFixed(3)} m2 → se cobran ${m2.toFixed(3)} "kg"; pesa ${(m2 * KG_M2[c.insumoId]).toFixed(2)} kg (${KG_M2[c.insumoId].toFixed(2)} kg/m2)`);
  }
  console.log(`   material  ${pesos(a.materialTotal).padStart(10)} → ${pesos(b.materialTotal).padStart(10)}   (+${pesos(b.materialTotal - a.materialTotal)})`);
  console.log(`   costo u.  ${pesos(a.costoUnitario).padStart(10)} → ${pesos(b.costoUnitario).padStart(10)}   (+${((b.costoUnitario / a.costoUnitario - 1) * 100).toFixed(1)}%)`);
  const r = costearConfig(estado, ruta, prod, cfg, 1);
  console.log(`   precio que cotiza hoy la app: ${pesos(r.precioUnitario)}  (${r.precioReal ? 'PAPEL' : 'modelo'})\n`);
}
