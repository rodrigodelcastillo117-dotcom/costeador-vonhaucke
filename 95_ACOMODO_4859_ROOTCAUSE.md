# 95_ACOMODO_4859_ROOTCAUSE — por qué el acomodo 4859 colisiona (§8, 2026-11-03)

Pregunta del directivo: "root-causar por qué el solver produjo la colisión de 4859 — ¿entrada mala o bug del solver?
El sistema debe detectar la colisión y explicar cómo resolverla, nunca esconderla."

## Qué pasa (reproducido determinísticamente)
Cotización 4859: oficina de 7 áreas, 23 piezas, programa confirmado. El estado guardado: `layoutEstado=FAIL`,
`layoutValidado=false`, `layoutEspacialValidado=false`.

Corriendo el **validador independiente** (`src/datos/acomodoInvariantes.js`) sobre el plan real guardado → **FAIL** con 2 fallas:
- `OUT_OF_BOUNDS p-1-1 @area2`
- `OVERLAP p-1-1 | p-7-5 @area2`

**La causa geométrica, exacta:** la pieza `p-1-1` mide **6000 × 1200 mm** y fue colocada **rotada 90°** (→ huella 1200 × 6000)
en **ÁREA OPERATIVA**, que sólo tiene **3200 mm de fondo**. Se sale 3800 mm (OUT_OF_BOUNDS) y su huella sobredimensionada
pisa la silla `p-7-5` (OVERLAP). Verificado: la MISMA pieza **sin rotar** (6000 de ancho en un área de 8000) **sí cabe** —el
problema es la rotación contra el fondo, no la pieza.

## Root-cause (NO es entrada mala; es colocación manual + punto ciego del auto-audit del solver)
1. **No es entrada mala del programa:** las áreas están bien formadas, las 23 piezas son costeables, el programa está
   confirmado. La geometría del cuarto es válida.
2. **La colocación de `p-1-1` es MANUAL:** `manual:true`, `provenance:"USER_CONFIRMED"`. Un humano la puso/confirmó ahí,
   rotada, donde no cabe.
3. **El solver del servidor (`kit-solver-multi-v1`) se auto-auditó PASS:** su propia auditoría dice "23 de 23 colocadas ·
   sin problemas geométricos". Honró la colocación manual (`strictPlacement:true`) y **no re-verificó bounds sobre las
   manuales** — ése es su punto ciego. (El solver SÍ tiene el chequeo correcto con rotación en `spatial-core.js`
   `usoDentroArea`/`usoInvadido`; el hueco es que no lo aplica a lo marcado manual/confirmado.)
4. **El validador independiente NO exime las manuales** → cazó el OOB y el OVERLAP → el sistema tomó el FAIL.

## Veredicto
- **La colisión NO se esconde.** El sistema la marca `FAIL` / `layoutEspacialValidado=false` y no publica. La arquitectura
  verify-first funciona: hay un validador independiente del solver y el estado final nunca es más verde que el peor de los dos.
- **Hay un defecto real (P1, no P0):** el auto-audit del solver puede reportar PASS sobre una colocación manual físicamente
  imposible. No produce un costo falso ni un layout válido falso (la red lo atrapa), pero el solver debería atraparlo él mismo.

## Cómo resolverla
1. **Blindado AHORA (hecho, client-side, sin deploy):** `src/datos/acomodo4859.test.js` fija que el validador independiente
   SIEMPRE caza esta colisión (OOB+OVERLAP de la pieza manual rotada). Si alguien relaja el validador para que exima las
   manuales, CI se pone rojo. La red de seguridad queda candada. (2 tests verde.)
2. **Fix del solver (edge, requiere deploy autorizado):** en `acomodar-espacio-recovery`, el auto-audit debe correr
   `usoDentroArea(area, rect, pieza, rot)` también sobre las colocaciones `manual`/`USER_CONFIRMED`, y reportar FUERA_AREA /
   colisión en vez de PASS. Es el mismo chequeo que el validador independiente ya hace bien.
3. **Fix de UX (cliente, mejora):** al mover/confirmar manualmente una pieza que queda fuera del área o rotada sin caber,
   avisar en el momento ("esta pieza no cabe aquí así rotada"), en vez de aceptarla y descubrirlo en la validación final.

## Estado
- Red de seguridad: **CERRADA y candada** (test de regresión permanente).
- Fix del solver: **PREPARADO/DOCUMENTADO**, requiere deploy de edge autorizado (no se despliega sin OK).
- `layoutEstado=FAIL` de 4859 es **correcto**, no un bug: el sistema está rechazando bien una colocación manual imposible.
