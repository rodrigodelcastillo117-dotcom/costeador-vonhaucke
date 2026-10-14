#!/bin/bash
# Descarga los binarios OFICIALES (GoTrue = supabase/auth v2.178.0, PostgREST $PGRST_VERSION; por omisión 14.5, la que corre la
# nube: pg_stat_activity.application_name = 'PostgREST 14.5', leído el 14-oct), instala `pg` local y genera un
# secreto JWT aleatorio (nunca se versiona). Requiere Postgres 16 instalado (/usr/lib/postgresql/16/bin).
set -e
cd "$(dirname "$0")"
PGRST=${PGRST_VERSION:-14.5}
if ! { [ -x ./postgrest ] && ./postgrest --version | grep -qx "PostgREST $PGRST"; }; then
  rm -f postgrest
  for a in linux-static-x86-64 linux-static-x64; do   # el nombre del archivo cambió entre v12 y v14
    curl -fsSL -o postgrest.tar.xz "https://github.com/PostgREST/postgrest/releases/download/v$PGRST/postgrest-v$PGRST-$a.tar.xz" && break
  done
  tar -xJf postgrest.tar.xz && rm postgrest.tar.xz
fi
[ -x ./auth ] || { curl -sSL -o auth.tar.gz https://github.com/supabase/auth/releases/download/v2.178.0/auth-v2.178.0-x86.tar.gz && tar -xzf auth.tar.gz && rm auth.tar.gz; }
[ -d node_modules/pg ] || npm i --no-save --no-package-lock pg@8.13.1 >/dev/null
umask 077
[ -s jwt_secret ] || node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))' > jwt_secret
Q=$(pwd); S=$(cat jwt_secret)
cat > gotrue.env <<ENV
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://supabase_auth_admin:qa148-local@127.0.0.1:54329/postgres?sslmode=disable
GOTRUE_DB_MIGRATIONS_PATH=$Q/migrations
GOTRUE_SITE_URL=http://127.0.0.1
API_EXTERNAL_URL=http://127.0.0.1:59999
GOTRUE_API_HOST=127.0.0.1
PORT=59999
GOTRUE_JWT_SECRET=$S
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_LOG_LEVEL=warn
ENV
cat > postgrest.conf <<CONF
db-uri = "postgres://authenticator:qa148-local@127.0.0.1:54329/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$S"
server-host = "127.0.0.1"
server-port = 59998
log-level = "warn"
CONF
echo listo
