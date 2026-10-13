# Área J · Resiliencia (red lenta, timeout, IA rota, recarga, doble clic, sesión, concurrencia, permisos)

**Fecha:** 2026-10-13 · **Rama:** `claude/costing-app-architecture-psf02g` · **Spec:** `e2e/resiliencia.e2e.js`

> ⚠️ **No es certificación E2E real.** Son pruebas **adversariales con simulador**: navegador real (Chromium) +
> **nube falsa** (`e2e/nubeFalsa.js`, espejo JS de las RPC de producción) + fallas inyectadas con `context.route`.
> Prueban cómo **reacciona el cliente**; lo que afirman del servidor es lo que el simulador imita. El instalador de
> fallas nunca hace `route.continue()`/`route.fetch()` al host de Supabase: nada toca producción.

Criterio de Dirección: *"Ningún error puede provocar pérdida silenciosa de información económica o técnica; toda
operación prohibida debe fallar de forma segura."* Cada escenario afirma lo que **ve la persona** y lo que queda en
los **datos** (nube falsa + `localStorage`): nada se pierde, nada se inventa, nada se duplica.

## Cómo se inyectan las fallas

`instalarConFallas(context, nube)` captura el manejador de la nube falsa (sin editar `nubeFalsa.js`) y, por regla:

| Falla | Qué simula |
|---|---|
| `antes(ms)` | latencia **antes** de que el servidor reciba (red lenta 8–15 s) |
| `despues(ms)` | el servidor ya escribió; la respuesta tarda |
| `confirmaYCorta(ms)` | el servidor **escribió** y la conexión se cortó antes de la respuesta |
| `responder(status, cuerpo)` | 504 del gateway, 401 `PGRST301`, JSON truncado, `ok:false INVALID_MODEL_SHAPE`, forma inválida |
| `abortar('timedout' \| 'internetdisconnected')` | corte de red / tiempo agotado del navegador |
| `sinRed(c, true/false)` | `navigator.onLine` + eventos `offline/online` reales **y** corte de toda petición |

Nota de entorno: el servidor de desarrollo en :5173 corre con `VITE_*_FN=…-rc` (Edge RC). El instalador normaliza
`/functions/v1/<fn>-rc → <fn>` para que la nube falsa (que conoce los nombres de producción) conteste.

## Resultados (corrida final: **27 passed**, 3.8 min; 7c es `test.fail` esperado)

