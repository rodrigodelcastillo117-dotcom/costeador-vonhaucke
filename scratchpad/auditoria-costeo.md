# Auditoría de los NÚMEROS del Costeador Von Haucke
**Fecha:** 2026-08-16 · **Alcance:** `src/motor/calculo.js`, `src/datos/insumos.js`, `preciosVenta.js`, `factoresLinea.js`, `lineas.js` y los 24 generadores de línea.
**Método:** 994 combinaciones de línea × producto × medida costeadas con el motor real; 251 configuraciones comparadas por `$/m²` y `$/pieza`; 60 renglones contrastados contra presupuestos reales.
**Scripts:** todos en `scratchpad/`, corren con `node`. Nada dentro de `src/` fue tocado.

| # | Hallazgo | Dinero |
|---|---|---|
| 1 | El bench de las 7 líneas calibradas cotiza +16% a +286% arriba de su objetivo | hasta **$961,572** por 100 puestos |
| 2 | Voni (`costearItem`) pierde TODOS los add-ons: eléctrico y gavetas | **$370,296** en un proyecto de 96 puestos |
| 3 | El margen que reporta la app (50%) no lleva gastos de operación: el real es 35% | **15 puntos** de margen en 22 de 24 líneas |
| 4 | `modulor.archivero_h` con cajones sale a 32% del de puertas | **$5,244** por pieza |
| 5 | `footprintDe` agarra la "tapa" del pedestal en vez de la cubierta | mesa de juntas de 1.80 m dibujada de **15 cm** |
| 6 | `costearConfig` no tiene el respaldo de `HUELLA` que sí tiene `costearItem` | la pieza **desaparece** del plano al editarla |
| 7 | `lamina-20` / `lamina-14` consumidas en m² contra un formato en kg | **7.2× / 14.9×** baratas donde aplica |
| 8 | `mermaCorte` es letra muerta en los 24 insumos `fraccion: true` | 2.0% del material del catálogo |
| 9 | `factorDeLinea` infla también el COSTO reportado | la hoja de costo de Cirque miente por **4.5×** |

---

## 1 · El bench de TODAS las líneas calibradas está fuera de su objetivo comercial
**hasta $961,572 de más por cada 100 puestos**

### Qué está mal
El escritorio de cada línea cierra contra su objetivo (8 de 8 ✓). El **bench de todas cierra mal (7 de 7 ✗)**, entre +16% y +286%. Son dos causas encimadas, las dos reales.

### Dónde
- `src/datos/factoresLinea.js:48-51` (`MEDIDO_ANTES`) y `:86-87` (`factorDeLinea`)
- `src/datos/lineas.js:215-220` (`precioDePieza`)
- `src/datos/preciosVenta.js:191-219` (`APPLT_POR_USUARIO` / `precioPorUsuarioAppLT`)

### Cómo lo reproduje
`node scratchpad/aud_orden2.mjs`

```
### LA REFERENCIA (App LT)
   escritorio      modelo $6,054   la app cotiza $6,054   (1.00× — cae al MODELO)
   bench $/puesto  modelo $4,510   la app cotiza $3,138   (0.70× — cae a la ESCALERA POR USUARIO)

### A) CONTRA EL ESCRITORIO (el producto sobre el que se calibró el factor)
   app           1.10     1.10×      $6,659   ✓ cierra
   via           1.09     0.97×      $5,861   ✓ cierra
   rio           1.07     1.08×      $6,509   ✓ cierra
   feather       1.04     1.00×      $6,065   ✓ cierra
   flex          1.07     1.07×      $6,491   ✓ cierra
   alba          1.55     1.50×      $9,106   ✓ cierra
   cirque        2.30     2.12×     $12,813   ✓ cierra
   luna          2.80     2.81×     $17,030   ✓ cierra

### B) CONTRA EL BENCH, $/puesto (donde App LT ya cotiza por PAPEL)
   app           1.10     1.58×      $4,961   ✗ FUERA por +44%
   via           1.09     1.55×      $4,870   ✗ FUERA por +42%
   rio           1.07     1.24×      $3,901   ✗ FUERA por +16%
   feather       1.04     3.55×     $11,155   ✗ FUERA por +242%
   flex          1.07     4.13×     $12,973   ✗ FUERA por +286%
   alba          1.55     2.64×      $8,295   ✗ FUERA por +71%
   cirque        2.30     3.36×     $10,544   ✗ FUERA por +46%
```

**Causa A — App LT no se cotiza igual a sí misma.** Su escritorio cae al modelo Intelisis ($6,054); su banca doble cae a la escalera por usuario ($3,138/puesto = **0.70×** su propio modelo de $4,510). Los `FACTOR_LINEA` se despejaron contra el MODELO. Al re-anclar la banca al papel, la referencia se movió 30% hacia abajo **sólo en el bench** y nadie recalculó los factores. De ahí salen los +42% a +46% de App, Vía y Cirque, y el +16% de Río.

**Causa B — el factor se calibró en un producto y se aplica a todos.** `MEDIDO_ANTES` se midió "sobre un escritorio/bench comparable" (comentario de `factoresLinea.js:45`) y `factorDeLinea` lo aplica a los 24 productos de la línea. Donde la relación bench↔escritorio de la línea no es la de App LT, el factor explota:

```
   feather  objetivo 1.04×  factor 1.224
      escritorio      1.00×  ✓        bench_doble  3.55×  ✗ +242%
   flex     objetivo 1.07×  factor 3.185
      escritorio      1.07×  ✓        banca_doble  4.13×  ✗ +286%
```

