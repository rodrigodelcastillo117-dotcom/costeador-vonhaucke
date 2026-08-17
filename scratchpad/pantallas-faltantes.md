# Auditoría — las pantallas que faltaban (2026-08-17)

Dos ojos: 👤 = CLIENTE (¿le creo? ¿se ve pro?) · 💼 = VENDEDOR (¿cuántos toques? ¿puedo corregir enfrente?)

Estado: EN CURSO — se va escribiendo sobre la marcha.

## Método
- Puerto real: **5177** (verificado con `curl`; 5173–5177 sirven todos, tomé el último).
- `humo.html?solo=<pedazo del título>` — monta UNA pantalla sin login.
- Ojo: en humo muchos manejadores son `nada` (stub). Un botón de NAVEGACIÓN que no hace nada ahí NO es bug.
- ✅ Corrección al brief: aquí `window.innerWidth` = **1440**, la geometría SÍ es medible.

---

## 1. `ficha` — Ficha PDF
Botones: **2** (`Guardar / enviar PDF`, `Cerrar`). Campos de captura: **0**. Nada que escribir.
Monta bien (1 de 1). Imagen del producto carga de verdad (naturalWidth 643, viene de Supabase Storage).

### 🔴 F-1 · 👤 CLIENTE — La ficha y la propuesta le dicen al MISMO cliente DOS fletes distintos
- `FichaPDF.jsx:174` imprime, **quemado en el texto**: "Flete en CDMX y área metropolitana **3%**".
- `Cotizacion.jsx:202` cobra `fletePorcentaje` de parámetros = **10%** (`calculo.js:92`) y lo imprime como renglón: "Flete 10% $22,810".
- Además la ficha dice "**Maniobras e instalación por separado**" mientras la propuesta las **cobra** en un renglón al 3% (`maniobrasPorcentaje: 3`).
- El propio comentario en `calculo.js:86-91` ya avisa que ese 3% de las condiciones estaba mal (era maniobras, no flete) — se corrigió en la propuesta y **la ficha se quedó con el número viejo**.
- Por qué duele: son los dos papeles que el cliente se lleva. Si compara, la app se contradice sola en dinero.

### 🟠 F-2 · 👤 CLIENTE — La especificación se dice a sí misma: "Cubiertas: Cubierta"
- `FichaPDF.jsx:20` — `porSeccion` toma `c.nombre || insumos[c.insumoId]?.nombre`: **prefiere el nombre del componente sobre el del material**.
- Resultado medido en pantalla: `CUBIERTAS → Cubierta`. El cliente quería leer "Melamina 28 mm", lee la etiqueta repetida.
- Se ve en cuanto el costeo trae componentes con nombre (que es lo normal).

### 🟡 F-3 · 👤 CLIENTE — "Vigencia 15 días hábiles" está quemada
- `FichaPDF.jsx:110`, literal. No sale de parámetros ni es editable. Si Rodrigo da 30 días, no hay dónde cambiarlo.

### ⚪ F-4b · nota de arnés (NO es bug de la app)
La ficha sale con **$0 / $0 / $0**. Es el arnés: `humo.jsx:269` la monta con `resultado={null}` —prop que **no existe**— y nunca pasa `precioUnitario`, cuyo default es `0` (`FichaPDF.jsx:50`). Los 3 llamadores reales (`Asistente.jsx:240`, `Costeador.jsx:492`, `CosteadorLinea.jsx:313`) sí mandan precio. **Pero vale como aviso:** el default silencioso `precioUnitario = 0` significa que si un cuarto llamador se olvida del prop, la app le entrega al cliente una cotización de $0 sin una sola señal.

---

## 2. `informe` — Informe IA
Botones: **0**. Campos: **0**. Es sólo presentación.
**Medida: la pantalla renderiza CERO tarjetas (`.informe-card` = 0) y el recuadro de arriba dice "1 de 1 pantallas montan bien".**

### 🔴 I-1 · 💼 VENDEDOR — El informe desaparece completo, sin una sola señal
- `InformeIA.jsx:30`: `if (secciones.length === 0) return null;`
- `partirSecciones` **sólo** reconoce líneas que empiecen con `#`, `##` o `###` (`:11`). Si el modelo devuelve texto sin encabezados —o con `**Negritas:**` en vez de `##`, que es lo que hace un modelo cuando le cambias el prompt— **todo el informe se borra en silencio**.
- Y no queda en blanco a secas: `AsistenteEspecial.jsx:225-230` pinta el rótulo **"Auditoría técnica de industrialización"** ANTES de decidir, porque su condición es `analisis?.informe` (que sí trae texto). Resultado enfrente del cliente: un título grande de auditoría con **la nada** debajo.
- Ojo cliente 👤: un encabezado vacío se lee como "aquí falló algo".
- Ojo vendedor 💼: no hay mensaje, no hay reintento, no hay cómo corregirlo en vivo.

### 🟠 I-2 · la red de seguridad tiene un agujero del mismo tipo que ya los mordió
- `humo.jsx:270` monta `<InformeIA texto={...} />` — pero el prop se llama **`informe`** (`InformeIA.jsx:28`). Prop equivocado ⇒ `undefined` ⇒ `return null`.
- Es EXACTAMENTE el punto ciego que el comentario de `humo.jsx:226-231` dice haber cazado en `Inicio` (`vista="menu"` vs `'home'`). **Volvió a pasar y sigue vivo.** La prueba de humo reporta verde sobre una pantalla que no pinta nada.
- Comprobación: `document.querySelectorAll('.informe-card').length === 0` con el aviso en verde.

---

## 3. `acomodo` — Acomodo 3D
Monta bien. Dos pantallas encadenadas: **"¿Dónde va a ir esto?"** (5 botones, 2 file inputs) y, tras elegir m², el **acomodo** (18 botones, 6 campos, 3 SVG: 888×629, 1254×702, 998×702).
Pinté los dos caminos. El autoguardado SÍ funciona: `window.__guardadoAcomodo = {n:1, silencioso:true, areasM:1, piezas:17}`.

