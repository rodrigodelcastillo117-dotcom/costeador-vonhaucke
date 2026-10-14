# Static guards → pruebas de comportamiento (2026-10-14)

**Regla del dueño del producto:** "No quiero 'poner verde' ocultando warnings, cambiando expectativas de tests,
bajando validadores". Un PASS sólo vale si la prueba **ejecuta** el comportamiento y **falla** con un defecto plantado.

**Qué es un *static guard*:** una prueba que lee el código fuente con `readFileSync` y compara TEXTO
(`toContain` / `toMatch`). Pasa mientras la cadena exista, aunque el comportamiento esté roto alrededor de ella.

## Método

1. **Extracción a funciones puras (refactor puro, mismas salidas).** La lógica atrapada en componentes se movió a
   módulos de `src/datos/` y el componente ahora delega. No cambió ningún resultado: mismo orden de efectos, mismas
   ramas, mismos mensajes. Las dependencias que el componente evaluaba de forma perezosa se pasan como *thunks*
   (`pendientes`, `snapshot`, `visualHashActual`) para conservar exactamente cuándo se calculan.
2. **Pruebas que ejecutan** esas funciones con datos que difieren en UN centavo, costos desconocidos, gates
   DESCONOCIDO, roles, etc. El SQL de emisión se ejecuta en **PGlite** con los cuerpos **desplegados**.
3. **Mutaciones plantadas** con un arnés que aplica el defecto, corre la prueba y **restaura siempre** el archivo
   (verificado: ningún archivo mutado quedó modificado en `git status`). Además, sobre una copia limpia de `HEAD`, se
   aplicaron mutaciones equivalentes al código ORIGINAL y se corrieron las pruebas VIEJAS: **las 8 sobreviven**.
4. Lo que no se puede ejecutar en este entorno (node, sin jsdom ni Deno) quedó como **`// STATIC GUARD:`** con el
   motivo escrito: casi siempre el *cableado* componente → función probada.

## Módulos extraídos (refactor puro)

| Módulo nuevo | Sale de | Qué contiene |
|---|---|---|
| `src/datos/agregarCosteo.js` | `App.jsx` `onAgregarCotizacion`, `partidaDeCosteo` | gate autoritativo al centavo cliente↔servidor y armado de la partida; partida de línea fail-closed |
| `src/datos/emisionViva.js` | `App.jsx` `verificarEmision`, `onEmitida` | gate y revisión sólo sobre el guardado VIVO confirmado |
| `src/datos/modoDocumento.js` | `Cotizacion.jsx` `resolverModoDocumento` | DEFINITIVO sólo con `ALLOWED` + revisión inmutable; si no, BORRADOR |
| `src/datos/renglonesComerciales.js` | `App.jsx` `mismoRenglon`, `juntarIguales`, `costoDeBanco`, `margenDeBanco`; `AsistenteEspecial.jsx` comparación de re-costeo | fronteras de dinero a centavos |
| `src/datos/sombraCosteo.js` (`entradaSombraCliente`) | `AsistenteEspecial.jsx` | lado cliente de la sombra a centavos |
| `src/datos/montosFicha.js` | `FichaPDF.jsx` | importe/IVA/total con dinero canónico |
| `src/datos/contextoVoni.js` | `App.jsx` (contexto de Voni) | costeo vivo compartido y economía sólo para quien ve costos |
| `src/datos/renderCotizacion.js` | `Cotizacion.jsx` `renderTodas`, `renderOficina`, `cotParaPdf` | sólo URLs de Storage en el estado; render de oficina sólo desde Acomodo |
| `src/datos/validacionIngenieriaCocrear.js` | `CocrearV3.jsx` | validación de ingeniería decidida por el servidor para esta revisión |
| `supabase/tests/fixtures/emisionBaseAislada.js` | `supabase/tests/seguridadGateEmisionSnapshot.test.js` | la base PGlite con SQL de producción, ahora compartida (movida tal cual; esa prueba sigue con 55/55) |

## Tabla por archivo

"Mutación → resultado": **MATADA** = la prueba nueva FALLA con el defecto (lo que se busca). Las mutaciones
`VIEJA-*` se aplicaron al código original y se corrieron contra la prueba ORIGINAL.

### Mayor riesgo económico (costo / emisión / dinero)

