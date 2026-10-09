# VONHAUCKE — FINAL AUDIT PACKET

> Estado FINAL ACTUAL del cierre autónomo de Claude. Verdad exacta, sin falsos verdes.
> Fecha: 2026-10-09. Evidencia = LOCAL de Claude + 1 Preview de Vercel. GitHub CI: 0 runs.

## REPOSITORY
- repo: `rodrigodelcastillo117-dotcom/costeador-vonhaucke`
- branch: `audit/final-product-completion`
- **HEAD_SHA (40, branch tip) = `bb23454cac9a13a914f6be7742fdc1458bb1bbf8`** (docs: ChatGPT final audit)
- **CODE_SHA (último commit de CÓDIGO) = `ec0a7740591a28a3635fa8115dfc114fcd70d1d9`** (security: DOMPurify 3.4.16)
- **DOCS_SHA = `bb23454cac9a13a914f6be7742fdc1458bb1bbf8`**
- merge de integración RC (Home premium + deps): `4a013c2` · lock consistente: `f263ba9` · paquete de entrega: `08886c7`
- base desde donde comenzó este cierre: `b0092ff3b8c480c988f0c9f193109330948e40fa`
- CORRECCIÓN DE TRAZABILIDAD (ChatGPT): en la primera versión de este paquete se puso HEAD_SHA=`f263ba9`; lo correcto es HEAD(tip)=`bb23454`, CODE=`ec0a774`. Corregido.
- integra exactamente los 4 commits de `release/current-20261009` (82e1192): 717e204 (premium home), d4c4e91 (premium styling), 7ea8238 (dep cleanup), 82e1192 (Recharts v3 lock).

## RELEASE
- RC: integración `release/current-20261009` + R10 docs + hardening de seguridad (DOMPurify) sobre `audit/final-product-completion` @ `bb23454` (código `ec0a774`).
- Preview Vercel de Claude (READY): `https://costeador-vonhaucke-p8gqeurml-rodrigos-eurotrip.vercel.app` · dpl `dpl_4kEu62x2ck9cobnUPfz4hxzpZ2ig` · SHA `f263ba9` · 0 errores de consola · Home premium confirmado por screenshot.
- Preview Vercel hardened (ChatGPT, READY): `https://costeador-vonhaucke-arfmyh4sz-rodrigos-eurotrip.vercel.app` · código `ec0a774` · 2182/2182 + build ✅ + **runtime npm audit 0 vulnerabilidades**. (Es el RC runtime actual; el delta a `bb23454` es sólo `CHATGPT_AUDIT_FINAL.md`, no afecta runtime.)
- **Production: NO_DEPLOYED por Claude.** La promoción a producción (`request_promote`) fue **BLOQUEADA por el harness** (clasificador "Production Deploy"), no por falta de build. Requiere acción humana (promote en Vercel o regla de permiso).
- **ROLLBACK SHA / deployment:** prod actual LIVE = `dpl_1m4bDohVjcqL86fcGHRhJTnw2rJc` · SHA `5a38d2edf6c6d55fc8c8b26e5149c88c042479a2` · ref `claude/perfection-final-20261006`. (Vercel → Instant Rollback a este deployment si algo sale mal.)

