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
import { tablaDeBaseline, funcionDeMigracion, como, fila, filas, DIRECCION, VENDEDOR } from './fixtures/erpBaseAislada.js';

const MIG = 'supabase/migrations/20261012061000_vh100_cargar_costos_oficiales.sql';
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
      end $$;
      create function auth.jwt() returns jsonb language sql stable as $$
        select case when coalesce(current_setting('test.email', true), '') = '' then null
          else jsonb_build_object('email', current_setting('test.email', true)) end $$;
      create function auth.role() returns text language sql stable as $$
        select case when coalesce(current_setting('test.email', true), '') = '' then 'anon' else 'authenticated' end $$;
      create table public.permitidos (email text primary key, rol text);
      insert into public.permitidos values ('${DIRECCION}', 'direccion'), ('${VENDEDOR}', 'vendedor');
      create function private_api.puede_editar_config() returns boolean language sql stable as $$
        select coalesce((select lower(rol) from public.permitidos where lower(email) = lower(auth.jwt()->>'email')) in ('direccion','diseno'), false) $$;
    `);
    for (const t of ['productos', 'producto_versiones', 'producto_version_economia']) await db.exec(tablaDeBaseline(t));
    await db.exec(funcionDeMigracion(MIG, 'public.cargar_costos_oficiales'));
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
    expect(e.fuente).toMatch(/Reportes cotizador APP LT 12\/08\/2026 · 2026-08-12 · sha256:[0-9a-f]{16} · direccion@vh\.mx/);
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
});
