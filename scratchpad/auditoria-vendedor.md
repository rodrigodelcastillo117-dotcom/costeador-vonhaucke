# Auditoría del Costeador — recorrido como VENDEDOR

**Fecha:** 2026-08-16 · **Rol probado:** `vendedor` (`esVendedor = !esDireccion && !esDiseno`, `App.jsx:250`)
**Nada se desplegó. Nada se editó dentro de `src/`.** Todo lo de abajo está reproducido en vivo.

## Cómo se probó

`humo.html` monta 48 de 48 pantallas sin error — pero **casi todas con `soloVentas={false}`**
(`humo.jsx:194-233`). O sea: la prueba de humo nunca ha ejercitado el camino del vendedor.
Sólo la fila `'Propuesta (vista cliente)'` lo hace.

Para poder recorrerlo se montó un banco de pruebas propio, **fuera de `src/`**:

- `scratchpad/vendedor.html` + `scratchpad/vendedor.jsx` → `http://localhost:5175/scratchpad/vendedor.html`

Monta Inicio, Cotizar de línea (las 24), Banco, Catálogo, Cotización, Asistente y Guía
**con `soloVentas` prendido y `veCostos` apagado**, igual que se los entrega `App.jsx`.
No toca la app en vivo. (Vite no lo incluye en el build: `deploy.sh` compila desde `index.html`.)

---

# BLOQUEANTES — rompen la venta hoy

## 1. En el Catálogo el botón dice "Agregar" y no agrega nada: te tira a un muro sin salida

**Qué está mal.** Un vendedor entra al Catálogo, escoge un mueble, ve el precio, aprieta
**"Agregar"** — y no se agrega nada; la app lo saca de ahí y lo deja en una pantalla que sólo
le dice que eso no es para él, sin un solo botón para regresar.

**Dónde.**
- `src/componentes/Catalogo.jsx:62` — el botón se rotula `Agregar` cuando `soloVentas`.
- `src/App.jsx:472-475` — `onElegirDelCatalogo` hace `setCosteo(...)` + `irA('costeador')`. Nunca llama a `sumarPartidas`.
- `src/App.jsx:614-622` — `costeador` con `veCostos=false` renderiza el muro.

**Cómo lo reproduje.**
1. Inicio → Cotizar → Cotizar de línea → grupo **Herramientas** → *Otra línea de catálogo*.
2. Abrí *Escritorios y operativos* → *Escritorio* → **Ver lineas**.
3. Apreté **Agregar** en App LT ($3,257).
4. Leí el estado en una llamada aparte: `vista: "costeador"`, **`partidas: "0"`**.
   En pantalla, texto completo: *"El modo avanzado y el costo de fabricación son para Diseño y
   Dirección. Usa **Cotizar un mueble** para el precio recomendado."*

**Por qué importa.** Aprieta un botón que dice Agregar, no pasa nada, y el letrero lo manda a
"Cotizar un mueble" — **una pantalla que en su menú no existe con ese nombre** (a él le dice
"Cotizar especial (a la medida)"). No hay botón de salida en ese muro. Con el cliente enfrente,
esto es el momento en que cierra la laptop y saca el Excel. Y es el único camino de la app en
que un botón primario miente.

**El arreglo propuesto (NO aplicado).**

En `src/App.jsx`, que el Catálogo agregue de verdad cuando es vendedor, en vez de navegar:

```diff
   // El catálogo carga una receta en el costeador y te lleva ahí.
   function onElegirDelCatalogo(nuevoCosteo) {
+    // Un vendedor no puede abrir el Costeador: para él el Catálogo COTIZA.
+    if (esVendedor) {
+      const r = calcular(nuevoCosteo, 1, estado.insumos, estado.parametros);
+      const m = estado.parametros.margenObjetivo ?? 50;
+      agregarDesdeAsistente(nuevoCosteo, 1, r.costoUnitario / (1 - m / 100), m);
+      irA('cotizacion');
+      return;
+    }
     setCosteo(nuevoCosteo);
     irA('costeador');
   }
```

Y que ningún muro de rol sea un callejón sin salida — en los tres de `App.jsx:606-640`:

```diff
-  : <div className="contenido"><div className="tarjeta"><p className="ayuda">El modo avanzado y el costo de fabricación son para Diseño y Dirección. Usa <strong>Cotizar un mueble</strong> para el precio recomendado.</p></div></div>
+  : <div className="contenido"><div className="tarjeta">
+      <h3>Esta pantalla es de Diseño</h3>
+      <p className="ayuda columna-texto">Aquí se ve cuánto cuesta fabricar, y eso lo lleva Diseño. Tú cotizas desde las líneas: ahí sale el precio ya listo.</p>
+      <button className="boton primario grande" onClick={() => irA('inicio')}>Ir a cotizar</button>
+    </div></div>
```

---

## 2. La banca sencilla de 6 puestos sale 69% más cara que la doble de 6 puestos

**Qué está mal.** La escalera de precio por usuario que se calibró contra presupuestos cerrados
**sólo aplica a `banca_doble`**. La banca sencilla se queda con el modelo sin calibrar, y para
los mismos 6 lugares escupe un precio 69% mayor — siendo el mueble más barato de los dos.

