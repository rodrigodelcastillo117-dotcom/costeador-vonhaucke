# AUDITORÍA DE VONI — 2026-08-16

**Qué se hizo.** 24 corridas reales contra la edge function `cotizar-texto` EN VIVO
(build desplegado v3, `claude-opus-5`), costeando cada salida con el motor real
(`costearItem` + insumos semilla + parámetros default) y comparando renglón por
renglón contra las 24 anclas del price-book y las 218 piezas del Banco.
Más: 1 corrida de `leer-plano` contra `Plano_Organico_Con_Medidas.pdf`,
un barrido de 562 opciones del catálogo, y el mapeo completo de la tabla `reglas`.

**Nada se desplegó. Nada de `src/` ni `supabase/` se tocó.**

Archivos de evidencia (todos en `scratchpad/`):
`aud_voni.mjs` · `aud_pedidos.json` · `aud_log_P.txt` · `aud_log_T.txt` ·
`aud_log_R.txt` · `aud_precios.mjs` · `aud_gratis.mjs` · `aud_escala.mjs` ·
`aud_biombo.mjs` · `aud_plano.mjs` · `aud_plano_out.json`

---

## LO PRIMERO, PORQUE ES LO MÁS IMPORTANTE: **Voni NO inventa productos**

En 24 corridas —incluidas las tramposas— **cero** productos inventados.
Cero `ruta`/`producto` inexistentes. Cero ids de Banco inexistentes.
Cero renglones que el motor no pudiera costear.

```
=== items no costeables / ids inexistentes en TODAS las corridas ===
(vacío = ninguno)
```

Y cuando le pedimos una línea que no existe, hace exactamente lo correcto:

> **Pedido:** `quiero 10 escritorios de la linea Titanium y 4 credenzas Titanium`
> **Voni:** *(0 renglones)* — `noEncontrado: ["Línea 'Titanium' (escritorios) — no existe
> en el catálogo Von Haucke", "Línea 'Titanium' (credenzas) — no existe..."]`
> `preguntas: ["¿La línea 'Titanium' es de otro proveedor o se refiere a alguna de
> nuestras líneas? Para escritorios ejecutivos con credenza tenemos Eclipse, Eclipse
> Drift, Luna o Anteo; para operativo Cirque, Río o App LT."]`

Eso está bien resuelto y no hay que tocarlo. El `json_schema` + la regla 1 del
prompt están haciendo su trabajo.

**El problema no es que Voni invente muebles. Es que arma CONFIGURACIONES que
nunca se cotizaron en papel, y el motor se las cuesta sin decir nada.**
Todo lo grave de abajo cuelga de ahí.

---

# HALLAZGOS, DE MÁS A MENOS GRAVE

---

## 🔴 1. El mismo pedido, cinco veces, da de $88,980 a $209,280 (2.35×)

**Qué está mal.** Voni no es reproducible: dos vendedores que escriben lo mismo
le entregan al mismo cliente precios que difieren 2.4 veces.

**Pedido exacto** (corrido 5 veces, textual e idéntico):
```
20 lugares de trabajo en bench App LT de 1.20
```

**Qué contestó Voni** (los 5 resultados, `aud_log_T.txt` T9 · `aud_log_R.txt` R1a/b/c):

| corrida | el bench | la sillería | gavetas | **TOTAL** |
|---|---|---|---|---|
| 1 | 2 × 10u c/`divisores` $57,080 | 20 × C4-EL-BNF $2,405 = $48,100 | 20 × MOX $3,470 = $69,400 | **$174,580** |
| 2 (T9) | 2 × 10u $57,080 | 20 × C4-EM-BNF $1,595 = $31,900 | — | **$88,980** |
| 3 (R1a) | 2 × 10u $57,080 | 20 × GAMMA-E $4,140 = $82,800 | 20 × MOX $3,470 = $69,400 | **$209,280** |
| 4 (R1b) | **5 × 4u $62,760** | 20 × GAMMA-E $4,140 = $82,800 | — | **$145,560** |
| 5 (R1c) | 2 × 10u $57,080 | 20 × C4-EL-BNF $2,405 = $48,100 | — | **$105,180** |

Tres ejes de ruido a la vez:
1. **La silla operativa cambia de $1,595 a $4,140 (2.6×)** sin que el pedido diga nada.
2. **La gaveta aparece o no aparece.** Nadie la pidió. Cuando aparece son $69,400.
3. **El bench mismo se arma de 2×10 o de 5×4** — mismos 20 puestos, $57,080 vs $62,760 (10%).

Con un pedido largo y específico el ruido baja mucho (call center de 60: $560,211 /
$547,612 / $551,412 / $552,956 = ±1.2%). **Lo que explota el precio es la vaguedad,
y la app no distingue un pedido vago de uno firme.**

**Qué debió contestar.** Con un pedido de una línea, o pregunta antes de costear, o
fija por regla qué silla es la de default. Hoy hace las dos cosas mal: adivina, y
adivina distinto cada vez.

**Cuánto dinero mueve.** El rango completo del renglón, $120,300 sobre un pedido
de 20 puestos. En un proyecto de 200 puestos, ~$1.2 M.

**Arreglo propuesto (NO aplicado).**
En `supabase/functions/cotizar-texto/index.ts`, dentro de `apiBody`:

```ts
const apiBody = {
  model: "claude-opus-5",
  max_tokens: 8000,
  temperature: 0,                       // <-- AÑADIR
  output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
  ...
```

`temperature: 0` no lo vuelve determinista al 100%, pero quita la mayor parte del
ruido. Lo que de verdad cierra el hueco es la regla de default (hallazgo 5) y
quitar los duplicados del Banco (hallazgo 4).

---

## 🔴 2. Voni enciende opciones que el motor cobra a $0 — mobiliario regalado

