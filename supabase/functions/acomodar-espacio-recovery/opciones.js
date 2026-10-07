// ============================================================================
//  P0.2b · G · MENSAJE AL VENDEDOR (puro; el solver se INYECTA, no se modifica).
//
//  Dado el resultado del solver produce, en español simple:
//   1. QUÉ no cupó (lista por tipo).
//   2. POR QUÉ (motivo CAUSAL del invariante limitante, con m² del área REAL del
//      kit que falló — no `areas[0]`; "faltan m²" sólo si el limitante es superficie).
//   3. QUÉ hacer: hasta 3 opciones CONCRETAS. Cada opción se SIMULA con el solver
//      inyectado y su texto corresponde EXACTAMENTE a la transformación aplicada:
//        · "quitar N piezas"      → quita exactamente esas piezas.
//        · "mover a otra área"    → reasigna el grupo a una SEGUNDA área real.
//        · "mesa más chica"       → reduce SÓLO esa mesa.
//        · "estación de N puestos"→ reduce SÓLO esa estación.
//      Sólo se muestra la opción si la simulación DEMUESTRA mejora, y el texto dice
//      el resultado verificado ("caben las 10 sillas" / "caben 8 de 10"). Si ninguna
//      opción mejora: `sin_opcion` lo dice claramente. Nunca agranda áreas ni borra
//      puertas/obstáculos/polígono de forma indiscriminada.
// ============================================================================
const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esSilla = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT'].includes(r);
const esGaveta = (r) => ['UNDERDESK_STORAGE', 'SUPPORT_STORAGE'].includes(r);
const m2 = (mm2) => +(mm2 / 1e6).toFixed(1);
const nz = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');

const LABEL = {
  ANCHOR_WORKSTATION: 'estación de trabajo', ANCHOR_DESK: 'escritorio',
  ANCHOR_MEETING: 'mesa de juntas', ANCHOR_RECEPTION: 'recepción',
  WORK_SEAT: 'silla operativa', EXECUTIVE_SEAT: 'silla ejecutiva',
  MEETING_SEAT: 'silla de juntas', VISITOR_SEAT: 'silla de visita',
  UNDERDESK_STORAGE: 'gaveta', SUPPORT_STORAGE: 'gaveta',
};
const plural = (n, sing) => `${n} ${sing}${n === 1 ? '' : 's'}`;
const TIPO_DE_ROL = { ANCHOR_WORKSTATION: 'open', ANCHOR_DESK: 'privado', ANCHOR_MEETING: 'juntas', ANCHOR_RECEPTION: 'recepcion' };

function huellaAncla(a) {
  const w = num(a.w), d = num(a.d);
  return a.relation_role === 'ANCHOR_MEETING' ? { w: w + 1200, h: d + 1200 } : { w, h: d + 600 };
}
// Índice del área que el kit REALMENTE tiene como destino (zona, luego tipo).
function areaIdxDe(anchor, areas) {
  const zid = anchor?.zone_id;
  if (zid != null) { const i = areas.findIndex((a) => nz(a?.zone_id ?? a?.nombre) === nz(zid)); if (i >= 0) return i; }
  const tipo = TIPO_DE_ROL[anchor?.relation_role];
  const i = areas.findIndex((a) => !tipo || nz(a?.tipo) === nz(tipo));
  return i >= 0 ? i : 0;
}
function idsNoColocadas(sol) {
  const s = new Set();
  for (const u of (sol?.unplaced || [])) for (const id of (u.piezas || [])) s.add(String(id));
  for (const id of (sol?.unassigned || [])) s.add(String(id));
  return s;
}

