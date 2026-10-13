# VH-148 · Control optimista del guardado de cotizaciones (2026-10-13)

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
```

### 2.1 SQL — `supabase/migrations/PROPUESTA_vh148_control_optimista_cotizacion.sql`

| Objeto | Cambio |
|---|---|
| `private_api.cotizacion_segura(bigint)` | cuerpo de producción + `'actualizado', c.actualizado` en el payload (no es economía: viaja a todo rol). |
| `private_api.actualizar_cotizacion_segura(bigint, jsonb)` | **DROP** (ver §2.3) y se crea `(bigint, jsonb, timestamptz default null)`: cuerpo de producción (fixture `private_api_prod_20261013.sql`, md5 `84da6ec0…`) + la verificación tras `for update` / acceso / estado y antes de validar el patch: `if p_actualizado_esperado is not null and v_c.actualizado is distinct from p_actualizado_esperado then raise … errcode '40001'`, mensaje con el ISO del servidor (`to_json(v_c.actualizado)#>>'{}'`, mismo formato que `cotizacion_segura`), `DETAIL 'actualizado=<ISO>'`, `HINT`. |
| `public.actualizar_cotizacion_segura(bigint, jsonb)` | se conserva (clientes viejos, app con bandera apagada). |
| `public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)` | nueva sobrecarga **sin default** (con default, `f(id, patch)` sería ambigua en SQL: "function is not unique", verificado en PGlite). PostgREST escoge por los nombres del body. Grants espejo (authenticated, service_role; anon no). `NOTIFY pgrst, 'reload schema'`. |
| Rollback | bloque al final del archivo entre `-- >>> ROLLBACK VH-148 INICIO` / `FIN` (dentro de `/* */`): quita la sobrecarga de 3 args en public y private, recrea los cuerpos de producción byte a byte. La prueba lo ejecuta. |

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

### 2.3 ⚠️ Orden con las otras propuestas (vh035b / 20261010170000)

Esas migraciones redefinen `private_api.actualizar_cotizacion_segura(bigint, jsonb)` con **dos** argumentos. Si se
aplican **después** de esta, Postgres queda con dos sobrecargas (2 y 3 args con default) y **toda** llamada de dos
argumentos falla con "function … is not unique" (verificado en PGlite). Opciones para Dirección: (a) aplicar primero
vh035(b) y **al final** vh148; (b) rebasear el cuerpo de vh035b sobre la firma de tres argumentos. Esta propuesta usa
el cuerpo de producción tal cual (no incluye la preservación de economía de VH-035), como se pidió.

## 3. Mock E2E — `e2e/nubeFalsa.js`

`cotizacion_segura` devuelve `actualizado`; `actualizar_cotizacion_segura` honra `p_actualizado_esperado` (mismo
lugar que el SQL; `null` explícito = sin control; distinto → body PostgREST `{code:'40001', message, details:'actualizado=…', hint}`,
nada cambia, `f.conflictos++`). `f.esperados` registra qué versión mandó cada intento (`undefined` = llamada vieja).
Opción `rpcVieja: true` = producción sin la migración (sin `actualizado`; 3 args → 404 `PGRST202`). Todo lo demás
(`preservaEconomia`, strip, idempotencia, emisión) intacto. Status HTTP del conflicto en el mock: 409 (PostgREST
reporta la clase 40 como 500; el cliente decide por `code`/mensaje, no por status — **verificar en RC con curl**).

## 4. Matriz de pruebas

