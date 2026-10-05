// ============================================================================
// leer-plano v3 · levanta geometría arquitectónica verificable desde imagen/PDF.
// La IA EXTRAE; FloorSpec/solver VALIDAN. Si un dato crítico no se ve, se marca
// desconocido: nunca se inventa para conseguir un layout verde.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PUNTO = {
  type: "object",
  additionalProperties: false,
  properties: {
    x: { type: "number", description: "mm desde el borde izquierdo del envolvente" },
    y: { type: "number", description: "mm desde el borde superior del envolvente; y crece hacia abajo" },
  },
  required: ["x", "y"],
};

const PUERTA = {
  type: "object",
  additionalProperties: false,
  properties: {
    x: { type: "number", description: "Centro del vano en mm, coordenada global del envolvente." },
    y: { type: "number", description: "Centro del vano en mm, coordenada global del envolvente." },
    ancho: { type: "number", description: "Ancho de la hoja/vano en mm." },
    tieneBarrido: { type: "boolean", description: "true SOLO cuando el arco/sentido de apertura se distingue realmente en el plano." },
    bisagraX: { type: "number", description: "X de la bisagra en mm. Si no se puede leer, 0 y tieneBarrido=false." },
    bisagraY: { type: "number", description: "Y de la bisagra en mm. Si no se puede leer, 0 y tieneBarrido=false." },
    anguloCerradaDeg: { type: "number", description: "Ángulo de la hoja cerrada: 0=derecha, 90=abajo, 180=izquierda, 270=arriba." },
    sentido: { type: "string", enum: ["horario", "antihorario", "desconocido"], description: "Sentido visual del giro en coordenadas del plano." },
    barridoDeg: { type: "number", description: "Grados del arco visible; normalmente 90. Si no se ve, 0." },
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
  },
  required: ["x", "y", "ancho", "tieneBarrido", "bisagraX", "bisagraY", "anguloCerradaDeg", "sentido", "barridoDeg", "confianza"],
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    envolvente: {
      type: "object", additionalProperties: false,
      properties: {
        ancho: { type: "number", description: "Ancho total en mm." },
        largo: { type: "number", description: "Largo total en mm." },
      },
      required: ["ancho", "largo"],
    },
    grid: {
      type: "object", additionalProperties: false,
      properties: {
        horizontal: { type: "array", items: { type: "number" } },
        vertical: { type: "array", items: { type: "number" } },
      },
      required: ["horizontal", "vertical"],
    },
    areas: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          nombre: { type: "string" },
          tipo: { type: "string", enum: ["open", "privado", "juntas", "recepcion", "lounge", "servicio"] },
          forma: { type: "string", enum: ["poligono", "circulo"] },
          puntos: { type: "array", items: PUNTO },
          circulo: {
            type: "object", additionalProperties: false,
            properties: { cx: { type: "number" }, cy: { type: "number" }, r: { type: "number" } },
            required: ["cx", "cy", "r"],
          },
          dentroDe: { type: "string" },
          puestos: { type: "integer" },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
        },
        required: ["nombre", "tipo", "forma", "puntos", "circulo", "dentroDe", "puestos", "confianza"],
      },
    },
    puertas: { type: "array", items: PUERTA },
    escala: { type: "string" },
    tieneCotas: { type: "boolean" },
    notas: { type: "array", items: { type: "string" } },
  },
  required: ["envolvente", "grid", "areas", "puertas", "escala", "tieneCotas", "notas"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ ok: false, error: "Falta ANTHROPIC_API_KEY" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON invalido" }, 400); }
  const { image, mediaType = "image/jpeg", refMM } = body || {};
  if (!image) return json({ ok: false, error: "Falta la imagen del plano." }, 400);
  const esPdf = mediaType === "application/pdf";

  const system = [
    "Eres un arquitecto que LEVANTA un plano de oficina. Extrae evidencia geométrica; no diseñes ni completes lo que no se ve.",
    "Devuelve todo en MILÍMETROS y usa origen (0,0) en la esquina superior izquierda; x derecha, y abajo.",
    "ORDEN OBLIGATORIO:",
    "1) ESCALA/ENVOLVENTE: usa primero cotas generales. COTA > escala gráfica > estimación. Si estimas, confianza baja.",
    "2) GRID: copia los segmentos de ejes horizontal/vertical. Su suma debe cuadrar con la envolvente.",
    "3) CONTORNOS: traza cada cuarto con su forma real. Rectángulo=4 puntos; triángulo=3; trapecio=4; muros curvos=8-16 puntos. Círculos con centro/radio.",
    "4) ANIDAMIENTO: si una sala/isla está dentro de otra área, usa dentroDe. No la marques como traslape.",
    "5) PUESTOS: cuenta sólo escritorios/posiciones REALMENTE dibujados en cada isla. Sillas de juntas, sanitarios, HVAC y símbolos no son puestos.",
    "6) PUERTAS: detecta cada puerta real y su vano. Si se ve el arco de apertura, extrae la BISAGRA, la hoja cerrada y el SENTIDO del arco.",
    "CONTRATO DE PUERTA: anguloCerradaDeg usa 0=derecha, 90=abajo, 180=izquierda, 270=arriba. Como y crece hacia abajo, 'horario' es el giro visual horario.",
    "tieneBarrido=true SÓLO si puedes identificar bisagra + sentido + arco. Entonces barridoDeg es el arco visible (normalmente 90) y confianza refleja legibilidad.",
    "Si NO ves el arco/bisagra/sentido con suficiente evidencia: tieneBarrido=false, sentido='desconocido', bisagraX=0, bisagraY=0, anguloCerradaDeg=0, barridoDeg=0. NO ADIVINES.",
    "Un vano sin hoja/arco puede registrarse como puerta/acceso pero debe quedar tieneBarrido=false; el sistema pedirá confirmación antes de aprobar el layout.",
    "7) SERVICIOS: baños, SITE/IT, cocineta, ductos y escaleras son tipo='servicio' y no se amueblan.",
    "8) No inventes cuartos, SKUs, mobiliario ni dimensiones. Si falta una referencia real, anótalo en notas.",
    "COMPROBACIÓN FINAL: envolvente y grid coherentes; puntos dentro del envolvente; áreas no anidadas sin traslape; cada puerta sobre un muro; ninguna puerta dudosa convertida en barrido 'confirmado'.",
    refMM ? `El usuario dio una referencia real de ${refMM} mm: úsala para calibrar la escala.` : "",
  ].filter(Boolean).join("\n");

  const apiBody = {
    model: "claude-opus-5",
    max_tokens: 8000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system,
    messages: [{
      role: "user",
      content: [
        esPdf
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: image } }
          : { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: "Levanta este plano con geometría y puertas verificables. No completes datos que no se vean." },
      ],
    }],
  };

  let data: any;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(apiBody),
    });
    data = await r.json();
  } catch (e) {
    return json({ ok: false, error: "No se pudo llamar a Claude: " + String(e) }, 502);
  }

  if (data?.type === "error") return json({ ok: false, error: data.error?.message || "Error de la API" }, 502);
  if (data?.stop_reason === "refusal") return json({ ok: false, error: "No se pudo leer el plano." }, 200);

  const txt = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let lectura: any;
  try { lectura = JSON.parse(txt); }
  catch { return json({ ok: false, error: "La IA no devolvió una lectura válida. Reintenta." }, 200); }

  return json({ ok: true, lectura, uso: data?.usage || null });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