**Qué está mal.** 104 de las 562 opciones del catálogo **no mueven el precio ni un
peso**. Voni las enciende sola, con toda la buena intención, y la fábrica las
construye gratis.

Las peores son las de casilla, que son justo las que Voni prende por instinto
(`aud_gratis.mjs`):

```
applt/banca_doble      electrico       $26,145  -> +$0    Electrificación (aparte)
applt/banca_doble      divisores       $26,145  -> +$0    Divisores entre puestos
applt/banca_doble      laterales       $26,145  -> +$0    Biombos laterales
applt/escritorio       electrico        $6,529  -> +$0
applt/escritorio_l     electrico       $10,558  -> +$0
applt/banca_sencilla   electrico       $20,354  -> +$0
applt/mesa_juntas      electrico       $11,364  -> +$0
app/*  (6 productos)   electrico                -> +$0
eclipse/* (6 productos) electrico                -> +$0
rio/bench_*            puerta / acometida        -> +$0
feather/bench_*        electrico                 -> +$0
cirque/recepcion       gajoAcrilico    $15,922  -> +$0
mox/rodante            cerradura, lapicera       -> +$0
modulor/archivero_h    cerradura, cojin          -> +$0
```

**Pedido exacto que lo dispara** (P8, `aud_log_P.txt`):
```
Agencia de publicidad, 35 personas en planta abierta con bench de 1.50 de 6 usuarios,
5 privados, 2 salas de junta para 6, cafetería con 4 mesas altas y 12 bancos,
y 20 gavetas rodantes.
```

**Qué contestó Voni:**
```
6 x $19,710 = $118,260  applt/banca_doble
    sel: largoMM=1500 usuarios=6 biombo=melamina electrico=si divisores=si
    nota: "Supuse biombo melamina y electrificación"
5 x $10,965 =  $54,823  applt/escritorio_l
    sel: largoMM=1800 fondoMM=750 largoLateralMM=1050 electrico=si
```

Los `electrico=si` y los `divisores=si` costaron **$0**. Y no es que no valgan nada
—el papel lo prueba:

* **Divisores**, ancla real `banca_sencilla 1200 3u`: sin divisores $16,056, con
  divisores $22,776 → **+$2,240 por puesto (+42%)**. En `banca_doble` el mismo
  check vale $0.
* **Electrificación**: el Banco la vende como partida propia — *"Electrificación
  de bench dobles"* a **$12,238 / $24,579 / $27,006 / $51,585**. En la casilla vale $0.

**Cuánto dinero mueve** (usando siempre el piso, no el techo):

| pedido | qué se regaló | mínimo no cobrado |
|---|---|---|
| P8 agencia | 36 puestos de divisores + electrificación de 6 benches | **$80,640 + $73,428 = $154,068** |
| P2 call center | 60 puestos de divisores | **$134,400** |
| P4 coworking | 40 puestos divisores + electrif. de 5 benches | **$89,600 + $61,190 = $150,790** |

Sobre cotizaciones de $560K–$984K, es entre el 15% y el 27% del proyecto entregado
sin cobrar — con un margen mínimo dictado de 40%, se lo come entero.

**Qué debió pasar.** Que encender `electrico` o `divisores` en `banca_doble` subiera
el precio como lo sube en `banca_sencilla`.

**Arreglo propuesto (NO aplicado).** El bug no está en Voni sino en la ruta de
precio: cuando la config cae en `precioPorUsuarioAppLT` (la escalera por usuario),
esa escalera sólo mira `usuarios` y `largoMM` — **ignora todos los checks**.
En `src/datos/preciosVenta.js`, `precioPorUsuarioAppLT(cfg)`:

```js
// HOY (línea ~201): el precio por usuario ignora divisores/electrico/laterales
export function precioPorUsuarioAppLT(cfg) {
  if (!cfg || cfg.producto !== 'banca_doble') return null;
  const n = cfg.usuarios;
  ...
  const fl = FACTOR_LARGO[cfg.largoMM] ?? 1;
  return { lista: Math.round(porU * fl * n), porUsuario: Math.round(porU * fl), derivado: fl !== 1 };
}

// PROPUESTA: add-ons medidos del propio papel, aplicados sobre la escalera.
// divisores: 22776/16056 = +41.9% sobre banca_sencilla 1200 3u (226030018)
// laterales: 25980/22590 = +15.0% sobre banca_doble 1500 4u (225080025)
const ADDON_APPLT = { divisores: 0.419, laterales: 0.150 };
export function precioPorUsuarioAppLT(cfg) {
  ...
  let mult = 1;
  for (const [k, f] of Object.entries(ADDON_APPLT)) if (cfg[k]) mult += f;
  return {
    lista: Math.round(porU * fl * n * mult),
    porUsuario: Math.round(porU * fl * mult),
    derivado: fl !== 1 || mult !== 1,
  };
}
```

Y `electrico` NO debe ser una casilla gratis: el Banco ya lo tiene con precio real.
Lo más simple y más honesto es **quitar el check `electrico` de los productos de
banca en el catálogo que ve Voni** y hacer que lo pida como pieza de Banco
(`p9-bench-doble-12238` etc.), que es como se cotiza en los presupuestos de verdad.
Eso es una línea en `catalogoIA()` + la regla nueva del hallazgo 5.

---

## 🔴 3. Si Voni no nombra el biombo, el precio se cae 38–61% y el ancla se salta

**Qué está mal.** Las anclas del price-book están indexadas por `biombo`. Cuando
Voni omite ese dato —cosa que hace seguido, y lo declara— `buscarFila()` no
encuentra la fila, el motor se va al modelo clásico, y sale mucho más barato.
La cotización se ve igual de bien y pierde el sello FIRME sin que nadie lo note.

**Medición exacta** (`aud_biombo.mjs`):

