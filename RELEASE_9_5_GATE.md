# RELEASE 9.5 GATE · Cierre de los hallazgos de la reauditoría final (14-oct-2026)

**Regla de este gate:** un punto cuenta como cerrado sólo si el comportamiento es correcto, la evidencia es reproducible y la
prueba **falla con el código anterior**. "No verificable" no cuenta como PASS. Este documento **no** autoriza producción:
es el runbook para la reauditoría GO/NO-GO y para la ventana.

| | |
|---|---|
| Rama | `claude/costing-app-architecture-psf02g` ([PR #37](https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/37)) |
| Último cambio que viaja al binario de la app o a la Edge | `3583acc`: SEG-01c rev5; `agregarCosteo` manda `especificacion_tecnica`; la Edge RC arma la fila con `filaCosteoServidor` |
| Cambios posteriores | Ninguno viaja al binario. `a4e23e1` es el verificador del holdout y el E2E del laboratorio. Después vienen el congelamiento, la evidencia, los textos de rollback de dos PROPUESTAS (§5.4), pruebas y documentos. |
| Holdout congelado sobre | `7f27dc5`, manifiesto en `f693ba8`, huella `1609af5ee225881f…` (v5.2) |
| Edge RC | `costear-servidor-rc` **v23** `3ba6d2b5…` (deploy 44 desde `3583acc`); `analizar-mueble-rc` v8 `f226b792…` |
| SHA final, preview y CI | En §9. |
| Producción (cliente) | `c3.4-seller-safe` @ `c8dd2b3`, `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3`. **Sin cambios.** |
| SQL aplicado en producción en esta ronda | **ninguno** (sólo lecturas: huellas, ACL, dependencias) |
| Edges de producción | **sin cambios** (`costear-servidor` v9, `analizar-mueble` v35) |
| Cuenta `qa-direccion` | **RIESGO ACEPTADO POR DIRECCIÓN.** No bloquea (decisión expresa de Rodrigo). Nunca cuenta como aprobación humana. |

## 1. Criterios de salida

| Criterio | Estado | Evidencia |
|---|---|---|
| 0 P0 abiertos | **Cumple.** El P0 de la reauditoría (un K se reutilizaba en un despiece técnicamente distinto con la misma promesa) se cerró con `spec_tecnica_v1`. | `docs/auditoria/SEG01C_REV5_SPEC_TECNICA.md` |
| Spec y promesa atadas del lado del servidor | **Cumple.** Son dos autoridades separadas. El trigger sella `spec_tecnica_huella`, calculada en SQL sobre la pieza saneada que costeó el motor. `adjuntar` re-proyecta en SQL la especificación de la partida; nunca compara un hash copiado del navegador. | ídem; bloque rev5 de `seg01cVinculoCosteo.test.js` |
| Pruebas por el flujo real | **Cumple.** Bloque Q3: Costear → `intentDesdePieza` → `validarIntentCosteo` (cliente y Edge) → motor → `filaCosteoServidor` → `partidaAutoritativaDeCosteo` → guardar → `vincularCosteos` real. Cubre configuración, acabado, `nombresExcluidos`, multiplicidad y dimensión interna. | 7/7 |
| Antes/después | **Cumple.** Contra la rev4, **13 pruebas de rev5 y Q3 fallan**; con la rev5 pasan. | `SEG01C_MIG=…rev4… npx vitest …` |
| Request IDs 1:1 | **Cumple (v5.2).** Cada id es único en la corrida, tiene exactamente un evento, no hay eventos ajenos y #eventos = #llamadas. | `VERIFICACION_20261014.md` §v5.2 |
| Sin bypass por entorno en el holdout | **Cumple (v5.2).** `costeable` sale de la hoja leída de git en el SHA servido; `LAB_COSTEABLE` ya no existe. | ídem |
| Sólo Edge RC en la corrida | **Cumple.** Assert final en el E2E sobre todas las llamadas de la página. En el verificador, cualquier `costear-servidor*` ≠ RC es CAMBIO. | ídem; 16/16 casos alterados fallan cerrado |
| Runbook reversible | **Cumple.** La cadena completa se aplica y se revierte en PGlite y vuelve a producción salvo las tablas de auditoría declaradas. Antes de esta ronda **no** volvía: dos rollbacks incompletos, corregidos. | `cadenaVentanaRollback.test.js` 7/7; §5.4 |
| Smoke de producción antes de estricto | **En el runbook** (§5, pasos 5 a 8). | §5.5 |
| Goldens emitibles para el E2E de Rodrigo | **No se cumple hoy, y no se puede cumplir sin Rodrigo y Compras.** Hay 0 firmas humanas y 0 costos de Compras. Queda como precondición del paso 9, no de esta reauditoría. | §5.6 |
| CI verde, build, E2E, preview del SHA exacto READY | En §9. | GitHub Actions, Vercel |

## 2. Qué se cerró en esta ronda

| Commit | Qué |
|---|---|
| `3583acc` | **P0 · SEG-01c rev5 · `spec_tecnica_v1`.** JS ≡ SQL con 20 fixtures doradas; trigger que sella; `adjuntar` la exige en el primer vínculo, en K1→K2 y en la rama idempotente; motivos de emisión. `bom_hash` queda **informativo**. **Q2/Q3:** pruebas por el pipeline real. |
| `a4e23e1` | **P1 · holdout v5.2:** request_id 1:1, `costeable` desde la hoja congelada y assert final de Edge. 6 pruebas que fallan con la v5.1. |
| `7f27dc5`, `f693ba8`, `3c052e1` | Huellas frescas, recongelamiento con la Edge RC v23, corrida de humo, `--verificar` OK y 16/16 casos de falla cerrada. |
| `075dadd` y siguiente | **Runbook:** prueba de la cadena completa de la ventana. Rollback completo de P1-03b (antes dejaba `precio_id`). Rollback de SEG-01c quita su comentario. §4–§5 reescritos: VH-100 en el rollback, orden inverso con dependencias, smoke de producción antes de estricto, postchecks por migración y goldens. |

## 3. Producción hoy (lectura del 14-oct, 14:50–14:55 UTC)

**Cliente:** `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3` (`c8dd2b3`, READY). Es el objetivo de rollback del cliente. El anterior es `dpl_9ehp8cSU7bvH3hptvETpU1tHPPHv` (`ccf76f8`).

**PostgREST de la nube:** **14.5** (`pg_stat_activity.application_name = 'PostgREST 14.5'`, 7 conexiones de `authenticator`).

**Últimas migraciones aplicadas** (`supabase_migrations.schema_migrations`, de la más nueva a la más vieja):

| versión | nombre |
|---|---|
| 20261014130610 | tramo_por_pieza_catalogo |
| 20261014121628 | firma_precios_erp_lote |
| 20261014121151 | firma_precios_erp_direccion_5_funcion |
| 20261014121138 | firma_precios_erp_direccion_4_trigger |
| 20261014121125 | firma_precios_erp_direccion_3_inmutable |
| 20261014120852 | firma_precios_erp_direccion_2_historial |
| 20261014120733 | firma_precios_erp_direccion_1_cuentas |
| 20261014032317 | vh146c_formato_hojas_erp |
| 20261013194618 | vh035c_preserva_economia_integral |
| 20261013193755 | respaldo_ventana_etapa3_20261013 |
| 20261012040717 | vh089_cargar_erp |
| 20261012034344 | vh088_catalogo_motor |

**Estado de los objetos de esta ventana en producción** (confirma que no se aplicó nada):

- `actualizar_cotizacion_segura` existe sólo con dos argumentos (sin versión);
- no existen `adjuntar_costeo_a_partida`, `promesa_partida`, `spec_tecnica` ni `cargar_costos_oficiales`;
- `costeos_servidor` no tiene columnas `promesa_*` ni `spec_tecnica_*`;
- `public.cuentas_no_humanas` **sí** existe (firma de precios del 14-oct), sin comentario, con 2 cuentas;
- 0 funciones de `public`/`private_api` mencionan `40001`.

**Precios:**

| Concepto | Valor |
|---|---|
| `insumo_precios` (total) | 11,849 |
| `propuesto` | 579 (499 de la carga de hoy) |
| `aprobado` | 1,793, todos de cuentas no humanas |
| `aprobaciones_precio_historial` | 0 firmas humanas |

**Edges de producción:** no se tocaron. Las RC se probaron sobre esta misma base.

| Edge | Versión | `ezbr_sha256` |
|---|---|---|
| `costear-servidor` | v9 | `f0722f95467ccb50d149b891e51f9c325d3cce2f18640b41e9967f56d005c4f8` |
| `analizar-mueble` | v35 | `1e1d496e68063fd25eebde5edb4a67dda3c12eb4b23a0fc0ba252d44a8a82b59` |
| `costear-servidor-rc` | **v23** | `3ba6d2b5556cd442d493876c69850aeab73dad9f812814d74e22d5db1ce089c1` (despliegue 44 desde `3583acc`, contiene la rev5) |
| `analizar-mueble-rc` | v8 | `f226b7927d345f885145eee1a7606c5bd34fcbe8e3b3f0b88e3bad33e0fb323f` |

Mientras SEG-01c no esté aplicada, `costear-servidor-rc` costea igual pero no registra el costeo: no hay `costeoId`, la respuesta lo avisa y la emisión de producción no cambia.

## 4. Migraciones de la ventana: archivos exactos y orden

El orden se prueba de punta a punta en `supabase/tests/cadenaVentanaRollback.test.js`, en PGlite con PostgreSQL 18:

- **Base:** producción del 14-oct (baseline, cuerpos de producción, VH-035c, catálogo VH-088 y `cuentas_no_humanas`), con los ACL medidos en producción ese día.
- **Qué hace:**
  1. aplica los 6 archivos en este orden;
  2. los revierte en orden inverso con el texto de rollback de cada archivo;
  3. compara el catálogo de la base completo: funciones (md5 y ACL), triggers, vistas, tablas, columnas, ACL, RLS, políticas, comentarios y opciones.
- **Qué puede quedar:** sólo las tablas de auditoría declaradas en §5.4.
- **Además comprueba:**
  - que la vista y las funciones del motor quedan con el **md5 de producción**;
  - que la cadena se puede reaplicar;
  - que el orden importa.

| # | Archivo | md5 | Precondición que el propio archivo verifica (aborta si falla) |
|---|---|---|---|
| 0 | respaldo `respaldo_<fecha>`, mismo patrón que `respaldo_ventana_etapa3_20261013`: tablas de negocio (incluye `cotizaciones`, `cotizaciones_revisiones`, `expedientes`, `expediente_revisiones`, `insumo_precios`, `insumos_catalogo`, `config`, `producto_version_economia`), más `_conteos`, `_funciones` y `_vistas` | — | — |
| 1 | `PROPUESTA_p103b_precio_id_en_catalogo.sql` | `6783f730f71d5bec005d03a7854e2b0d` | ninguna. Va **antes** de SEG-01c porque cambia `catalogo_motor` y con ello la huella de base. |
| 2 | `PROPUESTA_vh148_control_optimista_cotizacion.sql` | `1c94c8ed8f699164e928d515f4b7ab5d` | existe el núcleo de dos argumentos (VH-035c) |
| 3 | `PROPUESTA_vh148b_fail_closed_versiones.sql` (incluye VH-148d: `vincular_cotizacion` con versión) | `12045ef0d39d9ca1340affd497bf6fd6` | VH-148 aplicada |
| 4 | `PROPUESTA_seg01_emision_snapshot_fiel.sql` | `83d386bcf946494c47dd7e887d7b7f9b` | el gate de emisión no cambió (drift) |
| 5 | `PROPUESTA_seg01c_vinculo_costeo_partida.sql` (**rev5**, modo `preparado`) | `48353aa542cf97b89eda97fff903203a` | VH-035c (`partida_definicion`) y VH-148b (trigger `trg_vh148_version`) |
| 6 | `PROPUESTA_vh100_cargar_costos_oficiales.sql` | `1f1a7eef812ffb824b13ff152e51ea48` | ninguna de esquema. En ejecución exige `cuentas_no_humanas`, que ya existe en producción (firma de precios del 14-oct). Sin el reporte de Compras no cambia ningún costo. |
| — | `PROPUESTA_vh148c_retira_escrituras_sin_version.sql` | `17a4742af14e1f2620ca2f93d15436b9` | **No va en esta ventana.** Sólo cuando ningún cliente `c8dd2b3` siga abierto: con él aplicado, el cliente viejo deja de guardar (42501). |

Cada archivo es una sola transacción (`begin … commit`). Si falla una precondición, no se aplica nada de ese archivo.

**Cambios de md5 en esta ronda:**

- **P1-03b:** antes `0d3c2b46…`. Sólo cambia el texto de rollback: ahora quita la columna `precio_id` (§5.4).
- **SEG-01c:** antes `5bc8855b…`.
  - Agrega la rev5 (`spec_tecnica_v1`, ver `docs/auditoria/SEG01C_REV5_SPEC_TECNICA.md`).
  - Su rollback ahora también quita el comentario que deja en `cuentas_no_humanas`.

## 5. Runbook de la ventana

**Secuencia (en este orden, sin saltos):**

1. Respaldo (paso 0) y prechecks (§5.1).
2. **SQL** 1 → 6, cada uno con su postcheck (§5.2) antes del siguiente.
3. **Edge de producción:** se promueve `costear-servidor-rc` a `costear-servidor` (§5.3).
4. **Frontend de producción:** merge y deploy de Vercel (§5.3).
5. **Se queda en `PREPARADO`.** `preparado` no bloquea nada: sólo diagnostica.
6. **Smoke real en producción** (§5.5).
7. **Revisar diagnósticos** de las cotizaciones abiertas (§5.5).
8. **ESTRICTO**, por decisión de Dirección, con una sesión humana (§5.5).
9. **E2E final de Rodrigo,** sólo con los goldens emitibles listos (§5.6).

Entre los pasos 3 y 4, el cliente viejo (`c8dd2b3`) costea con la Edge nueva. `identidad` y `promesa` son opcionales en el DTO, así que el costeo funciona igual. Ese K queda sin promesa y sin spec, y nunca vincula; en `preparado` eso no bloquea.

### 5.1 Prechecks (si uno no da lo esperado, no se abre la ventana)

| # | Comprobación | Esperado |
|---|---|---|
| P1 | CI del SHA que se va a desplegar | `verify` y E2E en `success` |
| P2 | Preview de Vercel de ese SHA | `READY` |
| P3 | `md5sum` de los 6 archivos de §4 | igual a la tabla |
| P4 | Última migración aplicada | `20261014130610 tramo_por_pieza_catalogo`, sin nada nuevo desde este documento |
| P5 | `select application_name from pg_stat_activity where usename = 'authenticator'` | `PostgREST 14.5`. Si cambió, repetir `medir_40001.mjs` con esa versión. |
| P6 | Objetos nuevos: sobrecarga de 3 argumentos, `adjuntar_costeo_a_partida`, columnas `promesa_*` y `spec_tecnica_*`, `cargar_costos_oficiales` | no existen |
| P7 | Código de `costear-servidor` v9 y `analizar-mueble` v35 (`get_edge_function`), y `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3` del cliente | guardados para el rollback |
| P8 | Paso 0 aplicado: `_conteos` del respaldo = conteos del origen | sí |
| P9 | Línea base de VH-100: `select count(*), md5(string_agg(concat_ws('\|', producto_version_id, costo_oficial_referencia, formula_version, fuente, actualizado), ',' order by producto_version_id)) from public.producto_version_economia` | anotar. El 14-oct: **12 filas, md5 `363e27c0…`** |
| P10 | Dependientes de `public.catalogo_vigente` (`pg_depend`) | sólo `private_api.insumo_motor`. Si hay otro, el rollback de P1-03b falla a propósito: hay que revisarlo antes. |
| P11 | Holdout | no se abre el lote nuevo de Intelisis durante la ventana. Después hay que recongelarlo (§8). |

### 5.2 Postchecks por migración (inmediatamente después de cada archivo)

| Después de | Comprobación | Esperado |
|---|---|---|
| 1 · P1-03b | `catalogo_vigente` tiene la columna `precio_id`; `catalogo_motor` devuelve `precioId` en los insumos del smoke | presente |
| 1 · P1-03b | `select relacl from pg_class where oid = 'public.catalogo_vigente'::regclass` | igual que antes: `authenticated=awdDxtm` (sin `r`) y `service_role=arwdDxtm` |
| 2 · VH-148 | `to_regprocedure('public.actualizar_cotizacion_segura(bigint, jsonb, timestamptz)')` | existe; ninguna sobrecarga con `DEFAULT` |
| 2 · VH-148 | dos sesiones QA sobre una cotización QA: guardar con la versión vieja | **HTTP 409 `PT409` en menos de 1 s**; sin versión → 400 `22004` |
| 3 · VH-148b | triggers `trg_vh148_version` (cotizaciones y expedientes) y `trg_vh148_revision_cas`; un expediente QA editado con la revisión vieja | existen; 409 `PT409` |
| 3 · VH-148b | `has_function_privilege('authenticated', 'public.vincular_cotizacion(bigint,bigint,bigint,bigint)', 'execute')` | `false` (la de 5 argumentos sí) |
| 3 · cliente viejo | el cliente `c8dd2b3` guarda una cotización QA | **sigue guardando** (VH-148b no retira la firma de dos argumentos) |
| 4 · SEG-01 | `evaluar_emision_cotizacion` sobre una cotización QA ya evaluada antes | mismo estado que antes |
| 5 · SEG-01c | `select modo from private_api.politica_emision_autoridad` | `preparado` |
| 5 · SEG-01c | columnas `promesa_origen/version/huella` y `spec_tecnica_origen/version/huella` en `costeos_servidor`; triggers `trg_costeo_promesa_servidor` y `trg_costeo_spec_servidor` | existen |
| 5 · SEG-01c | `select private_api.huella_spec_tecnica('{"componentes":[{"nombre":"Cubierta","insumoId":"mdf18","cantidad":1}]}')` | un md5. Con `cantidad: 3` es otro md5; con los renglones en otro orden, el mismo. |
| 5 · SEG-01c | `select count(*) from public.cuentas_no_humanas` | igual que antes (2): el `insert … on conflict do nothing` no agrega nada |
| 6 · VH-100 | `to_regprocedure('public.cargar_costos_oficiales(text, jsonb)')` | existe |
| 6 · VH-100 | `has_function_privilege` de `cargar_costos_oficiales` para `authenticated`, `service_role` y `anon` | `true`, `true`, `false` |
| 6 · VH-100 | `has_table_privilege('authenticated', 'public.producto_version_economia', 'INSERT' / 'UPDATE' / 'DELETE')` | `false` las tres (escritura directa cerrada); `SELECT` sigue `true` |
| 6 · VH-100 | `select relrowsecurity from pg_class where oid = 'public.producto_version_economia_historial'::regclass`; y `has_table_privilege('authenticated', …historial, 'SELECT')` | `true`; `false` |
| 6 · VH-100 | conteo y md5 de P9 | **iguales**: 0 costos cambiados; la función existe pero nadie la llamó |
| 6 · VH-100 | `cargar_costos_oficiales` llamada con la cuenta QA | `no autorizado: … cuenta no humana` |
| todos | `select count(*) from pg_proc … where prosrc ~ '40001'` en `public` y `private_api` | **0**; `PT409` > 0 |

### 5.3 Edge y frontend de producción

- **Edge (paso 3):**
  - Se despliega `costear-servidor` con el código de `costear-servidor-rc` del SHA aprobado, con el workflow "Deploy edge functions".
  - Va **después** del SQL porque registra en las columnas de SEG-01c.
  - Hay que verificar la versión y el `ezbr_sha256` nuevos, y que la RC del mismo SHA dé el mismo resultado sobre el mismo intent.
- **Frontend (paso 4):**
  - Merge del PR y deploy de producción de Vercel con `VITE_CONTROL_OPTIMISTA=1`. `CARRIL_RC` **no** se define en producción.
  - Hay que verificar que el SHA servido es el aprobado.
  - Va **después** de la Edge y del SQL porque el cliente nuevo llama a las sobrecargas de VH-148/VH-148b y a `adjuntar_costeo_a_partida`.

### 5.4 Rollback (orden inverso, verificado por dependencias)

Cada paso es una transacción propia. El orden **no** es una convención: cada paso tiene que ir antes que el siguiente por una dependencia concreta.

| # | Paso | Cómo | Por qué va antes que el siguiente |
|---|---|---|---|
| R1 | **Estricto → preparado** | `select public.activar_autoridad_costeo('preparado', …)` (sesión humana de Dirección) | Deja de bloquear la emisión al instante y sin quitar nada. Si se quedara en estricto durante R2–R4, el cliente viejo armaría partidas especiales sin promesa ni spec, y la emisión las bloquearía hasta R5. |
| R2 | **Frontend** | rollback de Vercel a `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3` (`c8dd2b3`) | El cliente nuevo llama a funciones que R5–R8 quitan (3 argumentos, `adjuntar_costeo_a_partida`). El cliente viejo sólo usa firmas de dos argumentos, que existen en todos los estados. |
| R3 | **Edge** | volver a desplegar el código de `costear-servidor` v9 guardado en P7 | La Edge nueva escribe `costeos_servidor` con promesa y spec. Sin los triggers de SEG-01c (R5), esas filas quedarían sin sellar. La v9 funciona con o sin SEG-01c. |
| R4 | **VH-100** | líneas `-- RB`: `drop function cargar_costos_oficiales` y `grant insert, update, delete on producto_version_economia to authenticated` | Fue lo último que se aplicó. Devuelve los grants exactos de producción (`authenticated` con escritura, `anon` sin nada). El historial se conserva (auditoría). |
| R5 | **SEG-01c** | líneas `-- RB` | Restaura el wrapper de VH-035c (md5 `cf6ef6a3…`) y quita funciones, triggers, la política y el comentario de `cuentas_no_humanas`. **Dependencia dura con VH-148b:** `adjuntar` confía en `trg_vh148_version` para su CAS; si VH-148b se quitara antes, `adjuntar` seguiría existiendo sin CAS. **Con SEG-01 no hay dependencia dura:** SEG-01c no llama funciones de SEG-01, y cada uno toca una función distinta (SEG-01c, el wrapper público; SEG-01, la compuerta privada). Va antes por LIFO. |
| R6 | **SEG-01** | bloque `>>> ROLLBACK SEG-01` | Restaura la compuerta de producción byte a byte (md5 `9c660b09…`). |
| R7 | **VH-148b** | líneas `-- RB` (incluye VH-148d) | Su rollback **reescribe** la sobrecarga de 3 argumentos de VH-148, así que tiene que ir antes que R8. La prueba "VH-148 revertido ANTES que VH-148b" demuestra que en el orden contrario la sobrecarga reaparece. |
| R8 | **VH-148** | bloque `>>> ROLLBACK VH-148` | Quita las sobrecargas de 3 argumentos y devuelve `cotizacion_segura` byte a byte. |
| R9 | **P1-03b** | líneas `-- RB` | Fue lo primero que se aplicó. Ahora el rollback es completo. Borra y recrea la vista de producción **sin CASCADE**: si algo fuera de producción depende de ella, falla y no deja nada a medias (probado). Recrea su comentario, su ACL y `insumo_motor`. |

**Qué se conserva a propósito** (auditoría o datos; la prueba de la cadena lo declara y nada más puede quedar):

- `costeos_servidor` y `partida_costeo_vigente` (SEG-01c);
- `producto_version_economia_historial` (VH-100).

**Lo que probó la cadena (PGlite, PostgreSQL 18)** — `cadenaVentanaRollback.test.js`, 7/7:

- Aplicar → revertir deja la base igual a producción, salvo lo declarado.
- Datos de negocio con el mismo conteo y md5: `cotizaciones`, `expedientes`, `producto_version_economia`, `insumo_precios` y `cuentas_no_humanas`.
- La vista `catalogo_vigente`, `insumo_motor` y `catalogo_motor` quedan con el md5 **de producción** (`02e1bd0f…`, `8e4d28b2…`, `fe81d391…`).
- La cadena se puede reaplicar.
- **Antes de esta ronda la prueba fallaba** (`docs/auditoria/cadena_ventana_rollback_antes.txt`):
  - P1-03b dejaba la columna `precio_id` en la vista;
  - SEG-01c dejaba el comentario en `cuentas_no_humanas`.

### 5.5 Smoke de producción, diagnósticos y estricto (pasos 5 a 8)

**Smoke real en producción, todavía en `preparado`** (cuenta de Diseño o Dirección; ninguna aprobación de precio):

1. Costear un especial en producción → K con `promesa_version = 'v1'`, `spec_tecnica_version = 'v1'` y las dos huellas no nulas.
2. Agregarlo a una cotización QA → `adjuntar_costeo_a_partida` OK.
3. `diagnostico_autoridad_costeo(<id>)` → `modo: preparado` y sin motivos para ese renglón.
4. Cambiar la cantidad de un renglón del despiece en la partida y volver a adjuntar → rechazo "la partida describe otro despiece…".
5. Guardar con la versión vieja desde dos sesiones → 409 `PT409`.
6. `evaluar_emision_cotizacion` de una cotización QA ya evaluada antes de la ventana → mismo estado que antes.
7. La Edge de producción reporta la versión y el sha esperados (§5.3), y el cliente sirve el SHA aprobado.

**Diagnósticos** (sesión SQL de servicio, solo lectura):

```sql
select id, folio, private_api.motivos_autoridad_costeo(id) as motivos
from public.cotizaciones
where activa and estado not in ('emitida', 'cancelada');
```

Esta consulta dice cuántas cotizaciones abiertas quedarían bloqueadas en estricto, y por qué (partidas especiales sin promesa o sin spec: hay que recostear). Dirección decide con ese número.

**Estricto:**

```sql
select public.activar_autoridad_costeo('estricto', '<exigir_vigente|congelar_al_costear>', '<MOTOR_VERSION desplegada>');
```

- Lo corre **una sesión humana de Dirección**: la base rechaza las cuentas no humanas.
- Si algo falla después, se vuelve al paso R1 (preparado), sin tocar nada más.

### 5.6 Antes del E2E final de Rodrigo: goldens emitibles (precondición, hoy NO se cumple)

El E2E final necesita dos casos reales que se puedan emitir. **Hoy no existen, y no se pueden fabricar sin violar las reglas** (aprobaciones humanas reales, datos de Compras). Estado medido en producción el 14-oct, en solo lectura:

| Dato | Hoy |
|---|---|
| Firmas humanas de precio (`aprobaciones_precio_historial`) | **0** |
| Aprobadores de los 1,793 precios `aprobado` | sólo `qa-direccion@vonhaucke.mx` y `reconciliacion`, las dos en `cuentas_no_humanas`: no cuentan |
| `producto_version_economia` | 12 filas: 3 de expedientes (pv 1932–1934) y 9 fixtures `QA_FIXTURE_*`. **0 de un reporte de Compras.** |

**Golden 1 · especial.**

1. Diseño costea un mueble especial con BOM real, cuyos insumos tengan **precio exacto con `precio_id`** firmado por Rodrigo (sesión humana).
2. Costo certificado: `estado = 'certificado'`, sin piezas inferidas sin confirmar.
3. SEG-01 completo: costear → guardar → reabrir → cotizar → adjuntar → emitir → PDF.
4. Candidato: el primero que Rodrigo firme. Para elegirlo: `select … from insumo_precios where estado = 'aprobado' and approved_by not in (cuentas_no_humanas)` sobre los insumos de su BOM.

**Golden 2 · Producto Maestro.**

1. Compras entrega el reporte Intelisis de **un** producto.
2. Dirección (humana) lo carga con `cargar_costos_oficiales` (VH-100).
3. Ese producto ya tiene `ProductRevision` vigente y precio de lista.
4. Cotizar con margen → emitir → PDF.
5. Candidato: un código sin duplicado en `productos` (ATOM3, ATPU2M/3M/4M/75M y ATFAL150ABS tienen duplicados y exigen `producto_id`).

**Regla:** ninguno de los dos usa `qa-direccion` ni una cuenta no humana como aprobación. Si al llegar al paso 9 no están, **el E2E final no se corre**.

## 6. Pruebas (reproducibles)

| Qué | Cómo | Resultado |
|---|---|---|
| Suite completa | `npx vitest run --exclude '.claude/**' --exclude 'node_modules/**' --exclude 'lab/qa/**'` | **352 archivos, 3,390 pruebas, 0 fallas** (local). Lo que vale es CI (§9). |
| Focales de esta ronda | `specTecnica` (26), `specTecnicaGolden` (21), `seg01cVinculoCosteo` (101), `cadenaVentanaRollback` (7), `holdoutHuellas` (27), `composicionVh035cVh148`, `precioIdCatalogo`, `promesaComercial` | 8 archivos, **222/222** |
| P0 ANTES (rev4) | `SEG01C_MIG=supabase/tests/fixtures/seg01c_rev4_8cc0adb.sql npx vitest run supabase/tests/seg01cVinculoCosteo.test.js -t "rev 5 · spec\|Q3"` | **13 fallan** con la rev4 (multiplicidad, dimensión, horas, pintura, dificultad, duplicados, sellado, K2 no lava, defensa en la emisión, control del pipeline); con la rev5 pasan |
| Holdout ANTES (v5.1) | `holdoutHuellas.test.js` contra `git show 3583acc:src/datos/holdoutHuellas.js` (+ stub de `costeableDeHoja` con semántica v5.1) | **6 de 27 fallan**: I, I2, J, K, `costeableDeHoja` y "cada request…" (`lab/costear/holdout_intelisis/v52_pruebas_antes_v51.txt`). L ya pasaba. |
| Runbook ANTES | `cadenaVentanaRollback.test.js` con las PROPUESTAS p103b y seg01c de `3583acc` | **falla**: `precio_id` en la vista y comentario en `cuentas_no_humanas` (`docs/auditoria/cadena_ventana_rollback_antes.txt`) |
| Holdout v5.2 | `node scripts/congelar_holdout.mjs --verificar … --corrida lab/costear/holdout_intelisis/corrida_humo_20261014c` y `casos_falla_cerrada.mjs` | OK (exit 0); **16/16** casos alterados fallan cerrado |
| Arranque de la Edge RC | `DENO=… scripts/edge_boot_check.sh costear-servidor-rc` (Deno 2.9.7) | `OPTIONS=200 POST=500` → ARRANCA (500 sin auth es lo esperado) |
| Dos conexiones (VH-148) | `lab/qa/vh148_dos_conexiones/` (`LEEME.md`) | 4/4 casos con PostgREST 12.2.3 y con **14.5** (ronda anterior; VH-148 no cambió) |

## 7. Riesgos residuales (no bloquean la reauditoría; sí hay que verlos en la ventana)

1. **La prueba de dos conexiones no corrió en la nube.** Usó los binarios oficiales de Postgres 16, GoTrue v2.178.0 y PostgREST **14.5** (la misma versión de la nube), con el mismo SQL. Crear una rama de Supabase falló: el conector pide un ID de confirmación de costo que no expone. Lo cubre el postcheck "409 en < 1 s" con la API real.
2. **Postgres de la nube:** no medí su versión menor. El comportamiento probado (`raise … using errcode`, triggers y `for update`) es estándar.
3. **VH-035c en producción:** cuando un vendedor guarda un render, marca "recosteo pendiente". Es fail-closed y obliga a recostear sin necesidad. Corregirlo requiere otra migración, fuera de este cierre.
4. **Exclusiones por nombre:** dos piezas con el mismo nombre, y sólo una excluida, salen ambas de `piezas`. El resultado es igual en los dos lados, así que no abre un hueco; sólo describe peor la pieza.
5. **La promesa la declara quien costea.** El servidor garantiza que es la misma que se costeó, no que el despiece "sea" el mueble.
6. **Precios:**
   - 0 firmas humanas;
   - 1,793 `aprobado` de cuentas no humanas, que la firma no cuenta;
   - 579 `propuesto`;
   - 3 de la carga de hoy requieren validación de Compras: MVLECA22240068 ×5.00, MVLUPI10370001 ×3.22 y MVLEMC02020078 ×0.27.

   El clasificador de catálogo de la carga es heurístico (acta).
7. **VH-100 sin dato:** 1,931 productos de lista sin costo oficial. Cotizar líneas de catálogo sigue `ECONOMICS_INCOMPLETE` hasta que Compras entregue el reporte.
8. **Council:** Anthropic agota el tiempo (presupuesto 14–22 s contra latencia real de 29–43 s). Todo sale con un solo proveedor y bien etiquetado. Arreglarlo requiere tocar `voni-council` de producción.
9. **`qa-direccion`: RIESGO ACEPTADO POR DIRECCIÓN.**
10. **Partidas especiales existentes sin `especificacion_tecnica`** (rev5) no vinculan: hay que recostearlas, igual que las
    que no tienen promesa v1. Falla cerrado; en `preparado` no bloquea. El diagnóstico de §5.5 dice cuántas son.
11. **La especificación de la partida la escribe el navegador.** Es intencional: es la definición que se cotiza y se emite.
    El servidor garantiza que el costo corresponde **a esa** especificación, no que la especificación "sea" el mueble.
12. **Fuera de alcance, probado:** Costear no puede agregar a una cotización un especial con una pieza marcada `excluida`.
    El validador descarta `excluida`, el servidor costea esa pieza y el cliente no, así que la paridad falla cerrada
    ("cliente y servidor difieren"). No abre un hueco económico, pero excluir piezas no sirve hoy desde Costear.
13. **PGlite corre PostgreSQL 18; la nube, otra versión.** No medí la versión exacta de la nube. La cadena de rollback
    reproduce **byte a byte** los md5 de producción de la vista y de las funciones del motor (§5.4), lo que indica que el
    texto de las definiciones coincide. No prueba el comportamiento de la versión exacta de la nube.
14. **E2E inestable: `golden757Edicion`.**
    - En CI 786 (`66dd3a0`) falló en el primer intento ("ningún presupuesto golden reciente tiene acomodo") y pasó en el reintento.
    - En CI 785 (`5057d61`, mismo código de app) pasó sin reintento.
    - Depende de datos QA compartidos en la nube: busca entre los 6 presupuestos "Torre Sur (golden)" más recientes uno que ya tenga acomodo, y otras corridas, en paralelo o canceladas, los dejan a medias.
    - No se tocó en este cierre: cambiar `e2e/` invalida el congelamiento del holdout. Va a la lista de después del lote Intelisis.

## 8. Holdout Intelisis

- **Congelado (v5.2)** sobre `7f27dc5` (manifiesto en `f693ba8`):
  - 110 archivos y `package-lock.json`;
  - base y definiciones SQL;
  - Edge RC v23/v8;
  - modelos y SHA de frontend.

  `--verificar` dio OK sobre la corrida de humo `corrida_humo_20261014c`, servida en `f693ba8`. 16/16 casos alterados fallan cerrado.
- **Se invalida** cuando Rodrigo firme los precios del ERP y ante cualquier cambio de motor, prompts, catálogo, config, precios, matching, estados, Edge o modelo. **La ventana lo invalida** (Edge y SQL). Hay que recongelarlo antes de ver resultados del lote nuevo.
- Las hojas del lote nuevo se commitean **antes de recongelar**: el verificador las lee de git en el SHA servido.
  - Una hoja que no esté en ese commit da NO VERIFICADO.
  - Una hoja agregada en `lab/costear/ciego_erp/` **después** del congelamiento cuenta como cambio de código y da CAMBIO.
  - Una hoja no costeable se declara con `costeable: false` y `motivo_no_costeable`, antes de correr.
  - Hay una tensión con la regla de separación (§7 del protocolo: quien elige los muebles no pasa los reportes antes):
    la hoja lleva `erp_referencia`. Dónde y quién commitea las hojas se decide al abrir el lote; no se resolvió en esta ronda.

## 9. Evidencia del SHA final

**SHA evaluado: `2d0252739ea3083e1b607ac5e836453d2a8be99d`.** Es el último con código, pruebas y evidencia. El commit que agrega esta sección sólo cambia este archivo.

| Evidencia | Resultado |
|---|---|
| CI | [run 789](https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/actions/runs/38615080108): `verify` **success** (audit, vitest y `vite build`) y E2E **success**: 93 passed, 12 skipped, **1 flaky** (`golden757Edicion`, el mismo de la ronda anterior; riesgo residual 14) |
| Preview Vercel | `dpl_FH58juTmmPsdygy5wwGquvFedNCY` (`costeador-vonhaucke-i40389ikx-rodrigos-eurotrip.vercel.app`), **READY**, `githubCommitSha` = `2d02527…`, target preview. Su build corrió la suite: 352/3,390, 0 fallas. |
| Suite local | 352 archivos, 3,390 pruebas, 0 fallas |
| Focales | 8 archivos, 222/222 |
| Antes/después | P0: 13 fallan con la rev4. Holdout: 6 fallan con la v5.1. Runbook: la cadena falla con los rollbacks anteriores. |
| Holdout v5.2 | `--verificar` → **OK** (exit 0) sobre `corrida_humo_20261014c`, también re-corrido en el HEAD; 16/16 casos alterados fallan cerrado |
| Edge RC | `costear-servidor-rc` v23 `3ba6d2b5…`, `analizar-mueble-rc` v8 `f226b792…` (releídas a las 18:12 UTC) |
| Edge de producción | `costear-servidor` v9 `f0722f95…`, `analizar-mueble` v35 `1e1d496e…`: **sin cambios** |
| Producción | sin SQL de esquema, sin promoción del cliente, sin merge; SEG-01c no aplicada, así que tampoco hay estricto |
