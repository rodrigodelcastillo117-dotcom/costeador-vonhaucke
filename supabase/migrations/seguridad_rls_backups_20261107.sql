-- SEG 2026-11-07: dos tablas backup quedaron con RLS deshabilitado → expuestas a anon/authenticated.
-- Nada en el código las lee. Fail-closed: con RLS activo y SIN políticas, sólo service_role accede.
alter table public._backup_activacion_erp_20261106 enable row level security;
alter table public._backup_espuma_20261106 enable row level security;
