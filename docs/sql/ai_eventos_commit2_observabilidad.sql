-- ============================================================================
--  PROPUESTA DE MIGRACIÓN — NO EJECUTADA (P0.COSTEO · Commit 2 · observabilidad)
--  Agrega a public.ai_eventos los campos de telemetría que NO se podían reutilizar.
--  Aditiva, nullable, idempotente. Requiere autorización explícita para aplicarse.
--
--  Reutilizados (NO se tocan): modo(modalidad), duration_ms, http_status
--  (provider_http_status), model_status(stop_reason), attempts, error_code.
--  Derivado (sin columna): retry_used := (attempts > 1).
-- ============================================================================

BEGIN;

ALTER TABLE public.ai_eventos
  ADD COLUMN IF NOT EXISTS model_id       text,
  ADD COLUMN IF NOT EXISTS effort         text,
  ADD COLUMN IF NOT EXISTS max_tokens     integer,
  ADD COLUMN IF NOT EXISTS input_chars    integer,
  ADD COLUMN IF NOT EXISTS catalog_count  integer,
  ADD COLUMN IF NOT EXISTS fallback_used  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ai_eventos.model_id      IS 'Modelo resuelto por la config centralizada (ej. claude-opus-5).';
COMMENT ON COLUMN public.ai_eventos.effort        IS 'output_config.effort usado (low/medium).';
COMMENT ON COLUMN public.ai_eventos.max_tokens    IS 'max_tokens enviado al proveedor.';
COMMENT ON COLUMN public.ai_eventos.input_chars   IS 'Longitud del texto del usuario (NO el texto).';
COMMENT ON COLUMN public.ai_eventos.catalog_count IS 'Nº de insumos ofrecidos al modelo (peso del catálogo).';
COMMENT ON COLUMN public.ai_eventos.fallback_used IS 'true si se usó fallback de modelo (no implementado aún → siempre false).';

COMMIT;

-- ----------------------------------------------------------------------------
-- COMPATIBILIDAD
--   · 100% aditiva. El código v28 ignora estas columnas; el código de Commit 2
--     las escribe en un UPDATE APARTE con try/catch: si la migración NO está
--     aplicada, la telemetría base sigue registrándose (no regresa nada).
--   · Antes de aplicar: 17 columnas, 102 filas. Después: 23 columnas.
--
-- RLS
--   · RLS ya está habilitado (1 policy). La escritura usa SERVICE ROLE (bypassa
--     RLS); columnas nuevas nullable/boolean-default → la policy existente NO se
--     modifica ni se necesita policy nueva.
--
-- IMPACTO
--   · ADD COLUMN con default no-volátil: en Postgres >= 11 es metadata-only
--     (no reescribe la tabla). 102 filas → instantáneo. Sin bloqueo relevante.
--   · Las 102 filas existentes quedan con NULL en los nuevos campos (salvo
--     fallback_used=false). Esperado: telemetría nueva aplica de aquí en adelante.
--
-- ROLLBACK
BEGIN;
ALTER TABLE public.ai_eventos
  DROP COLUMN IF EXISTS model_id,
  DROP COLUMN IF EXISTS effort,
  DROP COLUMN IF EXISTS max_tokens,
  DROP COLUMN IF EXISTS input_chars,
  DROP COLUMN IF EXISTS catalog_count,
  DROP COLUMN IF EXISTS fallback_used;
COMMIT;
-- (El rollback es seguro: el código de Commit 2 tolera la ausencia de columnas.)
-- ----------------------------------------------------------------------------
