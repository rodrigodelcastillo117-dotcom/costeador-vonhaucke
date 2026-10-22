// ============================================================================
//  P1-DATA-01 · contrato de antigüedad de 24 meses para `certificable` (PGlite = PostgreSQL real).
//
//  Patrón tomado de src/datos/emissionExactCentsSql.test.js: se levanta un esquema MÍNIMO en
//  PGlite con los cuerpos SQL REALES de producción (vista catalogo_vigente ANTES, aprobar_precio,
//  guards) y luego se EJECUTA el archivo de migración real
//  supabase/migrations/PROPUESTA_data01_certificable_24m.sql para pasar de ANTES a DESPUÉS.
//
//  Prueba, antes y después de la migración:
//   (a) certificable respeta <= 24 meses (true ANTES para una compra de 30 meses -> false DESPUÉS;
//       una de 10 meses sigue true).
//   (b) p_meses > 24 es rechazado por firmar_precios_erp_lote / firmar_precios_erp_vigentes.
//   (c) 0 cambios de importe: precio / source_price idénticos antes y después de la migración.
//   (d) aprobaciones_precio_historial se conserva intacta (mismo count y mismas filas).
//   (e) revalidar_vigencia_precio deja evidencia pero NO re-certifica (sigue PRELIMINAR) y
//       NO altera vigente_desde.
//
//  Simplificaciones (declaradas honestamente):
//   - Esquema mínimo: solo las columnas/funciones que tocan el contrato (no todo el esquema de
//     producción). insumo_precios se reproduce con sus 34 columnas reales para que aprobar_precio
//     (%rowtype) y la vista compilen; se omiten los triggers trg_calc_source_hash y
//     trg_sync_precio_legacy (irrelevantes para este contrato) — sí se incluyen los dos guards
//     relevantes: guard_precio_no_autofirma e insumo_precios_append_only.
//   - El esquema ANTES NO crea las RPC firmar_* (en producción traían el tope 1..360); la
//     migración las crea con el tope 1..24. El contrato ANTES de las RPC queda documentado en el
//     diff de la migración; aquí se verifica el comportamiento DESPUÉS (rechazo de > 24).
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const MIGRACION = 'supabase/migrations/PROPUESTA_data01_certificable_24m.sql';
const DIRECCION = 'rodrigo@vh.mx';

let db;
const como = async (email, fn) => {
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return await fn(); } finally { await db.exec(`select set_config('test.email', '', false)`); }
};
const q = (sql, params) => db.query(sql, params);
const uno = async (email, sql, params) => como(email, async () => (await q(sql, params)).rows[0]);

// Snapshots capturados en beforeAll.
let antesViejoCert, antesNuevoCert;
let baselinePrecios, baselineHist, postPrecios, postHist;
let idA, idB, idC, vigenteDesdeA;

