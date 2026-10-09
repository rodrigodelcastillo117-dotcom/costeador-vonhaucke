# HANDOFF PARA AUDITORÍA DE CHATGPT

> Documento para que ChatGPT audite rápido y nos ayude a avanzar mejor.
> La VERDAD viva y completa está en `CLOSEOUT_STATE.md`. Esto es el resumen de la sesión + el prompt.

---

## CIERRE FINAL / RC INTEGRADO (2026-10-09, HEAD `f263ba96bc87e3da6aae16ae9016576b414c3de7`)
- **RC integrado** en `audit/final-product-completion` @ `f263ba9`: merge de `release/current-20261009` (Home premium + Recharts v3 + deps) + R10 docs. **2182/2182 tests + vite build ✅**.
- **Preview Vercel READY** (verificado, 0 errores consola, Home premium "Cocreando tu espacio" confirmado): `https://costeador-vonhaucke-p8gqeurml-rodrigos-eurotrip.vercel.app` (dpl `dpl_4kEu62x2ck9cobnUPfz4hxzpZ2ig`).
- **Production: NO desplegado** — la promoción fue BLOQUEADA por el harness ("Production Deploy"); la hace Rodrigo. Rollback: `dpl_1m4bDohVjcqL86fcGHRhJTnw2rJc` / `5a38d2e`.
- **Paquete de entrega:** `FINAL_AUDIT_PACKET.md` (fuente de verdad + matriz + OPEN ITEMS), `TEST_EVIDENCE.md`, `CHATGPT_NEXT_ACTION.md`. Leer esos primero.
- Falta de verdad (BLOCKED/DATA_TRUTH): cutover de precios/materiales reales (shadow iniciado, regla de precio confirmada), vocabulario del lector + deploy de edges, E2E autenticado. Sin falsos verdes: ver matriz.

## ESTADO R15/R10 (previo, HEAD de código `260573a`)
- **R15 = 🟢 ACCEPTED/GREEN EN CÓDIGO** tras 6 re-auditorías ChatGPT+Grok. Sin más cambios en R15 salvo regresión demostrable.
- **R10 RE-AUDITADA contra el HEAD actual `260573a`: 15/15 invariantes enforced, 0 regresiones.** Se verificó uno por uno
  en el código del HEAD (no se asumió que los fixes de `b3da1ba` siguieran vigentes) y se corrieron los test files de la
  época (115 tests verdes). Varias invariantes R10 se CONSOLIDARON en `resolverAplicacionAtomica` (más estricto, no más
  débil). Detalle por punto en `CLOSEOUT_STATE.md` → "Re-auditoría R10 contra HEAD 260573a". No se cambió código (no hubo
  regresión). Limitaciones live SIN cambio (no regresiones): R10-14 PAGINA_FUERA_DE_RANGO sólo a nivel validador
  (NOT_VERIFIED live), catálogo sin dims QA-COT-01, golden MOCK_ONLY, edge no desplegado, GitHub 0 CI.
- Límites vigentes: NO motor cutover, NO XLSX, NO deploy, NO merge, NO migración prod, NO prod-write, NO 33 legacy, NO Intelisis.

---

## 6ª RE-AUDITORÍA R15 — RESUELTA (para CHATGPT + GROK)

- **branch:** `audit/final-product-completion` · **code SHA:** `260573a` (HEAD = doc-commit encima). Base = `985eef3`.
- **tests:** 2182/2182 vitest (259 archivos; +3) · **vite build:** ✅ · **deno check:** ✅ (edges sin cambios). **CI real:** GitHub 0 runs (evidencia LOCAL).
- La 6ª re-auditoría aceptó L/M (dominio) y confirmó que K/H3/I2/I3/G/J no regresaron; corrigió 1 afirmación falsa en los docs y 1 hueco de UX en VONI:
  - **Corrección de doc (confirmado_modelo)** — era FALSO decir "sin flag persistente de modelo confirmado entre sesiones". `confirmado_modelo` SÍ persiste dentro de `cotizacion.partidas`: lo conservan `partidaComercialDesdeConfirmado` y `estructuraDe`, no lo elimina `compactarPayloadNube`, y la sanitización DB `jsonb_sin_economia()` tampoco (sólo quita costo/margen/proveedor). Sobrevive save → Supabase → reopen. Lo que NO existe es una confirmación DURABLE INDEPENDIENTE de la partida: si la silla se elimina/reemplaza, la decisión se pierde. — **INTEGRATION_PASS** (test de persistencia: `paraGuardar` conserva `confirmado_modelo:true`). La cadena DB (`cotizacion_segura`/`jsonb_sin_economia`) es contrato leído, **NOT_VERIFIED** en vivo.
  - **P1-R15-N** — VONI ya bloqueaba la propuesta por aplicación pendiente (L), pero el BOTÓN/TARJETA/MENSAJE de "Aplicar programa detectado" seguían decidiéndose por `faltantesPrograma` (sólo productos NUEVOS). En un enrichment-only (nuevas=0, enriquecidos>0, committed=true) la propuesta quedaba bloqueada pero el botón salía deshabilitado, la tarjeta podía no aparecer y el mensaje decía "0 producto(s)". Ahora VONI deriva TODO de la misma autoridad atómica (`resolverAplicacionAtomica`): botón habilitado si `aplicacionPendientePrograma`, tarjeta visible con `enriquecidosPrograma>0`, y el mensaje distingue nuevos vs existentes por vincular/actualizar. — **INTEGRATION_PASS** (M/N dominio) + **CODE_PASS** (botón/tarjeta/mensaje = source-assert). Render = **NOT_VERIFIED**.
- **Estado R15:** K/H3/I2/I3 ✅ · L ✅ · M ✅ · N ✅ (acción+mensaje de VONI usan la autoridad atómica) · G/J ✅. Voni y Acomodo consultan la MISMA fuente `resolverAplicacionAtomica`.
- **Supuestos NO verificados LIVE:** ningún render de UI en E2E (sólo dominio + source-asserts); la cadena DB de guardado/sanitización/reopen es contrato leído (no corrido en vivo); `patchCambios` compara por valor JSON y asume datos planos; selector "elegir otro producto" pendiente de UI; `confirmado_modelo` persiste en la partida pero NO hay confirmación durable independiente de ella. **NO se tocó motor / XLSX / deploy.**

---

## 5ª RE-AUDITORÍA R15 — RESUELTA (para CHATGPT + GROK)

- **branch:** `audit/final-product-completion` · **code SHA:** `0dcd6f2` (HEAD = doc-commit encima). Base = `5ccd262`.
- **tests:** 2179/2179 vitest (259 archivos; +4) · **vite build:** ✅ · **deno check:** ✅ (edges sin cambios). **CI real:** GitHub 0 runs (evidencia LOCAL).
- La 5ª re-auditoría aceptó K/H3/I2/I3 en las rutas corregidas; reabrió 2 huecos del MISMO contrato OBSERVED/PROPUESTA ≠ CONFIRMACIÓN. Corregidos con UNA sola autoridad:
  - **P0-R15-L** — el gate ÚNICO de VONI (`puedeEntrarPropuesta`) NO incluía la aplicación pendiente: con una recepción canónica nueva detectada pero aún no aplicada, VONI podía saltar directo a la propuesta (stepper / "ir directo" / omitir / onIr). Ahora exige `!aplicacionPendientePrograma`, consultando la MISMA autoridad que Acomodo (`programaTieneAplicacionPendiente` → `resolverAplicacionAtomica`). Mensaje: "Falta aplicar N producto(s) detectado(s) del plano antes de cerrar la propuesta." — **INTEGRATION_PASS** (caso L por la autoridad compartida) + **CODE_PASS** (gate de Voni = source-assert). Render = **NOT_VERIFIED**.
  - **P0-R15-M** — "pendiente de aplicar" sólo miraba `confirmadas` (productos nuevos), no los ENRIQUECIMIENTOS estructurales. Un existente legacy/manual correcto pero sin `instance_id`/`functional_group_id`/`plan_source_ref`/`zone_id`/`confirmado_modelo` se reconcilia con `confirmadas=0` pero `enriquecidos>0` (write real). Ahora `bloqueosProgramaObservado` deriva de `resolverAplicacionAtomica`: `committed===true` ⇒ `PROGRAMA_PENDIENTE_APLICAR` (distingue `nuevas` vs `enriquecidos` en el mensaje/metadata). UNA sola definición de "aplicado", compartida por Voni y Acomodo. — **INTEGRATION_PASS** (caso M enrichment-only: bloquea antes, publicable después).
