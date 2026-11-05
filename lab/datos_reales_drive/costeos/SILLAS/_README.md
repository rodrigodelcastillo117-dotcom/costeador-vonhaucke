# costeos/SILLAS — costo real de la línea SILLAS (consolidado 4a pasada)

SILLAS es línea de costo propia en el EEFF (costo H1-2026 = $3,936,317.73, cuenta 5100-02). Aquí se consolida
TODO el costo real de sillería hallado en Drive. Valores literales; costo real separado de precio de venta.

## Cotizaciones / proformas de proveedores (COSTO FOB de importación)
- `cotizacion_sillas_Yueqiang_2023-02-10.csv` — ZHEJIANG YUEQIANG, FOB Shanghai/Ningbo, 5 modelos ($38-$52 USD).
- `cotizacion_sillas_Furicco_2023-06-17.csv` — GUANGDONG SHUNDE FURICCO, FOB Shenzhen, 7 modelos ($85-$306 USD)
  + costo puesto en bodega MXN (FOB x26) + venta (FOB x52).
- `cotizacion_sillas_NOEL_2022-10-08.csv` — NOEL FURNITURE, FOB 40HQ, 8 modelos ($24.9-$63.3 USD).
- `proforma_Motostuhl_STI42_2023-07-26.csv` — Zhejiang Motostuhl, proforma real, 4 modelos, total $20,034 USD.
- `proforma_Motostuhl_STI42_2025-11-11.csv` — Zhejiang Motostuhl (SillasMARATTI), proforma real, 30 modelos, total $48,580.15 USD.
- `matriz_sillas_costos_2019.csv` — matriz de costos 2019: 53 modelos de 12 proveedores (OLIVE/LAIN/MOTO/MERRY/
  GT/GLOBAL/CONFORT/TORCH/FURICO/MINMEISEN/MOTOSTUHL) con COSTO USD FOB + COSTO MEXICO (landed MXN) + precio.
- `comparativo_costo_sillas_proveedores.csv` — comparativo de COSTO (OFFIDAE vs OFFIHO) sillas ZIP/REW/OHE-94/QUO.

## Costo real por clave interna (integrado a precios_vigentes_master)
- `sillas_pendientes_entrada_2023.csv` — 34 renglones OC/requisición 2023 (almacén MPSILL) con Importe Pendiente;
  costo unitario = importe/cantidad → integrado como orden_compra 2023.
- `sillas_costo_promedio_rodrigo_2024-02-21.csv` — 7 claves con Costo Promedio Unitario real (inventario 2024,
  MPSILL) → integrado como ultimo_costo.

## Precio de VENTA de sillería (separado; en claves_producto_precio_venta)
- `BASE_silleria_precios_venta.csv` — 856 productos de sillería con Precio Lista/Mínimo/2 (VENTA). Claves
  agregadas a materiales_master; precios de venta a claves_producto_precio_venta. NO es costo de MP.

Nota: los modelos de proveedor (3188MB, F1819, 05CC-3013, GAMMA, etc.) son códigos del proveedor, no claves MVL
internas, por lo que no se cargan a precios_vigentes_master (costo de MP por clave interna); quedan aquí como
referencia de costo de importación de sillas terminadas.
