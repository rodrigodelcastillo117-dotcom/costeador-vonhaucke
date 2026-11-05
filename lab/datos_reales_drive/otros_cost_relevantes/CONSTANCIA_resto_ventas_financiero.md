# Constancia — resto de archivos §5 (venta / financiero / duplicados / ilegibles)

Regla: los puramente venta/cobranza/flujo se dejan como constancia pero SEPARADOS (no entran a
precios_vigentes_master = costo de MP por clave). Se excluyen datos personales/bancarios.

## VENTA (constancia)
- **VENTAS_OUTLET DE BODEGA NOVIEMBRE 2022.xlsx** (id 1S5vf_UU…; dup 1Wrft0ga…): reporte de ventas de outlet
  18-23 nov 2022, total **$31,450**. Productos y precios en `ventas_outlet_bodega_nov2022_agregado.csv`
  (Silla Berlin 4 puntos $540, sillas blancas $270, mesa home office $540-900, taburete Arlequin $1,333,
  banco Sitool $720, silla ejecutiva $1,080-$1,710). **EXCLUIDO:** la columna CLIENTE contiene nombres de
  EMPLEADOS individuales con arreglos de descuento vía nómina (dato personal) → no se vuelca por renglón.
- **sillas venta rodrigo 210224.xlsx** → movido a `costeos/SILLAS/sillas_costo_promedio_rodrigo_2024-02-21.csv`
  porque SÍ trae **Costo Promedio Unitario** real (integrado a precios como ultimo_costo, 7 claves).
- **COMPARATIVA PRECIOS EXPORTACION-NACIONAL.xlsx** (2 copias) → `comparativa_precios_exportacion_nacional.csv` (precio export USD vs nacional MXN por componente/módulo APP-Cirque; venta).
- **comparativa Precios usa octubre 6.xlsx** → `comparativa_precios_usa_2021.csv` (comparativo VH vs Clear Design 2021; venta).
- **LISTA Precios PISOS Oct 23.xlsx** → `lista_precios_pisos_oct2023_constancia.md` (listas de proveedores de piso; reventa).
- **Eclipse_PL_2023_0323_030.xlsx** → `eclipse_price_list_2023_venta.csv` (84 claves EXEC* con precio USD; agregadas a masters).
- **Accredo_Custom Storage_VH_2023_0630.xlsx** → `accredo_custom_storage_venta_export_2023.csv` (venta export; datos bancarios/contacto EXCLUIDOS).

## COMPRAS / COSTO (procesado)
- **pagos semana 43 revisado 26-10-2023 COMPRAS.xlsm** → `pagos_semana43_COMPRAS_2023_sin_bancos.csv`
  (Control de Pagos / Cuentas por Pagar, 64 renglones: comprador, material, proyecto, proveedor, importe,
  moneda). **EXCLUIDO:** columnas Cuenta Bancaria y Banco (datos bancarios de proveedores).
- **COMPARATIVO.xlsx** → `costeos/SILLAS/comparativo_costo_sillas_proveedores.csv` (comparativo de COSTO de sillas entre proveedores; es costo real).

## FINANCIERO (fuera de alcance de costeo — NO volcado)
- **flujo de efectivo mensual 2024 VERSION DG (5) FINAL.xlsx** (1DWXC9ES…), **FLUJOunico23.2.xlsx** (1rB2RzCn…),
  **FLUJOunico23.xlsx** (1r0uMTjh…), **FLUJOunico JDCP2024.xlsx** (1aXPC3La…): flujos de efectivo (tesorería,
  estados financieros de la empresa). No contienen costo de MP por clave. No se vuelcan: son financieros de
  empresa y pueden incluir datos de terceros; el costo real de producción ya está en el EEFF (3a pasada).
- **REPORTE DE COBRANZA 2DA_ENERO_2023_YAS.xlsx** (1B5Fxt2Y…): reporte de cobranza (cuentas por cobrar a
  clientes). No es costeo; contiene saldos de clientes (datos financieros de terceros). No se vuelca.

## OTROS (no costeo)
- **COCREATIONprogramCORE.xlsx** (12nDFLHA…): programa de co-creación (gestión de proyecto), no costeo. No volcado.
- **vonhaucke carta porte fasterrama.xlsx** (1kghnvmZ…): carta porte / logística. Ya se procesó una carta porte
  en la 2a pasada (segunda_pasada/compras/); es documento de traslado, no costo de MP. No volcado.

## DUPLICADOS EXACTOS / ILEGIBLES (anotados, no bloquean)
- **Furicco quotation to Vonhaucke.xls** (2 ids: 1qoaDRrX…, 1SyDzMbN…): formato .xls antiguo, DUPLICADO del
  .xlsx ya volcado en `costeos/SILLAS/cotizacion_sillas_Furicco_2023-06-17.csv`.
- **Updated STI42-01A-230726-87 (1).xlsx** (1RWzpVQb…): DUPLICADO de la proforma Motostuhl 2023 ya volcada
  (`costeos/SILLAS/proforma_Motostuhl_STI42_2023-07-26.csv`).
- **Silleria Usada.rar** (shortcut 1Aho9M1V… → rar): archivo comprimido .rar; las herramientas de Drive no
  decodifican su contenido. No legible.
