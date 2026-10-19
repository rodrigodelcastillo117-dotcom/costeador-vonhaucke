#!/usr/bin/env bash
# CERTIFICACIÓN · un caso real contra PRODUCCIÓN (Edge y base reales) con la cuenta QA del CI (TEST_EMAIL/TEST_PASSWORD).
# Lo corre .github/workflows/certificacion.yml (un job por caso). Evidencia en lab/certificacion/ci/<caso>/.
#   costear-<hoja>   labCostear con la hoja de control lab/costear/hojas_control/<hoja>.json, desde un entorno holdout limpio;
#                    acepta las diferencias de material como lo haría Diseño (LAB_ACEPTAR_DIFERENCIAS=1) para medir la cadena
#                    completa hasta el servidor, guardar y reabrir
#   cocrear-<n>      labCocrear, proyecto n de lab/noche/cocrear10/correr.sh
#   plano-<Cn>       labTorreNorte con el plano sintético Cn de lab/planos/gen_corpus.py (lectura → acomodo → PDF → reabrir)
#   texto | manual   labCotizarFlujo (Voni por texto / banco de precios)
set -u
cd "$(dirname "$0")/../.."
CASO="$1"; RAIZ=$(pwd); OUT="$RAIZ/lab/certificacion/ci/$CASO"; mkdir -p "$OUT"
export PW_EXECUTABLE="$(node -e "console.log(require('playwright').chromium.executablePath())")"
export LAB_GIT_SHA="$(git rev-parse --short HEAD)"
pw() { npx playwright test "$@" --workers=1 --reporter=line --output="$OUT/pw"; }

case "$CASO" in
  costear-*)
    h="${CASO#costear-}"
    node scripts/prepararEntornoHoldout.mjs ../env > "$OUT/prep.log" 2>&1 || { echo "preparación holdout falló"; tail -20 "$OUT/prep.log"; exit 3; }
    cd ../env
    LAB_HOJA="lab/costear/hojas_control/$h.json" LAB_OUT="$OUT" LAB_COSTEAR_NOMBRE="LAB CI $h $(date +%m%d-%H%M)" \
      LAB_COSTEAR_FN=costear-servidor LAB_GIT_SHA="$(git rev-parse --short HEAD)" LAB_ACEPTAR_DIFERENCIAS=1 pw e2e/labCostear.e2e.js ;;
  cocrear-*)
    n="${CASO#cocrear-}"
    LAB_SUFIJO=_ci LAB_COC_BAJAR_BOM=1 bash lab/noche/cocrear10/correr.sh "$n"; rc=$?
    cp -R lab/noche/cocrear10/*_ci "$OUT/" 2>/dev/null; exit $rc ;;
  plano-*)
    c="${CASO#plano-}"
    (cd lab/planos && python3 gen_corpus.py > "$OUT/corpus.log" 2>&1) || { echo "gen_corpus falló"; cat "$OUT/corpus.log"; exit 3; }
    d=$(ls -d lab/planos/${c}_* | head -1)
    [ -f "$d/plano.pdf" ] || { echo "no hay $c"; exit 3; }
    cp "$d/control.json" "$OUT/control.json"
    # El render cuesta: sólo en C1 (el resto mide lectura → acomodo → PDF → reabrir).
    if [ "$c" = "C1" ]; then SINR=; else SINR=1; fi
    LAB_PLANO="$d/plano.pdf" LAB_OUT="$OUT" LAB_CLIENTE="LAB CI plano $c" LAB_SIN_RENDER="$SINR" pw e2e/labTorreNorte.e2e.js ;;
  texto)
    LAB_MODO=texto LAB_OUT="$OUT" LAB_CLIENTE="LAB CI texto" \
      LAB_TEXTO="Oficina para 10 personas: una mesa de juntas de 2.40 x 1.20 para 8 personas con sus 8 sillas, 6 lugares de trabajo operativos de 1.50 con sus 6 sillas, un escritorio de dirección con su silla y una recepción para 2 personas." \
      pw e2e/labCotizarFlujo.e2e.js ;;
  manual)
    LAB_MODO=manual LAB_OUT="$OUT" LAB_CLIENTE="LAB CI manual" LAB_BUSCAR="bench 6|mesa de juntas|archivero|credenza" \
      pw e2e/labCotizarFlujo.e2e.js ;;
  *) echo "caso desconocido: $CASO"; exit 2 ;;
esac
