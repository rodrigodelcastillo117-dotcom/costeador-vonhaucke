-- ============================================================================
-- PROPUESTA_sec02_search_path_authrole.sql   ·   BORRADOR — NO APLICADO
-- Proyecto Supabase: mtuvnbgljwbsaizjjgzs  (Costeador Von Haucke)
-- Auditoría: Security Hardening P2  ·  migración versionada (convención PROPUESTA_*.sql)
-- Origen: scratchpad/final100/SEC_hardening_borrador.sql
--
-- ⚠️  NO APLICADO. Esta migración NO se ha corrido contra ninguna base (ni prod ni
--     staging). Es una PROPUESTA para revisión humana + CI (pglite).
--
-- ⚠️  AL APLICAR EN PRODUCCIÓN — actualizar los MOCKS de tests que simulan auth.role():
--       · supabase/tests/fixtures/erpBaseAislada.js            (define auth.role())
--       · supabase/tests/cargarCostosOficiales.test.js         (create function auth.role())
--       · supabase/tests/seg01cVinculoCosteo.test.js:911       (create or replace function auth.role())
--     Tras §B ya NO queda `auth.role()` en la base; esos dobles deben pasar a
--     alimentar el claim `role` dentro de auth.jwt() (p.ej. request.jwt.claims->>'role')
--     o seguir definiendo auth.role() como lectura de ese mismo claim para no
--     divergir. El contrato lo fija src/datos/sec02Permisos.test.js.
--
-- ALCANCE (SOLO lo acordado en P2):
--   §A  8 ALTER FUNCTION private_api.* SET search_path   (advisor 0011, search_path mutable)
--   §B  3 CREATE OR REPLACE FUNCTION public.*            (auth.role() -> auth.jwt()->>'role')
-- NO se tocan: las 15 funciones SECURITY DEFINER del advisor 0029 (diseño vigente),
--             ni las 7 tablas deny-all del advisor 0008 (RLS sin política = intencional).
-- ============================================================================


-- ============================================================================
-- §A · FIX search_path mutable  (advisor 0011_function_search_path_mutable, count=8)
-- ----------------------------------------------------------------------------
-- 8 funciones de private_api, SECURITY INVOKER + IMMUTABLE + puras. Se fija el
-- search_path EXPLÍCITO y MÍNIMO según lo que cada función usa de verdad:
--   · 7 solo usan built-ins de pg_catalog o literales  ⇒ pg_catalog, pg_temp
--   · jsonb_objetos_sin_orden se auto-referencia calificada private_api.*
--                                                     ⇒ pg_catalog, private_api, pg_temp
-- pg_temp SIEMPRE al final (evita shadowing por objetos temporales).
-- Son IMMUTABLE y su salida NO depende del search_path ⇒ fijarlo no cambia resultados.
-- ----------------------------------------------------------------------------

ALTER FUNCTION private_api.clave_elemento(e jsonb)
  SET search_path = pg_catalog, pg_temp;

ALTER FUNCTION private_api.es_clave_material(k text)
  SET search_path = pg_catalog, pg_temp;

ALTER FUNCTION private_api.economia_por_lote(p jsonb)
  SET search_path = pg_catalog, pg_temp;

ALTER FUNCTION private_api.claves_autoridad_partida()
  SET search_path = pg_catalog, pg_temp;

ALTER FUNCTION private_api.claves_procedencia_partida()
  SET search_path = pg_catalog, pg_temp;

ALTER FUNCTION private_api.claves_libres_definicion_partida()
  SET search_path = pg_catalog, pg_temp;

ALTER FUNCTION private_api.claves_libres_emision_partida()
  SET search_path = pg_catalog, pg_temp;

ALTER FUNCTION private_api.jsonb_objetos_sin_orden(p jsonb)
  SET search_path = pg_catalog, private_api, pg_temp;


