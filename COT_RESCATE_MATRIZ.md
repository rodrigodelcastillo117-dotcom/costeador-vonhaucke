# OPERACIÓN RESCATE · COTIZAR — Matriz viva de defectos

**Rama:** `audit/final-product-completion` · **HEAD código:** `5c0d500` (sobre `1efe78c`)
**Caso golden:** plano ARQ-01 "Oficinas Corporativas Torre Sur" (15.0 × 8.8 m ≈ 104 m²; fixture `e2e/fixtures/plano-torre-sur-arq01.pdf`)
**Evidencia local:** vitest **2201/2201** (260 archivos) · vite build ✅ · `deno check`: ⚠️ falla por entorno (`npm:openai` tipos desde `jsr:@supabase/functions-js` edge-runtime.d.ts; no es el código de la función) · ESLint: sin config migrada (no corre).
**Prod:** `5a38d2e` (sin tocar) · **Edge `cotizar-texto` desplegada:** v10 (`ezbr_sha256 9c3c84f4…`), `leer-plano`/`leer-plano-core` sin cambios.
**NO ejecutado por Claude:** ningún E2E autenticado (Claude no ingresa credenciales contra backend remoto). Specs listos: `TEST_EMAIL=… TEST_PASSWORD=… npx playwright test e2e/torreSur.e2e.js e2e/programaP01.e2e.js`.

Estados: `OPEN` · `REPRODUCED` · `FIXED / TESTING` · `PASS CERTIFICADO` · `REVIEW_REQUIRED` · `BLOCKED` · `DESCARTADO CON EVIDENCIA`.
Regla: **ningún `PASS CERTIFICADO` sin E2E autenticado real.** Hoy no hay ninguno.

---

## A. Los cuatro "No pude costear" (tabla exigida)

| # | Entrada original (etiqueta IA) | Causa demostrada | Producto correcto | Identidad | Precio | Reparación | Prueba | Resultado |
|---|---|---|---|---|---|---|---|---|
| 1 | Banca doble App LT 8 usuarios, 1500 mm por puesto | **NO DEMOSTRADA** (sin payload real). Demostrado: con `applt/banca_doble`+`usuarios=8`+`largoMM=1500` el motor cuesta ($26,145 modelo, Dirección; Ventas → `sinPrecioAutorizado`, fail-closed). `null` sólo si (a) ruta/producto ≠ clave/id, (b) `generar` lanza (catch→null). Fuzz de todo el catálogo: 0 (b). Queda (a) o un payload no visto. | `applt / banca_doble` 1500×1200, 8u (escalón real, no extrapolado) | sin clave de catálogo (bench cae a modelo; `precioReal:false`) | modelo $26,145 (Dirección) · Ventas: pendiente de precio autorizado | `resolverRutaProducto` (título/nombre tolerados) + `console.warn` con motivo + partida PENDIENTE si sigue null | `cotizarRescate.test.js` (Dirección/Ventas/tolerancia/null con motivo) | **FIXED / TESTING** · causa real: **pendiente de evidencia** (`e2e/torreSur` la captura) |
| 2 | Escritorio ejecutivo Eclipse 2.10 m, mano derecha, chapa | ídem: `eclipse/escritorio` 2100 D chapa → **$81,470 catálogo real `ECTESC23691940`** | `eclipse / escritorio` 2100, mano D, chapa | `source_ref ECTESC23691940` → `producto_id`/`version`/`lista_precio_item` (Producto Maestro) — ahora también para Dirección | **autorizado (catálogo)** | ídem + identidad para todos los roles | `cotizarRescate.test.js` "identidad Producto Maestro" | **FIXED / TESTING** (E2E pendiente) |
| 3 | Credenza Eclipse 2100 mm, chapa | ídem: `eclipse/credenza` 2100 → **$43,720 `ECGCZA19C30658`** | `eclipse / credenza` 2100×600 D chapa | `ECGCZA19C30658` → Producto Maestro | **autorizado (catálogo)** | ídem | ídem | **FIXED / TESTING** |
| 4 | Mesa de juntas App LT 2100 mm para 6 personas | ídem: `applt/mesa_juntas` 2100 → $12,177 modelo (`precioReal:false`: sin clave resuelta para 2100) | `applt / mesa_juntas` 2100×1200 | sin clave | modelo (Dirección) · Ventas: pendiente | ídem | ídem | **FIXED / TESTING** · P1 abierto: 2100 sin precio real autorizado |

**Hecho duro:** `git diff ded387de HEAD -- CotizadorIA/lineas/applt/eclipse` estaba **vacío** antes de este commit → el preview probado por Rodrigo tenía exactamente este código; el `null` vino del payload o de un `generar` que lanzó con un payload que el fuzz no cubre. **No se declara causa exacta.** `e2e/torreSur.e2e.js` escribe `e2e/evidence/torre-sur-cotizar-texto.json` (ruta/producto/selección/etiqueta, sin texto del cliente) + `warnsCotizar` (ahora el motor dice POR QUÉ) para fijarla.

---

## B. Matriz de los 42

