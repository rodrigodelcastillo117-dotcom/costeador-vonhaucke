// ============================================================================
//  Firma de precios ERP por Dirección (migración 20261014140000). Base aislada con las tablas y triggers REALES de
//  insumo_precios (append-only, no-autofirma) y la RPC de producción aprobar_precio.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';
import { baseCatalogoAislada, leer, como, fila, filas, DIRECCION, VENDEDOR } from './fixtures/erpBaseAislada.js';

const MIG = 'supabase/migrations/20261014140000_firma_precios_erp_direccion.sql';
const QA = 'qa-direccion@vonhaucke.mx';
const firmar = (db, email, meses = 24) => como(db, email, () => fila(db, 'select public.firmar_precios_erp_vigentes($1) as r', [meses]));

describe('Firma de precios ERP por Dirección', () => {
  let db;
  beforeAll(async () => {
    db = await baseCatalogoAislada();
    await db.exec(`insert into public.permitidos(email, rol) values ('${QA}', 'direccion')`);
    await db.exec(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion)
      values ('a', 'A', 'metal', 'pza', true, 'erp'), ('b', 'B', 'metal', 'pza', true, 'erp'), ('c', 'C', 'metal', 'pza', true, 'erp'),
             ('d', 'D', 'metal', 'pza', true, 'erp'), ('e', 'E', 'metal', 'pza', true, 'erp')`);
    const ins = (id, insumo, desde, doc) => `insert into public.insumo_precios (id, insumo_id, precio, estado, vigente_desde, source_document, unidad_compra, precio_compra, factor_conversion, evidence_status, confidence, requiere_validacion_compras)
      overriding system value values (${id}, '${insumo}', 100, 'propuesto', '${desde}', ${doc ? `'ERP Intelisis · última compra'` : 'null'}, 'pza', 100, 1, 'documentada', 'alta', false)`;
    await db.exec([ins(1, 'a', '2026-09-01', true), ins(2, 'b', '2026-08-01', true), ins(3, 'c', '2023-01-01', true), ins(4, 'd', '2026-07-01', false), ins(5, 'e', '2026-06-01', true)].join(';'));
    // 2 ya aprobado por la cuenta QA; 5 ya aprobado por una persona (no se toca).
    await como(db, QA, () => db.query('select public.aprobar_precio(2)'));
    await como(db, DIRECCION, () => db.query('select public.aprobar_precio(5)'));
    await db.exec(leer(MIG));
  }, 60_000);

  it('la cuenta QA y un vendedor NO pueden firmar', async () => {
    await expect(firmar(db, QA)).rejects.toThrow(/no autorizado/);
    await expect(firmar(db, VENDEDOR)).rejects.toThrow(/no autorizado/);
  });

  it('Dirección firma: el reciente sin aprobar y el aprobado por QA; no el de >24 meses, ni el sin documento, ni el ya humano', async () => {
    const { r } = await firmar(db, DIRECCION);
    expect(r).toMatchObject({ firmados: 2, no_firmados: 0, meses: 24, firmado_por: DIRECCION });
    const ps = await filas(db, 'select id, estado, approved_by from public.insumo_precios order by id');
    expect(ps.map((p) => [p.id, p.estado, p.approved_by])).toEqual([
      [1, 'aprobado', DIRECCION], [2, 'aprobado', DIRECCION], [3, 'propuesto', null], [4, 'propuesto', null], [5, 'aprobado', DIRECCION]]);
  });

  it('el historial conserva quién aprobaba antes (la cuenta QA) y es append-only', async () => {
    const h = await filas(db, 'select precio_id, aprobado_por, aprobado_por_anterior from public.aprobaciones_precio_historial order by precio_id');
    expect(h).toEqual([{ precio_id: 1, aprobado_por: DIRECCION, aprobado_por_anterior: null }, { precio_id: 2, aprobado_por: DIRECCION, aprobado_por_anterior: QA }]);
    await expect(db.exec('update public.aprobaciones_precio_historial set aprobado_por = \'x\'')).rejects.toThrow(/append-only/);
    await expect(db.exec('delete from public.aprobaciones_precio_historial')).rejects.toThrow(/append-only/);
  });

  it('volver a firmar no duplica nada (todo ya tiene firma humana)', async () => {
    expect((await firmar(db, DIRECCION)).r).toMatchObject({ firmados: 0, no_firmados: 0 });
  });

  it('un precio que requiere validación de Compras no se puede aprobar: se reporta, no se fuerza', async () => {
    await db.exec(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion) values ('h', 'H', 'metal', 'pza', true, 'erp');
      insert into public.insumo_precios (id, insumo_id, precio, estado, vigente_desde, source_document, unidad_compra, precio_compra, factor_conversion, evidence_status, confidence, requiere_validacion_compras)
        overriding system value values (8, 'h', 100, 'propuesto', '2026-09-20', 'ERP', 'pza', 100, 1, 'documentada', 'baja', true)`);
    const { r } = await firmar(db, DIRECCION);
    expect(r).toMatchObject({ firmados: 0, no_firmados: 1 });
    expect(Object.keys(r.motivos)[0]).toMatch(/integridad/);
    expect(await filas(db, 'select precio_id from public.aprobaciones_precio_historial where precio_id = 8')).toEqual([]);   // sin rastro falso
  });

  // (Una fila DATA_TRUTH_V1 incompleta no puede ni existir: chk_precios_datatruth_contract la rechaza al insertarse.)
  it('un precio nuevo que llega después también se firma en la siguiente pasada; el que requiere validación sigue fuera', async () => {
    await db.exec(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion) values ('g', 'G', 'metal', 'pza', true, 'erp');
      insert into public.insumo_precios (id, insumo_id, precio, estado, vigente_desde, source_document, unidad_compra, precio_compra, factor_conversion, evidence_status, confidence, requiere_validacion_compras)
        overriding system value values (7, 'g', 100, 'propuesto', '2026-09-15', 'ERP', 'pza', 100, 1, 'documentada', 'alta', false)`);
    const { r } = await firmar(db, DIRECCION);
    expect(r).toMatchObject({ firmados: 1, no_firmados: 1 });
    expect((await fila(db, 'select approved_by from public.insumo_precios where id = 7')).approved_by).toBe(DIRECCION);
    expect((await fila(db, 'select estado from public.insumo_precios where id = 8')).estado).toBe('propuesto');
  });

  it('anon/authenticated no leen el historial ni cuentas_no_humanas', async () => {
    for (const t of ['public.aprobaciones_precio_historial', 'public.cuentas_no_humanas']) for (const rl of ['anon', 'authenticated']) {
      expect((await fila(db, 'select has_table_privilege($1, $2, \'select\') as ok', [rl, t])).ok).toBe(false);
    }
  });
});

describe('Firma por lotes con cursor (20261014150000): no depende del statement_timeout de 8 s', () => {
  const MIG_LOTE = 'supabase/migrations/20261014150000_firma_precios_erp_lote.sql';
  const lote = (db, email, despues, limite) => como(db, email, () =>
    fila(db, 'select public.firmar_precios_erp_lote(24, $1, $2) as r', [despues, limite]));
  let db;
  beforeAll(async () => {
    db = await baseCatalogoAislada();
    await db.exec(`insert into public.permitidos(email, rol) values ('${QA}', 'direccion')`);
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    await db.exec(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion) values
      ${ids.map((i) => `('${i}', '${i.toUpperCase()}', 'metal', 'pza', true, 'erp')`).join(', ')}`);
    const ins = (id, insumo, desde, doc, validar = false) => `insert into public.insumo_precios (id, insumo_id, precio, estado, vigente_desde, source_document, unidad_compra, precio_compra, factor_conversion, evidence_status, confidence, requiere_validacion_compras)
      overriding system value values (${id}, '${insumo}', 100, 'propuesto', '${desde}', ${doc ? `'ERP Intelisis · última compra'` : 'null'}, 'pza', 100, 1, 'documentada', '${validar ? 'baja' : 'alta'}', ${validar})`;
    await db.exec([ins(1, 'a', '2026-09-01', true), ins(2, 'b', '2026-08-01', true), ins(3, 'c', '2023-01-01', true), ins(4, 'd', '2026-07-01', false),
      ins(5, 'e', '2026-06-01', true), ins(6, 'f', '2026-09-20', true, true), ins(7, 'g', '2026-09-21', true, true), ins(8, 'h', '2026-09-15', true)].join(';'));
    await como(db, QA, () => db.query('select public.aprobar_precio(2)'));
    await como(db, DIRECCION, () => db.query('select public.aprobar_precio(5)'));
    await db.exec(leer(MIG)); await db.exec(leer(MIG_LOTE));
  }, 60_000);

  it('la cuenta QA y un vendedor NO pueden; el límite se valida', async () => {
    await expect(lote(db, QA, null, 10)).rejects.toThrow(/no autorizado/);
    await expect(lote(db, VENDEDOR, null, 10)).rejects.toThrow(/no autorizado/);
    await expect(lote(db, DIRECCION, null, 0)).rejects.toThrow(/p_limite/);
    await expect(lote(db, DIRECCION, null, 501)).rejects.toThrow(/p_limite/);
  });

  it('de uno en uno recorre todo: dos precios seguidos que no se pueden aprobar NO frenan el cursor', async () => {
    const pasos = []; let cursor = null;
    for (let i = 0; i < 10; i++) {
      const { r } = await lote(db, DIRECCION, cursor, 1);
      pasos.push([r.firmados, r.no_firmados, r.ultimo_id]);
      cursor = r.ultimo_id; if (cursor == null) break;
    }
    // candidatos: 1 (nuevo), 2 (QA), 6 y 7 (requieren validación), 8 (nuevo); 3 (>24 m), 4 (sin doc), 5 (humano) no.
    expect(pasos).toEqual([[1, 0, 1], [1, 0, 2], [0, 1, 6], [0, 1, 7], [1, 0, 8], [0, 0, null]]);
    const ps = await filas(db, 'select id, estado, approved_by from public.insumo_precios order by id');
    expect(ps.map((p) => [p.id, p.estado, p.approved_by])).toEqual([[1, 'aprobado', DIRECCION], [2, 'aprobado', DIRECCION], [3, 'propuesto', null],
      [4, 'propuesto', null], [5, 'aprobado', DIRECCION], [6, 'propuesto', null], [7, 'propuesto', null], [8, 'aprobado', DIRECCION]]);
    expect((await filas(db, 'select precio_id, aprobado_por_anterior from public.aprobaciones_precio_historial order by precio_id')))
      .toEqual([{ precio_id: 1, aprobado_por_anterior: null }, { precio_id: 2, aprobado_por_anterior: QA }, { precio_id: 8, aprobado_por_anterior: null }]);
  });

  it('un lote más grande que lo pendiente devuelve ultimo_id null (fin)', async () => {
    const { r } = await lote(db, DIRECCION, null, 500);
    expect(r).toMatchObject({ firmados: 0, no_firmados: 2, ultimo_id: null });
  });

  it('anon no puede ejecutarla', async () => {
    expect((await fila(db, "select has_function_privilege('anon', 'public.firmar_precios_erp_lote(integer, bigint, integer)', 'execute') as ok")).ok).toBe(false);
  });
});
