# Auditoría del documento que ve el CLIENTE FINAL
**Costeador Von Haucke · 2026-08-16 · lente: director administrativo de 55 años que firma o no firma**

Método: monté las 48 pantallas con `humo.html` (Vite quedó en **5175**, no en el puerto
que reporta la herramienta de preview — ojo con eso), generé el PDF de propuesta de
verdad con `src/datos/pdfPropuesta.js` desde Node, lo abrí, lo rendericé a imagen y lo
puse al lado de seis presupuestos reales de `~/Downloads/`. Nada se editó en `src/`.

Archivos de evidencia (todos en `scratchpad/`):
`propuesta-desc0.pdf`, `propuesta-desc40.pdf`, `propuesta-neg.pdf`, `area.pdf`,
`edge-40.pdf`, `edge-largo.pdf`, `edge-cero.pdf`, `confoto.pdf`, y los PNG `audit-p1.png`,
`audit-p2.png`, `confoto-p2.png`. Scripts: `gen-pdf-audit.mjs`, `area.mjs`, `edge.mjs`, `foto.mjs`.

**48 de 48 pantallas montan.** Nada truena. Lo que sigue es lo que *sí* daña la venta.

---

## 1. 🔴 La hoja de detalle NO CUADRA con su propio TOTAL

**Qué está mal.** En la hoja "Detalle de la propuesta" la columna IMPORTE suma el precio
sin descuento, y tres centímetros más abajo, bajo una raya gruesa, dice TOTAL con el
número ya descontado y con IVA. Son dos números distintos en la misma hoja, sin una sola
palabra que lo explique.

**Dónde.** `src/datos/pdfPropuesta.js:187-203` (columna IMPORTE y el TOTAL al pie).
Mismo defecto en pantalla: `src/componentes/Cotizacion.jsx:409`.

**Cómo lo reproduje.**
```
node scratchpad/gen-pdf-audit.mjs 40 10 propuesta-desc40.pdf   # 40% desc, 10% conting.
```
Página 2 de `propuesta-desc40.pdf` (ver `audit-p2.png`):
82,878 + 50,264 + 38,728 + 20,432 + 17,772 + 18,028 = **$228,102**
y debajo: **TOTAL $158,759**. Faltan $69,343 sin justificar.
Con el default (descuento 0%) tampoco cuadra: la columna suma 228,102 y el TOTAL dice
264,598 — nadie escribió "IVA" en esa hoja.

**Por qué importa.** Es LO PRIMERO que hace un director administrativo: sumar la columna
con la calculadora. Le va a dar otro número. En ese momento deja de creerle al documento
completo, y con razón. El presupuesto real de Von Haucke nunca tiene este problema porque
trae columna **Desc.** y la columna **Subtotal ya viene neta** — ver `226030018 12 mayo
2026.pdf` pág. 5: `MODULO 12,560.00 | 40% | 1 | 7,536.00`. Ahí siempre suma.

**El arreglo propuesto** (NO aplicado). Copiar la estructura del papel real: meter columna
de descuento y dejar la de importe ya neta.

```js
// pdfPropuesta.js:150 — reparto de los 178 mm útiles, ahora con DESC.
const COL = { desc: 62, foto: 26, cant: 12, uni: 26, dsc: 16, imp: 36 };
X.desc = M.izq;
X.foto = X.desc + COL.desc;
X.cant = X.foto + COL.foto + COL.cant;
X.uni  = X.cant + COL.uni;
X.dsc  = X.uni  + COL.dsc;
X.imp  = X.dsc  + COL.imp;      // = 194 = A4.w - M.der

// encabezado(): agregar entre P. UNITARIO e IMPORTE
doc.text('DESC.', X.dsc, y, { align: 'right' });

// dentro del for de partidas (pdfPropuesta.js:187-190):
const fdesc = 1 - (totales.descuentoPct || 0) / 100;
doc.text(String(pt.cantidad), X.cant, yTexto, { align: 'right' });
doc.text(pesos(pt.precioUnitario || 0), X.uni, yTexto, { align: 'right' });
doc.text(totales.descuentoPct > 0 ? `${totales.descuentoPct}%` : '—', X.dsc, yTexto, { align: 'right' });
doc.setFont('helvetica', 'bold');
doc.text(pesos((pt.precioUnitario || 0) * pt.cantidad * fdesc), X.imp, yTexto, { align: 'right' });
```
Y al pie de la hoja, en vez de un TOTAL solo (línea 200-203), la escalera completa
Subtotal → Contingencia → IVA → TOTAL, para que la hoja se sostenga sola.

