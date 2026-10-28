// ============================================================================
//  puede_certificar_costo() EXCLUYE cuentas_no_humanas (migración PROPUESTA_puede_certificar_costo_excluye_no_humanas.sql).
//  PGlite = PostgreSQL real. Prueba con SQL real que una cuenta de proceso/QA con rol 'direccion'
//  NO puede certificar costo, y un humano de Dirección sí. Nada toca producción.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');

function defFuncion() {
  const sql = leer('supabase/migrations/PROPUESTA_puede_certificar_costo_excluye_no_humanas.sql');
  const ini = sql.indexOf('create or replace function public.puede_certificar_costo()');
  const fin = sql.indexOf('$function$;', ini);
  return sql.slice(ini, fin + '$function$;'.length);
}

async function base() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when current_setting('test.email', true) in ('', null) then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, rol text not null default 'vendedor');
    create table public.cuentas_no_humanas (email text primary key);
    insert into public.permitidos(email, rol) values
      ('rodrigo@vh.mx','direccion'),
      ('qa-direccion@vh.mx','direccion'),
      ('vendedor@vh.mx','vendedor');
    insert into public.cuentas_no_humanas(email) values ('qa-direccion@vh.mx');
  `);
  await db.exec(defFuncion());
  return db;
}

async function puede(db, email) {
  await db.exec(email ? `set test.email='${email}'` : `set test.email=''`);
  const r = await db.query(`select public.puede_certificar_costo() as ok`);
  return r.rows[0].ok;
}

describe('puede_certificar_costo excluye cuentas no-humanas', () => {
  it('humano de Dirección ⇒ true', async () => {
    const db = await base();
    expect(await puede(db, 'rodrigo@vh.mx')).toBe(true);
    await db.close();
  });
  it('cuenta de proceso/QA con rol direccion PERO en cuentas_no_humanas ⇒ false (cierra la grieta)', async () => {
    const db = await base();
    expect(await puede(db, 'qa-direccion@vh.mx')).toBe(false);
    await db.close();
  });
  it('vendedor ⇒ false; sin sesión ⇒ false', async () => {
    const db = await base();
    expect(await puede(db, 'vendedor@vh.mx')).toBe(false);
    expect(await puede(db, '')).toBe(false);
    await db.close();
  });
});
