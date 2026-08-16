# Auditoría WOW — Costeador Von Haucke
**2026-08-16 · build 2,716,653 · nada aplicado, todo listo para pegar**

Reglas que respeté: no corrí `deploy.sh`, no toqué `src/`, no metí credenciales (entré por `humo.html`), escribí sólo aquí.

---

## Diagnóstico en una frase

La app **ya tiene** todo lo caro: la marca, 118 renders de producto, un plano isométrico en vector que se ve mejor que el de la competencia, una propuesta con portada editorial y a Voni. Lo que le falta es **decirle al ojo qué es lo importante**. Hoy, en la pantalla de la propuesta de $298,996, el elemento tipográficamente más grande es el botón `−` de restar cantidad (26 px) y el TOTAL es de 20 px. Un vendedor de 54 años no lee jerarquía, la *siente*: si el número que le va a enseñar al cliente es más chico que un botón, la pantalla se siente barata aunque el motor de atrás sea impecable.

**El WOW aquí no se compra con animaciones. Se compra con tres cosas: números grandes, fotos de producto, y silencio en lo que no importa.**

---

## Tabla de prioridades (impacto percibido ÷ esfuerzo)

| # | Qué | Esfuerzo | Impacto | Dónde |
|---|---|---|---|---|
| **1** | Jerarquía del dinero | 15 min · CSS puro | 🔴🔴🔴 | `estilos.css` (7 reglas) |
| **2** | Los 118 renders en las listas de partidas | 25 min · 1 export + 3 JSX | 🔴🔴🔴 | `imagenes.js`, `Voni.jsx`, `Cotizacion.jsx` |
| **3** | El primer minuto: prueba de oficio en el home | 15 min | 🔴🔴🔴 | `Inicio.jsx:164`, `estilos.css` |
| **4** | Los 22 segundos de Voni (no borrar lo que escribió) | 40 min | 🔴🔴 | `CotizadorIA.jsx:132`, `Cargando.jsx` |
| **5** | Los momentos que hoy pasan en silencio | 35 min | 🔴🔴 | `Acomodo.jsx:614`, `Cotizacion.jsx:96` |
| **6** | 10 controles por debajo de 44 px en el teléfono | 20 min · CSS | 🔴🔴 | `estilos.css:750,1048,1060,1080,1375` |
| **7** | Estados vacíos que hoy son un párrafo gris | 30 min | 🔴 | `Voni.jsx:116`, `Catalogo.jsx` |
| **8** | El sistema mínimo (tokens) | 45 min + migración gradual | 🔴 (deuda) | `estilos.css:8-29` |
| **9** | Lo que sobra (quitar) | 20 min | 🔴🔴 | `Inicio.jsx:235`, `Cotizacion.jsx:205,342` |

---

# 1 · La jerarquía del dinero
### 🔴🔴🔴 · 15 min · CSS puro · **el arreglo con mejor relación de todo el documento**

### Qué se siente mal hoy

Medí, pantalla por pantalla, cuál es el elemento tipográficamente más grande y cuál es el número más grande. Esto es lo que salió:

| Pantalla | Elemento más grande | El número que importa |
|---|---|---|
| **Propuesta · vista cliente** | `−` del stepper, **26 px** | TOTAL `$298,996` → **20 px** (`.propx-tot-grand b`) |
| **Propuesta · mis números** | `−` del stepper, **26 px** | un renglón cualquiera a 22 px; el total, más chico |
| **Voni · paso 1** | `−` del stepper, **26 px** | total del proyecto `$228,102` → **18 px** inline |
| **Catálogo** | nada supera **17 px** | los precios, a 18 px de `.dinero` |
| **Banco de precios** | `$2,120` a **18 px** — es lo más grande de toda la pantalla | |
| **Las 24 pantallas de línea** | `.precio-grande` **28–38 px** ✅ | ✅ correcto, aquí sí manda el precio |

Y el mismo dato —**el precio**— está pintado a **diez tamaños distintos** según en qué pantalla caiga: 54 px (`.precio-enorme`, `:550`), 38 px (`.precio-grande`, `:226`), 28 px (`.barra-fija .precio-grande`, `:237`), 26 px (`.dvis-precio`, `:991`), 22 px (`.cot-importe` `:280`), 20 px (`.propx-tot-grand b` `:818`), 18 px (`.dinero` `:53`, `.banco-precio` `:630`, `.propx-res-tot` `:864`), 17 px (`.propx-importe` `:804`), 16 px (`.vt-importe` `:1079`). Sólo tres escalan con `clamp()`.

El síntoma peor está en `estilos.css:802`: la **cantidad** (`.propx-cant-n`, el "2" de "2 pzas") pesa **22 px en `--display` weight 800**, más que el total de la propuesta. En un documento que va al cliente, el número que grita es "2".

### Dónde
`src/estilos.css:802` · `:804` · `:816-818` · `:280` · `:1079` · `:864` · `:630` · `src/componentes/Voni.jsx:158-161`

### El parche

**A) CSS — pegar sustituyendo las reglas actuales.**

