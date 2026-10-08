// ============================================================================
//  Edge Function: costear-servidor  (MOTOR DE COSTO AUTORITATIVO — SHADOW MODE)
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
import { calcular, modeloParaPieza, precioDe, costeoEmitible, PARAMETROS_DEFAULT, MOTOR_VERSION } from "../../../src/motor/calculo.js";
import { dinero } from "../../../src/motor/dinero.js";
import { INSUMOS_SEMILLA, mapaInsumos } from "../../../src/datos/insumos.js";
// DTO ESTRICTO — la MISMA frontera que usa el cliente (sin duplicar lógica). Rechaza
// cualquier campo económico (margen, precio, costo, insumo inline, factores,
// modeloCosteo…) del body antes de tocar el motor. Ver src/datos/validarIntentCosteo.js.
import { validarIntentCosteo } from "../../../src/datos/validarIntentCosteo.js";
// P0.5: el material_match del BROWSER no es autoridad. El servidor RECALCULA la clase efectiva
// contra el catálogo autoritativo con la MISMA lógica determinista compartida (sin duplicar).
import { reconciliarMaterialServidor } from "../../../src/datos/materialMatch.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Hash corto y estable del contenido de config con el que se costeó, para que una
// cotización vieja siga siendo explicable aunque mañana cambie un precio (djb2).
function hashConfig(datos: unknown): string {
  const txt = JSON.stringify(datos ?? {});
  let h = 5381;
  for (let k = 0; k < txt.length; k++) h = ((h << 5) + h + txt.charCodeAt(k)) >>> 0;
  return `cfg${h.toString(36)}`;
}

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

  // --- DTO ESTRICTO (seguridad, misma frontera que el cliente) ---
  // El navegador manda INTENCIÓN TÉCNICA; el DINERO lo decide el servidor. Esto cierra
  // la fuga por la que `pieza.margen` del body movía el precio de venta, y rechaza
  // insumo/precio/costo/factores/modeloCosteo inline en lugar de ignorarlos en silencio.
  const v = validarIntentCosteo(body);
  if (!v.ok) return json({ ok: false, code: v.code, issues: v.issues }, 400);
  const intent = v.intent;
  const pieza = intent.pieza;              // { componentes, horas? } — saneado, sin dinero ni modelo
  const n = Math.max(1, Number(intent.cantidad) || 1);

  // --- Servidor autoritativo: rol + config NUNCA vienen del navegador ---
  const svc = createClient(URL, SERVICE);
  const { data: permit } = await svc.from("permitidos").select("rol").eq("email", email).maybeSingle();
  if (!permit) return json({ ok: false, error: "Usuario no autorizado." }, 403);
  const rol = String(permit.rol || "").toLowerCase();
  const esDireccion = rol === "direccion";
  const esDiseno = rol === "diseno";

  const { data: cfg, error: cfgErr } = await svc.from("config").select("datos").eq("id", "vonhaucke").single();
  if (cfgErr) return json({ ok: false, error: "No se pudo leer la configuración." }, 502);
  const datos = (cfg?.datos as any) || {};

  // Mismo ensamblado que el cliente (App.jsx `aplicarCompartido`): la config de la
  // NUBE es la autoridad viva. Si trae `insumos`, el cliente los REEMPLAZA (no
  // mergea con la semilla del código); solo cae a la semilla si la nube no trae.
  // Los parámetros SÍ se funden sobre los defaults. Replicarlo EXACTO es lo que
  // hace que el servidor cuadre al centavo con lo que ve el cliente hoy.
  const insumos = (datos.insumos && typeof datos.insumos === "object" && Object.keys(datos.insumos).length)
    ? datos.insumos
    : mapaInsumos(INSUMOS_SEMILLA);
  const parametros = { ...PARAMETROS_DEFAULT, ...(datos.parametros || {}) };

  // --- RECONCILIACIÓN DE MATERIAL (P0.5, servidor autoritativo) ---
  // El `material_match` que mandó el navegador NO se confía. Para CADA componente se RECALCULA
  // la clase efectiva contra el catálogo AUTORITATIVO (insumos) + material_solicitado + la
  // intención de confirmación humana (material_confirmado), reutilizando la MISMA lógica
  // determinista que el cliente. Así un browser que spoofee material_match='EXACT' sobre una
  // sustitución o una variante por confirmar NO se salta el gate: el motor verá la clase real
  // (SAME_FAMILY_*/SUBSTITUTE/...) y `costeoEmitible` bloqueará la emisión.
  const resolver = (id: string) => (insumos as any)[id];
  const piezaReconciliada = {
    ...pieza,
    componentes: (Array.isArray(pieza.componentes) ? pieza.componentes : [])
      .map((c: any) => reconciliarMaterialServidor(c, resolver, Object.values(insumos as any))),
  };

  // --- Mismo motor que el cliente ---
  let r: any;
  try {
    const { par } = modeloParaPieza(parametros, piezaReconciliada);
    r = calcular(piezaReconciliada, n, insumos, par);
  } catch (e) {
    return json({ ok: false, error: "No se pudo calcular: " + String(e) }, 500);
  }

  // FAIL-CLOSED: MISMO juez que el cliente. Esto incluye material/precio faltante,
  // costo no finito y piezas que NO CABEN en el formato de compra. No duplicamos
  // la definición de emitibilidad en la Edge.
  const emision = costeoEmitible(r);
  const faltan: string[] = Array.isArray(r.componentesIgnorados) ? r.componentesIgnorados : [];
  const warnings: string[] = [];
  if (faltan.length) warnings.push(`${faltan.length} pieza(s) sin material/precio usable: ${faltan.join(", ")}`);
  for (const b of emision.bloqueos?.formato_incompatible || []) warnings.push(b);
  if (emision.bloqueos?.costo_invalido) warnings.push("Costo calculado inválido/no finito.");

  // --- EVIDENCIA desde catalogo_vigente (el costo sigue saliendo de config-legado;
  //     catalogo_vigente aporta SOLO el estado de evidencia por insumo usado). Aditivo. ---
  const usados: string[] = [...new Set((r.detalleInsumos || []).map((d: any) => d.insumoId).filter(Boolean))];
  const evMap: Record<string, any> = {};
  let versionCatalogo = "sin-catalogo";
  try {
    if (usados.length) {
      const { data: evid } = await svc.from("catalogo_vigente")
        .select("insumo_id, estado, certificable, requiere_validacion_compras")
        .in("insumo_id", usados);
      for (const e of evid || []) evMap[e.insumo_id] = e;
    }
    const { count: nAprob } = await svc.from("insumo_precios")
      .select("id", { count: "exact", head: true }).eq("estado", "aprobado");
    versionCatalogo = `cat-ap${nAprob ?? ""}-${hashConfig(usados)}`;
  } catch (_e) { /* catalogo_vigente puede no existir aún: no bloquea el costeo legado */ }

  const noCertificados = usados.filter((id) => !evMap[id] || !evMap[id].certificable);
  const requierenValidacion = usados.filter((id) => evMap[id]?.requiere_validacion_compras);

  // ESTADO (4 valores). El costo es legado (tiene precio), por eso 'bloqueado' solo
  // aplicaría en modo costo-desde-catálogo (futuro); hoy: incompleto | preliminar | certificado.
  let estado: "certificado" | "preliminar" | "incompleto" | "bloqueado";
  if (!emision.emitible) {
    estado = "incompleto";
  } else if (noCertificados.length === 0) {
    estado = "certificado";
  } else {
    estado = "preliminar";
    warnings.push(`Costo preliminar — ${noCertificados.length} de ${usados.length} insumo(s) sin precio certificado.`);
    if (requierenValidacion.length) warnings.push(`${requierenValidacion.length} insumo(s) requieren validación de Compras.`);
  }

  // Precio: SIEMPRE con el margen OBJETIVO del servidor (config/params), NUNCA del
  // body — el DTO ya rechazó cualquier `margen` del cliente. Modelo 'clásico' (Alba)
  // para producto nuevo, que es el caso de costear-servidor; 'intelisis' (líneas App
  // LT) se costea aún en cliente y queda fuera de esta superficie.
  const margen = Number(parametros.margenObjetivo ?? 50);
  // FAIL-CLOSED: precioDe devuelve NaN ante margen imposible (≥100/<0) o costo no
  // finito. No se convierte en $0 ni se emite: precioVenta = null → sin precio.
  const precioRaw = precioDe(r.costoUnitario, margen);
  const precioVenta = Number.isFinite(precioRaw) ? dinero(precioRaw) : null;

  // --- SNAPSHOT reproducible ---
  const meta = {
    versionMotor: MOTOR_VERSION,
    versionConfig: hashConfig(datos),
    versionCatalogo,
    fuenteCosto: "config-legado", // el costo aún sale de config; catalogo_vigente solo certifica
    calculadoEn: new Date().toISOString(),
  };
  // El precio se entrega mientras el cálculo sea posible (certificado o preliminar) Y
  // el precio sea un número válido. El sistema debe OPERAR con preliminares; incompleto,
  // bloqueado o un precio no finito (fail-closed) ocultan el precio.
  const hayPrecio = (estado === "certificado" || estado === "preliminar") && precioVenta != null;

  // --- SALIDA POR CAPACIDAD ---
  // Ventas: SOLO información comercial. Precio de venta + estado + warnings comerciales.
  // JAMÁS costo base, precio de compra, proveedor, margen, factores ni config.
  if (!esDireccion && !esDiseno) {
    const warnComercial = estado === "certificado" ? []
      : estado === "preliminar" ? ["Precio preliminar: sujeto a confirmación de costos."]
      : ["El costeo está incompleto; pídele a Diseño que lo complete antes de cotizar."];
    return json({
      ok: true, estado, piezas: n,
      precioVenta: hayPrecio ? precioVenta : null,
      versionMotor: meta.versionMotor, versionCatalogo: meta.versionCatalogo, calculadoEn: meta.calculadoEn,
      warnings: warnComercial,
    });
  }

  // Diseño: BOM + costo técnico, SIN información financiera (sin precioVenta, sin margen).
  const tecnico = {
    costoUnitario: dinero(r.costoUnitario),
    materialTotal: dinero(r.materialTotal),
    manoObra: dinero(r.manoObra),
    indirectosFabrica: dinero(r.indirectosFabrica),
    desperdicio: dinero(r.desperdicio),
    detalleInsumos: (r.detalleInsumos || []).map((d: any) => ({
      insumoId: d.insumoId, nombre: d.nombre, seccion: d.seccion, costo: dinero(d.costo || 0),
      certificable: !!evMap[d.insumoId]?.certificable, evidencia: evMap[d.insumoId]?.estado || "sin-catalogo",
    })),
    componentesIgnorados: faltan,
  };
  const evidencia = { usados: usados.length, certificados: usados.length - noCertificados.length, noCertificados: noCertificados.length };
  if (esDiseno) return json({ ok: true, estado, piezas: n, costo: tecnico, evidencia, ...meta, warnings });

  // Dirección: todo (incluye precio, margen, desglose completo y evidencia).
  return json({ ok: true, estado, piezas: n, precioVenta: hayPrecio ? precioVenta : null, margen, costo: tecnico, evidencia, desglose: r, ...meta, warnings });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
