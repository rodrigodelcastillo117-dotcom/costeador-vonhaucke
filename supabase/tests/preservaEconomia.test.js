// ============================================================================
//  VH-035 · PRUEBA EN BASE AISLADA (PGlite = PostgreSQL real en WASM, en memoria).
//
//  Pregunta de Rodrigo (2026-10-10): "prueba que un vendedor pueda abrir, editar y
//  guardar una cotización SIN eliminar ni modificar los costos internos de Dirección.
//  No basta con llamar a actualizar_cotizacion_segura."
//
//  Aquí se carga el esquema REAL (tablas, jsonb_sin_economia, triggers y los cuerpos
//  de private_api leídos de producción) con auth/roles simulados, y se corre el mismo
//  escenario DOS veces:
//    ANTES  = producción tal cual hoy  → se demuestra que la economía se pierde.
//    DESPUÉS = con la migración 20261010170000 → se demuestra que se conserva.
//  Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');

// Saca del baseline la definición completa de una función de `public`.
function defDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre} en el baseline`);
  const fin = sql.indexOf('\n;\n', ini);
  return sql.slice(ini, fin) + ';';
}

const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx', DISENO = 'diseno@vh.mx';

async function baseAislada() {
  const db = new PGlite();
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema private_api;
    -- auth simulado: quién soy lo dice la sesión de prueba.
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
    -- Roles (modelo de producción: Dirección ve economía; Dirección y Diseño editan config).
    create function private_api.rol_actual() returns text language sql stable as $$
      select lower(p.rol) from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') limit 1 $$;
    create function private_api.puede_entrar() returns boolean language sql stable as $$ select private_api.rol_actual() is not null $$;
    create function private_api.puede_editar_config() returns boolean language sql stable as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    create function private_api.puede_ver_economia() returns boolean language sql stable as $$ select private_api.rol_actual() = 'direccion' $$;
    create function public.puede_entrar() returns boolean language sql stable as $$ select private_api.puede_entrar() $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.puede_editar_config() $$;
    create function public.puede_ver_economia() returns boolean language sql stable as $$ select private_api.puede_ver_economia() $$;
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor'), ('${DISENO}','diseno');
  `);
  // Funciones REALES de public (baseline) y de private_api (fixture leído de producción).
  for (const f of ['jsonb_sin_economia', 'normalizar_cost_status_partidas', 'normalize_economics_on_cotizacion_write', 'strip_seller_economics_on_cotizacion_write']) {
    await x(defDeBaseline(f));
  }
  await x(leer('supabase/tests/fixtures/private_api_baseline_20261010.sql'));
  await x(`
    create function public.cotizacion_segura(p_id bigint) returns jsonb language sql stable as $$ select private_api.cotizacion_segura(p_id) $$;
    create function public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb) returns jsonb language sql as $$ select private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch) $$;
    create trigger trg_normalize_economics_status before insert or update on public.cotizaciones for each row execute function public.normalize_economics_on_cotizacion_write();
    create trigger trg_strip_seller_economics before insert or update on public.cotizaciones for each row execute function public.strip_seller_economics_on_cotizacion_write();
  `);
  return db;
}

const como = async (db, email, fn) => {
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return await fn(); } finally { await db.exec(`select set_config('test.email', '', false)`); }
};
const rpc = async (db, email, sql, params) => como(db, email, async () => (await db.query(sql, params)).rows[0]);

const PARTIDAS_DIRECCION = [
  { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000, costoUnitario: 21000, margen: 30, costoDerivado: false, producto_version_id: 1933 },
  { id: 'p2', nombre: 'Silla operativa', cantidad: 6, precioUnitario: 3200, costoUnitario: 1400, margen: 35 },
];

