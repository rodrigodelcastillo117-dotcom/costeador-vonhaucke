-- ============================================================================
--  PROPUESTA · SEG-01 (P1) · el gate de emisión exige que cada renglón del snapshot SEA la fila guardada
--  (salvo precio y descuento del renglón). Auditoría: docs/auditoria/SEGURIDAD_10.md § SEG-01 y
--  § "Propuesta SEG-01".
--  ⚠️ PROPUESTA, NO MIGRACIÓN. El prefijo `PROPUESTA_` evita que `supabase db push` la tome. Si Dirección la
--  autoriza se renombra a `2026MMDDHHMMSS_seg01_emision_snapshot_fiel.sql`. No reescribe filas.
--
--  DEFECTO (producción 2026-10-13, md5 private_api.evaluar_emision_cotizacion = 9c660b09ca099af557436ef54edbb1de):
--  el gate ata el snapshot del cliente a la fila sólo por número de renglones e identidad
--  coalesce(id, piezaId, producto_id, productoId, nombre). En renglones legacy toma el COSTO de la fila y el
--  PRECIO del snapshot sin comparar descripción, medidas, material, cantidad, producto_id ni
--  producto_version_id. Un vendedor emite (y obtiene folio oficial) un renglón de OTRO producto contra el costo
--  de lo que Dirección costeó.
--
--  REV2 (2026-10-17) · REBASE SOBRE P0-01. El 2026-10-16 se aplicó en producción P0-01 (reventa de catálogo,
--  PROPUESTA_p0_01_reventa_emite_sin_costo.sql), que reescribió este mismo gate. La rev1 exigía el gate del 13-oct:
--  aplicada hoy abortaba (precondición) y, forzada, borraba la reventa. La rev2 es el gate vivo (P0-01) + las mismas
--  3 inserciones de SEG-01 (merge de tres vías, un solo conflicto en las declaraciones, se conservan ambas); su
--  precondición exige el gate vivo y la rama de reventa, y su rollback devuelve el gate vivo, no el del 13-oct.
--  OJO con el rollback de P0-01 (sus líneas `-- RB`): devuelve el gate del 13-oct y quitaría también SEG-01. Si hay
--  que revertir ambos: primero este rollback (vuelve a P0-01), después el de P0-01.
--
--  QUÉ CAMBIA (una sola función existente, misma firma, mismos atributos y grants):
--   · private_api.evaluar_emision_cotizacion(bigint, jsonb): cuerpo de producción BYTE A BYTE + 3 inserciones:
--       1) declara v_campos / v_discrepancias;
--       2) tras el chequeo de identidad, por renglón: si private_api.campos_partida_no_corresponden(snapshot, fila)
--          no está vacío ⇒ motivo `linea_N_no_corresponde_a_lo_costeado` ⇒ state BLOCKED;
--       3) el resultado BLOCKED lleva `discrepancias: {"linea_N": [nombres de campo]}` (sólo NOMBRES de claves no
--          económicas, nunca valores ni cifras: no filtra economía al vendedor).
--   · 3 ayudas nuevas IMMUTABLE en private_api (sin EXECUTE para public/anon/authenticated; las llama el gate,
--     SECURITY DEFINER propiedad de postgres):
--       private_api.claves_libres_emision_partida()  → lo único que el snapshot puede tener distinto de la fila;
--       private_api.partida_cotejable_emision(jsonb) → jsonb_strip_nulls(jsonb_sin_economia(p)) - claves libres;
--       private_api.campos_partida_no_corresponden(jsonb, jsonb) → claves de primer nivel que difieren.
--   · emitir_revision_v2, asignar_folio_oficial, hash_revision, requiere_aprobacion_snapshot, verificar_aprobacion,
--     cotizacion_emitible y los wrappers públicos NO se tocan: emitir_revision_v2 (y emitir_revision, que delega
--     en ella) y cotizacion_emitible ya pasan por public.evaluar_emision_cotizacion → este gate; si no es ALLOWED,
--     emitir_revision_v2 hace raise ANTES de insertar la revisión 'generado_v2', y sin esa revisión
--     asignar_folio_oficial no da folio.
--
--  POR QUÉ COMPARAR EN EL GATE Y NO RECONSTRUIR EL SNAPSHOT EN emitir_revision_v2 (alternativa evaluada):
--   · VH-042: el PDF se dibuja con EL MISMO snapshot que se conserva (src/datos/revisiones.js#guardarRevision).
--     Si el servidor armara las partidas desde la fila, lo conservado dejaría de ser lo impreso salvo que el
--     cliente re-dibujara con la respuesta (cambio de cliente y de contrato).
--   · VH-055: la aprobación de Dirección se firma sobre hash_revision(snapshot del cliente)
--     (solicitar_aprobacion_snapshot / verificar_aprobacion). Reconstruir cambia el hash ⇒ toda aprobación vigente
--     dejaría de casar, y habría que reescribir también el gate, solicitar_aprobacion_snapshot y el cliente.
--   · Reconstruir sólo cubriría emitir_revision_v2; el gate (lo que ve el vendedor, cotizacion_emitible y la
--     solicitud de aprobación) seguiría evaluando un snapshot falso. Comparar en el gate cierra todas las vías con
--     un solo punto y deja intacto el snapshot legítimo (mismo hash, mismo PDF).
--
--  QUÉ PUEDE DIFERIR (evidencia del código del cliente, 2026-10-13):
--   · El cliente SIEMPRE guarda antes de verificar y de emitir (src/App.jsx: verificarEmision / onEmitida /
--     solicitarAprobacion llaman guardarEnNube() y luego mandan snapshotEmitido(estado) = paraGuardar(estado), el
--     MISMO objeto que se acaba de guardar). Al abrir una cotización, las partidas en pantalla son las de la fila
--     (conflictoGuardado.js#aplicarFilaServidor, sin re-normalizar). ⇒ en el flujo legítimo el snapshot ES la fila.
--   · Lo que el vendedor edita en src/componentes/Cotizacion.jsx: cantidad (+/−), quitar renglón, render, el
--     descuento GLOBAL (totales.descuentoPct, fuera de partidas) y, en EditarPartida.jsx, medidas/acabado/color/
--     opciones/cantidad, que RECOSTEAN el renglón (costearConfig → crearPartida) y se guardan: eso cambia lo
--     costeado y debe pasar por el guardado (strip / VH-035c), nunca colarse en el snapshot.
--   · Lo que el servidor cambia al guardar y el cliente no recarga: trg_strip_seller_economics / jsonb_sin_economia
--     (economía ⇒ se ignora de ambos lados), trg_normalize_economics_status (cost_status ⇒ economía, ignorado),
--     trg_pin_product_versions (completa producto_version_id cuando falta: ese snapshot ya era BLOCKED por
--     linea_N_sin_product_version_id) y, si se aplica VH-035c, `cambios_rechazados` (anotación del servidor ⇒
--     libre) y quitar procedencia en null (jsonb_strip_nulls ⇒ null = ausente).
--   ⇒ claves libres: precioUnitario, precio_unitario, descuento, descuento_solicitado, importe (lo comercial que el
--     gate y emitir_revision_v2 YA validan: margen contra el costo de la fila, precio autoritativo, descuento máx.)
--     y cambios_rechazados. TODO lo demás (nombre, medidas, material, config, w, d, cantidad, producto_id,
--     producto_version_id, piezaId, bom_hash, nota, render, catálogo, procedencia, autoridad…) debe coincidir.
--     Se eligió lista blanca (lo que PUEDE cambiar) y no negra: una clave nueva del contrato de partida queda
--     protegida por omisión (fail-closed).
--   · CANTIDAD (reglas de lote, docs/auditoria/VH035C_INTEGRAL.md §1.3): el motor calcula costoUnitario =
--     costoLote / n, así que el costo unitario puede depender de la cantidad. El gate no decide eso: una cantidad
--     distinta de la fila ⇒ BLOCKED (`linea_N_no_corresponde_a_lo_costeado`, discrepancias ['cantidad']). La
--     cantidad cambia GUARDANDO: en producción el guardado del vendedor despoja el costo ⇒ ECONOMICS_INCOMPLETE
--     (recosteo); con VH-035c, si la partida trae marca de lote ⇒ STALE ⇒ `linea_N_recosteo_pendiente_lote_cambiado`.
--
--  ORDEN DE APLICACIÓN con las otras propuestas: CUALQUIER ORDEN.
--   · PROPUESTA_vh035c_preserva_economia_integral.sql redefine el WRAPPER public.evaluar_emision_cotizacion (suma
--     motivos de recosteo pendiente) y el núcleo de guardado; NO toca private_api.evaluar_emision_cotizacion.
--   · PROPUESTA_vh148_control_optimista_cotizacion.sql no toca el gate.
--   · Probado en PGlite en los órdenes SEG01→vh035c→vh148, vh035c→vh148→SEG01 y vh148→SEG01→vh035c
--     (supabase/tests/seguridadGateEmisionSnapshot.test.js, describe "COMPOSICIÓN SEG-01 × VH-035c × VH-148").
--   · Cada rollback es independiente: el de esta propuesta sólo devuelve private_api.evaluar_emision_cotizacion al
--     cuerpo de producción y borra sus 3 ayudas; el wrapper de VH-035c sigue llamándolo igual.
--   · RIESGO DE COMPOSICIÓN (no lo corrige este archivo; CORREGIDO en VH-035c §8, 2026-10-13): con la versión
--     anterior de VH-035c, un vendedor que GUARDABA un renglón con otro nombre/medidas/dimensiones (claves fuera de
--     la huella de material) conservaba el costo de Dirección; luego el snapshot coincidía con la fila y este gate lo
--     dejaba pasar. VH-035c ahora marca STALE (RECOSTEO_DEFINICION_CAMBIADA) ante todo cambio no comercial, con la
--     MISMA lista blanca que private_api.claves_libres_emision_partida (más cantidad, regida por su regla de lote, y
--     las claves de autoridad que el servidor ya fija) ⇒ el wrapper de VH-035c da ECONOMICS_INCOMPLETE. Si se cambia
--     la lista blanca aquí, cambiarla también en private_api.claves_libres_definicion_partida (VH-035c) y en el
--     espejo e2e/nubeFalsa.js. Prueba: el antiguo it.fails "RIESGO VH-035c" es ahora `it` en los tres órdenes.
--
--  ROLLBACK: bloque comentado al final (entre marcadores), con el cuerpo de producción copiado BYTE A BYTE de
--  supabase/tests/fixtures/private_api_emision_prod_20261013.sql (la prueba verifica md5 = 9c660b09… tras revertir).
-- ============================================================================

begin;

-- Precondición: base esperada. Aborta si el gate de producción cambió (drift) y aún no tiene esta corrección.
do $$
declare v_md5 text; v_src text;
begin
  if to_regprocedure('public.jsonb_sin_economia(jsonb)') is null then
    raise exception 'SEG-01: falta public.jsonb_sin_economia(jsonb)';
  end if;
  if to_regprocedure('private_api.evaluar_emision_cotizacion(bigint, jsonb)') is null then
    raise exception 'SEG-01: falta private_api.evaluar_emision_cotizacion(bigint, jsonb)';
  end if;
  select md5(pg_get_functiondef(p.oid)), p.prosrc into v_md5, v_src
  from pg_proc p where p.oid = 'private_api.evaluar_emision_cotizacion(bigint, jsonb)'::regprocedure;
  -- rev2 (2026-10-17): la base es el gate VIVO de P0-01 (reventa, aplicada 2026-10-16), md5 17ec67cf…; la rev1 se
  -- escribió sobre el del 13-oct (9c660b09…) y, aplicada hoy, habría borrado la rama de reventa.
  if v_md5 <> '17ec67cf8bf06b540a55279288e90025' and position('no_corresponde_a_lo_costeado' in v_src) = 0 then
    raise exception 'SEG-01: private_api.evaluar_emision_cotizacion no es la de producción 2026-10-17 con P0-01 (md5 %); revisar drift antes de aplicar', v_md5;
  end if;
  if position('v_reventa_policy' in v_src) = 0 then
    raise exception 'SEG-01 rev2: el gate de producción no trae la rama de reventa de P0-01; esta revisión la conserva y la exige';
  end if;
end $$;

-- ----------------------------------------------------------------------------
--  Ayudas puras. Una sola verdad de "qué es economía": public.jsonb_sin_economia.
-- ----------------------------------------------------------------------------
-- Lo ÚNICO que un renglón del snapshot puede traer distinto de la fila guardada.
create or replace function private_api.claves_libres_emision_partida()
returns text[] language sql immutable as $$
  select array['precioUnitario','precio_unitario','descuento','descuento_solicitado','importe','cambios_rechazados'];
$$;

-- Proyección comparable de un renglón: sin economía (a cualquier profundidad), null = ausente, sin claves libres.
create or replace function private_api.partida_cotejable_emision(p jsonb)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case when jsonb_typeof(p) = 'object'
    then jsonb_strip_nulls(public.jsonb_sin_economia(p)) - private_api.claves_libres_emision_partida()
    else p end;
$$;

-- Claves de primer nivel (no económicas, no libres) en que el renglón del snapshot difiere de la fila.
-- Vacío = corresponde. Sólo devuelve NOMBRES de claves, nunca valores.
create or replace function private_api.campos_partida_no_corresponden(p_snap jsonb, p_db jsonb)
returns text[] language sql immutable set search_path to 'public' as $$
  with a as (select private_api.partida_cotejable_emision(p_snap) as s, private_api.partida_cotejable_emision(p_db) as d)
  select case
    when jsonb_typeof(a.s) is distinct from 'object' or jsonb_typeof(a.d) is distinct from 'object' then
      case when a.s is not distinct from a.d then '{}'::text[] else array['partida'] end
    else coalesce((
      select array_agg(ks.k order by ks.k)
      from (select jsonb_object_keys(a.s) as k union select jsonb_object_keys(a.d)) ks
      where (a.s -> ks.k) is distinct from (a.d -> ks.k)), '{}'::text[])
  end
  from a;
$$;

revoke all on function private_api.claves_libres_emision_partida() from public, anon, authenticated;
revoke all on function private_api.partida_cotejable_emision(jsonb) from public, anon, authenticated;
revoke all on function private_api.campos_partida_no_corresponden(jsonb, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
--  Gate: cuerpo de producción 2026-10-13 + bloque SEG-01 (ver encabezado). Misma firma, STABLE SECURITY DEFINER,
--  search_path 'public'. CREATE OR REPLACE conserva dueño y grants (authenticated, service_role).
-- ----------------------------------------------------------------------------
create or replace function private_api.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_email text := auth.jwt()->>'email';
  v_c public.cotizaciones%rowtype;
  v_reasons text[] := '{}';
  v_econ_reasons text[] := '{}';
  v_approval_reasons text[] := '{}';
  v_hash text;
  v_requires_approval boolean := false;
  v_approved boolean := false;
  v_count int; v_db_count int;
  v_pt jsonb; v_dbpt jsonb; v_ord bigint;
  v_qty numeric; v_price numeric; v_cost numeric;
  v_pid_txt text; v_pvid_txt text; v_pvid bigint; v_pid bigint; v_cost_ref numeric;
  v_snap_identity text; v_db_identity text;
  v_rules jsonb; v_min_margin numeric;
  v_margin numeric;
  v_prod_source text; v_pv_state text;
  v_special jsonb; v_special_cost_state text; v_special_commercial_state text;
  v_desc numeric; v_expected_price numeric;
  -- P0-01 reventa de catálogo sin costo interno:
  v_reventa_policy boolean := false; v_reventa boolean := false; v_rev_lista numeric; v_rev_piso numeric;
  -- SEG-01: campos no comerciales del renglón que no corresponden a la fila guardada.
  v_campos text[]; v_discrepancias jsonb := '{}'::jsonb;
begin
  if v_email is null or not public.puede_entrar() then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('no_autorizado'));
  end if;

  select * into v_c from public.cotizaciones where id=p_cotizacion_id;
  if not found then return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('cotizacion_no_existe')); end if;
  if not (v_c.usuario=v_email or public.puede_editar_config()) then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('sin_permiso'));
  end if;

  if p_snapshot is null or jsonb_typeof(coalesce(p_snapshot->'partidas','null'::jsonb)) <> 'array' then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('snapshot_sin_partidas'));
  end if;

  v_rules := public.reglas_comerciales_vigentes(current_date);
  begin v_min_margin := nullif(v_rules->>'margen_minimo_pct','')::numeric; exception when others then v_min_margin:=null; end;
  if v_min_margin is null then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('politica_comercial_sin_margen_minimo'));
  end if;
  begin v_reventa_policy := coalesce((v_rules->>'reventa_emite_sin_costo')::boolean, false); exception when others then v_reventa_policy := false; end;

  v_count := jsonb_array_length(p_snapshot->'partidas');
  v_db_count := jsonb_array_length(coalesce(v_c.partidas,'[]'::jsonb));
  if v_count=0 then v_reasons := array_append(v_reasons,'snapshot_sin_partidas'); end if;
  if v_count<>v_db_count then v_reasons := array_append(v_reasons,'partidas_no_corresponden_a_cotizacion'); end if;

  for v_pt, v_ord in select value, ordinality from jsonb_array_elements(p_snapshot->'partidas') with ordinality loop
    begin v_qty := nullif(v_pt->>'cantidad','')::numeric; exception when others then v_qty:=null; end;
    begin v_price := nullif(v_pt->>'precioUnitario','')::numeric; exception when others then v_price:=null; end;
    if v_qty is null or v_qty<=0 then v_reasons:=array_append(v_reasons,format('linea_%s_cantidad_invalida',v_ord)); end if;
    if v_price is null or v_price<=0 then v_reasons:=array_append(v_reasons,format('linea_%s_precio_invalido',v_ord)); end if;

    select value into v_dbpt from jsonb_array_elements(coalesce(v_c.partidas,'[]'::jsonb)) with ordinality d(value,ord) where ord=v_ord;
    if v_dbpt is null then v_reasons:=array_append(v_reasons,format('linea_%s_sin_correspondencia',v_ord)); continue; end if;

    v_snap_identity := coalesce(nullif(v_pt->>'id',''),nullif(v_pt->>'piezaId',''),nullif(v_pt->>'producto_id',''),nullif(v_pt->>'productoId',''),nullif(v_pt->>'nombre',''));
    v_db_identity := coalesce(nullif(v_dbpt->>'id',''),nullif(v_dbpt->>'piezaId',''),nullif(v_dbpt->>'producto_id',''),nullif(v_dbpt->>'productoId',''),nullif(v_dbpt->>'nombre',''));
    if v_snap_identity is null or v_db_identity is null or v_snap_identity<>v_db_identity then
      v_reasons:=array_append(v_reasons,format('linea_%s_identidad_no_coincide',v_ord)); continue;
    end if;

    -- SEG-01: la identidad (id/piezaId/producto_id/nombre) no basta. El renglón del snapshot debe ser
    -- la fila guardada en TODO lo no comercial (descripción, medidas, material, config, cantidad,
    -- producto_id, producto_version_id, procedencia…). Sólo pueden diferir el precio y el descuento del
    -- renglón; la economía de ambos lados se ignora (el costo SIEMPRE sale de la fila o del ProductVersion).
    -- Una cantidad distinta también bloquea: cambiarla es un guardado (actualizar_cotizacion_segura), que es
    -- donde se aplican las reglas de lote (VH-035c), nunca un snapshot sin guardar.
    v_campos := private_api.campos_partida_no_corresponden(v_pt, v_dbpt);
    if cardinality(v_campos)>0 then
      v_reasons:=array_append(v_reasons,format('linea_%s_no_corresponde_a_lo_costeado',v_ord));
      v_discrepancias:=v_discrepancias || jsonb_build_object(format('linea_%s',v_ord), to_jsonb(v_campos));
      continue;
    end if;

    v_pid_txt := coalesce(nullif(v_pt->>'producto_id',''),nullif(v_pt->>'productoId',''),nullif(v_pt->>'product_id',''));
    v_pvid_txt := coalesce(nullif(v_pt->>'producto_version_id',''),nullif(v_pt->>'productoVersionId',''),nullif(v_pt->>'product_version_id',''));
    v_cost_ref:=null; v_pvid:=null; v_pid:=null; v_cost:=null; v_prod_source:=null; v_pv_state:=null; v_special:=null;
    v_reventa:=false; v_rev_lista:=null; v_rev_piso:=null;

    -- Dos mundos explícitos:
    -- 1) canónico: producto_id y producto_version_id numéricos;
    -- 2) legacy: clave textual sin ProductVersion, cuyo costo histórico se toma SOLO de la fila persistida.
    if v_pid_txt is not null then
      if v_pid_txt ~ '^[0-9]+$' then
        v_pid:=v_pid_txt::bigint;
      elsif v_pvid_txt is not null then
        v_reasons:=array_append(v_reasons,format('linea_%s_producto_id_invalido',v_ord));
      end if;
    end if;

    if v_pvid_txt is not null then
      if v_pvid_txt ~ '^[0-9]+$' then
        v_pvid:=v_pvid_txt::bigint;
      else
        v_reasons:=array_append(v_reasons,format('linea_%s_producto_version_id_invalido',v_ord));
      end if;
    end if;

    if v_pid is not null and v_pvid is null then
      v_reasons:=array_append(v_reasons,format('linea_%s_sin_product_version_id',v_ord));
    elsif v_pid is null and v_pvid is not null then
      v_reasons:=array_append(v_reasons,format('linea_%s_sin_product_id',v_ord));
    end if;

    if v_pid is not null and v_pvid is not null then
      select p.source_type,pv.estado_tecnico,e.costo_oficial_referencia
        into v_prod_source,v_pv_state,v_cost_ref
      from public.productos p
      join public.producto_versiones pv on pv.producto_id=p.id and pv.id=v_pvid
      left join public.producto_version_economia e on e.producto_version_id=pv.id
      where p.id=v_pid;
      if not found then
        v_reasons:=array_append(v_reasons,format('linea_%s_product_version_no_corresponde',v_ord));
      elsif v_prod_source='expediente' then
        v_special := public.resolver_precio_especial_proyecto(v_pid,v_pvid,current_date,coalesce(nullif(v_pt->>'moneda',''),'MXN'));
        if not coalesce((v_special->>'ok')::boolean,false) then
          if v_special->>'motivo'='ECONOMICS_INCOMPLETE' then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_especial_desconocido',v_ord));
          else
            v_reasons:=array_append(v_reasons,format('linea_%s_especial_%s',v_ord,coalesce(v_special->>'motivo','invalido')));
          end if;
        else
          v_special_cost_state:=v_special->>'economia_estado';
          v_special_commercial_state:=v_special->>'commercial_state';
          begin v_cost:=nullif(v_special->>'costo_interno','')::numeric; exception when others then v_cost:=null; end;
          if v_special_commercial_state='PRELIMINARY_SPECIAL' then
            v_reasons:=array_append(v_reasons,format('linea_%s_ingenieria_preliminar',v_ord));
          end if;
          if v_special_cost_state in ('ESTIMATED','USER_APPROVED_ESTIMATE') then
            v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_costo_especial_no_certificado',v_ord));
          elsif v_special_cost_state is null or v_special_cost_state='ECONOMICS_INCOMPLETE' then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_especial_desconocido',v_ord));
          end if;

          begin v_desc:=coalesce(nullif(v_pt->>'descuento',''),nullif(v_pt->>'descuento_solicitado',''),'0')::numeric; exception when others then v_desc:=null; end;
          if v_desc is null or v_desc<0 or v_desc>100 then
            v_reasons:=array_append(v_reasons,format('linea_%s_descuento_invalido',v_ord));
          elsif v_price is not null and v_price>0 then
            v_expected_price:=round((v_special->>'precio_lista')::numeric*(1-v_desc/100),2);
            if round(v_price,2)<>v_expected_price then
              v_reasons:=array_append(v_reasons,format('linea_%s_precio_especial_no_autoritativo',v_ord));
            end if;
          end if;
        end if;
      else
        if v_cost_ref is not null and v_cost_ref>0 then
          v_cost:=v_cost_ref;
        elsif v_reventa_policy and v_prod_source in ('banco','linea') then
          -- P0-01: reventa de catálogo SIN costo interno (política de Dirección, reversible).
          -- Precio del pricebook; piso = tope duro; margen NO calculado. No inventa costo.
          select lpi.precio_lista, lpi.piso_minimo into v_rev_lista, v_rev_piso
            from public.lista_precio_items lpi
           where lpi.producto_id = v_pid and lpi.vigencia_hasta is null
           order by lpi.precio_lista desc nulls last limit 1;
          if v_rev_lista is null or v_rev_lista<=0 then
            -- Ni costo ni precio de lista vigente: no hay con qué emitir ⇒ sigue incompleto.
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord));
          else
            if v_rev_piso is not null and v_rev_piso>0 and v_price is not null and v_price>0 and v_price<v_rev_piso then
              v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_precio_bajo_piso',v_ord));
            end if;
            v_reventa:=true;
          end if;
        else
          v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord));
        end if;
      end if;
    else
      -- Sólo legacy sin ProductVersion: nunca se confía en el costo del snapshot recibido;
      -- se usa exclusivamente el costo histórico persistido en la cotización.
      begin v_cost:=nullif(v_dbpt->>'costoUnitario','')::numeric; exception when others then v_cost:=null; end;

      -- Las líneas nuevas del Costeador guardan el veredicto del servidor. Un costo
      -- PRELIMINAR puede vivir en borrador, pero no convertirse en emisión definitiva.
      -- Las cotizaciones legacy que no traen costoEstado conservan su tratamiento histórico.
      if lower(coalesce(v_dbpt->>'costoEstado','')) = 'preliminar' then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_preliminar_no_certificado',v_ord));
      elsif lower(coalesce(v_dbpt->>'costoEstado','')) in ('incompleto','bloqueado') then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_no_certificado',v_ord));
      end if;
    end if;

    if v_reventa then
      -- Reventa sin costo interno: el piso ya actuó arriba; no hay margen que validar.
      null;
    elsif v_cost is null or v_cost<=0 then
      if not (v_pid is not null and cardinality(v_econ_reasons)>0) then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_desconocido',v_ord));
      end if;
    elsif v_price is not null and v_price>0 then
      v_margin := ((v_price-v_cost)/v_price)*100;
      if v_price < v_cost then
        v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_precio_bajo_costo',v_ord));
      elsif v_margin < v_min_margin then
        v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_margen_bajo_%s',v_ord,trim(to_char(v_min_margin,'FM999990D99'))));
      end if;
    end if;
  end loop;

  select coalesce(array_agg(distinct x),'{}'::text[]) into v_reasons from unnest(v_reasons) x;
  select coalesce(array_agg(distinct x),'{}'::text[]) into v_econ_reasons from unnest(v_econ_reasons) x;
  select coalesce(array_agg(distinct x),'{}'::text[]) into v_approval_reasons from unnest(v_approval_reasons) x;

  v_hash := public.hash_revision(p_snapshot);
  v_requires_approval := public.requiere_aprobacion_snapshot(p_snapshot) or cardinality(v_approval_reasons)>0;
  if v_requires_approval then
    v_approved := coalesce((public.verificar_aprobacion(p_cotizacion_id,v_hash)->>'aprobada')::boolean,false);
  else v_approved:=true; end if;

  if cardinality(v_reasons)>0 then
    return jsonb_build_object('state','BLOCKED','reasons',to_jsonb(v_reasons),'discrepancias',v_discrepancias,'economics',to_jsonb(v_econ_reasons),'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
  end if;
  if cardinality(v_econ_reasons)>0 then
    return jsonb_build_object('state','ECONOMICS_INCOMPLETE','reasons',to_jsonb(v_econ_reasons),'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
  end if;
  if not v_approved then
    return jsonb_build_object('state','APPROVAL_REQUIRED','reasons',case when cardinality(v_approval_reasons)>0 then to_jsonb(v_approval_reasons) else jsonb_build_array('aprobacion_requerida_para_hash') end,'hash',v_hash,'approval_required',true,'approved',false,'margen_minimo_pct',v_min_margin);
  end if;
  return jsonb_build_object('state','ALLOWED','reasons','[]'::jsonb,'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
end;
$function$;
-- Postcondición: firma y atributos intactos; la corrección está en el cuerpo.
do $$
declare r record;
begin
  select p.provolatile, p.prosecdef, p.prosrc into r
  from pg_proc p where p.oid = 'private_api.evaluar_emision_cotizacion(bigint, jsonb)'::regprocedure;
  if r.provolatile <> 's' or not r.prosecdef or position('campos_partida_no_corresponden' in r.prosrc) = 0
     or position('v_reventa_policy' in r.prosrc) = 0 then
    raise exception 'SEG-01: el gate no quedó como se esperaba (volatilidad %, definer %)', r.provolatile, r.prosecdef;
  end if;
end $$;

commit;

-- ============================================================================
--  ROLLBACK (si se aplicó y hay que volver a producción tal cual 2026-10-17, con P0-01). No se ejecuta con este archivo:
--  está dentro de un comentario de bloque. Para revertir: copiar lo que hay entre los marcadores y correrlo.
--    1) private_api.evaluar_emision_cotizacion vuelve al cuerpo de producción BYTE A BYTE: el gate VIVO de P0-01
--       (supabase/tests/fixtures/private_api_emision_prod_20261017.sql; md5 17ec67cf8bf06b540a55279288e90025).
--       rev1 devolvía el del 13-oct (9c660b09…) y con eso borraba la reventa de P0-01.
--    2) Borra las 3 ayudas (después de 1: ya nadie las llama).
--    3) Datos: nada que revertir (no se escribe ninguna fila).
--  No toca el wrapper public.evaluar_emision_cotizacion: si VH-035c está aplicada, su wrapper sigue igual.
-- ============================================================================
/*
-- >>> ROLLBACK SEG-01 INICIO
begin;

CREATE OR REPLACE FUNCTION private_api.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_c public.cotizaciones%rowtype;
  v_reasons text[] := '{}';
  v_econ_reasons text[] := '{}';
  v_approval_reasons text[] := '{}';
  v_hash text;
  v_requires_approval boolean := false;
  v_approved boolean := false;
  v_count int; v_db_count int;
  v_pt jsonb; v_dbpt jsonb; v_ord bigint;
  v_qty numeric; v_price numeric; v_cost numeric;
  v_pid_txt text; v_pvid_txt text; v_pvid bigint; v_pid bigint; v_cost_ref numeric;
  v_snap_identity text; v_db_identity text;
  v_rules jsonb; v_min_margin numeric;
  v_margin numeric;
  v_prod_source text; v_pv_state text;
  v_special jsonb; v_special_cost_state text; v_special_commercial_state text;
  v_desc numeric; v_expected_price numeric;
  v_reventa_policy boolean := false; v_reventa boolean := false; v_rev_lista numeric; v_rev_piso numeric;
begin
  if v_email is null or not public.puede_entrar() then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('no_autorizado'));
  end if;

  select * into v_c from public.cotizaciones where id=p_cotizacion_id;
  if not found then return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('cotizacion_no_existe')); end if;
  if not (v_c.usuario=v_email or public.puede_editar_config()) then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('sin_permiso'));
  end if;

  if p_snapshot is null or jsonb_typeof(coalesce(p_snapshot->'partidas','null'::jsonb)) <> 'array' then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('snapshot_sin_partidas'));
  end if;

  v_rules := public.reglas_comerciales_vigentes(current_date);
  begin v_min_margin := nullif(v_rules->>'margen_minimo_pct','')::numeric; exception when others then v_min_margin:=null; end;
  if v_min_margin is null then
    return jsonb_build_object('state','BLOCKED','reasons',jsonb_build_array('politica_comercial_sin_margen_minimo'));
  end if;
  begin v_reventa_policy := coalesce((v_rules->>'reventa_emite_sin_costo')::boolean, false); exception when others then v_reventa_policy := false; end;

  v_count := jsonb_array_length(p_snapshot->'partidas');
  v_db_count := jsonb_array_length(coalesce(v_c.partidas,'[]'::jsonb));
  if v_count=0 then v_reasons := array_append(v_reasons,'snapshot_sin_partidas'); end if;
  if v_count<>v_db_count then v_reasons := array_append(v_reasons,'partidas_no_corresponden_a_cotizacion'); end if;

  for v_pt, v_ord in select value, ordinality from jsonb_array_elements(p_snapshot->'partidas') with ordinality loop
    begin v_qty := nullif(v_pt->>'cantidad','')::numeric; exception when others then v_qty:=null; end;
    begin v_price := nullif(v_pt->>'precioUnitario','')::numeric; exception when others then v_price:=null; end;
    if v_qty is null or v_qty<=0 then v_reasons:=array_append(v_reasons,format('linea_%s_cantidad_invalida',v_ord)); end if;
    if v_price is null or v_price<=0 then v_reasons:=array_append(v_reasons,format('linea_%s_precio_invalido',v_ord)); end if;

    select value into v_dbpt from jsonb_array_elements(coalesce(v_c.partidas,'[]'::jsonb)) with ordinality d(value,ord) where ord=v_ord;
    if v_dbpt is null then v_reasons:=array_append(v_reasons,format('linea_%s_sin_correspondencia',v_ord)); continue; end if;

    v_snap_identity := coalesce(nullif(v_pt->>'id',''),nullif(v_pt->>'piezaId',''),nullif(v_pt->>'producto_id',''),nullif(v_pt->>'productoId',''),nullif(v_pt->>'nombre',''));
    v_db_identity := coalesce(nullif(v_dbpt->>'id',''),nullif(v_dbpt->>'piezaId',''),nullif(v_dbpt->>'producto_id',''),nullif(v_dbpt->>'productoId',''),nullif(v_dbpt->>'nombre',''));
    if v_snap_identity is null or v_db_identity is null or v_snap_identity<>v_db_identity then
      v_reasons:=array_append(v_reasons,format('linea_%s_identidad_no_coincide',v_ord)); continue;
    end if;

    v_pid_txt := coalesce(nullif(v_pt->>'producto_id',''),nullif(v_pt->>'productoId',''),nullif(v_pt->>'product_id',''));
    v_pvid_txt := coalesce(nullif(v_pt->>'producto_version_id',''),nullif(v_pt->>'productoVersionId',''),nullif(v_pt->>'product_version_id',''));
    v_cost_ref:=null; v_pvid:=null; v_pid:=null; v_cost:=null; v_prod_source:=null; v_pv_state:=null; v_special:=null;
    v_reventa:=false; v_rev_lista:=null; v_rev_piso:=null;

    if v_pid_txt is not null then
      if v_pid_txt ~ '^[0-9]+$' then
        v_pid:=v_pid_txt::bigint;
      elsif v_pvid_txt is not null then
        v_reasons:=array_append(v_reasons,format('linea_%s_producto_id_invalido',v_ord));
      end if;
    end if;

    if v_pvid_txt is not null then
      if v_pvid_txt ~ '^[0-9]+$' then
        v_pvid:=v_pvid_txt::bigint;
      else
        v_reasons:=array_append(v_reasons,format('linea_%s_producto_version_id_invalido',v_ord));
      end if;
    end if;

    if v_pid is not null and v_pvid is null then
      v_reasons:=array_append(v_reasons,format('linea_%s_sin_product_version_id',v_ord));
    elsif v_pid is null and v_pvid is not null then
      v_reasons:=array_append(v_reasons,format('linea_%s_sin_product_id',v_ord));
    end if;

    if v_pid is not null and v_pvid is not null then
      select p.source_type,pv.estado_tecnico,e.costo_oficial_referencia
        into v_prod_source,v_pv_state,v_cost_ref
      from public.productos p
      join public.producto_versiones pv on pv.producto_id=p.id and pv.id=v_pvid
      left join public.producto_version_economia e on e.producto_version_id=pv.id
      where p.id=v_pid;
      if not found then
        v_reasons:=array_append(v_reasons,format('linea_%s_product_version_no_corresponde',v_ord));
      elsif v_prod_source='expediente' then
        v_special := public.resolver_precio_especial_proyecto(v_pid,v_pvid,current_date,coalesce(nullif(v_pt->>'moneda',''),'MXN'));
        if not coalesce((v_special->>'ok')::boolean,false) then
          if v_special->>'motivo'='ECONOMICS_INCOMPLETE' then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_especial_desconocido',v_ord));
          else
            v_reasons:=array_append(v_reasons,format('linea_%s_especial_%s',v_ord,coalesce(v_special->>'motivo','invalido')));
          end if;
        else
          v_special_cost_state:=v_special->>'economia_estado';
          v_special_commercial_state:=v_special->>'commercial_state';
          begin v_cost:=nullif(v_special->>'costo_interno','')::numeric; exception when others then v_cost:=null; end;
          if v_special_commercial_state='PRELIMINARY_SPECIAL' then
            v_reasons:=array_append(v_reasons,format('linea_%s_ingenieria_preliminar',v_ord));
          end if;
          if v_special_cost_state in ('ESTIMATED','USER_APPROVED_ESTIMATE') then
            v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_costo_especial_no_certificado',v_ord));
          elsif v_special_cost_state is null or v_special_cost_state='ECONOMICS_INCOMPLETE' then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_especial_desconocido',v_ord));
          end if;

          begin v_desc:=coalesce(nullif(v_pt->>'descuento',''),nullif(v_pt->>'descuento_solicitado',''),'0')::numeric; exception when others then v_desc:=null; end;
          if v_desc is null or v_desc<0 or v_desc>100 then
            v_reasons:=array_append(v_reasons,format('linea_%s_descuento_invalido',v_ord));
          elsif v_price is not null and v_price>0 then
            v_expected_price:=round((v_special->>'precio_lista')::numeric*(1-v_desc/100),2);
            if round(v_price,2)<>v_expected_price then
              v_reasons:=array_append(v_reasons,format('linea_%s_precio_especial_no_autoritativo',v_ord));
            end if;
          end if;
        end if;
      else
        if v_cost_ref is not null and v_cost_ref>0 then
          v_cost:=v_cost_ref;
        elsif v_reventa_policy and v_prod_source in ('banco','linea') then
          select lpi.precio_lista, lpi.piso_minimo into v_rev_lista, v_rev_piso
            from public.lista_precio_items lpi
           where lpi.producto_id = v_pid and lpi.vigencia_hasta is null
           order by lpi.precio_lista desc nulls last limit 1;
          if v_rev_lista is null or v_rev_lista<=0 then
            v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord));
          else
            if v_rev_piso is not null and v_rev_piso>0 and v_price is not null and v_price>0 and v_price<v_rev_piso then
              v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_precio_bajo_piso',v_ord));
            end if;
            v_reventa:=true;
          end if;
        else
          v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_productversion_desconocido',v_ord));
        end if;
      end if;
    else
      begin v_cost:=nullif(v_dbpt->>'costoUnitario','')::numeric; exception when others then v_cost:=null; end;

      if lower(coalesce(v_dbpt->>'costoEstado','')) = 'preliminar' then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_preliminar_no_certificado',v_ord));
      elsif lower(coalesce(v_dbpt->>'costoEstado','')) in ('incompleto','bloqueado') then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_no_certificado',v_ord));
      end if;
    end if;

    if v_reventa then
      null;
    elsif v_cost is null or v_cost<=0 then
      if not (v_pid is not null and cardinality(v_econ_reasons)>0) then
        v_econ_reasons:=array_append(v_econ_reasons,format('linea_%s_costo_desconocido',v_ord));
      end if;
    elsif v_price is not null and v_price>0 then
      v_margin := ((v_price-v_cost)/v_price)*100;
      if v_price < v_cost then
        v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_precio_bajo_costo',v_ord));
      elsif v_margin < v_min_margin then
        v_approval_reasons:=array_append(v_approval_reasons,format('linea_%s_margen_bajo_%s',v_ord,trim(to_char(v_min_margin,'FM999990D99'))));
      end if;
    end if;
  end loop;

  select coalesce(array_agg(distinct x),'{}'::text[]) into v_reasons from unnest(v_reasons) x;
  select coalesce(array_agg(distinct x),'{}'::text[]) into v_econ_reasons from unnest(v_econ_reasons) x;
  select coalesce(array_agg(distinct x),'{}'::text[]) into v_approval_reasons from unnest(v_approval_reasons) x;

  v_hash := public.hash_revision(p_snapshot);
  v_requires_approval := public.requiere_aprobacion_snapshot(p_snapshot) or cardinality(v_approval_reasons)>0;
  if v_requires_approval then
    v_approved := coalesce((public.verificar_aprobacion(p_cotizacion_id,v_hash)->>'aprobada')::boolean,false);
  else v_approved:=true; end if;

  if cardinality(v_reasons)>0 then
    return jsonb_build_object('state','BLOCKED','reasons',to_jsonb(v_reasons),'economics',to_jsonb(v_econ_reasons),'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
  end if;
  if cardinality(v_econ_reasons)>0 then
    return jsonb_build_object('state','ECONOMICS_INCOMPLETE','reasons',to_jsonb(v_econ_reasons),'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
  end if;
  if not v_approved then
    return jsonb_build_object('state','APPROVAL_REQUIRED','reasons',case when cardinality(v_approval_reasons)>0 then to_jsonb(v_approval_reasons) else jsonb_build_array('aprobacion_requerida_para_hash') end,'hash',v_hash,'approval_required',true,'approved',false,'margen_minimo_pct',v_min_margin);
  end if;
  return jsonb_build_object('state','ALLOWED','reasons','[]'::jsonb,'approval_reasons',to_jsonb(v_approval_reasons),'hash',v_hash,'approval_required',v_requires_approval,'approved',v_approved,'margen_minimo_pct',v_min_margin);
end;
$function$;
drop function if exists private_api.campos_partida_no_corresponden(jsonb, jsonb);
drop function if exists private_api.partida_cotejable_emision(jsonb);
drop function if exists private_api.claves_libres_emision_partida();

commit;
-- <<< ROLLBACK SEG-01 FIN
*/
