// ============================================================================
//  SEG-01 · GATE DE EMISIÓN: el snapshot del cliente sólo se ata a lo costeado por `id` de renglón.
//  PRUEBA EN BASE AISLADA (PGlite = PostgreSQL real en WASM). Nada toca producción.
//
//  Defecto (auditoría de seguridad 2026-10-13, docs/auditoria/SEGURIDAD_10.md):
//  `private_api.evaluar_emision_cotizacion` toma el COSTO del renglón persistido (bien: nunca del
//  snapshot) pero sólo verifica que el snapshot tenga el mismo número de renglones y la misma
//  identidad (`id`/`piezaId`/`producto_id`/`nombre`, el primero que exista). Descripción,
//  medidas, material y cantidad del snapshot son libres. `emitir_revision_v2` guarda ESE snapshot
//  como revisión 'generado_v2' y `asignar_folio_oficial` le da folio oficial.
//
//  Escenario: Dirección costeó un escritorio de melamina (costo 6,000). El vendedor dueño llama
//  a la RPC con un snapshot que conserva `id:'p1'` pero dice "nogal macizo 300x120" a 9,000. El
//  margen se calcula contra el costo de la melamina (33% ≥ mínimo 30%) ⇒ ALLOWED sin pasar por
//  Dirección, y el documento oficial promete otro producto.
//
//  Estas pruebas DOCUMENTAN EL COMPORTAMIENTO VIGENTE (defecto). Cuando se corrija, el caso
//  "defecto vigente" debe invertirse (esperar BLOCKED) y los de control deben seguir igual.
//
//  Cuerpos de private_api: copia EXACTA de producción (md5 verificado abajo) en
//  fixtures/private_api_emision_prod_20261013.sql. Wrappers públicos y triggers: baseline
//  (md5 idéntico a producción para los wrappers usados aquí, verificado el 2026-10-13).
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');

function defDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre} en el baseline`);
  const fin = sql.indexOf('\n;\n', ini);
  return sql.slice(ini, fin) + ';';
}

// md5(pg_get_functiondef) leídos de producción (mtuvnbgljwbsaizjjgzs) el 2026-10-13.
const MD5_PROD = {
  'private_api.evaluar_emision_cotizacion': '9c660b09ca099af557436ef54edbb1de',
  'private_api.emitir_revision_v2': 'fb26c9d515ac6116ae87ed44350c3615',
  'private_api.hash_revision': '6290c18df505348c1509e6dc878cf13d',
  'private_api.verificar_aprobacion': 'c9da5e92404bd24f8e7e9d7d09121a31',
  'private_api.requiere_aprobacion_snapshot': '31274e5596116d91659b2253a36d40a6',
  'private_api.asignar_folio_oficial': '33acd273d08c8c45f07b04954d86729e',
};

const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx';

async function baseAislada() {
  const db = new PGlite();
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema private_api;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create function auth.uid() returns uuid language sql stable as $$
      select case when coalesce(current_setting('test.email', true), '') = '' then null
        else md5(current_setting('test.email', true))::uuid end $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true), '') = '' then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, nombre text, rol text not null default 'vendedor', creado timestamptz not null default now());
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
    -- Tablas del mundo canónico (sólo para que el SQL compile; este escenario es legacy, sin producto_id).
    create table public.productos (id bigint primary key, source_type text, version_tecnica_vigente_id bigint);
    create table public.producto_versiones (id bigint primary key, producto_id bigint, estado_tecnico text);
    create table public.producto_version_economia (producto_version_id bigint primary key, costo_oficial_referencia numeric);
    create table public.lista_precio_items (id bigint primary key, piso_minimo numeric);
    create sequence public.folio_oficial_seq;
    create function private_api.rol_actual() returns text language sql stable as $$
      select lower(p.rol) from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') limit 1 $$;
    create function private_api.puede_entrar() returns boolean language sql stable as $$ select private_api.rol_actual() is not null $$;
    create function private_api.puede_editar_config() returns boolean language sql stable as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    create function private_api.puede_ver_economia() returns boolean language sql stable as $$ select private_api.rol_actual() = 'direccion' $$;
    create function public.puede_entrar() returns boolean language sql stable as $$ select private_api.puede_entrar() $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.puede_editar_config() $$;
    create function public.puede_ver_economia() returns boolean language sql stable as $$ select private_api.puede_ver_economia() $$;
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor');
    -- Política vigente: descuento máx. 10%, margen mínimo 30%.
    insert into public.reglas_comerciales(version, descuento_max_sin_aprobacion, margen_minimo_pct, vigencia_desde)
      values (1, 10, 30, current_date - 1);
  `);
  for (const f of ['normalizar_cost_status_partidas', 'pin_product_versions_in_partidas']) await x(defDeBaseline(f));
  // Triggers de cotizaciones + jsonb_sin_economia: cuerpos de producción (fixture existente de VH-035/VH-148).
  await x(leer('supabase/tests/fixtures/private_api_prod_20261013.sql'));
  // Gate de emisión: cuerpos EXACTOS de producción.
  await x(leer('supabase/tests/fixtures/private_api_emision_prod_20261013.sql'));
  for (const f of ['reglas_comerciales_vigentes', 'revisiones_autor', 'strip_seller_economics_on_revision_write',
    'evaluar_emision_cotizacion', 'emitir_revision_v2', 'hash_revision', 'verificar_aprobacion',
    'requiere_aprobacion_snapshot', 'asignar_folio_oficial']) await x(defDeBaseline(f));
  await x(`
    create trigger trg_guard_cotizacion_estado_directo before insert or update on public.cotizaciones for each row execute function private_api.guard_cotizacion_estado_directo();
    create trigger trg_normalize_economics_status before insert or update on public.cotizaciones for each row execute function public.normalize_economics_on_cotizacion_write();
    create trigger trg_pin_product_versions before insert or update on public.cotizaciones for each row execute function public.pin_product_versions_on_cotizacion_write();
    create trigger trg_strip_seller_economics before insert or update on public.cotizaciones for each row execute function public.strip_seller_economics_on_cotizacion_write();
    create trigger trg_revisiones_autor before insert or update on public.cotizaciones_revisiones for each row execute function public.revisiones_autor();
    create trigger trg_strip_seller_economics_revision before insert or update on public.cotizaciones_revisiones for each row execute function public.strip_seller_economics_on_revision_write();
  `);
  return db;
}

// Sesión simulada: auth.jwt() lee test.email; emitir_revision_v2/revisiones_autor leen request.jwt.claims.
const como = async (db, email, fn) => {
  await db.exec(`select set_config('test.email', '${email}', false), set_config('request.jwt.claims', '${JSON.stringify({ email })}', false)`);
  try { return await fn(); } finally { await db.exec(`select set_config('test.email', '', false), set_config('request.jwt.claims', '', false)`); }
};
const uno = async (db, email, sql, params) => como(db, email, async () => (await db.query(sql, params)).rows[0]);
const evaluar = async (db, email, id, snap) =>
  (await uno(db, email, 'select public.evaluar_emision_cotizacion($1, $2::jsonb) as g', [id, JSON.stringify(snap)])).g;
const emitir = async (db, email, id, snap) =>
  (await uno(db, email, 'select public.emitir_revision_v2($1, $2::jsonb) as r', [id, JSON.stringify(snap)])).r;
const folio = async (db, email, id) =>
  (await uno(db, email, 'select public.asignar_folio_oficial($1) as f', [id])).f;

// Renglón legacy (sin producto_id): lo que Dirección costeó y quedó guardado.
const COSTEADO = {
  id: 'p1', nombre: 'Escritorio operativo melamina blanca', medidas: '120x60x75', material: 'Melamina 16 mm',
  cantidad: 1, precioUnitario: 10000, costoUnitario: 6000,
};
// Snapshot armado a mano por el vendedor: misma identidad, OTRO producto.
const snapshotCon = (precio) => {
  const cantidad = 20;
  const precioLista = precio * cantidad, iva = Math.round(precioLista * 0.16 * 100) / 100;
  return {
    cliente: 'Cliente demo', folio: 'COT-DEMO',
    partidas: [{ id: 'p1', nombre: 'Escritorio ejecutivo NOGAL MACIZO con cajonera', medidas: '300x120x75',
      material: 'Nogal macizo 38 mm', cantidad, precioUnitario: precio }],
    totales: { precioLista, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva },
    total: precioLista + iva,
  };
};

