# VH-148b · Control optimista FAIL-CLOSED (2026-10-14)

> **Actualización 14-oct (cierre pre-deploy):** el conflicto de versión ya no usa SQLSTATE `40001`. PostgREST reintenta `40001` sin fin; con PostgREST v12.2.3 real la llamada no regresaba. Ahora el código es **`PT409`**: PostgREST responde HTTP 409 y no reintenta. El mensaje y el DETAIL no cambian. Donde este documento dice `40001`, léase `PT409`. Evidencia: `VH148_DOS_CONEXIONES_20261014.md`.

Rama del worktree (base `claude/costing-app-architecture-psf02g` @ `6d1cd13`). **Producción no cambió**: no se
aplicó ninguna migración, no se corrió `supabase` CLI ni `apply_migration`, no se desplegó cliente ni Edge, no se
consultó producción en esta tarea (los hechos de producción son los medidos por Dirección el 14-oct, sólo lectura,
y el baseline/fixtures del repo). `src/motor/formulaAlba.js` no se tocó.

Todo es **PROPUESTA**:

| Archivo | Qué es |
|---|---|
| `supabase/migrations/PROPUESTA_vh148b_fail_closed_versiones.sql` | PASO 1 (servidor). Se aplica después de `PROPUESTA_vh148_control_optimista_cotizacion.sql`. Rollback en líneas `-- RB `. |
| `supabase/migrations/PROPUESTA_vh148c_retira_escrituras_sin_version.sql` | PASO 2. **Sólo** después de desplegar el cliente nuevo; rompe al cliente de producción actual (probado). Rollback en líneas `-- RB `. |
| `supabase/tests/vh148FailClosed.test.js` | SQL en PGlite con el SQL de producción: defectos (antes/después), rollback por md5, paso 2, composición. |
| `supabase/tests/vh148FailClosedCliente.test.js` | `src/nube.js` y `src/datos/cotizaciones.js` reales contra el SQL real (createClient → PGlite con `SET ROLE authenticated`). |
| `supabase/tests/helpers/baseVh148b.js` | Base PGlite de producción + cliente mínimo sobre PGlite (no es prueba). |
| `src/datos/conflictoGuardado.js` | Contrato único `{ ok:false, code:'VERSION_CONFLICT', status:409 }` y el texto exacto. |
| `src/datos/expedienteVersionado.js` | Orquestación pura del guardado de expediente (dependencias inyectadas). |
| `src/datos/versionConflicto.test.js` | Pruebas de lo puro. |
| `src/nube.js`, `src/datos/cotizaciones.js`, `src/componentes/{AsistenteEspecial,CocrearV3,CocrearV2,ConflictoGuardado}.jsx` | Cliente. |
| `e2e/concurrenciaOptimista.e2e.js` | Expectativas actualizadas al texto exacto y al fail-closed (**no se corrió** Playwright aquí). |

## 1. Huecos (medidos el 14-oct, reproducidos en PGlite)

| # | Hueco | Dónde | Prueba que lo demuestra |
|---|---|---|---|
| H1 | `actualizar_cotizacion_segura(id, patch, NULL)` = "sin control"; y la firma de 2 args no tiene control. | VH-148 (propuesta), producción | `H1 · cotización: p_actualizado_esperado = NULL…` |
| H1c | Cliente: con la bandera prendida y versión desconocida, `esperadoParaGuardar` devolvía `undefined` ⇒ caía en la firma de 2 args (escritura a ciegas). | `src/datos/conflictoGuardado.js` | cliente: `bandera prendida sin versión conocida (null) → 409 sin llamar` |
| H2 | Ningún trigger sube `actualizado`: un UPDATE directo (archivar) o una RPC que no lo toca (`vincular_cotizacion`, `asignar_folio_oficial`) deja la misma versión y VH-148 no ve el cambio. En expedientes la fecha la manda el navegador. Dos escrituras en la misma transacción comparten `now()`. | `cotizaciones`, `expedientes` | `H2 · …archivar…`, `H2 · …vincular_cotizacion…`, `H2 · expediente: la versión la pone el servidor…`, `cada escritura deja una versión ESTRICTAMENTE mayor…` |
| H3 | `cotizaciones_actualiza` + `GRANT UPDATE` a `authenticated`: partidas/cliente/totales se pueden escribir por PostgREST sin versión. | RLS/privilegios | `H3 · cotización: UPDATE directo de partidas/cliente…` |
| H4 | Expedientes: UPDATE directo con `revision: revActual + 1` sin comparar; el segundo editor pisa al primero. `guardarRevisionExpediente` se tragaba el 23505 del índice único `(expediente_id, rev)` y la pantalla decía "✓ Actualizado". `guardar_cocrear_seguro` sin revisión esperada (gana el último). | `src/nube.js:615,637,651`, `AsistenteEspecial.jsx:470-472` | `H4 · expediente: dos editores…`, `H4 · …RPC con revisión esperada…`, `H4 · …23505…`, `H4 · cocreación…`; cliente: `guardarRevisionExpediente … 23505 → 409` |
| H5 | `guard_producto_version` sólo protegía 4 columnas de una versión **certificada**; una **aprobada** se editaba en sitio; y una certificada se podía bajar a `preliminar` (permitido) y editar después (rodeo de 2 pasos). | `baseline/03_funciones.sql:613` | `H5 · ProductRevision APROBADA…`, `H5 · …CERTIFICADA: no se puede bajar a preliminar…` |

