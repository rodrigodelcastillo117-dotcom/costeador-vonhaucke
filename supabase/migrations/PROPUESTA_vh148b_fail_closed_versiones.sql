-- ============================================================================
--  PROPUESTA · VH-148b · CONTROL OPTIMISTA FAIL-CLOSED (cotizaciones, expedientes y sus revisiones,
--  ProductRevision / producto_versiones).
--  ⚠️ NO APLICAR sin autorización de Dirección (prefijo PROPUESTA_: no entra en `db push`).
--  Se aplica DESPUÉS de PROPUESTA_vh148_control_optimista_cotizacion.sql (precondición verificada abajo).
--  Diseño, orden de aplicación y evidencia: docs/auditoria/VH148_FAIL_CLOSED_20261014.md
--  Pruebas (PGlite, SQL de producción): supabase/tests/vh148FailClosed.test.js
--
--  HUECOS QUE CIERRA (medidos en producción el 14-oct-2026, sólo lectura):
--   H1. `actualizar_cotizacion_segura(id, patch, NULL)` saltaba el control (NULL = "sin control").
--       Ahora NULL ⇒ SQLSTATE 22004 'VERSION_REQUIRED'. La firma de DOS argumentos SIGUE EXISTIENDO:
--       el cliente de producción (c3.4-seller-safe @ c8dd2b3) la usa. Su retiro es el PASO 2
--       (PROPUESTA_vh148c_retira_escrituras_sin_version.sql), sólo después de desplegar el cliente nuevo.
--   H2. Ningún trigger subía `actualizado`: un UPDATE directo (PostgREST) o de otra RPC dejaba la versión
--       igual y el control de VH-148 no lo veía. Ahora trg_vh148_version (BEFORE INSERT OR UPDATE) fija
--       `actualizado` en TODA escritura de cotizaciones y expedientes, estrictamente creciente
--       (greatest(clock_timestamp(), anterior + 1 µs)): ni dos escrituras en la misma transacción ni un
--       reloj que retrocede dejan la misma versión.
--   H3. `cotizaciones_actualiza` + GRANT UPDATE dejaban a `authenticated` escribir partidas/acomodo/totales
--       por PostgREST sin versión. El cliente (actual y el de producción) sólo escribe DIRECTO la columna
--       `activa` (archivarCotizacion). Ahora: UPDATE de tabla revocado y UPDATE(activa) concedido. Todo lo
--       demás pasa por las RPC (SECURITY DEFINER, no afectadas). El archivado también sube la versión (H2).
--   H4. expedientes: el cliente hace UPDATE directo con `revision: revActual + 1` y luego INSERT en
--       expediente_revisiones, tragándose el 23505 del índice único (expediente_id, rev). Dos editores en la
--       misma revisión: el segundo pisaba al primero y el historial quedaba con el snapshot del primero.
--       Ahora:
--        · trg_vh148_revision_cas: para escrituras DIRECTAS (current_user = 'authenticated') exige
--          NEW.revision = OLD.revision + 1 (compare-and-swap con el mismo dato que ya manda el cliente de
--          producción): el segundo recibe 40001 'CONFLICTO_VERSION' y no escribe nada. Las RPC SECURITY
--          DEFINER (guardar_cocrear_seguro, registrar_producto_desde_expediente…) no pasan por esta regla.
--        · RPC actualizar_expediente_seguro(id, patch, p_revision_esperada): candado, compara, actualiza,
--          sube la revisión y escribe el snapshot inmutable EN LA MISMA TRANSACCIÓN. NULL ⇒ VERSION_REQUIRED.
--        · guardar_cocrear_seguro(id, payload, p_revision_esperada): sobrecarga de TRES argumentos sin
--          DEFAULT que compara la revisión y delega en el núcleo de dos argumentos (sin copiarlo).
--   H5. producto_versiones: guard_producto_version sólo protegía 4 columnas de una versión CERTIFICADA y
--       permitía bajarla a 'preliminar' y luego editarla (dos UPDATE). Una versión 'aprobado' era editable
--       en sitio. Ahora una versión PUBLICADA (aprobado/certificado) no se edita en sitio ni se degrada;
--       sólo se permite promoverla (aprobado → certificado, con su bom_hash) y fijar un pin que estaba
--       vacío. SQLSTATE 55000 'VERSION_PUBLICADA_INMUTABLE'. Escape explícito para mantenimiento
--       (mismo patrón que vh.permitir_borrado_certificado): set_config('vh.permitir_edicion_version_publicada','on', true).
--
--  QUÉ NO TOCA: el núcleo private_api.actualizar_cotizacion_segura(bigint, jsonb) (dueño: producción o
--  VH-035c), private_api.guardar_cocrear_seguro(bigint, jsonb), los cuatro triggers de cotizaciones, la
--  emisión (SEG-01/SEG-01b) ni políticas RLS. ⇒ Compone con VH-035c, SEG-01 y SEG-01b en cualquier orden
--  respecto a ellas (probado en vh148FailClosed.test.js).
--
--  Rollback: líneas `-- RB ` al final (quitar el prefijo y correr). Restaura byte a byte (md5 de
--  pg_get_functiondef) la sobrecarga de VH-148 y guard_producto_version de producción, y los privilegios.
-- ============================================================================

