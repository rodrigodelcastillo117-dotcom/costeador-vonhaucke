# REQUIREMENTS_MATRIX — Von Haucke Product OS
Fuente de verdad de requisitos (ADDENDUM 001 §0). Estados: NOT_STARTED · IN_PROGRESS · PASS · FAIL · BLOCKED · NOT_VERIFIED.
Actualizar ANTES de implementar cualquier instrucción nueva. SHA ref: `198920c`.

| ID | Descripción | Módulo | Sev | Estado | Evidencia / nota |
|---|---|---|---|---|---|
| SHARED-001 | Una sola verdad del producto (pipeline canónico) | core | P0 | IN_PROGRESS | floorSpec + revisiones hash existen; ProductSpec/Engineering/BOM universales NOT_STARTED |
| SHARED-002 | INV-IDENTITY product_version_id igual en todo el pipeline | core | P0 | NOT_STARTED | requiere ProductVersion universal |
| SHARED-003 | INV-DERIVATION stale-graph (upstream cambia → downstream STALE) | core | P0 | IN_PROGRESS | revisiones/aprobaciones por hash; stale-graph formal NOT_STARTED |
| SHARED-004 | Un solo Voni, lentes por rol, sin duplicar verdad | voni | P0 | IN_PROGRESS | Voni2 determinista 1 cerebro; sin tools de acción |
| SHARED-005 | Fail-closed: fuente canónica cae → error tipado, no legacy silencioso | core | P0 | IN_PROGRESS | analizar-mueble ahora observable (VH-013); costear-servidor cert silenciosa pendiente |
| AUTH-001 | Login usuarios reales | auth | P0 | PASS | 11 cuentas sanas; login E2E |
| AUTH-002 | Reset/recovery link real (no vacío) | auth | P1 | NOT_VERIFIED | §179 pendiente |
| AUTH-003 | Session restore / logout / expired | auth | P1 | NOT_VERIFIED | §81 pendiente |
| SEC-001 | Seller nunca recibe cost/margin/profit en payload | sec | P0 | PASS | RPC seller-safe + column revoke (sesiones previas) |
| SEC-002 | anon no ejecuta RPCs de escritura (aprobaciones) | sec | P1 | PASS | VH-012 (revoke PUBLIC) |
| SEC-003 | RLS por rol testeado con JWT real (todas las tablas) | sec | P0 | NOT_VERIFIED | 31 tablas RLS on; test JWT por rol pendiente |
| SEC-004 | leaked-password protection ON | sec | P2 | NOT_STARTED | advisor |
| COST-001 | Motor económico canónico server-side (sin split-brain) | costear | P0 | IN_PROGRESS | costear-servidor autoridad; paridad total NOT_VERIFIED |
| COST-002 | UNKNOWN ≠ 0; costo crítico faltante → BLOCKED | costear | P0 | IN_PROGRESS | UI muestra "—"; modelo/BLOCK formal NOT_STARTED (VH-017) |
| COST-003 | hojas=0 no produce costo $0 | costear | P0 | PASS | fix + tests (sesión previa) |
| COST-004 | Material inexistente → línea PENDING (no skip) | costear | P0 | NOT_VERIFIED | §30 test pendiente |
| COST-005 | Sin dos precios para misma pieza | costear | P0 | PASS | VH-004 |
| COST-006 | Conversión de unidades (kg/hoja/m²/metro/pieza/fracción) | costear | P0 | IN_PROGRESS | desperdicio etiqueta corregida (VH-011); matriz §13 pendiente |
| COST-007 | Explain-every-peso drill-down | costear | P1 | NOT_VERIFIED | existe desglose; drill-down completo pendiente |
| COST-008 | Confidence ponderado por importe | costear | P1 | IN_PROGRESS | confianza.js por monto firme |
| COST-009 | Versionado de producto (Rev1..N) | costear | P0 | IN_PROGRESS | producto_versiones existe; flujo completo NOT_STARTED |
| COST-010 | Manufacturability honesta (REQUIRES_VALIDATION) | costear | P1 | NOT_STARTED | §19 |
| COST-011 | Golden cost matrix (simple..complejo..Alpura) | costear | P1 | NOT_STARTED | §17 |
| QUOTE-001 | Margen: una regla canónica | cotizar | P1 | IN_PROGRESS | canónico=margenObjetivo server; dispersión 30/40/50 (VH-019) |
| QUOTE-002 | Descuento → ALLOWED/APPROVAL_REQUIRED/BLOCKED | cotizar | P0 | IN_PROGRESS | trigger >40% verificado; loss-gate pendiente (VH-018) |
| QUOTE-003 | Approval hard gate server (hash) | cotizar | P0 | PASS | emitir_revision/_v2 verificado |
| QUOTE-004 | Emission hard gate server | cotizar | P0 | PASS | mismo |
| QUOTE-005 | Revision pinning (quote no muta con nueva rev) | cotizar | P0 | IN_PROGRESS | revisiones inmutables; UI "nueva rev disponible" NOT_VERIFIED |
| QUOTE-006 | Seller-safe recursivo en quote/PDF/Voni | cotizar | P0 | NOT_VERIFIED | vista cliente seller-safe; test recursivo pendiente |
| QUOTE-007 | Quote health (listo/bloqueado con razón) | cotizar | P1 | IN_PROGRESS | banners de procedencia/mínimo |
| QUOTE-008 | Value engineering estructurado | cotizar | P1 | IN_PROGRESS | panel VE con gap+peso (VH-005); motor con opciones NOT_STARTED |
| QUOTE-009 | Reopen/duplicate fieles | cotizar | P1 | NOT_VERIFIED | §37/38 |
| QUOTE-010 | Cero botones muertos | cotizar | P1 | IN_PROGRESS | VE muerto corregido; auditoría completa pendiente (§113) |
| PLAN-001 | leer-plano: envelope/zones/doors + grid determinista | plano | P0 | PASS | v8; 132 m² |
| PLAN-002 | OBSERVED≠INFERRED≠SUGGESTED; no sillas→puestos | plano | P0 | PASS | procedencia + puestos contados |
| PLAN-003 | Golden 8 puestos invariante | plano | P0 | PASS | E2E "8 contados" |
| PLAN-004 | FloorSpecV2 (walls/windows/fixtures/finishes/positions) | plano | P1 | NOT_STARTED | §98 |
| PLAN-005 | Snapshot/versionado de interpretación (no reparse) | plano | P1 | NOT_STARTED | §87 / review #15 |
| LAYOUT-001 | Invariante requested=placed+unplaced+excluded | layout | P0 | IN_PROGRESS | contador consistente + vencida; motor no coloca todo (VH-016) |
| LAYOUT-002 | Placement semántico (zonas permitidas/prohibidas) | layout | P0 | PASS | VH-015 completo: validador + gate + MOTOR consistente (planner usa floorSpec.zonaPermite como filtro duro en ambas pasadas). 9 tests (6 validador + 3 motor↔validador). 820 verdes, build OK, commit f73e5e3 |
| LAYOUT-003 | Validador determinista (muros/puertas/overlap/circulación) | layout | P0 | NOT_STARTED | §99 |
| LAYOUT-004 | Layout parcial no se presenta como terminado | layout | P0 | PASS | compuerta dura VH-014 |
| RENDER-001 | Render no inventa; representa ProductVersion | render | P0 | IN_PROGRESS | renderOficina usa dibujo+colocación; fidelidad NOT_VERIFIED |
| RENDER-002 | Render final BLOQUEADO si layout roto | render | P0 | PASS | VH-014 |
| RENDER-003 | Render staleness por hash | render | P1 | NOT_STARTED | §44 |
| RENDER-004 | Prompt compiler versionado + post-validation | render | P1 | NOT_STARTED | §42/43 |
| RENDER-005 | 3D con geometría/escala/acabados reales | render | P1 | NOT_VERIFIED | §100 (punto débil CEO) |
| PDF-001 | PDF real genera | pdf | P0 | PASS | blob application/pdf 7.5MB |
| PDF-002 | PDF deriva de revisión emitida/inmutable | pdf | P0 | NOT_STARTED | hoy deriva del estado vivo |
| PDF-003 | PDF cliente sin cost/margin/profit | pdf | P0 | NOT_VERIFIED | vista cliente seller-safe; parse PDF pendiente |
| UI-001 | Contraste: nunca texto claro sobre fondo claro | ui | P1 | PASS | nota-clara (VH-010) |
| UI-002 | Dibujar legible en tema oscuro | ui | P1 | PASS | VH-009 |
| UI-003 | Singular/plural en capa de presentación | ui | P2 | NOT_STARTED | VH-020 |
| UI-004 | Todas las pantallas a nivel premium | ui | P1 | IN_PROGRESS | §69/70 barrido pendiente |
| COCREATE-001 | Cocrear orquesta Costear+Cotizar sin duplicar | cocrear | P0 | NOT_STARTED | §9 |
| COCREATE-002 | Test maestro integración (Rev1→Rev2→stale→reopen) | cocrear | P0 | NOT_STARTED | §44 addendum |
| COCREATE-003 | Design DNA / ProductIntent / change-impact / A-B / history | cocrear | P1 | NOT_STARTED | §14-15-56-57-58 |
| PERF-001 | Archivo metadata-first (sin blobs) | perf | P1 | PASS | lista ligera (sesión previa) |
| PERF-002 | Performance pantallas clave sin regresión | perf | P1 | NOT_VERIFIED | §111 |
| VONI-001 | VoniContext estructurado + sanitizado server por rol | voni | P0 | IN_PROGRESS | permisos fail-closed; context pobre (no project_id) |
| VONI-002 | Voni no alucina acciones | voni | P0 | PASS | solo lectura, no afirma guardar |
| VONI-003 | Voni con tools de acción (donde haya capability) | voni | P1 | NOT_STARTED | hoy 0 tools de escritura |
| ADVERSARIAL-001 | Matriz hostil (§110) | qa | P0 | NOT_RUN | double-click/timeout/stale/etc. |
| CROSS-001 | Integridad cruzada product_version_id | qa | P0 | NOT_STARTED | depende de ProductVersion universal |
