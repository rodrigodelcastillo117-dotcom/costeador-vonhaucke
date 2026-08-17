# Auditoría "vendedor con prisa" — E2E antes del martes

Fecha: 2026-08-17. Modo: vendedor de Von Haucke en junta, cliente enfrente.
Regla: NO leo código, USO la app. Cuento toques. Mido scroll.

## Estado del recorrido (se va llenando sobre la marcha)

- [ ] Setup: puerto real del dev server
- [ ] Recorrido 1 — Con plano (PDF)
- [ ] Recorrido 2 — Sin plano, rápido (botones y texto)
- [ ] Recorrido 3 — Pieza suelta (silla del banco + App LT/Eclipse)
- [ ] Lo que arreglaría antes del martes

---

## 0. Setup

Puertos escuchando al arrancar: 5173, 5174, 5175, 5176, 5177 (y 3002/3003).

**HALLAZGO 0 (higiene, no de la app):** hay **5 servidores de Vite vivos a la vez**
(5173/5174/5175/5176/5177), TODOS con cwd = costeador-vonhaucke y TODOS responden
`<title>Costeador Vonhaucke</title>`. Uso 5177 (el más nuevo).
Riesgo del martes: si Rodrigo abre "localhost:5173" de un bookmark viejo, no sabe
en cuál está parado. Antes de la demo: matar los otros 4.

Viewport de prueba: 1280×720 (desktop). Trampa confirmada: el primer
`innerWidth` da 0; después del primer screenshot ya mide 1280×720.

Pantallas que monta el humo (por título, para `?solo=`):
Login · Cambiar contraseña · Inicio · Inicio · panel cotizar · Inicio · cotizar de línea ·
Guía · Voni · Voni · paso 2 muebles · **Voni vivo (se camina)** · Programa con plano ·
Cotizar con IA · Asistente · Asistente especial · Banco de precios · Catálogo completo (23 líneas) ·
Presupuestos que ya hicimos · Catálogo · Costear especial · HOJA DE COSTO ·
Propuesta (mis números) · Propuesta (vista cliente) · Ficha PDF · Informe IA · MiniRender ·
Línea · <cada una de las 23 líneas>

---

## 1. RECORRIDO 1 — Con plano (PDF del cliente)

Entrada: `?solo=Voni vivo` (la única pantalla que de verdad se camina).

**Toque 1** — En la app real: Inicio → botón negro "Empezar" (Dime qué pide el cliente).
Aterrizas en Voni paso 1 "Espacio". ✅ Bien: "Subir el plano del cliente" ya viene
**preseleccionado**, no hay que elegir. Buen default.

**Toque 2** — click en la tarjeta "Subir el plano del cliente" → abre el selector de
archivo. (En la auditoría inyecté el PDF al `input[type=file]` porque el diálogo del SO
cuelga al navegador headless; es el mismo evento que dispara la app.)

Archivo: `Plano_Oficinas_Completo.pdf`, 260 KB.

### Lectura del plano — lo BUENO
El estado de espera está bien hecho: avatar de Voni girando + mensajes que **cambian**:
"Sacando las áreas…" → "Midiendo los cuartos…". No es un spinner mudo.

### ⏱️ Lectura del plano — el tiempo
Medido con `performance.getEntriesByType('resource')` (el tooling de red del navegador
NO registra esta llamada; hay que sacarla del timing API — apuntado como trampa):

| archivo | tamaño | llamada | duración |
|---|---|---|---|
| **Plano_Oficinas_Completo.pdf** (el plano real del cliente) | 260 KB | `supabase.co/functions/v1/leer-plano` | **58.9 s** |
| propuesta.pdf (prueba de control) | 60 KB | misma | 18.5 s |

**58.9 SEGUNDOS.** Casi un minuto de aire muerto en la junta, con una sola llamada a una
edge function de Supabase (o sea: **depende del wifi del cliente**). Mensajes que cambian
("Sacando las áreas…" → "Midiendo los cuartos…") pero **sin barra de progreso y sin
"esto tarda ~1 minuto"**. Es el silencio más largo de toda la app, y cae exactamente en
el momento en que el vendedor acaba de decir "mira, súbele tu plano".