- **Estado R15:** K/H3/I2/I3 ✅ (4ª) · L ✅ (gate Voni con aplicación pendiente) · M ✅ (pendiente = nuevos **o** enriquecimientos, autoridad única). G/J siguen PASS. Acomodo y Voni consultan la MISMA fuente (`resolverAplicacionAtomica`).
- **Supuestos NO verificados LIVE:** ningún render de UI en E2E (sólo dominio + source-asserts del gate de Voni); `patchCambios` compara por valor JSON y asume datos planos; selector "elegir otro producto" pendiente de UI; confirmado_modelo SÍ persiste en cotizacion.partidas y sobrevive save/reopen (compactarPayloadNube y jsonb_sin_economia no lo eliminan); lo que NO existe es una confirmación durable independiente de la partida (si la silla se elimina o reemplaza, la decisión se pierde). **NO se tocó motor / XLSX / deploy.**

---

## 4ª RE-AUDITORÍA R15 — RESUELTA (para CHATGPT + GROK)

- **branch:** `audit/final-product-completion` · **code SHA:** `cc15e92` (HEAD = doc-commit encima). Base = `d244c24`.
- **tests:** 2175/2175 vitest (259 archivos; +4) · **vite build:** ✅ · **deno check:** ✅ (edges sin cambios). **CI real:** GitHub 0 runs (evidencia LOCAL).
- La 4ª re-auditoría aceptó G/J y el gate fail-closed; reabrió F (incompleto → P0 nuevo K) + H (parcial) + I (parcial). Corregidos:
  - **P0-R15-K** — `bloqueosProgramaObservado` ahora también bloquea cuando el plano detectó productos canónicos reales que **todavía no están en la cotización** (`recon.confirmacion.confirmadas.length > 0` → blocker `PROGRAMA_PENDIENTE_APLICAR`). OBSERVED detectado ≠ producto confirmado. Antes de "Aplicar programa detectado" el programa NO es publicable aunque no haya revisión/sillería/conflicto; tras aplicar → `confirmadas=0` → publicable. — **INTEGRATION_PASS** (caso K: recepción nueva detectada no aplicada → bloquea; aplicada → `[]`). Render del gate = **NOT_VERIFIED**.
  - **P1-R15-H3** — `confirmado_modelo` ahora SOBREVIVE también al REUTILIZAR una silla existente: se propaga en `estructuraDe` (patch de enriquecidos), no sólo en partidas nuevas. Confirmar un modelo alterno sobre una silla ya cotizada deja `silleriaPendiente`=false end-to-end. — **INTEGRATION_PASS** (caso H3 por ruta de reutilización, además de H1/H2 por partida nueva).
  - **P1-R15-I2** — idempotencia ESTRICTA: `confirmarPrograma` sólo emite `enriquecidos` cuando el patch cambia de verdad algún valor (`patchCambios` diff vs la partida existente). Re-aplicar datos idénticos → `enriquecidos=0` → `resolverAplicacionAtomica` devuelve `committed=false` / `motivo=IDEMPOTENTE` (no rerender/autosave inútil). — **INTEGRATION_PASS** (I1 ahora asserta `committed===false`; I2 enriquecido-real vs idéntico).
  - **P1-R15-I3** — `App.aplicarProgramaDetectado` es ahora un **COMMAND**: NO captura ni devuelve el resultado del commit (React no garantiza que el updater corra antes del return; ese contrato no es cumplible síncronamente). La AUTORIDAD es el estado actualizado; el write real lo decide `resolverAplicacionAtomica` contra `prev`, fail-closed. Sin `flushSync`. — **CODE_PASS** (source-assert: sin `return resultado`, sin `NO_APLICADO`).
- **Estado R15:** G ✅ · J ✅ · gate fail-closed ✅ · F+K ✅ (publicación bloqueada por mobiliario pendiente de aplicar) · H+H3 ✅ · I2 idempotencia estricta ✅ · I3 command ✅.
- **Supuestos NO verificados LIVE:** ningún render de UI en E2E (sólo dominio + source-asserts); el handler de aplicación ya NO promete resultado síncrono (si un caller futuro necesita el commit, debe ser por callback/efecto posterior, no por retorno); `patchCambios` compara por valor (JSON) y asume datos planos; selector "elegir otro producto" pendiente de UI; confirmado_modelo SÍ persiste en cotizacion.partidas y sobrevive save/reopen (compactarPayloadNube y jsonb_sin_economia no lo eliminan); lo que NO existe es una confirmación durable independiente de la partida (si la silla se elimina o reemplaza, la decisión se pierde). **NO se tocó motor / XLSX / deploy.**

---

## 3ª RE-AUDITORÍA R15 — RESUELTA (para CHATGPT + GROK)

- **branch:** `audit/final-product-completion` · **code SHA:** `08e6aad` (HEAD = doc-commit encima). Base = `da454fe`.
- **tests:** 2171/2171 vitest (259 archivos; +11 adversariales) · **vite build:** ✅ · **deno check:** ✅ (leer-plano/leer-plano-core, sin cambios este round). **CI real:** GitHub 0 runs (evidencia LOCAL).
- La 3ª re-auditoría aceptó D2/C2/B2/E2/A-UX y reabrió 5 hallazgos (F P0, G/H/I/J P1). Corregidos:
  - **P0-R15-F** — Acomodo podía publicar un programa comercial INCOMPLETO (el layout geométrico PASS no implica programa completo). Nueva **autoridad única** `bloqueosProgramaObservado(propuestaPlano,{partidas})` que combina: `requiereRevision` + sillería pendiente REAL reconciliada contra las partidas actuales + conflictos de reconciliación. Acomodo concatena `coherenciaPrograma.bloqueos` + eso y lo pasa a `AcomodoBase.bloqueosPrograma` → `programaListo=false` ⇒ Propuesta Viva / guardado final / PDF bloqueados; BORRADOR sigue permitido. — **INTEGRATION_PASS** (F1 sillería-pendiente, F2 EXISTING_SURPLUS, F3 publicable cuando sillería cubierta). Wiring en Acomodo.jsx = **CODE_PASS** (source-assert); render del gate = **NOT_VERIFIED** (sin E2E).
  - **P1-R15-G** — el botón "Aplicar programa detectado" ahora se deshabilita también por `reconObs.conflictos` (no sólo `requiereRevision`) y muestra el motivo concreto (`CONFLICTO: <code>`). — **CODE_PASS** (source-assert); render = **NOT_VERIFIED**.
  - **P1-R15-H** — `confirmado_modelo` SOBREVIVE `aItemConfirmado` y `partidaComercialDesdeConfirmado` (sólo cuando es `true`; nunca se inventa). Un modelo ALTERNO confirmado cruza el apply end-to-end y `silleriaPendiente`=false; sin confirmar → true. — **INTEGRATION_PASS** (H1/H2 end-to-end).
  - **P1-R15-I** — el return de `App.aplicarProgramaDetectado` ya NO deriva de un snapshot (`vista`): WRITE y RETURN usan la MISMA autoridad `resolverAplicacionAtomica(propuesta,{existentes:prev})`. Nueva función pura probada con test REAL de carrera (no source-assert): 2ª aplicación contra el prev ya actualizado → 0 nuevas, no duplica; conflicto → committed=false fail-closed; bloqueada → committed=false. — **INTEGRATION_PASS** (I1 carrera, I2 conflicto, I3 bloqueada). Integración React (timing batcheado del updater) = **NOT_VERIFIED**; el return es conservador (nunca reporta éxito fantasma).
  - **P1-R15-J** — VONI muestra "✓ Sillería confirmada" cuando `!sillasPorConfirmar` (antes decía siempre "modelo por confirmar"). — **CODE_PASS** (source-assert); render = **NOT_VERIFIED**.
