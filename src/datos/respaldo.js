// ============================================================================
//  RESPALDO LOCAL DE UN CLIC (Bloque 1, 2026-10-10)
//
//  Parte del trabajo puede vivir SÓLO en el navegador de una computadora
//  (localStorage). Nadie puede sacarlo desde GitHub ni desde Supabase. Esto lo
//  exporta a un archivo desde la propia app y lo restaura en otra, con permisos:
//   - Quien NO ve costos recibe su cotización SIN economía (misma regla que el
//     servidor: `jsonb_sin_economia`), y sin insumos/parámetros/finanzas.
//   - Quien SÍ ve costos recibe además insumos, piezas y parámetros, pero NUNCA la
//     nómina (PARAMS_SENSIBLES: vive en la bóveda `direccion` de la nube) ni finanzas.
//  El respaldo lleva el `id` y la `claveCreacion` de la cotización: restaurarlo en
//  otra computadora sigue editando LA MISMA cotización en la nube, no crea otra.
// ============================================================================
import { PARAMS_SENSIBLES } from '../almacen.js';

export const RESPALDO_VERSION = 'respaldo-vh-1';

// Mismo criterio que el servidor (public.jsonb_sin_economia): se quita cualquier
// llave que, normalizada (minúsculas, sin símbolos), caiga en este patrón, a
// cualquier profundidad.
const ECONOMIA = /^(costo.*|cost.*|margen.*|margin.*|utilidad.*|profit.*|materialtotal|manoobra.*|laborcost.*|indirectos.*|overhead.*|precioproveedor.*|supplierprice.*|suppliercost.*|proveedor.*|supplier.*|preciocompra.*|purchaseprice.*|purchasecost.*|precioreal.*|costoderivado.*|internalcost.*|internalmargin.*)$/;
const normal = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

export function sinEconomia(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(sinEconomia);
  if (typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (ECONOMIA.test(normal(k))) continue;
      out[k] = sinEconomia(x);
    }
    return out;
  }
  return v;
}

const sinSensibles = (parametros) => {
  const p = { ...(parametros || {}) };
  for (const f of PARAMS_SENSIBLES) delete p[f];
  return p;
};

/** Arma el objeto a exportar según lo que el rol puede ver. */
export function armarRespaldo(estado, { veCostos = false, usuario = null } = {}) {
  const cot = estado?.cotizacion || {};
  const cotizacion = veCostos ? { ...cot } : sinEconomia(cot);
  const r = {
    version: RESPALDO_VERSION,
    creado: new Date().toISOString(),
    usuario: usuario || null,
    incluyeEconomia: !!veCostos,
    cotizacion,
  };
  if (veCostos) {
    r.historial = Array.isArray(estado?.historial) ? estado.historial : [];
    r.insumos = estado?.insumos || {};
    r.piezas = estado?.piezas || {};
    r.parametros = sinSensibles(estado?.parametros);
  }
  return r;
}

/** ¿Es un respaldo nuestro y bien formado? Devuelve { ok, motivo }. */
export function validarRespaldo(r) {
  if (!r || typeof r !== 'object') return { ok: false, motivo: 'No es un respaldo de la app.' };
  if (r.version !== RESPALDO_VERSION) return { ok: false, motivo: `Versión de respaldo desconocida (${r.version || 'sin versión'}).` };
  if (!r.cotizacion || typeof r.cotizacion !== 'object') return { ok: false, motivo: 'El respaldo no trae cotización.' };
  if (!Array.isArray(r.cotizacion.partidas)) return { ok: false, motivo: 'La cotización del respaldo no trae renglones.' };
  if (r.cotizacion.id != null && !Number.isFinite(Number(r.cotizacion.id))) return { ok: false, motivo: 'El id de la cotización no es válido.' };
  return { ok: true };
}

/**
 * Aplica el respaldo al estado actual. La cotización SE REEMPLAZA (quien restaura
 * ya confirmó). Insumos/piezas/parámetros sólo si el respaldo los trae Y el rol
 * actual puede verlos (un vendedor no "recibe" costos por restaurar el archivo de
 * Dirección). La nómina jamás entra por aquí.
 */
export function aplicarRespaldo(estado, r, { veCostos = false } = {}) {
  const v = validarRespaldo(r);
  if (!v.ok) throw new Error(v.motivo);
  const cot = veCostos ? r.cotizacion : sinEconomia(r.cotizacion);
  const nuevo = {
    ...estado,
    cotizacion: { ...(estado?.cotizacion || {}), ...cot, partidas: cot.partidas || [] },
  };
  if (veCostos && r.incluyeEconomia) {
    if (r.insumos && typeof r.insumos === 'object') nuevo.insumos = { ...(estado?.insumos || {}), ...r.insumos };
    if (r.piezas && typeof r.piezas === 'object') nuevo.piezas = { ...(estado?.piezas || {}), ...r.piezas };
    if (r.parametros && typeof r.parametros === 'object') nuevo.parametros = { ...(estado?.parametros || {}), ...sinSensibles(r.parametros) };
    if (Array.isArray(r.historial)) {
      const ids = new Set((estado?.historial || []).map((h) => h?.id));
      nuevo.historial = [...(estado?.historial || []), ...r.historial.filter((h) => !ids.has(h?.id))];
    }
  }
  return nuevo;
}

export function nombreArchivoRespaldo(r) {
  const cliente = String(r?.cotizacion?.cliente || 'sin-cliente').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'sin-cliente';
  const fecha = (r?.creado || new Date().toISOString()).slice(0, 10);
  return `respaldo-vonhaucke-${cliente}-${fecha}.json`;
}

// --- DOM (no se prueba en vitest) -------------------------------------------
export function descargarJSON(nombre, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function leerArchivoJSON(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      try { resolve(JSON.parse(lector.result)); } catch (e) { reject(new Error('El archivo no es un JSON válido.')); }
    };
    lector.onerror = () => reject(new Error('No se pudo abrir el archivo.'));
    lector.readAsText(archivo);
  });
}
