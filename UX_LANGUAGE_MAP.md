# Mapa de "lenguaje humano" — Von Haucke

> **Regla absoluta:** el estado interno NO cambia. Los códigos, enums y gates siguen
> exactamente igual en el motor, el servidor y el PDF. Lo único que cambia es **cómo se
> le presenta al usuario**: una frase en español que entiende una persona normal + un
> color. Nada de esta tabla modifica lógica, solo traduce texto mostrado.

> **Semántica de los 3 colores**
> - 🟢 **Verde = todo listo.** El estado está validado; se puede avanzar/emitir sin más.
> - 🟡 **Amarillo = puedes continuar, pero revisa.** NUNCA debe sentirse como error.
>   Falta un dato, una confirmación o una validación opcional, pero el trabajo sigue
>   (como borrador, o resolviéndolo con Diseño/Dirección). Siempre dice "puedes
>   continuar" cuando de verdad se puede.
> - 🔴 **Rojo = no es seguro continuar.** Solo para lo que DE VERDAD debe bloquear:
>   costo incorrecto/inválido, emisión económica inválida, pérdida de información,
>   permiso inválido, geometría físicamente imposible, margen prohibido, o mostrarle al
>   cliente algo que no debe ver.

Calibración (del brief): `DEPENDENT_DETACHED` → "Esta silla quedó demasiado lejos de su
mesa." (🟡) · `ECONOMICS_INCOMPLETE` → "Falta confirmar un costo antes de emitir esta
propuesta." (🟡). Lo que hoy se ve alarmante pero permite seguir → 🟡 con "puedes
continuar".

---

## A. Emisión / Cotización

`ESTADO_EMISION` (bucket del gate) y los motivos crudos de `textoRazonEmision`. El gate
sigue siendo server-side y sigue mandando; aquí solo se humaniza el chip/banner.

