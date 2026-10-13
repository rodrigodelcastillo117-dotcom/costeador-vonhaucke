// ============================================================================
//  VH-035c · PRUEBA EN BASE AISLADA (PGlite = PostgreSQL real en WASM, en memoria).
//
//  Decisión de Dirección (2026-10-13): vh035b corregía el reciclaje por cambio de producto, pero
//  (1) perdía la economía ANIDADA (config.costeo, insumos[].costo), (2) no invalidaba por cambio
//  de MATERIAL ni (3) por cambio de CANTIDAD en costos por lote, (4) dejaba al vendedor re-pinear
//  producto_version_id sin validación del servidor y (5) no protegía estados de autoridad
//  (aprobado, estado_costo, lista_precio_item_id…). Además nadie probaba que una partida STALE
//  no se pudiera EMITIR. Aquí se carga el esquema real (baseline + cuerpos de producción del
//  2026-10-13 + la compuerta de emisión real) y encima la PROPUESTA vh035c. Nada toca producción.
//
//  El archivo supabase/tests/preservaEconomia.test.js queda intacto como documentación de vh035b.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');

// Definición completa de una función de `public` en el baseline (terminan en "\n;\n").
function defDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre} en el baseline`);
  return sql.slice(ini, sql.indexOf('\n;\n', ini)) + ';';
}
// Definición completa de una función de `private_api` en el baseline 08 (terminan en "$function$;").
function defDePrivateApi(nombre) {
  const sql = leer('supabase/schema/baseline/08_private_api.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION private_api.${nombre}(`);
  if (ini < 0) throw new Error(`no está private_api.${nombre} en el baseline`);
  const fin = sql.indexOf('$function$;', ini);
  return sql.slice(ini, fin + '$function$;'.length);
}

const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx', DISENO = 'diseno@vh.mx';

