# Decisiones pendientes de Dirección · corte 2026-10-11

Todo lo de esta lista está **bloqueado por el mandato** ("No se autoriza alterar producción, desplegar,
fusionar ramas, eliminar datos ni modificar fórmulas oficiales sin aprobación expresa"). Nada de aquí se
ejecuta hasta que lo apruebes por escrito, punto por punto. Cada fila trae la evidencia medida, la propuesta,
el riesgo si NO se hace, el riesgo de hacerlo y cómo se regresa.

Convención de esfuerzo: **S** (< 2 h con prueba), **M** (medio día), **L** (bloque propio con smoke + rollback).

## A. Servidor (edges y base) — requieren redeploy o migración

| # | Qué | Evidencia medida | Propuesta | Si NO se hace | Riesgo de hacerlo / rollback | Esf. |
|---|-----|------------------|-----------|---------------|------------------------------|------|
| A1 · VH-069 | `cotizar-texto` v12 y `analizar-negocio` v1 sin compuerta de rol, sin límite/hora, sin `ai_eventos` | 0 filas de ambas en `ai_eventos`; las otras 3 edges IA sí registran. 11 usuarios auth = 11 permitidos (hoy exposición interna) | Mismo wrapper que `leer-plano`: `permitidos`+rol, 30/h usuario, 200/h global fail-closed, `ai_eventos` al inicio, `request_id` | Gasto Opus sin tope ni rastro; un token filtrado = Opus gratis | Bajo. Rollback: redeploy versión anterior | M |
| A2 · VH-060 | `cotizar-texto`/`analizar-negocio` aceptan `reglas` y `aprendizajes` del body como "REGLAS DE LA CASA (MANDAN)" | Cliente ya manda sólo lo aprobado (VH-059), pero el servidor no lo verifica | Leer reglas y aprendizajes aprobados de la base (service_role) e ignorar el body | Un cliente modificado dicta reglas al modelo | Bajo. Rollback: redeploy | M |
| A3 · VH-063 | Vendedor no sabe antes de verificar que su descuento exigirá aprobación | Política vigente (25 % / 40 %) sólo legible por Dirección/service_role. `cotizar-servidor` v6 YA devuelve el umbral a cualquier rol permitido | Aplicar `supabase/migrations/20261011180000_politica_comercial_publica.sql` (expone sólo `version`, `margen_minimo_pct`, `descuento_max_sin_aprobacion`) y avisar junto al campo de descuento | Vendedor descubre al final "requiere aprobación" sin saber por qué | Expone el margen mínimo (25 %) al vendedor: decidir si eso es aceptable; si no, exponer sólo el descuento. Rollback: `drop function` | S |
| A4 · VH-065 | `analizar-mueble` v32 no valida en servidor la propuesta de la IA | `JSON.parse` sin validar ids ∈ catálogo ni números > 0; pistas del cliente sin marca; `canonicoOk` ignora `catalogo_vigente` | Validador determinista tras el parse; `canonicoOk = rc.ok && rp.ok`; marcar pistas "(no certificado)" | El cliente lo contiene (NOT_AVAILABLE, PENDIENTE), pero la verdad vive en el navegador | Bajo. Rollback: redeploy | M |
| A5 · VH-068 | `acomodar-espacio` v9: obstáculos sólo con clearance, área cruda vs normalizada, puertas ausentes ⇒ PASS, error del modelo tragado, límite contado al final, validador muerto | Leído el código desplegado (índices de línea en el ledger) | Usar `_g` + obstáculos para toda pieza; puertas ausentes ⇒ REVIEW_REQUIRED; `model_error` en respuesta; `ai_eventos` al inicio; borrar `acomodarConReparacion` | Un acomodo del servidor puede poner una guarda sobre una columna y salir PASS | Medio: cambia veredictos (más REVIEW). Rollback: redeploy | L |
| A6 · VH-049 | Edge `app` **verify_jwt:false** sirve una copia pública legacy de la app (build 19-ago) | Bucket `app`: 242 objetos, 22.6 MB | Retirar la edge y el bucket tras confirmar que nadie entra por ahí | Una versión vieja de la app, pública, con formulario de login | Si alguien la usa, se queda sin acceso: confirmar primero | S |
| A7 · VH-056 | `cotizacion_emitible` hashea sin folio/cliente/acomodo; el cliente usa `evaluar_emision_cotizacion` | Hash distinto entre RPCs | Alinear o retirar `cotizacion_emitible` | Dos verdades de "emitible" | Bajo si nadie más la llama | S |
| A8 | Deploy drift `costear-servidor` (3 archivos del repo ≠ desplegado) | Comparado 2026-10-10 | Decidir cuál es la verdad y alinear repo ↔ deploy | El repo no describe producción | Medio. Rollback: redeploy anterior | M |
| A9 | `cotizar-servidor` v6 desplegada sin ningún caller en el cliente | 0 `invoke` en `src`; duplica en parte `evaluar_emision_cotizacion` | Cablear (bloque LÍNEA V2) o retirar | Código desplegado que nadie prueba | Retirar: nulo. Cablear: L | S / L |
| A10 · VH-051 | 165 de 259 insumos del servidor sin precio certificado por Compras | Medido 2026-10-10 | Backlog de certificación (Compras) | La IA ancla materiales que el motor no puede costear (quedan PENDIENTE, correcto pero inútil) | Ninguno técnico | Compras |

## B. Cliente — retirar código (cada uno con prueba de regresión antes)

Re-verificado hoy con `grep` de importadores fuera de tests. **Dos filas del inventario estaban mal y ya se corrigieron**:
`evidencia.js` SÍ se usa (flag `costing_ai_v2`) y `componentesSinMaterial` es respaldo interno del motor. No se retiran.

| # | Qué | Importadores en producción | Propuesta |
|---|-----|---------------------------|-----------|
| B1 | `scopeModel.js` | 0 | Retirar con sus tests |
| B2 | `politicaVH.costoFabVH` | 0 (sólo su definición) | Retirar; duplica Alba con otros factores |
| B3 | `cotizarLinea.cotizarArticulo`, `resolverComponentes.cotizarPorComponentes` | 0 | Retirar |
| B4 | `floorSpec.validarFloorSpec` / `validarEnvolvente` | 0 | Retirar: la validación determinista vive en la edge y el cliente ya la consume (VH-064) |
| B5 | `planner.empacarFilas`, `guardasAMuro`, `MEET_CLR` | 0 | Retirar |
| B6 | `acomodo-core.acomodarConReparacion` (repo y edge) | 0 | Retirar (va con A5) |
| B7 | `datos/voni.voniTurno` | 0 (3 tests prueban código que no corre) | Retirar con sus tests |
| B8 | `CocrearV2.jsx` | 0 | Retirar (V3 es el camino) |
| B9 | `aprendizaje.leccionDeQuita` / `leccionDeCambio` | 0 | Retirar |
| B10 | `humo.jsx`, `plano.jsx` | No son entradas de Vite; `plano.jsx` importa `Voni2` | Retirar |
| B11 | `Voni2.jsx` + `src/voni/*` | `App.jsx` (prod 2) | **Decisión tuya**: Q&A sin LLM se conserva o se retira. No es código muerto |
| B12 | Edges sin caller: `generar-video` v4, `bootstrap-temp-claude` v5, `costear-vision` v4, `*-strict` ×4, `analizar-mueble-preview`, `voni-council-health`, `acomodar-espacio-recovery` | 0 `invoke` en `src` | Confirmar con quien las desplegó y retirar o versionar |

## C. Datos legacy — NO se tocan sin tu firma

| # | Qué | Evidencia | Propuesta |
|---|-----|-----------|-----------|
| C1 · VH-022 | 5 cotizaciones de vendedor con 17 partidas con `costoUnitario` ≠ 0 y 5 con `margen` (previas al strip) | Medido 2026-10-04 | RPC seller-safe + restringir SELECT base (bloque propio). NO limpiar las 5 filas: histórico |
| C2 | 8 partidas + 14 acomodos con imágenes base64 dentro de la fila | Medido 2026-10-10 | Migración a Storage preservando la economía del vendedor. Se corre en aislado con antes/después |

## D. Lo que YA está hecho y no requiere decisión (sólo que lo sepas)

Lectura de planos (VH-064), acomodo con IA (VH-067), Costeador (VH-066), Cotizar con IA (VH-070/071) y render
(VH-072, P0) ya leen las respuestas del servidor con criterio fail-closed y están cubiertos por e2e con nube falsa.
Suite al corte: vitest 1,199 · Playwright 23 · build limpio · CI 561–565 en verde.

---
Formato para aprobar: responde con los códigos (p. ej. "A1, A3 sólo descuento, B1–B10, C2") y se ejecuta en ese
orden, cada uno con su prueba antes/después y su commit separado. Lo que no nombres se queda como está.