`AJUSTE_PRODUCTO` (`factoresLinea.js:72-84`) parcha exactamente 4 productos. Quedan **12 productos rotos sin parche**: `feather.bench_sencillo` (+101%), `feather.bench_doble` (+242%), `flex.banca_doble` (+286%), `via.banca_doble` (+42%), `app.escritorio_l` (+67%), `app.banca_doble` (+44%), `rio.estacion` (+34%), `alba.bench` (+71%), `alba.olga` (+30%), `cirque.banca` (+46%), `cirque.estacion` (+66%), `luna.mesa_juntas` (+28%).

### Cuánto dinero mueve
`node scratchpad/aud_tabla.mjs`

```
   app       objetivo   $3,452/puesto · cotiza    $4,961 →    $150,906 de más en 100 puestos (44%)
   via       objetivo   $3,420/puesto · cotiza    $4,870 →    $144,944 de más en 100 puestos (42%)
   rio       objetivo   $3,358/puesto · cotiza    $3,901 →     $54,366 de más en 100 puestos (16%)
   feather   objetivo   $3,264/puesto · cotiza   $11,155 →    $789,167 de más en 100 puestos (242%)
   flex      objetivo   $3,358/puesto · cotiza   $12,973 →    $961,572 de más en 100 puestos (286%)
   alba      objetivo   $4,864/puesto · cotiza    $8,295 →    $343,115 de más en 100 puestos (71%)
   cirque    objetivo   $7,217/puesto · cotiza   $10,544 →    $332,648 de más en 100 puestos (46%)
```

Flex es la línea de bajo costo y hoy cotiza el bench **4.13× App LT**. Un vendedor que ofrezca Flex creyendo que abarata está cobrando casi cuatro veces.

### El arreglo propuesto (NO aplicado)
Dos parches, en este orden:

**(a) Calibrar por FAMILIA DE PRODUCTO, no por línea.** En `src/datos/factoresLinea.js`, cambiar `MEDIDO_ANTES` de un número por línea a un mapa `linea → familia → medido`, con al menos dos familias (`escritorio`, `bench`), y que `factorDeLinea(ruta, producto)` resuelva por familia:

```js
// factoresLinea.js — reemplaza MEDIDO_ANTES y factorDeLinea
const FAMILIA = (p) => (/bench|banca|estacion/.test(p) ? 'bench'
                      : /mesa|olga|junta/.test(p) ? 'mesa' : 'escritorio');
const MEDIDO_ANTES = {
  applt:   { escritorio: 1.00, bench: 1.00, mesa: 1.00 },
  feather: { escritorio: 0.85, bench: 2.90, mesa: 0.85 },   // ← medir con aud_orden2.mjs
  flex:    { escritorio: 0.336, bench: 1.30, mesa: 0.336 },
  // … una fila por línea
};
export const factorDeLinea = (ruta, producto) => {
  const f = MEDIDO_ANTES[ruta]?.[FAMILIA(producto)];
  const obj = OBJETIVO_LINEA[ruta];
  return (obj && f ? obj / f : 1) * (AJUSTE_PRODUCTO[`${ruta}.${producto}`] ?? 1);
};
```
Los `MEDIDO_ANTES` por familia se sacan corriendo `aud_orden2.mjs` con los factores puestos en 1.

**(b) Fijar UNA sola referencia de App LT.** Hoy `precioDePieza` (`lineas.js:208-220`) deja que App LT se cotice por modelo en unos productos y por escalera en otros. Mientras existan las dos, el denominador de la calibración tiene que ser el que la app **cotiza**, no el modelo. Documentarlo arriba de `MEDIDO_ANTES` y recalibrar contra `costearConfig('applt', …)`, no contra `precioVenta(...)`.

> ⚠️ **Antes de tocar nada**, esto necesita confirmación de Rodrigo: el objetivo `flex: 1.07` y `feather: 1.04` es un estimado suyo, no papel. Puede ser que el objetivo esté mal y el precio bien. Lo que NO puede seguir es que el escritorio cierre y el bench no.

---

## 2 · Voni pierde todos los add-ons del módulo
**$370,296 sin cobrar en un proyecto de 96 puestos**

### Qué está mal
`costearItem` —el camino por el que Voni arma una cotización— nunca lee `g.addons`. La pantalla `CosteadorLinea` sí los cobra, como partidas aparte. Además `configDesde` no copia `gavetas`, así que por el camino de Voni la gaveta **ni siquiera llega a la config**.

### Dónde
- `src/datos/lineas.js:243-246` (`costearItem` arma `pieza` sin `addons`) y `:301-310` (el `return` no los incluye)
- `src/datos/lineas.js:132-136` (`configDesde` devuelve `largoMM/fondoMM/…/biombo/finish/sels/checks` — **`gavetas` no está**)
- Comparar con `src/componentes/CosteadorLinea.jsx:83-84` y `src/App.jsx:416-431`, que sí los cobran

### Cómo lo reproduje
`node scratchpad/aud_addons.mjs`

```
cfg={"largoMM":1200,"usuarios":8,"electrico":true}
   config resuelta electrico=true gavetas=undefined
   costearItem (Voni)  precioUnitario = $23,344   claves devueltas: NO trae addons
   el generador declara 1 add-on(s) por $5,178: Sistema eléctrico (8 usuarios: …)
   ✗ Voni pierde $5,178 (22% del módulo)

### ¿la gaveta llega por el camino de Voni?
   config.gavetas = undefined → ✗ se pierde: configDesde no copia `gavetas`
```

