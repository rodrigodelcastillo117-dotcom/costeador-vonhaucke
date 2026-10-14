-- ============================================================================
--  PROPUESTA · SEG-01c (P0) · el costo de un renglón especial es el que el SERVIDOR registró Y VINCULÓ a esa partida.
--  ⚠️ PROPUESTA, NO MIGRACIÓN: no aplicar sin autorización expresa de Dirección (prefijo PROPUESTA_: `db push` no la toma).
--  SUSTITUYE a PROPUESTA_seg01b (nunca aplicada; eliminada). Compone con SEG-01 v1, VH-035c (aplicada) y VH-148b.
--
--  QUÉ CORRIGE DE SEG-01b (reauditoría externa 14-oct, P0-01/P0-02/P1-04):
--   · SEG-01b comparaba `costeos_servidor.bom_hash` contra `partida.bomHash`, y AMBOS los transportaba el navegador:
--     un costeoId válido se podía reutilizar (replay) en otra cotización copiando su bomHash, cantidad y costo.
--     AHORA el vínculo costeo → (cotización, partida) lo escribe SÓLO el servidor (RPC adjuntar_costeo_a_partida),
--     es de UN SOLO USO (un costeo, una partida) y la emisión exige ese vínculo. `bomHash` queda como dato informativo.
--   · Frescura: un costeo certificado guarda la traza de precios (precio_id, importe, aprobador). La emisión exige
--     que cada precio_id siga vigente, aprobado por el mismo aprobador y siendo el precio que hoy elige
--     catalogo_vigente para su insumo. Un costeo viejo NO es credencial después de un cambio de precio.
--   · CERTIFICADO ⇒ costo > 0 (CHECK + motivo).
--   · Despliegue escalonado: politica_emision_autoridad.modo = 'preparado' (por omisión) NO bloquea nada; sólo
--     diagnostica (public.diagnostico_autoridad_costeo). Dirección pasa a 'estricto' DESPUÉS de desplegar la Edge y
--     el cliente que producen y vinculan costeos y de revisar el diagnóstico. Aplicar esto no cambia la emisión.
--
--  Lo que NO hace: no reescribe filas existentes, no toca precios, no cambia emitir_revision_v2 / asignar_folio_oficial /
--  private_api.evaluar_emision_cotizacion (cuerpo de producción intacto).
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
  warnings jsonb not null default '[]'::jsonb,
  -- Vínculo server-owned (lo escribe SÓLO adjuntar_costeo_a_partida).
  cotizacion_id bigint references public.cotizaciones(id) on delete set null,
  partida_id text,
  vinculado_en timestamptz,
  vinculado_por text,
  constraint costeo_certificado_positivo check (estado <> 'certificado' or costo_unitario > 0),
  constraint costeo_vinculo_completo check ((cotizacion_id is null) = (partida_id is null))
);
create unique index if not exists costeos_servidor_una_partida on public.costeos_servidor (cotizacion_id, partida_id) where cotizacion_id is not null;
comment on table public.costeos_servidor is
  'SEG-01c · costeo autoritativo. Lo escribe la Edge costear-servidor (service_role); el vínculo a (cotización, partida) sólo adjuntar_costeo_a_partida. La emisión exige vínculo, certificación, frescura y costo idéntico.';
alter table public.costeos_servidor enable row level security;
revoke all on table public.costeos_servidor from public, anon, authenticated;
grant select, insert on table public.costeos_servidor to service_role;

create table if not exists public.cuentas_no_humanas (
  email text primary key,
  motivo text not null,
  registrado_en timestamptz not null default now()
);
comment on table public.cuentas_no_humanas is
  'P1-03 · cuentas cuya aprobación NO cuenta como humana (pruebas, procesos). Lista explícita, no regex.';
