// ============================================================================
//  Edge Function: analizar-negocio · v2 (2026-10-11, aprobación expresa de Dirección: A1+A2)
//  La VOZ de Voni: recibe `senales` YA CALCULADAS por el cliente y sólo las explica.
//  NO consulta cifras de negocio ni calcula nada: si no viene en `senales`, no existe.
//
//  v2 = v1 + el MISMO wrapper de seguridad que leer-plano (VH-069) + reglas y
//  aprendizajes LEÍDOS DE LA BASE, no del body (VH-060):
//    · JWT real + rol permitido para cualquier alcance; `alcance:'negocio'` sigue
//      exigiendo direccion | diseno (candado original de v1).
//    · Límite fail-closed 30/h usuario · 200/h global, contado en ai_eventos.
//    · ai_eventos al INICIO y cierre con estado.
//    · REGLAS DE LA CASA = public.reglas activas (ámbito 'negocio' o 'general').
//    · LO QUE YA TE CORRIGIERON = public.aprendizajes activos y aprobado_para_ia.
//      Si la base no responde: 503 CONTEXTO_UNAVAILABLE (no se habla con reglas vacías).
//    · `reglas`/`aprendizajes` del body se IGNORAN.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
const FN = "analizar-negocio";
const LIMITE_USUARIO = 30, LIMITE_GLOBAL = 200, MAX_APRENDIZAJES = 25;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    mensaje: {
      type: "string",
      description: "2 a 4 frases, en español llano ('lenguaje de taller, no de contador'). Prioriza lo más importante primero. Si no hay nada que avisar, dilo tranquilo en una frase.",
    },
  },
  required: ["mensaje"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Usa POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  const URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!key) return json({ ok: false, code: "SERVER_CONFIG", error: "Falta ANTHROPIC_API_KEY" }, 500);
  if (!URL || !SERVICE) return json({ ok: false, code: "SERVER_CONFIG", error: "Falta configuración del servidor." }, 500);

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
  if (!["direccion", "diseno", "vendedor"].includes(rol)) return json({ ok: false, code: "FORBIDDEN_CAPABILITY", error: "Tu rol no puede usar a Voni." }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, code: "INVALID_JSON", error: "JSON invalido" }, 400); }
  const { senales, alcance } = body || {};
  if (!Array.isArray(senales)) return json({ ok: false, code: "MISSING_SIGNALS", error: "Faltan las señales." }, 400);
  if (senales.length > 200) return json({ ok: false, code: "PAYLOAD_TOO_LARGE", error: "Demasiadas señales." }, 413);
  const esNegocio = alcance === "negocio";
  // Candado original de v1: las cifras del negocio sólo las explica a quien puede verlas.
  if (esNegocio && rol !== "direccion" && rol !== "diseno") return json({ ok: false, code: "FORBIDDEN_CAPABILITY", error: "solo-direccion" }, 403);

  const desde = new Date(Date.now() - 3_600_000).toISOString();
  const [uCount, gCount] = await Promise.all([
    svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", FN).eq("email", email).gte("created_at", desde),
    svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", FN).gte("created_at", desde),
  ]);
  if (uCount.error || gCount.error) return json({ ok: false, code: "RATE_LIMITER_UNAVAILABLE", error: "No se pudo verificar el límite de uso de Voni." }, 503);
  if ((uCount.count ?? 0) >= LIMITE_USUARIO) return json({ ok: false, code: "RATE_LIMITED_USER", error: `Límite de ${LIMITE_USUARIO} consultas a Voni por hora.` }, 429);
  if ((gCount.count ?? 0) >= LIMITE_GLOBAL) return json({ ok: false, code: "RATE_LIMITED_GLOBAL", error: "Demasiadas consultas a Voni en este momento." }, 429);

  const requestId = crypto.randomUUID();
  const t0 = Date.now();
  const senalesTxt = JSON.stringify(senales);
  let eventId: number | null = null;
  try {
    const { data: ev } = await svc.from("ai_eventos").insert({
      request_id: requestId, fn: FN, email, rol, modo: esNegocio ? "negocio" : "cotizacion",
      images_count: 0, payload_bytes: senalesTxt.length, user_input_chars: senalesTxt.length,
      model_id: "claude-opus-5", effort: "medium", max_tokens: 2000, status: "started",
    }).select("id").maybeSingle();
    eventId = (ev as any)?.id ?? null;
  } catch (_e) {}
  const finish = async (status: string, http: number, code?: string, extra: Record<string, unknown> = {}) => {
    if (eventId == null) return;
    try {
      await svc.from("ai_eventos").update({ status, http_status: http, finished_at: new Date().toISOString(), duration_ms: Date.now() - t0, error_code: code || null, ...extra }).eq("id", eventId);
    } catch (_e) {}
  };

  const [rq, aq] = await Promise.all([
    svc.from("reglas").select("ambito, texto").eq("activa", true).in("ambito", ["negocio", "general"]).order("ambito"),
    svc.from("aprendizajes").select("texto, veces").eq("activo", true).eq("aprobado_para_ia", true).order("veces", { ascending: false, nullsFirst: false }).limit(MAX_APRENDIZAJES),
  ]);
  if (rq.error || aq.error) {
    await finish("error", 503, "CONTEXTO_UNAVAILABLE");
    return json({ ok: false, code: "CONTEXTO_UNAVAILABLE", error: "No se pudieron leer las reglas de la casa. Reintenta en un momento.", request_id: requestId }, 503);
  }
  const reglas = (rq.data || []).map((r: any) => "· " + String(r.texto || "").trim()).filter((s: string) => s.length > 2);
  const aprendizajes = (aq.data || []).map((a: any) => "· " + String(a.texto || "").trim()).filter((s: string) => s.length > 2);

  const system =
    "Eres Voni, el asistente de Von Haucke (mobiliario de oficina). Aquí no armas muebles: " +
    "explicas, en español llano ('lenguaje de taller, no de contador'), lo que ya se calculó de " +
    "un proyecto o del negocio.\n\n" +
    "REGLAS:\n" +
    "1) SOLO puedes hablar de lo que viene en 'SEÑALES' abajo. Nunca inventes un número, un " +
    "porcentaje o un nombre de línea/cliente que no esté ahí — si algo no viene en las señales, " +
    "no existe para ti.\n" +
    "2) Si hay varias señales, prioriza: primero lo que es dinero perdido o riesgo real (margen " +
    "bajo, precio sin verificar), después lo informativo.\n" +
    "3) Nunca decides ni aplicas nada (nunca dices 'ya bajé el precio' o 'ya apliqué el " +
    "descuento') — solo sugieres, con el número al lado, para que una persona decida.\n" +
    "4) Si el arreglo de señales viene vacío, dilo tranquilo en una frase (algo como 'por ahora " +
    "no veo nada que avisarte aquí') — no inventes un problema para tener qué decir.\n" +
    "5) 2 a 4 frases. Nada de vocabulario de reporte financiero.\n\n" +
    (reglas.length ? "\n\nREGLAS DE LA CASA (las dicta la Direccion de Von Haucke y MANDAN sobre cualquier criterio anterior):\n" + reglas.join("\n") + "\n" : "") +
    (aprendizajes.length ? "\n\nLO QUE YA TE CORRIGIERON ANTES:\n" + aprendizajes.join("\n") + "\n" : "") +
    "\nSEÑALES (JSON: [{tipo: 'roja'|'ambar', texto}]):\n" + senalesTxt;

  const apiBody = {
    model: "claude-opus-5",
    max_tokens: 2000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system,
    messages: [{ role: "user", content: [{ type: "text", text: `Alcance: ${esNegocio ? "el negocio en general" : "esta cotización"}. Dime qué debo saber.` }] }],
  };

  let data: any; let providerStatus = 0;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(apiBody),
    });
    providerStatus = r.status;
    data = await r.json();
  } catch (e) {
    await finish("error", 502, "PROVIDER_UNREACHABLE");
    return json({ ok: false, code: "PROVIDER_UNREACHABLE", error: "No se pudo llamar a Claude: " + String(e), request_id: requestId }, 502);
  }
  const tokens = { input_tokens: data?.usage?.input_tokens ?? null, output_tokens: data?.usage?.output_tokens ?? null, provider_http_status: providerStatus, model_status: data?.stop_reason || data?.type || null };

  if (data?.type === "error") { await finish("error", 502, "CLAUDE_API_ERROR", tokens); return json({ ok: false, code: "CLAUDE_API_ERROR", error: data.error?.message || "Error de la API", request_id: requestId }, 502); }
  if (data?.stop_reason === "refusal") { await finish("refused", 200, "MODEL_REFUSAL", tokens); return json({ ok: false, code: "MODEL_REFUSAL", error: "Voni no pudo armar una respuesta.", request_id: requestId }, 200); }
  if (data?.stop_reason === "max_tokens") { await finish("error", 200, "MODEL_TRUNCATED", tokens); return json({ ok: false, code: "MODEL_TRUNCATED", error: "La respuesta salió muy larga y se cortó.", request_id: requestId }, 200); }

  const txt = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let propuesta: any;
  try { propuesta = JSON.parse(txt); }
  catch { await finish("error", 200, "INVALID_MODEL_JSON", tokens); return json({ ok: false, code: "INVALID_MODEL_JSON", error: "Voni no devolvió una respuesta válida. Reintenta.", request_id: requestId }, 200); }

  await finish("ok", 200, undefined, tokens);
  return json({ ok: true, propuesta, uso: data?.usage || null, request_id: requestId, contexto: { reglas: reglas.length, aprendizajes: aprendizajes.length, fuente: "base" } });
});
