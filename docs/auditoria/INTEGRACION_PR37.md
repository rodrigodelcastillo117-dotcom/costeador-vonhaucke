# Revisión de integración · PR #37 (`claude/costing-app-architecture-psf02g` → `c3.4-seller-safe`)

**HEAD revisado: `a9fbe39`** (2026-10-13 ~07:30 UTC) · base `origin/c3.4-seller-safe` = `c8dd2b3` · merge-base `c8dd2b3`.
`git diff --stat origin/c3.4-seller-safe...a9fbe39` → **145 archivos, +17 391 / −82** · `git log origin/c3.4-seller-safe..a9fbe39` → **53 commits**.
Revisión de SÓLO LECTURA: no se editó código, no se corrió `db push`, `apply_migration` ni deploy. Las pruebas se corrieron en una copia
(`git worktree`) de `a9fbe39` fuera del repo. El árbol de trabajo tenía además cambios **sin commit** (vh035c, control optimista VH-148,
`formatoHojaErp`, `erpPolitica`, `ConflictoGuardado`…): **quedan fuera de esta revisión**; entrarán en su propio control cuando se commiteen.
Al cerrar esta revisión el HEAD de la rama ya era `b33e6f5`: los commits posteriores a `a9fbe39` **no están revisados** aquí.

## 0. Hallazgos que cambian la historia contada en los informes

| # | Hallazgo | Evidencia |
|---|---|---|
| 1 | **CI `verify` está ROJO en el HEAD** (3 pruebas), no verde como dicen `NOCHE_2026-10-13_INFORME.md` § 8 y `NIGHT_SHIFT_STATE.md` (escritos en `d2bbb9c`, cuando sí estaba verde). Lo rompen dos commits posteriores: `5e36f7e` (override `VITE_ACOMODAR_FN` en `nube.js`) rompe los dos guardas de fuente `src/datos/recoveryLane.test.js:9` y `supabase/functions/acomodar-espacio-recovery/recoverySource.test.js:96` (esperan el literal `invoke('acomodar-espacio-recovery'`, ahora es `invoke(FN_ACOMODAR`); `4281041` (VH-153) rompe `bench/acomodo-calidad/productoTopologiaE2E.test.js:45` (`op-8u-4800x1200-cristal` pasa de `SOURCE_PARTIAL` a `SOURCE_FOUND`, que es precisamente lo que D6 pidió; la prueba no se actualizó). | GitHub run 38362884166 (`a9fbe39`): verify **failure**, E2E failure. Runs 38361756019 (`6a55d7a`) y 38354900725 (`d2bbb9c`): verify **success**, E2E failure. Reproducido local en copia limpia: `3 failed / 2 328 passed (281 archivos)`; en `4281041^` y `5e36f7e^` esas pruebas pasan. |
| 2 | El job E2E está rojo **sólo** por `e2e/persistencia.e2e.js:103` → aserción `e2e/persistencia.e2e.js:125` `expect(fila.partidas[0].costoUnitario).toBe(21000)` (recibe `undefined`). Es el P0 VH-035 real: el mock ahora reproduce producción. `emision.e2e.js` 5/5 verde. | Log del run 38362884166 (`1 failed`, sólo ese spec); reproducido local (Chromium): persistencia 1 ✗, emisión 5 ✓ en 20 s. |
| 3 | La migración ordenada `supabase/migrations/20261010170000_actualizar_cotizacion_preserva_economia.sql` **NO la trae este PR**: ya está en la base (`221c385`, Bloque 1). Sigue en la ruta ordenada y **no aplicada en producción**; un `supabase db push` desde cualquiera de las dos ramas la aplicaría. | `git ls-tree origin/c3.4-seller-safe -- supabase/migrations/` la lista; `git diff --stat base...HEAD -- supabase/migrations/2026*` vacío. |
| 4 | `src/motor/` **no cambia** (ningún archivo). `src/motor/calculo.js` idéntico a la base. | `git diff --stat origin/c3.4-seller-safe...a9fbe39 -- src/motor` → vacío. |
| 5 | Ningún directorio de edge de producción cambia; sólo copias `*-rc`. Desde esta rama se desplegaron hoy **sólo** `*-rc` (6 corridas del workflow manual "Deploy edge functions": `leer-plano-rc`, `leer-plano-core-rc`, `analizar-mueble-rc`, `cotizar-texto-rc`, `generar-render-rc`, `acomodar-espacio-recovery-rc`). | `git diff --name-only … -- supabase/functions \| grep -v -- -rc/` → vacío; logs de los runs 38343689043…38362806439. |

