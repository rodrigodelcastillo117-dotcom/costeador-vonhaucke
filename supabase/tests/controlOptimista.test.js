// ============================================================================
//  VH-148 · CONTROL OPTIMISTA · PRUEBA EN BASE AISLADA (PGlite = PostgreSQL real en WASM).
//
//  Defecto (2026-10-13, cotización 1372): dos pestañas sobre la misma cotización se pisan en
//  silencio: `actualizar_cotizacion_segura` hace `select ... for update` y escribe el patch tal cual
//  (gana el último). Aquí se carga el esquema REAL (tablas, jsonb_sin_economia, los cuatro triggers y
//  los cuerpos de private_api leídos de producción) con auth/roles simulados, se aplica
//  PROPUESTA_vh148_control_optimista_cotizacion.sql y se juega el escenario de dos "pestañas":
//    · A y B abren la misma fila (mismo `actualizado`).
//    · A guarda con su `actualizado` esperado → ok; la fila avanza.
//    · B guarda con el suyo (ya viejo) → SQLSTATE PT409 'CONFLICTO_VERSION' y NADA cambió.
//    · B recarga y guarda con el `actualizado` fresco → ok.
//    · La firma de dos argumentos (clientes viejos) sigue funcionando sin control.
//  Nada toca producción. Harness: el mismo de preservaEconomia.test.js (VH-035).
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const MIGRACION = 'supabase/migrations/PROPUESTA_vh148_control_optimista_cotizacion.sql';

// Saca del baseline la definición completa de una función de `public`.
function defDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre} en el baseline`);
  const fin = sql.indexOf('\n;\n', ini);
  return sql.slice(ini, fin) + ';';
}

// El bloque de rollback vive dentro de un comentario /* */ al final de la migración, entre marcadores.
function sqlRollback() {
  const sql = leer(MIGRACION);
  const ini = sql.indexOf('-- >>> ROLLBACK VH-148 INICIO');
  const fin = sql.indexOf('-- <<< ROLLBACK VH-148 FIN');
  if (ini < 0 || fin < 0) throw new Error('la migración no trae el bloque de rollback');
  return sql.slice(ini, fin);
}

const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx', DISENO = 'diseno@vh.mx';

async function baseAislada() {
  const db = new PGlite();
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema private_api;
    -- Roles de Supabase a los que la migración da/quita permisos.
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
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
    create function private_api.rol_actual() returns text language sql stable as $$
      select lower(p.rol) from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') limit 1 $$;
    create function private_api.puede_entrar() returns boolean language sql stable as $$ select private_api.rol_actual() is not null $$;
    create function private_api.puede_editar_config() returns boolean language sql stable as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    create function private_api.puede_ver_economia() returns boolean language sql stable as $$ select private_api.rol_actual() = 'direccion' $$;
    create function public.puede_entrar() returns boolean language sql stable as $$ select private_api.puede_entrar() $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.puede_editar_config() $$;
    create function public.puede_ver_economia() returns boolean language sql stable as $$ select private_api.puede_ver_economia() $$;
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor'), ('${DISENO}','diseno');
    create table public.productos (id bigint primary key, version_tecnica_vigente_id bigint);
    insert into public.productos values (1, 1933), (2, 2044);
  `);
  for (const f of ['jsonb_sin_economia', 'normalizar_cost_status_partidas', 'pin_product_versions_in_partidas', 'normalize_economics_on_cotizacion_write', 'pin_product_versions_on_cotizacion_write', 'strip_seller_economics_on_cotizacion_write']) {
    await x(defDeBaseline(f));
  }
  await x(leer('supabase/tests/fixtures/private_api_prod_20261013.sql'));
  // Wrappers públicos como los de producción (baseline/03_funciones.sql) y los CUATRO triggers.
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
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return await fn(); } finally { await db.exec(`select set_config('test.email', '', false)`); }
};
const rpc = async (db, email, sql, params) => como(db, email, async () => (await db.query(sql, params)).rows[0]);
const vistaDe = async (db, email, id) => (await rpc(db, email, 'select public.cotizacion_segura($1) as c', [id])).c;
// Guardado "viejo" (dos argumentos) y guardado con control optimista (tres).
const guardarViejo = (db, email, id, patch) => rpc(db, email, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify(patch)]);
const guardarCon = (db, email, id, patch, esperado) => rpc(db, email, 'select public.actualizar_cotizacion_segura($1, $2::jsonb, $3::timestamptz) as c', [id, JSON.stringify(patch), esperado]);
const filaCruda = async (db, id) => (await db.query('select cliente, partidas, total, piezas, actualizado from public.cotizaciones where id=$1', [id])).rows[0];

