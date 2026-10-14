-- ============================================================================
--  PROPUESTA · SEG-01b (P0) · la emisión deja de confiar en la economía que escribió un navegador.
--  ⚠️ PROPUESTA, NO MIGRACIÓN: no aplicar sin autorización expresa de Dirección. Prefijo PROPUESTA_ para que
--  `supabase db push` no la tome.
--
--  DEFECTO (producción 2026-10-14, SQL exacto en supabase/tests/fixtures/private_api_emision_prod_20261013.sql):
--   · Renglones canónicos (producto_id + producto_version_id): el costo sale de producto_version_economia. OK.
--   · Renglones SIN producto_id (especiales del Costeador y legacy): private_api.evaluar_emision_cotizacion toma
--     `costoUnitario` y `costoEstado` de la FILA guardada; ambos los escribió un navegador (el de Dirección, porque
--     al vendedor se los despoja VH-035c). Si el renglón no trae `costoEstado` se trata como histórico y PASA.
--     Un cliente alterado de Dirección/Diseño (o un bug de cliente) puede fijar el costo o declarar "certificado".
--
--  QUÉ HACE:
--   1. public.costeos_servidor: registro que SÓLO escribe la Edge `costear-servidor` con service_role (sin grants
--      para anon/authenticated; RLS activo sin políticas). Guarda costo unitario, estado, bom_hash, cantidad, rol de
--      quien costeó y los PRECIOS EXACTOS usados (precio_id, importe, unidad, aprobador, rol, fecha; P1-03).
--   2. public.cuentas_no_humanas: lista EXPLÍCITA de cuentas que no cuentan como aprobación humana (sustituye la
--      regex por e-mail). Semilla: qa-direccion@vonhaucke.mx (tiene rol 'direccion' en permitidos: el rol no basta).
--   3. private_api.motivos_autoridad_costeo(cotizacion): por cada renglón sin producto_id exige un `costeoId` cuyo
--      registro exista, lo haya hecho Dirección/Diseño, esté 'certificado' con aprobación humana, sea del mismo
--      despiece (`bomHash`) y la misma cantidad, y cuyo costo sea IDÉNTICO (centavos) al `costoUnitario` del
--      renglón. Así el margen que ya calcula el gate de producción se hace sobre un costo verificado por el servidor.
--      `costeoId` ya es economía para producción (`cost.*` en jsonb_sin_economia): al vendedor se le despoja y
--      VH-035c conserva el de Dirección.
--   4. public.evaluar_emision_cotizacion (wrapper INVOKER vigente de VH-035c, md5 producción cf6ef6a30bbb68eb2b867f2bcdb7c846):
--      mismo cuerpo, y los motivos de autoridad se suman a los de recosteo pendiente (misma degradación a
--      ECONOMICS_INCOMPLETE; BLOCKED sigue BLOCKED). emitir_revision_v2 y cotizacion_emitible ya pasan por él.
--   5. private_api.politica_emision_autoridad: UN parámetro para Dirección. `legacy_sin_costeo_hasta` = NULL (por
--      omisión) ⇒ ESTRICTO: ningún renglón sin costeo del servidor se emite. Medido el 14-oct: 2,033 de 2,203
--      cotizaciones tienen renglones sin producto_id (5,803 renglones; 27 con folio). Si Dirección decide una
--      transición, fija una fecha: las cotizaciones CREADAS hasta esa fecha conservan el trato histórico. Es una
--      decisión de negocio; no se toma aquí.
--
--  NO HACE: no reescribe filas, no toca precios, no cambia emitir_revision_v2 / asignar_folio_oficial /
--  private_api.evaluar_emision_cotizacion (cuerpo de producción intacto), compone con SEG-01 v1 y VH-148.
-- ============================================================================
begin;

