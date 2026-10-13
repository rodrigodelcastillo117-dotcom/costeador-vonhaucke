-- ============================================================================
--  PROPUESTA · VH-147 · política ERP_ULTIMA_COMPRA_V1: validez histórica ≠ actualidad para costo certificado.
--  ⚠️ NO APLICAR sin autorización de Dirección. Prefijo PROPUESTA_ para que `supabase db push` no la tome.
--  Probada en base aislada (PGlite) por `supabase/tests/erpPolitica.test.js`; resultados en
--  `docs/auditoria/ERP_POLITICA_PRUEBAS.md`.
--
--  DECISIÓN 1 de Dirección (2026-10-13), que esta migración codifica:
--   · VALIDEZ (histórica): un precio ERP con documento (DATA_TRUTH_V1 + source_document + source_record_id)
--     NUNCA caduca ni se vuelve "inventado". Se sigue devolviendo con su `precio` y su fecha de última
--     compra para costear en PRELIMINAR.
--   · ACTUALIDAD (para costo CERTIFICADO): referencia 24 meses desde la última compra, salvo que exista una
--     validación comercial documentada más reciente (estado='aprobado' con approved_at/evidencia). Un precio
--     antiguo puede usarse en PRELIMINAR con su fecha visible y aviso de antigüedad; no se certifica como
--     costo de reposición vigente sin evidencia adicional.
--
--  QUÉ CAMBIA (cero UPDATE de precios/estados; sólo derivación + 2 tablas nuevas append-only en private_api):
--   0. VH-147b · POLÍTICA VERSIONADA: registro private_api.politicas_erp (V1 = ERP_ULTIMA_COMPRA_V1, 24 meses),
--      private_api.politica_erp() → {version, ventana_meses, reglas, activa_desde}, registrar_politica_erp() para V2+,
--      libro private_api.evidencias_certificacion_erp + sellar_evidencia_erp(): cada costo certificado puede decir con
--      qué versión se certificó; una V2 (otra ventana) no reescribe lo sellado bajo V1.
--   1. private_api.ventana_actualidad_meses() → ventana de la versión activa (V1: 24). STABLE (lee el registro).
--   2. Vista public.catalogo_vigente: MISMA definición de producción (baseline 04_vistas.sql) + columnas
--      AÑADIDAS al final: antiguedad_meses, actualidad, validez, motivo_no_certificable, ventana_actualidad_meses.
--      `certificable` pasa a ser:
--        (estado='aprobado' AND NOT requiere_validacion_compras)                      -- validación comercial documentada
--        OR (validez='DOCUMENTADO' AND actualidad='VIGENTE' AND precio>0 AND activo    -- compra documentada reciente
--            AND NOT requiere_validacion_compras AND moneda resuelta (MXN o FX completo) AND cost_unit=unidad_costeo)
--      No se cambia ningún `estado`; ninguna fila deja de salir en la vista.
--   3. private_api.insumo_motor(c, v): la misma salida de VH-088 + evidencia.{vigente_desde, antiguedad_meses,
--      actualidad, validez, motivo_no_certificable}. catalogo_motor/buscar_insumos_motor no cambian (la llaman).
--   4. private_api.resolver_costo_insumo(id): misma forma + las mismas 5 claves; estado_certificacion
--      'CERTIFICADO' cuando certificable (ya no exige estado='aprobado').
--   VH-147b añade al final de la vista: politica_version, precio_id, ultima_compra (= vigente_desde SÓLO si DOCUMENTADO;
--      en LEGACY vigente_desde es la fecha de carga), origen_precio (source_system / contract_status); y las mismas claves
--      en insumo_motor.evidencia y resolver_costo_insumo (politica_version también en CONFIG_LEGADO/DESCONOCIDO).
--  Rollback completo al final (comentado). El rollback NO borra el registro de políticas ni el libro de evidencias
--  (son historia); hay líneas doblemente comentadas para borrarlos si Dirección lo decide explícitamente.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) POLÍTICA VERSIONADA (VH-147b). La política es un DATO con versión, no un número escondido en el código:
--    · private_api.politicas_erp: registro APPEND-ONLY de versiones (version, ventana_meses, reglas, activa_desde).
--      Cambiar la ventana = registrar ERP_ULTIMA_COMPRA_V2 con su propia fecha de activación; la V1 no se edita
--      ni se borra (trigger), y no se puede registrar una versión con activación anterior a la vigente (no retroactiva).
--    · private_api.politica_erp() → {version, ventana_meses, reglas, activa_desde} de la versión activa (la de
--      activa_desde más reciente ≤ ahora). La vista, insumo_motor y resolver_costo_insumo SELLAN esa versión en
--      cada fila/respuesta (columna/clave politica_version).
--    · private_api.evidencias_certificacion_erp: libro APPEND-ONLY donde quien certifica un costo sella la evaluación
--      (precio_id, precio, última compra, actualidad, validez, certificable, motivo) CON la versión y la ventana con
--      que se evaluó. Si mañana hay V2, lo sellado bajo V1 sigue diciendo V1/24 meses/certificable: no se reescribe.
--    · ventana_actualidad_meses() se conserva (misma firma) y ahora lee la versión activa: pasa de IMMUTABLE a STABLE.
--    Sólo la VENTANA es parámetro de datos. Cambiar una REGLA (p. ej. caducidad de aprobaciones) exige migración nueva
--    + versión nueva en el registro (las reglas de cada versión quedan descritas en `reglas`).
-- ---------------------------------------------------------------------------
create table if not exists private_api.politicas_erp (
  version        text primary key check (version ~ '^ERP_[A-Z0-9_]+_V[0-9]+$'),
  ventana_meses  integer not null check (ventana_meses between 1 and 240),
  reglas         jsonb not null,
  activa_desde   timestamptz not null default now(),
  registrada_por text,
  nota           text
);
comment on table private_api.politicas_erp is
  'VH-147b · versiones de la política de elegibilidad de precios ERP. APPEND-ONLY: una política nueva es una versión nueva; la activa es la de activa_desde más reciente ≤ now().';

