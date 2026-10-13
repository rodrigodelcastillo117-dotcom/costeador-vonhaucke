# Reproceso determinista (2026-10-13)

Mismo despiece exacto de la ronda 1 (el `req` de cada `8-dto-servidor.json`, tal como lo costeó el servidor) pasado por
reglas de casa + motor con el código ANTES (`7e8129e`) y DESPUÉS (`7ca3241`) de las correcciones VH-179…183, con el
catálogo local (`INSUMOS_SEMILLA`). Aísla el efecto de las correcciones: la lectura de la IA es la misma.
No reproduce VH-181/182 (actúan al mapear la respuesta de la IA, que el laboratorio guardó recortada a 6,000 caracteres);
ésas se prueban con las respuestas reales en `src/datos/materialMatchCiegoErp.test.js` y en la ronda 3.

Cambios: ATCUBS45ABS material $1,335.60 → $667.80 (1500×600 = ½ hoja, como Intelisis); ATFAL150ABS −$28.31;
credenza −$103.19 (canto duplicado integrado); escritorio L +$150.75 (pieza de 1500 de lado mayor ahora cobra ½ hoja
por la regla de Producción, antes ⅓ por rejilla). El resto no cambia: su diferencia contra el ERP no viene del despiece.
Script: `replay2.harness.js` (copiarlo como `src/zz_replay.test.js` para correrlo; fuera de la suite a propósito) (RAIZ, CASOS, SALIDA por variables de entorno).
