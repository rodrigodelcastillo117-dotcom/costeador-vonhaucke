# Auditoría · los 110 precios de origen ERP clasificados como nuevo/vigente (2026-10-13)

Orden de Dirección (a): "Audita los 110 registros de origen ERP clasificados como nuevo/vigente." Todo lo de abajo sale de
consultas **SELECT** al proyecto de producción `mtuvnbgljwbsaizjjgzs`. No se escribió nada en producción y no se tocó
ningún precio. Lista completa con campos clave y banderas: `docs/auditoria/erp_110_registros.json`.

## 1. Qué consulta da exactamente 110

```sql
select p.*
from insumo_precios p
join insumos_catalogo c on c.id = p.insumo_id
where p.vigente_hasta is null
  and p.source_system = 'erp_intelisis'
  and c.clasificacion in ('nuevo', 'vigente');
-- 110 filas = 110 insumos distintos · ids de precio 370–479 · creado_por 'a11-erp-2026-10-12'
```

Cómo cuadra con los números conocidos (vigentes, `vigente_hasta is null`):

| `insumos_catalogo.clasificacion` | `source_system` | `estado` | precios |
|---|---|---|---|
| erp | erp_intelisis | aprobado | 1 660 |
| erp | erp_intelisis | propuesto_validado | 9 304 |
| **nuevo** | **erp_intelisis** | **aprobado** | **98** |
| **nuevo** | **erp_intelisis** | **propuesto_validado** | **7** |
| **vigente** | **erp_intelisis** | **aprobado** | **5** |
| total `erp_intelisis` | | | **11 074** (9 311 propuesto_validado + 1 763 aprobado) |

En `catalogo_vigente` hay 9 966 filas cuyo precio es ERP: 9 856 con `clasificacion='erp'` + **estos 110** (el precio ERP
gana el ranking en los 110). El cuadre "1 753 aprobados / 8 213 preliminares" de `ERP_PRECIOS_ELEGIBILIDAD.md` ya los
incluía (1 650 + 98 + 5; 8 206 + 7) aunque esa tabla los llamaba "clasificación erp".

Junto a ellos, fuera del conjunto pero relevante: 18 filas `DATA_TRUTH_V1` con `source_system='intelisis'` (sin `erp_`),
estado `propuesto`, cargadas el 2026-10-08 desde hojas de costo "golden" (Repisa, Alpura, pedido APP LT); 13 de ellas
están abiertas en 8 de los 110 insumos.

## 2. Qué son

Son el **lote A11** (`supabase/datos/2026-10-12_a11_certificacion_erp.sql`, aplicado el 2026-10-12 con la aprobación
"hazlo todo" de Dirección): se cruzó el Excel de Intelisis "Costos de Materia Prima Última Compra al 10/08/2026" contra el
catálogo **curado** (`src/datos/insumos.js`) y se puso el precio de última compra ERP a insumos curados existentes. Por eso
conservan su `clasificacion` curada (`nuevo` = alta curada del 2026-10-01; `vigente` = del catálogo original) y no `erp`.
El cargador masivo vh088 omitió esos artículos a propósito ("ids ya certificados en A11 se omiten"): **0** de los 110
registros ERP existe también como insumo `erp-…`, así que no hay doble alta del mismo artículo en el catálogo largo.

## 3. Categorías y coherencia con la política VH-147 (`ERP_ULTIMA_COMPRA_V1`, ventana 24 meses)

| categoría | n | detalle | ¿coherente con VH-147? |
|---|---|---|---|
| **A · aprobado, compra dentro de la ventana** | **103** (98 nuevo + 5 vigente) | última compra 2024-10-17 … 2026-08-10; `aprobado` por `aprobar_precio` el 2026-10-12 02:23–02:24; todos certificables hoy | **Sí**: DOCUMENTADO + aprobado → certificable en producción y bajo VH-147. |
| **B · propuesto_validado, compra fuera de la ventana** | **7** | melamina-16/19/28-sand, melamina-28-gris-humo-lm (2024-09), pintura-polvo-gris-unido-axalta (2024-10-09), tubular-redondo-34 (2021-10-13), acrilico-traslucido-3 (2016-11-09); no certificables | **Sí**: DOCUMENTADO + ANTIGUO → PRELIMINAR con fecha visible; VH-147 les añade antigüedad y motivo. |
| C · documentado en ventana sin aprobar / A2 · aprobado fuera de ventana | 0 | — | (A2 empieza a aparecer el 2026-10-18, ver riesgo 3) |