## CAMBIOS (desde b0092ff)
- `src/componentes/Inicio.jsx` (+91): **Home premium** — hero "Cocreando tu espacio · Vonhaucke · más de 68 años de oficio", fotografía real por línea (`heroLinea` → bucket público), 3 caminos (Cotizar/Costear/Cocrear), "Más herramientas", proyecto en curso, líneas más usadas. (de release)
- `src/estilos.css` (+440): estilos premium showroom/editorial. (de release)
- `package.json` / `package-lock.json`: **Recharts ^3.10.1**, **react-is ^18.3.1**, allowScripts explícito (core-js@3.50.0, esbuild@0.21.5). (de release; lock completado con transitivos vía npm install, npm ci-consistente.)
- **Seguridad (ChatGPT, `ec0a774`): DOMPurify transitivo 3.4.13 → 3.4.16** (no-breaking). `npm audit --omit=dev` = **0 vulnerabilidades runtime**. Los 10 avisos restantes son tooling dev/test (Vitest/tinypool/Vite); NO en el bundle de empleados; no se forzó `audit fix --force` (implicaría majors de Vite/Vitest).
- `CHATGPT_AUDIT_FINAL.md` (`bb23454`): bitácora de la auditoría independiente de ChatGPT (GO como RC-para-probar; NO-GO como producción final hasta E2E live + lector nuevo desplegado).
- `HANDOFF_CHATGPT.md`, `CLOSEOUT_STATE.md`: R15 GREEN + re-auditoría R10 + este paquete.
- **NO** se modificó código de motor, edges, ni lógica de R8–R15 en este cierre (sólo integración + docs). Las 33 legacy, Alba/Alpura, goldens: intactos.
- Arquitectura nueva preparada (SHADOW, NO en prod): ingestión del catálogo real de venta (`src/datos/fuentes/ARTICULOS-LINEAS-*.xlsx`) con la regla de precio confirmada (mobiliario→Precio Lista, sillería→Precio Mínimo, sofás/lounge→Lista). Generado en scratchpad, NO escrito al repo ni al motor.

## REGLA DE PRECIO CONFIRMADA (Rodrigo, 2026-10-09)
- MOBILIARIO → `Precio Lista`. SILLERÍA (sillas/sillones/butacas/poltronas) → `Precio Mínimo`. SOFÁS/LOUNGE/BANCA → `Precio Lista` (standard). `Precio 2` no se usa.
- Basis por FAMILIA, no por texto débil; ambiguo → `PRICE_BASIS_UNKNOWN` (fail-closed). Ver memoria `feedback_pricing_rule`.

## OPEN ITEMS
### P0_EXECUTABLE
NONE (ningún P0 ejecutable abierto detectado; money/seguridad/seller-safe/confirmación con tests verdes y sin regresión R15).

### P1_EXECUTABLE
NONE nuevo introducido por este cierre. (El cierre fue integración + verificación; no se abrieron P1 ejecutables.)

### P2_EXECUTABLE
- Bundle `index` ~1.19MB (code-split pendiente). `charts` 532KB. — polish de performance, no bloqueante.

### BLOCKED_EXTERNAL
- **Promoción a PRODUCCIÓN**: bloqueada por el harness (clasificador "Production Deploy"). Requiere acción de Rodrigo (Vercel Promote o regla de permiso `mcp__…__request_promote`).
- Deploy de edges nuevos `leer-plano`/`leer-plano-core` (prod = v11/v4; no emiten observed_program). Edge = cambio productivo.
- Verificación LIVE de lectura de plano con PDF real; E2E autenticado de los 3 flujos (necesita credenciales de prueba + edges).
- GitHub CI independiente (0 runs).

### DATA_TRUTH_REQUIRED
- Cutover del motor a precios/costos reales: requiere validar el puente `fuentes/*.xlsx` → catálogo canónico → motor (shadow→compare→cutover SOLO productos nuevos), con evidencia. Hoy sólo ingestión SHADOW del catálogo de venta (parseo + regla de precio) en scratchpad; materias primas (~16.4k), despiece (cuanti_mp) y estructura de costo NO ingestados aún. Drive del usuario (materias primas + más cotizaciones) NO jalado todavía.
- Parámetros de conversión por familia (kg/m², área de hoja, merma) para costo completo.

### DEFERRED_BY_PRODUCT_DECISION
- Vocabulario amplio de mobiliario del lector (operativo/privado/juntas/recepción/credenza/archivero/coffee/lockers/lounge/retail/módulos/mostradores…): requiere construir + validar con planos reales antes de deploy del edge.

