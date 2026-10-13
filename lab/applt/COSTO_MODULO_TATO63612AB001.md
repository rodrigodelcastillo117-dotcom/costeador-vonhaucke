# Costo de fabricar 1 módulo TATO63612AB001 (APP LT 6 usuarios, 3600×1200, acabado del pedido A118/B770/C770)

Fuente: `ejemplo01_TATO63612AB001.json`, pedido 38247 (3 módulos; los 9 biombos se excluyen). Todo es aritmética sobre los datos del ERP.

| Concepto (por módulo) | ERP estándar | Real reportado | Real con horas estándar |
|---|---:|---:|---:|
| Materia prima | (dentro del costo de entrada) | 3,480.88 consumida (incompleta: lámina "sobrante") · 4,110.32 planeada a costo promedio | 4,110.32 (planeada) |
| Procesos metal | | 5,415.35 (14.47 h × 374.25) | 4,781.42 (12.776 h) |
| Carpintería | | **5,345.58 (15.97 h × 334.67)** | 1,412.44 (4.2204 h) |
| Acabados | | 913.27 | 608.23 |
| Pintura | | 492.40 | 572.58 |
| **Total** | **9,664.92** | **15,899.76** (MP consumida) · 16,529.20 (MP planeada) | **11,484.99** |
| Precio lista sin biombo | 12,380 | 12,380 | 12,380 |
| Margen sobre venta | 21.9 % | −28.4 % / −33.5 % | 7.2 % |

Tarifas $/h reales (MO + IND): metal 92.38 + 281.87 · carpintería 82.61 + 252.06 · acabados 74.99 + 228.82 · pintura 371.30 + 3,930.56. MO real de los 3 módulos: 8,828.56. IND real: 28,428.07.

**Hallazgo:** las cubiertas (ATCUBD44ABS + ‑CCU) reportan **47.92 h de carpintería** para 9 piezas; el estándar es 12.66 h (3.8×). Esas horas, a tarifa real, son $16,036 de los $37,257 de MO + IND. Con los datos no se puede saber si es ineficiencia real, re-trabajo o un error de captura.

Ningún escenario incluye entregas (1.15 h/módulo, sin tarifa), gastos de operación, flete ni instalación.
