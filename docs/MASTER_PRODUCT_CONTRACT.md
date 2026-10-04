# MASTER_PRODUCT_CONTRACT — Von Haucke Product OS (FUENTE CANÓNICA)
Fusiona: Prompt Maestro (204 secciones) + ENMIENDA Tier-1 + ADDENDUM 001 + decisiones verificadas en repo.
Regla de gobernanza: **ningún requisito importante vive solo en el chat.** Toda instrucción nueva se integra
aquí y en `REQUIREMENTS_MATRIX.md` ANTES de implementar. Cuando el addendum es más específico, PREVALECE.
(El texto verbatim de los prompts vive en el historial de la sesión; aquí está el contrato operativo completo.)

## 0. MANDATO
Modo autónomo, sin pausas, sin preguntar el orden. Entregar aplicación real (no demo). Evidencia real:
estados permitidos **PASS / FAIL / BLOCKED / NOT VERIFIED**. Prohibido "debería/parece/probablemente".
"Si no puedes demostrarlo, no está verificado." No declarar done por compilar/200/botón-existe/se-ve-bien.

## 1. TRES PRODUCTOS TIER-1 (igual fuerza)
- **COSTEAR** = verdad técnica/industrial/económica del producto.
- **COTIZAR** = verdad comercial de la propuesta.
- **COCREAR** = experiencia que orquesta ambas (cliente + Voni + Von Haucke).
- **VONI** = cerebro compartido de los tres (una verdad, múltiples lentes por rol).
Regla dura: Cocrear NO es GO si Costear o Cotizar no son GO. Cocrear no crea motores/catálogos/márgenes
/ProductSpec/precio/versiones paralelos: se mejora el CORE compartido.

## 2. UNA SOLA VERDAD + INVARIANTES
Pipeline: `ProjectSpec→FloorSpec→ProductIntent→ProductSpec→EngineeringSpec→BOM→CostSnapshot→
PlacementSpec→RenderSpec→QuoteSpec→ApprovalSnapshot→EmissionSnapshot`. Cada nodo versionado+hasheado+trazable.
- **INV-IDENTITY (§43):** para una misma revisión, product_version_id idéntico en ProductSpec/Engineering/
  BOM/Cost/Placement/Render/QuoteLine. Mismatch = P0 FAIL.
- **INV-DERIVATION (§3):** cambio upstream → downstream recalcula o queda STALE; nunca CURRENT silencioso.
- **INV-UNKNOWN≠0 (§8/§25):** unknown/pending/missing NUNCA = $0. Falta costo crítico → OFFICIAL_COST=BLOCKED;
  no calcular profit/margin/floor como confiables. Puede existir KNOWN_PARTIAL_COST etiquetado.
- **INV-LAYOUT (§52):** requested = placed + unplaced + excluded. Siempre. Test obligatorio.
- **INV-PRICE-AUTHORITY:** precio oficial solo del motor server-side canónico; LLM/UI/legacy nunca autoridad.
- **INV-SELLER-SAFE:** cost/margin/profit/supplier NUNCA en el payload del vendedor (no basta ocultar en UI).
- **INV-QUOTE-IMMUTABLE (§33):** quote emitida = snapshot inmutable; si cambia el producto, avisa "nueva revisión", no muta.
- **INV-APPROVAL (§34):** aprobación ligada a quote+revision+economic_hash+rules_version; cambio económico → STALE.
- **INV-RENDER-TRUTH (§41/44):** el render representa (no inventa) la ProductVersion; si cambia el hash → STALE.
- **INV-PROVENANCE (§17/140):** todo dato crítico con fuente (USER/PLAN/CATALOG/ENGINEERING/PURCHASING/
  DIRECTION/AI_INFERENCE/FACTORY) y estado de evidencia (CERTIFIED/USER_APPROVED_ESTIMATE/ESTIMATED/
  INFERRED/PENDING/UNKNOWN/NOT_APPLICABLE).
- **PRECEDENCIA (§14/141):** USER EXPLICIT > APPROVED PLAN > APPROVED PRODUCT SPEC > CATALOG > AI INFERENCE.