| # | Escenario | Resultado | Evidencia (lo que se afirma) | Defecto / severidad |
|---|---|---|---|---|
| 1a | Red lenta 10 s en `actualizar_cotizacion_segura` | ✅ pasa | durante el vuelo: local = nuevo, nube = viejo, `creates=1`; al llegar: `updates=1`, `filas=1`, sin aviso de error | — |
| 1b | Indicador "Guardando…" con 12 s de latencia | ✅ pasa (tras arreglo) | `data-guardando="1"` + `title` "Guardando en la nube…" durante el vuelo; vuelve a `0` y `conectado` | **R-01 P2** corregido |
| 1c | Respuestas fuera de orden (la vieja llega 12 s tarde) | ✅ pasa | la nube terminó con `Orden SA v2` (3 updates); ventana transitoria de ~0.9 s con el dato viejo en la nube, se autocorrige | observación O-2 |
| 2a | `cotizar-texto` 504 tras 9 s | ✅ pasa (tras arreglo) | "Voni está trabajando" visible; mensaje "La IA tardó demasiado… No se cambió nada; vuelve a intentar."; pedido y partida previa intactos; reintento agrega 1 mueble | **R-02 P2** corregido |
| 2b | `cotizar-texto` corte por tiempo (net::ERR_TIMED_OUT) tras 8 s | ✅ pasa (tras arreglo) | "No se pudo conectar con el servicio de IA (sin red o tiempo agotado)…"; nada cambia | R-02 |
| 2c | `analizar-mueble` 504 tras 8 s | ✅ pasa (tras arreglo) | despiece previo idéntico, descripción intacta, reintento OK | R-02 |
| 3a | `cotizar-texto` JSON truncado (200) | ✅ pasa (tras arreglo) | "La IA respondió algo que no se pudo leer…"; 0 partidas nuevas | R-02 |
| 3b | `cotizar-texto` forma inválida (`items:'basura'`, `banco:5`, `preguntas:'texto'`, renglones sin producto) | ✅ pasa (tras endurecer) | "No pude armar ningún mueble…" / "No pude costear: Cosa rara"; ninguna partida nueva ni en $0 | R-03 (endurecimiento) |
| 3c | `analizar-mueble` `ok:false INVALID_MODEL_SHAPE` | ✅ pasa | se muestra "…sin forma válida. Reintenta."; despiece intacto | — |
| 3d | `analizar-mueble` `ok:true` con `piezas: []` | ✅ pasa (tras arreglo) | antes: el despiece se **reemplazaba por uno vacío** sin aviso; ahora aviso y despiece intacto | **R-03 P1** corregido |
| 3e | `analizar-mueble` `piezas` como texto | ✅ pasa (tras arreglo) | antes: "((intermediate value) \|\| []).map is not a function"; ahora mensaje claro, despiece intacto | R-03 / R-02 |
| 4a | Recarga antes del autosave (red lenta 8 s) | ✅ pasa | tras recargar, local = `Recarga SA Planta 2`/`RC-77`; llega a la MISMA fila; `filas=1`, `creates=1` | — |
| 4b | Creación con respuesta perdida + recarga sin editar | ✅ pasa | indicador `sin-conexion`; tras recargar el reintento idempotente devuelve la misma fila; `filas=1` | — |
| 4c | Creación con respuesta perdida + **edición** | ✅ pasa (tras arreglo) | antes: **`filas=2, creates=2`** (cotización huérfana); ahora `filas=1`, con el último dato, id local = fila | **R-04 P1** corregido |
| 4d | Recarga a media captura del **Costeo manual** | ✅ pasa (tras arreglo) | antes: 2 piezas → **0**, ningún aviso; ahora 2 → 2, nombre intacto y aviso "Recuperé el costeo…" | **R-05 P1** corregido |
| 5a | Doble clic "Agregar →" (artículo de línea, vendedor) | ✅ pasa (tras arreglo) | antes: **2 partidas idénticas**; ahora 1 | **R-06 P2** corregido |
| 5b | Doble clic "Agregar a la cotización" (configurable, Dirección) | ✅ pasa (tras arreglo) | antes: 2; ahora 1; un 2º clic deliberado (>1.2 s) sí agrega | R-06 |
| 5c | Doble clic "Volver a aplicar mis cambios" (guardar explícito, VH-148) con red lenta 3 s | ✅ pasa | 1 solo `actualizar`, `conflictos=1`, `filas=1` | — |
| 5d | Doble clic "Descargar PDF" con emisión lenta 2 s | ✅ pasa | 1 descarga, 1 revisión, 1 llamada a `emitir_revision` | — |
| 6a | Sesión: 401 `PGRST301 JWT expired` | ✅ pasa (tras arreglo) | antes: aviso "sin conexión" (engañoso); ahora toast "Tu sesión expiró…", punto rojo, id y local intactos; al volver a entrar guarda en la MISMA fila | **R-07 P1** corregido |
| 6b | Sesión: `P0001 'no autorizado'` | ✅ pasa (tras arreglo) | antes: **ningún aviso, punto "En línea", id soltado y al reentrar fila 101 duplicada** (100 se quedó vieja); ahora aviso, `filas=1` | R-07 |
| 7a | Pestaña sin red que vuelve, sin editar | ✅ pasa (tras arreglo) | `sin-conexion` + toast; al volver la red se guarda solo en ~0.1 s | **R-09 P2** corregido |
| 7b | Offline + otra pestaña guarda, con VH-148 prendido | ✅ pasa | al volver: banner de conflicto, fila de A idéntica, local de B intacto (`B-OFF-2`) | — |
| 7c | Offline + otra pestaña guarda, **producción hoy** (sin VH-148) | ⛔ `test.fail` esperado | B pisa el `cliente` de A (`Prod SA Norte → Prod SA`) sin aviso, `conflictos=0` | **R-08 P1 ABIERTO** |
| 8a | UI del vendedor con economía "colada" en su navegador | ✅ pasa | sin atajos Costeo manual/Dirección/Usuarios/ERP, sin "Mis números", no se ve 12,345 ni 77 %; la fila en la nube sin costo ni margen | observación O-3 (P3) |
| 8b | Llamadas directas del vendedor (aprobar, ver costos, escribir margen, emitir por patch, cargar ERP) | ✅ pasa | `resolver_aprobacion` ≥400 y sigue PENDIENTE; `cotizacion_segura`/`cotizaciones_mias` sin economía; margen/costo no se guardan; `estado:'emitida'` ≥400; ERP ≥400 y 0 cargas | — (simulador) |
| 8c | Cola de aprobaciones | ✅ pasa | el vendedor no ve la cola ni "Aprobar"; Dirección ve "Aprobaciones pendientes (1)" | — |

