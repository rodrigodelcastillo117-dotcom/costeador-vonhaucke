-- ============================================================================
--  PROPUESTA VH-035c · Preservación INTEGRAL de la economía de Dirección cuando guarda un rol
--  que no la ve (vendedor, diseño) por private_api.actualizar_cotizacion_segura.
--
--  ⚠️ PROPUESTA, NO MIGRACIÓN. El prefijo `PROPUESTA_` existe para que `supabase db push`
--  nunca la tome (las migraciones se ordenan por timestamp numérico). Si Dirección la
--  autoriza, se renombra a `2026MMDDHHMMSS_vh035c_preserva_economia_integral.sql` y
--  SUSTITUYE tanto a `20261010170000_actualizar_cotizacion_preserva_economia.sql` (pendiente,
--  no aplicada) como a `PROPUESTA_vh035b_preserva_economia_sin_reciclar.sql`. Es
--  autocontenida: funciona aplicada sola o encima de cualquiera de las dos (mismos nombres
--  de función, CREATE OR REPLACE). No reescribe filas.
--
--  Qué corrige respecto a vh035b (demostrado en supabase/tests/preservaEconomiaIntegral.test.js):
--
--   1. ECONOMÍA ANIDADA. vh035b re-pegaba sólo el primer nivel de la partida; `config.costeo`,
--      `config.insumos[].costo`, `pieza.componentes[].costo`… se perdían. Aquí la fusión es
--      RECURSIVA (`repegar_economia`): toda clave que `jsonb_sin_economia` quita, a cualquier
--      profundidad, vuelve desde la fila guardada. En arreglos anidados los elementos se casan
--      por `id`/`piezaId`/`clave`/`key`/`codigo` (si la clave es única) y, si no traen clave,
--      por igualdad exacta de su forma sin economía (si el vendedor no tocó el elemento, es el
--      mismo elemento).
--
--   2. STALE POR IDENTIDAD. Igual que vh035b para producto_id / producto_version_id / piezaId /
--      bom_hash, y ADEMÁS por identidad de MATERIAL a cualquier profundidad (`material`,
--      `materialId`, `acabado`, `finish`, `insumoId`, `insumo_id`, `clave`, `sku`, `color`,
--      `espesor`, `calibre`, `tela`, `textura`, `bom`; ver `es_clave_material`). Si cambia,
--      la economía NO se re-pega: queda `cost_status:'UNKNOWN'` y `cost_stale:{motivo, campos,
--      previo, economia_previa}`. `economia_previa` vive DENTRO de `cost_stale` (prefijo
--      `cost` ⇒ jsonb_sin_economia la esconde al vendedor; un `economia_previa` de primer
--      nivel sería visible como clave y el vendedor podría mandarla de vuelta).
--
--   3. STALE POR LOTE. El motor (src/motor/calculo.js) calcula costoUnitario = costoLote/n:
--      el costo unitario DEPENDE de la cantidad (preparación, escalones de tablero). Si cambia
--      `cantidad` y la partida trae economía por lote —contrato mínimo: marca `costo_por_lote:true`
--      (o `economia_por_lote:true`) o presencia de `costoLote`/`costoLoteConMerma` a cualquier
--      profundidad— se marca STALE (motivo RECOSTEO_LOTE_CAMBIADO). Un costo unitario sin marca
--      de lote (lista de precios, banco, captura manual) se conserva aunque cambie la cantidad.
--      Hoy App.jsx NO escribe la marca al costear con el motor: decisión pendiente (ver doc).
--
--   4. RE-PIN SIN VALIDACIÓN DEL SERVIDOR. pin_product_versions_in_partidas sólo completa la
--      versión cuando FALTA; si el cliente la manda, la respeta sin validar. Regla aquí para el
--      caller sin economía:
--        · partida EXISTENTE (mismo `id`) con producto_id/producto_version_id guardados: cambiarlos
--          se RECHAZA (raise 'identidad de producto protegida'). Se eligió rechazar y no revertir
--          en silencio: revertir dejaría el precio del producto B sobre la identidad del producto A
--          (fila incoherente que el cliente no ve) y una autoguardado que "parece" exitoso.
--          Cambiar de producto = quitar el renglón y agregar otro (id nuevo).
--        · partida NUEVA, o existente SIN identidad guardada que ahora la trae: producto_id debe
--          existir en productos (si no, raise) y producto_version_id se FIJA a la versión técnica
--          vigente del servidor; si el cliente mandó otra, se sustituye y se anota en
--          `cambios_rechazados` (visible al vendedor para que la UI lo muestre).
--        · piezaId / bom_hash / material siguen siendo del cliente: su cambio NO se rechaza,
--          invalida la economía (STALE).
--
--   5. ESTADOS DE AUTORIDAD. Para el caller sin economía:
--        · clase AUTORIDAD (aprobado, aprobado_por, aprobado_en, aprobacion, estado_costo,
--          precio_autorizado, precioAutorizado): nunca escribibles. En partida existente gana lo
--          guardado; en partida nueva sólo se admite false/null, cualquier otro valor se quita.
--        · clase PROCEDENCIA (lista_precio_item_id, listaPrecioItemId, precio_lista_snapshot,
--          source_type, source_ref, price_status, identity_status, product_status,
--          product_source_ref, economia_por_lote): congeladas en partida existente (gana lo
--          guardado); libres en partida nueva (el servidor no tiene verdad previa).
--        · cost_status, costoEstado, costoPendiente, costoDesconocido…: son economía (prefijo
--          cost/costo) ⇒ el vendedor no los ve ni los escribe; se re-pegan, salvo STALE donde
--          cost_status pasa a UNKNOWN y el resto va a cost_stale.economia_previa.
--      Cada rechazo deja `cambios_rechazados:[{campo, motivo}]` (sin valores, para no filtrar
--      nada); el servidor lo recalcula en cada guardado del rol sin economía.
--
--   6. COMPUERTA DE EMISIÓN. Ni evaluar_emision_cotizacion ni emitir_revision_v2 leen
--      cost_status: en líneas canónicas el costo sale de producto_version_economia y en legacy
--      del costoUnitario persistido. Una partida STALE legacy ya se bloquea (sin costoUnitario ⇒
--      linea_N_costo_desconocido), pero una canónica NO. Aquí el wrapper
--      public.evaluar_emision_cotizacion (INVOKER, misma firma) suma los motivos
--      `linea_N_recosteo_pendiente_<motivo>` leídos de la fila (private_api.motivos_recosteo_pendiente)
--      y degrada el estado a ECONOMICS_INCOMPLETE (o los añade a `economics` si ya era BLOCKED).
--      cotizacion_emitible y emitir_revision_v2 pasan por ese wrapper ⇒ ninguna STALE se emite.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Ayudas puras (IMMUTABLE). Una sola fuente de verdad sobre qué es economía: jsonb_sin_economia.
-- ----------------------------------------------------------------------------
create or replace function private_api.es_clave_economia(k text)
returns boolean language sql immutable set search_path to 'public' as $$
  select not (public.jsonb_sin_economia(jsonb_build_object(k, true)) ? k);
