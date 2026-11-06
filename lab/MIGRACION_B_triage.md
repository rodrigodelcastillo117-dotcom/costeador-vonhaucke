# Migración B — triage honesto de las 36 filas del diff Paso A v2

**Fuente del diff:** `lab/datos_reales_drive/DIFF_pasoA_v2_cambios.csv` (cambios >5% del Paso A v2).
**Validación:** cada fila contra el catálogo real (`insumos_catalogo` + último `insumo_precios` erp_intelisis) y contra `precios_vigentes_master.csv`.
**Regla:** fail-closed. Sólo se carga lo que pasa TODOS los filtros automáticos; lo demás va a humano o se rechaza. Nunca inventar precio, nunca $0, PRELIMINAR no certifica.

## Resultado

| Veredicto | Filas | Acción |
|---|---:|---|
| **CARGAR (PRELIMINAR)** | 5 | `MIGRACION_B_precios_frescos.sql` (opcional, valor bajo) |
| **NECESITA_HUMANO** | 13 | lista abajo → Compras/Dirección decide con fecha real de OC |
| **RECHAZO — error de unidad** | 8 | nunca cargar |
| **RECHAZO — falso positivo del matcher** | 10 | arreglar matcher y re-correr Paso A |
| **Total** | 36 | |

> **Titular honesto:** "cargar los precios reales" hecho con rigor **casi no cambia el costeo**. De 36 presuntos cambios, 18 son defectos (falsos empates o errores de unidad), 13 no puedo verificarlos solo, y los 5 que quedan son sillas de un archivo de costo promedio, no MP de fabricación. El hallazgo que sí importa es que **el join por `clave_comercial` del Paso A v2 produce falsos positivos** — hay que corregirlo antes de cualquier carga grande.

---

## 1) CARGAR como PRELIMINAR (5) — pasan empate exacto + año posterior + magnitud 13–22%

Todas sillas/banco; fuente `Sillas_CostoPromedio_2024` (ultimo_costo, n_fuentes=3). Precio y fecha exactos del master.

| insumo_id | articulo ERP | cat (fecha) | real (fecha) | Δ |
|---|---|---|---|---:|
| erp-bedambmpem | MBLXSN1205D856 | $4977.80 (2019-09-30) | $5820.17 (2021-07-06) | +16.9% |
| erp-bevbmbrem | MBLXSN1206E458 | $1703.94 (2019-09-30) | $1928.29 (2023-10-04) | +13.2% |
| erp-sanfordem | MTHXSA12B5V500 | $599.18 (2018-01-29) | $678.94 (2023-05-02) | +13.3% |
| erp-skate-rbebrmtmem | MBLXSA1295R600 | $2927.25 (2019-08-23) | $3573.63 (2023-10-24) | +22.1% |
| erp-zauber-toolem | MZAXBC06060000 | $781.75 (2017-06-14) | $891.73 (2021-03-23) | +14.1% |

**Caveat:** costo PROMEDIO, no transacción. Son productos de reventa, no insumos de fabricación. Impacto en costeo de muebles ≈ nulo. Cargar es opcional.

---

## 2) NECESITA_HUMANO (13) — empate exacto, pero fuente del MISMO año que el catálogo

No puedo decidir automáticamente cuál es más fresco (el diff sólo trae el año, no la fecha de la OC). Compras tiene la fecha de OC y decide en segundos. **Aquí están los que SÍ importan para costeo** (tubular, minifix):

| insumo_id | articulo | cat (fecha) | real | fuente | Δ |
|---|---|---|---|---|---:|
| erp-tubi311216 | MPMTTU01010101 | $348.67 (2024-08-28) | $616.14 | 2024 orden_compra | **+76.7%** ⚠ MP tubular |
| erp-tre1621 | MLESTU03290301 | $229.16 (2024-08-28) | $263.64 | 2024 orden_compra | +15.0% MP tubular |
| erp-sdposha | MDACP102000002 | $2883.60 (2026-10-15) | $4286.98 | 2026 cata_mp | +48.7% (cat ya 2026-10) |
| erp-esp-rewindem | MDESSA01680070 | $1271.03 (2025-12-18) | $1600.00 | 2025 orden_compra | +25.9% (cat ya 2025-12) |
| erp-gi10044 | MIIPPM00723700 | $195.00 (2025-11-28) | $235.00 | 2025 orden_compra | +20.5% (cat ya 2025-11) |
| erp-ohs87cbnem | MVLXSA12I20H00 | $2613.25 (2022-09-12) | $3131.70 | 2022 orden_compra | +19.8% |
| erp-austriaem | MVLXSA12000G00 | $2808.00 (2023-12-06) | $3158.00 | 2023 orden_compra | +12.5% |
| erp-asumdm-cr1 | MLECCR00RF02R8 | $1897.00 (2025-10-28) | $2135.00 | 2025 orden_compra | +12.5% |
| erp-sovroad | MLEXSO310000V9 | $111.43 (2026-09-22) | $119.11 | 2026 entrada_compra | +6.9% |
| erp-pr010 | MVLUMI32004115 | $1.82 (2025-10-08) | $1.5876 | 2025 orden_compra | −12.8% minifix |
| erp-dream09 | MCMXES04090000 | $1231.16 (2023-08-24) | $1097.80 | 2023 orden_compra | −10.8% |
| erp-mit19u | MVLUMI31003912 | $2.4656 (2025-07-24) | $1.60 | 2025 orden_compra | −35.1% minifix |
| erp-gi12842 | MIIPELM1050002 | $750.00 (2025-12-02) | $305.65 | 2025 orden_compra | −59.2% ⚠ caída grande |