create table if not exists private_api.evidencias_certificacion_erp (
  id                     bigint generated always as identity primary key,
  insumo_id              text not null,
  precio_id              bigint references public.insumo_precios(id),
  precio                 numeric,
  estado                 text,
  vigente_desde          date,
  antiguedad_meses       integer,
  actualidad             text,
  validez                text,
  certificable           boolean not null,
  estado_certificacion   text not null,
  motivo_no_certificable text,
  politica_version       text not null references private_api.politicas_erp(version),
  ventana_meses          integer not null,
  sellado_en             timestamptz not null default clock_timestamp(),
  sellado_por            text,
  contexto               jsonb
);
create index if not exists evidencias_certificacion_erp_insumo_idx on private_api.evidencias_certificacion_erp (insumo_id, sellado_en desc);
comment on table private_api.evidencias_certificacion_erp is
  'VH-147b · libro APPEND-ONLY: cada fila = la evaluación de un precio ERP en el momento en que se usó para certificar, con la versión de política y la ventana que la certificaron. Nunca se recalcula.';

-- Guardia común: append-only (sin UPDATE/DELETE/TRUNCATE) y, en el registro de políticas, sin activaciones retroactivas.
create or replace function private_api.politica_erp_append_only()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if TG_OP in ('UPDATE', 'DELETE', 'TRUNCATE') then
    raise exception '% es append-only (VH-147b): una política o evidencia no se reescribe; registra una versión nueva', TG_TABLE_NAME;
  end if;
  if TG_TABLE_NAME = 'politicas_erp' and exists (
       select 1 from private_api.politicas_erp p where p.activa_desde > NEW.activa_desde) then
    raise exception 'politicas_erp: la versión % no puede activarse antes que la vigente (no retroactiva)', NEW.version;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_politicas_erp_append_only on private_api.politicas_erp;
create trigger trg_politicas_erp_append_only before insert or update or delete on private_api.politicas_erp
  for each row execute function private_api.politica_erp_append_only();
drop trigger if exists trg_politicas_erp_no_truncate on private_api.politicas_erp;
create trigger trg_politicas_erp_no_truncate before truncate on private_api.politicas_erp
  for each statement execute function private_api.politica_erp_append_only();
drop trigger if exists trg_evidencias_erp_append_only on private_api.evidencias_certificacion_erp;
create trigger trg_evidencias_erp_append_only before update or delete on private_api.evidencias_certificacion_erp
  for each row execute function private_api.politica_erp_append_only();
drop trigger if exists trg_evidencias_erp_no_truncate on private_api.evidencias_certificacion_erp;
create trigger trg_evidencias_erp_no_truncate before truncate on private_api.evidencias_certificacion_erp
  for each statement execute function private_api.politica_erp_append_only();

-- V1 = Decisión 1 de Dirección (2026-10-13). Idempotente: re-aplicar NO reactiva V1 si ya hay una V2 posterior.
insert into private_api.politicas_erp (version, ventana_meses, reglas, registrada_por, nota)
values ('ERP_ULTIMA_COMPRA_V1', 24, jsonb_build_object(
  'validez', 'DOCUMENTADO = contract_status DATA_TRUTH_V1 + source_document + source_record_id; la validez histórica NUNCA caduca',
  'actualidad', 'VIGENTE si la última compra (insumo_precios.vigente_desde) >= current_date - ventana_meses (inclusive); si no, ANTIGUO',
  'certificable', '(estado aprobado y sin requiere_validacion_compras) o (DOCUMENTADO y VIGENTE y precio > 0 y activo y sin requiere_validacion_compras y moneda MXN o FX completo y cost_unit = unidad_costeo)',
  'antiguo', 'usable sólo como PRELIMINAR con fecha de última compra y antigüedad visibles',
  'aprobado', 'la aprobación (aprobar_precio, approved_at) cuenta como validación comercial documentada y NO caduca en V1',
  'decision', 'Dirección 2026-10-13, Decisión 1'),
  'PROPUESTA_vh147', 'Política inicial: ventana de actualidad de 24 meses desde la última compra')
