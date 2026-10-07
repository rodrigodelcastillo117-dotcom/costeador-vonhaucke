# REPORTE_NOCHE · P0.2b + auditorías read-only
Fecha: 2026-10-07 · Rama de trabajo: `claude/perfection-final-20261006` = `release/p0.2-recovery-20261007` · SHA `b8fd709`
Evidencia: **BANCO LOCAL · CÓDIGO REAL** (no es edge desplegado, no es “certificado en producción”).
Nota de alcance: lo hecho aquí es desarrollo + **revisión de código** (no una auditoría independiente). La **prueba independiente con casos externos la corre otra sesión**; `READY TO ACTIVATE` sólo es válido si esa prueba **no encuentra ningún PASS falso**. Si encuentra uno, se corrige dentro de A–G y **no se toca el juez**.

## Para Rodrigo (5 líneas, sin términos técnicos)
1. **Qué quedó funcionando:** el acomodador nuevo coloca TODO en su lugar (sillas pegadas a su escritorio, nada suelto) en los 55 casos de prueba (49 que sí caben + 6 imposibles), incluidos 10 difíciles y 2 hechos con tus planos reales.
2. **Qué mejoró:** antes el acomodo soltaba las sillas lejos de su mueble; ahora cada silla queda con su escritorio, y cuando algo no cabe te dice EN ESPAÑOL qué no cupo, por qué, y 2–3 cosas que puedes hacer.
3. **Qué sigue fallando:** nada en el acomodador. En las pruebas automáticas de la app quedan 3 focos rojos ajenos a esto (2 son una prueba desactualizada de botones, 1 necesita la llave de IA en el servidor).
4. **Si se puede avanzar:** sí, el motor pasó todas las pruebas; falta tu permiso para “encenderlo” en el servidor (yo no lo toqué).
5. **Qué decides tú:** si autorizas desplegar el motor nuevo (función `acomodar-espacio-recovery`) para probarlo ya contra el servidor real. Hasta que digas, todo se queda igual.

---

## A · ESTADO P0.2b
**CLOSED en BANCO LOCAL · CÓDIGO REAL** (los 8 criterios de salida se cumplen con el juez y los casos CONGELADOS). **NO** probado contra el edge desplegado. El deploy del edge requiere tu autorización escrita; hasta entonces producción se queda con el edge viejo.

- Pendientes que exigía el mandato para poder cerrar — TODOS hechos:
  1. **G · mensaje al vendedor (endurecido):** ✅ `opciones.js` con opciones **auto-verificadas por simulación** (el texto corresponde EXACTO a la transformación: quitar N exactas / mover a 2ª área real / mesa más chica / estación de N puestos), m² del **área real** del kit que falló, resultado verificado por opción ("cabe completa 1 de 4"), máximo 3, y mensaje claro "no encontré una forma…" cuando ninguna opción sirve. Propagado **end-to-end**: edge → `solve` adapter → `resolverAcomodo` → `plan.mensaje_vendedor` → `formatearMensajeVendedor` → tarjeta **siempre visible** (fuera de modo manual). Tests: `acomodoMensajeVendedor.test.js` (integración) + `e2e/acomodoMensajeVendedor.e2e.js` (navegador, mock, PARTIAL en flujo normal) + banco criterio 4.
  2. **Planos reales en el repo:** ✅ 2 casos derivados de planos versionados (ver B/§provenance); PDF crudos de cliente → **FUENTE_FALTANTE** (declarado).
  3. **10 casos difíciles congelados:** ✅ `bench/acomodo/casos-dificiles.js`.
  4. **Banco completo en CI con link:** ✅ run **37607705529** (`b8fd709`) — ver §C-8.

### Congelado (baseline, hashes sha256 slice-16)
- Juez neutral `bench/acomodo/judge.js` = `50714aecd8da73dd` — **sin cambios vs a010038** (verificado con `git diff`).
- Casos originales `bench/acomodo/casos.js` = `24a0bd13b44d7879` — **sin cambios vs a010038**.
- Motor nuevo `kit-solver.js` = `6927de44055af6c7` · Motor viejo v9 `acomodo-core.js` = `177eeac42b21c4e5`.
- Nuevos (congelados en este commit): `casos-dificiles.js` = `1cba0a358b3e6c05` · `planos-reales.js` = `16457a1ee70a0b4a` · `opciones.js` = `e3d0033e18f36aa2`.

