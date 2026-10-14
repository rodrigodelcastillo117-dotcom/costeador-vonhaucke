# RELEASE 9.5 GATE · Cierre final pre-deploy (14-oct-2026)

**Regla de este gate:** un punto cuenta como cerrado sólo si el comportamiento es correcto, la evidencia es reproducible y la
prueba **falla con el código anterior**. "No verificable" no cuenta como PASS. Este documento **no** autoriza producción:
es el runbook para la reauditoría final y para la ventana.

| | |
|---|---|
| Rama | `claude/costing-app-architecture-psf02g` ([PR #37](https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/37)) |
| Último cambio de código | `fcfedc2`: verificador del holdout v5.1 y el E2E del laboratorio, que no viajan al binario de la app. El último cambio que sí viaja al binario es `9890cd6` (PT409). Después sólo hay congelamiento, evidencia y documentos. |
| Holdout congelado sobre | `fcfedc2`, manifiesto en `1f7608c`, huella `1dfa826a60726887…` (v5.1) |
| SHA final, preview y CI | En §9. Un archivo no puede llevar el SHA de su propio commit: §9 se escribe en el commit siguiente y sólo trae evidencia. |
| Producción (cliente) | `c3.4-seller-safe` @ `c8dd2b3`, `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3`. **Sin cambios.** |
| SQL de esquema aplicado en producción en este cierre | **ninguno** |
| Datos escritos en producción en este cierre | Carga de compras 2026, pedida por Rodrigo ("cargatodos los precios que tengamos"): 499 precios en estado `propuesto` y 71 filas nuevas de catálogo. Acta: `docs/auditoria/CARGA_COMPRAS_2026_20261014.md`. Ninguna firma. |
| Cuenta `qa-direccion` | **RIESGO ACEPTADO POR DIRECCIÓN.** No bloquea este release (decisión expresa de Rodrigo). |

## 1. Criterios del gate final

| Criterio | Estado | Evidencia |
|---|---|---|
| 0 P0 técnico conocido | **Cumple.** Hubo dos hallazgos propios en este cierre y los dos están corregidos y probados. (1) PostgREST reintentaba `40001` sin fin: se cambió a `PT409` y se verificó en PostgREST 12.2.3 y en la **14.5**, que es la versión de la nube. (2) El verificador del holdout daba un falso OK con un resumen que ocultaba `costear-servidor` de producción: corregido en la v5.1. | `docs/auditoria/VH148_DOS_CONEXIONES_20261014.md`, `lab/costear/holdout_intelisis/VERIFICACION_20261014.md` |
| Promesa comercial ligada al costeo | **Cumple.** `promesa_comercial_v1`, con JS = SQL demostrado por 11 fixtures doradas compartidas. La Edge RC guarda `promesa_origen`; el trigger sella `promesa_version = 'v1'` y `promesa_huella`, y nadie las puede cambiar después. `adjuntar` compara huellas. | `docs/auditoria/SEG01C_REV4_PROMESA_COMERCIAL.md`; 77 + 17 + 12 pruebas |
| K1→K2 probado | **Cumple.** K2 se vincula con **su** promesa. K1 queda `reemplazado_por` y no revive. K2 no lava un cambio posterior a su nacimiento. | `seg01cVinculoCosteo.test.js`, bloque rev4 |
| CAS real probado | **Cumple, con un límite.** Dos sesiones GoTrue reales contra Postgres 16 y PostgREST 14.5 reales: cotización, expediente y `adjuntar` con versión vieja dan 409 `PT409`, sin last-write-wins. **No** corrió en la nube de Supabase (§7). | `lab/qa/vh148_dos_conexiones/evidencia_20261014_pgrst14.json` |
| Holdout fail-closed | **Cumple (v5.1).** La corrida real da OK y los 9 casos alterados fallan: falta `request_id`, falta llamada a la RC, aparece producción (honesto, oculto en `ajenas` u oculto en todo el resumen), ids descuadrados, sin `edges.json`, sin SHA de git, y sin `--corrida`. Es reproducible con `casos_falla_cerrada.mjs`. | `lab/costear/holdout_intelisis/VERIFICACION_20261014.md` |
| Request IDs completos | **Cumple.** N llamadas de IA = N `request_id`, cada uno con evento (función, modo y `model_id`). | ídem |
| Sólo Edge RC durante el holdout | **Cumple.** Toda llamada `costear-servidor*` debe ser exactamente `costear-servidor-rc`, y cada caso costeable necesita al menos una. Desde la v5.1 esto se deriva de `porFn` y de las llamadas crudas, no del campo `ajenas`. | ídem |
| CI 100 % verde, build verde, E2E 0 fallos | En §9, sobre el SHA final. | GitHub Actions |
| Preview del SHA exacto READY | En §9. | Vercel |
| Runbook actualizado | Este documento. | — |

## 2. Qué se cerró en esta ronda

| Commit | Qué |
|---|---|
| `88904e4` | Holdout v5: `request_id` por llamada, costeo sólo RC y ≥ 1, `0-binario.json` con SHA del navegador, SHA de git, baseURL y fecha. Acta de la carga de compras. |
| `6ff2c79` | SEG-01c **rev4**: `promesa_comercial_v1` (JS ≡ SQL), Edge RC v22, `adjuntar` compara la huella, motivos de emisión, 4 ataques que pasaban con la rev3. |
| `9890cd6` | VH-148: `40001` → `PT409` en las 3 propuestas y en el cliente. Arnés y acta de la prueba de dos conexiones. |
| `18088fd`, `2bd5092`, `33c2837`, `af36714` | Holdout v5 recongelado, cast de `request_id` en `modelos_observados.sql`, corrida de humo y `--verificar` OK. La v5.1 reemplaza ese congelamiento. |
| `5057d61` | Repetición de la prueba de dos conexiones con **PostgREST 14.5** (la de la nube) y este runbook. |
| `fcfedc2` | Holdout **v5.1**: el verificador deriva las Edges ajenas y las llamadas RC de `porFn` y de las llamadas crudas; exige `edges.json`; el E2E guarda el `request_id` aparte. 5 pruebas que fallan con la v5. |
| `1f7608c`, este commit | Recongelamiento v5.1, corrida de humo nueva (`corrida_humo_20261014b`), `--verificar` OK y los 9 casos de falla cerrada. |

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
- no existen `adjuntar_costeo_a_partida` ni `promesa_partida`;
- `costeos_servidor` no tiene columnas `promesa_*`;
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
| `costear-servidor-rc` | **v22** | `d97214c7db06acf32d54e5293090d10342f7fc5ebe5bdfc0530a296994b88556` (despliegue 43, contiene la rev4) |
| `analizar-mueble-rc` | v8 | `f226b7927d345f885145eee1a7606c5bd34fcbe8e3b3f0b88e3bad33e0fb323f` |

Mientras SEG-01c no esté aplicada, `costear-servidor-rc` costea igual pero no registra el costeo: no hay `costeoId`, la respuesta lo avisa y la emisión de producción no cambia.

## 4. Migraciones de la ventana: archivos exactos y orden

Orden **probado** en Postgres 16 real (`lab/qa/vh148_dos_conexiones/construir_base.mjs`) y en PGlite (`seg01cVinculoCosteo.test.js`, `composicionVh035cVh148.test.js`; esta última también prueba SEG-01 → VH-148 → VH-148b → SEG-01c y rechaza SEG-01c antes de VH-148b).

| # | Archivo | md5 | Precondición que el propio archivo verifica (aborta si falla) |
|---|---|---|---|
| 0 | respaldo en un esquema nuevo `respaldo_<fecha>`, con el mismo patrón que `respaldo_ventana_etapa3_20261013`: copia de las tablas de negocio (incluye `cotizaciones`, `cotizaciones_revisiones`, `expedientes`, `expediente_revisiones`, `insumo_precios`, `insumos_catalogo` y `config`), más `_conteos`, `_funciones` y `_vistas` | — | — |
| 1 | `PROPUESTA_p103b_precio_id_en_catalogo.sql` | `0d3c2b46e88cf8601a10f52a37053970` | ninguna. Va **antes** de SEG-01c porque cambia `catalogo_motor` y con ello la huella de base. |
| 2 | `PROPUESTA_vh148_control_optimista_cotizacion.sql` | `1c94c8ed8f699164e928d515f4b7ab5d` | existe el núcleo de dos argumentos (VH-035c) |
| 3 | `PROPUESTA_vh148b_fail_closed_versiones.sql` | `12045ef0d39d9ca1340affd497bf6fd6` | VH-148 aplicada |
| 4 | `PROPUESTA_seg01_emision_snapshot_fiel.sql` | `83d386bcf946494c47dd7e887d7b7f9b` | el gate de emisión no cambió (drift) |
| 5 | `PROPUESTA_seg01c_vinculo_costeo_partida.sql` (rev4, **modo `preparado`**) | `5bc8855b2f518837d9f5c5181887e842` | VH-035c (`partida_definicion`) y VH-148b (trigger `trg_vh148_version`) |
| 6 | `PROPUESTA_vh100_cargar_costos_oficiales.sql` | `1f1a7eef812ffb824b13ff152e51ea48` | independiente. Sin el reporte de Compras no cambia ningún costo. |
| — | `PROPUESTA_vh148c_retira_escrituras_sin_version.sql` | `17a4742af14e1f2620ca2f93d15436b9` | **No va en esta ventana.** Sólo cuando ningún cliente `c8dd2b3` siga abierto: con él aplicado, el cliente viejo deja de guardar (42501). |

Cada archivo es una sola transacción (`begin … commit`). Si falla una precondición, no se aplica nada de ese archivo.

## 5. Runbook de la ventana

**Secuencia:** SQL en orden → smoke real → Edge → cliente → activar estricto → E2E final de Rodrigo.
No se activa estricto sin la decisión de Dirección.

### 5.1 Prechecks (todos deben dar lo esperado; si no, no se abre la ventana)

| # | Comprobación | Esperado |
|---|---|---|
| P1 | CI del SHA que se va a desplegar | verify y E2E en `success` |
| P2 | Preview Vercel de ese SHA | `READY` |
| P3 | `md5sum` de los 6 archivos de §4 | igual a la tabla |
| P4 | Última migración aplicada | `20261014130610 tramo_por_pieza_catalogo`, sin nada nuevo desde este documento |
| P5 | `select application_name from pg_stat_activity where usename = 'authenticator'` | `PostgREST 14.5`. Si cambió, repetir `medir_40001.mjs` con esa versión. |
| P6 | Objetos de §3: sobrecarga de 3 argumentos, `adjuntar_costeo_a_partida`, columnas `promesa_*` | no existen |
| P7 | Código actual de `costear-servidor` v9 y `analizar-mueble` v35 (`get_edge_function`) | guardado en el respaldo, para el rollback de Edge |
| P8 | Paso 0 aplicado: `_conteos` del respaldo = conteos del origen | sí |
| P9 | Holdout | no se abre el lote nuevo de Intelisis durante la ventana. Después hay que recongelarlo (§8). |

### 5.2 Postchecks por paso

| Después de | Comprobación | Esperado |
|---|---|---|
| 1 · P1-03b | la vista del catálogo vigente expone la columna `precio_id`, y `catalogo_motor` devuelve `precioId` en los insumos del smoke | presente |
| 2 · VH-148 | dos sesiones QA sobre una cotización QA: guardar con la versión vieja | **HTTP 409 `PT409` en menos de 1 s**; sin versión → 400 `22004` |
| 3 · VH-148b | existe `trg_vh148_version`; un expediente QA editado con la revisión vieja | 409 `PT409` |
| 3 · cliente viejo | el cliente `c8dd2b3` guarda una cotización QA | **sigue guardando** (VH-148b no retira la firma de dos argumentos) |
| 4 · SEG-01 | `evaluar_emision_cotizacion` sobre una cotización QA ya evaluada antes | mismo estado que antes |
| 5 · SEG-01c | `select modo from private_api.politica_emision_autoridad` | `preparado` |
| 5 · SEG-01c | columnas `promesa_origen`, `promesa_version` y `promesa_huella`; trigger `trg_costeo_promesa_servidor` | existen |
| todos | `select count(*) from pg_proc … where prosrc ~ '40001'` en `public` y `private_api` | **0**; `PT409` > 0 |
| smoke real | costear en el preview RC (Diseño) → K con `promesa_version = 'v1'` y huella → agregar a una cotización QA → `adjuntar` OK → `diagnostico_autoridad_costeo` sin motivos para ese renglón | todo OK |

### 5.3 Edge y cliente

- **Edge:** se promueve `costear-servidor-rc` a `costear-servidor` **después** del paso 5, porque necesita las columnas de SEG-01c para registrar. Después hay que verificar que la versión y el `ezbr_sha256` nuevos coinciden con el artefacto del SHA desplegado.
- **Cliente:** merge del PR y deploy de producción de Vercel con `VITE_CONTROL_OPTIMISTA=1`. `CARRIL_RC` **no** se define en producción.
- **Estricto:** `select public.activar_autoridad_costeo('estricto', '<exigir_vigente|congelar_al_costear>', '<MOTOR_VERSION desplegada>')`. Lo corre una sesión humana de Dirección, porque la base rechaza las cuentas no humanas. Antes hay que revisar `diagnostico_autoridad_costeo` en las cotizaciones abiertas.

### 5.4 Rollback (en orden inverso)

1. **Cliente:** rollback de Vercel a `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3` (`c8dd2b3`). No depende de la base: el cliente viejo funciona con VH-148 y VH-148b aplicadas porque usa la firma de dos argumentos.
2. **Estricto → preparado:** `activar_autoridad_costeo('preparado', …)`. Así deja de bloquear sin quitar nada.
3. **Edge:** volver a desplegar el código de `costear-servidor` v9 guardado en P7.
4. **SQL**, en orden inverso, y cada bloque en su propia transacción:
   - **SEG-01c:** líneas `-- RB`. Quitan funciones, trigger y política, y restauran el wrapper de VH-035c (md5 `cf6ef6a30bbb68eb2b867f2bcdb7c846`). `costeos_servidor` se conserva, porque es auditoría.
   - **SEG-01:** bloque `>>> ROLLBACK SEG-01`, que restaura producción byte a byte (md5 `9c660b09…`).
   - **VH-148b:** líneas `-- RB`.
   - **VH-148:** bloque `>>> ROLLBACK VH-148`. Quita las sobrecargas de tres argumentos y devuelve `cotizacion_segura` byte a byte.
   - **P1-03b:** líneas `-- RB`. Recrean las vistas sin `precio_id`.
5. Los rollbacks de VH-148, SEG-01 y SEG-01c están probados en PGlite: `controlOptimista.test.js`, `composicionVh035cVh148.test.js` y `seg01cVinculoCosteo.test.js`, que comprueba las funciones quitadas y la reaplicación.

## 6. Pruebas (reproducibles)

| Qué | Cómo | Resultado |
|---|---|---|
| Suite completa | `npx vitest run --exclude '.claude/**' --exclude 'node_modules/**' --exclude 'lab/qa/**'` | 349 archivos, **3,306** pruebas, 0 fallas (local, `fcfedc2`). Lo que vale es CI (§9). |
| Focales | promesa (17), golden SQL (12), SEG-01c (77), VH-148 (13), VH-148b (48), composición (21), conflicto (18 + 18), intent (4), holdout (21 + 3) | 11 archivos, **252/252** |
| SEG-01c ANTES | bloque "ANTES · rev3 (96bab98)" en `seg01cVinculoCosteo.test.js` | los 4 ataques de Q2 **pasaban** con la rev3 |
| Dos conexiones | `lab/qa/vh148_dos_conexiones/` (`LEEME.md`) | 4/4 casos con PostgREST 12.2.3 y con **14.5** |
| 40001 vs PT409 | `node medir_40001.mjs` | 14.5: `40001` sin respuesta, 19,435 ejecuciones en 8 s; `PT409` → 409 en 68 ms, 1 ejecución |
| Holdout v5.1 | `node scripts/congelar_holdout.mjs --verificar … --corrida lab/costear/holdout_intelisis/corrida_humo_20261014b` y `casos_falla_cerrada.mjs` | OK (exit 0); 9/9 casos alterados fallan cerrado |
| Holdout ANTES | las pruebas D–H con el `holdoutHuellas.js` de `5057d61` | 5 fallan (el falso OK existía) |
| E2E local afectados por `PT409` | los E2E que usan `e2e/nubeFalsa.js` con conflicto, incluido `persistenciaVh035c` | 12/12 |

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
10. **E2E inestable: `golden757Edicion`.**
    - En CI 786 (`66dd3a0`) falló en el primer intento ("ningún presupuesto golden reciente tiene acomodo") y pasó en el reintento.
    - En CI 785 (`5057d61`, mismo código de app) pasó sin reintento.
    - Depende de datos QA compartidos en la nube: busca entre los 6 presupuestos "Torre Sur (golden)" más recientes uno que ya tenga acomodo, y otras corridas, en paralelo o canceladas, los dejan a medias.
    - No se tocó en este cierre: cambiar `e2e/` invalida el congelamiento del holdout. Va a la lista de después del lote Intelisis.

## 8. Holdout Intelisis

- **Congelado (v5.1)** sobre `fcfedc2`, con 108 archivos, `package-lock.json`, base, definiciones SQL, Edges RC v22/v8, modelos y SHA de frontend. `--verificar` dio OK sobre la corrida de humo `corrida_humo_20261014b`, servida en `1f7608c`.
- **Se invalida** cuando Rodrigo firme los precios del ERP y ante cualquier cambio de motor, prompts, catálogo, config, precios, matching, estados, Edge o modelo. **La ventana lo invalida** (Edge y SQL). Hay que recongelarlo antes de ver resultados del lote nuevo.
- Después de `1f7608c` sólo cambian evidencia, documentos y `lab/costear/holdout_intelisis/`, nada del manifiesto. `--verificar` se vuelve a correr sobre el SHA final (§9).

## 9. Evidencia del SHA final

**SHA evaluado: `66dd3a0359c8b233a7ebcd5871ae6b69720af59f`.** Es el último con código y evidencia. El commit que agrega esta sección sólo cambia este archivo, así que su CI y su preview se reportan en el paquete de reauditoría (`00_LEEME_AUDITOR.md`).

| Evidencia | Resultado |
|---|---|
| CI | [run 786](https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/actions/runs/38589415579): `verify` en **success** (audit, vitest y `vite build`) y E2E en **success**: 93 passed, 12 skipped, **1 flaky** (`golden757Edicion`, riesgo residual 10). |
| CI anterior, mismo código de app (`5057d61`) | [run 785](https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/actions/runs/38586081121): success, 94 passed, 12 skipped, 0 flaky |
| Preview Vercel | `dpl_5SKh38tXAGNgXjtqjutxH1KB1xft` (`costeador-vonhaucke-m631befvd-rodrigos-eurotrip.vercel.app`), **READY**, `githubCommitSha` = `66dd3a0…` |
| Suite local | 349 archivos, 3,306 pruebas, 0 fallas (`fcfedc2`) |
| Pruebas focales | 11 archivos, 252/252 |
| Holdout v5.1 | `--verificar` → **OK** (exit 0) sobre `corrida_humo_20261014b`; 9/9 casos alterados fallan cerrado |
| Edge RC | `costear-servidor-rc` v22 `d97214c7…`, `analizar-mueble-rc` v8 `f226b792…` (releídas a las 15:25 UTC) |
| Edge de producción | `costear-servidor` v9 `f0722f95…`, `analizar-mueble` v35 `1e1d496e…`: **sin cambios** |
| Producción | sin SQL de esquema ni promoción del cliente; SEG-01c no aplicada, así que tampoco está en estricto; sin merge |
