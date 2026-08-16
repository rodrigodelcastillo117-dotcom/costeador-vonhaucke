# Auditoría con lupa · LECTOR DE PLANOS y ACOMODO
**Costeador Von Haucke** · 2026-08-16 · proyectista senior, cuatro lentes (¿truena? ¿sirve? ¿es creíble? ¿mejorable?)

Nada de esto se aplicó. No se corrió `deploy.sh`. No se tocó `src/`. No se subió ningún plano de cliente a ningún servicio.

**Cómo se probó**
- Motor, en frío, con scripts de medición geométrica: `scratchpad/audit-geom.mjs`, `audit-geom2.mjs`, `audit-huella.mjs`, `audit-3.mjs`, `audit-4.mjs` (se corren con `node scratchpad/<archivo>.mjs`).
- Pantalla, en el navegador, contra `humo.html` (48/48 pantallas montan) en `http://localhost:5175/humo.html`, midiendo por DOM: arrastre real con `PointerEvent`, girar, quitar, vaciar, re-acomodar, deshacer, cambiar la medida del cuarto, y escala de toque en celular (375 px).

---

## Resumen de una línea

El motor de malla (`malla.js`) es bueno de verdad — respeta forma, columnas, muro, centra la mesa de juntas, orienta el escritorio a la puerta y hasta comprueba si se llega caminando. **El problema es que en el camino por omisión no se usa, y que todo lo que la pantalla le dice al proyectista ("Voni revisó ✓") es un cartel fijo que no vuelve a medir nada.** Un plano vacío sigue diciendo "17 de 17 · Nada encimado · Todo cabe".

---

# HALLAZGOS · de más a menos grave

---

## 1 · CRÍTICO — "Voni revisó ✓" no se recalcula NUNCA: con el plano vacío sigue diciendo "Todo cabe"

**Qué está mal.** `plan.auditoria` y `plan.resumen` se calculan una sola vez, cuando el motor acomoda, y se siguen enseñando tal cual después de que el proyectista mueve, gira, quita o vacía el plano.

**Dónde.**
- `src/componentes/Acomodo.jsx:282` — `editarColocacion` sólo reemplaza `colocacion`; deja intactos `auditoria`, `resumen`, `notas`, `caben`.
- `src/componentes/Acomodo.jsx:617-628` — el panel `voni-audit` pinta `plan.auditoria` sin más.
- `src/datos/planner.js:115-120` — en el camino 1-clic la auditoría es una **constante literal** de cuatro `ok: true`; no mide nada.
- `src/datos/planner.js:261-265` — en el camino multi-cuarto, tres de los cinco renglones también son `ok: true` fijos.

**Cómo lo reproduje** (navegador, `humo.html` → tarjeta *Acomodo 3D*):
1. Planta → *Acomodar a mano* → *Vaciar el plano y acomodar yo*.
2. Leo la tarjeta. Esto es literal, copiado del DOM:

```
⚠ Faltan 17 mueble(s) por colocar.
Los 17 muebles quedan acomodados por zonas, con pasillos y circulación. Todo cabe.
Voni revisó:
  ✓ Todas las piezas colocadas · 17 de 17
  ✓ Nada encimado · garantizado por el motor
  ✓ Circulación entre filas · 1.10 m
  ✓ Circulación perimetral · 0.7 m contra muros
```

Con **0 muebles en el plano**. Lo mismo pasa al arrastrar una pieza encima de otra (traslape real medido: 1.19 m²) y al dejar una banca medio fuera del cuarto: el panel verde no se inmuta. Reproducible también en frío: `node scratchpad/audit-geom.mjs`, CASO 5 → `plan.auditoria es el MISMO objeto: true`.

**Por qué importa.** Es lo peor que puede tener un plano: decir con seguridad algo que no midió. El proyectista firma un acomodo con un ✓ verde al lado; el cliente recibe un plano donde dos escritorios están encimados y el papel dice "nada encimado, garantizado por el motor". Cuesta la credibilidad de toda la herramienta de un solo golpe.

**Arreglo propuesto (no aplicado).** La auditoría deja de viajar dentro de `plan` y pasa a ser una función pura de `(areas, colocacion, piezas)` que se recalcula con cada cambio, igual que `chequeo`. Concretamente:

```js
// nuevo src/datos/revision.js
export function revisarAcomodo(areasMM, colocacion, byId) { /* traslapes, poly, obstáculos,
   barrido de puerta, circulación BFS, separación mínima vs regla('circulacion_min') */ }
```

y en `Acomodo.jsx`, en lugar de `plan.auditoria`:

```js
const auditoria = useMemo(() => revisarAcomodo(areasMM, plan?.colocacion || [], byId), [areasMM, plan, byId]);
```

Regla de oficio para el equipo: **ningún renglón de la auditoría puede ser un literal `ok: true`.** O se mide, o no se enseña. Y "sin puertas en el plano, no se pudo comprobar" (`malla.js:411`) no puede llevar ✓ verde: eso es un "no revisado", no un "está bien".

---

## 2 · CRÍTICO — El acomodo por omisión deja 16 cm entre muebles y no pasa por las reglas

**Qué está mal.** El camino que corre solo al entrar (un solo espacio, sin plano subido) no usa la malla ni consulta la tabla `reglas`: empaca por filas con separaciones fijas de **160 mm entre piezas** y **700 mm contra el muro**, cuando la regla que dictó Rodrigo es **900 mm**.

