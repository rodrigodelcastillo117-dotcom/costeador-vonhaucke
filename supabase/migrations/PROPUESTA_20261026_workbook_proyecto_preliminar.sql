-- PROPUESTA · 2026-10-26 · workbooks de proyecto = evidencia preliminar
-- NO aplicada automáticamente.
--
-- Objetivo:
-- 1) cargar_erp_ultima_compra respeta requiere_validacion_compras del cliente.
-- 2) un precio con ese flag NUNCA se autoaprueba durante la carga.
-- 3) las firmas masivas de Dirección NO pueden convertirlo en aprobado hasta que Compras
--    lo revalide mediante el flujo explícito que quite el flag.
--
-- Caso que lo motivó: C-CO-320R TELCEL. El workbook contiene costos reales de última compra,
-- pero es evidencia secundaria/histórica; no equivale al reporte directo actual de Compras.

begin;

create or replace function public.cargar_erp_ultima_compra(p_documento text, p_catalogo jsonb, p_precios jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r jsonb; v_id text; v_rec text; v_nuevos int := 0; v_existentes int := 0; v_precios int := 0;
  v_dups int := 0; v_aprobados int := 0; v_errores jsonb := '[]'::jsonb; v_pid bigint; v_estado text;
  v_requiere_validacion boolean;
begin
  if not public.puede_certificar_costo() then raise exception 'no autorizado: sólo Dirección carga compras del ERP'; end if;
  if p_documento is null or btrim(p_documento) = '' then raise exception 'falta el documento (nombre del archivo del ERP)'; end if;

  for r in select * from jsonb_array_elements(coalesce(p_catalogo, '[]'::jsonb)) loop
    v_rec := concat_ws('|', r->'atributos'->'erp'->>'articulo', coalesce(r->'atributos'->'erp'->>'opcion', ''));
    select p.insumo_id into v_id from public.insumo_precios p
      where p.source_system = 'erp_intelisis' and p.source_record_id = v_rec order by p.id desc limit 1;
    if v_id is null then
      select c.id into v_id from public.insumos_catalogo c
        where c.atributos->'erp'->>'articulo' = r->'atributos'->'erp'->>'articulo'
          and coalesce(c.atributos->'erp'->>'opcion', '') = coalesce(r->'atributos'->'erp'->>'opcion', '') limit 1;
    end if;
    if v_id is null and exists (select 1 from public.insumos_catalogo where id = r->>'id') then v_id := r->>'id'; end if;
    if v_id is null then
      insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia, atributos)
      values (r->>'id', r->>'nombre', r->>'seccion', r->>'unidad_costeo', coalesce((r->>'activo')::boolean, true), 'erp', r->>'familia', r->'atributos');
      v_nuevos := v_nuevos + 1;
    else
      update public.insumos_catalogo c set activo = coalesce((r->>'activo')::boolean, c.activo),
        atributos = coalesce(c.atributos, '{}'::jsonb) || jsonb_build_object('erp', r->'atributos'->'erp')
        where c.id = v_id and c.clasificacion = 'erp';
      v_existentes := v_existentes + 1;
    end if;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_precios, '[]'::jsonb)) loop
    v_rec := r->>'source_record_id';
    v_requiere_validacion := coalesce((r->>'requiere_validacion_compras')::boolean, false);

    select p.insumo_id into v_id from public.insumo_precios p
      where p.source_system = 'erp_intelisis' and p.source_record_id = v_rec order by p.id desc limit 1;
    if v_id is null then
      select c.id into v_id from public.insumos_catalogo c
        where c.atributos->'erp'->>'articulo' = split_part(v_rec, '|', 1)
          and coalesce(c.atributos->'erp'->>'opcion', '') = split_part(v_rec, '|', 2) limit 1;
    end if;
    if v_id is null then v_id := r->>'insumo_id'; end if;
    if not exists (select 1 from public.insumos_catalogo where id = v_id) then
      v_errores := v_errores || jsonb_build_object('registro', v_rec, 'error', 'insumo inexistente: ' || coalesce(v_id, '?')); continue;
    end if;

    if exists (
      select 1 from public.insumo_precios p
      where p.source_system = 'erp_intelisis'
        and p.source_record_id = v_rec
        and p.source_price = (r->>'source_price')::numeric
        and p.vigente_desde = (r->>'vigente_desde')::date
    ) then
      v_dups := v_dups + 1; continue;
    end if;

    begin
      v_estado := case
        when v_requiere_validacion then 'propuesto_validado'
        when r->>'estado' in ('propuesto', 'propuesto_validado') then r->>'estado'
        else 'propuesto_validado'
      end;

      insert into public.insumo_precios (
        insumo_id, precio, contract_status, source_system, source_document, source_record_id,
        source_price, source_currency, source_unit, source_units_per_cost_unit, cost_unit,
        vigente_desde, estado, confidence, evidence_status, evidencia, fuente, creado_por,
        requiere_validacion_compras
      )
      values (
        v_id, 0, 'DATA_TRUTH_V1', 'erp_intelisis', 'ERP Intelisis · ' || p_documento, v_rec,
        (r->>'source_price')::numeric, 'MXN', r->>'source_unit', 1, r->>'cost_unit',
        (r->>'vigente_desde')::date, v_estado, 'alta', 'documentada', r->>'evidencia',
        'Compras · ERP Intelisis última compra (' || p_documento || ')',
        'carga-erp-app:' || (auth.jwt()->>'email'), v_requiere_validacion
      )
      returning id into v_pid;

      v_precios := v_precios + 1;

      if v_estado = 'propuesto' and not v_requiere_validacion then
        begin
          perform public.aprobar_precio(v_pid, 'Carga ERP desde la app · ' || p_documento);
          v_aprobados := v_aprobados + 1;
        exception when others then
          v_errores := v_errores || jsonb_build_object('registro', v_rec, 'error', 'no aprobado: ' || sqlerrm);
        end;
      end if;
    exception when others then
      v_errores := v_errores || jsonb_build_object('registro', v_rec, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'catalogo_nuevos', v_nuevos,
    'catalogo_existentes', v_existentes,
    'precios_nuevos', v_precios,
    'precios_duplicados', v_dups,
    'aprobados', v_aprobados,
    'errores', v_errores
  );
