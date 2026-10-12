-- VH-088 · El motor (cliente y costear-servidor) costea con el CATÁLOGO (insumos_catalogo ⨝ catalogo_vigente),
-- no con la foto de config.datos.insumos (2026-08-11). Aprobado por Dirección el 2026-10-12
-- ("ya migra el motor al catálogo de todas las compras").
--
--  · private_api.insumo_motor(c, v): un insumo del catálogo en la forma que consume el motor
--    (id, nombre, seccion, unidad, precio, formato, fraccion, mermaCorte, veta, inventario, clase, moneda,
--    actualizado, evidencia). precio NULL = sin precio vigente → el motor lo deja PENDIENTE (nunca $0).
--  · catalogo_motor(p_incluir_erp, p_ids): mapa id → insumo. Por omisión sólo el catálogo CURADO
--    (clasificacion <> 'erp'); p_ids agrega ids concretos (p. ej. los ERP que trae una pieza);
--    p_incluir_erp=true trae todo (uso del servidor/Compras).
--  · buscar_insumos_motor(q, limite): búsqueda por nombre/id en TODO el catálogo activo (incluye ERP).
--  · aprobar_precios_lote(ids, nota): aprobación por lote con las mismas reglas que aprobar_precio.
--  · config_para_rol: para direccion/diseno, `insumos` sale del catálogo (insumosFuente='catalogo').
--
-- Permisos: direccion/diseno (private_api.puede_editar_config) o service_role. Vendedor: no.

create or replace function private_api.insumo_motor(c public.insumos_catalogo, v public.catalogo_vigente)
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select (coalesce(c.atributos, '{}'::jsonb) - 'articulo')
    || jsonb_build_object(
      'id', c.id,
      'nombre', c.nombre,
      'seccion', coalesce(c.seccion, 'erp-otros'),
      'unidad', c.unidad_costeo,
      'precio', v.precio,
      'precioBase', v.precio,
      'moneda', 'MXN',
      'clase', coalesce(c.atributos->>'clase', 'directa'),
      'fraccion', coalesce((c.atributos->>'fraccion')::boolean, false),
      'mermaCorte', coalesce((c.atributos->>'mermaCorte')::numeric, 0),
      'veta', coalesce((c.atributos->>'veta')::boolean, false),
      'inventario', coalesce((c.atributos->>'inventario')::boolean, false),
      'formato', c.atributos->'formato',
      'actualizado', v.vigente_desde,
      'clasificacion', c.clasificacion,
      'familia', c.familia,
      'proveedor', '',
      'evidencia', jsonb_build_object(
        'estado', v.estado, 'certificable', coalesce(v.certificable, false),
        'confidence', v.confidence, 'evidence_status', v.evidence_status, 'fuente', v.fuente,
        'requiere_validacion_compras', coalesce(v.requiere_validacion_compras, false))
    );
$$;

create or replace function private_api.catalogo_motor(p_incluir_erp boolean default false, p_ids text[] default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_object_agg(c.id, private_api.insumo_motor(c, v)), '{}'::jsonb)
  from public.insumos_catalogo c
  left join public.catalogo_vigente v on v.insumo_id = c.id
  where c.activo
    and (c.clasificacion <> 'erp' or p_incluir_erp or (p_ids is not null and c.id = any(p_ids)));
$$;

create or replace function public.catalogo_motor(p_incluir_erp boolean default false, p_ids text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private_api'
as $$
begin
  if not (coalesce(auth.role(), '') = 'service_role' or private_api.puede_editar_config()) then
    raise exception 'no autorizado';
  end if;
  return private_api.catalogo_motor(p_incluir_erp, p_ids);
end;
$$;

create or replace function public.buscar_insumos_motor(p_q text, p_limite integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private_api'
as $$
declare toks text[]; q text := btrim(coalesce(p_q, ''));
begin
  if not (coalesce(auth.role(), '') = 'service_role' or private_api.puede_editar_config()) then
    raise exception 'no autorizado';
  end if;
  if length(q) < 2 then return '[]'::jsonb; end if;
  toks := regexp_split_to_array(lower(q), '\s+');
  return coalesce((
    select jsonb_agg(private_api.insumo_motor(c, v) order by (c.clasificacion <> 'erp') desc, v.vigente_desde desc nulls last, c.nombre)
    from (
      select c.* from public.insumos_catalogo c
      where c.activo
        and (select bool_and(lower(c.nombre || ' ' || c.id) like '%' || t || '%') from unnest(toks) t)
      order by (c.clasificacion <> 'erp') desc, c.nombre
      limit greatest(1, least(coalesce(p_limite, 30), 100))
    ) c
    left join public.catalogo_vigente v on v.insumo_id = c.id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.aprobar_precios_lote(p_ids bigint[], p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_id bigint; v_ok int := 0; v_err jsonb := '[]'::jsonb;
begin
  if not public.puede_certificar_costo() then raise exception 'no autorizado para certificar costo'; end if;
  foreach v_id in array coalesce(p_ids, '{}'::bigint[]) loop
    begin
      perform public.aprobar_precio(v_id, p_nota);
      v_ok := v_ok + 1;
    exception when others then
      v_err := v_err || jsonb_build_object('id', v_id, 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('aprobados', v_ok, 'errores', v_err);
end;
$$;

create or replace function private_api.config_para_rol()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare d jsonb; cat jsonb;
begin
  select datos into d from public.config where id = 'vonhaucke';
  if d is null then return '{}'::jsonb; end if;
  if public.puede_editar_config() then
    -- VH-088: los insumos del motor salen del catálogo certificado; config.datos.insumos queda
    -- sólo como respaldo si el catálogo estuviera vacío.
    cat := private_api.catalogo_motor(false, null);
    if cat is not null and cat <> '{}'::jsonb then
      return d || jsonb_build_object('insumos', cat, 'insumosFuente', 'catalogo');
    end if;
    return d || jsonb_build_object('insumosFuente', 'config-fallback');
  end if;
  return public.config_sanitizada(d);    -- vendedor: sin economía interna
end;
$$;

grant execute on function public.catalogo_motor(boolean, text[]) to authenticated, service_role;
grant execute on function public.buscar_insumos_motor(text, integer) to authenticated, service_role;
grant execute on function public.aprobar_precios_lote(bigint[], text) to authenticated;
revoke all on function public.catalogo_motor(boolean, text[]) from public, anon;
revoke all on function public.buscar_insumos_motor(text, integer) from public, anon;
revoke all on function public.aprobar_precios_lote(bigint[], text) from public, anon;
