# Auditoría: ¿se puede cotizar un ESPECIAL con el Costeador Von Haucke?

**Quién audita:** Gerencia de Productos Especiales.
**Qué se probó:** cotizar de punta a punta 4 encargos reales que no existen en ninguna línea.
**Cómo:** `humo.html` + un banco de pruebas propio (`scratchpad/especial.html`, replica literal del cableado de `App.jsx`, sin login) + el motor real corrido en Node (`scratchpad/especiales_prueba.mjs`, `especiales_anclas.mjs`, `dificultad.mjs`) + anclas del ERP (`mp_erp_ultima_compra.csv`) y de 5 presupuestos reales de `~/Downloads/`.
**Nada se tocó en `src/`. No se corrió `deploy.sh`.**

---

## Veredicto en una línea

Los cuatro encargos **llegan hasta un número**, pero **ninguno de los cuatro es un número que yo firmaría**, y **ninguno de los cuatro se puede guardar**. La ruta de especial existe y funciona mecánicamente; lo que no existe es (a) los materiales de especialidad, (b) la mano de obra medida, (c) la instalación, y (d) la memoria. Hoy el Costeador cubre bien el mueble de línea y **deja fuera prácticamente todo el negocio de Productos Especiales**.

### Las 4 lentes

| | Recepción curva | Muro cancelería | Mostrador retail | Mesa juntas mármol |
|---|---|---|---|---|
| **¿Truena?** | No | No | No | No — pero **truena al guardarla** (H1) |
| **¿Sirve? (llega al precio)** | Sí, $25,900 | Sí, $74,127 | Sí, $10,616 | Sí, $70,951 |
| **¿Es creíble? ¿lo firmo?** | **No** — sin cuarzo | **No** — sin perfil de cancelería, sin instalación | **No** — el LED se cayó solo | **No** — mármol 4× barato, base inox 17× barata |
| **¿Mejorable?** | Sí, ver H2/H3 | Sí, ver H2/H6 | Sí, ver H2 | Sí, ver H3/H4/H5 |

### Los números que escupió la app (motor real, margen 50%)

| Encargo | Material | Mano de obra | Fábrica | Costo | **Precio 50%** |
|---|---|---|---|---|---|
| 1· Recepción curva 3.20 m | $8,786 | $3,220 | $944 | $12,950 | **$25,900** |
| 2· Muro 6 × 2.40 m + puerta | $30,056 | $5,506 | $1,502 | $37,064 | **$74,127** |
| 3· Mostrador retail 2.40 m | $3,504 | $1,293 | $511 | $5,308 | **$10,616** |
| 4· Mesa juntas 5 m mármol | $26,404 | $6,890 | $2,182 | $35,475 | **$70,951** |

Con el ancla real del ERP, el encargo 4 debería costar **$80,767** y venderse en **$161,534**: la app deja **$90,583 sobre la mesa en un solo mueble** (H3).

---

# HALLAZGOS — de más a menos grave

---

## H1 · Un especial NO se puede guardar. El botón truena y la app se cae a la red de seguridad.

**Qué está mal:** `estado.piezas` es un **objeto** (mapa `id → pieza`), pero `onGuardarPieza` lo trata como **arreglo**; `previas.filter` lanza `TypeError` y el error se lo come el error boundary.

**Dónde:**
- `src/App.jsx:463` — `const previas = e.piezas || []; const sinLaVieja = previas.filter(...)`
- `src/almacen.js:19-25` — `const piezas = {}; for (const p of PIEZAS_SEMILLA) piezas[p.id] = p;` → es objeto
- `src/almacen.js:57` y `:129` — `piezas: { ...base.piezas, ...(guardado.piezas || {}) }` → sigue siendo objeto al recargar
- `src/componentes/Costeador.jsx:485` — el botón "Guardar como pieza"

**Dónde me atoré:** encargo 1 (recepción curva), paso final. Armé el despiece, llegué al precio ($25,900), le di **"Guardar como pieza"** y la pantalla se fue en blanco. Consola reproducida en vivo:

```
[error] Uncaught TypeError: previas.filter is not a function
[error] The above error occurred in the <Banco> component
```

En la app real no se ve la pantalla en blanco: `SinPantallaBlanca` lo atrapa y muestra **"Esta pantalla se atoró — No perdiste nada: tu cotización sigue guardada"**. El mensaje es **falso**: la pieza no se guardó.

**Y aunque no tronara, no serviría:** `src/componentes/Catalogo.jsx:15` sólo lee `PIEZAS_SEMILLA` (recetas fijas del código). **Nada en toda la app lee `estado.piezas`** para volver a cargar un especial. Verificado con `grep -rn "estado.piezas"`: los únicos usos son el guardado (`App.jsx:463`), la sincronización a la nube (`App.jsx:119,143`) y el relleno (`almacen.js`). Ningún lector.

**Por qué importa:** **cada especial se cotiza desde cero, cada vez.** Una recepción curva que ya costeaste en marzo no existe en abril. No hay clonar-y-modificar (que es exactamente como trabaja Productos Especiales: el 80% de un encargo nuevo es un encargo viejo con otra medida). Es el hallazgo grande que se pedía buscar.

**Arreglo propuesto — NO aplicado:**

```js
// src/App.jsx:459  — trabajar con el objeto, que es lo que ya es en todos lados
function onGuardarPieza(resultado) {
  const id = costeo.piezaId || idNuevo('pieza');
  const pieza = { ...costeo, id, piezaId: id, esEspecial: true,
                  guardadaEl: new Date().toISOString().slice(0, 10),
                  costoUnitario: resultado?.costoUnitario ?? null };
  setEstado((e) => ({ ...e, piezas: { ...(e.piezas || {}), [id]: pieza } }));
  setCosteo((c) => ({ ...c, piezaId: id }));
  mostrarAviso(`Guardada la pieza: ${pieza.nombre || 'sin nombre'}`);
}
```

Y el lector que falta (mínimo viable, ~40 líneas): una sección **"Mis especiales guardados"** arriba del Catálogo que liste `Object.values(estado.piezas).filter(p => p.esEspecial)` con dos botones por renglón — **`Usar`** (`onCargar({ ...p, piezaId: p.id })`) y **`Duplicar y cambiar medidas`** (`onCargar({ ...p, piezaId: null, nombre: p.nombre + ' (copia)' })`). Con eso el especial se vuelve reusable y clonable, que es lo que hoy no existe.

