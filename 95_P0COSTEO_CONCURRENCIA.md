# 95_P0COSTEO_CONCURRENCIA — concurrencia y fail-closed bajo carga (§12, 2026-11-03)

Pruebas EN VIVO contra `costear-servidor` (prod), cuenta Dirección, mismo payload determinista (2 componentes candidatos →
el servidor responde fail-closed). Mide estabilidad y, sobre todo, que **ninguna carrera produzca un costo oficial falso**.

## Resultados (curl concurrente desde el contenedor)
| Concurrencia | wall | ok 200 | fallos | p50 | p95 | min | precioVenta≠null |
|---|---:|---:|---:|---:|---:|---:|---:|
| N=1 (serie) | 1.59 s | 1/1 | 0 | 1.58 s | 1.58 s | 1.58 s | **0** |
| N=5 | 3.44 s | 5/5 | 0 | 3.16 s | 3.43 s | 3.06 s | **0** |
| N=30 | 13.87 s | 29/30 | 1 | 13.34 s | 13.81 s | 9.98 s | **0** |

## Lectura honesta
- **Invariante crítico PROBADO:** en 36 llamadas (incl. la 1 que falló), **0 devolvieron `precioVenta` no nulo**. Todas
  `estado:incompleto`, `costoUnitario:0`. Bajo concurrencia, ante material sin confirmar, el servidor **nunca inventa un
  precio** ni deja pasar un costo oficial. El fail-closed server-side aguanta la carga. Éste es el requisito de seguridad de §12.
- **Latencia bajo concurrencia: CONFUNDIDA por el entorno, NO concluyente.** Crece ~lineal (1→1.6 s, 5→3.2 s, 30→13 s) y
  todas las requests de un lote se agrupan cerca del mismo tiempo alto (N=30 min=9.98 s). Eso es **serialización**, pero este
  contenedor enruta TODO su tráfico saliente por **un solo túnel de proxy**, así que no puedo distinguir si serializa el
  proxy/túnel o el edge. Una medición limpia necesita **clientes independientes en staging aislado** — justo lo que §12 pide.
- **1 fallo en N=30:** real, pero igual de confundido (pudo ser el túnel). No devolvió precio (fail-closed intacto).

## Veredicto §12
- **Fail-closed bajo concurrencia: CERRADO** (0 costos falsos en 36 llamadas, incl. una fallida).
- **SLO de latencia bajo concurrencia: SIN MEDIR-pleno.** No se declara cierre formal: requiere load test en staging aislado
  con clientes independientes (varios orígenes), p50/p95/p99 y tasa de error reales, y un SLO aprobado por Dirección. La
  latencia EN SERIE sí está medida y es buena (p50 ~1.5 s, ver `95_P0COSTEO_LATENCIA.md`).

## Lo que falta para cierre formal de P0.COSTEO (decisión/infra humana)
- Carril de staging aislado para caos-test (matar catálogo/IA, cortar red, reintentos) sin tocar prod.
- SLO oficial de Dirección (propuesto: p95 serie <3 s; concurrencia por definir con medición limpia; error <1%; **0 costos
  oficiales falsos** — este último ya cumplido).
