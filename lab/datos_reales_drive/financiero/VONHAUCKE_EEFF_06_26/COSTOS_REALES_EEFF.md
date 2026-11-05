# COSTOS REALES — VON HAUCKE EEFF 06 26.xlsx

Fuente: `VON HAUCKE EEFF 06 26.xlsx` (Google Drive id `1xWCXKjwEMTbaHycIZQltshYvSj5HReXZ`).
Razón social: APARATOS ELECTROMECANICOS VON HAUCKE, S.A. de C.V. — RFC AEH841221234.

**Corrección del usuario aplicada:** este archivo NO es "solo financiero". **Trae el COSTO REAL** de la
operación (costo de ventas, materia prima, mano de obra, gastos indirectos de fabricación, costo por línea
de producto). Se volcaron las 17 hojas (ver `financiero/VONHAUCKE_EEFF_06_26/*.csv`) y se extrajo **cada
número de costo tal cual aparece**, con procedencia hoja + cuenta contable + columna. El detalle literal
está en `costos_reales_eeff.csv` (343 renglones). Regla dura respetada: todos los valores son literales del
archivo; los pocos porcentajes "calculado" se marcan como tales y se derivan de celdas citadas.

> **Nivel del dato:** el costo real del EEFF está a nivel **empresa** y a nivel **línea de producto
> (MUEBLES / SILLAS)**, NO por artículo/clave. Por eso NO alimenta `precios_vigentes_master.csv` (que es
> costo de MP por clave): no existen en el EEFF costos por artículo que integrar sin inventarlos. Sirve como
> **benchmark de costo real** contra los costeos por módulo. Se mantiene separado costo real vs precio de venta.

---

## 1. Estructura de costo real — Ene a Jun 2026 (hoja `ER 06 26`, Estado de Resultados)

Valores literales, columna `Total` (col 18). El % es el que **ya trae el propio archivo** (col 19).

| Concepto | Cuenta | Valor (MXN) | % s/ventas (archivo) |
|---|---|---:|---:|
| TOTAL INGRESOS | — | 74,767,782.03 | 1.00 |
| — Ventas nacionales MUEBLES | 4100-01-01 | 54,111,400.08 | 0.7237 |
| — Ventas nacionales SILLAS | 4100-01-02 | 6,999,894.38 | 0.0936 |
| — Ventas extranjeras | 4100-02-00 | 564,703.96 | 0.0076 |
| — Servicios | 4100-05-00 | 11,477,086.56 | 0.1535 |
| — Arrendamiento | 4400-00-00 | 1,614,697.05 | 0.0216 |
| **COSTO DE VENTAS (total)** | — | **52,919,977.82** | **0.7078** |
| — Materia prima directa | 5100-00-00 | 33,730,560.93 | 0.4511 |
| — Gastos de producción (MOD+GIF) | 5110-00-00 | 16,977,963.20 | 0.2271 |
| — Gastos de distribución | 5450-00-00 | 2,211,453.69 | 0.0296 |
| **UTILIDAD BRUTA** | — | **21,847,804.21** | **0.2922** |

Desglose mensual de cada renglón (Enero…Junio) en `costos_reales_eeff.csv`.
Ejemplo materia prima directa 5100: Ene 3,506,075.59 · Feb 3,155,416.08 · Mar 12,850,338.74 ·
Abr 1,818,605.52 · May 5,067,856.98 · Jun 7,332,268.02.

## 2. Costo real por LÍNEA DE PRODUCTO — balanza acumulada al 30-jun-2026 (hoja `06 26`, saldo_final)

| Cuenta | Concepto | Saldo final (MXN) |
|---|---|---:|
| 5100-00-00 | COSTO DE VENTAS (= materia prima directa) | 33,730,560.95 |
| 5100-01-00 | **COSTO MUEBLES** | 29,794,243.22 |
| 5100-02-00 | **COSTO SILLAS** | 3,936,317.73 |

Benchmark de costo de MP por línea (calculado = cuenta 5100-0x ÷ ventas línea de la hoja ER 06 26):
- Muebles: 29,794,243.22 / 54,111,400.08 = **55.1 % de la venta** es materia prima.
- Sillas: 3,936,317.73 / 6,999,894.38 = **56.2 % de la venta** es materia prima.
(Ratios derivados de celdas citadas; el EEFF no imprime este cociente.)

