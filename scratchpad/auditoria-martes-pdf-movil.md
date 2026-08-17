# Auditoría para el martes — PDF del cliente y app en celular

Fecha: 2026-08-17. **No se tocó código.**

Cómo se hizo:
- **(A) PDF**: `node scratchpad/prueba_pdf.mjs` → `propuesta.pdf` (7 hojas, 58 KB). Cada hoja se
  rasterizó con PyMuPDF a 85 dpi (`scratchpad/rev-0.png` … `rev-6.png`) y **se miró una por una**.
  Donde algo se veía raro se sacó la geometría exacta (bbox de cada span, imagen y dibujo) y un
  acercamiento a 200 dpi.
- **(B) Celular**: Vite vivo en **:5173** (hay 5 instancias, 5173–5177, todas responden).
  `humo.html?solo=<pantalla>` a **375×812** con geometría real (`window.innerWidth` = 375
  confirmado en cada medición).
- Los **recuadros grises** del PDF son el JPEG falso de 8×8 px del fixture. **No se reportan.**

---

# (A) EL PDF

## 🔴 Lo que un cliente ve como error

### A1. Portada: dos textos ENCIMADOS al pie — hoja 1
Es lo primero que ve el cliente y se lee como texto sobre texto.

| Texto | bbox (pt) |
|---|---|
| `Vonhaucke · mobiliario de oficina hecho en México` (pie) | 45.4, **813.4 → 824.4** |
| `Así se vería Open space, con el mobiliario de esta propuesta.` (pie de foto) | 45.4, **815.4 → 825.7** |

Los dos arrancan en x = 45.4 y se traslapan **10 pt en vertical**. En `scratchpad/zoom-0-pie.png`
se ven las letras montadas una sobre otra.

Causa visible: la segunda foto de portada llega hasta **y = 815.0** y la **raya del pie está en
y = 807.9** → la foto pisa el pie por 7 pt y empuja su leyenda dentro de la banda del pie.
Cabe todo si la foto termina en ~790.

### A2. Los renglones NO suman el total impreso (falta $1) — hoja 7
```
Subtotal                 $232,805
Maniobras 3%               $6,984
Flete 10%                 $23,280
IVA 16%                   $42,091
                        ---------
suma real                $305,160     ← impreso: TOTAL $305,161
```
Y abajo: `Anticipo 50%: $152,580 · Saldo contra entrega: $152,580` → **$305,160**, otra vez $1
abajo del TOTAL. El total real sin redondear es $305,160.53; lo que no cuadra es que los renglones
se redondean cada uno y el total se redondea al final. Cualquier cliente con calculadora lo
encuentra en 20 segundos, y es la hoja de la firma.

### A3. Una nota del PDF dice algo que el propio PDF desmiente — hoja 7
Nota impresa: *"Los importes por área son informativos **y suman el total**."*

- Áreas (hoja 3): 205,680 + 16,408 + 51,800 = **$273,888**
- TOTAL (hoja 7): **$305,161**

Suman la **"Suma de los renglones"**, no el total. Tal como está redactada la frase es falsa y es
exactamente la que invita al cliente a sumar. (La hoja 3 tampoco trae ninguna línea de total, así
que el cliente se queda con tres cifras sueltas y ningún cierre.)

### A4. El plano tapa piezas con las etiquetas de cuarto — hoja 4
- **OPEN SPACE**: la caja blanca `OPEN SPACE / 12.00 x 8.00 m` ocupa x 68.9–118.1 · y 134.3–155.0 y
  el marcador ④ de la esquina ocupa x 113.9–117.5 · y 135.6–144.6 → **la etiqueta tapa una Silla
  operativa**. Se alcanza a ver el filo del círculo rojo asomando (`scratchpad/zoom-4-openspace.png`).
- **DIRECCIÓN**: la etiqueta se monta encima del escritorio Eclipse y **corta a la mitad el
  marcador ⑦** (`scratchpad/zoom-4-dir.png`). Es el mueble más caro de la hoja ($31,500).

### A5. La numeración del plano salta el 5 — hoja 4
La leyenda va **1, 2, 3, 4, 6, 7**. Falta el ⑤.

Sí hay una razón (el ⑤ es *Gaveta rodante Mox 3 cajones*, 12 pzas / **$49,200 = 18% de la
propuesta**, y no se dibuja porque va debajo de la cubierta — lo dice el comentario en
`src/componentes/Cotizacion.jsx:118`), pero **el PDF no se lo explica al cliente**. Y arriba dice
literal: *"El número de cada círculo es el mismo del detalle de la página siguiente"*, así que la
lectura natural es "se les perdió una partida". Una línea de nota (`⑤ Gavetas rodantes — van bajo
la cubierta, no se dibujan`) lo cierra.

