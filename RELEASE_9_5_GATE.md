# RELEASE 9.5 GATE · Cierre absoluto pre-release (14-oct-2026)

**Regla de este gate:** un punto cuenta como cerrado sólo si el comportamiento es correcto, la evidencia es reproducible y la
prueba **falla con el código anterior**. "No verificable" no cuenta como PASS. Este documento **no** autoriza producción:
es el runbook para la decisión GO/NO-GO de la ventana y para la ventana misma.

| | |
|---|---|
| Rama | `claude/costing-app-architecture-psf02g` ([PR #37](https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/37)) |
| **FINAL_SHA** | **El commit que agrega esta versión del gate.** Es el último commit del release: después de él no se agrega nada a la rama. Toda la evidencia se rehízo sobre FINAL_SHA. Historia: <br>1. `0e19fd3`: el paso 3 y R3 del runbook no se podían ejecutar tal como estaban escritos (§5.3, §5.4). <br>2. `157d0ad`: la auditoría binaria encontró un **P1 en el verificador del holdout**: `playwright.config.js` quedaba fuera del congelamiento (§8). `2111f0a` lo cerró con el holdout v5.3. <br>3. `2111f0a`: antes de entregarlo revisé mi propio cierre y encontré el mismo ataque por otra puerta. Playwright carga un `playwright.config.ts` **sin versionar** antes que el `.js` congelado. Y con `reuseExistingServer` el E2E acepta un Vite de **otro checkout**. `9013d20` lo cerró con el holdout v5.4 (§8). <br>4. `9013d20`: la revisión acotada del auditor encontró **P1-HO-02**: la identidad git de la corrida (`shaGit`) salía de `LAB_GIT_SHA`, y el SHA visible de `GIT_SHA`. Un checkout B con otro HEAD y esas dos variables apuntando al SHA congelado daba OK aunque sirviera otro código. `6a0091e` lo cerró con el holdout v5.5 (§8). <br>5. `6a0091e`: la revisión acotada del auditor encontró **P1-HO-03**: con el MISMO HEAD, un archivo versionado modificado y marcado `assume-unchanged` o `skip-worktree` no aparece en `git status` ni en `git diff HEAD`. El checkout servía otro código y daba OK. Este commit lo cierra con el holdout v5.6 (§8). |
| Por qué el SHA no está escrito aquí | Un commit no puede contener su propio SHA. Todo lo que nombra a FINAL_SHA vive **fuera del repo**, en el paquete del auditor (`00_LEEME_AUDITOR.md`): CI ×3, preview de Vercel, Edge RC desplegada desde FINAL_SHA, manifiesto del holdout congelado sobre FINAL_SHA, `--verificar` y la relectura final de producción. Escribirlo aquí movería el SHA. |
| Último cambio de código | **App y Edge:** `214786b` (§2). **Arnés del holdout:** `2111f0a` (v5.3), `9013d20` (v5.4), `6a0091e` (v5.5) y FINAL_SHA (v5.6), en `scripts/congelar_holdout.mjs`, `scripts/integridadGit.mjs` (nuevo, + prueba; lo importan el E2E y el script de congelamiento), `src/datos/holdoutHuellas.js` (+ prueba), `e2e/labCostear.e2e.js`, `e2e/servidorVite.js` (sólo lo importa el E2E), `lab/costear/holdout_intelisis/casos_falla_cerrada.mjs` y `casos_integridad_git.mjs` (nuevo). `holdoutHuellas.js` sólo lo importan el E2E, el script de congelamiento y los casos; nada llega al bundle ni a la Edge. Por eso `git diff 214786b FINAL_SHA -- supabase src` sólo toca `src/datos/holdoutHuellas*.js`. |
| Edge RC | `costear-servidor-rc` se despliega desde FINAL_SHA con el workflow "Deploy edge functions". Desde `214786b` (mismo código de Edge; los holdout v5.3 a v5.6 no tocan nada que importe la Edge): **v24** `52e4228e454c172ad488cfbbec240d6996af02f49412bd66f427688bc98d9786`. `analizar-mueble-rc` v8 `f226b792…` (sin cambios). |
| Holdout | Se recongela sobre FINAL_SHA (§8). El manifiesto de ese congelamiento va en el paquete, por la misma razón. El `MANIFIESTO.json` versionado en el repo es el v5.2 de `7f27dc5`: **histórico**, ya no verifica (cambió código del cierre transitivo). |
| Producción (cliente) | `c3.4-seller-safe` @ `c8dd2b3`, `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3`. **Sin cambios.** |
| SQL aplicado en producción en esta ronda | **ninguno** (sólo lecturas: `docs/auditoria/baseline_prod.sql`, huellas del holdout) |
| Edges de producción | **sin cambios** (`costear-servidor` v9 `f0722f95…`, `analizar-mueble` v35 `1e1d496e…`) |
| Cuenta `qa-direccion` | **RIESGO ACEPTADO POR DIRECCIÓN.** No bloquea (decisión expresa de Rodrigo). Nunca cuenta como aprobación humana. |

## 1. Criterios de salida

Para escribir **LISTO PARA GO DE VENTANA** tienen que cumplirse todos. Lo que depende de FINAL_SHA se marca en el paquete
como VERIFICADO / NO VERIFICABLE / FALLÓ; aquí está el criterio y dónde se mide.

| Criterio | Estado | Evidencia |
|---|---|---|
| 0 P0/P1/P2 conocidos de esta operación | **Cumple** con lo que se conoce hoy. Los dos P2 de la reauditoría anterior (`horas.toString`/`constructor` y la colisión con U+001F) se cerraron en `214786b`. | §2; `cierre_go_p2_antes.txt` (21 fallan antes) |
| La spec es la pieza EFECTIVA del motor | **Cumple.** `spec_tecnica_origen = spec(piezaEfectiva)`, y `piezaEfectiva` es **el mismo objeto** que recibe `calcular()` (ya reconciliada). Antes salía de `intent.pieza`. La respuesta devuelve `especificacionTecnica`; la partida la transporta y `adjuntar` la re-proyecta en SQL y la compara con la huella sellada en K. | `src/datos/costeoServidor.js`; `cierre_go_traza_antes.txt` (3 fallan antes) |
| JS = SQL | **Cumple.** 34 fixtures doradas; las 14 nuevas, escritas a mano (`toString`, `constructor`, `__proto__`, `hasOwnProperty`, `valueOf`, U+001F, `\|`, `§`, `\n`, `\t`, emoji, acentos, pares sustitutos, nulos, números como texto, renglones reordenados). Además: cambiar cualquier campo técnico cambia la huella; rotar o invertir renglones no; sin colisiones entre las 34. | `specTecnicaGolden.test.js` 39/39 |
| Pruebas por el pipeline real | **Cumple.** Q3/Q4 llaman a `atenderCosteo`, **la misma función** que ejecuta la Edge RC después de autenticar, con un cliente de servicio sobre PGlite. Nadie arma a mano `estado`, `aprobacionHumana` ni la fila de K. **No cubren:** la verificación del JWT y el transporte HTTP (la Edge sólo autentica y responde). | `seg01cVinculoCosteo.test.js`, bloque "Q3/Q4" |
| Holdout fail-closed | **Cumple con la v5.6.** El P1 de la auditoría binaria quedó cerrado: el arnés que decide si la prueba pasa también está congelado. Esto incluye `playwright.config.js` y `vite.config.js`, la evidencia sólo vale del primer intento, con el árbol limpio y con el entorno Vite congelado (v5.3; 4 pruebas fallan con la v5.2). Además, la evidencia demuestra **qué** config cargó Playwright y **qué** servidor contestó: de este checkout y con argumentos permitidos (v5.4; 3 pruebas fallan con la v5.3). Y la identidad git de la corrida se **mide** (HEAD del checkout que sirvió), no se declara por entorno (v5.5; 3 pruebas fallan con la v5.4). Y los **bytes** del checkout son los de ese HEAD aunque el índice de git oculte cambios (`assume-unchanged`, `skip-worktree`, caché de stat) (v5.6; la prueba T falla con la v5.5). Sobre FINAL_SHA: recongelamiento, corrida de humo, `--verificar` y todos los casos alterados. | §8; `docs/auditoria/holdout_v53_antes.txt`, `holdout_v54_antes.txt`, `holdout_v55_antes.txt`, `holdout_v56_antes.txt`; paquete |
| Rollback completo | **Cumple.** La cadena se aplica y se revierte en PGlite y vuelve al catálogo de producción salvo las tablas de auditoría declaradas. | `cadenaVentanaRollback.test.js` 7/7; §5.4 |
| 0 flaky | **Causa raíz corregida** en `214786b` (riesgo 14). CI 791 sobre `214786b`: 94 passed, 12 skipped, **0 flaky**. Sobre FINAL_SHA: 3 corridas consecutivas. | §7.14; paquete |
| CI y build verdes | CI 791 sobre `214786b`: `verify` y E2E **success**. Sobre FINAL_SHA: paquete. | GitHub Actions |
| Preview exacta READY | Sobre FINAL_SHA: `deployment_id`, url, `githubCommitSha`, `READY`, en el paquete. **No es el artefacto que va a producción** (§5.3). | Vercel |
| FINAL_SHA congelado | Sin commits después de FINAL_SHA. | `git log` |
| Sin drift en la línea base de producción | Lectura de §3 (20:14 UTC) y relectura con la **misma consulta** al cerrar el paquete. Si algo cambió: **STOP**. | `docs/auditoria/baseline_prod.sql` |
| Producción no modificada | Sin SQL, sin Edge de producción, sin promoción del cliente, sin merge, sin estricto. | §3 |
| Smoke de producción antes de estricto | **En el runbook** (§5, pasos 5 a 8). | §5.5 |
| Goldens emitibles para el E2E de Rodrigo | **No se cumple hoy, y no se puede cumplir sin Rodrigo y Compras** (0 firmas humanas, 0 costos de Compras). Es precondición del **paso 9**, no del GO de la ventana. | §5.6 |

## 2. Qué se cerró en esta ronda

| Commit | Qué |
|---|---|
| `3583acc` | **P0 · SEG-01c rev5 · `spec_tecnica_v1`.** JS ≡ SQL con 20 fixtures doradas; trigger que sella; `adjuntar` la exige en el primer vínculo, en K1→K2 y en la rama idempotente; motivos de emisión. `bom_hash` queda **informativo**. **Q2/Q3:** pruebas por el pipeline real. |
| `a4e23e1` | **P1 · holdout v5.2:** request_id 1:1, `costeable` desde la hoja congelada y assert final de Edge. 6 pruebas que fallan con la v5.1. |
| `7f27dc5`, `f693ba8`, `3c052e1` | Huellas frescas, recongelamiento con la Edge RC v23, corrida de humo, `--verificar` OK y 16/16 casos de falla cerrada. |
| `075dadd` y siguiente | **Runbook:** prueba de la cadena completa de la ventana. Rollback completo de P1-03b (antes dejaba `precio_id`). Rollback de SEG-01c quita su comentario. §4–§5 reescritos: VH-100 en el rollback, orden inverso con dependencias, smoke de producción antes de estricto, postchecks por migración y goldens. |
| `214786b` | **Cierre absoluto (último cambio de código).** <br>1. **P2 `horas`:** sólo propiedades propias en JS (como en SQL); `toString`, `constructor`, `__proto__`, `hasOwnProperty` y `valueOf` son centros válidos. El validador del DTO arma `horas` sin prototipo, así que ya no pierde `__proto__`. <br>2. **P2 U+001F:** la clave de orden de renglones es inyectiva: por campo, `-` si falta o `<longitud en code points>:<valor>`; se compara por code point (JS) y `COLLATE "C"` (SQL). <br>3. **Spec = pieza efectiva:** núcleo `src/datos/costeoServidor.js` (`costearConMotor` + `atenderCosteo`); la Edge RC sólo autentica, atiende `cocrear` y llama `atenderCosteo`. <br>4. **Q3/Q4** por ese núcleo con PGlite. <br>5. **`golden757Edicion`:** proyecto de Playwright que depende de `golden757` y abre exactamente su presupuesto (por id). <br>Antes: 21 (P2) y 3 (trazabilidad) pruebas fallan con el código de `2d02527`. |
| `2111f0a` | **Holdout v5.3 (P1 de la auditoría binaria de `157d0ad`).** El arnés de la prueba entra al congelamiento: `playwright.config.js` y `vite.config.js`; la evidencia sólo vale del primer intento, con árbol limpio y con el entorno Vite congelado (§8). Antes: 4 pruebas fallan con la v5.2. El runbook ejecutable del paso 3 y R3 (§5.3, §5.4) ya venía de `157d0ad`. |
| `9013d20` | **Holdout v5.4 (revisión propia del cierre v5.3).** El `0-binario.json` registra el config que Playwright **cargó** y el servidor que **contestó** en el baseURL (checkout y argumentos). El verificador exige `playwright.config.js` y un Vite de este checkout con argumentos de una lista permitida (§8). Antes: 3 pruebas fallan con la v5.3. |
| `6a0091e` | **Holdout v5.5 (P1-HO-02 de la revisión acotada de `9013d20`).** El E2E mide `headGit` (`git rev-parse HEAD` en el checkout que sirvió, sin variables `GIT_*` ni objetos `git replace`). El verificador exige que el SHA visible y `LAB_GIT_SHA` coincidan con él, y hace el `git diff` y la lectura de la hoja desde `headGit` (§8). Antes: 3 pruebas fallan con la v5.4. |
| FINAL_SHA (este commit) | **Holdout v5.6 (P1-HO-03 de la revisión acotada de `6a0091e`).** El E2E mide, en el checkout que sirvió, las banderas del índice (`git ls-files -v`: `assume-unchanged` y `skip-worktree`) y compara **por bytes** cada archivo del árbol de HEAD contra lo que hay en disco (sha1 de blob calculado con node, sin pasar por el índice ni la caché de stat). Con hoja, el E2E falla si hay banderas o bytes distintos; el verificador da CAMBIO, y NO VERIFICADO si falta la medición; el congelamiento aborta (§8). Antes: la prueba T falla con la v5.5. |

## 3. Producción hoy (lectura del 14-oct, 20:14 UTC, con `docs/auditoria/baseline_prod.sql`)

La consulta es de solo lectura y devuelve una fila JSON. Se corre igual al cerrar el paquete y antes de abrir la ventana:
**cualquier diferencia es drift y detiene todo**.

**Cliente:** `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3` (`c8dd2b3`, READY). Es el objetivo de rollback del cliente. El anterior es `dpl_9ehp8cSU7bvH3hptvETpU1tHPPHv` (`ccf76f8`). Dominio de producción: `costeador-vonhaucke.vercel.app`; rama de producción: `c3.4-seller-safe`.

**PostgreSQL de la nube:** **17.6** (`server_version`). **PostgREST:** **14.5** (`pg_stat_activity.application_name`).

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
- no existen `adjuntar_costeo_a_partida`, `promesa_partida`, `spec_tecnica`/`huella_spec_tecnica`, `activar_autoridad_costeo` ni `cargar_costos_oficiales`;
- no existen las tablas `costeos_servidor` ni `partida_costeo_vigente`, ni `private_api.politica_emision_autoridad`: las crea SEG-01c (`create table if not exists`);
- `public.cuentas_no_humanas` **sí** existe (firma de precios del 14-oct), sin comentario, con 2 cuentas;
- 0 funciones de `public`/`private_api` mencionan `40001`.

**Catálogo (lo que toca P1-03b):**

- `catalogo_vigente`: sin columna `precio_id`; definición md5 `02e1bd0f1203ff77586efb44ceebc6b6`; ACL `{postgres=arwdDxtm, authenticated=awdDxtm, service_role=arwdDxtm}`.
- Dependientes en `pg_depend` (incluye el tipo fila): **sólo** `private_api.insumo_motor(insumos_catalogo, catalogo_vigente)`. Además la nombran en su cuerpo (sin dependencia registrada) `buscar_insumos_motor`, `private_api.catalogo_motor` y `private_api.resolver_costo_insumo`: siguen funcionando después de recrear la vista con el mismo nombre.
- md5 de `private_api.insumo_motor` `8e4d28b2…` y de `private_api.catalogo_motor` `fe81d391…`: los mismos que reproduce la cadena de §5.4.

**VH-100:** `producto_version_economia` **12 filas, md5 `363e27c07645bb1373f248d368e7050a`** (fórmula de P9).

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
| `costear-servidor-rc` | **v24** | `52e4228e454c172ad488cfbbec240d6996af02f49412bd66f427688bc98d9786` (despliegue 45 desde `214786b`). Se vuelve a desplegar desde FINAL_SHA: versión y sha en el paquete. |
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
| 5 | `PROPUESTA_seg01c_vinculo_costeo_partida.sql` (**rev5**, modo `preparado`) | `969999f45e54b58f749be1be6012f581` | VH-035c (`partida_definicion`) y VH-148b (trigger `trg_vh148_version`) |
| 6 | `PROPUESTA_vh100_cargar_costos_oficiales.sql` | `1f1a7eef812ffb824b13ff152e51ea48` | ninguna de esquema. En ejecución exige `cuentas_no_humanas`, que ya existe en producción (firma de precios del 14-oct). Sin el reporte de Compras no cambia ningún costo. |
| — | `PROPUESTA_vh148c_retira_escrituras_sin_version.sql` | `17a4742af14e1f2620ca2f93d15436b9` | **No va en esta ventana.** Sólo cuando ningún cliente `c8dd2b3` siga abierto: con él aplicado, el cliente viejo deja de guardar (42501). |

Cada archivo es una sola transacción (`begin … commit`). Si falla una precondición, no se aplica nada de ese archivo.

**Cambios de md5:**

- **Cierre absoluto (`214786b`):** sólo **SEG-01c**, de `48353aa5…` a `969999f4…`. Cambia la clave de orden de los renglones en `private_api.spec_tecnica` (bloque `spec_v1`): de `campo=valor` unidos con U+001F a la clave inyectiva `-` / `<longitud>:<valor>` por campo, igual que en JS. Nada más del archivo cambió. Los otros cinco md5 son los de la ronda anterior.
- **Ronda anterior:**
  - **P1-03b:** antes `0d3c2b46…`. Sólo cambia el texto de rollback: ahora quita la columna `precio_id` (§5.4).
  - **SEG-01c:** antes `5bc8855b…`. Agrega la rev5 (`spec_tecnica_v1`, ver `docs/auditoria/SEG01C_REV5_SPEC_TECNICA.md`); su rollback también quita el comentario que deja en `cuentas_no_humanas`.

## 5. Runbook de la ventana

**Secuencia (en este orden, sin saltos):**

1. Respaldo (paso 0) y prechecks (§5.1).
2. **SQL** 1 → 6, cada uno con su postcheck (§5.2) antes del siguiente.
3. **Edge de producción:** se promueve `costear-servidor-rc` a `costear-servidor` (§5.3).
4. **Frontend de producción:** `VITE_CONTROL_OPTIMISTA=1` en Vercel (production), fast-forward de `c3.4-seller-safe` a FINAL_SHA y verificación del build de producción **antes** del paso 5 (§5.3).
5. **Se queda en `PREPARADO`.** `preparado` no bloquea nada: sólo diagnostica.
6. **Smoke real en producción** (§5.5).
7. **Revisar diagnósticos** de las cotizaciones abiertas (§5.5).
8. **ESTRICTO**, por decisión de Dirección, con una sesión humana (§5.5).
9. **E2E final de Rodrigo,** sólo con los goldens emitibles listos (§5.6).

Entre los pasos 3 y 4, el cliente viejo (`c8dd2b3`) costea con la Edge nueva. `identidad` y `promesa` son opcionales en el DTO, así que el costeo funciona igual. Ese K queda sin promesa y sin spec, y nunca vincula; en `preparado` eso no bloquea.

### 5.1 Prechecks (si uno no da lo esperado, no se abre la ventana)

| # | Comprobación | Esperado |
|---|---|---|
| P0 | `git rev-parse HEAD` de la rama = FINAL_SHA, y `git log FINAL_SHA..origin/claude/costing-app-architecture-psf02g` vacío | sí: nada después de FINAL_SHA |
| P1 | CI de FINAL_SHA | `verify` y E2E en `success`, 0 flaky (paquete: 3 corridas) |
| P2 | Preview de Vercel de FINAL_SHA | `READY`, `githubCommitSha = FINAL_SHA`. Certifica el código; **no** es el artefacto de producción (§5.3). |
| P3 | `md5sum` de los 6 archivos de §4 | igual a la tabla |
| P4 | `docs/auditoria/baseline_prod.sql` | **idéntico** a la salida del paquete (sin drift). Incluye la última migración `20261014130610 tramo_por_pieza_catalogo`. |
| P5 | `select application_name from pg_stat_activity where usename = 'authenticator'` (también en la consulta de P4) | `PostgREST 14.5`. Si cambió, repetir `medir_40001.mjs` con esa versión. |
| P6 | Objetos nuevos: sobrecarga de 3 argumentos, `adjuntar_costeo_a_partida`, columnas `promesa_*` y `spec_tecnica_*`, `cargar_costos_oficiales` | no existen |
| P7 | Código de `costear-servidor` v9 y `analizar-mueble` v35 (`get_edge_function`), y `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3` del cliente | guardados para el rollback. Origen de v9: `ff25ea7` (R3). |
| P7b | Máquina del operador con Supabase CLI y token personal; worktrees de FINAL_SHA (paso 3) y de `ff25ea7` (R3) | listos **antes** de abrir la ventana |
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

### 5.3 Edge y frontend de producción: qué artefacto se promueve

**Edge (paso 3): el código de `costear-servidor-rc` de FINAL_SHA se publica con el slug `costear-servidor`.**

- **No con el workflow "Deploy edge functions".** El workflow despliega `supabase/functions/<slug>/index.ts` del ref. En FINAL_SHA, `supabase/functions/costear-servidor/index.ts` es el código **viejo** (último cambio en `3b0020c`), que importa los módulos **nuevos** de `src/`. Esa mezcla nunca se probó: **prohibido**.
- **Cómo se hace** (Supabase CLI y token personal en la máquina del operador; la copia vive sólo en el worktree, **no se commitea**):

  ```bash
  git worktree add /tmp/ventana-edge <FINAL_SHA> && cd /tmp/ventana-edge
  cp supabase/functions/costear-servidor-rc/index.ts supabase/functions/costear-servidor/index.ts
  supabase functions deploy costear-servidor --project-ref mtuvnbgljwbsaizjjgzs
  ```

  Los imports son relativos (`../../../src/…`) y las dos carpetas están a la misma profundidad: la copia resuelve igual.
  Lo único distinto es el comentario de la línea 2.
- **Probado el 14-oct, en local y sin desplegar:** worktree limpio de `0e19fd3` (mismo código de Edge y `src/` de app que FINAL_SHA), la copia y `scripts/edge_boot_check.sh costear-servidor` → `OPTIONS=200 POST=500`, ARRANCA.
- Va **después** del SQL porque registra en las tablas y columnas de SEG-01c.
- **Se verifica:**
  - versión nueva y su `ezbr_sha256` (`list_edge_functions`), que se anotan;
  - con `get_edge_function costear-servidor`, que el `index.ts` publicado sea **byte a byte** el de `supabase/functions/costear-servidor-rc/index.ts` de FINAL_SHA, y que los módulos de `src/` sean los de FINAL_SHA;
  - que la RC y la nueva `costear-servidor` den el mismo resultado sobre el mismo intent.

**Frontend (paso 4). La preview certificada NO se promueve tal cual. El build de producción es obligatorio.**

La preview de FINAL_SHA (paquete) certifica el **código**. No es el artefacto de producción, por dos banderas que Vite fija **al compilar**:

| Bandera | Preview de esta rama | Producción |
|---|---|---|
| `__CARRIL_RC__` (`vite.config.js`: `VERCEL_ENV === 'preview' && CARRIL_RC === 'si'`) | **`true`**: `CARRIL_RC=si` está definida en Vercel sólo para preview de esta rama. Costear llama a `costear-servidor-rc` y `analizar-mueble-rc`. En tiempo de ejecución sólo se activa en hosts `*-rodrigos-eurotrip.vercel.app` (`carrilRcActivo`), pero la URL única de cada deployment y el alias de la rama de producción **sí** cumplen ese patrón. | `false` (`VERCEL_ENV=production`) |
| `VITE_CONTROL_OPTIMISTA` (`conflictoGuardado.js`) | **no definida** ⇒ VH-148 apagado en el cliente | **`1`**. Se define en Vercel (target production) en la ventana, **después** del SQL: con la bandera encendida el cliente llama a la sobrecarga de 3 argumentos, que antes del paso 2 no existe. |

Promover la preview sin recompilar dejaría producción sin control optimista y, en esos hosts, con el carril RC. Por eso:

1. **Cómo se construye.** Fast-forward de `c3.4-seller-safe` a FINAL_SHA: `git push origin <FINAL_SHA>:c3.4-seller-safe`. `c8dd2b3` es ancestro de la rama, así que el push no reescribe nada y el PR #37 queda como merged. Vercel compila producción **de FINAL_SHA exacto**.
   - **No** usar el botón de merge de GitHub: crea otro SHA (merge commit, o commits reescritos con rebase).
   - Si por error se usó, el artefacto no es FINAL_SHA: **STOP**. Para seguir, se verifica que el árbol sea idéntico (`git diff --quiet FINAL_SHA <sha>`) y se registra como artefacto nuevo.
   - Si Vercel no compila solo al recibir el push, se crea el deployment a mano: `create_deployment` con `target: production` y `gitSource.sha = FINAL_SHA`.
2. **Qué se verifica antes de seguir al paso 5** (y siempre antes de estricto):
   - `get_deployment`: `target = production`, `readyState = READY`, `githubCommitSha = FINAL_SHA`.
   - El log del build corrió la suite con 0 fallas.
   - En el bundle publicado (`assets/index-*.js`):
     - `VITE_CONTROL_OPTIMISTA:"1"` presente;
     - `analizar-mueble-rc`: **0** apariciones;
     - `costear-servidor-rc`: **1**, sólo dentro del mensaje de error de cocrear ("falta desplegar costear-servidor-rc…").

     Método validado con dos builds locales de `214786b`: con `VERCEL_ENV=production VITE_CONTROL_OPTIMISTA=1` da exactamente eso. Con `VERCEL_ENV=preview CARRIL_RC=si` no aparece la bandera y da 1 y 2. "Cero `-rc` en el bundle" **no** sirve como prueba: ese texto de error existe en cualquier build.
   - En el dominio de producción, la red del navegador muestra que Costear llama `functions/v1/costear-servidor` y `functions/v1/analizar-mueble`, sin `-rc` (smoke de §5.5, paso 7).
   - El smoke de §5.5, sobre todo el paso 5 (409 entre dos sesiones), prueba la bandera en funcionamiento.
3. **Rollback del cliente:** R2 (`dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3`). La rama de producción queda en FINAL_SHA; el rollback de Vercel no la mueve.

- Va **después** de la Edge y del SQL porque el cliente nuevo llama a las sobrecargas de VH-148/VH-148b y a `adjuntar_costeo_a_partida`.

### 5.4 Rollback (orden inverso, verificado por dependencias)

Cada paso es una transacción propia. El orden **no** es una convención: cada paso tiene que ir antes que el siguiente por una dependencia concreta.

| # | Paso | Cómo | Por qué va antes que el siguiente |
|---|---|---|---|
| R1 | **Estricto → preparado** | `select public.activar_autoridad_costeo('preparado', …)` (sesión humana de Dirección) | Deja de bloquear la emisión al instante y sin quitar nada. Si se quedara en estricto durante R2–R4, el cliente viejo armaría partidas especiales sin promesa ni spec, y la emisión las bloquearía hasta R5. |
| R2 | **Frontend** | rollback de Vercel a `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3` (`c8dd2b3`) | El cliente nuevo llama a funciones que R5–R8 quitan (3 argumentos, `adjuntar_costeo_a_partida`). El cliente viejo sólo usa firmas de dos argumentos, que existen en todos los estados. |
| R3 | **Edge** | redesplegar v9 desde **su commit de origen `ff25ea7`** (el run 4 de "Deploy edge functions", 12-oct 12:32 UTC, publicó v9 a las 12:33:03): `git worktree add /tmp/ventana-r3 ff25ea7 && cd /tmp/ventana-r3 && supabase functions deploy costear-servidor --project-ref mtuvnbgljwbsaizjjgzs`. Esperado: `ezbr_sha256` `f0722f95…`. Que el bundle salga idéntico es una inferencia, no está probada: el CLI respondió "No change found" al redesplegar fuente idéntica de la RC. Si el sha difiere, se compara el contenido con lo guardado en P7. Probado en local: el código de `ff25ea7` arranca (`edge_boot_check`: `OPTIONS=200 POST=500`). | La Edge nueva escribe `costeos_servidor` con promesa y spec. Sin los triggers de SEG-01c (R5), esas filas quedarían sin sellar. La v9 funciona con o sin SEG-01c. |
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
7. La Edge de producción reporta la versión y el sha esperados (§5.3). El cliente sirve FINAL_SHA (`githubCommitSha`) y, en `costeador-vonhaucke.vercel.app`, Costear llama a `costear-servidor` y `analizar-mueble` (sin `-rc`).

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
| Suite completa | `npx vitest run --exclude '.claude/**' --exclude 'node_modules/**' --exclude 'lab/qa/**'` | **353 archivos, 3,451 pruebas, 0 fallas** (local, código de FINAL_SHA; +4 del holdout v5.3, +3 del v5.4, +2 del v5.5 y +10 del v5.6). Lo que vale es CI sobre FINAL_SHA (paquete). |
| Focales | `specTecnica` (41), `specTecnicaGolden` (39), `seg01cVinculoCosteo` (110), `cadenaVentanaRollback` (7), `holdoutHuellas` (37), `integridadGit` (9), `cocrearServidor` (9), `composicionVh035cVh148` (21), `precioIdCatalogo` (2), `promesaComercial` (17), `promesaComercialGolden` (12) | 11 archivos, **304/304** |
| P2 ANTES (cierre absoluto) | `specTecnicaGolden` + `specTecnica` con las fixtures y pruebas nuevas contra `specTecnica.js`, `validarIntentCosteo.js` y el SQL de `2d02527` | **21 fallan** (`docs/auditoria/cierre_go_p2_antes.txt`): colisión por U+001F, `toString`/`constructor`/`__proto__`, orden, Unicode |
| Trazabilidad ANTES | `seg01cVinculoCosteo -t 'Q3/Q4'` con `registroCosteo.js` y `agregarCosteo.js` de `2d02527` (spec desde `intent.pieza`) | **3 fallan** (`docs/auditoria/cierre_go_traza_antes.txt`): control (spec efectiva), reconciliación y respuesta sin spec. Las alteraciones de la partida ya fallaban cerrado antes, porque el intent era el mismo a los dos lados: no es mérito de esta ronda. |
| P0 ANTES (rev4) | `SEG01C_MIG=supabase/tests/fixtures/seg01c_rev4_8cc0adb.sql npx vitest run supabase/tests/seg01cVinculoCosteo.test.js -t "rev 5 · spec\|Q3"` | **13 fallan** con la rev4 (multiplicidad, dimensión, horas, pintura, dificultad, duplicados, sellado, K2 no lava, defensa en la emisión, control del pipeline); con la rev5 pasan |
| Holdout v5.3 ANTES (v5.2) | `holdoutHuellas.test.js` contra `git show 157d0ad:src/datos/holdoutHuellas.js` | **4 de 31 fallan**: M (`playwright.config.js` cambiado ⇒ daba OK), N (reintento), O (árbol sucio) y P (entorno Vite) (`docs/auditoria/holdout_v53_antes.txt`). También reproducido de punta a punta: con el verificador de `157d0ad`, un commit-objeto local con sólo `retries: 5` daba **OK (exit 0)**. |
| Holdout v5.4 ANTES (v5.3) | `holdoutHuellas.test.js` contra `git show 2111f0a:src/datos/holdoutHuellas.js` | **3 de 34 fallan**: Q (`playwright.config.ts` cargado ⇒ daba OK), R (Vite de otro checkout u otros argumentos) y la lista permitida de argumentos (`docs/auditoria/holdout_v54_antes.txt`). Reproducido sobre `2111f0a`: con un `playwright.config.ts` sin versionar, Playwright 1.64.1 lo carga (`config.configFile` = `.ts`) y `git status --porcelain --untracked-files=no` sale vacío. |
| Holdout v5.5 ANTES (v5.4) | `holdoutHuellas.test.js` contra `git show 9013d20:src/datos/holdoutHuellas.js` | **3 de 36 fallan**: S (checkout B con `LAB_GIT_SHA`/`GIT_SHA` = SHA congelado ⇒ daba OK), `envGitLimpio`, y C, que ahora también exige el motivo del HEAD medido (`docs/auditoria/holdout_v55_antes.txt`). Reproducido de punta a punta: Vite real en un checkout B (`9013d20` + `src/App.jsx`) con `GIT_SHA=9013d20` ⇒ `shaApp = 9013d20`, árbol limpio, `mismoCheckout: true`; el verificador de `9013d20` daba **OK (exit 0)**. |
| Holdout v5.6 ANTES (v5.5) | `holdoutHuellas.test.js` contra `git show 6a0091e:src/datos/holdoutHuellas.js` | **1 de 37 falla**: T (`integridadGit` con banderas `assume-unchanged`/`skip-worktree` o bytes distintos ⇒ daba OK; sin `integridadGit` ⇒ daba OK) (`docs/auditoria/holdout_v56_antes.txt`). `scripts/integridadGit.test.js` es nuevo: no existe en `6a0091e`. Reproducido de punta a punta sobre `6a0091e`: worktree limpio, `git update-index --assume-unchanged src/App.jsx`, `src/App.jsx` modificado, Vite real servido desde ese checkout, E2E real con `LAB_GIT_SHA = GIT_SHA = HEAD = 6a0091e`: 1 passed, `git status` y `git diff HEAD` vacíos, `arbolLimpio: true`, y el verificador de `6a0091e` daba **OK (exit 0)** (paquete). |
| Holdout ANTES (v5.1) | `holdoutHuellas.test.js` contra `git show 3583acc:src/datos/holdoutHuellas.js` (+ stub de `costeableDeHoja` con semántica v5.1) | **6 de 27 fallan**: I, I2, J, K, `costeableDeHoja` y "cada request…" (`lab/costear/holdout_intelisis/v52_pruebas_antes_v51.txt`). L ya pasaba. |
| Runbook ANTES | `cadenaVentanaRollback.test.js` con las PROPUESTAS p103b y seg01c de `3583acc` | **falla**: `precio_id` en la vista y comentario en `cuentas_no_humanas` (`docs/auditoria/cadena_ventana_rollback_antes.txt`) |
| Holdout v5.2 | `node scripts/congelar_holdout.mjs --verificar … --corrida lab/costear/holdout_intelisis/corrida_humo_20261014c` y `casos_falla_cerrada.mjs` | OK (exit 0); **16/16** casos alterados fallan cerrado |
| Arranque de la Edge RC | `DENO=… scripts/edge_boot_check.sh costear-servidor-rc` (Deno 2.9.7) | `OPTIONS=200 POST=500` → ARRANCA (500 sin auth es lo esperado) |
| Dos conexiones (VH-148) | `lab/qa/vh148_dos_conexiones/` (`LEEME.md`) | 4/4 casos con PostgREST 12.2.3 y con **14.5** (ronda anterior; VH-148 no cambió) |

## 7. Riesgos residuales (no bloquean la reauditoría; sí hay que verlos en la ventana)

1. **La prueba de dos conexiones no corrió en la nube.** Usó los binarios oficiales de Postgres 16, GoTrue v2.178.0 y PostgREST **14.5** (la misma versión de la nube), con el mismo SQL. Crear una rama de Supabase falló: el conector pide un ID de confirmación de costo que no expone. Lo cubre el postcheck "409 en < 1 s" con la API real.
2. **Postgres de la nube: 17.6** (medido, §3). La prueba de dos conexiones usó binarios de Postgres 16 y las cadenas de PGlite corren PostgreSQL 18. El comportamiento probado (`raise … using errcode`, triggers y `for update`) es estándar en las tres versiones, pero no se ejecutó sobre 17.6: lo cubren los postchecks de §5.2.
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
13. **PGlite corre PostgreSQL 18; la nube, 17.6.** La cadena de rollback reproduce **byte a byte** los md5 de producción
    de la vista y de las funciones del motor (§5.4), lo que indica que el texto de las definiciones coincide. No prueba el
    comportamiento de 17.6.
14. **`golden757Edicion`: CERRADO en `214786b` (causa raíz, no reintento).**
    - **Síntoma:** en CI 786 y 789 falló en el primer intento y pasó en el reintento. Logs de 789: "tarjeta 0..5 sin acomodo (corrida a medias)" y luego "ningún presupuesto golden reciente tiene acomodo".
    - **Causa:** carrera con estado compartido en la nube. Corría en paralelo con `golden757` y elegía "el presupuesto golden más reciente con acomodo" entre los 6 últimos; `golden757` creaba en ese momento uno nuevo, todavía sin acomodo.
    - **Corrección:**
      - `golden757-edicion` es un proyecto de Playwright con `dependencies: ['golden757']`, así que corre **después**;
      - `golden757` escribe el id que guardó en `test-results/golden757-ultimo.json`;
      - la edición abre **exactamente** ese id (recorre hasta 30 tarjetas) y falla si no lo encuentra.
    - **Antes/después:** no hay prueba unitaria que falle antes; la evidencia es la de CI. Antes: 1 flaky en 786 y en 789. Después: CI 791 sobre `214786b`, 94 passed, **0 flaky**; la edición abrió el id 2544, el mismo que guardó `golden757`. Sobre FINAL_SHA: 3 corridas consecutivas (paquete).
    - **Costo:** el E2E de esa pareja ya no corre en paralelo; CI tarda casi lo mismo (6.7 min contra 7.7).
15. **`deno check` de la Edge RC: NO VERIFICABLE.** Falla por los tipos de `npm:openai` en `edge-runtime.d.ts`, ajenos a este cambio. Lo que sí corre:
    - `scripts/edge_boot_check.sh costear-servidor-rc` (arranca: `OPTIONS=200`, `POST=500` sin auth);
    - el despliegue real (v24);
    - el núcleo, por las pruebas de Q3/Q4.
16. **El artefacto de producción no es la preview** (§5.3). La preview certifica el código de FINAL_SHA. El build de producción se genera en la ventana con otras banderas de compilación y se verifica antes del paso 5 (SHA, bundle, red y 409). Si falla una verificación: R2 y no se pasa a estricto.
17. **Cocrear en la Edge:** la rama `accion: "cocrear"` ahora usa `costearConMotor` del núcleo compartido.
    - Lee sólo campos que el núcleo devuelve: `error`, `r`, `estado`, `emision`, `meta`, `warnings`, `insumos` y `parametros` (revisado en el código).
    - Ningún E2E la recorre: `cocrearExpediente` no llama a `costear-servidor`. Su lógica propia (`cocrearServidor.js`) no cambió y tiene sus pruebas.

## 8. Holdout Intelisis

- **Verificador v5.3** (auditoría binaria de `157d0ad`, P1). **Ataque:** congelar en FINAL_SHA y servir un commit que sólo cambia `playwright.config.js` (`retries: 5`). Un fallo intermitente se reintentaba hasta pasar, la evidencia del intento bueno quedaba en `LAB_OUT` y `--verificar` daba **OK**: el config no estaba en el congelamiento ni en la lista de código del git diff. Variante sin tocar archivos: `CI=1` ya da `retries: 1`. **Cierre (de la clase, no sólo del caso):**
  1. `playwright.config.js` y `vite.config.js` entran al congelamiento; `playwright.config` entra a la lista de código del git diff.
  2. El E2E del laboratorio escribe en `0-binario.json`:
     - `reintento` (`testInfo.retry`);
     - `arbolLimpio` (`git status --porcelain --untracked-files=no` vacío);
     - `entornoVite`: el `import.meta.env` que el servidor de desarrollo inyecta de verdad. Cubre `.env*` ignorados por git y variables `VITE_` extra al lanzar Vite.
  3. Con hoja, el E2E **falla** ante un reintento o un árbol sucio.
  4. El verificador exige `reintento = 0`, `arbolLimpio = true` y `entornoVite` igual al del MANIFIESTO (las 7 variables que expone el servidor RC). Un `0-binario` sin esos campos da NO VERIFICADO.
  5. **Pruebas:** M–P en `holdoutHuellas.test.js` (las 4 fallan con la v5.2), más 6 casos nuevos en `casos_falla_cerrada.mjs` (sobre la corrida real). Uno de ellos crea un commit-**objeto** local con sólo el config cambiado: sin rama, sin push y sin tocar el árbol de trabajo.
- **Verificador v5.4** (revisión propia del cierre v5.3, antes de entregarlo). **Ataque:** dejar el `playwright.config.js` congelado intacto y poner al lado un `playwright.config.ts` **sin versionar**. Playwright 1.64.1 prueba `.ts` antes que `.js`. El `.ts` no sale en `git status --untracked-files=no` (`arbolLimpio` y `correr.sh`), ni en el git diff, ni en la huella del `.js`. Con él, por ejemplo, el `baseURL` apunta a otro Vite. Aparte, con `reuseExistingServer: true` el E2E usa cualquier Vite que esté en el puerto, sea del checkout que sea. `correr.sh` lo revisaba, pero el verificador no podía saber si se usó `correr.sh`. **Cierre:**
  1. El E2E escribe en `0-binario.json`:
     - `configPlaywright`: la ruta del config que **cargó** (`testInfo.config.configFile`), relativa a la raíz del repo;
     - `servidor`: el proceso que escucha en el puerto del baseURL (`/proc`, `e2e/servidorVite.js`). Incluye `mismoCheckout` (mismo `cwd` y binario de Vite de este checkout) y `argumentos` (opciones de node, `NODE_OPTIONS` y argumentos de Vite).
  2. Con hoja, el E2E **falla** si el config no es `playwright.config.js`, si el servidor es de otro checkout o si los argumentos no están permitidos.
  3. El verificador exige lo mismo. Los argumentos van contra una **lista permitida** (puerto, `--strictPort`, `--force`, `--max-old-space-size=N`). Una raíz posicional, `--config`, `--mode`, `--require`, `--import` o `--loader` dan CAMBIO. Sin los campos: NO VERIFICADO.
  4. **Pruebas:** Q, R y la lista permitida en `holdoutHuellas.test.js` (las 3 fallan con la v5.3), más 7 casos nuevos en `casos_falla_cerrada.mjs`.
- **Verificador v5.5** (P1-HO-02, revisión acotada de `9013d20`). **Ataque:** checkout B limpio con otro HEAD (p. ej. `src/App.jsx` cambiado, fuera del cierre de imports), arnés v5.4 intacto, `LAB_GIT_SHA` y `GIT_SHA` = SHA congelado. El E2E escribía `shaGit` = `LAB_GIT_SHA`, y `vite.config.js` muestra `GIT_SHA` antes que el HEAD. El verificador hacía `git diff` congelado → `shaGit` = vacío y daba **OK** con evidencia honesta. **Cierre:**
  1. El E2E **mide** `headGit` = `git rev-parse HEAD` (40 hex) en el checkout que sirvió, el mismo del Vite (`servidor.mismoCheckout`). `LAB_GIT_SHA` queda sólo como valor esperado.
  2. Con hoja, el E2E **falla** si no puede medirlo, si el SHA visible no es el HEAD o si `LAB_GIT_SHA` no es el HEAD.
  3. El verificador exige `headGit` de 40 hex (si no: NO VERIFICADO) y que `shaApp` y `shaGit` coincidan con él (si no: CAMBIO). El `git diff` y la lectura de la hoja congelada se hacen desde `headGit`.
  4. Todos los comandos git del E2E y del verificador corren con `envGitLimpio`: sin variables `GIT_*` (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`…), que harían medir otro repo, y con `GIT_NO_REPLACE_OBJECTS=1`, que apaga los objetos `git replace`.
  5. **Pruebas:** S y `envGitLimpio` en `holdoutHuellas.test.js` (fallan con la v5.4), más 4 casos en `casos_falla_cerrada.mjs`, con un commit-objeto local de B: sin rama y sin push.
  6. (La frontera declarada se movió al v5.6, abajo.)
- **Verificador v5.6** (P1-HO-03, revisión acotada de `6a0091e`). **Ataque:** checkout en el MISMO HEAD congelado, `git update-index --assume-unchanged src/App.jsx` (o `--skip-worktree`) y `src/App.jsx` modificado en disco. `git status --porcelain`, `git diff HEAD` y `git diff-files` no lo ven (comprobado con git 2.43; con `skip-worktree` tampoco ven el archivo borrado). `headGit`, `LAB_GIT_SHA` y `GIT_SHA` son el SHA congelado sin mentir, `arbolLimpio: true`, Vite sirve el archivo modificado y el verificador v5.5 daba **OK**. **Cierre:**
  1. `scripts/integridadGit.mjs` mide, en el checkout que sirvió y con `envGitLimpio`:
     - las **banderas del índice**: `git ls-files -v -z`; etiqueta en minúscula = `assume-unchanged`, `S` = `skip-worktree`; con ambas, git muestra `h`. `ls-files -t` NO sirve: muestra `H` con `assume-unchanged`.
     - los **bytes**: para cada blob de `git ls-tree -r HEAD`, el sha1 de blob se calcula con node sobre el archivo en disco (`readlink` para symlinks) y se compara con el del árbol de HEAD. No pasa por el índice, la caché de stat, los filtros de `.gitattributes` ni el fsmonitor de git, así que también cubre una modificación del mismo tamaño con el mtime restaurado y `core.trustctime=false`, que `git status` no ve y `ls-files -v` muestra como `H`. Unos 3,500 archivos en ~3 s.
  2. El E2E escribe `integridadGit` (`headGit`, banderas, archivos distintos, conteos y revisados) en `0-binario.json`. Con hoja, **falla** si no pudo medirla, si fue sobre otro HEAD, o si hay banderas o archivos distintos.
  3. El verificador: banderas o archivos distintos ⇒ **CAMBIO**; integridad medida sobre otro HEAD ⇒ CAMBIO; sin `integridadGit` válido (E2E v5.5, `revisados` 0, campos ausentes, `headGit` corto) ⇒ **NO VERIFICADO**.
  4. `congelar_holdout.mjs` (congelamiento) **aborta** si el checkout no es HEAD byte a byte.
  5. Se mantiene todo el v5.5: `envGitLimpio` (sin `GIT_*`, `GIT_NO_REPLACE_OBJECTS=1`), `headGit` de 40 hex medido, `LAB_GIT_SHA`/`GIT_SHA` sólo como valores esperados, hoja leída en `headGit`.
  6. **Pruebas:** T en `holdoutHuellas.test.js` (falla con la v5.5); `scripts/integridadGit.test.js` (9) sobre repos git **reales** temporales: limpio, `assume-unchanged`, `skip-worktree` (modificado y borrado), ambas banderas, caché de stat, `git replace` y `GIT_DIR`/`GIT_WORK_TREE`/`GIT_INDEX_FILE` desviados. Cada caso comprueba primero que el ataque existe (`git status` o `git diff HEAD` vacíos). Además, `casos_integridad_git.mjs` corre los ataques A–H con checkouts reales y el verificador real, y `casos_falla_cerrada.mjs` suma 4 casos.
  7. **Fuera de alcance, declarado (aplica a todo el holdout):**
     - Quien opera la máquina con **intención de engañar** puede editar `0-binario.json` u otra evidencia a mano, o poner un proxy delante del puerto.
     - Tampoco se cubre editar archivos dentro de `node_modules`: está ignorado por git, y las versiones las fija `package-lock.json`, que sí se congela.
     - Los archivos **sin versionar** no entran en la comparación. Ningún import relativo del código va sin extensión, así que un archivo nuevo no puede ganarle la resolución a uno versionado.
     - Nada de eso deja huella que este verificador pueda leer.
     - `assume-unchanged`/`skip-worktree` **ya no** están en la frontera: quedaron cerrados aquí.
     - En una máquina con `core.autocrlf=true` (Windows) los bytes difieren y el holdout falla **cerrado** (CAMBIO). No hay `.gitattributes` en el repo.
- **Último congelamiento (sobre FINAL_SHA), fuera del repo.**
  - **Qué congela:** el cierre transitivo de imports (ahora incluye `src/datos/costeoServidor.js`), `package-lock.json`, la base y las definiciones SQL (huellas frescas), la Edge RC desplegada desde FINAL_SHA, `analizar-mueble-rc` v8, los modelos y `frontendSha = FINAL_SHA`.
  - **Cómo se corre:**
    1. `node scripts/congelar_holdout.mjs --db <huellas frescas> --edges <edges frescas>` sobre el árbol limpio de FINAL_SHA.
    2. El manifiesto resultante se guarda en el paquete y se restaura el versionado, así que el árbol vuelve a quedar limpio.
    3. Corrida de humo con la hoja `ATPU2M` (servida en FINAL_SHA, Edge RC exacta).
    4. Para `--verificar`, el manifiesto del paquete se pone en `lab/costear/holdout_intelisis/MANIFIESTO.json`.
    5. Los casos alterados de `casos_falla_cerrada.mjs` y los ataques con git real de `casos_integridad_git.mjs`.
  - **Resultados:** en el paquete.
- **Congelamiento anterior (v5.2, histórico):** sobre `7f27dc5`, manifiesto en `f693ba8`, Edge RC v23. `--verificar` dio OK sobre `corrida_humo_20261014c`. Ya no verifica: `214786b` cambió código del cierre.
- **Lote nuevo de Intelisis:** **no se abrió.** Primero se congela.
- **Se invalida** cuando Rodrigo firme los precios del ERP y ante cualquier cambio de motor, prompts, catálogo, config, precios, matching, estados, Edge o modelo. **La ventana lo invalida** (Edge y SQL). Hay que recongelarlo antes de ver resultados del lote nuevo.
- Las hojas del lote nuevo se commitean **antes de recongelar**: el verificador las lee de git en el SHA servido.
  - Una hoja que no esté en ese commit da NO VERIFICADO.
  - Una hoja agregada en `lab/costear/ciego_erp/` **después** del congelamiento cuenta como cambio de código y da CAMBIO.
  - Una hoja no costeable se declara con `costeable: false` y `motivo_no_costeable`, antes de correr.
  - Hay una tensión con la regla de separación (§7 del protocolo: quien elige los muebles no pasa los reportes antes):
    la hoja lleva `erp_referencia`. Dónde y quién commitea las hojas se decide al abrir el lote; no se resolvió en esta ronda.

## 9. Evidencia

**De FINAL_SHA:** en el paquete del auditor, no aquí (ver el encabezado). Cada línea va marcada VERIFICADO / NO VERIFICABLE /
FALLÓ:

- FINAL_SHA y `git diff 214786b FINAL_SHA` (sólo arnés del holdout y documentos);
- CI ×3 consecutivas (`verify` y E2E, 0 flaky);
- preview: `deployment_id`, url, `githubCommitSha`, `READY`;
- Edge RC desplegada desde FINAL_SHA (versión, `ezbr_sha256`, run del workflow);
- manifiesto del holdout, `--verificar` y los 16 casos;
- línea base de producción releída sin drift.

**De `214786b` (último cambio de app y Edge; FINAL_SHA sólo agrega el arnés del holdout v5.3–v5.6 y documentos):**

| Evidencia | Resultado |
|---|---|
| CI | [run 791](https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/actions/runs/38628955786): `verify` **success** (audit, vitest y `vite build`); E2E **success**: 94 passed, 12 skipped, **0 flaky**. Sobre `0e19fd3` (mismo código), [run 792](https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/actions/runs/38631131534): igual, 94 passed y 0 flaky. |
| Suite local | 352 archivos, 3,432 pruebas, 0 fallas |
| Focales | 10 archivos, 285/285 |
| Antes/después | P2: 21 fallan con `2d02527`. Trazabilidad: 3 fallan con `2d02527`. Anteriores: P0, 13 con la rev4; holdout, 6 con la v5.1; runbook, la cadena falla con los rollbacks anteriores. |
| Arranque de la Edge RC | `edge_boot_check.sh costear-servidor-rc` → `OPTIONS=200 POST=500`, ARRANCA |
| Edge RC | `costear-servidor-rc` **v24** `52e4228e…` (deploy 45, `head_sha = 214786b`); `analizar-mueble-rc` v8 `f226b792…` |
| Edge de producción | `costear-servidor` v9 `f0722f95…`, `analizar-mueble` v35 `1e1d496e…`: **sin cambios** |
| Producción | sin SQL de esquema, sin Edge de producción, sin promoción del cliente, sin merge; SEG-01c no aplicada, así que tampoco hay estricto |

**Skips del E2E (12 en CI; todos por variable de entorno, ninguno por fallo):**

| Prueba | Requiere | Qué cubre | Impacto en el release |
|---|---|---|---|
| `labCostear` | `LAB_COSTEAR_IMG` o `LAB_HOJA` | Costear completo → transferencia → guardar → reabrir | **Crítico.** Se corre con la hoja `ATPU2M` y la cuenta QA (credenciales de entorno) como corrida de humo del holdout sobre FINAL_SHA (paquete). |
| `labConcurrencia` | `LAB_CLIENTE` | dos sesiones, VH-148 | **Crítico, pero no se puede antes de la ventana:** el control optimista está apagado en builds que no son de producción y la sobrecarga de 3 argumentos no existe todavía en la base. Lo cubren `lab/qa/vh148_dos_conexiones` (PostgREST 14.5) y el postcheck "409 en < 1 s". |
| `labPdfReabrir` | `LAB_CLIENTE` | PDF y reabrir | La compuerta de emisión nueva (SEG-01) no está aplicada: contra producción mediría la vieja. Lo cubre el smoke de §5.5 (paso 6). |
| `cocrearExpediente` | `COCREAR_QA=1` | Cocrear: reabrir, guardar | No llama a `costear-servidor` (filtro de red del propio E2E). Fuera de alcance del release; ver riesgo 17. |
| `labCocrear` | `LAB_COC_BRIEF` | concepto de Cocrear con IA | Fuera de alcance; cuesta IA. |
| `labCotizarFlujo` | `LAB_MODO` | Cotizar por texto o manual con IA | Cotizar lo cubren `cotizarProyectos`, `golden757` y `golden757Edicion`, que **sí** corren en CI. |
| `labRender`, `renderEscenas` | `LAB_CLIENTE`, `RENDER_PROD=1` | renders | Fuera de alcance; cuestan IA. |
| `labTorreNorte` | `LAB_PLANO` | lectura de planos | Fuera de alcance. |
| `live-ai-smoke` | `LIVE_AI=1` | llamada real de IA | `analizar-mueble-rc` lo ejerce `labCostear`. |
| `vivo`, `vivoSombra` | `VIVO=1` | pasada en vivo con servidor real: los cinco caminos, y la comparación sombra cliente↔servidor del costeo (VH-036/073) | No se corren: gastan IA. La paridad cliente↔servidor del costeo, que es lo que toca este release, la verifica `labCostear` contra la Edge RC (corrida de humo). Los otros caminos de `vivo` no cambian en esta ronda. |
