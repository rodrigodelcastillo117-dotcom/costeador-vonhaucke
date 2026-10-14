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
--  REVISIÓN 3 (reauditoría externa v3, 14-oct · P0-01/P0-02/P1-01/P1-05):
--   · IDENTIDAD DE ORIGEN (P0-01): la Edge recibe, en la MISMA solicitud que el despiece, la identidad del mueble
--     (nombre, w, d) y la guarda en el costeo (`identidad_origen`) junto con el despiece costeado
--     (`componentes_costeados`, para auditoría). El PRIMER vínculo exige que la identidad de la partida (nombre, w, d,
--     h, medidas, material, descripción) sea EXACTAMENTE la declarada al costear. Atar el costeo de un escritorio a
--     una mesa exige declarar en falso AL COSTEAR, y eso queda registrado con autor. Límite declarado: el servidor no
--     puede saber que un despiece "es" una mesa; la identidad la declara quien costea (Dirección/Diseño).
--   · RECOSTEO K1→K2 (P0-02): el vínculo VIGENTE vive en `partida_costeo_vigente` (una fila por partida). Un costeo
--     sigue siendo de un solo uso (`costeos_servidor.cotizacion_id/partida_id` = dónde se consumió), pero la partida
--     puede pasar a un costeo nuevo; el anterior queda `reemplazado_por`. Se quitó el índice único
--     (cotizacion_id, partida_id) de `costeos_servidor`, que hacía imposible recostear.
--   · TRASPASO DE ROL (P1-01): re-vincular el MISMO costeo vigente a la MISMA partida sin cambios es idempotente para
--     cualquier Dirección/Diseño con acceso (Diseño costea, Dirección guarda). Ser el autor sólo se exige al vincular
--     un costeo nuevo.
--   · ACTIVACIÓN (P1-05): CHECK modo='estricto' ⇒ version_motor_vigente NOT NULL, y RPC
--     `activar_autoridad_costeo(modo, frescura, version_motor)` sólo para Dirección humana (no cuentas_no_humanas).
--  REVISIÓN 4 (cierre pre-deploy, 14-oct · promesa_comercial_v1):
--   · HUECO de rev3: la identidad (nombre, w, d, h, medidas, material, descripción) no veía lo que de verdad cambia el
--     mueble: material del despiece (insumoId), acabado/color/accesorios/electrificación (config), piezas incluidas y
--     excluidas, variante de catálogo. El K de un escritorio de melamina blanca se vinculaba por primera vez a otro
--     escritorio igual de nombre y medidas pero en nogal, con cajonera o con el cristal excluido.
--   · PROMESA COMERCIAL v1 (private_api.promesa_partida ≡ src/datos/promesaComercial.js, mismas fixtures doradas): la
--     proyección versionada de la partida a lo que se promete. Fuera: render, imagen, enlaces de acomodo, notas y
--     metadatos de UI, economía y cantidad (la cantidad se compara aparte). Inventario: SEG01C_REV4_PROMESA_COMERCIAL.md.
--   · La Edge guarda en el costeo `promesa_origen` (lo declarado al costear + materiales y piezas sacados del despiece
--     que el servidor costea). `promesa_version` y `promesa_huella` los fija el TRIGGER (servidor), re-proyectando con
--     la función SQL; nadie las cambia después.
--   · adjuntar_costeo_a_partida exige huella_promesa(partida actual) = promesa_huella(K) en el primer vínculo y en el
--     recosteo (K2 con SU promesa de origen) y también en la rama idempotente. Nunca aprende la promesa de la partida.
--   · motivos_autoridad_costeo: costeo sin promesa ⇒ no emite; promesa distinta a la del costeo ⇒ no emite.
--  REVISIÓN 5 (reauditoría final, P0 · spec_tecnica_v1):
--   · HUECO de rev4: la promesa comercial no distingue dos despieces técnicamente distintos con los mismos nombres e
--     insumos: "1 × Entrepaño MDF18" vs "3 × Entrepaño MDF18", un lateral de 700 vs uno de 900, 1 h vs 4 h de ensamble,
--     otra área pintada. El K de A se vinculaba por primera vez a B con la promesa idéntica.
--   · DOS AUTORIDADES: la promesa responde "¿qué se le promete al cliente?"; la SPEC TÉCNICA v1
--     (private_api.spec_tecnica ≡ src/datos/specTecnica.js, fixtures doradas compartidas) responde "¿qué despiece exacto
--     costeó el servidor?": la pieza saneada que entra al motor (todo lo que cruza la frontera del DTO), sin orden de
--     renglones y CON multiplicidad. Inventario: docs/auditoria/SEG01C_REV5_SPEC_TECNICA.md.
--   · La Edge guarda `spec_tecnica_origen` (la pieza saneada que costeó); el TRIGGER la re-proyecta en SQL y sella
--     `spec_tecnica_version='v1'` y `spec_tecnica_huella`; nadie las cambia después.
--   · La partida especial lleva su `especificacion_tecnica` (Costear la arma con la MISMA función sobre la MISMA pieza
--     saneada). adjuntar exige huella_spec_tecnica(partida) = spec_tecnica_huella(K) en el primer vínculo, el recosteo
--     y la rama idempotente; la emisión lo vuelve a exigir. El servidor re-proyecta la especificación de la partida:
--     no compara un hash que copie el navegador. Si el navegador reescribe la especificación de la partida para que
--     cuadre con un K barato, ESA especificación es la que se cotiza, se emite y queda en la huella de la partida.
--   · `bom_hash` queda INFORMATIVO (FNV-1a de 32 bits, sólo JS, no cubre horas, dificultad, pintura ni tubular; VH-035c
--     lo usa como dato de identidad). No es autoridad: la autoridad técnica es `spec_tecnica_huella`.
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
  -- Identidad del mueble declarada EN LA MISMA solicitud que el despiece, y el despiece costeado (auditoría).
  identidad_origen jsonb,
  componentes_costeados jsonb,
  -- rev4: promesa comercial de origen (proyección v1) y su huella; versión y huella las fija el trigger del servidor.
  promesa_origen jsonb,
  promesa_version text,
  promesa_huella text,
  -- rev5: especificación técnica de origen (la pieza saneada que costeó el motor); versión y huella las fija el trigger.
  spec_tecnica_origen jsonb,
  spec_tecnica_version text,
  spec_tecnica_huella text,
  -- Dónde se CONSUMIÓ (un costeo, una partida, para siempre). El vínculo vigente vive en partida_costeo_vigente.
  cotizacion_id bigint references public.cotizaciones(id) on delete set null,
  partida_id text,
  vinculado_en timestamptz,
  vinculado_por text,
  reemplazado_por uuid,  -- recosteo: el costeo que lo sustituyó en esa partida
  reemplazado_en timestamptz,
  constraint costeo_certificado_positivo check (estado <> 'certificado' or costo_unitario > 0),
  constraint costeo_vinculo_completo check ((cotizacion_id is null) = (partida_id is null))
);
comment on table public.costeos_servidor is
  'SEG-01c · costeo autoritativo. Lo escribe la Edge costear-servidor (service_role); el vínculo a (cotización, partida) sólo adjuntar_costeo_a_partida. La emisión exige vínculo, certificación, frescura y costo idéntico.';