## MATRIZ DE ESTADO
| Bloque | STATUS | EVIDENCIA | Implementación / notas |
|---|---|---|---|
| R10 | PASS | CODE_PASS + INTEGRATION_PASS (R10-14 NOT_VERIFIED live) | re-auditado @260573a (RC = +4 commits UI, sin cambio de lógica); 15/15 enforced |
| R15 | PASS | INTEGRATION_PASS + CODE_PASS | aceptado GREEN por ChatGPT; sin regresión |
| Costear | PARTIAL | CODE_PASS / prod previo LIVE | funcional; sin re-QA de 24 casos este cierre |
| Cotizar | PARTIAL | CODE_PASS + UNIT/INTEGRATION | money fail-closed verde; sin E2E autenticado nuevo |
| Cocrear | PARTIAL | CODE_PASS | funcional; workspace ideal (3 paneles) no verificado este cierre |
| VONI / Council | PARTIAL | CODE_PASS / edge v12 LIVE | sin re-verificación de latencia/0-modelos este cierre |
| Plan Intelligence / observed_program | PASS (offline) | INTEGRATION_PASS + RECORDED_CONTRACT | lector nuevo NO desplegado (prod v11/v4) |
| Acomodo / auto-repair | PASS (dominio) | INTEGRATION_PASS + gate LIVE (preview) | certificación geométrica fail-closed observada en preview |
| Producto Maestro / BOM / motor | PARTIAL | UNIT/INTEGRATION_PASS | legacy intacto; cutover de precios reales = DATA_TRUTH_REQUIRED |
| Shadow motor / precios / insumos / unidades | PARTIAL | CODE_PASS + ingestión SHADOW | catálogo venta parseado + regla de precio; materias primas/despiece pendientes |
| PDF / Imprimir / Propuesta Viva | PARTIAL | CODE_PASS | sin re-smoke E2E este cierre |
| Renders / Value Engineering | PARTIAL | CODE_PASS | sin re-verificación este cierre |
| Login / Password recovery | PARTIAL | PREVIEW_PASS (pantalla login premium carga) | reset/forgot no probado live este cierre |
| Roles / Seguridad / RLS / Seller Safe | PASS | UNIT/INTEGRATION_PASS | sin re-auditoría RLS live este cierre |
| autosave / persistencia | PASS | UNIT/INTEGRATION_PASS | save/reopen de confirmado_modelo con test |
| frontend / Home premium / responsive | PASS | PREVIEW_PASS | Home premium confirmado en preview Vercel, 0 errores consola |
| performance | PARTIAL | NOT_VERIFIED | bundle grande (P2) |
| dependencias | PASS | UNIT_PASS + BUILD | Recharts 3.10.1 + react-is 18.3.1 + DOMPurify 3.4.16 + allowScripts; **runtime npm audit 0 vulns**; 2182 tests + build verdes |
| Supabase | PASS (read-only) | LIVE (inspección) | 22 edges activos; leer-plano v11/core v4 (viejos) |
| Vercel | PARTIAL | PREVIEW_PASS | preview READY; production promote BLOQUEADO (harness) |

## RIESGO RESIDUAL
- El cutover de precios reales NO está hecho: las cotizaciones siguen con la base de precio previa (marcada "estimado/sin procedencia" cuando aplica, fail-closed). No hay riesgo de número inventado, pero tampoco es "precio real" aún.
- El lector de planos en vivo sigue siendo el viejo (v11/v4): el flujo observed_program queda dormido en prod hasta desplegar el edge.

## GO / NO-GO PRODUCCIÓN
- **Como RELEASE CANDIDATE para PROBAR: GO** 🟢 (Claude + ChatGPT): build + 2182 tests verdes, 0 vulns runtime, Home premium, R15 sin regresión, R10 re-auditado. Preview hardened: `https://costeador-vonhaucke-arfmyh4sz-rodrigos-eurotrip.vercel.app`.
- **Como "VERSIÓN FINAL DE PRODUCCIÓN, ya terminamos": NO-GO todavía** 🟠. Faltan 4 fronteras LIVE (no son P0 de lógica; son verificación/activación en vivo): (1) E2E autenticado real de Costear/Cotizar/Cocrear; (2) forgot/reset password live; (3) PDF/Print/guardar/reabrir live; (4) **desplegar y validar el lector nuevo de planos con PDFs reales** (prod sigue en `leer-plano` v11 / `leer-plano-core` v4 → observed_program NO está live). DATA TRUTH de precios/materiales puede seguir pendiente mientras la app no invente números.
- **Promoción a producción**: BLOQUEADA por el harness de Claude (acción de Rodrigo). Rollback: `dpl_1m4bDohVjcqL86fcGHRhJTnw2rJc` / `5a38d2e`. ChatGPT NO tocó producción. Evaluación ChatGPT: código/arquitectura ~94/100.