## 3. CLASIFICACIÓN DE PRODUCTO (§4) + LIFECYCLE (§7)
LINE_PRODUCT · CONFIGURED_LINE_PRODUCT · DERIVED_SPECIAL (guarda parent + derivation_reason) · NEW_SPECIAL.
Agnóstico a categoría (§5): office/retail/airport/hospitality/…/custom/unknown. Un proyecto puede crear N productos (§6).
Lifecycle: PROJECT_SPECIAL→TECHNICALLY_INCOMPLETE→VALIDATED→FABRICATION_VALIDATED→REUSABLE_INTERNAL→
VON_HAUCKE_PRODUCT→LINE_PRODUCT→RETIRED. Promoción con gate; nunca perder lineage/revision/cost history.
reuse_policy (§8): PROJECT_ONLY/INTERNAL_REFERENCE/REUSABLE_ANONYMIZED/VH_REUSABLE/PUBLIC_LINE. No filtrar cliente A→B.

## 4. COSTEAR — DoD (§20/§4-20 addendum)
Entradas (todas → mismo ProductSpec canónico): texto/IA/plano/PDF/imagen/manual/línea/derivado/especial/cocreación.
Output: identity, ProductSpec rev, geometry, materials, finishes, engineering state, BOM, processes, labor,
factory, hardware, external, waste, manufacturability, CostSnapshot, confidence (ponderado por importe), provenance,
blockers, render state. Drill-down "explica cada peso". BOM nunca omite (PENDING_*). What-if con delta.
Bugs release-blocker (§11 addendum): split-brain, hojas=0→$0, material inexistente saltado, precio→0, unidades,
dos precios, fallback legacy silencioso, catch silencioso, render stale, server/client divergente, falsa precisión,
confidence decorativo. DoD: crear→definir→editar→BOM→costear→entender→guardar→cerrar→reabrir→modificar→
nueva revisión→comparar, sin descuadres/costo falso/datos perdidos/stale silencioso/errores tragados.

## 5. COTIZAR — DoD (§41 addendum)
Entradas → mismo QuoteSpec: text/plan/manual/project/costear-product/cocreate/line/special.
Línea referencia product_id+product_version_id (nunca "latest"). Precio de pricebook autorizado o special+regla.
Margen: UNA regla canónica (distinguir margin/markup/floor/target). Descuento → ALLOWED/APPROVAL_REQUIRED/BLOCKED
(nunca warning-que-deja-seguir). Approval + Emission hard gate server-side. Seller-safe recursivo. Revision pinning
(§34). Quote health. Zonas. Value engineering estructurado. PDF real (sin cost/margin/profit). Reopen/duplicate fieles.
Cero botones muertos. DoD E2E: TEXT/PLAN/MANUAL/LINE/SPECIAL/MIXED/DISCOUNT/APPROVAL/PDF/EMISSION/SAVE/REOPEN/
REVISION/DUPLICATION todos PASS.

## 6. COCREAR — DoD (§9/§105-106/§202)
UX: una decisión importante por momento; usable por alguien de 14 y de 70; progressive disclosure. Entradas:
idea / plano / partir de producto VH / desde cero. Design DNA por proyecto. ProductIntent antes de estética.
Change-impact engine. A/B sin destruir A. Project history ("¿cómo empezó? ¿qué cambió?"). Reuse con ranking real.
DoD = TEST MAESTRO (§7 abajo).

## 7. TEST MAESTRO DE INTEGRACIÓN (§44 addendum) — OBLIGATORIO
Cocrear desde cero→Rev1→Costear→render→Cotizar→guardar→Costear +300mm→Rev2 (Rev1 preservada)→costo cambia→
render Rev1 STALE→quote sigue Rev1→"Rev2 disponible"→keep/update→reprice+approval→PDF Rev2→cerrar→sesión
limpia→reabrir idéntico. Cualquier inconsistencia = P0 FAIL.

## 8. VONI (§10-13/§148-150)
Un solo Voni, lentes (SELLER/DESIGNER/PRODUCT_DEVELOPER/ENGINEER/COST_ANALYST/SPACE_PLANNER/RENDER_DIRECTOR/
COMMERCIAL/CEO/RISK/CONTROL) según pantalla/rol/contexto. VoniContext estructurado, sanitizado SERVER-SIDE por rol
ANTES del LLM. Respuesta estructurada WHAT/WHY/IMPACT/CONFIDENCE/EVIDENCE/ACTION. No alucinar acciones: si no hay
tool, decir "puedo proponerlo pero no lo he aplicado". Debe poder actuar donde haya capability + permiso + preview si destructivo.