-- ============================================================================
-- §B · Sustituir auth.role() por el mecanismo JWT VIGENTE del proyecto
-- ----------------------------------------------------------------------------
-- Mecanismo vigente: el proyecto deriva identidad/capacidad del JWT verificado.
-- El resto del código ya lee auth.jwt()->>'email'. `auth.role()` es, internamente,
-- exactamente la lectura del claim `role` del JWT, de modo que:
--        coalesce(auth.role(), '')        ≡  coalesce(auth.jwt() ->> 'role', '')
-- (equivalente 1:1 para 'service_role'; la rama de la Edge NO se rompe).
--
-- SOLO 3 funciones de la base viva usan auth.role() (verificado con pg_proc.prosrc).
-- Cada CREATE OR REPLACE conserva el cuerpo EXACTO de producción; el ÚNICO cambio
-- es esa expresión. El search_path actual (pg_catalog, public, private_api) ya es
-- correcto y se mantiene.
-- ----------------------------------------------------------------------------

-- ---- B.1  public.buscar_insumos_motor ----
CREATE OR REPLACE FUNCTION public.buscar_insumos_motor(p_q text, p_limite integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
declare toks text[]; q text := btrim(coalesce(p_q, ''));
begin
  -- BORRADOR P2: auth.role() -> auth.jwt()->>'role' (misma fuente JWT que el resto del proyecto)
  if not (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or private_api.puede_editar_config()) then
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
$function$;

-- ---- B.2  public.catalogo_motor ----
CREATE OR REPLACE FUNCTION public.catalogo_motor(p_incluir_erp boolean DEFAULT false, p_ids text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
begin
  -- BORRADOR P2: auth.role() -> auth.jwt()->>'role'
  if not (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or private_api.puede_editar_config()) then
    raise exception 'no autorizado';
  end if;
  return private_api.catalogo_motor(p_incluir_erp, p_ids);
end;
$function$;

-- ---- B.3  public.cargar_costos_oficiales ----
-- auth.role() aparece aquí en la rama "<> 'service_role'" (gate para humanos).
-- El reemplazo preserva la semántica exacta.
CREATE OR REPLACE FUNCTION public.cargar_costos_oficiales(p_documento text, p_filas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private_api'
AS $function$
declare
  f jsonb; v_codigo text; v_costo numeric; v_moneda text; v_fecha date; v_pv bigint;
  n_ok int := 0; n_sin_producto int := 0; n_sin_costo int := 0; rechazadas jsonb := '[]'::jsonb;
  v_hash text; v_rol text; v_email text; v_no_humana boolean;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  -- BORRADOR P2: auth.role() -> auth.jwt()->>'role'
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    -- El rol sale SÓLO de `permitidos` (lo administra Dirección), nunca de metadatos del JWT que el usuario edita.
    select lower(p.rol) into v_rol from public.permitidos p where lower(p.email) = v_email limit 1;
    if v_email = '' or coalesce(v_rol, '') <> 'direccion' then
      raise exception 'no autorizado: sólo Dirección carga costos oficiales';
    end if;
    -- Fail-closed: sin la lista de cuentas no humanas (SEG-01c) no se puede descartar la cuenta QA ⇒ no se carga.
    if to_regclass('public.cuentas_no_humanas') is null then
      raise exception 'no autorizado: falta public.cuentas_no_humanas (aplicar SEG-01c antes)';
    end if;
    execute 'select exists(select 1 from public.cuentas_no_humanas where lower(email) = $1)' into v_no_humana using v_email;
    if v_no_humana then
      raise exception 'no autorizado: % es una cuenta no humana (pruebas/proceso)', v_email;
    end if;
  end if;
  if coalesce(btrim(p_documento), '') = '' then raise exception 'documento requerido (nombre + fecha del reporte Intelisis)'; end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'p_filas debe ser un arreglo'; end if;
  -- pgcrypto vive en el esquema `extensions` en Supabase (verificado 2026-10-13): sin calificar, `digest` no existe
  -- con este search_path y la carga fallaba en la primera fila.
  v_hash := encode(extensions.digest(p_filas::text, 'sha256'), 'hex');

  for f in select * from jsonb_array_elements(p_filas) loop
    v_codigo := nullif(btrim(f->>'codigo'), '');
    v_costo := nullif(f->>'costo', '')::numeric;
    v_moneda := coalesce(nullif(upper(f->>'moneda'), ''), 'MXN');
    v_fecha := coalesce(nullif(f->>'fecha', '')::date, current_date);
    if v_codigo is null or v_costo is null or v_costo <= 0 then
      n_sin_costo := n_sin_costo + 1; rechazadas := rechazadas || jsonb_build_object('codigo', v_codigo, 'motivo', 'SIN_COSTO'); continue;
    end if;
    if v_moneda <> 'MXN' then
      -- Sin tipo de cambio documentado no se convierte: se rechaza, no se adivina.
      rechazadas := rechazadas || jsonb_build_object('codigo', v_codigo, 'motivo', 'MONEDA_NO_MXN'); n_sin_costo := n_sin_costo + 1; continue;
    end if;
    -- 2026-10-13: hay códigos DUPLICADOS en productos (ATOM3, ATPU2M/3M/4M/75M, ATFAL150ABS: el artículo ERP y
    -- una ficha "App LT · …"). Con `limit 1` el costo caía en cualquiera de los dos. Ahora: con más de un producto
    -- activo para el código, se exige `producto_id` explícito en la fila; si no viene, se RECHAZA (no se adivina).
    if (select count(*) from public.productos p where p.codigo = v_codigo and p.activo) > 1 and nullif(f->>'producto_id', '') is null then
      rechazadas := rechazadas || jsonb_build_object('codigo', v_codigo, 'motivo', 'CODIGO_DUPLICADO',
        'productos', (select jsonb_agg(p.id order by p.id) from public.productos p where p.codigo = v_codigo and p.activo));
      n_sin_producto := n_sin_producto + 1; continue;
    end if;
    select coalesce(p.version_tecnica_vigente_id, (select pv.id from public.producto_versiones pv where pv.producto_id = p.id order by pv.creado desc limit 1))
      into v_pv from public.productos p
     where p.codigo = v_codigo and p.activo and (nullif(f->>'producto_id', '') is null or p.id = (f->>'producto_id')::bigint)
     limit 1;
    if v_pv is null then n_sin_producto := n_sin_producto + 1; rechazadas := rechazadas || jsonb_build_object('codigo', v_codigo, 'motivo', 'SIN_PRODUCTO'); continue; end if;
    -- Historial: la fila que se va a sobrescribir queda registrada antes (nunca se pierde un costo oficial).
    insert into public.producto_version_economia_historial (producto_version_id, costo_anterior, formula_version_anterior, fuente_anterior, actualizado_anterior, reemplazado_por, documento_nuevo)
    select e.producto_version_id, e.costo_oficial_referencia, e.formula_version, e.fuente, e.actualizado, coalesce(nullif(v_email, ''), 'service'), p_documento
      from public.producto_version_economia e where e.producto_version_id = v_pv;
    insert into public.producto_version_economia (producto_version_id, costo_oficial_referencia, formula_version, fuente, actualizado)
    values (v_pv, v_costo, coalesce(nullif(f->>'formula_version', ''), 'intelisis-reporte'),
            format('%s · %s · sha256:%s · %s', p_documento, v_fecha, v_hash, coalesce(nullif(v_email, ''), 'service')), now())
    on conflict (producto_version_id) do update
      set costo_oficial_referencia = excluded.costo_oficial_referencia, formula_version = excluded.formula_version, fuente = excluded.fuente, actualizado = now();
    n_ok := n_ok + 1;
  end loop;
  return jsonb_build_object('ok', true, 'documento', p_documento, 'hash', v_hash, 'cargados', n_ok, 'sin_producto', n_sin_producto, 'sin_costo', n_sin_costo, 'rechazadas', rechazadas);
end;
$function$;


-- ============================================================================
-- Verificación posterior (LECTURA, tras aplicar):
--   -- §A: proconfig ya no NULL en las 8:
--   SELECT p.proname, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='private_api' AND p.proname IN
--     ('clave_elemento','es_clave_material','economia_por_lote','claves_autoridad_partida',
--      'claves_procedencia_partida','claves_libres_definicion_partida',
--      'claves_libres_emision_partida','jsonb_objetos_sin_orden');
--   -- §B: 0 filas = ya no queda auth.role() en la base:
--   SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname IN ('public','private_api') AND p.prosrc LIKE '%auth.role()%';
-- ============================================================================
