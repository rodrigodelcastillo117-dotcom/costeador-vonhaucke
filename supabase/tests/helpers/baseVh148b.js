// ============================================================================
//  Base PGlite de PRODUCCIÓN (14-oct-2026) para VH-148b y ayudas de sesión. NO es una prueba: la usan
//  supabase/tests/vh148FailClosed.test.js (SQL) y supabase/tests/vh148FailClosedCliente.test.js (cliente).
//  Ver el encabezado de vh148FailClosed.test.js para qué se carga y de dónde.
// ============================================================================
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

export const RAIZ = new URL('../../../', import.meta.url);   // raíz del repo (este archivo vive en supabase/tests/helpers/)
export const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
export const M = 'supabase/migrations/';
export const VH035C = M + 'PROPUESTA_vh035c_preserva_economia_integral.sql';
export const VH148 = M + 'PROPUESTA_vh148_control_optimista_cotizacion.sql';
export const VH148B = M + 'PROPUESTA_vh148b_fail_closed_versiones.sql';
export const VH148C = M + 'PROPUESTA_vh148c_retira_escrituras_sin_version.sql';
export const SEG01 = M + 'PROPUESTA_seg01_emision_snapshot_fiel.sql';
export const SEG01C = M + 'PROPUESTA_seg01c_vinculo_costeo_partida.sql';

// --- extracción de SQL de producción (baseline) -------------------------------------------------
export function defDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre} en el baseline`);
  return sql.slice(ini, sql.indexOf('\n;\n', ini)) + ';';
}
export function defDePrivateApi(nombre) {
  const sql = leer('supabase/schema/baseline/08_private_api.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION private_api.${nombre}(`);
  if (ini < 0) throw new Error(`no está private_api.${nombre} en el baseline`);
  const fin = sql.indexOf('$function$;', ini);
  return sql.slice(ini, fin + '$function$;'.length);
}
export function tablaDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/01_tablas.sql');
  const ini = sql.indexOf(`CREATE TABLE public.${nombre} (`);
  if (ini < 0) throw new Error(`no está la tabla ${nombre} en el baseline`);
  return sql.slice(ini, sql.indexOf('\n);\n', ini) + 3) + ';';
}
export function politicaDeBaseline(tabla, nombre) {
  const sql = leer('supabase/schema/baseline/02_rls_policies.sql');
  const ini = sql.indexOf(`CREATE POLICY ${nombre} ON public.${tabla}\n`);
  if (ini < 0) throw new Error(`no está la política ${tabla}.${nombre} en el baseline`);
  return sql.slice(ini, sql.indexOf('\n\n', ini));
}
export function lineasDeBaseline(archivo, filtro) {
  return leer('supabase/schema/baseline/' + archivo).split('\n').filter(filtro).join('\n');
}
// Rollback de las propuestas nuevas: líneas `-- RB ` al final del archivo.
export const rollbackDe = (archivo) => leer(archivo).split('\n').filter((l) => l.startsWith('-- RB ')).map((l) => l.slice(6)).join('\n');

// md5(pg_get_functiondef) leídos de producción (mtuvnbgljwbsaizjjgzs) el 2026-10-13 (mismos que
// seguridadGateEmisionSnapshot.test.js) y el wrapper de emisión de VH-035c vigente.
export const MD5_PROD = {
  'private_api.evaluar_emision_cotizacion(bigint, jsonb)': '17ec67cf8bf06b540a55279288e90025',  // gate vivo P0-01 (2026-10-17); 13-oct era 9c660b09…
  'private_api.emitir_revision_v2(bigint, jsonb)': 'fb26c9d515ac6116ae87ed44350c3615',
  'private_api.asignar_folio_oficial(bigint)': '33acd273d08c8c45f07b04954d86729e',
  'public.evaluar_emision_cotizacion(bigint, jsonb)': 'cf6ef6a30bbb68eb2b867f2bcdb7c846',
};

export const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx', DISENO = 'diseno@vh.mx';