// BLOCK 4 · causa REAL del no-cupo. El texto deriva del invariante limitante y de
// evidencia medida. PROHIBIDO "falta superficie" cuando haveM2 ≥ needM2: en ese caso
// el limitante es forma/dimensión (ASPECT_RATIO) o fragmentación (CONTIGUOUS_SPACE).
function causaReal(inv, anc, ar, nSillas) {
  const h = anc ? huellaAncla(anc) : { w: 0, h: 0 };
  const areaW = num(ar.ancho) || num(ar.width_mm), areaH = num(ar.largo) || num(ar.depth_mm);
  const needM2 = m2(h.w * h.h), haveM2 = m2(areaW * areaH);
  const zona = ar.nombre || ar.zone_id || 'el área';
  const ev = { invariante_solver: inv, needM2, haveM2, moduloW_m: +(h.w / 1000).toFixed(2), moduloH_m: +(h.h / 1000).toFixed(2), areaW_m: +(areaW / 1000).toFixed(2), areaH_m: +(areaH / 1000).toFixed(2) };
  if (inv === 'DOOR') return { invariante: 'DOOR', texto: `El barrido de la puerta en "${zona}" ocupa ese frente y no deja colocar el módulo.`, evidencia: ev };
  if (inv === 'OBSTACLE') return { invariante: 'OBSTACLE', texto: `Una columna/obstáculo en "${zona}" ocupa el punto donde iría el módulo.`, evidencia: ev };
  if (inv === 'AISLE') return { invariante: 'AISLE', texto: `Al colocar el módulo ya no queda el pasillo mínimo de 1.0 m entre bloques en "${zona}".`, evidencia: ev };
  if (inv === 'OVERLAP') return { invariante: 'OVERLAP', texto: `No caben los dos bloques en "${zona}" sin encimarse ni perder el pasillo de 1.0 m.`, evidencia: ev };
  if (inv === 'NO_SPACE_PARA_SILLAS') return { invariante: 'NO_SPACE_PARA_SILLAS', texto: `No quedó espacio para ${plural(nSillas, 'silla')} junto a su mueble conservando el pasillo de 1.0 m.`, evidencia: ev };
  if (inv === 'OUT_OF_POLYGON') return { invariante: 'CONTIGUOUS_SPACE', texto: `La forma de "${zona}" (muros/recortes) no deja un rectángulo continuo para el módulo; hay superficie, pero fragmentada.`, evidencia: ev };
  // OUT_OF_BOUNDS / NO_SPACE / genérico → decidir la causa real:
  if (h.w > areaW + 1 || h.h > areaH + 1) {
    const lado = h.w > areaW ? `ancho (${ev.moduloW_m} m vs ${ev.areaW_m} m de la zona)` : `fondo (${ev.moduloH_m} m vs ${ev.areaH_m} m de la zona)`;
    return { invariante: 'ASPECT_RATIO', texto: `El módulo no entra por la FORMA del área "${zona}": su ${lado} no cabe (hay ~${haveM2} m² en total, pero no en esa dimensión).`, evidencia: ev };
  }
  if (needM2 > haveM2) return { invariante: 'NO_SPACE', texto: `El grupo necesita ~${needM2} m² y el área "${zona}" tiene ~${haveM2} m².`, evidencia: ev };
  return { invariante: 'CONTIGUOUS_SPACE', texto: `Hay superficie en "${zona}" (~${haveM2} m²), pero no un hueco rectangular continuo que conserve el pasillo de 1.0 m.`, evidencia: ev };
}

