-- ============================================================================
--  puede_certificar_costo() EXCLUYE cuentas_no_humanas (cierra el P1 de la auditoría 2026-10-28).
--  NO APLICADA a producción. Requiere OK de Dirección (§100: cambia una función de autoridad).
--
--  Problema: puede_certificar_costo() hoy sólo verifica rol='direccion' en `permitidos`, SIN excluir
--  `cuentas_no_humanas`. La usan aprobar_precio, aprobar_precios_lote, aprobar_mapeo_externo,
--  certificar_version, cerrar/revalidar_vigencia_precio y cargar_erp_ultima_compra. En contraste,
--  firmar_precios_* y cargar_costos_oficiales SÍ excluyen las no-humanas. La guarda es inconsistente:
--  `qa-direccion@vonhaucke.mx` está en `permitidos` (rol direccion) Y en `cuentas_no_humanas`, así que
--  hoy podría re-certificar/aprobar como si fuera humano (así nacieron las 1,763 firmas que luego se
--  re-firmaron a mano). Impacto CONTENIDO (0 precios vigentes aprobados por no-humana hoy, y la emisión
--  no cuenta a qa como humano), pero la grieta debe cerrarse.
--
--  Fix: añadir `and not exists (... cuentas_no_humanas ...)`, idéntico a lo que ya hacen firmar_*.
--  Base: definición VIVA de prod (verificada 2026-10-28). Determinista, sin efectos colaterales.
--
--  COMPLEMENTO (dato, también tu OK): quitar qa-direccion de `permitidos` o darle un rol no-aprobador:
--    update public.permitidos set rol='qa' where email='qa-direccion@vonhaucke.mx';
--  Con el fix de función eso ya no es imprescindible para la seguridad, pero deja el dato limpio.
--
--  REVERSIBLE: re-crear la función sin el `and not exists (...)` (volver a la def previa).
-- ============================================================================
begin;

create or replace function public.puede_certificar_costo()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from public.permitidos
                 where email = (auth.jwt() ->> 'email') and rol in ('direccion'))
     and not exists (select 1 from public.cuentas_no_humanas c
                     where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$function$;

commit;

-- ROLLBACK:
-- begin;
--   create or replace function public.puede_certificar_costo()
--    returns boolean language sql stable security definer set search_path to 'public','pg_temp'
--   as $function$
--     select exists (select 1 from public.permitidos
--                    where email = (auth.jwt() ->> 'email') and rol in ('direccion'));
--   $function$;
-- commit;
