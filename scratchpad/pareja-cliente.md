# Auditoría EL CLIENTE — costeador Von Haucke
Fecha: 2026-08-17 · Auditor: el que recibe la propuesta y decide si suelta el dinero.
Puerto usado: **5177** (hay dev servers en 5173–5177, todos sirven lo mismo).
Método: `http://localhost:5177/humo.html?solo=<pedazo del título>` — una pantalla a la vez.

> ESTE ARCHIVO SE ESCRIBE SOBRE LA MARCHA. Si se corta, lo de arriba ya es válido.

---

## 0. La cotización de prueba (para poder cuadrar números)
Fixture en `src/humo.jsx` — cliente "Corporativo de prueba, S.A. de C.V.", folio 2608-001, fecha 2026-08-16.

| # | Partida | Cant | Costo u. | Precio u. | Precio línea |
|---|---------|-----:|---------:|----------:|-------------:|
| p1 | Banca doble APP LT 1.50 · 10 usuarios | 2 | 19,185 | 41,439 | 82,878 |
| p2 | Eclipse Escritorio Directivo 2.10 · mano D | 2 | 12,566 | 25,132 | 50,264 |
| p3 | Eclipse Credenza baja 2.10×0.60 · mano D | 2 | 9,682 | 19,364 | 38,728 |
| p4 | Alba · Mesa de juntas 3.60 · Melamina ABS | 1 | 10,216 | 20,432 | 20,432 |
| p5 | Modulor · Archivero horizontal 0.75 2 cajones | 6 | 1,481 | 2,962 | 17,772 |
| p6 | Sillón Pac 1 plaza (0.60×0.60) · tela | 4 | 2,253 | 4,507 | 18,028 |

**Suma precios = 228,102** · **Suma costos = 110,980** · Utilidad = 117,122 → **margen real 51.35%**

⚠️ Anotado desde ya: **p1 dice `margen: 50` pero el precio es 2.16× el costo (53.7% de margen real)**.
Las otras 5 partidas sí son exactamente 2× (50%). O p1 trae algo encima (flete/electrificación) que
NO se ve en ninguna columna, o el campo `margen` de la partida MIENTE. Si el vendedor abre
"mis números" y ve 50% en el renglón, está viendo un dato que no corresponde al precio.

---

(hallazgos por pantalla abajo, se va agregando)

## 1. PROPUESTA — las dos vistas (`?solo=propuesta`)
Montan las 2. Aritmética del documento del cliente: **cuadra al peso**.
`228,102 + 6,843 (3%) + 22,810 (10%) = 257,755` → IVA 16% `41,241` → **TOTAL 298,996** ✓
Anticipo 50% `149,498` × 2 = 298,996 ✓ · "6 líneas · 17 piezas" (2+2+2+1+6+4=17) ✓

### 1.1 🔴 "Precio de lista" y "Subtotal" son EL MISMO NÚMERO, uno debajo del otro
```
Precio de lista   $228,102
Subtotal          $228,102
```
Como cliente lo primero que veo en el bloque de dinero son dos renglones idénticos.
Se lee como que **se cayó el renglón de descuento** o como plantilla mal armada. Si no hay
descuento, uno de los dos sobra. Es el punto exacto de la hoja donde el cliente baja la vista
buscando el número — y ahí es donde se ve descuidado.

### 1.2 🔴 JERGA DE TALLER en el documento que ve el cliente
Los nombres van tal cual del motor al PDF. En la vista cliente aparecen:
- `Eclipse Escritorio Directivo 2.10 m · **mano Derecha**` → "mano" nadie fuera del taller lo entiende.
- `Modulor · Archivero horizontal 0.75 2 cajones · Melamina y **canto ABS**` → "canto ABS".
- `Alba · Mesa de juntas 3.60 m · **Melamina ABS**`
- `Banca doble **APP LT** 1.50 · 10 usuarios · **ocupa 7.50 × 1.20 m**` → "APP LT" es clave interna.
- `Sillón Pac 1 plaza (0.60×0.60 m) · **tela**` → "tela" a secas: ni color ni tipo. En un
  documento de $299 mil, "tela" es lo único que me dicen del sillón que voy a tocar todos los días.

