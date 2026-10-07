// ============================================================================
//  P0.2b · G · MENSAJE AL VENDEDOR (puro, self-contained).
//
//  Dado el resultado del solver (colocación + no_cupieron + unassigned), produce
//  en español simple:
//   1. QUÉ no cupó (lista por tipo, legible).
//   2. POR QUÉ (motivo CAUSAL del invariante limitante, con números; "faltan m²"
//      SÓLO cuando la restricción real es superficie/forma — nunca por defecto).
//   3. QUÉ hacer: 2–3 opciones CONCRETAS, cada una con `aplicar(areas,piezas)` que
//      transforma el input para que el solver pueda RE-SIMULARLA y confirmar que
//      mejora/resuelve. El banco verifica que ≥1 opción realmente mejora.
//
//  No pone coordenadas ni decide negocio; sólo explica y propone transformaciones.
// ============================================================================
const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const m2 = (mm2) => +(mm2 / 1e6).toFixed(1);

const LABEL = {
  ANCHOR_WORKSTATION: 'estación de trabajo', ANCHOR_DESK: 'escritorio',
  ANCHOR_MEETING: 'mesa de juntas', ANCHOR_RECEPTION: 'recepción',
  WORK_SEAT: 'silla operativa', EXECUTIVE_SEAT: 'silla ejecutiva',
  MEETING_SEAT: 'silla de juntas', VISITOR_SEAT: 'silla de visita',
  UNDERDESK_STORAGE: 'gaveta', SUPPORT_STORAGE: 'gaveta',
};
const plural = (n, sing) => `${n} ${sing}${n === 1 ? '' : 's'}`;

// Huella aproximada de un kit según su ancla (para dimensionar el espacio limpio).
function huellaAncla(a) {
  const w = num(a.w), d = num(a.d);
  switch (a.relation_role) {
    case 'ANCHOR_MEETING': return { w: w + 1200, h: d + 1200 };
    default: return { w, h: d + 600 };   // workstation/desk/reception: fila de sillas
  }
}

const MOTIVO = {
  OUT_OF_BOUNDS: (ctx) => `El grupo necesita ~${ctx.needM2} m² y el área disponible es de ~${ctx.haveM2} m².`,
  OUT_OF_POLYGON: () => 'La forma del cuarto (muros/recortes) no deja un hueco continuo para el módulo.',
  NO_SPACE: (ctx) => `El grupo necesita ~${ctx.needM2} m² y el área disponible es de ~${ctx.haveM2} m².`,
  NO_SPACE_PARA_SILLAS: (ctx) => `No quedó espacio para ${plural(ctx.nSillas, 'silla')} junto a su mueble conservando el pasillo de 1.0 m.`,
  DOOR: () => 'El barrido de la puerta ocupa ese frente y no deja colocar el módulo.',
  OBSTACLE: () => 'Una columna/obstáculo ocupa el punto donde iría el módulo.',
  AISLE: () => 'Al colocar el módulo ya no queda el pasillo mínimo de 1.0 m entre bloques.',
};
const esGeom = (inv) => inv === 'OUT_OF_BOUNDS' || inv === 'NO_SPACE' || inv === 'OUT_OF_POLYGON';

