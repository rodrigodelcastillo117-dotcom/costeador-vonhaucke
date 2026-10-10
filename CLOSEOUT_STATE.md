# VON HAUCKE — FINAL PRODUCT COMPLETION · CLOSEOUT STATE

> Estado VIVO y VERÍDICO para continuar entre sesiones y para auditoría de ChatGPT.
> Regla: este archivo refleja SIEMPRE el HEAD real, los tests reales y qué quedó REALMENTE
> cableado vs pendiente. Cero información histórica presentada como estado actual.
> Última actualización: 2026-10-10 (OPERACIÓN RESCATE · Cotizar, bloques 1-2).

## OPERACIÓN RESCATE · COTIZAR (2026-10-10) — bloques 1-2 de 10
- **CÓDIGO = `5c0d500`** (sobre `1efe78c`; el HEAD de la rama es el doc-commit encima). **vitest 2201/2201 (260 archivos; +1 `cotizarRescate.test.js`, +3 RESCATE en `programaRealDelPlano.test.js`) · vite build ✅ · `deno check` ⚠️ entorno (tipos npm:openai vía jsr edge-runtime.d.ts; no es la función).**
- Matriz viva de los 42 defectos + tabla de los 4 "No pude costear": **`COT_RESCATE_MATRIZ.md`**. Ningún `PASS CERTIFICADO` (sin E2E autenticado ejecutado por Claude). Prod `5a38d2e` intacto.
- **RETRACTADO `1efe78c`**: `incompletos` vuelve a bloquear el apply (fail-closed); preview separado del commit (`previewAplicacionPrograma`).
- Cambios: identidad Producto Maestro sobrevive (`partidasDeItemsIA` + todos los roles), pendiente `NO_CANONICO` cubierto por partida de línea con identidad exacta, requerimientos sin costear = partidas PENDIENTES (precio null ≠ $0), costo BANCO = desconocido, `precioProvisional` en extrapolación, `resolverRutaProducto` con motivo, "Por agregar" legible, edge `cotizar-texto` sincronizada con v10 desplegada.
- **E2E autenticado (Rodrigo, 2026-10-10): torreSur ✅ + programaP01 ✅ (2/2).** Evidencia `e2e/evidence/torre-sur-cotizar-texto.json` → **COT-P0-009 causa DEMOSTRADA**: la edge v10 devuelve `ruta:"applt/banca_doble"` (clave+id fusionados) + nombre en `producto`. Fix `resolverRutaProducto` (RED 5 tests en 5c0d500 → GREEN); vitest **2206/2206**; edge v11 candidata en repo **NO desplegada**. **Re-corrida 13:18Z con `605c3c4`: torreSur ✅, 0 warns, anclas costeadas con identidad → COT-P0-009 PASS CERTIFICADO (alcance Cotizar).** Certificados también 004, 007 (gate+preview), 008, 029 en su alcance. **Bloque 3 (13:22Z): COT-P0-003 causa DEMOSTRADA** — el lector contó 8 pero `aMM/aMetros` tiraban `puestos` → el formulario estimó 10 por geometría. Fix en floorPlan.js (conserva `puestos`/`confianza`), RED→GREEN `fronteraLectorFormulario.test.js`. Sala 4 vs 8 asientos dibujados = límite del lector (observed_program vacío, `puestos=0` en juntas) → REVIEW_REQUIRED en edge, no se inventa. Pendiente: Rodrigo re-corre torreSur (assert 3-bis: texto "8 lugares…").

## CIERRE FINAL / RC INTEGRADO (2026-10-09)
- **HEAD(tip) = `bb23454` · CÓDIGO = `ec0a774`** (branch `audit/final-product-completion`). Integra `release/current-20261009` (Home premium + Recharts v3 + deps) + R10 docs + fix seguridad DOMPurify 3.4.16 (ChatGPT). **2182/2182 tests + vite build ✅ + runtime npm audit 0 vulnerabilidades.** Auditado por ChatGPT (`CHATGPT_AUDIT_FINAL.md`): GO RC-para-probar, NO-GO producción final.
- **Preview Vercel READY**: `https://costeador-vonhaucke-p8gqeurml-rodrigos-eurotrip.vercel.app` (dpl `dpl_4kEu62x2ck9cobnUPfz4hxzpZ2ig`), 0 errores de consola, Home premium confirmado.
- **Production NO desplegado** (promoción bloqueada por el harness; la hace Rodrigo). Rollback: `dpl_1m4bDohVjcqL86fcGHRhJTnw2rJc` / `5a38d2e`.
- Verdad completa + matriz + OPEN ITEMS en **`FINAL_AUDIT_PACKET.md`**; evidencia en `TEST_EVIDENCE.md`; siguiente acción de auditoría en `CHATGPT_NEXT_ACTION.md`.
- Regla de precio CONFIRMADA: mobiliario→Precio Lista, sillería→Precio Mínimo, sofás/lounge→Lista. Cutover real = DATA_TRUTH_REQUIRED (shadow iniciado, no en prod).

## ESTADO ACTUAL (verificado contra el repo)
- Rama: `audit/final-product-completion`. **Último commit de CÓDIGO = `260573a`** (lógica; RC integra +4 commits UI de release). El HEAD de la rama es el
  doc-commit de este CLOSEOUT encima (un commit no puede contener su propio SHA). Tip exacto: `git rev-parse HEAD`.
- **Tests: 2182 / 2182** (vitest, 259 archivos; +3 R15-N + persistencia de confirmado_modelo) · **Build: ✅** (vite) · **deno check ✅** (leer-plano + core; sin cambios este round) · verificado en esta sesión (2026-10-09).
- **Evidencia = LOCAL de Claude. GitHub NO tiene CI runs (0 workflows).** Golden QA-COT-01 = MOCK_ONLY /
  RECORDED CONTRACT (no es E2E del PDF vivo). Lectura de PDF en vivo + edges = BLOCKED_EXTERNAL (no desplegado).
- **MANDATO RC (deadline lunes 12-oct)**: autónomo hasta Release Candidate. Autorización NUEVA de Rodrigo:
  cutover del motor SÓLO para productos NUEVOS (shadow primero), agregar parser XLSX justificado, preparar edges.
  Siguen prohibidos (se preparan/documentan como BLOCKED_EXTERNAL, no se ejecutan): merge, deploy/promote,
  migración prod, escrituras masivas prod, modificar 33 legacy, aprobar DATA TRUTH, integrar Intelisis.
