// ============================================================================
//  VH-147 · POLÍTICA ERP_ULTIMA_COMPRA_V1 EN BASE AISLADA (PGlite = PostgreSQL real en WASM).
//
//  Decisión 1 de Dirección (2026-10-13): separar VALIDEZ histórica (un precio ERP documentado nunca
//  caduca ni se vuelve "inventado") de ACTUALIDAD para costo certificado (24 meses desde la última
//  compra, salvo validación comercial documentada más reciente = estado 'aprobado').
//
//  Aquí se carga el esquema REAL (insumos_catalogo, insumo_precios con sus CHECK y triggers,
//  aprobar_precio, la vista catalogo_vigente DE PRODUCCIÓN e insumo_motor de VH-088), se siembra un
//  conjunto sintético y se corre DOS veces:
//    ANTES  = producción tal cual → certificable sólo si estado='aprobado'.
//    DESPUÉS = con PROPUESTA_vh147 → certificable por política, con antigüedad/actualidad/validez/motivo.
//  Al final se ejecuta el ROLLBACK del archivo y se comprueba que la vista vuelve a producción.
//  Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';
import {
  baseCatalogoAislada, leer, rollbackDePropuesta, como, fila, filas, DIRECCION, VENDEDOR,
} from './fixtures/erpBaseAislada.js';

const PROPUESTA = 'supabase/migrations/PROPUESTA_vh147_elegibilidad_erp.sql';
const DOC = 'ERP Intelisis · Costos de Materia Prima Última Compra al 10/08/2026';

