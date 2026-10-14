#!/bin/bash
# Prueba de ARRANQUE real de una Edge Function antes de desplegarla (auditoría 2026-10-14, P2-05): una regex sobre los
# imports no prueba que el worker arranque. Copia src/ y supabase/ a un directorio aislado (sin package.json, para que
# Deno no use node_modules del proyecto), levanta la función y exige respuesta HTTP a OPTIONS y a POST.
# Uso: DENO=/ruta/a/deno scripts/edge_boot_check.sh costear-servidor-rc
set -u
# Sólo se mata el proceso que este script lanzó (nunca pkill -f por patrón: mataría a quien lo invocó).
FN=${1:?nombre de la función}; DENO=${DENO:-deno}; PORT=8000  # Deno.serve() sin opciones escucha en 8000
RAIZ=$(cd "$(dirname "$0")/.." && pwd); T=$(mktemp -d)
cp -r "$RAIZ/src" "$RAIZ/supabase" "$T/"
cd "$T" && timeout 120 "$DENO" run --allow-all --no-check "supabase/functions/$FN/index.ts" > "$T/boot.log" 2>&1 &
PID=$!; cd - >/dev/null
for _ in $(seq 1 90); do c=$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "http://localhost:$PORT/" 2>/dev/null); [ "$c" != "000" ] && break; sleep 1; done
p=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:$PORT/" -H 'content-type: application/json' -d '{}' 2>/dev/null)
kill "$PID" >/dev/null 2>&1; pkill -P "$PID" >/dev/null 2>&1; wait "$PID" 2>/dev/null
echo "OPTIONS=$c POST=$p"
if [ "$c" = "000" ] || [ "$p" = "000" ]; then echo "NO ARRANCA:"; tail -20 "$T/boot.log"; rm -rf "$T"; exit 1; fi
rm -rf "$T"; echo "ARRANCA"