| código interno | dónde aparece (archivo) | frase humana propuesta (es-MX, 1 frase) | color | ¿puede continuar? |
|---|---|---|---|---|
| ALLOWED | emisionUX.js:72 · Cotizacion.jsx:950 | Lista para emitir. | 🟢 verde | Sí |
| DESCONOCIDO | emisionUX.js:73 | No se pudo consultar al servidor; se vuelve a verificar al emitir. | 🟡 amarillo | Sí (reintenta al emitir) |
| ECONOMICS_INCOMPLETE | emisionUX.js:74 | Falta confirmar un costo antes de emitir esta propuesta (no es un error). | 🟡 amarillo | Sí (como borrador) |
| APPROVAL_REQUIRED | emisionUX.js:75 | Requiere aprobación de Dirección antes de emitir. | 🟡 amarillo | Sí (solicita aprobación) |
| BLOCKED | emisionUX.js:76 | Todavía no se puede emitir; resuelve lo señalado. | 🔴 rojo | No para emitir |
| linea_N_costo_desconocido | emisionUX.js:14 | Falta confirmar el costo con Diseño/Dirección. | 🟡 amarillo | Sí (borrador) |
| recosteo_pendiente_* (producto/material/lote/definición cambiada) | emisionUX.js:18-28 | Esta pieza cambió después de costearse: su costo anterior ya no vale y Dirección debe recostearla. | 🔴 rojo | No para emitir (Dirección recostea) |
| costo_productversion_desconocido | emisionUX.js:35 | Este producto no tiene costo industrial oficial; Dirección lo carga. Queda como borrador mientras tanto. | 🟡 amarillo | Sí (borrador) |
| costo_preliminar / costo_no_certificado / costo_preliminar_no_certificado | emisionUX.js:31,36,37 | Su costo es preliminar: falta certificar precios/evidencias antes de emitir. | 🟡 amarillo | Sí |
| sin_material | emisionUX.js:38 | Tiene piezas sin material asignado; asígnalo. | 🟡 amarillo | Sí |
| sin_product_id / sin_product_version_id / producto_version_id_invalido / product_version_no_corresponde / producto_id_invalido / producto_no_registrado | emisionUX.js:39,48,49,63 | Vuelve a agregarla desde su ficha (le falta identidad de producto). | 🟡 amarillo | Sí (re-agrégala) |
| ingenieria_preliminar | emisionUX.js:40 | El especial todavía no tiene ingeniería aprobada. | 🟡 amarillo | Sí |
| costo_especial_no_certificado / costo_especial_desconocido / especial_sin_costo | emisionUX.js:41,65 | Falta confirmar el costo del especial con Diseño/Dirección. | 🟡 amarillo | Sí |
| precio_especial_no_autoritativo | emisionUX.js:42 | El precio no coincide con el autorizado para el especial; vuelve a cotizarla. | 🔴 rojo | No (re-cotiza) |
| descuento_invalido | emisionUX.js:43 | El descuento no es válido (debe ir de 0 a 100 %). | 🔴 rojo | No |
| especial_* (genérico) | emisionUX.js:44 | El especial aún no está listo para cotizarse. | 🟡 amarillo | Sí |
| piezas_excluidas_sin_confirmar | emisionUX.js:45 | Confirma las piezas que NO se cotizan antes de emitir. | 🟡 amarillo | Sí (confirma exclusiones) |
| sin_partidas / snapshot_sin_partidas | emisionUX.js:46 | La cotización todavía no tiene partidas; agrega muebles. | 🟡 amarillo | Sí (agrega partidas) |
| no_existe / cotizacion_no_existe | emisionUX.js:47 | La cotización no está guardada en la nube; guárdala de nuevo. | 🟡 amarillo | Sí (guarda) |
| precio_bajo_costo / margen_bajo | emisionUX.js:50 | Este precio queda bajo el mínimo rentable: requiere aprobación de Dirección. | 🟡 amarillo | Sí (requiere aprobación) |
| no_corresponde_a_lo_costeado | emisionUX.js:52 | Este renglón ya no es el que se costeó (cambió el mueble, medidas, material o cantidad); guárdalo y, si cambió el mueble, pide recosteo. | 🔴 rojo | No (recostea) |
| identidad_no_coincide / sin_correspondencia | emisionUX.js:53 | Cambió respecto a lo guardado; guárdala de nuevo. | 🟡 amarillo | Sí (guarda) |
| cantidad_invalida | emisionUX.js:54 | Falta una cantidad válida en esta partida. | 🔴 rojo | No |
| precio_invalido | emisionUX.js:55 | Falta un precio válido en esta partida. | 🔴 rojo | No |
| partidas_no_corresponden | emisionUX.js:56 | Guarda la cotización antes de emitir. | 🟡 amarillo | Sí (guarda) |
| politica_comercial_sin_margen_minimo | emisionUX.js:57 | Falta configurar la política comercial (margen mínimo); avisa a Dirección. | 🟡 amarillo | Sí |
| aprobacion_requerida | emisionUX.js:58 | Este contenido requiere aprobación de Dirección. | 🟡 amarillo | Sí (solicita) |
| sin_permiso / no_autorizado | emisionUX.js:59 | No tienes permiso para emitir esta cotización. | 🔴 rojo | No (permiso) |
| sin_guardar | emisionUX.js:60 | Guarda la cotización primero. | 🟡 amarillo | Sí (guarda) |

---

## B. Acomodo / Planos

`layoutEstado`, veredicto del servidor (`ESTADOS_SERVIDOR`), veredicto por bloques
(`explicarAcomodo.estado`), invariantes físicas/relacionales, juez semántico,
diagnóstico de piezas no colocadas, y la lectura del plano.

