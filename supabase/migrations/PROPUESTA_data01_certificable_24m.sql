-- ============================================================================
-- PROPUESTA · P1-DATA-01 — Contrato de antigüedad de 24 meses para `certificable`
-- ----------------------------------------------------------------------------
--  ████  BORRADOR — NO APLICADO. Requiere aprobación de Dirección/Ingeniería.  ████
--  Misma convención que los demás supabase/migrations/PROPUESTA_*.sql: redactada,
--  idempotente (create or replace / if not exists), NO ejecutada en producción.
--
--  Proyecto: mtuvnbgljwbsaizjjgzs · Análisis: scratchpad/final100/DATA01_analisis.md
--  Probada en PostgreSQL real (PGlite) por src/datos/data01Certificable.test.js.
--
--  Qué hace:
--    (a) `certificable` (vista catalogo_vigente) exige última compra (vigente_desde) <= 24 meses.
--    (b) Las RPC firmar_precios_erp_lote / firmar_precios_erp_vigentes limitan p_meses a 1..24.
--    (c) Acción auditable "revalidación de vigencia" (tabla + RPC) que NUNCA altera
--        vigente_desde ni los importes, y que NO re-certifica por sí sola.
--    (d) Preserva aprobaciones_precio_historial intacta (evidencia de las firmas históricas).
--
--  Garantías:
--    * NO cambia ningún importe (precio, source_price, cost_unit_price_mxn, ...).
--    * NO borra ni modifica aprobaciones_precio_historial.
--    * NO re-aprueba ni des-aprueba filas: los ~8,214 precios siguen estado='aprobado'
--      pero dejan de reportarse certificable por antigüedad (badge UI => PRELIMINAR).
--    * vigente_desde es inmutable por trigger (insumo_precios_append_only): la revalidación
--      vive en una tabla aparte, nunca como UPDATE a insumo_precios.
--    * NO inventa una duración de revalidación comercial: sin definición de Dirección, el
--      precio > 24 meses queda PRELIMINAR (el hook de vigencia extendida va comentado/apagado).
--
--  Umbral: 24 meses calendario (make_interval(months => 24)), consistente con las RPC.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (a) VISTA catalogo_vigente — `certificable` ahora respeta <= 24 meses
-- ----------------------------------------------------------------------------
-- Cambio mínimo: se agrega el gate de antigüedad a `certificable` (misma columna, mismo
-- tipo, misma posición) y se añaden al final dos columnas de conveniencia
-- (antiguedad_dias, estatus_certificacion). Todo lo demás es IDÉNTICO a la vista actual.
create or replace view public.catalogo_vigente as
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
            row_number() OVER (PARTITION BY p.insumo_id ORDER BY
                CASE p.estado
                    WHEN 'aprobado'::text THEN 0
                    WHEN 'propuesto_validado'::text THEN 1
                    WHEN 'propuesto'::text THEN 2
                    ELSE 3
                END,
                CASE p.confidence
                    WHEN 'alta'::text THEN 0
                    WHEN 'media'::text THEN 1
                    ELSE 2
                END, p.vigente_desde DESC NULLS LAST, p.id DESC) AS rn
           FROM (insumo_precios p
             JOIN insumos_catalogo c ON ((c.id = p.insumo_id)))
          WHERE ((p.vigente_hasta IS NULL) AND (COALESCE(c.activo, true) = true))
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
    -- >>> CAMBIO P1-DATA-01: gate de 24 meses sobre la última compra (vigente_desde) <<<
    ((estado = 'aprobado'::text)
       AND (NOT requiere_validacion_compras)
       AND vigente_desde IS NOT NULL
       AND vigente_desde >= (current_date - make_interval(months => 24))) AS certificable,
    fuente,
    evidencia,
    vigente_desde,
    id AS precio_id,
    -- columnas AÑADIDAS AL FINAL (compatibles con create or replace view):
    (current_date - vigente_desde) AS antiguedad_dias,
    CASE
      WHEN estado = 'aprobado'::text
           AND (NOT requiere_validacion_compras)
           AND vigente_desde IS NOT NULL
           AND vigente_desde >= (current_date - make_interval(months => 24))
      THEN 'CERTIFICADO'
      ELSE 'PRELIMINAR'
    END AS estatus_certificacion
   FROM ranked
  WHERE (rn = 1);

comment on view public.catalogo_vigente is
  'P1-DATA-01: certificable exige última compra (vigente_desde) <= 24 meses. '
  'Un precio aprobado pero > 24 meses se reporta PRELIMINAR sin alterar datos ni historial.';

