// ============================================================================
//  VONI · ESPECIALIDADES (arquitectura B aprobada por Dirección 2026-10-13): UNA interfaz, herramientas especializadas
//  y motores deterministas. NO son agentes autónomos ni modelos extra: cada especialidad envuelve módulos que ya existen.
//    ingenieria → analizar-mueble(-rc) + lecturaIncompleta.js + revisionEstructural.js (+ procedencia por pieza)
//    costos     → mapIaComps / materialMatch / amarre ERP / motor (calculo.js + formulaAlba.js) / costear-servidor
//    arquitecto → leer-plano-core(-rc) + Floor Editor + acomodar-espacio-recovery(-rc)        (Entrega 2)
//    comercial  → Cotizar + gates de emisión                                                   (Entrega 3)
//    creador    → Cocrear + Ingeniería + Costos + generar-render                               (Entrega 3)
//    council    → revisor condicional; APAGADO por defecto hasta que un A/B demuestre beneficio
//  Bandera por especialidad: VITE_VONI_<NOMBRE>=on|off. Apagar una regresa al comportamiento anterior (rollback).
// ============================================================================
export const VERSION_CONTRATO = 'voni-esp-1';
const DEFAULT = Object.freeze({ ingenieria: true, costos: true, arquitecto: false, comercial: false, creador: false, council: false });

function envDe() { try { return import.meta.env || {}; } catch (_e) { return {}; } }

/** ¿Está activa la especialidad? env opcional para pruebas. */
export function especialidadActiva(nombre, env = envDe()) {
  const v = String(env[`VITE_VONI_${String(nombre).toUpperCase()}`] ?? '').trim().toLowerCase();
  if (v === 'on' || v === '1' || v === 'true') return true;
  if (v === 'off' || v === '0' || v === 'false') return false;
  return DEFAULT[nombre] === true;
}

export const RESULTADO = Object.freeze({ PASS: 'PASS', NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION', BLOCKED: 'BLOCKED', ERROR: 'ERROR' });

/**
 * Resultado de VONI INGENIERÍA para un despiece. No calcula costo ni toca economía.
 * @param {{ lecturaIA?: {motivos:string[], revisada?:boolean}|null, revision?: {observaciones:Array}, componentes?: Array, error?: string }} e
 */
export function resultadoIngenieria({ lecturaIA = null, revision = { observaciones: [] }, componentes = [], error = null } = {}) {
  const base = { especialidad: 'ingenieria', contrato: VERSION_CONTRATO, validador: 'ing-1' };
  if (error) return { ...base, estado: RESULTADO.ERROR, motivos: [{ regla: 'error', mensaje: String(error) }] };
  const motivos = [];
  if (lecturaIA && !lecturaIA.revisada) for (const m of lecturaIA.motivos || []) motivos.push({ regla: 'lectura_incompleta', nivel: 'blocker', mensaje: m });
  for (const o of revision.observaciones || []) if (o.nivel === 'blocker' || o.nivel === 'warning') motivos.push({ regla: o.regla || 'estructura', nivel: o.nivel, pieza: o.pieza, mensaje: o.mensaje });
  const inferidas = (componentes || []).filter((c) => c && !c.excluida && (c.procedencia === 'INFERIDO' || c.procedencia === 'SUPUESTO') && c.material_confirmado !== true);
  for (const c of inferidas) motivos.push({ regla: 'pieza_no_observada', nivel: 'confirmar', pieza: c.nombre, mensaje: `«${c.nombre}» es ${c.procedencia === 'SUPUESTO' ? 'un supuesto' : 'una inferencia'} de la IA: confírmala.` });
  const estado = motivos.some((m) => m.nivel === 'blocker') ? RESULTADO.BLOCKED : motivos.length ? RESULTADO.NEEDS_CONFIRMATION : RESULTADO.PASS;
  return { ...base, estado, motivos };
}

/** Resultado de VONI COSTOS a partir del estado de tres niveles (estadoCosto.js). Nunca expone importes. */
export function resultadoCostos(estado3) {
  const base = { especialidad: 'costos', contrato: VERSION_CONTRATO, validador: 'cost-1' };
  if (!estado3) return { ...base, estado: RESULTADO.ERROR, motivos: [{ regla: 'sin_estado', mensaje: 'Sin estado de costo.' }] };
  const estado = estado3.estado === 'validado' ? RESULTADO.PASS : estado3.estado === 'bloqueado' ? RESULTADO.BLOCKED : RESULTADO.NEEDS_CONFIRMATION;
  return { ...base, estado, motivos: (estado3.motivos || []).map((m) => ({ regla: estado3.estado, mensaje: m })) };
}

/** Procedencia de la IA → estado canónico (OBSERVADO / INFERIDO / SUPUESTO / DESCONOCIDO). CONFIRMADO lo pone sólo una persona. */
export function procedenciaCanonica(p) {
  const v = String(p || '').trim().toUpperCase();
  if (v === 'MEASURED' || v === 'DERIVED') return 'OBSERVADO';
  if (v === 'INFERRED') return 'INFERIDO';
  if (v === 'ASSUMED') return 'SUPUESTO';
  return 'DESCONOCIDO';
}
