# Manifiesto único de comparación — VENTO C-CO-526R y TELCEL C-CO-320R
**Fecha de corrida:** 2026-11-06 · Un solo alcance, reproducible. Responde a la crítica VH-A04 de ChatGPT (no mezclar alcances ni presentar un ±2% general).

## Alcance declarado (idéntico en ambos lados)
- **Nivel:** MATERIA PRIMA (MP) únicamente. NO incluye MO ni GIF ni fabricación total (esos van aparte, abajo, sólo informativos).
- **BOM:** el workbook real de cada proyecto (explosión de MP). Mismo despiece y **mismos consumos** en ambos lados → la diferencia es **sólo de precio**, no de cálculo/merma.
- **Precios (motor):** `catalogo_vigente` EN VIVO al 2026-11-06, tras cargar los precios del workbook (20 conflictos de misma fecha) por instrucción de Dirección.
- **Precios (real):** `costo_última_compra` del workbook de cada proyecto.
- **Motor:** `src/motor/calculo.js`, MOTOR_VERSION 2026-10-14b (⚠️ ver VH-A03: la etiqueta no distingue cambios de fórmula — pendiente versionado por hash).
- **Arnés:** `lab/scripts_lab/recost_veredicto.mjs` (determinista, mismo consumo ambos lados). 0 huecos.

## Resultado — MP, mismo BOM
| Proyecto | Real (workbook) | Motor (catálogo ERP en vivo) | Δ |
|---|---:|---:|---:|
| **VENTO C-CO-526R** (107 renglones) | $20,435.98 | $20,854.31 | **+2.0%** |
| **TELCEL C-CO-320R** (89 renglones) | $30,210.35 | $30,463.92 | **+0.8%** |

### Descomposición del Δ (de quién es la diferencia)
Como el consumo es idéntico, el Δ es 100% de precio. Por fecha de última compra:
- **VENTO +$418:** 34 renglones donde NUESTRO precio es más nuevo (+$229, el costeo real quedó viejo) + conflictos de misma fecha resueltos con tus precios.
- **TELCEL +$254:** 35 renglones donde nuestro precio es más nuevo (+$416) + cola de items descontinuados 2018-2020.

## Fabricación completa (informativo, NO comparado — no hay real equivalente limpio)
Sólo como referencia del motor (material + MO Alba + indirectos); el workbook es explosión de MP y no trae un total de fabricación acreditado:
- VENTO: material $19,226 (arnés estricto por SKU) + MO $2,750 + GIF $8,359 = **$30,335**.
- TELCEL: material $29,078 + MO $3,380 + GIF $10,393 = **$42,851**.
(El material estricto difiere del de la tabla porque el arnés por-SKU no cuenta pintura/aglomerado por opción; en el motor real se costean por familia.)

## Honestidad (lo que ESTE manifiesto NO prueba)
- NO es una certificación general del motor: es UN alcance (MP), DOS productos, UNA corrida.
- NO prueba que VONI reconstruya correctamente un mueble especial **desde un plano**: eso es otra prueba (ver el golden de plano P-01 y pendiente el E2E adversarial completo).
- La paridad "±2%" sólo aplica a MP con este BOM y estos precios. No extrapolar.

## Reproducción
`node lab/scripts_lab/recost_veredicto.mjs` (con el dump de catálogo vigente del día). Un solo comando, mismo consumo ambos lados.