const PARTIDAS = [
  { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000, costoUnitario: 21000, margen: 30, costoDerivado: false, producto_version_id: 1933 },
  { id: 'p2', nombre: 'Silla operativa', cantidad: 6, precioUnitario: 3200, costoUnitario: 1400, margen: 35 },
];
async function sembrar(db, usuario = VENDEDOR) {
  const { id } = await rpc(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, partidas, total, piezas) values ($1, 'Tradeco', $2::jsonb, 67200, 7) returning id`,
    [usuario, JSON.stringify(PARTIDAS)]);
  return id;
}
// ¿Lanzó con SQLSTATE PT409 y el mensaje del contrato? Devuelve el error para inspeccionarlo.
async function esperarConflicto(promesa) {
  let err = null;
  try { await promesa; } catch (e) { err = e; }
  expect(err, 'debió lanzar').toBeTruthy();
  expect(err.code).toBe('PT409');
  expect(err.message).toMatch(/CONFLICTO_VERSION/);
  return err;
}
const isoDeDetail = (err) => /^actualizado=(.+)$/.exec(err.detail || '')?.[1] || null;

describe('VH-148 · ANTES (producción hoy): el último que escribe gana, en silencio', () => {
  let db;
  beforeAll(async () => { db = await baseAislada(); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('cotizacion_segura NO expone `actualizado` y la RPC pública sólo tiene la firma de dos argumentos', async () => {
    const id = await sembrar(db);
    const v = await vistaDe(db, VENDEDOR, id);
    expect(v.ok).toBe(true);
    expect(v).toHaveProperty('creado');
    expect(v).not.toHaveProperty('actualizado');
    await expect(guardarCon(db, VENDEDOR, id, { cliente: 'X' }, new Date().toISOString())).rejects.toThrow(/does not exist/);
  });

  it('dos pestañas: B pisa lo de A sin que nadie se entere (el defecto)', async () => {
    const id = await sembrar(db);
    const vA = await vistaDe(db, VENDEDOR, id), vB = await vistaDe(db, VENDEDOR, id);
    await guardarViejo(db, VENDEDOR, id, { cliente: 'Tradeco Norte', partidas: vA.partidas.map((p) => (p.id === 'p1' ? { ...p, cantidad: 3 } : p)) });
    const rB = await guardarViejo(db, VENDEDOR, id, { cliente: 'Tradeco Sur', partidas: vB.partidas });   // copia vieja
    expect(rB.c.ok).toBe(true);                                 // "guardado"…
    const f = await filaCruda(db, id);
    expect(f.cliente).toBe('Tradeco Sur');
    expect(f.partidas.find((p) => p.id === 'p1').cantidad).toBe(1);   // …y la cantidad 3 de A desapareció
  });
});

describe('VH-148 · DESPUÉS (PROPUESTA_vh148): la segunda edición detecta el conflicto y no escribe', () => {
  let db;
  beforeAll(async () => {
    db = await baseAislada();
    await db.exec(leer(MIGRACION));
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('cotizacion_segura expone `actualizado` (ISO con zona) a Dirección Y al vendedor; sigue sin economía para el vendedor', async () => {
    const id = await sembrar(db);
    const d = await vistaDe(db, DIRECCION, id), v = await vistaDe(db, VENDEDOR, id);
    expect(typeof d.actualizado).toBe('string');
    expect(d.actualizado).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$/);
    expect(Number.isNaN(Date.parse(d.actualizado))).toBe(false);
    expect(v.actualizado).toBe(d.actualizado);               // misma versión para los dos roles
    expect(v.partidas[0]).not.toHaveProperty('costoUnitario');
    expect(d.partidas[0].costoUnitario).toBe(21000);
    // La fecha que viaja es exactamente la de la fila (sin perder microsegundos).
    const { eq } = (await db.query('select (actualizado = $2::timestamptz) as eq from public.cotizaciones where id=$1', [id, d.actualizado])).rows[0];
    expect(eq).toBe(true);
  });

  it('dos pestañas: A guarda (ok, avanza `actualizado`); B con el esperado viejo → PT409 y NADA cambió; B recarga y guarda → ok', async () => {
    const id = await sembrar(db);
    const vA = await vistaDe(db, VENDEDOR, id), vB = await vistaDe(db, VENDEDOR, id);
    expect(vA.actualizado).toBe(vB.actualizado);

    // A guarda desde la versión que abrió.
    const rA = await guardarCon(db, VENDEDOR, id, { cliente: 'Tradeco Norte', partidas: vA.partidas.map((p) => (p.id === 'p1' ? { ...p, cantidad: 3 } : p)) }, vA.actualizado);
    expect(rA.c.ok).toBe(true);
    expect(rA.c.cliente).toBe('Tradeco Norte');
    expect(rA.c.actualizado).not.toBe(vA.actualizado);
    expect(new Date(rA.c.actualizado).getTime()).toBeGreaterThan(new Date(vA.actualizado).getTime());
    const trasA = await filaCruda(db, id);

    // B intenta guardar SU copia vieja con SU esperado (ya viejo).
    const err = await esperarConflicto(guardarCon(db, VENDEDOR, id, { cliente: 'Tradeco Sur', partidas: vB.partidas, total: 1 }, vB.actualizado));
    // El mensaje y el DETAIL traen el `actualizado` del servidor en el MISMO formato que cotizacion_segura.
    expect(err.message).toContain(rA.c.actualizado);
    expect(isoDeDetail(err)).toBe(rA.c.actualizado);
    expect(err.hint).toMatch(/cotizacion_segura/);
    // NADA cambió: cliente, partidas, total y actualizado son los que dejó A.
    const trasB = await filaCruda(db, id);
    expect(trasB).toEqual(trasA);
    expect(trasB.cliente).toBe('Tradeco Norte');
    expect(trasB.partidas.find((p) => p.id === 'p1').cantidad).toBe(3);

    // B recarga (o toma el actualizado del error) y vuelve a aplicar lo suyo: ahora sí.
    const vB2 = await vistaDe(db, VENDEDOR, id);
    expect(vB2.actualizado).toBe(rA.c.actualizado);
    const rB = await guardarCon(db, VENDEDOR, id, { cliente: 'Tradeco Sur' }, vB2.actualizado);
    expect(rB.c.ok).toBe(true);
    expect(rB.c.cliente).toBe('Tradeco Sur');
    expect((await filaCruda(db, id)).partidas.find((p) => p.id === 'p1').cantidad).toBe(3);   // lo de A sigue
    // Y el esperado del DETAIL del error también sirve tal cual (el cliente lo usa para "Volver a aplicar").
    const rB2 = await guardarCon(db, VENDEDOR, id, { cliente: 'Tradeco Sur 2' }, rB.c.actualizado);
    expect(rB2.c.ok).toBe(true);
    await esperarConflicto(guardarCon(db, VENDEDOR, id, { cliente: 'otra vez viejo' }, isoDeDetail(err)));
  });

  it('un esperado INVENTADO (futuro o pasado) también es conflicto: no basta con mandar cualquier fecha', async () => {
    const id = await sembrar(db);
    await esperarConflicto(guardarCon(db, VENDEDOR, id, { cliente: 'X' }, '2099-01-01T00:00:00+00:00'));
    await esperarConflicto(guardarCon(db, VENDEDOR, id, { cliente: 'X' }, '2000-01-01T00:00:00+00:00'));
    expect((await filaCruda(db, id)).cliente).toBe('Tradeco');
  });

  it('firma de DOS argumentos (clientes viejos): sigue guardando sin control, exactamente como hoy', async () => {
    const id = await sembrar(db);
    const v = await vistaDe(db, VENDEDOR, id);
    await guardarCon(db, VENDEDOR, id, { cliente: 'Tradeco Norte' }, v.actualizado);
    const r = await guardarViejo(db, VENDEDOR, id, { cliente: 'Tradeco Sur' });   // copia vieja, sin esperado
    expect(r.c.ok).toBe(true);
    expect(r.c.cliente).toBe('Tradeco Sur');
    expect(r.c).toHaveProperty('actualizado');                  // y ya devuelve la versión para el siguiente intento
  });

  it('p_actualizado_esperado = NULL explícito = sin control (misma semántica que la firma vieja)', async () => {
    const id = await sembrar(db);
    const v = await vistaDe(db, VENDEDOR, id);
    await guardarCon(db, VENDEDOR, id, { cliente: 'Tradeco Norte' }, v.actualizado);
    const r = await guardarCon(db, VENDEDOR, id, { cliente: 'Tradeco Sur' }, null);
    expect(r.c.ok).toBe(true);
    expect(r.c.cliente).toBe('Tradeco Sur');
  });

  it('Dirección también choca con el vendedor (y viceversa): el control es por fila, no por rol', async () => {
    const id = await sembrar(db);
    const vD = await vistaDe(db, DIRECCION, id), vV = await vistaDe(db, VENDEDOR, id);
    const rV = await guardarCon(db, VENDEDOR, id, { cliente: 'Lo del vendedor' }, vV.actualizado);
    expect(rV.c.ok).toBe(true);
    const trasV = await filaCruda(db, id);
    const err = await esperarConflicto(guardarCon(db, DIRECCION, id, { cliente: 'Lo de Dirección', partidas: vD.partidas.map((p) => ({ ...p, costoUnitario: 22500 })) }, vD.actualizado));
    const f = await filaCruda(db, id);
    expect(f).toEqual(trasV);                                   // no hubo escritura: ni el cliente ni el costo 22500 de Dirección entraron
    expect(f.cliente).toBe('Lo del vendedor');
    expect(f.partidas[0].costoUnitario).not.toBe(22500);
    // (que el guardado del vendedor haya borrado el 21000 de Dirección es VH-035 —producción hoy—, no este cambio)
    // Dirección vuelve a aplicar con el actualizado del error: ahora sí, con su economía.
    const rD = await guardarCon(db, DIRECCION, id, { partidas: vD.partidas.map((p) => ({ ...p, costoUnitario: 22500 })) }, isoDeDetail(err));
    expect(rD.c.partidas[0].costoUnitario).toBe(22500);
    // Y ahora el vendedor es el viejo.
    await esperarConflicto(guardarCon(db, VENDEDOR, id, { cliente: 'otra' }, rV.c.actualizado));
  });

  it('el trigger de strip sigue aplicando al vendedor en un guardado CON control (la migración no toca triggers)', async () => {
    const id = await sembrar(db);
    const v = await vistaDe(db, VENDEDOR, id);
    const r = await guardarCon(db, VENDEDOR, id, { partidas: v.partidas.map((p) => ({ ...p, cantidad: 9, costoUnitario: 1, margen: 99 })) }, v.actualizado);
    expect(r.c.ok).toBe(true);
    const d = await vistaDe(db, DIRECCION, id);
    expect(d.partidas[0].cantidad).toBe(9);
    expect(d.partidas[0]).not.toHaveProperty('costoUnitario'); // el 1 colado se strippeó (y la economía vieja se pierde: VH-035, fuera de este cambio)
    expect(d.partidas[0]).not.toHaveProperty('margen');
    // Diseño: puede editar config, también choca y también guarda con el esperado fresco.
    const err = await esperarConflicto(guardarCon(db, DISENO, id, { cliente: 'Diseño' }, v.actualizado));
    const rD = await guardarCon(db, DISENO, id, { cliente: 'Diseño' }, isoDeDetail(err));
    expect(rD.c.cliente).toBe('Diseño');
  });

  it('las demás protecciones siguen antes/después del control: sin acceso, no existe, estado protegido', async () => {
    const id = await sembrar(db, VENDEDOR);
    const v = await vistaDe(db, VENDEDOR, id);
    await expect(guardarCon(db, 'intruso@vh.mx', id, { cliente: 'X' }, v.actualizado)).rejects.toThrow(/no autorizado/);
    await expect(guardarCon(db, VENDEDOR, 999999, { cliente: 'X' }, v.actualizado)).rejects.toThrow(/no existe/);
    await expect(guardarCon(db, VENDEDOR, id, { estado: 'emitida' }, v.actualizado)).rejects.toThrow(/estado protegido/);
    // Un vendedor ajeno a la fila recibe 'sin acceso', NO 'conflicto' (no se le revela la versión).
    await db.exec(`insert into public.permitidos(email, rol) values ('ventas2@vh.mx','vendedor') on conflict do nothing`);
    await expect(guardarCon(db, 'ventas2@vh.mx', id, { cliente: 'X' }, '2000-01-01T00:00:00+00:00')).rejects.toThrow(/sin acceso/);
    expect((await filaCruda(db, id)).cliente).toBe('Tradeco');
  });

  it('el wrapper público de tres argumentos exige sesión (auth.uid()) igual que el de dos', async () => {
    const id = await sembrar(db);
    await expect(db.query('select public.actualizar_cotizacion_segura($1, $2::jsonb, $3::timestamptz)', [id, '{}', new Date().toISOString()])).rejects.toThrow(/no autenticado/);
    await expect(db.query('select public.actualizar_cotizacion_segura($1, $2::jsonb)', [id, '{}'])).rejects.toThrow(/no autenticado/);
  });

  it('permisos: authenticated y service_role ejecutan la sobrecarga nueva; anon no', async () => {
    const q = (rol) => db.query(`select has_function_privilege($1, 'public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)', 'execute') as ok`, [rol]);
    expect((await q('authenticated')).rows[0].ok).toBe(true);
    expect((await q('service_role')).rows[0].ok).toBe(true);
    expect((await q('anon')).rows[0].ok).toBe(false);
  });
});

describe('VH-148 · ROLLBACK: el bloque del archivo devuelve la base a producción', () => {
  let db;
  beforeAll(async () => {
    db = await baseAislada();
    await db.exec(leer(MIGRACION));
    await db.exec(sqlRollback());
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('la firma de tres argumentos desaparece, la de dos sigue guardando y cotizacion_segura vuelve a ser la de producción', async () => {
    const id = await sembrar(db);
    const v = await vistaDe(db, VENDEDOR, id);
    expect(v.ok).toBe(true);
    expect(v).not.toHaveProperty('actualizado');
    await expect(guardarCon(db, VENDEDOR, id, { cliente: 'X' }, new Date().toISOString())).rejects.toThrow(/does not exist/);
    const r = await guardarViejo(db, VENDEDOR, id, { cliente: 'Tradeco Sur' });
    expect(r.c.ok).toBe(true);
    expect((await filaCruda(db, id)).cliente).toBe('Tradeco Sur');
    // Cuerpo privado: exactamente una función con ese nombre (sin sobrecargas huérfanas).
    const { n } = (await db.query(`select count(*)::int as n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='private_api' and p.proname='actualizar_cotizacion_segura'`)).rows[0];
    expect(n).toBe(1);
  });
});