---

## H2 · No existe cuarzo, ni LED, ni perfil de cancelería — y la pieza sin material se descarta EN SILENCIO.

**Qué está mal:** dos cosas encadenadas. (a) Faltan materiales base de tres de los cuatro encargos. (b) Cuando un componente no tiene material, el motor **lo salta sin decir nada** y la UI **tampoco avisa**.

**Dónde:**
- `src/motor/calculo.js:300` — `if (!insumo) continue; // insumo desconocido: se ignora (la UI lo advierte)`. **La UI NO lo advierte.**
- `src/componentes/Costeador.jsx:261` — `{ins && (<div className="pieza-med">…)}`: sin insumo no se pinta nada. No hay `else`, no hay alerta.
- `src/componentes/AsistenteEspecial.jsx:260` — idéntico.
- `src/datos/insumos.js` — el catálogo completo, 103 insumos.

**Verificado en vivo** (`select.pieza-mat`, 104 opciones incluido el placeholder):

```json
{"total":104, "cuarzo":[], "led":[],
 "aluminio":["Perfil de aluminio","Remate de aluminio"],
 "curvo":["Ruteado CNC + canteado en curva (por metro de arco)"],
 "inox":["Acero inoxidable 304 cal. 20"]}
```

Y en el motor, la pieza sin material desaparece del total sin una sola advertencia:

```
Mostrador retail 2.40 m con vitrina
  ⚠️  IGNORADO EN SILENCIO -> "Tira LED + fuente" (insumoId=__FALTA_LED__)
   COSTO UNITARIO $5,308   PRECIO 50% $10,616
```

**Dónde me atoré:**
- **Encargo 1**, paso 2 del asistente: escogí "Cubierta" y busqué **cuarzo** en el desplegable. No está. Lo más cercano es `marmol` ($2,000/m²), que es otro material y otro precio.
- **Encargo 2**, paso 2: busqué **perfil de cancelería**. Sólo hay `perfil-aluminio` ($122.71/m) marcado `// INCIERTO sin perfil exacto` en `insumos.js:127`, sin fuente. Es un perfil genérico, no un sistema de cancelería con jambas, cabezal, zoclo y felpa.
- **Encargo 3**, paso 2: busqué **LED**. Cero resultados. Le puse nombre a la pieza ("Tira LED 5 m") y la dejé sin material: la app la muestra igual, sin campo de cantidad, sin importe y **sin una sola alerta**. El precio final sale como si el mostrador no llevara luz.

**Lo que sí hay en el ERP** (`node scripts/busca-mp.mjs` + grep directo sobre `mp_erp_ultima_compra.csv`):

| Falta en la app | Artículo REAL del ERP | Unidad | Costo última compra | Equivale a |
|---|---|---|---|---|
| **Cuarzo / ecomármol** | `MVLSHJ05050000` HOJA DE ECOMARMOL SILESTONE ETERNAL SERENA 3170×1580×12 mm | Hoja | **$24,022.13** (2019-02-08) | **$4,796/m²** |
| Cuarzo, cubierta terminada | `MACMCU064204G1` CUBIERTA PEBBLE 1000×625 en ECOMARMOL SILESTONE | pieza | **$4,002.00** (2019-02-14) | **$6,403/m²** |
| Superficie ultracompacta | `MVLSHJ03060000` HOJA DE ECOMARMOL DEKTON 3200×1440×12 mm | Hoja | **$39,616.02** (2023-07-21) | **$8,597/m²** |
| **Tira LED (kit)** | `MDMEKT01000008` KIT DE ILUMINACIÓN 2 TIRAS LED 846 mm + 2 de 860 mm 2700 K en perfil difusor de acrílico, con cable y capuchones | pieza | **$2,227.40** (2025-05-30) | por kit |
| Tira LED (kit grande) | `MDMEKT01000021` KIT ILUMINACIÓN PERIMETRAL CELOSÍA 2003×1002, tira LED 2835/120 2700 K, fuente y control 3 interruptores | pieza | **$5,495.00** (2026-01-22) | por kit |
| Perfil difusor LED suelto | `MLEAPE162000U0` PERFIL DE ALUMINIO PARA TIRAS LED, cubierta mate 2.5 m, Häfele 833.72.840 | pieza | **$277.70** (2022-03-16) | **$111.08/m** |
| **Perfil de cancelería** | `MLEAPE2328O711` PERFIL TUBULAR 3"×1"×6.10 m calibre 16 EN ALUMINIO | pieza | **$950.00** (2021-10-26) | **$155.74/m** |
| Perfil cerco cancel | `MLEAPED6H9A170` PERFIL CERCO (A) 1-6622 de 15.24×43.33 mm Grupo Valsa, 4.60 m, aluminio anodizado natural | pieza | **$99.88** (2010-08-05) | $21.71/m — muy viejo, recotizar |
| Cancel armado (referencia) | `MDMAGC00010101` GAJO (CARA) PARA CANCEL 1603×627 mm esp. 6 mm con chaflán | pieza | **$9,572.41** (2025-11-04) | — |

**Nota fuerte: `cuarzo` aparece 0 veces en los 11,101 artículos del ERP.** Von Haucke lo compra como **"ECOMÁRMOL SILESTONE / DEKTON"**. Si el insumo se da de alta con el nombre "cuarzo" nadie lo va a volver a encontrar en Compras; hay que darlo de alta con el nombre del ERP y poner "cuarzo" como sinónimo de búsqueda.

**Por qué importa:** de las 7 especialidades que hace Von Haucke —acabados arquitectónicos, cancelería y muros, banking system, display/merchandising, mostradores retail, puntos de venta, recepciones— **la app no tiene material base para cancelería, ni para display/merchandising iluminado, ni para mostradores retail iluminados**. Son 3 de 7 líneas de negocio que hoy no se pueden cotizar sin inventar el número a mano.

**Arreglo propuesto — NO aplicado. Dos parches:**

1. **La alerta que falta** (es la mitad barata y evita el error silencioso). En `Costeador.jsx` justo después de la línea 259 (`</div>` de `pieza-head`) y en `AsistenteEspecial.jsx` después de la 259:

```jsx
{!ins && (
  <div className="alerta roja" style={{ marginTop: 6 }}>
    <span className="texto">
      <strong>Esta pieza no tiene material</strong> y por eso <strong>no está costando nada</strong>.
      Escoge de qué es, o quítala. Si el material que buscas no está en la lista,
      avísale a Dirección para darlo de alta — no lo dejes así.
    </span>
  </div>
)}
```

2. **Los insumos que faltan**, en `src/datos/insumos.js` (precios y `articulo` tomados del ERP arriba; `fuente: FUENTE_ERP`):

```js
// ---- SUPERFICIES DE PIEDRA / CUARZO (compradas terminadas -> indirecta) ----
ins({ id: 'cuarzo-silestone', nombre: 'Cuarzo / ecomarmol SILESTONE (busca: cuarzo, quartz)', seccion: 'cubiertas',
  precio: 4796, clase: 'indirecta',
  articulo: 'MVLSHJ05050000 HOJA DE ECOMARMOL SILESTONE ETERNAL SERENA 3170x1580x12', fuente: FUENTE_ERP,
  nota: 'ULTIMA COMPRA 2019 — RECOTIZAR con Compras antes de firmar.' }),
ins({ id: 'dekton', nombre: 'Superficie ultracompacta DEKTON 12 mm', seccion: 'cubiertas',
  precio: 8597, clase: 'indirecta',
  articulo: 'MVLSHJ03060000 HOJA DE ECOMARMOL DEKTON 3200x1440x12', fuente: FUENTE_ERP }),

// ---- ILUMINACION (se compra hecha -> indirecta) ----
ins({ id: 'kit-led', nombre: 'Kit de iluminacion LED (tiras + perfil + fuente + arnes)', seccion: 'electrico',
  precio: 2227.4, unidad: 'pza', clase: 'indirecta',
  articulo: 'MDMEKT01000008 KIT DE ILUMINACION 2 TIRAS LED 846mm + 2 de 860mm 2700K', fuente: FUENTE_ERP }),
ins({ id: 'perfil-led', nombre: 'Perfil de aluminio difusor para tira LED', seccion: 'electrico',
  precio: 111.08, unidad: 'm', clase: 'indirecta',
  articulo: 'MLEAPE162000U0 PERFIL DE ALUMINIO PARA TIRAS LED HAFELE 833.72.840 (2.5 m)', fuente: FUENTE_ERP }),

// ---- CANCELERIA ----
ins({ id: 'perfil-canceleria', nombre: 'Perfil tubular de aluminio 3" x 1" cal.16 (canceleria)', seccion: 'metal',
  precio: 155.74, unidad: 'm', formato: TRAMO6, mermaCorte: 5,
  articulo: 'MLEAPE2328O711 PERFIL TUBULAR 3x1x6.10 m CALIBRE 16 EN ALUMINIO', fuente: FUENTE_ERP,
  nota: 'ULTIMA COMPRA 2021 — recotizar.' }),
```

Y agregar tres chips a la paleta del asistente (`AsistenteEspecial.jsx:36`), que hoy no tiene ni cuarzo ni LED ni cancelería:

```js
{ label: 'Cubierta de piedra / cuarzo', material: 'cuarzo-silestone', kind: 'area', dims: [2000, 600] },
{ label: 'Iluminación LED',            material: 'kit-led',           kind: 'pza' },
{ label: 'Perfil de cancelería',       material: 'perfil-canceleria', kind: 'linear' },
```

---

## H3 · El mármol está entre 3.9× y 5.0× por debajo de lo que Von Haucke paga de verdad.

**Qué está mal:** `marmol` vale $2,000/m² en la app. El ERP dice que una cubierta de mármol terminada cuesta entre **$7,777 y $10,032 el m²**.

**Dónde:** `src/datos/insumos.js:88` — `ins({ id: 'marmol', nombre: 'Marmol (losa 20 mm)', precio: 2000, clase: 'indirecta' })`, **sin `articulo` y sin `fuente`** (es uno de los 83 huérfanos).

**Dónde me atoré:** encargo 4, al ver el resultado. La mesa de juntas de 5 m en mármol me salió en **$70,951**. Un mueble así, en la vida real, cuesta más que eso **sólo en la cubierta**.

**Las anclas del ERP:**

| Artículo real | Medida | Costo | $/m² | vs. app ($2,000) |
|---|---|---|---|---|
| `MDMACU01250212` CUBIERTA RECTANGULAR 2100×900×20 mm, canto tipo ala de avión | 1.89 m² | $14,698 (2026-03-12) | **$7,777** | **3.9× barata** |
| `MANMCU032824K4` CUBIERTA RECTANGULAR 2100×900×20 mm, canto ala de avión | 1.89 m² | $18,960 (2026-05-20) | **$10,032** | **5.0× barata** |
| `MABMCU031424E1` CUBIERTA RECTANGULAR 2400×1200×20 mm, chaflán invertido | 2.88 m² | $29,628 (2023-08-11) | $10,288 | 5.1× barata |

*(Son cubiertas terminadas: cortadas, canteadas, con chaflán. Pero la app tampoco tiene forma de cobrar esa fabricación: `marmol` es `clase: 'indirecta'`, o sea "comprado", así que no lleva ni el 34% de fábrica ni horas. De cualquier lado que se vea, el costo entregado sale 4–5× corto.)*

**Cuánto cuesta el error, medido:**

```
MESA DE JUNTAS 5 m — el efecto de un solo precio mal puesto
  con mármol a $2,000/m² (lo que trae la app): costo $35,475 → precio 50% $70,951
  con mármol a $7,777/m² (ancla ERP):          costo $80,767 → precio 50% $161,534
  DIFERENCIA DE PRECIO: $90,583 que hoy la app NO cobra.
```

**Por qué importa:** el mármol aparece en recepciones, mesas de juntas y mostradores — el corazón del catálogo de especiales. Un solo precio mal puesto se lleva **$90,583 en un mueble**. Y no es un caso aislado: **83 de los 103 insumos no dicen de dónde salió su precio**; los que usan los especiales (`marmol`, `marmol-premium`, `inoxidable`, `acrilico`, `cristal-templado`, `cristal-templado-12`, `perfil-aluminio`) están **todos** sin fuente.

**Arreglo propuesto — NO aplicado:**

