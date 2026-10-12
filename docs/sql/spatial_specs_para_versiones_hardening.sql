-- Reviewed hardening patch. Do NOT run ad-hoc in production.
-- When promoting, create a real Supabase migration with `supabase migration new`
-- and copy this SQL into it, then run advisors + smoke.
--
-- Current live facts verified 2026-10-05:
-- public.spatial_specs_para_versiones(bigint[]) is SECURITY DEFINER owned by postgres;
-- anon has no EXECUTE; authenticated does; producto_versiones is SELECT-able by
-- authenticated and RLS SELECT is active. Therefore SECURITY INVOKER preserves
-- the required read path while removing owner-privilege execution.

alter function public.spatial_specs_para_versiones(bigint[])
  security invoker;

revoke execute on function public.spatial_specs_para_versiones(bigint[])
  from public, anon;

grant execute on function public.spatial_specs_para_versiones(bigint[])
  to authenticated, service_role;

-- Verification queries to run in the migration/smoke session:
-- 1) pg_proc.prosecdef must be false.
-- 2) anon EXECUTE false; authenticated EXECUTE true.
-- 3) an allowed authenticated user receives only version_id + spatial_spec.
-- 4) unauthorized/no-session calls remain rejected by RLS/session path.
