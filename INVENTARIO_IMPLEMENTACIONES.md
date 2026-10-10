# Inventario de implementaciones · CONSERVAR / CONSOLIDAR / SUSTITUIR / RETIRAR

**Corte:** rama `claude/costing-app-architecture-psf02g` @ `ff7e482` + producción Supabase `mtuvnbgljwbsaizjjgzs` (2026-10-10).
**Método:** consumidores reales en código (archivos no-test que importan o invocan cada pieza), funciones edge
desplegadas vs. invocadas por el cliente, y los cuatro informes de causa raíz del 2026-10-10. No se retira nada
con este documento: **RETIRAR es una propuesta que requiere tu aprobación** (mandato §1 y §11).

Leyenda de "prod": archivos de producción que la consumen (sin contar el archivo que la define).

## 1. Persistencia e integridad de cotizaciones (Bloque 1, hecho)

| Implementación | Clase | Evidencia / nota |
|---|---|---|
| `guardarEnNube()` en App.jsx + RPCs `crear/actualizar_cotizacion_segura` | CONSERVAR | Única puerta de guardado. Certificada: 12 unit, 8 E2E, 8 en PostgreSQL aislado. |
| `cotizaciones.js` (paraGuardar, firma, clasificación de error) | CONSERVAR | Autoridad de la fila que se guarda. |
| `totales.js` `totalesCotizacion` | CONSERVAR | Única fuente de la escalera de dinero (prod 4). |
| INSERT/UPDATE directos a `cotizaciones` desde el cliente | RETIRADO | Ya no existe en la rama. |
| `almacen.exportar/importar` (Precios.jsx, exporta TODO el estado) | SUSTITUIR por `respaldo.js` | El nuevo respalda por rol y sin nómina; el viejo exporta nómina en claro si no hay candado. Retirar cuando Dirección confirme que no lo usa. |
| Migración `20261010170000_actualizar_cotizacion_preserva_economia` | BLOQUEADO (tu aprobación) | Sin ella, en producción vendedor/diseño siguen pisando costos de Dirección. |

## 2. Contrato de partida e identidad de producto (siguiente bloque)

| Implementación | Clase | Evidencia |
|---|---|---|
| 6 constructores de partida en App.jsx (`partidaDeCosteo`, addon, `onAgregarCotizacion`, `partidasDeItemsIA`, `agregarDeBanco`, `agregarArticuloLinea`) + 2 mutadores (EditarPartida, reabrir) | CONSOLIDAR → 1 `crearPartida()` con validador | Cada uno pierde campos distintos (`producto_id`, `source_ref`, `lista_precio_item_id`); nombres en conflicto `productoId`/`producto_id`, `productVersionId`/`producto_version_id`. |
| Pre-formas en `lineas.js` (`partidaCatalogo`, `partidaModelo`, `sellerSafePartida`, `sinPrecioVendedor`, `conIdentidadV2`) y `CotizadorIA.partidaBanco` | CONSOLIDAR (adaptadores del constructor único) | Se conservan como adaptadores de entrada, no como constructores. |
| `precioAutorizado.js` (identidad Producto Maestro) | CONSERVAR | prod 3 (lineas, CotizadorIA, CosteadorLinea). |
| `scopeModel.js` | RETIRAR (propuesta) | prod 0; solo tests. |
| `evidencia.js` | RETIRAR (propuesta) | prod 0; solo lo usaba `estructura.js` y ya no. |
| 7 vocabularios de procedencia (`provenance.js`, `confianza.js`, `programaDelPlano.fuente`, `evidencia.js`, `util.selloPartida`, `voni/respuesta`, `datos/voni.EVID`) | CONSOLIDAR → 1 enum `detectado/inferido/sugerido/confirmado` | Hoy cada etapa aplana la procedencia de la anterior. |

## 3. Autoridad económica y emisión

