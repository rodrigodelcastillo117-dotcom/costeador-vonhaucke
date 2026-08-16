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

echo "→ Compilando…"
npm run build >/dev/null || { echo "✗ falló el build"; exit 1; }
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

echo "→ Publicando la app…"
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$OBJ/app/index.html" \
  -H "apikey: $LLAVE" -H "Authorization: Bearer $LLAVE" \
  -H "Content-Type: text/html" -H "x-upsert: true" --data-binary "@dist/index.html")
[ "$code" = "200" ] || { echo "✗ la subida devolvió $code (¿están puestas las policies?)"; exit 1; }

echo "→ Verificando en vivo…"
sleep 2
REMOTO=$(curl -s "$VIVO" -o /tmp/vh_vivo.html -w "%{size_download}")
if [ "$REMOTO" = "$LOCAL" ]; then
  echo "✓ EN VIVO — $REMOTO bytes, igual al build local"
else
  echo "⚠ en vivo hay $REMOTO bytes y el build local tiene $LOCAL (puede ser caché; reintenta en un minuto)"
fi
