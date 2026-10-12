// ============================================================================
//  Edge Function: cotizar-servidor · VOLCADO LEÍDO DE PRODUCCIÓN (versión 6) vía
//  Supabase MCP get_edge_function el 2026-10-11. Es el código que corre hoy.
//
//  Hallazgo de la unificación (VH-078): este código NO existía en ninguna rama del
//  repo. Resuelve precio especial de proyecto (resolver_precio_especial_proyecto,
//  ECONOMICS_INCOMPLETE, PRELIMINARY_SPECIAL) y el cliente vivo (nube.js,
//  datos/emision.js, datos/emisionUX.js) ya consume esos campos. La copia que había
//  en el repo (commit 7153e9d, "preserves cents end-to-end") nunca se desplegó y no
//  tenía el precio especial; se recupera con `git show 7153e9d:supabase/functions/
//  cotizar-servidor/index.ts` para re-aplicar los centavos sobre ESTA base (decisión
//  A16). Cualquier cambio se hace aquí primero y se despliega con aprobación expresa.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// A16 (unificación 2026-10-11): dinero comercial a CENTAVOS, portado del commit 7153e9d
// ("preserves cents end-to-end") sobre la base desplegada (v6). Publicado como v7 el
// 2026-10-12 con aprobación de Dirección ("hazlo todo"). v8 el mismo día: RPC de precio con el
// JWT del usuario y fecha por omisión (v6 y v7 contestaban 502 / "no_es_especial_de_proyecto"
// porque las RPC públicas exigen auth.uid() y la política no admite fecha nula). Sin caller en
// el cliente todavía (A9). Versión anterior: v6 (respaldo en scratch).
import { precioConDescuento, importePorCantidad, cargoPorcentaje, sumarMontos } from "../../../src/motor/comercialDinero.js";
import { dinero } from "../../../src/motor/dinero.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function posFinito(x: unknown): number | null {
  const n = typeof x === "number" ? x : (typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function descuentoValido(x: unknown): number | null {
  if (x == null) return 0;
  const n = typeof x === "number" ? x : (typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
const REJECT = Symbol("reject");
function opcionalEstricto(x: unknown): number | null | typeof REJECT {
  if (x == null) return null;
  const n = posFinito(x);
  return n == null ? REJECT : n;
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
  // v8: las RPC públicas resolver_precio_* exigen auth.uid() (RAISE 'no autenticado' con
  // service_role). Se llaman con el cliente del USUARIO; las tablas internas siguen por service.
  const userClient = createClient(URL, ANON || SERVICE, { global: { headers: { Authorization: authHeader } } });
  try {
    const { data: u } = await userClient.auth.getUser();
    email = u?.user?.email || "";
  } catch (_e) { email = ""; }
  if (!email) return json({ ok: false, error: "Sesión inválida." }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON inválido" }, 400); }
  const lineasIn = Array.isArray(body?.lineas) ? body.lineas : null;
  if (!lineasIn || !lineasIn.length) return json({ ok: false, error: "Falta 'lineas' (intención)." }, 400);
  if (lineasIn.length > 500) return json({ ok: false, error: "Demasiadas líneas en una sola cotización." }, 413);
  // v8: sin fecha, reglas_comerciales_vigentes(null) devuelve null y la función contestaba 502.
  const fecha = typeof body?.fecha === "string" && body.fecha ? body.fecha : new Date().toISOString().slice(0, 10);
  const moneda = typeof body?.moneda === "string" ? body.moneda : null;

  const svc = createClient(URL, SERVICE);
  const { data: permit } = await svc.from("permitidos").select("rol").eq("email", email).maybeSingle();
  if (!permit) return json({ ok: false, error: "Usuario no autorizado." }, 403);
  const rol = String(permit.rol || "").toLowerCase();
  const esDireccion = rol === "direccion";
  const esDiseno = rol === "diseno";

  const { data: reglas, error: reglasErr } = await svc.rpc("reglas_comerciales_vigentes", { p_fecha: fecha });
  if (reglasErr || !reglas) return json({ ok: false, error: "No hay política comercial vigente." }, 502);
  const descuentoMax = Number((reglas as any)?.descuento_max_sin_aprobacion);
  const margenMin = Number((reglas as any)?.margen_minimo_pct);
  const reglasVersion = (reglas as any)?.version ?? null;
  if (!Number.isFinite(descuentoMax) || !Number.isFinite(margenMin)) {
    return json({ ok: false, error: "Política comercial incompleta." }, 502);
  }

  let ivaPct = 16, maniobrasPct = 0, fletePct = 0;
  try {
    const { data: cfg } = await svc.from("config").select("datos").eq("id", "vonhaucke").maybeSingle();
    const p = (cfg?.datos as any)?.parametros || {};
    if (Number.isFinite(Number(p.ivaPorcentaje))) ivaPct = Number(p.ivaPorcentaje);
    if (Number.isFinite(Number(p.maniobrasPorcentaje))) maniobrasPct = Number(p.maniobrasPorcentaje);
    if (Number.isFinite(Number(p.fletePorcentaje))) fletePct = Number(p.fletePorcentaje);
  } catch (_e) { /* defaults */ }

  // Adaptador legacy -> Producto Maestro.
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
    const directo = posFinito(L.producto_id ?? L.productoId);
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
  let hayEconomiaIncompleta = false;
  let hayEspecialPreliminar = false;

  for (let i = 0; i < lineasIn.length; i++) {
    const L = lineasIn[i] || {};
    const pidResuelto = resolverProductoId(L);
    if (pidResuelto === "ambiguo") { lineas.push({ idx: i, ok: false, motivo: "identidad_ambigua" }); hayLineaInvalida = true; continue; }
    const producto_id = pidResuelto;
    const cantidad = posFinito(L.cantidad);
    const version_opt = opcionalEstricto(L.version_id ?? L.producto_version_id ?? L.productoVersionId);
    const variante_opt = opcionalEstricto(L.variante_id ?? L.varianteId);
    const descuento = descuentoValido(L.descuento_solicitado ?? L.descuento);

    if (!producto_id) { lineas.push({ idx: i, ok: false, motivo: "producto_no_resuelto" }); hayLineaInvalida = true; continue; }
    if (!cantidad) { lineas.push({ idx: i, ok: false, motivo: "cantidad_invalida" }); hayLineaInvalida = true; continue; }
    if (version_opt === REJECT) { lineas.push({ idx: i, ok: false, motivo: "version_id_invalido" }); hayLineaInvalida = true; continue; }
    if (variante_opt === REJECT) { lineas.push({ idx: i, ok: false, motivo: "variante_id_invalido" }); hayLineaInvalida = true; continue; }
    if (descuento == null) { lineas.push({ idx: i, ok: false, motivo: "descuento_invalido" }); hayLineaInvalida = true; continue; }
    const version_id = version_opt as number | null;
    const variante_id = variante_opt as number | null;

    // 1) Producto de línea / pricebook normal.
    let { data: res, error: resErr } = await userClient.rpc("resolver_precio_autorizado", {
      p_producto_id: producto_id, p_version_id: version_id, p_variante_id: variante_id, p_fecha: fecha, p_moneda: moneda,
    });
    let r: any = res;
    let esEspecial = false;

    // 2) Si no es línea autorizada, intenta la ruta EXPLÍCITA de especial de proyecto.
    // Nunca se debilita resolver_precio_autorizado: el producto especial conserva su propia semántica.
    if (resErr || !r?.ok) {
      if (variante_id != null) {
        lineas.push({ idx: i, ok: false, motivo: r?.motivo || "sin_precio_autorizado" });
        hayLineaInvalida = true;
        continue;
      }
      if (version_id == null) {
        lineas.push({ idx: i, ok: false, motivo: r?.motivo === "producto_inactivo" ? "version_id_requerido_especial" : (r?.motivo || "sin_precio_autorizado") });
        hayLineaInvalida = true;
        continue;
      }
      const esp = await userClient.rpc("resolver_precio_especial_proyecto", {
        p_producto_id: producto_id, p_version_id: version_id, p_fecha: fecha, p_moneda: moneda || "MXN",
      });
      if (esp.error || !(esp.data as any)?.ok) {
        const motivo = (esp.data as any)?.motivo || r?.motivo || "sin_precio_autorizado";
        if (motivo === "ECONOMICS_INCOMPLETE") hayEconomiaIncompleta = true;
        lineas.push({ idx: i, ok: false, motivo, economia_estado: motivo === "ECONOMICS_INCOMPLETE" ? "ECONOMICS_INCOMPLETE" : undefined });
        hayLineaInvalida = true;
        continue;
      }
      r = esp.data as any;
      esEspecial = true;
    }

    const precio_lista = Number(r.precio_lista);
    if (!Number.isFinite(precio_lista) || precio_lista <= 0) {
      lineas.push({ idx: i, ok: false, motivo: "precio_autorizado_invalido" }); hayLineaInvalida = true; continue;
    }

    let piso: number | null = null;
    let costo: number | null = null;
    let economiaEstado = "KNOWN";
    let priceSource = "PRICEBOOK";
    let commercialState = "AUTHORIZED_LINE";
    let engineeringStatus: string | null = null;

    if (esEspecial) {
      const pFloor = Number(r.piso_minimo_interno);
      const pCost = Number(r.costo_interno);
      piso = Number.isFinite(pFloor) && pFloor > 0 ? pFloor : null;
      costo = Number.isFinite(pCost) && pCost > 0 ? pCost : null;
      economiaEstado = String(r.economia_estado || "ECONOMICS_INCOMPLETE");
      priceSource = "PROJECT_SPECIAL_COST_SNAPSHOT";
      commercialState = String(r.commercial_state || "PRELIMINARY_SPECIAL");
      engineeringStatus = String(r.estado_tecnico || "preliminar");
      if (commercialState === "PRELIMINARY_SPECIAL") hayEspecialPreliminar = true;
      if (!costo || economiaEstado === "ECONOMICS_INCOMPLETE") hayEconomiaIncompleta = true;
    } else {
      try {
        const { data: it } = await svc.from("lista_precio_items").select("piso_minimo").eq("id", r.lista_precio_item_id).maybeSingle();
        if (it && it.piso_minimo != null && Number.isFinite(Number(it.piso_minimo))) piso = Number(it.piso_minimo);
      } catch (_e) { /* sin piso */ }
      try {
        const { data: eco } = await svc.from("producto_version_economia")
          .select("costo_oficial_referencia")
          .eq("producto_version_id", r.version_id)
          .maybeSingle();
        const c = eco?.costo_oficial_referencia == null ? NaN : Number(eco.costo_oficial_referencia);
        if (Number.isFinite(c) && c > 0) costo = c;
      } catch (_e) { costo = null; }
      economiaEstado = costo != null ? "KNOWN" : "ECONOMICS_INCOMPLETE";
      if (costo == null) hayEconomiaIncompleta = true;
    }

    // P0.2 + PENNIES: descuento/importe a centavos, sin redondeo al peso.
    const precio_final = precioConDescuento(precio_lista, descuento);
    if (precio_final == null) { lineas.push({ idx: i, ok: false, motivo: "precio_no_finito" }); hayLineaInvalida = true; continue; }
    const bajoPiso = piso != null && precio_final < dinero(piso);
    const sobrePolitica = descuento > descuentoMax;
    const economiaCompleta = costo != null && economiaEstado !== "ECONOMICS_INCOMPLETE";
    const bajoCosto = economiaCompleta ? precio_final < (costo as number) : false;
    const margenPct = economiaCompleta && precio_final > 0 ? ((precio_final - (costo as number)) / precio_final) * 100 : null;
    const margenBajo = margenPct != null && margenPct < margenMin;

    const motivosAprobacion: string[] = [];
    if (bajoPiso) motivosAprobacion.push("precio_bajo_piso");
    if (sobrePolitica) motivosAprobacion.push("descuento_sobre_politica");
    if (bajoCosto) motivosAprobacion.push("precio_bajo_costo");
    if (!bajoCosto && margenBajo) motivosAprobacion.push("margen_bajo_politica");
    if (esEspecial && ["ESTIMATED", "USER_APPROVED_ESTIMATE"].includes(economiaEstado)) motivosAprobacion.push("costo_especial_no_certificado");
    if (esEspecial && commercialState === "PRELIMINARY_SPECIAL") motivosAprobacion.push("ingenieria_pendiente");
    const lineaRequiereAprob = motivosAprobacion.length > 0 || (esEspecial && !!r.requiere_aprobacion);
    if (lineaRequiereAprob) requiereAprobacion = true;

    const importe = importePorCantidad(precio_final, cantidad);
    if (importe == null) { lineas.push({ idx: i, ok: false, motivo: "importe_invalido" }); hayLineaInvalida = true; continue; }
    subtotal = sumarMontos([subtotal, importe]) ?? NaN;

    const base: any = {
      idx: i, ok: true, producto_id, version_id: r.version_id, variante_id: variante_id ?? null, cantidad,
      precio_lista, descuento_solicitado: descuento, precio_final, importe,
      precio_fuente: priceSource,
      commercial_state: commercialState,
      engineering_status: engineeringStatus,
      economia_estado: economiaEstado,
      requiere_aprobacion: lineaRequiereAprob,
      motivo_aprobacion: motivosAprobacion[0] ?? null,
      motivos_aprobacion: motivosAprobacion,
      lista_precio_id: esEspecial ? null : r.lista_precio_id,
      lista_precio_item_id: esEspecial ? null : r.lista_precio_item_id,
      vigencia_desde: esEspecial ? null : r.vigencia_desde,
      vigencia_hasta: esEspecial ? null : r.vigencia_hasta,
      expediente_id: esEspecial ? r.expediente_id : null,
    };
    if (esDireccion) {
      base.costo_oficial_referencia = costo;
      base.utilidad = costo != null ? dinero(precio_final - costo) : null;
      base.margen_pct = margenPct == null ? null : Math.round(margenPct * 10) / 10;
    }
    lineas.push(base);
  }

  const serviciosIn = Array.isArray(body?.servicios) ? body.servicios : [];
  const servicios: any[] = [];
  let serviciosTotal = 0;
  let hayServicioPendiente = false;
  let hayServicioDuplicado = false;
  const tiposVistos = new Set<string>();
  for (const s of serviciosIn) {
    const tipo = String(s?.tipo || "").toLowerCase().trim();
    if (tipo && tiposVistos.has(tipo)) {
      servicios.push({ tipo, importe: null, estado: "SERVICIO_DUPLICADO" });
      hayServicioDuplicado = true;
      continue;
    }
    if (tipo) tiposVistos.add(tipo);
    if (tipo === "maniobras" && maniobrasPct > 0) {
      const imp = cargoPorcentaje(subtotal, maniobrasPct);
      if (imp == null) { servicios.push({ tipo, importe: null, estado: "SERVICIO_CALCULO_INVALIDO" }); hayServicioPendiente = true; continue; }
      serviciosTotal = sumarMontos([serviciosTotal, imp]) ?? NaN;
      servicios.push({ tipo, importe: imp, base: "subtotal", pct: maniobrasPct });
    } else if (tipo === "flete" && fletePct > 0) {
      const imp = cargoPorcentaje(subtotal, fletePct);
      if (imp == null) { servicios.push({ tipo, importe: null, estado: "SERVICIO_CALCULO_INVALIDO" }); hayServicioPendiente = true; continue; }
      serviciosTotal = sumarMontos([serviciosTotal, imp]) ?? NaN;
      servicios.push({ tipo, importe: imp, base: "subtotal", pct: fletePct });
    } else {
      servicios.push({ tipo: tipo || "desconocido", importe: null, estado: "SERVICIO_PENDIENTE_PRECIO" });
      hayServicioPendiente = true;
      requiereAprobacion = true;
    }
  }

  const baseIva = sumarMontos([subtotal, serviciosTotal]);
  const iva = baseIva == null ? null : cargoPorcentaje(baseIva, ivaPct);
  const total = baseIva == null || iva == null ? null : sumarMontos([baseIva, iva]);
  if (baseIva == null || iva == null || total == null) hayLineaInvalida = true;
  const baseReady = !hayLineaInvalida && !hayServicioPendiente && !hayServicioDuplicado && !hayEconomiaIncompleta;
  const cotizacion_emitible = baseReady && !hayEspecialPreliminar;
  const presupuesto_preliminar_disponible = baseReady && hayEspecialPreliminar;

  let listaInfo: any = null;
  const primeraPricebook = lineas.find((l) => l.ok && l.lista_precio_id != null);
  if (primeraPricebook) {
    try {
      const { data: lp } = await svc.from("listas_precio").select("id,nombre,version,vigencia_desde,vigencia_hasta,estado").eq("id", primeraPricebook.lista_precio_id).maybeSingle();
      if (lp) listaInfo = lp;
    } catch (_e) { /* noop */ }
  }

  const estado_autorizacion = hayEconomiaIncompleta
    ? "ECONOMICS_INCOMPLETE"
    : hayEspecialPreliminar ? "PRELIMINARY_SPECIAL"
    : !baseReady ? "BLOCKED"
    : requiereAprobacion ? "APPROVAL_REQUIRED"
    : "ALLOWED";

  if (esDiseno) {
    return json({
      ok: true, rol, calculadoEn: new Date().toISOString(),
      estado_autorizacion, cotizacion_emitible, presupuesto_preliminar_disponible,
      lineas: lineas.map((l) => l.ok
        ? { idx: l.idx, ok: true, producto_id: l.producto_id, version_id: l.version_id, variante_id: l.variante_id, cantidad: l.cantidad, precio_fuente: l.precio_fuente, commercial_state: l.commercial_state, engineering_status: l.engineering_status, economia_estado: l.economia_estado, requiere_aprobacion: l.requiere_aprobacion, motivos_aprobacion: l.motivos_aprobacion }
        : { idx: l.idx, ok: false, motivo: l.motivo, economia_estado: l.economia_estado }),
      servicios: servicios.map((s) => ({ tipo: s.tipo, estado: s.estado ?? "ok" })),
    });
  }

  const meta = {
    rol, calculadoEn: new Date().toISOString(), reglas_version: reglasVersion,
    margen_minimo_pct: esDireccion ? margenMin : undefined,
    descuento_max_sin_aprobacion: descuentoMax,
    lista: listaInfo, ivaPct,
  };

  let totales: any;
  if (cotizacion_emitible) {
    totales = { emitible: true, subtotal, servicios: serviciosTotal, iva, total, moneda: moneda || "MXN" };
  } else if (presupuesto_preliminar_disponible) {
    totales = {
      emitible: false, preliminary: true, subtotal_preliminar: subtotal, servicios_preliminares: serviciosTotal,
      iva_preliminar: iva, total_preliminar: total, total_oficial: null, moneda: moneda || "MXN",
      nota: "Presupuesto preliminar disponible: al menos un desarrollo especial requiere validación técnica antes de emisión definitiva."
    };
  } else {
    totales = {
      emitible: false, subtotal_conocido: subtotal, servicios_conocidos: serviciosTotal, total_oficial: null, moneda: moneda || "MXN",
      nota: hayEconomiaIncompleta
        ? "Cotización NO emitible: falta economía autoritativa en al menos una ProductVersion."
        : "Cotización NO emitible: hay líneas inválidas, servicios sin precio o servicios duplicados."
    };
  }

  const lineasOut = lineas.map((l) => {
    if (!l.ok) return l;
    const o: any = {
      idx: l.idx, ok: true, producto_id: l.producto_id, version_id: l.version_id, variante_id: l.variante_id, cantidad: l.cantidad,
      precio_lista: l.precio_lista, descuento_solicitado: l.descuento_solicitado, precio_final: l.precio_final, importe: l.importe,
      precio_fuente: l.precio_fuente, commercial_state: l.commercial_state, engineering_status: l.engineering_status,
      economia_estado: l.economia_estado, requiere_aprobacion: l.requiere_aprobacion,
      motivo_aprobacion: l.motivo_aprobacion, motivos_aprobacion: l.motivos_aprobacion,
      lista_precio_id: l.lista_precio_id, lista_precio_item_id: l.lista_precio_item_id,
      vigencia_desde: l.vigencia_desde, vigencia_hasta: l.vigencia_hasta, expediente_id: l.expediente_id,
    };
    if (esDireccion) {
      o.costo_oficial_referencia = l.costo_oficial_referencia;
      o.utilidad = l.utilidad;
      o.margen_pct = l.margen_pct;
    }
    return o;
  });

  return json({ ok: true, rol, estado_autorizacion, cotizacion_emitible, presupuesto_preliminar_disponible, lineas: lineasOut, servicios, totales, ...meta });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