async function baseIntegral() {
  const db = new PGlite();
  const x = (s) => db.exec(s);
  await x(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create schema private_api;
    create function auth.uid() returns uuid language sql stable as $$
      select case when current_setting('test.email', true) in ('', null) then null
        else md5(current_setting('test.email', true))::uuid end $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when current_setting('test.email', true) in ('', null) then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, nombre text, rol text not null default 'vendedor', creado timestamptz not null default now());
    create table public.cotizaciones (
      id bigserial primary key, creado timestamptz not null default now(), actualizado timestamptz not null default now(),
      usuario text, cliente text, folio text, estado text not null default 'borrador',
      partidas jsonb not null default '[]'::jsonb, acomodo jsonb, totales jsonb, total numeric not null default 0,
      piezas integer not null default 0, huella_mp text, activa boolean not null default true, folio_oficial text,
      cliente_id bigint, contacto_id bigint, proyecto_id bigint);
    create table public.cotizaciones_revisiones (
      id bigserial primary key, cotizacion_id bigint, folio text, cliente text, revision integer not null,
      emitida_en timestamptz not null default now(), usuario text, total numeric, hash text not null, snapshot jsonb not null,
      tipo text not null default 'generado', unique (cotizacion_id, revision));
    create table public.aprobaciones (id bigserial primary key, cotizacion_id bigint, revision_hash text, estado text not null default 'PENDIENTE',
      descuento_solicitado numeric, motivo text, solicitado_por text, resuelto_por text, creado timestamptz not null default now(),
      resuelto_en timestamptz, reglas_version integer);
    create function private_api.rol_actual() returns text language sql stable as $$
      select lower(p.rol) from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') limit 1 $$;
    create function private_api.puede_entrar() returns boolean language sql stable as $$ select private_api.rol_actual() is not null $$;
    create function private_api.puede_editar_config() returns boolean language sql stable as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    create function private_api.puede_ver_economia() returns boolean language sql stable as $$ select private_api.rol_actual() = 'direccion' $$;
    create function public.puede_entrar() returns boolean language sql stable as $$ select private_api.puede_entrar() $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.puede_editar_config() $$;
    create function public.puede_ver_economia() returns boolean language sql stable as $$ select private_api.puede_ver_economia() $$;
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor'), ('${DISENO}','diseno');
    -- Producto Maestro mínimo (lo que leen pin_product_versions y evaluar_emision_cotizacion).
    create table public.productos (id bigint primary key, source_type text not null default 'catalogo', estado text not null default 'activo',
      activo boolean not null default true, version_tecnica_vigente_id bigint);
    create table public.producto_versiones (id bigint primary key, producto_id bigint not null, estado_tecnico text not null default 'certificado');
    create table public.producto_version_economia (producto_version_id bigint primary key, costo_oficial_referencia numeric);
    create table public.lista_precio_items (id bigint primary key, producto_id bigint not null, producto_version_id bigint, precio_lista numeric not null, piso_minimo numeric);
    create table public.reglas_comerciales (id bigserial primary key, version integer not null, descuento_max_sin_aprobacion numeric not null,
      margen_minimo_pct numeric, estado text not null default 'approved', vigencia_desde date not null default current_date, vigencia_hasta date);
    insert into public.productos values (1, 'catalogo', 'activo', true, 1933), (2, 'catalogo', 'activo', true, 2044);
    insert into public.producto_versiones values (1933, 1, 'certificado'), (2044, 2, 'certificado');
    insert into public.producto_version_economia values (1933, 21000), (2044, 19500);
    insert into public.lista_precio_items values (10, 1, 1933, 48000, 40000), (20, 2, 2044, 48000, 40000);
    insert into public.reglas_comerciales(version, descuento_max_sin_aprobacion, margen_minimo_pct) values (1, 10, 20);
    -- Stubs de lo que la compuerta sólo toca en especiales / precio autorizado (sin tablas de expedientes aquí).
    create function public.resolver_precio_especial_proyecto(p_producto_id bigint, p_version_id bigint, p_fecha date default current_date, p_moneda text default 'MXN')
      returns jsonb language sql stable as $$ select jsonb_build_object('ok', false, 'motivo', 'no_especial') $$;
    create function public.resolver_precio_autorizado(p_producto_id bigint, p_version_id bigint default null, p_variante_id bigint default null, p_fecha date default current_date, p_moneda text default null)
      returns jsonb language sql stable as $$
        select coalesce((select jsonb_build_object('ok', true, 'precio_lista', i.precio_lista, 'lista_precio_item_id', i.id)
                         from public.lista_precio_items i where i.producto_id = p_producto_id and i.producto_version_id = p_version_id limit 1),
                        jsonb_build_object('ok', false, 'motivo', 'sin_lista')) $$;
  `);
  // Funciones REALES de public (baseline 03), de private_api (baseline 08: compuerta de emisión) y
  // los cuerpos de producción del 2026-10-13 (RPC de guardado, triggers).
  for (const f of ['jsonb_sin_economia', 'normalizar_cost_status_partidas', 'pin_product_versions_in_partidas', 'normalize_economics_on_cotizacion_write',
    'pin_product_versions_on_cotizacion_write', 'strip_seller_economics_on_cotizacion_write', 'reglas_comerciales_vigentes']) {
    await x(defDeBaseline(f));
  }
  for (const f of ['hash_revision', 'requiere_aprobacion_snapshot', 'verificar_aprobacion', 'evaluar_emision_cotizacion', 'cotizacion_emitible', 'emitir_revision_v2']) {
    await x(defDePrivateApi(f));
    await x(defDeBaseline(f));   // wrapper public → private_api (auth.uid() + delegación), tal cual producción
  }
  await x(leer('supabase/tests/fixtures/private_api_prod_20261013.sql'));
  await x(`
    create function public.cotizacion_segura(p_id bigint) returns jsonb language sql stable as $$ select private_api.cotizacion_segura(p_id) $$;
    create function public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb) returns jsonb language sql as $$ select private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch) $$;
    create trigger trg_guard_cotizacion_estado_directo before insert or update on public.cotizaciones for each row execute function private_api.guard_cotizacion_estado_directo();
    create trigger trg_normalize_economics_status before insert or update on public.cotizaciones for each row execute function public.normalize_economics_on_cotizacion_write();
    create trigger trg_pin_product_versions before insert or update on public.cotizaciones for each row execute function public.pin_product_versions_on_cotizacion_write();
    create trigger trg_strip_seller_economics before insert or update on public.cotizaciones for each row execute function public.strip_seller_economics_on_cotizacion_write();
  `);
  return db;
}

// emitir_revision_v2 lee el email de request.jwt.claims (no de auth.jwt()): se fijan ambos.
const como = async (db, email, fn) => {
  await db.exec(`select set_config('test.email', '${email}', false), set_config('request.jwt.claims', '${email ? JSON.stringify({ email }) : ''}', false)`);
  try { return await fn(); } finally { await db.exec(`select set_config('test.email', '', false), set_config('request.jwt.claims', '', false)`); }
};
const rpc = async (db, email, sql, params) => como(db, email, async () => (await db.query(sql, params)).rows[0]);
const vistaDe = async (db, email, id) => (await rpc(db, email, 'select public.cotizacion_segura($1) as c', [id])).c;
const guardar = (db, email, id, patch) => rpc(db, email, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify(patch)]);
const partidaDe = async (db, id, pid = 'p1') => (await vistaDe(db, DIRECCION, id)).partidas.find((p) => p.id === pid);
const emitible = async (db, email, id) => (await rpc(db, email, 'select public.cotizacion_emitible($1) as c', [id])).c;
const emitir = (db, email, id, snap) => rpc(db, email, 'select public.emitir_revision_v2($1, $2::jsonb) as c', [id, JSON.stringify(snap)]);
// Snapshot coherente con la fila (lo que arma el cliente de Dirección al emitir).
function snapshotDe(vista) {
  const precioLista = vista.partidas.reduce((s, p) => s + Math.round(p.precioUnitario * p.cantidad * 100) / 100, 0);
  return { partidas: vista.partidas, totales: { precioLista, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva: 0 }, total: precioLista };
}

// Una partida como las deja Dirección hoy: economía de primer nivel + ANIDADA (config.costeo,
// config.insumos[].costo, pieza.componentes[].costo) + identidad de producto + material.
const P1 = {
  id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000,
  costoUnitario: 21000, margen: 30, costoDerivado: false, costoEstado: 'completo',
  producto_id: 1, producto_version_id: 1933, piezaId: 'bench-6', bom_hash: 'sha256:aaa',
  config: {
    color: 'nogal', finish: 'melamina',
    costeo: { costoUnitario: 21000, materiales: 15000, manoObra: 6000 },
    insumos: [{ clave: 'mdf18', costo: 950 }, { clave: 'canto-abs', costo: 120 }],
  },
  pieza: { componentes: [{ nombre: 'Tapa', insumoId: 'mdf18', piezas: 1, costo: 700 }, { nombre: 'Faldón', insumoId: 'mdf18', piezas: 2, costo: 250 }] },
};
// Lo que jsonb_sin_economia deja de P1 al vendedor (recursivo): costeo cae entero (^cost), costo de insumos y componentes cae.
const P1_VISTA_VENDEDOR = {
  id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000,
  producto_id: 1, producto_version_id: 1933, piezaId: 'bench-6', bom_hash: 'sha256:aaa',
  config: { color: 'nogal', finish: 'melamina', insumos: [{ clave: 'mdf18' }, { clave: 'canto-abs' }] },
  pieza: { componentes: [{ nombre: 'Tapa', insumoId: 'mdf18', piezas: 1 }, { nombre: 'Faldón', insumoId: 'mdf18', piezas: 2 }] },
};
// Silla de lista de precios: costo unitario SIN dependencia del lote (ni marca ni costoLote).
const P2 = { id: 'p2', nombre: 'Silla operativa', cantidad: 6, precioUnitario: 3200, costoUnitario: 1400, margen: 35 };
// Mueble costeado con el motor: costo por lote (contrato mínimo: costo_por_lote:true y/o costoLote anidado).
const P3_LOTE = {
  id: 'p3', nombre: 'Credenza a medida', cantidad: 2, precioUnitario: 12000, costoUnitario: 6100, margen: 40, costo_por_lote: true,
  config: { costeo: { costoLote: 12200, costoUnitario: 6100, lote: 2 } },
};
const ECON_LEGACY = { id: 'p1', nombre: 'Mueble legacy sin Producto Maestro', cantidad: 1, precioUnitario: 9000, costoUnitario: 4000, margen: 30, config: { finish: 'chapa' } };

async function sembrar(db, partidas, { total, piezas } = {}) {
  const t = total ?? partidas.reduce((s, p) => s + p.precioUnitario * p.cantidad, 0);
  const n = piezas ?? partidas.reduce((s, p) => s + p.cantidad, 0);
  const { id } = await rpc(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, partidas, total, piezas) values ($1, 'Tradeco', $2::jsonb, $3, $4) returning id`,
    [VENDEDOR, JSON.stringify(partidas), t, n]);
  return id;
}