### Cambios al juez/fixtures hechos tras ver resultados (obligatorio documentarlos)
1. **`colocadasBien` exige attachment (hecho en sesión previa, ya en a010038).**
   - Antes: contaba “bien” toda pieza físicamente válida (dentro, sin solape), ignorando si la silla estaba junto a su ancla.
   - Después: `colocadasBien = colocadas − (fallas físicas ∪ fallas relacionales)`; una silla a >1200 mm de su ancla (o sin dueño) NO cuenta como bien.
   - Por qué corrige una definición incorrecta (no favorece al nuevo): el defecto que el banco debe exponer es justamente la silla desprendida; una silla lejos de su escritorio no está “bien colocada” por ningún estándar real. La regla se aplica IGUAL a v9 y al nuevo (misma función, `ATTACH_MM=1200`). Efecto medido: con la métrica físico-solo, `regresiones=5` (v9 ganaba apiñando en imposibles); con attachment, la comparación es real.
2. **Capacidad de recepción en el SOLVER (no en el juez): `ANCHOR_RECEPTION → max(1, round(w/800))`.** Antes 0 → la silla de visita quedaba sin dueño → “25 exactas” fallaba. Es un hueco de catálogo del solver, no una relajación del juez.
3. **v9 juzgado con dueño inferido por GRUPO FUNCIONAL real (hecho hoy, en el harness `banco.test.js`, NO en el juez).**
   - Problema: el juez mide attachment por `anchor_instance_id`, que v9 no emite → v9 salía penalizado por carecer de metadata nueva (el mandato lo prohíbe).
   - Arreglo: antes de juzgar a v9, a cada silla se le asigna como dueño el ancla COLOCADA de su MISMO `functional_group_id` (que v9 sí recibe). Si el ancla de su grupo no se colocó, la silla queda huérfana (realidad espacial correcta).
   - Por qué es correcto y no favorece al nuevo: acredita a v9 cada silla que mantenga junto a SU propio escritorio; es más justo con v9, no menos. (Un intento intermedio por “ancla más cercana” inflaba a v9 adoptando sillas huérfanas de otro grupo que casualmente caían a <1200 mm; se descartó por incorrecto.) Efecto: `regresiones` se mantiene en **0** con la comparación justa.
4. **Geometría de los witness de casos difíciles (hoy, archivo NUEVO `casos-dificiles.js`).** Tras construirlos, el juez CONGELADO rechazó 5 witness (espaciado <999 mm entre kits = pasillo, y esquinas exactamente sobre el polígono). Corregí MI construcción (espaciado ≥1000, insets de esquina) hasta que el juez SIN CAMBIOS los valida PASS. No se tocó el juez; se corrigió el generador.

**JUDGE_DISPUTE:** ninguno abierto. (Durante el análisis se evaluó si `colocadasBien` debía penalizar el pasillo angosto por-pieza; se concluyó que NO hay disputa real: con el dueño por grupo funcional, el caso “pasillo imposible” queda 9/18 en ambos motores, sin regresión.)

---

## B · TABLA V9 vs NUEVO (BANCO LOCAL · CÓDIGO REAL, juez neutral congelado)
`bien/tot (status)` por el juez. `unidas-a-ancla` = dependientes unidos a SU ancla.