-- ----------------------------------------------------------------------------
-- (b) RPC de firma — limitar p_meses a 1..24 (rechazar > 24)
-- ----------------------------------------------------------------------------
-- Se conserva TODA la lógica actual; sólo cambia el guard de rango de 1..360 a 1..24.
create or replace function public.firmar_precios_erp_lote(p_meses integer, p_despues_de bigint, p_limite integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  r record; v_ok int := 0; v_fallos int := 0; v_motivos jsonb := '{}'::jsonb; v_m text; v_ultimo bigint := null; v_n int := 0;
begin
  if v_email = '' or coalesce((select lower(rol) from public.permitidos where lower(email) = v_email limit 1), '') <> 'direccion'
     or exists (select 1 from public.cuentas_no_humanas where lower(email) = v_email) then
    raise exception 'no autorizado: sólo una persona de Dirección (no una cuenta de prueba) firma los precios';
  end if;
  -- >>> CAMBIO P1-DATA-01: tope 24 en lugar de 360 <<<
  if p_meses is null or p_meses < 1 or p_meses > 24 then
    raise exception 'p_meses fuera de rango (1..24): el contrato D1 exige última compra documentada <= 24 meses';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then raise exception 'p_limite fuera de rango (1..500)'; end if;
  for r in
    select ip.id, ip.approved_by, ip.approved_at from public.insumo_precios ip
     where ip.id > coalesce(p_despues_de, 0)
       and ip.vigente_hasta is null
       and nullif(btrim(ip.source_document), '') is not null
       and ip.vigente_desde >= (current_date - make_interval(months => p_meses))
       and (ip.estado is distinct from 'aprobado' or ip.approved_by is null
            or lower(ip.approved_by) in (select lower(email) from public.cuentas_no_humanas))
     order by ip.id
     limit p_limite
  loop
    v_n := v_n + 1; v_ultimo := r.id;
    begin
      insert into public.aprobaciones_precio_historial(precio_id, aprobado_por, aprobado_por_anterior, aprobado_en_anterior, politica, nota)
      values (r.id, v_email, r.approved_by, r.approved_at, format('D1 · última compra Intelisis con documento ≤ %s meses', p_meses),
              'Firma en lote de Dirección');
      perform public.aprobar_precio(r.id, format('Firma Dirección · política D1 ≤ %s meses', p_meses));
      v_ok := v_ok + 1;
    exception when others then
      v_fallos := v_fallos + 1;
      v_m := left(sqlerrm, 120);
      v_motivos := jsonb_set(v_motivos, array[v_m], to_jsonb(coalesce((v_motivos->>v_m)::int, 0) + 1));
    end;
  end loop;
  return jsonb_build_object('firmados', v_ok, 'no_firmados', v_fallos, 'motivos', v_motivos, 'meses', p_meses, 'firmado_por', v_email,
                            'ultimo_id', case when v_n < p_limite then null else v_ultimo end);
end $function$;

create or replace function public.firmar_precios_erp_vigentes(p_meses integer default 24)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  r record; v_ok int := 0; v_fallos int := 0; v_motivos jsonb := '{}'::jsonb; v_m text;
begin
  if v_email = '' or coalesce((select lower(rol) from public.permitidos where lower(email) = v_email limit 1), '') <> 'direccion'
     or exists (select 1 from public.cuentas_no_humanas where lower(email) = v_email) then
    raise exception 'no autorizado: sólo una persona de Dirección (no una cuenta de prueba) firma los precios';
  end if;
  -- >>> CAMBIO P1-DATA-01: tope 24 en lugar de 360 <<<
  if p_meses is null or p_meses < 1 or p_meses > 24 then
    raise exception 'p_meses fuera de rango (1..24): el contrato D1 exige última compra documentada <= 24 meses';
  end if;
  for r in
    select ip.id, ip.approved_by, ip.approved_at from public.insumo_precios ip
     where ip.vigente_hasta is null
       and nullif(btrim(ip.source_document), '') is not null
       and ip.vigente_desde >= (current_date - make_interval(months => p_meses))
       and (ip.estado is distinct from 'aprobado' or ip.approved_by is null
            or lower(ip.approved_by) in (select lower(email) from public.cuentas_no_humanas))
     order by ip.id
  loop
    begin
      insert into public.aprobaciones_precio_historial(precio_id, aprobado_por, aprobado_por_anterior, aprobado_en_anterior, politica, nota)
      values (r.id, v_email, r.approved_by, r.approved_at, format('D1 · última compra Intelisis con documento ≤ %s meses', p_meses),
              'Firma en lote de Dirección');
      perform public.aprobar_precio(r.id, format('Firma Dirección · política D1 ≤ %s meses', p_meses));
      v_ok := v_ok + 1;
    exception when others then
      v_fallos := v_fallos + 1;
      v_m := left(sqlerrm, 120);
      v_motivos := jsonb_set(v_motivos, array[v_m], to_jsonb(coalesce((v_motivos->>v_m)::int, 0) + 1));
    end;
  end loop;
  return jsonb_build_object('firmados', v_ok, 'no_firmados', v_fallos, 'motivos', v_motivos, 'meses', p_meses, 'firmado_por', v_email);
end $function$;

-- ----------------------------------------------------------------------------
-- (c) Acción AUDITABLE de "revalidación de vigencia" (tabla + RPC)
-- ----------------------------------------------------------------------------
create table if not exists public.revalidaciones_vigencia (
  id                        bigint generated always as identity primary key,
  precio_id                 bigint      not null references public.insumo_precios(id),
  revalidado_por            text        not null,                 -- quién (email Dirección)
  revalidado_en             timestamptz not null default now(),   -- cuándo
  razon                     text        not null,                 -- por qué
  precio_revalidado         numeric     not null,                 -- precio exacto revalidado (snapshot)
  vigente_desde_original    date        not null,                 -- última compra original (NO se toca)
  fuente_historica_original text,
  source_document_original  text,
  source_system_original    text,
  source_record_id_original text,
  source_hash_original      text
);

comment on table public.revalidaciones_vigencia is
  'P1-DATA-01: bitácora auditable de revalidación de vigencia de precios > 24 meses. '
  'NUNCA altera insumo_precios.vigente_desde ni los importes. NO re-certifica por sí sola: '
  'sin una duración de revalidación definida por Dirección, el precio permanece PRELIMINAR.';

create index if not exists ix_revalidaciones_vigencia_precio on public.revalidaciones_vigencia(precio_id);

-- Bitácora inmutable (append-only), consistente con insumo_precios.
create or replace function public.revalidaciones_vigencia_append_only()
 returns trigger language plpgsql set search_path to '' as $f$
begin
  raise exception 'revalidaciones_vigencia es append-only: % prohibido', tg_op;
end $f$;
drop trigger if exists trg_revalidaciones_vigencia_append_only on public.revalidaciones_vigencia;
create trigger trg_revalidaciones_vigencia_append_only
  before update or delete on public.revalidaciones_vigencia
  for each row execute function public.revalidaciones_vigencia_append_only();

-- RPC: registra la revalidación. Solo Dirección. NO toca insumo_precios.
create or replace function public.revalidar_vigencia_precio(p_precio_id bigint, p_razon text)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare r public.insumo_precios%rowtype; v_email text := lower(coalesce(auth.jwt()->>'email','')); v_id bigint;
begin
  if not public.puede_certificar_costo() then
    raise exception 'no autorizado: sólo Dirección puede revalidar vigencia';
  end if;
  if p_razon is null or btrim(p_razon) = '' then
    raise exception 'razón de revalidación obligatoria';
  end if;
  select * into r from public.insumo_precios where id = p_precio_id;
  if r.id is null then raise exception 'precio % inexistente', p_precio_id; end if;
  if r.vigente_desde is null then raise exception 'precio % sin vigente_desde: no se puede revalidar vigencia', p_precio_id; end if;

  insert into public.revalidaciones_vigencia(
      precio_id, revalidado_por, razon, precio_revalidado,
      vigente_desde_original, fuente_historica_original,
      source_document_original, source_system_original, source_record_id_original, source_hash_original)
  values (r.id, v_email, btrim(p_razon), r.precio,
          r.vigente_desde, r.fuente,
          r.source_document, r.source_system, r.source_record_id, r.source_hash)
  returning id into v_id;

  -- IMPORTANTE: NO se ejecuta ningún UPDATE sobre insumo_precios.
  --   * vigente_desde NO cambia (además es inmutable por trigger).
  --   * estado / approved_by / approved_at NO cambian.
  --   * el importe NO cambia.
  -- El precio > 24 meses permanece PRELIMINAR en catalogo_vigente. Esta RPC sólo deja evidencia.
  return v_id;
end $function$;

-- --- HOOK FUTURO (APAGADO A PROPÓSITO) -------------------------------------
-- Si Dirección define formalmente una duración de revalidación (p.ej. N meses de vigencia
-- comercial tras revalidar), se habilitaría extendiendo el gate de `certificable` para aceptar
-- una revalidación reciente. Se deja COMENTADO para NO inventar la duración:
--
--   -- en la expresión certificable de catalogo_vigente, añadir una rama:
--   --   OR EXISTS (SELECT 1 FROM public.revalidaciones_vigencia rv
--   --              WHERE rv.precio_id = id
--   --                AND rv.revalidado_en >= now() - make_interval(months => <N_DEFINIDO_POR_DIRECCION>))
--   -- <N_DEFINIDO_POR_DIRECCION> NO está definido => rama deshabilitada => precios viejos PRELIMINAR.
-- ---------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- (d) PRESERVACIÓN de las firmas históricas como evidencia
-- ----------------------------------------------------------------------------
-- NO se borra ni modifica aprobaciones_precio_historial. Vista de lectura (aditiva) para auditoría.
create or replace view public.firmas_historicas_evidencia as
  select h.id            as historial_id,
         h.precio_id,
         h.aprobado_por,
         h.aprobado_en,
         h.politica,
         h.nota,
         ip.insumo_id,
         ip.precio,
         ip.vigente_desde,
         (current_date - ip.vigente_desde)                                   as antiguedad_dias,
         (ip.vigente_desde < (current_date - make_interval(months => 24)))   as excede_24_meses
  from public.aprobaciones_precio_historial h
  join public.insumo_precios ip on ip.id = h.precio_id;

comment on view public.firmas_historicas_evidencia is
  'P1-DATA-01: evidencia de las firmas históricas (incl. políticas 120/360 meses). Solo lectura. '
  'No borra nada: documenta qué firmas quedan fuera del contrato de 24 meses.';

-- ████  FIN BORRADOR — NO APLICADO.  ████