**Dónde.** `src/datos/preciosVenta.js:202`

```js
if (!cfg || cfg.producto !== 'banca_doble') return null;
```

**Cómo lo reproduje.** Corrí el mismo cálculo que hace `CosteadorLinea.jsx:64-81`, App LT 1.50 m,
melamina:

| Producto | Usuarios | Precio de lista | Por usuario | De dónde sale |
|---|---|---|---|---|
| Banca **sencilla** | 6 | **$33,234** | $5,539 | modelo (sin calibrar) |
| Banca **doble** | 6 | **$19,710** | $3,285 | escalera calibrada |
| Banca sencilla | 4 | $23,023 | $5,756 | modelo |
| Banca doble | 4 | $22,590 | $5,648 | precio real |

A 4 usuarios coinciden (−2%). A 6 se abren **69%**, porque la escalera baja por volumen y el
modelo no.

**Por qué importa.** Una sala operativa de 6 lugares en fila es de lo más común que cotiza. Si la
pide sencilla, manda $33,234 donde la empresa cobra ~$19,710: pierde el proyecto y ni sabe por
qué. Si el cliente le pide la doble para comparar, ve que la doble —que lleva **más** material—
cuesta menos, y el vendedor no tiene cómo explicarlo. La pantalla sólo dice "≈ Estimado", que no
alcanza a advertir de un 69%.

**El arreglo propuesto (NO aplicado).** En `src/datos/preciosVenta.js`, abrir la escalera a la
banca sencilla derivándola por puesto (media banca por usuario), y marcarlo como derivado:

```diff
 export function precioPorUsuarioAppLT(cfg) {
-  if (!cfg || cfg.producto !== 'banca_doble') return null;
+  if (!cfg) return null;
+  if (cfg.producto !== 'banca_doble' && cfg.producto !== 'banca_sencilla') return null;
   const n = cfg.usuarios;
   const tabla = APPLT_POR_USUARIO.banca_doble;
```

```diff
   const fl = FACTOR_LARGO[cfg.largoMM] ?? 1;
-  return { lista: Math.round(porU * fl * n), porUsuario: Math.round(porU * fl), derivado: fl !== 1 };
+  // La sencilla no comparte estructura entre dos filas: se calibra aparte.
+  const fp = cfg.producto === 'banca_sencilla' ? (APPLT_FACTOR_SENCILLA ?? 1.15) : 1;
+  return { lista: Math.round(porU * fl * fp * n), porUsuario: Math.round(porU * fl * fp),
+           derivado: fl !== 1 || fp !== 1 };
 }
```

**Antes de aplicarlo hay que preguntarle a Rodrigo el factor real de sencilla vs doble por puesto.**
El `1.15` es un tapón, no un dato. Mientras no haya ese número, el arreglo mínimo y honesto es
que la pantalla grite cuando el precio viene del modelo puro en un producto que tiene hermano
calibrado (ver §4 del arreglo de la etiqueta "Estimado").

---

## 3. El mismo escritorio App LT vale $3,257 en una pantalla y $6,054 en otra

**Qué está mal.** El Catálogo cuesta con las recetas viejas (`PIEZAS_SEMILLA`); las pantallas de
línea cuestan con los generadores calibrados. Al vendedor le quedan dos precios del mismo mueble
con **86% de diferencia**, y nada le dice cuál vale.

**Dónde.**
- `src/componentes/Catalogo.jsx:18-29` — `costoDeLinea()` sale de `recetaDe()` → `PIEZAS_SEMILLA`.
- `src/componentes/CosteadorLinea.jsx:64-79` — precio del generador + price-book.

**Cómo lo reproduje.**
- Catálogo → *Escritorios y operativos* → *Escritorio* → renglón **App LT**: **$3,257** (etiquetado *MÁS BARATA*).
- Cotizar de línea → **App LT** → producto *Escritorio*, 1.50 m × 0.60 m: **$6,054**.

Ambas pantallas están a dos clics una de otra en el mismo menú, y ambas son suyas.

**Por qué importa.** Cotiza $3,257 porque la app se lo puso al frente y hasta le puso etiqueta
verde de "MÁS BARATA". La orden entra a producción al costo real y la empresa vende a la mitad.
O al revés: el cliente le pidió el barato que vio y no se lo puede sostener.

**El arreglo propuesto (NO aplicado).** El Catálogo no debe cotizar en paralelo: debe mandar a la
línea. En `src/componentes/Catalogo.jsx:61-62`, para vendedor, quitar el precio de receta vieja y
dejar sólo el pase a la línea calibrada:

```diff
-            {costo != null ? <div className="dinero">{pesos(aMostrar(costo))}</div> : <span className="etiqueta-dato supuesto">sin receta</span>}
-            <button className="boton primario" onClick={() => cargar(linea, mueble.muebleId, mueble.familiaId, estado, onCargar)}>{soloVentas ? 'Agregar' : 'Usar'}</button>
+            {soloVentas
+              ? <button className="boton primario" onClick={() => onIrLinea(linea.id)}>Ver precios y medidas ›</button>
+              : <>
+                  {costo != null ? <div className="dinero">{pesos(costo)}</div> : <span className="etiqueta-dato supuesto">sin receta</span>}
+                  <button className="boton primario" onClick={() => cargar(linea, mueble.muebleId, mueble.familiaId, estado, onCargar)}>Usar</button>
+                </>}
```

