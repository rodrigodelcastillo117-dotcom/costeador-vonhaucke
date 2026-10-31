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
| 3 | COTIZAR | NO RE-VERIF R3 | — | ciclo completo 1→50 partidas + reabrir + revisión + PDF, con qa-ventas |
| 4 | COCREAR | NO RE-VERIF R3 | — | 8 casos diseño→validación→expediente→reabrir→COSTEAR |
| 5 | ACOMODO | NO RE-VERIF R3 | — | validador geométrico independiente + colisiones/pasillos/columnas |
| 6 | RENDERS | **SIN MEDIR (fidelidad)** | — | fidelidad industrial (puertas/cajones/proporción) — requiere API de pago |
| 7 | VONI | **SIN MEDIR** | — | benchmark ≥30 casos vs referencia revisada — requiere API de pago |
| 8 | **INSUMOS/ERP/PRECIOS** | **Medido (integridad)** | B6 frescura verificada server-side; 4 nociones distinguidas; fail-closed PENDING/AMBIGUOUS | P0-03: auditoría de los ~1,763 aprobados históricos por qa-direccion (decisión Dirección) |
| 9 | CATÁLOGO/PRODUCTOS | NO RE-VERIF R3 | — | claves duplicadas (#77) + cotizabilidad de versión |
| 10 | ARCHIVO/REABRIR | NO RE-VERIF R3 | — | guardar→reabrir→modificar→revisión en vivo |
| 11 | PDF/EMISIÓN | Parcial (gate verificado) | gate `evaluar_emision_cotizacion` existe server-side; no confía en economía cliente (SEG-01) | emisión PDF autorizada E2E en entorno de prueba |
| 12 | **SEGURIDAD** | **Medido parcial** | seller-safe por DATO (jsonb_sin_economia/partidas_vendedor/guardia costo); qa-direccion no-humana | pentest vivo 10 ataques — BLOQUEADO (falta qa-ventas) |
| 13 | MOBILE | **SIN MEDIR** | — | tareas completas en móvil/tablet por los 3 roles (navegador) |
| 14 | **RELEASE/INFRA** | **Medido (alto)** | deploy prod en vivo `d19557d` verificado; manifiesto; rollback; 4008 tests; build verde | — (BLN-09 pendiente de su propio deploy) |

## Lectura honesta
- **Fresco y fuerte en R3:** COSTEAR (perfil lineal/BLN-09), INSUMOS/ERP (frescura B6), RELEASE/INFRA, y
  parcialmente SEGURIDAD y PDF/EMISIÓN (gate server-side verificado).
- **SIN MEDIR en R3 (requieren presupuesto de API de pago o cuenta QA o navegador):** VONI (benchmark 30),
  RENDERS (fidelidad), MOBILE, y el pentest vivo de SEGURIDAD. No invento su calificación.
- **NO RE-VERIF R3 (hay evidencia previa, no refrescada esta ronda):** INICIO, COTIZAR, COCREAR, ACOMODO,
  CATÁLOGO, ARCHIVO. Su evidencia vive en rondas anteriores (V2/V3/10-10); para un 95 *comprobable* de R3
  hay que correrlas de nuevo con datos aislados.

## Veredicto de madurez (honesto, 1–10 de "listo para 95 comprobable en las 14")
**6/10.** El núcleo económico (motor, frescura, emisión, seller-safe por datos) está sólido y fail-closed, y
producción está en vivo y con rollback. Pero 4 áreas están SIN MEDIR por falta de presupuesto de API/cuentas
y 6 no se refrescaron esta ronda. Un 95 *en cada una de las 14* exige: (a) presupuesto explícito de Gemini/
renders, (b) crear `qa-ventas`, (c) una pasada E2E dedicada de 24 proyectos. No es alcanzable en una sola
sesión sin esos tres insumos.
