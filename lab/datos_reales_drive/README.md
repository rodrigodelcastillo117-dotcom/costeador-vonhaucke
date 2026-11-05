# datos_reales_drive — extracción íntegra de Drive (2026-11-05)

Datos **reales** extraídos de forma determinista de los archivos de costeo/precios/materiales/compras del
Google Drive de VonHaucke. **Sólo valores literales**; no se inventó nada. No se aplicó nada a producción.

## Mapa
- **`MANIFIESTO.md`** — inventario completo de Drive + **tabla de cobertura (archivo × hoja)**, 50 hojas al 100%.
- **`RESUMEN.md`** — hallazgos, estadística, gaps y pendientes.
- **`costeos_master.md`** — BOM + totales de cada producto costeado.
- **`precios_vigentes_master.csv`** — precio real más reciente por artículo + procedencia (8,951 artículos).
  Columnas: `articulo, descripcion, unidad, costo_vigente, fecha, anio, tipo_fuente, fuente, n_fuentes`.
  Precedencia: Orden de Compra más reciente > cata_mp más reciente (por fecha).
- **`materiales_master.csv`** — diccionario de 13,534 claves/materiales con specs y clasificación.
- **`mp_master_fresco/CostosMP_10082026__Hoja1.csv`** — catálogo MP más fresco (16,547 renglones, al 10/08/2026).
- **`ordenes_compra/`** — detalle por O.C. + `ordenes_compra_consolidado_TODAS.csv` (8 O.C., 1,853 renglones).
- **`costeos/<producto>/`** — BOM con encabezados limpios por costeo (Módulo 38247, C-CO-517R, repisa, Alba, TELSVH120).
- **`raw_hojas/<archivo>/<hoja>.csv`** — volcado **verbatim** de cada hoja de cada archivo (capa de auditoría).
- **`coverage_hojas.csv`** — tabla de cobertura legible por máquina.

## Regla dura
Sólo extracción. La carga al motor/catálogo de producción (migración) **no** se hizo aquí.
