# TELCEL_PARITY_GAP — C-CO-320R

**Base auditada:** `f822958a24d6ce601c9024608a656953e02a2200`  
**Fuente:** workbook real Von Haucke 2026-10-02, exportado a `lab/precios_telcel/3949cec4_C_CO_320R_DATS_TELCEL_DIV_MATER__explo_x_id.csv`.  
**Alcance de este cierre:** cuatro renglones **METAL**. No se modificó Supabase, catálogo, precios productivos, Edge, Vercel ni motor.

## Hallazgo principal

Los cuatro subtotales METAL se pueden reconstruir de forma determinista directamente desde `consumo_unitario × costo_última_compra` del BOM explotado:

| módulo | id | filas fuente | líneas con costo | suma reconstruida | target workbook | frontera |
|---|---|---:|---:|---:|---:|---|
| Vitrina Horizontal · METAL | id_01 | 4–15 | 0 | $0.00 | $0.00 | EXACT |
| Vitrina Torre · METAL | id_02 | 61–68 | 8 | $2966.15 | $2966.15 | EXACT |
| Vitrina Isla · METAL | id_03 | 106–116 | 11 | $3297.84 | $3297.84 | EXACT |
| Módulo de almacenamiento · METAL | id_04 | 154–170 | 8 | $3596.14 | $3596.14 | EXACT |

Esto permite probar el motor sin copiar el subtotal final: el golden recibe sólo precio + consumo por renglón y exige que `calcular()` produzca el subtotal.

## Corrección importante al resumen previo de 126 líneas

`COSTEO_TELCEL_C-CO-320R.md` es útil como reconstrucción de **126 renglones con artículo válido**, pero **NO debe tratarse como checksum completo de todo el workbook**.

El CSV crudo contiene al menos estas líneas económicas sin SKU, omitidas por aquella reconstrucción:

| fila CSV | descripción | precio | consumo | costo | gap |
|---:|---|---:|---:|---:|---|
| 154 | Lámina negra 3×8 cal.18 (LN1838) | $722.46 | 1 | $722.46 | SKU/UNIDAD ausentes |
| 161 | Cubierta MDF 12 mm + PVC termoformado Cristal White | $1,800.00 | 0.25 | $450.00 | SKU/UNIDAD/FECHA ausentes |
| 185 | Empaque jaula de madera básico | $2,119.66 | 0.7 | $1,483.76 | SKU/UNIDAD/FECHA ausentes |

Por eso `$47,432.84` es checksum de esa extracción parcial, no autoridad global para todos los renglones del proyecto.

## Catálogo vivo — brechas relevantes para METAL

Lectura de `catalogo_vigente` al 2026-10-26. El golden histórico usa el precio congelado del workbook; esta tabla responde otra pregunta: **¿puede el Costeador vivo reconstruir hoy el mismo mueble con catálogo actual?**

| clave workbook / material | precio workbook | match vivo | precio vivo | certificable | estado |
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

### Nota de seguridad de matching

No confundir `LN20310` / `LN14310` de **acero negro** con claves `LI20310` / `LI14310` de **inoxidable** que sí existen en catálogo. Eso sería un falso match de familia.

## Qué prueba el golden

`src/motor/telcelCCO320R.golden.test.js` usa el mismo entrypoint de `goldenIntelisis.test.js`: `calcular()`.

- Hoja: consume la fracción exacta mediante `hojas`, como el golden Intelisis.
- Kg/pieza/jgo/etc.: consume la cantidad explícita del workbook.
- Filas sin SKU: usan una **identidad interna de fixture por fila**, no se inventa una clave comercial.
- `modeloCosteo='intelisis'`, horas cero: este cierre certifica **material**, no MO/GIF.

## MO / GIF

No se declararán equivalentes por porcentaje sólo porque algunos renglones aparenten 10%/25%. Vitrina Torre rompe ese patrón (GIF $14.83). Para certificar MO/GIF necesitamos extraer horas/centros/tarifas del workbook o de otra fuente estructurada.

Estado actual:

- Material METAL: **CERRABLE por golden**
- MO: **OPEN · MO_INPUT_GAP**
- GIF: **OPEN · GIF_INPUT_GAP**
- HERRAJES: **OPEN · siguiente fase, con fronteras separadas**
- Catálogo productivo TELCEL: **OPEN · faltan SKUs y hay precios TELCEL obsoletos/no certificables**

## Próximo paso

1. Ejecutar el golden dirigido y capturar PASS/FAIL real.
2. Si material pasa, crear importación **propuesta** (no productiva todavía) de los SKUs faltantes desde `*_cata_mp.csv`, preservando precio, unidad, fecha, opción y fuente.
3. No publicar esos precios como certificables cuando estén viejos: Compras debe revalidarlos o aportar compra vigente.
