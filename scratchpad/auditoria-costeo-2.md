# Auditoría de costeo 2 — 2026-08-16

Jefe de Costos. Barrido completo: **24 líneas · 132 productos · 822 configuraciones costeadas**,
contrastadas contra los 9 presupuestos de `~/Downloads/` y contra el price-book.

Todos los scripts viven en `scratchpad/aud2/` y se corren desde la raíz del proyecto
(`node scratchpad/aud2/<script>.mjs`). **No se tocó `src/`. No se corrió `deploy.sh`.**

---

## Veredicto de una línea

Lo que se arregló hoy, se arregló: **las unidades ya cuadran** (barrido de los 61 insumos
que consume el despiece: 0 errores kg-contra-m²), el **conteo de divisores es correcto**
(verificado contra el render del PDF), y **la jerarquía cierra en el punto donde se calibró**.

Pero el guardián que dice "✓ todas las líneas respetan el orden comercial" **mide exactamente
el mismo punto que usó para calibrar**, así que no puede fallar nunca. Medido en TODAS las
variantes, **38 de 45 productos calibrados se salen más de 35% de su objetivo**, y una banca
Alba de 2 usuarios cotiza **$170,301**.

Y hay algo más grande que cualquier factor: **el margen que enseña la app no mide nada.**
En las 822 configuraciones sólo toma **dos valores: 50.00% y 53.70%**. El semáforo de
`minMarkupLinea = 45%` es matemáticamente incapaz de prender.

---

# HALLAZGOS, DE MÁS A MENOS DINERO

## 1 · La jerarquía se verifica contra sí misma · ilimitado

**Reproduce:** `node scratchpad/aud2/a2_jerarquia_honesta.mjs`

`scripts/calibra-jerarquia.mjs` mide UNA configuración por línea×familia (primer producto de
la familia, primera opción de cada select, 6 usuarios, largo 1200) y despeja
`factor = objetivo ÷ medido`. `scripts/revisa-jerarquia.mjs` — el que bloquea el despliegue —
**mide exactamente esa misma configuración**. Por construcción devuelve el objetivo al centavo:

```
LÍNEA        obj    bench   escrit.  juntas
applt        1.00    1.00    1.00    1.00
app          1.10    1.10    1.10    1.10
via          1.09    1.09    1.09        —
rio          1.07    1.07        —   1.08
cirque       2.30    2.30    2.30    2.30
✓ todas las líneas respetan el orden comercial en todas sus familias.
```

Ningún número se desvía ni 0.01 del objetivo. Eso no es una verificación, es un espejo.

Medido en todas las variantes del catálogo (mismo criterio: bench por puesto, resto por pieza):

```
PRODUCTO                       fam        obj    min×   max×   PEOR desv   precio peor
alba.bench                     bench      1.55    1.68  20.64    13.32×     $170,301  ✗
alba.teamspace                 bench      1.55    8.51  12.26     7.91×      $50,591  ✗
rio.mesa_juntas                bench      1.07    1.87   6.00     5.61×      $24,753  ✗
cirque.estacion                bench      2.30    6.66   8.24     3.58×      $34,015  ✗
rio.estacion                   bench      1.07    1.54   3.35     3.13×      $13,812  ✗
applt.escritorio_l             escritorio 1.00    1.73   2.04     2.04×      $11,315  ✗
...
38 de 45 productos calibrados se salen >35% de su objetivo en alguna variante.
```

**El caso Alba, con lupa** (`node scratchpad/aud2/a2_alba.mjs`):

```
factorFamilia alba/bench = 7.209    MEDIDO_ANTES.alba.bench = 0.215
tipo           2u          4u          6u          8u
ind_sencilla   $41,672     $41,672     $41,672     $41,672   ← NO escala con usuarios
doble          $170,301    $311,387    $442,459    $442,459
                                     (App LT 6u = $17,600)
```

La calibración midió `ind_sencillo` —el primer `tipo` de la lista— **y lo dividió entre 6
usuarios aunque el precio no cambia con los usuarios**. De ahí sale un ×7.209 que después se
le aplica a `doble`, que sí escala. Resultado: una banca Alba doble de 6 puestos cotiza
**25× una App LT de 6 puestos**, cuando el objetivo dice 1.55×.

**Cuánto dinero:** no acotado. Un solo renglón de Alba en una propuesta la vuelve impresentable.

**Parche propuesto (SIN APLICAR)** — `scripts/calibra-jerarquia.mjs` y `scripts/revisa-jerarquia.mjs`:

```diff
--- a/scripts/calibra-jerarquia.mjs
+++ b/scripts/calibra-jerarquia.mjs
-function medir(ruta, fam) {
-  const prod = reg && comparable(reg, fam);
-  ...
-  const r = costearConfig(est, ruta, prod.id, sel, 1);
-  const u = Number(sel.usuarios) || 1;
-  return { v: fam === 'bench' ? r.precioUnitario / u : r.precioUnitario, ... };
-}
+// Se mide la MEDIANA de TODAS las variantes de TODOS los productos de la familia,
+// no una sola configuración. Un factor despejado sobre un punto sólo garantiza
+// ese punto, y `revisa-jerarquia` volvía a medir el mismo punto: el guardián
+// nunca podía gritar.
+function medir(ruta, fam) {
+  const reg = LINEAS_REG[ruta];
+  const vals = [];
+  for (const prod of (reg?.productos || [])) {
+    if (familiaDe(prod.id, prod.nombre) !== fam) continue;
+    for (const sel of variantes(prod)) {          // todas las opciones, no la primera
+      const r = costearConfig(est, ruta, prod.id, sel, 1);
+      if (!r || !r.precioUnitario || r.precioReal) continue;
+      // Sólo se divide entre usuarios si el precio DE VERDAD escala con ellos:
+      // si no escala, dividir es fabricar un factor 3× de la nada (caso Alba).
+      const u = escalaConUsuarios(ruta, prod, sel) ? (Number(sel.usuarios) || 1) : 1;
+      vals.push(r.precioUnitario / u);
+    }
+  }
+  if (!vals.length) return null;
+  vals.sort((a, b) => a - b);
+  return { v: vals[Math.floor(vals.length / 2)], n: vals.length };
+}
```

Y en `revisa-jerarquia.mjs`, sustituir `primerProducto`+`sel` por el mismo barrido completo,
para que el guardián mida algo distinto de lo que calibró. **Con eso el guardián empieza a
fallar — y debe fallar hoy**: Alba, Cirque, Río y Vía no pasan.

---

## 2 · App LT módulo 1.50 y 1.80: 33–46% por debajo del papel · $95,195 en un proyecto de 40 puestos

**Reproduce:** `node scratchpad/aud2/a2_applt.mjs` · `node scratchpad/aud_papel.mjs`

`FACTOR_LARGO = { 1200: 1, 1500: 1.12, 1800: 1.18 }` está sacado *del modelo*, no del papel.
El papel de esa misma medida dice otra cosa:

| módulo | fuente | $/usuario de LISTA |
|---|---|---|
| 1.20 × 1.20, 6u | Mixue 226030134 | **$2,933** |
| 1.50 × 1.20, 4u sin laterales | BMU 225080025 | **$5,648** |
| 1.50 × 1.20, 2u cristal | Fuerza Especial 226010047 | **$5,298** |

Eso es **1.93×**, no 1.12×. Y como la escalera sólo se salta cuando el biombo coincide *exacto*
con una fila del price-book, la app produce dos precios distintos para el mismo módulo según
un desplegable:

```
1500  4 melamina     $22,590   $5,648/u  PAPEL 225080025
1500  4 cristal      $23,000   $5,750/u  PAPEL 225080025
1500  4 pet          $14,058   $3,515/u  escalera        ← −38% por cambiar el biombo
1500  8 (cualquiera) $26,145   $3,268/u  escalera        ← −42% contra el $/u del papel
1800  8 (cualquiera) $27,546   $3,443/u  escalera        ← sin ninguna ancla de papel
```

Contra el papel, el mismo patrón sale por todos lados (`aud_papel.mjs`):

```
 -55%  $15,700 → $7,029    Módulo operativo 1500×1200 2u   (225080025 / 2508040)
 -46%  $25,980 → $14,058   Módulo operativo 3000×1200 4u   (225080025)
 -46%  $36,260 → $19,710   Módulo operativo 4500×1200 6u   (225080025)
 -39%  $23,000 → $14,058   Módulo operativo 3000×1200 4u   (225080025)
 -34%  $10,596 → $7,029    Bench doble 1500×1200 2u        (226010047)
```

**Cuánto dinero:** 5 módulos de 1.50 × 8 usuarios (40 puestos) = **$95,195 que no se cobran**
en un solo proyecto. `MAE mediano de App LT contra el papel: 33%`.

**Parche propuesto (SIN APLICAR)** — `src/datos/preciosVenta.js`:

```diff
-// Cuánto más caro es el módulo largo que el de 1.20, según el propio modelo.
-const FACTOR_LARGO = { 1200: 1, 1500: 1.12, 1800: 1.18 };
+// Cuánto más caro es el módulo largo que el de 1.20, MEDIDO CONTRA EL PAPEL, no
+// contra el modelo. El 1.12 salía del modelo y dejaba el módulo de 1.50 un 40%
+// abajo de sus propias anclas: $3,515/usuario contra los $5,648 que imprime
+// BMU 225080025 para ese mismo módulo.
+//   1.50: $5,648/u ÷ $2,933/u (Mixue 1.20 6u) = 1.926
+//   1.80: SIN ancla de papel. Se extrapola lineal por metro de módulo y se marca
+//         como derivado hasta que llegue un presupuesto de 1.80.
+const FACTOR_LARGO = { 1050: 1, 1200: 1, 1500: 1.93, 1800: 2.24 };
+const SIN_ANCLA = new Set([1800]);   // -> `derivado: true` en el resultado
```

⚠️ Antes de aplicarlo, Rodrigo tiene que confirmar **qué parte del 1.93× es la longitud y qué
parte es la especificación** (el módulo del BMU trae biombo melamina ABS, semimamparas
centrales y conducto metálico; el de Mixue trae PET). Si es mitad y mitad, el factor correcto
está más cerca de 1.45 y falta cobrar el spec aparte. **Hoy no se cobra ni una cosa ni la otra.**

---

## 3 · El margen que enseña la app sólo tiene dos valores · destruye el control de descuentos

**Reproduce:** `node scratchpad/aud2/a2_margen.mjs`

```
VALORES DISTINTOS DE MARGEN en las 822 configs del barrido:
   50.0000%  × 721   ej: via.escritorio
   53.7037%  × 101   ej: applt.escritorio  [PAPEL]

MARKUP sobre costo (piso minMarkupLinea = 45%): 116.00% · 100.00%
→ ninguna partida puede caer por debajo del piso: el semáforo nunca prende.

Descuento máximo que calcula Cotizacion.jsx: 32.87% · 27.50%
```

Es aritmética, no casualidad. En `src/datos/lineas.js:227-229`:

```js
const precio = real ? precioDeLista(real.lista) : precioModelo * factor;
const costo  = real ? costoImplicito(real.lista) : resultado.costoUnitario * factor;
```

- Con precio de papel: `precio = lista × 0.60`, `costo = lista ÷ 3.6` → margen ≡ **53.70%**.
- Con modelo: `precio = costo/(1−0.50) × factor`, `costo = costo × factor` → el factor se
  cancela → margen ≡ **50.00%**.

El costo **se deriva del precio**, no se mide. Por eso el semáforo, el piso de markup
(`nBajoPiso` siempre 0) y el "descuento máximo" que se le ofrece al vendedor son constantes
decorativas. Un vendedor que ve "50% de margen · puedes dar hasta 27.5%" está viendo la
misma pantalla para un escritorio Vía de $4,629 y para una banca Alba de $170,301.

**Parche propuesto (SIN APLICAR)** — `src/datos/lineas.js`:

```diff
   const precio = real ? precioDeLista(real.lista) : (porUsuario ? porUsuario.lista : precioModelo * factor);
-  const costo = real ? costoImplicito(real.lista)
-    : (porUsuario ? costoImplicito(porUsuario.lista / (1 - 0.40)) : resultado.costoUnitario * factor);
+  // EL COSTO NO SE DERIVA DEL PRECIO. Derivarlo hace que el margen sea una
+  // constante (50.00% o 53.70% en las 822 configs del catálogo) y con eso el
+  // semáforo, el piso de markup y el descuento máximo dejan de medir nada.
+  // El costo es el del MOTOR —lo que de verdad cuesta el despiece— y el margen
+  // es lo que salga de comparar los dos. Cuando salga feo, ES la señal.
+  const costo = resultado.costoUnitario;
+  // Se conserva el costo derivado como referencia, para poder enseñar los dos y
+  // ver de un vistazo qué tan lejos está el modelo del precio real.
+  const costoDerivado = real ? costoImplicito(real.lista)
+    : (porUsuario ? costoImplicito(porUsuario.lista / (1 - 0.40)) : resultado.costoUnitario * factor);
-  return { resultado, margen, precio, costo, real: !!real && !real.heredada };
+  return { resultado, margen, precio, costo, costoDerivado, real: !!real && !real.heredada };
```

⚠️ Este parche **va a mostrar márgenes horribles en las líneas sin materia prima real**
(Anteo sin mármol cargado, Alba, Accents). Eso es correcto: hoy esas líneas mienten con un
50% redondo. Se debe aplicar junto con el punto 6 (gastos de operación) o el número seguirá
inflado por el otro lado.

---

## 4 · Maniobras y flete se cuentan como utilidad pura · $74,930 fantasma en el proyecto tipo

**Reproduce:** `node scratchpad/aud2/a2_dinero.mjs` · `src/componentes/Cotizacion.jsx:151-158`

