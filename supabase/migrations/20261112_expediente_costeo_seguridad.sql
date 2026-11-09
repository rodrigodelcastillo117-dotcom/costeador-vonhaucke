-- ============================================================================
--  P0 SEGURIDAD · expediente_costeo — PROPUESTO, NO APLICADO a prod.
--  Aplicar SOLO con autorizacion explicita de Direccion.
--
--  CIERRA el defecto de autorizacion de 20261111_expediente_costeo.sql:
--  guardar_expediente_costeo localizaba la fila SOLO por `clave` (sin dueño) y
--  reasignaba `actualizado_por`, permitiendo que un usuario B sobrescribiera y
--  RECLAMARA el expediente de A (control transfer). Ademas el mensaje
--  VERSION_CONFLICT filtraba la version de la fila ajena.
--
--  Contrato nuevo (fail-closed, server-side):
--   1. IDENTIDAD por DUEÑO: PK compuesta (creado_por, clave). La clave comercial
--      del producto YA NO identifica una fila por si sola -> sin colision entre
--      usuarios. Cada quien tiene su propio expediente para el mismo producto.
--   2. DUEÑO INMUTABLE: creado_por se fija en el INSERT y NUNCA se actualiza.
--      La autorizacion (SELECT/UPDATE/reabrir) se hace SIEMPRE por creado_por.
--   3. AISLAMIENTO TOTAL: las RPC operan unicamente sobre la fila del usuario
--      autenticado (where creado_por = v_email). Un usuario no puede leer,
--      sobrescribir ni reclamar la fila de otro — es imposible por construccion.
--   4. Concurrencia optimista preservada (advisory lock por dueño+clave +
--      FOR UPDATE + UPDATE condicional por version).
--   5. HISTORIAL append-only (expediente_costeo_historial): cada guardado deja
--      una copia inmutable, consultable solo por su dueño.
--   6. RLS por creado_por inmutable (no por actualizado_por mutable).
--   7. Compatible con la unica fila QA existente (se conserva su dueño).
--
--  Aditiva: no toca precios, BOM, Producto Maestro ni permisos de otras tablas.
--  Reversible: ver ROLLBACK_20261112_expediente_costeo_seguridad.sql.
-- ============================================================================

-- --- 0. Saneado de datos previos (compatibilidad con la fila QA) ------------
-- Si alguna fila quedo sin creado_por, se adopta el ultimo editor como dueño.
update public.expediente_costeo
   set creado_por = coalesce(creado_por, actualizado_por)
 where creado_por is null;
-- Si aun asi quedara null (fila corrupta sin dueño), se rechaza la migracion
-- en vez de inventar un dueño: fail-closed.
do $$
begin
  if exists (select 1 from public.expediente_costeo where creado_por is null) then
    raise exception 'MIGRACION_ABORTADA: hay expedientes sin creado_por; no se puede fijar dueño inmutable sin inventar datos';
  end if;
end $$;

alter table public.expediente_costeo alter column creado_por set not null;

-- --- 1. Identidad por dueño: PK (creado_por, clave) --------------------------
-- La clave comercial deja de ser identidad global. Dos usuarios pueden tener
-- su propia fila para el mismo producto sin colisionar.
alter table public.expediente_costeo drop constraint if exists expediente_costeo_pkey;
alter table public.expediente_costeo
  add constraint expediente_costeo_pkey primary key (creado_por, clave);

-- --- 2. Historial append-only ----------------------------------------------
create table if not exists public.expediente_costeo_historial (
  id          bigint generated always as identity primary key,
  creado_por  text    not null,
  clave       text    not null,
  version     integer not null,
  expediente  jsonb   not null,
  guardado_por text   not null,
  guardado_en timestamptz not null default now()
);
create index if not exists expediente_costeo_hist_idx
  on public.expediente_costeo_historial (creado_por, clave, version);

alter table public.expediente_costeo_historial enable row level security;
-- Solo el dueño lee su historial. Nadie inserta/actualiza/borra directo
-- (lo escribe la RPC SECURITY DEFINER); sin politica de write -> denegado.
drop policy if exists expediente_costeo_hist_sel on public.expediente_costeo_historial;
create policy expediente_costeo_hist_sel on public.expediente_costeo_historial for select
  using (lower(coalesce(auth.jwt()->>'email','')) = lower(creado_por));