```css
/* --- estilos.css:802-804 · el renglón de la propuesta: manda el importe --- */
.propx-cant-n { display: block; font-family: var(--display); font-weight: 700; font-size: 17px; color: var(--gris); line-height: 1; }
.propx-cant-l { font-size: 11px; color: var(--gris); text-transform: uppercase; letter-spacing: .08em; }
.propx-importe { flex: none; min-width: 132px; text-align: right; font-family: var(--mono); font-weight: 700; font-size: 20px; color: var(--tinta); font-variant-numeric: tabular-nums; letter-spacing: -.01em; }

/* --- estilos.css:816-818 · EL TOTAL. Es el número de la pantalla. --- */
.propx-tot-grand {
  display: flex; justify-content: space-between; gap: 24px; align-items: baseline;
  margin-top: 10px; padding: 20px 24px; background: var(--tinta); color: #fff; border-radius: 14px;
}
.propx-tot-grand span {
  font-family: var(--display); font-weight: 700; font-size: 13px;
  letter-spacing: .14em; text-transform: uppercase; opacity: .72; align-self: center;
}
.propx-tot-grand b {
  font-family: var(--mono); font-weight: 700;
  font-size: clamp(30px, 8.5vw, 42px); line-height: 1; letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
}

/* --- estilos.css:280 · importe de renglón en móvil: por debajo del total --- */
.cot-importe { font-family: var(--mono); font-weight: 700; font-size: 19px; font-variant-numeric: tabular-nums; }

/* --- estilos.css:1079 · lista del vendedor --- */
.vt-importe { font-family: var(--mono); font-weight: 700; font-size: 19px; min-width: 118px; text-align: right; font-variant-numeric: tabular-nums; }

/* --- estilos.css:864 · total por área en el resumen --- */
.propx-res-tot { font-family: var(--mono); font-weight: 700; font-size: 22px; color: var(--tinta); white-space: nowrap; font-variant-numeric: tabular-nums; }

/* --- estilos.css:630 · banco de precios --- */
.banco-precio { font-family: var(--mono); font-weight: 700; font-size: 21px; white-space: nowrap; font-variant-numeric: tabular-nums; }

/* --- estilos.css:157 · el stepper deja de competir. Sigue siendo 54x54 táctil. --- */
.masmenos button { width: 54px; height: 54px; font-size: 22px; font-weight: 700; border: 2px solid var(--linea-fuerte); background: var(--blanco); border-radius: 8px; cursor: pointer; color: var(--tinta); }
.masmenos button:hover { border-color: var(--carbon); }
.masmenos .valor { font-family: var(--mono); font-size: 20px; font-weight: 700; min-width: 3ch; text-align: center; }
```

**B) `Voni.jsx:158-161` — el total del proyecto deja de ser un `<strong>` de 18 px inline.**

Reemplazar:
```jsx
                <div className="fila" style={{ justifyContent: 'flex-end', gap: 20 }}>
                  <span className="ayuda">Precio de lista</span>
                  <strong className="mono" style={{ fontSize: 18 }}>{pesos(totalLista)}</strong>
                </div>
```
por:
```jsx
                <div className="voni-total">
                  <span className="voni-total-lbl">Precio de lista · {partidas.length} renglones · {partidas.reduce((a, p) => a + p.cantidad, 0)} piezas</span>
                  <b className="mono">{pesos(totalLista)}</b>
                </div>
```
y añadir al CSS:
```css
/* Total del proyecto en Voni: el dato por el que abrió la app. */
.voni-total {
  display: flex; justify-content: space-between; align-items: baseline; gap: 20px; flex-wrap: wrap;
  margin-top: 14px; padding: 18px 20px; border-radius: 14px;
  background: var(--tinta); color: #fff;
}
.voni-total-lbl { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; opacity: .7; font-weight: 700; font-family: var(--display); }
.voni-total b { font-size: clamp(28px, 8vw, 38px); line-height: 1; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
```

### Por qué le importa a un vendedor de 54 años
Enseña la pantalla del celular al cliente al otro lado de la mesa, a 60 cm de distancia. A 20 px el total es ilegible desde ahí; a 40 px se lee de pie. Y él mismo, cuando revisa deprisa entre dos citas, quiere *un* número — no cazarlo entre siete de igual peso.

---

# 2 · Los 118 renders están donde no hacen falta y faltan donde importan
### 🔴🔴🔴 · 25 min

### Qué se siente mal hoy

Hay **118 renders de producto** (Supabase, 1200×900, 63 KB c/u, fondo `#F0EEEA` homogeneizado, sombra de contacto pintada — trabajo bien hecho) y **23 heros de línea**. Hoy se ven en: la pantalla de costeo por línea (`CosteadorLinea.jsx:114`), el modal de editar partida (`EditarPartida.jsx:94`), las miniaturas del acomodo (`Acomodo.jsx:710`) y la propuesta impresa (`Cotizacion.jsx:426`).

**No se ven en ninguna de las listas donde el vendedor pasa el 80 % del tiempo:**

| Pantalla | Archivo:línea | Hoy |
|---|---|---|
| Lista de muebles de Voni (paso 1) | `Voni.jsx:122-145` | texto plano |
| Lista del vendedor en la propuesta | `Cotizacion.jsx:228-244` | texto plano |
| Tabla interna "Mis números" | `Cotizacion.jsx:264` | texto plano |
| Tarjetas móviles de la cotización | `Cotizacion.jsx:288-302` | texto plano |
| **Catálogo completo** | `Catalogo.jsx` | **cero `<img>` en todo el archivo** |
| **Banco de precios** | `Banco.jsx` | **cero `<img>`** |

Y el helper ya existe, resuelto, con cascada de tres niveles, a tres líneas de distancia — sólo que **no está exportado**:

```js
// Cotizacion.jsx:18-19
const fotoPartida = (pt) =>
  pt.render || (pt.ruta ? imagenProducto(pt.ruta, pt.productoId) || heroLinea(pt.ruta) : null);
```

Un vendedor le enseña al cliente una lista de seis renglones de texto. La competencia le enseña fotos. Los renders ya están pagados y subidos.

### El parche

