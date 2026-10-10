-- Von Haucke P0 — safe additive authorization gate for sales quotations
-- and VONI learning. Existing approved-by-history lessons are preserved but
-- all future sales-origin lessons require review before use in AI prompts.
BEGIN;

-- Baseline: keep history readable. New records start as unapproved.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='aprendizajes'
      AND column_name='aprobado_para_ia'
  ) THEN
    ALTER TABLE public.aprendizajes
      ADD COLUMN aprobado_para_ia boolean NOT NULL DEFAULT false;
    -- Only run once, during the first installation. Replaying this migration
    -- MUST NOT approve sales lessons submitted after the cutoff.
    UPDATE public.aprendizajes SET aprobado_para_ia=true
      WHERE aprobado_para_ia=false;
  END IF;
END $migration$;

CREATE OR REPLACE FUNCTION public.aprendizajes_revision_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  es_editor boolean := (SELECT private_api.puede_editar_config());
BEGIN
  IF TG_OP='INSERT' THEN
    IF es_editor THEN
      NEW.aprobado_para_ia := true;
    ELSE
      NEW.aprobado_para_ia := false;
      NEW.regla_clave := NULL;
      NEW.veces := 1;
      NEW.activo := true;
    END IF;
  ELSE
    IF NOT es_editor THEN
      IF OLD.aprobado_para_ia THEN
        RAISE EXCEPTION 'Leccion aprobada solo modificable por Diseno/Direccion'
          USING ERRCODE='42501';
      END IF;
      IF NEW.texto IS DISTINCT FROM OLD.texto OR NEW.tipo IS DISTINCT FROM OLD.tipo
        OR NEW.pedido IS DISTINCT FROM OLD.pedido
        OR NEW.propuso IS DISTINCT FROM OLD.propuso
        OR NEW.quedo IS DISTINCT FROM OLD.quedo
        OR NEW.activo IS DISTINCT FROM OLD.activo
        OR NEW.regla_clave IS DISTINCT FROM OLD.regla_clave
        OR NEW.aprobado_para_ia IS DISTINCT FROM OLD.aprobado_para_ia
        OR NEW.creado IS DISTINCT FROM OLD.creado
        OR NEW.veces < OLD.veces OR NEW.veces > OLD.veces+1 THEN
        RAISE EXCEPTION 'Solo puedes incrementar una correccion pendiente propia'
          USING ERRCODE='42501';
      END IF;
    END IF;
    NEW.usuario := OLD.usuario;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_aprendizajes_revision_gate ON public.aprendizajes;
CREATE TRIGGER trg_aprendizajes_revision_gate
 BEFORE INSERT OR UPDATE ON public.aprendizajes
 FOR EACH ROW EXECUTE FUNCTION public.aprendizajes_revision_gate();

DROP POLICY IF EXISTS aprendizajes_escribe ON public.aprendizajes;
CREATE POLICY aprendizajes_escribe ON public.aprendizajes FOR INSERT TO authenticated
 WITH CHECK (
   usuario = (SELECT private_api.current_request_email())
   AND (aprobado_para_ia = (SELECT private_api.puede_editar_config()))
 );
DROP POLICY IF EXISTS aprendizajes_actualiza ON public.aprendizajes;
CREATE POLICY aprendizajes_actualiza ON public.aprendizajes FOR UPDATE TO authenticated
 USING (
   (SELECT private_api.puede_editar_config())
   OR (usuario=(SELECT private_api.current_request_email()) AND NOT aprobado_para_ia)
 )
 WITH CHECK (
   (SELECT private_api.puede_editar_config())
   OR (usuario=(SELECT private_api.current_request_email()) AND NOT aprobado_para_ia)
 );

REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES
 ON public.aprendizajes FROM authenticated, anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES
 ON public.cotizaciones FROM authenticated, anon;

CREATE OR REPLACE FUNCTION private_api.guard_cotizacion_estado_directo()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  -- SECURITY DEFINER RPCs use the privileged execution role; raw PostgREST
  -- writes under authenticated can edit drafts but cannot forge issuance.
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.estado IS DISTINCT FROM 'borrador' OR NEW.folio_oficial IS NOT NULL THEN
        RAISE EXCEPTION 'Estado/folio oficial protegidos: utilice RPC de emision'
          USING ERRCODE='42501';
      END IF;
    ELSE
      IF NEW.estado IS DISTINCT FROM OLD.estado
         OR NEW.folio_oficial IS DISTINCT FROM OLD.folio_oficial THEN
        RAISE EXCEPTION 'Estado/folio oficial protegidos: utilice RPC de emision'
          USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_cotizacion_estado_directo ON public.cotizaciones;
CREATE TRIGGER trg_guard_cotizacion_estado_directo
 BEFORE INSERT OR UPDATE ON public.cotizaciones
 FOR EACH ROW EXECUTE FUNCTION private_api.guard_cotizacion_estado_directo();
REVOKE ALL ON FUNCTION private_api.guard_cotizacion_estado_directo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aprendizajes_revision_gate() FROM PUBLIC, anon, authenticated;

COMMIT;