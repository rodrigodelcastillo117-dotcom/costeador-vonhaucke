// ============================================================================
//  NUBE FALSA para E2E (Bloque 1). Intercepta TODO lo que la app le manda a
//  Supabase y responde como el servidor:
//   - auth por contraseña (JWT sin firma, suficiente para supabase-js),
//   - `permitidos` por rol, `config_para_rol`, `direccion`, `reglas`, `aprendizajes`,
//   - RPCs de cotización con la semántica de PRODUCCIÓN HOY (cuerpos leídos el 2026-10-13,
//     supabase/tests/fixtures/private_api_prod_20261013.sql): creación idempotente por
//     `_idempotency_key`, dueño/rol, `cotizacion_segura` sin economía para quien no la ve, y
//     `actualizar_cotizacion_segura` que escribe lo que llega; el trigger
//     trg_strip_seller_economics strippea SÓLO al rol 'vendedor' (diseño escribe tal cual) y
//     NADA re-pega la economía que ya tenía la fila → hoy el vendedor que reabre y guarda
//     PIERDE los costos de Dirección (VH-035, P0). `crearNubeFalsa({ preservaEconomia: true })`
//     simula en cambio la migración 20261010170000 (NO aplicada en producción): strippea lo que
//     entra y RE-PEGA la economía vieja. Ambas semánticas están probadas contra PostgreSQL real
//     en supabase/tests/preservaEconomia.test.js; ver docs/auditoria/VH035_SQL_VS_MOCK.md.
//     `crearNubeFalsa({ preservaEconomia: 'vh035c' })` simula PROPUESTA_vh035c_preserva_economia_integral.sql
//     (tampoco aplicada): fusión recursiva, STALE por producto/material/lote/definición, re-pin rechazado (42501),
//     autoridad protegida, normalize de cost_status y compuerta de emisión que lee `cost_stale` de la
//     fila. Espejo de la SQL probada en supabase/tests/preservaEconomiaIntegral.test.js y
//     composicionVh035cVh148.test.js; e2e en e2e/persistenciaVh035c.e2e.js. El DEFAULT (false) sigue
//     siendo producción hoy: e2e/persistencia.e2e.js:125 queda ROJO a propósito.
//   - VH-148 (control optimista, PROPUESTA_vh148_control_optimista_cotizacion.sql, probada contra
//     PostgreSQL real en supabase/tests/controlOptimista.test.js): `cotizacion_segura` devuelve
//     `actualizado`; `actualizar_cotizacion_segura` honra `p_actualizado_esperado` si viene en el body
//     (si difiere del `actualizado` de la fila → error PostgREST con code '40001', mensaje
//     'CONFLICTO_VERSION … (<ISO>)', details 'actualizado=<ISO>', y NADA cambia). Sin el parámetro la
//     semántica es la de siempre (firma de dos argumentos). `f.conflictos` cuenta los rechazos y
//     `f.esperados` guarda qué versión mandó cada intento (undefined = llamada vieja).
//  Vive en el proceso de Playwright, así que SOBREVIVE recargas y pestañas: es la
//  "base de datos" del escenario. Nada toca producción.
// ============================================================================
export const HOST = 'https://mtuvnbgljwbsaizjjgzs.supabase.co';
export const CLAVE_LOCAL = 'costeador-vonhaucke-v1';

const ECONOMIA = /^(costo.*|cost.*|margen.*|margin.*|utilidad.*|profit.*|materialtotal|manoobra.*|laborcost.*|indirectos.*|overhead.*|precioproveedor.*|supplierprice.*|suppliercost.*|proveedor.*|supplier.*|preciocompra.*|purchaseprice.*|purchasecost.*|precioreal.*|costoderivado.*|internalcost.*|internalmargin.*)$/;
export function sinEconomia(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(sinEconomia);
  if (typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (ECONOMIA.test(String(k).toLowerCase().replace(/[^a-z0-9]/g, ''))) continue;
      out[k] = sinEconomia(x);
    }
    return out;
  }
  return v;
}
const economiaDe = (p) => {
  const limpio = sinEconomia(p);
  return Object.fromEntries(Object.entries(p || {}).filter(([k]) => !(k in limpio)));
};
function fusionar(viejas, nuevas) {
  if (!Array.isArray(nuevas)) return nuevas;
  return nuevas.map((n) => {
    const v = (viejas || []).find((x) => x?.id != null && x.id === n?.id);
    return v ? { ...n, ...economiaDe(v) } : n;
  });
}

