#!/bin/bash
# ============================================================================
#  DEPLOY del costeador Von Haucke.
#
#    bash deploy.sh           -> compila y publica la app
#    bash deploy.sh renders   -> además sube los renders de catálogo
#
#  Requiere que las policies temporales app_temp_write / app_temp_update estén
#  puestas (Claude las crea y las borra por el conector de Supabase).
#
#  OJO: para CREAR un objeto Storage pide POST; PUT sólo ACTUALIZA uno que ya
#  existe. index.html ya existe -> PUT. Los renders nuevos -> POST.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")" || exit 1

LLAVE="sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y"
OBJ="https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object"
VIVO="https://costeador-vonhaucke-rodrigos-eurotrip.vercel.app/"

echo "→ Revisando que ningún prop apunte a algo inexistente…"
node scripts/revisa-indefinidos.mjs || {
  echo "✗ NO SE PUBLICA: eso deja pantallas en blanco (ver arriba)."; exit 1;
}

echo "→ Revisando que ningún precio tenga error de unidad…"
node scripts/revisa-precios.mjs || {
  echo "✗ NO SE PUBLICA: hay un precio fuera de su rango (casi siempre es la UNIDAD)."; exit 1;
}

echo "→ Corriendo las pruebas del motor…"
node scripts/revisa-jerarquia.mjs >/dev/null || {
  echo "✗ NO SE PUBLICA: una línea se salió de su jerarquía (la barata cotizando"
  echo "  arriba de la cara, o al revés). Corre: node scripts/revisa-jerarquia.mjs"
  exit 1
}
node scripts/revisa-alcanzables.mjs >/dev/null || {
  echo "✗ NO SE PUBLICA: hay precios reales sembrados en configuraciones que la"
  echo "  pantalla no puede armar. Corre: node scripts/revisa-alcanzables.mjs"
  exit 1
}
npm test --silent >/dev/null 2>&1 || { echo "✗ NO SE PUBLICA: fallan las pruebas del motor."; exit 1; }

# ⚠️ EL GUARDIÁN DEL PLANO DE RODRIGO (2026-08-17). Rodrigo, después de reportar
# cinco cosas seguidas: "¿cómo le podemos hacer para que ya quede esto? Ya me
# cansé". La causa era de método: cada arreglo se verificaba POR SEPARADO, así
# que al caminar el camino entero salía la siguiente pieza rota. Esto corre el
# CAMINO COMPLETO con su plano real y exige el resultado que él aceptaría:
# las 8 islas con su banca y sus sillas, cada sala con su mesa, la recepción con
# su mostrador, el pasillo vacío, nada encimado y nada sin colocar.
# Va aparte de `npm test` A PROPÓSITO: si truena, el mensaje tiene que decir
# QUÉ del plano se rompió, no "fallan las pruebas".
echo "→ Caminando el plano de prueba de punta a punta…"
npx vitest run src/datos/planoDeRodrigo.test.js --silent >/dev/null 2>&1 || {
  echo "✗ NO SE PUBLICA: el plano de prueba ya no sale bien."
  npx vitest run src/datos/planoDeRodrigo.test.js 2>&1 | grep -E '×|→' | head -12
  exit 1
}

echo "→ Compilando…"
# ⚠️ EL EXIT CODE NO ALCANZA (2026-08-17). `npm run build` sale con **código 0**
# aunque esbuild grite: así se publicó y vivió meses una llave `}` suelta que se
# imprimía en la hoja de costo de las 24 líneas ("The character } is not valid
# inside a JSX element"). El aviso salía en CADA build y nadie lo leía.
# Un build limpio de este proyecto escribe **0 bytes en stderr** —medido—, así
# que cualquier cosa ahí es un defecto del código. Se filtran sólo los avisos
# del propio npm, que no hablan del código.
ERRBUILD=$(mktemp)
npm run build >/dev/null 2>"$ERRBUILD" || { echo "✗ falló el build"; cat "$ERRBUILD"; rm -f "$ERRBUILD"; exit 1; }
RUIDO=$(grep -v -E '^\s*$|^npm (notice|warn|WARN)' "$ERRBUILD" || true)
rm -f "$ERRBUILD"
if [ -n "$RUIDO" ]; then
  echo "✗ NO SE PUBLICA: el build compiló pero avisó de algo en el código."
  echo "  (un build limpio no escribe nada aquí; esto SÍ se ve en pantalla)"
  echo "$RUIDO"
  exit 1
fi
LOCAL=$(wc -c < dist/index.html | tr -d ' ')
echo "  build listo: $LOCAL bytes"

