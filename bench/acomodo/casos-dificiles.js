// ============================================================================
//  BANCO LOCAL · 10 CASOS FACTIBLES DIFÍCILES (congelados).
//
//  Construidos a mano (deterministas, SIN RNG) e INDEPENDIENTES del solver: cada
//  caso trae su witness-layout (coordenadas de TODAS las piezas + dueño) que el
//  JUEZ NEUTRAL valida como PASS. Eso PRUEBA la factibilidad. Al solver sólo se le
//  entregan `areas` + `piezas` (programa, sin coordenadas ni dueño ni orden).
//
//  Cubren, combinados: polígonos irregulares (L/T/U), varias puertas, columnas/
//  obstáculos, ocupación >70%, múltiples kits, >1 ancla del mismo tipo y zonas
//  próximas pero semánticamente distintas.
//
//  Geometría de kit PROPIA de este generador (no la del solver):
//   - workstation: ancla w×1200; sillas 600×600 pegadas bajo el tablero (fila a
//     y+1200); gavetas 400×500 BAJO el tablero (solape legal con su ancla).
//   - juntas: ancla w×d centrada en (x+600,y+600); sillas 600×600 en el perímetro.
//   - privado: escritorio 1800×800; silla ejecutiva 600×600 debajo.
//  Todo en mm. Origen top-left.
// ============================================================================
const SEAT = 600;
let _n = 0;
const uid = (p) => `${p}-${++_n}`;

// --- kits (programa + witness) ----------------------------------------------
export function kitWorkstation(gid, zone, cap) {
  const w = cap * 1500, d = 1200;
  const anchor = { id: uid('op'), relation_role: 'ANCHOR_WORKSTATION', functional_group_id: gid, zone_id: zone, w, d, user_capacity: cap };
  const seats = Array.from({ length: cap }, () => ({ id: uid('s'), relation_role: 'WORK_SEAT', functional_group_id: gid, zone_id: zone, w: SEAT, d: SEAT }));
  const gav = Array.from({ length: cap }, () => ({ id: uid('g'), relation_role: 'UNDERDESK_STORAGE', functional_group_id: gid, zone_id: zone, w: 400, d: 500 }));
  const footprint = { w, h: d + SEAT };
  const perW = w / cap;
  const place = (x, y) => {
    const coloc = [{ id: anchor.id, area: 0, x, y, rot: 0 }];
    const owner = { [anchor.id]: null };
    seats.forEach((s, i) => { coloc.push({ id: s.id, area: 0, x: Math.round(x + i * perW + (perW - SEAT) / 2), y: y + d, rot: 0 }); owner[s.id] = anchor.id; });
    gav.forEach((g, i) => { coloc.push({ id: g.id, area: 0, x: Math.round(x + Math.min(w - 400, i * 450)), y: y + d - 500, rot: 0 }); owner[g.id] = anchor.id; });
    return { coloc, owner };
  };
  return { anchor, program: [anchor, ...seats, ...gav], footprint, place };
}

export function kitMeeting(gid, zone, cap) {
  const perLado = Math.ceil(cap / 2);
  const w = Math.max(1800, perLado * 650 + 150), d = 1200;
  const anchor = { id: uid('mesa'), relation_role: 'ANCHOR_MEETING', functional_group_id: gid, zone_id: zone, w, d, user_capacity: cap };
  const seats = Array.from({ length: cap }, () => ({ id: uid('s'), relation_role: 'MEETING_SEAT', functional_group_id: gid, zone_id: zone, w: SEAT, d: SEAT }));
  const footprint = { w: w + 2 * SEAT, h: d + 2 * SEAT };
  const place = (x, y) => {
    const coloc = [{ id: anchor.id, area: 0, x: x + SEAT, y: y + SEAT, rot: 0 }];
    const owner = { [anchor.id]: null };
    seats.forEach((s, i) => {
      const top = i < perLado;
      const k = top ? i : i - perLado;
      coloc.push({ id: s.id, area: 0, x: Math.round(x + SEAT + k * 650), y: top ? y : y + SEAT + d, rot: 0 });
      owner[s.id] = anchor.id;
    });
    return { coloc, owner };
  };
  return { anchor, program: [anchor, ...seats], footprint, place };
}

export function kitPrivado(gid, zone) {
  const anchor = { id: uid('esc'), relation_role: 'ANCHOR_DESK', functional_group_id: gid, zone_id: zone, w: 1800, d: 800 };
  const silla = { id: uid('s'), relation_role: 'EXECUTIVE_SEAT', functional_group_id: gid, zone_id: zone, w: SEAT, d: SEAT };
  const footprint = { w: 1800, h: 800 + SEAT };
  const place = (x, y) => ({
    coloc: [{ id: anchor.id, area: 0, x, y, rot: 0 }, { id: silla.id, area: 0, x: x + 600, y: y + 800, rot: 0 }],
    owner: { [anchor.id]: null, [silla.id]: anchor.id },
  });
  return { anchor, program: [anchor, silla], footprint, place };
}

