// ============================================================================
//  COCREAR 10 · D-02 / D-03 · el servidor es dueño del dinero de Cocrear.
//  PostgreSQL REAL (PGlite) con las tablas y cuerpos del baseline de producción + la migración
//  PROPUESTA_cocrear_costo_servidor.sql (no aplicada en producción).
//
//  La Edge `costear-servidor-rc` (modo cocrear) no corre aquí (Deno + service role). Su
//  orquestación se reproduce con los MISMOS módulos que importa (cocrearServidor.js,
//  validarIntentCosteo, motor `calcular`, revisarEstructura) y la fila se inserta como lo haría el
//  service role. El catálogo central no existe en esta base: igual que la Edge con
//  `config-fallback`, un costo emitible queda con tope `preliminar`.
//  Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { cocrearPayload, specDeCocreacion } from '../../src/datos/cocrear.js';
import { prepararIntentCocrear, conceptosCocrear, aplicarConceptoCocrear } from '../../src/datos/cocrearWow.js';
import { bajarLineaABom } from '../../src/datos/cocrearPuente.js';
import { visualRevisionHash } from '../../src/datos/visualRevision.js';
import {
  validarSolicitudCocrear, accesoACocreacion, piezaDeCocreacion, decidirValidacionIngenieria,
  filaCostoCocreacion, respuestaCocreacionPorRol, precioSugeridoCocreado,
} from '../../src/datos/cocrearServidor.js';
import { validarIntentCosteo } from '../../src/datos/validarIntentCosteo.js';
import { calcular, costeoEmitible, PARAMETROS_DEFAULT } from '../../src/motor/calculo.js';
import { revisarEstructura } from '../../src/datos/revisionEstructural.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../../src/datos/insumos.js';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const MIGRACION = 'supabase/migrations/PROPUESTA_cocrear_costo_servidor.sql';
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

