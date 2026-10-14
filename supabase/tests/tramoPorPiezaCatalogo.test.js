// ============================================================================
//  Tramo vendido por pieza en el catálogo ERP (20261014160000_tramo_por_pieza_catalogo.sql, APLICADA 14-oct). Base aislada con
//  insumos_catalogo, catalogo_vigente e insumo_motor/catalogo_motor REALES: la fila que sale de catalogo_motor entra al
//  motor tal cual y da la paridad con Intelisis (ATPU2M). Sin la migración, el mismo tubular queda fuera (unidad pza
//  sin formato → amarre crítico) — eso es lo que hoy bloquea los muebles de tubular.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';
import { baseCatalogoAislada, leer, como, fila, filas, DIRECCION } from './fixtures/erpBaseAislada.js';
import { calcular, conTramoPorPieza, precioPorTramo } from '../../src/motor/calculo.js';
import { tramoPorPiezaDe } from '../../src/datos/erpCarga.js';

const MIG = 'supabase/migrations/20261014160000_tramo_por_pieza_catalogo.sql';
const NOMBRES = {
  'erp-tre181123': 'TUBULAR INDUSTRIAL RECTANGULAR 1 1/2" X 3" CALIBRE 18 PIEZA DE 6000 mm - "TRE181123"',
  'erp-an13166': 'ANGULO LADOS IGUALES DE 1" ESPESOR 3/16" PIEZA DE 6000 mm - "AN13166"',
  'erp-adssgf-t1': 'CORTE CON LASER DE TUBULAR CUADRADO DE 1" X 1196 mm CALIBRE 14 CON CORTES ESPECIALES',
};

describe('catálogo: tramoPorPieza en las barras comerciales ERP', () => {
  let db;
  beforeAll(async () => {
    db = await baseCatalogoAislada();
    for (const [id, n] of Object.entries(NOMBRES)) {
      await db.query(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, atributos)
        values ($1, $2, 'metal', 'pza', true, 'erp', '{"unidad":"pza","formato":null,"fraccion":false,"mermaCorte":0}'::jsonb)`, [id, n]);
    }
    await db.exec(`insert into public.insumo_precios (id, insumo_id, precio, estado, vigente_desde, source_document, unidad_compra, precio_compra, factor_conversion, evidence_status, confidence, requiere_validacion_compras)
      overriding system value values (1, 'erp-tre181123', 383.28, 'propuesto', '2026-08-07', 'ERP Intelisis · última compra', 'pza', 383.28, 1, 'documentada', 'alta', false)`);
    await como(db, DIRECCION, () => db.query('select public.aprobar_precio(1)'));
  }, 60_000);

  it('ANTES: catalogo_motor entrega el tubular en pza sin formato → el motor nuevo tampoco lo trata como tramo', async () => {
    const { m } = await fila(db, "select private_api.catalogo_motor(false, array['erp-tre181123']) as m");
    expect(m['erp-tre181123'].formato).toBeNull(); expect(precioPorTramo(m['erp-tre181123'])).toBe(false);
  });

  it('la migración marca SOLO las barras del manifiesto (no la pieza cortada con láser), sin tocar formato, precio ni unidad', async () => {
    await db.exec(leer(MIG));
    const r = await filas(db, "select id, unidad_costeo, atributos->'formato' as formato, atributos->'tramoPorPieza' as t, atributos->'mermaTramo' as merma from public.insumos_catalogo order by id");
    expect(r.map((x) => [x.id, x.unidad_costeo, x.formato, x.t?.medida ?? null, x.merma ?? null])).toEqual([
      ['erp-adssgf-t1', 'pza', null, null, null], ['erp-an13166', 'pza', null, 6, 5], ['erp-tre181123', 'pza', null, 6, 6.94]]);
    expect(Number((await fila(db, 'select precio from public.insumo_precios where id = 1')).precio)).toBe(383.28);
  });

  it('el manifiesto coincide con la regla del cargador para estos nombres (sin deriva SQL ↔ JS)', async () => {
    for (const [id, n] of Object.entries(NOMBRES)) {
      const a = (await fila(db, 'select atributos from public.insumos_catalogo where id = $1', [id])).atributos;
      const js = tramoPorPiezaDe(n, { unidad: 'pza', seccion: 'metal' });
      expect([id, a.tramoPorPieza ?? null, a.mermaTramo ?? null]).toEqual([id, js?.tramoPorPieza ?? null, js?.mermaTramo ?? null]);
    }
  });

  it('DESPUÉS: la fila real de catalogo_motor entra al motor y da la paridad con Intelisis (ATPU2M ±1.5 %)', async () => {
    const { m } = await fila(db, "select private_api.catalogo_motor(false, array['erp-tre181123']) as m");
    const ins = m['erp-tre181123'];
    expect(ins.formato).toBeNull();                       // el motor de producción no ve ningún cambio
    expect(conTramoPorPieza(ins).formato.medida).toBe(6); // el 2026-10-14a sí
    const r = calcular({ componentes: [{ nombre: 'Pata U', insumoId: 'erp-tre181123', cantidad: 2.04, forma: 'lineal' }] }, 1, m);
    const d = r.detalleInsumos.find((x) => x.insumoId === 'erp-tre181123');
    expect(Math.abs(d.costo - 0.361 * 383.28) / (0.361 * 383.28)).toBeLessThan(0.015);
    expect(r.componentesIgnorados).toEqual([]);
  });

  it('idempotente: aplicarla de nuevo no cambia nada', async () => {
    const antes = await filas(db, 'select id, atributos from public.insumos_catalogo order by id');
    await db.exec(leer(MIG));
    expect(await filas(db, 'select id, atributos from public.insumos_catalogo order by id')).toEqual(antes);
  });
});