**A) `src/datos/imagenes.js` — mover el helper al módulo (añadir al final):**
```js
// Foto de una PARTIDA de cotización. Cascada: render IA generado en vivo →
// render de catálogo por (ruta, producto) → hero de la línea → null.
// Vivía suelto dentro de Cotizacion.jsx y por eso ninguna otra lista lo usaba.
export const fotoPartida = (pt) =>
  pt?.render || (pt?.ruta ? imagenProducto(pt.ruta, pt.productoId) || heroLinea(pt.ruta) : null);
```
Y en `Cotizacion.jsx:12,18-19`: borrar la definición local y añadir `fotoPartida` al import de `../datos/imagenes.js`.

**B) CSS nuevo — una sola clase que sirve para las cuatro listas:**
```css
/* Miniatura de producto en cualquier lista de partidas.
   contain + fondo del propio render para que no se vea el recuadro. */
.mini-part {
  width: 76px; height: 58px; flex: none; border-radius: 10px;
  object-fit: contain; background: #F0EEEA; border: 1px solid var(--linea);
}
.mini-part.sin { background: linear-gradient(135deg, var(--papel), #e7e1da); }
@media (max-width: 560px) { .mini-part { width: 60px; height: 46px; } }
```

**C) `Voni.jsx:125` — dentro de `<div className="voni-fila" key={pt.id}>`, como primer hijo:**
```jsx
                      {fotoPartida(pt)
                        ? <img className="mini-part" src={fotoPartida(pt)} alt="" loading="lazy" decoding="async" />
                        : <span className="mini-part sin" aria-hidden="true" />}
```
(y añadir `import { fotoPartida } from '../datos/imagenes.js';`)

**D) `Cotizacion.jsx:229` — dentro de `<div className="vt-fila" key={pt.id}>`, como primer hijo:** el mismo bloque.

**E) `Cotizacion.jsx:292` — dentro de `<div className="cot-card" key={pt.id}>`:** el mismo bloque, arriba del nombre.

### Nota que hay que respetar
Hay **un render por producto, no por configuración**: un escritorio de 1.20 y uno de 1.80 comparten imagen. `CosteadorLinea.jsx:121` ya imprime el descargo correcto ("Imagen de referencia · {medidas}. Tu configuración de arriba manda en el precio"). En las listas la miniatura es chica y el nombre lleva la medida al lado, así que no hace falta repetirlo — pero **no** conviene agrandar la miniatura a tamaño hero en la lista editable por esa razón.

### Por qué le importa
Es la diferencia entre "una lista de Excel" y "un catálogo". Y para el vendedor mayor es memoria visual: reconoce el mueble por la foto mucho antes de leer "Banca doble APP LT 1.50 · 10 usuarios".

---

# 3 · El primer minuto
### 🔴🔴🔴 · 15 min

### Qué ve hoy alguien al entrar

Ve esto (medido a 750 px de ancho, que es el escenario real):

1. Overline rojo `VON HAUCKE · MÁS DE 68 AÑOS DE OFICIO` (12 px) — bien.
2. H1 `Empecemos tu propuesta` a 38 px — bien.
3. Lead gris — bien.
4. **Una tarjeta negra con un gradiente plano y un robot de caricatura de 64 px.**
5. Un divisor "o si prefieres escoger tú" y dos tarjetas.

**El problema:** en la pantalla que decide si esto "se ve serio", **no aparece un solo mueble**. Hay 118 renders de producto y 23 heros de showroom y el home enseña un robot 3D estilo Pixar. Ese avatar es el único elemento de toda la app que contradice el tono "68 años de oficio" — y es el más grande y el más brillante del home. El login (`estilos.css:982`, `.login-hero`) **ya usa** un render de showroom con velo: la receta correcta ya existe en el archivo, sólo no llegó al home.

**Segundo problema:** el home no dice de qué tamaño es lo que hay detrás. "Más de 68 años" es una frase; "24 líneas · 118 productos · 68 años" es una prueba.

### Dónde
`src/componentes/Inicio.jsx:160-190` · `src/estilos.css:1263-1279` (`.voni-principal`) · `src/componentes/VoniAvatar.jsx`

### El parche

**A) `Inicio.jsx:180` — la tarjeta de Voni sobre showroom, no sobre gradiente plano.** `heroLinea` ya está importado en la línea 9.

Reemplazar la apertura del botón:
```jsx
        <button className="voni-principal" onClick={() => onIr('voni')}>
```
por:
```jsx
        <button
          className="voni-principal"
          onClick={() => onIr('voni')}
          style={{ backgroundImage: `linear-gradient(100deg, rgba(30,27,26,.96) 0%, rgba(30,27,26,.88) 46%, rgba(138,31,25,.55) 100%), url(${heroLinea('cirque')})` }}
        >
```
y en `estilos.css:1263-1268` añadir dos líneas a `.voni-principal`:
```css
  background-size: cover;
  background-position: center right;
```
(el `background: linear-gradient(...)` actual de la línea 1266 se queda como respaldo si la foto no carga; ponlo *antes* del `background-size`).

**B) `Inicio.jsx:164` — la franja de prueba de oficio, justo bajo el lead:**
```jsx
        <div className="inicio-prueba">
          <span><b>24</b> líneas de catálogo</span>
          <span><b>118</b> productos con render</span>
          <span><b>68</b> años fabricando en México</span>
        </div>
```
```css
/* Prueba de oficio: no es un adorno, es lo que respalda el precio. */
.inicio-prueba {
  display: flex; flex-wrap: wrap; gap: 8px 26px; align-items: baseline;
  margin: 14px 0 20px; padding-top: 14px; border-top: 1px solid var(--linea);
  font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--gris);
}
.inicio-prueba b { font-family: var(--mono); font-size: 20px; color: var(--tinta); letter-spacing: -.01em; margin-right: 4px; }
```