// ============================================================================
//  ESPEJO JS DE PROPUESTA_vh035c_preserva_economia_integral.sql (crearNubeFalsa({ preservaEconomia: 'vh035c' })).
//  Mismas reglas, mismo orden y mismos mensajes que la SQL (probada contra PostgreSQL real en
//  supabase/tests/preservaEconomiaIntegral.test.js y, compuesta con VH-148, en
//  supabase/tests/composicionVh035cVh148.test.js):
//   · fusión RECURSIVA de la economía guardada (repegarVh035c), arreglos casados por id/piezaId/clave/key/codigo
//     o por forma idéntica sin economía;
//   · STALE (cost_status UNKNOWN + cost_stale{motivo,campos,previo,economia_previa}) por identidad de
//     producto, por material (huella a cualquier profundidad), por cantidad en economía por lote y, si
//     ninguno aplicó, por DEFINICIÓN (cualquier cambio no comercial: nombre, medidas, nota, config…;
//     libres sólo precio/descuento/importe/cambios_rechazados, cantidad, autoridad y nulls);
//   · re-pin de producto_id/producto_version_id en partida existente → error 42501; renglón nuevo con
//     producto_id: debe existir (f.productos) y la versión la fija el servidor (cambios_rechazados);
//   · autoridad (aprobado…) nunca escribible y procedencia congelada en partida existente;
//   · la compuerta de emisión suma `linea_N_recosteo_pendiente_<motivo>` leído de la FILA.
// ============================================================================
const tipoJ = (x) => (x === null ? 'null' : Array.isArray(x) ? 'array' : typeof x);
const esObjeto = (x) => tipoJ(x) === 'object';
const tiene = (o, k) => esObjeto(o) && Object.prototype.hasOwnProperty.call(o, k);
// `->>` de Postgres: texto del valor; null/ausente → null.
const txtJ = (x) => (x === undefined || x === null ? null : (typeof x === 'object' ? JSON.stringify(x) : String(x)));
const nzJ = (x) => { const s = txtJ(x); return s === '' ? null : s; };
const numJ = (x) => { const s = nzJ(x); if (s == null || typeof x === 'boolean') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
// Igualdad jsonb (claves sin orden). `undefined` = SQL NULL (clave ausente), distinto de JSON null.
const canonJ = (x) => {
  if (x === undefined) return '\u0000ausente';
  if (Array.isArray(x)) return `[${x.map(canonJ).join(',')}]`;
  if (esObjeto(x)) return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${canonJ(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
};
const esClaveEconomia = (k) => ECONOMIA.test(String(k).toLowerCase().replace(/[^a-z0-9]/g, ''));
const vacioJ = (x) => (esObjeto(x) && Object.keys(x).length === 0) || (Array.isArray(x) && x.length === 0);
const claveElemento = (e) => (esObjeto(e) ? (nzJ(e.id) ?? nzJ(e.piezaId) ?? nzJ(e.clave) ?? nzJ(e.key) ?? nzJ(e.codigo)) : null);

export function economiaRecursiva(p) {
  if (!esObjeto(p) && !Array.isArray(p)) return {};
  if (Array.isArray(p)) { let alguna = false; const out = p.map((v) => { const s = economiaRecursiva(v); if (!vacioJ(s)) alguna = true; return s; }); return alguna ? out : []; }
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (esClaveEconomia(k)) out[k] = v;
    else if (esObjeto(v) || Array.isArray(v)) { const s = economiaRecursiva(v); if (!vacioJ(s)) out[k] = s; }
  }
  return out;
}

export function repegarVh035c(vieja, nueva) {
  if (vieja === undefined || nueva === undefined) return nueva;
  if (esObjeto(nueva) && esObjeto(vieja)) {
    const out = { ...nueva };
    for (const [k, vv] of Object.entries(vieja)) {
      if (esClaveEconomia(k)) out[k] = vv;
      else if (tiene(nueva, k) && (esObjeto(vv) || Array.isArray(vv)) && tipoJ(nueva[k]) === tipoJ(vv)) out[k] = repegarVh035c(vv, nueva[k]);
    }
    return out;
  }
  if (Array.isArray(nueva) && Array.isArray(vieja)) {
    return nueva.map((ne, i) => {
      let ve;
      if (esObjeto(ne)) {
        const clave = claveElemento(ne);
        if (clave != null) { const c = vieja.filter((e) => claveElemento(e) === clave); if (c.length === 1) ve = c[0]; }
        if (ve === undefined) {
          const forma = canonJ(ne);
          if (esObjeto(vieja[i]) && canonJ(sinEconomia(vieja[i])) === forma) ve = vieja[i];
          else ve = vieja.find((e) => esObjeto(e) && canonJ(sinEconomia(e)) === forma);
        }
      }
      return ve === undefined ? ne : repegarVh035c(ve, ne);
    });
  }
  return nueva;
}

const identidadProducto = (p) => ({
  producto_id: nzJ(p?.producto_id) ?? nzJ(p?.productoId) ?? nzJ(p?.product_id),
  producto_version_id: nzJ(p?.producto_version_id) ?? nzJ(p?.productoVersionId) ?? nzJ(p?.product_version_id),
  piezaId: nzJ(p?.piezaId) ?? nzJ(p?.pieza_id),
  bom_hash: nzJ(p?.bom_hash) ?? nzJ(p?.bomHash),
});
const camposIdentidadCambiados = (v, n) => {
  const a = identidadProducto(v), b = identidadProducto(n);
  return ['producto_id', 'producto_version_id', 'piezaId', 'bom_hash'].filter((k) => a[k] !== b[k] && !(k === 'bom_hash' && (a[k] == null || b[k] == null)));
};
const esClaveMaterial = (k) => /^(material|materiales|materialid|materialclave|acabado|acabados|acabadoid|acabadofid|finish|insumoid|insumo|insumoclave|tela|textura|color|calibre|espesor|clave|sku|bom)$/.test(String(k).toLowerCase().replace(/[^a-z0-9]/g, ''));
function huellaFilas(p, ruta = '', out = []) {
  if (Array.isArray(p)) { for (const v of p) huellaFilas(v, `${ruta}[${claveElemento(v) ?? '*'}]`, out); return out; }
  if (!esObjeto(p)) return out;
  for (const [k, v] of Object.entries(p)) {
    if (esClaveEconomia(k)) continue;
    if (esClaveMaterial(k)) out.push([`${ruta}.${k}`, v]);
    else if (esObjeto(v) || Array.isArray(v)) huellaFilas(v, `${ruta}.${k}`, out);
  }
  return out;
}
const huellaMaterial = (p) => {
  const g = {};
  for (const [r, v] of huellaFilas(p)) (g[r] ||= []).push(v);
  return Object.fromEntries(Object.entries(g).map(([r, vs]) => [r, vs.map(canonJ).sort()]));
};
const camposMaterialCambiados = (v, n) => {
  const hv = huellaMaterial(v), hn = huellaMaterial(n);
  return [...new Set([...Object.keys(hv), ...Object.keys(hn)])].sort().filter((k) => canonJ(hv[k]) !== canonJ(hn[k]));
};
const tieneClaveProfunda = (p, k) => (Array.isArray(p) ? p.some((x) => tieneClaveProfunda(x, k)) : esObjeto(p) && (tiene(p, k) || Object.values(p).some((x) => tieneClaveProfunda(x, k))));
const economiaPorLote = (p) => ['true', '1'].includes(String(txtJ(p?.costo_por_lote) ?? '').toLowerCase())
  || ['true', '1'].includes(String(txtJ(p?.economia_por_lote) ?? '').toLowerCase())
  || tieneClaveProfunda(p, 'costoLote') || tieneClaveProfunda(p, 'costoLoteConMerma');
const CLAVES_AUTORIDAD = ['aprobado', 'aprobado_por', 'aprobado_en', 'aprobacion', 'estado_costo', 'precio_autorizado', 'precioAutorizado'];
const CLAVES_PROCEDENCIA = ['lista_precio_item_id', 'listaPrecioItemId', 'precio_lista_snapshot', 'source_type', 'source_ref', 'price_status', 'identity_status', 'product_status', 'product_source_ref', 'economia_por_lote'];
// (8) Definición: private_api.claves_libres_definicion_partida / partida_definicion / campos_definicion_cambiados.
const CLAVES_LIBRES_DEFINICION = ['precioUnitario', 'precio_unitario', 'descuento', 'descuento_solicitado', 'importe', 'cambios_rechazados'];
// jsonb_strip_nulls: quita campos de OBJETO con null, recursivo; los null dentro de arreglos se quedan.
const stripNullsJ = (x) => (Array.isArray(x) ? x.map(stripNullsJ)
  : esObjeto(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => v !== null).map(([k, v]) => [k, stripNullsJ(v)])) : x);
// private_api.jsonb_objetos_sin_orden: arreglo de puros objetos = multiconjunto; con algún escalar, conserva el orden.
const objetosSinOrdenJ = (x) => {
  if (Array.isArray(x)) {
    const hijos = x.map(objetosSinOrdenJ);
    return x.every(esObjeto) ? hijos.map((h) => [canonJ(h), h]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, h]) => h) : hijos;
  }
  return esObjeto(x) ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, objetosSinOrdenJ(v)])) : x;
};
const partidaDefinicion = (p) => {
  if (!esObjeto(p)) return p;
  const out = stripNullsJ(sinEconomia(p));
  for (const k of [...CLAVES_LIBRES_DEFINICION, ...CLAVES_AUTORIDAD, 'cantidad']) delete out[k];
  return objetosSinOrdenJ(out);
};
const camposDefinicionCambiados = (v, n) => {
  const a = partidaDefinicion(v), b = partidaDefinicion(n);
  if (!esObjeto(a) || !esObjeto(b)) return canonJ(a) === canonJ(b) ? [] : ['partida'];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter((k) => canonJ(a[k]) !== canonJ(b[k]));
};
const errSql = (code, message) => Object.assign(new Error(message), { code });

