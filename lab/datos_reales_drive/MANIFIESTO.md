# MANIFIESTO — Extracción de datos reales de Google Drive (VonHaucke Costeador)

**Fecha de extracción:** 2026-11-05 · **Carpeta Drive principal:** `140tw99N0F8pfW6sCnMxx4TE66iTmsdLL`
(y Shared Drive raíz `0AD5A9Iv6KsTGUk9PVA`), dueño `rodrigo.delcastillo@vonhaucke.mx`.

Extracción **determinista** (openpyxl `data_only`, base64→xlsx). **Regla dura cumplida:** sólo se
extrajeron valores literales de los archivos; no se inventó ningún precio, clave, consumo ni cantidad.
Donde un dato faltaba se dejó vacío. La elección de "precio vigente" usa precedencia por fecha real
(Orden de Compra más reciente > cata_mp), conservando siempre procedencia (fuente + fecha).

> Nota de continuidad: ya estaban commiteados en el repo (NO se reprocesan, NO se borran):
> TELCEL C-CO-320R (`lab/precios_telcel/v20261029/`), VENTO MASTER + C-CO-526R (`lab/precios_vento/`),
> y 6 Órdenes de Compra consolidadas (`lab/compras_reales/`). Esta pasada cubre **lo que faltaba de Drive**.

---

## 1. Inventario de archivos de Drive

### 1A. xlsx PROCESADOS en esta pasada (cada hoja volcada a CSV — ver §3 Cobertura)

| # | Archivo (título Drive) | fileId | Tamaño | Modif. | Hojas | Contenido | Procesado |
|---|---|---|---|---|---|---|---|
| 1 | Ordenes de Compra del 4 al 8 de Abril 2022.xlsx | `1AWfHKEAnhVLiwxyfnrmHq1qnp8zYx7CJ` | 52 KB | 2022-04-12 | 2 | Detalle O.C. (129 renglones) + Resumen | ✅ |
| 2 | Ordenes de Compra del 27 al 31 de Mayo 2024.xlsx | `1stMFg4v2iETirtVAJfUVjclw9XNieNRn` | 48 KB | 2024-06-04 | 2 | Detalle O.C. (83 renglones) + Resumen | ✅ |
| 3 | Ordenes de Compra del 1 al 26 de Julio 2024.xlsx | `1R9SHiTEfCgNymTq65JC087R1kSIfGDGk` | 46 KB | 2024-07-30 | 2 | **Detalle VACÍA**; sólo Resumen agregado (sin clave/costo unitario) | ⚠️ parcial |
| 4 | Costos de Materia Prima Ultima Compra al 10082026.xlsx | `1hhEWKr7TfHyuMUtuOcvGjkjHllj9yXl1` | 1.8 MB | 2026-08-19 | 3 | **Maestro MP fresco**: 16,547 renglones (art., desc., unidad, clave comercial, estatus, nivel, categoría, elemento, fecha y costo última compra) | ✅ |
| 5 | Ejemplo 01 - Modulo en Pedido 38247 - TATO63612AB001 REV20261007.xlsx | `1AquvyHzOZwqdURHNyzaZL2zADso3aRXM` | 2.3 MB | 2026-10-13 | 6 | Costeo real de producción: material solicitado + tiempos + **costo real de MP ($55,395.34)** | ✅ |
| 6 | ejercicio repisa (1) (3).xlsx | `1Qi5V0ov3bS_XcAJQLcGZBp7zxX8msi4s` | 2.0 MB | 2026-10-10 | 7 | Costeo estilo VENTO (Explo_MP BOM + cata_mp). Ejercicio "repisa flotante" | ✅ |
| 7 | C-CO-517R Exhibidor ENTCBCALP (1).xlsx | `1skBI1TBz-Fo-AZJc10IpYbW42QHZFJuc` | 2.0 MB | 2026-10-10 | 8 | Costeo estilo VENTO (Explo_MP BOM + cata_mp). Exhibidor ENTCBCALP | ✅ |
| 8 | TELSVH120 (2).xlsx | `1RUDdiXTABBYbvpTqevcwKtlrcdWmLvnD` | 235 KB | 2026-10-28 | 1 | Hoja de Manufactura (Vitrina Horizontal TELSVH120): BOM dimensional + consumos | ✅ |
| 9 | Escritorios Alba   Precios.xlsx (oct-2026) | `1tfa39IhDqDc0ylXrBxYbaXXUUBs7Illp` | 47 KB | 2026-10-10 | 3 | Lista de precios de producto terminado (783 productos; 6 con precio) | ✅ |
| 10 | Escritorios Alba   Precios.xlsx (ago-2026) | `1l8zR10pgg2Jg9k8EhQwXQPUb1WIhocyb` | 45 KB | 2026-08-20 | 3 | **Versión anterior** de #9 (contenido equivalente) | ✅ |
| 11 | CONTROL IMPORTACIONES REG-DGO-COM-009.xlsx | `1oYFhWVG5tL3VZTGgeGELG4c93O58akna` | 538 KB | 2026-11-04 | 5 | Control de stock/importaciones de sillería (STOCKS SILLERIA + logs 2020-2022) | ✅ |
| 12 | C-CO-526R Vento separacion materiales (1) 20 OCT.xlsx **(copia 1eTZbM)** | `1eTZbMreB5yf_nMn481U1fgGGNQs0RM1G` | 2.1 MB | 2026-11-05 | 7 | **2ª copia** del C-CO-526R; Explo_MP **DIFIERE** del commiteado (ver §4) | ✅ |
| 13 | MASTER VENTO  12 OCT.xlsx **(copia 130Uho)** | `130UhoSW06g5EZzuiQ_zX4cY_Tg9E6H5p` | 144 KB | 2026-11-05 | 1 | 2ª copia del MASTER VENTO; idéntica a la commiteada | ✅ |

