// ============================================================================
// Edge Function: cotizar-texto · v11 CANDIDATA (DESPLEGADA = v10, ezbr 9c3c84f4…)
// Texto natural -> renglones estructurados. La IA interpreta; el motor fija precio.
// v10: cierre de aclaraciones + cero extras sugeridos cobrables sin aprobación.
// v11 (NO desplegada; requiere autorización de Rodrigo): CAUSA DEMOSTRADA del
//   "No pude costear" (E2E Torre Sur 2026-10-10): con el schema v10 SIN descripciones
//   y la regla "Usa SOLO ruta/producto existentes", el modelo devolvía
//   ruta:"applt/banca_doble" y producto:"Banca doble App LT 10 usuarios". Se
//   restauran las descripciones de campo (ruta = CLAVE de línea, producto = ID) y la
//   regla 1 lo dice explícito. El cliente (resolverRutaProducto) tolera el formato
//   fusionado de todos modos (defensa en profundidad).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ ok: false, error: "Falta ANTHROPIC_API_KEY" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON invalido" }, 400); }
  const { texto, catalogo, reglas, aprendizajes } = body || {};
  if (!texto || !String(texto).trim()) return json({ ok: false, error: "Falta el texto a cotizar." }, 400);
  if (!catalogo) return json({ ok: false, error: "Falta el catalogo." }, 400);

  const textoCompleto = String(texto);
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
    "9-bis) COMPLEMENTOS FUNCIONALES OBLIGATORIOS: una SALA DE JUNTAS para N personas implica su mesa y N sillas aunque el usuario no repita la palabra 'sillas'; eso NO es un extra opcional y debe ir con sugerido:false. Un bench/operativo lleva sillas/gavetas SOLO cuando el pedido o programa las indique, como ocurre en el formulario de proyecto. Recepcion lleva mostrador; NO agregues sillas de espera/operativas salvo que se pidan.\n" +
    "10) Si ya se indicó un modelo de silla, no preguntes por alternativas.\n" +
    "11) Una Aclaracion posterior gana sobre el texto original y tus inferencias anteriores. No vuelvas a la version previa.\n" +
    cierreAclaraciones +
    (Array.isArray(reglas) && reglas.length ? "\nREGLAS DE LA CASA (MANDAN):\n" + reglas.join("\n") + "\n" : "") +
    (Array.isArray(aprendizajes) && aprendizajes.length ? "\nCORRECCIONES APRENDIDAS (solo si aplican):\n" + aprendizajes.join("\n") + "\n" : "") +
    "\nCATALOGO:\n" + JSON.stringify(catalogo);

  const apiBody = {
    model: "claude-opus-5", max_tokens: 8000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system,
    messages: [{ role: "user", content: [{ type: "text", text: "Cotiza esto:\n\n" + textoCompleto.slice(0, 6000) }] }],
  };

  let data: any;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(apiBody),
    });
    data = await r.json();
  } catch (e) { return json({ ok: false, error: "No se pudo llamar a Claude: " + String(e) }, 502); }

  if (data?.type === "error") return json({ ok: false, error: data.error?.message || "Error de la API" }, 502);
  if (data?.stop_reason === "refusal") return json({ ok: false, error: "La IA no pudo interpretar el texto." }, 200);
  if (data?.stop_reason === "max_tokens") return json({ ok: false, error: "El pedido salio muy largo y se corto. Divide el pedido en partes." }, 200);

  const txt = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let propuesta: any;
  try { propuesta = JSON.parse(txt); }
  catch { return json({ ok: false, error: "La IA no devolvio una propuesta valida. Reintenta." }, 200); }

  if (propuesta && typeof propuesta === "object") {
    // Segundo cinturón determinista: un modelo no puede colar un extra opcional
    // como cobrable si él mismo lo marcó sugerido.
    const sugerenciasDescartadas = [
      ...(Array.isArray(propuesta.items) ? propuesta.items.filter((x: any) => x?.sugerido === true).map((x: any) => x?.etiqueta || x?.producto) : []),
      ...(Array.isArray(propuesta.banco) ? propuesta.banco.filter((x: any) => x?.sugerido === true).map((x: any) => x?.etiqueta || x?.id) : []),
    ].filter(Boolean);
    propuesta.items = (Array.isArray(propuesta.items) ? propuesta.items : []).filter((x: any) => x?.sugerido !== true);
    propuesta.banco = (Array.isArray(propuesta.banco) ? propuesta.banco : []).filter((x: any) => x?.sugerido !== true);
    if (rondasAclaracion >= 2) propuesta.preguntas = [];
    return json({ ok: true, propuesta, uso: data?.usage || null, rondasAclaracion, sugerenciasDescartadas });
  }

  return json({ ok: true, propuesta, uso: data?.usage || null, rondasAclaracion });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