---

## 2. 🔴 El PDF que se DESCARGA es un documento distinto —y más pobre— que el que se ve en pantalla

**Qué está mal.** "Descargar PDF" es el botón principal y produce un documento al que le
faltan la mitad de las cosas que sí están en la vista de pantalla. Lo que se pierde:

| Está en pantalla (`Cotizacion.jsx`) | ¿Está en el PDF descargado? |
|---|---|
| Anticipo 50% / saldo contra entrega (`:441`) | **No** |
| Condiciones comerciales completas — flete, instalación, empaque, entrega (`:448`) | **No** (sólo 3 viñetas genéricas) |
| Bloque de firma "Aceptación de conformidad" (`:449-452`) | **No** |
| Razón social, teléfono, web (`:453-459`) | **No** (sólo "Von Haucke · mobiliario de oficina hecho en México") |
| Distribución en el espacio / render 3D (`:416-430`) | **No** |

**Dónde.** `src/datos/pdfPropuesta.js:206-218` (las 3 viñetas que hacen de condiciones)
contra `src/componentes/Cotizacion.jsx:432-460`.

**Cómo lo reproduje.** Abrí `propuesta-desc40.pdf` y comparé su texto con el `innerText`
del bloque `.cot-cliente` en `humo.html`. Están arriba, tal cual.

**Por qué importa.** El vendedor ve en la pantalla un documento completo, le da a
"Descargar PDF" —el botón grande, en tinta— y manda por correo un documento sin
condiciones de pago, sin dónde firmar y sin razón social. El cliente no puede aceptarlo
aunque quiera: no hay línea de firma. Y no sabe a qué empresa le está comprando: el pie
sólo dice "Von Haucke", no "Aparatos Electromecánicos Von Haucke, S.A. de C.V.".

**El arreglo propuesto.** Portar al PDF los tres bloques que faltan, después de las
condiciones (`pdfPropuesta.js:215`):

```js
// --- CONDICIONES (texto completo, el mismo de pantalla) ---
const cond = [
  `Vigencia de esta propuesta: 15 días hábiles.`,
  `Condiciones de pago: ${totales.anticipoPct ?? 50}% de anticipo y ${100-(totales.anticipoPct ?? 50)}% contra aviso de entrega.`,
  'Precios de entrega en el área metropolitana de la Ciudad de México; foráneo se cotiza por evento.',
  'Instalación en horario de 09:00 a 18:00 de lunes a viernes; fuera de ese horario genera cargo adicional.',
  'El plazo de entrega inicia cuando el cliente autoriza acabados y planos y cubre el anticipo.',
  'Imágenes representativas; pueden variar tonos de melamina, tela y cristal respecto a la muestra.',
  'Precios en pesos mexicanos.',
];

// --- ANTICIPO ---
sitio(12);
doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...TINTA);
doc.text(`Anticipo ${anticipoPct}%: ${pesos(anticipo)}   ·   Saldo contra entrega: ${pesos(totales.total - anticipo)}`, M.izq, y);
y += 12;

// --- FIRMA ---
sitio(24); y += 10;
doc.setDrawColor(...LINEA); doc.setLineWidth(0.3);
doc.line(M.izq, y, M.izq + 78, y);
doc.line(A4.w - M.der - 78, y, A4.w - M.der, y);
y += 5;
doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
doc.text('Aceptación de conformidad', M.izq, y);
doc.text('Nombre y firma · Fecha', A4.w - M.der, y, { align: 'right' });
```
Y en `pie()` (línea 43), cambiar el texto por el legal completo, como el papel real:
```js
doc.text('Aparatos Electromecánicos Von Haucke, S.A. de C.V.  ·  RFC AEH841221234', M.izq, A4.h - M.abajo + 11);
doc.text('Tel. (55) 5999 9200  ·  www.vonhaucke.mx', M.izq, A4.h - M.abajo + 14.5);
```
(El RFC y el domicilio salen de `226030018 12 mayo 2026.pdf`, pie de página.)

