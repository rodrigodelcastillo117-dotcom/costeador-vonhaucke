-- VH-089 · Carga del ERP desde la app (Dirección): "Cargar compras del ERP". El cliente lee el .xlsx
-- (xlsxMinimo.js), prepara catálogo + precios con la MISMA lógica del cargador del 2026-10-12
-- (erpCarga.js) y las manda por lotes a esta RPC, que aplica las REGLAS del lado del servidor:
--   · un registro ERP (Artículo|Opción) se resuelve al insumo ya conocido (por provenance en
--     insumo_precios o por atributos.erp) antes de crear uno nuevo `erp-*`;
--   · no se duplica un precio ya cargado (mismo registro, mismo precio, misma fecha de compra);
--   · DATA_TRUTH_V1 completo (documento, registro, hash) — nunca precio sin fuente;
--   · compra ≤ 24 meses → se APRUEBA con aprobar_precio (requiere rol dirección); más antigua →
--     propuesto_validado (cuesta, no certifica); BLOQUEADO en ERP → activo=false.
-- Sólo rol dirección (puede_certificar_costo).

create or replace function public.cargar_erp_ultima_compra(p_documento text, p_catalogo jsonb, p_precios jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r jsonb; v_id text; v_rec text; v_nuevos int := 0; v_existentes int := 0; v_precios int := 0;
  v_dups int := 0; v_aprobados int := 0; v_errores jsonb := '[]'::jsonb; v_pid bigint; v_estado text;
begin
  if not public.puede_certificar_costo() then raise exception 'no autorizado: sólo Dirección carga compras del ERP'; end if;
  if p_documento is null or btrim(p_documento) = '' then raise exception 'falta el documento (nombre del archivo del ERP)'; end if;

  -- 1) Catálogo: crear los que no existan (resolviendo por registro ERP), actualizar activo/erp de los existentes.
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
      -- sólo los ERP se mueven de activo con el estatus del ERP; los curados no se tocan.
      update public.insumos_catalogo c set activo = coalesce((r->>'activo')::boolean, c.activo),
        atributos = coalesce(c.atributos, '{}'::jsonb) || jsonb_build_object('erp', r->'atributos'->'erp')
        where c.id = v_id and c.clasificacion = 'erp';
      v_existentes := v_existentes + 1;
    end if;
  end loop;

  -- 2) Precios con provenance.
  for r in select * from jsonb_array_elements(coalesce(p_precios, '[]'::jsonb)) loop
    v_rec := r->>'source_record_id';
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
    if exists (select 1 from public.insumo_precios p where p.source_system = 'erp_intelisis' and p.source_record_id = v_rec
                 and p.source_price = (r->>'source_price')::numeric and p.vigente_desde = (r->>'vigente_desde')::date) then
      v_dups := v_dups + 1; continue;
    end if;
    begin
      v_estado := case when r->>'estado' in ('propuesto', 'propuesto_validado') then r->>'estado' else 'propuesto_validado' end;
      insert into public.insumo_precios (insumo_id, precio, contract_status, source_system, source_document, source_record_id,
        source_price, source_currency, source_unit, source_units_per_cost_unit, cost_unit, vigente_desde, estado, confidence,
        evidence_status, evidencia, fuente, creado_por, requiere_validacion_compras)
      values (v_id, 0, 'DATA_TRUTH_V1', 'erp_intelisis', 'ERP Intelisis · ' || p_documento, v_rec,
        (r->>'source_price')::numeric, 'MXN', r->>'source_unit', 1, r->>'cost_unit', (r->>'vigente_desde')::date, v_estado, 'alta',
        'documentada', r->>'evidencia', 'Compras · ERP Intelisis última compra (' || p_documento || ')', 'carga-erp-app:' || (auth.jwt()->>'email'), false)
      returning id into v_pid;
      v_precios := v_precios + 1;
      if v_estado = 'propuesto' then
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

  return jsonb_build_object('catalogo_nuevos', v_nuevos, 'catalogo_existentes', v_existentes, 'precios_nuevos', v_precios,
    'precios_duplicados', v_dups, 'aprobados', v_aprobados, 'errores', v_errores);
end;
$$;

grant execute on function public.cargar_erp_ultima_compra(text, jsonb, jsonb) to authenticated;
revoke all on function public.cargar_erp_ultima_compra(text, jsonb, jsonb) from public, anon;
