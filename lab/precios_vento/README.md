# Datos reales VENTO — costeo + materias primas (subidos 2026-11-05)

Extracción determinista (openpyxl `data_only`) de los 2 workbooks reales de VonHaucke.
**Verdad de Compras/Dirección, no una corrida del motor.**

## Archivos fuente
- `MASTER_VENTO 12 OCT.xlsx` — 1 hoja (`Tabla original`): **costeo por partida + precios por agencia**.
- `C-CO-526R Vento separacion materiales (1) 20 OCT.xlsx` — 7 hojas (misma estructura que el workbook TELCEL).

## MASTER_VENTO (`MASTER_VENTO__Tabla_original.csv`) — 11 muebles
Columnas: Partida · Descripción · Cant · **Costo materia prima · mano obra · indirecto · Costo de fabricación** · luego precios P.U./Subtotal por agencia (Sula Mob · VONHAUCKE 2024 · VONHAUCKE 2026 · PROPUESTA 08 Oct) · markup%.

| Rubro | Total |
|---|---|
| **Costo de materia prima (suma)** | **$56,674.06** |
| Precio Sula Mob | $79,120.59 |
| Precio VONHAUCKE 2024 | $90,465.00 |
| Precio VONHAUCKE 2026 | $101,557.98 |
| Precio PROPUESTA 08 Oct | $58,659.63 / $78,830.44 |

Muebles: ESCRIT. MB-01, EXHIB. PANEL RANURADO MB-04/05, VITRINA MOD. REFAC. MB-06/07, MESA TUB.
REGISTRO MB-09, MUEBLE TUB. IMPRESORA MB-10, MUEBLE DOBLE VISTA MB-02, EXHIB. RODAJAS CHICO/GRANDE
MB-07/08, ARCHIVERO 2 cajones, ENTREPAÑOS, EXHIBIDOR DE ACEITES.

## C-CO-526R (7 hojas, todas volcadas a CSV)
| Hoja | CSV | Qué es |
|---|---|---|
| `REG-DCC-IDP-032 (t_d_p)` | C-CO-526R__REG_DCC_IDP_032_t_d_p.csv | Tabla de precios (dashboard grande 226×200). |
| `REG-DCC-IDP-031 (T_d_C)` | C-CO-526R__REG_DCC_IDP_031_T_d_C.csv | Tabla de comparación. |
| ` (Explo_MP)` | C-CO-526R__Explo_MP.csv | **Costeo real: explosión BOM → $42,653.27 material** (185 renglones, `costo_última_compra × consumo`). |
| `(cata_mp)` | C-CO-526R__cata_mp.csv + **cata_mp_vento_precios_reales.csv** | **Catálogo MP real: 16,403 renglones, 10,980 con costo.** |
| ` (cuanti_mp)` | C-CO-526R__cuanti_mp.csv | Cuantificación de MP. |
| `(info_t_d_c)` | C-CO-526R__info_t_d_c.csv | Metadatos del libro. |
| `(cal_empa_emba)` | C-CO-526R__cal_empa_emba.csv | Embalaje por m³. |

## Frescura de precios (cata_mp VENTO) — MEJOR que TELCEL
Fechas de última compra entre 2009 y **2026**: 2026: 613 · 2025: 869 · 2024: 371 · 2023: 499 · 2022: 520 ·
2021: 497 · 2020: 533 · 2019: 707 · 2018: 677 · 2017: 666 · 2016: 659 · 2015: 950 · 2014: 955 ·
2013: 1,191 · 2012: 564 · 2011: 303 · 2010: 375 · 2009: 31.
→ **~1,482 renglones son de 2025-2026 (frescos).** Este es el mejor snapshot de precios reales que tenemos
(el de TELCEL se cortaba en 2024). Mediana $274.51.

## Pendiente (requiere autorización — toca prod)
Consolidar `cata_mp` VENTO (el más fresco) como fuente de precios reales y cargarlo al catálogo del motor
con política de frescura. Mapeo clave MVL↔insumo + decisión qué entra. NO hecho aquí.