Ninguno trae **acabado/color** que un cliente pueda visualizar, ni marca de la silla, ni garantía
por partida. Todo es medida + material técnico.

### 1.3 🟠 El FLETE de 10% pelea con las Condiciones del mismo documento
El documento cobra un renglón visible **"Flete 10% $22,810"** y tres párrafos abajo dice:
*"…el flete al área metropolitana también [está incluido]"*.
Como cliente: o está incluido o me lo estás cobrando aparte. Además 10% de flete sobre
mobiliario es un número que **cualquier comprador ataca primero** — y el propio texto de ayuda de
la app dice que 3% es lo estándar (eso es para maniobras). Un flete de $22,810 sin desglose
(¿cuántos viajes? ¿a dónde?) es la línea que me hace pedir descuento.

### 1.4 🟠 "Máx. rentable: 27%" deja el negocio POR DEBAJO del piso que puso Rodrigo
Con 27% de descuento: `228,102 × 0.73 = 166,514` − costo `110,980` = utilidad `55,534` → **margen 33.4%**.
El piso de Rodrigo es 40% y el de Miguel 45%. La app le está diciendo al vendedor que puede
bajar hasta un punto que **rompe la regla de negocio de la casa**. (Verificar la fórmula en código.)

### 1.5 🟠 El margen del renglón p1 no corresponde a su precio
`p1` trae `margen: 50` pero `41,439 / 19,185 = 2.16×` → margen real **53.7%**. Las otras 5
partidas son exactamente 2× (50%). O p1 carga algo que NO se ve en ninguna columna, o el campo
`margen` del renglón miente. En "Mis números" se muestra Costo y Utilidad pero **no el %**, así
que el vendedor no puede cachar la diferencia.

### 1.6 🔴🔴 **TRES NÚMEROS DE LA MISMA FILA NO CUADRAN** (tabla "Mis números", escritorio)
Leyendo la tabla real del DOM (`.cot-interna table.datos`) — ojo, sólo se ve en escritorio,
en celular esa tabla se esconde y se pierde la columna Margen:

| Concepto | Precio | Costo | Utilidad | **Margen** | Importe |
|---|---:|---:|---:|---:|---:|
| Banca doble APP LT · 10 usuarios | $41,439 | $19,185 | $44,508 | **50%** | $82,878 |

`44,508 / 82,878 = 53.7%`. **La celda "Margen" dice 50% y las celdas de junto dicen 53.7%.**
La columna Margen imprime `pt.margen` (un dato guardado) en vez de calcularlo del precio y el
costo que se ven al lado. Es EL renglón más caro de la propuesta y el más grande de la hoja.

Peor: la marca roja "Debajo del mínimo" usa `pt.margen < margenMinimo` — o sea el mismo dato
guardado, y **no se recalcula al aplicar descuento**. Si el vendedor pone 27% de descuento, la
columna Margen sigue diciendo 50% en las seis filas. La única alarma que sí reacciona es la
banda roja aparte. Si Dirección revisa la tabla, ve 50% donde ya hay 18%.

### 1.7 🔴 "Precio de lista" es la palabra que INVITA a pedir 40% de descuento
El documento del cliente encabeza el bloque de dinero con **"Precio de lista $228,102"**.
Pero la propia app, dos cuadros arriba, le dice al vendedor: *"Los precios de arriba ya son de
venta (**el 40% ya está aplicado**)"*. En el idioma de los presupuestos de la casa "precio de
lista" es el BRUTO, el de antes del −40%. Cualquier comprador con oficio (o un ex-empleado)
lee "precio de lista" y su siguiente frase es "ok, ¿y mi descuento de lista?".
Ese renglón debería decir "Suma de los renglones" o "Importe" — de hecho **así se llama en el
PDF** (`pdfPropuesta.js` lo imprime como "Suma de los renglones").

