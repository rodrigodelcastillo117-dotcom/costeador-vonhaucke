// ============================================================================
//  VH-AUD-205 (auditoría ChatGPT 2026-10-19) · la emisión de REVENTA valida contra el price item EXACTO.
//  PGlite = PostgreSQL real. Base = gate VIVO de hoy (fixture 2026-10-17 + SEG-01, igual que reventaEmiteSinCosto).
//  Adversarial: Producto X con Version A (lista 48 000, piso 40 000) y Version B (lista 60 000, piso 55 000).
//  Una cotización de la Version A JAMÁS se valida contra el item ni el piso de B.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const DIRECCION = 'rodrigo@vh.mx';

function defJsonbSinEconomia() {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf('CREATE OR REPLACE FUNCTION public.jsonb_sin_economia(');
  return sql.slice(ini, sql.indexOf('\n;\n', ini)) + ';';
}
// La PROPUESTA sin su precondición de md5 (PGlite no tiene el md5 de producción): índice + función.
function propuesta205() {
  const sql = leer('supabase/migrations/PROPUESTA_vhaud205_reventa_price_item_exacto.sql');
  const idx = sql.slice(sql.indexOf('create unique index'), sql.indexOf(';', sql.indexOf('create unique index')) + 1);
  const ini = sql.indexOf('create or replace function private_api.evaluar_emision_cotizacion(');
  const fin = sql.indexOf('$function$;', ini) + '$function$;'.length;
  return { idx, fn: sql.slice(ini, fin) };
}

