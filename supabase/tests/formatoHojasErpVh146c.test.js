// ============================================================================
//  VH-146c · regresión en base aislada (PGlite = PostgreSQL real) con DATOS REALES de producción
//  (fixtures/vh146c_catalogo_real_20261014.json: 253 filas de insumos_catalogo —las 231 del manifest, los 16 acrílicos y
//  6 de control— y 6 filas reales de insumo_precios, leídas en solo lectura el 14-oct). La migración se corre TAL CUAL
//  (sin reemplazar nada del SQL). Gates pedidos por Dirección tras la reauditoría:
//  231/231 ids · 200 4×8 + 31 5×8 · 0 acrílicos · 0 precios modificados · 0 filas fuera del manifest · mermaCorte intacta ·
//  segunda ejecución aborta · rollback inmediato byte a byte · AME28152 (b709) 1525×2440 · librero 5×8 sin bloqueo de
//  formato y cliente/servidor al centavo.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { baseCatalogoAislada, leer, fila, filas } from './fixtures/erpBaseAislada.js';
import { calcular, modeloParaPieza, costeoEmitible, PARAMETROS_DEFAULT } from '../../src/motor/calculo.js';
import { reconciliarMaterialServidor } from '../../src/datos/materialMatch.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../../src/datos/insumos.js';
import { aCentavosEnteros } from '../../src/motor/dinero.js';

const SQL = leer('supabase/migrations/PROPUESTA_vh146c_formato_hojas_erp.sql');
const FX = JSON.parse(readFileSync(new URL('./fixtures/vh146c_catalogo_real_20261014.json', import.meta.url), 'utf8'));
const LIBRERO = JSON.parse(readFileSync(new URL('../../lab/rescate/preview_link/librero_5x8_v2/8-dto-servidor.json', import.meta.url), 'utf8'));
// Manifest esperado, calculado aquí de forma INDEPENDIENTE del SQL (mismas reglas, sobre los datos reales).
const RX5 = /(^|[^0-9])5\s*'?\s*x\s*'?\s*8($|[^0-9])/i, RX4 = /(^|[^0-9])4\s*'?\s*x\s*'?\s*8($|[^0-9])/i;
const sinFormato = (a) => !(a && a.formato && typeof a.formato === 'object');
const ESPERADO = Object.fromEntries(FX.insumos_catalogo
  .filter((r) => ['melamina', 'mdf', 'laminado_hpl', 'chapa_madera'].includes(r.familia) && sinFormato(r.atributos) && (RX5.test(r.nombre) || RX4.test(r.nombre)))
  .map((r) => [r.id, RX5.test(r.nombre) ? '5x8' : '4x8']));
const RB = SQL.split('\n').filter((l) => l.startsWith('-- RB ')).map((l) => l.slice(6)).join('\n');

const catalogo = (db) => filas(db, 'select * from public.insumos_catalogo order by id');
const precios = (db) => filas(db, 'select * from public.insumo_precios order by id');
const porId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

