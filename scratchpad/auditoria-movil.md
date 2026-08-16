# Auditoría de experiencia móvil — Costeador Von Haucke

**Fecha:** 2026-08-16 · **Build en vivo:** 2,716,653 · **HEAD:** `fa09a29`
**Cómo se midió:** `http://localhost:5175/humo.html` (48/48 pantallas montan) y `/plano.html`, a **375 × 812**, comprobado también a **390 × 844**, **414 × 896** y horizontal **812 × 375**. Todas las cifras son medidas del DOM en vivo (`getBoundingClientRect`, `getComputedStyle`), no estimaciones.
**Persona:** vendedor de 54 años, dedo grueso, luz de sol, datos móviles, con prisa.

> Nada de esto se aplicó. No se tocó `src/`. No se corrió `deploy.sh`.

---

## Resumen en una línea

La app **no se desborda** en ningún ancho de teléfono (`document.scrollWidth == innerWidth` a 375/390/414) — eso ya está ganado. Lo que falla es otra cosa: **un botón muerto**, **un nombre de mueble que se imprime en vertical letra por letra**, **224 controles por debajo de 44 px**, **el plano imposible de usar con el dedo**, y **el gris de toda la app a 4.46:1**.

---

# 🔴 GRAVE — truena o hace perder trabajo

## 1. "Acomodar" está muerto: `GX is not defined`

**Qué:** el flujo 1-clic del Acomodo 3D revienta **siempre**. La pantalla muestra una alerta roja: `No se pudo acomodar: GX is not defined`.

**Dónde:** `src/datos/planner.js:133` (y `:131`)

```js
// línea 78, DENTRO de empacarTodoGarantizado():
const PER = CIRC, GX = CIRC;
...
// líneas 131-134, DENTRO de acomodarLocal() — otro scope:
{ check: 'Circulación perimetral', ok: PERIM >= circulacion, ... },
{ check: 'Circulación entre filas', ok: GX >= circulacion, ... },
```

**Medida:** 100 % de fallo en la rama `opts.ajustar && areas.length <= 1` — que es el camino por defecto (un solo espacio auto-dimensionado). Reproducido en `humo.html`, sección "Acomodo 3D". `git status` limpio → **está así en producción**.

**Bug siamés (mismo renglón):** la línea 131 lee `PERIM` (constante de módulo = **700**, `planner.js:13`), pero el empacador real separa con `PER = regla('circulacion_min') ?? 900`. Aunque se arregle `GX`, el panel reportaría **0.70 m** cuando el acomodo usó **0.90 m** → palomita roja falsa. Es exactamente el "cartel que miente" contra el que advierte el comentario de `planner.js:123-125`.

**Por qué importa a los 54:** el vendedor toca "Acomodar", ve rojo, y no tiene forma de saber si se equivocó él o la app. Se sale. Es la función que más vende la propuesta.

**Parche propuesto** (no aplicado):

```js
// planner.js:102 — devolver lo que de verdad se usó
return { out, W: Math.round(W), L: Math.round(L), per: PER, gx: GX };

// planner.js:120
const { out, W, L, per, gx } = empacarTodoGarantizado(base, piezas, true);

// planner.js:131-134
{ check: 'Circulación perimetral', ok: per >= circulacion,
  detalle: `${(per / 1000).toFixed(2)} m contra muros (la regla pide ${(circulacion / 1000).toFixed(2)} m)` },
{ check: 'Circulación entre filas', ok: gx >= circulacion,
  detalle: `${(gx / 1000).toFixed(2)} m entre muebles (la regla pide ${(circulacion / 1000).toFixed(2)} m)` },
```

---

## 2. El nombre del mueble se imprime en vertical, una letra por renglón

**Qué:** en la lista de Voni, la columna del nombre colapsa a un hilo de ~20 px y el texto baja letra por letra durante ~350 px. El vendedor no puede leer qué mueble es.

**Dónde:** `src/componentes/Voni.jsx:126` + `src/estilos.css:1414`

