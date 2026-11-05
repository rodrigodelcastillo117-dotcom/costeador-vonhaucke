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