alter table public.costeos_servidor enable row level security;
revoke all on table public.costeos_servidor from public, anon, authenticated;
grant select, insert on table public.costeos_servidor to service_role;
alter table public.costeos_servidor add column if not exists promesa_origen jsonb;
alter table public.costeos_servidor add column if not exists promesa_version text;
alter table public.costeos_servidor add column if not exists promesa_huella text;
alter table public.costeos_servidor add column if not exists spec_tecnica_origen jsonb;
alter table public.costeos_servidor add column if not exists spec_tecnica_version text;
alter table public.costeos_servidor add column if not exists spec_tecnica_huella text;
comment on column public.costeos_servidor.bom_hash is
  'INFORMATIVO (FNV-1a 32 bits del despiece, calculado en JS). No es autoridad: la autoridad técnica es spec_tecnica_huella.';

-- Vínculo VIGENTE: una fila por (cotización, partida); un costeo vigente en a lo más una partida.
create table if not exists public.partida_costeo_vigente (
  cotizacion_id bigint not null references public.cotizaciones(id) on delete cascade,
  partida_id text not null,
  costeo_id uuid not null references public.costeos_servidor(id),
  partida_huella text not null,   -- md5 de la definición de la partida al vincular (lo calcula el servidor)
  vinculado_por text not null,
  vinculado_en timestamptz not null default now(),
  primary key (cotizacion_id, partida_id)
);
create unique index if not exists partida_costeo_vigente_costeo on public.partida_costeo_vigente (costeo_id);
comment on table public.partida_costeo_vigente is
  'SEG-01c rev3 · costeo vigente de cada partida especial. Sólo lo escribe adjuntar_costeo_a_partida; recostear lo reemplaza (el costeo anterior queda reemplazado_por).';
alter table public.partida_costeo_vigente enable row level security;
revoke all on table public.partida_costeo_vigente from public, anon, authenticated;
grant select on table public.partida_costeo_vigente to service_role;

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
  decidido_en timestamptz,
  -- P1-05: no hay modo estricto sin versión de motor fijada (la frescura de motor no puede quedar apagada por olvido).
  constraint estricto_exige_version_motor check (modo <> 'estricto' or nullif(btrim(version_motor_vigente), '') is not null)
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