### 1B. xlsx YA COMMITEADOS antes de esta pasada (no reprocesados)

| Archivo | fileId | Dónde está en el repo |
|---|---|---|
| C-CO-320R DATS TELCEL DIV-MATERIALES 20261002 (2).xlsx | `1GepTV2dXZEd2jWGb7dHKXQ-aVwYDk1ym` | `lab/precios_telcel/v20261029/` |
| MASTER VENTO 12 OCT.xlsx | `1GVDo4zSOhl7BkcYPzQ4qgabAcmlHNPIF` | `lab/precios_vento/` |
| C-CO-526R Vento separacion materiales 20 OCT.xlsx | `16HcbMYqi-7UQ2BreSizfxOYWJGfjwAKx` | `lab/precios_vento/` |

### 1C. NO procesados (listados con razón — nada desaparece en silencio)

- **Sillas Pendientes de entrada (ordenes de compra ... requisiciones sin proveedor).xlsx** `1tzaI8q5puXcWCH-agSdp2bhe44TE2lJh` (22 KB, 2023-03-16) — descargada pero devuelta *inline* por la tool; no reconstruida a disco en esta pasada. Es un tracker de compras de sillería 2023 (estatus de entrada/requisición), prioridad baja frente a precios frescos. **Pendiente** si se desea cobertura total.
- **vonhaucke carta porte fasterrama.xlsx** `1kghnvmZK7y3g7dkB7Zl3WBZhpm5U6Idk` (1.4 MB, 2026-04) — documento de **logística (carta porte)**, no costeo/precio. No procesado.
- **Resumen de Datos de Importación y Cantidades** `10UP1Gx5-O30Kic87YEtu6me70Ym0y5BqN7BYn8DFfVQ` (Google Sheet, ~1 KB) — prácticamente vacío. No procesado.
- **~20 costeos legacy "RC-COSP-NN-M" (Google Sheets nativos, 2023, dueño rafael.carranza)** — son costeos de producto antiguos (TIENDAS STEREN, ELEKTRA, KIOSCOS, etc.). **No procesados**: son hojas nativas Google de 2023, fuera del alcance de "precios frescos"; sus precios están superados por OCs 2025-2026 y por `CostosMP_10082026`. IDs:
  `1hMMhUMUoEDGzCqoqkvvWwtIMT_2zZdw0gVsKBecbqYo` (01-M STEREN), `1GeNSmnWN45bwDXlT-reAg7xyito36p7Wj3VRs3dtSC0` (02-M), `1_bByCkfwKFVBiP9rNieo1NhHFycTMJauMYj7mitlZ70` (03-M), `1Ruf1QjoJnVuYgDCDSB3RWe3no557_TmW9wPqfuvJ6mA` (04-M), `1W0CdYP85l0Qwu_JHQ4ZquQ-5he7S928OspljQM7R0Z0` (05-M), `1t_Vnu9Ph407p9utx5zjmbbmFCUpASZ-aoogJSWILoak` (06-M), `15t4xk7Mk6BSWJaWrtIBDdPXaHEpoxZ9mAFrb9_ZwZEU` (07-M cancelado), `1fy7KWjnY9a39JzbVoF6762VV4kCrxRQVjXj2jYh7lQA` (08-M), `1OKbXOSPVGID-IBWpQxxA6VUWh4LcCl1vhrRN4VaXv1g` (09-M), `1Vlcnk0c0Yus6FypgL4Aji02ciOLfu0XOaK_hAEj204A` (10-M), `12P-VwYGGoLxKxigQ8Q3jZ1LHx-ZhdXKyFkxNLHf3PD0` (12-M), `1DknRr1QIq6sy_0AFM6YeDw6cs89SRGnmxbi-nAfK_IM` (13-M), `1C_G5QukyfQW3VE9xP1gQHTKTaaG88U6xOw60oE5DOTk` (14-M), `1u1gHbgtrZdGBRreXFgP4I4ga5Hr-EUaesRp4US8w5go` (15-M), `1wJFjVeM9MbeX9wPGtXA0I6MpQviAwS1YAJVhPsCdcUA` (16-M), `1-edociCVWKTnde2FKM-oYi2SOBfJwfSwGxIZOQgOXd8` (17-M), `16W2-b35ER0ZuYggDoH9Nb3IKBgthdy0eBrQABEhciBM` (17-M plafon), `1IzTDcGF80ql8z9D0ee9zahTXjQv1tm8naWTBCmGWHP4` (18-M ELEKTRA), `1MUg6k9P_UM7CI3hVeaJlGAB1BPhLru2s3smZ6TK43ac` (19-M), `1c9QegVnBeZUsh6YlYknNLxLwEFu9X7BKXLBtr6dHNuU` (20-M RACK).