### 1.8 🟠 La PANTALLA y el PDF no arman la misma escalera
- Pantalla: `Precio de lista` → `Subtotal` (siempre, aunque sean idénticos) → …
- PDF: `Suma de los renglones` → (Descuento y Subtotal **sólo si hay descuento**) → …

Distinto rótulo y distinto número de renglones. El vendedor enseña la pantalla en la junta y
manda el PDF por correo; el cliente compara y ve dos documentos que no se parecen.

### 1.9 🔴 Por su propia confesión, el 64% del precio "suele quedar POR DEBAJO"
Los sellos por partida (`selloPartida` en `src/util.js`):
- **Calibrado**: sólo App LT → p1 = $82,878 = **36% del precio**.
- **Estimado**: las otras 5 = $145,224 = **64% del precio**. El tooltip dice literal:
  *"Esta línea todavía no tiene precios reales cargados y **suele quedar POR DEBAJO**."*
- **Firme**: ninguna. La banda de arriba lo confirma: *"0% del precio sale de proyectos ya cerrados"*.

Como cliente no veo esto (bien). Como Rodrigo enseñando el martes: si alguien pregunta
"¿de dónde sale el precio?", la respuesta honesta que da la propia app es "de un modelo, y
probablemente bajo, en dos terceras partes de la hoja". Hay que tener el guion listo.

### 1.10 🟠 La "Utilidad" que calcula el motor mete FLETE y MANIOBRAS como ganancia
`utilidadTotal = baseGravable − costoTotal` (línea 208) y `baseGravable` incluye maniobras
($6,843) y flete ($22,810). O sea la app contaría **$146,775** de utilidad cuando la utilidad
del mueble es **$117,122** — $29,653 de camión e instaladores contados como ganancia pura.
✅ Hoy no explota porque **`utilidadTotal` y `costoTotal` se calculan y NUNCA se pintan**
(código muerto). Efecto secundario: **no existe en ningún lado un total de utilidad ni de
margen del proyecto**. Dirección sólo ve renglón por renglón. Si el martes alguien pregunta
"¿cuánto ganamos en esta propuesta?", no hay dónde verlo.

### 1.11 🟠 Flete al 10% por default contra el 3% del levantamiento
`fletePorcentaje: 10` en `src/motor/calculo.js:91`. En el levantamiento, Miguel y Rogelio
dijeron **3% CDMX**. Maniobras sí está en 3. El flete al 10% son $22,810 en esta propuesta y
es el renglón más fácil de atacar. Confirmarlo con él antes del martes: o es intencional o es
un cero de más que se va impreso al cliente.

### 1.12 🟡 Falta de mayúscula en las Condiciones (texto que ve el cliente)
`Cotizacion.jsx:591`: si maniobras = 0 y flete > 0 la frase queda
> "Instalación y maniobras por separado. **el** flete al área metropolitana también."

Punto y minúscula, en el párrafo de Condiciones de un documento de $299 mil.

### 1.13 🟡 Cosas de la hoja del cliente que se ven a plantilla
- El documento **no trae una sola imagen** si nadie apretó "generar renders". Seis renglones de
  texto y una escalera de números. Cero factor wow para lo que se paga.
- "MÁS DE 68 AÑOS DE OFICIO" arriba y "Más de 68 años fabricando mobiliario…" abajo: el mismo
  argumento dos veces en una hoja.
- "6 líneas · 17 piezas": "línea" en esta casa significa línea de producto (App LT, Eclipse…).
  Aquí quiere decir renglones, y son **5** líneas de producto, no 6. Ambiguo justo en la portada.
- Ni **tiempo de entrega** en días ni **garantía** en años, sólo "según programa". Es lo segundo
  que pregunta cualquier comprador después del precio.

---

