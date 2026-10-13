// ============================================================================
//  COMPOSICIÓN VH-035c × VH-148 · PRUEBA EN BASE AISLADA (PGlite = PostgreSQL real en WASM).
//
//  Defecto que se cierra: el borrador anterior de VH-148 traía SU PROPIA copia del cuerpo de
//  producción de actualizar_cotizacion_segura (3 argumentos, con DEFAULT) y borraba la de dos. Si
//  VH-035c se aplicaba DESPUÉS, recreaba la de dos argumentos: las llamadas de dos argumentos
//  quedaban ambiguas ("function ... is not unique") y los guardados CON versión seguían pasando por
//  la copia vieja, SIN las protecciones de VH-035c (el vendedor volvía a borrar la economía).
//
//  Diseño nuevo (ver docs/auditoria/VH148_CONTROL_OPTIMISTA.md § Composición):
//    · núcleo económico ÚNICO = private_api.actualizar_cotizacion_segura(bigint, jsonb), de VH-035c
//      (o de producción si VH-035c no está);
//    · la sobrecarga de TRES argumentos de VH-148 valida acceso, BLOQUEA la fila, compara la versión
//      (40001) y DELEGA en el núcleo; ninguna sobrecarga lleva DEFAULT.
//
//  Aquí se carga el esquema real (baseline + cuerpos de producción del 2026-10-13 + compuerta de
//  emisión real + wrappers públicos de producción) y se aplican LAS DOS propuestas en los DOS
//  órdenes. En cada orden se prueba (a) conflicto 40001 sin escritura, (b) guardado con versión =
//  guardado sin versión (economía anidada y autoridad de Dirección intactas), (c) cambio de producto
//  con versión → STALE y emisión bloqueada, (d) llamadas de dos argumentos sin ambigüedad, y (e) el
//  rollback de cada archivo deja al otro funcionando. Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const VH035C = 'supabase/migrations/PROPUESTA_vh035c_preserva_economia_integral.sql';
const VH148 = 'supabase/migrations/PROPUESTA_vh148_control_optimista_cotizacion.sql';

function defDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre} en el baseline`);
  return sql.slice(ini, sql.indexOf('\n;\n', ini)) + ';';
}
function defDePrivateApi(nombre) {
  const sql = leer('supabase/schema/baseline/08_private_api.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION private_api.${nombre}(`);
  if (ini < 0) throw new Error(`no está private_api.${nombre} en el baseline`);
  const fin = sql.indexOf('$function$;', ini);
  return sql.slice(ini, fin + '$function$;'.length);
}
// Bloque de rollback de cada propuesta: vive en un comentario /* */ al final, entre marcadores.
function sqlRollback(archivo, etiqueta) {
  const sql = leer(archivo);
  const ini = sql.indexOf(`-- >>> ROLLBACK ${etiqueta} INICIO`);
  const fin = sql.indexOf(`-- <<< ROLLBACK ${etiqueta} FIN`);
  if (ini < 0 || fin < 0) throw new Error(`${archivo} no trae el bloque de rollback ${etiqueta}`);
  return sql.slice(ini, fin);
}

const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx', DISENO = 'diseno@vh.mx';