**Dónde.**
- `src/datos/planner.js:110` — `if (opts.ajustar && areas.length <= 1)` → se va a `empacarTodoGarantizado` y nunca toca `malla.js`.
- `src/datos/planner.js:70` — `const PER = 700, GX = 160;`
- `src/componentes/Acomodo.jsx:146-147` — `const auto = !planReal && areasMM.length <= 1;` → es el caso normal de casi toda cotización que no trae plano.

**Cómo lo reproduje.** `node scratchpad/audit-4.mjs`:

```
regla circulacion_min = 900 mm
  g1  x=700 y=700
  g2  x=1610 y=700        ← 160 mm de separación
  g3  x=2520 y=700
  separación MÍNIMA entre dos muebles: 160 mm  *** VIOLA LA REGLA DE 900 mm ***
  margen contra el muro (PERIM): 700 mm → la regla pide 900
  ✓ Circulación perimetral · 0.7 m contra muros
```

En el navegador se ve igual: seis archiveros a 5220, 6130, 7040, 7950, 8860 y 9770 mm — 160 mm limpios entre uno y otro.

**Por qué importa.** Seis archiveros a 16 cm entre sí no se pueden abrir. Dos escritorios directivos a 16 cm no son dos puestos, son un mueble. Y ese acomodo es exactamente el que se convierte en la **Vista realista (IA)** y en el 3D que ve el cliente: se le está vendiendo una densidad que no se puede montar. Peor: el mismo panel presume "✓ Circulación perimetral · 0.7 m", que ya declara por escrito que no cumple los 90 cm.

**Arreglo propuesto.** El camino 1-clic debe seguir siendo instantáneo, pero medir con la misma vara:

```js
// planner.js — dentro de empacarTodoGarantizado
const PER = Math.max(700, regla('circulacion_min'));        // 900
const GX  = Math.max(160, Math.round(regla('circulacion_min') / 2));  // 450 compartido = 900 entre vecinos
```

y `rowGap` que arranque en `regla('pasillo_principal')` (1200) para filas de estaciones. Mejor todavía: correr `acomodarEnForma` también aquí, con un área rectangular auto-dimensionada, y quedarse con un solo motor en vez de dos que no se parecen.

---

## 3 · GRAVE — Las puertas que dibuja el proyectista se tiran a la basura

**Qué está mal.** En *Dibujar mi oficina* hay una herramienta "Puerta". Las puertas se dibujan, se ven, se cuentan… y al pasar al acomodo **no viajan**: sólo sobrevive el número total en un campo de texto para el render de IA.

**Dónde.**
- `src/componentes/DibujarPlano.jsx:163-179` — el `areas.map()` de `listo()` arma `{ nombre, ancho, largo, tipo, x, y, poly, obstaculos }`. **No hay `puertas`.**
- `src/componentes/DibujarPlano.jsx:180-186` — `meta = { alto, doors: doors.length, … }`; sólo el conteo.
- `src/componentes/Acomodo.jsx:237-247` — `usarDibujo` tampoco las añade.

**Cómo lo reproduje.** Lectura de código, verificable en un minuto: `grep -n "puertas" src/componentes/DibujarPlano.jsx` no devuelve nada. Y el efecto se mide en `malla.js:370` (`if (puertas.length)`): sin puertas, tres cosas se apagan solas.

**Por qué importa.** Sin puertas el motor:
- no puede orientar los escritorios (la regla "viendo a la puerta" queda muerta — `malla.js:341` sale por `if (!puertas.length) return rot`);
- no comprueba que **se llegue caminando** a cada mueble (`malla.js:365-399`) y encima lo reporta con ✓ verde diciendo "sin puertas en el plano, no se pudo comprobar";
- no reserva el barrido de la hoja, así que puede plantar un archivero tapando la entrada.

Es decir: el camino que Rodrigo pensó como el más fácil ("dibuja tu oficina") es justo el que deja al motor ciego. Toda la maquinaria de `planoLeido.js:165-186` para repartir puertas existe y funciona, pero sólo se alimenta desde un PDF que las traiga dibujadas — que es lo que casi nunca pasa.

**Arreglo propuesto.** En `DibujarPlano.jsx:163`, repartir cada puerta al cuarto cuyo muro toca (mismo criterio de `cercaDe` que ya usa `planoLeido.js`):

```js
const TOCA = 0.7;   // m
const puertasDe = (r) => doors
  .filter((d) => d.x >= r.x - TOCA && d.x <= r.x + r.w + TOCA &&
                 d.y >= r.y - TOCA && d.y <= r.y + r.h + TOCA)
  .map((d) => ({ x: +(d.x - r.x).toFixed(2), y: +(d.y - r.y).toFixed(2), ancho: 0.9 }));
// … y dentro del objeto del área:
puertas: puertasDe(r),
```

y en `Acomodo.jsx:237-247` (`usarDibujo`) agregar la línea equivalente en mm. Además: si un cuarto no-servicio se queda sin puerta, decirlo en pantalla ("Este privado no tiene puerta: no puedo revisar la circulación ni orientar el escritorio").

---

## 4 · GRAVE — La revalidación después de mover sólo mira la caja del cuarto y los traslapes: todo lo demás pasa callado