## 2. FICHA (`?solo=ficha`) — el segundo documento que ve el cliente
Monta 1 de 1. Es una hoja completa titulada **"COTIZACIÓN"**, con folio, vigencia y condiciones
propias. O sea: la casa manda al cliente DOS documentos distintos desde la misma app.

### 2.1 🔴🔴 LA FICHA Y LA PROPUESTA SE CONTRADICEN EN LAS CONDICIONES
Puestas una junto a otra, mismo cliente, mismo folio 2608-001:

| | Propuesta | Ficha |
|---|---|---|
| Flete | **"Flete 10% $22,810"** cobrado en la escalera | **"Flete en CDMX y área metropolitana 3%"** |
| Maniobras | *"ya están **incluidas** arriba"* | *"Maniobras e instalación **por separado**"* |
| Saldo | *"50% **contra entrega**"* | *"50% contra **aviso de entrega**"* |

Las tres son diferencias que valen dinero. "Contra aviso de entrega" quiere decir que pago
ANTES de recibir; "contra entrega" es al recibir. Si el cliente recibe las dos hojas
—y las va a recibir, porque las dos salen de la misma app— **elige la que más le conviene y
tiene razón**. Además el flete: una hoja dice 3%, la otra le cobra 10%.

Causa: en `FichaPDF.jsx:172-175` esas condiciones están **escritas a mano** (3%, "por separado")
y no leen `estado.parametros`. Cambiar el flete en la Propuesta nunca mueve la Ficha.

### 2.2 🔴 La Ficha imprime **$0 / $0 / $0** sin una sola advertencia
`precioUnitario = 0` es el default del componente. Con el costeo cargado pero sin resultado, la
hoja sale así, lista para "Guardar / enviar PDF":
```
Mueble de prueba   1   $0   $0
Subtotal $0 · IVA 16% $0 · Total $0
```
No hay ningún candado que impida enviar una cotización en cero. Ese es el clásico
"lo mandé sin querer" y es imposible de recuperar frente al cliente.

### 2.3 🟠 Jerga y cuadros vacíos en la ficha
- `CUBIERTAS: Cubierta` — el bloque de especificación repite el nombre del componente interno.
  Al cliente le estoy diciendo que su mueble incluye "Cubierta". No dice de qué, ni color, ni calibre.
- No aparece **ESTRUCTURA** ni **ACABADO** (quedan vacíos si no hay insumos de esas secciones):
  la hoja se queda con un solo dato de especificación en un documento que se llama "ficha técnica".
- El nombre del mueble es "Mueble de prueba" y se imprime tal cual en el concepto. Sin validación,
  el nombre interno que teclee el costeador va al papel del cliente.

---

## 3. INFORME (`?solo=informe`)

### 3.1 🔴 La prueba de humo dice "1 de 1 monta bien" y **la pantalla sale EN BLANCO**
`humo.jsx:270` pasa `<InformeIA texto={...} />` pero el componente recibe **`informe`**
(`InformeIA.jsx:28`). Con `informe` undefined, `partirSecciones` da 0 y el componente hace
`return null`. Resultado: el recuadro verde canta victoria sobre una pantalla vacía.
Es EXACTAMENTE el mismo punto ciego que el propio archivo documenta arriba (el de `vista="menu"`).
La app de verdad sí pasa `informe` (`AsistenteEspecial.jsx:227`), así que no está roto en vivo —
**pero el informe no se está probando en absoluto.** Si mañana se rompe, nadie se entera.

### 3.2 🟡 El informe es 100% lenguaje de taller — y está bien, siempre que NO se enseñe
Contenido real (`preview.jsx:218`): "merma ~9%", "cal.14", "portico metalico en C", "BIFMA",
"knock-down", "densidad x2.3 en contenedor 53ft". Es un documento de ingeniería, no de venta.
Dos cosas: (a) hay que tener claro que **esta pantalla no se le abre al cliente** el martes;
(b) el texto viene **sin acentos** ("Tecnico", "Produccion", "Logistica", "Analisis") — si eso
sale de la IA tal cual, cualquiera que lo vea de reojo piensa "esto lo escribió una máquina".