| código interno | dónde aparece (archivo) | frase humana propuesta (es-MX, 1 frase) | color | ¿puede continuar? |
|---|---|---|---|---|
| LAYOUT_VALID | floorSpec.js:224 · AcomodoBase.jsx:1204 | Acomodo validado: todo cabe. | 🟢 verde | Sí |
| LAYOUT_INCOMPLETE | floorSpec.js:224 | El acomodo todavía no cabe completo; sigue ajustándolo. | 🟡 amarillo | Sí |
| PROGRAM_INCOMPLETE | Acomodo.jsx:193 · AcomodoBase.jsx:382 | Falta completar el programa antes de acomodar. | 🟡 amarillo | Sí (completa programa) |
| STALE_PROGRAM | Acomodo.jsx:117 | El programa cambió; vuelve a acomodar para reflejarlo. | 🟡 amarillo | Sí (re-acomoda) |
| PASS (servidor) | acomodoVeredicto.js:18 | Acomodo validado por el servidor. | 🟢 verde | Sí |
| REVIEW_REQUIRED | acomodoVeredicto.js:19 | Acomodo válido, con puntos por revisar. | 🟡 amarillo | Sí |
| PARTIAL | acomodoVeredicto.js:21 | Acomodo parcial: quedaron muebles sin colocar. | 🟡 amarillo | Sí (faltan piezas) |
| FAIL | acomodoVeredicto.js:21 | El motor no pudo colocar ningún mueble; acomódalo a mano o revisa el espacio. | 🔴 rojo | No para presentar (acomoda a mano) |
| NEEDS_SEMANTIC_REVIEW | acomodoVeredicto.js:22 | Geometría válida; falta revisar orientación y asientos de los kits. | 🟡 amarillo | Sí |
| QUALITY_REVIEW_REQUIRED | acomodoVeredicto.js:23 | Geometría y semántica válidas; revisa accesos y agrupación. | 🟡 amarillo | Sí |
| NEEDS_REVIEW_METADATA | acomodoVeredicto.js:24 | Geometría válida; faltan perfiles del catálogo para juzgar la semántica. | 🟡 amarillo | Sí |
| NEEDS_REVIEW | acomodoVeredicto.js:25 | Acomodo con observaciones por revisar. | 🟡 amarillo | Sí |
| SIN_VALIDACION | acomodoVeredicto.js:26 | El servidor no devolvió validación del acomodo. | 🟡 amarillo | Sí (sin aval) |
| PASS (bloques) | acomodoVeredicto.js:219 | Todo revisado y en orden. | 🟢 verde | Sí |
| REVISION | acomodoVeredicto.js:219 | Hay puntos por revisar antes de dar el acomodo por bueno. | 🟡 amarillo | Sí |
| PARCIAL | acomodoVeredicto.js:218 | Acomodo parcial: faltan piezas por colocar. | 🟡 amarillo | Sí |
| FALLA | acomodoVeredicto.js:217 | El acomodo tiene fallas físicas que impiden presentarlo. | 🔴 rojo | No |
| SIN_PLAN | acomodoVeredicto.js:216 | Aún no hay acomodo; genera uno. | 🟡 amarillo | Sí (acomoda) |
| OVERLAP | acomodoVeredicto.js:80 · acomodo-core.js:24 | Dos muebles están encimados. | 🔴 rojo | No |
| BLOCKS_DOOR | acomodoVeredicto.js:82 · acomodo-core.js:25 | Un mueble tapa una puerta. | 🔴 rojo | No |
| HITS_OBSTACLE | acomodoVeredicto.js:82 | Un mueble choca con una columna u obstáculo. | 🔴 rojo | No |
| OUT_OF_BOUNDS / OUTSIDE_AREA / OUTSIDE_POLYGON | acomodoVeredicto.js:84 · acomodo-core.js:22,23 | Un mueble se sale de su cuarto. | 🔴 rojo | No |
| AREA_INEXISTENTE / INVALID_AREA | acomodoVeredicto.js:85 · acomodo-core.js:20 | Un mueble apunta a un cuarto que no existe. | 🔴 rojo | No |
| GHOST_PLACEMENT | acomodoVeredicto.js:86 | Hay un mueble colocado que no está en la lista. | 🔴 rojo | No |
| DUPLICATE_PLACEMENT | acomodoVeredicto.js:87 | Un mueble quedó colocado dos veces. | 🔴 rojo | No |
| PLACEMENT_INVARIANT_BROKEN | acomodoVeredicto.js:88 | Hay una inconsistencia interna en la colocación. | 🔴 rojo | No |
| DOOR_SWING_UNKNOWN | acomodoVeredicto.js:83 · acomodo-core.js:27 | Falta confirmar hacia dónde abre una puerta. | 🟡 amarillo | Sí (confirma puerta) |
| ANCHOR_WRONG_ZONE | acomodoInvariantes.js:185 · acomodoVeredicto.js:89 | Un mueble quedó en una zona que no le corresponde; reubícalo. | 🟡 amarillo | Sí (reubica) |
| DEPENDENT_WRONG_ZONE | acomodoVeredicto.js:90 | Una silla o guarda quedó en un cuarto distinto al de su mueble. | 🟡 amarillo | Sí |
| DEPENDENT_DETACHED | acomodoInvariantes.js:200 · acomodoVeredicto.js:91 | Esta silla quedó demasiado lejos de su mesa. | 🟡 amarillo | Sí |
| DEPENDENT_UNASSIGNED | acomodoVeredicto.js:92 | Una silla o guarda se quedó sin mueble que la reciba. | 🟡 amarillo | Sí |
| FUNCTIONAL_GROUP_SPLIT | acomodo-core.js:29 | Un grupo de muebles quedó repartido en cuartos distintos. | 🟡 amarillo | Sí |
| MISSING_GROUP_ANCHOR / WRONG_GROUP_ANCHOR | acomodo-core.js:30,31 | Falta o está mal el mueble principal del grupo. | 🟡 amarillo | Sí |
| GROUP_CAPACITY_INCOMPLETE | acomodo-core.js:32 | Al grupo le faltan lugares para completar su capacidad. | 🟡 amarillo | Sí |
| GROUP_ANCHOR_TOO_FAR | acomodo-core.js:33 | El mueble principal del grupo quedó demasiado lejos de los demás. | 🟡 amarillo | Sí |
| NO_SPACE | acomodo-core.js:28 | No hay espacio para esta pieza en su zona. | 🟡 amarillo | Sí |
| FUNCTIONAL_CLEARANCE | acomodo-core.js:26 | No queda el pasillo mínimo alrededor de la pieza. | 🟡 amarillo | Sí |
| UNKNOWN_PIECE | acomodo-core.js:19 | Una pieza no se reconoce en el catálogo. | 🟡 amarillo | Sí |
| INVALID_ROTATION | acomodo-core.js:21 | Una pieza quedó con un giro no válido. | 🟡 amarillo | Sí |
| SEMANTIC_PROFILE_UNKNOWN | acomodoVeredicto.js:34 | El catálogo no dice de qué lados se sienta la gente; se revisa a mano. | 🟡 amarillo | Sí |
| SLOT_UNFILLED_REQUIRED | acomodoVeredicto.js:35 | Un lugar quedó sin silla. | 🟡 amarillo | Sí |
| DEPENDENT_WRONG_SLOT | acomodoVeredicto.js:36 | Una silla quedó en un lugar que no corresponde a su mueble. | 🟡 amarillo | Sí |
| KIT_FUNCTIONAL_RELATION_BROKEN | acomodoVeredicto.js:37 | Una pieza no es del tipo que su mueble espera. | 🟡 amarillo | Sí |
| ANCHOR_TOPOLOGY_BROKEN | acomodoVeredicto.js:38 | Un mueble de dos caras quedó con sillas de un solo lado. | 🟡 amarillo | Sí |
| SLOT_DOUBLE_OCCUPIED | acomodoVeredicto.js:39 | Dos sillas quedaron en el mismo lugar. | 🟡 amarillo | Sí |
| INVALID_FACING | acomodoVeredicto.js:40 | Una silla quedó sin orientación conocida. | 🟡 amarillo | Sí |
| DEPENDENT_WRONG_ORIENTATION | acomodoVeredicto.js:41 | Una silla no mira hacia su mesa o escritorio. | 🟡 amarillo | Sí |
| ACTIVE_SIDE_BLOCKED_BY_WALL | acomodoVeredicto.js:42 | Una silla quedó pegada al muro: no hay espacio para sentarse. | 🟡 amarillo | Sí |
| ACTIVE_SIDE_BLOCKED_BY_OBSTACLE | acomodoVeredicto.js:43 | Una silla quedó bloqueada por una columna u obstáculo. | 🟡 amarillo | Sí |
| ACTIVE_SIDE_ACCESS_TIGHT | acomodoVeredicto.js:44 | Una silla quedó con el acceso muy justo. | 🟡 amarillo | Sí |
| DUPLICATED_REQUIREMENT | diagnosticoAcomodo.js:12 | Hay dos muebles para el mismo lugar; conserva uno. | 🟡 amarillo | Sí |
| MISSING_ANCHOR | diagnosticoAcomodo.js:13 | Esta silla o guarda no tiene escritorio/mesa que la reciba. | 🟡 amarillo | Sí |
| UNKNOWN_FOOTPRINT | diagnosticoAcomodo.js:14 | La medida es supuesta por tipo; captura ancho × fondo reales. | 🟡 amarillo | Sí |
| UNRESOLVED_PRODUCT | diagnosticoAcomodo.js:15 | Pieza sin identidad de catálogo; elige el producto real o pide desarrollo. | 🟡 amarillo | Sí |
| COLLISION | diagnosticoAcomodo.js:17 | No se colocó porque se encima con otro mueble. | 🟡 amarillo | Sí |
| CLEARANCE | diagnosticoAcomodo.js:18 | No se colocó porque no conserva el pasillo mínimo. | 🟡 amarillo | Sí |
| BLOCKED_DOOR (diag.) | diagnosticoAcomodo.js:19 | No se colocó porque bloquearía una puerta. | 🟡 amarillo | Sí |
| INCOMPATIBLE_ZONE | diagnosticoAcomodo.js:20 | La zona asignada no admite este mueble. | 🟡 amarillo | Sí |
| DEPENDENCY_MISMATCH | diagnosticoAcomodo.js:21 | Su mueble receptor no quedó colocado; resuelve primero el mueble. | 🟡 amarillo | Sí |
| SEAT_NO_ACCESS | diagnosticoAcomodo.js:24 | El mueble sí cupo, pero la silla no tiene los 600 mm para retirarla. | 🟡 amarillo | Sí |
| SIN_DIAGNOSTICO | diagnosticoAcomodo.js:25 | El servidor no explicó esta pieza; vuelve a acomodar. | 🟡 amarillo | Sí |
| lectura nivel: alta | ConfirmarLectura.jsx:26 | Lectura del plano confiable. | 🟢 verde | Sí |
| lectura nivel: media | ConfirmarLectura.jsx:26 | Lectura con dudas: revísala antes de usarla. | 🟡 amarillo | Sí |
| lectura nivel: baja | ConfirmarLectura.jsx:26 | Lectura poco confiable: revísala con cuidado. | 🟡 amarillo | Sí |
| lectura nivel: nula | ConfirmarLectura.jsx:26 | No reconocí cuartos en el plano; dibújalo o vuelve a subirlo. | 🔴 rojo | No con esta lectura |
| floorSpec REVIEW_REQUIRED (avisos: NO_DIMENSION_AUTHORITY, MULTI_LEVEL_DOCUMENT, ASSUMED_CRITICAL_GEOMETRY, DOOR_SWING_UNVERIFIED…) | floorSpecAvisos.js:21-32 | La lectura sirve, pero hay avisos que debes conocer (p. ej. medidas estimadas o puerta sin verificar). | 🟡 amarillo | Sí |
| floorSpec FAIL (problemas: GRID_ENVELOPE_MISMATCH, NO_AREAS, POINT_OUTSIDE_ENVELOPE, TOP_LEVEL_AREA_EXCEEDS_ENVELOPE…) | floorSpecAvisos.js:35-55 | El plano no cuadra geométricamente y se rechazó; corrígelo o vuelve a subirlo. | 🔴 rojo | No con esta lectura |
| puerta PENDIENTE (sin confirmar sentido) | ConfirmarLectura.jsx:77-90 · puertasConfirmar.js | Falta confirmar hacia dónde abre esta puerta. | 🟡 amarillo | Sí |