```js
const maniobras = subtotal * (maniobrasPct / 100);   // 3%
const flete     = subtotal * (fletePct / 100);       // 10%
const baseGravable = subtotal + contingencia + maniobras + flete;
const costoTotal   = partidas.reduce((a, p) => a + (p.costoUnitario || 0) * p.cantidad, 0);
const utilidadTotal = baseGravable - costoTotal;     // ← maniobras y flete entran completos
```

Maniobras es cuadrilla, elevador y acarreo; flete es camión. Los dos son **costo de bolsillo**,
y no hay ni un peso de costo enfrente. El 13% del subtotal entra íntegro a la utilidad.

Proyecto tipo (40 puestos App LT 1.50, 8 archiveros Modulor, 2 mesas de juntas, 40 gavetas Mox,
40 sillas):

```
Precio de lista            $576,382
Maniobras 3%                $17,291
Flete 10%                   $57,638
Base gravable              $651,311
Costo (lo que reporta)     $228,195
UTILIDAD que enseña        $423,116   margen 65.0%
```

**$74,930 de esa utilidad no existe.** Y el margen de 65% que enseña la app en un proyecto
realista es, en cristiano, imposible.

**Parche propuesto (SIN APLICAR)** — `src/componentes/Cotizacion.jsx`:

```diff
   const baseGravable = subtotal + contingencia + maniobras + flete;
   const iva = baseGravable * (estado.parametros.ivaPorcentaje / 100);
   const total = baseGravable + iva;
   const costoTotal = partidas.reduce((a, p) => a + (p.costoUnitario || 0) * p.cantidad, 0);
-  const utilidadTotal = baseGravable - costoTotal;
+  // MANIOBRAS Y FLETE NO SON UTILIDAD. Son cuadrilla, elevador, acarreo y camión:
+  // se cobran al cliente y se pagan igual. Meterlos en la utilidad sin un costo
+  // enfrente regala 13% de margen de mentira en cada proyecto.
+  // Hasta que Logística dé el costo real, se supone que se cobran a costo (100%
+  // de recuperación) y quedan FUERA del cálculo de utilidad.
+  const costoManiobrasFlete = maniobras + flete;
+  const utilidadTotal = baseGravable - costoTotal - costoManiobrasFlete;
```

Y enseñar los dos renglones en la tabla de utilidad con la leyenda "se cobra a costo".

---

## 5 · App no hereda la escalera: 20 de 24 configs entre 1.47× y 1.85× de App LT · debía ser 1.10×

**Reproduce:** `node scratchpad/aud2/a2_app.mjs`

Regla de Rodrigo, codificada en `HEREDA = { app: { de: 'applt', factor: 1.10 } }`. Se cumple
sólo cuando App LT tiene una fila de price-book. Cuando App LT cae a la **escalera por
usuario**, App no hereda nada y se va al modelo por su cuenta:

```
largo  u   AppLT      App      App/AppLT  (debería ser 1.10)
1200  2     $6,276    $11,613   1.850  ✗
1200  4    $12,552    $19,882   1.584  ✗
1200  6    $17,600    $19,360   1.100        ← aquí App LT sí tiene papel
1500  6    $19,710    $32,868   1.668  ✗
1800 12    $39,931    $68,259   1.709  ✗
```

Causa exacta, `src/datos/lineas.js:226`:
`const porUsuario = !real && ruta === 'applt' ? precioPorUsuarioAppLT(config) : null;`

**Cuánto dinero:** App sobrecotiza hasta **68%**. Contra el papel de 226020037 sale al revés
(−41% a −48%), porque ese proyecto es de módulo 1.48 de fondo y ahí manda el modelo crudo.
Es decir: App está descalibrada en las dos direcciones al mismo tiempo.

**Parche propuesto (SIN APLICAR)** — `src/datos/lineas.js`:

```diff
-  const porUsuario = !real && ruta === 'applt' ? precioPorUsuarioAppLT(config) : null;
+  // La escalera por usuario es la construcción de App LT, y App es la MISMA
+  // construcción con acabados premium (por eso HEREDA existe). Amarrarla a
+  // ruta==='applt' hacía que App heredara el 1.10 sólo cuando App LT tenía fila
+  // de papel, y en las otras 20 de 24 configs se fuera al modelo: 1.47× a 1.85×.
+  const her = HERENCIA_ESCALERA[ruta];   // { applt: 1, app: 1.10 }
+  const porUsuario = !real && her ? escalar(precioPorUsuarioAppLT(config), her) : null;
```
(`escalar` multiplica `lista` y `porUsuario` por el factor; `HERENCIA_ESCALERA` se exporta
desde `preciosVenta.js` junto a `HEREDA` para que el 1.10 viva en un solo lugar.)

---

## 6 · gastos de operación = 0 en 22 de 24 líneas · −$68K a −$116K en el proyecto tipo

**Reproduce:** `node scratchpad/aud2/a2_dinero.mjs`
**ABIERTO POR DECISIÓN DE RODRIGO — no se toca, sólo se reporta con número.**

Sólo `applt` y `app` declaran `modeloCosteo: 'intelisis'` con `gastosOperacionPct: 30`.
Las otras 22 líneas corren el modelo clásico, donde `gastosOperacion = 0` literal
(`src/motor/calculo.js:391`).

Sobre el proyecto tipo:

```
gastosOperacion  0% (hoy):  utilidad $423,116   margen 65.0%
gastosOperacion 30%:        utilidad $354,658   margen 54.5%   (Δ −$68,459)
gastosOperacion 51% (fin.): utilidad $306,737   margen 47.1%   (Δ −$116,380)
```

Sumado al punto 4 (maniobras y flete fuera de la utilidad), el margen real del proyecto tipo
cae de **65.0% a 35.7%**.

---

## 7 · El costo del banco de precios es una identidad, no un costo · 72.2% de margen en sillas de reventa

**Reproduce:** `src/App.jsx:517-527`

```js
const costoDeBanco = (item) => {
  const precio2 = esSilleria ? p : p / 0.60;
  return Math.round(costoImplicito(precio2));   // = precio2 / 3.6
};
```

- Mueble: `costo = p / 0.60 / 3.6 = p / 2.16` → margen ≡ **53.70%**
- Sillería: `costo = p / 3.6` → margen ≡ **72.22%**