---

## 4. CATÁLOGO (`?solo=catálogo`)
Monta. 5 familias, **21 muebles** en total (3+5+5+5+3).

### 4.1 🔴 Es un catálogo de muebles **sin una sola foto** — 0 imágenes en toda la pantalla
Conté `document.querySelectorAll('.plegable img').length` = **0**. Un fabricante de 68 años
enseñando su catálogo como una lista de texto con triangulitos ▼. Si el martes Rodrigo abre
esta pantalla delante de alguien, es lo menos "wow" de toda la app. Y ya existen imágenes en
el proyecto (`src/datos/imagenes.js`, 18 fotos de sillería subidas) — aquí no se usan.

### 4.2 🔴 "sin receta" — jerga de taller como etiqueta de producto
Al abrir **Sillón → líneas** las dos opciones salen así:
```
Pac      Sillon compacto 60 x 64                              [sin receta]  Usar
Eclipse  Alta direccion, nogal y piel · Chapa y cerradura...  [sin receta]  Usar
```
Y arriba dice *"Escoge la línea. **La más barata primero.**"* — pero **no hay ni un precio**.
La pantalla promete comparar precios y entrega dos etiquetas grises que dicen "sin receta".
"Receta" es palabra de la cocina interna; para quien la lee es "esto no sirve".

### 4.3 🟠 Acentos: la mitad del catálogo está sin acentuar y se ve
Literales del dato (`src/datos/catalogo.js`), tal cual se pintan en pantalla:
`Sillon` · `Recepcion` · `Arlequin` · `La mas economica` · `Estetica ligera` ·
`Alta direccion, nogal y piel` · `cerradura electronica` · **`· 1 lineas`**
Y en la misma pantalla el texto de ayuda sí dice *"Escoge la **línea**"*. O sea: la app escribe
bien y el dato escribe mal, en el mismo renglón. Ese "1 lineas" (plural con uno, sin acento)
es de las cosas que un cliente lee y archiva como "no cuidan nada".

### 4.4 🟠 `Cirque` viene con la descripción **"(confirmar)"** cargada en el dato
`catalogo.js:48` → `{ id:'cirque', que:'(confirmar)', confirmar:true }`. La Ficha sí la esconde
(`FichaPDF.jsx:57` la filtra), pero en el Catálogo se pinta el `que` **sin filtrar**
(`Catalogo.jsx:63`), y al lado le pone una etiqueta que dice "confirmar". Si alguien abre
Escritorio o Bench el martes, ahí está una línea de producto cuya descripción es "(confirmar)".

### 4.5 🟠 Tres archivos no se ponen de acuerdo en el margen de la casa: 40 vs 50
- `motor/calculo.js:70` → `margenObjetivo: 50`
- `Catalogo.jsx:32`, `Asistente.jsx:31`, `Costeador.jsx:66` → `?? **40**`
- `lineas.js:210`, `HojaCosto.jsx:13`, `AsistenteEspecial.jsx:75` → `?? **50**`

Hoy gana el 50 porque `PARAMETROS_DEFAULT` siempre lo trae. Pero el precio que muestra el
Catálogo en modo Ventas es `costo / (1 − margen/100)`: con 50 da **2.00×** el costo y con 40 da
**1.67×**. Son **20% de diferencia en el precio de la MISMA pieza** según de qué pantalla salga.
Es una mina esperando a que alguien cargue un estado sin `parametros`.

---

## 5. BANCO DE PRECIOS (`?solo=banco`) — la pantalla más peligrosa de todas
218 productos. Es la que sostiene todo el argumento de "estos precios son reales".

