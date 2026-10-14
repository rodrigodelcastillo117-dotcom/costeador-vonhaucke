// ============================================================================
//  VH-148b · CONTROL OPTIMISTA FAIL-CLOSED · PRUEBA EN BASE AISLADA (PGlite = PostgreSQL real en WASM).
//  Nada toca producción.
//
//  Base = PRODUCCIÓN del 14-oct-2026 reconstruida con el SQL exacto que ya usan las demás pruebas:
//   · cuerpos de private_api de producción (fixtures/private_api_prod_20261013.sql y
//     fixtures/private_api_emision_prod_20261013.sql, md5 verificados abajo);
//   · wrappers, triggers, guardas de producto_versiones y RPC de cocrear del baseline (03/05/08);
//   · DDL de productos / producto_versiones / expedientes / expediente_revisiones del baseline (01) con su
//     índice único (expediente_id, rev) y sus llaves;
//   · RLS y privilegios de tabla del baseline (02/06) para cotizaciones, expedientes, expediente_revisiones y
//     producto_versiones; las escrituras "directas" corren con SET ROLE authenticated (como PostgREST);
//   · VH-035c aplicada (está en producción desde el 13-oct; md5 del wrapper de emisión verificado).
//  Encima: PROPUESTA_vh148 (requisito) y PROPUESTA_vh148b (lo que se prueba). PROPUESTA_vh148c = paso 2.
//
//  Cada defecto se escribe UNA vez y corre en dos bases:
//   · SIN la propuesta (producción + VH-148): `it.fails` ⇒ el defecto está presente (la prueba falla).
//   · CON la propuesta: `it` ⇒ el defecto está cerrado.
//  Para ver los fallos con el detalle de cada aserción: VH148B_OMITIR=1 npx vitest run supabase/tests/vh148FailClosed.test.js
//  (la base "CON" se arma sin aplicar el archivo; los defectos fallan con su mensaje).
//
//  Límite honesto: PGlite tiene UNA conexión. "Dos sesiones" = dos personas intercaladas (A lee, B lee, A guarda,
//  B guarda con su versión vieja), que es el escenario de pérdida silenciosa. La espera en el candado
//  (SELECT … FOR UPDATE) entre transacciones simultáneas NO se ejercita aquí.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  DIRECCION, VENDEDOR, DISENO, MD5_PROD, VH035C, VH148, VH148B, VH148C, SEG01, SEG01C, leer, rollbackDe, baseProduccion,
  q, uno, fallo, vista, guardar2, guardar3, filaCot, filaExp, filaVer, mismaVersion, revisionesDe, md5Def, existe,
  sembrarCot, sembrarExp, sembrarVersion, updateDirectoExp, rpcExp, cocrear2, cocrear3,
} from './helpers/baseVh148b.js';

const OMITIR_PROPUESTA = process.env.VH148B_OMITIR === '1';

