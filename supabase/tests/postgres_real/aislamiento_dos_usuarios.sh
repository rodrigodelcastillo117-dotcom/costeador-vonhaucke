#!/usr/bin/env bash
# ============================================================================
#  P0 expediente_costeo · AISLAMIENTO ENTRE USUARIOS en Postgres REAL (no prod).
#  Dueño = auth.uid() (UUID INMUTABLE). Levanta un cluster efimero (initdb),
#  aplica 20261111 (base) + 20261112 (fix) sobre una fila HEREDADA (como la QA en
#  prod, con backfill email->uid), y verifica con RLS y roles REALES:
#    1. authenticated NO tiene acceso directo a la tabla (solo via RPC).
#    2. RLS filtra por propietario=auth.uid() (B no ve la fila de A).
#    3. RPC reabrir/guardar aisladas por uid (B no lee/sobrescribe/reclama a A).
#    4. SECURITY DEFINER + search_path fijado.
#    5. propietario inmutable; reasignar el email NO transfiere el expediente.
#    6. VERSION_CONFLICT ya no filtra la version.
#    7. El ROLLBACK ABORTA si existen claves repetidas por dueño.
#    8. EJECUCION TRANSACCIONAL (atomica, todo-o-nada).
#  Prepara SQL como root y corre la parte de BD como usuario 'postgres'.
# ============================================================================
set -u
REPO=/home/user/costeador-vonhaucke
W=/tmp/pgiso
rm -rf "$W"; mkdir -p "$W"

cat > "$W/stub.sql" <<'SQL'
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select case when coalesce(current_setting('test.email', true),'')='' then '{}'::jsonb
    else jsonb_build_object('email', current_setting('test.email', true)) end $$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true),'')::uuid $$;
create table auth.users (id uuid primary key, email text);
insert into auth.users (id,email) values
  ('11111111-1111-1111-1111-111111111111','a@vh.mx'),
  ('22222222-2222-2222-2222-222222222222','b@vh.mx');
do $$ begin
  if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant execute on function auth.jwt() to authenticated, anon;
SQL

cp "$REPO/supabase/migrations/20261111_expediente_costeo.sql" "$W/mig_base.sql"
cp "$REPO/supabase/migrations/20261112_expediente_costeo_seguridad.sql" "$W/mig_fix.sql"
cp "$REPO/supabase/migrations/ROLLBACK_20261112_expediente_costeo_seguridad.sql" "$W/rollback.sql"

