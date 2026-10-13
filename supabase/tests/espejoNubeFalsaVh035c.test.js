// ============================================================================
//  PARIDAD SQL ↔ NUBE FALSA (VH-035c). e2e/nubeFalsa.js trae un espejo JS de
//  private_api.fusionar_economia_partidas y de la compuerta con recosteo pendiente para que los
//  e2e (e2e/persistenciaVh035c.e2e.js) corran con la semántica de la PROPUESTA sin base de datos.
//  Aquí las mismas entradas pasan por la SQL real (PGlite) y por el espejo y se exige el MISMO
//  resultado (o el mismo SQLSTATE). Si alguien cambia una sin la otra, esto se pone rojo.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { fusionarVh035c, sinEconomia, motivosRecosteoPendiente, normalizarCostStatus } from '../../e2e/nubeFalsa.js';

const leer = (rel) => readFileSync(new URL('../../' + rel, import.meta.url), 'utf8');
function defDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  return sql.slice(ini, sql.indexOf('\n;\n', ini)) + ';';
}

const P1 = {
  id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000, costoUnitario: 21000, margen: 30, costoDerivado: false, costoEstado: 'completo',
  producto_id: 1, producto_version_id: 1933, piezaId: 'bench-6', bom_hash: 'sha256:aaa', aprobado: true, estado_costo: 'certificado', lista_precio_item_id: 10, source_type: 'catalogo',
  config: { color: 'nogal', finish: 'melamina', costeo: { costoUnitario: 21000, materiales: 15000 }, insumos: [{ clave: 'mdf18', costo: 950 }, { clave: 'canto-abs', costo: 120 }] },
  pieza: { componentes: [{ nombre: 'Tapa', insumoId: 'mdf18', costo: 700 }, { nombre: 'Faldón', insumoId: 'mdf18', costo: 250 }] },
};
const P2 = { id: 'p2', nombre: 'Silla', cantidad: 6, precioUnitario: 3200, costoUnitario: 1400, margen: 35 };
const P3 = { id: 'p3', nombre: 'Credenza', cantidad: 2, precioUnitario: 12000, costoUnitario: 6100, costo_por_lote: true, config: { costeo: { costoLote: 12200 } } };
const LEGACY = { id: 'p4', nombre: 'Legacy', cantidad: 1, precioUnitario: 9000, costoUnitario: 4000, margen: 30, config: { finish: 'chapa' } };
const VIEJAS = [P1, P2, P3, LEGACY];
const vista = (ps) => sinEconomia(ps);
const editar = (pid, f) => vista(VIEJAS).map((p) => (p.id === pid ? f(p) : p));

const CASOS = [
  ['sin cambios', vista(VIEJAS)],
  ['cantidad sin lote + nota', editar('p1', (p) => ({ ...p, cantidad: 3, nota: 'obra' }))],
  ['reordena insumos y componentes', editar('p1', (p) => ({ ...p, config: { ...p.config, insumos: [...p.config.insumos].reverse() }, pieza: { componentes: [...p.pieza.componentes].reverse() } }))],
  ['cambia piezaId/bom_hash', editar('p1', (p) => ({ ...p, piezaId: 'bench-8', bom_hash: 'sha256:bbb' }))],
  ['cambia finish', editar('p1', (p) => ({ ...p, config: { ...p.config, finish: 'chapa' } }))],
  ['quita un componente', editar('p1', (p) => ({ ...p, pieza: { componentes: [p.pieza.componentes[0]] } }))],
  ['cantidad en lote', editar('p3', (p) => ({ ...p, cantidad: 5 }))],
  ['autoridad y procedencia pisadas', editar('p1', (p) => ({ ...p, aprobado: false, estado_costo: 'x', lista_precio_item_id: 20, source_type: 'banco', aprobacion: { ok: 1 } }))],
  ['renglón nuevo canónico con versión ajena', [...vista(VIEJAS), { id: 'p9', nombre: 'Nuevo', cantidad: 1, precioUnitario: 1, producto_id: 2, producto_version_id: 9999, aprobado: true, precioAutorizado: false }]],
  ['renglón nuevo de línea (productoId textual)', [...vista(VIEJAS), { id: 'p10', nombre: 'Banca doble', productoId: 'banca_doble', producto_id: null, producto_version_id: null, cantidad: 1, precioUnitario: 28540, source_type: null }]],
  ['legacy ligado a producto', editar('p4', (p) => ({ ...p, producto_id: 2, producto_version_id: 9999 }))],
  ['quita un renglón', vista(VIEJAS).filter((p) => p.id !== 'p2')],
  ['re-pin de versión (error)', editar('p1', (p) => ({ ...p, producto_version_id: 9999 }))],
  ['producto inexistente (error)', [...vista(VIEJAS), { id: 'p11', nombre: 'X', cantidad: 1, precioUnitario: 1, producto_id: 77 }]],
  ['producto_id basura (error)', [...vista(VIEJAS), { id: 'p12', nombre: 'X', cantidad: 1, precioUnitario: 1, producto_id: 'abc' }]],
];

describe('paridad fusionar_economia_partidas (SQL VH-035c) ↔ fusionarVh035c (nube falsa)', () => {
  let db;
  beforeAll(async () => {
    db = await new PGlite();
    await db.exec(`create schema private_api; create table public.productos (id bigint primary key, version_tecnica_vigente_id bigint); insert into public.productos values (1, 1933), (2, 2044);`);
    await db.exec(defDeBaseline('jsonb_sin_economia'));
    await db.exec(defDeBaseline('normalizar_cost_status_partidas'));
    const m = leer('supabase/migrations/PROPUESTA_vh035c_preserva_economia_integral.sql');
    await db.exec(m.slice(m.indexOf('create or replace function private_api.es_clave_economia'), m.indexOf('--  Compuerta: motivos de recosteo pendiente')));
  }, 60_000);
  afterAll(async () => { await db?.close(); });
  const productos = new Map([[1, 1933], [2, 2044]]);

  for (const [nombre, nuevas] of CASOS) {
    it(nombre, async () => {
      let sql = null, errSql = null, js = null, errJs = null;
      try {
        sql = (await db.query('select public.normalizar_cost_status_partidas(private_api.fusionar_economia_partidas($1::jsonb, public.jsonb_sin_economia($2::jsonb))) as r',
          [JSON.stringify(VIEJAS), JSON.stringify(nuevas)])).rows[0].r;
      } catch (e) { errSql = e; }
      try { js = normalizarCostStatus(fusionarVh035c(VIEJAS, sinEconomia(nuevas), productos)); } catch (e) { errJs = e; }
      expect(Boolean(errSql), 'los casos (error) deben lanzar en la SQL y sólo ellos').toBe(nombre.includes('(error)'));
      if (errSql || errJs) {
        expect(errJs?.code, `SQL lanzó ${errSql?.code} ${errSql?.message}`).toBe(errSql?.code);
        expect(errJs.message).toBe(errSql.message);
        return;
      }
      expect(js).toEqual(sql);
      // Y la compuerta lee los mismos motivos de recosteo de la fila resultante.
      const motivosSql = sql.map((p, i) => (p && typeof p === 'object' && 'cost_stale' in p ? i + 1 : null)).filter(Boolean);
      expect(motivosRecosteoPendiente({ partidas: js }).map((m) => Number(/^linea_(\d+)_/.exec(m)[1]))).toEqual(motivosSql);
    });
  }
});
