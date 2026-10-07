// ============================================================================
//  BANCO LOCAL · CASOS. Los 8 del mandato + 5 imposibles. Áreas en mm; piezas ya
//  expandidas (como las recibe el edge), con relation_role/functional_group_id/
//  zone_id. `factible` indica si existe solución. Independiente del solver.
// ============================================================================
let _n = 0;
const uid = (p) => `${p}-${++_n}`;
const silla = (gid, zone, rol) => ({ id: uid('s'), relation_role: rol, functional_group_id: gid, zone_id: zone, w: 600, d: 600 });
const gaveta = (gid, zone) => ({ id: uid('g'), relation_role: 'UNDERDESK_STORAGE', functional_group_id: gid, zone_id: zone, w: 400, d: 500 });
const bench = (gid, zone, w, cap) => ({ id: uid('op'), relation_role: 'ANCHOR_WORKSTATION', functional_group_id: gid, zone_id: zone, w, d: 1200, user_capacity: cap });
const escritorio = (gid, zone) => ({ id: uid('esc'), relation_role: 'ANCHOR_DESK', functional_group_id: gid, zone_id: zone, w: 1800, d: 800 });
const mesa = (gid, zone, w, d, cap) => ({ id: uid('mesa'), relation_role: 'ANCHOR_MEETING', functional_group_id: gid, zone_id: zone, w, d, user_capacity: cap });
const area = (nombre, zone, tipo, ancho, largo, extra = {}) => ({ nombre, zone_id: zone, tipo, ancho, largo, ...extra });
const rep = (n, fn) => Array.from({ length: n }, fn);

function estacion(gid, zone, w, cap) {
  const b = bench(gid, zone, w, cap);
  return [b, ...rep(cap, () => silla(gid, zone, 'WORK_SEAT')), ...rep(cap, () => gaveta(gid, zone))];
}

function casoMultiZona() {
  return {
    nombre: 'multi-zona', factible: true,
    areas: [
      area('OPERATIVA', 'OPERATIVA', 'open', 9000, 6000, { puertas: [{ x: 0, y: 0, ancho: 900 }], obstaculos: [{ x: 8000, y: 5000, w: 500, h: 500 }] }),
      area('PRIVADO', 'PRIVADO', 'privado', 4000, 4000),
      area('JUNTAS', 'JUNTAS', 'juntas', 6000, 5000),
    ],
    piezas: [
      ...estacion('gOP', 'OPERATIVA', 6000, 4),
      escritorio('gPR', 'PRIVADO'), silla('gPR', 'PRIVADO', 'EXECUTIVE_SEAT'),
      mesa('gJT', 'JUNTAS', 2400, 1200, 8), ...rep(4, () => silla('gJT', 'JUNTAS', 'MEETING_SEAT')),
    ],
  };
}
function casoAppLtWinGav() {
  return { nombre: 'APP LT + WIN + gavetas', factible: true, areas: [area('OPERATIVA', 'OPERATIVA', 'open', 12000, 8000)], piezas: [...estacion('gA', 'OPERATIVA', 6000, 4), ...estacion('gB', 'OPERATIVA', 6000, 4)] };
}
function casoPrivado() {
  return { nombre: 'privado', factible: true, areas: [area('PRIVADO', 'PRIVADO', 'privado', 4000, 4000)], piezas: [escritorio('gPR', 'PRIVADO'), silla('gPR', 'PRIVADO', 'EXECUTIVE_SEAT')] };
}
function casoJuntas10() {
  return { nombre: 'juntas 10', factible: true, areas: [area('JUNTAS', 'JUNTAS', 'juntas', 7000, 6000)], piezas: [mesa('gJT', 'JUNTAS', 3000, 1200, 10), ...rep(10, () => silla('gJT', 'JUNTAS', 'MEETING_SEAT'))] };
}
function casoPuerta() {
  return { nombre: 'puerta', factible: true, areas: [area('OPERATIVA', 'OPERATIVA', 'open', 9000, 6000, { puertas: [{ x: 0, y: 0, ancho: 1000 }] })], piezas: [...estacion('gP', 'OPERATIVA', 6000, 4)] };
}
function casoColumna() {
  return { nombre: 'columna', factible: true, areas: [area('OPERATIVA', 'OPERATIVA', 'open', 9000, 6000, { obstaculos: [{ x: 4000, y: 4500, w: 600, h: 600 }] })], piezas: [...estacion('gC', 'OPERATIVA', 6000, 4)] };
}
function caso25() {
  const recep = { id: uid('rec'), relation_role: 'ANCHOR_RECEPTION', functional_group_id: 'gRC', zone_id: 'RECEPCION', w: 2400, d: 800 };
  const visita = silla('gRC', 'RECEPCION', 'VISITOR_SEAT');
  const piezas = [
    ...estacion('g1', 'OPERATIVA', 4500, 3),
    ...estacion('g2', 'OPERATIVA', 4500, 3),
    mesa('gJ', 'JUNTAS', 2400, 1200, 6), ...rep(6, () => silla('gJ', 'JUNTAS', 'MEETING_SEAT')),
    escritorio('gPr', 'PRIVADO'), silla('gPr', 'PRIVADO', 'EXECUTIVE_SEAT'),
    recep, visita,
  ];
  return {
    nombre: '25 exactas', factible: true, exactas: 25,
    areas: [
      area('OPERATIVA', 'OPERATIVA', 'open', 12000, 8000),
      area('JUNTAS', 'JUNTAS', 'juntas', 6000, 5000),
      area('PRIVADO', 'PRIVADO', 'privado', 4000, 4000),
      area('RECEPCION', 'RECEPCION', 'recepcion', 4000, 4000),
    ],
    piezas,
  };
}
function casoImposibleBase(nombre, areas) {
  return { nombre, factible: false, areas, piezas: [...estacion('gImp', areas[0].zone_id, 6000, 4)] };
}