begin;

-- Precondiciones: VH-148 aplicada (la sobrecarga de tres argumentos existe y se va a endurecer) y los
-- objetos de producción que esta propuesta envuelve.
do $$
begin
  if to_regprocedure('private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)') is null then
    raise exception 'VH-148b: aplica antes PROPUESTA_vh148_control_optimista_cotizacion.sql';
  end if;
  if to_regprocedure('private_api.guardar_cocrear_seguro(bigint, jsonb)') is null then
    raise exception 'VH-148b: falta private_api.guardar_cocrear_seguro(bigint, jsonb) (núcleo de cocrear)';
  end if;
  if to_regprocedure('public.guard_producto_version()') is null then
    raise exception 'VH-148b: falta public.guard_producto_version()';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- H2) La versión la escribe el SERVIDOR en toda escritura (cotizaciones y expedientes).
--     Nombre `trg_vh148_*`: los BEFORE triggers corren en orden alfabético ⇒ después de
--     trg_strip_seller_economics; nadie lo pisa.
-- ----------------------------------------------------------------------------
create or replace function private_api.vh148_sube_version()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if TG_OP = 'INSERT' then
    NEW.actualizado := clock_timestamp();
  else
    NEW.actualizado := greatest(clock_timestamp(), OLD.actualizado + interval '1 microsecond');
  end if;
  return NEW;
end
$function$;
revoke all on function private_api.vh148_sube_version() from public;

drop trigger if exists trg_vh148_version on public.cotizaciones;
create trigger trg_vh148_version before insert or update on public.cotizaciones
  for each row execute function private_api.vh148_sube_version();
drop trigger if exists trg_vh148_version on public.expedientes;
create trigger trg_vh148_version before insert or update on public.expedientes
  for each row execute function private_api.vh148_sube_version();

-- ----------------------------------------------------------------------------
-- H1) La sobrecarga de TRES argumentos de VH-148 deja de aceptar NULL como "sin control".
--     Mismo cuerpo de VH-148 salvo la primera rama.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb, p_actualizado_esperado timestamptz)
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
  -- VH-148b · FAIL-CLOSED: quien usa la firma con versión DEBE mandarla. NULL ya no es "sin control".
  if p_actualizado_esperado is null then
    raise exception 'VERSION_REQUIRED: falta p_actualizado_esperado (la versión desde la que editas)'
      using errcode = '22004',
            hint = 'Lee la cotización (cotizacion_segura) y manda su `actualizado` tal cual.';
  end if;

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
  if v_role is null or v_role not in ('direccion','diseno','vendedor') then
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

  if v_c.actualizado is distinct from p_actualizado_esperado then
    v_actualizado_iso := to_json(v_c.actualizado)#>>'{}';
    raise exception 'CONFLICTO_VERSION: la cotización cambió en el servidor (%). Recarga antes de guardar.', v_actualizado_iso
      using errcode = '40001',
            detail = 'actualizado=' || v_actualizado_iso,
            hint = 'Vuelve a cargar la cotización (cotizacion_segura) y decide: ver la versión del servidor o volver a aplicar tus cambios con el actualizado nuevo.';
  end if;

  return private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch);
end;
$function$
;

