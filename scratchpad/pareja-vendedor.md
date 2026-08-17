# Auditoría EN PAREJA — lado VENDEDOR
**Fecha:** 2026-08-17 · **Auditor:** el que arma la propuesta enfrente del cliente
**Cómo se probó:** `http://localhost:5173/humo.html?solo=<título>` (Vite corriendo en 5173–5177, todos sirven el mismo proyecto)
**Pantallas de mi mitad:** propuesta (mis números + vista cliente) · ficha · acomodo · informe · catálogo · banco · guía

> ESTE DOCUMENTO SE ESCRIBE SOBRE LA MARCHA. Si se corta, lo que está abajo ya es bueno.

---

## Estado del recorrido
- [x] Propuesta (mis números)
- [x] Propuesta (vista cliente)
- [x] Editar partida (la ficha de corrección)
- [ ] Ficha PDF
- [ ] Acomodo 3D
- [ ] Informe IA
- [ ] Catálogo
- [ ] Banco de precios
- [ ] Guía

**Nota de método:** en `humo.html` la Propuesta se monta con `setEstado={nada}`
(`src/humo.jsx` líneas 260-262), así que los `+`/`−`/`Quitar` NO mueven el estado ahí.
Lo que se mide en pantalla es geometría, presencia de botones y estado local; lo que
depende del estado global se verifica leyendo `src/componentes/Cotizacion.jsx`. Lo digo
para que nadie tome "no pasó nada al hacer clic" como bug de la app.

---

# 1 · PROPUESTA — las dos vistas
`src/componentes/Cotizacion.jsx` (608 líneas)
Probado con la cotización real de humo: 6 partidas, 17 piezas, $228,102 de lista.

## 1.1 🔴 NO PUEDO EDITAR UNA PARTIDA DESDE "MIS NÚMEROS". Cero botones.
Conté **TODOS** los botones visibles de cada vista:

| Vista | Botones visibles | Lápiz de editar |
|---|---|---|
| Propuesta (mis números) | 44 | **0** |
| Propuesta (vista cliente / rol ventas) | 31 | **6** (uno por partida) |

El lápiz `Editar` (`setEditando(i)`) está escrito **sólo dentro del bloque
`{soloVentas && …}`** (Cotizacion.jsx líneas 331-359, el lápiz en la 344-348).
La tabla interna "Mis números" (líneas 371-389) sólo tiene `−`, `+` y `Quitar`.

**Qué significa enfrente del cliente:** Rodrigo demuestra con rol dirección/diseño
(`veCostos`), o sea NO `soloVentas`. El cliente dice *"ese escritorio mejor de 1.80"*.
En "Mis números" mi único camino es:

> Quitar (1) → confirmar el `confirm()` del navegador (2) → salir de la Propuesta (3)
> → volver a la línea Eclipse (4) → reconfigurar producto/largo/acabado/mano (5-8)
> → Agregar (9) → volver a Propuesta (10) → subir la cantidad de 1 a 2 (11)
> → **y el renglón queda hasta abajo de la lista, fuera de orden.**

**11 toques y pierdo el renglón de lugar**, contra **3 toques** que costaría si el lápiz
estuviera ahí (lápiz → chip "1.80" → Guardar cambios). La pantalla que lo resuelve
(`EditarPartida.jsx`) **ya existe, ya está bien hecha y recotiza en vivo** — nomás no
está enchufada en la vista donde yo trabajo. Es el arreglo más barato de todo el reporte.

Y si toco "Como la ve el cliente" tampoco: esa vista esconde la tabla interna y **no
enseña ninguna lista editable**. O sea que para el rol de Rodrigo, editar una partida
es **imposible** desde la Propuesta, se vea como se vea.

## 1.2 🔴 EL BOTÓN "DESCARGAR PDF" DESAPARECE EN EL 82% DE LA PÁGINA
El código dice que la barra "se queda pegada abajo — se llega a ella desde cualquier
parte, sin scroll" (comentario en Cotizacion.jsx líneas 267-274). **Medido: no se queda.**

Vista cliente, ventana 1440×900, alto del documento **3,142 px = 3.5 pantallas**:

| Scroll | ¿Se ve la barra Descargar PDF / Imprimir? |
|---|---|
| 0 px | sí (a 497 px del tope, **no** pegada abajo) |
| 400 px | sí, apenas |
| **570 px** | **se va y ya no vuelve** |
| 800 / 1200 / 2000 / 3000 px | **NO** |

La causa: `position: sticky; bottom: 0` (estilos.css 1727-1734) sobre un elemento que
está **arriba** del documento. Sticky-bottom sólo pega mientras el elemento todavía va
*por delante* en el scroll; en cuanto lo pasas, se va con la página. Para que se quedara
tendría que ser `position: fixed`, o el bloque tendría que ir al **final** del documento.

