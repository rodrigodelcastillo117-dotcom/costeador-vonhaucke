# VON HAUCKE — FINAL PRODUCT COMPLETION · CLOSEOUT STATE

> Estado VIVO y VERÍDICO para continuar entre sesiones y para auditoría de ChatGPT.
> Regla: este archivo refleja SIEMPRE el HEAD real, los tests reales y qué quedó REALMENTE
> cableado vs pendiente. Cero información histórica presentada como estado actual.
> Última actualización: 2026-10-09 (ronda 3 ChatGPT cerrada + cable FloorPlanReader + rewrite sin contradicciones).

## ESTADO ACTUAL (verificado contra el repo)
- Rama: `audit/final-product-completion`. **Último commit de CÓDIGO = `66caeb7`**; el HEAD de la rama es el
  doc-commit de este CLOSEOUT encima (un commit no puede contener su propio SHA). Tip exacto: `git rev-parse HEAD`.
  Diff completo de la rama: `git diff e5f737f..HEAD` · lista: `git log --oneline e5f737f..HEAD`.
- **Tests: 1995 / 1995** (vitest) · **Build: ✅** (vite) · verificado en esta sesión (2026-10-09).
- **MANDATO RC (deadline lunes 12-oct)**: autónomo hasta Release Candidate. Autorización NUEVA de Rodrigo:
  cutover del motor SÓLO para productos NUEVOS (shadow primero), agregar parser XLSX justificado, preparar edges.
  Siguen prohibidos (se preparan/documentan como BLOCKED_EXTERNAL, no se ejecutan): merge, deploy/promote,
  migración prod, escrituras masivas prod, modificar 33 legacy, aprobar DATA TRUTH, integrar Intelisis.
- **P0 de cliente ABIERTOS: 0.** (Historial de cerrados abajo.) Falta E2E autenticado (cobertura, no P0 abierto).
- **Cableado REAL hoy** (capa ADITIVA — NO cambia ningún número del motor; tests de dinero verdes):
  1. `Precios.jsx` (Dirección): columna "Procedencia" por insumo — chip por TIPO de fuente + tooltip "¿por qué $544?".
  2. `HojaCosto.jsx` (Costear/veCostos): "✓ Costo con evidencia real" sólo si TODA la MP es real FECHADA con FX
     verificado; si no, "N de M material(es) sin evidencia — costo no oficial".
  Ambas usan UN adapter canónico `resolverPrecioInsumoVivo` (un precio capturado a mano NO hereda evidencia vieja).
  3. `floorPlanReader.js`: cable PURO lector real (`programaDelPlano`) → `observed_program` (test con lector real).
- **NO cableado todavía** (son los bloques grandes, requieren decisión/deploy — ver "SIGUIENTE"):
  - El MOTOR (`calcular()`) sigue tomando `insumo.precio`; el `CanonicalPriceResolver` aún NO gobierna el número.
  - El lector de PDF en vivo (edge `leer-plano`) → cable → UI de confirmación (requiere deploy).
  - Ingestión documental de los `.xlsx` reales (requiere dep de parser + aprobar mapeo = DATA TRUTH).

## Base / rama / límites
- BASE_SHA: `e5f737f044f2ecfd326b35640b995c0111c07902` (= audit/material-gate-v4-final, Material Gate P0.1–P0.16 aprobado).
- Material Gate CONGELADO salvo que un E2E real descubra un P0 demostrable.
- **Límites (hard):** NO merge · NO prod deploy · NO promote · NO migraciones en prod · NO escrituras masivas de prod ·
  NO modificar las 33 cotizaciones legacy · NO aprobar DATA TRUTH · NO integrar Intelisis.
  Operaciones irreversibles se preparan/documentan y quedan pendientes de autorización.

## Restricción de verificación (honestidad)
La app apunta a Supabase PROD (`nube.js` hardcoded). No me autentico con el password real de prod (sería enviar
credenciales a un servicio externo). Por eso:
- VERIFIED por mí: lógica pura (motor/material/acomodo/provenance/plan), build, suite, render sin auth, consola/red al cargar, auditoría de código, y que la app ARRANCA autenticada como Dirección (sesión persistida de Rodrigo — sólo lectura, sin tocar su WIP).
- BLOCKED_EXTERNAL (requiere login con cuenta de PRUEBA): E2E autenticado de guardar/reabrir, roles en vivo, aprobar contra servidor, autosave real, storage real.