```
applt/banca_doble  1500×1200  4 usuarios
   (sin decir biombo)   $14,058  modelo
   biombo=melamina      $22,590  FIRME     +61% vs no decirlo
   biombo=cristal       $23,000  FIRME     +64%

applt/banca_sencilla  1200×600  2 usuarios
   (sin decir biombo)   $10,034  modelo
   biombo=pet           $16,080  FIRME     +60%
```

**Pedido exacto que lo dispara:**
```
20 lugares de trabajo en bench App LT de 1.20
```
**Qué contestó Voni** (T9): `sel: largoMM=1200 usuarios=10` —
`nota: "Sin biombo ni electrificación por no especificarse..."`

Con `banca_doble` a 1.20 la escalera por usuario lo salva (0% de diferencia). Con
**1.50 y con toda la `banca_sencilla` no lo salva: −38% a −61%**.

**Qué debió contestar.** El biombo mueve el precio 60%: es exactamente el caso que
la regla 3 del prompt llama *"lo esencial que cambie el precio de forma importante"*.
Debió preguntarlo antes, no asumirlo.

**Cuánto dinero mueve.** Un bench App LT 1.50 de 4 puestos: $8,532 por módulo.
En un piso de 40 puestos (10 módulos): **$85,320**.

**Arreglo propuesto (NO aplicado).** Dos partes, las dos baratas.

(a) Que el catálogo le diga a Voni que ese dato no es opcional. En
`src/datos/lineas.js`, `catalogoIA()` (línea ~380):
```js
// HOY
if (p.biombo) params.biombo = [null, 'cristal', 'melamina'];
// PROPUESTA — se le quita el null y se le pone nombre a la consecuencia
if (p.biombo) {
  params.biombo = ['pet', 'cristal', 'melamina'];
  params.__obliga = (params.__obliga || []).concat('biombo');
}
```
más una línea en el `system` de `cotizar-texto`:
```
9) Las claves listadas en '__obliga' de un producto MUEVEN EL PRECIO hasta 60%.
   Si el usuario no las dice, pon el default de volumen (biombo 'pet') Y ADEMÁS
   ponlo en 'preguntas'. Nunca las omitas de 'seleccion'.
```

(b) Que la app avise cuando un renglón se cayó del papel por un dato faltante.
`costearItem` ya devuelve `precioReal:false`; hoy la pantalla no lo grita. Un aviso
en `CotizadorIA.jsx` del tipo *"Este precio salió del modelo, no de un presupuesto
firmado, porque no dijiste el biombo"* cierra el agujero sin tocar el motor.

---

## 🟠 4. El Banco tiene 38 muebles duplicados — la misma silla a dos precios

**Qué está mal.** El Banco de precios tiene el mismo mueble físico bajo varios ids
con precios distintos. Voni ve los dos, no tiene forma de saber cuál es el bueno,
y elige distinto cada vez. Es el motor del hallazgo 1.

```
Silla operativa · C4-EM-BNF     p9-...-1595 $1,595   |  p9-...-1850 $1,850      (+16%)
Silla operativa · C4-EL-BNF     p9-...-1950 $1,950   |  p9-...-2405 $2,405      (+23%)
Silla operativa · GAMMA-E       p9-...-3990 $3,990   |  p9-...-4140 $4,140  |  silla-gamma-e $4,140
Mox · Gaveta rodante            $3,160 | $3,210 | $3,220 | $3,470                (+10%)
Silla de visita · CONCURSO      p9-...-1111  |  p9-...-1111-149      (idéntica, 2 ids)
Silla · SONATA                  p9-...-2420  |  p9-...-2420-144      (idéntica, 2 ids)
Sillón $11,706                  p9-sillon-11706 | -178 | -179        (idéntica, 3 ids)
Silla operativa · WIN           p9-...-5210  |  silla-win            (idéntica, 2 ids)
                                        ... 38 nombres duplicados en total
```

**Se cachó en flagrante.** Corrida R2b del call center — Voni cotizó **la misma
silla CONCURSO como dos renglones distintos**, creyendo que eran dos productos:

```
8 x $1,111 = $8,888  [BANCO] p9-silla-de-visita-concurso-1111
6 x $1,111 = $6,666  [BANCO] p9-silla-de-visita-concurso-1111-149
```

**Cuánto dinero mueve.** En P2 (60 gavetas Mox), elegir `$3,160` o `$3,470` son
**$18,600** de diferencia en un solo renglón. En sillería de 60 posiciones, entre
la C4-EM de $1,595 y la GAMMA-E de $4,140 hay **$152,700**.

**Además, 10 ids mienten sobre su propio precio** (el número del id no coincide con
el campo `precio`), y Voni lee los dos:
```
p9-banco-re571c-2012                  id dice 2012 | precio real 3353
p9-silla-de-visita-esp-ohv-368-2532   id dice 2532 | precio real 4220
p9-silla-sonata-2420-144              id dice  144 | precio real 2420
arch-modulor-2p-750                   id dice  750 | precio real 6440   (750 es la MEDIDA)
```

**Arreglo propuesto (NO aplicado).** No hace falta tocar el Banco todavía —
basta con no enseñarle los duplicados a Voni. En `src/datos/lineas.js`,
`catalogoIA()` (línea ~394):

```js
// HOY
piezas: BANCO.map((b) => ({ id: b.id, nombre: b.nombre, categoria: b.categoria, precio: b.precio, ... })),

// PROPUESTA: un solo id por mueble. Si hay varios precios para el mismo nombre,
// se queda el MÁS RECIENTE (mismo criterio que ya usa el price-book con Modulor).
piezas: (() => {
  const norm = (s) => String(s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const vistos = new Map();
  for (const b of BANCO) {
    const k = norm(b.nombre) + '|' + (b.medidas || '');
    const p = vistos.get(k);
    if (!p || String(b.fecha || '') > String(p.fecha || '')) vistos.set(k, b);
  }
  return [...vistos.values()].map((b) => ({ id: b.id, nombre: b.nombre, categoria: b.categoria, precio: b.precio, ... }));
})(),
```

