# CURRENT_BASELINE.md — Von Haucke Product OS

> **Medido HOY (2026-10-28), no copiado de documentos históricos.** (§2, §103)
> Autor: sesión Claude GOD MODE 9.5. Solo lectura + medición; **sin cambios de código, DB, edges ni prod** en este bloque.

## 0 · Código / rama
| Campo | Valor medido |
|---|---|
| Rama de trabajo | `claude/costing-app-architecture-psf02g` |
| HEAD (local == remoto) | `728ac8a2d910ee3a68e9527b6b0d858aad2b173b` |
| Coincide con HEAD del brief | ✅ sí |
| Working tree | limpio |
| vs `c3.4-seller-safe` (prod) | **31 adelante / 0 atrás** (contiene prod `862d327` limpio) |
| Node / npm | v22.22.0 / 10.9.4 |

Últimos commits: `728ac8a` fix erpProyecto · `accb56d` diagnóstico acomodo · `2194362`/`b4bafcf`/`8575539`/`2bc787b`/`5d30f63` auditoría TELCEL · serie `ERP:` candado fail-closed workbooks.

## 1 · Build / unit / audit (local, HEAD actual)
| Check | Resultado |
|---|---|
| `npm run build` | ✅ PASS (18 s) |
| `npm audit --omit=dev --audit-level=high` | ✅ 0 vulnerabilidades |
| Vitest (excl. worktrees) | ✅ **401/401 archivos · 3947/3947 tests** |

## 2 · CI (GitHub Actions, workflow `ci.yml`)
Último run sobre `728ac8a` = **run #979, PR #85 (DRAFT · NO MERGE)** → **conclusión: FAILURE**.
- Job **`verify`** (npm ci · audit · vitest · build): ✅ **success**.
- Job **`E2E público + autenticado si hay cuenta de prueba`** (Playwright): 🔴 **failure** en el paso *"E2E público + auth condicional"* (corrió 13 min).

➡ **HALLAZGO P0-CI-01**: la **E2E está roja** en el HEAD. Unidad/build/audit están sanos; el fallo es Playwright. No reproduce en la corrida local (que no ejecuta Playwright). Diagnóstico pendiente (bloque §104). **Sin esto no hay merge ni 9.5** (§72).

**Certificación viva** (workflow `Certificación (labs reales contra producción)`): se dispara solo con la etiqueta `certificar`; en #979 quedó **skipped**. Un `skipped` **no es PASS** (§74).

## 3 · Vercel
| Target | Commit | Estado |
|---|---|---|
| **production** (`dpl_AvFtUARs…`) | `862d327` (`c3.4-seller-safe`) | READY — **sin cambios** ✅ |
| último **preview** de la rama (`dpl_CAthKba3…`) | `ea31d459` | READY, pero **viejo** |

➡ **HALLAZGO P1-PREV-01**: **no existe preview en el HEAD `728ac8a`** (el último preview es `ea31d459`, anterior). §76 exige `preview.githubCommitSha == FINAL_SHA` antes de declarar piloto.

## 4 · Supabase — proyecto `mtuvnbgljwbsaizjjgzs`
`ACTIVE_HEALTHY` · PostgreSQL **17.6.1.155** · region us-east-1 · org `flcjmeritwiydoxyydbw`.

### Conteos (HOY)
| Tabla | Filas | Tabla | Filas |
|---|---:|---|---:|
| insumos_catalogo | 11,294 | cotizaciones | 4,663 |
| insumo_precios | 12,973 | cotizaciones_revisiones | 24 |
| productos | 1,948 | expedientes | 487 |
| producto_versiones | 1,951 | expediente_revisiones | 654 |
| costeos_servidor | 1,010 | cocrear_costeo_servidor | 159 |
| partida_costeo_vigente | 36 | aprobaciones_precio_historial | 11,847 |
| shadow_costeo | 1,785 | lista_precio_items | 1,941 |
| proyectos | 24 | renders | 6 |
| render_eventos | 355 | ai_eventos | 1,397 |
| voni_council_events | 258 | confirmaciones | 174 |

### Precios (insumo_precios)
- `aprobado`: **12,971** · `propuesto`: **0** · estados presentes: `aprobado`, `propuesto_validado`.
- vigentes (sin `vigente_hasta` o futura): **12,971**.
- `requiere_validacion_compras = true`: **0** (el flag del candado de workbooks existe en esquema pero **ningún** precio lo usa hoy).
- `source_system = 'erp_intelisis'`: **12,696**.
- Columnas clave: `estado, vigente_desde/hasta, approved_by, approved_at, requiere_validacion_compras, contract_status, source_system, source_record_id, source_hash, cost_unit, cost_unit_price_mxn, confidence, evidence_status`.

➡ **P0-03 (abierto)**: 12,971 precios aprobados y vigentes, **0 propuestos** → falta auditar **cómo** se aprobaron (cuántos por `qa-direccion@vonhaucke.mx`, cuenta no-humana). `aprobaciones_precio_historial` = 11,847.

