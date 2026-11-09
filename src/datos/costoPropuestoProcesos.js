// ============================================================================
//  COSTO PROPUESTO POR PROCESOS (PRIORIDAD 3) — honesto, fail-closed.
//  --------------------------------------------------------------------------
//  Objetivo: dar un costo de un producto NUEVO sin depender sólo del factor
//  histórico de otro SKU, PERO sin inventar precios ni tarifas.
//
//  Regla dura (directiva Dirección): "No inventes tarifas ni tiempos." Aquí:
//   · MATERIAL de lámina (piezas fabricadas) → se PROPONE con base en un $/m²
//     DERIVADO DE DATOS ERP REALES (piezas CORTE LAMINA del catálogo). Queda
//     `autorizado:false`, es una COTA/propuesta, y exige confirmar calibre y el
//     desarrollo plano real por pieza (Ingeniería). El área usada es la cara
//     mayor = COTA INFERIOR (ignora dobleces/retornos); nunca sobreestima a
//     escondidas.
//   · MANO DE OBRA / GIF por operación → NO se inventa un peso. Si no se pasan
//     tarifas autorizadas (o de referencia explícita que tú decidas), cada
//     operación queda PENDIENTE y se emite la PREGUNTA concreta para Ingeniería.
//     El número de MO sólo aparece si ALGUIEN inyecta la tarifa (autorizado o
//     referencia marcada). El mecanismo existe; el número no se fabrica.
//
//  Nada aquí es certificable. Todo trae fuente, autorizado:false y, cuando falta,
//  la pregunta exacta que lo cierra. No escribe en la nube, no toca precios ERP.
// ============================================================================

// Referencia de material DERIVADA DE ERP (no una tarifa de MO):
//   CORTE LAMINA NEGRA CAL 22 708x338mm = $22.65 → 0.2393 m² → $94.6/m²
//   CORTE LAMINA NEGRA CAL 20 424x270mm = $11.08 → 0.1145 m² → $96.8/m²
// ⇒ ~$95/m² (incluye corte). Calibre exacto por pieza: PENDIENTE de Ingeniería.
export const REF_LAMINA_MXN_M2 = {
  valor: 95,
  fuente: 'derivado de piezas "CORTE LAMINA NEGRA" cal 20/22 del catálogo ERP (incluye corte)',
  autorizado: false,
  pregunta: 'Confirmar calibre y tipo de lámina por pieza y el desarrollo plano real (m²) de cada pieza fabricada.',
};
// Merma de corte: rango industrial estándar (10–25%); se usa 15% conservador, marcado.
export const REF_MERMA_PCT = { valor: 0.15, fuente: 'rango industrial corte de lámina 10–25% (referencia, no medición)', autorizado: false };

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Cota inferior de área (m²) de una pieza fabricada: cara mayor de su bounding box.
 *  Es DELIBERADAMENTE una cota inferior (ignora dobleces/retornos/caras extra). */
export function areaCaraMayorM2(dims_mm = []) {
  const d = (Array.isArray(dims_mm) ? dims_mm : []).map(num).filter((x) => x > 0).sort((a, b) => b - a);
  if (d.length < 2) return null;
  return +((d[0] * d[1]) / 1e6).toFixed(4); // mm² → m²
}

/**
 * @param {object} p
 * @param {Array}  p.fabricadas  piezas fabricadas: {clave, cantidad, dims_mm:[l,w,h]}
 * @param {Array}  p.operaciones routing (proponerRouting().operaciones)
 * @param {object} [p.tarifas]   mapa opcional centro→{mxn, autorizado, fuente}. Si falta una, PENDIENTE.
 * @param {number} [p.materialResueltoMxn] material ya resuelto por ERP (piezas con precio)
 */