- **R15 = 🟢 ACCEPTED/GREEN EN CÓDIGO** (ChatGPT+Grok, 6 re-auditorías; sin cambios salvo regresión demostrable).
  **R10 RE-AUDITADA contra HEAD `260573a` (2026-10-09): 15/15 invariantes siguen enforced, 0 regresiones** (R11–R15
  no debilitaron ninguna; varias se CONSOLIDARON en `resolverAplicacionAtomica`, más estricto). Detalle con evidencia
  en "Re-auditoría R10" abajo. Persisten las MISMAS limitaciones live ya declaradas (no son regresiones): catálogo sin
  dims QA-COT-01 ⇒ casi toda ancla NEEDS_CONFIRMATION en vivo; R10-14 PAGINA_FUERA_DE_RANGO sólo a nivel validador
  (el core no emite conteo de páginas) = NOT_VERIFIED live; golden = MOCK_ONLY; edge NO desplegado; GitHub 0 CI runs.
  Por eso NO se declara "P0 abiertos: 0" en vivo: la evidencia es LOCAL y el PDF/edge reales siguen BLOCKED_EXTERNAL.
  ChatGPT r7:10·r8:7·r9:10·r10:14·r11:5·r12:5·r13:5·r14:6. **r15 (ChatGPT+Grok): 6 puntos — cerrados en código ahora**
  (ver ronda 15): existente con cantidad SOBRANTE se consumía sin aviso (ahora EXISTING_SURPLUS→revisión); una fila
  agrupada perdía provenance de las instancias que no eran la primera (ahora plan_instances[]); `grouping` solo como
  stableKey colisionaba (ahora source_ref→plan_tag→grouping+zone+posición); la sillería no gateaba la propuesta final
  ni tenía acción real (ahora programaCompleto gatea + "Usar sillería sugerida" la vuelve partida real); counts de
  Acomodo usaban renglones en vez de unidades; y Acomodo persistía sugerencias de áreas como 2ª realidad. **r14 (abajo): 6 puntos.**
  (ver ronda 14): la cardinalidad fallaba con renglón existente cantidad>1 (consumía 1, sobre-agregaba); los IDs
  dependían del índice del array (reordenar intercambiaba provenance); el contador "ya cubiertas/por agregar" de
  Acomodo leía mal el resumen; las sillas se mostraban pero sin gate (MODEL_MISMATCH no bloqueaba, programa "completo"
  sin confirmar modelo); provenance perdía evidence/posición/orientación; Acomodo mantenía dos realidades (áreas +
  observed). Ahora: pool por cantidad, identidad estable por plan_source_ref, counts correctos, MODEL_MISMATCH gate +
  requiereConfirmacionSillas/programaCompleto, provenance completa, y una sola realidad. **r13 (ver abajo): 5 P0 + P1.** confirmarPrograma reutilizaba la MISMA existente para varias instancias (mismo
  requirement_id) → ahora match por INSTANCIA y consume-once (4 obs + 2 existentes → reutiliza 2, agrega 2);
  Acomodo ocultaba la propuesta observada con `!hayReales`; recomendaciones/sillas no se mostraban; source_ref
  se usaba como modelo; la provenance no se parcheaba a los reutilizados. **r12 (ver abajo): 5 P0 + 3 P1.** "misma dimensión" no era "misma identidad" (elegía matches[0] entre melamina/comedor/
  cristal 900×900); no comparaba capacidad observada vs producto (bench 1500×1200 cap 8 → op-2u); las sillas
  recibían SKU default como partida confirmada; Acomodo abandonaba observed si ya había partidas; se perdía la
  provenance del plano (B-01) al resolver. Ahora: ambigüedad→PRODUCT_AMBIGUOUS, capacidad→CAPACITY_MISMATCH,
  sillas=RECOMENDACIÓN SUGGESTED, Acomodo unificado también con partidas, y dos identidades plan vs producto.
  **r11 (ver abajo): 5 P0 + P1.** la resolución seguía siendo por capacidad agregada (4 benches 1500×1200 → 1 op-8u) con
  reconciliación post-hoc; PRESENT_REVIEW_REQUIRED y NEEDS_CONFIRMATION no bloqueaban Aplicar de verdad; Acomodo
  reconstruía desde áreas ignorando observed_program; leerPlanoArchivo daba PRESENT_VALID con validación null.
  Ahora: IDENTITY-FIRST (cada ancla física → producto canónico por dimensiones, cardinalidad 1:1), gate de dominio
  central en App.aplicarProgramaDetectado, Acomodo unificado con Voni, y fail-closed en leerPlanoArchivo.
  ChatGPT r10 (histórico): 14 P0/P1 — cerrados (ver ronda 10): el cliente perdía issues del servidor;
  PRESENT_REVIEW_REQUIRED no era gate; NEEDS_CONFIRMATION era sólo visual (el botón aplicaba el producto malo);
  kind=room podía volverse mueble; se inventaba capacidad (muebles→puestos); faltaba coherencia de capacidad;
  la identidad física no llegaba al resolver (se resolvía por capacidad y se detectaba después); reconciliación
  no 1:1; dependientes observados (CR-01) desaparecían; golden con dims equivocadas; confianza 0.4 gobernaba;
  dedup débil; regex de ontología demasiado ancho; maxPage sin cablear en el wrapper.
  **Falta (NO ejecutable aquí / pendiente de re-auditoría):** re-auditoría R10, E2E autenticado real, deploy del
  edge + lectura viva del PDF, VOCABULARIO de mobiliario del lector + productos canónicos que equivalgan a dims
  reales, y los parámetros de conversión por familia (DATA TRUTH).
- **Cableado REAL hoy** (capa ADITIVA — NO cambia ningún número del motor; tests de dinero verdes):
  1. `Precios.jsx` (Dirección): columna "Procedencia" por insumo — chip por TIPO de fuente + tooltip "¿por qué $544?".
  2. `HojaCosto.jsx` (Costear/veCostos): label EXACTO del código = "✓ Precios de MP con evidencia real · N
     material(es) — (consumo/MO/GI sin verificar)" (NO dice "costo con evidencia real": el consumo/MO/GI no se verifican).
  Ambas usan UN adapter canónico `resolverPrecioInsumoVivo` (un precio capturado a mano NO hereda evidencia vieja).
  3. `floorPlanReader.js`: cable PURO lector real (`programaDelPlano`) → `observed_program` (test con lector real).
  4. **observed_program GOBIERNA el programa (ronda 8→11)**: `Voni.jsx` Y `Acomodo.jsx` usan la MISMA función
     `proponerProgramaDesdeObservado` cuando el lector dio mobiliario (observed_state PRESENT_*), con AUTORIDAD del
     observed SANEADO por el servidor (no el crudo de la IA); sólo cae a la heurística de áreas si ABSENT.
     **IDENTITY-FIRST (ronda 11)**: cada ancla física resuelve su producto canónico por DIMENSIONES (1:1), sin
     colapsar a capacidad (4× bench 1500×1200 → 4× op-2u, nunca 1× op-8u). Ontología ANCLA/DEPENDIENTE/AMENIDAD:
     las sillas NO crean anclas. GATE CENTRAL en `App.aplicarProgramaDetectado` (`propuestaBloqueada`): ninguna
     propuesta REVIEW_REQUIRED/NEEDS_CONFIRMATION se aplica aunque un caller se equivoque. Pendientes observados +
     anclas por confirmar se MUESTRAN en VONI/Acomodo. PROPUESTA ≠ CONFIRMACIÓN.
  5. **Conversión por FAMILIA (ronda 9)**: `conversionMaterial.js` + BOM — lámina kg = m²×kg/m² (multiplica),
     tablero hoja ← m² (÷), perfil tramo ← m (÷), herraje juego ← pz (÷); falta de parámetro → NO costable.
     (El BOM NO está conectado al motor todavía.)
- **NO cableado / preparado-no-desplegado** (bloques grandes, requieren decisión/deploy — ver "SIGUIENTE"):
  - El MOTOR (`calcular()`) sigue tomando `insumo.precio`; el `CanonicalPriceResolver` aún NO gobierna el número.
  - **Validador edge del observed_program (`observed-core.js`) PREPARADO + cableado en el wrapper `leer-plano`,
    deno check ✓, 16 tests — pero NO DESPLEGADO** (prod edge = hard boundary). El lector en vivo aún no emite
    observed_program (core v4); cuando se despliegue, el golden QA-COT-01 valida la salida real sin cambios.
  - El lector de PDF en vivo (edge `leer-plano`) → UI de confirmación (requiere deploy).
  - Ingestión documental de los `.xlsx` reales (requiere dep de parser + aprobar mapeo = DATA TRUTH).
  - VOCABULARIO de mobiliario del lector (siguiente P0): sin él, `programRequirementsDesdeObservado` sólo mapea
    operativo/privado/junta/recepción; credenza/coffee/etc. caen en `ROLE_NO_MAPEADO` (revisión, no inventado).

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