| CASO | fact | NUEVO | V9 | unidas (nuevo) | occ |
|---|---|---|---|---|---|
| multi-zona | F | **16/16 PASS** | 4/16 FAIL | 16/16 | |
| APP LT + WIN + gavetas | F | **18/18 PASS** | 8/18 FAIL | 18/18 | |
| privado | F | **2/2 PASS** | 2/2 PASS | 2/2 | |
| juntas 10 | F | **11/11 PASS** | 9/11 FAIL | 11/11 | |
| puerta | F | **9/9 PASS** | 5/9 FAIL | 9/9 | |
| columna | F | **9/9 PASS** | 5/9 FAIL | 9/9 | |
| 25 exactas | F | **25/25 PASS** | 7/25 FAIL | 25/25 | |
| imposible (área minúscula) | I | 0/9 PARTIAL | 0/9 FAIL | 0/9 | |
| imp · área < bench | I | 0/9 PARTIAL | 0/9 FAIL | — | |
| imp · puerta tapa todo | I | 0/9 PARTIAL | 0/9 FAIL | — | |
| imp · obstáculo central | I | 0/9 PARTIAL | 0/9 FAIL | — | |
| imp · franja sin altura | I | 0/9 PARTIAL | 0/9 FAIL | — | |
| imp · pasillo imposible (2 benches) | I | 9/18 PARTIAL | 9/18 FAIL | 9/18 | |
| dif01 · L-shape 3 workstations | F | **21/21 PASS** | 8/21 FAIL | 21/21 | 0.34 |
| dif02 · T-shape 2 ws + juntas | F | **21/21 PASS** | 14/21 FAIL | 21/21 | 0.33 |
| dif03 · 2 puertas opuestas | F | **18/18 PASS** | 16/18 FAIL | 18/18 | 0.45 |
| dif04 · 2 columnas | F | **18/18 PASS** | 11/18 FAIL | 18/18 | 0.40 |
| dif05 · ocupación alta 2×cap6 | F | **26/26 PASS** | 14/26 FAIL | 26/26 | **0.78** |
| dif06 · zonas adyacentes distintas | F | **16/16 PASS** | 9/16 FAIL | 16/16 | |
| dif07 · L + puerta + columna | F | **16/16 PASS** | 9/16 FAIL | 16/16 | 0.30 |
| dif08 · 4 workstations 2×2 | F | **36/36 PASS** | 17/36 FAIL | 36/36 | **0.72** |
| dif09 · U-shape 3 privados | F | **6/6 PASS** | 6/6 FAIL | 6/6 | 0.14 |
| dif10 · juntas10 + 2 puertas | F | **11/11 PASS** | 9/11 FAIL | 11/11 | 0.18 |
| real01 · QA-COT-01 132 m² | F | **32/32 PASS** | 11/32 FAIL | 32/32 | |
| real02 · plano Rodrigo (zonas reales) | F | **25/25 PASS** | 10/25 FAIL | 25/25 | |
| +30 generados factibles | F | **30/30 PASS** | mayoría FAIL | 100% | |

**Resumen:** `falsosPASS=0 · factPASS=49/49 (100%) · impSinPASS=6/6 · regresiones=0 · p50=0ms · p95=1ms · maxMs=2ms`. unidas-a-ancla = 100% en todo PASS. v9 nunca supera al nuevo en `colocadasBien` (criterio 7 ✓).

### Provenance de planos reales (regla de planos reales)
| caso | archivo | ruta | hash git |
|---|---|---|---|
| real01 | planoGolden132.test.js | `src/datos/planoGolden132.test.js` | `7577ab48af2790522ff076632ea2fe9f117d2143` |
| real02 | planoDeRodrigo.test.js | `src/datos/planoDeRodrigo.test.js` | `6d08e3eff01072e37c151babc4add30d2b7a3fca` |

Derivan la **geometría REAL de zonas** (envolvente/bbox + 1 puerta real en real01); el programa de mobiliario es REPRESENTATIVO y cabe en cada zona (no es reconstrucción exacta del conteo del plano). **FUENTE_FALTANTE:** no hay PDF/imagen de plano real de cliente versionado que entre por el pipeline `leer-plano` (sólo `e2e/fixtures/two-page.pdf` genérico y copias en `scratchpad/` NO versionadas). No se sustituyó por sintéticos.

---

## C · CRITERIOS 1–8 (PASS/FAIL con evidencia)
Evidencia: BANCO LOCAL (`bench/acomodo/banco.test.js`, 11 its) + CI run 37607705529.