// --- cuerpos ANTES (producción, SIN el gate de 24m y SIN tope 24 en RPC) -------------------
const ESQUEMA_ANTES = `
  create schema if not exists auth;
  create function auth.jwt() returns jsonb language sql stable as $$
    select case when coalesce(current_setting('test.email', true), '') = '' then null
      else jsonb_build_object('email', current_setting('test.email', true)) end $$;

  create table public.permitidos (email text primary key, nombre text, rol text not null default 'vendedor');
  create table public.cuentas_no_humanas (email text primary key);

  create table public.insumos_catalogo (
    id text primary key, nombre text, seccion text, clasificacion text,
    activo boolean default true, unidad_costeo text);

  create table public.insumo_precios (
    id bigint generated always as identity primary key,
    insumo_id text not null,
    precio numeric not null,
    unidad_compra text,
    precio_compra numeric,
    factor_conversion numeric,
    propiedades jsonb,
    proveedor text,
    fuente text,
    evidencia text,
    vigente_desde date,
    vigente_hasta date,
    estado text not null default 'propuesto',
    creado_por text,
    creado_en timestamptz not null default now(),
    confidence text,
    evidence_status text,
    approved_by text,
    approved_at timestamptz,
    requiere_validacion_compras boolean not null default false,
    contract_status text not null default 'LEGACY_UNMIGRATED',
    source_price numeric,
    source_currency text,
    source_unit text,
    source_units_per_cost_unit numeric,
    fx_rate numeric,
    fx_date date,
    fx_source text,
    cost_unit text,
    source_system text,
    source_document text,
    source_record_id text,
    source_hash text,
    cost_unit_price_mxn numeric);

  create table public.aprobaciones_precio_historial (
    id bigint generated always as identity primary key,
    precio_id bigint not null,
    aprobado_por text not null,
    aprobado_en timestamptz not null default now(),
    aprobado_por_anterior text,
    aprobado_en_anterior timestamptz,
    politica text not null,
    nota text);

  -- puede_certificar_costo (producción)
  create or replace function public.puede_certificar_costo() returns boolean
   language sql stable security definer set search_path to 'public','pg_temp'
  as $function$
    select exists (select 1 from public.permitidos
                   where email = (auth.jwt() ->> 'email') and rol in ('direccion'));
  $function$;

  -- guard_precio_no_autofirma (producción)
  create or replace function public.guard_precio_no_autofirma() returns trigger
   language plpgsql set search_path to ''
  as $function$
  begin
    if (NEW.estado = 'aprobado' or NEW.approved_by is not null or NEW.approved_at is not null)
       and current_setting('vh.via_rpc_aprobacion', true) is distinct from 'on' then
      raise exception 'estado=aprobado/approved_by/approved_at solo via RPC de aprobacion de costos';
    end if; return NEW;
  end $function$;

  -- insumo_precios_append_only (producción) — vigente_desde y columnas económicas INMUTABLES
  create or replace function public.insumo_precios_append_only() returns trigger
   language plpgsql set search_path to ''
  as $function$
  begin
    if TG_OP = 'DELETE' then raise exception 'insumo_precios append-only: DELETE prohibido'; end if;
    if NEW.insumo_id is distinct from OLD.insumo_id
     or NEW.source_price is distinct from OLD.source_price
     or NEW.source_currency is distinct from OLD.source_currency
     or NEW.fx_rate is distinct from OLD.fx_rate
     or NEW.source_units_per_cost_unit is distinct from OLD.source_units_per_cost_unit
     or NEW.vigente_desde is distinct from OLD.vigente_desde
     or NEW.source_hash is distinct from OLD.source_hash then
      raise exception 'insumo_precios: columnas economicas/identidad/vigencia-inicial/provenance inmutables'; end if;
    if OLD.estado = 'aprobado' and current_setting('vh.via_rpc_aprobacion', true) is distinct from 'on' then
      raise exception 'fila aprobada inmutable a escritura directa; usa la RPC autorizada'; end if;
    if OLD.vigente_hasta is not null and NEW.vigente_hasta is distinct from OLD.vigente_hasta then
      raise exception 'vigente_hasta ya cerrada; no se reabre'; end if;
    return NEW;
  end $function$;

  create trigger trg_precio_no_autofirma before insert or update on public.insumo_precios
    for each row execute function public.guard_precio_no_autofirma();
  create trigger trg_insumo_precios_append_only before delete or update on public.insumo_precios
    for each row execute function public.insumo_precios_append_only();

  -- aprobar_precio (producción, íntegra, incl. rama DATA_TRUTH_V1)
  create or replace function public.aprobar_precio(p_precio_id bigint, p_nota text default null::text)
   returns void language plpgsql security definer set search_path to 'public','pg_temp'
  as $function$
  declare r public.insumo_precios%rowtype; v_uc text;
  begin
    if not public.puede_certificar_costo() then raise exception 'no autorizado para certificar costo'; end if;
    select * into r from public.insumo_precios where id=p_precio_id;
    if r.id is null then raise exception 'precio % inexistente', p_precio_id; end if;
    if r.contract_status = 'DATA_TRUTH_V1' then
      if r.source_price is null or r.source_price <= 0
         or r.source_currency is null or btrim(r.source_currency)=''
         or r.source_unit is null or btrim(r.source_unit)=''
         or r.source_units_per_cost_unit is null or r.source_units_per_cost_unit <= 0
         or r.cost_unit is null or btrim(r.cost_unit)=''
         or r.source_system is null or btrim(r.source_system)=''
         or r.source_document is null or btrim(r.source_document)=''
         or r.source_record_id is null or btrim(r.source_record_id)=''
         or r.source_hash is null or btrim(r.source_hash)=''
         or r.vigente_desde is null
         or (r.source_currency <> 'MXN' and (r.fx_rate is null or r.fx_rate <= 0 or r.fx_date is null or r.fx_source is null or btrim(r.fx_source)='')) then
        raise exception 'observacion DATA_TRUTH_V1 incompleta: no cumple el contrato economico; no certificable';
      end if;
      select unidad_costeo into v_uc from public.insumos_catalogo where id=r.insumo_id;
      if v_uc is not null and r.cost_unit <> v_uc then
        raise exception 'cost_unit (%) != unidad_costeo (%); no certificable', r.cost_unit, v_uc; end if;
    end if;
    perform set_config('vh.via_rpc_aprobacion','on', true);
    update public.insumo_precios set estado='aprobado', approved_by=(auth.jwt()->>'email'), approved_at=now()
     where id=p_precio_id;
  end $function$;

  -- catalogo_vigente ANTES (producción, SIN gate de 24 meses)
  create or replace view public.catalogo_vigente as
   WITH ranked AS (
           SELECT p.id, p.insumo_id, p.precio, p.unidad_compra, p.precio_compra, p.factor_conversion,
              p.propiedades, p.proveedor, p.fuente, p.evidencia, p.vigente_desde, p.vigente_hasta,
              p.estado, p.creado_por, p.creado_en, p.confidence, p.evidence_status, p.approved_by,
              p.approved_at, p.requiere_validacion_compras, c.nombre, c.seccion, c.clasificacion,
              row_number() OVER (PARTITION BY p.insumo_id ORDER BY
                  CASE p.estado WHEN 'aprobado' THEN 0 WHEN 'propuesto_validado' THEN 1 WHEN 'propuesto' THEN 2 ELSE 3 END,
                  CASE p.confidence WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
                  p.vigente_desde DESC NULLS LAST, p.id DESC) AS rn
             FROM (insumo_precios p JOIN insumos_catalogo c ON ((c.id = p.insumo_id)))
            WHERE ((p.vigente_hasta IS NULL) AND (COALESCE(c.activo, true) = true))
          )
   SELECT insumo_id, nombre, seccion, clasificacion, precio, unidad_compra, precio_compra,
      factor_conversion, propiedades, estado, evidence_status, confidence, requiere_validacion_compras,
      ((estado = 'aprobado') AND (NOT requiere_validacion_compras)) AS certificable,
      fuente, evidencia, vigente_desde, id AS precio_id
     FROM ranked WHERE (rn = 1);

  insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion');
`;

