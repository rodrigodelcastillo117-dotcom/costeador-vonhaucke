# HANDOFF PARA AUDITORÍA DE CHATGPT

> Documento para que ChatGPT audite rápido y nos ayude a avanzar mejor.
> La VERDAD viva y completa está en `CLOSEOUT_STATE.md`. Esto es el resumen de la sesión + el prompt.

---

## 1) PROMPT (listo para pegarle a ChatGPT)

```
Eres el auditor independiente del proyecto Von Haucke (app React + Supabase de costeo/cotización).
Audita la rama `audit/final-product-completion`.

- Último commit de CÓDIGO: 37fc330 (sesión autónoma RC, 2 rondas red-team). Base: e5f737f. Tip: usa `git rev-parse HEAD`.
- Diff a revisar: `git diff e5f737f..HEAD`. Verdad viva: `CLOSEOUT_STATE.md`. Tests 2017/2017, build ✅, smoke E2E 3/3.
- Límites que Claude respetó: NO merge, NO deploy, NO migración, NO prod-write, NO tocar 33 cotizaciones legacy,
  NO aprobar DATA TRUTH, NO integrar Intelisis. Todo son capas ADITIVAS (no cambian números del motor), salvo
  un único guard fail-closed en el motor (costo fantasma por falta de medida).

Verifica contra el código real (no sólo el closeout):
1. Los 5 hallazgos de tu ronda 4 quedaron bien cerrados:
   #1 timeout de lectura de plano (ahora 180 s > 64.841 s observado),
   #4 validity vencida → HISTORICAL + bloquea costo oficial,
   #3 room≠furniture (campo `kind`, conteo separado cuartos/muebles),
   #5 leerPlanoDeArchivo conserva lectura/floorSpec/request_id/observed_program,
   #6 HojaCosto dice "Precios de MP con evidencia real (consumo/MO/GI sin verificar)", no "costo con evidencia real".
2. Que la provenance de precio sea correcta y no sobre-reclame (REAL_OBSERVED_DATED/UNDATED, PROVISIONAL, PENDING).
3. Busca NUEVOS falsos verdes o huecos de confianza.

Luego decide y recomienda prioridad para ir MÁS RÁPIDO, sabiendo que estos 3 bloques necesitan decisión de Rodrigo
o un deploy (no los puede cerrar Claude solo):
A. MOTOR CUTOVER: que `calcular()` tome el precio del CanonicalPriceResolver con fail-closed, preservando goldens.
   ¿Lo autorizamos? ¿Alcance sólo productos nuevos, o también legacy?
B. INGESTIÓN DOCUMENTAL real de `fuentes/*.xlsx`: requiere un parser de xlsx (dependencia) + aprobar el mapeo
   clave_erp→canonical_id (DATA TRUTH). ¿Lo autorizamos?
C. #2 PLAN INTELLIGENCE real: que la edge `leer-plano` DETECTE mobiliario (no sólo estime puestos por área).
   Es trabajo de edge (prompt de visión) + deploy para verificar. ¿Procedemos?

Devuelve: (a) qué aceptas a nivel código, (b) hallazgos nuevos con archivo:línea, (c) la decisión A/B/C y el orden
óptimo para el mega-avance.
```

---

## 2) RESUMEN DE LA SESIÓN (qué hice, qué toqué, qué cerré, bugs)

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