export function construirCasos() {
  _n = 0;
  const base = [
    casoMultiZona(), casoAppLtWinGav(), casoPrivado(), casoJuntas10(),
    casoPuerta(), casoColumna(), caso25(),
    casoImposibleBase('imposible (área minúscula)', [area('OPERATIVA', 'OPERATIVA', 'open', 2000, 2000)]),
  ];
  const imposibles = [
    casoImposibleBase('imp · área < bench', [area('OPERATIVA', 'OPERATIVA', 'open', 3000, 2000)]),
    casoImposibleBase('imp · puerta tapa todo', [area('OPERATIVA', 'OPERATIVA', 'open', 6500, 1900, { puertas: [{ x: 0, y: 0, ancho: 1800 }] })]),
    casoImposibleBase('imp · obstáculo central', [area('OPERATIVA', 'OPERATIVA', 'open', 6500, 2200, { obstaculos: [{ x: 1000, y: 0, w: 4000, h: 2200 }] })]),
    casoImposibleBase('imp · franja sin altura', [area('OPERATIVA', 'OPERATIVA', 'open', 6500, 2000, { poly: [[0, 0], [6500, 0], [6500, 500], [0, 500]] })]),
    casoImposibleBase('imp · pasillo imposible (2 benches sin hueco)', [area('OPERATIVA', 'OPERATIVA', 'open', 6200, 3800)]),
  ];
  imposibles[4].piezas = [...estacion('gX', 'OPERATIVA', 6000, 4), ...estacion('gY', 'OPERATIVA', 6000, 4)];
  return [...base, ...imposibles];
}

// --- GENERADOR INDEPENDIENTE DEL SOLVER (factibles por construcción) ---------
// Construye un layout VÁLIDO (kits en fila con pasillos) y lo desarma en programa.
// El witness (posiciones) se guarda como PRUEBA de factibilidad; NO se pasa al
// solver. RNG determinista por semilla → mismo banco siempre.
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff); }
const AISLE = 1000, SEAT = 600;

// Footprint del kit SIN resolver (geometría propia del generador).
function footprintKit(kind, p) {
  if (kind === 'juntas') return { w: p.w + 2 * SEAT, h: p.d + 2 * SEAT };
  if (kind === 'privado') return { w: p.w, h: p.d + SEAT };
  return { w: p.w, h: p.d + SEAT }; // operativa
}

export function generarFactibles(n = 30, seed = 20261007) {
  _n = 10000;
  const R = rng(seed);
  const out = [];
  const zonas = [
    { zone: 'OPERATIVA', tipo: 'open', kind: 'operativa' },
    { zone: 'JUNTAS', tipo: 'juntas', kind: 'juntas' },
    { zone: 'PRIVADO', tipo: 'privado', kind: 'privado' },
  ];
  for (let k = 0; k < n; k++) {
    const z = zonas[Math.floor(R() * zonas.length)];
    const nKits = 1 + Math.floor(R() * 3);   // 1..3 kits
    const gid = `gen${k}`;
    const piezas = []; const footprints = []; const witness = [];
    for (let i = 0; i < nKits; i++) {
      const ggid = `${gid}_${i}`;
      if (z.kind === 'operativa') {
        const cap = 2 + Math.floor(R() * 3);          // 2..4
        const w = cap * 1500;
        const anchor = bench(ggid, z.zone, w, cap);
        piezas.push(anchor, ...rep(cap, () => silla(ggid, z.zone, 'WORK_SEAT')), ...rep(cap, () => gaveta(ggid, z.zone)));
        footprints.push(footprintKit('operativa', anchor));
      } else if (z.kind === 'juntas') {
        const cap = 4 + 2 * Math.floor(R() * 3);       // 4,6,8
        const w = Math.max(1800, Math.ceil(cap / 2) * SEAT + 600);
        const anchor = mesa(ggid, z.zone, w, 1200, cap);
        piezas.push(anchor, ...rep(cap, () => silla(ggid, z.zone, 'MEETING_SEAT')));
        footprints.push(footprintKit('juntas', anchor));
      } else {
        const anchor = escritorio(ggid, z.zone);
        piezas.push(anchor, silla(ggid, z.zone, 'EXECUTIVE_SEAT'));
        footprints.push(footprintKit('privado', anchor));
      }
    }
    // Área = kits en fila con pasillos (witness). Garantiza factibilidad.
    let x = AISLE; let maxH = 0;
    footprints.forEach((f) => { witness.push({ x, y: AISLE, w: f.w, h: f.h }); x += f.w + AISLE; maxH = Math.max(maxH, f.h); });
    const ancho = x; const largo = maxH + 2 * AISLE;
    out.push({ nombre: `gen#${k} ${z.kind}×${nKits}`, factible: true, generado: true, witness, areas: [area(z.zone, z.zone, z.tipo, ancho, largo)], piezas });
  }
  return out;
}
