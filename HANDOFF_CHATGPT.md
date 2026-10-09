# HANDOFF PARA AUDITORÍA DE CHATGPT

> Documento para que ChatGPT audite rápido y nos ayude a avanzar mejor.
> La VERDAD viva y completa está en `CLOSEOUT_STATE.md`. Esto es el resumen de la sesión + el prompt.

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

- Último commit de CÓDIGO: a741ab1 (ronda 9: bugs de INTEGRACIÓN observed→validador→resolver→golden). Base R9 = 8811fce.
  Verdad viva: `CLOSEOUT_STATE.md` (historial completo rondas 1–9) + bloque "0) R9 PARA AUDITORÍA CHATGPT" en este archivo.
  Tests 2092/2092 (256 archivos), build ✅, deno check ✅ (evidencia local; GitHub 0 CI runs).
- Límites que Claude respetó: NO merge, NO deploy/promote, NO migración prod, NO prod-write, NO tocar 33 legacy,
  NO aprobar DATA TRUTH, NO integrar Intelisis. Todo capa ADITIVA (no cambia números del motor). El validador del
  edge está PREPARADO + deno-clean pero NO DESPLEGADO (prod edge = hard boundary).

Verifica contra el CÓDIGO real (no sólo el closeout) que los 7 P0 de tu ronda 8 quedaron bien cerrados:
1. P0-R9-1 AUTORIDAD: `src/datos/leerPlanoArchivo.js` consume `r.observed_program`/`r.floorSpec.observed_program`
   (saneado server-side), NO `lec.observed_program` crudo. ¿Alguna ruta sigue leyendo el crudo para gobernar?
2. P0-R9-2/3 schema↔validador: `leer-plano-core` emite kind/source_ref/plan_tag/grouping/capacity_total; `observed-core.js`
   mapea confianza textual→número y es fail-closed (quantity entero>0, confidence∈[0,1]→ISSUE no clamp, kind/dims/orientation inválidos→ISSUE).
3. P0-R9-4/5 estados: ¿`Voni.jsx` NO reconstruye desde áreas cuando observed_state es PRESENT_*? ¿muestra observadoPendientes + anclas NEEDS_CONFIRMATION?
4. P0-R9-6/7 ontología (`src/datos/mobiliarioOntologia.js`): ¿una silla NUNCA es ancla? ¿salas por capacidad POR UNIDAD?
5. P0-R9-8 anti-sustitución (`conciliarAnclasObservadas`): el bench 2400×1400 → NEEDS_CONFIRMATION cuando el resolver
   elige 4800×1200. ¿Hay forma de que un ancla observada quede RESOLVED con geometría distinta? (no debería)
6. P0-R9-9 golden (`src/datos/planoGoldenObserved132.test.js`): ground truth completo (incluye S-01/SJ-01); reconciliación
   de dependientes sin duplicar. ¿El golden mide el DOCUMENTO o hace trampa con el resolver?
7. P0-R9-10 conversión por familia (`src/datos/conversionMaterial.js`): lámina kg=m²×kg/m² (×), tablero/perfil/herraje (÷);
   falta de parámetro → NO costable. ¿Alguna familia usa una división genérica equivocada?
8. Revisa los SUPUESTOS NO verificados live (sección 0) y dime cuáles son riesgo real para la demo.
9. Busca NUEVOS falsos verdes o huecos de integración.

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

### Verificación (honesta)
- **1939/1939 tests** (vitest) · **build ✅**. Verificado 2026-10-09.
- La app ARRANCA autenticada como Dirección (sesión de Rodrigo; sólo lectura, sin tocar su WIP de $54,851).
- BLOCKED_EXTERNAL: E2E autenticado (necesita cuenta de PRUEBA), verificación en vivo de edges (deploy).
- No hay corrida de CI independiente de este SHA: los 1939 son locales de Claude.

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
- **Shadow motor cutover (§8)**: `shadowCutover.js` compara legacy vs canónico → 259/259 iguales, 0 diferencias →
  SEGURO; 93 bloquearían costo oficial por procedencia. (El cutover numérico es no-op hoy; cobra sentido con la serie xlsx.)
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