```jsx
// Voni.jsx:126 — flex-basis 0 + minWidth 0 = se puede encoger a casi nada
<div style={{ flex: 1, minWidth: 0 }}>
  <div className="voni-fila-t">{pt.nombre}</div>
```

```css
/* estilos.css:1414 — se permite envolver, pero nadie obliga al nombre a ocupar su renglón */
@media (max-width: 480px) { .voni-fila { flex-wrap: wrap; gap: 8px 12px; } }
```

**Medida** (columna del nombre, `.voni-fila-t`):

| Ancho de pantalla | Nombre queda en | Veredicto |
|---|---|---|
| 375 px | **22.4 × 345 px** | ilegible |
| 390 px | **37.4 × 320 px** | ilegible |
| **414 px** | **9.4 × 345 px** | **peor: 9 px de ancho** |
| 812 px (horizontal) | 298 × 49 px | bien |

Los hermanos de la fila suman **171 + 71 + 40 + 71 = 353 px** (`.masmenos` 171, precio 71, `.icono-btn` 40, "Quitar" 71) + 3 gaps de 12 px = **389 px** dentro de un contenedor de **289 px**. Como el nombre es el único con `min-width: 0`, absorbe todo el faltante él solo. **A más pantalla, peor**: a 414 px los hermanos no se encogen nada y al nombre le tocan 9 px.

**Por qué importa a los 54:** es la pantalla donde revisa el proyecto que armó Voni antes de cotizar. Con nombres como *"Modulor · Archivero horizontal 0.75 2 cajones · Melamina y canto ABS"* no distingue una partida de otra, y el botón "Quitar" queda a un dedo de distancia.

**Parche propuesto:**

```css
/* estilos.css, dentro del @media (max-width: 480px) de la línea 1403 */
.voni-fila > :first-child { flex: 1 0 100%; min-width: 100%; }
.voni-fila-t { overflow-wrap: anywhere; }
```
El nombre se queda con el renglón 1 completo y los controles bajan al renglón 2. Dos líneas, cero JSX.

---

# 🟠 SERIO — se puede tocar mal, se puede leer mal

## 3. El plano no se puede usar con el dedo

Tres medidas, las tres del mismo sitio.

### 3a · Los botones ⟳ (girar) y ✕ (borrar) miden 15.5 px

**Dónde:** `src/componentes/PlanoAcomodo.jsx:268` → `const bt = (totalW + 2 * pad) / 17;`

**Medida:** el SVG se renderiza a **263.0 × 187.8 px** a 375 px de viewport (medido en `/plano.html`; `.plano-wrap` come 12 px de padding y `.tarjeta`/`.contenido` el resto). Diámetro del botón = 263 / 17 = **15.5 px**. El mínimo cómodo es 44. **Es el 35 % del objetivo, y uno de los dos botones BORRA la pieza.**

### 3b · El umbral de arrastre es de 1 px

**Dónde:** `PlanoAcomodo.jsx:199` → `const MOVIO = (totalW + 2 * pad) / 260;`

**Medida:** 263 / 260 = **1.01 px en pantalla**. El temblor normal de un dedo es de 3–8 px. Resultado: **casi todo toque se registra como arrastre**, no como toque. El vendedor quiere seleccionar un mueble y lo que hace es moverlo de lugar. iOS y Android usan ~10 px de holgura.

### 3c · No hay zoom ni pan. Ninguno.

**Medida:** `grep -rn "wheel|pinch|zoom|touches.length" PlanoAcomodo.jsx DibujarPlano.jsx Acomodo.jsx` → **0 resultados**. Y `PlanoAcomodo.jsx:297` pone `touchAction: 'none'` en el SVG editable, lo que **también apaga el pinch nativo del navegador**. El plano es una estampa fija de 263 px.

Escala real: en `DibujarPlano` el SVG mide **329 px** para un `viewBox` de 22 m → **14.95 px por metro**. Un archivero de 0.90 m = **13.5 px**. Una credenza de 0.45 m de fondo = **6.7 px**. En `PlanoAcomodo` con las 5 áreas juntas: 263 px / 21.2 m = **12.4 px/m** → una silla de 0.56 m = **6.9 px**.