// ============================================================================
//  LOS DEFECTOS (cada uno: lo que DEBE pasar; sin la propuesta falla).
// ============================================================================
const DEFECTOS = [
  ['H1 · cotización: p_actualizado_esperado = NULL ya no salta el control (VERSION_REQUIRED) y la fila queda intacta', async (db) => {
    const id = await sembrarCot(db);
    const vA = await vista(db, VENDEDOR, id);
    await vista(db, VENDEDOR, id);                                      // B abre la misma versión
    expect((await guardar3(db, VENDEDOR, id, { cliente: 'De A' }, vA.actualizado)).c.ok).toBe(true);
    const trasA = await filaCot(db, id);
    const e = await fallo(guardar3(db, VENDEDOR, id, { cliente: 'De B (sin versión)' }, null));
    expect(e?.code, e?.message).toBe('22004');
    expect(e.message).toMatch(/VERSION_REQUIRED/);
    expect(await filaCot(db, id)).toBe(trasA);
  }],
  ['H2 · cotización: un UPDATE directo (archivar, PostgREST) sube la versión ⇒ la pestaña con la versión vieja choca (40001) y no escribe', async (db) => {
    const id = await sembrarCot(db);
    const v = await vista(db, DIRECCION, id);
    await q(db, DIRECCION, 'update public.cotizaciones set activa = false where id = $1', [id]);   // archivarCotizacion
    expect(await mismaVersion(db, id, v.actualizado)).toBe(false);
    const antes = await filaCot(db, id);
    const e = await fallo(guardar3(db, DIRECCION, id, { cliente: 'pestaña vieja' }, v.actualizado));
    expect(e?.code, e?.message).toBe('40001');
    expect(await filaCot(db, id)).toBe(antes);
  }],
  ['H2 · cotización: una RPC del servidor que no tocaba `actualizado` (vincular_cotizacion) también sube la versión', async (db) => {
    const id = await sembrarCot(db);
    const v = await vista(db, VENDEDOR, id);
    await uno(db, VENDEDOR, 'select private_api.vincular_cotizacion($1, 7, null, 9)', [id], null);
    expect(await mismaVersion(db, id, v.actualizado)).toBe(false);
    const e = await fallo(guardar3(db, VENDEDOR, id, { cliente: 'pestaña vieja', proyecto_id: null }, v.actualizado));
    expect(e?.code, e?.message).toBe('40001');
    expect(String((await db.query('select proyecto_id from public.cotizaciones where id=$1', [id])).rows[0].proyecto_id)).toBe('9');
  }],
  ['H2b · VH-148d: vincular_cotizacion SIN versión ya no la puede llamar una sesión (42501); con versión vieja 40001, sin versión 22004', async (db) => {
    const id = await sembrarCot(db);
    const v = await vista(db, VENDEDOR, id);
    expect((await fallo(uno(db, VENDEDOR, 'select public.vincular_cotizacion($1, 7, null, 9)', [id])))?.code).toBe('42501');
    expect((await fallo(uno(db, VENDEDOR, 'select private_api.vincular_cotizacion($1, 7, null, 9)', [id])))?.code).toBe('42501');
    expect((await fallo(uno(db, VENDEDOR, 'select public.vincular_cotizacion($1, 7, null, 9, null)', [id])))?.code).toBe('22004');
    // Pestaña A vincula con su versión; pestaña B (misma versión vieja) choca y NO pisa el proyecto de A.
    const a = (await uno(db, VENDEDOR, 'select public.vincular_cotizacion($1, 7, null, 9, $2::timestamptz) as r', [id, v.actualizado])).r;
    expect(a.ok).toBe(true);
    const e = await fallo(uno(db, VENDEDOR, 'select public.vincular_cotizacion($1, 8, null, 10, $2::timestamptz) as r', [id, v.actualizado]));
    expect(e?.code, e?.message).toBe('40001');
    expect(String((await db.query('select proyecto_id from public.cotizaciones where id=$1', [id])).rows[0].proyecto_id)).toBe('9');
    // Con la versión que devolvió A, sí.
    expect((await uno(db, VENDEDOR, 'select public.vincular_cotizacion($1, 8, null, 10, $2::timestamptz) as r', [id, a.actualizado])).r.ok).toBe(true);
  }],
  ['H3 · cotización: UPDATE directo de partidas/cliente por PostgREST (sin versión) se rechaza (42501) y la fila queda intacta', async (db) => {
    const id = await sembrarCot(db);
    const antes = await filaCot(db, id);
    const e = await fallo(q(db, DIRECCION, `update public.cotizaciones set partidas = '[]'::jsonb, cliente = 'pisado' where id = $1`, [id]));
    expect(e?.code, e?.message).toBe('42501');
    expect(await filaCot(db, id)).toBe(antes);
  }],
  ['H4 · expediente: dos editores en la misma revisión por UPDATE directo ⇒ el segundo choca (40001) y no pisa', async (db) => {
    const id = await sembrarExp(db);
    await updateDirectoExp(db, DISENO, id, 1, 'Lo de Diseño');          // A: rev 1 → 2
    const trasA = await filaExp(db, id);
    const e = await fallo(updateDirectoExp(db, DIRECCION, id, 1, 'Lo de Dirección'));   // B: también cree que va en la 1
    expect(e?.code, e?.message).toBe('40001');
    expect(e.message).toMatch(/CONFLICTO_VERSION/);
    expect(await filaExp(db, id)).toBe(trasA);
  }],
  ['H2 · expediente: la versión (`actualizado`) la pone el servidor aunque el navegador mande otra fecha', async (db) => {
    const id = await sembrarExp(db);
    const { a: antes } = await uno(db, DIRECCION, 'select actualizado::text as a from public.expedientes where id=$1', [id], null);
    await updateDirectoExp(db, DISENO, id, 1, 'Lo de Diseño', '2000-01-01T00:00:00Z');
    const { mayor } = await uno(db, DIRECCION, 'select actualizado > $2::timestamptz as mayor from public.expedientes where id=$1', [id, antes], null);
    expect(mayor).toBe(true);
  }],
  ['H4 · expediente: RPC con revisión esperada: revisión vieja ⇒ 40001 sin escribir; NULL ⇒ VERSION_REQUIRED; la buena escribe fila + snapshot', async (db) => {
    const id = await sembrarExp(db);
    const rA = (await rpcExp(db, DISENO, id, { nombre: 'Lo de Diseño', bom: [{ pieza: 'tapa', mm: 25 }] }, 1)).r;
    expect(rA).toMatchObject({ ok: true, revision: 2, revision_registrada: true });
    expect(await revisionesDe(db, id)).toEqual([{ rev: 1, nombre: 'Credenza nogal' }, { rev: 2, nombre: 'Lo de Diseño' }]);
    const trasA = await filaExp(db, id);
    const e = await fallo(rpcExp(db, DIRECCION, id, { nombre: 'Lo de Dirección' }, 1));
    expect(e?.code, e?.message).toBe('40001');
    expect(e.detail).toBe('revision=2');
    expect((await fallo(rpcExp(db, DIRECCION, id, { nombre: 'sin versión' }, null)))?.code).toBe('22004');
    expect(await filaExp(db, id)).toBe(trasA);
    expect((await revisionesDe(db, id)).length).toBe(2);
  }],
  ['H4 · expediente: si el número de revisión ya existe (23505 del índice único) la RPC no deja la fila a medias', async (db) => {
    const id = await sembrarExp(db);
    // Un cliente viejo dejó el snapshot rev 2 sin haber subido el expediente (carrera de hoy).
    await db.query(`insert into public.expediente_revisiones(expediente_id, rev, creado_por, nombre) values ($1, 2, $2, 'huérfana')`, [id, DISENO]);
    const antes = await filaExp(db, id);
    const e = await fallo(rpcExp(db, DIRECCION, id, { nombre: 'Lo de Dirección' }, 1));
    expect(e?.code, e?.message).toBe('23505');
    expect(await filaExp(db, id)).toBe(antes);                           // ni nombre ni revisión cambiaron
  }],
  ['H4 · cocreación: guardar con la revisión vieja ⇒ 40001 y lo de la otra pestaña se queda', async (db) => {
    const { r: c } = await cocrear2(db, VENDEDOR, null, { nombre: 'Banca', intent: { v: 1 } });
    const id = c.expediente_id;
    const rA = (await cocrear3(db, VENDEDOR, id, { nombre: 'Banca', intent: { v: 'A' } }, 1)).r;
    expect(rA).toMatchObject({ ok: true, revision: 2, nueva_revision: true });
    const trasA = await filaExp(db, id);
    const e = await fallo(cocrear3(db, VENDEDOR, id, { nombre: 'Banca', intent: { v: 'B' } }, 1));
    expect(e?.code, e?.message).toBe('40001');
    expect(await filaExp(db, id)).toBe(trasA);
    expect((await fallo(cocrear3(db, VENDEDOR, id, { nombre: 'Banca', intent: { v: 'C' } }, null)))?.code).toBe('22004');
  }],
  ['H5 · ProductRevision APROBADA: no se edita en sitio (55000) y queda intacta', async (db) => {
    const id = await sembrarVersion(db, 'aprobado');
    const antes = await filaVer(db, id);
    const e = await fallo(q(db, DIRECCION, `update public.producto_versiones set dimensiones = '{"ancho_mm":2400}'::jsonb where id=$1`, [id]));
    expect(e?.code, e?.message).toBe('55000');
    expect(e.message).toMatch(/VERSION_PUBLICADA_INMUTABLE/);
    expect(await filaVer(db, id)).toBe(antes);
  }],
  ['H5 · ProductRevision CERTIFICADA: no se puede bajar a preliminar para editarla después (rodeo de dos pasos)', async (db) => {
    const id = await sembrarVersion(db, 'certificado');
    const antes = await filaVer(db, id);
    const e = await fallo(q(db, DIRECCION, `update public.producto_versiones set estado_tecnico = 'preliminar' where id=$1`, [id]));
    expect(e?.code, e?.message).toBe('55000');
    await fallo(q(db, DIRECCION, `update public.producto_versiones set dimensiones = '{"ancho_mm":2400}'::jsonb where id=$1`, [id]));
    expect(await filaVer(db, id)).toBe(antes);
  }],
];