// private_api.fusionar_economia_partidas: `nuevas` ya viene SIN economía (lo que manda el rol que no la ve).
// `productos`: Map id → version_tecnica_vigente_id (la tabla productos de la nube falsa).
export function fusionarVh035c(viejas, nuevas, productos = new Map()) {
  if (!Array.isArray(nuevas)) return nuevas;
  return nuevas.map((n) => {
    if (!esObjeto(n)) return n;
    const rechazos = [];
    let res = { ...n }; delete res.cambios_rechazados;
    const nid = txtJ(n.id);
    const v = nid != null && Array.isArray(viejas) ? viejas.find((e) => esObjeto(e) && txtJ(e.id) === nid) : undefined;
    // (4) identidad de producto protegida en partida existente.
    const cambiosId = v ? camposIdentidadCambiados(v, n) : [];
    if (v && (cambiosId.includes('producto_id') || cambiosId.includes('producto_version_id')) && identidadProducto(v).producto_id != null) {
      throw errSql('42501', `identidad de producto protegida (partida ${nid}): producto_id/producto_version_id solo cambian con un renglon nuevo o por Direccion`);
    }
    // Renglón nuevo (o sin identidad guardada): la versión la fija el servidor. productoId textual = clave de línea.
    const pidTxt = nzJ(n.producto_id) ?? nzJ(n.product_id) ?? (/^[0-9]+$/.test(txtJ(n.productoId) ?? '') ? txtJ(n.productoId) : null);
    if (pidTxt != null && (!v || identidadProducto(v).producto_id == null)) {
      if (!/^[0-9]+$/.test(pidTxt)) throw errSql('22023', `producto_id invalido (partida ${nid}): ${pidTxt}`);
      const pid = Number(pidTxt);
      if (!productos.has(pid)) throw errSql('23503', `producto_id ${pid} no existe (partida ${nid})`);
      const vigente = productos.get(pid);
      const pvid = identidadProducto(n).producto_version_id;
      if (vigente != null && (pvid == null || pvid !== String(vigente))) {
        if (pvid != null) rechazos.push({ campo: 'producto_version_id', motivo: 'VERSION_FIJADA_POR_SERVIDOR' });
        delete res.productoVersionId; delete res.product_version_id;
        res = { ...res, producto_id: pid, producto_version_id: vigente };
      }
    }
    // (5) autoridad: nunca la escribe el rol sin economía.
    const nuloOFalso = (x) => x === null || x === false;
    for (const k of CLAVES_AUTORIDAD) {
      if (v) {
        if (tiene(v, k) && canonJ(n[k]) !== canonJ(v[k])) { rechazos.push({ campo: k, motivo: 'AUTORIDAD_SOLO_DIRECCION' }); res[k] = v[k]; }
        else if (!tiene(v, k) && tiene(n, k) && !nuloOFalso(n[k])) { rechazos.push({ campo: k, motivo: 'AUTORIDAD_SOLO_DIRECCION' }); delete res[k]; }
      } else if (tiene(n, k) && !nuloOFalso(n[k])) { rechazos.push({ campo: k, motivo: 'AUTORIDAD_SOLO_DIRECCION' }); delete res[k]; }
    }
    // Procedencia: congelada en partida existente.
    if (v) {
      for (const k of CLAVES_PROCEDENCIA) {
        if (tiene(v, k) && canonJ(n[k]) !== canonJ(v[k])) { rechazos.push({ campo: k, motivo: 'PROCEDENCIA_CONGELADA' }); res[k] = v[k]; }
        else if (!tiene(v, k) && tiene(n, k)) { rechazos.push({ campo: k, motivo: 'PROCEDENCIA_CONGELADA' }); delete res[k]; }
      }
    }
    if (!v) { if (rechazos.length) res.cambios_rechazados = rechazos; return res; }
    // (2)(3) ¿la economía guardada sigue describiendo esta partida?
    let motivo = null; const campos = [];
    if (cambiosId.length) { motivo = 'RECOSTEO_PRODUCTO_CAMBIADO'; campos.push(...cambiosId); }
    const mat = camposMaterialCambiados(v, n);
    if (mat.length) { motivo = motivo ?? 'RECOSTEO_MATERIAL_CAMBIADO'; campos.push(...mat); }
    if (numJ(v.cantidad) !== numJ(n.cantidad) && economiaPorLote(v)) { motivo = motivo ?? 'RECOSTEO_LOTE_CAMBIADO'; campos.push('cantidad'); }
    // (8) Definición: sólo si no hubo otro motivo; contra `res` (autoridad/procedencia ya devueltas a lo guardado).
    if (motivo == null) { const def = camposDefinicionCambiados(v, res); if (def.length) { motivo = 'RECOSTEO_DEFINICION_CAMBIADA'; campos.push(...def); } }
    if (motivo == null) res = repegarVh035c(v, res);
    else {
      let previa;
      if (esObjeto(v.cost_stale) && tiene(v.cost_stale, 'economia_previa')) previa = v.cost_stale.economia_previa;
      else { previa = economiaRecursiva(v); delete previa.cost_status; delete previa.cost_stale; }
      res = { ...res, cost_status: 'UNKNOWN', cost_stale: { motivo, campos, previo: { ...identidadProducto(v), cantidad: v.cantidad === undefined ? null : v.cantidad }, economia_previa: previa } };
    }
    if (rechazos.length) res.cambios_rechazados = rechazos;
    return res;
  });
}

// public.normalizar_cost_status_partidas (trigger trg_normalize_economics_status): cost_status siempre presente.
const COST_STATUS_VALIDOS = ['KNOWN', 'KNOWN_ZERO', 'ESTIMATED', 'USER_APPROVED_ESTIMATE', 'PENDING_PRICE', 'PENDING_MATERIAL', 'UNKNOWN', 'NOT_APPLICABLE', 'NO_ACCESS', 'INVALID'];
export function normalizarCostStatus(ps) {
  if (!Array.isArray(ps)) return ps;
  return ps.map((pt) => {
    if (!esObjeto(pt)) return pt;
    let st = String(nzJ(pt.cost_status) ?? nzJ(pt.costo_estado) ?? '').toUpperCase();
    const c = numJ(pt.costoUnitario);
    if (st === '') st = c == null ? 'UNKNOWN' : c > 0 ? 'KNOWN' : c === 0 ? 'UNKNOWN' : 'INVALID';
    if (!COST_STATUS_VALIDOS.includes(st)) st = 'UNKNOWN';
    return { ...pt, cost_status: st };
  });
}

