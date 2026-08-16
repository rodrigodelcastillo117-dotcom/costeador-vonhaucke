# Auditoría 2 de ESPECIALES — ¿ya se puede cotizar un producto a la medida?

**Quién audita:** Gerencia de Productos Especiales.
**Qué se probó:** los mismos 4 encargos de la auditoría anterior, de punta a punta, contra el motor real.
**Cómo:** motor real en Node (`scratchpad/aud2_guardar.mjs`, `scratchpad/aud2_wand.mjs`, `scratchpad/especiales_prueba.mjs`) · almacén real con `localStorage` simulado · `humo.html` y un banco propio (`scratchpad/aud2.html`) · anclas del ERP (`mp_erp_ultima_compra.csv`, 11,101 artículos) · presupuesto real **226050048** (cancelería Wand) extraído del PDF.
**No se tocó `src/`. No se corrió `deploy.sh`.**

---

## Veredicto en una línea

**Se arregló medio hallazgo #1 y apareció uno más grande.** Guardar un especial ya no truena y sobrevive la recarga — pero **nadie lee lo guardado**, así que sigue sin poder reabrirse ni clonarse. Y al comparar contra el presupuesto real de cancelería descubrí que **los precios de especialidad no están sólo bajos: están descalibrados en las dos direcciones**. El mármol va 4–5× **abajo** (regalas el mueble) y la cancelería de cristal va 1.8× **arriba** (pierdes el trabajo). El mismo motor, el mismo día, con los mismos 103 insumos.

### Las 4 lentes

| | Recepción curva | Muro cancelería | Mostrador retail | Mesa juntas mármol |
|---|---|---|---|---|
| **¿Truena?** | No | No | No | No — **ya no truena al guardar** ✅ |
| **¿Sirve? (llega a un precio)** | Sí, $25,900 | Sí, $74,127 | Sí, $10,616 | Sí, $70,951 |
| **¿Es creíble? ¿lo firmo?** | **No** — sigue sin cuarzo | **No** — 1.8× ARRIBA del precio real | **No** — el LED sigue costando $0 | **No** — mármol 4× bajo, inox 15.7× bajo |
| **¿Mejorable?** | H3 | H2/H4/H6 | H3 | H2/H5 |

### Lo que se arregló hoy — **CONFIRMADO** ✅ (a medias)

Corrida real (`node scratchpad/aud2_guardar.mjs`), con el almacén de verdad:

```
=== PASO 2 · costear y GUARDAR (lógica literal de App.jsx:461) ===
costo unitario = $5,166
guardarPieza NO tronó. id=pieza_1
¿el botón de guardar ya sirve? SI

=== PASO 3 · RECARGAR la app (cargar() otra vez, del localStorage) ===
piezas tras recargar: 4 (antes de guardar: 3)
¿sobrevivió la recarga? SI  -> ["Mostrador retail 2.40 m con vitrina y LED"]
¿trae su despiece completo? SI (5 componentes)

=== PASO 4 · ¿se puede volver a ABRIR? ===
¿el especial guardado aparece en el Catálogo? ** NO **
```

**Guarda ✅ · sobrevive la recarga ✅ · se puede reabrir ❌ · se puede clonar ❌.**
El mensaje "No perdiste nada" ya es cierto. Pero el especial cae en un pozo: se guarda y nadie lo vuelve a ver. **Ése sigue siendo el hallazgo #1.**

---

# HALLAZGOS — de más a menos grave

---

## H1 · El especial se guarda, pero NADIE lo lee. No se puede reabrir ni clonar.

**Qué falta:** un **lector** de `estado.piezas`. El escritor ya existe y funciona; el lector no existe en ninguna pantalla.

**Dónde:**
- `src/App.jsx:461-471` — `onGuardarPieza`, **ya arreglado**, escribe bien al objeto.
- `src/almacen.js:57` y `:129` — `piezas: { ...base.piezas, ...(guardado.piezas || {}) }` → persiste bien.
- `src/componentes/Catalogo.jsx:8` — `import { PIEZAS_SEMILLA } from '../datos/piezas.js'` — **la única fuente del catálogo son las 3 recetas fijas del código.**
- `src/componentes/Catalogo.jsx:15` — `recetaDe()` → `PIEZAS_SEMILLA.find(...)`. Nunca mira `estado.piezas`.
- `src/componentes/Tablero.jsx:19` — lee `estado.historial`, que es otra colección.

Barrido completo de quién toca `estado.piezas` en toda la app:

```
src/almacen.js:57    piezas: { ...base.piezas, ... }      <- relleno
src/almacen.js:129   piezas: { ...base.piezas, ... }      <- relleno
src/App.jsx:120      piezas: estado.piezas                <- sube a la nube
src/App.jsx:144      if (datos.piezas) nuevo.piezas = ... <- baja de la nube
src/App.jsx:468      setEstado(... piezas: {...} )        <- ESCRIBE
```

**Cinco usos. Ninguno es un lector de pantalla.** Y `grep -rni "clonar|duplicar"` sobre `src/**/*.jsx` no devuelve un solo botón: los aciertos son todos de "copiar el detalle del error".

