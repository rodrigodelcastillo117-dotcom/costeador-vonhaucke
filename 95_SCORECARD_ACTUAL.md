# 95_SCORECARD_ACTUAL — matriz honesta de 14 áreas (Ronda 3, 2026-10-31)

Regla: número SOLO con evidencia citable de ESTA ronda. Donde la evidencia es de rondas previas y no se
re-verificó en R3, se marca **NO RE-VERIF R3** (no se cuenta como 95 fresco). Donde falta evidencia
indispensable (API de pago, cuenta QA, navegador), se marca **SIN MEDIR**. No se promedia una pestaña
deficiente con otra. **No se declara un 95 global.**

Dimensiones (directivo): Funcionalidad 25 · Exactitud técnico-económica 25 · Seguridad/integridad 15 ·
UX 15 · Rendimiento/estabilidad 10 · E2E/regresión 10 = 100.

## Resumen por área
| # | Área | Estado R3 | Evidencia fresca R3 | Qué falta para 95 comprobable |
|---|---|---|---|---|
| 1 | INICIO | NO RE-VERIF R3 | — | E2E de subida foto/PDF/texto + ruteo, en vivo |
| 2 | **COSTEAR** | **Medido (alto)** | BLN-09 cerrado; 4008 tests verde; paridad cliente=servidor; merma D2; fail-closed | foto→costo E2E con Gemini real (reusa BLN-07); confirmación de materiales (humano) |
| 3 | COTIZAR | **Parcial (núcleo vivo)** | crear→reabrir→gate(ALLOWED)→borrar en vivo; raw-insert bloqueado (42501); seller-safe sobre cotización | revisión+aprobación+PDF (navegador); ciclo 1→50 partidas |
| 4 | COCREAR | NO RE-VERIF R3 | — | 8 casos diseño→validación→expediente→reabrir→COSTEAR |
| 5 | ACOMODO | NO RE-VERIF R3 | — | validador geométrico independiente + colisiones/pasillos/columnas |
| 6 | RENDERS | **Parcial (1 render revisado)** | render pv1934 inspeccionado: tipo/material/cajones/cargador PASS; cotas rotuladas REVIEW (alto 0.70 vs 0.75). C2PA presente | fidelidad a escala (N renders) — método a costo cero existe; renders complejos piden más revisión |
| 7 | VONI | **Medido (12 casos, 11/12)** | benchmark adversarial vivo: abstención, matemática espacial/geométrica, política de descuento, no-inventar-costo, disciplina de dominio PASS; 1 caso sobre-prudente | ~18 casos más (foto/plano) + referencias revisadas por humano; seller-safe vivo (qa-ventas) |
| 8 | **INSUMOS/ERP/PRECIOS** | **Medido (integridad)** | B6 frescura verificada server-side; 4 nociones distinguidas; fail-closed PENDING/AMBIGUOUS | P0-03: auditoría de los ~1,763 aprobados históricos por qa-direccion (decisión Dirección) |
| 9 | CATÁLOGO/PRODUCTOS | NO RE-VERIF R3 | — | claves duplicadas (#77) + cotizabilidad de versión |
| 10 | ARCHIVO/REABRIR | NO RE-VERIF R3 | — | guardar→reabrir→modificar→revisión en vivo |
| 11 | PDF/EMISIÓN | Parcial (gate verificado) | gate `evaluar_emision_cotizacion` existe server-side; no confía en economía cliente (SEG-01) | emisión PDF autorizada E2E en entorno de prueba |
| 12 | **SEGURIDAD** | **Medido (pentest vivo 14/14)** | pentest en vivo con cuenta rol vendedor: costos/precios/piso/cotizaciones ajenas/escritura/aprobaciones todo BLOQUEADO; VONI y costear devuelven precio, no costo | auditoría históricos qa-direccion (P0-03); rotar contraseña QA |
| 13 | MOBILE | **SIN MEDIR** | — | tareas completas en móvil/tablet por los 3 roles (navegador) |
| 14 | **RELEASE/INFRA** | **Medido (alto)** | deploy prod en vivo `d19557d` verificado; manifiesto; rollback; 4008 tests; build verde | — (BLN-09 pendiente de su propio deploy) |

## Lectura honesta
- **Fresco y fuerte en R3:** COSTEAR (perfil lineal/BLN-09), INSUMOS/ERP (frescura B6), RELEASE/INFRA, y
  parcialmente SEGURIDAD y PDF/EMISIÓN (gate server-side verificado).
- **SIN MEDIR en R3 (requiere navegador):** MOBILE. No invento su calificación.
- **CERTIFICADO vivo en R3:** SEGURIDAD seller-safe — pentest con cuenta rol vendedor, 14/14 vectores bloqueados; ver `95_SEGURIDAD_EMISION_QA.md`.
- **Parcial nuevo en R3:** RENDERS — 2 renders inspeccionados a costo cero (conceptual PASS, cotas REVIEW); ver
  `95_ACOMODO_RENDER_QA.md`. VONI — benchmark adversarial de 5 casos (4/5), ver `95_VONI_BENCHMARK.md`.
  Ambos con evidencia fresca; faltan la escala (N renders / 30 casos VONI con referencias humanas) para "medido pleno".
- **NO RE-VERIF R3 (hay evidencia previa, no refrescada esta ronda):** INICIO, COCREAR, ACOMODO,
  CATÁLOGO, ARCHIVO. Su evidencia vive en rondas anteriores (V2/V3/10-10); para un 95 *comprobable* de R3
  hay que correrlas de nuevo con datos aislados. (COTIZAR ya refrescado parcial esta ronda.)

## Veredicto de madurez (honesto, 1–10 de "listo para 95 comprobable en las 14")
**6/10.** El núcleo económico (motor, frescura, emisión, seller-safe por datos) está sólido y fail-closed, y
producción está en vivo y con rollback. Pero 4 áreas están SIN MEDIR por falta de presupuesto de API/cuentas
y 6 no se refrescaron esta ronda. Un 95 *en cada una de las 14* exige: (a) presupuesto explícito de Gemini/
renders, (b) crear `qa-ventas`, (c) una pasada E2E dedicada de 24 proyectos. No es alcanzable en una sola
sesión sin esos tres insumos.