| Implementación | Clase | Evidencia |
|---|---|---|
| `motor/calculo.js` `calcular` + `FORMULA_ALBA_V1` | CONSERVAR (fórmulas intocables) | prod 17. Alba cubre 7/130 productos; legacy por línea 99; horas 24. No se migra entre métodos sin validación (mandato §3). |
| `costeoEmitible` (completitud) | CONSERVAR y hacer obligatorio | prod 4. `calcular` debe devolver estado, no número suelto. |
| `componentesSinMaterial` | CONSOLIDAR en `costeoEmitible` | Segundo juez, más débil (no ve insumo sin precio). prod 3. |
| 7 fórmulas costo→precio (`precioDe` ×2.0, `precioVenta·precioDeLista` ×2.16, `politicaVH.preciosVH` ×2.21, HojaCosto ×1.45, Catálogo, costear-servidor 40 %, Cocrear) | CONSOLIDAR → 1 función + política versionada | HojaCosto muestra dos precios de lista distintos para la misma pieza. |
| Márgenes por omisión 50 vs 40 vs 30 (calculo, lineas, Asistente, Catalogo, Costeador, Cocrear, costear-servidor, `costeoEnBlanco`) | CONSOLIDAR → 1 política (VH-019) | |
| `politicaVH.costoFabVH` | RETIRAR (propuesta) | prod 0; duplica Alba con otros factores. |
| `cotizarLinea.cotizarArticulo`, `resolverComponentes.cotizarPorComponentes` | RETIRAR (propuesta) | prod 0 (solo se definen). |
| `costoImplicito` (5 variantes de costo derivado del precio) | CONSOLIDAR → marcar `costoDerivado` siempre | prod 4; hoy `claseCosto` los etiqueta "real". |
| 10 compuertas de emisión (senales ×2, voniContext, excluidas, candado, RPC `cotizacion_emitible`, `emitir_revision`, `bajoPiso`, `hayLineaInvalida`, `costeoEmitible`) | CONSOLIDAR → 1 gate servidor + 1 proyección cliente | No coinciden entre sí. |
| RPC `emitir_revision` (legacy) usado por el cliente; `emitir_revision_v2` (anti-tamper) existe y no se usa | SUSTITUIR cliente → v2 | `revisiones.js:77`. |
| `asignar_folio_oficial`, `resolver_precio_autorizado`, `vincular_cotizacion`, `producto_cotizable` | CONSERVAR y CONECTAR | Existen en la base, el cliente no los llama; el folio del PDF es texto libre. |
| `aprobaciones.js` + RPCs `solicitar_*/resolver_aprobacion` | CONSOLIDAR | Cliente escribe la tabla `aprobaciones` directo (crm.js); la máquina de estados no tiene consumidor real. |
| `pdfPropuesta.datosDesdeSnapshot` | CONSERVAR y CONECTAR | prod 0; el PDF se arma del estado vivo. Mandato §4: PDF = snapshot. |
| `FichaPDF` (IVA sin descuento/maniobras/flete) y `window.print()` | CONSOLIDAR → un solo render de documento | prod 7. |

## 4. Costear y despiece

| Implementación | Clase | Evidencia |
|---|---|---|
| 24 generadores de línea (`src/datos/<linea>.js`, 130 productos) | CONSERVAR (congelar con snapshot) → luego BOM como dato | Recetas = conocimiento industrial. `KG20 = 7.16` copiado en 8 archivos; conversiones geométricas locales en cada uno. |
| `netoComponente` (unit-blind) | SUSTITUIR por conversión con `unidad` explícita | luna.js documenta un error 14.9×. |
| `recetas.construirCosteo` + `PIEZAS_SEMILLA` (segundo sistema de BOM) | CONSOLIDAR | prod 2 (Asistente, Catálogo). Defaults 55/12 que el cutover Alba ya no siembra. |
| `mapIaComps` duplicado (AsistenteEspecial + Costeador) | CONSOLIDAR | Misma función en dos pantallas. |
| `validarIntentCosteo` | CONSERVAR y COMPARTIR cliente/servidor | Solo servidor; su cabecera miente. |
| `costear-servidor` (sombra) | SUSTITUIR llamada del cliente | VH-036: rechaza el 100 % por `margen` en el payload. |
| `costoPieza` por renglón (Costeador.jsx, AsistenteEspecial.jsx) | CONSOLIDAR en el motor | Dos cálculos paralelos sin USD ni nesting. |
| 3 catálogos de insumos (`insumos.js` semilla, `config.datos.insumos`, `insumos_catalogo/catalogo_vigente`) | CONSOLIDAR → `catalogo_vigente` | El LLM elige ids de uno y el navegador costea con otro. |
| `bomHash/diffBOM` | CONSERVAR (corregir clave por nombre) | prod 2. |

## 5. Interpretación de planos y acomodo

