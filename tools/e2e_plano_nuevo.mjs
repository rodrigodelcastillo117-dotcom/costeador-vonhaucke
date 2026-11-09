// ============================================================================
//  E2E PLANO NUEVO (fuera de muestra) — TELSVH120.
//  Corre el MOTOR REAL del repo sobre el despiece leido EN VIVO del plano:
//    bomDesdeDespiece -> BOM canonico (BORRADOR, conserva pendientes)
//    proponerRouting  -> operaciones de fabrica (todas PENDIENTE_TIEMPO)
//  y arma el EXPEDIENTE con estado economico HONESTO (sin inventar precios/tiempos).
//  Uso: node tools/e2e_plano_nuevo.mjs
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { bomDesdeDespiece } from '../src/datos/productoMaestroDesdeDespiece.js';
import { proponerRouting } from '../src/datos/routingFabricacion.js';
import { costoPropuesto } from '../src/datos/costoPropuestoProcesos.js';

const dimsDeDesc = (desc) => {
  const m = String(desc).match(/(\d+(?:\.\d+)?)\s*[Xx]\s*(\d+(?:\.\d+)?)\s*[Xx]\s*(\d+(?:\.\d+)?)/);
  return m ? [+m[1], +m[2], +m[3]] : (String(desc).match(/(\d+)\s*[Xx]\s*(\d+)/) ? [+RegExp.$1, +RegExp.$2] : []);
};

const RAIZ = new URL('../', import.meta.url);
const exp = JSON.parse(readFileSync(new URL('src/datos/fixtures/telsvh120_plano_nuevo.json', RAIZ), 'utf8'));

// --- insumos map (ERP real resuelto) + detalle para el motor ---
const insumos = {};
const detalle = exp.bom.map((l) => {
  if (l.insumoId) {
    insumos[l.insumoId] = { nombre: l.desc, precio: l.precio, unidad_compra: l.unidad,
      seccion: l.esCompraVenta ? 'graficos' : 'metal' };
    return { insumoId: l.insumoId, unidades: l.cantidad, unidad: l.unidad,
      precio: l.precio, costo: +(l.precio * l.cantidad).toFixed(4), desc: l.desc, esCompraVenta: !!l.esCompraVenta };
  }
  return { insumoId: null, desc: l.desc, unidad: l.unidad || 'pieza', esCompraVenta: !!l.esCompraVenta };
});

// Factores COMPARABLES (TELCEL 10/25) — PRESTADOS, no autorizados para TELSVH120.
const bom = bomDesdeDespiece(detalle, insumos, {
  clave: exp._meta.clave, nombre: exp.interpretacion.producto,
  factorMo: 0.10, factorGif: 0.25,
  dims_mm: [exp.interpretacion.dimensiones_generales_mm.ancho, exp.interpretacion.dimensiones_generales_mm.alto, exp.interpretacion.dimensiones_generales_mm.fondo],
  fuente: exp._meta.fuente_plano,
});

// Routing desde las piezas del BOM (incluye fabricadas, cristal, LED).
const routing = proponerRouting({ piezas: exp.bom.map((l) => ({ nombre: l.desc, insumoId: l.insumoId })), insumos });

// Costo PROPUESTO por procesos (PRIORIDAD 3): lámina cota inferior (base ERP) + MO pendiente de tarifas.
const fabricadas = exp.bom.filter((l) => l.fabricada).map((l) => ({ clave: l.clave, cantidad: l.cantidad, dims_mm: dimsDeDesc(l.desc) }));
const propuesta = costoPropuesto({ fabricadas, operaciones: routing.operaciones, materialResueltoMxn: bom.material_real });