**Enfrente del cliente:** estoy abajo enseñándole el TOTAL y el anticipo, me dice
"mándamelo" y tengo que **hacer scroll de 2,600 px hacia arriba** para hallar el botón.
Es exactamente la queja original de Rodrigo, y está marcada como resuelta.

Además: en "Mis números" ese mismo bloque es el que trae el interruptor
**"Mis números / Como la ve el cliente"**. O sea que **el botón para esconder mis costos
también desaparece a los 570 px de scroll** (ver 1.3).

## 1.3 🔴 MI MARGEN SE VE Y EL BOTÓN PARA ESCONDERLO SE ESCONDE
"Mis números" enseña, en tabla, columnas **Costo · Utilidad · Margen** para cada renglón
(costo $19,185 al lado del precio $41,439), más la barra interna
*"0% del precio sale de proyectos ya cerrados… lo calcula el modelo en: Eclipse · App LT
· Alba · Pac y 1 más"*, más el botón **"Máx. rentable: 27%"**.

Esconderlo cuesta **1 toque** ("Como la ve el cliente")… **si el botón está en pantalla**.
Por 1.2, arriba de 570 px de scroll no lo está: son **3 toques** (scroll arriba + clic +
volver a bajar) con el cliente viendo la pantalla mientras subo. Y no hay ningún atajo de
teclado ni un botón de pánico duplicado abajo.

Riesgo real del martes: si Rodrigo abre la Propuesta en "Mis números" (**es el estado por
omisión**, `vistaClienteManual = false`, línea 60) y voltea la laptop, lo primero que el
cliente lee es su costo y su utilidad.

## 1.4 🟠 "QUITAR" ES UN `confirm()` DEL NAVEGADOR Y NO HAY DESHACER
`quitar(i)` (línea 179-183) usa `confirm(...)` nativo.
- **2 toques** para borrar (Quitar → Aceptar).
- El `confirm()` sale con la cara de Chrome (dice "localhost:5173 dice…" en dev, el
  dominio en producción). Rompe el diseño editorial justo cuando el cliente mira.
- **Deshacer: NO EXISTE.** Ni botón, ni Ctrl-Z, ni "se quitó · Deshacer". Si me equivoco
  de renglón, son los **11 toques** del punto 1.1 para reponerlo.

## 1.5 🟠 EL "MARGEN" DE LA TABLA NO CUADRA CON SU PROPIA FILA (el renglón calibrado)
Renglón 1, el más caro del proyecto (Banca doble APP LT, sello **CALIBRADO**, $82,878):

| Lo que imprime la tabla | |
|---|---|
| Precio | $41,439 |
| Costo | $19,185 |
| **Margen** | **50%** |

Con esos dos números el margen real es **(41,439 − 19,185) / 41,439 = 53.7%**, no 50%.
Los otros 5 renglones sí cuadran exactos al 50% (precio = costo × 2). El de precio real
calibrado es el que miente, porque la celda pinta `pt.margen` guardado (línea 384) en vez
de recalcularlo con el precio calibrado.

**Por qué me importa a mí:** es la columna con la que decido cuánto puedo regalar. Y el
semáforo rojo de "debajo del mínimo" (línea 379) usa ese mismo número guardado, así que
un renglón calibrado puede pintarse verde estando abajo del piso, o al revés.

## 1.6 🟡 Los porcentajes que muevo están a 1,258 px de scroll
Posición medida desde el tope del documento (viewport 900 px):

| Campo | y | ¿se ve sin scroll? |
|---|---|---|
| Cliente / Folio / Fecha | 301 | sí |
| **Descuento de proyecto (%)** | **1,258** | no |
| Imprevistos de obra (%) | 1,344 | no |
| Maniobras e instalación (%) | 1,404 | no |
| Flete (%) | 1,490 | no |

El descuento es **el número que más muevo enfrente del cliente** y vive pasada la
pantalla y media, debajo de la tabla completa de partidas. Con 6 partidas ya está a 1,258
px; con las 20 de un proyecto de verdad se va mucho más abajo, porque va **después** de
la lista. Bajar (1) + teclear (2) + salir del campo para que aplique (3) + subir a ver el
total (4) = **4 toques y dos viajes de scroll** por cada ajuste de descuento.

Lo bueno: el campo de porcentaje (`CampoPct`, líneas 35-57) ya está bien resuelto —
guarda tu texto mientras escribes y sólo normaliza al salir, así que "12.5" se puede
teclear. Y el botón **"Máx. rentable: 27%"** pone el descuento máximo sin romper el piso
en **1 toque**: es lo mejor de esta pantalla.

## 1.7 🟡 Botones que tardan y sí dan señal (esto está bien)
- `Descargar PDF` → cambia a **"Armando el PDF…"** y se deshabilita. ✅
- `Una foto de cada mueble` → **"Generando muebles…"**, deshabilita al hermano. ✅
- `Una imagen de la oficina completa` → **"Generando oficina…"** + spinner con el texto
  *"Creando el render de la oficina… (10–20 s)"*. ✅ Es la única parte de la app que me
  dice cuánto va a tardar.
