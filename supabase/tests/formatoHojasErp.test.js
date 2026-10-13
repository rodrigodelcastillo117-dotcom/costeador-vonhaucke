// ============================================================================
//  VH-146 · BACKFILL DE FORMATO EN HOJAS ERP, EN BASE AISLADA (PGlite = PostgreSQL real en WASM).
//
//  Carga `insumos_catalogo` REAL (DDL del baseline) con una muestra de nombres como los trae el ERP Intelisis
//  (doc ERP_PRECIOS_ELEGIBILIDAD § 1 y § 6: `HOJA 4' X 8'`, `HOJA 4 X 8`, `HOJA 5 X 8`, `1.22 X 2.44`, y los negativos
//  `2400 X 1200 mm`, `3 X 10` de lámina), corre PROPUESTA_vh146 y comprueba:
//    · qué fila recibe qué formato (y cuáles NO se tocan),
//    · idempotencia (segunda corrida: 0 cambios, respaldo intacto),
//    · rollback byte a byte desde el respaldo,
//    · paridad con el cargador JS (erpCarga.js RE_HOJA_4X8 / RE_HOJA_5X8): el SQL decide igual que el código.
//  Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';
import { baseCatalogoAislada, leer, rollbackDePropuesta, fila, filas } from './fixtures/erpBaseAislada.js';
import { RE_HOJA_4X8, RE_HOJA_5X8, prepararCargaErp } from '../../src/datos/erpCarga.js';

