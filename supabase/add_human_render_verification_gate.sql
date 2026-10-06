-- Render verification gate: human certification only (Diseño/Dirección).
create or replace function public.verificar_render_canonico(
  p_render_id bigint,
  p_geometry text default 'PASS',
  p_features text default 'PASS',
  p_finish text default 'PASS',
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := auth.jwt()->>'email';
  v_uid uuid := auth.uid();
  v_r public.renders%rowtype;
  v_g text := upper(coalesce(p_geometry,'NOT_VERIFIED'));
  v_f text := upper(coalesce(p_features,'NOT_VERIFIED'));
  v_fin text := upper(coalesce(p_finish,'NOT_VERIFIED'));
  v_valid boolean;
  v_estado text;
begin
  if v_uid is null or coalesce(v_email,'')='' then raise exception 'no autenticado'; end if;
  if not public.puede_editar_config() then raise exception 'sin permiso para validar renders'; end if;
  if v_g not in ('PASS','FAIL','NOT_VERIFIED')
     or v_f not in ('PASS','FAIL','NOT_VERIFIED')
     or v_fin not in ('PASS','FAIL','NOT_VERIFIED') then raise exception 'estado de validación inválido'; end if;
  select * into v_r from public.renders where id=p_render_id for update;
  if not found then raise exception 'render inexistente'; end if;
  if v_r.producto_id is null or v_r.producto_version_id is null
     or coalesce(v_r.spec_hash,'')='' or coalesce(v_r.geometry_hash,'')='' then
    raise exception 'render sin identidad canónica completa';
  end if;
  v_valid := (not v_r.stale and v_g='PASS' and v_f='PASS' and v_fin='PASS');
  if v_valid and coalesce(trim(p_evidence->>'confirmation'),'')='' then
    raise exception 'se requiere evidencia/confirmación humana para validar';
  end if;
  v_estado := case when v_valid then 'VALIDATED' else 'REVIEW_REQUIRED' end;
  update public.renders
  set geometry_validation=v_g, feature_validation=v_f, finish_validation=v_fin, estado=v_estado,
      inputs=coalesce(inputs,'{}'::jsonb) || jsonb_build_object('_validation',jsonb_build_object(
        'validated_by',v_email,'validated_at',now(),'geometry',v_g,'features',v_f,'finish',v_fin,
        'evidence',coalesce(p_evidence,'{}'::jsonb)))
  where id=p_render_id;
  return jsonb_build_object('ok',true,'render_id',p_render_id,'estado',v_estado,
    'geometry_validation',v_g,'feature_validation',v_f,'finish_validation',v_fin,
    'stale',v_r.stale,'validated',v_valid);
end;
$$;
revoke all on function public.verificar_render_canonico(bigint,text,text,text,jsonb) from public;
revoke all on function public.verificar_render_canonico(bigint,text,text,text,jsonb) from anon;
grant execute on function public.verificar_render_canonico(bigint,text,text,text,jsonb) to authenticated;
grant execute on function public.verificar_render_canonico(bigint,text,text,text,jsonb) to service_role;