## HISTORIAL DE AUDITORÍA (ChatGPT) — qué pasó en cada ronda

### Ronda 4 (ChatGPT, hallazgos POSTERIORES sobre 0637d0e) — 5 de 6 cerrados (código `c744689`)
Son hallazgos posteriores, NO contradicciones del rewrite. Cerrados:
- **#1 TIMEOUT REAL**: la lectura de plano abortaba a 60 s, pero en PROD una lectura real tardó **64.841 s**
  (el cliente mataba algo que el servidor sí completaba). FIX: `leerPlanoArchivo.js` → `TIMEOUT_LECTURA_MS = 180 s`.
- **#4 VALIDITY VENCIDA → HISTORICAL**: una observación con vigencia que ya pasó ya NO cae a REAL_OBSERVED;
  es **HISTORICAL** y **bloquea** costo oficial. (`canonicalPriceResolver.js`)
- **#3 ROOM ≠ FURNITURE**: `observed_program` gana `kind` (room/furniture/amenity); `resumenObservado` cuenta
  **cuartos** y **muebles** por separado (nunca mezclados); `floorPlanReader` emite los cuartos como `kind=room`.
- **#5 CONSERVAR PROCEDENCIA hasta VONI**: `leerPlanoDeArchivo` ya NO tira la lectura; devuelve
  `lectura`/`floorSpec`/`request_id` y el `observed_program` derivado del lector real (cable floorPlanReader).
- **#6 LABEL PRECISO**: HojaCosto ya no dice "Costo con evidencia real" (sobre-reclamo); dice
  **"Precios de MP con evidencia real (consumo/MO/GI sin verificar)"** — sólo el precio de MP está verificado.
- **#2 PENDIENTE (requiere edge + deploy)**: que el lector de PDF detecte MOBILIARIO real (observed_program de
  muebles), no sólo heurística de áreas. Hoy `programaDelPlano` estima puestos por área; la detección de símbolos
  de mueble vive en la edge `leer-plano` (prompt de visión) y verificarla necesita deploy. El contrato y el cable
  ya están listos para recibir esa salida.

### Ronda 4b — versiones ESTRICTAS de los P0 (código `18f0e08`)
- **P0-C estricto**: el MUEBLE implicado por un cuarto (escritorio/mesa/mostrador) ya NO es OBSERVED aunque el
  cuarto esté detectado → INFERRED hasta confirmar (`floorPlanReader.capInferred`). El cuarto sí es OBSERVED.
- **P0-B adversarial**: validity malformed → fail-closed HISTORICAL; future → CURRENT_VERIFIED;
  expired+current-verified → gana vigente; expired+newer-real → gana real DATED.
- **P0-A stale-guard**: `Voni.subirPlanoAqui` descarta una lectura lenta superada por una subida más nueva;
  catch recuperable. (Timeout real 180 s ya estaba.) Falta (edge): AbortController del fetch real + telemetría.

### Ronda 1 (red-team interno de 5 agentes)
Hallazgo clave TRANQUILIZADOR: **el motor de costeo es sólido; NO hay P0 que produzca un número incorrecto en el
camino principal** (un solo motor cliente/servidor; el edge importa `src/motor/calculo.js`; fail-closed real:
precioDe→NaN, costeoEmitible bloquea, UNKNOWN≠$0). Los P0 eran de MANEJO DE ESTADO UI y de infra de seguridad.
**7 P0 + 2 P1 cerrados** (ver "P0 de cliente cerrados").

### Ronda 2 (ChatGPT, sobre HEAD dca88e2)
Reabrió 2 P0 que mi reporte dio por cerrados mal → **AMBOS cerrados** (commit `b54a1f3`). Rebaselineó seguridad y
amplió el mandato a REALITY CUTOVER.
- **P0-A render stale**: la firma vieja (`program_hash|floor_hash|nº-colocaciones`) no cambiaba al mover/rotar un
  mueble, y los dos botones de guardar publicaban sin verificar. FIX: `firmaLayout()` (incluye x/y/rot/w/d por
  colocación) + autoridad única fail-closed `renderCorrespondeAlLayout`. (`acomodoHash.js`, tests de acomodo.)