### 5.1 🔴🔴🔴 **DOS FILAS IDÉNTICAS CON PRECIOS DISTINTOS, LAS DOS MARCADAS "FIRME"**
Sacado del dato, no de la pantalla (`src/datos/banco.js`):
```
id: p9-app-lt-modulo-operativo-16056   precio: 16,056
id: p9-app-lt-modulo-operativo-22776   precio: 22,776
```
Todo lo demás es **byte por byte igual**: línea `App LT` · nombre `Módulo operativo` ·
`usuarios: 3` · medidas `3600 × 600 mm` · misma descripción · **mismo proyecto `226030018`
(Unión de Crédito · may 2026)** · mismo material.
**42% de diferencia** en el mismo módulo del mismo presupuesto cerrado, y el sello de las dos
dice **FIRME** ("precio real, salió de un proyecto cerrado").

Barrí todo el banco buscando el patrón. Hay **5 colisiones**:

| Producto | Proyecto | Precios | Salto |
|---|---|---|---|
| App LT · Bench doble 1200×1200 | PrestigeMotors | 2,120 vs 4,840 | **2.28×** |
| App LT · Módulo operativo 3600×600 | Unión de Crédito | 16,056 vs 22,776 | **1.42×** |
| App LT · Módulo operativo 3000×1200 | Módulo App LT 4U | 25,980 / 21,020 / 22,590 / 23,000 | 1.24× |
| Gabinete 627×560 | Módulo App LT 4U | 13,040 vs 14,150 | 1.09× |
| **Electrificación de bench dobles** (sin medidas) | NDT Global piso 11 | **12,238 / 24,579 / 27,006 / 51,585** | **4.22×** |

El último es el peor: cuatro renglones que en pantalla se llaman exactamente igual, sin medida
ni nada que los distinga, de **$12,238 a $51,585**. El vendedor escoge a ciegas. Y esto es
justo lo que la app vende como su dato más confiable.

### 5.2 🔴🔴 En pantalla salen los NOMBRES DE CLIENTES REALES y sus condiciones
`BANCO_FUENTES` se pinta tal cual bajo cada precio (`Banco.jsx:106`). Los 11:
> Proy. BMU · **PrestigeMotors** · **Fuerza Especial** · **NDT Global piso 11** ·
> **Proy. Tradeco · con descuento vol.** · **Unión de Crédito** · **Mixue / Snow King** ·
> **Grupo Ginez** · Cancelería Wand · Módulo App LT 4U · Propuesta gral

Si el martes esta pantalla se proyecta y en la sala hay alguien de fuera, ese alguien se lleva:
qué le cobraron a Unión de Crédito, a Tradeco (**y que a Tradeco le dieron descuento por
volumen**), y a NDT Global. Con buscador incluido. Es la pantalla que yo, como cliente, más
querría ver — y la que jamás me deberían enseñar.

### 5.3 🔴 El 31% de las descripciones vienen CORTADAS DESDE EL DATO
**67 de 218** descripciones traen los tres puntos "…" **pegados en el string guardado**, no
puestos por CSS. Ejemplos:
- `"…ps lt para banca doble; en melamina con cant…"`
- `"…lt 2 usuarios, bases metal, cubiertas, biomb…"`

Ensanchar la tarjeta no las arregla: el texto ya no existe. Y estas descripciones son lo que
justifica el precio. Un tercio del banco no puede explicar qué está vendiendo.

### 5.4 🟠 "App LT · Bench doble" a **$2,120** es una cubierta, no un bench
`p9-app-lt-bench-doble-2120`: nombre "Bench doble", medidas 1200×1200, precio $2,120,
descripción *"**Cubierta** cuadrada modelo apps lt para banca doble…"*. Es la CUBIERTA sola,
catalogada con el nombre del mueble completo. Si un vendedor busca "bench doble" y agrega el de
$2,120 (el más barato, el primero que sale al ordenar por precio), la propuesta lleva un bench
doble a dos mil pesos. Nada lo detiene.