export async function baseProduccion({ conVh035c = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema private_api; create schema extensions;
    create extension if not exists pgcrypto with schema extensions;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    grant usage on schema auth, private_api, extensions, public to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $$
      select case when coalesce(current_setting('test.email', true), '') = '' then null
        else md5(current_setting('test.email', true))::uuid end $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true), '') = '' then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, nombre text, rol text not null default 'vendedor', creado timestamptz not null default now());
    grant select on public.permitidos to authenticated;
    create table public.cotizaciones (
      id bigserial primary key, creado timestamptz not null default now(), actualizado timestamptz not null default now(),
      usuario text, cliente text, folio text, estado text not null default 'borrador',
      partidas jsonb not null default '[]'::jsonb, acomodo jsonb, totales jsonb, total numeric not null default 0,
      piezas integer not null default 0, huella_mp text, activa boolean not null default true, folio_oficial text,
      cliente_id bigint, contacto_id bigint, proyecto_id bigint);
    create table public.cotizaciones_revisiones (
      id bigint generated always as identity primary key, cotizacion_id bigint, folio text, cliente text,
      revision integer not null, emitida_en timestamptz not null default now(), usuario text, total numeric,
      hash text not null, snapshot jsonb not null, tipo text not null default 'generado',
      constraint uq_revision_por_cotizacion unique (cotizacion_id, revision));
    create table public.aprobaciones (
      id bigint generated always as identity primary key, cotizacion_id bigint, revision_hash text,
      estado text not null default 'PENDIENTE', descuento_solicitado numeric, motivo text, solicitado_por text,
      resuelto_por text, creado timestamptz not null default now(), resuelto_en timestamptz, reglas_version integer);
    create table public.reglas_comerciales (
      id bigint generated always as identity primary key, version integer not null,
      descuento_max_sin_aprobacion numeric not null, margen_minimo_pct numeric, estado text not null default 'approved',
      vigencia_desde date not null default current_date, vigencia_hasta date, aprobado_por text,
      aprobado_en timestamptz not null default now(), fuente text);
    create table public.producto_version_economia (producto_version_id bigint primary key, costo_oficial_referencia numeric);
    create table public.lista_precio_items (id bigint primary key, piso_minimo numeric);
    create sequence public.folio_oficial_seq;
    -- Roles: SECURITY DEFINER como en producción (las políticas los llaman con el rol del cliente).
    create function private_api.rol_actual() returns text language sql stable security definer as $$
      select lower(p.rol) from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') limit 1 $$;
    create function private_api.puede_entrar() returns boolean language sql stable security definer as $$ select private_api.rol_actual() is not null $$;
    create function private_api.puede_editar_config() returns boolean language sql stable security definer as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    create function private_api.puede_ver_economia() returns boolean language sql stable security definer as $$ select private_api.rol_actual() = 'direccion' $$;
    create function public.puede_entrar() returns boolean language sql stable as $$ select private_api.puede_entrar() $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.puede_editar_config() $$;
    create function public.puede_ver_economia() returns boolean language sql stable as $$ select private_api.puede_ver_economia() $$;
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor'), ('${DISENO}','diseno');
    insert into public.reglas_comerciales(version, descuento_max_sin_aprobacion, margen_minimo_pct, vigencia_desde) values (1, 10, 30, current_date - 1);
  `);
  for (const t of ['productos', 'producto_versiones', 'expedientes', 'expediente_revisiones']) await x(tablaDeBaseline(t));
  await x(lineasDeBaseline('01_tablas.sql', (l) => /^ALTER TABLE public\.(expediente_revisiones|expedientes|producto_versiones|productos) ADD CONSTRAINT .* REFERENCES (expedientes|productos|producto_versiones|expediente_revisiones)\(/.test(l)));
  await x(lineasDeBaseline('01_tablas.sql', (l) => l.startsWith('CREATE UNIQUE INDEX expediente_revisiones_expediente_rev_uidx ')));
  await x(`create table public.renders (id bigint generated always as identity primary key, producto_id bigint, producto_version_id bigint,
    expediente_id bigint, stale boolean not null default false, estado text);`);
  for (const f of ['normalizar_cost_status_partidas', 'pin_product_versions_in_partidas']) await x(defDeBaseline(f));
  await x(leer('supabase/tests/fixtures/private_api_prod_20261013.sql'));
  await x(leer('supabase/tests/fixtures/private_api_emision_prod_20261013.sql'));
  // Producción de hoy: el gate vivo es el de P0-01 (reventa, aplicada 2026-10-16), no el del 13-oct.
  await x(leer('supabase/tests/fixtures/private_api_emision_prod_20261017.sql'));
  for (const f of ['reglas_comerciales_vigentes', 'revisiones_autor', 'strip_seller_economics_on_revision_write',
    'evaluar_emision_cotizacion', 'emitir_revision_v2', 'hash_revision', 'verificar_aprobacion',
    'requiere_aprobacion_snapshot', 'asignar_folio_oficial', 'cotizacion_segura', 'actualizar_cotizacion_segura',
    'guardar_cocrear_seguro', 'bom_hash_de_revision', 'guard_producto_version', 'guard_delete_producto_version',
    'certificar_version', 'puede_certificar_costo', 'vincular_cotizacion']) await x(defDeBaseline(f));
  for (const f of ['cotizacion_emitible', 'guardar_cocrear_seguro', 'vincular_cotizacion']) await x(defDePrivateApi(f));
  await x(defDeBaseline('cotizacion_emitible'));
  await x(`
    create trigger trg_guard_cotizacion_estado_directo before insert or update on public.cotizaciones for each row execute function private_api.guard_cotizacion_estado_directo();
    create trigger trg_normalize_economics_status before insert or update on public.cotizaciones for each row execute function public.normalize_economics_on_cotizacion_write();
    create trigger trg_pin_product_versions before insert or update on public.cotizaciones for each row execute function public.pin_product_versions_on_cotizacion_write();
    create trigger trg_strip_seller_economics before insert or update on public.cotizaciones for each row execute function public.strip_seller_economics_on_cotizacion_write();
    create trigger trg_revisiones_autor before insert or update on public.cotizaciones_revisiones for each row execute function public.revisiones_autor();
    create trigger trg_strip_seller_economics_revision before insert or update on public.cotizaciones_revisiones for each row execute function public.strip_seller_economics_on_revision_write();
  `);
  await x(lineasDeBaseline('05_triggers.sql', (l) => /^CREATE TRIGGER trg_guard(_delete)?_producto_version /.test(l)));
  // Privilegios de producción (baseline/06_grants.sql). Columnas SELECT de cotizaciones: el baseline sólo trae
  // privilegios de TABLA; se asume SELECT de todas menos partidas/totales (P0-08 las revocó). Ver el doc.
  await x(`
    grant delete, insert, update on table public.cotizaciones to authenticated;
    grant delete, insert, references, select, trigger, truncate, update on table public.cotizaciones to service_role;
    grant select (id, creado, actualizado, usuario, cliente, folio, estado, total, piezas, huella_mp, activa, folio_oficial,
      cliente_id, contacto_id, proyecto_id, acomodo) on table public.cotizaciones to authenticated;
    grant delete, insert, references, select, trigger, truncate, update on table public.expedientes, public.expediente_revisiones,
      public.producto_versiones, public.productos to authenticated, service_role;
    revoke all on function public.actualizar_cotizacion_segura(bigint, jsonb) from public;
    grant execute on function public.actualizar_cotizacion_segura(bigint, jsonb) to authenticated, service_role;
    revoke all on function public.guardar_cocrear_seguro(bigint, jsonb) from public;
    grant execute on function public.guardar_cocrear_seguro(bigint, jsonb) to authenticated, service_role;
    alter table public.cotizaciones enable row level security;
    alter table public.expedientes enable row level security;
    alter table public.expediente_revisiones enable row level security;
    alter table public.producto_versiones enable row level security;
  `);
  for (const [t, ps] of Object.entries({
    cotizaciones: ['cotizaciones_actualiza', 'cotizaciones_escribe', 'cotizaciones_lee'],
    expedientes: ['exp_sel', 'exp_write_delete', 'exp_write_insert', 'exp_write_update'],
    expediente_revisiones: ['exprev_insert_technical', 'exprev_sel'],
    producto_versiones: ['pm_ver_sel', 'pm_ver_w_delete', 'pm_ver_w_insert', 'pm_ver_w_update'],
  })) for (const p of ps) await x(politicaDeBaseline(t, p));
  if (conVh035c) await x(leer(VH035C));   // en producción desde el 13-oct
  return db;
}

// --- sesiones ----------------------------------------------------------------------------------
export const fijar = (db, email) => db.exec(`select set_config('test.email', '${email}', false), set_config('request.jwt.claims', '${email ? JSON.stringify({ email }) : ''}', false)`);
// `rol`: 'authenticated' = como entra PostgREST (RLS + privilegios); null = servidor/semilla (dueño de las tablas).
export async function como(db, email, fn, rol = 'authenticated') {
  await fijar(db, email);
  if (rol) await db.exec(`set role ${rol}`);
  try { return await fn(); } finally { if (rol) await db.exec('reset role'); await fijar(db, ''); }
}
export const q = (db, email, sql, params, rol) => como(db, email, () => db.query(sql, params), rol);
export const uno = async (db, email, sql, params, rol) => (await q(db, email, sql, params, rol)).rows[0];
export const fallo = async (promesa) => { try { await promesa; } catch (e) { return e; } return null; };

export const vista = async (db, email, id) => (await uno(db, email, 'select public.cotizacion_segura($1) as c', [id])).c;
export const guardar2 = (db, email, id, patch) => uno(db, email, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify(patch)]);
export const guardar3 = (db, email, id, patch, esperado) => uno(db, email, 'select public.actualizar_cotizacion_segura($1, $2::jsonb, $3::timestamptz) as c', [id, JSON.stringify(patch), esperado]);
export const filaCot = async (db, id) => (await db.query('select c::text as t from public.cotizaciones c where id=$1', [id])).rows[0].t;
export const filaExp = async (db, id) => (await db.query('select e::text as t from public.expedientes e where id=$1', [id])).rows[0].t;
export const filaVer = async (db, id) => (await db.query('select v::text as t from public.producto_versiones v where id=$1', [id])).rows[0].t;
export const mismaVersion = async (db, id, iso) => (await db.query('select actualizado = $2::timestamptz as igual from public.cotizaciones where id=$1', [id, iso])).rows[0].igual;
export const revisionesDe = async (db, id) => (await db.query('select rev, nombre from public.expediente_revisiones where expediente_id=$1 order by rev', [id])).rows;
export const md5Def = async (db, firma) => (await db.query('select md5(pg_get_functiondef($1::regprocedure)) as m', [firma])).rows[0].m;
export const existe = async (db, firma) => (await db.query('select to_regprocedure($1) is not null as e', [firma])).rows[0].e;

export const PARTIDAS = [
  { id: 'p1', nombre: 'Escritorio operativo melamina', cantidad: 2, precioUnitario: 10000, costoUnitario: 6000 },
  { id: 'p2', nombre: 'Silla operativa', cantidad: 6, precioUnitario: 3200, costoUnitario: 1400 },
];
export async function sembrarCot(db, usuario = VENDEDOR) {
  return (await uno(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, partidas, total, piezas) values ($1, 'Tradeco', $2::jsonb, 39200, 8) returning id`,
    [usuario, JSON.stringify(PARTIDAS)], null)).id;
}
export async function sembrarExp(db, { creadoPor = DISENO, nombre = 'Credenza nogal' } = {}) {
  const { id } = await uno(db, creadoPor,
    `insert into public.expedientes(creado_por, nombre, estado, bom, costo, revision) values ($1, $2, 'borrador', '[{"pieza":"tapa"}]'::jsonb, '{"costoUnitario":5000}'::jsonb, 1) returning id`,
    [creadoPor, nombre], null);
  await db.query(`insert into public.expediente_revisiones(expediente_id, rev, creado_por, nombre) values ($1, 1, $2, $3)`, [id, creadoPor, nombre]);
  return id;
}
// Lo que hace hoy AsistenteEspecial.jsx → nube.actualizarExpediente: UPDATE directo con revision = revActual + 1
// y `actualizado` del navegador.
export const updateDirectoExp = (db, email, id, revActual, nombre, actualizado = new Date().toISOString()) => q(db, email,
  `update public.expedientes set nombre = $2, revision = $3, actualizado = $4::timestamptz, actualizado_por = $5 where id = $1`,
  [id, nombre, revActual + 1, actualizado, email]);
