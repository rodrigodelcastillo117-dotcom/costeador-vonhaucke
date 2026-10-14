-- ============================================================================
--  PROPUESTA · VH-146c · formato de hoja (4×8 / 5×8) en 231 hojas ERP de tablero. Sustituye a vh146 y vh146b.
--  ⚠️ NO APLICAR sin autorización EXPRESA de Dirección. Prefijo PROPUESTA_ para que `supabase db push` no la tome.
--
--  Cambios pedidos por Dirección tras la reauditoría del 14-oct-2026:
--   1. MANIFEST EXACTO: los 231 ids auditados (solo lectura en producción, 14-oct) con su formato esperado, y su huella
--      md5(id:formato ordenado) = 399f4b969536318069dd28459b79a13b. Antes de cualquier UPDATE se exige que:
--        · el manifest tenga esa huella (nadie lo editó),
--        · cada id exista y siga siendo ERP / hoja / familia de tablero / sin formato / con 4×8 o 5×8 en el nombre
--          coherente con el formato del manifest,
--        · el conjunto de candidatos VIVO de la base sea EXACTAMENTE el manifest (ni uno más, ni uno menos).
--      Si algo no cuadra, aborta: la cuenta sola no basta.
--   2. `fraccion = true` se conserva: es el contrato $/hoja → consumo fraccionario.
--   3. NO escribe `mermaCorte`: conserva el valor existente (Producción no ha ratificado 6 %).
--   4. (pruebas) `insumo_precios` con filas reales: deben quedar idénticas.
--   5. ONE-SHOT: si `private_api.respaldo_vh146c_atributos` ya existe, aborta y exige revisión. `atributos_despues` se
--      escribe una sola vez, en la misma transacción; nunca se sobrescribe.
--   6. AME28152 se verifica por el id exacto del manifest (`erp-ame28152-b709`, Walnut, el del librero), no por ILIKE.
--   Además: 0 filas fuera del manifest modificadas (huella de todo `insumos_catalogo` fuera del manifest antes/después)
--   y en las 231 sólo cambia `atributos` (huella del resto de columnas antes/después).
-- ============================================================================
begin;

do $$ begin
  if to_regclass('private_api.respaldo_vh146c_atributos') is not null then
    raise exception 'VH-146c ya se aplicó (existe private_api.respaldo_vh146c_atributos). One-shot: revisar antes de cualquier otra acción.';
  end if;
end $$;

