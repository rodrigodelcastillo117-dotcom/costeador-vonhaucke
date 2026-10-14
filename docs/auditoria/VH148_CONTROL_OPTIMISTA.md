# VH-148 · Control optimista del guardado de cotizaciones (2026-10-13)

> **Actualización 14-oct (cierre pre-deploy):** el conflicto de versión ya no usa SQLSTATE `40001`. PostgREST reintenta `40001` sin fin; con PostgREST v12.2.3 real la llamada no regresaba. Ahora el código es **`PT409`**: PostgREST responde HTTP 409 y no reintenta. El mensaje y el DETAIL no cambian. Donde este documento dice `40001`, léase `PT409`. Evidencia: `VH148_DOS_CONEXIONES_20261014.md`.

Rama `claude/costing-app-architecture-psf02g`. **Producción no cambió**: no se corrió `supabase` CLI ni
`apply_migration`, no se desplegó cliente. Todo lo que sigue está en el árbol de trabajo y probado contra
PostgreSQL real aislado (PGlite), vitest y Chromium con la nube falsa.

## 1. Defecto

Reproducido en UI sobre la cotización **1372**: el autosave manda la fila completa (`partidas`, `acomodo`,
`totales`, `total`, `piezas`, `cliente`…) 1.5 s después de cada cambio; `private_api.actualizar_cotizacion_segura`
hace `select … for update` y escribe el patch tal cual. **Gana el último que escribe**: dos pestañas (o dos
dispositivos) sobre la misma cotización se pisan en silencio; la pestaña B manda SU copia vieja de `partidas` y
borra lo que A acababa de guardar. El contrato no tenía versión ni `actualizado` esperado
(`cotizacion_segura` devolvía `creado` pero no `actualizado`).

Demostrado en SQL real: `supabase/tests/controlOptimista.test.js` → bloque "ANTES" (B pisa la cantidad 3 de A y
el servidor contesta `ok: true`).

## 2. Decisión de Dirección y diseño

Control optimista **completo** en RC, sin fusión automática (no se mezclan BOM/costos/acomodos a ciegas): la
segunda edición debe **detectar** el conflicto, **conservar** lo local y ofrecer **recuperación explícita**.

```
abrir ──► cotizacion_segura ──► actualizado = V0  (cadena ISO, tal cual)
editar ─► autosave ─► actualizar_cotizacion_segura(id, patch, p_actualizado_esperado = V0)
            ├─ fila.actualizado = V0  → UPDATE, actualizado = now() = V1 → cliente guarda V1
            └─ fila.actualizado ≠ V0  → RAISE 40001 'CONFLICTO_VERSION … (V1)' DETAIL 'actualizado=V1'
                                        NADA se escribe; el cliente:
                                          · no reintenta, no fusiona, lo local queda intacto
                                          · enseña ConflictoGuardado y PAUSA el autosave
                                          · "Ver la versión del servidor"  → respalda lo local en
                                            localStorage[costeador-vonhaucke-conflicto-<id>], carga la fila
                                          · "Volver a aplicar mis cambios" → UN clic: re-guarda lo local con V1
                                            (DOCUMENTO COMPLETO: el aviso lo dice antes de pulsar)
tras "Ver la versión del servidor" ─► aviso RespaldoConflicto (persistente, sobrevive recarga/reapertura
                                      en esta computadora) con lo que difiere; la persona decide:
            ├─ "Recuperar mis cambios" → relee la fila (V2), fusión de 3 vías POR CAMPO, guarda con V2;
            │                            si reemplaza algo que el otro también cambió → confirm()
            └─ "Descartar mi respaldo" → confirm(); sólo con "Aceptar" se borra la clave
```

### 2.1 SQL — `supabase/migrations/PROPUESTA_vh148_control_optimista_cotizacion.sql`

