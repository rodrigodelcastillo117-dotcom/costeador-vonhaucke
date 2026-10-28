// ============================================================================
//  REVENTA SIN PISO → APROBACIÓN (migración PROPUESTA_reventa_sin_piso_aprobacion.sql).
//  PGlite = PostgreSQL real en memoria. Carga el gate de la PROPUESTA y prueba, con SQL real:
//    NUEVO: catálogo reventa SIN piso ⇒ APPROVAL_REQUIRED (reventa_sin_piso), no ALLOWED silencioso.
//    Y que NO rompí las ramas copiadas de la función viva: piso ≥/<, política off, costo/margen,
//    y VH-AUD-205 (varios ítems de lista ⇒ ambiguo BLOCKED). Nada toca producción.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const DIRECCION = 'rodrigo@vh.mx';

function defGate() {
  const sql = leer('supabase/migrations/PROPUESTA_reventa_sin_piso_aprobacion.sql');
  const ini = sql.indexOf('create or replace function private_api.evaluar_emision_cotizacion(');
  if (ini < 0) throw new Error('no está evaluar_emision_cotizacion en la PROPUESTA');
  const fin = sql.indexOf('$function$;', ini);
  if (fin < 0) throw new Error('no cierra $function$;');
  return sql.slice(ini, fin + '$function$;'.length);
}

async function base({ reventaPolicy }) {
  const db = new PGlite();
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema private_api;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when current_setting('test.email', true) in ('', null) then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, rol text not null default 'vendedor');
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion');
    create function private_api.rol_actual() returns text language sql stable as $$
      select lower(p.rol) from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') limit 1 $$;
    create function public.puede_entrar() returns boolean language sql stable as $$ select private_api.rol_actual() is not null $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    -- SEG-01: stub sin discrepancias (snapshot == fila guardada en las pruebas de reventa).
    create function private_api.campos_partida_no_corresponden(a jsonb, b jsonb) returns text[] language sql immutable as $$ select '{}'::text[] $$;

    create table public.cotizaciones (id bigserial primary key, usuario text, partidas jsonb not null default '[]'::jsonb);
    create table public.productos (id bigint primary key, source_type text not null, activo boolean not null default true);
    create table public.producto_versiones (id bigint primary key, producto_id bigint not null, estado_tecnico text not null default 'certificado');
    create table public.producto_version_economia (producto_version_id bigint primary key, costo_oficial_referencia numeric);
    create table public.lista_precio_items (id bigint primary key, producto_id bigint not null, producto_version_id bigint, precio_lista numeric not null, piso_minimo numeric, vigencia_desde date, vigencia_hasta date);
    create table public.reglas_comerciales (id bigserial primary key, version int not null, margen_minimo_pct numeric, estado text not null default 'approved',
      vigencia_desde date not null default current_date, vigencia_hasta date, reventa_emite_sin_costo boolean not null default true);

    -- A: banco SIN costo, CON piso.  B: línea CON costo 19500.  C: banco SIN costo, SIN piso (caso nuevo).  D: banco con DOS ítems de lista (ambiguo).
    insert into public.productos values (1,'banco',true),(2,'linea',true),(3,'banco',true),(4,'banco',true);
    insert into public.producto_versiones values (1933,1,'certificado'),(2044,2,'certificado'),(3001,3,'certificado'),(4001,4,'certificado');
    insert into public.producto_version_economia values (2044, 19500);
    insert into public.lista_precio_items values
      (10, 1, 1933, 48000, 40000, null, null),   -- A: lista 48000, piso 40000
      (20, 2, 2044, 48000, 40000, null, null),   -- B: lista 48000, piso 40000
      (30, 3, 3001, 48000, null,  null, null),   -- C: lista 48000, SIN piso
      (40, 4, 4001, 48000, 40000, null, null),   -- D: dos ítems vigentes → ambiguo
      (41, 4, 4001, 50000, 42000, null, null);
    insert into public.reglas_comerciales(version, margen_minimo_pct, reventa_emite_sin_costo)
      values (1, 25, ${reventaPolicy ? 'true' : 'false'});

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
  await x(defGate());
  return db;
}