```js
// src/datos/insumos.js:88
ins({ id: 'marmol', nombre: 'Marmol (cubierta terminada, 20 mm)', seccion: 'cubiertas',
  precio: 7777, clase: 'indirecta',
  articulo: 'MDMACU01250212 CUBIERTA RECTANGULAR 2100x900x20 mm CANTO ALA DE AVION',
  fuente: FUENTE_ERP,
  nota: 'Mediana de cubiertas terminadas del ERP 2026: $7,777-$10,032 el m2. Incluye corte, canto y chaflan.' }),
ins({ id: 'marmol-premium', nombre: 'Marmol premium (Calacatta/Arabescato/Nero), cubierta terminada',
  seccion: 'cubiertas', precio: 10032, clase: 'indirecta',
  articulo: 'MANMCU032824K4 CUBIERTA RECTANGULAR 2100x900x20 mm', fuente: FUENTE_ERP }),
```

También: el cristal templado 9 mm está **1.3× barato** (`cristal-templado` $1,369/m² vs. `MABCCR06HZ020J` cristal transparente 1493×426×9 cantos pulidos templado, $1,169 por 0.636 m² = **$1,838/m²**). Menos grave, pero igual sin fuente.

---

## H4 · La lámina y el inoxidable mienten en la unidad: la etiqueta dice "hoja", el motor cobra kilos. 17× de error.

**Qué está mal:** `inoxidable` y las 6 láminas tienen `unidad: 'hoja'`, pero su `formato.medida` está **en kilos** (21.3 kg = lo que pesa una hoja) y `netoComponente` devuelve la cantidad cruda. La etiqueta del campo se genera de `ins.unidad`, así que dice **"CANTIDAD (HOJA)"** mientras el motor espera **kg**.

**Dónde:**
- `src/componentes/Costeador.jsx:279` — `<label>Cantidad ({ins.unidad})<input …/></label>`
- `src/componentes/AsistenteEspecial.jsx:271` — idéntico
- `src/datos/insumos.js:120` — `ins({ id: 'inoxidable', …, unidad: 'hoja', formato: LAMINA20 })` con `LAMINA20 = { medida: 21.3 }` (kg)
- `src/motor/calculo.js:221-233` — la rama `fraccion` divide `neto / (areaFmt * aprov)` tratando `neto` como kg

**Dónde me atoré:** encargo 4, al declarar la base de acero inoxidable. Escogí "Acero inoxidable 304 cal. 20", el campo decía **"CANTIDAD (HOJA)"**, escribí **1** — y la app cobró **$113**. Una hoja de inox cuesta $1,930. Escribí lo que el rótulo me pidió y me cobró **1 kilo**.

Y la lista de compra que salió de ahí, textual, copiada del DOM:

> `neto 1.00 hoja ≈ 0.05 de hoja → comprar 0.058685446009389665 lamina (1.25 hoja)`

Un renglón que dice al mismo tiempo `1.00 hoja`, `0.05 de hoja`, `0.0586…` y `1.25 hoja`.

**El daño en el encargo 4:** un proyectista que pide "3 hojas de inox" para la base de una mesa de 5 m obtiene **$339** de material en vez de **$5,790**. Son **17× de subvaluación**, en el renglón más caro después de la cubierta.

**Encima el precio también está mal:** `inoxidable` = $1,930 por "hoja" de 21.3 kg = **$90.61/kg**, sin fuente. El ERP: `MVLSLA06270503` LÁMINA INOXIDABLE HOJA 4×10 CAL 20 SATINADO P3 T-304 = **$1,770** (2026-01-07). Esa hoja son 3.72 m² ≈ 27.1 kg → **$65.31/kg**. La app está **39% alta**, y además su formato es una hoja **4×8** que Compras **no compra** en inox (compra 4×10).

**Además:** en el asistente y en el costeador, `esArea()` (`AsistenteEspecial.jsx:80`, `Costeador.jsx:120`) sólo considera "por área" a `formato.tipo === 'tablero'` o `unidad === 'm2'`. Las láminas son `tipo: 'lamina'`, así que **no se pueden declarar por largo × ancho**. Para una base de inox tengo que convertir mentalmente medidas a kilos. Ningún proyectista de 50+ años va a hacer eso — y si lo hace, lo hace mal.

**Arreglo propuesto — NO aplicado. Tres piezas:**

```js
// 1) src/datos/insumos.js — decir la verdad en la unidad y traer el precio real
ins({ id: 'inoxidable', nombre: 'Acero inoxidable 304 cal. 20 satinado', seccion: 'metal',
  precio: 1770, unidad: 'kg', formato: { ...LAMINA20, medida: 27.1, nombre: 'lamina 4 x 10' },
  fraccion: true, mermaCorte: 8,
  articulo: 'MVLSLA06270503 LAMINA INOXIDABLE HOJA 4x10 CALIBRE 20 SATINADO P3 T-304',
  fuente: FUENTE_ERP }),
```

```jsx
// 2) src/componentes/Costeador.jsx:279 y AsistenteEspecial.jsx:271 — rotular la unidad REAL
//    que el motor consume, no la unidad de compra.
const unidadCaptura = (ins) =>
  ins.formato && ins.fraccion ? (ins.formato.tipo === 'lamina' ? 'kg' : 'm²') : ins.unidad;
// …
<label>Cantidad ({unidadCaptura(ins)})
  <input type="number" … /></label>
{ins.formato && ins.fraccion && (
  <div className="ayuda">Se compra por {ins.formato.nombre} ({ins.formato.medida} {unidadCaptura(ins)} cada una).</div>
)}
```

```jsx
// 3) src/componentes/Costeador.jsx:332 — redondear la lista de compra (hoy imprime 17 decimales)
→ comprar {c.unidades < 1 ? c.unidades.toFixed(2) : Math.ceil(c.unidades)} {fmt?.corto || 'u'}
```

Y a mediano plazo: permitir declarar lámina/inox **por largo × ancho** (ampliar `esArea` a `formato.tipo === 'lamina'` y convertir m² → kg con el espesor del calibre). Es lo que un proyectista realmente sabe: la medida de la pieza, no su peso.

---

## H5 · Los insumos en dólares se muestran SIN convertir en el renglón — el mismo mueble dice $167 arriba y $2,923 abajo.