- **P0-B seller-safe**: `limpiarSensibles` no saneaba `piezas[*].costoUnitario` ni `partidas[*].{costoUnitario,margen}`,
  y el autosave local escribía antes del gate de rol. FIX: `sinEconomiaInterna()` + saneo de piezas/partidas +
  guardado local saneado para roles sin veCostos. (`sellerSafeState.test.js`.)
- Seguridad: `config_leer` YA está cerrada en prod; las 4 edges IA tienen verify_jwt=true (no "sin auth").

### Ronda 3 (ChatGPT, sobre HEAD e91e014) — cortó falsos verdes. TODOS corregidos:
- **P0-PLAN-GOLDEN** (era FALSO): el golden "132 m²" inventaba 18 puestos y 2 privados. Corregido al ground truth
  real del PDF QA-COT-01: **Open Space = 8 puestos = 4 benches × 2**. El contrato `observed_program` ahora separa
  **MUEBLES (`quantity`)** de **PUESTOS (`capacity_per_unit`/`capacity_total`)**; `resumenObservado` reporta ambos.
  El caso "18 puestos" se relabeló como test SINTÉTICO de contrato (no plano real). HONESTO: la fixture
  `GOLDEN_A_132M2_8_PUESTOS` es el observed_program ESPERADO del PDF; cuando el lector real la IGUALE será USER_FLOW_PASS.
- **P0-PRICE-TRUST**: HojaCosto podía decir "evidencia real" sobre un precio editado a mano (heredaba la `fuente`
  vieja). FIX: adapter ÚNICO `observacionDeInsumoVivo`/`resolverPrecioInsumoVivo` — capturado a mano ⇒ PROVISIONAL.
- **PRICE DATE/TRUST**: `REAL_OBSERVED` → `REAL_OBSERVED_DATED` / `REAL_OBSERVED_UNDATED`. Un real SIN fecha (p.ej.
  `FUENTE_ERP`) ya NO afirma "fechado/vigente" ni habilita costo oficial. Las etiquetas muestran el TIPO de fuente
  (Compra/T.D.C./Lista), no un genérico "Compra real".
- **FX PROVENANCE**: MP en moneda ≠ MXN con tipoCambio sin procedencia ⇒ NO cuenta como evidencia real.
- **REPO HYGIENE**: quitado del índice el symlink `node_modules → ruta absoluta`; `.gitignore` corregido (el patrón
  con barra no casaba un symlink).
- **SEGURIDAD `app` edge**: ChatGPT la inspeccionó en Supabase: sólo sirve un `index.html` público de Storage, sin
  input/secrets/DB → **NO es P0** (superficie legacy, posible drift vs Vercel; limpieza, no seguridad).

## P0 de CLIENTE cerrados (con commit; tests/build verdes; pusheados)
Ronda 1: (1) costo fantasma por falta de medida `5b522e4` · (2) fuga seller-safe en localStorage `5b522e4` ·
(3) pérdida de datos al reabrir `5b522e4` · (4) renders de Cotización pisaban estado `d93c005` ·
(5) "COSTO CERTIFICADO" stale al cambiar BOM `d93c005` · (6) config compartida se sobrescribía al cargar `cb89439` ·
(7) bucle de autosave en Acomodo `3212f4e`. + P1-13 IVA y P1-7 vendedor sin precio `d4951c5`.
Ronda 2: **P0-A render stale** + **P0-B seller-safe completo** `b54a1f3` (la 1ª versión de P0-3 fue `73bd64d`).
Ronda 3: **P0-PLAN-GOLDEN** + **P0-PRICE-TRUST** + date/FX/hygiene `7a4f834`, `11224e6`.

## Seguridad — rebaselineado contra PROD real (NO hay P0 de seguridad abierto)
- `config_leer` RLS: **YA cerrada en prod** (`USING private_api.puede_editar_config()`). El viejo "security P0-2" no existe.
- `cotizar-texto`, `generar-video`, `leer-plano-core`, `analizar-negocio`: **verify_jwt=true**. No son proxies anónimos.
  El viejo "security P0-1 (sin auth)" era inexacto.
- `app` edge (verify_jwt=false): sólo HTML público de Storage → **no es P0**; superficie legacy a revisar/retirar.
- P1 ejecutable (sin deploy): hardening interno de las 4 edges IA (rate-limit/topes/validación de params), p.ej.
  `generar-video` (allowlist model/operation). No bloquea.

