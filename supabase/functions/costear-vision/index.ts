// ============================================================================
//  Edge Function: costear-vision
//  Recibe una imagen (render/foto) de un mueble + el catálogo de insumos, la
//  analiza con Claude (visión) y devuelve un DESPIECE propuesto en JSON para
//  pre-llenar el asistente "Costear desde cero". La IA propone; el motor cuesta.
//  Requiere el secret ANTHROPIC_API_KEY en Supabase Edge Functions.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Esquema del despiece propuesto (salida estructurada, se valida en el server de la API)
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    producto: { type: "string", description: "Nombre corto del mueble" },
    tipo: {
      type: "string",
      enum: ["escritorio", "estacion", "bench", "mesa", "mesita", "guarda", "mampara", "asiento", "otro"],
    },
    piezas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          nombre: { type: "string", description: "Nombre de la pieza, ej. Cubierta, Faldón, Pata" },
          insumoId: { type: "string", description: "id EXACTO del catálogo; '' si no hay uno claro" },
          forma: { type: "string", enum: ["area", "lineal", "pieza"] },
          largoMM: { type: "number", description: "largo en mm si forma=area; 0 si no aplica" },
          anchoMM: { type: "number", description: "ancho en mm si forma=area; 0 si no aplica" },
          cantidad: { type: "number", description: "piezas (area) o metros/piezas (lineal/pieza)" },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          nota: { type: "string", description: "qué confirmar (ej. 'medida estimada, sin escala')" },
        },
        required: ["nombre", "insumoId", "forma", "largoMM", "anchoMM", "cantidad", "confianza", "nota"],
      },
    },
    preguntas: {
      type: "array",
      items: { type: "string" },
      description: "Preguntas clave para el usuario (medidas reales, acabado, qué es comprado)",
    },
    descripcionCliente: {
      type: "string",
      description: "Descripción para el CLIENTE en lenguaje humano, NO metalmecánico: qué es, de qué está hecho (madera/cristal/tela en palabras simples), medidas aproximadas y para qué sirve. 2-4 frases, tono comercial y claro. Sin claves ni despiece.",
    },
    materiales: {
      type: "array",
      items: { type: "string" },
      description: "Materiales principales visibles, en palabras simples de cliente (ej. 'Cubierta en chapa de nogal', 'Estructura de acero pintado negro', 'Cristal templado').",
    },
    mejoras: {
      type: "array",
      items: { type: "string" },
      description: "Sugerencias creativas de mejora: diseño, ergonomía, durabilidad, o cambios de medida que RINDEN mejor el material (menos desperdicio). Concretas y accionables.",
    },
    fallasProbables: {
      type: "array",
      items: { type: "string" },
      description: "Riesgos o fallas probables de fabricación/uso a cuidar (ej. 'cubierta de 1.60 sin apoyo central: riesgo de pandeo', 'MDF no aguanta este voladizo'). Vacío si no hay.",
    },
    aprovechamiento: {
      type: "string",
      description: "Nota de aprovechamiento de material: si alguna medida se ajusta un poco, cuántas piezas caben por tablero/hoja y cuánto material se ahorra. '' si no aplica.",
    },
  },
  required: ["producto", "tipo", "piezas", "preguntas", "descripcionCliente", "materiales", "mejoras", "fallasProbables", "aprovechamiento"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ ok: false, error: "Falta el secret ANTHROPIC_API_KEY en Supabase." }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON inválido" }, 400); }
  const { image, mediaType = "image/jpeg", catalogo } = body || {};
  if (!image) return json({ ok: false, error: "Falta la imagen (base64)." }, 400);

  const cat = Array.isArray(catalogo)
    ? catalogo.map((c: any) => `${c.id} — ${c.nombre} [${c.seccion}, ${c.unidad}]`).join("\n")
    : "(sin catálogo)";

  const system =
    "Eres el mejor ingeniero de costos y diseñador de producto de Von Haucke, fabricante de mobiliario de oficina de alta gama. " +
    "Te dan la imagen de un mueble (render o foto). Analízalo A FONDO y con criterio: propón su despiece, revísalo, mejóralo y cuídalo. La IA propone; el MOTOR calcula el precio (tú NUNCA inventas precios).\n\n" +
    "DESPIECE (campo 'piezas'):\n" +
    "1) Usa SOLO estos materiales del catálogo (id EXACTO en insumoId); si ninguno encaja, deja insumoId '' y explícalo en nota.\n" +
    "2) Tableros y cristal: forma='area' con largoMM y anchoMM; metal/canto/tela: forma='lineal' (cantidad en metros); herrajes/comprados: forma='pieza' (cantidad en piezas).\n" +
    "3) La foto NO tiene escala: estima medidas realistas de mobiliario de oficina; confianza 'baja' cuando no puedas medir.\n" +
    "4) Marca lo comprado hecho (cristal, jaladeras, bisagras, correderas) — el usuario confirma.\n\n" +
    "ANÁLISIS (piensa como experto):\n" +
    "5) 'descripcionCliente' y 'materiales': en lenguaje de CLIENTE, sin jerga metalmecánica ni claves. Qué es, de qué se ve hecho, medidas aprox, para qué sirve.\n" +
    "6) 'mejoras': ideas creativas y accionables — diseño, ergonomía, durabilidad y sobre todo AJUSTES DE MEDIDA QUE RINDEN MÁS EL MATERIAL (menos desperdicio).\n" +
    "7) 'fallasProbables': riesgos reales de fabricación o uso a cuidar (voladizos, pandeo, material que no aguanta, uniones débiles). Vacío si no hay.\n" +
    "8) 'aprovechamiento': si una medida se ajusta un poco, cuántas piezas caben por tablero (hoja 1.22×2.44 m) y cuánto material se ahorra. Sé concreto.\n" +
    "9) 'preguntas': lo esencial que el usuario debe confirmar para un costo real (medidas exactas, acabado, qué es comprado).\n\n" +
    "CATÁLOGO DE MATERIALES (id — nombre [sección, unidad]):\n" + cat;

  const apiBody = {
    model: "claude-opus-5",
    max_tokens: 6000,
    output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
    system,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: "Analiza este mueble a fondo: despiece con medidas, descripción para el cliente, materiales, mejoras, fallas probables y aprovechamiento de material." },
      ],
    }],
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
    return json({ ok: false, error: "No se pudo llamar a la API de Claude: " + String(e) }, 502);
  }

  if (data?.type === "error") return json({ ok: false, error: data.error?.message || "Error de la API" }, 502);
  if (data?.stop_reason === "refusal") return json({ ok: false, error: "La IA no pudo analizar esta imagen." }, 200);

  const texto = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let propuesta: any;
  try { propuesta = JSON.parse(texto); }
  catch { return json({ ok: false, error: "La IA no devolvió un despiece válido." }, 200); }

  return json({ ok: true, propuesta, uso: data?.usage || null });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