// --- estado economico HONESTO ---
const nResueltas = bom.lineas.filter((l) => !l.pendiente).length;
const nPend = bom.pendientes.length;
const estado_economico = {
  material_resuelto_mxn: bom.material_real,
  lineas_resueltas: nResueltas,
  lineas_pendientes: nPend,
  cobertura_bom: `${nResueltas}/${exp.bom.length} renglones con precio ERP`,
  cos_fab_calculado_PARCIAL_mxn: bom.cos_fab_calculado,
  base_factores: 'TELCEL 10/25 PRESTADOS (no autorizados para TELSVH120) — ilustrativo',
  mano_obra_certificable: routing.resumen.mano_obra_certificable,
  veredicto_costo: nPend > 0
    ? 'NO CERTIFICABLE / PARCIAL: faltan ' + nPend + ' pieza(s) (fabricadas de lamina + compradas sin precio) y tiempos/tarifas de routing. El total resuelto es un PISO de material, no el costo del producto.'
    : 'material completo',
  no_verificable_por: bom.no_verificable_por,
};

const expediente = {
  clave: exp._meta.clave,
  generado: new Date().toISOString().slice(0, 10),
  interpretacion: exp.interpretacion,
  bom_canonico: { tipo_bom: bom.tipo_bom, estado: bom.estado, total_renglones: exp.bom.length,
    resueltas: nResueltas, pendientes: bom.pendientes.map((p) => ({ desc: p.desc, motivo: p.motivo })) },
  routing: { total_operaciones: routing.resumen.total, por_centro: routing.resumen.por_centro,
    operaciones: routing.operaciones.map((o) => ({ op: o.op, centro: o.centro, estado: o.estado, disparada_por: o.disparada_por })),
    nota: routing.resumen.nota },
  estado_economico,
  costo_propuesto: propuesta,
  esto_necesito_confirmar: propuesta.preguntas_ingenieria,
};

mkdirSync(new URL('expedientes/', RAIZ), { recursive: true });
const out = new URL('expedientes/EXPEDIENTE_TELSVH120.json', RAIZ);
writeFileSync(out, JSON.stringify(expediente, null, 2));

// --- resumen a consola ---
console.log('===== E2E PLANO NUEVO: TELSVH120 (fuera de muestra) =====');
console.log('Producto:', exp.interpretacion.producto);
console.log('Dims mm:', JSON.stringify(exp.interpretacion.dimensiones_generales_mm));
console.log('BOM:', bom.tipo_bom, '| renglones', exp.bom.length, '| resueltos', nResueltas, '| pendientes', nPend);
console.log('  Pendientes:', bom.pendientes.map((p) => p.desc.slice(0, 40)).join(' | '));
console.log('Material RESUELTO (piso):', '$' + bom.material_real.toLocaleString('es-MX'), 'MXN  (', estado_economico.cobertura_bom, ')');
console.log('cos_fab_calculado PARCIAL (factores prestados):', bom.cos_fab_calculado ? '$' + bom.cos_fab_calculado.toLocaleString('es-MX') : '—');
console.log('Routing:', routing.resumen.total, 'operaciones |', JSON.stringify(routing.resumen.por_centro));
console.log('  MO certificable:', routing.resumen.mano_obra_certificable, '(sin tiempos/tarifas autorizados)');
console.log('--- COSTO PROPUESTO POR PROCESOS (no certificable) ---');
console.log('  Material piso (ERP resuelto + lámina cota):', '$' + propuesta.material.total_floor_mxn.toLocaleString('es-MX'),
  '( resuelto', '$' + propuesta.material.resuelto_erp_mxn.toLocaleString('es-MX'), '+ lámina cota', '$' + propuesta.material.lamina_propuesta_mxn_cota.toLocaleString('es-MX'), ')');
console.log('  MO:', propuesta.mano_obra.mxn ?? 'PENDIENTE (sin tarifas autorizadas)', '|', propuesta.mano_obra.nota || '');
console.log('  ESTO NECESITO CONFIRMAR (', propuesta.preguntas_ingenieria.length, 'preguntas):');
propuesta.preguntas_ingenieria.slice(0, 8).forEach((q, i) => console.log('   ', i + 1, '·', q));
console.log('VEREDICTO COSTO:', estado_economico.veredicto_costo);
console.log('Expediente ->', out.pathname);