1. **PASS falsos = 0** — ✅ `falsosPASS=0` en los 55 casos (49 factibles + 6 imposibles).
2. **Factibles ≥95% PASS; los 8 nombrados 100%** — ✅ `factPASS=49/49 (100%)`; los 8 al 100%.
3. **Dependientes unidos a su ancla = 100% en todo PASS** — ✅ `desprendidas=0, sinDueño=0` en todo PASS.
4. **Imposibles/PARTIAL: 0 falso PASS + faltantes + motivo causal + ≥1 opción que SIMULADA mejora** — ✅ 6/6 imposibles sin PASS; cada uno con pendientes, motivo causal (sin “faltan m²” salvo cuando el limitante es superficie) y ≥1 opción que, re-resuelta por el solver, mejora/resuelve.
5. **Determinismo: 3 corridas byte a byte (sin telemetría)** — ✅ (25 casos, canónico idéntico).
6. **p95 ≤ 2000 ms** — ✅ `p95=1ms, max=2ms`.
7. **Cero regresión vs v9 (colocadasBien nuevo ≥ v9 por caso, juez congelado)** — ✅ `regresiones=0` con v9 juzgado por grupo funcional real (ver A§3).
8. **Unit + build verdes + Gate I/J + acomodoP02 (good & lying mock) + link CI** — ✅ confirmado en CI (ver §C-8).

### C-8 · CI (CONFIRMADO)
Run: https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/actions/runs/37607705529 (`b8fd709`).
- **`verify` = success** (unit 1625 + build + BANCO). BANCO en CI: `FREEZE juez=50714aec casos=24a0bd13 dificiles=1cba0a35 reales=16457a1e opciones=e3d0033e` · `falsosPASS=0 factPASS=49/49 impSinPASS=6/6 regresiones=0 p50=0 p95=7ms maxMs=39ms`.
- **Gate I (programaP01), Gate J (programaBriefWriter), acomodoP02 (good+lying): verdes** (0 fallos de esos specs en la corrida).
- **`E2E` = failure SÓLO** por los 3 focos de §G (`auth.e2e.js:96/:123`, `live-ai-smoke.e2e.js:6`), ajenos a P0.2b.

---

## D · READY TO ACTIVATE RECOVERY EDGE (sólo si lo autorizas)
- SHA exacto: `b8fd709` · ramas: `claude/perfection-final-20261006` = `release/p0.2-recovery-20261007`.
- Hashes congelados: kit-solver `6927de44` · v9 `177eeac4` · juez `50714aec` · casos `24a0bd13`.
- Archivos modificados/nuevos: `bench/acomodo/{casos-dificiles,planos-reales}.js` (nuevos), `bench/acomodo/banco.test.js`, `supabase/functions/acomodar-espacio-recovery/{opciones.js (nuevo),index.ts,recoverySource.test.js}`, `src/datos/mensajeAcomodo.js (+test)`, `src/datos/acomodoMensajeVendedor.test.js` (nuevo, integración G), `src/componentes/AcomodoBase.jsx`, `e2e/acomodoMensajeVendedor.e2e.js` (nuevo, navegador mock). **kit-solver, juez y casos NO tocados.**
- Cero migraciones (ningún SQL, ninguna tabla, ningún RLS tocado).
- **Rollback:** el edge recovery desplegado sigue siendo el viejo (v4); activar = `supabase functions deploy acomodar-espacio-recovery --project-ref mtuvnbgljwbsaizjjgzs`; revertir = re-desplegar el commit anterior del edge. El cliente `nube.js` ya invoca `acomodar-espacio-recovery` (no se repuntó nada).
- **La evidencia es BANCO LOCAL · CÓDIGO REAL; NO prueba todavía el edge desplegado.** La prueba contra el edge desplegado ocurre sólo DESPUÉS de tu autorización. **NO DEPLOY.**

---