**Qué está mal:** el motor convierte USD→MXN con `precioDeInsumo` (`calculo.js:159-165`), pero **el subtotal por renglón que ve el usuario no lo hace**: lee `ins.precio` crudo.

**Dónde:**
- `src/componentes/AsistenteEspecial.jsx:102` — `const p = ins.precio ?? ins.precioBase ?? 0;`
- `src/componentes/Costeador.jsx:145` — `const precio = ins.precio ?? ins.precioBase ?? 0;`
- `src/componentes/Costeador.jsx:184` — mismo problema en la sugerencia de medida
- Insumos afectados: `caja-byrne` (167 USD) y `pintura-polvo` (6.69 USD) — `insumos.js:190-191`

**Dónde me atoré:** encargo 4, paso 2. Puse "Caja eléctrica Byrne 4 puertos" y **el renglón marcó $167**. Reproducido en pantalla. Al llegar al detalle, la Hoja de Costo del mismo mueble dice **"Cableado y energía $2,923"**. El mismo renglón, en la misma sesión, con dos números que difieren **17.5×** (el tipo de cambio).

**Por qué importa:** el proyectista mira el renglón para decidir si el mueble aguanta la caja Byrne o si le pone la genérica. Con $167 en pantalla la respuesta es obvia; con $2,923 es otra decisión. Y como el total sí está bien, nadie lo va a atrapar: sólo se nota si sumas los renglones a mano. Cualquier especial con importación (Byrne, pintura en polvo, herraje europeo) tiene esto.

**Arreglo propuesto — NO aplicado.** Reusar la función que ya existe en el motor, en los tres lugares:

```js
// src/componentes/Costeador.jsx  (y el gemelo en AsistenteEspecial.jsx)
import { …, precioDeInsumo } from '../motor/calculo.js';

function costoPieza(c, ins, n) {
  const neto = netoComponente(c, n);
  const precio = precioDeInsumo(ins, par);   // ← antes: ins.precio ?? ins.precioBase ?? 0
  if (ins.formato && ins.fraccion) {
    const aprov = (par.aprovechamientoCorte || 100) / 100;
    return (neto / (ins.formato.medida * aprov)) * precio;
  }
  return neto * precio;
}
```

---

## H6 · No existe renglón de MANIOBRAS / instalación. Todos los presupuestos reales lo traen.

**Qué está mal:** la cadena de totales de la cotización es `precio de lista → descuento → contingencia → IVA`. No hay flete, no hay maniobras, no hay instalación. La regla de negocio "flete 3% en CDMX" sólo existe como **texto** en las condiciones.

**Dónde:**
- `src/componentes/Cotizacion.jsx:134-142` — la cadena completa de totales, sin maniobras
- `src/componentes/Cotizacion.jsx:448` — el 3% aparece sólo en prosa: *"Flete en CDMX/área metropolitana 3%… Instalación y maniobras por separado."*
- `src/componentes/FichaPDF.jsx:159` — misma prosa
- `src/datos/pdfPropuesta.js:138` — el PDF sí sabe imprimir un renglón extra (contingencia); falta el de maniobras

**Dónde me atoré:** encargo 2 (muro divisorio de 6 m). Un muro de cancelería **se instala en obra** — es la mitad del trabajo. La app me dio $74,127 de mueble y **cero pesos de instalación**, y luego imprime "Instalación y maniobras por separado" sin decir cuánto.

**Lo que dicen los presupuestos reales de `~/Downloads/`:**

| Presupuesto | Mobiliario + sillería | **Maniobras** | % |
|---|---|---|---|
| `226050048.pdf` — **cancelería Wand** | $295,340 | **$8,861** | **3.0%** |
| `226050047.pdf` | $230,140 | $6,905 | 3.0% |
| `226010047.pdf` | $69,680 | $2,100 | 3.0% |
| `226030018.pdf` — **con RECEPCIÓN + SALA DE JUNTAS** | $665,271 | **$80,360** | **12.1%** |
| `226060050.pdf` | $1,080,297 | *"Maniobras pendientes por cotizar"* | — |

El 3% clavado en tres presupuestos de línea confirma la regla. **Y el cuarto —el único con obra a la medida— va al 12.1%.** O sea: en especiales las maniobras no son el 3%, son cuatro veces más, y la app no las cotiza en absoluto.

**Por qué importa:** en el encargo 2 faltan entre $2,200 (al 3%) y $9,000 (al 12%). En un proyecto de $300,000 de cancelería faltan **$9,000 a $36,000**. Es dinero que hoy se va completo contra la utilidad, o que el vendedor tiene que acordarse de agregar a mano fuera de la app.

**Arreglo propuesto — NO aplicado:**

```js
// src/motor/calculo.js:61 — junto a contingenciaPorcentaje
maniobrasPorcentaje: 3,        // % sobre subtotal. CDMX area metropolitana (5 presupuestos reales).
                               // Obra a la medida (recepciones, canceleria, muros) va a 12% — 226030018.
```

```jsx
// src/componentes/Cotizacion.jsx:138 — un renglón, entre contingencia e IVA
const maniobrasPct = cot.maniobrasPct ?? estado.parametros.maniobrasPorcentaje ?? 3;
const maniobras    = subtotal * (maniobrasPct / 100);
const baseGravable = subtotal + contingencia + maniobras;   // ← se suma aquí
```
…y su renglón visible junto al de contingencia (`Cotizacion.jsx:438`) y en `pdfPropuesta.js:138`, con un aviso cuando la propuesta trae partidas de especial: *"Este proyecto lleva obra a la medida. En proyectos así las maniobras han ido al 12%, no al 3%."*

---

## H7 · El asistente nunca pregunta HORAS, y su única perilla de mano de obra mueve el precio 14.8%.

**Qué está mal:** el paso 3 del asistente ("¿Qué tan difícil es de fabricar?") no captura horas: sólo mueve `factorDirecta`, un **porcentaje sobre el material directo**. En un especial el material es casi todo **comprado** (`clase: 'indirecta'`), y ése lleva otro factor, del 12%. Resultado: la perilla casi no hace nada.