export function costoPropuesto({ fabricadas = [], operaciones = [], tarifas = {}, materialResueltoMxn = 0,
  refLamina = REF_LAMINA_MXN_M2, refMerma = REF_MERMA_PCT } = {}) {
  const preguntas = [];
  const supuestos = [];

  // --- MATERIAL propuesto de lámina (cota inferior, base ERP) ---
  let laminaMxn = 0;
  const detalleLamina = [];
  for (const f of fabricadas) {
    const area = areaCaraMayorM2(f.dims_mm);
    const qty = num(f.cantidad) || 1;
    if (area == null) {
      detalleLamina.push({ clave: f.clave, area_m2: null, costo: null, estado: 'SIN_DIMS' });
      preguntas.push(`Dimensiones/espesor de la pieza fabricada ${f.clave} para estimar material.`);
      continue;
    }
    const costo = +(area * qty * refLamina.valor * (1 + refMerma.valor)).toFixed(2);
    laminaMxn += costo;
    detalleLamina.push({ clave: f.clave, area_m2_cota_inferior: area, cantidad: qty, costo_cota: costo, estado: 'PROPUESTA_COTA_INFERIOR' });
  }
  laminaMxn = +laminaMxn.toFixed(2);
  if (fabricadas.length) {
    supuestos.push(`Lámina a ${refLamina.valor} $/m² (${refLamina.fuente}); merma ${Math.round(refMerma.valor * 100)}% (${refMerma.fuente}). Área = cara mayor (COTA INFERIOR, ignora dobleces).`);
    preguntas.push(refLamina.pregunta);
  }

  // --- MANO DE OBRA por operación: número SÓLO si hay tarifa; si no, PREGUNTA ---
  let moMxn = 0; let moCompleta = true;
  const detalleMO = [];
  for (const op of operaciones) {
    const t = tarifas[op.centro];
    if (!t || !Number.isFinite(Number(t.mxn))) {
      moCompleta = false;
      detalleMO.push({ op: op.op, centro: op.centro, costo: null, estado: 'PENDIENTE_TARIFA' });
      preguntas.push(`Tarifa y tiempo autorizados de "${op.nombre || op.op}" (centro ${op.centro}) para costear su MO.`);
      continue;
    }
    const costo = +Number(t.mxn).toFixed(2);
    moMxn += costo;
    detalleMO.push({ op: op.op, centro: op.centro, costo, autorizado: !!t.autorizado, fuente: t.fuente || null, estado: t.autorizado ? 'AUTORIZADA' : 'REFERENCIA' });
  }
  moMxn = +moMxn.toFixed(2);

  const materialFloor = +(num(materialResueltoMxn) + laminaMxn).toFixed(2);
  // Preguntas únicas, ordenadas (las de impacto económico primero = material y MO faltante).
  const preguntasUnicas = [...new Set(preguntas)];

  return {
    certificable: false,              // NUNCA certificable desde propuestas
    material: {
      resuelto_erp_mxn: +num(materialResueltoMxn).toFixed(2),
      lamina_propuesta_mxn_cota: laminaMxn,
      total_floor_mxn: materialFloor,
      detalle_lamina: detalleLamina,
    },
    mano_obra: {
      completa: operaciones.length ? moCompleta : null,
      mxn: moCompleta && operaciones.length ? moMxn : null,
      detalle: detalleMO,
      nota: operaciones.length && !moCompleta
        ? 'MO NO costeada: faltan tarifas/tiempos autorizados. Operaciones identificadas, costo pendiente de Ingeniería.'
        : null,
    },
    total_propuesto_mxn: moCompleta && operaciones.length ? +(materialFloor + moMxn).toFixed(2) : null,
    estado: 'PROPUESTA_NO_CERTIFICABLE',
    supuestos,
    preguntas_ingenieria: preguntasUnicas,
    advertencia: 'Costo PROPUESTO con referencias explícitas y cotas. No es costo oficial. Material de lámina es cota inferior. MO requiere tarifas/tiempos reales. Validación de Ingeniería y Dirección obligatoria.',
  };
}