**C) El avatar (decisión de dirección, no parche).** Recomiendo **una** de estas dos, no las dos:
- **Sobrio:** que `VoniAvatar variante="cara"` en el home use el monograma tipográfico VH sobre círculo rojo en vez del robot 3D, y dejar el robot sólo dentro del flujo de Voni (donde ya estás "hablando con el asistente" y el tono juguetón no contradice nada).
- **Mantener el robot** pero bajarlo de 64 a 44 px y quitarle el `anim="bob"` (`Voni.jsx:96`) en el saludo. Un avatar que flota es lo primero que un cliente corporativo lee como "esto es un juguete".

### Por qué le importa
El cliente que ve la pantalla por encima del hombro decide en dos segundos si esto es una empresa seria. Un showroom Von Haucke con velo dice "somos esto". Un robot flotante dice otra cosa.

---

# 4 · Los 22 segundos de Voni
### 🔴🔴 · 40 min

### Qué se siente mal hoy

```js
// CotizadorIA.jsx:132
if (cargando) return <Cargando voni titulo="Voni está trabajando" mensajes={[...]} />;
```

Ese `return` temprano **borra la pantalla completa**. El vendedor acaba de escribir tres párrafos describiendo el pedido del cliente y, al dar clic, **su texto desaparece**. Durante 22 segundos ve un avatar, un mensaje rotando y una barra que va y viene sin significar nada. Si se corta el internet vuelve a la pantalla — con el texto todavía en el `useState`, sí, pero él no lo sabía y ya se puso nervioso.

Además:
- Los 4 mensajes rotan cada **1.8 s** (`Cargando.jsx:19`). En una llamada de 22 s el ciclo se repite **tres veces**. Ver "Leyendo tu pedido…" por tercera vez es la señal exacta de "esto se colgó".
- La barra (`estilos.css:465`) es un `margin-left` infinito: no informa nada.
- Ninguna de las **6 animaciones infinitas** de la app está protegida por `prefers-reduced-motion` (sólo `.entrada-img`, `estilos.css:1354`).

### Dónde
`src/componentes/CotizadorIA.jsx:132` · `src/componentes/Cargando.jsx:16-33` · `src/estilos.css:456-466`

### El parche

**A) `CotizadorIA.jsx:132` — no borrar la pantalla. Bloquear y superponer.**

Quitar la línea 132 y, en el `return` principal (línea 138), envolver:
```jsx
  return (
    <div className="contenido" style={{ maxWidth: 900, paddingLeft: 0, paddingRight: 0 }}>
      <div className={'ia-zona' + (cargando ? ' ocupada' : '')}>
        <div className="tarjeta">
          {/* …h3, ayuda, textarea, chips, botón… tal cual están hoy… */}
        </div>
        {cargando && (
          <div className="ia-espera">
            <Cargando voni titulo="Voni está leyendo tu pedido"
              mensajes={['Leyendo tu pedido…', 'Buscando en las 24 líneas…', 'Costeando cada mueble…', 'Armando la lista…']} />
          </div>
        )}
      </div>
      {/* …resto igual… */}
```
```css
/* La espera NO borra lo que el vendedor escribió: lo atenúa y lo bloquea. */
.ia-zona { position: relative; }
.ia-zona.ocupada > .tarjeta { opacity: .38; filter: saturate(.4); pointer-events: none; }
.ia-espera {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, rgba(243,241,237,.55), rgba(243,241,237,.9));
  border-radius: 10px; backdrop-filter: blur(1.5px);
}
```

**B) `Cargando.jsx` — pasos numerados, ritmo real y reloj honesto.**

Reemplazar el cuerpo del componente:
```jsx
export default function Cargando({ titulo = 'Analizando con IA', mensajes = MENSAJES, voni = false, ritmoMs = 5500 }) {
  const [i, setI] = useState(0);
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    // Los pasos avanzan al ritmo real de la llamada (~22 s / 4 pasos) y se
    // FRENAN en el último: repetir el ciclo es lo que hace pensar que se colgó.
    const t = setInterval(() => setI((n) => Math.min(n + 1, mensajes.length - 1)), ritmoMs);
    const r = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [mensajes.length, ritmoMs]);
  const pct = Math.min(96, ((i + 1) / mensajes.length) * 100);
  return (
    <div className="cargando">
      <div className="cargando-logo">
        <span className="cargando-halo" />
        {voni ? <VoniAvatar tam={84} variante="cara" anim="bob" /> : <Logo alto={56} />}
      </div>
      <div className="cargando-titulo">{titulo}</div>
      <div className="cargando-msg">{mensajes[i]}</div>
      <div className="cargando-barra"><span style={{ width: pct + '%', margin: 0, animation: 'none' }} /></div>
      <div className="cargando-paso">Paso {i + 1} de {mensajes.length}{seg > 12 ? ` · van ${seg} s, normalmente tarda unos 25` : ''}</div>
    </div>
  );
}
```
```css
.cargando-paso { font-size: 13px; color: var(--gris); margin-top: 8px; font-variant-numeric: tabular-nums; }
.cargando-barra span { transition: width .5s cubic-bezier(.4,0,.2,1); }
```

**C) `estilos.css` — la regla global de movimiento reducido que falta (pegar al final del archivo):**
```css
/* Movimiento reducido: hoy sólo lo respeta .entrada-img (:1354) y hay 6
   animaciones infinitas más. En pantallas que se enseñan a un cliente,
   respetarlo es cortesía; para quien se marea, es que la app sea usable. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
  .cargando-halo, .render-gen-spin { animation: none !important; border-top-color: var(--rojo); }
}
```

### Por qué le importa
A los 22 segundos sin señal de avance, la gente le da otra vez al botón. Otra vez al botón = otra llamada = 22 segundos más y renglones duplicados. "Paso 3 de 4 · van 18 s" cuesta cinco líneas y evita esa llamada.

---

# 5 · Los momentos que hoy pasan en silencio
### 🔴🔴 · 35 min