### A6. "Innovativo" no existe en español — hoja 2
Tarjeta 2: **"Innovativo · Planeado para el futuro"**. Es *Innovador*. Sale en la hoja de discurso
de marca, en negritas, arriba.

En la misma hoja:
- Tarjeta 1: *"Diseño de clase mundial / Empresas de clase mundial con diseño de clase mundial"* —
  la frase se repite **dos veces en tres renglones**. Se lee como texto de relleno.
- **"Wellness"** en inglés en un documento en español.
- La lista de "ADEMÁS DEL MOBILIARIO" corta el renglón dejando un **`·` colgado al final de línea**
  (`… Mudanzas estratégicas  ·` ⏎ `Asesoría en planeación…`).

## 🟡 Lo que se ve poco terminado (factor wow)

### A7. Casi la mitad del documento es papel en blanco
Último contenido de cada hoja (la hoja mide 842 pt, el pie va en 808):

| Hoja | termina en | blanco antes del pie |
|---|---|---|
| 3 · Resumen | 306 | **502 pt — 60% de la hoja** |
| 7 · Totales | 467 | **341 pt — 40%** |
| 5 · Qué va en cada área | 530 | 278 pt — 33% |
| 2 · Ventajas | 580 | 228 pt — 27% |
| 6 · Detalle | 602 | 206 pt — 24% |
| 4 · Plano | 693 | 115 pt |

Son 7 hojas de las que **3 están vacías en más de un tercio**. La misma propuesta cabe holgada en 5.
Un cliente que hojea siente un documento inflado.
(Nota buena: **no hay ni un título huérfano al final de hoja ni un renglón perdido** — precisamente
porque todo termina temprano.)

### A8. El PDF está tipografiado en Helvetica, no en la marca
Las únicas fuentes que usa el documento son las base-14 de PDF (**Helvetica** / Helvetica-Bold).
La app en pantalla usa **Archivo + Inter** (y las trae self-hosted, `src/fuentes.css`). Resultado:
la pantalla se ve de marca y el PDF se ve como salida genérica de librería. Incrustar Archivo/Inter
es el cambio de una sola pieza que más sube el "se ve profesional".

### A9. Muebles de la hoja 2 (tarjetas)
- Fila 1: **3 tarjetas de 155 pt**. Fila 2: **2 tarjetas de 242 pt**. Misma altura (124.7) pero
  anchos distintos → la retícula se ve inacabada, como si faltara la sexta tarjeta.
- Las 5 tarjetas miden 124.7 pt de alto y el texto va pegado arriba → ~60 pt vacíos abajo de cada una.
- La paleta (azul pastel, amarillo, durazno, azul, verde) **no es la marca**: la portada es rojo
  Vonhaucke + negro, y la hoja 2 parece de otra empresa.

### A10. Cabeceras de hoja inconsistentes
- Hoja 2: banda roja **a sangre** (0 → 595.3).
- Hojas 4 y 5: **rayita roja** dentro del margen (45.4 → 549.9).
- Hojas **3, 6 y 7: nada**. La hoja 7 (la del TOTAL y la firma) **ni siquiera tiene título**:
  arranca en frío con una raya y los números.

### A11. Detalles menores
- Hoja 3, subtítulo de Open space: **"… · y 1 más"** — se corta el listado.
- Hoja 3: los m² se escriben `96 m²`, `20 m²` y `15.1 m²` (uno con decimal, dos sin).
- Hoja 7: **"Suma de los renglones"** es lenguaje interno; para el cliente es "Subtotal de mobiliario".
- Hoja 7 le enseña al cliente el **"Descuento de proyecto 15%"** explícito. Es decisión de negocio,
  no defecto — pero ahí queda anotado por si el martes no conviene enseñarlo.
- Los porcentajes del fixture (flete 10%, maniobras 3%) no coinciden con lo levantado con Miguel
  (flete 3% CDMX). **No lo verifiqué contra producción**, sólo contra el fixture.

## ✅ Lo que sí cuadra (verificado a mano)
- Portada: **foto a sangre real** (imagen 0,0 → 595.3, 334.5) ✓.
- Portada dice "7 líneas · 34 piezas" → el detalle trae 7 renglones y 2+1+4+12+12+2+1 = **34** ✓.
- Detalle (hoja 6) suma **$273,888** = "Suma de los renglones" (hoja 7) ✓.
- Resumen por área (hoja 3) suma **$273,888** ✓ y cada área cuadra con sus renglones ✓.
- IVA 16% de (232,805 + 6,984 + 23,280) = 42,091 ✓.
- Plano a escala consistente: los tres cuartos están dibujados a **~47 px/m** ✓; 12×8 = 96 m²,
  5×4 = 20 m², 4.20×3.60 = 15.1 m² ✓ — coinciden con la hoja 3.