## Tiempos medidos (`RESILIENCIA_TIEMPOS`, corrida final)

| Escenario | Medición clave | ms |
|---|---|---|
| 1a red lenta (10 s inyectados) | edición → guardado confirmado | 11 967 |
| 1b indicador | "Guardando…" visible desde el inicio de la prueba / apagado | 5 034 / 16 950 |
| 1c fuera de orden | v2 en nube / llega el viejo / autocorregido | 8 707 / 17 578 / 18 433 |
| 2a 504 cotizar-texto (9 s) | clic → mensaje | 9 572 |
| 2b corte de red (8 s) | inicio → mensaje | 10 728 |
| 2c 504 analizar-mueble (8 s) | clic → mensaje | 9 204 |
| 3a JSON truncado | inicio → mensaje | 1 879 |
| 3c/3d INVALID_MODEL_SHAPE / piezas vacías | inicio → aviso | 2 119 / 2 281 |
| 4a recarga (8 s inyectados) | recarga → dato en la nube | 10 902 |
| 4b respuesta perdida + recarga | inicio → id reconciliado | 7 402 |
| 4c respuesta perdida + edición | inicio → asentado (1 fila) | 9 339 |
| 4d recarga costeo manual | inicio → recargada | 3 455 |
| 5a doble clic artículo | clic → estado verificado | 1 360 |
| 5c doble clic guardar (3 s inyectados) | clic → guardado | 3 926 |
| 5d doble clic PDF (2 s inyectados) | clic → emisión / clic → descarga | 117 / 2 169 |
| 6a JWT vencido | edición → aviso / → guardado tras reentrar | 1 878 / 4 004 |
| 6b 'no autorizado' | edición → aviso / → guardado tras reentrar | 1 888 / 4 067 |
| 7a offline que vuelve | red de vuelta → guardado | 104 |
| 7b offline + VH-148 | red de vuelta → conflicto visible | 32 |
| 8b llamadas prohibidas (5 RPC) | total | 167 |

El tiempo de reacción a un fallo es ≈ latencia inyectada + 0.5–1.2 s (debounce de 1.5 s del autosave incluido donde aplica).

## Defectos