$$;

-- Lo que jsonb_sin_economia QUITA de un objeto = su economía de PRIMER nivel.
create or replace function private_api.economia_de_partida(p jsonb)
returns jsonb language sql immutable set search_path to 'public' as $$
  select coalesce((
    select jsonb_object_agg(e.key, e.value)
    from jsonb_each(coalesce(p, '{}'::jsonb)) e
    where not (public.jsonb_sin_economia(p) ? e.key)
  ), '{}'::jsonb);
$$;

-- Economía a CUALQUIER profundidad (para auditoría en cost_stale.economia_previa).
-- Objetos sin economía → '{}'; arreglos sin economía → '[]'; arreglos con economía conservan posiciones.
create or replace function private_api.economia_recursiva(p jsonb)
returns jsonb language plpgsql immutable set search_path to 'public' as $$
declare k text; v jsonb; out jsonb; sub jsonb; alguna boolean := false;
begin
  if p is null or jsonb_typeof(p) not in ('object','array') then return '{}'::jsonb; end if;
  if jsonb_typeof(p) = 'array' then
    out := '[]'::jsonb;
    for v in select * from jsonb_array_elements(p) loop
      sub := private_api.economia_recursiva(v);
      if sub not in ('{}'::jsonb, '[]'::jsonb) then alguna := true; end if;
      out := out || jsonb_build_array(sub);
    end loop;
    return case when alguna then out else '[]'::jsonb end;
  end if;
  out := '{}'::jsonb;
  for k, v in select * from jsonb_each(p) loop
    if private_api.es_clave_economia(k) then
      out := out || jsonb_build_object(k, v);
    elsif jsonb_typeof(v) in ('object','array') then
      sub := private_api.economia_recursiva(v);
      if sub not in ('{}'::jsonb, '[]'::jsonb) then out := out || jsonb_build_object(k, sub); end if;
    end if;
  end loop;
  return out;