- Conteos del plano contra la leyenda: 12 sillas ④, 4 archiveros ③, 2 bancas ①, 2 sillas de visita ⑥ ✓.

## ❓ Lo que NO pude verificar
- **El logo de la portada**: el fixture manda `marca: { logo: null }` (`scratchpad/prueba_pdf.mjs:55`),
  así que en el PDF que miré la marca sale **como texto** ("Vonhaucke" en rojo, 26 pt). En la app en
  vivo el logo real sí carga (se ve en la pantalla de Propuesta). **Hay que generar un PDF desde la
  app con sesión antes del martes** para ver la portada con el logo de verdad — es la única hoja que
  no vi como la verá el cliente.
- Las fotos reales de producto (el fixture pone el JPEG de 8×8). No sé si alguna sale deformada,
  con fondo distinto o sin cargar.
- No abrí el PDF en Acrobat/Vista Previa; todo se midió sobre el render de PyMuPDF.

---

# (B) LA APP EN CELULAR (375 × 812)

## ⚠️ Antes que nada: una trampa de la prueba de humo
`humo.html` **NO envuelve la pantalla en `<div class="contenido">`**, y App.jsx **sí**
(`src/App.jsx:700` y siguientes; `.contenido` trae `padding: 20px`, `src/estilos.css:100`).

Si mides tal cual, **toda pantalla se ve pegada al borde de la pantalla, sin un pixel de margen** —
y no es un bug del producto. Yo caí en eso en la primera pasada. Todo lo de abajo está medido
**inyectando esos 20 px** para reproducir la app real (ancho útil real = 335 px).

Si alguien más audita móvil con `humo.html`, que empiece por ahí.

## 🔴 B1. Todo el dinero de la app está en fuente de código (con el cero cruzado)
`--mono: "Roboto Mono", "SF Mono", Menlo, …` (`src/estilos.css:28`) y Roboto Mono **sí carga**
(`document.fonts.check('700 16px "Roboto Mono"')` → `true`).

El problema es la fuente misma. Prueba de píxeles: dibujé un `0` de 80 px y conté píxeles tintados
en el centro del óvalo (donde un cero normal está hueco):

| Fuente | píxeles en el centro del 0 |
|---|---|
| **Roboto Mono** | **272** |
| Menlo | 294 |
| Inter | 47 |

O sea: **el cero de Roboto Mono viene cruzado**. En pantalla el TOTAL del cliente se lee
`$298,996` con los ceros tachados y con hueco alrededor de la coma (`$18 , 028`, `$22 , 810`),
porque el monoespaciado le da a la coma una celda completa.

Dónde pega: **el TOTAL a 30 px de la vista cliente**, cada importe de cada renglón (`.propx-importe`),
`.precio-grande` (38 px, rojo), `.kpi .cifra` (34 px), `.dinero`, la tarjeta "Vas a la mitad" del
Inicio. Es decir: **todos los números que ve el cliente el martes.**

Y encima **no empata con el PDF**, que va en Helvetica con ceros limpios: la misma cifra se ve
distinta en la pantalla y en el papel.

Arreglo chico: dejar `font-variant-numeric: tabular-nums` sobre **Inter** (Inter tiene cifras
tabulares y el cero limpio) en lugar de cambiar de familia. Se conserva la alineación de columnas
y se pierde la cara de terminal.

## 🟡 B2. Blancos de toque por debajo de 44 px
Medidos a 375 px con el padding real puesto:

| Pantalla | Control | Medida | Falta |
|---|---|---|---|
| Voni · paso 2 | `INPUT` (casilla) | **13 × 13** | 31 px |
| Voni · paso 2 | `button.icono-btn` (sin texto) | 40 × 40 | 4 px |
| Voni · paso 2 | `Quitar` | 71 × **38** | 6 px |
| Propuesta (vista cliente) | botón lápiz (editar) | 40 × 40 | 4 px |
| Propuesta (vista cliente) | `Quitar` | 75 × **40** | 4 px |
| Propuesta | `Imprimir` | 111 × **42** | 2 px |
| Propuesta (mis números) | `Mis números` / `Como la ve el cliente` | 129 × **40** | 4 px |
| Propuesta (mis números) | `Máx. rentable: 27%` | 177 × **40** | 4 px |
| Acomodo 3D | `← Volver a la cotización` | 232 × **40** | 4 px |

La **casilla de 13 × 13 de Voni paso 2** es la única grave (el resto son 2–6 px y con el dedo se
aciertan). Si el martes se demuestra el paso 2 en celular, ésa se va a fallar en vivo.

