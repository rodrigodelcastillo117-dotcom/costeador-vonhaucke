# OPERACIÓN RESCATE · COTIZAR — Matriz viva de defectos

**Rama:** `audit/final-product-completion` · **HEAD código:** ver `git log` (commits `5c0d500` bloques 1-2 → `fix(cotizar): COT-P0-009 CAUSA DEMOSTRADA`)
**E2E autenticado corrido por Rodrigo (2026-10-10):** `programaP01` ✅ (5c0d500) · `torreSur` ✅ ×2 (12:28Z con 5c0d500 → capturó la causa; 13:18Z con 605c3c4 → 0 warns, anclas costeadas).
**Corrida 13:18Z — lo que la IA pidió:** bench App LT **10u** 1500 ivory · Eclipse escritorio 2100 D walnut · Eclipse credenza 2100 D walnut · banco: WIN ×**10**, ALPHA ×1, CONCERTO ×2, `mj-1200x1200-melamina` ×1 (**4 personas**), SONATA ×**4**, `rec-2420x830`, gaveta Mox ×**10** (banco), archivero Modulor. **El plano tiene 8 puestos y una sala de 10 sillas** → COT-P0-003/006 confirmados en navegador real (bloque 3).
**Caso golden:** plano ARQ-01 "Oficinas Corporativas Torre Sur" (15.0 × 8.8 m ≈ 104 m²; fixture `e2e/fixtures/plano-torre-sur-arq01.pdf`)
**Evidencia local:** vitest **2201/2201** (260 archivos) · vite build ✅ · `deno check`: ⚠️ falla por entorno (`npm:openai` tipos desde `jsr:@supabase/functions-js` edge-runtime.d.ts; no es el código de la función) · ESLint: sin config migrada (no corre).
**Prod:** `5a38d2e` (sin tocar) · **Edge `cotizar-texto` desplegada:** v10 (`ezbr_sha256 9c3c84f4…`), `leer-plano`/`leer-plano-core` sin cambios.
**NO ejecutado por Claude:** ningún E2E autenticado (Claude no ingresa credenciales contra backend remoto). Specs listos: `TEST_EMAIL=… TEST_PASSWORD=… npx playwright test e2e/torreSur.e2e.js e2e/programaP01.e2e.js`.

Estados: `OPEN` · `REPRODUCED` · `FIXED / TESTING` · `PASS CERTIFICADO` · `REVIEW_REQUIRED` · `BLOCKED` · `DESCARTADO CON EVIDENCIA`.
Regla: **ningún `PASS CERTIFICADO` sin E2E autenticado real.** Hoy no hay ninguno.

---

## A. Los cuatro "No pude costear" (tabla exigida) — CAUSA DEMOSTRADA

**Evidencia:** E2E real `e2e/torreSur.e2e.js` (qa-direccion, 2026-10-10 12:28Z, PDF ARQ-01) → `e2e/evidence/torre-sur-cotizar-texto.json`. La edge `cotizar-texto` v10 devuelve **`ruta:"applt/banca_doble"`** (clave de línea + id de producto fusionados con `/`) y **`producto:"Banca doble App LT 10 usuarios"`** (nombre descriptivo). `LINEAS_REG["applt/banca_doble"]` no existe → `costearItem` → `null` → "No pude costear". **Una sola causa para los 4.** Origen en la edge: el schema v10 perdió las descripciones de campo (`ruta: clave EXACTA`, `producto: id EXACTO`) y la regla 1 dice literalmente "ruta/producto". RED: 5 tests fallan en `5c0d500`; GREEN en `HEAD`.