| Capa | Archivo | Casos | Resultado |
|---|---|---|---|
| SQL real (PGlite) | `supabase/tests/controlOptimista.test.js` | 13: ANTES (sin `actualizado`, B pisa a A); DESPUÉS (`actualizado` a ambos roles y exacto al µs; A ok / B 40001 y fila idéntica / B recarga ok / DETAIL reutilizable; esperado inventado futuro o pasado → conflicto; firma de 2 args sigue; NULL explícito = sin control; Dirección↔vendedor↔diseño chocan por fila; trigger strip sigue; no autorizado / no existe / estado protegido / sin acceso antes que conflicto; `auth.uid()` en el wrapper nuevo; grants); ROLLBACK (3 args desaparece, 2 args guarda, una sola función privada) | **13/13** (≈8 s) |
| Puro | `src/datos/conflictoGuardado.test.js` | 18 | **18/18** |
| RPC cliente | `src/datos/cotizaciones.controlOptimista.test.js` | 7 (sin versión = llamada de hoy; versión tal cual; 40001 → conflicto sin soltar id; sin DETAIL; clasificación; RPC vieja → `actualizado:null`; crear) | **7/7** |
| Regresión vitest | `cotizaciones.*.test.js` | 39 | **39/39** |
| Suite vitest completa | `npx vitest run` | 2455 | 2452 ✓ · 3 ✗ **preexistentes y ajenas** (`bench/…productoTopologiaE2E`, `recoveryLane.test.js`, `recoverySource.test.js`: otra sesión está editando `src/nube.js`/`mapIaComps.js` en paralelo; no son de este cambio) |
| E2E nuevo | `e2e/concurrenciaOptimista.e2e.js` (bandera por `addInitScript`) | 4: escenario completo A/B (rechazo, local intacto, autosave en pausa, "Volver a aplicar", B sigue; A vieja → "Ver la versión del servidor", respaldo `costeador-vonhaucke-conflicto-<id>`, no escribe, A sigue); Dirección↔vendedor; bandera apagada = hoy (sin parámetro, último gana, sin aviso); bandera prendida + RPC vieja = guarda sin control y sin errores | **4/4** (41 s) |
| E2E regresión | `e2e/persistencia.e2e.js` + `e2e/emision.e2e.js` | 11 | **10 ✓ · 1 ✗** = el rojo conocido `persistencia.e2e.js:125` (VH-035, `costoUnitario` undefined), **exactamente igual que antes**; nada nuevo |
| Build | `npx vite build` | — | ✓ |

Comandos: `npx vitest run supabase/tests/controlOptimista.test.js src/datos/conflictoGuardado.test.js src/datos/cotizaciones.controlOptimista.test.js` ·
`PW_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test e2e/concurrenciaOptimista.e2e.js`.

## 5. Rollback

1. **Cliente**: apagar la bandera (sin `VITE_CONTROL_OPTIMISTA` en el build; borrar `vh:controlOptimista` del
   localStorage de QA). Con la bandera apagada el cliente nuevo nunca manda el parámetro → funciona contra cualquier
   base (con o sin migración). No hace falta revertir código.
2. **SQL**: correr el bloque `ROLLBACK VH-148` del archivo (recrea cuerpos de producción, quita la sobrecarga,
   `NOTIFY pgrst`). Probado: tras el rollback la firma de dos argumentos guarda y `cotizacion_segura` vuelve a no
   traer `actualizado`. Un cliente con la bandera prendida contra la base revertida sigue funcionando (caso
   `rpcVieja` del E2E), porque la versión deja de llegar y por tanto deja de mandarse.

## 6. Lo que queda para Dirección

1. **Orden de despliegue**: (a) decidir el orden con vh035(b) (§2.3); (b) aplicar `PROPUESTA_vh148…` en RC y
   verificar con curl: `cotizacion_segura` trae `actualizado`; llamada con `p_actualizado_esperado` viejo responde
   `code:"40001"` (anotar el status HTTP real: se espera 500 por PostgREST); llamada de dos argumentos sigue ok;
   (c) después, build del cliente con `VITE_CONTROL_OPTIMISTA=1`. **Nunca al revés**: el cliente con bandera va
   detrás del SQL (aunque el cliente degrada bien, el control sólo existe con el SQL).
2. Qué pasa con las **pestañas ya abiertas** al desplegar: no conocen versión hasta reabrir/guardar una vez
   (`cotizacion_segura` o el primer guardado confirmado se la da); mientras, guardan como hoy.
3. Pendientes explícitos (fuera de alcance, no bloquean): el respaldo `costeador-vonhaucke-conflicto-<id>` no tiene
   todavía una pantalla para restaurarlo (se puede importar como respaldo manual desde la consola o añadir un botón
   al Archivo); `emision` sobre un conflicto pendiente devuelve `motivo:'conflicto-pendiente'` (bloqueo correcto, sin
   texto propio en la UI de emisión); la nube falsa no modela el status 500 de PostgREST (usa 409).
