#!/usr/bin/env bash
# CERTIFICACIÓN · un caso real contra PRODUCCIÓN (Edge y base reales) con la cuenta QA del CI (TEST_EMAIL/TEST_PASSWORD).
# Lo corre .github/workflows/certificacion.yml (un job por caso). Evidencia en lab/certificacion/ci/<caso>/.
#   costear-<hoja>   labCostear con la hoja de control lab/costear/hojas_control/<hoja>.json, desde un entorno holdout limpio;
#                    acepta las diferencias de material como lo haría Diseño (LAB_ACEPTAR_DIFERENCIAS=1) para medir la cadena
#                    completa hasta el servidor, guardar y reabrir
#   cocrear-<n>      labCocrear, proyecto n de lab/noche/cocrear10/correr.sh
#   cocrearrc-<n>    igual, costeando con costear-servidor-rc (motor de la rama)
#   plano-<Cn>       labTorreNorte con el plano sintético Cn de lab/planos/gen_corpus.py (lectura → acomodo → PDF → reabrir)
#   planorc-<Cn>     igual, con el lector de planos RC (VITE_LEER_PLANO_FN=leer-plano-rc)
#   texto | manual   labCotizarFlujo (Voni por texto / banco de precios)
set -u
cd "$(dirname "$0")/../.."
CASO="$1"; RAIZ=$(pwd); OUT="$RAIZ/lab/certificacion/ci/$CASO"; mkdir -p "$OUT"
# Cierre ChatGPT (P1-REL-01): "<caso>~preview" corre el MISMO caso contra la Vercel PREVIEW del FINAL_SHA
# (lab/certificacion/preview_url.txt) en vez de un vite local.
if [ "${CASO%~preview}" != "$CASO" ]; then
  export E2E_BASE_URL="$(cat lab/certificacion/preview_url.txt)"; CASO="${CASO%~preview}"
  # La URL es el alias de la rama; el caso sólo corre si ESA preview sirve EXACTAMENTE este commit (__BUILD_SHA__ del
  # bundle = git HEAD). Espera hasta 15 min a que Vercel termine el build del FINAL_SHA; si no, falla (no certifica otro).
  SHA7="$(git rev-parse --short=7 HEAD)"; ok=0
  for i in $(seq 1 90); do
    js="$(curl -s "$E2E_BASE_URL/" | grep -o 'src="/assets/index-[^"]*\.js"' | head -1 | cut -d'"' -f2)"
    if [ -n "$js" ] && curl -s "$E2E_BASE_URL$js" | grep -q "$SHA7\""; then ok=1; break; fi
    sleep 10
  done
  [ "$ok" = 1 ] || { echo "la preview $E2E_BASE_URL NO sirve $SHA7: no se certifica otro commit"; exit 4; }
  echo "contra la preview: $E2E_BASE_URL (sirve $SHA7)"
fi
export PW_EXECUTABLE="$(node -e "console.log(require('playwright').chromium.executablePath())")"
export LAB_GIT_SHA="$(git rev-parse --short HEAD)"
pw() { npx playwright test "$@" --workers=1 --retries=0 --reporter=line --output="$OUT/pw"; }   # un lab no se reintenta solo: 10 min y doble gasto de IA

case "$CASO" in
  costear-*)
    h="${CASO#costear-}"
    node scripts/prepararEntornoHoldout.mjs ../env > "$OUT/prep.log" 2>&1 || { echo "preparación holdout falló"; tail -20 "$OUT/prep.log"; exit 3; }
    cd ../env
    LAB_HOJA="lab/costear/hojas_control/$h.json" LAB_OUT="$OUT" LAB_COSTEAR_NOMBRE="LAB CI $h $(date +%m%d-%H%M)" \
      LAB_COSTEAR_FN=costear-servidor LAB_GIT_SHA="$(git rev-parse --short HEAD)" LAB_ACEPTAR_DIFERENCIAS=1 pw e2e/labCostear.e2e.js ;;
  cocrear-*|cocrearrc-*)
    # cocrearrc-<n>: el MISMO proyecto costeado con costear-servidor-rc (el motor de ESTA rama, desplegado como RC) para
    # probar un arreglo del motor de punta a punta antes de que Dirección despliegue el de producción.
    if [ "${CASO#cocrearrc-}" != "$CASO" ]; then export VITE_COSTEAR_FN=costear-servidor-rc; n="${CASO#cocrearrc-}"; else n="${CASO#cocrear-}"; fi
    LAB_SUFIJO=_ci LAB_COC_BAJAR_BOM=1 bash lab/noche/cocrear10/correr.sh "$n"; rc=$?
    cp -R lab/noche/cocrear10/*_ci "$OUT/" 2>/dev/null; exit $rc ;;
  plano-*|planorc-*)
    # planorc-<Cn>: el MISMO plano leído con el lector RC (leer-plano-rc → leer-plano-core-rc), para medir antes de promoverlo.
    if [ "${CASO#planorc-}" != "$CASO" ]; then export VITE_LEER_PLANO_FN=leer-plano-rc; c="${CASO#planorc-}"; else c="${CASO#plano-}"; fi
    (cd lab/planos && python3 gen_corpus.py > "$OUT/corpus.log" 2>&1) || { echo "gen_corpus falló"; cat "$OUT/corpus.log"; exit 3; }
    d=$(ls -d lab/planos/${c}_* | head -1)
    [ -f "$d/plano.pdf" ] || { echo "no hay $c"; exit 3; }
    cp "$d/control.json" "$OUT/control.json"; export LAB_CONTROL="$d/control.json"
    # El render cuesta: sólo en C1 (el resto mide lectura → acomodo → PDF → reabrir).
    if [ "$c" = "C1" ]; then SINR=; else SINR=1; fi
    LAB_PLANO="$d/plano.pdf" LAB_OUT="$OUT" LAB_CLIENTE="LAB CI plano $c" LAB_SIN_RENDER="$SINR" pw e2e/labTorreNorte.e2e.js ;;
  rodrigo)
    # Prueba de Rodrigo 19-oct (cot. 3354): plano C7 con lo ya cotizado por texto (16 WIN, GAMMA-E de recepción, Ergonova 4).
    (cd lab/planos && python3 gen_corpus.py > "$OUT/corpus.log" 2>&1) || { echo "gen_corpus falló"; cat "$OUT/corpus.log"; exit 3; }
    d=$(ls -d lab/planos/C7_* | head -1); cp "$d/control.json" "$OUT/control.json"
    LAB_PLANO="$d/plano.pdf" LAB_OUT="$OUT" LAB_CLIENTE="LAB CI prueba Rodrigo" LAB_SIN_RENDER=1 \
      LAB_PARTIDAS_INICIALES="$RAIZ/lab/certificacion/rodrigo_partidas.json" pw e2e/labTorreNorte.e2e.js ;;
  recorrido-*)
    # Recorridos combinados con auditor (e2e/labRecorridos.e2e.js): recorrido-<texto-plano|plano-texto|plano-reabrir>[@Cn].
    r="${CASO#recorrido-}"; c="C7"; case "$r" in *@*) c="${r#*@}"; r="${r%@*}";; esac
    (cd lab/planos && python3 gen_corpus.py > "$OUT/corpus.log" 2>&1) || { echo "gen_corpus falló"; cat "$OUT/corpus.log"; exit 3; }
    d=$(ls -d lab/planos/${c}_* | head -1); cp "$d/control.json" "$OUT/control.json"
    # El texto describe la MISMA oficina que el plano (si no, el auditor marca con razón que no cuadran).
    if [ "$c" = "C1" ]; then export LAB_TEXTO="Oficina con 12 puestos operativos, una recepción para 1 persona con su silla, una oficina de dirección con escritorio y su silla y una sala de juntas para 8 personas."; fi
    LAB_RECORRIDO="$r" LAB_PLANO="$d/plano.pdf" LAB_CONTROL="$d/control.json" LAB_OUT="$OUT" LAB_CLIENTE="LAB CI $CASO $(date +%m%d-%H%M)" \
      pw e2e/labRecorridos.e2e.js ;;
  texto)
    LAB_MODO=texto LAB_OUT="$OUT" LAB_CLIENTE="LAB CI texto" \
      LAB_TEXTO="Oficina para 10 personas: una mesa de juntas de 2.40 x 1.20 para 8 personas con sus 8 sillas, 6 lugares de trabajo operativos de 1.50 con sus 6 sillas, un escritorio de dirección con su silla y una recepción para 2 personas." \
      pw e2e/labCotizarFlujo.e2e.js ;;
  manual)
    LAB_MODO=manual LAB_OUT="$OUT" LAB_CLIENTE="LAB CI manual" LAB_BUSCAR="bench 6|mesa de juntas|archivero|credenza" \
      pw e2e/labCotizarFlujo.e2e.js ;;
  *) echo "caso desconocido: $CASO"; exit 2 ;;
esac