- **PDFs (no procesados, son PDF no xlsx):** hojas de manufactura / planos de producto: `TEVHSU`, `TEVTSU`, `TELSVH120.pdf`, `TELSMG`, `TVCAC`, `HAMAPA23`; ~40 catálogos NOM de producto terminado (Catalogo_Rio/Anteo/Mox/Alba/Luna/Feather/Eclipse/… — catálogos comerciales, no costos de MP); PDFs de O.C. individuales (`226080044`, `226060008`, `226080135`, …). Son material de referencia de producto, no costeos en hoja de cálculo.
- **Google Docs (no procesados):** ~18 "Sesión Planta/Dirección — Notas de Gemini", minutas `REG-DEX-DEX_Exportación`, cartas. Son notas de reunión, no costeo/precio.

---

## 2. Entregables generados (en `lab/datos_reales_drive/`)

- `precios_vigentes_master.csv` — maestro de precio real más reciente por artículo + procedencia.
- `materiales_master.csv` — diccionario de todas las claves/materiales con specs.
- `costeos_master.md` — BOM + totales de cada producto costeado.
- `mp_master_fresco/CostosMP_10082026__Hoja1.csv` — catálogo MP fresco (16,547 renglones).
- `ordenes_compra/` — detalle por O.C. + `ordenes_compra_consolidado_TODAS.csv` (9 O.C.).
- `costeos/<producto>/` — BOM y hojas útiles por costeo (con encabezados limpios).
- `raw_hojas/<archivo>/<hoja>.csv` — **volcado verbatim de CADA hoja de CADA archivo** (capa de auditoría).
- `coverage_hojas.csv` + tabla §3 — cobertura (archivo × hoja).
- `RESUMEN.md` — hallazgos y estadística.

---

## 4. Versiones / duplicados detectados

- **MASTER VENTO**: dos copias idénticas en tamaño (`1GVDo4z` commiteada; `130Uho` procesada aquí). Contenido equivalente (hoja `Tabla original`, 11 muebles).
- **C-CO-526R Vento**: dos copias con el **mismo nombre** pero **Explo_MP distinto**:
  - commiteada `16HcbMYq` (1.82 MB): Explo_MP = **$42,653.27** en 185 renglones.
  - copia `1eTZbM` (2.07 MB): Explo_MP = **$20,358.57** en 106 renglones con costo.
  Ambas modificadas 2026-11-05. Son despieces diferentes bajo el mismo código; se conservan ambas (la
  commiteada en `lab/precios_vento/`, el volcado verbatim de la copia en `raw_hojas/VENTO_C_CO_526R_dup_1eTZbM/`).