on conflict (version) do nothing;

create or replace function private_api.politica_erp()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object('version', p.version, 'ventana_meses', p.ventana_meses, 'reglas', p.reglas, 'activa_desde', p.activa_desde)
  from private_api.politicas_erp p
  where p.activa_desde <= now()
  order by p.activa_desde desc, p.version desc
  limit 1
$$;
comment on function private_api.politica_erp() is
  'VH-147b · versión ACTIVA de la política ERP: {version, ventana_meses, reglas, activa_desde}. NULL si el registro está vacío (falla cerrado: nada certifica por actualidad).';

-- Misma firma que en VH-147; ahora lee la versión activa (STABLE: depende de una tabla).
create or replace function private_api.ventana_actualidad_meses()
returns integer
language sql
stable
as $$ select (private_api.politica_erp()->>'ventana_meses')::integer $$;
comment on function private_api.ventana_actualidad_meses() is
  'VH-147 · meses desde la última compra dentro de los cuales un precio DOCUMENTADO cuenta como VIGENTE para costo certificado. VH-147b: lo da la versión activa de private_api.politica_erp() (V1 = 24, Dirección 2026-10-13).';

-- Registrar una versión nueva (p. ej. cambiar la ventana). Sólo Dirección (JWT) o el dueño en una migración (sin JWT).
create or replace function private_api.registrar_politica_erp(p_version text, p_ventana_meses integer, p_reglas jsonb, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare r private_api.politicas_erp;
begin
  if auth.uid() is not null and not public.puede_certificar_costo() then
    raise exception 'no autorizado: sólo Dirección registra una versión de la política ERP';
  end if;
  if exists (select 1 from private_api.politicas_erp where version = p_version) then
    raise exception 'la versión % ya existe: una política no se reescribe, registra una versión nueva', p_version;
  end if;
  insert into private_api.politicas_erp (version, ventana_meses, reglas, registrada_por, nota)
  values (p_version, p_ventana_meses, coalesce(p_reglas, '{}'::jsonb), coalesce(auth.jwt()->>'email', session_user::text), p_nota)
  returning * into r;
  return to_jsonb(r);
end $$;

-- La vista es security_invoker: quien la lee por REST (costear-servidor, rol service_role) debe poder resolver las funciones.
-- Sólo service_role (servidor). authenticated no tiene SELECT sobre la vista (06_grants) y no lo necesita.
-- (Producción 2026-10-13: has_schema_privilege('service_role','private_api','USAGE') = true; el grant es no-op.)
grant usage on schema private_api to service_role;
grant execute on function private_api.ventana_actualidad_meses() to service_role;
grant execute on function private_api.politica_erp() to service_role;
revoke execute on function private_api.ventana_actualidad_meses() from public, anon, authenticated;
revoke execute on function private_api.politica_erp() from public, anon, authenticated;
revoke execute on function private_api.registrar_politica_erp(text, integer, jsonb, text) from public, anon, authenticated, service_role;
revoke all on table private_api.politicas_erp from public, anon, authenticated, service_role;
revoke all on table private_api.evidencias_certificacion_erp from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Vista. Bloque `ranked` = producción (04_vistas.sql) + columnas de procedencia leídas (no alteran el ranking).
--    CREATE OR REPLACE conserva grants y sólo AÑADE columnas al final (regla de Postgres).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.catalogo_vigente WITH (security_invoker=true) AS
 WITH ranked AS (
         SELECT p.id,
            p.insumo_id,
            p.precio,
            p.unidad_compra,
            p.precio_compra,
            p.factor_conversion,
            p.propiedades,
            p.proveedor,
            p.fuente,
            p.evidencia,
            p.vigente_desde,
            p.vigente_hasta,
            p.estado,
            p.creado_por,
            p.creado_en,
            p.confidence,
            p.evidence_status,
            p.approved_by,
            p.approved_at,
            p.requiere_validacion_compras,
            c.nombre,
            c.seccion,
            c.clasificacion,
            -- VH-147: procedencia y moneda (sólo lectura; el ranking de abajo es el de producción)
            c.activo,
            c.unidad_costeo,
            p.contract_status,
            p.source_system,
            p.source_document,
            p.source_record_id,
            p.source_currency,
            p.fx_rate,
            p.fx_date,
            p.fx_source,
            p.cost_unit,
            row_number() OVER (PARTITION BY p.insumo_id ORDER BY (
                CASE p.estado
                    WHEN 'aprobado'::text THEN 0
                    WHEN 'propuesto_validado'::text THEN 1
                    WHEN 'propuesto'::text THEN 2
                    ELSE 3
                END), (
                CASE p.confidence
                    WHEN 'alta'::text THEN 0
                    WHEN 'media'::text THEN 1
                    ELSE 2
                END), p.vigente_desde DESC NULLS LAST, p.id DESC) AS rn
           FROM insumo_precios p
             JOIN insumos_catalogo c ON c.id = p.insumo_id
          WHERE p.vigente_hasta IS NULL AND COALESCE(c.activo, true) = true
        ), pol AS (
         -- VH-147b: la versión activa se lee UNA vez por consulta y se sella en cada fila.
         SELECT x.p ->> 'version' AS politica_version,
                (x.p ->> 'ventana_meses')::integer AS ventana_actualidad_meses
           FROM (SELECT private_api.politica_erp() AS p) x
        ), politica AS (
         SELECT r.*,
            pol.ventana_actualidad_meses,
            pol.politica_version,
            -- meses completos desde la última compra (NULL si no hay fecha)
            CASE WHEN r.vigente_desde IS NULL THEN NULL
                 ELSE (EXTRACT(year FROM age(current_date, r.vigente_desde)) * 12
                     + EXTRACT(month FROM age(current_date, r.vigente_desde)))::integer END AS antiguedad_meses,
            -- ACTUALIDAD: dentro de la ventana (inclusive) = VIGENTE; fuera o sin fecha = ANTIGUO
            CASE WHEN r.vigente_desde IS NOT NULL
                      AND r.vigente_desde >= (current_date - make_interval(months => pol.ventana_actualidad_meses))
                 THEN 'VIGENTE' ELSE 'ANTIGUO' END AS actualidad,
            -- VALIDEZ (histórica): DOCUMENTADO nunca caduca
            CASE WHEN r.contract_status = 'DATA_TRUTH_V1'
                      AND NULLIF(btrim(r.source_document), '') IS NOT NULL
                      AND NULLIF(btrim(r.source_record_id), '') IS NOT NULL THEN 'DOCUMENTADO'
                 WHEN r.evidence_status IN ('documentada', 'referenciada', 'concordante')
                      OR NULLIF(btrim(r.evidencia), '') IS NOT NULL
                      OR NULLIF(btrim(r.fuente), '') IS NOT NULL THEN 'REFERENCIADO'
                 ELSE 'SIN_EVIDENCIA' END AS validez,
            -- MXN, o FX completo (tasa > 0, fecha y fuente). LEGACY sin moneda declarada = MXN por convención histórica.
            (r.source_currency IS NULL OR r.source_currency = 'MXN'
              OR (r.fx_rate IS NOT NULL AND r.fx_rate > 0 AND r.fx_date IS NOT NULL AND NULLIF(btrim(r.fx_source), '') IS NOT NULL)) AS moneda_resuelta
           FROM ranked r
             CROSS JOIN pol
          WHERE r.rn = 1
        ), evaluado AS (
         SELECT q.*,
            ((q.estado = 'aprobado'::text AND NOT q.requiere_validacion_compras)
             OR (q.validez = 'DOCUMENTADO' AND q.actualidad = 'VIGENTE'
                 AND COALESCE(q.precio, 0) > 0 AND COALESCE(q.activo, true)
                 AND NOT q.requiere_validacion_compras AND q.moneda_resuelta
                 AND q.cost_unit IS NOT NULL AND q.cost_unit = q.unidad_costeo)) AS certificable
           FROM politica q
        )
 SELECT insumo_id,
    nombre,
    seccion,
    clasificacion,
    precio,
    unidad_compra,
    precio_compra,
    factor_conversion,
    propiedades,
    estado,
    evidence_status,
    confidence,
    requiere_validacion_compras,
    certificable,
    fuente,
    evidencia,
    vigente_desde,
    -- ---- VH-147: columnas añadidas (al final, para CREATE OR REPLACE) ----
    antiguedad_meses,
    actualidad,
    validez,
    CASE
        WHEN certificable THEN NULL
        WHEN validez <> 'DOCUMENTADO' THEN
            'sin evidencia documental (' || COALESCE(contract_status, 'LEGACY_UNMIGRATED')
            || COALESCE(', ' || evidence_status, '') || '): certifica sólo con aprobación de Dirección o carga DATA_TRUTH_V1 con documento'
        WHEN requiere_validacion_compras THEN 'requiere validación de Compras'
        WHEN actualidad = 'ANTIGUO' THEN
            'última compra ' || COALESCE(vigente_desde::text, 'sin fecha') || ' (' || COALESCE(antiguedad_meses::text, '?')
            || ' meses): fuera de la ventana de actualidad de ' || COALESCE(ventana_actualidad_meses::text, '? (sin política ERP activa)')
            || ' meses; usable como PRELIMINAR con fecha visible, no certifica costo de reposición sin validación comercial'
        WHEN COALESCE(precio, 0) <= 0 THEN 'precio no positivo'
        WHEN NOT moneda_resuelta THEN 'moneda ' || COALESCE(source_currency, '?') || ' sin tipo de cambio documentado (fx_rate/fx_date/fx_source)'
        WHEN cost_unit IS NULL OR cost_unit <> unidad_costeo THEN
            'unidad de costo ' || COALESCE(cost_unit, '?') || ' distinta de la unidad de costeo ' || COALESCE(unidad_costeo, '?')
        ELSE 'no certificable'
    END AS motivo_no_certificable,
    ventana_actualidad_meses,
    -- ---- VH-147b: versión de política que evaluó esta fila + trazabilidad del precio elegido ----
    politica_version,
    id AS precio_id,
    -- Fecha REAL de última compra: sólo para precios DOCUMENTADOS (en LEGACY, vigente_desde es la fecha de carga).
    CASE WHEN validez = 'DOCUMENTADO' THEN vigente_desde END AS ultima_compra,
    -- Procedencia del precio (la clasificacion del catálogo NO es procedencia: 110 curados nuevo/vigente llevan precio ERP).
    COALESCE(source_system, contract_status) AS origen_precio
   FROM evaluado;
COMMENT ON VIEW public.catalogo_vigente IS 'LEGACY_COMPATIBILITY_VIEW: rn=1 puede desempatar arbitrariamente. NO es autoridad de CertifiedCostSnapshot. Usar resolve_canonical_price(). VH-147: certificable = aprobado sin validación pendiente OR (DOCUMENTADO y VIGENTE ≤ ventana_actualidad_meses); columnas antiguedad_meses/actualidad/validez/motivo_no_certificable. VH-147b: politica_version (versión activa de private_api.politica_erp()), precio_id, ultima_compra (sólo DOCUMENTADO), origen_precio.';

-- ---------------------------------------------------------------------------
-- 3) insumo_motor (VH-088) + evidencia extendida. Misma forma de salida; sólo se AÑADEN claves a `evidencia`.
-- ---------------------------------------------------------------------------
create or replace function private_api.insumo_motor(c public.insumos_catalogo, v public.catalogo_vigente)
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select (coalesce(c.atributos, '{}'::jsonb) - 'articulo')
    || jsonb_build_object(
      'id', c.id,
      'nombre', c.nombre,
      'seccion', coalesce(c.seccion, 'erp-otros'),
      'unidad', c.unidad_costeo,
      'precio', v.precio,
      'precioBase', v.precio,
      'moneda', 'MXN',
      'clase', coalesce(c.atributos->>'clase', 'directa'),
      'fraccion', coalesce((c.atributos->>'fraccion')::boolean, false),
      'mermaCorte', coalesce((c.atributos->>'mermaCorte')::numeric, 0),
      'veta', coalesce((c.atributos->>'veta')::boolean, false),
      'inventario', coalesce((c.atributos->>'inventario')::boolean, false),
      'formato', c.atributos->'formato',
      'actualizado', v.vigente_desde,
      'clasificacion', c.clasificacion,
      'familia', c.familia,
      'proveedor', '',
      'evidencia', jsonb_build_object(
        'estado', v.estado, 'certificable', coalesce(v.certificable, false),
        'confidence', v.confidence, 'evidence_status', v.evidence_status, 'fuente', v.fuente,
        'requiere_validacion_compras', coalesce(v.requiere_validacion_compras, false),
        -- VH-147
        'vigente_desde', v.vigente_desde,
        'antiguedad_meses', v.antiguedad_meses,
        'actualidad', v.actualidad,
        'validez', v.validez,
        'motivo_no_certificable', v.motivo_no_certificable,
        -- VH-147b: versión de política que evaluó el precio; fecha REAL de última compra (sólo DOCUMENTADO; en LEGACY
        -- `vigente_desde`/`actualizado` es la fecha de carga); procedencia del precio (no la clasificacion del catálogo).
        'politica_version', v.politica_version,
        'ultima_compra', v.ultima_compra,
        'origen_precio', v.origen_precio,
        'precio_id', v.precio_id)
    );