**Bonus:** el modo por defecto es `iso` (3D) y **no es editable** (`Acomodo.jsx:99` `useState('iso')`; medido en vivo: `touch-action: auto`, cero handlers). Para poder mover algo hay que descubrir el botón "Planta" (95 × 42 px).

**Por qué importa a los 54:** "acomodar el espacio del cliente" es la promesa de la app. Hoy, en teléfono, no se puede: no ve las piezas, no las puede agarrar sin moverlas por accidente, y no puede acercarse.

**Parche propuesto — barato primero:**

1. **Piso de tamaño en pantalla para los botones (~6 líneas).** El SVG ya conoce su ancho renderizado; basta medirlo con un `ref` + `ResizeObserver` y escalar `bt` para que nunca baje de 44 px reales:
   ```js
   const [pxW, setPxW] = useState(263);          // ancho real del SVG en px
   const uPorPx = (totalW + 2 * pad) / pxW;      // unidades de viewBox por píxel
   const bt = Math.max((totalW + 2 * pad) / 17, 46 * uPorPx);
   ```
2. **Umbral de arrastre en píxeles reales (1 línea):** `const MOVIO = 10 * uPorPx;` — 10 px de dedo, no 1.
3. **Zoom/pan (~40–60 líneas).** El `viewBox` ya se arma como plantilla en `PlanoAcomodo.jsx:295`; sólo hay que meterle un `{k, tx, ty}` de estado y un handler de dos dedos. **Versión de 15 líneas para hoy:** dos botones HTML reales de 48 px (`+` / `−`) encima del plano que multipliquen `k`, y dejar el pan al arrastre con un dedo cuando no haya pieza agarrada.
4. **Abrir en "Planta" cuando la pantalla sea de teléfono:** `useState(window.innerWidth <= 900 ? 'planta' : 'iso')` en `Acomodo.jsx:99`.

---

## 4. 224 controles por debajo de 44 × 44 px

**Medida:** barrido de las 48 pantallas a 375 px. **224 controles en 42 tipos distintos.** (Para los checkbox se midió la etiqueta `.check` completa, que sí es tocable, no el cuadrito de 20 px.)

| # | Control | Medida | Veces | Pantallas | Dónde |
|---|---|---|---|---|---|
| 1 | `.check` (palomita de opción — **cambia el precio**) | **329 × 38** | **100** | 20 | `estilos.css:595-596` |
| 2 | `.masmenos button` **− / +** de cantidad (**cambia el precio**) | **40 × 40** | **48** | **24** | `estilos.css:1048` |
| 3 | `.icono-btn` "Editar" partida | **40 × 40** | 12 | 2 | `estilos.css:1375` |
| 4 | **"Quitar"** (**borra una partida**) | **75 × 40** | 6 | Propuesta | `estilos.css:1080` |
| 5 | **"Quitar"** (**borra una partida**) | **71 × 38** | 6 | Voni | `.boton.fantasma` |
| 6 | `.check` (Editar partida) | 343 × 38 | 6 | 1 | `estilos.css:595` |
| 7 | `.chip` de cantidad/variante | **41 × 44** / 42 × 44 | 7 | 3 | `estilos.css:1409` |
| 8 | `input[type=range]` factores (**cambia el costo**) | **129 × 16** | 3 | Costear especial | nativo |
| 9 | `.pieza-x` **×** (borra componente) | **40 × 44** | 1 | Costear especial | `estilos.css:194` |
| 10 | `.segmento button` (tabs Mis números / Cliente) | 163 × 40 | 2 | Propuesta | `estilos.css:1060` |
| 11 | "Imprimir" | 335 × 42 | 2 | Propuesta | — |
| 12 | Botones del Acomodo / Dibujar plano (Planta, Vista 3D, Puerta, Columna, Escalera, Deshacer, plantillas de cuarto…) | 40–42 px de alto | ~25 | 2 | `Acomodo.jsx`, `DibujarPlano.jsx` |