Qué YA protegía producción en ProductRevision (leído del baseline): certificada ⇒ pin completo
(`expediente_id`, `expediente_revision_id`, `bom_hash` = SHA-256 del BOM de esa revisión); certificada ⇒
inmutables `expediente_revision_id`, `bom_hash`, `dimensiones`, `atributos`; no se borra una certificada
(`guard_delete_producto_version`) salvo `vh.permitir_borrado_certificado = on`.

## 2. Diseño

### Servidor (PASO 1, `PROPUESTA_vh148b`)

1. **Versión escrita por el servidor** — `trg_vh148_version` (BEFORE INSERT OR UPDATE) en `cotizaciones` y
   `expedientes`: `actualizado := greatest(clock_timestamp(), OLD.actualizado + 1 µs)` (INSERT: `clock_timestamp()`).
   Estrictamente creciente en TODA escritura (directa, RPC, misma transacción). Por orden alfabético corre después
   de los 4 triggers de producción.
2. **VERSION_REQUIRED** — la sobrecarga de 3 args de VH-148 con `NULL` ⇒ SQLSTATE `22004` `VERSION_REQUIRED`.
   Mismo cuerpo de VH-148 en lo demás (delegación en el núcleo de 2 args, sin copiarlo).
3. **Firma de 2 args: se conserva en el PASO 1** (decisión documentada y probada). El cliente de producción
   (`c3.4-seller-safe` @ `c8dd2b3`, verificado con `git grep`) guarda con 2 args y edita expedientes por UPDATE
   directo; quitarla lo dejaría sin guardar (probado: 42501 en el bloque "PASO 2"). Su retiro es el PASO 2.
4. **UPDATE directo de cotizaciones** — `revoke update on cotizaciones from authenticated; grant update (activa)`.
   Dependencia verificada: el cliente actual y el de producción sólo escriben directo `activa`
   (`archivarCotizacion`, `src/datos/cotizaciones.js:387`; `c8dd2b3:src/datos/cotizaciones.js:314`). El archivado
   sigue funcionando y sube la versión.
5. **Expedientes**:
   * `trg_vh148_revision_cas` (BEFORE UPDATE): si `current_user = 'authenticated'` (PostgREST) exige
     `NEW.revision = OLD.revision + 1`; si no ⇒ `40001 CONFLICTO_VERSION`, DETAIL `revision=N`. Es exactamente lo
     que ya manda el cliente de producción (`revision: revActual + 1`): el primero pasa, el segundo choca. Las RPC
     `SECURITY DEFINER` (cocrear, registrar producto) no pasan por esta regla.
   * `actualizar_expediente_seguro(id, patch, p_revision_esperada)` (DEFINER; rol direccion/diseno como
     `exp_write_update`): candado, compara, actualiza SÓLO columnas de contenido (lista blanca; `revision`,
     `producto_*`, `cocrear`, `creado*`, `actualizado*` rechazados), sube la revisión y escribe el snapshot en
     `expediente_revisiones` **en la misma transacción**. Si ese `rev` ya existe ⇒ 23505 y nada queda a medias.
     `NULL` ⇒ `VERSION_REQUIRED`.
   * `guardar_cocrear_seguro(id, payload, p_revision_esperada)`: sobrecarga sin DEFAULT; compuertas en el orden del
     núcleo, compara `revision` (40001) y delega en el núcleo de 2 args. Crear (`id` NULL) delega directo.