async function base({ gate, indice = true, extra = '' }) {
  const db = new PGlite();
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema private_api;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when current_setting('test.email', true) in ('', null) then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, rol text not null default 'vendedor');
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion');
    create function private_api.rol_actual() returns text language sql stable as $$
      select lower(p.rol) from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') limit 1 $$;
    create function public.puede_entrar() returns boolean language sql stable as $$ select private_api.rol_actual() is not null $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    create table public.cotizaciones (id bigserial primary key, usuario text, partidas jsonb not null default '[]'::jsonb);
    create table public.productos (id bigint primary key, source_type text not null, activo boolean not null default true);
    create table public.producto_versiones (id bigint primary key, producto_id bigint not null, estado_tecnico text not null default 'certificado');
    create table public.producto_version_economia (producto_version_id bigint primary key, costo_oficial_referencia numeric);
    create table public.lista_precio_items (id bigint primary key, producto_id bigint not null, producto_version_id bigint, precio_lista numeric not null,
      piso_minimo numeric, vigencia_desde date, vigencia_hasta date);
    create table public.reglas_comerciales (id bigserial primary key, version int not null, margen_minimo_pct numeric, estado text not null default 'approved',
      vigencia_desde date not null default current_date, vigencia_hasta date, reventa_emite_sin_costo boolean not null default true);
    -- Producto X (banco, sin costo interno) con DOS versiones y un item vigente cada una.
    insert into public.productos values (1,'banco',true);
    insert into public.producto_versiones values (1933,1,'certificado'), (1934,1,'certificado');
    insert into public.lista_precio_items values
      (10, 1, 1933, 48000, 40000, null, null),   -- Version A
      (11, 1, 1934, 60000, 55000, null, null);   -- Version B (más cara, piso más alto)
    insert into public.reglas_comerciales(version, margen_minimo_pct, reventa_emite_sin_costo) values (1, 25, true);
    create function public.reglas_comerciales_vigentes(p_fecha date default current_date) returns jsonb
      language sql stable as $$ select to_jsonb(r) from public.reglas_comerciales r
        where r.estado='approved' and r.vigencia_desde<=p_fecha and (r.vigencia_hasta is null or r.vigencia_hasta>=p_fecha)
        order by r.version desc limit 1 $$;
    create function public.hash_revision(p jsonb) returns text language sql immutable as $$ select md5(p::text) $$;
    create function public.requiere_aprobacion_snapshot(p jsonb) returns boolean language sql immutable as $$ select false $$;
    create function public.verificar_aprobacion(p_cot bigint, p_hash text) returns jsonb language sql stable as $$ select jsonb_build_object('aprobada', false) $$;
    create function public.resolver_precio_especial_proyecto(p_producto_id bigint, p_version_id bigint, p_fecha date default current_date, p_moneda text default 'MXN')
      returns jsonb language sql stable as $$ select jsonb_build_object('ok', false, 'motivo', 'no_especial') $$;
  `);
  await x(defJsonbSinEconomia());
  await x(leer('supabase/tests/fixtures/private_api_emision_prod_20261017.sql'));
  await x(leer('supabase/migrations/PROPUESTA_seg01_emision_snapshot_fiel.sql'));   // = gate vivo de hoy
  if (gate === '205') { const p = propuesta205(); if (indice) await x(p.idx); await x(p.fn); }
  if (extra) await x(extra);
  return db;
}

async function gate(db, partida) {
  await db.exec(`set test.email='${DIRECCION}'`);
  await db.query(`insert into public.cotizaciones(id, usuario, partidas) values (900, '${DIRECCION}', $1::jsonb)
                  on conflict (id) do update set partidas=excluded.partidas`, [JSON.stringify([partida])]);
  return (await db.query(`select private_api.evaluar_emision_cotizacion(900, $1::jsonb) as g`, [JSON.stringify({ partidas: [partida] })])).rows[0].g;
}
const A = (precio, extra = {}) => ({ id: 'L1', nombre: 'Banca X', producto_id: 1, producto_version_id: 1933, cantidad: 1, precioUnitario: precio, ...extra });

describe('VH-AUD-205 · ROJO con el gate de hoy: la Version A se valida contra el item más caro (B)', () => {
  it('A a 45 000 (≥ piso de A) sale como "bajo piso" porque el gate usa el piso de B', async () => {
    const db = await base({ gate: 'hoy' });
    const g = await gate(db, A(45000));
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(JSON.stringify(g.reasons)).toContain('precio_bajo_piso');
    await db.close();
  });
});

describe('VH-AUD-205 · VERDE con la propuesta: price item exacto', () => {
  it('A + price item A (45 000 ≥ piso 40 000) ⇒ ALLOWED', async () => {
    const db = await base({ gate: '205' });
    expect((await gate(db, A(45000, { lista_precio_item_id: 10 }))).state).toBe('ALLOWED');
    await db.close();
  });
  it('A + price item B ⇒ BLOCKED (el item no es de esa versión)', async () => {
    const db = await base({ gate: '205' });
    const g = await gate(db, A(60000, { lista_precio_item_id: 11 }));
    expect(g.state).toBe('BLOCKED');
    expect(JSON.stringify(g.reasons)).toContain('linea_1_lista_precio_item_no_corresponde');
    await db.close();
  });
  it('A legacy sin item guardado: usa el ÚNICO item vigente de A; el piso de B no se usa', async () => {
    const db = await base({ gate: '205' });
    expect((await gate(db, A(45000))).state).toBe('ALLOWED');
    const bajo = await gate(db, A(39000));
    expect(bajo.state).toBe('APPROVAL_REQUIRED');
    expect(JSON.stringify(bajo.reasons)).toContain('precio_bajo_piso');
    await db.close();
  });
  it('legacy sin item y DOS items vigentes para la misma versión ⇒ BLOCKED precio_reventa_ambiguo (nunca "el más alto")', async () => {
    const db = await base({ gate: '205', indice: false, extra: `insert into public.lista_precio_items values (12, 1, 1933, 52000, 30000, null, null);` });
    const g = await gate(db, A(45000));
    expect(g.state).toBe('BLOCKED');
    expect(JSON.stringify(g.reasons)).toContain('precio_reventa_ambiguo');
    await db.close();
  });
  it('el índice único hace imposible un segundo item vigente para la misma versión', async () => {
    const db = await base({ gate: '205' });
    await expect(db.exec(`insert into public.lista_precio_items values (12, 1, 1933, 52000, 30000, null, null);`)).rejects.toThrow(/unique|duplicate/i);
    await db.close();
  });
  it('item vencido (vigencia_hasta) ⇒ no se usa: BLOCKED', async () => {
    const db = await base({ gate: '205', extra: `update public.lista_precio_items set vigencia_hasta = current_date - 1 where id = 10;` });
    expect((await gate(db, A(45000, { lista_precio_item_id: 10 }))).state).toBe('BLOCKED');
    await db.close();
  });
});