- **Supuestos NO verificados LIVE:** ningún render de UI está cubierto por E2E (sólo dominio + source-asserts); el timing batcheado de React en `aplicarProgramaDetectado` (el return refleja el commit sólo si el updater corre síncrono — en el navegable es conservador, nunca miente éxito); ningún caller consume hoy ese return como autoridad; el selector "elegir otro producto / requiere desarrollo" sigue pendiente de UI; sin flag PERSISTENTE de "modelo confirmado" entre sesiones (si el usuario borra las sillas confirmadas, vuelve a pendiente). **NO se tocó motor / XLSX / deploy.**

---

## 2ª RE-AUDITORÍA R15 — RESUELTA (para CHATGPT + GROK)

- **branch:** `audit/final-product-completion` · **code SHA:** `eb2ebfd` (HEAD = doc-commit encima). Base = `fd6b6c5`.
- **tests:** 2160/2160 vitest (259 archivos) · **vite build:** ✅ · **deno check:** ✅. **CI real:** GitHub 0 runs (evidencia LOCAL).
- La 2ª re-auditoría aceptó R15-2/3/5 y R15-A (lógica) y reabrió D/C/B/E + P1 UX. Corregidos:
  - **R15-D2** — el borrado no sobrevivía el MERGE del padre → ahora Acomodo sobreescribe NEUTRAL (sugeridosPartidas:[], demoAutopoblado:false, programaPropuesto:false). — **INTEGRATION_PASS** (caso 38, semántica de merge).
  - **R15-C2** — sillas heredan `anchor_role` + `functional_group_id` del ancla (no grupo inventado). — **INTEGRATION_PASS** (caso 36 ext).
  - **R15-B2** — `silleriaPendiente` por (rol, ancla, modelo, cantidad): ancla equivocada / modelo distinto → pendiente. — **INTEGRATION_PASS** (casos 37/37b).
  - **R15-E2** — gate de conflictos en el PUNTO ATÓMICO (`setEstado(prev)` revalida y devuelve prev con conflictos). — **CODE_PASS** (App; dominio produce conflictos INTEGRATION_PASS 31/31b).
  - **R15-A-UX** — botón "ir directo a la propuesta" `disabled={!puedeEntrarPropuesta}` + title explicativo (no más botón muerto). — **CODE_PASS**.
- **Estado R15:** R15-1 ✅ · R15-2 ✅ · R15-3 ✅ · R15-4 ✅ · R15-5 ✅ · R15-6 ✅ (borrado real bajo merge).
- **Supuestos NO verificados LIVE:** render de UI (stepper/botones/persistencia) NO cubierto por E2E, sólo lógica de dominio + 1 source-assert del gate atómico; el selector "elegir otro producto / requiere desarrollo" sigue pendiente de UI; sin flag persistente de "modelo confirmado" (si el usuario borra las sillas, vuelve a pendiente).

---

## RE-AUDITORÍA R15 — RESUELTA (para CHATGPT + GROK)

- **branch:** `audit/final-product-completion` · **code SHA:** `fd6b6c5` (HEAD = doc-commit encima). Base = `b651932`.
- **tests:** 2156/2156 vitest (259 archivos) · **vite build:** ✅ · **deno check:** ✅. **CI real:** GitHub 0 runs (evidencia LOCAL).
- La re-auditoría aceptó **R15-2 / R15-3 / R15-5 (PASS)** y reabrió R15-1/4/6. Corregidos los 5 falsos verdes:
  - **R15-A** (gate se brincaba por el stepper) → `puedeEntrarPropuesta` ÚNICO; stepper + botones + omitir + candado + onIr lo usan. — **CODE_PASS** (lógica), render no E2E.
  - **R15-B** (una silla "resolvía" todo) → `silleriaPendiente` por rol + cantidad. — **INTEGRATION_PASS** (caso 35).
  - **R15-C** (`propuestaSilleriaSugerida` perdía ancla / duplicaba IDs) → ligada a `anchor_instance_id`, 8 sillas únicas 2/ancla. — **INTEGRATION_PASS** (caso 36).
  - **R15-D** (persistencia conservaba 2ª realidad) → fail-closed: con observed se eliminan sugeridosPartidas/demoAutopoblado/programaPropuesto. — **CODE_PASS** (lógica), render no E2E.
  - **R15-E** (surplus era sólo mensaje) → gate real: botón deshabilitado + `App.aplicarProgramaDetectado` rehúsa el write si la reconciliación produce EXISTING_SURPLUS/SLOT_OCUPADO/SPLIT_REQUIRED. — **CODE_PASS** (App), dominio `aplicarPrograma` produce los conflictos **INTEGRATION_PASS** (casos 31/31b).
- **Estado R15 final:** R15-1 ✅ (surplus detecta + gate), R15-2 ✅, R15-3 ✅, R15-4 ✅ (gate+acción real), R15-5 ✅, R15-6 ✅ (incl. persistencia).
- **BLOCKED_EXTERNAL / supuestos:** iguales que el bloque R15 abajo + el render de UI (stepper/gate/persistencia) NO está cubierto por E2E; sólo la LÓGICA de dominio. El selector "elegir otro producto / requiere desarrollo" sigue pendiente de UI.
- **Hallazgo:** el gate de sillería se libera cuando `silleriaPendiente` ve cubierto el rol+cantidad en la cotización (p.ej. tras "Usar sillería sugerida"); si el usuario borra esas sillas luego, vuelve a pendiente — sin flag de "confirmado" persistente (decisión de negocio abierta).

---

## R15 PARA AUDITORÍA CHATGPT + GROK

- **branch:** `audit/final-product-completion` · **code SHA:** `b651932` (HEAD = doc-commit encima). Base R15 = `0fad6cb`.
- **tests:** 2154/2154 vitest (259 archivos) · **vite build:** ✅ · **deno check:** ✅. **CI real:** GitHub 0 runs (evidencia LOCAL).
- **archivos tocados (R15):** `src/datos/confirmarPrograma.js` (surplus + plan_instances), `src/datos/programaRealDelPlano.js` (stableKey sin colisión + gobernadoPorObservado + propuestaSilleriaSugerida), `src/componentes/Acomodo.jsx` (una sola realidad en estado + counts), `src/componentes/Voni.jsx` (gate propuesta final + acción sillería), `src/datos/observedPipelineIntegracion.test.js` (+6 adversariales).
- **Estado por hallazgo:**
  - R15-1 EXISTING_SURPLUS (existente cantidad 4 + observed 2 → reutiliza 2, surplus 2; observed 0 → review) — **INTEGRATION_PASS** (31/31b).
  - R15-2 provenance agrupada (plan_instances[] conserva B-01+B-02) — **INTEGRATION_PASS** (32).
  - R15-3 stable key sin colisiones (misma zone+grouping, posiciones distintas → IDs distintas) — **INTEGRATION_PASS** (33).
  - R15-4 sillería gatea propuesta final + acción real `propuestaSilleriaSugerida` — **INTEGRATION_PASS** (34/34b). Gate UI en Voni = CODE_PASS; selector "elegir otro producto" = NOT_VERIFIED/pendiente.
  - R15-5 counts Acomodo por unidades físicas — **CODE_PASS** (lógica; render no E2E).
  - R15-6 una sola realidad en estado (sin persistir sugerencias por áreas si observed) — **CODE_PASS** (lógica; render no E2E).
