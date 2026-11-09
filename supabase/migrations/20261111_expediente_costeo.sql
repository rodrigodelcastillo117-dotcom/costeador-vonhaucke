-- ============================================================================
--  EXPEDIENTE DE COSTEO (persistencia del flujo de Ingenieria) — PROPUESTO.
--  NO APLICADO a prod. Aplicar SOLO con autorizacion de Direccion.
--
--  Persiste el expediente (plano -> BOM -> confirmaciones -> recosteo) para GUARDAR
--  y REABRIR sin perder decisiones. Concurrencia optimista por version (como
--  guardar_producto_maestro). RLS: cada quien ve/edita su propio expediente; el
--  servicio (service_role) sin restriccion. No toca precios, BOM historicos ni
--  Productos Maestros. Es un borrador de trabajo, no un costo oficial.
-- ============================================================================
create table if not exists public.expediente_costeo (
  clave           text primary key,
  version         integer not null default 1,
  expediente      jsonb   not null,
  actualizado_por text,
  creado_por      text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

alter table public.expediente_costeo enable row level security;

-- Cada usuario ve/edita sus propios expedientes (por email del JWT).
drop policy if exists expediente_costeo_sel on public.expediente_costeo;
create policy expediente_costeo_sel on public.expediente_costeo for select
  using (lower(coalesce(auth.jwt()->>'email','')) = lower(coalesce(actualizado_por, creado_por, '')));
drop policy if exists expediente_costeo_all on public.expediente_costeo;
create policy expediente_costeo_all on public.expediente_costeo for all
  using (lower(coalesce(auth.jwt()->>'email','')) = lower(coalesce(actualizado_por, creado_por, '')))
  with check (lower(coalesce(auth.jwt()->>'email','')) = lower(coalesce(actualizado_por, creado_por, '')));

-- GUARDAR con concurrencia optimista (lost-update seguro, como el P0).
create or replace function public.guardar_expediente_costeo(
  p_clave text, p_expediente jsonb, p_version_anterior integer default null
) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_ver integer; v_nueva integer;
begin
  if v_email = '' then raise exception 'no autenticado'; end if;
  if p_clave is null or btrim(p_clave) = '' then raise exception 'falta la clave'; end if;
  if p_expediente is null or jsonb_typeof(p_expediente) <> 'object' then raise exception 'expediente invalido'; end if;

  perform pg_advisory_xact_lock(hashtext('expediente_costeo:' || btrim(p_clave)));
  select version into v_ver from public.expediente_costeo where clave = btrim(p_clave) for update;

  if found then
    if p_version_anterior is distinct from v_ver then
      raise exception 'VERSION_CONFLICT: "%" cambio (version %, esperabas %). Reabre y reintenta.', btrim(p_clave), v_ver, p_version_anterior;
    end if;
    v_nueva := v_ver + 1;
    update public.expediente_costeo
      set expediente = p_expediente, version = v_nueva, actualizado_por = v_email, actualizado_en = now()
      where clave = btrim(p_clave) and version = v_ver;
    if not found then raise exception 'VERSION_CONFLICT: "%" cambio durante el guardado.', btrim(p_clave); end if;
  else
    v_nueva := 1;
    insert into public.expediente_costeo (clave, version, expediente, creado_por, actualizado_por)
      values (btrim(p_clave), 1, p_expediente, v_email, v_email);
  end if;
  return jsonb_build_object('ok', true, 'clave', btrim(p_clave), 'version', v_nueva, 'guardado_por', v_email);
end $$;

create or replace function public.reabrir_expediente_costeo(p_clave text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_email text := lower(coalesce(auth.jwt()->>'email','')); v_row public.expediente_costeo;
begin
  if v_email = '' then raise exception 'no autenticado'; end if;
  select * into v_row from public.expediente_costeo
   where clave = btrim(p_clave) and lower(coalesce(actualizado_por, creado_por,'')) = v_email;
  if not found then return null; end if;
  return jsonb_build_object('clave', v_row.clave, 'version', v_row.version, 'expediente', v_row.expediente, 'actualizado_en', v_row.actualizado_en);
end $$;

revoke all on function public.guardar_expediente_costeo(text,jsonb,integer) from public, anon;
grant execute on function public.guardar_expediente_costeo(text,jsonb,integer) to authenticated;
revoke all on function public.reabrir_expediente_costeo(text) from public, anon;
grant execute on function public.reabrir_expediente_costeo(text) to authenticated;