Los peores son los **#2, #4 y #5**: son los únicos que **cambian dinero o borran trabajo**, y son los más chicos. El − / + de 40 × 40 aparece en **las 24 pantallas de línea**, incluido el de la barra fija de abajo (`estilos.css:1048`).

**Por qué importa a los 54:** a esa edad la precisión del toque baja y la vista de cerca cansa. Un − de 40 px junto a un + de 40 px separados por 10 px de gap: se equivoca de signo, no lo nota, y manda una cotización con la cantidad mal.

**Parche propuesto** (un solo bloque al final de `estilos.css`, sin tocar JSX):

```css
@media (max-width: 900px) and (pointer: coarse) {
  .masmenos button, .bc-mm button, .icono-btn, .pieza-x { width: 48px; height: 48px; }
  .check { padding: 10px 0; }                 /* 38 → 46 px de alto */
  .check input { width: 24px; height: 24px; }
  .chip { min-width: 48px; min-height: 48px; }
  .boton, .segmento button, .vt-quitar { min-height: 48px; }
  .boton.fantasma { min-height: 48px; }
  input[type=range] { height: 44px; }         /* la pista sigue fina, el área crece */
}
```

---

## 5. El gris de toda la app queda en 4.46 : 1

**Qué:** `--gris: #746E68` sobre `--papel: #F3F1ED` da **4.46 : 1**. El mínimo AA es 4.50. Falla por 0.04 — pero falla en **todas partes**.

**Dónde:** `src/estilos.css:8-28` (`:root`), aplicado por `.ayuda` (`:119`), `.etiqueta`, `.enlace-olvide`, `.panel-sub`, `.pregunta-sub`, `.entrada-sub`, `.voni-tag`, `.guia-pista`, `.guia-paso-r`, `.propx-tot-anticipo`, las condiciones de la propuesta… **64 combinaciones distintas de texto medidas por debajo del mínimo.**

**Medida (calculada sobre el color compuesto real, respetando alfa):**

| Selector | Tamaño | Color / fondo | Ratio | Mínimo |
|---|---|---|---|---|
| `.sello-estimado` ("Estimado") | **11 px** bold | `#9A7317` / `#F6ECD3` | **3.69** | 4.5 |
| `.segmento button` (tab "Como la ve el cliente") | **13 px** | `#746E68` / `#EFECE9` | **4.28** | 4.5 |
| `.ayuda` | 14 px | `#746E68` / `#F3F1ED` | **4.46** | 4.5 |
| **`.etiqueta` (TODAS las etiquetas de formulario)** | 14 px | `#746E68` / `#F3F1ED` | **4.46** | 4.5 |
| `.entrada-sub`, `.ayuda.entrada-pie` (Login) | **13 px** | `#746E68` / `#F3F1ED` | **4.46** | 4.5 |
| `.propx-tot-anticipo` (Anticipo 50 %) | **12.5 px** | `#746E68` / `#F3F1ED` | **4.46** | 4.5 |
| `.enlace-sutil`, `.leg` | 12.5 / 13 px | `#746E68` / `#FBFAF8` | 4.82 | 4.5 |

Y **más de 90 reglas bajan de los 17 px** que `estilos.css:39` fija en `html, body` con el comentario "nunca menos". Las peores: `.ficha-k`, `.ficha-spec dt`, `.ficha-tabla th`, `.ficha-foot` a **10 px**; `.sello`, `.bc-nota`, `.ia-et`, `.propx-cant-l`, `.retomar-lbl` a **11 px**.

**Falsa alarma que descarté:** `.linea-foto-tag` parecía 1.10 : 1 (blanco sobre blanco). Recalculado con el `background: rgba(20,18,17,.62)` de `estilos.css:453` compuesto: **5.55 : 1**. Está bien. No lo reporto.