describe('VH-148b · la base es la de PRODUCCIÓN (SQL exacto)', () => {
  let db;
  beforeAll(async () => { db = await baseProduccion(); }, 120_000);
  afterAll(async () => { await db?.close(); });
  it('md5 de las funciones de emisión y del wrapper de VH-035c = producción', async () => {
    for (const [f, m] of Object.entries(MD5_PROD)) expect(await md5Def(db, f), f).toBe(m);
  });
  it('triggers de cotizaciones = los 4 medidos en producción; ninguno toca `actualizado`', async () => {
    const { rows } = await db.query(`select tgname from pg_trigger where tgrelid='public.cotizaciones'::regclass and not tgisinternal order by 1`);
    expect(rows.map((r) => r.tgname)).toEqual(['trg_guard_cotizacion_estado_directo', 'trg_normalize_economics_status', 'trg_pin_product_versions', 'trg_strip_seller_economics']);
  });
});

describe('VH-148b · SIN la propuesta (producción + VH-148): cada defecto está presente', () => {
  let db;
  beforeAll(async () => { db = await baseProduccion(); await db.exec(leer(VH148)); }, 120_000);
  afterAll(async () => { await db?.close(); });
  for (const [nombre, prueba] of DEFECTOS) it.fails(nombre, () => prueba(db));
});