| Id | Sev. | Dónde (antes del arreglo) | Qué pasaba | Estado / arreglo | Prueba de causa raíz |
|---|---|---|---|---|---|
| R-01 | P2 | `src/App.jsx` cabecera `nube-estado` (hoy :1435) | Con la red lenta el punto decía "En línea" 10–12 s aunque el cambio no llegaba a la nube | **Corregido**: contador de guardados en vuelo (`src/App.jsx:481`), `data-guardando` + "Guardando…" | e2e 1b |
| R-02 | P2 | `src/nube.js` (9 envoltorios: `let msg = error.message \|\| …`, p.ej. :346 cotizar-texto, :291 analizar-mueble) | Errores de IA con jerga de librería en inglés | **Corregido**: `src/datos/erroresEdge.js` (`mensajeErrorEdge`) usado en `src/nube.js:226,240,291,322,346,362,394,416,429,489`; el `error` en JSON de la Edge sigue mandando | `src/datos/erroresEdge.test.js` |
| R-03 | P1 | `src/componentes/Costeador.jsx` · `analizarDescripcion` (`set({componentes: compsIA})` sin validar); `src/datos/mapIaComps.js` (`(p?.piezas \|\| []).map`) | `ok:true` + `piezas:[]` borraba el despiece técnico sin aviso; `piezas` en texto reventaba con TypeError en pantalla | **Corregido**: `propuestaConPiezas` (`src/datos/mapIaComps.js:25`), guarda en `src/componentes/Costeador.jsx:150`, catch sin jerga (:167); `CotizadorIA.jsx:85` ya no itera texto/números | `src/datos/mapIaComps.resiliencia.test.js` |
| R-04 | P1 | `src/datos/cotizaciones.js` · crear → `rotarClave` en 'clave-reusada'; `src/App.jsx` rama `r.rotarClave` | Creación confirmada con respuesta perdida + edición ⇒ **2 cotizaciones** (huérfana con datos viejos) | **Corregido**: creación pendiente por clave en `localStorage` (`src/datos/cotizaciones.js:247`), reenvío idempotente de lo que salió + update (:297) | `src/datos/cotizaciones.resiliencia.test.js` |
| R-05 | P1 | `src/App.jsx` `useState(costeoEnBlanco)` (sólo memoria) | Recargar/cerrar a media captura del Costeo manual borraba el despiece **sin aviso** | **Corregido**: `src/datos/borradorCosteo.js` + `src/App.jsx:216,332,837` (borrador por computadora, aviso "Recuperé el costeo…", se borra al salir) | `src/datos/borradorCosteo.test.js` |
| R-06 | P2 | `src/App.jsx` `agregarArticuloLinea`/`agregarDesdeAsistente`/`agregarModuloAddons`/`agregarDeBanco` | Doble clic en "Agregar" = 2 partidas idénticas (total duplicado) | **Corregido**: `src/datos/dobleClic.js` (ventana 800 ms, misma firma) en `src/App.jsx:1129` | `src/datos/dobleClic.test.js` |
| R-07 | P1 | `src/datos/cotizaciones.js` · `clasificarErrorGuardado` ('no autorizado' ⇒ 'sin-acceso' ⇒ `soltarId`) | Sesión vencida: silencio total ("En línea") y, al reentrar, **cotización duplicada**; JWT vencido: aviso de "sin conexión" engañoso | **Corregido**: clase `'sesion'` (`src/datos/cotizaciones.js:222`), aviso y punto rojo (`src/App.jsx:582`); se conserva el id | `src/datos/cotizaciones.resiliencia.test.js`; expectativa ajustada en `src/datos/cotizaciones.guardado.test.js:141` |
| R-08 | P1 | `src/App.jsx` · `guardarEnNube` manda el documento completo; `src/datos/conflictoGuardado.js:31` bandera apagada en producción; SQL `PROPUESTA_vh148_control_optimista_cotizacion.sql` sin aplicar | La pestaña que vuelve de estar sin red **pisa campos ajenos sin aviso** | **ABIERTO** (`test.fail` 7c). Propuesta: desplegar VH-148 (SQL + `VITE_CONTROL_OPTIMISTA=1`); 7b demuestra que con la bandera no se pierde nada | e2e 7c (rojo esperado) |
| R-09 | P2 | `src/App.jsx` (no había listener `online`) | Al volver la red la cotización seguía sólo local hasta la siguiente edición | **Corregido**: reintento en `online` y cada 30 s mientras "Sin conexión" (`src/App.jsx:845`) | e2e 7a |