**Qué está mal.** `chequeo` sí se vuelve a correr con cada movimiento (eso está bien y hay que decirlo), pero mide muy poco: bordes del **rectángulo** del cuarto y traslapes mueble-mueble. No mira la **forma real** del cuarto, ni columnas y escaleras, ni el barrido de la puerta, ni circulación, ni la separación mínima de 90 cm. Y lo que sí reporta lo **cuenta deduplicado por nombre**, así que under-reporta.

**Dónde.** `src/componentes/Acomodo.jsx:486-525`. En concreto:
- línea 497: `if (b.x0 < -tol || … b.x1 > a.ancho + tol …)` → rectángulo, nunca `a.poly`;
- líneas 499-503: sólo pares de muebles;
- línea 505: `[...new Set(fuera)]` → ocho piezas fuera con tres nombres distintos se cuentan como **3**;
- no existe ninguna comprobación contra `a.obstaculos` ni contra `a.puertas`.

**Cómo lo reproduje.**
- *Hueco de una L* — `node scratchpad/audit-geom.mjs`, CASO 6: cuarto en L, se suelta un escritorio en (6800, 5000), dentro de la caja envolvente pero fuera del polígono →
  `¿el chequeo de la app lo reporta? NO` / `¿está de verdad fuera del cuarto? SÍ, fuera del polígono`.
- *Encima de la puerta* — `node scratchpad/audit-geom2.mjs`, caso D: el archivero arrastrado sobre el barrido de una puerta → `SÍ CHOCA`, y nadie lo dice.
- *Under-reporte* — navegador: encogí el cuarto a 6 m de ancho; **8 muebles** quedan sobresaliendo y la alerta dice `⚠ 3 ajuste(s) por revisar`.

**Por qué importa.** En una planta orgánica (que es justo el caso que motivó `planoLeido.js`) el hueco de la L, el patio y el pasillo curvo caen todos dentro de la caja envolvente. Ahí el proyectista puede soltar media oficina "en el vacío" y la app calla. El cliente recibe un plano con escritorios fuera del muro.

**Arreglo propuesto.** Es el mismo arreglo del hallazgo 1: una sola función `revisarAcomodo()` que sustituya al `chequeo` actual. El núcleo ya existe y está probado — hay que reusarlo, no reescribirlo:

```js
import { dentroPoly } from '../datos/malla.js';
// dentro del cuarto: las 4 esquinas del mueble dentro del polígono
if (a.poly?.length >= 3 && esquinas.some(([x,y]) => !dentroPoly(a.poly, x, y))) problemas.push(`Fuera del cuarto: ${b.nombre}`);
// obstáculos y barrido de puerta: mismo test de rectángulos que ya usa `chocaObstaculo`
// circulación: reconstruir la Malla y correr `alcanzable(puertas)` — ya está escrito en malla.js:139
```

Y contar piezas, no nombres: `problemas.length` sobre las cajas, no sobre el `Set` de nombres.

---

## 5 · GRAVE — Un cuarto dentro de otro: el mueble se guarda en el cuarto equivocado

**Qué está mal.** Para decidir en qué área cae un toque, la app recorre las áreas **en orden** y devuelve la primera cuya **caja envolvente** contiene el punto. Cuando un cuarto está dentro de otro —la sala circular en medio del open space, que es exactamente el plano orgánico de Rodrigo— siempre gana el cuarto grande.

**Dónde.** `src/componentes/PlanoAcomodo.jsx:170-176` (`areaDe`), usada por `soltar` (177) y `soltarArrastre` (231).

**Cómo lo reproduje.** `node scratchpad/audit-3.mjs`, caso B — reproduce `areaDe` tal cual sobre la salida real de `areasDeLectura`:

```
áreas: Open space (0,0 20000×15000) · Sala de juntas (6500,3500 7000×7000)
suelto la MESA DE JUNTAS en el centro de la sala circular (10000,7000):
→ la app la guarda en area=0 ("Open space")   MAL: la manda al cuarto equivocado
```

**Por qué importa.** Doble daño. (a) La mesa se dibuja donde el dedo la soltó, así que **se ve bien** y nadie se entera. (b) Pero queda registrada en el open space, y de ahí sale el **resumen por área de la propuesta** (`src/datos/resumen.js:44-51`): el cliente recibe una cotización que le cobra la mesa de consejo y las 12 sillas dentro de "Open space", y la sala de juntas aparece vacía y sin costo. Es un error que se ve en el papel que firma el cliente.

**Arreglo propuesto.** Preferir el área **más chica** que contenga el punto, y respetar el polígono:

```js
function areaDe(x, y) {
  let mejor = null, mejorA = Infinity;
  for (let i = 0; i < areas.length; i++) {
    const o = offs[i], a = areas[i];
    if (x < o.x || x > o.x + a.ancho || y < o.y || y > o.y + a.largo) continue;
    if (a.poly?.length >= 3 && !dentroPoly(a.poly, x - o.x, y - o.y)) continue;
    const sup = a.ancho * a.largo;
    if (sup < mejorA) { mejorA = sup; mejor = i; }
  }
  return mejor;
}
```

(`dentroPoly` ya está exportado en `malla.js:51` y en `planoLeido.js:42`.)

---

## 6 · GRAVE — Las áreas que el modelo NO pudo ubicar se pierden en silencio

**Qué está mal.** Si la lectura devuelve un cuarto sin geometría utilizable (sin `puntos`, sin `circulo`, sin `ancho/largo`, o con menos de 3 vértices), se filtra y desaparece. Nadie avisa. `revisarAreas` filtra con el mismo criterio, así que tampoco lo ve.