Ojo: **eso reduce el ruido pero no elige la silla**. Para eso hace falta el
hallazgo 5.

---

## 🟠 5. Voni cotiza muebles que nadie pidió, y no hay regla que le diga cuáles

**Qué está mal.** Voni completa el proyecto por su cuenta. A veces es lo correcto
(las sillas — la regla 26 se lo manda) y a veces es sobre-cotizar sin permiso.

**Pedido exacto:**
```
20 lugares de trabajo en bench App LT de 1.20
```
**Qué contestó Voni** (corrida 1): 20 gavetas rodantes MOX a $3,470 = **$69,400**,
con la nota *"Guarda personal estándar por usuario; se puede quitar si no la requieren."*
Sobre un total de $174,580, **el 40% de la cotización es mueble que el cliente
nunca mencionó**. En las corridas 2 y 5 del mismo pedido, no las puso.

Otros casos: P5 clínica → 2 mesas de centro Pebble *"complemento sugerido; se puede
eliminar"*. P4 coworking → 48 sillas para 40 lugares + 8 cabinas (las cabinas ya
son puestos, se duplican 8 sillas = $19,240).

**Qué debió contestar.** Distinguir lo que la regla manda (sillería) de lo que se
le ocurre (gavetas, mesas de centro), y mandar lo segundo a `preguntas`, no a
`items`. Hoy nada en el prompt hace esa distinción.

**Cuánto dinero mueve.** El renglón entero de gavetas, $69,400, aparece o no
aparece según el humor del modelo.

**Arreglo propuesto (NO aplicado).** Es una regla nueva en la tabla `reglas`
(ámbito `cotizacion`) — pero **hoy los textos de la tabla no llegan al modelo**
(hallazgo 7). Con el puente del hallazgo 7 puesto, la regla se dicta desde la
pantalla "Lo que Voni sabe" y ya:

> *"Sólo se cotiza lo que el cliente pidió, MÁS la sillería (que siempre va).
> Todo lo demás que se te ocurra (gavetas, mesas de centro, lockers) va en
> 'preguntas' como sugerencia, NO en 'items'. Cuando el cliente no dice el nivel
> de silla, se usa siempre la C4-EL-BNF; sólo se sube si el texto habla de
> dirección, consejo o acabado premium."*

Fijar la silla de default mata de un golpe el 60% de la varianza del hallazgo 1.

---

## 🟠 6. Voni cotizó 36 puestos cuando le pidieron 35 — viola una regla dictada

**Qué está mal.** La regla 24 de la tabla dice, textual:
*"Si piden mas puestos de los que arma un bench, se saca el precio POR PUESTO del
escalon que si existe y se multiplica por los que piden.* **Nunca se cotiza otra
cantidad distinta a la pedida.***"

**Pedido exacto** (P8):
```
Agencia de publicidad, 35 personas en planta abierta con bench de 1.50 de 6 usuarios, ...
```
**Qué contestó Voni:**
```
6 x $19,710 = $118,260  applt/banca_doble  ·  usuarios=6
    nota: "6 benches x 6 = 36 puestos para cubrir las 35 personas."
...
35 x $4,140 = $144,900  silla-gamma-e
```
**36 puestos y 35 sillas en la misma cotización.** Voni ni siquiera es consistente
consigo misma.

**Qué debió contestar.** 5 bancas de 6 + 1 de 5, o una corrida de 35 escalada por
puesto — el motor **ya sabe hacerlo**: `costearItem` tiene el bloque de escalado
(`lineas.js` ~257-275) que cotiza los puestos pedidos aunque el producto no los
tenga, y emite el aviso *"se cotizaron 35 a X pesos por puesto"*. Voni nunca lo usa
porque redondea antes.

**Cuánto dinero mueve.** ~$3,285 (1 puesto) en este pedido. El problema no es el
monto, es que se le está pidiendo al cliente pagar un puesto que no quiere, y que
la regla que lo prohíbe está escrita y no se aplica.

**Arreglo propuesto (NO aplicado).** Regla 24 al prompt (hallazgo 7). Refuerzo en
el `system` de `cotizar-texto`, después de la regla 4:

```
4b) NUNCA redondees la cantidad hacia arriba para que cuadre con un escalon del
    producto. Si piden 35 puestos, pon cantidad/usuarios que sumen 35 EXACTOS
    (el motor sabe cotizar puestos sueltos por precio unitario). Que el numero
    de sillas y el numero de puestos SIEMPRE coincida.
```

---

## 🟡 7. Las 24 reglas de la tabla `reglas` NO llegan a ningún modelo. Ninguna.

**Qué está mal.** `src/datos/reglas.js` exporta `reglasTexto(ambito)` —la función
que arma los textos para inyectarlos en un prompt— y **no la llama nadie**:

```
$ grep -rn "reglasTexto" src/
src/datos/reglas.js:46:export const reglasTexto = (ambito) => TEXTOS

$ grep -rn "reglas\|ambito" supabase/functions/
(sin resultados)
```

Las 7 edge functions no reciben ni leen la tabla `reglas`. `cotizarTexto()` en
`nube.js` manda `{ texto, catalogo }` y nada más. Las "reglas" que ve el modelo son
las 8 hardcodeadas en el `system` de `cotizar-texto`, que son una **copia a mano y
desactualizada** de tres filas de la tabla (25 jerarquía, 26 sillería, y algo de la 4).

Y del lado numérico, sólo 3 de 13 claves se leen de verdad:

```
circulacion_min          -> malla.js   ✅
holgura_juntas           -> malla.js   ✅
holgura_guarda           -> malla.js   ✅
pasillo_principal        -> (nadie)
barrido_puerta           -> (nadie)
escritorio_ve_a_puerta   -> (nadie)
l_contra_muro            -> (nadie)
gaveta_pegada            -> (nadie)
sillas_visita_privado    -> (nadie)
descuento_precio2        -> (nadie: preciosVenta.js tiene 0.40 hardcodeado)
margen_min               -> (nadie: calculo.js tiene margenMinimo:40 hardcodeado)
tipo_cambio              -> (nadie: calculo.js tiene tipoCambio:17.5 hardcodeado)
applt_por_usuario        -> (nadie: preciosVenta.js tiene la escalera hardcodeada)
```

**Consecuencia concreta y verificable:** si Rodrigo entra a "Lo que Voni sabe" y
cambia el dólar de 17.50 a 19.00, **no pasa absolutamente nada**. Ni un precio se
mueve. Lo mismo con el margen mínimo y con el −40%.

La tabla `reglas` es hoy un cuaderno de notas bonito. El comentario de cabecera del
propio archivo describe un sistema que no está conectado.

**Arreglo propuesto (NO aplicado).** Tres cambios chicos.

(a) Mandar las reglas al edge function. En `src/nube.js` (~línea 142):
```js
// HOY
export async function cotizarTexto(texto, catalogo) {
  const { data, error } = await nube.functions.invoke('cotizar-texto', {
    body: { texto, catalogo },
  });

// PROPUESTA
import { reglasTexto } from './datos/reglas.js';
export async function cotizarTexto(texto, catalogo) {
  const { data, error } = await nube.functions.invoke('cotizar-texto', {
    body: { texto, catalogo, reglas: reglasTexto('cotizacion') },
  });
```
(y lo mismo con `reglasTexto('acomodo')` en `acomodarEspacio`, `reglasTexto('plano')`
en `leerPlano`).

(b) Inyectarlas en el prompt. En `supabase/functions/cotizar-texto/index.ts`:
```ts
const { texto, catalogo, reglas } = body || {};
...
const system =
  "Eres el asistente experto de cotizacion de Von Haucke..." +
  ... +
  (Array.isArray(reglas) && reglas.length
    ? "\n\nREGLAS DE OFICIO DE VON HAUCKE (las dicta la direccion; MANDAN sobre " +
      "cualquier criterio tuyo):\n" + reglas.join("\n") + "\n"
    : "") +
  "\n\nCATALOGO (JSON: ...):\n" + JSON.stringify(catalogo);
```

(c) Que los números del motor salgan de la tabla. En `src/motor/calculo.js`,
`PARAMETROS_DEFAULT` deja de ser la fuente y pasa a ser sólo la red:
```js
import { regla } from '../datos/reglas.js';
// donde hoy dice   par.tipoCambio || PARAMETROS_DEFAULT.tipoCambio
// que diga         par.tipoCambio ?? regla('tipo_cambio')
```
y en `preciosVenta.js`, `DESCUENTO_PRECIO2` pasa de `const` a
`() => regla('descuento_precio2') / 100`.

**Sin (a) y (b), ninguna regla nueva que se dicte va a servir de nada** — y ése es
el cimiento de todos los arreglos de arriba.

---

## 🟡 8. Voni no aprende nada. Cero. Y no hay dónde guardarlo.

**Qué está mal.** La base tiene exactamente **4 tablas**:

```
config  ·  direccion  ·  permitidos  ·  reglas
```

No hay tabla de cotizaciones, ni de pedidos, ni de correcciones, ni de historial.
Cuando el usuario corrige a Voni, `CotizadorIA.jsx` (~línea 104) hace esto:

```js
async function responder() {
  const r = respuesta.trim();
  const nuevo = `${texto.trim()}\n\nAclaraciones: ${r}`;   // se pega al texto
  setTexto(nuevo);
  await interpretar(nuevo);                                 // se vuelve a llamar
}
```

La corrección vive en un `useState` y muere al recargar la pestaña. El único
camino de escritura a `reglas` es `guardarRegla()`, y su único llamador es
`Reglas.jsx` — o sea, **Rodrigo tecleando a mano**. Voni no escribe una sola fila
en su vida.

Peor: como las reglas tampoco se le inyectan (hallazgo 7), aunque Rodrigo teclee la
corrección a mano, **tampoco llega**. El circuito está cortado en los dos extremos.

**El mecanismo más simple que sí funciona (NO aplicado).** Migración de una tabla,
sin tocar el motor:

```sql
-- supabase: tabla nueva, sin RLS especial (misma politica que `reglas`)
create table correcciones (
  id          bigserial primary key,
  pedido      text not null,          -- lo que escribio el vendedor
  propuesta   jsonb not null,         -- lo que escupio Voni
  correccion  text not null,          -- lo que el vendedor le corrigio
  usuario     text,
  creada      timestamptz default now(),
  promovida   boolean default false   -- ya se convirtio en regla?
);
```

Se escribe en un solo lugar, en `responder()` de `CotizadorIA.jsx`:
```js
async function responder() {
  const r = respuesta.trim();
  if (!r) return;
  await guardarCorreccion({ pedido: texto, propuesta: resultado, correccion: r }); // <-- 1 linea
  const nuevo = `${texto.trim()}\n\nAclaraciones: ${r}`;
  ...
```

Y se lee en una pantalla nueva dentro de "Lo que Voni sabe": *"Correcciones que
te hicieron esta semana"*, con un botón **"Convertir en regla"** que abre el
formulario de `Reglas.jsx` ya prellenado con el texto de la corrección.