$$;

-- ---------------------------------------------------------------------------
-- 4) resolver_costo_insumo (baseline 08_private_api.sql) + las mismas claves.
--    estado_certificacion: CERTIFICADO cuando la vista dice certificable (política), PRELIMINAR si no y hay precio.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.resolver_costo_insumo(p_insumo_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
  c record;
  cfg jsonb;
BEGIN
  -- Guardia seller-safe: el costo NO se entrega a quien no debe verlo.
  IF NOT public.puede_editar_config() THEN
    RAISE EXCEPTION 'no autorizado: el costo de insumos es economía interna (dirección/diseño)';
  END IF;

  -- 1) Catálogo vigente (fuente con estados de certificación).
  SELECT * INTO c FROM public.catalogo_vigente WHERE insumo_id = p_insumo_id LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'insumo_id', c.insumo_id,
      'precio', c.precio,
      'moneda', COALESCE(c.propiedades->>'moneda', 'MXN'),
      'unidad', c.unidad_compra,
      'fuente', COALESCE(c.fuente, 'catalogo_vigente'),
      'evidencia', c.evidencia,
      'vigencia', c.vigente_desde,
      'certificable', c.certificable,
      'requiere_validacion', COALESCE(c.requiere_validacion_compras, false),
      'estado_certificacion',
        CASE
          WHEN c.certificable THEN 'CERTIFICADO'
          WHEN c.estado IN ('aprobado', 'propuesto_validado') THEN 'PRELIMINAR'
          WHEN c.estado = 'propuesto' THEN 'PROPUESTO'
          ELSE 'DESCONOCIDO'
        END,
      -- VH-147
      'vigente_desde', c.vigente_desde,
      'antiguedad_meses', c.antiguedad_meses,
      'actualidad', c.actualidad,
      'validez', c.validez,
      'motivo_no_certificable', c.motivo_no_certificable,
      -- VH-147b
      'politica_version', c.politica_version,
      'ventana_actualidad_meses', c.ventana_actualidad_meses,
      'ultima_compra', c.ultima_compra,
      'origen_precio', c.origen_precio,
      'precio_id', c.precio_id
    );
  END IF;

  -- 2) Config legado (lo que el motor LIVE usa hoy). Honesto: no certificado.
  SELECT datos->'insumos'->p_insumo_id INTO cfg FROM public.config WHERE id = 'vonhaucke';
  IF cfg IS NOT NULL AND cfg <> 'null'::jsonb THEN
    RETURN jsonb_build_object(
      'insumo_id', p_insumo_id,
      'precio', COALESCE((cfg->>'precio')::numeric, (cfg->>'precioBase')::numeric),
      'moneda', COALESCE(cfg->>'moneda', 'MXN'),
      'unidad', cfg->>'unidad',
      'fuente', 'config_legado',
      'evidencia', NULL,
      'vigencia', NULL,
      'certificable', false,
      'requiere_validacion', true,
      'estado_certificacion', 'CONFIG_LEGADO',
      'vigente_desde', NULL, 'antiguedad_meses', NULL, 'actualidad', NULL, 'validez', 'SIN_EVIDENCIA',
      'motivo_no_certificable', 'config legado sin documento',
      'politica_version', private_api.politica_erp()->>'version'
    );
  END IF;

  -- 3) Desconocido: NO se inventa precio.
  RETURN jsonb_build_object(
    'insumo_id', p_insumo_id, 'precio', NULL, 'moneda', NULL, 'unidad', NULL,
    'fuente', NULL, 'evidencia', NULL, 'vigencia', NULL,
    'certificable', false, 'requiere_validacion', true,
    'estado_certificacion', 'DESCONOCIDO',
    'vigente_desde', NULL, 'antiguedad_meses', NULL, 'actualidad', NULL, 'validez', 'SIN_EVIDENCIA',
    'motivo_no_certificable', 'sin precio en catálogo ni config',
    'politica_version', private_api.politica_erp()->>'version'
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5) VH-147b · sellar la evidencia con que se certifica. Quien certifica un costo (costear-servidor con service_role,
--    o Dirección/Diseño) llama esto por cada insumo ERP usado; la fila queda en el libro append-only con la versión y la
--    ventana activas. Una V2 posterior NO toca estas filas. (Integración en costear-servidor: pendiente, fuera de esta
--    propuesta; aquí sólo se deja la función probada.)
-- ---------------------------------------------------------------------------
create or replace function private_api.sellar_evidencia_erp(p_insumo_id text, p_contexto jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c record;
  r private_api.evidencias_certificacion_erp;
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.puede_editar_config()) then
    raise exception 'no autorizado: sellar evidencia de costo es economía interna (dirección/diseño/servidor)';
  end if;
  select * into c from public.catalogo_vigente where insumo_id = p_insumo_id limit 1;
  if not found then
    raise exception 'sin precio vigente en catálogo para %', p_insumo_id;
  end if;
  if c.politica_version is null then
    raise exception 'sin política ERP activa (private_api.politicas_erp vacío): no se sella evidencia';
  end if;
  insert into private_api.evidencias_certificacion_erp (insumo_id, precio_id, precio, estado, vigente_desde, antiguedad_meses,
    actualidad, validez, certificable, estado_certificacion, motivo_no_certificable, politica_version, ventana_meses, sellado_por, contexto)
  values (c.insumo_id, c.precio_id, c.precio, c.estado, c.vigente_desde, c.antiguedad_meses, c.actualidad, c.validez,
    coalesce(c.certificable, false),
    case when c.certificable then 'CERTIFICADO' when c.estado in ('aprobado', 'propuesto_validado') then 'PRELIMINAR'
         when c.estado = 'propuesto' then 'PROPUESTO' else 'DESCONOCIDO' end,
    c.motivo_no_certificable, c.politica_version, c.ventana_actualidad_meses,
    coalesce(auth.jwt()->>'email', auth.role(), session_user::text), p_contexto)
  returning * into r;
  return to_jsonb(r);
