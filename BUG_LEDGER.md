# BUG_LEDGER — Von Haucke Product OS
Formato contrato §89. Nunca borrar entradas; marcar resolved. Estados: FIXED·VERIFIED / FIXED / OPEN / BLOCKED.
SHA de referencia de los fixes: hasta `198920c` (prod).

> **REGLA DEL BLOQUE 0 (2026-10-10).** Un bug pasa a FIXED sólo con una prueba automatizada
> que camine la **cadena completa** por la que el dato viaja en la app (lectura → contrato →
> programa → acomodo → partida → guardado), no la función aislada. "VERIFIED" exige además
> que CI (ahora en cada push/PR) esté verde con esa prueba. Motivo: VH-002 tenía 10 tests
> verdes y volvió a producción en `beaa005` porque la capa de en medio (`floorPlan`) tiraba
> el dato y nadie lo probaba de punta a punta. Ver `src/datos/puestosCadenaCompleta.test.js`.

## REGRESIONES DETECTADAS 2026-10-10 (auditoría de código, no de síntomas)

**VH-002 · P0 · REABIERTO y cerrado el mismo día.** `floorPlan.aMM/aMetros` (contrato canónico,
`beaa005`) copiaban una lista blanca de campos geométricos y **tiraban `puestos`**. Voni (`Voni.jsx:107`)
y Acomodo (`Acomodo.jsx:220,282`) guardan por esa capa → el programa volvía a estimar por geometría
("48 en 8 islas de 6" donde el plano contaba 8). Fix: campos SEMÁNTICOS viajan intactos en ambas
direcciones. Test de cadena: `puestosCadenaCompleta.test.js` (5). → **FIXED** (pendiente VERIFIED en
vivo con el PDF golden).

**VH-033 · P0 · FIXED · Acomodo perdía sillas con piso de sobra.** Reproducido: 24 escritorios + 48 sillas en
23×14 m → 48 de 72; 1 escritorio + 48 sillas en "Sala de capacitación" → 0 de 49. Tres causas, tres fixes en
`planner.js`/`floorSpec.js` (2026-10-11): (1) las sillas operativas sólo se colocaban en asientos de escritorios
ya puestos → ahora `colocarSobrantes` intenta en piso libre todo lo que sobró, con lo ya colocado como obstáculo
(nada se mueve) y respetando zonas y cuartos de servicio; (2) la pasada 2 re-empacaba desde cero y PERDÍA piezas
ya colocadas reportando `caben:true` → el intento se descarta si no vuelve a caber lo que había; (3) "sala de" a
secas clasificaba CONSEJO y vetaba escritorios → sólo junta/consejo/reunión. El resultado trae `sinColocar` por id
y la nota dice QUÉ no cupo (mandato §4). Ahora: 72 de 72, 49 de 49, 11 de 11; golden de Rodrigo sigue 79/79.
Tests: `planner.sillas.test.js` (4, con invariante pedidas = colocadas + sinColocar). Pendiente VERIFIED en vivo.

**VH-034 · P0 · FIXED · VERIFIED (E2E navegador) · Cada recarga creaba una cotización nueva en la nube.**
`idCotizacion` era `useRef(null)`, nunca se persistía; al recargar, el autosave hacía INSERT. Fix (Bloque 1):
el id y la `claveCreacion` (idempotencia) nacen con la cotización (`almacen.estadoInicial`) y persisten con el
estado; una sola puerta `guardarEnNube()`; escritura por los RPCs `crear_cotizacion_segura` (idempotente) /
`actualizar_cotizacion_segura`, nunca INSERT/UPDATE directos; firma del contenido para no reescribir lo mismo;
una creación en vuelo a la vez; fila ajena → se suelta el id. Evidencia: `e2e/persistencia.e2e.js` en Chromium
real con nube simulada (semántica del servidor): **100 recargas → 1 fila · 2 pestañas simultáneas → 1 fila ·
otra computadora → misma fila · otro usuario en la misma computadora → crea la suya sin tocar la ajena ·
caída de red → aviso + sin pérdida + recuperación**. Unit: `cotizaciones.guardado.test.js` (12).

