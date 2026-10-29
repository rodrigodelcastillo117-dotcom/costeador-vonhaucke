# 95_SCORECARD — matriz de áreas (meta ≥95/100 REAL por área)

**Fecha de corte:** 2026-10-29 · Base: `95_AUDIT_BASELINE.md` (prod `fece6c3`, rama `d031cff`).
**Regla:** el score no se manipula. `SIN MEDIR` = no se ha ejercitado la app corriendo; **no es un número**.
Un área sólo sube de `SIN MEDIR` a un número cuando hay evidencia E2E (navegador/preview) o prueba real.

Leyenda columnas: **Dato/Código/UX/E2E/ProdVerif** = ✅ verificado · ⚠️ parcial · ❌ falta · `—` no aplica aún.

| # | Área | Score | P0 | P1 | P2 | Dato | Código | UX | E2E | ProdVerif | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | INICIO | ~80 (prov.) | — | — | — | — | ✅ | ⚠️ | ⚠️ | — | E2E barrido: Home+pantallas sin crash para diseño y vendedor (seller-safe) ✅; sweep dirección timeout (inconcluso). Mobile/UX profundo SIN MEDIR. |
| 2 | COSTEAR | SIN MEDIR | sí | — | — | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | Motor avanzado sólo en `-rc`; prod=v17. Puente clave→insumo 0 aprobado. |
| 3 | COTIZAR | ~80 (prov.) | sí | — | — | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | E2E cotizarProyectos verde contra `-rc` vivo. cotizar-texto (mock) pendiente local. |
| 4 | COCREAR | ~80 (prov.) | — | — | — | — | ✅ | ✅ | ⚠️ | ✅ | E2E cocrearExpediente verde contra `-rc` vivo. cocrear10 (mock) pendiente local. |
| 5 | ACOMODO | ~82 (prov.) | sí | — | — | — | ✅ | ✅ | ✅ | ✅ | E2E acomodoP02 (verify-first, edge+hashes) y acomodoVeredicto verdes contra `-rc` vivo. |
| 6 | RENDERS | ~80 (prov.) | — | — | — | — | ✅ | ✅ | ✅ | ✅ | E2E renderEscenas verde contra `-rc` vivo (identidad/estados). |
| 7 | VONI | SIN MEDIR | — | — | — | — | ⚠️ | ❌ | ❌ | ❌ | voni-council v14 vivo; council real SIN MEDIR. |
| 8 | INSUMOS/ERP/PRECIOS | ~70 (prov.) | — | sí | — | ✅ | ✅ | ❌ | ❌ | ⚠️ | 10,185 activos; 30% CERT / 70% PRELIM; autoridad server-side ✅. UX SIN MEDIR. |
| 9 | CATÁLOGO/PRODUCTOS | ~72 (prov.) | — | sí | — | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | E2E costeadorCatalogo (selección/buscador) verde (local). Legacy grande + migración canónica pendiente bajan el score. |
| 10 | ARCHIVO/REABRIR | ~82 (prov.) | — | sí | — | ✅ | ✅ | ✅ | ✅ | ✅ | E2E persistencia (misma fila/identidad, rechazo nube, reabrir) + concurrenciaOptimista verdes (local). Falta reabrir con render real. |
| 11 | PDF/EMISIÓN | ~89 (prov.) | — | sí | — | ✅ | ✅ | ✅ | ✅ | ✅ | Gate server-side verificado + E2E emision (cliente, estados) verde (local). Nunca TOTAL falso, identidad ligada, sin bypass. |
| 12 | SEGURIDAD | ~90 (prov.) | — | sí | — | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | Autoridad server-side ✅; seller-safe ✅; RLS money/propiedad auditada: sin IDOR a nivel tabla ✅. Falta prueba viva 2-JWT + RPC cotizaciones_mias. |
| 13 | MOBILE | SIN MEDIR | — | — | sí | — | — | ❌ | ❌ | ❌ | No probado en viewport real. |
| 14 | RELEASE/INFRA | ~60 (prov.) | sí | — | — | ✅ | ⚠️ | — | ❌ | ⚠️ | Prod corre edges viejos; `-rc` no promovido. Falta RELEASE_MANIFEST + mapa fn→edge→hash. |

## Scores provisionales — justificación (sólo donde hay evidencia dura)
- **INSUMOS ~70:** datos y autoridad verificados reales; baja por 70% PRELIMINAR y 0 mapeos aprobados y UX/E2E sin medir. No es 95.
- **SEGURIDAD ~85:** lo verificado está bien hecho (autoridad server-side, seller-safe, RLS default-deny). No llega a 95 hasta probar BOLA/IDOR por objeto y emisión server-side en E2E real.
- **RELEASE ~60:** el tema de fondo (prod ≠ RC) y la falta de manifiesto fn→edge→versión→hash lo mantienen lejos de 95.
- Las 12 restantes: **SIN MEDIR**. No pongo número sin E2E. Darles 90 "porque el código se ve bien" sería exactamente lo que la orden prohíbe.