-- Identidad comercial de una partida (lo que el documento promete): nombre, medidas y material. Texto recortado,
-- números como número (120 = 120.0), null/'' = ausente. La misma proyección se aplica a la identidad declarada al costear.
create or replace function private_api.identidad_partida(p jsonb)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case when jsonb_typeof(p) <> 'object' then null else jsonb_strip_nulls(jsonb_build_object(
    'nombre', nullif(btrim(p->>'nombre'), ''),
    'w', case when jsonb_typeof(p->'w') = 'number' then p->'w' when btrim(p->>'w') ~ '^[0-9]+(\.[0-9]+)?$' then to_jsonb(btrim(p->>'w')::numeric) end,
    'd', case when jsonb_typeof(p->'d') = 'number' then p->'d' when btrim(p->>'d') ~ '^[0-9]+(\.[0-9]+)?$' then to_jsonb(btrim(p->>'d')::numeric) end,
    'h', case when jsonb_typeof(p->'h') = 'number' then p->'h' when btrim(p->>'h') ~ '^[0-9]+(\.[0-9]+)?$' then to_jsonb(btrim(p->>'h')::numeric) end,
    'medidas', nullif(btrim(p->>'medidas'), ''),
    'material', nullif(btrim(p->>'material'), ''),
    'descripcion', nullif(btrim(p->>'descripcion'), ''))) end $$;
