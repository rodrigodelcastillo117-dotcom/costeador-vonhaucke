# Rescate del solver de acomodo (COT-P0-027b · 027c · 027e)

Rama `rescate/solver-acceso-027b`, creada desde `c3.4-seller-safe` @ `c8dd2b3` (lo que corre en producción como
`acomodar-espacio-recovery` v10). Trae a la rama principal el trabajo de la rama `audit/final-product-completion`
(que nunca se fusionó), portado con merge de tres vías sobre los cambios VH-092…VH-120 del solver.

## Qué estaba mal (medido, no supuesto)

Request real del navegador: Torre Sur por PDF, E2E del 2026-10-10 15:17:44Z (`bench/acomodo-calidad/fixtures/torre-sur-pdf-request.json`).

| Entrada Torre Sur | Sobre `c8dd2b3` (producción) | Con esta rama |
|---|---|---|
| PDF | 15/22, gana `center`, quedan fuera 2º bench + credenza + archivero | 21/22; la credenza se reporta DEMOSTRADA y explicada (puerta sin confirmar) |
| PDF con la puerta del despacho confirmada | — | 22/22 PASS, publicable |
| Dibujo | 15/22 | 22/22 PASS, publicable |
| Sólo m² | 22/22 con 2 sillas contra el muro (FAIL semántico) | 22/22 PASS, publicable |

## Causas raíz y arreglo

1. **El solver aceptaba sillas pegadas al muro.** `kitCabe` no exigía acceso; los candidatos completos caían en FAIL semántico y ganaba uno incompleto. Ahora el acceso forma parte del conjunto legal, con la misma geometría y el mismo umbral del juez.
2. **La "búsqueda con backtracking" era primer-ajuste voraz.** Si un kit no cabía, seguía adelante sin mover los anteriores. Ahora hay búsqueda completa con retroceso dirigido por cuarto; el primer-ajuste queda de último recurso.
3. **El ranking prefería menos muebles "limpios".** Comparaba PASS>REVIEW antes que la completitud. Ahora: fallas duras → fallas semánticas → completitud → revisiones → calidad. Un PASS con menos piezas sigue ganando a un FAIL con más.
4. **Un cuarto infactible degradaba a todos.** La búsqueda se resuelve por cuarto (componentes); si un cuarto no admite todo, se busca completo el mejor acomodo que deja fuera un solo kit.
5. **1 m de pasillo entre dos muebles de guardado lado a lado.** El validador duro siempre aceptó el adosado (hueco 0). El solver ahora también, sólo entre guardados y conservando libre el frente de cada uno.
6. **Guardado sin frente.** Credenza y archivero (`SUPPORT_STORAGE` suelto y `ANCHOR_STORAGE`) tienen topología `STORAGE`: respaldo al muro y frente con al menos 600 mm para abrir (provisional, versionado en el juez).
7. **Sólo giros de 0° y 90°.** Dos filas de una cara en un cuarto angosto obligaban a dejar sillas contra el muro; ahora se prueban 180° y 270°. La salida sigue emitiendo `rot` 0/90 (lo que leen cliente y validadores) más `kit_rot`.
8. **"No se encontró" presentado como imposible.** Cada pieza sin colocar lleva veredicto: `NO_CABE_DEMOSTRADO`, `NO_SE_ENCONTRO_SOLUCION` o `INFORMACION_INSUFICIENTE`. Si el cuarto no admite todo por la reserva de una puerta sin giro confirmado y sin esa reserva sí, el mensaje lo dice y pide confirmar la puerta.
9. **Huella de la credenza Eclipse 2100×200** (COT-P1-027e). `footprintDe` tomaba la "Tapa de registro" como cubierta. Orden de autoridad: producto → cubierta ≥300 mm → despiece → nombre con unidades; `huellaOrigen` y `huellaConflicto` viajan en la partida.

## Evidencia

- Banco congelado (55 casos): 49/49 factibles PASS, 6/6 imposibles sin PASS, 0 falsos PASS, 0 regresiones contra el motor anterior.
- Batería completa: 275 archivos, 2,250 pruebas en verde. `vite build` correcto.
- E2E en navegador con nube falsa: 29 aprobadas, 29 omitidas (las omitidas requieren servidor real o credenciales).
- Tiempo del pipeline sobre los requests reales: PDF 106 ms, Dibujo 25 ms, m² 43 ms.
- `deno check` no se pudo ejecutar en este entorno (falta `npm:@supabase/realtime-js` en node_modules); no se declara verde.

## Expectativas de prueba que cambiaron, y por qué

- `gap13Integracion` B, `multiCandidato` (2), `recoveryEdge` (3): afirmaban que el camino por defecto DEBÍA dejar sillas contra el muro. Era la documentación del defecto, no un resultado válido.
- `vh092_cotizacion757` VH-119b "5 de 6, el archivero no cabe": era un límite del solver. Ahora 6 de 6, credenza y archivero adosados sobre el mismo muro, frentes libres, sin encimes y sin fallas duras.

## Pendiente fuera de esta rama

- La copia `acomodar-espacio-recovery-rc` de la rama `claude/costing-app-architecture-psf02g` no recibe estos cambios hasta que esa rama los integre.
- E2E autenticado contra el servidor real (lab Torre Norte, golden 757, cotizarProyectos) tras desplegar.
