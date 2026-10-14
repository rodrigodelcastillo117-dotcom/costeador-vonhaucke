// ============================================================================
//  SEG-01 · GATE DE EMISIÓN: el snapshot del cliente sólo se ata a lo costeado por `id` de renglón.
//  PRUEBA EN BASE AISLADA (PGlite = PostgreSQL real en WASM). Nada toca producción.
//
//  Defecto (auditoría de seguridad 2026-10-13, docs/auditoria/SEGURIDAD_10.md):
//  `private_api.evaluar_emision_cotizacion` toma el COSTO del renglón persistido (bien: nunca del
//  snapshot) pero sólo verifica que el snapshot tenga el mismo número de renglones y la misma
//  identidad (`id`/`piezaId`/`producto_id`/`nombre`, el primero que exista). Descripción,
//  medidas, material y cantidad del snapshot son libres. `emitir_revision_v2` guarda ESE snapshot
//  como revisión 'generado_v2' y `asignar_folio_oficial` le da folio oficial.
//
//  Escenario: Dirección costeó un escritorio de melamina (costo 6,000). El vendedor dueño llama
//  a la RPC con un snapshot que conserva `id:'p1'` pero dice "nogal macizo 300x120" a 9,000. El
//  margen se calcula contra el costo de la melamina (33% ≥ mínimo 30%) ⇒ ALLOWED sin pasar por
//  Dirección, y el documento oficial promete otro producto.
//
//  Estas pruebas DOCUMENTAN EL COMPORTAMIENTO VIGENTE (defecto). Cuando se corrija, el caso
//  "defecto vigente" debe invertirse (esperar BLOCKED) y los de control deben seguir igual.
//
//  Cuerpos de private_api: copia EXACTA de producción (md5 verificado abajo) en
//  fixtures/private_api_emision_prod_20261013.sql. Wrappers públicos y triggers: baseline
//  (md5 idéntico a producción para los wrappers usados aquí, verificado el 2026-10-13).
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { leer, defDeBaseline, MD5_PROD, DIRECCION, VENDEDOR, baseAislada, uno, evaluar, emitir, folio } from './fixtures/emisionBaseAislada.js';

// Renglón legacy (sin producto_id): lo que Dirección costeó y quedó guardado.
const COSTEADO = {
  id: 'p1', nombre: 'Escritorio operativo melamina blanca', medidas: '120x60x75', material: 'Melamina 16 mm',
  cantidad: 1, precioUnitario: 10000, costoUnitario: 6000,
};
// Snapshot armado a mano por el vendedor: misma identidad, OTRO producto.
const snapshotCon = (precio) => {
  const cantidad = 20;
  const precioLista = precio * cantidad, iva = Math.round(precioLista * 0.16 * 100) / 100;
  return {
    cliente: 'Cliente demo', folio: 'COT-DEMO',
    partidas: [{ id: 'p1', nombre: 'Escritorio ejecutivo NOGAL MACIZO con cajonera', medidas: '300x120x75',
      material: 'Nogal macizo 38 mm', cantidad, precioUnitario: precio }],
    totales: { precioLista, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva },
    total: precioLista + iva,
  };
};

async function sembrarCosteadaPorDireccion(db) {
  // Dirección guarda (el trigger NO despoja economía a Dirección) a nombre del vendedor.
  const { id } = await uno(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, folio, partidas, total, piezas) values ($1, 'Cliente demo', 'COT-DEMO', $2::jsonb, 10000, 1) returning id`,
    [VENDEDOR, JSON.stringify([COSTEADO])]);
  return id;
}

describe('SEG-01 · el gate de emisión no ata descripción/material del snapshot al renglón costeado', () => {
  let db;
  beforeAll(async () => { db = await baseAislada(); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('la fixture es el SQL EXACTO de producción (md5 de pg_get_functiondef)', async () => {
    for (const [fn, md5] of Object.entries(MD5_PROD)) {
      const { h } = (await db.query(`select md5(pg_get_functiondef($1::regproc)) as h`, [fn])).rows[0];
      expect(h, fn).toBe(md5);
    }
  });

  it('control: con el costo persistido de Dirección, precio bajo el margen mínimo ⇒ APPROVAL_REQUIRED', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    const g = await evaluar(db, VENDEDOR, id, snapshotCon(8000)); // (8000-6000)/8000 = 25% < 30%
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(g.reasons.some((m) => /^linea_1_margen_bajo_/.test(m))).toBe(true);
  });

  it('control fail-closed: si el VENDEDOR guardó el renglón (costo despojado) ⇒ ECONOMICS_INCOMPLETE', async () => {
    const { id } = await uno(db, VENDEDOR,
      `insert into public.cotizaciones(usuario, cliente, partidas, total, piezas) values ($1, 'Cliente demo', $2::jsonb, 10000, 1) returning id`,
      [VENDEDOR, JSON.stringify([COSTEADO])]);
    const g = await evaluar(db, VENDEDOR, id, snapshotCon(9000));
    expect(g.state).toBe('ECONOMICS_INCOMPLETE');
  });

  // SEG-01 (P1, VIGENTE en producción). it.fails: la prueba exige el comportamiento CORRECTO y hoy falla, así que el
  // defecto queda VISIBLE (no un verde que lo normalice). Cuando se corrija, vitest avisa y se quita el `.fails`.
  // Reproducción completa (gate ALLOWED → revisión generado_v2 con nogal 300x120 → folio VH-AAAA-NNNNN mientras
  // lo persistido sigue siendo la melamina de $6,000): docs/auditoria/SEGURIDAD_10.md § SEG-01.
  it.fails('SEG-01: un snapshot con OTRO producto (nogal 300x120, x20) no debe pasar el gate ni recibir folio', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    const snap = snapshotCon(9000); // margen calculado contra el costo de la MELAMINA: (9000-6000)/9000 = 33.3% ≥ 30%
    const g = await evaluar(db, VENDEDOR, id, snap);
    expect(g.state).not.toBe('ALLOWED');        // correcto: BLOCKED (el renglón no corresponde a lo costeado)
    const r = await emitir(db, VENDEDOR, id, snap);
    expect(r.nueva).not.toBe(true);
    const f = await folio(db, VENDEDOR, id).catch(() => null);
    expect(f).toBeNull();
  });

  // SEG-06 (P3, familia VH-035, VIGENTE): it.fails con el comportamiento correcto (el costo de Dirección se conserva).
  it.fails('SEG-06: asignar_folio_oficial llamado por el vendedor NO debe borrar el costo de Dirección del renglón', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    await emitir(db, VENDEDOR, id, snapshotCon(9000));
    await folio(db, VENDEDOR, id);
    const fila = (await db.query(`select partidas from public.cotizaciones where id=$1`, [id])).rows[0];
    // El UPDATE de folio_oficial dispara trg_strip_seller_economics con el JWT del vendedor.
    expect(Number(fila.partidas[0].costoUnitario)).toBe(6000);
  });
});

// ============================================================================
//  PROPUESTA SEG-01 (supabase/migrations/PROPUESTA_seg01_emision_snapshot_fiel.sql) · NO aplicada en producción.
//  Misma base aislada (SQL EXACTO de producción) + la propuesta encima. Los `it.fails` de arriba siguen describiendo
//  producción SIN la propuesta; aquí se exige el comportamiento corregido.
// ============================================================================
const PROPUESTA_SEG01 = 'supabase/migrations/PROPUESTA_seg01_emision_snapshot_fiel.sql';
const VH035C = 'supabase/migrations/PROPUESTA_vh035c_preserva_economia_integral.sql';
const VH148 = 'supabase/migrations/PROPUESTA_vh148_control_optimista_cotizacion.sql';

function defDePrivateApi(nombre) {
  const sql = leer('supabase/schema/baseline/08_private_api.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION private_api.${nombre}(`);
  if (ini < 0) throw new Error(`no está private_api.${nombre} en el baseline`);
  const fin = sql.indexOf('$function$;', ini);
  return sql.slice(ini, fin + '$function$;'.length);
}
function sqlRollback(archivo, etiqueta) {
  const sql = leer(archivo);
  const ini = sql.indexOf(`-- >>> ROLLBACK ${etiqueta} INICIO`);
  const fin = sql.indexOf(`-- <<< ROLLBACK ${etiqueta} FIN`);
  if (ini < 0 || fin < 0) throw new Error(`${archivo} no trae el bloque de rollback ${etiqueta}`);
  return sql.slice(ini, fin);
}

