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
--   2. Nueva sobrecarga `actualizar_cotizacion_segura(p_cotizacion_id, p_patch, p_actualizado_esperado
--      timestamptz)`. Si p_actualizado_esperado no es NULL y es distinto del `actualizado` de la fila →
--      excepción SQLSTATE 40001 (serialization_failure) con mensaje 'CONFLICTO_VERSION: ... (<actualizado
--      ISO del servidor>)', DETAIL 'actualizado=<ISO>'. NADA se escribe (la excepción aborta la
--      transacción antes del UPDATE). NULL explícito = sin control (misma semántica que dos argumentos).
--   3. El cliente (detrás de la bandera VITE_CONTROL_OPTIMISTA / localStorage vh:controlOptimista) NO
--      reintenta ni fusiona: conserva lo local, enseña el conflicto y la persona decide ("Ver la versión
--      del servidor" o "Volver a aplicar mis cambios"). Ver src/datos/conflictoGuardado.js.
--   4. Compatibilidad: la firma pública de DOS argumentos se conserva (clientes viejos → sin control,
--      comportamiento actual). PostgREST escoge la sobrecarga por los nombres de los argumentos del body.
--
--  COMPOSICIÓN (rediseño 2026-10-13, ver docs/auditoria/VH148_CONTROL_OPTIMISTA.md § Composición):
--   · El NÚCLEO económico es UNO solo: private_api.actualizar_cotizacion_segura(bigint, jsonb) de DOS
--     argumentos. Su dueño es VH-035c (PROPUESTA_vh035c_preserva_economia_integral.sql) si se aplica;
--     si no, es el cuerpo de producción. ESTE ARCHIVO NO LO TOCA (ni lo borra ni lo redefine).
--   · La sobrecarga privada de TRES argumentos NO lleva copia del cuerpo de guardado: valida las mismas
--     compuertas previas que el núcleo (sesión, patch, rol, existencia, acceso, estado borrador) para no
--     revelar la versión a quien no tiene acceso, BLOQUEA la fila (SELECT … FOR UPDATE), compara
--     `actualizado` contra p_actualizado_esperado (40001 + DETAIL) y DELEGA en el núcleo de dos
--     argumentos. El candado se conserva hasta el fin de la transacción: entre la comparación y el
--     UPDATE del núcleo nadie puede escribir la fila.
--   · NINGUNA sobrecarga lleva DEFAULT ⇒ `f(id, patch)` sólo casa con la de dos argumentos y
--     `f(id, patch, ts)` sólo con la de tres: no hay "function ... is not unique" en ningún orden.
--   ⇒ ORDEN DE APLICACIÓN CON VH-035c: CUALQUIER ORDEN. Si VH-035c se aplica antes, el guardado con
--     versión ya pasa por su fusión; si se aplica después, su CREATE OR REPLACE del núcleo de dos
--     argumentos queda automáticamente detrás del control de versión. Lo mismo con
--     20261010170000 / vh035b (mismo núcleo, mismo nombre y firma). Probado en
--     supabase/tests/composicionVh035cVh148.test.js (ambos órdenes + rollback de cada uno).
--   · Requisito: el núcleo de dos argumentos debe existir (siempre existe en producción). Al inicio se
--     verifica; al final se verifica que ninguna sobrecarga tenga DEFAULT.
--
--  Probado contra PostgreSQL real (PGlite) en supabase/tests/controlOptimista.test.js. Rollback al
--  final del archivo (no toca el núcleo de dos argumentos: deja a VH-035c intacto si estaba).
-- ============================================================================

begin;

-- Precondición: existe el núcleo de dos argumentos (producción o VH-035c) en el que se delega.
do $$
begin
  if to_regprocedure('private_api.actualizar_cotizacion_segura(bigint, jsonb)') is null then
    raise exception 'VH-148: falta private_api.actualizar_cotizacion_segura(bigint, jsonb); la sobrecarga de tres argumentos delega en ella';
  end if;
end $$;

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
-- 2) actualizar_cotizacion_segura (private_api): sobrecarga de TRES argumentos SIN default.
--    No contiene el cuerpo de guardado: compuertas previas + candado + versión → delega en el núcleo
--    de DOS argumentos (que se deja como esté: producción o VH-035c).
--    DROP previo: si quedó instalada la versión anterior de esta propuesta (3 args CON default y copia
--    del cuerpo), CREATE OR REPLACE no puede quitar un DEFAULT; se recrea limpia.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz);