// Recepción: mostrador w×800 + n sillas de visita en fila al frente.
export function kitReception(gid, zone, nVisitas) {
  const w = 2400;
  const anchor = { id: uid('rec'), relation_role: 'ANCHOR_RECEPTION', functional_group_id: gid, zone_id: zone, w, d: 800 };
  const vis = Array.from({ length: nVisitas }, () => ({ id: uid('v'), relation_role: 'VISITOR_SEAT', functional_group_id: gid, zone_id: zone, w: SEAT, d: SEAT }));
  const footprint = { w, h: 800 + SEAT };
  const place = (x, y) => {
    const coloc = [{ id: anchor.id, area: 0, x, y, rot: 0 }];
    const owner = { [anchor.id]: null };
    vis.forEach((v, i) => { coloc.push({ id: v.id, area: 0, x: Math.round(x + i * 650), y: y + 800, rot: 0 }); owner[v.id] = anchor.id; });
    return { coloc, owner };
  };
  return { anchor, program: [anchor, ...vis], footprint, place };
}

// Ensambla un caso de UNA zona (área con índice 0) a partir de kits ya colocados.
// `colocados` = [{kit, x, y}]. Devuelve programa + witness (piezas con dueño +
// colocación). Marca anchor_instance_id SOLO en el witness, nunca en el programa.
function ensamblar(nombre, area, colocados, extra = {}) {
  const program = [];
  const witnessColoc = [];
  const ownerAll = {};
  for (const { kit, x, y } of colocados) {
    program.push(...kit.program);
    const { coloc, owner } = kit.place(x, y);
    witnessColoc.push(...coloc);
    Object.assign(ownerAll, owner);
  }
  const witnessPiezas = program.map((p) => ({ ...p, anchor_instance_id: ownerAll[p.id] ?? null }));
  const ocupado = colocados.reduce((s, { kit }) => s + kit.footprint.w * kit.footprint.h, 0);
  const occupancy = +(ocupado / (area.ancho * area.largo)).toFixed(3);
  return { nombre, factible: true, dificil: true, areas: [area], piezas: program, witnessPiezas, witnessColoc, occupancy, ...extra };
}

const area = (nombre, zone, tipo, ancho, largo, extra = {}) => ({ nombre, zone_id: zone, tipo, ancho, largo, ...extra });