- **Escritorios Alba**: `1tfa39` (oct-2026, **más reciente**) y `1l8zR10` (ago-2026). Contenido de lista equivalente; se usa la de octubre como primaria.
- **cata_mp (catálogo MP de 16k renglones)**: aparece embebido e idéntico en VENTO/517R/repisa (snapshot ERP). Por política del usuario **no se guardan 10 copias**: se conserva el snapshot VENTO ya commiteado y el maestro fresco `CostosMP_10082026`. Las copias embebidas se listan en §3 con `volcada=no` y su razón.

---

## 3. TABLA DE COBERTURA (archivo × hoja) — ninguna hoja quedó sin revisar

| archivo | hoja | estado | filas×cols | volcada CSV | nota / motivo |
|---|---|---|---|---|---|
| Ordenes de Compra del 4 al 8 de Abril 2022.xlsx | `O.C. Detalle 4 al 8 de Abril ` | visible | 130x17 | si | ver raw_hojas/OC_abril2022/O_C_Detalle_4_al_8_de_Abril.csv |
| Ordenes de Compra del 4 al 8 de Abril 2022.xlsx | `Resumen` | visible | 113x12 | si | ver raw_hojas/OC_abril2022/Resumen.csv |
| Ordenes de Compra del 27 al 31 de Mayo 2024.xlsx | `Deatalle OC de 27 al 31 de Mayo` | visible | 84x19 | si | ver raw_hojas/OC_mayo2024/Deatalle_OC_de_27_al_31_de_Mayo.csv |
| Ordenes de Compra del 27 al 31 de Mayo 2024.xlsx | `Resumen` | visible | 37x12 | si | ver raw_hojas/OC_mayo2024/Resumen.csv |
| Ordenes de Compra del 1 al 26 de Julio 2024.xlsx | `Detalle OC del 1 al 26 Julio` | visible | 0x0 | si | VACIA |
| Ordenes de Compra del 1 al 26 de Julio 2024.xlsx | `Resumen` | visible | 69x12 | si | ver raw_hojas/OC_julio2024/Resumen.csv |
| Costos de Materia Prima Ultima Compra al 10082026.xlsx | `Hoja1` | visible | 16548x16 | si | ver raw_hojas/CostosMP_10082026/Hoja1.csv |
| Costos de Materia Prima Ultima Compra al 10082026.xlsx | `Hoja2` | visible | 0x0 | si | VACIA |
| Costos de Materia Prima Ultima Compra al 10082026.xlsx | `Hoja3` | visible | 0x0 | si | VACIA |
| Ejemplo 01 - Modulo en Pedido 38247 - TATO63612AB001 REV20261007.xlsx | `Pedido` | visible | 23x15 | si | ver raw_hojas/Modulo38247/Pedido.csv |
| Ejemplo 01 - Modulo en Pedido 38247 - TATO63612AB001 REV20261007.xlsx | `MaterialSolicitado` | visible | 117x27 | si | ver raw_hojas/Modulo38247/MaterialSolicitado.csv |
| Ejemplo 01 - Modulo en Pedido 38247 - TATO63612AB001 REV20261007.xlsx | `EntradaProd.para obtener tiempo` | visible | 38x24 | si | ver raw_hojas/Modulo38247/EntradaProd_para_obtener_tiempo.csv |
| Ejemplo 01 - Modulo en Pedido 38247 - TATO63612AB001 REV20261007.xlsx | `Fabricado Tiempo` | visible | 110x71 | si | ver raw_hojas/Modulo38247/Fabricado_Tiempo.csv |
| Ejemplo 01 - Modulo en Pedido 38247 - TATO63612AB001 REV20261007.xlsx | `PPyPTiempo` | visible | 37x26 | si | ver raw_hojas/Modulo38247/PPyPTiempo.csv |
| Ejemplo 01 - Modulo en Pedido 38247 - TATO63612AB001 REV20261007.xlsx | `VH Detalle Costo Real Materia P` | hidden | 45x11 | si | ver raw_hojas/Modulo38247/VH_Detalle_Costo_Real_Materia_P.csv |
| ejercicio repisa (1) (3).xlsx | `REG-DCC-IDP-032 (t_d_p)` | hidden | 225x200 | si | ver raw_hojas/ejercicio_repisa/REG_DCC_IDP_032_t_d_p.csv |
| ejercicio repisa (1) (3).xlsx | `REG-DCC-IDP-031 (T_d_C) ` | visible | 38x24 | si | ver raw_hojas/ejercicio_repisa/REG_DCC_IDP_031_T_d_C.csv |
| ejercicio repisa (1) (3).xlsx | ` (Explo_MP)` | visible | 156x27 | si | ver raw_hojas/ejercicio_repisa/Explo_MP.csv |
| ejercicio repisa (1) (3).xlsx | `(cata_mp)` | hidden | 16405x13 | no | catalogo MP 16k identico a snapshot VENTO committed; consolidado en precios/materiales; no se duplica (politica usuario) |
| ejercicio repisa (1) (3).xlsx | ` (cuanti_mp)` | hidden | 73x38 | si | ver raw_hojas/ejercicio_repisa/cuanti_mp.csv |
| ejercicio repisa (1) (3).xlsx | `(info_t_d_c)` | hidden | 199x199 | si | ver raw_hojas/ejercicio_repisa/info_t_d_c.csv |
| ejercicio repisa (1) (3).xlsx | `(cal_empa_emba)` | hidden | 34x28 | si | ver raw_hojas/ejercicio_repisa/cal_empa_emba.csv |
| C-CO-517R Exhibidor ENTCBCALP (1).xlsx | `REG-DCC-IDP-032 (t_d_p)` | hidden | 225x200 | si | ver raw_hojas/CCO517R_Exhibidor/REG_DCC_IDP_032_t_d_p.csv |
| C-CO-517R Exhibidor ENTCBCALP (1).xlsx | `REG-DCC-IDP-031 (T_d_C) ` | visible | 38x24 | si | ver raw_hojas/CCO517R_Exhibidor/REG_DCC_IDP_031_T_d_C.csv |
| C-CO-517R Exhibidor ENTCBCALP (1).xlsx | ` (Explo_MP)` | visible | 171x27 | si | ver raw_hojas/CCO517R_Exhibidor/Explo_MP.csv |
| C-CO-517R Exhibidor ENTCBCALP (1).xlsx | `Hoja1` | hidden | 3x11 | si | ver raw_hojas/CCO517R_Exhibidor/Hoja1.csv |
| C-CO-517R Exhibidor ENTCBCALP (1).xlsx | `(cata_mp)` | hidden | 16405x13 | no | catalogo MP 16k identico a snapshot VENTO committed; consolidado en precios/materiales; no se duplica (politica usuario) |
| C-CO-517R Exhibidor ENTCBCALP (1).xlsx | ` (cuanti_mp)` | hidden | 73x38 | si | ver raw_hojas/CCO517R_Exhibidor/cuanti_mp.csv |
| C-CO-517R Exhibidor ENTCBCALP (1).xlsx | `(info_t_d_c)` | hidden | 199x199 | si | ver raw_hojas/CCO517R_Exhibidor/info_t_d_c.csv |
| C-CO-517R Exhibidor ENTCBCALP (1).xlsx | `(cal_empa_emba)` | hidden | 34x28 | si | ver raw_hojas/CCO517R_Exhibidor/cal_empa_emba.csv |
| TELSVH120 (2).xlsx | `Hoja1` | visible | 111x22 | si | ver raw_hojas/TELSVH120/Hoja1.csv |
| Escritorios Alba   Precios.xlsx | `Hoja1` | visible | 784x4 | si | ver raw_hojas/EscritoriosAlba_oct2026/Hoja1.csv |
| Escritorios Alba   Precios.xlsx | `Hoja2` | visible | 0x0 | si | VACIA |
| Escritorios Alba   Precios.xlsx | `Hoja3` | visible | 0x0 | si | VACIA |
| Escritorios Alba   Precios.xlsx | `Hoja1` | visible | 784x4 | si | ver raw_hojas/EscritoriosAlba_ago2026/Hoja1.csv |
| Escritorios Alba   Precios.xlsx | `Hoja2` | visible | 0x0 | si | VACIA |
| Escritorios Alba   Precios.xlsx | `Hoja3` | visible | 0x0 | si | VACIA |
| CONTROL IMPORTACIONES REG-DGO-COM-009.xlsx | `STOCKS SILLERIA` | visible | 467x309 | si | ver raw_hojas/CONTROL_IMPORTACIONES/STOCKS_SILLERIA.csv |
| CONTROL IMPORTACIONES REG-DGO-COM-009.xlsx | `Hoja28` | visible | 1x2 | si | ver raw_hojas/CONTROL_IMPORTACIONES/Hoja28.csv |
| CONTROL IMPORTACIONES REG-DGO-COM-009.xlsx | `2022` | visible | 135x34 | si | ver raw_hojas/CONTROL_IMPORTACIONES/2022.csv |
| CONTROL IMPORTACIONES REG-DGO-COM-009.xlsx | `2021` | visible | 80x34 | si | ver raw_hojas/CONTROL_IMPORTACIONES/2021.csv |
| CONTROL IMPORTACIONES REG-DGO-COM-009.xlsx | `2020` | visible | 94x34 | si | ver raw_hojas/CONTROL_IMPORTACIONES/2020.csv |
| C-CO-526R Vento separacion materiales (1) 20 OCT.xlsx | `REG-DCC-IDP-032 (t_d_p)` | hidden | 225x200 | si | ver raw_hojas/VENTO_C_CO_526R_dup_1eTZbM/REG_DCC_IDP_032_t_d_p.csv |
| C-CO-526R Vento separacion materiales (1) 20 OCT.xlsx | `REG-DCC-IDP-031 (T_d_C) ` | visible | 37x24 | si | ver raw_hojas/VENTO_C_CO_526R_dup_1eTZbM/REG_DCC_IDP_031_T_d_C.csv |
| C-CO-526R Vento separacion materiales (1) 20 OCT.xlsx | ` (Explo_MP)` | visible | 216x27 | si | ver raw_hojas/VENTO_C_CO_526R_dup_1eTZbM/Explo_MP.csv |
| C-CO-526R Vento separacion materiales (1) 20 OCT.xlsx | `(cata_mp)` | hidden | 16405x13 | no | catalogo MP 16k identico a snapshot VENTO committed; consolidado en precios/materiales; no se duplica (politica usuario) |
| C-CO-526R Vento separacion materiales (1) 20 OCT.xlsx | ` (cuanti_mp)` | hidden | 73x38 | si | ver raw_hojas/VENTO_C_CO_526R_dup_1eTZbM/cuanti_mp.csv |
| C-CO-526R Vento separacion materiales (1) 20 OCT.xlsx | `(info_t_d_c)` | hidden | 199x199 | si | ver raw_hojas/VENTO_C_CO_526R_dup_1eTZbM/info_t_d_c.csv |
| C-CO-526R Vento separacion materiales (1) 20 OCT.xlsx | `(cal_empa_emba)` | hidden | 34x28 | si | ver raw_hojas/VENTO_C_CO_526R_dup_1eTZbM/cal_empa_emba.csv |
| MASTER VENTO  12 OCT.xlsx | `Tabla original` | visible | 16x21 | si | ver raw_hojas/MASTER_VENTO_dup_130Uho/Tabla_original.csv |

