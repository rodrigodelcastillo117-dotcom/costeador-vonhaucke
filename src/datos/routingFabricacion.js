// ============================================================================
//  ROUTING DE FABRICACIÓN (COSTEAR 100 · FASE 5 / C) — el "CÓMO se produce".
//  --------------------------------------------------------------------------
//  El BOM dice QUÉ se necesita; el ROUTING dice CÓMO se fabrica. Un BOM sin
//  operaciones puede subestimar gravemente el costo real de un mueble especial
//  (metal que lleva corte + doblez + soldadura + pintura; tablero que lleva
//  corte + canteado; etc.).
//
//  Este módulo PROPONE, de forma determinista, la lista de operaciones que el
//  despiece IMPLICA, con su centro de trabajo y en secuencia de fábrica.
//
//  REGLA DE HONESTIDAD (directiva FASE 5, textual): "No inventes tiempos de
//  producción certificados. Si no existe medición, utiliza sólo reglas
//  orientativas identificadas y exige validación para costo oficial."
//   → Aquí NINGUNA operación trae tiempo/tarifa certificados. Cada una queda
//     `estado: 'PENDIENTE_TIEMPO'`, `requiere_validacion: true`. La MO derivada
//     del routing NO es certificable hasta que Ingeniería/Producción capturen
//     tiempos y tarifas reales (ver TELCEL_MO_GIF_GAP). El valor de hoy es saber
//     QUÉ operaciones hay (y que faltan), no inventar cuánto tardan.
//  No es un motor paralelo: se apoya en los roles de revisionEstructural y en el
//  mismo despiece/estructura que el resto de COSTEAR.
// ============================================================================

import { rolDe } from './revisionEstructural.js';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function vista(piezas = [], insumos = null) {
  const lista = (Array.isArray(piezas) ? piezas : []).filter((p) => p && !p.excluida && (p.nombre || p.insumoId || p.semantic_role));
  const norm = lista.map((p) => {
    const nombreInsumo = insumos && p.insumoId && insumos[p.insumoId] ? insumos[p.insumoId].nombre : '';
    const texto = sinAcentos(`${p.nombre || ''} ${p.material_solicitado || ''} ${nombreInsumo}`);
    const rol = p.semantic_role && String(p.semantic_role).trim() ? String(p.semantic_role).trim().toLowerCase() : rolDe(p.nombre || p.insumoId || '');
    return { rol, texto };
  });
  const blob = norm.map((p) => p.texto).join(' · ');
  const metalMiembros = norm.filter((p) => /\blamina\b|tubular|\bptr\b|perfil|solera|angulo|placa|acero/.test(p.texto)).length;
  const estructurales = norm.filter((p) => ['cubierta', 'lateral', 'entrepano', 'puerta', 'faldon', 'fondo', 'respaldo', 'pata', 'gaveta', 'conector'].includes(p.rol)).length;
  // "Fabricables" = piezas estructurales (por rol) + miembros metálicos (lámina/tubular, que son
  // materia prima que SE CONVIERTE en estructura). El armado/embalaje/inspección dependen de esto,
  // no sólo del rol: un módulo de lámina+tubular necesita armado aunque ninguna pieza tenga rol estructural.
  const fabricables = estructurales + metalMiembros;
  return {
    piezas: norm,
    estructurales,
    fabricables,
    metalMiembros,
    tieneTexto: (re) => re.test(blob),
    tieneRol: (r) => norm.some((p) => p.rol === r),
  };
}

