// ============================================================================
//  Edge Function: analizar-mueble  (MEGA ANALIZADOR)
//  Auditoria Tecnica de Industrializacion (COO / DFM / Lean) de un mueble a
//  partir de su imagen. Devuelve:
//   - piezas: BOM estructurado con id de material -> lo cuesta el MOTOR.
//   - informe: auditoria completa en Markdown (7 secciones + Top 3) para Prod.
//   - descripcionCliente / materiales: lenguaje de cliente para el PDF.
//  La IA audita y propone; el MOTOR calcula el precio. Requiere ANTHROPIC_API_KEY.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    producto: { type: "string" },
    tipo: { type: "string", enum: ["escritorio", "estacion", "bench", "mesa", "mesita", "guarda", "mampara", "asiento", "otro"] },
    piezas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          nombre: { type: "string" },
          insumoId: { type: "string", description: "id EXACTO del catalogo; '' si ninguno encaja" },
          forma: { type: "string", enum: ["area", "lineal", "pieza"] },
          largoMM: { type: "number" },
          anchoMM: { type: "number" },
          cantidad: { type: "number" },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          nota: { type: "string" },
        },
        required: ["nombre", "insumoId", "forma", "largoMM", "anchoMM", "cantidad", "confianza", "nota"],
      },
    },
    descripcionCliente: { type: "string", description: "Para el CLIENTE, sin jerga: que es, de que esta hecho, medidas aprox, para que sirve. 2-4 frases." },
    materiales: { type: "array", items: { type: "string" }, description: "Materiales visibles en palabras de cliente." },
    volumenAsumido: { type: "string", description: "Volumen que asumiste para el analisis (ej. 'prototipo/1 pieza' o 'corrida 50+'). Afecta flat-pack y herramentales." },
    confianzaGeneral: { type: "string", enum: ["alta", "media", "baja"], description: "Confianza global del analisis (baja si no hay escala)." },
    informe: { type: "string", description: "Auditoria tecnica COMPLETA en Markdown con EXACTAMENTE estas secciones y titulos, en este orden: '## 📐 Resumen Tecnico y Medidas Generales', '## 📋 Tabla BOM' (tabla markdown: Pieza | Material | Calibre/Espesor | Medida | Acabado), '## ✂️ Analisis de Merma y Nesting' (cuantifica: merma % actual vs optimizada, piezas por tablero 1.22x2.44), '## ⚙️ Ruta de Produccion y Estandarizacion' (Corte->CNC->Doblez->Soldadura->Pintura->Tapiceria->Ensamble; cuello de botella; piezas universales izq/der), '## 💡 Ingenieria de Valor' (2 acciones para bajar >=15%, en % no en pesos), '## 📦 Estrategia Logistica (Flat-Pack)' (knock-down y densidad en contenedor 53ft), '## 🛡️ Refuerzos Estructurales (Contract/BIFMA)', '## 🎯 Top 3 Acciones' (ordenadas por impacto/esfuerzo). Cuantifica siempre (%, piezas/tablero, kg, horas). NUNCA precios en pesos." },
    preguntas: { type: "array", items: { type: "string" }, description: "Lo esencial a confirmar para un costo real (incluye pedir 1 medida de referencia si no hay escala)." },
  },
  required: ["producto", "tipo", "piezas", "descripcionCliente", "materiales", "volumenAsumido", "confianzaGeneral", "informe", "preguntas"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ ok: false, error: "Falta ANTHROPIC_API_KEY" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON invalido" }, 400); }
  const { image, mediaType = "image/jpeg", catalogo } = body || {};
  if (!image) return json({ ok: false, error: "Falta la imagen (base64)." }, 400);

  const cat = Array.isArray(catalogo)
    ? catalogo.map((c: any) => `${c.id} — ${c.nombre} [${c.seccion}, ${c.unidad}]`).join("\n")
    : "(sin catalogo)";

  const system =
    "Actua como el Director Operativo (COO), Jefe de Ingenieria de Producto y Experto en Costos de una fabrica de mobiliario de clase mundial (corporativo, hoteleria y retail; metalmecanica, CNC, pintura, tapiceria). Eres maestro en Lean Manufacturing, Design for Manufacturing (DFM) y optimizacion de recursos.\n\n" +
    "TAREA: te doy la imagen/render de un mueble. Haz una 'Auditoria Tecnica, Explosion de Materiales (BOM) y Estrategia de Industrializacion' exhaustiva para integrarla a nuestro sistema de costeo. La IA audita y propone; el MOTOR calcula el precio: TU NUNCA das precios en pesos.\n\n" +
    "REGLAS CLAVE (mias, respetalas):\n" +
    "A) ANCLA A NUESTROS DATOS: en 'piezas' usa SOLO materiales de nuestro catalogo (id EXACTO en insumoId; '' si ninguno encaja y dilo en nota). Usa formatos comerciales reales MX/Norteamerica (tablero 1.22x2.44 m, tubo 6 m, lamina 4x8/4x10 ft, tela ancho 1.40 m).\n" +
    "B) CUANTIFICA, no solo describas: merma % actual vs optimizada, piezas por tablero, kg de acero, horas por proceso, ahorro en % (NO en pesos).\n" +
    "C) ESCALA: la foto no trae escala. Asume estandares (altura de trabajo 720-750 mm) y en 'preguntas' PIDE 1 medida de referencia real para calibrar. Marca confianza 'baja' en lo que no puedas medir y baja 'confianzaGeneral'.\n" +
    "D) VOLUMEN: declara 'volumenAsumido' (prototipo vs corrida) — flat-pack y herramentales solo valen a volumen.\n" +
    "E) ANTI-ALUCINACION: si dudas de un material, ofrece 2 opciones con su trade-off en el informe. Nunca inventes.\n" +
    "F) CLIENTE vs INTERNO: 'informe' es para Produccion/Diseno (tecnico). 'descripcionCliente' y 'materiales' son para el CLIENTE: sin jerga ni claves.\n\n" +
    "El 'informe' (Markdown) DEBE traer las 8 secciones con los titulos EXACTOS del schema (las 7 de la auditoria + '## 🎯 Top 3 Acciones' al final), con la tabla BOM en markdown. SE CONCISO: viñetas cortas, no ensayos; maximo ~3-5 puntos por seccion; tabla BOM breve. Prioriza claridad y termina SIEMPRE el JSON.\n\n" +
    "DESPIECE 'piezas' (para el motor): tableros/cristal forma='area' con largoMM/anchoMM; metal/canto/tela forma='lineal' (metros); herrajes/comprados forma='pieza'.\n\n" +
    "CATALOGO DE MATERIALES (id — nombre [seccion, unidad]):\n" + cat;

  const apiBody = {
    model: "claude-opus-5",
    max_tokens: 8000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: "Realiza la Auditoria Tecnica, BOM y Estrategia de Industrializacion completa de este mueble." },
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
    return json({ ok: false, error: "No se pudo llamar a Claude: " + String(e) }, 502);
  }

  if (data?.type === "error") return json({ ok: false, error: data.error?.message || "Error de la API" }, 502);
  if (data?.stop_reason === "refusal") return json({ ok: false, error: "La IA no pudo analizar esta imagen." }, 200);
  if (data?.stop_reason === "max_tokens") return json({ ok: false, error: "El analisis salio demasiado largo y se corto. Reintenta (ya lo ajustamos para que sea mas breve)." }, 200);

  const texto = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let propuesta: any;
  try { propuesta = JSON.parse(texto); }
  catch { return json({ ok: false, error: "La IA no devolvio un analisis valido (JSON incompleto). Reintenta." }, 200); }

  return json({ ok: true, propuesta, uso: data?.usage || null });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