### 🔴 A-1 · 💼 VENDEDOR — Teclear los metros cuadrados da un número que NADIE escribió
Secuencia exacta, medida (el campo "O escríbelos: ___ m² por piso"):
```
borro todo   -> "20"      (¡el campo se rellena solo!)
tecleo "3"   -> "203"
tecleo "5"   -> "2035"
tecleo "0"   -> "5000"    ← tope
BOTÓN: "Empezar con 5,000 m² →"
```
- El vendedor quiso **350 m²** y la app arrancó un proyecto de **5,000 m²** enfrente del cliente.
- Causa: `EmpezarEspacio.jsx:108-110` es un `<input>` controlado con `value={m2}` que pasa por `limpiaM2` **en cada tecla**; y `limpiaM2` (`espacioNuevo.js:22`) hace `Math.max(20, …)`, así que **el campo nunca puede quedar vacío** — vuelve a 20 y las teclas siguientes se le pegan por delante.
- Reproducible con cualquier valor que no esté en los botones (50/100/200/400/600/800/1200/2000). Para 350, 275, 90… **no hay forma de teclearlo bien.**
- Comprobado también: `""`, `0`, `-5`, `12.5`, `abc`, `"comillas"`, `0.0001` → todos caen a **20**; `99999` y `1e9` → **5000**. No truena, pero tampoco avisa: cambia el número sin decir nada.

### 🔴 A-2 · 👤 CLIENTE — "Voni revisó" enseña palomitas que no revisaron nada
En pantalla, en verde, con firma de auditoría:
```
Voni revisó:
✓ Todas las piezas colocadas · 17 de 17
✓ Nada encimado · el motor coloca una por una sin traslape
✓ Circulación perimetral · 0.90 m contra muros (la regla pide 0.90 m)
✓ Circulación entre filas · 0.90 m entre muebles (la regla pide 0.90 m)
```
- `planner.js:249-263`: de los cuatro, **sólo el primero se calcula** (`ok: todas`). Los otros **tres están escritos `ok: true` a mano.** Nunca pueden salir en rojo.
- Los dos de circulación son una **tautología**: el "detalle" y "la regla pide" salen de **la misma variable** `circulacion`. Siempre van a coincidir aunque el acomodo real deje 10 cm.
- Lo mismo en `planner.js:535-538` y `malla.js:441-455` (`'la malla no reutiliza celdas'`).
- Y `planner.js:264` devuelve **`caben: true` quemado**, aunque `todas` sea `false`.
- Lo grave: **el código YA tiene la medición de verdad** — `Acomodo.jsx:777-800` calcula traslapes y salidas de borde con geometría real. La app **mide bien y enseña el cartel falso.**
- El propio comentario en `planner.js:244-247` dice: *"Un cartel verde que miente es peor que no tener cartel"*. Arreglaron uno de los cuatro; **quedaron tres**.
- Ojo cliente 👤: si el cliente mide en el plano y encuentra 60 cm donde la palomita juró 90, se cae la credibilidad de TODA la propuesta, no sólo de ese renglón.

### 🟡 A-3 · 👤 CLIENTE — El renglón se contradice a sí mismo en una sola línea
Medido, literal: **`Mi espacio (200 m²) · 199 m² · 17 muebles`**.
- El nombre dice 200, la superficie dice 199 (17.3 × 11.5 = 198.95). Es `ladosDe()` redondeando a 10 cm (`espacioNuevo.js:25-29`) y nadie reconcilia el rótulo.
- Y arriba: "**22 puestos de trabajo en 199 m²**" mientras el usuario eligió 200.

### 🟡 A-4 · 💼 VENDEDOR — La app dice que necesita 93 m² y preselecciona 200
- El texto: "Lo que llevas cotizado pide como **93 m²** para poder caminarse" (verificado a mano: 32.2 m² de huella ÷ 0.35 = 92.0 → 93 ✅, el número está bien).
- Pero `EmpezarEspacio.jsx:25` arranca en `useState(200)` y el botón dice "Empezar con **200** m²". La app se contradice con su propia recomendación en la misma tarjeta.

### 🟡 A-5 · 👤 CLIENTE — Dos casillas pegadas sin un pixel de separación
Medido: `Recepción` en x=286 ancho=105 (termina en **391**) · `Break room` empieza en x=**391**. **Separación = 0 px.**
En texto plano sale como una sola palabra: **"RecepciónBreak room"**. 💼 riesgo de tocar la que no era.

### ✅ Lo que SÍ aguantó
- Los steppers `−` de Privados y Salas no bajan de 0 (5 clics seguidos → sigue en 0).
- La cuenta de muebles (17) coincide con la suma de cantidades de las 6 partidas.
- Los puestos (22 = 20 de bench + 2 directivos) y los 9 m²/persona salen bien.
- El autoguardado silencioso dispara solo, sin tocar nada.

---

## 4. `catálogo` — Catálogo
Botones al abrir: **0** (todo son `<div class="cabeza">` con `onClick`, no `<button>`). Campos: **1** (buscador).
5 familias, 21 muebles. Al abrir una familia aparecen 3 botones "Ver lineas".

### 🔴 C-1 · 💼 VENDEDOR — El propio ejemplo del buscador no encuentra nada
El placeholder dice, literal (`Catalogo.jsx:80`):
`Busca como se te ocurra: bench, archivero 2 cajones, mesa juntas, recepción…`
Probé los cuatro:
| lo que sugiere la app | resultado |
|---|---|
| `bench` | 1 ✅ |
| **`archivero 2 cajones`** | **CERO — "Nada con esas palabras"** ❌ |
| `mesa juntas` | 1 ✅ |
| `recepción` | 5 ✅ |
- Y `archivero` solo → **5 resultados**. O sea: agregar palabras que el usuario SÍ sabe lo deja sin nada.
- Causa: `Catalogo.jsx:86` busca con `coincide(busca, MUEBLES[m], fam.nombre)` — sólo contra el **nombre genérico** del mueble ("Archivero") y su familia. Los cajones, medidas y variantes no están en el índice.
- El agravante: la cotización de prueba trae "Archivero horizontal 0.75 **2 cajones**". El producto existe; el buscador no lo halla.
- 💼 Es la PRIMERA cosa que uno teclea (es lo que dice la caja). Falla enfrente del cliente en el primer toque.

### 🟠 C-2 · 👤 CLIENTE — Los nombres de los muebles están SIN ACENTOS
`catalogo.js:17-39` (diccionario `MUEBLES`, el que se enseña):
**"Estacion en L" · "Recepcion" · "Sillon"** (y `Catalogo.jsx:119-120`: "9 **lineas**", botón "Ver **lineas**").
- Y **se contradice consigo mismo en la misma pantalla**: la lista de búsqueda (`:97`) sí escribe "**líneas**" con acento, la lista por familia (`:119`) no.
- 👤 A un cliente mexicano "Recepcion" y "Estacion" le gritan borrador.

