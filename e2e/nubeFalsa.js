// ============================================================================
//  NUBE FALSA para E2E (Bloque 1). Intercepta TODO lo que la app le manda a
//  Supabase y responde como el servidor:
//   - auth por contraseña (JWT sin firma, suficiente para supabase-js),
//   - `permitidos` por rol, `config_para_rol`, `direccion`, `reglas`, `aprendizajes`,
//   - RPCs de cotización con la MISMA semántica que la base DESPUÉS de la migración
//     20261010170000: creación idempotente por `_idempotency_key`, dueño/rol,
//     `cotizacion_segura` sin economía para quien no la ve, y
//     `actualizar_cotizacion_segura` que strippea lo que entra y RE-PEGA la economía
//     que ya tenía la fila (ver supabase/tests/preservaEconomia.test.js, que prueba
//     esa semántica contra PostgreSQL real).
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

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (email) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: idDe(email), email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
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

export function crearNubeFalsa({ usuarios }) {
  const permitidos = new Map(Object.entries(usuarios));   // email → rol
  const f = {
    filas: new Map(),            // id → fila cotizaciones
    idempotencia: new Map(),     // `${email}|${key}` → { id, hash }
    siguienteId: 100,
    creates: 0, updates: 0, llamadas: [],
    caida: false,                // true = la red "se cayó": todo falla
    permitidos,
    sembrarFila(fila) { const id = fila.id ?? f.siguienteId++; f.filas.set(id, { estado: 'borrador', activa: true, creado: new Date().toISOString(), actualizado: new Date().toISOString(), ...fila, id }); return id; },
  };
  const rolDe = (email) => permitidos.get(email) || null;
  const veEconomia = (email) => rolDe(email) === 'direccion';
  const editaConfig = (email) => ['direccion', 'diseno'].includes(rolDe(email));
  const emailDe = (req) => {
    const auth = req.headers()['authorization'] || '';
    const m = /^Bearer (.+)$/.exec(auth); if (!m) return null;
    try { return JSON.parse(Buffer.from(m[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).email || null; } catch { return null; }
  };
  const segura = (id, email) => {
    const c = f.filas.get(Number(id));
    if (!c) return { ok: false, motivo: 'no_existe' };
    if (!(c.usuario === email || editaConfig(email))) return { ok: false, motivo: 'sin_acceso' };
    const payload = { ok: true, id: c.id, folio: c.folio ?? null, folio_oficial: c.folio_oficial ?? null, cliente: c.cliente ?? null, estado: c.estado, total: c.total ?? 0, piezas: c.piezas ?? 0, activa: c.activa, cliente_id: null, contacto_id: null, proyecto_id: null, partidas: c.partidas || [], totales: c.totales ?? null, acomodo: c.acomodo ?? null, creado: c.creado };
    return veEconomia(email) ? payload : sinEconomia(payload);
  };
  const err = (route, message, status = 400) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message, details: null, hint: null }) });
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  async function manejar(route) {
    const req = route.request();
    const url = new URL(req.url());
    const ruta = url.pathname;
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
      if (fn === 'cotizaciones_mias') {
        const mias = [...f.filas.values()].filter((c) => c.activa !== false && (c.usuario === email || editaConfig(email)))
          .sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || ''))
          .map((c) => ({ id: c.id, cliente: c.cliente, folio: c.folio, total: c.total, piezas: c.piezas, estado: c.estado, usuario: c.usuario, creado: c.creado, actualizado: c.actualizado, huella_mp: c.huella_mp ?? null, partidas: (c.partidas || []).map((p) => ({ nombre: p.nombre, cantidad: p.cantidad, precioUnitario: p.precioUnitario })) }));
        return json(route, mias);
      }
      if (fn === 'cotizacion_segura') return json(route, segura(body.p_id, email));
      if (fn === 'cotizacion_emitible') return json(route, { ok: true, estado: 'EMITIBLE', motivos: [] });
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
        if (!c) return err(route, 'cotizacion no existe');
        if (!(c.usuario === email || editaConfig(email))) return err(route, 'sin acceso');
        if ((c.estado || 'borrador') !== 'borrador') return err(route, `cotizacion no editable en estado ${c.estado}`);
        if ('estado' in patch && patch.estado !== 'borrador') return err(route, 'estado protegido; use el flujo de emision');
        let partidas = 'partidas' in patch ? patch.partidas : c.partidas;
        if (!Array.isArray(partidas)) return err(route, 'partidas debe ser arreglo');
        if (!veEconomia(email) && 'partidas' in patch) partidas = fusionar(c.partidas, sinEconomia(partidas));   // VH-035
        Object.assign(c, {
          cliente: 'cliente' in patch ? (patch.cliente || null) : c.cliente,
          folio: 'folio' in patch ? (patch.folio || null) : c.folio,
          partidas,
          acomodo: 'acomodo' in patch ? (veEconomia(email) ? patch.acomodo : sinEconomia(patch.acomodo)) : c.acomodo,
          totales: 'totales' in patch ? (veEconomia(email) ? patch.totales : sinEconomia(patch.totales)) : c.totales,
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
    if (ruta.startsWith('/rest/v1/')) return json(route, []);
    if (ruta.startsWith('/functions/v1/')) return json(route, {});
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