## 🟡 B3. Acomodo 3D: tarjeta dentro de tarjeta dentro de tarjeta
En la pantalla de Acomodo el contenido va anidado tres niveles (`.contenido` 20 px + tarjeta + tarjeta
interior). El resultado a 375 px: la columna de texto de "¿Dónde va a ir esto?" queda en ~200 px y el
párrafo se parte en renglones de 4–5 palabras ("Entre más de verdad sea el / espacio, más de verdad
es la / propuesta"). Se ve apretado justo en la pantalla que es el gancho de la demo.

## 🟡 B4. Detalles de la vista cliente en celular
- Con descuento en 0 se imprimen **dos renglones idénticos**: `Precio de lista $228,102` y
  `Subtotal $228,102`. Al cliente le parece que algo se duplicó.
- `Anticipo 50%: $149,498 · Saldo contra entrega: $149,498` **se parte** y el segundo importe cae
  solo en su propio renglón alineado a la derecha.
- El bloque de porcentajes (`Descuento de proyecto (%)`, `Imprevistos`, `Maniobras`, `Flete`)
  conserva la alineación a la derecha del escritorio: en celular la etiqueta queda a la derecha,
  el campo a la derecha y el texto de ayuda centrado. Se ve desalineado.
- El botón lápiz (editar renglón) es **gris claro sobre blanco, sin texto, 40 × 40**: en un celular
  con brillo de sala de juntas casi no se ve.

## ✅ Lo que está bien en celular (medido)
Con el padding real puesto, a 375 × 812:

| Pantalla | Desborde horizontal | Tap targets < 44 |
|---|---|---|
| Inicio (3 vistas) | **0** — `scrollWidth` = 375 | **ninguno** |
| Catálogo | **0** | **ninguno** |
| Propuesta (vista cliente) | **0** | 4 (los de B2) |
| Propuesta (mis números) | **0** | 4 (los de B2) |
| Acomodo 3D | **0** | 1 |
| Voni · paso 2 | **0** | 3 |

- **Ni una sola pantalla se sale de ancho.** La tabla de 7 columnas de "mis números"
  (Concepto/Cant/Precio/Costo/Utilidad/Margen/Importe) **sí se reacomoda a tarjetas** en celular:
  no queda scroll lateral. Eso estaba bien resuelto.
- Los `+ / −` de cantidad son botones grandes y cómodos.
- Las fotos de producto en la vista cliente son renders reales y se ven bien a 375.
- Ninguna barra fija tapa botones en las pantallas revisadas.
- Textos por debajo de 11.5 px: sólo los rótulos en versalitas ("VAS A LA MITAD", "EMPIEZA AQUÍ",
  "PZAS", "Más de 68 años de oficio"), todos a 11 px. Aceptable para etiqueta, no para lectura.

## ❓ Lo que NO pude verificar en celular
- **La barra de navegación real de la app.** `humo.html` no monta el encabezado de `App.jsx`, así
  que no sé si tapa contenido ni si sus botones (`.btn-enc`, 40 px de alto por CSS) alcanzan el dedo.
  Hay `@media (max-width: 720px)` que le baja padding, pero no lo vi montado.
- **El lienzo 3D del Acomodo** (girar / acercar con el dedo). No llegué a hacerle scroll; sólo vi la
  parte de arriba de la pantalla.
- **Voni paso 1** (la conversación) y **Cotizar con IA**: no medidos.
- Gestos reales (pinch, arrastre), teclado del celular tapando campos, y iOS Safari de verdad:
  esto fue Chrome con viewport de 375, no un iPhone.
- El panel del navegador **se reiniciaba solo** (volvía a la URL semilla y a 1440 px de ancho) cada
  vez que se redimensionaba. Cada medición de arriba se dio por buena **sólo** cuando la respuesta
  reportó a la vez la URL esperada y `innerWidth = 375`; las que no, se repitieron.

---

# Si sólo da tiempo de arreglar 5 cosas antes del martes

1. **A1** — el encimado del pie de portada. Es la hoja 1 y se ve a un metro de distancia.
2. **A3 + A2** — la nota "los importes por área suman el total" (que no suman) y el $1 que le falta
   a la columna de totales. Las dos están en la hoja de la firma.
3. **B1** — sacar el dinero de Roboto Mono. Cambio de una línea de CSS, y le quita a toda la app la
   cara de hoja de cálculo.
4. **A4** — que las etiquetas de cuarto no tapen muebles en el plano.
5. **A5** — la nota del ⑤ que falta en la leyenda del plano.

Y una comprobación obligada que no es un arreglo: **generar el PDF desde la app con sesión iniciada**
para ver la portada con el logo real (A, "lo que no pude verificar").
