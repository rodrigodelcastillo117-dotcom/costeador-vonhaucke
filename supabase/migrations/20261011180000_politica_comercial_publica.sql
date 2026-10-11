-- ============================================================================
--  PENDIENTE DE APLICAR · requiere aprobación expresa de Dirección (mandato §10)
--  VH-063 · La política comercial (margen mínimo, descuento máximo sin aprobación)
--  sólo la puede leer Dirección (RLS rc_sel = puede_ver_economia) y la RPC
--  reglas_comerciales_vigentes está concedida sólo a service_role. El vendedor no
--  puede saber ANTES de verificar que un descuento del 45 % va a requerir
--  aprobación: lo descubre al final. Esta función expone únicamente los dos
--  umbrales y la versión (no la tabla), a cualquier usuario permitido.
--  No cambia ninguna regla ni ningún precio.
-- ============================================================================
create or replace function public.politica_comercial_publica()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare r jsonb;
begin
  if auth.uid() is null or not private_api.puede_entrar() then
    raise exception 'no autorizado';
  end if;
  r := public.reglas_comerciales_vigentes(current_date);
  if r is null then return jsonb_build_object('vigente', false); end if;
  return jsonb_build_object(
    'vigente', true,
    'version', r->'version',
    'margen_minimo_pct', r->'margen_minimo_pct',
    'descuento_max_sin_aprobacion', r->'descuento_max_sin_aprobacion'
  );
end;
$$;
revoke all on function public.politica_comercial_publica() from public;
grant execute on function public.politica_comercial_publica() to authenticated, service_role;
