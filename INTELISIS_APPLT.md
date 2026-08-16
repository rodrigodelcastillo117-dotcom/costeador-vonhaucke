# Intelisis — datos reales App LT (extraídos 2026-08-13)

Fuente: 15 reportes del "Cotizador de Precios" de Intelisis (fecha cotización 12/08/2026), enviados por Rodrigo. Extracción determinista + 3 agentes con verificación aritmética. Todos los reportes cuadran MP→MO→GIF→Fabricación→Costo→Precio dentro de ±0.05 (redondeo). Datos crudos en `scratchpad/intelisis/parsed/*.json`.

## 1. LA FÓRMULA REAL DE VON HAUCKE (cascada Intelisis)
```
Costo MP (madera+metal+herraje+acrílico+sillería+otros)
  + Mano de Obra   = Σ (horas_centro × costoHora_MO_centro)
  + Gastos Indir.  = Σ (horas_centro × costoHora_GIF_centro)   ← ¡GIF por HORA, no % de MP!
  = COSTO DE FABRICACIÓN
  × (1 + 0.30)   [Factor Gastos Operación = 30]   = COSTO TOTAL
  × (1 + 0.20)   [Factor Utilidad = 20]           = PRECIO
  + Precio × 2   [Factor Precio Lista = 200 → "Incremento por Descuento"]
  = PRECIO LISTA  ≈ Precio × 3  (luego redondean al alza a valor comercial)
```
Implica: **PRECIO LISTA = Precio × 3**. El margen de descuento del vendedor va desde ahí (hasta ~66%).

### Costo por hora por centro (de los reportes, MO vs GIF)
| Centro | MO $/h | GIF $/h |
|---|---|---|
| Madera | 54.55 | 190.82 |
| Acabados | 56.34 | 193.59 |
| Pintura | 394.35 | 1796.61 |
| Otros | 61.98 | 234.39 |
| Metal | (aparece sin horas en estas piezas) | — |

## 2. BENCHMARKS DE PRODUCTO (precio de lista real a reproducir)
| Clave | Descripción | Dims mm | Costo MP | MO | Precio | **PRECIO LISTA** |
|---|---|---|---|---|---|---|
| ATCUBS44ABS | Cubierta sencilla melamina ABS | 1200×600×28 | 342.38 | 65.80 | 1006.12 | **3,019** |
| ATCUBS45ABS | Cubierta sencilla | 1500×600×28 | 608.70 | 71.44 | 1461.16 | **4,384** |
| ATCUBS46ABS | Cubierta sencilla (⚠ sin MO Madera) | 1800×600 | 618.29 | 20.39 | 1117.92 | **3,358** |
| ATCUBD44ABS | Cubierta doble | 1200×1200 | 640.24 | 117.52 | 1844.04 | **5,533** |
| ATCUBD45ABS | Cubierta doble | 1500×1200 | 1163.28 | 121.80 | 2690.00 | **8,074** |
| ATCUBD46ABS | Cubierta doble | 1800×1200×28 | 1172.88 | 108.74 | 2613.33 | **7,844** |
| ATFAL12ABS | Faldón/conducto ABS | 800×379×177 | 284.28 | 28.43 | 648.01 | **1,945** |
| ATFAL150ABS | Faldón/conducto ABS | 900×379×177 | 322.92 | 36.82 | 767.39 | **2,303** |
| ATPU2M | Pata universal | 600×720 | 275.83 | 97.94 | 1159.64 | **3,483** |
| ATPU3M | Pata universal | 900×720 | 292.42 | 117.66 | 1335.10 | **4,006** |
| ATPU75M | Pata universal | 750×720 | 282.54 | 105.39 | 1227.06 | **3,682** |
| ATOM3 | Ménsula/estructura metálica | 850×100×17 | 42.97 | 12.28 | 157.97 | **478** |
| ATOM4 | Ménsula/estructura metálica | 1150×100×17 | 68.35 | 14.41 | 212.75 | **639** |
| ATBIOCRT5 | Biombo cristal templado 6mm | 1400×400×32 | 801.15 | 19.17 | 1382.44 | **4,148** |
| ATACM | Acometida | 220×649×75 | 83.73 | 41.92 | 444.77 | **1,335** |

Un escritorio App LT = cubierta + 2 patas + faldón/acometida + estructura. Ej. cubierta sencilla 1.20 (ATCUBS44 $3,019) + patas… estos son los sub-ensambles que se suman.

## 3. MATERIA PRIMA REAL (último costo Intelisis) → mapeo a insumos.js
| Clave Intelisis | Material | Real | Unidad | id app | Precio app hoy | Δ |
|---|---|---|---|---|---|---|
| MVLMAG01280500 | Aglomerado melamina 2 caras 4×8 **16mm** | **612.00** | hoja | `melamina-16` | 650 | −6% |
| MVLMAG01280800 | Aglomerado melamina 2 caras 4×8 **28mm** | **1,026.90** | hoja | `melamina-28` | 1700 | **app +66% ALTO** |
| MVLPPC00491505 | Perfil canto ABS 22mm | **13.24** | m | `tapacanto-3mm` | 15 | −12% |
| MVLPPC00501505 | Perfil canto ABS 32mm | **15.99** | m | (canto 32 ABS) | — | nuevo |
| MVLMCC06060000 | Chapacinta PVC 32mm | **4.88** | m | `tapacanto` | 4 | +22% |
| MVLSLA05260502 | Lámina negra 3×10 **cal 20** | **434.78** | hoja | `lamina-20` | 750 | **app +72% ALTO** |
| MVLSLA05260402 | Lámina negra 3×10 **cal 18** | **571.54** | hoja | `lamina-18` | 950 | **app +66% ALTO** |
| MVLSLA05260202 | Lámina negra 3×10 **cal 14** | **816.48** | hoja | `lamina-14` | 1750 | **app +114% ALTO** |
| MLESLA05261100 | Lámina negra 3×10 **cal 10** | **2,270.17** | hoja | `lamina-10` | 3100 | +37% |
| MVLSTU03310401 | Tubular rect. 1½"×3" cal 18 | **383.28** | pieza | `ptr` (1×2 cal16) | 58/m | perfil distinto |
| MVLQPP00000000 | Pintura en polvo "PPH" | **170.47** | kg | `pintura-electrostatica` | 100 (m²) | unidad distinta |
| MDCRCR01030102 | Cristal templado 6mm 1400×390 | **567.50** | pieza | `cristal-templado-6` | 800/m² | ver área |
| MLEXSO310000V9 | Soporte mampara ROAD | 116.42 | pieza | (nuevo) | — | — |
| MTLECI00B20035 | Cinturón plástico 400×4.8 | 1.87 | pieza | (nuevo) | — | — |

⚠️ **OJO 1 — formato de lámina:** Intelisis compra lámina **3×10 pies** (≈0.914×3.048 m). La app usa formato 1.22×2.44 m con kg/hoja. Al cargar precio real hay que igualar el formato o los kg por hoja.
⚠️ **OJO 2:** los precios semilla de la app para melamina 28 y láminas están **60–114% ALTOS** vs Intelisis. Esto compensaba (mal) la sub-valuación del modelo fraccional. Con precios reales hay que re-calibrar de nuevo.

Herrajes reales (tornillos/pijas/rondanas/tuercas/niveladores): $0.18–$55.80/pieza (detalle en JSON).