- **BLOCKED_EXTERNAL:** deploy edge; motor cutover; DATA TRUTH (xlsx + conversión por familia + modelo de sillería por línea + schema de acabado en el lector); merge/promote; migraciones; 33 legacy; Intelisis.
- **Supuestos NO verificados LIVE:**
  1. El schema del lector NO emite modelo/acabado por mueble → sillería/mesa ambigua requiere confirmación; "Usar sugerida" aplica el default de regla (silla-win/concerto), que NO está confirmado con VH.
  2. El selector interactivo "elegir otro producto / requiere desarrollo" NO está en UI; sí está la acción "usar sugerida" y el gate.
  3. El catálogo real NO tiene las dims del ground truth QA-COT-01 (sí op-2u-1500x1200).
  4. El render (gate de botones, counts, una sola realidad) NO está cubierto por E2E; sólo la LÓGICA de dominio.
  5. EXISTING_SURPLUS marca conflicto pero NO borra: la acción de "reducir cantidad" es decisión humana, aún sin UI dedicada.
- **Hallazgos nuevos:** `reutilizadas` (renglones) vs `reutilizadasUnidades` (físicas) coexisten; Acomodo usa unidades. El gate de sillería se libera cuando el usuario aplica "usar sugerida" (los asientos entran como partidas reales y `sillasYaEnCotizacion` pasa a true) — conviene que decidan si además debe persistirse un flag explícito de "modelo confirmado" por si el usuario borra las sillas luego.

---

## R14 PARA AUDITORÍA CHATGPT + GROK

- **branch:** `audit/final-product-completion` · **code SHA:** `0fad6cb` (HEAD = doc-commit encima). Base R14 = `ce03973`.
- **tests:** 2148/2148 vitest (259 archivos) · **vite build:** ✅ · **deno check:** ✅. **CI real:** GitHub 0 runs (evidencia LOCAL).
- **archivos tocados (R14):** `src/datos/confirmarPrograma.js` (pool por cantidad + identidad estable + provenance patch), `src/datos/programaRealDelPlano.js` (requirementId estable, requiereConfirmacionSillas/programaCompleto, provenance), `src/componentes/Acomodo.jsx` (count fix + una sola realidad), `supabase/functions/leer-plano/observed-core.js` (observed_model), `src/datos/observedPipelineIntegracion.test.js` (+6 adversariales).
- **Estado por hallazgo:**
  - R14-1 cardinalidad cantidad>1 (obs 2 + existente(2) → reutiliza 2, agrega 0; obs 4 → agrega 2) — **INTEGRATION_PASS** (casos 25/26).
  - R14-2 identidad estable + reorder sin swap de provenance — **INTEGRATION_PASS** (caso 27).
  - R14-3a fix count Acomodo (`reconObs.confirmacion.resumen`) — **CODE_PASS** (render no E2E).
  - R14-3b MODEL_MISMATCH gate + requiereConfirmacionSillas/programaCompleto — **INTEGRATION_PASS** (casos 28/29). Selector interactivo de modelo = **NOT_VERIFIED / pendiente UI** (el contrato de datos ya lo soporta).
  - R14-4 provenance completa (evidence+posición+orientación a la partida comercial) — **INTEGRATION_PASS** (caso 30).
  - R14-6 una sola realidad en Acomodo (sin sugerencias por áreas si observadoPresente) — **CODE_PASS** (render no E2E).
- **BLOCKED_EXTERNAL:** deploy edge; motor cutover; DATA TRUTH (xlsx + conversión por familia + modelo de sillería por línea + schema de acabado en el lector); merge/promote; migraciones; 33 legacy; Intelisis.
- **Supuestos NO verificados LIVE:**
  1. El schema del lector NO emite modelo/acabado por mueble → observed_model casi siempre null; sillería/mesa ambigua requiere confirmación humana.
  2. El selector interactivo de modelo de sillería (usar sugerido / elegir otro / requiere desarrollo) NO está implementado en UI; hoy se muestra el estado y el gate, pero el acto de confirmación por-modelo es pendiente.
  3. El catálogo real NO tiene las dims del ground truth QA-COT-01 (sí op-2u-1500x1200).
  4. El render de Acomodo/VONI (counts, una sola realidad, recomendaciones) NO está cubierto por E2E; sólo la LÓGICA de dominio.
  5. La estabilidad de instance_id ahora deriva de plan_source_ref; si el lector NO entrega source_ref, cae a grouping y luego al índice (documentado).
- **Hallazgos nuevos:** `resumen.reutilizadas` se mantiene como RENGLONES (compat con tests previos) y se añadió `reutilizadasUnidades` (físicas) para la cardinalidad. El gate distingue dos niveles: `requiereRevision` (bloquea aplicar el ANCLA) vs `requiereConfirmacionSillas`/`programaCompleto` (bloquea presentar el programa como completo sin confirmar sillería) — conviene que decidan si "no necesito acomodo → propuesta final" debe gatearse también con `programaCompleto`.

---

## R13 PARA AUDITORÍA CHATGPT + GROK

- **branch:** `audit/final-product-completion` · **code SHA:** `ce03973` (HEAD = doc-commit encima). Base R13 = `9166921`.
- **tests:** 2142/2142 vitest (259 archivos) · **vite build:** ✅ · **deno check:** ✅. **CI real:** GitHub 0 runs (evidencia LOCAL).
- **archivos tocados (R13):** `src/datos/confirmarPrograma.js` (match por instancia + provenance patch), `src/datos/programaRealDelPlano.js` (conciliarDependientes modelo), `src/componentes/Acomodo.jsx` (render con existentes + recomendaciones), `src/componentes/Voni.jsx` (recomendaciones), `src/datos/observedPipelineIntegracion.test.js` (+R13-1/5/3/4).
- **Estado por hallazgo:**
  - R13-1 cardinalidad real (4 obs + 2 existentes → reutiliza 2, agrega 2) — **INTEGRATION_PASS** (caso 21).
  - R13-2 Acomodo con partidas existentes (reconciliación visible, sin bypass) — **CODE_PASS** (gate de UI cambiado) + reconciliación de dominio **INTEGRATION_PASS**; render = NOT_VERIFIED (no E2E).
  - R13-3 recomendaciones/sillas no desaparecen (Voni+Acomodo las consumen) — **INTEGRATION_PASS** (caso 23) + CODE_PASS (UI).
  - R13-4 source_ref ≠ modelo — **INTEGRATION_PASS** (caso 24).
  - R13-5 provenance en reutilizados (plan_source_ref sobrevive la reconciliación) — **INTEGRATION_PASS** (caso 22).
  - P1 model/finish del observado hasta resolverAnclaCanonica — **CODE_PASS parcial / PENDIENTE**: se lee defensivamente pero el schema del lector NO lo emite → fail-closed (sin modelo → requiere confirmación).
- **BLOCKED_EXTERNAL:** deploy edge; motor cutover; DATA TRUTH (xlsx + conversión por familia + modelo de sillería por línea + schema de acabado en el lector); merge/promote; migraciones; 33 legacy; Intelisis.
- **Supuestos NO verificados LIVE:**
  1. El schema del lector NO emite modelo/acabado por mueble → el modelo observado es casi siempre null y la sillería/mesa ambigua requiere confirmación humana.
  2. El catálogo real NO tiene las dims del ground truth QA-COT-01 (sí op-2u-1500x1200, por eso los adversariales resuelven).
  3. El render de Acomodo/VONI (reconciliación con existentes, recomendaciones) NO está cubierto por E2E; sólo la LÓGICA de dominio.
  4. La estabilidad de `instance_id` entre corridas depende de que el observed_program llegue en el MISMO orden; si el lector reordena filas, los índices cambian (hoy no hay orden garantizado del modelo).
