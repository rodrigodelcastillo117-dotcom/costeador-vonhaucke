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
--  REVISIÓN 2 (reauditoría externa v2, 14-oct · P0-01/P0-02/P1-01/P2-02 + hueco propio):
--   · HUELLA DE LA PARTIDA (P0-01): al vincular, el servidor guarda md5 de la DEFINICIÓN de la partida tal como
--     quedó persistida (private_api.partida_definicion de VH-035c, sin render ni enlaces de acomodo). La emisión la
--     recalcula y exige igualdad: renombrar, redimensionar, cambiar material/nota/despiece o borrar y recrear la partida
--     con el mismo id ⇒ 'partida_cambio_desde_el_costeo'. Re-vincular NO lava un cambio: si la huella ya no coincide,
--     adjuntar se rechaza.
--   · CAS EN EL VÍNCULO (P0-02): adjuntar_costeo_a_partida exige p_actualizado_esperado (22004 sin él, 40001 si la
--     cotización cambió entre el guardado y el vínculo). La firma de 3 argumentos ya no existe.
--     Por eso SEG-01c EXIGE VH-148b aplicada (trigger trg_vh148_version): sin él `actualizado` no sube en producción
--     (verificado 14-oct: sólo `default now()`) y el CAS no detectaría nada. El bloque de verificación aborta si falta.
--   · CANÓNICA = producto_id Y producto_version_id NUMÉRICOS (hueco propio): antes se saltaba toda partida con
--     `productoId`, que en el cliente es la CLAVE DE LÍNEA (texto). Un especial con productoId:'X' y sin costeoId
--     pasaba sin autoridad y el gate de producción toma su costo de la fila ("legacy"). Ahora sólo se salta lo que el
--     gate de producción trata como canónico; lo legacy con clave de texto también exige costeo del servidor.
--   · FRESCURA DE LA BASE DE COSTO (P1-01): además de los precios, el costeo guarda huella de config.datos.parametros
--     + catalogo_motor de los insumos usados (formato, unidad, atributos, precio) y la versión del motor. Política
--     `frescura`: 'exigir_vigente' (por omisión, fail-closed) o 'congelar_al_costear' — DECISIÓN DE DIRECCIÓN pendiente.
--   · ACCESO (P2-02): motivos_autoridad_costeo verifica que la sesión sea dueña de la cotización o vea economía.
--  Lo que NO hace: no reescribe filas existentes, no toca precios, no cambia emitir_revision_v2 / asignar_folio_oficial /
--  private_api.evaluar_emision_cotizacion (cuerpo de producción intacto).
-- ============================================================================
begin;

-- Dependencias duras: VH-035c (partida_definicion) y VH-148b (versión que sube en TODA escritura). catalogo_motor (VH-088,
-- aplicada) se resuelve al ejecutar; P1-03b (precio_id en la vista) la exige el modo estricto (sin ella: fail-closed).
do $$ begin
  if to_regprocedure('private_api.partida_definicion(jsonb)') is null then
    raise exception 'SEG-01c requiere VH-035c (private_api.partida_definicion)'; end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.cotizaciones'::regclass and tgname = 'trg_vh148_version') then
    raise exception 'SEG-01c requiere VH-148b aplicada antes (trigger trg_vh148_version): sin él el CAS del vínculo no detecta nada'; end if;