describe(`VH-148b · CON la propuesta${OMITIR_PROPUESTA ? ' (VH148B_OMITIR=1: SIN aplicar, deben fallar)' : ''}`, () => {
  let db;
  beforeAll(async () => {
    db = await baseProduccion();
    await db.exec(leer(VH148));
    if (!OMITIR_PROPUESTA) await db.exec(leer(VH148B));
  }, 120_000);
  afterAll(async () => { await db?.close(); });
  for (const [nombre, prueba] of DEFECTOS) it(nombre, () => prueba(db));

  // --- lo que NO debe romperse --------------------------------------------------------------
  it('compatibilidad PASO 1: la firma de DOS argumentos (cliente de producción c3.4) sigue guardando', async () => {
    const id = await sembrarCot(db);
    const r = await guardar2(db, VENDEDOR, id, { cliente: 'cliente viejo' });
    expect(r.c.ok).toBe(true);
    expect(r.c.cliente).toBe('cliente viejo');
  });
  it('el flujo con versión sigue: A guarda, B con la versión vieja choca (40001), B recarga y guarda', async () => {
    const id = await sembrarCot(db);
    const vA = await vista(db, VENDEDOR, id), vB = await vista(db, VENDEDOR, id);
    const rA = await guardar3(db, VENDEDOR, id, { cliente: 'A' }, vA.actualizado);
    const trasA = await filaCot(db, id);
    const e = await fallo(guardar3(db, VENDEDOR, id, { cliente: 'B' }, vB.actualizado));
    expect(e?.code).toBe('40001');
    expect(await filaCot(db, id)).toBe(trasA);
    expect((await guardar3(db, VENDEDOR, id, { cliente: 'B' }, rA.c.actualizado)).c.cliente).toBe('B');
  });
  it('cada escritura deja una versión ESTRICTAMENTE mayor, aun dos escrituras en la misma transacción (now() no basta)', async () => {
    const id = await sembrarCot(db);
    await db.exec('begin');
    try {
      const t1 = (await db.query(`update public.cotizaciones set cliente='x1' where id=$1 returning actualizado::text as t`, [id])).rows[0].t;
      const t2 = (await db.query(`update public.cotizaciones set cliente='x2' where id=$1 returning actualizado::text as t`, [id])).rows[0].t;
      expect((await db.query('select $1::timestamptz < $2::timestamptz as crece', [t1, t2])).rows[0].crece).toBe(true);
    } finally { await db.exec('commit'); }
  });
  it('archivar (UPDATE directo de `activa`, lo único que el cliente escribe directo) sigue funcionando', async () => {
    const id = await sembrarCot(db);
    await q(db, DIRECCION, 'update public.cotizaciones set activa = false where id = $1', [id]);
    expect((await db.query('select activa from public.cotizaciones where id=$1', [id])).rows[0].activa).toBe(false);
  });
  it('expediente: el flujo de producción (UPDATE directo con revActual+1) sigue funcionando para el primero', async () => {
    const id = await sembrarExp(db);
    await updateDirectoExp(db, DISENO, id, 1, 'Lo de Diseño');
    expect((await db.query('select revision, nombre from public.expedientes where id=$1', [id])).rows[0]).toEqual({ revision: 2, nombre: 'Lo de Diseño' });
    // y el snapshot directo duplicado sigue chocando con el índice único (el cliente lo reporta como conflicto)
    await q(db, DISENO, `insert into public.expediente_revisiones(expediente_id, rev, nombre) values ($1, 2, 'A')`, [id]);
    expect((await fallo(q(db, DIRECCION, `insert into public.expediente_revisiones(expediente_id, rev, nombre) values ($1, 2, 'B')`, [id])))?.code).toBe('23505');
  });
  it('expediente: las RPC del servidor (guardar_cocrear_seguro de dos argumentos) no pasan por el CAS directo', async () => {
    const { r: c } = await cocrear2(db, DIRECCION, null, { nombre: 'Mesa', intent: { v: 1 } });
    expect((await cocrear2(db, DIRECCION, c.expediente_id, { nombre: 'Mesa', intent: { v: 2 } })).r.revision).toBe(2);
  });
  it('expediente RPC: sólo Diseño/Dirección; campos de control no se aceptan en el patch', async () => {
    const id = await sembrarExp(db);
    expect((await fallo(rpcExp(db, VENDEDOR, id, { nombre: 'x' }, 1)))?.message).toMatch(/rol sin permiso/);
    expect((await fallo(rpcExp(db, DISENO, id, { revision: 9 }, 1)))?.message).toMatch(/campos no editables en expediente: revision/);
    expect((await fallo(rpcExp(db, DISENO, id, { producto_version_id: 1 }, 1)))?.message).toMatch(/campos no editables/);
  });
  it('ProductRevision: promover aprobado → certificado (certificar_version) sigue permitido; un borrador se edita libre', async () => {
    const id = await sembrarVersion(db, 'aprobado');
    await uno(db, DIRECCION, 'select public.certificar_version($1)', [id], null);
    expect((await db.query('select estado_tecnico from public.producto_versiones where id=$1', [id])).rows[0].estado_tecnico).toBe('certificado');
    const { id: prod } = await uno(db, DIRECCION, `insert into public.productos(nombre, source_type) values ('Mesa', 'expediente') returning id`, [], null);
    const { id: borrador } = await uno(db, DIRECCION, `insert into public.producto_versiones(producto_id, estado_tecnico) values ($1, 'preliminar') returning id`, [prod], null);
    await q(db, DIRECCION, `update public.producto_versiones set dimensiones = '{"ancho_mm":900}'::jsonb where id=$1`, [borrador]);
    expect((await db.query('select dimensiones from public.producto_versiones where id=$1', [borrador])).rows[0].dimensiones).toEqual({ ancho_mm: 900 });
  });
  it('ProductRevision: escape explícito de mantenimiento sólo dentro de la transacción que lo pide', async () => {
    const id = await sembrarVersion(db, 'aprobado');
    await db.exec(`begin; select set_config('vh.permitir_edicion_version_publicada', 'on', true);
      update public.producto_versiones set etiqueta = 'rev 1 (corregida)' where id = ${id}; commit;`);
    expect((await db.query('select etiqueta from public.producto_versiones where id=$1', [id])).rows[0].etiqueta).toBe('rev 1 (corregida)');
    expect((await fallo(db.query(`update public.producto_versiones set etiqueta = 'otra' where id = $1`, [id])))?.code).toBe('55000');
  });
  it('permisos: authenticated/service_role ejecutan las RPC nuevas; anon no; las funciones de trigger no son invocables', async () => {
    for (const f of ['public.actualizar_expediente_seguro(bigint, jsonb, integer)', 'public.guardar_cocrear_seguro(bigint, jsonb, integer)']) {
      const r = (await db.query(`select has_function_privilege('authenticated', $1, 'execute') a, has_function_privilege('service_role', $1, 'execute') s, has_function_privilege('anon', $1, 'execute') n`, [f])).rows[0];
      expect(r, f).toEqual({ a: true, s: true, n: false });
    }
    for (const f of ['private_api.vh148_sube_version()', 'private_api.vh148_guard_revision_expediente()']) {
      expect((await db.query(`select has_function_privilege('authenticated', $1, 'execute') a`, [f])).rows[0].a, f).toBe(false);
    }
  });
  it('re-aplicar el archivo es idempotente', async () => {
    await db.exec(leer(VH148B));
    const { n } = (await db.query(`select count(*)::int n from pg_trigger where tgname like 'trg_vh148_%'`)).rows[0];
    expect(n).toBe(3);
  });
});