- **Hallazgos nuevos:** la reconciliación por instancia asume que los `instance_id` existentes provienen de una corrida previa del MISMO observed (mismo orden de filas). Si el orden cambia, el match cae a slot físico (ordinal) y luego a requirement_id único — correcto pero conviene fijar un orden canónico del observed_program en el futuro.

---

## R12 PARA AUDITORÍA CHATGPT + GROK

- **branch:** `audit/final-product-completion` · **code SHA:** `9166921` (HEAD = doc-commit encima). Base R12 = `b94800d`.
- **tests:** 2138/2138 vitest (259 archivos) · **vite build:** ✅ · **deno check:** ✅. **CI real:** GitHub 0 runs (evidencia LOCAL).
- **archivos tocados (R12):** `src/datos/programaRealDelPlano.js` (resolverAnclaCanonica + provenance + recomendaciones + gate identity), `src/datos/confirmarPrograma.js` (plan_source_ref), `src/componentes/Acomodo.jsx` (sin bypass hayReales), `src/datos/observedPipelineIntegracion.test.js` (+R12-1/2/3/5), nuevo `src/datos/acomodoObservedAuthority.test.js`.
- **Estado por hallazgo:**
  - R12-1 ambigüedad de producto = REVIEW (900×900 → PRODUCT_AMBIGUOUS, no matches[0]) — **INTEGRATION_PASS** (caso 17).
  - R12-2 capacidad debe coincidir (bench 1500×1200 cap 8 → CAPACITY_MISMATCH) — **INTEGRATION_PASS** (caso 18).
  - R12-3 dependiente observado ≠ SKU default (sillas = recomendación SUGGESTED, no partida) — **INTEGRATION_PASS** (caso 19).
  - R12-4 Acomodo autoridad única (sin bypass hayReales) — **CODE_PASS** (bypass removido) + reconciliación de dominio **INTEGRATION_PASS** (confirmarPrograma + acomodoObservedAuthority). UI render = NOT_VERIFIED (no E2E).
  - R12-5 provenance end-to-end (plan_source_ref=B-01 sobrevive apply) — **INTEGRATION_PASS** (caso 20).
  - P1 sin cross-línea con línea explícita — **CODE_PASS**. P1 propuestaBloqueada ⊃ identity_status MISSING — **CODE_PASS**. P1 tests offline — ✅.
- **BLOCKED_EXTERNAL:** deploy edge; motor cutover; DATA TRUTH (xlsx + conversión por familia + modelo de sillería por línea); merge/promote; migraciones; 33 legacy; Intelisis.
- **Supuestos NO verificados LIVE:**
  1. El catálogo real NO tiene las dims del ground truth QA-COT-01 → en ese plano casi toda ancla cae en NEEDS_CONFIRMATION (op-2u-1500x1200 sí existe, por eso el adversarial resuelve).
  2. El modelo de sillería por línea (silla-win/concerto…) NO está confirmado con VH → se trata como SUGGESTED, nunca confirmado.
  3. La visión poblará observed_program conforme al schema — golden/adapter = contrato GRABADO, no PDF vivo.
  4. El render de Acomodo/VONI con observed + partidas existentes NO está cubierto por E2E; sólo la LÓGICA de dominio.
  5. UMBRAL_CONFIANZA_GOBERNAR=0.7 y el mapa de confianza textual son convención de Claude.
- **Hallazgos nuevos:** el orden importa — "sin producto de esa geometría" es NEEDS_CONFIRMATION, no CAPACITY_MISMATCH (se corrigió el orden en `resolverAnclaCanonica`). Al volver las sillas RECOMENDACIONES, el `preview`/`partidas` del observed ya NO contienen asientos (sólo anclas): cualquier consumidor aguas abajo que esperara asientos en partidas debe leer `recomendaciones`. La POLÍTICA de cuál gana (modelo observado vs sugerido por regla) sigue sin decidir por negocio.

---

## R11 PARA AUDITORÍA CHATGPT + GROK

- **branch:** `audit/final-product-completion` · **code SHA:** `b94800d` (HEAD = doc-commit encima). Base R11 = `b3da1ba`.
- **tests:** 2132/2132 vitest (258 archivos) · **vite build:** ✅ · **deno check:** ✅ (leer-plano, observed-core, leer-plano-core).
- **CI real:** GitHub SIN workflow runs (0). Evidencia LOCAL de Claude.
- **archivos tocados (R11):** `src/datos/resolverPrograma.js` (exports), `src/datos/programaRealDelPlano.js` (identity-first + gate), `src/datos/leerPlanoArchivo.js` (fail-closed), `src/componentes/Acomodo.jsx` (autoridad única + gate botón), `src/App.jsx` (gate central), `src/datos/observedPipelineIntegracion.test.js` (+adversarial), nuevo `src/datos/leerPlanoAdapterIntegracion.test.js`.
- **Estado por hallazgo:**
  - R11-1 identity-first (por dimensiones, no capacidad) — **INTEGRATION_PASS** (adversarial 4× op-2u + adapter real).
  - R11-2 cardinalidad 1:1 (N instancias) — **INTEGRATION_PASS** (el adversarial produce 4 instancias op-2u).
  - R11-3 dependientes son gate (OBSERVED_ONLY/DIVERGE → requiereRevision) — **INTEGRATION_PASS** (casos 15 + adapter gate).
  - R11-4 autoridad única (Voni≡Acomodo) + gate central en App — **CODE_PASS** (lógica; `propuestaBloqueada` **INTEGRATION_PASS** vía adapter). UI de Acomodo = CODE_PASS (no E2E render).
  - R11-5 fail-closed leerPlanoArchivo — **INTEGRATION_PASS** (adapter: validation null → PRESENT_REVIEW_REQUIRED).
  - P1 identidad ambigua — **INTEGRATION_PASS** (caso 16). P1 integración por adapter real — **INTEGRATION_PASS**. P1 limpieza docs — **CODE_PASS**.
- **ADVERSARIAL exigido:** `observedPipelineIntegracion.test.js` caso 14 — 4× op-2u-1500x1200 observado → EXACTAMENTE 4× op-2u en propuesta, 0× op-8u. (Fallaría en b3da1ba, que agregaba capacidad → op-8u.)
- **BLOCKED_EXTERNAL:** deploy edge; motor cutover; DATA TRUTH (xlsx + params de conversión); merge/promote; migraciones; 33 legacy; Intelisis.
- **Supuestos NO verificados LIVE:**
  1. La visión poblará observed_program conforme al schema — golden/adapter usan contrato GRABADO, no PDF vivo.
  2. El catálogo real tiene op-2u-1500x1200 (por eso el adversarial RESUELVE), pero NO tiene las dims del ground truth QA-COT-01 (2400×1400, 3200×1200, 2000×900, 1200×500) → en ese plano casi todo caería en NEEDS_CONFIRMATION hasta crecer catálogo/vocabulario.
  3. Los asientos obligatorios se generan por regla (`asientoPara`: silla-win/concerto…); el modelo real de sillería por línea no está confirmado con VH.
  4. El gate de UI (botón deshabilitado en Voni/Acomodo) está cubierto por la LÓGICA (`propuestaBloqueada`/`requiereRevision`), no por un test de render.
  5. UMBRAL_CONFIANZA_GOBERNAR=0.7 y el mapa de confianza textual son convención de Claude.
  6. Vocabulario de mobiliario del lector y params de conversión por familia: sin fuente real (DATA TRUTH).
- **Hallazgos nuevos:** los dependientes obligatorios ahora se generan identity-first por `asientoPara`; si un día el lector observa sillas Y se generan por regla, la reconciliación (`dependientesConciliados`) evita duplicar y marca OBSERVED_ONLY/GENERATED_ONLY/DIVERGE — pero la POLÍTICA de cuál gana (observado vs regla) aún no está decidida por negocio.

---

## R10 PARA AUDITORÍA CHATGPT + GROK

