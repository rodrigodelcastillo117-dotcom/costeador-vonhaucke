# Costeador Von Haucke — Hoja de revisión de INSUMOS (proxies)
**Fecha:** 2026-08-12 · Las 24 líneas están reconstruidas en estructura. Aquí se listan los **materiales que hoy usan un "proxy"** (el insumo más cercano, porque no hay uno dedicado o porque es una pieza fabricada estimada). Revisar esto **junto con** la lista de MP: un componente que apunta al material equivocado no se arregla solo con cargar precios.

Cómo leer: por cada grupo — **qué representa hoy**, **dónde se usa**, y la **decisión** que hay que tomar (confirmar precio / crear insumo / dar desarrollo real).

---

## 🥇 1. ESTRUCTURA METÁLICA FABRICADA (el más importante — mayor impacto en costo)
Todas las patas, bases, bastidores, gajos, ductos y tensores se modelan como **materia prima cruda (`ptr` metros + `lamina-20` kg) + `pintura-electrostatica`**, o como **`pata-metalica`** (pieza comprada genérica $380), con **CANTIDADES ESTIMADAS**.

**Dónde:** Río (patas 66° RIPIIBS/RIPIDBS/RIPIBD, RIPAMJ4), Vía (pata marco CIPMCBD720), Ergo4 (pata E4PLTI, gajos E4CACI), Spine (pata base SPPATBM), Alba (pata Alba ABPATT160M, faldón-bastidor), Feather (estructura tubular, tensor FECON38M redondo EcoCrome), Cirque (pata universal), Anteo (base de acero), Luna, TeamSpace II, Tetris, Mox, Modulor (cuerpos), Privacy 4.

**Decisión (elige una vía por pieza):**
- **(A) Pieza comprada/valuada por clave:** si VH cotiza estas piezas ya armadas (por clave: RIPIIBS, ABPATT160M, FXEST42M…), lo más exacto es crear un insumo "pieza metálica" por clave con su costo real. → Producción/Compras da el costo por clave.
- **(B) Fabricada in-house:** si se fabrican, hay que confirmar con **Producción** el **desarrollo real** (metros de PTR, kg de lámina, tiempos de corte/doblez/soldadura/pintura) por clave. Hoy son estimados.
- ⚠️ Este grupo es el que más mueve el costo en benching, ejecutivas y Vía. **Prioridad #1.**

---

## 🔌 2. ELÉCTRICOS BYRNE (importados, sensibles a USD)
Módulos Byrne específicos usan genéricos: `byrne-phase2` / `byrne-node` / `byrne-interlink` / `caja-electrica` / `acometida`.

**Dónde:** Flex (Interlink iQ + Phase 2 en banca doble), Spine (Phase 2 BE52413), Ergo4 (Phase 2 BE52413/BE52426/BE52490), Río (arnés), Vía (BE52413), Feather (Start3 BESMSTRT), TeamSpace II (START), Cirque, Drift, Work Lounge, Luna (Node BE0335911), Anteo (retráctil BE0181940).

**Decisión:** confirmar el **costo real por módulo Byrne** (lista de precios del proveedor / importación). Si varios modelos tienen precio distinto, crear un insumo por modelo (BE52413, BESMSTRT3, BE05930…).

---

## 🪟 3. CRISTAL LAMINADO → hoy `cristal-templado-12`
**Dónde:** Eclipse (refuerzo de cristal 19 mm), Alba (Olga cristal laminado CRLB), Río, Cirque (mesas de juntas cristal laminado CRL).
**Decisión:** confirmar si `cristal-templado-12` ($2,200/m²) sirve, o crear **`cristal-laminado`** con su precio real. También el **cristal 19 mm** de Eclipse no tiene id exacto (usa el de 12 mm).

---

## 🔩 4. INOX TUBULAR → hoy `inoxidable` (lámina por kg)
**Dónde:** Luna (toda la estructura: patas tubulares 1"×2" cal.16 + marco de ángulo + brazos), Modulor (zoclo inox).
**Decisión:** el inox tubular no es lo mismo que la hoja de inox. Crear **`inox-tubular`** (por metro o kg de tubular/ángulo con su precio real). Afecta fuerte a Luna (es su material principal).

---

## 🧱 5. EXTRUSIONES DE ALUMINIO — Privacy 4 (línea muy dependiente de esto)
Postes (P4EPIN/P4EPRE), guías (P4GUIN/P4RSUP), riel estructural, perfil U (P4PEUALU), largueros (P4LARMS), mocheta, poste universal → todos usan **`perfil-aluminio`** (13 usos). Rieles P4JUR → `riel`. Remates fundidos (P4REIN/P4REMESUP) y placas de conexión → `escuadra`.
**Decisión:** Privacy 4 se costea casi por completo con proxies. Confirmar el **precio de la extrusión de aluminio P4** (por metro/perfil) y el **precio por pieza** de los remates/nodos fundidos. Es la línea que más revisión necesita.

