# Datos reales TELCEL — `C-CO-320R DATS TELCEL DIV-MATERIALES 20261002` (v_3, subido 2026-10-29)

Extracción determinista (openpyxl `data_only`) de **las 8 hojas** del workbook real de VonHaucke.
Fuente: upload `19e0e6a2-C-CO-320R_DATS_TELCEL_DIV-MATERIALES_20261002_3.xlsx`.
Solicitud original: `rafael_c.`, fecha 2025-01-24. Tipo: `cotización_proyecto_vonhaucke`.
**No es una corrida del motor ni de la app — es la verdad del workbook de Compras/Dirección.**

Es un set de varios módulos **DAT'S R5** (Vitrina Torre 600×600×1950, Vitrina Horizontal 1200×600,
Vitrina Isla 2025×1200, Módulo de Almacenamiento, Caja de Cobro), NO el TEVTSU (vitrina 600×2295).

## Las 8 hojas (todas revisadas y volcadas a CSV)

| Hoja | CSV | Qué es |
|---|---|---|
| `solicitud` | solicitud.csv | Encabezado de la solicitud (quién, fecha, tipo de venta/empaque). |
| `tabla_de_comparación` | tabla_de_comparaci_n.csv | Plantilla de rollup por módulo: columnas `$_cos_mat, $_cos_man_obr, $_cos_gas_ind, $_cos_fab, precio_mínimo, precio_de_lista, precio_2`. **Las celdas de costo están VACÍAS en este workbook** (no se calcularon). Trae las descripciones de fabricación por módulo. |
| `explo_x_id` | explo_x_id.csv + **explo_x_id_costeo_real.csv** | **El costeo real: explosión de BOM** con `costo_última_compra × consumo = costo_línea`. **126 renglones → TOTAL MATERIAL $47,432.84.** |
| `cuanti_mp` | cuanti_mp.csv | Cuantificación de MP: desarrollo, consumos por pieza, aprovechamiento/merma. |
| `estimación` | estimaci_n.csv | Plantilla de estimación (vacía / en cero en este workbook). |
| `cata_mp` | cata_mp.csv + **cata_mp_precios_reales.csv** | **Catálogo de materias primas con última compra** (`Consulta MP, MD y MI última Compra_20240709`). **15,852 renglones, 10,555 con costo>0.** Columnas: articulo, descripción, unidad, fecha_última_compra, **costo_última_compra**, largo, ancho, desarrollo, clave_comercial. |
| `info_t_d_c` | info_t_d_c.csv | Metadatos del libro (tipos, secciones, clasificaciones). Dashboard interno. |
| `cal_empa_emba` | cal_empa_emba.csv | Calculadora de empaque/embalaje por m³. Totales por método: $233.95 / $582.69 / $1,519.65 / $1,392.16 / $2,442.06 / $2,312.87 (y jgo hasta $3,562.87). |

## "3 pestañas con diferentes costos"
1. **`explo_x_id`** — costo de **material** por última compra: **$47,432.84** (el costeo duro del set).
2. **`cal_empa_emba`** — costo de **empaque/embalaje**, 6 escenarios ($234 – $3,563 según método).
3. **`tabla_de_comparación`** — rollup a **precios** (mínimo / lista / precio_2) + MO + indirectos — plantilla, celdas de costo vacías aquí.

## Hallazgos honestos (importan para "costeo al 100")
- **Precios con antigüedad 2009–2024.** Distribución de `fecha_última_compra` entre los 10,555 con costo:
  2024: 780 · 2023: 778 · 2022: 666 · 2021: 562 · 2020: 570 · 2019: 740 · 2018: 704 · 2017: 682 ·
  2016: 672 · 2015: 960 · 2014: 967 · 2013: 1,194 · 2012: 567 · 2011: 305 · 2010: 377 · 2009: 31.
  **Solo ~1,558 (2023-2024) son razonablemente frescos.** "Precio real" ≠ "precio de hoy" para gran parte.
- **La `tabla_de_comparación` NO trae los costos calculados** (plantilla): el único costo material duro aquí es `explo_x_id` ($47,432).
- Gap app↔real detectado: `cerradura` CAM LOCK real **$416** vs genérico de la app **$120**; lámina cal.14 3×10 real **$816.48** = idéntica a la del catálogo (esa sí correcta).

## Pendiente (NO hecho aquí — requiere autorización explícita)
Cargar estos precios reales al catálogo del motor es una **migración a producción**: no se hace a ciegas
(muchos precios son viejos; hay que decidir política de frescura y mapeo de claves MVL↔insumo). Propuesta
y runbook de carga previos: ver `../TELCEL_LOAD_READY.sql`, `../TELCEL_LOAD_PLAN.md`, `../TELCEL_DRIFT.md`.
