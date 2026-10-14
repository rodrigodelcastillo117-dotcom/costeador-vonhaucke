// SEG-01c rev5 · spec_tecnica_v1 (SQL). private_api.spec_tecnica debe dar EXACTAMENTE lo que src/datos/specTecnica.js
// da con las mismas fixtures doradas. El bloque SQL se lee de la PROPUESTA tal cual (entre `-- >>> spec_v1` y
// `-- <<< spec_v1`), no de una copia.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { specTecnicaDeCosteo, claveComponente, SPEC_CAMPOS } from '../../src/datos/specTecnica.js';

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

  // ---- cierre GO (P2 de la reauditoría): canonicalización sin ambigüedad ----
  const mutaciones = { insumoId: 'mdf19', nombre: 'Cubierta2', cantidad: 2, piezas: 3, largoMM: 701, anchoMM: 401, hojas: 2,
    areaPintadaM2: 1.75, tubular: true, material_solicitado: 'otro', material_match: 'EXACT', material_confirmado: true,
    engineering_override: true, override_motivo: 'otro motivo', procedencia: 'INFERIDO', pieza_confirmada: true, pendiente: true };
  const BASE = { nombre: 'Cubierta', insumoId: 'mdf18', cantidad: 1, piezas: 2, largoMM: 700, anchoMM: 400, hojas: 1, areaPintadaM2: 1.5,
    material_solicitado: 'mdf 18', material_match: 'PROVISIONAL', override_motivo: 'motivo', procedencia: 'OBSERVADO' };
  it('cambiar CUALQUIER campo técnico de un renglón cambia la huella (SQL) y la spec (JS)', async () => {
    expect(Object.keys(mutaciones).sort()).toEqual([...SPEC_CAMPOS].sort());
    const h0 = await huella({ componentes: [BASE] });
    const vistas = new Set([h0]);
    for (const [k, v] of Object.entries(mutaciones)) {
      const p = { componentes: [{ ...BASE, [k]: v }] };
      const h = await huella(p);
      expect(h, k).not.toBeNull();
      expect(vistas.has(h), `${k} no cambió la huella`).toBe(false);
      vistas.add(h);
      expect(await sql(p)).toEqual(specTecnicaDeCosteo(p));
    }
    for (const [p, q] of [[{ horas: { ensamble: 1 } }, { horas: { ensamble: 2 } }], [{ horas: { ensamble: 1 } }, { horas: { corte: 1 } }],
      [{ dificultad: 'normal' }, { dificultad: 'dificil' }], [{ dificultad: 1 }, { dificultad: 1.25 }]]) {
      expect(await huella({ componentes: [BASE], ...p })).not.toBe(await huella({ componentes: [BASE], ...q }));
    }
  });
  it('reordenar los renglones nunca cambia la huella (todas las rotaciones e inversión de cada fixture con varios renglones)', async () => {
    for (const c of GOLDEN.casos.filter((x) => x.esperado && x.entrada.componentes.length > 1)) {
      const comps = c.entrada.componentes; const h0 = await huella(c.entrada);
      const ordenes = [[...comps].reverse(), ...comps.map((_, i) => [...comps.slice(i), ...comps.slice(0, i)])];
      for (const o of ordenes) {
        expect(await huella({ ...c.entrada, componentes: o }), c.nombre).toBe(h0);
        expect(specTecnicaDeCosteo({ ...c.entrada, componentes: o }), c.nombre).toEqual(c.esperado);
      }
    }
  });
  it('sin colisiones: en TODOS los renglones de las fixtures, misma clave de orden ⇔ mismo renglón; spec distinta ⇒ huella distinta', async () => {
    const porClave = new Map();
    for (const c of GOLDEN.casos.filter((x) => x.esperado)) for (const o of c.esperado.componentes) {
      const k = claveComponente(o); const j = JSON.stringify(o, Object.keys(o).sort());
      if (porClave.has(k)) expect(porClave.get(k), `clave repetida para renglones distintos: ${JSON.stringify(k)}`).toBe(j);
      porClave.set(k, j);
    }
    // el par clásico de la reauditoría: con la clave anterior (campo=valor unidos con U+001F) estos dos chocaban
    expect(claveComponente({ nombre: 'x\u001fcantidad=1' })).not.toBe(claveComponente({ nombre: 'x', cantidad: 1 }));
    const porSpec = new Map();
    for (const c of GOLDEN.casos.filter((x) => x.esperado)) {
      const h = await huella(c.entrada); const j = JSON.stringify(c.esperado);
      for (const [h2, j2] of porSpec) if (j2 !== j) expect(h2, c.nombre).not.toBe(h);
      porSpec.set(h, j);
    }
  });
  it('fuera del dominio de jsonb (U+0000, sustituto UTF-16 suelto, en un valor o en un centro de horas): JS no da spec y SQL ni lo admite', async () => {
    for (const p of [
      { componentes: [{ nombre: 'Cubierta\u0000', insumoId: 'mdf18', cantidad: 1 }] },
      { componentes: [{ nombre: 'Cubierta\ud800', insumoId: 'mdf18', cantidad: 1 }] },
      { componentes: [{ nombre: 'Cubierta\udc00x', insumoId: 'mdf18', cantidad: 1 }] },
      { componentes: [{ nombre: 'Cubierta', insumoId: 'mdf18', cantidad: 1 }], horas: { 'ens\ud83d': 1 } },
    ]) {
      expect(specTecnicaDeCosteo(p)).toBeNull();
      await expect(sql(p)).rejects.toThrow();
    }
    // un par sustituto VÁLIDO (emoji) sí es texto válido y da la misma spec en los dos lados
    const ok = { componentes: [{ nombre: 'Jaladera \ud83d\ude00', insumoId: 'mdf18', cantidad: 1 }] };
    expect(await sql(ok)).toEqual(specTecnicaDeCosteo(ok));
  });
});
