-- ============================================================================
--  D3 · DIRECCIÓN QUITA LA MARCA DE COMPRAS Y FIRMA (2026-10-18, decisión de Rodrigo: "quito la marca yo").
--  Los 65 precios vigentes que quedaban sin firma tenían `requiere_validacion_compras = true` (y la mayoría
--  evidencia `sin_evidencia` / confianza `baja`): la regla de aprobación no deja aprobarlos así. Son los genéricos
--  que más usa el costeo de especiales (MDF, melamina, lámina, PTR, pintura, herrajes…).
--  Esta función, sólo para una persona de Dirección (no cuentas de prueba), por cada uno y en una sola subtransacción:
--   1) deja en el historial (append-only) política D3 con lo que tenía antes: marca, evidencia, confianza;
--   2) quita la marca; la evidencia `sin_evidencia` pasa a `referenciada` y la confianza `baja` a `media`, y anota en
--      `evidencia` que lo declara Dirección (correo y fecha). No inventa documento ni toca precio, fecha ni origen
--      (el trigger append-only los protege);
--   3) aprueba con la RPC normal (aprobar_precio). Si algo falla, el renglón queda como estaba.
--  ROLLBACK: drop function public.firmar_precios_marcados_compras_lote(bigint, integer);
--  (los precios firmados conservan su historial; revertir una firma es sustituir el precio, como con D1/D2).
-- ============================================================================
create or replace function public.firmar_precios_marcados_compras_lote(p_despues_de bigint, p_limite integer)
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
    select ip.id, ip.approved_by, ip.approved_at, ip.evidence_status, ip.confidence, ip.requiere_validacion_compras
      from public.insumo_precios ip
     where ip.id > coalesce(p_despues_de, 0)
       and ip.vigente_hasta is null
       and ip.requiere_validacion_compras
       and (ip.estado is distinct from 'aprobado' or ip.approved_by is null
            or lower(ip.approved_by) in (select lower(email) from public.cuentas_no_humanas))
     order by ip.id
     limit p_limite
  loop
    v_n := v_n + 1; v_ultimo := r.id;
    begin
      insert into public.aprobaciones_precio_historial(precio_id, aprobado_por, aprobado_por_anterior, aprobado_en_anterior, politica, nota)
      values (r.id, v_email, r.approved_by, r.approved_at, 'D3 · Dirección quita la marca de Compras y declara la evidencia',
              format('Antes: requiere_validacion_compras=%s, evidencia=%s, confianza=%s. Firma en lote de Dirección (18-oct-2026).',
                     r.requiere_validacion_compras::text, coalesce(r.evidence_status, '∅'), coalesce(r.confidence, '∅')));
      update public.insumo_precios
         set requiere_validacion_compras = false,
             evidence_status = case when coalesce(evidence_status, 'sin_evidencia') = 'sin_evidencia' then 'referenciada' else evidence_status end,
             confidence = case when coalesce(confidence, 'baja') = 'baja' then 'media' else confidence end,
             evidencia = concat_ws(' · ', nullif(btrim(evidencia), ''), format('Declarado por Dirección (%s, %s): precio real; quita la marca de Compras', v_email, current_date))
       where id = r.id;
      perform public.aprobar_precio(r.id, 'Firma Dirección · política D3 (quita marca de Compras)');
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
revoke all on function public.firmar_precios_marcados_compras_lote(bigint, integer) from public, anon;
grant execute on function public.firmar_precios_marcados_compras_lote(bigint, integer) to authenticated, service_role;