end $$;
grant execute on function private_api.sellar_evidencia_erp(text, jsonb) to service_role;
revoke execute on function private_api.sellar_evidencia_erp(text, jsonb) from public, anon, authenticated;

-- Verificación sugerida tras aplicar (sólo lectura):
--   select politica_version, certificable, actualidad, validez, count(*) from public.catalogo_vigente
--    where origen_precio = 'erp_intelisis' group by 1, 2, 3, 4 order by 2 desc, 3, 4;
--   ⚠️ Filtrar por origen_precio, NO por clasificacion = 'erp': 110 insumos CURADOS (clasificacion nuevo/vigente, lote A11)
--   llevan precio ERP y quedarían fuera (9 856 vs 9 966). Ver docs/auditoria/ERP_110_AUDITORIA.md.
--   select private_api.politica_erp();   -- {"version": "ERP_ULTIMA_COMPRA_V1", "ventana_meses": 24, ...}
--   Esperado al 2026-10-13 (§ 4 del doc): certificables ERP ≈ 1 753 aprobados + propuesto_validado con compra ≤ 24 m (0 hoy,
--   porque el cargador aprobó todo lo ≤ 24 m) → el total certificable NO cambia hoy; lo que cambia es que los 8 213
--   antiguos salen con motivo y antigüedad, y que una carga futura ≤ 24 m certifica sin pasar por aprobar_precio.
commit;