| Archivo | Antes: qué comparaba | Después: qué ejecuta | Mutaciones plantadas → resultado |
|---|---|---|---|
| `src/datos/authoritativeCostGate.test.js` (1 → 7 casos) | Texto en `App.jsx`: `clienteC !== servidorC`, `costoUnitario: costoServidor`… | `partidaAutoritativaDeCosteo` con servidor simulado: igualdad al centavo, diferencias de $0.01 en ambos sentidos, persistencia de `dinero(servidor)`, incompleto/bloqueado, servidor caído o que rechaza, pendientes perezosos | A1 tolerar ±1 centavo → MATADA · A2 persistir costo del navegador → MATADA · A3 saltar incompleto/bloqueado → MATADA · A4 servidor caído ⇒ confiar en cliente → MATADA · **VIEJA-A1** (`clienteC !== servidorC && Math.abs(...) > 1`) → **SOBREVIVE** a la prueba vieja |
| `src/componentes/advancedSpecialUnknownCost.test.js` (1 → 4) | Texto: `clienteC == null \|\| servidorC == null`, `not.toContain('costoUnitario: 0')` | Costos desconocidos (`undefined/null/''/'   '/NaN/Infinity/'abc'`) del cliente, del servidor y de ambos ⇒ no se agrega | A5 `aCentavosEnteros(x) ?? 0` → MATADA · **VIEJA-A5** (`aCentavosEnteros(costoClienteRaw ?? 0)`) → **SOBREVIVE** |
| `src/datos/emissionExactCentsSql.test.js` (1 → 8) | Texto de `docs/sql/emission_exact_cents_v3.sql` (documentación, **no** lo desplegado) | **PGlite** con `private_api_emision_prod_20261013.sql` (md5 de producción verificado en `seguridadGateEmisionSnapshot`): `emitir_revision_v2` rechaza `precioLista` a ±$0.01 y redondeado al peso; Σ round(pu×cant,2) por renglón; total = suma exacta; precio canónico con descuento al centavo; `evaluar_emision_cotizacion` bloquea especial a ±$0.01; paridad JS↔SQL fuera de medio centavo | S1 tolerancia ±$1 en precioLista → MATADA · S2 round(Σ) → MATADA · S3 precio autoritativo al peso → MATADA · S4 ±$1 en precio canónico → MATADA · S5 ±$1 en precio especial del gate → MATADA · S6 ±$1 en total → MATADA · **VIEJA-S1** (la misma tolerancia en el SQL **desplegado**) → **SOBREVIVE** (la prueba vieja leía `docs/sql`) |
| `src/datos/liveQuoteEmissionGate.test.js` (3 → 6) | Texto: `guardado: false, motivo: 'red'`, `!r.guardado`, `guardarRevision(estado, g.id)` | `guardarCotizacion` con la red caída (actualizar y crear); `verificarEmisionViva` con guardado fallido/sin id/excepción/sin sesión (no consulta el gate) y exitoso (id recién guardado, snapshot tomado DESPUÉS de guardar); `registrarEmisionViva` (id vivo, aviso sólo si es nueva) | E1 gatear sin guardado confirmado → MATADA · E2 congelar revisión sin guardado → MATADA · E3 snapshot antes de guardar → MATADA · E4 red caída reportada como guardado → MATADA · **VIEJA-E1** (`!r.id \|\| (!r.guardado && false)`) → **SOBREVIVE** |
| `src/componentes/quoteEmissionAuthority.test.js` (3 → 7) | Texto: `if (estadoGate !== 'ALLOWED')`, `definitivo: false`; Edge: `precioConDescuento(precio_lista, descuento)` | `resolverModoDocumento` con gate DESCONOCIDO / excepción / null / sin estado / BLOCKED / APPROVAL_REQUIRED / ECONOMICS_INCOMPLETE / ALLOWED; problemas locales sin consultar al servidor; registro de revisión fallido/sin registro/aprobación; aritmética de `comercialDinero` (lo que importa la Edge) | Q1 DESCONOCIDO permitido → MATADA · Q1b `estadoGate = DESCONOCIDO ? 'ALLOWED' : …` (deja intacto el texto del `if`) → MATADA · Q2 definitivo sin revisión → MATADA · Q3 excepción ⇒ ALLOWED → MATADA · Q4 ignorar candado de proyecto → MATADA · Q5 descuento al peso → MATADA · **VIEJA-Q1b** → **SOBREVIVE** |
| `src/componentes/lineItemCostFailClosed.test.js` (3 → 7) | Texto: `'FAIL-CLOSED'`, `costoPendiente: veCostos && costo == null`, `margenEf = costo != null` | `partidaDeCosteo` con motor que lanza, costo oficial null/NaN/∞, costo explícito, vendedor (no corre el motor ni recibe economía), pendientes del despiece | L1 derivar costo de precio/margen → MATADA · L2 `costo = 0` → MATADA · L3 `costoPendiente: false` → MATADA · L4 conservar margen → MATADA · L5 vendedor corre el motor → MATADA (la primera versión de la prueba la dejó **sobrevivir**; se corrigió la prueba) · **VIEJA-L1** (`costo = Number(precioUnitario) * 0.65`) → **SOBREVIVE** |
| `src/datos/moneyBoundaries.test.js` (4 → 7) | Texto: `aCentavosEnteros(a.precioUnitario)`, `dinero(costoImplicito(precio2))`, `precioCliente: dinero(precio)` | `mismoRenglon`/`juntarIguales` con precios a un centavo; `costoDeBanco` (462.96 / 277.78, al peso darían 463 / 278); `entradaSombraCliente`; `difierenAlCentavo` | M1 agrupar al peso → MATADA · M2 costo de banco al peso → MATADA · M2b precio 2 al peso (texto `dinero(costoImplicito)` intacto) → MATADA · M3 sombra al peso → MATADA · M4 comparar costo guardado al peso → MATADA · **VIEJA-M1** y **VIEJA-M2b** → **SOBREVIVEN** |
| `src/componentes/pdfMoneyTrust.test.js` (3 → 5) | Texto: `if (!Number.isFinite(v)) return '—'`, `importePorCantidad` en FichaPDF | **Genera el PDF** (jsPDF en node) y lee cada celda dibujada: centavos en renglones y escalera; NaN/'abc'/∞ ⇒ "—"; null ⇒ "Sin precio"/"Pendiente"; ningún "$0.00". `montosFicha` con precio/cantidad inválidos ⇒ null | P1 dinero inválido ⇒ "$0.00" → MATADA · P2 `pesos(pt.precioUnitario \|\| 0)` → MATADA · P3 importe desconocido ⇒ 0 → MATADA · P4 formato al peso → MATADA · P5 importe con flotante crudo → MATADA |