Riesgo aparte: **no probé qué pasa si la llamada truena o se cae la red.** No vi ningún
mensaje de error ni botón de reintento en el camino feliz; si el martes falla, no sé qué
ve el vendedor.

> ## ⚠️ CORRECCIÓN IMPORTANTE (leer antes que nada lo de abajo)
> A media auditoría comprobé que **`humo.html` NO puede caminar el flujo del martes.**
> `humo.jsx` monta la pantalla viva como `<Voni … setEstado={nada} onAgregarItems={nada} …/>`:
> los dos ganchos que escriben el proyecto son **funciones vacías**.
> Por eso, dentro del humo:
> - el espacio (plano o m²) nunca aterriza en el proyecto,
> - los +/−/Quitar/Vaciar de "Esto entendí" no mueven nada,
> - "Agregué 8 muebles" no agrega nada.
>
> **Eso es del banco de pruebas, NO necesariamente de la app.** Los hallazgos 1 y 4 quedan
> marcados como NO CONCLUYENTES y los vuelvo a probar en la app de verdad (Recorrido 2b).
> Lo que SÍ vale del humo: tiempos de red, textos, scroll, geometría y todo lo del paso 1
> y del paso 2 antes de "Armar".
>
> **Y esto es en sí mismo un hallazgo:** la instrucción de la casa es "usa `humo.html` SIEMPRE",
> pero `humo.html` es incapaz de reventar el camino exacto que se demuestra el martes.
> Da luz verde a una pantalla que nunca guardó nada.

### 🔴 HALLAZGO 1 (CONFIRMADO EN BANCO CON `setEstado` DE VERDAD) — lee el plano y luego dice que no le dijiste el espacio

> **Verificación:** lo repetí en `preview.html`, que monta el mismo `<Voni>` con un
> `setEstado` real (useState). **Se reproduce igual.** Probé los DOS caminos del paso 1:
> (a) subir el plano PDF real, y (b) "Todavía no hay plano" → 200 m² → 2 privados →
> 1 sala de 8 → "Empezar con 200 m² →".
> En los dos, "Esto entendí" sigue diciendo
> **"Todavía no me dijiste dónde va el proyecto. Sin espacio no puedo acomodar."**
> Y al volver al paso 1, **las tres tarjetas están otra vez vacías**: los 200 m² que
> acababa de capturar se borraron de la pantalla.
> Esto NO es artefacto del banco de pruebas.


Al terminar, la app **brinca sola al paso 2 "Muebles"**. Y en el panel "Esto entendí"
del paso 2 dice, con todas sus letras:

> **"Todavía no me dijiste dónde va el proyecto. Sin espacio no puedo acomodar."**

Acabo de subirle el plano, esperó ~40 segundos leyéndolo, **y sí lo leyó** (ver Hallazgo 2).
Pero el espacio NO queda registrado. Copiado literal del DOM del paso 2, después de la carga.

Y si regreso al paso 1 (el stepper de arriba sí navega), el paso 1 me vuelve a enseñar
las **mismas tres tarjetas vacías**: "Subir el plano del cliente / Dibujar la oficina /
Todavía no hay plano" — más un "¿Todavía no sabes el espacio? Empezar por los muebles →".
**No hay nombre de archivo, no hay palomita, no hay miniatura del plano, no hay lista de
cuartos, no hay programa.** Visualmente el paso 1 quedó idéntico a antes de subir nada.

Consecuencia en la junta: el vendedor sube el plano del cliente, espera 40 s, y la app
le dice al cliente que no sabe dónde va el proyecto. Y no hay forma de saber si hay que
volver a subirlo o no.

**Lo que el encargo pedía —"revisa el programa que propone, cámbiale cosas"— NO SE PUEDE
HACER: el programa del plano nunca aparece en el recorrido.** (Sí existe una pantalla
"Programa con plano" en el humo; la reviso aparte, pero desde el recorrido vivo no se
llega a ella.)

### 🟠 HALLAZGO 2 — sí leyó el plano, pero lo que enseña es la nota del ingeniero, no la del vendedor

