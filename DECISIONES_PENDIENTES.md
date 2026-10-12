# Decisiones pendientes de Dirección · corte 2026-10-11

Todo lo de esta lista está **bloqueado por el mandato** ("No se autoriza alterar producción, desplegar,
fusionar ramas, eliminar datos ni modificar fórmulas oficiales sin aprobación expresa"). Nada de aquí se
ejecuta hasta que lo apruebes por escrito, punto por punto. Cada fila trae la evidencia medida, la propuesta,
el riesgo si NO se hace, el riesgo de hacerlo y cómo se regresa.

Convención de esfuerzo: **S** (< 2 h con prueba), **M** (medio día), **L** (bloque propio con smoke + rollback).

## A. Servidor (edges y base) — requieren redeploy o migración

| # | Qué | Evidencia medida | Propuesta | Si NO se hace | Riesgo de hacerlo / rollback | Esf. |
|---|-----|------------------|-----------|---------------|------------------------------|------|
| A1 · VH-069 | **HECHO 2026-10-11** (aprobado A1+A2): `cotizar-texto` v13 y `analizar-negocio` v2 desplegadas con wrapper de seguridad y contexto desde la base; verificadas en vivo; respaldo de v12/v1 para rollback. |  |  |  |  | — |
| A2 · VH-060 | **HECHO 2026-10-11** (aprobado A1+A2): `cotizar-texto` v13 y `analizar-negocio` v2 desplegadas con wrapper de seguridad y contexto desde la base; verificadas en vivo; respaldo de v12/v1 para rollback. |  |  |  |  | — |
| A3 · VH-063 | **HECHO 2026-10-11** (aprobado "sólo descuento"): RPC `politica_comercial_publica` aplicada; expone sólo descuento máximo + versión; aviso junto al campo. Verificado en vivo. |  |  |  |  | — |
| A4 · VH-065 | **HECHO 2026-10-11** (aprobado "Desplegar A4"): `analizar-mueble` v33 desplegada (sha `1b99f1ea…916f`). Re-descargada y comparada: 4/4 archivos byte-idénticos al repo. Verificada en vivo con qa-direccion: 401 sin JWT; texto → `ok`, `validacion {ok, ajustes:[], piezas:9, autoridad:SERVER_CATALOG}`, `catalogoFuente: canonico`, 9/9 piezas con id del catálogo; `ai_eventos` status ok, 260 insumos ofrecidos, tokens registrados. Rollback = redeploy v32 (`scratchpad/ef/`). |  |  |  |  | — |
| A5 · VH-068 | **HECHO 2026-10-11** (aprobado "Desplegar A5"): `acomodar-espacio` v10 desplegada (sha `51c9fc60…7387`). Re-descargada y comparada: index.ts, acomodo-core.js y spatial-core.js byte-idénticos; spatial-semantics.js difiere SÓLO en el escape de un rango unicode de una regex (`\u0300-\u036f` vs los caracteres literales: misma clase de caracteres) y en el salto de línea final. Verificada en vivo: 401 sin JWT; cuarto sin puertas ⇒ `REVIEW_REQUIRED`, `puertas.status NONE`, recomendación; cuarto en L con puerta ⇒ `PASS`, ambas piezas dentro del polígono; `ai_eventos` con `modo repair-loop-v10`, duración y `model_status deterministic`. Rollback = redeploy v9 (`scratchpad/ef-acomodar/`). |  |  |  |  | — |
| A6 · VH-049 | Edge `app` **verify_jwt:false** sirve una copia pública legacy de la app (build 19-ago) | Bucket `app`: 242 objetos, 22.6 MB | Retirar la edge y el bucket tras confirmar que nadie entra por ahí | Una versión vieja de la app, pública, con formulario de login | Si alguien la usa, se queda sin acceso: confirmar primero | S |
| A7 · VH-056 | `cotizacion_emitible` hashea sin folio/cliente/acomodo; el cliente usa `evaluar_emision_cotizacion` | Hash distinto entre RPCs | Alinear o retirar `cotizacion_emitible` | Dos verdades de "emitible" | Bajo si nadie más la llama | S |
| A8 | Deploy drift `costear-servidor` v5 (actualizada 2026-10-04) vs repo | Leído el bundle desplegado 2026-10-11: `validarIntentCosteo` idéntico; `index.ts` margen por omisión **40 vs 50** del repo (VH-041); `calculo.js` desplegado SIN el check "sin cantidad ni medidas" ni `estadoCosto/pendientes/costoOficial` (puede decir "certificado" donde el cliente dice incompleto) | Redeploy desde el repo (una sola verdad) | Dos motores con reglas distintas; la sombra compara contra un servidor viejo | Medio: el margen por omisión cambia de 40 a 50 cuando la config no lo trae — decisión de fórmula oficial, confirmar antes. Rollback: redeploy v5 | M |
| A9 | `cotizar-servidor` v6 desplegada sin ningún caller en el cliente | 0 `invoke` en `src`; duplica en parte `evaluar_emision_cotizacion` | Cablear (bloque LÍNEA V2) o retirar | Código desplegado que nadie prueba | Retirar: nulo. Cablear: L | S / L |
| A10 · VH-051 | **SUPERADO por VH-088 (2026-10-12)**: el motor ya costea con el catálogo (curado + ERP completo); lo que la IA ancla y no tiene precio queda PENDIENTE y se dice. Backlog de Compras: 9,304 precios ERP con compra >24 meses sin certificar + 62 insumos curados sin documento. |  |  |  |  | — |
| A11 · VH-051 | **HECHO 2026-10-12** (aprobado "hazlo todo"): 110 filas DATA_TRUTH_V1 con documento ERP (última compra 2026-08-10, Drive Compras); 103 aprobadas vía RPC; 7 `propuesto_validado` por compra >24 meses. `catalogo_vigente` aprobados 30 → 133. Sin documento siguen preliminares: 61 `propuesto` (semilla sin fuente) + 63 `propuesto_validado` (T.D.C./lista Compras/Sonara sin código ERP). Ver VH-083. |  |  |  |  | — |
| A12 · VH-074 | **CERRADO 2026-10-12 · NO ERA BUG** (la fila anterior estaba equivocada): `unidad_compra` es la unidad de compra (kg) y `precio` ya es por hoja (precio_compra × factor_conversion). Nada que corregir. |  |  |  |  | — |
| A13 · VH-075 | **HECHO 2026-10-12**: era 6.69 USD guardado como MXN. Fila 96 cerrada; fila 479 ERP A101 $115.949073/kg aprobada. Mismo defecto hallado y mitigado en `caja-byrne` (VH-082, $2,894.11 `propuesto`, requiere Compras). |  |  |  |  | — |
| A14 · VH-077 | **HECHO 2026-10-12** (aprobado "hazlo todo"; es FÓRMULA OFICIAL): `src/motor/politicaMerma.js` codifica lo que Producción dio con cifra: tablero con lado mayor > 1.50 m = ½ hoja (lado menor ≤ 0.60) o 1 hoja (> 0.60) en vez de la rejilla; pintura en polvo 8 m²/kg desde `areaPintadaM2`. Lo SIN cifra NO se inventó: pintura en tubular queda PENDIENTE (bloquea), excedente de canto sigue con `mermaCorte`. Tubo 6 m y lámina 0.91/1.22 ya eran política. `MOTOR_VERSION` 2026-10-03 → 2026-10-12 (las cotizaciones viejas conservan su huella). 14 pruebas golden nuevas; goldens de Alba/Intelisis intactos (2,042/2,042). Efecto medido: una tapa 1.60×0.60 pasa de 1 hoja (rejilla con kerf+orilla) a ½ hoja (regla de taller). |  |  |  |  | — |
| A15 · VH-076 | 4/15 piezas APPS LT con lista y piso por debajo del costo total ERP; las 15 entre 16 % y 76 % del precio de lista que el ERP calcula | Golden 15/15 + `lista_precio_items` | Dirección revisa horas "Otros" del ERP o la política de precios de patas/conductos. La app debe mostrar margen vs costo ERP cuando exista `producto_version_economia` (hoy 12 de 1,944) | Se cotiza "a precio estándar" sin saber que pierde | Ninguno técnico | Dirección |
| A16 · VH-078 | **HECHO 2026-10-12**: `cotizar-servidor` v7 (centavos) y v8 (RPC con JWT del usuario + fecha por omisión; v6/v7 daban 502). Verificado en vivo: centavos exactos. Hallazgo: sin caller en el cliente (A9) y `producto_version_economia` sin costos ⇒ ECONOMICS_INCOMPLETE. |  |  |  |  | — |
| A17 · VH-079 | **HECHO 2026-10-12 03:16 UTC**: `costear-servidor` v6 desplegado desde GitHub Actions (`deploy-edge.yml`, secret `SUPABASE_ACCESS_TOKEN` creado por Dirección) sobre `e625ac4`. Verificado en vivo: 401 sin sesión; `versionMotor 2026-10-12`, `versionCatalogo cat-ap133…`; margen 40 viene de `config.parametros` (no del código). La prueba en vivo destapó VH-086 (melamina-19 clasificada como laminado): corregido en este mismo PR y re-desplegado. |  |  |  |  | — |
| A18 · VH-079 | **HECHO 2026-10-12 03:16 UTC**: `acomodar-espacio-recovery` v7 desplegado con el mismo workflow. Verificado en vivo: contesta veredicto estructurado (`QUALITY_REVIEW_REQUIRED`, `mensaje_vendedor`). Hallazgo VH-087: aceptaba la llave pública como sesión; se agregó el candado de usuario y se re-despliega en este PR. |  |  |  |  | — |
| A19 | Rama principal única: `c3.4-seller-safe` pasa a ser la unificación (base = producción `5a38d2e`); Vercel producción apunta a ella. Las otras 41 ramas se dejan (no se borran) | Diff 5a38d2e↔c3.4 medido | Fusionar PR #27 y re-apuntar producción; verificar bundle vivo | Dos líneas de código, lo auditado sin usuarios | Medio: cambia lo que usan los usuarios; rollback = promover el deployment anterior en Vercel | **HECHO 2026-10-12 00:58 UTC** · merge `28874ab`, deployment `dpl_GRhGG2vdtbzK4uTrBPjdLM7TeuAY` promovido; rollback = promover `dpl_1m4bDohVjcqL86fcGHRhJTnw2rJc` |
| A20 | **HECHO 2026-10-12**: los 6 commits de `perfection-final` (`d698eea`…`7d60204`, Material Gate P0.1–P0.16 + fix de timeout en imagen/plano) se fusionaron en la línea unificada. 5 archivos en conflicto resueltos conservando AMBAS líneas (gate de 4 clases + VH-053 "material real sin precio certificado" + `data-testid` del e2e). vitest 1,965 → 2,028 en verde; e2e 25/25; build limpio; `no-undef` sin errores nuevos. Un test de VH-053 se adaptó a la política nueva (pariente compatible = costo PROVISIONAL bloqueado por `costeoEmitible`, ya no "candidato sin costo"). |  |  |  |  | — |
| A21 · VH-088 | **HECHO 2026-10-12** (Dirección: "ya migra el motor al catálogo de todas las compras"): motor (cliente + costear-servidor) lee `catalogo_motor()`; ERP completo cargado (10,964 registros con costo; 1,660 aprobados ≤24 meses; 9,304 preliminares; 1,108 bloqueados inactivos); IA sólo ve el catálogo curado; buscador ERP en Costeador/Asistente; Precios.jsx sólo lectura. Pendiente de Dirección/Compras: política para precios >24 meses (hoy cuestan pero no certifican). |  |  |  |  | — |
| A22 · VH-089 | **HECHO 2026-10-12**: pantalla "Cargar compras del ERP" (Dirección) + RPC `cargar_erp_ultima_compra`. Rutina: Compras exporta "Costos de Materia Prima Última Compra" (.xlsx) y Dirección lo sube; sin duplicados, ≤24 meses certifica. |  |  |  |  | — |
## B. Cliente — retirar código (cada uno con prueba de regresión antes) · **B1–B10 EJECUTADOS 2026-10-11** (10 commits en la rama; vitest 1,208 → 1,165 por los tests retirados)

Re-verificado hoy con `grep` de importadores fuera de tests. **Dos filas del inventario estaban mal y ya se corrigieron**:
`evidencia.js` SÍ se usa (flag `costing_ai_v2`) y `componentesSinMaterial` es respaldo interno del motor. No se retiran.

| # | Qué | Importadores en producción | Propuesta |
|---|-----|---------------------------|-----------|
| B1 | **HECHO 2026-10-11** · `scopeModel.js` + tests | 0 | commit propio; suite + build en verde antes y después |
| B2 | **HECHO 2026-10-11** · `politicaVH.costoFabVH` + tests | 0 | commit propio; suite + build en verde antes y después |
| B3 | **HECHO 2026-10-11** · `cotizarLinea.js` + `resolverComponentes.cotizarPorComponentes` + tests | 0 | commit propio; suite + build en verde antes y después |
| B4 | **HECHO 2026-10-11** · `floorSpec.validarFloorSpec/validarEnvolvente` + tests | 0 | commit propio; suite + build en verde antes y después |
| B5 | **HECHO 2026-10-11** · `planner.empacarFilas/guardasAMuro/MEET_CLR` | 0 | commit propio; suite + build en verde antes y después |
| B6 | **HECHO 2026-10-11** · `acomodo-core.acomodarConReparacion` (+`colocacionesValidas`, `recomendacionesParcial`) en el REPO y sus tests. `validarColocacion`/`resumenViolaciones` se conservan como oráculo de los tests del solver. La copia DESPLEGADA sigue en A5. | 0 | commit propio; suite + build en verde antes y después |
| B7 | **HECHO 2026-10-11** · `datos/voni.voniTurno` (+`construirRespuesta`, sólo la usaba él) y sus tests en 3 archivos | 0 | commit propio; suite + build en verde antes y después |
| B8 | **HECHO 2026-10-11** · `CocrearV2.jsx` | 0 | commit propio; suite + build en verde antes y después |
| B9 | **HECHO 2026-10-11** · `aprendizaje.leccionDeQuita/leccionDeCambio` | 0 | commit propio; suite + build en verde antes y después |
| B10 | **HECHO 2026-10-11** · `humo.jsx`, `plano.jsx` | 0 | commit propio; suite + build en verde antes y después |
| B11 | `Voni2.jsx` + `src/voni/*` | `App.jsx` (prod 2) | **Decisión tuya**: Q&A sin LLM se conserva o se retira. No es código muerto |
| B12 | Edges sin caller: `generar-video` v4, `bootstrap-temp-claude` v5, `costear-vision` v4, `*-strict` ×4, `analizar-mueble-preview`, `voni-council-health`, `acomodar-espacio-recovery` | 0 `invoke` en `src` | Confirmar con quien las desplegó y retirar o versionar |

## C. Datos legacy — NO se tocan sin tu firma

| # | Qué | Evidencia | Propuesta |
|---|-----|-----------|-----------|
| C1 · VH-022 | 5 cotizaciones de vendedor con 17 partidas con `costoUnitario` ≠ 0 y 5 con `margen` (previas al strip) | Medido 2026-10-04 | RPC seller-safe + restringir SELECT base (bloque propio). NO limpiar las 5 filas: histórico |
| C2 | 8 partidas + 14 acomodos con imágenes base64 dentro de la fila | Medido 2026-10-10 | Migración a Storage preservando la economía del vendedor. Se corre en aislado con antes/después |
| C3 | Residuos de la verificación en vivo del 2026-10-11 con `qa-direccion@vonhaucke.mx`: 2 cotizaciones autoguardadas (sin folio, sin emitir), 2 renders en `renders/generated/qa-direccion…`, 2 `render_eventos`, 5 `ai_eventos` | Medido tras la pasada | Borrar las 2 cotizaciones y los 2 objetos de Storage; conservar los eventos (son uso real). También: cambiar la contraseña trivial de esa cuenta o bajarla a vendedor |

## E. RC Rescate P0 (2026-10-12) — autorizaciones para salir de la rama

| # | Qué | Evidencia | Propuesta |
|---|-----|-----------|-----------|
| E1 | Desplegar cliente (Vercel) desde la rama (`29522e4`): P0-02, P0-04 cliente, VH-090/090b/091/092/094/095/095b/096/**109** | vitest 2,112 verdes, build OK, golden 757 con persistencia real (`docs/auditoria/RESCATE_NOCTURNO.md` § RELEASE GATE); rollback = redeploy `766df46` | **HECHO 2026-10-12 12:39 UTC**: PR #33 merge `195d245`, Vercel READY; certificación real PASS |
| E2 | Desplegar edges `costear-servidor` v9, `acomodar-espacio-recovery` v9, `leer-plano-core`, `leer-plano` | mismo RC; `acomodar-espacio-recovery` certificado bajo Deno 2.9.7 con JWT real (golden 757 `EDGE_RC_URL`); rollback = `deploy-edge` desde `766df46` (v8/v8/v11/v4) | **HECHO 2026-10-12 12:33 UTC**: run 38249672095 → v9 / v9 / v5 / v12 |
| E3 | Aplicar `20261012060000_vh099_dimensiones_catalogo.sql` y correr `derivar_dimensiones_catalogo(true)` | dry-run: 1,738 PVs derivables (PRELIMINAR, con evidencia) | aplicar + dry-run + aplicar |
| E4 | Aplicar `20261012061000_vh100_cargar_costos_oficiales.sql` y cargar el reporte de costo Intelisis por clave | 1,931 partidas sin economía; RPC con procedencia | **tú consigues el reporte**; luego se carga y se demuestra cotizar→autorizar→emitir v2→PDF→reabrir con datos aislados |
| E5 | P0-03: re-firmar el lote de 1,763 (approved_by real) o degradarlo a `propuesto_validado`; regla "compra > 12 m no es vigente" (526); documentar o degradar los 30 `reconciliacion`; retirar `QA_FIXTURE_*` (10) | SQL en la matriz | decisión tuya; no se toca sin firma |

| E6 | Nuevo deploy coordinado E1+E2 del RC de estabilización (VH-108/110–122, cierre definitivo del 12-oct): cliente + `acomodar-espacio-recovery` + `generar-render` + `analizar-mueble` (plan y rollback en § Fase 8 del cierre) | § ESTABILIZACIÓN POST-DEPLOY; vitest y Playwright locales verdes; golden + 3 proyectos | mismo protocolo que el 12-oct; rollback `195d245` |
| E7 | Crear cuentas QA `qa-ventas` / `qa-diseno` (Auth + `permitidos`) para certificar roles en producción | procedimiento mínimo en el gate | tú las creas; sin contraseñas en el chat |

## D. Lo que YA está hecho y no requiere decisión (sólo que lo sepas)

Lectura de planos (VH-064), acomodo con IA (VH-067), Costeador (VH-066), Cotizar con IA (VH-070/071) y render
(VH-072, P0) ya leen las respuestas del servidor con criterio fail-closed y están cubiertos por e2e con nube falsa.
Suite al corte (línea unificada, 2026-10-12): vitest 1,965 · Playwright 25 (+16 que requieren credenciales) · build limpio · `no-undef` 0.

---
Formato para aprobar: responde con los códigos (p. ej. "A1, A3 sólo descuento, B1–B10, C2") y se ejecuta en ese
orden, cada uno con su prueba antes/después y su commit separado. Lo que no nombres se queda como está.
