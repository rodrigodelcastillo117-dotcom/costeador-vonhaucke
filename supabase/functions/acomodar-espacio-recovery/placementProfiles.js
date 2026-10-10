// ============================================================================
//  P0.2c · PLACEMENT PROFILES — conocimiento espacial machine-readable y VERSIONADO.
//
//  NO es un PDF leído dinámicamente ni un prompt: es una fuente estructurada de
//  topología de mobiliario. Dice, por ancla, QUÉ topología tiene (SINGLE_FACE,
//  DOUBLE_FACE, MEETING_TABLE, DESK, RECEPTION) y de DÓNDE sale esa verdad
//  (provenance). Con la topología, el composer coloca sillas en SLOTS (side/facing).
//
//  PRECEDENCIA (una inferencia nunca pisa una verdad confirmada):
//    CATALOG > CURATED_RULE > USER_CONFIRMED > INFERRED > UNKNOWN
//
//  REGLA DURA: la topología NO se infiere de la capacidad. Un bench de 8 NO es
//  double-face por tener 8 puestos; sólo lo es si el ancla lo DECLARA (catálogo/
//  configuración/usuario confirmado). Por defecto (regla curada conservadora) un
//  ANCHOR_WORKSTATION es SINGLE_FACE. Para la mesa de juntas la topología canónica
//  (lados largos + cabeceras) sí es regla curada de oficio.
// ============================================================================
export const PROFILE_VERSION = 'PP_V1';
export const SEAT = 600;

const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
// COT-P1-027c · STORAGE: ancla de guardado independiente (credenza, archivero, librero).
// Sin asientos; su verdad espacial es el FRENTE (puertas/cajones) que necesita holgura.
const topologiasValidas = new Set(['SINGLE_FACE', 'DOUBLE_FACE', 'MEETING_TABLE', 'DESK', 'RECEPTION', 'STORAGE']);

// Precedencia de fuentes de verdad (GAP5). UNKNOWN nunca pisa nada.
const PRECEDENCIA = { CATALOG: 5, CURATED_RULE: 4, USER_CONFIRMED: 3, INFERRED: 2, UNKNOWN: 0 };
const UNKNOWN_PROFILE = { topology: 'UNKNOWN', provenance: 'UNKNOWN', confidence: 0, version: PROFILE_VERSION, fallback_layout_strategy: 'LEGACY_SINGLE_FACE' };

// Resolver DETERMINISTA de candidatos por precedencia (GAP5): CATALOG > CURATED_RULE
// > USER_CONFIRMED > INFERRED > UNKNOWN. Desempate por confianza y luego por nombre.
export function resolvePlacementProfile(candidates = []) {
  const valid = (candidates || []).filter((c) => c && topologiasValidas.has(c.topology) && (PRECEDENCIA[c.provenance] || 0) > 0);
  if (!valid.length) return { ...UNKNOWN_PROFILE };
  valid.sort((a, b) => (PRECEDENCIA[b.provenance] - PRECEDENCIA[a.provenance])
    || ((num(b.confidence, 0)) - (num(a.confidence, 0)))
    || String(a.topology).localeCompare(String(b.topology)));
  const w = valid[0];
  return { topology: w.topology, provenance: w.provenance, confidence: num(w.confidence, 1), version: PROFILE_VERSION, fallback_layout_strategy: null };
}

// Perfil SEMÁNTICO de un ancla. GAP4: si no hay verdad de topología, es UNKNOWN
// (NO SINGLE_FACE "curado"); la geometría se genera con un fallback LEGACY y el
// Semantic Judge debe devolver REVIEW_REQUIRED, nunca FINAL PASS.
export function perfilDeAncla(anchor = {}) {
  const rol = anchor.relation_role;
  const candidatos = [];
  // 1. Topología DECLARADA en la pieza (catálogo/config/usuario confirmado).
  const expl = anchor.topology || anchor.placement_topology || anchor.placement_profile?.topology || null;
  if (expl && topologiasValidas.has(expl)) {
    const prov = anchor.topology_source || anchor.placement_profile?.provenance || 'USER_CONFIRMED';
    candidatos.push({ topology: expl, provenance: prov, confidence: num(anchor.topology_confidence, 1) });
  }
  // 2. Regla CURADA de oficio SÓLO para roles con topología inequívoca. El bench
  //    operativo NO: double vs single no se decide por rol/capacidad (GAP4).
  //    027c: un ANCHOR_STORAGE no tiene asientos; su topología es inequívoca por rol.
  const curada = { ANCHOR_MEETING: 'MEETING_TABLE', ANCHOR_DESK: 'DESK', ANCHOR_RECEPTION: 'RECEPTION', ANCHOR_STORAGE: 'STORAGE' }[rol];
  if (curada) candidatos.push({ topology: curada, provenance: 'CURATED_RULE', confidence: 0.9 });
  const res = resolvePlacementProfile(candidatos);
  if (res.topology === 'UNKNOWN') return { ...UNKNOWN_PROFILE };
  return res;
}

