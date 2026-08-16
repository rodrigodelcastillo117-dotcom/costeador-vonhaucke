// ============================================================================
//  Edge Function: generar-video
//  Video de producto con Veo (Gemini). Arranca desde una IMAGEN — el render de
//  catálogo del propio mueble — para que el video sea de NUESTRO producto y no
//  de uno parecido.
//
//  Veo tarda 1-3 min, más de lo que vive una edge function, así que va en dos
//  tiempos: `iniciar` devuelve el nombre de la operación y `estado` la consulta
//  y, cuando termina, devuelve el video ya descargado en base64.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASE = "https://generativelanguage.googleapis.com/v1beta";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ ok: false, error: "Falta GEMINI_API_KEY" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON invalido" }, 400); }

  const {
    accion = "iniciar",
    operacion = "",
    prompt = "",
    imagen = "",
    mediaType = "image/jpeg",
    modelo = "veo-3.1-lite-generate-preview",
    aspecto = "16:9",
    segundos = 8,
  } = body || {};

  // ---- Consultar una operación ya lanzada ----
  // Lista los modelos que la llave SÍ puede usar (para no adivinar nombres).
  if (accion === "modelos") {
    const r = await fetch(`${BASE}/models?key=${key}&pageSize=200`);
    const d = await r.json();
    const veo = (d.models || [])
      .filter((m: any) => /veo/i.test(m.name))
      .map((m: any) => ({ n: m.name, metodos: m.supportedGenerationMethods }));
    return json({ ok: true, veo, total: (d.models || []).length });
  }

  if (accion === "estado") {
    if (!operacion) return json({ ok: false, error: "Falta el nombre de la operación" }, 400);
    const r = await fetch(`${BASE}/${operacion}?key=${key}`);
    const op = await r.json();
    if (op?.error) return json({ ok: false, error: op.error.message || "Error consultando la operación" }, 502);
    if (!op.done) return json({ ok: true, listo: false });

    const muestra = op.response?.generateVideoResponse?.generatedSamples?.[0]
      || op.response?.generatedVideos?.[0];
    const uri = muestra?.video?.uri || muestra?.video?.videoUri;
    if (!uri) return json({ ok: false, error: "La operación terminó sin video: " + JSON.stringify(op.response || op).slice(0, 300) }, 502);

    // El archivo pide la llave para bajarse; se descarga aquí y se devuelve.
    const v = await fetch(uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${key}`);
    if (!v.ok) return json({ ok: false, error: `No se pudo bajar el video (${v.status})` }, 502);
    const bytes = new Uint8Array(await v.arrayBuffer());
    let s = "";
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return json({ ok: true, listo: true, base64: btoa(s), bytes: bytes.length });
  }

  // ---- Lanzar la generación ----
  if (!prompt.trim()) return json({ ok: false, error: "Falta el prompt" }, 400);

  const instancia: any = { prompt };
  if (imagen) instancia.image = { bytesBase64Encoded: imagen, mimeType: mediaType };

  const r = await fetch(`${BASE}/models/${modelo}:predictLongRunning?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instances: [instancia],
      parameters: {
        aspectRatio: aspecto,
        durationSeconds: segundos,
        personGeneration: "allow_all",   // el prompt ya dice "no people"
        sampleCount: 1,
      },
    }),
  });
  const op = await r.json();
  if (op?.error) return json({ ok: false, error: op.error.message || "Error al lanzar Veo", detalle: op.error }, 502);
  if (!op?.name) return json({ ok: false, error: "Veo no devolvió operación: " + JSON.stringify(op).slice(0, 300) }, 502);
  return json({ ok: true, operacion: op.name });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