- **branch:** `audit/final-product-completion`
- **code SHA:** `b3da1ba` (el HEAD de la rama es el doc-commit de este CLOSEOUT encima). Base R10 = `a741ab1`.
- **docs HEAD previo auditado por ustedes:** `d7bb809`.
- **archivos tocados (R10):**
  - Nuevos: `src/datos/observedPipelineIntegracion.test.js` (13 casos de integración offline).
  - Modificados: `supabase/functions/leer-plano/observed-core.js` (+test), `supabase/functions/leer-plano/index.ts` (maxPage), `src/datos/observedProgram.js` (clamp01, UMBRAL), `src/datos/mobiliarioOntologia.js` (+test), `src/datos/programaRealDelPlano.js`, `src/componentes/Voni.jsx`, `src/datos/planoGoldenObserved132.test.js`.
- **tests:** 2125/2125 vitest (257 archivos). **vite build:** ✅. **deno check:** ✅ (leer-plano, observed-core, leer-plano-core).
- **CI status real:** GitHub SIN workflow runs (0). Toda la evidencia es LOCAL de Claude.
- **Estado por hallazgo:**
  - R10-1 unir issues del servidor — **INTEGRATION_PASS** (casos 2/3/6).
  - R10-2 PRESENT_REVIEW_REQUIRED es gate — **INTEGRATION_PASS** lógica (`requiereRevision`); UI del botón = CODE_PASS (no E2E).
  - R10-3 NEEDS_CONFIRMATION bloquea apply — **INTEGRATION_PASS** (casos 7/8 + golden).
  - R10-4 kind=room nunca mueble — **INTEGRATION_PASS** (caso 4).
  - R10-5 no inventar capacidad — **INTEGRATION_PASS** (caso 5).
  - R10-6 coherencia de capacidad — **INTEGRATION_PASS** (caso 6 + unit).
  - R10-7 identidad física → resolver por dims — **INTEGRATION_PASS** (golden + caso 7).
  - R10-8 reconciliación 1:1 — **CODE_PASS** (cada ancla resuelve independiente contra catálogo; no E2E multi-ancla con colisión real).
  - R10-9 dependientes no desaparecen — **INTEGRATION_PASS** (caso 9 + golden OBSERVED_ONLY); UI = CODE_PASS.
  - R10-10 golden dims exactas — **CODE_PASS** (MOCK_ONLY/RECORDED, no PDF vivo).
  - R10-11 umbral de confianza — **INTEGRATION_PASS** (caso 12).
  - R10-12 dedup por source_ref — **INTEGRATION_PASS** (caso 11 + unit).
  - R10-13 ontología palabra completa — **CODE_PASS** (unit adversarial).
  - R10-14 maxPage en wrapper — **NOT_VERIFIED (live)**: plumbing añadido; el core NO emite conteo de páginas, así que PAGINA_FUERA_DE_RANGO sólo se ejerce a nivel validador (unit), no en vivo.
  - R10-15 docs sin falsos verdes — **CODE_PASS** (CLOSEOUT/HANDOFF corregidos).
- **BLOCKED_EXTERNAL:** deploy de `leer-plano`/`leer-plano-core` (prod sigue v11/v4, no emiten observed_program); motor cutover; ingestión `fuentes/*.xlsx` (DATA TRUTH, incluye params de conversión por familia); merge/promote; migraciones; 33 legacy; Intelisis.
- **Supuestos NO verificados LIVE:**
  1. El modelo de visión poblará `observed_program` conforme al schema — NO probado contra PDF real; el golden es contrato GRABADO.
  2. El CATÁLOGO real NO tiene las dimensiones del ground truth QA-COT-01 (B-01 2400×1400, J-01 3200×1200, D-01 2000×900, CR-01 1200×500): en la práctica HOY casi toda ancla observada caería en NEEDS_CONFIRMATION hasta que crezcan catálogo/vocabulario. (El único RESOLVED que probé usa `rec-2420x830`, que sí existe.)
  3. `UMBRAL_CONFIANZA_GOBERNAR=0.7` y el mapa alta/.9·media/.6·baja/.4 son convención de Claude, no política firmada por VH.
  4. Los parámetros de conversión por familia (kg/m², área de hoja, largo de tramo, pz/juego) no tienen fuente real cableada (DATA TRUTH).
  5. El VOCABULARIO de mobiliario del lector NO existe; la cobertura del regex de ontología no está validada contra el universo real de etiquetas de VH.
  6. El gate de "Aplicar" en `Voni.jsx` está cubierto por la LÓGICA (`requiereRevision`), no por un test de UI/E2E que pruebe el render del botón deshabilitado.
- **Hallazgos nuevos durante la corrección:**
  - Confirmado EN VIVO (no sólo teórico) que el resolver sustituía por capacidad: 4 benches 2400×1400 → `op-8u-4800x1200-cristal`. Ahora queda NEEDS_CONFIRMATION y bloquea apply.
  - El validador del servidor (observed-core) es ahora la ÚNICA autoridad de issues; el re-validador del cliente (observedProgram.js) sólo AÑADE. Riesgo residual: si en el futuro alguien llama a `programRequirementsDesdeObservado` con items que NO pasaron por el servidor (p.ej. heurística de áreas), esos no traen issues server — hoy es aceptable porque la heurística sólo se usa en estado ABSENT.

---

## 0) R9 PARA AUDITORÍA CHATGPT (bloque de cierre de la ronda 9)

- **SHA de CÓDIGO:** `a741ab1` (rama `audit/final-product-completion`; el HEAD es el doc-commit encima). Base ronda 9 = `8811fce`.
- **Tests / build:** 2092/2092 vitest (256 archivos) · vite build ✅ · `deno check` ✅ (leer-plano, observed-core, leer-plano-core). **Evidencia LOCAL de Claude; GitHub sigue con 0 CI runs.**
- **Archivos tocados (R9):**
  - Nuevos: `src/datos/mobiliarioOntologia.js` (+test), `src/datos/conversionMaterial.js` (+test).
  - Modificados: `supabase/functions/leer-plano/observed-core.js` (+test), `supabase/functions/leer-plano-core/index.ts` (schema+prompt), `src/datos/leerPlanoArchivo.js`, `src/datos/programaRealDelPlano.js`, `src/datos/bomGenerator.js` (+test), `src/componentes/Voni.jsx`, `src/datos/programaObservadoGobierna.test.js`, `src/datos/planoGoldenObserved132.test.js`, `src/datos/planoReaderFurniture.test.js`.
- **P0 que DECLARO cerrados (R9-1…R9-10):** cliente consume observed SANEADO (no crudo); schema↔validador mismo idioma (confianza textual→número); validador fail-closed; estados ABSENT/PRESENT_VALID/PRESENT_REVIEW_REQUIRED sin fallback heurístico indebido; pendientes observados visibles en VONI; ontología ancla/dependiente (silla ≠ ancla); salas por capacidad POR UNIDAD; identidad física por ancla + reconciliación por dimensiones (NO sustitución silenciosa; 4 benches 2400×1400 → NEEDS_CONFIRMATION, verificado); golden con ground truth completo (S-01/SJ-01) + reconciliación sin duplicar; conversión POR FAMILIA (lámina kg = m²×kg/m²).
- **BLOCKED_EXTERNAL (no ejecutado; hard boundary):** desplegar `leer-plano`/`leer-plano-core` con el schema/prompt nuevo; prod sigue en leer-plano v11 / core v4 (no emiten observed_program aún); motor cutover; ingestión `fuentes/*.xlsx` (DATA TRUTH); merge/promote; migraciones prod; modificar 33 legacy; Intelisis.
- **SUPUESTOS NO verificados LIVE (explícitos):**
  1. El modelo de visión realmente poblará `observed_program` conforme al schema (kind/dims/source_ref/capacity/zone) — NO probado contra un PDF real; el golden usa un contrato GRABADO, no salida viva.
  2. Las dimensiones del ground truth QA-COT-01 (B-01 2400×1400, J-01 3200×1200, D-01 2000×900, R-01 2000×700) son las que ChatGPT citó; NO confirmadas contra el PDF original medido.
  3. El mapa confianza textual→número (alta .9/media .6/baja .4) es una convención de Claude, no una política firmada por VH.
  4. Los parámetros de conversión por familia (kg/m² de lámina, área de hoja, largo de tramo, pz/juego) vendrán del catálogo/DATA TRUTH; hoy el resolver NO los provee (por eso caen en FALTA_PARAM_CONVERSION) — no hay fuente real cableada.
  5. El VOCABULARIO de mobiliario del lector NO existe aún: roles no reconocidos (credenza/coffee/etc.) van a revisión; la cobertura del regex de ontología no está validada contra el universo real de etiquetas de VH.
  6. El `op-8u-4800x1200-cristal` que el resolver elige por capacidad es el comportamiento OBSERVADO hoy; que exista (o no) un bench canónico 2400×1400 equivalente en App LT NO está confirmado.

