# 95_PLANO_LECTURA_OPUS5 — lectura de plano real (§3/§8 visual, 2026-11-03)

Camino A (acotado-diverso) autorizado. 1 llamada opus-5/visión a `leer-plano` con un **plano arquitectónico real**
(`PLANO_HELIOS_N1.png`, 2559×1773). Cierra la parte VISUAL de mayor riesgo (no probada por texto): ¿la IA lee bien un plano?

## Resultado (HTTP 200, 73.6 s)
`ok:true`. `floorSpec` con: `envelope`, `grid_mm`, `zones`, `doors_mm`, `columns_mm`, `levels`, `source`, `validation`.
- **Métricas:** top_level 332.1 m², envelope 360 m², **8 zonas, 6 puertas**, columnas detectadas.
- **`validation.state: REVIEW_REQUIRED`** con 2 avisos `LOW_CONFIDENCE_ZONE` (zonas NIDO y TALLER). El pipeline **no afirma
  geometría de la que no está seguro**: la marca para revisión humana. Es la disciplina verify-first / OBSERVED-vs-INFERRED.
- **Cero economía** en la respuesta (`econ leak: []`) — una lectura de plano no trae costo/precio.

## Veredicto (parte visual de A)
**plano → floorSpec: PROBADO con un plano real.** La IA extrae envelope, zonas, puertas y columnas, y —lo importante— es
honesta sobre su incertidumbre (REVIEW_REQUIRED en vez de inventar zonas con confianza). De aquí sigue el acomodo (ya
certificado con validador independiente, `95_ACOMODO_RENDER_QA.md` + `95_ACOMODO_4859_ROOTCAUSE.md`).

## Lo que cierra y lo que falta de A
- **Cerrado hoy:** texto→despiece (opus-5, `95_TEXTO_A_DESPIECE_OPUS5.md`) + plano→floorSpec (opus-5, este doc). Las dos
  entradas visuales/IA de mayor riesgo, con evidencia real y bounded (2 llamadas opus-5 totales).
- **Falta para "foto→COSTO de un mueble":** una **foto real de un mueble** (en el repo sólo hay planos y capturas de app, no
  fotos de producto). Con una foto, corro analizar-mueble modo imagen → despiece → costo, cerrando el último hueco visual.

## Costo
2 llamadas opus-5 en total esta sesión (texto + plano), ~145 s. Gasto acotado, alto valor (dos pipelines visuales distintos
probados), en vez de 24 repeticiones de texto.