---

## 3. 🔴 El nombre del cliente se ENCIMA con el folio en la portada

**Qué está mal.** El título "Preparada para {cliente}" se parte en dos renglones pero la
`y` sólo avanza uno. El segundo renglón cae encima de la línea de folio/fecha y queda un
borrón ilegible — en la portada, en el renglón que lleva el nombre del cliente.

**Dónde.** `src/datos/pdfPropuesta.js:70-72`.

```js
doc.text(cot.cliente ? `Preparada para ${cot.cliente}` : '…', M.izq, y, { maxWidth: ANCHO });
y += 9;    // ← 9 mm fijos, aunque el título haya usado dos o tres renglones
```

**Cómo lo reproduje.** Cliente = `Corporativo de prueba, S.A. de C.V.` (el que trae el
fixture de humo). `node scratchpad/gen-pdf-audit.mjs 40 10 propuesta-desc40.pdf` y ver
`audit-p1.png`: "C.V." queda escrito encima de "Folio 2608-001".

**Por qué importa.** Dispara con cualquier razón social de más de ~30 caracteres, o sea con
prácticamente todas las de México: cualquier cosa que termine en "S.A. de C.V." o
"S.A.P.I. de C.V." lo rompe. Es lo primero que ve el cliente y lleva su propio nombre mal
impreso. Ese documento no se puede mandar.

**El arreglo propuesto.**
```js
doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(...TINTA);
const tit = doc.splitTextToSize(
  cot.cliente ? `Preparada para ${cot.cliente}` : 'Propuesta para su proyecto', ANCHO);
doc.text(tit, M.izq, y);
y += tit.length * 8 + 1;      // 21 pt ≈ 7.4 mm de interlínea, con aire
```

---

## 4. 🟠 "Sin ubicar en el plano" se imprime al cliente, con un importe grande al lado

**Qué está mal.** Cuando el acomodo coloca sólo una parte de las piezas, el resumen por
área agrega un bloque titulado literalmente **"Sin ubicar en el plano"** con todo lo demás
adentro, y ese bloque se imprime en el documento del cliente.

**Dónde.** `src/datos/resumen.js:97` (`nombre: 'Sin ubicar en el plano'`), impreso desde
`src/componentes/Cotizacion.jsx:362-369` y `src/datos/pdfPropuesta.js:92-95`.

**Cómo lo reproduje.** `node scratchpad/area.mjs` — un acomodo que coloca 6 de 17 piezas.
Página 1 de `area.pdf`:
```
Sala operativa            $88,802
Dirección                 $44,496
Sin ubicar en el plano    $94,804   ← el 41% del proyecto
```

**Por qué importa.** Un director administrativo lee "Sin ubicar en el plano" y entiende
"no saben dónde va casi la mitad de lo que me están vendiendo". Suena a error del
proveedor. Y no lo es: son gavetas rodantes, sillones y cosas que no piden piso. La app ya
tiene un comentario en `resumen.js` explicando que se muestra a propósito para que los
totales sumen — la intención es correcta, el rótulo es el que mata.

