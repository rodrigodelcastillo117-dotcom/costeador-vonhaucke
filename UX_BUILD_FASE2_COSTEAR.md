# UX_BUILD · FASE 2 — COSTEAR (pilot) · estado y plan de construcción

Rama `claude/costing-app-architecture-psf02g`. Build del flujo COSTEAR "simple afuera,
riguroso adentro", **detrás del flag `costear_simple`** (default `false` → riesgo cero en
producción). Aterrizado en el código real; sin tocar motor/economía/gates.

## Hecho y VERIFICADO offline (sin IA)
- **`src/datos/estadoHumano.js`** — módulo puro: 147 estados crudos → `{frase, color, continuar}`.
  Fiel a `UX_LANGUAGE_MAP.md`. **29/29 tests** (`estadoHumano.test.js`). Es la capa de
  "lenguaje humano" para los 3 flujos. (commit `05fab97`)
- **Flag `costear_simple`** declarado en `src/datos/flags.js` (BASE `false`) + descripción;
  **test** en `flags.test.js` (default false, override por `?ff=costear_simple` y `vh_flags`).
- **`npm run build` OK** y **`npm test` verde** con ambos integrados — el modo avanzado de
  hoy queda idéntico (nada alcanzable mientras el flag está apagado).

## Hallazgo clave del código (ancla el enfoque)
`AsistenteEspecial.jsx` (entry primario de COSTEAR, ruteado en `App.jsx:1455`, gated `veCostos`)
**YA es un flujo de 4 pasos** (`N_PASOS=4`): PASO1 Identidad (:1038) · PASO2 Piezas (:1094) ·
PASO3 Mano de obra (:1384) · PASO4 Resultado (:1413). Mapea 1:1 a Empezar → Esto entendí →
Decisiones → Resultado. **No se reescribe.** La máquina de estados (`paso`, `b`, los ~30
useState) y TODOS los handlers del motor son closures internas que se reusan tal cual.

Trampa evitada: `EstoEntendi.jsx`/`EmpezarEspacio.jsx` son de COTIZAR, no de COSTEAR — no se
tocan para este pilot pese a que sus nombres coincidan con los pasos del doc.

## Enfoque de menor riesgo (decidido): prop `modo` en AsistenteEspecial
Añadir `modo='avanzado'` a la firma (`AsistenteEspecial.jsx:94`); cada bloque de presentación
en ramas `modo==='simple' ? <nuevo> : <exacto de hoy>`. **Cero duplicación de lógica**
(mismo `b`, mismos handlers de motor), default preserva hoy byte-a-byte, superficie de
regresión acotada. Se descartó un `CostearSimple.jsx` orquestador (forzaría reimplementar
handlers no exportados = duplicar lógica fail-closed) y el reskin puro (la ingeniería está
interleaved dentro del body de cada paso).

Handlers del motor/servidor que el modo simple REUSA (NO reimplementar): `analizarDescripcion`
→ `analizarTexto` (nube.js:311); `analizarYLlenar`/`analizarImagenes` → `analizarRender`/
`analizarRenderImagenes` + `verificarDespiece`; `aplicarRespuestas` → `responderDespiece`
(nube.js:341); sombra/certificación → `costearServidor` (nube.js:558); `aprobarPrecio`
(nube.js:527); `generarRenders` → `generarRender` (nube.js:468); `guardarEnBiblioteca` →
`guardarExpediente*` (nube.js:665); handoff → `onVerDetalle(b)` → Costeador. Gates
autoritativos server-side intactos: `onAgregarCotizacion`/`partidaAutoritativaDeCosteo`
(`datos/agregarCosteo.js`), `verificarEmisionViva` (`datos/emisionViva.js`), `evaluarEmision`
(nube.js:817). **Un centavo de diferencia = fail-closed, sin cambios.**

## Pasos restantes (en orden de menor a mayor riesgo)
1. **Paso 2 — `modo` en `AsistenteEspecial.jsx`** (aditivo, default avanzado): re-etiquetar
   los 4 pasos y el stepper (:1014) con `estadoHumano`, 1 CTA primario por paso
   (P2 **Costear**, P4 **Guardar**/handoff), secundarios a "Más opciones", y envolver los
   paneles de ingeniería de PASO4 (:1511-1640: estructura-Voni, render-spec, BOM, confianza,
   aprobación de precio) en `<details>Ver ingeniería</details>`. Conservar el banner
   "SIMULADOR — NO OFICIAL/Alba V1" y las alertas fail-closed ("sin precio autorizado").
2. **Paso 3 — cablear el flag en `App.jsx:1456`**: `modo={flagActivo('costear_simple') ? 'simple' : 'avanzado'}`
   (sin tocar `veCostos` ni el fallback de vendedor; `flagActivo` ya está importado).
3. **Paso 4 (opcional)** — mismo patrón `modo` en `Costeador.jsx` para el handoff/Resultado avanzado.
4. **Paso 5 — tests de paridad `uxParity-cost-*`** (presencia de CTA/estado en modo simple;
   lógica pura o sobre `estadoHumano`, sin depender de render — el repo no tiene testing-library).
5. **Paso 6 — verificación VIVA (IA-gated, fuera de CI)**: con `?ff=costear_simple` y la app
   viva, smoke de los 4 pasos, E2E persona-nueva y screenshots. Confirmar que el motor/servidor
   responden idéntico.

## El límite honesto de esta sesión
Lo construido (módulo + flag) está **verificado de verdad**: build + unit tests verdes.
El **Paso 2 (la UI del modo simple en un componente de ~1,650 líneas) NO se puede verificar
offline** — el repo no tiene render-tests de componentes y aquí no corre la app viva (auth +
Supabase + IA). Construirlo a ciegas produciría un diff grande cuyo "se ve bien" nadie
comprobó. Por eso se detiene en la base verificada + este plan: el Paso 2 se construye y se
valida **con la app viva** (el smoke IA-gated), donde se ve que los 4 pasos no pierden ninguna
de las 98 funciones COSTEAR del inventario. Riesgo contenido: el flag está apagado, así que
nada de esto afecta producción hasta el smoke.