---

## 3) RECHAZO — error de unidad (8) — nunca cargar

| insumo_id | articulo | cat | real | Δ | motivo |
|---|---|---|---|---:|---|
| erp-mleupn4305900 | MLEUPN4305900 | $9.8669 | $98.669 | +900% | ×10 exacto (perno) |
| erp-f815d | MVLALA14000018 | $31.66 | $1.84 | −94.2% | caída extrema (lapicera) |
| erp-be524262c1c | MVLECO1222A653 | $96.343 | $5.40 | −94.4% | **clúster ratio 0.05605** |
| erp-be524262c2bb | MVLECO1222A654 | $105.26 | $5.90 | −94.4% | clúster 0.05605 |
| erp-be52463254 | MVLEEA2504A800 | $385.37 | $21.60 | −94.4% | clúster 0.05605 |
| erp-be52468-2-54 | MDMECA00280000 | $410.35 | $23.00 | −94.4% | clúster 0.05605 |
| erp-be52490-2-72 | MVLEAE00012200 | $524.53 | $29.40 | −94.4% | clúster 0.05605 |
| erp-be524132230 | MVLECA0303A500 | $260.48 | $14.60 | −94.4% | clúster 0.05605 |

Los 6 "BE52…" caen exactamente al mismo factor 0.05605 (≈1/17.8): imposible como movimientos independientes → precio en unidad distinta (pieza vs caja). Mismo patrón que el perno ×10.

---

## 4) RECHAZO — falso positivo del matcher (10) — arreglar y re-correr Paso A

El join por `clave_comercial` empató la fila del master con un **artículo ERP DISTINTO** al que representa el insumo del catálogo. El "cambio" compara dos productos diferentes.

| insumo_id | articulo del DIFF | articulo REAL del catálogo | nota |
|---|---|---|---|
| erp-mdf12 | MVLMMD**01**280400 | MVLMMD**02**280400 | 1 cara vs 2 caras; catálogo ya 2026-06 fresco |
| erp-be08221 | MLEESO00B80000 | MDMECA00060000 | distinto; catálogo ya 2026-04 |
| erp-bnviccb1969cn1 | MBACCS**0329**0343 | MBACCS**0033**0343 | distinto; catálogo ya 2025-11 |
| erp-toacb512 | MVLUTO**2711**0001 | MVLUTO**1150**0001 | distinto; catálogo ya 2026-10 |
| erp-be524262g1c | MVLECO15030000 | MVLECO1322A755 | distinto |
| erp-admadp-plu | MVLSC**P**008600F6 | MVLSC**O**033900F7 | distinto |
| erp-capjob | MJOAAS0301**J702** | MJOAAS0301**00ZA** | distinto |
| erp-ct6lv161 | MPPCCR**0057**0735 | MPPCCR**1157**0722 | distinto |
| erp-acmz0648mf2 | MVLPAM01**01**1700 | MVLPAM01**03**1700 | distinto |
| erp-starbem | MSTXSA1294**B**700 | MSTXSA1294**E**700 | color distinto |

**Corrección del matcher:** empatar SÓLO por `articulo + opcion` exacto contra `atributos->erp->articulo`; nunca por `clave_comercial` (no es única por artículo). Re-correr Paso A con esa regla da el universo real de cambios defendibles.

---

## Recomendación

1. **No** cargar nada automáticamente desde el diff v2 (defectuoso). La migración de 5 filas está lista y es reversible, pero es opcional y de bajo valor (sillas, costo promedio).
2. **Arreglar el matcher** (articulo+opcion exacto) y re-correr Paso A → ése es el prerequisito real.
3. **Mandar las 13 NECESITA_HUMANO** a Compras (traen OC reales: tubular +76.7%, minifix, etc.); ellos confirman fecha/unidad.
4. Rechazar permanentemente las 18 defectuosas (unidad + falsos positivos).