if [ "${1:-}" = "marca" ]; then
  echo "→ Subiendo portadas de la pantalla de entrada…"
  for f in scratchpad/hero/portada-*.jpg; do
    [ -e "$f" ] || continue
    b=$(basename "$f")
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$OBJ/app/marca/$b" \
      -H "apikey: $LLAVE" -H "Authorization: Bearer $LLAVE" \
      -H "Content-Type: image/jpeg" -H "x-upsert: true" --data-binary "@$f")
    echo "  $b -> $code"
  done
fi

if [ "${1:-}" = "renders" ]; then
  echo "→ Subiendo renders de catálogo…"
  ok=0; mal=0
  for f in scratchpad/final/*.jpg; do
    [ -e "$f" ] || continue
    base=$(basename "$f" .jpg); ruta="${base%%-*}"; prod="${base#*-}"
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$OBJ/app/render-ia/$ruta/$prod.jpg" \
      -H "apikey: $LLAVE" -H "Authorization: Bearer $LLAVE" \
      -H "Content-Type: image/jpeg" -H "x-upsert: true" --data-binary "@$f")
    if [ "$code" = "200" ]; then ok=$((ok+1)); printf "."; else mal=$((mal+1)); printf "\n  ✗ %s/%s -> %s\n" "$ruta" "$prod" "$code"; fi
  done
  printf "\n  imágenes: %d subidas, %d fallidas\n" "$ok" "$mal"
fi

if [ "${1:-}" = "sillas" ]; then
  # Fotos de sillería sacadas de los presupuestos reales (ver
  # src/datos/imagenesSilleria.js). El nombre del archivo ES el modelo.
  echo "→ Subiendo fotos de sillería…"
  ok=0; mal=0
  for f in scratchpad/silleria/*.jpg; do
    [ -e "$f" ] || continue
    b=$(basename "$f")
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$OBJ/app/silleria/$b" \
      -H "apikey: $LLAVE" -H "Authorization: Bearer $LLAVE" \
      -H "Content-Type: image/jpeg" -H "x-upsert: true" --data-binary "@$f")
    if [ "$code" = "200" ]; then ok=$((ok+1)); printf "."; else mal=$((mal+1)); printf "\n  ✗ %s -> %s\n" "$b" "$code"; fi
  done
  printf "\n  sillas: %d subidas, %d fallidas\n" "$ok" "$mal"
fi

echo "→ Publicando la app…"
# ⚠️ 2026-08-19: EL SITIO YA NO SE SIRVE DESDE SUPABASE. Vivía de un PUT aquí a
# `app/index.html` porque el proyecto de Vercel no tenía build propio
# (`framework: null`) — Vercel sólo hacía de dominio/proxy. Desde que se corrió
# `vercel --prod` real (2026-08-19), el alias de producción quedó apuntando al
# build DE VERCEL, y ese PUT a Supabase deja de llegar a lo que el cliente ve
# aunque devuelva 200. El publish de verdad es `vercel --prod`.
# Con el token en `.vercel/claude-token` (gitignorado) se corre sin pedir
# login — así Claude puede publicar solo, sin terminal del lado de Rodrigo. Si
# el token no está (Rodrigo corriendo esto a mano, sin haberlo configurado), se
# cae al PUT viejo con una advertencia: peor es no publicar nada.
if [ -f .vercel/claude-token ]; then
  TOK=$(cat .vercel/claude-token)
  SALIDA=$(npx vercel --prod --token="$TOK" --yes 2>&1)
  echo "$SALIDA" | grep -q '"readyState":\s*"READY"' || { echo "✗ el deploy de Vercel no quedó READY:"; echo "$SALIDA"; exit 1; }
  echo "  vercel --prod: listo"
else
  echo "  (sin .vercel/claude-token: publicando por el camino viejo a Supabase — puede que ya no sirva al dominio real)"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$OBJ/app/index.html" \
    -H "apikey: $LLAVE" -H "Authorization: Bearer $LLAVE" \
    -H "Content-Type: text/html" -H "x-upsert: true" --data-binary "@dist/index.html")
  [ "$code" = "200" ] || { echo "✗ la subida devolvió $code (¿están puestas las policies?)"; exit 1; }
fi

echo "→ Verificando en vivo…"
sleep 3
REMOTO=$(curl -s "$VIVO" -o /tmp/vh_vivo.html -w "%{size_download}")
if [ "$REMOTO" = "$LOCAL" ]; then
  echo "✓ EN VIVO — $REMOTO bytes, igual al build local"
else
  echo "⚠ en vivo hay $REMOTO bytes y el build local tiene $LOCAL (puede ser caché; reintenta en un minuto)"
fi
