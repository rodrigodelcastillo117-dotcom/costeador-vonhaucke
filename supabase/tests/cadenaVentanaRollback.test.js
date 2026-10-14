// ============================================================================
//  RUNBOOK §4–§5 · CADENA COMPLETA DE LA VENTANA Y SU ROLLBACK (PGlite = PostgreSQL real en WASM).
//
//  Base = producción del 14-oct (baseline + cuerpos de producción + VH-035c + catálogo VH-088 + `cuentas_no_humanas`
//  de la firma de precios, con los grants reales de `producto_version_economia`). Se aplican las 6 propuestas EN EL ORDEN
//  DEL RUNBOOK (P1-03b → VH-148 → VH-148b → SEG-01 → SEG-01c → VH-100) y luego sus rollbacks EN ORDEN INVERSO
//  (VH-100 → SEG-01c → SEG-01 → VH-148b → VH-148 → P1-03b), cada uno con el texto que trae su propio archivo.
//
//  Se compara el catálogo de la base antes y después: funciones (md5 de la definición + ACL), triggers, vistas,
//  tablas/columnas, ACL de tablas y políticas. Lo único que puede quedar es lo que el runbook declara que se CONSERVA
//  porque es auditoría o datos (RESIDUO_DECLARADO); cualquier otra diferencia hace fallar la prueba. Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VH148, VH148B, SEG01, SEG01C, leer, baseProduccion, rollbackDe } from './helpers/baseVh148b.js';
import { tablaDeBaseline, vistaCatalogoVigenteProduccion, funcionDeMigracion, privateApiDeBaseline } from './fixtures/erpBaseAislada.js';

const P103B = 'supabase/migrations/PROPUESTA_p103b_precio_id_en_catalogo.sql';
const VH100 = 'supabase/migrations/PROPUESTA_vh100_cargar_costos_oficiales.sql';
const VH088 = 'supabase/migrations/20261012043000_vh088_catalogo_motor.sql';

function bloque(archivo, etiqueta) {
  const sql = leer(archivo);
  const ini = sql.indexOf(`-- >>> ROLLBACK ${etiqueta} INICIO`); const fin = sql.indexOf(`-- <<< ROLLBACK ${etiqueta} FIN`);
  if (ini < 0 || fin < 0) throw new Error(`${archivo} no trae el bloque de rollback ${etiqueta}`);
  return sql.slice(ini, fin);
}
// El orden del runbook (§4) y su rollback (§5.4). Cada rollback sale del propio archivo, tal cual.
const VENTANA = [
  { id: 'P1-03b', aplicar: P103B, revertir: () => rollbackDe(P103B) },
  { id: 'VH-148', aplicar: VH148, revertir: () => bloque(VH148, 'VH-148') },
  { id: 'VH-148b', aplicar: VH148B, revertir: () => rollbackDe(VH148B) },
  { id: 'SEG-01', aplicar: SEG01, revertir: () => bloque(SEG01, 'SEG-01') },
  { id: 'SEG-01c', aplicar: SEG01C, revertir: () => rollbackDe(SEG01C) },
  { id: 'VH-100', aplicar: VH100, revertir: () => rollbackDe(VH100) },
];
// Lo que el rollback CONSERVA a propósito (§5.4): tablas de auditoría y datos. Nada de funciones, grants de ejecución,
// triggers, vistas ni políticas.
const RESIDUO_DECLARADO = [
  ...['costeos_servidor', 'partida_costeo_vigente', 'producto_version_economia_historial'].map((t) =>
    new RegExp(`^((acl |rls |opciones |comentario )?tabla public\\.${t}( .*)?|(comentario|opciones) public\\.${t} .*|columna public\\.${t}\\..*)$`)),
];