| Implementación | Clase | Evidencia |
|---|---|---|
| `leer-plano` (edge) + `planoLeido.areasDeLectura` + `floorPlan` | CONSERVAR (contrato único; `puestos` ya viaja) | prod 4. Falta compuerta de confirmación y validación de escala contra `grid`. |
| `leerPlanoArchivo.js` y `Acomodo.procesarPlano` (dos orquestadores de la misma lectura) | CONSOLIDAR → 1 | base64/downscale duplicados. |
| `floorSpec.validarFloorSpec/validarEnvolvente` | RETIRAR o CONECTAR (decidir) | prod 0; su forma no coincide con lo que emite leer-plano. |
| `planner.acomodarLocal` + `malla.acomodarEnForma` | CONSERVAR y CORREGIR (VH-033) | prod 3. Sillas sin plan B; pasada 2 pierde piezas y reporta `caben:true`. |
| `reacomodar`, `sentarSillas`, `rellenar`, `orientacion.enderezar` | CONSOLIDAR dentro del solver | Capas que se parchan entre sí (sentar→enderezar→re-sentar). |
| `planner.empacarFilas`, `guardasAMuro`, `MEET_CLR` | RETIRAR (propuesta) | Sin llamadas. |
| 7 clasificadores por nombre (`rolArea`, `rolCuartoBase`, `zonaSemantica`, `espacio.tipoDe`, `rolDePiezaAcomodo`, `esSilla*`, `rolDeSimboloEnZona`) | CONSOLIDAR → 1 | Se contradicen ("Sala de espera": lounge vs CONSEJO). |
| Edge `acomodar-espacio` (`acomodo-core.planearDeterminista`, botón "Con IA") | SUSTITUIR o RETIRAR | Motor más débil, contrato distinto (`poly`/`polygon`, `h`/`d`), sin LLM aunque el botón diga IA. |
| `acomodo-core.acomodarConReparacion` | RETIRAR (propuesta) | prod 0 (solo tests). |
| 6 validadores (`acomodoAudit`, `floorSpec.violacionesSemanticas/estadoLayout`, edge `validarColocacion`, auto-auditorías `ok:true`, `auditoriaMedida`, BFS malla) | CONSOLIDAR → 1 auditor | Las auto-auditorías `ok:true` hardcodeadas no son validación. |
| `PlanoAcomodo.layoutAreas` y `pdfPropuesta.hojaPlano` | CONSOLIDAR | Dos dibujos de planta. |
| `espacioNuevo.js` (m² → áreas) | CONSERVAR | prod 1 (EmpezarEspacio). |

## 6. VONI y Council

| Implementación | Clase | Evidencia |
|---|---|---|
| `CotizadorIA.jsx` + edge `cotizar-texto` | CONSERVAR (es "el Voni" de texto→partidas) | prod 3. |
| `Voni.jsx` (wizard 4 pasos) | CONSERVAR | prod 2. |
| `Voni2.jsx` + `src/voni/*` (Q&A determinista, sin LLM) | CONSOLIDAR o RETIRAR (decidir) | prod 2; `voni/permisos.js` prod 0; tres filtros de rol que no coinciden (`datos/voni`, `voniContext`, `voni/permisos`). |
| `datos/voni.js` `voniTurno` (orquestador propone→valida→ejecuta) | RETIRAR (propuesta) | prod 0; 3 tests prueban código que no corre. |
| `CocrearV3.jsx` | CONSERVAR (consolidar con Costear/Cotizar) | Live. Aplica el cambio por regex ANTES de preguntar al council. |
| `CocrearV2.jsx` | RETIRAR (propuesta) | prod 0. |
| `Asistente.jsx` (wizard determinista 1 pieza) | CONSOLIDAR | Duplica precio con otra fórmula y margen 40. |
| `aprendizaje.leccionDeQuita/leccionDeCambio` | RETIRAR (propuesta) | prod 0. |
| Aprendizajes automáticos (texto libre del vendedor → system prompt global) | SUSTITUIR por aprendizaje con revisión y permisos | Mandato §6: evidencia, procedencia, revisión. |
| `nube.generarVideo` + edge `generar-video` | RETIRAR (propuesta) | prod 0. |
| `humo.jsx`, `plano.jsx` | RETIRAR (propuesta) | No son entradas de Vite ni se importan. |

## 7. Funciones edge en producción (hallazgo VH-039)

**23 desplegadas · 8 invocadas por el cliente (+`usuarios`) · 10 en el repo.** Las 13 siguientes NO están en el repo:

| Función (prod) | ¿La invoca el cliente? | Clase |
|---|---|---|
| `app` (**verify_jwt: false**, v4, ago-2026) | No | RETIRAR tras confirmar que no la usa el hosting del index |
| `bootstrap-temp-claude` (v5, ago-2026) | No | RETIRAR (nombre sugiere arranque temporal de una sesión de IA) |
| `costear-vision` | No | RETIRAR o versionar |
| `analizar-mueble-strict`, `leer-plano-strict`, `acomodar-espacio-strict`, `generar-render-strict` | No | RETIRAR (variantes paralelas) |
| `leer-plano-core` | No | Decidir: ¿es la base de `leer-plano` v11? |
| `voni-council` (v12) | **Sí** | CONSERVAR y **versionar en el repo** (su código no existe aquí) |
| `voni-council-health` | No | RETIRAR o versionar |
| `acomodar-espacio-recovery` (v6, actualizado hoy) | No | Decidir |
| `analizar-mueble-preview` | No | RETIRAR (variante) |
| `costear-compras-rc` (v3, ayer) | No | Decidir: ¿es el trabajo de precios de Compras? |

Regla desde hoy (igual que las migraciones): ninguna función edge se despliega sin su carpeta en `supabase/functions/`.

## 8. Decisiones que son tuyas
1. Aplicar la migración `20261010170000` (cierra el punto uno del mandato).
2. Aprobar la lista RETIRAR (propuesta) de los §2–§7; se retira módulo por módulo, cada uno con su prueba de regresión antes.
3. `app` sin JWT y `bootstrap-temp-claude`: confirmar si algo las usa antes de borrarlas.
4. `Voni2`/`src/voni`: conservar como Q&A sin LLM o retirar.