Hay un `.toast` bien hecho (`estilos.css:562`, verde, píldora, `role="status"`) y un `mostrarAviso()` en `App.jsx:203` que **sí** se dispara al agregar muebles (`:413`, `:435`, `:457`, `:470`, `:490`) y al guardar acomodo (`:665`, `:670`). Bien. Pero tres de los cuatro momentos que Rodrigo nombró siguen mudos:

### 5.1 · "El acomodo cabe"

Hoy (`Acomodo.jsx:611-621`) el momento culminante —Voni verificó que 20 puestos caben en 84 m²— es texto de 15 px dentro de un `.alerta` con un `✓` de emoji:

```jsx
{chequeo.ok ? '✓ Todo cabe.' : …}
{chequeo.puestos > 0 && <> <strong>{chequeo.puestos} puestos de trabajo</strong> en {chequeo.areaPiso} m²…</>}
```

**Parche** — sustituir el bloque del `.alerta` cuando `chequeo.ok`:
```jsx
          {chequeo && (chequeo.ok ? (
            <div className="cabe">
              <span className="cabe-check" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </span>
              <div className="cabe-tx">
                <div className="cabe-t">Todo cabe</div>
                <div className="cabe-cifras">
                  {chequeo.puestos > 0 && <span><b>{chequeo.puestos}</b> puestos</span>}
                  <span><b>{chequeo.areaPiso}</b> m²</span>
                  {chequeo.m2Persona ? <span><b>{chequeo.m2Persona}</b> m² por persona</span> : null}
                </div>
              </div>
            </div>
          ) : (
            /* …el .alerta ambar de hoy, sin cambios… */
          ))}
```
```css
/* "Cabe" es el momento por el que existe el acomodo: se ve como un resultado,
   no como un aviso del sistema. */
.cabe {
  display: flex; align-items: center; gap: 16px; padding: 18px 20px; margin-bottom: 12px;
  border-radius: 14px; background: #e9f5f1; border: 1px solid var(--verde); color: #0b5c54;
}
.cabe-check {
  flex: none; width: 46px; height: 46px; border-radius: 999px; display: inline-flex;
  align-items: center; justify-content: center; background: var(--verde); color: #fff;
}
.cabe-t { font-family: var(--display); font-weight: 800; font-size: 22px; letter-spacing: -.01em; }
.cabe-cifras { display: flex; flex-wrap: wrap; gap: 6px 20px; margin-top: 4px; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; opacity: .85; }
.cabe-cifras b { font-family: var(--mono); font-size: 20px; letter-spacing: -.01em; margin-right: 4px; }
```

### 5.2 · Se descargó la propuesta

`Cotizacion.jsx:96-115`: se genera el PDF, se baja… y **no pasa absolutamente nada en pantalla**. El botón vuelve a decir "Descargar PDF". En un navegador móvil la descarga se va a una bandeja que el vendedor no ve, y él se queda mirando la misma pantalla sin saber si funcionó.

**Parche** — en `Cotizacion.jsx`, añadir estado y confirmación:
```jsx
  const [pdfListo, setPdfListo] = useState(false);
```
al final del `try` de `descargarPDF()` (después de `descargarPropuesta({...})`):
```jsx
      setPdfListo(true);
      setTimeout(() => setPdfListo(false), 6000);
```
y bajo la barra `.cot-acciones` (línea 206):
```jsx
      {pdfListo && (
        <div className="pdf-listo" role="status" aria-live="polite">
          <b>Propuesta descargada.</b> {['Propuesta', cot.folio, cot.cliente].filter(Boolean).join(' ')}.pdf · {partidas.length} renglones · {pesos(total)}
        </div>
      )}
```
```css
.pdf-listo {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline;
  margin: -6px 0 14px; padding: 14px 18px; border-radius: 12px;
  background: #e9f5f1; border: 1px solid var(--verde); color: #0b5c54; font-size: 15px;
}
.pdf-listo b { font-family: var(--display); }
```

### 5.3 · Voni entendió el pedido

`CotizadorIA.jsx:168` — `<strong>Agregué 6 muebles a tu proyecto.</strong>` dentro de una tarjeta con clase `agregado-ok`. Es el instante más impresionante de la app (un párrafo en español se convirtió en seis renglones costeados) y se anuncia con negritas de 16.5 px.

**Parche** — sustituir la línea 168:
```jsx
              <div className="ia-hit">
                <span className="ia-hit-n">{resultado.agregados}</span>
                <span className="ia-hit-t">{resultado.agregados === 1 ? 'mueble entendido y costeado' : 'muebles entendidos y costeados'}</span>
              </div>
```
```css
.ia-hit { display: flex; align-items: baseline; gap: 14px; margin-bottom: 6px; }
.ia-hit-n { font-family: var(--mono); font-weight: 700; font-size: clamp(34px, 9vw, 46px); line-height: 1; color: var(--verde); letter-spacing: -.03em; }
.ia-hit-t { font-family: var(--display); font-weight: 700; font-size: 17px; color: var(--tinta); }
```

### Por qué le importa
Estos tres momentos son la prueba de que la app hizo algo difícil. Si pasan en voz baja, el vendedor no tiene nada que contar en la oficina, y la app no se difunde sola entre los siete proyectistas.

---

# 6 · Diez controles por debajo de 44 px, todos en el teléfono
### 🔴🔴 · 20 min · CSS puro

El encabezado del propio `estilos.css` dice: *"Pensado para vendedores y planta de 50-65 años: números grandes, botones grandes, nada por debajo de 13 px ni de 50 px de alto."* La realidad medida:

**Botones táctiles que incumplen** (los 5 primeros son controles primarios de la cotización en teléfono):