// Base de producción + RPC de lectura/guardado (wrappers públicos del baseline sobre los cuerpos de producción del
// fixture) + cotizacion_emitible del baseline, y luego las propuestas en el orden dado.
async function baseConPropuestas(archivos) {
  const db = await baseAislada();
  await db.exec(defDePrivateApi('cotizacion_emitible'));
  for (const f of ['cotizacion_segura', 'actualizar_cotizacion_segura', 'cotizacion_emitible']) await db.exec(defDeBaseline(f));
  for (const a of archivos) await db.exec(leer(a));
  return db;
}

const vistaDe = async (db, email, id) => (await uno(db, email, 'select public.cotizacion_segura($1) as c', [id])).c;
const guardar = (db, email, id, patch) => uno(db, email, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify(patch)]);
const emitible = async (db, email, id) => (await uno(db, email, 'select public.cotizacion_emitible($1) as c', [id])).c;
const revisiones = async (db, id) => Number((await db.query('select count(*)::int as n from public.cotizaciones_revisiones where cotizacion_id=$1', [id])).rows[0].n);
const folioOficial = async (db, id) => (await db.query('select folio_oficial from public.cotizaciones where id=$1', [id])).rows[0].folio_oficial;
const md5Def = async (db, firma) => (await db.query('select md5(pg_get_functiondef($1::regprocedure)) as m', [firma])).rows[0].m;
// Dirección aprueba EXACTAMENTE ese hash (como resolver_aprobacion; escrito directo: el harness no trae esa RPC).
const aprobarHash = (db, id, hash) => db.query(
  `insert into public.aprobaciones(cotizacion_id, revision_hash, estado, resuelto_por, resuelto_en, reglas_version) values ($1, $2, 'APROBADA', $3, now(), 1)`,
  [id, hash, DIRECCION]);

// Snapshot con la misma escalera de dinero que emitir_revision_v2 exige (precioLista = Σ round(pu×cant, 2), total = suma).
function snapshotDe(partidas) {
  const precioLista = partidas.reduce((s, p) => s + Math.round(p.precioUnitario * p.cantidad * 100) / 100, 0);
  const iva = Math.round(precioLista * 0.16 * 100) / 100;
  return { cliente: 'Cliente demo', folio: 'COT-DEMO', partidas,
    totales: { precioLista, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva }, total: Math.round((precioLista + iva) * 100) / 100 };
}
// El snapshot LEGÍTIMO: lo que el vendedor tiene en pantalla = la fila (vista sin economía), con cambios opcionales.
const snapshotFiel = async (db, id, cambios = {}, email = VENDEDOR) =>
  snapshotDe((await vistaDe(db, email, id)).partidas.map((p) => ({ ...p, ...cambios })));