## 1. Inventario por bloques (145 archivos)

Commits por archivo: `git log --format=%h origin/c3.4-seller-safe..a9fbe39 -- <ruta>`. Diff de un bloque: `git diff origin/c3.4-seller-safe...a9fbe39 -- <rutas>`.

### A · SQL (5 archivos) — riesgo al mergear: **ninguno** (nada entra en la ruta ordenada)

| Archivo | Commits | Qué es | ¿Se aplica con `db push`? |
|---|---|---|---|
| `supabase/migrations/PROPUESTA_vh035b_preserva_economia_sin_reciclar.sql` | `6b2d3ac` | Preserva economía sin reciclarla al cambiar producto (`cost_stale`); funciones `SECURITY DEFINER` en `private_api` | **No** (prefijo sin timestamp; la CLI la omite) |
| `supabase/migrations/PROPUESTA_vh146_formato_hojas_erp.sql` | `0e76cb6` | Backfill `atributos.formato` 4×8 / 5×8 (241 hojas), con tabla de respaldo | No |
| `supabase/migrations/PROPUESTA_vh147_elegibilidad_erp.sql` | `0e76cb6` | Política `ERP_ULTIMA_COMPRA_V1`; ventana a decidir (Decisión 1) | No (además está comentada) |
| `supabase/migrations/PROPUESTA_vh148_control_optimista_cotizacion.sql` | `1ac732b` | `p_actualizado_esperado` + `CONFLICTO_VERSION` (Decisión 4) | No |
| `supabase/tests/fixtures/private_api_prod_20261013.sql` | `8871b54` | Cuerpos reales de producción (md5 en encabezado) para PGlite | No (fixture) |
| Migraciones ordenadas `2026*.sql` modificadas o nuevas | — | **0** | — |

RLS/permisos: el diff no contiene `GRANT`, `REVOKE`, `CREATE/ALTER POLICY` ni `ROW LEVEL SECURITY`. `SECURITY DEFINER` sólo aparece en el fixture (copias de prod) y en `PROPUESTA_vh035b` (no aplicada).

**`20261010170000_…preserva_economia.sql` (ya en la base, no en el PR).** Dirección decidió NO aplicarla; `VH035_SQL_VS_MOCK.md` § 4.2 demuestra que recicla costo viejo al cambiar de producto; vh035b/vh035c la sustituyen. Recomendación: en este PR **renombrarla a `PROPUESTA_vh035a_actualizar_cotizacion_preserva_economia.sql`** (sale de la ruta ordenada; cambio de 1 línea en `supabase/tests/preservaEconomia.test.js:263`, que la carga por ruta) y dejar escrito que **nadie corre `supabase db push` contra producción** hasta que Dirección autorice una migración con timestamp. Mantenerla con timestamp sólo es aceptable si se añade esa regla al README de migraciones y a `NIGHT_SHIFT_STATE.md`.

### B · Código de cliente en `src/` (21 archivos de runtime) — **cambia producción al desplegar en Vercel**