### Visibilidad económica, renders y Cocrear

| Archivo | Antes | Después | Mutaciones → resultado |
|---|---|---|---|
| `src/datos/designCommercialBoundary.test.js` (3 → 5) | Texto JSX de HojaCosto (`{mostrarComercial && utilidad > 0`) | **Renderiza `HojaCosto`** con `react-dom/server`: con capacidad comercial apagada no hay precio de lista, utilidad ni volumen, y los únicos montos son los técnicos; costeo incompleto ⇒ "Pendiente"; roles | D1 precio de lista visible → MATADA · D2 utilidad calculada sin capacidad → MATADA · D3 precios por volumen → MATADA |
| `src/componentes/voniLiveCosting.test.js` (2 → 5) | Texto: `calcularCosteoVivo(estado, costeo).resultado` | `costeoVivoParaVoni` con el **motor real** (= `calcularCosteoVivo`), BOM vacío, motor que falla, cinco roles sin costos (el motor ni se llama) y tres con costos; partidas a Voni sin costo/margen | V1 costeo a Voni sin importar rol → MATADA · V2 motor corre para vendedor → MATADA · V3 costo en partidas de Voni → MATADA |
| `src/datos/renderStoragePolicy.test.js` (3 → 5) | Texto: `render: r.url`, mensaje "no voy a inventar una oficina" | `rendersFaltantes` (sólo URL, nunca `dataUrl`; no regenera; no muta); `crearPartida`/`validarPartida` con base64; `mensajeRenderOficina`; `cotizacionParaPdf` (bytes sólo en la copia) | RS1 base64 al estado → MATADA · RS2 regenerar existentes → MATADA · RS3 sin acomodo validado → MATADA · RS4 bytes escritos en el estado → MATADA · RS5 URL cruda al PDF → MATADA |
| `src/componentes/cocrearEngineeringValidation.test.js` (5 → 7) | Texto de CocrearV3 (`const servidorVigente=…`, `_engineering_validated:false`) | `estadoValidacionIngenieria` (revisión cambiada, otra revisión visual, sin visual hash, servidor que no validó, sello del cliente ignorado, hash visual perezoso), roles, BOM pendiente, `sinValidacionIngenieria` | C1 servidor vigente con revisión cambiada → MATADA · C2 ignorar revisión visual → MATADA · C3 ventas aprueba → MATADA · C4 funciones sin despiece no cuentan → MATADA · C5 commit conserva validación → MATADA |
| `src/componentes/recostDeltaTrust.test.js` (1 → 2) | Texto: `aCentavosEnteros(costoGuardado.costoUnitario) != null` | `difierenAlCentavo` con costo guardado desconocido contra 0 y contra un costo real | R1 desconocido ⇒ 0 → MATADA |
| `src/datos/pioneerAiProductRender.test.js` (1 caso tocado) | Texto del mensaje de render de oficina | El mismo caso ahora ejecuta `mensajeRenderOficina` + cableado | (cubierto por RS3) |

