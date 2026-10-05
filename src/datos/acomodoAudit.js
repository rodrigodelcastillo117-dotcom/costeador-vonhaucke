// ============================================================================
// AUDITORÍA DE CALIDAD DEL ACOMODO · verificación post-layout (incluye manual).
// Mide huellas reales + espacio funcional explícito + puertas. No corrige.
// ============================================================================
import { validarColocacion, CODIGO } from '../../supabase/functions/acomodar-espacio/acomodo-core.js';

export function footprintPieza(col, pieza) {
  const w0 = Number(pieza?.w) || 0;
  const d0 = Number(pieza?.d) || 0;
  const rot = ((Number(col?.rot) || 0) % 180 + 180) % 180;
  const [w, h] = rot === 90 ? [d0, w0] : [w0, d0];
  return { x: Number(col?.x) || 0, y: Number(col?.y) || 0, w, h };
}

export function solapeEjes(a, b) {
  const dx = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const dy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return { dx, dy };
}

export function areaSolapeMM2(a, b) {
  const { dx, dy } = solapeEjes(a, b);
  return dx * dy;
}

export function auditarColocacion({ areas = [], colocacion = [], byId = {} } = {}, { tol = 50 } = {}) {
  const overlaps = [];
  const fuera = [];
  const porArea = new Map();
  for (const c of colocacion) {
    const a = c?.area ?? 0;
    if (!porArea.has(a)) porArea.set(a, []);
    porArea.get(a).push(c);
  }

  for (const [ai, items] of porArea) {
    const area = areas[ai];
    const fps = items.map((c) => ({ c, fp: footprintPieza(c, byId[c.id]) }));
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        const { dx, dy } = solapeEjes(fps[i].fp, fps[j].fp);
        if (dx > tol && dy > tol) overlaps.push({ a: fps[i].c.id, b: fps[j].c.id, area: ai, m2: +((dx * dy) / 1e6).toFixed(2), tipo: 'huella' });
      }
    }
    if (area && area.ancho > 0 && area.largo > 0) {
      for (const { c, fp } of fps) {
        if (fp.x < -tol || fp.y < -tol || fp.x + fp.w > area.ancho + tol || fp.y + fp.h > area.largo + tol) fuera.push({ id: c.id, area: ai, tipo: 'huella' });
      }
    }
  }

  // Segunda verdad: vuelve a validar cada pieza colocada con el mismo motor que
  // usa la edge. Así un drag manual no puede romper clearances/puertas y seguir
  // mostrando "Todo cabe" sólo porque las huellas físicas no se tocan.
  const piezas = colocacion.map((c) => byId[c.id]).filter(Boolean);
  const spatial = piezas.length ? validarColocacion(areas, piezas, colocacion, tol) : null;
  const funcionales = [];
  const puertasBloqueadas = [];
  if (spatial) {
    for (const p of spatial.porPieza || []) {
      if (p.codigos?.includes(CODIGO.FUNCTIONAL_CLEARANCE)) funcionales.push({ id: p.id, area: p.area, motivo: p.motivo });
      if (p.codigos?.includes(CODIGO.BLOCKS_DOOR)) puertasBloqueadas.push({ id: p.id, area: p.area, motivo: p.motivo });
    }
  }

  const puertasPendientes = spatial?.puertas?.noVerificadas || [];
  const okFisico = overlaps.length === 0 && fuera.length === 0;
  const ok = okFisico && funcionales.length === 0 && puertasBloqueadas.length === 0 && puertasPendientes.length === 0;

  return {
    ok,
    overlaps,
    fuera,
    funcionales,
    puertasBloqueadas,
    puertasPendientes,
    calidad: spatial?.calidad || null,
    spatial,
    checks: [
      { check: 'Sin muebles encimados', ok: overlaps.length === 0, detalle: overlaps.length ? `${overlaps.length} encimado(s)` : 'ninguno' },
      { check: 'Todo dentro de su área', ok: fuera.length === 0, detalle: fuera.length ? `${fuera.length} fuera` : 'ok' },
      { check: 'Espacio de uso respetado', ok: funcionales.length === 0, detalle: funcionales.length ? `${funcionales.length} conflicto(s) funcional(es)` : 'medido: clearances válidos' },
      { check: 'Puertas libres', ok: puertasBloqueadas.length === 0 && puertasPendientes.length === 0,
        detalle: puertasBloqueadas.length ? `${puertasBloqueadas.length} mueble(s) invade(n) barrido/despeje`
          : puertasPendientes.length ? `${puertasPendientes.length} puerta(s) sin barrido verificable`
            : 'medido: barridos/despejes válidos' },
    ],
    resumen: ok
      ? 'Acomodo verificable: sin encimados, fuera de área, conflictos funcionales ni puertas pendientes.'
      : `${overlaps.length} encimado(s), ${fuera.length} fuera, ${funcionales.length} conflicto(s) funcional(es), ${puertasBloqueadas.length} puerta(s) bloqueada(s), ${puertasPendientes.length} puerta(s) sin barrido verificable.`,
  };
}