## 9. SEGURIDAD / DATOS (§37-38/§73-76/§84/§162-163)
Seller-safe y client-safe recursivos en payload/PDF/VoniContext. RLS por rol testeado con JWT real (SELECT/INSERT/
UPDATE/DELETE). Fail-closed: si catálogo/reglas/costo canónico falla → CANONICAL_SOURCE_UNAVAILABLE, no legacy
silencioso. Reusar entidades existentes antes de crear tablas; cada tabla nueva justifica problema/RLS/index/version.
No mutar 33 cotizaciones legacy; QA con prefijo QA_. Archivo metadata-first (sin blobs). Idempotencia + concurrencia
(optimistic version) + autosave con estado visible. API contracts tipados {ok,data,warnings,blockers,provenance,version}.

## 10. PLANO / LAYOUT / RENDER / 3D (§47-54/§98-100)
FloorSpec: envelope/walls/zones/doors/windows/obstacles/circulation/dims/fixed furniture/finishes/evidence.
Plan reader: IA interpreta, VALIDADOR DETERMINISTA valida (dims, áreas, counts, doors, furniture counts).
OBSERVED≠INFERRED≠SUGGESTED (no sumar suggested; no convertir sillas→puestos). Golden: 8 puestos invariante.
Placement semántico: allowed/preferred/forbidden zones; validador determinista (dentro de zona, no cruza muros,
holgura de puerta, no overlap, circulación). Layout parcial no se presenta como terminado; render final BLOCKED si
falta producto crítico. Render: prompt compiler versionado + post-validation de atributos + staleness. 3D con
geometría/escala/placement/acabados reales (si fidelidad limitada, decirlo).

## 11. UX / CALIDAD (§63-72/§112-117)
Home conserva "COCREANDO TU ESPACIO"; entradas COCREAR/COSTEAR/COTIZAR. Refinamiento premium (no rediseño):
typography/spacing/hierarchy/surfaces/states/microinteractions. TODAS las pantallas a nivel (no Home 10 / resto 5).
Responsive desktop-first, tablet usable. Accesibilidad (teclado, foco, contraste, targets, ARIA). Nunca NaN/Infinity/
$undefined. Singular/plural correcto (capa de presentación; no tocar contrato IA). Cero botones muertos. Todo async
crítico: loading/success/error/retry (sin pantalla blanca / spinner infinito).

## 12. PROCESO / RELEASE (§160-201)
Antes de codear: baseline audit (hecho: BASELINE_AUDIT.md). Bug ledger (BUG_LEDGER.md). Programa (COCREACION_PROGRAM.md).
Ciclos (§46 addendum): 1 shared P0 → 2 Costear → 3 Cotizar → 4 Cocrear → 5 cross → 6-8 refine → 9 Voni → 10 E2E → 11 audit.
Tras cada fase: regresión. Severidad: P0 (dinero/seguridad/data loss/emisión/revisión fábrica/producto inconsistente) →
P1 (workflow/layout/render/auth recovery) → P2 (UX/copy). Root cause, no síntoma. No duplicar lógica. Test before/after.
Auditoría final independiente (asumir que lo previo está mal hasta reverificar). Reporte final formato §201.

## 13. GO/NO-GO (§48 addendum / §200)
Gates que deben ser PASS: AUTH, COST, BOM, ENGINEERING, MANUFACTURABILITY, COCREATE, PLAN, LAYOUT, RENDER, QUOTE,
APPROVAL, EMISSION, PDF, SELLER-SEC, CLIENT-SEC, RLS, ARCHIVE, PERFORMANCE, VONI, GOLDENS, ADVERSARIAL, CROSS-INTEGRATION.
COSTEAR=GO y COTIZAR=GO y COCREAR=GO requeridos. Cualquier P0/P1 crítico → PRODUCT = NO-GO.

## 14. DECISIONES DEL DUEÑO (prevalecen)
- Deploy a PROD siempre / un solo link `costeador-vonhaucke.vercel.app` (sobre §164 RC-only).
- No inventar precios/materiales; no desactivar RLS; no exponer service_role; no borrar las 33 cotizaciones legacy.
- Sanitarios/baños: solo mobiliario (no escusados). Alcance Voni amplio (no solo oficina).