Lo único que aparece del plano es este párrafo, arriba del paso 1, tal cual:

> "El dibujo original tiene escalas horizontal y vertical ligeramente distintas; se
> normalizó usando las cotas escritas de los cuartos. Privado 4 (forma L) y Privado 5
> (pentagonal) se reconstruyeron con el quiebre y el muro diagonal indicados; áreas
> resultantes ~20.7 m² y ~27.8 m² contra los 22 y 25 m² del cuadro de datos. Existe una
> franja de ~900 mm entre Sala Juntas 2 y Recepción (probable pasillo/ducto) no rotulada
> en el plano. Las 8 islas de trabajo se declaran dentro del área abierta (no son cuartos
> cerrados)."

Cuatro líneas y media de prosa técnica densa, en la pantalla, con el cliente viéndola.
Dice "escalas ligeramente distintas", "se reconstruyeron", "no rotulada", y contradice
al plano del propio cliente (~20.7 vs 22 m²). Es información **honesta y valiosa** —
pero es una nota para Diseño, no para la junta. Debería ir plegada tras un
"¿Cómo leí el plano?" y arriba debería estar lo que el vendedor necesita:
**"Leí tu plano: 5 privados, 2 salas de juntas, recepción y 8 islas. ~XXX m²."**

Lo bueno: **NO está enlatado.** Lo probé subiendo un PDF distinto (`propuesta.pdf`) y
devolvió otra lectura, completamente diferente. Es análisis de verdad.

### 🟠 HALLAZGO 3 — nunca dice "esto no parece un plano"
Le subí a propósito `propuesta.pdf` (una cotización, no un plano) y Voni contestó con
total seguridad, sin una sola duda:

> "…el envolvente (12.00 x 12.50 m) se dedujo de la disposición relativa de los tres
> bloques… Las puertas no están dibujadas en el esquema; se ubicaron en posiciones
> razonables… open space 96 m², sala de juntas 20 m², dirección 15.1 m²."

Nunca dice "oye, esto no parece un plano de oficina". Si el martes el vendedor arrastra
el archivo equivocado (y son 59 s de espera antes de enterarse), la app va a inventar
una oficina y a seguir como si nada.

### ✅ HALLAZGO 4 — RETIRADO. Era el banco de pruebas.
Lo volví a probar en `preview.html`, que **sí** monta Voni con un `setEstado` de verdad:
apreté el **+** del renglón "App LT · Escritorio 1.50 × 0.60 m" y respondió limpio:
**12 → 13 piezas**, **$72,000 → $78,000**, y el encabezado **"16 puestos de trabajo" →
"17 puestos de trabajo"**, todo de un toque. Los +/− y Quitar funcionan bien.
Dejo abajo el detalle de lo que vi en el humo sólo como constancia de por qué el humo engaña.

<details><summary>(constancia) lo que se ve en humo.html</summary>

El panel "Esto entendí" se anuncia con esta promesa:

> "Revísalo aquí, **que es donde se corrige de un toque**. Lo que apruebes es lo que voy
> a acomodar."

Probé, sobre el proyecto sembrado de 6 renglones / $228,102:

| qué apreté | cómo | resultado |
|---|---|---|
| **+** en "Banca doble APP LT" | click JS | sigue en **2**, total sigue **$228,102** |
| **+** en "Banca doble APP LT" | **Enter con el botón enfocado (evento real del navegador)** | sigue en **2** |
| **−** en "Banca doble APP LT" | click | sigue en **2** |
| **Quitar** en "Sillón Pac" | click | siguen **6 renglones**, total **$228,102** |
| control: **+** de "Operativos" (arriba, paso 2) | click | **0 → 1** ✅ |

O sea: **la pantalla SÍ está viva** (el contador de arriba responde), pero
**los seis renglones del proyecto son de adorno**. Ni suben, ni bajan, ni se quitan.
Es literalmente lo contrario de lo que el propio texto promete, y es lo primero que
un cliente pide en una junta ("quítame los archiveros", "ponme 24 en vez de 22").

*(Todo lo de esta tabla es artefacto del humo: `onAgregarItems`/`setEstado` son `nada`.)*
</details>



