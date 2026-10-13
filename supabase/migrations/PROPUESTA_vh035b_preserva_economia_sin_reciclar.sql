-- ============================================================================
--  PROPUESTA VH-035b · Preservar la economía de Dirección SIN reciclarla sobre otro producto.
--
--  ⚠️ PROPUESTA, NO MIGRACIÓN. El prefijo `PROPUESTA_` existe para que `supabase db push`
--  nunca la tome (las migraciones se ordenan por timestamp numérico). Si Dirección la
--  autoriza, se renombra a `2026MMDDHHMMSS_vh035b_preserva_economia_sin_reciclar.sql`
--  y SUSTITUYE a `20261010170000_actualizar_cotizacion_preserva_economia.sql` (tampoco
--  aplicada en producción al 2026-10-13). Es autocontenida: funciona aplicada sola o
--  encima de la 20261010170000 (mismos nombres de función, CREATE OR REPLACE).
--
--  Qué corrige respecto a 20261010170000 (demostrado en supabase/tests/preservaEconomia.test.js,
--  bloque "STALE"): aquella fusiona la economía vieja SÓLO por `id` de partida. Si el vendedor
--  cambia el producto de la partida (producto_id / producto_version_id / piezaId / bom_hash)
--  conservando el `id`, el costo del producto ANTERIOR se re-pega sobre el nuevo y Dirección
--  ve un `costoUnitario` KNOWN que es falso.
--
--  Regla aquí:
--    · misma identidad de producto  → se re-pega la economía de primer nivel (como antes);
--    · identidad distinta           → la economía vieja se DESCARTA, la partida queda con
--                                     `cost_status: 'UNKNOWN'` (vocabulario de
--                                     public.normalizar_cost_status_partidas; un valor fuera de
--                                     ese vocabulario, p. ej. 'STALE_RECOSTEO', el trigger
--                                     trg_normalize_economics_status lo convertiría en UNKNOWN de
--                                     todos modos) y una marca `cost_stale` con motivo, campos
--                                     que cambiaron e identidad previa. `cost_stale` empieza
--                                     por `cost`, así que jsonb_sin_economia la esconde al
--                                     vendedor y la fusión la conserva en guardados posteriores:
--                                     sólo Dirección la ve y sólo Dirección la quita al recostear.
--  Identidad: producto_id (alias productoId/product_id), producto_version_id (alias
--  productoVersionId/product_version_id), piezaId (alias pieza_id) y bom_hash (alias bomHash,
--  sólo se compara cuando AMBOS lados lo traen). Omitir producto_id/producto_version_id/piezaId
--  que antes existían cuenta como cambio (fail-closed: mejor pedir recosteo que heredar).
--  Limitación heredada: la fusión sigue siendo de PRIMER nivel; economía anidada (config.costeo)
--  no se restaura (documentado en el test; se resuelve al mover el costeo al servidor).
-- ============================================================================

-- Lo que jsonb_sin_economia QUITA de un objeto = su economía (primer nivel).
create or replace function private_api.economia_de_partida(p jsonb)
returns jsonb language sql immutable set search_path to 'public' as $$
  select coalesce((
    select jsonb_object_agg(e.key, e.value)
    from jsonb_each(coalesce(p, '{}'::jsonb)) e
    where not (public.jsonb_sin_economia(p) ? e.key)
  ), '{}'::jsonb);
$$;

-- Identidad de producto de una partida, como texto (mismos alias que pin_product_versions_in_partidas).
create or replace function private_api.identidad_producto_partida(p jsonb)
returns jsonb language sql immutable set search_path to 'public' as $$
  select jsonb_build_object(
    'producto_id',         coalesce(nullif(p->>'producto_id',''), nullif(p->>'productoId',''), nullif(p->>'product_id','')),
    'producto_version_id', coalesce(nullif(p->>'producto_version_id',''), nullif(p->>'productoVersionId',''), nullif(p->>'product_version_id','')),
    'piezaId',             coalesce(nullif(p->>'piezaId',''), nullif(p->>'pieza_id','')),
    'bom_hash',            coalesce(nullif(p->>'bom_hash',''), nullif(p->>'bomHash','')));
$$;

-- Campos de identidad que cambian entre la partida guardada y la que llega (vacío = mismo producto).
create or replace function private_api.campos_identidad_cambiados(p_vieja jsonb, p_nueva jsonb)
returns text[] language sql immutable set search_path to 'public' as $$
  select coalesce(array_agg(c.k order by c.ord), '{}'::text[])
  from unnest(array['producto_id','producto_version_id','piezaId','bom_hash']) with ordinality as c(k, ord)
  cross join lateral (select private_api.identidad_producto_partida(p_vieja) as v, private_api.identidad_producto_partida(p_nueva) as n) i
  where (i.v->>c.k) is distinct from (i.n->>c.k)
    and not (c.k = 'bom_hash' and ((i.v->>c.k) is null or (i.n->>c.k) is null));
