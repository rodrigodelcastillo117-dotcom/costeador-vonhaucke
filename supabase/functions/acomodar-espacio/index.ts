// ============================================================================
//  Edge Function: acomodar-espacio  (ACOMODO DE MOBILIARIO CON IA · multi-área)
//  Recibe una o VARIAS áreas rectangulares (cuartos) y una lista de muebles con
//  su huella real. Claude ASIGNA cada mueble a un área y PROPONE su posición
//  (x,y esquina sup-izq LOCAL al área, origen arriba-izq) y giro (0/90). El
//  FRONTEND dibuja los cuartos a escala y VERIFICA (bordes+traslapes) — auditable.
//  Requiere ANTHROPIC_API_KEY.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { acomodarConReparacion } from "./acomodo-core.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    colocacion: {
      type: "array",
      description: "Una entrada por cada pieza recibida (mismo id).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          area: { type: "number", description: "Índice del área/cuarto donde va (0-based, según la lista recibida)." },
          x: { type: "number", description: "Esquina superior-izquierda X en mm, LOCAL al área." },
          y: { type: "number", description: "Esquina superior-izquierda Y en mm, LOCAL al área." },
          rot: { type: "number", enum: [0, 90] },
        },
        required: ["id", "area", "x", "y", "rot"],
      },
    },
    zonas: {
      type: "array",
      description: "Agrupaciones para etiquetar dentro de un área (opcional).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "number" },
          nombre: { type: "string" },
          x: { type: "number" }, y: { type: "number" }, ancho: { type: "number" }, largo: { type: "number" },
        },
        required: ["area", "nombre", "x", "y", "ancho", "largo"],
      },
    },
    caben: { type: "boolean" },
    resumen: { type: "string", description: "1-2 frases amables para el cliente sobre el acomodo." },
    notas: { type: "array", items: { type: "string" } },
  },
  required: ["colocacion", "zonas", "caben", "resumen", "notas"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ ok: false, error: "Falta ANTHROPIC_API_KEY" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON invalido" }, 400); }
  let { areas, area, piezas } = body || {};
  if (!Array.isArray(areas)) areas = area ? [area] : []; // compatibilidad con una sola área
  if (!areas.length) return json({ ok: false, error: "Falta al menos un área (ancho × largo)." }, 400);
  if (!Array.isArray(piezas) || !piezas.length) return json({ ok: false, error: "Faltan las piezas." }, 400);

  const areasTxt = areas.map((a: any, i: number) => `  [${i}] ${a.nombre || "Área " + (i + 1)}: ${a.ancho} × ${a.largo} mm`).join("\n");
  const lista = piezas
    .map((p: any) => `${p.id}: ${p.nombre} — huella ${Math.round(p.w)}×${Math.round(p.d)} mm (tipo ${p.tipo || "mueble"})`)
    .join("\n");

  const baseSystem =
    "Eres un space planner senior de oficinas (como el que dibuja en AutoCAD). Te doy uno o varios ÁREAS (cuartos, con su medida real) y una lista de muebles con su huella real. " +
    "Piensa como al planear un despacho de verdad: primero DECIDE el uso de cada cuarto por su nombre y tamaño, agrupa los muebles en CONJUNTOS lógicos, y recién entonces coloca cada pieza. " +
    "Coordenadas LOCALES a cada área: origen (0,0) arriba-izquierda de ESE cuarto; X = ancho, Y = largo; en mm.\n\n" +
    "CÓMO ACOMODAR (piensa así):\n" +
    "1) ASIGNA por uso: 'open space/operativo' = las islas de estaciones de trabajo; 'privado/dirección' = 1 estación + su guarda; 'juntas/consejo' = la mesa centrada con paso alrededor; 'recepción' = mueble junto al acceso; los archiveros/guardas se REPARTEN pegados a muro cerca de las estaciones a las que sirven (NO todos apilados en una sola columna).\n" +
    "2) BENCHING: junta las estaciones en ISLAS ordenadas (bloques alineados, en hilera o back-to-back), todas con el MISMO giro dentro de la isla. Entre islas deja pasillo ≥ 1000 mm; detrás de una silla ≥ 900 mm para salir. Alinéalas a una retícula (mismos x o y).\n" +
    "3) MESA DE JUNTAS: céntrala en su cuarto dejando ≥ 900 mm libres en los 4 lados para sillas y paso.\n" +
    "4) USA EL CUARTO: distribuye los conjuntos para aprovechar el espacio (no encimes todo en una esquina ni dejes medio cuarto vacío), pero deja circulaciones reales. Pega contra muro lo que va contra muro (guardas, credenzas).\n" +
    "5) Cada pieza cabe COMPLETA dentro de su área. rot=0 ocupa w(X)×d(Y); rot=90 ocupa d(X)×w(Y). NADA se traslapa.\n" +
    "6) Devuelve una entrada por CADA id (su 'area' índice, x, y enteros en mm, rot). Marca 'zonas' con nombre para los conjuntos (ej. 'Isla de trabajo', 'Juntas', 'Guarda') para que el plano se lea claro.\n" +
    "7) Si NO cabe todo con holgura, mete lo que quepa BIEN, pon caben=false y en 'notas' di cuántas piezas no entraron y qué recomiendas (menos densidad, otro cuarto, o reducir cantidad). Es mejor un plano realista que forzar todo.\n" +
    "8) 'resumen': 1-2 frases para el cliente, en lenguaje sencillo, diciendo qué quedó en cada zona.\n\n" +
    `ÁREAS (${areas.length}):\n${areasTxt}\n\nMUEBLES (${piezas.length}):\n${lista}`;

  // Addendum de REPARACIÓN: en los reintentos se corrige SOLO lo inválido, sin
  // mover lo ya válido, usando las violaciones concretas del intento anterior.
  function systemDeIntento(intento: number, violaciones: string[], validas: any[]) {
    if (intento <= 1 || !violaciones?.length) return baseSystem;
    return baseSystem +
      `\n\nREINTENTO ${intento} (REPARACIÓN). El intento anterior dejó estas violaciones — corrígelas exactamente:\n` +
      violaciones.map((v) => "- " + v).join("\n") +
      "\n\nMANTÉN EXACTAS estas colocaciones que YA son válidas (NO las muevas):\n" +
      JSON.stringify(validas) +
      "\n\nReposiciona ÚNICAMENTE las piezas con violación para que quepan completas y sin traslape. " +
      "NO inventes muebles, NO cambies cantidades, NO reduzcas piezas para 'hacerlo caber'. Devuelve TODAS las piezas (las válidas igual que estaban).";
  }

  let ultimaUsage: any = null;
  // Proposer inyectable: una llamada a Claude por intento. El bucle y la
  // validación viven en acomodo-core (deterministas y testeables).
  async function proponer({ intento, violacionesPrevias, colocacionValidaPrevia }: any) {
    const apiBody = {
      model: "claude-opus-5",
      max_tokens: 8000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: systemDeIntento(intento, violacionesPrevias, colocacionValidaPrevia),
      messages: [{ role: "user", content: [{ type: "text", text: intento > 1
        ? "Corrige SOLO las piezas inválidas listadas; conserva las válidas en su posición exacta. Devuelve todas las piezas."
        : "Acomoda estos muebles en las áreas con un layout profesional y circulaciones cómodas." }] }],
    };
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(apiBody),
    });
    const data = await r.json();
    if (data?.type === "error") throw new Error(data.error?.message || "Error de la API");
    if (data?.stop_reason === "max_tokens") throw new Error("El acomodo salió muy grande y se cortó. Divide en menos piezas o áreas.");
    ultimaUsage = data?.usage || ultimaUsage;
    const txt = (data?.content || []).find((b: any) => b.type === "text")?.text || "";
    return JSON.parse(txt); // si no es JSON válido, el core registra el intento fallido y sigue
  }

  let resultado: any;
  try {
    resultado = await acomodarConReparacion({ areas, piezas, proponer, maxIntentos: 3 });
  } catch (e) {
    return json({ ok: false, error: "No se pudo acomodar: " + String((e as any)?.message || e) }, 200);
  }

  // Contrato de SALIDA: compatible con el frontend (plan.colocacion/zonas/caben/
  // resumen/notas) + campos deterministas nuevos. `completo=false` ⇒ acomodo
  // PARCIAL: el frontend NO debe permitir render/PDF final (fail-closed se
  // mantiene en cliente y aquí plan.caben queda en false).
  return json({
    ok: true,
    plan: resultado.plan,
    completo: resultado.completo,
    colocadas: resultado.colocadas,
    total: resultado.total,
    porPieza: resultado.porPieza,
    noColocadas: resultado.noColocadas,
    recomendaciones: resultado.recomendaciones,
    intentos: resultado.intentos,
    uso: ultimaUsage,
  });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