**Dónde.**
- `src/datos/planoLeido.js:146-148` — `.filter((r) => r.pts && r.pts.length >= 3)`
- `src/datos/planoLeido.js:210-212` — el mismo filtro dentro de `revisarAreas`.
- El único aviso posible (`Acomodo.jsx:221`) sólo salta si **no quedó ninguna** área.

**Cómo lo reproduje.** `node scratchpad/audit-geom.mjs`, CASO 4: lectura con 4 áreas, dos de ellas sin geometría ("Privado 3", "Bodega") →

```
áreas que entraron a la app: 2 de 4
revisarAreas dice: []
>>> ¿alguien avisó de "Privado 3" y "Bodega"? NO — se perdieron en silencio
```

**Por qué importa.** Contradice de frente lo que el propio archivo se propone en su encabezado ("un plano mal leído que se dibuja sin avisar es peor que uno que no se lee"). En el plano real de Rodrigo (`VH 02 ABRIL`, 18 áreas, planta irregular) basta con que el modelo no le atine a tres cuartos para que el proyectista amueble 15 y no sepa que faltan 3 — y esos 3 se le van a facturar mal o no se le van a facturar.

**Arreglo propuesto.** En `planoLeido.js`, contar los descartados y reportarlos:

```js
export function areasDeLectura(lectura) {
  const todas = (lectura?.areas || []).map((a) => ({ a, pts: contornoMM(a) }));
  const crudas = todas.filter((r) => r.pts && r.pts.length >= 3);
  const sinUbicar = todas.filter((r) => !(r.pts && r.pts.length >= 3)).map((r) => r.a.nombre || 'Área sin nombre');
  …
  return { areas, envolvente: …, puertas, sinUbicar };
}
```

y en `revisarAreas`, al principio:

```js
if (sinUbicar.length) problemas.push(`No pude ubicar en el plano: ${sinUbicar.join(', ')}. Dibújalos a mano o corrige sus medidas.`);
```

---

## 7 · GRAVE — Los puestos de trabajo se cuentan a la mitad en bancas dobles

**Qué está mal.** El número que el proyectista le dice al cliente ("N puestos, X m² por persona") se estima dividiendo el largo del mueble entre 1.50 m. En una **banca doble** hay dos personas por columna, así que sale la mitad — y el m²/persona sale al doble.

**Dónde.** `src/componentes/Acomodo.jsx:512-513`:

```js
.reduce((n, p) => n + Math.max(1, Math.round(Math.max(p.w, p.d) / 1500)), 0);
```

**Cómo lo reproduje.** Navegador, cotización de humo con dos "Banca doble APP LT 1.50 · **10 usuarios** · ocupa 7.50 × 1.20 m" más dos escritorios directivos. La app dice:

```
✓ Todo cabe. 12 puestos de trabajo en 162 m² · 13.5 m² por persona.
```

Lo real: 10 + 10 + 1 + 1 = **22 puestos**, es decir **7.4 m² por persona**.

**Por qué importa.** 13.5 m²/persona le dice al proyectista "va holgado, todavía cabe más gente". 7.4 m²/persona le dice "vas al límite bajo de lo aceptable". Es el número con el que se decide si se venden más estaciones o no, y está al doble. Además el nombre del mueble ya trae el dato bueno escrito ("10 usuarios"), así que se está estimando algo que ya se sabe.

**Arreglo propuesto.** Leer los usuarios del nombre —que es la misma expresión que ya usa `huellaReal` (`espacio.js:101`)— y caer a la estimación sólo si no viene:

```js
const usuariosDe = (p) => {
  const s = (p.nombre || '').toLowerCase();
  const m = /(\d+)\s*(?:puesto|plaza|persona|posicion|usuario)s?\b/.exec(s) || /(\d+)\s*u\b(?!\w)/.exec(s);
  if (m) return Math.max(1, +m[1]);
  const cols = Math.max(1, Math.round(Math.max(p.w, p.d) / 1500));
  return /doble/.test(s) ? cols * 2 : cols;
};
```

---

## 8 · MEDIO — Reglas que están escritas en la tabla y que NADIE aplica

**Qué está mal.** `reglas.js` promete dos usos para cada regla: el `valor` lo aplica el motor, y el `texto` se le inyecta a Voni en los prompts. En la práctica **el motor lee tres claves y el texto no lo lee nadie**.

**Dónde.** `grep -rn "regla(" src/ | grep -v pdfPropuesta` devuelve exactamente tres consultas, todas en `src/datos/malla.js:36-38`. Y `reglasTexto()` (`src/datos/reglas.js:46-49`) **no se llama desde ningún archivo** — sólo `cargarReglas` (`App.jsx:242`) y `todasLasReglas` (`Reglas.jsx:38`, sólo para pintarlas en pantalla).

### Las que SÍ se aplican de verdad