### 🟡 C-3 — El fallback del margen no coincide con el default del motor
`Catalogo.jsx:30`: `estado.parametros.margenObjetivo ?? 40`. El motor define `margenObjetivo: 50` (`calculo.js:73`). Si por lo que sea llega `undefined`, el catálogo cotiza con 40% y la propuesta con 50%: **el mismo mueble sale a dos precios distintos** según por dónde entres.

### ✅ Lo que SÍ aguantó
Buscador: mayúsculas (`BENCH`), acentos falsos (`béñch`) y basura (`0`, `-1`, `12.5`, `99999`, `"comillas"`, `<script>`, 300 caracteres) → ninguno truena, todos devuelven el mensaje de "nada". Espacios en blanco vuelven a la vista por familias.

---

## 5. `banco` — Banco de precios
Botones: **359** (25 líneas + 10 tipos + 204 "Agregar" + 118 "Configurar →" + "Ver mi cotización"). Campos: **205** (1 buscador + 204 cantidades). **Todo en una sola página, sin paginar.**

### 🔴 B-1 · 👤 CLIENTE / 💼 VENDEDOR — El banco tiene el MISMO producto a precios distintos, y los dos dicen "FIRME"
Barrí las 204 filas agrupando por *nombre + medidas + proyecto/fecha* (lo único que el vendedor ve). **5 grupos salen repetidos con precios que no coinciden:**
| Fila (lo que se ve en pantalla) | Precios "FIRME" |
|---|---|
| App LT · Módulo operativo · **4 usuarios** · 3000 × 1200 mm · Módulo App LT 4U · mar 2026 | **$25,980 · $21,020 · $22,590 · $23,000** (4 precios, −19%) |
| App LT · Módulo operativo · 3 usuarios · 3600 × 600 mm · Unión de Crédito · may 2026 | **$16,056 vs $22,776** (+42%) |
| App LT · **Bench doble** · 1200 × 1200 mm · PrestigeMotors · dic 2025 | **$2,120 vs $4,840** (**2.3×**) |
| Gabinete · 1 usuario · 627 × 560 mm · Módulo App LT 4U · mar 2026 | $13,040 vs $14,150 |
| **Electrificación de bench dobles** · NDT Global piso 11 · jul 2026 | **$12,238 · $24,579 · $27,006 · $51,585** (**4.2×**) |
- Las descripciones se cortan con "…", así que puede haber una diferencia real escondida — **pero el vendedor no la puede ver.** Dos renglones idénticos, uno al doble.
- 💼 No hay forma de saber cuál es el bueno. Si toma el de arriba, la cotización sale a la mitad.
- 👤 Es el argumento estrella de la pantalla ("precio ya cerrado, de proyectos reales"). Un cliente que note dos precios para lo mismo deja de creer el resto.

### 🔴 B-2 · CUATRO cuentas distintas de "cuántas líneas tenemos"
| Dónde | Dice |
|---|---|
| Encabezado del Banco (`Banco.jsx:77`, texto quemado) | "de las **23** líneas" |
| El filtro LÍNEA de esa MISMA pantalla (contado en el DOM) | **25** líneas |
| `LINEAS_REG` (`datos/lineas.js:40`), que genera las pantallas de línea | **24** |
| Comentario y título del Banco (`:34`, `:121`, `:124`) | "los **114** productos" — el número que pinta es **118** |
- Los cuatro números están a la vista al mismo tiempo en la misma pantalla.

### 🟠 B-3 · 💼 VENDEDOR — El campo de cantidad enseña un número y la app agrega otro, en silencio
Tecleado y medido contra el aviso verde de confirmación:
| Lo que se ve en el campo | Lo que la app agrega |
|---|---|
| `-5` | **1 ×** |
| `0` | **1 ×** |
| `12.5` | **12 ×** |
| `99999` | se acepta, sin tope (no salió aviso) |
- `Banco.jsx:45` corrige por dentro (`Math.max(1, parseInt(...))`) pero **nunca corrige el campo**: queda mostrando `-5` mientras la cotización lleva 1.
- 💼 El vendedor se va con la vista puesta en "12.5 escritorios" y en la propuesta hay 12.

### 🟡 B-4 · el buscador de aquí tiene el MISMO problema del catálogo, y su placeholder también miente a medias
Placeholder: `bench 6 lugares, archivero 2 cajones, 1200 x 600, App LT`. Medido:
`bench 6 lugares`→5/6 ✅ · `archivero 2 cajones`→5/1 ✅ · `1200 x 600`→4/0 ✅ · **`1200x600` (sin espacios) → 0/0** ❌.
Nadie escribe "1200 x 600" con espacios cuando trae prisa.

### 🟡 B-5 · 💼 El aviso de "agregado" dura 2.5 s y desaparece
`Banco.jsx:49` — `setTimeout(…, 2500)`. Si el vendedor está viendo al cliente, no queda rastro de que se agregó y vuelve a picarle.

### 🟠 B-6 · un renglón se contradice a sí mismo
`App LT · Módulo operativo · **2 usuarios** · 1500 × 1200 mm · **Módulo App LT 4U** · mar 2026 · $15,700` — el nombre del proyecto dice 4U, el producto dice 2 usuarios. (Y $15,700 es justo la ancla que la memoria del proyecto marca como **NETA mal etiquetada**.)

---

## 6. `precios` — Precios de material (pantalla de DIRECCIÓN)
Botones: **4** (`Usar en los costeos ($0.00)`, `Exportar a archivo`, `Importar archivo`, `Restablecer precios de fabrica`). Campos: **115 numéricos** (12 parámetros + 103 precios de insumo) + 1 file.
Los 103 insumos SÍ traen precio (revisé uno por uno: **0 en cero**). ✅

