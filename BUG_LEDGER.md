# BUG_LEDGER — Von Haucke Product OS
Formato contrato §89. Nunca borrar entradas; marcar resolved. Estados: FIXED·VERIFIED / FIXED / OPEN / BLOCKED.
SHA de referencia de los fixes: hasta `198920c` (prod).

> **REGLA DEL BLOQUE 0 (2026-10-10).** Un bug pasa a FIXED sólo con una prueba automatizada
> que camine la **cadena completa** por la que el dato viaja en la app (lectura → contrato →
> programa → acomodo → partida → guardado), no la función aislada. "VERIFIED" exige además
> que CI (ahora en cada push/PR) esté verde con esa prueba. Motivo: VH-002 tenía 10 tests
> verdes y volvió a producción en `beaa005` porque la capa de en medio (`floorPlan`) tiraba
> el dato y nadie lo probaba de punta a punta. Ver `src/datos/puestosCadenaCompleta.test.js`.

## VERIFICACIÓN CONTRA EL ERP (Intelisis) · 2026-10-11

Fuente: Drive "presupuestos cotizador vonhaucke" (Dirección). 15 "REPORTE DEL COTIZADOR DE PRECIOS" de Intelisis
(línea APPS LT / Alba, 12/08/2026: ATPU3M, ATPU2M, ATPU75M, ATOM3, ATOM4, ATACM, ATBIOCRT5, ATFAL12ABS,
ATFAL150ABS, ATCUBS44/45/46ABS, ATCUBD44/45/46ABS), cada uno con BOM (código, cantidad, unidad, último costo y fecha),
horas y $/h por centro (MO y GIF), factores 30/20/200. Se pasaron los 15 por `motor/calculo.js` en modo
`intelisis` con los MISMOS insumos, horas y factores: **15/15 cuadran al centavo** en materia prima, mano de obra,
GIF, fabricación, gastos de operación, costo total y precio (diferencia máxima $0.04, redondeo del reporte); el
precio de lista difiere < 1 % porque el ERP redondea a pesos enteros con una regla propia. Queda como prueba
permanente: `src/motor/goldenIntelisis.test.js` + `src/motor/fixtures/intelisis_alba_2026-08-12.json` (16 tests).
Conclusión: **la fórmula del motor es la oficial**; lo que falla está en los DATOS y en la PRESENTACIÓN, no en la cascada.

**VH-074 · NO-ES-BUG (corregido 2026-10-12: la entrada anterior ESTABA EQUIVOCADA) · Láminas "kg".**
Releído el modelo de `insumo_precios`: `unidad_compra` es la unidad en que se COMPRA (kg), `precio_compra` el precio
por esa unidad ($21.49/kg), `factor_conversion` cuántas unidades de compra hay en una unidad de costeo (62.2 kg por
hoja 3×10 cal.12) y `precio` el resultado POR UNIDAD DE COSTEO (hoja): 21.4881 × 62.2 = $1,336.56/hoja, igual que el
ERP. La alarma "~70× más cara" venía de leer `precio` como si fuera por kg. El cliente (`config.datos.insumos`,
láminas a $/kg con formato de hoja entera) y el servidor (hoja = kg × factor) son consistentes entre sí y con el
ERP. Las 6 filas siguen `propuesto` con confianza baja porque su documento es el código, no el ERP (A11 no las
alcanzó: la semilla no trae su código Intelisis). No se cambió ningún dato.

**VH-075 · P1 · FIXED EN PRODUCCIÓN 2026-10-12 (aprobado "hazlo todo") · `pintura-polvo` a $6.69/kg era USD guardado como MXN.**
Confirmado en la semilla: `insumos.js` define `pintura-polvo` = "Pintura en polvo A101 basic white", **6.69 USD**/kg; la
fila 96 de `insumo_precios` perdió la moneda. El ERP registra A101 BASIC WHITE a $115.949073 MXN/kg (última compra
2026-08-04; 115.95/6.69 = TC 17.33). Hecho: fila 96 cerrada (`vigente_hasta=2026-10-11`, append-only respetado) y
fila 479 nueva DATA_TRUTH_V1 (ERP MVLQPP00000000|A101) aprobada vía RPC. `catalogo_vigente.pintura-polvo` =
$115.949073/kg, `aprobado`, certificable.

**VH-082 · P1 · MITIGADO 2026-10-12 (requiere Compras) · `caja-byrne` a $167/pza era USD guardado como MXN.** Misma
causa que VH-075: la semilla dice 167 **USD**; la fila 136 lo guardó como pesos. No hay registro ERP para cruzar. Hecho:
fila 136 cerrada; fila 480 `propuesto`, $2,894.11 (167 × TC 17.33 implícito en la compra ERP del 2026-08-04),
`requiere_validacion_compras=true`, confianza baja: NO certifica hasta que Compras confirme precio y moneda. Los otros
dos insumos en USD de la semilla (`portamonitor-loktec-d7a/-ma8`) no tienen fila en el servidor; quedan "sin precio".
Lección: el banco de precios del servidor no tiene columna de moneda para filas LEGACY; cualquier carga desde la
semilla debe convertir o rechazar `moneda ≠ MXN`.

**VH-084 · INTEGRACIÓN · HECHO 2026-10-12 (A20) · Material Gate de `perfection-final` fusionado en la línea unificada.**
Seis commits posteriores a producción (`d698eea`…`7d60204`) que nunca entraron a `c3.4`: política de material de 4
clases (EXACT / COMPATIBLE provisional / CRÍTICO / AMBIGUO-SUSTITUTO), gate económico `materialesPorConfirmar` en el
motor y en `costeoEmitible`, reconciliación server-side del `material_match` en `costear-servidor` (el navegador no es
autoridad; capability de confirmación por rol; LEGACY sólo por provenance), aprobación en AsistenteEspecial sólo con
validación del servidor a centavos, y la 1ª pasada visual de `analizar-mueble` con informe diferido (fix del timeout).
Conflictos en `materialMatch.js`, su test, `Costeador.jsx`, `AsistenteEspecial.jsx` y `requestPlan.test.js`: se
conservaron las dos líneas (VH-053 "existe en el servidor sin precio certificado" sigue como NOT_AVAILABLE ámbar, con
`alertaMaterial` y el `data-testid` que usan los e2e). Cambio de comportamiento visible: cuando la IA nombra un material
sin id y hay UN pariente compatible de la misma familia, ahora se autollena como costo PROVISIONAL "POR CONFIRMAR" en
vez de quedar sin costo; la emisión sigue bloqueada hasta confirmar. Pruebas: vitest 2,028/2,028, Playwright 25/25,
build limpio. Nota: `costear-servidor` sigue sin desplegar (A17); hasta entonces el gate server-side no corre en vivo.

**VH-085 · FÓRMULA · HECHO 2026-10-12 (A14, aprobación expresa) · Reglas de merma de Producción como política del motor.**
Nuevo `src/motor/politicaMerma.js` (+14 pruebas): (1) tablero: pieza con lado mayor > 1.50 m cobra ½ hoja si el lado
menor ≤ 0.60 m y 1 hoja si es mayor, en lugar de la rejilla; las piezas ≤ 1.50 m siguen con la fracción real de la
rejilla (la que reproduce los T.D.C. de Alba); una pieza más grande que el tablero ahora cobra 1 hoja por regla Y sigue
avisando "no cabe" (antes caía al 80 % genérico). (2) pintura en polvo: `areaPintadaM2` → kg a 8 m²/kg (plano); en
tubular Producción dijo "rinde menos" sin cifra → el componente queda PENDIENTE y bloquea la emisión (no se inventa un
rendimiento ni sale $0); con `cantidad` en kg capturada se respeta el estimador. (3) tubo 6 m y lámina 0.91/1.22 ya
eran política (TRAMO6, formatos 3x10/4x8). (4) excedente de canto por lado: sin cifra, sigue `mermaCorte`. El DTO
acepta `areaPintadaM2` (≥ 0) y `tubular` (booleano). `MOTOR_VERSION` → 2026-10-12: las cotizaciones emitidas conservan
su huella (`huellaMP`) y se recostean sólo si alguien las reabre. Lo que cambia en dinero: sólo piezas de tablero con lado
mayor > 1.50 m (p. ej. tapa 1.60×0.60: 1 hoja → ½ hoja) y la pintura capturada por área. Goldens Alba/Intelisis intactos.

**VH-086 · P1 · FIXED 2026-10-12 · `melamina-19` se clasificaba como LAMINADO y nunca se costeaba.** Destapado por la
prueba en vivo de `costear-servidor` v6: una tapa pedida como "melamina 19 mm" con `insumoId melamina-19` salía "por
confirmar" sin costo, y con confirmación de Dirección seguía bloqueada. Causa: `familiaDeMaterial` evaluaba
`laminado_hpl` (regex con "ecolegno") antes que `melamina`, y el nombre real del insumo en la config de producción y
en la semilla es "Melamina / EcoLegno 19 mm" → familia laminado → sustitución entre familias (fail-closed, correcto
como regla, incorrecto como dato). Afectaba al cliente (política local) y al servidor. Fix: melamina se evalúa antes
que laminado/HPL; "Laminado plástico HPL" y "Laminado Walnut" siguen siendo laminado. Pruebas de regresión en
`materialMatch.test.js` (familia y reconciliación server-side provisional/USER_CONFIRMED).

**VH-087 · P2 · FIXED 2026-10-12 · `acomodar-espacio-recovery` aceptaba la llave pública como sesión.** `verify_jwt`
del gateway sólo exige un JWT válido y la llave anónima lo es; la función no comprobaba usuario (las demás edges sí).
Sin datos expuestos (sólo cómputo), pero cualquiera con la llave pública podía consumirla. Fix: Bearer + `auth.getUser()`
→ 401 `UNAUTHENTICATED`, igual que `acomodar-espacio`. Se re-despliega como v8.

