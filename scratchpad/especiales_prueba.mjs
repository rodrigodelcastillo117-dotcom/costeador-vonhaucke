// Cuesta los 4 encargos de ESPECIAL con el motor real, tal cual los armaría
// el Asistente Especial / Costeador. No toca src/.
import { calcular, precioDe, PARAMETROS_DEFAULT, precioDeInsumo } from '../src/motor/calculo.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';

const insumos = mapaInsumos(INSUMOS_SEMILLA);
const par = { ...PARAMETROS_DEFAULT };
const $ = (n) => '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });

function existe(id) { return !!insumos[id]; }

// --------------------------------------------------------------------------
// 1) RECEPCIÓN CURVA 3.20 m — melamina, frente laminado, cubierta CUARZO,
//    cajonera y paso de cables.
const recepcion = {
  nombre: 'Recepción curva 3.20 m',
  piezas: 1,
  componentes: [
    // cubierta de CUARZO -> no existe. Se sustituye por 'marmol' (lo más cercano).
    { nombre: 'Cubierta cuarzo 3200x600 (SUSTITUTO: mármol)', insumoId: 'marmol', largoMM: 3200, anchoMM: 600, piezas: 1 },
    { nombre: 'Cuerpo melamina 19', insumoId: 'melamina-19', largoMM: 3200, anchoMM: 1100, piezas: 2 },
    { nombre: 'Frente laminado', insumoId: 'laminado', largoMM: 3200, anchoMM: 1100, piezas: 1 },
    { nombre: 'Canto', insumoId: 'tapacanto', cantidad: 18 },
    { nombre: 'Curvado (ruteo CNC + canto curvo)', insumoId: 'curvado', cantidad: 6.4 },
    { nombre: 'Cajonera móvil', insumoId: 'cajonera-movil', cantidad: 1 },
    { nombre: 'Pasacables', insumoId: 'pasacables', cantidad: 2 },
    { nombre: 'Ducto paso de cables', insumoId: 'ducto', cantidad: 3.2 },
  ],
  modoManoObra: 'porcentaje', factorDirecta: 90, factorIndirecta: 12,
};

// --------------------------------------------------------------------------
// 2) MURO DIVISORIO 6 x 2.40 m — cancelería de aluminio + cristal templado +
//    1 puerta abatible.
const muro = {
  nombre: 'Muro divisorio 6.00 x 2.40 m',
  piezas: 1,
  componentes: [
    { nombre: 'Cristal templado 6mm (5 paños)', insumoId: 'cristal-templado-6', largoMM: 2400, anchoMM: 1000, piezas: 5 },
    { nombre: 'Hoja de puerta cristal', insumoId: 'cristal-templado-12', largoMM: 2100, anchoMM: 900, piezas: 1 },
    // Cancelería: NO hay perfil de cancelería. El más cercano es 'perfil-aluminio' (genérico).
    { nombre: 'Perfil aluminio cancelería (SUSTITUTO genérico)', insumoId: 'perfil-aluminio', cantidad: 28.8 },
    { nombre: 'Silicón', insumoId: 'silicon', cantidad: 6 },
    { nombre: 'Cerradura puerta', insumoId: 'cerradura', cantidad: 1 },
    { nombre: 'Bisagras / pivote', insumoId: 'bisagra', cantidad: 3 },
  ],
  modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12,
};

// --------------------------------------------------------------------------
// 3) MOSTRADOR RETAIL 2.40 m — vitrina de cristal, LED, logo en acrílico.
const mostrador = {
  nombre: 'Mostrador retail 2.40 m con vitrina',
  piezas: 1,
  componentes: [
    { nombre: 'Cuerpo MDF 19', insumoId: 'mdf', largoMM: 2400, anchoMM: 900, piezas: 3 },
    { nombre: 'Cubierta laminado', insumoId: 'laminado', largoMM: 2400, anchoMM: 600, piezas: 1 },
    { nombre: 'Vitrina cristal', insumoId: 'cristal-flotado', largoMM: 2400, anchoMM: 500, piezas: 3 },
    { nombre: 'Logo acrílico', insumoId: 'acrilico', largoMM: 800, anchoMM: 300, piezas: 1 },
    { nombre: 'Canto', insumoId: 'tapacanto', cantidad: 22 },
    // LED: NO EXISTE ningún insumo de iluminación en la app.
    { nombre: 'Tira LED + fuente (NO EXISTE en la app)', insumoId: '__FALTA_LED__', cantidad: 5 },
  ],
  modoManoObra: 'porcentaje', factorDirecta: 70, factorIndirecta: 12,
};