**El arreglo propuesto.** Dejar el nombre interno para "Mis números" y darle un nombre de
cara al cliente. En `resumen.js:96-99`:
```js
bloques.push({
  nombre: 'Sin ubicar en el plano',                 // interno, para el vendedor
  nombreCliente: 'Complementos y mobiliario adicional',
  tipo: null, m2: 0, renglones: …, total: …, sinUbicar: true,
});
```
y en los dos puntos de impresión usar `b.nombreCliente || b.nombre`.

---

## 5. 🟠 El descuento no tiene tope: con 200% sale una propuesta con TOTAL NEGATIVO

**Qué está mal.** El campo "Descuento de proyecto (%)" dice `max="60"`, pero en un
`<input type="number">` eso no impide teclear otra cosa, y el `onChange` no acota nada.

**Dónde.** `src/componentes/Cotizacion.jsx:297`.
```js
onChange={(e) => setCot({ descuentoPct: parseFloat(e.target.value) || 0 })}
```

**Cómo lo reproduje.** `node scratchpad/gen-pdf-audit.mjs 200 0 propuesta-neg.pdf`.
Portada del PDF:
```
Precio de lista   $228,102
Descuento 200%   -$456,204
Subtotal         -$228,102
IVA 16%           -$36,496
TOTAL            -$264,598
```

**Por qué importa.** Un cero de más en el celular, con el pulgar, y el vendedor descarga y
manda una propuesta que le debe dinero al cliente. No truena nada, no avisa nada: baja el
PDF tan tranquilo. El daño es reputacional inmediato.

**El arreglo propuesto.**
```js
onChange={(e) => setCot({
  descuentoPct: Math.min(60, Math.max(0, parseFloat(e.target.value) || 0)),
})}
```
Lo mismo para contingencia en `Cotizacion.jsx:302` (`Math.min(50, …)`).

---

## 6. 🟠 El descuento cae también sobre la SILLERÍA, y ahí no avisa nada

**Qué está mal.** El descuento de proyecto es uno solo y se aplica a todas las partidas por
igual. En Von Haucke el 40% es sobre **mobiliario**; la sillería va sin descuento porque es
comprada-revendida. Además, sobre las partidas del banco de precios **ningún semáforo se
enciende**.

**Dónde.** `src/componentes/Cotizacion.jsx:134-154`. En particular:
```js
const conCosto = partidas.filter((p) => p.costoUnitario > 0 && !p.deBanco);  // :152
const markupPartida = (pt) => (pt.costoUnitario > 0 ? … : null);             // :149
```
Y las partidas del banco entran con `costoUnitario: 0, margen: null, deBanco: true`
(`src/App.jsx:501`). Resultado: `bajoPiso()` siempre da `false`, `nBajoPiso` da 0, y si la
propuesta es toda de banco `descuentoMax` queda en `null` — no hay alerta roja ni botón
"Máx. rentable".

**Cómo lo reproduje.** Contrasté los precios del banco contra el papel:
```
$5,900  p9-silla-operativa-win-cab-5900   ← 226030018 pág. 5: SILLA OPERATIVA 5,900, sin Desc.
$5,210  p9-silla-operativa-win-5210       ← 226030018 pág. 14: 5,210, sin Desc.
$4,220  p9-silla-de-visita-esp-ohv-368    ← 226030018 pág. 5: 4,220, sin Desc.
$3,353  p9-banco-re571c-2012              ← 226030018 pág. 4: 3,353, sin Desc.
```
Los del banco son precios **finales**. Y los módulos del banco también vienen ya netos:
`p9-app-lt-escritorio-gerencial-7536` guarda **7,536**, que es el 12,560 del papel ya con
su 40% aplicado. Todo el banco (218 piezas) está en precio de venta final.

**Por qué importa.** El vendedor lleva años viendo "(-) Descuento Especial 40%" en cada
presupuesto. Encuentra un campo llamado "Descuento de proyecto (%)" y escribe 40. Sobre
los módulos el 40% se aplicaría **por segunda vez**; sobre la sillería se aplica un
descuento que Von Haucke nunca da. En el proyecto real 226030018 la sillería es **$306,366**;
al 40% se vuelve $183,820. **$122,546 tirados en un solo proyecto**, sin una sola alerta en
pantalla.

