-- ============================================================================
--  APLICADA en producción (mtuvnbgljwbsaizjjgzs) el 2026-10-18 como `firma_precios_d1_360m_y_d2_sin_documento`,
--  por decisión de Dirección (Rodrigo: "quiero tener todos", "los viejos son reales").
--  1) D1: el límite de meses de la firma en lote pasa de 120 a 360 (sólo ese rango; cuerpo idéntico).
--  2) D2: firma en lote de Dirección de precios SIN documento de compra, con su propia política en el historial.
--  La regla de aprobación (insumo_precios_aprobado_integridad_chk: evidencia, confianza, sin marca de Compras) NO
--  cambia: lo que Compras marcó para validar sigue sin poder aprobarse.
--  Resultado en producción: 4,868 (D1, compra > 10 años) + 194 (D2) firmados; 65 siguen fuera (marca de Compras).
--  Pruebas: supabase/tests/firmaPreciosErp.test.js (describe "D1 a 360 meses y D2 sin documento").
--  ROLLBACK:
--    drop function public.firmar_precios_sin_documento_lote(bigint, integer);
--    y en firmar_precios_erp_lote / firmar_precios_erp_vigentes volver 'p_meses > 360' → 'p_meses > 120' y
--    '(1..360)' → '(1..120)' (mismo bloque de abajo con los textos invertidos).
-- ============================================================================
do $$
declare f regprocedure; d text; n text;
begin
  foreach f in array array['public.firmar_precios_erp_lote(integer,bigint,integer)'::regprocedure,
                           'public.firmar_precios_erp_vigentes(integer)'::regprocedure] loop
    d := pg_get_functiondef(f);
    -- Idempotente: producción ya la tiene (aplicada por MCP con otra versión); un `db push` no debe fallar.
    if position('p_meses > 360' in d) > 0 then continue; end if;
    n := replace(d, 'p_meses > 120 then raise exception ''p_meses fuera de rango (1..120)''', 'p_meses > 360 then raise exception ''p_meses fuera de rango (1..360)''');
    if n = d then raise exception 'no encontré el límite de 120 meses en %', f; end if;
    execute n;
  end loop;
end $$;

create or replace function public.firmar_precios_sin_documento_lote(p_despues_de bigint, p_limite integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  r record; v_ok int := 0; v_fallos int := 0; v_motivos jsonb := '{}'::jsonb; v_m text; v_ultimo bigint := null; v_n int := 0;
begin
  if v_email = '' or coalesce((select lower(rol) from public.permitidos where lower(email) = v_email limit 1), '') <> 'direccion'
     or exists (select 1 from public.cuentas_no_humanas where lower(email) = v_email) then
    raise exception 'no autorizado: sólo una persona de Dirección (no una cuenta de prueba) firma los precios';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then raise exception 'p_limite fuera de rango (1..500)'; end if;
  for r in
    select ip.id, ip.approved_by, ip.approved_at from public.insumo_precios ip
     where ip.id > coalesce(p_despues_de, 0)
       and ip.vigente_hasta is null
       and nullif(btrim(ip.source_document), '') is null
       and (ip.estado is distinct from 'aprobado' or ip.approved_by is null
            or lower(ip.approved_by) in (select lower(email) from public.cuentas_no_humanas))
     order by ip.id
     limit p_limite
  loop
    v_n := v_n + 1; v_ultimo := r.id;
    begin
      insert into public.aprobaciones_precio_historial(precio_id, aprobado_por, aprobado_por_anterior, aprobado_en_anterior, politica, nota)
      values (r.id, v_email, r.approved_by, r.approved_at, 'D2 · firma de Dirección sin documento de compra',
              'Firma en lote de Dirección sin documento (18-oct-2026)');
      perform public.aprobar_precio(r.id, 'Firma Dirección · política D2 sin documento de compra');
      v_ok := v_ok + 1;
    exception when others then
      v_fallos := v_fallos + 1;
      v_m := left(sqlerrm, 120);
      v_motivos := jsonb_set(v_motivos, array[v_m], to_jsonb(coalesce((v_motivos->>v_m)::int, 0) + 1));
    end;
  end loop;
  return jsonb_build_object('firmados', v_ok, 'no_firmados', v_fallos, 'motivos', v_motivos, 'firmado_por', v_email,
                            'ultimo_id', case when v_n < p_limite then null else v_ultimo end);
end $function$;
revoke all on function public.firmar_precios_sin_documento_lote(bigint, integer) from public, anon;
grant execute on function public.firmar_precios_sin_documento_lote(bigint, integer) to authenticated, service_role;