**Dónde me atoré:** encargo 3 (mostrador retail). Lo costeé, le di **"Guardar como pieza"** — salió el aviso *"Guardada la pieza"*, recargué, y la pieza sigue en `localStorage` (lo verifiqué: 4 piezas donde había 3). Fui al **Catálogo** a buscarla para hacer el encargo 1 a partir de ella. **No está.** Busqué en las 4 familias y con el buscador. No hay ninguna pantalla donde salga. Tuve que volver a teclear el despiece completo desde cero.

**Encima no queda marcada como especial** — al guardar se pierde de qué tipo era:

```
campos guardados: piezaId, nombre, linea, piezas, componentes, modoManoObra,
                  factorDirecta, factorIndirecta, preparacionHoras, margen, horas,
                  id, costoUnitario
esEspecial = undefined      guardadaEl = undefined
```

**Cuánto negocio queda fuera:** el 80% de un encargo nuevo de especiales es un encargo viejo con otra medida. Hoy **el 100% se re-teclea**. Una recepción curva de marzo no existe en abril. Para un proyectista de 50+ años, armar 8 componentes con medidas en un desplegable de 103 materiales sin buscador es media hora; hacerlo cada vez es la razón por la que la app no se va a usar para especiales.

**Parche — NO aplicado.** Dos piezas.

1. Marcar la pieza al guardar (`src/App.jsx:463`):

```js
const pieza = {
  ...costeo, id, piezaId: id,
  esEspecial: !costeo.linea,                       // las de línea traen .linea
  guardadaEl: new Date().toISOString().slice(0, 10),
  costoUnitario: resultado?.costoUnitario ?? null,
};
```

2. El lector que falta, arriba del paso 1 del Catálogo (`src/componentes/Catalogo.jsx:78`, antes de `<h2>Catálogo</h2>`):

```jsx
{(() => {
  const mios = Object.values(estado.piezas || {})
    .filter((p) => p.esEspecial || (!p.linea && p.componentes?.length))
    .filter((p) => coincide(busca, p.nombre));
  if (!mios.length) return null;
  return (
    <>
      <h2>Mis muebles a la medida</h2>
      <p className="ayuda">Los que tú has costeado. Ábrelos tal cual, o haz una copia y cámbiale las medidas.</p>
      {mios.map((p) => (
        <div className="tarjeta" key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <strong>{p.nombre || 'Sin nombre'}</strong>
            <div className="ayuda">{p.componentes?.length || 0} piezas · guardado {p.guardadaEl || 's/f'}</div>
          </div>
          {p.costoUnitario != null && <div className="dinero">{pesos(aMostrar(p.costoUnitario))}</div>}
          <button className="boton" onClick={() => onCargar({ ...p, piezaId: p.id })}>Abrir</button>
          <button className="boton primario"
            onClick={() => onCargar({ ...p, piezaId: null, id: undefined, nombre: (p.nombre || '') + ' (copia)' })}>
            Hacer una copia
          </button>
        </div>
      ))}
    </>
  );
})()}
```

*(`coincide` y `pesos` ya están importados en ese archivo, línea 12.)*

---

## H2 · Los precios de especialidad están descalibrados EN LAS DOS DIRECCIONES. Con unos regalas el mueble; con otros pierdes el trabajo.

Éste es el hallazgo nuevo y el más caro. La auditoría anterior encontró que el mármol estaba barato. Al comparar contra un presupuesto real de cancelería aparece la otra mitad: **hay insumos igual de mal, pero para arriba.**

**Qué falta:** que los insumos de especialidad tengan precio con fuente. **83 de los 103 no dicen de dónde salió su precio** (`fuente = NINGUNA`), y son justo los que usan los especiales.

**Dónde:** `src/datos/insumos.js` — `marmol:88`, `marmol-premium`, `inoxidable:120`, `cristal-templado`, `cristal-templado-12`, `acrilico`, `perfil-aluminio:127`. Todos sin `articulo` y sin `fuente`.

### El lado caro: la app se queda CORTA

| Insumo | App | ERP real | |
|---|---|---|---|
| `marmol` | $2,000/m² | `MDMACU01250212` cubierta 2100×900×20 → **$7,777/m²** | **3.9× bajo** |
| `marmol` | $2,000/m² | `MANMCU032824K4` cubierta canto ala de avión → **$10,032/m²** | **5.0× bajo** |
| `cristal-satinado` 9 mm | $2,130/m² | `MDCRCR02B90202` 1100×390 satinado templado → **$2,791/m²** | 1.3× bajo |

```
MESA DE JUNTAS 5 m — el efecto de un solo precio mal puesto
  con mármol a $2,000/m² (lo que trae la app): costo $35,475 → precio 50% $70,951
  con mármol a $7,777/m² (ancla ERP):          costo $80,767 → precio 50% $161,534
  DIFERENCIA: $90,583 que hoy la app NO cobra, en UN mueble.
```

### El lado nuevo: la app se pasa de CARA — y ahí pierdes el trabajo