| `estilos.css` | Selector | Tamaño | Qué es |
|---|---|---|---|
| **:750** | `.prop-cant button` | **38×38 `!important`** | +/− de cantidad en la propuesta. El `!important` anula el 54×54 de `.masmenos`. |
| **:1048** | `.bc-mm button` | 40×40 | +/− de la barra de compra móvil |
| **:1060** | `.segmento button` | 40 | conmutador "Mis números / Como la ve el cliente" |
| **:1080** | `.vt-quitar` | 40 | quitar partida |
| **:1375** | `.icono-btn` | 40×40 | editar mueble |
| :194 | `.pieza-x` | 40 ancho | |
| :1228 | `.guia-buscar-x` | 32 ancho | |
| :421 | `.buscador-x` | ≈22×22 | la "×" del buscador de líneas |
| :596 | `.check input` | 20×20 | **todos** los checkboxes |
| :1083 | `.enlace-sutil` | ≈19 alto | |

**Y 50 declaraciones de `font-size` por debajo del piso de 13 px que el propio archivo se puso:** 12 px ×17, 12.5 px ×11, 11 px ×13, 11.5 px ×3, 10 px ×4, 10.5 px ×2. Además **cero `rem`**: todo en px absolutos, así que si el usuario subió el tamaño de letra en su iPhone, la app lo ignora.

### El parche (pegar al final de `estilos.css`)
```css
/* ---- Piso táctil. La app dice "50-65 años" en su cabecera; que sea verdad. ---- */
.prop-cant button { width: 44px !important; height: 44px !important; font-size: 20px !important; }
.bc-mm button { width: 44px; height: 44px; }
.segmento button { min-height: 44px; }
.vt-quitar { min-height: 44px; }
.icono-btn { width: 44px; height: 44px; }
.pieza-x { width: 44px; }
.guia-buscar-x { width: 44px; }
.buscador-x { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
.check input { width: 26px; height: 26px; }
.enlace-sutil { min-height: 44px; display: inline-flex; align-items: center; }

/* Piso tipográfico: nada por debajo de 12.5px sube a 13px sin tocar 50 reglas. */
.propx-cant-l, .propx-res-cant, .sello, .ia-badge, .retomar-lbl,
.voni-principal-k, .accion-kicker, .voni-paso-d, .propx-tot-anticipo { font-size: 13px; }
```

### Por qué le importa
Un dedo de 54 años sobre 38 px falla una de cada cinco veces, y falla **justo en el `−` de cantidad**: en vez de bajar de 3 a 2 piezas, toca otra cosa. Ése es el tipo de error que hace que alguien deje de usar una app y vuelva al Excel.

---

# 7 · Estados vacíos: hoy son un párrafo gris
### 🔴 · 30 min

| Dónde | Hoy | Qué debería |
|---|---|---|
| `Voni.jsx:116-119` | `<p className="ayuda">Aún no hay muebles. Descríbele a Voni…</p>` — texto gris de 14 px | Tres ejemplos con miniatura real: "Oficina operativa · 15 bench + juntas para 10". Los ejemplos **ya existen** (`CotizadorIA.jsx:29-33` — `EJEMPLOS`) pero se muestran como chips de 44 px sin ninguna imagen. Ponerles el hero de la línea y son tres tarjetas que dan ganas de tocar. |
| `Cotizacion.jsx:208-220` | ✅ **Éste sí está bien resuelto**: logo, título, párrafo, tres botones. Es el mejor estado vacío de la app; sirve de modelo para los demás. | mantener |
| `Catalogo.jsx:76` | `<h2>Catálogo</h2>` + buscador + familias plegadas. Ninguna imagen, nada supera 17 px. | 23 heros de línea disponibles y sin usar. Una rejilla de portadas por familia convertiría la pantalla más plana de la app en la más vendedora. |
| `Tablero` | `.cifra` a 24 px mostrando `$0` sin explicar por qué | decir "todavía no hay cotizaciones cerradas este mes" en vez de un `$0` mudo |

**Parche para el estado vacío de Voni** (`Voni.jsx:115-119`):
```jsx
            {!hay ? (
              <div className="vacio-ej">
                <p className="ayuda" style={{ marginTop: 0 }}>Aún no hay muebles. Escoge un ejemplo para ver cómo funciona, o descríbeselo a Voni aquí arriba.</p>
                <div className="vacio-ej-grid">
                  {[['Oficina operativa', 'cirque'], ['Área ejecutiva', 'eclipse'], ['Bench + guardas', 'applt']].map(([n, ruta]) => (
                    <div className="vacio-ej-card" key={ruta} style={{ backgroundImage: `url(${heroLinea(ruta)})` }}>
                      <span className="vacio-ej-velo" /><span className="vacio-ej-t">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : ( … )}
```
```css
.vacio-ej-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
@media (max-width: 560px) { .vacio-ej-grid { grid-template-columns: 1fr; } }
.vacio-ej-card { position: relative; height: 96px; border-radius: 12px; overflow: hidden; background-size: cover; background-position: center; border: 1px solid var(--linea); }
.vacio-ej-velo { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,18,17,0) 40%, rgba(20,18,17,.72) 100%); }
.vacio-ej-t { position: absolute; left: 12px; bottom: 10px; color: #fff; font-family: var(--display); font-weight: 700; font-size: 14px; }
```
(los ejemplos siguen aplicándose desde los chips de `CotizadorIA`; estas tarjetas son la *invitación*, no un control nuevo — o se les cuelga el mismo `setTexto(ej.t)` si se prefiere)

---

# 8 · Consistencia — el sistema mínimo
### 🔴 (deuda) · 45 min de tokens + migración gradual

### El inventario, con números reales de `src/estilos.css` (1441 líneas)