export function mensajeVendedor(areas = [], piezas = [], sol = {}) {
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const unplaced = Array.isArray(sol.unplaced) ? sol.unplaced : [];
  const unassigned = Array.isArray(sol.unassigned) ? sol.unassigned : [];

  // --- 1 · QUÉ no cupó -------------------------------------------------------
  const faltanIds = [];
  for (const u of unplaced) for (const id of (u.piezas || [])) faltanIds.push(String(id));
  for (const id of unassigned) faltanIds.push(String(id));
  const conteo = new Map();
  for (const id of faltanIds) {
    const p = byId.get(String(id)); if (!p) continue;
    const key = p.relation_role;
    conteo.set(key, (conteo.get(key) || 0) + 1);
  }
  const pendientes = [...conteo.entries()].map(([rol, n]) => ({ rol, n, texto: plural(n, LABEL[rol] || 'pieza') }));

  // --- 2 · POR QUÉ (causal por grupo) ---------------------------------------
  const motivos = [];
  for (const u of unplaced) {
    const inv = u.invariante || 'NO_SPACE';
    const anc = byId.get(String(u.anchorId));
    const ctx = {};
    if (anc) { const h = huellaAncla(anc); ctx.needM2 = m2(h.w * h.h); }
    const areaObj = areas[0];
    ctx.haveM2 = areaObj ? m2(num(areaObj.ancho) * num(areaObj.largo)) : 0;
    ctx.nSillas = (u.piezas || []).filter((id) => { const p = byId.get(String(id)); return p && !esAncla(p.relation_role); }).length;
    const fn = MOTIVO[inv] || (() => `No se pudo colocar el grupo (${inv}).`);
    motivos.push({ anchorId: u.anchorId, invariante: inv, texto: fn(ctx) });
  }
  if (unassigned.length) motivos.push({ invariante: 'DEPENDENT_UNASSIGNED', texto: `${plural(unassigned.length, 'pieza')} dependiente(s) sin un mueble que las reciba (capacidad del catálogo superada).` });

  // --- 3 · QUÉ hacer (opciones simulables) ----------------------------------
  const anclas = piezas.filter((p) => esAncla(p.relation_role));
  const opciones = [];

  // A · quitar lo que no cupo (conserva el acomodo del resto). Útil en PARTIAL.
  if (faltanIds.length) {
    const resumen = pendientes.map((p) => p.texto).join(', ');
    opciones.push({
      id: 'quitar_no_colocadas',
      texto: `Quitar ${resumen} deja el resto del acomodo completo y con pasillos.`,
      aplicar: (as, ps) => ({ areas: as, piezas: ps.filter((p) => !faltanIds.includes(String(p.id))) }),
    });
  }

  // B · espacio suficiente y limpio: área(s) dimensionada(s) a las huellas, sin
  //     obstáculos/puertas/recortes. Simulable: el solver coloca todo. Texto
  //     causal: "m²" SÓLO si el limitante es superficie/forma.
  const maxW = Math.max(1000, ...anclas.map((a) => huellaAncla(a).w));
  const sumH = anclas.reduce((s, a) => s + huellaAncla(a).h + 1000, 1000);
  const needM2 = m2(maxW * sumH);
  const hayGeom = unplaced.some((u) => esGeom(u.invariante));
  const hayPuerta = unplaced.some((u) => u.invariante === 'DOOR');
  const hayObst = unplaced.some((u) => u.invariante === 'OBSTACLE');
  const txtB = hayGeom
    ? `Usar un área de al menos ~${needM2} m² permite acomodar todas las piezas.`
    : hayPuerta ? `Reubicar el acceso (el barrido de la puerta libera ese frente) permite colocar el módulo.`
    : hayObst ? `Usar una zona sin columnas de ~${needM2} m² permite colocar el módulo completo.`
    : `Dar un área despejada de ~${needM2} m² permite acomodar todas las piezas.`;
  opciones.push({
    id: 'espacio_suficiente',
    texto: txtB,
    aplicar: (as, ps) => ({
      areas: as.map((a) => ({ ...a, ancho: Math.max(num(a.ancho), maxW), largo: Math.max(num(a.largo), sumH), obstaculos: [], puertas: [], poly: undefined })),
      piezas: ps,
    }),
  });

  // C · mueble más chico: reduce la mesa/estación más grande que no cupo.
  const anclaFallo = unplaced.map((u) => byId.get(String(u.anchorId))).filter(Boolean)
    .filter((a) => a.relation_role === 'ANCHOR_MEETING' || a.relation_role === 'ANCHOR_WORKSTATION')
    .sort((x, y) => num(y.w) - num(x.w))[0];
  if (anclaFallo) {
    const esMesa = anclaFallo.relation_role === 'ANCHOR_MEETING';
    const nuevoW = Math.max(1200, Math.round(num(anclaFallo.w) * 0.6));
    const capNueva = Math.max(1, Math.floor(num(anclaFallo.user_capacity || 2) / 2));
    const grupo = anclaFallo.functional_group_id;
    const deps = piezas.filter((p) => p.functional_group_id === grupo && !esAncla(p.relation_role));
    const quitar = new Set(deps.slice(capNueva).map((p) => String(p.id)));   // conserva capNueva deps
    opciones.push({
      id: 'mueble_mas_chico',
      texto: esMesa
        ? `Cambiar la mesa de ${(num(anclaFallo.w) / 1000).toFixed(2)} m por una de ${(nuevoW / 1000).toFixed(2)} m permite colocarla con sus sillas.`
        : `Usar una estación de ${capNueva} puesto(s) en lugar de ${num(anclaFallo.user_capacity || 2)} permite colocarla completa.`,
      aplicar: (as, ps) => ({
        areas: as,
        piezas: ps.map((p) => (String(p.id) === String(anclaFallo.id) ? { ...p, w: nuevoW, user_capacity: capNueva } : p)).filter((p) => !quitar.has(String(p.id))),
      }),
    });
  }

  return { pendientes, motivos, opciones, hay_pendientes: faltanIds.length > 0 };
}