**El arreglo propuesto.** Dos cosas, la primera urgente:
```js
// 1) que el semáforo cubra al banco: una partida sin costo conocido tampoco
//    debe poder descontarse a ciegas.
const sinRespaldo = (pt) => !(pt.costoUnitario > 0);
const nSinRespaldo = partidas.filter(sinRespaldo).length;
// …y mostrar, cuando descuentoPct > 0 && nSinRespaldo > 0:
//   "N partida(s) traen precio cerrado de un presupuesto real (sillería y banco de
//    precios). En Von Haucke ésas NO llevan descuento de proyecto. Confírmalo antes de
//    mandar la propuesta."

// 2) marcar la partida como no descontable y respetarlo en los totales:
const descontable = (pt) => !pt.deBanco;      // sillería y banco = precio cerrado
const precioLista = partidas.reduce((a,p)=> a + p.precioUnitario * p.cantidad, 0);
const baseDescuento = partidas.filter(descontable)
  .reduce((a,p)=> a + p.precioUnitario * p.cantidad, 0);
const descuento = baseDescuento * (descuentoPct / 100);
```
Con eso el documento del cliente queda igual que el papel real, donde el descuento se
calcula sólo sobre el subtotal de mobiliario.

---

## 7. 🟠 Una viñeta del PDF afirma algo falso —y aparece aunque no haya áreas

**Qué está mal.** Al pie del detalle se imprime siempre:
> *"Los importes por área son informativos y suman el total de la propuesta."*

Ni suman el total (suman el precio antes de descuento e IVA), ni hay sección de áreas en
la mayoría de las propuestas.

**Dónde.** `src/datos/pdfPropuesta.js:213`.

**Cómo lo reproduje.** `propuesta-desc40.pdf` no tiene sección de áreas y aun así trae la
viñeta (pág. 2). En `area.pdf`, que sí la tiene, los importes por área suman $228,102 y el
TOTAL dice $158,759.

**Por qué importa.** Es la única frase del documento que le pide al cliente que confíe en
una suma, y es comprobablemente falsa. Un cliente que la revise pierde la confianza en todo
lo demás.

**El arreglo propuesto.**
```js
const cond = [ 'Precios en pesos mexicanos. Vigencia de 15 días hábiles.',
               'Tiempo de entrega a convenir según disponibilidad de materiales.' ];
if (hayAreas) cond.push('Los importes por área ya incluyen el descuento y suman el subtotal del proyecto.');
```
(la variable `hayAreas` ya existe, línea 86 — sólo hay que subirla de alcance).

---

## 8. 🟡 Faltan renglones que TODO presupuesto real de Von Haucke trae

Comparando contra `226030018 12 mayo 2026.pdf` y `MODULO APP LT 4U (2).pdf`, al documento
de la app le falta:

| Falta | Dónde está en el papel real | Qué pasa si falta |
|---|---|---|
| **Maniobras / instalación como partida** | pág. 1: `Subtotal Proyecto Maniobras $80,360` — el **10.8%** del proyecto | El cliente firma un total y después le llega un cargo del 10%. Es la discusión más cara que existe. La app sólo dice "Instalación y maniobras por separado" en letra chica |
| **"Imágenes representativas"** | en el pie de cada hoja de detalle | Las fotos de la app son **renders de IA** (`storage/…/render-ia/…`). Enseñar imágenes generadas sin ese aviso es un problema legal y comercial |
| **Garantía** | `GARANTÍA TIPO 1`, `GARANTÍA TIPO 5` por partida | 68 años de oficio y no dice cuánta garantía da |
| **Asesor / quién firma la propuesta** | `Asesor: ZAIDA AVENDAÑO` en cada hoja | El cliente no sabe a quién llamar |
| **RFC y domicilio fiscal** | `Calle 3 N° 57, Col. Agrícola Pantitlán… RFC AEH841221234` | No se puede convertir en orden de compra |
| **Condiciones de pago detalladas** | pág. 2: 10 cláusulas (almacenaje 5%, refacturación 2.5%, aviso de 5 días…) | La app tiene un párrafo; el papel tiene una página |

