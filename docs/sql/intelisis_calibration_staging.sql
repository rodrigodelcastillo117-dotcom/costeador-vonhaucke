-- STAGED ONLY — schema propuesta para integración read-only Intelisis + goldens.
-- NO desplegar hasta confirmar nombres/campos reales del acceso que entregue Sistemas.
-- Diseño: ingestión append-only, trazabilidad completa y promoción separada al catálogo canónico.

create table if not exists public.erp_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null check (source_system in ('INTELISIS','ALBA','RAFA','ORDEN_CERRADA')),
  source_ref text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING','SUCCEEDED','FAILED','PARTIAL')),
  row_counts jsonb not null default '{}'::jsonb,
  source_hash text,
  error_summary text,
  created_by uuid default auth.uid()
);

create table if not exists public.erp_material_snapshots (
  id bigint generated always as identity primary key,
  sync_run_id uuid not null references public.erp_sync_runs(id) on delete restrict,
  clave_erp text not null,
  descripcion text,
  proveedor text,
  unidad_compra text,
  unidad_consumo text,
  conversion jsonb,
  precio numeric(18,6),
  moneda text,
  vigencia date,
  evidencia text,
  source_row jsonb not null default '{}'::jsonb,
  evidence_status text not null check (evidence_status in ('verificada','incompleta','rechazada')),
  issues text[] not null default '{}',
  row_hash text not null,
  created_at timestamptz not null default now(),
  unique(sync_run_id,row_hash)
);
create index if not exists erp_material_snapshots_clave_vigencia_idx
  on public.erp_material_snapshots(clave_erp,vigencia desc);

create table if not exists public.erp_bom_snapshots (
  id bigint generated always as identity primary key,
  sync_run_id uuid not null references public.erp_sync_runs(id) on delete restrict,
  producto text not null,
  variante text,
  version_receta text,
  componente text not null,
  clave_material text not null,
  cantidad numeric(18,6),
  unidad_consumo text,
  merma_pct numeric(9,4),
  evidencia text,
  source_row jsonb not null default '{}'::jsonb,
  evidence_status text not null check (evidence_status in ('verificada','incompleta','rechazada')),
  issues text[] not null default '{}',
  row_hash text not null,
  created_at timestamptz not null default now(),
  unique(sync_run_id,row_hash)
);
create index if not exists erp_bom_snapshots_producto_idx
  on public.erp_bom_snapshots(producto,version_receta);

create table if not exists public.erp_operation_snapshots (
  id bigint generated always as identity primary key,
  sync_run_id uuid not null references public.erp_sync_runs(id) on delete restrict,
  producto text not null,
  version_receta text,
  operacion text not null,
  centro_trabajo text not null,
  horas numeric(18,6),
  tarifa_mo_hora numeric(18,6),
  tarifa_gif_hora numeric(18,6),
  preparacion_horas numeric(18,6) not null default 0,
  evidencia text,
  source_row jsonb not null default '{}'::jsonb,
  evidence_status text not null check (evidence_status in ('verificada','incompleta','rechazada')),
  issues text[] not null default '{}',
  row_hash text not null,
  created_at timestamptz not null default now(),
  unique(sync_run_id,row_hash)
);
create index if not exists erp_operation_snapshots_producto_idx
  on public.erp_operation_snapshots(producto,version_receta,centro_trabajo);

create table if not exists public.cost_golden_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,
  source_type text not null check (source_type in ('ALBA','RAFA','INTELISIS','ORDEN_CERRADA')),
  source_ref text not null,
  source_date date not null,
  producto text not null,
  product_revision_id bigint,
  input_snapshot jsonb not null,
  expected_snapshot jsonb not null,
  evidence_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cost_golden_results (
  id bigint generated always as identity primary key,
  golden_case_id uuid not null references public.cost_golden_cases(id) on delete cascade,
  motor_version text not null,
  catalog_version text,
  actual_snapshot jsonb not null,
  delta_snapshot jsonb not null,
  certificable boolean not null,
  max_abs_delta_centavos integer,
  tested_at timestamptz not null default now(),
  commit_sha text
);
create index if not exists cost_golden_results_case_tested_idx
  on public.cost_golden_results(golden_case_id,tested_at desc);

alter table public.erp_sync_runs enable row level security;
alter table public.erp_material_snapshots enable row level security;
alter table public.erp_bom_snapshots enable row level security;
alter table public.erp_operation_snapshots enable row level security;
alter table public.cost_golden_cases enable row level security;
alter table public.cost_golden_results enable row level security;

revoke all on public.erp_sync_runs, public.erp_material_snapshots, public.erp_bom_snapshots,
  public.erp_operation_snapshots, public.cost_golden_cases, public.cost_golden_results
  from anon, authenticated;

grant select on public.erp_sync_runs, public.erp_material_snapshots, public.erp_bom_snapshots,
  public.erp_operation_snapshots, public.cost_golden_cases, public.cost_golden_results
  to authenticated;

create policy erp_sync_runs_economia_select on public.erp_sync_runs
  for select to authenticated using (public.puede_ver_economia());
create policy erp_material_snapshots_economia_select on public.erp_material_snapshots
  for select to authenticated using (public.puede_ver_economia());
create policy erp_bom_snapshots_economia_select on public.erp_bom_snapshots
  for select to authenticated using (public.puede_ver_economia());
create policy erp_operation_snapshots_economia_select on public.erp_operation_snapshots
  for select to authenticated using (public.puede_ver_economia());
create policy cost_golden_cases_economia_select on public.cost_golden_cases
  for select to authenticated using (public.puede_ver_economia());
create policy cost_golden_results_economia_select on public.cost_golden_results
  for select to authenticated using (public.puede_ver_economia());

-- Escritura prevista: únicamente backend/service_role de la integración.
-- Ninguna fila de staging reemplaza automáticamente un precio/BOM canónico.
-- La promoción requiere validación explícita y debe registrar la fuente/hash.