6. **ProductRevision** — `guard_producto_version` = cuerpo de producción + bloque VH-148b: una versión
   `aprobado`/`certificado` no se degrada ni cambia `producto_id, etiqueta, dimensiones, acabados_permitidos,
   atributos, expediente_id, formula_version, creado`, ni un `expediente_revision_id` ya fijado; `bom_hash` sólo
   cambia al promover aprobado → certificado (`certificar_version`, probado). SQLSTATE `55000`
   `VERSION_PUBLICADA_INMUTABLE`. Escape de mantenimiento por transacción:
   `set_config('vh.permitir_edicion_version_publicada','on', true)` (mismo patrón que el borrado de certificadas).
7. Postcondiciones en el archivo: ninguna sobrecarga con DEFAULT; triggers instalados. Idempotente (probado).

### PASO 2 (`PROPUESTA_vh148c`)

`revoke execute` de `actualizar_cotizacion_segura(bigint,jsonb)` y `guardar_cocrear_seguro(bigint,jsonb)` y
`revoke update on expedientes` para `authenticated`. Los núcleos privados siguen (las sobrecargas con versión
delegan en ellos). `service_role` intacto.

### Cliente

* Contrato único (`src/datos/conflictoGuardado.js`): 40001 / 23505 / `VERSION_REQUIRED` / `CONFLICTO_VERSION` ⇒
  `{ ok:false, code:'VERSION_CONFLICT', status:409, error: MENSAJE }`; `mensajeConflicto()` y
  `mensajeEscritura()` devuelven **exactamente** `Existe una versión más reciente. Recarga o compara antes de guardar.`
  El banner `ConflictoGuardado` muestra sólo ese texto (`data-testid="conflicto-mensaje"`).
* Sin reintento silencioso ni fusión: las pruebas cuentan las llamadas que salen (1 en conflicto, 0 sin versión) y
  comparan la fila del otro byte a byte.
* Cotización: con la bandera prendida y versión desconocida (`null`) **no se escribe** (antes: firma de 2 args);
  la recuperación de una creación perdida también guarda con versión.
* Expediente (AsistenteEspecial): bandera prendida ⇒ `actualizar_expediente_seguro` con `revActual`; apagada ⇒
  UPDATE directo (protegido por el CAS del servidor) y snapshot cuyo error ya no se traga. Orquestación en
  `src/datos/expedienteVersionado.js`.
* Cocreación: `guardarCocrearSeguro` manda `p_revision_esperada` = última revisión vista **en esta pestaña**
  (registro llenado por `cargarCocrearSeguro`/`guardarCocrearSeguro`); sin revisión conocida no escribe.
* Bandera: la misma de VH-148 (`VITE_CONTROL_OPTIMISTA=1` o `localStorage['vh:controlOptimista']='1'`). Apagada, el
  cliente se comporta como hoy salvo que los errores de versión del servidor (CAS de expedientes, 23505) ahora se
  reportan con el contrato 409 en vez de tragarse.

## 3. Orden de aplicación y compatibilidad

1. **Preflight (sólo lectura, en producción, antes de aplicar)**:
   ```sql
   -- md5 calculados en PGlite con el SQL del baseline / fixtures (mismo método con el que los md5 de emisión
   -- coinciden con producción). Si alguno difiere: drift, revisar antes de aplicar.
   select md5(pg_get_functiondef('public.guard_producto_version()'::regprocedure));                      -- 31710114a842845e800196333c07199f
   select md5(pg_get_functiondef('private_api.guardar_cocrear_seguro(bigint,jsonb)'::regprocedure));     -- 866f8f544c05725ff6f8c40cf03678ab
   select md5(pg_get_functiondef('private_api.actualizar_cotizacion_segura(bigint,jsonb)'::regprocedure)); -- f20eb954874b8e483d89cccc7081339f (VH-035c)
   select to_regprocedure('private_api.actualizar_cotizacion_segura(bigint,jsonb,timestamptz)');         -- NULL hoy; tras VH-148: md5 d73830569bd50e2c3cbad6817407fc97
   select grantee, privilege_type, column_name from information_schema.column_privileges
    where table_schema='public' and table_name='cotizaciones' and grantee in ('authenticated','anon');
   select tgname from pg_trigger where tgrelid='public.cotizaciones'::regclass and not tgisinternal;      -- los 4 de producción
   ```
   (El REVOKE de tabla quita también los privilegios UPDATE de columna previos; el baseline sólo tiene los de
   tabla. Si el preflight muestra UPDATE de columna adicionales, decidir antes.)