$$;

create or replace function private_api.fusionar_economia_partidas(p_viejas jsonb, p_nuevas jsonb)
returns jsonb language plpgsql immutable set search_path to 'public' as $$
declare
  n jsonb; v jsonb; out jsonb := '[]'::jsonb; nid text; cambios text[];
begin
  if p_nuevas is null or jsonb_typeof(p_nuevas) <> 'array' then return p_nuevas; end if;
  for n in select * from jsonb_array_elements(p_nuevas) loop
    nid := n->>'id';
    v := null;
    if nid is not null and p_viejas is not null and jsonb_typeof(p_viejas) = 'array' then
      select e into v from jsonb_array_elements(p_viejas) e where e->>'id' = nid limit 1;
    end if;
    if v is null then
      out := out || jsonb_build_array(n);                       -- renglón nuevo: tal cual (ya strippeado)
      continue;
    end if;
    cambios := private_api.campos_identidad_cambiados(v, n);
    if coalesce(array_length(cambios, 1), 0) = 0 then
      -- Mismo producto: lo nuevo manda en todo lo NO económico; la economía vieja se re-pega.
      out := out || jsonb_build_array(n || private_api.economia_de_partida(v));
    else
      -- OTRO producto: la economía vieja no le pertenece. Sin costo, veredicto UNKNOWN y marca.
      out := out || jsonb_build_array(n || jsonb_build_object(
        'cost_status', 'UNKNOWN',
        'cost_stale', jsonb_build_object(
          'motivo', 'RECOSTEO_PRODUCTO_CAMBIADO',
          'campos', to_jsonb(cambios),
          'previo', private_api.identidad_producto_partida(v))));
    end if;
  end loop;
  return out;
end $$;

-- El trigger de strip respeta la fusión hecha por el RPC (misma transacción). Igual que 20261010170000.
create or replace function public.strip_seller_economics_on_cotizacion_write()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_email text := auth.jwt()->>'email';
  v_is_seller boolean := false;
begin
  if v_email is null then return new; end if;
  if coalesce(current_setting('vh.economia_preservada', true), '') = '1' then
    return new;   -- actualizar_cotizacion_segura ya strippeó la entrada y fusionó lo viejo
  end if;
  select exists(
    select 1 from public.permitidos p
    where lower(p.email)=lower(v_email) and lower(p.rol)='vendedor'
  ) into v_is_seller;
  if v_is_seller and not public.puede_ver_economia() then
    new.partidas := public.jsonb_sin_economia(new.partidas);
    new.totales := public.jsonb_sin_economia(new.totales);
    new.acomodo := public.jsonb_sin_economia(new.acomodo);
  end if;
  return new;
end $$;

-- actualizar_cotizacion_segura: cuerpo de producción (2026-10-13) + bloque "VH-035". Igual que 20261010170000.
create or replace function private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_email text := auth.jwt()->>'email';
  v_role text;
  v_c public.cotizaciones%rowtype;
  v_owner text;
  v_partidas jsonb;
  v_acomodo jsonb;
  v_totales jsonb;
  v_total numeric;
  v_piezas integer;
  v_activa boolean;
  v_cliente_id bigint;
  v_contacto_id bigint;
  v_proyecto_id bigint;
  v_ve_economia boolean := public.puede_ver_economia();