De paso quedó **verificado contra el papel** que el precio del eléctrico sí está bien (`226030018`, con la columna `Desc. 40%` impresa): los 5 escalones dan al peso.

```
   banca_sencilla 1u: app bruta $3,030 (papel $3,030)  neto $1,818 (papel $1,818)  ✓
   banca_sencilla 2u: app bruta $4,230 (papel $4,230)  neto $2,538 (papel $2,538)  ✓
   banca_sencilla 3u: app bruta $5,430 (papel $5,430)  neto $3,258 (papel $3,258)  ✓
   banca_doble    4u: app bruta $5,230 (papel $5,230)  neto $3,138 (papel $3,138)  ✓
   banca_doble    8u: app bruta $8,630 (papel $8,630)  neto $5,178 (papel $5,178)  ✓
```

### Cuánto dinero mueve
`node scratchpad/aud_dinero.mjs`

```
   módulo 8u con eléctrico: Voni cotiza $23,344, la pantalla cotiza $28,522
   diferencia $5,178 por módulo (22%)
   proyecto de 96 puestos (12 módulos de 8u) = $62,136 sin cobrar
   + 96 gavetas = $308,160 sin cobrar
```
**Total $370,296** en un proyecto del tamaño de los que ya cotizaron.

### El arreglo propuesto (NO aplicado)
```js
// src/datos/lineas.js — configDesde, en el return de la línea 132
  return {
    producto: producto.id,
    largoMM: largo, fondoMM: fondo, diametroMM: diam, usuarios, largoLateralMM: lateral,
    gavetas: Math.max(0, Math.round(Number(s.gavetas) || 0)),   // ← FALTA
    biombo, finish, ...sels, ...checks,
  };

// src/datos/lineas.js — costearItem, en el return de la línea 301
    precioReal: pr.real,
    avisos,
    // Los add-ons son partidas aparte a precio de lista real, igual que en la
    // pantalla. Sin esto Voni cotiza el módulo pelón y regala el eléctrico.
    addons: (g.addons || []).map((a) => ({ ...a, cantidad: (a.cantidad || 1) * cantidad })),
  };
```
Y quien consuma `costearItem` (el cotizador con IA) tiene que expandir `addons` en partidas con `precioDeLista(a.lista)` y `costoImplicito(a.lista)`, exactamente como hace `App.jsx:419-429`.

---

## 3 · El margen que reporta la app es 15 puntos más alto que el real
**22 de 24 líneas cotizan a 35% de margen creyendo que van al 50%**

### Qué está mal
En la cascada clásica `gastosOperacion = 0` **siempre**. El costo que la app reporta es costo de fabricación pelón, y el margen se calcula sobre él. Los gastos de operación (30% por parámetro; según lo que ya sabe Rodrigo, 51% real) nunca entran. La alarma de `margenMinimo: 40` nunca se dispara porque compara contra un margen que no existe.

### Dónde
`src/motor/calculo.js:372-378`
```js
} else {
    // Clasico (master 6.5): indirectos = 34% sobre material DIRECTO, sin gastos operacion.
    indirectosFabrica = materialDirecto * (par.factorIndirectosFabrica / 100);
    gastosOperacion = 0;              // ← aquí
    costoFabricacion = costoDirecto + indirectosFabrica;
    costoLote = costoFabricacion;
}
```
Y `src/datos/lineas.js:209-210`: `precioDe(resultado.costoUnitario, margen)` con `margen = 50`.

### Cómo lo reproduje
`node scratchpad/aud_dinero.mjs`

```
   línea.producto            precio      costo rep.  margen rep.  costo+30%GO  margen REAL
   eclipse.mesa_juntas          $9,803      $4,902       50.0%       $6,372        35.0%  ✗ < mínimo 40%
   pac.sillon                   $4,507      $2,253       50.0%       $2,929        35.0%  ✗ < mínimo 40%
   worklounge.spoon             $1,881        $941       50.0%       $1,223        35.0%  ✗ < mínimo 40%
   accents.pizarron             $2,558      $1,279       50.0%       $1,663        35.0%  ✗ < mínimo 40%
   privacy4.muro                $7,255      $3,627       50.0%       $4,716        35.0%  ✗ < mínimo 40%
   drift.pad_gabinete           $1,248        $624       50.0%         $811        35.0%  ✗ < mínimo 40%
   spine.cubierta                 $570        $285       50.0%         $370        35.0%  ✗ < mínimo 40%
   tetris.sofa                  $3,960      $1,980       50.0%       $2,574        35.0%  ✗ < mínimo 40%
```
Con los gastos de operación **reales** que ya midió Rodrigo (51%), el margen real cae a **24.5%** — casi la mitad de lo que la app promete y muy por debajo del `minMarkupLinea: 45`.

Sólo App LT (`modeloCosteo: 'intelisis'`) mete los gastos de operación en su costo, y por eso reporta 53.7% consistentemente (`aud_barrido.mjs`).

