// Slug temporal de verificación (equipo comprado). El fix ya está en prod
// (analizar-mueble, rama c3.4-seller-safe). Esta función queda NEUTRALIZADA:
// responde 410 Gone. Se puede borrar desde el dashboard de Supabase.
Deno.serve(() =>
  new Response(
    JSON.stringify({ ok: false, error: "Función de prueba retirada. Usa analizar-mueble." }),
    { status: 410, headers: { "content-type": "application/json" } },
  )
);
