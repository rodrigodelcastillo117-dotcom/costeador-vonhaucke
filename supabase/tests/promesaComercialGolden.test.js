// SEG-01c rev4 · promesa_comercial_v1 (SQL). private_api.promesa_partida debe dar EXACTAMENTE lo que
// src/datos/promesaComercial.js da con las mismas fixtures doradas. El bloque SQL se lee de la PROPUESTA tal cual
// (entre los marcadores `-- >>> promesa_v1` y `-- <<< promesa_v1`), no de una copia.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { promesaComercialDeCosteo } from '../../src/datos/promesaComercial.js';

const SQL = readFileSync(new URL('../migrations/PROPUESTA_seg01c_vinculo_costeo_partida.sql', import.meta.url), 'utf8');
const GOLDEN = JSON.parse(readFileSync(new URL('./fixtures/promesaComercialGolden.json', import.meta.url), 'utf8'));
const bloque = () => {
  const i = SQL.indexOf('-- >>> promesa_v1'); const f = SQL.indexOf('-- <<< promesa_v1');
  if (i < 0 || f < i) throw new Error('faltan los marcadores del bloque promesa_v1');
  return SQL.slice(i, f);
};

describe('promesa_comercial_v1 · fixtures doradas (SQL = JS)', () => {
  let db;
  const sql = async (p) => (await db.query('select private_api.promesa_partida($1::jsonb) as r', [JSON.stringify(p)])).rows[0].r;
  const huella = async (p) => (await db.query('select private_api.huella_promesa($1::jsonb) as h', [JSON.stringify(p)])).rows[0].h;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema private_api;`);
    await db.exec(bloque());
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  for (const c of GOLDEN.casos) {
    it(c.nombre, async () => {
      expect(await sql(c.entrada)).toEqual(c.esperado);
      expect(await sql(c.entrada)).toEqual(promesaComercialDeCosteo(c.entrada));
      if (c.esperado) {
        // Idempotente y con la MISMA huella: sellar la promesa ya proyectada por JS (lo que guarda la Edge) da lo mismo
        // que proyectar en SQL la partida cruda.
        expect(await sql(c.esperado)).toEqual(c.esperado);
        expect(await huella(promesaComercialDeCosteo(c.entrada))).toBe(await huella(c.entrada));
      }
    });
  }

  it('la huella cambia con lo prometido y no con lo visual', async () => {
    const base = { nombre: 'Escritorio', w: 1200, d: 600, config: { finish: 'blanco' }, materiales: ['m16'] };
    const h0 = await huella(base);
    expect(await huella({ ...base, render: 'r', zone_id: 'z', instance_id: 'i', precioUnitario: 9, cantidad: 4, nota: 'n' })).toBe(h0);
    expect(await huella({ ...base, config: { finish: 'nogal' } })).not.toBe(h0);
    expect(await huella({ ...base, nombresExcluidos: ['Cristal'] })).not.toBe(h0);
    expect(await huella({ ...base, w: '1200.0', d: 600.0 })).toBe(h0);
  });
});