// ============================================================================
//  ROLLBACK: las líneas `-- RB ` devuelven las definiciones previas BYTE A BYTE.
// ============================================================================
async function huella(db) {
  const fns = ['private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)', 'private_api.actualizar_cotizacion_segura(bigint, jsonb)',
    'public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)', 'public.actualizar_cotizacion_segura(bigint, jsonb)',
    'public.guard_producto_version()', 'private_api.guardar_cocrear_seguro(bigint, jsonb)', 'public.guardar_cocrear_seguro(bigint, jsonb)',
    'private_api.cotizacion_segura(bigint)'];
  const md5 = {};
  for (const f of fns) md5[f] = await md5Def(db, f);
  const nuevas = {};
  for (const f of ['private_api.vh148_sube_version()', 'private_api.vh148_guard_revision_expediente()', 'public.actualizar_expediente_seguro(bigint, jsonb, integer)',
    'private_api.actualizar_expediente_seguro(bigint, jsonb, integer)', 'public.guardar_cocrear_seguro(bigint, jsonb, integer)',
    'private_api.guardar_cocrear_seguro(bigint, jsonb, integer)']) nuevas[f] = await existe(db, f);
  const triggers = (await db.query(`select tgrelid::regclass::text || '.' || tgname as t from pg_trigger
    where tgrelid in ('public.cotizaciones'::regclass, 'public.expedientes'::regclass, 'public.producto_versiones'::regclass) and not tgisinternal order by 1`)).rows.map((r) => r.t);
  const acl = (await db.query(`select relacl::text as a from pg_class where oid='public.cotizaciones'::regclass`)).rows[0].a;
  const colacl = (await db.query(`select attname, attacl::text as a from pg_attribute where attrelid='public.cotizaciones'::regclass and attnum > 0 and not attisdropped order by attnum`)).rows;
  return { md5, nuevas, triggers, acl, colacl };
}

