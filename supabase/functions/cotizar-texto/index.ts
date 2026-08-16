// ============================================================================
//  Edge Function: cotizar-texto  (COTIZADOR CONVERSACIONAL)
//  Recibe un texto en lenguaje natural (lo que pide el cliente / el vendedor)
//  + el catalogo compacto de las lineas (ruta -> productos -> params) y devuelve
//  una lista de ITEMS estructurados {ruta, producto, seleccion, cantidad} que el
//  FRONTEND cuesta con el MOTOR determinista y agrega a la cotizacion.
//  La IA solo INTERPRETA y mapea; el precio lo pone el motor. Requiere ANTHROPIC_API_KEY.
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
        type: "object",
        additionalProperties: false,
        properties: {
          ruta: { type: "string", description: "clave EXACTA de la linea del catalogo (ej. 'cirque', 'modulor')." },
          producto: { type: "string", description: "id EXACTO del producto dentro de esa linea (ej. 'escritorio')." },
          cantidad: { type: "number", description: "cuantas piezas. Si no lo dicen, 1." },
          seleccion: {
            type: "array",
            description: "Opciones elegidas. Cada par {clave,valor} usa una clave de 'params' del producto y un valor permitido. Para 'checks', incluye el par solo si va ACTIVADO (valor 'si'). Omite lo que no apliques.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { clave: { type: "string" }, valor: { type: "string" } },
              required: ["clave", "valor"],
            },
          },
          etiqueta: { type: "string", description: "Como lo describirias en 1 linea (ej. 'Bench Cirque 1.20 m, 6 puestos, melamina')." },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          nota: { type: "string", description: "Supuestos que tomaste o por que dudas. Vacio si todo claro." },
        },
        required: ["ruta", "producto", "cantidad", "seleccion", "etiqueta", "confianza", "nota"],
      },
    },
    // Piezas del BANCO DE PRECIOS: no se configuran, se piden por id. Aquí está
    // la sillería, que antes no existía para Voni y por eso contestaba que el
    // catálogo no tenía sillas — dejando fuera un pedazo grande del proyecto.
    banco: {
      type: "array",
      description: "Piezas del banco de precios (sillería, complementos, electrificación) que el usuario necesita. Se piden por id EXACTO del banco.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "id EXACTO de la pieza en __banco.piezas." },
          cantidad: { type: "number" },
          etiqueta: { type: "string", description: "Como lo describirias en 1 linea." },
          nota: { type: "string", description: "Por que la elegiste. Vacio si es obvio." },
        },
        required: ["id", "cantidad", "etiqueta", "nota"],
      },
    },
    preguntas: { type: "array", items: { type: "string" }, description: "Solo lo ESENCIAL a confirmar (acabado, medida, cantidad) cuando de verdad falte. Vacio si el texto basta." },
    resumen: { type: "string", description: "1 frase amable de que entendiste (para el vendedor)." },
    noEncontrado: { type: "array", items: { type: "string" }, description: "Cosas que pidieron pero NO existen en el catalogo (para avisar)." },
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

  const system =
    "Eres el asistente experto de cotizacion de Von Haucke (mobiliario de oficina). " +
    "Tu trabajo: convertir lo que pide el cliente/vendedor (en lenguaje natural) en RENGLONES estructurados de cotizacion, mapeandolos al CATALOGO real. Tu NO das precios: el motor de la app cuesta cada renglon.\n\n" +
    "REGLAS:\n" +
    "1) Usa SOLO 'ruta' y 'producto' que existan en el catalogo (claves e ids EXACTOS). Si piden algo que no existe, ponlo en 'noEncontrado' y NO lo inventes como item.\n" +
    "2) En 'seleccion' cada 'clave' debe ser una de las de 'params' del producto y el 'valor' uno de los permitidos (para dimensiones el valor es el numero como texto, ej. '1200'). Para 'checks' (lista de nombres) agrega el par {clave:<nombre>, valor:'si'} SOLO si el usuario lo pide activado.\n" +
    "3) Si no especifican una opcion, ELIGE un default sensato (medida mas comun, acabado melamina/ABS) y dilo breve en 'nota'; no llenes 'preguntas' con todo, solo lo esencial que cambie el precio de forma importante.\n" +
    "4) Respeta cantidades del texto (ej. '15 estaciones' -> cantidad 15). Un renglon por tipo/config distinta.\n" +
    "5) Se practico: mejor un item con supuestos marcados (confianza media/baja + nota) que dejar todo en preguntas. Termina SIEMPRE el JSON.\n" +
    "6) EL CATALOGO TIENE DOS PARTES:\n" +
    "   a) las LINEAS (se configuran con params): escritorios, bancas, mesas, guardas, recepciones.\n" +
    "   b) '__banco': piezas con PRECIO REAL de presupuestos ya cerrados, que NO se configuran. " +
    "Se piden por id en el arreglo 'banco'. AHI ESTA LA SILLERIA: sillas operativas, de visita, de " +
    "juntas, bancos altos y sofas. Un proyecto de oficina casi siempre lleva sillas: no las omitas " +
    "y NO digas que no hay sillas en el catalogo.\n" +
    "7) EL BANCO TRAE PRECIO. Uselo como criterio: si el cliente habla de presupuesto ajustado o de " +
    "obra economica, elige lo mas barato que cumpla; si habla de direccion, sala de consejo o " +
    "acabado premium, elige lo de mayor precio. Di en 'nota' por que elegiste esa.\n" +
    "8) JERARQUIA DE LINEAS OPERATIVAS, de mas premium a mas economica: CIRQUE > RIO > APP LT. " +
    "Si el texto no dice el nivel, usa App LT (la de volumen) y menciona en 'nota' que existe la " +
    "version premium.\n\n" +
    // REGLAS DEL OFICIO — las dicta Rodrigo desde la pantalla "Lo que Voni sabe"
    // (tabla `reglas` en Supabase). Hasta el 2026-08-16 esta tabla NO llegaba a
    // ningun modelo: `reglasTexto()` estaba exportada y no la llamaba nadie, asi
    // que la pantalla enseñaba reglas que Voni no sabia. Van al FINAL y con
    // prioridad explicita para que ganen sobre lo de arriba: son la voz del
    // dueño del negocio y se actualizan sin volver a publicar nada.
    (Array.isArray(reglas) && reglas.length
      ? "\n\nREGLAS DE LA CASA (las dicta la Direccion de Von Haucke y MANDAN sobre " +
        "cualquier criterio anterior; si alguna contradice lo de arriba, obedece esta y " +
        "dilo en 'nota'):\n" + reglas.join("\n") + "\n"
      : "") +
    // LO QUE YA TE CORRIGIERON. Cada vez que un vendedor aclara algo que Voni no
    // entendio, esa leccion queda guardada y vuelve aqui dentro del siguiente
    // pedido. Es como aprende sin que nadie tenga que aprobar nada: rapido y
    // reversible. Van DESPUES de las reglas de la casa porque pesan menos: una
    // leccion es la experiencia de un vendedor, una regla es la voz de Direccion.
    (Array.isArray(aprendizajes) && aprendizajes.length
      ? "\n\nLO QUE YA TE CORRIGIERON ANTES (aprende de esto y NO lo vuelvas a " +
        "repetir; si algo de aqui no aplica a este pedido, ignoralo y ya):\n" +
        aprendizajes.join("\n") + "\n"
      : "") +
    "\nCATALOGO (JSON: ruta -> {titulo, productos:[{id, nombre, params:{clave:[valores permitidos]}, checks:[nombres]}]}):\n" +
    JSON.stringify(catalogo);

  const apiBody = {
    model: "claude-opus-5",
    max_tokens: 8000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system,
    messages: [{ role: "user", content: [{ type: "text", text: "Cotiza esto:\n\n" + String(texto).slice(0, 6000) }] }],
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
  if (data?.stop_reason === "refusal") return json({ ok: false, error: "La IA no pudo interpretar el texto." }, 200);
  if (data?.stop_reason === "max_tokens") return json({ ok: false, error: "El pedido salio muy largo y se corto. Divide el pedido en partes." }, 200);

  const txt = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let propuesta: any;
  try { propuesta = JSON.parse(txt); }
  catch { return json({ ok: false, error: "La IA no devolvio una propuesta valida. Reintenta." }, 200); }

  return json({ ok: true, propuesta, uso: data?.usage || null });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
