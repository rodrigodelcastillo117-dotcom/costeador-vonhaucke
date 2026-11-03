-- ============================================================================
--  PROPUESTA (NO aplicada a producción) · Bibliotecas de referencia para renders fieles.
--  Objetivo: que `generar-render` reproduzca el MUEBLE y el ACABADO reales de Von Haucke,
--  en vez de inventar la forma/color desde texto. El edge YA consume imágenes de referencia
--  (body.imagenes[]) y acabados exactos (materiales/finishes); aquí se crean los DATOS que faltan.
--
--  Dos tablas + un bucket privado:
--    · producto_referencias : fotos reales de muebles de catálogo (frente/3-4/lateral/detalle),
--                             ligadas a producto/versión → se pasan a generar-render.imagenes[].
--    · acabado_referencias  : swatches/fotos de acabados y CUBIERTAS reales (madera, laminado,
--                             cuarzo, metal…) con hex e insumo del motor → alimentan finishes.
--
--  Seguridad: VER referencias = cualquier autenticado (NO es economía; el vendedor muestra el
--  catálogo al cliente). EDITAR = sólo Dirección/Diseño (public.puede_editar_config()).
--
--  NO aplicar sin autorización de Dirección. Trae bloque de ROLLBACK al final.
-- ============================================================================

begin;

-- 1) Bucket privado para imágenes de referencia (fotos de producto + swatches de acabado).
insert into storage.buckets (id, name, public)
values ('referencias', 'referencias', false)
on conflict (id) do nothing;

-- 2) Fotos reales de muebles de catálogo, ligadas a producto (y opcionalmente a la versión canónica).
create table if not exists public.producto_referencias (
  id                  bigint generated always as identity primary key,
  producto_id         bigint not null references public.productos(id) on delete cascade,
  producto_version_id bigint references public.producto_versiones(id) on delete set null,
  vista               text not null default 'tres_cuartos'
                        check (vista in ('frente','tres_cuartos','lateral','superior','detalle','otro')),
  storage_path        text not null,
  storage_url         text,
  nota                text,
  orden               int  not null default 0,
  activo              boolean not null default true,
  creado_por          text,
  creado_en           timestamptz not null default now()
);
create index if not exists ix_producto_referencias_producto
  on public.producto_referencias(producto_id) where activo;

-- 3) Acabados y cubiertas reales (swatches), opcionalmente ligados a un insumo del motor.
--    insumo_clave es TEXTO (los insumos del motor viven en config + catálogo, sin una PK única común),
--    por eso no se pone FK dura: se valida en la capa de datos, no se inventa.
create table if not exists public.acabado_referencias (
  id            bigint generated always as identity primary key,
  clave         text not null unique,
  nombre        text not null,
  categoria     text not null
                  check (categoria in ('madera','laminado','melamina','cuarzo','solido','metal','vidrio','tela','piedra','otro')),
  hex           text,
  insumo_clave  text,
  storage_path  text,
  storage_url   text,
  nota          text,
  activo        boolean not null default true,
  creado_por    text,
  creado_en     timestamptz not null default now()
);

-- 4) RLS de las tablas.
alter table public.producto_referencias enable row level security;
alter table public.acabado_referencias  enable row level security;

create policy pref_sel on public.producto_referencias for select to authenticated using (true);
create policy pref_ins on public.producto_referencias for insert to authenticated with check (public.puede_editar_config());
create policy pref_upd on public.producto_referencias for update to authenticated using (public.puede_editar_config()) with check (public.puede_editar_config());
create policy pref_del on public.producto_referencias for delete to authenticated using (public.puede_editar_config());

create policy aref_sel on public.acabado_referencias for select to authenticated using (true);
create policy aref_ins on public.acabado_referencias for insert to authenticated with check (public.puede_editar_config());
create policy aref_upd on public.acabado_referencias for update to authenticated using (public.puede_editar_config()) with check (public.puede_editar_config());
create policy aref_del on public.acabado_referencias for delete to authenticated using (public.puede_editar_config());

-- 5) RLS del bucket 'referencias' (storage.objects): leer autenticado; escribir Dirección/Diseño.
create policy refbucket_read   on storage.objects for select to authenticated using (bucket_id = 'referencias');
create policy refbucket_insert on storage.objects for insert to authenticated with check (bucket_id = 'referencias' and public.puede_editar_config());
create policy refbucket_update on storage.objects for update to authenticated using (bucket_id = 'referencias' and public.puede_editar_config());
create policy refbucket_delete on storage.objects for delete to authenticated using (bucket_id = 'referencias' and public.puede_editar_config());

commit;

-- >>> ROLLBACK bibliotecas_referencia INICIO
-- begin;
--   drop policy if exists refbucket_delete on storage.objects;
--   drop policy if exists refbucket_update on storage.objects;
--   drop policy if exists refbucket_insert on storage.objects;
--   drop policy if exists refbucket_read   on storage.objects;
--   drop table if exists public.acabado_referencias;
--   drop table if exists public.producto_referencias;
--   -- el bucket 'referencias' se conserva si ya tiene objetos; si está vacío:
--   -- delete from storage.buckets where id='referencias' and not exists (select 1 from storage.objects where bucket_id='referencias');
-- commit;
-- <<< ROLLBACK bibliotecas_referencia FIN
