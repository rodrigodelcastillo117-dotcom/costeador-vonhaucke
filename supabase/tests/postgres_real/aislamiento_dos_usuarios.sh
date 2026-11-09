#!/usr/bin/env bash
# ============================================================================
#  P0 expediente_costeo · AISLAMIENTO ENTRE USUARIOS en Postgres REAL (no prod).
#  Levanta un cluster efimero (initdb), aplica 20261111 (base) + 20261112 (fix)
#  sobre una fila HEREDADA (como la QA en prod) y verifica, con RLS y roles
#  REALES (no PGlite-superuser):
#    1. authenticated NO tiene acceso directo a la tabla (solo via RPC).
#    2. RLS filtra por creado_por inmutable (B no ve la fila de A).
#    3. RPC reabrir/guardar aisladas por dueño (B no lee/sobrescribe/reclama a A).
#    4. SECURITY DEFINER + search_path fijado.
#    5. creado_por inmutable tras varios guardados.
#    6. VERSION_CONFLICT ya no filtra la version.
#    7. El ROLLBACK ABORTA si existen claves repetidas por dueño (no colapsa a PK
#       global ni pierde datos) — la preocupacion explicita de la auditoria.
#  Prepara SQL como root y corre la parte de BD como usuario 'postgres'.
# ============================================================================
set -u
REPO=/home/user/costeador-vonhaucke
W=/tmp/pgiso
rm -rf "$W"; mkdir -p "$W"

cat > "$W/stub.sql" <<'SQL'
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select case when coalesce(current_setting('test.email', true),'')='' then null
    else jsonb_build_object('email', current_setting('test.email', true)) end $$;
do $$ begin
  if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
SQL

cp "$REPO/supabase/migrations/20261111_expediente_costeo.sql" "$W/mig_base.sql"
cp "$REPO/supabase/migrations/20261112_expediente_costeo_seguridad.sql" "$W/mig_fix.sql"
cp "$REPO/supabase/migrations/ROLLBACK_20261112_expediente_costeo_seguridad.sql" "$W/rollback.sql"