| Objeto | Cambio |
|---|---|
| `private_api.cotizacion_segura(bigint)` | cuerpo de producción + `'actualizado', c.actualizado` en el payload (no es economía: viaja a todo rol). |
| `private_api.actualizar_cotizacion_segura(bigint, jsonb)` | **NO se toca** (rediseño de composición, §2.3): es el núcleo económico único — el de producción o el de VH-035c si se aplica. |
| `private_api.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)` | nueva, **sin default** y **sin copia del cuerpo de guardado**: (1) `NULL` explícito → delega tal cual en el núcleo; (2) mismas compuertas previas que el núcleo y en el mismo orden (`no autorizado`, `patch invalido`, `rol sin permiso`, `select … for update`, `cotizacion no existe`, `sin acceso`, `no editable`) para no revelar la versión a quien no tiene acceso; (3) `if v_c.actualizado is distinct from p_actualizado_esperado then raise … errcode '40001'`, mensaje con el ISO del servidor (`to_json(v_c.actualizado)#>>'{}'`, mismo formato que `cotizacion_segura`), `DETAIL 'actualizado=<ISO>'`, `HINT`; (4) `return private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch)`. El candado de la fila dura hasta el fin de la transacción: nadie escribe entre la comparación y el UPDATE del núcleo. |
| `public.actualizar_cotizacion_segura(bigint, jsonb)` | se conserva (clientes viejos, app con bandera apagada). |
| `public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)` | nueva sobrecarga **sin default** (con default, `f(id, patch)` sería ambigua en SQL: "function is not unique", verificado en PGlite). PostgREST escoge por los nombres del body. Grants espejo (authenticated, service_role; anon no). `NOTIFY pgrst, 'reload schema'`. |
| Pre/postcondición | `DO` al inicio: exige que exista el núcleo `(bigint, jsonb)`. `DO` al final: ninguna sobrecarga pública o privada de `actualizar_cotizacion_segura` con `DEFAULT` (si no, aborta: llamadas ambiguas). |
| Rollback | bloque al final del archivo entre `-- >>> ROLLBACK VH-148 INICIO` / `FIN` (dentro de `/* */`): quita las sobrecargas de 3 args en public y private y devuelve `cotizacion_segura` a producción byte a byte. **No toca el núcleo de dos argumentos** (si VH-035c estaba, sigue). Las pruebas lo ejecutan. |

Precisión: `timestamptz` compara al **microsegundo**. El cliente devuelve la cadena ISO **tal cual** la recibió
(nunca la pasa por `new Date()`, que la truncaría a milisegundos y daría conflictos falsos). El error también trae
el ISO en el mismo formato para que "Volver a aplicar" use la versión fresca sin releer la fila.

### 2.2 Cliente (detrás de bandera)

* **Bandera**: `VITE_CONTROL_OPTIMISTA=1` (build) **o** `localStorage['vh:controlOptimista']==='1'` (runtime;
  necesaria porque el E2E corre contra un dev server ya levantado y no puede fijar variables de build; también
  sirve a QA). Apagada → el cliente **nunca** manda `p_actualizado_esperado` (= hoy). Prendida → lo manda **sólo si
  conoce la versión**; contra la RPC vieja `cotizacion_segura` no devuelve `actualizado` → nunca se invoca la
  sobrecarga inexistente (sin `PGRST202`), la app sigue guardando sin control. Probado en E2E (`rpcVieja`).
* `src/datos/conflictoGuardado.js` (puro): bandera, `esperadoParaGuardar`, `esConflictoGuardado` (code `40001` o
  texto `CONFLICTO`), `actualizadoDeError` (DETAIL → mensaje), `mensajeConflicto`, `claveRespaldoConflicto`,
  `respaldoConflicto`, `aplicarFilaServidor` (misma proyección que "Abrir" del Archivo).
* `src/datos/cotizaciones.js` · `guardarCotizacion(…, { actualizadoEsperado })`: añade `p_actualizado_esperado` sólo
  cuando viene; `clasificarErrorGuardado` → `'conflicto'`; devuelve `{ motivo:'conflicto', actualizadoServidor }`
  (sin `soltarId`) y, en guardados confirmados, `actualizado` (null con la RPC vieja). Nota: la llamada RPC vive aquí,
  no en `src/nube.js` (que no se tocó).
* `src/App.jsx` (zona `guardarEnNube`): la versión conocida vive en `estado.cotizacion.actualizado` (la fija
  `cotizacion_segura` al abrir y cada guardado confirmado; persiste con el estado → sobrevive recargas; `paraGuardar`
  no la incluye, así que no viaja en el patch ni cambia la firma). `conflicto` + `conflictoRef`; con conflicto
  pendiente `guardarEnNube` devuelve `motivo:'conflicto-pendiente'` (autosave, verificar emisión, emitir y
  solicitar aprobación quedan detenidos). Handlers `verVersionDelServidor` / `reaplicarMisCambios`. Se limpia al
  abrir otra cotización, al empezar de cero y al `soltarId`.