describe('PROPUESTA SEG-01 · el gate exige que el renglón del snapshot SEA lo costeado (producción + propuesta)', () => {
  let db;
  beforeAll(async () => { db = await baseConPropuestas([PROPUESTA_SEG01]); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('estructura: sólo cambia private_api.evaluar_emision_cotizacion (misma firma, STABLE SECURITY DEFINER); el resto sigue byte a byte', async () => {
    for (const [fn, md5] of Object.entries(MD5_PROD)) {
      const { h } = (await db.query('select md5(pg_get_functiondef($1::regproc)) as h', [fn])).rows[0];
      if (fn === 'private_api.evaluar_emision_cotizacion') expect(h, fn).not.toBe(md5);
      else expect(h, fn).toBe(md5);
    }
    const r = (await db.query(`select p.provolatile, p.prosecdef, pg_get_function_identity_arguments(p.oid) as args, p.proconfig
      from pg_proc p where p.oid = 'private_api.evaluar_emision_cotizacion(bigint, jsonb)'::regprocedure`)).rows[0];
    expect(r).toEqual({ provolatile: 's', prosecdef: true, args: 'p_cotizacion_id bigint, p_snapshot jsonb', proconfig: ['search_path=public'] });
    // Las ayudas no son invocables por los roles del cliente.
    for (const f of ['private_api.claves_libres_emision_partida()', 'private_api.partida_cotejable_emision(jsonb)', 'private_api.campos_partida_no_corresponden(jsonb, jsonb)']) {
      const { a, b, c } = (await db.query(`select has_function_privilege('anon', $1, 'EXECUTE') a, has_function_privilege('authenticated', $1, 'EXECUTE') b,
        has_function_privilege('public', $1, 'EXECUTE') c`, [f])).rows[0];
      expect([a, b, c], f).toEqual([false, false, false]);
    }
    await db.exec(leer(PROPUESTA_SEG01));   // re-aplicar es idempotente (la precondición reconoce su propio cuerpo)
  });

  it('(1) SEG-01: el snapshot con OTRO producto (nogal 300x120, x20) ⇒ BLOCKED, sin revisión y sin folio', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    const snap = snapshotCon(9000);
    const g = await evaluar(db, VENDEDOR, id, snap);
    expect(g.state).toBe('BLOCKED');
    expect(g.reasons).toContain('linea_1_no_corresponde_a_lo_costeado');
    expect(g.discrepancias).toEqual({ linea_1: ['cantidad', 'material', 'medidas', 'nombre'] });
    expect(JSON.stringify(g)).not.toMatch(/6000|costo/i);           // la razón no filtra economía al vendedor
    await expect(emitir(db, VENDEDOR, id, snap)).rejects.toThrow(/emisión bloqueada \[BLOCKED\].*linea_1_no_corresponde_a_lo_costeado/);
    expect(await revisiones(db, id)).toBe(0);
    await expect(folio(db, VENDEDOR, id)).rejects.toThrow(/no tiene una revisión emitida/);
    expect(await folioOficial(db, id)).toBeNull();
    // Ni con una aprobación de Dirección sobre ESE hash: lo aprobado no es lo costeado.
    await aprobarHash(db, id, g.hash);
    expect((await evaluar(db, VENDEDOR, id, snap)).state).toBe('BLOCKED');
    await expect(emitir(db, VENDEDOR, id, snap)).rejects.toThrow(/BLOCKED/);
    expect(await revisiones(db, id)).toBe(0);
  });

  it.each([
    ['descripción', { nombre: 'Escritorio ejecutivo NOGAL MACIZO' }, ['nombre']],
    ['medidas', { medidas: '300x120x75' }, ['medidas']],
    ['material', { material: 'Nogal macizo 38 mm' }, ['material']],
    ['configuración anidada', { config: { finish: 'nogal' } }, ['config']],
    ['producto_id / producto_version_id', { producto_id: 1, producto_version_id: 1933 }, ['producto_id', 'producto_version_id']],
    ['nota impresa', { nota: 'incluye cajonera de nogal' }, ['nota']],
  ])('(1b) cambiar SÓLO %s del renglón (mismo id, mismo precio) ⇒ BLOCKED', async (_n, cambio, campos) => {
    const id = await sembrarCosteadaPorDireccion(db);
    const snap = await snapshotFiel(db, id, cambio);
    const g = await evaluar(db, VENDEDOR, id, snap);
    expect(g.state).toBe('BLOCKED');
    expect(g.reasons).toContain('linea_1_no_corresponde_a_lo_costeado');
    expect(g.discrepancias.linea_1).toEqual(campos);
    await expect(emitir(db, VENDEDOR, id, snap)).rejects.toThrow(/BLOCKED/);
    expect(await revisiones(db, id)).toBe(0);
  });

  it('(2) legítimo: mismo renglón, sólo cambia el precio dentro del margen ⇒ ALLOWED, se emite y recibe folio', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    const snap = await snapshotFiel(db, id, { precioUnitario: 9500 });   // (9500-6000)/9500 = 36.8% ≥ 30%
    const g = await evaluar(db, VENDEDOR, id, snap);
    expect(g.state).toBe('ALLOWED');
    expect(g.discrepancias).toBeUndefined();
    const r = await emitir(db, VENDEDOR, id, snap);
    expect(r).toMatchObject({ nueva: true, revision: 1, gate: 'ALLOWED' });
    // Re-emitir idéntico no duplica (hash igual): contrato de emitir_revision_v2 intacto. (Antes del folio: el UPDATE
    // de asignar_folio_oficial con el JWT del vendedor despoja el costo de la fila — SEG-06, fuera de esta propuesta.)
    expect(await emitir(db, VENDEDOR, id, snap)).toMatchObject({ nueva: false, revision: 1 });
    expect(await folio(db, VENDEDOR, id)).toMatch(/^VH-\d{4}-\d{5}$/);
    const rev = (await db.query(`select snapshot from public.cotizaciones_revisiones where cotizacion_id=$1`, [id])).rows[0].snapshot;
    expect(rev.partidas[0]).toMatchObject({ nombre: COSTEADO.nombre, medidas: COSTEADO.medidas, material: COSTEADO.material, cantidad: 1, precioUnitario: 9500 });
  });

  it('(2b) sin falsos positivos: economía en el snapshot (Dirección), null = ausente, cambios_rechazados del servidor y cotizacion_emitible', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    // Dirección emite con su vista CON economía: se ignora, el costo sale de la fila.
    expect((await evaluar(db, DIRECCION, id, await snapshotFiel(db, id, {}, DIRECCION))).state).toBe('ALLOWED');
    // Claves en null (crearPartida las manda; VH-035c las quita al guardar) y la anotación del servidor no cuentan.
    const ruido = await snapshotFiel(db, id, { source_type: null, lista_precio_item_id: null, cambios_rechazados: [{ campo: 'source_type', motivo: 'PROCEDENCIA_CONGELADA' }] });
    expect((await evaluar(db, VENDEDOR, id, ruido)).state).toBe('ALLOWED');
    // Un costo inventado en el snapshot del vendedor NO se usa (control de producción que se conserva).
    const g = await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 8000, costoUnitario: 1, margen: 99 }));
    expect(g.state).toBe('APPROVAL_REQUIRED');
    // cotizacion_emitible arma el snapshot desde la fila (con economía): sigue ALLOWED.
    expect(await emitible(db, VENDEDOR, id)).toMatchObject({ ok: true, estado: 'ALLOWED' });
  });

  it('(3) margen bajo con el renglón fiel ⇒ APPROVAL_REQUIRED; con aprobación de Dirección de ese hash ⇒ ALLOWED y se emite', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    const snap = await snapshotFiel(db, id, { precioUnitario: 8000 });   // (8000-6000)/8000 = 25% < 30%
    const g = await evaluar(db, VENDEDOR, id, snap);
    expect(g.state).toBe('APPROVAL_REQUIRED');
    expect(g.reasons.some((m) => /^linea_1_margen_bajo_/.test(m))).toBe(true);
    await expect(emitir(db, VENDEDOR, id, snap)).rejects.toThrow(/APPROVAL_REQUIRED/);
    expect(await revisiones(db, id)).toBe(0);
    await aprobarHash(db, id, g.hash);
    expect((await evaluar(db, VENDEDOR, id, snap)).state).toBe('ALLOWED');
    expect(await emitir(db, VENDEDOR, id, snap)).toMatchObject({ nueva: true, revision: 1 });
  });

  it('(4) cantidad distinta de la fila sin guardar ⇒ BLOCKED; guardada por el vendedor ⇒ ECONOMICS_INCOMPLETE (recosteo); recosteada por Dirección ⇒ ALLOWED', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    // Costo de Dirección para 1 pieza; el snapshot dice 20 (el costo unitario de un lote de 20 es otro).
    const snap20 = await snapshotFiel(db, id, { cantidad: 20, precioUnitario: 9000 });
    const g = await evaluar(db, VENDEDOR, id, snap20);
    expect(g.state).toBe('BLOCKED');
    expect(g.reasons).toEqual(['linea_1_no_corresponde_a_lo_costeado']);
    expect(g.discrepancias).toEqual({ linea_1: ['cantidad'] });
    await expect(emitir(db, VENDEDOR, id, snap20)).rejects.toThrow(/BLOCKED/);
    // La cantidad cambia GUARDANDO. En producción el guardado del vendedor despoja el costo ⇒ pide recosteo.
    const vista = await vistaDe(db, VENDEDOR, id);
    await guardar(db, VENDEDOR, id, { partidas: vista.partidas.map((p) => ({ ...p, cantidad: 20, precioUnitario: 9000 })), total: 180000, piezas: 20 });
    const g2 = await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id));
    expect(g2.state).toBe('ECONOMICS_INCOMPLETE');
    expect(g2.reasons).toContain('linea_1_costo_desconocido');
    await expect(emitir(db, VENDEDOR, id, await snapshotFiel(db, id))).rejects.toThrow(/ECONOMICS_INCOMPLETE/);
    // Dirección recostea el lote de 20 y guarda; el mismo snapshot fiel ya se emite.
    const vd = await vistaDe(db, DIRECCION, id);
    await guardar(db, DIRECCION, id, { partidas: vd.partidas.map((p) => ({ ...p, costoUnitario: 5200, cost_status: 'KNOWN' })) });
    const snap = await snapshotFiel(db, id);
    expect((await evaluar(db, VENDEDOR, id, snap)).state).toBe('ALLOWED');   // (9000-5200)/9000 = 42%
    expect(await emitir(db, VENDEDOR, id, snap)).toMatchObject({ nueva: true, revision: 1 });
  });

  it('(5) renglones de más / de menos y renglones reordenados siguen bloqueados', async () => {
    const id = await sembrarCosteadaPorDireccion(db);
    const fiel = await snapshotFiel(db, id);
    const g = await evaluar(db, VENDEDOR, id, snapshotDe([...fiel.partidas, { ...fiel.partidas[0], id: 'p2' }]));
    expect(g.state).toBe('BLOCKED');
    expect(g.reasons).toContain('partidas_no_corresponden_a_cotizacion');
  });

  it('rollback: deja el gate BYTE A BYTE como producción (md5) y quita las ayudas; el defecto vuelve (prueba de que el rollback es real)', async () => {
    const db2 = await baseConPropuestas([PROPUESTA_SEG01]);
    try {
      await db2.exec(sqlRollback(PROPUESTA_SEG01, 'SEG-01'));
      expect(await md5Def(db2, 'private_api.evaluar_emision_cotizacion(bigint, jsonb)')).toBe(MD5_PROD['private_api.evaluar_emision_cotizacion']);
      const { n } = (await db2.query(`select count(*)::int n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
        where s.nspname='private_api' and p.proname in ('claves_libres_emision_partida','partida_cotejable_emision','campos_partida_no_corresponden')`)).rows[0];
      expect(n).toBe(0);
      const id = await sembrarCosteadaPorDireccion(db2);
      expect((await evaluar(db2, VENDEDOR, id, snapshotCon(9000))).state).toBe('ALLOWED');   // producción tal cual
    } finally { await db2.close(); }
  }, 60_000);
});