end $$;

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
  -- Frescura de la base de costo (los escribe la Edge): huella de parámetros + catálogo de los insumos usados.
  insumos_usados text[] not null default '{}',
  base_costo_huella text,
  -- Vínculo server-owned (lo escribe SÓLO adjuntar_costeo_a_partida).
  cotizacion_id bigint references public.cotizaciones(id) on delete set null,
  partida_id text,
  vinculado_en timestamptz,
  vinculado_por text,
  partida_huella text,   -- md5 de la definición de la partida al vincular (lo calcula el servidor)
  constraint costeo_certificado_positivo check (estado <> 'certificado' or costo_unitario > 0),
  constraint costeo_vinculo_completo check ((cotizacion_id is null) = (partida_id is null) and (cotizacion_id is null) = (partida_huella is null))
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
  -- DECISIÓN DE DIRECCIÓN pendiente (P1-01). Por omisión fail-closed: la emisión exige bases de costo vigentes.
  frescura text not null default 'exigir_vigente' check (frescura in ('exigir_vigente', 'congelar_al_costear')),
  -- Versión del motor desplegada; si se fija, un costeo de otra versión no emite (lo pone el runbook de despliegue).
  version_motor_vigente text,
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
-- Huellas (las calcula SÓLO el servidor).
-- ----------------------------------------------------------------------------
-- Definición de la partida (VH-035c: sin economía a cualquier profundidad, null = ausente, sin precio/descuento, sin
-- claves de autoridad, sin cantidad, arreglos sin orden) MENOS lo que no cambia el mueble: el render y los enlaces
-- al acomodo. Todo lo demás (nombre, medidas, material, nota, config, variantes, pieza/despiece, piezaId, ruta,
-- claves de línea, bomHash) entra: una clave nueva o desconocida también cuenta (fail-closed).
create or replace function private_api.huella_partida(p jsonb)
returns text language sql immutable set search_path to 'public', 'private_api' as $$
  select md5((private_api.partida_definicion(p) - array['render', 'zone_id', 'instance_id', 'anchor_instance_id', 'anchor_role',
    'functional_group_id', 'relation_role', 'requirement_id', 'plan_tag', 'plan_source_ref', 'grouping', 'placement_profile'])::text) $$;
revoke all on function private_api.huella_partida(jsonb) from public, anon;
grant execute on function private_api.huella_partida(jsonb) to authenticated, service_role;

-- Base de costo: parámetros del motor (config) + lo que catalogo_motor entrega para los insumos usados (precio, unidad,
-- formato, atributos). Sin funciones de tiempo: mismo dato ⇒ misma huella.
create or replace function private_api.huella_base_costo(p_ids text[])
returns text language plpgsql stable security definer set search_path to 'public', 'private_api' as $$
begin
  return md5(jsonb_build_object(
    'parametros', coalesce((select datos->'parametros' from public.config where id = 'vonhaucke'), '{}'::jsonb),
    'insumos', coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(private_api.catalogo_motor(false, p_ids)) e
                          where e.key = any(coalesce(p_ids, '{}'))), '{}'::jsonb))::text);
end $$;
revoke all on function private_api.huella_base_costo(text[]) from public, anon, authenticated;
grant execute on function private_api.huella_base_costo(text[]) to service_role;
-- La Edge (service_role, PostgREST sólo expone public) la pide al registrar el costeo.
create or replace function public.huella_base_costo(p_ids text[])
returns text language sql stable set search_path to 'pg_catalog', 'public', 'private_api' as $$ select private_api.huella_base_costo(p_ids) $$;
revoke all on function public.huella_base_costo(text[]) from public, anon, authenticated;
grant execute on function public.huella_base_costo(text[]) to service_role;