end $$;

-- Clave con la que se casan elementos de arreglos anidados (insumos, componentes…).
create or replace function private_api.clave_elemento(e jsonb)
returns text language sql immutable as $$
  select case when jsonb_typeof(e) = 'object'
    then coalesce(nullif(e->>'id',''), nullif(e->>'piezaId',''), nullif(e->>'clave',''), nullif(e->>'key',''), nullif(e->>'codigo',''))
    end;
$$;

-- Fusión RECURSIVA: `p_nueva` (ya strippeada, lo que mandó el rol sin economía) manda en todo lo
-- no económico; la economía de `p_vieja` (la fila guardada) vuelve a cualquier profundidad.
create or replace function private_api.repegar_economia(p_vieja jsonb, p_nueva jsonb)
returns jsonb language plpgsql immutable set search_path to 'public' as $$
declare k text; vv jsonb; out jsonb; ne jsonb; ve jsonb; i int := 0; clave text; n_coinc int;
begin
  if p_vieja is null or p_nueva is null then return p_nueva; end if;
  if jsonb_typeof(p_nueva) = 'object' and jsonb_typeof(p_vieja) = 'object' then
    out := p_nueva;
    for k, vv in select * from jsonb_each(p_vieja) loop
      if private_api.es_clave_economia(k) then
        out := out || jsonb_build_object(k, vv);
      elsif (p_nueva ? k) and jsonb_typeof(vv) in ('object','array') and jsonb_typeof(p_nueva->k) = jsonb_typeof(vv) then
        out := out || jsonb_build_object(k, private_api.repegar_economia(vv, p_nueva->k));
      end if;
    end loop;
    return out;
  end if;
  if jsonb_typeof(p_nueva) = 'array' and jsonb_typeof(p_vieja) = 'array' then
    out := '[]'::jsonb;
    for ne in select * from jsonb_array_elements(p_nueva) loop
      ve := null;
      if jsonb_typeof(ne) = 'object' then
        clave := private_api.clave_elemento(ne);
        if clave is not null then
          select count(*) into n_coinc from jsonb_array_elements(p_vieja) e where private_api.clave_elemento(e) = clave;
          if n_coinc = 1 then
            select e into ve from jsonb_array_elements(p_vieja) e where private_api.clave_elemento(e) = clave limit 1;
          end if;
        end if;
        if ve is null then
          -- Sin clave (o clave repetida): el elemento viejo cuya forma SIN economía es idéntica.
          if jsonb_typeof(p_vieja->i) = 'object' and public.jsonb_sin_economia(p_vieja->i) = ne then
            ve := p_vieja->i;
          else
            select e into ve from jsonb_array_elements(p_vieja) e
            where jsonb_typeof(e) = 'object' and public.jsonb_sin_economia(e) = ne limit 1;
          end if;
        end if;
      end if;
      out := out || jsonb_build_array(case when ve is null then ne else private_api.repegar_economia(ve, ne) end);
      i := i + 1;
    end loop;
    return out;
  end if;
  return p_nueva;
end $$;

-- Identidad de producto de una partida (mismos alias que pin_product_versions_in_partidas).
create or replace function private_api.identidad_producto_partida(p jsonb)
returns jsonb language sql immutable set search_path to 'public' as $$
  select jsonb_build_object(
    'producto_id',         coalesce(nullif(p->>'producto_id',''), nullif(p->>'productoId',''), nullif(p->>'product_id','')),
    'producto_version_id', coalesce(nullif(p->>'producto_version_id',''), nullif(p->>'productoVersionId',''), nullif(p->>'product_version_id','')),
    'piezaId',             coalesce(nullif(p->>'piezaId',''), nullif(p->>'pieza_id','')),
    'bom_hash',            coalesce(nullif(p->>'bom_hash',''), nullif(p->>'bomHash','')));
$$;

