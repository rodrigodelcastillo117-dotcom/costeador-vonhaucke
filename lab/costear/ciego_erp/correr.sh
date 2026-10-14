#!/bin/bash
# Prueba ciega contra el ERP: cada hoja (sólo texto comercial) pasa por el flujo completo de Costear en la app (dev 5173
# con Edge -rc, cuenta QA). Uso: QA_PW=<contraseña> BASE=lab/costear/ciego_erp/r1 [CLAVES="ATPU2M ..."] bash lab/costear/ciego_erp/correr.sh
cd "$(dirname "$0")/../../.."
[ -n "$QA_PW" ] || { echo "ABORTO: falta QA_PW (la contraseña nunca va en el repo)"; exit 2; }
# Holdout v4 (reauditoría v3, P1-03/P1-04): la corrida queda atada al binario exacto.
#  · árbol limpio (archivos versionados) y SHA de HEAD registrado: el navegador debe mostrar ESE SHA;
#  · el dev server es el de ESTE checkout (cwd) y llama a las Edge RC EXACTAS de análisis y de costeo.
RAIZ=$(pwd)
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "ABORTO: hay cambios sin commit; el holdout corre sobre un árbol limpio"; exit 2; }
export LAB_GIT_SHA=$(git rev-parse --short HEAD); echo "SHA de la corrida: $LAB_GIT_SHA"
BASE=${BASE:-lab/costear/ciego_erp/r1}; mkdir -p $BASE; echo "$LAB_GIT_SHA" > $BASE/GIT_SHA
for f in lab/costear/ciego_erp/hojas/*.json; do
  c=$(basename $f .json); [ -n "$CLAVES" ] && ! echo " $CLAVES " | grep -q " $c " && continue
  P=$(pgrep -f "^node [^ ]*node_modules/.bin/vite" | head -1)
  if [ -z "$P" ]; then echo "ABORTO: no hay dev server"; exit 2; fi
  ENVV=$(tr '\0' '\n' < /proc/$P/environ)
  echo "$ENVV" | grep -qx "VITE_ANALIZAR_MUEBLE_FN=analizar-mueble-rc" || { echo "ABORTO: el dev server no usa analizar-mueble-rc"; exit 2; }
  echo "$ENVV" | grep -qx "VITE_COSTEAR_FN=costear-servidor-rc" || { echo "ABORTO: el dev server no usa costear-servidor-rc (sin ella cae a la Edge de PRODUCCIÓN)"; exit 2; }
  [ "$(readlink /proc/$P/cwd)" = "$RAIZ" ] || { echo "ABORTO: el dev server sirve otro checkout ($(readlink /proc/$P/cwd))"; exit 2; }
  OUT=$BASE/$c; mkdir -p $OUT; echo "=== $c $(date +%T)"
  LAB_HOJA=$f LAB_OUT=$OUT LAB_COSTEAR_NOMBRE="LAB ciego $c $(date +%m%d-%H%M)" TEST_EMAIL=qa-direccion@vonhaucke.mx TEST_PASSWORD="$QA_PW" LAB_COSTEAR_FN=costear-servidor-rc \
  PW_EXECUTABLE=/opt/pw-browsers/chromium timeout 900 npx playwright test e2e/labCostear.e2e.js --workers=1 --reporter=line --output=/tmp/pw-ciego > $OUT/run.log 2>&1
  echo "exit $? $c"
done
echo FIN