| # | Entrada original (payload IA real) | Causa demostrada | Producto correcto | Identidad | Precio | Reparación | Prueba | Resultado |
|---|---|---|---|---|---|---|---|---|
| 1 | `ruta:"applt/banca_doble"`, `producto:"Banca doble App LT 10 usuarios"`, largo 1500, usuarios 10, biombo cristal, color monarca-tx | ruta fusionada → clave inexistente | `applt / banca_doble` 1500×1200, **10u** (escalón real, `precioProvisional:false`) | sin clave de catálogo (`precioReal:false`, modelo) | modelo (Dirección) · Ventas: pendiente de precio autorizado (fail-closed) | `resolverRutaProducto` separa `/`; el id de la ruta manda | `cotizarRescate` "PAYLOAD REAL" (RED en 5c0d500 → GREEN) | **FIXED / TESTING** (E2E con el fix: pendiente de re-correr) |
| 2 | `ruta:"eclipse/escritorio"`, `producto:"Escritorio Directivo Eclipse 2.10 m"`, 2100, mano D, finish walnut | ídem | `eclipse / escritorio` 2100 D **walnut** (no se sustituye el acabado) | clave de catálogo → Producto Maestro (`producto_id/version/lista_precio_item`) para todos los roles | **autorizado (catálogo)** | ídem | ídem | **FIXED / TESTING** |
| 3 | `ruta:"eclipse/credenza"`, `producto:"Credenza Eclipse"`, 2100, D, walnut | ídem | `eclipse / credenza` 2100×600 D walnut | clave → Producto Maestro | **autorizado (catálogo)** | ídem | ídem | **FIXED / TESTING** |
| 4 | `ruta:"mox/pedestal"`, `producto:"Gaveta pedestal Mox"`, ×10, frentes melamina | ídem (en la corrida de Rodrigo del día anterior el 4º era la mesa App LT 2100; en esta corrida la IA sacó la mesa del BANCO `mj-1200x1200-melamina` 4 personas y la gaveta cayó) | `mox / pedestal` ×10 | según catálogo Mox | según catálogo | ídem | ídem | **FIXED / TESTING** |

**Consecuencias observadas en la misma corrida (nuevos defectos, no causas de 009):** (a) la IA pidió **10** usuarios/WIN/gavetas donde el plano tiene **8** puestos (el texto del formulario de Voni viene de `programaDelPlano(areas)`, no del `observed_program`) → COT-P0-003; (b) la mesa de juntas la tomó del BANCO (`mj-1200x1200`, 4 personas, 4 SONATA) en vez de App LT 2100 para 6/10 → COT-P0-006; (c) 4 de 11 items quedaron como partidas PENDIENTES en navegador real (§4 del E2E pasó: nada se perdió) → COT-P0-008 funciona E2E.

**Edge v11 candidata (repo, NO desplegada):** descripciones de campo restauradas + regla 1 explícita (`supabase/functions/cotizar-texto/index.ts`). Requiere autorización de Rodrigo para desplegar; mientras, el cliente tolera el formato v10.

---

## B. Matriz de los 42