create table if not exists public.costeos_servidor (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  creado_por text not null,
  rol text not null,
  bom_hash text not null,
  cantidad integer not null check (cantidad >= 1),
  costo_unitario numeric(14,2) not null check (costo_unitario >= 0),
  estado text not null check (estado in ('certificado','preliminar','incompleto','bloqueado')),
  aprobacion_humana boolean not null default false,
  version_motor text,
  version_catalogo text,
  fuente_costo text,
  precios jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb
);
comment on table public.costeos_servidor is
  'SEG-01b · costeo autoritativo. Sólo lo escribe la Edge costear-servidor (service_role). La emisión exige que el costo de cada renglón especial coincida con un registro certificado de aquí.';
alter table public.costeos_servidor enable row level security;
revoke all on table public.costeos_servidor from public, anon, authenticated;
grant select, insert on table public.costeos_servidor to service_role;

create table if not exists public.cuentas_no_humanas (
  email text primary key,
  motivo text not null,
  registrado_en timestamptz not null default now()
);
comment on table public.cuentas_no_humanas is
  'P1-03 · cuentas cuya aprobación de precios NO cuenta como aprobación humana (pruebas, procesos). Lista explícita, no regex.';
alter table public.cuentas_no_humanas enable row level security;
revoke all on table public.cuentas_no_humanas from public, anon, authenticated;
grant select on table public.cuentas_no_humanas to service_role;
insert into public.cuentas_no_humanas(email, motivo) values
  ('qa-direccion@vonhaucke.mx', 'cuenta de pruebas QA (rol direccion en permitidos)'),
  ('reconciliacion', 'proceso automático de reconciliación')
on conflict (email) do nothing;

create table if not exists private_api.politica_emision_autoridad (
  id boolean primary key default true check (id),
  legacy_sin_costeo_hasta timestamptz,
  decidido_por text,
  decidido_en timestamptz
);
insert into private_api.politica_emision_autoridad(id) values (true) on conflict (id) do nothing;
revoke all on table private_api.politica_emision_autoridad from public, anon, authenticated;

create or replace function private_api.motivos_autoridad_costeo(p_cotizacion_id bigint)
returns text[] language plpgsql stable security definer set search_path to 'public', 'private_api' as $$
declare
  v_c record; v_p jsonb; v_ord bigint; v_out text[] := '{}'; v_cid text; v_r record; v_hasta timestamptz;
  v_costo numeric; v_cant integer;
begin
  select id, creado, partidas into v_c from public.cotizaciones where id = p_cotizacion_id;
  if not found then return v_out; end if;
  select legacy_sin_costeo_hasta into v_hasta from private_api.politica_emision_autoridad where id;
  for v_p, v_ord in select value, ord from jsonb_array_elements(coalesce(v_c.partidas, '[]'::jsonb)) with ordinality d(value, ord) loop
    if coalesce(nullif(v_p->>'producto_id', ''), nullif(v_p->>'productoId', '')) is not null then continue; end if;
    v_cid := nullif(v_p->>'costeoId', '');
    if v_cid is null then
      if v_hasta is not null and v_c.creado <= v_hasta then continue; end if;   -- transición decidida por Dirección
      v_out := array_append(v_out, format('linea_%s_sin_costeo_servidor', v_ord)); continue;
    end if;
    if v_cid !~ '^[0-9a-fA-F-]{36}$' then v_out := array_append(v_out, format('linea_%s_costeo_servidor_inexistente', v_ord)); continue; end if;
    select * into v_r from public.costeos_servidor where id = v_cid::uuid;
    if not found then v_out := array_append(v_out, format('linea_%s_costeo_servidor_inexistente', v_ord)); continue; end if;
    if lower(v_r.rol) not in ('direccion', 'diseno') then
      v_out := array_append(v_out, format('linea_%s_costeo_sin_autoridad', v_ord)); continue; end if;
    if v_r.estado <> 'certificado' or not v_r.aprobacion_humana then
      v_out := array_append(v_out, format('linea_%s_costeo_servidor_no_certificado', v_ord)); continue; end if;
    if v_r.bom_hash is distinct from nullif(v_p->>'bomHash', '') then
      v_out := array_append(v_out, format('linea_%s_costeo_de_otro_despiece', v_ord)); continue; end if;
    begin v_cant := nullif(v_p->>'cantidad', '')::integer; exception when others then v_cant := null; end;
    if v_cant is distinct from v_r.cantidad then
      v_out := array_append(v_out, format('linea_%s_costeo_de_otra_cantidad', v_ord)); continue; end if;
    begin v_costo := nullif(v_p->>'costoUnitario', '')::numeric; exception when others then v_costo := null; end;
    if v_costo is null or round(v_costo, 2) <> round(v_r.costo_unitario, 2) then
      v_out := array_append(v_out, format('linea_%s_costo_no_coincide_con_servidor', v_ord)); continue; end if;
  end loop;
  return v_out;