---

## 1) PROMPT (listo para pegarle a ChatGPT)

```
Eres el auditor independiente del proyecto Von Haucke (app React + Supabase de costeo/cotización).
Audita la rama `audit/final-product-completion`.

- Último commit de CÓDIGO: 260573a (6ª re-auditoría R15: N acción+mensaje de VONI usan la autoridad atómica + corrección de doc sobre persistencia de confirmado_modelo). Base = 985eef3.
  Verdad viva: `CLOSEOUT_STATE.md` (historial rondas 1–15 + 6 re-auditorías R15) + bloque "6ª RE-AUDITORÍA R15 — RESUELTA" arriba.
  Tests 2182/2182 (259 archivos; +3), build ✅, deno check ✅ (evidencia LOCAL; GitHub 0 CI runs). Golden/adapter = MOCK_ONLY.
- Límites que Claude respetó: NO merge, NO deploy/promote, NO migración prod, NO prod-write, NO tocar 33 legacy,
  NO aprobar DATA TRUTH, NO integrar Intelisis, **NO motor cutover, NO XLSX**. Todo capa ADITIVA (no cambia números del
  motor). El validador del edge está PREPARADO + deno-clean pero NO DESPLEGADO (prod edge = hard boundary).

Verifica contra el CÓDIGO real (no sólo el closeout) que los 2 puntos de tu 6ª re-auditoría R15 quedaron corregidos:
1. P1-R15-N: ¿VONI deriva el BOTÓN, la TARJETA y el MENSAJE de "Aplicar programa detectado" de la autoridad atómica (`resolverAplicacionAtomica` → `aplicacionPendientePrograma`/`enriquecidosPrograma`), no de `faltantesPrograma` (sólo nuevos)? Caso enrichment-only (nuevas=0, enriquecidos>0, committed=true): propuesta bloqueada + tarjeta visible + botón HABILITADO + mensaje que NO dice "0 producto(s)" + clic aplica + tras aplicar committed=false/IDEMPOTENTE y el gate desaparece.
2. Corrección de doc: ¿HANDOFF/CLOSEOUT ya dicen que `confirmado_modelo` SÍ persiste en `cotizacion.partidas` (sobrevive save/reopen; `compactarPayloadNube`/`jsonb_sin_economia` no lo eliminan) y que lo que NO existe es una confirmación durable INDEPENDIENTE de la partida? ¿Hay test de persistencia (`paraGuardar` conserva `confirmado_modelo:true`)?
3. ¿Voni y Acomodo consultan la MISMA autoridad (`resolverAplicacionAtomica`), sin lógica paralela divergente?
4. Aceptados previos que NO deben regresar: K/H3/I2/I3, L, M, G, J.
5. Revisa supuestos (ningún render UI en E2E; cadena DB de guardado/reopen = contrato leído no corrido en vivo; `patchCambios` compara por valor JSON; selector "elegir otro" pendiente; confirmado_modelo persiste en la partida pero sin confirmación durable independiente de ella) y busca NUEVOS falsos verdes.

Luego decide/recomienda prioridad para el mega-avance, sabiendo que estos bloques necesitan decisión de Rodrigo o deploy:
A. MOTOR CUTOVER: que `calcular()` tome el precio del CanonicalPriceResolver con fail-closed, preservando goldens (sólo productos nuevos).
B. INGESTIÓN de `fuentes/*.xlsx` (parser + mapeo clave_erp→canonical_id = DATA TRUTH) — incluye los parámetros de conversión por familia (kg/m², área de hoja, etc.).
C. DEPLOY del edge leer-plano (schema/prompt + validador) y el VOCABULARIO de mobiliario del lector (siguiente P0).

Devuelve: (a) qué aceptas a nivel código, (b) hallazgos nuevos con archivo:línea, (c) la decisión A/B/C y el orden óptimo.
```

---

## 2) RESUMEN RONDA 8 (sesión más reciente · código `8811fce`)

Cerré los 7 P0 de tu ronda 8, todo dentro de los límites (sin deploy/merge/prod):

- **P0-R8-1 observed_program GOBIERNA** (src/datos/programaRealDelPlano.js + src/componentes/Voni.jsx):
  `programRequirementsDesdeObservado` reduce el observed_program VALIDADO a {operativos,privados,salas,recepcion}
  — **capacity_total manda PUESTOS, no el número de muebles** (4 benches×2 = 8). Sólo lo OBSERVED sin issues gobierna;
  SUGGESTED/INFERRED → `REQUIERE_CONFIRMACION`; rol sin vocabulario → `ROLE_NO_MAPEADO` (nunca inventado).
  `proponerProgramaDesdeObservado` devuelve null si nada gobierna → Voni cae a la heurística de áreas. PROPUESTA ≠ CONFIRMACIÓN.
- **P0-R8-2 validador determinista del edge** (supabase/functions/leer-plano/observed-core.js, patrón de acomodo-core.js):
  todas las invariantes (quantity/capacity/dims/posición-en-envolvente/zona/página/confidence/evidencia-OBSERVED/
  no-derivado-de-cuarto/enums/duplicados). Cableado en index.ts: el wrapper REVALIDA y el observed_program del nivel
  superior es el revalidado, nunca el crudo de la IA. **PREPARADO, deno check ✓, NO DESPLEGADO** (prod edge = hard boundary).
- **P0-R8-4 / P0-R8-6 BOM** (src/datos/bomGenerator.js): aplica la conversión → `cantidad_compra_equivalente`
  (tablero hoja→m² golden); `costable` por línea + `estadoCosteo` COSTABLE/NO_COSTABLE (sin unidad_compra NO es costable/oficial).
- **P0-R8-3 / P0-R8-5** (cerrados al inicio de la sesión): ProductSpec certificable vía `evidenciaCertificable`
  (+FALTA_EVIDENCIA/PROCEDENCIA_NO_CERTIFICABLE); vigencia de precio fin-de-día; FX con vigencia malformada fail-closed.
- **P0-R8-7 golden QA-COT-01** (src/datos/planoGoldenObserved132.test.js): contrato GRABADO → validador edge →
  observed gobierna → ProductResolver (8 puestos/sala 8/dirección/recepción + dependientes WORK_SEAT/MEETING_SEAT;
  credenza/coffee → ROLE_NO_MAPEADO). Lectura de PDF en vivo = **BLOCKED_EXTERNAL**.

**Archivos:** nuevos — observed-core.js (+test), programaObservadoGobierna.test.js, planoGoldenObserved132.test.js;
modificados — bomGenerator.js(+test), productSpec.js(+test), canonicalPriceResolver.js(+test), fxProvenance.js(+test),
programaRealDelPlano.js, Voni.jsx, supabase/functions/leer-plano/index.ts. **Suite 2066/2066 · build ✅ · deno check ✅.**

**Hueco honesto:** el lector aún NO tiene VOCABULARIO de mobiliario (da geometría+puestos, no tipos de mueble);
por eso roles no mapeables van a revisión en vez de inventarse. Ése es el siguiente P0 (PLAN INTELLIGENCE).

---

## 3) RESUMEN DE LA SESIÓN (qué hice, qué toqué, qué cerré, bugs)

### Qué cerré (por ronda de auditoría)
- **Ronda 1 (red-team interno):** 7 P0 de estado-UI/integridad + 2 P1. Hallazgo tranquilizador: el MOTOR de costeo
  es sólido (no hay P0 que produzca un número incorrecto en el camino principal).
- **Ronda 2 (ChatGPT):** reabrió 2 P0 mal cerrados → **ambos cerrados**:
  - P0-A render stale (firma de layout real `firmaLayout` con x/y/rot por pieza; fail-closed en autosave y los 2 botones).
  - P0-B seller-safe completo (`sinEconomiaInterna` sanea piezas+partidas; guardado local saneado por rol).
  - Seguridad rebaselineada: config RLS ya cerrada en prod; 4 edges IA con verify_jwt=true.
- **Ronda 3 (ChatGPT) — falsos verdes cortados:**
  - P0-PLAN-GOLDEN: el golden "132 m²" era FALSO (18 puestos inventados) → corregido al PDF real: **8 puestos
    = 4 benches × 2**. Contrato separa **quantity (muebles)** de **capacity_total (puestos)**.
  - P0-PRICE-TRUST: un precio editado a mano ya NO hereda evidencia vieja (adapter único `resolverPrecioInsumoVivo`).
  - PRICE DATE/TRUST: `REAL_OBSERVED_DATED` vs `REAL_OBSERVED_UNDATED`; un real sin fecha no habilita costo oficial.
  - FX: MP en USD con tipoCambio sin procedencia no cuenta como evidencia real.
  - Repo hygiene: fuera el symlink `node_modules`. Seguridad `app` edge: HTML público, no P0.
- **Ronda 4 (ChatGPT) — 5 de 6 (código c744689):** #1 timeout 180 s, #4 validity→HISTORICAL, #3 room≠furniture,
  #5 conservar procedencia hasta VONI, #6 label preciso. (#2 real furniture detection = edge + deploy, pendiente.)

### Qué construí (REALITY CUTOVER + PLAN INTELLIGENCE)
- Cadena de verdad económica (pura, con tests): `precioProvenance.js`, `canonicalPriceResolver.js`,
  `intelisisPriceProvider.js` (diseño, no integrado), `precioInsumoBridge.js` (puente al catálogo REAL).
- Inventario real del catálogo (259 insumos, 11 fuentes): **166 real-fechado · 8 real-sin-fecha · 85 provisional**.
- Cableado VISIBLE y aditivo (no cambia números del motor): `Precios.jsx` (chip "¿por qué $544?") y
  `HojaCosto.jsx` (calidad del costo por procedencia).
- Plan Intelligence: contrato `observed_program.js` + cable `floorPlanReader.js` desde el lector REAL;
  conservación de procedencia en `leerPlanoArchivo.js` hasta VONI.

### Archivos tocados (33; +2275 −66)
Nuevos (16): precioProvenance.js, canonicalPriceResolver.js, intelisisPriceProvider.js, precioInsumoBridge.js,
observedProgram.js, floorPlanReader.js (+ sus .test.js); finalCompletion.test.js, sellerSafeState.test.js,
preciosProcedencia.test.js, hojaCostoProcedencia.test.js, leerPlanoTimeout.test.js, leerPlanoProvenance.test.js.
Modificados (clave): motor `calculo.js` (único cambio de motor: guard fail-closed de costo fantasma),
`acomodoHash.js` (firmaLayout), `App.jsx`+`almacen.js` (seller-safe), `AcomodoBase.jsx`/`Cotizacion.jsx`/
`AsistenteEspecial.jsx` (P0 de estado/render), `Precios.jsx`/`HojaCosto.jsx` (provenance UI),
`leerPlanoArchivo.js` (timeout + conservar procedencia), `.gitignore` (node_modules).

### Verificación (honesta) — NOTA: cifras HISTÓRICAS de esa ronda; el estado ACTUAL está en el bloque R11 arriba
- **(histórico de esa ronda) 1939/1939 tests** (vitest) · build ✅. El conteo ACTUAL es 2132/2132 (ver bloque R11).
- La app ARRANCA autenticada como Dirección (sesión de Rodrigo; sólo lectura, sin tocar su WIP de $54,851).
- BLOCKED_EXTERNAL: E2E autenticado (necesita cuenta de PRUEBA), verificación en vivo de edges (deploy).
- No hay corrida de CI independiente en GitHub (0 workflows): toda la evidencia es LOCAL de Claude.

### Decisiones que necesito de Rodrigo (bloquean el avance grande)
A. **Motor cutover** (que el resolver gobierne `calcular()`): toca motor congelado + 33 legacy → requiere OK + alcance.
B. **Ingestión de `.xlsx` reales**: requiere agregar parser (dependencia) + aprobar mapeo clave_erp→canonical_id (DATA TRUTH).
C. **#2 detección de mobiliario en la edge** `leer-plano`: trabajo de edge (visión) + deploy para verificar.

---

## 3) SESIÓN AUTÓNOMA RC (hasta 8b89a5b) — qué se añadió

Siguiendo el mandato de Release Candidate (deadline lunes 12-oct), trabajé autónomo SIN salirme de los límites
(sin merge/deploy/migración/prod-write/legacy/DATA TRUTH/Intelisis). Cerrado y pusheado:

- **P0 estrictos (ChatGPT §3)**: P0-C room→furniture (mueble implicado por un cuarto = INFERRED, no OBSERVED);
  P0-B adversarial de vigencia (malformed/future/expired+verified/expired+newer-real); P0-A stale-guard de
  lectura de plano (una lectura lenta superada por otra NO pisa el archivo nuevo).
- **Shadow motor cutover (§8)**: `shadowCutover.js` compara legacy vs canónico → 259/259 iguales, 0 diferencias
  numéricas HOY (`sinDiferenciaNumericaActual`, NO "cutover seguro" permanente); 93 bloquearían costo oficial por
  procedencia. (El cutover numérico es no-op hoy; cobra sentido con la serie xlsx.)
- **Product Intelligence (§5-6)**: `productSpec.js` (material/espesor ausente→PENDING, dimensión en conflicto→CONFLICT)
  + `bomGenerator.js` (sin material canónico o sin regla de merma → PENDING; nunca merma mágica).
- **Golden Reality (§13)**: `goldenReality.js` clasifica diferencias humano-vs-app por causa (no cuadra artificialmente).
- **FX provenance (§9)**: `fxProvenance.js` (FX con fuente/fecha/estado; FX viejo/sin valor no habilita costo oficial).
- **Ruta de fabricación / horas-hombre (§10)**: `rutaFabricacion.js` (sin tiempo/tarifa → PENDING; no se inventan minutos).
- **Cross-flow invariants (§25)**: test que protege "una sola realidad".
- **Red-team adversarial interno**: un subagente atacó los 8 módulos nuevos; encontró y CERRÉ bugs reales —
  HIGH merma fuera de rango se tragaba; MEDIUM fechaDeFuenteTexto fabricaba fechas de folios; + 4 LOW
  (num(null/whitespace)→0, sort NaN, hoy inválido, "Invalid Date", espesor 0). Todos con regresión.

**Naturaleza**: todo lo anterior son CONTRATOS/RESOLVERS/HARNESSES puros y testeados (CODE_PASS), capa ADITIVA
que NO cambia los números del motor. Lo que falta para que "trabajen de verdad" es el wiring que requiere tu
decisión (A/B/C arriba) o deploy. Audita buscando NUEVOS falsos verdes.