**VH-035 · P0 · FIXED (cliente) + FIXED en base aislada (servidor, PENDIENTE DE APLICAR) · Reabrir destruía la economía.**
Cliente: al reabrir/restaurar se fija la firma de lo abierto como "ya guardado" → no se escribe hasta editar; el
cliente ya no manda `estado` comercial. Servidor: `supabase/migrations/20261010170000_actualizar_cotizacion_
preserva_economia.sql`. **Demostrado en PostgreSQL real aislado (PGlite) con los cuerpos de producción**
(`supabase/tests/preservaEconomia.test.js`, 8 casos): ANTES, vendedor edita → Dirección pierde costo/margen, y
diseño incluso PISA el costo con uno propio (21000 → 1); DESPUÉS, vendedor/diseño editan cantidades y renglones
y costos/márgenes/producto_version_id quedan al centavo, no pueden colar costos, Dirección sigue pudiendo
cambiarlos, la escritura cruda sigue strippeada y borrar un renglón sí lo borra. E2E navegador: vendedor abre,
edita y guarda → `costoUnitario` 21000 intacto; Dirección reabre y lo ve. **Bloque en rojo hasta aplicar la
migración en producción** (decisión de Rodrigo; hoy el servidor real sigue pisando).

**VH-038 · P1 · FIXED · Sin respaldo del trabajo que vive sólo en un navegador.** `datos/respaldo.js` + tarjeta
"Respaldo de esta computadora" en Presupuestos: exporta/restaura por rol (vendedor sin economía ni insumos;
Dirección con todo menos nómina y finanzas), con id/clave para seguir editando LA MISMA cotización en otra
computadora. 10 tests unit + E2E exportar→restaurar→editar sobre la misma fila.

**VH-036 · P1 · OPEN · `costear-servidor` rechaza el 100% de las llamadas del navegador.**
`AsistenteEspecial.jsx:179` manda `{...b}` con `margen`/`modeloCosteo`; `validarIntentCosteo` responde
`FORBIDDEN_FINANCIAL_FIELD`. La comparación "sombra" nunca ha recibido una respuesta del servidor.

**VH-044 · P1 · FIXED · Ocho formas de construir una partida; identidad de producto perdida; costo al
vendedor por Banco.** Contrato único `datos/partida.js` (`crearPartida`, `validarPartida`): los 6 constructores
de App.jsx (costeo, addons, modo avanzado, Voni/IA, Banco, artículo de línea) pasan por él. Unifica las tres
grafías de identidad (`producto_id`/`productVersionId`/`product_version_id`) y separa clave de línea
(`productoId` texto) de Producto Maestro (`producto_id` numérico); conserva `producto_id`, `producto_version_id`,
`lista_precio_item_id`, `source_*` y `precio_lista_snapshot` que Voni tiraba (RC2); al vendedor NUNCA le llega
economía ni en null (RC3: Banco y EditarPartida en Voni la sembraban), con la MISMA regla que el servidor
(`economia.sinEconomiaServidor`, espejo de `jsonb_sin_economia`; la regla estricta `sinEconomia` queda para
documentos al cliente); cantidad entera ≥ 1; precio > 0 o null (nunca 0); costo 0 = desconocido; `render` sólo
URL; `origen` por renglón. 8 tests `partida.test.js`. Pendiente: EditarPartida/Cocrear/CotizadorIA siguen
armando pre-formas que ENTRAN al contrato pero no lo usan directamente (siguiente paso), y `Cotizacion.jsx:178`
aún escribe `render: dataUrl` (base64) al generar renders — el contrato lo descarta al reconstruir, no al vuelo.