// Catálogo de operaciones en SECUENCIA de fábrica. Cada una: su centro, categoría,
// orden, y el disparo (qué del despiece la implica). `orden` fija la secuencia.
const OPERACIONES = [
  // --- corte / preparación de materia prima ---
  { op: 'corte_lamina', nombre: 'Corte de lámina', centro: 'metalmecánica', categoria: 'fabricacion', orden: 10,
    disparo: (v) => v.tieneTexto(/\blamina\b|placa|solera/) && { evidencia: 'lámina/placa en el BOM' } },
  { op: 'corte_tubo', nombre: 'Corte de tubo/perfil', centro: 'metalmecánica', categoria: 'fabricacion', orden: 11,
    disparo: (v) => v.tieneTexto(/tubular|\bptr\b|perfil|angulo/) && { evidencia: 'tubular/PTR/perfil en el BOM' } },
  { op: 'corte_tablero', nombre: 'Corte/seccionado de tablero', centro: 'carpintería', categoria: 'fabricacion', orden: 12,
    disparo: (v) => v.tieneTexto(/melamina|\bmdf\b|\bmdp\b|aglomerad|triplay|contrachapad|tablero/) && { evidencia: 'tablero en el BOM' } },
  { op: 'corte_vidrio', nombre: 'Corte de vidrio/acrílico (posible tercero)', centro: 'vidrio', categoria: 'fabricacion', orden: 13,
    disparo: (v) => v.tieneTexto(/cristal|vidrio|templado|acrilico|policarbonato|espejo/) && { evidencia: 'vidrio/acrílico en el BOM', tercero_probable: true } },
  // --- conformado de metal ---
  { op: 'punzonado', nombre: 'Punzonado/barrenado', centro: 'metalmecánica', categoria: 'fabricacion', orden: 20,
    disparo: (v) => v.tieneTexto(/\blamina\b|placa/) && { evidencia: 'lámina (barrenos/troqueles habituales)' } },
  { op: 'doblez', nombre: 'Doblez', centro: 'metalmecánica', categoria: 'fabricacion', orden: 21,
    disparo: (v) => v.tieneTexto(/\blamina\b|placa|solera/) && { evidencia: 'lámina/solera (dobleces habituales)' } },
  // --- unión ---
  { op: 'soldadura', nombre: 'Soldadura', centro: 'metalmecánica', categoria: 'ensamble', orden: 30,
    disparo: (v) => (v.metalMiembros >= 2 || v.tieneTexto(/tubular|\bptr\b|perfil/)) && !v.tieneTexto(/atornill|remach/) && { evidencia: `${v.metalMiembros} miembro(s) metálico(s): requieren unión` } },
  { op: 'esmerilado', nombre: 'Esmerilado/acabado de soldadura', centro: 'metalmecánica', categoria: 'acabado', orden: 31,
    disparo: (v) => (v.metalMiembros >= 2 || v.tieneTexto(/tubular|\bptr\b|perfil/)) && { evidencia: 'unión soldada a limpiar' } },
  // --- carpintería de acabado ---
  { op: 'enchapado', nombre: 'Enchapado (chapa de madera)', centro: 'carpintería', categoria: 'acabado', orden: 40,
    disparo: (v) => v.tieneTexto(/chapa de madera|chapa\b|enchap/) && { evidencia: 'chapa de madera en el BOM' } },
  { op: 'canteado', nombre: 'Pegado de canto', centro: 'carpintería', categoria: 'acabado', orden: 41,
    disparo: (v) => v.tieneTexto(/canto|tapacanto|\babs\b|cantead/) && { evidencia: 'canto/tapacanto en el BOM' } },
  // --- pintura / recubrimiento ---
  { op: 'preparacion_superficie', nombre: 'Preparación de superficie', centro: 'pintura', categoria: 'acabado', orden: 50,
    disparo: (v) => v.tieneTexto(/pintura|recubrimiento|electrostatic|polvo|laca|barniz/) && { evidencia: 'se va a pintar/recubrir' } },
  { op: 'pintura_electrostatica', nombre: 'Pintura electrostática (polvo)', centro: 'pintura', categoria: 'acabado', orden: 51,
    disparo: (v) => v.tieneTexto(/pintura en polvo|electrostatic|\bpph\b/) && { evidencia: 'pintura en polvo en el BOM' } },
  { op: 'pintura_liquida', nombre: 'Pintura líquida / laca / barniz', centro: 'pintura', categoria: 'acabado', orden: 52,
    disparo: (v) => v.tieneTexto(/laca|barniz|pintura liquida|esmalte|sellador/) && { evidencia: 'laca/barniz/pintura líquida en el BOM' } },
  { op: 'secado_curado', nombre: 'Secado / curado', centro: 'pintura', categoria: 'acabado', orden: 53,
    disparo: (v) => v.tieneTexto(/pintura|recubrimiento|electrostatic|polvo|laca|barniz|esmalte/) && { evidencia: 'proceso de pintura presente' } },
  // --- ensamble / instalación ---
  { op: 'armado', nombre: 'Armado / ensamble', centro: 'ensamble', categoria: 'ensamble', orden: 60,
    disparo: (v) => v.fabricables >= 2 && { evidencia: `${v.fabricables} pieza(s) fabricable(s) a ensamblar` } },
  { op: 'instalacion_herrajes', nombre: 'Instalación y ajuste de herrajes', centro: 'ensamble', categoria: 'ensamble', orden: 61,
    disparo: (v) => v.tieneTexto(/bisagra|corredera|jaladera|cerradura|riel|nivelador|minifix/) && { evidencia: 'herrajes en el BOM (montaje y ajuste en fábrica)' } },
  { op: 'colocacion_vidrio', nombre: 'Colocación de vidrio/acrílico', centro: 'ensamble', categoria: 'ensamble', orden: 62,
    disparo: (v) => v.tieneTexto(/cristal|vidrio|templado|acrilico|policarbonato|espejo/) && { evidencia: 'vidrio/acrílico a montar' } },
  // --- eléctrico ---
  { op: 'cableado', nombre: 'Cableado e instalación eléctrica', centro: 'eléctrico', categoria: 'fabricacion', orden: 70,
    disparo: (v) => v.tieneTexto(/\bled\b|ilumina|driver|cablead|electric|luminari|tira de luz/) && { evidencia: 'iluminación/eléctrico en el BOM' } },
  { op: 'pruebas_electricas', nombre: 'Pruebas eléctricas', centro: 'eléctrico', categoria: 'acabado', orden: 71,
    disparo: (v) => v.tieneTexto(/\bled\b|ilumina|driver|cablead|electric|luminari|tira de luz/) && { evidencia: 'circuito eléctrico a probar' } },
  // --- cierre ---
  { op: 'inspeccion', nombre: 'Inspección de calidad', centro: 'calidad', categoria: 'acabado', orden: 90,
    disparo: (v) => v.fabricables >= 1 && { evidencia: 'producto fabricado a inspeccionar', opcional: true } },
  { op: 'embalaje', nombre: 'Embalaje', centro: 'embalaje', categoria: 'logistica', orden: 95,
    disparo: (v) => v.fabricables >= 2 && { evidencia: 'módulo transportable', opcional: true } },
];