### Re-auditoría R10 contra HEAD `260573a` (2026-10-09) — 15/15 enforced, 0 regresiones
Verificado uno por uno en el CÓDIGO del HEAD actual (no se asumió que los fixes de `b3da1ba` siguieran vigentes) +
corrida de los test files de la época (`observedPipelineIntegracion` 54, `observed-core` 24, `mobiliarioOntologia` 9,
`observedProgram` 8, `planoGoldenObserved132` 20 → todos verdes). Evidencia por punto:
- **R10-1** unir issues del servidor — `programaRealDelPlano.js:250` `issuesFinal = union(serverIssues, norm.issues)`; item con cualquier issue o REVIEW del servidor → `pendientes` (no gobierna). ✅
- **R10-2** PRESENT_REVIEW_REQUIRED es gate — `requiereRevision` en `proponerProgramaDesdeObservado`; en Voni, `resolverAplicacionAtomica` devuelve committed=false bajo revisión → botón deshabilitado. ✅ (UI = CODE_PASS, no E2E)
- **R10-3** NEEDS_CONFIRMATION bloquea apply — `propuestaBloqueada` (`programaRealDelPlano.js:742`) rechaza `product_status==='NEEDS_CONFIRMATION'` / `identity_status==='MISSING'`. ✅
- **R10-4** kind=room nunca mueble — `observed-core.js` `room_derived`; validador fail-closed. ✅
- **R10-5** no inventar capacidad — bench sin capacity → `NEEDS_CAPACITY` (`programaRealDelPlano.js:315/320`). ✅
- **R10-6** coherencia de capacidad — `CAPACIDAD_INCONSISTENTE` (`observed-core.js:73`, test unit). ✅
- **R10-7** identidad por dims — `resolverAnclaCanonica`/`conciliarAnclasObservadas` vía `buscarEnColeccion` por geometría; sin dims en catálogo → NEEDS_CONFIRMATION. ✅ (limitación live: catálogo sin QA-COT-01)
- **R10-8** cardinalidad 1:1 — `q=quantity`; cada ancla física resuelve N instancias (tests 14 y 36). ✅
- **R10-9** dependientes no desaparecen — `conciliarDependientes` 4 estados; OBSERVED_ONLY/DIVERGE → `requiereRevision`. ✅
- **R10-10** golden dims exactas — `planoGoldenObserved132.test.js` (MOCK_ONLY/RECORDED). ✅ (contrato grabado)
- **R10-11** umbral de confianza — `UMBRAL_CONFIANZA_GOBERNAR=0.7` (`observedProgram.js:55`), aplicado en `programaRealDelPlano.js:265`. ✅
- **R10-12** dedup por source_ref — clave `source_ref/plan_tag` primero → `ITEM_DUPLICADO` (`observed-core.js:176/208`). ✅
- **R10-13** ontología palabra completa — regex `\b(?:…)\b` sobre texto normalizado (`mobiliarioOntologia.js:43`). ✅
- **R10-14** maxPage en wrapper — plumbing presente (`index.ts:270`) + validador `PAGINA_FUERA_DE_RANGO` (`observed-core.js:117`); el core NO emite conteo real de páginas → **NOT_VERIFIED live** (igual que en R10, no es regresión). 🟡
- **R10-15** docs sin falsos verdes — CLOSEOUT/HANDOFF mantienen limitaciones explícitas. ✅
Conclusión: R10 sigue GREEN en código; las únicas no-verdes (R10-14 live, dims de catálogo, golden grabado, edge no
desplegado, 0 CI) son limitaciones YA declaradas, no regresiones. NO se tocó código (no hubo regresión que corregir).
NO motor / NO XLSX / NO deploy.

### 6ª re-auditoría R15 — ChatGPT + Grok (sobre 985eef3) — 1 corrección de doc + 1 hueco de UX (código `260573a`)
La 6ª re-auditoría aceptó L/M (dominio) y confirmó K/H3/I2/I3/G/J sin regresión; corrigió una afirmación falsa y un hueco UX:
- **Corrección de doc (confirmado_modelo)** era FALSO decir "sin flag persistente de modelo confirmado entre sesiones".
  `confirmado_modelo` SÍ persiste dentro de `cotizacion.partidas`: lo conservan `partidaComercialDesdeConfirmado` y
  `estructuraDe`, NO lo elimina `compactarPayloadNube`, y la sanitización DB `jsonb_sin_economia()` tampoco (sólo quita
  costo/margen/proveedor); sobrevive save → Supabase → reopen (`App` reabre `full.partidas` sin remapear). Lo que NO existe
  es una confirmación DURABLE INDEPENDIENTE de la partida: si la silla se elimina/reemplaza, la decisión se pierde. Test de
  persistencia puro agregado (`paraGuardar` conserva `confirmado_modelo:true`). La cadena DB es contrato leído, NOT_VERIFIED en vivo.
- **P1-R15-N** VONI ya bloqueaba la propuesta por aplicación pendiente (L), pero el BOTÓN/TARJETA/MENSAJE de "Aplicar programa
  detectado" seguían decidiéndose por `faltantesPrograma` (sólo productos NUEVOS). En enrichment-only (nuevas=0, enriquecidos>0,
  committed=true) la propuesta quedaba bloqueada pero el botón salía deshabilitado, la tarjeta podía no aparecer y el mensaje
  decía "0 producto(s)". Ahora VONI deriva TODO de la misma autoridad atómica (`resolverAplicacionAtomica`): botón habilitado si
  `aplicacionPendientePrograma`, tarjeta visible con `enriquecidosPrograma>0`, mensaje que distingue nuevos vs existentes por
  vincular/actualizar. Voni y Acomodo consultan la MISMA fuente, sin lógica paralela.
Suite 2182/2182 (259 archivos, +3) · build ✅ · deno check ✅. NO motor / NO XLSX / NO deploy. PENDIENTE: re-auditoría.
Supuestos NO verificados LIVE: ningún render UI en E2E (sólo dominio + source-asserts); la cadena DB de guardado/reopen es
contrato leído (no corrido en vivo); `patchCambios` compara por valor JSON; selector "elegir otro producto" pendiente de UI;
confirmado_modelo persiste en la partida pero NO hay confirmación durable independiente de ella.

### 5ª re-auditoría R15 — ChatGPT + Grok (sobre 5ccd262) — 2 huecos del mismo contrato (código `0dcd6f2`)
La 5ª re-auditoría aceptó K/H3/I2/I3; encontró 2 huecos del MISMO contrato OBSERVED/PROPUESTA ≠ CONFIRMACIÓN, resueltos con UNA autoridad:
- **P0-R15-L** el gate ÚNICO de VONI `puedeEntrarPropuesta` NO exigía que no hubiera aplicación pendiente: con una recepción
  canónica nueva detectada pero aún no aplicada (hay=true, sin revisión/sillería/conflicto) VONI podía saltar directo a la
  propuesta (stepper/"ir directo"/omitir/onIr). Ahora exige `!aplicacionPendientePrograma`, que consulta la MISMA autoridad
  que Acomodo (`programaTieneAplicacionPendiente` → `resolverAplicacionAtomica`). Mensaje de bloqueo explícito.
- **P0-R15-M** "pendiente de aplicar" sólo miraba `confirmadas` (productos nuevos). Un existente legacy/manual correcto sin
  `instance_id`/`functional_group_id`/`plan_source_ref`/`zone_id`/`confirmado_modelo` se reconcilia con `confirmadas=0` pero
  `enriquecidos>0` (write real). Ahora `bloqueosProgramaObservado` deriva de `resolverAplicacionAtomica`: `committed===true`
  ⇒ `PROGRAMA_PENDIENTE_APLICAR` (distingue `nuevas` vs `enriquecidos`). UNA sola definición de "aplicado", compartida por
  Voni y Acomodo (`programaTieneAplicacionPendiente`), sin lógica paralela.
Suite 2179/2179 (259 archivos, +4) · build ✅ · deno check ✅. NO motor / NO XLSX / NO deploy. PENDIENTE: re-auditoría.
Supuestos NO verificados LIVE: ningún render UI en E2E (sólo dominio + source-asserts del gate de Voni); `patchCambios`
compara por valor JSON (datos planos); selector "elegir otro producto" pendiente de UI; confirmado_modelo SÍ persiste en la partida y sobrevive save/reopen; NO hay confirmación durable independiente de la partida (si la silla se elimina o reemplaza, la decisión se pierde).