**VH-088 · ARQUITECTURA · HECHO 2026-10-12 (Dirección: "ya migra el motor al catálogo de todas las compras") · El motor
costea con el CATÁLOGO, no con la foto de config.** Antes: cliente y `costear-servidor` usaban `config.datos.insumos`
(92 insumos del 2026-08-11; melamina-19 a $320/m², melamina-16 a $900/hoja) y los 133 certificados sólo alimentaban el
Banco de precios. Ahora:
· **Datos**: TODO el archivo del ERP con costo entró al catálogo: 10,964 registros nuevos (`clasificacion='erp'`,
  ids `erp-<clave>[-<opción>]`, unidad normalizada, sección/familia por heurística, formato de tablero/tramo cuando el
  nombre lo permite) + 10,964 filas DATA_TRUTH_V1 con documento y hash. 1,660 con compra ≤ 24 meses quedaron
  **aprobadas** (RPC por lote con sesión de dirección); 9,304 con compra más antigua quedaron `propuesto_validado`
  (tienen precio, cuestan, pero NO certifican y lo dicen). 1,108 BLOQUEADOS en el ERP entraron `activo=false`.
  5,446 registros del archivo SIN costo no se cargaron (no hay qué costear; nunca $0).
· **SQL** (`20261012043000_vh088_catalogo_motor.sql`): `private_api.insumo_motor` (forma del motor: precio NULL =
  pendiente), `catalogo_motor(incluir_erp, ids)`, `buscar_insumos_motor(q, límite)`, `aprobar_precios_lote(ids)`;
  `config_para_rol` entrega a direccion/diseno `insumos` desde el catálogo (`insumosFuente='catalogo'`); vendedor sigue
  sin economía.
· **Servidor**: `costear-servidor` arma `insumos` con `catalogo_motor(false, idsDeLaPieza)`; si el catálogo no responde,
  cae a config/semilla y lo AVISA (`catalogoFuente='config-fallback'` + warning). `analizar-mueble` sólo ofrece a la
  IA el catálogo CURADO (`clasificacion<>'erp'`): 11k nombres no caben en un prompt y la IA no debe elegir a ciegas.
· **Cliente**: `aplicarCompartido` conserva `insumosFuente`; la suscripción en vivo a `config` re-lee por la RPC (el
  payload crudo traía la foto); `Precios.jsx` es sólo lectura cuando los precios vienen del catálogo (un precio cambia
  con una compra o un documento, no a mano); Costeador y Asistente especial tienen **"Buscar en todo el catálogo"**
  (`BuscadorInsumo.jsx`, RPC `buscar_insumos_motor`) para elegir a mano un insumo del ERP: la elección humana viaja
  como USER_CONFIRMED y el insumo entra al mapa local para que pantalla y servidor cuadren.
· **Lo que cambia en dinero**: todo costeo de direccion/diseno usa ahora el precio vigente del catálogo (p. ej.
  melamina-19 $544/hoja en vez de $320/m²; melamina-16 $450/hoja en vez de $900). Las cotizaciones emitidas conservan su
  huella; se recostean sólo si se reabren.
· **Límites honestos**: los insumos del ERP sin formato conocido se costean por su unidad de compra (pza/m/kg/hoja),
  sin rejilla ni merma; 2 insumos curados siguen sin precio (portamonitor Loktec); la IA no ve el ERP (se busca a mano).

**VH-089 · HERRAMIENTA · HECHO 2026-10-12 · "Cargar compras del ERP" desde la app (Dirección).** Para que la carga del
ERP no dependa de mí: pantalla `CargaERP.jsx` (atajo en Inicio → Más herramientas) que lee el .xlsx de Intelisis en el
navegador sin dependencias (`xlsxMinimo.js`: ZIP + XML con DecompressionStream), prepara catálogo y precios con la misma
lógica del cargador del día (`erpCarga.js`, probada con un libro sintético en `src/datos/fixtures/`) y manda lotes de 400
a la RPC `cargar_erp_ultima_compra` (`20261012050000_vh089_cargar_erp.sql`): resuelve cada registro Artículo|Opción al
insumo ya conocido (provenance o `atributos.erp`) antes de crear uno nuevo, no duplica (mismo registro + precio +
fecha), exige DATA_TRUTH_V1, aprueba lo comprado en ≤ 24 meses y deja lo más viejo preliminar; sólo rol dirección.
Resultado en pantalla: nuevos / actualizados / precios nuevos / certificados / ya estaban / errores. e2e 3/3 con la nube
falsa. Rutina sugerida: Compras exporta el reporte el día 1 de cada mes y Dirección lo sube; nada más.

**VH-083 · DATO · HECHO 2026-10-12 · A11 certificación con documento ERP.** Cruce de los 259 insumos de la semilla
contra "Costos de Materia Prima Ultima Compra al 10082026.xlsx" (ERP Intelisis, Drive de Compras; 16,520 registros
Artículo|Opción): 109 con registro ERP exacto (105 iguales, 4 con precio ERP más nuevo), 13 con código que el ERP no
tiene, 137 sin código Intelisis en la semilla. Insertadas 110 filas DATA_TRUTH_V1 (ids 370–479, provenance con hash)
y aprobadas 103 vía `aprobar_precio` con sesión de rol dirección; 7 quedan `propuesto_validado` por compra con más de
24 meses (regla mía, no de Dirección: melamina sand ×3, gris humo 28, gris unido axalta, acrílico traslúcido 3,
tubular ¾). `catalogo_vigente`: **aprobados 30 → 133**, propuesto 61, propuesto_validado 63, sin precio 2. Rastro:
`supabase/datos/2026-10-12_a11_certificacion_erp.sql`. Lo que NO se certificó y por qué: 61 `propuesto` son
"código SEMILLA sin fuente" (acrílicos, cristales, herrajes, PTR, telas…) y 63 `propuesto_validado` vienen de T.D.C.,
lista Compras o Sonara sin registro ERP cruzable. Importante: el navegador costea con `config.datos.insumos` (92
insumos, 2026-08-11), no con `catalogo_vigente`; la certificación mejora al servidor (`costear-servidor` cuando se
despliegue, A17) y al Banco de precios, no al costeo local de hoy.

**VH-076 · NEGOCIO (no es bug de código) · 4 de 15 piezas APPS LT se venden por debajo del costo total del ERP.**
Lista comercial del servidor (`lista_precio_items`, fuente "linea", la que usan los presupuestos "precio estándar")
contra el costo total Intelisis: ATPU3M lista $650 / piso $520 vs costo $1,112.58; ATPU2M $610/$490 vs $966.37;
ATPU75M $890/$630 vs $1,022.55; ATACM $270/$220 vs $370.64. Las otras 11 están sobre costo pero entre 34 % y 76 % del
precio de lista que el propio ERP calcula (×1.2 ×3). Dos lecturas posibles y sólo Dirección puede decidir cuál:
(a) las horas del centro "Otros" del ERP están infladas (1.66 h para una pata en U, a $234/h de GIF), o (b) las patas
y conductos son piezas gancho que se venden perdiendo y se recupera en la cubierta. La app no debe "corregir" nada
aquí; debe MOSTRAR margen real contra costo ERP cuando exista (hoy `producto_version_economia` tiene 12 filas de 1,944
productos: casi ningún producto de línea tiene costo oficial de referencia).

**VH-077 · P2 · PARCIAL (reglas de merma → VH-085/A14 HECHO; (a)–(f) de UI/catálogo siguen abiertos) · Observaciones de Rogelio y
Alba (doc "comentarios Rogelio y Alba").** (a) la lista de materiales sólo ofrecía "MDF" sin espesores; (b) no se pueden
combinar acabados/materiales; (c) gasto directo e indirecto "muy alto aun bajando el factor" en el ejercicio de la
repisa (su T.D.C. da $156.98 de material: MDF19 0.028 hoja $12.26, canto ABS 22 1.4 m $14.88, laminado 0.056 hoja
$34.88, lámina cal.14 0.025 hoja $21.24, tubular 3/4×1¾ cal.18 0.2 pza $49.91, pintura 0.1 kg $23.81; OJO: `mdf-19` NO existe ni en `config.datos.insumos` ni en `catalogo_vigente`, por eso
Alba sólo pudo escoger "MDF"; y `laminado` vale $420/m² en el cliente pero $405.60/HOJA en el servidor: misma palabra,
base distinta); (d) las
descripciones del presupuesto no traen claves ni todos los componentes (riel, biombo de cristal); (e) "puestos" debe
decir que son personas; (f) condiciones comerciales poco claras: ¿el 3 % de flete está incluido o no? Datos de
Producción que SÍ dieron: no hay tiempos medidos por operación (sólo "30 s por operación" y el concepto histórico de
"unidades equivalentes"); reglas de merma vigentes: tablero, pieza > 1.50 × 0.60 m = 0.5 hoja, si excede 0.60 de ancho
× 1.50 = 1 hoja; pintura 8 m²/kg en plano (tubular rinde menos); canto: excedente por lado; perfiles tubulares de 6 m;
lámina en anchos 0.91 y 1.22 m. Ninguna de esas reglas está hoy en el motor como política: están como `aprovechamiento
80 %` + rejilla + `hojas` de la IA. Adoptarlas es cambio de fórmula oficial → DECISIONES A14.

**Lo demás que había en el Drive, para que no se vuelva a preguntar:** 36 catálogos comerciales PDF (sin costos),
`Escritorios Alba Precios.xlsx` (783 artículos, 625 BLOQUEADO, sólo 6 con precio de lista), dos reportes "Compras
Acumuladas" del ERP (2,909 renglones parseados de mobiliario de madera, $294 M de $326 M; útiles para certificar costo
unitario = compras netas / unidades por artículo ERP), 5 presupuestos reales a precio estándar (FinSus $20.6 M, Hugo
Boss $1.74 M, LV $2.78 M, Estuco $0.51 M con 40 % de descuento, NTD Global $2.14 M) y una cotización de librero/credenza
2025 ($17,250 y $32,915), estados financieros a junio 2026, y 3 fotos.

## UNIFICACIÓN DE LAS DOS LÍNEAS DE CÓDIGO · 2026-10-11/12

**Hecho medible.** Producción (`costeador-vonhaucke.vercel.app`, Vercel) sirve el commit `5a38d2e` de la rama
`claude/perfection-final-20261006`; la rama por defecto de GitHub (`c3.4-seller-safe`) y mi rama de trabajo
(`2d33918`) venían de la misma base (`1d5a0c1`, 2026-10-05) pero divergieron: 643 commits de un lado, 49 del otro,
397 archivos distintos. Todo lo auditado y corregido en el ledger desde VH-023 vivía en la línea que NADIE usa.

