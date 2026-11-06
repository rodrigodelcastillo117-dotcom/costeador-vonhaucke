-- ============================================================================
-- APLICADA 2026-11-06 (mcp apply_migration) · Producto Maestro: BOM confirmado por
-- CLAVE para costeo determinista (±1%). Aditiva. RLS seller-safe:
--  · SELECT: sólo puede_ver_economia() (Dirección/Diseño). Vendedores NUNCA ven estos costos.
--  · INSERT/UPDATE/DELETE: sólo puede_editar_config().
-- Costear la clave = re-costear este BOM con precios vigentes + política VH (x1.8/x1.06).
-- ============================================================================
create table if not exists public.producto_maestro (
  clave           text primary key,
  nombre          text not null default '',
  dims_mm         integer[],
  fuente          text not null default '',
  cos_fab_real    numeric,
  lineas          jsonb not null default '[]'::jsonb,
  creado_por      text default '',
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
comment on table public.producto_maestro is 'BOM confirmado por clave (estimaciones). Costear la clave = re-costear este BOM con precios vigentes + política VH. ±1%.';

alter table public.producto_maestro enable row level security;

drop policy if exists pm_sel on public.producto_maestro;
create policy pm_sel on public.producto_maestro for select using (public.puede_ver_economia());
drop policy if exists pm_ins on public.producto_maestro;
create policy pm_ins on public.producto_maestro for insert with check (public.puede_editar_config());
drop policy if exists pm_upd on public.producto_maestro;
create policy pm_upd on public.producto_maestro for update using (public.puede_editar_config()) with check (public.puede_editar_config());
drop policy if exists pm_del on public.producto_maestro;
create policy pm_del on public.producto_maestro for delete using (public.puede_editar_config());

create or replace function public.producto_maestro_touch() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$ begin new.actualizado_en = now(); return new; end $$;
drop trigger if exists pm_touch on public.producto_maestro;
create trigger pm_touch before update on public.producto_maestro
  for each row execute function public.producto_maestro_touch();
