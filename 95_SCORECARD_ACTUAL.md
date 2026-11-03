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
| 1 | **INICIO** | **Parcial (3 entradas IA probadas)** | las 3 entradas de interpretación probadas en vivo opus-5: texto→despiece, plano→floorSpec, foto→despiece (`95_TEXTO/PLANO/FOTO_*_OPUS5.md`) | ruteo UI de subida (navegador) + E2E completo foto→cotización |
| 2 | **COSTEAR** | **Medido (alto) + foto→despiece probado** | BLN-09 cerrado; 4008 tests verde; paridad cliente=servidor; merma D2; fail-closed. **foto real → despiece 17 piezas** (opus-5, `95_FOTO_A_DESPIECE_OPUS5.md`): producto/materiales/herrajes correctos, honesto en incertidumbre | costo OFICIAL requiere confirmación humana de medidas + materiales (la IA ya las pide) |
| 3 | **COTIZAR** | **Medido (E2E navegador)** | ciclo completo en vivo con vendedor real: crear→persistir(DB 4869)→reabrir→PDF→borrar; cuadre al centavo ($1,650→IVA 16%→TOTAL $2,162.82 = DB); partida y PDF seller-safe; limpieza verificada. Ver `95_COTIZAR_E2E_NAVEGADOR.md` | Configurador/variantes; 24 proyectos; por plano (opus-5) |
| 4 | **COCREAR** | **Parcial (interpretación IA probada)** | opus-5 real: brief §3 → despiece 18 piezas (dims/materiales/roles correctos), seller-safe por pieza; `95_TEXTO_A_DESPIECE_OPUS5.md` | 8 casos completos diseño→cambios→expediente→reabrir→COSTEAR (más opus-5 presupuestado) |
| 5 | ACOMODO | **Medido (validador independiente)** | 9 acomodos reales: 6 PASS/2 REVIEW/1 FAIL; el estado del sistema concuerda 3/3 con el validador independiente (no esconde la colisión) | proyectos nuevos con geometría difícil (columnas/pasillos/puertas) + root-cause de la colisión 4859 |
| 6 | RENDERS | **Parcial (1 render revisado)** | render pv1934 inspeccionado: tipo/material/cajones/cargador PASS; cotas rotuladas REVIEW (alto 0.70 vs 0.75). C2PA presente | fidelidad a escala (N renders) — método a costo cero existe; renders complejos piden más revisión |
| 7 | **VONI** | **Medido (15 casos)** | 12 previos + 3 R2 (fuera-dominio ASK, geometría contradictoria BLOCK, cambio económico ilegal BLOCK); los 3 `execution:PROPOSAL_ONLY` — nunca ejecuta. `95_VONI_R2_ADVERSARIAL.md` | ~15 más (foto/plano piden opus-5); referencias revisadas por humano |
| 8 | **INSUMOS/ERP/PRECIOS** | **Medido (integridad + P0-03 cerrado)** | B6 frescura server-side; fail-closed PENDING/AMBIGUOUS; conteos en vivo (10,185 activos, 42 puentes propuestos/0 aprobados); **P0-03 resuelto por datos: 1,763/1,763 re-firmados por humano, 0 precios vivos confían en cuenta no humana** (`95_P8_INSUMOS_P0-03_RESUELTO.md`) | aprobar 42 puentes (clic humano); revisión de contenido cifra-por-cifra (proceso Dirección) |
| 9 | CATÁLOGO/PRODUCTOS | **Parcial (selector vivo)** | selector del vendedor en vivo: "Eclipse" → 24 productos con clave ERP (EDBAS1120M…) y precio de venta; "Agregar" crea partida cotizable | claves duplicadas (#77) + cotizabilidad de versión |
| 10 | ARCHIVO/REABRIR | **Parcial (reabrir verificado)** | reabrir en vivo demostrado 2× (vendedor abre su 4869; Dirección abre propuesta) → read-back renderiza con partidas/cliente/folio | modificar→revisión→re-guardar en vivo |
| 11 | **PDF/EMISIÓN** | **Medido (PDF en vivo)** | PDF de propuesta generado en navegador (jsPDF, 7 pág): 0 léxico de costo, solo precios de venta; borrador lleva marca de agua BORRADOR·NO REGISTRADO; gate `evaluar_emision_cotizacion` server-side (SEG-01). Ver `95_PDF_EMISION_NAVEGADOR.md` | emisión OFICIAL E2E (requiere autorizar emitir en prod) |
| 12 | **SEGURIDAD** | **Medido (pentest vivo 14/14)** | pentest en vivo con cuenta rol vendedor: costos/precios/piso/cotizaciones ajenas/escritura/aprobaciones todo BLOQUEADO; VONI y costear devuelven precio, no costo | auditoría históricos qa-direccion (P0-03); rotar contraseña QA |
| 13 | **MOBILE** | **Medido (smoke)** | iPhone 13 (390px) ambos roles: 0 overflow horizontal, 0 tap-targets <32px, Cotizar abre sin overflow, 0 errores de consola. Ver `95_MOBILE_SMOKE_NAVEGADOR.md` | E2E completo en móvil (subir foto/cámara, cotización completa + PDF) — necesita opus-5 + pasada dedicada |
| 14 | **RELEASE/INFRA** | **Medido (alto)** | deploy prod en vivo `d19557d` verificado; manifiesto; rollback; 4008 tests; build verde | — (BLN-09 pendiente de su propio deploy) |

## Lectura honesta
- **Fresco y fuerte en R3:** COSTEAR (perfil lineal/BLN-09), INSUMOS/ERP (frescura B6), RELEASE/INFRA, y
  parcialmente SEGURIDAD y PDF/EMISIÓN (gate server-side verificado).
- **MOBILE ya no está SIN MEDIR:** smoke en iPhone 13 (ambos roles) PASA; ver `95_MOBILE_SMOKE_NAVEGADOR.md`. Falta E2E
  completo en móvil (foto/cámara + cotización + PDF), que necesita opus-5 + pasada dedicada.
- **CERTIFICADO vivo en R3:** SEGURIDAD seller-safe — pentest con cuenta rol vendedor, 14/14 vectores bloqueados; ver `95_SEGURIDAD_EMISION_QA.md`. Asesor Supabase (16 SECURITY DEFINER + 8 RLS-sin-policy) = 0 vulns, `95_SEGURIDAD_SUPABASE_QA.md`.
- **SELLER-SAFE EN UI (navegador R3):** Playwright vivo contra prod 2b78f57 — el vendedor no tiene ruta a Costear/Materiales/Dirección/ERP y su DOM no contiene léxico de costo (home + 3 pantallas de datos); diff de menú por rol. Ver `95_SELLERSAFE_UI_NAVEGADOR.md`. (Cierra el hueco "UI renderizada" que la cert por API no cubría.)
- **RENDIMIENTO medido R3:** P0.COSTEO latencia p50 ~1.5 s, p95 <1.8 s en caliente, PLANA de 1→50 componentes, 0 errores/60 llamadas; SLO propuesto. Ver `95_P0COSTEO_LATENCIA.md`.
- **P0-03 CERRADO en R3 (hallazgo material):** el blocker "1,763 aprobados por qa-direccion" ya no existe: rastro de auditoría
  muestra 1,763/1,763 re-firmados por el humano Dirección, 0 precios vivos confían en cuenta no humana. Ver `95_P8_INSUMOS_P0-03_RESUELTO.md`.
- **COTIZAR a escala (§5):** 5 partidas en vivo, UI→DB→PDF cuadran al centavo ($23,174.94), seller-safe por partida y en PDF;
  ver `95_COTIZAR_ESCALA.md`. Pendiente: estrés de paginación PDF a 30/50.
- **P0.COSTEO concurrencia (§12):** fail-closed CERRADO bajo carga (0 costos falsos en 36 llamadas, 1 fallida incluida);
  SLO de latencia concurrente SIN MEDIR-pleno (confundido por el túnel único del contenedor — requiere staging). Ver `95_P0COSTEO_CONCURRENCIA.md`.
- **MEJORA AUTÓNOMA (FASE 17):** herrajes→compra-venta implementada y probada (4008 verde); ver `95_MEJORAS_AUTONOMAS.md`.
- **Parcial nuevo en R3:** RENDERS — 2 renders inspeccionados a costo cero (conceptual PASS, cotas REVIEW); ver
  `95_ACOMODO_RENDER_QA.md`. VONI — benchmark adversarial de 5 casos (4/5), ver `95_VONI_BENCHMARK.md`.
  Ambos con evidencia fresca; faltan la escala (N renders / 30 casos VONI con referencias humanas) para "medido pleno".
- **NO RE-VERIF R3 (hay evidencia previa, no refrescada esta ronda):** INICIO, COCREAR. (CATÁLOGO y ARCHIVO ya
  refrescados parcialmente esta ronda vía el E2E de Cotizar de línea: selector vivo y reabrir verificado.)
  (COTIZAR y ACOMODO ya refrescados esta ronda; COCREAR: su validación-IA está probada vía VONI benchmark
  —casos de fabricabilidad/contradicción/material— y su persistencia es análoga a COTIZAR; falta su
  interpretación fresca con IA, que corre en analizar-mueble/opus-5, presupuesto diferido por Dirección.)

## Veredicto de madurez (honesto, 1–10 de "listo para 95 comprobable en las 14")
**6/10.** El núcleo económico (motor, frescura, emisión, seller-safe por datos) está sólido y fail-closed, y
producción está en vivo y con rollback. Pero 4 áreas están SIN MEDIR por falta de presupuesto de API/cuentas
y 6 no se refrescaron esta ronda. Un 95 *en cada una de las 14* exige: (a) presupuesto explícito de Gemini/
renders, (b) crear `qa-ventas`, (c) una pasada E2E dedicada de 24 proyectos. No es alcanzable en una sola
sesión sin esos tres insumos.