| ID | Sev | Causa demostrada | Archivo | Fix | Test RED | Test GREEN | E2E | Estado |
|---|---|---|---|---|---|---|---|---|
| COT-P0-001 plano sin inventario | P0 | No investigado en este corte (fuera del bloque 1-2) | leer-plano(-core), floorPlanReader | — | — | — | — | OPEN |
| COT-P0-002 8 puestos → 1 | P0 | No reproducido aquí; parche de ChatGPT (edfb13e) **no verificado** | espacio.js, entendido.js | — | — | — | — | OPEN |
| COT-P0-003 programas contradictorios | P0 | Confirmado parcialmente: brief dice juntas **6** (formulario `ProgramaProyecto` ← `programaDelPlano(areas)`), observado dice **10** (plano: 10 sillas en óvalo). Frontera: áreas vs observed_program | ProgramaProyecto.jsx:138, programaDelPlano.js | — | — | — | — | REPRODUCED (parcial) |
| COT-P0-004 identidad se pierde en `partidasDeItemsIA` | P0 | **Sí**: el mapeo elegía campos; `producto_id/version/source_ref/lista_precio_item_id/zone/functional_group` morían. Además `conIdentidadV2` sólo corría en seller-safe | App.jsx:684, lineas.js | `soloSiExiste(...)` conserva identidad+topología+pendientes; identidad en todos los roles | cotizarRescate "identidad" (antes: `producto_id` undefined en Dirección) | ✅ | ✅ torreSur §5 (Eclipse con `producto_id` en localStorage tras armar y tras refresh) | **PASS CERTIFICADO** (alcance: partida creada + recarga; propuesta/emisión OPEN) |
| COT-P0-005 Eclipse 2.10 `NO_CANONICO` | P0 | **Sí**: `ESCRITORIOS = BANCO.filter(esc-/ger-/dir-)` (catalogoCanonico.js:95); la línea Eclipse no está en BANCO | resolverPrograma.js, programaRealDelPlano.js | Puente por identidad EXACTA: pendiente cubierto si existe partida de línea con misma ruta+producto+medidas (`cubrirPendientesConLinea`); `requested_route/product` viajan en el pendiente. **No** se re-resolvió contra Producto Maestro dentro del resolver (orden de autoridad 1-5 del mandato): pendiente | programaRealDelPlano.test.js "RESCATE" (RED: pendiente+bloqueado) | ✅ (cubierto, apply del bench desbloquea; otro largo/producto/sugerida NO cubren) | pendiente | FIXED / TESTING (parcial: orden de autoridad completo OPEN) |
| COT-P0-006 mesa de juntas no canónica | P0 | Misma causa que 005 (`JUNTAS = BANCO mj-*`); `MESA_SOLICITADA_NO_CANONICA` para App LT 2100 | ídem | mismo puente (juntas con `requested_route/product`) | — (sin test específico de juntas) | — | — | FIXED / TESTING (sin test propio) |
| COT-P0-007 `NO_CANONICO` sin salida | P0 | **Sí**: `requiereRevision = … \|\| pendientes.length>0` (observado) e `incompletos` → `propuestaBloqueada` → committed=false y sin acción. **Gate P0.1 NO eliminado**: se retractó mi 1efe78c (volvió fail-closed) | programaRealDelPlano.js:713/736, Voni.jsx | preview ≠ commit (`previewAplicacionPrograma`), texto "cómo se resuelve", cubiertos por línea | observedPipelineIntegracion P0.1 (ahora exige bloqueo) | ✅ | ✅ programaP01 2026-10-10 (botón disabled, preview visible, sin write parcial, persiste tras refresh) | **PASS CERTIFICADO** (gate+preview; "cubierto por línea" sin E2E propio) |
| COT-P0-008 no encontrados desaparecen | P0 | **Sí**: `especiales/sinCostear/sinPrecio/noEncontrado` sólo texto; `continue` | CotizadorIA.jsx | `partidaRequerimientoPendiente` (precio null, `requiere_costeo`, motivo, tipo) para los 5 caminos | cotizarRescate "punto 4" | ✅ | ✅ torreSur corrida 1 (12:28Z, código 5c0d500): 4 items sin costear sobrevivieron como partidas pendientes, precio null, refresh sin pérdida | **PASS CERTIFICADO** (alcance: Cotizar+recarga; propuesta/emisión con pendientes OPEN) |
| COT-P0-009 cuatro "No pude costear" | P0 | **DEMOSTRADA** (tabla A): la IA fusiona `linea/producto` en `ruta` | lineas.js, CotizadorIA.jsx, edge v11 candidata | `resolverRutaProducto` separa `/` | ✅ 5 tests RED en 5c0d500 | ✅ | ✅ re-corrida 2026-10-10 13:18Z con `605c3c4`: **0 warns**, bench/Eclipse escritorio/credenza costeados, identidad PM en Eclipse (assert §5) | **PASS CERTIFICADO** (alcance: costeo de anclas en Cotizar; acomodo/PDF fuera) |
| COT-P0-010 fuzzing insuficiente | P0 | Cierto: fuzz cubre params válidos, crudos inválidos y checks; **no** cubre combinaciones multi-param, cantidades extremas, catálogo incompleto, respuestas IA truncadas | cotizarRescate.test.js | fuzz ampliado parcialmente (crudos inválidos) | — | — | — | REPRODUCED (ampliación pendiente) |
| COT-P0-011 `configDesde` sustituye | P0 | Confirmado en código (más cercano + `avisos` texto). Ahora `escalado`/`precioProvisional` quedan como DATO cuando hay extrapolación | lineas.js | parcial | cotizarRescate "punto 5" | ✅ | — | FIXED / TESTING (parcial: largo/fondo/mano ajustados siguen sólo en `avisos`) |
| COT-P0-012 extrapolación por usuario | P0 | Confirmado; ahora marcada `precioProvisional:true` + `escalado{puestosPedidos, puestosDelEscalon, precioPorPuesto}`; `precioReal:false` | lineas.js | marca, no bloqueo de emisión (pendiente gate de emisión) | ✅ | ✅ | — | FIXED / TESTING (parcial) |
| COT-P0-013 módulos vs usuarios | P0 | Candado `candadoUsuarios` ya existía; no re-verificado E2E | lineas.js | — | — | — | — | OPEN |
| COT-P0-014 histórico como autorizado | P0 | No investigado en este corte | banco.js, precioAutorizado.js | — | — | — | — | OPEN |
| COT-P0-015 costo desconocido = 0 | P0 | **Sí**: `partidaBanco.costoUnitario = 0` | CotizadorIA.jsx:135 | `null` + `costoDesconocido:true`; consumidores revisados (`conCosto` filtra `>0 && !deBanco`) | — | 2201 verdes | torreSur §4 | FIXED / TESTING |
| COT-P0-016 fuentes VH no usadas | P0 | Parcial: identidad PM ahora en todos los roles; resolución server-side canónica no hecha | — | — | — | — | — | OPEN |
| COT-P0-017 sillas duplicadas | P0 | No reproducido aquí (conciliador de ChatGPT 92aa01d **no adoptado**: compara nombre/cantidad) | — | — | — | — | — | OPEN |
| COT-P0-018 recepciones duplicadas | P0 | No reproducido aquí | — | — | — | — | — | OPEN |
| COT-P0-019 sillas mal clasificadas | P0 | No reproducido | entendido.js | — | — | — | — | OPEN |
| COT-P0-020 gavetas excedentes | P0 | Síntoma en captura ("8 pedestales sin escritorio") es **consecuencia** de 009 (sin bench); desaparece si el bench se cuesta. Sin verificar | coherenciaPrograma.js | — | — | — | — | OPEN (dependiente de 009) |
| COT-P0-021 dependientes al privado equivocado | P0 | Confirmado en código: `requirements.privados[0]` (programaBrief.js:121-125) | programaBrief.js | — | — | — | — | REPRODUCED (código) |
| COT-P0-022 REVIEW_REQUIRED bloquea todo | P0 | No trabajado | — | — | — | — | — | OPEN |
| COT-P0-023 FloorSpec obsoleto | P0 | No trabajado | — | — | — | — | — | OPEN |
| COT-P0-024 puertas del dibujo | P0 | No trabajado | DibujarPlano.jsx | — | — | — | — | OPEN |
| COT-P0-025 acomodo recibe muebles sin ancla | P0 | Síntoma captura ("Hay 8 sillas operativas pero no hay bench") = rechazo **correcto** de `validarCoherenciaPrograma` dado 009 | coherenciaPrograma.js | — | — | — | — | OPEN (dependiente de 009) |
| COT-P0-026 recomendados no se colocan | P0 | No trabajado | — | — | — | — | — | OPEN |
| COT-P0-027 módulos grandes | P0 | No trabajado | — | — | — | — | — | OPEN |
| COT-P0-028 solver no explica | P0 | No trabajado | — | — | — | — | — | OPEN |
| COT-P1-029 texto invisible "Por agregar" | P1 | **Sí**: `Voni.jsx:366` sin `color` sobre `#eef6f3`; tema oscuro hereda blanco (captura) | Voni.jsx | color explícito `#1c2a26` + `data-testid` | programaP01 mide `getComputedStyle().color ≠ rgb(255,255,255)` | ✅ | ✅ programaP01 2026-10-10 | **PASS CERTIFICADO** (tema por defecto; claro/móvil no medidos) |
| COT-P1-030 promete más de lo detectado | P1 | No trabajado (parcial: "se aplicará al resolver lo pendiente") | Voni.jsx | — | — | — | — | OPEN |
| COT-P1-031 renglones ≠ muebles | P1 | No trabajado (parcial: "Agregué N" ya excluye pendientes y los cuenta aparte) | CotizadorIA.jsx | — | — | — | — | OPEN |
| COT-P1-032 contesta varias veces | P1 | No trabajado | — | — | — | — | — | OPEN |
| COT-P1-033 pantalla inicial | P1 | No trabajado | — | — | — | — | — | OPEN |
| COT-P1-034 recuperación ante errores | P1 | Parcial: pendientes ahora dicen "cómo se resuelve"; `NO_CANONICO`/`REVIEW_REQUIRED` siguen visibles como códigos | Voni.jsx | parcial | — | — | — | OPEN (parcial) |
| COT-P0-035 Edge ≠ repo | P0 | **Sí** (v10 desplegada vs repo anterior). Diferencias: v10 **filtra `sugerido:true`** server-side; regla 9 pasó de "proponer acompañantes" a "cero extras" + 9-bis (sala de juntas ⇒ mesa+N sillas `sugerido:false`); reglas 10-12 nuevas (no preguntar alternativas, aclaración posterior gana, cierre tras 2 rondas); respuesta añade `rondasAclaracion`/`sugerenciasDescartadas`. Regresión analizada: el cliente sigue leyendo `sugerido` (no-op con v10); el formulario de Voni lista sillas/gavetas explícitas, así que no dependen de la regla 9 vieja | supabase/functions/cotizar-texto/index.ts | repo = desplegado (fuente de verdad: lo que corre) | — | — | — | FIXED / TESTING (análisis incluido; `deno check` bloqueado por entorno) |
| COT-P0-036 trazabilidad del `null` | P0 | **Sí**: `return null` sin rastro para `!L`/`!prod` | lineas.js, CotizadorIA.jsx | `console.warn` estructurado (ruta/producto/selección/motivo) + motivo en UI + partida pendiente con `motivoPendiente`. **No** hay evento persistido (`interpretation_id` en `ai_eventos`) todavía | cotizarRescate "null con MOTIVO" | ✅ | torreSur captura `warnsCotizar` | FIXED / TESTING (parcial) |
| COT-P0-037 idempotencia de guardado | P0 | No re-verificado en este corte | — | — | — | — | — | OPEN |
| COT-P0-038 recargas pierden info | P0 | Parcial: identidad/pendientes ahora persisten (004/008); resto no verificado | — | — | — | — | torreSur §6 (refresh) | OPEN (parcial) |
| COT-P0-039 PDF/impresión | P0 | No trabajado | — | — | — | — | — | OPEN |
| COT-P0-040 renders ≠ acomodo | P0 | No trabajado | — | — | — | — | — | OPEN |
| COT-P0-041 recorrido autenticado | P0 | `e2e/torreSur.e2e.js` corrido por Rodrigo: PDF real → leer-plano 200 → Voni → cotizar-texto → 11 partidas (7 costeadas + 4 pendientes) → refresh sin pérdida. Cubre hasta cotización; **no** acomodo/render/PDF | e2e/ | — | — | — | ✅ parcial (hasta cotización) | REPRODUCED → FIXED / TESTING (recorrido completo OPEN) |
| COT-P1-042 Playwright "Agregué…" | P1 | En esta rama el texto "Agregué N muebles a tu proyecto" se conserva (`programaBriefWriter.e2e.js` sigue válido); el cambio de ChatGPT (da56080) **no** se adoptó | CotizadorIA.jsx | — | — | — | pendiente de correr | DESCARTADO EN ESTA RAMA (aplica sólo a `fix/chatgpt-p0-recovery`) |

---

## C. Qué NO se hizo (y por qué)

- **Orden de autoridad completo (005/006/016):** resolver anclas contra Producto Maestro dentro de `resolverPrograma` implica cambiar el universo canónico (hoy BANCO) para 23 líneas; se hizo el puente por identidad exacta (sin sustitución) y se dejó el resto `OPEN` para no ampliar alcance sin RED/GREEN propio.
- **Bloques 3-10:** no tocados. El mandato exige uno por uno; este corte cierra bloque 1 (parcial por falta de payload) y bloque 2 (parcial).
- **Nada desplegado.** Prod `5a38d2e` intacto; 33 cotizaciones intactas; sin migraciones; sin RLS.

## D. Siguiente acción con mayor retorno

1. Rodrigo corre: `TEST_EMAIL=… TEST_PASSWORD=… npx playwright test e2e/torreSur.e2e.js e2e/programaP01.e2e.js` → pegar `e2e/evidence/torre-sur-cotizar-texto.json` + salida. Con eso la tabla A pasa de "probable" a "demostrada" y se decide el fix definitivo de 009.
2. Con el bench/Eclipse costeados, re-probar Acomodo (020/025 deberían caer solos; si no, son defectos propios).