---

## C. Costeo (clasificación de material, `MATCH`)

El gate económico (`REQUIERE_CONFIRMACION`) sigue bloqueando la emisión igual; el color
solo cambia cómo se ve el chip "por confirmar".

| código interno | dónde aparece (archivo) | frase humana propuesta (es-MX, 1 frase) | color | ¿puede continuar? |
|---|---|---|---|---|
| EXACT | materialMatch.js:21 | Material exacto confirmado. | 🟢 verde | Sí |
| EQUIVALENT_APPROVED | materialMatch.js:22 | Equivalente ya aprobado de fábrica. | 🟢 verde | Sí |
| USER_CONFIRMED | materialMatch.js:23 | Material confirmado por ti. | 🟢 verde | Sí |
| LEGACY_SELECTED | materialMatch.js:43 | Material seleccionado (histórico): costea y emite. | 🟢 verde | Sí |
| SAME_FAMILY_COMPATIBLE_PROPOSED | materialMatch.js:27 | Material de la misma familia, propuesto por Voni: confírmalo antes de emitir. | 🟡 amarillo | Sí (costo provisional) |
| SAME_FAMILY_CRITICAL_CONFLICT | materialMatch.js:32 | Cambia un dato crítico (calibre, perfil o espesor); no se cobra solo, confírmalo. | 🟡 amarillo | Sí (no autocostea) |
| CANDIDATE_REQUIRES_CONFIRMATION | materialMatch.js:33 | Hay un candidato de material; confírmalo para costear. | 🟡 amarillo | Sí |
| AMBIGUOUS | materialMatch.js:35 | Varios materiales posibles por igual; elige cuál. | 🟡 amarillo | Sí (elige) |
| SUBSTITUTE_REQUIRES_CONFIRMATION | materialMatch.js:36 | Se propone un sustituto; confírmalo. | 🟡 amarillo | Sí |
| NOT_AVAILABLE | materialMatch.js:37 | No hay material disponible para esta pieza; pide una alternativa o su desarrollo. | 🟡 amarillo | Sí (falta resolver) |