**Dónde:**
- `src/componentes/AsistenteEspecial.jsx:285-297` — el paso 3 completo; sólo `set({ factorDirecta: d.v })`
- `src/componentes/AsistenteEspecial.jsx:288` — el texto promete: *"En el detalle puedes meter horas exactas por proceso"* → hay que salir del asistente
- `src/motor/calculo.js:342-345` — `manoObra = materialDirecto × factorDirecta% + materialIndirecto × factorIndirecta%`
- `src/componentes/Costeador.jsx:373-395` — las horas SÍ existen, pero sólo aquí, en la pantalla llamada "Modo avanzado"
- `src/datos/areas.js` — 5 centros; `src/motor/calculo.js:65` — el motor tiene 6 (`otros` no tiene campo)

**Dónde me atoré:** encargo 1, paso 3. Una recepción **curva** de 3.20 m es CNC, canteado en curva, armado a plantilla. Le puse **"Muy difícil"** y el precio apenas se movió. Medido:

```
RECEPCIÓN CURVA — el único botón de mano de obra que ofrece el asistente:
  Muy fácil    30%  costo $11,284  precio50 $22,568
  Fácil        40%  costo $11,562  precio50 $23,123
  Estándar     55%  costo $11,978  precio50 $23,956
  Difícil      70%  costo $12,395  precio50 $24,789
  Muy difícil  90%  costo $12,950  precio50 $25,900
  → de "Muy fácil" a "Muy difícil" el costo sólo sube 14.8%
  → $3,220 de mano de obra = 79.3 horas de taller a $40.60/h
```

Toda la escala, de un extremo al otro, mueve **14.8%**. Y las horas que implica —38 h en "Muy fácil", 79 h en "Muy difícil"— **el usuario nunca las ve**. En especiales la mano de obra es lo que decide si el trabajo se gana o se pierde, y aquí es un subproducto del precio del material.

**Sí se pueden meter horas**, pero: hay que terminar el asistente → "Ver detalle completo y cotizar" → llegar a una pantalla llamada **"Modo avanzado"** → oprimir **"Por horas medidas"** → llenar 5 campos con nombres de centro. Son **4 pasos y una pantalla más**, y ninguno de los cinco centros es **instalación en obra** — que en muro de cancelería y mesa de mármol es la mitad de las horas. El sexto centro (`otros`) existe en el motor pero **no tiene campo en la interfaz** (`areas.js` no lo declara y `costeoEnBlanco()` en `App.jsx:105` tampoco lo inicializa).

**Arreglo propuesto — NO aplicado:**

1. Que el paso 3 del asistente pregunte **horas directas**, no dificultad, cuando el mueble es especial. La pregunta que un proyectista sí sabe contestar:

```jsx
// src/componentes/AsistenteEspecial.jsx — reemplaza el paso 3
<div className="pregunta">¿Cuánto trabajo se lleva?</div>
<div className="pregunta-sub">En días de un solo trabajador. Si son 2 personas 3 días, son 6.</div>
<div className="masmenos gigante">
  <button onClick={() => set({ diasTaller: Math.max(0.5, (b.diasTaller ?? 2) - 0.5) })}>−</button>
  <span className="valor">{b.diasTaller ?? 2} días</span>
  <button onClick={() => set({ diasTaller: (b.diasTaller ?? 2) + 0.5 })}>+</button>
</div>
// …y se traduce a horas antes de calcular (jornada 8 h):
//   modoManoObra: 'horas', horas: { carpinteria: (b.diasTaller ?? 2) * 8 }
```
Con eso, 5 días de taller = 40 h × $40.60 = **$1,624**, un número que se puede defender contra la orden de producción. Hoy la app dice 79 h y nadie lo sabe.

2. Agregar el centro que falta, `instalacion`, a `src/datos/areas.js` y a `AREAS` en `calculo.js:65` (`otros` ya está en el motor; sólo falta rotularlo):

```js
export const AREAS_LABEL = {
  pm: 'P.M / Metalmecanica', carpinteria: 'Carpinteria', pintura: 'Pintura',
  acabados: 'Acabados', tapiceria: 'Tapiceria / Plata',
  otros: 'Instalación en obra / otros',   // ← el motor ya lo suma; sólo faltaba el campo
};
```

---

## H8 · El material comprado no carga gastos de fábrica. En especiales, eso es casi todo el material.

**Qué está mal:** los indirectos de fábrica son **34% sobre la materia prima DIRECTA** solamente. El material `clase: 'indirecta'` (mármol, cuarzo, cristal, acrílico, cajas Byrne, cajoneras, PET) **no carga ni un peso de fábrica**.

**Dónde:** `src/motor/calculo.js:374` — `indirectosFabrica = materialDirecto * (par.factorIndirectosFabrica / 100)`

**Dónde me atoré:** encargo 2 (muro) y encargo 4 (mesa), al revisar la Hoja de Costo.

| Encargo | Material directo | Material **indirecto** | Gastos de fábrica |
|---|---|---|---|
| 2· Muro de cristal | $4,418 | **$25,638** (86%) | **$1,502** |
| 4· Mesa de mármol | $6,417 | **$19,987** (76%) | **$2,182** |

Un muro de $37,064 de costo carga **$1,502** de renta, luz, oficina, herramienta y supervisión. Ese muro ocupa la planta, el montacargas, el proyectista y la cuadrilla igual que cualquier otro. En un mueble de línea (melamina, todo directo) el modelo funciona; en un especial el reparto se cae, y siempre **hacia abajo**.

**Por qué importa:** justo cuando el especial es más caro y más riesgoso —piedra, cristal, importación— es cuando la app menos overhead le cobra. Esto empeora sistemáticamente el margen real de Productos Especiales, y explica en parte el hueco entre el 30% de gastos de operación que asume la app y el 51% real que ya está anotado en la memoria del proyecto.

**Arreglo propuesto — NO aplicado.** No tocar la fórmula normativa; **agregar** un factor separado para el material comprado, con su propio parámetro, para que el cambio sea visible y reversible:

```js
// src/motor/calculo.js:29 — junto a factorIndirectosFabrica
factorIndirectosComprado: 0,  // % sobre material INDIRECTO (comprado-revendido).
                              // Miguel/Rodrigo: lo comprado lleva utilidad menor, pero
                              // NO cero overhead: pasa por planta, almacen e instalacion.

// src/motor/calculo.js:374
indirectosFabrica = materialDirecto   * (par.factorIndirectosFabrica  / 100)
                  + materialIndirecto * (par.factorIndirectosComprado / 100);
```
Arranca en **0** (no cambia ningún número de hoy) y se calibra con Miguel contra una orden cerrada de especial. Es la decisión que hay que llevarle a Costos, no una que deba tomar el código.