### El arreglo propuesto (NO aplicado)
La cascada tiene que ser la misma para las 24 líneas. Mínimo, cerrar el hueco:
```js
// src/motor/calculo.js:372 — rama clásica
} else {
    indirectosFabrica = materialDirecto * (par.factorIndirectosFabrica / 100);
    costoFabricacion = costoDirecto + indirectosFabrica;
    // Los gastos de operación existen tanto si el modelo es Intelisis como si no.
    // Dejarlos en 0 hace que el margen que reporta la app sea 15 puntos irreal.
    gastosOperacion = costoFabricacion * ((par.gastosOperacionPct || 0) / 100);
    costoLote = costoFabricacion + gastosOperacion;
}
```
**Ojo:** este parche sube el costo 30% y, con `margenObjetivo: 50`, subiría el precio 30% en las 22 líneas clásicas. Hay que decidir con Rodrigo cuál de las dos cosas se mueve: el precio sube, o `margenObjetivo` baja a lo que hoy se está cobrando de verdad. **No aplicar sin esa decisión.**

---

## 4 · `modulor.archivero_h`: el mismo mueble salta 3× según el modelo que elijas
**$5,244 por pieza · $209,746 en un proyecto de 40 archiveros**

### Qué está mal
Cuatro de los siete modelos tienen ancla de papel y tres caen al modelo. El archivero de 0.75 con **cajones** ($2,478, modelo) sale a **32%** del de 0.75 con **puertas** ($7,722, papel) — y en el taller los cajones cuestan MÁS que las puertas: llevan correderas, frentes y fondos.

### Dónde
`src/datos/preciosVenta.js:107-124` — hay filas para `puertas90`, `cajones120izq`, `cajones120der`, `puertas75`. **No** hay para `cajones75`, `corrediza120`, `corrediza150`.

### Cómo lo reproduje
`node scratchpad/aud_dinero.mjs`

```
   puertas75            $7,722  PAPEL
   cajones75            $2,478  modelo      ← 32% del de puertas
   corrediza120         $5,164  modelo      ← 55% del cajones120 de la misma caja
   corrediza150         $5,570  modelo
   cajones120der        $9,460  PAPEL
   cajones120izq        $9,460  PAPEL
   puertas90            $7,230  PAPEL
```

### Cuánto dinero mueve
$7,722 − $2,478 = **$5,244 por pieza**. El comentario de `preciosVenta.js:103-105` ya avisaba de esto ("el archivero de 1.20 salía en $3,395 y su lista real es $17,120"); se sembraron cuatro anclas y quedaron tres modelos huérfanos con el mismo error.

### El arreglo propuesto (NO aplicado)
Mientras no haya papel para esos tres, derivarlos de sus hermanos anclados en vez de dejarlos al modelo:
```js
// src/datos/preciosVenta.js — agregar al arreglo PRECIOS_VENTA
{ linea: 'modulor', producto: 'archivero_h', sel: { modelo: 'cajones75' }, largoMM: null, fondoMM: null,
  usuarios: null, biombo: null, lista: 13500, base: 'derivada', fecha: '2026-08-16',
  nota: 'DERIVADA, sin papel: mismo cuerpo de 0.75 que `puertas75` ($12,870 bruta) + el delta de cajones '
      + 'que se mide en 1.20 (cajones120 $15,767 vs corrediza). Sustituir en cuanto salga en un presupuesto.' },
{ linea: 'modulor', producto: 'archivero_h', sel: { modelo: 'corrediza120' }, largoMM: null, fondoMM: null,
  usuarios: null, biombo: null, lista: 14200, base: 'derivada', fecha: '2026-08-16',
  nota: 'DERIVADA: mismo cuerpo de 1.20 que `cajones120` ($15,767 bruta), menos el herraje de cajón.' },
{ linea: 'modulor', producto: 'archivero_h', sel: { modelo: 'corrediza150' }, largoMM: null, fondoMM: null,
  usuarios: null, biombo: null, lista: 17000, base: 'derivada', fecha: '2026-08-16',
  nota: 'DERIVADA: corrediza120 escalado por largo 1.50/1.20.' },
```
Los tres importes de arriba son un **punto de partida para que Rodrigo los mueva**, no un número medido. Lo que no puede quedarse es el $2,478.

---

## 5 · `footprintDe` agarra la "tapa" del pedestal en vez de la cubierta
**Una mesa de juntas de 1.80 m se dibuja de 15 cm en el plano**

### Qué está mal
`footprintDe` usa `.find()` — **el primer** componente cuyo nombre calce con `/cubierta|tapa|cubiert|superficie/i`. En los muebles que traen pedestal, la "Base juntas · tapa" (152 × 152 mm) aparece en el despiece antes que la "Cubierta" (1200 × 1200 mm), y gana.

### Dónde
`src/datos/lineas.js:154`
```js
const cubierta = conMedida.find((c) => /cubierta|tapa|cubiert|superficie/i.test(c.nombre || ''));
```

### Cómo lo reproduje
`node scratchpad/aud_huella.mjs` y el volcado del despiece:

```
=== eclipse.mesa_juntas | Eclipse Mesa de juntas cuadrada 1.20 m
       152 x    152 Base juntas · tapa          ← gana el .find()
      1200 x   1200 Cubierta                    ← la buena
   footprint -> {"w":152,"d":152}

=== anteo.escritorio | Anteo · Escritorio 2.10 m · …
       600 x    600 Acometida · tapa · núcleo MDF   ← gana
      2100 x    900 Cubierta escritorio 2.10 m      ← la buena
   footprint -> {"w":600,"d":600}
```

Afecta **7 configuraciones** (`eclipse.mesa_juntas` ×4, `eclipse.mesa_consejo` ×2, `anteo.escritorio`). En `aud_barrido.mjs` son las 7 primeras de la cola alta de `$/m²`, con cifras imposibles de $505,276/m² y $166,666/m².