| ID | Sev | Causa demostrada | Archivo | Fix | Test RED | Test GREEN | E2E | Estado |
|---|---|---|---|---|---|---|---|---|
| COT-P0-001 plano sin inventario | P0 | No investigado en este corte (fuera del bloque 1-2) | leer-plano(-core), floorPlanReader | — | — | — | — | OPEN |
| COT-P0-002 8 puestos → 1 | P0 | No reproducido aquí; parche de ChatGPT (edfb13e) **no verificado** | espacio.js, entendido.js | — | — | — | — | OPEN |
| COT-P0-003 programas contradictorios | P0 | Confirmado parcialmente: brief dice juntas **6** (formulario `ProgramaProyecto` ← `programaDelPlano(areas)`), observado dice **10** (plano: 10 sillas en óvalo). Frontera: áreas vs observed_program | ProgramaProyecto.jsx:138, programaDelPlano.js | — | — | — | — | REPRODUCED (parcial) |
| COT-P0-004 identidad se pierde en `partidasDeItemsIA` | P0 | **Sí**: el mapeo elegía campos; `producto_id/version/source_ref/lista_precio_item_id/zone/functional_group` morían. Además `conIdentidadV2` sólo corría en seller-safe | App.jsx:684, lineas.js | `soloSiExiste(...)` conserva identidad+topología+pendientes; identidad en todos los roles | cotizarRescate "identidad" (antes: `producto_id` undefined en Dirección) | ✅ | pendiente (torreSur §5) | FIXED / TESTING |
| COT-P0-005 Eclipse 2.10 `NO_CANONICO` | P0 | **Sí**: `ESCRITORIOS = BANCO.filter(esc-/ger-/dir-)` (catalogoCanonico.js:95); la línea Eclipse no está en BANCO | resolverPrograma.js, programaRealDelPlano.js | Puente por identidad EXACTA: pendiente cubierto si existe partida de línea con misma ruta+producto+medidas (`cubrirPendientesConLinea`); `requested_route/product` viajan en el pendiente. **No** se re-resolvió contra Producto Maestro dentro del resolver (orden de autoridad 1-5 del mandato): pendiente | programaRealDelPlano.test.js "RESCATE" (RED: pendiente+bloqueado) | ✅ (cubierto, apply del bench desbloquea; otro largo/producto/sugerida NO cubren) | pendiente | FIXED / TESTING (parcial: orden de autoridad completo OPEN) |
| COT-P0-006 mesa de juntas no canónica | P0 | Misma causa que 005 (`JUNTAS = BANCO mj-*`); `MESA_SOLICITADA_NO_CANONICA` para App LT 2100 | ídem | mismo puente (juntas con `requested_route/product`) | — (sin test específico de juntas) | — | — | FIXED / TESTING (sin test propio) |
| COT-P0-007 `NO_CANONICO` sin salida | P0 | **Sí**: `requiereRevision = … \|\| pendientes.length>0` (observado) e `incompletos` → `propuestaBloqueada` → committed=false y sin acción. **Gate P0.1 NO eliminado**: se retractó mi 1efe78c (volvió fail-closed) | programaRealDelPlano.js:713/736, Voni.jsx | preview ≠ commit (`previewAplicacionPrograma`), texto "cómo se resuelve", cubiertos por línea | observedPipelineIntegracion P0.1 (ahora exige bloqueo) | ✅ | programaP01 (botón disabled + preview visible) pendiente de correr | FIXED / TESTING |
| COT-P0-008 no encontrados desaparecen | P0 | **Sí**: `especiales/sinCostear/sinPrecio/noEncontrado` sólo texto; `continue` | CotizadorIA.jsx | `partidaRequerimientoPendiente` (precio null, `requiere_costeo`, motivo, tipo) para los 5 caminos | cotizarRescate "punto 4" | ✅ | torreSur §4 pendiente | FIXED / TESTING |
| COT-P0-009 cuatro "No pude costear" | P0 | Ver tabla A | lineas.js, CotizadorIA.jsx | ídem A | ✅ | ✅ | **pendiente (evidencia)** | REPRODUCED (parcial) / FIXED-TESTING |
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
| COT-P1-029 texto invisible "Por agregar" | P1 | **Sí**: `Voni.jsx:366` sin `color` sobre `#eef6f3`; tema oscuro hereda blanco (captura) | Voni.jsx | color explícito `#1c2a26` + `data-testid` | programaP01 mide `getComputedStyle().color ≠ rgb(255,255,255)` | — | pendiente de correr | FIXED / TESTING |
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
| COT-P0-041 recorrido autenticado | P0 | Spec `e2e/torreSur.e2e.js` listo (PDF real → Voni → evidencia → partidas → refresh). **No ejecutado por Claude** | e2e/ | — | — | — | **pendiente (Rodrigo)** | BLOCKED (credenciales) |
| COT-P1-042 Playwright "Agregué…" | P1 | En esta rama el texto "Agregué N muebles a tu proyecto" se conserva (`programaBriefWriter.e2e.js` sigue válido); el cambio de ChatGPT (da56080) **no** se adoptó | CotizadorIA.jsx | — | — | — | pendiente de correr | DESCARTADO EN ESTA RAMA (aplica sólo a `fix/chatgpt-p0-recovery`) |

---

## C. Qué NO se hizo (y por qué)

- **Orden de autoridad completo (005/006/016):** resolver anclas contra Producto Maestro dentro de `resolverPrograma` implica cambiar el universo canónico (hoy BANCO) para 23 líneas; se hizo el puente por identidad exacta (sin sustitución) y se dejó el resto `OPEN` para no ampliar alcance sin RED/GREEN propio.
- **Bloques 3-10:** no tocados. El mandato exige uno por uno; este corte cierra bloque 1 (parcial por falta de payload) y bloque 2 (parcial).
- **Nada desplegado.** Prod `5a38d2e` intacto; 33 cotizaciones intactas; sin migraciones; sin RLS.

## D. Siguiente acción con mayor retorno

1. Rodrigo corre: `TEST_EMAIL=… TEST_PASSWORD=… npx playwright test e2e/torreSur.e2e.js e2e/programaP01.e2e.js` → pegar `e2e/evidence/torre-sur-cotizar-texto.json` + salida. Con eso la tabla A pasa de "probable" a "demostrada" y se decide el fix definitivo de 009.
2. Con el bench/Eclipse costeados, re-probar Acomodo (020/025 deberían caer solos; si no, son defectos propios).