cat > "$W/dbrun.sh" <<'DBRUN'
#!/usr/bin/env bash
set -u
W=/tmp/pgiso
UA=11111111-1111-1111-1111-111111111111; EA=a@vh.mx
UB=22222222-2222-2222-2222-222222222222; EB=b@vh.mx
PGBIN=/usr/lib/postgresql/16/bin
DATA=$W/data; SOCK=$W/sock; LOG=$W/pg.log
rm -rf "$DATA" "$SOCK"; mkdir -p "$DATA" "$SOCK"
"$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null 2>&1 || { echo FALLO_initdb; exit 1; }
"$PGBIN/pg_ctl" -D "$DATA" -l "$LOG" -o "-k $SOCK -c listen_addresses=''" -w start >/dev/null 2>&1 || { echo FALLO_start; cat "$LOG"; exit 1; }
trap '"$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1' EXIT
P(){ psql -h "$SOCK" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
S(){ psql -h "$SOCK" -U postgres -tAq "$@"; }
E(){ psql -h "$SOCK" -U postgres -tAq "$@" 2>&1; }
PKORDER="select string_agg(a.attname, ',' order by k.ord) from pg_index i join lateral unnest(i.indkey) with ordinality as k(attnum,ord) on true join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum where i.indrelid='public.expediente_costeo'::regclass and i.indisprimary"
PASS=0; FAIL=0
ok(){ if eval "$2"; then echo "  PASS · $1"; PASS=$((PASS+1)); else echo "  FAIL · $1 [$3]"; FAIL=$((FAIL+1)); fi; }

P -c "create database t" >/dev/null
P -d t -f "$W/stub.sql" >/dev/null
P -d t -f "$W/mig_base.sql" >/dev/null
# Fila HEREDADA con email de A (el fix hara backfill propietario=uid de A).
P -d t -c "insert into public.expediente_costeo(clave,version,expediente,creado_por,actualizado_por)
           values('TELSVH120',3,'{\"qa\":true,\"secreto\":\"de A\"}'::jsonb,'$EA','$EA');" >/dev/null
P -d t -f "$W/mig_fix.sql" >/dev/null 2>"$W/fixerr.txt" || { echo "FALLO aplicar fix:"; cat "$W/fixerr.txt"; exit 1; }
BFprop=$(S -d t -c "select propietario from public.expediente_costeo where clave='TELSVH120';")
echo "== Fix aplicado; backfill propietario=$BFprop (uid de A) =="
ok "backfill email->uid asigno el uid de A a la fila heredada" '[[ "$BFprop" == "$UA" ]]' "BFprop=$BFprop"

echo; echo "### 1. authenticated NO accede directo a la tabla (solo via RPC) ###"
R=$(E -d t -c "set role authenticated; set test.uid='$UB'; select count(*) from public.expediente_costeo;")
ok "SELECT directo de authenticated -> denegado" '[[ "$R" == *"permission denied"* ]]' "got=$R"

echo; echo "### 2. RLS por propietario=auth.uid() (defensa en profundidad) ###"
P -d t -c "grant select on public.expediente_costeo to authenticated;" >/dev/null
S -d t -c "set test.uid='$UB'; set test.email='$EB'; select public.guardar_expediente_costeo('TELSVH120','{\"marca\":\"de B\"}'::jsonb,null);" >/dev/null
VB=$(S -d t -c "set role authenticated; set test.uid='$UB'; select count(*) from public.expediente_costeo where clave='TELSVH120';")
VA=$(S -d t -c "set role authenticated; set test.uid='$UA'; select count(*) from public.expediente_costeo where clave='TELSVH120';")
VBsec=$(S -d t -c "set role authenticated; set test.uid='$UB'; select coalesce(string_agg(expediente->>'secreto',','),'<nada>') from public.expediente_costeo where clave='TELSVH120';")
ok "B solo ve SU fila (RLS por uid)" '[[ "$VB" == "1" ]]' "VB=$VB"
ok "A solo ve SU fila (RLS por uid)" '[[ "$VA" == "1" ]]' "VA=$VA"
ok "B NO puede leer el secreto de A por via directa+RLS" '[[ "$VBsec" == "<nada>" ]]' "VBsec=$VBsec"
P -d t -c "revoke select on public.expediente_costeo from authenticated;" >/dev/null

echo; echo "### 3. RPC aisladas por uid: B no lee/sobrescribe/reclama a A ###"
RB=$(S -d t -c "set test.uid='$UB'; set test.email='$EB'; select coalesce((public.reabrir_expediente_costeo('TELSVH120'))->>'expediente','<null>');")
S -d t -c "set test.uid='$UB'; set test.email='$EB'; select public.guardar_expediente_costeo('TELSVH120','{\"marca\":\"hackeo\"}'::jsonb,3);" >/dev/null 2>&1 || true
Asec=$(S -d t -c "set test.uid='$UA'; set test.email='$EA'; select (public.reabrir_expediente_costeo('TELSVH120'))->'expediente'->>'secreto';")
Aprop=$(S -d t -c "select propietario from public.expediente_costeo where clave='TELSVH120' and propietario='$UA';")
NROWS=$(S -d t -c "select count(*) from public.expediente_costeo where clave='TELSVH120';")
ok "B reabrir('TELSVH120') NO devuelve la fila de A" '[[ "$RB" != *"de A"* ]]' "RB=$RB"
ok "tras intento de B, el secreto de A sigue intacto" '[[ "$Asec" == "de A" ]]' "Asec=$Asec"
ok "A sigue siendo dueño (propietario=uid inmutable)" '[[ "$Aprop" == "$UA" ]]' "Aprop=$Aprop"
ok "coexisten 2 filas (una por dueño), sin colision" '[[ "$NROWS" == "2" ]]' "NROWS=$NROWS"

echo; echo "### 4. SECURITY DEFINER + search_path fijado ###"
SD=$(S -d t -c "select prosecdef::text||'|'||coalesce(array_to_string(proconfig,','),'') from pg_proc where proname='guardar_expediente_costeo' and pronamespace='public'::regnamespace;")
ok "guardar es SECURITY DEFINER con search_path pinneado" '[[ "$SD" == t*search_path* ]]' "SD=$SD"

echo; echo "### 5. propietario inmutable; reasignar email NO transfiere ###"
V1=$(S -d t -c "set test.uid='$UA'; set test.email='$EA'; select (public.guardar_expediente_costeo('TELSVH120','{\"secreto\":\"de A\",\"v\":4}'::jsonb,3))->>'version';")
Aprop2=$(S -d t -c "select propietario from public.expediente_costeo where clave='TELSVH120' and propietario='$UA';")
ok "A sube a v4 y propietario sigue siendo su uid" '[[ "$V1" == "4" && "$Aprop2" == "$UA" ]]' "v=$V1 prop=$Aprop2"
# B toma el EMAIL de A (mismo email, su propio uid) -> NO accede a la fila de A.
RBemail=$(S -d t -c "set test.uid='$UB'; set test.email='$EA'; select coalesce((public.reabrir_expediente_costeo('TELSVH120'))->>'expediente','<null>');")
ok "reasignar el email de A a B NO transfiere el expediente (dueño=uid)" '[[ "$RBemail" != *"de A"* ]]' "RBemail=$RBemail"

echo; echo "### 6. VERSION_CONFLICT ya no filtra la version ###"
VC=$(E -d t -c "set test.uid='$UA'; set test.email='$EA'; select public.guardar_expediente_costeo('TELSVH120','{\"x\":1}'::jsonb,1);")
ok "VERSION_CONFLICT presente" '[[ "$VC" == *VERSION_CONFLICT* ]]' "VC=$VC"
ok "el mensaje NO revela el numero de version" '! grep -qiE "version [0-9]" <<< "$VC"' "VC=$VC"

echo; echo "### 7. ROLLBACK aborta si hay claves repetidas por dueño ###"
RB2=$(E -d t -f "$W/rollback.sql")
ok "ROLLBACK_ABORTADO ante colision (sin perder datos)" '[[ "$RB2" == *ROLLBACK_ABORTADO* ]]' "RB2=$(tr "\n" " " <<< "$RB2" | tail -c 160)"
NROWS2=$(S -d t -c "select count(*) from public.expediente_costeo;")
ok "las filas siguen ahi tras el rollback abortado" '[[ "$NROWS2" == "2" ]]' "NROWS2=$NROWS2"

echo; echo "### 8. EJECUCION TRANSACCIONAL (atomica, todo-o-nada) ###"
P -c "create database tx" >/dev/null
P -d tx -f "$W/stub.sql" >/dev/null
P -d tx -f "$W/mig_base.sql" >/dev/null
P -d tx -c "insert into public.expediente_costeo(clave,version,expediente,creado_por,actualizado_por) values('TELSVH120',3,'{\"qa\":true}'::jsonb,'$EA','$EA');" >/dev/null
{ echo "begin;"; cat "$W/mig_fix.sql"; echo "select 1/0;"; echo "commit;"; } | psql -h "$SOCK" -U postgres -v ON_ERROR_STOP=1 -q -d tx >/dev/null 2>"$W/txerr.txt" || true
PKtx=$(S -d tx -c "$PKORDER;")
HISTtx=$(S -d tx -c "select to_regclass('public.expediente_costeo_historial') is not null;")
PROPtx=$(S -d tx -c "select count(*) from information_schema.columns where table_schema='public' and table_name='expediente_costeo' and column_name='propietario';")
ok "la transaccion fallida NO dejo cambios (PK sigue siendo clave)" '[[ "$PKtx" == "clave" ]]' "PKtx=$PKtx"
ok "la transaccion fallida NO creo el historial" '[[ "$HISTtx" == "f" ]]' "HISTtx=$HISTtx"
ok "la transaccion fallida NO agrego la columna propietario" '[[ "$PROPtx" == "0" ]]' "PROPtx=$PROPtx"
P -c "create database tx2" >/dev/null
P -d tx2 -f "$W/stub.sql" >/dev/null
P -d tx2 -f "$W/mig_base.sql" >/dev/null
P -d tx2 -c "insert into public.expediente_costeo(clave,version,expediente,creado_por,actualizado_por) values('TELSVH120',3,'{\"qa\":true}'::jsonb,'$EA','$EA');" >/dev/null
{ echo "begin;"; cat "$W/mig_fix.sql"; echo "commit;"; } | psql -h "$SOCK" -U postgres -v ON_ERROR_STOP=1 -q -d tx2 >/dev/null 2>"$W/tx2err.txt" || { echo "  FALLO aplicar en tx2:"; cat "$W/tx2err.txt"; }
PKtx2=$(S -d tx2 -c "$PKORDER;")
HISTtx2=$(S -d tx2 -c "select to_regclass('public.expediente_costeo_historial') is not null;")
MD5tx2=$(S -d tx2 -c "select md5(expediente::text) from public.expediente_costeo where clave='TELSVH120';")
ok "commit transaccional deja el fix COMPLETO (PK propietario,clave)" '[[ "$PKtx2" == "propietario,clave" ]]' "PKtx2=$PKtx2"
ok "commit transaccional crea el historial" '[[ "$HISTtx2" == "t" ]]' "HISTtx2=$HISTtx2"
ok "la fila heredada se preserva en el commit (existe md5)" '[[ -n "$MD5tx2" ]]' "MD5tx2=$MD5tx2"

echo; echo "============================================================"
echo ">>> AISLAMIENTO: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = 0 ] && echo ">>> VEREDICTO: AISLAMIENTO REAL VERIFICADO" || echo ">>> VEREDICTO: HAY FALLOS"
DBRUN
chmod +x "$W/dbrun.sh"
chown -R postgres:postgres "$W"
echo "=== corriendo como usuario postgres ==="
runuser -u postgres -- bash "$W/dbrun.sh"
