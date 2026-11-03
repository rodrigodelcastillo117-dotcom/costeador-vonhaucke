# 95_P8_INSUMOS — conteos del catálogo + P0-03 resuelto por datos (2026-11-03)

Medición EN VIVO (solo lectura) contra prod `mtuvnbgljwbsaizjjgzs`. Sin tocar datos. Sin inventar nada.

## Conteos que el directivo afirma — CONFIRMADOS
| Afirmación | Medido en vivo | Veredicto |
|---|---|---|
| 10,185 insumos activos | `insumos_catalogo activo=true` = **10,185** (11,294 totales) | ✅ exacto |
| 42 puentes propuestos | `insumo_mapeos_externos estado='propuesto'` = **42** | ✅ exacto |
| 0 puentes aprobados | 0 filas con estado distinto de 'propuesto' | ✅ exacto |
| (extra) identidad de puentes | 42/42 `identity_status='EXACT_ATTRIBUTES'` | alta confianza |
| (extra) cobertura de precio | 11,293 de 11,294 insumos con ≥1 precio | catálogo priceado |

## P0-03 — "1,763 precios aprobados por qa-direccion" — **RESUELTO A NIVEL DE DATOS**

La premisa histórica (tarea P0-03) era que ~1,763 precios estaban firmados por la cuenta **no humana** `qa-direccion@vonhaucke.mx`
y por tanto no eran confiables como costo oficial. La evidencia en vivo lo refuta: esos precios ya fueron **re-firmados por el
humano de Dirección**.

Cuentas no humanas registradas: `qa-direccion@vonhaucke.mx`, `reconciliacion`.

Rastro de auditoría `aprobaciones_precio_historial` (11,847 eventos; **todos** `aprobado_por = rodrigo.delcastillo@vonhaucke.mx`):
- `aprobado_por_anterior`: null 10,054 · `qa-direccion@vonhaucke.mx` **1,763** · `reconciliacion` 30.
  (Es decir: 1,763 transiciones qa-direccion → humano, y 30 reconciliacion → humano.)

Join preciso sobre los 1,763 de origen qa-direccion, estado HOY en la tabla viva `insumo_precios`:
| Chequeo | Valor |
|---|---:|
| precios cuyo aprobador anterior era qa-direccion | 1,763 |
| …que siguen vivos | 1,763 |
| …re-firmados por el humano (rodrigo.delcastillo@) | **1,763** |
| …que aún confían en una cuenta no humana | **0** |
| …no aprobados | **0** |

Chequeo global sobre toda la tabla viva:
- `insumo_precios` aprobados por CUALQUIER cuenta no humana = **0**.
- 12,971 precios aprobados, **todos** por el humano Dirección.
- Estados de precio: `aprobado` 12,971 · `propuesto_validado` 2.

Políticas de aprobación (sanas, con documento en su mayoría):
- D1 (última compra Intelisis con documento): 11,588 (buckets ≤24m 2,263 · ≤120m 4,457 · ≤360m 4,868)
- D2 (firma de Dirección sin documento de compra): 194
- D3 (Dirección quita la marca de Compras y declara evidencia): 65

## Veredicto P8 / P0-03
**El invariante de integridad de P0-03 está CERRADO:** ningún costo oficial vivo confía en una aprobación de cuenta QA/no-humana.
El gate `puede_certificar_costo()` excluye esas cuentas, y los datos confirman que 0 precios vivos dependen de ellas; los 1,763
de origen qa-direccion fueron re-firmados 1,763/1,763 por el humano Dirección.

**Lo que esto NO certifica (honestidad):** "re-firmado" es un evento de re-aprobación registrado; no prueba que un humano haya
auditado número por número cada una de las 1,763 cifras. El riesgo de *seguridad/identidad* (confiar en una cuenta no humana) está
cerrado; la *revisión de contenido* de esos precios es una decisión de proceso de Dirección, no algo que estos datos puedan afirmar.

Lo único genuinamente pendiente en P8 es humano: aprobar los 42 puentes `propuesto` (pantalla Aprobar puentes lista, el clic es de
Dirección) — no es un defecto, es el gate esperando una persona.