-- Campos de identidad que cambian entre la partida guardada y la que llega (vacío = mismo producto).
-- bom_hash sólo se compara cuando AMBOS lados lo traen. Nota: `productoId` NUMÉRICO es alias de
-- producto_id (pin lo trata así); `productoId` textual es clave de línea y aquí se ignora.
create or replace function private_api.campos_identidad_cambiados(p_vieja jsonb, p_nueva jsonb)
returns text[] language sql immutable set search_path to 'public' as $$
  select coalesce(array_agg(c.k order by c.ord), '{}'::text[])
  from unnest(array['producto_id','producto_version_id','piezaId','bom_hash']) with ordinality as c(k, ord)
  cross join lateral (select private_api.identidad_producto_partida(p_vieja) as v, private_api.identidad_producto_partida(p_nueva) as n) i
  where (i.v->>c.k) is distinct from (i.n->>c.k)
    and not (c.k = 'bom_hash' and ((i.v->>c.k) is null or (i.n->>c.k) is null));
$$;

-- Identidad de MATERIAL: claves que, si cambian, el costo guardado ya no describe la partida.
create or replace function private_api.es_clave_material(k text)
returns boolean language sql immutable as $$
  select regexp_replace(lower(k), '[^a-z0-9]', '', 'g')
    ~ '^(material|materiales|materialid|materialclave|acabado|acabados|acabadoid|acabadofid|finish|insumoid|insumo|insumoclave|tela|textura|color|calibre|espesor|clave|sku|bom)$';
$$;

-- Huella de material: {ruta → valores} de toda clave de material a cualquier profundidad, sin economía.
-- Insensible al ORDEN de los arreglos: un elemento con clave (id/piezaId/clave/key/codigo) se rutea por
-- su clave `[clave]`; los elementos sin clave se agrupan en `[*]` y sus valores se comparan como multiconjunto
-- ordenado (reordenar componentes no es cambio; quitar, añadir o cambiar uno sí).
create or replace function private_api.huella_material_filas(p jsonb, p_ruta text default '')
returns table(ruta text, valor jsonb) language plpgsql immutable set search_path to 'public' as $$
declare k text; v jsonb; clave text;
begin
  if p is null then return; end if;
  if jsonb_typeof(p) = 'array' then
    for v in select * from jsonb_array_elements(p) loop
      clave := private_api.clave_elemento(v);
      return query select * from private_api.huella_material_filas(v, p_ruta || '[' || coalesce(clave, '*') || ']');
    end loop;
    return;
  end if;
  if jsonb_typeof(p) <> 'object' then return; end if;
  for k, v in select * from jsonb_each(p) loop
    if private_api.es_clave_economia(k) then continue; end if;
    if private_api.es_clave_material(k) then
      ruta := p_ruta || '.' || k; valor := v; return next;
    elsif jsonb_typeof(v) in ('object','array') then
      return query select * from private_api.huella_material_filas(v, p_ruta || '.' || k);
    end if;
  end loop;
end $$;

create or replace function private_api.huella_material(p jsonb)
returns jsonb language sql immutable set search_path to 'public' as $$
  select coalesce((
    select jsonb_object_agg(g.ruta, g.valores)
    from (select f.ruta, jsonb_agg(f.valor order by f.valor::text) as valores
          from private_api.huella_material_filas(p) f group by f.ruta) g
  ), '{}'::jsonb);
$$;

create or replace function private_api.campos_material_cambiados(p_vieja jsonb, p_nueva jsonb)
returns text[] language sql immutable set search_path to 'public' as $$
  with h as (select private_api.huella_material(p_vieja) as v, private_api.huella_material(p_nueva) as n),
  ks as (select jsonb_object_keys(v) as k from h union select jsonb_object_keys(n) from h)
  select coalesce(array_agg(ks.k order by ks.k), '{}'::text[])
  from ks, h where (h.v->ks.k) is distinct from (h.n->ks.k);
$$;

-- ¿La economía guardada depende del tamaño de lote? Contrato mínimo (ver encabezado, punto 3).
create or replace function private_api.economia_por_lote(p jsonb)
returns boolean language sql immutable as $$
  select lower(coalesce(p->>'costo_por_lote','')) in ('true','1')
      or lower(coalesce(p->>'economia_por_lote','')) in ('true','1')
      or jsonb_path_exists(p, '$.**.costoLote')
      or jsonb_path_exists(p, '$.**.costoLoteConMerma');
$$;

create or replace function private_api.claves_autoridad_partida()
returns text[] language sql immutable as $$
  select array['aprobado','aprobado_por','aprobado_en','aprobacion','estado_costo','precio_autorizado','precioAutorizado'];