### 🟠 HALLAZGO 5 — la misma lectura del mismo plano no sale igual dos veces
Subí `Plano_Oficinas_Completo.pdf` **dos veces**. Notas distintas:

- 1ª vez: "…Existe una franja de ~900 mm entre Sala Juntas 2 y Recepción (probable
  pasillo/ducto) no rotulada en el plano…"
- 2ª vez: "**Revisa esto:** · 'Privado 2' y 'Pasillo de circulación / Área abierta'
  **se enciman 1.8 m²**… La puerta principal se ubicó en el muro inferior de Recepción,
  ancho estimado 1.80 m (doble hoja)."

Tiempos también distintos: **58.9 s** y ~**60-70 s**. No se puede ensayar la demo:
lo que salga el martes no es lo que salió el lunes.

---

## Toques contados — Recorrido 2 (sin plano, por botones)
Pedido: **"20 lugares de trabajo, 2 privados, sala para 8"**.

### Paso 1 · Espacio — **6 toques**
1. "Todavía no hay plano"
2. "+" Privados
3. "+" Privados
4. "+" Salas de juntas
5. "8" (personas)
6. "Empezar con 200 m² →"
(los 200 m² ya venían de default: 0 toques. Buen default.)

**Lo mejor de toda la app está aquí.** Al poner 2 privados aparece solo:
> "Open space 156 m² · Privado 1 12 m² · Privado 2 12 m² · Sala de juntas 20 m²"
> "Esos 2 privados necesitan muros. Son unos **18 m lineales** de cancel, altura 2.40 m.
> En cancelería **WAND** —cristal templado con estructura metálica negra— más **2 puertas**
> con cerradura a **$12,680 c/u**. El paño se hace a la medida, así que su precio se cotiza
> por proyecto: pídeselo a Miguel y se agrega como partida. Las puertas sí tienen precio firme."

Cuadra al metro: 156+12+12+20 = **200 m²** ✅. Y avisa qué NO trae precio y a quién pedírselo.
Eso es hablar como vendedor.

### Paso 2 · Muebles — **30 toques** 😬
- Operativos 0 → 20 = **20 clicks en "+"**. El número es un `<span>`, **no se puede teclear**,
  no hay presets (10/20/50), no acelera si lo dejas apretado.
- Privados 0 → 2 = 2 clicks.
- Sala de juntas 0 → 8 = **4 clicks** (va **de 2 en 2**, y eso NO lo dice en ningún lado:
  apreté "+" seis veces esperando 6 y me puso **14**).
- "Armar el proyecto →" = 1 click.

**Total recorrido 2 hasta armar: 6 + 30 + 1 = 37 toques**, de los cuales **20 son el mismo
botón "+"**. En una junta eso es un minuto de estar picándole a un más chiquito.

### Lo que devuelve (18 s, con IA)
> "Agregué 8 muebles a tu proyecto. **20 puestos de bench App LT de 1.50 m con sillas WIN,
> 2 oficinas privadas Eclipse 2.10 m con credenza y sillería, y sala de juntas para 8 con
> mesa y sillas.**"
> Y pregunta dos cosas buenas: "¿Las 2 sillas directivas y 4 de visita son totales o por
> cada oficina privada?" · "¿Confirmamos acabado chapa (o walnut) en los Eclipse…?"

Eso está muy bien. Además, al llegar a 1 operativo se abren solas las opciones
**LARGO POR PUESTO** (1200/1500/1800) · **LÍNEA** (App LT · App · Río · Cirque · Vía · Flex)
· **SILLA** (WIN · WIN-CAB · GAMMA-E · DEX · C4-EM-BNF). Progresivo, sin muro de claves. ✅
Y arma la frase en español de a de veras antes de mandar:
*"20 lugares de trabajo en bench de la línea applt de 1.50 m por puesto, 20 sillas
operativas WIN, 2 oficinas privadas…"* — eso se le puede leer al cliente tal cual.

---

## Scroll medido (alto de la pantalla ÷ alto del viewport)
Viewport de referencia 1280×720.