| Sub-bloque | Archivos | Commits | Riesgo | Verificación | Nota |
|---|---|---|---|---|---|
| B1 Costeo/ERP (lógica económica sin fórmulas) | `src/datos/amarreERP.js` (VH-149/155), `src/datos/aplicarCompartido.js` (VH-145, extraído de `App.jsx`), `src/datos/conservarConfirmados.js` (VH-150), `src/datos/gemeloErp.js` (VH-151/152), `src/datos/erpCarga.js` (VH-146), `src/datos/senales.js` (VH-143), `src/nube.js` DTO (VH-156) | `b09e443 2efb0fd 95c0207 8f6b36f 3b2ad27 c4aace6 c24a771 0849600 7766ef1` | **medio** | `amarreERP.test.js`, `aplicarCompartido.test.js`, `conservarConfirmados.test.js`, `gemeloErp.test.js`, `erpCarga.test.js`, `senales.test.js`, `costeoServidorDto.test.js`; lab `e2e/labCostear.e2e.js` corridas 6–8 (`lab/noche/costear/`) | No tocan `calculo.js`; sí cambian **qué insumo** queda pegado a una pieza (gemelo ERP propuesto, `MATCH_AUTOCOSTEABLE` incluye `SAME_FAMILY_COMPATIBLE_PROPOSED` → el costo **provisional** usa el precio ERP) y **qué DTO** recibe `costear-servidor` (`areaPintadaM2`, `tubular`, `excluida`). `erpCarga` sólo afecta cargas futuras. |
| B2 UI Costear | `src/componentes/AsistenteEspecial.jsx`, `src/componentes/Costeador.jsx` (VH-143/144) | `3b2ad27 8f6b36f b09e443 2d20985 702ebb7 0849600` | bajo | Lab P0-C; mensaje "puedes cotizar así" corregido (`2d20985`) | VH-144 quita `__producto_maestro` del body a `analizar-mueble` (nadie lo leía). |
| B3 Voni / programa / plan | `src/datos/resolverPrograma.js`, `src/datos/programaRealDelPlano.js`, `src/datos/planoLeido.js`, `src/datos/floorPlan.js`, `src/datos/floorSpecAvisos.js`, `src/datos/leerPlanoArchivo.js` (VH-142), `src/datos/autoRespuestas.js` (Q5·4), `src/componentes/Voni.jsx`, `src/componentes/ConfirmarLectura.jsx`, `src/componentes/CotizadorIA.jsx`, `src/App.jsx` | `940a03f 96267e2 b48c5fa 1fceb29 d6e98db e10fa27 e4df2cb` | **medio** | `resolverPrograma.test.js`, `programaRealDelPlano.test.js`, `planoLeido.test.js`, `autoRespuestas.test.js`; `LAB_TORRE_NORTE.md` § 8 (39/39), `lab/noche/cotizar_c1/` | Cambian la **propuesta comercial**: desempate 16 → 2×8u (antes 12u+4u) y *recomendaciones de casa* por zona (`REGLAS_RECOMENDACION`: sillas de visita, credenzas, silla de recepción) que se agregan por línea con botón. Lectura de `columnas`/`nivel` sólo tiene efecto si el lector los emite (hoy sólo `leer-plano-rc`). |
| B4 Topología de acomodo | `src/datos/placementTopologia.js` (VH-153) | `4281041` | **medio** | `placementTopologia.test.js` (+9) · **rompe** `bench/acomodo-calidad/productoTopologiaE2E.test.js:45` | Módulos operativos App LT fondo 1200 → `DOUBLE_FACE/CATALOG`: cambia el acomodo de 4u…12u en producción. Decisión 6. |
| B5 Overrides de edge en `nube.js` | `src/nube.js` (`FN_LEER_PLANO`, `FN_ANALIZAR`, `FN_COTIZAR_TEXTO`, `FN_GENERAR_RENDER`, `FN_ACOMODAR`) | `e8d5a67 e10fa27 5e36f7e` | **medio (política)** | Ninguna prueba nueva; **rompe** `recoveryLane.test.js:9` y `recoverySource.test.js:96` | Defaults = producción, pero una variable `VITE_*_FN` en Vercel re-apunta el cliente de producción a una RC sin cambiar código. Los guardas existían para impedir exactamente eso. |

### C · Edge functions (24 archivos, todos `*-rc`) — riesgo al mergear: **ninguno** (prod no las invoca sin `VITE_*_FN`)

| Directorio | Archivos | Commits | Delta vs producción (`diff -rq`) | Pruebas |
|---|---|---|---|---|
| `supabase/functions/acomodar-espacio-recovery-rc/` | 11 | `b93d0ef` (VH-154, D6) | sólo `kit-solver.js` difiere (orientación de mesa de juntas) | `orientacionJuntas.test.js` |
| `supabase/functions/analizar-mueble-rc/` | 7 | `e10fa27 3b2ad27` | `index.ts` (EXACT estricto, hoja≠pieza, chapa por caras, G12) | `modelConfig/requestPlan/telemetria.test.js` |
| `supabase/functions/cotizar-texto-rc/` | 1 | `e10fa27` | `index.ts` (inferencias → `recomendadas`, no cobrables) | lab `lab/cotizar/` |
| `supabase/functions/generar-render-rc/` | 3 | `e10fa27 81237f1 56cc700` | `index.ts` (contador mudo → auditor) | `render-core.test.js`; `Q5_RC_CINCO_PUNTOS.md` § 3 (4/5 vs 1/5) |
| `supabase/functions/leer-plano-core-rc/`, `leer-plano-rc/` | 1 + 1 | `da29eca d69fdd1 d620903 e06caac e10fa27` | `index.ts` (columnas, niveles, arco, barra de escala) | `lab/planos/` corpus (`LECTURA_PLANOS_L1.md`) |
| **Directorios de producción modificados** (`acomodar-espacio-recovery`, `analizar-mueble`, `cotizar-texto`, `generar-render`, `leer-plano`, `leer-plano-core`, `costear-servidor`, `cotizar-servidor`, `voni-council`, `usuarios`…) | **0** | — | — | — |

