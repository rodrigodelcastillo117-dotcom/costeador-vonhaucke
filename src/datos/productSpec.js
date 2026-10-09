// ============================================================================
//  ProductSpec (PRODUCT INTELLIGENCE, v1 · contrato)
//
//  Capa PURA. Representa lo que un plano/brief de MUEBLE dice, con EVIDENCIA y
//  CONFIANZA por dato. La IA interpreta; este contrato NO inventa nada crítico:
//   · material ambiguo/ausente → PENDING;
//   · espesor/calibre no visible → PENDING (jamás un default invisible);
//   · una dimensión que difiere entre vistas → CONFLICT (no se elige en silencio).
//
//  Reusa el modelo de evidencia técnica (evidencia.js): PROCEDENCIA_TECNICA y
//  resolverCampo para contradicciones entre vistas. No lee archivos ni red: el
//  ProductDrawingReader (edge/visión) alimenta estos datos ya extraídos.
// ============================================================================
import { procedenciaTecnica, resolverCampo } from './evidencia.js';

// Estado de un dato/pieza dentro del ProductSpec.
export const ESTADO_DATO = Object.freeze({
  OK: 'OK',             // dato con evidencia suficiente
  PENDING: 'PENDING',   // falta dato crítico (material/espesor/dimensión) → no inventar
  CONFLICT: 'CONFLICT', // dos vistas/fuentes dicen cosas distintas del mismo dato
});