const PROPUESTA = 'supabase/migrations/PROPUESTA_vh146_formato_hojas_erp.sql';
const TABLERO = { tipo: 'tablero', nombre: 'tablero 1.22 x 2.44', corto: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const TABLERO5X8 = { tipo: 'tablero', nombre: 'tablero 1.52 x 2.44', corto: 'tablero 5x8', medida: 3.721, largoMM: 2440, anchoMM: 1525 };
const ERP_BASE = { unidad: 'hoja', clase: 'directa', formato: null, fraccion: false, mermaCorte: 0, veta: false, inventario: false };

// [id, nombre, familia, esperado ('4x8' | '5x8' | null), extras]
const MUESTRA = [
  ['erp-mdf18h',    "MDF CON UNA CARA EN MELAMINA DURABLE BLANCO HOJA 4' X 8' ESPESOR 18 mm", 'mdf',          '4x8'],
  ['erp-ame1948',   'AGLOMERADO MELAMINA DOS CARAS HOJA 4 X 8 ESPESOR 19 mm',                'melamina',     '4x8'],
  ['erp-ame28152',  'AGLOMERADO MELAMINA DOS CARAS HOJA 5 X 8 ESPESOR 28 mm',                'melamina',     '5x8'],
  ['erp-mel-122',   'MELAMINA UNA CARA BLANCO 1.22 X 2.44 M ESPESOR 16 mm',                  'melamina',     '4x8'],
  ['erp-mdf-244',   'MDF NATURAL 2.44 X 1.22 ESPESOR 25 mm',                                 'mdf',          '4x8'],
  ['erp-mel-152',   'AGLOMERADO MELAMINA DOS CARAS 1.52 X 2.44 ESPESOR 18 mm',               'melamina',     '5x8'], // 5×8 descrito en metros
  ['erp-mel-1525',  'MELAMINA DOS CARAS 1.525 X 2.44 M ESPESOR 28 mm',                       'melamina',     '5x8'],
  ['erp-hpl-4x8',   'LAMINADO PLASTICO HPL 4X8 ESPESOR 0.8 mm',                              'laminado_hpl', '4x8'], // sin espacios
  ['erp-chapa-4x8', "CHAPA DE MADERA ENCINO 4'X8'",                                          'chapa_madera', '4x8'],
  ['erp-null-attr', 'MELAMINA DOS CARAS 4 X 8 ESPESOR 12 mm',                                'melamina',     '4x8', { atributos: null }],
  ['erp-inactivo',  'MDF NATURAL 4 X 8 ESPESOR 15 mm',                                       'mdf',          '4x8', { activo: false }], // el formato es del material, no del estatus
  // ---- NEGATIVOS: no se tocan ----
  ['erp-acr-x48',   'ACRILICO VERDE UNA CARA SATINADA DE 2400 X 1200 mm ESPESOR 3 mm',       'acrilico',     null], // mm, no 4x8 literal ni 1.22/2.44
  ['erp-acr-1220',  'ACRILICO TRANSPARENTE 2440 X 1220 mm ESPESOR 6 mm',                     'acrilico',     null], // 2440/1220 no son 2.44/1.22
  ['erp-lam-3x10',  'LAMINA NEGRA 3 X 10 CAL 20',                                            'metal_lamina', null], // familia fuera (kg por hoja)
  ['erp-lam-4x8',   'LAMINA NEGRA 4 X 8 CAL 18',                                             'metal_lamina', null],
  ['erp-mel-14x8',  'MELAMINA 14 X 8 ESPESOR 16 mm',                                         'melamina',     null], // "14 X 8" no es 4 X 8
  ['erp-mel-4x80',  'MELAMINA 4 X 80 cm ESPESOR 16 mm',                                      'melamina',     null], // "4 X 80" no es 4 X 8
  ['erp-pza-4x8',   'TAPA MELAMINA 4 X 8',                                                   'melamina',     null, { unidad: 'pza' }],
  ['erp-sin-fam',   'TABLERO DESCONOCIDO 4 X 8 ESPESOR 19 mm',                               null,           null], // sin familia: para Compras
  ['erp-ya-formato','AGLOMERADO MELAMINA DOS CARAS HOJA 4 X 8 ESPESOR 16 mm',                'melamina',     null, { atributos: { ...ERP_BASE, formato: TABLERO, fraccion: true, mermaCorte: 6, erp: { articulo: 'AME1648' } } }],
  ['melamina-16',   'Melamina BLANCA 16 mm (4x8)',                                           'melamina',     null, { clasificacion: 'vigente' }], // curado: no se toca
];

let db;
let original; // atributos antes del backfill, por id

const atributosDe = async (id) => (await fila(db, 'select atributos from public.insumos_catalogo where id = $1', [id])).atributos;
const todos = () => filas(db, 'select id, atributos from public.insumos_catalogo order by id');
const respaldo = () => filas(db, 'select id, atributos, formato_asignado from private_api.respaldo_vh146_atributos order by id');
const esperadoFormato = (fmt) => (fmt === '5x8' ? TABLERO5X8 : fmt === '4x8' ? TABLERO : null);

describe('VH-146 · backfill de formato en hojas ERP', () => {
  beforeAll(async () => {
    db = await baseCatalogoAislada({ conVh088: false });
    for (const [id, nombre, familia, , extras = {}] of MUESTRA) {
      const atributos = 'atributos' in extras ? extras.atributos : { ...ERP_BASE, erp: { articulo: id.toUpperCase() } };
      await db.query(
        `insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia, atributos)
         values ($1, $2, 'cubiertas', $3, $4, $5, $6, $7::jsonb)`,
        [id, nombre, extras.unidad || 'hoja', extras.activo ?? true, extras.clasificacion || 'erp', familia, atributos == null ? null : JSON.stringify(atributos)]);
    }
    original = Object.fromEntries((await todos()).map((r) => [r.id, r.atributos]));
    await db.exec(leer(PROPUESTA));
  }, 60_000);

  it.each(MUESTRA.map(([id, nombre, , fmt]) => [id, fmt ?? 'sin cambio', nombre]))('%s → %s  (%s)', async (id, _et, _nombre) => {
    const fmt = MUESTRA.find((m) => m[0] === id)[3];
    const a = await atributosDe(id);
    if (fmt) {
      expect(a.formato).toEqual(esperadoFormato(fmt));
      expect(a.fraccion).toBe(true);
      expect(a.mermaCorte).toBe(6);
      // lo demás del atributo se conserva (erp, clase, unidad…)
      for (const [k, v] of Object.entries(original[id] || {})) if (!['formato', 'fraccion', 'mermaCorte'].includes(k)) expect(a[k]).toEqual(v);
    } else {
      expect(a).toEqual(original[id]); // byte a byte: ni formato, ni fraccion, ni mermaCorte
    }
  });

  it('el respaldo tiene exactamente las filas tocadas, con sus atributos ORIGINALES y el formato asignado', async () => {
    const r = await respaldo();
    const tocadas = MUESTRA.filter((m) => m[3]).map((m) => m[0]).sort();
    expect(r.map((x) => x.id)).toEqual(tocadas);
    for (const x of r) {
      expect(x.atributos).toEqual(original[x.id]);
      expect(x.formato_asignado).toBe(MUESTRA.find((m) => m[0] === x.id)[3]);
    }
    expect(r.filter((x) => x.formato_asignado === '5x8')).toHaveLength(3);
    expect(r.filter((x) => x.formato_asignado === '4x8')).toHaveLength(8);
  });

  it('es idempotente: segunda corrida → mismos atributos, mismo respaldo', async () => {
    const antes = await todos(), resp = await respaldo();
    await db.exec(leer(PROPUESTA));
    expect(await todos()).toEqual(antes);
    expect(await respaldo()).toEqual(resp);
  });

  it('ROLLBACK: atributos vuelven byte a byte al original (incluido el null); el respaldo queda como rastro', async () => {
    await db.exec(rollbackDePropuesta(PROPUESTA, 'VH-146'));
    const ahora = Object.fromEntries((await todos()).map((r) => [r.id, r.atributos]));
    expect(ahora).toEqual(original);
    expect((await respaldo()).length).toBe(11);
    // y volver a aplicar deja exactamente lo mismo que la primera vez (el respaldo no se pisa)
    await db.exec(leer(PROPUESTA));
    expect((await atributosDe('erp-mel-152')).formato).toEqual(TABLERO5X8);
    expect((await atributosDe('erp-null-attr')).formato).toEqual(TABLERO);
    expect((await respaldo()).find((x) => x.id === 'erp-null-attr').atributos).toBeNull();
  });

  it('la verificación lista para Compras las hojas ERP activas que SIGUEN sin formato (metal, sin familia, mm)', async () => {
    const sin = (await filas(db, `select id from public.insumos_catalogo c where c.clasificacion = 'erp' and c.unidad_costeo = 'hoja' and c.activo
      and jsonb_typeof(c.atributos -> 'formato') is distinct from 'object' order by id`)).map((r) => r.id);
    expect(sin).toEqual(['erp-acr-1220', 'erp-acr-x48', 'erp-lam-3x10', 'erp-lam-4x8', 'erp-mel-14x8', 'erp-mel-4x80', 'erp-sin-fam']);
  });
});

describe('VH-146 · paridad SQL ↔ cargador JS (erpCarga.js)', () => {
  it('los patrones del SQL deciden igual que RE_HOJA_5X8 / RE_HOJA_4X8 para toda la muestra', async () => {
    // Misma regla: 5×8 primero (más específico), luego 4×8.
    const decideJS = (nombre) => { const d = nombre.toLowerCase(); return RE_HOJA_5X8.test(d) ? '5x8' : RE_HOJA_4X8.test(d) ? '4x8' : null; };
    const sql = leer(PROPUESTA);
    const re5 = /~\* '((?:[^']|'')*)' then '5x8'/.exec(sql)[1].replace(/''/g, "'");
    const re4 = /~\* '((?:[^']|'')*)'\s+then '4x8'/.exec(sql)[1].replace(/''/g, "'");
    const db2 = await baseCatalogoAislada({ conVh088: false });
    for (const [, nombre] of MUESTRA) {
      const r = await fila(db2, `select case when $1 ~* $2 then '5x8' when $1 ~* $3 then '4x8' end as fmt`, [nombre, re5, re4]);
      expect(r.fmt ?? null, nombre).toBe(decideJS(nombre));
    }
  });

  it('el cargador asigna 5×8 a una hoja "1.52 X 2.44" (antes la daba por 4×8: 2.9768 m² en vez de 3.721)', () => {
    const base = { costo_uc: 725.4, unidad: 'hoja', estatus: 'ALTA', fecha_uc: '2026-02-09', opcion: null };
    const { catalogo } = prepararCargaErp([
      { ...base, articulo: 'MVLMAG01320801', clave: 'AME18152', desc: 'AGLOMERADO MELAMINA DOS CARAS 1.52 X 2.44 ESPESOR 18 mm' },
      { ...base, articulo: 'MVLMAG01280600', clave: 'AME1948', desc: 'AGLOMERADO MELAMINA DOS CARAS HOJA 4 X 8 ESPESOR 19 mm' },
      { ...base, articulo: 'MVLMAG01320800', clave: 'AME28152', desc: 'AGLOMERADO MELAMINA DOS CARAS HOJA 5 X 8 ESPESOR 28 mm' },
    ], { documento: 't' });
    const f = (clave) => catalogo.find((c) => c.atributos.erp.clave === clave).atributos;
    expect(f('AME18152').formato).toEqual(TABLERO5X8);
    expect(f('AME1948').formato).toEqual(TABLERO);
    expect(f('AME28152').formato).toEqual(TABLERO5X8);
  });

  it('el objeto `formato` del SQL es el MISMO que el del cargador y el del catálogo curado (misma forma, mismos números)', () => {
    const sql = leer(PROPUESTA);
    const literales = [...sql.matchAll(/'(\{"tipo":"tablero"[^']*\})'::jsonb/g)].map((m) => JSON.parse(m[1]));
    expect(literales).toHaveLength(2);
    expect(literales.find((f) => f.anchoMM === 1525)).toEqual(TABLERO5X8);
    expect(literales.find((f) => f.anchoMM === 1220)).toEqual(TABLERO);
  });
});