**VH-043 · P0 · FIXED · La lectura del plano caía al estado y al acomodo sin confirmación, y nadie
revisaba la escala.** (mandato §4: "La IA propone; el usuario confirma la interpretación crítica"). Fix
(2026-10-11): `ConfirmarLectura` (cuartos, medidas, puestos contados, confianza, problemas, vista previa) en
Voni paso 1 y en Acomodo; NADA se guarda ni se acomoda hasta "Sí, así es"; "No: lo dibujo yo" / "Volver a
subir". Lo confirmado se sella en `acomodo.lectura {en, nivel, m2, cuartos, cotas, problemas}`.
`validarEscala`: la cota general debe cuadrar (±3 %) con la suma de los ejes que el lector ya extraía y nadie
usaba; entra a `revisarAreas` y baja el nivel de confianza. Consolidación: Acomodo y Voni usan el MISMO
orquestador `leerPlanoDeArchivo` (antes dos copias con base64/downscale duplicados). Tests: planoLeido (+3),
leerPlanoArchivo (3), E2E `lecturaPlano.e2e.js` (2: confirmar → paso 2 con puestos 4+4 y sello; cancelar → nada).

**VH-042 · P0 · FIXED · El PDF no salía del snapshot y la emisión fallaba con centavos.** (1) `descargarPDF`
dibujaba el documento desde el estado vivo y totales de pantalla; ahora se arma con `datosDesdeSnapshot` del
MISMO snapshot que conservó `emitir_revision` (o que intentó conservar), y en Presupuestos cada revisión tiene
"PDF de esta revisión" que lo regenera desde su snapshot. (2) Bug latente demostrado con prueba espejo de las
reglas exactas del servidor: `totales.precioLista` se guardaba redondeado AL PESO y `emitir_revision_v2` exige
`round(precioLista,2) == Σ round(pu×cant,2)` → con cualquier precio con centavos la emisión se rechazaba y el
PDF salía SIEMPRE "BORRADOR". `totales.js` lleva la suma de renglones a centavos y el total cumple
`total == precioLista − descuento + contingencia + maniobras + flete + iva` con los mismos valores del desglose.
Nota: en producción `emitir_revision` ya es un alias de `emitir_revision_v2` (anti-tamper): el cliente no usa un
camino legacy distinto. Tests: `pdfSnapshot.test.js` (4). Pendiente VERIFIED en vivo: emitir una cotización con
un precio con centavos y ver "Revisión N guardada" en vez de borrador.

**VH-041 · P1 · FIXED · Siete fórmulas costo→precio y tres márgenes por omisión (VH-019).** Una sola
regla en `datos/precio.js` (`precioDesdeCosto`, `margenObjetivoDe`, `MARGEN_OBJETIVO_DEFAULT = 50`) usada por
lineas.precioDePieza, Asistente, Catálogo, Costeador, HojaCosto, AsistenteEspecial y CocrearV3; costear-servidor
pasa de 40 a 50 por omisión (pendiente de desplegar). Opera sobre `costoOficial`: incompleto ⇒ null. Los niveles
por volumen de Alba (`politicaVH.preciosVH`) se conservan como política de piso/lista, no como precio de partida.
`costeoEnBlanco.margen` y los `margen: 30` del Catálogo ya no fijan 30: usan el margen objetivo. 5 tests `precio.test.js`.

**VH-036 · P1 · FIXED · `costear-servidor` rechazaba el 100 % de las llamadas.** `intentDesdePieza` arma la
intención técnica (sin margen/factores/modelo/precio/insumo) y `costearServidor` la valida con el mismo
`validarIntentCosteo` que espeja el servidor antes de salir. 3 tests `costearServidor.intent.test.js`.
Pendiente VERIFIED en vivo: la tabla `shadow_costeo` debe empezar a recibir `precio_servidor` no nulo.