Ancla dura, presupuesto **226050048** del 21/05/2026, agente Miguel Ángel Becerril:

> **PUERTA DE 1000 × 2400 × 60 mm MODELO "WAND"**, derecha, con cerradura y estructura metálica color negro, cristal transparente
> **P. Unitario $12,680.00 · Cantidad 4 · Subtotal $50,720.00**

La misma puerta, armada en la app con los insumos que sí existen hoy (`node scratchpad/aud2_wand.mjs`):

```
APP    costo unitario ........................  $11,180
       precio a 40% margen ...................  $18,633
       precio a 50% margen ...................  $22,359
REAL   P. Unitario de lista .................   $12,680

       LA APP SE PASA POR ...................   $9,679  (1.76x)
       En las 4 puertas del proyecto: ........  $38,718 de sobreprecio
```

**La app dice que el COSTO ($11,180) es el 88% del PRECIO DE VENTA real ($12,680).** O sea: según la app, esa puerta se vende con 12% de margen — debajo del mínimo de 40 — cuando Von Haucke la vende y gana.

El culpable está identificado. El desglose:

```
Cristal templado 12 mm   neto 2.4 m2   $6,960   <- 62% del costo, precio SIN FUENTE ($2,900/m2)
Perfil de aluminio       neto 6.8 m    $1,473
Silicón                  neto 2 pza      $360
Cerradura                neto 1 pza      $120
Bisagra                  neto 3 pza       $57
```

Y el cristal templado de 6 mm, que es el que lleva el muro entero del encargo 2, va igual de inflado:

```
ERP MDCRCR01120102 CRISTAL TRANSPARENTE 580x390 esp 6mm TEMPLADO cantos pulidos
    $240.01 (2026-06-25) / 0.2262 m2  =  $1,061/m2
APP cristal-templado-6  =  $1,575/m2   ->  1.48x ARRIBA
```

**Dónde me atoré:** encargo 2. Armé el muro, me salió **$74,127**, y no tenía con qué saber si eso era mucho o poco — hasta que abrí el presupuesto real. Ahí vi que la app cobra por **todo el muro de 14.4 m²** casi lo mismo por m² ($5,148) que Von Haucke cobra por **una sola puerta** ($5,283/m²). Suena razonable hasta que ves que la puerta de la app sola ya vale $22,359 contra $12,680 reales. **No hay forma, dentro de la app, de saber que vas 1.8× arriba.**

**Cuánto negocio queda fuera:** en las dos direcciones. En mármol, **$90,583 regalados en un mueble**. En cancelería, **$38,718 de sobreprecio en 4 puertas** — que no es dinero perdido, es *el trabajo* perdido: cotizas al doble y el cliente se va. En un proyecto Wand completo ($295,340) el error de escala es de **seis cifras**.

**Parche — NO aplicado.** El único parche honesto es **poner las anclas medidas y marcar lo no medido**:

```js
// src/datos/insumos.js:88
ins({ id: 'marmol', nombre: 'Marmol (cubierta terminada, 20 mm)', seccion: 'cubiertas',
  precio: 7777, clase: 'indirecta',
  articulo: 'MDMACU01250212 CUBIERTA RECTANGULAR 2100x900x20 mm CANTO ALA DE AVION',
  fuente: FUENTE_ERP,
  nota: 'Cubiertas terminadas del ERP 2026: $7,777-$10,032 el m2. Incluye corte, canto y chaflan.' }),

ins({ id: 'cristal-templado-6', nombre: 'Cristal templado claro 6 mm', seccion: 'cristal',
  precio: 1061, clase: 'indirecta',
  articulo: 'MDCRCR01120102 CRISTAL TRANSPARENTE 580x390x6 TEMPLADO CANTOS PULIDOS',
  fuente: FUENTE_ERP }),

ins({ id: 'cristal-templado-12', nombre: 'Cristal templado 12 mm', seccion: 'cristal',
  precio: 2900, clase: 'indirecta', fuente: null,
  nota: 'SIN MEDIR. No hay 12 mm en el ERP. Con este precio la puerta tipo Wand sale 1.76x ARRIBA '
      + 'del presupuesto real 226050048 ($12,680). RECOTIZAR antes de firmar.' }),
```

Y que la app **avise cuando el precio no está medido**, en vez de pintarlo igual que los buenos. En `Costeador.jsx`, junto al renglón:

```jsx
{ins && !ins.fuente && (
  <span className="etiqueta-dato supuesto" title="Este precio no está verificado contra una compra real">
    precio sin confirmar
  </span>
)}
```

Hoy 83 de 103 saldrían marcados. **Ése es exactamente el punto:** el proyectista tiene derecho a saber que 8 de cada 10 precios con los que está cotizando no los ha confirmado nadie.

---

## H3 · Siguen sin existir cuarzo, LED y cancelería — y la pieza sin material se sigue descartando EN SILENCIO.

**Confirmado, sin cambio desde la auditoría anterior.** Verificado contra el catálogo actual (103 insumos):

```
--- CUARZO      (NADA)
--- SILESTONE   (NADA)
--- LED         (NADA)
--- CANCEL      (NADA)
```

