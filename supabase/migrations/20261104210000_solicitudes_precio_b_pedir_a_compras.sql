-- LEVER B · Cola de "pedir precio a Compras" para materiales con precio viejo o sin precio.
-- Aditiva: tabla nueva + RLS dirección/diseño + trigger que sella quién pidió y el estado. No toca precios ni motor.
-- Aplicada en producción el 2026-11-04 (mcp apply_migration: solicitudes_precio_b_pedir_a_compras).
create table if not exists public.solicitudes_precio (
  id bigint generated always as identity primary key,
  insumo_id text references public.insumos_catalogo(id),
  material_texto text,
  mueble text,
  motivo text,
  estado text not null default 'abierta' check (estado in ('abierta','resuelta','descartada')),
  nota text,
  solicitado_por text,
  solicitado_en timestamptz not null default now(),
  resuelto_por text,
  resuelto_en timestamptz
);
alter table public.solicitudes_precio enable row level security;

create or replace function public.stamp_solicitud_precio() returns trigger
  language plpgsql security definer set search_path to 'public','pg_temp' as $fn$
begin
  if TG_OP = 'INSERT' then
    NEW.solicitado_por := coalesce(auth.jwt() ->> 'email', NEW.solicitado_por);
    NEW.solicitado_en := now();
    NEW.estado := 'abierta';
    NEW.resuelto_por := null; NEW.resuelto_en := null;
  elsif TG_OP = 'UPDATE' then
    if NEW.estado in ('resuelta','descartada') and OLD.estado = 'abierta' then
      NEW.resuelto_por := coalesce(auth.jwt() ->> 'email', NEW.resuelto_por);
      NEW.resuelto_en := now();
    end if;
  end if;
  return NEW;
end $fn$;
drop trigger if exists t_stamp_solicitud_precio on public.solicitudes_precio;
create trigger t_stamp_solicitud_precio before insert or update on public.solicitudes_precio
  for each row execute function public.stamp_solicitud_precio();

drop policy if exists p_solprecio_lee on public.solicitudes_precio;
create policy p_solprecio_lee on public.solicitudes_precio for select to authenticated
  using (private_api.puede_editar_config());
drop policy if exists p_solprecio_inserta on public.solicitudes_precio;
create policy p_solprecio_inserta on public.solicitudes_precio for insert to authenticated
  with check (private_api.puede_editar_config());
drop policy if exists p_solprecio_actualiza on public.solicitudes_precio;
create policy p_solprecio_actualiza on public.solicitudes_precio for update to authenticated
  using (private_api.puede_editar_config()) with check (private_api.puede_editar_config());

grant select, insert, update on public.solicitudes_precio to authenticated;