**Por qué así y no un fine-tune ni un RAG.** Rodrigo ya tiene el lugar donde vive
el conocimiento (la tabla `reglas`) y la pantalla para editarlo. Lo único que falta
es (1) que las correcciones no se pierdan y (2) que un humano decida cuáles se
vuelven regla. Un aprendizaje automático sobre precios en una app que factura de
verdad es exactamente lo que no se quiere: que Voni se auto-convenza de un precio
malo. **Que aprenda con revisión, no sola.**

---

## 🟡 9. Un pedido imposible entra al proyecto como $301,184 antes de que nadie lea nada

**Qué está mal.** `CotizadorIA.jsx` mete los renglones al proyecto (`onAgregarItems`)
**antes** de pintar las preguntas y los avisos. La tarjeta verde *"Agregué N muebles
a tu proyecto"* aparece arriba; las dudas, abajo.

**Pedido exacto:**
```
necesito un bench de 40 metros
```
**Qué contestó Voni:** 4 × banca doble de 12 puestos + 1 de 6 = **54 puestos**,
54 sillas, **$301,184**, todo dentro del proyecto. Y *después*, abajo:
> *"¿Los 40 m son metros lineales de corrida (bench doble) o superficie/puestos?
> ¿Cuántos usuarios necesitas en total?"*

O sea: Voni **sí sabe** que no entendió, lo dice, y de todos modos ya cargó
$301,184. Igual en T3 (*"6 puestos en 2 m²"*): la nota reconoce *"no cabe en 2 m²"*
y aun así cotiza.

**Qué debió pasar.** Cuando hay una pregunta que cambia la cantidad (no el acabado),
no se agrega nada: se pregunta primero.

**Arreglo propuesto (NO aplicado).** El `SCHEMA` de `cotizar-texto` ya tiene
`confianza` por renglón — no se está usando para nada. Añadir al schema un campo
de nivel de propuesta y respetarlo en la pantalla:

```ts
// en SCHEMA.properties, junto a `preguntas`:
bloquea: {
  type: "boolean",
  description: "true si alguna pregunta cambia la CANTIDAD o el alcance (no el " +
               "acabado). Con true, la app NO agrega nada hasta que le contesten.",
},
// y agregarlo a `required`
```
```jsx
// CotizadorIA.jsx ~linea 77
if (costados.length && !r.propuesta?.bloquea) {
  onAgregarItems(costados, { lote: nuevoLote, reemplaza: lote.current });
  ...
}
```

---

## 🟢 10. `leer-plano`: leyó bien y fue honesto. Un solo error de negocio.

**Prueba:** `Plano_Organico_Con_Medidas.pdf` (1 hoja, planta orgánica de 30×20 m).
69.7 s, HTTP 200.

**Qué leyó:**
```
envolvente: 30.00 × 20.00 m          <- exacto, coincide con las cotas del PDF
tieneCotas: true
escala: "cota general 30.00 m en el borde inferior y 20.00 m en el borde izquierdo;
         verificadas con Ø 7.00 m de la sala circular, 7.00 m del break room
         y 4.00 m del modulo de oficinas"
puertas: 9
areas (9):
  ÁREA OPERATIVA            open       poligono  19 pts  353.8 m2
  Sala de Juntas Circular   juntas     CIRCULO    Ø7 m    38.5 m2  dentroDe=ÁREA OPERATIVA
  Recepción                 recepcion  TRIANGULO   3 pts   28.3 m2
  Break Room & Baños        servicio   poligono    4 pts   41.1 m2
  Oficina 1..5              privado    poligono    7 pts   ~35 m2 c/u
suma de areas raiz: 600.4 m2  vs  envolvente 600.0 m2   (0.07% de error)
```

Los 9 rótulos del PDF son exactamente los 9 que devolvió. Sacó la sala **circular**
como círculo, la recepción como **triángulo**, el muro **curvo** con 7 puntos por
oficina. Eso es lo que el esquema v2 vino a arreglar y **funciona**.

**Y es honesto sobre lo que no pudo leer** — las notas dicen:
> *"El plano no conserva proporción isotrópica en la imagen: se escaló X con la cota
> de 30.00 m y Y con la de 20.00 m por separado."*
> *"Los anchos de puerta se estimaron entre 1200 y 1800 mm a partir de la longitud
> de las marcas rojas."*
> *"La franja triangular al sur-este se consideró parte del ÁREA OPERATIVA."*

**Los dos peros:**

**(a) El error de negocio.** Clasificó **"Break Room & Baños" como `servicio`**, y la
regla 10 de la tabla dice *"Baños, cocinetas, ductos, escaleras y bodegas no se
amueblan"*. Resultado: **41.1 m² de break room que nunca se van a amueblar** — se
pierden del proyecto las mesas, los bancos altos y el lounge de una cafetería
entera. El plano junta dos usos en un rótulo y el lector se queda con el de
servicio.

*Arreglo (NO aplicado):* en el `system` de `leer-plano`, la regla 6:
```
6) Clasifica en 'tipo': ... servicio (baño, cocineta, ducto, escalera, bodega).
   Los de servicio NO se amueblan.
   Si un rotulo junta dos usos ("Break Room & Baños", "Comedor y cocineta"),
   NO uses 'servicio': un break room / comedor / cafeteria SI se amuebla ->
   usa 'lounge' y anota en 'notas' que ahi adentro hay un nucleo de servicio.
```

**(b) Confianza inflada.** Las 9 áreas salieron con `confianza: "alta"`, incluidas
las que la propia nota admite haber estimado. El campo existe y no discrimina — el
usuario no tiene cómo saber cuál medida creerle.

*Arreglo (NO aplicado):* en el mismo `system`, en el bloque "ANTES DE RESPONDER":
```
g) La 'confianza' de un area es 'alta' SOLO si su contorno salio de cotas escritas
   en el plano. Si la mediste contra la escala general o la estimaste, es 'media';
   si no habia cota ni referencia, 'baja'. No pongas 'alta' en todas.
```