## REALITY CUTOVER — cadena de verdad económica
Objetivo: FUENTE→EVIDENCIA→INTERPRETACIÓN→CONFIRMACIÓN→PRODUCTO→BOM→MP→PRECIO→COSTO→COTIZACIÓN→ACOMODO→OUTPUT.
Ninguna etapa inventa la siguiente. "REAL" exige provenance. Hoy costear con la última evidencia REAL conocida de VH;
Intelisis = adapter FUTURO. NO usar $0 como desconocido; no viejo-como-vigente; no mezclar unidades.

**ENTREGADO (puro, determinista, con tests):**
- `src/datos/precioProvenance.js` — contrato de observación de precio + estados
  `ESTADO_PRECIO`: CURRENT_VERIFIED / **REAL_OBSERVED_DATED** / **REAL_OBSERVED_UNDATED** / HISTORICAL / PROVISIONAL / PENDING;
  `etiquetaFuentePrecio` (Compra/T.D.C./Lista/Intelisis/Estimado).
- `src/datos/canonicalPriceResolver.js` — `resolverPrecioCanonico` (identidad exacta + tier + fecha/confianza),
  `explicarPrecio` ("¿por qué $544?"), `etiquetaEstadoDeResolucion`, `bloqueaCostoOficial`, `resolverCatalogoPrecios`.
  Un real SIN fecha o un provisional/pendiente **bloquea** el costo OFICIAL.
- `src/datos/intelisisPriceProvider.js` — adapter de DISEÑO, NO integrado (`fetch()` lanza `ERP_NO_INTEGRADO`).
- `src/datos/precioInsumoBridge.js` — puente al catálogo REAL: `clasificarFuenteTexto` (por patrón) + `fechaDeFuenteTexto`
  + `observacionDeInsumoVivo`/`resolverPrecioInsumoVivo` (capturado-aware, ÚNICA verdad para UI y futuro motor).
- `src/datos/observedProgram.js` — contrato `observed_program` {type, quantity, **capacity_per_unit, capacity_total**,
  zone, grouping, position, orientation, dimensions, page, evidence, confidence, origin}; ORIGEN observed/inferred/suggested
  derivado de PROCEDENCIA (floorSpec, una sola verdad); `confirmarObservado` (acto EXPLÍCITO, nada se autoconfirma).
- `src/datos/floorPlanReader.js` — `observedProgramDeLectura(pr)`: cable del lector REAL `programaDelPlano` → observed_program.
- `src/datos/shadowCutover.js` — SHADOW del motor (ChatGPT §8): compara legacy `insumo.precio` vs canónico por insumo.
  Resultado catálogo real: **259/259 iguales, 0 diferencias numéricas → cutover SEGURO**; 93 quedarían como costo
  NO oficial (85 provisional + 8 sin fecha). Honesto: cutover numérico es no-op hoy (1 observación/insumo);
  el gobierno real del número cobra sentido al ingerir la serie histórica (xlsx).
- `src/datos/productSpec.js` — PRODUCT INTELLIGENCE (§5): contrato de MUEBLE con evidencia por dato; material
  ambiguo/ausente → PENDING, espesor no visible → PENDING (sin default), dimensión inconsistente entre vistas → CONFLICT.
- `src/datos/bomGenerator.js` — BOM determinista desde ProductSpec (§6): sin material canónico → PENDING;
  sin regla de merma → consumo_bruto PENDING (nunca merma mágica); costo oficial ≠ oportunidad industrial.
- `src/datos/goldenReality.js` — GOLDEN REALITY (§13): compararGolden(humano, app) clasifica diferencias por
  causa (IDENTIDAD_MP/UNIDAD/CONVERSION/CANTIDAD/CONSUMO/MERMA/PRECIO/MONEDA_FX/MANO_OBRA/INDIRECTOS/FINANCIERO/
  REDONDEO/DATO_FALTANTE). Diagnostica, no cuadra. Marco para T.D.C. humana vs app (espera ingestión xlsx).
- `src/datos/fxProvenance.js` — FX con procedencia (§9): normalizarFx + resolverFx (VERIFIED_CURRENT/REAL_DATED/
  HISTORICAL/PROVISIONAL/PENDING). FX viejo o sin valor NO habilita costo oficial. Falta: cablear a la conversión USD.
- **FIX crítico**: el helper `num` devolvía 0 para null/whitespace (Number(null)===0, Number('  ')===0) → corregido
  (null/undefined/''/whitespace → null) para no violar "$0≠desconocido" ni meter una merma de 0%.