create temporary table _vh146c_manifest (id text primary key, formato text not null check (formato in ('4x8', '5x8'))) on commit drop;
insert into _vh146c_manifest (id, formato) values
  ('erp-ag1248hp-b268','4x8'),
  ('erp-ag2c16cai','4x8'),
  ('erp-ag489-b716','4x8'),
  ('erp-ag489fw','4x8'),
  ('erp-agb9482mn','4x8'),
  ('erp-agbn5828','5x8'),
  ('erp-agme4819ga','4x8'),
  ('erp-agme4828ga','4x8'),
  ('erp-ame1648m706','4x8'),
  ('erp-ame1658-b39','5x8'),
  ('erp-ame1658-b709','5x8'),
  ('erp-ame1658-b713','5x8'),
  ('erp-ame1658-b716','5x8'),
  ('erp-ame1658-b746','5x8'),
  ('erp-ame1958-b716','5x8'),
  ('erp-ame1958-b718','5x8'),
  ('erp-ame28152-b1013','5x8'),
  ('erp-ame28152-b14','5x8'),
  ('erp-ame28152-b16','5x8'),
  ('erp-ame28152-b39','5x8'),
  ('erp-ame28152-b6','5x8'),
  ('erp-ame28152-b709','5x8'),
  ('erp-ame28152-b713','5x8'),
  ('erp-ame28152-b716','5x8'),
  ('erp-ame28152-b717','5x8'),
  ('erp-ame28152-b718','5x8'),
  ('erp-ame28152-b746','5x8'),
  ('erp-ame28152-b747','5x8'),
  ('erp-ame28152-b8','5x8'),
  ('erp-ame28152-b88','5x8'),
  ('erp-ame28152-b9','5x8'),
  ('erp-ame28581-b14','5x8'),
  ('erp-bachok','4x8'),
  ('erp-chnoa48','4x8'),
  ('erp-chpi48','4x8'),
  ('erp-chrob48','4x8'),
  ('erp-foch46r046rp','4x8'),
  ('erp-foch48lid4271','4x8'),
  ('erp-hlpbam2022','4x8'),
  ('erp-lp481037-30','4x8'),
  ('erp-lp4812dw','4x8'),
  ('erp-lp482111blpo','4x8'),
  ('erp-lp482112bl','4x8'),
  ('erp-lp482112mt','4x8'),
  ('erp-lp48719758dw','4x8'),
  ('erp-lp487996nr','4x8'),
  ('erp-lp48bbsrw','4x8'),
  ('erp-lp48black','4x8'),
  ('erp-lp48bo76w','4x8'),
  ('erp-lp48chmap','4x8'),
  ('erp-lp48cp9558','4x8'),
  ('erp-lp48cwmm3091','4x8'),
  ('erp-lp48f96158','4x8'),
  ('erp-lp48fos318160','4x8'),
  ('erp-lp48fw157360','4x8'),
  ('erp-lp48gb40131','4x8'),
  ('erp-lp48gpt50037','4x8'),
  ('erp-lp48gregr26230','4x8'),
  ('erp-lp48gw','4x8'),
  ('erp-lp48kema1077660','4x8'),
  ('erp-lp48lmfw','4x8'),
  ('erp-lp48lpd31560','4x8'),
  ('erp-lp48lw799828','4x8'),
  ('erp-lp48lw7998k18','4x8'),
  ('erp-lp48m4254bba','4x8'),
  ('erp-lp48mg34160','4x8'),
  ('erp-lp48mgbl','4x8'),
  ('erp-lp48migl','4x8'),
  ('erp-lp48nb96958','4x8'),
  ('erp-lp48ntrw','4x8'),
  ('erp-lp48pg27530g','4x8'),
  ('erp-lp48rb2933','4x8'),
  ('erp-lp48rl1467mt','4x8'),
  ('erp-lp48rwrc38','4x8'),
  ('erp-lp48sdbk319565','4x8'),
  ('erp-lp48wc76w','4x8'),
  ('erp-lpb48-60','4x8'),
  ('erp-lpbaf48','4x8'),
  ('erp-lpbafsm48','4x8'),
  ('erp-lpgcb48','4x8'),
  ('erp-lpgop5054','4x8'),
  ('erp-lpmfsb1595','4x8'),
  ('erp-lprw314965','4x8'),
  ('erp-lprwas419','4x8'),
  ('erp-lprwd40360','4x8'),
  ('erp-mdf12chnoa','4x8'),
  ('erp-mdf12hb','4x8'),
  ('erp-mdf12hp-e374','4x8'),
  ('erp-mdf12hp-e377','4x8'),
  ('erp-mdf12hp1h-e309','4x8'),
  ('erp-mdf12hp1h-e384','4x8'),
  ('erp-mdf16chnoa','4x8'),
  ('erp-mdf16h58','5x8'),
  ('erp-mdf16hp-b1026','4x8'),
  ('erp-mdf16hp-b1097','4x8'),
  ('erp-mdf16hp-b709','4x8'),
  ('erp-mdf16m-b713','4x8'),
  ('erp-mdf16m-b716','4x8'),
  ('erp-mdf16m-b717','4x8'),
  ('erp-mdf16m-b721','4x8'),
  ('erp-mdf16m-b744','4x8'),
  ('erp-mdf16m-e503','4x8'),
  ('erp-mdf16m-e558','4x8'),
  ('erp-mdf16pgsg','4x8'),
  ('erp-mdf18','4x8'),
  ('erp-mdf1848rev','4x8'),
  ('erp-mdf18h','4x8'),
  ('erp-mdf18hn','4x8'),
  ('erp-mdf18hp1-b717','4x8'),
  ('erp-mdf18hp1mb-b274','4x8'),
  ('erp-mdf18hp1vn-e376','4x8'),
  ('erp-mdf18m-b1098','4x8'),
  ('erp-mdf18m-b713','4x8'),
  ('erp-mdf18m-b717','4x8'),
  ('erp-mdf18m-b721','4x8'),
  ('erp-mdf18m-b744','4x8'),
  ('erp-mdf18m-b747','4x8'),
  ('erp-mdf18m-b806','4x8'),
  ('erp-mdf18m-b840','4x8'),
  ('erp-mdf18mdb','4x8'),
  ('erp-mdf1911037-30','4x8'),
  ('erp-mdf19112430','4x8'),
  ('erp-mdf192c1037-30','4x8'),
  ('erp-mdf1968chcr-m738','4x8'),
  ('erp-mdf1968chcr-m740','4x8'),
  ('erp-mdf19ch-m1','4x8'),
  ('erp-mdf19ch-m2','4x8'),
  ('erp-mdf19ch-m23','4x8'),
  ('erp-mdf19ch-m24','4x8'),
  ('erp-mdf19ch-m3','4x8'),
  ('erp-mdf19ch-m5','4x8'),
  ('erp-mdf19ch-m701','4x8'),
  ('erp-mdf19ch-m729','4x8'),
  ('erp-mdf19ch-m731','4x8'),
  ('erp-mdf19ch-m733','4x8'),
  ('erp-mdf19ch-m734','4x8'),
  ('erp-mdf19ch-m735','4x8'),
  ('erp-mdf19ch-m738','4x8'),
  ('erp-mdf19ch-m740','4x8'),
  ('erp-mdf19ch-m781','4x8'),
  ('erp-mdf19ch-m785','4x8'),
  ('erp-mdf19chnoa','4x8'),
  ('erp-mdf19hp-b1026','4x8'),
  ('erp-mdf19hp-b709','4x8'),
  ('erp-mdf19hp-e268','4x8'),
  ('erp-mdf19hp-e368','4x8'),
  ('erp-mdf19hp-e378','4x8'),
  ('erp-mdf19hp1n-b1038','4x8'),
  ('erp-mdf19hp1n-e378','4x8'),
  ('erp-mdf19hp1n-e383','4x8'),
  ('erp-mdf19hp1n-e384','4x8'),
  ('erp-mdf19hp1n-e709','4x8'),
  ('erp-mdf25chfpa-m24','4x8'),
  ('erp-mdf25chnoa','4x8'),
  ('erp-mdf25h','4x8'),
  ('erp-mdf25hb','4x8'),
  ('erp-mdf25hp-b1097','4x8'),
  ('erp-mdf25hp-b268','4x8'),
  ('erp-mdf25hp-e378','4x8'),
  ('erp-mdf25lpf-b718','4x8'),
  ('erp-mdf25m1-b1095','4x8'),
  ('erp-mdf25m1-b717','4x8'),
  ('erp-mdf25m1-e514','4x8'),
  ('erp-mdf25pgsg','4x8'),
  ('erp-mdf2858hn','5x8'),
  ('erp-mdf28ch-m2','4x8'),
  ('erp-mdf28ch-m3','4x8'),
  ('erp-mdf28hp1-e377','4x8'),
  ('erp-mdf28hp1-e416','4x8'),
  ('erp-mdf28hp1m-b283','4x8'),
  ('erp-mdf28hp1mb-b274','4x8'),
  ('erp-mdf28lpf-b268','4x8'),
  ('erp-mdf30ch-m2','4x8'),
  ('erp-mdf30ch-m3','4x8'),
  ('erp-mdf47ch-m2','4x8'),
  ('erp-mdf4816nn','4x8'),
  ('erp-mdf4818bn','4x8'),
  ('erp-mdf4818hpivy','4x8'),
  ('erp-mdf4818nn','4x8'),
  ('erp-mdf481reat','4x8'),
  ('erp-mdf4825bn','4x8'),
  ('erp-mdf4825nn','4x8'),
  ('erp-mdf4855ccp','4x8'),
  ('erp-mdf55h','4x8'),
  ('erp-mdf6-b1054','4x8'),
  ('erp-mdf6-b712','4x8'),
  ('erp-mdf6-b719','4x8'),
  ('erp-mdf6-b721','4x8'),
  ('erp-mdf6-b744','4x8'),
  ('erp-mdf6-b805','4x8'),
  ('erp-mdf6-b806','4x8'),
  ('erp-mdf6-b807','4x8'),
  ('erp-mdf6-b809','4x8'),
  ('erp-mdf6-b834','4x8'),
  ('erp-mdf6-b835','4x8'),
  ('erp-mdf6-b836','4x8'),
  ('erp-mdf6-b837','4x8'),
  ('erp-mdf6-e508','4x8'),
  ('erp-mdf6ch1-m729','4x8'),
  ('erp-mdf6hp-b1026','4x8'),
  ('erp-mdf6hp-e308','4x8'),
  ('erp-mdf6hp-e374','4x8'),
  ('erp-mdfa28','5x8'),
  ('erp-mdfdb4816h','4x8'),
  ('erp-mdfdb4816n','4x8'),
  ('erp-mdfh12n','4x8'),
  ('erp-mdfh16n','4x8'),
  ('erp-mdfh16ph-b717','4x8'),
  ('erp-mdfh16ph-b721','4x8'),
  ('erp-mdfh18ph-b717','4x8'),
  ('erp-mdfh18ph-b721','4x8'),
  ('erp-mdfh19me408','4x8'),
  ('erp-mdfh25me408','4x8'),
  ('erp-mdfh25n','4x8'),
  ('erp-mdfh5816','5x8'),
  ('erp-mdfhomn485','4x8'),
  ('erp-mdfm18n-b744','4x8'),
  ('erp-mdfn5828','5x8'),
  ('erp-mdfntsca15','4x8'),
  ('erp-mdp2858me2c-b718','5x8'),
  ('erp-mdp28hp1-e307','4x8'),
  ('erp-mdp28hp1-e368','4x8'),
  ('erp-mdp28hp1-e468','4x8'),
  ('erp-mdpm2c5825wt','5x8'),
  ('erp-mlemlp000100t1','4x8'),
  ('erp-mvlmmd10280200-e308','4x8'),
  ('erp-mvlmmd10280200-e408','4x8'),
  ('erp-mvlmmd18010424','4x8'),
  ('erp-pf5548p14','4x8'),
  ('erp-pr1948bl','4x8'),
  ('erp-re1648me','4x8');