**El arreglo propuesto.** Lo mínimo viable para no perder dinero son dos: (a) un renglón
editable de **Maniobras e instalación** que entre al subtotal antes del IVA —igual que el
papel—, y (b) la leyenda **"Imágenes representativas"** al pie de la hoja de detalle,
una línea en `pdfPropuesta.js`.

---

## 9. 🟡 El cliente nunca ve el 40% que se le está dando

**Qué está mal.** Con el default (`descuentoPorcentaje: 0`, `src/motor/calculo.js:60`) el
bloque de totales imprime dos renglones idénticos, pegados:
```
Precio de lista   $228,102
Subtotal          $228,102
```

**Dónde.** `src/componentes/Cotizacion.jsx:435-437` y `src/datos/pdfPropuesta.js:136-137`.

**Cómo lo reproduje.** Vista cliente en `humo.html` (parámetros por default), y
`propuesta-desc0.pdf`.

**Por qué importa.** Dos cosas. Una cosmética: repetir el mismo número dos veces parece
error de captura. La otra vale dinero: el precio que sale de la app **ya trae el 40%
aplicado** (`preciosVenta.js:27`, `precioDeLista(precio2) = precio2 × 0.60`), pero el
documento no lo dice en ninguna parte. Todo cliente que ya le ha comprado a Von Haucke
está acostumbrado a ver `(-) Descuento Especial 40%` en letras grandes. Al no verlo,
concluye que no le dieron descuento — y lo pide **encima** del precio que ya lo trae.
Se está regalando la concesión más grande de la casa sin cobrarla en la negociación.

**El arreglo propuesto.** Que el documento muestre la concesión que ya se hizo, como el
papel real. En el bloque de totales:
```js
// El precio unitario ya viene neto (precioDeLista = precio2 × 0.60). Se reconstruye
// el bruto para poder ENSEÑAR el descuento, que es el argumento de venta.
const bruto = precioLista / (1 - DESCUENTO_PRECIO2);   // ÷ 0.60
<div className="propx-tot-row"><span>Importe de lista</span><b>{pesos(bruto)}</b></div>
<div className="propx-tot-row"><span>Descuento especial {DESCUENTO_PRECIO2*100}%</span>
     <b className="rojo">− {pesos(bruto - precioLista)}</b></div>
<div className="propx-tot-row"><span>Subtotal</span><b>{pesos(precioLista)}</b></div>
```
y si además hay descuento de proyecto, va como segundo renglón. Si no se quiere tocar la
aritmética, lo mínimo es **no imprimir "Precio de lista" cuando el descuento es 0** y
dejar sólo "Subtotal".

---

## 10. 🟡 Jerga de taller filtrándose al documento del cliente

Lo bueno primero: **no se filtra nada grave**. Revisé el texto renderizado del PDF y de la
vista cliente y **no aparece** ninguna clave de fábrica (`ATCUBD45ABS`), ni "precio 2", ni
"price-book", ni "despiece", ni "merma", ni "markup", ni los sellos Firme/Calibrado/
Estimado. Lo que sí queda:

| Texto que ve el cliente | Problema | Dónde |
|---|---|---|
| `Contingencia 10%` | Es un colchón interno. El cliente lee "me están cobrando por si acaso" y lo primero que pide es quitarlo. Ningún presupuesto real trae esta línea | `Cotizacion.jsx:438`, `pdfPropuesta.js:138` |
| `mano Derecha` | Jerga de fabricante. Un director administrativo no sabe qué es | nombres generados, `datos/eclipse.js` |
| `ocupa 7.50 × 1.20 m` | Se confunde con la medida del mueble | generadores de línea |
| `Melamina y canto ABS` | Correcto pero sin traducción. El papel real escribe el párrafo completo: *"CUBIERTAS EN MELAMINA ABS, SOPORTERÍA METÁLICA"* | generadores |
| `Precios en pesos mexicanos más IVA` justo debajo de un TOTAL **que ya incluye IVA** | Contradicción directa. El cliente no sabe si le van a sumar otro 16% | `Cotizacion.jsx:448` |
| `Flete en CDMX/área metropolitana 3%` | Contradice el papel real, que dice que **los precios ya consideran** entrega en el área metropolitana (`226030018` pág. 2) | `Cotizacion.jsx:448` |

**El arreglo propuesto.** Renombrar `Contingencia` a **"Ajuste por fabricación a la
medida"** o, mejor, no imprimirlo como renglón y repartirlo en los unitarios. Cambiar
*"más IVA"* por *"El total indicado ya incluye IVA."* y alinear el texto de flete con el
papel: *"Los precios consideran entrega en el área metropolitana de la Ciudad de México;
foráneo se cotiza por evento."*

---

## 11. 🟡 `especificacion()` recorta el nombre en el primer "·" y deja "1 × Alba"

**Qué está mal.** La línea de especificación de cada área parte el nombre en el primer
punto medio. Como varias líneas empiezan con la marca (`Alba · Mesa de juntas 3.60 m`,
`Modulor · Archivero horizontal…`), al cliente le queda "1 × Alba" y "2 × Modulor" —
nombres de línea internos, sin producto.

**Dónde.** `src/datos/resumen.js:129`.
```js
.map((r) => `${r.cantidad} × ${r.nombre.split('·')[0].trim()}`)
```

**Cómo lo reproduje.** `node scratchpad/area.mjs`. La especificación del área "Sin ubicar"
sale como:
`1 × Eclipse Escritorio Directivo 2.10 m · 1 × Alba · 1 × Eclipse Credenza baja 2.10 × 0.60 m · y 2 más`
— inconsistente: Eclipse sobrevive entero (su nombre no empieza con marca), Alba se queda
en la marca sola.

**Por qué importa.** Es la línea que Rodrigo pidió expresamente para que el cliente
entienda qué hay en cada área. "1 × Alba" no le dice nada a nadie. Y como es el resumen,
es lo que el cliente lee primero.

**El arreglo propuesto.**
```js
// Si el primer trozo es la marca (una o dos palabras), se lleva también el segundo:
// "Alba · Mesa de juntas 3.60 m" -> "Alba Mesa de juntas 3.60 m", no "Alba".
const corto = (n) => {
  const p = String(n).split('·').map((s) => s.trim()).filter(Boolean);
  if (p.length > 1 && p[0].split(/\s+/).length <= 2) return `${p[0]} ${p[1]}`;
  return p[0] || String(n);
};
…
.map((r) => `${r.cantidad} × ${corto(r.nombre)}`)
```

---

## 12. 🟢 Menores, para la lista larga

- **Cantidad 0 genera una propuesta de $0 y se descarga sin chistar.**
  `node scratchpad/edge.mjs` → `edge-cero.pdf`: renglón con `0 · $41,439 · $0` y
  `TOTAL $0`. No truena; simplemente sale un documento absurdo. Vale una validación en
  `descargarPDF()` (`Cotizacion.jsx:96`): si `nPzas === 0`, avisar y no bajar el archivo.
- **El render no corresponde a la configuración.** La "Banca doble APP LT · 10 usuarios"
  usa el render genérico del producto, que muestra un bench de 4. Ver `confoto-p2.png`.
  El cliente cuenta los lugares.
- **Portada con el 60% de la hoja en blanco.** Ver `audit-p1.png`. Con 6 partidas el PDF
  son 2 hojas con la mitad vacía cada una. El papel real de un proyecto equivalente son
  15 hojas. Cabe subir la sección de condiciones a la hoja 1.