$$;
create or replace function private_api.claves_procedencia_partida()
returns text[] language sql immutable as $$
  select array['lista_precio_item_id','listaPrecioItemId','precio_lista_snapshot','source_type','source_ref',
               'price_status','identity_status','product_status','product_source_ref','economia_por_lote'];
$$;

-- ----------------------------------------------------------------------------
--  Fusión por partida. STABLE: consulta productos para fijar la versión vigente.
-- ----------------------------------------------------------------------------
create or replace function private_api.fusionar_economia_partidas(p_viejas jsonb, p_nuevas jsonb)
returns jsonb language plpgsql stable set search_path to 'public' as $$
declare
  n jsonb; v jsonb; out jsonb := '[]'::jsonb; res jsonb; nid text;
  cambios_id text[]; cambios_mat text[]; motivo text; campos text[];
  rechazos jsonb; k text;
  v_pid_txt text; v_pvid_txt text; v_pid bigint; v_vigente bigint;
  v_cant_v numeric; v_cant_n numeric;
begin
  if p_nuevas is null or jsonb_typeof(p_nuevas) <> 'array' then return p_nuevas; end if;
  for n in select * from jsonb_array_elements(p_nuevas) loop
    if jsonb_typeof(n) <> 'object' then out := out || jsonb_build_array(n); continue; end if;
    rechazos := '[]'::jsonb;
    res := n - 'cambios_rechazados';          -- el servidor lo recalcula; el cliente no lo escribe
    nid := n->>'id';
    v := null;
    if nid is not null and p_viejas is not null and jsonb_typeof(p_viejas) = 'array' then
      select e into v from jsonb_array_elements(p_viejas) e where e->>'id' = nid limit 1;
    end if;

    -- (4) Identidad de producto: ¿la cambió un rol que no puede?
    cambios_id := case when v is null then '{}'::text[] else private_api.campos_identidad_cambiados(v, n) end;
    if v is not null and (cambios_id && array['producto_id','producto_version_id'])
       and (private_api.identidad_producto_partida(v)->>'producto_id') is not null then
      raise exception 'identidad de producto protegida (partida %): producto_id/producto_version_id solo cambian con un renglon nuevo o por Direccion', nid
        using errcode = '42501';
    end if;
    -- Renglón nuevo, o existente sin identidad guardada que ahora la trae: la versión la fija el servidor.
    v_pid_txt := private_api.identidad_producto_partida(n)->>'producto_id';
    if v_pid_txt is not null and (v is null or (private_api.identidad_producto_partida(v)->>'producto_id') is null) then
      if v_pid_txt !~ '^[0-9]+$' then
        raise exception 'producto_id invalido (partida %): %', nid, v_pid_txt using errcode = '22023';
      end if;
      v_pid := v_pid_txt::bigint;
      select p.version_tecnica_vigente_id into v_vigente from public.productos p where p.id = v_pid;
      if not found then
        raise exception 'producto_id % no existe (partida %)', v_pid, nid using errcode = '23503';
      end if;
      v_pvid_txt := private_api.identidad_producto_partida(n)->>'producto_version_id';
      if v_vigente is not null and (v_pvid_txt is null or v_pvid_txt <> v_vigente::text) then
        if v_pvid_txt is not null then
          rechazos := rechazos || jsonb_build_object('campo', 'producto_version_id', 'motivo', 'VERSION_FIJADA_POR_SERVIDOR');
        end if;
        res := (res - 'productoVersionId' - 'product_version_id') || jsonb_build_object('producto_id', v_pid, 'producto_version_id', v_vigente);
      end if;
    end if;

    -- (5) Estados de autoridad: nunca los escribe el rol sin economía.
    foreach k in array private_api.claves_autoridad_partida() loop
      if v is not null then
        if (v ? k) and ((n->k) is distinct from (v->k)) then
          rechazos := rechazos || jsonb_build_object('campo', k, 'motivo', 'AUTORIDAD_SOLO_DIRECCION');
          res := res || jsonb_build_object(k, v->k);
        elsif not (v ? k) and (n ? k) and not (jsonb_typeof(n->k) = 'null' or (n->k) = 'false'::jsonb) then
          rechazos := rechazos || jsonb_build_object('campo', k, 'motivo', 'AUTORIDAD_SOLO_DIRECCION');
          res := res - k;
        end if;
      elsif (n ? k) and not (jsonb_typeof(n->k) = 'null' or (n->k) = 'false'::jsonb) then
        rechazos := rechazos || jsonb_build_object('campo', k, 'motivo', 'AUTORIDAD_SOLO_DIRECCION');
        res := res - k;
      end if;
    end loop;
    -- Procedencia: congelada en partida existente.
    if v is not null then
      foreach k in array private_api.claves_procedencia_partida() loop
        if (v ? k) and ((n->k) is distinct from (v->k)) then
          rechazos := rechazos || jsonb_build_object('campo', k, 'motivo', 'PROCEDENCIA_CONGELADA');
          res := res || jsonb_build_object(k, v->k);
        elsif not (v ? k) and (n ? k) then
          rechazos := rechazos || jsonb_build_object('campo', k, 'motivo', 'PROCEDENCIA_CONGELADA');
          res := res - k;
        end if;
      end loop;
    end if;

    if v is null then
      -- Renglón nuevo: tal cual (ya strippeado), sin economía inventada.
      if jsonb_array_length(rechazos) > 0 then res := res || jsonb_build_object('cambios_rechazados', rechazos); end if;
      out := out || jsonb_build_array(res);
      continue;
    end if;

    -- (2)(3) ¿La economía guardada sigue describiendo esta partida?
    motivo := null; campos := '{}'::text[];
    if coalesce(array_length(cambios_id, 1), 0) > 0 then
      motivo := 'RECOSTEO_PRODUCTO_CAMBIADO'; campos := campos || cambios_id;
    end if;
    cambios_mat := private_api.campos_material_cambiados(v, n);
    if coalesce(array_length(cambios_mat, 1), 0) > 0 then
      motivo := coalesce(motivo, 'RECOSTEO_MATERIAL_CAMBIADO'); campos := campos || cambios_mat;
    end if;
    begin v_cant_v := nullif(v->>'cantidad','')::numeric; exception when others then v_cant_v := null; end;
    begin v_cant_n := nullif(n->>'cantidad','')::numeric; exception when others then v_cant_n := null; end;
    if v_cant_v is distinct from v_cant_n and private_api.economia_por_lote(v) then
      motivo := coalesce(motivo, 'RECOSTEO_LOTE_CAMBIADO'); campos := campos || array['cantidad'];
    end if;

    if motivo is null then
      -- Misma partida: la economía de Dirección vuelve ÍNTEGRA (primer nivel y anidada).
      res := private_api.repegar_economia(v, res);
    else
      -- La economía vieja ya no le pertenece: no se hereda; se guarda para auditoría dentro de cost_stale.
      res := res || jsonb_build_object(
        'cost_status', 'UNKNOWN',
        'cost_stale', jsonb_build_object(
          'motivo', motivo,
          'campos', to_jsonb(campos),
          'previo', private_api.identidad_producto_partida(v) || jsonb_build_object('cantidad', v->'cantidad'),
          'economia_previa', coalesce(v->'cost_stale'->'economia_previa',
                                      private_api.economia_recursiva(v) - 'cost_status' - 'cost_stale')));
    end if;
    if jsonb_array_length(rechazos) > 0 then res := res || jsonb_build_object('cambios_rechazados', rechazos); end if;
    out := out || jsonb_build_array(res);
  end loop;
  return out;