async function baseVentana() {
  const db = await baseProduccion();
  await db.exec(tablaDeBaseline('insumos_catalogo'));
  await db.exec(tablaDeBaseline('insumo_precios'));
  await db.exec(vistaCatalogoVigenteProduccion());
  await db.exec(funcionDeMigracion(VH088, 'private_api.insumo_motor'));
  await db.exec(funcionDeMigracion(VH088, 'private_api.catalogo_motor'));
  await db.exec(privateApiDeBaseline('resolver_costo_insumo'));
  await db.exec(`create table public.config (id text primary key, datos jsonb, actualizado timestamptz default now());
    insert into public.config(id, datos) values ('vonhaucke', '{"parametros": {"tarifaMO": 95, "gif": 0.35}}'::jsonb);
    -- producción 14-oct: authenticated escribe producto_version_economia directo (lo que VH-100 cierra); anon nada.
    grant delete, insert, references, select, trigger, truncate, update on table public.producto_version_economia to authenticated, service_role;
    insert into public.producto_version_economia values (1, 1234.50), (2, 999);
    -- producción 14-oct (20261014140000_firma_precios_erp_direccion): cuentas_no_humanas ya existe.
    create table if not exists public.cuentas_no_humanas (email text primary key, motivo text not null, registrado_en timestamptz not null default now());
    alter table public.cuentas_no_humanas enable row level security;
    revoke all on table public.cuentas_no_humanas from public, anon, authenticated;
    grant all on table public.cuentas_no_humanas to service_role;   -- producción: service_role=arwdDxtm (privilegios por omisión)
    insert into public.cuentas_no_humanas(email, motivo) values ('qa-direccion@vonhaucke.mx', 'cuenta de pruebas QA (rol direccion en permitidos)'),
      ('reconciliacion', 'proceso automático de reconciliación') on conflict (email) do nothing;
    -- ACL de producción medidos el 14-oct (pg_proc.proacl / pg_class.relacl), para que el rollback se compare contra ellos.
    revoke all on function public.vincular_cotizacion(bigint, bigint, bigint, bigint) from public;
    grant execute on function public.vincular_cotizacion(bigint, bigint, bigint, bigint) to authenticated, service_role;
    revoke all on function private_api.vincular_cotizacion(bigint, bigint, bigint, bigint) from public;
    grant execute on function private_api.vincular_cotizacion(bigint, bigint, bigint, bigint) to authenticated, service_role;
    revoke all on table public.catalogo_vigente from public, anon, authenticated, service_role;
    grant all on table public.catalogo_vigente to service_role;
    grant all on table public.catalogo_vigente to authenticated;
    revoke select on table public.catalogo_vigente from authenticated;
    COMMENT ON VIEW public.catalogo_vigente IS 'LEGACY_COMPATIBILITY_VIEW: rn=1 puede desempatar arbitrariamente. NO es autoridad de CertifiedCostSnapshot. Usar resolve_canonical_price().';`);
  return db;
}

// Un ACL `{a=X/o,b=X/o}` sin importar el orden de las entradas (GRANT/REVOKE en otro orden da el mismo permiso).
const acl = (t) => (t == null || t === '-' ? '-' : `{${String(t).replace(/^\{|\}$/g, '').split(',').sort().join(',')}}`);
// Catálogo comparable de la base: un conjunto de renglones "tipo nombre → valor".
async function catalogo(db) {
  const r = async (sql) => (await db.query(sql)).rows;
  const filas = [];
  for (const f of await r(`select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as k,
      md5(pg_get_functiondef(p.oid)) as m, coalesce(p.proacl::text, '-') as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private_api') and p.prokind = 'f'`)) {
    filas.push(`funcion ${f.k} ${f.m}`, `acl funcion ${f.k} ${acl(f.acl)}`);
  }
  for (const t of await r(`select tgrelid::regclass::text as t, tgname, md5(pg_get_triggerdef(oid)) as m from pg_trigger where not tgisinternal`)) filas.push(`trigger ${t.t}.${t.tgname} ${t.m}`);
  for (const v of await r(`select schemaname || '.' || viewname as k, md5(definition) as m from pg_views where schemaname in ('public', 'private_api')`)) filas.push(`vista ${v.k} ${v.m}`);
  for (const t of await r(`select c.relnamespace::regnamespace::text || '.' || c.relname as k, coalesce(c.relacl::text, '-') as acl, c.relrowsecurity as rls,
      coalesce(md5(obj_description(c.oid, 'pg_class')), '-') as com, coalesce(c.reloptions::text, '-') as opc
    from pg_class c where c.relkind in ('r', 'v') and c.relnamespace::regnamespace::text in ('public', 'private_api')`)) {
    filas.push(`tabla ${t.k}`, `acl tabla ${t.k} ${acl(t.acl)}`, `rls tabla ${t.k} ${t.rls}`, `comentario ${t.k} ${t.com}`, `opciones ${t.k} ${t.opc}`);
  }
  for (const c of await r(`select table_schema || '.' || table_name || '.' || column_name as k, data_type, coalesce(column_default, '-') as d
    from information_schema.columns where table_schema in ('public', 'private_api')`)) filas.push(`columna ${c.k} ${c.data_type} ${c.d}`);
  for (const a of await r(`select c.relnamespace::regnamespace::text || '.' || c.relname || '.' || a.attname as k, a.attacl::text as acl
    from pg_attribute a join pg_class c on c.oid = a.attrelid where a.attacl is not null and c.relnamespace::regnamespace::text in ('public', 'private_api')`)) filas.push(`acl columna ${a.k} ${acl(a.acl)}`);
  for (const p of await r(`select schemaname || '.' || tablename || '.' || policyname as k, md5(coalesce(qual, '') || '|' || coalesce(with_check, '') || '|' || cmd || '|' || roles::text) as m
    from pg_policies where schemaname in ('public', 'private_api')`)) filas.push(`politica ${p.k} ${p.m}`);
  return new Set(filas);
}
const diferencia = (a, b) => [...a].filter((x) => !b.has(x)).sort();

