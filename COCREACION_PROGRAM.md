# COCREACION_PROGRAM — Von Haucke Product OS
Log vivo de estado. Fuente CANÓNICA de requisitos = `docs/MASTER_PRODUCT_CONTRACT.md` + `docs/REQUIREMENTS_MATRIX.md`.
SHA actual: `198920c` · PROD: `costeador-vonhaucke.vercel.app`.

## 0. ENMIENDA/ADDENDUM — TRES PRODUCTOS TIER-1
**COSTEAR (verdad industrial) · COTIZAR (verdad comercial) · COCREAR (orquesta ambas).**
- Un defecto del cerebro compartido es defecto de Cocrear. Core-truth-first.
- COCREAR no puede ser GO si COSTEAR o COTIZAR no son GO. El producto completo tampoco.
- Cocrear NO introduce otro motor de costo/catálogo/margen/ProductSpec/precio/versiones: se mejora el core.

## 1. UNA SOLA VERDAD (§2) — pipeline objetivo
`ProjectSpec→FloorSpec→ProductIntent→ProductSpec→EngineeringSpec→BOM→CostSnapshot→PlacementSpec→
RenderSpec→QuoteSpec→ApprovalSnapshot→EmissionSnapshot` (versionado+hasheado+trazable).
Invariante identidad cruzada (§43): ProductSpec==Engineering==BOM==Cost==Placement==Render==QuoteLine (version_id). Mismatch=P0.
Invariante derivación (§3): cambio upstream → downstream STALE, nunca CURRENT en silencio.

## 2. EXISTE HOY (reutilizar): floorSpec.js, programaDelPlano (procedencia), cotizaciones_revisiones (hash,
inmutable), aprobaciones ligadas a hash, costear-servidor (autoridad), cotizar-servidor (política fail-closed),
Voni determinista (solo lectura), producto_versiones/economia/variantes, renders, 10 edges.

## 3. FALTA (grueso, multi-sesión): ProductSpec/EngineeringSpec/BOM universales versionados; clasificación
producto (LINE/CONFIGURED/DERIVED/NEW); lifecycle+promoción; ManufacturingCapability; Design DNA;
ProductIntent; change-impact; stale-graph formal; Cocrear orquestador; placement semántico + validador
determinista; render prompt compiler + post-validation + staleness; readiness determinista.

## 4. CICLOS (§46 addendum): 1 shared P0 core → 2 Costear hardening → 3 Cotizar hardening → 4 Cocrear
foundation → 5 cross-integration → 6-8 refinement → 9 Voni unified → 10 full E2E → 11 independent audit.
Tras cada fase de Cocrear: correr regresión Costear+Cotizar. Nunca degradarlos.

## 5. TEST MAESTRO (§44 addendum): Cocrear desde cero → Rev1 → Costear → render → Cotizar → guardar →
Costear +300mm → Rev2 (Rev1 preservada) → costo cambia → render Rev1 STALE → quote sigue en Rev1 →
"Rev2 disponible" → keep/update → reprice+approval → PDF Rev2 → cerrar → sesión limpia → reabrir idéntico.
Cualquier inconsistencia = P0 FAIL. (Hoy: NO alcanzable.)

## 6. GATES (§48/§200) — foto: AUTH PASS · SELLER-SEC PASS · UNKNOWN≠0 PARCIAL · DISCOUNT PARCIAL ·
APPROVAL/EMISSION hard gate PASS · PLAN count(8) PASS · LAYOUT accounting PARCIAL · SEMANTIC placement FAIL ·
RENDER-on-broken GATED · RENDER fidelity NOT VERIFIED · PDF genera PASS/"desde revisión emitida" NOT DONE ·
COCREAR NOT BUILT · GOLDENS 1/N · ADVERSARIAL NOT RUN. **Global: NO-GO.**

## 7. DECISIONES/DESVIACIONES: Deploy a PROD/un-solo-link ordenado por Rodrigo (prevalece sobre §164 RC-only);
no tocar 33 cotizaciones legacy ni inventar precios; catálogo canónico no certificado BLOQUEADO en Compras;
no "arreglar" FIRME (es confianza de precio correcta).

## 8. RIESGOS: motor de acomodo semántico = P0 más grande y visible (render CEO). GateGuard ralentiza ediciones.
Build CLI no inyecta SHA (footer "desconocido"). Alcance ≫ una sesión: estos docs son el hilo de continuidad.
