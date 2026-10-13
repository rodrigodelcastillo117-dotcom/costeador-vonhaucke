-- ============================================================================
--  PROPUESTA · VH-148 · control optimista de versión en actualizar_cotizacion_segura.
--  ⚠️ NO APLICAR sin autorización de Dirección (prefijo PROPUESTA_: no entra en `db push`).
--
--  Defecto reproducido (2026-10-13, cotización 1372): el autosave manda la fila completa (partidas,
--  acomodo, totales) 1.5 s después de cada cambio y la RPC hace `select ... for update` y escribe el
--  patch tal cual: gana el último que escribe. Dos pestañas (o dos dispositivos) sobre la misma
--  cotización se pisan EN SILENCIO: la pestaña B manda SU copia vieja de `partidas` y borra lo que A
--  acababa de guardar. No había versión ni `actualizado` esperado en el contrato.
--
--  Decisión de Dirección: control optimista COMPLETO en RC (sin fusión automática de BOM/costos/acomodos):
--   1. `cotizacion_segura` expone `actualizado` (hoy devuelve `creado` pero NO `actualizado`).
--   2. `actualizar_cotizacion_segura` acepta `p_actualizado_esperado timestamptz` (opcional). Si viene y
--      es distinto del `actualizado` de la fila → excepción SQLSTATE 40001 (serialization_failure) con
--      mensaje 'CONFLICTO_VERSION: ... (<actualizado ISO del servidor>)', DETAIL 'actualizado=<ISO>'.
--      NADA se escribe (la excepción aborta la transacción antes del UPDATE).
--   3. El cliente (detrás de la bandera VITE_CONTROL_OPTIMISTA / localStorage vh:controlOptimista) NO
--      reintenta ni fusiona: conserva lo local, enseña el conflicto y la persona decide ("Ver la versión
--      del servidor" o "Volver a aplicar mis cambios"). Ver src/datos/conflictoGuardado.js.
--   4. Compatibilidad: la firma pública de DOS argumentos se conserva (clientes viejos → sin control,
--      comportamiento actual). PostgREST escoge la sobrecarga por los nombres de los argumentos del body.
--
--  Cuerpo = producción (supabase/tests/fixtures/private_api_prod_20261013.sql, md5 84da6ec0…) + la
--  verificación; nada más cambia. Probado contra PostgreSQL real (PGlite) en
--  supabase/tests/controlOptimista.test.js. Rollback al final del archivo.
--
--  ⚠️ ORDEN CON LAS OTRAS PROPUESTAS (vh035b / 20261010170000): esas redefinen
--  private_api.actualizar_cotizacion_segura(bigint, jsonb) con DOS argumentos. Si se aplican DESPUÉS de
--  esta, Postgres queda con dos sobrecargas (2 y 3 args con default) y TODA llamada con dos argumentos
--  falla con "function ... is not unique". Aplicar primero aquéllas y ésta al final, o rebasear sus
--  cuerpos sobre la firma de tres argumentos. (Por eso aquí se hace DROP de la firma de dos argumentos
--  en private_api antes de crear la nueva.)
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) cotizacion_segura: mismo cuerpo de producción + 'actualizado' en el payload.
--    `actualizado` no es economía (jsonb_sin_economia no lo toca): viaja a todo rol.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.cotizacion_segura(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c record; v_email text; payload jsonb;
begin
  v_email := auth.jwt()->>'email';
  select * into c from cotizaciones where id=p_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if not (c.usuario = v_email or puede_editar_config()) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_acceso');
  end if;
  payload := jsonb_build_object(
    'ok', true, 'id', c.id, 'folio', c.folio, 'folio_oficial', c.folio_oficial, 'cliente', c.cliente,
    'estado', c.estado, 'total', c.total, 'piezas', c.piezas, 'activa', c.activa,
    'cliente_id', c.cliente_id, 'contacto_id', c.contacto_id, 'proyecto_id', c.proyecto_id,
    'partidas', c.partidas, 'totales', c.totales, 'acomodo', c.acomodo, 'creado', c.creado,
    -- VH-148: versión de la fila para el control optimista. El cliente la devuelve TAL CUAL
    -- (misma cadena ISO, con microsegundos) en p_actualizado_esperado.
    'actualizado', c.actualizado
  );
  -- Dirección ve todo; el resto recibe el payload SIN economía interna.
  if puede_ver_economia() then
    return payload;
  end if;
  return public.jsonb_sin_economia(payload);
end $function$
;

-- ----------------------------------------------------------------------------
-- 2) actualizar_cotizacion_segura (private_api): firma de TRES argumentos con default.
--    Se elimina la de dos para que no haya ambigüedad (ver nota de orden arriba).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS private_api.actualizar_cotizacion_segura(bigint, jsonb);

