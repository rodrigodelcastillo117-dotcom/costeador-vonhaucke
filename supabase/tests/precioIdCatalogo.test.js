// P1-03b · PROPUESTA_p103b_precio_id_en_catalogo.sql en PGlite con la vista de PRODUCCIÓN (baseline) y las funciones de
// catálogo tal como están aplicadas (migración vh088). El catálogo debe entregar el id de la fila que la vista eligió.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { tablaDeBaseline, vistaCatalogoVigenteProduccion, funcionDeMigracion, leer } from './fixtures/erpBaseAislada.js';

const VH088 = 'supabase/migrations/20261012043000_vh088_catalogo_motor.sql';
let db;
const precio = (id, insumo, p, estado, conf, desde) => `(${id}, '${insumo}', ${p}, '${estado}', '${conf}', '${desde}', ${estado === 'aprobado' ? `'d@vh.mx', now(), 'hoja', ${p}, 1, 'documentada', false` : 'null, null, null, null, null, null, false'})`;

describe('P1-03b · catalogo_vigente/insumo_motor entregan precio_id', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create schema private_api;`);
    for (const t of ['insumos_catalogo', 'insumo_precios']) await db.exec(tablaDeBaseline(t));
    await db.exec(vistaCatalogoVigenteProduccion());
    for (const f of ['private_api.insumo_motor', 'private_api.catalogo_motor']) await db.exec(funcionDeMigracion(VH088, f));
    await db.exec(`insert into public.insumos_catalogo (id, nombre, unidad_costeo, activo, clasificacion) values ('m16', 'Melamina 16', 'hoja', true, 'curado'), ('lamina-3x10-14', 'Lámina 3x10 cal 14', 'hoja', true, 'curado');
      insert into public.insumo_precios (id, insumo_id, precio, estado, confidence, vigente_desde, approved_by, approved_at, unidad_compra, precio_compra, factor_conversion, evidence_status, requiere_validacion_compras) overriding system value values
      ${[precio(10, 'm16', 600, 'aprobado', 'alta', '2026-10-01'), precio(11, 'm16', 610, 'propuesto', 'alta', '2026-10-05'),
         precio(273, 'lamina-3x10-14', 849.5, 'propuesto', 'alta', '2026-01-26'), precio(281, 'lamina-3x10-14', 849.5, 'propuesto', 'alta', '2026-01-26'),
         precio(287, 'lamina-3x10-14', 816.48, 'propuesto', 'alta', '2026-01-26')].join(',\n')};`);
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('antes de la propuesta el catálogo NO dice qué fila usó (por eso la Edge re-elegía en JS)', async () => {
    const m = (await db.query(`select private_api.catalogo_motor(true, null) as m`)).rows[0].m;
    expect(m.m16.precio).toBe(600);
    expect(m.m16).not.toHaveProperty('precioId');
  });

  it('con la propuesta: precioId = la fila elegida por la MISMA vista (aprobado gana; empate real → id mayor)', async () => {
    await db.exec(leer('supabase/migrations/PROPUESTA_p103b_precio_id_en_catalogo.sql'));
    const m = (await db.query(`select private_api.catalogo_motor(true, null) as m`)).rows[0].m;
    expect(m.m16).toMatchObject({ precio: 600, precioId: 10 });
    expect(m['lamina-3x10-14']).toMatchObject({ precio: 816.48, precioId: 287 });
    const v = (await db.query(`select insumo_id, precio_id from public.catalogo_vigente order by insumo_id`)).rows;
    expect(v).toEqual([{ insumo_id: 'lamina-3x10-14', precio_id: 287 }, { insumo_id: 'm16', precio_id: 10 }]);
  });
});
