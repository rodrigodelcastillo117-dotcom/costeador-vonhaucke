#!/bin/bash
# Entorno QA VH-148 desde cero: Postgres 16 + GoTrue v2.178.0 + PostgREST v12.2.3 + gateway /auth/v1 /rest/v1.
set -e
Q=$(cd "$(dirname "$0")" && pwd)
# Detiene GoTrue, PostgREST y el gateway de CUALQUIER corrida anterior (por línea de comandos, sin pkill -f).
for pid in $(ls /proc | grep -E '^[0-9]+$'); do
  c=$(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null) || continue
  case "$c" in "./auth serve"*|"./postgrest postgrest.conf"*|"node gateway.mjs"*) kill "$pid" 2>/dev/null || true;; esac
done
sleep 1
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/qa148/pgdata stop -m fast >/dev/null 2>&1 || true
rm -rf /var/tmp/qa148/pgdata
runuser -u postgres -- /usr/lib/postgresql/16/bin/initdb -D /var/tmp/qa148/pgdata -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/qa148/pgdata -o "-p 54329 -c listen_addresses=127.0.0.1 -c unix_socket_directories=/var/tmp/qa148" -l /var/tmp/qa148/pg.log start >/dev/null
sleep 2
psql -h 127.0.0.1 -p 54329 -U postgres -q <<'SQL'
create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'qa148-local'; grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login createrole noinherit password 'qa148-local';
create schema auth authorization supabase_auth_admin; grant create on database postgres to supabase_auth_admin;
create schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role, supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
SQL
cd "$Q"; set -a; . ./gotrue.env; set +a
./auth migrate >/dev/null 2>&1
QA_PG_URL=postgres://postgres@127.0.0.1:54329/postgres node --import ./registrar.mjs construir_base.mjs
psql -h 127.0.0.1 -p 54329 -U postgres -q -c "insert into public.permitidos(email, rol) values ('qa148-diseno@vonhaucke.test','diseno') on conflict (email) do nothing"
nohup ./auth serve > gotrue.log 2>&1 &
nohup ./postgrest postgrest.conf > postgrest.log 2>&1 &
nohup node gateway.mjs > gateway.log 2>&1 &
sleep 3
curl -sS -m 5 http://127.0.0.1:59990/auth/v1/health; echo
