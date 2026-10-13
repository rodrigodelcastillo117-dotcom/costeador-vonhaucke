// ============================================================================
//  AUDITORÍA COCREAR / VONI · lado SERVIDOR en base aislada (PGlite = PostgreSQL real en WASM).
//  docs/auditoria/COCREAR_VONI_10.md · D-02, D-03, D-04, D-08.
//
//  Se cargan las tablas REALES del baseline (01_tablas.sql: expedientes, expediente_revisiones,
//  productos, producto_versiones, producto_version_economia, renders), los triggers de
//  producto_versiones y los cuerpos REALES de private_api.guardar_cocrear_seguro y
//  private_api.registrar_producto_desde_expediente (08_private_api.sql, leídos de producción el
//  2026-10-11). El payload sale de `cocrearPayload` (el mismo que manda CocrearV3).
//  Nada toca producción. Harness: el de controlOptimista.test.js / preservaEconomia.test.js.
//
//  Convención: `it` = protege una corrección; `it.fails` = defecto VIGENTE (el cuerpo afirma el
//  requisito y hoy truena). Al corregirlo, vitest lo pone en rojo: conviértelo en `it`.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { cocrearPayload } from '../../src/datos/cocrear.js';
import { prepararIntentCocrear, conceptosCocrear, aplicarConceptoCocrear } from '../../src/datos/cocrearWow.js';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');

function tabla(nombre) {
  const sql = leer('supabase/schema/baseline/01_tablas.sql');
  const ini = sql.indexOf(`CREATE TABLE public.${nombre} (`);
  if (ini < 0) throw new Error(`no está la tabla ${nombre} en el baseline`);
  return sql.slice(ini, sql.indexOf('\n);\n', ini) + 4);
}
function funcion(archivo, firma) {
  const sql = leer(archivo);
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION ${firma}(`);
  if (ini < 0) throw new Error(`no está ${firma} en ${archivo}`);
  const fin = sql.indexOf('$function$', sql.indexOf('AS $function$', ini) + 13);
  return sql.slice(ini, fin + '$function$'.length) + ';';
}

const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx', DISENO = 'diseno@vh.mx';
let db;
const como = async (email) => db.exec(`select set_config('test.email', '${email}', false)`);
const rpc = async (sql, params = []) => (await db.query(sql, params)).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth; create schema private_api;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create function auth.uid() returns uuid language sql stable as $$
      select case when current_setting('test.email', true) in ('', null) then null
        else md5(current_setting('test.email', true))::uuid end $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when current_setting('test.email', true) in ('', null) then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, nombre text, rol text not null default 'vendedor', creado timestamptz not null default now());
    create function public.puede_entrar() returns boolean language sql stable as $$
      select exists(select 1 from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email')) $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$
      select exists(select 1 from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') and p.rol in ('direccion','diseno')) $$;
    create function public.puede_ver_economia() returns boolean language sql stable as $$
      select exists(select 1 from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') and p.rol = 'direccion') $$;
    create function public.bom_hash_de_revision(bigint) returns text language sql stable as $$ select null::text $$;
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor'), ('${DISENO}','diseno');
  `);
  for (const t of ['expedientes', 'expediente_revisiones', 'productos', 'producto_versiones', 'producto_version_economia', 'renders']) await db.exec(tabla(t));
  await db.exec(funcion('supabase/schema/baseline/03_funciones.sql', 'public.guard_producto_version'));
  await db.exec(funcion('supabase/schema/baseline/08_private_api.sql', 'private_api.canonicalizar_spatial_spec_producto_version'));
  await db.exec(`
    CREATE TRIGGER trg_guard_producto_version BEFORE INSERT OR UPDATE ON public.producto_versiones FOR EACH ROW EXECUTE FUNCTION public.guard_producto_version();
    CREATE TRIGGER trg_producto_version_spatial_spec BEFORE INSERT ON public.producto_versiones FOR EACH ROW EXECUTE FUNCTION private_api.canonicalizar_spatial_spec_producto_version();
  `);
  await db.exec(funcion('supabase/schema/baseline/08_private_api.sql', 'private_api.guardar_cocrear_seguro'));
  await db.exec(funcion('supabase/schema/baseline/08_private_api.sql', 'private_api.registrar_producto_desde_expediente'));
});
afterAll(async () => { await db?.close(); });

