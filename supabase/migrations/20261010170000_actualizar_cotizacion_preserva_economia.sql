-- ============================================================================
--  VH-035 · Reabrir una cotización como vendedor/diseño NO debe borrar la economía
--  que Dirección sí tenía guardada en esa fila.
--
--  ⚠️ PENDIENTE DE APLICAR (2026-10-10). Escrita en el repo primero (regla Bloque 0).
--  Aplicar con `supabase db push` o `apply_migration` SÓLO después de:
--    1) probar en una rama de Supabase o con el fixture QA (qa-direccion@vonhaucke.mx);
--    2) correr el smoke por rol: Dirección guarda costos → vendedor reabre y edita →
--       Dirección vuelve a abrir y los costos siguen ahí.
--
--  Problema: `cotizacion_segura` entrega las partidas SIN economía a quien no la puede
--  ver (`jsonb_sin_economia`). El cliente reabre, edita y manda esas partidas de vuelta;
--  `actualizar_cotizacion_segura` las escribe tal cual → `costoUnitario`, `margen`,
--  `costoDerivado`… de Dirección se pierden. El trigger `strip_seller_economics` sólo
--  aplica a 'vendedor' y además strippea, no preserva.
--
--  Solución (servidor, una sola autoridad):
--    a) Si el caller NO puede ver economía: strippear lo que manda (no puede inyectar
--       costos) y re-pegar, partida por partida (por `id`), la economía de nivel superior
--       que YA tenía la fila.
--    b) Marcar la transacción (`vh.economia_preservada`) para que el trigger de strip no
--       deshaga la fusión. El trigger sigue strippeando escrituras crudas por REST.
--  Limitación conocida: la fusión es de claves de PRIMER nivel de cada partida (es donde
--  viven costoUnitario/margen/costoDerivado). Economía anidada (p. ej. dentro de
--  `config`) no se restaura; se documenta y se cubre al mover el costeo al servidor.
-- ============================================================================

create or replace function private_api.economia_de_partida(p jsonb)
returns jsonb language sql immutable set search_path to 'public' as $$
  -- Lo que jsonb_sin_economia QUITA de un objeto = su economía (primer nivel).
  select coalesce((
    select jsonb_object_agg(e.key, e.value)
    from jsonb_each(coalesce(p, '{}'::jsonb)) e
    where not (public.jsonb_sin_economia(p) ? e.key)
  ), '{}'::jsonb);
$$;

create or replace function private_api.fusionar_economia_partidas(p_viejas jsonb, p_nuevas jsonb)
returns jsonb language plpgsql immutable set search_path to 'public' as $$
declare
  n jsonb; v jsonb; out jsonb := '[]'::jsonb; nid text;
begin
  if p_nuevas is null or jsonb_typeof(p_nuevas) <> 'array' then return p_nuevas; end if;
  for n in select * from jsonb_array_elements(p_nuevas) loop
    nid := n->>'id';
    v := null;
    if nid is not null and p_viejas is not null and jsonb_typeof(p_viejas) = 'array' then
      select e into v from jsonb_array_elements(p_viejas) e where e->>'id' = nid limit 1;
    end if;
    -- Lo nuevo (ya strippeado) manda en todo lo NO económico; la economía vieja se re-pega.
    out := out || jsonb_build_array(
      case when v is null then n else n || private_api.economia_de_partida(v) end
    );
  end loop;
  return out;
end $$;

-- El trigger de strip respeta la fusión hecha por el RPC (misma transacción).
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

-- actualizar_cotizacion_segura: igual que hoy, más la fusión para quien no ve economía.
-- (Cuerpo = baseline 2026-10-10 + bloque marcado "VH-035".)
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