### Cuánto dinero mueve
No mueve el precio directamente — mueve el **plano y el acomodo**: una sala con 6 mesas de juntas Eclipse le dice al proyectista que caben 40. Y contamina cualquier revisión por `$/m²`, que es justo la lente con la que se cazan los precios absurdos.

### El arreglo propuesto (NO aplicado)
```js
// src/datos/lineas.js:152-155 — dentro de footprintDe
export function footprintDe(componentes, nombre = '') {
  const conMedida = (componentes || []).filter((c) => c.largoMM && c.anchoMM);
  // 1) La cubierta, si el despiece la nombra. La MÁS GRANDE de las que calzan:
  //    un pedestal trae su propia "tapa" de 15 cm y con .find() ganaba ésa,
  //    dejando una mesa de juntas de 1.80 m dibujada de 152 mm.
  //    Además 'cubierta' manda sobre 'tapa': son piezas distintas.
  const calzan = conMedida.filter((c) => /cubierta|cubiert|superficie|tapa/i.test(c.nombre || ''));
  const preferidas = calzan.filter((c) => /cubierta|cubiert|superficie/i.test(c.nombre || ''));
  const pool = preferidas.length ? preferidas : calzan;
  const cubierta = pool.reduce((a, c) => (!a || c.largoMM * c.anchoMM > a.largoMM * a.anchoMM ? c : a), null);
  if (cubierta) return { w: cubierta.largoMM, d: cubierta.anchoMM };
  …
```

---

## 6 · `costearConfig` no tiene el respaldo de huella que sí tiene `costearItem`
**La pieza desaparece del plano en cuanto la editas**

### Qué está mal
`costearItem` (`lineas.js:280-283`) cae a `HUELLA[tipoDe(...)]` cuando el despiece no trae medidas. `costearConfig` —el camino de "editar partida"— no. Devuelve `w: 0, d: 0`.

### Dónde
`src/datos/lineas.js:332` (`costearConfig`) contra `src/datos/lineas.js:280-283` (`costearItem`).

### Cómo lo reproduje
`node scratchpad/aud_huella.mjs`
```
   tetris.sofa                      0 ×     0 mm = 0.00 m2
      Sofá Tetris individual · tela
      → huella 0 — el plano no la puede dibujar
   accents.portamonitor             0 ×     0 mm = 0.00 m2
   teamspace2.soporte               0 ×     0 mm = 0.00 m2
```
Un sofá Tetris agregado por Voni se dibuja bien; al abrirlo y cambiarle la tela, se queda en 0 × 0 y el plano deja de pintarlo.

### El arreglo propuesto (NO aplicado)
```js
// src/datos/lineas.js:332 — costearConfig
  // Mismo respaldo que costearItem: un sillón no trae medidas en el despiece
  // (es bastidor, espuma y tela) y sin esto la partida editada sale en 0 × 0
  // y desaparece del plano.
  let fp = footprintDe(g.componentes, g.nombre);
  if (!fp.w || !fp.d) {
    const [hw, hd] = HUELLA[tipoDe({ ruta, nombre: g.nombre })] || HUELLA.mueble;
    fp = { w: hw, d: hd };
  }
```

---

## 7 · `lamina-20` y `lamina-14` consumidas en m² contra un formato en kg
**Error de unidad de 7.2× y 14.9× donde aplica**

### Qué está mal
La regla de oro, en vivo. El formato de las láminas guarda **kilos por hoja** (`LAMINA20.medida = 21.3`), y todo el resto del catálogo las alimenta en kg (`cantidad: 0.2 * (largo/1000) * 7.16` — bien). Pero tres renglones les mandan `largoMM × anchoMM`, que `netoComponente` convierte a **m²**. El motor divide m² entre kg como si fueran la misma cosa.

Factor exacto: la hoja de 1.22 × 2.44 = 2.9768 m² pesa 21.3 kg → **7.155 kg/m²** en cal. 20, y **14.92 kg/m²** en cal. 14.

### Dónde
- `src/datos/rio.js:415` — `comp.push({ insumoId: b.insumo, …, largoMM: largo, anchoMM: alto })` cuando el biombo es `LP` (lámina perforada). La línea **416 de abajo lo hace bien** (`* 7.16`), lo que confirma cuál es la convención buena.
- `src/datos/luna.js:178` — `comp.push({ insumoId: LAMINA14, …, largoMM: Lc, anchoMM: 640 })`

### Cómo lo reproduje
`node scratchpad/aud_unidades.mjs` lo detecta solo (barre las 994 combinaciones y cruza `unidad`/`formato` contra cómo lo consume el despiece):
```
  ✗ lamina-20  (Lamina de acero cal. 20)
     unidad='hoja' formato=lamina/21.3 fraccion=true precio=455.82
     → formato en KG pero el despiece manda m2
     usado como ÁREA en: rio.bench_recto_doble, rio.bench_curvo_doble
        ej: Biombo curvo Lámina perforada (RIBIO32LP) [900x400]
  ✗ lamina-14  (Lamina de acero cal. 14)
     → formato en KG pero el despiece manda m2
     usado como ÁREA en: luna.escritorio
        ej: Riel deslizador (lámina cal.14 + MDF 28) [2100x640]
```
`node scratchpad/aud_lamina.mjs` lo cuantifica:
```
### rio.bench_curvo_doble  {"usuarios":"8","largo":"1200","biombo":"LP"}
   Biombo curvo Lámina perforada (RIBIO42LP)  ×4
      1200×400×1 = 0.480 m2 → se cobran 0.480 "kg"; pesa 3.43 kg (7.16 kg/m2)
   material      $9,494 →     $9,810   (+$316)
   costo u.     $14,121 →    $14,665   (+3.9%)

### rio.bench_recto_doble  {"usuarios":"8","largo":"1200","biombo":"LP"}
   material      $7,300 →     $7,742   (+$443)
   costo u.     $10,347 →    $11,109   (+7.4%)
```