* `src/componentes/ConflictoGuardado.jsx`: `role="alert"`, `data-testid="conflicto-guardado"`,
  `data-actualizado=<V servidor>`: "Guardado detenido. Otra persona cambió esta cotización a las HH:MM. Tus cambios
  siguen en esta computadora." + botones "Ver la versión del servidor" y "Volver a aplicar mis cambios". Montado al
  inicio de `<main>` (visible en cualquier pantalla mientras el autosave esté en pausa).

Efecto colateral deliberado: un **respaldo local** restaurado trae su `actualizado` de cuando se exportó; si el
servidor avanzó desde entonces, el primer guardado tras restaurar pide decidir (es exactamente la situación en la que
se quiere avisar).

### 2.2 bis · Recuperación explícita y reapertura (segunda vuelta, auditoría de Dirección)

Hallazgo de la auditoría: *"Ante conflicto, conserva ambas versiones y exige resolución explícita. Prueba guardado,
conflicto, recuperación y reapertura."* Antes de esta vuelta el respaldo `costeador-vonhaucke-conflicto-<id>` se
escribía pero **no había forma de recuperarlo desde la app** y la reapertura no estaba probada.

**Qué hay ahora (todo detrás de la misma bandera; apagada = exactamente lo de antes, probado en E2E):**

* `src/componentes/RespaldoConflicto.jsx` (`data-testid="respaldo-conflicto"`): aviso **persistente** mientras exista
  respaldo para la cotización abierta (se lee de localStorage por `estado.cotizacion.id`, así que sobrevive recargas y
  reaperturas **en esta computadora**). Enseña una tabla *Campo · Tu respaldo · Versión del servidor* (siempre
  Cliente, Partidas = renglones · piezas, Total con la misma escalera de `totales.js`; Folio, Acomodo y cada % sólo si
  difieren; las filas distintas resaltadas) y el plan: *"Se aplicarán tus cambios en: …"*, *"Se queda lo de la otra
  persona en: …"*, y si hay choque *"Los dos cambiaron …: tu versión REEMPLAZARÁ la de la otra persona (se pide
  confirmación)"*. Botones **"Recuperar mis cambios"** y **"Descartar mi respaldo"** (deshabilitados mientras haya
  un guardado detenido sin resolver encima).
* `ConflictoGuardado.jsx` ahora explica antes de pulsar: *"«Ver la versión del servidor» guarda tu versión aparte…
  «Volver a aplicar mis cambios» guarda tu versión COMPLETA y reemplaza lo que la otra persona cambió."* (el clic
  único de "Volver a aplicar" no cambió: es la salida de documento completo y así lo dice).
* `src/App.jsx`: `baseNube` (ref) = campos comparables que esta pestaña sabe que están en el servidor (al abrir del
  Archivo, al cargar la versión del servidor, tras cada guardado confirmado; `null` al empezar de cero, al restaurar un
  respaldo manual o al soltar el id). Viaja **dentro** del respaldo (`respaldo.base`). Handlers
  `recuperarMisCambios` y `descartarMiRespaldo`; `guardarEnNube({ estadoForzado })` guarda el estado ya mezclado; un
  `recuperandoRef` frena el autosave mientras se guarda lo recuperado (sin segundo envío con versión vieja).
  "Ver la versión del servidor" **ya no carga el servidor si no pudo escribir el respaldo** (antes seguía y se perdía
  lo local si localStorage fallaba).

**Semántica de la mezcla (la implementada, explícita):** fusión de **tres vías por campo de primer nivel**
(`CAMPOS_MEZCLA` = cliente, folio, partidas, acomodo, descuento/contingencia/maniobras/flete/IVA/anticipo %), con
`base` = `respaldo.base`, `local` = el respaldo, `servidor` = la fila **releída al pulsar** "Recuperar":