### 🔴 P-1 · 💼 DIRECCIÓN — El botón azul de la pantalla pone la hora de taller en $0.00, y está habilitado
En pantalla, al mismo tiempo:
```
HORA DE TALLER            $0.00
[ Usar en los costeos ($0.00) ]      ← medido: disabled = false
Costo hora en uso hoy: $40.60.
```
- `Precios.jsx:75`: `onClick={() => setParam('costoHora', Math.round(horaTaller*100)/100)}` — **sin ninguna guarda**.
- Sale $0.00 porque la nómina quedó en 0 a propósito por seguridad (`calculo.js:29-32`), o sea que **este es el estado normal** de la pantalla, no un caso raro.
- Un toque en el botón más llamativo de la pantalla y **toda la mano de obra de todos los costeos vale cero**. Sin confirmación, sin deshacer.

### 🔴 P-2 · 💼 DIRECCIÓN — Ningún campo tiene tope: el margen puede ser negativo, y al 100% todos los precios se vuelven $0
Revisado en el código (`Precios.jsx:86-110`): **todos** son `parseFloat(e.target.value) || 0`. **Ningún `min`, ningún `max`, ninguna validación** (comprobado también en el DOM: los `input` no traen atributos `min`/`max`).
Con la fórmula que usan las pantallas (`precio = costo / (1 − margen/100)`, p. ej. `Catalogo.jsx:32`):
| MARGEN DE LISTA que se puede teclear | Qué pasa |
|---|---|
| `-50` | precio = costo/1.5 → **vende por DEBAJO del costo**, sin aviso |
| `100` | división entre 0 → `Infinity` → `pesos()` lo convierte en **"$0"** (`util.js:4`) |
| `150` | precio **negativo** |
- Lo grave del segundo: **`pesos()` disfraza el desastre de "$0"** en vez de gritar. Es el mismo tapadero que ya vimos en la Ficha (F-4b).
- Igual el precio de un insumo: acepta negativo y `99999999` sin chistar.
- ⚠️ Nota de arnés: aquí no pude ver los valores CAMBIAR porque `humo.jsx:265` monta con `setEstado={nada}` — el campo es controlado y rebota al valor original. Lo anterior sale de leer el manejador, no de verlo en vivo. **Dilo así.**

### 🔴 P-3 · Los dos porcentajes que SÍ se le cobran al cliente NO se pueden editar aquí
La pantalla deja tocar 12 parámetros: gastos de fábrica, margen mínimo, margen de lista, mínimo de línea, anticipo, MO directa, MO indirecta, aprovechamiento, nómina, operativos, jornada, eficiencia.
**No están: `fletePorcentaje` (10%), `maniobrasPorcentaje` (3%), `ivaPorcentaje` (16%), `tipoCambio` (17.5), `gastosOperacionPct` (30%), `utilidadPct` (20%), `factorPrecioLista` (3).**
- O sea: la contradicción **F-1** (ficha dice flete 3%, propuesta cobra 10%) **no se puede arreglar desde ninguna pantalla**. Hay que tocar código.
- Y el tipo de cambio (17.5) —que mueve todos los insumos en dólares— tampoco tiene dónde actualizarse cuando se mueva el peso.

### 🟠 P-4 · 👤 Media pantalla está sin acentos, la otra media sí los trae
Sin acentos: "**Nomina** semanal", "solo **areas** productivas", "**Parametros** de planta", "GASTOS DE **FABRICA**", "MARGEN **MINIMO**", "**Estructura metalica**", "**Lamina** de acero", "**Marmol**", "Chapa de madera (**sabana** natural)", "Laminado **plastico**", "**Faldon** melamina", "para pasarlo a otra computadora… lo que tengas **aqui**", "Restablecer precios de **fabrica**".
Con acentos, en la MISMA pantalla: "**MÍNIMO DE LÍNEA**", "**Cuánto** de cada hoja se aprovecha", "La **nómina** es solo de Dirección".

### 🟠 P-5 · 💼 "Importar archivo" reemplaza TODO y sólo avisa en letra chica
`Precios.jsx:20-30`: `importar(f)` → `setEstado(nuevo)` → `alert('Datos importados.')`. **No hay confirmación previa ni respaldo automático.** El texto avisa ("Importar reemplaza lo que tengas aqui") pero es un párrafo gris arriba, no un "¿seguro?".
Igual `Restablecer precios de fabrica` — no verifiqué si pide confirmación, pero está a un toque del botón de importar.

---

## 7. `tablero` — Tablero
Botones: **0**. Campos: **0**. Es sólo lectura.

### 🔴 T-1 · 💼 VENDEDOR/DIRECCIÓN — Con una cotización llena de $180k, el Tablero dice $0
Lo que pinta con el estado de prueba (que trae **6 partidas / 17 muebles** en la cotización):
```
COSTEADO (GUARDADO)  $0     0 piezas · 0 costeos
MARGEN PROMEDIO      0.0%
DESPERDICIO          $0     0% del costo
"Aun no hay costeos guardados."
```
- `Tablero.jsx:15` — **lee sólo `estado.historial`**. La cotización viva (`estado.cotizacion.partidas`) no entra en ningún KPI.
- Esto NO es artefacto del arnés: en la app real se llega igual (agregas del Banco o de una Línea → va a `partidas`; `historial` sólo se llena si guardas piezas en el Costeador). O sea, **el camino normal del vendedor deja el Tablero en ceros**.
- 💼 Si el martes Rodrigo arma la cotización y luego abre el Tablero para enseñar "la salud del negocio", sale un tablero vacío.

### 🟠 T-2 · Tercer número distinto para el costo hora
| Pantalla | Dice |
|---|---|
| Precios · "HORA DE TALLER" (lo calculado) | **$0.00** |
| Precios · "Costo hora en uso hoy" | **$40.60** |
| Tablero · "COSTO HORA DE TALLER" | **$41** |

### 🟠 T-3 · 👤 Un párrafo entero sin acentos, y el de abajo con acentos
Sin: *"La eficiencia de planta sigue en el valor supuesto de 80%. **Confirmala** con **Produccion**."* · *"**Aun** no hay costeos guardados. Ve al Costeador, calcula una pieza y **agregala** a la **cotizacion** o **guardala**: **aqui apareceran** los **numeros**."*
Con: *"Los **números** de utilidad e ingresos son solo para **Dirección**."* — **el renglón de junto.**

### 🟡 T-4 · 💼 El candado de finanzas le dice a Dirección que eso es "solo para Dirección"
`Tablero.jsx:177` — la condición es `puedeVerDireccion && estado.finanzas`. Si el rol SÍ es Dirección pero las finanzas todavía no cargan, cae al mismo mensaje de bloqueo: *"Los números de utilidad e ingresos son solo para Dirección."* Un permiso y un dato faltante se ven exactamente igual.