(requiere pasarle `onIrLinea` desde `App.jsx:623`, que ya tiene `irA`.)

---

## 4. El descuento no tiene tope: 999 deja el total en NEGATIVO, y −50 mete un recargo invisible

**Qué está mal.** El campo "Descuento de proyecto (%)" acepta cualquier cosa. El `max="60"` del
HTML **no impide teclear**; sólo pinta la flechita.

**Dónde.** `src/componentes/Cotizacion.jsx:297`

```jsx
<input type="number" className="numero" style={{ width: 90 }} min="0" max="60"
  value={descuentoPct} onChange={(e) => setCot({ descuentoPct: parseFloat(e.target.value) || 0 })} />
```

**Cómo lo reproduje.** Cotización de vendedor con 2 partidas ($12,108 de lista). Escribí en ese campo:

| Escribí | Qué queda | Qué ve el cliente en la propuesta |
|---|---|---|
| `999` | 999 | Descuento 999% · Subtotal **−$108,849** · **TOTAL −$126,265** · "Anticipo 50%: **−$63,132**" |
| `-50` | −50 | Lista $12,108 → Subtotal $18,162 → **TOTAL $21,068**, y **NO aparece ningún renglón que lo explique** |
| `1e9` | 1e9 | **TOTAL −$140,450,088,205** |
| `12,5` | 0 | vuelve a 0% **sin decir nada** |
| `abc` | 0 | vuelve a 0% **sin decir nada** |

**Por qué importa.** Tres cosas distintas, todas malas:
- **`12,5` → 0%.** Un mexicano escribe la coma decimal. Quiso 12.5% de descuento, mandó 0%, y la
  app no le avisó. Va a discutir con el cliente un descuento que la propuesta no trae.
- **`-50` → recargo del 50% mudo.** El renglón "Descuento" está detrás de `descuento > 0`
  (`Cotizacion.jsx:436`), así que el precio sube $9,000 y **no hay una sola línea en el documento
  que lo justifique**. Es el peor de los tres porque es invisible.
- **`999` → total negativo** con "Anticipo −$63,132" impreso. Se descarga y se manda así.

**El arreglo propuesto (NO aplicado).** Limpiar la entrada y avisar en español llano:

```diff
+  // Un número de verdad, con coma o punto, y dentro del rango. Nunca NaN callado.
+  const aPct = (txt, max) => {
+    const t = String(txt).trim().replace(',', '.');
+    if (t === '') return 0;
+    const n = parseFloat(t);
+    if (!Number.isFinite(n)) return null;      // 'abc' → avisa, no borra
+    return Math.min(max, Math.max(0, n));
+  };
+  const [avisoDesc, setAvisoDesc] = useState('');
```

```diff
-          <input type="number" className="numero" style={{ width: 90 }} min="0" max="60" value={descuentoPct} onChange={(e) => setCot({ descuentoPct: parseFloat(e.target.value) || 0 })} />
+          <input type="text" inputMode="decimal" className="numero" style={{ width: 90 }} value={descuentoPct}
+            onChange={(e) => {
+              const n = aPct(e.target.value, 60);
+              if (n === null) { setAvisoDesc('Escribe sólo el número, por ejemplo 12.5'); return; }
+              setAvisoDesc(n !== parseFloat(String(e.target.value).replace(',', '.')) ? 'El descuento máximo es 60%.' : '');
+              setCot({ descuentoPct: n });
+            }} />
+        </div>
+        {avisoDesc && <div className="alerta ambar"><span className="texto">{avisoDesc}</span></div>}
```

Lo mismo para "Contingencia" (`Cotizacion.jsx:302`, tope 50).

---

# GRAVES

## 5. La reja de rol tapa los números pero el texto regala el margen

**Qué está mal.** El vendedor no ve la columna "Margen" — pero la app le imprime en pantalla,
con todas sus letras, **cuánto margen lleva el precio de lista y cuál es el piso de la empresa**.
En la misma pantalla que voltea hacia el cliente.

**Dónde.**
- `src/componentes/CosteadorLinea.jsx:233-234` — visible siempre, `soloVentas` sólo tapa la parte de "Costo:":
  > *"Precio de lista (**el precio 2 ya lleva su 40%**); el descuento de proyecto va aparte."*
- `src/componentes/Guia.jsx:127-128` — sección `propuesta`, marcada `v: 'todos'`, o sea **la lee Ventas**:
  > *"Se aplica sobre el precio de lista, que ya trae **50% de margen**."*
  > *"...ninguna partida debe quedar con menos de **45% de utilidad sobre el costo**."*
- `src/componentes/Guia.jsx:38-46` — la barra ilustrada del mismo tema dibuja el bloque **"Utilidad 50%"**.
- `src/componentes/Cotizacion.jsx:304` — *"deja 2 partida(s) por debajo del **margen permitido**"*.