end $$;
revoke all on function private_api.motivos_autoridad_costeo(bigint) from public, anon;
grant execute on function private_api.motivos_autoridad_costeo(bigint) to authenticated, service_role;

-- Wrapper vigente (VH-035c) + motivos de autoridad del costeo.
create or replace function public.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
returns jsonb language plpgsql stable set search_path to 'pg_catalog', 'public', 'private_api' as $function$
declare v_gate jsonb; v_stale text[]; v_state text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  v_gate := private_api.evaluar_emision_cotizacion(p_cotizacion_id, p_snapshot);
  v_stale := private_api.motivos_recosteo_pendiente(p_cotizacion_id) || private_api.motivos_autoridad_costeo(p_cotizacion_id);
  if coalesce(array_length(v_stale, 1), 0) = 0 then return v_gate; end if;
  v_state := v_gate->>'state';
  if v_state = 'BLOCKED' then
    return v_gate || jsonb_build_object('economics', coalesce(v_gate->'economics', '[]'::jsonb) || to_jsonb(v_stale));
  end if;
  return v_gate || jsonb_build_object(
    'state', 'ECONOMICS_INCOMPLETE',
    'reasons', to_jsonb(v_stale) || case when v_state = 'ECONOMICS_INCOMPLETE' then coalesce(v_gate->'reasons', '[]'::jsonb) else '[]'::jsonb end,
    'recosteo_pendiente', true);
end $function$;

commit;

-- ============================================================================
--  ROLLBACK: restaurar el wrapper de VH-035c (md5 cf6ef6a30bbb68eb2b867f2bcdb7c846) y borrar lo nuevo.
-- RB begin;
-- RB create or replace function public.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
-- RB returns jsonb language plpgsql stable set search_path to 'pg_catalog', 'public', 'private_api' as $function$
-- RB declare v_gate jsonb; v_stale text[]; v_state text;
-- RB begin
-- RB   if auth.uid() is null then raise exception 'no autenticado'; end if;
-- RB   v_gate := private_api.evaluar_emision_cotizacion(p_cotizacion_id, p_snapshot);
-- RB   v_stale := private_api.motivos_recosteo_pendiente(p_cotizacion_id);
-- RB   if coalesce(array_length(v_stale, 1), 0) = 0 then return v_gate; end if;
-- RB   v_state := v_gate->>'state';
-- RB   if v_state = 'BLOCKED' then
-- RB     return v_gate || jsonb_build_object('economics', coalesce(v_gate->'economics', '[]'::jsonb) || to_jsonb(v_stale));
-- RB   end if;
-- RB   return v_gate || jsonb_build_object(
-- RB     'state', 'ECONOMICS_INCOMPLETE',
-- RB     'reasons', to_jsonb(v_stale) || case when v_state = 'ECONOMICS_INCOMPLETE' then coalesce(v_gate->'reasons', '[]'::jsonb) else '[]'::jsonb end,
-- RB     'recosteo_pendiente', true);
-- RB end $function$;
-- RB drop function if exists private_api.motivos_autoridad_costeo(bigint);
-- RB drop table if exists private_api.politica_emision_autoridad;
-- RB commit;
-- (costeos_servidor y cuentas_no_humanas se conservan como rastro; borrarlas sólo con decisión expresa.)
-- ============================================================================
