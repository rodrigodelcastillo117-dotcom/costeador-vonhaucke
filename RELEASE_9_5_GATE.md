# RELEASE 9.5 GATE · Operación Von Haucke (14-oct-2026)

**Regla de este gate:** un área llega a 9.5 solo si su comportamiento es correcto, la evidencia es reproducible y la
prueba **falla con el código anterior**. "No verificable" no cuenta como PASS.

| | |
|---|---|
| Rama | `claude/costing-app-architecture-psf02g` (PR #37) |
| Producción (cliente) | `c3.4-seller-safe` @ `c8dd2b3`. **Sin cambios.** |
| Link RC | `dpl_HPsG8T32RJd9kzswNm6sD7odpvY1` (commit bf096aa, todo integrado) |
| Edge RC | `costear-servidor-rc` @ 6d1cd13 |
| SQL aplicado en producción en esta operación | **ninguno** (vh146c ya estaba aplicada) |

## 1. Veredicto

**NO-GO a producción.** No es por calidad del código de la rama, que mejora a producción en todo lo medido. Es
porque el negocio **no puede emitir en firme** sin estas condiciones:

1. Aplicar SEG-01 v1, SEG-01c (modo preparado), VH-100, VH-148b y P1-03b, en ese orden (autorización de Rodrigo; ver `docs/auditoria/RESPUESTA_REAUDITORIA_OP95_20261014.md`).
2. Cargar el reporte de costo de Intelisis por clave (Compras). Hoy 1,931 de 1,931 productos de lista no tienen
   costo oficial.
3. Que una persona de Dirección apruebe precios con su cuenta, para que exista el primer costo VALIDADO real.
4. Tomar las decisiones D1 y D2-Producción.

## 2. Matriz antes/después (escala 1–10)

"Antes" es la MATRIZ_V3 del 13-oct. Las notas sin medición se marcan como **estimado**.

| Área | Antes | Después | Evidencia | ¿≥ 9.5? | Por qué no más |
|---|---|---|---|---|---|
| SEG-01: emisión sin confiar en el cliente | 4 (gap abierto) | **7.5** (reauditoría: 5.5 con SEG-01b) | **SEG-01c** sustituye a SEG-01b. Vínculo server-side costeo→(cotización, partida) de un solo uso, frescura de precios, CERTIFICADO⇒costo>0, modo `preparado` por omisión. Replay **reproducido** con SEG-01b (ALLOWED/ALLOWED) y bloqueado con SEG-01c. 19 pruebas más 1 de modo estricto como sesión real. | No | Sin aplicar. El primer VALIDADO real depende de Rodrigo. Falta un E2E del flujo costear→vincular→emitir con la base real. |
| Estado del costo (incompleto/preliminar) | 6 | **9** | Antes, el servidor devolvía `incompleto` con 0 motivos en el librero 5×8; ahora `preliminar` con 5 motivos (smoke vivo, exp. 159). 7 pruebas del estado, invariante "no certificado ⇒ con motivo". | No | Falta verlo en más familias vivas. |
| P1-03: aprobación del precio exacto | 3 (regex por e-mail) | **8.5** (reauditoría: 7.8) | P1-03b (PROPUESTA): la vista expone `precio_id` y la Edge lo usa; la re-elección en JS queda como respaldo marcado en la traza. PGlite con la vista de producción (incluye el empate real 287). | No | Sin aplicar. 0 aprobaciones humanas reales. |
| VH-100: costo oficial de líneas | 2 | **5** | Migración convertida en PROPUESTA (estaba en riesgo de `db push`). Hueco de rol por `user_metadata` cerrado. Historial y fin de la escritura directa. 6 pruebas que fallan con la versión anterior. | No | Falta el dato: 1,931/1,931 sin costo, 116 sin clave. **Bloqueado por Compras.** |
| VH-148: concurrencia (409) | 5 | **7.5** (reauditoría: 6.5) | VH-148b más **VH-148d**: `vincular_cotizacion` sin versión retirada (verificado que nadie la llama) y nueva sobrecarga con CAS (40001/22004). 73 pruebas; 15 fallan sin la propuesta. | No | Sin aplicar. La espera real entre dos conexiones y PostgREST real no se probaron (PGlite tiene una sola conexión). |
| Costear motor (paridad, unidades, $0) | 7 | **8** | Paridad al centavo en vivo ($6,614.24; difícil $7,362.69). Hoja de control 6/6. 3,007 pruebas. | No | Holdout fuera de muestra no corrido (no hay datos nuevos). In-sample: MAPE 33.2 %, sesgo +18.9 %. |
| Holdout Intelisis (preparación) | 0 | **8.5** (reauditoría: 6.5) | **Holdout v2**: huellas de base con todas las columnas que mueven selección o certificación, md5 de la vista y de las RPC del catálogo, versión+SHA de las Edge. `--verificar` sin huellas frescas devuelve exit 2 (NO VERIFICADO). 7 pruebas. | n/a | No congela el comportamiento del proveedor de IA; el `model_id` se registra por llamada (`ai_eventos`). Faltan los datos nuevos de Compras. |
| ERP / precios | 6 | 6 | Medido: 1,763 aprobados por QA, 30 por `reconciliacion`, 0 por personas | No | Datos de origen sin sanear; D1 sin firmar. |
| Cotizar (propuesta/emisión) | 3 | 3 | Sigue bloqueada por VH-100 | No | No depende del código. |
| Cotizar (acomodo) | 6 | **7** | APP LT 10U (6000×1200) con el solver real: 7 pruebas nuevas (cabe o no cabe por geometría, 0 encimados, 0 fuera de área); texto en singular corregido | No | C5 (fuera de cuarto) y C2 parcial siguen abiertos (MATRIZ_V3); falta reverificar con plano real. |
| Cocrear | estimado 7 | estimado 7 | sin cambios en esta operación | No | No reverificado. |
| Renders | 7 | 7 (medido) | `render_eventos`, 14 días: de 63 con veredicto QA, 43 `QA_PASS` (68 %) y 20 rechazados (`layout_match`, `geometry_match`, `extra_objects`). Otros 72 eventos sin veredicto. | No | Un tercio de los renders evaluados no coincide con el producto, aunque la compuerta lo rechaza correctamente. La fidelidad sin referencia no es certificable. |
| Council (Anthropic + Gemini) | estimado 7 | **4 (medido)** | Desde el 6-oct, Anthropic no respondió ninguna vez: `max_tokens` el 6-oct; el 13-oct se abortó a los 14 s. Su latencia real es de 29–43 s. Todo sale SINGLE_PROVIDER (Gemini). La degradación sí se etiqueta bien. | No | Defecto de configuración (presupuesto 14–22 s contra 29–43 s). Arreglarlo exige tocar la Edge de producción `voni-council`: **requiere autorización**. |
| Biblioteca / datos QA | estimado 6 | **8** | Los 80 más recientes eran todos de QA, así que los reales no aparecían. Filtro con interruptor y límite de 400. PROPUESTA de etiquetado de 154 ids exactos con 4 pruebas PGlite. | No | Etiquetado sin aplicar. |
| Seguridad (advisors) | 7 | **8** | 0 ERROR. 10 SECURITY DEFINER revisadas, todas con chequeo de rol interno. Escritura directa a la economía oficial detectada y cerrada (en PROPUESTA). | No | `qa-direccion` tiene rol `direccion` en `permitidos`: pasa `puede_certificar_costo()`. Mitigado en la Edge y en SEG-01c, no en la base. 7 funciones con `search_path` mutable. |
| Rendimiento | estimado 7 | 7 | Advisors: solo INFO (3 llaves foráneas sin índice, 13 índices sin uso) | No | Sin medición de tiempos de usuario en esta operación. |
| Pruebas, CI y E2E | 39 archivos STATIC GUARD; **CI E2E rojo desde antes de la operación** | **8** (reauditoría: 7) | CI de GitHub **verde** en `df9a21a` (verify + E2E): el mock refleja VH-035c, que está en producción. Script de depuración sin aserciones eliminado. E2E local: 71 pasan, 0 fallan. 137→118 string-assert. | No | 118 static guards siguen. "Refactor puro" no está demostrado (las mutaciones miden sensibilidad, no equivalencia). |

**Ninguna área llega a 9.5 medida y defendible.** Las que más se acercan (estado del costo y preparación del
holdout) dependen de datos o de decisiones que no son de código.

## 3. Evidencia por gate (reproducible)

| Gate | Cómo se reproduce | Resultado |
|---|---|---|
| Suite completa | `npx vitest run --exclude '.claude/**' --exclude 'node_modules/**'` y lo mismo con `VERCEL_ENV=preview CARRIL_RC=si` | 339 archivos, 3,139 pruebas (bf096aa), ambos entornos; `vite build` OK |
| SEG-01c adversarial | `npx vitest run supabase/tests/seguridadGateEmisionSnapshot.test.js -t "SEG-01c"` | 19/19. Replay con SEG-01b reproducido como ALLOWED en el arnés real. |
| VH-100 | `npx vitest run supabase/tests/cargarCostosOficiales.test.js`; con `VH100_MIG=<archivo viejo>` fallan 7 | 12/12 |
| Estado y precio exacto | `npx vitest run src/datos/autoridadCosteoServidor.test.js` | 20/20 |
| Smoke vivo | `lab/rescate/preview_link/librero_5x8_post_seg01b/` y `librero_5x8_integrado_bf096aa/` | 6/6, paridad al centavo, guardar y reabrir. Hubo una corrida FAIL intermedia (2649de8) por una regresión propia en la biblioteca, ya corregida. |
| Edge RC | `scripts/edge_boot_check.sh costear-servidor-rc` y el workflow `deploy-edge.yml` run 38509149245 | arranca; despliegue OK |
| Holdout v2 | `node scripts/congelar_holdout.mjs --verificar --db <huellas.json> --edges <edges.json>` | Sin `--db`/`--edges`: exit 2 (NO VERIFICADO). Ver `lab/costear/holdout_intelisis/`. |

## 4. Hallazgos nuevos al ejecutar lo que antes solo se leía (visibles con `it.fails`, sin tocar producción)

- **P1 latente · medio centavo de diferencia entre JS y SQL.** `precioConDescuento(1000.10, 5)` da **950.09**, pero
  `emitir_revision_v2` (desplegado) exige **950.10** y rechaza. Hoy no se dispara porque el descuento es global.
  Saldrá cuando una línea traiga descuento propio. **Decisión:** qué regla de redondeo manda, y alinear la otra.
- **P2 · la sombra cliente↔servidor redondea al peso el lado cliente.** El `diff` es distinto de 0 aunque la
  paridad sea exacta. Solo afecta el diagnóstico.
- **P2 · costo 0 "certificado".** Si cliente y servidor dicen costo 0 y estado `certificado`, se agrega la partida.
  El servidor no debería producirlo (0 sin dato marca incompleto), pero el cliente no lo bloquea por su cuenta.


## 5. No verificable en esta operación (y por qué)

- **Primer costo VALIDADO real:** requiere que una persona de Dirección apruebe precios. La cuenta QA no puede ni
  debe hacerlo.
- **Holdout fuera de muestra:** no hay reportes nuevos de Intelisis.
- **Emisión E2E de líneas de catálogo:** bloqueada por VH-100 (dato).
- **Council con ambos proveedores:** requiere desplegar `voni-council` (producción) con otro presupuesto o modelo.
- **SEG-01c, VH-148b/d, VH-100 y P1-03b en producción:** sin autorización para aplicar.

## 6. Decisiones pendientes (de Rodrigo / Dirección / Compras / Producción)

1. Autorizar SEG-01c en modo preparado y, después del despliegue de la Edge y el cliente, pasarlo a estricto (y elegir: estricto, o fecha de transición `legacy_sin_costeo_hasta`; hay 27 cotizaciones con
   folio y renglones sin costeo del servidor).
2. Autorizar VH-148b con VH-148d (paso 1; el paso 2 `vh148c` solo cuando no quede ningún cliente viejo abierto) y VH-100.
3. D1: vigencia de 24 meses, y firma por política o precio por precio.
4. ¿Compras puede aprobar precios, o solo Dirección?
5. Umbral de aceptación del holdout (propuesta: MAPE ≤ 10 %, sesgo ±5 %, ≥ 80 % dentro de ±10 %).
6. Council: autorizar el cambio de presupuesto o modelo de Anthropic en la Edge de producción.
7. D2: ratificación de Producción (merma de corte del tubular).
8. Etiquetar los 154 expedientes QA (PROPUESTA lista).