CREATE OR REPLACE FUNCTION private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb, p_actualizado_esperado timestamptz DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_actualizado_iso text;
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch invalido';
  end if;

  select lower(p.rol) into v_role
  from public.permitidos p
  where lower(p.email)=lower(v_email)
  limit 1;
  if v_role not in ('direccion','diseno','vendedor') then
    raise exception 'rol sin permiso';
  end if;

  select * into v_c from public.cotizaciones where id=p_cotizacion_id for update;
  if not found then raise exception 'cotizacion no existe'; end if;
  if not (lower(coalesce(v_c.usuario,''))=lower(v_email) or public.puede_editar_config()) then
    raise exception 'sin acceso';
  end if;
  if lower(coalesce(v_c.estado,'borrador')) <> 'borrador' then
    raise exception 'cotizacion no editable en estado %',v_c.estado;
  end if;

  -- VH-148 · CONTROL OPTIMISTA. Si el cliente dice desde qué versión edita y la fila ya no es ésa,
  -- se aborta ANTES de tocar nada: la decisión (recargar o volver a aplicar) es de la persona, no
  -- del servidor. Sin el parámetro (clientes viejos) el comportamiento es el de siempre.
  -- La fecha viaja en el mismo formato ISO que `cotizacion_segura` (to_json), para que el cliente
  -- pueda devolverla tal cual en el siguiente intento.
  if p_actualizado_esperado is not null and v_c.actualizado is distinct from p_actualizado_esperado then
    v_actualizado_iso := to_json(v_c.actualizado)#>>'{}';
    raise exception 'CONFLICTO_VERSION: la cotización cambió en el servidor (%). Recarga antes de guardar.', v_actualizado_iso
      using errcode = '40001',
            detail = 'actualizado=' || v_actualizado_iso,
            hint = 'Vuelve a cargar la cotización (cotizacion_segura) y decide: ver la versión del servidor o volver a aplicar tus cambios con el actualizado nuevo.';
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
      select p.email into v_owner
      from public.permitidos p
      where lower(p.email)=lower(trim(p_patch->>'usuario'))
      limit 1;
      if v_owner is null then raise exception 'usuario propietario invalido'; end if;
    end if;
  end if;

  v_partidas := case when p_patch ? 'partidas' then p_patch->'partidas' else v_c.partidas end;
  v_acomodo := case when p_patch ? 'acomodo' then p_patch->'acomodo' else v_c.acomodo end;
  v_totales := case when p_patch ? 'totales' then p_patch->'totales' else v_c.totales end;
  if jsonb_typeof(coalesce(v_partidas,'[]'::jsonb)) <> 'array' then raise exception 'partidas debe ser arreglo'; end if;
  if v_acomodo is not null and jsonb_typeof(v_acomodo) not in ('array','object') then raise exception 'acomodo invalido'; end if;
  if v_totales is not null and jsonb_typeof(v_totales) <> 'object' then raise exception 'totales invalido'; end if;

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
      partidas=v_partidas,
      acomodo=v_acomodo,
      totales=v_totales,
      total=v_total,
      piezas=v_piezas,
      huella_mp=case when p_patch ? 'huella_mp' then nullif(p_patch->>'huella_mp','') else huella_mp end,
      activa=v_activa,
      cliente_id=v_cliente_id,
      contacto_id=v_contacto_id,
      proyecto_id=v_proyecto_id,
      actualizado=now()
  where id=p_cotizacion_id;

  return public.cotizacion_segura(p_cotizacion_id);
end;
$function$
;

-- ----------------------------------------------------------------------------
-- 3) Wrappers públicos (lo que PostgREST expone en /rest/v1/rpc/actualizar_cotizacion_segura).
--    · La firma de DOS argumentos se CONSERVA (clientes viejos y la app con la bandera apagada).
--    · La de TRES argumentos NO lleva default: con default, `f(id, patch)` sería ambigua en SQL
--      ("function is not unique"). PostgREST elige la sobrecarga por los nombres de los argumentos
--      que vienen en el body JSON: {p_cotizacion_id,p_patch} → 2 args; + p_actualizado_esperado → 3.
--    Mismo cuerpo que el wrapper de producción (supabase/schema/baseline/03_funciones.sql:14-24).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch);
      end
      $function$
;