## E · AUDITORÍA READ-ONLY P0.3 · PLANOS (máx 5 gaps)
Arquitectura: hay DOS caminos de lectura y DOS “verdades” de FloorSpec que no coinciden (edge `leer-plano` emite `FLOOR_SPEC_V2`; el cliente arma sus áreas desde el `lectura` crudo con `planoLeido.js::areasDeLectura`, no desde el FloorSpec validado).

- **P0-A · El validador FloorSpec VIVO (edge) no tiene pruebas de comportamiento.** `leer-plano/index.ts:149-290` (compuerta fail-closed) sólo cubierto por parse-smoke y grep de strings. Una regresión de tolerancia/puerta/envolvente se publica en silencio.
- **P0-B · El validador FloorSpec PROBADO está MUERTO y diverge del vivo.** `src/datos/floorSpec.js::validarFloorSpec` sólo lo importa su test; espera otro shape (`height_mm`, `zones[].polygon`) que el edge no emite. Cobertura falsa.
- **P0-C · Ningún golden ejercita la lectura real archivo→lectura ni multi-página.** Todos los “goldens” son objetos `lectura` a mano; el único binario (`two-page.pdf`, 890 B) sólo se usa en `auth.e2e.js`, no entra al pipeline.
- **P0-D · Model id `claude-opus-5` sin verificar en `leer-plano-core/index.ts:134`.** Si no resuelve en la cuenta, TODA lectura real devuelve UPSTREAM error. Verificar antes de cualquier demo. (Requiere cuenta — no verificable desde el repo.)
- **P0-E · La app consume geometría NO validada; el edge valida un artefacto distinto al que se usa.** El edge valida `normalizedZones`; la app acomoda sobre `areasDeLectura` (algoritmo paralelo). `leerPlanoArchivo.js` (Voni) ni recoge `floorSpec`. Se valida una cosa y se acomoda otra.

---

## F · PROMPT DE CIERRE P0.3 (borrador, NO implementar)
**Alcance CONGELADO:** `supabase/functions/leer-plano{,-core}/index.ts`, `src/datos/{planoLeido,floorSpec,leerPlanoArchivo,programaDelPlano,programaRealDelPlano}.js`, y el cableado en `AcomodoBase::procesarPlano` + `Voni.jsx`. NO tocar motor de acomodo/costeo ni P0.1/P0.2 (Gate I/J verdes). Sin deploy/merge/migraciones.
**Criterios medibles (DoD):**
1. Extraer el validador del edge a módulo puro y cubrirlo: por cada código (INVALID_ENVELOPE, GRID_ENVELOPE_MISMATCH, TOP_LEVEL_AREA_EXCEEDS_ENVELOPE, INVALID_DOOR, DOOR_OUTSIDE_ENVELOPE, INVALID_DOOR_SWING_EVIDENCE, NO_AREAS, DUPLICATE_ZONE_NAME, UNKNOWN_PARENT_ZONE) ≥1 caso FAIL y afirmar PASS/REVIEW_REQUIRED/FAIL sobre un `lectura` de entrada.
2. Una sola fuente de verdad del FloorSpec: o el edge usa `floorSpec.js`, o se borra el muerto. Cero validadores sin importador en prod.
3. Una sola derivación de geometría consumida por la app, o prueba de equivalencia `edge.normalizedZones ↔ areasDeLectura` (área/zona en tolerancia, misma cuenta de puertas/obstáculos). Voni/`leerPlanoArchivo` deben propagar `floorSpec.validation.state`.
4. Verificar/parametrizar el model id de `leer-plano-core` contra un modelo desplegado (evidencia de 200 real).
**Goldens requeridos:** ≥2 archivos reales en `e2e/fixtures/` (PDF con cotas 1 pág + PDF multi-página) con su `lectura` y FloorSpec esperados congelados; golden de flujo COMPLETO archivo→programa→acomodo; caso multi-página sin duplicar zonas.
**Evidencia al cerrar:** suite nueva verde + diff de cobertura del validador vivo + prueba de equivalencia + log de `leer-plano` 200 real + Gate I/J/P0.1/P0.2 intactos.

---