---

## 8. `usuarios` — Usuarios
Botones: **4** (3 roles + `Agregar persona`). Campos: **3** (nombre, correo, contraseña temporal).
"Lista de acceso (0)" está vacía por el arnés (no hay sesión de Supabase). Los 9 usuarios reales no se ven aquí.

Probé el alta con 6 combinaciones:
| nombre | correo | contraseña | qué contestó |
|---|---|---|---|
| vacío | vacío | vacío | "Escribe el correo y una contraseña de al menos 6 letras." ✅ |
| Juan | **`no-es-correo`** | 123456 | **pasó la validación** y se fue al servidor ❌ |
| Juan | j@vonhaucke.mx | `12345` | rechazado por corta ✅ |
| 300 caracteres | j@x.com | abcdef | pasó (sin tope de longitud) |
| `"  "` (espacios) | `"  "` | `"  "` | rechazado ✅ |
| `<script>x` | a@b.c | `"comillas"` | pasó, sin romper nada ✅ |

### 🟠 U-1 · 👤 CLIENTE / 💼 — El error que sale es un código interno: **"No se pudo agregar. no-sesion"**
`Usuarios.jsx:44`: `setError('No se pudo agregar. ' + (r.error || ''))` — pega **crudo** lo que devuelva la capa de datos. "no-sesion" es jerga de programador en la cara del usuario. Cualquier fallo del servidor va a salir así.

### 🟠 U-2 · No se valida que el correo sea un correo
`no-es-correo` (sin `@`) pasa el filtro del cliente. La única validación es correo-no-vacío + contraseña ≥ 6. Se crea (o se intenta crear) un usuario con un correo imposible, y ese usuario nunca va a poder entrar.

### 🟠 U-3 · La contraseña temporal se teclea a la vista de todos
`Usuarios.jsx:101`: `<input type="text" …>` para la contraseña. Se entiende la intención ("se la das tú"), pero se está tecleando en claro en una pantalla que se proyecta.

### 🟡 U-4 · Sin tope de longitud en el nombre
300 caracteres pasan sin recorte ni aviso.

---

## 9. `reglas` — Lo que Voni sabe
Botones al abrir: **1** (`+ Enseñarle una regla`). Con el formulario abierto: **2** (`Guardar`, `Cancelar`) + **5 campos** (texto libre, ámbito, NOMBRE DEL NÚMERO, VALOR, UNIDAD).

### 🔴 R-1 · 👤 CLIENTE — Sale el error de Postgres, en inglés, con el nombre de la tabla
Al guardar cualquier regla, literal en pantalla:
> **No se pudo guardar: new row violates row-level security policy for table "reglas"**
Es el mensaje crudo del motor de base de datos, en inglés y filtrando el nombre de la tabla. (En el arnés sale porque no hay sesión; el camino de rendering es el mismo en producción para **cualquier** fallo de permiso.)

### 🔴 R-2 · 💼 — La pantalla promete que "el motor lo aplica solo", y **7 de las 10 reglas no las lee nadie**
`reglas.js:25-36` define 10 números. Conté quién los usa en TODO `src/` (fuera de `reglas.js` y de las pruebas):
| clave | usos reales |
|---|---|
| `circulacion_min` | 5 ✅ |
| `holgura_juntas` | 1 ✅ |
| `holgura_guarda` | 1 ✅ |
| `pasillo_principal` | **0** |
| `barrido_puerta` | **0** |
| `escritorio_ve_a_puerta` | **0** |
| `l_contra_muro` | **0** |
| `sillas_visita_privado` | **0** |
| `descuento_precio2` | **0** |
| `margen_min` | **0** |
- La pantalla dice, abajo del formulario: *"Si le pones nombre y valor, **el motor lo aplica solo**."* Para 7 de los 10 eso **no es cierto**.
- Ojo: el TEXTO de la regla sí llega a Voni (`reglasTexto`, `:45`). El **número** no llega al motor determinista salvo en esos 3 casos.
- 💼 Rodrigo le dicta "las sillas de visita en privado son 2", lo ve guardado, y el acomodo sigue igual. Sin ninguna señal.

### 🔴 R-3 · 💼 — El campo "NOMBRE DEL NÚMERO" no se valida contra nada
Probé y **pasaron todas** (sólo las frenó el permiso del servidor, no la app):
`circulación mínima` (con acento y espacio) · `NOMBRE CON ESPACIOS` · valor **`-500`** · valor `99999`.
- `reglas.js:57` mete cualquier llave: `v[r.clave] = Number(r.valor)`. Escribir `circulación mínima` **crea una regla huérfana** que se guarda bien, se ve en la lista, y no toca nada.
- No hay lista desplegable de llaves válidas, ni corrector, ni aviso. **Es exactamente el tipo de puente roto que "no se nota de ninguna otra forma".**
- Y acepta valores negativos: una circulación de −500 mm.

### 🟠 R-4 · 👤 La pantalla se llama "Lo que Voni sabe" y **no enseña lo que Voni sabe**
Dice: *"Todavía no hay reglas guardadas. El motor está usando sus valores por omisión (**10 números**)."* — y **no lista ni uno**. `todasLasReglas()` (`:50`) devuelve sólo lo que hay en la base; los 10 valores por omisión no se pintan nunca.
- 💼 Es justo la pantalla que uno abre para responder "¿y qué reglas usa?" enfrente del cliente. No tiene respuesta.

### ✅ La única validación del cliente que sí existe
Formulario vacío → "Escribe la regla con tus palabras." ✅

---

## 10. `guía` — Guía ("Cómo funciona todo")
Botones: **13** (X de cerrar + 5 pestañas + 6 temas visibles + Cerrar). Leí los **31** temas de las 5 pestañas.
✅ La cuenta cuadra sola: 6+8+6+5+6 = **31**, y el encabezado y el pie dicen 31. El botón sin texto es la X y **sí** trae `aria-label="Cerrar la guía"`. Bien hecho.

**El problema de esta pantalla no es que falle: es que PROMETE cosas que las otras pantallas no cumplen.** Cinco choques, todos medidos:

### 🔴 G-1 · "Cuando NO cabe, **te lo dice**. Prefiere darte una mala noticia a tiempo que una buena mentira."
Contra **A-2**: tres de las cuatro palomitas de "Voni revisó" están escritas `ok: true` a mano y no pueden salir en rojo nunca. La Guía firma exactamente la promesa que el Acomodo rompe.

### 🔴 G-2 · "**El sello: FIRME o ESTIMADO** — Lo más importante. **Verde lo sostienes**."
Contra **B-1**: en el Banco hay 5 grupos de renglones idénticos, todos marcados **FIRME**, con precios que van de $2,120 a $4,840 y de $12,238 a $51,585. El sello verde no distingue cuál se sostiene.

### 🔴 G-3 · "**Todo se guarda solo — No hay botón de guardar.** Nunca pierdes trabajo."
Contado en las pantallas que audité: **hay botón de guardar en 3** — Acomodo (`Guardar en la propuesta`), Lo que Voni sabe (`Guardar`), Ficha (`Guardar / enviar PDF`).
💼 Un vendedor que se creyó la Guía **no le pica a "Guardar en la propuesta"** y pierde el acomodo.

### 🟠 G-4 · "**Nunca te quedas atrapado** — Siempre hay '‹ Atrás' e 'Inicio' arriba a la izquierda."
Medido: **Catálogo (paso 1) tiene 0 botones. Tablero tiene 0 botones.** Ni Atrás ni Inicio. Y en Acomodo el botón dice "← Volver a la cotización", no "‹ Atrás".

### 🟠 G-5 · "No tienes que saberte las **24** líneas."
Quinta cuenta distinta del mismo dato. Recapitulando lo medido:
| Dónde | Cuántas líneas |
|---|---|
| Guía | **24** |
| `LINEAS_REG` (el código) | **24** |
| Encabezado del Banco | **23** |
| Filtro LÍNEA del Banco | **25** |

### 🟢 G-6 · Una promesa que SÍ se cumple
"Vigencia de 15 días — Toda propuesta la trae impresa" ✅ (`FichaPDF.jsx:110`). Aunque justo por eso F-3 importa: si algún día se dan 30 días, hay que cambiar código en dos lugares.

---

## 11. `dibujar` — Dibujar plano
Botones: **14** (6 herramientas + 6 sellos + `Amueblar mi oficina →` + `Cancelar`). Con un cuarto dibujado: **+3** (Limpiar, Quitar, 6 tipos de cuarto). Campos: 1 (ALTURA) + 2 por cuarto (ancho, largo) + casilla "doble altura". Lienzo SVG 1394×950.
Dibujé un cuarto de verdad con eventos de puntero: sale "Área 1 · 21.0 × 13.5 m · Open space · 1 cuarto(s) · 283.5 m²" y el botón final se enciende. ✅ El trazo funciona.
✅ Sí están Puerta / Columna / Escalera, como promete la Guía ("Márcalas y el sistema no pone muebles encima").

### 🔴 D-1 · 💼 VENDEDOR — El lienzo mide 22 × 15 m. **El plano real de Rodrigo no cabe.**
- `DibujarPlano.jsx:10`: `const W = 22, H = 15; // lienzo en metros` → **máximo 330 m²**, quemado.
- Contra lo que ofrece la app en la pantalla de al lado: `M2_TIPICOS` llega a **2000 m²** y `M2_MAX = 5000`, más "hasta 4 pisos".
- Y lo definitivo: el plano REAL de Rodrigo que el propio arnés usa como referencia (`humo.jsx:211`) tiene un **"Pasillo de circulación de 23 × 14 m"**. **23 > 22: su oficina no entra en el dibujo por un metro.**
- 💼 "Dibujar la oficina" es uno de los tres caminos principales del Acomodo. Con un cliente de 600 m² es un camino sin salida, y no lo dice.

### 🔴 D-2 · 💼 — Un cuarto de **999 × 13.5 m** se acepta y el botón se enciende
Medido: puse `999` en el ancho de un cuarto y quedó **"Área 1 · 999.0 × 13.5 m · 1 cuarto(s) · 13,486.5 m²"**, con `Amueblar mi oficina →` **ENCENDIDO**. Sin un solo aviso.
- Los campos traen `min="1"` pero **ningún `max`**. Un dedazo (999 en vez de 9.99) manda a acomodar 13,486 m² dentro de un lienzo de 330.
- La ALTURA sí trae `min=2 max=6`, pero el `-3` que le metí quedó puesto en el campo: **el atributo HTML no basta**.

### 🟡 D-3 · 👤 "Sellar cuarto:" es una palabra que nadie usa
La fila de plantillas se rotula **"Sellar cuarto:"** (`DibujarPlano.jsx:208`). El comentario del código dice "SELLOS: un toque por cuarto", o sea "estampar". Pero *sellar* en obra significa tapar/impermeabilizar. Es la única etiqueta del sistema que hay que adivinar.
(No es bug: los 6 botones son SELECTORES de herramienta, no crean el cuarto — hay que tocar el plano después. Eso sí está bien explicado en la ayuda de abajo.)

---

## 12. `costear` — Costear especial (Costeador)
Botones: **16**. Campos: **13** (2 texto, 1 select de 100 insumos, 7 numéricos, 3 barras). Es la pantalla más cargada de todas.
⚠️ **Aviso de arnés:** `humo.jsx:251` la monta con `setCosteo={nada}`, así que tecleé largo = `0`, `-500`, `12.5`, `99999` y vacío y **ningún número se movió**. La captura numérica de esta pantalla NO se puede probar aquí; lo de abajo es lo que la pantalla PINTA, que sí es real.

### 🔴 CE-1 · 👤 CLIENTE / DISEÑO — Un número crudo de 17 decimales, impreso en pantalla
Literal, medido:
> `neto 0.90 hoja ≈ 0.30 de hoja → comprar 0.37792260145122275 tablero (1.12 hoja)`
- `Costeador.jsx:332` imprime `{c.unidades}` **sin redondear**. Todos los demás números de ese renglón usan `.toFixed(2)`; éste se quedó sin él.
- Peor: `unidades` debería ser **formatos enteros** — el propio motor documenta que "no hay medio tablero" (`calculo.js:110-113`). Aquí sale una fracción, y con 17 dígitos.
- 👤 Es la cosa que más grita "está en obra" de toda la app.