| local vs base | servidor vs base | resultado |
|---|---|---|
| igual | igual / distinto | se queda lo del servidor (si sólo lo cambió la otra persona: *conservado*) |
| distinto | igual | se aplica lo local (*aplicado*) |
| distinto | distinto (y local ≠ servidor) | **choque**: se aplica lo local **sólo tras `confirm()`**; "Cancelar" no toca nada |
| base desconocida | — | todo campo distinto = choque → recuperación de **documento completo** para esos campos, con confirmación |

`partidas` y `acomodo` son **una unidad cada uno**: no se mezclan renglones de BOM/costos/acomodo (decisión de
Dirección). Si los dos tocaron las partidas, gana la versión completa que la persona confirme. Los % se comparan
**efectivos** (`totalesCotizacion`): local puede tener `ivaPct` vacío ("el de parámetros") y el servidor guarda 16; sin
normalizar salían como cambios fantasma (lo atrapó el E2E). Lo mezclado se guarda con el `actualizado` recién leído
(`p_actualizado_esperado` = V fresca): si alguien guardó entre la lectura y el guardado, vuelve el 40001 y el aviso
de conflicto; el respaldo **se queda**.

**Ciclo de vida del respaldo (puro, `conflictoGuardado.js`, storage inyectable, nunca lanza):**
`leerRespaldoConflicto` (null si no hay, JSON roto, versión desconocida o storage bloqueado) ·
`guardarRespaldoConflicto` **apila**: un segundo conflicto sin resolver no pisa el primero (`anteriores`), resolver el
de arriba deja visible el siguiente · `descartarRespaldoConflicto(storage, id, confirmar)` sólo borra si
`confirmar()` devuelve exactamente `true` · `retirarRespaldoRecuperado(storage, id, r)` sólo borra si
`r.guardado === true` (conflicto nuevo, red, época → se queda). Si el respaldo ya coincide con el servidor
(nada que aplicar), "Recuperar" lo retira con aviso (no hay información que perder).

**Reapertura:** probada en E2E en dos sentidos: (1) en la misma computadora, recargar con un respaldo pendiente deja
el aviso y el respaldo idénticos (con su base) y no escribe; (2) tras recuperar, cerrar las dos pestañas y abrir la
cotización desde el Archivo en un contexto nuevo (otra computadora, localStorage vacío) trae **el folio recuperado de
B y el cliente de A que B no tocó**, con la versión que dejó la recuperación, y se sigue editando sin conflicto.

### 2.3 Composición con VH-035c (y 20261010170000 / vh035b): **cualquier orden**

**Defecto del borrador anterior** (corregido 2026-10-13): esta propuesta hacía `DROP` de la función privada de dos
argumentos y creaba la de tres **con `DEFAULT NULL` y su propia copia del cuerpo de producción**. Si VH-035c (o
vh035b / 20261010170000) se aplicaba **después**, recreaba la de dos argumentos: (a) toda llamada de dos argumentos
quedaba ambigua ("function … is not unique") y (b) los guardados **con** `p_actualizado_esperado` pasaban por la copia
vieja, **sin** las protecciones de VH-035c (el vendedor volvía a borrar la economía de Dirección).

**Diseño actual**:

```
public.f(id, patch)            ──► private_api.f(id, patch)              ◄── NÚCLEO ÚNICO (producción o VH-035c)
public.f(id, patch, esperado)  ──► private_api.f(id, patch, esperado)
                                     ├─ esperado NULL → núcleo
                                     ├─ compuertas previas (mismo orden que el núcleo) + SELECT … FOR UPDATE
                                     ├─ actualizado ≠ esperado → RAISE 40001 (DETAIL actualizado=<ISO>), nada se escribe
                                     └─ return núcleo(id, patch)   (mismo guardado que la ruta de dos argumentos)
```

- El núcleo de dos argumentos es de VH-035c (si se aplica) y VH-148 **nunca** lo redefine ni lo borra.
- Ninguna sobrecarga lleva `DEFAULT` ⇒ `f(id, patch)` sólo casa con la de dos y `f(id, patch, ts)` sólo con la de tres,
  también con notación por nombre (la que usa PostgREST).