describe('P1-DATA-01 · certificable respeta <= 24 meses (SQL real en PGlite, ANTES/DESPUÉS)', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(ESQUEMA_ANTES);

    // Insumos (activos).
    await db.exec(`insert into public.insumos_catalogo(id,nombre,activo) values
      ('ins-viejo','Tubular viejo',true),('ins-nuevo','MDF reciente',true),('ins-rpc','Insumo por firmar',true);`);

    // Precios: A = 30 meses (viejo), B = 10 meses (nuevo), C = 10 meses (sin firmar, para las RPC).
    const ins = async (insumo, meses, precio) => (await q(
      `insert into public.insumo_precios(insumo_id, precio, source_price, source_document, source_system, fuente, vigente_desde)
       values ($1,$2,$2,$3,'erp_intelisis','ERP Intelisis', current_date - ($4::int * interval '1 month')) returning id, vigente_desde`,
      [insumo, precio, 'DOC-' + insumo, meses])).rows[0];
    const a = await ins('ins-viejo', 30, 100); idA = a.id; vigenteDesdeA = a.vigente_desde;
    const b = await ins('ins-nuevo', 10, 200); idB = b.id;
    const c = await ins('ins-rpc',   10, 300); idC = c.id;

    // Firmar A y B con la RPC real (los deja estado='aprobado'). C queda 'propuesto'.
    await uno(DIRECCION, 'select public.aprobar_precio($1, $2)', [idA, 'seed viejo (firma laxa histórica)']);
    await uno(DIRECCION, 'select public.aprobar_precio($1, $2)', [idB, 'seed nuevo']);

    // Historial (evidencia de firmas; A bajo política laxa 120m, B bajo 24m).
    await db.exec(`insert into public.aprobaciones_precio_historial(precio_id, aprobado_por, politica, nota) values
      (${idA}, '${DIRECCION}', 'D1 · última compra Intelisis con documento ≤ 120 meses', 'seed'),
      (${idB}, '${DIRECCION}', 'D1 · última compra Intelisis con documento ≤ 24 meses', 'seed');`);

    // --- Capturas ANTES (contrato viejo) ---
    antesViejoCert = (await q(`select certificable from public.catalogo_vigente where insumo_id='ins-viejo'`)).rows[0].certificable;
    antesNuevoCert = (await q(`select certificable from public.catalogo_vigente where insumo_id='ins-nuevo'`)).rows[0].certificable;
    baselinePrecios = (await q(`select id, precio::text, source_price::text from public.insumo_precios order by id`)).rows;
    baselineHist   = (await q(`select id, precio_id, aprobado_por, politica from public.aprobaciones_precio_historial order by id`)).rows;

    // --- Aplicar la MIGRACIÓN real (ANTES -> DESPUÉS) ---
    await db.exec(leer(MIGRACION));

    // --- Capturas DESPUÉS ---
    postPrecios = (await q(`select id, precio::text, source_price::text from public.insumo_precios order by id`)).rows;
    postHist    = (await q(`select id, precio_id, aprobado_por, politica from public.aprobaciones_precio_historial order by id`)).rows;
  }, 60_000);

  afterAll(async () => { await db?.close(); });

  it('(a) certificable respeta <= 24 meses: ANTES una compra de 30 meses era certificable (contrato viejo)', () => {
    expect(antesViejoCert).toBe(true);   // contrato viejo: sin gate de antigüedad
    expect(antesNuevoCert).toBe(true);
  });

  it('(a) DESPUÉS: compra de 30 meses => certificable=false / PRELIMINAR; compra de 10 meses => true / CERTIFICADO', async () => {
    const viejo = (await q(`select certificable, estatus_certificacion from public.catalogo_vigente where insumo_id='ins-viejo'`)).rows[0];
    const nuevo = (await q(`select certificable, estatus_certificacion from public.catalogo_vigente where insumo_id='ins-nuevo'`)).rows[0];
    expect(viejo.certificable).toBe(false);
    expect(viejo.estatus_certificacion).toBe('PRELIMINAR');
    expect(nuevo.certificable).toBe(true);
    expect(nuevo.estatus_certificacion).toBe('CERTIFICADO');
  });

  it('(b) p_meses > 24 es RECHAZADO por ambas RPC de firma', async () => {
    await expect(como(DIRECCION, () => q(`select public.firmar_precios_erp_vigentes(120)`)))
      .rejects.toThrow(/1\.\.24/);
    await expect(como(DIRECCION, () => q(`select public.firmar_precios_erp_vigentes(360)`)))
      .rejects.toThrow(/1\.\.24/);
    await expect(como(DIRECCION, () => q(`select public.firmar_precios_erp_lote(120, 0, 100)`)))
      .rejects.toThrow(/1\.\.24/);
  });

  it('(c) 0 cambios de importe: precio y source_price idénticos antes y después de la migración', () => {
    expect(postPrecios).toEqual(baselinePrecios);
    // valores concretos intactos:
    expect(postPrecios.find((r) => r.id === idA).precio).toBe('100');
    expect(postPrecios.find((r) => r.id === idB).precio).toBe('200');
    expect(postPrecios.find((r) => r.id === idC).source_price).toBe('300');
  });

  it('(d) aprobaciones_precio_historial intacta: mismo count y mismas filas', () => {
    expect(postHist.length).toBe(baselineHist.length);
    expect(postHist).toEqual(baselineHist);
    expect(postHist.length).toBe(2);
  });

  it('(e) revalidar_vigencia_precio: deja evidencia, NO re-certifica y NO altera vigente_desde', async () => {
    const vdAntes = (await q(`select vigente_desde, estado from public.insumo_precios where id=$1`, [idA])).rows[0];
    const revId = (await uno(DIRECCION, `select public.revalidar_vigencia_precio($1,$2) as id`, [idA, 'Revisado por Dirección 2026-10-22']));
    expect(revId.id).toBeTruthy();

    const ev = (await q(`select precio_id, revalidado_por, razon, precio_revalidado::text, vigente_desde_original, source_system_original
                         from public.revalidaciones_vigencia where precio_id=$1`, [idA])).rows;
    expect(ev.length).toBe(1);
    expect(ev[0].precio_revalidado).toBe('100');                 // precio exacto revalidado
    expect(ev[0].revalidado_por).toBe(DIRECCION);                // quién
    expect(ev[0].razon).toMatch(/Dirección/);                    // por qué
    expect(ev[0].source_system_original).toBe('erp_intelisis');  // fuente histórica original

    const vdDespues = (await q(`select vigente_desde, estado from public.insumo_precios where id=$1`, [idA])).rows[0];
    expect(String(vdDespues.vigente_desde)).toBe(String(vdAntes.vigente_desde));  // vigente_desde NO cambia
    expect(vdDespues.estado).toBe('aprobado');                                    // estado NO cambia

    // NO re-certifica: el precio viejo sigue PRELIMINAR.
    const viejo = (await q(`select certificable, estatus_certificacion from public.catalogo_vigente where insumo_id='ins-viejo'`)).rows[0];
    expect(viejo.certificable).toBe(false);
    expect(viejo.estatus_certificacion).toBe('PRELIMINAR');
  });

  it('(b-bis) la ruta VÁLIDA <= 24 meses sí firma: firmar_precios_erp_vigentes(24) aprueba el pendiente', async () => {
    const res = (await uno(DIRECCION, `select public.firmar_precios_erp_vigentes(24) as r`)).r;
    expect(res.firmados).toBeGreaterThanOrEqual(1);
    // el insumo recién firmado (10 meses) queda CERTIFICADO:
    const rpc = (await q(`select certificable from public.catalogo_vigente where insumo_id='ins-rpc'`)).rows[0];
    expect(rpc.certificable).toBe(true);
  });
});
