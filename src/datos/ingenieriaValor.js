// ============================================================================
//  VONI · INGENIERÍA DE VALOR (COSTEAR 100 · FASE 21) — el "segundo cerebro".
//  --------------------------------------------------------------------------
//  Cerebro 1 calcula lo que cuesta fabricar el diseño original. Cerebro 2 (este)
//  ANALIZA el producto y PROPONE mejoras: menos desperdicio, mejor fabricación,
//  menos piezas/operaciones, sustitución de material. NO cambia el diseño ni el
//  costo original: las versiones coexisten.
//
//  REGLA DE HONESTIDAD (directiva FASE 21, textual):
//   · "No confundas una propuesta más barata con una propuesta mejor."
//   · "Calcula el ahorro únicamente cuando existan consumos, tiempos y costos
//     válidos. Si el impacto es desconocido, presenta una hipótesis de mejora,
//     no un ahorro inventado."
//   → Cada oportunidad trae `ahorro`: null, {fuente:'CALCULADO', monto, base} (sólo
//     con datos reales de antes/después) o {fuente:'HIPOTESIS', base} (sin monto).
//     Hoy, sin datos de corte/tiempos/precios alternativos, casi todo es HIPÓTESIS.
//   · Cambios que tocan resistencia, cargas, estabilidad, seguridad o un material
//     oficial → `requiere_validacion_ingenieria: true`. VONI propone; Ingeniería valida.
//  Se compone sobre subsistemas + routing (no es motor paralelo).
// ============================================================================

import { clasificarPorSubsistema } from './subsistemas.js';
import { proponerRouting } from './routingFabricacion.js';
import { rolDe } from './revisionEstructural.js';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CONF_ORDEN = { ALTA: 0, MEDIA: 1, BAJA: 2 };

function vista(piezas, insumos) {
  return (Array.isArray(piezas) ? piezas : [])
    .filter((p) => p && !p.excluida && (p.nombre || p.insumoId || p.semantic_role))
    .map((p) => {
      const nombreInsumo = insumos && p.insumoId && insumos[p.insumoId] ? insumos[p.insumoId].nombre : '';
      const texto = sinAcentos(`${p.nombre || ''} ${p.material_solicitado || ''} ${nombreInsumo}`);
      const rol = p.semantic_role && String(p.semantic_role).trim() ? String(p.semantic_role).trim().toLowerCase() : rolDe(p.nombre || p.insumoId || '');
      const costo = Number(p.costo ?? p.costoLinea);
      return { rol, texto, nombre: p.nombre || p.insumoId || '', insumoId: p.insumoId || '', largo: Number(p.largoMM) || 0, ancho: Number(p.anchoMM) || 0, costo: Number.isFinite(costo) ? costo : null };
    });
}

/**
 * Analiza el producto y propone mejoras de valor. NO cambia el diseño ni el costo.
 * @param {{piezas?:Array, componentes?:Array, insumos?:object, cantidad?:number}} entrada
 * @returns {{oportunidades:Array, resumen:object}}
 */
