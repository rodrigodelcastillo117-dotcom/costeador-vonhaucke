# 95_P0COSTEO_LATENCIA — latencia y estabilidad de P0.COSTEO (P1, 2026-11-03)

Medición EN VIVO contra `costear-servidor` v18 (prod), cuenta Dirección, despieces reales con insumos
priceados (ptr, melamina-16, ptr-14, perfil-aluminio). 15 llamadas por tamaño. Sin IA de pago (motor + catálogo).

## Resultados (segundos, time_total de curl)
| N componentes | p50 | p95 | p99 | max | errores | timeouts |
|---|---:|---:|---:|---:|---:|---:|
| 1  | 1.329 | 4.595* | 4.595* | 4.595 | 0 | 0 |
| 10 | 1.540 | 1.754 | 1.754 | 1.754 | 0 | 0 |
| 30 | 1.523 | 1.817 | 1.817 | 1.817 | 0 | 0 |
| 50 | 1.555 | 1.725 | 1.725 | 1.725 | 0 | 0 |

*El p95/p99 de N=1 es un **cold-start** del primer llamado del lote; en caliente la cola es ~1.7-1.8 s.

## Hallazgos
- **Latencia PLANA de 1 → 50 componentes** (~1.3-1.6 s p50): el motor NO se degrada con la complejidad del
  despiece. El costo de tiempo lo domina cold-start + auth + carga de catálogo, no el trabajo por componente.
- **0 errores y 0 timeouts** en 60 llamadas reales.
- Único punto de atención: **cold-start de edge** (~4.6 s la primera vez). Es arranque de la Edge Function,
  no el costeo; mitigable con warmup/keep-alive si molesta en piloto.

## SLO propuesto (sujeto a aprobación de Dirección — no existe uno oficial)
- **p95 (en caliente) < 3 s**, **p99 < 5 s** (tolera cold-start), **tasa de error < 1 %**, **0 costos oficiales
  falsos ante fallo** (ya garantizado por fail-closed). Con la medición actual se cumple holgadamente en caliente.

## Alcance / lo que falta para cerrar P0.COSTEO del todo
- Medido: happy-path a 1/10/30/50, latencia y errores. **PASA.**
- Resiliencia adversarial (fallo de catálogo, fallo de IA a mitad, interrupción de conexión, guardado
  concurrente, cálculo incompleto): parcialmente cubierta por tests unitarios de resiliencia + VH-148 (conflicto
  409) + fail-closed (BLN-09/VH-017). Un caos-test en vivo (matar catálogo/IA a propósito) NO se corre contra
  prod; quedaría para staging o un carril aislado. **Una operación fallida nunca produce un costo oficial falso**
  (verificado por los gates fail-closed), que es el invariante crítico del directivo.