---

## H9 · La tarjeta que dice "Cotizar especial (a la medida)" NO lleva al asistente de especiales.

**Qué está mal:** hay dos puertas y están cruzadas. La tarjeta rotulada **"Cotizar especial (a la medida)"** manda a `costeador` (la pantalla cruda de despiece). El asistente guiado de especiales (`especial`) está detrás de una tarjeta rotulada **"Costear con IA"**, que promete analizar una foto.

**Dónde:**
- `src/componentes/Inicio.jsx:240` — `onClick={() => onIr(veCostos ? 'costeador' : 'asistente')}` bajo el título *"Cotizar especial (a la medida)"*
- `src/componentes/Inicio.jsx:270` — `onClick={() => onIr('especial')}` bajo el título *"Costear con IA"*, dentro de la sub-vista **Costear** (no **Cotizar**)
- `src/App.jsx:92` — el nombre de la ruta `especial` es *"Costear desde cero"*, un tercer nombre para lo mismo

**Dónde me atoré:** al empezar el encargo 1. Fui a Inicio → Cotizar → **"Cotizar especial (a la medida)"** (que es literalmente lo que vine a hacer) y aterricé en **"Modo avanzado"**: una pantalla en blanco, con un desplegable de 103 materiales, la palabra *despiece* en el título, y una alerta roja de arranque (H11). El asistente de 4 pasos —el que sí está pensado para esto— está en otra rama del menú, con otro nombre.

**Por qué importa:** el usuario objetivo tiene 50+ años y no es experto en tecnología. La única puerta rotulada con su problema lo deja en la pantalla más difícil de la app. La puerta fácil se llama como una función de IA que él quizá no quiere usar.

**Arreglo propuesto — NO aplicado.** Un renglón:

```jsx
// src/componentes/Inicio.jsx:240
<Tarjeta icono="especial" titulo="Cotizar especial (a la medida)"
  desc={veCostos ? 'Te voy preguntando: qué es, de qué está hecho, cuánto trabajo lleva.' : 'A la medida. Diseño lo costea; tú lo cotizas.'}
  onClick={() => onIr(veCostos ? 'especial' : 'asistente')} />   {/* ← 'especial', no 'costeador' */}
```
Y renombrar la de la línea 270 a **"Costear desde una foto o render (IA)"**, que es lo que de verdad hace. Un solo nombre por pantalla, en los tres lugares (`Inicio.jsx:240`, `:270`, `App.jsx:92`).

---

## H10 · La lista de compra imprime 17 decimales y se contradice sola.

**Qué está mal:** para insumos por fracción de hoja, `unidades` es una fracción, no un conteo, y se imprime sin formatear. Y el rótulo `ins.unidad` ("hoja") se usa para una cantidad que está en m² o kg.

**Dónde:** `src/componentes/Costeador.jsx:330-333`

**Copiado del DOM en vivo**, encargo 1:

> `neto 0.90 hoja ≈ 0.30 de hoja → comprar 0.37792260145122275 tablero (1.12 hoja)`

y encargo 4:

> `neto 1.00 hoja ≈ 0.05 de hoja → comprar 0.058685446009389665 lamina (1.25 hoja)`

**Por qué importa:** la "lista de compra" es lo que se le pasa a Compras. Así no se puede pasar a nadie. Y peor: en un especial, donde no hay receta previa, esta lista **es** el único documento de materiales que produce la app.

**Arreglo propuesto — NO aplicado:** ver el parche 3 de H4 (redondeo) más corregir el rótulo de la unidad neta (`neto {c.neto.toFixed(2)} m²`, no "hoja") y quitar la doble expresión contradictoria: mostrar **una** cifra, "consume 0.30 de hoja".

---

## H11 · El margen por omisión del Costeador es 30% — por debajo del mínimo de 40% que dictó Dirección.

**Qué está mal:** `costeoEnBlanco()` arranca en `margen: 30`; el mínimo de política es 40 (Rodrigo) / 45 (Miguel).

**Dónde:** `src/App.jsx:106` — `margen: 30` · `src/componentes/Costeador.jsx:68` — `bajoMinimo = margen < estado.parametros.margenMinimo` · `src/componentes/Catalogo.jsx:144,162,177` — las tres cargas del catálogo también ponen 30.

**Dónde me atoré:** encargo 1, al entrar por la puerta de H9. La pantalla abre con la alerta roja **"Debajo del minimo de 40%"** antes de que yo haya tocado nada. Una alerta que sale siempre deja de ser una alerta: en dos días nadie la ve, y el día que sí importe tampoco la verán.

**Arreglo propuesto — NO aplicado:** `margen: PARAMETROS_DEFAULT.margenObjetivo` (50) en `App.jsx:106` y en las tres cargas de `Catalogo.jsx`. Si el 30 estaba puesto a propósito para línea, entonces que el aviso sólo salga cuando el usuario **baja** el margen, no al abrir.

---

## H12 · El desplegable de materiales son 103 nombres crudos sin buscador.

**Qué está mal:** `<select>` plano con 8 optgroups y 103 opciones, con nombres del ERP ("Melamina ABS 28 mm (cubierta APP LT)", "PTR 3\" x 1 1/2\" cal. 14", "Ruteado CNC + canteado en curva (por metro de arco)"). Sin campo de búsqueda, sin filtro, sin favoritos.

**Dónde:** `src/componentes/Costeador.jsx:248-257` · `src/componentes/AsistenteEspecial.jsx:248-257`

**Dónde me atoré:** en los 4 encargos, en cada pieza. En el encargo 1 el recargo de curvatura se llama **"Ruteado CNC + canteado en curva (por metro de arco)"** y vive perdido entre "Tapacanto ABS 3 mm" y "Cubre canto blanco 22 x 2 mm", en la sección "Cubiertas y frentes". No hay chip para él en la paleta del asistente (`AsistenteEspecial.jsx:36-56`, 19 chips, ninguno de curvatura). **Un especial curvo cotizado por alguien que no sepa que ese renglón existe sale exactamente igual de caro que uno recto** — que es el error que este insumo se creó para evitar (ver el comentario en `insumos.js:93-103`).