**Por qué importa a los 54:** a esa edad se pierde contraste de luminancia y sensibilidad al gris. Al sol, 4.46 : 1 a 12 px es texto que simplemente no está. Y lo que está en gris no es decoración: son **las etiquetas de todos los campos** y el **"Estimado"** que avisa que el precio no está calibrado.

**Parche propuesto:**

```css
/* estilos.css:8-28 — dos variables, toda la app se compone */
--gris:  #5F5A54;   /* 4.46 → 6.05 sobre papel · 6.54 sobre panel · 6.82 sobre blanco */
--ambar: #7F5F12;   /* 3.69 → 5.03 sobre #F6ECD3 (el sello "Estimado") */
```
(`#6B655F` bastaría para pasar AA con 5.10, pero para un lector de 54 años conviene el margen de `#5F5A54`.)

Y un piso de tamaño, sólo en teléfono:
```css
@media (max-width: 900px) {
  .ficha-k, .ficha-spec dt, .ficha-tabla th, .ficha-foot,
  .sello, .bc-nota, .ia-et, .propx-cant-l, .retomar-lbl { font-size: 12px; }
  .etiqueta, .ayuda, .entrada-sub, .segmento button { font-size: 15px; }
}
```

---

# 🟡 MEDIO

## 6. Números cortados en "Precios de material"

**Qué:** las celdas de precio recortan la cifra. No hay scroll: `overflow-x: clip`.

**Dónde:** `src/componentes/Precios.jsx`, campos `.numero` dentro de la tabla.

**Medida (375 px):** caja de **48–59 px** de contenido para un `scrollWidth` de hasta **98 px**. Casos reales: `1336.56` en 55 px, `2270.17` en 55 px, `803.74` en 48 px, `455.82` en 55 px. **El vendedor ve `1336.` y no sabe si son 1336.56 o 1336.50.**

**Por qué importa:** es la pantalla donde Dirección captura el costo de materia prima. Un decimal invisible se propaga a todos los precios.

**Parche propuesto:** en el `@media (max-width: 480px)` de `estilos.css:1403`, apilar la tabla en tarjetas o al menos:
```css
.tarjeta table td .numero { min-width: 9ch; }
.tarjeta table { display: block; overflow-x: auto; }   /* ya existe en :1418 — falta que las celdas no encojan */
.tarjeta table th, .tarjeta table td { white-space: nowrap; }
```

## 7. La ficha PDF se desborda y no se desliza

**Qué:** `.ficha-tabla` (`estilos.css:682`) es `width: 100 %` **sin envoltorio de scroll**, y queda **fuera** del `@media (max-width: 480px)` que sí arregla `.datos` (`:1424`) y `.tarjeta table` (`:1418`).

**Medida:** `.ficha-pdf` y `.ficha-controls` declaran `width: 210mm` = **794 px** (`estilos.css:647`, `:650`), rescatados por `max-width: 100%`. Pero `.ficha-spec` usa `grid-template-columns: 92px 1fr` (`:677`) que nunca colapsa, y `header.ficha-head` mide **314 px de contenido en 307 px de caja**. Alto total de la ficha: **1123 px** en una pantalla horizontal de **375 px**.

**Parche:** añadir al bloque de `:1403`
```css
.ficha-tabla { display: block; width: 100%; overflow-x: auto; }
.ficha-spec { grid-template-columns: 1fr; }
```

## 8. Teclado: 351 campos numéricos, ninguno con `inputMode`

**Medida:** **351** `input[type="number"]` (248 `.numero` + 103 `.numero `), **0** con `inputmode`, **0** con `pattern`. También: 1 solo `<select>` en toda la app, 56 checkbox, 2 textarea.

`type="number"` sí abre teclado numérico en iOS, así que **no está roto**. Pero:
- sin `inputMode="decimal"` el teclado de iOS trae puntuación de más y el punto decimal en un sitio incómodo;
- `type="number"` en es-MX **rechaza la coma** decimal, que es la que teclea un vendedor mexicano;
- la rueda del ratón / el arrastre cambia el valor sin querer.

