-- ============================================================================
--  PROPUESTA DE MIGRACIÓN v2 — NO EJECUTADA (P0.COSTEO · Commit 2b · observabilidad)
--  Agrega a public.ai_eventos los campos de telemetría que NO se podían reutilizar.
--  Aditiva, nullable, idempotente. Requiere autorización explícita para aplicarse.
--
--  v2 (tras auditoría): se separa provider_http_status del http_status NUESTRO, se
--  renombra input_chars→user_input_chars, y se agregan métricas para explicar los ~43 s
--  (provider_duration_ms, input_tokens, output_tokens, catalog_chars, headers/body ms).
--
--  Reutilizados (NO se tocan):
--    · modo              = modalidad (texto/imagen/pdf/revision)
--    · http_status       = status HTTP de NUESTRA Edge Function (se mantiene su semántica)
--    · model_status      = stop_reason del proveedor
--    · duration_ms       = tiempo TOTAL de nuestra función
--    · attempts          = nº de llamadas al proveedor (ahora sí poblada)
--    · error_code        = código de error
--  Derivado (sin columna): retry_used := (attempts > 1).
-- ============================================================================

BEGIN;

ALTER TABLE public.ai_eventos
  -- Config de modelo
  ADD COLUMN IF NOT EXISTS model_id              text,
  ADD COLUMN IF NOT EXISTS effort                text,
  ADD COLUMN IF NOT EXISTS max_tokens            integer,
  -- Tamaño del input (conteos, NUNCA contenido)
  ADD COLUMN IF NOT EXISTS user_input_chars      integer,
  ADD COLUMN IF NOT EXISTS catalog_count         integer,
  ADD COLUMN IF NOT EXISTS catalog_chars         integer,
  -- Uso de tokens del proveedor (data.usage) — explica input vs generación
  ADD COLUMN IF NOT EXISTS input_tokens          integer,
  ADD COLUMN IF NOT EXISTS output_tokens         integer,
  -- Status y tiempos REALES del proveedor (separados de los nuestros)
  ADD COLUMN IF NOT EXISTS provider_http_status  integer,
  ADD COLUMN IF NOT EXISTS provider_duration_ms  integer,
  ADD COLUMN IF NOT EXISTS provider_headers_ms   integer,
  ADD COLUMN IF NOT EXISTS provider_body_ms      integer,
  -- Fallback de modelo (no implementado aún → siempre false)
  ADD COLUMN IF NOT EXISTS fallback_used         boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ai_eventos.model_id             IS 'Modelo resuelto por la config centralizada (ej. claude-opus-5).';
COMMENT ON COLUMN public.ai_eventos.effort               IS 'output_config.effort usado (low/medium).';
COMMENT ON COLUMN public.ai_eventos.max_tokens           IS 'max_tokens enviado al proveedor.';
COMMENT ON COLUMN public.ai_eventos.user_input_chars     IS 'Longitud del TEXTO del usuario (NO el prompt total, NO el texto).';
COMMENT ON COLUMN public.ai_eventos.catalog_count        IS 'Nº de insumos ofrecidos al modelo.';
COMMENT ON COLUMN public.ai_eventos.catalog_chars        IS 'Longitud en chars del catálogo inyectado al prompt (peso del catálogo).';
COMMENT ON COLUMN public.ai_eventos.input_tokens         IS 'data.usage.input_tokens del proveedor (conteo).';
COMMENT ON COLUMN public.ai_eventos.output_tokens        IS 'data.usage.output_tokens del proveedor (conteo).';
COMMENT ON COLUMN public.ai_eventos.provider_http_status IS 'Status HTTP REAL de Anthropic (≠ http_status de nuestra fn). NULL si no hubo respuesta (abort/timeout).';
COMMENT ON COLUMN public.ai_eventos.provider_duration_ms IS 'ms totales de la llamada al proveedor (vs duration_ms = total nuestro).';
COMMENT ON COLUMN public.ai_eventos.provider_headers_ms  IS 'ms hasta recibir headers de la respuesta del proveedor.';
COMMENT ON COLUMN public.ai_eventos.provider_body_ms     IS 'ms leyendo el body de la respuesta del proveedor.';
COMMENT ON COLUMN public.ai_eventos.fallback_used        IS 'true si se usó fallback de modelo (no implementado aún → siempre false).';

COMMIT;

-- ----------------------------------------------------------------------------
-- COMPATIBILIDAD
--   · 100% aditiva. El código v28 ignora estas columnas; el de Commit 2b las
--     escribe en un UPDATE APARTE con try/catch: si la migración NO está aplicada,
--     la telemetría base (CORE) sigue registrándose (no regresa nada).
--   · Antes de aplicar: 17 columnas, 102 filas. Después: 30 columnas (+13).
--
-- RLS
--   · RLS ya está habilitado (1 policy, deniega acceso directo a anon/authenticated).
--     La escritura usa SERVICE ROLE (bypassa RLS); columnas nuevas nullable/boolean-
--     default → la policy existente NO se modifica ni se necesita policy nueva.
--
-- IMPACTO
--   · ADD COLUMN con default no-volátil: en Postgres >= 11 es metadata-only (no
--     reescribe la tabla). 102 filas → instantáneo. Sin bloqueo relevante.
--   · Las 102 filas existentes quedan con NULL en los nuevos campos (salvo
--     fallback_used=false). Esperado: telemetría nueva aplica de aquí en adelante.
--
-- ROLLBACK
BEGIN;
ALTER TABLE public.ai_eventos
  DROP COLUMN IF EXISTS model_id,
  DROP COLUMN IF EXISTS effort,
  DROP COLUMN IF EXISTS max_tokens,
  DROP COLUMN IF EXISTS user_input_chars,
  DROP COLUMN IF EXISTS catalog_count,
  DROP COLUMN IF EXISTS catalog_chars,
  DROP COLUMN IF EXISTS input_tokens,
  DROP COLUMN IF EXISTS output_tokens,
  DROP COLUMN IF EXISTS provider_http_status,
  DROP COLUMN IF EXISTS provider_duration_ms,
  DROP COLUMN IF EXISTS provider_headers_ms,
  DROP COLUMN IF EXISTS provider_body_ms,
  DROP COLUMN IF EXISTS fallback_used;
COMMIT;
-- (El rollback es seguro: el código de Commit 2b tolera la ausencia de columnas.)
-- ----------------------------------------------------------------------------