| Regla | Dónde manda | Evidencia |
|---|---|---|
| `circulacion_min` (900) | `malla.js:36,39,42` — holgura de escritorio y de todo lo demás | `audit-geom2.mjs` caso C: mesa de juntas con 0.95/1.05/1.35/1.45 m alrededor |
| `holgura_juntas` (900) | `malla.js:37` | idem |
| `holgura_guarda` (600) | `malla.js:38` | idem |
| "gavetas pegadas al escritorio, nunca en juntas" | `malla.js:229` (`if (pegadaARef && hueco > PEGADA) continue`) + `planner.js:146` (`guarda` sin destino `juntas`) | está codificada como filtro duro, no como preferencia — bien hecho |
| "siempre hay sillería" | `espacio.js:54` (`tipoDe` → `asiento`) + dibujo de sillas en `PlanoAcomodo.jsx:508` | las sillas se cotizan, se acomodan y se dibujan |
| "escritorios viendo a la puerta" | `malla.js:262-278, 341` | `audit-geom2.mjs` caso B: las 4 puertas (arriba/abajo/izq/der) dan coseno 0.60–0.99 → **sí funciona** |

### Las que están escritas y NO existen en el código

| Regla | Estado | Dónde habría que aplicarla |
|---|---|---|
| **`l_contra_muro` (escritorio en L contra el muro)** | **muerta.** No hay ni siquiera un concepto de mueble en "L": `dimsPieza` (`espacio.js:68`) sólo maneja rectángulos, y una "Estación 2u L" entra al plano como una tira recta | `malla.js`: marcar el mueble con `forma:'L'` desde `tipoDe`/generadores, y en `buscarHueco` (`malla.js:186`) exigir `c.total` en **dos lados contiguos** (esquina) en vez de premiar un solo lado, cuando `regla('l_contra_muro')` |
| **`sillas_visita_privado` (2)** | **muerta.** Las sillas de visita se anclan a `'muro'` (`malla.js:175`) y acaban desperdigadas | dos sitios: (a) `planner.js:195` — al repartir por cuarto, garantizar 2 asientos por cada cuarto de rol `privado` con escritorio; (b) `malla.js:320` — colocarlas como `refs` del escritorio, del lado del **frente** que ya calcula `frenteDe(h.rot)`. Evidencia: `audit-geom.mjs` CASO 1, las dos sillas quedan en (2625,3250) y (2750,2025), pegadas al muro derecho y no frente al escritorio que está en (500,100) |
| `pasillo_principal` (1200) | **muerta.** Nadie la lee | `planner.js:71` (`rowGap`) y `malla.js:42`: el pasillo entre **filas** de estaciones debería ser 1200, no 1100 fijo |
| `barrido_puerta` (900) | **duplicada a mano.** El valor está en la tabla pero `planoLeido.js:38` define su propio `const BARRIDO = 900` | `planoLeido.js:181` → `Math.max(p.ancho || 900, 900) + regla('barrido_puerta')` |
| `escritorio_ve_a_puerta` (1) | **el número se ignora.** `mirandoA` se llama siempre (`malla.js:341`); apagar la regla en la tabla no hace nada | `malla.js:341` → `if (p.tipo === 'escritorio' && !esBloque && regla('escritorio_ve_a_puerta'))` |
| **todos los `texto`** | **nunca llegan a Voni.** `reglasTexto()` no se invoca en ningún lado | los prompts de `nube.js` (`acomodarEspacio`, `leerPlano`, el cotizador) deberían anteponer `reglasTexto('acomodo').join('\n')` |

**Por qué importa.** Rodrigo montó la tabla `reglas` justamente para que "una regla dictada una vez quede y se use sin que nadie se acuerde de copiarla". Hoy la pantalla *Lo que Voni sabe* le enseña reglas que Voni **no sabe**: puede editar "2 sillas de visita por privado", guardarla, verla en verde, y no cambia absolutamente nada en el plano. Eso es peor que no tener la pantalla.

---

## 9 · MEDIO — El acomodo no responde cuando cambia el tamaño del cuarto

**Qué está mal.** Corregir el ancho o el largo de un área redibuja el cuarto (y hasta escala su polígono, que está bien resuelto) pero **no vuelve a acomodar**. Los muebles se quedan donde estaban.

**Dónde.** `src/componentes/Acomodo.jsx:123-137` (`setArea`) — toca `areas` y nada más; `acomodar()` (línea 143) sólo corre por botón o por el efecto de entrada (155-163).

**Cómo lo reproduje.** Navegador: con 17 muebles acomodados en un espacio de 13.00 × 12.45 m, cambié el ancho a **6 m**. Resultado medido por DOM: **8 de 17 muebles quedan sobresaliendo** del muro, la alerta dice `⚠ 3 ajuste(s) por revisar` (por el deduplicado del hallazgo 4) y el panel verde sigue intacto.

**Por qué importa.** Corregir la medida de un cuarto es lo primero que hace un proyectista al recibir el levantamiento real. Que la app no reaccione obliga a acordarse de pulsar "Acomodar" — y si no se acuerda, se queda con un plano con muebles atravesando el muro.

**Arreglo propuesto.** Ofrecerlo, no imponerlo (re-acomodar solo borraría el trabajo a mano, que es justo lo que Rodrigo sufrió):

```js
// Acomodo.jsx, tras setArea
const [medidaCambiada, setMedidaCambiada] = useState(false);
// … en setArea: if (eje >= 0) setMedidaCambiada(true);
{medidaCambiada && plan && (
  <div className="alerta ambar"><span className="texto">
    Cambiaste la medida del cuarto. <button className="boton" onClick={() => { acomodar(); setMedidaCambiada(false); }}>
    Volver a acomodar</button> o muévelos tú.</span></div>)}
```

---

## 10 · MEDIO — La holgura no se descuenta contra el muro: se pierde una banca de 8 puestos por 40 cm