### Cuánto dinero mueve
+3.9% a +7.4% del costo unitario en los benches de Río con biombo de lámina perforada. Es el hallazgo más chico de la lista **en dinero**, y el más peligroso en naturaleza: nadie lo iba a ver nunca. Río recto doble 8u con LP: **+$443 de material por módulo**.

### El arreglo propuesto (NO aplicado)
```js
// src/datos/rio.js:415 — addBiombo
  // Los paneles de PET/acrílico se consumen por m2, pero la LÁMINA se consume
  // por KILO (su formato guarda kg/hoja). Mandarle largoMM×anchoMM la deja
  // 7.16× barata y no se nota en ningún lado.
  if (b.insumo === 'lamina-20') {
    comp.push({ insumoId: b.insumo, nombre: `Biombo … (${key})`,
      cantidad: (largo / 1000) * (alto / 1000) * 7.16 });   // m2 → kg
  } else {
    comp.push({ insumoId: b.insumo, nombre: `Biombo … (${key})`, cantidad: 1, largoMM: largo, anchoMM: alto });
  }

// src/datos/luna.js:178
  comp.push({ insumoId: LAMINA14, nombre: 'Riel deslizador (lámina cal.14 + MDF 28)',
    cantidad: (Lc / 1000) * 0.64 * 14.92 });   // 44.4 kg/hoja ÷ 2.9768 m2 = 14.92 kg/m2
```

**Además, poner la red permanente.** `scripts/revisa-precios.mjs` revisa 46 de 103 insumos y **no habría cachado esto nunca**: sólo mira precios, no cómo los consume el despiece. `scratchpad/aud_unidades.mjs` es la red que falta — vale la pena moverlo a `scripts/revisa-unidades.mjs` y meterlo al mismo bloqueo de despliegue que las otras cuatro pruebas.

---

## 8 · `mermaCorte` es letra muerta en los 24 insumos `fraccion: true`
**2.0% del material del catálogo · una perilla que no hace nada**

### Qué está mal
En `comprarInsumo`, la rama de `fraccion` calcula el consumo a partir de `neto` y del aprovechamiento, y **nunca usa `conCorte`**. La variable se calcula arriba y se tira. Los 24 insumos con `fraccion: true` (todos los tableros y todas las láminas) declaran `mermaCorte: 6` u `8` y ninguno lo aplica.

### Dónde
`src/motor/calculo.js:197` (`factorMerma` se calcula), `:207` (`conCorte` se acumula), `:221-234` (la rama `fraccion` **no lo usa**).

### Cómo lo reproduje
```
$ node -e "… calcular con melamina-19 mermaCorte 6 / 0 / 50 …"
mermaCorte 6 (real): 164.4719
mermaCorte 0       : 164.4719
mermaCorte 50      : 164.4719
=> mermaCorte NO HACE NADA en insumos fraccion:true
detalle pct desperdicio que muestra la UI: 20.0%
```
El 20% que muestra la interfaz es el aprovechamiento (1 − 0.80), no la merma de corte.

### Cuánto dinero mueve
`node scratchpad/aud_dinero.mjs`
```
   insumos fraccion:true con mermaCorte>0: 24/24
   material de todo el catálogo (1 pza c/u):  hoy $273,836   honrando mermaCorte $279,364  (+2.0%)
```

### El arreglo propuesto (NO aplicado)
Puede ser deliberado (que el aprovechamiento del 80% ya cubra toda la merma). Si es así, el arreglo es de honestidad, no de dinero: **quitar `mermaCorte` de los 24 insumos `fraccion: true`** en `src/datos/insumos.js` (las funciones `tablero()` línea 39 y los `ins({... fraccion: true ...})` de las láminas), para que la pantalla de Precios no muestre una perilla muerta. Si NO es deliberado:
```js
// src/motor/calculo.js:224 — rama fraccion de comprarInsumo
    const aprov = par.aprovechamientoCorte > 0 ? par.aprovechamientoCorte / 100 : 1;
    const areaFmt = insumo.formato.medida;
    // La merma de corte (kerf, escuadre) es aparte del aprovechamiento: una es
    // lo que se lleva la sierra y la otra el retazo que no se acomoda.
    const hojas = conCorte / (areaFmt * aprov);
```
**Decidir con Producción cuál de las dos.** No aplicar a ciegas: sube el material 2%.

---

## 9 · `factorDeLinea` infla también el COSTO, no sólo el precio
**La hoja de costo de Cirque miente por 4.5×**

### Qué está mal
En `precioDePieza`, el factor de calibración se aplica al precio **y al costo**, para que el margen salga siempre 50%. El resultado es que la hoja de costo enseña un costo inventado y el semáforo de margen no puede detectar nada nunca: está clavado en 50.0% por construcción.

