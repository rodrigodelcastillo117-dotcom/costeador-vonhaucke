#!/bin/bash
# Prueba ciega contra el ERP: cada hoja (sólo texto comercial) pasa por el flujo completo de Costear en la app (dev 5173
# con Edge -rc, cuenta QA). Uso: QA_PW=<contraseña> BASE=lab/costear/ciego_erp/r1 [CLAVES="ATPU2M ..."] bash lab/costear/ciego_erp/correr.sh
cd "$(dirname "$0")/../../.."
[ -n "$QA_PW" ] || { echo "ABORTO: falta QA_PW (la contraseña nunca va en el repo)"; exit 2; }
BASE=${BASE:-lab/costear/ciego_erp/r1}; mkdir -p $BASE
for f in lab/costear/ciego_erp/hojas/*.json; do
  c=$(basename $f .json); [ -n "$CLAVES" ] && ! echo " $CLAVES " | grep -q " $c " && continue
  P=$(pgrep -f "^node [^ ]*node_modules/.bin/vite" | head -1)
  if [ -z "$P" ] || ! tr '\0' '\n' < /proc/$P/environ | grep -q "^VITE_ANALIZAR_MUEBLE_FN=analizar-mueble-rc"; then echo "ABORTO: el dev server no está en modo RC"; exit 2; fi
  OUT=$BASE/$c; mkdir -p $OUT; echo "=== $c $(date +%T)"
  LAB_HOJA=$f LAB_OUT=$OUT LAB_COSTEAR_NOMBRE="LAB ciego $c $(date +%m%d-%H%M)" TEST_EMAIL=qa-direccion@vonhaucke.mx TEST_PASSWORD="$QA_PW" \
  PW_EXECUTABLE=/opt/pw-browsers/chromium timeout 900 npx playwright test e2e/labCostear.e2e.js --workers=1 --reporter=line --output=/tmp/pw-ciego > $OUT/run.log 2>&1
  echo "exit $? $c"
done
echo FIN