// El rol sin economía reabre (vista despojada) y guarda `editar(partidaVista)` para p1 (y el resto tal cual).
async function reabrirYGuardar(db, rol, id, editar, extras = []) {
  const vista = await vistaDe(db, rol, id);
  expect(vista.ok).toBe(true);
  const partidas = vista.partidas.map((p) => (p.id === 'p1' ? editar(p) : p)).concat(extras);
  return guardar(db, rol, id, { partidas });
}

// Las PROPUESTAS se cargan encima de la misma base; cada bloque usa la suya.
function bloque(nombreMigracion, casos) {
  describe(nombreMigracion, () => {
    let db;
    beforeAll(async () => { db = await baseIntegral(); await db.exec(leer(`supabase/migrations/${nombreMigracion}`)); }, 90_000);
    afterAll(async () => { await db?.close(); });
    casos(() => db);
  });
}

// =============================================================================================
bloque('PROPUESTA_vh035c_preserva_economia_integral.sql', (db) => {
  it('semilla: Dirección ve toda la economía (primer nivel y anidada); normalize marcó KNOWN; pin respetó la versión', async () => {
    const id = await sembrar(db(), [P1, P2]);
    const p1 = await partidaDe(db(), id);
    expect(p1).toMatchObject({ ...P1, cost_status: 'KNOWN' });
    const vista = await vistaDe(db(), VENDEDOR, id);
    expect(vista.partidas[0]).toEqual(P1_VISTA_VENDEDOR);      // nada económico viaja al vendedor, ni anidado
  });

  // ---- 1. economía anidada ----
  for (const rol of [VENDEDOR, DISENO]) {
    it(`[1] ${rol}: cambia cantidad (costo unitario sin lote) → economía de Dirección ÍNTEGRA: primer nivel, config.costeo, insumos[].costo, componentes[].costo`, async () => {
      const id = await sembrar(db(), [P1, P2]);
      const r = await reabrirYGuardar(db(), rol, id, (p) => ({ ...p, cantidad: 3, nota: 'urge' }));
      expect(r.c.ok).toBe(true);
      const p1 = await partidaDe(db(), id);
      expect(p1).toMatchObject({ ...P1, cantidad: 3, nota: 'urge', cost_status: 'KNOWN' });
      expect(p1.config).toEqual(P1.config);                       // costeo + insumos[].costo volvieron
      expect(p1.pieza).toEqual(P1.pieza);                         // componentes[].costo volvieron
      expect(p1).not.toHaveProperty('cost_stale');
      expect(p1).not.toHaveProperty('cambios_rechazados');
      expect(await partidaDe(db(), id, 'p2')).toMatchObject({ costoUnitario: 1400, margen: 35, cost_status: 'KNOWN' });
    });
  }

  it('[1] el vendedor REORDENA insumos (con clave) y componentes (sin clave): no es cambio de material; cada elemento recupera SU costo', async () => {
    const id = await sembrar(db(), [P1]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({
      ...p,
      config: { ...p.config, insumos: [p.config.insumos[1], p.config.insumos[0]] },
      pieza: { componentes: [p.pieza.componentes[1], p.pieza.componentes[0]] },
    }));
    const p1 = await partidaDe(db(), id);
    expect(p1.config.insumos).toEqual([{ clave: 'canto-abs', costo: 120 }, { clave: 'mdf18', costo: 950 }]);
    expect(p1.pieza.componentes).toEqual([{ nombre: 'Faldón', insumoId: 'mdf18', piezas: 2, costo: 250 }, { nombre: 'Tapa', insumoId: 'mdf18', piezas: 1, costo: 700 }]);
    expect(p1).toMatchObject({ costoUnitario: 21000, cost_status: 'KNOWN', config: { costeo: P1.config.costeo } });
    expect(p1).not.toHaveProperty('cost_stale');
  });

  it('[1→2] QUITAR un componente del despiece cambia el BOM: STALE por material (fail-closed), el componente borrado no resucita', async () => {
    const id = await sembrar(db(), [P1]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, pieza: { componentes: [p.pieza.componentes[1]] } }));
    const p1 = await partidaDe(db(), id);
    expect(p1.pieza.componentes).toEqual([{ nombre: 'Faldón', insumoId: 'mdf18', piezas: 2 }]);
    expect(p1).not.toHaveProperty('costoUnitario');
    expect(p1.cost_stale).toMatchObject({ motivo: 'RECOSTEO_MATERIAL_CAMBIADO', campos: ['.pieza.componentes[*].insumoId'] });
  });

  // ---- 2. STALE por identidad ----
  for (const rol of [VENDEDOR, DISENO]) {
    it(`[2] ${rol}: cambia piezaId/bom_hash (mismo id) → NO se re-pega nada (ni anidado); UNKNOWN + cost_stale con economia_previa completa`, async () => {
      const id = await sembrar(db(), [P1]);
      await reabrirYGuardar(db(), rol, id, (p) => ({ ...p, piezaId: 'bench-8', bom_hash: 'sha256:bbb', nombre: 'Banca APP LT 8 usuarios' }));
      const p1 = await partidaDe(db(), id);
      expect(p1).not.toHaveProperty('costoUnitario');
      expect(p1).not.toHaveProperty('margen');
      expect(p1).not.toHaveProperty('costoEstado');
      expect(p1.config).toEqual(P1_VISTA_VENDEDOR.config);        // anidado tampoco se hereda
      expect(p1.pieza).toEqual(P1_VISTA_VENDEDOR.pieza);
      expect(p1.cost_status).toBe('UNKNOWN');
      expect(p1.cost_stale).toMatchObject({
        motivo: 'RECOSTEO_PRODUCTO_CAMBIADO',
        campos: ['piezaId', 'bom_hash'],
        previo: { producto_id: '1', producto_version_id: '1933', piezaId: 'bench-6', bom_hash: 'sha256:aaa', cantidad: 1 },
      });
      // Auditoría: la economía que tenía (primer nivel y anidada) queda dentro de cost_stale, no perdida.
      expect(p1.cost_stale.economia_previa).toEqual({
        costoUnitario: 21000, margen: 30, costoDerivado: false, costoEstado: 'completo',
        config: { costeo: { costoUnitario: 21000, materiales: 15000, manoObra: 6000 }, insumos: [{ costo: 950 }, { costo: 120 }] },
        pieza: { componentes: [{ costo: 700 }, { costo: 250 }] },
      });
      expect(p1).toMatchObject({ producto_id: 1, producto_version_id: 1933, piezaId: 'bench-8' });
    });
  }

  // ---- 3. STALE por lote ----
  it('[3] vendedor cambia cantidad de una partida con costo por lote → STALE (RECOSTEO_LOTE_CAMBIADO); la silla (sin lote) conserva su costo aunque también cambie', async () => {
    const id = await sembrar(db(), [P1, P2, P3_LOTE]);
    const vista = await vistaDe(db(), VENDEDOR, id);
    expect(vista.partidas[2]).not.toHaveProperty('costo_por_lote');  // la marca es economía: invisible
    await guardar(db(), VENDEDOR, id, { partidas: vista.partidas.map((p) => ({ ...p, cantidad: p.cantidad + 1 })) });
    const p3 = await partidaDe(db(), id, 'p3');
    expect(p3.cantidad).toBe(3);
    expect(p3).not.toHaveProperty('costoUnitario');
    expect(p3.cost_status).toBe('UNKNOWN');
    expect(p3.cost_stale).toMatchObject({ motivo: 'RECOSTEO_LOTE_CAMBIADO', campos: ['cantidad'], previo: { cantidad: 2 } });
    expect(p3.cost_stale.economia_previa).toMatchObject({ costoUnitario: 6100, costo_por_lote: true, config: { costeo: { costoLote: 12200 } } });
    expect(await partidaDe(db(), id, 'p2')).toMatchObject({ cantidad: 7, costoUnitario: 1400, margen: 35, cost_status: 'KNOWN' });
    expect(await partidaDe(db(), id, 'p1')).toMatchObject({ cantidad: 2, costoUnitario: 21000, cost_status: 'KNOWN' });
  });

  it('[3] misma cantidad en la partida por lote (sólo cambia la nota) → el costo por lote se conserva; basta costoLote anidado sin la marca', async () => {
    const sinMarca = { ...P3_LOTE, costo_por_lote: undefined };
    const id = await sembrar(db(), [sinMarca]);
    const vista = await vistaDe(db(), DISENO, id);
    await guardar(db(), DISENO, id, { partidas: vista.partidas.map((p) => ({ ...p, nota: 'entregar en obra' })) });
    expect(await partidaDe(db(), id, 'p3')).toMatchObject({ costoUnitario: 6100, margen: 40, nota: 'entregar en obra', config: { costeo: { costoLote: 12200 } } });
    await guardar(db(), DISENO, id, { partidas: vista.partidas.map((p) => ({ ...p, cantidad: 5 })) });
    const p3 = await partidaDe(db(), id, 'p3');
    expect(p3.cost_stale?.motivo).toBe('RECOSTEO_LOTE_CAMBIADO');   // costoLote anidado basta como contrato
    expect(p3).not.toHaveProperty('costoUnitario');
  });

  // ---- 2b. STALE por material ----
  for (const [desc, editar, campo] of [
    ['config.finish', (p) => ({ ...p, config: { ...p.config, finish: 'chapa' } }), ['.config.finish']],
    ['config.insumos[0].clave', (p) => ({ ...p, config: { ...p.config, insumos: [{ clave: 'mdf25' }, p.config.insumos[1]] } }), ['.config.insumos[mdf18].clave', '.config.insumos[mdf25].clave']],
    ['pieza.componentes[0].insumoId', (p) => ({ ...p, pieza: { componentes: [{ ...p.pieza.componentes[0], insumoId: 'mdf25' }, p.pieza.componentes[1]] } }), ['.pieza.componentes[*].insumoId']],
  ]) {
    it(`[2] cambia material ${desc} → STALE (RECOSTEO_MATERIAL_CAMBIADO), campos trae la(s) ruta(s), identidad de producto intacta`, async () => {
      const id = await sembrar(db(), [P1]);
      await reabrirYGuardar(db(), VENDEDOR, id, editar);
      const p1 = await partidaDe(db(), id);
      expect(p1).not.toHaveProperty('costoUnitario');
      expect(p1.cost_status).toBe('UNKNOWN');
      expect(p1.cost_stale.motivo).toBe('RECOSTEO_MATERIAL_CAMBIADO');
      expect(p1.cost_stale.campos).toEqual(campo);
      expect(p1.cost_stale.economia_previa.costoUnitario).toBe(21000);
      expect(p1).toMatchObject({ producto_id: 1, producto_version_id: 1933, piezaId: 'bench-6' });
    });
  }

  it('[2] la marca STALE es economía: el vendedor no la ve, no la borra, y sobrevive (con su economia_previa) a guardados posteriores', async () => {
    const id = await sembrar(db(), [P1]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, config: { ...p.config, finish: 'chapa' } }));
    const vista = await vistaDe(db(), VENDEDOR, id);
    expect(JSON.stringify(vista)).not.toMatch(/cost_stale|economia_previa|21000|costo/);
    await guardar(db(), VENDEDOR, id, { partidas: vista.partidas.map((p) => ({ ...p, cantidad: 4 })) });
    const p1 = await partidaDe(db(), id);
    expect(p1.cantidad).toBe(4);
    expect(p1.cost_status).toBe('UNKNOWN');
    expect(p1.cost_stale).toMatchObject({ motivo: 'RECOSTEO_MATERIAL_CAMBIADO', economia_previa: { costoUnitario: 21000 } });
    expect(p1).not.toHaveProperty('costoUnitario');
  });

  // ---- 4. re-pin sin validación del servidor ----
  for (const rol of [VENDEDOR, DISENO]) {
    it(`[4] ${rol}: cambiar producto_version_id (1933→9999) o producto_id (1→2) de una partida existente se RECHAZA y no se escribe nada`, async () => {
      const id = await sembrar(db(), [P1]);
      await expect(reabrirYGuardar(db(), rol, id, (p) => ({ ...p, producto_version_id: 9999 }))).rejects.toThrow(/identidad de producto protegida/);
      await expect(reabrirYGuardar(db(), rol, id, (p) => ({ ...p, producto_id: 2, producto_version_id: 2044, piezaId: 'desk-150' }))).rejects.toThrow(/identidad de producto protegida/);
      await expect(reabrirYGuardar(db(), rol, id, (p) => { const { producto_version_id, ...resto } = p; return resto; })).rejects.toThrow(/identidad de producto protegida/);
      expect(await partidaDe(db(), id)).toMatchObject({ costoUnitario: 21000, producto_id: 1, producto_version_id: 1933, cost_status: 'KNOWN' });
    });
  }

  it('[4] renglón NUEVO con producto_id y una versión que el servidor no validó → la versión la fija el servidor (vigente 2044) y queda cambios_rechazados; producto inexistente → rechazo', async () => {
    const id = await sembrar(db(), [P1]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => p, [
      { id: 'p9', nombre: 'Escritorio 1.50', cantidad: 1, precioUnitario: 48000, producto_id: 2, producto_version_id: 9999 },
      { id: 'p10', nombre: 'Escritorio 1.50 (sin versión)', cantidad: 1, precioUnitario: 48000, producto_id: 2 },
    ]);
    const p9 = await partidaDe(db(), id, 'p9');
    expect(p9).toMatchObject({ producto_id: 2, producto_version_id: 2044, cost_status: 'UNKNOWN' });
    expect(p9.cambios_rechazados).toEqual([{ campo: 'producto_version_id', motivo: 'VERSION_FIJADA_POR_SERVIDOR' }]);
    expect(p9).not.toHaveProperty('costoUnitario');
    const p10 = await partidaDe(db(), id, 'p10');
    expect(p10).toMatchObject({ producto_id: 2, producto_version_id: 2044 });
    expect(p10).not.toHaveProperty('cambios_rechazados');
    // La nota es visible al vendedor (no es economía) para que la UI la muestre.
    expect((await vistaDe(db(), VENDEDOR, id)).partidas.find((p) => p.id === 'p9').cambios_rechazados).toHaveLength(1);
    await expect(reabrirYGuardar(db(), VENDEDOR, id, (p) => p, [{ id: 'p11', nombre: 'Fantasma', cantidad: 1, precioUnitario: 1, producto_id: 77 }]))
      .rejects.toThrow(/producto_id 77 no existe/);
  });

  it('[4] partida existente SIN Producto Maestro que el vendedor LIGA a uno (null→2): se admite, la versión la fija el servidor, y la economía vieja queda STALE (ya no describe ese producto)', async () => {
    const id = await sembrar(db(), [ECON_LEGACY]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, producto_id: 2, producto_version_id: 9999 }));
    const p1 = await partidaDe(db(), id);
    expect(p1).toMatchObject({ producto_id: 2, producto_version_id: 2044, cost_status: 'UNKNOWN' });
    expect(p1).not.toHaveProperty('costoUnitario');
    expect(p1.cambios_rechazados).toEqual([{ campo: 'producto_version_id', motivo: 'VERSION_FIJADA_POR_SERVIDOR' }]);
    expect(p1.cost_stale).toMatchObject({ motivo: 'RECOSTEO_PRODUCTO_CAMBIADO', campos: ['producto_id', 'producto_version_id'], economia_previa: { costoUnitario: 4000, margen: 30 } });
  });

  // ---- 5. estados de autoridad / procedencia ----
  const P1_AUTORIDAD = {
    ...P1, aprobado: true, aprobado_por: DIRECCION, estado_costo: 'certificado', precio_autorizado: 48000,
    lista_precio_item_id: 10, precio_lista_snapshot: 48000, source_type: 'catalogo', source_ref: 'APL-120', price_status: 'AUTHORIZED',
  };
  for (const rol of [VENDEDOR, DISENO]) {
    it(`[5] ${rol}: aprobado/estado_costo/precio_autorizado/lista_precio_item_id/precio_lista_snapshot/source_* sobreviven intactos a su guardado; cada intento queda en cambios_rechazados`, async () => {
      const id = await sembrar(db(), [P1_AUTORIDAD]);
      await reabrirYGuardar(db(), rol, id, (p) => ({
        ...p, cantidad: 2, aprobado: false, aprobado_por: 'yo@vh.mx', estado_costo: 'incompleto', precio_autorizado: 1,
        lista_precio_item_id: 20, precio_lista_snapshot: 10, source_type: 'banco', source_ref: 'otro', price_status: 'SNAPSHOT_DISPLAY', aprobacion: { estado: 'APROBADA' },
      }));
      const p1 = await partidaDe(db(), id);
      expect(p1).toMatchObject({
        cantidad: 2, costoUnitario: 21000, cost_status: 'KNOWN',
        aprobado: true, aprobado_por: DIRECCION, estado_costo: 'certificado', precio_autorizado: 48000,
        lista_precio_item_id: 10, precio_lista_snapshot: 48000, source_type: 'catalogo', source_ref: 'APL-120', price_status: 'AUTHORIZED',
      });
      expect(p1).not.toHaveProperty('aprobacion');
      expect(p1.cambios_rechazados.map((c) => c.campo).sort()).toEqual(
        ['aprobacion', 'aprobado', 'aprobado_por', 'estado_costo', 'lista_precio_item_id', 'precio_autorizado', 'precio_lista_snapshot', 'price_status', 'source_ref', 'source_type'].sort());
      expect(p1.cambios_rechazados.every((c) => Object.keys(c).sort().join() === 'campo,motivo')).toBe(true);   // sin valores: nada se filtra
    });
  }

  it('[5] renglón nuevo: la procedencia que trae el cliente se respeta (no hay verdad previa) pero una autoridad afirmativa (aprobado:true, estado_costo) se quita; precioAutorizado:false se admite', async () => {
    const id = await sembrar(db(), [P1]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => p, [{
      id: 'p9', nombre: 'Bench doble', cantidad: 1, precioUnitario: 28540, precio_lista_snapshot: 28540, source_ref: 'op-10u', price_status: 'SNAPSHOT_DISPLAY',
      precioAutorizado: false, sinPrecioAutorizado: true, aprobado: true, estado_costo: 'completo',
    }]);
    const p9 = await partidaDe(db(), id, 'p9');
    expect(p9).toMatchObject({ precio_lista_snapshot: 28540, source_ref: 'op-10u', price_status: 'SNAPSHOT_DISPLAY', precioAutorizado: false, sinPrecioAutorizado: true, cost_status: 'UNKNOWN' });
    expect(p9).not.toHaveProperty('aprobado');
    expect(p9).not.toHaveProperty('estado_costo');
    expect(p9.cambios_rechazados.map((c) => c.campo).sort()).toEqual(['aprobado', 'estado_costo']);
  });

  it('[5] STALE con autoridad: cost_status pasa a UNKNOWN, costoEstado va a economia_previa, los estados de autoridad (aprobado…) se conservan tal cual (son registro de Dirección)', async () => {
    const id = await sembrar(db(), [P1_AUTORIDAD]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, config: { ...p.config, finish: 'chapa' } }));
    const p1 = await partidaDe(db(), id);
    expect(p1).toMatchObject({ cost_status: 'UNKNOWN', aprobado: true, estado_costo: 'certificado', lista_precio_item_id: 10 });
    expect(p1).not.toHaveProperty('costoEstado');
    expect(p1.cost_stale.economia_previa.costoEstado).toBe('completo');
  });

  // ---- inyección maliciosa ----
  it('vendedor hostil: cuela costoUnitario/margen/cost_status/cost_stale/config.costeo/cambios_rechazados falsos y estado:"emitida" arriba → todo se descarta; la economía de Dirección queda al centavo', async () => {
    const id = await sembrar(db(), [P1, P2]);
    const hostil = {
      ...P1_VISTA_VENDEDOR, costoUnitario: 1, margen: 99, costoDerivado: true, cost_status: 'KNOWN', costoEstado: 'completo',
      cost_stale: { motivo: 'X' }, cambios_rechazados: [{ campo: 'inventado' }], precioUnitario: 10,
      config: { ...P1_VISTA_VENDEDOR.config, costeo: { costoUnitario: 1 }, insumos: [{ clave: 'mdf18', costo: 1 }, { clave: 'canto-abs', costo: 1 }] },
    };
    await expect(guardar(db(), VENDEDOR, id, { estado: 'emitida', partidas: [hostil, P2] })).rejects.toThrow(/estado protegido/);
    await expect(guardar(db(), VENDEDOR, id, { folio_oficial: 'VH-2026-001', partidas: [hostil] })).rejects.toThrow(/folio_oficial protegido/);
    const r = await guardar(db(), VENDEDOR, id, { partidas: [hostil, { ...P2, costoUnitario: 5, cost_status: 'KNOWN' }, { id: 'p3', nombre: 'Archivero', cantidad: 2, precioUnitario: 5000, costoUnitario: 5, cost_status: 'KNOWN' }] });
    expect(r.c.ok).toBe(true);
    const d = await vistaDe(db(), DIRECCION, id);
    expect(d.estado).toBe('borrador');
    const p1 = d.partidas.find((p) => p.id === 'p1');
    expect(p1).toMatchObject({ ...P1, precioUnitario: 10, cost_status: 'KNOWN' });   // precio sí es suyo; economía es la de Dirección
    expect(p1.config).toEqual(P1.config);
    expect(p1).not.toHaveProperty('cost_stale');
    expect(p1).not.toHaveProperty('cambios_rechazados');
    expect(d.partidas.find((p) => p.id === 'p2')).toMatchObject({ costoUnitario: 1400, cost_status: 'KNOWN' });
    const p3 = d.partidas.find((p) => p.id === 'p3');
    expect(p3).not.toHaveProperty('costoUnitario');
    expect(p3.cost_status).toBe('UNKNOWN');
  });

  // ---- Dirección ----
  it('Dirección guarda normalmente: cambia costo, cambia de producto, re-pinea, quita cost_stale; no hay fusión ni cambios_rechazados', async () => {
    const id = await sembrar(db(), [P1]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, config: { ...p.config, finish: 'chapa' } }));
    expect((await partidaDe(db(), id)).cost_status).toBe('UNKNOWN');
    const vista = await vistaDe(db(), DIRECCION, id);
    const recosteada = vista.partidas.map((p) => { const { cost_stale, cost_status, ...resto } = p; return { ...resto, costoUnitario: 23500, margen: 38, producto_id: 2, producto_version_id: 2044, aprobado: true }; });
    await guardar(db(), DIRECCION, id, { partidas: recosteada });
    const p1 = await partidaDe(db(), id);
    expect(p1).toMatchObject({ costoUnitario: 23500, margen: 38, producto_id: 2, producto_version_id: 2044, aprobado: true, cost_status: 'KNOWN', config: { finish: 'chapa' } });
    expect(p1).not.toHaveProperty('cost_stale');
    expect(p1).not.toHaveProperty('cambios_rechazados');
  });

  // ---- compuerta de emisión ----
  it('COMPUERTA: la misma cotización se EMITE antes (ALLOWED, revisión 1) y, tras un cambio de material del vendedor, cotizacion_emitible=false [ECONOMICS_INCOMPLETE] y emitir_revision_v2 RECHAZA; al recostear Dirección vuelve a emitir', async () => {
    const id = await sembrar(db(), [P1]);
    let d = await vistaDe(db(), DIRECCION, id);
    let g = await emitible(db(), DIRECCION, id);
    expect(g).toMatchObject({ ok: true, estado: 'ALLOWED' });
    const r1 = await emitir(db(), DIRECCION, id, snapshotDe(d));
    expect(r1.c).toMatchObject({ revision: 1, nueva: true, gate: 'ALLOWED' });

    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, config: { ...p.config, finish: 'chapa' } }));
    d = await vistaDe(db(), DIRECCION, id);
    expect(d.partidas[0].cost_status).toBe('UNKNOWN');
    for (const quien of [DIRECCION, VENDEDOR]) {
      g = await emitible(db(), quien, id);
      expect(g.ok).toBe(false);
      expect(g.estado).toBe('ECONOMICS_INCOMPLETE');
      expect(g.motivos).toContain('linea_1_recosteo_pendiente_material_cambiado');
    }
    // Sin la compuerta vh035c, esta línea canónica pasaría: la compuerta de producción toma el costo de
    // producto_version_economia (21000 para la versión 1933) y nunca mira cost_status/cost_stale.
    expect((await rpc(db(), DIRECCION, 'select private_api.evaluar_emision_cotizacion($1, $2::jsonb) as g', [id, JSON.stringify(snapshotDe(d))])).g.state).toBe('ALLOWED');
    await expect(emitir(db(), DIRECCION, id, snapshotDe(d))).rejects.toThrow(/emisi[oó]n bloqueada \[ECONOMICS_INCOMPLETE\].*recosteo_pendiente_material_cambiado/);
    await expect(emitir(db(), VENDEDOR, id, snapshotDe(await vistaDe(db(), VENDEDOR, id)))).rejects.toThrow(/ECONOMICS_INCOMPLETE/);
    expect((await rpc(db(), DIRECCION, 'select count(*)::int as n from public.cotizaciones_revisiones where cotizacion_id=$1', [id])).n).toBe(1);

    const recosteada = d.partidas.map((p) => { const { cost_stale, cost_status, ...resto } = p; return { ...resto, costoUnitario: 22000, margen: 30 }; });
    await guardar(db(), DIRECCION, id, { partidas: recosteada });
    d = await vistaDe(db(), DIRECCION, id);
    expect(await emitible(db(), DIRECCION, id)).toMatchObject({ ok: true, estado: 'ALLOWED' });
    expect((await emitir(db(), DIRECCION, id, snapshotDe(d))).c).toMatchObject({ revision: 2, nueva: true });
  });

  it('COMPUERTA: partida legacy (sin Producto Maestro) STALE → ya la bloqueaba producción por costo_desconocido; vh035c añade el motivo de recosteo', async () => {
    const id = await sembrar(db(), [ECON_LEGACY]);
    expect(await emitible(db(), DIRECCION, id)).toMatchObject({ ok: true, estado: 'ALLOWED' });
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, config: { finish: 'laminado' } }));
    const g = await emitible(db(), DIRECCION, id);
    expect(g.ok).toBe(false);
    expect(g.estado).toBe('ECONOMICS_INCOMPLETE');
    expect(g.motivos).toEqual(expect.arrayContaining(['linea_1_recosteo_pendiente_material_cambiado', 'linea_1_costo_desconocido']));
  });

  it('COMPUERTA: STALE por lote también bloquea y un BLOCKED por otra causa conserva su estado y suma el motivo en economics', async () => {
    const id = await sembrar(db(), [P3_LOTE]);
    const vista = await vistaDe(db(), VENDEDOR, id);
    await guardar(db(), VENDEDOR, id, { partidas: vista.partidas.map((p) => ({ ...p, cantidad: 9 })) });
    const g0 = await emitible(db(), DIRECCION, id);
    expect(g0).toMatchObject({ ok: false, estado: 'ECONOMICS_INCOMPLETE' });
    expect(g0.motivos).toContain('linea_1_recosteo_pendiente_lote_cambiado');
    const d = await vistaDe(db(), DIRECCION, id);
    const g = (await rpc(db(), DIRECCION, 'select public.evaluar_emision_cotizacion($1, $2::jsonb) as g', [id, JSON.stringify({ partidas: [] })])).g;
    expect(g.state).toBe('BLOCKED');
    expect(g.economics).toContain('linea_1_recosteo_pendiente_lote_cambiado');
    expect(d.partidas[0].cost_stale.motivo).toBe('RECOSTEO_LOTE_CAMBIADO');
  });

  // ---- lo que ya hacía bien vh035b sigue igual ----
  it('quitar un renglón sí lo quita; la escritura CRUDA del vendedor (sin RPC) sigue strippeada por el trigger', async () => {
    const id = await sembrar(db(), [P1, P2]);
    const vista = await vistaDe(db(), VENDEDOR, id);
    await guardar(db(), VENDEDOR, id, { partidas: vista.partidas.filter((p) => p.id !== 'p2') });
    let d = await vistaDe(db(), DIRECCION, id);
    expect(d.partidas.map((p) => p.id)).toEqual(['p1']);
    expect(d.partidas[0].costoUnitario).toBe(21000);
    await como(db(), VENDEDOR, () => db().query(`update public.cotizaciones set partidas = $2::jsonb where id = $1`,
      [id, JSON.stringify([{ id: 'p9', nombre: 'X', cantidad: 1, precioUnitario: 10, costoUnitario: 999 }])]));
    d = await vistaDe(db(), DIRECCION, id);
    expect(d.partidas[0]).not.toHaveProperty('costoUnitario');
  });
});