describe('VH-148b · ROLLBACK (líneas -- RB)', () => {
  let db, antes;
  beforeAll(async () => {
    db = await baseProduccion();
    await db.exec(leer(VH148));
    antes = await huella(db);
    await db.exec(leer(VH148B));
  }, 120_000);
  afterAll(async () => { await db?.close(); });

  it('con la propuesta la huella cambia (si no, la prueba de rollback no probaría nada)', async () => {
    const con = await huella(db);
    expect(con.md5['private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)']).not.toBe(antes.md5['private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)']);
    expect(con.md5['public.guard_producto_version()']).not.toBe(antes.md5['public.guard_producto_version()']);
    expect(con.acl).not.toBe(antes.acl);
    expect(con.triggers.length).toBe(antes.triggers.length + 3);
    // lo que la propuesta NO debe tocar sigue igual
    for (const f of ['private_api.actualizar_cotizacion_segura(bigint, jsonb)', 'public.actualizar_cotizacion_segura(bigint, jsonb)',
      'private_api.guardar_cocrear_seguro(bigint, jsonb)', 'public.guardar_cocrear_seguro(bigint, jsonb)', 'private_api.cotizacion_segura(bigint)']) {
      expect(con.md5[f], f).toBe(antes.md5[f]);
    }
  });
  it('tras el rollback: md5 de pg_get_functiondef, triggers, objetos nuevos y privilegios = antes de aplicar', async () => {
    await db.exec(rollbackDe(VH148B));
    expect(await huella(db)).toEqual(antes);
  });
  it('y el comportamiento vuelve a ser el de VH-148 (NULL = sin control): el rollback es real', async () => {
    const id = await sembrarCot(db);
    const r = await guardar3(db, VENDEDOR, id, { cliente: 'sin control' }, null);
    expect(r.c.cliente).toBe('sin control');
  });
});

