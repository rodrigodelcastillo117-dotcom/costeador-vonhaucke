#!/usr/bin/env bash
# Prepara los SQL (como root) y lanza la parte de BD como usuario 'postgres'.
set -u
REPO=/home/user/costeador-vonhaucke
W=/tmp/pgrace
rm -rf "$W"; mkdir -p "$W"

cat > "$W/stub.sql" <<'SQL'
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select case when coalesce(current_setting('test.email', true),'')='' then null
    else jsonb_build_object('email', current_setting('test.email', true)) end $$;
do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $$;
create table public.permitidos (email text primary key, rol text not null default 'vendedor');
insert into public.permitidos(email, rol) values ('rodrigo@vh.mx','direccion');
create table public.cuentas_no_humanas (email text primary key, motivo text);
create function public.puede_certificar_costo() returns boolean language sql stable as $$
  select coalesce((select lower(rol) from public.permitidos where lower(email)=lower(auth.jwt()->>'email'))='direccion', false)
     and not exists (select 1 from public.cuentas_no_humanas where lower(email)=lower(auth.jwt()->>'email')) $$;
create table public.producto_maestro (
  clave text primary key, nombre text, dims_mm integer[], fuente text, cos_fab_real numeric,
  lineas jsonb, creado_por text, creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(), factor_mo numeric, factor_gif numeric,
  material_real numeric, tipo_bom text);
SQL

inject() { sed "s/v_existe := found;/v_existe := found; perform pg_sleep(coalesce(nullif(current_setting('test.race_sleep', true),''),'0')::float);/"; }
git -C "$REPO" show 4f79c72:supabase/migrations/20261109_guardar_producto_maestro_integridad.sql | inject > "$W/fn_unfixed.sql"
inject < "$REPO/supabase/migrations/20261109_guardar_producto_maestro_integridad.sql" > "$W/fn_fixed.sql"

cat > "$W/dbrun.sh" <<'DBRUN'
#!/usr/bin/env bash
set -u
W=/tmp/pgrace
PGBIN=/usr/lib/postgresql/16/bin
DATA=$W/data; SOCK=$W/sock; LOG=$W/pg.log
rm -rf "$DATA" "$SOCK"; mkdir -p "$DATA" "$SOCK"
"$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null 2>&1 || { echo "FALLO initdb"; exit 1; }
"$PGBIN/pg_ctl" -D "$DATA" -l "$LOG" -o "-k $SOCK -c listen_addresses=''" -w start >/dev/null 2>&1 || { echo "FALLO start"; cat "$LOG"; exit 1; }
trap '"$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1' EXIT
P(){ psql -h "$SOCK" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
echo "unfixed advisory_lock=$(grep -c pg_advisory_xact_lock $W/fn_unfixed.sql) sleep=$(grep -c pg_sleep $W/fn_unfixed.sql) | fixed advisory_lock=$(grep -c pg_advisory_xact_lock $W/fn_fixed.sql) sleep=$(grep -c pg_sleep $W/fn_fixed.sql)"
L_OK='[{"desc":"Lamina","insumoId":"erp-lam","cantidad":2.5,"unidad":"hoja","precioConfirmado":800},{"desc":"Pintura","insumoId":"erp-pin","cantidad":3,"unidad":"kg","precioConfirmado":150}]'
call(){ cat <<SQL
set test.email='rodrigo@vh.mx';
set test.race_sleep='2';
select 'RES:'||coalesce((select public.guardar_producto_maestro(
  p_clave=>'K',p_nombre=>'$1',p_lineas=>'$L_OK'::jsonb,
  p_factor_mo=>0.1,p_factor_gif=>0.25,p_material_real=>2450,
  p_tipo_bom=>'BOM_BORRADOR',p_sustituir=>true,p_version_anterior=>1))::text,'NULL');
SQL
}
run_case(){ local DB=$1 TAG=$2
  P -c "create database $DB" >/dev/null
  P -d "$DB" -f "$W/stub.sql" >/dev/null
  P -d "$DB" -f "$W/fn_$DB.sql" >/dev/null 2>"$W/load_$DB.err" || { echo "[$TAG] FALLO cargar:"; cat "$W/load_$DB.err"; return 1; }
  P -d "$DB" -c "set test.email='rodrigo@vh.mx';set test.race_sleep='0';
    select public.guardar_producto_maestro(p_clave=>'K',p_nombre=>'ORIGINAL',p_lineas=>'$L_OK'::jsonb,
      p_factor_mo=>0.1,p_factor_gif=>0.25,p_material_real=>2450,p_tipo_bom=>'BOM_BORRADOR');" >/dev/null
  echo "=================== [$TAG] (db=$DB) ==================="
  call A | P -d "$DB" -t >"$W/o_${DB}_A.txt" 2>"$W/o_${DB}_A.err" & local P1=$!
  call B | P -d "$DB" -t >"$W/o_${DB}_B.txt" 2>"$W/o_${DB}_B.err" & local P2=$!
  wait $P1; wait $P2
  echo "conn A -> $(grep -ho 'RES:[^ ]*' $W/o_${DB}_A.txt 2>/dev/null|head -c160)$(grep -ho 'VERSION_CONFLICT[^\"]*' $W/o_${DB}_A.err 2>/dev/null|head -c140)"
  echo "conn B -> $(grep -ho 'RES:[^ ]*' $W/o_${DB}_B.txt 2>/dev/null|head -c160)$(grep -ho 'VERSION_CONFLICT[^\"]*' $W/o_${DB}_B.err 2>/dev/null|head -c140)"
  echo "--- fila final ---"; P -d "$DB" -c "select clave,version,nombre from public.producto_maestro where clave='K';"
  echo "--- historial ---"; P -d "$DB" -c "select version,accion from public.producto_maestro_historial where clave='K' order by id;"
  local nver=$(P -d "$DB" -tAc "select version from public.producto_maestro where clave='K'")
  local nhist=$(P -d "$DB" -tAc "select count(*) from public.producto_maestro_historial where clave='K' and accion='sustituir'")
  local conflict=$(cat $W/o_${DB}_A.err $W/o_${DB}_B.err 2>/dev/null|grep -c VERSION_CONFLICT)
  echo ">>> [$TAG] version_final=$nver sustituciones=$nhist version_conflict=$conflict"
  if [ "$DB" = unfixed ]; then
    [ "$nhist" -ge 2 ] && [ "$nver" = 2 ] && echo ">>> VEREDICTO: LOST UPDATE REPRODUCIDO (2 sustituciones, version solo 2 -> una escritura perdida)" || echo ">>> VEREDICTO: no reproducido (timing)"
  else
    [ "$nhist" = 1 ] && [ "$conflict" -ge 1 ] && echo ">>> VEREDICTO: CARRERA CERRADA (1 sustitucion, la otra VERSION_CONFLICT, 0 perdidas)" || echo ">>> VEREDICTO: inesperado"
  fi; echo
}
run_case unfixed "PROD HOY sin fix"
run_case fixed   "CON PARCHE 20261110"
DBRUN
chmod +x "$W/dbrun.sh"
chown -R postgres:postgres "$W"
echo "=== corriendo como usuario postgres ==="
runuser -u postgres -- bash "$W/dbrun.sh"