begin
  if v_email is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'patch invalido'; end if;

  select lower(p.rol) into v_role from public.permitidos p where lower(p.email)=lower(v_email) limit 1;
  if v_role not in ('direccion','diseno','vendedor') then raise exception 'rol sin permiso'; end if;

  select * into v_c from public.cotizaciones where id=p_cotizacion_id for update;
  if not found then raise exception 'cotizacion no existe'; end if;
  if not (lower(coalesce(v_c.usuario,''))=lower(v_email) or public.puede_editar_config()) then
    raise exception 'sin acceso';
  end if;
  if lower(coalesce(v_c.estado,'borrador')) <> 'borrador' then
    raise exception 'cotizacion no editable en estado %',v_c.estado;
  end if;
  if p_patch ? 'estado' and lower(coalesce(p_patch->>'estado','borrador')) <> 'borrador' then
    raise exception 'estado protegido; use el flujo de emision';
  end if;
  if p_patch ? 'folio_oficial' and nullif(p_patch->>'folio_oficial','') is distinct from v_c.folio_oficial then
    raise exception 'folio_oficial protegido; use el flujo de emision';
  end if;

  v_owner := v_c.usuario;
  if p_patch ? 'usuario' then
    if v_role not in ('direccion','diseno') then
      if lower(coalesce(p_patch->>'usuario','')) <> lower(coalesce(v_c.usuario,'')) then
        raise exception 'propietario protegido';
      end if;
    elsif nullif(trim(p_patch->>'usuario'),'') is not null then
      select p.email into v_owner from public.permitidos p where lower(p.email)=lower(trim(p_patch->>'usuario')) limit 1;
      if v_owner is null then raise exception 'usuario propietario invalido'; end if;
    end if;
  end if;

  v_partidas := case when p_patch ? 'partidas' then p_patch->'partidas' else v_c.partidas end;
  v_acomodo := case when p_patch ? 'acomodo' then p_patch->'acomodo' else v_c.acomodo end;
  v_totales := case when p_patch ? 'totales' then p_patch->'totales' else v_c.totales end;
  if jsonb_typeof(coalesce(v_partidas,'[]'::jsonb)) <> 'array' then raise exception 'partidas debe ser arreglo'; end if;
  if v_acomodo is not null and jsonb_typeof(v_acomodo) not in ('array','object') then raise exception 'acomodo invalido'; end if;
  if v_totales is not null and jsonb_typeof(v_totales) <> 'object' then raise exception 'totales invalido'; end if;

  -- VH-035: quien no ve economía no la puede escribir NI borrar la que ya había.
  -- VH-035b: ...y tampoco heredarla si cambió el producto de la partida (fusionar_economia_partidas).
  if not v_ve_economia then
    if p_patch ? 'partidas' then
      v_partidas := private_api.fusionar_economia_partidas(v_c.partidas, public.jsonb_sin_economia(v_partidas));
    end if;
    if p_patch ? 'totales' then v_totales := public.jsonb_sin_economia(v_totales); end if;
    if p_patch ? 'acomodo' then v_acomodo := public.jsonb_sin_economia(v_acomodo); end if;
    perform set_config('vh.economia_preservada', '1', true);
  end if;

  v_total := v_c.total;
  if p_patch ? 'total' then begin v_total := coalesce(nullif(p_patch->>'total','')::numeric,0); exception when others then raise exception 'total invalido'; end; end if;
  v_piezas := v_c.piezas;
  if p_patch ? 'piezas' then begin v_piezas := coalesce(nullif(p_patch->>'piezas','')::integer,0); exception when others then raise exception 'piezas invalido'; end; end if;
  v_activa := v_c.activa;
  if p_patch ? 'activa' then begin v_activa := (p_patch->>'activa')::boolean; exception when others then raise exception 'activa invalida'; end; end if;
  v_cliente_id := v_c.cliente_id;
  if p_patch ? 'cliente_id' then begin v_cliente_id := nullif(p_patch->>'cliente_id','')::bigint; exception when others then raise exception 'cliente_id invalido'; end; end if;
  v_contacto_id := v_c.contacto_id;
  if p_patch ? 'contacto_id' then begin v_contacto_id := nullif(p_patch->>'contacto_id','')::bigint; exception when others then raise exception 'contacto_id invalido'; end; end if;
  v_proyecto_id := v_c.proyecto_id;
  if p_patch ? 'proyecto_id' then begin v_proyecto_id := nullif(p_patch->>'proyecto_id','')::bigint; exception when others then raise exception 'proyecto_id invalido'; end; end if;
  if v_total < 0 then raise exception 'total no puede ser negativo'; end if;
  if v_piezas < 0 then raise exception 'piezas no puede ser negativo'; end if;

  update public.cotizaciones
  set usuario=v_owner,
      cliente=case when p_patch ? 'cliente' then nullif(p_patch->>'cliente','') else cliente end,
      folio=case when p_patch ? 'folio' then nullif(p_patch->>'folio','') else folio end,
      partidas=v_partidas, acomodo=v_acomodo, totales=v_totales,
      total=v_total, piezas=v_piezas,
      huella_mp=case when p_patch ? 'huella_mp' then nullif(p_patch->>'huella_mp','') else huella_mp end,
      activa=v_activa, cliente_id=v_cliente_id, contacto_id=v_contacto_id, proyecto_id=v_proyecto_id,
      actualizado=now()
  where id=p_cotizacion_id;

  return public.cotizacion_segura(p_cotizacion_id);
end $$;

-- ============================================================================
--  ROLLBACK (si se aplicó y hay que volver a producción tal cual 2026-10-13):
--    1) Ejecutar de supabase/tests/fixtures/private_api_prod_20261013.sql los bloques
--       `private_api.actualizar_cotizacion_segura` y `public.strip_seller_economics_on_cotizacion_write`
--       (son los cuerpos de producción, md5 en el encabezado de ese fixture).
--    2) drop function if exists private_api.fusionar_economia_partidas(jsonb, jsonb);
--       drop function if exists private_api.campos_identidad_cambiados(jsonb, jsonb);
--       drop function if exists private_api.identidad_producto_partida(jsonb);
--       drop function if exists private_api.economia_de_partida(jsonb);
--    3) Datos: no hay nada que revertir. La migración no reescribe filas existentes; las marcas
--       `cost_stale` que hayan quedado son inertes (normalize las deja, jsonb_sin_economia las
--       esconde al vendedor) y Dirección las quita al recostear.
-- ============================================================================