Y el descarte silencioso, medido en el encargo 3 (`node scratchpad/aud2_guardar.mjs`):

```
=== PASO 6 · la pieza SIN MATERIAL ===
componentes sin material: 1 -> ["Tira LED 5 m"]
costo CON el renglón de LED en la lista: $5,166
costo SIN el renglón de LED:             $5,166
diferencia: $0  -> el LED aporta CERO y nadie avisa
```

**Dónde:**
- `src/motor/calculo.js:316` — `if (!insumo) continue; // insumo desconocido: se ignora (la UI lo advierte)`. **Sigue mintiendo: la UI no lo advierte.**
- `src/componentes/Costeador.jsx:261` — `{ins && (...)}` sin `else`.
- `src/componentes/AsistenteEspecial.jsx:260` — idéntico.

**Dónde me atoré:** encargo 3, paso 2. Escribí "Tira LED 5 m", abrí el desplegable, busqué "led" entre las 103 opciones — **no está**. Dejé la pieza sin material porque el mostrador sí lleva luz. La app la muestra en la lista, sin campo de cantidad, sin importe, **sin una sola alerta**, y el precio final sale como si el mueble no tuviera iluminación. El renglón está en pantalla; el dinero no está en el total.

**Lo que sí existe en el ERP** (`node scripts/busca-mp.mjs`):

| Falta en la app | Artículo REAL del ERP | Costo | Equivale a |
|---|---|---|---|
| **Cuarzo** | `MVLSHJ05050000` HOJA ECOMÁRMOL SILESTONE ETERNAL SERENA 3170×1580×12 | $24,022 (2019) | **$4,796/m²** |
| Cuarzo terminado | `MACMCU064204G1` CUBIERTA PEBBLE 1000×625 EN ECOMÁRMOL SILESTONE | $4,002 (2019) | **$6,403/m²** |
| Ultracompacto | `MVLSHJ03060000` HOJA ECOMÁRMOL DEKTON 3200×1440×12 | $39,616 (2023) | **$8,597/m²** |
| **Kit LED** | `MDMEKT01000008` KIT ILUMINACIÓN 2 TIRAS LED 846 mm + 2 de 860 mm 2700 K | **$2,227.40** (2025) | por kit |
| Kit LED grande | `MDMEKT01000021` KIT ILUMINACIÓN PERIMETRAL CELOSÍA 2003×1002 | $5,495 (2026) | por kit |
| Perfil difusor | `MLEAPE162000U0` PERFIL ALUMINIO PARA TIRAS LED, Häfele 833.72.840, 2.5 m | $277.70 | **$111.08/m** |
| **Perfil cancelería** | `MLEAPE2328O711` PERFIL TUBULAR 3"×1"×6.10 m CAL. 16 ALUMINIO | $950 (2021) | **$155.74/m** |

> **Ojo con el nombre:** "cuarzo" aparece **0 veces** en los 11,101 artículos. Von Haucke lo compra como **ECOMÁRMOL SILESTONE / DEKTON**. Hay que darlo de alta con el nombre del ERP y poner "cuarzo" como sinónimo de búsqueda, o Compras no lo va a encontrar.

**Cuánto negocio queda fuera:** de las 7 especialidades de Von Haucke, **3 no tienen material base** — cancelería y muros, display/merchandising iluminado, y mostradores retail iluminados.

**Parche — NO aplicado.** La alerta primero (es la mitad barata y es la que evita el error silencioso), en `Costeador.jsx` después de la 259 y en `AsistenteEspecial.jsx` después de la 259:

```jsx
{!ins && (
  <div className="alerta roja" style={{ marginTop: 6 }}>
    <span className="texto">
      <strong>Esta pieza no tiene material</strong>, y por eso <strong>no está costando nada</strong>.
      Escoge de qué es, o quítala. Si el material que buscas no aparece en la lista,
      avísale a Dirección para darlo de alta — no la dejes así.
    </span>
  </div>
)}
```

Y los insumos (`src/datos/insumos.js`), con la fuente puesta:

```js
ins({ id: 'cuarzo-silestone', nombre: 'Ecomarmol SILESTONE / cuarzo (cubierta)', seccion: 'cubiertas',
  precio: 4796, clase: 'indirecta', fuente: FUENTE_ERP,
  articulo: 'MVLSHJ05050000 HOJA DE ECOMARMOL SILESTONE ETERNAL SERENA 3170x1580x12',
  nota: 'ULTIMA COMPRA 2019 — RECOTIZAR con Compras antes de firmar.' }),
ins({ id: 'dekton', nombre: 'Superficie ultracompacta DEKTON 12 mm', seccion: 'cubiertas',
  precio: 8597, clase: 'indirecta', fuente: FUENTE_ERP,
  articulo: 'MVLSHJ03060000 HOJA DE ECOMARMOL DEKTON 3200x1440x12' }),
ins({ id: 'kit-led', nombre: 'Kit de iluminacion LED (tiras + perfil + fuente + arnes)', seccion: 'electrico',
  precio: 2227.4, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_ERP,
  articulo: 'MDMEKT01000008 KIT DE ILUMINACION 2 TIRAS LED 846mm + 2 de 860mm 2700K' }),
ins({ id: 'perfil-led', nombre: 'Perfil de aluminio difusor para tira LED', seccion: 'electrico',
  precio: 111.08, unidad: 'm', clase: 'indirecta', fuente: FUENTE_ERP,
  articulo: 'MLEAPE162000U0 PERFIL PARA TIRAS LED HAFELE 833.72.840 (2.5 m)' }),
ins({ id: 'perfil-canceleria', nombre: 'Perfil tubular de aluminio 3" x 1" cal.16 (canceleria)',
  seccion: 'metal', precio: 155.74, unidad: 'm', formato: TRAMO6, mermaCorte: 5, fuente: FUENTE_ERP,
  articulo: 'MLEAPE2328O711 PERFIL TUBULAR 3x1x6.10 m CALIBRE 16 EN ALUMINIO',
  nota: 'ULTIMA COMPRA 2021 — recotizar.' }),
```

Y tres chips en la paleta del asistente (`AsistenteEspecial.jsx:36`), que hoy no tiene ninguno de los tres:

```js
{ label: 'Cubierta de piedra / cuarzo', material: 'cuarzo-silestone', kind: 'area', dims: [2000, 600] },
{ label: 'Iluminación LED',            material: 'kit-led',           kind: 'pza' },
{ label: 'Perfil de cancelería',       material: 'perfil-canceleria', kind: 'linear' },
```

---

## H4 · La cancelería real es un sistema COMPRADO, y la app sólo sabe fabricar.

**Hallazgo nuevo**, salido de comparar contra el presupuesto Wand.

**Qué falta:** una clase de insumo/partida **"comprado y revendido"**, con su utilidad propia.

**Dónde:**
- `src/datos/insumos.js` — el motor sólo conoce **dos clases**: `directa` (55 insumos) y `indirecta` (48). No hay una tercera.
- `src/motor/calculo.js:342-345` — la mano de obra sale de `materialDirecto × factorDirecta% + materialIndirecto × factorIndirecta%`, y los gastos de fábrica del 34% se calculan **sobre la MP directa**. Un sistema comprado entero no encaja en ninguna de las dos.
- Miguel y Rogelio ya lo habían dicho en el levantamiento: *"comprado-revendido con utilidad menor"*. Existe en la sillería del banco (`src/datos/banco.js:350`) y en `App.jsx:512`, **pero no para especiales.**

**La evidencia:** busqué **WAND** en los 11,101 artículos del ERP. **Cero resultados.** Lo que sí hay son gajos sueltos:

```
MDMAGC00010101  GAJO (CARA) PARA CANCEL 1603x627 esp 6mm con chaflán  $9,572.41 (2025-11-04)
```

O sea: la cancelería Wand **no se fabrica con perfil + cristal comprados a granel**; se compra como sistema. Pero la app me obligó a inventarla desde materia prima (5 paños de cristal + 28.8 m de perfil genérico + silicón + cerradura + bisagras), y por eso salió 1.8× arriba: le cargué 55% de mano de obra y 34% de gastos de fábrica **a un mueble que Von Haucke no fabrica.**

**Dónde me atoré:** encargo 2, paso 2. Busqué "cancelería", "cancel", "Wand" en el desplegable de 103 materiales. Nada. Terminé armando un muro con perfil de aluminio genérico marcado `// INCIERTO sin perfil exacto` (`insumos.js:127`) — un perfil que no tiene jambas, ni cabezal, ni zoclo, ni felpa. **El mueble que costeé no es el mueble que Von Haucke vende.**

**Cuánto negocio queda fuera:** cancelería es la especialidad más grande de las 7. El presupuesto 226050048 solo son **$295,340**. Toda esa línea hoy se cotiza fuera de la app, a mano.

**Parche — NO aplicado.** Es el más grande de los cuatro y no cabe en un `ins({...})`. La forma barata de empezar, sin tocar el motor:

```js
// src/datos/insumos.js — dar de alta los sistemas que se COMPRAN, por m2 de cancel
// armado, con clase 'indirecta' (no lleva fábrica) y merma 0.
ins({ id: 'cancel-wand', nombre: 'Cancel WAND armado (cristal + estructura metalica) — se compra',
  seccion: 'canceleria', precio: 0, unidad: 'm2', clase: 'indirecta', fuente: null,
  nota: 'PENDIENTE: pedir a Compras el costo por m2 del sistema Wand. El precio de VENTA '
      + 'de referencia es $244,620 por el cancel del presupuesto 226050048 (21/05/2026), '
      + 'y $12,680 por puerta de 1000x2400. NO cotizar armandolo desde perfil + cristal: '
      + 'asi sale 1.76x ARRIBA.' }),
```

Y a mediano plazo, la tercera clase (`clase: 'reventa'`) que en `calculo.js:342` no lleve factor de mano de obra ni el 34% de fábrica, y que en la cotización lleve su margen propio.

