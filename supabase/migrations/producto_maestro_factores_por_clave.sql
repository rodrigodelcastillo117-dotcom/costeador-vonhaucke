-- APLICADA 2026-11-06. Los factores MO/GIF NO son universales (Alpura 20/50 x1.8,
-- Telcel 10/25 x1.35): se guardan POR CLAVE. cos_fab = material * (1 + factor_mo + factor_gif).
alter table public.producto_maestro
  add column if not exists factor_mo  numeric,
  add column if not exists factor_gif numeric,
  add column if not exists material_real numeric;