| Métrica | Hoy | Debería |
|---|---|---|
| Tokens en `:root` | **17** (13 color + 1 sombra + 3 familias) — y `--carbon` es idéntico a `--tinta` | ~40 |
| Escala de espaciado | **no existe** | 7 pasos |
| Escala tipográfica | **no existe** · 39 tamaños distintos en 238 declaraciones · **0 en rem** | 9 pasos, en rem |
| Radios | **17 valores** en 110 declaraciones (6, 8, 9, 10, 11, 12, 14, 16, 18… seis de ellos huérfanos) | 4 + pill |
| Sombras | **15 valores** en 31 declaraciones; **11 sombras únicas sin token** | 3 niveles |
| Colores hex literales | **138 usos / 63 distintos** (sólo 13 tokenizados) + **53 `rgba()` / 43 distintos** | |
| Grises / neutrales | **30 distintos** hardcoded, además de los 5 tokens. Hay **11 off-whites** entre `#f2efec` y `#faf9f8` que son el mismo color a ojo | 6 |
| Rojos | **9 hex + 5 alphas = 14 valores de rojo.** Uno de ellos (`#D02E26`, `:733`) **ni siquiera es el rojo de marca** y está escondido como fallback: `var(--rojo, #D02E26)` | 1 + opacidades |
| Breakpoints | **12** (380/420/480/520/560/640/700/720/760/900/1000/561) en 38 `@media` · **desktop-first** (32 `max-width` vs 1 `min-width`) | 3 |
| Transiciones | **13 recetas, las 13 únicas** · 11 duraciones · 6 easings | 3 duraciones, 2 easings |
| `@keyframes` | 7, de los cuales `vh-halo` (:461) y `render-spin` (:1005) son **el mismo spinner definido dos veces** | 5 |
| Anillo de foco | **3 recetas distintas** (`3px solid var(--foco)`, `2.5px solid var(--rojo)` `:959`, `2px solid var(--rojo)` `:962`) con 4 offsets | 1 |

### El parche: tokens (pegar dentro de `:root`, `estilos.css:29`)

```css
  /* ---- SISTEMA MÍNIMO (2026-08-16). Ver auditoria-wow.md §8.
     No rompe nada: las reglas viejas siguen con sus px. Lo nuevo usa tokens
     y lo viejo se migra cuando se toque el bloque, no de golpe. ---- */

  /* Espaciado — 7 pasos. Reemplaza 30 magnitudes sueltas. */
  --e1: 4px;  --e2: 8px;  --e3: 12px; --e4: 16px;
  --e5: 24px; --e6: 32px; --e7: 48px;

  /* Radios — 4 + pill. Reemplaza 17 valores. */
  --r-xs: 6px; --r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-pill: 999px;

  /* Elevación — 3 niveles. Reemplaza 11 sombras únicas. */
  --sombra: 0 1px 2px rgba(30,27,26,.04), 0 8px 24px -14px rgba(30,27,26,.18);
  --sombra-2: 0 2px 6px rgba(30,27,26,.06), 0 18px 40px -18px rgba(30,27,26,.28);
  --sombra-3: 0 4px 12px rgba(30,27,26,.10), 0 28px 70px -24px rgba(30,27,26,.34);

  /* Tipografía — en rem, para que respete el ajuste del sistema.
     Base 17px = 1.0625rem (html font-size sigue en 17px). */
  --t-xs: 0.8125rem;  /* 13px — PISO. Nada por debajo. */
  --t-sm: 0.875rem;   /* 14 */
  --t-md: 1rem;       /* 16 */
  --t-base: 1.0625rem;/* 17 */
  --t-lg: 1.3125rem;  /* 21 */
  --t-xl: 1.625rem;   /* 26 */
  --t-2xl: 2rem;      /* 32 */
  --t-3xl: clamp(1.75rem, 8vw, 2.375rem);  /* 28→38 — el dinero */
  --t-4xl: clamp(2.125rem, 9vw, 3.375rem); /* 34→54 — el dinero enorme */

  /* Movimiento — 3 duraciones, 2 easings. Reemplaza 11 y 6. */
  --dur-1: .12s; --dur-2: .18s; --dur-3: .32s;
  --ease: cubic-bezier(.4, 0, .2, 1);
  --ease-sal: cubic-bezier(.16, 1, .3, 1);

  /* Breakpoints de referencia (para el equipo, CSS no los lee en @media):
     móvil ≤560px · tablet ≤900px · escritorio >900px.
     Los 12 actuales se colapsan a estos tres al tocar cada bloque. */

  /* Foco — UNA receta. Hoy hay tres. */
  --anillo: 0 0 0 3px var(--foco);
```

### Los tres arreglos de consistencia que valen más que el resto juntos
1. **Borrar `var(--rojo, #D02E26)` de `estilos.css:733`** — es un rojo que no es el de la marca escondido en un fallback. Si `--rojo` falla alguna vez, esa pantalla sale con otro rojo.
2. **Colapsar los 11 off-whites** (`#f4f2ef`, `#f6f4f1`, `#f6f3ee`, `#f2efec`, `#faf9f8`, `#faf7f4`, `#faf8f6`, `#f4f1ee`, `#efece9`, `#efeae3`, `#eae5df`) a `var(--papel)` y `var(--panel)`. Nadie va a notar el cambio; sí se nota hoy que las tarjetas de dos pantallas distintas tienen fondos ligeramente distintos.
3. **Una sola receta de foco.** Hoy `:959` y `:962` usan rojo sólido de 2 y 2.5 px, el resto usa `--foco` de 3 px. Al navegar con teclado, el anillo cambia de color entre pantallas.

---

# 9 · Lo que sobra
### 🔴🔴 · 20 min · quitar es la mitad del WOW