Las `*-rc` **sí existen desplegadas** en Supabase (workflow manual, ver § 0.5): son endpoints vivos con `verify_jwt`; promoverlas = copiar a su directorio de producción y desplegar, cosa que este PR no hace.

### D · Pruebas (16 archivos fuera de C) — riesgo al mergear: ninguno en producción; **señal de CI cambia**

| Archivo | Commits | Cambio | Política |
|---|---|---|---|
| `supabase/tests/preservaEconomia.test.js` (+258) | `6b2d3ac 669c901` | 24 casos PGlite con SQL real (ANTES / DESPUÉS / vh035b) | **1 `it.fails`** (`:357`, caso STALE de la 20261010170000): único uso en el repo; pasa mientras la migración recicle; se vuelve rojo el día que se corrija (canario deliberado). Aceptable si queda documentado (lo está, `:353-355`). |
| `e2e/nubeFalsa.js` (+20/−10) | `61e71ef` | El mock reproduce **producción hoy** (strip sólo a `vendedor`, nada re-pega economía); `crearNubeFalsa({ preservaEconomia: true })` simula la migración; ningún spec la activa | Usado por 7 specs (`persistencia, emision, acomodoServidor, cargaErp, costeadorCatalogo, cotizarTexto, lecturaPlano`); sólo `persistencia.e2e.js:125` cae. Ninguna aserción se debilitó. |
| `e2e/cocrearExpediente.e2e.js`, `e2e/renderEscenas.e2e.js` | `44c5b87` | Guardar ausente/deshabilitado/error ⇒ falla; renders reportan aceptados/total (`RENDER_EXIGE_ACEPTADO=1` exige ≥1) | Más estrictas, no más laxas. |
| 12 `src/**/*.test.js` (amarreERP, aplicarCompartido, autoRespuestas, conservarConfirmados, costeoServidorDto, erpCarga, gemeloErp, placementTopologia, planoLeido, programaRealDelPlano, resolverPrograma, senales) | ver B | Unitarias nuevas/ampliadas | — |
| Pruebas **rojas no documentadas** en HEAD | `5e36f7e 4281041` | `recoveryLane.test.js:9`, `recoverySource.test.js:96`, `productoTopologiaE2E.test.js:45` | **Debe corregirse antes de mergear** (ver § 3). |

### E · Prompts — riesgo al mergear: **ninguno**
No hay archivos de prompt sueltos en el diff (`git diff --name-only … | grep -i prompt` → vacío; `src/datos/renderPrompt.js` sin cambios). Los prompts nuevos viven **dentro** de `supabase/functions/{analizar-mueble-rc,cotizar-texto-rc,generar-render-rc,leer-plano-core-rc}/index.ts`. Ningún prompt de producción cambia (ver C).

### F · Laboratorios y evidencia (70 archivos) — riesgo al mergear: **ninguno**
`e2e/labCostear.e2e.js` (+235, `006c68b…a9fbe39`), `e2e/labConcurrencia.e2e.js` (`006c68b`), `e2e/labRender.e2e.js` (`81237f1 e4df2cb 6a55d7a`), `e2e/labTorreNorte.e2e.js` (`cab4709`): todos con `test.skip(!(TEST_EMAIL && TEST_PASSWORD && LAB_*))` → en CI quedan omitidos. Al correrlos a mano **escriben registros QA "(lab …)" en producción y gastan IA**. Evidencia: `lab/costear/` (11, incl. `credenza_nogal.png` 78 KB), `lab/cotizar/` (9), `lab/erp/` (2), `lab/noche/` (39: corridas 6/7/8, `cotizar_c1`, `concurrencia`, `render_rc`), `lab/planos/` (5: corpus sintético + `medir.mjs` + `gate.mjs`). Son datos, no código ejecutado por la app.

