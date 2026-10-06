-- STAGED ONLY — integridad de telemetría shadow_costeo.
-- Hoy cualquier authenticated puede INSERT con WITH CHECK true. No filtra datos,
-- pero permite suplantar email/rol y contaminar la evidencia de paridad.
--
-- El cliente sigue enviando sólo métricas; DB firma identidad/rol con la sesión.

create or replace function private_api.firmar_shadow_costeo()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_rol text;
begin
  if v_email = '' then raise exception 'no autenticado'; end if;
  select lower(p.rol) into v_rol
  from public.permitidos p
  where lower(p.email)=v_email
  limit 1;
  if v_rol is null then raise exception 'usuario no autorizado'; end if;

  new.email := v_email;
  new.rol := v_rol;
  return new;
end $$;

drop trigger if exists trg_firmar_shadow_costeo on public.shadow_costeo;
create trigger trg_firmar_shadow_costeo
before insert on public.shadow_costeo
for each row execute function private_api.firmar_shadow_costeo();

drop policy if exists shadow_insert on public.shadow_costeo;
create policy shadow_insert on public.shadow_costeo
for insert to authenticated
with check (
  lower(coalesce(email,'')) = lower(coalesce(auth.jwt()->>'email',''))
  and lower(coalesce(rol,'')) = lower(coalesce((
    select p.rol from public.permitidos p
    where lower(p.email)=lower(coalesce(auth.jwt()->>'email',''))
    limit 1
  ),''))
);

-- SELECT sigue sólo Dirección. La fila cliente sigue siendo TELEMETRÍA, no
-- evidencia económica autoritativa: precio_cliente/costo_cliente son observados.
