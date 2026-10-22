// ============================================================================
//  SEC-02 · Contrato de permisos ANTES/DESPUÉS del cambio auth.role() -> auth.jwt()->>'role'
//  (PGlite = PostgreSQL real en WASM, en memoria. Nada toca producción.)
//
//  Qué prueba (patrón emissionExactCentsSql.test.js: ejecuta los CUERPOS de las
//  funciones en Postgres real):
//    1) EQUIVALENCIA de la expresión de rol: para cada JWT simulado, `auth.role()`
//       y `auth.jwt()->>'role'` dan el MISMO veredicto. Es la garantía de que el
//       refactor de la migración PROPUESTA_sec02 es *behavior-preserving*.
//    2) CONTRATO de autorización de las 3 funciones §B en su versión NUEVA
//       (cargadas desde supabase/migrations/PROPUESTA_sec02_search_path_authrole.sql):
//         - anon          -> DENY en las 3
//         - vendedor      -> DENY en las 3 (config/costos)
//         - diseño        -> ALLOW buscar/catalogo (capability), DENY cargar_costos (no es Dirección)
//         - dirección     -> ALLOW en las 3
//         - dir. no-humana-> ALLOW buscar/catalogo, DENY cargar_costos (cuentas_no_humanas)
//         - service_role  -> ALLOW en las 3 (la rama que hoy depende de auth.role()='service_role')
//    3) ANTES ≡ DESPUÉS: se carga también la variante con auth.role() y se verifica
//       que su veredicto coincide con la nueva en TODOS los escenarios.
//
//  Harness fiel a Supabase: auth.jwt() y auth.role() LEEN el mismo GUC real
//  `request.jwt.claims` (auth.role() con el fallback documentado a .claim.role),
//  de modo que probar la equivalencia es comparar dos rutas de código sobre la
//  MISMA fuente — no un mock trucado para que coincidan.
//
//  Aislamiento: el gate de autorización corre PRIMERO en las 3 funciones; DENY
//  lanza de inmediato y ALLOW se demuestra por cortocircuito (buscar con q=''
//  devuelve '[]'; catalogo llama a un stub de private_api.catalogo_motor;
//  cargar con documento='' pasa el gate y falla luego con 'documento requerido').
//  Así el contrato se prueba sin pgcrypto ni el esquema completo de costos.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const MIGRACION = new URL('../../supabase/migrations/PROPUESTA_sec02_search_path_authrole.sql', import.meta.url);

// --- extraer una función public.<nombre>(...) completa de la migración (hasta $function$;) ---
function extraerFuncion(sql, nombre) {
  const marca = `CREATE OR REPLACE FUNCTION public.${nombre}(`;
  const ini = sql.indexOf(marca);
  if (ini < 0) throw new Error(`no está public.${nombre} en la migración`);
  const cierre = '$function$;';
  const fin = sql.indexOf(cierre, ini);
  if (fin < 0) throw new Error(`sin cierre $function$; para ${nombre}`);
  return sql.slice(ini, fin + cierre.length);
}
// renombra solo la cabecera CREATE (los cuerpos no se auto-referencian)
const renombrar = (def, nombre, sufijo) => def.replace(`public.${nombre}(`, `public.${nombre}${sufijo}(`);
// deriva la variante ANTES (auth.jwt()->>'role'  ->  auth.role())
const aAntes = (def) => def.replace(/auth\.jwt\(\)\s*->>\s*'role'/g, "auth.role()");

const FUNCS = ['buscar_insumos_motor', 'catalogo_motor', 'cargar_costos_oficiales'];

// Escenarios: claims del JWT (lo que PostgREST pone en request.jwt.claims).
const ESCENARIOS = {
  anon:          null,                                                   // sin sesión
  anon_explicito:{ role: 'anon' },                                       // anónimo explícito
  vendedor:      { role: 'authenticated', email: 'ventas@vh.mx' },
  diseno:        { role: 'authenticated', email: 'diseno@vh.mx' },
  direccion:     { role: 'authenticated', email: 'direccion@vh.mx' },
  direccion_qa:  { role: 'authenticated', email: 'qa@vh.mx' },           // rol direccion PERO cuenta no humana
  service_role:  { role: 'service_role' },                               // la Edge
};

// Contrato esperado por función (ALLOW = pasa el gate; DENY = lo rechaza el gate).
const ESPERADO = {
  buscar_insumos_motor: { anon:'DENY', anon_explicito:'DENY', vendedor:'DENY', diseno:'ALLOW', direccion:'ALLOW', direccion_qa:'ALLOW', service_role:'ALLOW' },
  catalogo_motor:       { anon:'DENY', anon_explicito:'DENY', vendedor:'DENY', diseno:'ALLOW', direccion:'ALLOW', direccion_qa:'ALLOW', service_role:'ALLOW' },
  cargar_costos_oficiales:{ anon:'DENY', anon_explicito:'DENY', vendedor:'DENY', diseno:'DENY', direccion:'ALLOW', direccion_qa:'DENY', service_role:'ALLOW' },
};

let db;

async function conClaims(claims, fn) {
  const val = claims == null ? '' : JSON.stringify(claims);
  await db.exec(`select set_config('request.jwt.claims', ${literal(val)}, false)`);
  try { return await fn(); }
  finally { await db.exec(`select set_config('request.jwt.claims', '', false)`); }
}
const literal = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Clasifica el resultado de llamar una función: DENY si el gate lanza su error de
// autorización; ALLOW si devuelve o si falla por una razón POSTERIOR al gate.
function esDeny(msg) {
  const m = (msg || '').toLowerCase();
  return m.includes('no autorizado') || m.includes('sólo direcci') || m.includes('solo direcci') || m.includes('no humana');
}
async function veredicto(nombre, sufijo) {
  const llamada = {
    buscar_insumos_motor:    `select public.buscar_insumos_motor${sufijo}('', 30)`,
    catalogo_motor:          `select public.catalogo_motor${sufijo}(false, null)`,
    cargar_costos_oficiales: `select public.cargar_costos_oficiales${sufijo}('', '[]'::jsonb)`,
  }[nombre];
  try { await db.query(llamada); return 'ALLOW'; }       // devolvió => pasó el gate
  catch (e) { return esDeny(e.message) ? 'DENY' : 'ALLOW'; }
}