CREATE OR REPLACE FUNCTION public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb, p_actualizado_esperado timestamptz)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch, p_actualizado_esperado);
      end
      $function$
;

-- Permisos: espejo de los del wrapper de dos argumentos (baseline/06_grants.sql:81-82).
REVOKE ALL ON FUNCTION public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb, p_actualizado_esperado timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb, p_actualizado_esperado timestamptz) TO service_role;

-- PostgREST cachea el esquema: sin esto la sobrecarga nueva no se ve hasta el siguiente reload.
NOTIFY pgrst, 'reload schema';

commit;

-- ============================================================================
--  ROLLBACK (no se ejecuta con este archivo: está dentro de un comentario de bloque).
--  Para revertir: copiar lo que hay entre los marcadores y correrlo tal cual. Devuelve los cuerpos
--  de producción byte a byte (fixture private_api_prod_20261013.sql) y quita la sobrecarga pública.
--  El cliente, además, debe quedar con la bandera APAGADA (VITE_CONTROL_OPTIMISTA sin definir y sin
--  `vh:controlOptimista` en localStorage); con la bandera apagada nunca manda p_actualizado_esperado,
--  así que el cliente nuevo también funciona contra la base revertida.
--  La prueba supabase/tests/controlOptimista.test.js corre este bloque y verifica que la firma de dos
--  argumentos sigue funcionando después.
-- ============================================================================
/*
-- >>> ROLLBACK VH-148 INICIO
begin;

DROP FUNCTION IF EXISTS public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz);
DROP FUNCTION IF EXISTS private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz);

CREATE OR REPLACE FUNCTION private_api.cotizacion_segura(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c record; v_email text; payload jsonb;
begin
  v_email := auth.jwt()->>'email';
  select * into c from cotizaciones where id=p_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if not (c.usuario = v_email or puede_editar_config()) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_acceso');
  end if;
  payload := jsonb_build_object(
    'ok', true, 'id', c.id, 'folio', c.folio, 'folio_oficial', c.folio_oficial, 'cliente', c.cliente,
    'estado', c.estado, 'total', c.total, 'piezas', c.piezas, 'activa', c.activa,
    'cliente_id', c.cliente_id, 'contacto_id', c.contacto_id, 'proyecto_id', c.proyecto_id,
    'partidas', c.partidas, 'totales', c.totales, 'acomodo', c.acomodo, 'creado', c.creado
  );
  -- Dirección ve todo; el resto recibe el payload SIN economía interna.
  if puede_ver_economia() then
    return payload;
  end if;
  return public.jsonb_sin_economia(payload);
end $function$
;

CREATE OR REPLACE FUNCTION private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch invalido';
  end if;

  select lower(p.rol) into v_role
  from public.permitidos p
  where lower(p.email)=lower(v_email)
  limit 1;
  if v_role not in ('direccion','diseno','vendedor') then
    raise exception 'rol sin permiso';
  end if;

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
      select p.email into v_owner
      from public.permitidos p
      where lower(p.email)=lower(trim(p_patch->>'usuario'))
      limit 1;
      if v_owner is null then raise exception 'usuario propietario invalido'; end if;
    end if;
  end if;

  v_partidas := case when p_patch ? 'partidas' then p_patch->'partidas' else v_c.partidas end;
  v_acomodo := case when p_patch ? 'acomodo' then p_patch->'acomodo' else v_c.acomodo end;
  v_totales := case when p_patch ? 'totales' then p_patch->'totales' else v_c.totales end;
  if jsonb_typeof(coalesce(v_partidas,'[]'::jsonb)) <> 'array' then raise exception 'partidas debe ser arreglo'; end if;
  if v_acomodo is not null and jsonb_typeof(v_acomodo) not in ('array','object') then raise exception 'acomodo invalido'; end if;
  if v_totales is not null and jsonb_typeof(v_totales) <> 'object' then raise exception 'totales invalido'; end if;

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
      partidas=v_partidas,
      acomodo=v_acomodo,
      totales=v_totales,
      total=v_total,
      piezas=v_piezas,
      huella_mp=case when p_patch ? 'huella_mp' then nullif(p_patch->>'huella_mp','') else huella_mp end,
      activa=v_activa,
      cliente_id=v_cliente_id,
      contacto_id=v_contacto_id,
      proyecto_id=v_proyecto_id,
      actualizado=now()
  where id=p_cotizacion_id;

  return public.cotizacion_segura(p_cotizacion_id);
end;
$function$
;

NOTIFY pgrst, 'reload schema';
commit;
-- <<< ROLLBACK VH-148 FIN
*/