**Parche:** en los campos de dinero y medidas, `inputMode="decimal"` (y `inputMode="numeric"` en cantidades enteras). Es un atributo por campo; se puede centralizar en el componente que ya pinta `.numero`.

**Teclado tapando el campo:** la barra fija de compra (`.barra-compra`, `estilos.css:1036-1043`) es `position: fixed; bottom: 0` y mide **375 × 67 px** medidos. Reserva bien su espacio (`.dos-col-costeo { padding-bottom: 84px }`, `:1050`) y respeta `env(safe-area-inset-bottom)`. **Está bien resuelto.** El riesgo que queda es el conocido de iOS Safari: al abrir el teclado, un `position: fixed` inferior puede quedar bajo el teclado. Vale la pena probarlo en el iPhone real con el campo "Descuento".

## 9. Login en horizontal: 701 px de alto en 375 px de pantalla

**Medida:** `.entrada` mide **812 × 701 px** con la pantalla horizontal a **812 × 375**. Casi dos pantallas de scroll antes de llegar al botón "Entrar". `estilos.css:1356` sólo colapsa a una columna por debajo de 900 px de **ancho**, y en horizontal el ancho es 812 → se aplica, pero el hero de foto sigue midiendo 30vh + el panel completo.

**Parche:** añadir un corte por alto:
```css
@media (max-height: 500px) { .entrada-foto { display: none; } .entrada { grid-template-rows: 1fr; } }
```

---

# 🟢 COMPROBADO QUE YA ESTÁ BIEN

Lo que se arregló hoy, verificado a 375 px:

- ✅ **Cero scroll horizontal** en toda la app: `document.scrollWidth == innerWidth` a 375, 390 y 414. Los parches de `estilos.css:1403-1429` funcionan.
- ✅ **La barra fija de compra existe en las 24 pantallas de línea**: precio + `−` `1` `+` + "Agregar", 375 × 67 px, pegada abajo. Es la mejor decisión móvil de la app: sin ella habría que scrollear **3,353 px** (4.1 pantallas) para llegar al botón de agregar en App LT.
- ✅ **La tabla de totales de la propuesta cabe**: `.propx-tot` mide 335 × 259 px, `scrollWidth == clientWidth`. Se entiende y no se corta.
- ✅ **Descuento acotado**: el botón "Máx. rentable: 27 %" está presente y el campo ya no admite 999.
- ✅ **"Quitar" confirma** antes de borrar.
- ✅ **Los chips de producto** ya crecen hacia abajo en vez de a lo ancho (`estilos.css:1407-1411`); a 375 px ninguno desborda.
- ✅ **Maniobras y flete** aparecen como renglones con su propio campo (%).
- ✅ **Jerarquía por familia** en Inicio: 7 grupos, botones de **938 × 54 px** — el único sitio donde el tamaño de toque es generoso.
- ✅ **Catálogo con buscador** y **"Configurar →"** presentes.

---

# Los caminos, contados en toques (a 375 px)

| Camino | Toques | Scroll | Dónde se traba |
|---|---|---|---|
| **Cotizar un bench (App LT)** | **≈8** — grupo → línea → producto → largo → fondo → opción → `+` → Agregar | **3,353 px (4.1 pantallas)** | El `+` mide 40 × 40. El resto fluye: "Agregar" va en la barra fija. |
| **Agregar del banco de precios** | **≈4** — Banco → filtro Línea → cantidad → Agregar | ~2 pantallas | Campo de cantidad 64 × 50 px, cómodo. Sin problemas. |
| **Pedirle algo a Voni** | **≈3** + dictado — Voni → describir → Empezar | 1 pantalla | ✋ **Al llegar la lista, el nombre del mueble es ilegible (hallazgo 2).** |
| **Ver la propuesta** | **≈2** — Cotización → tab "Como la ve el cliente" | ~6 pantallas | El tab mide 163 × 40 px y está a **4.28 : 1**. |
| **Descargar el PDF** | **≈2** — "Guardar / enviar PDF" | — | ⚠️ `pdfPropuesta.js:553` usa `doc.save()` (jsPDF → blob + `<a download>`). **En iOS Safari eso suele abrir el PDF en otra pestaña en vez de descargarlo, o quedarse en nada.** Hay que probarlo en el iPhone real; es el único paso del que no puedo dar veredicto desde aquí. `window.print()` (`Cotizacion.jsx:126`, `FichaPDF.jsx:80`) sí funciona en iOS pero abre la hoja de compartir, no un PDF con nombre. |
| **Acomodar el espacio** | — | — | 🔴 **Truena (hallazgo 1).** |