**9.1 · Tres puertas a la misma cosa.** El home ya tiene la tarjeta grande de Voni (`Inicio.jsx:180`), que en su paso 1 **es literalmente `<CotizadorIA/>`** (`Voni.jsx:100`). Pero además existen:
- `Inicio.jsx:235` — tarjeta roja **"Cotizar con IA"** dentro del panel Cotizar → `onIr('cotizarIA')`
- `Inicio.jsx:258-266` — la tarjeta `.atajo-ia` **"¿Son varios muebles?"** con otro botón "Cotizar con IA"

**Quitar las dos.** Son el mismo componente detrás de tres nombres distintos, y obligan al vendedor a preguntarse cuál es cuál. El panel Cotizar pasa de 6 tiles a 5 y gana una fila entera de aire.

**9.2 · "Imprimir" al lado de "Descargar PDF"** (`Cotizacion.jsx:205`). El comentario del propio código en `:91-93` cuenta la historia: *"Antes esto abría el diálogo de impresión y dejaba al vendedor buscando 'Guardar como PDF'… Rodrigo: 'me manda a imprimir, no lo descarga'"*. Se arregló con `descargarPDF()` y **se dejó el botón viejo al lado**. Un vendedor con prisa tocará el equivocado la mitad de las veces. `imprimir()` ya sigue siendo el respaldo automático si el PDF falla (`:112-113`) — quitar el botón no pierde nada.

**9.3 · La tarjeta "Imágenes de la propuesta"** (`Cotizacion.jsx:342-368`): dos botones de generación con IA + un enlace de subir archivo + un contenedor de error + un bloque de preview con botón de quitar. Cinco decisiones para algo que el vendedor no sabe evaluar. **Colapsarla a un botón**: *"Generar las imágenes de la propuesta"* que haga las dos cosas (muebles + oficina) en secuencia, con el enlace de subir imagen propia debajo en letra sutil. Los otros dos controles pasan a un `<details>` "Opciones avanzadas".

**9.4 · Texto que sobra en el home.** `Inicio.jsx:185` — la descripción de la tarjeta de Voni tiene 129 caracteres:
> "Descríbelo en tus palabras y armo el proyecto completo: los muebles, el acomodo en su espacio y la propuesta lista para entregar."

Nadie lee 168 caracteres dentro de un botón. Cortar a:
> "Descríbelo en tus palabras. Yo armo los muebles, el acomodo y la propuesta."

**9.5 · Candidato a revisión, no a borrado.** La pantalla `Asistente` (`Asistente.jsx`, 258 líneas) es el único consumidor de `.exito`/`.palomita` (`estilos.css:558-559`) y de `.precio-enorme` (54 px, el número más grande de toda la app) y de `.masmenos.gigante`. Es un flujo de preguntas paso a paso que hoy compite con Voni y con "Cotizar de línea". **Vale la pena decidir explícitamente si sigue viva**: si no, se van 258 líneas de JSX y ~25 reglas de CSS huérfanas; si sí, hay que reconciliar por qué su precio es de 54 px y el de la propuesta de 20.

---

# LAS 3 COSAS QUE HAY QUE HACER **HOY** PARA EL EFECTO WOW

Las tres se aplican en **menos de una hora entre todas**, ninguna toca lógica de negocio ni el motor de cálculo, y las tres se notan **desde el primer segundo** en que alguien abre la app.

---

### ① El total, grande. (15 min · sólo CSS)
Pegar el bloque de **§1·A** en `estilos.css` y los tres renglones de **§1·B** en `Voni.jsx:158-161`.

**Qué cambia:** el TOTAL de la propuesta pasa de 20 px a 42 px; la cantidad "2" baja de 22 a 17; el botón `−` deja de ser el elemento más grande de la pantalla. El total del proyecto en Voni pasa de un `<strong>` de 18 px a una barra negra con el número a 38 px.

**Se nota:** en el segundo en que abres cualquier cotización. Es el cambio que convierte "una tabla" en "un documento".

---

### ② Fotos de producto en las listas. (25 min · 1 export + 3 bloques de 3 líneas + 1 clase CSS)
Aplicar **§2·A** (mover `fotoPartida` a `imagenes.js` y exportarlo), **§2·B** (la clase `.mini-part`) y pegar el mismo bloque de 3 líneas en **§2·C, D y E**.

**Qué cambia:** las cuatro listas de partidas —la de Voni, la del vendedor, la interna y las tarjetas móviles— dejan de ser texto y muestran el render real del mueble. Cero costo de generación: los 118 renders ya están subidos y servidos.

**Se nota:** en el primer scroll. Es la diferencia visible entre esta app y una hoja de cálculo, y es lo que el cliente ve cuando el vendedor le gira el teléfono.

---

### ③ El home enseña producto, no un robot. (15 min · 1 style + 4 líneas JSX + 2 reglas CSS)
Aplicar **§3·A** (showroom Cirque detrás de la tarjeta de Voni, con el gradiente actual encima) y **§3·B** (la franja `24 líneas · 118 productos · 68 años`). Opcionalmente, bajar el avatar de 64 a 44 px y quitarle el `bob`.

**Qué cambia:** la primera pantalla pasa de "gradiente negro con un robot de caricatura" a "showroom Von Haucke con la promesa encima y la prueba de oficio debajo".

**Se nota:** literalmente en el primer segundo. Es la pantalla que decide si esto se ve como una herramienta de una empresa de 68 años o como una demo.

---

**Total: ~55 minutos. Cero riesgo para el motor. Todo revertible con `git checkout`.**

Lo demás de este documento (los 22 segundos de Voni, los momentos silenciosos, los 10 controles táctiles, los tokens, lo que sobra) es la semana siguiente — pero si sólo hay una hora, esas tres son las que cambian lo que la gente siente al abrir la app.