describe('Runbook §4–§5 · cadena completa de la ventana: aplicar en orden y revertir en orden inverso', () => {
  let db; let antes; let aplicado; const conteosAntes = {};
  beforeAll(async () => {
    db = await baseVentana();
    antes = await catalogo(db);
    for (const t of ['cotizaciones', 'expedientes', 'producto_version_economia', 'insumo_precios', 'cuentas_no_humanas']) {
      conteosAntes[t] = (await db.query(`select count(*)::int as n, md5(coalesce(string_agg(x::text, ',' order by x::text), '')) as m from public.${t} x`)).rows[0];
    }
    for (const m of VENTANA) await db.exec(leer(m.aplicar));
    aplicado = await catalogo(db);
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  it('la cadena se aplica completa en el orden del runbook y deja SEG-01c en `preparado`', async () => {
    const existe = async (f) => (await db.query('select to_regprocedure($1) is not null as e', [f])).rows[0].e;
    expect(await existe('public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)')).toBe(true);     // VH-148
    expect(await existe('private_api.vh148_sube_version()')).toBe(true);                                     // VH-148b
    expect(await existe('public.adjuntar_costeo_a_partida(bigint, text, uuid, timestamptz)')).toBe(true);    // SEG-01c
    expect(await existe('private_api.spec_tecnica(jsonb)')).toBe(true);                                      // SEG-01c rev5
    expect(await existe('public.cargar_costos_oficiales(text, jsonb)')).toBe(true);                          // VH-100
    expect((await db.query('select modo from private_api.politica_emision_autoridad')).rows[0].modo).toBe('preparado');
    expect(diferencia(aplicado, antes).length).toBeGreaterThan(20);
  });

  it('VH-100 aplicado: authenticated ya no escribe producto_version_economia directo; el historial tiene RLS; 0 costos cambiados', async () => {
    const priv = async (rol, p) => (await db.query(`select has_table_privilege($1, 'public.producto_version_economia', $2) as t`, [rol, p])).rows[0].t;
    for (const p of ['INSERT', 'UPDATE', 'DELETE']) expect(await priv('authenticated', p)).toBe(false);
    expect(await priv('authenticated', 'SELECT')).toBe(true);
    expect((await db.query(`select relrowsecurity from pg_class where oid = 'public.producto_version_economia_historial'::regclass`)).rows[0].relrowsecurity).toBe(true);
    const ex = async (rol) => (await db.query(`select has_function_privilege($1, 'public.cargar_costos_oficiales(text, jsonb)', 'execute') as t`, [rol])).rows[0].t;
    expect(await ex('authenticated')).toBe(true); expect(await ex('service_role')).toBe(true); expect(await ex('anon')).toBe(false);
    const eco = (await db.query(`select count(*)::int as n, md5(coalesce(string_agg(x::text, ',' order by x::text), '')) as m from public.producto_version_economia x`)).rows[0];
    expect(eco).toEqual(conteosAntes.producto_version_economia);
  });

  it('rollback en orden inverso (VH-100 → SEG-01c → SEG-01 → VH-148b → VH-148 → P1-03b): la base vuelve a producción salvo el residuo declarado', async () => {
    for (const m of [...VENTANA].reverse()) {
      try { await db.exec(m.revertir()); } catch (e) { throw new Error(`rollback de ${m.id} falló: ${e.message}`); }
    }
    const despues = await catalogo(db);
    const sobra = diferencia(despues, antes).filter((x) => !RESIDUO_DECLARADO.some((re) => re.test(x)));
    const falta = diferencia(antes, despues);
    expect({ sobra, falta }).toEqual({ sobra: [], falta: [] });
    // El residuo declarado existe de verdad (si no, la lista miente):
    expect(diferencia(despues, antes).filter((x) => RESIDUO_DECLARADO.some((re) => re.test(x))).length).toBeGreaterThan(0);
    // Datos de negocio: mismos conteos y mismo contenido (ningún costo, precio, cotización ni expediente cambió).
    for (const [t, v] of Object.entries(conteosAntes)) {
      const hoy = (await db.query(`select count(*)::int as n, md5(coalesce(string_agg(x::text, ',' order by x::text), '')) as m from public.${t} x`)).rows[0];
      expect({ t, ...hoy }).toEqual({ t, ...v });
    }
  });

  it('tras el rollback, la vista del catálogo y las funciones del motor son BYTE A BYTE las de producción (huellas del 14-oct)', async () => {
    // huellas_db_20261014f.json = md5 medidos en PRODUCCIÓN (solo lectura) el 14-oct a las 18:10 UTC.
    const prod = JSON.parse(leer('lab/costear/holdout_intelisis/huellas_db_20261014f.json')).sql;
    const md5 = async (sql) => (await db.query(`select md5(${sql}) as m`)).rows[0].m;
    expect(await md5(`pg_get_viewdef('public.catalogo_vigente'::regclass, true)`)).toBe(prod.catalogo_vigente);
    expect(await md5(`pg_get_functiondef('private_api.insumo_motor'::regproc)`)).toBe(prod['private_api.insumo_motor']);
    expect(await md5(`pg_get_functiondef('private_api.catalogo_motor(boolean, text[])'::regprocedure)`)).toBe(prod['private_api.catalogo_motor']);
  });

  it('la cadena se puede volver a aplicar después del rollback (rollback reversible)', async () => {
    for (const m of VENTANA) await db.exec(leer(m.aplicar));
    const otraVez = await catalogo(db);
    const sinResiduo = (s) => new Set([...s].filter((x) => !RESIDUO_DECLARADO.some((re) => re.test(x))));
    expect(diferencia(sinResiduo(otraVez), sinResiduo(aplicado))).toEqual([]);
    expect(diferencia(sinResiduo(aplicado), sinResiduo(otraVez))).toEqual([]);
  });
});

describe('Runbook §5.4 · el ORDEN del rollback importa (dependencias reales, no convención)', () => {
  it('VH-148 revertido ANTES que VH-148b: el rollback de VH-148b vuelve a crear la sobrecarga de 3 argumentos que VH-148 quitó', async () => {
    const db = await baseVentana();
    const antes = await catalogo(db);
    for (const m of VENTANA) await db.exec(leer(m.aplicar));
    const orden = ['VH-100', 'SEG-01c', 'SEG-01', 'VH-148', 'VH-148b', 'P1-03b'];   // VH-148 y VH-148b invertidos
    for (const id of orden) await db.exec(VENTANA.find((m) => m.id === id).revertir());
    const sobra = diferencia(await catalogo(db), antes).filter((x) => !RESIDUO_DECLARADO.some((re) => re.test(x)));
    expect(sobra.some((x) => x.startsWith('funcion private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb, p_actualizado_esperado timestamp with time zone)'))).toBe(true);
    await db.close();
  }, 120_000);
  it('P1-03b sin CASCADE: si algo fuera de producción depende de la vista, el rollback falla y no deja nada a medias', async () => {
    const db = await baseVentana();
    for (const m of VENTANA) await db.exec(leer(m.aplicar));
    // Un dependiente que no es de producción (p. ej. una vista de reporte creada a mano): el DROP sin CASCADE lo detecta.
    await db.exec('create view public.reporte_tmp as select insumo_id, precio_id from public.catalogo_vigente');
    const antesRb = await catalogo(db);
    let error = null; try { await db.exec(VENTANA.find((m) => m.id === 'P1-03b').revertir()); } catch (e) { error = e; }
    expect(String(error?.message)).toMatch(/depend/);
    await db.exec('rollback').catch(() => {});
    expect(diferencia(await catalogo(db), antesRb)).toEqual([]);   // la transacción no dejó nada a medias
    await db.close();
  }, 120_000);
});
