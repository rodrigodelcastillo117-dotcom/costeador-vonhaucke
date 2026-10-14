# Link de prueba (Preview de Vercel con carril RC) — 13-oct-2026

- URL vigente (14-oct, tras la auditoría): https://costeador-vonhaucke-dn7n7bzq6-rodrigos-eurotrip.vercel.app (dpl_AFTdHDyu17mrEWgvKWQk11smCvPr, commit 5f81921)
- URL anterior (13-oct): https://costeador-vonhaucke-nswsgzdfi-rodrigos-eurotrip.vercel.app (commit 6169dcd)
- Carril RC: el build de Preview con `CARRIL_RC=si` (variable de Vercel limitada a Preview + esta rama) usa
  `analizar-mueble-rc` y `costear-servidor-rc`. Producción (costeador-vonhaucke.vercel.app, c8dd2b3) no contiene esos
  nombres: verificado en el JS servido.
- La base de datos es la de producción: lo que se guarde desde el link queda en la biblioteca real.

## Corrida verificada (hoja de control librero 5×8, cuenta QA)
`librero_5x8/run.log`: analizar-mueble-rc → despiece → ERP → costear-servidor-rc 200 → guardado 201 (expediente 151) →
reabierto con el mismo BOM y el mismo costo ($1,226.48). Hoja de control 6/6 PASS. Transferencia a Cotizar bloqueada (correcto).

Estado del costo: **BLOQUEADO**. Las piezas de melamina 28 mm 5×8 (ERP AME28152) no tienen `formato` de hoja en
producción (`atributos.formato = null`, consultado en solo lectura), y el motor se niega a convertir m²↔hoja sin él (P0-02).
Lo corrige `supabase/migrations/PROPUESTA_vh146_formato_hojas_erp.sql` (solo `atributos`, ni precios ni estados);
**pendiente de autorización de Dirección**. Mismo resultado que la ronda 3 (lab/rescate/r3): no es regresión.

## Tras la auditoría externa (14-oct)
| Corrida | Resultado |
|---|---|
| `ATCUBS45ABS_postauditoria` | Ya no aparece el falso "falta la base" (P1-07). Descuadre pantalla/servidor $1,068.48 vs $1,089.73 → se encontraron 2 defectos. |
| `ATCUBS45ABS_v2` | Paridad al centavo ($1,307.29). La pantalla decía PRELIMINAR con una pieza sin material → defecto. |
| `librero_5x8_v2` | 6/6 PASS; sigue BLOQUEADO por formato ERP (vh146b sin aplicar). |
| `ATCUBS45ABS_v3` | Paridad al centavo y **BLOQUEADO — Sin material: Tapa registrable…**, igual que el servidor (`incompleto`). Guardado como "PRUEBA RC · …". |

## Smoke vivo post SEG-01b / OP9.5-04 (14-oct-2026, link `dpl_EwkGsCs61qwaLv7pLxKGVYivDuUr`, commit f56632a, Edge `costear-servidor-rc` de 6d1cd13)

Carpeta `librero_5x8_post_seg01b/`. Misma hoja de control (librero 5×8), cuenta QA, expediente 159 ("PRUEBA RC · …").

| Punto | Antes (`librero_5x8_post_vh146c_v2`) | Ahora |
|---|---|---|
| Hoja de control | 6/6 PASS | 6/6 PASS |
| Paridad cliente/servidor | $6,614.24 = $6,614.24 | $6,614.24 = $6,614.24 (y dificultad $7,362.69 = $7,362.69) |
| Estado del servidor | `incompleto`, **0 motivos** | `preliminar`, 5 motivos: 2 materiales propuestos sin confirmar (nombrados), 4 de 5 insumos sin precio certificado, 1 requiere Compras, costeo sin registro autoritativo (SEG-01b sin aplicar) |
| `costeoId` | — | `null` (tabla `costeos_servidor` no existe en producción: correcto, avisa) |
| Guardar / reabrir | mismo BOM y costo | mismo BOM y costo |
| Pasar a Cotizar | deshabilitado ("bloqueos de costeo") | igual (materiales sin confirmar: correcto) |

Observación abierta (no regresión, igual que antes): la pantalla dice "El servidor aún no validó este despiece." aunque el
servidor respondió en el flujo de precio. Pendiente de revisar en qué momento se llena `validacionSrv`.

## Smoke vivo con todo integrado (14-oct-2026)

| Corrida | Commit / link | Resultado |
|---|---|---|
| `librero_5x8_integrado_2649de8/` | 2649de8 · `dpl_8DNx4Y1HUYEc3AViZaKdTzuWeegZ` | **FAIL**. Paridad $6,614.24 al centavo y guardado (exp. 160) correctos, pero la biblioteca **ocultaba** el expediente recién guardado: regresión propia del filtro de pruebas (1ca3b3f). |
| `librero_5x8_integrado_bf096aa/` | bf096aa · `dpl_HPsG8T32RJd9kzswNm6sD7odpvY1` | **PASS**. Hoja de control 6/6; paridad $6,614.24; exp. 161 guardado y reabierto con el mismo BOM y el mismo costo. Corrección: en el carril RC las pruebas se ven por omisión. |