revoke all on function private_api.identidad_partida(jsonb) from public, anon;
grant execute on function private_api.identidad_partida(jsonb) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- rev4 · PROMESA COMERCIAL v1. Gemela EXACTA de src/datos/promesaComercial.js (fixtures doradas compartidas):
--   texto = string recortado (espacio, tab, CR, LF) o ausente; número = número JSON o texto ^[0-9]+(\.[0-9]+)?$ sin ceros
--   de sobra (120 = 120.0); ids = texto (un número, sin ceros de sobra); config sin nulos ({} = ausente); listas
--   recortadas, sin vacíos ni repetidos, en COLLATE "C" (= orden por punto de código); materiales = insumoId de todo el
--   despiece ∪ materiales; nombresExcluidos = nombresExcluidos ∪ componentes con excluida = true; piezas = nombres del
--   despiece ∪ piezas, menos los excluidos. Salida con las claves de la partida, sin nulos: promesa(promesa(x)) = promesa(x).
-- ----------------------------------------------------------------------------
-- >>> promesa_v1 (bloque que también cargan las fixtures doradas: supabase/tests/promesaComercialGolden.test.js)
create or replace function private_api.promesa_texto(v jsonb)
returns text language sql immutable set search_path to 'pg_catalog' as $$
  select case when jsonb_typeof(v) = 'string' then nullif(btrim(v #>> '{}', E' \t\n\r'), '') end $$;
create or replace function private_api.promesa_numero(v jsonb)
returns jsonb language sql immutable set search_path to 'pg_catalog', 'private_api' as $$
  select case
    when jsonb_typeof(v) = 'number' then to_jsonb(trim_scale((v #>> '{}')::numeric))
    when private_api.promesa_texto(v) ~ '^[0-9]+(\.[0-9]+)?$' then to_jsonb(trim_scale(private_api.promesa_texto(v)::numeric))
  end $$;
create or replace function private_api.promesa_ident(v jsonb)
returns text language sql immutable set search_path to 'pg_catalog', 'private_api' as $$
  select case when jsonb_typeof(v) = 'number' then trim_scale((v #>> '{}')::numeric)::text else private_api.promesa_texto(v) end $$;
create or replace function private_api.promesa_lista(xs jsonb)
returns jsonb language sql immutable set search_path to 'pg_catalog', 'private_api' as $$
  select jsonb_agg(to_jsonb(t) order by t collate "C")
    from (select distinct private_api.promesa_texto(e) as t
            from jsonb_array_elements(case when jsonb_typeof(xs) = 'array' then xs else '[]'::jsonb end) e) s
   where t is not null $$;

create or replace function private_api.promesa_partida(p jsonb)
returns jsonb language plpgsql immutable set search_path to 'pg_catalog', 'private_api' as $$
declare v_comps jsonb; v_excl jsonb; v_piezas jsonb; v_cfg jsonb; v_clave text;
begin
  if jsonb_typeof(p) is distinct from 'object' then return null; end if;
  -- Despiece: componentes (costeo) y pieza.componentes (partida de IA); sólo objetos.
  select coalesce(jsonb_agg(c), '[]'::jsonb) into v_comps from (
    select c from jsonb_array_elements(case when jsonb_typeof(p->'componentes') = 'array' then p->'componentes' else '[]'::jsonb end) c
     where jsonb_typeof(c) = 'object'
    union all
    select c from jsonb_array_elements(case when jsonb_typeof(p->'pieza') = 'object' and jsonb_typeof(p->'pieza'->'componentes') = 'array'
                                            then p->'pieza'->'componentes' else '[]'::jsonb end) c
     where jsonb_typeof(c) = 'object') s;
  v_excl := private_api.promesa_lista(
    case when jsonb_typeof(p->'nombresExcluidos') = 'array' then p->'nombresExcluidos' else '[]'::jsonb end
    || coalesce((select jsonb_agg(to_jsonb(coalesce(private_api.promesa_texto(c->'nombre'), 'Partida excluida')))
                   from jsonb_array_elements(v_comps) c where c->'excluida' = 'true'::jsonb), '[]'::jsonb));
  select jsonb_agg(to_jsonb(t) order by t collate "C") into v_piezas
    from jsonb_array_elements_text(coalesce(private_api.promesa_lista(
           case when jsonb_typeof(p->'piezas') = 'array' then p->'piezas' else '[]'::jsonb end
           || coalesce((select jsonb_agg(coalesce(c->'nombre', 'null'::jsonb)) from jsonb_array_elements(v_comps) c), '[]'::jsonb)), '[]'::jsonb)) t
   where not coalesce(v_excl, '[]'::jsonb) ? t;
  v_cfg := case when jsonb_typeof(p->'config') = 'object' then nullif(jsonb_strip_nulls(p->'config'), '{}'::jsonb) end;
  v_clave := case when jsonb_typeof(p->'catalogo') = 'object' then private_api.promesa_texto(p->'catalogo'->'clave') end;
  return jsonb_strip_nulls(jsonb_build_object(
    'v', 'v1',
    'nombre', private_api.promesa_texto(p->'nombre'),
    'w', private_api.promesa_numero(p->'w'), 'd', private_api.promesa_numero(p->'d'), 'h', private_api.promesa_numero(p->'h'),
    'medidas', private_api.promesa_texto(p->'medidas'), 'material', private_api.promesa_texto(p->'material'),
    'acabado', private_api.promesa_texto(p->'acabado'), 'descripcion', private_api.promesa_texto(p->'descripcion'),
    'usuarios', private_api.promesa_numero(p->'usuarios'),
    'config', v_cfg,
    'catalogo', case when v_clave is not null then jsonb_build_object('clave', v_clave) end,
    'producto_id', private_api.promesa_ident(coalesce(nullif(p->'producto_id', 'null'::jsonb), p->'product_id')),
    'producto_version_id', private_api.promesa_ident(coalesce(nullif(p->'producto_version_id', 'null'::jsonb),
                                                     nullif(p->'productVersionId', 'null'::jsonb), p->'product_version_id')),
    'productoId', private_api.promesa_ident(p->'productoId'),
    'claveLinea', private_api.promesa_ident(p->'claveLinea'),
    'materiales', private_api.promesa_lista(
       case when jsonb_typeof(p->'materiales') = 'array' then p->'materiales' else '[]'::jsonb end
       || coalesce((select jsonb_agg(coalesce(c->'insumoId', 'null'::jsonb)) from jsonb_array_elements(v_comps) c), '[]'::jsonb)),
    'piezas', v_piezas,
    'nombresExcluidos', v_excl));
end $$;
create or replace function private_api.huella_promesa(p jsonb)
returns text language sql immutable set search_path to 'pg_catalog', 'private_api' as $$
  select md5(private_api.promesa_partida(p)::text) $$;
revoke all on function private_api.promesa_texto(jsonb) from public, anon;
revoke all on function private_api.promesa_numero(jsonb) from public, anon;
revoke all on function private_api.promesa_ident(jsonb) from public, anon;
revoke all on function private_api.promesa_lista(jsonb) from public, anon;
revoke all on function private_api.promesa_partida(jsonb) from public, anon;
revoke all on function private_api.huella_promesa(jsonb) from public, anon;
grant execute on function private_api.promesa_texto(jsonb), private_api.promesa_numero(jsonb), private_api.promesa_ident(jsonb),
  private_api.promesa_lista(jsonb), private_api.promesa_partida(jsonb), private_api.huella_promesa(jsonb) to authenticated, service_role;
-- <<< promesa_v1

-- La promesa de origen la normaliza y la sella el SERVIDOR al registrar el costeo; después no se cambia.
create or replace function private_api.costeo_promesa_servidor()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'private_api' as $$
begin
  if tg_op = 'UPDATE' then
    if new.promesa_origen is distinct from old.promesa_origen or new.promesa_version is distinct from old.promesa_version
       or new.promesa_huella is distinct from old.promesa_huella then
      raise exception 'la promesa de origen de un costeo no se cambia: recostea';
    end if;
    return new;
  end if;
  if new.promesa_origen is null or jsonb_typeof(new.promesa_origen) <> 'object' then
    new.promesa_origen := null; new.promesa_version := null; new.promesa_huella := null; return new;
  end if;
  if coalesce(new.promesa_version, 'v1') <> 'v1' then raise exception 'promesa_version desconocida: %', new.promesa_version; end if;
  new.promesa_origen := private_api.promesa_partida(new.promesa_origen);
  new.promesa_version := 'v1';
  new.promesa_huella := md5(new.promesa_origen::text);
  return new;
end $$;
revoke all on function private_api.costeo_promesa_servidor() from public, anon, authenticated;
create or replace trigger trg_costeo_promesa_servidor before insert or update on public.costeos_servidor
  for each row execute function private_api.costeo_promesa_servidor();

-- ----------------------------------------------------------------------------
--  rev5 · SPEC TÉCNICA v1 — la pieza saneada que entra al motor. Mismas reglas que src/datos/specTecnica.js:
--   texto recortado ('' = ausente), número JSON en [0, 2^53−1] y (0 ó ≥ 1e-6), bandera true; otro tipo presente ⇒ null
--   (fuera de contrato). Componentes ordenados por su clave canónica (campo=valor en orden fijo, U+001F, COLLATE "C");
--   la multiplicidad cuenta. horas {centro: número}; dificultad nivel o número 0.25–3. spec(spec(x)) = spec(x).
-- ----------------------------------------------------------------------------
-- >>> spec_v1 (bloque que también cargan las fixtures doradas: supabase/tests/specTecnicaGolden.test.js)
create or replace function private_api.spec_numero_ok(v jsonb)
returns boolean language sql immutable set search_path to 'pg_catalog' as $$
  select coalesce(jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric >= 0 and (v #>> '{}')::numeric <= 9007199254740991
         and ((v #>> '{}')::numeric = 0 or (v #>> '{}')::numeric >= 0.000001), false) $$;

create or replace function private_api.spec_tecnica(p jsonb)
returns jsonb language plpgsql immutable set search_path to 'pg_catalog', 'private_api' as $$
declare
  c_campos constant text[] := array['insumoId','nombre','cantidad','piezas','largoMM','anchoMM','hojas','areaPintadaM2','tubular',
    'material_solicitado','material_match','material_confirmado','engineering_override','override_motivo','procedencia',
    'pieza_confirmada','pendiente'];
  c_texto constant text[] := array['insumoId','nombre','material_solicitado','material_match','override_motivo','procedencia'];
  c_numero constant text[] := array['cantidad','piezas','largoMM','anchoMM','hojas','areaPintadaM2'];
  v_c jsonb; v_k text; v_v jsonb; v_o jsonb; v_t text; v_n numeric; v_partes text[];
  v_crudos jsonb := '[]'::jsonb; v_comps jsonb; v_horas jsonb := '{}'::jsonb; v_dif jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'componentes') is distinct from 'array'
     or jsonb_array_length(p->'componentes') = 0 then return null; end if;
  for v_c in select value from jsonb_array_elements(p->'componentes') loop
    if jsonb_typeof(v_c) is distinct from 'object' then return null; end if;
    v_o := '{}'::jsonb; v_partes := '{}'::text[];
    foreach v_k in array c_campos loop
      v_v := v_c->v_k;
      if v_v is null or jsonb_typeof(v_v) = 'null' then continue; end if;
      if v_k = any(c_texto) then
        if jsonb_typeof(v_v) <> 'string' then return null; end if;
        v_t := nullif(btrim(v_v #>> '{}', E' \t\n\r'), '');
        if v_t is null then continue; end if;
        v_o := v_o || jsonb_build_object(v_k, v_t);
        v_partes := v_partes || (v_k || '=' || v_t);
      elsif v_k = any(c_numero) then
        if not private_api.spec_numero_ok(v_v) then return null; end if;
        v_n := trim_scale((v_v #>> '{}')::numeric);
        v_o := v_o || jsonb_build_object(v_k, v_n);
        v_partes := v_partes || (v_k || '=' || v_n::text);
      else
        if jsonb_typeof(v_v) <> 'boolean' then return null; end if;
        if v_v = 'true'::jsonb then v_o := v_o || jsonb_build_object(v_k, true); v_partes := v_partes || (v_k || '=true'); end if;
      end if;
    end loop;
    v_crudos := v_crudos || jsonb_build_array(jsonb_build_object('k', array_to_string(v_partes, chr(31)), 'o', v_o));
  end loop;
  select jsonb_agg(e->'o' order by e->>'k' collate "C") into v_comps from jsonb_array_elements(v_crudos) e;
  if p ? 'horas' and jsonb_typeof(p->'horas') <> 'null' then
    if jsonb_typeof(p->'horas') <> 'object' then return null; end if;
    for v_k, v_v in select key, value from jsonb_each(p->'horas') loop
      v_t := btrim(v_k, E' \t\n\r');
      if v_t = '' or v_horas ? v_t or not private_api.spec_numero_ok(v_v) then return null; end if;
      v_horas := v_horas || jsonb_build_object(v_t, trim_scale((v_v #>> '{}')::numeric));
    end loop;
  end if;
  v_v := p->'dificultad';
  if v_v is not null and jsonb_typeof(v_v) <> 'null' then
    if jsonb_typeof(v_v) = 'string' and (v_v #>> '{}') = any(array['muy_facil','facil','normal','dificil','muy_dificil']) then v_dif := v_v;
    elsif jsonb_typeof(v_v) = 'number' and (v_v #>> '{}')::numeric between 0.25 and 3 then v_dif := to_jsonb(trim_scale((v_v #>> '{}')::numeric));
    else return null; end if;
  end if;
  return jsonb_strip_nulls(jsonb_build_object('v', 'v1', 'componentes', v_comps,
    'horas', case when v_horas = '{}'::jsonb then null else v_horas end, 'dificultad', v_dif));
end $$;
create or replace function private_api.huella_spec_tecnica(p jsonb)
returns text language sql immutable set search_path to 'pg_catalog', 'private_api' as $$
  select md5(private_api.spec_tecnica(p)::text) $$;
revoke all on function private_api.spec_numero_ok(jsonb) from public, anon;
revoke all on function private_api.spec_tecnica(jsonb) from public, anon;
revoke all on function private_api.huella_spec_tecnica(jsonb) from public, anon;
grant execute on function private_api.spec_numero_ok(jsonb), private_api.spec_tecnica(jsonb), private_api.huella_spec_tecnica(jsonb)
  to authenticated, service_role;
-- <<< spec_v1

-- La spec de origen la normaliza y la sella el SERVIDOR al registrar el costeo; después no se cambia.
create or replace function private_api.costeo_spec_servidor()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'private_api' as $$
begin
  if tg_op = 'UPDATE' then
    if new.spec_tecnica_origen is distinct from old.spec_tecnica_origen or new.spec_tecnica_version is distinct from old.spec_tecnica_version
       or new.spec_tecnica_huella is distinct from old.spec_tecnica_huella then
      raise exception 'la especificación técnica de un costeo no se cambia: recostea';
    end if;
    return new;
  end if;
  if coalesce(new.spec_tecnica_version, 'v1') <> 'v1' then raise exception 'spec_tecnica_version desconocida: %', new.spec_tecnica_version; end if;
  new.spec_tecnica_origen := private_api.spec_tecnica(new.spec_tecnica_origen);   -- fuera de contrato ⇒ null (sin vínculo)
  if new.spec_tecnica_origen is null then
    new.spec_tecnica_version := null; new.spec_tecnica_huella := null; return new;
  end if;
  new.spec_tecnica_version := 'v1';
  new.spec_tecnica_huella := md5(new.spec_tecnica_origen::text);
  return new;
end $$;
revoke all on function private_api.costeo_spec_servidor() from public, anon, authenticated;
create or replace trigger trg_costeo_spec_servidor before insert or update on public.costeos_servidor
  for each row execute function private_api.costeo_spec_servidor();

-- P1-05 · activación atómica: sólo Dirección HUMANA (permitidos=direccion y fuera de cuentas_no_humanas); estricto exige
-- versión de motor (además del CHECK). Nadie más escribe la política (sin grants sobre la tabla).
create or replace function private_api.activar_autoridad_costeo(p_modo text, p_frescura text, p_version_motor text)
returns jsonb language plpgsql security definer set search_path to 'public', 'private_api' as $$
declare v_email text := lower(coalesce(auth.jwt()->>'email', '')); v_pol record;
begin
  if v_email = '' or coalesce((select lower(rol) from public.permitidos where lower(email) = v_email limit 1), '') <> 'direccion'
     or to_regclass('public.cuentas_no_humanas') is null
     or exists (select 1 from public.cuentas_no_humanas where lower(email) = v_email) then
    raise exception 'no autorizado: sólo una persona de Dirección cambia la política de autoridad';
  end if;
  if p_modo not in ('preparado', 'estricto') then raise exception 'modo inválido: %', p_modo; end if;
  if p_frescura not in ('exigir_vigente', 'congelar_al_costear') then raise exception 'frescura inválida: %', p_frescura; end if;
  if p_modo = 'estricto' and nullif(btrim(p_version_motor), '') is null then
    raise exception 'el modo estricto exige la versión de motor desplegada';
  end if;
  update private_api.politica_emision_autoridad
     set modo = p_modo, frescura = p_frescura, version_motor_vigente = nullif(btrim(p_version_motor), ''),
         decidido_por = v_email, decidido_en = now()
   where id returning * into v_pol;
  return jsonb_build_object('modo', v_pol.modo, 'frescura', v_pol.frescura, 'version_motor_vigente', v_pol.version_motor_vigente,
    'decidido_por', v_pol.decidido_por);
end $$;
revoke all on function private_api.activar_autoridad_costeo(text, text, text) from public, anon;
grant execute on function private_api.activar_autoridad_costeo(text, text, text) to authenticated;
create or replace function public.activar_autoridad_costeo(p_modo text, p_frescura text, p_version_motor text)
returns jsonb language plpgsql set search_path to 'pg_catalog', 'public', 'private_api' as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  return private_api.activar_autoridad_costeo(p_modo, p_frescura, p_version_motor);
end $$;
revoke all on function public.activar_autoridad_costeo(text, text, text) from public, anon;
grant execute on function public.activar_autoridad_costeo(text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Vínculo autoritativo costeo → (cotización, partida). Un solo uso, con CAS. El servidor escribe la economía del
-- renglón y la huella de su definición.
-- ----------------------------------------------------------------------------
create or replace function private_api.adjuntar_costeo_a_partida(p_cotizacion_id bigint, p_partida_id text, p_costeo_id uuid, p_actualizado_esperado timestamptz)
returns jsonb language plpgsql security definer set search_path to 'public', 'private_api' as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_rol text; v_c record; v_k record; v_vig record; v_i int; v_p jsonb; v_nueva jsonb; v_cant integer; v_act timestamptz; v_iso text; v_huella text;
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
      using errcode = 'PT409', detail = 'actualizado=' || v_iso;
  end if;
  select * into v_k from public.costeos_servidor where id = p_costeo_id for update;
  if not found then raise exception 'costeo inexistente'; end if;
  select ord - 1, value into v_i, v_p from jsonb_array_elements(coalesce(v_c.partidas, '[]'::jsonb)) with ordinality d(value, ord)
   where value->>'id' = p_partida_id limit 1;
  if v_i is null then raise exception 'partida % no existe en la cotizacion', p_partida_id; end if;
  -- Canónica = lo que el gate de producción trata como canónico (ids numéricos). Una clave de línea de texto NO lo es.
  if coalesce(v_p->>'producto_id', v_p->>'productoId', v_p->>'product_id', '') ~ '^[0-9]+$'
     and coalesce(v_p->>'producto_version_id', v_p->>'productoVersionId', v_p->>'product_version_id', '') ~ '^[0-9]+$' then
    raise exception 'partida canónica: su costo es el de producto_version_economia';
  end if;
  select * into v_vig from public.partida_costeo_vigente where cotizacion_id = p_cotizacion_id and partida_id = p_partida_id for update;

  -- (A) Re-vincular el costeo VIGENTE de esta partida: idempotente para cualquier Dirección/Diseño con acceso (traspaso de
  --     rol), y NO lava un cambio: la definición tiene que seguir siendo la que se vinculó.
  if v_vig.costeo_id = p_costeo_id then
    if v_vig.partida_huella <> private_api.huella_partida(v_p) then
      raise exception 'la partida cambió desde que se vinculó este costeo: recostea';
    end if;
    -- rev4: y sigue prometiendo lo que se costeó (redundante con la huella, explícito por contrato).
    if v_k.promesa_huella is null or private_api.huella_promesa(v_p) is distinct from v_k.promesa_huella then
      raise exception 'la partida ya no promete lo que se costeó: recostea';
    end if;
    -- rev5: …y sigue describiendo el despiece que se costeó.
    if v_k.spec_tecnica_huella is null or private_api.huella_spec_tecnica(v_p->'especificacion_tecnica') is distinct from v_k.spec_tecnica_huella then
      raise exception 'la partida ya no describe el despiece que se costeó: recostea';
    end if;
    return jsonb_build_object('ok', true, 'cotizacion_id', p_cotizacion_id, 'partida_id', p_partida_id, 'costeo_id', p_costeo_id,
      'estado', v_k.estado, 'idempotente', true, 'actualizado', to_json(v_c.actualizado)#>>'{}');
  end if;

  -- (B) Costeo NUEVO para esta partida (primer vínculo o recosteo K1→K2).
  if v_k.cotizacion_id is not null then
    if v_k.cotizacion_id = p_cotizacion_id and v_k.partida_id = p_partida_id then
      raise exception 'ese costeo ya fue reemplazado en esta partida: usa el vigente o recostea';
    end if;
    raise exception 'costeo ya vinculado a otra partida: recostea (un costeo, una partida)';
  end if;
  if lower(v_k.creado_por) <> v_email then raise exception 'el costeo lo hizo otra persona: recostea'; end if;
  begin v_cant := nullif(v_p->>'cantidad', '')::integer; exception when others then v_cant := null; end;
  if v_cant is distinct from v_k.cantidad then raise exception 'la partida tiene otra cantidad (% vs %): recostea', v_cant, v_k.cantidad; end if;
  -- P0-01: la partida es el MISMO mueble que se declaró al costear (identidad declarada junto con el despiece).
  if v_k.identidad_origen is null then raise exception 'el costeo no trae la identidad del mueble: recostea'; end if;
  if private_api.identidad_partida(v_p) is distinct from private_api.identidad_partida(v_k.identidad_origen) then
    raise exception 'el costeo es de otro mueble (nombre/medidas/material distintos a los declarados al costear): recostea';
  end if;
  -- rev4: la PROMESA comercial de la partida es la de origen de ESTE costeo (sellada por el servidor al costear).
  -- Nunca se aprende de la partida: sin promesa de origen no hay vínculo.
  if v_k.promesa_huella is null or v_k.promesa_version is distinct from 'v1' then
    raise exception 'el costeo no trae la promesa comercial v1: recostea';
  end if;
  if private_api.huella_promesa(v_p) is distinct from v_k.promesa_huella then
    raise exception 'la partida promete otra cosa que lo costeado (material, acabado, configuración, accesorios o exclusiones): recostea';
  end if;
  -- rev5: la SPEC TÉCNICA de la partida es la de origen de ESTE costeo (la pieza saneada que costeó el motor, sellada por
  -- el servidor). El servidor re-proyecta la especificación de la partida; sin spec de origen no hay vínculo.
  if v_k.spec_tecnica_huella is null or v_k.spec_tecnica_version is distinct from 'v1' then
    raise exception 'el costeo no trae la especificación técnica v1: recostea';
  end if;
  if private_api.spec_tecnica(v_p->'especificacion_tecnica') is null then
    raise exception 'la partida no trae su especificación técnica (o está fuera de contrato): recostea';
  end if;
  if private_api.huella_spec_tecnica(v_p->'especificacion_tecnica') is distinct from v_k.spec_tecnica_huella then
    raise exception 'la partida describe otro despiece que lo costeado (cantidades, medidas, horas, pintura o materiales): recostea';
  end if;
  v_nueva := v_p || jsonb_build_object('costoUnitario', v_k.costo_unitario, 'costoEstado', v_k.estado, 'costeoId', v_k.id::text, 'bomHash', v_k.bom_hash);
  update public.cotizaciones set partidas = jsonb_set(partidas, array[v_i::text], v_nueva)
   where id = p_cotizacion_id
  returning actualizado, partidas->v_i into v_act, v_nueva;
  -- Huella de lo que QUEDÓ guardado (los triggers de escritura pueden normalizar la partida).
  v_huella := private_api.huella_partida(v_nueva);
  if v_vig.costeo_id is not null then
    update public.costeos_servidor set reemplazado_por = p_costeo_id, reemplazado_en = now() where id = v_vig.costeo_id;
  end if;
  insert into public.partida_costeo_vigente(cotizacion_id, partida_id, costeo_id, partida_huella, vinculado_por)
  values (p_cotizacion_id, p_partida_id, p_costeo_id, v_huella, v_email)
  on conflict (cotizacion_id, partida_id) do update
    set costeo_id = excluded.costeo_id, partida_huella = excluded.partida_huella, vinculado_por = excluded.vinculado_por, vinculado_en = now();
  update public.costeos_servidor
     set cotizacion_id = p_cotizacion_id, partida_id = p_partida_id, vinculado_en = now(), vinculado_por = v_email
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
  v_c record; v_p jsonb; v_ord bigint; v_out text[] := '{}'; v_cid text; v_r record; v_vig record; v_hasta timestamptz;
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
    -- El vínculo VIGENTE lo escribió el servidor: este costeo es el de ESTA cotización y ESTA partida.
    select * into v_vig from public.partida_costeo_vigente where cotizacion_id = p_cotizacion_id and partida_id = nullif(v_p->>'id', '');
    if v_vig.costeo_id is distinct from v_r.id then
      v_out := array_append(v_out, format('linea_%s_costeo_no_vinculado_a_esta_partida', v_ord)); continue; end if;
    -- …y a ESTA definición: la partida no cambió (nombre, medidas, material, despiece…) desde que se vinculó.
    if v_vig.partida_huella <> private_api.huella_partida(v_p) then
      v_out := array_append(v_out, format('linea_%s_partida_cambio_desde_el_costeo', v_ord)); continue; end if;
    -- rev4: …y promete lo mismo que se costeó.
    if v_r.promesa_huella is null then
      v_out := array_append(v_out, format('linea_%s_costeo_sin_promesa', v_ord)); continue; end if;
    if private_api.huella_promesa(v_p) is distinct from v_r.promesa_huella then
      v_out := array_append(v_out, format('linea_%s_promesa_distinta_al_costeo', v_ord)); continue; end if;
    -- rev5: …y describe el despiece exacto que se costeó.
    if v_r.spec_tecnica_huella is null then
      v_out := array_append(v_out, format('linea_%s_costeo_sin_spec', v_ord)); continue; end if;
    if private_api.huella_spec_tecnica(v_p->'especificacion_tecnica') is distinct from v_r.spec_tecnica_huella then
      v_out := array_append(v_out, format('linea_%s_spec_distinta_al_costeo', v_ord)); continue; end if;
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
--    select public.activar_autoridad_costeo('estricto', '<exigir_vigente|congelar_al_costear>', '<MOTOR_VERSION desplegada>');  -- sesión de Dirección humana
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
-- RB drop function if exists public.activar_autoridad_costeo(text, text, text);
-- RB drop function if exists private_api.activar_autoridad_costeo(text, text, text);
-- RB drop function if exists private_api.identidad_partida(jsonb);
-- RB drop trigger if exists trg_costeo_spec_servidor on public.costeos_servidor;
-- RB drop function if exists private_api.costeo_spec_servidor();
-- RB drop function if exists private_api.huella_spec_tecnica(jsonb);
-- RB drop function if exists private_api.spec_tecnica(jsonb);
-- RB drop function if exists private_api.spec_numero_ok(jsonb);
-- RB drop trigger if exists trg_costeo_promesa_servidor on public.costeos_servidor;
-- RB drop function if exists private_api.costeo_promesa_servidor();
-- RB drop function if exists private_api.huella_promesa(jsonb);
-- RB drop function if exists private_api.promesa_partida(jsonb);
-- RB drop function if exists private_api.promesa_lista(jsonb);
-- RB drop function if exists private_api.promesa_ident(jsonb);
-- RB drop function if exists private_api.promesa_numero(jsonb);
-- RB drop function if exists private_api.promesa_texto(jsonb);
-- RB drop function if exists private_api.motivos_autoridad_costeo(bigint);
-- RB drop function if exists private_api.modo_emision_autoridad();
-- RB drop table if exists private_api.politica_emision_autoridad;
-- RB comment on table public.cuentas_no_humanas is null;   -- la tabla es de producción (firma de precios, 14-oct, sin comentario): SEG-01c sólo le agregó el comentario
-- RB commit;
-- (costeos_servidor, partida_costeo_vigente y cuentas_no_humanas se conservan como rastro; borrarlas sólo con decisión expresa.)
-- ============================================================================
