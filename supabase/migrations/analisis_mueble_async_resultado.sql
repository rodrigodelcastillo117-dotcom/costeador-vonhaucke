-- ============================================================================
-- ANÁLISIS DE MUEBLE · MODO ASÍNCRONO (opus en segundo plano) — fix de raíz al timeout
--
-- Problema: la 1ª pasada de TEXTO con opus excede el wall-clock de ~150 s del gateway de
-- Supabase y devolvía 504 ("El análisis tardó demasiado"). Subir el abort interno NO
-- alcanza: 150 s es el techo de RESPUESTA del gateway.
--
-- Fix de raíz: la función `analizar-mueble` corre opus en segundo plano (EdgeRuntime.waitUntil,
-- hasta el wall-clock de 400 s del plan de pago), RESPONDE AL INSTANTE con un job_id, y escribe
-- el resultado final en `ai_eventos.resultado`. El front lo consulta con `estado_analisis()`.
--
-- Esta migración es ADITIVA y SEGURA: NO altera datos ni contratos existentes (sólo agrega una
-- columna nullable y una función de lectura con RLS por usuario).
-- ============================================================================

-- 1) Columna donde la función escribe el objeto de respuesta final del análisis async:
--    el MISMO { ok, propuesta, validacion, catalogoFuente, ... } que devolvía en modo síncrono,
--    o { ok:false, code, error } en fallo. NULL = aún procesando (señal de completitud del front).
alter table public.ai_eventos add column if not exists resultado jsonb;

-- 2) RPC para que el front consulte el estado/resultado de SU análisis por request_id.
--    `ai_eventos` tiene RLS restrictiva para el front; esta función SECURITY DEFINER expone
--    SÓLO las columnas necesarias y SÓLO las filas del propio usuario (email del JWT).
--    request_id es un UUID aleatorio generado por el servidor (capability no enumerable);
--    el filtro por email es defensa en profundidad (un usuario nunca ve el análisis de otro).
create or replace function public.estado_analisis(p_request_id uuid)
returns table (status text, http_status int, error_code text, resultado jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select e.status, e.http_status, e.error_code, e.resultado
  from public.ai_eventos e
  where e.request_id = p_request_id
    and lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

revoke all on function public.estado_analisis(uuid) from public, anon;
grant execute on function public.estado_analisis(uuid) to authenticated;

-- ROLLBACK (si hiciera falta):
--   drop function if exists public.estado_analisis(uuid);
--   alter table public.ai_eventos drop column if exists resultado;
