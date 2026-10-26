# Datos reales TELCEL — extracción (2026-10-26)

Extraído de dos archivos reales subidos por Dirección (costos reales de productos reales).
**NO cargado aún a Supabase / `insumo_precios`** — eso es una acción gobernada (precio real con
fuente/fecha) que se hará aparte, con créditos, no en esta cirugía de bajo costo.

## Fuentes
- `3949cec4_C-CO-320R_DATS_TELCEL_DIV-MATERIALES_*.csv` — workbook de costeo VH del proyecto
  C-CO-320R (TELCEL). Hojas relevantes:
  - `cata_mp` (15,854 filas): catálogo MP/MD/MC con `articulo, descripción, opción, unidad,
    fecha_última_compra, costo_última_compra, largo, ancho, desarrollo, clave_comercial`.
    **Aquí están los precios reales que aún no metemos al catálogo.**
  - `explo_x_id` (242 filas): explosión de BOM por id (artículo, descripción, unidad, consumo
    unitario, costo última compra, costo unitario).
  - `cuanti_mp` (34 filas): cuantificación por parte/pieza con consumos y calculadora de hojas
    (3'x8', 3'x10', 4'x8', 4'x10').
  - `solicitud`, `tabla_de_comparación`, `estimación`, `info_t_d_c`, `cal_empa_emba`: contexto,
    márgenes por línea, empaque/embalaje.
- `e87a7871_TELSVH120_*.csv` — Hoja de Manufactura (HDM-DOP-DMA-001) del modelo TELSVH120.

## Pendiente (cuando haya créditos)
- Conciliar `cata_mp` contra `insumo_precios`: identificar SKUs/precios reales que faltan,
  normalizar unidad, y cargarlos como precio real con fuente y fecha (acción gobernada).