// ============================================================================
//  PASO 2 (PROPUESTA_vh148c): retirar las escrituras sin versión. Se prueba que funciona, que el cliente
//  VIEJO se rompe (por eso no se aplica antes de desplegar el nuevo) y que su rollback lo devuelve.
// ============================================================================
describe('VH-148c · PASO 2: sin firmas sin versión ni UPDATE directo de expedientes', () => {
  let db;
  beforeAll(async () => {
    db = await baseProduccion();
    for (const a of [VH148, VH148B, VH148C]) await db.exec(leer(a));
  }, 120_000);
  afterAll(async () => { await db?.close(); });

  it('el cliente VIEJO (dos argumentos / UPDATE directo) queda sin permiso (42501): por eso va DESPUÉS del cliente nuevo', async () => {
    const id = await sembrarCot(db);
    expect((await fallo(guardar2(db, VENDEDOR, id, { cliente: 'x' })))?.code).toBe('42501');
    expect((await fallo(cocrear2(db, VENDEDOR, null, { nombre: 'x' })))?.code).toBe('42501');
    const exp = await sembrarExp(db);
    expect((await fallo(updateDirectoExp(db, DISENO, exp, 1, 'x')))?.code).toBe('42501');
  });
  it('el cliente NUEVO (con versión) guarda todo: cotización, expediente, cocreación (crear y editar)', async () => {
    const id = await sembrarCot(db);
    const v = await vista(db, VENDEDOR, id);
    expect((await guardar3(db, VENDEDOR, id, { cliente: 'nuevo' }, v.actualizado)).c.ok).toBe(true);
    const exp = await sembrarExp(db);
    expect((await rpcExp(db, DISENO, exp, { nombre: 'nuevo' }, 1)).r.revision).toBe(2);
    const { r: c } = await cocrear3(db, VENDEDOR, null, { nombre: 'Banca' }, null);
    expect(c.revision).toBe(1);
    expect((await cocrear3(db, VENDEDOR, c.expediente_id, { nombre: 'Banca 2' }, 1)).r.revision).toBe(2);
  });
  it('rollback del paso 2: el cliente viejo vuelve a guardar', async () => {
    await db.exec(rollbackDe(VH148C));
    const id = await sembrarCot(db);
    expect((await guardar2(db, VENDEDOR, id, { cliente: 'viejo otra vez' })).c.ok).toBe(true);
    const exp = await sembrarExp(db);
    await updateDirectoExp(db, DISENO, exp, 1, 'viejo');
    expect((await db.query('select revision from public.expedientes where id=$1', [exp])).rows[0].revision).toBe(2);
  });
});

// ============================================================================
//  COMPOSICIÓN con VH-035c (producción), SEG-01 y SEG-01b en varios órdenes: ninguna pisa objetos de otra
//  (md5 idéntico al de cada una aplicada sola) y el control de versión convive con la fusión de economía y
//  con el gate de emisión.
// ============================================================================
const OBJ_VH148B = ['private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)', 'public.guard_producto_version()',
  'private_api.actualizar_expediente_seguro(bigint, jsonb, integer)', 'private_api.guardar_cocrear_seguro(bigint, jsonb, integer)', 'private_api.vh148_sube_version()'];
const OBJ_OTRAS = ['private_api.actualizar_cotizacion_segura(bigint, jsonb)', 'public.strip_seller_economics_on_cotizacion_write()',
  'private_api.evaluar_emision_cotizacion(bigint, jsonb)', 'public.evaluar_emision_cotizacion(bigint, jsonb)', 'private_api.motivos_autoridad_costeo(bigint)'];
async function md5s(db, firmas) { const o = {}; for (const f of firmas) o[f] = (await existe(db, f)) ? await md5Def(db, f) : null; return o; }

