# Costeador Von Haucke — Documento Maestro de Calibración
**Fecha:** 2026-08-12 · **Estado:** 24 líneas en vivo, todas en **Fase A** (estructura aproximada + MP estimada) salvo **App LT / App** (calibradas ±7%).

Este documento reúne **todo lo que hay que arreglar** para que el costeador sea real, a partir de:
- Una **auditoría con lupa de 17 líneas** contra sus guías oficiales (PDF), buscando errores de fidelidad estructural (productos/variantes/medidas/materiales/claves).
- Una **investigación de precios de mercado en México** para las materias primas.
- El inventario de proxies/estimaciones que se usaron al construir cada generador.

> **Verdad de fondo:** "Fase A" servía para demostrar y agilizar. La lupa muestra que hay **errores estructurales sistemáticos** (claves, dimensiones, materiales, productos faltantes) en casi todas las líneas. Para llegar a "cero errores" cada generador debe **reconstruirse contra su tabla completa de componentes**. Cargar precios reales NO arregla esto — es trabajo de estructura, línea por línea.

---

## PARTE 0 — Prioridad global (qué mueve más la aguja)

1. **Corregir el esquema de CLAVES** (transversal). Casi ninguna clave generada coincide con la real. Es el error #1 en fidelidad y el que hace que una cotización no se pueda cruzar con el catálogo/PDM.
2. **Corregir FONDOS y MEDIDAS hardcodeados** (muchas líneas fijan fondo 600 cuando la guía ofrece 600/750/900, o inventan tamaños que no existen).
3. **Corregir MATERIALES equivocados** (Ergo4/Cirque biombo = cristal, no PET; Feather "chapa" no existe; falta Ecolegno casi en todas).
4. **Agregar PRODUCTOS FALTANTES** (mesas de juntas, barras, torres, recepciones, sub-líneas).
5. **Crear INSUMOS reales** que hoy son proxies (base motorizada, Byrne, policarbonato, mármoles por variedad).
6. **Cargar PRECIOS reales de MP** (o los de mercado de la Parte 2) y **calibrar contra una orden cerrada**.

---

## PARTE 1 — Errores por línea (auditoría con lupa)