**VH-040 · P0 · FIXED · El motor devolvía $0 en silencio y las pantallas lo pintaban como precio.**
Causas (informe COSTEAR 2026-10-10): `calcular` entregaba `costoUnitario` como número suelto aunque faltaran
materiales/precios/cantidades; un componente con material y precio pero SIN cantidad ni medidas costaba $0 y
salía "completo"; `lineas.precioDePieza` sacaba precio de modelo sobre ese subtotal; Asistente, Catálogo, Tablero
y `partidaDeCosteo` mostraban dinero sin consultar completitud; las partidas de línea nunca traían
`piezasSinMaterial` (SIN_MATERIAL jamás disparaba); y `pesos(null)` pintaba "$0" en toda la app y el PDF.
Fix (COSTEAR §3, sin tocar fórmulas): `calcular` devuelve `estadoCosto`, `pendientes` y `costoOficial` (null si
incompleto); "sin cantidad ni medidas" entra a pendientes; `pendientesDeCosteo` sustituye a
`componentesSinMaterial` en App (una sola definición de pendiente); `precioDePieza` → `precio: null` cuando el
precio sería de modelo sobre un costeo incompleto; partidas de línea viajan con `piezasSinMaterial`/`estadoCosto`;
Asistente/Catálogo/Tablero muestran "costeo incompleto" y no permiten agregar; costo derivado del precio se marca
`costoDerivado`; `pesos(null|NaN|∞)` = "—". Tests: failClosed (4 nuevos), lineas.failClosed (3), util (1).
Pendiente VERIFIED en vivo: una pieza con componente sin cantidad debe decir "Sin precio todavía" en el Asistente.

**VH-039 · P1 · OPEN · 13 funciones edge en producción fuera del repo.** 23 desplegadas, 8 invocadas por el
cliente, 10 en el repo. Variantes paralelas (`*-strict` ×4, `-recovery`, `-preview`, `-rc`), `voni-council` (sí se
invoca, sin código en el repo), `app` con `verify_jwt:false` y `bootstrap-temp-claude`. Detalle y clasificación en
`INVENTARIO_IMPLEMENTACIONES.md` §7.

**VH-037 · P0 · OPEN · Esquema de Supabase sin versionar.** 220 migraciones aplicadas en producción,
0 en el repo. Ver `supabase/schema/README.md`.

---
## FIXED · VERIFIED

**VH-027 · P1 · Render canónico en partida de Cotizar** (tanda 10X). La partida resuelve su
imagen SÓLO por `(producto_id, producto_version_id)` → `VIGENTE/STALE/SIN_RENDER_VALIDO/SIN_VERSION`;
nunca por nombre, nunca revisión vieja; congelado por versión. RPC read-only
`resolver_renders_canonicos` (renders RLS deny-all). 11 tests. SHA `6874245`.

**VH-028 · P1 · voni-council conectado al orquestador** (tanda 10X). Council edge multi-modelo
como PROPUESTA/CRÍTICA (PROPOSAL_ONLY); nunca ejecuta por acuerdo, DISAGREEMENT visible,
degrada si cae. 9 tests + E2E "30 cm más corta…". SHA `94e47be`.

**VH-029 · P1 · Floor Editor: contrato canónico 1 mm** (tanda 10X). `floorPlan.js` única verdad
(areasM metros = verdad, areas mm = cache en sync, precisión 1 mm sin deriva). 8/8 gates.
Acomodo/Voni usan floorPlan (sin normalizador duplicado). 11 tests. SHA `beaa005`.

**VH-030 · P1 · plan-reading 10X** (tanda 10X). `revisarAreas` atrapa diminutos/enormes/astillas/
duplicados/puertas huérfanas; `resumenLectura` da confianza (alta/media/baja). +8 tests. SHA `6f20359`.

**VH-031 · P1 · Acomodo 10X · auditor único de calidad** (tanda 10X). `acomodoAudit.js` detecta
encimados (solape>tol en ambos ejes) y piezas fuera de área; el chequeo de Acomodo DELEGA en él
(sin duplicar). Gate: el propio `acomodarLocal` pasa la auditoría. +8 tests. SHA `e62559d`.

**VH-032 · P2 · render fidelity 10X** (tanda 10X). `verificarFidelidad`/`diffFidelidad`: reporta
QUÉ dejó de coincidir (acabado/geometría/features), no un stale binario; Cocrear lo muestra.
+5 tests. SHA `6f23fb9`.