Conclusión: **ningún precio de los 110 contradice la política** — ninguno certifica con compra > 24 meses sin
aprobación, ninguno queda sin documento, todos tienen `cost_unit = unidad_costeo`, MXN, `precio > 0`, `requiere_validacion_compras = false`,
y en la vista gana el precio ERP en los 110. Lo que sí hay son **cinco riesgos de etiqueta, duplicidad y caducidad**:

## 4. Riesgos (banderas) y remediación sin tocar precios

| # | bandera | n | riesgo | remediación propuesta |
|---|---|---|---|---|
| 1 | `CLASIFICACION_NO_ERP` | 110 | Todo lo que identifica "ERP" por `clasificacion='erp'` los omite: el `select` de verificación de la propia PROPUESTA_vh147 (contaba 9 856, no 9 966), VH-146 (correcto ahí: los 110 ya tienen formato salvo 2), `esInsumoErp` (`aplicarCompartido.js`), `esGemeloExacto` (`gemeloErp.js`; ahí es correcto: un curado no es gemelo de sí mismo y ya trae precio certificable), la etiqueta "· ERP" de `BuscadorInsumo`. Riesgo de **reportar mal** (subconteo) y de mostrar "sin fuente ERP" a un precio que sí es de Compras. | **No reclasificar a `erp`**: `clasificacion <> 'erp'` es lo que los mete al catálogo curado de VONI (`analizar-mueble` filtra `clasificacion=neq.erp`; `catalogo_motor` por defecto). Leer la procedencia del **precio**: VH-147b añade `origen_precio` (vista) y `evidencia.origen_precio` (motor). La verificación de VH-147 ya filtra por `origen_precio`. |
| 2 | `PRECIO_LEGACY_ABIERTO` | 109 | El mismo insumo conserva abierto (`vigente_hasta` NULL) su precio LEGACY de lista de Compras (`referenciada`, `propuesto_validado`, `vigente_desde` 2026-10-01 = fecha de carga). Hoy no cambia nada (gana el ERP por estado/`confidence`; `resolve_canonical_price` sólo mira DATA_TRUTH_V1 aprobado), pero **dos precios vigentes** por insumo: si el ERP se cierra o se revoca, la lista sin documento vuelve a ser "el precio" sin aviso; y cualquier consumidor que no use el ranking `rn=1` ve dos. En 105 la diferencia es < 1 %; en 4 no: `lamina-3x10-12` 1 336.56 ERP vs 1 116.28 lista (+19.7 %), `laminado-walnut` 684.36 vs 641.59 (+6.7 %), `lamina-3x10-20` 428.65 vs 449.06, `lamina-3x10-14` 816.48 vs 849.50. | Parte B **opcional** de `PROPUESTA_vh147c_auditoria_erp_curados.sql`: cerrar `vigente_hasta` de los 102 LEGACY que conviven con un ERP **aprobado** (respaldo previo; no toca importes; no reversible por el trigger append-only, por eso es decisión de Dirección). Los 7 de B se dejan (su lista 2026-08 es la referencia para re-cotizar). |
| 3 | `APROBADO_SALE_DE_VENTANA_LE_12M` | 27 | La aprobación de A11 se dio **sólo** porque la compra era ≤ 24 meses. En V1 la aprobación no caduca: cuando la compra cumpla 24 meses, el precio **seguirá certificando** (riesgo de certificar un precio viejo como costo de reposición). Primero: `pintura-polvo-gris-ral-7036` (compra 2024-10-17 → fuera de ventana el 2026-10-18); 2 en ≤ 3 meses, 5 en ≤ 6, 27 en ≤ 12. | Visibilidad ya: con VH-147 salen `actualidad='ANTIGUO'` y antigüedad aunque certifiquen; la vista VH-147c los pasa a `A2_APROBADO_FUERA_DE_VENTANA`. Decisión de Dirección (§ 8.7 de `ERP_POLITICA_PRUEBAS.md`): si la aprobación debe caducar, es regla nueva → **`ERP_ULTIMA_COMPRA_V2`** por migración; lo certificado bajo V1 queda sellado como V1 (VH-147b). |
| 4 | `APROBACION_MASIVA_CUENTA_QA` | 103 | `approved_by = qa-direccion@vonhaucke.mx` (rol `direccion`), las 103 en 23 s; es la misma cuenta que aprobó los 1 763 ERP. La "validación comercial documentada" que VH-147 reconoce en `aprobado` es aquí la propia fecha de compra, no una revisión independiente. | Ninguna acción sobre datos. Documentar en la decisión de V2 si una aprobación hecha por cuenta QA en lote cuenta como validación comercial; `evidencias_certificacion_erp` (VH-147b) guarda quién selló cada certificación desde ahora. |
| 5 | `OTRO_DATA_TRUTH_ABIERTO` | 8 | 13 filas `source_system='intelisis'` (golden) abiertas en `propuesto` en el mismo insumo, a veces con otra fecha/precio del **mismo artículo**: `lamina-3x10-20` golden 441.72 del **2026-09-09** (posterior al corte del Excel) vs A11 428.65 del 2026-08-05; `lamina-3x10-12` 1 116.28 (2025-11-20) y 1 336.56 (2026-07-15). La vista elige por estado, no por fecha: el precio certificado **no es la compra más reciente conocida** (mismo patrón que el hallazgo L). | Sin cambio de datos. Compras confirma cuál es la última compra real; si el golden es una compra posterior, se carga como precio ERP nuevo (append-only) y se aprueba. Unificar la grafía `intelisis` → `erp_intelisis` sería un UPDATE de procedencia: **no** propuesto. |
| 6 | `ALIAS_REGISTRO_COMPARTIDO` | 4 | `melamina-28` y `melamina-28-walnut` (MVLMAG01280800\|B709), `pintura-polvo` y `pintura-polvo-basic-white` (MVLQPP00000000\|A101) usan el mismo registro ERP (alias genérico declarado en `source_document`). Para costear no duplica (una pieza usa un insumo); en un **reporte por artículo ERP** contaría doble. | Contar por `source_record_id`, no por insumo. Sin cambio. |
| 7 | `UNIDAD_ERP_DISTINTA` | 3 | `tubular-redondo-34` y `pulido-redondo-14`: ERP en "pieza" → costeo en "tramo" con factor 1 (supone 1 pieza ERP = 1 tramo de 6 m); `nivelador-plataforma` pieza → pza (inocuo). | Compras confirma que la pieza del ERP es el tramo de 6 m. Sin cambio. |
| 8 | `HOJA_SIN_FORMATO` | 2 | `acrilico-cristal-3` (hoja 4×6, aprobado) y `acrilico-traslucido-3` (4×8, B) sin `atributos.formato`: el motor no puede costear por área (P0-02) → pendiente. | Fuera de VH-146 (sólo `clasificacion='erp'` y familias de tablero). Alta de formato curado por Diseño (4×6 = 1.22×1.83; 4×8 = 1.22×2.44). |

