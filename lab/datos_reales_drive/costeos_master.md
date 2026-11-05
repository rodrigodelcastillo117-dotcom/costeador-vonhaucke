# Costeos por producto — BOM completo + totales (datos reales, sólo extraídos)

Cada costeo tiene su BOM renglón por renglón en CSV (claves limpias) y, cuando el workbook lo trae,
el volcado verbatim de todas sus hojas en `raw_hojas/<archivo>/`. **Totales tomados literalmente del
archivo**; cuando el workbook traía la celda de total rota (`#REF!`) se indica y se reporta la **suma de
las líneas** (no se inventa). Regla dura: consumos, mermas, tiempos y costos son los del archivo.

## Resumen de totales de material por producto

| Producto / código | Archivo fuente | Líneas BOM | Total material | Origen del total | Estado |
|---|---|---|---|---|---|
| **Módulo Pedido 38247** (TATO63612AB001) | Ejemplo 01 - Modulo en Pedido 38247 | 40 (consumo real) | **$55,395.34** | celda `Total` de hoja `VH Detalle Costo Real Materia P` | nueva ✅ |
| **C-CO-517R Exhibidor ENTCBCALP** | C-CO-517R Exhibidor ENTCBCALP | 38 (28 con costo) | **$12,089.66** | suma de `costo_linea` (celda total del libro = `#REF!`) | nueva ✅ |
| **Ejercicio repisa flotante** | ejercicio repisa | 16 (6 con costo) | **$156.98** | suma de `costo_linea` (celda total = `#REF!`) | nueva ✅ |
| **TELCEL C-CO-320R DATS** | (commiteado) | 126 | **$47,432.84** | suma `costo_linea` de `explo_x_id_costeo_real.csv` | commiteado |
| **VENTO C-CO-526R** (copia commiteada 16HcbMYq) | (commiteado) | 185 | **$42,653.27** | suma `costo_linea` de `C-CO-526R__Explo_MP.csv` | commiteado |
| **VENTO C-CO-526R** (copia Drive 1eTZbM) | C-CO-526R ... 20 OCT (dup) | 106 con costo | **$20,358.57** | suma `costo_linea` (copia divergente — ver MANIFIESTO §4) | nueva ✅ |
| **VENTO MASTER** (11 muebles) | (commiteado) | 11 partidas | **$56,674.06** (materia prima) | hoja `Tabla original` | commiteado |
| **Escritorios Alba** | Escritorios Alba Precios | 783 productos (6 con precio) | — | lista de **precio de producto terminado** (no costo MP) | nueva ✅ |
| **TELSVH120** Vitrina Horizontal | TELSVH120 | BOM dimensional | sin columna de costo | Hoja de Manufactura (consumos/dim.) | nueva ✅ |

## Detalle por costeo

### Módulo Pedido 38247 — `costeos/Modulo38247/`
Costeo **real de producción** (no simulación). Hojas:
- `MaterialSolicitado.csv` — material solicitado por el pedido: clave, descripción, opción, **cantidad**,
  unidad, fecha requerida, división, almacén, situación, **Costo Unitario** y **Costo MP** por renglón.
- `VH_Detalle_Costo_Real_Materia_Prima.csv` — **consumo real** del ERP: movimiento, fecha, almacén,
  artículo, familia, cantidad, **Costo Unitario Promedio**, **Costo Total Materia Prima**; con subtotales
  por familia y **Total = $55,395.34**.
- `Pedido.csv`, `EntradaProd_tiempo.csv`, `Fabricado_Tiempo.csv`, `PPyP_Tiempo.csv` — **tiempos de
  manufactura** (mano de obra) y datos del pedido, tal cual.

### C-CO-517R Exhibidor ENTCBCALP — `costeos/CCO517R_Exhibidor/`
`Explo_MP_BOM.csv` (encabezados: articulo, descripción, opción, opción_descripción, unidad,
**fecha_última_compra**, **costo_última_compra**, **consumo_unitario**, **costo_linea**). 38 líneas, 28 con
costo, suma $12,089.66. Otras hojas útiles: `cuanti_mp`, `cal_empa_emba` (embalaje), `REG-DCC-IDP-031/032`.

### Ejercicio repisa flotante — `costeos/ejercicio_repisa/`
`Explo_MP_BOM.csv` — 16 líneas (6 con costo real: MDF, perfil de canto, laminado, lámina negra, tubular,
pintura en polvo), suma $156.98. Mismo set de hojas de plantilla (cuanti_mp, cal_empa_emba, t_d_p, T_d_C).

### Escritorios Alba — `costeos/EscritoriosAlba/precios_lista_producto_terminado.csv`
783 productos (escritorios): artículo, descripción, estatus (ALTA/BLOQUEADO), **precio_lista** (sólo 6
productos traen precio; el resto vacío — se respeta, no se rellena). Es **precio de venta de PT**, no costo de MP.

### TELSVH120 — `costeos/TELSVH120/hoja_manufactura_Hoja1.csv`
Hoja de Manufactura (HDM-DOP-DMA-001) de la Vitrina Horizontal TELSVH120: clave de parte/componente,
descripción, **largo/ancho (mm)**, descripción y **clave de material Intelisis**, piezas×mueble, **cantidad
de material**, dirección de corte/beta, unidad, peso, caras a pintar, pintura/barniz, centro de trabajo,
almacén destino. Es BOM dimensional + consumos (sin columna de costo en la HDM).
(Nota: existe `lab/compras_reales/TELSVH120_hoja_manufactura.csv` commiteado del mismo mueble.)