revoke all on public.expediente_costeo_historial from public, anon;
grant select on public.expediente_costeo_historial to authenticated;

-- --- 3. RLS de la tabla principal: por creado_por INMUTABLE ------------------
drop policy if exists expediente_costeo_sel on public.expediente_costeo;
drop policy if exists expediente_costeo_all on public.expediente_costeo;
drop policy if exists expediente_costeo_owner on public.expediente_costeo;
create policy expediente_costeo_owner on public.expediente_costeo for all
  using (lower(coalesce(auth.jwt()->>'email','')) = lower(creado_por))
  with check (lower(coalesce(auth.jwt()->>'email','')) = lower(creado_por));

-- --- 4. GUARDAR: aislado por dueño, dueño inmutable, con historial ----------
create or replace function public.guardar_expediente_costeo(
  p_clave text, p_expediente jsonb, p_version_anterior integer default null
) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_clave text := btrim(coalesce(p_clave,''));
  v_ver integer; v_nueva integer;
begin
  if v_email = '' then raise exception 'no autenticado'; end if;
  if v_clave = '' then raise exception 'falta la clave'; end if;
  if p_expediente is null or jsonb_typeof(p_expediente) <> 'object' then raise exception 'expediente invalido'; end if;

  -- Lock por DUEÑO+clave: dos usuarios sobre el mismo producto no se bloquean.
  perform pg_advisory_xact_lock(hashtext('expediente_costeo:' || v_email || ':' || v_clave));

  -- Solo la fila del propio usuario. Jamas se toca la de otro.
  select version into v_ver from public.expediente_costeo
    where creado_por = v_email and clave = v_clave for update;

  if found then
    if p_version_anterior is distinct from v_ver then
      -- No se filtra la version real (defensa aun siendo la fila propia).
      raise exception 'VERSION_CONFLICT: "%" cambio. Reabre y reintenta.', v_clave;
    end if;
    v_nueva := v_ver + 1;
    update public.expediente_costeo
      set expediente = p_expediente, version = v_nueva, actualizado_por = v_email, actualizado_en = now()
      where creado_por = v_email and clave = v_clave and version = v_ver;  -- dueño inmutable: creado_por NO cambia
    if not found then raise exception 'VERSION_CONFLICT: "%" cambio durante el guardado.', v_clave; end if;
  else
    v_nueva := 1;
    insert into public.expediente_costeo (clave, version, expediente, creado_por, actualizado_por)
      values (v_clave, 1, p_expediente, v_email, v_email);
  end if;

  -- Historial append-only (copia inmutable del estado guardado).
  insert into public.expediente_costeo_historial (creado_por, clave, version, expediente, guardado_por)
    values (v_email, v_clave, v_nueva, p_expediente, v_email);

  return jsonb_build_object('ok', true, 'clave', v_clave, 'version', v_nueva, 'guardado_por', v_email);
end $$;

-- --- 5. REABRIR: solo la fila del propio usuario ----------------------------
create or replace function public.reabrir_expediente_costeo(p_clave text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_email text := lower(coalesce(auth.jwt()->>'email','')); v_row public.expediente_costeo;
begin
  if v_email = '' then raise exception 'no autenticado'; end if;
  select * into v_row from public.expediente_costeo
   where creado_por = v_email and clave = btrim(coalesce(p_clave,''));
  if not found then return null; end if;
  return jsonb_build_object('clave', v_row.clave, 'version', v_row.version,
    'expediente', v_row.expediente, 'actualizado_en', v_row.actualizado_en);
end $$;

-- --- 6. Permisos de ejecucion (sin cambios de contrato) ---------------------
revoke all on function public.guardar_expediente_costeo(text,jsonb,integer) from public, anon;
grant execute on function public.guardar_expediente_costeo(text,jsonb,integer) to authenticated;
revoke all on function public.reabrir_expediente_costeo(text) from public, anon;
grant execute on function public.reabrir_expediente_costeo(text) to authenticated;