---

## H5 · La unidad sigue mintiendo: el campo dice "HOJA" y el motor cobra KILOS. 15.7× de subvaluación.

**Confirmado, sin cambio.** Medido hoy:

```
inoxidable: {"unidad":"hoja","precio":1930,
             "formato":{"tipo":"lamina","nombre":"lamina 1.22 x 2.44","medida":21.3},"fraccion":true}

  el usuario escribe  1 en el campo rotulado "CANTIDAD (HOJA)" -> material $113
  el usuario escribe  3 en el campo rotulado "CANTIDAD (HOJA)" -> material $340
  el usuario escribe 45 en el campo rotulado "CANTIDAD (HOJA)" -> material $5,097
  una HOJA de verdad cuesta ~$1,770 (ERP MVLSLA06270503)
```

**`1 hoja → $113` contra `$1,770` reales = 15.7× de subvaluación**, y el usuario escribió exactamente lo que el rótulo le pidió.

**Dónde:**
- `src/componentes/Costeador.jsx:279` — `<label>Cantidad ({ins.unidad})…` → imprime "hoja"
- `src/componentes/AsistenteEspecial.jsx:271` — idéntico
- `src/datos/insumos.js:120` — `unidad: 'hoja'` con `formato.medida = 21.3` (que son **kg**)
- `src/motor/calculo.js:221-233` — la rama `fraccion` divide `neto / (medida × aprovechamiento)` tratando `neto` como kg
- `src/componentes/Costeador.jsx:330-332` — la lista de compra imprime `neto {c.neto} {ins.unidad}` → repite la mentira, y `{c.unidades}` sin redondear (17 decimales)

**Dónde me atoré:** encargo 4, al declarar la base de inoxidable de la mesa de juntas. El campo decía **"CANTIDAD (HOJA)"**, escribí **3** (tres hojas), y me cobró **$340**. Tres hojas de inox son **$5,310**. Para que el número saliera bien tuve que escribir **45** — que son los kilos. Ningún proyectista va a convertir hojas a kilos de cabeza, y si lo hace, lo hace mal.

Además `esArea()` (`Costeador.jsx:120`, `AsistenteEspecial.jsx:80`) sólo acepta `formato.tipo === 'tablero'` o `unidad === 'm2'`. Las láminas son `tipo: 'lamina'` → **no se pueden declarar por largo × ancho**, que es la única medida que un proyectista realmente conoce.

**Cuánto negocio queda fuera:** en el encargo 4, la base de inox es el segundo renglón más caro. $340 en vez de $5,310. En cualquier mueble con estructura metálica a la vista —recepciones, mesas de juntas, mostradores— el error es del mismo orden.

**Parche — NO aplicado.** Tres piezas:

```js
// 1) src/datos/insumos.js:120 — decir la verdad y traer el precio real
ins({ id: 'inoxidable', nombre: 'Acero inoxidable 304 cal. 20 satinado', seccion: 'metal',
  precio: 1770, unidad: 'kg', formato: { ...LAMINA20, medida: 27.1, nombre: 'lamina 4 x 10' },
  fraccion: true, mermaCorte: 8, fuente: FUENTE_ERP,
  articulo: 'MVLSLA06270503 LAMINA INOXIDABLE HOJA 4x10 CAL 20 SATINADO P3 T-304' }),
```

```jsx
// 2) Costeador.jsx:279 y AsistenteEspecial.jsx:271 — rotular la unidad que el MOTOR consume
const unidadCaptura = (ins) =>
  ins.formato && ins.fraccion ? (ins.formato.tipo === 'lamina' ? 'kg' : 'm²') : ins.unidad;
// …
<label>Cantidad ({unidadCaptura(ins)})<input type="number" … /></label>
{ins.formato && ins.fraccion && (
  <div className="ayuda">Se compra por {ins.formato.nombre} — {ins.formato.medida} {unidadCaptura(ins)} cada una.</div>
)}
```

```jsx
// 3) Costeador.jsx:332 — la lista de compra, sin 17 decimales
→ comprar {c.unidades < 1 ? c.unidades.toFixed(2) : Math.ceil(c.unidades)} {fmt?.corto || 'u'}
```

---

## H6 · Sigue sin existir el renglón de MANIOBRAS / instalación. El presupuesto real lo trae, en la misma hoja.

**Confirmado.** Extraído hoy del PDF `226050048.pdf`, página 1, textual:

```
Subtotal Proyecto Mobiliario:   $295,340.00
Subtotal Proyecto Maniobras:      $8,861.00      <- 3.0%
Suma Importe Proyecto           $304,201.00
(+) IVA 16%                      $48,672.16
Total Proyecto                  $352,873.16
SE COTIZAN MANIOBRAS LOCALES EN HORARIO HÁBIL
```

**Es un renglón propio, con su subtotal, antes del IVA.** La app no lo tiene.

| Presupuesto | Mobiliario | **Maniobras** | % |
|---|---|---|---|
| `226050048` — **cancelería Wand** | $295,340 | **$8,861** | **3.0%** |
| `226050047` | $230,140 | $6,905 | 3.0% |
| `226010047` | $69,680 | $2,100 | 3.0% |
| `226030018` — **recepción + sala de juntas** | $665,271 | **$80,360** | **12.1%** |

