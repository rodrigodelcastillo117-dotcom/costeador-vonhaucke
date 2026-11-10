-- ============================================================================
--  P0 SEGURIDAD · expediente_costeo — PROPUESTO, NO APLICADO a prod.
--  Aplicar SOLO con autorizacion explicita de Direccion. Aplicar en TRANSACCION
--  (begin; \i ...; commit;) — es atomico (todo-o-nada).
--
--  CIERRA el defecto de autorizacion de 20261111: guardar_expediente_costeo
--  localizaba la fila SOLO por `clave` (sin dueño) y reasignaba `actualizado_por`,
--  permitiendo overwrite + control transfer entre usuarios.
--
--  IDENTIDAD DE DUEÑO = auth.uid() (UUID INMUTABLE), no el email. El email es
--  mutable y reasignable: si un correo se cambia o se reasigna a otra persona,
--  identificar al dueño por email reabre el agujero (reuso de correo) o deja
--  expedientes huerfanos. auth.uid() nunca cambia ni se reasigna.
--
--  Contrato nuevo (fail-closed, server-side):
--   1. Nueva columna `propietario uuid` = auth.uid(). PK compuesta
--      (propietario, clave) -> la clave comercial no identifica sola; sin colision
--      entre usuarios. `creado_por`/`actualizado_por` (email) quedan como AUDITORIA.
--   2. DUEÑO INMUTABLE: `propietario` se fija en el INSERT y NUNCA se actualiza.
--      Toda autorizacion (SELECT/UPDATE/reabrir/RLS) es por `propietario`.
--   3. AISLAMIENTO TOTAL: las RPC operan solo sobre la fila del auth.uid() actual.
--   4. Concurrencia optimista preservada (advisory lock por propietario+clave +
--      FOR UPDATE + UPDATE condicional por version).
--   5. HISTORIAL append-only (expediente_costeo_historial) por propietario.
--   6. RLS por `propietario` (auth.uid()).
--   7. Compatible con filas existentes: backfill de `propietario` desde
--      auth.users por el email guardado (creado_por). Fail-closed si no mapea.
--
--  Aditiva: no toca precios, BOM, Producto Maestro ni permisos de otras tablas.
--  Reversible: ver ROLLBACK_...sql (preferir correccion hacia adelante).
-- ============================================================================

-- --- 0. Nueva identidad de dueño: propietario = auth.uid() ------------------
alter table public.expediente_costeo add column if not exists propietario uuid;

-- Backfill desde auth.users por el email guardado (creado_por, o actualizado_por).
update public.expediente_costeo e
   set propietario = u.id
  from auth.users u
 where e.propietario is null
   and lower(u.email) = lower(coalesce(e.creado_por, e.actualizado_por, ''));

-- Fail-closed: si alguna fila no mapea a un auth.users.id, abortar (no inventar dueño).
do $$
begin
  if exists (select 1 from public.expediente_costeo where propietario is null) then
    raise exception 'MIGRACION_ABORTADA: hay expedientes cuyo email dueño no mapea a auth.users.id; no se puede fijar propietario inmutable sin inventar datos';
  end if;
end $$;

alter table public.expediente_costeo alter column propietario set not null;

-- --- 1. Identidad por dueño: PK (propietario, clave) ------------------------
alter table public.expediente_costeo drop constraint if exists expediente_costeo_pkey;
alter table public.expediente_costeo
  add constraint expediente_costeo_pkey primary key (propietario, clave);

-- --- 2. Historial append-only (por propietario) ----------------------------
create table if not exists public.expediente_costeo_historial (
  id          bigint generated always as identity primary key,
  propietario uuid    not null,
  clave       text    not null,
  version     integer not null,
  expediente  jsonb   not null,
  guardado_por text,                 -- email (auditoria), puede ser null
  guardado_en timestamptz not null default now()
);
create index if not exists expediente_costeo_hist_idx
  on public.expediente_costeo_historial (propietario, clave, version);

alter table public.expediente_costeo_historial enable row level security;
drop policy if exists expediente_costeo_hist_sel on public.expediente_costeo_historial;
create policy expediente_costeo_hist_sel on public.expediente_costeo_historial for select
  using (auth.uid() = propietario);

revoke all on public.expediente_costeo_historial from public, anon;
grant select on public.expediente_costeo_historial to authenticated;

-- --- 3. RLS de la tabla principal: por propietario (auth.uid()) -------------
drop policy if exists expediente_costeo_sel on public.expediente_costeo;
drop policy if exists expediente_costeo_all on public.expediente_costeo;
drop policy if exists expediente_costeo_owner on public.expediente_costeo;
create policy expediente_costeo_owner on public.expediente_costeo for all
  using (auth.uid() = propietario)
  with check (auth.uid() = propietario);

-- --- 4. GUARDAR: aislado por auth.uid(), dueño inmutable, con historial -----
create or replace function public.guardar_expediente_costeo(
  p_clave text, p_expediente jsonb, p_version_anterior integer default null
) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));   -- solo auditoria
  v_clave text := btrim(coalesce(p_clave,''));
  v_ver integer; v_nueva integer;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  if v_clave = '' then raise exception 'falta la clave'; end if;
  if p_expediente is null or jsonb_typeof(p_expediente) <> 'object' then raise exception 'expediente invalido'; end if;

  perform pg_advisory_xact_lock(hashtext('expediente_costeo:' || v_uid::text || ':' || v_clave));

  select version into v_ver from public.expediente_costeo
    where propietario = v_uid and clave = v_clave for update;

  if found then
    if p_version_anterior is distinct from v_ver then
      raise exception 'VERSION_CONFLICT: "%" cambio. Reabre y reintenta.', v_clave;
    end if;
    v_nueva := v_ver + 1;
    update public.expediente_costeo
      set expediente = p_expediente, version = v_nueva, actualizado_por = v_email, actualizado_en = now()
      where propietario = v_uid and clave = v_clave and version = v_ver;   -- propietario NO cambia
    if not found then raise exception 'VERSION_CONFLICT: "%" cambio durante el guardado.', v_clave; end if;
  else
    v_nueva := 1;
    insert into public.expediente_costeo (clave, version, expediente, propietario, creado_por, actualizado_por)
      values (v_clave, 1, p_expediente, v_uid, v_email, v_email);
  end if;

  insert into public.expediente_costeo_historial (propietario, clave, version, expediente, guardado_por)
    values (v_uid, v_clave, v_nueva, p_expediente, v_email);

  return jsonb_build_object('ok', true, 'clave', v_clave, 'version', v_nueva, 'guardado_por', v_email);
end $$;

-- --- 5. REABRIR: solo la fila del auth.uid() actual ------------------------
create or replace function public.reabrir_expediente_costeo(p_clave text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_uid uuid := auth.uid(); v_row public.expediente_costeo;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select * into v_row from public.expediente_costeo
   where propietario = v_uid and clave = btrim(coalesce(p_clave,''));
  if not found then return null; end if;
  return jsonb_build_object('clave', v_row.clave, 'version', v_row.version,
    'expediente', v_row.expediente, 'actualizado_en', v_row.actualizado_en);
end $$;

-- --- 6. Permisos de ejecucion (sin cambios de contrato) ---------------------
revoke all on function public.guardar_expediente_costeo(text,jsonb,integer) from public, anon;
grant execute on function public.guardar_expediente_costeo(text,jsonb,integer) to authenticated;
revoke all on function public.reabrir_expediente_costeo(text) from public, anon;
grant execute on function public.reabrir_expediente_costeo(text) to authenticated;
