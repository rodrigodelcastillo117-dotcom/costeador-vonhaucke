# VON HAUCKE — FINAL PRODUCT COMPLETION · CLOSEOUT STATE

> Estado vivo para continuar entre sesiones. Otra sesión debe poder retomar EXACTAMENTE aquí.
> Última actualización: 2026-10-08 (sesión inicial)

## Base / rama
- BASE_SHA: `e5f737f044f2ecfd326b35640b995c0111c07902` (= audit/material-gate-v4-final, Material Gate P0.1–P0.16 aprobado)
- Rama de trabajo: `audit/final-product-completion` (worktree en `/Users/rodrigodelcastillo/Documents/costeador-vonhaucke-fpc`)
- Material Gate CONGELADO salvo que un E2E real descubra un P0 demostrable.

## Límites (hard)
NO merge · NO prod deploy · NO promote · NO migraciones en prod · NO escrituras masivas de prod ·
NO modificar las 33 cotizaciones legacy · NO aprobar DATA TRUTH · NO Intelisis.
Operaciones irreversibles se preparan/documentan y quedan pendientes de autorización.

## Restricción de verificación (honestidad)
La app apunta a Supabase PROD (nube.js hardcoded). No puedo autenticarme con el password real
de prod (enviaría credenciales a servicio externo). Por eso:
- VERIFIED por mí: lógica pura (costeo/material/acomodo/PDF-función), build, suite, render sin auth,
  consola/red al cargar, auditorías de código.
- BLOCKED_EXTERNAL (requiere login del usuario): E2E autenticado de guardar/reabrir, roles en vivo,
  aprobar contra servidor en vivo, autosave real, storage real.

## Baseline (medido al iniciar) — VERIFIED
- Tests: **1863 passed / 1863** (vitest, 231 files). CODE_PASS + INTEGRATION_PASS.
- Build: **✅ exitoso** (vite, 5.37s). Bundle principal 1.15MB (289KB gzip) — grande pero funcional; P2 code-split.
- Dev server: arranca en :5173. Home AUTENTICADO renderiza (sesión persistida), **0 errores de consola**, todos los módulos 200, nav completa, 3 caminos claros, Voni presente, responsive OK. USER_FLOW(render) VERIFIED.
- Playwright smoke E2E: **3/3 PASS** (monta, sin pantalla de fallo total, sin scroll horizontal a 375px, login+mostrar-contraseña+recuperación sin caminos muertos). E2E_PASS (login UI / app-opens).
- Deno disponible (~/.deno/bin), Playwright chromium instalado.