El 3% clavado en tres presupuestos de línea. **Y el único con obra a la medida va al 12.1%** — cuatro veces más.

**Dónde:**
- `src/componentes/Cotizacion.jsx:134-142` — la cadena de totales completa: `lista → descuento → contingencia → IVA`. No hay maniobras.
- `src/componentes/Cotizacion.jsx:448` — el 3% aparece sólo en prosa: *"Instalación y maniobras por separado."*
- `src/componentes/FichaPDF.jsx:159` — misma prosa
- `src/datos/pdfPropuesta.js:138` — el PDF ya sabe imprimir un renglón extra (contingencia); falta el de maniobras

**Dónde me atoré:** encargo 2. Un muro de cancelería de 6 m **se instala en obra** — es la mitad del trabajo. La app me dio $74,127 de mueble y **cero pesos de instalación**, y luego imprimió "Instalación y maniobras por separado" sin decir cuánto. El vendedor tiene que acordarse de agregarlo a mano, fuera de la app.

**Cuánto negocio queda fuera:** en el encargo 2, entre $2,224 (3%) y $8,895 (12%). En un proyecto de cancelería de $300,000, entre **$9,000 y $36,000**.

**Parche — NO aplicado:**

```js
// src/motor/calculo.js:61 — junto a contingenciaPorcentaje
maniobrasPorcentaje: 3,   // % sobre subtotal, CDMX area metropolitana (4 presupuestos reales).
                          // Obra a la medida (recepciones, canceleria, muros) va a 12% — 226030018.
```

```jsx
// src/componentes/Cotizacion.jsx:138 — un renglón, entre contingencia e IVA
const maniobrasPct = cot.maniobrasPct ?? estado.parametros.maniobrasPorcentaje ?? 3;
const maniobras    = subtotal * (maniobrasPct / 100);
const baseGravable = subtotal + contingencia + maniobras;
```

…y su renglón visible junto al de contingencia (`Cotizacion.jsx:438`) y en `pdfPropuesta.js:138`, con el aviso cuando la propuesta trae partidas de especial: *"Este proyecto lleva obra a la medida. En proyectos así las maniobras han ido al 12%, no al 3%."*

---

## H7 · Los renglones en dólares se siguen mostrando SIN convertir: $167 arriba, $2,923 abajo.

**Confirmado, sin cambio.** El motor convierte USD→MXN con `precioDeInsumo` (`calculo.js:175`), pero **el subtotal por renglón que ve el usuario lee `ins.precio` crudo.**

**Dónde:**
- `src/componentes/Costeador.jsx:145` — `const precio = ins.precio ?? ins.precioBase ?? 0;`
- `src/componentes/Costeador.jsx:184` — lo mismo en la sugerencia de medida
- `src/componentes/AsistenteEspecial.jsx:102` — `const p = ins.precio ?? ins.precioBase ?? 0;`
- Afectados: `caja-byrne` (167 USD) y `pintura-polvo` (6.69 USD)

Verificado hoy en el catálogo:

```
caja-byrne   Caja electrica Byrne 4 puertos   $167/pza    <- lo que se ve en el renglón
             …y el motor cobra                $2,923/pza  <- lo que entra al total
```

**Dónde me atoré:** encargo 4, paso 2. Puse dos cajas Byrne y **el renglón marcó $167** cada una. La Hoja de Costo del mismo mueble, en la misma sesión, dice **$5,845** por las dos. **17.5× de diferencia** — el tipo de cambio.

**Cuánto negocio queda fuera:** nada directo (el total sí sale bien), pero **envenena la decisión**: el proyectista mira el renglón para decidir si el mueble aguanta la caja Byrne o le pone la genérica. Con $167 en pantalla la respuesta es obvia; con $2,923 es otra. Y como el total está bien, nadie lo va a atrapar.

**Parche — NO aplicado.** Reusar la función que ya existe en el motor, en los tres lugares:

```js
import { …, precioDeInsumo } from '../motor/calculo.js';
// …
const precio = precioDeInsumo(ins, par);   // antes: ins.precio ?? ins.precioBase ?? 0
```

---

## H8 · Los estorbos de siempre, todos confirmados sin cambio

Ninguno cuesta dinero por sí solo; juntos son la razón por la que un proyectista de 50+ años abandona.