cat > "$W/dbrun.sh" <<'DBRUN'
#!/usr/bin/env bash
set -u
W=/tmp/pgiso
PGBIN=/usr/lib/postgresql/16/bin
DATA=$W/data; SOCK=$W/sock; LOG=$W/pg.log
rm -rf "$DATA" "$SOCK"; mkdir -p "$DATA" "$SOCK"
"$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null 2>&1 || { echo FALLO_initdb; exit 1; }
"$PGBIN/pg_ctl" -D "$DATA" -l "$LOG" -o "-k $SOCK -c listen_addresses=''" -w start >/dev/null 2>&1 || { echo FALLO_start; cat "$LOG"; exit 1; }
trap '"$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1' EXIT
P(){ psql -h "$SOCK" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
S(){ psql -h "$SOCK" -U postgres -tAq "$@"; }        # scalar
E(){ psql -h "$SOCK" -U postgres -tAq "$@" 2>&1; }   # captura errores esperados (sin ON_ERROR_STOP)
PASS=0; FAIL=0
ok(){ if eval "$2"; then echo "  PASS · $1"; PASS=$((PASS+1)); else echo "  FAIL · $1 [$3]"; FAIL=$((FAIL+1)); fi; }

P -c "create database t" >/dev/null
P -d t -f "$W/stub.sql" >/dev/null
P -d t -f "$W/mig_base.sql" >/dev/null
# Fila HEREDADA (como la QA en prod), creada bajo el contrato viejo:
P -d t -c "insert into public.expediente_costeo(clave,version,expediente,creado_por,actualizado_por)
           values('TELSVH120',3,'{\"qa\":true,\"secreto\":\"de A\"}'::jsonb,'a@vh.mx','a@vh.mx');" >/dev/null
# Aplica el FIX encima (como seria en prod):
P -d t -f "$W/mig_fix.sql" >/dev/null 2>"$W/fixerr.txt" || { echo "FALLO aplicar fix:"; cat "$W/fixerr.txt"; exit 1; }
echo "== Fix 20261112 aplicado sobre la fila heredada =="

echo; echo "### 1. authenticated NO accede directo a la tabla (solo via RPC) ###"
R=$(E -d t -c "set role authenticated; set test.email='b@vh.mx'; select count(*) from public.expediente_costeo;")
ok "SELECT directo de authenticated -> denegado" '[[ "$R" == *"permission denied"* ]]' "got=$R"

echo; echo "### 2. RLS por creado_por (defensa en profundidad): se concede SELECT y se prueba el filtro ###"
P -d t -c "grant select on public.expediente_costeo to authenticated;" >/dev/null
# B guarda su propia fila primero (via RPC) para que existan 2 filas de la misma clave:
S -d t -c "set test.email='b@vh.mx'; select public.guardar_expediente_costeo('TELSVH120','{\"marca\":\"de B\"}'::jsonb,null);" >/dev/null
VB=$(S -d t -c "set role authenticated; set test.email='b@vh.mx'; select count(*) from public.expediente_costeo where clave='TELSVH120';")
VA=$(S -d t -c "set role authenticated; set test.email='a@vh.mx'; select count(*) from public.expediente_costeo where clave='TELSVH120';")
VBsec=$(S -d t -c "set role authenticated; set test.email='b@vh.mx'; select coalesce(string_agg(expediente->>'secreto',','),'<nada>') from public.expediente_costeo where clave='TELSVH120';")
ok "B solo ve SU fila (RLS), no la de A" '[[ "$VB" == "1" ]]' "VB=$VB"
ok "A solo ve SU fila (RLS)" '[[ "$VA" == "1" ]]' "VA=$VA"
ok "B NO puede leer el secreto de A por via directa+RLS" '[[ "$VBsec" == "<nada>" ]]' "VBsec=$VBsec"
P -d t -c "revoke select on public.expediente_costeo from authenticated;" >/dev/null

echo; echo "### 3. RPC aisladas por dueño: B no lee/sobrescribe/reclama a A ###"
RB=$(S -d t -c "set test.email='b@vh.mx'; select coalesce((public.reabrir_expediente_costeo('TELSVH120'))->>'expediente','<null>');")
# B intenta sobrescribir con la version conocida de A (3):
S -d t -c "set test.email='b@vh.mx'; select public.guardar_expediente_costeo('TELSVH120','{\"marca\":\"hackeo\"}'::jsonb,3);" >/dev/null 2>&1 || true
Asec=$(S -d t -c "set test.email='a@vh.mx'; select (public.reabrir_expediente_costeo('TELSVH120'))->'expediente'->>'secreto';")
Aown=$(S -d t -c "select creado_por from public.expediente_costeo where clave='TELSVH120' and creado_por='a@vh.mx';")
NROWS=$(S -d t -c "select count(*) from public.expediente_costeo where clave='TELSVH120';")
ok "B reabrir('TELSVH120') NO devuelve la fila de A" '[[ "$RB" != *"de A"* ]]' "RB=$RB"
ok "tras intento de B, el secreto de A sigue intacto" '[[ "$Asec" == "de A" ]]' "Asec=$Asec"
ok "A sigue siendo dueño (creado_por inmutable)" '[[ "$Aown" == "a@vh.mx" ]]' "Aown=$Aown"
ok "coexisten 2 filas (una por dueño), sin colision" '[[ "$NROWS" == "2" ]]' "NROWS=$NROWS"

echo; echo "### 4. SECURITY DEFINER + search_path fijado ###"
SD=$(S -d t -c "select prosecdef::text||'|'||coalesce(array_to_string(proconfig,','),'') from pg_proc where proname='guardar_expediente_costeo' and pronamespace='public'::regnamespace;")
ok "guardar es SECURITY DEFINER con search_path pinneado" '[[ "$SD" == t*search_path* ]]' "SD=$SD"

echo; echo "### 5. creado_por inmutable tras varios guardados de A ###"
V1=$(S -d t -c "set test.email='a@vh.mx'; select (public.guardar_expediente_costeo('TELSVH120','{\"secreto\":\"de A\",\"v\":4}'::jsonb,3))->>'version';")
Aown2=$(S -d t -c "select creado_por from public.expediente_costeo where clave='TELSVH120' and creado_por='a@vh.mx';")
ok "A sube a v4 y creado_por sigue siendo A" '[[ "$V1" == "4" && "$Aown2" == "a@vh.mx" ]]' "v=$V1 own=$Aown2"

echo; echo "### 6. VERSION_CONFLICT ya no filtra la version ###"
VC=$(E -d t -c "set test.email='a@vh.mx'; select public.guardar_expediente_costeo('TELSVH120','{\"x\":1}'::jsonb,1);")
ok "VERSION_CONFLICT presente" '[[ "$VC" == *VERSION_CONFLICT* ]]' "VC=$VC"
ok "el mensaje NO revela el numero de version" '! grep -qiE "version [0-9]" <<< "$VC"' "VC=$VC"

echo; echo "### 7. ROLLBACK aborta si hay claves repetidas por dueño (no colapsa a PK global) ###"
RB2=$(E -d t -f "$W/rollback.sql")
ok "ROLLBACK_ABORTADO ante colision (sin perder datos)" '[[ "$RB2" == *ROLLBACK_ABORTADO* ]]' "RB2=$(tr "\n" " " <<< "$RB2" | tail -c 160)"
NROWS2=$(S -d t -c "select count(*) from public.expediente_costeo;")
ok "las filas siguen ahi tras el rollback abortado" '[[ "$NROWS2" == "2" ]]' "NROWS2=$NROWS2"

echo; echo "============================================================"
echo ">>> AISLAMIENTO: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = 0 ] && echo ">>> VEREDICTO: AISLAMIENTO REAL VERIFICADO" || echo ">>> VEREDICTO: HAY FALLOS"
DBRUN
chmod +x "$W/dbrun.sh"
chown -R postgres:postgres "$W"
echo "=== corriendo como usuario postgres ==="
runuser -u postgres -- bash "$W/dbrun.sh"