// El escenario completo: Dirección deja costos → el rol sin economía reabre, edita, guarda → Dirección reabre.
async function escenario(db, rolSinEconomia) {
  // 1) La cotización es del VENDEDOR y Dirección (que sí ve economía) le fija los costos.
  const { id } = (await rpc(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, partidas, total, piezas) values ($1, 'Tradeco', $2::jsonb, 67200, 7) returning id`,
    [VENDEDOR, JSON.stringify(PARTIDAS_DIRECCION)]));
  const antes = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
  expect(antes.c.partidas[0].costoUnitario).toBe(21000);

  // 2) El rol sin economía REABRE: recibe las partidas despojadas (como en la app).
  const vista = await rpc(db, rolSinEconomia, 'select public.cotizacion_segura($1) as c', [id]);
  expect(vista.c.ok).toBe(true);
  expect(vista.c.partidas[0]).not.toHaveProperty('costoUnitario');
  expect(vista.c.partidas[0]).not.toHaveProperty('margen');

  // 3) EDITA lo que le toca (cantidad, un renglón nuevo) e intenta colar un costo propio.
  const editadas = vista.c.partidas.map((p) => (p.id === 'p1' ? { ...p, cantidad: 3, costoUnitario: 1 } : p));
  editadas.push({ id: 'p3', nombre: 'Archivero', cantidad: 2, precioUnitario: 5000 });
  const r = await rpc(db, rolSinEconomia,
    'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c',
    [id, JSON.stringify({ partidas: editadas, total: 160000, piezas: 11 })]);
  expect(r.c.ok).toBe(true);

  // 4) DIRECCIÓN reabre.
  const despues = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
  const p1 = despues.c.partidas.find((p) => p.id === 'p1');
  const p2 = despues.c.partidas.find((p) => p.id === 'p2');
  const p3 = despues.c.partidas.find((p) => p.id === 'p3');
  return { id, p1, p2, p3, total: despues.c.total };
}

describe('VH-035 · ANTES (producción hoy): el rol sin economía PISA los costos de Dirección', () => {
  let db;
  beforeAll(async () => { db = await baseAislada(); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('vendedor edita → Dirección pierde costoUnitario/margen (el bug, demostrado)', async () => {
    const { p1, p2, p3 } = await escenario(db, VENDEDOR);
    expect(p1.cantidad).toBe(3);                 // la edición sí entró…
    expect(p1).not.toHaveProperty('costoUnitario'); // …y la economía de Dirección se perdió
    expect(p2).not.toHaveProperty('costoUnitario');
    expect(p3).toBeTruthy();
  });

  it('diseño edita → peor: el trigger de strip sólo aplica a vendedor, así que diseño PISA el costo con el suyo', async () => {
    const { p1 } = await escenario(db, DISENO);
    // Dirección tenía 21000. Diseño mandó costoUnitario: 1 "por accidente" y se quedó.
    expect(p1.costoUnitario).not.toBe(21000);
    expect(p1.costoUnitario).toBe(1);
  });
});

describe('VH-035 · DESPUÉS (migración 20261010170000): la economía de Dirección queda INTACTA', () => {
  let db;
  beforeAll(async () => {
    db = await baseAislada();
    await db.exec(leer('supabase/migrations/20261010170000_actualizar_cotizacion_preserva_economia.sql'));
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('vendedor edita cantidad y agrega renglón → costos y márgenes de Dirección se conservan al centavo', async () => {
    const { p1, p2, p3 } = await escenario(db, VENDEDOR);
    expect(p1.cantidad).toBe(3);                 // su edición entró
    expect(p1.costoUnitario).toBe(21000);        // la economía NO se tocó…
    expect(p1.margen).toBe(30);
    expect(p1.costoDerivado).toBe(false);
    expect(p1.producto_version_id).toBe(1933);
    expect(p2.costoUnitario).toBe(1400);
    expect(p2.margen).toBe(35);
    expect(p3).toBeTruthy();                     // el renglón nuevo existe…
    expect(p3).not.toHaveProperty('costoUnitario'); // …sin economía inventada
  });

  it('el vendedor NO puede colar un costo propio (costoUnitario: 1 se descarta, queda el de Dirección)', async () => {
    const { p1 } = await escenario(db, VENDEDOR);
    expect(p1.costoUnitario).toBe(21000);
  });

  it('diseño (edita config pero no ve economía) tampoco la borra', async () => {
    const { p1, p2 } = await escenario(db, DISENO);
    expect(p1.costoUnitario).toBe(21000);
    expect(p2.margen).toBe(35);
  });

  it('Dirección sigue pudiendo cambiar la economía (el merge NO congela sus costos)', async () => {
    const { id } = await escenario(db, VENDEDOR);
    const vista = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
    const nuevas = vista.c.partidas.map((p) => (p.id === 'p1' ? { ...p, costoUnitario: 22500 } : p));
    await rpc(db, DIRECCION, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify({ partidas: nuevas })]);
    const d = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
    expect(d.c.partidas.find((p) => p.id === 'p1').costoUnitario).toBe(22500);
  });

  it('una escritura CRUDA del vendedor (sin pasar por el RPC) sigue strippeada por el trigger', async () => {
    const { id } = await escenario(db, VENDEDOR);
    await como(db, VENDEDOR, () => db.query(
      `update public.cotizaciones set partidas = $2::jsonb where id = $1`,
      [id, JSON.stringify([{ id: 'p9', nombre: 'X', cantidad: 1, precioUnitario: 10, costoUnitario: 999 }])]));
    const d = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
    expect(d.c.partidas[0]).not.toHaveProperty('costoUnitario');
  });

  it('quitar un renglón sí lo quita (el merge no resucita partidas borradas)', async () => {
    const { id } = await escenario(db, VENDEDOR);
    const vista = await rpc(db, VENDEDOR, 'select public.cotizacion_segura($1) as c', [id]);
    const sinP2 = vista.c.partidas.filter((p) => p.id !== 'p2');
    await rpc(db, VENDEDOR, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify({ partidas: sinP2 })]);
    const d = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
    expect(d.c.partidas.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(d.c.partidas[0].costoUnitario).toBe(21000);
  });
});