## 3. Gastos de producción (MOD + GIF) — balanza 30-jun-2026 (hoja `06 26`)

| Cuenta | Concepto | Saldo final (MXN) |
|---|---|---:|
| 5110-00-00 | GASTOS DE PRODUCCION | 16,977,963.16 |
| 5110-01-00 | Mano de obra directa (subtotal) | 7,648,647.76 |
| 5110-01-06 | — Costo mano de obra directa | 6,107,535.96 |
| 5110-01-01..04 | — IMSS/AFORE/INFONAVIT/ISN M.O.D. | 624,085.76 / 422,593.46 / 269,914.38 / 224,518.21 |
| 5110-02-00 | Costos indirectos de fabricación (subtotal) | 24,303,315.45 |
| 5110-02-07 | — Mano de obra indirecta | 8,185,992.47 |
| 5110-02-08 | — Materia prima indirecta | 1,907,213.08 |
| 5110-02-22 | — Arrendamiento inmuebles | 2,766,312.51 |
| 5110-02-29 | — Serv. prof. personas morales | 3,982,765.69 |

(Subcuentas 5110-02-xx completas en `costos_reales_eeff.csv` y en `06_26.csv`.)
Nota: 5110-01 + 5110-02 (31.95 M) ≠ 5110-00 (16.98 M) porque el EEFF aplica cuentas de absorción/variación
de costo (5400 GIF aplicados, 5110-xx VARIACION COSTO, hoy en 0). Se conservan los saldos tal cual.

## 4. Inventario de materia prima — balanza 30-jun-2026 (hoja `06 26`)

| Cuenta | Concepto | Saldo final (MXN) |
|---|---|---:|
| 1106-00-00 | INVENTARIO MATERIA PRIMA | 28,428,009.21 |
| 1106-01-00 | — Materia prima | 14,982,813.56 |
| 1106-02-00 | — Materia prima indirecta | -724,604.90 |
| 1106-05-00 | — Maquila | 7,307,832.02 |

## 5. Estructura de costo anual (12 meses) — hojas `ER` y `ER SF`

Hoja `ER` ("doce meses que terminó el 31 de diciembre"):
- Total ingresos 128,382,025.39; Total costo de ventas **117,548,178.58 (91.56 %)**; Utilidad bruta 10,833,846.81.
- Materia prima directa 66,268,016.11 · Mano de obra directa 10,855,078.91 · Costos ind. de fabricación
  59,157,265.21 · Gastos ind. de fabricación -22,726,856.93 · Depreciación 1,725,522.21 · Maquila 154,576.62.

Hoja `ER SF` (12 meses al 31-dic-2023, con % por renglón): misma MP directa 66,268,016.11; costos ind. de
fabricación 59,123,575.96; total costo de ventas 117,514,489.33 (91.54 %). Varios renglones de gastos traen
`#VALUE!`/`#REF!` en el archivo (fórmulas rotas); se dejan como están y no se usan.

## 6. Gastos de operación — hoja `GASTOS 2026` (integración Ene-Jun 2026)

No es costo de producción sino gasto de operación, pero son cifras reales; se vuelcan completas en
`GASTOS_2026.csv`. Totales: Gastos de administración 13,323,701.22 · Gastos de venta 21,269,219.84 ·
Gastos de distribución 3,408,181.36. (Comisiones por ventas 6000-02-16 = 3,345,125.30; arrendamientos
persona física venta 6000-02-07 = 7,520,338.08.)

---

### Qué costo real NUEVO aportó el EEFF (resumen)
1. **Costo de ventas real H1-2026 = 52.9 MDP (70.8 % de la venta)**, con split MP 45.1 % / producción 22.7 % / distribución 3.0 %.
2. **Costo por línea de producto**: MUEBLES 29.79 MDP y SILLAS 3.94 MDP (cuenta 5100), equivalentes a ~55-56 % de la venta de cada línea en materia prima.
3. Desglose real de **mano de obra directa (7.65 MDP)** y **gastos indirectos de fabricación (24.3 MDP)** por subcuenta.
4. **Inventario de materia prima 28.4 MDP** al 30-jun-2026.
5. Estructura **anual** de costo de ventas (91.5 % de la venta) en hojas ER / ER SF.

Ninguno de estos es un costo por artículo/clave, por lo que `precios_vigentes_master.csv` no se altera con
el EEFF. Se integran aquí como fuente de costeo de nivel empresa/línea con procedencia completa.
