// ============================================================================
//  P1 · APRIETE: certificable EXIGE source_document. PGlite (Postgres real), sin tocar prod.
//  ANTES  = vista de producción: un precio aprobado+fresco SIN documento → CERTIFICADO (el hueco).
//  DESPUÉS= migración 20261109_certificable_exige_documento.sql: ese mismo precio → PRELIMINAR
//           (sigue costeando, NO certifica), mientras uno CON documento sí certifica. La SELECCIÓN
//           del precio no cambia (misma precedencia); sólo se endurece la certificación.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const MIGRACION = 'supabase/migrations/20261109_certificable_exige_documento.sql';

// Vista de PRODUCCIÓN (definición vigente, SIN la condición de source_document).
const VISTA_PROD = `
create view public.catalogo_vigente as
 with ranked as (
   select p.id, p.insumo_id, p.precio, p.estado, p.confidence, p.vigente_desde, p.vigente_hasta,
          p.requiere_validacion_compras, p.source_document, c.nombre,
          row_number() over (partition by p.insumo_id order by
            (case p.estado when 'aprobado' then 0 when 'propuesto_validado' then 1 when 'propuesto' then 2 else 3 end),
            (case p.confidence when 'alta' then 0 when 'media' then 1 else 2 end),
            p.vigente_desde desc nulls last, p.id desc) as rn
     from insumo_precios p join insumos_catalogo c on c.id = p.insumo_id
    where p.vigente_hasta is null and coalesce(c.activo, true) = true)
 select insumo_id, nombre, precio, estado, requiere_validacion_compras,
        (estado = 'aprobado' and not requiere_validacion_compras and vigente_desde is not null
         and vigente_desde >= (current_date - make_interval(months => 24))) as certificable,
        vigente_desde, id as precio_id
   from ranked where rn = 1;`;

// La migración trae la vista COMPLETA (muchas columnas). Para la prueba, la base mínima necesita las
// columnas que la vista toca; la salida completa igual se calcula. Creamos insumos_catalogo e
// insumo_precios con el esquema real reducido.
async function base() {
  const db = new PGlite();
  await db.exec(`
    create table public.insumos_catalogo (id text primary key, nombre text, seccion text, clasificacion text, activo boolean default true);
    create table public.insumo_precios (
      id bigint primary key, insumo_id text, precio numeric, unidad_compra text, precio_compra numeric,
      factor_conversion numeric, propiedades jsonb, proveedor text, fuente text, evidencia text,
      vigente_desde date, vigente_hasta date, estado text, creado_por text, creado_en timestamptz default now(),
      confidence text, evidence_status text, approved_by text, approved_at timestamptz,
      requiere_validacion_compras boolean default false, source_document text);
    insert into public.insumos_catalogo(id, nombre, seccion, clasificacion) values
      ('LAM','Lamina','metal','directa'), ('LAMDOC','Lamina doc','metal','directa');
    -- LAM: precio aprobado, fresco, confianza alta, SIN documento  (id 1) + uno mas nuevo pero confianza media (id 3)
    insert into public.insumo_precios(id, insumo_id, precio, vigente_desde, estado, confidence, requiere_validacion_compras, source_document) values
      (1,'LAM', 800, current_date - 10, 'aprobado','alta', false, null),
      (3,'LAM', 810, current_date - 1,  'aprobado','media',false, null),
      -- LAMDOC: aprobado, fresco, CON documento (id 2)
      (2,'LAMDOC', 900, current_date - 10, 'aprobado','alta', false, 'FACT-2026-123');`);
  return db;
}
const fila = async (db, insumo) => (await db.query('select certificable, precio, precio_id from public.catalogo_vigente where insumo_id=$1', [insumo])).rows[0];

describe('ANTES · vista de producción: certifica sin documento (el hueco)', () => {
  let db;
  beforeAll(async () => { db = await base(); await db.exec(VISTA_PROD); });
  afterAll(async () => { await db?.close(); });
  it('LAM (aprobado+fresco, SIN source_document) → certificable = true', async () => {
    const r = await fila(db, 'LAM');
    expect(r.certificable).toBe(true);
    expect(Number(r.precio)).toBe(800);              // precedencia: confianza alta gana al mas nuevo (media)
    expect(Number(r.precio_id)).toBe(1);
  });
});

describe('DESPUÉS · migración: sin documento NO certifica; con documento sí; la selección no cambia', () => {
  let db;
  beforeAll(async () => { db = await base(); await db.exec(VISTA_PROD); await db.exec('drop view public.catalogo_vigente;'); await db.exec(leer(MIGRACION)); });
  afterAll(async () => { await db?.close(); });

  it('LAM (sin documento) → certificable = FALSE, pero sigue costeando con el mismo precio', async () => {
    const r = await fila(db, 'LAM');
    expect(r.certificable).toBe(false);              // apriete: sin documento no certifica
    expect(Number(r.precio)).toBe(800);              // mismo precio (no cambia selección ni importe)
    expect(Number(r.precio_id)).toBe(1);             // misma precedencia (confianza alta)
  });
  it('LAMDOC (con documento) → certificable = TRUE', async () => {
    expect((await fila(db, 'LAMDOC')).certificable).toBe(true);
  });
  it('estatus_certificacion refleja el apriete', async () => {
    const { rows } = await db.query(`select insumo_id, estatus_certificacion from public.catalogo_vigente order by insumo_id`);
    const m = Object.fromEntries(rows.map((r) => [r.insumo_id, r.estatus_certificacion]));
    expect(m.LAM).toBe('PRELIMINAR');
    expect(m.LAMDOC).toBe('CERTIFICADO');
  });
});