// =============================================================================================
//  Referencia: lo que vh035b hace en los casos NUEVOS (documenta por qué hacía falta vh035c).
// =============================================================================================
bloque('PROPUESTA_vh035b_preserva_economia_sin_reciclar.sql', (db) => {
  it('vh035b: cambio de cantidad → primer nivel intacto pero config.costeo / insumos[].costo / componentes[].costo PERDIDOS', async () => {
    const id = await sembrar(db(), [P1]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, cantidad: 3 }));
    const p1 = await partidaDe(db(), id);
    expect(p1).toMatchObject({ costoUnitario: 21000, cost_status: 'KNOWN' });
    expect(p1.config).toEqual(P1_VISTA_VENDEDOR.config);
    expect(p1.pieza).toEqual(P1_VISTA_VENDEDOR.pieza);
  });
  it('vh035b: cambio de MATERIAL → re-pega 21000 como KNOWN (costo del material viejo sobre el nuevo)', async () => {
    const id = await sembrar(db(), [P1]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, config: { ...p.config, finish: 'chapa' } }));
    expect(await partidaDe(db(), id)).toMatchObject({ costoUnitario: 21000, cost_status: 'KNOWN', config: { finish: 'chapa' } });
  });
  it('vh035b: cambio de cantidad con costo por lote → re-pega el costo unitario del lote viejo', async () => {
    const id = await sembrar(db(), [P3_LOTE]);
    const vista = await vistaDe(db(), VENDEDOR, id);
    await guardar(db(), VENDEDOR, id, { partidas: vista.partidas.map((p) => ({ ...p, cantidad: 9 })) });
    expect(await partidaDe(db(), id, 'p3')).toMatchObject({ cantidad: 9, costoUnitario: 6100, cost_status: 'KNOWN' });
  });
  it('vh035b: el vendedor SÍ re-pinea producto_version_id (1933→9999) y SÍ pisa aprobado/estado_costo/lista_precio_item_id', async () => {
    const id = await sembrar(db(), [{ ...P1, aprobado: true, estado_costo: 'certificado', lista_precio_item_id: 10 }]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, producto_version_id: 9999, aprobado: false, estado_costo: 'incompleto', lista_precio_item_id: 20 }));
    expect(await partidaDe(db(), id)).toMatchObject({ producto_version_id: 9999, aprobado: false, estado_costo: 'incompleto', lista_precio_item_id: 20, cost_status: 'UNKNOWN' });
  });
  it('vh035b: una partida canónica STALE (cost_status UNKNOWN + cost_stale) se EMITE igual: la compuerta no mira cost_status', async () => {
    const id = await sembrar(db(), [P1]);
    await reabrirYGuardar(db(), VENDEDOR, id, (p) => ({ ...p, piezaId: 'bench-8', bom_hash: 'sha256:bbb' }));
    const d = await vistaDe(db(), DIRECCION, id);
    expect(d.partidas[0]).toMatchObject({ cost_status: 'UNKNOWN', cost_stale: { motivo: 'RECOSTEO_PRODUCTO_CAMBIADO' } });
    expect(await emitible(db(), DIRECCION, id)).toMatchObject({ ok: true, estado: 'ALLOWED' });
    expect((await emitir(db(), DIRECCION, id, snapshotDe(d))).c).toMatchObject({ revision: 1, gate: 'ALLOWED' });
  });
});