### 4ª re-auditoría R15 — ChatGPT + Grok (sobre d244c24) — 1 P0 nuevo + 3 parciales (código `cc15e92`)
La 4ª re-auditoría aceptó G/J y el gate fail-closed; encontró 1 P0 nuevo (K) y reabrió H/I como parciales. Corregido:
- **P0-R15-K** `bloqueosProgramaObservado` sólo miraba requiereRevision/sillería/conflictos pero NO que `aplicarPrograma`
  todavía tuviera mobiliario nuevo por agregar (`recon.confirmacion.confirmadas>0`). Un plano podía detectar un producto
  canónico real (p.ej. recepción) aún NO en la cotización y Acomodo lo consideraba `programaListo=true`. Ahora agrega el
  blocker `PROGRAMA_PENDIENTE_APLICAR` mientras `confirmadas>0` ⇒ no publicable hasta aplicar (OBSERVED detectado ≠
  confirmado; Proposal ≠ Confirmation). Tras aplicar → confirmadas=0 → publicable. Caso K before/after.
- **P1-R15-H3** `confirmado_modelo` se perdía al REUTILIZAR una silla existente: `estructuraDe(part)` (patch de enriquecidos)
  no lo propagaba. Ahora lo incluye (sólo si true) → confirmar un modelo alterno sobre una silla ya cotizada persiste la
  bandera y `silleriaPendiente`=false end-to-end. H1/H2 cubrían sólo la silla NUEVA; H3 cubre la ruta de reutilización.
- **P1-R15-I2** la "idempotencia" aún committeaba patches idénticos: `confirmarPrograma` re-emitía `enriquecidos` para
  anclas reutilizadas aunque el patch fuera igual a lo persistido (nuevas=0, enriquecidos>0 → committed=true). Ahora
  `patchCambios` incluye sólo las keys que cambian de verdad; si no cambia nada, no hay enriquecidos → `committed=false`/
  `IDEMPOTENTE` (sin rerender/autosave inútil). El test I1 ahora asserta `r2.committed===false`.
- **P1-R15-I3** el return de `App.aplicarProgramaDetectado` capturaba el resultado del updater y lo devolvía, pero React no
  garantiza que el updater corra antes del return (contrato no cumplible síncronamente). Ahora el handler es un COMMAND:
  no captura ni devuelve el commit; la AUTORIDAD es el estado actualizado (write fail-closed contra `prev`). Sin flushSync.
  HANDOFF/CLOSEOUT ya NO afirman que el return síncrono refleje el commit.
Suite 2175/2175 (259 archivos, +4) · build ✅ · deno check ✅. NO motor / NO XLSX / NO deploy. PENDIENTE: re-auditoría.
Supuestos NO verificados LIVE: ningún render UI en E2E (sólo dominio + source-asserts); el handler de aplicación ya no
promete resultado síncrono (un caller futuro debe usar callback/efecto posterior); `patchCambios` compara por valor (JSON)
y asume datos planos; selector "elegir otro producto" pendiente de UI; confirmado_modelo SÍ persiste en cotizacion.partidas y sobrevive save/reopen (compactarPayloadNube y jsonb_sin_economia no lo eliminan); lo que NO existe es una confirmación durable independiente de la partida (si la silla se elimina o reemplaza, la decisión se pierde).

### 3ª re-auditoría R15 — ChatGPT + Grok (sobre da454fe) — 5 hallazgos corregidos (código `08e6aad`)
La 3ª re-auditoría aceptó D2/C2/B2/E2/A-UX y reabrió F (P0) + G/H/I/J (P1). Corregido:
- **P0-R15-F** Acomodo podía PUBLICAR un programa comercial incompleto: `AcomodoBase.programaListo` sólo miraba
  `bloqueosPrograma` = dependientes-sin-ancla. Nueva autoridad única `bloqueosProgramaObservado(propuestaPlano,{partidas})`
  combina `requiereRevision` + sillería pendiente REAL (reconciliada contra las partidas actuales) + conflictos de
  reconciliación. Acomodo concatena `coherenciaPrograma.bloqueos` + eso → `AcomodoBase.bloqueosPrograma` ⇒ con programa
  incompleto `programaListo=false` (Propuesta Viva / guardado final / PDF bloqueados; BORRADOR permitido). NOTA: NO se usa
  `programaCompleto` como red de seguridad porque se calcula sin conocer las partidas ya cotizadas (seguiría false aunque
  la sillería ya esté cubierta). Casos F1 (sillería pendiente), F2 (EXISTING_SURPLUS), F3 (publicable cuando cubierta).
- **P1-R15-G** el botón "Aplicar programa detectado" de Acomodo ahora se deshabilita también por `reconObs.conflictos`
  y muestra el motivo concreto (`CONFLICTO: <code>`), no sólo por `requiereRevision`.
- **P1-R15-H** `confirmado_modelo` SOBREVIVE `aItemConfirmado` y `partidaComercialDesdeConfirmado` (sólo cuando es true;
  nunca se inventa). Un modelo alterno confirmado deja `silleriaPendiente`=false end-to-end (H1); sin confirmar=true (H2).
- **P1-R15-I** el return de `App.aplicarProgramaDetectado` ya NO deriva del snapshot `vista`: WRITE y RETURN usan la misma
  autoridad `resolverAplicacionAtomica(propuesta,{existentes:prev})` (función pura nueva). Test REAL de carrera: 2ª
  aplicación contra el prev ya actualizado → 0 nuevas, no duplica (I1); conflicto → committed=false (I2); bloqueada → false (I3).
- **P1-R15-J** VONI muestra "✓ Sillería confirmada" cuando `!sillasPorConfirmar` (antes decía siempre "modelo por confirmar").
Suite 2171/2171 (259 archivos, +11) · build ✅ · deno check ✅. NO motor / NO XLSX / NO deploy. PENDIENTE: re-auditoría.
Supuestos NO verificados LIVE: ningún render UI en E2E (sólo dominio + source-asserts); el timing batcheado de React en
el return de `aplicarProgramaDetectado` (conservador: nunca reporta éxito fantasma) no está en E2E; ningún caller usa ese
return como autoridad; selector "elegir otro producto" pendiente de UI; confirmado_modelo SÍ persiste en cotizacion.partidas y sobrevive save/reopen (compactarPayloadNube y jsonb_sin_economia no lo eliminan); lo que NO existe es una confirmación durable independiente de la partida (si la silla se elimina o reemplaza, la decisión se pierde).

### 2ª re-auditoría R15 — ChatGPT + Grok (sobre fd6b6c5) — 5 hallazgos corregidos (código `eb2ebfd`)
La 2ª re-auditoría aceptó R15-2/3/5 y R15-A (lógica), y reabrió D/C/B/E + un P1 UX. Corregido:
- **R15-D2** el "borrado" de la 2ª realidad NO borraba bajo el MERGE del padre (App.guardarAcomodo hace spread).
  Ahora Acomodo SOBREESCRIBE con estado NEUTRAL (sugeridosPartidas:[], demoAutopoblado:false, programaPropuesto:false).
- **R15-C2** las sillas HEREDAN la topología canónica del ancla (anchor_role=ANCHOR_*, functional_group_id del ancla),
  no un grupo inventado; la recomendación transporta `anchor_functional_group_id` + `anchor_role`.
- **R15-B2** `silleriaPendiente` reconcilia por (rol, ANCLA, modelo, cantidad): sillas ligadas al ancla equivocada o de
  modelo distinto sin confirmar NO cubren el requerimiento.
- **R15-E2** el gate de conflictos vive en el PUNTO ATÓMICO: dentro de `setEstado(prev)` se revalida contra prev y con
  conflictos devuelve el mismo prev (0 writes).