-- ----------------------------------------------------------------------------
-- Vínculo autoritativo costeo → (cotización, partida). Un solo uso, con CAS. El servidor escribe la economía del
-- renglón y la huella de su definición.
-- ----------------------------------------------------------------------------
create or replace function private_api.adjuntar_costeo_a_partida(p_cotizacion_id bigint, p_partida_id text, p_costeo_id uuid, p_actualizado_esperado timestamptz)
returns jsonb language plpgsql security definer set search_path to 'public', 'private_api' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_rol text; v_c record; v_k record; v_i int; v_p jsonb; v_nueva jsonb; v_cant integer; v_act timestamptz; v_iso text; v_huella text;
begin
  if p_actualizado_esperado is null then
    raise exception 'VERSION_REQUIRED: falta p_actualizado_esperado (el actualizado que devolvió tu guardado)'
      using errcode = '22004', hint = 'Manda el `actualizado` de la respuesta del guardado; si encadenas vínculos, el de la respuesta anterior.';
  end if;
  select lower(rol) into v_rol from public.permitidos where lower(email) = v_email limit 1;
  if v_email = '' or coalesce(v_rol, '') not in ('direccion', 'diseno') then raise exception 'no autorizado: sólo Dirección o Diseño vinculan costeos'; end if;
  select id, usuario, estado, partidas, actualizado into v_c from public.cotizaciones where id = p_cotizacion_id for update;
  if not found then raise exception 'cotizacion no existe'; end if;
  if lower(coalesce(v_c.estado, 'borrador')) <> 'borrador' then raise exception 'cotizacion no editable en estado %', v_c.estado; end if;
  if not (lower(coalesce(v_c.usuario, '')) = v_email or private_api.puede_editar_config()) then raise exception 'sin acceso'; end if;
  -- CAS: la partida que se vincula es la que guardó ESTE cliente, no una que otra pestaña cambió después.
  if v_c.actualizado is distinct from p_actualizado_esperado then
    v_iso := to_json(v_c.actualizado)#>>'{}';
    raise exception 'CONFLICTO_VERSION: la cotización cambió entre tu guardado y el vínculo del costeo (%). Recarga y revisa la partida.', v_iso
      using errcode = '40001', detail = 'actualizado=' || v_iso;
  end if;
  select * into v_k from public.costeos_servidor where id = p_costeo_id for update;
  if not found then raise exception 'costeo inexistente'; end if;
  if lower(v_k.creado_por) <> v_email then raise exception 'el costeo lo hizo otra persona: recostea'; end if;
  if v_k.cotizacion_id is not null and (v_k.cotizacion_id <> p_cotizacion_id or v_k.partida_id <> p_partida_id) then
    raise exception 'costeo ya vinculado a otra partida: recostea (un costeo, una partida)';
  end if;
  select ord - 1, value into v_i, v_p from jsonb_array_elements(coalesce(v_c.partidas, '[]'::jsonb)) with ordinality d(value, ord)
   where value->>'id' = p_partida_id limit 1;
  if v_i is null then raise exception 'partida % no existe en la cotizacion', p_partida_id; end if;
  -- Canónica = lo que el gate de producción trata como canónico (ids numéricos). Una clave de línea de texto NO lo es.
  if coalesce(v_p->>'producto_id', v_p->>'productoId', v_p->>'product_id', '') ~ '^[0-9]+$'
     and coalesce(v_p->>'producto_version_id', v_p->>'productoVersionId', v_p->>'product_version_id', '') ~ '^[0-9]+$' then
    raise exception 'partida canónica: su costo es el de producto_version_economia';
  end if;
  begin v_cant := nullif(v_p->>'cantidad', '')::integer; exception when others then v_cant := null; end;
  if v_cant is distinct from v_k.cantidad then raise exception 'la partida tiene otra cantidad (% vs %): recostea', v_cant, v_k.cantidad; end if;
  -- Re-vincular (cada guardado puede hacerlo) NO lava un cambio de la partida: la huella debe seguir siendo la misma.
  if v_k.partida_huella is not null and v_k.partida_huella <> private_api.huella_partida(v_p) then
    raise exception 'la partida cambió desde que se vinculó este costeo: recostea';
  end if;
  v_nueva := v_p || jsonb_build_object('costoUnitario', v_k.costo_unitario, 'costoEstado', v_k.estado, 'costeoId', v_k.id::text, 'bomHash', v_k.bom_hash);
  update public.cotizaciones set partidas = jsonb_set(partidas, array[v_i::text], v_nueva)
   where id = p_cotizacion_id
  returning actualizado, partidas->v_i into v_act, v_nueva;
  -- Huella de lo que QUEDÓ guardado (los triggers de escritura pueden normalizar la partida).
  v_huella := private_api.huella_partida(v_nueva);
  update public.costeos_servidor
     set cotizacion_id = p_cotizacion_id, partida_id = p_partida_id, partida_huella = v_huella,
         vinculado_en = coalesce(vinculado_en, now()), vinculado_por = coalesce(vinculado_por, v_email)
   where id = p_costeo_id;
  -- `actualizado`: la escritura sube la versión (VH-148b); el cliente la adopta y la encadena al siguiente vínculo.
  return jsonb_build_object('ok', true, 'cotizacion_id', p_cotizacion_id, 'partida_id', p_partida_id, 'costeo_id', p_costeo_id,
    'estado', v_k.estado, 'actualizado', to_json(v_act)#>>'{}');
end $$;
revoke all on function private_api.adjuntar_costeo_a_partida(bigint, text, uuid, timestamptz) from public, anon;
grant execute on function private_api.adjuntar_costeo_a_partida(bigint, text, uuid, timestamptz) to authenticated, service_role;

create or replace function public.adjuntar_costeo_a_partida(p_cotizacion_id bigint, p_partida_id text, p_costeo_id uuid, p_actualizado_esperado timestamptz)
returns jsonb language plpgsql set search_path to 'pg_catalog', 'public', 'private_api' as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  return private_api.adjuntar_costeo_a_partida(p_cotizacion_id, p_partida_id, p_costeo_id, p_actualizado_esperado);
end $$;
revoke all on function public.adjuntar_costeo_a_partida(bigint, text, uuid, timestamptz) from public, anon;
grant execute on function public.adjuntar_costeo_a_partida(bigint, text, uuid, timestamptz) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Motivos de autoridad por renglón especial (se calculan SIEMPRE; el wrapper sólo los aplica en modo 'estricto').
-- ----------------------------------------------------------------------------
create or replace function private_api.motivos_autoridad_costeo(p_cotizacion_id bigint)
returns text[] language plpgsql stable security definer set search_path to 'public', 'private_api' as $$
declare
  v_c record; v_p jsonb; v_ord bigint; v_out text[] := '{}'; v_cid text; v_r record; v_hasta timestamptz;
  v_costo numeric; v_cant integer; v_e jsonb; v_fresco boolean; v_pol record;
  v_vista_con_pid boolean := exists (select 1 from pg_attribute where attrelid = to_regclass('public.catalogo_vigente')
                                      and attname = 'precio_id' and not attisdropped);
begin
  select id, usuario, creado, partidas into v_c from public.cotizaciones where id = p_cotizacion_id;
  if not found then return v_out; end if;
  -- P2-02: una sesión sólo consulta cotizaciones propias o, si ve economía, cualquiera. (service_role: sin sesión.)
  if auth.uid() is not null and not (lower(coalesce(v_c.usuario, '')) = lower(coalesce(auth.jwt()->>'email', '')) or private_api.puede_ver_economia()) then
    raise exception 'sin acceso';
  end if;
  select legacy_sin_costeo_hasta, frescura, version_motor_vigente into v_pol from private_api.politica_emision_autoridad where id;
  v_hasta := v_pol.legacy_sin_costeo_hasta;
  for v_p, v_ord in select value, ord from jsonb_array_elements(coalesce(v_c.partidas, '[]'::jsonb)) with ordinality d(value, ord) loop
    -- Sólo lo canónico (ids numéricos, como lo trata el gate de producción) queda fuera; la clave de línea de texto no.
    if coalesce(v_p->>'producto_id', v_p->>'productoId', v_p->>'product_id', '') ~ '^[0-9]+$'
       and coalesce(v_p->>'producto_version_id', v_p->>'productoVersionId', v_p->>'product_version_id', '') ~ '^[0-9]+$' then continue; end if;
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
    -- …y a ESTA definición: la partida no cambió (nombre, medidas, material, despiece…) desde que se vinculó.
    if v_r.partida_huella is null or v_r.partida_huella <> private_api.huella_partida(v_p) then
      v_out := array_append(v_out, format('linea_%s_partida_cambio_desde_el_costeo', v_ord)); continue; end if;
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
    -- Frescura (política de Dirección): 'congelar_al_costear' acepta el costo del día en que se costeó.
    if v_pol.frescura = 'congelar_al_costear' then continue; end if;
    -- Precios: cada precio del costeo sigue vigente, aprobado por el mismo aprobador y es el que hoy elige la vista.
    if jsonb_typeof(v_r.precios) <> 'array' or jsonb_array_length(v_r.precios) = 0 then
      v_out := array_append(v_out, format('linea_%s_costeo_sin_traza_de_precios', v_ord)); continue; end if;
    -- …y es EXACTAMENTE la fila que hoy elige catalogo_vigente (precio_id, P1-03b): mismo importe con otra fila no basta.
    if not v_vista_con_pid then
      v_out := array_append(v_out, format('linea_%s_catalogo_sin_precio_id', v_ord)); continue; end if;
    v_fresco := true;
    for v_e in select value from jsonb_array_elements(v_r.precios) loop
      if not exists (
        select 1 from public.insumo_precios ip
          join public.catalogo_vigente cv on cv.insumo_id = ip.insumo_id and cv.precio_id = ip.id
         where ip.id = nullif(v_e->>'precio_id', '')::bigint
           and ip.vigente_hasta is null and ip.estado = 'aprobado'
           and lower(coalesce(ip.approved_by, '')) = lower(coalesce(v_e->>'approved_by', ''))
           and round(ip.precio, 2) = round(nullif(v_e->>'precio_usado', '')::numeric, 2)) then
        v_fresco := false; exit;
      end if;
    end loop;
    if not v_fresco then v_out := array_append(v_out, format('linea_%s_costeo_con_precio_ya_no_vigente', v_ord)); continue; end if;
    -- Base de costo (después de los precios: un cambio de precio da el motivo más preciso).
    if v_pol.version_motor_vigente is not null and v_r.version_motor is distinct from v_pol.version_motor_vigente then
      v_out := array_append(v_out, format('linea_%s_costeo_de_otra_version_de_motor', v_ord)); continue; end if;
    if v_r.base_costo_huella is null then
      v_out := array_append(v_out, format('linea_%s_costeo_sin_huella_de_base', v_ord)); continue; end if;
    if v_r.base_costo_huella <> private_api.huella_base_costo(v_r.insumos_usados) then
      v_out := array_append(v_out, format('linea_%s_base_de_costo_cambio', v_ord)); continue; end if;
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
--  ORDEN: VH-035c (aplicada) → VH-148b → P1-03b → SEG-01c (preparado). P1-03b ANTES: cambia la salida de catalogo_motor
--  (agrega precioId) y con ello la huella de base; aplicarla después invalidaría una vez todos los costeos ya registrados.
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
-- RB drop function if exists public.adjuntar_costeo_a_partida(bigint, text, uuid, timestamptz);
-- RB drop function if exists private_api.adjuntar_costeo_a_partida(bigint, text, uuid, timestamptz);
-- RB drop function if exists public.huella_base_costo(text[]);
-- RB drop function if exists private_api.huella_base_costo(text[]);
-- RB drop function if exists private_api.huella_partida(jsonb);
-- RB drop function if exists private_api.motivos_autoridad_costeo(bigint);
-- RB drop function if exists private_api.modo_emision_autoridad();
-- RB drop table if exists private_api.politica_emision_autoridad;
-- RB commit;
-- (costeos_servidor y cuentas_no_humanas se conservan como rastro; borrarlas sólo con decisión expresa.)
-- ============================================================================