### G · Docs y estado (8) — riesgo: ninguno
`BUG_LEDGER.md` (+8), `NIGHT_SHIFT_STATE.md`, `docs/auditoria/{ERP_PRECIOS_ELEGIBILIDAD, LAB_TORRE_NORTE, LECTURA_PLANOS_L1, NOCHE_2026-10-13_INFORME, Q5_RC_CINCO_PUNTOS, VH035_SQL_VS_MOCK}.md`. Desactualizados en un punto: afirman vitest verde (ver § 0.1).

### H · CI / workflows (1) — riesgo: **bajo (gasto)**
`.github/workflows/lab-planos.yml` (`ad4743a`): `workflow_dispatch` + **cron `17 9 * * 1-5`** que genera el corpus y llama a `functions/v1/leer-plano` (producción por defecto) con la cuenta QA → gasto de IA cada día hábil al mergear, sin decisión explícita. No escribe en BD. `ci.yml` **no cambia** en el PR.

## 2. Cambios peligrosos o sensibles a política (verificación explícita)

| Tema | Resultado |
|---|---|
| Precios, márgenes, fórmulas | `src/motor/` intacto (incl. `calculo.js`). Ningún precio ni margen editado. **Sensible**: `gemeloErp.js` sustituye (como propuesta por confirmar, nunca sobre confirmaciones humanas) el insumo curado sin precio certificado por el gemelo ERP `evidencia.certificable === true`; el costo *provisional* pasa a usar el precio de última compra → depende de la Decisión 1 (vigencia ERP, `PROPUESTA_vh147`). |
| Aprobaciones / emisión | Sin cambios; `emision.e2e.js` 5/5 (CI y local). |
| RLS / permisos | Sin cambios (ver A). |
| Seller-safe (strip) | Producción sin cambios. El mock deja de fingir la migración; `persistencia.e2e.js:125` rojo **a propósito** (P0 VH-035). |
| `it.fails` | 1 uso, documentado (`preservaEconomia.test.js:353-357`). |
| Migración ordenada no aplicada | `20261010170000` en la base; recomendación de renombrar (ver A). |
| Guardas de fuente rotos | `5e36f7e` reemplaza literales por `FN_*`; dos guardas rojos. Opciones: (a) limitar el override a `import.meta.env.DEV` y actualizar los guardas para exigir el default literal `'acomodar-espacio-recovery'`; (b) revertir `5e36f7e`/`e8d5a67`/parte de `e10fa27` y medir RC con un build local sin tocar `nube.js`. |
| Topología D6 | `4281041` cambia el acomodo real de App LT 1200; falta actualizar `productoTopologiaE2E.test.js:45` (o decidir que 8u sin "doble" sigue PARTIAL). |
| Despliegues desde la rama | Sólo `*-rc` (6 runs hoy). Producción (`c8dd2b3` en Vercel; edges prod sin nueva versión desde el repo) no se tocó desde esta rama. |

## 3. Plan de merge por bloques

