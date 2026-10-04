// ============================================================================
//  Edge Function: leer-plano  (LEE UN PLANO / LAYOUT y saca las ÁREAS)
//  Recibe la imagen de un plano (AutoCAD exportado a imagen/PDF-render) y
//  devuelve la lista de cuartos/áreas con su FORMA REAL y sus medidas en mm,
//  para pre-llenar el acomodo. Si no hay cotas, estima y lo marca.
//  Requiere ANTHROPIC_API_KEY.
//
//  v2 (2026-08-16) — POR QUÉ CAMBIÓ EL ESQUEMA:
//  Rodrigo subió una planta orgánica (sala de juntas CIRCULAR de Ø7 m dentro
//  del open space, recepción TRIANGULAR, break room TRAPEZOIDAL y las oficinas
//  detrás de un muro CURVO) y la app dibujó nueve cajas rectas encimadas. No
//  fue que el modelo leyera mal: el esquema sólo tenía ancho/largo, así que la
//  única respuesta posible era una caja. Ahora cada área entrega su CONTORNO
//  (polígono en mm) o su círculo, más el ENVOLVENTE del conjunto tomado de la
//  cota general. El motor de acomodo y el plano ya sabían trabajar con
//  polígonos (venía del lienzo "Dibujar mi oficina"); el lector era el único
//  eslabón que no los producía.
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
    x: { type: "number", description: "mm desde el borde IZQUIERDO del envolvente." },
    y: { type: "number", description: "mm desde el borde SUPERIOR del envolvente (crece hacia abajo)." },
  },
  required: ["x", "y"],
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    envolvente: {
      type: "object",
      additionalProperties: false,
      description: "Caja que encierra TODO el conjunto construido, tomada de la cota general del plano.",
      properties: {
        ancho: { type: "number", description: "Ancho total en mm (eje horizontal)." },
        largo: { type: "number", description: "Largo total en mm (eje vertical)." },
      },
      required: ["ancho", "largo"],
    },
    // COTAS DEL GRID (ejes). Permiten VALIDAR la envolvente de forma determinista:
    // la suma de los segmentos debe cuadrar con ancho/largo (cota > escala > IA).
    grid: {
      type: "object",
      additionalProperties: false,
      description: "Las cotas de los ejes, segmento por segmento, en mm. Ej. ejes A-E con 4.00+4.00+4.00+3.00 → horizontal:[4000,4000,4000,3000]. Vacío si el plano no trae cotas de ejes.",
      properties: {
        horizontal: { type: "array", items: { type: "number" }, description: "Segmentos horizontales (entre ejes verticales A,B,C…) en mm, de izquierda a derecha." },
        vertical: { type: "array", items: { type: "number" }, description: "Segmentos verticales (entre ejes horizontales 1,2,3…) en mm, de arriba a abajo." },
      },
      required: ["horizontal", "vertical"],
    },
    areas: {
      type: "array",
      description: "Un cuarto/área por entrada, con su FORMA REAL en mm.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          nombre: { type: "string", description: "Nombre o uso del cuarto tal como se lee en el plano (ej. 'Oficina 1', 'Recepción')." },
          tipo: { type: "string", enum: ["open", "privado", "juntas", "recepcion", "lounge", "servicio"], description: "Para qué se usa el cuarto." },
          // El esquema viejo sólo tenía ancho/largo y por eso una sala circular
          // salía cuadrada y un open space en L salía rectangular.
          forma: { type: "string", enum: ["poligono", "circulo"], description: "'circulo' SÓLO si el cuarto es realmente redondo/ovalado; si no, 'poligono'." },
          puntos: {
            type: "array",
            description: "Contorno del cuarto en orden (horario), en mm absolutos. Obligatorio si forma='poligono': 4 puntos si es rectangular, 3 si es triangular, 4 si es trapecio, y de 8 a 16 si algún muro es CURVO (puntos sobre la curva). Si forma='circulo', deja la lista vacía.",
            items: PUNTO,
          },
          circulo: {
            type: "object",
            additionalProperties: false,
            description: "Sólo si forma='circulo'. Si es polígono, manda ceros.",
            properties: {
              cx: { type: "number", description: "Centro x en mm." },
              cy: { type: "number", description: "Centro y en mm." },
              r: { type: "number", description: "Radio en mm (la mitad del diámetro que dice la cota)." },
            },
            required: ["cx", "cy", "r"],
          },
          // Una sala de juntas circular DENTRO del open space no es un traslape:
          // es un cuarto anidado. Sin este campo la validación la rechazaba.
          dentroDe: { type: "string", description: "Nombre del área que CONTIENE a ésta (una sala cerrada dentro del open space). Cadena vacía si no está dentro de ninguna." },
          // El número de puestos NO se estima por área: es el conteo de los
          // escritorios REALMENTE DIBUJADOS en esta zona. Viaja como dato duro
          // para que el cliente no lo recalcule por geometría (antes salían 18
          // donde el plano dibujaba 8).
          puestos: { type: "integer", description: "SÓLO para zonas/islas de trabajo con escritorios DIBUJADOS: cuenta los puestos (escritorios/posiciones) que REALMENTE se ven dibujados en ESTA zona. NO estimes por área: cuenta uno por cada escritorio con su silla. 0 para cuartos sin puestos de trabajo (privados, salas, servicio, recepción, o el salón contenedor cuyos puestos ya están en sus islas)." },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
        },
        required: ["nombre", "tipo", "forma", "puntos", "circulo", "dentroDe", "puestos", "confianza"],
      },
    },
    // Sin puertas, el motor amuebla tapando accesos y además no puede
    // comprobar que se LLEGUE caminando a cada puesto. Van aparte de las áreas
    // porque una puerta pertenece al muro, no al cuarto.
    puertas: {
      type: "array",
      description: "Puertas y accesos del plano. Suelen verse como un vano en el muro, a veces con el arco de barrido o marcados en otro color.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          x: { type: "number", description: "Centro del vano, mm desde el borde izquierdo del envolvente." },
          y: { type: "number", description: "Centro del vano, mm desde el borde superior del envolvente." },
          ancho: { type: "number", description: "Ancho del vano en mm (una puerta normal ~900)." },
        },
        required: ["x", "y", "ancho"],
      },
    },
    escala: { type: "string", description: "De qué cota saliste para la escala (ej. 'cota general 30.00 m en el borde inferior')." },
    tieneCotas: { type: "boolean", description: "¿El plano trae cotas/medidas legibles?" },
    notas: { type: "array", items: { type: "string" }, description: "Supuestos; pide 1 medida de referencia si no hay cotas." },
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

  const system =
    "Eres un arquitecto que levanta la planta de un plano de oficina. Te doy la imagen de un plano. " +
    "Devuelve la FORMA REAL de cada cuarto en MILÍMETROS. No aproximes a rectángulos: si un cuarto es " +
    "triangular, trapezoidal, curvo o redondo, dilo con sus puntos.\n\n" +
    "TRABAJA EN ESTE ORDEN:\n" +
    "PASO 1 · ESCALA Y ENVOLVENTE. Busca primero las cotas generales (las flechas largas de los bordes, " +
    "tipo '30.00 m' abajo y '20.00 m' a la izquierda) y con ellas fija el envolvente en mm. TODO lo demás " +
    "se mide contra esa escala; no inventes medidas redondas que no vengan del plano.\n" +
    "PASO 2 · CONTORNOS. Recorre el plano cuarto por cuarto y traza su contorno con puntos, en mm.\n" +
    "PASO 3 · PUERTAS. Marca el centro y el ancho de CADA puerta o acceso. Son el vano en el muro, muchas\n" +
    "veces con el arco de barrido dibujado o pintadas de otro color. Sin ellas el acomodo tapa las entradas.\n\n" +
    "SISTEMA DE COORDENADAS:\n" +
    "· El origen (0,0) es la esquina SUPERIOR IZQUIERDA del envolvente.\n" +
    "· x crece hacia la derecha; y crece hacia ABAJO.\n" +
    "· Todos los puntos van en mm absolutos dentro del envolvente.\n\n" +
    "CÓMO DESCRIBIR CADA FORMA:\n" +
    "· Rectangular → 4 puntos (las esquinas).\n" +
    "· Triangular → 3 puntos. Trapezoidal → 4 puntos, con sus lados inclinados de verdad.\n" +
    "· Muro CURVO (por ejemplo un pasillo curvo que separa el open space de las oficinas) → traza la curva " +
    "con 8 a 16 puntos sobre ella; el resto del contorno con sus esquinas. NO la conviertas en línea recta.\n" +
    "· Sala REDONDA u ovalada → forma='circulo' con centro y radio (la cota suele dar el diámetro: el radio " +
    "es la mitad). Deja 'puntos' vacío.\n" +
    "· Un cuarto CERRADO que está DENTRO de otro (una sala de juntas en medio del open space) se declara " +
    "igual, y además pone en 'dentroDe' el nombre del área que lo contiene. Eso NO es un error de traslape.\n\n" +
    "REGLAS:\n" +
    "1) Si el plano trae COTAS, úsalas (tieneCotas=true). Normaliza a mm (si ves metros, ×1000).\n" +
    "2) Si NO hay cotas, ESTIMA con proporciones y estándares (puerta ~900 mm, mobiliario típico), marca " +
    "confianza 'baja' y en 'notas' pide 1 medida de referencia real para calibrar.\n" +
    (refMM ? `3) El usuario indica que una referencia mide ${refMM} mm; úsala para escalar.\n` : "") +
    "4) Nombra cada área como la nombra el plano; si no tiene nombre, 'Área 1', 'Área 2'.\n" +
    "5) No inventes cuartos que no estén en el plano, y no te saltes ninguno.\n" +
    "6) Clasifica en 'tipo': open (área abierta de trabajo), privado (oficina cerrada de 1-2 personas), " +
    "juntas (sala de juntas/consejo), recepcion, lounge (comedor/estar), servicio (baño, cocineta, ducto, " +
    "escalera, bodega, SITE/IT). Los de servicio NO se amueblan.\n" +
    "7) ISLAS DE TRABAJO (CRÍTICO para contar puestos bien). Dentro de un área 'open' suele haber uno o varios " +
    "CLUSTERS de escritorios/bancas dibujados (grupos de rectángulos con una silla/círculo cada uno, p.ej. dos " +
    "bloques de 4 posiciones). Declara CADA cluster como un área aparte con tipo='open', su contorno REAL " +
    "(sólo el cluster, no todo el salón) y 'dentroDe'=nombre del área que lo contiene. NO estimes los puestos " +
    "dividiendo el salón entero: el número de puestos sale de los escritorios DIBUJADOS en cada isla. Pon ese " +
    "conteo en el campo 'puestos' de la isla (cuenta uno por cada escritorio con su silla que veas dibujado). " +
    "El salón contenedor lleva puestos=0 (sus puestos ya están repartidos en las islas). No embebas el número en " +
    "el nombre; va en 'puestos'. Si el open no tiene mobiliario dibujado, no inventes islas.\n" +
    "8) NO es mobiliario ni cuarto: las líneas PUNTEADAS/azules de DUCTOS HVAC (a veces con una X), las líneas de " +
    "corte, los ejes y las cotas. Ignóralos. Los SANITARIOS son tipo='servicio' (no fabricamos escusados ni " +
    "lavabos): no los cuentes como sillas ni muebles.\n" +
    "9) GRID: extrae las cotas de los ejes a 'grid' (horizontal y vertical, en mm, segmento por segmento). " +
    "La SUMA de cada lista debe cuadrar con la envolvente — si no cuadra, revísala: la cota manda sobre el dibujo.\n\n" +
    "ANTES DE RESPONDER, COMPRUEBA:\n" +
    "a) El envolvente coincide con la cota general del plano.\n" +
    "b) Ningún punto se sale del envolvente (0 ≤ x ≤ ancho, 0 ≤ y ≤ largo).\n" +
    "c) Dos áreas que NO están anidadas no se encinan: si comparten muro, comparten esos puntos.\n" +
    "d) La suma de las superficies no pasa la del envolvente.\n" +
    "e) Cada contorno tiene los puntos suficientes para que su forma se reconozca sin la imagen.\n" +
    "f) Cada puerta cae SOBRE un muro, no en medio de un cuarto ni en el aire.";

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
        { type: "text", text: "Levanta este plano: envolvente por las cotas generales y luego el contorno real de cada cuarto, en mm." },
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
  if (data?.stop_reason === "refusal") return json({ ok: false, error: "No se pudo leer el plano." }, 200);

  const txt = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
  let lectura: any;
  try { lectura = JSON.parse(txt); }
  catch { return json({ ok: false, error: "La IA no devolvió una lectura válida. Reintenta." }, 200); }

  return json({ ok: true, lectura, uso: data?.usage || null });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
