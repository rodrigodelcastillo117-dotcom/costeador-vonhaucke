-- ============================================================================
-- PENDIENTE — RPC precios_vigentes_costeo() (el costeo lee el catálogo de la base)
-- ----------------------------------------------------------------------------
-- NO APLICAR sin autorización escrita de Rodrigo. La base es la misma para
-- pruebas y producción.
--
-- Qué hace: expone a Dirección/Diseño el precio vigente de cada insumo
-- (vista catalogo_vigente) junto con su unidad de costeo, para que la app deje
-- de costear con la copia vieja de `config`. A cualquier otro rol le devuelve
-- 0 filas. No expone proveedor ni evidencia.
--
-- Es aditivo: no toca tablas ni datos. Se puede aplicar antes del deploy (la
-- app desplegada hoy no la llama). Revertir:
--   drop function if exists public.precios_vigentes_costeo();
--   drop function if exists private_api.precios_vigentes_costeo();
-- ============================================================================

create or replace function private_api.precios_vigentes_costeo()
returns table (
  insumo_id text,
  nombre text,
  seccion text,
  precio numeric,
  unidad_costeo text,
  estado text,
  certificable boolean,
  fuente text,
  vigente_desde date
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.insumo_id, v.nombre, v.seccion, v.precio, c.unidad_costeo, v.estado, v.certificable, v.fuente, v.vigente_desde
  from public.catalogo_vigente v
  join public.insumos_catalogo c on c.id = v.insumo_id
  where private_api.puede_editar_config();
$$;

create or replace function public.precios_vigentes_costeo()
returns table (
  insumo_id text,
  nombre text,
  seccion text,
  precio numeric,
  unidad_costeo text,
  estado text,
  certificable boolean,
  fuente text,
  vigente_desde date
)
language plpgsql
stable
set search_path to 'pg_catalog', 'public', 'private_api'
as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  return query select * from private_api.precios_vigentes_costeo();
end
$$;

revoke all on function private_api.precios_vigentes_costeo() from public, anon;
revoke all on function public.precios_vigentes_costeo() from public, anon;
grant execute on function private_api.precios_vigentes_costeo() to authenticated, service_role;
grant execute on function public.precios_vigentes_costeo() to authenticated, service_role;