export const rpcExp = (db, email, id, patch, esperada) => uno(db, email,
  'select public.actualizar_expediente_seguro($1, $2::jsonb, $3::int) as r', [id, JSON.stringify(patch), esperada]);
export const cocrear2 = (db, email, id, payload) => uno(db, email, 'select public.guardar_cocrear_seguro($1, $2::jsonb) as r', [id, JSON.stringify(payload)]);
export const cocrear3 = (db, email, id, payload, esperada) => uno(db, email, 'select public.guardar_cocrear_seguro($1, $2::jsonb, $3::int) as r', [id, JSON.stringify(payload), esperada]);

export async function sembrarVersion(db, estado) {
  const { id: prod } = await uno(db, DIRECCION, `insert into public.productos(nombre, source_type) values ('Credenza', 'expediente') returning id`, [], null);
  const exp = await sembrarExp(db);
  const { id: revId } = await uno(db, DIRECCION, 'select id from public.expediente_revisiones where expediente_id=$1 and rev=1', [exp], null);
  await db.query(`update public.expediente_revisiones set bom = '[{"pieza":"tapa","mm":18}]'::jsonb where id=$1`, [revId]);
  const { id } = await uno(db, DIRECCION,
    `insert into public.producto_versiones(producto_id, etiqueta, dimensiones, atributos, expediente_id, expediente_revision_id, estado_tecnico)
     values ($1, 'rev 1', '{"ancho_mm":1800,"fondo_mm":450,"alto_mm":750}'::jsonb, '{"material":"nogal"}'::jsonb, $2, $3, 'aprobado') returning id`,
    [prod, exp, revId], null);
  if (estado === 'certificado') await uno(db, DIRECCION, 'select public.certificar_version($1)', [id], null);
  return id;
}


