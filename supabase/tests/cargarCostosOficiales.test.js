// ============================================================================
//  VH-100 (P0-01) · `cargar_costos_oficiales` en base AISLADA (PGlite = PostgreSQL real en WASM).
//  Tablas con el DDL REAL del baseline (productos, producto_versiones, producto_version_economia) y la función
//  tal como está en la migración (NO aplicada en producción). Casos de la consulta de sólo lectura a producción
//  del 2026-10-13: códigos DUPLICADOS (ATOM3 = artículo ERP 433 + ficha "App LT · Omega" 1844) y el módulo de
//  12 usuarios (1898) SIN código. Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { tablaDeBaseline, como, fila, filas, leer, DIRECCION, VENDEDOR } from './fixtures/erpBaseAislada.js';

const MIG = process.env.VH100_MIG || 'supabase/migrations/PROPUESTA_vh100_cargar_costos_oficiales.sql';
const DISENO = 'diseno@vh.mx';
const QA = 'qa-direccion@vonhaucke.mx';
let db;
const economia = (pv) => fila(db, 'select costo_oficial_referencia::float8 as costo, formula_version, fuente from public.producto_version_economia where producto_version_id = $1', [pv]);
const cargar = (filasRpc) => fila(db, `select public.cargar_costos_oficiales('Reportes cotizador APP LT 12/08/2026', $1::jsonb) as r`, [JSON.stringify(filasRpc)]);

