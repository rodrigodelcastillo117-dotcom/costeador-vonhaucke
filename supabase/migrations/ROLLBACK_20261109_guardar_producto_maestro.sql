-- ============================================================================
--  ROLLBACK de 20261109_guardar_producto_maestro_integridad.sql
--  Restaura la RPC de 10 args (contrato de producción 20261108). Las columnas
--  aditivas (version, cos_fab_calculado, …) y la tabla producto_maestro_historial
--  se CONSERVAN: son aditivas y la RPC vieja no las usa, no estorban ni destruyen
--  datos. producto_maestro no se toca (la migración nunca modificó filas).
--  Probado en PGlite (guardarProductoMaestroSwap.test.js).
-- ============================================================================
drop function if exists public.guardar_producto_maestro(text,text,jsonb,numeric,numeric,numeric,numeric,numeric,integer[],text,text,integer,boolean,boolean);

create or replace function public.guardar_producto_maestro(
  p_clave text, p_nombre text, p_lineas jsonb,
  p_factor_mo numeric, p_factor_gif numeric, p_material_real numeric,
  p_cos_fab_real numeric default null, p_dims_mm integer[] default null,
  p_tipo_bom text default 'BOM_DETALLADO_VERIFICADO', p_fuente text default null
) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_email text := lower(coalesce(auth.jwt()->>'email',''));
begin
  if not public.puede_certificar_costo() then
    raise exception 'no autorizado: solo Direccion (persona real) confirma un despiece como Producto Maestro';
  end if;
  if p_clave is null or btrim(p_clave) = '' then raise exception 'falta la clave'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'faltan las lineas del despiece';
  end if;
  if p_material_real is null or p_material_real <= 0 then raise exception 'material_real invalido'; end if;
  if p_tipo_bom not in ('BOM_DETALLADO_VERIFICADO','AGREGADO_HISTORICO') then raise exception 'tipo_bom invalido'; end if;

  insert into public.producto_maestro
    (clave, nombre, lineas, factor_mo, factor_gif, material_real, cos_fab_real, dims_mm, tipo_bom, fuente, creado_por, creado_en, actualizado_en)
  values
    (btrim(p_clave), p_nombre, p_lineas, p_factor_mo, p_factor_gif, p_material_real,
     coalesce(p_cos_fab_real, round(p_material_real * (1 + coalesce(p_factor_mo,0) + coalesce(p_factor_gif,0)), 2)),
     p_dims_mm, p_tipo_bom,
     coalesce(nullif(btrim(coalesce(p_fuente,'')),''), 'Confirmado en COSTEAR por ' || v_email),
     v_email, now(), now())
  on conflict (clave) do update set
    nombre = excluded.nombre, lineas = excluded.lineas,
    factor_mo = excluded.factor_mo, factor_gif = excluded.factor_gif,
    material_real = excluded.material_real, cos_fab_real = excluded.cos_fab_real,
    dims_mm = coalesce(excluded.dims_mm, public.producto_maestro.dims_mm),
    tipo_bom = excluded.tipo_bom, fuente = excluded.fuente, actualizado_en = now();

  return jsonb_build_object('ok', true, 'clave', btrim(p_clave),
    'lineas', jsonb_array_length(p_lineas), 'guardado_por', v_email, 'tipo_bom', p_tipo_bom);
end $$;

revoke all on function public.guardar_producto_maestro(text,text,jsonb,numeric,numeric,numeric,numeric,integer[],text,text) from public, anon;
grant execute on function public.guardar_producto_maestro(text,text,jsonb,numeric,numeric,numeric,numeric,integer[],text,text) to authenticated;