### VÍA
- **"Estación H/cruz 4/6 puestos" NO EXISTE** en la guía — es producto inventado. Vía solo tiene Escritorio Sencillo y Banca Doble. → eliminar.
- Biombo frontal: son DOS distintos — `VIBIOFROBS` (banca sencilla, alto **45 cm**) vs `VIBIOFROBD` (banca doble, alto **24 cm**), anchos 0.88/1.18/1.48. Hoy siempre `VIBIOFROBS` alto 450.
- Divisor real 0.40/0.60/**0.90** (`VIBIODIV2`); hoy mezclado con frontal en un combo → permite combinaciones imposibles; falta el 0.90.
- Librero: falta distinguir **sin acometida** (.30/.60/1.20) vs **con acometida** (1.20/1.50) y doble (`VILIBDL`). Claves reales `VILIBS[C/I/D][n][ABS/TF/CH]`, `VILIBDL[SP/1P/2P]...`.
- Puerta archivero alto **0.59 / 0.75 m** (hoy 540mm, no corresponde).
- Faltan accesorios con clave: `VICOBIO`, `VICOB0877M/BS4/BS5`, conector en Y `CONECY`.
- Banca doble incompleta: falta biombo lateral + conector en Y.

### ECLIPSE DRIFT
- **Pata Alba por FONDO de cubierta:** 750→`ABPATT160M`, **900→`ABPAT75M`**. Hoy fuerza ABPATT160M en todas → las de 900 quedan con pata equivocada.
- Bases: `EDBAS26M`=1773 / `EDBAS27M`=2066 / `EDBAS28M`=2366. Hoy etiqueta la de 2066 como `EDBAS26M` (mal, es 27M) y nunca usa la de 1773.
- Faldón clave por ancho×fondo: 1800×900→`63`, 2100×900→**73**, 1800×750→`67`, 2100×750→**7**. Hoy solo produce 63/67.
- Credenza individual fondo **399** (hoy 450). Falta familia **MN** (melamina negra en frentes). Falta PAD de gabinete `EDCABCQ22/28EP`.
- Carpeta del escritorio usa `EDESCQ34EP` (1200×400), no 25/26.

### FLEX
- Móvil solo existe en **90/120** (`FXESCCM23/24`). Hoy permite 1500 (`FXESCCM25`, inexistente).
- Clave biombo Covid lleva infijo **C** en anchos grandes: `FXBIOSPD3MP`(900) pero `FXBIOSPDC4MP`(1196), `FXBIOSPDC5MP`(1500). Hoy omite la C.
- Alturas Covid: 600→600, 900→720, **1196/1200→600, 1500→600**. Hoy da 720 a 1200/1500 (mal).
- Acrílico solo 900/1200/1500 (hoy ofrece 600, inexistente). Faltan biombos frontal/horizontal, divisor 600, privacía H40/H60.
- Banca doble usa arnés **Phase 2** (`BE52413/BE52426/BE52418`), NO Interlink iQ. Hoy confunde los dos sistemas.
- Faldones reales 807/1107/1417 (usa nominal 900/1200/1500). Herrajes cruz `FXJDHBC` / T `FXJDHBTI`.

### MOX
- Fondo varía por variante: 456/460/480/455 (hoy fijo 460). Alto rodante por tapa: 561(metal)/580(melamina)/**600**(cojín) — hoy fijo 580.
- Falta variante `MOXGAR1FMTM` (1 tapa melamina, cuerpo metálico).
- Matriz de alturas lista **Torre** (1.13) y **Closet** (1.60) — no modelados.
- Claves rodante/pedestal SÍ correctas.

### MODULOR
- **Faltan productos completos:** Torre (`MOTO...`, placa `MOTO22FTF`), Archivero Registro Lateral (`MOA1CA/MOA2CA/MOA1CC1ENSP`, 45.7×90.5×120), sub-línea **Modulor Luna** (chapa premium + Walnut Burl, closet `MOLUAR575CHJ` 50×160×75), Maceta `MOMA2INOX`, Gaveta de bajo costo `MOGER2FCTABSJ`.
- **Locker mal entendido:** es **horizontal** `MOLOCKC43PTF` (41×40×**120**, 3 guardas) que se apila con zoclo + tapa — no una columna de cubos 410×400×400.
- **Armario mal:** fondo real **230** (slim, compatible con torre), hoy 500.
- **Gaveta:** real 392×570×591, hoy 380/560.
- Cubiertas/Tapas, Patas `MOAC75L-ES`, Cojines y tornillería nombrada (`P1012G/RO14PA/TO3812HE`) deberían ser SKU cotizables.
- Falta acabado inoxidable y Walnut Burl (WB). Archivero horizontal: faltan variantes puerta corrediza (`MOAPC4/5`) y 2 cajones (`MOAHCL4`).
- Claves: Librero real `MOEI42/MOED42` (izq/der), verticales `MOAE4L/MOAE5L`; hoy genera `MOAL...` inexistente.

### LUNA
- **Fórmula de clave MAL (alto impacto):** índice = largo/30 + 30 → 1500=**35**, 1800=36, 2100=37, 2400=38. Hoy `round(largo/60)` da `LUES25IN` para 1500 (debe `LUES35IN`). Credenza usa +20: 210→27, 240→28 (`LUCRA27/28`, `LUCR27/28`).
- `LUBA120`/`LUBA90` NO son tamaños — son los 2 tipos de **pata-base** (124×74 y 90×90). Hoy usados como selector de largo.
- Mesa de juntas cristal lleva **brazo soporte** (2 pz inox) + **ventosas VETAMI42** (×4); la de mármol **NO lleva brazo**. Hoy pone brazo a ambas y omite ventosas.
- Puente (`LUPU235IN/LUPU24IN`) es pieza separada de credenza alta (`LUCRA`); hoy fusionadas.
- Falta acabado **Walnut Burl** (WB). Cubierta con/sin caja eléctrica: `LUCUC` vs `LUCU`.
- Mesa apoyo lateral 105/120 (hoy fija 1200). Móvil solo 210/240 (hoy 1500/1800). Faldón credenza alto 68cm. Cristal solo en 240.

### ANTEO ✅ (mármol ya agregado)
- **Escritorio real = base acero (`ANBASESC210M/240M`) + acometida CIEGA 600×600×600 (`ANBAGU60DDX`, puerta ciega SIN cajones) + cubierta.** Hoy se modela como cajonera 1200×500×700 → separar en 3 piezas.
- Faltan **Mesa de Centro** (base `ANMECEBA-EST`, 500×500×365), **Mesa de Juntas** (redonda 1200 / cuadrada 1200×1200 / rectangular 2400×1200, base `ANMEJURE-EST`), + ducto `CIDUANBD2-B` + caja retráctil `BE0181940EEFA120`.
- Guardas medidas MAL: cajones/entrepaños 600×600×1200 (`ANGUCA47/ANGUE47`); gab bajo 750×500×750; gab alto 750×500×1600. Hoy 900×500 fijo.
- Mesa regulable SOLO 1500 (`ANMARE150DX`, EcoPiel + 2 cajas eléctricas). Hoy ofrece 1800 inexistente.
- **Mármoles por variedad:** Calacatta(MCL), Arabescato(MAB), Blue Pearl(MBP), Nero Profundo(MNP), Eco mármol(ECM). "Carrara" no es de Anteo. Falta Walnut Burl (CHWB) y **Decorlux** (laminado acero satinado, siempre con EcoPiel). Guardas NO vienen en TF.
- Claves reales `ANBASESC210M`, `ANCESREC210ML`, `ANBAGU60DDX`, `ANGUCA47`, `ANGAB30/63`, `ANMARE150DX`.

### ALBA
- **Escritorio muy sub-modelado:** real = cubierta Alba (fondo ~600, **28mm** en 1800) + 2 cubiertas auxiliares Modulor (`MOCUB45I/D`) + **faldón-bastidor `ABFALBRD/I`** (pieza estructural) + zoclo Modulor + pata + caja Vía `VISOCAELC`. Hoy solo 1 cubierta + 2 patas.
- Recta solo **1500/1800** (`ABCUB25/26`); 2100 recta NO existe. Combos válidos: 1500/1800 Recta, 1800/2100 Trapecio, 1800/2100 Diagonal.
- Mesa juntas fondo **1200** (hoy 1050). Faltan **4500/5400**.
- "Retorno/credenza" no existe: complementos reales son Archivero `MOAC75` / Librero `MOLIPR75` (Modulor).
- **Olga son DOS productos** (Multiusos Ligera + circular Ø900/1050/1200), base pedestal central `ALPAINME4` (rodajas/niveladores), NO 4 patas Alba. Con rodajas nunca cristal.
- Faltan **Bench 120°**, **TeamSpace Alba/QK**, **Mesa alta**. Bench = 5 familias (Individual Sencillo/Doble + Sencillo + Doble) con cubiertas segmentadas `ABCUBI/C/D`.
- Falta acabado **Ecolegno** (HPELABS) en TODAS las cubiertas. Diagonal tiene lateralidad D/I.
- Claves reales prefijo **`AB`** (`ABCUB25/26`, `ABPATT160M`, `ABFALBRD5`, juntas `ABCUB64`), no `AL` inventado.

### LUNA / MODULOR / FEATHER / ERGO4 / SPINE / CIRQUE — (ver abajo)

### FEATHER
- **Escritorio es en L** (frente + retorno lateral): hoy rectángulo. Faltan cubierta lateral `FECUBLAT`, estructura lateral `FEESTLATD/I`, pata lateral.
- Lateralidad izq/der ignorada ("no existe lateral universal").
- `nivel` equipado/básico es cambio **estructural** (tapas, ductos `FECDOBD4/5M`, acometida lateral `FEACOLAM` solo doble, biombo), no solo toggle eléctrico.
- Bench = estructuras discretas (Inicio + Central acometida + Intermedia + Cierre), no un blob PTR.
- **Tensor real = `FECON38M`** redondo Cold Rolled Ø3/8" **EcoCrome**, ángulo 45°, NO PTR rectangular.
- Escritorio solo 1500/1800 (no 1200). Bench solo 1200/1500 (no 1800). Fondo 600/750/900. Espesor 18/18.5/19mm.
- **Acabados MAL:** Feather usa ABS / TF / **Ecolegno (HPELABS)** / **Acrílico**. "Chapa" NO es acabado Feather.
- Ninguna clave coincide. Reales `FECUBESC25ABS`, `FEESTESC25M-A`, `FEBASESC25M`, `FEPATESC3M`, `FECON38M`, `FEFALESC5ABS`, `FEBIOBD21AC`, tapas `FEJGTAP*`.

### ERGONOVA 4
- **Biombo real = SEMIMAMPARA de CRISTAL templado 9mm** (transparente/serigrafía/satinado), NO PET acústico.
- **Falta Recepción** (repisa `E4REP6/5/4`, poste escuadra, tapa aluminio, soporte cristal).
- Mampara tiene **4 alturas** reales: 1225/1000/750/665 (hoy fija 1150). Es estructura metálica + **gajos clipados**, no panel lámina+PET.
- Postes: cruz/T/escuadra, alturas 120/100/75/66.5. Semimampara alto 234mm en riel (no 400). **Biombo OBLIGATORIO** en bancas.
- Cubiertas: faltan fondo 400 y largos 105/90/75/60. Estación 120° usa trapecio rincón `E4CUTR4/35`.
- Gajos 4 acabados: Lámina/TF/Chapa/Tela. Claves por componente `E4MC26/25/24/235/23/27/22` + acabado (hoy inventa `E4BS2ABS`).

### SPINE
- **Fondo cubierta real = 750** (hoy 600).
- **Falta sistema de tapas completo** (el núcleo de Spine): `SPTDHBVDI4M/D`, `SPTAPDHC4M`(ciega), `SPTAPDHSVDB4M`, tapa lateral `SPTAPLRM`, juegos `SPJGT*`.
- Patas diferenciadas: `SPPATUEM`(escuadra)/`SPPATUTM`(T)/`SPPATUCM`(cruz)/`SPPATBM`(base). Ductos `SPDUH4M/5M/165M/6M` + variantes SIN soporte biombo `SPDUHSB*`.
- **"Las cubiertas son ACCESORIO, no requerimiento":** Spine se arma por ductos+patas, no por puestos. Máx 4 ductos/lado, debe cerrar con tapas laterales.
- Falta Ecolegno y lateralidad Izq/Der. Imán `IM175` (×8/ducto). Biombo conmuta el ducto (con/sin soporte).
- Claves reales `SPDUH4M`, `SPBIO4AC/4PT`, `SPCUBD24ABS` (hoy inventa `SPDUCTO12`, `SPEST4ABS`).

### CIRQUE
- **Estación es 120° (Y de 3 puestos), NO cruz de 4.** Cubierta `CICE1235`(1050×600)/`CICE124`(1200×600).
- **Clave escritorio MAL:** patrón real `CICE`+[dígito ancho][dígito fondo]+acabado → 1500×600=**`CICE52`**, 1800×600=`CICE62`, fondo750=`75`, fondo900=`3`. Hoy `round(largo/30)`=50 (nunca coincide).
- **Faltan:** mesas de juntas (cuadradas `CIMJ44/55/66`, circulares `CIMJBE4/5/6CT` Ø1200-2400, en melamina/cristal/**mármol**), barras/mesas altas (`CIMAB4/5/6/7`), credenza (`CICRE62/82`), archiveros suspendidos, Teamspace, escritorios 2100/2400.
- Fondo 600/750/900 (fijo 600). Ancho banca falta 900 y 1650. Retorno lateral ×600 (no 450). Biombo cristal 430mm (no 400).
- Falta acabado **CRS** (Cristal Satinado) y mármol. Semimampara = cristal o tela (no acrílico/PET).
- Recepción curva = ensamble multipieza (`CIRECUCC/CIRECUCX`, gajos curvos, repisa cristal); recta lleva cristal de transacción 1719×539×9. Hoy reducida a faldón lámina.

### TETRIS
- Falta "Tetris **sistema**" reconfigurable (Individual/Individual ruedas/Doble/Triple/Worklounge, claves base `ENTESBAIN/ARO/DO/TR`, base individual 563×560×310).
- **BUG:** claves asiento/respaldo siempre `TESIAT/TESIRT`. Reales: Doble `TESDPAT/TESDPRT`, Triple `TESTPAT/TESTPRT`.
- **Ruedas mal:** doble y triple NO pueden llevar rodajas (restricción). Solo individual.
- Falta Worklounge (paleta giratoria `TEPAGID*`, cubiertas nicho) y mamparas (`TEMPACRC` acrílico 684×210×1060, `ENTEMPACTE` acústica 1200×400×1300 PET+lana).
- `electricos` vacío: falta Mini-Tap `MVLETE19210000` + soporte `TEBAMITA`. Faltan acabados Vh LUX, Piellet.

### ARLEQUÍN
- Falta **Sofá Arlequín Modular** (`ARLAS2T`, `ARLRE12T`, `ARLREDA12T`).
- "**Cilindro**" es fantasma (no altera medida ni clave; no existe). Reales: cubos 400×400 y curvos.
- Curvo sin clave (sigue `ARL40-ET`). Reales `ARLCU40/TTARQCU40P/EP`, curvo rodante `ARLCURO40`.
- **BUG:** clave no cambia con acabado (siempre tela `ARL40-ET`). Ecopiel→`ARL40ECP`; piel/ecopiel rodante-curvo-modular→`TTARQ*`.
- `ARL30` solo existe como `ARL30ETV`. Falta variante laminado `PL` (`ARL40PL/ARL60PL`).

### PAC
- Clave `PACIN` **INVENTADA**. Reales: `PACSOINT`, `TTSOFP22V`, `TTSOFP22EP`.
- **BUG:** clave no cambia con acabado. Pielette→`TTSOFP22V`, ecopiel→`TTSOFP22EP`.
- Alcance recortado: guía tiene 1/2/3+ plazas y "sencillo" vs "doble respaldo". Hoy fija asientos=2.
- Sofá Pac real **1800×600** (3 plazas); hoy calcula 2×600=1200.
- Pielette (tela vinílica) tratada como ecopiel (material distinto).

### ACCENTS
- **Claves de acrílico 100% MAL:** genera `ACORGA/ACLAPA/ACIPAA`; reales `ACCDA/ACLAA/ACPPA/ACORAC/ACPIPAC/ACPIAC/ACPR3/ACORVA`.
- Faltan acrílicos (postit `ACPPA`, retrato `ACPR3`, porta carpeta vertical `ACORVA`).
- **Faltan familias:** Organizadores (Kart `ACGBCR`, Box `ACCO10/15/30`), TeamSpace/portapantallas (`ACTSSP55C/40C/232`), semimampara/biombos (`ACSMAS2G`, `ACBIODIV6M2AC`), Recycle (`ACCR/ACCRCF`, bote `ACBP25X12`), Mesa lateral `ACML` (más alta).
- Mesa centro: **forma no afecta clave/componentes**; circulares reales `-CSC/-MCAC`, sufijos 22/33/44/60/90. Falta satineshine tangerine, cristal templado.
- Carpetas mal: `ACCSC/ACTSC` son tapetes vinipiel; los pads de escritorio son claves **Eclipse Drift** `EDESCQ..EP`. Largo 1050 no existe.
- Base mesa `LROCTA-BACU` (450×700) no modelada.

### WORK LOUNGE
- Clave repisa Spoon mal: `WLLIBE34ABS`(120)/`WLLIBE35ABS`(150) — 34/35 son IDs, no medida.
- Mesa Spoon: guía **separa BASE** (`...-EST`) **de CUBIERTA** (`...-CU/-CRS`); hoy fusionadas. Solo existen 900×600, 900×900, 600×400 (1200/1500 inventados).
- Bricks: falta fondo 60 (`WLBRITT60ECP`); empalmes izq/der son 50×40×42 (no 500×420×580).
- Tank: `6060` inventado (solo 4542/4560/6042).
- Claves Tank/Ding/Bricks-42 SÍ correctas.

### RÍO
- Claves cubierta truncadas: reales por forma+posición (`RIBSCUINCV/INCX/DCV/DCX...` cóncava/convexa × posición; recto `RICUBRECIN/D/I`).
- Arnés: usa `CIJSABY` (Cirque); real **`RIJSABY`**.
- Mesa juntas: real inicio `RIMJCUBI##` + central `RIMJCUBC##` (44=120..48=240).
- **TeamSpace mal:** real = mesa + pantalla 55" + soporte `CPPMT55` + pata inclinada `RIPAMJ4` (66°, 121.6cm) + base `ABACOM60` + charola `RICHA40`. Hoy sin pantalla/soporte.
- Caja mesa: VH (con charola) vs Ellora E2X (sin). Acometidas bench: sencilla ø300, doble ø600, doble con puerta. Hoy siempre `RIACCI30`.
- Biombo claves nunca emitidas: `RIBIOP`(faldón)/`RIBIO`(curvo)/`RIBIOREC`(recto). Curvo A560×H400 (módulo fijo).
- Usuarios divergen: sencillo 1u/3u, doble 2u/6u. Patas izq `RIPIIBS`/der `RIPIDBS`, doble `RIPIBD`.

### TEAMSPACE II (bastante bien)
- Clave START sin color: reales `BESMSTRT22ZMWHU172LR`(blanco)/`...BKU172LR`(negro).
- **Componente "Base/columna móvil (lámina) cant 10" INVENTADO** → sobre-costea; el móvil ya integra la base. **Corregir.**
- Falta imán `IM175`. Guías izq/der cantidad 3 (son 2).

---

## PARTE 2 — Precios de mercado en México (para reemplazar los estimados)

> ⚠️ Son **promedios de mercado** (ago-2026, MXN), NO los precios reales negociados de tus proveedores. Buen punto de partida; lo definitivo es tu lista de MP. Retail suele traer IVA (÷1.16 para sin IVA); mayoristas de tablero ya van sin IVA.

**Tableros (por hoja 1.22×2.44):** Melamina 16mm ~$650 (480–900) · Melamina/EcoLegno 19mm ~$900 (550–1400, incierto) · Melamina ABS 28mm ~$1,700 (1200–2500, muy incierto) · MDF 15/16mm ~$350 · MDF 19mm ~$500 · Aglomerado 16mm ~$320 · Chapa (enchapado) ~$700 (500–1050) · Laminado HPL/Formica ~$850 (incierto) · Membrana PVC ~$180/m² (incierto) · Tapacanto PVC ~$4/m · Tapacanto ABS 3mm ~$15/m.

**Lámina de acero (por hoja):** cal 22 ~$620 · cal 20 ~$750 · cal 18 ~$950 (dato firme) · cal 14 ~$1,750 · cal 12 ~$2,400 · cal 10 ~$3,100 · acero por kg ~$28 · **inox cal 20 (304) ~$3,200 (volátil)**.

**Perfiles:** PTR 1"×2" cal 16 ~$350/tramo 6m · PTR cal 14 ~$550 · cal 12 ~$1,050 · cal 10 ~$1,350 (mejor calibrar por kg) · Aluminio ~$110/m (incierto) · Ángulo 1½" ~$45/m.

**Superficies (por m²):** Mármol carrara losa 20mm ~$2,000 (1200–2800) · Cristal templado 6mm ~$800 · 9mm ~$1,350 · 12mm ~$2,200 · Cristal satinado 9mm ~$1,600 · Acrílico 6mm ~$600 · 12mm ~$1,200 · Policarbonato sólido ~$1,400 (celular ~$186 — definir cuál).

**Tapicería:** EcoPiel/vinipiel ~$90/m (40–180) · Tela ~$150/m · Piel napa ~$550/m² (incierto) · Espuma ~$350/m² 5cm D30 (definir densidad) · MDF bastidor ~$350/hoja.

**Herrajes (por pza):** Corredera ~$150 · Bisagra cazoleta ~$35 · Jaladera ~$80 · Nivelador ~$18 · Rodaja c/freno ~$90 · Cerradura cajón ~$130 · **Cerradura electrónica StealthLock ~$6,000 (4,600–8,800, dato firme Häfele)** · **Base motorizada sit-stand ~$6,500 (3,500–12,000)** · Riel ~$90.

**Eléctricos:** Caja contactos+USB genérica ~$500 · **Byrne (Interlink/Node/Phase 2) ~$2,800/módulo** (USD 103–184 + importación, sensible a tipo de cambio).

**Acabados (por m² aplicado):** Pintura electrostática ~$100 (confirmar tarifa de maquila) · Barniz ~$70.

**Los 8 más inciertos (confirmar con proveedor):** Melamina ABS 28mm · Laminado HPL · Membrana PVC · Inox cal 20 · PTR cal 12/10 y aluminio (calibrar por kg) · Piel napa · Base motorizada y cerradura electrónica · Espuma (por densidad).

---

## PARTE 3 — Insumos a crear / proxies a reemplazar (insumos.js)

| Proxy actual | Dónde | Reemplazar por | Impacto |
|---|---|---|---|
| `pata-metalica` $380 | Drift mesa ajustable, Anteo mesa regulable | **`base-motorizada`** ~$6,500 | Sub-valúa MUCHO |
| `inoxidable` (hoja/kg) | Luna estructura | **`inox-tubular`** por metro real | Verificar kg estimados |
| `lamina-20`/`acrilico` | Flex biombos Covid | **`policarbonato`** ~$1,400/m² sólido | Material equivocado |
| `caja-electrica` $650 genérica | Flex, Spine, Vía, Luna, Feather, Cirque, Ergo4, Río | **`byrne-interlink` / `byrne-phase2` / `byrne-node` / `byrne-start`** ~$2,800 | Sub-valúa eléctrico |
| `cerradura-electronica` $1850 | Anteo, Modulor | **StealthLock** ~$6,000 | Sub-valúa |
| `marmol` genérico | Anteo, Cirque, Luna | **variedades**: Calacatta/Arabescato/Blue Pearl/Nero/Eco | Precio/variedad |
| `chapa-madera` | (usado como "chapa" en Feather) | Feather NO usa chapa → Ecolegno/Acrílico | Acabado equivocado |
| — | Todas | agregar acabado **Ecolegno (HPELABS)** y **Walnut Burl (WB)** | Falta acabado |

---

## PARTE 4 — Patrones de error transversales (arreglar una vez, aplican a muchas)

1. **CLAVES:** casi ninguna coincide. Cada línea tiene su esquema real (Cirque `CICE[ancho][fondo][acab]`, Luna índice `largo/30+30`, Alba prefijo `AB`, tapicería conmuta sufijo por acabado `-ET/-P/-EP`). Hay que codificar el esquema real por línea.
2. **FONDO hardcodeado 600:** Spine (750), Cirque/Feather/Alba (600/750/900), Anteo (guardas 600). Debe ser seleccionable.
3. **Acabados:** falta **Ecolegno** en casi todas; "chapa" mal usado en Feather; falta Walnut Burl en premium; biombo = **cristal** (no PET) en Ergo4/Cirque.
4. **Electrificación:** todo colapsado en `caja-electrica`/`acometida` genéricas. Byrne tiene sistemas distintos (Interlink iQ vs Phase 2) y no se distinguen; falta conteo de jumpers/extensiones por configuración.
5. **Tapicería (Tetris/Arlequín/Pac):** la clave debe **conmutar por acabado** (tela vs piel/ecopiel/pielette).
6. **Productos inventados que no existen:** Vía "estación", Flex móvil 1500, Arlequín "cilindro", TeamSpace II "base móvil", Cirque estación cruz-4 (es 120°).

---

## PARTE 5 — Factores de mano de obra (hoy estimados)
Carpintería/benching 36–38/12 · Ejecutivas (Drift/Luna/Anteo) 40–42/15 · Bajo costo 34–36/12. **Son supuestos.** La ruta correcta: medir UE (unidades estándar) por producto y pasar a `modoManoObra:'horas'`. Confirmar con Producción.

---

## PARTE 6 — Líneas sin auditar (falta la guía en esta sesión)
**App LT, App, Eclipse, Pebble, Privacy 4** — sus PDFs no estaban disponibles. App LT/App ya están **calibradas ±7%** (las únicas fiables). **Eclipse base** se sabe que sale **~5× bajo** (falta MP madera/nogal/EcoPiel + tiempos). Para auditarlas con lupa hay que subir sus guías.

---

## PARTE 7 — Pendientes de app / operación
- Default de acabado en `CosteadorLinea` es `'ABS'` fijo → en líneas cuyo primer acabado no es ABS cae en el fallback del generador. Convendría respetar el primer `finish` del producto.
- Pantalla "cambiar contraseña" (9 usuarios con pass temporal).
- Blindar edge function `costear-vision` (hoy acepta la publishable key pública) + cargar créditos Anthropic para "subir render → IA".
- **Riesgo vivo:** con Fase A la app cotiza estimado y a veces sub-valuado; avisar a vendedores o poner colchón (margen/aprovechamiento) hasta calibrar.

---

## PARTE 8 — Plan de corrección recomendado (orden)
1. **Reconstruir el esquema de claves por línea** (mayor impacto en fidelidad).
2. **Corregir medidas/fondos y quitar productos inventados** (rápido y elimina cotizaciones imposibles).
3. **Corregir materiales** (cristal vs PET, Ecolegno, chapa Feather).
4. **Crear insumos reales** (base motorizada, Byrne, policarbonato, mármoles) + cargar **precios** (Parte 2 o tu lista real).
5. **Agregar productos faltantes** (mesas de juntas, barras, torres, recepciones, sub-líneas).
6. **Calibrar contra una orden cerrada real** y ajustar aprovechamiento.
7. Subir guías de App LT/App/Eclipse/Pebble/Privacy4 para auditarlas también.

> **Sugerencia de arranque:** empezar por las líneas de mayor volumen de venta (probablemente Cirque, Vía, Río, Ergonova 4) para que la corrección tenga impacto comercial inmediato, y dejar las ejecutivas de bajo volumen (Anteo/Luna/Drift) para después.
