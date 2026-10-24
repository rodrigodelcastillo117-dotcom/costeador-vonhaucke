// ============================================================================
// Edge Function: cotizar-texto · v13 (2026-10-11, aprobación expresa de Dirección: A1+A2)
// Texto natural -> renglones estructurados. La IA interpreta; el motor fija precio.
//
// v13 = v12 (desplegada por Rodrigo el 2026-10-10: ruta/producto separados, cierre de
// aclaraciones, cero extras sugeridos cobrables) + el MISMO wrapper de seguridad que
// leer-plano (VH-069) + reglas y aprendizajes LEÍDOS DE LA BASE, no del body (VH-060):
//   · JWT real + rol permitido (direccion | diseno | vendedor); nada se delega al front.
//   · Límite fail-closed: 30/h por usuario y 200/h global, contados en ai_eventos.
//   · ai_eventos al INICIO (cuenta también los intentos que fallan) y cierre con estado.
//   · REGLAS DE LA CASA = public.reglas activas (ámbito 'cotizacion' o 'general').
//   · CORRECCIONES APRENDIDAS = public.aprendizajes activos y aprobado_para_ia, por veces.
//     Si la base no responde, NO se cotiza con reglas vacías: 503 CONTEXTO_UNAVAILABLE.
//   · `reglas`/`aprendizajes` del body se IGNORAN (compatibilidad: el cliente viejo las manda).
// Respaldo exacto de v12 para rollback: en la sesión de auditoría del 2026-10-11.
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
const FN = "cotizar-texto";
const LIMITE_USUARIO = 30, LIMITE_GLOBAL = 200, MAX_APRENDIZAJES = 25;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      description: "Una entrada por cada producto/renglon que pide el usuario.",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          ruta: { type: "string", description: "CLAVE EXACTA de la linea del catalogo, SOLA (ej. 'applt', 'eclipse', 'mox'). NUNCA 'linea/producto'." },
          producto: { type: "string", description: "ID EXACTO del producto dentro de esa linea (ej. 'banca_doble', 'escritorio', 'pedestal'), NO su nombre descriptivo." },
          cantidad: { type: "number" },
          seleccion: { type: "array", items: { type: "object", additionalProperties: false,
            properties: { clave: { type: "string" }, valor: { type: "string" } }, required: ["clave", "valor"] } },
          etiqueta: { type: "string" }, confianza: { type: "string", enum: ["alta", "media", "baja"] },
          nota: { type: "string" }, sugerido: { type: "boolean" }, material_override: { type: "string" },
        },
        required: ["ruta", "producto", "cantidad", "seleccion", "etiqueta", "confianza", "nota"],
      },
    },
    banco: { type: "array", items: { type: "object", additionalProperties: false,
      properties: { id: { type: "string" }, cantidad: { type: "number" }, etiqueta: { type: "string" }, nota: { type: "string" }, sugerido: { type: "boolean" } },
      required: ["id", "cantidad", "etiqueta", "nota"] } },
    preguntas: { type: "array", items: { type: "string" } },
    resumen: { type: "string" },
    noEncontrado: { type: "array", items: { type: "string" } },
  },
  required: ["items", "banco", "preguntas", "resumen", "noEncontrado"],
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

  // --- Seguridad viva: JWT real + rol permitido (igual que leer-plano). ---
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
  if (!["direccion", "diseno", "vendedor"].includes(rol)) return json({ ok: false, code: "FORBIDDEN_CAPABILITY", error: "Tu rol no puede cotizar con IA." }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, code: "INVALID_JSON", error: "JSON invalido" }, 400); }
  const { texto, catalogo } = body || {};
  if (!texto || !String(texto).trim()) return json({ ok: false, code: "MISSING_TEXT", error: "Falta el texto a cotizar." }, 400);
  if (!catalogo) return json({ ok: false, code: "MISSING_CATALOG", error: "Falta el catalogo." }, 400);
  const textoCompleto = String(texto);
  const catalogoTxt = JSON.stringify(catalogo);
  if (catalogoTxt.length > 400_000) return json({ ok: false, code: "PAYLOAD_TOO_LARGE", error: "El catálogo es demasiado grande." }, 413);

  // --- Límite fail-closed: si el contador no responde, no se llama al modelo. ---
  const desde = new Date(Date.now() - 3_600_000).toISOString();
  const [uCount, gCount] = await Promise.all([
    svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", FN).eq("email", email).gte("created_at", desde),
    svc.from("ai_eventos").select("id", { count: "exact", head: true }).eq("fn", FN).gte("created_at", desde),
  ]);
  if (uCount.error || gCount.error) return json({ ok: false, code: "RATE_LIMITER_UNAVAILABLE", error: "No se pudo verificar el límite de cotizaciones con IA." }, 503);
  if ((uCount.count ?? 0) >= LIMITE_USUARIO) return json({ ok: false, code: "RATE_LIMITED_USER", error: `Límite de ${LIMITE_USUARIO} cotizaciones con IA por hora.` }, 429);
  if ((gCount.count ?? 0) >= LIMITE_GLOBAL) return json({ ok: false, code: "RATE_LIMITED_GLOBAL", error: "Demasiadas cotizaciones con IA en este momento." }, 429);

  // --- Telemetría al INICIO: cuenta también lo que falla después. ---
  const requestId = crypto.randomUUID();
  const t0 = Date.now();
  let eventId: number | null = null;
  try {
    const { data: ev } = await svc.from("ai_eventos").insert({
      request_id: requestId, fn: FN, email, rol, modo: "texto",
      images_count: 0, payload_bytes: textoCompleto.length + catalogoTxt.length,
      user_input_chars: textoCompleto.length, catalog_chars: catalogoTxt.length,
      model_id: "claude-opus-5", effort: "medium", max_tokens: 8000, status: "started",
    }).select("id").maybeSingle();
    eventId = (ev as any)?.id ?? null;
  } catch (_e) {}
  const finish = async (status: string, http: number, code?: string, extra: Record<string, unknown> = {}) => {
    if (eventId == null) return;
    try {
      await svc.from("ai_eventos").update({
        status, http_status: http, finished_at: new Date().toISOString(),
        duration_ms: Date.now() - t0, error_code: code || null, ...extra,
      }).eq("id", eventId);
    } catch (_e) {}
  };

  // --- Contexto de la casa, DESDE LA BASE (VH-060). El body no manda reglas. ---
  const [rq, aq] = await Promise.all([
    svc.from("reglas").select("ambito, texto").eq("activa", true).in("ambito", ["cotizacion", "general"]).order("ambito"),
    svc.from("aprendizajes").select("texto, veces").eq("activo", true).eq("aprobado_para_ia", true).order("veces", { ascending: false, nullsFirst: false }).limit(MAX_APRENDIZAJES),
  ]);
  if (rq.error || aq.error) {
    await finish("error", 503, "CONTEXTO_UNAVAILABLE");
    return json({ ok: false, code: "CONTEXTO_UNAVAILABLE", error: "No se pudieron leer las reglas de la casa. Reintenta en un momento.", request_id: requestId }, 503);
  }
  const reglas = (rq.data || []).map((r: any) => "· " + String(r.texto || "").trim()).filter((s: string) => s.length > 2);
  const aprendizajes = (aq.data || []).map((a: any) => "· " + String(a.texto || "").trim() + ((a.veces || 1) > 1 ? ` (te lo han corregido ${a.veces} veces)` : "")).filter((s: string) => s.length > 2);

  const rondasAclaracion = (textoCompleto.match(/(?:^|\n)\s*Aclaraciones?\s*:/gi) || []).length;
  const cierreAclaraciones = rondasAclaracion >= 2
    ? "\n12) CIERRE DE ACLARACIONES (OBLIGATORIO): ya hay DOS o mas bloques 'Aclaraciones:'. NO hagas mas preguntas. preguntas DEBE ser []. Usa lo ya dicho y defaults razonables para lo no esencial.\n"
    : "\n12) DISCIPLINA DE PREGUNTAS: antes de preguntar revisa TODO el texto y sus Aclaraciones. JAMAS repitas una pregunta respondida. Pregunta solo si falta algo material.\n";

  const system =
    "Eres el asistente experto de cotizacion de Von Haucke. Convierte el pedido en RENGLONES estructurados del CATALOGO real. Tu NO das precios: el motor cuesta cada renglon.\n\n" +
    "REGLAS:\n" +
    "1) 'ruta' = la CLAVE de la linea (ej. 'applt') y 'producto' = el ID del producto (ej. 'banca_doble'), ambos EXACTOS y en campos SEPARADOS (nunca 'applt/banca_doble' ni el nombre descriptivo). Lo inexistente va a noEncontrado; no inventes items.\n" +
    "2) seleccion usa claves exactas de params y valores permitidos.\n" +
    "3) Si falta una opcion no esencial, elige default sensato y dilo en nota. No conviertas detalles opcionales en interrogatorio.\n" +
    "3-bis) MATERIAL EXPLICITO MANDA. Si no existe en el producto usa material_override; nunca sustituyas silenciosamente.\n" +
    "4) BANCAS/BENCH: usuarios=CAPACIDAD POR UNIDAD; cantidad=NUMERO DE BANCAS. '3 bancas de 8' => cantidad=3, usuarios=8, total=24. '24 lugares en una banca continua' => cantidad=1, usuarios=24.\n" +
    "5) Mejor un supuesto marcado que preguntas interminables. Termina siempre el JSON.\n" +
    "6) Catalogo: lineas configurables + __banco para silleria/complementos.\n" +
    "7) El banco trae precio real de presupuesto cerrado; usalo como criterio sin inventar precio.\n" +
    "8) Jerarquia operativa premium->economica: CIRQUE > RIO > APP LT. Si no especifican, APP LT.\n" +
    "9) CERO EXTRAS SILENCIOSOS: NO agregues credenzas, espera, sofas, guardas, accesorios u otros extras que el usuario no haya pedido. Si quieres recomendar algo opcional, NO lo conviertas en item/banco cobrable. Solo puedes mencionarlo brevemente en una pregunta si realmente aporta.\n" +
    "9-bis) COMPLEMENTOS FUNCIONALES OBLIGATORIOS: una SALA DE JUNTAS para N personas implica su mesa y N sillas aunque el usuario no repita la palabra 'sillas'; eso NO es un extra opcional y debe ir con sugerido:false. Un bench/operativo lleva sillas/gavetas SOLO cuando el pedido o programa las indique, como ocurre en el formulario de proyecto. Recepcion para N personas (quienes ATIENDEN) = mostrador + N sillas OPERATIVAS con sugerido:false, una por persona que atiende (decision de Direccion 2026-10-19); si no dicen cuantas personas, 1. NO agregues sillas de ESPERA salvo que se pidan.\n" +
    "9-ter) SILLA SEGUN USO (si el usuario NO nombra modelo; misma regla que el acomodo por plano): sala de juntas/consejo -> modelo CONCERTO (la pieza del __banco cuyo nombre dice CONCERTO; si no hay, SONATA). NO uses DELTA ni otra silla de visita de oficina privada para la sala de juntas. Silla del que OCUPA una direccion u oficina privada -> ALPHA ('Silla directiva ALPHA'; es cara: SOLO para directores y privados). Puestos operativos y recepcion -> GAMMA-E ('Silla operativa · GAMMA-E'). Visitas de oficina privada: la regla de la casa. Si el usuario nombra un modelo, ese manda (decision de Direccion 2026-10-19).\n" +
    "9-quater) MESA SEGUN PERSONAS: la mesa de una sala para N personas debe tener capacidad >= N (usuarios del __banco o, si no lo trae, una silla cada 0.60 m por lado del largo). La 'Mesa de consejo modular' Eclipse se vende POR MODULO de 1.50/1.80 m: para N personas NO pongas un solo modulo; usa la 'Mesa de consejo Eclipse' de 4.80 m (14 personas) o la cantidad de modulos que de la capacidad, y dilo. NUNCA escribas que 'el motor ajusta modulos': nadie los ajusta despues (auditoria 2026-10-19).\n" +
    "9-quinquies) UN RENGLON POR DESTINO: NO juntes en una sola partida piezas del mismo modelo que van a lugares distintos. Ej.: 12 GAMMA-E para los puestos operativos y 1 GAMMA-E para la recepcion son DOS partidas (12 y 1), cada una con su nota de destino ('Una por puesto operativo' / '1 persona que atiende recepcion'); 8 CONCERTO de la sala de juntas y 2 CONCERTO de visita de la direccion son DOS partidas. La nota de cada partida dice SOLO su destino (auditoria 2026-10-19: una partida mezclada se acomodaba toda en un solo lugar).\n" +
    "10) Si ya se indicó un modelo de silla, no preguntes por alternativas.\n" +
    "11) Una Aclaracion posterior gana sobre el texto original y tus inferencias anteriores. No vuelvas a la version previa.\n" +
    cierreAclaraciones +
    (reglas.length ? "\nREGLAS DE LA CASA (MANDAN):\n" + reglas.join("\n") + "\n" : "") +
    (aprendizajes.length ? "\nCORRECCIONES APRENDIDAS (solo si aplican):\n" + aprendizajes.join("\n") + "\n" : "") +
    "\nCATALOGO:\n" + catalogoTxt;

  const apiBody = {
    model: "claude-opus-5", max_tokens: 8000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system,
    messages: [{ role: "user", content: [{ type: "text", text: "Cotiza esto:\n\n" + textoCompleto.slice(0, 6000) }] }],
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
  if (data?.stop_reason === "refusal") { await finish("refused", 200, "MODEL_REFUSAL", tokens); return json({ ok: false, code: "MODEL_REFUSAL", error: "La IA no pudo interpretar el texto.", request_id: requestId }, 200); }
  if (data?.stop_reason === "max_tokens") { await finish("error", 200, "MODEL_TRUNCATED", tokens); return json({ ok: false, code: "MODEL_TRUNCATED", error: "El pedido salio muy largo y se corto. Divide el pedido en partes.", request_id: requestId }, 200); }

  const txt = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let propuesta: any;
  try { propuesta = JSON.parse(txt); }
  catch { await finish("error", 200, "INVALID_MODEL_JSON", tokens); return json({ ok: false, code: "INVALID_MODEL_JSON", error: "La IA no devolvio una propuesta valida. Reintenta.", request_id: requestId }, 200); }

  if (propuesta && typeof propuesta === "object") {
    // Segundo cinturón determinista: un extra que el modelo marcó sugerido NUNCA es cobrable.
    const sugerenciasDescartadas = [
      ...(Array.isArray(propuesta.items) ? propuesta.items.filter((x: any) => x?.sugerido === true).map((x: any) => x?.etiqueta || x?.producto) : []),
      ...(Array.isArray(propuesta.banco) ? propuesta.banco.filter((x: any) => x?.sugerido === true).map((x: any) => x?.etiqueta || x?.id) : []),
    ].filter(Boolean);
    propuesta.items = (Array.isArray(propuesta.items) ? propuesta.items : []).filter((x: any) => x?.sugerido !== true);
    propuesta.banco = (Array.isArray(propuesta.banco) ? propuesta.banco : []).filter((x: any) => x?.sugerido !== true);
    if (rondasAclaracion >= 2) propuesta.preguntas = [];
    await finish("ok", 200, undefined, tokens);
    return json({ ok: true, propuesta, uso: data?.usage || null, rondasAclaracion, sugerenciasDescartadas, request_id: requestId,
      contexto: { reglas: reglas.length, aprendizajes: aprendizajes.length, fuente: "base" } });
  }
  await finish("error", 200, "INVALID_MODEL_JSON", tokens);
  return json({ ok: false, code: "INVALID_MODEL_JSON", error: "La IA no devolvio una propuesta valida. Reintenta.", request_id: requestId }, 200);
});