**Qué se hizo.** Merge de `2d33918` SOBRE `5a38d2e` (base = lo que corren los usuarios). 37 archivos en conflicto,
resueltos uno por uno conservando de cada lado lo que tenía prueba: del lado vivo, autoridad del servidor en costeo,
totales a centavos (`datos/totales.js`), render de oficina, PDF; del lado auditado, lectura de planos fail-closed con
confirmación (VH-064), interpretación del acomodo del servidor (VH-067), catálogo con fallback, política comercial
pública, intención de costeo validada (VH-036), un solo juez costo→precio (VH-041/VH-019), VH-033, VH-047, VH-062.
Después del merge: 47 archivos de prueba no cargaban (un `}` perdido en `planner.capacidadMesa`); luego 5 pruebas
rojas; al cierre **vitest 778 archivos / 1,965 pruebas / 0 fallas, build limpio**, marcadores nuevos presentes en el
bundle (`catalogo-fallback`, `lectura-servidor`, `politica_comercial_publica`).

**Decisiones de semántica tomadas en el merge (revisables):**
- Una silla SIN destino marcado y SIN palabra clave ("Silla ALPHA") deja de asumirse `WORK_SEAT`: queda flexible
  (`ROL.OTHER`), salvo baños/site. Con la regla viva, 10 sillas vendidas con una mesa de juntas en un plano que sólo
  tiene la sala de juntas se quedaban fuera (1 de 11 colocadas). Las sillas con destino (`ruta vh-dest-*`,
  `relation_role`) o con palabra clave siguen con la regla estricta del lado vivo.
- `bloqueosDeEmision` también traduce el veredicto económico (`COSTO_PRELIMINAR`, `COSTO_NO_CERTIFICABLE`): antes sólo
  los motivos duros; un costo preliminar no bloqueaba la emisión definitiva en pantalla.
- B4/B6/B8 del plan de retiro quedan parcialmente sin efecto: el lado vivo usa `validarFloorSpec/validarEnvolvente`
  (acomodoPayload) y lee `CocrearV2`; se conservan. `acomodarConReparacion` sí se retiró.
- Pruebas de texto fuente del lado vivo (canonicalMarginDefault, liveQuoteEmissionGate, moneyBoundaries,
  renderStoragePolicy, pdfMoneyTrust, derivedCostTrust, voni) se adaptaron al código unificado SIN cambiar la intención
  que verifican; `voni.test` usaba el rol 'costeador', que no existe en `permitidos` (direccion 7, diseno 3, vendedor 1).

**VH-078 · P1 · FIXED Y DESPLEGADO 2026-10-12 (v7 centavos; v8 RPC con JWT de usuario + fecha por omisión, verificado en vivo) · `cotizar-servidor` desplegado (v6) NO existía en ninguna
rama.** Comparación byte a byte de las 23 edges desplegadas (`get_edge_function`) contra el repo: el servidor de
cotización que corre resuelve precio especial de proyecto (`resolver_precio_especial_proyecto`, `ECONOMICS_INCOMPLETE`,
`PRELIMINARY_SPECIAL`) y el cliente vivo ya consume esos campos; la copia del repo (`7153e9d`, "preserves cents") nunca
se desplegó y no tenía el precio especial. Se volcó el código desplegado al repo y se le portó encima el manejo a
centavos de `7153e9d` (prueba `quoteEmissionAuthority` en verde). Hasta que se despliegue, el servidor redondea al peso
(`Math.round`) mientras el cliente suma a centavos.

**VH-079 · P2 · OPEN (despliegue pendiente, A17/A18) · Edges con fuente adelantada al desplegado.** `costear-servidor`
desplegado (v5, 2026-10-04) no tiene el juez `costeoEmitible`, redondea al peso y usa margen por omisión 40 (el
cliente usa 50). Su copia del motor (`calculo.js` del 2026-10-04) **sí reproduce los 15 reportes del ERP al
centavo** (golden corrido contra el snapshot desplegado): no hay riesgo de fórmula, sólo de gating y redondeo.
`acomodar-espacio-recovery` fuente (2026-10-10, RESCATE Torre Sur) acepta sillas de visita en privado y expone
`semantic_issues`; el desplegado (v6) no. `usuarios`: el repo tenía el header CORS más estrecho que el desplegado; se
igualó al desplegado. `analizar-mueble`, `acomodar-espacio` (sólo el escape `\u0300`), `analizar-negocio`,
`cotizar-texto`, `generar-render`, `generar-video`, `leer-plano`, `leer-plano-core`, `voni-council`: repo = desplegado.
Sin fuente en el repo: `acomodar-espacio-strict`, `analizar-mueble-preview/-strict`, `app`, `bootstrap-temp-claude`,
`costear-compras-rc`, `costear-vision`, `generar-render-strict`, `leer-plano-strict`, `voni-council-health` (B12).

**VH-080 · P0 · FIXED (unificación, mismo PR) · Dos pantallas se caían tras el merge por identificadores perdidos.**
La suite unitaria (1,965 verdes) y el build NO lo detectaron; lo detectó el e2e en navegador: `HojaCosto` usaba
`costeoEmitible` sin importarlo (Costeo manual → "Esta pantalla se atoró") y `Cotizacion` usaba `gateVista` sin
definirlo (abrir una cotización del archivo → misma pantalla). Un tercero latente en `AsistenteEspecial.persistir`
(`storagePath/storageUrl/dataUrl` indefinidos; venía así desde mi línea, VH-072) se habría caído al guardar el render.
Se pasó un linter `no-undef` (ESLint 9, sólo esa regla) sobre todo `src`: 0 indefinidos restantes (`__APP_VERSION__` es
`define` de Vite). Regla nueva para el repo: un merge no está verificado sin `no-undef` + e2e en navegador.

**VH-081 · P1 · FIXED (unificación) · El acomodo "Con IA" caía a borrador local cuando el servidor decía FAIL.** En la
línea viva, `acomodar()` atrapaba cualquier excepción del solver con "Motor espacial no disponible. Usé acomodo local
como borrador" y seguía con `reacomodar` local; el orquestador (`acomodoOrquestador`) reintentaba 3 veces el mismo
payload y devolvía "No se pudo acomodar. Vuelve a intentar." sin el motivo. Un veredicto FAIL del servidor (qué no cupo,
qué se encimó) es una respuesta, no una caída: ahora viaja etiquetado (`veredictoServidor`), el orquestador deja de
reintentar y devuelve `status: 'FAIL'` con el motivo, y la pantalla lo enseña en rojo sin sustituirlo por un borrador.
Las notas de un acomodo del servidor (piezas sin colocar, puertas sin verificar) se muestran en ámbar, no en letra gris.
E2E `acomodoServidor` (FAIL y PARTIAL) en verde con el harness vivo (programa coherente: el cliente vivo no acomoda
programas incompletos, decisión de producto que se respeta).

**Semántica viva adoptada en los e2e de emisión:** el documento SIEMPRE sale como BORRADOR ("Descargar BORRADOR" +
aviso "BORRADOR · NO REGISTRADO · <motivo>"); lo que se bloquea fail-closed es la emisión definitiva (sin
`emitir_revision`, sin revisión conservada). Mis specs esperaban el botón deshabilitado; se adaptaron a esa decisión
(viene de la queja real "clic y no pasó nada").

**Verificación al cierre de la unificación:** vitest 778 archivos / 1,965 pruebas / 0 fallas · build limpio ·
`no-undef` 0 · Playwright 25 pasan / 16 se saltan (requieren `TEST_EMAIL`/`TEST_PASSWORD` del flujo autenticado real).

**PRODUCCIÓN RE-APUNTADA · 2026-10-12 00:58 UTC.** PR #27 fusionado a `c3.4-seller-safe` (merge `28874ab`, CI verde:
`verify` + e2e autenticado 39/39 contra el backend real). Vercel construyó `dpl_GRhGG2vdtbzK4uTrBPjdLM7TeuAY`
(bundle `index-Cw4Etvhx.js`); se verificó en ese deployment que el bundle trae los marcadores de la línea unificada
(`catalogo-fallback`, `politica_comercial_publica`, inicio de tres caminos; en el chunk de Acomodo `lectura-servidor` y
el veredicto del servidor) y se promovió al dominio `costeador-vonhaucke.vercel.app` con `request_promote`. Comprobado
después en el dominio real: sirve `index-Cw4Etvhx.js`, smoke en navegador sin errores de runtime. Antes del cambio el
dominio estaba fijado al deployment de `5a38d2e` (`dpl_1m4bDohVjcqL86fcGHRhJTnw2rJc`, bundle `index-vjBoM8Ia.js`); los
deployments de producción de PR #25/#26 nunca tomaron el dominio. **Rollback:** promover `dpl_1m4bDohVjcqL86fcGHRhJTnw2rJc`
desde Vercel (un clic, sin rebuild). Rama principal única desde hoy: `c3.4-seller-safe` (A19 HECHO).

**2026-10-12 03:00 UTC · PR #29 fusionado (`e625ac4`) → `dpl_2KKcjuTdiTXF8zinYsXxwpEQkSKB` READY en el dominio.**
Verificado en vivo: título "VH LAB · Vonhaucke", bundle `index-R6LCAvH5.js` con `MOTOR_VERSION 2026-10-12`, la política
`produccion-rogelio-2026-10` (A14) y el gate de material (`SAME_FAMILY_COMPATIBLE_PROPOSED`, A20). CI del PR: `verify` +
E2E en verde. **Rollback:** promover `dpl_7gK9TbAuKxFhvH5Exrc8TLrTCAvZ` (`300125d`). Los 6 commits de `perfection-final`
(`d698eea`…`7d60204`) quedaron integrados en este PR (VH-084).