**Cómo lo reproduje.** En modo vendedor abrí la Guía (`rol="ventas"`) y filtré el cuerpo por
`/margen|utilidad|costo/i`. Devolvió exactamente:
`["Se aplica sobre el precio de lista, que ya trae 50% de margen."]`.
En App LT leí la tarjeta de precio: `"Precio de lista (el precio 2 ya lleva su 40%); el descuento de proyecto va aparte."`

**Por qué importa.** Toda la arquitectura de roles existe para que ninguna pantalla del vendedor
exponga utilidad frente al cliente (así lo dice la propia Guía, `Guia.jsx:74`). Y luego la letra
chiquita publica 40%, 50% y 45%. Es peor que una columna: la columna la esconde, esta frase la
lee el cliente por encima del hombro. Además **40% y 50% se contradicen entre sí** en dos
pantallas del mismo vendedor.

**El arreglo propuesto (NO aplicado).**

```diff
           <div className="ayuda gris" style={{ fontSize: 11 }}>
-            Precio de lista (el precio 2 ya lleva su 40%); el descuento de proyecto va aparte.{!soloVentas && <> Costo: <strong className="mono">{pesos(costoModulo)}</strong></>}
+            {soloVentas
+              ? 'Este es el precio de lista. El descuento del proyecto se aplica después, en tu cotización.'
+              : <>Precio de lista (el precio 2 ya lleva su 40%); el descuento de proyecto va aparte. Costo: <strong className="mono">{pesos(costoModulo)}</strong></>}
           </div>
```

Y en `src/componentes/Guia.jsx`, partir el tema del descuento en dos versiones según rol:

```diff
-        { t: 'Descuento de proyecto', r: `Se aplica sobre el precio de lista, que ya trae ${margenObjetivo}% de margen.`,
-          d: `Escribes el porcentaje y se aplica a toda la propuesta. Hay un piso: ninguna partida debe quedar con menos de ${minMarkup}% de utilidad sobre el costo. Si te pasas, esas partidas se marcan y ese descuento necesita visto bueno de Dirección.`,
+        { t: 'Descuento de proyecto', v: 'todos',
+          r: 'Se aplica sobre el precio de lista de toda la propuesta.',
+          d: 'Escribes el porcentaje y se aplica a todos los renglones. Hay un límite: si te pasas, los renglones afectados se marcan en rojo y ese descuento necesita el visto bueno de Dirección antes de mandarlo.',
```

...y dejar la versión con los porcentajes en una entrada nueva marcada `v: 'costos'`.
El bloque `demo: 'precio'` (que dibuja "Utilidad 50%") debe quedarse sólo en la versión `costos`.

---

## 6. "Quitar" borra al instante. No pregunta, no se deshace, ni siquiera avisa

**Qué está mal.** Un clic en Quitar y la partida desaparece con toda su configuración (medidas,
acabado, biombo, usuarios). No hay confirmación, no hay "Deshacer", no hay Ctrl+Z.

**Dónde.**
- `src/componentes/Cotizacion.jsx:127` — `const quitar = (i) => setCot({ partidas: partidas.filter((_, j) => j !== i) });`
- `src/componentes/Cotizacion.jsx:227` (lista del vendedor), `:264` y `:284` (vistas internas).
- `src/componentes/Voni.jsx:62` — el mismo `quitar` en la lista de Voni.

**Cómo lo reproduje.** Cotización de vendedor con 2 partidas. Apreté el primer `Quitar`.
En una llamada aparte: `partidas: "1"`, ningún diálogo (`document.querySelector('dialog,[role=alertdialog]')` → null),
ningún toast, y ninguna palabra "deshacer/recuperar/restaurar" en toda la pantalla.

Nota: el botón *Vaciar* de Voni (`Voni.jsx:63,68`) **sí** confirma. El de Quitar, que es el que
se usa 50 veces al día, no.

**Por qué importa.** El "Quitar" está pegado al `+` de cantidad y mide 71×38 px. Con prisa y con
dedo grueso, se le va. En una propuesta de 20 renglones no se va a acordar de cuál era ni con qué
medida y acabado estaba: tiene que volver a la línea y rearmarlo. Eso es el trabajo de 5 minutos
que lo hace desconfiar de la app para siempre.

**El arreglo propuesto (NO aplicado).** Deshacer con ventana de gracia, no confirmación (un
diálogo por renglón cansa más de lo que ayuda):

```diff
+  const [ultimoBorrado, setUltimoBorrado] = useState(null); // {partida, i}
+  const quitar = (i) => {
+    setUltimoBorrado({ partida: partidas[i], i });
+    setCot({ partidas: partidas.filter((_, j) => j !== i) });
+  };
+  const deshacer = () => {
+    if (!ultimoBorrado) return;
+    const ps = partidas.slice();
+    ps.splice(ultimoBorrado.i, 0, ultimoBorrado.partida);
+    setCot({ partidas: ps });
+    setUltimoBorrado(null);
+  };
-  const quitar = (i) => setCot({ partidas: partidas.filter((_, j) => j !== i) });
```

Y arriba de la lista del vendedor (`Cotizacion.jsx:212`):

```diff
+            {ultimoBorrado && (
+              <div className="alerta ambar" style={{ marginBottom: 10 }}>
+                <span className="texto">Quitaste <strong>{ultimoBorrado.partida.nombre}</strong>.</span>
+                <button className="boton" style={{ minHeight: 44 }} onClick={deshacer}>Deshacer</button>
+              </div>
+            )}
```

