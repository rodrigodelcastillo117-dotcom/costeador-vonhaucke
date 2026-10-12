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
| A10 · VH-051 | 165 de 259 insumos del servidor sin precio certificado por Compras | Medido 2026-10-10 | Backlog de certificación (Compras) | La IA ancla materiales que el motor no puede costear (quedan PENDIENTE, correcto pero inútil) | Ninguno técnico | Compras |
| A11 · VH-051 | Sólo 30 de 259 insumos cumplen la definición de CERTIFICADO del propio sistema (`estado='aprobado' and certificable`); 166 `propuesto_validado`, 61 `propuesto`, 2 sin precio. 71 vienen de "código SEMILLA" o "codigo=nube" sin documento. | Medido 2026-10-11 en `catalogo_vigente` | Dirección decide por escrito qué FUENTES cuentan como certificadas (ERP última compra 99, T.D.C. 24, lista Compras 15 = 138). Migración de un campo. SEMILLA/nube NO se certifican sin documento. | El costeo sale INCOMPLETO con cualquier insumo fuera de los 30 | Bajo; reversible por fuente | Dirección + S |
| A12 · VH-074 | 6 láminas con precio de HOJA etiquetado "kg" en `catalogo_vigente`; 2 duplicadas hoja/kg | ERP: LN10310 $2,270.17/hoja | `unidad_compra='hoja'` en lamina-10/12/14/18/20/22; borrar duplicados "kg" | Si el motor migra al catálogo del servidor, lámina ~70× más cara | Bajo; golden antes/después | S |
| A13 · VH-075 | `pintura-polvo` $6.69/kg vs ERP $170–238/kg (parece USD sin moneda) | ERP ATPU3M y T.D.C. repisa | Corregir con documento de Compras o degradar a `propuesto` sin precio | Pintura ~25× subcosteada si se usa ese id | Bajo | Compras + S |
| A14 · VH-077 | Reglas de merma de Producción (Rogelio) no son política del motor: >1.50×0.60 = ½ hoja; >0.60 ancho = 1 hoja; pintura 8 m²/kg; canto excedente por lado; tubo 6 m; lámina 0.91/1.22 | Doc "comentarios Rogelio y Alba" | Codificarlas como política oficial (`hojas` determinista cuando la IA no las da) con golden contra T.D.C. | El motor sigue usando aprovechamiento 80 % supuesto | Medio: cambia costos; es FÓRMULA OFICIAL → aprobación expresa | M |
| A15 · VH-076 | 4/15 piezas APPS LT con lista y piso por debajo del costo total ERP; las 15 entre 16 % y 76 % del precio de lista que el ERP calcula | Golden 15/15 + `lista_precio_items` | Dirección revisa horas "Otros" del ERP o la política de precios de patas/conductos. La app debe mostrar margen vs costo ERP cuando exista `producto_version_economia` (hoy 12 de 1,944) | Se cotiza "a precio estándar" sin saber que pierde | Ninguno técnico | Dirección |
| A16 · VH-078 | `cotizar-servidor`: desplegar la fuente unificada (código desplegado v6 + centavos de `7153e9d`). Hoy el servidor redondea al peso y el cliente suma a centavos | Diff byte a byte repo↔desplegado; `quoteEmissionAuthority` verde | Desplegar v7 y verificar en vivo una cotización con precio no entero | Diferencias de centavos entre pantalla y servidor; precio especial sólo existe desplegado | Bajo-medio: cambia totales en centavos; smoke en vivo obligatorio | A |
| A17 · VH-079 | `costear-servidor`: desplegar la fuente (juez `costeoEmitible`, centavos, margen 50). El motor desplegado reproduce el ERP 15/15 | Golden contra snapshot desplegado | Desplegar v6 | Server sugiere precio con margen 40 y redondea al peso | Bajo | A |
| A18 · VH-079 | `acomodar-espacio-recovery`: desplegar la fuente del RESCATE 2026-10-10 (visitas en privado, `semantic_issues`) | Comentario en la fuente: "hasta que Rodrigo autorice" | Desplegar v7 | Privados con CONCERTO de visita caen en NEEDS_SEMANTIC_REVIEW sin explicación | Bajo-medio | A |
| A19 | Rama principal única: `c3.4-seller-safe` pasa a ser la unificación (base = producción `5a38d2e`); Vercel producción apunta a ella. Las otras 41 ramas se dejan (no se borran) | Diff 5a38d2e↔c3.4 medido | Fusionar PR #27 y re-apuntar producción; verificar bundle vivo | Dos líneas de código, lo auditado sin usuarios | Medio: cambia lo que usan los usuarios; rollback = promover el deployment anterior en Vercel | **HECHO 2026-10-12 00:58 UTC** · merge `28874ab`, deployment `dpl_GRhGG2vdtbzK4uTrBPjdLM7TeuAY` promovido; rollback = promover `dpl_1m4bDohVjcqL86fcGHRhJTnw2rJc` |
| A20 | Revisar los 6 commits de `perfection-final` posteriores a `5a38d2e` (`d698eea`…`7d60204`, P0.9–P0.16) e integrar lo que tenga prueba | `git log 5a38d2e..7d60204` | Revisión uno por uno | Trabajo posiblemente útil fuera de producción | Bajo | M |

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

## D. Lo que YA está hecho y no requiere decisión (sólo que lo sepas)

Lectura de planos (VH-064), acomodo con IA (VH-067), Costeador (VH-066), Cotizar con IA (VH-070/071) y render
(VH-072, P0) ya leen las respuestas del servidor con criterio fail-closed y están cubiertos por e2e con nube falsa.
Suite al corte (línea unificada, 2026-10-12): vitest 1,965 · Playwright 25 (+16 que requieren credenciales) · build limpio · `no-undef` 0.

---
Formato para aprobar: responde con los códigos (p. ej. "A1, A3 sólo descuento, B1–B10, C2") y se ejecuta en ese
orden, cada uno con su prueba antes/después y su commit separado. Lo que no nombres se queda como está.