function payloadRecepcion(extra = {}) {
  const base = prepararIntentCocrear('Recepción escultórica para lobby corporativo, curva, cálida, con iluminación y guardado oculto.');
  const intent = aplicarConceptoCocrear(base, conceptosCocrear(base)[0]);
  return { ...cocrearPayload({ brief: 'Recepción escultórica', intent, historia: [{ rev: 1, intent, label: 'Concepto A' }] }), ...extra };
}
async function guardar(email, payload, id = null) {
  await como(email);
  return (await rpc('select private_api.guardar_cocrear_seguro($1, $2::jsonb) as r', [id, JSON.stringify(payload)])).r;
}
async function registrar(email, id) {
  await como(email);
  return (await rpc('select private_api.registrar_producto_desde_expediente($1) as r', [id])).r;
}

describe('guardar_cocrear_seguro con el payload real de Cocrear', () => {
  it('D-08: el fondo del producto (prof_mm) llega a expedientes.fondo_mm', async () => {
    const p = payloadRecepcion();
    const r = await guardar(VENDEDOR, p);
    expect(r.ok).toBe(true);
    const e = (await db.query('select ancho_mm, fondo_mm, alto_mm, estado, producto_tipo from public.expedientes where id=$1', [r.expediente_id])).rows[0];
    expect(Number(e.ancho_mm)).toBe(2400);
    expect(Number(e.fondo_mm)).toBe(700);   // antes: null (el payload sólo traía prof_mm)
    expect(Number(e.alto_mm)).toBe(1100);
    expect(e.estado).toBe('borrador');
  });

  it('un payload honesto de Cocrear (sin BOM, costo UNKNOWN) no se registra como producto', async () => {
    const r = await guardar(VENDEDOR, payloadRecepcion());
    expect(r.ok).toBe(true);
    const reg = await registrar(VENDEDOR, r.expediente_id);
    expect(reg.ok).toBe(false);
    expect(reg.motivo).toBe('expediente_incompleto_no_publicable');
  });
});

describe('registrar_producto_desde_expediente (defectos vigentes)', () => {
  it.fails('D-02 REQUISITO: el servidor no acepta como costo oficial un costSnapshot escrito por el cliente sin BOM', async () => {
    // Un vendedor llama la RPC directamente con un costSnapshot inventado y SIN componentes.
    const p = payloadRecepcion({ costSnapshot: { status: 'KNOWN', known_cost: 1, official_cost: 1 } });
    expect(p.spec.componentes).toEqual([]);
    const r = await guardar(VENDEDOR, p);
    const reg = await registrar(VENDEDOR, r.expediente_id);
    const eco = (await db.query('select costo_oficial_referencia from public.producto_version_economia where producto_version_id=$1', [reg.version_id ?? -1])).rows[0];
    // Hoy: reg.ok=true, estado_tecnico 'preliminar' y producto_version_economia.costo_oficial_referencia = 1.
    expect(reg.ok).toBe(false);
    expect(eco).toBeUndefined();
  });

  it.fails('D-03 REQUISITO: "Validar ingeniería" de Diseño en Cocrear se refleja en el estado técnico del servidor', async () => {
    // Diseño validó en la UI (intent._engineering_validated + evidencia) y registra la revisión.
    const p = payloadRecepcion({ costSnapshot: { status: 'KNOWN', known_cost: 5000, official_cost: 5000 } });
    p.intent = { ...p.intent, _engineering_validated: true, _engineering_validation: { validador: DISENO, rol: 'diseno', visual_hash: 'h' } };
    const r = await guardar(DISENO, p);
    const reg = await registrar(DISENO, r.expediente_id);
    expect(reg.ok).toBe(true);
    // Hoy: 'preliminar' (sólo expedientes.estado='aprobado' eleva, y Cocrear siempre guarda 'borrador').
    expect(['aprobado', 'certificado']).toContain(reg.estado_tecnico);
  });

  it('D-04: una revisión registrada por vendedor con evidencia de validación forjada queda PRELIMINAR (el servidor no se deja engañar)', async () => {
    const p = payloadRecepcion({ costSnapshot: { status: 'KNOWN', known_cost: 5000, official_cost: 5000 } });
    p.intent = { ...p.intent, _engineering_validated: true, _engineering_validation: { validador: DIRECCION, rol: 'direccion', visual_hash: 'h' } };
    const r = await guardar(VENDEDOR, p);
    const reg = await registrar(VENDEDOR, r.expediente_id);
    expect(reg.ok).toBe(true);
    expect(reg.estado_tecnico).toBe('preliminar');
    expect(reg.requires_engineering_validation).toBe(true);
  });
});