**VH-023 · P0 · Camino Cocrear→Cotizar MUERTO** (tanda 2026-10-04b). `<Cocrear>` en App.jsx no recibía
`onAgregar` → el botón "Agregar al proyecto" (`{onAgregar && …}`) nunca se renderizaba y `agregarACotizacion`
abortaba. El especial co-diseñado NUNCA podía entrar a Cotizar. Fix: `onAgregar={agregarDesdeAsistente}`
(App.jsx:983). Evidencia E2E en vivo: especial costeable → registra ProductVersion **v1933** → partida en
Cotizar (contador 6→7, costo real $376), con `producto_version_id` fijado. SHA `56f2dcd`.

**VH-024 · P1 · Gate filtraba códigos CRUDOS al usuario** (tanda 2026-10-04b). `cotizacion_emitible` devolvía
`producto_id_invalido` / `costo_especial_desconocido` y el fallback de `textoRazonEmision` se tragaba el
prefijo "Línea N:". Fix: traducción seller-safe (sin cifras) + fallback conserva la línea. Banner 100% humano
verificado en vivo. +3 tests. SHA `56f2dcd`.

**VH-025 · P1 · Estado económico POR LÍNEA ausente** (item 5, tanda 2026-10-04b). El gate solo se veía en un
bloque de texto abajo; ahora cada partida lleva un chip seller-safe (`Falta confirmar` / `Requiere aprobación`)
en las 3 vistas. 9 tests. Verificado en vivo (7/7 líneas). Nunca muestra costo/margen ni unknown como $0.
SHA `b5f3af6`.

**VH-026 · P2 · Imagen canónica del especial no viajaba a la partida** (tanda 2026-10-04b). Al "Agregar al
proyecto" ahora se sube el render canónico y se fija su URL de Storage en `partida.render` (nunca base64 →
regla Bloque 3). `imagenPartida` ya la usa primero → la MISMA imagen co-diseñada aparece en el renglón, la
propuesta y el PDF. E2E: v1934 con `render=https://…/renders/cocrear/…` cargado y visible en propuesta.
SHA `3e100eb`.

**VH-001 · P1 · Login** — rodrigo.delcastillo no entraba.
Causa: contraseña equivocada (cuenta sana). Fix: reset bcrypt a nueva clave (en chat).
Evidencia: `password_coincide=true`; last_sign_in. Tests: n/a (DB).

**VH-002 · P0 · Plano conteo inflado (178 m²/17-18 puestos/17 archiveros)**
Causa: `programaDelPlano` re-estimaba puestos por geometría ignorando el conteo dibujado.
Fix: `leer-plano` v8 devuelve `puestos` por isla; cliente lo respeta (procedencia 'detectado').
Archivos: leer-plano/index.ts, planoLeido.js, programaDelPlano.js. Tests: programaDelPlano.provenance (10).
Evidencia E2E: "8 puestos contados del plano" con el PDF golden. Commit cf7a57c.

**VH-003 · P0 · "Archiveros = 9"** — gavetas+archiveros sumados y mal etiquetados.
Root cause (no síntoma): estado único `guardas`. Fix: campos separados gavetas/archiveros.
Archivos: ProgramaProyecto.jsx, programa.test.js. Evidencia E2E: Gavetas 8 · Archiveros 1. Commit 70a2641.

**VH-004 · P0 · Dos precios misma pieza ($1,433 vs $1,229)** en Costear a mano.
Root cause: HojaCosto usaba `par.margenObjetivo` e ignoraba el slider `margen`. Fix: pasa el margen efectivo.
Archivo: Costeador.jsx. Evidencia: 3 precios coinciden. Commit 66de2e9.

**VH-009 · P1 · Dibujar: texto/cuartos negro-sobre-negro** (tema claro hardcodeado en canvas oscuro).
Fix: texto claro + halo, rejilla translúcida, bordes rojos. Archivo: DibujarPlano.jsx. Evidencia: screenshot. Commit d970100.