## BLOCKED_EXTERNAL (requiere acción del usuario)
- E2E autenticado (acomodo, programa, cross-flow, roles en vivo, guardar/reabrir, aprobar vivo):
  los specs e2e/*.e2e.js SE SALTAN sin `TEST_EMAIL`/`TEST_PASSWORD`. Para correrlos: definir esas env
  vars con una CUENTA DE PRUEBA (no la de Rodrigo, para no ensuciar datos/escrituras en prod).
- No puedo autenticarme yo (password real → servicio externo). La app apunta a Supabase PROD.
- live-ai-smoke.e2e.js consume IA real (dinero) → correr selectivamente.

## Progreso por área (actualizar continuamente)
| Área | Estado | Notas |
|---|---|---|
| Setup rama+baseline | EN CURSO | |
| 1 Home/Navegación | PENDIENTE | |
| 2 Plan Intelligence | PENDIENTE | |
| 3 Costear | PENDIENTE | |
| 4 Cotizar | PENDIENTE | |
| 5 Cocrear | PENDIENTE | |
| 6 Acomodo | PENDIENTE | |
| 7 Renders | PENDIENTE | |
| 8 Botones | PENDIENTE | |
| 9 PDF/Print | PENDIENTE | |
| 10 Login/Recovery | PENDIENTE | |
| 11 Roles | PENDIENTE | |
| 12 Security | PENDIENTE | |
| 13 Persistencia | PENDIENTE | |
| 14 VONI/Council | PENDIENTE | |
| 15 Performance | PENDIENTE | |
| 16 UX | PENDIENTE | |
| 17 24-project E2E | PENDIENTE | |
| 18 Exploratory QA | PENDIENTE | |
| 19 Cross-flow | PENDIENTE | |
| 20 Red team multi-agente | PENDIENTE | |
| 21 Self-audit | PENDIENTE | |

## Red team multi-agente (5 agentes, COMPLETADO) — hallazgos con evidencia

### HALLAZGO CLAVE TRANQUILIZADOR
El agente de dinero/cross-flow concluye: **el motor de costeo está genuinamente sólido; NO hay P0
que produzca un número incorrecto en el camino principal.** Un solo motor cliente/servidor (el edge
importa `src/motor/calculo.js`, no reimplementa), cross-flow comparte motor, APP LT 10u=6000×1200
verificado, fail-closed real (precioDe→NaN, costeoEmitible bloquea, UNKNOWN≠$0). Lo más temido (costos
malos) está bien. Los demás P0 son de MANEJO DE ESTADO UI (datos stale / pérdida de datos borde) y
de SEGURIDAD (edges/RLS en infra Supabase).

### ✅ ARREGLADOS en esta rama (con test/build verde; commits pusheados)
1. **silent P0-1 — costo fantasma por falta de medida.** Pieza `forma:'area'` sin cotas caía a
   `cantidad` y costeaba 1 m² fantasma. FIX: `calcular` → `componentesIgnorados`; `mapIaComps` preserva
   `forma:'area'`. Test `finalCompletion.test.js`. Golden intacto. (commit 5b522e4)
2. **security P1-2 — fuga seller-safe en localStorage.** `limpiarSensibles` neutraliza costos de insumos;
   `hacerLogout`+`limpiarAlmacen()` borra el blob. (5b522e4)
3. **silent P0-2 / React P0-4 — pérdida de datos al reabrir.** `App.onAbrir` aborta si la carga completa
   falla (no sobrescribe el guardado). (5b522e4)
4. **React P0-1 — renders de Cotización pisaban estado con copia vieja.** setCot/setPartida funcionales;
   render se escribe POR ID (`aplicarRenderPorId`) en renderPartida/renderTodas/subirRender. (d93c005)
5. **React P0-5 — "COSTO CERTIFICADO" pegado al cambiar BOM.** Se guarda `costoEstadoHash`; sólo se muestra
   si coincide con el BOM actual, si no cae a "PRELIMINAR". (d93c005)
6. **silent P0-3 — config compartida se sobrescribía al cargar** (destruía precios de todo el equipo).
   FIX: ya NO se auto-siembra al cargar; la nube manda; el autosave por cambio (gated por veCostos) puebla
   cuando Dirección edita. (cb89439)
7. **React P0-2 — bucle de autosave en Acomodo (~600ms).** Guard de firma: no re-guarda payload idéntico;
   rompe el bucle y deja que el autosave a nube dispare. (3212f4e)
8. **React P1-13 — etiqueta IVA** usa el `ivaPct` efectivo (coincide con el monto). (d4951c5)
9. **React P1-7 — vendedor sin precio** ya no ve "$0" ni botón "Agregar" muerto: "Sin precio" + disabled. (d4951c5)

### 🔴 P0 ABIERTOS (prioridad; requieren cirugía de estado + E2E autenticado para verificar)
- **React P0-1 — renders de Cotización pisan estado con copia vieja.** `Cotizacion.jsx:114,202-247`
  `setCot`/`setPartida` NO funcionales; tras await de render, restauran partidas/descuentos viejos
  (pérdida de trabajo/dinero, y en Dir/Diseño revierten precios de realtime). FIX: `setEstado(e=>...)`
  localizando por `id`, escribir solo `render`.
- **React P0-2 — bucle de autosave en Acomodo (~600ms infinito).** `AcomodoBase.jsx:332-363` deps con
  arreglo nuevo cada render; el autosave a nube nunca dispara (punto verde miente). VERIFICAR con profiler.
  FIX: firma estable + memo + no re-llamar si no cambió.
- **React P0-3 — render IA viejo viaja como vigente al PDF.** `stagingUrl` no se invalida al mover
  muebles/recalcular/cambiar plano (`AcomodoBase.jsx:109,359,906`). El cliente recibe imagen que no
  corresponde. FIX: hash plan↔render; limpiar stagingUrl/realista/imgEscena en acomodar/dibujar/setArea.
- **React P0-5 — "COSTO CERTIFICADO" pegado al cambiar el BOM.** `AsistenteEspecial.jsx:1269` `costoEstado`
  string no se invalida al editar. FIX: guardar `{estado,bomHash}` y mostrar solo si coincide.
- **silent P0-3 — config compartida se sobrescribe si leerConfig no trae insumos.** `nube.js:33-37`
  `return data||{}` → App siembra el estado local y PISA los precios de TODO el equipo. FIX: leerConfig
  señala error si data null; App no auto-siembra sin confirmación. (RIESGOSO: afecta a todos; verificar.)
- **security P0-1 — 4 edges IA sin auth interna** (cotizar-texto, generar-video, leer-plano-core,
  analizar-negocio): credit-burn / proxy abierto (generar-video concatena `operacion`/`modelo` del cliente
  a la URL de Google). FIX: pegar bloque auth+rate-limit de analizar-mueble + topes de tamaño; validar
  operacion/modelo o BORRAR generar-video (huérfano). PREP de source posible; verify_jwt/llaves legacy =
  dashboard Supabase (BLOCKED_EXTERNAL). NO desplegado.
- **security P0-2 — config_leer RLS sin cortar:** vendedor lee `config` crudo (costos/proveedores) por
  DevTools. FIX: `alter policy config_leer ... using (puede_editar_config())` — 1 línea, ya en
  `supabase/PENDIENTE_corte_rls_config.sql`. BLOCKED_EXTERNAL (migración prod; requiere tu autorización).

### 🟠 P1 ABIERTOS (resumen; detalle en los reportes de agentes del transcript)
- money P1 — margen RANCIO: `b.margen` se congela en mount; si Dirección cambia margenObjetivo, el cliente
  guarda `precio=costo_nuevo×margen_viejo` y el gate solo compara COSTO, no precio. FIX: derivar b.margen
  reactivo y/o comparar precioVenta en validarServidorParaAprobar.
- money P1 — margen mínimo 25% NO se hace cumplir (solo aviso). FIX: gate en costeoEmitible/emisión.
- React P1-1 gate/chips viejos en Cotización · P1-2 partidas con costo/margen viejo sin marca ·
  P1-3 autosave pierde cambios (vaciar cotización no sincroniza) · P1-4 respuestas IA fuera de orden
  (Costeador/Voni2) · P1-5 render stale a ficha PDF · P1-6 EditarPartida deja derivados viejos ·
  P1-7 CosteadorLinea sello "precio real" + "$0 Agregar" botón muerto para vendedor sin precio ·
  P1-8 CotizadorIA pierde estado al interpretar / duplica lotes · P1-9 editar área desincroniza dibujo ·
  P1-10/P1-11 carreras acomodar/plano + "Aplicar programa" sin feedback · P1-12 logout no limpia
  cotización/idCotizacion (relacionado al P1-2 ya arreglado parcialmente) · P1-13 etiqueta IVA inconsistente.
- security P1-1 emitir_revision legacy (no v2, anti-tamper) · P1-3 signups públicos (escalada de rol).
- silent P1 (5-19): listaPermitidos/leerDireccion/verificarDespiece/autosave/revisiones/Voni/Comercial/
  ProductoMaestro tragan error → "no hay datos" como hecho; edge `usuarios` ok:true con upsert fallido.

### 🟡 P2 BACKLOG
- Dead code: `CocrearV2.jsx` (~435 líneas, el vivo es V3) → borrar. Chips "líneas candidatas"
  (`Costeador.jsx:355`) inertes → dar onClick o quitar look de chip.
- Perf: bundle 1.15MB (code-split); voniCosting/guardar recalculan en cada tecla; CocrearV3 setTimeout mágico.
- Muchos `.catch(()=>{})` benignos vs los que ocultan errores (ver silent agent P2).
- security P2: oráculos de costo para vendedor (rate-limit), fecha/moneda del cliente, voni-council denylist,
  bucket `renders` público, usuarios crear/bootstrap, resolver_costo_insumo a authenticated.

## Matriz (estado al cierre de esta sesión)
| Área | CODE | INTEGRATION | E2E | USER FLOW | Calidad | Pendiente |
|---|---|---|---|---|---|---|
| Home/Navegación | ✅ | ✅ | ✅ smoke | ✅ render | buena | — (sin dead-ends) |
| Money/Motor | ✅ | ✅ 1870 | — | BLOCKED(auth) | ALTA | margen rancio/25% (P1) |
| Plan Intelligence | parcial | ✅ | — | BLOCKED | media | leer-plano sin vocab mobiliario (ver project_p0_plan_intelligence) |
| Costear | ✅ | ✅ | — | BLOCKED | buena | fantasma FIX; cert label P0-5 |
| Cotizar | ✅ | ✅ | — | BLOCKED | media | render-overwrite P0-1, gate stale P1 |
| Cocrear | ✅ | ✅ | — | BLOCKED | media | CocrearV2 dead code |
| Acomodo | ✅ | ✅ | — | BLOCKED | media | autosave loop P0-2, render stale P0-3 |
| Renders | ✅ | ✅ | — | BLOCKED | media | stale→PDF P0-3 |
| PDF/Print | ✅ | ✅ (9 tests) | — | BLOCKED | buena | imágenes faltantes sin aviso (P1-16) |
| Login/Recovery | ✅ | ✅ | ✅ smoke | BLOCKED(creds) | buena | error genérico login P1-17 |
| Roles | ✅ | ✅ | — | BLOCKED | buena | seller-safe localStorage FIX |
| Security | parcial | — | — | — | media | edges auth P0-1, config RLS P0-2 (BLOCKED prod) |
| Persistence | parcial | ✅ | — | BLOCKED | media | reopen FIX; autosave/config P0-3 |
| VONI/Council | ✅ | ✅ | — | BLOCKED | media | proveedorReal traga errores (P1) |
| Performance | — | — | — | — | — | bundle/rerenders (P2) |
| UX/Responsive | ✅ | — | ✅ 375px | ✅ render | buena | — |

## Cómo correr E2E autenticado (para desbloquear USER FLOW)
`TEST_EMAIL=<cuenta-de-prueba> TEST_PASSWORD=<...> npx playwright test` (NO la cuenta de Rodrigo).
Specs: e2e/auth.e2e.js, acomodoP02, programaP01, programaBriefWriter, acomodoMensajeVendedor.

## Commits en esta rama (pusheados a origin/audit/final-product-completion)
- 5b522e4 — P0 fantasma + seller-safe localStorage + reopen data-loss + closeout + red-team
- d93c005 — React P0-1 (renders) + P0-5 (label certificado)
- cb89439 — silent P0-3 (config overwrite)
- 3212f4e — React P0-2 (bucle autosave)
- d4951c5 — P1-13 (IVA) + P1-7 (vendedor sin precio)

## P0 que QUEDAN tras esta sesión (requieren E2E autenticado o prod)
- **React P0-3 — render IA viejo viaja al PDF.** `stagingUrl` no se invalida al mover muebles/
  recalcular/cambiar plano/partidas. Fix: hash plan↔render; limpiar stagingUrl/realista/imgEscena en
  acomodar/acomodarIA/usarDibujo/procesarPlano/setArea/delArea y al cambiar partidas; en Voni resetear
  render3d/escenas/floorSpec al cambiar de espacio. NO arreglado aquí: multi-punto en AcomodoBase (1800
  líneas) y sin E2E autenticado no puedo verificar que no rompo el flujo. Prioridad #1 para la próxima
  sesión (con TEST_EMAIL/TEST_PASSWORD de cuenta de prueba).
- **security P0-1 — 4 edges IA sin auth interna** (cotizar-texto, generar-video [huérfano + proxy abierto
  a Google con la key del server], leer-plano-core, analizar-negocio). BLOCKED_EXTERNAL: el fix REAL es
  verify_jwt + desactivar llaves legacy en el dashboard de Supabase, y/o borrar la función desplegada
  `generar-video` — no puedo tocar el proyecto Supabase. Source-hardening posible pero sin deploy no
  cierra el hoyo en prod. REQUIERE autorización de Rodrigo.
- **security P0-2 — config_leer RLS sin cortar.** 1 línea en prod (`alter policy config_leer ...`),
  ya en `supabase/PENDIENTE_corte_rls_config.sql`. BLOCKED_EXTERNAL (migración prod).

## P1 ejecutables que QUEDAN (sin E2E) — próxima tanda
money margen-rancio, margen mínimo 25% como gate, React P1-1/2/3/4/5/6/8/9/10/11/12, silent P1-5..19.
Detalle con archivo:línea en los reportes de los 5 agentes (transcript) y arriba.