Las 221 piezas del banco reportan uno de esos dos números **sin importar qué sean**. Y las 53
de sillería son **compra-reventa** (levantamiento Miguel/Rogelio: "comprado-revendido con
utilidad menor"). Un 72% de margen en una silla comprada es imposible.

**Cuánto dinero:** en el proyecto tipo, 40 sillas de $5,219. La app les asigna $1,450 de costo.
A un 30% de utilidad de reventa el costo sería $3,653 → **$88,132 de costo escondido en un
solo proyecto**, y son sólo las sillas.

**Parche propuesto (SIN APLICAR)** — `src/App.jsx`:

```diff
 const costoDeBanco = (item) => {
   const p = Number(item?.precio) || 0;
   if (!p) return 0;
   const esSilleria = item?.categoria === 'Sillería';
-  const precio2 = esSilleria ? p : p / 0.60;
-  return Math.round(costoImplicito(precio2));
+  // ⚠️ ESTO NO ES UN COSTO MEDIDO, ES UNA IDENTIDAD: sale del precio, así que el
+  // margen que produce es SIEMPRE el mismo número (53.7% mueble, 72.2% sillería)
+  // y el semáforo nunca prende. Se conserva sólo para el mueble de línea, donde
+  // la cascada Intelisis lo respalda.
+  // La SILLERÍA es compra-reventa (levantamiento Miguel/Rogelio): su costo es lo
+  // que se le paga al proveedor, no una fracción del precio de venta. Mientras no
+  // esté cargado, se usa el % de reventa que Compras confirme y se MARCA como
+  // supuesto para que no se lea como un dato.
+  if (esSilleria) return { costo: Math.round(p * (1 - UTILIDAD_REVENTA)), supuesto: true };
+  return { costo: Math.round(costoImplicito(p / 0.60)), supuesto: false };
 };
```

**Falta el dato**: el `UTILIDAD_REVENTA` real. Compras lo tiene en las órdenes de compra de
sillería. Hasta que llegue, cualquier número es un supuesto y debe verse como tal en pantalla.

---

## 8 · Los recargos de App LT están en la unidad equivocada · +31% a +33% de sobreprecio

**Reproduce:** `node scratchpad/aud2/a2_extras.mjs`

`APPLT_POR_USUARIO` guarda **precio de LISTA** ("$3,138 de lista por usuario"). Los recargos
están escritos en **precio 2** y se le suman directo:

```js
const EXTRA_LATERALES = 5650;   // "precio 2, por el par"   ← el papel dice $3,390 de LISTA
const EXTRA_DIVISOR   = 5600;   // "precio 2, por divisor"  ← lista = $3,360
const base = porU * fl * n;     // precio de LISTA
return { lista: Math.round(base + extrasAppLT(cfg, n)) };   // lista + precio 2
```

El propio comentario del código lo dice: *"$25,980 con laterales − $22,590 sin ellos = **$3,390
de lista** por los DOS. En precio 2: 3,390 ÷ 0.60 = $5,650."* Y luego suma los $5,650.

```
banca_doble 1500 · 4 usuarios
  sin opciones      $14,058
  + laterales       $19,708   (Δ $5,650 — el papel dice $3,390: +67%)
  + divisores       $25,258   (Δ $11,200 — debería ser $6,720: +67%)

  6u:  app $47,760 · correcto $36,540 · de más $11,220 (30.7%)
  8u:  app $65,395 · correcto $49,695 · de más $15,700 (31.6%)
 10u:  app $82,415 · correcto $62,235 · de más $20,180 (32.4%)
 12u:  app $99,551 · correcto $74,891 · de más $24,660 (32.9%)
```

**Parche propuesto (SIN APLICAR)** — `src/datos/preciosVenta.js`:

```diff
-const EXTRA_LATERALES = 5650;        // precio 2, por el par
-const EXTRA_DIVISOR = 5600;          // precio 2, por divisor
+// ⚠️ ESTOS VAN EN PRECIO DE LISTA, no en precio 2. `APPLT_POR_USUARIO` guarda
+// precio de LISTA ($3,138/usuario), así que sumarle un precio 2 encima cobra la
+// opción 67% de más: una banca de 8 puestos con laterales y divisores salía en
+// $65,395 cuando el papel da $49,695.
+//   LATERALES: BMU 225080025, $25,980 − $22,590 = $3,390 de lista por el par.
+//   DIVISOR  : 226030018, "3U A" $26,760 vs "3U B" $37,960 = $11,200 de precio 2
+//              por los DOS divisores → $5,600 precio 2 c/u → $3,360 de lista.
+const EXTRA_LATERALES = 3390;        // precio de LISTA, por el par
+const EXTRA_DIVISOR = 3360;          // precio de LISTA, por divisor
```

---

## 9 · El sistema eléctrico cuesta $0 en App LT y App · ~$1,700 por puesto que no se cobra

**Reproduce:** `node scratchpad/aud2/a2_gratis.mjs`

```
applt.escritorio      check electrico  (queda en $5,551)
applt.escritorio_l    check electrico  (queda en $9,611)
applt.banca_sencilla  check electrico  (queda en $5,327)
applt.banca_doble     check electrico  (queda en $6,276)
applt.mesa_juntas     check electrico  (queda en $8,673)
app.*                 check electrico  (idem, 5 productos)
```

El presupuesto 226030018 imprime **SISTEMA ELECTRICO como renglón propio en cada área**:

| área | P.Unitario | neto |
|---|---|---|
| OPERATIVO 1U | $3,030 | $1,818 |
| OPERATIVO 2U | $4,230 | $3,469 |
| OPERATIVO 3U | $5,430 | $5,120 |

**Cuánto dinero:** ~$1,700 de lista por puesto. En el proyecto tipo de 40 puestos, **~$68,000
regalados**. (El eléctrico sí se descuenta distinto al mueble en el papel —18% y 5.7% en vez
de 40%— eso hay que confirmarlo con Ventas antes de sembrarlo.)

Además, **el material del biombo no mueve un peso en la escalera**: `biombo = pet | melamina |
cristal` dan el mismo precio, aunque el propio price-book pruebe que difieren
($22,590 melamina vs $23,000 cristal en el mismo módulo).

**En total: 133 de 764 opciones del catálogo (17.4%) no mueven el precio.** Por línea:
`eclipse:14 anteo:14 via:13 spine:11 applt:10 cirque:10 modulor:9 privacy4:9 accents:8 app:7`.

⚠️ **Descuento honesto:** de esas 133, unas 4 son falsos positivos legítimos — el barrido prueba
cada opción sobre la configuración base del producto, y en `applt.banca_doble` (2 usuarios) y
`applt.banca_sencilla` (1 usuario) el check `divisores` **debe** dar cero, porque `n−1 = 0`
divisores. Probado a 6 usuarios, `divisores` sí cobra. Los otros 129 son reales.

---

## 10 · Doble conteo: el veredicto

Se buscaron los cuatro sospechosos que pediste. Resultado:

| sospecha | veredicto |
|---|---|
| **El 40% aplicado dos veces** | ❌ No. `precioDeLista()` se llama una sola vez por camino (`lineas.js:227`, `CosteadorLinea.jsx:79`, `App.jsx:430`). El `descuentoPorcentaje` de proyecto es otra cosa y va aparte. **Limpio.** |
| **Factor de línea encima de un precio real** | ❌ No. `precio = real ? precioDeLista(real.lista) : precioModelo × factor` — el factor sólo entra por la rama del modelo. **Limpio.** |
| **Merma sobre merma** | ❌ No — y por la razón contraria: **la merma no se aplica ni una vez** (ver punto 12). En los 24 insumos `fraccion: true` sólo actúa `aprovechamientoCorte` (80%). |
| **La curva de Río cobrada dos veces** | ⚠️ **Parcialmente.** El `OBJETIVO_LINEA.rio` bajó a 1.07 y el factor de familia quedó en ~1.00, así que la curva ya no se cobra por factor. **Pero** el despiece la cobra por tres vías a la vez —caja envolvente del tablero, arco del canto, insumo `curvado`— y el resultado no es estable. |

**Río, medido** (`node scratchpad/aud2/a2_rio.mjs`):

```
u  largo   recto_doble  curvo_doble  curvo/recto   AppLT     rio/applt  (obj 1.07 · papel 1.59)
 2 1200      $8,561      $10,426      1.22×        $6,276     1.66×
 4 1500     $22,181      $28,892      1.30×       $14,058     2.06×
 8 1200     $26,829      $37,230      1.39×       $23,340     1.60× PAPEL
12 1200     $35,982      $42,257      1.17×       $33,840     1.25×
```

Dos cosas: (a) el sobreprecio por ser curvo oscila entre **1.17× y 1.39×** para la misma
diferencia geométrica —eso es ruido, no un modelo—; y (b) **`OBJETIVO_LINEA.rio = 1.07`
contradice al único papel que tiene Río**, que da 1.59×. El comentario del archivo lo dice
("la relación sale 1.59×, que es exactamente la que miden los presupuestos") y la constante
sigue en 1.07. La única razón por la que el guardián no lo ve es que mide `bench_recto_sencillo`
—un bench **recto**— para calibrar una línea que Rodrigo describe como curva.

**Parche propuesto (SIN APLICAR)** — `src/datos/factoresLinea.js`:

```diff
-  rio: 1.07,
+  // Río se calibra contra su ÚNICO papel (226060050: bench curvo doble 4800×1200
+  // 8u a $4,654/puesto contra $2,933 de App LT en geometría idéntica) = 1.59×.
+  // El 1.07 salía de medir `bench_recto_sencillo` — un bench RECTO — para
+  // calibrar la línea que Rodrigo describe como curva. La curva sigue pagándose
+  // en el despiece; lo que cambia es contra qué se mide la familia.
+  rio: 1.59,
```
⚠️ Este parche **necesita que el punto 1 esté aplicado primero**: si se sube el objetivo sin
arreglar la medición, el bench recto de Río se dispara 50%.

---

## 11 · La cantidad no mueve el costo unitario · la economía de lote no existe

**Reproduce:** `node scratchpad/aud2/a2_lote.mjs`

```
applt.banca_doble    PAPEL   1:$8,148  2:$8,148  ...  200:$8,148
modulor.archivero_h  PAPEL   1:$3,347  2:$3,347  ...  200:$3,347
modulor.librero      modelo  1:$601    2:$601    ...  200:$601
via.escritorio       modelo  1:$2,314  2:$2,314  ...  200:$2,314
applt.escritorio     modelo  1:$2,803  ...  50:$2,791  200:$2,791   (−0.4%)
cirque.escritorio    modelo  1:$6,381  ...  10:$5,850  200:$5,850   (−8.3%)
```

Con precio de papel es inevitable (el costo se deriva del precio). Con modelo, sólo Cirque
muestra economía de lote real. `sugerenciaLote()` existe en el motor y en la práctica no tiene
de dónde agarrarse. **Consecuencia comercial:** un pedido de 200 escritorios cuesta lo mismo
por pieza que uno de 1, y el vendedor no tiene con qué justificar un descuento por volumen.
Se arregla solo con el parche del punto 3 (costo del motor, no derivado del precio).

---

## 12 · `mermaCorte` no hace nada en los 24 insumos `fraccion: true` · 2.03% de costo

**CONFIRMADO.** `node scratchpad/aud2/a2_merma.mjs`

```
insumos con fraccion:true → 24  (16 tableros al 6%, 7 láminas al 8%, divisor-melamina 6%)
```

En `src/motor/calculo.js:237-250`, la rama de fracción calcula `hojas = neto / (areaFmt × aprov)`
y **nunca toca `factorMerma`**, que sí se calculó dos líneas arriba (`comprarInsumo:213`) y sólo
se usa en la rama que no aplica. Lo mismo en la función exportada `comprar()` (líneas 104-118).

```
822 configs. COSTO total hoy $4,532,004 · con mermaCorte aplicada $4,623,820
diferencia: $91,816  (2.03% del costo)
peor caso: modulor.cubierta {"tipo":"gaveta","finish":"lamina"} $71 → $76  (+8.0%)
```

**El juicio de oficio:** `aprovechamientoCorte = 80%` ya carga 25% de scrap sobre el neto. Sumarle
otro 6-8% de merma de corte **sería cobrar el desperdicio dos veces**. Así que hay dos salidas
legítimas y **una sola inaceptable, que es la de hoy**: un campo `mermaCorte` visible y editable
en la pantalla de Precios que no hace absolutamente nada. Quien lo mueva creerá que costeó algo.

**Parche propuesto (SIN APLICAR), opción A — decir la verdad** (`src/datos/insumos.js`):

```diff
 function tablero(o) {
-  return ins({ seccion: 'cubiertas', unidad: 'hoja', formato: TABLERO, fraccion: true, mermaCorte: 6, ...o });
+  // mermaCorte NO SE USA en los insumos `fraccion: true`: el motor cobra
+  // `neto / (formato × aprovechamiento)` y el 20% de aprovechamiento ya lleva
+  // dentro el desperdicio de corte. Dejarlo en 6% era un campo editable en la
+  // pantalla de Precios que no movía un peso — peor que no tenerlo.
+  return ins({ seccion: 'cubiertas', unidad: 'hoja', formato: TABLERO, fraccion: true, mermaCorte: 0, ...o });
 }
```

**Opción B — que sí opere**, si Producción confirma que la merma de sierra va aparte del
aprovechamiento (`src/motor/calculo.js:240`):

```diff
-    const hojas = neto / (areaFmt * aprov);        // fraccion de hoja (rendimiento)
+    const hojas = (neto * factorMerma) / (areaFmt * aprov);
```
Eso sube el costo del catálogo 2.03% y baja el margen reportado ~1 punto.

---

## 13 · Verificación del conteo de divisores contra el PDF · ✅ CORRECTO

Se extrajeron las imágenes de las páginas 10 y 11 de `226030018 12 mayo 2026.pdf`
(áreas "OPERATIVO 3U A" $26,760 y "3U B" $37,960; las descripciones de texto son **idénticas
palabra por palabra**, así que el render es la única evidencia).

- **3U A** (`op10_5_Image47.jpg`): 3 puestos en hilera, **sólo biombo de espalda**, sin nada
  entre puestos.
- **3U B** (`op11_5_Image50.jpg`): los mismos 3 puestos **más 2 mamparas perpendiculares**,
  una entre el puesto 1 y el 2, otra entre el 2 y el 3.

**2 divisores para 3 usuarios = n−1. El conteo del modelo es correcto**, y la fórmula de
`extrasAppLT` lo reproduce (`pares = usuarios` en sencilla → `5600 × (3−1) × 1 = $11,200` = la
diferencia exacta entre las dos áreas).

⚠️ **Una reserva honesta:** en el render de 3U B los biombos de espalda también se ven distintos
—más altos, translúcidos y con clips metálicos a la vista— aunque el texto diga "PANEL ACUSTICO
DE PET" en los dos. Es posible que parte de los $11,200 sea ese cambio de biombo y no el
divisor. El conteo (n−1) está probado; **la atribución del monto completo al divisor no lo está.**

---

## 14 · Unidades: barrido completo · ✅ LIMPIO

`node scratchpad/aud2/a2_unidades.mjs` recorre los 24 generadores, todos sus productos y todas
las variantes de cada eje, y compara **la unidad del insumo contra cómo lo consume el despiece**
(`largoMM+anchoMM` → m² · `cantidad` → unidad natural, con `formato.medida` en m² para tablero
y en **kg** para lámina).

**61 insumos usados · 0 errores de unidad.** Los 5 "mixtos" que salen (`espuma`,
`pintura-electrostatica`, `cristal-templado-12`, `ecocrom`, `piel-napa`) son legítimos: su
unidad ya es m² y da lo mismo declararla por medidas o por cantidad.

Verificación cruzada de magnitud (`a2_kg.mjs`): los 156 componentes de lámina se declaran en kg
coherentes con 7.16 kg/m² (cal.20). Los que arreglaste hoy quedaron bien:
`luna.escritorio` riel cal.14 = 20.05 kg, `via.biombo` lámina perforada = 1.232 kg = 0.172 m² × 7.16.

**No queda ningún error de la familia kg-contra-m².**

---

## 15 · Casos límite

**Reproduce:** `node scratchpad/aud2/a2_limites.mjs`

Ninguna entrada produce `NaN`, `Infinity` ni precio negativo por el camino normal. Lo que sí sale:

| caso | qué pasa | gravedad |
|---|---|---|
| `usuarios = 1000` por Voni | cotiza **$2,820,000** y una huella de **600 metros** de ancho | ⚠️ sin tope. Un dedo en el teclado ("1000" por "10") pasa sin aviso |
| `usuarios = 1` en `banca_doble` | cotiza $3,138 una banca **doble** de 1 usuario — geométricamente imposible | ⚠️ |
| `usuarios = 0 / −5 / NaN / "ocho"` | cae a 2 usuarios en silencio por `costearConfig` (por `costearItem` sí deja aviso) | menor |
| `largoMM = NaN / Infinity / "x"` | cae al **segundo** largo de la lista (1500), no al primero, y sin aviso | menor |
| `mermaProceso = 100%` | `costoUnitario = Infinity` — división entre cero en `calculo.js:396` | ⚠️ el parámetro es editable |
| `margenObjetivo ≥ 100%` | `precioDe` devuelve `Infinity` (ya está atajado); en 99.9% da $1,000,000 sobre $1,000 de costo | menor |
| `cantidad = 0 / −1 / NaN / Infinity` | todos se normalizan a 1 correctamente | ✅ |
| `piezasPorTablero(0, 0)` | devuelve **81,204** piezas por tablero | cosmético (la rama está muerta porque `0` es falsy) |

**Parche propuesto (SIN APLICAR)** — `src/motor/calculo.js`:

```diff
-  const merma = par.mermaProceso > 0 ? par.mermaProceso / 100 : 0;
+  // Se acota por debajo de 1: con mermaProceso = 100% el costo sale Infinity y
+  // la cotización entera se vuelve "$Infinity". Es un parámetro editable en
+  // pantalla, así que el 100% es alcanzable con dos clics.
+  const merma = par.mermaProceso > 0 ? Math.min(par.mermaProceso, 95) / 100 : 0;
```

Y un tope de puestos en `costearItem` (`src/datos/lineas.js`, después del bloque de escalado):

```diff
+  // Un bench de más de 40 puestos no existe: es un dedazo. Se cotiza el tope y
+  // se avisa, en vez de escupir $2.8 millones y una huella de 600 metros.
+  if (escalado && escalado.pedidos > 40) { ... avisos.push('Máximo 40 puestos por corrida...'); }
```

---

## 16 · Las dos colas del catálogo

**Reproduce:** `node scratchpad/aud2/a2_barrido.mjs` (822 configs) · `a2_guarda.mjs`

**Cola cara ($/m²)** — dominada por el defecto del punto 1:

```
alba.bench          doble 2u 1200      $170,301   1.44 m²   $118,265/m²   ✗✗✗
alba.bench          sencillo 2u        $111,474   1.44 m²    $77,413/m²   ✗✗
anteo.guarda        cajones walnut      $17,823   0.36 m²    $49,507/m²
eclipse.credenza    2100 walnut         $20,780   0.42 m²    $49,477/m²   ← huella mala (punto 17)
spine.configuracion lineal 4 ductos      $7,359   0.16 m²    $44,763/m²
```

**Cola barata ($/m²)**:

```
spine.cubierta      1500 HPELABS           $708   1.13 m²       $629/m²
modulor.cubierta    gaveta ecolegno        $146   0.22 m²       $668/m²
alba.mesa_juntas    1800 HPELABS         $3,223   2.16 m²     $1,492/m²   ← con AJUSTE 0.39
via.librero         300 sin acometida       $446   0.27 m²     $1,625/m²
```

**"¿Hay un archivero más caro que un escritorio?"** — Se revisó línea por línea:

```
LÍNEA        escritorio(máx)      guarda(máx)         ¿guarda > escritorio?
via              $6,843            $3,415
cirque          $21,777           $20,489                       (0.94× — apretado)
eclipse         $27,410           $25,366                       (0.93× — apretado)
luna            $26,262            $9,195
anteo           $65,739           $17,823
modulor          $5,280            $9,460             ✗ SÍ (1.79×)
```

Sólo Modulor lo rompe, y es un falso positivo: Modulor **no tiene escritorio** (su "escritorio"
más caro es una maceta). **El orden guarda/escritorio se sostiene en las demás.**

⚠️ **Pero hay un agujero estructural:** la columna `guarda` de `MEDIDO_ANTES` está **vacía en las
24 líneas**. `calibra-jerarquia.mjs` la mide contra App LT, y **App LT no tiene ningún producto
de familia `guarda`** → `base.guarda = null` → ninguna línea se calibra. Todas las credenzas,
archiveros, libreros y pedestales del catálogo caen al **promedio de las otras familias de su
línea** (`factorFamilia`, línea 176). Para Cirque eso es `avg(0.385, 0.512, 0.583) = 0.493` →
factor 4.66, rescatado a mano con `AJUSTE_PRODUCTO['cirque.credenza'] = 0.31`. Es decir: la
familia guarda no está calibrada, está parchada caso por caso.

**Parche propuesto (SIN APLICAR)** — `scripts/calibra-jerarquia.mjs`:

```diff
 const base = {};
-for (const f of FAMILIAS) base[f] = medir('applt', f);
+for (const f of FAMILIAS) base[f] = medir('applt', f);
+// App LT no tiene guardas, así que `base.guarda` sale null y NINGUNA línea se
+// calibra en esa familia: las 24 caen al promedio de sus otras familias, y las
+// credenzas se acaban parchando a mano con AJUSTE_PRODUCTO. La base de `guarda`
+// se toma de MODULOR, que sí tiene guardas y además tiene 4 anclas de papel.
+if (!base.guarda) base.guarda = medirBase('modulor', 'guarda', { conPapel: true });
```

---

## 17 · La huella se sigue tomando de una "tapa" en 5 productos

**Reproduce:** `node scratchpad/aud2/a2_tapa.mjs`

El arreglo de hoy (tomar la de más área y anteponer "cubierta" a "tapa") resolvió el caso donde
**existen las dos**. Cuando el despiece **no nombra ninguna cubierta**, la `tapa` sigue ganándole
al paso 2 (la pieza más grande con fondo creíble):

```
spine.ducto           huella por TAPA 1200×137   · debería ser ~1200×380  (2.8× de área)
spine.configuracion   huella por TAPA 1200×137   · debería ser ~1200×380  (2.8×)
eclipse.credenza      huella por TAPA 2100×200   · debería ser ~2100×600  (3.0×)   "Tapa de registro"
mox.rodante           huella por TAPA  380×460   · debería ser ~580×460   (1.5×)
mox.pedestal          huella por TAPA  380×456   · debería ser ~720×456   (1.9×)
```

Una credenza Eclipse de 2.10 × 0.60 se dibuja de **20 cm de fondo**: el acomodo la mete en
cualquier rendija y el $/m² del catálogo la reporta a $49,477 cuando en realidad son $16,492.

**Parche propuesto (SIN APLICAR)** — `src/datos/lineas.js:161`:

```diff
-  const cubierta = mayorPor(/cubierta|cubiert|superficie/i) || mayorPor(/tapa/i);
+  // Una "tapa" sólo vale como huella si de verdad parece la cubierta del mueble.
+  // Si no hay cubierta nombrada, "Tapa de registro" (2100×200) le gana al paso 2
+  // y la credenza Eclipse queda de 20 cm de fondo. Se acepta la tapa sólo cuando
+  // su área es comparable a la mayor pieza con fondo creíble.
+  const mayorCreible = (componentes || [])
+    .filter((c) => c.largoMM && c.anchoMM && Math.min(c.largoMM, c.anchoMM) <= FONDO_MAX)
+    .sort((a, b) => b.largoMM * b.anchoMM - a.largoMM * a.anchoMM)[0];
+  const tapa = mayorPor(/tapa/i);
+  const tapaVale = tapa && mayorCreible &&
+    (tapa.largoMM * tapa.anchoMM) >= 0.7 * (mayorCreible.largoMM * mayorCreible.anchoMM);
+  const cubierta = mayorPor(/cubierta|cubiert|superficie/i) || (tapaVale ? tapa : null);
```

**Bonus del mismo barrido:** `costearConfig` **no tiene** el respaldo `HUELLA[tipoDe(...)]` que sí
tiene `costearItem` (`lineas.js:287-290`). Al **editar** una partida, un sofá Tetris, un
portamonitor Accents o un soporte TeamSpace II pasan a **0 × 0 mm** y desaparecen del plano.
Son 20 configuraciones de 822. El parche es copiar esas cuatro líneas a `costearConfig`.

---

## 18 · Materia prima sin fuente · ABIERTO POR DECISIÓN DE RODRIGO

```
$ node scripts/revisa-precios.mjs
Revisados 46 materiales de 103 contra su rango de mercado.
✓ ningún precio fuera de su rango: no se ve ningún error de unidad.
83 de 103 materiales no dicen DE DÓNDE salió su precio.
```

El ERP está en `mp_erp_ultima_compra.csv` (11,101 artículos con costo real) y el buscador es
`node scripts/busca-mp.mjs <término>`. **No se tocó.** Se reporta con número, como pediste.

Los de mayor peso en el costeo, por número de usos en el barrido, todos sin fuente:
`melamina-28` (192 usos), `pata-metalica` (53), `tornilleria` (45), `nivelador` (66 — sí tiene
fuente), `membrana-pvc` (59), `laminado` (40), `acrilico` (39).

---

# TABLA DE CONFIANZA · 24 LÍNEAS · AL 2026-08-16

Nivel: 🟢 se puede cotizar · 🟡 sirve de orientación, avisar que es estimado · 🔴 no cotizar sin revisar

| # | línea | prod | cfgs | anclas papel | objetivo | familias medidas | % opciones gratis | rango $ | nivel | **qué le falta** |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **App LT** | 6 | 43 | **18** | 1.00 (base) | bench·escrit·juntas | 64% | $5.3K–$33.8K | 🟡 | El módulo **1.50 y 1.80 va 33–46% abajo** del papel (punto 2). Eléctrico en $0. Recargos en unidad equivocada (+67%). Sin ancla de guarda. **Es la mejor línea que hay y aun así no se puede cotizar sola en 1.50.** |
| 2 | **App** | 6 | 49 | 0 | 1.10 | bench·escrit·juntas | 41% | $5.2K–$40.7K | 🔴 | La herencia 1.10 falla en **20 de 24 configs** (1.47×–1.85×, punto 5). Contra el papel de 226020037 va −41% a −48%. Descalibrada en las dos direcciones. |
| 3 | **Vía** | 6 | 43 | 0 | 1.09 | bench·escrit | 27% | $287–$6.8K | 🟡 | Cero anclas. `lado`, `perf` y `cableada` no mueven un peso (13 opciones). El bench crudo medía 2.637× App LT: es la corrección más grande que carga cualquier línea. |
| 4 | **Río** | 6 | 70 | **1** | 1.07 ⚠️ | sólo bench | 4% | $5.2K–$33.3K | 🟡 | **El objetivo 1.07 contradice su único papel (1.59×)**, punto 10. El sobreprecio curvo/recto oscila 1.17×–1.39×. El insumo `curvado` ($80/m) está calibrado, no medido: falta una orden de producción de Río con tiempos por centro. |
| 5 | **Feather** | 3 | 23 | 0 | 1.04 | bench·escrit | 11% | $4.6K–$25.7K | 🟡 | Cero anclas. `electrico` y `lado=izq` en $0. La más cercana a su objetivo de todas las no ancladas. |
| 6 | **Cirque** | 7 | 62 | 0 | 2.30 | bench·escrit·juntas | 16% | $7.0K–$52.7K | 🔴 | Estación a **3.58× su objetivo** ($34,015). Su guarda vive de `AJUSTE_PRODUCTO 0.31` puesto a mano. `semimat` (satinado/serigrafía/tela) en $0. |
| 7 | **Spine** | 4 | 34 | 0 | — | sólo escrit | 31% | $570–$7.4K | 🔴 | Sin objetivo comercial. Huella tomada de una tapa (1200×137). $44,763/m² en la configuración lineal de 4 ductos — es la 5ª más cara del catálogo por m². |
| 8 | **Ergonova 4** | 4 | 63 | 0 | — | bench·escrit | 0% | $9.7K–$25.3K | 🟡 | Sin objetivo: el modelo crudo la pone en 1.63× (bench) y **2.80× (escritorio)** App LT y nadie ha dicho si está bien. Única línea con 0% de opciones gratis. |
| 9 | **Alba** | 7 | 56 | 0 | 1.55 | bench·escrit·juntas | 9% | $3.2K–**$170.3K** | 🔴🔴 | **El peor del catálogo.** Factor ×7.209 despejado sobre una variante que no escala con usuarios (punto 1). Banca doble de 6 puestos = $442,459. Mesa de juntas rescatada con `AJUSTE 0.39`, teamspace con `0.55`. **No cotizar Alba hoy.** |
| 10 | **Eclipse** | 11 | 47 | 0 | — | escrit·juntas | 45% | $3.8K–$27.4K | 🔴 | Sin objetivo; el modelo crudo la pone en **4.43× App LT** en escritorio. Credenza con huella de 20 cm de fondo. 14 opciones en $0 — la peor del catálogo junto con Anteo. |
| 11 | **Eclipse Drift** | 5 | 25 | 0 | — | sólo escrit | 7% | $1.2K–$16.3K | 🟡 | Sin objetivo (1.06× crudo, creíble). Sin anclas. Sin familia guarda medida. |
| 12 | **Luna** | 4 | 17 | 0 | 2.80 | escrit·juntas | 6% | $8.5K–$26.3K | 🟡 | Cero anclas para el objetivo más alto del catálogo. Su credenza sale de un promedio de familias, no de una medición. El inox (21–41 kg por pieza) es el insumo más caro y no tiene fuente. |
| 13 | **Flex** | 4 | 21 | 0 | 1.07 | bench·escrit | 22% | $920–$16.4K | 🟡 | Era el caso que motivó el cambio de hoy (bench a 3.39×) y **quedó arreglado en el bench**; ahora el que se sale es el **biombo (0.15× del objetivo)** y el faldón (0.21×). |
| 14 | **Anteo** | 6 | 51 | 0 | — | escrit·juntas | 29% | $2.3K–**$65.7K** | 🔴 | Sin objetivo; el modelo crudo la pone en **10.81× App LT**. Vive de un `factorPrecio` a mano en el escritorio. El mármol ($2,000–$2,800/m²) y el inox no tienen fuente, y la base de la mesa de apoyo pesa **0.57 kg de acero** — no es creíble. |
| 15 | **Mox** | 2 | 6 | **1** | — | ninguna | 29% | $2.5K–$3.2K | 🟢 | La gaveta rodante está clavada al papel ($5,350 de 226030018, repetida 15 veces). Falta el pedestal, cuya huella sale de una tapa. **La más confiable del catálogo, y sólo tiene 2 productos.** |
| 16 | **Modulor** | 12 | 73 | **4** | — | sólo escrit | 12% | $142–$9.5K | 🟢 | 4 anclas de papel, MAE mediano **18%** — el mejor de las líneas con papel después de App LT. Falta: sus guardas no están en la familia `guarda` de la calibración (son la base natural para arreglarla, punto 16). |
| 17 | **Tetris** | 1 | 5 | 0 | — | sólo escrit | 0% | $3.9K–$8.3K | 🟡 | Un solo producto. **Huella 0 × 0 al editar** (punto 17). El sofá carga 16–28 kg de base metálica y `piel-napa` sin fuente. |
| 18 | **Arlequín** | 1 | 6 | 0 | — | sólo escrit | 17% | $1.2K–$2.4K | 🟡 | Un producto, sin anclas, sin objetivo. Modelo crudo 0.226× App LT — el más barato del catálogo, plausible para un pouf. |
| 19 | **Pac** | 1 | 6 | 0 | — | sólo escrit | 0% | $4.5K–$13.3K | 🟡 | Un producto. La huella la lee del **nombre** ("0.60×0.60 m"), no del despiece: si alguien cambia el texto del nombre, se rompe el plano. |
| 20 | **Work Lounge** | 4 | 21 | 0 | — | sólo escrit | 17% | $1.2K–$12.1K | 🟡 | Sin anclas ni objetivo. `tank` y `bricks` cargan 1.45–1.50 kg de placa metálica para un taburete — revisar contra la guía. |
| 21 | **Pebble** | 1 | 14 | 0 | — | sólo escrit | 15% | $1.4K–$3.8K | 🟡 | Un producto. Modelo crudo 0.331×. Sin anclas. |
| 22 | **Accents** | 14 | 49 | 0 | — | bench·escrit | 23% | **$109**–$10.8K | 🔴 | 14 productos, ninguno con ancla. Modelo crudo **0.111× App LT** en escritorio: es el número más bajo de la tabla y significa que Accents cotiza casi 10 veces menos que su comparable. `portamonitor` con huella 0×0. Muchos son **comprados** y deberían ir al banco, no al generador. |
| 23 | **TeamSpace II** | 1 | 3 | 0 | — | sólo escrit | 33% | $3.1K–$5.8K | 🔴 | Un producto, 3 configuraciones, **huella 0 × 0**. El soporte carga 18–32 kg de lámina. Sin anclas, sin objetivo. |
| 24 | **Privacy 4** | 2 | 35 | 0 | — | sólo escrit | 24% | $6.1K–$13.1K | 🟡 | Sistema de muros: la familia `escritorio` no le queda (no es un escritorio, es un lambrín). Necesita su propia familia en `familiaDe`. Sin anclas. |

**Recuento:** 🟢 2 · 🟡 13 · 🔴 9 (uno de ellos, Alba, en rojo doble).

---

# LO QUE HAY QUE DECIDIR, EN ORDEN

1. **Alba y Eclipse fuera de la cotización hasta que se arregle el punto 1.** Una banca de
   $170,301 en una propuesta cuesta más que el proyecto.
2. **El guardián tiene que medir algo distinto de lo que calibró** (punto 1). Hoy no protege nada.
3. **Rodrigo: ¿cuánto del 1.93× del módulo de 1.50 es longitud y cuánto es especificación?**
   De eso depende si el parche del punto 2 es 1.93 o 1.45 + un cargo de spec.
4. **Rodrigo: ¿el margen que quiere ver es el derivado (constante) o el medido (feo)?**
   El punto 3 no se puede aplicar sin esa decisión, y sin él el semáforo seguirá apagado.
5. **Compras: ¿cuál es la utilidad real de reventa en sillería?** Sin ese número, 53 piezas del
   banco reportan 72.2% de margen.
6. **Producción: ¿la merma de sierra va aparte del aprovechamiento, sí o no?** (punto 12).
7. **Logística: flete 3% o 10%.** Sigue sin cerrar, y ahora además se está contando como utilidad.