- **Orden de aplicación: CUALQUIERA.** vh035c→vh148: el 3-args nace delegando en el núcleo VH-035c. vh148→vh035c: el
  `CREATE OR REPLACE` de VH-035c sustituye el núcleo y el 3-args, que delega por nombre/firma, queda detrás de él sin
  tocar nada. Ambos archivos verifican al final que no haya sobrecargas con `DEFAULT`; si quedó instalado el borrador
  viejo, VH-035c aborta y VH-148 también (precondición: falta el núcleo), en vez de componer en silencio.
- **Rollback independiente**: revertir VH-148 deja VH-035c intacto (sólo quita los 3-args y restaura
  `cotizacion_segura`); revertir VH-035c deja VH-148 funcionando sobre el núcleo de producción.

Cómo verificarlo:

```
npx vitest run supabase/tests/composicionVh035cVh148.test.js     # 21 casos, ≈30 s
```

En **los dos órdenes** prueba: estructura (2 privadas + 2 públicas, 0 `DEFAULT`, el 3-args no contiene
`update public.cotizaciones` y delega; md5 del núcleo = el de VH-035c); (a) versión vieja por 3 args → 40001 con DETAIL
y la fila `c::text` byte a byte igual, vendedor ajeno → `sin acceso`; (b) vendedor por 3 args con versión correcta =
mismas partidas que por 2 args (economía anidada, `cost_status`, autoridad `aprobado`/`estado_costo`/`lista_precio_item_id`
intactos, `cambios_rechazados`), economía colada descartada; (c) cambio de pieza/BOM por 3 args → `RECOSTEO_PRODUCTO_CAMBIADO`,
`cotizacion_emitible` = `ECONOMICS_INCOMPLETE` para vendedor y Dirección, `emitir_revision_v2` rechaza, 0 revisiones; re-pin
de versión → 42501 y fila igual; Dirección recostea por 3 args → emitible; (d) 2 args posicional, por nombre, privada
directa y `NULL` explícito, sin ambigüedad; (e) rollback de VH-148 → VH-035c sigue (md5 del núcleo, fusión, STALE,
compuerta); rollback de VH-035c → núcleo/strip/compuerta = producción por md5 y el control 40001 sigue; los dos rollbacks
en cualquier orden → producción byte a byte; defensa contra el borrador viejo. Se comprobó además que la misma prueba
**falla** (8 ✗) si se sustituye este archivo por el borrador anterior.

## 3. Mock E2E — `e2e/nubeFalsa.js`

`cotizacion_segura` devuelve `actualizado`; `actualizar_cotizacion_segura` honra `p_actualizado_esperado` (mismo
lugar que el SQL; `null` explícito = sin control; distinto → body PostgREST `{code:'40001', message, details:'actualizado=…', hint}`,
nada cambia, `f.conflictos++`). `f.esperados` registra qué versión mandó cada intento (`undefined` = llamada vieja).
Opción `rpcVieja: true` = producción sin la migración (sin `actualizado`; 3 args → 404 `PGRST202`). Todo lo demás
(`preservaEconomia`, strip, idempotencia, emisión) intacto. Status HTTP del conflicto en el mock: 409 (PostgREST
reporta la clase 40 como 500; el cliente decide por `code`/mensaje, no por status — **verificar en RC con curl**).
Composición: con `crearNubeFalsa({ preservaEconomia: 'vh035c' })` el control de versión corre ANTES y el guardado
aceptado pasa por el espejo JS del núcleo VH-035c (misma composición que el SQL); `e2e/persistenciaVh035c.e2e.js`
guarda por la ruta de tres argumentos y verifica STALE + emisión bloqueada. El default sigue siendo producción.

## 4. Matriz de pruebas