**VH-010 · P1 · Texto claro sobre fondo claro (varias pantallas)** — barra Dibujar, **panel Voni (#fff)**, Reglas, fila bajo-mínimo, 5 clases CSS.
Fix: clase `.nota-clara` + color oscuro. Archivos: estilos.css, DibujarPlano, Voni2, Reglas, Cotizacion. Evidencia: screenshot barra crema legible. Commit f1fb4d3.

**VH-012 · P1 · Seguridad: `anon` podía EXECUTE RPCs de aprobación** (solicitar_aprobacion_snapshot escribe).
Causa: EXECUTE heredado vía PUBLIC. Fix: REVOKE de PUBLIC + GRANT authenticated/service_role.
Evidencia SQL: anon_exec=false. Migración: revoke_public_execute_aprobacion_rpcs.

**VH-013 · P0 · `analizar-mueble` fail-open SILENCIOSO a catálogo legacy** (#8 del review/§31/§76).
Fix: `console.error` + campo `catalogoFuente` ('canonico'|'cliente-fallback') + aviso ámbar en UI.
Archivos: analizar-mueble/index.ts (v23 ACTIVE), AsistenteEspecial.jsx. Smoke: 401 (carga OK). Commit 198920c.

**VH-014 · P0(feature) · Compuerta dura: render/propuesta oficial con layout roto** (#8/#16/#54).
Fix: `floorSpec.estadoLayout` cablea bloqueo de vistaRealista/renderOficina si hay sin-colocar/encimadas/fuera; 2D/3D editable sigue libre.
Archivo: Acomodo.jsx. Tests: floorSpec.test.js. Commit 896dc6f.

---
## FIXED (sin verificación visual E2E independiente aún)

**VH-005 · P1** VE botón muerto → panel útil (ProyectoWorkspace.jsx). Commit 1cb615b.
**VH-006 · P1** Autosave bóveda Dirección tragaba error → refleja sin-conexión (App.jsx). Commit 1cb615b.
**VH-007 · P2** leerPlanoDeArchivo tragaba error → log + mensaje útil. Commit 1cb615b.
**VH-008 · P2** AsistenteEspecial catch vacío del re-costeo → warn. Commit 1cb615b.
**VH-011 · P2** Desperdicio etiqueta "hoja"→"m²" (matemática ya correcta). Commit 8ac11c2.

---
## OPEN (P0/P1 — pendientes, confirmados con evidencia)

**VH-015 · P0 · Acomodo coloca por "cabe" no por "pertenece"** (#7/§53). Mesa de juntas en CEO, recepción en operativa.
→ **FIXED · VERIFIED** (commit f73e5e3). Validador determinista `floorSpec.violacionesSemanticas` + compuerta dura
(1c5abc9) MÁS el MOTOR corregido: `planner.js` ahora consulta el MISMO validador (`zonaAceptaPieza` =
`zonaPermite(rolDePiezaAcomodo, zonaSemantica)`) como filtro DURO en la 1ª pasada (`candidatos.find`) y la 2ª
(`permite`). Antes la 1ª pasada era preferencia blanda y caía a "donde quepa" (recepción→operativa). Ahora un rol
duro que no cabe en zona permitida SOBRA (honesto), no aterriza mal. Además `rolDePiezaAcomodo` dejó de marcar
'mesa' genérica como TABLE (evita falso positivo de mesa de lounge, §3-G). 9 tests (6 validador + 3 motor↔validador:
sin consejo→sobra, sin recepción→sobra, plano completo→0 violaciones con mesa en juntas y recep en recep). 820 verdes.

**VH-016 · P0 · Acomodo deja piezas sin colocar (48→23)** (#6/§52). Invariante requested=placed+unplaced+excluded.
Estado: contador en vivo consistente + "revisión vencida"; pero el MOTOR aún no coloca todo. Falta mejora de placement.

**VH-017 · P0 · `costoUnitario = 0` persistido = "gratis" vs "desconocido"** (#10/§25). Cot.58: 7/12 líneas, $152,062.
→ **FIXED (cliente)**: `precioUsable()` en `calculo.js` distingue ZERO declarado (§7) de UNKNOWN (ausente). Un insumo
presente-sin-precio entra a `componentesIgnorados` → `costeoEmitible` incompleto → `costoTotal=null` → emisión
bloqueada (misma infra que material faltante). UI por-renglón muestra "Pendiente", no $0. 4 tests (824 verdes), prod.
→ **Paridad edge HECHA**: `costear-servidor` importa el MISMO `calculo.js`; redeployado (CLI, bundlea calculo.js con `precioUsable`) → un insumo sin precio deja `componentesIgnorados` → `estado=incompleto` → sin precio. Smoke 401 (vivo, fail-closed). Cliente+edge con el mismo fail-closed.

**VH-018 · P1 · Descuento a PÉRDIDA** (#11/§36). Gate exige aprobación solo >40% (política plana); rentabilidad puede ser 13%.
Trigger verificado (41/60% → requiere aprobación). Falta: gate de pérdida (margen<mínimo), no solo política.

**VH-019 · P1 · Margen disperso** (#12/§97). Canónico=`margenObjetivo` (motor 50), servidor autoritativo; semilla cliente 30 y fallbacks 40/50.
Falta: una sola regla; quitar `??40` muerto del servidor; cliente lee el parámetro.

**VH-020 · P2 · Pluralización** ("1 oficinas/1 sillas") en frase. Falta: capa de presentación (NO tocar contrato IA, §114).

**VH-021 · P2 · PROD footer "v1.0.0 · desconocido"** (build CLI no inyecta git SHA).

---
**VH-022 · P0 · Seller economics leak en `cotizaciones` (DB)** (§35). MEDIDO 2026-10-04:
RLS `cotizaciones_lee` deja al dueño leer su fila RAW (`usuario = jwt.email OR puede_editar_config()`).
El write-path YA despoja economía para vendedores (`partidaDeCosteo`: `costo=null` si `!veCostos`), PERO
hay **5 cotizaciones de vendedor con 17 partidas con `costoUnitario`≠0 y 5 con `margen`** (legacy/previas al
strip). Un vendedor que lea su fila ve esa economía. ESTADO: **OPEN**. Remediación correcta SIN mutar datos
(restricción dura "no alterar históricos"): RPC `security definer` seller-safe que devuelva partidas sin
economía + restringir SELECT base de `cotizaciones`/`cotizaciones_revisiones` a Dirección + recablear la
lectura del cliente del vendedor a la RPC. Es un refactor en tabla viva → bloque propio con smoke/rollback
(no se hace a medias). NO limpiar los 5 rows (dato histórico).

## NO-ES-BUG (investigado, descartado)
- "FIRME/CALIBRADO" NO es "producto confirmado": es confianza de PRECIO, interna, no se imprime (confianza.js). Correcto.
- 403 de `catalogo_vigente`/`reglas_comerciales_vigentes` desde cliente: son **server-only por diseño** (service_role). No tocar.
- **`crm.js:59 aprobaciones.select('*')` — FLAG CERRADO 2026-10-04b.** Columnas de `aprobaciones`: id, cotizacion_id,
  revision_hash, estado, `descuento_solicitado`, motivo, solicitado_por, resuelto_por, creado, resuelto_en,
  reglas_version. **NO hay costo/margen/profit/precio_proveedor.** `descuento_solicitado` es el % que el PROPIO
  vendedor pidió (no es economía que no deba ver). Lo consumen ProyectoWorkspace y Voni (`proveedorReal.get_approvals`);
  ambos seller-safe. No es fuga.
- **Auditoría seller-safe de lecturas RAW (2026-10-04b):** TODAS las lecturas de `cotizaciones`/`cotizaciones_revisiones`
  alcanzables por vendedor van por RPC seguro (`cotizaciones_mias`, `cotizacion_segura`, `cotizacion_revisiones_seguras`,
  `revisiones_seguras`) o seleccionan SOLO metadata sin economía (`crm.js` folio/cliente/estado/total/acomodo;
  `revisiones.js:102` fallback folio = id/revision/emitida_en/usuario/total/folio/cliente). `voniContext` gatea
  costo/margen por rol (`ve_costo`/`ve_margen` solo Dirección). Las lecturas RAW de `expedientes` (nube.js) son del
  AsistenteEspecial legacy (herramienta de Diseño/Dirección), NO del camino Cocrear ni del vendedor. El corte final de
  RLS base de `cotizaciones` sigue siendo de ChatGPT (VH-022 OPEN) — el wiring seguro ya está demostrado.