**Un detalle de robustez:** `leer-plano` no maneja `stop_reason === "max_tokens"`
(`cotizar-texto` sí lo hace, línea 132). Este plano gastó 4,851 de 8,000 tokens de
salida; uno más grande se corta y el usuario recibe *"La IA no devolvió una lectura
válida. Reintenta."* — reintentar no lo va a arreglar nunca. Vale la pena copiar el
guard de `cotizar-texto`.

---

## 🟢 11. Cantidades: bien en 7 de 8. Un solo tropiezo.

La trampa clásica —¿"20 lugares" son 20 puestos o 20 módulos?— **Voni la resuelve
bien**. Verificado renglón por renglón:

| pedido | pidió | cotizó | ✓ |
|---|---|---|---|
| `20 lugares de trabajo en bench App LT de 1.20` | 20 puestos | 2 islas × 10 = **20** | ✅ |
| `Call center para 60 posiciones` | 60 | 5 islas × 12 = **60** | ✅ |
| `sala de maestros con 24 puestos en bench` | 24 | 2 islas × 12 = **24** | ✅ |
| `40 lugares en mesas compartidas` | 40 | 5 bancas × 8 = **40** | ✅ |
| `2 salas de juntas para 6 y una para 10` | 22 sillas | 22 SONATA | ✅ |
| `20 lugares en bench de 1.50` (P1) | 20 | 2 × 10 = **20** | ✅ |
| `8 consultorios ... 2 sillas de visita` | 16 visita | 16 CONCURSO | ✅ |
| `35 personas ... bench de 6 usuarios` | 35 | 6 × 6 = **36** | ❌ (hallazgo 6) |

También sabe leer mal escrito: `kiero 12 eskritorios operatibos de 1.5 mtrs con su
gabeta y 2 mezas de juntas para 8 pers` → 12 escritorios 1500×600 + 12 gavetas +
2 mesas 2400 + 12 sillas operativas + 16 de visita. Perfecto. Las mayúsculas y el
spanglish (`20 workstations`, `boardroom table for 12`, `24 task chairs`) también.

---

## 🟢 12. ¿Se entiende? Para el usuario de 50 años, sí — con dos peros

**Lo que está bien.** El español es llano, sin jerga. Las notas dicen de dónde salió
cada supuesto, con nombre y apellido:

> *"Se asume línea App LT (volumen/económica) y fondo 600 mm por default; existen
> versiones premium Río y Cirque si se requiere mayor nivel. Sin electrificación
> por no especificarse."*

> *"Interpreté 'credenza' como archivero horizontal Modulor de 90 cm (opción económica)."*

> *"1.37 m no es medida de catálogo; se redondeó al 1500 mm inmediato superior
> (la otra opción es 1200 mm)."*

Eso es lo que uno le quiere oír a un vendedor. Y las preguntas son de vendedor de
verdad, no de formulario: *"¿La sillería la requieren en piel genuina o ecopiel?
(impacta precio de forma importante)"*.

**Pero 1 — no se distingue lo firme de lo supuesto.** El motor **ya sabe** cuáles
renglones salieron de un presupuesto firmado (`precioReal: true`) y cuáles del
modelo. En una cotización típica conviven los dos y la pantalla no los separa:

```
                 FIRME (papel firmado)     modelo (ESTIMADO)      BANCO (precio real)      total
P1 corporativo    1r     $43,380            3r    $150,648         5r    $212,570        $406,598
P2 call center    2r     $38,098            2r    $198,817         5r    $323,296        $560,211
P3 despacho       1r     $30,888            4r     $76,347         6r     $53,562        $160,797
P4 coworking      1r     $16,408            3r    $195,780         5r    $771,800        $983,988
P5 clinica        1r     $28,920            3r     $81,520         4r    $107,016        $217,456
P6 escuela        1r    $231,660            3r    $100,331         7r    $162,826        $494,817
P7 direccion      0r          $0            4r    $230,404         6r    $489,082        $719,486   <<<
P8 agencia        1r     $64,200            4r    $242,708         5r    $297,066        $603,974
```
En P2, $198,817 son **estimaciones** y se ven exactamente igual que los $38,098 que
están clavados a un papel. Y **P7 —el piso de dirección, la cotización de mayor
valor por pieza— no tiene un solo renglón firme**: $719,486 sin una sola línea
respaldada por un presupuesto cerrado, presentados con la misma cara que los demás.

*Arreglo (NO aplicado):* la pantalla ya recibe el campo. Un sello por renglón en
la lista de muebles —"Precio firme" / "Estimado"— y una línea de resumen:
*"De los $560,211, hay $361,394 con precio de presupuesto cerrado y $198,817
estimados."*

**Pero 2 — el campo `confianza` no se usa.** El schema lo pide y el modelo lo
llena (`alta`/`media`/`baja`), `CotizadorIA.jsx` lo guarda en la partida
(línea 60)... y nunca se pinta. Se está pagando por un dato que nadie ve.

---

# TABLA FINAL · las 24 reglas, una por una

`clave` = número que el motor puede aplicar · `texto` = lo que se le inyectaría al modelo

