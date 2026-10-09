// ============================================================================
// leer-plano · WRAPPER SEGURO de producción.
// Auth + permisos + límites + observabilidad + validación determinista FloorSpec.
// La visión vive en `leer-plano-core`; este archivo nunca confía ciegamente en IA.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validarProgramaObservado } from "./observed-core.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
const finite = (x: any) => Number.isFinite(Number(x));
const num = (x: any) => Number(x);
const PROV = new Set(["MEASURED","DERIVED","INFERRED","ASSUMED"]);
const provenance = (x: any) => {
  const p = String(x || "").toUpperCase();
  return PROV.has(p) ? p : "UNKNOWN";
};
const evidenceMeta = (x: any) => ({
  provenance: provenance(x?.procedencia),
  evidence: typeof x?.evidencia === "string" ? x.evidencia.slice(0, 500) : "",
  page: Number.isInteger(Number(x?.pagina)) && Number(x?.pagina) > 0 ? Number(x.pagina) : null,
  confidence: x?.confianza || null,
});
const b64bytes = (s: string) => {
  const n = (s || "").length;
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(n * 3 / 4) - pad);
};
function polygonArea(points: any[]) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    a += num(p.x) * num(q.y) - num(q.x) * num(p.y);
  }
  return Math.abs(a) / 2;
}
function areaOf(a: any) {
  if (a?.forma === "circulo") {
    const r = num(a?.circulo?.r);
    return finite(r) && r > 0 ? Math.PI * r * r : 0;
  }
  return polygonArea(a?.puntos || []);
}
function roleOf(tipo: string) {
  const t = String(tipo || "").toLowerCase();
  return ({ open: "operational", privado: "private_office", juntas: "meeting", recepcion: "reception", lounge: "lounge", servicio: "service" } as Record<string,string>)[t] || "unknown";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Usa POST" }, 405);

  const URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!URL || !SERVICE) return json({ ok: false, code: "SERVER_CONFIG", error: "Falta configuración del servidor." }, 500);

  // Seguridad viva de producción: JWT real + rol permitido. No se delega al front.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, code: "UNAUTHENTICATED", error: "No autenticado." }, 401);
  const userClient = createClient(URL, ANON || SERVICE, { global: { headers: { Authorization: authHeader } } });
  const { data: ud, error: ue } = await userClient.auth.getUser();
  const email = ud?.user?.email || "";
  if (ue || !email) return json({ ok: false, code: "UNAUTHENTICATED", error: "Sesión inválida." }, 401);

  const svc = createClient(URL, SERVICE);
  const { data: permit, error: pe } = await svc.from("permitidos").select("rol").eq("email", email).maybeSingle();
  if (pe || !permit) return json({ ok: false, code: "FORBIDDEN", error: "Usuario no autorizado." }, 403);
  const rol = String(permit.rol || "").toLowerCase();
  if (!["direccion", "diseno", "vendedor"].includes(rol)) return json({ ok: false, code: "FORBIDDEN_CAPABILITY", error: "Tu rol no puede leer planos." }, 403);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ ok: false, code: "INVALID_JSON", error: "JSON inválido." }, 400); }

  const image = typeof body?.image === "string" ? body.image : "";
  const mediaType = String(body?.mediaType || "image/jpeg");
  const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (!image) return json({ ok: false, code: "MISSING_IMAGE", error: "Falta el plano." }, 400);
  if (!MIME_OK.has(mediaType)) return json({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE", error: "Formato no soportado." }, 415);
  const bytes = b64bytes(image);
  if (bytes > 25_000_000) return json({ ok: false, code: "PAYLOAD_TOO_LARGE", error: "El plano excede 25 MB decodificados." }, 413);
  if (body?.refMM != null && (!finite(body.refMM) || num(body.refMM) <= 0 || num(body.refMM) > 1_000_000)) {
    return json({ ok: false, code: "INVALID_REFERENCE", error: "refMM debe ser una medida positiva razonable." }, 400);
  }

  // Límite fail-closed: si el contador no responde, no se llama al modelo.
  const desde = new Date(Date.now() - 3_600_000).toISOString();
  const [uCount, gCount] = await Promise.all([
    svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", "leer-plano").eq("email", email).gte("created_at", desde),
    svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", "leer-plano").gte("created_at", desde),
  ]);
  if (uCount.error || gCount.error) return json({ ok: false, code: "RATE_LIMITER_UNAVAILABLE", error: "No se pudo verificar el límite de lectura de planos." }, 503);
  if ((uCount.count ?? 0) >= 30) return json({ ok: false, code: "RATE_LIMITED_USER", error: "Límite de 30 lecturas de plano por hora." }, 429);
  if ((gCount.count ?? 0) >= 200) return json({ ok: false, code: "RATE_LIMITED_GLOBAL", error: "Demasiadas lecturas de plano en este momento." }, 429);

  const requestId = crypto.randomUUID();
  const t0 = Date.now();
  let eventId: number | null = null;
  try {
    const { data: ev } = await svc.from("ai_eventos").insert({
      request_id: requestId, fn: "leer-plano", email, rol,
      modo: mediaType === "application/pdf" ? "pdf" : "imagen",
      images_count: 1, payload_bytes: bytes, status: "started",
    }).select("id").maybeSingle();
    eventId = (ev as any)?.id ?? null;
  } catch (_e) {}
  const finish = async (status: string, http: number, code?: string) => {
    if (eventId == null) return;
    try {
      await svc.from("ai_eventos").update({
        status, http_status: http, finished_at: new Date().toISOString(),
        duration_ms: Date.now() - t0, error_code: code || null,
      }).eq("id", eventId);
    } catch (_e) {}
  };

  // Core separado: el secreto del modelo no necesita vivir en este wrapper.
  let upstream: Response;
  try {
    upstream = await fetch(`${URL}/functions/v1/leer-plano-core`, {
      method: "POST",
      headers: { "content-type": "application/json", "Authorization": authHeader, "apikey": ANON || SERVICE },
      body: JSON.stringify(body),
    });
  } catch (_e) {
    await finish("error", 502, "UPSTREAM_UNREACHABLE");
    return json({ ok: false, code: "UPSTREAM_UNREACHABLE", error: "No se pudo contactar el lector de planos.", request_id: requestId }, 502);
  }

  let data: any;
  try { data = await upstream.json(); }
  catch {
    await finish("error", 502, "UPSTREAM_INVALID_JSON");
    return json({ ok: false, code: "UPSTREAM_INVALID_JSON", error: "El lector no devolvió JSON válido.", request_id: requestId }, 502);
  }
  if (!upstream.ok || !data?.ok) {
    await finish("error", upstream.status || 502, data?.code || "UPSTREAM_ERROR");
    return json({ ...data, request_id: requestId }, upstream.status || 502);
  }

  // ------------------------------------------------------------------------
  // FloorSpec: toda salida de IA se revalida de manera determinista.
  // ------------------------------------------------------------------------
  const l = data.lectura || {};
  const issues: any[] = [];
  const warnings: any[] = [];
  const W = num(l?.envolvente?.ancho), H = num(l?.envolvente?.largo);
  if (!finite(W) || !finite(H) || W <= 0 || H <= 0 || W > 500_000 || H > 500_000) issues.push({ field: "envolvente", code: "INVALID_ENVELOPE" });
  const envelopeEvidence = evidenceMeta(l?.envolvente);
  if (envelopeEvidence.provenance === "ASSUMED") warnings.push({ field: "envolvente", code: "ASSUMED_CRITICAL_GEOMETRY", message: "La envolvente depende de un supuesto; requiere confirmación antes de liberar." });
  if (envelopeEvidence.provenance === "UNKNOWN") warnings.push({ field: "envolvente", code: "UNKNOWN_GEOMETRY_PROVENANCE", message: "La procedencia de la envolvente no quedó estructurada." });

  const gh = Array.isArray(l?.grid?.horizontal) ? l.grid.horizontal : [];
  const gv = Array.isArray(l?.grid?.vertical) ? l.grid.vertical : [];
  const badGrid = [...gh, ...gv].some((x: any) => !finite(x) || num(x) <= 0);
  if (badGrid) issues.push({ field: "grid", code: "INVALID_GRID_SEGMENT" });
  const sumH = gh.reduce((a: number, x: any) => a + num(x), 0);
  const sumV = gv.reduce((a: number, x: any) => a + num(x), 0);
  if (l?.tieneCotas && finite(W) && gh.length) {
    const tol = Math.max(50, W * 0.01);
    if (Math.abs(sumH - W) > tol) issues.push({ field: "grid.horizontal", code: "GRID_ENVELOPE_MISMATCH", sum_mm: sumH, envelope_mm: W, tolerance_mm: tol });
  }
  if (l?.tieneCotas && finite(H) && gv.length) {
    const tol = Math.max(50, H * 0.01);
    if (Math.abs(sumV - H) > tol) issues.push({ field: "grid.vertical", code: "GRID_ENVELOPE_MISMATCH", sum_mm: sumV, envelope_mm: H, tolerance_mm: tol });
  }
  if (l?.tieneCotas && (!gh.length || !gv.length)) warnings.push({ field: "grid", code: "COTAS_WITHOUT_COMPLETE_GRID" });
  if (!l?.tieneCotas) warnings.push({ field: "tieneCotas", code: "NO_DIMENSION_AUTHORITY", message: "Plano estimado: requiere referencia real antes de liberar." });

  const areas = Array.isArray(l?.areas) ? l.areas : [];
  if (!areas.length) issues.push({ field: "areas", code: "NO_AREAS" });
  const nameList = areas.map((a: any) => String(a?.nombre || "").trim()).filter(Boolean);
  const names = new Set(nameList);
  if (names.size !== nameList.length) issues.push({ field: "areas", code: "DUPLICATE_ZONE_NAME" });
  let topArea = 0;
  const normalizedZones: any[] = [];

  for (let i = 0; i < areas.length; i++) {
    const a = areas[i] || {};
    const name = String(a.nombre || "").trim();
    if (!name) issues.push({ field: `areas[${i}].nombre`, code: "MISSING_ZONE_NAME" });
    if (!["poligono","circulo"].includes(a.forma)) issues.push({ field: `areas[${i}].forma`, code: "INVALID_SHAPE" });
    const parent = String(a.dentroDe || "").trim();
    if (parent && !names.has(parent)) issues.push({ field: `areas[${i}].dentroDe`, code: "UNKNOWN_PARENT_ZONE", value: parent });
    if (parent && parent === name) issues.push({ field: `areas[${i}].dentroDe`, code: "SELF_PARENT_ZONE" });
    const puestos = num(a.puestos);
    if (!Number.isInteger(puestos) || puestos < 0 || puestos > 10000) issues.push({ field: `areas[${i}].puestos`, code: "INVALID_WORKSTATION_COUNT" });
    if (String(a.confianza || "").toLowerCase() === "baja") warnings.push({ field: `areas[${i}]`, code: "LOW_CONFIDENCE_ZONE", zone: name });

    if (a.forma === "poligono") {
      const pts = Array.isArray(a.puntos) ? a.puntos : [];
      if (pts.length < 3) issues.push({ field: `areas[${i}].puntos`, code: "POLYGON_NEEDS_3_POINTS" });
      for (let j = 0; j < pts.length; j++) {
        const x = num(pts[j]?.x), y = num(pts[j]?.y);
        if (!finite(x) || !finite(y)) issues.push({ field: `areas[${i}].puntos[${j}]`, code: "NON_FINITE_POINT" });
        else if (finite(W) && finite(H) && (x < 0 || y < 0 || x > W || y > H)) issues.push({ field: `areas[${i}].puntos[${j}]`, code: "POINT_OUTSIDE_ENVELOPE", x, y });
      }
      if (polygonArea(pts) <= 1) issues.push({ field: `areas[${i}].puntos`, code: "ZERO_AREA_POLYGON" });
    } else if (a.forma === "circulo") {
      const cx = num(a?.circulo?.cx), cy = num(a?.circulo?.cy), r = num(a?.circulo?.r);
      if (![cx,cy,r].every(finite) || r <= 0) issues.push({ field: `areas[${i}].circulo`, code: "INVALID_CIRCLE" });
      else if (finite(W) && finite(H) && (cx-r < 0 || cy-r < 0 || cx+r > W || cy+r > H)) issues.push({ field: `areas[${i}].circulo`, code: "CIRCLE_OUTSIDE_ENVELOPE" });
    }

    const sqm = areaOf(a) / 1_000_000;
    if (!parent) topArea += sqm;
    normalizedZones.push({
      id: `zone_${i+1}`, source_index: i, name, source_tipo: a.tipo,
      zone_role: roleOf(a.tipo), shape: a.forma,
      points_mm: a.forma === "poligono" ? a.puntos : [],
      circle_mm: a.forma === "circulo" ? a.circulo : null,
      parent_name: parent || null, observed_workstations: puestos,
      confidence: a.confianza, area_m2: Math.round(sqm * 100) / 100,
      evidence: evidenceMeta(a),
    });
    const aProv = provenance(a?.procedencia);
    if (aProv === "ASSUMED") warnings.push({ field: `areas[${i}]`, code: "ASSUMED_ZONE_GEOMETRY", zone: name, message: "Geometría de zona basada en supuesto; requiere confirmación." });
  }

  const envArea = finite(W) && finite(H) ? (W * H / 1_000_000) : 0;
  if (envArea > 0 && topArea > envArea * 1.08) issues.push({ field: "areas", code: "TOP_LEVEL_AREA_EXCEEDS_ENVELOPE", top_level_m2: Math.round(topArea*100)/100, envelope_m2: Math.round(envArea*100)/100 });

  // Puertas: x/y/ancho siguen siendo hard geometry. El barrido incompleto NO se
  // inventa: baja el FloorSpec a REVIEW_REQUIRED y bloquea liberación automática.
  const doors = Array.isArray(l?.puertas) ? l.puertas : [];
  if (!doors.length) warnings.push({ field: "puertas", code: "NO_DOORS_DETECTED" });
  let verifiedDoors = 0;
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i] || {};
    const dEvidence = evidenceMeta(d);
    const x = num(d.x), y = num(d.y), w = num(d.ancho);
    if (dEvidence.provenance === "ASSUMED") warnings.push({ field: `puertas[${i}]`, code: "ASSUMED_DOOR_GEOMETRY", message: "Puerta basada en supuesto; requiere confirmación." });
    if (![x,y,w].every(finite) || w <= 0) issues.push({ field: `puertas[${i}]`, code: "INVALID_DOOR" });
    else if (finite(W) && finite(H) && (x < 0 || y < 0 || x > W || y > H || w > Math.max(W,H))) issues.push({ field: `puertas[${i}]`, code: "DOOR_OUTSIDE_ENVELOPE" });

    if (d.tieneBarrido === true) {
      const dir = String(d.sentido || "");
      const sw = num(d.barridoDeg);
      if (![d.bisagraX, d.bisagraY, d.anguloCerradaDeg, sw].every(finite) || sw <= 0 || !["horario", "antihorario"].includes(dir)) {
        issues.push({ field: `puertas[${i}]`, code: "INVALID_DOOR_SWING_EVIDENCE" });
      } else {
        const hx = num(d.bisagraX), hy = num(d.bisagraY);
        if (finite(W) && finite(H) && (hx < 0 || hy < 0 || hx > W || hy > H)) issues.push({ field: `puertas[${i}]`, code: "DOOR_HINGE_OUTSIDE_ENVELOPE" });
        else verifiedDoors++;
      }
    } else {
      warnings.push({ field: `puertas[${i}]`, code: "DOOR_SWING_UNVERIFIED", message: "Puerta detectada sin bisagra/sentido/arco verificable." });
    }
  }

  // ------------------------------------------------------------------------
  // observed_program: la visión PROPONE mobiliario observado; el servidor lo
  // revalida de forma determinista (P0-R8-2). Un item inválido NO cuenta como
  // real: baja la lectura a REVIEW_REQUIRED, nunca libera solo.
  // ------------------------------------------------------------------------
  const zoneNameSet = new Set(normalizedZones.map((z: any) => String(z.name || "")).filter(Boolean));
  // P1-R10-14: pasa maxPage SÓLO si el lector reportó un conteo real de páginas
  // (lectura.paginas / lectura.num_paginas). Hoy el core NO lo emite → queda
  // undefined y PAGINA_FUERA_DE_RANGO NO se afirma cubierto en integración viva.
  const paginasReportadas = Number(l?.paginas ?? l?.num_paginas ?? l?.pages);
  const maxPage = Number.isInteger(paginasReportadas) && paginasReportadas > 0 ? paginasReportadas : undefined;
  const observed = validarProgramaObservado(
    Array.isArray(data?.observed_program) ? data.observed_program
      : (Array.isArray(l?.observed_program) ? l.observed_program : null),
    { envelopeW: finite(W) ? W : undefined, envelopeH: finite(H) ? H : undefined, zoneNames: zoneNameSet, maxPage },
  );
  if (observed.state === "REVIEW_REQUIRED") {
    warnings.push({ field: "observed_program", code: "OBSERVED_PROGRAM_REVIEW_REQUIRED", invalid: observed.metrics.invalidos, total: observed.metrics.total });
  }

  const validationState = issues.length ? "FAIL" : warnings.length ? "REVIEW_REQUIRED" : "PASS";
  const floorSpec = {
    version: "FLOOR_SPEC_V2",
    envelope: { width_mm: W, depth_mm: H, area_m2: Math.round(envArea * 100) / 100, evidence: envelopeEvidence },
    grid_mm: { horizontal: gh, vertical: gv },
    zones: normalizedZones,
    doors_mm: doors.map((d: any) => ({ ...d, evidence_meta: evidenceMeta(d) })),
    source: {
      scale_evidence: l?.escala || "",
      has_dimensions: !!l?.tieneCotas,
      notes: Array.isArray(l?.notas) ? l.notas : [],
      evidence_policy: "MEASURED>DERIVED>INFERRED>ASSUMED",
    },
    observed_program: observed.items,
    observed_validation: { state: observed.state, issues: observed.issues, warnings: observed.warnings, metrics: observed.metrics },
    validation: {
      state: validationState, issues, warnings,
      metrics: {
        top_level_area_m2: Math.round(topArea*100)/100,
        envelope_area_m2: Math.round(envArea*100)/100,
        zones: areas.length, doors: doors.length,
        doors_verified: verifiedDoors,
        doors_unverified: Math.max(0, doors.length - verifiedDoors),
        observed_items: observed.metrics.total,
        observed_valid: observed.metrics.observados,
        observed_invalid: observed.metrics.invalidos,
      },
    },
  };

  if (issues.length) {
    await finish("rejected", 422, "FLOOR_SPEC_INVALID");
    return json({ ok: false, code: "FLOOR_SPEC_INVALID", error: "La lectura del plano no pasó la validación geométrica determinista.", lectura: l, floorSpec, request_id: requestId }, 422);
  }

  await finish("ok", 200, validationState === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : undefined);
  // El observed_program del nivel superior es el REVALIDADO por el servidor, no
  // el crudo de la IA: el consumidor nunca recibe mobiliario sin revalidar.
  return json({ ...data, observed_program: observed.items, request_id: requestId, floorSpec, strictGeometry: true }, 200);
});