**2026-10-12 04:05 UTC · PR #30 (`34f28f2`) y PR #31 (`d0fa484`) fusionados → Vercel sirviendo `index-Cj30MoXP.js` (buscador
ERP, `insumosFuente`, Precios sólo lectura). Edges desde GitHub Actions: `costear-servidor` v8 (catálogo + fix melamina),
`analizar-mueble` v34 (sólo catálogo curado), `acomodar-espacio-recovery` v8 (sesión obligatoria). ERP reactivado: 9,856
insumos activos; `catalogo_vigente` 10,113 filas, 1,783 certificables. Smoke en vivo de `costear-servidor`: tapa
melamina-19 1.60×0.60 confirmada → 0.5 hoja $272 (regla Producción), bisagra ERP `erp-bibipi` ×4 → $79.40 (aprobado),
PTR 7 m → 2 tramos $458.28; `catalogoFuente: catalogo`, `versionCatalogo cat-ap1793…`, estado preliminar (melamina-19 y
ptr sin documento). `config_para_rol` entrega 259 insumos curados en 1.05 MB / 0.58 s.**

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

**VH-036 · P1 · FIXED (entrada original; la resolución está más abajo, VH-041) · `costear-servidor` rechazaba el
100% de las llamadas del navegador.** `AsistenteEspecial.jsx:179` mandaba `{...b}` con `margen`/`modeloCosteo`;
`validarIntentCosteo` respondía `FORBIDDEN_FINANCIAL_FIELD`. Pendiente VERIFIED en vivo (shadow_costeo).

**VERIFICACIÓN EN VIVO · 2026-10-11 · servidor real, cuenta `qa-direccion@vonhaucke.mx` (dirección).**
Red del entorno abierta al host de Supabase; `e2e/auth.e2e.js` (3 pruebas de login real) 3/3 en verde y
`e2e/vivo.e2e.js` (nuevo; sólo corre con `VIVO=1` + credenciales por variable de entorno, en CI se salta) recorrió los
cinco caminos contra las edges desplegadas, registrando cada respuesta (reporte en el scratchpad de la sesión, no en el
repo):
- `cotizar-texto` 200 → "Agregué 1 mueble" (escritorio App LT con precio; banca con biombo PET fue a especial por
  `material_override`, correcto). VH-070/071 **VERIFIED en vivo**.
- `leer-plano` 200 → compuerta con "◑ Lectura con dudas · 3 cuarto(s), ~84 m² · validación geométrica del servidor:
  requiere revisión · ref. 3101a64e…" (la envolvente vino DERIVED, el servidor pidió revisión y el cliente lo enseñó).
  VH-064 **VERIFIED en vivo**.
- `acomodar-espacio` 200 `layoutSpec.status: PASS` con `doors.total: 0` → el cliente mostró "El servidor acomodó sin
  puertas: nadie verificó accesos ni barridos". VH-067 **VERIFIED en vivo** (y confirma el hueco (c) de VH-068).
- `analizar-mueble` 200 → despiece real de una credenza; el motor marcó costo INCOMPLETO por 2 partidas sin costear
  (pegado de chapa, pintura en polvo): fail-closed correcto, ningún $0.
- `generar-render` 200 → `url` de Storage (`generated/qa-direccion_vonhaucke.mx/2026-10-11/…jpg`, modelo
  gemini-3-pro-image, 2K, audit pass/skipped) y la imagen apareció en el Costeador. VH-072 **VERIFIED en vivo**
  (con el cliente anterior este render se habría tirado).
Efectos en producción, medidos: 2 cotizaciones autoguardadas de `qa-direccion` (una por corrida; sin folio, sin
emitir), 2 `render_eventos`, 2 objetos en `renders/generated/qa-direccion…`, 5 `ai_eventos`. No se borra nada sin
aprobación: queda como C3 en DECISIONES_PENDIENTES. `shadow_costeo` sigue en 0 hoy: la sombra sólo corre en el
Asistente especial ("Costear con IA"), que la pasada no recorrió → VH-036/073 siguen SIN verificar en vivo.
Pendiente tuyo (seguridad): la cuenta de dirección de prueba tiene contraseña trivial; cámbiala o bájala a vendedor.

**SOMBRA cliente↔servidor (VH-036/073) · intento de VERIFIED en vivo 2026-10-11 · NO APLICÓ, por diseño.** Con
`qa-direccion`, "Costear con IA" → `analizar-mueble` 200 (escritorio ejecutivo, 8 piezas) → el motor marcó el costo
INCOMPLETO: 2 materiales existen en el catálogo del servidor sin precio certificado por Compras (`pegado-chapa`,
`pintura-polvo-negro-mate-8-vitracoat`) → sin precio → la sombra no corre (`resultado.costoUnitario > 0 && precio != null`).
Es el comportamiento correcto (nunca comparar un costo parcial) y es la consecuencia práctica de A10 (165 insumos sin
certificar): mientras Compras no certifique, la mayoría de los despieces de IA quedan INCOMPLETOS y la sombra casi
nunca tiene qué comparar. `e2e/vivoSombra.e2e.js` (VIVO=1) deja constancia y pasa con la razón visible.

**RETIRADAS B1–B10 · 2026-10-11 · aprobadas por Dirección ("B1–B10: retirar código muerto").** Diez commits, uno por
módulo, cada uno con la suite completa y el build en verde antes y después (1,208 → 1,165 tests: los que se fueron
probaban código que no corría). Detalle y lo que se conservó (p. ej. `validarColocacion` como oráculo del solver) en
`DECISIONES_PENDIENTES.md` bloque B. Dos filas del inventario que decían "prod 0" estaban mal y NO se retiraron
(`evidencia.js`, `componentesSinMaterial`).

**VH-073 · P2 · FIXED · La comparación sombra cliente↔servidor no guardaba el motivo de los fallos.** `shadow_costeo`
medido 2026-10-11: 41 filas desde el 2026-10-01; 8 coincidencias exactas (diff 0, todas del 2026-10-02); 7 `incompleto`;
**26 errores HTTP 400 del 2026-10-04 al 2026-10-10 con `estado_servidor='error'` y `campos_recibidos=[ok,error,status]`
y nada más**. El texto del error nunca se guardó, así que la tabla no podía responder lo único que debe: por qué no
coinciden. Fix: `datos/sombraCosteo.filaSombra` (puro) arma la fila: `estado_servidor = error:<code|HTTP_n>`, el
motivo (recortado) en `nota` junto al nombre del mueble, sin tocar el esquema. 5 unit. CAUSA de los 26 × 400, CONFIRMADA leyendo
la edge desplegada (v5, actualizada 2026-10-04) y ejecutando su validador contra los dos cuerpos: el validador
desplegado es byte-idéntico al del repo (líneas 1-140); los 400 los provocó el CLIENTE de esos días, que mandaba
`{ pieza: {...b, modeloCosteo}, cantidad }` con `margen`/`factorDirecta`/`modeloCosteo` → `FORBIDDEN_FINANCIAL_FIELD`
en `pieza.margen`. Eso lo corrigió VH-036 (`88bdf31`, 2026-10-11): el cuerpo saneado de HEAD pasa el validador
desplegado sin redeploy. El 400 del servidor no trae `error` (sólo `code`+`issues`), por eso el cliente guardaba el
texto genérico de supabase-js; `filaSombra` ahora guarda `code`. Corrección a lo que escribí antes aquí: NO era un
desfase de contrato servidor↔cliente. Lo que SÍ está desfasado (A8): el deploy usa margen por omisión 40 (repo: 50,
VH-041) y su `calculo.js` no tiene el check "sin cantidad ni medidas" ni `estadoCosto/pendientes/costoOficial`: el
servidor puede llamar "certificado" a lo que el cliente ya marca incompleto. VERIFIED en vivo sigue pendiente: hace
falta que `shadow_costeo` reciba filas nuevas con el cliente de HEAD.

**VH-072 · P0 · FIXED · Todos los renders con IA se perdían en el cliente desde el 4 de octubre.** La edge
`generar-render` v30 (desplegada 2026-10-04) ya no devuelve la imagen en base64: la guarda en Storage
(`renders/generated/<correo>/<fecha>/<request_id>.png`) y responde `{ ok, url, storagePath, audit, request_id }`;
`dataUrl` sólo viaja si Storage falló (`storageFallback: true`). Los DIEZ consumidores del cliente leían `r.dataUrl`:
Costeador guardaba `imagen: undefined`; `renderParaPartida` respondía "No se pudo generar el render" (exigía
`startsWith('data:')`); Acomodo (vista realista, escenas, oficina, staging) y Cotización (`fijarRender3d`) mandaban
`undefined` a Storage; Asistente especial y Cocrear V2/V3 caían al mensaje de error. MEDIDO en producción 2026-10-11:
41 intentos en `render_eventos` en 30 días, 6 archivos en `renders/generated/` desde el despliegue — renders pagados a
Gemini, auditados y guardados que la pantalla tiró como fallo. Fix: `datos/renderRespuesta.leerRespuestaRender`
(puro) lee `url` o `dataUrl` → `imagen` + `enStorage`; `nube.generarRender` lo aplica una sola vez; los consumidores
usan `r.imagen`; `imagenAStorage` y `renderParaPartida` NO re-suben lo que ya es URL pública; Asistente especial trae
los bytes (`urlADataUrl`) sólo cuando necesita la imagen como referencia de la segunda generación. `ok:true` sin
imagen ya no es éxito. Pruebas: 5 unit `renderRespuesta`, +2 `renderPartida`, +1 `imagenStorage`, 1 e2e (Costeador
recibe la URL de Storage como imagen). Sin tocar la edge. Pendiente de decisión: enseñar `audit` (QA visual) en pantalla.

