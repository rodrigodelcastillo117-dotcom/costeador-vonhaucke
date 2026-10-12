-- STAGED ONLY — el resolver actual omite las columnas de validación que el
-- frontend necesita para distinguir VIGENTE de PENDIENTE_VALIDACION.

create or replace function private_api.resolver_renders_canonicos(p_version_ids bigint[])
returns table(
  producto_id bigint,
  producto_version_id bigint,
  estado text,
  stale boolean,
  storage_url text,
  creado timestamptz,
  prompt_version text,
  geometry_hash text,
  modo text,
  geometry_validation text,
  feature_validation text,
  finish_validation text,
  spec_hash text
)
language sql
stable security definer
set search_path to 'public'
as $$
  select r.producto_id, r.producto_version_id, r.estado, r.stale,
         r.storage_url, r.creado, r.prompt_version, r.geometry_hash, r.modo,
         r.geometry_validation, r.feature_validation, r.finish_validation, r.spec_hash
  from public.renders r
  where r.producto_version_id = any(p_version_ids)
$$;

create or replace function public.resolver_renders_canonicos(p_version_ids bigint[])
returns table(
  producto_id bigint,
  producto_version_id bigint,
  estado text,
  stale boolean,
  storage_url text,
  creado timestamptz,
  prompt_version text,
  geometry_hash text,
  modo text,
  geometry_validation text,
  feature_validation text,
  finish_validation text,
  spec_hash text
)
language plpgsql stable
set search_path to 'pg_catalog','public','private_api'
as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  return query select * from private_api.resolver_renders_canonicos(p_version_ids);
end $$;

revoke execute on function public.resolver_renders_canonicos(bigint[]) from anon;
grant execute on function public.resolver_renders_canonicos(bigint[]) to authenticated, service_role;
