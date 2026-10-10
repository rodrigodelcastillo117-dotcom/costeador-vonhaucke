-- Harden five invoker trigger functions without changing their bodies,
-- row logic, role permissions or historical records.
-- All user tables and RPCs within these definitions are schema-qualified.
BEGIN;
ALTER FUNCTION public.guard_producto_version() SET search_path TO '';
ALTER FUNCTION public.guard_delete_producto_version() SET search_path TO '';
ALTER FUNCTION public.guard_precio_no_autofirma() SET search_path TO '';
ALTER FUNCTION public.insumo_precios_append_only() SET search_path TO '';
ALTER FUNCTION public.guard_mapeo_externo() SET search_path TO '';
COMMIT;