describe('VH-100 · carga de costo oficial por código (P0-01)', () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pgcrypto } });
    // Como en Supabase: pgcrypto vive en el esquema `extensions`, NO en public.
    await db.exec(`
      create schema auth; create schema private_api; create schema extensions;
      create extension if not exists pgcrypto with schema extensions;
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
      end $$;
      -- user_metadata lo edita el propio usuario (supabase.auth.updateUser); el test lo deja falsificar como en la vida real.
      -- FINAL-100 H4: el rol vive en el claim role del JWT (contrato vivo en prod: auth.jwt()->>role).
      -- auth.role() queda como LECTURA de ese mismo claim, sin divergir (sec02 B).
      create function auth.jwt() returns jsonb language sql stable as $$
        select case when coalesce(current_setting('test.email', true), '') = ''
          then jsonb_build_object('role', 'anon')
          else jsonb_build_object('email', current_setting('test.email', true), 'role', 'authenticated',
                                  'user_metadata', coalesce(nullif(current_setting('test.meta', true), ''), '{}')::jsonb) end $$;
      create function auth.role() returns text language sql stable as $$
        select auth.jwt() ->> 'role' $$;
      create table public.permitidos (email text primary key, rol text);
      insert into public.permitidos values ('${DIRECCION}', 'direccion'), ('${VENDEDOR}', 'vendedor'), ('${DISENO}', 'diseno'), ('${QA}', 'direccion');
      -- Tabla de SEG-01b (cuentas cuya firma no es humana), con la semilla real.
      create table public.cuentas_no_humanas (email text primary key, motivo text not null);
      insert into public.cuentas_no_humanas values ('${QA}', 'cuenta de pruebas QA');
      create function private_api.puede_editar_config() returns boolean language sql stable as $$
        select coalesce((select lower(rol) from public.permitidos where lower(email) = lower(auth.jwt()->>'email')) in ('direccion','diseno'), false) $$;
    `);
    for (const t of ['productos', 'producto_versiones', 'producto_version_economia']) await db.exec(tablaDeBaseline(t));
    // Estado medido en producción el 14-oct: authenticated TIENE insert/update/delete sobre la economía (pm_eco_all).
    await db.exec('grant select, insert, update, delete on public.producto_version_economia to authenticated');
    await db.exec(leer(MIG));
    // Muestra con los ids reales de producción (consulta de sólo lectura 2026-10-13).
    await db.exec(`
      insert into public.productos (id, codigo, nombre, source_type, activo, version_tecnica_vigente_id) overriding system value values
        (350, 'ATACM', 'CONDUCTO ACOMETIDA … ATACM', 'linea', true, 1668),
        (433, 'ATOM3', 'OMEGA PARA CUBIERTA DE 850 … ATOM3', 'linea', true, 1324),
        (1844, 'ATOM3', 'App LT · Omega', 'banco', true, 1578),
        (1898, null, 'Módulo operativo App LT 12 usuarios (biombo cristal)', 'banco', true, 1100);
      insert into public.producto_versiones (id, producto_id) overriding system value values (1668, 350), (1324, 433), (1578, 1844), (1100, 1898);
    `);
  });

  it('Dirección carga un código único con su procedencia (documento + hash + quién)', async () => {
    const { r } = await como(db, DIRECCION, () => cargar([{ codigo: 'ATACM', costo: 195.27, fecha: '2026-08-12', formula_version: 'direccion-2026-10-13' }]));
    expect(r).toMatchObject({ ok: true, cargados: 1, sin_producto: 0 });
    const e = await economia(1668);
    expect(e.costo).toBe(195.27);
    expect(e.fuente).toMatch(/Reportes cotizador APP LT 12\/08\/2026 · 2026-08-12 · sha256:[0-9a-f]{64} · direccion@vh\.mx/);
  });

  it('código DUPLICADO sin producto_id → se rechaza con los ids candidatos (no cae en uno al azar)', async () => {
    const { r } = await como(db, DIRECCION, () => cargar([{ codigo: 'ATOM3', costo: 75.29 }]));
    expect(r.cargados).toBe(0);
    expect(r.rechazadas).toEqual([{ codigo: 'ATOM3', motivo: 'CODIGO_DUPLICADO', productos: [433, 1844] }]);
    expect(await economia(1324)).toBeUndefined();
    expect(await economia(1578)).toBeUndefined();
  });

  it('código duplicado CON producto_id → carga sólo ese producto', async () => {
    const { r } = await como(db, DIRECCION, () => cargar([{ codigo: 'ATOM3', costo: 75.29, producto_id: 433 }]));
    expect(r.cargados).toBe(1);
    expect((await economia(1324)).costo).toBe(75.29);
    expect(await economia(1578)).toBeUndefined();
  });

  it('sin costo, costo ≤ 0, moneda distinta a MXN o código inexistente → rechazados, nada se inventa', async () => {
    const { r } = await como(db, DIRECCION, () => cargar([
      { codigo: 'ATACM' }, { codigo: 'ATACM', costo: 0 }, { codigo: 'ATACM', costo: 10, moneda: 'USD' }, { codigo: 'NOEXISTE', costo: 10 },
    ]));
    expect(r.cargados).toBe(0);
    expect(r.rechazadas.map((x) => x.motivo)).toEqual(['SIN_COSTO', 'SIN_COSTO', 'MONEDA_NO_MXN', 'SIN_PRODUCTO']);
    expect((await economia(1668)).costo).toBe(195.27);   // lo cargado antes no se tocó
  });

  it('el módulo de 12 usuarios (1898) no tiene código: la carga por código NO lo alcanza (su costo sale de componentes)', async () => {
    expect((await fila(db, 'select codigo from public.productos where id = 1898')).codigo).toBeNull();
    expect(await economia(1100)).toBeUndefined();
  });

  it('un vendedor no puede cargar costos', async () => {
    await expect(como(db, VENDEDOR, () => cargar([{ codigo: 'ATACM', costo: 1 }]))).rejects.toThrow(/sólo Dirección/);
    expect((await filas(db, 'select * from public.producto_version_economia'))).toHaveLength(2);
  });

  // ---------------- OP9.5-03 (14-oct): huecos de la versión anterior; estas pruebas FALLAN con ella ----------------
  it('un VENDEDOR que se pone rol "direccion" en su user_metadata NO carga costos (antes sí)', async () => {
    await db.exec(`select set_config('test.meta', '{"rol":"direccion"}', false)`);
    try {
      await expect(como(db, VENDEDOR, () => cargar([{ codigo: 'ATACM', costo: 1 }]))).rejects.toThrow(/sólo Dirección/);
    } finally { await db.exec(`select set_config('test.meta', '', false)`); }
    expect((await economia(1668)).costo).toBe(195.27);
  });

  it('Diseño no carga costos oficiales (antes entraba por puede_editar_config)', async () => {
    await expect(como(db, DISENO, () => cargar([{ codigo: 'ATACM', costo: 1 }]))).rejects.toThrow(/sólo Dirección/);
  });

  it('la cuenta QA (rol direccion en permitidos) NO carga costos oficiales: está en cuentas_no_humanas', async () => {
    await expect(como(db, QA, () => cargar([{ codigo: 'ATACM', costo: 1 }]))).rejects.toThrow(/cuenta no humana/);
    expect((await economia(1668)).costo).toBe(195.27);
  });

  it('sobrescribir un costo oficial deja la fila anterior en el historial (antes se perdía)', async () => {
    const { r } = await como(db, DIRECCION, () => cargar([{ codigo: 'ATACM', costo: 201.5, fecha: '2026-10-14' }]));
    expect(r.cargados).toBe(1);
    expect((await economia(1668)).costo).toBe(201.5);
    const h = await filas(db, 'select costo_anterior::float8 as c, reemplazado_por, documento_nuevo, fuente_anterior from public.producto_version_economia_historial where producto_version_id = 1668');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ c: 195.27, reemplazado_por: DIRECCION, documento_nuevo: 'Reportes cotizador APP LT 12/08/2026' });
    expect(h[0].fuente_anterior).toMatch(/2026-08-12/);
  });

  it('Dirección ya no puede escribir la economía oficial directo por PostgREST (sin procedencia); sí leerla', async () => {
    for (const p of ['INSERT', 'UPDATE', 'DELETE']) {
      expect((await fila(db, `select has_table_privilege('authenticated', 'public.producto_version_economia', $1) as ok`, [p])).ok, p).toBe(false);
    }
    expect((await fila(db, `select has_table_privilege('authenticated', 'public.producto_version_economia', 'SELECT') as ok`)).ok).toBe(true);
  });

  // Reauditoría v2 · P2-01: el SQL tiene una rama para service_role; su EXECUTE se concede explícito (en PGlite no hay
  // privilegios por omisión de Supabase: con el archivo anterior esto daba false).
  it('service_role puede ejecutar la carga (grant explícito); anon no', async () => {
    expect((await fila(db, `select has_function_privilege('service_role', 'public.cargar_costos_oficiales(text, jsonb)', 'execute') as ok`)).ok).toBe(true);
    expect((await fila(db, `select has_function_privilege('anon', 'public.cargar_costos_oficiales(text, jsonb)', 'execute') as ok`)).ok).toBe(false);
  });

  it('sin la tabla cuentas_no_humanas (SEG-01c sin aplicar) nadie carga: fail-closed', async () => {
    await db.exec('alter table public.cuentas_no_humanas rename to cnh_tmp');
    try {
      await expect(como(db, DIRECCION, () => cargar([{ codigo: 'ATACM', costo: 1 }]))).rejects.toThrow(/aplicar SEG-01c/);
    } finally { await db.exec('alter table public.cnh_tmp rename to cuentas_no_humanas'); }
  });
});