-- Huellas ANTES (precios, filas fuera del manifest, columnas distintas de atributos en las del manifest).
create temporary table _vh146c_antes on commit drop as select
  (select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.insumo_precios t) as precios,
  (select md5(coalesce(string_agg(c::text, '|' order by c.id), '')) from public.insumos_catalogo c where c.id not in (select id from _vh146c_manifest)) as fuera,
  (select md5(coalesce(string_agg((to_jsonb(c) - 'atributos')::text, '|' order by c.id), '')) from public.insumos_catalogo c where c.id in (select id from _vh146c_manifest)) as resto_cols;

do $$ declare h text; n int; vivo text; man text; begin
  select md5(string_agg(id || ':' || formato, ',' order by id)), count(*) into h, n from _vh146c_manifest;
  if n <> 231 or h <> '399f4b969536318069dd28459b79a13b' then
    raise exception 'VH-146c: el manifest no es el auditado (n=%, huella=%).', n, h; end if;

  -- Cada id del manifest sigue siendo lo que se auditó.
  select count(*) into n from _vh146c_manifest m join public.insumos_catalogo c on c.id = m.id
   where c.clasificacion = 'erp' and c.unidad_costeo = 'hoja'
     and c.familia in ('melamina', 'mdf', 'laminado_hpl', 'chapa_madera')
     and jsonb_typeof(c.atributos -> 'formato') is distinct from 'object'
     and case m.formato when '5x8' then c.nombre ~* '(^|[^0-9])5\s*''?\s*x\s*''?\s*8($|[^0-9])'
                        else c.nombre ~* '(^|[^0-9])4\s*''?\s*x\s*''?\s*8($|[^0-9])'
                             and c.nombre !~* '(^|[^0-9])5\s*''?\s*x\s*''?\s*8($|[^0-9])' end;
  if n <> 231 then raise exception 'VH-146c: sólo % de 231 ids del manifest siguen como se auditaron.', n; end if;

  -- El conjunto vivo de candidatos es EXACTAMENTE el manifest.
  select md5(coalesce(string_agg(id || ':' || fmt, ',' order by id), '')) into vivo from (
    select c.id, case when c.nombre ~* '(^|[^0-9])5\s*''?\s*x\s*''?\s*8($|[^0-9])' then '5x8'
                      when c.nombre ~* '(^|[^0-9])4\s*''?\s*x\s*''?\s*8($|[^0-9])' then '4x8' end as fmt
      from public.insumos_catalogo c
     where c.clasificacion = 'erp' and c.unidad_costeo = 'hoja'
       and c.familia in ('melamina', 'mdf', 'laminado_hpl', 'chapa_madera')
       and jsonb_typeof(c.atributos -> 'formato') is distinct from 'object') x where fmt is not null;
  select md5(string_agg(id || ':' || formato, ',' order by id)) into man from _vh146c_manifest;
  if vivo <> man then raise exception 'VH-146c: los candidatos vivos (%) no son el manifest (%). Volver a auditar.', vivo, man; end if;