end $$;

-- ----------------------------------------------------------------------------
--  Compuerta: motivos de recosteo pendiente leídos de la FILA (no del snapshot que manda el cliente).
-- ----------------------------------------------------------------------------
create or replace function private_api.motivos_recosteo_pendiente(p_cotizacion_id bigint)
returns text[] language plpgsql stable security definer set search_path to 'public' as $$
declare v_email text := auth.jwt()->>'email'; v_c public.cotizaciones%rowtype; out text[] := '{}';
begin
  if v_email is null or not public.puede_entrar() then return out; end if;
  select * into v_c from public.cotizaciones where id = p_cotizacion_id;
  if not found or not (v_c.usuario = v_email or public.puede_editar_config()) then return out; end if;
  select coalesce(array_agg(format('linea_%s_recosteo_pendiente_%s', d.ord,
           lower(replace(coalesce(d.value->'cost_stale'->>'motivo', 'RECOSTEO'), 'RECOSTEO_', ''))) order by d.ord), '{}')
    into out
  from jsonb_array_elements(coalesce(v_c.partidas, '[]'::jsonb)) with ordinality d(value, ord)
  where jsonb_typeof(d.value) = 'object' and (d.value ? 'cost_stale');
  return out;
end $$;
revoke all on function private_api.motivos_recosteo_pendiente(bigint) from public, anon;
grant execute on function private_api.motivos_recosteo_pendiente(bigint) to authenticated, service_role;