---

## D. Procedencia / Confianza

De dónde salió cada partida (`NIVELES`), su `confianza`, y el origen de su medida
(`huella_fuente`). Son señales de calidad, no bloqueos del motor (salvo
REQUIERE_DESARROLLO, que no tiene identidad ni precio).

| código interno | dónde aparece (archivo) | frase humana propuesta (es-MX, 1 frase) | color | ¿puede continuar? |
|---|---|---|---|---|
| CONFIRMADO | provenance.js:24 · EstoEntendi.jsx:68 | Confirmado: producto de catálogo con precio autorizado. | 🟢 verde | Sí |
| INFERIDO | provenance.js:25 · EstoEntendi.jsx:69 | Inferido del texto con base razonable; conviene confirmarlo. | 🟡 amarillo | Sí |
| SUPUESTO | provenance.js:26 · EstoEntendi.jsx:70 | Estimación por modelo: valida producto y precio. | 🟡 amarillo | Sí (valida) |
| SUGERIDO | provenance.js:27 · EstoEntendi.jsx:71,105 | Voni lo propuso como acompañante; quítalo si no va. | 🟡 amarillo | Sí |
| REQUIERE_DESARROLLO | provenance.js:28 · EstoEntendi.jsx:72 | Producto sin identidad ni precio autorizado; Diseño debe desarrollarlo (no se inventa SKU). | 🔴 rojo | No para esa pieza |
| confianza: alta | EstoEntendi.jsx:102 | (sin aviso) interpretación confiable. | 🟢 verde | Sí |
| confianza: media | EstoEntendi.jsx:102 | Confianza media: revísala. | 🟡 amarillo | Sí |
| confianza: baja | EstoEntendi.jsx:102 | Confianza baja: valídala. | 🟡 amarillo | Sí |
| huella_fuente real (CATALOGO/PARTIDA/SPATIAL_SPEC/USUARIO/DECLARADA) | diagnosticoAcomodo.js:35 · acomodoVeredicto.js:115 | Medida real del producto. | 🟢 verde | Sí |
| huella_fuente supuesta (INFERIDA/ESTANDAR/GEOMETRICA) | diagnosticoAcomodo.js:35 · acomodoVeredicto.js:115 | Medida supuesta por tipo; captura la medida real cuando puedas. | 🟡 amarillo | Sí |