**Qué está mal.** En la malla, cada mueble reserva `huella + holgura` completa en las dos direcciones, también del lado que da al muro. Contra la pared la holgura no sirve para nada (después el mueble se pega con `pegado = 100 mm`, `malla.js:348`), pero la reserva ya bloqueó las celdas.

**Dónde.** `src/datos/malla.js:192` y `206` — `const iw = celdas(pw + holgura), jh = celdas(ph + holgura);`

**Cómo lo reproduje.** `node scratchpad/audit-geom2.mjs`, caso A — dos bancas dobles de 4.80 × 1.20 en un open de **9.00 × 4.00 m**:

```
colocadas: 1 /2 → [ 'b1@500,500' ]
notas: [ '1 pieza(s) no caben en el plano. Quita muebles o usa otra área.' ]
A MANO cabría: 0.10 + 1.20 + 1.00(pasillo) + 1.20 = 3.50 m de 4.00 → sobran 0.50 m
```

Lo mismo pasa en el caso 3 de `audit-geom.mjs` (open en L de 50 m²: coloca 1 de 2 bancas).

**Por qué importa.** Ocho puestos perdidos por 40 cm de cuenta conservadora. En un open space de 50 m² el motor entrega la mitad de la densidad que entregaría el proyectista a mano — y con la nota "no caben", que es una afirmación falsa. Directamente son estaciones que no se cotizan.

**Arreglo propuesto.** Descontar la mitad de la holgura cuando ese lado del bloque topa con muro. En `buscarHueco`, antes de rechazar por `!malla.libre(...)`, probar la variante recortada:

```js
// si el bloque arranca pegado al muro (o al borde), la holgura de ese lado no hace falta
const recorte = (i, j, iw, jh) => {
  let i0 = i, j0 = j, w = iw, h = jh;
  const half = Math.ceil((holgura / 2) / CELDA);
  if (malla.topa(i - 1, j)) { i0 = i; w = iw - half; }
  if (malla.topa(i, j - 1)) { j0 = j; h = jh - half; }
  return { i0, j0, w, h };
};
```

Alternativa más simple y casi igual de efectiva: `jh = celdas(ph + holgura) ` pero permitir que el **último** bloque de una fila use `celdas(ph + holgura/2)` cuando `malla.contacto(...)` reporta muro en ese lado.

---

## 11 · MEDIO — Un cuarto anidado bloquea su caja, no su forma: la sala circular Ø7 se come 17 m² de open space

**Qué está mal.** Cuando un cuarto queda dentro de otro, al padre se le pasa como obstáculo la **caja envolvente** del hijo. Encima, la malla añade 250 mm de paso alrededor de todo obstáculo.

**Dónde.**
- `src/datos/planoLeido.js:169-176` — `const hb = bbox(hp); return { x: …, w: m(hb.x2 - hb.x), … }`
- `src/datos/malla.js:23` (`PASO_OBST = 250`) y `72-73`.

**Cómo lo reproduje.** `node scratchpad/audit-geom.mjs`, CASO 4, con la sala de juntas circular de Ø7 m del plano orgánico:

```
obstáculo que le queda al open: { x:6.5, y:3.5, w:7, h:7 } → 49.0 m² bloqueados vs 38.5 m² reales
```

Con `PASO_OBST` la superficie efectivamente vetada es **7.5 × 7.5 = 56.25 m²**: **17.75 m² de open space que no se pueden amueblar** y que sí existen.

**Por qué importa.** Son las cuatro esquinas alrededor de la sala redonda: en un plano real ahí van dos bancas o una zona de lounge. El motor las ve como muro.

**Arreglo propuesto.** Que el obstáculo lleve su polígono y que la malla lo respete:

```js
// planoLeido.js — junto a x/y/w/h
poly: hp.map(([px, py]) => [m(px - b.x), m(py - b.y)]),
// malla.js:71-73 — si el obstáculo trae poly, usar dentroPoly con un offset de PASO_OBST
if (o.poly?.length >= 3 ? dentroPoly(o.poly, px, py) : (px >= o.x - PASO_OBST && …)) { malo = true; break; }
```

---

## 12 · MEDIO — Una estación en "cruz" o en "L" se dibuja como una tira de 6 metros

**Qué está mal.** `huellaReal` sólo sabe una geometría multi-puesto: **N puestos en fila** (y bench doble, dos filas). Una estación en cruz (4 personas en molinete) o en L/T se multiplica como si fuera una fila.

**Dónde.** `src/datos/espacio.js:105-114` — rama `tipo === 'escritorio'`, `return [n * perW, perD]`.

**Cómo lo reproduje.** `node scratchpad/audit-huella.mjs`, con la salida real de `generarRio` + `footprintDe`:

```
Río · Estación 4u "cruz" · 1.50 m   fp=1500×1200 → HUELLA EN EL PLANO 6000×1200 mm (7.20 m²)
Río · Estación 2u "L" · 1.50 m      fp=1500×1200 → HUELLA EN EL PLANO 3000×1200 mm (3.60 m²)
```

Una cruz de 4 usuarios mide aproximadamente **3.0 × 3.0 m**, no 6.00 × 1.20. (Las bancas rectas, en cambio, salen bien: `Bench recto doble 6u → 3600×1200` es correcto.)

