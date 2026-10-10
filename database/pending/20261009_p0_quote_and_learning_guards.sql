-- Von Haucke P0 hardening — REVIEW/STAGING FIRST. Not executed in production.
-- Observed live 2026-10-09: aprendizajes INSERT/UPDATE were WITH CHECK true,
-- authenticated had TRIGGER/TRUNCATE; cotizaciones direct INSERT/UPDATE could
-- forge estado/folio_oficial despite the protected RPCs.
--
-- IMPORTANT: run on a disposable staging clone with authenticated QA roles,
-- check RPC create/update still work, then schedule controlled migration.

BEGIN;

-- Limit VONI learning mutation to technical/direction roles. Selection remains
-- available to authenticated so existing reads keep working.
DROP POLICY IF EXISTS aprendizajes_escribe ON public.aprendizajes;
CREATE POLICY aprendizajes_escribe ON public.aprendizajes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private_api.puede_editar_config()));

DROP POLICY IF EXISTS aprendizajes_actualiza ON public.aprendizajes;
CREATE POLICY aprendizajes_actualiza ON public.aprendizajes
  FOR UPDATE TO authenticated
  USING ((SELECT private_api.puede_editar_config()))
  WITH CHECK ((SELECT private_api.puede_editar_config()));

-- Table-level privileges previously included destructive and DDL-like actions.
-- No normal browser user should be able to TRUNCATE or attach a trigger.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.aprendizajes FROM authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.cotizaciones FROM authenticated;

-- Defense in depth against bypass of crear/actualizar_cotizacion_segura:
-- Invoker trigger sees current_user='authenticated' for direct REST writes;
-- SECURITY DEFINER RPCs execute as postgres and can still perform authorized
-- server-side operations. Do not rely on JWT payload fields for this decision.
CREATE OR REPLACE FUNCTION private_api.guard_cotizacion_estado_directo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.estado IS DISTINCT FROM 'borrador'
         OR NEW.folio_oficial IS NOT NULL THEN
        RAISE EXCEPTION 'Estado/folio oficial protegidos: utilice RPC de emision'
          USING ERRCODE = '42501';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.estado IS DISTINCT FROM OLD.estado
         OR NEW.folio_oficial IS DISTINCT FROM OLD.folio_oficial THEN
        RAISE EXCEPTION 'Estado/folio oficial protegidos: utilice RPC de emision'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_cotizacion_estado_directo ON public.cotizaciones;
CREATE TRIGGER trg_guard_cotizacion_estado_directo
  BEFORE INSERT OR UPDATE ON public.cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION private_api.guard_cotizacion_estado_directo();

-- Do not expose the trigger function as user-callable RPC.
REVOKE ALL ON FUNCTION private_api.guard_cotizacion_estado_directo() FROM PUBLIC;
REVOKE ALL ON FUNCTION private_api.guard_cotizacion_estado_directo() FROM anon, authenticated;

COMMIT;
