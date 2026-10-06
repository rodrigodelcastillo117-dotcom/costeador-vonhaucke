// ============================================================================
// acomodar-espacio v8 · planner IA + validador espacial DETERMINISTA.
//
// Conserva hardening vivo: JWT, roles, rate-limit, input bounds, geometría real,
// semántica, invariante, observabilidad y repair-loop <= 3.
// V8: barrido verificable de puertas + ProductRevision spatial_spec resuelto
// SERVER-SIDE + score espacial + fail-closed donde falta evidencia de puerta.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { canonicalZoneRole, canonicalProductRole, semanticVerdict as semanticVerdictCanonical } from "./spatial-semantics.js";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { planearDeterminista } from "./acomodo-core.js";
import {
  auditarPuertas,
  bloqueaPuertaEspacial,
  evaluarCalidad,
  requiereClearance,
  usoInvadido,
} from "./spatial-core.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    colocacion: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" }, area: { type: "number" }, x: { type: "number" },
          y: { type: "number" }, rot: { type: "number", enum: [0, 90] },
        },
        required: ["id", "area", "x", "y", "rot"],
      },
    },
    zonas: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          area: { type: "number" }, nombre: { type: "string" }, x: { type: "number" }, y: { type: "number" },
          ancho: { type: "number" }, largo: { type: "number" },
        },
        required: ["area", "nombre", "x", "y", "ancho", "largo"],
      },
    },
    caben: { type: "boolean" },
    resumen: { type: "string" },
    notas: { type: "array", items: { type: "string" } },
  },
  required: ["colocacion", "zonas", "caben", "resumen", "notas"],
};

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
}
const n = (x: any) => Number(x);
const finite = (x: any) => Number.isFinite(Number(x));
const norm = (s: any) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function bbox(points: any[]) {
  const xs = (points || []).map((p) => n(p?.x ?? p?.[0])).filter(Number.isFinite);
  const ys = (points || []).map((p) => n(p?.y ?? p?.[1])).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
function pointInPoly(x: number, y: number, pts: any[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = n(pts[i]?.x ?? pts[i]?.[0]), yi = n(pts[i]?.y ?? pts[i]?.[1]);
    const xj = n(pts[j]?.x ?? pts[j]?.[0]), yj = n(pts[j]?.y ?? pts[j]?.[1]);
    const hit = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}
function areaGeometry(a: any) {
  if (a?.forma === "circulo" || a?.shape === "circulo" || a?.shape === "circle") {
    const c = a.circulo || a.circle_mm || {};
    const r = n(c.r ?? c.radius_mm), cx = n(c.cx ?? r), cy = n(c.cy ?? r);
    return { kind: "circle", cx, cy, r, width: r * 2, depth: r * 2, offsetX: cx - r, offsetY: cy - r };
  }
  const pts = Array.isArray(a?.puntos) ? a.puntos
    : Array.isArray(a?.points_mm) ? a.points_mm
      : Array.isArray(a?.poly) ? a.poly.map((p: any) => ({ x: p?.[0], y: p?.[1] })) : [];
  if (pts.length >= 3) {
    const b = bbox(pts)!;
    return { kind: "polygon", pts, width: b.maxX - b.minX, depth: b.maxY - b.minY, offsetX: b.minX, offsetY: b.minY };
  }
  return {
    kind: "rect",
    width: n(a?.ancho ?? a?.width_mm ?? a?.width),
    depth: n(a?.largo ?? a?.depth_mm ?? a?.depth ?? a?.height),
    offsetX: 0, offsetY: 0,
  };
}
function zoneRole(a: any) { return canonicalZoneRole(a); }
function productRole(p: any) { return canonicalProductRole(p); }
function semanticVerdict(pr: string, zr: string) { return semanticVerdictCanonical(pr, zr); }
function insideArea(x: number, y: number, w: number, d: number, g: any) {
  if (x < 0 || y < 0 || x + w > g.width || y + d > g.depth) return false;
  if (g.kind === "rect") return true;
  const samples = [[x,y],[x+w,y],[x,y+d],[x+w,y+d],[x+w/2,y+d/2]];
  if (g.kind === "circle") {
    const cx = g.cx - g.offsetX, cy = g.cy - g.offsetY;
    return samples.every(([sx, sy]) => Math.hypot(sx - cx, sy - cy) <= g.r + 1e-6);
  }
  const pts = (g.pts || []).map((p: any) => ({ x: n(p?.x ?? p?.[0]) - g.offsetX, y: n(p?.y ?? p?.[1]) - g.offsetY }));
  return samples.every(([sx, sy]) => pointInPoly(sx, sy, pts));
}
function overlap(a: any, b: any) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;
}
function obstacles(area: any) {
  return (area?.obstaculos || area?.obstacles || []).map((o: any) => ({
    id: o?.id || null,
    x: n(o?.x), y: n(o?.y), w: n(o?.w ?? o?.width), d: n(o?.d ?? o?.h ?? o?.height),
  })).filter((o: any) => [o.x,o.y,o.w,o.d].every(Number.isFinite) && o.w > 0 && o.d > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Usa POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  const URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!key || !URL || !SERVICE) return json({ ok: false, code: "SERVER_CONFIG", error: "Falta configuracion del servidor." }, 500);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ ok: false, code: "UNAUTHENTICATED", error: "No autenticado." }, 401);
  const uc = createClient(URL, ANON || SERVICE, { global: { headers: { Authorization: auth } } });
  const { data: ud, error: ue } = await uc.auth.getUser();
  const email = ud?.user?.email || "";
  if (ue || !email) return json({ ok: false, code: "UNAUTHENTICATED", error: "Sesion invalida." }, 401);

  const svc = createClient(URL, SERVICE);
  const { data: permit } = await svc.from("permitidos").select("rol").eq("email", email).maybeSingle();
  const rol = norm(permit?.rol);
  if (!permit || !["direccion", "diseno", "vendedor"].includes(rol)) return json({ ok: false, code: "FORBIDDEN", error: "Sin permiso para acomodar espacios." }, 403);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ ok: false, code: "INVALID_JSON", error: "JSON invalido." }, 400); }
  const areas = Array.isArray(body?.areas) ? body.areas : (body?.area ? [body.area] : []);
  const raw = Array.isArray(body?.piezas) ? body.piezas : [];
  if (!areas.length || !raw.length) return json({ ok: false, code: "INVALID_INPUT", error: "Se requieren areas y piezas." }, 400);
  if (areas.length > 100 || raw.length > 500) return json({ ok: false, code: "INPUT_TOO_LARGE", error: "Demasiadas areas o piezas." }, 413);

  const desde = new Date(Date.now() - 3_600_000).toISOString();
  const [uCnt, gCnt] = await Promise.all([
    svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", "acomodar-espacio").eq("email", email).gte("created_at", desde),
    svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", "acomodar-espacio").gte("created_at", desde),
  ]);
  if (uCnt.error || gCnt.error) return json({ ok: false, code: "RATE_LIMITER_UNAVAILABLE", error: "No se pudo verificar el limite de uso." }, 503);
  if ((uCnt.count ?? 0) >= 30) return json({ ok: false, code: "RATE_LIMITED_USER", error: "Limite de 30 acomodos por hora." }, 429);
  if ((gCnt.count ?? 0) >= 200) return json({ ok: false, code: "RATE_LIMITED_GLOBAL", error: "Demasiados acomodos en este momento." }, 429);

  const excluded = raw.filter((p: any) => p?.excluded === true || p?.excluida === true);
  const active = raw.filter((p: any) => !(p?.excluded === true || p?.excluida === true));
  const ids = new Set<string>();
  const pieceMap = new Map<string, any>();
  const inputIssues: any[] = [];
  for (let i = 0; i < active.length; i++) {
    const p = active[i] || {};
    const id = String(p.id || "").trim();
    const w = n(p.w ?? p.width_mm ?? p.ancho_mm), d = n(p.d ?? p.depth_mm ?? p.fondo_mm);
    if (!id) inputIssues.push({ field: `piezas[${i}].id`, code: "MISSING_ID" });
    else if (ids.has(id)) inputIssues.push({ field: `piezas[${i}].id`, code: "DUPLICATE_ID", value: id });
    else ids.add(id);
    if (!finite(w) || !finite(d) || w <= 0 || d <= 0) inputIssues.push({ field: `piezas[${i}]`, code: "INVALID_FOOTPRINT", id });
    pieceMap.set(id, { ...p, id, w, d, product_role: productRole(p) });
  }
  const areaMeta = areas.map((a: any, i: number) => {
    const g = areaGeometry(a);
    return { ...a, _i: i, _g: g, zone_role: zoneRole(a), nombre: a?.nombre || a?.name || `Area ${i + 1}` };
  });
  for (const a of areaMeta) if (!finite(a._g.width) || !finite(a._g.depth) || a._g.width <= 0 || a._g.depth <= 0) inputIssues.push({ field: `areas[${a._i}]`, code: "INVALID_AREA_GEOMETRY" });
  if (inputIssues.length) return json({ ok: false, code: "INVALID_INPUT", issues: inputIssues }, 400);

  // ProductRevision authority: for versioned pieces, the browser is NOT allowed
  // to choose the canonical spatial contract. Resolve it server-side through a
  // seller-safe RPC that returns only version_id + spatial_spec.
  const versionIds = [...new Set(active
    .map((p: any) => n(p?.producto_version_id ?? p?.productoVersionId ?? p?.version_id))
    .filter((v: number) => Number.isInteger(v) && v > 0))];
  const specByVersion = new Map<string, any>();
  if (versionIds.length) {
    const { data: specRows, error: specErr } = await svc.rpc("spatial_specs_para_versiones", { p_version_ids: versionIds });
    if (specErr) return json({ ok: false, code: "CANONICAL_SPATIAL_SOURCE_UNAVAILABLE", error: "No se pudo resolver el contrato espacial de ProductRevision." }, 503);
    for (const row of (Array.isArray(specRows) ? specRows : [])) {
      if (row?.version_id != null && row?.spatial_spec && typeof row.spatial_spec === "object") specByVersion.set(String(row.version_id), row.spatial_spec);
    }
  }
  let versionedPieces = 0, canonicalSpatialPieces = 0;
  for (const p0 of active) {
    const id = String(p0.id || "").trim();
    const p = pieceMap.get(id);
    if (!p) continue;
    const vid = n(p0?.producto_version_id ?? p0?.productoVersionId ?? p0?.version_id);
    if (Number.isInteger(vid) && vid > 0) {
      versionedPieces++;
      p.producto_version_id = vid;
      delete p.spatial_spec;
      const canonical = specByVersion.get(String(vid));
      if (canonical) { p.spatial_spec = canonical; canonicalSpatialPieces++; }
    }
  }
  const canonicalPieces = active.map((p: any) => pieceMap.get(String(p.id))).filter(Boolean);

  const cleanPieces = canonicalPieces.map((p: any) => ({
    id: String(p.id), nombre: String(p.nombre || "Mueble"),
    w: n(p.w), d: n(p.d), tipo: String(p.tipo || p.product_role || "mueble"),
    ...(p.spatial_spec ? { spatial_spec: p.spatial_spec } : {}),
  }));
  const cleanAreas = areaMeta.map((a: any) => ({
    nombre: a.nombre, ancho: Math.round(a._g.width), largo: Math.round(a._g.depth),
    zone_role: a.zone_role,
    puertas: Array.isArray(a.puertas) ? a.puertas.length : 0,
  }));
  const areasTxt = cleanAreas.map((a: any, i: number) => `[${i}] ${a.nombre}: ${a.ancho} x ${a.largo} mm; rol=${a.zone_role}; puertas=${a.puertas}`).join("\n");
  const lista = cleanPieces.map((p: any) => `${p.id}: ${p.nombre} - ${Math.round(p.w)}x${Math.round(p.d)} mm (${p.tipo})${p.spatial_spec ? `; spatial=${JSON.stringify(p.spatial_spec)}` : ""}`).join("\n");
  const baseSystem = `Eres un space planner senior. PROPONES un layout, pero un validador determinista decide si sirve. Nunca inventes piezas ni omitas IDs. Coordenadas locales por area, x/y en mm, rot 0/90. Cada pieza completa debe quedar dentro de su area y sin traslapes. Respeta semantica: recepcion en recepcion, mesa de juntas en juntas, benches en area operativa, escritorio direccion en oficina privada. Si una pieza incluye spatial, respeta sus clearances/anclas/preferencias. No coloques muebles cerca de puertas si su barrido no es claro. Si no cabe todo, caben=false; NO reduzcas cantidades. Pasillos objetivo >=1000 mm y detras de sillas >=900 mm.\n\nAREAS:\n${areasTxt}\n\nPIEZAS:\n${lista}`;

  let ultimaUsage: any = null;
  async function llamarIA(system: string) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25_000);
    let r: Response;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-opus-5", max_tokens: 4000,
          output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
          system,
          messages: [{ role: "user", content: [{ type: "text", text: "Acomoda estos muebles con circulación y uso realistas." }] }],
        }),
        signal: ac.signal,
      });
    } finally { clearTimeout(timer); }
    const data = await r.json();
    if (data?.type === "error") throw Object.assign(new Error(data.error?.message || "Error del modelo"), { http: 502, code: "MODEL_ERROR" });
    if (data?.stop_reason === "max_tokens") throw Object.assign(new Error("El acomodo se corto. Divide la corrida."), { http: 422, code: "MODEL_TRUNCATED" });
    ultimaUsage = data?.usage || ultimaUsage;
    const txt = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
    try { return JSON.parse(txt); }
    catch { throw Object.assign(new Error("La IA no devolvio un acomodo valido."), { http: 422, code: "INVALID_MODEL_JSON" }); }
  }

  function evaluar(plan: any) {
    const placements = Array.isArray(plan?.colocacion) ? plan.colocacion : [];
    const issues: any[] = [], reviews: any[] = [], seen = new Set<string>(), valid: any[] = [];

    for (let i = 0; i < placements.length; i++) {
      const c = placements[i] || {};
      const id = String(c.id || ""), p = pieceMap.get(id);
      if (!p) { issues.push({ field: `colocacion[${i}].id`, code: "UNKNOWN_PIECE", value: id }); continue; }
      if (seen.has(id)) { issues.push({ field: `colocacion[${i}].id`, code: "DUPLICATE_PLACEMENT", value: id }); continue; }
      seen.add(id);
      const ai = n(c.area), x = n(c.x), y = n(c.y), rot = n(c.rot);
      if (!Number.isInteger(ai) || ai < 0 || ai >= areaMeta.length) { issues.push({ field: `colocacion[${i}].area`, code: "INVALID_AREA_INDEX", id }); continue; }
      if (!finite(x) || !finite(y) || x < 0 || y < 0 || ![0, 90].includes(rot)) { issues.push({ field: `colocacion[${i}]`, code: "INVALID_COORDINATES", id }); continue; }
      const w = rot === 90 ? p.d : p.w, d = rot === 90 ? p.w : p.d, a = areaMeta[ai];
      if (!insideArea(x, y, w, d, a._g)) { issues.push({ field: `colocacion[${i}]`, code: "OUTSIDE_ZONE", id, area: ai }); continue; }
      const sv = semanticVerdict(p.product_role, a.zone_role);
      if (sv.level === "FAIL") issues.push({ field: `colocacion[${i}]`, code: sv.code, id, product_role: p.product_role, zone_role: a.zone_role, zone: a.nombre });
      else if (sv.level === "REVIEW") reviews.push({ field: `colocacion[${i}]`, code: sv.code, id, product_role: p.product_role, zone_role: a.zone_role, zone: a.nombre });
      valid.push({ id, area: ai, x, y, rot, w, d, product_role: p.product_role, zone_role: a.zone_role });
    }
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        if (valid[i].area === valid[j].area && overlap(valid[i], valid[j])) issues.push({ code: "OVERLAP", a: valid[i].id, b: valid[j].id, area: valid[i].area });
      }
    }

    const rectsByArea: Record<string, any[]> = {};
    for (const v of valid) (rectsByArea[v.area] ||= []).push({ id: v.id, x: v.x, y: v.y, w: v.w, d: v.d });
    for (const v of valid) {
      const p = pieceMap.get(v.id), a = areas[v.area];
      const rect = { id: v.id, x: v.x, y: v.y, w: v.w, d: v.d };
      const puertas = a?.puertas || a?.doors || [];
      if (puertas.some((d: any) => bloqueaPuertaEspacial(rect, d))) issues.push({ code: "BLOCKS_DOOR", id: v.id, area: v.area });
      if (requiereClearance(p)) {
        const inv = usoInvadido({ area: a, pieza: p, rot: v.rot, rect, otros: rectsByArea[v.area] || [], obstaculos: obstacles(a) });
        if (inv) issues.push({ code: "FUNCTIONAL_CLEARANCE", id: v.id, area: v.area, collision: inv.tipo, with_id: inv.id || null });
      }
    }

    const invalidIds = new Set<string>(issues.map((q) => q.id).filter(Boolean));
    for (const q of issues) if (q.code === "OVERLAP") { invalidIds.add(q.a); invalidIds.add(q.b); }
    const placedIds = new Set(valid.filter((v) => !invalidIds.has(v.id)).map((v) => v.id));
    const unplaced = canonicalPieces.filter((p: any) => !placedIds.has(String(p.id))).map((p: any) => String(p.id));
    const excludedIds = excluded.map((p: any) => String(p.id || "")).filter(Boolean);
    const requested = raw.length, placed = placedIds.size;

    for (const id of unplaced) {
      if (!issues.some((q) => q.id === id || q.a === id || q.b === id)) issues.push({ code: "MISSING_PLACEMENT", id });
    }
    if (requested !== placed + unplaced.length + excludedIds.length) issues.push({ code: "PLACEMENT_INVARIANT_BROKEN", requested, placed, unplaced: unplaced.length, excluded: excludedIds.length });
    if (plan?.caben === true && unplaced.length) issues.push({ code: "CLAIMED_ALL_FIT_BUT_UNPLACED", unplaced });

    const doors = auditarPuertas(areas);
    const porPieza = canonicalPieces.map((p: any) => ({ id: String(p.id), ok: placedIds.has(String(p.id)) }));
    const quality = evaluarCalidad(areas, canonicalPieces, placements, porPieza);
    return { plan, valid, issues, reviews, placedIds, unplaced, excludedIds, requested, placed, doors, quality };
  }

  function motivosPorPieza(ev: any) {
    const porPieza: Record<string, string[]> = {};
    const push = (id: any, code: string) => { if (!id) return; (porPieza[id] ||= []).push(code); };
    for (const q of ev.issues) { if (q.id) push(q.id, q.code); if (q.a) push(q.a, q.code); if (q.b) push(q.b, q.code); }
    return ev.unplaced.map((id: string) => ({
      id, codigos: porPieza[id] || ["NO_VALID_PLACEMENT"],
      motivo: (porPieza[id] || ["sin ubicacion valida tras 3 intentos"]).join(", "),
    }));
  }
  function mejorQue(a: any, b: any) {
    if (!b) return true;
    if (a.placed !== b.placed) return a.placed > b.placed;
    const hardA = a.issues.filter((q: any) => q.code !== "MISSING_PLACEMENT").length;
    const hardB = b.issues.filter((q: any) => q.code !== "MISSING_PLACEMENT").length;
    if (hardA !== hardB) return hardA < hardB;
    return Number(a?.quality?.score || 0) > Number(b?.quality?.score || 0);
  }

  // FAST PATH: semántica + geometría + clearances primero, sin pagar latencia LLM.
  // La IA deja de ser el planner primario y pasa a ser repair/fallback.
  const solverAreas = areaMeta.map((a: any) => ({
    ...a,
    ancho: Math.round(a._g.width),
    largo: Math.round(a._g.depth),
    ...(a._g.kind === "polygon"
      ? { polygon: (a._g.pts || []).map((p: any) => [n(p?.x ?? p?.[0]) - a._g.offsetX, n(p?.y ?? p?.[1]) - a._g.offsetY]) }
      : {}),
  }));
  const solverPieces = canonicalPieces.map((p: any) => {
    const ranked = areaMeta
      .map((a: any, ai: number) => ({ ai, v: semanticVerdict(p.product_role, a.zone_role) }))
      .filter((x: any) => x.v.level !== "FAIL")
      .sort((a: any, b: any) => (a.v.level === "PASS" ? 0 : 1) - (b.v.level === "PASS" ? 0 : 1) || a.ai - b.ai);
    const allowedAreas = ranked.map((x: any) => x.ai);
    return { ...p, allowedAreas, ...(allowedAreas.length ? { area: allowedAreas[0] } : {}) };
  });
  const det = planearDeterminista(solverAreas, solverPieces, { gapMM: 150, stepMM: 100 });
  const detPlan = {
    colocacion: det.colocacion,
    zonas: cleanAreas.map((a: any, area: number) => ({ area, nombre: a.nombre, x: 0, y: 0, ancho: a.ancho, largo: a.largo })),
    caben: det.noColocadas.length === 0,
    resumen: det.noColocadas.length ? "Acomodo determinista parcial; IA sólo reparará lo pendiente." : "Acomodo determinista válido.",
    notas: [],
  };
  let best: any = evaluar(detPlan);
  const detHard = best.issues.filter((q: any) => q.code !== "MISSING_PLACEMENT");
  const deterministicPass = detHard.length === 0 && best.unplaced.length === 0;

  for (let intento = 1; intento <= (deterministicPass ? 0 : 2); intento++) {
    let plan: any;
    try {
      const system = baseSystem
        + `\n\nREPARACION ${intento}. El solver determinista ya propuso una base. Corrige EXACTAMENTE estas violaciones:\n`
        + best.issues.slice(0, 50).map((q: any) => `- ${q.code}${q.id ? ` (pieza ${q.id})` : ""}${q.a ? ` (${q.a} vs ${q.b})` : ""}`).join("\n")
        + `\n\nMANTEN EXACTAS estas colocaciones ya validas (NO las muevas):\n`
        + JSON.stringify(best.valid.filter((v: any) => best.placedIds.has(v.id)).map((v: any) => ({ id: v.id, area: v.area, x: v.x, y: v.y, rot: v.rot })))
        + `\n\nReposiciona SOLO las piezas con violacion. NO inventes muebles, NO cambies cantidades, NO reduzcas piezas para hacerlo caber. Devuelve TODAS las piezas.`;
      plan = await llamarIA(system);
    } catch (e: any) {
      if (!best) return json({ ok: false, code: e?.code || "MODEL_UNAVAILABLE", error: e?.message || "No se pudo generar el acomodo." }, e?.http || 502);
      break;
    }
    const ev = evaluar(plan);
    if (mejorQue(ev, best)) best = ev;
    const hard = ev.issues.filter((q: any) => q.code !== "MISSING_PLACEMENT");
    if (!hard.length && !ev.unplaced.length) break;
  }

  const hardIssues = best.issues.filter((q: any) => q.code !== "MISSING_PLACEMENT");
  const doorsVerified = best.doors?.verificadas === true;
  const status = hardIssues.length === 0
    ? (best.unplaced.length ? "PARTIAL" : (best.reviews.length || !doorsVerified ? "REVIEW_REQUIRED" : "PASS"))
    : (best.placed ? "PARTIAL" : "FAIL");
  const noColocadas = motivosPorPieza(best);
  const renderReady = status === "PASS";

  const layoutSpec = {
    version: "PLACEMENT_SPEC_V2",
    status,
    requested: best.requested,
    placed: best.placed,
    unplaced: best.unplaced,
    excluded: best.excludedIds,
    placements: best.valid.filter((v: any) => best.placedIds.has(v.id)).map(({ w, d, ...rest }: any) => rest),
    areas: areaMeta.map((a: any) => ({ index: a._i, name: a.nombre, zone_role: a.zone_role, width_mm: a._g.width, depth_mm: a._g.depth, shape: a._g.kind })),
    validation: {
      issues: best.issues,
      reviews: best.reviews,
      render_ready: renderReady,
      invariant_ok: best.requested === best.placed + best.unplaced.length + best.excludedIds.length,
      doors: best.doors,
      quality: best.quality,
      product_revision_spatial: {
        versioned_pieces: versionedPieces,
        canonical_specs_resolved: canonicalSpatialPieces,
        missing_specs: Math.max(0, versionedPieces - canonicalSpatialPieces),
        authority: "SERVER_PRODUCT_REVISION",
      },
    },
  };

  try {
    await svc.from("ai_eventos").insert({
      request_id: crypto.randomUUID(), fn: "acomodar-espacio", email, rol, modo: "repair-loop-v8",
      images_count: 0, payload_bytes: 0,
      status: status === "PASS" ? "ok" : status === "FAIL" ? "failed" : "partial",
      http_status: 200, finished_at: new Date().toISOString(),
    });
  } catch (_e) {}

  const planLimpio = {
    ...(best.plan || {}),
    colocacion: best.valid.filter((v: any) => best.placedIds.has(v.id)).map((v: any) => ({ id: v.id, area: v.area, x: v.x, y: v.y, rot: v.rot })),
    caben: status === "PASS",
  };
  const recomendaciones = [
    ...(best.unplaced.length ? ["Mover a otra area · cambiar el producto por uno mas chico · acomodar a mano. No se reducen cantidades ni se inventan muebles."] : []),
    ...(!doorsVerified ? ["Confirma bisagra, sentido y arco de las puertas pendientes antes de liberar render/PDF oficial."] : []),
  ];

  return json({
    ok: true,
    plan: planLimpio,
    uso: ultimaUsage,
    layoutSpec,
    strictPlacement: true,
    render_ready: renderReady,
    completo: status === "PASS",
    aprobable: renderReady,
    colocadas: best.placed,
    total: best.requested,
    noColocadas,
    recomendaciones,
    calidad: best.quality,
    puertas: best.doors,
    metodo: deterministicPass ? "deterministic_semantic_spatial_v9" : "deterministic_first_ai_repair_v9",
  }, 200);
});