// Rotación determinista del facing cardinal al girar el kit 90° con la convención
// de rotarKit (pos (x,y)→(H-(y+h), x) ≡ dirección (dx,dy)→(-dy,dx)) (GAP3):
//   UP→RIGHT, RIGHT→DOWN, DOWN→LEFT, LEFT→UP.
const FACING_ROT90 = { UP: 'RIGHT', RIGHT: 'DOWN', DOWN: 'LEFT', LEFT: 'UP' };
export function rotarFacing(facing, rot = 90) {
  let f = facing;
  const vueltas = ((Math.round(num(rot) / 90) % 4) + 4) % 4;
  for (let i = 0; i < vueltas; i++) f = FACING_ROT90[f] || f;
  return f;
}

const centrar = (i, count, span) => Math.round(i * (span / count) + Math.max(0, (span / count - SEAT) / 2));

// --- SINGLE_FACE: una fila de sillas bajo el tablero (frente). -----------------
// Ancla en (0,0) w×d; sillas en dy=d. Kit w × (d+SEAT).
export function layoutSingleFace(aw, ad, n) {
  const seats = Array.from({ length: n }, (_, i) => ({ dx: centrar(i, n || 1, aw), dy: ad, w: SEAT, d: SEAT, slot_id: `seat_F${i + 1}`, side: 'FRONT', facing: 'UP' }));
  return { anchor: { dx: 0, dy: 0, w: aw, d: ad }, seats, kitW: aw, kitD: n > 0 ? ad + SEAT : ad };
}

// --- DOUBLE_FACE: dos filas enfrentadas (A arriba, B abajo), 4+4 para 8. --------
// Ancla baja a dy=SEAT; fila A en dy=0 (mira hacia abajo), fila B en dy=SEAT+ad
// (mira hacia arriba). Kit w × (d+2·SEAT).
export function layoutDoubleFace(aw, ad, n) {
  const nA = Math.ceil(n / 2), nB = n - nA;
  const filaA = Array.from({ length: nA }, (_, i) => ({ dx: centrar(i, nA || 1, aw), dy: 0, w: SEAT, d: SEAT, slot_id: `seat_A${i + 1}`, side: 'A', facing: 'DOWN' }));
  const filaB = Array.from({ length: nB }, (_, i) => ({ dx: centrar(i, nB || 1, aw), dy: SEAT + ad, w: SEAT, d: SEAT, slot_id: `seat_B${i + 1}`, side: 'B', facing: 'UP' }));
  return { anchor: { dx: 0, dy: SEAT, w: aw, d: ad }, seats: [...filaA, ...filaB], kitW: aw, kitD: ad + 2 * SEAT, activeSides: ['A', 'B'] };
}

// --- MEETING_TABLE: topología canónica = 2 lados largos + 2 cabeceras. ----------
// Para cap 10 → 4+4+1+1. Ancla centrada en (SEAT,SEAT). Kit (w+2SEAT)×(d+2SEAT).
export function layoutMeeting(aw, ad, n) {
  const nHeads = n >= 4 ? 2 : 0;
  const nLong = n - nHeads;
  const nA = Math.ceil(nLong / 2), nB = nLong - nA;
  const seats = [];
  for (let i = 0; i < nA; i++) seats.push({ dx: SEAT + centrar(i, nA || 1, aw), dy: 0, w: SEAT, d: SEAT, slot_id: `side_A_${i + 1}`, side: 'A', facing: 'DOWN' });
  for (let i = 0; i < nB; i++) seats.push({ dx: SEAT + centrar(i, nB || 1, aw), dy: SEAT + ad, w: SEAT, d: SEAT, slot_id: `side_B_${i + 1}`, side: 'B', facing: 'UP' });
  const headY = SEAT + Math.max(0, Math.round((ad - SEAT) / 2));
  if (nHeads >= 1) seats.push({ dx: 0, dy: headY, w: SEAT, d: SEAT, slot_id: 'head_A', side: 'HEAD_A', facing: 'RIGHT' });
  if (nHeads >= 2) seats.push({ dx: SEAT + aw, dy: headY, w: SEAT, d: SEAT, slot_id: 'head_B', side: 'HEAD_B', facing: 'LEFT' });
  return { anchor: { dx: SEAT, dy: SEAT, w: aw, d: ad }, seats: seats.slice(0, n), kitW: aw + 2 * SEAT, kitD: ad + 2 * SEAT, activeSides: ['A', 'B', 'HEAD_A', 'HEAD_B'] };
}

// --- STORAGE (027c): sólo el ancla; el FRENTE (puertas/cajones) mira hacia abajo en
// coordenadas del kit (frontFacing 'UP' = el lado de acceso es el de abajo, misma
// convención que clearanceAcceso para sillas). Al rotar el kit, el frente gira.
export function layoutStorage(aw, ad) {
  return { anchor: { dx: 0, dy: 0, w: aw, d: ad, facing: 'UP' }, seats: [], kitW: aw, kitD: ad, activeSides: ['FRONT'] };
}

// Selecciona el layout de asientos según la topología del perfil.
export function layoutDeTopologia(topology, aw, ad, n) {
  switch (topology) {
    case 'DOUBLE_FACE': return layoutDoubleFace(aw, ad, n);
    case 'MEETING_TABLE': return layoutMeeting(aw, ad, n);
    case 'STORAGE': return layoutStorage(aw, ad);
    case 'SINGLE_FACE':
    case 'DESK':
    case 'RECEPTION':
    default: return layoutSingleFace(aw, ad, n);
  }
}