-- ============================================================================
--  ROLLBACK VH-147. Bloque comentado: quitar el prefijo "-- " de cada línea entre los marcadores y ejecutar aparte
--  (erpPolitica.test.js lo hace así y verifica que la vista vuelve a las 17 columnas de producción).
--  Un CREATE OR REPLACE VIEW no puede quitar columnas: hay que soltar insumo_motor (depende del tipo de la
--  vista), soltar la vista, recrear la de producción con sus grants y recrear las funciones de VH-088/baseline.
--  El `revoke usage on schema private_api from service_role` queda fuera a propósito: no se sabe si el rol ya
--  tenía USAGE antes (verificar con has_schema_privilege antes de revocar).
-- ============================================================================
-- >>> ROLLBACK VH-147
-- begin;
-- drop function if exists private_api.insumo_motor(public.insumos_catalogo, public.catalogo_vigente);
-- drop view if exists public.catalogo_vigente;
-- CREATE OR REPLACE VIEW public.catalogo_vigente WITH (security_invoker=true) AS
--  WITH ranked AS (
--          SELECT p.id, p.insumo_id, p.precio, p.unidad_compra, p.precio_compra, p.factor_conversion, p.propiedades,
--             p.proveedor, p.fuente, p.evidencia, p.vigente_desde, p.vigente_hasta, p.estado, p.creado_por, p.creado_en,
--             p.confidence, p.evidence_status, p.approved_by, p.approved_at, p.requiere_validacion_compras,
--             c.nombre, c.seccion, c.clasificacion,
--             row_number() OVER (PARTITION BY p.insumo_id ORDER BY (
--                 CASE p.estado WHEN 'aprobado'::text THEN 0 WHEN 'propuesto_validado'::text THEN 1 WHEN 'propuesto'::text THEN 2 ELSE 3 END), (
--                 CASE p.confidence WHEN 'alta'::text THEN 0 WHEN 'media'::text THEN 1 ELSE 2 END), p.vigente_desde DESC NULLS LAST, p.id DESC) AS rn
--            FROM insumo_precios p
--              JOIN insumos_catalogo c ON c.id = p.insumo_id
--           WHERE p.vigente_hasta IS NULL AND COALESCE(c.activo, true) = true
--         )
--  SELECT insumo_id, nombre, seccion, clasificacion, precio, unidad_compra, precio_compra, factor_conversion, propiedades,
--     estado, evidence_status, confidence, requiere_validacion_compras,
--     estado = 'aprobado'::text AND NOT requiere_validacion_compras AS certificable,
--     fuente, evidencia, vigente_desde
--    FROM ranked
--   WHERE rn = 1;
-- COMMENT ON VIEW public.catalogo_vigente IS 'LEGACY_COMPATIBILITY_VIEW: rn=1 puede desempatar arbitrariamente. NO es autoridad de CertifiedCostSnapshot. Usar resolve_canonical_price().';
-- GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.catalogo_vigente TO authenticated;
-- GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.catalogo_vigente TO service_role;
-- create or replace function private_api.insumo_motor(c public.insumos_catalogo, v public.catalogo_vigente)
-- returns jsonb language sql immutable set search_path to 'public' as $$
--   select (coalesce(c.atributos, '{}'::jsonb) - 'articulo')
--     || jsonb_build_object(
--       'id', c.id, 'nombre', c.nombre, 'seccion', coalesce(c.seccion, 'erp-otros'), 'unidad', c.unidad_costeo,
--       'precio', v.precio, 'precioBase', v.precio, 'moneda', 'MXN',
--       'clase', coalesce(c.atributos->>'clase', 'directa'),
--       'fraccion', coalesce((c.atributos->>'fraccion')::boolean, false),
--       'mermaCorte', coalesce((c.atributos->>'mermaCorte')::numeric, 0),
--       'veta', coalesce((c.atributos->>'veta')::boolean, false),
--       'inventario', coalesce((c.atributos->>'inventario')::boolean, false),
--       'formato', c.atributos->'formato', 'actualizado', v.vigente_desde,
--       'clasificacion', c.clasificacion, 'familia', c.familia, 'proveedor', '',
--       'evidencia', jsonb_build_object(
--         'estado', v.estado, 'certificable', coalesce(v.certificable, false),
--         'confidence', v.confidence, 'evidence_status', v.evidence_status, 'fuente', v.fuente,
--         'requiere_validacion_compras', coalesce(v.requiere_validacion_compras, false))
--     );
-- $$;
-- CREATE OR REPLACE FUNCTION private_api.resolver_costo_insumo(p_insumo_id text)
--  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- DECLARE v jsonb; c record; cfg jsonb;
-- BEGIN
--   IF NOT public.puede_editar_config() THEN
--     RAISE EXCEPTION 'no autorizado: el costo de insumos es economía interna (dirección/diseño)';
--   END IF;
--   SELECT * INTO c FROM public.catalogo_vigente WHERE insumo_id = p_insumo_id LIMIT 1;
--   IF FOUND THEN
--     RETURN jsonb_build_object(
--       'insumo_id', c.insumo_id, 'precio', c.precio, 'moneda', COALESCE(c.propiedades->>'moneda', 'MXN'),
--       'unidad', c.unidad_compra, 'fuente', COALESCE(c.fuente, 'catalogo_vigente'), 'evidencia', c.evidencia,
--       'vigencia', c.vigente_desde, 'certificable', c.certificable,
--       'requiere_validacion', COALESCE(c.requiere_validacion_compras, false),
--       'estado_certificacion',
--         CASE WHEN c.estado = 'aprobado' AND c.certificable THEN 'CERTIFICADO'
--              WHEN c.estado = 'propuesto_validado' THEN 'PRELIMINAR'
--              WHEN c.estado = 'propuesto' THEN 'PROPUESTO' ELSE 'DESCONOCIDO' END);
--   END IF;
--   SELECT datos->'insumos'->p_insumo_id INTO cfg FROM public.config WHERE id = 'vonhaucke';
--   IF cfg IS NOT NULL AND cfg <> 'null'::jsonb THEN
--     RETURN jsonb_build_object(
--       'insumo_id', p_insumo_id, 'precio', COALESCE((cfg->>'precio')::numeric, (cfg->>'precioBase')::numeric),
--       'moneda', COALESCE(cfg->>'moneda', 'MXN'), 'unidad', cfg->>'unidad', 'fuente', 'config_legado',
--       'evidencia', NULL, 'vigencia', NULL, 'certificable', false, 'requiere_validacion', true,
--       'estado_certificacion', 'CONFIG_LEGADO');
--   END IF;
--   RETURN jsonb_build_object(
--     'insumo_id', p_insumo_id, 'precio', NULL, 'moneda', NULL, 'unidad', NULL,
--     'fuente', NULL, 'evidencia', NULL, 'vigencia', NULL,
--     'certificable', false, 'requiere_validacion', true, 'estado_certificacion', 'DESCONOCIDO');
-- END;
-- $function$;
-- drop function if exists private_api.sellar_evidencia_erp(text, jsonb);
-- drop function if exists private_api.registrar_politica_erp(text, integer, jsonb, text);
-- drop function if exists private_api.ventana_actualidad_meses();
-- drop function if exists private_api.politica_erp();
-- -- VH-147b: private_api.politicas_erp y private_api.evidencias_certificacion_erp (y su trigger
-- -- private_api.politica_erp_append_only) SE CONSERVAN: son historia de qué versión certificó qué. Sólo con orden
-- -- explícita de Dirección (y respaldo previo) quitar el prefijo de estas dos líneas:
-- -- drop table if exists private_api.evidencias_certificacion_erp;
-- -- drop table if exists private_api.politicas_erp;
-- commit;
-- <<< FIN ROLLBACK VH-147