**VH-069 · P1 · FIXED (DESPLEGADO 2026-10-11 con aprobación expresa "A1+A2") · `cotizar-texto` v12 y `analizar-negocio` v1 no
tenían compuerta de rol, límite ni telemetría.** RESOLUCIÓN: `cotizar-texto` v13 y `analizar-negocio` v2 con el mismo
wrapper que `leer-plano` (JWT real + `permitidos` + rol, 30/h usuario y 200/h global fail-closed, `ai_eventos` al inicio con
tokens y duración, `request_id`); el comportamiento de v12 (ruta/producto separados, cierre de aclaraciones, extras
sugeridos descartados) se conserva íntegro. Verificado en vivo: 401 sin sesión, 400 `MISSING_CATALOG`, llamadas reales
200 con `request_id` y filas en `ai_eventos` (`cotizar-texto` 5,403/397 tokens; `analizar-negocio` 2 filas). Respaldo
exacto de v12/v1 guardado en la sesión para rollback (redeploy). Texto original: Leída completa 2026-10-11 (header dice v11, metadatos v12). A diferencia de `leer-plano`,
`analizar-mueble` y `acomodar-espacio`, NO consulta `permitidos`, NO limita por usuario/hora, NO escribe `ai_eventos`
(medido: 0 filas de `cotizar-texto` en la tabla; las otras tres sí registran) y llama a `claude-opus-5` con
`max_tokens 8000` por cada petición. Sólo la protege `verify_jwt`. Hoy los 11 usuarios de `auth.users` están en
`permitidos` (0 sin permiso), así que la exposición actual es interna, pero sin límite ni rastro. Además recibe del
cliente `reglas` y `aprendizajes` y los pone en el prompt como "REGLAS DE LA CASA (MANDAN)" (ya VH-060) y `catalogo`
completo (fuente de verdad del modelo). Lo bueno: no da precios, descarta en servidor los extras `sugerido`,
cierra aclaraciones a la tercera ronda. Propuesta (no aplicada): mismo wrapper que `leer-plano` (permitidos + rol,
30/h usuario, 200/h global fail-closed, `ai_eventos` al inicio, `request_id`), y leer reglas/aprendizajes aprobados de
la base en lugar del body.

**VH-070 · P3 · FIXED · Los extras que la IA sugirió y el servidor descartó no se le decían al vendedor.**
`cotizar-texto` devuelve `sugerenciasDescartadas` (regla 9: cero extras cobrables sin pedirlos); el cliente lo
ignoraba. Ahora se enseña "Voni pensó en X, pero no lo pediste y no lo agregué" (`data-testid=sugerencias-descartadas`),
sin cobrarlo. e2e en `cotizarTexto.e2e.js`.

**VH-071 · P1 · FIXED · En Voni paso 2, si la IA no pudo agregar nada, el vendedor no veía ninguna explicación.**
`CotizadorIA` con `pantalla='formulario'` escondía la tarjeta de resultado y el salto a 'revisar' sólo ocurre si se
agregó algo. Un pedido cuyo único producto quedaba "sin precio autorizado" (fail-closed correcto) o fuera de catálogo
dejaba la pantalla del formulario intacta, con el botón cambiado a "Volver a interpretar" como única pista.
Reproducido en e2e con la nube falsa. Fix: el resultado SIN agregados se enseña siempre (avisos: sin precio, no está
en catálogo, no pude costear, preguntas). También se cuentan `especiales` y `sugerenciasDescartadas` en el total de
avisos. Primer e2e del camino COTIZAR con IA (`cotizarTexto.e2e.js`, 2 pruebas): el vendedor recibe con precio sólo
lo que tiene precio real (banca doble 6u con fila en `preciosVenta`), el escritorio sin precio autorizado NO entra
en $0, lo inexistente se dice, y la economía nunca viaja en la partida del vendedor.

**VH-067 · P1 · FIXED · El acomodo "Con IA" tomaba `ok: true` del servidor como acomodo logrado.** La edge
`acomodar-espacio` v9 (leída completa 2026-10-11: index.ts 513 líneas + acomodo-core/spatial-core/spatial-semantics)
responde SIEMPRE `ok: true` HTTP 200 y pone el veredicto en `layoutSpec.status` (PASS / REVIEW_REQUIRED / PARTIAL /
FAIL) con `validation.issues/reviews`, `noColocadas` y `puertas`. `Acomodo.acomodarIA` hacía `setPlan(r.plan)`: un
FAIL (cero piezas) se veía como "acomodado" vacío sin explicación; un PARTIAL no decía qué faltó; las revisiones
semánticas y las puertas sin barrido verificable se perdían. Fix: `datos/acomodoServidor.interpretarAcomodoServidor`
(puro): FAIL o sin colocación ⇒ error con los problemas traducidos (encimado entre X y Y, fuera del cuarto, tapa
puerta, zona que no admite…) y las piezas no colocadas con nombre; PARTIAL/REVIEW ⇒ plan usable + avisos + `auditoria`
comparable a la del planner local (validación del servidor, todas colocadas, sin problemas geométricos, puertas
verificadas) + `servidor {estado, metodo, requestId, calidad}` sellado en el plan guardado. "Sin puertas en el plano"
NO cuenta como puertas verificadas aunque el servidor diga VERIFIED (no había nada que verificar). Pruebas: 8 unit,
2 e2e (FAIL y PARTIAL con nube falsa). No se tocó la edge.

**VH-068 · P2 · FIXED (edge v10 DESPLEGADA 2026-10-11 con aprobación expresa "Desplegar A5") · Huecos de validación en `acomodar-espacio` v9.**
Medido en el código desplegado: (a) el encimado contra OBSTÁCULOS (columnas) sólo se revisa para piezas con
`spatial_spec` de clearance (`usoInvadido` gated por `requiereClearance`, index.ts:344-346); una reparación de la IA
que ponga una guarda sobre una columna pasa `evaluar`; (b) `evaluar` pasa el área CRUDA del cliente a
`usoInvadido`/`bloqueaPuertaEspacial` (línea 340) mientras `insideArea` usa la geometría normalizada `_g`: con áreas
en `width_mm/puntos` (sin `ancho/largo`) toda pieza con clearance sale `FUNCTIONAL_CLEARANCE`; (c) sin arreglo
`puertas` el plan sale `doors.verificadas=true` ⇒ PASS/render_ready (spatial-core.js:215-232) — el cliente lo
compensa desde VH-067; (d) si la IA falla tras la pasada determinista el error se traga (`catch … break`, 430-433) y
la respuesta no lo dice; (e) la fila `ai_eventos` que alimenta el límite 30/h se inserta al FINAL en un try vacío
(474-481): una petición que falla antes no cuenta y si el insert falla el límite deja de operar; (f) contención en
polígono por 5 puntos muestreados (no rect-en-polígono): un cuarto en L puede dejar un canto afuera;
(g) `acomodo-core.js` exporta un segundo validador (`validarColocacion`, `acomodarConReparacion`) que index.ts NO
importa y que discrepa del vivo (ése sí revisa obstáculos para toda pieza): código muerto desplegado → RETIRAR.
Propuesta (no aplicada): usar `_g` + obstáculos para toda pieza en `evaluar`, puertas ausentes ⇒ REVIEW_REQUIRED,
`model_error` en la respuesta, insertar `ai_eventos` al inicio (como leer-plano), borrar el validador muerto.

Cierre (2026-10-11): v10 corrige (a)–(f) y (g) quedó retirado en B6. Despliegue verificado: re-descarga comparada con el repo
(3 archivos idénticos; `spatial-semantics.js` sólo difiere en el escape `\u0300-\u036f` de la regex, misma clase de caracteres).
En vivo con qa-direccion: sin JWT 401; rectángulo 6000×4000 sin puertas con bench + 4 sillas ⇒ 5/5 colocadas,
`status REVIEW_REQUIRED`, `puertas {total:0, verificadas:false, status:NONE}`, recomendación "El plano no trae puertas";
cuarto en L (polígono 6 vértices) con puerta ⇒ `PASS`, escritorio y silla dentro de la L (comprobado por geometría
independiente), `puertas VERIFIED`; `ai_eventos` ahora trae `modo repair-loop-v10`, `duration_ms` y `model_status`
(las filas v8 traían `duration_ms null`). El encabezado del archivo sigue diciendo "PENDIENTE DE DESPLEGAR" a propósito:
cambiarlo rompería la identidad byte a byte repo↔desplegado; se corrige en el siguiente redeploy que toque la función.

