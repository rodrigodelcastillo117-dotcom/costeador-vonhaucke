// ============================================================================
//  REGLA CANÓNICA del vínculo dependiente → ancla  ·  FINAL-100
//  ----------------------------------------------------------------------------
//  ÚNICA fuente de verdad compartida por el NAVEGADOR (src/datos/acomodoInvariantes.js)
//  y el SERVIDOR (supabase/functions/acomodar-espacio-recovery/recovery-core.js, vía
//  import de este mismo archivo). El navegador y el servidor deben concluir EXACTAMENTE
//  lo mismo para: ancla correcta / equivocada / ausente / no colocada / otra habitación /
//  límites de distancia / múltiples anclas / reorder / SUPPORT_STORAGE exento.
//
//  NO relaja overlap, circulación (min_pasillo_mm) ni ninguna otra restricción: esto es
//  SÓLO el vínculo dependiente→ancla (distancia máxima + resolución del ancla).
// ============================================================================

export const PISO_ANCLA_MM = 1200;

export const esAnclaRol = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
export const esDepRol = (r) =>
  ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT', 'UNDERDESK_STORAGE', 'SUPPORT_STORAGE'].includes(r);

/**
 * Distancia máxima permitida DEPENDIENTE → ANCLA, canónica.
 * Usa la distancia ESPECÍFICA que el programa declara en `max_anchor_distance_mm`
 * (semántica verificada: es la misma que el solver usa en acomodo-core.js como
 *  "si dist(dependiente, ancla) > max_anchor_distance_mm ⇒ no cabe funcionalmente"),
 * con PISO de 1200 mm. Ausente, no finita o < 1200 ⇒ 1200.
 * NUNCA es circulación (CONTRATO.min_pasillo_mm) ni separación entre muebles (gap).
 * @param {{max_anchor_distance_mm?:number}} req  requerimiento/pieza del dependiente
 * @returns {number} umbral en mm
 */
export function maxDistanceToAnchor(req) {
  const d = Number(req && req.max_anchor_distance_mm);
  return Number.isFinite(d) && d > PISO_ANCLA_MM ? d : PISO_ANCLA_MM;
}

/** Distancia borde-a-borde entre dos rects {x,y,w,h}. Fórmula ÚNICA (no duplicar). */
export function distanciaRects(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}

/**
 * Índice de ANCLAS colocadas para resolución canónica, robusto a las dos representaciones:
 *   · servidor POST-kit-solver: el dependiente trae anchor_instance_id = id de COLOCACIÓN del ancla;
 *   · navegador PRE-solver / mock: el dependiente trae un token de requerimiento y comparte
 *     functional_group_id con su ancla.
 * @param {Array<{idColoc:(string|number), rect:object, area:number, rol:string,
 *                id?:any, instance_id?:any, anchor_instance_id?:any, functional_group_id?:any}>} placed
 */
export function indexarAnclas(placed) {
  const porClave = new Map(); // idColoc | id | instance_id | anchor_instance_id (de un ANCLA) → idColoc
  const porGrupo = new Map(); // functional_group_id → [idColoc]
  const rect = new Map();     // idColoc → {rect, area, rol}
  for (const p of placed) {
    const idc = String(p.idColoc);
    rect.set(idc, { rect: p.rect, area: Number(p.area), rol: p.rol });
    if (esAnclaRol(p.rol)) {
      for (const k of [p.idColoc, p.id, p.instance_id, p.anchor_instance_id]) {
        if (k != null && !porClave.has(String(k))) porClave.set(String(k), idc);
      }
      if (p.functional_group_id != null) {
        const fg = String(p.functional_group_id);
        if (!porGrupo.has(fg)) porGrupo.set(fg, []);
        porGrupo.get(fg).push(idc);
      }
    }
  }
  return { porClave, porGrupo, rect };
}

/**
 * Evalúa el vínculo de UN dependiente contra el índice de anclas. Devuelve un issue o null.
 * Mismo veredicto en navegador y servidor (misma función). Códigos: DEPENDENT_DETACHED /
 * DEPENDENT_UNASSIGNED. 'otra habitación' = ancla en otra área ⇒ DETACHED.
 * @param {{idColoc:(string|number), rect:object, area:number, rol:string,
 *          declared:(string|number|null), functional_group_id?:any, max_anchor_distance_mm?:number}} dep
 * @param {{porClave:Map, porGrupo:Map, rect:Map}} idx
 */
export function evaluarVinculoDependiente(dep, idx) {
  if (!esDepRol(dep.rol)) return null;
  const umbral = maxDistanceToAnchor(dep);
  const decl = dep.declared != null ? String(dep.declared) : null;

  // (1) VÍNCULO FUERTE: el token declarado resuelve a un ANCLA colocada (id/instance/placement).
  //     Es lo que ve el servidor tras el kit-solver → misma área + distancia ≤ umbral contra ESA ancla.
  if (decl) {
    const idA = idx.porClave.get(decl);
    const anc = idA != null ? idx.rect.get(idA) : null;
    if (anc && esAnclaRol(anc.rol)) {
      if (anc.area !== Number(dep.area) || distanciaRects(dep.rect, anc.rect) > umbral) {
        return { code: 'DEPENDENT_DETACHED', severity: 'fail', id: String(dep.idColoc), area: Number(dep.area) };
      }
      return null;
    }
    // El token no es un ancla colocada: token de requerimiento PRE-solver. Cae a inferencia por grupo.
  }

  // (2) SUPPORT_STORAGE SUELTA (sin vínculo resoluble): kit propio, exenta (VH-096).
  if (dep.rol === 'SUPPORT_STORAGE') return null;

  // (3) INFERENCIA POR functional_group_id (ancla y dependiente comparten grupo en el programa).
  const fg = dep.functional_group_id != null ? String(dep.functional_group_id) : null;
  if (!fg) {
    // decl presente pero sin placement ni grupo → ancla declarada no colocada.
    // decl ausente y sin grupo → dependiente sin dueño.
    return decl
      ? { code: 'DEPENDENT_DETACHED', severity: 'fail', id: String(dep.idColoc), motivo: 'ancla no colocada' }
      : { code: 'DEPENDENT_UNASSIGNED', severity: 'fail', id: String(dep.idColoc) };
  }
  const mismaArea = (idx.porGrupo.get(fg) || []).map((id) => idx.rect.get(id)).filter((a) => a && a.area === Number(dep.area));
  if (!mismaArea.length) return null; // ningún ancla del grupo en su área: problema de ZONA (cubierto aparte)
  const dMin = Math.min(...mismaArea.map((a) => distanciaRects(dep.rect, a.rect)));
  if (dMin > umbral) return { code: 'DEPENDENT_DETACHED', severity: 'fail', id: String(dep.idColoc), area: Number(dep.area), inferida: true };
  return null;
}