/**
 * Propone el routing de fabricación implícito en el despiece. NO inventa tiempos
 * certificados: cada operación queda PENDIENTE_TIEMPO y requiere validación.
 * @param {{piezas?:Array, componentes?:Array, insumos?:object}} entrada
 * @returns {{operaciones:Array, resumen:{total:number, por_centro:object, mano_obra_certificable:boolean, nota:string}}}
 */
export function proponerRouting(entrada = {}) {
  const piezasIn = Array.isArray(entrada.piezas) ? entrada.piezas
    : Array.isArray(entrada.componentes) ? entrada.componentes : [];
  const v = vista(piezasIn, entrada.insumos || null);

  const operaciones = [];
  for (const def of OPERACIONES) {
    let d = null;
    try { d = def.disparo(v); } catch (_e) { d = null; }
    if (!d) continue;
    operaciones.push({
      op: def.op,
      nombre: def.nombre,
      centro: def.centro,
      categoria: def.categoria,
      orden: def.orden,
      disparada_por: d.evidencia || '',
      opcional: !!d.opcional,
      tercero_probable: !!d.tercero_probable,
      // Honestidad: sin tiempo/tarifa certificados.
      tiempo: null,
      tarifa: null,
      certeza: 'INFERIDO',
      estado: 'PENDIENTE_TIEMPO',
      requiere_validacion: true,
    });
  }
  operaciones.sort((a, b) => a.orden - b.orden || a.op.localeCompare(b.op));

  const por_centro = {};
  for (const o of operaciones) por_centro[o.centro] = (por_centro[o.centro] || 0) + 1;

  return {
    operaciones,
    resumen: {
      total: operaciones.length,
      por_centro,
      // La MO del routing NO es certificable mientras haya operaciones sin tiempo/tarifa reales.
      mano_obra_certificable: operaciones.length > 0 ? false : null,
      nota: operaciones.length
        ? 'Operaciones propuestas desde el despiece. Faltan tiempos y tarifas reales (Ingeniería/Producción) para costear la MO oficialmente.'
        : 'Sin operaciones inferidas (BOM insuficiente o sin piezas fabricadas).',
    },
  };
}

/** Lista el catálogo de operaciones (para UI/documentación). */
export function catalogoOperaciones() {
  return OPERACIONES.map((o) => ({ op: o.op, nombre: o.nombre, centro: o.centro, categoria: o.categoria, orden: o.orden }));
}