### Dónde
`src/datos/lineas.js:215-222`
```js
const factor = (g.factorPrecio || 1) * factorDeLinea(ruta, config?.producto);
…
const costo = real ? costoImplicito(real.lista)
  : (porUsuario ? … : resultado.costoUnitario * factor);   // ← el factor sobre el COSTO
```

### Cómo lo reproduje
`node scratchpad/aud_barrido.mjs` — el margen de las 251 configuraciones sale exactamente 50.0% o 53.7%, sin una sola excepción:
```
  cirque       50.0% … 50.0%   factorLinea=4.510
  flex         50.0% … 50.0%   factorLinea=3.185
  alba         50.0% … 50.0%   factorLinea=2.870
```
`node scratchpad/aud_referencia.mjs` enseña el número real: `cirque.escritorio` reporta un costo de **$6,406** cuando el motor calcula **$1,421**.

### Cuánto dinero mueve
Cero en el precio cotizado. Todo en la capacidad de detectar. Mientras el costo lleve el factor, `margenMinimo: 40` y `minMarkupLinea: 45` son decorativos y ni el hallazgo #3 ni ningún error de material futuro puede salir por ahí.

### El arreglo propuesto (NO aplicado)
```js
// src/datos/lineas.js:221 — precioDePieza
  // El factor de línea es una calibración de PRECIO. Metérselo también al costo
  // clava el margen en 50% por construcción y apaga el semáforo: con Cirque
  // ×4.51, la hoja de costo enseña $6,406 donde el motor calculó $1,421.
  const costo = real ? costoImplicito(real.lista)
    : (porUsuario ? costoImplicito(porUsuario.lista / (1 - 0.40)) : resultado.costoUnitario);
  return { resultado, margen, precio, costo, real: …,
           factorCalibracion: factor };   // que la pantalla lo pueda enseñar aparte
```
Con esto el margen de Cirque saltaría a 89% y el de Eclipse quedaría en 50%, que es información de verdad: dice cuáles líneas están calibradas a mano y cuáles no.

---

## Cabos sueltos (verificados, sin dinero asignable todavía)

**a) `applt.mesa_juntas` 2400 × 1200: tres papeles, 2.1× de diferencia.** El price-book toma `226030018` ($27,346 bruta → **$16,408** de lista). Los mismos 2400 × 1200 de 8 usuarios aparecen en `226050047` a **$13,780** y en `225080025` a **$7,870**. La app cotiza +19% sobre uno y +108% sobre el otro (`node scratchpad/aud_papel.mjs`). El de `226030018` incluye 2 cajas eléctricas, pero eso no explica 2.1×. **Hay que preguntarle a Rodrigo cuál es el bueno.**

**b) La línea App sale 41–54% por debajo de los 11 renglones de `226020037`.** Consistente, en una sola dirección, en las 11 filas del mismo documento (`aud_papel.mjs`). No lo puedo cerrar: ese PDF no está en `~/Downloads`, así que no pude comprobar si imprime columna `Desc. 40%` (o sea si el `banco` guardó bruta o neta). **Si `226020037` publica bruta, la carga al banco está mal y App está bien; si publica neta, App cotiza a la mitad.** Es una hora de trabajo con el PDF en la mano y vale la pena hacerla antes que cualquier otra cosa de este bloque.

**c) `comprar()` ignora los parámetros del usuario.** `src/motor/calculo.js:92` lee `PARAMETROS_DEFAULT.aprovechamientoCorte` en vez del `par` que le llega. Hoy no mueve dinero porque `calcular()` usa `comprarInsumo()`, no `comprar()`; `comprar()` sólo lo usan las pruebas. Es una trampa esperando a quien la llame desde la interfaz.

**d) 34 de 103 insumos no los usa ningún generador** (`melamina-16-color`, `mdf-25`, `chapa-antracite`, `lamina-18/12/10`, `ptr-14/12/10`, `cubrecanto-22/32`, `caja-byrne`, `pintura-polvo`, `caja-lisboa`, `ptr-3-14`, …). Varios se cargaron a propósito desde la lista de Compras del 2026-08-14 y **nunca se conectaron al despiece** — entre ellos los dos que vienen en dólares. Lista completa en la salida de `aud_unidades.mjs`.

**e) 83 de 103 insumos no dicen de dónde salió su precio** (`node scripts/revisa-precios.mjs`). Ya lo reporta esa red; sigue abierto.

**f) Casos límite: limpios.** `cantidad` = 0, −5, NaN, 1.5, 1000 no producen NaN, Infinity ni excepción en ninguna de las 4 líneas probadas (`aud_referencia.mjs`); `Math.max(1, Math.round(…))` los amarra bien. El lote sí abarata correctamente (`cirque.escritorio` baja de $12,813 a $11,736 entre n=1 y n=1000). **No hay hallazgo aquí.**

---

## Tabla de confianza · las 24 líneas

`node scratchpad/aud_tabla.mjs`

