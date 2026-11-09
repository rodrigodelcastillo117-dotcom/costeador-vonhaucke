// ============================================================================
//  E2E PLANO NUEVO (fuera de muestra) — TELSVH120.
//  Pipeline industrial con el MOTOR REAL: interpreta -> BOM -> routing ->
//  COSTEO INDUSTRIAL (MP fisica real de lamina + MO/GIF POLITICA_VH + routing por
//  tiempos pendiente) -> expediente + diferencias vs el costeo anterior.
//  Uso: node tools/e2e_plano_nuevo.mjs
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { bomDesdeDespiece } from '../src/datos/productoMaestroDesdeDespiece.js';
import { proponerRouting } from '../src/datos/routingFabricacion.js';
import { costearProductoIndustrial } from '../src/datos/costoPropuestoProcesos.js';

const RAIZ = new URL('../', import.meta.url);
const exp = JSON.parse(readFileSync(new URL('src/datos/fixtures/telsvh120_plano_nuevo.json', RAIZ), 'utf8'));
const dimsDeDesc = (desc) => {
  const m = String(desc).match(/(\d+(?:\.\d+)?)\s*[Xx]\s*(\d+(?:\.\d+)?)\s*[Xx]\s*(\d+(?:\.\d+)?)/);
  if (m) return [+m[1], +m[2], +m[3]];
  const m2 = String(desc).match(/(\d+)\s*[Xx]\s*(\d+)/);
  return m2 ? [+m2[1], +m2[2]] : [];
};

// --- BOM canonico (motor, BORRADOR) para mostrar integridad ---
const insumosBom = {};
const detalle = exp.bom.map((l) => {
  if (l.insumoId) { insumosBom[l.insumoId] = { nombre: l.desc, precio: l.precio, unidad_compra: l.unidad, seccion: l.esCompraVenta ? 'graficos' : 'metal' };
    return { insumoId: l.insumoId, unidades: l.cantidad, unidad: l.unidad, precio: l.precio, costo: +(l.precio * l.cantidad).toFixed(4), desc: l.desc, esCompraVenta: !!l.esCompraVenta }; }
  return { insumoId: null, desc: l.desc, unidad: l.unidad || 'pieza', esCompraVenta: !!l.esCompraVenta };
});
const bom = bomDesdeDespiece(detalle, insumosBom, { clave: exp._meta.clave, nombre: exp.interpretacion.producto });
const routing = proponerRouting({ piezas: exp.bom.map((l) => ({ nombre: l.desc, insumoId: l.insumoId })), insumos: insumosBom });

// --- COSTEO INDUSTRIAL (orquestador del motor) ---
const insumosERP = {};
const piezasBOM = exp.bom.map((l) => {
  if (l.insumoId) {
    insumosERP[l.insumoId] = { id: l.insumoId, nombre: l.desc, precio: l.precio, unidad: l.unidad,
      seccion: /cristal|capelo|vidrio/i.test(l.desc) ? 'cristal' : l.esCompraVenta ? 'graficos' : 'herrajes' };
    return { clave: l.clave, desc: l.desc, cantidad: l.cantidad, insumoId: l.insumoId, esCompraVenta: !!l.esCompraVenta };
  }
  if (l.fabricada) return { clave: l.clave, desc: l.desc, cantidad: l.cantidad, dims_mm: dimsDeDesc(l.desc), fabricada: true };
  return { clave: l.clave, desc: l.desc, cantidad: l.cantidad };   // comprada sin precio
});
const costo = costearProductoIndustrial({ piezasBOM, routing, insumosERP });

// --- diferencias vs costeo anterior (piso material $4,693.90) ---
const ANTERIOR = { material_piso_mxn: 4693.9, metodo: 'solo ERP resuelto (fabricadas tratadas como pendientes sin precio)' };
const dif = {
  material_anterior_mxn: ANTERIOR.material_piso_mxn,
  material_ahora_mxn: costo.material.total_mxn,
  delta_material_mxn: +(costo.material.total_mxn - ANTERIOR.material_piso_mxn).toFixed(2),
  nota: 'El anterior ignoraba el material de las piezas fabricadas; ahora la lamina se costea desde su MP real.',
};

const expediente = {
  clave: exp._meta.clave, generado: new Date().toISOString().slice(0, 10),
  interpretacion: exp.interpretacion,
  bom_canonico: { tipo_bom: bom.tipo_bom, total_renglones: exp.bom.length, resueltos: bom.lineas.filter((l) => !l.pendiente).length, pendientes: bom.pendientes.length },
  routing: { total_operaciones: routing.resumen.total, por_centro: routing.resumen.por_centro },
  costo_industrial: costo,
  diferencias_vs_anterior: dif,
};
mkdirSync(new URL('expedientes/', RAIZ), { recursive: true });
writeFileSync(new URL('expedientes/EXPEDIENTE_TELSVH120.json', RAIZ), JSON.stringify(expediente, null, 2));

// --- resumen ---
const $ = (n) => n == null ? '—' : '$' + Number(n).toLocaleString('es-MX');
console.log('===== E2E INDUSTRIAL: TELSVH120 (fuera de muestra) =====');
console.log('Producto:', exp.interpretacion.producto, '|', JSON.stringify(exp.interpretacion.dimensiones_generales_mm));
console.log('BOM:', bom.tipo_bom, '| renglones', exp.bom.length);
console.log('--- MATERIA PRIMA (fisica real) ---');
console.log('  Fabricado (lamina):', $(costo.material.fabricado_lamina_mxn), '| Comprado:', $(costo.material.comprado_mxn), '| Total MP:', $(costo.material.total_mxn));
for (const e of costo.material.evidencia) console.log(`    ${e.clave}: ${$(e.costo_mp_mxn)}  ${e.lamina?.id} ${e.lamina?.formato}  aprov ${e.aprovechamiento_pct}%  (${e.hojas} hoja)  [${e.desarrollo?.tipo}]`);
console.log('--- MANO DE OBRA / GIF ---');
console.log('  MO POLITICA_VH:', $(costo.mano_obra.politica_vh_mxn), '| GIF:', $(costo.gif_mxn), '| MO routing (tiempos):', costo.mano_obra.routing_tiempos_mxn == null ? 'PENDIENTE' : $(costo.mano_obra.routing_tiempos_mxn));
console.log('  COSTO FABRICACION (VH):', $(costo.costo_fabricacion_vh_mxn));
console.log('--- COBERTURA / PENDIENTES ---');
console.log('  Cerrado:', costo.cobertura.cerrado, '| Desarrollos 3D pendientes:', costo.cobertura.desarrollos_pendientes.map((d) => d.clave).join(', ') || 'ninguno');
console.log('  Compradas sin precio:', costo.cobertura.compradas_sin_precio.map((d) => d.clave).join(', ') || 'ninguna');
console.log('--- PREGUNTAS POR DECISION (' + costo.preguntas_por_decision.length + ') ---');
for (const q of costo.preguntas_por_decision) console.log(`   · ${q.decision} (${q.n}): ${q.afecta.join(', ')}`);
console.log('--- DIFERENCIA vs anterior ---');
console.log('  Material antes:', $(dif.material_anterior_mxn), '-> ahora:', $(dif.material_ahora_mxn), '(Δ', $(dif.delta_material_mxn) + ')');
console.log('Expediente -> expedientes/EXPEDIENTE_TELSVH120.json');