---

## E. Render

`RenderChip` (interno de Dirección) y los estados de render preliminar del acomodo. El
contrato canónico (render anclado a la versión) no cambia; solo el texto del chip.

| código interno | dónde aparece (archivo) | frase humana propuesta (es-MX, 1 frase) | color | ¿puede continuar? |
|---|---|---|---|---|
| VIGENTE | Cotizacion.jsx:97 | Render vigente de esta versión. | 🟢 verde | Sí |
| PENDIENTE_VALIDACION | Cotizacion.jsx:98 | Render pendiente de validar. | 🟡 amarillo | Sí |
| STALE | Cotizacion.jsx:99 | Render histórico: ya no corresponde a esta versión; regenéralo. | 🟡 amarillo | Sí |
| SIN_RENDER_VALIDO | Cotizacion.jsx:100 | No hay render de esta versión; genera uno. | 🟡 amarillo | Sí |
| SIN_VERSION | Cotizacion.jsx:103 | Sin versión canónica: no aplica el render oficial. | 🟡 amarillo | Sí (informativo) |
| PRELIMINAR (badge acomodo) | AcomodoBase.jsx:1596 | Acomodo en borrador: hay medidas o precios por confirmar. | 🟡 amarillo | Sí |
| acomodo no certificado para cliente | Cotizacion.jsx:727-732 | El plano/3D se omite del PDF hasta validar el acomodo. | 🟡 amarillo | Sí |
| Vista preliminar (N pendientes) | AcomodoBase.jsx:1657-1665 | Vista preliminar: hay pendientes antes del render realista. | 🟡 amarillo | Sí |

