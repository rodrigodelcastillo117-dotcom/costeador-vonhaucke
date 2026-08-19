// ============================================================================
//  Edge Function: analizar-negocio  ·  la VOZ de Voni (Fase 2 de "Voni Cerebro")
//
//  NO consulta la base ni calcula nada de negocio por su cuenta. Recibe
//  `senales` YA CALCULADAS por código determinístico en el cliente
//  (src/datos/senales.js — margen bajo, renglones estimados, insumos sin
//  fuente…) y solo las explica/prioriza en español llano, con la voz de
//  Voni. Así el modelo nunca puede inventar una cifra de negocio: si no
//  viene en `senales`, no existe para él.
//
//  Mismo esqueleto que cotizar-texto/index.ts (CORS, output_config con
//  json_schema, manejo de refusal/max_tokens/JSON inválido). Lo único nuevo
//  es el candado de rol para `alcance:'negocio'`, calcado del que ya usa
//  usuarios/index.ts (único edge function del repo que verifica quién llama).
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ ok: false, error: "Falta ANTHROPIC_API_KEY" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON invalido" }, 400); }
  const { senales, alcance, reglas, aprendizajes } = body || {};
  if (!Array.isArray(senales)) return json({ ok: false, error: "Faltan las señales." }, 400);

  // ⚠️ CANDADO DE ROL SOLO PARA 'negocio' (2026-08-19). Las señales de una
  // COTIZACIÓN ya las decide el cliente, que oculta costo/margen a
  // soloVentas antes de llegar aquí (Cotizacion.jsx). Pero 'negocio' puede
  // traer cifras de Dirección (utilidad, márgenes agregados) — ésa sí hay
  // que verificarla en el servidor, calcado del único candado que existe en
  // el repo (usuarios/index.ts): JWT del header -> admin.auth.getUser ->
  // checa permitidos.rol. Igual que App.jsx (veCostos = esDireccion ||
  // esDiseno), Diseño también pasa: ya ve costos hoy en pantalla.
  if (alcance === "negocio") {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) return json({ ok: false, error: "Falta configuración del servidor." }, 500);
    const admin = createClient(url, service);
    const jwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(jwt);
    const correo = u?.user?.email;
    if (!correo) return json({ ok: false, error: "no-sesion" }, 401);
    const { data: yo } = await admin.from("permitidos").select("rol").eq("email", correo).single();
    if (yo?.rol !== "direccion" && yo?.rol !== "diseno") return json({ ok: false, error: "solo-direccion" }, 403);
  }

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
    (Array.isArray(reglas) && reglas.length
      ? "\n\nREGLAS DE LA CASA (las dicta la Direccion de Von Haucke y MANDAN sobre " +
        "cualquier criterio anterior):\n" + reglas.join("\n") + "\n"
      : "") +
    (Array.isArray(aprendizajes) && aprendizajes.length
      ? "\n\nLO QUE YA TE CORRIGIERON ANTES:\n" + aprendizajes.join("\n") + "\n"
      : "") +
    "\nSEÑALES (JSON: [{tipo: 'roja'|'ambar', texto}]):\n" + JSON.stringify(senales);

  const apiBody = {
    model: "claude-opus-5",
    max_tokens: 2000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system,
    messages: [{ role: "user", content: [{ type: "text", text: `Alcance: ${alcance === "negocio" ? "el negocio en general" : "esta cotización"}. Dime qué debo saber.` }] }],
  };

  let data: any;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(apiBody),
    });
    data = await r.json();
  } catch (e) {
    return json({ ok: false, error: "No se pudo llamar a Claude: " + String(e) }, 502);
  }

  if (data?.type === "error") return json({ ok: false, error: data.error?.message || "Error de la API" }, 502);
  if (data?.stop_reason === "refusal") return json({ ok: false, error: "Voni no pudo armar una respuesta." }, 200);
  if (data?.stop_reason === "max_tokens") return json({ ok: false, error: "La respuesta salió muy larga y se cortó." }, 200);

  const txt = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let propuesta: any;
  try { propuesta = JSON.parse(txt); }
  catch { return json({ ok: false, error: "Voni no devolvió una respuesta válida. Reintenta." }, 200); }

  return json({ ok: true, propuesta, uso: data?.usage || null });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