export function analizarValor(entrada = {}) {
  const piezasIn = Array.isArray(entrada.piezas) ? entrada.piezas
    : Array.isArray(entrada.componentes) ? entrada.componentes : [];
  const insumos = entrada.insumos || null;
  const v = vista(piezasIn, insumos);
  const blob = v.map((p) => p.texto).join(' · ');
  const hay = (re) => re.test(blob);
  const routing = proponerRouting({ piezas: piezasIn, insumos });
  const metalMiembros = v.filter((p) => /\blamina\b|tubular|\bptr\b|perfil|solera|angulo|placa|acero/.test(p.texto)).length;
  const tableros = v.filter((p) => /melamina|\bmdf\b|aglomerad|triplay|tablero|chapa/.test(p.texto)).length;

  const oportunidades = [];
  const add = (o) => oportunidades.push(o);

  // V1 · Reducir uniones soldadas (si hay soldadura + varios miembros metálicos).
  if (routing.operaciones.some((o) => o.op === 'soldadura') && metalMiembros >= 4) {
    add({
      regla: 'reducir_soldaduras', categoria: 'fabricacion',
      titulo: 'Evaluar reducir uniones soldadas',
      porque: `Hay ${metalMiembros} miembros metálicos con soldadura; muchas uniones = más tiempo de soldadura, esmerilado y preparación.`,
      beneficio: 'Menos operaciones de soldadura/esmerilado y menor tiempo de ensamble.',
      riesgo: 'Cambiar uniones soldadas por atornilladas puede afectar rigidez: requiere revisar cargas.',
      ahorro: { fuente: 'HIPOTESIS', base: 'depende de los tiempos reales de soldadura por unión (no medidos aún)' },
      requiere_validacion_ingenieria: true, confianza: 'MEDIA',
    });
  }
  // V2 · Nesting / agrupar cortes de tablero (si hay varios tableros).
  if (routing.operaciones.some((o) => o.op === 'corte_tablero') && tableros >= 4) {
    add({
      regla: 'nesting_tableros', categoria: 'material',
      titulo: 'Optimizar el nesting / agrupar cortes de tablero',
      porque: `Hay ${tableros} piezas de tablero; un mejor acomodo de corte puede bajar la merma y el número de hojas.`,
      beneficio: 'Menos merma de tablero y menos preparaciones de corte.',
      riesgo: 'Ninguno de diseño; es plan de corte.',
      ahorro: { fuente: 'HIPOTESIS', base: 'depende del layout de corte real contra la hoja comercial (no calculado aquí)' },
      requiere_validacion_ingenieria: false, confianza: 'MEDIA',
    });
  }
  // V3 · Estandarizar piezas repetidas idénticas (señal factual: se repiten).
  const grupos = new Map();
  for (const p of v) {
    const k = `${sinAcentos(p.nombre)}|${p.largo}|${p.ancho}|${p.insumoId}`;
    grupos.set(k, (grupos.get(k) || 0) + 1);
  }
  const repetida = [...grupos.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])[0];
  if (repetida) {
    add({
      regla: 'estandarizar_repetidas', categoria: 'diseno',
      titulo: 'Estandarizar piezas repetidas',
      porque: `Una pieza se repite ${repetida[1]}× con las mismas medidas y material.`,
      beneficio: 'Fabricación por lote: amortiza preparaciones y reduce variabilidad.',
      riesgo: 'Ninguno si de verdad son la misma pieza (confirmar que no son distintas mal nombradas).',
      ahorro: { fuente: 'HIPOTESIS', base: 'depende de los tiempos de preparación por lote (no medidos)' },
      requiere_validacion_ingenieria: false, confianza: 'ALTA',
    });
  }
  // V4 · Sustitución de material por durabilidad (MDF pintado en zona de uso) — opción de CALIDAD, puede costar más.
  if (hay(/\bmdf\b/) && hay(/\blaca\b|lacad|barniz|pintura de madera|esmalte al agua/) && !hay(/\bhpl\b|melamina/)) {
    add({
      regla: 'material_durabilidad', categoria: 'material',
      titulo: 'Evaluar HPL/laminado donde el MDF pintado sufre desgaste',
      porque: 'Hay MDF con acabado de pintura/laca; en superficies de uso intenso el pintado se desgasta más que un laminado.',
      beneficio: 'Mayor durabilidad y menor mantenimiento en zonas de contacto.',
      riesgo: 'Puede COSTAR MÁS y cambia la estética; es mejora de calidad, no de costo.',
      ahorro: null, // mejora de calidad: no se presenta como ahorro
      requiere_validacion_ingenieria: false, requiere_confirmacion: true, confianza: 'BAJA',
    });
  }
  // V5 · Fabricación por lote (si se piden varias unidades/módulos).
  const cantidad = Math.max(1, Number(entrada.cantidad) || 1);
  if (cantidad >= 2) {
    add({
      regla: 'fabricacion_lote', categoria: 'fabricacion',
      titulo: 'Fabricar por lote',
      porque: `Se piden ${cantidad} unidades; una sola corrida amortiza preparaciones de máquina y setups.`,
      beneficio: 'Menor costo unitario de preparación al producir el lote junto.',
      riesgo: 'Requiere capacidad y programación; no cambia el producto.',
      ahorro: { fuente: 'HIPOTESIS', base: 'depende de los tiempos de setup por centro (no medidos)' },
      requiere_validacion_ingenieria: false, confianza: 'MEDIA',
    });
  }

  // V6 · Consolidar materiales/SKUs distintos (simplifica compras, inventario y preparaciones).
  const distintos = new Set(v.map((p) => p.insumoId).filter(Boolean));
  if (distintos.size >= 6) {
    add({
      regla: 'reducir_materiales_distintos', categoria: 'compras',
      titulo: 'Consolidar materiales / SKUs',
      porque: `El BOM usa ${distintos.size} materiales distintos; consolidar reduce compras, inventario y cambios de material en fábrica.`,
      beneficio: 'Menos SKUs que comprar y menos preparaciones por cambio de material.',
      riesgo: 'No cambiar un material donde su función lo exige; sólo equivalencias aprobadas.',
      ahorro: { fuente: 'HIPOTESIS', base: 'depende de precios por volumen y de equivalencias aprobadas (no calculado)' },
      requiere_validacion_ingenieria: false, confianza: 'MEDIA',
    });
  }
  // V7 · Modularizar piezas muy grandes para transporte e instalación.
  const grande = v.find((p) => Math.max(p.largo, p.ancho) >= 2400);
  if (grande) {
    const dim = Math.max(grande.largo, grande.ancho);
    add({
      regla: 'modularizar_transporte', categoria: 'diseno',
      titulo: 'Modularizar para transporte e instalación',
      porque: `Hay una pieza de ${dim} mm; dividir en módulos facilita transporte, maniobras e instalación en sitio.`,
      beneficio: 'Transporte más seguro/barato y montaje en sitio más simple.',
      riesgo: 'Agrega uniones/ensamble; las juntas pueden requerir refuerzo.',
      ahorro: { fuente: 'HIPOTESIS', base: 'depende del flete/maniobra reales vs. costo de las uniones (no calculado)' },
      requiere_validacion_ingenieria: true, confianza: 'MEDIA',
    });
  }

  oportunidades.sort((a, b) => (CONF_ORDEN[a.confianza] - CONF_ORDEN[b.confianza]) || a.regla.localeCompare(b.regla));

  // Versiones A/B/C (FASE 21 §6): A = original (referencia); B = optimización económica; C = calidad/fabricación.
  const VARIANTE = {
    reducir_soldaduras: 'B', nesting_tableros: 'B', estandarizar_repetidas: 'B', fabricacion_lote: 'B', reducir_materiales_distintos: 'B',
    material_durabilidad: 'C', modularizar_transporte: 'C',
  };
  for (const o of oportunidades) o.variante = VARIANTE[o.regla] || 'B';
  const variantes = {
    A: { clave: 'A', nombre: 'Original', descripcion: 'El producto tal como fue solicitado (referencia base). No se cambia.' },
    B: { clave: 'B', nombre: 'Optimización económica', oportunidades: oportunidades.filter((o) => o.variante === 'B') },
    C: { clave: 'C', nombre: 'Optimización de calidad / fabricación', oportunidades: oportunidades.filter((o) => o.variante === 'C') },
  };

  // Palanca de costo: dónde se concentra el material (si hay costos cargados). Es CONTEXTO
  // calculado (una participación real), NO un ahorro.
  let palanca = null;
  if (v.some((p) => p.costo != null)) {
    const porSub = {};
    const ss = clasificarPorSubsistema({ piezas: piezasIn, insumos });
    for (const p of piezasIn) {
      const c = Number(p.costo ?? p.costoLinea); if (!Number.isFinite(c)) continue;
      const sub = Object.entries(ss.grupos).find(([, g]) => g.piezas.includes(p.nombre || p.insumoId || '(pieza)'))?.[0] || 'otro';
      porSub[sub] = (porSub[sub] || 0) + c;
    }
    const total = Object.values(porSub).reduce((a, b) => a + b, 0);
    const top = Object.entries(porSub).sort((a, b) => b[1] - a[1])[0];
    if (top && total > 0) palanca = { subsistema: top[0], monto: top[1], pct: Math.round((100 * top[1]) / total) };
  }

  return {
    oportunidades,
    variantes,
    resumen: {
      total: oportunidades.length,
      // Honestidad: ahorros con monto CALCULADO hoy = 0 (faltan datos de corte/tiempos/precios alternativos).
      ahorros_calculados: oportunidades.filter((o) => o.ahorro && o.ahorro.fuente === 'CALCULADO' && Number.isFinite(o.ahorro.monto)).length,
      hipotesis: oportunidades.filter((o) => o.ahorro && o.ahorro.fuente === 'HIPOTESIS').length,
      requieren_ingenieria: oportunidades.filter((o) => o.requiere_validacion_ingenieria).length,
      palanca_de_costo: palanca,
      nota: 'VONI propone; Ingeniería valida. Los ahorros son hipótesis hasta tener datos reales de corte, tiempos y precios alternativos; ninguna propuesta cambia el diseño ni el costo original.',
    },
  };
}