- **La columna "IMAGEN" se imprime aunque no haya imágenes.** `cargarFotos()` se traga
  los errores en silencio (`pdfPropuesta.js:240`), así que si falla la descarga el
  encabezado queda sobre una columna vacía. Vale ocultar el encabezado cuando
  `Object.keys(fotos).length === 0`.

---

## ✅ Lo que está BIEN y NO hay que tocar

1. **Los sellos ya NO salen en el documento del cliente.** Lo verifiqué en los dos
   caminos: `Cotizacion.jsx:402-406` los quitó de la vista cliente y `pdfPropuesta.js`
   nunca los imprimió. La preocupación de "ESTIMADO · sujeto a confirmación" debilitando
   la venta **ya está resuelta**. Siguen visibles en "Mis números", que es donde sirven.
2. **La hoja de detalle con fotos se ve de verdad premium.** Ver `confoto-p2.png`: los
   renders entran limpios, sin deformar, con la fila pareja. Es la mejor parte del
   documento y compite bien contra el papel real, que no trae fotos ordenadas así.
3. **Los nombres larguísimos NO rompen nada.** Probé una descripción de 240 caracteres
   (`edge-largo.pdf`): parte en 7 renglones, la fila crece, no desborda.
4. **40 partidas paginan bien.** `edge-40.pdf`: 4 hojas, encabezado repetido en cada una,
   ningún renglón partido a la mitad. La función `sitio()` hace su trabajo.
5. **Las fotos SÍ llegan al PDF.** Verifiqué la descarga real desde Supabase con CORS
   (`node scratchpad/foto.mjs`): 6 de 6 imágenes, 6 objetos de imagen en la hoja 2.
6. **48 de 48 pantallas montan.** Ninguna truena.
7. **El estado vacío está bien resuelto** (`Cotizacion.jsx:193-205`): no enseña una
   propuesta rota, invita a agregar muebles.
8. **El CSS de impresión está bien pensado**: fuerza la vista cliente aunque el vendedor
   esté en "Mis números", cambia tarjetas de celular por tabla, y hay un breakpoint real
   de 480 px para el celular (`estilos.css:845-853`). La propuesta se lee en teléfono.
9. **El nombre del archivo descargado es correcto** (`Propuesta 2608-001 Cliente.pdf`), y
   el botón sí descarga en vez de abrir el diálogo de impresión.
10. **La etiqueta "Precio de lista" es correcta**: el `precioUnitario` de la app ya es el
    precio de lista neto (`preciosVenta.js:27`). No es un error de nomenclatura.

---

## Orden sugerido de ataque

| # | Hallazgo | Esfuerzo | Riesgo si no se toca |
|---|---|---|---|
| 3 | Nombre del cliente encimado en portada | 5 min | El documento no se puede mandar |
| 5 | Descuento sin tope → total negativo | 5 min | Propuesta absurda al cliente |
| 7 | Viñeta falsa de importes por área | 5 min | Se pilla la mentira |
| 4 | "Sin ubicar en el plano" al cliente | 15 min | Suena a error del proveedor |
| 1 | El detalle no cuadra con el TOTAL | 1 h | Pierde credibilidad todo el documento |
| 11 | "1 × Alba" en la especificación | 15 min | El resumen no comunica |
| 6 | Descuento sobre sillería, sin aviso | 2 h | $122K en un solo proyecto |
| 2 | El PDF descargado ≠ el de pantalla | 2 h | No hay dónde firmar |
| 9 | El cliente no ve el 40% que se le dio | 1 h | Se pide descuento encima del descuento |
| 8 | Maniobras, garantía, "imágenes representativas" | 3 h | Cargo sorpresa del 10% |
| 10 | Jerga: contingencia, "más IVA", flete | 1 h | Fricción en la negociación |