**Por qué importa.** Una cruz dibujada como tira de 6 m no cabe en ningún privado ni se acomoda como isla; el motor la manda al open pegada a un muro o la reporta como "no cabe". Y en el 3D el cliente ve un mueble que no existe.

**Arreglo propuesto.** Declarar la disposición junto al número de puestos:

```js
// espacio.js, dentro de huellaReal, rama escritorio
if (/\bcruz\b/.test(s))  return [2 * perW, 2 * perD];        // molinete 2×2
if (/\b"?[lt]"?\b/.test(s) && n === 2) return [1.6 * perW, 1.6 * perD];   // L / T
```

Más limpio todavía: que los generadores (`rio.js:420`, etc.) devuelvan `huella: {w, d}` explícita y que `huellaReal` no tenga que adivinar del nombre.

---

## 13 · MEDIO — En celular los muebles miden 9 px y los botones de girar/quitar 15 px

**Qué está mal.** Todo el plano editable escala con el viewBox. En un teléfono no hay zoom ni desplazamiento, así que la oficina entera se comprime a 263 px de ancho y nada se puede tocar.

**Dónde.**
- `src/componentes/PlanoAcomodo.jsx:268` — `const bt = (totalW + 2 * pad) / 17;` (fracción del viewBox);
- `src/componentes/PlanoAcomodo.jsx:384-385` — la "zona de toque generosa" son 60 mm del plano;
- `src/estilos.css:877-879` — `.plano { width: 100%; max-height: 72vh }`, sin zoom/pan.

**Cómo lo reproduje.** Navegador a 375 × 812 (preset móvil), midiendo la matriz del SVG:

```
viewport 375 px · SVG renderizado 263 px · escala 0.01826 px/mm
  botón ⟳ / ✕ ................. 15 px    (mínimo recomendado: 44 px)
  mueble más chico del plano ...  9 px
  silla de visita (600 mm) ..... 11 px
  tolerancia de 60 mm ..........  1.1 px  ← no alcanza para nada
```

**Por qué importa.** La pregunta era explícita: ¿alcanzan los 60 mm de tolerancia? **No: son 1.1 píxeles.** Un proyectista de 50 años en obra, con el teléfono, no puede seleccionar una silla de 11 px ni atinarle a un botón de 15 px — y como los dos botones están a 1.24·bt uno del otro (`PlanoAcomodo.jsx:288-289`), a esa escala están a 18 px de centro a centro: casi seguro le da a ✕ cuando quería ⟳.

**Arreglo propuesto.** Dos cosas, en este orden:
1. **Tamaño mínimo en píxeles reales**, no en fracción del viewBox. Medir con `svg.getScreenCTM().a` y fijar el radio para que el botón nunca baje de 44 px:
```js
const [escala, setEscala] = useState(1);
useEffect(() => { const m = ref.current?.getScreenCTM(); if (m) setEscala(m.a); });
const bt = Math.max((totalW + 2 * pad) / 17, 46 / (escala || 1));
```
   y lo mismo para el margen del `rect` transparente: `Math.max(60, 22 / escala)`.
2. **Zoom y arrastre del lienzo** en pantallas angostas (un `viewBox` con estado y gesto de dos dedos), o —más barato— un botón "acercar al cuarto" que ponga el viewBox sobre un área a la vez cuando `innerWidth < 768`.

---

## 14 · MENOR — Topes silenciosos: se pierden piezas por encima de 60, y de 30 por partida

**Qué está mal.** `expandirPiezas` corta en 60 piezas totales y en 30 por partida, sin decirlo.

**Dónde.** `src/datos/espacio.js:129` (`tope = 60`) y `141` (`Math.min(pt.cantidad || 1, 30)`).

**Cómo lo reproduje.** `node scratchpad/audit-3.mjs`, caso A: una cotización de 50 sillas + 40 estaciones (90 piezas) →

```
expandirPiezas devuelve 60 · por partida: p1=30, p2=30
```

**Por qué importa.** Un proyecto grande (que es donde el acomodo vale más) se acomoda a medias y la pantalla dice "Ya acomodamos los **60** muebles de tu cotización". La red parcial existe: el resumen por área los manda a "Sin ubicar en el plano" (`resumen.js:81-96`), así que el dinero no se pierde — pero el proyectista no sabe por qué faltan.

**Arreglo propuesto.** Devolver el recorte y decirlo, tal como ya se hace con las gavetas bajo cubierta (`Acomodo.jsx:541`):

```js
export function expandirPiezas(partidas, tope = 60) { … return { piezas: out, recortadas: total - out.length }; }
// y en pantalla: "Hay N piezas más que no entran en el acomodo automático; acomódalas a mano o divide el proyecto."
```

Y subir el tope: la malla con sumas acumuladas aguanta bastante más de 60 piezas sin problema.

---

## 15 · MENOR — La comprobación de circulación de la malla se calcula y se tira a la basura

**Qué está mal.** `acomodarEnForma` hace un BFS desde las puertas para saber si se llega caminando a cada mueble (`malla.js:365-399`) y devuelve una auditoría de 8 renglones. `acomodarPorCuartos` **sólo se queda con `r.colocacion`** y arma su propia auditoría de 5 renglones que no incluye la circulación.

**Dónde.** `src/datos/planner.js:233` (`const r = acomodarEnForma(c.a, c.asignadas);` → sólo se usa `r.colocacion`) y `planner.js:261-265`.

