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

  // Relaciones funcionales: un layout puede no tener overlaps y aun ser absurdo.
  // Las sillas de juntas deben conservar una mesa ancla; las operativas/directivas
  // automáticas deben conservar un escritorio ancla. Las manuales se auditan igual
  // si ya declaraban relación y ésta se perdió.
  const idsColocados = new Set(colocacion.map((c) => String(c.id)));
  const relacionesRotas = [];
  const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const c of colocacion) {
    const p = byId[c.id] || {};
    const nombre = norm(`${p.nombre || ''} ${p.ruta || ''}`);
    const esJunta = /silla.*junta|junta.*silla|meeting.*chair|board.*chair/.test(nombre);
    const esTrabajo = /silla.*operativ|operativ.*silla|silla.*directiv|task chair|work chair/.test(nombre);
    if (esJunta) {
      const anchor = c.anchor_id ?? c.alrededorDe ?? (String(c.contra || '').startsWith('mesa:') ? String(c.contra).slice(5) : null);
      if (!anchor || !idsColocados.has(String(anchor))) {
        relacionesRotas.push({ id: c.id, tipo: 'silla_juntas_sin_mesa', esperado: 'mesa' });
      }
    } else if (esTrabajo) {
      const anchor = c.anchor_id ?? (String(c.contra || '').startsWith('escritorio:') ? String(c.contra).slice(11) : null);
      if (!anchor || !idsColocados.has(String(anchor))) {
        relacionesRotas.push({ id: c.id, tipo: 'silla_trabajo_sin_escritorio', esperado: 'escritorio' });
      }
    }
  }

  // Densidad física extrema: aunque no haya choque, una habitación donde las
  // huellas consumen >65% del piso queda marcada como inviable funcionalmente.
  // Es un hard gate conservador; debajo de eso la calidad fina sigue en spatial.
  const densidadPorArea = [];
  const densidadCritica = [];
  for (const [ai, items] of porArea) {
    const area = areas[ai];
    const areaMM2 = Number(area?.ancho || 0) * Number(area?.largo || 0);
    if (!(areaMM2 > 0)) continue;
    const ocupada = items.reduce((s, cc) => {
      const fp = footprintPieza(cc, byId[cc.id]);
      return s + Math.max(0, fp.w) * Math.max(0, fp.h);
    }, 0);
    const ratio = ocupada / areaMM2;
    const row = { area: ai, ratio: +ratio.toFixed(4), pct: +(ratio * 100).toFixed(1) };
    densidadPorArea.push(row);
    if (ratio > 0.65) densidadCritica.push(row);
  }

  // Compatibilidad con la compuerta UI existente (`AcomodoBase` históricamente
  // sólo contaba `fuera` + `overlaps`). Hasta que la vista consuma los campos
  // ricos directamente, proyectamos aquí las NUEVAS violaciones a `fuera` con
  // un id explicativo. Es deliberadamente fail-closed: jamás se muestra verde
  // por ignorar una puerta/ergonomía que el auditor sí sabe que está pendiente.
  // Las entradas mantienen `tipo` para que una UI nueva pueda diferenciarlas.
  const virtuales = [];
  for (const f of funcionales) {
    const nombre = byId[f.id]?.nombre || f.id;
    virtuales.push({ id: `Espacio funcional insuficiente · ${nombre}`, area: f.area, tipo: 'funcional', realId: f.id });
  }
  for (const p of puertasBloqueadas) {
    const nombre = byId[p.id]?.nombre || p.id;
    virtuales.push({ id: `Barrido de puerta invadido · ${nombre}`, area: p.area, tipo: 'puerta', realId: p.id });
  }
  for (const p of puertasPendientes) {
    virtuales.push({ id: `Puerta sin barrido verificable · área ${(p.area ?? 0) + 1}`, area: p.area, tipo: 'puerta_pendiente' });
  }
  fuera.push(...virtuales);

  const fueraFisico = fuera.filter((f) => f.tipo === 'huella');
  const okFisico = overlaps.length === 0 && fueraFisico.length === 0;
  const ok = okFisico
    && funcionales.length === 0
    && puertasBloqueadas.length === 0
    && puertasPendientes.length === 0
    && relacionesRotas.length === 0
    && densidadCritica.length === 0;

  return {
    ok,
    overlaps,
    fuera,
    fueraFisico,
    virtuales,
    funcionales,
    puertasBloqueadas,
    puertasPendientes,
    relacionesRotas,
    densidadPorArea,
    densidadCritica,
    calidad: spatial?.calidad || null,
    spatial,
    checks: [
      { check: 'Sin muebles encimados', ok: overlaps.length === 0, detalle: overlaps.length ? `${overlaps.length} encimado(s)` : 'ninguno' },
      { check: 'Todo dentro de su área', ok: fueraFisico.length === 0, detalle: fueraFisico.length ? `${fueraFisico.length} fuera` : 'ok' },
      { check: 'Espacio de uso respetado', ok: funcionales.length === 0, detalle: funcionales.length ? `${funcionales.length} conflicto(s) funcional(es)` : 'medido: clearances válidos' },
      { check: 'Puertas libres', ok: puertasBloqueadas.length === 0 && puertasPendientes.length === 0,
        detalle: puertasBloqueadas.length ? `${puertasBloqueadas.length} mueble(s) invade(n) barrido/despeje`
          : puertasPendientes.length ? `${puertasPendientes.length} puerta(s) sin barrido verificable`
            : 'medido: barridos/despejes válidos' },
      { check: 'Relaciones funcionales', ok: relacionesRotas.length === 0,
        detalle: relacionesRotas.length ? `${relacionesRotas.length} relación(es) rota(s)` : 'sillas ancladas a su función' },
      { check: 'Densidad utilizable', ok: densidadCritica.length === 0,
        detalle: densidadCritica.length ? densidadCritica.map((d) => `área ${d.area + 1}: ${d.pct}%`).join(' · ') : 'sin saturación física extrema' },
    ],
    resumen: ok
      ? 'Acomodo verificable: geometría, puertas, relaciones funcionales y densidad pasan.'
      : `${overlaps.length} encimado(s), ${fueraFisico.length} fuera, ${funcionales.length} conflicto(s) funcional(es), ${puertasBloqueadas.length} puerta(s) bloqueada(s), ${puertasPendientes.length} puerta(s) pendiente(s), ${relacionesRotas.length} relación(es) rota(s), ${densidadCritica.length} área(s) saturada(s).`,
  };
}
