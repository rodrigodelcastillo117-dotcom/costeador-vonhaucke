// SEG-01c rev5 · spec_tecnica_v1 (SQL). private_api.spec_tecnica debe dar EXACTAMENTE lo que src/datos/specTecnica.js
// da con las mismas fixtures doradas. El bloque SQL se lee de la PROPUESTA tal cual (entre `-- >>> spec_v1` y
// `-- <<< spec_v1`), no de una copia.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { specTecnicaDeCosteo } from '../../src/datos/specTecnica.js';

const SQL = readFileSync(new URL('../migrations/PROPUESTA_seg01c_vinculo_costeo_partida.sql', import.meta.url), 'utf8');
const GOLDEN = JSON.parse(readFileSync(new URL('./fixtures/specTecnicaGolden.json', import.meta.url), 'utf8'));
const bloque = () => {
  const i = SQL.indexOf('-- >>> spec_v1'); const f = SQL.indexOf('-- <<< spec_v1');
  if (i < 0 || f < i) throw new Error('faltan los marcadores del bloque spec_v1');
  return SQL.slice(i, f);
};

describe('spec_tecnica_v1 · fixtures doradas (SQL = JS)', () => {
  let db;
  const sql = async (p) => (await db.query('select private_api.spec_tecnica($1::jsonb) as r', [JSON.stringify(p)])).rows[0].r;
  const huella = async (p) => (await db.query('select private_api.huella_spec_tecnica($1::jsonb) as h', [JSON.stringify(p)])).rows[0].h;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema private_api;`);
    await db.exec(bloque());
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  for (const c of GOLDEN.casos) {
    it(c.nombre, async () => {
      expect(await sql(c.entrada)).toEqual(c.esperado);
      expect(await sql(c.entrada)).toEqual(specTecnicaDeCosteo(c.entrada));
      if (c.esperado) {
        // Idempotente y con la MISMA huella: sellar la spec ya proyectada por JS (lo que guarda la Edge y lleva la partida)
        // da lo mismo que proyectar en SQL la pieza cruda.
        expect(await sql(c.esperado)).toEqual(c.esperado);
        expect(await huella(specTecnicaDeCosteo(c.entrada))).toBe(await huella(c.entrada));
      } else {
        expect(await huella(c.entrada)).toBeNull();
      }
    });
  }

  it('la huella distingue multiplicidad, medidas, horas y pintura; no el orden ni lo que el DTO descarta', async () => {
    const A = { componentes: [{ nombre: 'Cubierta', insumoId: 'mdf18', cantidad: 1 }, { nombre: 'Entrepaño', insumoId: 'mdf18', cantidad: 1 }] };
    const h0 = await huella(A);
    expect(await huella({ componentes: [...A.componentes].reverse() })).toBe(h0);
    expect(await huella({ componentes: A.componentes.map((c) => ({ ...c, costoUnitario: 9, excluida: true })) })).toBe(h0);
    expect(await huella({ componentes: [A.componentes[0], { ...A.componentes[1], cantidad: 3 }] })).not.toBe(h0);
    expect(await huella({ componentes: [A.componentes[0], { ...A.componentes[1], largoMM: 900 }] })).not.toBe(h0);
    expect(await huella({ ...A, horas: { ensamble: 1 } })).not.toBe(await huella({ ...A, horas: { ensamble: 4 } }));
    expect(await huella({ componentes: [...A.componentes, A.componentes[1]] })).not.toBe(
      await huella({ componentes: [A.componentes[0], { ...A.componentes[1], cantidad: 2 }] }));
  });
});
