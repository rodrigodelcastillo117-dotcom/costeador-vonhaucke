// ============================================================================
//  REVISA PRECIOS  ·  caza errores de UNIDAD antes de publicar.
//
//  POR QUÉ EXISTE (2026-08-16). Cargando la lista de Compras metí la chapa de
//  madera a $270 "la hoja" cuando el papel decía $270 EL METRO CUADRADO. La
//  dejé tres veces más barata. Rodrigo lo cachó; la app no dijo nada.
//
//  Ése es el problema de fondo: un error de unidad NO se ve. El costo
//  simplemente sale bajo, el margen sale alto, y nadie sospecha hasta que
//  alguien pone el papel al lado. Y viene el Excel completo de Compras, con
//  cientos de renglones — a mano se van a colar más.
//
//  Cómo funciona: cada material se lleva a su precio EQUIVALENTE en la unidad
//  natural de su familia ($/m² de tablero, $/kg de acero, $/m de canto) y se
//  compara contra un rango de lo que puede costar en el mercado mexicano. No
//  busca el precio exacto —eso lo dice Compras— sino el ORDEN DE MAGNITUD:
//  un error de unidad siempre se va por 3, por 10 o por 20, nunca por 5%.
//
//    node scripts/revisa-precios.mjs
// ============================================================================
import { INSUMOS_SEMILLA } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';

// Rango plausible por familia, en la unidad natural. Ancho a propósito: esto
// caza errores de unidad, no diferencias de proveedor.
const RANGOS = [
  // Los tableros van SEPARADOS por familia, y esto no es un detalle: con un
  // solo rango ancho (80 a 900 $/m²) esta misma red NO cachó el error de la
  // chapa —$90/m² le pareció normal— porque un aglomerado crudo sí cuesta eso.
  // El rango tiene que ser tan angosto como el material lo permita.
  { que: 'aglomerado / melamina / MDF crudo', unidad: '$/m²',
    aplica: (i) => i.formato?.tipo === 'tablero' && /^(melamina|mdf|aglomerado|faldon-melamina)/.test(i.id),
    equiv: (i) => precio(i) / i.formato.medida, min: 100, max: 550 },
  // El rango de la chapa sale de las COMPRAS REALES del ERP, no de mi intuición:
  // las 6 compras de 2026 van de $139 a $270 el m², y la decorativa ANTRACITE
  // de la lista de Compras está en $270. Puse 200 como piso y el revisor marcó
  // en falso la chapa que sí compran, a $181.
  { que: 'chapa de madera (enchapado)', unidad: '$/m²',
    aplica: (i) => i.formato?.tipo === 'tablero' && /^chapa/.test(i.id),
    equiv: (i) => precio(i) / i.formato.medida, min: 120, max: 900 },
  { que: 'laminado / membrana / otros tableros', unidad: '$/m²',
    aplica: (i) => i.formato?.tipo === 'tablero' && !/^(melamina|mdf|aglomerado|chapa|faldon-melamina)/.test(i.id),
    equiv: (i) => precio(i) / i.formato.medida, min: 100, max: 900 },
  { que: 'lámina de acero negro', unidad: '$/kg',
    aplica: (i) => i.formato?.tipo === 'lamina' && !/inox/.test(i.id),
    equiv: (i) => precio(i) / i.formato.medida, min: 12, max: 60 },
  // El inoxidable 304 cuesta varias veces el acero negro: rango aparte, si no
  // el revisor grita en falso cada vez y uno acaba ignorándolo.
  { que: 'acero inoxidable 304', unidad: '$/kg',
    aplica: (i) => i.formato?.tipo === 'lamina' && /inox/.test(i.id),
    equiv: (i) => precio(i) / i.formato.medida, min: 60, max: 220 },
  { que: 'tubo / PTR', unidad: '$/m',
    aplica: (i) => /^ptr/.test(i.id) && i.unidad === 'm',
    equiv: (i) => precio(i), min: 15, max: 300 },
  { que: 'canto / tapacanto', unidad: '$/m',
    aplica: (i) => /canto/.test(i.id) && i.unidad === 'm',
    equiv: (i) => precio(i), min: 1.5, max: 60 },
  { que: 'mampara y biombo (por superficie)', unidad: '$/m²',
    aplica: (i) => i.seccion === 'mamparas' && i.unidad === 'm2',
    equiv: (i) => precio(i), min: 150, max: 3500 },
];

// Precio en PESOS: los insumos de importación se guardan en su moneda.
const precio = (i) => (i.moneda && i.moneda !== 'MXN'
  ? (i.precio || 0) * PARAMETROS_DEFAULT.tipoCambio
  : (i.precio || 0));

const problemas = [];
const revisados = new Set();

for (const r of RANGOS) {
  for (const i of INSUMOS_SEMILLA.filter(r.aplica)) {
    revisados.add(i.id);
    const v = r.equiv(i);
    if (!(v > 0)) { problemas.push(`${i.id}: no se pudo calcular su ${r.unidad}`); continue; }
    if (v < r.min || v > r.max) {
      const cuantas = v < r.min ? (r.min / v) : (v / r.max);
      problemas.push(
        `${i.id} (${i.nombre})\n      sale en ${v.toFixed(2)} ${r.unidad}, y un ${r.que} anda entre ${r.min} y ${r.max}` +
        `\n      → está ${cuantas.toFixed(1)}× fuera. Revisa la UNIDAD: ¿el papel lo cotiza por hoja, por m² o por kg?`);
    }
  }
}

// Un insumo con precio pero sin fuente es un número que nadie puede comprobar.
const sinFuente = INSUMOS_SEMILLA.filter((i) => (i.precio || 0) > 0 && !i.fuente);

console.log(`Revisados ${revisados.size} materiales de ${INSUMOS_SEMILLA.length} contra su rango de mercado.`);
if (problemas.length) {
  console.log(`\n✗ ${problemas.length} POSIBLE(S) ERROR(ES) DE UNIDAD:\n`);
  for (const p of problemas) console.log('   · ' + p + '\n');
} else {
  console.log('✓ ningún precio fuera de su rango: no se ve ningún error de unidad.');
}
console.log(`\n${sinFuente.length} de ${INSUMOS_SEMILLA.length} materiales no dicen DE DÓNDE salió su precio.`);
if (sinFuente.length) console.log('   (' + sinFuente.slice(0, 12).map((i) => i.id).join(', ') + (sinFuente.length > 12 ? ', …' : '') + ')');

process.exit(problemas.length ? 1 : 0);