**Total de mutaciones plantadas: 53 sobre el código nuevo → 53 MATADAS** (una, L5, sobrevivió primero y obligó a
corregir la PRUEBA, no el código). **8 mutaciones equivalentes sobre el código original → 8 SOBREVIVEN a las
pruebas viejas.**

## Hallazgos que salieron al ejecutar (no se ocultaron; quedan visibles con `it.fails`)

Convención del repo (`seguridadGateEmisionSnapshot`): `it.fails` exige el comportamiento CORRECTO y hoy falla, así
que el defecto queda visible. Cuando se corrija, vitest avisa y se quita el `.fails`. Producción NO se modificó.

1. **Paridad JS↔SQL en medio centavo (LATENTE, emisión).** `comercialDinero.precioConDescuento` (lo usa la Edge
   `cotizar-servidor`) redondea el DESCUENTO half-up a centavo y lo resta: 1000.10 al 5 % ⇒ **950.09**.
   `emitir_revision_v2` desplegado calcula `round(lista×(1−d),2)` ⇒ **950.10** y rechaza 950.09
   (`precioUnitario (950.09) != precio autoritativo (950.10)`, verificado en PGlite). Hoy no se dispara porque la UI
   aplica el descuento GLOBAL y las líneas canónicas viajan con `descuento` 0; aparece en cuanto una línea traiga
   descuento propio. Prueba: `emissionExactCentsSql.test.js › paridad JS↔SQL en medio centavo` (`it.fails`).
   Decisión pendiente (Dirección/Ingeniería): qué regla de redondeo manda y alinear el otro lado.
2. **La sombra cliente↔servidor NO conserva centavos en la fila (diagnóstico).** La guarda vieja afirmaba que sí
   (miraba `dinero(precio)` en el componente). En realidad `filaSombra` (VH-073) hace `Math.round` al peso de
   `precio_cliente`/`costo_cliente` mientras `precio_servidor`/`costo_servidor` van crudos: con paridad EXACTA al
   centavo la fila registra `diff ≠ 0` (12345.6 vs 12345.6 ⇒ diff 0.4). No es dinero de registro, pero ensucia la
   medición de paridad. Prueba: `moneyBoundaries.test.js › shadow: la FILA…` (`it.fails`). Al corregirlo hay que
   ajustar también `sombraCosteo.test.js` (hoy fija 12346/7000 a propósito).

Ambos `it.fails` se verificaron corriéndolos como `it` normal: fallan exactamente por el motivo documentado.

### Riesgo observado sin prueba nueva (no se cambió comportamiento)

- `partidaAutoritativaDeCosteo`: si cliente **y** servidor reportan costo **0** con estado `certificado`, se acepta
  una partida con `costoUnitario: 0` (0 = 0 al centavo). No es UNKNOWN→ZERO (ambos dicen 0), y el servidor debería
  marcar `incompleto` un costo 0, pero el cliente no lo bloquea por sí mismo. Se reporta; no se codificó como
  expectativa.

## Lo que quedó como `// STATIC GUARD:` y por qué

