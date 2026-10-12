-- ============================================================================
--  VH-063 · APLICADA 2026-10-11 con aprobación expresa de Dirección ("A3 sólo descuento").
--  La política comercial sólo la puede leer Dirección (RLS rc_sel) y la RPC
--  reglas_comerciales_vigentes está concedida sólo a service_role. El vendedor no
--  podía saber ANTES de verificar que un descuento del 45 % iba a requerir
--  aprobación. Esta función expone ÚNICAMENTE el umbral de descuento sin aprobación
--  y la versión de la política, a cualquier usuario permitido. NO expone el margen
--  mínimo (decisión de Dirección) y no cambia ninguna regla ni ningún precio.
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
    'descuento_max_sin_aprobacion', r->'descuento_max_sin_aprobacion'
  );
end;
$$;
revoke all on function public.politica_comercial_publica() from public;
grant execute on function public.politica_comercial_publica() to authenticated, service_role;