## Resultado P0 seguridad + pruebas (2026-10-29, verificado)
- **Suite completa: 406 archivos, 3,994 pruebas, TODAS verdes** (exit 0, 197s), tras quitar 3 worktrees
  duplicados de `.claude/worktrees` que inflaban el conteo y la corrida. CI de prod/rama también verde.
- **Auditoría RLS BOLA/IDOR (tablas dinero/propiedad):**
  - `cotizaciones` SELECT = `puede_editar_config()` (rol direccion/diseno) **AND** aislamiento qa
    (RESTRICTIVE). El vendedor **no** lee la tabla cruda; usa la RPC segura sin economía. **Sin IDOR.**
  - `producto_version_economia` = `puede_ver_economia()` = **solo direccion**. Diseño NO ve costos.
  - `insumo_precios` / `expediente_revisiones` = gateadas por rol. `renders` = acotada al dueño.
  - `cocrear_costeo_servidor` / `costeos_servidor` / `partida_costeo_vigente` = RLS deny-all (solo servidor). Correcto.
  - **No se encontró hueco abierto.** Pendiente para 95 pleno: prueba viva 2-JWT por REST + acotamiento
    por dueño dentro de `cotizaciones_mias`.

## Resultado P0 emisión (2026-10-29, verificado leyendo `private_api.evaluar_emision_cotizacion`)
Recalcula todo server-side desde la cotización guardada; NO confía en la economía del cliente.
- Costo desconocido/preliminar/no certificado ⇒ `ECONOMICS_INCOMPLETE` (nunca TOTAL falso ni $0).
- Renglón del snapshot debe SER lo costeado (identidad + `campos_partida_no_corresponden`) ⇒ si no, `BLOCKED`.
- Precio especial recalculado y autoritativo (rechaza `precio_especial_no_autoritativo` si el cliente lo cambió).
- Bajo costo / margen < mínimo / reventa sin piso ⇒ `APPROVAL_REQUIRED`.
- Wrapper `public.emitir_revision_v2` sólo valida sesión y delega al núcleo SECURITY DEFINER ⇒ sin bypass del cliente.
- Respaldado por `seguridadGateEmisionSnapshot.test.js` (55 pruebas, incluye prueba de rollback que reintroduce el defecto).
- **Pendiente 95 pleno:** E2E de que la UI muestre "TOTAL INCOMPLETO" (no un total) ante `ECONOMICS_INCOMPLETE`.

## Resultado E2E barato (2026-10-29, barridoPantallas contra nube falsa — sin IA/escritura)
Barrido por rol: clic a cada botón del Inicio, verifica que ninguna pantalla "se atoró" ni lanza excepción JS.
- **diseño: 13 pantallas, 0 problemas** ✅
- **vendedor (seller-safe): 11 pantallas, 0 problemas** ✅
- **dirección: timeout a los 12 min tras 1 pantalla** ⚠️ — NO fue una pantalla atorada (render ok, "Mis cotizaciones");
  el barrido se trabó en el 2º botón. Inconcluso: fragilidad del harness (`nth(i)` + re-navegación) vs un
  cuelgue de pantalla sólo-dirección. **No se confirma bug ni se declara verde.** Pendiente: re-run con trace.
- UX: existe capa de humanización (`src/datos/emisionUX.js`, `estadoHumano.js`); mensajes de error en español
  humano (no códigos crudos en pantalla). Los códigos de gate (BLOCKED/APPROVAL_REQUIRED) sólo se usan como
  lógica en JSX, no se pintan al usuario.
- **Toolchain:** el navegador de Playwright del repo (1.64.1 → build 1248) no estaba; se instaló vía proxy.
  Sin eso, cualquier E2E local fallaba por lanzamiento de navegador (no por la app).

## Resultado E2E con IA sobre preview-RC (2026-10-29, autorizado por Dirección)
41 pruebas, 2 workers, 8 min, contra `costeador-vonhaucke-ogz9c6w75-…` (SHA ea31d459, CARRIL_RC → edges `-rc`).
**39 pasaron, 2 fallaron.** Clasificación honesta de los specs corridos:
- **Backend-real (6, TODOS verdes contra el `-rc` vivo):** auth (INICIO auth), cotizarProyectos (COTIZAR),
  cocrearExpediente (COCREAR), acomodoP02 + acomodoVeredicto (ACOMODO, verify-first con edge y hashes),
  renderEscenas (RENDERS). → certifican esos flujos contra el motor real.
