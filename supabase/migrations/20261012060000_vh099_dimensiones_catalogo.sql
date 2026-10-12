-- ============================================================================
--  VH-099 (P0-05) · DIMENSIONES PRELIMINARES de ProductVersion desde el texto del
--  catálogo. NO APLICADA en producción (RC): requiere autorización de Dirección.
--
--  Medido 2026-10-12 (producción mtuvnbgljwbsaizjjgzs): 1,944 PVs, 13 con
--  `dimensiones`, 0 con spatial_spec. Evidencia disponible SIN inventar:
--    · banco (217): productos.legacy_meta->>'medidas'  p. ej. "4800 × 1200 mm" → 148 PVs
--    · línea (1,717): el NOMBRE Intelisis trae "DE 220 X 649 X 75 MM" (ancho×fondo×alto) → 1,590 PVs
--  Total derivable: 1,738 de 1,931 (193 quedan sin evidencia textual).
--
--  Cada dimensión derivada queda PRELIMINAR con su fuente por medida
--  ({fuente:'CATALOGO_TEXTO', evidencia:<texto>}); VALIDADO sólo lo confirma
--  una persona (Diseño/Producción) o un expediente con plano. El solver puede
--  usar PRELIMINAR para acomodar, y la UI lo etiqueta como tal.
--
--  Uso: select private_api.derivar_dimensiones_catalogo(false);  -- dry-run (conteos)
--       select private_api.derivar_dimensiones_catalogo(true);   -- aplica (Dirección)
-- ============================================================================
create or replace function private_api.derivar_dimensiones_catalogo(p_aplicar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  r record;
  v_ancho int; v_fondo int; v_alto int; v_m text[]; v_fuente text; v_evid text;
  n_banco int := 0; n_linea int := 0; n_sin int := 0; n_aplicadas int := 0;
begin
  for r in
    select pv.id pv_id, p.source_type, p.nombre, p.legacy_meta->>'medidas' medidas
    from public.producto_versiones pv join public.productos p on p.id = pv.producto_id
    where pv.dimensiones is null
  loop
    v_ancho := null; v_fondo := null; v_alto := null; v_fuente := null; v_evid := null;
    if r.source_type = 'banco' and r.medidas ~ '^\s*\d{2,5}\s*[×xX]\s*\d{2,5}' then
      v_m := regexp_match(r.medidas, '^\s*(\d{2,5})\s*[×xX]\s*(\d{2,5})(?:\s*[×xX]\s*(\d{2,5}))?');
      v_ancho := v_m[1]::int; v_fondo := v_m[2]::int; v_alto := nullif(v_m[3], '')::int;
      v_fuente := 'CATALOGO_TEXTO:legacy_meta.medidas'; v_evid := r.medidas; n_banco := n_banco + 1;
    elsif r.source_type = 'linea' and upper(r.nombre) ~ '\mDE\s+\d{2,5}\s*X\s*\d{2,5}(\s*X\s*\d{2,5})?\s*MM' then
      v_m := regexp_match(upper(r.nombre), '\mDE\s+(\d{2,5})\s*X\s*(\d{2,5})(?:\s*X\s*(\d{2,5}))?\s*MM');
      v_ancho := v_m[1]::int; v_fondo := v_m[2]::int; v_alto := nullif(v_m[3], '')::int;
      v_fuente := 'CATALOGO_TEXTO:nombre_intelisis'; v_evid := r.nombre; n_linea := n_linea + 1;
    else
      n_sin := n_sin + 1; continue;
    end if;
    -- Sanidad: nada menor a 20 mm ni mayor a 12 m; si el "alto" es mayor que fondo y ancho en una
    -- pieza plana no se reinterpreta (queda tal cual, PRELIMINAR: una persona decide).
    if v_ancho < 20 or v_fondo < 20 or v_ancho > 12000 or v_fondo > 12000 then n_sin := n_sin + 1; continue; end if;
    if p_aplicar then
      update public.producto_versiones set dimensiones = jsonb_build_object(
        'ancho_mm', v_ancho, 'fondo_mm', v_fondo, 'alto_mm', v_alto,
        'estado', 'PRELIMINAR', 'fuente', v_fuente, 'evidencia', v_evid,
        'derivado_en', now(), 'derivado_por', coalesce(auth.jwt() ->> 'email', 'migracion'))
      where id = r.pv_id;
      n_aplicadas := n_aplicadas + 1;
    end if;
  end loop;
  return jsonb_build_object('aplicado', p_aplicar, 'banco', n_banco, 'linea', n_linea, 'sin_evidencia', n_sin, 'aplicadas', n_aplicadas);
end;
$$;
revoke all on function private_api.derivar_dimensiones_catalogo(boolean) from public, anon, authenticated;