Aplicar igual en `Voni.jsx`.

---

## 7. Los buscadores no encuentran lo que un vendedor escribe

**Qué está mal.** Los tres buscadores (líneas, Banco, catálogo) hacen un `includes()` sobre la
cadena pegada. Eso significa: **si escribes dos palabras, no encuentra nada**; los acentos son
volado; y "rio" trae 82 resultados equivocados.

**Dónde.**
- `src/componentes/Inicio.jsx:133` — `(l.titulo + ' ' + l.desc + ' ' + l.grupo).toLowerCase().includes(t)`
- `src/componentes/Banco.jsx:25` y `:40` — mismo patrón.
- `src/componentes/Banco.jsx:60` — el `placeholder`.

**Cómo lo reproduje.** Corrí el filtro real contra los datos reales (218 del banco, 118 del
catálogo, 23 líneas):

| Lo que escribiría un vendedor | Líneas | Banco | Catálogo |
|---|---|---|---|
| `bench 6 lugares` | **0** | **0** | **0** |
| `archivero 2 cajones` | **0** | **0** | **0** |
| `silla operativa` | **0** | 15 | 0 |
| `escritorio ejecutivo` | **0** | — | — |
| `mesa juntas` | — | **0** | **0** |
| `escritorio 1.50` | — | **0** | **0** |
| `modulo 1.20` | **0** | **0** | **0** |
| `arlequin` (sin acento) | **0** | **0** | 0 |
| `arlequín` | 1 | 0 | 1 |
| `via` (sin acento) | **0** | **0** | **0** |
| `vía` | — | 0 | 6 |
| `rio` (sin acento) | **10 líneas, ninguna es Río** | **82** | **32** |
| `río` | 1 | 2 | 6 |
| `recepción` | **0** | — | — |
| `recepcion` | 1 | — | — |
| `1200 x 600` (con la x del teclado) | — | **0** | 0 |
| `1200 × 600` (el signo del placeholder) | — | 4 | 0 |
| `eclipe` / `archivro` (dedazo) | **0** | **0** | **0** |

**Por qué importa.** Cuatro cosas, todas a la cara del usuario:
- **Dos palabras = cero.** Nadie busca con una sola palabra. "mesa juntas" da 0 y "mesa de juntas"
  da 18. El vendedor concluye que el mueble no existe y se va a otro lado.
- **`rio` → 82 resultados basura** porque "rio" está dentro de "escrito**rio**". Y la línea Río
  no aparece entre ellos. Es peor que no encontrar: encuentra mal y con confianza.
- **Los acentos deciden el resultado**, y no de forma consistente: `recepcion` sí, `recepción` no;
  `arlequin` no, `arlequín` sí. Nadie va a adivinar la regla.
- **El placeholder pide un carácter que no está en el teclado.** `Banco.jsx:60` dice literalmente
  *"1200 × 600"* con el signo de multiplicación `×`. Escrito con la `x` normal: 0 resultados.
  La app le está enseñando a fallar.

**El arreglo propuesto (NO aplicado).** Un normalizador compartido en `src/util.js`:

```js
// Quita acentos, unifica la × y parte la consulta en palabras: todas deben
// aparecer, en cualquier orden. Así "mesa juntas" y "juntas mesa" encuentran igual.
export function normalizar(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[×✕]/g, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}
export function coincide(texto, consulta) {
  const t = normalizar(texto);
  const palabras = normalizar(consulta).split(' ').filter(Boolean);
  return palabras.every((p) => t.includes(p));
}
```

En `Banco.jsx:25`:

```diff
-      return `${p.nombre} ${p.descripcion || ''} ${p.clave || ''} ${p.medidas || ''} ${p.material || ''} ${p.linea || ''}`
-        .toLowerCase().includes(q);
+      return coincide(`${p.nombre} ${p.descripcion || ''} ${p.clave || ''} ${p.medidas || ''} ${p.material || ''} ${p.linea || ''}`, busca);
```

En `Banco.jsx:40` y `Inicio.jsx:133`, el mismo cambio. Y el placeholder:

```diff
-        <input type="text" placeholder="Buscar por línea, clave o medida: App LT, TATO84812, 1200 × 600, archivero…"
+        <input type="text" placeholder="Busca como quieras: bench 6 lugares, archivero 2 cajones, App LT, TATO84812, 1200 x 600…"
```

**Extra que vale mucho y cuesta poco:** el filtro de líneas sólo mira `titulo + desc + grupo`.
Escribir "silla" da 0 en las 24 líneas, aunque Von Haucke vende 39 sillas en el Banco. Agregar
palabras clave a cada línea en `Inicio.jsx:14-44` (`claves: 'bench estacion puesto lugar'`, etc.)
y meterlas en la búsqueda, más un renglón de rescate: *"No hay líneas con «silla», pero el Banco
de precios tiene 39 → [Buscar en el Banco]"*.

---

# MEDIAS — jerga, letra chica y fricción

## 8. Jerga de ingeniero en la pantalla del vendedor

Todo esto lo lee un vendedor de 54 años, hoy, sin traducción:

| Dónde | Lo que dice | Cómo debería decirlo |
|---|---|---|
| `CosteadorLinea.jsx:109` | "El sistema arma el **despiece** con la guía oficial y te da el **costo real**." | "Escoge el producto y la medida; te doy el precio de lista." *(y además le promete un costo que nunca le va a enseñar)* |
| `CosteadorLinea.jsx:231` | "≈ Estimado por el modelo **(Intelisis)** — aún sin precio real de esta **config**" | "Precio aproximado. Todavía no hay un presupuesto cerrado con esta medida: confírmalo con Diseño antes de comprometerlo." |
| `CosteadorLinea.jsx:171` | "Complementos (**partidas** aparte)" | "Complementos (se cobran como renglones aparte)" |
| `CosteadorLinea.jsx:108` | título "**Costeador** APP LT" | "Cotizar APP LT" — el vendedor no costea, cotiza |
| `Inicio.jsx:49` | "Un mueble de catálogo con su **despiece y costo**." | "Busca un mueble por tipo y te llevo a su línea." |
| `Cotizacion.jsx:304` | "deja 2 **partida(s)** por debajo del margen permitido" | "Con este descuento, 2 muebles quedan por debajo de lo autorizado. Pide el visto bueno de Dirección." |
| `Catalogo.jsx:73` | "Escoge la familia, luego el mueble, luego la línea. **Se carga en el Costeador**." | "Escoge el tipo de mueble y te enseño en qué líneas existe, con su precio." |

Verificado en el DOM en vivo, no en el código: el texto de App LT en modo vendedor sale tal cual
*"El sistema arma el despiece con la guía oficial y te da el costo real."*

## 9. La letra de ayuda es demasiado chica y demasiado clara

**Dónde.** `src/estilos.css` (clases `.ayuda`, `.etiqueta`, `.gris`) y estilos en línea de
`CosteadorLinea.jsx:206,233` (`fontSize: 11`) y `:120` (`fontSize: 12`).

**Medido en vivo:** `.ayuda` y `.etiqueta` = **14 px** en `rgb(116,110,104)` sobre fondo
`rgb(243,241,237)` → **contraste 4.46:1**. El mínimo aceptado para texto normal es 4.5:1: no
llega. `.gris` = 12.5 px y el renglón del precio de lista = **11 px**, con el mismo color.

**Por qué importa.** Es *todo* el texto explicativo de la app —el que le dice qué hacer— y está
justo por debajo del umbral, en 11–14 px, para un usuario de 50+. Es el texto que más necesita
leer y el que peor se ve. En el celular, peor.

**El arreglo propuesto (NO aplicado).** En `src/estilos.css`, subir un escalón el tamaño y
oscurecer el gris lo justo para pasar 4.5:1 (a `#635E59` da ~5.6:1):

```diff
-.ayuda, .etiqueta { font-size: 14px; color: #746E68; }
+.ayuda, .etiqueta { font-size: 15px; color: #635E59; }
-.gris { font-size: 12.5px; color: #746E68; }
+.gris { font-size: 13.5px; color: #635E59; }
```

Y quitar los `fontSize: 11` en línea de `CosteadorLinea.jsx:206` y `:233` (que hereden `.gris`).

## 10. No se puede teclear una cantidad: 20 escritorios son 19 clics

**Dónde.** `CosteadorLinea.jsx:215-219` y `:269-273`; `Cotizacion.jsx:216-220` (lista del
vendedor); `Voni.jsx` en la lista de muebles. Todos son `− valor +` sin campo escribible.
El único lugar donde sí se puede teclear un número es el Banco (`Banco.jsx:108`).

**Por qué importa.** Un proyecto de oficina se cotiza de 20 en 20, no de 1 en 1. Y si se pasa,
tiene que bajarlo clic por clic.

**El arreglo propuesto (NO aplicado).** Hacer editable el número del `masmenos`:

```diff
-              <span className="valor" style={{ fontSize: 18, minWidth: '2ch' }}>{cantidad}</span>
+              <input className="valor" type="text" inputMode="numeric" style={{ fontSize: 18, width: '4ch', textAlign: 'center', border: 0, background: 'transparent' }}
+                value={cantidad} aria-label="Cantidad"
+                onChange={(e) => { const n = parseInt(String(e.target.value).replace(/\D/g, ''), 10); setCantidad(Number.isFinite(n) && n > 0 ? Math.min(999, n) : 1); }} />
```

## 11. El Catálogo no tiene buscador — y es justo lo que pidieron los 7 proyectistas

**Dónde.** `src/componentes/Catalogo.jsx:70-99`. Confirmado en vivo:
`document.querySelector('input[type=text]')` → **null**.

Son tres niveles de acordeón (familia → mueble → línea) para llegar a un producto. Inicio y Banco
sí tienen buscador; el Catálogo no. Los 7 proyectistas dijeron que prefieren **una lista con
buscador**, no navegar por menús. Aquí es puro menú.

**El arreglo propuesto (NO aplicado).** Reusar el mismo `<div className="buscador">` de
`Inicio.jsx:275-279` arriba de las familias, filtrando sobre `MUEBLES` + `FAMILIAS` con la
función `coincide()` de §7, y enseñar los muebles sueltos (sin acordeón) cuando hay consulta.