- **R15-A-UX** el botón "ir directo a la propuesta" usa `disabled={!puedeEntrarPropuesta}` (mismo gate del handler); fin del botón "muerto".
Suite 2160/2160 (259 archivos) · build ✅ · deno check ✅. PENDIENTE: re-auditoría de estos fixes.

### Re-auditoría R15 — ChatGPT + Grok (sobre b651932) — 5 falsos verdes corregidos (código `fd6b6c5`)
La re-auditoría aceptó R15-2/R15-3/R15-5 (PASS) y reabrió R15-1 (parcial), R15-4 y R15-6. Corregido:
- **R15-A** GATE ÚNICO a la propuesta (`puedeEntrarPropuesta`): el STEPPER ya no brinca a paso 4 con sillería
  pendiente; TODAS las rutas (stepper, botones, omitir, candado, onIr) pasan por el mismo predicado.
- **R15-B** "¿hay alguna silla?" era demasiado débil: `silleriaPendiente` reconcilia por rol + CANTIDAD (8+10 vs 1 → pendiente).
- **R15-C** `propuestaSilleriaSugerida` liga el asiento al ANCLA (`anchor_instance_id`, req_id por ancla): bench
  quantity=4 → 8 sillas con instance_id únicos, 2 por ancla, sin cross-link ni IDs duplicados.
- **R15-D** una sola realidad fail-closed en PERSISTENCIA: con observed server, Acomodo `setSugeridas([])` y ELIMINA
  `sugeridosPartidas`/`demoAutopoblado`/`programaPropuesto` del estado guardado (todas las rutas).
- **R15-E** conflicto de reconciliación (EXISTING_SURPLUS/SLOT_OCUPADO/SPLIT_REQUIRED) es GATE: botón Aplicar
  deshabilitado + `App.aplicarProgramaDetectado` REHÚSA el write (0 escrituras) cuando la reconciliación los produce.
Suite 2156/2156 (259 archivos) · build ✅ · deno check ✅. Ahora sí R15-1/4/6 cerrados. PENDIENTE: re-auditoría de estos fixes.

### Ronda 15 — ChatGPT + Grok (sobre 0fad6cb) — 6 puntos cerrados (código `b651932`)
Cierre de reconciliación física (pre-motor):
- **R15-1 EXISTING_SURPLUS**: existente cantidad=4 + observed=2 → reutiliza 2, 0 nuevas, conflicto EXISTING_SURPLUS de 2
  (ok=false, revisión; NO borra, NO silencio). observed=0 + existente observado → review.
- **R15-2 provenance agrupada**: una fila cantidad=N que absorbe B-01+B-02 conserva AMBAS en `plan_instances[]` (item + patch).
- **R15-3 stable key sin colisiones**: `requirementId`/`instanceId` priorizan source_ref → plan_tag → grouping+zone+posición
  → zone+posición → posición → índice. Dos benches misma zone+grouping, posiciones distintas → IDs DIFERENTES.
- **R15-4 sillería resolvible + gate**: MODEL_MISMATCH y `requiereConfirmacionSillas` ⇒ `programaCompleto=false`; Voni
  bloquea "ir directo a la propuesta"/"omitir acomodo" mientras falte confirmar. Acción REAL `propuestaSilleriaSugerida`
  ("Usar sillería sugerida") convierte el requerimiento en partidas de silla REALES (persiste). *Pendiente UI*: selector
  "elegir otro producto"/"requiere desarrollo" (el contrato ya lo soporta).
- **R15-5 counts Acomodo** usan `reutilizadasUnidades` (físicas): observed4 + existente cantidad2 → cubiertas 2 / por agregar 2.
- **R15-6 una sola realidad en ESTADO**: con observed server, Acomodo NO genera/persiste partidasSugeridasDeAreas/
  sugeridosPartidas; heurística por áreas sólo en `observed_state=ABSENT`.
Suite 2154/2154 (259 archivos) · build ✅ · deno check ✅. PENDIENTE: re-auditoría R15.

### Ronda 14 — ChatGPT + Grok (sobre ce03973) — 6 puntos cerrados (código `0fad6cb`)
Cardinalidad estable + confirmación de dependientes + provenance completa (pre-motor):
- **R14-1 cantidad>1**: `confirmarPrograma` usa POOL por renglón (rem=cantidad); un existente cantidad=N absorbe N
  instancias sin sobre-agregar. `resumen.reutilizadasUnidades` (físicas). Adversariales: obs 2 + existente(2) → reutiliza 2,
  agrega 0; obs 4 + existente(2) → agrega exactamente 2.
- **R14-2 identidad estable**: `requirementId`/`instanceId` del observed derivan de plan_source_ref/grouping (no del índice);
  el match prioriza plan_source_ref → instance_id → zone+grouping → banco+rol (+conflicto por slot legacy). Reordenar el
  observed NO intercambia provenance (B-01↔A/B-02↔B).
- **R14-3 (incluye fix count R13-2)**: Acomodo lee `reconObs.confirmacion.resumen` (cubiertas/por agregar reales).
  MODEL_MISMATCH es GATE (`requiereRevision`); sillería sin modelo → `requiereConfirmacionSillas`+`programaCompleto=false`
  (el ancla se aplica, el programa NO se presenta completo). Voni/Acomodo muestran la sillería "modelo por confirmar".
  *Pendiente UI*: el selector interactivo (usar sugerido / elegir otro) — el contrato de datos ya lo soporta.
- **R14-4 provenance completa**: evidence + observed_position + observed_orientation también en
  `partidaComercialDesdeConfirmado` y `estructuraDe` (patch de reutilizados); observed-core preserva `observed_model`.
- **R14-6 una sola realidad**: Acomodo suprime las sugerencias heurísticas por áreas cuando `observadoPresente` (sólo ABSENT).
Suite 2148/2148 (259 archivos) · build ✅ · deno check ✅. PENDIENTE: re-auditoría R14.