- **Nube-falsa (6) — NO debían correr contra preview (error de selección mío):** cotizarTexto, cocrear10,
  lecturaPlano, emision, costeadorCatalogo, persistencia. Usan `crearNubeFalsa` + intercept de un host mock
  que no aplica al backend real. Los 2 fallos (lecturaPlano nivel-2: PNG 1×1 al `leer-plano-rc` real → 0 áreas;
  persistencia-rechazo: el intercept no dispara contra el host real) son **artefactos de esa mezcla, NO bugs**
  (ambos pasan en CI local). Se re-corren LOCALMENTE (gratis, el mock sí aplica) para certificar la lógica cliente.

## Resultado E2E local (nube falsa, 2026-10-29) — GRATIS, sin IA ni escrituras
7 specs, **38 pruebas, 0 fallos, exit 0.** Donde el mock SÍ aplica, los flujos pasan:
- cotizarTexto (COTIZAR texto→propuesta), cocrear10 (COCREAR), lecturaPlano (lectura de plano + compuerta
  de niveles), emision (estados de emisión en cliente), costeadorCatalogo (selección/buscador ERP),
  persistencia (misma fila/identidad, rechazo de nube, reabrir), concurrenciaOptimista.
- **Confirma** que los 2 fallos del preview-RC fueron el desajuste mock-vs-backend-real (no bugs): aquí pasan.

## Tabla de scores tras E2E (honesta, provisional — E2E certifica que el flujo CORRE, no que llega a 95 pleno)
| Área | Score | Evidencia dura |
|---|---|---|
| SEGURIDAD | ~90 | RLS/IDOR sin hueco, autoridad server-side, seller-safe (verificado en código/DB). |
| PDF/EMISIÓN | ~89 | Gate server-side + E2E cliente verde. |
| ACOMODO | ~82 | E2E verify-first contra `-rc` vivo (edge + hashes) verde. |
| ARCHIVO | ~82 | E2E persistencia/identidad/concurrencia verde. |
| INICIO | ~80 | Barrido diseño/vendedor limpio + auth real verde; dirección sweep inconcluso. |
| COTIZAR | ~80 | cotizarProyectos (real `-rc`) + cotizarTexto (local) verdes. |
| COCREAR | ~80 | cocrearExpediente (real `-rc`) + cocrear10 (local) verdes. |
| RENDERS | ~80 | renderEscenas (real `-rc`) verde. |
| CATÁLOGO | ~72 | costeadorCatalogo verde; deuda legacy. |
| INSUMOS/ERP | ~70 | Datos+autoridad OK; 70% preliminar, 0 puentes aprobados. |
| COSTEAR | ~65 | Motor reproduce al centavo (golden TELCEL) pero cobertura de datos por mueble nuevo es el cuello (TELSVH120 25/29, 0 aprobado). Pipeline profundo texto→costo real contra `-rc` aún sin E2E. |
| VONI | SIN MEDIR | Sólo health; council real sin E2E. |
| RELEASE | ~60 | Prod corre edges viejos; `-rc` no promovido (B1). |
| MOBILE | SIN MEDIR | Sin E2E de viewport móvil. |

Promedio NO es la meta (la orden pide ≥95 por pestaña). Hoy **ninguna llega a 95**; las más altas (~90) son
seguridad y emisión. Los topes reales: datos (COSTEAR/INSUMOS), release (prod≠RC), y lo no medido (VONI, MOBILE).

## Orden de ataque (FASE 2→6 de la orden)
1. **FASE 0/1 (hecho):** baseline + scorecard reales.
2. **Medición real primero:** levantar preview de esta rama (CARRIL_RC) + correr suite de pruebas + leer CI. Convierte 12 `SIN MEDIR` en números con evidencia.
3. **P0 (datos/seguridad/emisión/cálculo):** puente clave→insumo; paridad prod-edge vs `-rc`; BOLA/IDOR; emisión "TOTAL INCOMPLETO".
4. **P1 (flows rotos):** limbo texto→plano (COTIZAR), reabrir/concurrencia, acomodo paridad, mesa redonda (PR #82).
5. **FASE 4 datos canónicos / FASE 5 UX / FASE 6 certificación.**
6. **95_RELEASE_MANIFEST.md + 95_BLOCKERS.md** (lo que requiera decisión humana, separado).

**Decisión de Dirección que condiciona el objetivo (no la tomo yo):** ¿el "95 en producción" se certifica
promoviendo los edges `-rc` a prod (con su certificación, §100), o se mide sobre un preview-RC equivalente?
Hasta esa decisión, mido sobre preview-RC y dejo el release listo, sin deploy productivo.