end;
$$;

revoke all on function public.cargar_erp_ultima_compra(text, jsonb, jsonb) from public, anon;
grant execute on function public.cargar_erp_ultima_compra(text, jsonb, jsonb) to authenticated;

-- La función de firma completa también debe saltar precios marcados para revalidación.
create or replace function public.firmar_precios_erp_vigentes(p_meses integer default 24)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  r record; v_ok int := 0; v_fallos int := 0; v_motivos jsonb := '{}'::jsonb; v_m text;
begin
  if v_email = '' or coalesce((select lower(rol) from public.permitidos where lower(email) = v_email limit 1), '') <> 'direccion'
     or exists (select 1 from public.cuentas_no_humanas where lower(email) = v_email) then
    raise exception 'no autorizado: sólo una persona de Dirección (no una cuenta de prueba) firma los precios';
  end if;
  if p_meses is null or p_meses < 1 or p_meses > 120 then raise exception 'p_meses fuera de rango (1..120)'; end if;

  for r in
    select ip.id, ip.approved_by, ip.approved_at from public.insumo_precios ip
     where ip.vigente_hasta is null
       and not coalesce(ip.requiere_validacion_compras, false)
       and nullif(btrim(ip.source_document), '') is not null
       and ip.vigente_desde >= (current_date - make_interval(months => p_meses))
       and (ip.estado is distinct from 'aprobado' or ip.approved_by is null
            or lower(ip.approved_by) in (select lower(email) from public.cuentas_no_humanas))
     order by ip.id
  loop
    begin
      insert into public.aprobaciones_precio_historial(precio_id, aprobado_por, aprobado_por_anterior, aprobado_en_anterior, politica, nota)
      values (r.id, v_email, r.approved_by, r.approved_at,
              format('D1 · última compra Intelisis con documento ≤ %s meses', p_meses),
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
end $$;

revoke all on function public.firmar_precios_erp_vigentes(integer) from public, anon;
grant execute on function public.firmar_precios_erp_vigentes(integer) to authenticated;

-- Versión por lotes: mismo filtro fail-closed.
create or replace function public.firmar_precios_erp_lote(p_meses integer, p_despues_de bigint, p_limite integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  r record; v_ok int := 0; v_fallos int := 0; v_motivos jsonb := '{}'::jsonb; v_m text; v_ultimo bigint := null; v_n int := 0;
begin
  if v_email = '' or coalesce((select lower(rol) from public.permitidos where lower(email) = v_email limit 1), '') <> 'direccion'
     or exists (select 1 from public.cuentas_no_humanas where lower(email) = v_email) then
    raise exception 'no autorizado: sólo una persona de Dirección (no una cuenta de prueba) firma los precios';
  end if;
  if p_meses is null or p_meses < 1 or p_meses > 120 then raise exception 'p_meses fuera de rango (1..120)'; end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then raise exception 'p_limite fuera de rango (1..500)'; end if;

  for r in
    select ip.id, ip.approved_by, ip.approved_at from public.insumo_precios ip
     where ip.id > coalesce(p_despues_de, 0)
       and ip.vigente_hasta is null
       and not coalesce(ip.requiere_validacion_compras, false)
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
      values (r.id, v_email, r.approved_by, r.approved_at,
              format('D1 · última compra Intelisis con documento ≤ %s meses', p_meses),
              'Firma en lote de Dirección');
      perform public.aprobar_precio(r.id, format('Firma Dirección · política D1 ≤ %s meses', p_meses));
      v_ok := v_ok + 1;
    exception when others then
      v_fallos := v_fallos + 1;
      v_m := left(sqlerrm, 120);
      v_motivos := jsonb_set(v_motivos, array[v_m], to_jsonb(coalesce((v_motivos->>v_m)::int, 0) + 1));
    end;
  end loop;

  return jsonb_build_object(
    'firmados', v_ok, 'no_firmados', v_fallos, 'motivos', v_motivos,
    'meses', p_meses, 'firmado_por', v_email,
    'ultimo_id', case when v_n < p_limite then null else v_ultimo end
  );
end $$;

revoke all on function public.firmar_precios_erp_lote(integer, bigint, integer) from public, anon;
grant execute on function public.firmar_precios_erp_lote(integer, bigint, integer) to authenticated;

commit;