### Ronda 5 — RED-TEAM adversarial interno (código `66caeb7`)
Un subagente red-team atacó los 8 módulos nuevos. Bugs reales encontrados y CERRADOS (con regresión):
- HIGH: bomGenerator tragaba una merma fuera de rango (−5/≥100) → línea COMPLETO con bruto null. Ahora MERMA_INVALIDA → PENDING.
- MEDIUM: fechaDeFuenteTexto fabricaba fechas de folios/OC ("folio 15032026"→fecha) → precio sin fecha pasaba a
  REAL_OBSERVED_DATED. Ahora DDMMYYYY sólo en contexto de fecha + validación de calendario. ERP real intacto (2026-08-10).
- LOW: comparador de alternativas NaN (fechas null) → determinista; `hoy` inválido degradaba todo a HISTORICAL → fallback;
  explicarPrecio "Invalid Date" → "sin fecha"; productSpec espesor 0/whitespace → FALTA_ESPESOR.
Módulos sin bug en el eje de datos-incorrectos (declarado por el red-team): precioProvenance, shadowCutover, observedProgram
(core), canonicalPriceResolver (tier correcto).

**INVENTARIO real del catálogo (mandate A, `insumos.js`, 259 insumos; hoy=2026-10-09):**
11 fuentes distintas: ERP Luis Daniel (99, 2026-08-10), Sonara (28), T.D.C. Alpura (18), Compras (15),
ERP última compra (6, SIN fecha), T.D.C. banca (4), Mercado estimado (3), T.D.C. Alba (2), Loktec (2),
Rodrigo rango (1), **81 sin fuente**. Coherencia resuelta con los estados nuevos:
**166 REAL_OBSERVED_DATED · 8 REAL_OBSERVED_UNDATED · 85 PROVISIONAL** (0 PENDING; todos tienen un número).
EcoLegno 19 mm = $544 → REAL_OBSERVED_DATED (Compras 2026-08-14). Capa ADITIVA: NO cambia los números del motor.