## 12. En celular, las casillas que cambian el precio miden 20×20 px

**Dónde.** `CosteadorLinea.jsx:164` — `<input type="checkbox">` sin tamaño propio.

**Medido en vivo** con el viewport en 375×812, en App LT: los checkboxes de *Faldón* y
*Electrificación (aparte)* salen **20×20 px**. El mínimo cómodo es 44×44. Y son los que cambian
el precio.

Lo demás de la barra de compra móvil está bien: 67 px de alto, pegada abajo, con precio, cantidad
y Agregar. Eso sí funciona.

**El arreglo propuesto (NO aplicado).** En `src/estilos.css`:

```diff
+.check input[type="checkbox"] { width: 26px; height: 26px; }
+.check { display: flex; align-items: center; gap: 12px; min-height: 48px; font-size: 16px; }
```

## 13. El costo sí llega al navegador del vendedor, aunque la Guía diga que no

**Dónde.** `src/App.jsx:114-122` (`compartidoSeguro` comparte `insumos` y `piezas` con todos),
`src/almacen.js:15` (`PARAMS_SENSIBLES` sólo cubre nómina), `src/App.jsx:380-401`
(`partidaDeCosteo` calcula y **guarda** `costoUnitario` en cada partida, que se persiste en
`localStorage` vía `guardar(estado)` en `App.jsx:330`).

La Guía le dice al vendedor (`Guia.jsx:74`): *"Lo que no te toca no se te esconde: no se te manda."*
Para la nómina y los financieros es cierto. **Para los costos de material y el costo de cada
partida, no.** Están en su navegador; sólo no se pintan.

**Por qué importa.** No es un agujero que se explote por accidente, pero la frase de la Guía es
una promesa que la app no cumple, y ésa es la clase de cosa que se descubre en el peor momento.
Es decisión de Rodrigo si vale la pena moverlo — mover los costos al servidor es trabajo mayor.
Lo mínimo, hoy, es **no prometer de más**:

```diff
-          d: 'Tu correo define lo que puedes abrir... Lo que no te toca no se te esconde: no se te manda.' },
+          d: 'Tu correo define lo que puedes abrir, y lo aplica la base de datos, no la pantalla. Ventas ve precios pero nunca costo de fabricación ni utilidad, para que ninguna pantalla suya exponga eso frente a un cliente. Diseño y Proyectos ve además todo el costeo y los precios de material. Dirección ve todo, más el tablero, los accesos, la nómina y los estados financieros. La nómina y los estados financieros ni siquiera se le mandan a quien no es Dirección.' },
```

---

# Cuántos clics cuesta un bench de 6 puestos

Contados uno por uno en el recorrido real (App LT, banca sencilla, 6 usuarios):

| # | Clic | Pantalla |
|---|---|---|
| 1 | "Cotizar" (tarjeta VENDER) | Inicio |
| 2 | "Cotizar de línea" | Inicio · cotizar |
| 3 | Abrir el grupo "Operativo / benching" | Inicio · cotizarlinea |
| 4 | Tarjeta "App LT" | idem |
| 5 | Chip "Banca sencilla" | App LT |
| 6 | Chip "1.50 m" (largo) — **obligatorio**, ver abajo | App LT |
| 7 | Chip "6" (usuarios) | App LT |
| 8 | "Agregar a la cotización" | App LT |

**8 clics.** Y el 6 es forzoso por un detalle: `CosteadorLinea.jsx:45` arranca el largo en
`p.largos[1]`, o sea **la segunda opción de la lista**, no la más usada. Para *Escritorio* eso cae
en 1.50 m (bien, por casualidad); para *Banca sencilla* los largos son `[1.05, 1.20, 1.50, 1.80]`
y arranca en **1.20 m**. Verificado en vivo: al entrar, el chip prendido era "1.20 m". El vendedor
que no se fije cotiza a 1.20 y ni cuenta se da.

**Se puede en menos: 4.**
1. En el Inicio, "Tus líneas más usadas" ya existe (`Inicio.jsx:208-217`) pero sólo aparece
   *después* de haber entrado varias veces, y **no aparece en el panel de Cotizar**, que es donde
   se necesita. Subirlo ahí ahorra los clics 3 y 4.
2. Poner el largo por omisión en el **más vendido de cada producto**, declarado en los datos, en
   vez de `[1]`:

```diff
-    if (p.largos) setLargo(p.largos[1] || p.largos[0]);
+    if (p.largos) setLargo(p.largoDefault ?? p.largos[1] ?? p.largos[0]);
```

...y declarar `largoDefault: 1500` en `banca_sencilla` / `banca_doble` de `src/datos/applt.js`.
Eso quita el clic 6.

Resultado: **Cotizar → App LT (favorita) → "6" → Agregar = 4 clics.**

---

# Lo que me hizo perder tiempo (por segundos perdidos)

1. **El buscador que no encuentra** (~90 s por búsqueda fallida, varias veces). Escribí
   "bench 6 lugares", "mesa juntas", "archivero 2 cajones", "silla operativa": cero resultados en
   todos. Luego probé sin acentos y con acentos hasta dar con la combinación. Después escribí
   "rio" y me salieron 82 cosas, ninguna de la línea Río. Es lo más caro de toda la app porque
   pasa antes de cada cotización. → §7