-- ----------------------------------------------------------------------------
-- H3) UPDATE directo de cotizaciones: sólo `activa` (archivar). REVOKE de tabla quita también los
--     privilegios de columna previos (se documenta la consulta previa en el doc de auditoría).
-- ----------------------------------------------------------------------------
revoke update on table public.cotizaciones from authenticated;
grant update (activa) on table public.cotizaciones to authenticated;

-- ----------------------------------------------------------------------------
-- H4a) expedientes: compare-and-swap de `revision` en escrituras DIRECTAS.
--      El cliente de producción ya manda `revision: revActual + 1`; si otra persona ya subió la revisión,
--      OLD.revision + 1 ≠ NEW.revision ⇒ 40001 y no se escribe nada.
-- ----------------------------------------------------------------------------
create or replace function private_api.vh148_guard_revision_expediente()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if current_user = 'authenticated' and NEW.revision is distinct from OLD.revision + 1 then
    raise exception 'CONFLICTO_VERSION: el expediente % ya está en la revisión % (se intentó escribir la %)', OLD.id, OLD.revision, NEW.revision
      using errcode = '40001',
            detail = 'revision=' || OLD.revision,
            hint = 'Recarga el expediente o compara antes de guardar.';
  end if;
  return NEW;
end
$function$;
revoke all on function private_api.vh148_guard_revision_expediente() from public;

drop trigger if exists trg_vh148_revision_cas on public.expedientes;
create trigger trg_vh148_revision_cas before update on public.expedientes
  for each row execute function private_api.vh148_guard_revision_expediente();

