# TELCEL_PARITY_GAP — C-CO-320R

**Base inicial:** `f822958a24d6ce601c9024608a656953e02a2200`  
**Fuente:** workbook real Von Haucke 2026-10-02, exportado a `lab/precios_telcel/3949cec4_C_CO_320R_DATS_TELCEL_DIV_MATER__explo_x_id.csv`.  
**Alcance:** cuatro renglones **METAL**. No se modificó Supabase, catálogo, precios productivos, Edge, Vercel ni motor.

## Fronteras exactas del BOM

| módulo | id | filas CSV | líneas con costo | suma reconstruida | target workbook | frontera |
|---|---|---:|---:|---:|---:|---|
| Vitrina Horizontal · METAL | id_01 | 22–30 | 9 | $4483.13 | $4483.13 | EXACT |
| Vitrina Torre · METAL | id_02 | 61–68 | 8 | $2966.15 | $2966.15 | EXACT |
| Vitrina Isla · METAL | id_03 | 106–116 | 11 | $3297.84 | $3297.84 | EXACT |
| Módulo de almacenamiento · METAL | id_04 | 154–170 | 8 | $3596.14 | $3596.14 | EXACT |

El golden no recibe esos subtotales como material de entrada: recibe sólo los renglones de consumo y precio, y `calcular()` debe producirlos.

## Hallazgo de calidad de datos

`COSTEO_TELCEL_C-CO-320R.md` resume 126 líneas con artículo válido, pero no es checksum completo del workbook. El CSV crudo tiene líneas económicas sin SKU que aquella reconstrucción omite:

| fila | descripción | precio | consumo | costo | gap |
|---:|---|---:|---:|---:|---|
| 154 | Lámina negra 3×8 cal.18 (LN1838) | $722.46 | 1 | $722.46 | SKU/UNIDAD ausentes |
| 161 | Cubierta MDF 12 mm + PVC termoformado Cristal White | $1,800.00 | 0.25 | $450.00 | SKU/UNIDAD/FECHA ausentes |
| 185 | Empaque jaula de madera básico | $2,119.66 | 0.7 | $1,483.76 | SKU/UNIDAD/FECHA ausentes |

Por eso $47,432.84 es el total de esa extracción parcial, no la autoridad global del proyecto.

## Catálogo vivo: brechas relevantes para los 4 METAL

| clave/material workbook | precio workbook | match vivo | precio vivo | certificable | estado |
|---|---:|---|---:|---|---|
| LN18310 | $571.54/hoja | `erp-ln18310` | $571.54 | sí | EXACT |
| LN18410 | $751.14/hoja | `erp-ln18410` | $776.52 | sí | PRICE_MISMATCH |
| LN14410 | $1,190.49/hoja | `erp-ln14410` | $1,211.953 | sí | PRICE_MISMATCH |
| PPH A529 blanco TELCEL | $171.01/kg | `erp-pph-a529` | $142.51419 | no | PRICE_MISMATCH + STALE |
| PPH A10 azul TELCEL | $249.58/kg | `erp-pph-a10` | $207.978876 | no | PRICE_MISMATCH + STALE |
| TMP534250 | $47.43/pza | `erp-tmp534250` | $47.43 | sí | EXACT |
| TMP10114250 | $189.75/pza | `erp-tmp1011425` | $189.75 | sí | EXACT |
| TMP1034250 | $94.87/pza | `erp-tmp1034250` | $94.87 | sí | EXACT |
| LN20310 negro | $428.65/hoja | — | — | — | MISSING_SKU |
| LN14310 negro | $816.48/hoja | — | — | — | MISSING_SKU |
| TC201 | $96.71/pza | `erp-tc201` | $96.60 | sí | PRICE_MISMATCH |
| LN20410 | $571.52/hoja | `erp-ln20410` | $583.117 | sí | PRICE_MISMATCH |
| ME258EX | $26.50/pza | `erp-me258ex` | $26.50 | no | EXACT_PRICE + STALE |
| PPH sin opción (fila 68) | $449.06/kg | múltiples PPH | — | — | AMBIGUOUS_MATCH |
| LN1848 | $585.51/hoja | `erp-ln1848` | $585.511 | no | EXACT_PRICE + STALE |
| TC181 | $132.50/pza | `erp-tc181` | $132.50 | sí | EXACT |
| LN4814ACE | $900.38/hoja | `erp-ln4814ace` | $900.376 | sí | EXACT_ROUNDING |
| LN1838 | $722.46/hoja | — | — | — | MISSING_SKU |
| LN2038 | $541.86/hoja | — | — | — | MISSING_SKU |
| BIBI | $13.66/pza | `erp-bibi` | $13.66 | sí | EXACT |
| Cubierta MDF/PVC Cristal White | $1,800 × 0.25 | — | — | — | MISSING_SKU + UNIT_MISSING |

**No confundir** LN20310/LN14310 de acero negro con LI20310/LI14310 inoxidable: sería un falso match de familia.

## Qué certifica este golden

- Entry point: `calcular()`, igual que `goldenIntelisis.test.js`.
- Hoja: fracción explícita mediante `hojas`.
- Kg/pieza/etc.: cantidad explícita del workbook.
- Filas sin SKU: identidad interna por fila de fixture; no se inventa SKU comercial.
- `modeloCosteo='intelisis'` y horas 0: se certifica **material**, no MO/GIF.

## Brechas abiertas

- **MO_INPUT_GAP:** no se ha demostrado todavía el origen estructurado de MO para TELCEL.
- **GIF_INPUT_GAP:** no derivar porcentajes por coincidencia casual; Vitrina Torre demuestra que el patrón no es uniforme.
- **HERRAJES:** fase separada; el workbook los separa de METAL.
- **CATÁLOGO PRODUCTIVO:** faltan SKUs exactos y varios precios TELCEL están obsoletos/no certificables.

## Siguiente paso

Si el golden dirigido queda verde, preparar una importación **propuesta** desde `*_cata_mp.csv` de SKUs faltantes, preservando precio, unidad, fecha, opción y fuente. Un precio histórico viejo no se vuelve certificable por importarlo: requiere revalidación de Compras.

## Evidencia CI

- SHA probado por el run citado: `3281f72657032e8de8c9106447a02d3db7cc6027`
- PR draft: #85 (NO MERGE)
- CI run: `40379796089`
- conclusión global del run: **CANCELLED** (el job E2E fue cancelado)
- job `verify`: **SUCCESS**
- dentro de `verify`, `src/motor/telcelCCO320R.golden.test.js`: **5/5 PASS**
- evidencia reportada por `verify`: suite **399 archivos / 3924 tests PASS** y build **PASS**
- el HEAD actual de la rama puede ser posterior a ese SHA; no presentar este run como certificación del HEAD actual sin otro run.

### Nota de auditoría sobre unidad ausente

En las filas donde la columna de unidad viene vacía pero la descripción dice explícitamente `HOJA`, el golden usa esa palabra para modelar la fracción como `hojas`. Esto no convierte la fila en dato productivo certificado: la brecha de unidad sigue abierta en este documento. El golden certifica la aritmética histórica del material, no la calidad del catálogo vivo.

Conclusión de esta fase: **el motor sí reproduce a centavos los cuatro subtotales de materiales METAL cuando recibe el BOM/consumos/precios reales del workbook**. El cuello de botella ya no es la aritmética: es obtener/normalizar BOM, unidades, SKUs y vigencia de precios de forma automática.