Nada de lo anterior requiere modificar un precio. Doble conteo entre catálogos: **no hay** (0 artículos de los 110 existen
también como `erp-…`).

## 5. Archivos

- `docs/auditoria/erp_110_registros.json`: los 110 (precio_id, insumo_id, nombre, clasificación, estado, precio, unidades,
  última compra, antigüedad, fecha en que sale de la ventana, registro ERP, aprobador, formato, si gana en la vista, otros
  precios abiertos, categoría y banderas) + definiciones.
- `supabase/migrations/PROPUESTA_vh147c_auditoria_erp_curados.sql` (**no aplicar** sin autorización; requiere VH-147):
  vista `private_api.auditoria_erp_curados` que recalcula categoría y banderas con la política activa (si mañana hay V2,
  recategoriza en vivo); parte B opcional comentada; rollback. Probada en `supabase/tests/erpPolitica.test.js` (4 pruebas).
  La lógica de la vista se corrió en producción como SELECT equivalente y da exactamente los conteos de este documento
  (A 103 · B 7 · banderas 110/109/27/8/4/3/2).

## 6. Límites

- La pertenencia a "nuevo/vigente" es la etiqueta del catálogo, no un estado del precio; la auditoría la tomó como la
  pide la orden. Si Dirección se refería a otro conjunto (p. ej. `estado` o `actualidad`), no existe otro de 110: los
  conjuntos vecinos son 105 (`nuevo`), 103 (aprobados de A11), 122+1 (`nuevo` LEGACY), 130 (`vigente` LEGACY).
- Los conteos por tiempo (A2, "sale de ventana") cambian cada día: son al 2026-10-13.
- No se verificó contra el Excel original de Compras (no está en el repo); la procedencia se tomó de `source_document`,
  `source_record_id` y `evidencia` de cada fila.
