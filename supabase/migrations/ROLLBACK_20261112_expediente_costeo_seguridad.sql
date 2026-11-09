-- ============================================================================
--  ROLLBACK de 20261112_expediente_costeo_seguridad.sql
--  Devuelve el contrato de 20261111 (RPC/RLS/PK originales).
--
--  ADVERTENCIA: la PK vuelve a ser (clave). Esto SOLO es seguro si NO existen
--  dos filas con la misma `clave` de dueños distintos (que el nuevo esquema si
--  permite). Si las hay, el rollback FALLA a proposito (no se pierden datos):
--  primero hay que resolver el conflicto de claves manualmente.
--  El historial (expediente_costeo_historial) se conserva por si acaso; para
--  eliminarlo, descomentar la ultima linea.
-- ============================================================================

-- Verificacion: no debe haber claves duplicadas entre dueños antes de revertir.
do $$
begin
  if exists (
    select 1 from public.expediente_costeo group by clave having count(*) > 1
  ) then
    raise exception 'ROLLBACK_ABORTADO: hay claves compartidas por varios dueños; la PK (clave) las colisionaria. Resolver antes de revertir.';
  end if;
end $$;

-- 1. PK: de (creado_por, clave) de vuelta a (clave).
alter table public.expediente_costeo drop constraint if exists expediente_costeo_pkey;
alter table public.expediente_costeo
  add constraint expediente_costeo_pkey primary key (clave);

-- 2. RLS: volver al contrato original (por actualizado_por/creado_por).
drop policy if exists expediente_costeo_owner on public.expediente_costeo;
drop policy if exists expediente_costeo_sel on public.expediente_costeo;
create policy expediente_costeo_sel on public.expediente_costeo for select
  using (lower(coalesce(auth.jwt()->>'email','')) = lower(coalesce(actualizado_por, creado_por, '')));
drop policy if exists expediente_costeo_all on public.expediente_costeo;
create policy expediente_costeo_all on public.expediente_costeo for all
  using (lower(coalesce(auth.jwt()->>'email','')) = lower(coalesce(actualizado_por, creado_por, '')))
  with check (lower(coalesce(auth.jwt()->>'email','')) = lower(coalesce(actualizado_por, creado_por, '')));

-- 3. RPC: restaurar las versiones de 20261111 (sin filtro por dueño).
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

-- 4. (Opcional) eliminar el historial creado por la migracion de seguridad.
-- drop table if exists public.expediente_costeo_historial;