| # | ámbito | regla (resumida) | clave | ¿la aplica el motor? | ¿se le inyecta al modelo? | ¿se cumple en la salida real? |
|---|---|---|---|---|---|---|
| 1 | acomodo | 90 cm libres de circulación | `circulacion_min` | ✅ **SÍ** `malla.js:36` | ❌ no | n/a (acomodo) |
| 7 | acomodo | 90 cm alrededor de mesa de juntas | `holgura_juntas` | ✅ **SÍ** `malla.js:37` | ❌ no | n/a |
| 8 | acomodo | 60 cm delante de una guarda | `holgura_guarda` | ✅ **SÍ** `malla.js:38` | ❌ no | n/a |
| 5 | acomodo | pasillo principal de 1.20 m | `pasillo_principal` | ❌ nadie lo lee | ❌ no | n/a |
| 6 | acomodo | nada delante de una puerta | `barrido_puerta` | ❌ nadie lo lee | ❌ no | n/a |
| 2 | acomodo | escritorios viendo a la puerta | `escritorio_ve_a_puerta` | ❌ nadie lo lee | ❌ no | n/a |
| 3 | acomodo | la L siempre contra el muro | `l_contra_muro` | ❌ nadie lo lee | ❌ no | n/a |
| 17 | acomodo | gavetas pegadas al escritorio | `gaveta_pegada` | ❌ nadie lo lee | ❌ no | n/a |
| 9 | acomodo | bancas en hileras paralelas | — | — | ❌ no | n/a |
| 10 | acomodo | baños/cocinetas/ductos no se amueblan | — | — | ❌ no | ⚠️ **contraproducente**: `leer-plano` marcó "Break Room" como `servicio` → 41 m² sin amueblar |
| 11 | acomodo | recepción mira a la entrada | — | — | ❌ no | n/a |
| 12 | acomodo | guardas contra muro | — | — | ❌ no | n/a |
| 18 | acomodo | en juntas NUNCA gaveta ni archivero | — | — | ❌ no | ✅ sí (0 violaciones en 24 corridas) |
| 13 | plano | los planos no traen puertas dibujadas | — | — | ❌ no (hay texto parecido *hardcodeado* en `leer-plano`) | ✅ sí — leyó 9 puertas |
| 14 | plano | la escala sale de las cotas generales | — | — | ❌ no (*hardcodeada* como PASO 1) | ✅ sí — envolvente exacto 30×20 |
| 4 | cotización | privado = silla del puesto + 2 de visita | `sillas_visita_privado` | ❌ nadie lo lee | ❌ no | ✅ sí, **por instinto del modelo**: P2 → 6 visita/3 privados; P6 → 6/3; P7 → 8/4 |
| 24 | cotización | nunca cotizar cantidad distinta a la pedida | — | ⚠️ el motor **sabe** escalar (`lineas.js:257`) pero Voni no lo usa | ❌ no | ❌ **NO** — P8: pidieron 35, cotizó 36 |
| 25 | cotización | jerarquía CIRQUE > RÍO > APP LT | — | ✅ el precio la respeta ($6,628 / $4,654 / $2,918 por puesto a 8u) | ✅ **SÍ** (regla 8 *hardcodeada* en el prompt) | ✅ sí — App LT por default en 24/24, con la mención de la premium |
| 26 | cotización | siempre lleva sillería | — | — | ✅ **SÍ** (regla 6 *hardcodeada*) | ✅ sí — sillería en 23/24 (falta sólo T4, que no cotizó nada) |
| 19 | precio | bancas App LT POR USUARIO ($2,854) | `applt_por_usuario` | ⚠️ **a medias**: la escalera existe en `preciosVenta.js` pero está *hardcodeada*, no sale de la tabla | ❌ no | ✅ sí — $28,540 = 2,854 × 10, exacto |
| 15 | precio | precio 2 lleva siempre −40% | `descuento_precio2` | ⚠️ *hardcodeado* `DESCUENTO_PRECIO2 = 0.40` | ❌ no | ✅ sí — las 24 anclas reproducen a 0.0% |
| 16 | precio | margen mínimo 40% | `margen_min` | ⚠️ *hardcodeado* `margenMinimo: 40` | ❌ no | ⚠️ el margen real se lo comen los add-ons gratis (hallazgo 2) |
| 20 | precio | dólar a 17.50 | `tipo_cambio` | ⚠️ *hardcodeado* `tipoCambio: 17.5`. **Cambiarlo en la pantalla no mueve nada** | ❌ no | ✅ sí, por coincidencia |
| 21 | precio | ojo con la unidad al capturar (chapa por m²) | — | — | ❌ no | n/a (nota para humanos) |
| 22 | precio | melamina blanca ≠ melamina de color | — | — | ❌ no | n/a |
| 23 | precio | buscar qué artículo se compra de verdad (PET a corte) | — | — | ❌ no | n/a |

**Resumen de la tabla:**
- **3 de 13** reglas con `clave` las lee el motor de verdad (`circulacion_min`, `holgura_juntas`, `holgura_guarda`).
- **4 más** (`tipo_cambio`, `margen_min`, `descuento_precio2`, `applt_por_usuario`) están *hardcodeadas* con el mismo valor: funcionan, pero editarlas en la pantalla **no hace nada**.
- **6** no las lee nadie.
- **0 de 24** textos se le inyectan al modelo. Las 3 que sí se cumplen (25, 26, y parte de la 13/14) es porque alguien las **copió a mano** dentro del `system` de la edge function — que es exactamente lo que el comentario de cabecera de `reglas.js` dice que no hay que hacer.

---

# ORDEN SUGERIDO DE ATAQUE

1. **Puente de reglas** (hallazgo 7, (a) y (b)) — 3 líneas de código. Sin esto, ninguna otra regla que se dicte va a servir.
2. **Add-ons de la escalera App LT** (hallazgo 2) — es el dinero de verdad: 15–27% del proyecto entregado gratis.
3. **Deduplicar el Banco en `catalogoIA()`** (hallazgo 4) + **regla de silla por default** (hallazgo 5) + **`temperature: 0`** (hallazgo 1) — los tres juntos matan la varianza del 2.35×.
4. **`bloquea`** (hallazgo 9) — que un pedido que Voni no entendió no entre al proyecto.
5. **Tabla `correcciones`** (hallazgo 8) — para que la próxima auditoría no tenga que redescubrir lo mismo.
6. **Break room ≠ servicio** y la confianza del plano (hallazgo 10) — dos líneas de prompt.