// --------------------------------------------------------------------------
// 4) MESA DE JUNTAS 5 m en MÁRMOL, base de INOXIDABLE, 2 cajas Byrne.
const mesa = {
  nombre: 'Mesa de juntas 5.00 m mármol + base inox',
  piezas: 1,
  componentes: [
    { nombre: 'Cubierta mármol 5000x1400 (2 piezas)', insumoId: 'marmol', largoMM: 2500, anchoMM: 1400, piezas: 2 },
    // Inox: la app NO deja meter largo x ancho (formato 'lamina'), pide "cantidad (hoja)"
    // pero el motor la interpreta en KG. Aquí van los kg reales de la base.
    { nombre: 'Base inoxidable (cantidad se captura en "hoja" pero es KG)', insumoId: 'inoxidable', cantidad: 45 },
    { nombre: 'Refuerzo PTR', insumoId: 'ptr-3-14', cantidad: 12 },
    { nombre: 'Cajas Byrne', insumoId: 'caja-byrne', cantidad: 2 },
    { nombre: 'Niveladores', insumoId: 'nivelador', cantidad: 8 },
  ],
  modoManoObra: 'porcentaje', factorDirecta: 70, factorIndirecta: 12,
};

const ENCARGOS = [recepcion, muro, mostrador, mesa];

for (const e of ENCARGOS) {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(e.nombre);
  console.log('══════════════════════════════════════════════════════════════');
  const faltan = e.componentes.filter((c) => !existe(c.insumoId));
  if (faltan.length) {
    for (const f of faltan) console.log(`  ⚠️  IGNORADO EN SILENCIO -> "${f.nombre}" (insumoId=${f.insumoId})`);
  }
  const r = calcular(e, e.piezas, insumos, par);
  for (const d of r.detalleInsumos) {
    console.log(`   ${d.nombre.padEnd(46)} neto ${d.neto.toFixed(2)} ${d.unidad.padEnd(6)} $/u ${String(d.precio).padStart(9)}  = ${$(d.costo).padStart(11)}  ${d.clase}`);
  }
  console.log(`   ${'—'.repeat(70)}`);
  console.log(`   Material directo   ${$(r.materialDirecto)}`);
  console.log(`   Material indirecto ${$(r.materialIndirecto)}`);
  console.log(`   Mano de obra (${e.factorDirecta}%) ${$(r.manoObra)}`);
  console.log(`   Gastos de fábrica (34% s/ MP directa) ${$(r.indirectosFabrica)}`);
  console.log(`   COSTO UNITARIO     ${$(r.costoUnitario)}`);
  console.log(`   PRECIO 50% margen  ${$(precioDe(r.costoUnitario, 50))}`);
  console.log(`   PRECIO 40% margen  ${$(precioDe(r.costoUnitario, 40))}`);
}

// --------------------------------------------------------------------------
console.log('\n\n### ¿QUÉ INSUMOS PIDEN LOS 4 ENCARGOS Y CUÁLES HAY? ###');
const buscar = ['cuarzo', 'aluminio', 'templado', 'led', 'ilumin', 'acrilic', 'inoxid', 'marmol', 'byrne'];
for (const t of buscar) {
  const hits = Object.values(insumos).filter((i) => (i.nombre + ' ' + i.id).toLowerCase().includes(t));
  console.log(`\n  "${t}" -> ${hits.length} insumo(s)`);
  for (const h of hits) console.log(`      ${h.id.padEnd(22)} ${h.nombre.padEnd(46)} ${$(precioDeInsumo(h, par))} / ${h.unidad}  ${h.fuente ? '[' + h.fuente + ']' : '[SIN FUENTE]'}`);
}