// Inserta un precio DATA_TRUTH_V1 como lo hace la RPC cargar_erp_ultima_compra (vh089): precio 0 y el trigger
// sync_precio_legacy lo deja en source_price × fx × factor. `vigente` es una expresión SQL de fecha.
async function precioErp(db, { insumo, source_price, vigente, estado = 'propuesto_validado', moneda = 'MXN', fx = null, rec = null, requiere_validacion = false, evidence = 'documentada' }) {
  const fxSql = fx ? `${fx.rate}, date '${fx.date}', '${fx.source}'` : 'null, null, null';
  const r = await fila(db, `
    insert into public.insumo_precios (insumo_id, precio, contract_status, source_system, source_document, source_record_id,
      source_price, source_currency, source_unit, source_units_per_cost_unit, cost_unit, vigente_desde, estado, confidence,
      evidence_status, evidencia, fuente, creado_por, requiere_validacion_compras, fx_rate, fx_date, fx_source)
    values ($1, 0, 'DATA_TRUTH_V1', 'erp_intelisis', $2, $3, $4, $5, 'hoja', 1, 'hoja', ${vigente}, $6, 'alta',
      $7, 'ERP última compra · ' || $3, 'Compras · ERP Intelisis última compra', 'test', $8, ${fxSql})
    returning id, precio, vigente_desde`,
    [insumo, DOC, rec || `${insumo.toUpperCase()}|`, source_price, moneda, estado, evidence, requiere_validacion]);
  return r;
}
async function insumo(db, id, { nombre = id, activo = true, unidad = 'hoja', clasificacion = 'erp' } = {}) {
  await db.query(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia, atributos)
    values ($1, $2, 'cubiertas', $3, $4, $5, 'melamina', '{"unidad":"hoja","clase":"directa"}'::jsonb)`, [id, nombre, unidad, activo, clasificacion]);
}
const aprobar = (db, id) => como(db, DIRECCION, () => db.query('select public.aprobar_precio($1, $2)', [id, 'validación comercial de prueba']));
const vigente = (db, id) => fila(db, 'select * from public.catalogo_vigente where insumo_id = $1', [id]);

let db;
let meses24; // fecha exacta del borde de la ventana (current_date - 24 meses), según el propio Postgres

async function sembrar(db) {
  // A · compra documentada de 2014 (el caso de los 8 213 "preliminares" reales).
  await insumo(db, 'erp-mel19-2014', { nombre: 'AGLOMERADO MELAMINA DOS CARAS HOJA 4 X 8 ESPESOR 19 mm' });
  await precioErp(db, { insumo: 'erp-mel19-2014', source_price: 306, vigente: "date '2014-08-26'" });
  // B · compra documentada hace 6 meses, estado propuesto_validado (p. ej. una carga hecha por un rol que no pudo aprobar).
  await insumo(db, 'erp-mdf18-reciente');
  await precioErp(db, { insumo: 'erp-mdf18-reciente', source_price: 725.4, vigente: "current_date - interval '6 months'" });
  // C · APROBADO con compra de hace ~44 meses (aprobación = validación comercial documentada).
  await insumo(db, 'erp-apr-viejo');
  const c = await precioErp(db, { insumo: 'erp-apr-viejo', source_price: 645.37, vigente: "date '2023-01-15'", estado: 'propuesto' });
  await aprobar(db, c.id);
  // D · LEGACY sin evidencia, compra reciente → nunca certifica.
  await insumo(db, 'legacy-sin-ev', { clasificacion: 'vigente' });
  await db.query(`insert into public.insumo_precios (insumo_id, precio, unidad_compra, precio_compra, factor_conversion, vigente_desde, estado, confidence, evidence_status, creado_por)
    values ('legacy-sin-ev', 450, 'hoja', 450, 1, current_date - 30, 'propuesto_validado', 'media', 'sin_evidencia', 'semilla')`);
  // E · LEGACY referenciado (lista de Compras sin código ERP), estado propuesto → no certifica.
  await insumo(db, 'legacy-ref', { clasificacion: 'vigente' });
  await db.query(`insert into public.insumo_precios (insumo_id, precio, unidad_compra, precio_compra, factor_conversion, vigente_desde, estado, confidence, evidence_status, fuente, evidencia, creado_por)
    values ('legacy-ref', 437, 'hoja', 437, 1, current_date - 10, 'propuesto', 'media', 'referenciada', 'Compras, lista del 2026-08-14', 'MDF natural 4x8 19 mm', 'semilla')`);
  // F · USD con FX completo, reciente → DOCUMENTADO, precio en MXN = source × fx.
  await insumo(db, 'erp-usd-fx');
  await precioErp(db, { insumo: 'erp-usd-fx', source_price: 10, moneda: 'USD', fx: { rate: 17.5, date: '2026-08-10', source: 'DOF' }, vigente: "current_date - 40" });
  // H · documentado y reciente pero Compras lo marcó para validar.
  await insumo(db, 'erp-req-compras');
  await precioErp(db, { insumo: 'erp-req-compras', source_price: 120, vigente: "current_date - 15", requiere_validacion: true });
  // I · inactivo (BLOQUEADO en el ERP): la vista no lo trae (regla de producción, no cambia).
  await insumo(db, 'erp-inactivo', { activo: false });
  await precioErp(db, { insumo: 'erp-inactivo', source_price: 99, vigente: "current_date - 5" });
  // J · bordes de la ventana: exactamente 24 meses (VIGENTE, inclusive) y 24 meses + 1 día (ANTIGUO).
  await insumo(db, 'erp-borde-dentro');
  await precioErp(db, { insumo: 'erp-borde-dentro', source_price: 100, vigente: '(current_date - make_interval(months => 24))::date' });
  await insumo(db, 'erp-borde-fuera');
  await precioErp(db, { insumo: 'erp-borde-fuera', source_price: 100, vigente: '(current_date - make_interval(months => 24))::date - 1' });
  // K · aprobado reciente (como los 1 753 reales): no cambia.
  await insumo(db, 'erp-apr-reciente');
  const k = await precioErp(db, { insumo: 'erp-apr-reciente', source_price: 86.2068, vigente: "current_date - 100", estado: 'propuesto' });
  await aprobar(db, k.id);
  // L · ranking de producción: aprobado antiguo + propuesto_validado reciente para el MISMO insumo → gana el aprobado.
  await insumo(db, 'erp-dos-precios');
  const l1 = await precioErp(db, { insumo: 'erp-dos-precios', source_price: 500, vigente: "date '2022-03-01'", estado: 'propuesto', rec: 'DOS|A' });
  await aprobar(db, l1.id);
  await precioErp(db, { insumo: 'erp-dos-precios', source_price: 560, vigente: 'current_date - 20', rec: 'DOS|B' });

  // MUESTRA SINTÉTICA (conteos): 240 insumos, compra cada 7 días hacia atrás (0 … 1 673 días ≈ 55 meses);
  // 1 de cada 8 se aprueba (validación comercial). Distribución parecida a la real: mayoría > 24 meses.
  await db.exec(`
    insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia, atributos)
    select 'erp-syn-' || g, 'SINTÉTICO ' || g, 'cubiertas', 'hoja', true, 'erp', 'melamina', '{}'::jsonb from generate_series(1, 240) g;
    insert into public.insumo_precios (insumo_id, precio, contract_status, source_system, source_document, source_record_id,
      source_price, source_currency, source_unit, source_units_per_cost_unit, cost_unit, vigente_desde, estado, confidence,
      evidence_status, evidencia, fuente, creado_por, requiere_validacion_compras)
    select 'erp-syn-' || g, 0, 'DATA_TRUTH_V1', 'erp_intelisis', '${DOC}', 'SYN|' || g, 100 + g, 'MXN', 'hoja', 1, 'hoja',
      current_date - (g * 7), case when g % 8 = 0 then 'propuesto' else 'propuesto_validado' end, 'alta', 'documentada',
      'ERP última compra', 'Compras', 'test', false from generate_series(1, 240) g;
  `);
  const porAprobar = await filas(db, `select id from public.insumo_precios where insumo_id like 'erp-syn-%' and estado = 'propuesto' order by id`);
  for (const r of porAprobar) await aprobar(db, r.id);
}

// Fotografía de lo que NO debe cambiar: filas de la vista, estados, precios.
const foto = (db) => filas(db, `select insumo_id, estado, precio::text as precio, vigente_desde::text as vigente_desde
  from public.catalogo_vigente order by insumo_id`);
const histEstados = (db) => filas(db, `select estado, count(*)::int as n from public.insumo_precios group by 1 order by 1`);

describe('VH-147 · base aislada: esquema real + vista de producción', () => {
  let antes, estadosAntes;
  beforeAll(async () => {
    db = await baseCatalogoAislada();
    await sembrar(db);
    meses24 = (await fila(db, `select (current_date - make_interval(months => 24))::date::text as d`)).d;
    antes = await foto(db);
    estadosAntes = await histEstados(db);
  }, 60_000);

  it('PRODUCCIÓN hoy: certifica sólo lo aprobado; la vista NO expone antigüedad ni motivo', async () => {
    const cols = (await filas(db, `select column_name from information_schema.columns where table_name = 'catalogo_vigente' order by ordinal_position`)).map((r) => r.column_name);
    expect(cols).toHaveLength(17);
    expect(cols).not.toContain('actualidad');
    expect((await vigente(db, 'erp-mel19-2014')).certificable).toBe(false);
    expect((await vigente(db, 'erp-mdf18-reciente')).certificable).toBe(false); // documentado y reciente, pero no aprobado
    expect((await vigente(db, 'erp-apr-viejo')).certificable).toBe(true);
    expect((await vigente(db, 'erp-apr-reciente')).certificable).toBe(true);
    expect(await vigente(db, 'erp-inactivo')).toBeUndefined();
  });

  it('DATA_TRUTH_V1 en moneda ≠ MXN sin FX completo: la tabla lo RECHAZA (chk_precios_datatruth_contract)', async () => {
    await insumo(db, 'erp-usd-sin-fx');
    await expect(precioErp(db, { insumo: 'erp-usd-sin-fx', source_price: 10, moneda: 'USD', vigente: 'current_date - 1' }))
      .rejects.toThrow(/chk_precios/);
  });

  describe('DESPUÉS de PROPUESTA_vh147', () => {
    beforeAll(async () => { await db.exec(leer(PROPUESTA)); }, 60_000);

    it('la vista conserva las 17 columnas de producción en su orden y añade las de la política al final', async () => {
      const cols = (await filas(db, `select column_name from information_schema.columns where table_name = 'catalogo_vigente' order by ordinal_position`)).map((r) => r.column_name);
      expect(cols.slice(0, 17)).toEqual(['insumo_id', 'nombre', 'seccion', 'clasificacion', 'precio', 'unidad_compra', 'precio_compra', 'factor_conversion', 'propiedades', 'estado', 'evidence_status', 'confidence', 'requiere_validacion_compras', 'certificable', 'fuente', 'evidencia', 'vigente_desde']);
      expect(cols.slice(17)).toEqual(['antiguedad_meses', 'actualidad', 'validez', 'motivo_no_certificable', 'ventana_actualidad_meses']);
      expect((await fila(db, 'select private_api.ventana_actualidad_meses() as v')).v).toBe(24);
    });

    it('NO cambia ningún estado, ningún precio ni saca filas de la vista (validez histórica)', async () => {
      expect(await foto(db)).toEqual(antes);
      expect(await histEstados(db)).toEqual(estadosAntes);
    });

    it('A · documentado de 2014: certificable=false, ANTIGUO, motivo con fecha y 24 meses, y SIGUE con precio (PRELIMINAR)', async () => {
      const v = await vigente(db, 'erp-mel19-2014');
      expect(v.certificable).toBe(false);
      expect(v.validez).toBe('DOCUMENTADO');
      expect(v.actualidad).toBe('ANTIGUO');
      expect(v.antiguedad_meses).toBeGreaterThanOrEqual(145);
      expect(v.motivo_no_certificable).toMatch(/2014-08-26/);
      expect(v.motivo_no_certificable).toMatch(/24 meses/);
      expect(v.motivo_no_certificable).toMatch(/PRELIMINAR/);
      expect(Number(v.precio)).toBe(306);
      expect(v.estado).toBe('propuesto_validado'); // intacto
    });

    it('B · documentado ≤ 24 meses: certificable=true aunque el estado siga en propuesto_validado', async () => {
      const v = await vigente(db, 'erp-mdf18-reciente');
      expect(v.estado).toBe('propuesto_validado');
      expect(v.certificable).toBe(true);
      expect(v.actualidad).toBe('VIGENTE');
      expect(v.validez).toBe('DOCUMENTADO');
      expect(v.antiguedad_meses).toBe(6);
      expect(v.motivo_no_certificable).toBeNull();
      expect(Number(v.precio)).toBe(725.4);
    });

    it('C · aprobado con compra > 24 meses: SIGUE certificable (validación comercial) pero expone ANTIGUO y la antigüedad', async () => {
      const v = await vigente(db, 'erp-apr-viejo');
      expect(v.estado).toBe('aprobado');
      expect(v.certificable).toBe(true);
      expect(v.actualidad).toBe('ANTIGUO');
      expect(v.antiguedad_meses).toBeGreaterThanOrEqual(44);
      expect(v.validez).toBe('DOCUMENTADO');
      expect(v.motivo_no_certificable).toBeNull();
      expect(v.vigente_desde.toISOString().slice(0, 10)).toBe('2023-01-15');
    });

    it('D/E · LEGACY_UNMIGRATED (sin_evidencia / referenciada): nunca certificable aunque la compra sea reciente', async () => {
      const d = await vigente(db, 'legacy-sin-ev');
      expect(d.certificable).toBe(false);
      expect(d.validez).toBe('SIN_EVIDENCIA');
      expect(d.actualidad).toBe('VIGENTE'); // reciente, pero la validez manda
      expect(d.motivo_no_certificable).toMatch(/sin evidencia documental \(LEGACY_UNMIGRATED, sin_evidencia\)/);
      const e = await vigente(db, 'legacy-ref');
      expect(e.certificable).toBe(false);
      expect(e.validez).toBe('REFERENCIADO');
      expect(e.motivo_no_certificable).toMatch(/LEGACY_UNMIGRATED/);
      expect(Number(e.precio)).toBe(437); // sigue costeando (PRELIMINAR)
    });

    it('F · MXN/FX: USD con fx_rate/fx_date/fx_source completo es DOCUMENTADO y certificable; precio = source × fx', async () => {
      const v = await vigente(db, 'erp-usd-fx');
      expect(Number(v.precio)).toBeCloseTo(175, 6);
      expect(v.validez).toBe('DOCUMENTADO');
      expect(v.certificable).toBe(true);
      expect(v.motivo_no_certificable).toBeNull();
    });

    it('H · requiere_validacion_compras bloquea aunque sea documentado y reciente', async () => {
      const v = await vigente(db, 'erp-req-compras');
      expect(v.certificable).toBe(false);
      expect(v.actualidad).toBe('VIGENTE');
      expect(v.motivo_no_certificable).toMatch(/validación de Compras/);
    });

    it('J · borde de la ventana: 24 meses exactos = VIGENTE (inclusive); un día más = ANTIGUO', async () => {
      const dentro = await vigente(db, 'erp-borde-dentro');
      const fuera = await vigente(db, 'erp-borde-fuera');
      expect(dentro.vigente_desde.toISOString().slice(0, 10)).toBe(meses24);
      expect(dentro.actualidad).toBe('VIGENTE');
      expect(dentro.certificable).toBe(true);
      expect(dentro.antiguedad_meses).toBe(24);
      expect(fuera.actualidad).toBe('ANTIGUO');
      expect(fuera.certificable).toBe(false);
      expect(fuera.motivo_no_certificable).toMatch(new RegExp(`última compra ${fuera.vigente_desde.toISOString().slice(0, 10)} \\(24 meses\\)`));
    });

    it('I/K/L · inactivo sigue fuera; aprobado reciente igual; con dos precios gana el aprobado (ranking de producción) aunque sea el antiguo', async () => {
      expect(await vigente(db, 'erp-inactivo')).toBeUndefined();
      const k = await vigente(db, 'erp-apr-reciente');
      expect(k).toMatchObject({ certificable: true, actualidad: 'VIGENTE', validez: 'DOCUMENTADO' });
      const l = await vigente(db, 'erp-dos-precios');
      expect(Number(l.precio)).toBe(500);          // el aprobado de 2022, no el documentado reciente de 560
      expect(l.estado).toBe('aprobado');
      expect(l.certificable).toBe(true);
      expect(l.actualidad).toBe('ANTIGUO');        // HALLAZGO: el ranking por estado puede tapar una compra más reciente
    });

    it('CONTEOS en la muestra sintética: certificables = aprobados + documentados ≤ 24 m; el resto sale con motivo y precio', async () => {
      const esperado = await fila(db, `
        with v as (select * from public.catalogo_vigente where insumo_id like 'erp-syn-%')
        select count(*)::int as total,
               count(*) filter (where estado = 'aprobado')::int as aprobados,
               count(*) filter (where estado <> 'aprobado' and vigente_desde >= current_date - make_interval(months => 24))::int as doc_vigentes,
               count(*) filter (where certificable)::int as certificables,
               count(*) filter (where actualidad = 'ANTIGUO')::int as antiguos,
               count(*) filter (where not certificable and motivo_no_certificable is null)::int as sin_motivo,
               count(*) filter (where precio is null or precio <= 0)::int as sin_precio
        from v`);
      expect(esperado.total).toBe(240);
      expect(esperado.aprobados).toBe(30);
      expect(esperado.certificables).toBe(esperado.aprobados + esperado.doc_vigentes);
      // 24 meses ≈ 730 días → compras cada 7 días: ~104 dentro de la ventana, el resto antiguas (como en la base real: la mayoría).
      expect(esperado.antiguos).toBeGreaterThan(120);
      expect(esperado.sin_motivo).toBe(0);
      expect(esperado.sin_precio).toBe(0);
      // Lo que cambia respecto a producción: los documentados ≤ 24 m que NO estaban aprobados ahora certifican; nada más.
      const antesSyn = antes.filter((r) => r.insumo_id.startsWith('erp-syn-'));
      const certAntes = antesSyn.filter((r) => r.estado === 'aprobado').length;
      expect(esperado.certificables - certAntes).toBe(esperado.doc_vigentes);
    });

    it('insumo_motor (catalogo_motor) expone la evidencia extendida sin cambiar la forma del insumo', async () => {
      const m = (await como(db, DIRECCION, () => fila(db, `select private_api.catalogo_motor(true, null) as m`))).m;
      const viejo = m['erp-mel19-2014'];
      expect(viejo.precio).toBe(306);
      expect(viejo.actualizado).toBe('2014-08-26');
      expect(viejo.evidencia).toMatchObject({ estado: 'propuesto_validado', certificable: false, actualidad: 'ANTIGUO', validez: 'DOCUMENTADO', vigente_desde: '2014-08-26' });
      expect(viejo.evidencia.antiguedad_meses).toBeGreaterThanOrEqual(145);
      expect(viejo.evidencia.motivo_no_certificable).toMatch(/2014-08-26.*24 meses/);
      const reciente = m['erp-mdf18-reciente'];
      expect(reciente.evidencia).toMatchObject({ estado: 'propuesto_validado', certificable: true, actualidad: 'VIGENTE', motivo_no_certificable: null });
      const aprobadoViejo = m['erp-apr-viejo'];
      expect(aprobadoViejo.evidencia).toMatchObject({ estado: 'aprobado', certificable: true, actualidad: 'ANTIGUO' });
      // Las claves de VH-088 siguen todas.
      for (const k of ['estado', 'certificable', 'confidence', 'evidence_status', 'fuente', 'requiere_validacion_compras']) expect(viejo.evidencia).toHaveProperty(k);
      for (const k of ['id', 'nombre', 'seccion', 'unidad', 'precio', 'precioBase', 'moneda', 'clase', 'fraccion', 'mermaCorte', 'veta', 'inventario', 'formato', 'actualizado', 'clasificacion', 'familia', 'proveedor']) expect(viejo).toHaveProperty(k);
    });

    it('resolver_costo_insumo: misma forma + política; CERTIFICADO cuando certificable, PRELIMINAR si no; seller-safe intacto', async () => {
      const r = (await como(db, DIRECCION, () => fila(db, `select private_api.resolver_costo_insumo('erp-mel19-2014') as r`))).r;
      expect(r).toMatchObject({ insumo_id: 'erp-mel19-2014', precio: 306, certificable: false, estado_certificacion: 'PRELIMINAR', actualidad: 'ANTIGUO', validez: 'DOCUMENTADO', antiguedad_meses: expect.any(Number) });
      expect(r.motivo_no_certificable).toMatch(/24 meses/);
      const b = (await como(db, DIRECCION, () => fila(db, `select private_api.resolver_costo_insumo('erp-mdf18-reciente') as r`))).r;
      expect(b.estado_certificacion).toBe('CERTIFICADO');
      const cfg = (await como(db, DIRECCION, () => fila(db, `select private_api.resolver_costo_insumo('legacy-config-only') as r`))).r;
      expect(cfg).toMatchObject({ estado_certificacion: 'CONFIG_LEGADO', certificable: false, precio: 99 });
      await expect(como(db, VENDEDOR, () => fila(db, `select private_api.resolver_costo_insumo('erp-mel19-2014') as r`))).rejects.toThrow(/no autorizado/);
    });

    it('es idempotente: volver a correr la PROPUESTA no cambia nada', async () => {
      await db.exec(leer(PROPUESTA));
      expect(await foto(db)).toEqual(antes);
      expect((await vigente(db, 'erp-mdf18-reciente')).certificable).toBe(true);
    });
  });

  describe('ROLLBACK del archivo', () => {
    it('devuelve la vista a las 17 columnas de producción y certificable vuelve a exigir aprobado', async () => {
      await db.exec(rollbackDePropuesta(PROPUESTA, 'VH-147'));
      const cols = (await filas(db, `select column_name from information_schema.columns where table_name = 'catalogo_vigente' order by ordinal_position`)).map((r) => r.column_name);
      expect(cols).toHaveLength(17);
      expect((await vigente(db, 'erp-mdf18-reciente')).certificable).toBe(false);
      expect((await vigente(db, 'erp-apr-viejo')).certificable).toBe(true);
      expect(await foto(db)).toEqual(antes);
      const m = (await como(db, DIRECCION, () => fila(db, `select private_api.catalogo_motor(true, null) as m`))).m;
      expect(m['erp-mel19-2014'].evidencia).not.toHaveProperty('actualidad');
      expect((await filas(db, `select 1 from pg_proc where proname = 'ventana_actualidad_meses'`)).length).toBe(0);
    });
  });
});