### 5.5 🟠 Tres cuentas distintas de "cuántas líneas tenemos"
- Rótulo en pantalla: *"118 en el catálogo de **las 23 líneas**"* (`Banco.jsx:77`, el 23 escrito a mano)
- El desplegable **LÍNEA** ofrece **25**: Accents, Alba, Anteo, App, App LT, Arlequín, Cirque,
  Eclipse, Eclipse Drift, Ergonova 4, Feather, Flex, Luna, Modulor, Mox, Pac, Pebble, Privacy 4,
  Río, Spine, TeamSpace II, Tetris, Vía, Wand, Work Lounge
- El comentario del código dice **114** productos (`Banco.jsx:34` y `:121`), la pantalla dice 118.

### 5.6 🟠 Los mismos productos se escriben distinto en Banco y en Catálogo
`Río` vs `Rio` · `Arlequín` vs `Arlequin` · `Pebble` vs `Pebbles` · `Spine` vs `Spine II`.
Dos pantallas de la misma app deletrean distinto los productos de la casa.

### 5.7 🟠 El aviso del doble descuento existe… y nada lo hace cumplir
La pantalla avisa bien: *"Estos precios ya traen el descuento del proyecto de donde salieron.
Si a tu propuesta le vas a aplicar otro descuento, se descontarían dos veces."*
Pero en la Propuesta el cálculo del tope (`Cotizacion.jsx:219`) hace
`partidas.filter(p => p.costoUnitario > 0 && **!p.deBanco**)` — o sea **las partidas del banco
quedan FUERA del cálculo de "Máx. rentable"**. Una propuesta armada mayormente con banco
enseña un tope calculado sobre las pocas partidas que no son de banco, y el descuento se aplica
sobre todas. Es exactamente el doble descuento contra el que avisa el letrero.

---

## 6. GUÍA (`?solo=guía`)
Monta. "Manual completo · **31 temas** · Ventas", 5 pestañas, contador "0 de 31 leídos".
El texto está muy bien escrito — es de lo mejor de la app. Dos cosas.

### 6.1 🔴🔴 La Guía enseña el piso de descuento como si fuera margen, y NO lo es
`Guia.jsx:179` le enseña al equipo, literal:
> **"Objetivo 50% · piso al descontar 45% · aviso abajo de 40%."**

Leído por cualquier humano: una escalera 50 → 45 → 40, todos en la misma unidad, "nunca bajamos
del 40%". **Falso.** En `motor/calculo.js:71` el 45 es
`minMarkupLinea: % utilidad MINIMA sobre COSTO (markup)` — otra unidad. Un markup de 45% sobre
costo es un **margen de 31.0%** sobre precio (`0.45 / 1.45`).

O sea el piso real está **9 puntos por debajo del "aviso"** que la misma frase pone como el
número más bajo de los tres. Y encima:

**La bomba:** el botón **"Máx. rentable: 27%"** de la Propuesta pone el descuento justo en ese
piso → las seis partidas quedan al **31% de margen**, es decir por debajo del 40% que dispara el
aviso… y **el aviso no se prende**, porque la columna Margen y la marca roja de la tabla usan
`pt.margen` guardado (siempre 50%) y no se recalculan con el descuento (ver 1.6).
Secuencia completa, sin ningún error del usuario:
1. Vendedor pica "Máx. rentable: 27%".
2. La tabla sigue diciendo **50%** en las seis filas, en verde.
3. La utilidad real del proyecto pasa de $117,122 a **$55,534**.
4. La Guía le dijo que el piso era 45% "de margen".
Nadie miente; los tres números están mal alineados y el resultado es que se regala la mitad de
la utilidad con la pantalla en verde.

### 6.2 🟡 Los puntos "?" se leen como iconos rotos
Cada tema abre con una burbuja gris que dice `?` (`Guia.jsx:331`) — es el marcador de "no leído"
y se vuelve palomita al abrirlo. Está bien pensado, pero de entrada la pantalla es **31 signos
de interrogación en columna**. La primera lectura es "no cargaron los iconos", no "te faltan por
leer". Un número (01, 02, 03…) o un punto haría lo mismo sin el susto.