| Capa | Archivo | Casos | Resultado |
|---|---|---|---|
| SQL real (PGlite) | `supabase/tests/controlOptimista.test.js` | 13: ANTES (sin `actualizado`, B pisa a A); DESPUÉS (`actualizado` a ambos roles y exacto al µs; A ok / B 40001 y fila idéntica / B recarga ok / DETAIL reutilizable; esperado inventado futuro o pasado → conflicto; firma de 2 args sigue; NULL explícito = sin control; Dirección↔vendedor↔diseño chocan por fila; trigger strip sigue; no autorizado / no existe / estado protegido / sin acceso antes que conflicto; `auth.uid()` en el wrapper nuevo; grants); ROLLBACK (3 args desaparece, 2 args guarda, una sola función privada) | **13/13** (≈8 s) |
| Puro | `src/datos/conflictoGuardado.test.js` | 18 | **18/18** |
| Puro (2ª vuelta) | `src/datos/conflictoGuardado.recuperacion.test.js` | 22: `camposMezcla`/`mismoValor` (orden de llaves, null≈''); mezcla de 3 vías (B folio + A cliente sin choque; choque mismo campo; partidas como unidad; mismo valor no cuenta; sin base = choque en todo lo distinto; no muta; normalizar % efectivos; textos); `resumenDiferencias` (filas fijas/condicionales, total, acomodo/%, `totalDe` que lanza); ciclo de vida (base en el respaldo; leer robusto; **pila** sin pisar; apilar/siguiente; **descartar sólo con `confirmar()===true`**; **retirar sólo con guardado confirmado**; storage que lanza; texto de descartar) | **22/22** |
| RPC cliente | `src/datos/cotizaciones.controlOptimista.test.js` | 7 (sin versión = llamada de hoy; versión tal cual; 40001 → conflicto sin soltar id; sin DETAIL; clasificación; RPC vieja → `actualizado:null`; crear) | **7/7** |
| Regresión vitest | `cotizaciones.*.test.js` | 39 | **39/39** |
| Suite vitest completa | `npx vitest run` | 2455 | 2452 ✓ · 3 ✗ **preexistentes y ajenas** (`bench/…productoTopologiaE2E`, `recoveryLane.test.js`, `recoverySource.test.js`: otra sesión está editando `src/nube.js`/`mapIaComps.js` en paralelo; no son de este cambio) |
| E2E | `e2e/concurrenciaOptimista.e2e.js` (bandera por `addInitScript`) | 7. Los 4 originales sin cambios en sus aserciones (+1 aserción aditiva: bandera apagada → tampoco hay aviso de respaldo): escenario completo A/B; Dirección↔vendedor; bandera apagada = hoy; bandera prendida + RPC vieja. **Nuevos (2ª vuelta):** (5) **guardado → conflicto → recuperación → reapertura**: A cambia cliente y guarda; B cambia folio → 40001, la fila no cambia; "Ver la versión del servidor" → pantalla = servidor, respaldo con `base`, tabla de diferencias y plan ("Se aplicarán tus cambios en: Folio." / "Se queda lo de la otra persona en: Cliente."), no escribe; **recarga** → aviso y respaldo idénticos; "Recuperar mis cambios" → sin confirm (no hay choque), `p_actualizado_esperado` = versión actual de A, **0 conflictos nuevos**, fila = cliente de A + folio de B, respaldo retirado, autosave no reenvía; **cerrar A y B, reabrir en contexto nuevo** → cliente de A + folio de B + versión de la recuperación, sin avisos, y se sigue guardando sin 40001. (6) **choque** (los dos cambian cliente): el plan advierte el reemplazo; "Recuperar" → confirm; Cancelar = nada se escribe y el respaldo sigue; Aceptar = guarda lo de B con la versión fresca, sin 40001, respaldo retirado. (7) **"Descartar mi respaldo"**: confirm con hora y "NO se puede recuperar"; Cancelar = clave intacta y aviso visible; Aceptar = clave borrada, aviso oculto, no escribe, servidor intacto | **7/7** (≈1.5 min) |
| SQL real (PGlite) · composición | `supabase/tests/composicionVh035cVh148.test.js` | 21 (ver §2.3): ambos órdenes, rollback de cada uno, ambos rollbacks, defensa contra el borrador viejo | **21/21** (rediseño de composición) |
| E2E regresión | `e2e/persistencia.e2e.js` + `e2e/emision.e2e.js` | 11 | **10 ✓ · 1 ✗** = el rojo conocido `persistencia.e2e.js:125` (VH-035, `costoUnitario` undefined), **exactamente igual que antes**; nada nuevo |
| Build | `npx vite build` | — | ✓ |

Segunda vuelta (2026-10-13): `npx vitest run src/datos` → **188 archivos, 1580/1580**; `npx vite build` ✓;
`e2e/persistencia.e2e.js` + `e2e/emision.e2e.js` → 10 ✓ · 1 ✗ = el mismo rojo conocido `persistencia.e2e.js:125`
(VH-035). Nota honesta: en la primera corrida de regresión fallaron además 4 de persistencia por **tiempo** (máquina
cargada por otras sesiones; una tardó 4.4 min sola); re-corridas aisladas → pasan.