-- Wrapper de producción (INVOKER, misma firma y search_path) + motivos STALE de la fila.
create or replace function public.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
returns jsonb language plpgsql stable set search_path to 'pg_catalog', 'public', 'private_api' as $$
declare v_gate jsonb; v_stale text[]; v_state text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  v_gate := private_api.evaluar_emision_cotizacion(p_cotizacion_id, p_snapshot);
  v_stale := private_api.motivos_recosteo_pendiente(p_cotizacion_id);
  if coalesce(array_length(v_stale, 1), 0) = 0 then return v_gate; end if;
  v_state := v_gate->>'state';
  if v_state = 'BLOCKED' then
    return v_gate || jsonb_build_object('economics', coalesce(v_gate->'economics', '[]'::jsonb) || to_jsonb(v_stale));
  end if;
  return v_gate || jsonb_build_object(
    'state', 'ECONOMICS_INCOMPLETE',
    'reasons', to_jsonb(v_stale) || case when v_state = 'ECONOMICS_INCOMPLETE' then coalesce(v_gate->'reasons', '[]'::jsonb) else '[]'::jsonb end,
    'recosteo_pendiente', true);
end $$;

-- ----------------------------------------------------------------------------
--  El trigger de strip respeta la fusión hecha por el RPC (misma transacción). Igual que vh035b.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
--  actualizar_cotizacion_segura: cuerpo de producción (2026-10-13) + bloque "VH-035". Igual que vh035b;
--  la diferencia está en fusionar_economia_partidas (puede hacer raise: identidad protegida / producto inexistente).
-- ----------------------------------------------------------------------------
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
  -- VH-035b: ...ni heredarla si cambió el producto. VH-035c: fusión recursiva, STALE por material/lote,
  -- identidad y estados de autoridad protegidos (fusionar_economia_partidas).
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
--       `private_api.actualizar_cotizacion_segura` (líneas 39-147) y
--       `public.strip_seller_economics_on_cotizacion_write` (líneas 150-177): son los cuerpos de
--       producción (md5 de actualizar_cotizacion_segura en el encabezado de ese fixture).
--    2) Restaurar el wrapper de producción de la compuerta (supabase/schema/baseline/03_funciones.sql:535):
--         create or replace function public.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
--         returns jsonb language plpgsql stable set search_path to 'pg_catalog','public','private_api' as $f$
--         begin
--           if auth.uid() is null then raise exception 'no autenticado'; end if;
--           return private_api.evaluar_emision_cotizacion(p_cotizacion_id, p_snapshot);
--         end $f$;
--    3) drop function if exists private_api.motivos_recosteo_pendiente(bigint);
--       drop function if exists private_api.fusionar_economia_partidas(jsonb, jsonb);
--       drop function if exists private_api.claves_procedencia_partida();
--       drop function if exists private_api.claves_autoridad_partida();
--       drop function if exists private_api.economia_por_lote(jsonb);
--       drop function if exists private_api.campos_material_cambiados(jsonb, jsonb);
--       drop function if exists private_api.huella_material(jsonb);
--       drop function if exists private_api.huella_material_filas(jsonb, text);
--       drop function if exists private_api.es_clave_material(text);
--       drop function if exists private_api.campos_identidad_cambiados(jsonb, jsonb);
--       drop function if exists private_api.identidad_producto_partida(jsonb);
--       drop function if exists private_api.repegar_economia(jsonb, jsonb);
--       drop function if exists private_api.clave_elemento(jsonb);
--       drop function if exists private_api.economia_recursiva(jsonb);
--       drop function if exists private_api.economia_de_partida(jsonb);
--       drop function if exists private_api.es_clave_economia(text);
--    4) Datos: nada que revertir. No se reescriben filas. Las marcas `cost_stale` (con su
--       `economia_previa`) y `cambios_rechazados` que hayan quedado son inertes: normalize las deja,
--       jsonb_sin_economia esconde `cost_stale` al vendedor, Dirección las quita al recostear.
--       `vh.economia_preservada` es un set_config local a la transacción: no deja rastro.
-- ============================================================================