| Dónde | Por qué no se ejecuta |
|---|---|
| Un caso "cableado" en `authoritativeCostGate`, `lineItemCostFailClosed`, `liveQuoteEmissionGate`, `moneyBoundaries`, `voniLiveCosting`, `designCommercialBoundary`, `renderStoragePolicy`, `recostDeltaTrust`, `cocrearEngineeringValidation`, `pdfMoneyTrust`, `quoteEmissionAuthority` (UI) | `App.jsx`, `Cotizacion.jsx`, `Costeador.jsx`, `CocrearV3.jsx`, `AsistenteEspecial.jsx`, `FichaPDF.jsx` no se pueden montar en este entorno (vitest en node, sin jsdom/testing-library; App depende de sesión Supabase). La LÓGICA ya se prueba por comportamiento; el static guard sólo verifica que el componente siga delegando en la función probada (y no reintroduzca una copia local). |
| `quoteEmissionAuthority › cableado Edge` | `supabase/functions/cotizar-servidor/index.ts` es Deno (`jsr:` imports, `Deno.serve`). Su aritmética se prueba ejecutando las mismas funciones de `src/motor/comercialDinero.js` que importa por ruta relativa. |
| `pdfMoneyTrust › Cotización no conserva cálculo muerto` | Es la AUSENCIA de un cálculo eliminado; no hay comportamiento que ejecutar. |
| `cocrearEngineeringValidation › la UI ofrece un camino real` | Texto de botón/estado en JSX. |
| `src/datos/edgeSpatialHardening.test.js` (6 casos, archivo completo) | Handlers Edge Deno (`acomodar-espacio`, `leer-plano`, `leer-plano-core`): `jsr:` imports, `Deno.serve`, llamadas a Gemini/Supabase; no hay Deno en el entorno. Su lógica pura sí tiene pruebas de comportamiento en `supabase/functions/acomodar-espacio/*.test.js`. **Pendiente:** arnés `deno test` con `createClient`/`fetch` simulados para UNAUTHENTICATED/FORBIDDEN/RATE_LIMITED y el spoof de `spatial_spec`. |

## Conteo de casos string-assert (antes / después)

Medido con `node scripts/contarStaticGuards.mjs` (heurística documentada en el script: un caso `it/test` cuenta si
hace `expect` sobre una variable cargada con `readFileSync`/`read`/`leer` o un `slice` de ella; los que leen SQL para
EJECUTARLO en PGlite no cuentan). Misma regla antes y después; es aproximada, sirve para comparar.

| | Archivos | Casos string-assert | `expect` sobre texto |
|---|---|---|---|
| Antes (`HEAD` e549839) | 52 | 137 | 420 |
| Después | 50 | 118 | 366 |

En los 13 archivos convertidos (sin contar `edgeSpatialHardening`, que no cambió, ni `pioneerAiProductRender`, del
que sólo se tocó un caso): **33 → 14** casos string-assert, y los 14 restantes son *cableado*/texto de UI/ausencia,
todos marcados `// STATIC GUARD:` con su motivo. Casos de prueba en esos archivos: **33 → 75**.

## Suite completa

| Entorno | Antes (`HEAD`) | Después |
|---|---|---|
| `npx vitest run --exclude '.claude/**' --exclude 'node_modules/**'` | 332 archivos · 3007 pruebas ✓ | 332 archivos · 3049 pruebas ✓ |
| `VERCEL_ENV=preview CARRIL_RC=si npx vitest run …` | 332 archivos · 3007 pruebas ✓ | 332 archivos · 3049 pruebas ✓ |
| `npx vite build` | ✓ sin advertencias | ✓ sin advertencias |

Las 3049 incluyen los 2 `it.fails` nuevos (defectos visibles de arriba), que vitest cuenta como "passed" porque
fallan como se espera.

## Pendientes

- `edgeSpatialHardening`: arnés Deno (ver arriba).
- Montar componentes (jsdom + testing-library) para convertir los casos de *cableado* en pruebas de interacción;
  hoy se descartó para no añadir dependencias en esta tarea.
- Decidir la regla de redondeo JS↔SQL (hallazgo 1) y la precisión de la fila sombra (hallazgo 2).
- Resto del inventario de static guards fuera de esta lista (p. ej. `acomodar-espacio-recovery/recoverySource`,
  `cocrearVisualSync`, `layoutPublicationGate`, `voniTrustSurface`): no se tocaron.