---

## 🔧 6. PIEZAS DISCRETAS FUNDIDAS / CONECTORES → hoy `escuadra` / `tapa-abatible`
`escuadra` para: placas de unión QCIPLAUES (Río/Alba/Vía), MOTO22FTF (Modulor Torre), remates Privacy 4, soportes de biombo Accents (ACHERFI/D10M), conectores VICOB0877/CONECY (Vía), bases mesa de apoyo Anteo. `tapa-abatible` para: juegos de tapas Feather (FEJGTAP*).
**Decisión:** confirmar **precio por pieza** de cada conector/tapa/placa (son piezas discretas, no metros).

---

## 🔌 7. CHAROLAS / RIELES / DUCTOS PASACABLES → `charola` / `riel` / `ducto` / `pasacables`
**Dónde:** Río (RICHCA, RIRI, RICHA40, RICHPC5), Alba (riel/charola/espiral Mockett), Anteo (ducto CIDUANBD2-B, maneja-cables MACAWM34-90), Cirque (conducto), Feather (ducto), Accents (espiral).
**Decisión:** mayormente son piezas reales de manejo de cable — confirmar precio. El **espiral Mockett MACAWM34-90** (Anteo/Alba/Accents) usa `pasacables` genérico; confirmar.

---

## 🪑 8. TAPICERÍA / ECOPIEL — rendimientos a confirmar
- **Vinipiel** (Accents tapetes) usa `ecopiel`. **EcoPiel automotriz** (Eclipse, Drift, Anteo, Luna) usa `ecopiel` con conversión área→metro con factor **/0.55** (y /1.40 en Eclipse).
- **Espuma** con área estimada; el precio depende de **densidad** (kg/m³) — hoy sin definir.
**Decisión:** confirmar **ancho de rollo y rendimiento** de EcoPiel/vinipiel, y la **densidad de espuma** por producto (asiento vs respaldo).

---

## 🎨 9. SUPERFICIES ESPECIALES → `laminado`
- **Decorlux** (Anteo, laminado tipo acero satinado) → `laminado`.
- **Pizarrón / market grade** (Accents, Ergo4 gajo, Privacy 4 gajo pizarrón) → `laminado` / `frente-metal` / `frente-tela`.
**Decisión:** confirmar si `laminado` ($850/hoja) representa bien Decorlux y las caras de pizarrón, o crear insumos dedicados.

---

## 📺 10. PIEZAS COMPRADAS NO COSTEADAS (van en "eléctricos/aparte")
- **Pantalla 55"** (Río TeamSpace, Accents/TeamSpace II portapantallas) — no se costea (es compra del cliente o aparte). **Decisión:** ¿se incluye en la cotización? Si sí, agregar insumo con precio.
- **Base motorizada** (Drift/Anteo mesa ajustable) ya usa `base-motorizada` ($6,500) — confirmar precio real.
- **Guardas Modulor** que Alba referencia (MOLIPR75→`torre`, MOAC75→`archivo-lateral`) usan precio de guarda comprada — confirmar o cruzar con el costo del generador Modulor.

---

## 📋 Además (no es insumo, pero afecta el costo — para calibrar con MP)
1. **Cantidades de metal estimadas** (kg lámina, metros PTR) en todo lo fabricado → Producción.
2. **Factores de mano de obra por línea** (hoy 34–42% supuestos) → medir UE o confirmar.
3. **Los 8 precios más inciertos** (del doc CALIBRACION_MAESTRO): melamina ABS 28, HPL, membrana PVC, inox, PTR cal 12/10 + aluminio (por kg), piel napa, base motorizada + cerradura electrónica, espuma por densidad.

---

## ✅ Secuencia recomendada
1. **Compras/Producción** confirma los grupos 1–5 (los de mayor impacto): estructura metálica fabricada, Byrne, cristal laminado, inox tubular, aluminio Privacy 4.
2. Cargas la **lista de MP real** en la pantalla "Precios de materiales".
3. Donde un proxy quede corto, **creamos el insumo dedicado** y repunto el componente (te digo cuáles al ver los precios).
4. **Calibramos contra 1–2 órdenes cerradas** por segmento (benching / ejecutiva / tapicería / guardas) y ajustamos aprovechamiento + factores MO.