CREATE FUNCTION private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb, p_actualizado_esperado timestamptz)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_role text;
  v_c public.cotizaciones%rowtype;
  v_actualizado_iso text;
begin
  -- NULL explícito = sin control: exactamente la firma de dos argumentos.
  if p_actualizado_esperado is null then
    return private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch);
  end if;

  -- Mismas compuertas y en el MISMO ORDEN que el núcleo, ANTES de comparar versiones: quien no
  -- tiene sesión/rol/acceso recibe el mismo error que con dos argumentos y nunca la versión de la
  -- fila (un vendedor ajeno recibe 'sin acceso', no 'CONFLICTO_VERSION'). El núcleo las repite al
  -- delegar (idempotentes, misma transacción).
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

  -- Candado de la fila hasta el fin de la transacción: el núcleo vuelve a pedirlo (mismo dueño, no
  -- espera) y nadie más puede escribir entre esta comparación y su UPDATE.
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
  -- del servidor. La fecha viaja en el mismo formato ISO que `cotizacion_segura` (to_json), para que
  -- el cliente pueda devolverla tal cual en el siguiente intento.
  if v_c.actualizado is distinct from p_actualizado_esperado then
    v_actualizado_iso := to_json(v_c.actualizado)#>>'{}';
    raise exception 'CONFLICTO_VERSION: la cotización cambió en el servidor (%). Recarga antes de guardar.', v_actualizado_iso
      using errcode = '40001',
            detail = 'actualizado=' || v_actualizado_iso,
            hint = 'Vuelve a cargar la cotización (cotizacion_segura) y decide: ver la versión del servidor o volver a aplicar tus cambios con el actualizado nuevo.';
  end if;

  -- Versión correcta: el guardado es EL MISMO que el de dos argumentos (núcleo único; con VH-035c
  -- aplicado incluye fusión de economía, STALE, rechazo de re-pin y autoridad protegida).
  return private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch);
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

-- Postcondición: ninguna sobrecarga (pública o privada) lleva DEFAULT ⇒ ninguna llamada es ambigua.
do $$
declare v_malas text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_malas
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname in ('public','private_api') and p.proname = 'actualizar_cotizacion_segura' and p.pronargdefaults > 0;
  if v_malas is not null then
    raise exception 'VH-148: sobrecargas con DEFAULT (llamadas ambiguas): %', v_malas;
  end if;
end $$;

-- PostgREST cachea el esquema: sin esto la sobrecarga nueva no se ve hasta el siguiente reload.
NOTIFY pgrst, 'reload schema';

commit;

-- ============================================================================
--  ROLLBACK (no se ejecuta con este archivo: está dentro de un comentario de bloque).
--  Para revertir: copiar lo que hay entre los marcadores y correrlo tal cual. Quita las dos
--  sobrecargas de TRES argumentos y devuelve cotizacion_segura a producción byte a byte (fixture
--  private_api_prod_20261013.sql). NO toca el núcleo private_api.actualizar_cotizacion_segura(bigint,
--  jsonb) ni el wrapper público de dos argumentos (esta propuesta no los cambió): si VH-035c estaba
--  aplicada, sigue aplicada y funcionando.
--  El cliente, además, debe quedar con la bandera APAGADA (VITE_CONTROL_OPTIMISTA sin definir y sin
--  `vh:controlOptimista` en localStorage); con la bandera apagada nunca manda p_actualizado_esperado,
--  así que el cliente nuevo también funciona contra la base revertida.
--  Pruebas: supabase/tests/controlOptimista.test.js (sobre producción) y
--  supabase/tests/composicionVh035cVh148.test.js (sobre VH-035c, en ambos órdenes).
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

NOTIFY pgrst, 'reload schema';
commit;
-- <<< ROLLBACK VH-148 FIN
*/