2. `PROPUESTA_vh148_control_optimista_cotizacion.sql` (requisito; precondición verificada por vh148b).
3. `PROPUESTA_vh148b_fail_closed_versiones.sql`.
4. Desplegar el cliente nuevo con `VITE_CONTROL_OPTIMISTA=1`; esperar a que no quede ningún cliente viejo abierto.
5. `PROPUESTA_vh148c_retira_escrituras_sin_version.sql`.

**VH-035c** (en producción desde el 13-oct; la base de las pruebas la incluye y verifica el md5 del wrapper de
emisión `cf6ef6a3…`): vh148b no toca el núcleo de 2 args ni `strip_seller_economics_on_cotizacion_write`; el
guardado con versión pasa por la fusión de VH-035c (probado: el costo de Dirección sobrevive al guardado del
vendedor con versión). **SEG-01 / SEG-01b**: tocan `evaluar_emision_cotizacion` (privada y wrapper) y
`motivos_autoridad_costeo`; vh148b no las toca. Probados tres órdenes (SEG→VH, VH→SEG, y base sin VH-035c con
VH-148/148b antes de VH-035c→SEG): los md5 de los objetos de cada propuesta son idénticos a aplicarla sola, el
conflicto 40001 / `VERSION_REQUIRED` funcionan y el gate SEG-01 sigue en `BLOCKED` para el snapshot "nogal".
Efecto esperado y deseado: emitir / asignar folio / vincular **suben la versión**, así que una pestaña abierta con
la versión anterior recibe 409 en su siguiente guardado.

## 4. Evidencia

### SQL sin la propuesta (falla) → con la propuesta (pasa)

`VH148B_OMITIR=1 npx vitest run supabase/tests/vh148FailClosed.test.js -t "CON la propuesta"` (arma la base "CON"
SIN aplicar el archivo): **15 fallan, 7 pasan** (los 7 son controles de compatibilidad). Mensajes:

```
× H1 … NULL ya no salta el control            → expected undefined to be '22004'   (guardó sin control)
× H2 … archivar sube la versión               → expected true to be false          (misma versión tras el UPDATE)
× H2 … vincular_cotizacion sube la versión    → expected true to be false
× H3 … UPDATE directo de partidas se rechaza   → expected undefined to be '42501'   (se escribió)
× H4 … dos editores por UPDATE directo        → expected undefined to be '40001'   (el segundo pisó)
× H2 … expediente: versión del servidor       → expected false to be true          (quedó la fecha del navegador)
× H4 … RPC con revisión esperada              → function public.actualizar_expediente_seguro … does not exist
× H4 … 23505 no deja la fila a medias         → expected '42883' to be '23505'
× H4 … cocreación con revisión vieja          → (sobrecarga inexistente)
× H5 … APROBADA no se edita en sitio          → expected undefined to be '55000'   (se editó)
× H5 … CERTIFICADA no se baja a preliminar    → expected undefined to be '55000'   (se degradó)
× versión estrictamente mayor en la misma transacción → expected false to be true
```

En la suite normal esos mismos defectos corren también como `it.fails` contra producción + VH-148 (bloque
"SIN la propuesta"), así que si alguien rompe la base de pruebas o la propuesta deja de ser necesaria, se ve.

### Cliente viejo (falla) → cliente nuevo (pasa), contra el SQL real

Corrida única con `src/nube.js`, `src/datos/cotizaciones.js` y `src/datos/conflictoGuardado.js` de `HEAD`
(`6d1cd13`) y luego restaurados: `supabase/tests/vh148FailClosedCliente.test.js` → **8 fallan, 2 pasan** (los 2 son
controles: cocreación con bandera apagada y archivar):

```
× guardarRevisionExpediente 23505 → 409          → expected undefined to deeply equal { ok: true }   (se tragaba todo)
× error que no es de versión vuelve como error   → Cannot read properties of undefined (reading 'ok')
× expediente ruta de producción, mensaje exacto  → mensajeEscritura is not a function
× expediente bandera prendida                    → deps.actualizarExpedienteSeguro is not a function
× expediente sin revisión conocida               → nube.actualizarExpedienteSeguro is not a function
× cocreación con revisión vieja                  → expected { ok: true, revision: 3, … } to match { ok: false, … }   (B pisó)
× cotización B con versión vieja → 409            → expected { id, guardado: false, …(2) } to match { ok: false, code, status … }
× cotización bandera prendida sin versión         → expected { id: 2, guardado: true, … } to match { ok: false … }   (escribió a ciegas)
```

