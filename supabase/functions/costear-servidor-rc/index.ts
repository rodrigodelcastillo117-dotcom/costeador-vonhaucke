// ============================================================================
//  Edge Function: costear-servidor-rc  (COPIA RC del motor autoritativo para medir paridad con la rama; producción no la usa)
// ----------------------------------------------------------------------------
//  El costo deja de depender del cliente. El SERVIDOR carga config/insumos/
//  parámetros (service role), corre EL MISMO motor (src/motor/calculo.js — NO un
//  clon) y devuelve el resultado FILTRADO POR ROL. El cliente nunca manda costos
//  ni precios: solo el despiece (pieza) y la cantidad.
//
//  SHADOW MODE: es ADITIVA. No cierra `config`, no cambia RLS, no sustituye el
//  motor del cliente. Sirve para (A) probar equivalencia al centavo contra el
//  motor actual y (B) ser la superficie segura a la que Ventas migrará DESPUÉS.
//
//  Criterios (contrato): mismo motor · servidor autoritativo · salida por
//  capacidad · fail-closed (no inventa $0) · snapshot reproducible (versionMotor
//  + versionConfig + fecha) · idempotente · ignora costos/margen/rol que venga
//  del request. Requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// DTO ESTRICTO — la MISMA frontera que usa el cliente (sin duplicar lógica). Rechaza
// cualquier campo económico (margen, precio, costo, insumo inline, factores,
// modeloCosteo…) del body antes de tocar el motor. Ver src/datos/validarIntentCosteo.js.
import { validarIntentCosteo } from "../../../src/datos/validarIntentCosteo.js";
// Cierre GO (14-oct): el NÚCLEO del costeo (config/catálogo autoritativos, reconciliación de material, MISMO motor, estado,
// registro SEG-01c y salida por capacidad) vive en src/datos/costeoServidor.js. Esta Edge sólo autentica y responde; las
// pruebas del pipeline llaman a LAS MISMAS funciones (atenderCosteo / costearConMotor) con un cliente PGlite.
import { costearConMotor, atenderCosteo } from "../../../src/datos/costeoServidor.js";
import { puedeConfirmarMaterial } from "../../../src/datos/materialMatch.js";
// COCREAR 10 (D-02/D-03): costeo y validación de ingeniería de una CO-CREACIÓN guardada. El navegador
// sólo manda { accion:"cocrear", expediente_id, validar_ingenieria?, visual_hash? }; el BOM se lee del
// expediente (service role) y la fila resultante la lee registrar_producto_desde_expediente.
import { esSolicitudCocrear, validarSolicitudCocrear, accesoACocreacion, piezaDeCocreacion, decidirValidacionIngenieria, filaCostoCocreacion, respuestaCocreacionPorRol, precioSugeridoCocreado } from "../../../src/datos/cocrearServidor.js";
// Validador estructural determinista (el mismo que ve Costear): un bloqueo impide validar ingeniería.
import { revisarEstructura } from "../../../src/datos/revisionEstructural.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!URL || !SERVICE) return json({ ok: false, error: "Falta configuración del servidor." }, 500);

  // --- Identidad del usuario (de SU JWT, no del body) ---
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "No autenticado." }, 401);
  let email = "";
  try {
    const userClient = createClient(URL, ANON || SERVICE, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    email = u?.user?.email || "";
  } catch (_e) { email = ""; }
  if (!email) return json({ ok: false, error: "Sesión inválida." }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, code: "INVALID_INPUT", error: "JSON inválido" }, 400); }

  // --- MODO COCREAR (D-02/D-03): costeo + validación de ingeniería de una co-creación GUARDADA ---
  if (esSolicitudCocrear(body)) {
    const sol = validarSolicitudCocrear(body);
    if (!sol.ok) return json({ ok: false, code: sol.code, issues: sol.issues }, 400);
    const svcC = createClient(URL, SERVICE);
    const { data: permitC } = await svcC.from("permitidos").select("rol").eq("email", email).maybeSingle();
    if (!permitC) return json({ ok: false, error: "Usuario no autorizado." }, 403);
    const rolC = String(permitC.rol || "").toLowerCase();
    const { data: exp, error: expErr } = await svcC.from("expedientes")
      .select("id, creado_por, revision, analysis_hash, cocrear").eq("id", sol.solicitud.expedienteId).maybeSingle();
    if (expErr) return json({ ok: false, error: "No se pudo leer el expediente." }, 502);
    if (!exp) return json({ ok: false, code: "NO_EXISTE", error: "La co-creación no existe." }, 404);
    if (!accesoACocreacion({ rol: rolC, email, creadoPor: exp.creado_por })) return json({ ok: false, code: "SIN_ACCESO", error: "Sin acceso a esta co-creación." }, 403);
    const pz = piezaDeCocreacion(exp.cocrear);
    if (!pz.ok) return json({ ok: false, code: pz.code, error: pz.motivo }, 409);
    // MISMO DTO estricto que el costeo normal (el BOM guardado también pasa por la frontera).
    const vC = validarIntentCosteo({ cantidad: 1, pieza: pz.pieza });
    if (!vC.ok) return json({ ok: false, code: "BOM_INVALIDO", issues: vC.issues }, 422);
    // La confirmación de material guardada en el BOM sólo cuenta si QUIEN costea ahora tiene la
    // capability (fail-closed: un vendedor no hereda confirmaciones; su costeo queda incompleto/preliminar).
    const puedeConfirmarC = puedeConfirmarMaterial(rolC);
    const piezaC = puedeConfirmarC ? vC.intent.pieza
      : { ...vC.intent.pieza, componentes: vC.intent.pieza.componentes.map((c: any) => { const { material_confirmado, ...x } = c; return x; }) };
    const k = await costearConMotor(svcC, piezaC, 1, puedeConfirmarC);
    if (k.error) return json(k.error.body, k.error.status);
    const estructura = revisarEstructura({ componentes: pz.pieza.componentes, descripcion: String(exp.cocrear?.brief || ""), insumos: k.insumos });
    const bloqueos = (estructura.observaciones || []).filter((o: any) => o.nivel === "blocker").map((o: any) => String(o.mensaje || o.tipo || "bloqueo"));
    const decision = decidirValidacionIngenieria({
      solicitada: sol.solicitud.validarIngenieria, rol: rolC, emitible: k.emision.emitible, estado: k.estado,
      visualHashCliente: sol.solicitud.visualHash, visualHashServidor: pz.visualHash, bloqueosEstructura: bloqueos,
    });
    const emitibleC = k.emision.emitible && k.estado !== "incompleto" && k.estado !== "bloqueado";
    const precioC = precioSugeridoCocreado(emitibleC ? k.r.costoUnitario : null, { par: k.parametros });
    const pendientes = [...(k.emision.pendientes || []), ...bloqueos.map((b: string) => `Estructura: ${b}`)];
    const fila = filaCostoCocreacion({
      expediente: exp, email, rol: rolC, pz,
      costeo: { emitible: k.emision.emitible, estado: k.estado, costoUnitario: k.r.costoUnitario, warnings: k.warnings, pendientes, ...k.meta },
      decision: { ...decision, bloqueos }, precio: precioC,
    });
    const { error: insErr } = await svcC.from("cocrear_costeo_servidor").insert(fila);
    if (insErr) {
      // Sin registro no hay verdad de servidor: no se presume validado ni se entrega un costo "oficial".
      return json({ ok: false, code: "REGISTRO_NO_DISPONIBLE", error: "El servidor costeó pero no pudo registrar el resultado (falta aplicar PROPUESTA_cocrear_costo_servidor.sql)." }, 503);
    }
    return json(respuestaCocreacionPorRol(rolC, fila, { costeo: { materialTotal: k.r.materialTotal, manoObra: k.r.manoObra, indirectosFabrica: k.r.indirectosFabrica }, decision }));
  }

  // --- Costeo normal: EL MISMO núcleo que prueban las pruebas del pipeline (src/datos/costeoServidor.js) ---
  const out = await atenderCosteo({ svc: createClient(URL, SERVICE), body, email });
  return json(out.body, out.status);
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