| Línea | Prods | Filas price-book | Renglones banco | Factor | Ajustes | Confianza | Qué le falta para ser creíble |
|---|---|---|---|---|---|---|---|
| App LT (`applt`) | 6 | 18 | 67 | 1.000 | 0 | **ANCLA DE PAPEL** | Nada de precio. Falta que su escritorio y su banca se coticen por la MISMA vía (#1) |
| Modulor (`modulor`) | 12 | 4 | 6 | 1.000 | 0 | **ANCLA DE PAPEL** | Papel para `cajones75`, `corrediza120`, `corrediza150` (#4) |
| Río (`rio`) | 6 | 1 | 2 | 1.126 | 0 | **ANCLA DE PAPEL** (sólo el bench curvo 8u) | Arreglar la lámina LP (#7); anclar `estacion` (+34%) y `mesa_juntas`; orden de producción con tiempos para sustituir el insumo `curvado` |
| Mox (`mox`) | 2 | 1 | 5 | 1.000 | 0 | **ANCLA DE PAPEL** | Papel para la variante de tapa/frentes que no es melamina |
| App (`app`) | 6 | 0 | 12 | 1.100 | 0 | papel indirecto (hereda ×1.10 de App LT) | **Resolver el cabo (b): 11 renglones de papel a −45%.** Bench a +44% (#1) |
| Cirque (`cirque`) | 7 | 0 | 2 | 4.510 | 2 | papel indirecto | Bench +46%, estación +66% (#1). El factor ×4.51 es el más grande del sistema y descansa en un solo escritorio |
| Alba (`alba`) | 7 | 0 | 2 | 2.870 | 2 | papel indirecto | Bench +71%, `olga` +30% (#1) |
| Ergonova 4 (`ergo4`) | 4 | 0 | 6 | 1.000 | 0 | papel indirecto | Sembrar el price-book: hay 6 renglones de banco sin convertir en ancla |
| Eclipse (`eclipse`) | 11 | 0 | 1 | 1.000 | 0 | papel indirecto | Huella rota en 6 de 11 productos (#5). 11 productos y una sola referencia de papel |
| Work Lounge (`worklounge`) | 4 | 0 | 6 | 1.000 | 0 | papel indirecto | Sembrar price-book desde sus 6 renglones de banco |
| Accents (`accents`) | 14 | 0 | 4 | 1.000 | 0 | papel indirecto | 14 productos con 4 renglones de banco: la línea más ancha y peor cubierta |
| Tetris (`tetris`) | 1 | 0 | 1 | 1.000 | 0 | papel indirecto | Huella 0 × 0 al editar (#6) |
| Pebble (`pebble`) | 1 | 0 | 2 | 1.000 | 0 | papel indirecto | Sembrar price-book |
| Vía (`via`) | 6 | 0 | 0 | 0.826 | 0 | sólo modelo + factor | **Ni un renglón de papel.** Bench a +42% (#1) |
| Feather (`feather`) | 3 | 0 | 0 | 1.224 | 0 | sólo modelo + factor | **Ni un renglón de papel.** Bench a **+242%** (#1) |
| Flex (`flex`) | 4 | 0 | 0 | 3.185 | 0 | sólo modelo + factor | **Ni un renglón de papel.** Bench a **+286%** (#1) — la línea barata cotiza 4× App LT |
| Luna (`luna`) | 4 | 0 | 0 | 1.250 | 0 | sólo modelo + factor | **Ni un renglón de papel.** Lámina cal.14 mal medida (#7). MP de la estructura inox sin calibrar |
| Spine (`spine`) | 4 | 0 | 0 | 1.000 | 0 | **SÓLO MODELO, sin nada** | Todo: ni papel, ni factor, ni banco. Margen real 35% (#3) |
| Eclipse Drift (`drift`) | 5 | 0 | 0 | 1.000 | 0 | **SÓLO MODELO, sin nada** | Todo |
| Anteo (`anteo`) | 6 | 0 | 0 | 1.000 | 0 | **SÓLO MODELO, sin nada** | Todo. Huella rota en el escritorio (#5). Su `factorPrecio` es el único número que la sostiene |
| Arlequín (`arlequin`) | 1 | 0 | 0 | 1.000 | 0 | **SÓLO MODELO, sin nada** | Todo |
| Pac (`pac`) | 1 | 0 | 0 | 1.000 | 0 | **SÓLO MODELO, sin nada** | Todo. Margen real 35% (#3) |
| TeamSpace II (`teamspace2`) | 1 | 0 | 0 | 1.000 | 0 | **SÓLO MODELO, sin nada** | Todo. Huella 0 × 0 (#6) |
| Privacy 4 (`privacy4`) | 2 | 0 | 0 | 1.000 | 0 | **SÓLO MODELO, sin nada** | Todo. Margen real 35% (#3) |

**Resumen: 4 líneas con ancla de papel propia, 9 con papel indirecto, 4 con puro factor de calibración y 7 con absolutamente nada.** Las 7 de la última fila cotizan hoy a costo × 2 sobre un costo que no lleva gastos de operación.

---

## Qué haría yo primero

1. **Verificar `226020037`** (cabo b). Es la única duda abierta que puede cambiar el signo de un hallazgo: o la carga del banco está mal, o la línea App cotiza a la mitad. Una hora con el PDF.
2. **Parchar #2 (Voni pierde add-ons) y #6 (huella al editar).** Son bugs sin decisión de negocio: nadie tiene que opinar, sólo se arreglan. $370k por proyecto.
3. **Llevarle #1 y #3 a Rodrigo juntos.** El bench desalineado y el margen que no lleva gastos de operación son la misma pregunta de fondo — *cuál es la cascada de verdad* — y ninguno de los dos se puede tocar sin que él decida si sube el precio o baja el objetivo de margen.
4. **Mover `aud_unidades.mjs` a `scripts/revisa-unidades.mjs`** y meterlo a la red que bloquea el despliegue. Es la única red que caza el error de #7, y ese error nadie lo ve nunca a mano.