### Rollback

`VH-148b · ROLLBACK (líneas -- RB)`: huella antes de aplicar (md5 de `pg_get_functiondef` de las 8 funciones
involucradas, existencia de las 6 nuevas, triggers de las 3 tablas, `relacl` de `cotizaciones` y `attacl` de cada
columna) = huella tras el rollback (`toEqual`). Además se prueba que con la propuesta la huella sí cambia y que tras
el rollback `NULL` vuelve a ser "sin control" (el rollback es real). Paso 2: su rollback devuelve el guardado del
cliente viejo (probado).

### Suite completa

| Entorno | Antes (`6d1cd13`) | Después |
|---|---|---|
| `npx vitest run --exclude '.claude/**' --exclude 'node_modules/**'` | 332 archivos, 3000 pruebas, 0 fallos | 335 archivos, 3072 pruebas, 0 fallos (exit 0) |
| `VERCEL_ENV=preview CARRIL_RC=si` (mismo comando) | 332 archivos, 3000 pruebas, 0 fallos | 335 archivos, 3072 pruebas, 0 fallos (exit 0) |

## 5. Lo que NO se pudo verificar

* **Nada se corrió contra producción.** md5 de `guard_producto_version` y `guardar_cocrear_seguro` del baseline
  (10-oct) no se re-verificaron contra producción hoy: por eso el preflight. Los md5 de emisión y del wrapper de
  VH-035c sí coinciden con los leídos de producción el 13-oct (la prueba lo exige).
* **Privilegios de columna de `cotizaciones`**: el baseline sólo tiene privilegios de tabla; en las pruebas se
  asume SELECT de todas las columnas menos `partidas`/`totales` (P0-08). El preflight lo confirma.
* **Concurrencia real**: PGlite tiene una conexión. Se prueba el intercalado (A lee, B lee, A guarda, B guarda con
  versión vieja), no la espera en el candado entre dos transacciones simultáneas.
* **No cargados en la base de pruebas**: la política RESTRICTIVE `qa_fixture_isolation_cotizaciones`, RLS de
  `permitidos` (se da SELECT directo), el trigger `canonicalizar_spatial_spec_producto_version` (sólo INSERT) y
  `registrar_producto_desde_expediente` (no se ejercita).
* **Playwright no se corrió**: `e2e/concurrenciaOptimista.e2e.js` se actualizó al texto exacto y al fail-closed
  (el caso "bandera prendida contra RPC vieja" ahora espera aviso y CERO escrituras) pero no se ejecutó.
* PostgREST real: la selección de sobrecarga por nombres del body se emula en las pruebas con notación nombrada
  (`p_x => $1`); no se probó con PostgREST real.

## 6. Riesgos y decisiones abiertas

* **Primer guardado tras activar la bandera**: una cotización abierta antes (estado local sin `actualizado`)
  mostrará el aviso 409 en el primer guardado. Es fail-closed a propósito; "Ver la versión del servidor" o "Volver
  a aplicar mis cambios" lo resuelven (este último relee la versión).
* **Emitir / folio / vincular suben la versión**: una pestaña abierta durante esas acciones recibe 409 en su
  siguiente guardado (correcto, pero más avisos que hoy).
* **`registrar_producto_desde_expediente`** hace `update producto_versiones set estado_tecnico = …` sobre la versión
  existente de la misma etiqueta; si el expediente pasó de `aprobado` a `borrador` SIN cambiar de revisión, ese
  UPDATE degradaría una versión publicada y ahora falla con 55000. Es el comportamiento buscado (no se degrada en
  sitio), pero esa RPC devolverá error en ese caso. No se ejercitó.
* `guard_delete_producto_version` sigue permitiendo borrar una versión `aprobado` (sólo protege `certificado`);
  fuera de este alcance.
* **Observación sin verificar en producción**: con RLS, `UPDATE … WHERE id = …` exige además la política SELECT;
  `cotizaciones_lee` sólo deja a Diseño/Dirección. Un vendedor que "archiva" probablemente afecta 0 filas sin error
  hoy. No cambia con esta propuesta.
* El escape `vh.permitir_edicion_version_publicada` existe para mantenimiento; cualquier SQL con privilegios de
  dueño lo puede usar (igual que el de borrado). PostgREST no puede fijarlo.
* Paso 2 rompe al cliente viejo (42501): no aplicarlo antes de retirar todos los clientes viejos.