const txt = (v) => String(v ?? '').trim();
// null/undefined/'' → null (NO 0; Number(null)===0 metería un dato falso).
const num = (v) => { if (v === null || v === undefined) return null; if (typeof v === 'string' && v.trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/**
 * Normaliza UNA parte del despiece. Marca su estado SIN inventar:
 *  · sin material → PENDING; material "ambiguo" (varias opciones) → PENDING.
 *  · sin espesor/calibre (cuando el tipo lo requiere) → PENDING.
 *  · cantidad inválida → PENDING.
 * @param {object} raw
 */
export function parteSpec(raw = {}) {
  const dims = raw.dimensiones || { w: raw.w, d: raw.d, h: raw.h };
  const out = {
    part_id: txt(raw.part_id || raw.id) || null,
    nombre: txt(raw.nombre) || null,
    cantidad: num(raw.cantidad),
    dimensiones: { w: num(dims?.w), d: num(dims?.d), h: num(dims?.h) },
    material_solicitado: txt(raw.material_solicitado || raw.material) || null,
    material_opciones: Array.isArray(raw.material_opciones) ? raw.material_opciones.map(txt).filter(Boolean) : [],
    espesor_mm: num(raw.espesor_mm ?? raw.espesor),
    calibre: txt(raw.calibre) || null,
    perfil: txt(raw.perfil) || null,
    acabado: txt(raw.acabado) || null,
    canto: txt(raw.canto) || null,
    herrajes: Array.isArray(raw.herrajes) ? raw.herrajes : [],
    patas: raw.patas != null ? raw.patas : null,
    niveladores: raw.niveladores != null ? raw.niveladores : null,
    divisores: raw.divisores != null ? raw.divisores : null,
    electricos: Array.isArray(raw.electricos) ? raw.electricos : [],
    mamparas: raw.mamparas != null ? raw.mamparas : null,
    perforaciones: Array.isArray(raw.perforaciones) ? raw.perforaciones : [],
    notas_fabricacion: Array.isArray(raw.notas_fabricacion) ? raw.notas_fabricacion : [],
    procedencia: procedenciaTecnica(raw),
    confidence: num(raw.confidence ?? raw.confianza),
    // `requiere_espesor`: por defecto true para piezas de tablero/lámina; el reader
    // puede ponerlo en false para piezas que no lo necesitan (p.ej. un herraje).
    requiere_espesor: raw.requiere_espesor !== false,
  };

  const issues = [];
  if (!out.part_id && !out.nombre) issues.push('FALTA_IDENTIDAD');
  if (out.cantidad == null || out.cantidad <= 0) issues.push('CANTIDAD_INVALIDA');
  // Material ambiguo (varias opciones sin una solicitada) o ausente → PENDING.
  if (!out.material_solicitado) issues.push(out.material_opciones.length > 1 ? 'MATERIAL_AMBIGUO' : 'FALTA_MATERIAL');
  // Espesor/calibre no visible cuando el tipo lo requiere → PENDING (no default).
  // Un espesor 0 o negativo es imposible → también PENDING (red-team).
  if (out.requiere_espesor && !(out.espesor_mm > 0) && !out.calibre) issues.push('FALTA_ESPESOR');

  const estado = issues.length ? ESTADO_DATO.PENDING : ESTADO_DATO.OK;
  return { ...out, issues, estado };
}

/**
 * Detecta CONFLICTO de una dimensión (w/d/h) entre varias vistas. Reusa
 * resolverCampo: si dos vistas difieren > tolerancia y ninguna es confirmada,
 * es CONFLICT. @param {Array<{valor,fuente}>} lecturas
 */
export function conflictoDimension(campo, lecturas = []) {
  const r = resolverCampo(campo, lecturas, { tolRel: 0.01, unidad: 'mm' });
  return { campo, estado: r.contradiccion ? ESTADO_DATO.CONFLICT : ESTADO_DATO.OK, resuelto: r.resuelto, contradiccion: r.contradiccion };
}

/**
 * Construye un ProductSpec normalizado. `vistas_dimensiones` opcional: mapa
 * {w:[{valor,fuente}], d:[...], h:[...]} para detectar conflictos entre vistas.
 */
export function construirProductSpec(raw = {}) {
  const partes = (Array.isArray(raw.partes) ? raw.partes : []).map(parteSpec);
  const geometria = {
    w: num(raw.geometria?.w ?? raw.w),
    d: num(raw.geometria?.d ?? raw.d),
    h: num(raw.geometria?.h ?? raw.h),
  };
  const conflictos = [];
  const vd = raw.vistas_dimensiones || {};
  for (const campo of ['w', 'd', 'h']) {
    if (Array.isArray(vd[campo]) && vd[campo].length > 1) {
      const c = conflictoDimension(campo, vd[campo]);
      if (c.estado === ESTADO_DATO.CONFLICT) conflictos.push(c);
    }
  }
  return {
    nombre: txt(raw.nombre) || null,
    geometria,
    vistas: Array.isArray(raw.vistas) ? raw.vistas.map(txt) : [],
    partes,
    relaciones: Array.isArray(raw.relaciones) ? raw.relaciones : [],
    notas_fabricacion: Array.isArray(raw.notas_fabricacion) ? raw.notas_fabricacion : [],
    conflictos,
  };
}

/**
 * Valida un ProductSpec. Un ProductSpec con partes PENDING o CONFLICT NO puede
 * generar un BOM/costo OFICIAL: es PRELIMINAR hasta resolver/confirmar.
 * @returns {{ok, estado, partesPendientes, conflictos, issues}}
 */
export function validarProductSpec(spec) {
  const s = (spec && Array.isArray(spec.partes)) ? spec : construirProductSpec(spec || {});
  const partesPendientes = s.partes.filter((p) => p.estado === ESTADO_DATO.PENDING);
  const conflictos = s.conflictos || [];
  const issues = [];
  if (s.partes.length === 0) issues.push('SIN_PARTES');
  partesPendientes.forEach((p, i) => p.issues.forEach((c) => issues.push(`[parte ${p.part_id || p.nombre || i}] ${c}`)));
  conflictos.forEach((c) => issues.push(`[conflicto ${c.campo}] vistas en desacuerdo`));

  const hayProblema = partesPendientes.length > 0 || conflictos.length > 0 || s.partes.length === 0;
  return {
    ok: !hayProblema,
    // PRELIMINAR si hay pendientes/conflictos; OFICIAL-posible sólo si todo OK.
    estado: hayProblema ? 'PRELIMINAR' : 'COMPLETO',
    partesPendientes,
    conflictos,
    issues,
  };
}
