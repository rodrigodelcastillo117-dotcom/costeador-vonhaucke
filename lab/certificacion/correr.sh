#!/usr/bin/env bash
# CERTIFICACIÓN 18-oct · corre contra PRODUCCIÓN (Edge de producción, base real) los casos reales de la matriz 10/10:
#   COCREAR 1..8 (lab/noche/cocrear10/correr.sh) y COSTEAR A1..A8 (hojas de control de lab/costear/hojas_control).
# Pide la contraseña UNA vez (no se muestra ni se guarda). Cada caso deja JSON + capturas; si uno falla, sigue.
# Uso (desde la raíz del repo, en una terminal):   bash lab/certificacion/correr.sh [cocrear|costear|todo]
set -u
cd "$(dirname "$0")/../.."
QUE="${1:-todo}"
EMAIL="${CERT_EMAIL:-rodrigo.delcastillo@vonhaucke.mx}"
read -r -s -p "Contraseña de $EMAIL (no se muestra): " PASS; echo
[ -n "$PASS" ] || { echo "Sin contraseña: no se corre nada."; exit 2; }
export TEST_EMAIL="$EMAIL" TEST_PASSWORD="$PASS"
export PW_EXECUTABLE="$(node -e "console.log(require('playwright').chromium.executablePath())")"
export LAB_GIT_SHA="$(git rev-parse --short HEAD)"
SAL="lab/certificacion/r_$(date +%m%d_%H%M)"; mkdir -p "$SAL"; echo "$LAB_GIT_SHA" > "$SAL/GIT_SHA"
echo "SHA $LAB_GIT_SHA · salida $SAL"
RES="$SAL/resumen.txt"; : > "$RES"
# macOS no trae `timeout`: límite de 15 min por caso con perl (alarm).
limite() { perl -e 'alarm shift; exec @ARGV' "$@"; }

if [ "$QUE" = "todo" ] || [ "$QUE" = "cocrear" ]; then
  for n in 1 2 3 4 5 6 7 8; do
    echo "=== COCREAR $n $(date +%T)"
    limite 900 env LAB_SUFIJO="_cert$(date +%m%d)" bash lab/noche/cocrear10/correr.sh "$n" > "$SAL/cocrear_$n.log" 2>&1
    rc=$?; echo "cocrear $n exit $rc" | tee -a "$RES"
  done
fi

if [ "$QUE" = "todo" ] || [ "$QUE" = "costear" ]; then
  for f in lab/costear/hojas_control/*.json; do
    c=$(basename "$f" .json); OUT="$SAL/costear_$c"; mkdir -p "$OUT"
    echo "=== COSTEAR $c $(date +%T)"
    limite 900 env LAB_HOJA="$f" LAB_OUT="$OUT" LAB_COSTEAR_NOMBRE="LAB cert $c $(date +%m%d-%H%M)" LAB_COSTEAR_FN=costear-servidor \
      npx playwright test e2e/labCostear.e2e.js --workers=1 --reporter=line --output="$OUT/pw" > "$OUT/run.log" 2>&1
    rc=$?; echo "costear $c exit $rc" | tee -a "$RES"
  done
fi
unset TEST_PASSWORD PASS
echo; echo "FIN · resumen en $RES"; cat "$RES"