| pantalla | alto | veces la pantalla |
|---|---|---|
| Voni paso 1 · Espacio (vacío) | 831 px | 1.15 |
| Voni paso 1 · Espacio (con 2 privados + sala) | 2,011 px | **2.79** |
| **Voni paso 2 · Muebles + "Esto entendí"** | 2,698 px | **3.75** |
| Voni paso 2 después de "Armar" | 3,203 px | **4.45** |
| Inicio (3 variantes juntas) | 2,603 px | — |
| Propuesta (mis números) @1440×900 | 1,769 px | 1.97 |
| Propuesta (vista cliente) @1440×900 | 3,127 px | 3.47 |

**El problema de scroll está en el paso 2.** El botón que te deja avanzar,
**"Sí, así es — acomódalo →", vive a 2,525 px**: hay que bajar **3.5 pantallas completas**
para encontrarlo. Y arriba, los contadores donde escribes el pedido están en 627-864 px,
o sea que para poner 20 operativos y luego avanzar recorres el documento entero dos veces.

---

## 🔴 HALLAZGO 6 — "Mis números" no tiene TOTAL
Comparé las dos vistas de la propuesta, renglón por renglón.

**Vista cliente** — impecable, y la aritmética cuadra al peso (la verifiqué a mano):
| concepto | valor |
|---|---|
| Suma de los renglones | $228,102 |
| Maniobras e instalación 3% | $6,843 |
| Flete 10% | $22,810 |
| IVA 16% | $41,241 |
| **TOTAL** | **$298,996** |
| Anticipo 50% / saldo | $149,498 / $149,498 |

228,102 × 3% = 6,843 ✅ · × 10% = 22,810 ✅ · (228,102+6,843+22,810) × 16% = 41,241 ✅ ·
suma = 298,996 ✅ · mitad = 149,498 ✅. **Cero errores.** Y el encabezado dice
"6 líneas · 17 piezas". Bien.

**Vista "Mis números"** (la del vendedor): trae Precio / Costo / Utilidad / Margen **por
renglón**… y se acaba. Después del campo "Flete (%)" viene directo "Imágenes de la
propuesta". **NO HAY suma de renglones, NO HAY IVA, NO HAY TOTAL, NO HAY utilidad total
del proyecto, NO HAY margen del proyecto.** Lo confirmé sobre el HTML, no sólo a ojo.

O sea: el vendedor que tiene que respetar el mínimo de 40% de margen **no puede ver el
margen del proyecto en ninguna pantalla**. Sabe que existe, porque la app le dice
"Máx. rentable: 27%" en el campo de descuento — pero nunca le enseña de dónde sale.

## 🟠 HALLAZGO 7 — el mismo proyecto dice dos cosas distintas sobre qué tan firme es el precio
Mismo proyecto ($228,102), dos pantallas, dos veredictos:

- **"Esto entendí" (paso 2):** "**5 de 6** renglones traen precio *estimado*… **El resto es
  firme.**" → 1 renglón firme, el de $82,878 = **36% del dinero**.
- **"Propuesta (mis números)":** "**0% del precio sale de proyectos ya cerrados.** Casi todo
  este precio lo calcula el modelo…"

Y sin embargo esa misma tabla marca la Banca doble APP LT como **CALIBRADO**.
Son dos definiciones distintas de "firme" (calibrado vs. anclado a orden cerrada) con las
mismas palabras. Si el cliente pregunta "¿este precio es firme?", el vendedor tiene dos
respuestas en dos pantallas y ninguna coincide.

## 🟡 HALLAZGO 8 — "Precio de lista" sigue vivo en "Esto entendí"
En la propuesta ya dice "**Suma de los renglones**" (bien). Pero en "Esto entendí" el
mismo número se sigue llamando **"Precio de lista"** — que es justo la palabra que causó
el enredo de bruta/neta. Falta ese cambio en esa pantalla.

## 🟡 HALLAZGO 9 — la sala de juntas no paga muros
En el paso 1, 2 privados generan "**18 m lineales de cancel + 2 puertas**". La sala de
juntas de 20 m² —que también es un cuarto cerrado— **no suma ni un metro de cancel ni una
puerta**. O la sala no lleva muros (y hay que decirlo), o faltan ~18 m más de cancel.
