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
const topologiasValidas = new Set(['SINGLE_FACE', 'DOUBLE_FACE', 'MEETING_TABLE', 'DESK', 'RECEPTION']);

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
  const curada = { ANCHOR_MEETING: 'MEETING_TABLE', ANCHOR_DESK: 'DESK', ANCHOR_RECEPTION: 'RECEPTION' }[rol];
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
// ACOMODO 10 · VH-A10-03: las cabeceras sólo cuando los lados largos NO alcanzan. Cada lado largo recibe
// una silla cada PITCH_JUNTAS (650 mm, la separación de siempre del solver); si ahí caben todas, no se
// sienta a nadie en la cabecera. Es lo que dibujan los planos del laboratorio (C3 "3 arriba + 3 abajo",
// C2 "3+3", C5 "6+6"): antes la Eclipse de 12 salía 5+5+2 y la cabecera quedaba frente a la puerta con
// 100 mm de acceso. 8 en 2.40 m (3 por lado) sigue siendo 3+3+1+1.
export const PITCH_JUNTAS = 650;
export function layoutMeeting(aw, ad, n) {
  const porLado = Math.max(1, Math.floor(num(aw) / PITCH_JUNTAS));
  const nHeads = n >= 4 && n > 2 * porLado ? 2 : 0;
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

// --- DESK (VH-119): escritorio privado = ejecutivo DETRÁS del tablero (lado BACK, mira hacia el
// escritorio/abajo) y visitas AL FRENTE (lado FRONT, miran hacia arriba). Antes el escritorio usaba la
// fila única (SINGLE_FACE) y el ejecutivo quedaba sentado JUNTO a sus visitas, del mismo lado; el juez
// semántico, además, no admitía visitas en un escritorio → todo despacho caía en NEEDS_SEMANTIC_REVIEW.
// `roles` (en el orden de las sillas) decide qué asiento es ejecutivo; sin roles, el primero lo es.
// Kit: w × (acceso+SEAT si hay ejecutivo + d + SEAT si hay visitas). Misma SEAT=600 de siempre; no se inventa nada.
// El kit reserva además la franja de ACCESO del ejecutivo detrás de su silla (ACCESO_EJECUTIVO = 600 mm,
// el mismo objetivo de confort del QualityJudge): sin ella el barrido por filas pegaba la silla al muro
// (clearance 0 → fail duro de acceso) y el selector prefería un candidato centrado que dejaba la credenza
// sin colocar. Las visitas acceden por el frente (lado libre del cuarto), no necesitan franja en el kit.
export const ACCESO_EJECUTIVO = 600;
export function layoutDesk(aw, ad, n, roles = null) {
  const rs = Array.isArray(roles) && roles.length ? roles.slice(0, n) : Array.from({ length: n }, (_, i) => (i === 0 ? 'EXECUTIVE_SEAT' : 'VISITOR_SEAT'));
  const nExec = rs.filter((r) => r === 'EXECUTIVE_SEAT').length;
  const nVis = rs.length - nExec;
  const anchorDy = nExec ? ACCESO_EJECUTIVO + SEAT : 0;
  const back = Array.from({ length: nExec }, (_, i) => ({ dx: centrar(i, nExec || 1, aw), dy: ACCESO_EJECUTIVO, w: SEAT, d: SEAT, slot_id: `seat_X${i + 1}`, side: 'BACK', facing: 'DOWN' }));
  const front = Array.from({ length: nVis }, (_, i) => ({ dx: centrar(i, nVis || 1, aw), dy: anchorDy + ad, w: SEAT, d: SEAT, slot_id: `seat_F${i + 1}`, side: 'FRONT', facing: 'UP' }));
  // Los asientos salen en el MISMO orden que `roles` (componerKit asigna sillas[i] → seats[i]).
  let ib = 0, iF = 0;
  const seats = rs.map((r) => (r === 'EXECUTIVE_SEAT' ? back[ib++] : front[iF++]));
  return { anchor: { dx: 0, dy: anchorDy, w: aw, d: ad }, seats, kitW: aw, kitD: ad + anchorDy + (nVis ? SEAT : 0), activeSides: [...(nExec ? ['BACK'] : []), ...(nVis ? ['FRONT'] : [])] };
}

// Selecciona el layout de asientos según la topología del perfil. `roles`: relation_role de las
// sillas en orden (sólo lo usa DESK para distinguir ejecutivo de visitas).
export function layoutDeTopologia(topology, aw, ad, n, roles = null) {
  switch (topology) {
    case 'DOUBLE_FACE': return layoutDoubleFace(aw, ad, n);
    case 'MEETING_TABLE': return layoutMeeting(aw, ad, n);
    case 'DESK': return layoutDesk(aw, ad, n, roles);
    case 'SINGLE_FACE':
    case 'RECEPTION':
    default: return layoutSingleFace(aw, ad, n);
  }
}
