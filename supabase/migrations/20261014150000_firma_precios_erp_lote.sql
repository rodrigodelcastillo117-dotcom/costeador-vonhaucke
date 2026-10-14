-- ============================================================================
--  FIRMA DE PRECIOS ERP POR LOTES (14-oct-2026) · complemento de 20261014140000 (misma autorización de Rodrigo).
--
--  Por qué: el rol `authenticated` tiene statement_timeout = 8 s en producción. Firmar ~1,783 precios en UNA llamada
--  (cada uno pasa por aprobar_precio + 4 triggers) puede pasarse; si se pasa, se revierte todo y no se firma nada.
--  Esta versión firma a lo más `p_limite` precios con id > `p_despues_de` y devuelve `ultimo_id` (cursor). El cliente
--  repite hasta que `ultimo_id` es null. Un precio que no se puede aprobar se reporta y el cursor lo deja atrás: no
--  bloquea el avance. Mismas reglas que firmar_precios_erp_vigentes (sólo Dirección humana; QA rechazada).
--  Sin parámetros por omisión a propósito: así no hay ambigüedad con la versión de un argumento.
--  Sin `drop` (el MCP de Supabase se cuelga ante sentencias destructivas).
-- ============================================================================
begin;

create or replace function public.firmar_precios_erp_lote(p_meses integer, p_despues_de bigint, p_limite integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  r record; v_ok int := 0; v_fallos int := 0; v_motivos jsonb := '{}'::jsonb; v_m text; v_ultimo bigint := null; v_n int := 0;
begin
  if v_email = '' or coalesce((select lower(rol) from public.permitidos where lower(email) = v_email limit 1), '') <> 'direccion'
     or exists (select 1 from public.cuentas_no_humanas where lower(email) = v_email) then
    raise exception 'no autorizado: sólo una persona de Dirección (no una cuenta de prueba) firma los precios';
  end if;
  if p_meses is null or p_meses < 1 or p_meses > 120 then raise exception 'p_meses fuera de rango (1..120)'; end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then raise exception 'p_limite fuera de rango (1..500)'; end if;
  for r in
    select ip.id, ip.approved_by, ip.approved_at from public.insumo_precios ip
     where ip.id > coalesce(p_despues_de, 0)
       and ip.vigente_hasta is null
       and nullif(btrim(ip.source_document), '') is not null
       and ip.vigente_desde >= (current_date - make_interval(months => p_meses))
       and (ip.estado is distinct from 'aprobado' or ip.approved_by is null
            or lower(ip.approved_by) in (select lower(email) from public.cuentas_no_humanas))
     order by ip.id
     limit p_limite
  loop
    v_n := v_n + 1; v_ultimo := r.id;
    begin
      insert into public.aprobaciones_precio_historial(precio_id, aprobado_por, aprobado_por_anterior, aprobado_en_anterior, politica, nota)
      values (r.id, v_email, r.approved_by, r.approved_at, format('D1 · última compra Intelisis con documento ≤ %s meses', p_meses),
              'Firma en lote de Dirección (14-oct-2026)');
      perform public.aprobar_precio(r.id, format('Firma Dirección · política D1 ≤ %s meses', p_meses));
      v_ok := v_ok + 1;
    exception when others then
      v_fallos := v_fallos + 1;
      v_m := left(sqlerrm, 120);
      v_motivos := jsonb_set(v_motivos, array[v_m], to_jsonb(coalesce((v_motivos->>v_m)::int, 0) + 1));
    end;
  end loop;
  return jsonb_build_object('firmados', v_ok, 'no_firmados', v_fallos, 'motivos', v_motivos, 'meses', p_meses, 'firmado_por', v_email,
                            'ultimo_id', case when v_n < p_limite then null else v_ultimo end);
end $$;
revoke all on function public.firmar_precios_erp_lote(integer, bigint, integer) from public, anon;
grant execute on function public.firmar_precios_erp_lote(integer, bigint, integer) to authenticated;

commit;
-- ROLLBACK (no deshace firmas ya hechas): drop function if exists public.firmar_precios_erp_lote(integer, bigint, integer);
