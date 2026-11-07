-- P0 auditoría 2026-11-07: distinguir un BOM detallado verificado de un agregado histórico.
-- Un AGREGADO_HISTORICO (una sola línea agregada, sin desglose por material) NUNCA puede
-- presentarse como costeo certificado por materiales. Columna aditiva + reversible; el
-- frontend de producción no la lee todavía (cero impacto en prod hasta desplegar la rama).
alter table public.producto_maestro add column if not exists tipo_bom text;

-- Clasificación determinista por la forma del BOM guardado:
--  · AGREGADO_HISTORICO  : <=1 línea, o la línea 0 dice "agregado" (total de estimaciones).
--  · BOM_DETALLADO_VERIFICADO : varias líneas cuya suma reconcilia el material_real.
update public.producto_maestro
set tipo_bom = case
  when jsonb_array_length(coalesce(lineas,'[]'::jsonb)) <= 1
       or coalesce(lineas->0->>'desc','') ilike '%agregado%'
    then 'AGREGADO_HISTORICO'
  else 'BOM_DETALLADO_VERIFICADO'
end
where tipo_bom is null or tipo_bom = '';

comment on column public.producto_maestro.tipo_bom is
  'BOM_DETALLADO_VERIFICADO (desglose por material que reconcilia) | AGREGADO_HISTORICO (total histórico sin desglose; no certificable por materiales).';
