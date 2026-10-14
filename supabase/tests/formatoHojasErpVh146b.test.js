// ============================================================================
//  VH-146b (endurecida tras la auditoría externa del 14-oct) en base aislada (PGlite = PostgreSQL real en WASM).
//  Comprueba: sólo 4×8/5×8 EXPLÍCITO; acrílico y respaldos por decimales fuera; abortar si la cuenta no es la medida;
//  AME28152 → 1525×2440; precios intactos; rollback que NO pisa cambios posteriores. Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { baseCatalogoAislada, leer, fila, filas } from './fixtures/erpBaseAislada.js';

const SQL = leer('supabase/migrations/PROPUESTA_vh146b_formato_hojas_erp.sql');
const ERP_BASE = { unidad: 'hoja', clase: 'directa', formato: null, fraccion: false, mermaCorte: 0 };
// [id, nombre, familia, esperado]
const MUESTRA = [
  ['erp-ame28152-b709', 'AGLOMERADO MELAMINA DOS CARAS HOJA 5 X 8 ESPESOR 28 mm -- AME28152 · WALNUT', 'melamina', '5x8'],
  ['erp-ame1948',       'AGLOMERADO MELAMINA DOS CARAS HOJA 4 X 8 ESPESOR 19 mm',                       'melamina', '4x8'],
  ['erp-mdf18h',        "MDF UNA CARA BLANCO HOJA 4' X 8' ESPESOR 18 mm",                                'mdf', '4x8'],
  ['erp-hpl-4x8',       'LAMINADO PLASTICO HPL 4X8 ESPESOR 0.8 mm',                                      'laminado_hpl', '4x8'],
  ['erp-chapa-4x8',     "CHAPA DE MADERA ENCINO 4'X8'",                                                  'chapa_madera', '4x8'],
  // ---- fuera de VH-146b ----
  ['erp-acr-4x8',       'ACRILICO TRANSPARENTE HOJA 4 X 8 ESPESOR 3 mm',                                 'acrilico', null], // acrílico: decisión de Compras
  ['erp-mel-122',       'MELAMINA UNA CARA BLANCO 1.22 X 2.44 M ESPESOR 16 mm',                          'melamina', null], // sólo decimales
  ['erp-mel-14x8',      'MELAMINA 14 X 8 ESPESOR 16 mm',                                                 'melamina', null],
  ['erp-lam-4x8',       'LAMINA NEGRA 4 X 8 CAL 18',                                                     'metal_lamina', null],
];
const ESPERADOS = MUESTRA.filter((m) => m[3]).length; // 5
const conCuenta = (n) => SQL.replace(/n <> 231/g, `n <> ${n}`);
const atributosDe = async (db, id) => (await fila(db, 'select atributos from public.insumos_catalogo where id = $1', [id])).atributos;

async function base() {
  const db = await baseCatalogoAislada({ conVh088: false });
  for (const [id, nombre, familia] of MUESTRA) {
    await db.query(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia, atributos)
                    values ($1, $2, 'cubiertas', 'hoja', true, 'erp', $3, $4::jsonb)`, [id, nombre, familia, JSON.stringify({ ...ERP_BASE, erp: { articulo: id } })]);
  }
  return db;
}

describe('VH-146b · formato de hoja ERP endurecido', () => {
  let db;
  beforeEach(async () => { db = await base(); }, 60_000);

  it('asigna formato sólo a 4×8/5×8 explícito; acrílico, decimales y no-tableros quedan intactos', async () => {
    const antes = Object.fromEntries(await Promise.all(MUESTRA.map(async ([id]) => [id, await atributosDe(db, id)])));
    await db.exec(conCuenta(ESPERADOS));
    for (const [id, , , fmt] of MUESTRA) {
      const a = await atributosDe(db, id);
      if (!fmt) { expect(a).toEqual(antes[id]); continue; }
      expect(a.fraccion).toBe(true);
      expect(a.formato.anchoMM).toBe(fmt === '5x8' ? 1525 : 1220);
      expect(a.formato.largoMM).toBe(2440);
      expect(a.erp).toEqual(antes[id].erp); // lo demás se conserva
    }
  }, 60_000);

  it('si la cuenta medida no coincide, aborta y no cambia nada', async () => {
    const antes = await filas(db, 'select id, atributos from public.insumos_catalogo order by id');
    await expect(db.exec(conCuenta(ESPERADOS + 1))).rejects.toThrow(/se esperaban/);
    await db.exec('rollback');
    expect(await filas(db, 'select id, atributos from public.insumos_catalogo order by id')).toEqual(antes);
  }, 60_000);

  it('el rollback restaura lo que VH-146b puso, pero no pisa una fila cambiada después', async () => {
    const original = await atributosDe(db, 'erp-ame1948');
    await db.exec(conCuenta(ESPERADOS));
    // Alguien cambia legítimamente una fila después de la migración.
    await db.query(`update public.insumos_catalogo set atributos = atributos || '{"mermaCorte": 3}'::jsonb where id = 'erp-mdf18h'`);
    const cambiada = await atributosDe(db, 'erp-mdf18h');
    const rb = SQL.split('\n').filter((l) => l.startsWith('-- RB ')).map((l) => l.slice(6)).join('\n');
    await db.exec(rb);
    expect(await atributosDe(db, 'erp-ame1948')).toEqual(original);
    expect(await atributosDe(db, 'erp-mdf18h')).toEqual(cambiada);
  }, 60_000);
});