end $$;

-- Respaldo ONE-SHOT (create table sin "if not exists": si existiera, el bloque de arriba ya abortó).
create table private_api.respaldo_vh146c_atributos (
  id text primary key,
  formato_asignado text not null,
  atributos_antes jsonb,
  atributos_despues jsonb,
  aplicado_en timestamptz not null default now()
);
comment on table private_api.respaldo_vh146c_atributos is
  'VH-146c · one-shot. atributos antes/después de las 231 hojas del manifest. Rollback (misma ventana): final de PROPUESTA_vh146c.';
insert into private_api.respaldo_vh146c_atributos (id, formato_asignado, atributos_antes)
select m.id, m.formato, c.atributos from _vh146c_manifest m join public.insumos_catalogo c on c.id = m.id;

-- Backfill: SÓLO formato + fraccion (mermaCorte se conserva tal cual).
update public.insumos_catalogo c
   set atributos = coalesce(c.atributos, '{}'::jsonb) || jsonb_build_object(
         'fraccion', true,
         'formato', case m.formato
           when '5x8' then '{"tipo":"tablero","nombre":"tablero 1.52 x 2.44","corto":"tablero 5x8","medida":3.721,"largoMM":2440,"anchoMM":1525}'::jsonb
           else           '{"tipo":"tablero","nombre":"tablero 1.22 x 2.44","corto":"tablero","medida":2.9768,"largoMM":2440,"anchoMM":1220}'::jsonb
         end)
  from _vh146c_manifest m
 where m.id = c.id;