---

# Las 5 cosas que harían que la app se sienta bien en un celular

En orden de **beneficio / esfuerzo**.

### 1 · Arreglar `GX` en `planner.js` — 6 líneas, 10 minutos
Es un botón principal que hoy siempre falla. De todo este reporte, es lo único que está **roto**, no incómodo. Aprovecha y arregla el `PERIM` de la línea 131 en el mismo commit: el panel de auditoría está reportando 0.70 m cuando el acomodo usa 0.90 m.

### 2 · Dos líneas de CSS para el nombre de Voni — 2 líneas, 5 minutos
`.voni-fila > :first-child { flex: 1 0 100%; min-width: 100%; }`. Pasa de **9 px de ancho** a la línea completa. Es la relación esfuerzo/beneficio más alta del documento: dos líneas convierten una pantalla ilegible en una pantalla normal. Y el bug **empeora en teléfonos grandes**, que son los que trae la gente.

### 3 · Un bloque `@media (pointer: coarse)` que suba todo a 48 px — ~10 líneas, 20 minutos
Arregla de un golpe **224 controles**, incluidos los 48 `−`/`+` que cambian el precio y los 12 "Quitar" que borran partidas. No toca ni un archivo `.jsx`. Es el cambio que más se va a *sentir* al agarrar el teléfono.

### 4 · Subir `--gris` a `#5F5A54` y `--ambar` a `#7F5F12` — 2 líneas, 5 minutos
De **4.46** a **6.05**. Dos variables arreglan 64 combinaciones de texto medidas por debajo del mínimo, entre ellas **todas las etiquetas de formulario** y el sello "Estimado" (3.69). Para un lector de 54 años bajo el sol, esto es la diferencia entre leer y adivinar. Súmale el piso de 12 px en las clases de 10–11 px de la ficha.

### 5 · Hacer el plano tocable — de 15 minutos a media tarde, por partes
En este orden:
- **(a)** Umbral de arrastre de 1 px → 10 px reales: **una línea** (`PlanoAcomodo.jsx:199`). Hoy tocar un mueble lo mueve.
- **(b)** Piso de 46 px para los botones ⟳ y ✕: **~6 líneas** (`PlanoAcomodo.jsx:268`). Hoy miden **15.5 px** y uno de ellos borra.
- **(c)** Abrir en "Planta" en teléfono: **una línea** (`Acomodo.jsx:99`).
- **(d)** Zoom + pan: **~40–60 líneas** sobre el `viewBox` de `PlanoAcomodo.jsx:295`, o **~15 líneas** si de momento sólo son dos botones `+` / `−` de 48 px. Con piezas de **6.9 px** y sin poder acercarse, hoy el acomodo en teléfono es para mirar, no para trabajar.

---

## Apéndice — qué NO es un problema

- **Desborde horizontal:** cero, en los tres anchos. Ya está resuelto.
- **`.linea-foto-tag`:** parecía 1.10 : 1; recalculado con el fondo semitransparente compuesto da **5.55 : 1**. Correcto.
- **Checkbox de 20 × 20:** el cuadrito mide 20 px, pero `.check` es `display: flex` y **envuelve** al input, así que el área tocable real es **329 × 38**. Le faltan 6 px de alto, no 24.
- **`type="number"` sin `inputMode`:** iOS sí abre teclado numérico. Es mejorable, no roto.
- **La barra fija de compra:** bien dimensionada, con `safe-area-inset` y su `padding-bottom` de reserva.
