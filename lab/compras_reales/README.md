# Compras reales (Órdenes de Compra) + Hoja de Manufactura TELSVH120

**Precios REALES de transacción** — lo más fresco que tenemos para costear.

## `ordenes_compra_consolidado.csv` — 6 OCs, 1,641 renglones, 657 artículos únicos
Consolidado de las Órdenes de Compra en disco (hoja `Detalle O.C.`). Columnas:
`articulo · descripcion · costo_unitario · cantidad · fecha_emision · proveedor · fuente`.

| Órden de Compra (periodo) | renglones |
|---|---|
| 26 may – 20 jun 2025 | 598 |
| 1 – 28 feb 2026 | 376 |
| 29 sep – 10 oct 2025 | 297 |
| 20 – 24 oct 2025 | 155 |
| 13 – 17 oct 2025 | 128 |
| 27 – 31 oct 2025 | 87 |

**Por qué importan:** son el **precio real al que Compras efectivamente compró** cada artículo, con fecha.
Mucho más confiable y fresco que el `cata_mp` (que arrastra última-compra desde 2009). Para el motor,
el precio de una OC de feb-2026 es "verdad de hoy".

## `TELSVH120_hoja_manufactura.csv` — 544 filas
Hoja de Manufactura del mueble TELSVH120 (el mismo del plano PDF). Proceso + materiales + tiempos.

## Pendiente (requiere autorización — toca prod)
Estas OCs son la mejor fuente para una **política de precio vigente**: para cada artículo, usar la OC más
reciente; si no hay OC, caer al `cata_mp` reciente; marcar viejo lo de <2024. Cargar al catálogo del
motor = migración a producción, NO hecha aquí.

## Falta traer de Drive (si se quiere cobertura total)
Más Órdenes de Compra 2024-2026, `Escritorios Alba Precios.xlsx`, `Ejemplo 01 - Modulo 38247`,
y el resto de costeos. Están en la carpeta Drive `140tw99N0F8pfW6sCnMxx4TE66iTmsdLL`.
