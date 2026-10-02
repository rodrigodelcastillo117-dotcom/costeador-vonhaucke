// ============================================================================
//  Edge Function: cotizar-servidor  (PRECIO COMERCIAL AUTORITATIVO — C3)
// ----------------------------------------------------------------------------
//  El PRECIO deja de depender del cliente. El navegador manda solo INTENCIÓN
//  (qué producto, versión, variante, cantidad, descuento solicitado). El
//  SERVIDOR carga la autoridad (Producto Maestro + Lista de Precios vigente vía
//  resolver_precio_autorizado), calcula el dinero y responde FILTRADO POR ROL.
//
//  NUNCA se lee del body: precio, costo, margen, utilidad, rol, approval,
//  lista_precio_id, ni economía interna. El rol sale del JWT (permitidos).
//
//  SELLER-SAFE: el vendedor jamás recibe costo/margen/utilidad/proveedor.
//  Dirección sí recibe economía (costo oficial de referencia cuando exista).
//  Requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ ANON para getUser).
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DESCUENTO_MAX_SIN_APROBACION = 40; // % — descuento normal máximo; arriba pide aprobación (C4)

// Solo números finitos > 0. Rechaza NaN/Infinity/negativos/0/strings basura.
function enteroPositivo(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
function pctClamp(x: unknown): number {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 100 ? 100 : n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);

  const URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!URL || !SERVICE) return json({ ok: false, error: "Falta configuración del servidor." }, 500);

  // --- Identidad: del JWT del usuario, NUNCA del body ---
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
  if (!lineasIn || !lineasIn.length) return json({ ok: false, error: "Falta 'lineas' (intención de cotización)." }, 400);
  const fecha = typeof body?.fecha === "string" ? body.fecha : null; // opcional; el server usa current_date si null
  const moneda = typeof body?.moneda === "string" ? body.moneda : null;

  // --- Rol real (del JWT), autoridad server-side ---
  const svc = createClient(URL, SERVICE);
  const { data: permit } = await svc.from("permitidos").select("rol").eq("email", email).maybeSingle();
  if (!permit) return json({ ok: false, error: "Usuario no autorizado." }, 403);
  const rol = String(permit.rol || "").toLowerCase();
  const esDireccion = rol === "direccion";
  const esDiseno = rol === "diseno";

  // IVA no es sensible; sale de config (parámetros). Default 16.
  let ivaPct = 16;
  try {
    const { data: cfg } = await svc.from("config").select("datos").eq("id", "vonhaucke").maybeSingle();
    const p = (cfg?.datos as any)?.parametros;
    if (p && Number.isFinite(Number(p.ivaPorcentaje))) ivaPct = Number(p.ivaPorcentaje);
  } catch (_e) { /* default 16 */ }

  const lineas: any[] = [];
  let subtotal = 0;
  let requiereAprobacionGlobal = false;

  for (let i = 0; i < lineasIn.length; i++) {
    const L = lineasIn[i] || {};
    const producto_id = enteroPositivo(L.producto_id);
    const cantidad = enteroPositivo(L.cantidad);
    const version_id = L.version_id != null ? enteroPositivo(L.version_id) : null;
    const variante_id = L.variante_id != null ? enteroPositivo(L.variante_id) : null;
    const descuento = pctClamp(L.descuento_solicitado);

    if (!producto_id) { lineas.push({ idx: i, ok: false, motivo: "producto_id inválido" }); continue; }
    if (!cantidad) { lineas.push({ idx: i, ok: false, motivo: "cantidad inválida" }); continue; }

    // AUTORIDAD: precio resuelto server-side. Ignora cualquier precio/lista del body.
    const { data: res, error: resErr } = await svc.rpc("resolver_precio_autorizado", {
      p_producto_id: producto_id, p_version_id: version_id, p_variante_id: variante_id,
      p_fecha: fecha, p_moneda: moneda,
    });
    if (resErr) { lineas.push({ idx: i, ok: false, motivo: "error_resolucion" }); continue; }
    const r = res as any;
    if (!r?.ok) { lineas.push({ idx: i, ok: false, motivo: r?.motivo || "sin_precio_autorizado" }); continue; }

    const precio_lista = Number(r.precio_lista);
    // Piso de descuento (m legacy) para saber si la excepción necesita aprobación.
    let piso: number | null = null;
    try {
      const { data: it } = await svc.from("lista_precio_items").select("piso_minimo").eq("id", r.lista_precio_item_id).maybeSingle();
      if (it && it.piso_minimo != null) piso = Number(it.piso_minimo);
    } catch (_e) { /* sin piso */ }

    const precio_final = Math.round(precio_lista * (1 - descuento / 100));
    const bajoPiso = piso != null && precio_final < piso;
    const descAlto = descuento > DESCUENTO_MAX_SIN_APROBACION;
    const requiere_aprobacion = bajoPiso || descAlto;
    if (requiere_aprobacion) requiereAprobacionGlobal = true;

    const importe = precio_final * cantidad;
    subtotal += importe;

    const base: any = {
      idx: i, ok: true,
      producto_id, version_id: r.version_id, variante_id: variante_id ?? null, cantidad,
      precio_lista, descuento, precio_final, importe,
      requiere_aprobacion,
      motivo_aprobacion: requiere_aprobacion ? (bajoPiso ? "precio_bajo_piso" : "descuento_mayor_a_" + DESCUENTO_MAX_SIN_APROBACION) : null,
      lista_precio_id: r.lista_precio_id, lista_precio_item_id: r.lista_precio_item_id,
      vigencia_desde: r.vigencia_desde, vigencia_hasta: r.vigencia_hasta,
    };

    // DIRECCIÓN: agrega economía autorizada (costo oficial de referencia si existe; NUNCA inventado).
    if (esDireccion) {
      let costo: number | null = null;
      try {
        const { data: eco } = await svc.from("producto_version_economia")
          .select("costo_oficial_referencia").eq("producto_version_id", r.version_id).maybeSingle();
        if (eco && eco.costo_oficial_referencia != null) costo = Number(eco.costo_oficial_referencia);
      } catch (_e) { /* sin economía */ }
      base.costo_oficial_referencia = costo; // null = desconocido (baseline líneas/banco no trae costo)
      base.utilidad = costo != null ? precio_final - costo : null;
      base.margen_pct = costo != null && precio_final > 0 ? Math.round(((precio_final - costo) / precio_final) * 1000) / 10 : null;
      base.economia_estado = costo != null ? "conocida" : "costo_desconocido";
    }
    lineas.push(base);
  }

  const servicios = Number.isFinite(Number(body?.servicios)) && Number(body?.servicios) > 0 ? Math.round(Number(body.servicios)) : 0;
  const baseIva = subtotal + servicios;
  const iva = Math.round(baseIva * (ivaPct / 100));
  const total = baseIva + iva;
  const estado_autorizacion = requiereAprobacionGlobal ? "requiere_aprobacion" : "autorizado";

  const meta = { lista: "Von Haucke — Lista Base V1", rol, calculadoEn: new Date().toISOString(), ivaPct };

  // DISEÑO: contexto de producto/config, SIN economía comercial.
  if (esDiseno) {
    return json({
      ok: true, rol, estado_autorizacion,
      lineas: lineas.map((l) => l.ok
        ? { idx: l.idx, ok: true, producto_id: l.producto_id, version_id: l.version_id, variante_id: l.variante_id, cantidad: l.cantidad }
        : l),
      ...meta,
    });
  }

  // VENDEDOR: comercial, CERO economía interna. (Dirección: mismo + costo/margen por línea.)
  const lineasOut = lineas.map((l) => {
    if (!l.ok) return l;
    const o: any = {
      idx: l.idx, ok: true, producto_id: l.producto_id, version_id: l.version_id, variante_id: l.variante_id,
      cantidad: l.cantidad, precio_lista: l.precio_lista, descuento: l.descuento, precio_final: l.precio_final,
      importe: l.importe, requiere_aprobacion: l.requiere_aprobacion, motivo_aprobacion: l.motivo_aprobacion,
      lista_precio_id: l.lista_precio_id, lista_precio_item_id: l.lista_precio_item_id,
      vigencia_desde: l.vigencia_desde, vigencia_hasta: l.vigencia_hasta,
    };
    if (esDireccion) {
      o.costo_oficial_referencia = l.costo_oficial_referencia;
      o.utilidad = l.utilidad; o.margen_pct = l.margen_pct; o.economia_estado = l.economia_estado;
    }
    return o;
  });

  return json({
    ok: true, rol, estado_autorizacion,
    lineas: lineasOut,
    totales: { subtotal, servicios, iva, total, moneda: moneda || "MXN" },
    ...meta,
  });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}