---

## F. Comercial / Proyecto

Etapas del proyecto, tarjetas de atención (`hoyNecesitaAtencion`), estados de aprobación,
ingeniería de valor y catálogo. Las etapas cerradas son hechos, no bloqueos del flujo.

| código interno | dónde aparece (archivo) | frase humana propuesta (es-MX, 1 frase) | color | ¿puede continuar? |
|---|---|---|---|---|
| GANADA | atencion.js:9 · ProyectoWorkspace.jsx:424 | Proyecto ganado. | 🟢 verde | n/a (cerrado) |
| PERDIDA | atencion.js:9 · ProyectoWorkspace.jsx:424 | Proyecto perdido. | 🔴 rojo | n/a (cerrado, es un hecho) |
| CANCELADA / SUSPENDIDA | atencion.js:9 | Proyecto cancelado/suspendido. | 🔴 rojo | n/a (cerrado) |
| SIN_PROXIMA_ACCION | atencion.js:36 · Comercial.jsx:62 | Este proyecto no tiene una próxima acción definida. | 🟡 amarillo | Sí (define la acción) |
| ACCION_VENCE_HOY | atencion.js:37 | Una acción de este proyecto vence hoy. | 🟡 amarillo | Sí (atiéndela) |
| APROBACION_PENDIENTE | atencion.js:27 | Hay una aprobación pendiente en esta cotización. | 🟡 amarillo | Sí |
| COTIZACION_BLOQUEADA | atencion.js:30 | Esta cotización no puede emitirse todavía por datos faltantes; resuélvelos. | 🟡 amarillo | Sí (resuelve datos) |
| PRODUCTO_SIN_PRECIO | atencion.js:32 | Esta cotización tiene productos sin precio autorizado. | 🟡 amarillo | Sí |
| INCONSISTENCIA_ALCANCE | atencion.js:38 | El alcance requerido no coincide con lo cotizado/acomodado; revísalo. | 🟡 amarillo | Sí (revisa) |
| aprobación PENDIENTE | aprobaciones.js:8 · ProyectoWorkspace.jsx:255 | Aprobación pendiente de Dirección. | 🟡 amarillo | Sí |
| aprobación APROBADA | aprobaciones.js:8 | Aprobación otorgada. | 🟢 verde | Sí |
| aprobación RECHAZADA | aprobaciones.js:8 | Aprobación rechazada; no se emite con este descuento/precio. | 🔴 rojo | No con ese descuento |
| aprobación CONTRAOFERTA | aprobaciones.js:8 | Dirección propuso una contraoferta; revísala. | 🟡 amarillo | Sí |
| VE: EVALUADO | valueEngineering.js:58 | Comparación de presupuesto lista. | 🟢 verde | Sí |
| VE: NO_EVALUABLE / PRESUPUESTO_DESCONOCIDO | valueEngineering.js:35 · ProyectoWorkspace.jsx:288 | Aún no hay presupuesto objetivo para comparar; captúralo en el proyecto. | 🟡 amarillo | Sí (captura presupuesto) |
| VE: NO_EVALUABLE / TOTAL_DESCONOCIDO | valueEngineering.js:35 | Aún no hay un total de propuesta para comparar; no invento la diferencia. | 🟡 amarillo | Sí |
| source_type: linea/banco/expediente/catálogo | ProductoMaestro.jsx:13-15 | Origen del producto: Línea / Banco / Expediente / Catálogo. | 🟢 verde | Sí (etiqueta) |
| producto sin precio / no cotizable | ProductoMaestro.jsx:69,84 | Este producto no tiene precio de lista vigente: no es cotizable hasta publicarlo. | 🟡 amarillo | Sí (no cotizable aún) |
| motivo_perdida (PRECIO/COMPETENCIA/PLAZO/ESPECIFICACION/…) | cierre.js:7 | Razón por la que se perdió el proyecto. | 🔴 rojo | n/a (cierre perdido) |
| payload no client-safe (presentación) | PresentarCliente.jsx:47-67 | No se puede presentar al cliente todavía: protege los números internos; corrígelo antes. | 🔴 rojo | No para presentar |

