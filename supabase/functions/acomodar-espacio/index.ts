// ============================================================================
//  Edge Function: acomodar-espacio  (ACOMODO DE MOBILIARIO CON IA · multi-área)
//  Recibe una o VARIAS áreas rectangulares (cuartos) y una lista de muebles con
//  su huella real. Claude ASIGNA cada mueble a un área y PROPONE su posición
//  (x,y esquina sup-izq LOCAL al área, origen arriba-izq) y giro (0/90). El
//  FRONTEND dibuja los cuartos a escala y VERIFICA (bordes+traslapes) — auditable.
//  Requiere ANTHROPIC_API_KEY.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { validarColocacion, resumenViolaciones, recomendacionesParcial } from "./acomodo-core.js";\nimport { planearSemantico } from "./layout-semantico.js";

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

  // La IA ya NO decide coordenadas (lo hace el solver determinista), así que la
  // API key es OPCIONAL — el acomodo funciona sin red. Se conserva por si a
  // futuro se agrega una capa de narrativa/estrategia asistida por IA.
  const key = Deno.env.get("ANTHROPIC_API_KEY");

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

  // (areasTxt/lista quedan disponibles por si a futuro se agrega narrativa IA.)
  void areasTxt; void lista; void key; void SCHEMA;

  // ACOMODO DETERMINISTA: el SOLVER coloca (coordenadas válidas por construcción)
  // y el VALIDADOR decide. Antes la IA "adivinaba" coordenadas y el validador
  // determinista las rechazaba (IA propone → determinista rechaza). Ahora no:
  // una sola verdad geométrica. Soporta polígono/puertas/obstáculos si el área
  // los trae; con áreas rectangulares simples funciona igual (compat).
  let planeado: any;
  try {
    planeado = planearSemantico(areas, piezas, { gapMM: 150, stepMM: 100 });
  } catch (e) {
    return json({ ok: false, error: "No se pudo acomodar: " + String((e as any)?.message || e) }, 200);
  }
  const val = validarColocacion(areas, piezas, planeado.colocacion);

  const zonas = areas.map((a: any, i: number) => ({
    area: i, nombre: a.nombre || `Área ${i + 1}`,
    x: 0, y: 0, ancho: Number(a.ancho) || 0, largo: Number(a.largo) || 0,
  }));

  const completo = val.ok;
  const recomendaciones = completo ? [] : recomendacionesParcial(val);
  const resumen = completo
    ? `Acomodo completo: ${val.colocadas} pieza(s) en ${areas.length} área(s), sin traslapes ni bloqueos de puerta.`
    : `Acomodo parcial: ${val.colocadas} de ${val.total} colocada(s). Faltan ${val.noColocadas.length} (ver detalle por pieza).`;

  // Contrato de SALIDA: compatible con el frontend (plan.colocacion/zonas/caben/
  // resumen/notas) + campos deterministas nuevos. completo=false ⇒ plan.caben=false
  // ⇒ el frontend mantiene fail-closed del render/PDF final.
  return json({
    ok: true,
    plan: {
      colocacion: planeado.colocacion,
      zonas,
      caben: completo,
      resumen,
      notas: completo ? [] : [`${val.noColocadas.length} pieza(s) sin colocar.`, ...resumenViolaciones(val)],
    },
    completo,
    colocadas: val.colocadas,
    total: val.total,
    porPieza: val.porPieza,
    noColocadas: val.noColocadas,
    recomendaciones,
    intentos: [{ intento: 1, motor: "solver_determinista", colocadas: val.colocadas, total: val.total, violaciones: resumenViolaciones(val) }],
    metodo: "solver_semantico_determinista",
    uso: null,
  });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
