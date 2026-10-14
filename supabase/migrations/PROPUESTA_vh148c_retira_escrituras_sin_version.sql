-- ============================================================================
--  PROPUESTA · VH-148c · PASO 2 del fail-closed: retirar las escrituras SIN versión.
--  ⚠️ NO APLICAR sin autorización de Dirección. ⚠️ NO APLICAR mientras el cliente de producción sea
--  c3.4-seller-safe @ c8dd2b3 (o cualquier build anterior al de VH-148b): ese cliente guarda con
--  actualizar_cotizacion_segura de DOS argumentos y edita expedientes por UPDATE directo; con este
--  archivo aplicado DEJARÍA DE GUARDAR (42501 permiso denegado).
--
--  Orden: (1) PROPUESTA_vh148 → (2) PROPUESTA_vh148b → (3) desplegar el cliente nuevo con
--  VITE_CONTROL_OPTIMISTA=1 y confirmar que ningún cliente viejo sigue abierto → (4) ESTE archivo.
--
--  QUÉ HACE: quita a `authenticated` el EXECUTE de las firmas sin versión (los núcleos privados siguen
--  existiendo: las sobrecargas con versión delegan en ellos) y el UPDATE directo de expedientes (el cliente
--  nuevo usa actualizar_expediente_seguro). service_role conserva todo (Edge Functions, mantenimiento).
--  Pruebas: supabase/tests/vh148FailClosed.test.js (bloque "PASO 2").
-- ============================================================================
begin;

do $$
begin
  if to_regprocedure('public.actualizar_expediente_seguro(bigint, jsonb, integer)') is null
     or to_regprocedure('public.guardar_cocrear_seguro(bigint, jsonb, integer)') is null then
    raise exception 'VH-148c: aplica antes PROPUESTA_vh148b_fail_closed_versiones.sql';
  end if;
end $$;

-- PUBLIC/anon no tienen EXECUTE en producción (baseline/06_grants.sql); se revocan igual por si acaso.
revoke execute on function public.actualizar_cotizacion_segura(bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.guardar_cocrear_seguro(bigint, jsonb) from public, anon, authenticated;
revoke update on table public.expedientes from authenticated;

NOTIFY pgrst, 'reload schema';
commit;

-- ============================================================================
--  ROLLBACK (quitar el prefijo `-- RB ` y correr): devuelve los privilegios medidos en producción
--  (baseline/06_grants.sql:40, 81, 136).
-- ============================================================================
-- RB begin;
-- RB grant execute on function public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb) to authenticated;
-- RB grant execute on function public.guardar_cocrear_seguro(p_expediente_id bigint, p_payload jsonb) to authenticated;
-- RB grant update on table public.expedientes to authenticated;
-- RB notify pgrst, 'reload schema';
-- RB commit;