update private_api.respaldo_vh146c_atributos r set atributos_despues = c.atributos
  from public.insumos_catalogo c where c.id = r.id;

-- Verificaciones (abortan todo si fallan).
do $$ declare n int; f jsonb; a jsonb; antes record; begin
  select * into antes from _vh146c_antes;
  select count(*) into n from private_api.respaldo_vh146c_atributos r join public.insumos_catalogo c on c.id = r.id
   where jsonb_typeof(c.atributos -> 'formato') = 'object' and (c.atributos ->> 'fraccion')::boolean
     and (c.atributos -> 'mermaCorte') is not distinct from (r.atributos_antes -> 'mermaCorte');
  if n <> 231 then raise exception 'VH-146c: sólo % de 231 quedaron con formato+fraccion y la merma original.', n; end if;

  select c.atributos -> 'formato' into f from public.insumos_catalogo c where c.id = 'erp-ame28152-b709';
  if f is null or (f ->> 'anchoMM')::int <> 1525 or (f ->> 'largoMM')::int <> 2440 then
    raise exception 'VH-146c: erp-ame28152-b709 no quedó 5×8 (1525×2440): %', f; end if;

  if (select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.insumo_precios t) <> antes.precios then
    raise exception 'VH-146c: cambió insumo_precios.'; end if;
  if (select md5(coalesce(string_agg(c::text, '|' order by c.id), '')) from public.insumos_catalogo c
       where c.id not in (select id from private_api.respaldo_vh146c_atributos)) <> antes.fuera then
    raise exception 'VH-146c: cambió alguna fila fuera del manifest.'; end if;
  if (select md5(coalesce(string_agg((to_jsonb(c) - 'atributos')::text, '|' order by c.id), '')) from public.insumos_catalogo c
       where c.id in (select id from private_api.respaldo_vh146c_atributos)) <> antes.resto_cols then
    raise exception 'VH-146c: en las 231 cambió algo distinto de atributos.'; end if;
end $$;

select formato_asignado, count(*) from private_api.respaldo_vh146c_atributos group by 1 order by 1;  -- 4x8 200 · 5x8 31
commit;

-- ============================================================================
--  ROLLBACK (SÓLO dentro de la misma ventana, inmediatamente después). Restaura una fila únicamente si sus atributos
--  siguen siendo los que dejó VH-146c; las cambiadas después NO se tocan y se listan. El respaldo queda (one-shot).
-- ----------------------------------------------------------------------------
-- Líneas ejecutables marcadas "-- RB ": quitar ese prefijo para correrlas.
-- RB begin;
-- RB select r.id from private_api.respaldo_vh146c_atributos r join public.insumos_catalogo c on c.id = r.id
-- RB  where c.atributos is distinct from r.atributos_despues;
-- RB update public.insumos_catalogo c set atributos = r.atributos_antes
-- RB   from private_api.respaldo_vh146c_atributos r
-- RB  where r.id = c.id and c.atributos is not distinct from r.atributos_despues;
-- RB commit;
-- ============================================================================