alter table public.cuentas_no_humanas enable row level security;
revoke all on table public.cuentas_no_humanas from public, anon, authenticated;
grant select on table public.cuentas_no_humanas to service_role;
insert into public.cuentas_no_humanas(email, motivo) values
  ('qa-direccion@vonhaucke.mx', 'cuenta de pruebas QA (rol direccion en permitidos)'),
  ('reconciliacion', 'proceso automático de reconciliación')
on conflict (email) do nothing;

create table if not exists private_api.politica_emision_autoridad (
  id boolean primary key default true check (id),
  modo text not null default 'preparado' check (modo in ('preparado', 'estricto')),
  legacy_sin_costeo_hasta timestamptz,
  decidido_por text,
  decidido_en timestamptz
);
insert into private_api.politica_emision_autoridad(id) values (true) on conflict (id) do nothing;
revoke all on table private_api.politica_emision_autoridad from public, anon, authenticated;
-- El wrapper de emisión es INVOKER (corre como la sesión): lee el modo por esta función, no la tabla (sin grant).
create or replace function private_api.modo_emision_autoridad() returns text
language sql stable security definer set search_path to 'private_api' as $$
  select coalesce((select modo from private_api.politica_emision_autoridad where id), 'preparado') $$;
revoke all on function private_api.modo_emision_autoridad() from public, anon;
grant execute on function private_api.modo_emision_autoridad() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Vínculo autoritativo costeo → (cotización, partida). Un solo uso. El servidor escribe la economía del renglón.
-- ----------------------------------------------------------------------------
create or replace function private_api.adjuntar_costeo_a_partida(p_cotizacion_id bigint, p_partida_id text, p_costeo_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'private_api' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_rol text; v_c record; v_k record; v_i int; v_p jsonb; v_cant integer; v_act timestamptz;
begin
  select lower(rol) into v_rol from public.permitidos where lower(email) = v_email limit 1;
  if v_email = '' or coalesce(v_rol, '') not in ('direccion', 'diseno') then raise exception 'no autorizado: sólo Dirección o Diseño vinculan costeos'; end if;
  select id, usuario, estado, partidas into v_c from public.cotizaciones where id = p_cotizacion_id for update;
  if not found then raise exception 'cotizacion no existe'; end if;
  if lower(coalesce(v_c.estado, 'borrador')) <> 'borrador' then raise exception 'cotizacion no editable en estado %', v_c.estado; end if;
  if not (lower(coalesce(v_c.usuario, '')) = v_email or private_api.puede_editar_config()) then raise exception 'sin acceso'; end if;
  select * into v_k from public.costeos_servidor where id = p_costeo_id for update;
  if not found then raise exception 'costeo inexistente'; end if;
  if lower(v_k.creado_por) <> v_email then raise exception 'el costeo lo hizo otra persona: recostea'; end if;
  if v_k.cotizacion_id is not null and (v_k.cotizacion_id <> p_cotizacion_id or v_k.partida_id <> p_partida_id) then
    raise exception 'costeo ya vinculado a otra partida: recostea (un costeo, una partida)';
  end if;
  select ord - 1, value into v_i, v_p from jsonb_array_elements(coalesce(v_c.partidas, '[]'::jsonb)) with ordinality d(value, ord)
   where value->>'id' = p_partida_id limit 1;
  if v_i is null then raise exception 'partida % no existe en la cotizacion', p_partida_id; end if;
  if coalesce(nullif(v_p->>'producto_id', ''), nullif(v_p->>'productoId', '')) is not null then raise exception 'partida canónica: su costo es el de producto_version_economia'; end if;
  begin v_cant := nullif(v_p->>'cantidad', '')::integer; exception when others then v_cant := null; end;
  if v_cant is distinct from v_k.cantidad then raise exception 'la partida tiene otra cantidad (% vs %): recostea', v_cant, v_k.cantidad; end if;
  update public.cotizaciones
     set partidas = jsonb_set(partidas, array[v_i::text], v_p || jsonb_build_object(
           'costoUnitario', v_k.costo_unitario, 'costoEstado', v_k.estado, 'costeoId', v_k.id::text, 'bomHash', v_k.bom_hash))
   where id = p_cotizacion_id
  returning actualizado into v_act;
  update public.costeos_servidor
     set cotizacion_id = p_cotizacion_id, partida_id = p_partida_id, vinculado_en = coalesce(vinculado_en, now()), vinculado_por = coalesce(vinculado_por, v_email)
   where id = p_costeo_id;
  -- `actualizado`: con VH-148b la escritura sube la versión; el cliente la adopta para no recibir un 409 falso.
  return jsonb_build_object('ok', true, 'cotizacion_id', p_cotizacion_id, 'partida_id', p_partida_id, 'costeo_id', p_costeo_id,
    'estado', v_k.estado, 'actualizado', to_json(v_act)#>>'{}');
end $$;
revoke all on function private_api.adjuntar_costeo_a_partida(bigint, text, uuid) from public, anon;
grant execute on function private_api.adjuntar_costeo_a_partida(bigint, text, uuid) to authenticated, service_role;

create or replace function public.adjuntar_costeo_a_partida(p_cotizacion_id bigint, p_partida_id text, p_costeo_id uuid)
returns jsonb language plpgsql set search_path to 'pg_catalog', 'public', 'private_api' as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  return private_api.adjuntar_costeo_a_partida(p_cotizacion_id, p_partida_id, p_costeo_id);
end $$;
revoke all on function public.adjuntar_costeo_a_partida(bigint, text, uuid) from public, anon;
grant execute on function public.adjuntar_costeo_a_partida(bigint, text, uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Motivos de autoridad por renglón especial (se calculan SIEMPRE; el wrapper sólo los aplica en modo 'estricto').
-- ----------------------------------------------------------------------------
create or replace function private_api.motivos_autoridad_costeo(p_cotizacion_id bigint)
returns text[] language plpgsql stable security definer set search_path to 'public', 'private_api' as $$
declare
  v_c record; v_p jsonb; v_ord bigint; v_out text[] := '{}'; v_cid text; v_r record; v_hasta timestamptz;
  v_costo numeric; v_cant integer; v_e jsonb; v_fresco boolean;
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
    -- El vínculo lo escribió el servidor: el costeo pertenece a ESTA cotización y a ESTA partida.
    if v_r.cotizacion_id is distinct from p_cotizacion_id or v_r.partida_id is distinct from nullif(v_p->>'id', '') then
      v_out := array_append(v_out, format('linea_%s_costeo_no_vinculado_a_esta_partida', v_ord)); continue; end if;
    if lower(v_r.rol) not in ('direccion', 'diseno') then
      v_out := array_append(v_out, format('linea_%s_costeo_sin_autoridad', v_ord)); continue; end if;
    if v_r.estado <> 'certificado' or not v_r.aprobacion_humana then
      v_out := array_append(v_out, format('linea_%s_costeo_servidor_no_certificado', v_ord)); continue; end if;
    if v_r.costo_unitario <= 0 then v_out := array_append(v_out, format('linea_%s_costo_cero', v_ord)); continue; end if;
    begin v_cant := nullif(v_p->>'cantidad', '')::integer; exception when others then v_cant := null; end;
    if v_cant is distinct from v_r.cantidad then
      v_out := array_append(v_out, format('linea_%s_costeo_de_otra_cantidad', v_ord)); continue; end if;
    begin v_costo := nullif(v_p->>'costoUnitario', '')::numeric; exception when others then v_costo := null; end;
    if v_costo is null or round(v_costo, 2) <> round(v_r.costo_unitario, 2) then
      v_out := array_append(v_out, format('linea_%s_costo_no_coincide_con_servidor', v_ord)); continue; end if;
    -- Frescura: cada precio del costeo sigue vigente, aprobado por el mismo aprobador y es el que hoy elige la vista.
    if jsonb_typeof(v_r.precios) <> 'array' or jsonb_array_length(v_r.precios) = 0 then
      v_out := array_append(v_out, format('linea_%s_costeo_sin_traza_de_precios', v_ord)); continue; end if;
    v_fresco := true;
    for v_e in select value from jsonb_array_elements(v_r.precios) loop
      if not exists (
        select 1 from public.insumo_precios ip
          join public.catalogo_vigente cv on cv.insumo_id = ip.insumo_id
         where ip.id = nullif(v_e->>'precio_id', '')::bigint
           and ip.vigente_hasta is null and ip.estado = 'aprobado'
           and lower(coalesce(ip.approved_by, '')) = lower(coalesce(v_e->>'approved_by', ''))
           and round(cv.precio, 2) = round(ip.precio, 2)
           and round(ip.precio, 2) = round(nullif(v_e->>'precio_usado', '')::numeric, 2)) then
        v_fresco := false; exit;
      end if;
    end loop;
    if not v_fresco then v_out := array_append(v_out, format('linea_%s_costeo_con_precio_ya_no_vigente', v_ord)); continue; end if;
  end loop;
  return v_out;
end $$;
revoke all on function private_api.motivos_autoridad_costeo(bigint) from public, anon;
grant execute on function private_api.motivos_autoridad_costeo(bigint) to authenticated, service_role;

-- Diagnóstico para Dirección ANTES de pasar a 'estricto': qué bloquearía hoy, sin bloquear nada.
create or replace function public.diagnostico_autoridad_costeo(p_cotizacion_id bigint)
returns jsonb language plpgsql stable set search_path to 'pg_catalog', 'public', 'private_api' as $$
begin
  if auth.uid() is null or not private_api.puede_ver_economia() then raise exception 'no autorizado'; end if;
  return jsonb_build_object('modo', private_api.modo_emision_autoridad(),
    'motivos', to_jsonb(private_api.motivos_autoridad_costeo(p_cotizacion_id)));
end $$;
revoke all on function public.diagnostico_autoridad_costeo(bigint) from public, anon;
grant execute on function public.diagnostico_autoridad_costeo(bigint) to authenticated;

-- Wrapper vigente (VH-035c) + motivos de autoridad SÓLO en modo 'estricto'.
create or replace function public.evaluar_emision_cotizacion(p_cotizacion_id bigint, p_snapshot jsonb)
returns jsonb language plpgsql stable set search_path to 'pg_catalog', 'public', 'private_api' as $function$
declare v_gate jsonb; v_stale text[]; v_state text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  v_gate := private_api.evaluar_emision_cotizacion(p_cotizacion_id, p_snapshot);
  v_stale := private_api.motivos_recosteo_pendiente(p_cotizacion_id)
    || case when private_api.modo_emision_autoridad() = 'estricto'
            then private_api.motivos_autoridad_costeo(p_cotizacion_id) else '{}'::text[] end;
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
--  ACTIVACIÓN (paso aparte, decisión de Dirección, DESPUÉS de Edge + cliente nuevos y de revisar el diagnóstico):
--    update private_api.politica_emision_autoridad set modo = 'estricto', decidido_por = '<email>', decidido_en = now();
--  ROLLBACK: restaurar el wrapper de VH-035c (md5 cf6ef6a30bbb68eb2b867f2bcdb7c846) y quitar las funciones nuevas.
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
-- RB drop function if exists public.diagnostico_autoridad_costeo(bigint);
-- RB drop function if exists public.adjuntar_costeo_a_partida(bigint, text, uuid);
-- RB drop function if exists private_api.adjuntar_costeo_a_partida(bigint, text, uuid);
-- RB drop function if exists private_api.motivos_autoridad_costeo(bigint);
-- RB drop function if exists private_api.modo_emision_autoridad();
-- RB drop table if exists private_api.politica_emision_autoridad;
-- RB commit;
-- (costeos_servidor y cuentas_no_humanas se conservan como rastro; borrarlas sólo con decisión expresa.)
-- ============================================================================
