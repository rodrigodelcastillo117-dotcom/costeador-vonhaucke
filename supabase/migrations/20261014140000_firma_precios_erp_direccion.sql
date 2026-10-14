-- ============================================================================
--  FIRMA DE PRECIOS ERP POR DIRECCIÓN (14-oct-2026) · AUTORIZADA por Rodrigo del Castillo (Dirección) en la sesión de
--  trabajo: "SI AUTORIZO" (el botón de firma de los precios reales de Intelisis).
--
--  Qué hace:
--   1. `cuentas_no_humanas` (misma definición que SEG-01c, `if not exists`): la cuenta QA y el proceso de reconciliación
--      no cuentan como firma humana. Sin esta tabla la Edge RC no reconoce NINGUNA firma como humana (fail-closed).
--   2. `aprobaciones_precio_historial` (append-only): quién aprobaba antes y quién firma ahora. Así la firma de Dirección
--      NO borra el rastro de la aprobación anterior de la cuenta QA (reauditoría P2-01).
--   3. `firmar_precios_erp_vigentes(p_meses)`: la ejecuta una persona de Dirección (no QA) con SU sesión y aprueba, con
--      la RPC existente `aprobar_precio` (mismo contrato DATA_TRUTH_V1 y mismos triggers), cada precio vigente de
--      Intelisis con documento y fecha de compra dentro de los últimos `p_meses` (24 por omisión, D1) que no tenga ya
--      una aprobación humana. Un precio que no cumple el contrato se salta y se reporta; no se fuerza.
--  Lo que NO hace: no cambia importes, unidades ni fechas (inmutables por trigger); no toca precios de más de 24 meses.
--
--  APLICADA en producción el 14-oct-2026 en 5 migraciones (`firma_precios_erp_direccion_1_cuentas` … `_5_funcion`):
--  el MCP de Supabase se cuelga (60 s) ante cualquier `drop` porque pide una confirmación que no llega. Por eso aquí no
--  hay `drop trigger if exists` (la tabla es nueva) y el cuerpo del trigger va entre comillas simples, igual que en prod.
-- ============================================================================
begin;

create table if not exists public.cuentas_no_humanas (
  email text primary key,
  motivo text not null,
  registrado_en timestamptz not null default now()
);
alter table public.cuentas_no_humanas enable row level security;
revoke all on table public.cuentas_no_humanas from public, anon, authenticated;
grant select on table public.cuentas_no_humanas to service_role;
insert into public.cuentas_no_humanas(email, motivo) values
  ('qa-direccion@vonhaucke.mx', 'cuenta de pruebas QA (rol direccion en permitidos)'),
  ('reconciliacion', 'proceso automático de reconciliación')
on conflict (email) do nothing;

create table if not exists public.aprobaciones_precio_historial (
  id bigint generated always as identity primary key,
  precio_id bigint not null,
  aprobado_por text not null,
  aprobado_en timestamptz not null default now(),
  aprobado_por_anterior text,
  aprobado_en_anterior timestamptz,
  politica text not null,
  nota text
);
alter table public.aprobaciones_precio_historial enable row level security;
revoke all on table public.aprobaciones_precio_historial from public, anon, authenticated;
grant select on table public.aprobaciones_precio_historial to service_role;
create or replace function public.aprobaciones_precio_historial_inmutable() returns trigger
language plpgsql set search_path to '' as 'begin raise exception ''aprobaciones_precio_historial es append-only''; end';
create trigger trg_aprobaciones_precio_historial_inmutable before update or delete on public.aprobaciones_precio_historial
  for each row execute function public.aprobaciones_precio_historial_inmutable();

create or replace function public.firmar_precios_erp_vigentes(p_meses integer default 24)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  r record; v_ok int := 0; v_fallos int := 0; v_motivos jsonb := '{}'::jsonb; v_m text;
begin
  if v_email = '' or coalesce((select lower(rol) from public.permitidos where lower(email) = v_email limit 1), '') <> 'direccion'
     or exists (select 1 from public.cuentas_no_humanas where lower(email) = v_email) then
    raise exception 'no autorizado: sólo una persona de Dirección (no una cuenta de prueba) firma los precios';
  end if;
  if p_meses is null or p_meses < 1 or p_meses > 120 then raise exception 'p_meses fuera de rango (1..120)'; end if;
  for r in
    select ip.id, ip.approved_by, ip.approved_at from public.insumo_precios ip
     where ip.vigente_hasta is null
       and nullif(btrim(ip.source_document), '') is not null
       and ip.vigente_desde >= (current_date - make_interval(months => p_meses))
       and (ip.estado is distinct from 'aprobado' or ip.approved_by is null
            or lower(ip.approved_by) in (select lower(email) from public.cuentas_no_humanas))
     order by ip.id
  loop
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
  return jsonb_build_object('firmados', v_ok, 'no_firmados', v_fallos, 'motivos', v_motivos, 'meses', p_meses, 'firmado_por', v_email);
end $$;
revoke all on function public.firmar_precios_erp_vigentes(integer) from public, anon;
grant execute on function public.firmar_precios_erp_vigentes(integer) to authenticated;

commit;
-- ROLLBACK (no deshace firmas ya hechas: el historial conserva quién aprobaba antes):
-- drop function if exists public.firmar_precios_erp_vigentes(integer);