describe('SEC-02 · permisos auth.role() -> auth.jwt()->>\'role\' (PGlite)', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create schema if not exists auth;
      create schema if not exists private_api;
      create schema if not exists extensions;
      do $$ begin
        if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
        if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      end $$;

      -- auth FIEL a Supabase: ambos leen el mismo GUC real request.jwt.claims.
      create function auth.jwt() returns jsonb language sql stable as $$
        select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
      create function auth.role() returns text language sql stable as $$
        select coalesce(
          nullif(current_setting('request.jwt.claim.role', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
        ) $$;
      create function auth.uid() returns uuid language sql stable as $$
        select case when coalesce(auth.jwt()->>'email','') = '' then null
          else md5(auth.jwt()->>'email')::uuid end $$;

      -- Identidad/capacidad vigente: permitidos + rol_actual + puede_editar_config.
      create table public.permitidos (email text primary key, rol text not null default 'vendedor');
      insert into public.permitidos values
        ('direccion@vh.mx','direccion'), ('diseno@vh.mx','diseno'),
        ('ventas@vh.mx','vendedor'), ('qa@vh.mx','direccion');
      create function private_api.rol_actual() returns text language sql stable as $$
        select lower(p.rol) from public.permitidos p
         where lower(p.email) = lower(coalesce(auth.jwt()->>'email','')) limit 1 $$;
      -- Forma EXISTS igual que producción (devuelve false, nunca null, para el anónimo).
      create function private_api.puede_editar_config() returns boolean language sql stable as $$
        select exists (select 1 from public.permitidos
          where lower(email) = lower(coalesce(auth.jwt()->>'email','')) and rol in ('direccion','diseno')) $$;

      -- SEG-01c: lista explícita de cuentas NO humanas (QA/procesos).
      create table public.cuentas_no_humanas (email text primary key, motivo text);
      insert into public.cuentas_no_humanas values ('qa@vh.mx','pruebas QA');

      -- Stubs mínimos para el camino ALLOW (no son SQL de producción):
      create function private_api.catalogo_motor(p_incluir_erp boolean, p_ids text[])
        returns jsonb language sql stable as $$ select '[]'::jsonb $$;
      create table public.insumos_catalogo (id text, nombre text, activo boolean, clasificacion text);
      create table public.catalogo_vigente (insumo_id text, vigente_desde date);
    `);

    const sql = readFileSync(MIGRACION, 'utf8');
    for (const nombre of FUNCS) {
      const despues = extraerFuncion(sql, nombre);           // versión NUEVA (auth.jwt()->>'role')
      const antes = aAntes(despues);                         // versión vieja (auth.role())
      await db.exec(renombrar(despues, nombre, '_despues'));
      await db.exec(renombrar(antes, nombre, '_antes'));
    }
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  // --- (1) equivalencia de la expresión de rol en cada escenario ---
  it('auth.role() y auth.jwt()->>\'role\' coinciden en todos los escenarios', async () => {
    for (const [nombre, claims] of Object.entries(ESCENARIOS)) {
      await conClaims(claims, async () => {
        const { rows } = await db.query(`select auth.role() as r, auth.jwt()->>'role' as j`);
        const { r, j } = rows[0];
        expect(r ?? null, `role() vs jwt->>role en ${nombre}`).toBe(j ?? null);
      });
    }
  });

  // --- (2) contrato de autorización de la versión NUEVA ---
  for (const nombre of FUNCS) {
    it(`[DESPUÉS] contrato de ${nombre}`, async () => {
      for (const [esc, claims] of Object.entries(ESCENARIOS)) {
        const got = await conClaims(claims, () => veredicto(nombre, '_despues'));
        expect(got, `${nombre} / ${esc}`).toBe(ESPERADO[nombre][esc]);
      }
    });
  }

  // --- (3) ANTES ≡ DESPUÉS: el refactor no cambia ningún veredicto ---
  for (const nombre of FUNCS) {
    it(`[ANTES≡DESPUÉS] ${nombre} da el mismo veredicto con auth.role() que con auth.jwt()->>'role'`, async () => {
      for (const [esc, claims] of Object.entries(ESCENARIOS)) {
        const [antes, despues] = await conClaims(claims, async () =>
          [await veredicto(nombre, '_antes'), await veredicto(nombre, '_despues')]);
        expect(antes, `ANTES ${nombre}/${esc}`).toBe(despues);
      }
    });
  }

  // --- (4) centinela: la versión NUEVA no contiene auth.role() y la vieja sí ---
  it('la migración reemplaza auth.role() por auth.jwt()->>\'role\' en las 3 funciones', () => {
    const sql = readFileSync(MIGRACION, 'utf8');
    const sinComentarios = (def) => def.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
    for (const nombre of FUNCS) {
      const codigo = sinComentarios(extraerFuncion(sql, nombre)); // ignora comentarios -- ...
      expect(codigo, `${nombre} aún usa auth.role() en código`).not.toMatch(/auth\.role\(\)/);
      expect(codigo, `${nombre} debe usar auth.jwt()->>'role'`).toMatch(/auth\.jwt\(\)\s*->>\s*'role'/);
    }
  });
});