describe('VH-148b · COMPOSICIÓN con VH-035c, SEG-01 y SEG-01c', () => {
  let solaVh, solaSeg;
  it('SEG-01c en modo ESTRICTO evaluado por una sesión real (rol authenticated): sin errores de permisos, y bloquea el renglón sin costeo', async () => {
    const db = await baseProduccion();
    try {
      for (const f of [VH148, VH148B, SEG01, SEG01C]) await db.exec(leer(f));   // SEG-01c exige VH-148b antes
      await db.exec(`update private_api.politica_emision_autoridad set modo = 'estricto'`);
      const id = await sembrarCot(db);
      const vv = await vista(db, VENDEDOR, id);
      const precioLista = vv.partidas.reduce((s, p) => s + p.precioUnitario * p.cantidad, 0);
      const snap = { cliente: vv.cliente, partidas: vv.partidas, totales: { precioLista, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva: 0 }, total: precioLista };
      const g = (await uno(db, VENDEDOR, 'select public.evaluar_emision_cotizacion($1, $2::jsonb) as g', [id, JSON.stringify(snap)])).g;
      expect(JSON.stringify(g)).toMatch(/sin_costeo_servidor/);
    } finally { await db.close(); }
  }, 120_000);
  beforeAll(async () => {
    const a = await baseProduccion(); for (const f of [VH148, VH148B]) await a.exec(leer(f)); solaVh = await md5s(a, OBJ_VH148B); await a.close();
    // SEG-01c exige VH-148b: la referencia de SEG-01/SEG-01c se toma con VH-148/VH-148b debajo.
    const b = await baseProduccion(); for (const f of [VH148, VH148B, SEG01, SEG01C]) await b.exec(leer(f)); solaSeg = await md5s(b, OBJ_OTRAS); await b.close();
  }, 240_000);

  it('SEG-01c ANTES de VH-148b se rechaza al aplicar (sin el trigger de versión el CAS del vínculo no detecta nada)', async () => {
    const db = await baseProduccion();
    try {
      await db.exec(leer(SEG01));
      expect((await fallo(db.exec(leer(SEG01C))))?.message).toMatch(/requiere VH-148b/);
    } finally { await db.close(); }
  }, 120_000);

  for (const [nombre, orden, conVh035c] of [
    ['SEG-01 → VH-148 → VH-148b → SEG-01c', [SEG01, VH148, VH148B, SEG01C], true],
    ['VH-148 → VH-148b → SEG-01 → SEG-01c', [VH148, VH148B, SEG01, SEG01C], true],
    ['(base sin VH-035c) VH-148 → VH-148b → VH-035c → SEG-01 → SEG-01c', [VH148, VH148B, VH035C, SEG01, SEG01C], false],
  ]) {
    it(`orden ${nombre}: objetos intactos y control de versión + economía + gate funcionando`, async () => {
      const db = await baseProduccion({ conVh035c });
      try {
        for (const f of orden) await db.exec(leer(f));
        expect(await md5s(db, OBJ_VH148B)).toEqual(solaVh);
        expect(await md5s(db, OBJ_OTRAS)).toEqual(solaSeg);
        // Dirección costeó; el vendedor guarda CON versión: VH-035c conserva la economía de Dirección.
        const id = await sembrarCot(db);
        const v = await vista(db, VENDEDOR, id);
        await guardar3(db, VENDEDOR, id, { cliente: 'Vendedor', partidas: v.partidas }, v.actualizado);
        expect((await vista(db, DIRECCION, id)).partidas.find((p) => p.id === 'p1').costoUnitario).toBe(6000);
        // La versión vieja choca; NULL exige versión.
        expect((await fallo(guardar3(db, VENDEDOR, id, { cliente: 'viejo' }, v.actualizado)))?.code).toBe('40001');
        expect((await fallo(guardar3(db, VENDEDOR, id, { cliente: 'nulo' }, null)))?.code).toBe('22004');
        // El gate de emisión (SEG-01) sigue rechazando un snapshot que no es lo costeado.
        const vv = await vista(db, VENDEDOR, id);
        const partidas = vv.partidas.map((p) => (p.id === 'p1' ? { ...p, nombre: 'NOGAL MACIZO' } : p));
        const precioLista = partidas.reduce((s, p) => s + p.precioUnitario * p.cantidad, 0);
        const snap = { cliente: vv.cliente, partidas, totales: { precioLista, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva: 0 }, total: precioLista };
        const g = (await uno(db, VENDEDOR, 'select public.evaluar_emision_cotizacion($1, $2::jsonb) as g', [id, JSON.stringify(snap)])).g;
        expect(g.state).toBe('BLOCKED');
      } finally { await db.close(); }
    }, 120_000);
  }
});
