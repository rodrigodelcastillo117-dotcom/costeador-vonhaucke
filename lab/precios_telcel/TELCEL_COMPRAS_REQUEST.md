# TELCEL_COMPRAS_REQUEST — C-CO-320R

**Rama:** `claude/costing-app-architecture-psf02g`  
**Base:** HEAD `b4bafcf1a446bd329d5b0ad18267607a5fcd758e`  
**Fuente BOM:** `lab/precios_telcel/3949cec4_C_CO_320R_DATS_TELCEL_DIV_MATER__explo_x_id.csv`  
**Fuente de clasificación:** `lab/precios_telcel/TELCEL_LOAD_PLAN.md`

## Objetivo

Solicitar a Compras únicamente los datos faltantes de las **9 identidades `NECESITA_HUMANO`**.  
No se propone ningún SKU, opción, unidad ni precio por semejanza.

Los números de renglón indicados abajo son **renglones físicos 1-based del CSV `explo_x_id`**.

## Solicitud a Compras

| # | Artículo / nombre tal cual en BOM | Opción BOM | Descripción exacta del BOM | Unidad requerida por BOM | Consumo | Módulo / renglón | Dato que falta |
|---:|---|---|---|---|---:|---|---|
| 1 | `MVLQPP00000000` | falta confirmar con Compras | `PINTURA EN POLVO     - ""PPH""` | Kg | 1.127 | Vitrina Torre · METAL · renglón 114 | **Opción.** El artículo aparece en el BOM sin opción y esa identidad exacta no existe en `cata_mp`. Falta confirmar con Compras qué opción corresponde. |
| 2 | `MPMTLA01030601` | — | `LAMINA NEGRA HOJA 4' X 8' CALIBRE 14 ACERO 1008  --  LN4814ACE` | **falta confirmar con Compras** | 0.02 | Vitrina Isla · METAL · renglón 155 | **SKU real.** El Artículo del BOM no aparece como identidad exacta cargable en `cata_mp`. La unidad también viene vacía en el BOM y falta confirmar con Compras. |
| 3 | `LN1838` | — | `LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - ""LN1838""` | **falta confirmar con Compras** | 0.5 | Vitrina Isla · METAL · renglón 156 | **SKU real.** `LN1838` no aparece como identidad exacta cargable en `cata_mp`. La unidad viene vacía en el BOM y falta confirmar con Compras. |
| 4 | `LN2038` | — | `LAMINA NEGRA HOJA 3 X 8 CALIBRE 20 ACERO 1008 - ""LN2038""` | **falta confirmar con Compras** | 0.25 | Vitrina Isla · METAL · renglón 158 | **SKU real.** `LN2038` no aparece como identidad exacta cargable en `cata_mp`. La unidad viene vacía en el BOM y falta confirmar con Compras. |
| 5 | `MVLEPL0408C8A6` | — | `PLACA DE ALUMINIO DE 35 X 20 mm CALIBRE 24 PARA IDENTIFICACION EN ALUMINIO CON 2 BARRENOS DE Ø1/8. SERIGRAFIA COLOR GRIS OXFORD CON LEYENDA PEDIDO  207200554619 Y LOGOTIPO VONHAUCKE - "PLASEVH"` | pieza | 1 | Vitrina Isla · HERRAJES · renglón 190 | **Precio solamente.** La identidad exacta existe en `cata_mp` y la unidad es pieza, pero no tiene precio usable. **No falta SKU ni opción; sólo falta precio.** |
| 6 | `BUJES` | — | `BUJE DE ALUMINIO 3/4"` | **falta confirmar con Compras** | 6 | Módulo de Almacenamiento · HERRAJES · renglón 225 | **SKU real.** `BUJES` no aparece como identidad exacta cargable en `cata_mp`. La unidad viene vacía en el BOM y falta confirmar con Compras. |
| 7 | `CILINCHAPITAS` | — | `CILINDRO DE CHAPITAS NUCLEO INTERCAMBIABLE PLW SYMO 210.40.600.` | **falta confirmar con Compras** | 3 | Módulo de Almacenamiento · HERRAJES · renglón 229 | **SKU real.** `CILINCHAPITAS` no aparece como identidad exacta cargable en `cata_mp`. La unidad viene vacía en el BOM y falta confirmar con Compras. |
| 8 | `CERRPALETA` | — | `CERRADURA DE PALETA FIJACIÓN TUERCA 90° / 235.88.600.` | **falta confirmar con Compras** | 3 | Módulo de Almacenamiento · HERRAJES · renglón 230 | **SKU real.** `CERRPALETA` no aparece como identidad exacta cargable en `cata_mp`. La unidad viene vacía en el BOM y falta confirmar con Compras. |
| 9 | `JALEMBUTIR` | — | `JALADERA DE EMBUTIR CROMO SATIN 96 MM 342 ASHICO` | **falta confirmar con Compras** | 4 | Módulo de Almacenamiento · HERRAJES · renglón 231 | **SKU real.** `JALEMBUTIR` no aparece como identidad exacta cargable en `cata_mp`. La unidad viene vacía en el BOM y falta confirmar con Compras. |

## Resumen de lo que Compras debe devolver

- **1 opción por confirmar:** `MVLQPP00000000` usado en Vitrina Torre.
- **1 precio por confirmar:** `MVLEPL0408C8A6`. La identidad y unidad ya están resueltas; **sólo falta precio**.
- **7 SKU reales por confirmar:** `MPMTLA01030601`, `LN1838`, `LN2038`, `BUJES`, `CILINCHAPITAS`, `CERRPALETA`, `JALEMBUTIR`.
- En esos 7 casos, cuando la unidad está vacía en el BOM, Compras debe confirmar también la unidad comercial correcta. No se presupone `pieza`, `Hoja`, `Kg` ni ninguna otra.

## Nota de integridad

Existe además una línea METAL del **Módulo de Almacenamiento** cuya descripción dice `LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - ""LN1838""`, pero su campo **Artículo está vacío** en el BOM. No se vincula automáticamente al `LN1838` anterior: esa relación también **falta confirmar con Compras**.

Este documento no modifica DB, CSV, catálogo ni motor y no introduce equivalencias por descripción.