// ============================================================================
//  COMPOSICIÓN SEG-01 × VH-035c × VH-148 (ninguna aplicada en producción). Las tres en varios órdenes.
//  SEG-01 sólo toca private_api.evaluar_emision_cotizacion; VH-035c el wrapper público del gate y el núcleo de
//  guardado; VH-148 la sobrecarga de tres argumentos y cotizacion_segura ⇒ cualquier orden.
// ============================================================================
const ORDENES_SEG01 = [
  ['SEG01 → vh035c → vh148', [PROPUESTA_SEG01, VH035C, VH148]],
  ['vh035c → vh148 → SEG01', [VH035C, VH148, PROPUESTA_SEG01]],
  ['vh148 → SEG01 → vh035c', [VH148, PROPUESTA_SEG01, VH035C]],
];

for (const [orden, archivos] of ORDENES_SEG01) {
  describe(`COMPOSICIÓN SEG-01 × VH-035c × VH-148 · ${orden}`, () => {
    let db;
    beforeAll(async () => { db = await baseConPropuestas(archivos); }, 120_000);
    afterAll(async () => { await db?.close(); });

    it('estructura: el wrapper público es el de VH-035c y llama al gate de SEG-01', async () => {
      const w = (await db.query(`select prosrc from pg_proc where oid='public.evaluar_emision_cotizacion(bigint, jsonb)'::regprocedure`)).rows[0].prosrc;
      expect(w).toMatch(/motivos_recosteo_pendiente/);
      const g = (await db.query(`select prosrc from pg_proc where oid='private_api.evaluar_emision_cotizacion(bigint, jsonb)'::regprocedure`)).rows[0].prosrc;
      expect(g).toMatch(/campos_partida_no_corresponden/);
      expect(await md5Def(db, 'private_api.emitir_revision_v2(bigint, jsonb)')).toBe(MD5_PROD['private_api.emitir_revision_v2']);
    });

    it('(1) SEG-01 bloqueado y (2) el renglón fiel con precio dentro del margen se emite', async () => {
      const id = await sembrarCosteadaPorDireccion(db);
      const malo = snapshotCon(9000);
      const g = await evaluar(db, VENDEDOR, id, malo);
      expect(g.state).toBe('BLOCKED');
      expect(g.reasons).toContain('linea_1_no_corresponde_a_lo_costeado');
      await expect(emitir(db, VENDEDOR, id, malo)).rejects.toThrow(/BLOCKED/);
      expect(await revisiones(db, id)).toBe(0);
      const bueno = await snapshotFiel(db, id, { precioUnitario: 9500 });
      expect((await evaluar(db, VENDEDOR, id, bueno)).state).toBe('ALLOWED');
      expect(await emitir(db, VENDEDOR, id, bueno)).toMatchObject({ nueva: true, revision: 1 });
      expect(await folio(db, VENDEDOR, id)).toMatch(/^VH-\d{4}-\d{5}$/);
    });

    it('(3) margen bajo ⇒ APPROVAL_REQUIRED', async () => {
      const id = await sembrarCosteadaPorDireccion(db);
      const g = await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 8000 }));
      expect(g.state).toBe('APPROVAL_REQUIRED');
    });

    it('(4) lote: el vendedor guarda otra cantidad en una partida con costo por lote ⇒ VH-035c la marca STALE (recosteo); el snapshot con la cantidad vieja ⇒ BLOCKED', async () => {
      const { id } = await uno(db, DIRECCION,
        `insert into public.cotizaciones(usuario, cliente, folio, partidas, total, piezas) values ($1, 'Cliente demo', 'COT-DEMO', $2::jsonb, 10000, 1) returning id`,
        [VENDEDOR, JSON.stringify([{ ...COSTEADO, costo_por_lote: true }])]);
      const viejo = await snapshotFiel(db, id);             // cantidad 1, lo costeado
      const vista = await vistaDe(db, VENDEDOR, id);
      await guardar(db, VENDEDOR, id, { partidas: vista.partidas.map((p) => ({ ...p, cantidad: 20 })), total: 200000, piezas: 20 });
      const g = await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id));
      expect(g.state).toBe('ECONOMICS_INCOMPLETE');
      expect(g.reasons).toContain('linea_1_recosteo_pendiente_lote_cambiado');
      const gv = await evaluar(db, VENDEDOR, id, viejo);
      expect(gv.state).toBe('BLOCKED');
      expect(gv.discrepancias).toEqual({ linea_1: ['cantidad'] });
      await expect(emitir(db, VENDEDOR, id, viejo)).rejects.toThrow(/BLOCKED/);
      expect(await revisiones(db, id)).toBe(0);
    });

    // RIESGO DE COMPOSICIÓN (era it.fails): VH-035c re-pegaba la economía si el vendedor GUARDABA otro nombre/medidas
    // (claves fuera de su huella de material) ⇒ la fila decía "nogal 300x120" con el costo de la melamina, el snapshot
    // coincidía con ella y el gate salía ALLOWED. CORREGIDO en VH-035c §8 (STALE RECOSTEO_DEFINICION_CAMBIADA ante
    // cualquier cambio no comercial), no en el gate. Ver SEGURIDAD_10.md § Riesgos 1 y VH035C_INTEGRAL.md § 9.
    it('RIESGO VH-035c (corregido): renombrar/redimensionar el renglón GUARDANDO no conserva el costo de Dirección para emitir', async () => {
      const id = await sembrarCosteadaPorDireccion(db);
      const vista = await vistaDe(db, VENDEDOR, id);
      await guardar(db, VENDEDOR, id, { partidas: vista.partidas.map((p) => ({ ...p, nombre: 'Escritorio ejecutivo NOGAL MACIZO con cajonera', medidas: '300x120x75', precioUnitario: 9000 })) });
      // La fila: costo de la melamina fuera (auditable en cost_stale), recosteo pendiente por definición.
      const fila = (await vistaDe(db, DIRECCION, id)).partidas[0];
      expect(fila).not.toHaveProperty('costoUnitario');
      expect(fila.cost_stale).toMatchObject({ motivo: 'RECOSTEO_DEFINICION_CAMBIADA', campos: ['medidas', 'nombre'], economia_previa: { costoUnitario: 6000 } });
      // El snapshot fiel (= la fila guardada) pasa SEG-01, pero el wrapper VH-035c lo bloquea por recosteo pendiente.
      const snap = await snapshotFiel(db, id);
      const g = await evaluar(db, VENDEDOR, id, snap);
      expect(g.state).toBe('ECONOMICS_INCOMPLETE');
      expect(g.reasons).toEqual(expect.arrayContaining(['linea_1_recosteo_pendiente_definicion_cambiada', 'linea_1_costo_desconocido']));
      expect(g.reasons).not.toContain('linea_1_no_corresponde_a_lo_costeado');
      expect(await emitible(db, VENDEDOR, id)).toMatchObject({ ok: false, estado: 'ECONOMICS_INCOMPLETE' });
      await expect(emitir(db, VENDEDOR, id, snap)).rejects.toThrow(/ECONOMICS_INCOMPLETE/);
      expect(await revisiones(db, id)).toBe(0);
      expect(await folioOficial(db, id)).toBeNull();
      // Dirección recostea el escritorio de nogal (quita la marca, pone su costo) ⇒ el mismo snapshot fiel se emite.
      const vd = await vistaDe(db, DIRECCION, id);
      await guardar(db, DIRECCION, id, { partidas: vd.partidas.map(({ cost_stale, cost_status, ...p }) => ({ ...p, costoUnitario: 5500 })) });
      const snap2 = await snapshotFiel(db, id);
      expect((await evaluar(db, VENDEDOR, id, snap2)).state).toBe('ALLOWED');     // (9000-5500)/9000 = 39% ≥ 30%
      expect(await emitir(db, VENDEDOR, id, snap2)).toMatchObject({ nueva: true, revision: 1 });
      expect(await folio(db, VENDEDOR, id)).toMatch(/^VH-\d{4}-\d{5}$/);
    });

    it('rollback de SEG-01 con VH-035c presente: el gate vuelve a producción (md5) y el wrapper de VH-035c sigue', async () => {
      await db.exec(sqlRollback(PROPUESTA_SEG01, 'SEG-01'));
      expect(await md5Def(db, 'private_api.evaluar_emision_cotizacion(bigint, jsonb)')).toBe(MD5_PROD['private_api.evaluar_emision_cotizacion']);
      const w = (await db.query(`select prosrc from pg_proc where oid='public.evaluar_emision_cotizacion(bigint, jsonb)'::regprocedure`)).rows[0].prosrc;
      expect(w).toMatch(/motivos_recosteo_pendiente/);
      const id = await sembrarCosteadaPorDireccion(db);
      expect((await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id))).state).toBe('ALLOWED');
      await db.exec(leer(PROPUESTA_SEG01));   // y se puede volver a aplicar encima
      expect((await evaluar(db, VENDEDOR, id, snapshotCon(9000))).state).toBe('BLOCKED');
    });
  });
}

