# RESUMEN — hallazgos de la extracción de Drive (2026-11-05)

## Qué se trajo de nuevo
- **13 workbooks procesados** (11 distintos + 2 copias), **50 hojas revisadas** al 100% (incluidas
  `hidden`/vacías) — ver `coverage_hojas.csv` y la tabla de cobertura del MANIFIESTO.
- 3 Órdenes de Compra nuevas, 1 maestro de MP fresco, 4 costeos de producto, 1 lista de precios de PT,
  1 control de importaciones.

## Precios reales — `precios_vigentes_master.csv`
- **8,951 artículos únicos con precio real** y su procedencia (fuente + fecha).
  - **480** con precio respaldado por **Orden de Compra** (compra real; máxima precedencia).
  - **8,471** con precio de **cata_mp** (`CostosMP_10082026`, última compra registrada en ERP).
- **1,484 artículos con precio fechado en 2025-2026** (lo más fresco y confiable).
- Distribución por año del precio elegido: 2026=848 · 2025=636 · 2024=270 · 2023=292 · 2022=399 ·
  2021=441 · 2020=407 · 2019=596 · 2018=541 · 2017=545 · 2016=490 · 2015=787 · 2014=734 · 2013=986 ·
  2012=410 · 2011=230 · 2010=319 · 2009=20. (Hay mucho precio viejo arrastrado como "última compra".)
- Precedencia aplicada: **O.C. más reciente > cata_mp más reciente**, eligiendo por fecha; se conserva
  `tipo_fuente`, `fuente`, `fecha` y `n_fuentes`. **No se inventó** ningún precio.

## Maestro de MP más fresco encontrado — `CostosMP_10082026`
`Costos de Materia Prima Ultima Compra al 10082026.xlsx` es un export de ERP **más fresco y amplio** que
el `cata_mp` embebido en VENTO (snapshot ya commiteado):

| Métrica | CostosMP_10082026 | cata_mp VENTO (commiteado) |
|---|---|---|
| Renglones | 16,547 | 16,404 |
| Artículos únicos | 13,524 | 13,402 |
| Con costo última compra | 11,101 | 10,980 |
| Renglones fechados en 2026 | **996** | 613 |

→ **Se guarda como el nuevo catálogo MP de referencia** (`mp_master_fresco/`). Además trae clasificación
que el cata_mp no tenía: `Nivel Producto`, `Producto` (categoría), `Elemento`, `Clave Comercial`, `Estatus`.

## Materiales — `materiales_master.csv`
- **13,534 claves/materiales únicos** deduplicados (descripción más completa conservada).
- **843** con dimensiones `largo`/`ancho` (de cata_mp y de la HDM de TELSVH120).
- Por nivel: MATERIAL DIRECTO 5,990 · MATERIA PRIMA 4,492 · MATERIAL INDIRECTO 3,042 · sin nivel 10.
- Columnas: `articulo, descripcion, unidad, largo, ancho, desarrollo, clave_comercial, estatus,
  nivel_producto, producto_categoria, elemento, fuentes`.

## Órdenes de Compra — `ordenes_compra/`
- `ordenes_compra_consolidado_TODAS.csv`: **1,853 renglones, 8 O.C.** (6 ya commiteadas + 2 nuevas con
  detalle). Por año: 2022=129 · 2024=83 · 2025=1,265 · 2026=376.
- Nuevas con detalle completo: **Abril 2022** (129) y **Mayo 2024** (83).
- ⚠️ **Julio 2024**: su hoja `Detalle` viene **vacía**; sólo hay un `Resumen` agregado por descripción
  (sin clave, sin costo unitario, sin cantidad) → **no aporta precios por artículo**. Volcado en
  `ordenes_compra/..._julio_2024__resumen.csv` para dejar constancia.

## Costeos de producto
Ver `costeos_master.md`. Totales de material: Módulo 38247 **$55,395.34** (costo real) · C-CO-517R
**$12,089.66** · ejercicio repisa **$156.98** · (commiteados: TELCEL $47,432.84 · VENTO C-CO-526R
$42,653.27 · VENTO MASTER materia prima $56,674.06).

## Gaps notables (app/catálogo ↔ realidad)
- **El `cata_mp` (costo última compra del ERP) puede quedar muy por debajo del precio real de compra
  reciente.** De **639 artículos presentes tanto en O.C. como en `CostosMP_10082026`**, varios muestran
  diferencias grandes, p.ej.:
  - `MVLMLP00280000` LAMINADO PLÁSTICO: O.C. $410.00 (2026-02) vs cata $117.86 → **+248%**
  - `MQMAUN01010101`: O.C. $2,485.00 (2026-02) vs cata $950.00 → **+162%**
  - `MVLPPC00491505` PERFIL DE CANTO: O.C. $11.66 (2026-02) vs cata $4.97 → **+135%**
  - `MDMPRE02020102`: O.C. $22.00 vs cata $2.40 → **+817%** (posible diferencia de unidad; a verificar).
  Implicación para el motor: costear con el `cata_mp` puede **subestimar** el costo; la política
  "O.C. reciente gana" (ya aplicada en `precios_vigentes_master.csv`) corrige esto. Algunas diferencias
  podrían deberse a unidad de compra distinta (pieza vs lote); se marcan **para verificar, no se ajustan**.
- **C-CO-526R tiene dos despieces distintos en Drive** bajo el mismo nombre ($42,653 vs $20,358) — revisar
  cuál es el vigente (MANIFIESTO §4).

## Qué falta / pendientes (requiere decisión, no hecho aquí)
- Cargar `precios_vigentes_master.csv` / `CostosMP_10082026` al catálogo del motor = **migración a
  producción**, NO realizada (esto es sólo extracción a archivos).
- **Sillas Pendientes 2023** (tracker) no reconstruida a disco (tool la devolvió inline); ~20 costeos
  legacy **RC-COSP** 2023 (Google Sheets) no procesados; `carta porte`, PDFs (planos/catálogos NOM) y
  notas de Gemini no procesados (no son costeo/precio en hoja). Todos listados en el MANIFIESTO §1C.