### Ronda 13 — ChatGPT + Grok (sobre 9166921) — 5 P0 + P1 cerrados (código `ce03973`)
Cierre de reconciliación PARCIAL + dependientes + provenance en reutilizados (pre-motor):
- **R13-1 CARDINALIDAD REAL** (`confirmarPrograma`): match por INSTANCIA — `instance_id` exacto → slot físico →
  `requirement_id` sólo si es inequívoco; cada existente se consume UNA vez (`usados`). Adversarial: observed B-01
  qty=4 + existentes {#0,#1} → reutiliza 2, agrega 2, total 4 (nunca 0/6/7/8), cada instance_id única.
- **R13-2 ACOMODO con existentes**: se renderiza la reconciliación también con partidas reales (ya cubiertas / por
  agregar / conflictos); se quitó el bypass de UI `!hayReales && preview`. Sólo ABSENT → sugerencias por áreas.
- **R13-3 RECOMENDACIONES no desaparecen**: Voni y Acomodo consumen `fisico.recomendaciones` (cantidad + "modelo por
  confirmar"); NO se auto-convierten a silla-win/concerto ni se esconden.
- **R13-4 `source_ref` ≠ modelo**: `conciliarDependientes` usa `observed_model`/`observed_product` explícito (no S-01);
  sin modelo → `observado_modelo=null`, `requiere_confirmacion_modelo=true`.
- **R13-5 PROVENANCE en REUTILIZADOS**: `estructuraDe` (patch) + `aItemConfirmado` conservan plan_source_ref/
  product_source_ref/plan_tag/grouping/observed_position/observed_orientation.
- **P1**: `resolverAnclaCanonica` lee model/finish del observado de forma defensiva; el schema del lector aún no lo
  emite → documentado como pendiente/fail-closed.
Suite 2142/2142 (259 archivos) · build ✅ · deno check ✅. PENDIENTE: re-auditoría R13.

### Ronda 12 — ChatGPT + Grok (sobre b94800d) — 5 P0 + 3 P1 cerrados (código `9166921`)
"R11 arregló 4×2U→1×8U; ahora que 'producto físicamente compatible' no se vuelva 'SKU arbitrario'." Cerrado (pre-motor):
- **R12-1 AMBIGÜEDAD = REVIEW**: `resolverAnclaCanonica` — ≥2 productos con la misma geometría y evidencia que no
  discrimina → `PRODUCT_AMBIGUOUS` (mesa 900×900 melamina/comedor/cristal NO elige matches[0]).
- **R12-2 CAPACIDAD coincide**: cruza rol+dims+CAPACIDAD (`prod.usuarios === capacity_per_unit`); 1 bench 1500×1200
  cap 8 → `CAPACITY_MISMATCH` (no op-2u). Sin dims en catálogo → NEEDS_CONFIRMATION (no mismatch).
- **R12-3 DEPENDIENTE ≠ SKU default**: las sillas son RECOMENDACIONES (`product_status: SUGGESTED`,
  `requiere_confirmacion_modelo`), NUNCA partidas confirmadas; `conciliarDependientes` compara modelo cuando existe.
- **R12-4 ACOMODO autoridad única**: se eliminó el bypass `hayReales ? null`; con observed server gobierna también
  si ya hay partidas (reconcilia vía confirmarPrograma). Sólo ABSENT → heurística por áreas.
- **R12-5 PROVENANCE end-to-end**: `plan_source_ref` (B-01) ≠ `product_source_ref` (op-2u…) + plan_tag/grouping/
  posición/orientación; sobreviven `resolverFisicoDesdeObservado → confirmarPrograma → partidaComercialDesdeConfirmado`.
- **P1**: sin fallback cross-línea con línea explícita; `propuestaBloqueada` bloquea `identity_status: MISSING`; tests INTEGRATION_OFFLINE.
Nuevos tests adversariales (900×900 ambiguo, cap-mismatch, sillas SUGGESTED, provenance B-01) + `acomodoObservedAuthority`.
Suite 2138/2138 (259 archivos) · build ✅ · deno check ✅. PENDIENTE: re-auditoría R12.

### Ronda 11 — ChatGPT + Grok (sobre b3da1ba) — 5 P0 + P1 cerrados (código `b94800d`)
"R10 bien, pero la resolución seguía siendo por capacidad y la reconciliación era post-hoc." Cerrado (pre-motor):
- **R11-1 IDENTITY-FIRST**: `resolverFisicoDesdeObservado` — cada ancla física observada genera su ProductResolution
  canónica por DIMENSIONES (`buscarEnColeccion`), SIN colapsar a {operativos,…} ni elegir por capacidad agregada.
  Adversarial probado: 4× bench 1500×1200 → **4× op-2u-1500x1200**, nunca 1× op-8u-4800x1200.
- **R11-2 CARDINALIDAD**: quantity=N produce N instancias físicas canónicas (1:1), no una conciliación con quantity=N.
- **R11-3 DEPENDIENTES SON GATE**: OBSERVED_ONLY/DIVERGE → `requiereRevision=true` (CR-01 observada sin producto bloquea Aplicar).
- **R11-4 AUTORIDAD ÚNICA**: `Acomodo.jsx` usa la MISMA función observada que Voni (si hay observed_program server,
  NO reconstruye desde áreas; sólo ABSENT → fallback). GATE CENTRAL en `App.aplicarProgramaDetectado` vía
  `propuestaBloqueada`: ninguna propuesta REVIEW_REQUIRED/NEEDS_CONFIRMATION se aplica aunque un caller se equivoque.
- **R11-5 FAIL-CLOSED `leerPlanoArchivo`**: con serverObserved, SÓLO state `PASS` → PRESENT_VALID; null/unknown/otro → PRESENT_REVIEW_REQUIRED.
- **P1**: ancla sin source_ref ni posición → `IDENTIDAD_AMBIGUA` (no gobierna sola); test de integración que atraviesa
  el ADAPTER real `leerPlanoDeArchivo` (nube mockeada) + el gate (`leerPlanoAdapterIntegracion.test.js`); limpieza histórica (1939/"SEGURO").
Exports nuevos de `resolverPrograma`: `construirResolucion`, `requirementId`, `instanceId`, `groupId`. Nuevo test adversarial
(4× op-2u) en `observedPipelineIntegracion.test.js`. Suite 2132/2132 (258 archivos) · build ✅ · deno check ✅. PENDIENTE: re-auditoría R11.

### Ronda 10 — ChatGPT + Grok (sobre a741ab1) — 14 P0/P1 ejecutables cerrados (código `b3da1ba`)
"R9 mejoró de verdad pero NO cerró integración." Un NEEDS_CONFIRMATION/REVIEW debe GOBERNAR la conducta, no ser
decorativo. Cerrado en código (pendiente de RE-AUDITORÍA; capa pura, sin deploy/motor):
- **R10-1** el cliente UNE issues del servidor y respeta `review_required` (no los borra al re-validar); `clamp01(null)→null`.
- **R10-2** `PRESENT_REVIEW_REQUIRED` es GATE: no auto-aplica; `requiereRevision` estructural.
- **R10-3** `NEEDS_CONFIRMATION` bloquea el botón Aplicar (ya no mete el producto incorrecto).
- **R10-4** `kind=room` jamás es mueble (ni ancla, ni capacidad, ni reception/meeting/workstation).
- **R10-5** NO inventar capacidad: bench sin capacity_total → `NEEDS_CAPACITY` (no convierte muebles en puestos).
- **R10-6** validador: `capacity_total ≠ quantity×capacity_per_unit` → `CAPACIDAD_INCONSISTENTE`; unit entero>0.
- **R10-7** identidad física del ancla llega al resolver; se resuelve por DIMENSIONES contra catálogo (`buscarEnColeccion`).
- **R10-8** reconciliación 1:1 por catálogo (cada ancla física resuelve independiente; no se reutiliza un módulo por capacidad).
- **R10-9** dependientes observados no desaparecen: `MATCH/DIVERGE/OBSERVED_ONLY/GENERATED_ONLY` en UI (CR-01 visible).
- **R10-10** golden `planoGoldenObserved132.test.js` con dims EXACTAS (CR-01 1200×500, CF-01 3300×600) y asserts de expectativa única. MOCK_ONLY.
- **R10-11** umbral único `UMBRAL_CONFIANZA_GOBERNAR=0.7` (observedProgram.js): media/baja → revisión.
- **R10-12** dedup por `source_ref`/`plan_tag` primero; dos muebles sin posición y sin etiqueta NO colisionan.
- **R10-13** ontología por PALABRA COMPLETA + role canónico (no 'direct'∈'indirect', 'puesto'∈'repuesto', 'print'∈'blueprint').
- **R10-14** `maxPage` se pasa en el wrapper SÓLO si el lector reporta páginas (hoy no lo emite → NOT_VERIFIED live).
Nuevos módulos previos usados: `mobiliarioOntologia.js`, `conversionMaterial.js`. Nuevo test de INTEGRACIÓN OFFLINE de
13 casos (`observedPipelineIntegracion.test.js`): server→validador→autoridad cliente→resolver→reconciliación→apply gate.
Suite 2125/2125 (257 archivos) · build ✅ · deno check ✅. Edge PREPARADO, NO DESPLEGADO. Verificado en vivo que el
bug de sustitución existía: el resolver elegía `op-8u-4800x1200-cristal` para 4 benches 2400×1400 → ahora NEEDS_CONFIRMATION.

### Ronda 9 — ChatGPT (sobre 8811fce) — 10 P0 de INTEGRACIÓN, TODOS cerrados (código `a741ab1`)
Acepta los fixes individuales de R8 y encuentra los errores de INTEGRACIÓN (los difíciles):
- **P0-R9-1** el cliente BYPASSEABA el observed_program validado: `leerPlanoArchivo.js` usaba `lec.observed_program`
  (crudo de IA). Ahora la AUTORIDAD es `r.observed_program` / `r.floorSpec.observed_program` (saneado server-side);
  expone `observed_source`/`observed_state`/`observed_validation`. Regresión en `planoReaderFurniture.test.js`.
- **P0-R9-2** schema core ≠ validador: `confianza` textual (alta/media/baja) → número por mapa EXPLÍCITO antes de
  validar; el schema del lector ya emite `kind/source_ref/plan_tag/grouping/capacity_total`; prompt distingue ancla/dependiente.
- **P0-R9-3** validador FAIL-CLOSED: quantity entero>0; confidence fuera de [0,1]→ISSUE (no clamp); kind inválido→ISSUE
  (no furniture silencioso); dims/orientation/capacity no numéricas→ISSUE.
- **P0-R9-4** estados `ABSENT` / `PRESENT_VALID` / `PRESENT_REVIEW_REQUIRED`: si el lector dio mobiliario, NO se
  reconstruye desde áreas; en revisión se enseñan pendientes y se pide confirmación.
- **P0-R9-5** `Voni.jsx` muestra `observadoPendientes` + anclas NEEDS_CONFIRMATION — nada observado desaparece en silencio.
- **P0-R9-6** `mobiliarioOntologia.js`: ANCLA vs DEPENDIENTE vs AMENIDAD. Una SILLA nunca crea ancla ni infla puestos/salas.
- **P0-R9-7** salas por capacidad POR UNIDAD (2 mesas ×6 → [6,6], no [12,12]).
- **P0-R9-8** se PRESERVA la identidad física por ancla (dims/zona/source_ref/capacidad) y se RECONCILIA por dimensiones:
  4 benches 2400×1400 NO se sustituyen en silencio por 1 módulo 4800×1200 → `NEEDS_CONFIRMATION` (REQUIERE_DESARROLLO).
  Verificado en vivo: el resolver elegía `op-8u-4800x1200-cristal`; ahora queda marcado, no sustituido.
- **P0-R9-9** golden `planoGoldenObserved132.test.js` con GROUND TRUTH COMPLETO (incluye S-01/SJ-01). El reader-golden
  mide lo que el documento contiene; test aparte reconcilia dependientes (observado vs resuelto) sin duplicar.
- **P0-R9-10** `conversionMaterial.js`: estrategia por familia (lámina kg = m²×kg/m² MULTIPLICA; tablero/perfil/herraje
  dividen) + goldens; BOM la usa. Sin parámetro de familia → FALTA_PARAM_CONVERSION → NO costable. Motor NO conectado.
Nuevos módulos: `mobiliarioOntologia.js`, `conversionMaterial.js` (+ tests). Regresión por cada hallazgo.
Suite 2092/2092 (256 archivos) · build ✅ · deno check ✅. Edge PREPARADO, NO DESPLEGADO.

### Ronda 8 — ChatGPT (sobre e859669) — 7 P0 nuevos, TODOS cerrados (código `8811fce`)
Acepta el trabajo de ronda 7 a nivel CODE. 7 P0 de "wiring real / cerrar invariantes antes del motor":
- **P0-R8-1** `observed_program` debe GOBERNAR el programa comercial, NO reconstruir desde áreas:
  `proponerProgramaDesdeObservado` + `programRequirementsDesdeObservado` (capacity manda PUESTOS, no muebles);
  `Voni.jsx:173-186` prefiere lo observado. PROPUESTA ≠ CONFIRMACIÓN. Rol sin vocabulario → `ROLE_NO_MAPEADO`
  (revisión), jamás inventado. SUGGESTED/INFERRED → `REQUIERE_CONFIRMACION`. 7 tests.
- **P0-R8-2** validador DETERMINISTA del observed_program del edge (`observed-core.js`, patrón de `acomodo-core.js`):
  quantity>0, capacity>0, dims>0, posición finita/en-envolvente, zona existente, página válida, confidence∈[0,1],
  evidencia obligatoria para OBSERVED, OBSERVED no derivado de cuarto, origin/kind enum, sin duplicados; añade
  source_ref/plan_tag/grouping/kind; inválido→REVIEW_REQUIRED. Cableado en el wrapper `leer-plano` (revalida y
  nunca emite mobiliario crudo). 16 tests · deno check ✓. **PREPARADO, NO DESPLEGADO** (prod edge = hard boundary).
- **P0-R8-3** ProductSpec certificable vía `evidenciaCertificable` (sólo MEASURED/DERIVED/USER_CONFIRMED/CATALOG) +
  `FALTA_EVIDENCIA`/`PROCEDENCIA_NO_CERTIFICABLE` + conserva evidence/page/source_ref. (cerrado antes en la sesión.)
- **P0-R8-4** BOM APLICA la conversión (no sólo gate): `conversion_factor`/`conversion_direction` +
  `cantidad_compra_equivalente` (tablero hoja→m² golden). 
- **P0-R8-5** vigencia de precio fin-de-día (`vigenciaCubre` + FIN_DIA_MS). (cerrado antes en la sesión.)
- **P0-R8-6** BOM NO COSTABLE sin unidad_compra: `costable` por línea + `estadoCosteo` COSTABLE/NO_COSTABLE del BOM.
- **P0-R8-7** golden real QA-COT-01 (132 m², `planoGoldenObserved132.test.js`): contrato GRABADO → validador edge
  → observed gobierna → ProductResolver (8 puestos, sala 8, dirección, recepción + dependientes WORK_SEAT/MEETING_SEAT;
  credenza/coffee → ROLE_NO_MAPEADO). Lectura de PDF en vivo = **BLOCKED_EXTERNAL** (no deploy). 4 tests.
Regresión por cada hallazgo. Suite 2066/2066 (254 archivos) · build ✅ · deno check ✅.

### Ronda 7 — ChatGPT (sobre 37fc330) — 10 P0 nuevos, TODOS cerrados (código `e859669`)
ChatGPT aceptó el trabajo previo a nivel CODE y encontró 10 P0 "issue detectado pero NO usado como gate" + 2 P1:
- **P0-4** precioUtilizable ahora bloquea FALTA_CONVERSION_UNIDAD (kg→hoja sin conversión nunca oficial).
- **P0-5** fuente inválida/ausente → PROVISIONAL; source_date FUTURA → fail-closed. (Adapter Intelisis: vigencia→validity.)
- **P0-6** FX: REAL/VERIFIED exige EVIDENCIA; fecha futura fail-closed; VERIFIED_CURRENT sólo fuente oficial.
- **P0-7** rutaFabricacion: OK exige fuente+evidencia (MO sólo oficial con procedencia).
- **P0-8** BOM: consumo por UNIDAD vs TOTAL (×cantidad) — jamás cobrar 0.72m² por 2 piezas.
- **P0-9** BOM: compra≠costeo sin conversión → CONVERSION_FALTANTE → PENDING.
- **P0-10** ProductSpec: no OK sin dimensiones útiles / procedencia UNKNOWN / sin confianza.
- **P0-1** VONI conserva lectura/floorSpec/request_id/observed_program y EstoEntendi lo usa (no re-infiere desde áreas).
- **P0-3** timeout: AbortController real + cleanup del timer + regresión delayed-success/timeout con fake timers.
- **P0-2** (PREPARADO, no desplegado): schema/prompt de mobiliario observado en leer-plano-core; cliente prefiere el real.
- **P1** shadow: `seguroParaCutover` → `sinDiferenciaNumericaActual` (wording exacto).
- **P1 PENDIENTE**: Golden Reality es comparador plano; falta BOM humano vs app línea por línea + ingerir T.D.C. real (xlsx).
Regresión por cada hallazgo. Suite 2033/2033 · build ✅ · smoke E2E 3/3.

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
  Resultado catálogo real: **259/259 iguales, 0 diferencias numéricas HOY (`sinDiferenciaNumericaActual`, NO "cutover seguro" permanente)**; 93 quedarían como costo
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
- `src/datos/rutaFabricacion.js` — HORAS-HOMBRE / ruta (§10): operaciones (corte/láser/soldadura/pintura/ensamble…)
  con setup/tiempo/tarifa/fuente; sin tiempo o tarifa → PENDING (nunca minutos inventados); MO total sólo si la ruta
  está completa. Responde "¿cuántas horas?" sólo con evidencia.
- `src/datos/crossFlowInvariants.test.js` — §25 "una sola realidad": mismo plano→mismos hechos, mismo insumo→misma
  resolución, mismo layout→misma firma, mismo BOM→mismo costo, proposal≠confirmation.
- **FIX crítico**: el helper `num` devolvía 0 para null/whitespace (Number(null)===0, Number('  ')===0) → corregido
  (null/undefined/''/whitespace → null) para no violar "$0≠desconocido" ni meter una merma de 0%.

### Ronda 6 — RED-TEAM adversarial #2 sobre goldenReality/fx/ruta (código `37fc330`)
Segundo subagente red-team; bugs reales encontrados y CERRADOS (con regresión):
- CRITICAL: goldenReality.difiere usaba AND → un hueco ABSOLUTO grande con % chico ($499/$100k) se escondía como
  REDONDEO. Ahora OR (real si grande en cualquier eje).
- CRITICAL: rutaFabricacion coaccionaba cantidad ≤0 a 1 → tiempo/costo fabricados como OK. Ahora CANTIDAD_INVALIDA → PENDING.
- HIGH: fxProvenance — POLÍTICA/estimado con vigencia futura se volvía VERIFIED_CURRENT. Ahora exige fuente OFICIAL (Banxico).
- MEDIUM: comparador FX sin orden total → no determinista (corregido); `num` dejaba pasar bool/array →0 (endurecido: sólo number/string).
- LOW: vigencia "hasta hoy" por la hora → fin-de-día; `hoy` inválido → fallback a ahora.

### Ronda 5 — RED-TEAM adversarial interno (código `66caeb7`)
Un subagente red-team atacó los 8 módulos nuevos. Bugs reales encontrados y CERRADOS (con regresión):
- HIGH: bomGenerator tragaba una merma fuera de rango (−5/≥100) → línea COMPLETO con bruto null. Ahora MERMA_INVALIDA → PENDING.
- MEDIUM: fechaDeFuenteTexto fabricaba fechas de folios/OC ("folio 15032026"→fecha) → precio sin fecha pasaba a
  REAL_OBSERVED_DATED. Ahora DDMMYYYY sólo en contexto de fecha + validación de calendario. ERP real intacto (2026-08-10).
- LOW: comparador de alternativas NaN (fechas null) → determinista; `hoy` inválido degradaba todo a HISTORICAL → fallback;
  explicarPrecio "Invalid Date" → "sin fecha"; productSpec espesor 0/whitespace → FALTA_ESPESOR.
Módulos sin bug en el eje de datos-incorrectos (declarado por el red-team): precioProvenance, shadowCutover, observedProgram
(core), canonicalPriceResolver (tier correcto).

### INVENTARIO de rubros de costo del MOTOR (§12, read-only, 2026-10-09)
El motor (`src/motor/calculo.js`) arma el COSTO INDUSTRIAL así (todos los rubros con evidencia en los comentarios,
ninguno inventado): `materialTotal` (directo+indirecto) + `manoObra` (por horas o Alba GI) + `preparacion` +
`empaque` + `indirectosFabrica`/`gastosOperacion` (30% "Factor Gastos Operación", Intelisis) = `costoUnitario`.
Capa COMERCIAL (después del costo, no dentro): `margenObjetivo`/`margenMinimo`/`minMarkupLinea`, `anticipoPorcentaje`, `IVA`,
`maniobras` (3%, respaldado por los 9 presupuestos: "Maniobras 3%"), `flete`.
**DATO_FALTANTE / NECESITA CONFIRMACIÓN (Rodrigo):** el `fletePorcentaje`=10 es número de Rodrigo; NINGÚN presupuesto
imprime un % de flete (el 3% del papel es de MANIOBRAS, otra cosa). Es el único rubro con desacuerdo sin cerrar.
No hay costo FINANCIERO explícito modelado → `PENDING/NO CONFIGURADO` (no se inventa %). Costos convertidos de USD
dependen de `tipoCambio` sin procedencia → ver fxProvenance (§9, falta cablear).

**INVENTARIO real del catálogo (mandate A, `insumos.js`, 259 insumos; hoy=2026-10-09):**
11 fuentes distintas: ERP Luis Daniel (99, 2026-08-10), Sonara (28), T.D.C. Alpura (18), Compras (15),
ERP última compra (6, SIN fecha), T.D.C. banca (4), Mercado estimado (3), T.D.C. Alba (2), Loktec (2),
Rodrigo rango (1), **81 sin fuente**. Coherencia resuelta con los estados nuevos:
**166 REAL_OBSERVED_DATED · 8 REAL_OBSERVED_UNDATED · 85 PROVISIONAL** (0 PENDING; todos tienen un número).
EcoLegno 19 mm = $544 → REAL_OBSERVED_DATED (Compras 2026-08-14). Capa ADITIVA: NO cambia los números del motor.

**SIGUIENTE — los CONTRATOS ya están; ahora toca WIRING REAL (ChatGPT): NO abrir más contratos aislados.**
Los módulos (precioProvenance/resolver/bridge, observedProgram/floorPlanReader, productSpec/bomGenerator,
fxProvenance, rutaFabricacion, goldenReality, shadowCutover) YA están construidos y con gates fail-closed.
Lo que falta es CONECTAR la casa, en este orden:
1. **WIRING del costeo de PRODUCTOS NUEVOS** (autorizado por Rodrigo, sin tocar 33 legacy):
   `ProductDrawingReader → ProductSpec → BOM → MaterialResolver → PriceResolver → FX → Ruta/MO → motor`.
   El motor debe tomar el precio EFECTIVO del `resolverPrecioInsumoVivo` con fail-closed (PENDING/PROVISIONAL/
   UNDATED ≠ costo oficial). Shadow ya demostró 0 diferencias numéricas HOY; preservar goldens. Hoy `calcular()`
   aún toma `insumo.precio`. (Toca el motor → cuidado con paridad; sólo productos nuevos.)
2. **PDF floor plan → observed_program (real) → confirmación → ProductResolver → Cotizar → Acomodo**: ronda 8
   cerró la CADENA OFFLINE (validador edge `observed-core.js` + observed GOBIERNA en Voni + golden QA-COT-01).
   Falta: (a) DESPLEGAR schema/prompt de mobiliario (leer-plano-core) y el wrapper con el validador — BLOCKED
   (prod edge); (b) el VOCABULARIO de mobiliario del lector (siguiente P0) para que roles no caigan en
   ROLE_NO_MAPEADO; (c) cerrar el lazo de CONFIRMACIÓN humana en UI. Golden = `planoGoldenObserved132.test.js`.
3. **Ingestión documental READ-ONLY de `fuentes/*.xlsx`** (T.D.C./compras reales): requiere dep de parser de xlsx
   + mapeo clave_erp→canonical_id = **DATA TRUTH** (reservado, no auto-aprobar). Conserva archivo→hoja→celda→
   artículo→precio→moneda→unidad→fecha→proveedor→canonical→conversión. `lista_precio_items` ya tiene provenance.
4. **GOLDEN REALITY real** (extender, P1): hoy es comparador plano de campos; falta BOM humano vs app LÍNEA por
   LÍNEA (materiales/partes/rubros + moneda+FX) y usarlo con las T.D.C. Alba/Alpura reales (depende de #3).
   fixture ≠ golden ejecutado.

## Matriz (estado real al código eb2ebfd)
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