| Orden | Bloque | Archivos (para `git diff origin/c3.4-seller-safe...a9fbe39 -- …`) | Impacto económico | Condición |
|---|---|---|---|---|
| **M0** — sin efecto en producción | A (4 PROPUESTA + fixture), C (6 dirs `*-rc`), E, F (`e2e/lab*.e2e.js`, `lab/`), G, D salvo lo rojo | `supabase/migrations/PROPUESTA_*` `supabase/tests/` `supabase/functions/*-rc/` `e2e/lab*.e2e.js` `lab/` `docs/` `BUG_LEDGER.md` `NIGHT_SHIFT_STATE.md` `e2e/cocrearExpediente.e2e.js` `e2e/renderEscenas.e2e.js` `e2e/nubeFalsa.js` `src/**/*.test.js` | **cero** | Dirección acepta que la base quede con E2E rojo en `persistencia.e2e.js:125` hasta aplicar vh035b/c (señal visible, como pidió el "control final"). Si no, excluir `e2e/nubeFalsa.js` de M0 (entonces el golden sigue fingiendo la migración). Renombrar `20261010170000` → `PROPUESTA_vh035a_…` + `preservaEconomia.test.js:263`. |
| **M1** — correcciones de cliente de bajo riesgo (todas con unitaria) | B1 sin `gemeloErp.js`; B2; VH-142; textos de lectura | `src/datos/amarreERP.js` `src/datos/aplicarCompartido.js` `src/datos/conservarConfirmados.js` `src/datos/erpCarga.js` `src/datos/senales.js` `src/datos/leerPlanoArchivo.js` `src/datos/floorSpecAvisos.js` `src/componentes/Costeador.jsx` `src/componentes/AsistenteEspecial.jsx` (sin las líneas VH-151/152) `src/componentes/CotizadorIA.jsx` `src/componentes/ConfirmarLectura.jsx` `src/App.jsx` (import `aplicarCompartido`) `src/nube.js` (sólo el DTO VH-156) | bajo: corrigen pérdidas de datos/mensajes; VH-156 cambia el DTO al servidor (paridad, probado en `costeoServidorDto.test.js`) | Despliegue Vercel con los gates de casa (Playwright local + smoke `playwright.prod.config.js`). |
| **M2** — requiere decisiones 1, 5 y 6 de Dirección | `gemeloErp.js` + sus líneas en `AsistenteEspecial.jsx` (D1/D5), `autoRespuestas.js` "lo explícito gana" (Q5·4, ya aprobado el 13-oct), `placementTopologia.js` (D6), `resolverPrograma.js` + `programaRealDelPlano.js` + `Voni.jsx` + `App.jsx` `incluir` (recomendaciones de casa y desempate 2×8u: política comercial), `planoLeido.js` + `floorPlan.js` (L1, inerte hasta promover `leer-plano-rc`) | **medio**: cambian el material provisional, la propuesta comercial y el acomodo | Decisiones por escrito; `productoTopologiaE2E.test.js:45` actualizado; para `gemeloErp`, vigencia ERP definida (vh147) antes de que un precio de hace > 24 m aparezca como provisional sin fecha. |
| **M3** — nunca tal cual | `src/nube.js` overrides `FN_*` (`e8d5a67`, `e10fa27` parcial, `5e36f7e`); `lab-planos.yml` con cron; `20261010170000` en la ruta ordenada | — | Reescribir según § 2 "Guardas"; cron sólo con autorización de gasto (o dejar sólo `workflow_dispatch`). |

Lo que **no** debe hacerse al mergear: `supabase db push`, `apply_migration`, deploy de edges de producción, ni tomar los cambios sin commit del árbol de trabajo.

## 4. CI: qué corre en el PR y qué se espera

`.github/workflows/ci.yml` (sin cambios en el PR): `on: pull_request` (y push a `c3.4-seller-safe`, `demo-ceo-autopoblar-zonas`, `chatgpt/perfection-v2-20261005`), una corrida viva por PR. Jobs: **`verify`** = `npm ci` → `npm audit --omit=dev --audit-level=high` → `npx vitest run` (sin `vitest.config`: toma `src/`, `supabase/tests/` PGlite, `supabase/functions/**/*.test.js` incl. `*-rc`, `bench/`) → `npm run build`; **`e2e`** = `npx playwright install chromium` → `npm run e2e` (todos los `e2e/*.e2e.js`; los autenticados y los `lab*` se omiten sin `TEST_EMAIL/TEST_PASSWORD`/`LAB_*`).

| Job | Estado esperado tras el PR tal cual | Estado real en `a9fbe39` | Causa |
|---|---|---|---|
| `verify` | **verde** (el STALE es `it.fails`) | **ROJO** (3/2 331) | `5e36f7e` (2 guardas) y `4281041` (bench). En `d2bbb9c` y `6a55d7a` estaba verde. |
| `e2e` | **rojo sólo** en `persistencia.e2e.js:103` por la aserción `:125` (`costoUnitario` 21000 → `undefined`), VH-035 real | ROJO, 1 failed, sólo ese spec (con 1 retry) | Mock = producción (`nubeFalsa.js:323-326`). Se pone verde cuando producción preserve la economía y el spec corra con `preservaEconomia: true`. |

Condición de "CI verde salvo el rojo documentado" (informe § 9): **no se cumple hoy** por los 3 fallos de § 0.1; se recupera corrigiendo o revirtiendo `5e36f7e` y actualizando la prueba de `4281041`.