- Si el PDF truena, cae a imprimir y avisa (línea 159-163). ✅

**Pero:** `Una foto de cada mueble` recorre las 6 partidas **una por una en serie**
(líneas 108-117) y sólo entonces guarda. Son 6 llamadas de 10–20 s ≈ **1 a 2 minutos**
con el cliente esperando, y **no hay botón de cancelar** ni contador "3 de 6". Si me
arrepiento, mi única salida es recargar y perder la sesión.

---

# 2 · EDITAR PARTIDA — la ficha de corrección
`src/componentes/EditarPartida.jsx` (159 líneas)

## 2.1 ✅ ES LA MEJOR PANTALLA DE MI MITAD. Corregir cuesta 3 toques.
Caminada de verdad (clic real en el chip, no lectura de código):

> lápiz (1) → chip **"1.80 m"** (2) → **Guardar cambios** (3)

Al segundo toque, **sin recargar nada**, cambiaron los tres a la vez:
- nombre: `Banca doble APP LT 1.50 · 10 usuarios · ocupa 7.50 × 1.20 m`
  → `Banca doble APP LT **1.80** · 10 usuarios · ocupa **9.00** × 1.20 m`
- importe: `$63,930` → `$67,354`
- y el chip nuevo se prendió, el viejo se apagó.

Geometría medida: modal **792 px** de alto en ventana de 900 → **cabe entero, sin scroll
de página**. El cuerpo scrollea por dentro (637 px de contenido en 561 de caja) y el pie
con **Guardar cambios** queda **siempre pegado y visible**. Escape cierra. Esto está bien
hecho y hay que copiárselo a las demás.

## 2.2 🟠 SE ABRE Y YA CAMBIÓ EL PRECIO SIN QUE YO TOQUE NADA
Al abrir la ficha —**cero clics**— el pie ya dice **`−$9,474 por pieza`** y el precio
baja de `$41,439` a `$31,965` (**−22.9%**).

Lo verifiqué contra el motor para no acusar en falso: corrí `costearConfig` con
**exactamente la misma config** de la partida y da **$31,965 / costo $14,799**, mientras
la partida guardada trae **$41,439 / costo $19,185**. Contrasté las 6 partidas:

| Partida | precio guardado | lo que da el motor hoy | delta |
|---|---|---|---|
| Banca doble App LT | $41,439 | $31,965 | **−$9,474** |
| Alba mesa de juntas 3.60 | $20,432 | $12,798 | **−$7,634** |
| Eclipse escritorio 2.10 | $25,132 | $24,564 | −$568 |
| Eclipse credenza 2.10 | $19,364 | $18,795 | −$569 |
| Modulor archivero 0.75 | $2,962 | $2,747 | −$215 |
| Pac sillón 1 plaza | $4,507 | $4,507 | 0 |

**Honestidad:** en este caso el desfase viene de que la cotización de prueba de
`humo.jsx` quedó vieja respecto del motor. **No estoy reportando esos pesos como bug.**

Lo que sí es comportamiento real de la app y sí me puede quemar: **la ficha no conserva
el precio de la partida, lo vuelve a costear desde cero con el estado de HOY** (línea
41-44) y `Guardar cambios` lo sobrescribe (líneas 146-153). O sea: si alguien tocó
*Precios de material* después de que armé la propuesta, y yo abro una partida sólo para
subirle la cantidad, **esa partida se reprecia y las otras cinco no**. Termino con una
propuesta a dos precios distintos y sin ninguna advertencia de por qué.
Lo salva a medias que el chip `−$9,474 por pieza` sí sale en rojo: es la única señal.

## 2.3 🟡 Si le doy fuera de la caja, pierdo la edición sin preguntar
`onMouseDown` en el fondo cierra el modal (línea 81) y Escape también (línea 28). **No
hay "¿descartar los cambios?"**. Cambié largo + usuarios + biombo (3 toques), le di al
fondo por error y **se fue todo**. No es grave porque rehacerlo cuesta 3 toques, pero con
el cliente enfrente se nota.

## 2.4 🟡 No puedo cambiar el acabado de la banca
La ficha de la Banca doble App LT ofrece **Largo · Usuarios · Biombo · 3 casillas ·
Cantidad**. **No ofrece Acabado.** Está así en el dato de la línea
(`src/datos/applt.js:126`: `banca_doble` no trae `finishes`). Si el cliente dice
*"la misma banca pero en chapa"*, la ficha no me deja y vuelvo a los 11 toques del
punto 1.1. (Pedro y Rafa dijeron en el levantamiento que la misma cubierta va en
melamina / chapa / laminado / vidrio.)