const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx', DISENO = 'diseno@vh.mx', OTRO = 'otro@vh.mx';
const insumos = mapaInsumos(INSUMOS_SEMILLA);
const par = { ...PARAMETROS_DEFAULT };
let db;
const como = async (email) => db.exec(`select set_config('test.email', '${email}', false)`);
const uno = async (sql, params = []) => (await db.query(sql, params)).rows[0];

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
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor'), ('${DISENO}','diseno'), ('${OTRO}','vendedor');
  `);
  for (const t of ['expedientes', 'expediente_revisiones', 'productos', 'producto_versiones', 'producto_version_economia', 'renders']) await db.exec(tabla(t));
  await db.exec(funcion('supabase/schema/baseline/03_funciones.sql', 'public.jsonb_sin_economia'));
  await db.exec(funcion('supabase/schema/baseline/03_funciones.sql', 'public.guard_producto_version'));
  await db.exec(funcion('supabase/schema/baseline/08_private_api.sql', 'private_api.canonicalizar_spatial_spec_producto_version'));
  await db.exec(`
    CREATE TRIGGER trg_guard_producto_version BEFORE INSERT OR UPDATE ON public.producto_versiones FOR EACH ROW EXECUTE FUNCTION public.guard_producto_version();
    CREATE TRIGGER trg_producto_version_spatial_spec BEFORE INSERT ON public.producto_versiones FOR EACH ROW EXECUTE FUNCTION private_api.canonicalizar_spatial_spec_producto_version();
  `);
  await db.exec(funcion('supabase/schema/baseline/08_private_api.sql', 'private_api.guardar_cocrear_seguro'));
  await db.exec(funcion('supabase/schema/baseline/08_private_api.sql', 'private_api.registrar_producto_desde_expediente'));
  await db.exec(funcion('supabase/schema/baseline/08_private_api.sql', 'private_api.cocrear_seguro'));
  // La migración propuesta, TAL CUAL (con su begin/commit).
  await db.exec(leer(MIGRACION));
});
afterAll(async () => { await db?.close(); });

async function guardar(email, payload, id = null) {
  await como(email);
  return (await uno('select private_api.guardar_cocrear_seguro($1, $2::jsonb) as r', [id, JSON.stringify(payload)])).r;
}
async function registrar(email, id) {
  await como(email);
  return (await uno('select private_api.registrar_producto_desde_expediente($1) as r', [id])).r;
}
async function cargar(email, id) {
  await como(email);
  return (await uno('select private_api.cocrear_seguro($1) as r', [id])).r;
}

// Orquestación de la Edge `costear-servidor-rc` (modo cocrear) con sus mismos módulos.
async function costearEnServidor(email, body) {
  const sol = validarSolicitudCocrear(body);
  if (!sol.ok) return { ok: false, status: 400, code: sol.code };
  const rol = (await uno('select rol from public.permitidos where email=$1', [email]))?.rol;
  const exp = await uno('select id, creado_por, revision, analysis_hash, cocrear from public.expedientes where id=$1', [sol.solicitud.expedienteId]);
  if (!exp) return { ok: false, status: 404 };
  if (!accesoACocreacion({ rol, email, creadoPor: exp.creado_por })) return { ok: false, status: 403, code: 'SIN_ACCESO' };
  const pz = piezaDeCocreacion(exp.cocrear);
  if (!pz.ok) return { ok: false, status: 409, code: pz.code };
  const v = validarIntentCosteo({ cantidad: 1, pieza: pz.pieza });
  if (!v.ok) return { ok: false, status: 422, code: 'BOM_INVALIDO' };
  const r = calcular(v.intent.pieza, 1, insumos, par);
  const emision = costeoEmitible(r);
  const estado = emision.emitible ? 'preliminar' : 'incompleto';   // catálogo central ausente ⇒ tope preliminar
  const bloqueos = (revisarEstructura({ componentes: pz.pieza.componentes, descripcion: exp.cocrear?.brief || '', insumos }).observaciones || [])
    .filter((o) => o.nivel === 'blocker').map((o) => o.mensaje);
  const decision = decidirValidacionIngenieria({
    solicitada: sol.solicitud.validarIngenieria, rol, emitible: emision.emitible, estado,
    visualHashCliente: sol.solicitud.visualHash, visualHashServidor: pz.visualHash, bloqueosEstructura: bloqueos,
  });
  const precio = precioSugeridoCocreado(estado !== 'incompleto' ? r.costoUnitario : null, { par });
  const fila = filaCostoCocreacion({
    expediente: exp, email, rol, pz, precio, decision: { ...decision, bloqueos },
    costeo: { emitible: emision.emitible, estado, costoUnitario: r.costoUnitario, warnings: [], pendientes: emision.pendientes || [], versionMotor: 'test', versionCatalogo: 'config-fallback-test', fuenteCosto: 'config-fallback' },
  });
  const cols = Object.keys(fila);
  await db.query(`insert into public.cocrear_costeo_servidor (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
    cols.map((k) => (k === 'warnings' || k === 'evidencia' ? JSON.stringify(fila[k]) : fila[k])));
  return { ...respuestaCocreacionPorRol(rol, fila, { costeo: r, decision }), costoMotor: r.costoUnitario };
}