// ============================================================================
//  Cliente "supabase-js" mínimo sobre PGlite para probar src/nube.js y src/datos/cotizaciones.js contra el
//  SQL REAL: cada llamada corre con SET ROLE authenticated y el correo de `sesion.email` (como PostgREST con el
//  JWT de esa persona). Los errores son los de Postgres, con la forma de PostgREST ({ code, message, details,
//  hint }). Sólo implementa lo que usan las escrituras versionadas; cualquier otra cadena LANZA (nada se
//  finge en silencio).
// ============================================================================
export function clientePglite(db, sesion) {
  const ejecutar = async (sql, params) => {
    try {
      const r = await como(db, sesion.email, () => db.query(sql, params));
      return { data: r.rows, error: null };
    } catch (e) {
      return { data: null, error: { code: e.code ?? null, message: e.message, details: e.detail ?? null, hint: e.hint ?? null } };
    }
  };
  const valor = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
  const promesa = (fn) => ({ then: (ok, ko) => fn().then(ok, ko) });
  return {
    sesion,
    llamadas: [],
    async rpc(fn, args = {}) {
      this.llamadas.push([fn, args]);
      const claves = Object.keys(args);
      const sql = `select public.${fn}(${claves.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
      const { data, error } = await ejecutar(sql, claves.map((k) => valor(args[k])));
      return { data: error ? null : data[0].r, error };
    },
    from(tabla) {
      if (!/^[a-z_]+$/.test(tabla)) throw new Error(`tabla inválida ${tabla}`);
      return {
        insert: (fila) => promesa(async () => {
          const ks = Object.keys(fila);
          const { error } = await ejecutar(`insert into public.${tabla} (${ks.join(', ')}) select ${ks.join(', ')} from jsonb_populate_record(null::public.${tabla}, $1::jsonb)`, [JSON.stringify(fila)]);
          return { data: null, error };
        }),
        update: (patch) => ({
          eq: (col, val) => promesa(async () => {
            if (!/^[a-z_]+$/.test(col)) throw new Error(`columna inválida ${col}`);
            const ks = Object.keys(patch);
            const { error } = await ejecutar(`update public.${tabla} set (${ks.join(', ')}) = (select ${ks.join(', ')} from jsonb_populate_record(null::public.${tabla}, $1::jsonb)) where ${col} = $2`, [JSON.stringify(patch), val]);
            return { data: null, error };
          }),
        }),
      };
    },
  };
}

// --- cliente de SERVICIO (service role) sobre PGlite, con la interfaz de supabase-js que usa el núcleo del costeo ----
// Cierre GO: las pruebas del pipeline llaman a src/datos/costeoServidor.js (la MISMA función que ejecuta la Edge) con este
// cliente. Corre como dueño de las tablas (como service_role: sin RLS) y `auth.role()` responde 'service_role'. Sólo
// traduce las formas de consulta que el núcleo usa; cualquier otra lanza error (la prueba no puede pasar por omisión).
export function servicioPglite(db) {
  const ident = (x) => { if (!/^[a-z_]+$/.test(x)) throw new Error(`identificador inválido: ${x}`); return x; };
  const columnas = (cols) => (cols === '*' ? '*' : cols.split(',').map((c) => ident(c.trim())).join(', '));
  const correr = async (sql, params = []) => {
    await db.exec(`select set_config('request.jwt.claim.role', 'service_role', false)`);
    try { return { rows: (await db.query(sql, params)).rows, error: null }; } catch (e) { return { rows: null, error: { message: e.message, code: e.code ?? null } }; } finally {
      await db.exec(`select set_config('request.jwt.claim.role', '', false)`);
    }
  };
  const llamadas = [];
  return {
    llamadas,
    async rpc(fn, args = {}) {
      llamadas.push(['rpc', ident(fn)]);
      const ks = Object.keys(args).map(ident);
      const { rows, error } = await correr(`select public.${fn}(${ks.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`,
        ks.map((k) => (args[k] !== null && typeof args[k] === 'object' && !Array.isArray(args[k]) ? JSON.stringify(args[k]) : args[k])));
      return { data: error ? null : rows[0].r, error };
    },
    from(tabla) {
      ident(tabla);
      const e = { cols: '*', filtros: [], params: [], count: false };
      const sql = () => `select ${e.count ? 'count(*)::int as n' : columnas(e.cols)} from public.${tabla}${e.filtros.length ? ' where ' + e.filtros.join(' and ') : ''}`;
      const lista = async () => { llamadas.push(['select', tabla]); const r = await correr(sql(), e.params); return e.count ? { data: null, count: r.error ? null : r.rows[0].n, error: r.error } : { data: r.rows, error: r.error }; };
      const uno = async (estricto) => {
        const r = await lista();
        if (r.error) return { data: null, error: r.error };
        if (r.data.length > 1 || (estricto && r.data.length === 0)) return { data: null, error: { message: `se esperaba una fila y hubo ${r.data.length}` } };
        return { data: r.data[0] ?? null, error: null };
      };
      const b = {
        select(cols = '*', opts = {}) {
          e.cols = cols;
          if (opts.count) { if (opts.count !== 'exact' || !opts.head) throw new Error('sólo count exact + head'); e.count = true; }
          return b;
        },
        eq(c, v) { e.params.push(v); e.filtros.push(`${ident(c)} = $${e.params.length}`); return b; },
        in(c, vs) { if (!Array.isArray(vs)) throw new Error('in() exige arreglo'); e.params.push(vs.map(String)); e.filtros.push(`${ident(c)}::text = any($${e.params.length}::text[])`); return b; },
        is(c, v) { if (v !== null) throw new Error('is() sólo con null'); e.filtros.push(`${ident(c)} is null`); return b; },
        single: () => uno(true),
        maybeSingle: () => uno(false),
        then: (ok, ko) => lista().then(ok, ko),
        insert(fila) {
          const ks = Object.keys(fila).map(ident);
          const ins = async (ret) => {
            llamadas.push(['insert', tabla]);
            const r = await correr(`insert into public.${tabla} (${ks.join(', ')}) select ${ks.join(', ')} from jsonb_populate_record(null::public.${tabla}, $1::jsonb) returning ${ret}`, [JSON.stringify(fila)]);
            return r;
          };
          return {
            select: (cols) => ({ single: async () => { const r = await ins(columnas(cols)); return r.error ? { data: null, error: r.error } : { data: r.rows[0], error: null }; } }),
            then: (ok, ko) => ins('1').then((r) => ({ data: null, error: r.error })).then(ok, ko),
          };
        },
      };
      return b;
    },
  };
}
