// ============================================================================
//  P0-01 · REVENTA DE CATÁLOGO emite a precio de lista cuando NO hay costo interno.
//  PGlite = PostgreSQL real en WASM, en memoria. Carga el gate de emisión EXACTO de la
//  PROPUESTA y prueba, con SQL real, que:
//    1) catálogo sin costo + política ON + precio ≥ piso ........ ALLOWED (reventa)
//    2) catálogo sin costo + política ON + precio < piso ........ APPROVAL_REQUIRED (precio_bajo_piso)
//    3) catálogo sin costo + política OFF ....................... ECONOMICS_INCOMPLETE (conducta previa intacta)
//    4) producto CON costo + buen margen ....................... ALLOWED (ruta normal, no rota)
//    5) producto CON costo + margen bajo ....................... APPROVAL_REQUIRED (margen_bajo) (ruta normal, no rota)
//  Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');

// Cuerpo EXACTO del gate desde la PROPUESTA (de `create or replace function` al primer `$function$;`).
function defGate() {
  const sql = leer('supabase/migrations/PROPUESTA_p0_01_reventa_emite_sin_costo.sql');
  const ini = sql.indexOf('create or replace function private_api.evaluar_emision_cotizacion(');
  if (ini < 0) throw new Error('no está evaluar_emision_cotizacion en la PROPUESTA');
  const fin = sql.indexOf('$function$;', ini);
  if (fin < 0) throw new Error('no cierra $function$;');
  return sql.slice(ini, fin + '$function$;'.length);
}

const DIRECCION = 'rodrigo@vh.mx';

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

    create table public.cotizaciones (id bigserial primary key, usuario text, partidas jsonb not null default '[]'::jsonb);
    create table public.productos (id bigint primary key, source_type text not null, activo boolean not null default true);
    create table public.producto_versiones (id bigint primary key, producto_id bigint not null, estado_tecnico text not null default 'certificado');
    create table public.producto_version_economia (producto_version_id bigint primary key, costo_oficial_referencia numeric);
    create table public.lista_precio_items (id bigint primary key, producto_id bigint not null, producto_version_id bigint, precio_lista numeric not null, piso_minimo numeric, vigencia_hasta date);
    create table public.reglas_comerciales (id bigserial primary key, version int not null, margen_minimo_pct numeric, estado text not null default 'approved',
      vigencia_desde date not null default current_date, vigencia_hasta date, reventa_emite_sin_costo boolean not null default true);

    -- A: catálogo banco SIN economía. B: catálogo línea CON costo 19500.
    insert into public.productos values (1,'banco',true), (2,'linea',true);
    insert into public.producto_versiones values (1933,1,'certificado'), (2044,2,'certificado');
    insert into public.producto_version_economia values (2044, 19500);     -- sólo B tiene costo
    insert into public.lista_precio_items values
      (10, 1, 1933, 48000, 40000, null),   -- A: lista 48000, piso 40000
      (20, 2, 2044, 48000, 40000, null);   -- B: lista 48000, piso 40000
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

// Arma una cotización de una línea y devuelve el estado del gate.
async function emitir(db, { producto_id, producto_version_id, precio, nombre }) {
  const partida = { id: 'L1', nombre, producto_id, producto_version_id, cantidad: 1, precioUnitario: precio };
  const snap = { partidas: [partida] };
  await db.exec(`set test.email='${DIRECCION}'`);
  await db.query(`insert into public.cotizaciones(id, usuario, partidas) values (777, '${DIRECCION}', $1::jsonb)
                  on conflict (id) do update set partidas=excluded.partidas`, [JSON.stringify([partida])]);
  const r = await db.query(`select private_api.evaluar_emision_cotizacion(777, $1::jsonb) as g`, [JSON.stringify(snap)]);
  return r.rows[0].g;
}

describe('P0-01 reventa de catálogo emite a precio de lista sin costo interno', () => {
  it('1) política ON · catálogo sin costo · precio ≥ piso ⇒ ALLOWED (reventa)', async () => {
    const db = await base({ reventaPolicy: true });
    const g = await emitir(db, { producto_id: 1, producto_version_id: 1933, precio: 45000, nombre: 'Banca App LT' });
    expect(g.state).toBe('ALLOWED');
    await db.close();
  });

  it('2) política ON · catálogo sin costo · precio < piso ⇒ APPROVAL_REQUIRED (precio_bajo_piso)', async () => {
    const db = await base({ reventaPolicy: true });
    const g = await emitir(db, { producto_id: 1, producto_version_id: 1933, precio: 38000, nombre: 'Banca App LT' });
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(JSON.stringify(g.reasons)).toContain('precio_bajo_piso');
    await db.close();
  });

  it('3) política OFF · catálogo sin costo ⇒ ECONOMICS_INCOMPLETE (conducta previa intacta)', async () => {
    const db = await base({ reventaPolicy: false });
    const g = await emitir(db, { producto_id: 1, producto_version_id: 1933, precio: 45000, nombre: 'Banca App LT' });
    expect(g.state).toBe('ECONOMICS_INCOMPLETE');
    expect(JSON.stringify(g.reasons)).toContain('costo_productversion_desconocido');
    await db.close();
  });

  it('4) producto CON costo · buen margen ⇒ ALLOWED (ruta normal, no rota)', async () => {
    const db = await base({ reventaPolicy: true });
    const g = await emitir(db, { producto_id: 2, producto_version_id: 2044, precio: 48000, nombre: 'Archivero' });
    expect(g.state).toBe('ALLOWED');
    await db.close();
  });

  it('5) producto CON costo · margen bajo ⇒ APPROVAL_REQUIRED (margen_bajo) (ruta normal, no rota)', async () => {
    const db = await base({ reventaPolicy: true });
    const g = await emitir(db, { producto_id: 2, producto_version_id: 2044, precio: 24000, nombre: 'Archivero' });
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(JSON.stringify(g.reasons)).toMatch(/margen_bajo/);
    await db.close();
  });

  it('6) reventa ON pero producto CON costo usa ruta de costo (no reventa): margen bajo ⇒ APPROVAL_REQUIRED', async () => {
    // Prueba que la rama de reventa NO secuestra a un producto que sí tiene costo.
    const db = await base({ reventaPolicy: true });
    const g = await emitir(db, { producto_id: 2, producto_version_id: 2044, precio: 20000, nombre: 'Archivero' });
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(JSON.stringify(g.reasons)).toMatch(/margen_bajo|precio_bajo_costo/);
    await db.close();
  });
});