| | Qué pasa | Dónde |
|---|---|---|
| **Las dos puertas siguen cruzadas** | *"Cotizar especial (a la medida)"* manda a `costeador` (el modo avanzado crudo) para quien ve costos; el **asistente** guiado está escondido detrás de *"Costear con IA"* | `Inicio.jsx:240` → `onIr(veCostos ? 'costeador' : 'asistente')` · `Inicio.jsx:270` |
| **Margen por omisión 30%** | debajo del mínimo de 40 → **alerta roja en todos los especiales, siempre**. El motor usa 50 como objetivo | `App.jsx:107` (`margen: 30`) vs `calculo.js:57` (`margenObjetivo: 50`) |
| **103 materiales sin buscador** | verificado en vivo: `select.pieza-mat` con **104 opciones** (103 + placeholder). El Catálogo **sí** tiene buscador; el desplegable de materiales **no** | `Costeador.jsx:248-257` |
| **El asistente nunca pregunta HORAS** | su única perilla mueve el precio **14.8%** de extremo a extremo. Las horas existen sólo en "Modo avanzado", a 4 pasos | `AsistenteEspecial.jsx:285-297` · `Costeador.jsx:373-395` |
| **No hay centro de "instalación en obra"** | 5 centros, ninguno es obra — que en cancelería y mármol es la mitad de las horas. El 6º (`otros`) existe en el motor y no tiene campo | `src/datos/areas.js` · `calculo.js:65` · `App.jsx:105` |
| **Vocabulario** | "insumo", "centro de costo", "material directo/indirecto", "factor de material indirecto", "gastos de fábrica" son las etiquetas de la pantalla | `Costeador.jsx` passim |

Sobre el último: **si cotizar un especial exige entender "factor de material indirecto", eso es un hallazgo por sí mismo.** El proyectista sabe decir "es una recepción curva de 3.20 en laminado con cubierta de cuarzo". No sabe —ni tiene por qué— qué porcentaje va sobre qué base.

---

# Lo mínimo para que un especial se cotice completo

En orden de esfuerzo/beneficio. Los tres primeros son de una tarde y valen la mayor parte del dinero.

### 1. La alerta de "esta pieza no tiene material" — *media hora, 2 archivos*
Es lo más barato del documento y evita el peor error: **un mueble que sale con precio y sin la mitad de lo que lleva.** `Costeador.jsx:259`, `AsistenteEspecial.jsx:259`. Parche completo en **H3**.

### 2. Marcar los 83 precios sin fuente y corregir los 4 que ya están medidos — *media tarde, 1 archivo*
`marmol` → $7,777 · `cristal-templado-6` → $1,061 · `inoxidable` → $1,770/kg con unidad `kg` · y la etiqueta **"precio sin confirmar"** en todo lo que no tenga `fuente`. Recupera los **$90,583** de la mesa de mármol, evita los **$38,718** de sobreprecio en las puertas, y —lo más importante— **le dice la verdad al que firma**. Parches en **H2** y **H5**.

### 3. Los 5 insumos que faltan: cuarzo, Dekton, kit LED, perfil difusor, perfil de cancelería — *una tarde, 1 archivo + 3 chips*
Con las claves y los costos reales del ERP ya identificados. Desbloquea **3 de las 7 especialidades**. Parche en **H3**.

### 4. El lector de "Mis muebles a la medida", con Abrir y Hacer una copia — *una tarde, 2 archivos*
Convierte la app de calculadora de un solo uso en herramienta de trabajo. Sin esto, todo lo demás se re-teclea cada vez. Parche en **H1**.

### 5. El renglón de maniobras al 3% (12% si hay especial) — *una tarde, 3 archivos*
Es un renglón en la cadena de totales y su línea en el PDF. Entre **$9,000 y $36,000** por proyecto de cancelería. Parche en **H6**.

### 6. Convertir los dólares en el renglón — *quince minutos, 2 archivos*
Una línea en tres lugares, la función ya existe. Parche en **H7**.

### 7. Descruzar las dos puertas y bajar el margen por omisión de 30 a 40 — *quince minutos, 2 líneas*
`Inicio.jsx:240` que mande al **asistente** y no al modo avanzado; `App.jsx:107` de `margen: 30` a `margen: 40`. Quita la alerta roja permanente y pone al proyectista en la pantalla guiada.

### 8. Buscador en el desplegable de 103 materiales — *media tarde*
Cambiar el `<select>` por el mismo patrón de `<input type="search">` + lista que el Catálogo **ya usa** (`Catalogo.jsx:29`). Es copiar algo que ya está resuelto en la casa.

---

### Lo que NO cabe en esta lista y hay que decidir aparte

**La cancelería comprada (H4).** Es la especialidad más grande y la app no puede modelarla: sólo sabe fabricar, y Wand se compra. Mientras no exista la clase `reventa`, **cotizar cancelería dentro de la app da 1.8× arriba y se pierde el trabajo.** Lo honesto hoy es dar de alta los sistemas comprados por m² con su costo de Compras (parche en **H4**) y, mientras tanto, **poner un aviso en la pantalla de especial que diga que la cancelería se cotiza fuera.** Es peor un número creíble y equivocado que ningún número.

**Lo que hay que preguntarle a Compras antes de tocar nada:**
1. Costo por m² del sistema **Wand** (cancel y puerta) — hoy no está en el ERP.
2. Precio vigente del **cuarzo/Silestone** — la última compra es de **2019**.
3. Precio vigente del **perfil de cancelería** `MLEAPE2328O711` — última compra **2021**.
4. **Cristal templado de 12 mm**: no existe en el ERP y es el 62% del costo de la puerta.