// Mesa de juntas APP LT 1.35 × 1.20 (cambio de medida de un mueble de línea), con BOM escalado.
function cocreacionMesa({ extra = [], historia = 2 } = {}) {
  const base = prepararIntentCocrear('Mesa de juntas de 1.35 m por 1.20 m de fondo');
  const concepto = aplicarConceptoCocrear(base, conceptosCocrear(base)[0]);
  const r = bajarLineaABom({ ...concepto, caracteristicas: [...(concepto.caracteristicas || []), ...extra] }, { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
  if (!r.ok) throw new Error(r.motivo);
  const hist = Array.from({ length: historia }, (_, i) => ({ rev: i + 1, label: `R${i + 1}`, intent: r.intent }));
  return { intent: r.intent, historia: hist, payload: cocrearPayload({ brief: 'Mesa de juntas 1.35', intent: r.intent, historia: hist, insumos, par }) };
}

describe('Contrato de la solicitud: el navegador sólo manda la identidad de la co-creación', () => {
  it('rechaza BOM, costo, rol o margen en el body', () => {
    for (const extra of [{ componentes: [] }, { costo: 1 }, { rol: 'direccion' }, { margen: 10 }, { pieza: {} }]) {
      expect(validarSolicitudCocrear({ accion: 'cocrear', expediente_id: 1, ...extra }).ok).toBe(false);
    }
    expect(validarSolicitudCocrear({ accion: 'cocrear', expediente_id: 1 }).ok).toBe(true);
    expect(validarSolicitudCocrear({ accion: 'cocrear', expediente_id: 1, validar_ingenieria: true }).ok).toBe(false); // falta visual_hash
  });

  it('un payload alterado (specHash que no es de su intención) no se costea', () => {
    const { payload } = cocreacionMesa();
    expect(piezaDeCocreacion(payload).ok).toBe(true);
    expect(piezaDeCocreacion({ ...payload, specHash: 'hfalso' }).code).toBe('PAYLOAD_INCONSISTENTE');
  });
});

describe('D-02 · el costo oficial de una co-creación sale de costear-servidor, nunca del payload', () => {
  it('REQUISITO (cocrearServidor.test.js D-02): un costSnapshot inventado sin BOM no se registra', async () => {
    const base = prepararIntentCocrear('Recepción escultórica para lobby corporativo, curva, cálida.');
    const intent = aplicarConceptoCocrear(base, conceptosCocrear(base)[0]);
    const p = { ...cocrearPayload({ brief: 'Recepción', intent, historia: [{ rev: 1, intent, label: 'A' }] }), costSnapshot: { status: 'KNOWN', known_cost: 1, official_cost: 1 } };
    const g = await guardar(VENDEDOR, p);
    const reg = await registrar(VENDEDOR, g.expediente_id);
    expect(reg.ok).toBe(false);
    expect(reg.motivo).toBe('costo_servidor_pendiente');
    expect((await db.query('select count(*)::int n from public.producto_version_economia')).rows[0].n).toBe(0);
    // Y el servidor tampoco lo costea: no hay BOM.
    expect((await costearEnServidor(VENDEDOR, { accion: 'cocrear', expediente_id: g.expediente_id })).code).toBe('SIN_BOM');
  });

  it('con BOM: sin costeo de servidor no registra; con él, el importe es el del servidor aunque el payload mienta', async () => {
    const { payload } = cocreacionMesa();
    const mentiroso = { ...payload, costSnapshot: { status: 'KNOWN', known_cost: 1, official_cost: 1 } };
    const g = await guardar(VENDEDOR, mentiroso);
    expect((await registrar(VENDEDOR, g.expediente_id)).motivo).toBe('costo_servidor_pendiente');

    const srv = await costearEnServidor(VENDEDOR, { accion: 'cocrear', expediente_id: g.expediente_id });
    expect(srv.ok).toBe(true);
    expect(srv.estado).toBe('preliminar');
    expect(srv.precioSugerido).toBeGreaterThan(0);
    // Seller-safe: el vendedor recibe precio, nunca costo ni margen.
    expect(srv.costo).toBeUndefined();
    expect(srv.margen).toBeUndefined();
    expect(JSON.stringify(srv)).not.toMatch(/costo_unitario|costoUnitario|margen_politica/);

    const reg = await registrar(VENDEDOR, g.expediente_id);
    expect(reg.ok).toBe(true);
    expect(reg.costo_fuente).toBe('costear-servidor');
    expect(reg.estado_tecnico).toBe('preliminar');
    expect(reg.requires_engineering_validation).toBe(true);
    const eco = await uno('select costo_oficial_referencia, fuente from public.producto_version_economia where producto_version_id=$1', [reg.version_id]);
    expect(Number(eco.costo_oficial_referencia)).toBeCloseTo(Math.round(srv.costoMotor * 100) / 100, 2);
    expect(Number(eco.costo_oficial_referencia)).not.toBe(1);
    expect(eco.fuente).toMatch(/^costear-servidor/);
  });

  it('BOM con una función sin despiece ⇒ costo incompleto: sin importe, "Por confirmar", no se registra', async () => {
    const { payload } = cocreacionMesa({ extra: ['electrificacion_integrada'] });
    const g = await guardar(VENDEDOR, payload);
    const srv = await costearEnServidor(VENDEDOR, { accion: 'cocrear', expediente_id: g.expediente_id });
    expect(srv.estado).toBe('incompleto');
    expect(srv.precioSugerido).toBeNull();
    expect(srv.precioPorConfirmar).toBe(true);
    expect((await registrar(VENDEDOR, g.expediente_id)).motivo).toBe('expediente_incompleto_no_publicable');
  });

  it('la tabla no admite importes en un costeo incompleto (ni $0)', async () => {
    await expect(db.query(`insert into public.cocrear_costeo_servidor (expediente_id, spec_hash, visual_hash, bom_hash, estado, costo_unitario, calculado_por, rol)
      values ((select min(id) from public.expedientes), 's', 'v', 'b', 'incompleto', 100, 'x', 'vendedor')`)).rejects.toThrow();
    await expect(db.query(`insert into public.cocrear_costeo_servidor (expediente_id, spec_hash, visual_hash, bom_hash, estado, costo_unitario, calculado_por, rol)
      values ((select min(id) from public.expedientes), 's', 'v', 'b', 'preliminar', 0, 'x', 'vendedor')`)).rejects.toThrow();
  });
});

describe('D-03 · "Validar ingeniería" se decide y se guarda en el servidor', () => {
  it('Diseño valida la revisión guardada ⇒ la versión registrada queda APROBADA (aunque registre un vendedor)', async () => {
    const { payload, intent, historia } = cocreacionMesa();
    const g = await guardar(VENDEDOR, payload);
    const visual = visualRevisionHash(specDeCocreacion(intent, historia));
    const srv = await costearEnServidor(DISENO, { accion: 'cocrear', expediente_id: g.expediente_id, validar_ingenieria: true, visual_hash: visual });
    expect(srv.ingenieria_validada).toBe(true);
    expect(srv.validada_por).toBe(DISENO);
    expect(srv.costo.costoUnitario).toBeGreaterThan(0);   // Diseño ve costo técnico…
    expect(srv.margen).toBeUndefined();                   // …pero no margen.

    // Un costeo posterior del vendedor (sin validar) no tapa la validación de la misma revisión.
    await costearEnServidor(VENDEDOR, { accion: 'cocrear', expediente_id: g.expediente_id });
    const reg = await registrar(VENDEDOR, g.expediente_id);
    expect(reg.ok).toBe(true);
    expect(reg.estado_tecnico).toBe('aprobado');
    expect(reg.requires_engineering_validation).toBe(false);
    expect(reg.ingenieria_validada_servidor).toBe(true);
  });

  it('un vendedor no puede validar; una revisión distinta a la guardada tampoco', async () => {
    const { payload, intent, historia } = cocreacionMesa();
    const g = await guardar(VENDEDOR, payload);
    const visual = visualRevisionHash(specDeCocreacion(intent, historia));
    const v1 = await costearEnServidor(VENDEDOR, { accion: 'cocrear', expediente_id: g.expediente_id, validar_ingenieria: true, visual_hash: visual });
    expect(v1.ingenieria_validada).toBe(false);
    expect(v1.validacion.code).toBe('ENGINEERING_VALIDATION_FORBIDDEN');
    const v2 = await costearEnServidor(DISENO, { accion: 'cocrear', expediente_id: g.expediente_id, validar_ingenieria: true, visual_hash: 'hotra-revision' });
    expect(v2.ingenieria_validada).toBe(false);
    expect(v2.validacion.code).toBe('REVISION_DISTINTA');
    expect((await registrar(DISENO, g.expediente_id)).estado_tecnico).toBe('preliminar');
  });

  it('la evidencia forjada en el JSON del cliente no cuenta (D-04 sigue vigente con la propuesta)', async () => {
    const { payload } = cocreacionMesa();
    const p = { ...payload, intent: { ...payload.intent, _engineering_validated: true, _engineering_validation: { validador: DIRECCION, rol: 'direccion', visual_hash: 'h' } } };
    const g = await guardar(VENDEDOR, p);
    await costearEnServidor(VENDEDOR, { accion: 'cocrear', expediente_id: g.expediente_id });
    const reg = await registrar(VENDEDOR, g.expediente_id);
    expect(reg.estado_tecnico).toBe('preliminar');
  });

  it('la tabla rechaza una validación firmada por un rol sin autoridad', async () => {
    await expect(db.query(`insert into public.cocrear_costeo_servidor (expediente_id, spec_hash, visual_hash, bom_hash, estado, costo_unitario, calculado_por, rol, ingenieria_validada, validada_por, validada_en)
      values ((select min(id) from public.expedientes), 's', 'v', 'b', 'preliminar', 100, 'x', 'vendedor', true, 'x', now())`)).rejects.toThrow();
  });

  it('una revisión nueva deja sin verdad de servidor a la anterior: hay que volver a costear y validar', async () => {
    const { payload, intent, historia } = cocreacionMesa();
    const g = await guardar(DISENO, payload);
    await costearEnServidor(DISENO, { accion: 'cocrear', expediente_id: g.expediente_id, validar_ingenieria: true, visual_hash: visualRevisionHash(specDeCocreacion(intent, historia)) });
    // Cambia la medida: nueva revisión (otro analysis_hash).
    const r2 = bajarLineaABom({ ...intent, dimensiones: { ...intent.dimensiones, ancho_mm: 1400 } }, { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    const h2 = [...historia, { rev: historia.length + 1, label: '1400', intent: r2.intent }];
    const g2 = await guardar(DISENO, cocrearPayload({ intent: r2.intent, historia: h2, insumos, par }), g.expediente_id);
    expect(g2.nueva_revision).toBe(true);
    expect((await registrar(DISENO, g.expediente_id)).motivo).toBe('costo_servidor_pendiente');
  });
});

describe('cocrear_seguro devuelve la verdad del servidor, filtrada por rol', () => {
  it('vendedor: estado, validación y precio; sin costo ni margen. Dirección: todo', async () => {
    const { payload, intent, historia } = cocreacionMesa();
    const g = await guardar(VENDEDOR, payload);
    await costearEnServidor(DISENO, { accion: 'cocrear', expediente_id: g.expediente_id, validar_ingenieria: true, visual_hash: visualRevisionHash(specDeCocreacion(intent, historia)) });
    const v = await cargar(VENDEDOR, g.expediente_id);
    expect(v.validacion_servidor.ingenieria_validada).toBe(true);
    expect(Number(v.validacion_servidor.precio_sugerido)).toBeGreaterThan(0);
    expect(v.validacion_servidor.costo_unitario).toBeUndefined();
    expect(v.validacion_servidor.margen_politica).toBeUndefined();
    const d = await cargar(DIRECCION, g.expediente_id);
    expect(Number(d.validacion_servidor.costo_unitario)).toBeGreaterThan(0);
    expect(Number(d.validacion_servidor.margen_politica)).toBe(50);
  });

  it('otro vendedor no ve ni costea una co-creación ajena', async () => {
    const { payload } = cocreacionMesa();
    const g = await guardar(VENDEDOR, payload);
    expect((await cargar(OTRO, g.expediente_id)).motivo).toBe('sin_acceso');
    expect((await costearEnServidor(OTRO, { accion: 'cocrear', expediente_id: g.expediente_id })).code).toBe('SIN_ACCESO');
  });
});

describe('Expedientes que NO son co-creación (biblioteca de Costear): sin cambios', () => {
  it('siguen registrándose con su costo de expediente', async () => {
    await como(DISENO);
    const e = await uno(`insert into public.expedientes (creado_por, nombre, estado, costo, analysis_hash) values ($1, 'Mesa biblioteca', 'aprobado', $2::jsonb, 'h1') returning id`,
      [DISENO, JSON.stringify({ estado_costo: 'preliminar', costoTotal: 1234.5, formula_version: 'ALBA_V1' })]);
    const reg = await registrar(DISENO, e.id);
    expect(reg.ok).toBe(true);
    expect(reg.costo_fuente).toBe('expediente');
    expect(reg.estado_tecnico).toBe('aprobado');
  });
});

describe('Rollback de la propuesta', () => {
  it('el bloque de rollback existe y restaura los cuerpos de producción', () => {
    const sql = leer(MIGRACION);
    const ini = sql.indexOf('-- >>> ROLLBACK COCREAR10 INICIO');
    const fin = sql.indexOf('-- <<< ROLLBACK COCREAR10 FIN');
    expect(ini).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(ini);
    const rb = sql.slice(ini, fin);
    expect(rb).toContain(funcion('supabase/schema/baseline/08_private_api.sql', 'private_api.registrar_producto_desde_expediente'));
    expect(rb).toContain('drop table if exists public.cocrear_costeo_servidor');
  });
});