**Total: 50 hojas revisadas** (incluye ocultas/`hidden` y vacías). Las 3 filas con `volcada=no` son copias del catálogo MP de 16k renglones, idénticas al snapshot VENTO ya commiteado — consolidadas en `materiales_master.csv` y `precios_vigentes_master.csv`; no se duplican por política del usuario.

---

## ACTUALIZACIÓN — §1C RESUELTO en SEGUNDA PASADA (2026-11-05)

Todo lo listado arriba en §1C como "NO procesado" **ya fue procesado** en `segunda_pasada/`. Ver `segunda_pasada/MANIFIESTO_segunda_pasada.md`. Resumen:
- **20 costeos RC-COSP** (Google Sheets 2023) → `segunda_pasada/costeos_RC-COSP/` (todas las hojas a CSV).
- **Sillas Pendientes 2023** → `segunda_pasada/compras/Sillas_pendientes_2023.csv` (recuperada vía read_file_content).
- **carta porte** y **Resumen de Importación** → `segunda_pasada/compras/`.
- **PDFs**: 8 presupuestos de VENTA (→ `cotizaciones_venta_areas.csv`, `claves_producto_precio_venta.csv`; son precios de venta, NO costo MP), 6 Hojas de Manufactura con despiece (→ `pdf_texto/HDM/`), ~15 catálogos NOM de marketing (→ `pdf_texto/catalogos_NOM/`).
- **~24 Google Docs / minutas** → `segunda_pasada/docs_texto/` (notas de reunión; **reglas reales de merma/tiempos** en `reglas_merma_aprovechamiento_tiempos.md`).
- **Nada quedó imposible.** Los "OC PDF" resultaron ser presupuestos de venta, no órdenes de compra, por lo que no aportan costos de MP al `precios_vigentes_master.csv`.
