// ============================================================================
// Edge Function: acomodar-espacio · solver espacial verificable de Voni.
// La IA puede ayudar a explicar, pero NO decide si algo cabe: solver + validador
// + repair-loop determinista son la única verdad del layout.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { acomodarConReparacion, planearDeterminista } from "./acomodo-core.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON invalido" }, 400); }
  let { areas, area, piezas } = body || {};
  if (!Array.isArray(areas)) areas = area ? [area] : [];
  if (!areas.length) return json({ ok: false, error: "Falta al menos un área (ancho × largo)." }, 400);
  if (!Array.isArray(piezas) || !piezas.length) return json({ ok: false, error: "Faltan las piezas." }, 400);

  // Tres estrategias, todas deterministas. Los intentos 2/3 NO vuelven a mover
  // lo que el validador ya declaró válido: reciben esas piezas como `fijas`.
  // Cambia orden/precisión del barrido para escapar mínimos locales sin azar.
  const estrategias = [
    { gapMM: 150, stepMM: 100, rotationOrder: [0, 90], reverseScan: false, reverseAreas: false },
    { gapMM: 150, stepMM: 50, rotationOrder: [90, 0], reverseScan: true, reverseAreas: false },
    { gapMM: 120, stepMM: 50, rotationOrder: [0, 90], reverseScan: false, reverseAreas: true },
  ];

  let resultado: any;
  try {
    resultado = await acomodarConReparacion({
      areas,
      piezas,
      maxIntentos: 3,
      proponer: async ({ intento, colocacionValidaPrevia }: any) => {
        const estrategia = estrategias[Math.min(estrategias.length - 1, Math.max(0, intento - 1))];
        const planeado = planearDeterminista(areas, piezas, {
          ...estrategia,
          fijas: colocacionValidaPrevia,
        });
        return {
          colocacion: planeado.colocacion,
          noColocadasSolver: planeado.noColocadas,
          estrategia: { ...estrategia, intento },
        };
      },
    });
  } catch (e) {
    return json({ ok: false, error: "No se pudo acomodar: " + String((e as any)?.message || e) }, 200);
  }

  const zonas = areas.map((a: any, i: number) => ({
    area: i,
    nombre: a.nombre || `Área ${i + 1}`,
    x: 0,
    y: 0,
    ancho: Number(a.ancho) || 0,
    largo: Number(a.largo) || 0,
  }));

  const completo = resultado.completo === true;
  const puertaPendiente = resultado?.puertas?.status === "UNVERIFIED";
  const resumen = completo
    ? `Acomodo aprobado: ${resultado.colocadas} pieza(s) en ${areas.length} área(s), con geometría, espacio funcional y puertas verificadas.`
    : puertaPendiente && resultado.colocadas === resultado.total
      ? `Acomodo geométricamente completo (${resultado.colocadas}/${resultado.total}), pero NO aprobable: falta verificar el barrido de ${resultado.puertas.noVerificadas.length} puerta(s).`
      : `Acomodo parcial: ${resultado.colocadas} de ${resultado.total} colocada(s). El motor no ocultó ni eliminó las restantes.`;

  const notas = completo
    ? []
    : [
        ...(puertaPendiente ? ["Hay puertas detectadas sin bisagra/sentido/barrido verificable."] : []),
        ...(resultado.intentos.at(-1)?.violaciones || []),
      ];

  return json({
    ok: true,
    plan: {
      ...(resultado.plan || {}),
      colocacion: resultado.colocacion || [],
      zonas,
      caben: completo,
      resumen,
      notas,
    },
    completo,
    aprobable: resultado.aprobable === true,
    colocadas: resultado.colocadas,
    total: resultado.total,
    porPieza: resultado.porPieza,
    noColocadas: resultado.noColocadas,
    recomendaciones: resultado.recomendaciones,
    intentos: resultado.intentos,
    calidad: resultado.calidad,
    puertas: resultado.puertas,
    advertencias: resultado.advertencias,
    metodo: "solver_espacial_repair_v1",
    uso: null,
  });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