### 🔴 CE-2 · Ese mismo renglón se contradice **cuatro veces en una línea**
| Lo que dice | Cuánto |
|---|---|
| "neto **0.90 hoja**" | 0.90 (y **la unidad está mal**: 0.90 son m², no hojas — `:330` pega `ins.unidad` a un valor en m²) |
| "≈ **0.30** de hoja" | 0.30 |
| "comprar **0.3779…** tablero" | 0.38 |
| "(**1.12** hoja)" | 1.12 |
Y el renglón de arriba, de la misma pieza, dice **"= 0.90 m² · 0.38 de hoja (fabricado)"**. Cinco cifras para una sola cubierta.

### 🔴 CE-3 · 💼 El consejo de ahorro habla de $3,976 cuando la pieza cuesta $505
En pantalla, al mismo tiempo:
- La pieza: **Material $505**
- El consejo ámbar: *"…caben 2 por tablero y el material baja de **$3,976** a **$1,988** por pieza."*
- **7.9× de diferencia**, sin explicación. (La hoja de melamina ABS 28 cuesta $1,335.60 — `insumos.js:68` —, así que $3,976 son ~3 hojas y $505 son 0.38. Los dos números no pueden ser el mismo concepto.)
- 💼 Si el proyectista le pica a "Usar 1.42×0.52" esperando ahorrar $1,988, se lleva una sorpresa.

### 🟠 CE-4 · 👤 Frase rota: **"Esta pieza de solo deja 1 pieza por tablero"**
`Costeador.jsx:358`: `Esta pieza de {(s.actual === 1) ? 'solo deja 1 pieza' : \`${s.actual} piezas\`} por tablero` — el `de` sólo pega con la segunda rama. Cuando cabe UNA (que es el caso más común y el que dispara el consejo), sale la frase rota.

### 🟠 CE-5 · 👤 La pantalla está prácticamente sin acentos
"QUE ESTAS COSTEANDO" · "CUANTAS PIEZAS" · "Preparacion, empaque y merma" · "HORAS DE ARRANQUE DEL LOTE (PREPARACION)" · "Gastos de fabrica" · "Muy facil / Facil / Dificil / Muy dificil" · "el factor equivalente seria" · "Costo de fabricacion" · "**Agregar a la cotizacion**" (botón principal) · y en el select: "Chapa de madera (**sabana** natural)", "Laminado **plastico**", "**Lamina** de acero", "**Marmol**", "**Silicon**", "**Serigrafia**", "Nivelador **conico**", "**Arnes**", "Caja **electrica generica**".
Junto a ellos, con acento: "De qué está hecho — pieza por pieza", "Precio mínimo (línea…)".

### ✅ La matemática del motor SÍ cuadra (la revisé a mano)
```
Material $505 (26%) + Mano de obra $278 (15%) + Indirectos $172 (9%) + Utilidad $954 (50%) = 100% ✅
Indirectos de fábrica 34% × $505 = $171.7 → $172 ✅
Precio mínimo 45% s/costo: $954 × 1.45 = $1,383 ✅
Precio de lista 50%:      $954 / 0.50 = $1,908 ✅
```
Único detalle: los redondeos arrastran **$1** (505+278+172 = 955, la pantalla dice 954). No es grave, pero un cliente que sume la columna lo va a ver.

---

## 13. `especial` — Asistente especial
4 pasos. Botones por paso: **4** (nombre) → **21** (19 chips + Atrás + Siguiente) → **7** (5 dificultades) → **3** (resultado). Caminé los cuatro.

### 🔴🔴 AE-1 · 👤 CLIENTE — **La app cotiza en NEGATIVO y ofrece mandarlo así**
Camino exacto, sin trucos, todo tecleado en la interfaz:
1. Nombre del mueble: cualquiera → `Siguiente ›`
2. Toco el chip **Cubierta** → aparecen LARGO/ANCHO
3. Escribo **`-500`** en LARGO (el campo trae `min="0"` y **lo acepta**; `Siguiente ›` sigue encendido)
4. `Siguiente ›` → escojo dificultad → `Siguiente ›`

Lo que sale en pantalla, tal cual:
```
Cuesta hacer 1 pieza          $-318
Precio de lista (50% margen)  $-636
Material $-168 · Mano de obra $-93 · Fábrica $-57
[ Ver detalle completo y cotizar ]   ← ENCENDIDO
[ Empezar otro ]
```
- **Cero avisos.** Ni ámbar, ni rojo, ni bloqueo. El botón para meterlo a la cotización está habilitado.
- Es un dedazo de un carácter (`-500` en vez de `500`). No hay que forzar nada.
- 👤 Un precio negativo en una propuesta no es un error de redondeo: es la app diciendo que le pague al cliente.
- 💼 Y si el vendedor no lo ve, la partida entra a la propuesta y baja el total sin que nadie sepa por qué.
- Relacionado con **P-2**: es el mismo agujero (ningún tope en ningún campo) manifestándose donde más duele.

### 🟠 AE-2 · `largo = 0` deja el campo **vacío** y deja avanzar igual
Tecleé `0` y el campo quedó en `""`, con `Siguiente ›` encendido. Se puede costear una pieza sin medida.
Y `99999` mm (una cubierta de **100 metros**) también pasa sin chistar.

### 🟡 AE-3 · El nombre del mueble no tiene tope
300 caracteres se guardan enteros y en el paso 4 salen como el título del resultado. (Medido: **no rompe el ancho de la pantalla** — envuelve bien, `scrollWidth` = 1440 = ventana ✅ — pero ocupa 9 renglones donde debería ir un nombre.)

### ✅ Lo que SÍ aguantó
- El stepper de "¿CUÁNTAS PIEZAS IGUALES?" **no baja de 1** (4 clics en `−` desde 1 → sigue en 1). ✅
- `Siguiente ›` está **APAGADO** con el nombre vacío o sólo espacios. ✅
- `Siguiente ›` está **APAGADO** con **0 piezas** agregadas. ✅
- `"comillas" <b>` en el nombre no rompe nada. ✅
- `‹ Atrás` presente en los 4 pasos. ✅ (aquí sí se cumple lo que promete la Guía)

---
---

# LO QUE **NO** ENSEÑARÍA EL MARTES
Ordenado por lo que más rápido rompe la venta. Cada uno con la medida que lo prueba.

## 🚫 NO LO TOQUES ENFRENTE DEL CLIENTE