-- ----------------------------------------------------------------------------
-- H4b) RPC actualizar_expediente_seguro: la edición del equipo de diseño con revisión esperada.
--      Mismo permiso que la política exp_write_update (rol direccion/diseno). Sólo columnas de contenido;
--      `revision`, `actualizado*`, `creado*`, `producto_*` y `cocrear` NO se aceptan en el patch.
--      El snapshot inmutable (expediente_revisiones) se escribe en la MISMA transacción, con la fila ya
--      actualizada: no hay ventana entre "subí la revisión" y "guardé su snapshot".
-- ----------------------------------------------------------------------------
create or replace function private_api.actualizar_expediente_seguro(p_expediente_id bigint, p_patch jsonb, p_revision_esperada integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text := auth.jwt()->>'email';
  v_role text;
  v_extra text;
  e public.expedientes%rowtype;
  n public.expedientes%rowtype;
begin
  if v_email is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select lower(p.rol) into v_role from public.permitidos p where lower(p.email)=lower(v_email) limit 1;
  if v_role is null or v_role not in ('direccion','diseno') then raise exception 'rol sin permiso'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'patch invalido'; end if;
  select string_agg(k, ', ' order by k) into v_extra
    from jsonb_object_keys(p_patch) k
   where k <> all (array['nombre','etiquetas','estado','producto_tipo','ancho_mm','fondo_mm','alto_mm','descripcion',
                         'materiales','bom','costo','confirmaciones','plano_urls','render_aislado_url',
                         'render_ambiente_url','analysis_hash']);
  if v_extra is not null then
    raise exception 'campos no editables en expediente: %', v_extra using errcode = '22023';
  end if;
  if p_revision_esperada is null then
    raise exception 'VERSION_REQUIRED: falta p_revision_esperada (la revisión desde la que editas)'
      using errcode = '22004', hint = 'Lee el expediente y manda su `revision` tal cual.';
  end if;

  select * into e from public.expedientes where id=p_expediente_id for update;
  if not found then raise exception 'expediente no existe'; end if;
  if e.revision is distinct from p_revision_esperada then
    raise exception 'CONFLICTO_VERSION: el expediente cambió en el servidor (revisión %)', e.revision
      using errcode = '40001',
            detail = 'revision=' || e.revision,
            hint = 'Recarga el expediente o compara antes de guardar.';
  end if;

  n := jsonb_populate_record(e, p_patch);
  update public.expedientes set
    nombre = n.nombre, etiquetas = coalesce(n.etiquetas, '{}'), estado = n.estado, producto_tipo = n.producto_tipo,
    ancho_mm = n.ancho_mm, fondo_mm = n.fondo_mm, alto_mm = n.alto_mm, descripcion = n.descripcion,
    materiales = coalesce(n.materiales, '{}'), bom = n.bom, costo = n.costo, confirmaciones = n.confirmaciones,
    plano_urls = coalesce(n.plano_urls, '{}'), render_aislado_url = n.render_aislado_url,
    render_ambiente_url = n.render_ambiente_url, analysis_hash = n.analysis_hash,
    revision = e.revision + 1, actualizado_por = v_email
  where id = e.id
  returning * into n;

  -- Si ya existe ese número de revisión (índice único expediente_id, rev) el INSERT lanza 23505 y la
  -- transacción completa se revierte: el cliente lo recibe como conflicto, nunca como "guardado".
  insert into public.expediente_revisiones(
    expediente_id, rev, creado_por, nombre, bom, costo, confirmaciones, materiales, plano_urls,
    render_aislado_url, render_ambiente_url, analysis_hash, cocrear, producto_id, producto_version_id
  ) values (
    n.id, n.revision, v_email, n.nombre, n.bom, n.costo, n.confirmaciones, n.materiales, n.plano_urls,
    n.render_aislado_url, n.render_ambiente_url, n.analysis_hash, n.cocrear, n.producto_id, null
  );

  return jsonb_build_object('ok', true, 'id', n.id, 'revision', n.revision, 'actualizado', n.actualizado, 'revision_registrada', true);
end
$function$;
revoke all on function private_api.actualizar_expediente_seguro(bigint, jsonb, integer) from public, anon;
grant execute on function private_api.actualizar_expediente_seguro(bigint, jsonb, integer) to authenticated, service_role;

create or replace function public.actualizar_expediente_seguro(p_expediente_id bigint, p_patch jsonb, p_revision_esperada integer)
 returns jsonb
 language plpgsql
 set search_path to 'pg_catalog', 'public', 'private_api'
as $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.actualizar_expediente_seguro(p_expediente_id, p_patch, p_revision_esperada);
      end
      $function$;
revoke all on function public.actualizar_expediente_seguro(bigint, jsonb, integer) from public, anon;
grant execute on function public.actualizar_expediente_seguro(bigint, jsonb, integer) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- H4c) guardar_cocrear_seguro con revisión esperada. Sobrecarga SIN DEFAULT (como VH-148): la llamada de
--      dos argumentos sólo casa con el núcleo y la de tres sólo con ésta. Crear (id NULL) no tiene versión
--      previa y delega directo. Compuertas en el mismo orden que el núcleo antes de revelar la revisión.
-- ----------------------------------------------------------------------------
create or replace function private_api.guardar_cocrear_seguro(p_expediente_id bigint, p_payload jsonb, p_revision_esperada integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text := auth.jwt()->>'email';
  v_role text;
  e public.expedientes%rowtype;
begin
  if p_expediente_id is null then
    return private_api.guardar_cocrear_seguro(null::bigint, p_payload);
  end if;
  if v_email is null or not public.puede_entrar() then raise exception 'no autorizado'; end if;
  select lower(p.rol) into v_role from public.permitidos p where lower(p.email)=lower(v_email) limit 1;
  if v_role is null or v_role not in ('direccion','diseno','vendedor') then raise exception 'rol sin permiso para cocrear'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload cocrear inválido'; end if;
  select * into e from public.expedientes where id=p_expediente_id for update;
  if not found then raise exception 'expediente no existe'; end if;
  if not (public.puede_editar_config() or lower(coalesce(e.creado_por,''))=lower(v_email)) then
    raise exception 'sin permiso sobre cocreación';
  end if;
  if p_revision_esperada is null then
    raise exception 'VERSION_REQUIRED: falta p_revision_esperada (la revisión desde la que editas)'
      using errcode = '22004', hint = 'Carga la cocreación (cocrear_seguro) y manda su `revision` tal cual.';
  end if;
  if e.revision is distinct from p_revision_esperada then
    raise exception 'CONFLICTO_VERSION: la cocreación cambió en el servidor (revisión %)', e.revision
      using errcode = '40001',
            detail = 'revision=' || e.revision,
            hint = 'Recarga la cocreación o compara antes de guardar.';
  end if;
  return private_api.guardar_cocrear_seguro(p_expediente_id, p_payload);
end
$function$;
revoke all on function private_api.guardar_cocrear_seguro(bigint, jsonb, integer) from public, anon;
grant execute on function private_api.guardar_cocrear_seguro(bigint, jsonb, integer) to authenticated, service_role;

create or replace function public.guardar_cocrear_seguro(p_expediente_id bigint, p_payload jsonb, p_revision_esperada integer)
 returns jsonb
 language plpgsql
 set search_path to 'pg_catalog', 'public', 'private_api'
as $function$
      begin
        if auth.uid() is null then raise exception 'no autenticado'; end if;
        return private_api.guardar_cocrear_seguro(p_expediente_id, p_payload, p_revision_esperada);
      end
      $function$;
revoke all on function public.guardar_cocrear_seguro(bigint, jsonb, integer) from public, anon;
grant execute on function public.guardar_cocrear_seguro(bigint, jsonb, integer) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- H5) producto_versiones: una ProductRevision PUBLICADA no se edita en sitio ni se degrada.
--     Cuerpo de producción intacto + el bloque VH-148b al final.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_producto_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.expediente_revisiones%rowtype; h text; v_rango_old int; v_rango_new int;
begin
  if TG_OP in ('INSERT','UPDATE') and NEW.estado_tecnico = 'certificado' then
    if NEW.expediente_id is null or NEW.expediente_revision_id is null or NEW.bom_hash is null then
      raise exception 'version certificada sin pin completo (expediente_id/expediente_revision_id/bom_hash)';
    end if;
    select * into r from public.expediente_revisiones where id = NEW.expediente_revision_id;
    if not found then raise exception 'expediente_revision_id % inexistente', NEW.expediente_revision_id; end if;
    if r.expediente_id <> NEW.expediente_id then raise exception 'la revision pertenece a otro expediente'; end if;
    if r.producto_version_id is not null and r.producto_version_id <> NEW.id then
      raise exception 'revision.producto_version_id (%) != version.id (%)', r.producto_version_id, NEW.id; end if;
    h := public.bom_hash_de_revision(NEW.expediente_revision_id);
    if NEW.bom_hash is distinct from h then
      raise exception 'bom_hash (%) != SHA256(canonical bom) (%)', NEW.bom_hash, h; end if;
  end if;
  if TG_OP = 'UPDATE' and OLD.estado_tecnico = 'certificado' then
    if NEW.expediente_revision_id is distinct from OLD.expediente_revision_id
     or NEW.bom_hash is distinct from OLD.bom_hash
     or NEW.dimensiones is distinct from OLD.dimensiones
     or NEW.atributos is distinct from OLD.atributos then
      raise exception 'version certificada es inmutable: crea una nueva version'; end if;
  end if;
  -- VH-148b · una versión PUBLICADA (aprobado/certificado) no se edita en sitio ni se degrada.
  -- Permitido: promover (aprobado → certificado, que fija bom_hash) y fijar un pin que estaba vacío.
  if TG_OP = 'UPDATE' and OLD.estado_tecnico in ('aprobado','certificado')
     and current_setting('vh.permitir_edicion_version_publicada', true) is distinct from 'on' then
    v_rango_old := case OLD.estado_tecnico when 'certificado' then 2 else 1 end;
    v_rango_new := case NEW.estado_tecnico when 'certificado' then 2 when 'aprobado' then 1 else 0 end;
    if v_rango_new < v_rango_old then
      raise exception 'VERSION_PUBLICADA_INMUTABLE: la version % esta %; no se puede regresar a %', OLD.id, OLD.estado_tecnico, NEW.estado_tecnico
        using errcode = '55000', hint = 'Crea una nueva version.';
    end if;
    if NEW.id is distinct from OLD.id
     or NEW.producto_id is distinct from OLD.producto_id
     or NEW.etiqueta is distinct from OLD.etiqueta
     or NEW.dimensiones is distinct from OLD.dimensiones
     or NEW.acabados_permitidos is distinct from OLD.acabados_permitidos
     or NEW.atributos is distinct from OLD.atributos
     or NEW.expediente_id is distinct from OLD.expediente_id
     or NEW.formula_version is distinct from OLD.formula_version
     or NEW.creado is distinct from OLD.creado
     or (OLD.expediente_revision_id is not null and NEW.expediente_revision_id is distinct from OLD.expediente_revision_id)
     or (NEW.bom_hash is distinct from OLD.bom_hash
         and not (OLD.estado_tecnico = 'aprobado' and NEW.estado_tecnico = 'certificado')) then
      raise exception 'VERSION_PUBLICADA_INMUTABLE: la version % esta % y no se edita en sitio', OLD.id, OLD.estado_tecnico
        using errcode = '55000', hint = 'Crea una nueva version.';
    end if;
  end if;
  return NEW;