// private_api.motivos_recosteo_pendiente + wrapper public.evaluar_emision_cotizacion de VH-035c.
export function motivosRecosteoPendiente(fila) {
  return (fila?.partidas || []).map((p, i) => (esObjeto(p) && tiene(p, 'cost_stale')
    ? `linea_${i + 1}_recosteo_pendiente_${String((esObjeto(p.cost_stale) ? nzJ(p.cost_stale.motivo) : null) ?? 'RECOSTEO').replaceAll('RECOSTEO_', '').toLowerCase()}`
    : null)).filter(Boolean);
}
export function compuertaConRecosteo(g, fila) {
  const st = motivosRecosteoPendiente(fila);
  if (!st.length) return g;
  if (g.state === 'BLOCKED') return { ...g, economics: [...(g.economics || []), ...st] };
  return { ...g, state: 'ECONOMICS_INCOMPLETE', reasons: [...st, ...(g.state === 'ECONOMICS_INCOMPLETE' ? (g.reasons || []) : [])], recosteo_pendiente: true };
}

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (email) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: idDe(email), email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
// Token de la sesión falsa de `email` (para llamar a la nube falsa desde el navegador como otro dispositivo).
export const tokenDe = (email) => jwt(email);
const idDe = (email) => {
  let h = 0; for (const c of email) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hex = h.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}${hex.slice(0, 4)}`;
};
const sesionDe = (email) => ({
  access_token: jwt(email), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: `r-${idDe(email)}`,
  user: { id: idDe(email), aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
});

const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
export const LECTURA_EJEMPLO = {
  envolvente: { ancho: 16000, largo: 8800 }, tieneCotas: true,
  grid: { horizontal: [8000, 8000], vertical: [8800] },
  areas: [
    { nombre: 'ÁREA OPERATIVA', tipo: 'open', forma: 'poligono', dentroDe: '', confianza: 'alta', circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(0, 0, 12000, 8800) },
    { nombre: 'Isla 1', tipo: 'open', forma: 'poligono', dentroDe: 'ÁREA OPERATIVA', confianza: 'alta', circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(1000, 1000, 2180, 2110), puestos: 4 },
    { nombre: 'Isla 2', tipo: 'open', forma: 'poligono', dentroDe: 'ÁREA OPERATIVA', confianza: 'alta', circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(5000, 1000, 2520, 2110), puestos: 4 },
    { nombre: 'OFICINA CEO', tipo: 'privado', forma: 'poligono', dentroDe: '', confianza: 'alta', circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(12000, 0, 4000, 3200) },
  ],
  puertas: [], escala: 'cota general 16.00 m', notas: [],
};

// ---- Compuerta de emisión: la MISMA lectura que private_api.evaluar_emision_cotizacion
// (ver supabase/schema/baseline/08_private_api.sql). Lo que la nube falsa no tiene
// (Producto Maestro, aprobaciones, política comercial) se resuelve como lo haría una
// base vacía: sin ProductVersion → `product_version_no_corresponde`; margen mínimo 25.
const MARGEN_MIN = 25;
const REGLAS_VERSION = 1;   // reglas_comerciales_vigentes().version de la nube falsa
const numDe = (x) => { if (x == null || x === '') return null; const n = Number(x); return Number.isFinite(n) ? n : null; };
const txtDe = (x) => (x == null ? '' : String(x).trim());
const enteroTxt = (s) => /^[0-9]+$/.test(s);
export function hashSnapshot(snap) {
  const t = snap?.totales || {}; const nz = (x) => Number(x) || 0;
  const total = nz(t.precioLista) - nz(t.descuento) + nz(t.contingencia) + nz(t.maniobras) + nz(t.flete) + nz(t.iva);
  const txt = JSON.stringify({ partidas: snap?.partidas ?? null, totales: snap?.totales ?? null, total, folio: snap?.folio ?? null, cliente: snap?.cliente ?? null, acomodo: snap?.acomodo ?? null });
  let h = 5381; for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
export function evaluarEmision(fila, snap, aprobaciones = []) {
  const reasons = [], econ = [], aprob = [];
  const ps = Array.isArray(snap?.partidas) ? snap.partidas : null;
  if (!ps) return { state: 'BLOCKED', reasons: ['snapshot_sin_partidas'] };
  const db = fila.partidas || [];
  if (!ps.length) reasons.push('snapshot_sin_partidas');
  if (ps.length !== db.length) reasons.push('partidas_no_corresponden_a_cotizacion');
  ps.forEach((p0, i) => {
    const p = p0 || {}; const n = i + 1;
    const qty = numDe(p.cantidad), price = numDe(p.precioUnitario);
    if (qty == null || qty <= 0) reasons.push(`linea_${n}_cantidad_invalida`);
    if (price == null || price <= 0) reasons.push(`linea_${n}_precio_invalido`);
    const d = db[i]; if (!d) { reasons.push(`linea_${n}_sin_correspondencia`); return; }
    const idDe = (x) => txtDe(x.id) || txtDe(x.piezaId) || txtDe(x.producto_id) || txtDe(x.productoId) || txtDe(x.nombre);
    if (!idDe(p) || !idDe(d) || idDe(p) !== idDe(d)) { reasons.push(`linea_${n}_identidad_no_coincide`); return; }
    const pidTxt = txtDe(p.producto_id) || txtDe(p.productoId) || txtDe(p.product_id);
    const pvidTxt = txtDe(p.producto_version_id) || txtDe(p.productoVersionId) || txtDe(p.product_version_id);
    const pid = enteroTxt(pidTxt) ? Number(pidTxt) : null;
    const pvid = enteroTxt(pvidTxt) ? Number(pvidTxt) : null;
    if (pidTxt && pid == null && pvidTxt) reasons.push(`linea_${n}_producto_id_invalido`);
    if (pvidTxt && pvid == null) reasons.push(`linea_${n}_producto_version_id_invalido`);
    if (pid != null && pvid == null) reasons.push(`linea_${n}_sin_product_version_id`);
    if (pid == null && pvid != null) reasons.push(`linea_${n}_sin_product_id`);
    let cost = null;
    if (pid != null && pvid != null) reasons.push(`linea_${n}_product_version_no_corresponde`);   // la nube falsa no tiene Producto Maestro
    else {
      // Legacy: el costo sale SOLO de la fila persistida; el veredicto, de `costoEstado`.
      cost = numDe(d.costoUnitario);
      const ce = txtDe(d.costoEstado).toLowerCase();
      if (ce === 'preliminar') econ.push(`linea_${n}_costo_preliminar_no_certificado`);
      else if (ce === 'incompleto' || ce === 'bloqueado') econ.push(`linea_${n}_costo_no_certificado`);
    }
    if (cost == null || cost <= 0) { if (!(pid != null && econ.length)) econ.push(`linea_${n}_costo_desconocido`); }
    else if (price != null && price > 0) {
      const m = ((price - cost) / price) * 100;
      if (price < cost) aprob.push(`linea_${n}_precio_bajo_costo`);
      else if (m < MARGEN_MIN) aprob.push(`linea_${n}_margen_bajo_${MARGEN_MIN}`);
    }
  });
  const u = (a) => [...new Set(a)];
  const hash = hashSnapshot(snap);
  // verificar_aprobacion: APROBADA para ESTE hash y la versión vigente de reglas.
  const requiere = aprob.length > 0;
  const aprobada = !requiere || aprobaciones.some((a) => a.cotizacion_id === fila.id && a.revision_hash === hash && a.estado === 'APROBADA' && a.reglas_version === REGLAS_VERSION);
  const base = { hash, approval_reasons: u(aprob), approval_required: requiere, approved: aprobada, margen_minimo_pct: MARGEN_MIN };
  if (reasons.length) return { state: 'BLOCKED', reasons: u(reasons), economics: u(econ), ...base };
  if (econ.length) return { state: 'ECONOMICS_INCOMPLETE', reasons: u(econ), ...base };
  if (!aprobada) return { state: 'APPROVAL_REQUIRED', reasons: u(aprob), ...base };
  return { state: 'ALLOWED', reasons: [], ...base };
}

// `preservaEconomia` (default false = producción hoy): true = semántica de la migración 20261010170000;
// 'vh035c' = PROPUESTA_vh035c (compuesta con VH-148: el control de versión va ANTES y delega en el mismo núcleo).
// `rpcVieja` (default false = con PROPUESTA_vh148): true = producción SIN la migración VH-148 (cotizacion_segura
// no devuelve `actualizado` y la sobrecarga de tres argumentos no existe → PostgREST 404 PGRST202).
export function crearNubeFalsa({ usuarios, preservaEconomia = false, rpcVieja = false }) {
  const permitidos = new Map(Object.entries(usuarios));   // email → rol
  const modo035c = preservaEconomia === 'vh035c';
  // Compuerta de emisión: con VH-035c el wrapper suma los motivos de recosteo pendiente de la FILA.
  const compuerta = (fila, snap) => { const g = evaluarEmision(fila, snap, f.aprobaciones); return modo035c ? compuertaConRecosteo(g, fila) : g; };
  const f = {
    filas: new Map(),            // id → fila cotizaciones
    idempotencia: new Map(),     // `${email}|${key}` → { id, hash }
    siguienteId: 100,
    creates: 0, updates: 0, llamadas: [],
    conflictos: 0, esperados: [],   // VH-148: rechazos 40001 y qué p_actualizado_esperado mandó cada intento (undefined = llamada vieja)
    revisiones: [],              // cotizaciones_revisiones (lo que emitir_revision conservó)
    aprobaciones: [],            // tabla aprobaciones (solicitar_aprobacion_snapshot / resolver_aprobacion)
    // Dirección resuelve (misma regla que private_api.resolver_aprobacion: sólo PENDIENTE).
    resolverAprobacion(id, estado, quien) { const a = f.aprobaciones.find((x) => x.id === id && x.estado === 'PENDIENTE'); if (!a) throw new Error(`aprobación ${id} no existe o ya fue resuelta`); Object.assign(a, { estado, resuelto_por: quien, resuelto_en: new Date().toISOString() }); return a; },
    caida: false,                // true = la red "se cayó": todo falla
    lectura: LECTURA_EJEMPLO,
    permitidos,
    sembrarFila(fila) {
      const id = fila.id ?? f.siguienteId++;
      // VH-035c: el trigger de normalize corre también en el INSERT (cost_status siempre presente).
      const partidas = modo035c && Array.isArray(fila.partidas) ? normalizarCostStatus(fila.partidas) : fila.partidas;
      f.filas.set(id, { estado: 'borrador', activa: true, creado: new Date().toISOString(), actualizado: new Date().toISOString(), ...fila, ...(partidas !== undefined ? { partidas } : {}), id });
      return id;
    },
    // VH-035c: tabla `productos` (id → version_tecnica_vigente_id) para validar renglones nuevos con producto_id.
    productos: new Map(),
  };
  const rolDe = (email) => permitidos.get(email) || null;
  const veEconomia = (email) => rolDe(email) === 'direccion';
  const editaConfig = (email) => ['direccion', 'diseno'].includes(rolDe(email));
  // Qué escritura se strippea: producción = trg_strip_seller_economics (sólo 'vendedor'); migración = todo rol sin economía.
  const strippeaEscritura = (email) => (preservaEconomia ? !veEconomia(email) : rolDe(email) === 'vendedor');
  const emailDe = (req) => {
    const auth = req.headers()['authorization'] || '';
    const m = /^Bearer (.+)$/.exec(auth); if (!m) return null;
    try { return JSON.parse(Buffer.from(m[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).email || null; } catch { return null; }
  };
  const segura = (id, email) => {
    const c = f.filas.get(Number(id));
    if (!c) return { ok: false, motivo: 'no_existe' };
    if (!(c.usuario === email || editaConfig(email))) return { ok: false, motivo: 'sin_acceso' };
    // VH-148: `actualizado` viaja a todo rol (no es economía), igual que en la migración.
    const payload = { ok: true, id: c.id, folio: c.folio ?? null, folio_oficial: c.folio_oficial ?? null, cliente: c.cliente ?? null, estado: c.estado, total: c.total ?? 0, piezas: c.piezas ?? 0, activa: c.activa, cliente_id: null, contacto_id: null, proyecto_id: null, partidas: c.partidas || [], totales: c.totales ?? null, acomodo: c.acomodo ?? null, creado: c.creado, ...(rpcVieja ? {} : { actualizado: c.actualizado }) };
    return veEconomia(email) ? payload : sinEconomia(payload);
  };
  const err = (route, message, status = 400, code = 'P0001') => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code, message, details: null, hint: null }) });
  // Status HTTP con que PostgREST entrega cada SQLSTATE que levanta VH-035c.
  const STATUS_SQLSTATE = { 42501: 403, 22023: 400, 23503: 409 };
  // VH-148: el error de conflicto como lo entrega PostgREST (code = SQLSTATE, details = DETAIL, hint = HINT).
  // El cliente decide por `code`/mensaje, no por el status HTTP (PostgREST reporta la clase 40 como 500;
  // aquí se usa 409 por legibilidad en los reportes: ambas rutas las cubre el cliente).
  const errConflicto = (route, actualizado) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({
    code: '40001',
    message: `CONFLICTO_VERSION: la cotización cambió en el servidor (${actualizado}). Recarga antes de guardar.`,
    details: `actualizado=${actualizado}`,
    hint: 'Vuelve a cargar la cotización (cotizacion_segura) y decide: ver la versión del servidor o volver a aplicar tus cambios con el actualizado nuevo.',
  }) });
  // timestamptz: dos cadenas ISO son la misma versión si representan el mismo instante.
  const mismaVersion = (a, b) => a === b || (Date.parse(a) === Date.parse(b) && !Number.isNaN(Date.parse(a)));
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  async function manejar(route) {
    const req = route.request();
    const url = new URL(req.url());
    // El dev server de laboratorio corre con VITE_*_FN=<fn>-rc (sólo desarrollo): la nube falsa contesta la
    // misma Edge con o sin sufijo -rc (O-4, resiliencia 10/10).
    const ruta = url.pathname.replace(/^(\/functions\/v1\/[a-z-]+?)-rc$/, '$1');
    f.llamadas.push(`${req.method()} ${ruta}${url.search}`);
    if (f.caida) return route.abort('connectionfailed');

    // ---- auth ----
    if (ruta === '/auth/v1/token') {
      const body = req.postDataJSON?.() || {};
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        if (!permitidos.has(body.email) || body.password !== 'prueba-123') return json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
        return json(route, sesionDe(body.email));
      }
      if (grant === 'refresh_token') {
        const email = [...permitidos.keys()].find((e) => body.refresh_token === `r-${idDe(e)}`);
        return email ? json(route, sesionDe(email)) : json(route, { error: 'invalid_grant' }, 400);
      }
      return json(route, { error: 'unsupported' }, 400);
    }
    if (ruta === '/auth/v1/user') { const e = emailDe(req); return e ? json(route, sesionDe(e).user) : json(route, { message: 'no session' }, 401); }
    if (ruta === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
    if (ruta.startsWith('/auth/v1/')) return json(route, {});

    const email = emailDe(req);
    // ---- tablas ----
    if (ruta === '/rest/v1/permitidos') {
      const q = url.searchParams.get('email');
      if (q?.startsWith('eq.')) { const e = q.slice(3); return permitidos.has(e) ? json(route, { rol: permitidos.get(e), nombre: e.split('@')[0] }) : json(route, { message: 'no rows' }, 406); }
      return json(route, [...permitidos].map(([e, rol]) => ({ email: e, nombre: e.split('@')[0], rol, creado: '2026-01-01T00:00:00Z' })));
    }
    if (ruta === '/rest/v1/direccion') return req.method() === 'GET' ? json(route, { datos: null }) : json(route, []);
    if (ruta === '/rest/v1/config') return json(route, []);
    if (ruta === '/rest/v1/reglas' || ruta === '/rest/v1/aprendizajes' || ruta === '/rest/v1/confirmaciones') return json(route, []);
    if (ruta.startsWith('/rest/v1/rpc/')) {
      const fn = ruta.slice('/rest/v1/rpc/'.length);
      const body = req.postDataJSON?.() || {};
      if (!email || !rolDe(email)) return err(route, 'no autorizado', 401);
      if (fn === 'config_para_rol') return json(route, {});
      // VH-088: búsqueda en el catálogo grande; la nube falsa no tiene ERP → vacío (la UI avisa).
      if (fn === 'buscar_insumos_motor') return json(route, f.busquedaInsumos || []);
      if (fn === 'catalogo_motor') return json(route, f.catalogoMotor || {});
      // VH-089: carga de compras del ERP; la nube falsa contesta con los conteos del lote (sin tocar nada).
      if (fn === 'cargar_erp_ultima_compra') {
        if (!editaConfig(email)) return err(route, 'no autorizado: sólo Dirección carga compras del ERP', 400);
        const cat = Array.isArray(body.p_catalogo) ? body.p_catalogo : []; const pre = Array.isArray(body.p_precios) ? body.p_precios : [];
        f.cargasErp = (f.cargasErp || []).concat([{ documento: body.p_documento, catalogo: cat.length, precios: pre.length }]);
        return json(route, { catalogo_nuevos: cat.length, catalogo_existentes: 0, precios_nuevos: pre.length, precios_duplicados: 0, aprobados: pre.filter((p) => p.estado === 'propuesto').length, errores: [] });
      }
      // VH-063: política pública (sólo descuento máximo + versión). `f.politica` se sustituye por prueba.
      if (fn === 'politica_comercial_publica') return json(route, f.politica || { vigente: true, version: REGLAS_VERSION, descuento_max_sin_aprobacion: 40 });
      if (fn === 'cotizaciones_mias') {
        const mias = [...f.filas.values()].filter((c) => c.activa !== false && (c.usuario === email || editaConfig(email)))
          .sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || ''))
          .map((c) => ({ id: c.id, cliente: c.cliente, folio: c.folio, total: c.total, piezas: c.piezas, estado: c.estado, usuario: c.usuario, creado: c.creado, actualizado: c.actualizado, huella_mp: c.huella_mp ?? null, partidas: (c.partidas || []).map((p) => ({ nombre: p.nombre, cantidad: p.cantidad, precioUnitario: p.precioUnitario })) }));
        return json(route, mias);
      }
      if (fn === 'cotizacion_segura') return json(route, segura(body.p_id, email));
      if (fn === 'cotizacion_emitible') {
        const c = f.filas.get(Number(body.p_cotizacion_id));
        if (!c) return json(route, { ok: false, estado: 'BLOCKED', motivos: ['no_existe'] });
        const g = compuerta(c, { partidas: c.partidas, totales: c.totales || {}, total: c.total });
        return json(route, { ok: g.state === 'ALLOWED', estado: g.state, motivos: g.reasons || [], economics: g.economics || [], hash: g.hash });
      }
      if (fn === 'emitir_revision' || fn === 'emitir_revision_v2') {
        const c = f.filas.get(Number(body.p_cotizacion_id)); const snap = body.p_snapshot;
        if (!c) return err(route, `emitir_revision_v2: la cotizacion ${body.p_cotizacion_id} no existe`);
        if (!(c.usuario === email || editaConfig(email))) return err(route, 'emitir_revision_v2: sin permiso sobre la cotizacion');
        if (!snap || !Array.isArray(snap.partidas) || !snap.partidas.length) return err(route, 'emitir_revision_v2: snapshot sin partidas');
        const g = compuerta(c, snap);
        if (g.state !== 'ALLOWED') return err(route, `emitir_revision_v2: emisión bloqueada [${g.state}]: ${JSON.stringify(g.reasons)}`);
        const t = snap.totales || {}; const nz = (x) => Number(x) || 0; const r2 = (x) => Math.round(x * 100) / 100;
        const total = r2(nz(t.precioLista) - nz(t.descuento) + nz(t.contingencia) + nz(t.maniobras) + nz(t.flete) + nz(t.iva));
        if (snap.total == null || r2(Number(snap.total)) !== total) return err(route, `emitir_revision_v2: el total (${snap.total}) no es la suma exacta del desglose (${total})`);
        const plExact = r2(snap.partidas.reduce((s, x) => s + r2(nz(x.precioUnitario) * nz(x.cantidad)), 0));
        if (r2(nz(t.precioLista)) !== plExact) return err(route, `emitir_revision_v2: precioLista (${t.precioLista}) no coincide con la suma de partidas (${plExact})`);
        const ult = f.revisiones.filter((r) => r.cotizacion_id === c.id).sort((a, b) => b.revision - a.revision)[0];
        if (ult && ult.hash === g.hash) return json(route, { revision: ult.revision, nueva: false, total, v: 2, gate: 'ALLOWED' });
        const rev = (ult?.revision || 0) + 1;
        f.revisiones.push({ id: f.revisiones.length + 1, cotizacion_id: c.id, folio: c.folio ?? null, cliente: c.cliente ?? null, revision: rev, emitida_en: new Date().toISOString(), usuario: email, total, hash: g.hash, snapshot: snap, tipo: 'generado_v2' });
        return json(route, { revision: rev, nueva: true, total, v: 2, gate: 'ALLOWED' });
      }
      if (fn === 'evaluar_emision_cotizacion') {
        const c = f.filas.get(Number(body.p_cotizacion_id));
        if (!c) return json(route, { state: 'BLOCKED', reasons: ['cotizacion_no_existe'] });
        if (!(c.usuario === email || editaConfig(email))) return json(route, { state: 'BLOCKED', reasons: ['sin_permiso'] });
        return json(route, compuerta(c, body.p_snapshot));
      }
      if (fn === 'solicitar_aprobacion_snapshot') {
        const c = f.filas.get(Number(body.p_cotizacion_id)); const snap = body.p_snapshot;
        if (!c) return err(route, 'sin permiso sobre la cotizacion');
        if (!(c.usuario === email || editaConfig(email))) return err(route, 'sin permiso sobre la cotizacion');
        if (!snap || typeof snap !== 'object') return err(route, 'snapshot invalido');
        const hash = hashSnapshot(snap);
        const previa = f.aprobaciones.find((a) => a.cotizacion_id === c.id && a.revision_hash === hash && a.estado === 'PENDIENTE' && a.reglas_version === REGLAS_VERSION);
        if (previa) return json(route, { ok: true, id: previa.id, estado: previa.estado, hash, reglas_version: REGLAS_VERSION, ya_existia: true });
        const a = { id: f.aprobaciones.length + 1, cotizacion_id: c.id, revision_hash: hash, estado: 'PENDIENTE', descuento_solicitado: Number(snap?.totales?.descuentoPct) || 0, motivo: body.p_motivo ?? null, solicitado_por: email, creado: new Date().toISOString(), resuelto_por: null, resuelto_en: null, reglas_version: REGLAS_VERSION };
        f.aprobaciones.push(a);
        return json(route, { ok: true, id: a.id, estado: a.estado, hash, reglas_version: REGLAS_VERSION, ya_existia: false });
      }
      if (fn === 'resolver_aprobacion') {
        if (rolDe(email) !== 'direccion') return err(route, 'solo Dirección resuelve aprobaciones');
        if (!['APROBADA', 'RECHAZADA', 'CONTRAOFERTA'].includes(body.p_estado)) return err(route, `estado inválido: ${body.p_estado}`);
        try { const a = f.resolverAprobacion(Number(body.p_id), body.p_estado, email); return json(route, { id: a.id, estado: a.estado, resuelto_por: a.resuelto_por }); }
        catch (e) { return err(route, e.message); }
      }
      if (fn === 'cotizacion_revisiones_seguras') {
        const id = Number(body.p_cotizacion_id); const c = f.filas.get(id);
        if (!c) return err(route, 'no autorizado');
        if (!(c.usuario === email || editaConfig(email))) return err(route, 'sin acceso');
        const lista = f.revisiones.filter((r) => r.cotizacion_id === id).sort((a, b) => b.revision - a.revision).map((r) => (veEconomia(email) ? r : sinEconomia(r)));
        return json(route, lista);
      }
      if (fn === 'crear_cotizacion_segura') {
        const p = body.p_payload || {};
        if (p.estado && p.estado !== 'borrador') return err(route, 'estado protegido; use el flujo de emision');
        if (!Array.isArray(p.partidas)) return err(route, 'partidas debe ser arreglo');
        const key = (p._idempotency_key || '').trim() || null;
        const { _idempotency_key, ...sinKey } = p;
        const hash = JSON.stringify(sinKey);
        if (key) {
          if (!/^[a-zA-Z0-9_-]{10,100}$/.test(key)) return err(route, 'idempotency key invalid');
          const prev = f.idempotencia.get(`${email}|${key}`);
          if (prev) {
            if (prev.hash !== hash) return err(route, 'idempotency key reused with different payload');
            return json(route, segura(prev.id, email));
          }
        }
        const owner = editaConfig(email) && p.usuario && permitidos.has(p.usuario) ? p.usuario : email;
        const partidas = veEconomia(email) ? p.partidas : sinEconomia(p.partidas);
        const id = f.sembrarFila({ usuario: owner, cliente: p.cliente || null, folio: p.folio || null, partidas, acomodo: p.acomodo ?? null, totales: p.totales ?? null, total: Number(p.total) || 0, piezas: Number(p.piezas) || 0, huella_mp: p.huella_mp || null });
        f.creates += 1;
        if (key) f.idempotencia.set(`${email}|${key}`, { id, hash });
        return json(route, segura(id, email));
      }
      if (fn === 'actualizar_cotizacion_segura') {
        const c = f.filas.get(Number(body.p_cotizacion_id));
        const patch = body.p_patch || {};
        // VH-148: PostgREST escoge la sobrecarga por los nombres del body. Sin la migración (rpcVieja)
        // la de tres argumentos no existe.
        const conVersion = 'p_actualizado_esperado' in body;
        f.esperados.push(conVersion ? body.p_actualizado_esperado : undefined);
        if (rpcVieja && conVersion) return json(route, { code: 'PGRST202', message: 'Could not find the function public.actualizar_cotizacion_segura(p_actualizado_esperado, p_cotizacion_id, p_patch) in the schema cache', details: null, hint: null }, 404);
        if (!c) return err(route, 'cotizacion no existe');
        if (!(c.usuario === email || editaConfig(email))) return err(route, 'sin acceso');
        if ((c.estado || 'borrador') !== 'borrador') return err(route, `cotizacion no editable en estado ${c.estado}`);
        // VH-148: mismo lugar que en la migración (tras existencia/acceso/estado, antes de validar el patch).
        // NULL explícito = sin control. Si la versión no es la de la fila → 40001 y NADA cambia.
        if (conVersion && body.p_actualizado_esperado != null && !mismaVersion(c.actualizado, body.p_actualizado_esperado)) { f.conflictos += 1; return errConflicto(route, c.actualizado); }
        if ('estado' in patch && patch.estado !== 'borrador') return err(route, 'estado protegido; use el flujo de emision');
        let partidas = 'partidas' in patch ? patch.partidas : c.partidas;
        if (!Array.isArray(partidas)) return err(route, 'partidas debe ser arreglo');
        if ('partidas' in patch && !veEconomia(email)) {
          if (modo035c) {                                                               // PROPUESTA_vh035c (NO en producción)
            try { partidas = fusionarVh035c(c.partidas, sinEconomia(partidas), f.productos); }
            catch (e) { if (!e.code) throw e; return err(route, e.message, STATUS_SQLSTATE[e.code] || 400, e.code); }   // nada se escribe
          } else if (preservaEconomia) partidas = fusionar(c.partidas, sinEconomia(partidas));   // migración 20261010170000 (NO en producción)
          else if (strippeaEscritura(email)) partidas = sinEconomia(partidas);          // producción hoy: el trigger strippea al vendedor; la economía vieja se PIERDE
        }                                                                                // diseño en producción: escribe tal cual (ni strip ni fusión)
        if (modo035c) partidas = normalizarCostStatus(partidas);   // trg_normalize_economics_status
        Object.assign(c, {
          cliente: 'cliente' in patch ? (patch.cliente || null) : c.cliente,
          folio: 'folio' in patch ? (patch.folio || null) : c.folio,
          partidas,
          acomodo: 'acomodo' in patch ? (strippeaEscritura(email) ? sinEconomia(patch.acomodo) : patch.acomodo) : c.acomodo,
          totales: 'totales' in patch ? (strippeaEscritura(email) ? sinEconomia(patch.totales) : patch.totales) : c.totales,
          total: 'total' in patch ? Number(patch.total) || 0 : c.total,
          piezas: 'piezas' in patch ? Number(patch.piezas) || 0 : c.piezas,
          huella_mp: 'huella_mp' in patch ? patch.huella_mp : c.huella_mp,
          actualizado: new Date().toISOString(),
        });
        f.updates += 1;
        return json(route, segura(c.id, email));
      }
      return json(route, {});   // cualquier otro RPC: vacío
    }
    if (ruta === '/rest/v1/aprobaciones' && req.method() === 'GET') {
      const m = /cotizacion_id=eq\.(\d+)/.exec(url.search || '');
      const est = /estado=eq\.([A-Z_]+)/.exec(url.search || '');
      const lista = f.aprobaciones
        .filter((a) => !m || a.cotizacion_id === Number(m[1]))
        .filter((a) => !est || a.estado === est[1])
        .filter((a) => a.solicitado_por === email || rolDe(email) === 'direccion' || editaConfig(email));
      return json(route, lista);
    }
    if (ruta.startsWith('/rest/v1/')) return json(route, []);
    // leer-plano: una lectura FIJA (plano ejecutivo con dos islas contadas) para probar
    // la compuerta de confirmación sin LLM. `f.lectura` se puede sustituir por prueba.
    // VH-072: generar-render v30 responde `url` de Storage (no dataUrl). `f.renderServidor` se sustituye por prueba.
    if (ruta === '/functions/v1/generar-render') return json(route, f.renderServidor || { ok: true, url: `${HOST}/storage/v1/object/public/renders/generated/e2e/2026-10-11/render-e2e.png`, storagePath: 'generated/e2e/2026-10-11/render-e2e.png', mime: 'image/png', bytes: 1234, request_id: 'req-render-1', model: 'gemini-3-pro-image', image_size: '2K', audit: { pass: true, skipped: true, reasons: [] } });
    // VH-069/070: cotizar-texto sin LLM. `f.cotizacionIA` se sustituye por prueba; por defecto una
    // propuesta con un producto real, uno inexistente, un noEncontrado y un extra descartado.
    if (ruta === '/functions/v1/cotizar-texto') {
      return json(route, f.cotizacionIA || { ok: true, rondasAclaracion: 0, sugerenciasDescartadas: ['Credenza ejecutiva'], propuesta: {
        items: [
          // banca doble 1200×1200 · 6 usuarios · biombo pet: tiene precio REAL en preciosVenta → el vendedor sí la ve con precio
          { ruta: 'applt', producto: 'banca_doble', cantidad: 1, seleccion: [{ clave: 'largoMM', valor: '1200' }, { clave: 'fondoMM', valor: '1200' }, { clave: 'usuarios', valor: '6' }, { clave: 'biombo', valor: 'pet' }], etiqueta: 'Banca doble 6 usuarios', confianza: 'alta', nota: '' },
          // escritorio 1500×750: sin precio autorizado para vendedor → fail-closed, no entra en $0
          { ruta: 'applt', producto: 'escritorio', cantidad: 2, seleccion: [{ clave: 'largoMM', valor: '1500' }, { clave: 'fondoMM', valor: '750' }], etiqueta: 'Escritorio 1.50', confianza: 'alta', nota: '' },
          { ruta: 'linea_inexistente', producto: 'nada', cantidad: 1, seleccion: [], etiqueta: 'Mueble fantasma', confianza: 'baja', nota: '' },
        ],
        banco: [], preguntas: [], resumen: 'Entendí: dos escritorios de 1.50 y un mueble que no reconozco.', noEncontrado: ['Cabina acústica'],
      } });
    }
    // VH-067: acomodar-espacio responde ok:true SIEMPRE; el veredicto va en layoutSpec.status.
    // `f.acomodoServidor` se sustituye por prueba (FAIL / PARTIAL / PASS).
    if (ruta === '/functions/v1/acomodar-espacio' || ruta === '/functions/v1/acomodar-espacio-recovery') return json(route, f.acomodoServidor || { ok: true, plan: { colocacion: [], caben: false }, total: 0, colocadas: 0, noColocadas: [], layoutSpec: { status: 'FAIL', validation: { issues: [], reviews: [] } } });
    // VH-066: analizar-mueble sin LLM: una propuesta fija; `f.catalogoFuente` se sustituye por prueba
    // ('cliente-fallback' = el catálogo central no estuvo, la UI debe avisar).
    if (ruta === '/functions/v1/analizar-mueble') {
      return json(route, { ok: true, request_id: 'req-mueble-1', catalogoFuente: f.catalogoFuente || 'canonico', propuesta: f.propuesta || {
        producto: 'Mesa de prueba', tipo: 'mesa', descripcionCliente: 'Mesa de prueba', materiales: [], volumenAsumido: '', confianzaGeneral: 'media', informe: '', preguntas: [],
        piezas: [{ nombre: 'Cubierta', insumoId: '', material_solicitado: 'MDF 16 mm', material_match: 'NOT_AVAILABLE', forma: 'area', largoMM: 1200, anchoMM: 600, cantidad: 1, hojas: 0, confianza: 'media', nota: '', razonamiento: '', semantic_role: 'top' }],
      } });
    }
    // VH-064: como la edge v11, viaja `floorSpec.validation`; `f.validacionPlano` se sustituye por prueba.
    if (ruta === '/functions/v1/leer-plano') {
      if (f.validacionPlano?.state === 'FAIL') return json(route, { ok: false, code: 'FLOOR_SPEC_INVALID', error: 'La lectura del plano no pasó la validación geométrica determinista.', lectura: f.lectura, floorSpec: { validation: f.validacionPlano }, request_id: 'req-fail-1' }, 422);
      return json(route, { ok: true, lectura: f.lectura, floorSpec: { version: 'FLOOR_SPEC_V2', validation: f.validacionPlano || { state: 'PASS', issues: [], warnings: [] } }, request_id: 'req-plano-1', strictGeometry: true });
    }
    if (ruta.startsWith('/functions/v1/')) return json(route, {});
    // Imágenes PÚBLICAS de marca y catálogo (sólo lectura, sin sesión): pasan a la red real
    // para que el inicio con fotografía se vea como en producción. Todo lo demás de Storage: 404.
    if (route.request().method() === 'GET' && ruta.startsWith('/storage/v1/object/public/app/')) return route.continue();
    if (ruta.startsWith('/storage/v1/')) return route.fulfill({ status: 404, body: '' });
    return json(route, {});
  }

  f.instalar = (context) => context.route(`${HOST}/**`, manejar);
  return f;
}

// Estado local sembrado como lo guarda almacen.js (clave CLAVE_LOCAL).
export function estadoLocal({ cotizacion = {}, onboardingVisto = true } = {}) {
  return {
    version: 1, onboardingVisto,
    cotizacion: { cliente: '', folio: '', fecha: '10 de octubre de 2026', partidas: [], ...cotizacion },
  };
}
