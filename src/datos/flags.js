// ============================================================================
//  FEATURE FLAGS — activar/desactivar módulos sin borrar código.
//  (COTIZADOR VON HAUCKE 9.9 — MODO CIERRE TOTAL)
//
//  Objetivo: producción actual no se rompe. Cada módulo nuevo vive detrás de un
//  flag. Un flag en `false` oculta su entrada de navegación Y su ruta; el código
//  sigue compilado, sólo no se muestra. Esto NO sustituye al error boundary
//  (SinPantallaBlanca): el boundary contiene un crash en runtime; el flag decide
//  si la feature siquiera se ofrece.
//
//  PRECEDENCIA (de menor a mayor):
//    1. BASE           — default honesto por estado de construcción.
//    2. localStorage   — `vh_flags` = {nombre:true/false} (persistente por equipo QA).
//    3. URL ?ff=...    — lista separada por comas; `-nombre` desactiva. Efímero.
//
//  La URL gana para que el smoke humano pueda prender/apagar sin tocar storage:
//    ?ff=voni_v2,layout_v2         → prende esos dos
//    ?ff=-commercial_v2           → apaga comercial
//    ?ff=all                      → prende TODO (sólo para smoke en preview)
//
//  Puro y testeable: `flagActivo(nombre, {storage, search})` no toca globals si
//  le pasas las fuentes. Sin fuentes, lee window/localStorage con try/catch.
// ============================================================================

// Default por flag. `true` = visible para todos; `false` = oculto salvo override.
// Se activa en `true` SÓLO cuando el módulo está IMPLEMENTED_PENDING_VISUAL_SMOKE
// o PASS LOGIC y no toca un edge vivo de forma riesgosa en producción.
export const BASE = Object.freeze({
  // Superficie comercial completa (Hoy, Proyectos, Workspace, Productos, Dirección).
  // Construida, ruteada, boot-limpia, con tests → visible.
  commercial_v2: true,
  // WOW presentar al cliente (client-safe por diseño). Construido → visible.
  client_presentation_v2: true,
  // Voni 2.0 intérprete comercial con provenance. Capa pura + integración de
  // sólo-lectura (no muta el edge cotizar-texto) → visible.
  voni_v2: true,
  // Lectura/análisis de planos (mueble y edificio) → modelo de evidencia.
  // Capa de análisis pura + UI de revisión. Visible para smoke.
  plan_analysis_v2: true,
  // Layout / acomodo con motor de colisiones + editor libre.
  // Ya existe infraestructura (Acomodo/PlanoAcomodo/DibujarPlano) → visible.
  layout_v2: true,
  // Render UX + versionado (STALE por hash). Capa de estado pura + UI.
  render_v2: true,
});

export const NOMBRES_FLAG = Object.freeze(Object.keys(BASE));

// Descripción legible para un panel de QA / diagnóstico.
export const DESCRIPCION_FLAG = Object.freeze({
  commercial_v2: 'Módulo comercial (Hoy, Proyectos, Workspace, Productos, Dirección)',
  client_presentation_v2: 'Presentación al cliente a pantalla completa (WOW)',
  voni_v2: 'Voni 2.0 — intérprete comercial con procedencia (provenance)',
  plan_analysis_v2: 'Análisis de planos (mueble y edificio) con evidencia',
  layout_v2: 'Layout / acomodo con colisiones y editor libre',
  render_v2: 'Renders con versionado y estado DESACTUALIZADO',
});

function leerStorage(storage) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return {};
    const raw = s.getItem('vh_flags');
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function leerURL(search) {
  try {
    const q = search != null
      ? search
      : (typeof window !== 'undefined' && window.location ? window.location.search : '');
    if (!q) return {};
    const params = new URLSearchParams(q);
    const ff = params.get('ff');
    if (!ff) return {};
    if (ff.trim() === 'all') {
      const todo = {};
      for (const n of NOMBRES_FLAG) todo[n] = true;
      return todo;
    }
    const out = {};
    for (const token of ff.split(',')) {
      const t = token.trim();
      if (!t) continue;
      if (t.startsWith('-')) out[t.slice(1)] = false;
      else out[t] = true;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Estado efectivo de un flag.
 * @param {string} nombre
 * @param {{storage?:object, search?:string}} [fuentes] inyecta fuentes para test.
 * @returns {boolean}
 */
export function flagActivo(nombre, fuentes = {}) {
  if (!(nombre in BASE)) return false; // flag desconocida = apagada (fail-closed)
  const storage = leerStorage(fuentes.storage);
  const url = leerURL(fuentes.search);
  if (nombre in url) return !!url[nombre];
  if (nombre in storage) return !!storage[nombre];
  return !!BASE[nombre];
}

/** Snapshot de todas las flags (para un panel de diagnóstico). */
export function todasLasFlags(fuentes = {}) {
  const out = {};
  for (const n of NOMBRES_FLAG) out[n] = flagActivo(n, fuentes);
  return out;
}

/** Persiste un override en localStorage (para un panel de QA). */
export function fijarFlag(nombre, valor) {
  if (!(nombre in BASE)) return false;
  try {
    const actual = leerStorage();
    actual[nombre] = !!valor;
    localStorage.setItem('vh_flags', JSON.stringify(actual));
    return true;
  } catch {
    return false;
  }
}

/** Limpia todos los overrides de localStorage (vuelve a BASE + URL). */
export function limpiarFlags() {
  try {
    localStorage.removeItem('vh_flags');
    return true;
  } catch {
    return false;
  }
}