2. **El "Agregar" del Catálogo que no agrega** (~60 s la primera vez, e infinitos después).
   Aprieto, no pasa nada visible, aparece un muro sin botón, no sé si agregó o no, vuelvo,
   lo aprieto otra vez. Nunca voy a entender solo que ese camino simplemente no existe para mí. → §1
3. **Descubrir que el largo arrancó en 1.20 y no en 1.50** (~40 s, y sólo si tengo suerte).
   Cotizas, ves un precio que no cuadra, regresas a buscar qué está mal. → click count
4. **Poner cantidad 20 a puros clics** (~35 s y 19 clics). Y si me paso, otros tantos de regreso. → §10
5. **Leer la letra de 11 px en gris claro** (~20 s cada vez que la busco con los ojos). Es
   exactamente donde vive la advertencia de "Estimado" y la nota del precio. → §9
6. **Los tres niveles del Catálogo sin buscador** (~30 s por mueble). Familia → mueble → línea,
   todo plegado, sin campo de búsqueda. → §11
7. **Escribir "12,5" de descuento y que se ponga en 0 sin decir nada** (~20 s… si lo noto.
   Si no lo noto, cuesta el proyecto). → §4

---

# Lo que sí está bien — no lo toquen

- **La barra de compra fija en celular** (`CosteadorLinea.jsx:264-275`). 67 px de alto, pegada
  abajo, con precio + cantidad + Agregar siempre a la vista. En una pantalla de 2,114 px de
  scroll, eso es lo que salva el flujo. Está bien pensada.
- **La confirmación de "Agregado: X. Puedes seguir escogiendo y se van sumando."**
  (`CosteadorLinea.jsx:252-257`) con el botón "Ver mi cotización (n)". Confirma sin sacarte de la
  pantalla. Es exactamente el patrón correcto para cotizar 6 muebles seguidos.
- **El carrito global del encabezado** (`App.jsx:539-543`): desde cualquier pantalla se ve cuántos
  llevas y se salta a la cotización. Sin esto uno se pierde.
- **La barra de "‹ Atrás / Inicio" en todas las pantallas** (`App.jsx:562-568`) y el
  `SinPantallaBlanca`. Nunca te quedas encerrado (salvo en los muros de rol, §1).
- **"Vas a la mitad"** en el Inicio (`Inicio.jsx:167-176`): retomar la cotización a medias es más
  común que empezar de cero, y está al frente con el nombre del cliente y el total. Muy bien.
- **La alerta ámbar del Banco** ("estos precios ya traen el descuento del proyecto de donde
  salieron; se descontarían dos veces", `Banco.jsx:57-59`). Está en español llano, dice la
  consecuencia y no la causa técnica. Es el modelo de cómo debería escribirse todo lo demás.
- **La nota "Ojo:" del precio real** (`CosteadorLinea.jsx:228`), la que avisa que la mesa de
  juntas ya trae las cajas eléctricas. Ese aviso evita cobrar 19% de más. Excelente.
- **`EditarPartida`** completo. Se abre el mueble con sus opciones reales, se recotiza en vivo,
  enseña el delta ("+$1,200 por pieza"), tiene Escape, devuelve el foco, y **no filtra ni un
  costo ni un margen**. Es la pantalla mejor hecha de la app. No la toquen.
- **`Asistente.jsx:203-230`** — el corte por rol está bien hecho: al vendedor le dice "Este es el
  precio recomendado" y le esconde el "Cuesta hacer 1 pieza", los botones de margen y la
  HojaCosto. Así debería verse el resto.
- **La prueba de humo misma** (`humo.jsx`). 48 de 48 montan, con red por pantalla. Lo único que le
  falta es correr también el camino del vendedor (ver abajo).

---

# Recomendación sobre la prueba de humo

`humo.jsx:194-233` monta casi todo con `soloVentas={false}`. Por eso ninguno de los hallazgos
§1, §5 y §8 se veía. Vale la pena duplicar en `PANTALLAS` las 4 pantallas que el vendedor
realmente usa, con la reja puesta:

```diff
   ['Banco de precios', <Banco onAgregar={nada} onIr={nada} />],
   ['Catálogo', <Catalogo estado={estado} onCargar={nada} soloVentas={false} />],
+  ['Catálogo · VENDEDOR', <Catalogo estado={estado} onCargar={nada} soloVentas />],
+  ['Guía · VENDEDOR', <Guia primeraVez={false} onIr={nada} onCerrar={nada} estado={estado} rol="ventas" />],
+  ['Línea App LT · VENDEDOR', <CosteadorLinea onIr={nada} linea="applt" soloVentas estado={estado}
+     titulo="Costeador APP LT" productos={LINEAS_REG.applt.productos} generar={LINEAS_REG.applt.generar}
+     onAgregar={nada} onAgregarModulo={nada} />],
```

Con eso, un `grep` sobre el DOM de esas tres buscando `costo|margen|utilidad|despiece|Intelisis`
se vuelve una prueba automática de que la reja no gotea.