async function base() {
  const db = await baseCatalogoAislada({ conVh088: true });
  for (const r of FX.insumos_catalogo) {
    await db.query(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia, atributos)
                    values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [r.id, r.nombre, r.seccion, r.unidad_costeo, r.activo, r.clasificacion, r.familia, r.atributos == null ? null : JSON.stringify(r.atributos)]);
  }
  for (const p of FX.insumo_precios) {
    const cols = Object.keys(p).filter((k) => p[k] !== null && !['source_hash'].includes(k));
    await db.query(`insert into public.insumo_precios (${cols.join(',')}) overriding system value values (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
      cols.map((k) => (typeof p[k] === 'object' ? JSON.stringify(p[k]) : p[k])));
  }
  return db;
}

describe('VH-146c · manifest exacto, one-shot, sin mermaCorte (datos reales)', () => {
  let db, antesCat, antesPre, despuesCat;
  beforeAll(async () => {
    db = await base();
    antesCat = porId(await catalogo(db)); antesPre = await precios(db);
    await db.exec(SQL);
    despuesCat = porId(await catalogo(db));
  }, 120_000);

  it('el manifest esperado (calculado aparte) tiene 231 ids: 200 4×8 + 31 5×8, y hay precios reales sembrados', () => {
    const v = Object.values(ESPERADO);
    expect(v.length).toBe(231); expect(v.filter((f) => f === '4x8').length).toBe(200); expect(v.filter((f) => f === '5x8').length).toBe(31);
    expect(antesPre.length).toBeGreaterThanOrEqual(6);
  });

  it('231/231 ids EXACTOS con su formato; fraccion=true; mermaCorte original intacta; lo demás del atributo intacto', async () => {
    const r = await filas(db, 'select id, formato_asignado from private_api.respaldo_vh146c_atributos order by id');
    expect(Object.fromEntries(r.map((x) => [x.id, x.formato_asignado]))).toEqual(ESPERADO);
    for (const [id, fmt] of Object.entries(ESPERADO)) {
      const a = despuesCat[id].atributos, a0 = antesCat[id].atributos || {};
      expect(a.formato.anchoMM).toBe(fmt === '5x8' ? 1525 : 1220);
      expect(a.formato.largoMM).toBe(2440);
      expect(a.fraccion).toBe(true);
      expect(a.mermaCorte).toEqual(a0.mermaCorte);                       // NO se escribe 6
      const { formato, fraccion, ...resto } = a; const { formato: _f, fraccion: _r, ...resto0 } = a0;
      expect(resto).toEqual(resto0);
    }
  });

  it('0 acrílicos y 0 filas fuera del manifest modificadas (byte a byte)', () => {
    const acr = FX.insumos_catalogo.filter((r) => r.familia === 'acrilico');
    expect(acr.length).toBe(16);
    for (const id of Object.keys(antesCat)) if (!ESPERADO[id]) expect(despuesCat[id]).toEqual(antesCat[id]);
  });

  it('0 precios modificados (filas reales de insumo_precios idénticas)', async () => {
    expect(await precios(db)).toEqual(antesPre);
  });

  it('AME28152 Walnut (erp-ame28152-b709, id exacto del manifest) queda 1525×2440', () => {
    expect(ESPERADO['erp-ame28152-b709']).toBe('5x8');
    expect(despuesCat['erp-ame28152-b709'].atributos.formato).toMatchObject({ anchoMM: 1525, largoMM: 2440 });
  });

  it('segunda ejecución ABORTA (one-shot) y no cambia nada', async () => {
    const antes = await catalogo(db);
    await expect(db.exec(SQL)).rejects.toThrow(/ya se aplicó/);
    await db.exec('rollback');
    expect(await catalogo(db)).toEqual(antes);
  });

  it('librero 5×8: ya no bloquea por formato y cliente/servidor cuadran al centavo', async () => {
    const ids = [...new Set(LIBRERO.req.pieza.componentes.map((c) => c.insumoId).filter((x) => x.startsWith('erp-')))];
    const cat = (await fila(db, 'select private_api.catalogo_motor(true, $1::text[]) as c', [ids])).c;
    expect(Object.keys(cat)).toEqual(expect.arrayContaining(ids));
    const insumos = { ...mapaInsumos(INSUMOS_SEMILLA), ...cat };
    const pieza = { componentes: LIBRERO.req.pieza.componentes };
    // Cliente: la pieza tal como la tiene la pantalla.
    const { par: parC } = modeloParaPieza(PARAMETROS_DEFAULT, pieza);
    const cli = calcular(pieza, 1, insumos, parC);
    // Servidor: misma reconciliación y motor que costear-servidor-rc (rol con capability de confirmar).
    const res = (id) => insumos[id]; const vals = Object.values(insumos);
    const piezaSrv = { ...pieza, componentes: pieza.componentes.map((c) => reconciliarMaterialServidor(c, res, vals, { puedeConfirmar: true })) };
    const { par: parS } = modeloParaPieza(PARAMETROS_DEFAULT, piezaSrv);
    const srv = calcular(piezaSrv, 1, insumos, parS);
    for (const r of [cli, srv]) {
      const e = costeoEmitible(r);
      expect(e.bloqueos?.formato_incompatible || []).toEqual([]);
      expect((e.bloqueos?.datos_faltantes || []).filter((x) => /Lateral|Piso|Entrepa/.test(x))).toEqual([]);
      expect(r.componentesIgnorados || []).toEqual([]);
    }
    expect(aCentavosEnteros(cli.costoUnitario)).toBe(aCentavosEnteros(srv.costoUnitario));
    expect(cli.costoUnitario).toBeGreaterThan(LIBRERO.res.costo.costoUnitario); // antes faltaban los tres tableros 28 mm
  });

  it('rollback inmediato (líneas -- RB del SQL) restaura byte a byte las 231 y deja el resto igual', async () => {
    await db.exec(RB);
    expect(porId(await catalogo(db))).toEqual(antesCat);
    expect(await precios(db)).toEqual(antesPre);
  });
});

describe('VH-146c · aborta si la base o el manifest no son lo auditado', () => {
  const sinCambios = async (db, fn, rx) => {
    const antes = await catalogo(db);
    await expect(db.exec(fn(SQL))).rejects.toThrow(rx);
    await db.exec('rollback');
    expect(await catalogo(db)).toEqual(antes);
    expect(await fila(db, `select to_regclass('private_api.respaldo_vh146c_atributos') as t`)).toEqual({ t: null });
  };
  it('aparece un candidato NUEVO (no auditado) en la base → aborta, 0 cambios', async () => {
    const db = await base();
    await db.query(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia, atributos)
                    values ('erp-nuevo-4x8','MDF NUEVO HOJA 4 X 8 ESPESOR 15 mm','cubiertas','hoja',true,'erp','mdf','{}'::jsonb)`);
    await sinCambios(db, (s) => s, /no son el manifest/);
  }, 120_000);
  it('una fila del manifest ya no es como se auditó (p. ej. ya tiene formato) → aborta, 0 cambios', async () => {
    const db = await base();
    await db.query(`update public.insumos_catalogo set atributos = coalesce(atributos,'{}'::jsonb) || '{"formato":{"tipo":"tablero"}}'::jsonb where id = 'erp-mdf18h'`);
    await sinCambios(db, (s) => s, /siguen como se auditaron/);
  }, 120_000);
  it('manifest alterado (un formato cambiado) → la huella no cuadra → aborta, 0 cambios', async () => {
    const db = await base();
    await sinCambios(db, (s) => s.replace("('erp-ame28152-b709','5x8')", "('erp-ame28152-b709','4x8')"), /no es el auditado/);
  }, 120_000);
});