**Por qué importa.** El trabajo mejor hecho de todo el motor —el único chequeo que de verdad mide algo por cuarto— nunca llega a la pantalla. Y como bonus, la línea `malla.js:411` marca `ok: true` para "sin puertas en el plano, no se pudo comprobar": un ✓ verde para algo que no se revisó.

**Arreglo propuesto.** Acumular las auditorías por cuarto y agregarlas al resultado, nombrando el cuarto:

```js
// planner.js, dentro del bucle de cuartos
const circ = r.auditoria.find((x) => x.check.startsWith('Se llega caminando'));
if (circ && !circ.ok) notas.push(`${c.a.nombre}: ${circ.detalle}`);
audCuartos.push({ ...circ, check: `${c.a.nombre} · se llega caminando` });
```

Y cambiar `malla.js:411` a `ok: null` (renglón gris "no revisado") en vez de `ok: true`.

---

# LO QUE SÍ FUNCIONA BIEN

No todo está mal; hay trabajo fino que hay que reconocer y no romper.

- **El empacador sobre malla (`malla.js`) es sólido.** Rasteriza a 10 cm, usa sumas acumuladas para consultar rectángulos en O(1), respeta el polígono real del cuarto y esquiva columnas y escaleras con 25 cm de paso. Medido: en la planta en L con columna (`audit-geom.mjs` CASO 3), **0 piezas fuera del polígono y 0 chocando con la columna**.
- **La mesa de juntas queda centrada de verdad.** `audit-geom2.mjs` caso C: mesa de 3.00 × 1.20 en sala de 5.00 × 4.00 → márgenes 0.95 / 1.05 / 1.35 / 1.45 m. Un proyectista firma eso.
- **"Escritorio viendo a la puerta" funciona en los cuatro casos.** Con la puerta arriba, abajo, a la izquierda o a la derecha, el coseno hacia la puerta sale entre 0.60 y 0.99. El truco de elegir el frente **después** de colocar (0 vs 180) es correcto y elegante.
- **"Gavetas pegadas al escritorio, nunca sueltas" está codificada como filtro duro**, no como preferencia, con reintento sin la exigencia antes de darla por perdida (`malla.js:229, 333-334`). Es exactamente cómo se implementa una regla de negocio.
- **Cuando de plano no cabe, lo dice.** Open de 20 m² con 20 puestos: coloca 4, **no encima ninguno, ninguno se sale**, y avisa "16 pieza(s) no caben en el plano" (`audit-geom.mjs` CASO 2). Ésa era la prueba de honestidad y la pasa.
- **`huellaReal` es idempotente de verdad.** Los dos candados (nombre con "· ocupa A × B m" y medida ya de bloque) funcionan: `App LT · Banca doble 8 usuarios` da 5600 × 1400 tanto si el nombre ya trae el bloque como si no. El bug viejo de la doble expansión está bien cerrado.
- **Los cuartos anidados se deducen por geometría** (≥85% contenido) y no sólo por lo que declare el modelo (`planoLeido.js:123-140`). Es lo correcto y evita reportar tres traslapes falsos.
- **`revisarAreas` sí reporta lo que ve**: traslapes en m², cuartos fuera del envolvente y suma de áreas mayor que la planta. Y las notas se enseñan **antes** de acomodar (`Acomodo.jsx:219-220`).
- **El acomodo a mano funciona, todo.** Probado en el navegador, uno por uno: arrastre continuo (sí es arrastre, ya no toque-y-toque), selección con menú pegado al mueble, girar (2100×900 → 900×2100 y el arco de la silla rota a 90°, o sea el **frente sí cambia**), quitar, "Vaciar el plano", "Que lo acomode Voni otra vez" (recupera las 17 piezas), **Deshacer** (regresa exactamente un paso) y Ctrl/Cmd+Z.
- **El guardado solo funciona.** El espía de `humo.jsx` registró 7 guardados silenciosos; no se pierde el trabajo al cambiar de pestaña.
- **La propuesta al cliente no hereda la mentira.** El resumen por área (`resumen.js`) se arma desde `plan.colocacion` en vivo, y lo que no está colocado cae en "Sin ubicar en el plano" con su importe. O sea: el panel verde miente en pantalla, pero el PDF del cliente no.
- **`footprintDe` prefiere la cubierta al tablero más grande** (`lineas.js:151-174`). Ese comentario sobre la credenza Cirque que salía de 1.50 m de fondo describe un bug real bien resuelto.

---

# ORDEN SUGERIDO PARA ATACARLO

1. **Hallazgo 1** (auditoría fija) — una función `revisarAcomodo()` que además cubre el hallazgo 4. Es un día de trabajo y quita la mentira de la pantalla.
2. **Hallazgo 2** (16 cm en el camino por omisión) — dos constantes. Media hora.
3. **Hallazgo 3** (puertas del dibujo) — seis líneas en `DibujarPlano.jsx`. Desbloquea circulación, orientación y barrido de golpe.
4. **Hallazgo 7** (puestos a la mitad) — una función de diez líneas; es el número que se le dice al cliente.
5. **Hallazgo 5** (cuarto dentro de cuarto) — afecta el dinero del resumen por área.
6. **Hallazgo 6** (áreas perdidas en silencio).
7. **Hallazgos 8, 10, 11, 12, 13** — reglas muertas, holgura contra el muro, forma del anidado, cruz/L, celular.
8. **Hallazgos 9, 14, 15** — comodidad y honestidad de los avisos.