**VH-066 · P2 · FIXED · El Modo avanzado (Costeador) callaba cuando `analizar-mueble` usó el catálogo de respaldo.**
La edge devuelve `catalogoFuente: 'cliente-fallback'` cuando el catálogo central no estuvo y la IA ancló materiales
con las pistas locales del navegador (#8, 2026-10-04). El Asistente especial ya avisaba "no cotices en firme"; el
Costeador ignoraba el campo y presentaba el despiece igual que uno canónico. Fix: estado `catalogoFuente` + alerta
ámbar (`data-testid=catalogo-fallback`) con el mismo texto que el Asistente especial. e2e nuevo
`costeadorCatalogo.e2e.js` (2) con ruta `analizar-mueble` en la nube falsa (propuesta fija, sin LLM). Pendiente de
decisión: unificar la alerta en un componente único para ambas pantallas (hoy el texto está duplicado a propósito
para no tocar el Asistente especial en este tramo).

**VH-065 · P1 · FIXED (edge v33 DESPLEGADA 2026-10-11 con aprobación expresa "Desplegar A4") · `analizar-mueble` v32 no validaba la propuesta
de la IA en el servidor.** Leída completa 2026-10-11 (index.ts 579 líneas + requestPlan/modelConfig/telemetria).
Lo bueno: no devuelve ningún precio (el motor costea), auth real por `permitidos`, límites 40/h usuario y 400/h
global fail-closed, modelo en lista blanca. Lo que falta, con línea: (a) `propuesta = JSON.parse(texto)` se regresa
tal cual: no comprueba que `insumoId` exista en `insumos_catalogo`, ni que `material_match=EXACT` implique id, ni
que `hojas/cantidad/largoMM/anchoMM` sean > 0 (el esquema quita `minimum`); (b) el `catalogo` que manda el cliente
se interpola al prompt sin validar y SIN marca distinta de las líneas canónicas (líneas 565-575), aunque el
comentario diga "sólo pista": un id inventado por el cliente puede volver como material "del catálogo";
(c) `canonicoOk` sólo mira `insumos_catalogo` (línea 546): si `catalogo_vigente` falla pero el catálogo responde,
la respuesta dice `catalogoFuente: "canonico"` con TODOS los insumos marcados "SIN PRECIO CERTIFICADO"; (d) `revisar.piezas`,
`respuestas` y `descripcion` entran al prompt sólo recortados. Mitigación vigente en el cliente, verificada:
`materialMatch.aplicarPoliticaMaterial` convierte un id EXACT que no existe local en NOT_AVAILABLE sin precio (VH-053)
y `motor/calculo` marca piezas sin medidas o sin precio como PENDIENTE (costeo INCOMPLETO, no emitible). Es decir:
el servidor no inventa precios y el cliente no costea en $0, pero la validación de forma debería vivir en la edge.
Propuesta (no aplicada): validador determinista en la edge tras el parse (ids ∈ catálogo o `''`+NOT_AVAILABLE,
números finitos ≥ 0, `canonicoOk = rc.ok && rp.ok`), y marcar las pistas del cliente como "(no certificado)".

Cierre (2026-10-11): v33 desplegada con `sanearPropuesta` (ids fuera de catálogo → ''+NOT_AVAILABLE anotado, números no
finitos → 0 anotado, EXACT sin id → NOT_AVAILABLE, match desconocido → corregido), pistas del cliente marcadas
"(catálogo local del cliente, no certificado)", `canonicoOk` exige `catalogo_vigente` Y `insumos_catalogo`. Re-descarga
comparada: 4/4 archivos byte-idénticos al repo. En vivo con qa-direccion: sin JWT 401; descripción de escritorio con un
id falso en el `catalogo` del cliente ⇒ `ok`, 9 piezas todas con id canónico (el modelo no usó el id falso),
`validacion {ok:true, ajustes:[], autoridad:SERVER_CATALOG}`, `catalogoFuente canonico`, `request_id`; `ai_eventos`
status ok, `model_id claude-opus-5`, `catalog_count 260`, tokens 20738/3687, 40.7 s. Falta provocar en vivo un ajuste
real del validador (el modelo no mordió el id falso); la lógica está cubierta por lectura, no por prueba viva.

**VH-064 · P1 · FIXED · La app tiraba la validación determinista del servidor al leer planos.** La edge
`leer-plano` v11 (leída 2026-10-11) revalida toda la salida de la IA y devuelve `floorSpec.validation` con
`state` PASS / REVIEW_REQUIRED / FAIL, `warnings` (envolvente SUPUESTA por el modelo, cuarto con confianza baja,
puerta sin barrido verificable, sin cotas…) e `issues` (cotas que no suman la envolvente, vértices fuera, cuartos
encimados, con números) y un `request_id`. El cliente (`leerPlanoDeArchivo`) sólo leía `lectura` y medía traslapes
locales: una lectura con la envolvente supuesta salía "✓ Lectura confiable", y en un FAIL (422) la persona veía la
frase genérica sin saber qué no cuadró. Fix: `floorSpecAvisos.js` traduce códigos a español (un código desconocido
se enseña, no se esconde) y `nivelCombinado` deja que el servidor BAJE el nivel (REVIEW_REQUIRED o sin validación
⇒ a lo más "media"; FAIL ⇒ "baja"), nunca lo suba; `nube.leerPlano` conserva `code/floorSpec/request_id` del error;
la compuerta `ConfirmarLectura` muestra el veredicto (`data-testid=lectura-servidor`) y los avisos; Voni y Acomodo
sellan `servidor` en la lectura confirmada. Pruebas: 5 unit `floorSpecAvisos`, 4 unit `leerPlanoDeArchivo`, 2 e2e
(REVIEW_REQUIRED y FAIL con nube falsa que ahora manda `floorSpec` como la edge). No se tocó la edge.

**VH-063 · P2 · FIXED (migración APLICADA 2026-10-11 con aprobación expresa "A3 sólo descuento") · El vendedor no podía saber antes de verificar que su
descuento requeriría aprobación.** RESOLUCIÓN: `public.politica_comercial_publica()` (security definer, `authenticated`) expone SÓLO `vigente`, `version` y `descuento_max_sin_aprobacion`; el margen mínimo NO viaja (decisión de Dirección). Verificado en vivo: con sesión de `qa-direccion` devuelve `{version:1, vigente:true, descuento_max_sin_aprobacion:40}`; sin sesión `permission denied`; desde SQL sin `auth.uid()` `no autorizado`. Cliente: `datos/politicaComercial` (leerPolitica/avisoDescuento, 4 unit) + aviso ámbar junto al campo de descuento en Cotización (`data-testid=aviso-descuento`, e2e vendedor 45 %→aviso, 30 %→nada). La autoridad al emitir sigue siendo el servidor. Texto original: La política vigente (leída 2026-10-11: margen mínimo 25 %, descuento máximo sin
aprobación 40 %, versión 1 aprobada el 2026-10-02) sólo la lee Dirección (RLS `rc_sel`) y la RPC
`reglas_comerciales_vigentes` está concedida sólo a `service_role`. La pantalla deja teclear hasta 60 % y el
vendedor descubre al final que "requiere aprobación de Dirección para este contenido", sin saber que fue el
descuento. Propuesta: `supabase/migrations/20261011180000_politica_comercial_publica.sql` (PENDIENTE DE APLICAR)
expone sólo los dos umbrales y la versión a cualquier usuario permitido; con eso la compuerta local avisa junto al
campo de descuento. No se aplica ni se cambia la política sin aprobación. Mientras, VH-062 cerró con el check
semántico ("cada mueble en una zona que lo admite") también medido en la auditoría del planner.
ACTUALIZACIÓN 2026-10-11 (leída `cotizar-servidor` v6, desplegada 2026-10-02, NO llamada por el cliente): esa edge ya
devuelve `descuento_max_sin_aprobacion` y `reglas_version` a CUALQUIER rol permitido (vendedor incluido) y
`margen_minimo_pct` sólo a Dirección; evalúa líneas con identidad de Producto Maestro contra `resolver_precio_autorizado`
/ `resolver_precio_especial_proyecto` y la política vigente (piso, descuento, costo, margen). Es decir: la exposición
del umbral de descuento que propone la migración ya es política del servidor; la migración sólo la hace accesible sin
mandar líneas. Alternativa sin migración: cablear el cliente a `cotizar-servidor` para las líneas v2 (bloque LÍNEA V2,
no trivial: hoy el cliente evalúa con `evaluar_emision_cotizacion`).

**VH-062 · P1 · FIXED · La "auditoría" del planner tenía tres checks con `ok: true` fijo.** "Cada mueble dentro de
su cuarto", "Nada encimado" y "Baños y servicios sin amueblar" se escribían siempre en verde, con un detalle que
explicaba por qué *debería* ser cierto ("la malla no reutiliza celdas"), no si lo era. Un encimado por arrastre
manual, por `sentarSillas` o por un bug de empaque salía auditado como correcto. Fix: `planner.auditoriaMedida()`
mide los tres contra el resultado con `acomodoAudit.auditarColocacion` (el mismo auditor de la pantalla) y
nombra las piezas en falta; "Reparto por criterio" se queda informativo. 3 tests, incluido un acomodo construido
con encimado, pieza fuera de área y mueble en baño.

**VH-061 · P2 · FIXED · Dos lecturas del nombre de un cuarto que no se hablaban; "Site" recibía muebles en el
planner mientras floorSpec lo prohibía.** `planner.rolArea` (dónde se acomoda) y `floorSpec.zonaSemantica` (qué
se permite) tenían cada una su regex. Medidas con 30 nombres reales coincidían salvo site/IT/rack: 'general'
para el planner (acomodaba muebles) y SITE_IT para floorSpec (prohíbe todo mueble). Fix: `datos/cuartos.js`
`clasificarCuarto(nombre) → {rol, zona}` es la única lectura; `rolArea` y `zonaSemantica` derivan de ella y
`ZONA` vive ahí. Único cambio de comportamiento: site/IT/rack es 'servicio' también para el planner.
Caracterización de 29 nombres contra la salida medida antes del cambio + Site. De los "7 clasificadores" del
inventario, los dos de CUARTOS quedan en uno; los de PIEZAS (`espacio.tipoDe`, `rolDePiezaAcomodo`, `esSilla*`)
y el de SÍMBOLOS (`rolDeSimboloEnZona`) clasifican cosas distintas y siguen separados a propósito.

**VH-059 · P1 · FIXED · "Voni aprende" estaba roto en silencio y lo no revisado entraba al prompt.** Verificado
contra la RLS de `aprendizajes` (02_rls_policies.sql): INSERT exige `usuario = correo de la sesión` y
`aprobado_para_ia = puede_editar_config()`. El cliente mandaba `usuario: estado.usuario.correo` —un campo que
no existe en el estado— y nunca `aprobado_para_ia`, así que la fila se rechazaba y `anotar` lo tragaba (por
diseño "aprender nunca tumba una cotización"). Producción: 62 lecciones, 41 sin usuario (anteriores a la
política), última 2026-10-05, ninguna después del endurecimiento del 2026-10-10. Además `aprendizajesTexto()`
mandaba al prompt TODO lo activo sin mirar `aprobado_para_ia`: una lección de un vendedor sin revisar habría
viajado al prompt de todos. Fix: `quienAnota()` resuelve correo y rol de la sesión; `anotar` atribuye y marca
`aprobado_para_ia = veCostosCosteo(rol)` (misma regla que la base); al prompt sólo entra lo aprobado;
`aprobar(id)`, `pendientesDeRevision()`; en "Lo que Voni sabe" Dirección/Diseño ven "Pendientes de revisión"
con Aprobar/Descartar (mandato §6: evidencia, procedencia, revisión). CotizadorIA deja de inventar el campo.
4 tests `aprendizaje.test.js`.

**VH-060 · P1 · FIXED (servidor, 2026-10-11) · `cotizar-texto` y `analizar-negocio` meten al prompt el texto RESOLUCIÓN: las edges v13/v2 leen `reglas` activas (ámbito propio o 'general') y `aprendizajes` activos con `aprobado_para_ia` directo de la base, por `veces`, y IGNORAN `reglas`/`aprendizajes` del body; si la base no responde: 503 CONTEXTO_UNAVAILABLE. El cliente dejó de mandarlos. Medido en vivo: contexto {reglas:4, aprendizajes:25} para cotización; para 'negocio' hay 0 reglas en la tabla (no existe el ámbito 'negocio'; sí 'precio' con 7): Dirección decide si 'precio' debe alimentar a Voni negocio.
de `aprendizajes` que les manda el navegador, sin leerlo de la base.** Cualquier cliente autenticado puede
inyectar instrucciones al modelo con `body.aprendizajes`. Con VH-059 el cliente oficial sólo manda lo aprobado,
pero la autoridad debe ser el servidor: las edges deberían leer `aprendizajes where activo and aprobado_para_ia`
con service role e ignorar el campo del body. Cambio de edge, no se despliega sin aprobación.

**VH-058 · P1 · FIXED · Convertir una cocreación en partida tragaba cualquier error y la partida salía sin
identidad ni procedencia.** `CocrearV3.agregarCotizacion` envolvía guardar expediente → registrar Producto
Maestro → subir render en un `try{}catch{}` vacío: si el servidor rechazaba el registro (p.ej.
`expediente_incompleto_no_publicable`) la partida se agregaba igual con `producto_id` null, es decir como línea
legacy, y podía emitirse sin Producto Maestro. Además no llevaba `source_type/source_ref` (el expediente) ni la
URL del render canónico que acababa de subir. Fix: `cocrear.partidaDesdeCocrear()` arma el costeo con
producto_id/version, `source_type:'expediente'`, `source_ref`, `expedienteId` (ahora clave de enlace del
contrato), `origen:'cocrear'` y el render como URL; el flujo es fail-closed: sin expediente guardado o sin
registro del producto NO se agrega y se dice el motivo del servidor; el render sigue siendo opcional. 2 tests.

**VH-057 · P1 · FIXED · Dirección no tenía dónde ver las aprobaciones pendientes.** El Deal Desk vive dentro de un
PROYECTO comercial y lista sólo las aprobaciones de las cotizaciones de ese proyecto; una cotización sin
proyecto (las que nacen en el Costeador, la mayoría) pedía aprobación a un buzón que nadie abría. Fix:
`AprobacionesPendientes` en el Archivo, sólo para Dirección (`esDireccion`), lista TODAS las pendientes (RLS
`aprob_sel`: Dirección ve todas) con solicitante, motivo, descuento y versión, y resuelve por la RPC
`resolver_aprobacion`. `crm.listarAprobacionesPendientes`. E2E: el vendedor pide → Dirección entra a su Archivo,
ve "Aprobaciones pendientes (1)" con el motivo, aprueba → el vendedor verifica, emite y el hash coincide; el
vendedor no ve la cola en su Archivo.

**VH-055 · P0 · FIXED · Una cotización que requería aprobación de Dirección no se podía emitir desde la app:
nadie podía pedir la aprobación, y la verificación la habría negado aun aprobada.** Tres hechos verificados:
(1) `crm.solicitarAprobacion` (insert directo en `aprobaciones`) no tenía ningún consumidor: la pantalla decía
"Requiere aprobación de Dirección" sin botón para pedirla; producción tiene UNA aprobación (2026-10-04, hecha
por RPC). (2) El insert directo crea filas sin `reglas_version`, que `verificar_aprobacion` nunca reconoce
(exige `reglas_version = vigente`). (3) `cotizacion_emitible` evalúa un snapshot sin folio/cliente/acomodo;
`hash_revision` incluye esos campos, así que su hash no coincide con el de una aprobación firmada sobre el
snapshot completo: "Verificar emisión" diría APPROVAL_REQUIRED aunque `emitir_revision_v2` (snapshot completo)
pasara. Fix cliente, sin tocar el servidor: `nube.evaluarEmision(id, snapshot)` llama
`evaluar_emision_cotizacion` con EL MISMO snapshot (`snapshotEmitido`) que se emite; App.verificarEmision lo
usa. `nube.solicitarAprobacionSnapshot` → RPC `solicitar_aprobacion_snapshot` (hash y reglas_version los pone
la base); `crm.solicitarAprobacion/resolverAprobacion` delegan a las RPCs (Deal Desk sigue igual).
Cotizacion.jsx: con APPROVAL_REQUIRED aparece "Solicitar aprobación a Dirección" con motivo opcional; avisa si
ya existía una pendiente para esa versión exacta y que un cambio obliga a pedirla de nuevo. Nube falsa:
`evaluar_emision_cotizacion`, `solicitar_aprobacion_snapshot`, `resolver_aprobacion`, tabla `aprobaciones`
(verificar_aprobacion por hash + reglas_version). E2E (emision.e2e.js): margen 16 % → APPROVAL_REQUIRED → el
vendedor la pide (#1, sin duplicar) → PDF bloqueado → Dirección aprueba → "Lista para emitir" → PDF baja y la
revisión conservada tiene EL MISMO hash que la aprobación; el snapshot del vendedor no lleva economía.
`cotizacion_emitible` queda en el servidor con su inconsistencia documentada (VH-056).

**VH-056 · P2 · OPEN (migración, requiere aprobación) · `private_api.cotizacion_emitible` hashea un snapshot
distinto al de la emisión.** Arma `{partidas, totales, total}` y `hash_revision` incluye folio/cliente/acomodo:
su `hash` nunca coincide con una aprobación. El cliente ya no la usa (VH-055). Propuesta: que construya el
snapshot con folio/cliente/acomodo de la fila, o que se retire. Sólo lectura hasta aprobación.

**VH-054 · P1 · FIXED · Tres filtros de rol en el cliente que no coincidían entre sí ni con el servidor; un rol
autodeclarado abría economía.** `voni/permisos.js` daba economía a 'costeador' y 'cfo' (roles que
`permitidos` nunca emite: un `role:'cfo'` en la petición bastaba para que las tools económicas respondieran
costo); `datos/voni.js` aceptaba 'admin' por regex de subcadena; `voniContext.js` sólo direccion; App.jsx
comparaba el texto crudo. El servidor decide con dos funciones (08_private_api.sql): `puede_ver_economia` =
direccion; `puede_editar_config` = direccion|diseno. Fix: `datos/roles.js` (`normalizarRol`,
`veEconomiaCotizacion`, `veCostosCosteo`, `esVendedor`) es la única lectura; lo desconocido cae a vendedor
(mínimo privilegio). Los cuatro consumidores la usan; la prueba 5 de `voni.test.js` que exigía economía para
'costeador' se invirtió a propósito: ese rol no existe en el servidor, Diseño (rol real) sí ve costeo. Nota:
`voni-council` (edge) ya resolvía el rol desde `permitidos` y sanitizaba por su cuenta, así que el servidor
nunca filtró economía por este hueco; el riesgo era en lo que el cliente mostraba localmente. 3 tests roles.

**VH-053 · P1 · FIXED · Cuando la IA elegía un material del catálogo del servidor que el navegador no tiene, la
pieza se sustituía en silencio por un pariente local o quedaba "sin material" sin decir por qué.** Derivado de
VH-051 (167 ids sólo en el servidor, 0 certificados). `aplicarPoliticaMaterial` recibía un id desconocido y
(a) si la familia existía localmente lo AUTO-ASIGNABA a otro insumo de la familia con `clase: EXACT` y
`autollenado: true`, que el Costeador NO mostraba (su alerta sólo salía para NOT_AVAILABLE/SUBSTITUTE) y el
Asistente especial no mostraba ninguna alerta de material; (b) si no, decía "el catálogo no tiene un insumo
certificado para esa familia", falso: el material existe, lo que falta es el precio certificado. Fix: un id
que la IA declara `material_match: EXACT` y no existe localmente queda PENDIENTE con `servidorId` y
`sinPrecioCertificado`, con el motivo honesto ("existe en el catálogo del servidor como «id», sin precio
certificado por Compras") y SIN auto-asignación (sería sustitución silenciosa). `alertaMaterial(_match)` es el
único texto de alerta y lo pintan las dos pantallas, incluido el auto-asignado por familia (ámbar, "confírmalo").
El Asistente especial ya no dice "se costea en $0" (desde VH-040 queda pendiente). 3 tests materialMatch.

**VH-052 · P2 · FIXED · Componentes de EcoAcustic y TeamSpace II salían con "· undefined" en el nombre cuando
nadie eligió color.** `configDesde` manda `color: undefined` a propósito (el color lo elige la persona) y ese
`undefined` pisaba el default del generador; el despiece y la cotización mostraban "EcoAcustic Flex (por m²) ·
undefined". Encontrado por la auditoría de unidades sobre los 24 generadores (1,110 componentes). Fix en los
dos generadores: sin color, el nombre lo omite. Test `nombresSinColor.test.js` recorre TODOS los generadores con
config por omisión y exige que ningún nombre contenga "undefined"/"null".

**VH-051 · P1 · OPEN (decisión Dirección/Compras) · La IA de despiece elige materiales de un catálogo que el
navegador no puede costear.** Leído en producción el 2026-10-11 (sin escribir): el navegador costea con
`config.datos.insumos` (92 insumos); la edge `analizar-mueble` le ofrece a la IA `insumos_catalogo` (259 activos)
con precios de `catalogo_vigente` (257). 167 insumos existen sólo en el servidor (cubiertas 99, ecoacustic 28,
acabados 20, metal 8, eléctrico 5, gráficos 4, mamparas 2, herrajes 1). De esos 167, **0 tienen precio certificado**:
165 son "propuesto" con precio y 2 no tienen precio. De los 92 compartidos, 62 tienen precio distinto en el
servidor, pero **los 30 certificados coinciden al centavo** con config: las diferencias son propuestas de
Compras sin certificar (y 8 cambios de base m²→hoja: mdf 210/m² vs 437/hoja). Conclusión honesta: el navegador
NO costea mal con lo que tiene; el problema es que la IA puede señalar 167 materiales que ningún rol puede
costear hoy, y la pieza queda "pendiente" sin decir por qué. Sólo Dirección/diseño pueden leer
`insumos_catalogo` (RLS `cat_lee`). Decisiones: (a) Compras certifica los 165 propuestos (backlog), (b) definir
si `catalogo_vigente` certificado sustituye a `config.datos.insumos` como fuente del motor (hoy coinciden), (c)
mientras, mostrar "existe en el catálogo del servidor, sin precio certificado" en vez de "material inexistente"
(cambio de UX, sin tocar precios). No se cambia la fuente de precios sin aprobación (mandato §3/§10).

**VH-050 · P1 · FIXED · El costo de la banca App LT (y de todo precio de price-book o por usuario) se derivaba
del precio y la pantalla lo etiquetaba "real".** `precioDePieza` calcula `costoImplicito(precio/0.6)` cuando el
precio viene por usuario (App LT) o de un presupuesto cerrado, pero no marcaba `costoDerivado`; `claseCosto`
lo clasificaba "real" y Dirección veía una utilidad "medida" sobre un costo que es precio/0.6/3.6. Verificado
con la banca doble App LT 6 usuarios: costo 9,125 = 19,710/0.6/3.6. Fix: `precioDePieza` devuelve
`costoDerivado`, `partidaModelo`/`costearConfig` lo propagan (también en la rama de artículo de catálogo),
`EditarPartida.partidaEditada` lo conserva y `Voni.onVariante` lo marca. Ningún número cambia; cambia la
etiqueta: "≈" (derivado) donde antes decía medido. 3 tests `lineas.costoDerivado.test.js`.

**VH-049 · P1 · OPEN (decisión de Dirección) · Una copia vieja de la app se sirve públicamente sin sesión.** La
función edge `app` (v4, `verify_jwt:false`, ago-2026) hace `fetch` de `storage/v1/object/public/app/index.html`
(3,217,765 bytes, actualizado 2026-08-19) y lo devuelve como HTML. Es un build de un solo archivo de hace dos
meses: fórmulas, compuertas y pantallas viejas, alcanzable por cualquiera con la URL. El bucket `app` es público
y tiene 242 objetos (22.6 MB). La app vigente se sirve desde Vercel. Propuesta: borrar la función `app` y, si
nadie depende de ese bucket, hacerlo privado o vaciarlo. No se toca sin aprobación expresa (mandato §10). Mientras,
`voni-council` (la única edge que el cliente invoca y no estaba en el repo) quedó versionada tal cual (v12).

**VH-048 · P1 · FIXED · La nube falsa de E2E respondía `estado:'EMITIBLE'` a `cotizacion_emitible`, un
estado que el servidor no emite; la decisión de bloquear en Cotizacion usaba el veredicto crudo del servidor
en vez de la compuerta fundida.** Con 'EMITIBLE' el cliente real habría bloqueado la emisión ("No se puede
emitir: EMITIBLE"); ningún E2E ejercitaba la emisión. Fix: `e2e/nubeFalsa.js` implementa `evaluarEmision`
con la MISMA lectura que `private_api.evaluar_emision_cotizacion` (línea 1-based, identidad en tres grafías,
costo sólo de la fila persistida, `costoEstado`, margen mínimo 25, estados BLOCKED/ECONOMICS_INCOMPLETE/
APPROVAL_REQUIRED/ALLOWED), `cotizacion_emitible`, `emitir_revision(_v2)` (gate ALLOWED, total = escalera
exacta, precioLista = Σ round(pu×cant,2), dedup por hash, `generado_v2`) y `cotizacion_revisiones_seguras`
(sin economía para quien no la ve). `Cotizacion.conCandado` decide con `combinarGate(local, servidor)`.
Certificación `e2e/emision.e2e.js` (3): Dirección sana → "Lista para emitir" → el PDF baja Y el servidor
conserva la revisión con el snapshot emitido y el total exacto; vendedor sin precio → botón bloqueado antes de
preguntar, motivo a la vista, servidor coincide; costo desconocido (sólo el servidor lo sabe) → "Faltan datos
para cotizar", el PDF NO sale, 0 revisiones, `emitir_revision` nunca se llama. También: `pdfPropuesta` tenía
dos helpers URL→dataUrl (uno mío de VH-046); queda uno. Suite · 13 E2E · build.

**VH-047 · P1 · FIXED · Cuatro compuertas de emisión en el cliente con cuatro vocabularios; el servidor leía
una clave de costo que el cliente nunca escribía.** El servidor es la autoridad (`private_api.evaluar_emision_cotizacion`
→ BLOCKED / ECONOMICS_INCOMPLETE / APPROVAL_REQUIRED / ALLOWED; `emitir_revision_v2` no registra si no es ALLOWED;
leídas de producción con `pg_get_functiondef`, sin modificar). En el cliente convivían `senales.bloqueosDeEmision`
(CANTIDAD_INVALIDA…), `voniContext.porQueNoPuedoEmitir`, los checks sueltos de `Cotizacion.jsx` (exclusiones,
`probEmision`) y `partida.validarPartida`, cada uno con su propia idea. Hallazgo adicional verificado: el servidor
lee `costoEstado` ('preliminar' | 'incompleto' | 'bloqueado') en las líneas sin ProductVersion, y el cliente
escribía `estadoCosto` ('completo' | 'incompleto'): el veredicto "costo no certificado" del servidor nunca podía
dispararse por esa vía (hoy lo atrapaba sólo porque el costo incompleto viaja como null). Fix: `datos/emision.js`
= espejo local del servidor (mismos estados, mismos códigos `linea_N_*`, misma lectura de identidad en tres
grafías, misma clave `costoEstado`) + lo que sólo el cliente sabe (`linea_N_sin_material`,
`piezas_excluidas_sin_confirmar`, `sin_partidas`); `combinarGate` funde servidor+local (gana la severidad mayor,
razones unidas; si el servidor no respondió se dice `servidorConsultado:false`). `bloqueosDeEmision`,
`problemasDeEmision` y `porQueNoPuedoEmitir` DERIVAN de la compuerta (misma interfaz, mismos textos);
Cotizacion.jsx usa una sola evaluación para botones, banner, chips por línea y "¿por qué no puedo emitir?". El
contrato de partida escribe `costoEstado` (la clave del servidor; acepta la grafía vieja) y `validarPartida` lo
marca. `textoRazonEmision` cubre TODOS los códigos del servidor (antes `costo_no_certificado`, `ingenieria_preliminar`,
`precio_especial_no_autoritativo`, `descuento_invalido`… salían crudos al vendedor). Verificado después en producción (lectura): 0 de 2,456 renglones traen `estadoCosto` o `costoEstado`, así que NO
hace falta migración del servidor; a partir de este commit las líneas nuevas llevan la clave que el servidor lee. Tests:
emision 13 (incluye "ningún código del servidor sale crudo ni con cifras"). Suite 1,120 · E2E · build.

**VH-046 · P1 · FIXED · Las imágenes del acomodo (render 3D, foto amueblada, escenas, foto del usuario) vivían
en base64 dentro de la cotización.** Producción (lectura 2026-10-11): 14 cotizaciones con `acomodo.render3d`
en base64, 24 MB en total, la mayor 2.9 MB; 2 con escenas en base64; 0 con URL. Cada guardado reenviaba la
imagen entera y el respaldo local la cargaba. Fix: `datos/imagenStorage.js` (`imagenAStorage`, `rutaImagen`,
`resolverImagenesAcomodo`; `renderPartida.js` ahora se apoya en él) + `nube.imagenAcomodoAStorage`. Los cinco
escritores (`Cotizacion.subirRender` foto del usuario, `Cotizacion.renderOficina`, `Acomodo.renderOficina`,
`Acomodo.amueblarFoto`, `Acomodo.generarTodasLasEscenas`) suben a `renders/acomodo/<cotId>/<tipo>-<ts>.<ext>`
y guardan SÓLO la URL; si Storage falla se avisa y no se guarda nada. El PDF (jsPDF necesita dataUrl) resuelve
las URL al dibujar con `pdfPropuesta.cargarImagenesAcomodo` en los dos puntos de salida (Cotizacion.descargarPDF
y Archivo "PDF de esta revisión"); los dataUrl legacy pasan igual, así las 14 cotizaciones viejas siguen
imprimiendo. No se migran datos (mandato §6). Tests: imagenStorage 7. Suite · E2E · build.

**VH-045 · P1 · FIXED · El render de una partida se guardaba en base64 dentro del estado; el diálogo de
edición armaba el renglón a mano; el contrato tiraba claves que sí existen en producción.** Tres hallazgos
sobre el contrato de VH-044, verificados contra producción (lectura, sin escribir): (1) `Cotizacion.jsx`
escribía `render: dataUrl` al generar renders — 8 renglones en producción cargan base64 hoy — y el contrato lo
descartaba al reconstruir, así que el render "se perdía" al reabrir. Ahora `datos/renderPartida.js`
(`renderParaPartida`, puro, con `generar`/`subir` inyectados) sube la imagen al bucket público `renders`
(`partidas/<id>/<ts>.<ext>`, mimes png/jpeg/webp que el bucket acepta) y en la partida sólo vive la URL; si
Storage falla NO se guarda nada y se avisa por mueble; "una" y "todas" comparten el camino (el catch vacío de
`renderTodas` desaparece). (2) `EditarPartida` armaba el renglón a mano: ahora `partidaEditada()` →
`crearPartida` con `veCostos = !soloVentas` y lleva completitud del costeo (`piezasSinMaterial`, `estadoCosto`);
precio null (costeo incompleto) ya no produce un delta `NaN` en pantalla. (3) **Me equivoqué en VH-044**: el
inventario de claves sobre 673 cotizaciones / 2,456 renglones muestra 29 claves que el contrato no conocía
(`loteIA`, `zone_id`, `instance_id`, `functional_group_id`, `cost_status`, `usuarios`, `precioProvisional`…).
La reapertura las conservaba por no pasar por el contrato, pero editar un renglón viejo las habría borrado.
`CLAVES_ENLACE` las conserva tal cual (no se interpretan); al vendedor, las económicas las sigue quitando la
regla del servidor. La reapertura desde el Archivo sigue siendo passthrough A PROPÓSITO: normalizar renglones
legacy al abrir y guardarlos reescritos sería alterar datos legacy (mandato §6). `acomodo.render3d` sigue en
base64 (es del acomodo, no de la partida): pendiente, misma receta. Tests: renderPartida 6, EditarPartida
contrato 4, partida +3. Suite 1,100 · E2E · build.

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