---

## Conteo por ámbito y color

| ámbito | códigos/estados | 🟢 verde | 🟡 amarillo | 🔴 rojo |
|---|---|---|---|---|
| A. Emisión / Cotización | 29 | 1 | 20 | 8 |
| B. Acomodo / Planos | 69 | 5 | 52 | 12 |
| C. Costeo (material) | 10 | 4 | 6 | 0 |
| D. Procedencia / Confianza | 11 | 3 | 7 | 1 |
| E. Render | 8 | 1 | 7 | 0 |
| F. Comercial / Proyecto | 20 | 4 | 11 | 5 |
| **TOTAL** | **147** | **18** | **103** | **26** |

**Criterio aplicado al rojo (26):** solo emisión económica inválida (descuento/precio/
cantidad inválidos), costo que ya no vale o no corresponde a lo costeado (recosteo,
precio_especial_no_autoritativo, no_corresponde_a_lo_costeado), permiso inválido,
geometría físicamente imposible (encimados, fuera de cuarto, tapa puerta, choca,
fantasma, duplicado, inconsistencia interna, FAIL/FALLA del motor), lectura de plano
rechazada o nula, producto sin identidad ni precio (REQUIERE_DESARROLLO), aprobación
rechazada, y mostrarle al cliente algo no client-safe. Todo lo demás que hoy se ve
alarmante pero permite seguir trabajando → 🟡 con "puedes continuar".
