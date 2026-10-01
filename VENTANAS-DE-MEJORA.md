# Ventanas de mejora — Costeador Vonhaucke (corte 2026-09-30)

Mapa priorizado tras los formatos reales de Rafa (solicitud) y Alba (T.D.C.).
Separa lo que se puede hacer **YA en código** de lo que **depende de datos** de
Vonhaucke. Ordenado por impacto en exactitud/utilidad.

## A. Lo que se puede hacer YA (código, sin datos nuevos)
| # | Mejora | Qué da | Esfuerzo |
|---|---|---|---|
| A1 | **Captura "tipo Rafa"**: despiece por consumo con la taxonomía real (se-compone-de, materiales con calibre, acabados con código Op) | Que la app capture como Rafa solicita → costeo de producto nuevo fiel | Alto |
| A2 | **Selector de tipo de producto** (fabricado/componente/compra-venta/servicio) | Aplica los factores VH correctos por tipo; el escalón de precios deja de asumir "fabricado" | Bajo |
| A3 | **Catálogo de acabados Op** como dropdown (desde la Hoja2 de Rafa) | Captura sin teclear, menos errores, acabados especiales marcados aparte | Medio |
| A4 | **Escalón de volumen afinado**: elegir nivel por cantidad y no mostrarlo en líneas calibradas (evita confundir) | Precio por volumen correcto y sin contradecir el precio de lista calibrado | Bajo |
| A5 | **Trazabilidad de insumo**: campo de clave ERP + fecha por insumo | Medidor de confianza real; saber de dónde salió cada precio | Bajo (dato: ver B1) |

## B. Lo que necesita DATOS (los pedimos ya)
| # | Mejora | Dato que falta | A quién |
|---|---|---|---|
| B1 | **Precios de material exactos** | Clave ERP vigente + último precio + fecha de los materiales que SÍ se usan (el catálogo mezcla claves viejas de 2013 con las vigentes) | Compras / Vicente |
| B2 | **Mano de obra real (horas × tarifa)** — el salto grande | Horas por operación (corte, soldadura, doblado, pintura, armado, empaque) + $/hora por centro | Producción |
| B3 | **Validación / medir error** | 2-3 órdenes cerradas por familia: consumo, horas y costo real | Edgar (comercial) + Daniel (costos) |
| B4 | **Indirectos defendibles** | Base real de reparto (qué cubre el ×3, sobre qué se reparte) | Finanzas |
| B5 | **Factores por modelo** (gamma 21.5, win 14.25…) y tiers (standard/high-end/flagship) | La tabla CG/CH de info_t_d_c, confirmada | Alba |

## C. Hallazgo honesto (2026-09-30)
Los precios de material de la app (lista Compras 2026-08-14) **ya están tan frescos
o más** que el catálogo ERP (muchas "últimas compras" son de 2013). → No hay un
upgrade de precios escondido; el problema no es que la app use precios viejos. El
salto de exactitud real está en **B2 (horas)** y **B3 (órdenes cerradas)**, no en
reimportar precios.

## Recomendación de secuencia
1. **En paralelo:** mandar B1/B2/B3 (datos) + construir A2 y A4 (rápidos, mejoran ya).
2. Luego **A1 (captura tipo Rafa)** — la mejora grande de código.
3. Cuando lleguen horas (B2) → activar el modo "horas × tarifa" (ya programado) y
   medir contra órdenes cerradas (B3). Ahí la app pasa de "buena" a "la mejor".
