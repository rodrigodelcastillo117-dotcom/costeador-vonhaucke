// ============================================================================
//  Edge Function: cotizar-servidor  (PRECIO COMERCIAL AUTORITATIVO — C3, v3)
// ----------------------------------------------------------------------------
//  El navegador manda INTENCIÓN; el SERVIDOR decide TODO el dinero.
//  - Precio: resolver_precio_autorizado (Producto Maestro + Lista vigente).
//  - Política (descuento máx sin aprobación): reglas_comerciales (DB, versionada).
//  - Servicios: INTENCIÓN {tipo}; el importe lo resuelve el servidor desde config
//    (maniobras/flete %). Un servicio sin tarifa autorizada => SERVICIO_PENDIENTE_PRECIO.
//    Servicio con tipo DUPLICADO => se rechaza (nunca se cobra dos veces el mismo tipo).
//  - Descuento: validación explícita (NaN/Inf/<0/>100 => rechazo). Un descuento
//    válido por encima de política se CONSERVA tal cual + requiere_aprobacion (no clamp).
//  - version_id / variante_id: SOLO null/ausente significa "usar vigente/default".
//    Si vienen en el request y son inválidos (0, negativo, NaN, Inf, texto) => RECHAZO.
//  - Emisión: cotizacion_emitible=false si CUALQUIER línea es inválida, hay servicio
//    sin precio o servicio duplicado; entonces subtotal_conocido, NUNCA total oficial.
//    Si NO es emitible => estado_autorizacion = "bloqueada".
//  Respuesta FILTRADA POR ROL:
//    - vendedor: 0 economía interna (sin costo/margen/utilidad).
//    - direccion: + costo_oficial_referencia/utilidad/margen por línea.
//    - diseno: ESTRICTAMENTE TÉCNICO (producto/version/variante/cantidad + warnings);
//      sin política comercial, sin lista, sin iva, sin estado de autorización.
//  Rol del JWT.  v3: fixes A (version/variante estrictos), B (servicios dup),
//  C (diseño técnico), D (estado bloqueada).
//  v4: adaptador legacy -> Producto Maestro por source_type+source_ref (1 sola
//  consulta, sin N+1); el navegador manda identidad comercial, el servidor resuelve
//  producto_id. Ambiguo => identidad_ambigua; sin match => producto_no_resuelto.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { dinero } from "../../../src/motor/dinero.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Entero/numero finito > 0 (sin corrección silenciosa). Devuelve null si inválido.
function posFinito(x: unknown): number | null {
  const n = typeof x === "number" ? x : (typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
// Descuento: null si inválido (NaN/Inf/fuera de [0,100]); si no, el valor EXACTO.
function descuentoValido(x: unknown): number | null {
  if (x == null) return 0;
  const n = typeof x === "number" ? x : (typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}
// FIX A — Opcional estricto: ausente/null => null (usar default).
//   Presente pero inválido => lanza REJECT (no se degrada silenciosamente a default).
const REJECT = Symbol("reject");
function opcionalEstricto(x: unknown): number | null | typeof REJECT {
  if (x == null) return null;          // ausente / null => default
  const n = posFinito(x);
  return n == null ? REJECT : n;       // presente+inválido => rechazo
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!URL || !SERVICE) return json({ ok: false, error: "Falta configuración del servidor." }, 500);

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
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON inválido" }, 400); }
  const lineasIn = Array.isArray(body?.lineas) ? body.lineas : null;
  if (!lineasIn || !lineasIn.length) return json({ ok: false, error: "Falta 'lineas' (intención)." }, 400);
  const fecha = typeof body?.fecha === "string" ? body.fecha : null;
  const moneda = typeof body?.moneda === "string" ? body.moneda : null;

  const svc = createClient(URL, SERVICE);
  const { data: permit } = await svc.from("permitidos").select("rol").eq("email", email).maybeSingle();
  if (!permit) return json({ ok: false, error: "Usuario no autorizado." }, 403);
  const rol = String(permit.rol || "").toLowerCase();
  const esDireccion = rol === "direccion";
  const esDiseno = rol === "diseno";

  // P0.1: política comercial desde DB (no hardcode).
  const { data: reglas } = await svc.rpc("reglas_comerciales_vigentes", { p_fecha: fecha });
  const descuentoMax = Number((reglas as any)?.descuento_max_sin_aprobacion);
  const reglasVersion = (reglas as any)?.version ?? null;
  if (!Number.isFinite(descuentoMax)) return json({ ok: false, error: "No hay política comercial vigente." }, 502);

  // IVA y % de servicios desde config (no sensibles; autoridad server-side).
  let ivaPct = 16, maniobrasPct = 0, fletePct = 0;
  try {
    const { data: cfg } = await svc.from("config").select("datos").eq("id", "vonhaucke").maybeSingle();
    const p = (cfg?.datos as any)?.parametros || {};
    if (Number.isFinite(Number(p.ivaPorcentaje))) ivaPct = Number(p.ivaPorcentaje);
    if (Number.isFinite(Number(p.maniobrasPorcentaje))) maniobrasPct = Number(p.maniobrasPorcentaje);
    if (Number.isFinite(Number(p.fletePorcentaje))) fletePct = Number(p.fletePorcentaje);
  } catch (_e) { /* defaults */ }

  // v4 — ADAPTADOR LEGACY -> PRODUCTO MAESTRO (identidad por source_type+source_ref).
  //  El navegador manda su identidad comercial (clave de línea = source_ref, o id de
  //  banco = source_ref); el SERVIDOR resuelve producto_id. Se resuelve TODO en UNA
  //  sola consulta (no N+1). Match por (source_type, source_ref) que es ÚNICO; varios
  //  => identidad_ambigua; ninguno => producto_inexistente.
  const refsPedidos = Array.from(new Set(
    lineasIn.map((L: any) => (L && typeof L.source_ref === "string" && L.source_ref) ? L.source_ref : null).filter(Boolean)
  )) as string[];
  const idPorRef = new Map<string, { id: number; st: string }[]>();
  if (refsPedidos.length) {
    const { data: prods } = await svc.from("productos").select("id,source_type,source_ref").in("source_ref", refsPedidos);
    for (const p of (prods || [])) {
      const arr = idPorRef.get(p.source_ref) || [];
      arr.push({ id: p.id, st: p.source_type });
      idPorRef.set(p.source_ref, arr);
    }
  }
  function resolverProductoId(L: any): number | null | "ambiguo" {
    const directo = posFinito(L.producto_id);
    if (directo) return directo;
    const ref = (typeof L.source_ref === "string" && L.source_ref) ? L.source_ref : null;
    if (!ref) return null;
    let cands = idPorRef.get(ref) || [];
    const st = typeof L.source_type === "string" ? L.source_type : null;
    if (st) cands = cands.filter((c) => c.st === st);
    if (cands.length === 1) return cands[0].id;
    if (cands.length > 1) return "ambiguo";
    return null;
  }

  const lineas: any[] = [];
  let subtotal = 0;
  let requiereAprobacion = false;
  let hayLineaInvalida = false;

  for (let i = 0; i < lineasIn.length; i++) {
    const L = lineasIn[i] || {};
    const pidResuelto = resolverProductoId(L);
    if (pidResuelto === "ambiguo") { lineas.push({ idx: i, ok: false, motivo: "identidad_ambigua" }); hayLineaInvalida = true; continue; }
    const producto_id = pidResuelto;
    const cantidad = posFinito(L.cantidad);
    // FIX A: version/variante estrictos cuando vienen en el request.
    const version_opt = opcionalEstricto(L.version_id);
    const variante_opt = opcionalEstricto(L.variante_id);
    const descuento = descuentoValido(L.descuento_solicitado);

    if (!producto_id) { lineas.push({ idx: i, ok: false, motivo: "producto_no_resuelto" }); hayLineaInvalida = true; continue; }
    if (!cantidad) { lineas.push({ idx: i, ok: false, motivo: "cantidad_invalida" }); hayLineaInvalida = true; continue; }
    if (version_opt === REJECT) { lineas.push({ idx: i, ok: false, motivo: "version_id_invalido" }); hayLineaInvalida = true; continue; }
    if (variante_opt === REJECT) { lineas.push({ idx: i, ok: false, motivo: "variante_id_invalido" }); hayLineaInvalida = true; continue; }
    if (descuento == null) { lineas.push({ idx: i, ok: false, motivo: "descuento_invalido" }); hayLineaInvalida = true; continue; }
    const version_id = version_opt as number | null;
    const variante_id = variante_opt as number | null;

    const { data: res, error: resErr } = await svc.rpc("resolver_precio_autorizado", {
      p_producto_id: producto_id, p_version_id: version_id, p_variante_id: variante_id, p_fecha: fecha, p_moneda: moneda,
    });
    if (resErr) { lineas.push({ idx: i, ok: false, motivo: "error_resolucion" }); hayLineaInvalida = true; continue; }
    const r = res as any;
    if (!r?.ok) { lineas.push({ idx: i, ok: false, motivo: r?.motivo || "sin_precio_autorizado" }); hayLineaInvalida = true; continue; }

    const precio_lista = Number(r.precio_lista);
    let piso: number | null = null;
    try {
      const { data: it } = await svc.from("lista_precio_items").select("piso_minimo").eq("id", r.lista_precio_item_id).maybeSingle();
      if (it && it.piso_minimo != null) piso = Number(it.piso_minimo);
    } catch (_e) { /* sin piso */ }

    // P0.2: NO clamp. El descuento se conserva exacto; si excede política o cae bajo piso => requiere aprobación.
    const precio_final = dinero(precio_lista * (1 - descuento / 100));
    const bajoPiso = piso != null && precio_final < piso;
    const sobrePolitica = descuento > descuentoMax;
    const lineaRequiereAprob = bajoPiso || sobrePolitica;
    if (lineaRequiereAprob) requiereAprobacion = true;

    const importe = dinero(precio_final * cantidad);
    subtotal = dinero(subtotal + importe);

    const base: any = {
      idx: i, ok: true, producto_id, version_id: r.version_id, variante_id: variante_id ?? null, cantidad,
      precio_lista, descuento_solicitado: descuento, precio_final, importe,
      requiere_aprobacion: lineaRequiereAprob,
      motivo_aprobacion: lineaRequiereAprob ? (bajoPiso ? "precio_bajo_piso" : "descuento_sobre_politica") : null,
      lista_precio_id: r.lista_precio_id, lista_precio_item_id: r.lista_precio_item_id,
      vigencia_desde: r.vigencia_desde, vigencia_hasta: r.vigencia_hasta,
    };
    if (esDireccion) {
      let costo: number | null = null;
      try {
        const { data: eco } = await svc.from("producto_version_economia").select("costo_oficial_referencia").eq("producto_version_id", r.version_id).maybeSingle();
        if (eco && eco.costo_oficial_referencia != null) costo = Number(eco.costo_oficial_referencia);
      } catch (_e) { /* sin economía */ }
      base.costo_oficial_referencia = costo;
      base.utilidad = costo != null ? dinero(precio_final - costo) : null;
      base.margen_pct = costo != null && precio_final > 0 ? Math.round(((precio_final - costo) / precio_final) * 1000) / 10 : null;
      base.economia_estado = costo != null ? "conocida" : "costo_desconocido";
    }
    lineas.push(base);
  }

  // P0.3 + FIX B: SERVICIOS = intención; el importe lo decide el servidor.
  //   Nunca dinero del browser. Tipo DUPLICADO => rechazo (no se cobra dos veces).
  const serviciosIn = Array.isArray(body?.servicios) ? body.servicios : [];
  const servicios: any[] = [];
  let serviciosTotal = 0;
  let hayServicioPendiente = false;
  let hayServicioDuplicado = false;
  const tiposVistos = new Set<string>();
  for (const s of serviciosIn) {
    const tipo = String(s?.tipo || "").toLowerCase().trim();
    if (tipo && tiposVistos.has(tipo)) {
      // FIX B: tipo repetido en el payload => rechazo explícito, sin cobrar de nuevo.
      servicios.push({ tipo, importe: null, estado: "SERVICIO_DUPLICADO" });
      hayServicioDuplicado = true;
      continue;
    }
    if (tipo) tiposVistos.add(tipo);
    if (tipo === "maniobras" && maniobrasPct > 0) { const imp = dinero(subtotal * maniobrasPct / 100); serviciosTotal = dinero(serviciosTotal + imp); servicios.push({ tipo, importe: imp, base: "subtotal", pct: maniobrasPct }); }
    else if (tipo === "flete" && fletePct > 0) { const imp = dinero(subtotal * fletePct / 100); serviciosTotal = dinero(serviciosTotal + imp); servicios.push({ tipo, importe: imp, base: "subtotal", pct: fletePct }); }
    else { servicios.push({ tipo: tipo || "desconocido", importe: null, estado: "SERVICIO_PENDIENTE_PRECIO" }); hayServicioPendiente = true; requiereAprobacion = true; }
  }

  // P0.4 + FIX B: emitible solo si NO hay líneas inválidas, servicios sin precio ni duplicados.
  const cotizacion_emitible = !hayLineaInvalida && !hayServicioPendiente && !hayServicioDuplicado;
  const baseIva = dinero(subtotal + serviciosTotal);
  const iva = dinero(baseIva * (ivaPct / 100));
  const total = dinero(baseIva + iva);

  // P0.5: lista REAL desde la resolución (no hardcode).
  let listaInfo: any = null;
  const primeraOk = lineas.find((l) => l.ok);
  if (primeraOk) {
    try {
      const { data: lp } = await svc.from("listas_precio").select("id,nombre,version,vigencia_desde,vigencia_hasta,estado").eq("id", primeraOk.lista_precio_id).maybeSingle();
      if (lp) listaInfo = lp;
    } catch (_e) { /* */ }
  }

  // FIX D: si NO es emitible => "bloqueada". Si es emitible pero requiere aprobación =>
  //   "requiere_aprobacion". Si no => "autorizado".
  const estado_autorizacion = !cotizacion_emitible ? "bloqueada" : (requiereAprobacion ? "requiere_aprobacion" : "autorizado");

  // FIX C: DISEÑO estrictamente técnico. Sin política, sin lista, sin iva, sin economía,
  //   sin estado de autorización comercial. Solo validez técnica + identidad de producto.
  if (esDiseno) {
    return json({
      ok: true, rol, calculadoEn: new Date().toISOString(),
      cotizacion_emitible,
      lineas: lineas.map((l) => l.ok
        ? { idx: l.idx, ok: true, producto_id: l.producto_id, version_id: l.version_id, variante_id: l.variante_id, cantidad: l.cantidad }
        : { idx: l.idx, ok: false, motivo: l.motivo }),
      servicios: servicios.map((s) => ({ tipo: s.tipo, estado: s.estado ?? "ok" })),
    });
  }

  const meta = {
    rol, calculadoEn: new Date().toISOString(),
    reglas_version: reglasVersion, descuento_max_sin_aprobacion: descuentoMax,
    lista: listaInfo, ivaPct,
  };
  // Totales oficiales SOLO si emitible; si no, subtotal_conocido (no total oficial).
  const totales = cotizacion_emitible
    ? { emitible: true, subtotal, servicios: serviciosTotal, iva, total, moneda: moneda || "MXN" }
    : { emitible: false, subtotal_conocido: subtotal, servicios_conocidos: serviciosTotal, total_oficial: null, moneda: moneda || "MXN",
        nota: "Cotización NO emitible: hay líneas inválidas, servicios sin precio o servicios duplicados." };

  const lineasOut = lineas.map((l) => {
    if (!l.ok) return l;
    const o: any = {
      idx: l.idx, ok: true, producto_id: l.producto_id, version_id: l.version_id, variante_id: l.variante_id, cantidad: l.cantidad,
      precio_lista: l.precio_lista, descuento_solicitado: l.descuento_solicitado, precio_final: l.precio_final, importe: l.importe,
      requiere_aprobacion: l.requiere_aprobacion, motivo_aprobacion: l.motivo_aprobacion,
      lista_precio_id: l.lista_precio_id, lista_precio_item_id: l.lista_precio_item_id, vigencia_desde: l.vigencia_desde, vigencia_hasta: l.vigencia_hasta,
    };
    if (esDireccion) { o.costo_oficial_referencia = l.costo_oficial_referencia; o.utilidad = l.utilidad; o.margen_pct = l.margen_pct; o.economia_estado = l.economia_estado; }
    return o;
  });

  return json({ ok: true, rol, estado_autorizacion, cotizacion_emitible, lineas: lineasOut, servicios, totales, ...meta });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