// Mismo esquema que preservaEconomiaIntegral.test.js, pero con los wrappers públicos REALES de
// producción (cotizacion_segura / actualizar_cotizacion_segura de baseline/03), como en controlOptimista.
async function baseCompuesta() {
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
    create function public.resolver_precio_especial_proyecto(p_producto_id bigint, p_version_id bigint, p_fecha date default current_date, p_moneda text default 'MXN')
      returns jsonb language sql stable as $$ select jsonb_build_object('ok', false, 'motivo', 'no_especial') $$;
    create function public.resolver_precio_autorizado(p_producto_id bigint, p_version_id bigint default null, p_variante_id bigint default null, p_fecha date default current_date, p_moneda text default null)
      returns jsonb language sql stable as $$
        select coalesce((select jsonb_build_object('ok', true, 'precio_lista', i.precio_lista, 'lista_precio_item_id', i.id)
                         from public.lista_precio_items i where i.producto_id = p_producto_id and i.producto_version_id = p_version_id limit 1),
                        jsonb_build_object('ok', false, 'motivo', 'sin_lista')) $$;
  `);
  for (const f of ['jsonb_sin_economia', 'normalizar_cost_status_partidas', 'pin_product_versions_in_partidas', 'normalize_economics_on_cotizacion_write',
    'pin_product_versions_on_cotizacion_write', 'strip_seller_economics_on_cotizacion_write', 'reglas_comerciales_vigentes']) {
    await x(defDeBaseline(f));
  }
  for (const f of ['hash_revision', 'requiere_aprobacion_snapshot', 'verificar_aprobacion', 'evaluar_emision_cotizacion', 'cotizacion_emitible', 'emitir_revision_v2']) {
    await x(defDePrivateApi(f));
    await x(defDeBaseline(f));
  }
  await x(leer('supabase/tests/fixtures/private_api_prod_20261013.sql'));
  await x(defDeBaseline('cotizacion_segura'));
  await x(defDeBaseline('actualizar_cotizacion_segura'));
  await x(`
    create trigger trg_guard_cotizacion_estado_directo before insert or update on public.cotizaciones for each row execute function private_api.guard_cotizacion_estado_directo();
    create trigger trg_normalize_economics_status before insert or update on public.cotizaciones for each row execute function public.normalize_economics_on_cotizacion_write();
    create trigger trg_pin_product_versions before insert or update on public.cotizaciones for each row execute function public.pin_product_versions_on_cotizacion_write();
    create trigger trg_strip_seller_economics before insert or update on public.cotizaciones for each row execute function public.strip_seller_economics_on_cotizacion_write();
  `);
  return db;
}

const como = async (db, email, fn) => {
  await db.exec(`select set_config('test.email', '${email}', false), set_config('request.jwt.claims', '${email ? JSON.stringify({ email }) : ''}', false)`);
  try { return await fn(); } finally { await db.exec(`select set_config('test.email', '', false), set_config('request.jwt.claims', '', false)`); }
};
const rpc = async (db, email, sql, params) => como(db, email, async () => (await db.query(sql, params)).rows[0]);
const vistaDe = async (db, email, id) => (await rpc(db, email, 'select public.cotizacion_segura($1) as c', [id])).c;
const guardar2 = (db, email, id, patch) => rpc(db, email, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify(patch)]);
const guardar3 = (db, email, id, patch, esperado) => rpc(db, email, 'select public.actualizar_cotizacion_segura($1, $2::jsonb, $3::timestamptz) as c', [id, JSON.stringify(patch), esperado]);
const partidaDe = async (db, id, pid = 'p1') => (await vistaDe(db, DIRECCION, id)).partidas.find((p) => p.id === pid);
const emitible = async (db, email, id) => (await rpc(db, email, 'select public.cotizacion_emitible($1) as c', [id])).c;
const emitir = (db, email, id, snap) => rpc(db, email, 'select public.emitir_revision_v2($1, $2::jsonb) as c', [id, JSON.stringify(snap)]);
// La fila CRUDA como texto (todas las columnas, incluido `actualizado` con microsegundos): "byte a byte".
const filaTexto = async (db, id) => (await db.query('select c::text as t from public.cotizaciones c where id=$1', [id])).rows[0].t;
const md5Def = async (db, firma) => (await db.query(`select md5(pg_get_functiondef($1::regprocedure)) as m`, [firma])).rows[0].m;
const sobrecargas = async (db) => (await db.query(`
  select s.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')' as firma, p.pronargdefaults as defaults
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where p.proname = 'actualizar_cotizacion_segura' order by 1`)).rows;
const fuente = async (db, firma) => (await db.query(`select prosrc from pg_proc where oid = $1::regprocedure`, [firma])).rows[0].prosrc;
function snapshotDe(vista) {
  const precioLista = vista.partidas.reduce((s, p) => s + Math.round(p.precioUnitario * p.cantidad * 100) / 100, 0);
  return { partidas: vista.partidas, totales: { precioLista, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva: 0 }, total: precioLista };
}
async function esperarConflicto(promesa) {
  let err = null;
  try { await promesa; } catch (e) { err = e; }
  expect(err, 'debió lanzar').toBeTruthy();
  expect(err.code).toBe('40001');
  expect(err.message).toMatch(/CONFLICTO_VERSION/);
  return err;
}

// Partida de Dirección: economía de primer nivel + ANIDADA + identidad + material + AUTORIDAD.
const P1 = {
  id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000,
  costoUnitario: 21000, margen: 30, costoDerivado: false, costoEstado: 'completo',
  producto_id: 1, producto_version_id: 1933, piezaId: 'bench-6', bom_hash: 'sha256:aaa',
  aprobado: true, aprobado_por: DIRECCION, estado_costo: 'certificado', precio_autorizado: 48000,
  lista_precio_item_id: 10, precio_lista_snapshot: 48000, source_type: 'catalogo', source_ref: 'APL-120', price_status: 'AUTHORIZED',
  config: {
    color: 'nogal', finish: 'melamina',
    costeo: { costoUnitario: 21000, materiales: 15000, manoObra: 6000 },
    insumos: [{ clave: 'mdf18', costo: 950 }, { clave: 'canto-abs', costo: 120 }],
  },
  pieza: { componentes: [{ nombre: 'Tapa', insumoId: 'mdf18', piezas: 1, costo: 700 }, { nombre: 'Faldón', insumoId: 'mdf18', piezas: 2, costo: 250 }] },
};
const P2 = { id: 'p2', nombre: 'Silla operativa', cantidad: 6, precioUnitario: 3200, costoUnitario: 1400, margen: 35 };
const ECONOMIA_P1 = {
  costoUnitario: 21000, margen: 30, costoDerivado: false, costoEstado: 'completo', cost_status: 'KNOWN',
  aprobado: true, aprobado_por: DIRECCION, estado_costo: 'certificado', precio_autorizado: 48000,
  lista_precio_item_id: 10, precio_lista_snapshot: 48000, source_type: 'catalogo', source_ref: 'APL-120', price_status: 'AUTHORIZED',
  config: { costeo: { costoUnitario: 21000, materiales: 15000, manoObra: 6000 }, insumos: [{ clave: 'mdf18', costo: 950 }, { clave: 'canto-abs', costo: 120 }] },
  pieza: { componentes: [{ costo: 700 }, { costo: 250 }] },
};

async function sembrar(db, partidas = [P1, P2]) {
  const t = partidas.reduce((s, p) => s + p.precioUnitario * p.cantidad, 0);
  const n = partidas.reduce((s, p) => s + p.cantidad, 0);
  const { id } = await rpc(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, partidas, total, piezas) values ($1, 'Tradeco', $2::jsonb, $3, $4) returning id`,
    [VENDEDOR, JSON.stringify(partidas), t, n]);
  return id;
}
// Edición típica del vendedor sobre su vista despojada: cantidad, nota, y un intento de pisar la autoridad.
const editarVendedor = (vista) => vista.partidas.map((p) => (p.id === 'p1'
  ? { ...p, cantidad: 3, nota: 'entregar en obra', aprobado: false, estado_costo: 'incompleto', lista_precio_item_id: 20 }
  : { ...p, cantidad: p.cantidad + 1 }));