export function mensajeVendedor(areas = [], piezas = [], sol = {}, opts = {}) {
  const resolver = typeof opts.resolver === 'function' ? opts.resolver : null;
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const unplaced = Array.isArray(sol.unplaced) ? sol.unplaced : [];
  const unassigned = Array.isArray(sol.unassigned) ? sol.unassigned : [];
  const faltanIds = [...idsNoColocadas(sol)];
  const baseColoc = piezas.length - faltanIds.length;

  // 1 · QUÉ no cupó
  const conteo = new Map();
  for (const id of faltanIds) { const p = byId.get(String(id)); if (!p) continue; conteo.set(p.relation_role, (conteo.get(p.relation_role) || 0) + 1); }
  const pendientes = [...conteo.entries()].map(([rol, n]) => ({ rol, n, texto: plural(n, LABEL[rol] || 'pieza') }));

  // 2 · POR QUÉ (causal, con el área REAL del kit que falló)
  const motivos = [];
  for (const u of unplaced) {
    const anc = byId.get(String(u.anchorId));
    const ai = anc ? areaIdxDe(anc, areas) : 0;
    const ar = areas[ai] || areas[0] || {};
    const nSillas = (u.piezas || []).filter((id) => { const p = byId.get(String(id)); return p && !esAncla(p.relation_role); }).length;
    const c = causaReal(u.invariante || 'NO_SPACE', anc, ar, nSillas);
    motivos.push({ anchorId: u.anchorId, invariante: c.invariante, invariante_solver: u.invariante || 'NO_SPACE', zona: ar.nombre || ar.zone_id || `área ${ai + 1}`, texto: c.texto, evidencia: c.evidencia });
  }
  if (unassigned.length) motivos.push({ invariante: 'DEPENDENT_UNASSIGNED', texto: `${plural(unassigned.length, 'pieza')} sin un mueble que las reciba (se superó la capacidad del catálogo).` });

  // 3 · QUÉ hacer — candidatos auto-verificados por simulación.
  const grupoDe = (id) => byId.get(String(id))?.functional_group_id;
  const sim = (as, ps) => { if (!resolver) return null; try { return resolver(as, ps); } catch { return null; } };
  const colocDe = (ps, s) => { if (!s) return null; const no = idsNoColocadas(s); return { placed: ps.length - no.size, no }; };

  const candidatas = [];

  // A · mover el grupo que falló a una SEGUNDA área real compatible.
  for (const u of unplaced) {
    const anc = byId.get(String(u.anchorId)); if (!anc) continue;
    const grupo = anc.functional_group_id;
    const tipo = TIPO_DE_ROL[anc.relation_role];
    const origen = areaIdxDe(anc, areas);
    const destIdx = areas.findIndex((a, i) => i !== origen && (!tipo || nz(a?.tipo) === nz(tipo)));
    if (destIdx < 0) continue;
    const dest = areas[destIdx];
    candidatas.push({
      id: 'mover_zona', grupo,
      base: `Mover ${LABEL[anc.relation_role] || 'el grupo'} a "${dest.nombre || dest.zone_id}"`,
      aplicar: (as, ps) => ({ areas: as, piezas: ps.map((p) => (p.functional_group_id === grupo ? { ...p, zone_id: dest.zone_id ?? dest.nombre } : p)) }),
    });
    break;
  }

  // B · mesa más chica (sólo la mesa de juntas que falló más grande).
  const mesaFallo = unplaced.map((u) => byId.get(String(u.anchorId))).filter((a) => a && a.relation_role === 'ANCHOR_MEETING').sort((x, y) => num(y.w) - num(x.w))[0];
  if (mesaFallo) {
    const nuevoW = Math.max(1200, Math.round(num(mesaFallo.w) * 0.6));
    const capN = Math.max(2, Math.floor(num(mesaFallo.user_capacity || 2) / 2));
    const grupo = mesaFallo.functional_group_id;
    const sillas = piezas.filter((p) => p.functional_group_id === grupo && esSilla(p.relation_role));
    const quitar = new Set(sillas.slice(capN).map((p) => String(p.id)));
    candidatas.push({
      id: 'mesa_mas_chica', grupo,
      base: `Cambiar la mesa de ${(num(mesaFallo.w) / 1000).toFixed(2)} m por una de ${(nuevoW / 1000).toFixed(2)} m`,
      aplicar: (as, ps) => ({ areas: as, piezas: ps.map((p) => (String(p.id) === String(mesaFallo.id) ? { ...p, w: nuevoW, user_capacity: capN } : p)).filter((p) => !quitar.has(String(p.id))) }),
    });
  }

  // C · estación con menos puestos (la workstation que falló más grande). Prueba el
  // mayor capN que SÍ quepa (verificado por simulación más abajo).
  const wsFallo = unplaced.map((u) => byId.get(String(u.anchorId))).filter((a) => a && a.relation_role === 'ANCHOR_WORKSTATION').sort((x, y) => num(y.w) - num(x.w))[0];
  if (wsFallo) {
    const grupo = wsFallo.functional_group_id;
    const cap0 = Math.max(1, Math.round(num(wsFallo.user_capacity) || Math.round(num(wsFallo.w) / 1500)));
    const sillas = piezas.filter((p) => p.functional_group_id === grupo && esSilla(p.relation_role));
    const gavetas = piezas.filter((p) => p.functional_group_id === grupo && esGaveta(p.relation_role));
    for (let capN = cap0 - 1; capN >= 1; capN--) {
      const w1 = capN * 1500;
      const quitar = new Set([...sillas.slice(capN), ...gavetas.slice(capN)].map((p) => String(p.id)));
      candidatas.push({
        id: `estacion_${capN}`, grupo, capN, cap0,
        base: `Usar una estación de ${plural(capN, 'puesto')} en lugar de ${cap0}`,
        aplicar: (as, ps) => ({ areas: as, piezas: ps.map((p) => (String(p.id) === String(wsFallo.id) ? { ...p, w: w1, user_capacity: capN } : p)).filter((p) => !quitar.has(String(p.id))) }),
      });
    }
  }

  // D · quitar exactamente lo que no cupo (sólo si ya hay algo colocado).
  if (faltanIds.length && baseColoc > 0) {
    candidatas.push({
      id: 'quitar_no_colocadas', esQuitar: true,
      base: `Quitar ${pendientes.map((p) => p.texto).join(', ')}`,
      aplicar: (as, ps) => ({ areas: as, piezas: ps.filter((p) => !faltanIds.includes(String(p.id))) }),
    });
  }

  // Verifica cada candidata por simulación; conserva sólo las que mejoran, con texto
  // de resultado verificado. Una por id de grupo/tipo; máximo 3.
  const opciones = [];
  const vistos = new Set();
  for (const cand of candidatas) {
    if (opciones.length >= 3) break;
    const t = cand.aplicar(areas, piezas);
    const s2 = sim(t.areas, t.piezas);
    const r2 = colocDe(t.piezas, s2);
    let texto = null;
    if (cand.esQuitar) {
      if (r2 && r2.no.size === 0 && t.piezas.length > 0) texto = `${cand.base}: el resto queda acomodado completo.`;
      else if (!resolver) texto = `${cand.base}: deja el resto del acomodo.`;
    } else {
      const grupoIds = t.piezas.filter((p) => p.functional_group_id === cand.grupo).map((p) => String(p.id));
      const grupoCompleto = r2 ? grupoIds.length > 0 && grupoIds.every((id) => !r2.no.has(id)) : false;
      if (grupoCompleto) {
        if (cand.id === 'mover_zona') texto = `${cand.base}: ahí caben sus ${grupoIds.length} piezas.`;
        else if (cand.id === 'mesa_mas_chica') texto = `${cand.base}: cabe con sus sillas.`;
        else texto = `${cand.base}: cabe completa (${cand.capN} de ${cand.cap0}).`;
      }
    }
    if (!texto) continue;
    const clave = cand.id.startsWith('estacion_') ? `estacion:${cand.grupo}` : `${cand.id}:${cand.grupo || ''}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    opciones.push({ id: cand.id, texto, aplicar: cand.aplicar });
  }

  const sin_opcion = (faltanIds.length && opciones.length === 0)
    ? 'No encontré una forma de que quepa; revisa el espacio con un diseñador.'
    : null;

  return { pendientes, motivos, opciones, sin_opcion, hay_pendientes: faltanIds.length > 0 };
}