**1. Asistente especial — cotiza en negativo (AE-1)** · 👤
Un `-500` en el largo y sale `Precio de lista (50% margen) **$-636**`, sin un solo aviso, con el botón "cotizar" encendido. Un carácter de distancia.

**2. Banco de precios — el mismo producto FIRME a dos precios (B-1)** · 👤💼
`App LT · Bench doble · 1200×1200 · PrestigeMotors dic 2025` → **$2,120 y $4,840**. `Electrificación de bench dobles · NDT Global jul 2026` → **$12,238 y $51,585**. 5 grupos así. Y la Guía promete "Verde lo sostienes".

**3. Costear especial — el número de 17 decimales (CE-1)** · 👤
`comprar **0.37792260145122275** tablero`. Al lado, un consejo que habla de $3,976 cuando la pieza cuesta $505 (CE-3), y la frase rota "Esta pieza **de** solo deja 1 pieza por tablero" (CE-4).

**4. Acomodo — teclear los m² da otro número (A-1)** · 💼
Borrar y teclear `350` produce **5,000 m²**. Cualquier medida que no sea uno de los 8 botones es intecleable.

**5. Tablero — sale en ceros con la cotización llena (T-1)** · 💼
Cotización de 17 muebles en pantalla; el Tablero dice `$0 · 0 piezas · 0 costeos · "Aun no hay costeos guardados"`. Lee sólo `historial`, nunca la cotización.

## ⚠️ ENSÉÑALO, PERO PREPARADO

**6. Ficha PDF — dos fletes distintos para el mismo cliente (F-1)** · 👤
La ficha imprime "Flete… **3%**" quemado; la propuesta cobra **10%** en su renglón. Si el cliente compara los dos papeles, la app se contradice sola en dinero. **Y no hay pantalla donde arreglarlo** (P-3): `fletePorcentaje` no es editable en ningún lado.

**7. Acomodo — "Voni revisó ✓" con palomitas que no revisan nada (A-2)** · 👤
3 de las 4 están escritas `ok: true` a mano (`planner.js:251-262`); las dos de circulación comparan una variable contra sí misma. El código YA tiene la medición buena (`Acomodo.jsx:777`) y enseña la falsa.

**8. Catálogo — el propio ejemplo del buscador no encuentra nada (C-1)** · 💼
El placeholder dice `archivero 2 cajones` → **cero resultados**. Es lo primero que uno teclea.

**9. Informe IA — desaparece completo y deja el título colgando (I-1)** · 👤
Si el modelo no devuelve `##`, `InformeIA` regresa `null` y queda el rótulo "Auditoría técnica de industrialización" con nada debajo.

**10. Dibujar plano — el plano de Rodrigo no cabe (D-1)** · 💼
Lienzo quemado a **22 × 15 m = 330 m²**; su propio plano de referencia tiene un pasillo de **23 × 14 m**. Y la app ofrece hasta 2,000 m² por el otro camino.

## 🔒 NO ABRAS ESTAS PANTALLAS DELANTE DE NADIE

**11. Precios de material** — el botón azul dice **"Usar en los costeos ($0.00)"** y está **habilitado** (P-1). Un toque y la mano de obra de todo vale cero.

**12. Lo que Voni sabe** — al guardar sale `new row violates row-level security policy for table "reglas"` (R-1), en inglés y con el nombre de la tabla. Y **7 de las 10 reglas no las lee nadie** (R-2).

**13. Usuarios** — el error sale como `No se pudo agregar. **no-sesion**` (U-1), y la contraseña temporal se teclea en `type="text"` (U-3).

## 📝 LO QUE SE ARREGLA EN UNA TARDE Y SE NOTA MUCHÍSIMO

**Los acentos.** Media app está sin ellos, y se contradice consigo misma en la MISMA pantalla:
- Catálogo: "Ver **lineas**" en la lista por familia, "Ver **líneas**" en la de búsqueda. `Estacion en L` · `Recepcion` · `Sillon`.
- Tablero: *"agregala a la cotizacion o guardala: aqui apareceran los numeros"* y en el renglón de junto *"Los **números** de utilidad e ingresos son solo para **Dirección**"*.
- Costear especial: `QUE ESTAS COSTEANDO`, `Muy facil`, `Gastos de fabrica`, y el botón principal **`Agregar a la cotizacion`**.
- Precios: `Nomina`, `Parametros`, `Estructura metalica`, `Marmol`, `aqui`.
👤 Es lo primero que un cliente mexicano registra, y no cuesta nada.

**Las cinco cuentas de "cuántas líneas tenemos":** Guía dice 24 · el código tiene 24 · el encabezado del Banco dice 23 · el filtro del Banco ofrece 25 · el Banco habla de "114 productos" y pinta 118.

**Dos casillas pegadas** (A-5): `Recepción` termina en x=391 y `Break room` empieza en x=391. **0 px** de separación.

---

## 🧯 UN AGUJERO EN LA RED DE SEGURIDAD (esto es lo que deja pasar todo lo demás)
`humo.jsx:270` monta `<InformeIA **texto**={…} />` pero el prop se llama `informe`. La pantalla renderiza **0 tarjetas** y el recuadro de arriba dice, en verde, **"1 de 1 pantallas montan bien"**.
Es **exactamente** el punto ciego que el comentario de `humo.jsx:226-231` presume haber cazado en `Inicio`. Volvió a pasar y sigue vivo. Mientras `humo.jsx` no verifique que la pantalla **pinta algo**, seguirá dando verde sobre pantallas muertas.
(El mismo patrón, más suave, en `humo.jsx:269`: `<FichaPDF resultado={null} …/>` — prop inexistente; la ficha sale a **$0**.)

---

## Nota honesta de método
Tres pantallas no se pueden probar a fondo en el arnés porque las monta con manejadores vacíos, y lo digo donde aplica:
- **Precios** (`setEstado={nada}`) y **Costear especial** (`setCosteo={nada}`): los campos son controlados y rebotan; los hallazgos P-2 y CE-1..5 salen de leer el manejador y de lo que la pantalla PINTA, no de verlos cambiar.
- **Banco / Archivo / Usuarios / Reglas** dependen de la nube: sin sesión sólo se ve el camino de error (que es justamente donde encontré R-1 y U-1).
- El brief avisaba que `window.innerWidth`=0 y la geometría no sería medible: **aquí valía 1440 y sí pude medir** (A-5 y AE-3 se apoyan en eso).