### Observaciones (no bloquean, sin arreglo en esta pasada)

- **O-1 (P3)** Sin timeout de cliente en las Edge de IA (`src/nube.js:342` y demás `functions.invoke` sin `timeout`): si el
  gateway no corta, la persona espera sin botón de cancelar. supabase-js 2.112 acepta `timeout` en `invoke`. Propuesta:
  `timeout: 120_000` en cotizar-texto/analizar-mueble y mensaje R-02 de tiempo agotado.
- **O-2 (P3)** Respuestas fuera de orden (1c): durante ~0.9 s la nube guarda el dato viejo hasta que el cliente se
  autocorrige. Con VH-148 la escritura vieja sería rechazada (40001) — no medido aquí.
- **O-3 (P3)** El cliente del vendedor **envía** `costoUnitario`/`margen` si están en su `localStorage` (8a:
  `cliente_envio_costo: true`, `src/datos/cotizaciones.js:125` `paraGuardar` no filtra por rol). El servidor (trigger
  `trg_strip_seller_economics`, imitado por la nube falsa) los quita y la UI no los enseña: falla segura, pero falta la
  defensa en el cliente. Propuesta: `paraGuardar(estado, usuario, { veEconomia })` con `sinEconomia` para vendedor.
- **O-4 (entorno de pruebas)** `e2e/nubeFalsa.js:642,659` contesta sólo `/functions/v1/cotizar-texto` y
  `/functions/v1/analizar-mueble`; con el dev server en `VITE_*_FN=…-rc` devuelve `{}` y por eso
  `e2e/cotizarTexto.e2e.js` (2) y `e2e/costeadorCatalogo.e2e.js` (3) fallan en este entorno ("No se pudo interpretar. Vuelve a
  intentar."). No es un defecto de la app. Propuesta (no editado: `nubeFalsa.js` tiene cambios de otra sesión):
  normalizar `-rc` en `manejar` como hace `instalarConFallas` en `e2e/resiliencia.e2e.js`.

## Archivos

- **Nuevos:** `e2e/resiliencia.e2e.js`, `src/datos/erroresEdge.js` (+`.test.js`), `src/datos/borradorCosteo.js` (+`.test.js`),
  `src/datos/dobleClic.js` (+`.test.js`), `src/datos/cotizaciones.resiliencia.test.js`, `src/datos/mapIaComps.resiliencia.test.js`,
  este documento.
- **Modificados:** `src/App.jsx`, `src/nube.js`, `src/datos/cotizaciones.js`, `src/datos/cotizaciones.guardado.test.js` (1 expectativa,
  R-07), `src/datos/mapIaComps.js`, `src/componentes/Costeador.jsx`, `src/componentes/CotizadorIA.jsx`.
- **No tocados** (prohibidos): `AsistenteEspecial.jsx`, `autoInsumos.js`, `materialMatch.js`, `labCostear.e2e.js`,
  `labCotizarFlujo.e2e.js`, Cocrear; tampoco `e2e/nubeFalsa.js` (tiene cambios de otra sesión).

## Comandos y resultados

```
PW_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test e2e/resiliencia.e2e.js --reporter=line
  → 27 passed (3.8m)   [7c cuenta como pasada por ser test.fail esperado]

npx vitest run
  → Test Files 305 passed (305) · Tests 2716 passed (2716)

PW_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test e2e/persistencia.e2e.js e2e/concurrenciaOptimista.e2e.js \
  e2e/emision.e2e.js e2e/costeadorCatalogo.e2e.js e2e/cotizarTexto.e2e.js e2e/auth.e2e.js e2e/smoke.e2e.js --reporter=line
  → 20 passed · 8 skipped · 6 failed, todos preexistentes:
     persistencia.e2e.js:125 (VH-035, rojo a propósito) · cotizarTexto ×2 y costeadorCatalogo ×3 (O-4, Edge -rc en el dev server)

npx vite build --outDir <scratchpad>/dist → exit 0
```