end $function$
;

-- Postcondiciones: ninguna sobrecarga de las RPC con versión lleva DEFAULT (llamadas no ambiguas) y los
-- triggers quedaron instalados.
do $$
declare v_malas text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_malas
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname in ('public','private_api')
    and p.proname in ('actualizar_cotizacion_segura','guardar_cocrear_seguro','actualizar_expediente_seguro')
    and p.pronargdefaults > 0;
  if v_malas is not null then
    raise exception 'VH-148b: sobrecargas con DEFAULT (llamadas ambiguas): %', v_malas;
  end if;
  if (select count(*) from pg_trigger where tgname in ('trg_vh148_version','trg_vh148_revision_cas') and not tgisinternal) <> 3 then
    raise exception 'VH-148b: faltan triggers de versión';
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

commit;

-- ============================================================================
--  ROLLBACK (quitar el prefijo `-- RB ` y correr). Devuelve:
--   · private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz) al cuerpo EXACTO de VH-148;
--   · public.guard_producto_version() al cuerpo EXACTO de producción (baseline/03_funciones.sql);
--   · UPDATE de tabla en cotizaciones para authenticated (estado medido en producción);
--   · quita triggers, funciones y sobrecargas nuevas.
--  No toca filas: los `actualizado` ya escritos por el trigger se quedan (son fechas válidas).
--  El cliente debe volver a la bandera APAGADA antes (con la bandera apagada nunca llama las firmas nuevas).
-- ============================================================================
-- RB begin;
-- RB drop trigger if exists trg_vh148_version on public.cotizaciones;
-- RB drop trigger if exists trg_vh148_version on public.expedientes;
-- RB drop trigger if exists trg_vh148_revision_cas on public.expedientes;
-- RB drop function if exists private_api.vh148_sube_version();
-- RB drop function if exists private_api.vh148_guard_revision_expediente();
-- RB drop function if exists public.actualizar_expediente_seguro(bigint, jsonb, integer);
-- RB drop function if exists private_api.actualizar_expediente_seguro(bigint, jsonb, integer);
-- RB drop function if exists public.guardar_cocrear_seguro(bigint, jsonb, integer);
-- RB drop function if exists private_api.guardar_cocrear_seguro(bigint, jsonb, integer);
-- RB revoke update (activa) on table public.cotizaciones from authenticated;
-- RB grant update on table public.cotizaciones to authenticated;
-- RB CREATE OR REPLACE FUNCTION private_api.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb, p_actualizado_esperado timestamptz)
-- RB  RETURNS jsonb
-- RB  LANGUAGE plpgsql
-- RB  SECURITY DEFINER
-- RB  SET search_path TO 'public'
-- RB AS $function$
-- RB declare
-- RB   v_email text := auth.jwt()->>'email';
-- RB   v_role text;
-- RB   v_c public.cotizaciones%rowtype;
-- RB   v_actualizado_iso text;
-- RB begin
-- RB   -- NULL explícito = sin control: exactamente la firma de dos argumentos.
-- RB   if p_actualizado_esperado is null then
-- RB     return private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch);
-- RB   end if;
-- RB 
-- RB   -- Mismas compuertas y en el MISMO ORDEN que el núcleo, ANTES de comparar versiones: quien no
-- RB   -- tiene sesión/rol/acceso recibe el mismo error que con dos argumentos y nunca la versión de la
-- RB   -- fila (un vendedor ajeno recibe 'sin acceso', no 'CONFLICTO_VERSION'). El núcleo las repite al
-- RB   -- delegar (idempotentes, misma transacción).
-- RB   if v_email is null or not public.puede_entrar() then
-- RB     raise exception 'no autorizado';
-- RB   end if;
-- RB   if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
-- RB     raise exception 'patch invalido';
-- RB   end if;
-- RB   select lower(p.rol) into v_role
-- RB   from public.permitidos p
-- RB   where lower(p.email)=lower(v_email)
-- RB   limit 1;
-- RB   if v_role not in ('direccion','diseno','vendedor') then
-- RB     raise exception 'rol sin permiso';
-- RB   end if;
-- RB 
-- RB   -- Candado de la fila hasta el fin de la transacción: el núcleo vuelve a pedirlo (mismo dueño, no
-- RB   -- espera) y nadie más puede escribir entre esta comparación y su UPDATE.
-- RB   select * into v_c from public.cotizaciones where id=p_cotizacion_id for update;
-- RB   if not found then raise exception 'cotizacion no existe'; end if;
-- RB   if not (lower(coalesce(v_c.usuario,''))=lower(v_email) or public.puede_editar_config()) then
-- RB     raise exception 'sin acceso';
-- RB   end if;
-- RB   if lower(coalesce(v_c.estado,'borrador')) <> 'borrador' then
-- RB     raise exception 'cotizacion no editable en estado %',v_c.estado;
-- RB   end if;
-- RB 
-- RB   -- VH-148 · CONTROL OPTIMISTA. Si el cliente dice desde qué versión edita y la fila ya no es ésa,
-- RB   -- se aborta ANTES de tocar nada: la decisión (recargar o volver a aplicar) es de la persona, no
-- RB   -- del servidor. La fecha viaja en el mismo formato ISO que `cotizacion_segura` (to_json), para que
-- RB   -- el cliente pueda devolverla tal cual en el siguiente intento.
-- RB   if v_c.actualizado is distinct from p_actualizado_esperado then
-- RB     v_actualizado_iso := to_json(v_c.actualizado)#>>'{}';
-- RB     raise exception 'CONFLICTO_VERSION: la cotización cambió en el servidor (%). Recarga antes de guardar.', v_actualizado_iso
-- RB       using errcode = '40001',
-- RB             detail = 'actualizado=' || v_actualizado_iso,
-- RB             hint = 'Vuelve a cargar la cotización (cotizacion_segura) y decide: ver la versión del servidor o volver a aplicar tus cambios con el actualizado nuevo.';
-- RB   end if;
-- RB 
-- RB   -- Versión correcta: el guardado es EL MISMO que el de dos argumentos (núcleo único; con VH-035c
-- RB   -- aplicado incluye fusión de economía, STALE, rechazo de re-pin y autoridad protegida).
-- RB   return private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch);
-- RB end;
-- RB $function$
-- RB ;
-- RB CREATE OR REPLACE FUNCTION public.guard_producto_version()
-- RB  RETURNS trigger
-- RB  LANGUAGE plpgsql
-- RB  SET search_path TO ''
-- RB AS $function$
-- RB declare r public.expediente_revisiones%rowtype; h text;
-- RB begin
-- RB   if TG_OP in ('INSERT','UPDATE') and NEW.estado_tecnico = 'certificado' then
-- RB     if NEW.expediente_id is null or NEW.expediente_revision_id is null or NEW.bom_hash is null then
-- RB       raise exception 'version certificada sin pin completo (expediente_id/expediente_revision_id/bom_hash)';
-- RB     end if;
-- RB     select * into r from public.expediente_revisiones where id = NEW.expediente_revision_id;
-- RB     if not found then raise exception 'expediente_revision_id % inexistente', NEW.expediente_revision_id; end if;
-- RB     if r.expediente_id <> NEW.expediente_id then raise exception 'la revision pertenece a otro expediente'; end if;
-- RB     if r.producto_version_id is not null and r.producto_version_id <> NEW.id then
-- RB       raise exception 'revision.producto_version_id (%) != version.id (%)', r.producto_version_id, NEW.id; end if;
-- RB     h := public.bom_hash_de_revision(NEW.expediente_revision_id);
-- RB     if NEW.bom_hash is distinct from h then
-- RB       raise exception 'bom_hash (%) != SHA256(canonical bom) (%)', NEW.bom_hash, h; end if;
-- RB   end if;
-- RB   if TG_OP = 'UPDATE' and OLD.estado_tecnico = 'certificado' then
-- RB     if NEW.expediente_revision_id is distinct from OLD.expediente_revision_id
-- RB      or NEW.bom_hash is distinct from OLD.bom_hash
-- RB      or NEW.dimensiones is distinct from OLD.dimensiones
-- RB      or NEW.atributos is distinct from OLD.atributos then
-- RB       raise exception 'version certificada es inmutable: crea una nueva version'; end if;
-- RB   end if;
-- RB   return NEW;
-- RB end $function$
-- RB ;
-- RB notify pgrst, 'reload schema';
-- RB commit;