async function sembrarCosteadaPorDireccion(db) {
  // Dirección guarda (el trigger NO despoja economía a Dirección) a nombre del vendedor.
  const { id } = await uno(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, folio, partidas, total, piezas) values ($1, 'Cliente demo', 'COT-DEMO', $2::jsonb, 10000, 1) returning id`,
    [VENDEDOR, JSON.stringify([COSTEADO])]);
  return id;
}

describe('SEG-01 · el gate de emisión no ata descripción/material del snapshot al renglón costeado', () => {
  let db;
  beforeAll(async () => { db = await baseAislada(); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('la fixture es el SQL EXACTO de producción (md5 de pg_get_functiondef)', async () => {
    for (const [fn, md5] of Object.entries(MD5_PROD)) {
      const { h } = (await db.query(`select md5(pg_get_functiondef($1::regproc)) as h`, [fn])).rows[0];
      expect(h, fn).toBe(md5);
    }
  });

  it('control: con el costo persistido de Dirección, precio bajo el margen mínimo ⇒ APPROVAL_REQUIRED', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    const g = await evaluar(db, VENDEDOR, id, snapshotCon(8000)); // (8000-6000)/8000 = 25% < 30%
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(g.reasons.some((m) => /^linea_1_margen_bajo_/.test(m))).toBe(true);
  });

  it('control fail-closed: si el VENDEDOR guardó el renglón (costo despojado) ⇒ ECONOMICS_INCOMPLETE', async () => {
    const { id } = await uno(db, VENDEDOR,
      `insert into public.cotizaciones(usuario, cliente, partidas, total, piezas) values ($1, 'Cliente demo', $2::jsonb, 10000, 1) returning id`,
      [VENDEDOR, JSON.stringify([COSTEADO])]);
    const g = await evaluar(db, VENDEDOR, id, snapshotCon(9000));
    expect(g.state).toBe('ECONOMICS_INCOMPLETE');
  });

  // SEG-01 (P1, VIGENTE en producción). it.fails: la prueba exige el comportamiento CORRECTO y hoy falla, así que el
  // defecto queda VISIBLE (no un verde que lo normalice). Cuando se corrija, vitest avisa y se quita el `.fails`.
  // Reproducción completa (gate ALLOWED → revisión generado_v2 con nogal 300x120 → folio VH-AAAA-NNNNN mientras
  // lo persistido sigue siendo la melamina de $6,000): docs/auditoria/SEGURIDAD_10.md § SEG-01.
  it.fails('SEG-01: un snapshot con OTRO producto (nogal 300x120, x20) no debe pasar el gate ni recibir folio', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    const snap = snapshotCon(9000); // margen calculado contra el costo de la MELAMINA: (9000-6000)/9000 = 33.3% ≥ 30%
    const g = await evaluar(db, VENDEDOR, id, snap);
    expect(g.state).not.toBe('ALLOWED');        // correcto: BLOCKED (el renglón no corresponde a lo costeado)
    const r = await emitir(db, VENDEDOR, id, snap);
    expect(r.nueva).not.toBe(true);
    const f = await folio(db, VENDEDOR, id).catch(() => null);
    expect(f).toBeNull();
  });

  // SEG-06 (P3, familia VH-035, VIGENTE): it.fails con el comportamiento correcto (el costo de Dirección se conserva).
  it.fails('SEG-06: asignar_folio_oficial llamado por el vendedor NO debe borrar el costo de Dirección del renglón', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    await emitir(db, VENDEDOR, id, snapshotCon(9000));
    await folio(db, VENDEDOR, id);
    const fila = (await db.query(`select partidas from public.cotizaciones where id=$1`, [id])).rows[0];
    // El UPDATE de folio_oficial dispara trg_strip_seller_economics con el JWT del vendedor.
    expect(Number(fila.partidas[0].costoUnitario)).toBe(6000);
  });
});