async function emitir(db, { producto_id, producto_version_id, precio, nombre }) {
  const partida = { id: 'L1', nombre, producto_id, producto_version_id, cantidad: 1, precioUnitario: precio };
  const snap = { partidas: [partida] };
  await db.exec(`set test.email='${DIRECCION}'`);
  await db.query(`insert into public.cotizaciones(id, usuario, partidas) values (777, '${DIRECCION}', $1::jsonb)
                  on conflict (id) do update set partidas=excluded.partidas`, [JSON.stringify([partida])]);
  const r = await db.query(`select private_api.evaluar_emision_cotizacion(777, $1::jsonb) as g`, [JSON.stringify(snap)]);
  return r.rows[0].g;
}

describe('reventa SIN piso exige aprobación (fix) y no rompe lo demás', () => {
  it('NUEVO · reventa sin costo y SIN piso ⇒ APPROVAL_REQUIRED (reventa_sin_piso), no ALLOWED', async () => {
    const db = await base({ reventaPolicy: true });
    const g = await emitir(db, { producto_id: 3, producto_version_id: 3001, precio: 45000, nombre: 'Banca sin piso' });
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(JSON.stringify(g.reasons)).toContain('reventa_sin_piso');
    await db.close();
  });

  it('reventa CON piso · precio ≥ piso ⇒ ALLOWED (sin cambio)', async () => {
    const db = await base({ reventaPolicy: true });
    const g = await emitir(db, { producto_id: 1, producto_version_id: 1933, precio: 45000, nombre: 'Banca App LT' });
    expect(g.state).toBe('ALLOWED');
    await db.close();
  });

  it('reventa CON piso · precio < piso ⇒ APPROVAL_REQUIRED (precio_bajo_piso) (sin cambio)', async () => {
    const db = await base({ reventaPolicy: true });
    const g = await emitir(db, { producto_id: 1, producto_version_id: 1933, precio: 38000, nombre: 'Banca App LT' });
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(JSON.stringify(g.reasons)).toContain('precio_bajo_piso');
    await db.close();
  });

  it('política OFF ⇒ ECONOMICS_INCOMPLETE (sin cambio), aun sin piso', async () => {
    const db = await base({ reventaPolicy: false });
    expect((await emitir(db, { producto_id: 1, producto_version_id: 1933, precio: 45000, nombre: 'A' })).state).toBe('ECONOMICS_INCOMPLETE');
    expect((await emitir(db, { producto_id: 3, producto_version_id: 3001, precio: 45000, nombre: 'C' })).state).toBe('ECONOMICS_INCOMPLETE');
    await db.close();
  });

  it('producto CON costo · buen margen ⇒ ALLOWED; margen bajo ⇒ APPROVAL (ruta de costo intacta)', async () => {
    const db = await base({ reventaPolicy: true });
    expect((await emitir(db, { producto_id: 2, producto_version_id: 2044, precio: 48000, nombre: 'Archivero' })).state).toBe('ALLOWED');
    const g = await emitir(db, { producto_id: 2, producto_version_id: 2044, precio: 24000, nombre: 'Archivero' });
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(JSON.stringify(g.reasons)).toMatch(/margen_bajo/);
    await db.close();
  });

  it('VH-AUD-205 · varios ítems de lista sin item id ⇒ BLOCKED precio_reventa_ambiguo (intacto)', async () => {
    const db = await base({ reventaPolicy: true });
    const g = await emitir(db, { producto_id: 4, producto_version_id: 4001, precio: 45000, nombre: 'Ambiguo' });
    expect(g.state).toBe('BLOCKED');
    expect(JSON.stringify(g.reasons)).toContain('precio_reventa_ambiguo');
    await db.close();
  });
});
