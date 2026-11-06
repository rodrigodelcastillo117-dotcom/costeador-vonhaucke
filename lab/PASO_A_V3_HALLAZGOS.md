# Paso A v3 — matcher corregido (empate exacto articulo+opción, fechas reales)

**Reemplaza** `DIFF_pasoA_v2_cambios.csv` (join por clave_comercial, defectuoso) y la
`MIGRACION_B_precios_frescos.sql` basada en él. Solo lectura + cómputo offline; **no toca prod**.

**Fuentes:** catálogo vivo (`catalogo_vigente` × `insumos_catalogo`, 9,927 insumos con artículo ERP) ·
precio real `mp_master_fresco/CostosMP_10082026` (última compra con Opción y Fecha reales) ·
overlay `precios_vigentes_master.csv` (OC + entradas 2025-26).
**Reproducible:** `scripts_lab/pasoA_v3.py`. Salidas: `DIFF_pasoA_v3_{todos,cargar,oc}.csv`, `DIFF_pasoA_v3_resumen.txt`.

---

## Veredicto: NO hay nada que cargar automáticamente. El catálogo YA es el precio real.

| Métrica (empate exacto articulo+opción) | valor |
|---|---:|
| Cobertura del empate exacto | **9,855 / 9,927 = 99.3%** |
| Coinciden con el ERP real dentro de ±5% | **8,709 (88%)** |
| Difieren ≥5% | 1,146 |
| — de esos, **CARGABLES** (más fresco + magnitud sana) | **0** |
| Overlay OC/entrada 2025-26, comparables | 21 → **CARGABLES: 0** |

**El matcher corregido funciona** (99.3% empate exacto) y prueba que el catálogo ya refleja la última
compra real para la gran mayoría. El join por `clave_comercial` de v2 inventaba empates (comparaba
artículos distintos); de las 36 "diferencias" de v2, ninguna sobrevive el empate exacto como carga.

## Por qué 0 cargables — a dónde se fue cada diferencia

1. **675 "no más fresco"** — el catálogo ya tiene precio de fecha igual o posterior a la última compra
   del ERP. Sobrescribir sería ir hacia atrás. Ejemplo clave: **tubular `MPMTTU01010101` +76.7%** era
   espejismo — el catálogo (2024-08-28, $348.67) ya es MÁS nuevo que la OC (2024-05-27, $616.14). El
   fail-closed acertó.
2. **~471 "clúster/magnitud"** — dominadas por **placeholders planos en artículos genéricos** (ver abajo),
   no por cambios reales.
3. **9 rechazos de unidad (overlay OC)** — TODOS del mismo archivo `CosteAPPLT_Compras` (entrada):
   clúster −94.4 % "BE52…" (6 eléctricos, ratio idéntico 0.05605), perno ×10 (+900 %), lapicera −94.2 %,
   compuesto 3M −94.1 %. Un archivo con **unidad sistemáticamente distinta** (pieza vs caja). Auto-rechazado.

## Hallazgo accionable real: placeholders planos en genéricos (esto SÍ toca costeo de muebles)

Varios artículos ERP genéricos traen **un precio plano** repetido en todas sus opciones, mientras el ERP
real tiene precio por opción:

| articulo | opciones (insumos) | precios distintos | precio plano |
|---|---:|---:|---|
| MVLRTE00000000 (TELA) | 396 | 15 | moda $95 |
| MVLMLP00280000 (LAMINADO 4×8) | 156 | 11 | moda $410 |
| MVLMAG01280800 | 63 | **1** | $1,075 (todas) |
| MVLRPL00000000 (PIELETTE) | 43 | **1** | $75.35 (todas) |
| MVLMCH00010010 (CHAPA) | 42 | **1** | $540 (todas) |

Esto es laminado / chapa / canto / tela — MP real de muebles. **No es un refresh de precios**: es una
decisión de Compras (¿se cotiza cada opción a su precio real, o el plano es intencional?). Es el único
frente donde "cargar precios por opción" cambiaría el costeo de verdad, y requiere su criterio.

## Recomendación

- **B queda cerrado: no se carga nada.** Los precios ya son reales; recargar no arregla el costeo
  (la premisa estaba equivocada, ahora probado a escala).
- Pasar a Compras/Dirección dos cosas, no para que yo cargue a ciegas:
  1. La lista de **genéricos con placeholder plano** (TELA/LAMINADO/CHAPA/PIELETTE/MVLMAG) — decisión de pricing por opción.
  2. El archivo **`CosteAPPLT_Compras`** tiene unidad equivocada en los eléctricos "BE52…" y similares — corregir en origen.
- Siguiente palanca real del costeo ya NO es precios: es **re-costear TEVTSU end-to-end vs el benchmark del EEFF** (Paso D).