### Módulo Operativo APP LT (TATO63612AB001) — `costeos/CosteAPPLT/`
Costeo de ingeniería **real** del mismo módulo que produjo el Pedido 38247. Fuente: `Coste APP LT
20261002.xlsx` (Drive id `16dlIf3OnYo-14ivaC_demHa0_onoQdwN`). Producto: **MODULO OPERATIVO APP LT DE
3600 X 1200 MM, 6 USUARIOS, cubiertas ABS, estructura y acometida metálica**. 4 hojas volcadas:
- `ComponentesModulo.csv` — 7 componentes del módulo (21 piezas): patas tipo U (ATPU4M×2, ATPU75M×2),
  acometida (ATACM×1), cubiertas cuadradas (ATCUBD44ABS×3), omegas (ATOM3×6), conducto pasacables
  (ATRICDB4×3), placa unión (CIEPLA01300778×4).
- `Materiales.csv` — **BOM de materia prima (21 materiales)** con **Último Costo, fecha, proveedor, moneda y
  nº de Entrada de Compra** reales (fechas 2026-01 a 2026-10). Claves ya presentes en `materiales_master.csv`
  y sus costos integrados a `precios_vigentes_master.csv` (ver abajo).
- `Fabricar_componentes.csv` — **tiempos de mano de obra por área** de los 33 sub-componentes fabricados.
- `Compras.csv` — **libro real de compras 2026 (4,378 renglones)**: movimiento, fecha emisión, artículo,
  descripción, cantidad, **Costo Unitario**, proveedor. Es transacción real → integrado a precios.
- `BOM_costeo_APPLT.csv` (generado) — BOM con importe por renglón = consumo × último costo.

**Totales literales / calculados:**
- Material prima directa del BOM (21 renglones en pesos): **$3,679.15 MXN** (subtotal calculado = Σ consumo×último
  costo de los renglones en pesos). 1 renglón en dólares (pintura en polvo MVLQPP00000000, 7.07 USD) **no se
  convierte** (el archivo no trae tipo de cambio).
- Mano de obra (horas por área, fila de totales de `Fabricar componentes`): Procesos Metal **12.776**, Carpintería
  **4.2204**, Acabados **2.002**, ENTRE/ensamble **1.15**, Pintura **0.1331**; Tapicería/Acrílicos/Sillería = 0.
  **Total ≈ 20.28 h** de MO. (No hay tarifa $/h en el archivo; no se inventa costo de MO.)
- Las 33 claves de componente/sub-componente (incluida la clave de módulo TATO63612AB001) se agregaron a
  `materiales_master.csv` con su descripción literal.
> Relación con Pedido 38247: mismo código de producto (TATO63612AB001). El Pedido 38247 reporta **consumo
> real $55,395.34** (todas las familias); este Coste APP LT es la lista de MP de ingeniería por módulo
> ($3,679.15 de los 21 materiales base). Se presentan ambos tal cual, sin forzar que cuadren.

### Costo real financiero — `financiero/VONHAUCKE_EEFF_06_26/` (ver `COSTOS_REALES_EEFF.md`)
`VON HAUCKE EEFF 06 26.xlsx` **sí trae costo real** (no es sólo financiero). Costo de ventas real **Ene-Jun
2026 = $52,919,977.82 (70.8 % de la venta)**: materia prima directa $33,730,560.93 (45.1 %), gastos de
producción MOD+GIF $16,977,963.20 (22.7 %), distribución $2,211,453.69. **Costo por línea** (balanza 5100):
MUEBLES $29,794,243.22 · SILLAS $3,936,317.73. Detalle literal con procedencia hoja+cuenta en
`financiero/VONHAUCKE_EEFF_06_26/costos_reales_eeff.csv` (343 renglones) y `COSTOS_REALES_EEFF.md`. Es costo
a nivel empresa/línea (no por artículo) → benchmark de costo real; no altera `precios_vigentes_master.csv`.

### Línea SILLAS — `costeos/SILLAS/` (4a pasada)
Costo real de sillería consolidado (SILLAS = línea de costo propia en EEFF, $3.94M H1-2026). Fuentes:
- **Costo FOB de importación (proveedores):** Yueqiang 2023, Furicco 2023 (+ landed MXN factor 26 + venta 52),
  NOEL 2022, Motostuhl proforma STI42 2023 ($20,034) y 2025 ($48,580.15, 30 modelos), matriz 2019 (53 modelos
  de 12 proveedores con COSTO USD + COSTO MEXICO landed), COMPARATIVO (OFFIDAE vs OFFIHO).
- **Costo real por clave interna → integrado a `precios_vigentes_master.csv`:** Sillas Pendientes 2023 (34
  OC/req, Importe Pendiente, orden_compra) + Costo Promedio 2024 (7 claves, ultimo_costo).
- **Precio de venta:** BASE silleria (856 productos) en `claves_producto_precio_venta.csv` (separado del costo).
Nota: los códigos de proveedor (3188MB, F1819, GAMMA, 05CC-*, etc.) no son claves MVL internas → no entran a
precios_vigentes_master; quedan como referencia de costo de importación de sillas terminadas.