// ---------------------------------------------------------------------------------------------
//  Huellas de referencia (base de producción sola y VH-035c sola) para comparar los rollbacks.
// ---------------------------------------------------------------------------------------------
const REF = {};
beforeAll(async () => {
  const prod = await baseCompuesta();
  REF.nucleoProd = await md5Def(prod, 'private_api.actualizar_cotizacion_segura(bigint, jsonb)');
  REF.seguraProd = await md5Def(prod, 'private_api.cotizacion_segura(bigint)');
  REF.stripProd = await md5Def(prod, 'public.strip_seller_economics_on_cotizacion_write()');
  REF.gateProd = await md5Def(prod, 'public.evaluar_emision_cotizacion(bigint, jsonb)');
  await prod.exec(leer(VH035C));
  REF.nucleo035c = await md5Def(prod, 'private_api.actualizar_cotizacion_segura(bigint, jsonb)');
  REF.gate035c = await md5Def(prod, 'public.evaluar_emision_cotizacion(bigint, jsonb)');
  await prod.close();
}, 120_000);

const ORDENES = [
  ['vh035c → vh148', [VH035C, VH148]],
  ['vh148 → vh035c', [VH148, VH035C]],
];

for (const [orden, archivos] of ORDENES) {
  describe(`COMPOSICIÓN ${orden}`, () => {
    let db;
    beforeAll(async () => {
      db = await baseCompuesta();
      for (const a of archivos) await db.exec(leer(a));
    }, 120_000);
    afterAll(async () => { await db?.close(); });

    it('estructura: un núcleo de dos argumentos (el de VH-035c), una sobrecarga de tres que NO copia el cuerpo, ninguna con DEFAULT', async () => {
      expect(await sobrecargas(db)).toEqual([
        { firma: 'private_api.actualizar_cotizacion_segura(bigint, jsonb)', defaults: 0 },
        { firma: 'private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamp with time zone)', defaults: 0 },
        { firma: 'public.actualizar_cotizacion_segura(bigint, jsonb)', defaults: 0 },
        { firma: 'public.actualizar_cotizacion_segura(bigint, jsonb, timestamp with time zone)', defaults: 0 },
      ]);
      expect(await md5Def(db, 'private_api.actualizar_cotizacion_segura(bigint, jsonb)')).toBe(REF.nucleo035c);
      const tres = await fuente(db, 'private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)');
      expect(tres).not.toMatch(/update\s+public\.cotizaciones/i);                       // sin copia del cuerpo de guardado
      expect(tres).toMatch(/for update/i);                                               // bloquea la fila
      expect(tres).toMatch(/return private_api\.actualizar_cotizacion_segura\(p_cotizacion_id, p_patch\);/);   // delega en el núcleo
      expect(await fuente(db, 'private_api.actualizar_cotizacion_segura(bigint, jsonb)')).toMatch(/fusionar_economia_partidas/);
    });

    it('(a) vendedor guarda por la ruta de TRES argumentos con versión vieja → 40001 (DETAIL con la versión del servidor) y la fila queda byte a byte igual', async () => {
      const id = await sembrar(db);
      const vieja = await vistaDe(db, VENDEDOR, id);
      const r1 = await guardar3(db, VENDEDOR, id, { cliente: 'Tradeco Norte' }, vieja.actualizado);   // otra pestaña avanza la fila
      expect(r1.c.ok).toBe(true);
      const antes = await filaTexto(db, id);
      const err = await esperarConflicto(guardar3(db, VENDEDOR, id, { cliente: 'Tradeco Sur', partidas: editarVendedor(vieja), total: 1 }, vieja.actualizado));
      expect(err.detail).toBe(`actualizado=${r1.c.actualizado}`);
      expect(await filaTexto(db, id)).toBe(antes);
      // Un vendedor ajeno recibe 'sin acceso' (no la versión), como antes del rediseño.
      await db.exec(`insert into public.permitidos(email, rol) values ('ventas2@vh.mx','vendedor') on conflict do nothing`);
      await expect(guardar3(db, 'ventas2@vh.mx', id, { cliente: 'X' }, '2000-01-01T00:00:00+00:00')).rejects.toThrow(/sin acceso/);
      expect(await filaTexto(db, id)).toBe(antes);
    });

    it('(b) vendedor guarda por TRES argumentos con la versión correcta → misma fusión que por DOS: economía anidada y autoridad de Dirección intactas', async () => {
      const idDos = await sembrar(db), idTres = await sembrar(db);
      const vDos = await vistaDe(db, VENDEDOR, idDos), vTres = await vistaDe(db, VENDEDOR, idTres);
      expect(vTres.partidas[0]).not.toHaveProperty('costoUnitario');
      await guardar2(db, VENDEDOR, idDos, { partidas: editarVendedor(vDos) });
      const r = await guardar3(db, VENDEDOR, idTres, { partidas: editarVendedor(vTres) }, vTres.actualizado);
      expect(r.c.ok).toBe(true);
      expect(r.c.actualizado).not.toBe(vTres.actualizado);
      const dDos = await vistaDe(db, DIRECCION, idDos), dTres = await vistaDe(db, DIRECCION, idTres);
      expect(dTres.partidas).toEqual(dDos.partidas);                                    // ruta de 3 = ruta de 2
      const p1 = dTres.partidas[0];
      expect(p1).toMatchObject({ ...ECONOMIA_P1, cantidad: 3, nota: 'entregar en obra' });
      expect(p1).not.toHaveProperty('cost_stale');
      expect(p1.cambios_rechazados.map((c) => c.campo).sort()).toEqual(['aprobado', 'estado_costo', 'lista_precio_item_id']);
      expect(dTres.partidas[1]).toMatchObject({ cantidad: 7, costoUnitario: 1400, margen: 35, cost_status: 'KNOWN' });
      // Cuela economía por la ruta de 3: se descarta igual que por la de 2.
      const v2 = await vistaDe(db, VENDEDOR, idTres);
      await guardar3(db, VENDEDOR, idTres, { partidas: v2.partidas.map((p) => ({ ...p, costoUnitario: 1, margen: 99, config: p.config && { ...p.config, costeo: { costoUnitario: 1 } } })) }, v2.actualizado);
      expect(await partidaDe(db, idTres)).toMatchObject({ costoUnitario: 21000, margen: 30, config: { costeo: { costoUnitario: 21000 } } });
    });

    it('(c) cambio de producto por TRES argumentos → STALE (RECOSTEO_PRODUCTO_CAMBIADO), emisión bloqueada; re-pin de versión → 42501 sin escritura', async () => {
      const id = await sembrar(db, [P1]);
      let d = await vistaDe(db, DIRECCION, id);
      expect(await emitible(db, DIRECCION, id)).toMatchObject({ ok: true, estado: 'ALLOWED' });
      // Re-pin de producto_version_id con versión correcta: lo rechaza el núcleo VH-035c y nada se escribe.
      let v = await vistaDe(db, VENDEDOR, id);
      const antes = await filaTexto(db, id);
      let err = null;
      try { await guardar3(db, VENDEDOR, id, { partidas: v.partidas.map((p) => ({ ...p, producto_version_id: 9999 })) }, v.actualizado); } catch (e) { err = e; }
      expect(err?.code).toBe('42501');
      expect(err?.message).toMatch(/identidad de producto protegida/);
      expect(await filaTexto(db, id)).toBe(antes);
      // Cambio de pieza/BOM (otro mueble en el mismo renglón): STALE.
      v = await vistaDe(db, VENDEDOR, id);
      const r = await guardar3(db, VENDEDOR, id, { partidas: v.partidas.map((p) => ({ ...p, piezaId: 'bench-8', bom_hash: 'sha256:bbb', nombre: 'Banca APP LT 8 usuarios' })) }, v.actualizado);
      expect(r.c.ok).toBe(true);
      const p1 = await partidaDe(db, id);
      expect(p1).not.toHaveProperty('costoUnitario');
      expect(p1.cost_status).toBe('UNKNOWN');
      expect(p1.cost_stale).toMatchObject({ motivo: 'RECOSTEO_PRODUCTO_CAMBIADO', campos: ['piezaId', 'bom_hash'] });
      expect(p1.cost_stale.economia_previa).toMatchObject({ costoUnitario: 21000, config: { costeo: { costoUnitario: 21000 } } });
      expect(p1).toMatchObject({ aprobado: true, estado_costo: 'certificado', lista_precio_item_id: 10 });   // autoridad intacta
      for (const quien of [DIRECCION, VENDEDOR]) {
        const g = await emitible(db, quien, id);
        expect(g).toMatchObject({ ok: false, estado: 'ECONOMICS_INCOMPLETE' });
        expect(g.motivos).toContain('linea_1_recosteo_pendiente_producto_cambiado');
      }
      d = await vistaDe(db, DIRECCION, id);
      await expect(emitir(db, DIRECCION, id, snapshotDe(d))).rejects.toThrow(/ECONOMICS_INCOMPLETE.*recosteo_pendiente_producto_cambiado/);
      expect((await db.query('select count(*)::int as n from public.cotizaciones_revisiones where cotizacion_id=$1', [id])).rows[0].n).toBe(0);
      // Dirección recostea (por la ruta de 3, con su versión) y vuelve a poder emitir.
      const recosteada = d.partidas.map((p) => { const { cost_stale, cost_status, ...resto } = p; return { ...resto, costoUnitario: 22000, margen: 30 }; });
      await guardar3(db, DIRECCION, id, { partidas: recosteada }, d.actualizado);
      expect(await emitible(db, DIRECCION, id)).toMatchObject({ ok: true, estado: 'ALLOWED' });
    });

    it('(b2) regresión encontrada al componer: el vendedor AGREGA un renglón de línea (productoId textual, producto_id null) por TRES argumentos → se acepta; un producto_id basura sigue rechazado', async () => {
      const id = await sembrar(db);
      const v = await vistaDe(db, VENDEDOR, id);
      // Forma que emite src/datos/partida.js#crearPartida para un mueble de línea del catálogo.
      const linea = { id: 'p9', nombre: 'Banca doble 6 usuarios', ruta: 'applt', productoId: 'banca_doble', claveLinea: 'banca_doble', producto_id: null, producto_version_id: null, cantidad: 1, precioUnitario: 28540, config: { largoMM: 1200, biombo: 'pet' } };
      const r = await guardar3(db, VENDEDOR, id, { partidas: [...v.partidas, linea] }, v.actualizado);
      expect(r.c.ok).toBe(true);
      const p9 = await partidaDe(db, id, 'p9');
      expect(p9).toMatchObject({ productoId: 'banca_doble', producto_id: null, cost_status: 'UNKNOWN' });
      expect(p9).not.toHaveProperty('cambios_rechazados');
      expect(await partidaDe(db, id)).toMatchObject({ costoUnitario: 21000 });
      const v2 = await vistaDe(db, VENDEDOR, id);
      await expect(guardar3(db, VENDEDOR, id, { partidas: [...v2.partidas, { id: 'p10', nombre: 'X', cantidad: 1, precioUnitario: 1, producto_id: 'abc' }] }, v2.actualizado))
        .rejects.toThrow(/producto_id invalido \(partida p10\): abc/);
    });

    it('(d) las llamadas de DOS argumentos siguen funcionando y no son ambiguas (posicional, con nombre, pública y privada)', async () => {
      const id = await sembrar(db);
      const v = await vistaDe(db, VENDEDOR, id);
      const r = await guardar2(db, VENDEDOR, id, { partidas: editarVendedor(v) });
      expect(r.c.ok).toBe(true);
      expect(await partidaDe(db, id)).toMatchObject({ ...ECONOMIA_P1, cantidad: 3 });
      // Con nombre (así llama PostgREST): sin p_actualizado_esperado → dos argumentos; con él → tres.
      const n2 = await rpc(db, VENDEDOR, 'select public.actualizar_cotizacion_segura(p_cotizacion_id => $1, p_patch => $2::jsonb) as c', [id, JSON.stringify({ cliente: 'Con nombre' })]);
      expect(n2.c.cliente).toBe('Con nombre');
      const n3 = await rpc(db, VENDEDOR, 'select public.actualizar_cotizacion_segura(p_cotizacion_id => $1, p_patch => $2::jsonb, p_actualizado_esperado => $3::timestamptz) as c', [id, JSON.stringify({ cliente: 'Con nombre 3' }), n2.c.actualizado]);
      expect(n3.c.cliente).toBe('Con nombre 3');
      // Privada directa (lo que llaman los wrappers) y NULL explícito = sin control.
      const p2 = await rpc(db, VENDEDOR, 'select private_api.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify({ cliente: 'Privada' })]);
      expect(p2.c.cliente).toBe('Privada');
      const nulo = await guardar3(db, VENDEDOR, id, { cliente: 'Sin control' }, null);
      expect(nulo.c.cliente).toBe('Sin control');
      expect(await partidaDe(db, id)).toMatchObject({ costoUnitario: 21000, config: { costeo: { costoUnitario: 21000 } } });
      // Diseño (sin economía, edita config) por la ruta de 2: también fusiona.
      const vd = await vistaDe(db, DISENO, id);
      await guardar2(db, DISENO, id, { partidas: vd.partidas.map((p) => ({ ...p, nota: 'diseño' })) });
      expect(await partidaDe(db, id)).toMatchObject({ costoUnitario: 21000, nota: 'diseño' });
    });
  });

  // -------------------------------------------------------------------------------------------
  //  (e) ROLLBACK de cada archivo con el otro aplicado (aplicados en este orden).
  // -------------------------------------------------------------------------------------------
  describe(`ROLLBACK tras ${orden}: revertir VH-148 deja VH-035c funcionando`, () => {
    let db;
    beforeAll(async () => {
      db = await baseCompuesta();
      for (const a of archivos) await db.exec(leer(a));
      await db.exec(sqlRollback(VH148, 'VH-148'));
    }, 120_000);
    afterAll(async () => { await db?.close(); });

    it('desaparecen las sobrecargas de tres argumentos; cotizacion_segura vuelve a producción; el núcleo sigue siendo VH-035c y protege la economía', async () => {
      expect((await sobrecargas(db)).map((s) => s.firma)).toEqual([
        'private_api.actualizar_cotizacion_segura(bigint, jsonb)', 'public.actualizar_cotizacion_segura(bigint, jsonb)']);
      expect(await md5Def(db, 'private_api.cotizacion_segura(bigint)')).toBe(REF.seguraProd);
      expect(await md5Def(db, 'private_api.actualizar_cotizacion_segura(bigint, jsonb)')).toBe(REF.nucleo035c);
      expect(await md5Def(db, 'public.evaluar_emision_cotizacion(bigint, jsonb)')).toBe(REF.gate035c);
      const id = await sembrar(db);
      const v = await vistaDe(db, VENDEDOR, id);
      expect(v).not.toHaveProperty('actualizado');
      await expect(guardar3(db, VENDEDOR, id, { cliente: 'X' }, new Date().toISOString())).rejects.toThrow(/does not exist/);
      await guardar2(db, VENDEDOR, id, { partidas: editarVendedor(v) });
      expect(await partidaDe(db, id)).toMatchObject({ ...ECONOMIA_P1, cantidad: 3 });
      // STALE + compuerta siguen.
      const v2 = await vistaDe(db, VENDEDOR, id);
      await guardar2(db, VENDEDOR, id, { partidas: v2.partidas.map((p) => (p.id === 'p1' ? { ...p, piezaId: 'bench-8' } : p)) });
      expect((await emitible(db, DIRECCION, id)).motivos).toContain('linea_1_recosteo_pendiente_producto_cambiado');
    });
  });

  describe(`ROLLBACK tras ${orden}: revertir VH-035c deja VH-148 funcionando (sobre el núcleo de producción)`, () => {
    let db;
    beforeAll(async () => {
      db = await baseCompuesta();
      for (const a of archivos) await db.exec(leer(a));
      await db.exec(sqlRollback(VH035C, 'VH-035c'));
    }, 120_000);
    afterAll(async () => { await db?.close(); });

    it('el núcleo, el trigger de strip y la compuerta vuelven a producción byte a byte; las auxiliares de VH-035c desaparecen', async () => {
      expect(await md5Def(db, 'private_api.actualizar_cotizacion_segura(bigint, jsonb)')).toBe(REF.nucleoProd);
      expect(await md5Def(db, 'public.strip_seller_economics_on_cotizacion_write()')).toBe(REF.stripProd);
      expect(await md5Def(db, 'public.evaluar_emision_cotizacion(bigint, jsonb)')).toBe(REF.gateProd);
      const { n } = (await db.query(`select count(*)::int as n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
        where s.nspname='private_api' and p.proname in ('fusionar_economia_partidas','repegar_economia','motivos_recosteo_pendiente','es_clave_economia','huella_material_filas')`)).rows[0];
      expect(n).toBe(0);
      expect((await sobrecargas(db)).every((s) => s.defaults === 0)).toBe(true);
      expect(await sobrecargas(db)).toHaveLength(4);
    });

    it('el control de versión sigue: 40001 sin escritura con versión vieja; con la correcta guarda (con la semántica de producción, VH-035 incluida)', async () => {
      const id = await sembrar(db);
      const v = await vistaDe(db, VENDEDOR, id);
      expect(typeof v.actualizado).toBe('string');
      const r = await guardar3(db, VENDEDOR, id, { cliente: 'Tradeco Norte' }, v.actualizado);
      expect(r.c.ok).toBe(true);
      const antes = await filaTexto(db, id);
      await esperarConflicto(guardar3(db, VENDEDOR, id, { cliente: 'Tradeco Sur' }, v.actualizado));
      expect(await filaTexto(db, id)).toBe(antes);
      const v2 = await vistaDe(db, VENDEDOR, id);
      await guardar3(db, VENDEDOR, id, { partidas: v2.partidas }, v2.actualizado);
      // Producción sin VH-035c: el guardado del vendedor vuelve a perder la economía (VH-035). Es la base revertida, no un PASS.
      expect(await partidaDe(db, id)).not.toHaveProperty('costoUnitario');
      // Dos argumentos también, sin ambigüedad.
      const r2 = await guardar2(db, VENDEDOR, id, { cliente: 'Dos' });
      expect(r2.c.cliente).toBe('Dos');
    });
  });
}

describe('ROLLBACK de los DOS (en cualquier orden) → producción byte a byte', () => {
  for (const [nombre, rollbacks] of [
    ['VH-148 primero', [[VH148, 'VH-148'], [VH035C, 'VH-035c']]],
    ['VH-035c primero', [[VH035C, 'VH-035c'], [VH148, 'VH-148']]],
  ]) {
    it(`${nombre}: núcleo, cotizacion_segura, strip y compuerta = producción; sólo quedan las firmas de dos argumentos`, async () => {
      const db = await baseCompuesta();
      try {
        await db.exec(leer(VH035C)); await db.exec(leer(VH148));
        for (const [a, e] of rollbacks) await db.exec(sqlRollback(a, e));
        expect(await md5Def(db, 'private_api.actualizar_cotizacion_segura(bigint, jsonb)')).toBe(REF.nucleoProd);
        expect(await md5Def(db, 'private_api.cotizacion_segura(bigint)')).toBe(REF.seguraProd);
        expect(await md5Def(db, 'public.strip_seller_economics_on_cotizacion_write()')).toBe(REF.stripProd);
        expect(await md5Def(db, 'public.evaluar_emision_cotizacion(bigint, jsonb)')).toBe(REF.gateProd);
        expect((await sobrecargas(db)).map((s) => s.firma)).toEqual([
          'private_api.actualizar_cotizacion_segura(bigint, jsonb)', 'public.actualizar_cotizacion_segura(bigint, jsonb)']);
        const id = await sembrar(db);
        expect((await guardar2(db, VENDEDOR, id, { cliente: 'ok' })).c.cliente).toBe('ok');
      } finally { await db.close(); }
    }, 120_000);
  }
});

describe('Defensa: el borrador VIEJO de VH-148 (3 args con DEFAULT + copia del cuerpo) no se compone en silencio', () => {
  it('si quedó instalado, aplicar VH-035c aborta (postcondición sin DEFAULT) y el VH-148 nuevo también (precondición: falta el núcleo de dos argumentos): nada queda a medias', async () => {
    const db = await baseCompuesta();
    try {
      // Simula el borrador anterior: sobrecarga privada de 3 args CON default que NO pasa por el núcleo.
      await db.exec(`
        drop function private_api.actualizar_cotizacion_segura(bigint, jsonb);
        create function private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb, p_actualizado_esperado timestamptz default null)
          returns jsonb language plpgsql security definer set search_path to 'public' as $$ begin return '{"copia":"vieja"}'::jsonb; end $$;`);
      await expect(db.exec(leer(VH035C))).rejects.toThrow(/sobrecargas con DEFAULT/);
      // El VH-148 nuevo exige el núcleo de dos argumentos: sin él, aborta en vez de instalar algo a medias.
      await expect(db.exec(leer(VH148))).rejects.toThrow(/falta private_api\.actualizar_cotizacion_segura\(bigint, jsonb\)/);
    } finally { await db.close(); }
  }, 120_000);
});