export function construirDificiles() {
  _n = 0;
  const casos = [];

  // 1 · L-shape, 3 workstations (polígono irregular + multi-kit + >1 ancla igual).
  {
    const a = area('OPERATIVA', 'OPERATIVA', 'open', 9000, 8000, {
      poly: [[0, 0], [9000, 0], [9000, 3000], [4600, 3000], [4600, 8000], [0, 8000]],
    });
    const k = [kitWorkstation('g1', 'OPERATIVA', 3), kitWorkstation('g2', 'OPERATIVA', 3), kitWorkstation('g3', 'OPERATIVA', 3)];
    casos.push(ensamblar('dif01 · L-shape 3 workstations', a, [
      { kit: k[0], x: 0, y: 0 }, { kit: k[1], x: 0, y: 2800 }, { kit: k[2], x: 0, y: 5600 },
    ]));
  }

  // 2 · T-shape, 2 workstations + 1 mesa de juntas (polígono irregular, anclas mixtas).
  {
    const a = area('OPERATIVA', 'OPERATIVA', 'open', 10500, 7000, {
      poly: [[0, 0], [10500, 0], [10500, 3000], [6700, 3000], [6700, 7000], [3300, 7000], [3300, 3000], [0, 3000]],
    });
    const w1 = kitWorkstation('g1', 'OPERATIVA', 3), w2 = kitWorkstation('g2', 'OPERATIVA', 3), m = kitMeeting('gm', 'OPERATIVA', 6);
    casos.push(ensamblar('dif02 · T-shape 2 ws + juntas', a, [
      { kit: w1, x: 0, y: 0 }, { kit: w2, x: 5500, y: 0 }, { kit: m, x: 3350, y: 3100 },
    ]));
  }

  // 3 · Rectángulo con 2 puertas en muros opuestos, 2 workstations.
  {
    const a = area('OPERATIVA', 'OPERATIVA', 'open', 8000, 6000, {
      puertas: [{ x: 0, y: 0, ancho: 900 }, { x: 7100, y: 5100, ancho: 900 }],
    });
    const w1 = kitWorkstation('g1', 'OPERATIVA', 4), w2 = kitWorkstation('g2', 'OPERATIVA', 4);
    casos.push(ensamblar('dif03 · 2 puertas opuestas', a, [
      { kit: w1, x: 1000, y: 0 }, { kit: w2, x: 1000, y: 2800 },
    ]));
  }

  // 4 · Rectángulo con 2 columnas, 2 workstations.
  {
    const a = area('OPERATIVA', 'OPERATIVA', 'open', 9000, 6000, {
      obstaculos: [{ x: 6500, y: 0, w: 600, h: 600 }, { x: 6500, y: 5400, w: 600, h: 600 }],
    });
    const w1 = kitWorkstation('g1', 'OPERATIVA', 4), w2 = kitWorkstation('g2', 'OPERATIVA', 4);
    casos.push(ensamblar('dif04 · 2 columnas', a, [
      { kit: w1, x: 0, y: 0 }, { kit: w2, x: 0, y: 2800 },
    ]));
  }

  // 5 · Ocupación alta (>70%): 2 benches grandes cap 6 en área ajustada.
  {
    const w1 = kitWorkstation('g1', 'OPERATIVA', 6), w2 = kitWorkstation('g2', 'OPERATIVA', 6);
    // footprint c/u 9000×1800. Dos en columna con pasillo 1000 → bbox 9000×4600.
    const a = area('OPERATIVA', 'OPERATIVA', 'open', 9000, 4600);
    casos.push(ensamblar('dif05 · ocupación alta 2×cap6', a, [
      { kit: w1, x: 0, y: 0 }, { kit: w2, x: 0, y: 2800 },
    ]));
  }

  // 6 · Zonas adyacentes pero semánticamente distintas (OPERATIVA vs JUNTAS).
  {
    const op = area('OPERATIVA', 'OPERATIVA', 'open', 7000, 4000);
    const jt = area('JUNTAS', 'JUNTAS', 'juntas', 5000, 4000);
    const w = kitWorkstation('g1', 'OPERATIVA', 4);
    const m = kitMeeting('gm', 'JUNTAS', 6);
    const program = [...w.program, ...m.program];
    const pw = w.place(1000, 0); const pm = m.place(100, 100);
    const witnessColoc = [...pw.coloc, ...pm.coloc.map((c) => ({ ...c, area: 1 }))];
    const owner = { ...pw.owner, ...pm.owner };
    const witnessPiezas = program.map((p) => ({ ...p, anchor_instance_id: owner[p.id] ?? null }));
    casos.push({ nombre: 'dif06 · zonas adyacentes distintas', factible: true, dificil: true, areas: [op, jt], piezas: program, witnessPiezas, witnessColoc, occupancy: 0 });
  }

  // 7 · L-shape con 1 puerta + 1 columna, 2 workstations (combo).
  {
    const a = area('OPERATIVA', 'OPERATIVA', 'open', 9000, 7000, {
      poly: [[0, 0], [9000, 0], [9000, 4000], [4600, 4000], [4600, 7000], [0, 7000]],
      puertas: [{ x: 0, y: 6100, ancho: 900 }],
      obstaculos: [{ x: 8300, y: 3300, w: 600, h: 600 }],
    });
    const w1 = kitWorkstation('g1', 'OPERATIVA', 4), w2 = kitWorkstation('g2', 'OPERATIVA', 3);
    casos.push(ensamblar('dif07 · L + puerta + columna', a, [
      { kit: w1, x: 0, y: 0 }, { kit: w2, x: 0, y: 2800 },
    ]));
  }

  // 8 · Open grande, 4 workstations en 2 filas (muchos kits, ocupación media-alta).
  {
    const k = [kitWorkstation('g1', 'OPERATIVA', 4), kitWorkstation('g2', 'OPERATIVA', 4), kitWorkstation('g3', 'OPERATIVA', 4), kitWorkstation('g4', 'OPERATIVA', 4)];
    // footprint c/u 6000×1800. 2 columnas (x=0 y x=7000), 2 filas (y=0 y y=2800).
    const a = area('OPERATIVA', 'OPERATIVA', 'open', 13000, 4600);
    casos.push(ensamblar('dif08 · 4 workstations 2×2', a, [
      { kit: k[0], x: 0, y: 0 }, { kit: k[1], x: 7000, y: 0 },
      { kit: k[2], x: 0, y: 2800 }, { kit: k[3], x: 7000, y: 2800 },
    ]));
  }

  // 9 · U-shape, 3 escritorios privados (polígono irregular + >1 ancla DESK).
  {
    const a = area('PRIVADO', 'PRIVADO', 'privado', 9000, 6000, {
      poly: [[0, 0], [9000, 0], [9000, 6000], [6000, 6000], [6000, 2500], [3000, 2500], [3000, 6000], [0, 6000]],
    });
    const d1 = kitPrivado('g1', 'PRIVADO'), d2 = kitPrivado('g2', 'PRIVADO'), d3 = kitPrivado('g3', 'PRIVADO');
    casos.push(ensamblar('dif09 · U-shape 3 privados', a, [
      { kit: d1, x: 0, y: 0 }, { kit: d2, x: 3100, y: 0 }, { kit: d3, x: 6200, y: 0 },
    ]));
  }

  // 10 · Rectángulo denso: 1 mesa de juntas (10) + 2 puertas.
  {
    const a = area('JUNTAS', 'JUNTAS', 'juntas', 9000, 7000, {
      puertas: [{ x: 0, y: 6100, ancho: 900 }, { x: 8100, y: 0, ancho: 900 }],
    });
    const m = kitMeeting('gm', 'JUNTAS', 10);
    casos.push(ensamblar('dif10 · juntas10 + 2 puertas', a, [{ kit: m, x: 1000, y: 100 }]));
  }

  return casos;
}