**Por qué importa:** es la barrera de entrada del usuario objetivo. Y el vocabulario tampoco ayuda: la app pide *despiece*, *insumo*, *centro de costo*, *material directo/indirecto*, *factor*, *fracción de hoja*. Ninguna de esas palabras la usa un proyectista al describir una recepción.

**Arreglo propuesto — NO aplicado:** buscador escribiendo sobre el desplegable (~25 líneas, un `<input>` + filtro sobre `Object.values(insumos)`), con **sinónimos** en el insumo (`ins.busca: ['cuarzo','quartz','silestone']`) para que "cuarzo" encuentre el ecomármol; y subir a la paleta de chips los 3 materiales que faltan (H2) más **"Cubierta curva (recargo)"** → `curvado`.

---

## H13 · Del asistente al detalle se pierde el botón "Atrás".

**Qué está mal:** la transición usa `setPestania` directo en vez de `irA`, así que no se empuja al historial.

**Dónde:** `src/App.jsx:607` — `onVerDetalle={(bor) => { setCosteo({...}); setPestania('costeador'); }}`

**Dónde me atoré:** encargo 1. Desde el detalle le di "‹ Atrás" esperando volver al asistente para corregir una medida, y me sacó a Inicio. Todo el despiece sigue en memoria pero la pantalla que lo armó ya no es alcanzable.

**Arreglo propuesto — NO aplicado:** `irA('costeador')` en vez de `setPestania('costeador')`.

---

# Lo mínimo que hay que construir para que un especial se cotice completo

En orden de esfuerzo/beneficio. Los cinco primeros son de un día y cambian el resultado de los cuatro encargos.

### 1 · Que se pueda guardar y clonar (H1) — 1 línea + ~40 de pantalla
`App.jsx:463` cambia de `[...previas, pieza]` a `{ ...e.piezas, [id]: pieza }`, y una sección **"Mis especiales guardados"** en el Catálogo con **Usar** y **Duplicar**. **Sin esto, todo lo demás se vuelve a teclear cada vez.** Es el único hallazgo que hace que el trabajo se acumule en vez de evaporarse.

### 2 · Que nunca se caiga un renglón en silencio (H2a) — 8 líneas
La alerta roja *"Esta pieza no tiene material y no está costando nada"* en `Costeador.jsx` y `AsistenteEspecial.jsx`. Hoy un mostrador sin LED sale con precio y sin luz, y nada lo dice.

### 3 · Los 5 insumos que faltan, con su artículo del ERP (H2b) — datos, no código
`cuarzo-silestone` $4,796/m², `dekton` $8,597/m², `kit-led` $2,227.40/pza, `perfil-led` $111.08/m, `perfil-canceleria` $155.74/m. **Todos con `articulo` y `fuente`**, y todos marcados *recotizar con Compras* (las últimas compras son de 2019–2021). Con esto, cancelería, retail y display dejan de ser incotizables.

### 4 · Los 3 precios que están mal, con su ancla (H3, H4, H5) — datos + 3 líneas
- `marmol` $2,000 → **$7,777** /m² (`MDMACU01250212`). Vale $90,583 en un solo mueble.
- `inoxidable` → `unidad: 'kg'`, $1,770 por hoja de 27.1 kg (`MVLSLA06270503`), y rotular el campo en **kg**, no en "hoja". Vale 17× en la base de la mesa.
- `precioDeInsumo()` en `costoPieza()` de los dos componentes, para que el renglón del Byrne no diga $167 cuando cuesta $2,922.50.

### 5 · El renglón de maniobras (H6) — 1 parámetro + 3 renglones de UI
`maniobrasPorcentaje: 3` en los parámetros, sumado antes del IVA, con el aviso de que en obra a la medida los presupuestos reales van al **12.1%** (`226030018`). Es dinero que hoy simplemente no se cobra.

### 6 · Preguntar el trabajo en DÍAS, no en dificultad (H7) — ~20 líneas
El paso 3 del asistente pasa de una perilla que mueve 14.8% a una pregunta que el proyectista sí sabe contestar ("¿cuántos días de un trabajador?"), traducida a horas antes de calcular. Y el centro **"Instalación en obra"** que hoy no existe en la interfaz.

### 7 · Enderezar las dos puertas y los tres nombres (H9, H11, H13) — 4 líneas
`Inicio.jsx:240` → `'especial'`. Margen por omisión 50, no 30. `irA` en vez de `setPestania`. Cero riesgo, y es la diferencia entre que el usuario objetivo encuentre el asistente o no.

### 8 · Buscador en el desplegable de materiales + los 4 chips que faltan (H12) — ~25 líneas
Con sinónimos, para que "cuarzo" encuentre el ecomármol y "curvo" encuentre el ruteado CNC.

### 9 · La decisión que NO es del código (H8) — llevarla a Costos
`factorIndirectosComprado`, arrancando en 0 para no mover nada hoy, y calibrarlo con Miguel contra una orden cerrada de especial. Un muro de $37,064 que carga $1,502 de fábrica no es un bug: es una política que nadie ha decidido para especiales, y es la que se está comiendo el margen.

---

### Lo que NO se puede arreglar con parches (para la siguiente conversación)

- **El precio de un especial no se puede defender sin horas medidas.** Los 4 encargos salieron con mano de obra derivada del costo del material. Mientras Producción no entregue una orden cerrada de una recepción, un muro y una mesa con sus tiempos por centro, todo esto son estimaciones bien formateadas. Es la misma deuda que ya está anotada para `curvado` (`insumos.js:103`: *"Calibrado, no medido"*).
- **83 de 103 insumos siguen sin decir de dónde salió su precio**, y los que usan los especiales están **todos** en ese grupo. El error de H3 ($90,583 en un mueble) es lo que pasa cuando un número sin fuente se usa en serio.

---

*Archivos de la auditoría (sólo lectura sobre `src/`): `scratchpad/especial.html` + `especial.jsx` (banco de pruebas del flujo), `scratchpad/especiales_prueba.mjs` (los 4 encargos con el motor real), `scratchpad/especiales_anclas.mjs` (anclas del ERP y maniobras), `scratchpad/dificultad.mjs` (sensibilidad de la perilla de mano de obra).*