### Roles (`permitidos`) y cuentas no-humanas
- **dirección 7 · diseño 3 · vendedor 1** (total 11). (§58 confirmado)
- `cuentas_no_humanas`: `qa-direccion@vonhaucke.mx` (cuenta de pruebas QA con rol dirección) · `reconciliacion` (proceso automático). → su aprobación **NO cuenta como humana** (mecanismo P1-03).

### Migraciones
~230 aplicadas; última **`20261022010003 final100_hardening_revoke_anon_drop_probe`** (22-oct). La migración TELCEL `PROPUESTA_20261026_workbook_proyecto_preliminar.sql` del repo **NO está aplicada** (es propuesta). ✅

### Política de autoridad de costeo
El brief observó `modo=preparado`, `frescura=exigir_vigente`. **No** está en `config.datos` (keys: insumos, parametros, piezas) ni `direccion.datos` (finanzas, nomina). → **pendiente de ubicar** (probable código `src/datos/autoridadCosteoServidor.js` / env). No cambiar sin autorización (§3).

## 5 · Edge Functions
**29 ACTIVE.** Inventario y clasificación completos en **`EDGE_INVENTORY.md`**.
➡ **HALLAZGO P1-EDGE-01 (§31 confirmado)**: las edges de **producción** (`costear-servidor` v17, `acomodar-espacio-recovery` v19, `cotizar-servidor` v8, `analizar-mueble` v38, `leer-plano` v14, `generar-render` v31, `voni-council` v14, etc.) tienen `entrypoint_path` en `/tmp/user_fn_…` = **desplegadas fuera de banda** (no desde CI/repo). Las `-rc` vienen de `/home/runner/work/…` = **desde el repo**. → **la versión viva de prod no es trazable byte-a-byte a un SHA del repo.**

## 6 · Seguridad (advisor)
➡ **HALLAZGO P1-SEC-01**: tabla **`_bk_familia_app_20261021` con RLS DESHABILITADO** (306 filas) — expuesta a `anon`/`authenticated`. Es una tabla de respaldo; hay que **borrarla o habilitar RLS + revocar grants**. (Advisor Supabase nivel *critical*.)
Pendiente: matriz completa SECURITY DEFINER por función (§56) y RLS-sin-política (§57) — bloque §110.

## 7 · Feature flags
`costear_simple` = **false** por default (flujo simple existe, oficina no lo ve). Resto de flags: inventario pendiente de `src/datos/flags.js` (§60).

## 8 · Inputs recibidos de Dirección (Google Drive, 2026-10-28)
PDFs: **TEVHSU**, **TEVTSU**, **TVCAC** (benchmarks §15/§16/§17) · **TELSVH120**, **TELSMG** (TELCEL con costeo+materiales). xlsx: `TELSVH120 (2).xlsx`, `C-CO-320R DATS TELCEL DIV-MATERIALES`. → se jalarán de Drive para el bloque de benchmark IA (§84) y carga/paridad TELCEL (§20).

## 9 · Qué YA existe / incompleto / roto / stale / necesita-humano (§103)
- **YA existe (reutilizar, NO duplicar):** motor Alba V1 + goldens Intelisis; `cocrear.js` (ProductSpec/lineage/rev); `structuralGraph.js`; `specTecnica.js` + `validarIntentCosteo.js`; `AsistenteEspecial.jsx` (Costear end-to-end); emisión server-side + hard-gate; control optimista VH-148; catálogo versionado + fail-closed de precio; golden TELCEL METAL (motor reproduce 4 módulos al centavo, **verificado honesto**).
- **Incompleto:** convergencia canónica ProductIntent→…→CostSnapshot (adapters, §105); carga TELCEL de 49 precios (pendiente, gobernada); modo simple Costear (flag off); preview en SHA final.
- **Roto:** 🔴 **E2E (CI job) rojo** en HEAD (P0-CI-01).
- **Stale/trazabilidad:** edges prod fuera de banda (P1-EDGE-01); acomodo GHOST por plan stale (`lab/ACOMODO_LIST_MISMATCH.md`, confirmado en código).
- **Necesita-humano:** 9 SKU TELCEL `NECESITA_HUMANO`; certificación de precios workbook (Compras); decisiones Dirección sobre política estricta, roles, borrado de backup.

## 10 · P0/P1 vivos (a reproducir en HEAD, bloque §104)
| ID | Área | Estado |
|---|---|---|
| P0-CI-01 | CI / E2E Playwright rojo | **ABIERTO** (nuevo, medido hoy) |
| P0-03 | Precios: auditar aprobaciones qa-direccion | ABIERTO |
| P0-05 | Acomodo geométrico real / identidad (GHOST) | ABIERTO (diagnóstico listo) |
| P0-01 | Cotizar ECONOMICS_INCOMPLETE (partidas sin costo) | re-verificar en HEAD |
| P1-EDGE-01 | Trazabilidad edges prod↔SHA | ABIERTO |
| P1-SEC-01 | `_bk_familia_app` RLS off | ABIERTO |
| P1-PREV-01 | Sin preview en SHA actual | ABIERTO |

> Detalle y ciclo de cierre por hallazgo en **`95_RELEASE_MASTER_PLAN.md`**.