**SIGUIENTE (necesita decisión/autorización o deploy):**
1. **MOTOR CUTOVER** (ChatGPT #8): que el precio EFECTIVO que entra a `calcular()` venga de `resolverPrecioInsumoVivo`
   con fail-closed (PENDING/PROVISIONAL/UNDATED ≠ costo oficial en silencio). PRESERVAR goldens/paridad; explicar qué
   observación reemplaza a cuál. ⚠️ Cambia números y toca el MOTOR CONGELADO + las 33 legacy → **requiere OK de Rodrigo**
   (y alcance: sólo productos nuevos, o también legacy). Hoy el motor NO usa el resolver.
2. **Ingestión documental real** (ChatGPT #7): leer read-only `fuentes/*.xlsx` conservando
   archivo→hoja→celda→artículo ERP→variante→precio→moneda→unidad→fecha→proveedor→canonical_id→conversión.
   Requiere (a) dep de parser de xlsx (no hay) + (b) mapeo clave_erp→canonical_id = **DATA TRUTH** (reservado).
   NOTA: `lista_precio_items` (Supabase) ya tiene provenance/precio_lista/moneda/vigencia_desde/hasta.
3. **PDF→leer-plano→cable→UI en vivo**: el cable (`floorPlanReader`) ya existe y está probado con el lector real;
   cerrar el lazo (PDF real por la edge + UI de confirmación) requiere **deploy**. La fixture GOLDEN_A es el esperado.
4. **GOLDEN REALITY**: BOM/consumo/precio/costo humano (T.D.C. real) vs app; clasificar diferencia por causa; no ajustar
   el motor para cuadrar. (Depende de #2.)
5. **PRODUCT INTELLIGENCE**: ProductDrawingReader→ProductSpec→BOM determinista→resolver→costo (reusar `evidencia.js`).
6. **FX con provenance**: modelar tipoCambio con fecha/fuente (hoy sólo se marca provisional si moneda≠MXN).

## Matriz (estado real al código 0637d0e)
| Área | CODE | INTEGRATION | E2E | USER FLOW | Pendiente |
|---|---|---|---|---|---|
| Home/Navegación | ✅ | ✅ | ✅ smoke | ✅ render | — |
| Money/Motor | ✅ | ✅ | — | BLOCKED(auth) | margen rancio/25% (P1); el resolver aún NO gobierna el número |
| Costear | ✅ | ✅ | — | BLOCKED | HojaCosto muestra calidad de costo por procedencia (wired) |
| Cotizar | ✅ | ✅ | — | BLOCKED | gate stale P1 |
| Cocrear | ✅ | ✅ | — | BLOCKED | CocrearV2 dead code (P2) |
| Acomodo | ✅ | ✅ | — | BLOCKED | render stale P0-A CERRADO (firmaLayout); autosave loop CERRADO |
| Renders | ✅ | ✅ | — | BLOCKED | stale→PDF P0-A CERRADO |
| PDF/Print | ✅ | ✅ | — | BLOCKED | imágenes faltantes sin aviso (P1) |
| Login/Recovery | ✅ | ✅ | ✅ smoke | BLOCKED(creds) | error genérico login (P1) |
| Roles | ✅ | ✅ | — | BLOCKED | seller-safe COMPLETO P0-B CERRADO |
| Security | ✅ rebaselineado | — | — | — | 0 P0; hardening interno edges (P1, sin deploy) |
| Economía/Provenance | ✅ | catálogo real 166/8/85 | Precios+HojaCosto wired | render en vivo pendiente | motor cutover + serie documental (ver SIGUIENTE 1,2) |
| Plan Intelligence | ✅ contrato+cable | cable lector real | — | BLOCKED(deploy) | PDF→edge→UI en vivo + Product Intelligence |
| Persistence | ✅ | ✅ | — | BLOCKED | reopen/config CERRADOS |
| VONI/Council | ✅ | ✅ | — | BLOCKED | proveedorReal traga errores (P1) |
| Performance | — | — | — | — | bundle/rerenders (P2) |
| UX/Responsive | ✅ | — | ✅ 375px | ✅ render | — |

## P1 ejecutables que QUEDAN (sin E2E)
money margen-rancio (b.margen congelado en mount) · margen mínimo como gate (hoy sólo aviso) ·
React P1 (gate/chips stale en Cotización, EditarPartida derivados viejos, carreras acomodar/plano, logout limpia cotización) ·
silent P1 (listaPermitidos/leerDireccion/verificarDespiece tragan error → "no hay datos" como hecho; edge `usuarios` ok:true con upsert fallido) ·
hardening interno de edges IA. P2: dead code CocrearV2, code-split del bundle (1.16MB), chips inertes.

## BLOCKED_EXTERNAL (requiere acción del usuario)
- E2E autenticado (acomodo, programa, cross-flow, roles, guardar/reabrir, aprobar): los specs `e2e/*.e2e.js` SE SALTAN
  sin `TEST_EMAIL`/`TEST_PASSWORD`. Correrlos: `TEST_EMAIL=<cuenta-de-prueba> TEST_PASSWORD=<...> npx playwright test`
  (NO la cuenta de Rodrigo, para no ensuciar prod). `live-ai-smoke.e2e.js` consume IA real (dinero) → selectivo.
- Motor cutover, ingestión documental (xlsx dep + DATA TRUTH), y verificación en vivo de Plan Intelligence (deploy).

## Commits de esta rama (feat/fix; además hay doc-commits de este CLOSEOUT — ver `git log e5f737f..HEAD`)
- `c744689` ronda 4: timeout real + validity→HISTORICAL + room≠furniture + conservar procedencia + label preciso
- `0637d0e` cable FloorPlanReader→observed_program (lector real)
- `11224e6` saca symlink node_modules del índice + .gitignore
- `7a4f834` golden 132m² real + price-trust + date-trust + FX (ronda 3)
- `313af38` test golden observed_program · `f1cd961` HojaCosto procedencia · `cb76854` UI Precios procedencia
- `f3d6a7d` puente catálogo real + inventario · `3051b5c` observed_program v1
- `83a93da` REALITY CUTOVER v1 (provenance + resolver + Intelisis adapter)
- `b54a1f3` P0-A render stale + P0-B seller-safe (ronda 2) · `73bd64d` React P0-3 (1ª versión)
- `d4951c5` P1-13 IVA + P1-7 vendedor · `3212f4e` React P0-2 autosave · `cb89439` silent P0-3 config
- `d93c005` React P0-1 renders + P0-5 label · `5b522e4` 3 P0 integridad + red-team
