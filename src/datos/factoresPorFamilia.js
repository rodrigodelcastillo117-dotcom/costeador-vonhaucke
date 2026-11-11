// ============================================================================
//  FACTORES DE FABRICACIÓN POR FAMILIA (cargador gobernado).
//
//  Un mueble NUEVO que todavía no tiene su factor por-clave medido se costeaba con
//  la política genérica (×1.8 compuesta, correcta para ALPURA). Para una familia cuyo
//  factor real es otro (TELCEL ×1.35), eso sobrecostea ~33%. Este módulo resuelve el
//  factor REAL de la familia para que un mueble nuevo acierte sin esperar su hoja propia.
//
//  Precedencia (la aplica costearBOM, y queda trazada en `factoresFuente`):
//     factor por-clave del BOM  >  factor de familia (aquí)  >  política VH (default).
//
//  REGLA DURA: aquí NO se inventan factores. Solo entra una familia con dato real, con
//  su fuente y quién lo aprobó. Dirección/Contabilidad agrega cada familia cuando entrega
//  su Bloque 1 (formulario de datos) — por código aquí, o cargando filas con
//  `cargarFactoresFamilia`. Una familia sin registrar cae a la política y queda PRELIMINAR.
// ============================================================================

const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// factor_mo / factor_gif: fracciones PLANAS del material (mismo modelo que el factor por-clave).
// SOLO familias con dato verificado. TELCEL: reconstruido de explo_x_id C-CO-320R; reproduce al
// centavo Horizontal/Torre/Isla/Almacén. ALPURA NO se registra aquí: su modelo real es la política
// ×1.8 compuesta por sección, que ya es el default — representarla como plana sería incorrecto.
const SEED = {
  telcel: { familia: 'TELCEL', factor_mo: 0.10, factor_gif: 0.25, fuente: 'explo_x_id C-CO-320R', aprobado_por: 'Dirección', fecha: '2026-11-06' },
};

export const FACTORES_FAMILIA = Object.freeze(
  Object.fromEntries(Object.entries(SEED).map(([k, v]) => [k, Object.freeze({ ...v })]))
);

/** Devuelve el factor real de una familia, o null si no está registrada (NO inventa). */
export function factorDeFamilia(familia, tabla = FACTORES_FAMILIA) {
  const k = norm(familia);
  if (!k || !tabla) return null;
  const e = tabla[k];
  if (!e) return null;
  const mo = Number(e.factor_mo), gif = Number(e.factor_gif);
  if (!Number.isFinite(mo) || !Number.isFinite(gif) || mo < 0 || gif < 0) return null;
  return { factor_mo: mo, factor_gif: gif, fuente: e.fuente || null, aprobado_por: e.aprobado_por || null, fecha: e.fecha || null };
}

/** Familias registradas (para UI/diagnóstico). */
export function familiasRegistradas(tabla = FACTORES_FAMILIA) {
  return Object.values(tabla).map((e) => ({ familia: e.familia, factor_mo: e.factor_mo, factor_gif: e.factor_gif, fuente: e.fuente, aprobado_por: e.aprobado_por }));
}

/**
 * Construye una tabla de factores por familia desde filas capturadas (Bloque 1 del formulario de
 * datos). VALIDA y DESCARTA toda fila sin factor numérico o sin gobernanza (fuente + aprobador);
 * NUNCA inventa. Pensado para cargar lo que Dirección entregue sin tocar código.
 * @returns {{tabla, aceptadas:string[], rechazadas:{fila,motivo}[]}}
 */
export function cargarFactoresFamilia(filas = [], base = FACTORES_FAMILIA) {
  const tabla = { ...base };
  const aceptadas = [], rechazadas = [];
  for (const f of (Array.isArray(filas) ? filas : [])) {
    const k = norm(f && f.familia);
    const mo = Number(f && f.factor_mo), gif = Number(f && f.factor_gif);
    if (!k || !Number.isFinite(mo) || !Number.isFinite(gif) || mo < 0 || gif < 0) {
      rechazadas.push({ fila: f, motivo: 'sin familia o factor numérico válido' });
      continue;
    }
    if (!f.fuente || !f.aprobado_por) {
      rechazadas.push({ fila: f, motivo: 'falta fuente o aprobador (gobernanza): no se carga sin respaldo' });
      continue;
    }
    tabla[k] = Object.freeze({ familia: f.familia, factor_mo: mo, factor_gif: gif, fuente: f.fuente, aprobado_por: f.aprobado_por, fecha: f.fecha || null });
    aceptadas.push(k);
  }
  return { tabla: Object.freeze(tabla), aceptadas, rechazadas };
}