Comandos: `npx vitest run supabase/tests/controlOptimista.test.js supabase/tests/composicionVh035cVh148.test.js src/datos/conflictoGuardado.test.js src/datos/conflictoGuardado.recuperacion.test.js src/datos/cotizaciones.controlOptimista.test.js` ·
`PW_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test e2e/concurrenciaOptimista.e2e.js`.

## 5. Rollback

1. **Cliente**: apagar la bandera (sin `VITE_CONTROL_OPTIMISTA` en el build; borrar `vh:controlOptimista` del
   localStorage de QA). Con la bandera apagada el cliente nuevo nunca manda el parámetro → funciona contra cualquier
   base (con o sin migración). No hace falta revertir código.
2. **SQL**: correr el bloque `ROLLBACK VH-148` del archivo (quita las sobrecargas de 3 args, devuelve
   `cotizacion_segura` a producción, `NOTIFY pgrst`; no toca el núcleo de dos argumentos, así que VH-035c, si estaba,
   sigue aplicada — probado en `composicionVh035cVh148.test.js`). Probado: tras el rollback la firma de dos argumentos guarda y `cotizacion_segura` vuelve a no
   traer `actualizado`. Un cliente con la bandera prendida contra la base revertida sigue funcionando (caso
   `rpcVieja` del E2E), porque la versión deja de llegar y por tanto deja de mandarse.

## 6. Lo que queda para Dirección

1. **Orden de despliegue**: (a) con VH-035c **cualquier orden** (§2.3; ya no hay que decidirlo); (b) aplicar `PROPUESTA_vh148…` en RC y
   verificar con curl: `cotizacion_segura` trae `actualizado`; llamada con `p_actualizado_esperado` viejo responde
   `code:"40001"` (anotar el status HTTP real: se espera 500 por PostgREST); llamada de dos argumentos sigue ok;
   (c) después, build del cliente con `VITE_CONTROL_OPTIMISTA=1`. **Nunca al revés**: el cliente con bandera va
   detrás del SQL (aunque el cliente degrada bien, el control sólo existe con el SQL).
2. Qué pasa con las **pestañas ya abiertas** al desplegar: no conocen versión hasta reabrir/guardar una vez
   (`cotizacion_segura` o el primer guardado confirmado se la da); mientras, guardan como hoy.
3. ~~El respaldo `costeador-vonhaucke-conflicto-<id>` no tiene pantalla para restaurarlo~~ → resuelto en la segunda
   vuelta (§2.2 bis). Límites que quedan, dichos sin adornos:
   * el respaldo vive **sólo en el navegador donde ocurrió el conflicto** (localStorage): otra computadora no lo ve;
     si se borran los datos del sitio, se pierde. No se sube a la nube (decisión: no escribir nada sin la persona);
   * la `base` no persiste al recargar **antes** del conflicto (vive en un ref): si B recarga, edita y choca, su
     respaldo no trae base y la recuperación es de documento completo para todo campo distinto, con confirmación
     (seguro pero menos fino). Persistirla costaría duplicar `partidas` en localStorage en cada guardado;
   * la granularidad es por campo de primer nivel: dos personas que tocan **renglones distintos** de `partidas`
     chocan igual (se pide confirmación y gana la versión completa elegida). Es deliberado (no mezclar BOM a ciegas);
   * "Volver a aplicar mis cambios" sigue siendo de documento completo con un clic (así lo exigía el E2E original);
     el aviso ahora lo dice antes de pulsar;
   * la vista previa del aviso compara contra lo que hay en pantalla; al pulsar "Recuperar" se recalcula contra la
     fila releída (puede diferir si alguien guardó mientras tanto, y entonces manda lo releído);
   * "Recuperar" con un respaldo que ya coincide con el servidor lo retira sin confirm (no hay nada que perder).
   Otros pendientes (no bloquean): `emision` sobre un conflicto pendiente devuelve `motivo:'conflicto-pendiente'` (bloqueo correcto, sin
   texto propio en la UI de emisión); la nube falsa no modela el status 500 de PostgREST (usa 409).