// ============================================================================
//  Auditoría 14-oct · posible P1 de D2: un costo con tubular por FRACCIÓN de tramo (D2, sin ratificación de Producción)
//  nunca debe llegar a la emisión como certificado. La cadena real es: servidor → `estado` → renglón de Cotizar
//  (`costoEstado: autoridad.estado`, App.jsx) → `evaluar_emision_cotizacion` (SQL EXACTO de producción, arriba).
// ============================================================================
import { topeEstadoPorPoliticas } from '../../src/datos/topeEstadoCosteo.js';

describe('D2 sin ratificar ⇒ la emisión (SQL de producción) nunca lo trata como certificado', () => {
  let db;
  beforeAll(async () => { db = await baseAislada(); }, 60_000);
  afterAll(async () => { await db?.close(); });
  const insumos = { 'ptr-1x1': { id: 'ptr-1x1', nombre: 'PTR 1x1 cal 18', formato: { tipo: 'tramo', medida: 6 } } };
  const conPatas = [{ nombre: 'Patas', insumoId: 'ptr-1x1' }];
  const snapFiel = () => ({ cliente: 'Cliente demo', folio: 'COT-DEMO',
    partidas: [{ id: 'p1', nombre: COSTEADO.nombre, medidas: COSTEADO.medidas, material: COSTEADO.material, cantidad: 1, precioUnitario: 10000 }],
    totales: { precioLista: 10000, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva: 1600 }, total: 11600 });
  async function sembrar(costoEstado) {
    const { id } = await uno(db, DIRECCION,
      `insert into public.cotizaciones(usuario, cliente, folio, partidas, total, piezas) values ($1, 'Cliente demo', 'COT-DEMO', $2::jsonb, 11600, 1) returning id`,
      [VENDEDOR, JSON.stringify([{ ...COSTEADO, costoEstado }])]);
    return id;
  }

  it('el servidor topa en preliminar: con D2 un costo "certificado" sale "preliminar"; sin D2 no cambia; ratificada, tampoco', () => {
    expect(topeEstadoPorPoliticas('certificado', { componentes: conPatas, insumos }).estado).toBe('preliminar');
    expect(topeEstadoPorPoliticas('certificado', { componentes: [{ nombre: 'Cubierta', insumoId: 'mel' }], insumos }).estado).toBe('certificado');
    expect(topeEstadoPorPoliticas('incompleto', { componentes: conPatas, insumos }).estado).toBe('incompleto');
    expect(topeEstadoPorPoliticas('certificado', { componentes: conPatas, insumos, d2Ratificada: true }).estado).toBe('certificado');
  });

  it('renglón con el estado que entrega el servidor tras el tope D2 ⇒ ECONOMICS_INCOMPLETE (costo_preliminar_no_certificado)', async () => {
    const estadoSrv = topeEstadoPorPoliticas('certificado', { componentes: conPatas, insumos }).estado;
    const g = await evaluar(db, VENDEDOR, await sembrar(estadoSrv), snapFiel());
    expect(g.state).toBe('ECONOMICS_INCOMPLETE');
    expect(g.reasons).toContain('linea_1_costo_preliminar_no_certificado');
  });

  it('control: el mismo renglón marcado "certificado" pasa el gate — por eso el tope tiene que estar en el servidor', async () => {
    const g = await evaluar(db, VENDEDOR, await sembrar('certificado'), snapFiel());
    expect(g.reasons || []).not.toContain('linea_1_costo_preliminar_no_certificado');
  });
});