## G · DIAGNÓSTICO DE LOS 3 E2E ROJOS (read-only, NO arreglados)
CI run previo 37582673046 (13 PASS / 3 FAIL en el job E2E). Corrección a mi reporte anterior: **son 3 fallos (incluyendo live-ai-smoke), no 2.**

| spec | línea | error | clasificación | causa raíz probable | arreglo mínimo (NO aplicado) |
|---|---|---|---|---|---|
| `auth.e2e.js:96` | click :98 | timeout 30s esperando `getByRole('button',{name:/Proyecto actual/i})` | **fixture/test incorrecto** | el botón “Proyecto actual” quedó dentro de un `<details class="inicio-op-mas">` colapsado (`Inicio.jsx:237`); existe en el DOM pero no visible. El test no expande la sección. El CTA visible es `data-testid="home-retomar"`. | expandir `details.inicio-op-mas > summary` antes del click, o apuntar a `home-retomar`. |
| `auth.e2e.js:123` | click :126 | mismo timeout mismo locator | **fixture/test incorrecto** | idéntico a :96 (mismo botón colapsado); el guard de proyecto vacío está DESPUÉS del click obligatorio. | igual que :96. |
| `live-ai-smoke.e2e.js:6` | :33 | `toBeVisible` falla (100s) en `/¿De qué está hecho\?/i` | **dependencia externa** (con componente de timeout) | la UI sólo avanza a paso 1 si el edge real `analizar-mueble` responde; requiere `ANTHROPIC_API_KEY` en el servidor (`analizar-mueble/index.ts:126-127`). En `!res.ok` se queda en paso 0. Frontend corre local; la única variable externa es el edge. | sacarlo del lane público bloqueante (correr sólo con `RUN_LIVE_AI=1`/creds), o apuntar a stub con key garantizada. |

**Importante:** los 2 de `auth` NO son el bloqueador “P0.8 / falta cuenta de prueba” que yo había supuesto — el CI tenía `TEST_EMAIL/PASSWORD`, el login funcionó y pasaron 6 tests autenticados. Son **selector desactualizado**. Sólo `live-ai` es dependencia externa real (P0.7).

---

## H · MAPA DE RAMAS (read-only)
- **PRODUCCIÓN:** main de config = `c3.4-seller-safe`; origin tip `47ae515`. Local `c3.4-seller-safe` = `dc126fa` (**2 atrás** de origin — no es base de prod segura sin pull). SHA desplegado en Vercel: **NO VERIFICABLE** desde git (requiere Vercel). Prod corre el edge VIEJO `acomodar-espacio`.
- **TRABAJO ACTUAL:** `claude/perfection-final-20261006` @ `b8fd709`.
- **RELEASE:** `release/p0.2-recovery-20261007` @ `b8fd709` (idéntica al trabajo).
- **RECOVERY EDGE DESPLEGADO:** fuente tag `dc20b15` (confirmado en git); etiqueta “v4”/hash `f23ef80…7028c` son identificadores de Supabase, **NO VERIFICABLES** desde el repo.
- **Stale/limpieza:** cluster `origin/chatgpt/*` (perfection v2–v7, pioneer-ai v1–v3, spatial-pdf, ~11 ramas), `claude/dazzling-agnesi-8e3800` (7 semanas), `main` legacy. Candidatos a limpieza (NO borrados).

---

## I · PRÓXIMA ACCIÓN RECOMENDADA
1. **Tú decides:** autorizar (o no) el deploy del edge `acomodar-espacio-recovery` para pasar de BANCO LOCAL a prueba contra el edge desplegado. Yo no lo despliego sin tu “sí” por escrito.
2. Si autorizas: desplegar → re-añadir el E2E real contra el edge nuevo → repuntar con verify-first. Si no: todo se queda en BANCO LOCAL, prod intacto.
3. Independiente: cerrar P0.3 con el prompt de §F (los 2 E2E de `auth` son arreglo de selector de 1 línea; `live-ai` sacarlo del lane bloqueante).

**PARO aquí.** No inicio P0.3/P0.7/P0.8. No deploy, no merge, no migraciones, no producción.