// ============================================================================
//  SEG-01c (P0, Operación 9.5 · reauditoría externa 14-oct) · el costo de un renglón especial es el que el SERVIDOR
//  registró y VINCULÓ a esa partida. Sustituye a SEG-01b (nunca aplicada), cuyo bomHash viajaba con el navegador y
//  permitía reutilizar (replay) un costeoId válido en otra cotización. Base: SQL EXACTO de producción + VH-035c
//  (aplicado; md5 del wrapper cf6ef6a3…) + SEG-01 v1 + SEG-01c, con catalogo_vigente/insumo_precios del baseline.
// ============================================================================
import { tablaDeBaseline, vistaCatalogoVigenteProduccion } from './fixtures/erpBaseAislada.js';
const SEG01C = 'supabase/migrations/PROPUESTA_seg01c_vinculo_costeo_partida.sql';
const MD5_WRAPPER_PROD = 'cf6ef6a30bbb68eb2b867f2bcdb7c846';
const DISENO = 'diseno@vh.mx';

describe('SEG-01c · vínculo server-side costeo → cotización → partida (adversarial)', () => {
  let db;
  // Precio aprobado por una persona de Dirección: id 900, melamina 16, $612.40.
  const TRAZA = [{ insumo_id: 'm16', precio_id: 900, precio_usado: 612.4, approved_by: DIRECCION, humana: true }];
  const reg = async (o = {}) => (await db.query(
    `insert into public.costeos_servidor (creado_por, rol, bom_hash, cantidad, costo_unitario, estado, aprobacion_humana, precios)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) returning id`,
    [o.por ?? DIRECCION, o.rol ?? 'direccion', o.bom ?? 'bom-escritorio', o.cantidad ?? 1, o.costo ?? 6000, o.estado ?? 'certificado',
      o.humana ?? true, JSON.stringify(o.precios ?? TRAZA)])).rows[0].id;
  const sembrar = async (extra = {}, partidaId = 'p1') => (await uno(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, folio, partidas, total, piezas) values ($1, 'Cliente demo', 'COT-DEMO', $2::jsonb, 11600, 1) returning id`,
    [VENDEDOR, JSON.stringify([{ ...COSTEADO, id: partidaId, ...extra }])])).id;
  const adjuntar = (email, cot, partida, costeo) => uno(db, email, 'select public.adjuntar_costeo_a_partida($1, $2, $3::uuid) as r', [cot, partida, costeo]);
  const modo = (m) => db.exec(`update private_api.politica_emision_autoridad set modo = '${m}'`);
  const fila = async (id) => (await db.query('select partidas from public.cotizaciones where id=$1', [id])).rows[0].partidas[0];
  // Flujo legítimo completo: Costear registra (Edge) → Dirección agrega y el servidor vincula.
  const legitima = async (o = {}) => { const k = await reg(o); const id = await sembrar({ costeoId: k }); await adjuntar(o.por ?? DIRECCION, id, 'p1', k); return { id, k }; };

  beforeAll(async () => {
    db = await baseConPropuestas([VH035C]);
    expect(await md5Def(db, 'public.evaluar_emision_cotizacion(bigint, jsonb)')).toBe(MD5_WRAPPER_PROD); // base = producción
    await db.exec(`insert into public.permitidos(email, rol) values ('${DISENO}', 'diseno')`);
    await db.exec(`create table public.insumos_catalogo (id text primary key, nombre text, seccion text, clasificacion text, activo boolean default true);`);
    await db.exec(tablaDeBaseline('insumo_precios'));
    await db.exec(vistaCatalogoVigenteProduccion());
    await db.exec(`insert into public.insumos_catalogo(id, nombre) values ('m16', 'Melamina 16 mm');
      insert into public.insumo_precios (id, insumo_id, precio, estado, confidence, vigente_desde, approved_by, approved_at, unidad_compra, precio_compra, factor_conversion, evidence_status, requiere_validacion_compras) overriding system value
        values (900, 'm16', 612.4, 'aprobado', 'alta', '2026-10-01', '${DIRECCION}', now(), 'hoja', 612.4, 1, 'documentada', false);`);
    await db.exec(leer(PROPUESTA_SEG01));
    await db.exec(leer(SEG01C));
    await modo('estricto');
  }, 120_000);
  afterAll(async () => { await db?.close(); });

  it('control: costeo certificado, vinculado por el servidor, precio vigente ⇒ ALLOWED y se emite', async () => {
    const { id } = await legitima();
    const snap = await snapshotFiel(db, id, { precioUnitario: 9500 });
    expect((await evaluar(db, VENDEDOR, id, snap)).state).toBe('ALLOWED');
    expect(await emitir(db, VENDEDOR, id, snap)).toMatchObject({ nueva: true, revision: 1 });
  });

  it('adjuntar escribe la economía DESDE el registro del servidor, no desde lo que trae el navegador', async () => {
    const k = await reg({ costo: 6123.45 });
    const id = await sembrar({ costeoId: k, costoUnitario: 1, costoEstado: 'certificado', bomHash: 'inventado' });
    await adjuntar(DIRECCION, id, 'p1', k);
    expect(await fila(id)).toMatchObject({ costoUnitario: 6123.45, costoEstado: 'certificado', costeoId: k, bomHash: 'bom-escritorio' });
  });

  it('REPLAY (P0 de la reauditoría): el mismo costeoId copiado a OTRA cotización con su bomHash, cantidad y costo ⇒ no se emite', async () => {
    const { k } = await legitima();
    const otra = await sembrar({ costeoId: k, bomHash: 'bom-escritorio', costoUnitario: 6000, costoEstado: 'certificado' });
    const g = await evaluar(db, VENDEDOR, otra, await snapshotFiel(db, otra, { precioUnitario: 9500 }));
    expect(g.state).toBe('ECONOMICS_INCOMPLETE');
    expect(g.reasons).toContain('linea_1_costeo_no_vinculado_a_esta_partida');
    await expect(adjuntar(DIRECCION, otra, 'p1', k)).rejects.toThrow(/ya vinculado a otra partida/);
  });

  it('REPLAY dentro de la misma cotización: otra partida no puede tomar el costeo de la primera', async () => {
    const k = await reg();
    const id = (await uno(db, DIRECCION,
      `insert into public.cotizaciones(usuario, cliente, folio, partidas, total, piezas) values ($1, 'C', 'F', $2::jsonb, 0, 2) returning id`,
      [VENDEDOR, JSON.stringify([{ ...COSTEADO, id: 'a', costeoId: k }, { ...COSTEADO, id: 'b', costeoId: k }])])).id;
    await adjuntar(DIRECCION, id, 'a', k);
    await expect(adjuntar(DIRECCION, id, 'b', k)).rejects.toThrow(/ya vinculado/);
    expect(await private_motivos(id)).toContain('linea_2_costeo_no_vinculado_a_esta_partida');
  });
  const private_motivos = async (id) => (await db.query('select private_api.motivos_autoridad_costeo($1) as m', [id])).rows[0].m;

  it('costeo sin vincular (el navegador sólo puso el costeoId) ⇒ no se emite', async () => {
    const id = await sembrar({ costeoId: await reg() });
    expect((await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 9500 }))).reasons).toContain('linea_1_costeo_no_vinculado_a_esta_partida');
  });

  it('el navegador declara certificado sin costeo del servidor ⇒ no se emite (0 revisiones)', async () => {
    const id = await sembrar({ costoEstado: 'certificado', validado_servidor: true });
    const snap = await snapshotFiel(db, id, { precioUnitario: 9500 });
    expect((await evaluar(db, VENDEDOR, id, snap)).reasons).toContain('linea_1_sin_costeo_servidor');
    await expect(emitir(db, VENDEDOR, id, snap)).rejects.toThrow();
    expect(await revisiones(db, id)).toBe(0);
  });

  it('FRESCURA: si el precio aprobado se cierra (vigente_hasta) después de costear, el costeo deja de servir', async () => {
    const { id } = await legitima();
    await db.exec(`insert into public.insumo_precios (id, insumo_id, precio, estado, confidence, vigente_desde, approved_by, approved_at, unidad_compra, precio_compra, factor_conversion, evidence_status, requiere_validacion_compras) overriding system value
      values (901, 'm16', 650, 'aprobado', 'alta', '2026-10-14', '${DIRECCION}', now(), 'hoja', 650, 1, 'documentada', false); update public.insumo_precios set vigente_hasta = '2026-10-14' where id = 900;`);
    try {
      expect((await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 9500 }))).reasons).toContain('linea_1_costeo_con_precio_ya_no_vigente');
    } finally { await db.exec(`delete from public.insumo_precios where id = 901; update public.insumo_precios set vigente_hasta = null where id = 900;`); }
  });

  it('FRESCURA: un precio que ya no es el que elige catalogo_vigente (llegó uno mejor rankeado) ⇒ no sirve', async () => {
    const { id } = await legitima();
    await db.exec(`insert into public.insumo_precios (id, insumo_id, precio, estado, confidence, vigente_desde, approved_by, approved_at, unidad_compra, precio_compra, factor_conversion, evidence_status, requiere_validacion_compras) overriding system value
      values (902, 'm16', 700, 'aprobado', 'alta', '2026-10-15', '${DIRECCION}', now(), 'hoja', 700, 1, 'documentada', false);`);
    try {
      expect((await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 9500 }))).reasons).toContain('linea_1_costeo_con_precio_ya_no_vigente');
    } finally { await db.exec('delete from public.insumo_precios where id = 902'); }
  });

  it('costeo certificado sin traza de precios ⇒ no se emite (no se puede verificar frescura)', async () => {
    const { id } = await legitima({ precios: [] });
    expect((await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 9500 }))).reasons).toContain('linea_1_costeo_sin_traza_de_precios');
  });

  it('CERTIFICADO con costo $0 no puede existir (CHECK); preliminar $0 sí se registra pero no emite', async () => {
    await expect(reg({ costo: 0 })).rejects.toThrow(/costeo_certificado_positivo/);
    const { id } = await legitima({ costo: 0, estado: 'preliminar' });
    expect((await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 9500 }))).state).toBe('ECONOMICS_INCOMPLETE');
  });

  it.each([
    ['preliminar', { estado: 'preliminar' }, 'linea_1_costeo_servidor_no_certificado'],
    ['sin aprobación humana', { humana: false }, 'linea_1_costeo_servidor_no_certificado'],
  ])('registro %s ⇒ no se emite aunque esté vinculado', async (_n, o, motivo) => {
    const { id } = await legitima(o);
    expect((await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 9500 }))).reasons).toContain(motivo);
  });

  it('Dirección cambia luego el costo del renglón al guardar ⇒ ya no coincide con el servidor', async () => {
    const { id } = await legitima();
    const p = await fila(id);
    await guardar(db, DIRECCION, id, { partidas: [{ ...p, costoUnitario: 4000 }], total: 11600, piezas: 1 });
    expect((await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 9500 }))).reasons).toContain('linea_1_costo_no_coincide_con_servidor');
  });

  it('adjuntar: el vendedor no puede; otra persona no puede usar un costeo ajeno; cantidad distinta exige recostear', async () => {
    const k = await reg();
    const id = await sembrar({ costeoId: k });
    await expect(adjuntar(VENDEDOR, id, 'p1', k)).rejects.toThrow(/sólo Dirección o Diseño/);
    await expect(adjuntar(DISENO, id, 'p1', k)).rejects.toThrow(/otra persona/);
    const k2 = await reg({ cantidad: 20 });
    const id2 = await sembrar({ costeoId: k2 });
    await expect(adjuntar(DIRECCION, id2, 'p1', k2)).rejects.toThrow(/otra cantidad/);
  });

  it('adjuntar es idempotente para la MISMA partida (cada guardado puede re-vincular sin error)', async () => {
    const { id, k } = await legitima();
    expect((await adjuntar(DIRECCION, id, 'p1', k)).r).toMatchObject({ ok: true });
  });

  it('el VENDEDOR intenta cambiar costeoId y costo al guardar ⇒ se le despoja; lo vinculado sigue', async () => {
    const { id, k } = await legitima();
    const barato = await reg({ costo: 100 });
    const vista = await vistaDe(db, VENDEDOR, id);
    await guardar(db, VENDEDOR, id, { partidas: vista.partidas.map((p) => ({ ...p, costeoId: barato, costoUnitario: 100 })), total: 11600, piezas: 1 });
    expect(await fila(id)).toMatchObject({ costeoId: k, costoUnitario: 6000 });
  });

  it('MODO PREPARADO (por omisión al aplicar): no bloquea nada; el diagnóstico dice qué bloquearía', async () => {
    const id = await sembrar({ costoEstado: 'certificado' });
    await modo('preparado');
    try {
      expect((await evaluar(db, VENDEDOR, id, await snapshotFiel(db, id, { precioUnitario: 9500 }))).state).toBe('ALLOWED');
      expect((await uno(db, DIRECCION, 'select public.diagnostico_autoridad_costeo($1) as d', [id])).d)
        .toEqual({ modo: 'preparado', motivos: ['linea_1_sin_costeo_servidor'] });
      await expect(uno(db, VENDEDOR, 'select public.diagnostico_autoridad_costeo($1) as d', [id])).rejects.toThrow(/no autorizado/);
    } finally { await modo('estricto'); }
  });

  it('anon/authenticated no leen ni escriben costeos_servidor ni cuentas_no_humanas', async () => {
    for (const t of ['public.costeos_servidor', 'public.cuentas_no_humanas']) for (const r of ['anon', 'authenticated']) for (const p of ['select', 'insert', 'update', 'delete']) {
      expect((await db.query('select has_table_privilege($1, $2, $3) as ok', [r, t, p])).rows[0].ok, `${r} ${p} ${t}`).toBe(false);
    }
  });

  it('rollback: el wrapper vuelve BYTE A BYTE al de producción', async () => {
    const rb = leer(SEG01C).split('\n').filter((l) => l.startsWith('-- RB ')).map((l) => l.slice(6)).join('\n');
    await db.exec(rb);
    expect(await md5Def(db, 'public.evaluar_emision_cotizacion(bigint, jsonb)')).toBe(MD5_WRAPPER_PROD);
    await db.exec(leer(SEG01C)); await modo('estricto');
  });
});
