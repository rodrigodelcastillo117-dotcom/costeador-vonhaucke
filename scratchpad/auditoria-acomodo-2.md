# Auditoría 2 · LECTOR DE PLANOS y ACOMODO — verificación de los arreglos
**Costeador Von Haucke · 2026-08-16 · proyectista senior · cuatro lentes (¿truena? ¿sirve? ¿es creíble? ¿mejorable?)**

Nada de esto se aplicó. No se corrió `deploy.sh`. No se tocó `src/`. Ningún plano de cliente salió de esta máquina.

**Cómo se probó**
- Motor en frío, con scripts de medición geométrica (en el scratchpad de sesión): `huella-24.mjs` (barrido de las 24 líneas), `geom2.mjs` y `geom3.mjs` (separaciones y márgenes reales).
- Pantalla, en `http://localhost:5175/humo.html`, midiendo por DOM (`innerHTML`, nunca `innerText`) con `PointerEvent` reales: colocar, girar, quitar, vaciar, deshacer.

---

## Resumen de una línea

**De los cuatro arreglos, uno quedó bien (los puestos), uno quedó a medias (la huella) y dos se aplicaron en la rama equivocada — y en el camino la auditoría honesta introdujo un `ReferenceError` que deja la pantalla del acomodo COMPLETAMENTE MUERTA en el flujo por omisión.** El cartel verde sigue mintiendo palabra por palabra igual que en la auditoría anterior, porque el arreglo se escribió en el camino de 1 clic (el que truena) y no en el multi-cuarto (el que corre).

| # | Lo que se dijo que cambió | Veredicto medido |
|---|---|---|
| 1 | "La auditoría ya no es una constante" | ❌ **Sigue mintiendo.** Se arregló sólo el camino que truena; el que corre conserva 4 `ok:true` a mano y nunca se recalcula |
| 2 | "PER y GX salen de `regla('circulacion_min')`" | ❌ **En la rama muerta.** El camino que corre deja 500 mm entre banca y archivero |
| 3 | "`footprintDe` ya no agarra la tapa" | ⚠️ **A medias.** 5 de 118 productos siguen resolviendo por tapa; la credenza Eclipse sale de **2.40 × 0.20 m** |
| 4 | "Los puestos se contaban a la mitad" | ✅ **Correcto** para bancas dobles (22 vs 12) — pero falla en 5 de 9 casos probados |

---

# HALLAZGOS · de más a menos grave

---

## 1 · BLOQUEANTE — La pantalla del acomodo está MUERTA: `ReferenceError: GX is not defined`

**Qué está mal.** La auditoría nueva del camino 1-clic lee dos variables que no existen en ese ámbito. `PER` y `GX` se declaran **dentro** de `empacarTodoGarantizado` (línea 78) y se leen **fuera**, dentro de `acomodarLocal` (líneas 131 y 133). `GX` revienta; y aunque no reventara, `PERIM` sí existe pero es la constante de módulo de **700 mm** (línea 13), no el `PER` de 900 que de verdad se usó — o sea que el renglón reportaría ✗ para algo que sí cumple.

**Dónde.**
- `src/datos/planner.js:133` — `ok: GX >= circulacion` → `GX` no está en ese ámbito.
- `src/datos/planner.js:131` — `ok: PERIM >= circulacion` → compara la constante muerta (700), no el `PER` (900) que se usó.
- `src/datos/planner.js:78` — `const PER = CIRC, GX = CIRC;` es **local** a `empacarTodoGarantizado`.
- `src/componentes/Acomodo.jsx:150` — `catch` lo convierte en un banner rojo y deja `plan` en `null`.
- `src/componentes/Acomodo.jsx:146` — `const auto = !planReal && areasMM.length <= 1;` → **éste es el caso normal de toda cotización sin plano**.

**Cómo lo reproduje.**

```
$ node --input-type=module -e "
import { acomodarLocal } from './src/datos/planner.js';
acomodarLocal([{nombre:'Mi espacio',ancho:8000,largo:6000}],
  [{id:'e1',nombre:'Escritorio',w:1500,d:750,tipo:'escritorio'}], {ajustar:true});"

*** TRUENA: ReferenceError GX is not defined
    at acomodarLocal (src/datos/planner.js:133:47)
```

Y en el navegador, `humo.html` → tarjeta *Acomodo 3D*, leído del DOM:

```
alerta roja: "No se pudo acomodar: GX is not defined"
svg.plano en la página: 0
```

**Cero planos dibujados.** Como `plan` se queda en `null`, todo el bloque `{plan && (…)}` (`Acomodo.jsx:609-748`) no se monta: no hay planta, no hay 3D, no hay "Acomodar a mano", no hay paleta, no hay Vista realista, y no hay nada que guardar en la propuesta.

**Por qué importa.** El vendedor cotiza, pica "El espacio" y ve un renglón rojo con una palabra de programador. La Fase 2 completa de la app —lo que la diferencia de una hoja de cálculo— no existe hoy para ninguna cotización nueva sin plano. Sobreviven sólo los acomodos ya guardados (`Acomodo.jsx:161`) y los que vienen de "Subir plano" o "Dibujar mi oficina" (esos pasan `ajustar:false` y esquivan la rama). Es el primer clic del flujo por omisión: lo topa hoy, el primero que entre.

**Parche (no aplicado).** Que la auditoría la arme quien tiene los números, no quien los adivina:

```js
// planner.js — empacarTodoGarantizado devuelve también lo que usó
  return { out, W: Math.round(W), L: Math.round(L), PER, GX };

// planner.js:120
    const { out, W, L, PER, GX } = empacarTodoGarantizado(base, piezas, true);
// planner.js:131-134
      { check: 'Circulación perimetral', ok: PER >= circulacion,
        detalle: `${(PER / 1000).toFixed(2)} m contra muros (la regla pide ${(circulacion / 1000).toFixed(2)} m)` },
      { check: 'Circulación entre filas', ok: GX >= circulacion,
        detalle: `${(GX / 1000).toFixed(2)} m entre muebles (la regla pide ${(circulacion / 1000).toFixed(2)} m)` },
```

**Red que faltó y que hay que poner.** Esto lo hubiera cachado un solo caso de prueba. `src/datos/espacio.test.js` existe pero **no hay ni una prueba de `acomodarLocal`**. Mínimo:

```js
// planner.test.js
it('el camino 1-clic devuelve un plan sin reventar', () => {
  const r = acomodarLocal([{ nombre:'X', ancho:8000, largo:6000 }],
    [{ id:'a', nombre:'Escritorio', w:1500, d:750, tipo:'escritorio' }], { ajustar:true });
  expect(r.colocacion.length).toBe(1);
  expect(r.auditoria.every((a) => typeof a.ok === 'boolean')).toBe(true);
});
```

---

## 2 · CRÍTICO — El cartel verde sigue mintiendo, exactamente igual que la vez pasada

**Qué está mal.** El arreglo de la auditoría se escribió **sólo en el camino de 1 clic**. El camino multi-cuarto (`acomodarPorCuartos`) —el que corre para todo plano subido, todo plano dibujado y toda cotización con más de un área— conserva **cuatro `ok: true` escritos a mano**. Y, como antes, `plan.auditoria` se calcula una vez y no se vuelve a tocar cuando el proyectista mueve, gira, quita o vacía.

**Dónde.**
- `src/datos/planner.js:279-282` — cuatro renglones `ok: true` fijos ('Cada mueble dentro de su cuarto', 'Nada encimado', 'Baños y servicios sin amueblar', 'Reparto por criterio').
- `src/datos/malla.js:403-411` — cinco más, incluido **`{ check: 'Se llega caminando desde la puerta', ok: true, detalle: 'sin puertas en el plano, no se pudo comprobar' }`**: un ✓ verde que dice por escrito que no revisó nada.
- `src/componentes/Acomodo.jsx:282` — `editarColocacion` sigue reemplazando sólo `colocacion`.
- `src/componentes/Acomodo.jsx:624-635` — el panel pinta `plan.auditoria` tal cual.

**Cómo lo reproduje** (navegador, medido por DOM). Agregué una segunda área para esquivar el crash del hallazgo 1, acomodé, entré a *Acomodar a mano* y piqué **Vaciar el plano**:

```
"0 en el plano · 17 por poner"
alerta:  "⚠ Faltan 17 mueble(s) por colocar."
resumen: "Los 17 muebles quedan repartidos por cuarto: Mi espacio: 1 mesas de juntas, 2 estaciones…"
Voni revisó:
  ✓ Todas las piezas colocadas · 17 de 17     ← con CERO muebles en el plano
  ✓ Cada mueble dentro de su cuarto · la malla sólo ocupa celdas del área
  ✓ Nada encimado · la malla no reutiliza celdas
  ✓ Baños y servicios sin amueblar · 0 cuarto(s) de servicio respetados
  ✓ Reparto por criterio · …
```

Después solté **dos bancas dobles de 7.50 × 1.20 m exactamente en el mismo punto** (ambas quedaron en `@0,1400`, traslape perfecto de 9 m²):

```
"2 en el plano · 15 por poner"
lista de problemas:  "Encimado: Banca doble APP LT 1.50 · 10 usuarios"   ← el chequeo SÍ lo ve
Voni revisó:
  ✓ Nada encimado · la malla no reutiliza celdas                          ← y el panel verde lo niega
  ✓ Todas las piezas colocadas · 17 de 17
```

En frío da lo mismo: `node scratchpad/geom2.mjs`, caso B → `["OK Todas…","OK Cada mueble dentro de su cuarto","OK Nada encimado","OK Baños…","OK Reparto…"]`.

**Por qué importa.** Es el mismo hallazgo #1 de la auditoría anterior, con la misma frase en pantalla, y ahora además **se contradice consigo mismo en el mismo renglón**: la alerta de arriba dice "faltan 17" y el panel de abajo dice "17 de 17 ✓". La app tiene dos verificadores, uno que mide (`chequeo`) y otro que recita (`plan.auditoria`), y le enseña los dos al proyectista sin decirle cuál creer. El que recita es el que lleva palomita verde y el nombre de Voni.

**Parche (no aplicado).** El mismo de la vez pasada, y ahora es más urgente: sacar la auditoría del `plan` y volverla una función pura que se recalcule con cada cambio.

```js
// nuevo src/datos/revision.js
export function revisarAcomodo(areasMM, colocacion, byId) { /* mide: traslapes,
   polígono, obstáculos, barrido de puerta, circulación BFS, holgura por tipo */ }

// Acomodo.jsx — en lugar de plan.auditoria
const auditoria = useMemo(() => revisarAcomodo(areasMM, plan?.colocacion || [], byId), [areasMM, plan, byId]);
```

Y **la regla de oficio**: ningún renglón puede ser un literal `ok: true`. O se mide, o se pinta gris con `ok: null` ("no revisado"). En particular `malla.js:411` tiene que dejar de dar ✓ a "no se pudo comprobar".

---

## 3 · GRAVE — La circulación de 90 cm no se cumple en el camino que sí corre

**Qué está mal.** El arreglo de `PER`/`GX` está dentro de `empacarTodoGarantizado`, que sólo lo usa la rama de 1 clic — la que truena. El acomodo que de verdad se ejecuta (`acomodarPorCuartos` → `malla.js`) nunca vio ese cambio, y además incumple **su propia** tabla de holguras.

**Dónde.** `src/datos/planner.js:77-78` (arreglo confinado a esa función) · `src/datos/malla.js:33-42` (`usoDe`) · `src/datos/malla.js:192, 206` (`celdas(pw + holgura)`).

**Cómo lo reproduje.** `node scratchpad/geom3.mjs` — mide sólo los pasos REALES (pares de muebles que se enfrentan, es decir que se traslapan en el eje perpendicular; ése es el hueco por el que camina una persona):

```
regla circulacion_min = 900 mm · piezas colocadas 15

PASOS ENTRE MUEBLES QUE SE ENFRENTAN (29 pares):
  por debajo de la regla: 8 de 29
    500 mm  <<< VIOLA  Banca doble APP LT 1.50 · 10 u  ‖  Archivero 2 gavetas
    500 mm  <<< VIOLA  Banca doble APP LT 1.50 · 10 u  ‖  Archivero 2 gavetas
    500 mm  <<< VIOLA  Banca doble APP LT 1.50 · 10 u  ‖  Archivero 2 gavetas
    500 mm  <<< VIOLA  Banca doble APP LT 1.50 · 10 u  ‖  Archivero 2 gavetas
    550 mm  <<< VIOLA  Banca doble APP LT 1.50 · 10 u  ‖  Archivero 2 gavetas
    550 mm  <<< VIOLA  Archivero 2 gavetas  ‖  Archivero 2 gavetas
    625 mm  <<< VIOLA  Silla de visita  ‖  Silla de visita
    825 mm  <<< VIOLA  Archivero 2 gavetas  ‖  Silla de visita
```

Y contra la holgura que **el propio motor declara por tipo** (900 juntas / 1000 escritorio / 600 guarda / 450 los demás), no contra los 900 de la regla general:

```
pasos enfrentados: 29 | por debajo de la holgura que el PROPIO motor declara: 6 | el peor: 500 mm
```

**Lo que sí está bien y no hay que "arreglar":** el margen de 100 mm contra el muro **es correcto**. `ZOCALO = 100` (`malla.js:22`) es a propósito: un archivero va pegado a la pared, no a 90 cm de ella. Los 12 de 15 muebles a menos de 900 mm del muro son buen oficio, no un bug. La circulación se mide entre muebles y hacia la puerta, no contra el muro que tienen atrás.

**Por qué importa.** 50 cm entre una banca de 10 puestos y un archivero: no se abre el cajón, y quien está sentado no se levanta sin mover la silla. Y el motor incumple ahí su **propia** cifra de `holgura_guarda` (600 mm), que es lo que hace el arreglo difícil de confiar: no es que la regla esté mal calibrada, es que no se está aplicando donde el bloque topa por el costado. Encima el panel corona esto con "✓ Espacio de uso respetado", sin haber medido un solo par.

**Parche (no aplicado).** Dos cosas:

```js
// 1) malla.js — la holgura tiene que quedar en AMBOS costados del eje corto,
//    no sólo a la derecha/abajo, o dos bloques vecinos comparten sólo una mitad.
const iw = celdas(pw + holgura), jh = celdas(ph + holgura);
//    -> al colocar, centrar la huella dentro del bloque reservado:
const dx = Math.round((iw * CELDA - pw) / 2), dy = Math.round((jh * CELDA - ph) / 2);
//    (hoy la pieza se pega a la esquina i,j y toda la holgura queda de un lado)

// 2) y que el renglón se MIDA, no se declare:
{ check: 'Espacio de uso respetado', ok: peorPaso >= minHolgura,
  detalle: `el paso más angosto mide ${(peorPaso/1000).toFixed(2)} m` }
```

---

## 4 · GRAVE — La huella por "tapa" no está cerrada: la credenza Eclipse mide 20 cm de fondo

**Qué está mal.** El arreglo cambió `.find()` por "la de más área", y agregó `mayorPor(/cubierta|superficie/) || mayorPor(/tapa/)`. Eso cierra el caso donde **conviven** una cubierta y una tapa. Pero cuando el despiece **no nombra ninguna cubierta**, el código cae al patrón `/tapa/i` — y ahí vuelve a pasar exactamente lo que se quería evitar.

**Dónde.** `src/datos/lineas.js:157-163` — `const cubierta = mayorPor(/cubierta|cubiert|superficie/i) || mayorPor(/tapa/i);`

**Cómo lo reproduje.** Barrido de las **24 líneas × 118 productos × 533 variantes de medida** (`node scratchpad/huella-24.mjs`) y luego el detalle del despiece:

```
productos cuya huella la decide una TAPA (no hay cubierta): 5 de 118

  eclipse/credenza   Eclipse Credenza baja 2.40 × 0.60 m
      usa tapa 2400x200 ("Tapa de registro")   en vez de 2400x600   <<< MAL
  spine/ducto        Spine · Ducto individual 1.20 m
      usa tapa 1200x137 ("Pintura electrostática tapas frontales")  en vez de 1200x380   <<< MAL
  spine/configuracion  Spine · Configuración Lineal · 2 ductos
      usa tapa 1200x137   en vez de 1200x380   <<< MAL
  mox/rodante        Mox · Gaveta rodante 2 cajones
      usa tapa 380x460    en vez de 580x460    (aquí la tapa SÍ es la cubierta: correcto)
  mox/pedestal       Mox · Gaveta pedestal 3 cajones
      usa tapa 380x456    en vez de 720x456    (correcto)
```

El despiece de la credenza, ordenado por área, deja ver el error a simple vista:

```
1.260 m²  2100x600  "Credenza · piso/techo"     <- ESTA es la huella
1.239 m²  2100x590  "Credenza · respaldo"
0.420 m²  2100x200  "Tapa de registro"          <- la que gana hoy
```

Y el resto del barrido, para que quede el dato: **46 huellas marcadas como inverosímiles sobre 533 variantes**, casi todas por mala clasificación de tipo, no por la huella (ver hallazgo 5). Las bancas largas (8.40 m, 9.00 m) **son correctas**: una banca doble de 12 usuarios a 1.50 mide 9 m de largo de verdad.

**Por qué importa.** Una credenza de 2.40 × **0.20** m en el plano es una repisa flotante: el acomodo la mete en cualquier rendija de 20 cm, el 3D se la enseña al cliente como una moldura, y en obra llega un mueble de 60 cm de fondo que ya no cabe donde se dibujó. Es el mismo daño que la mesa de juntas de 15 cm que motivó el arreglo, sólo que en otro producto.

**Parche (no aplicado).** No caer a `/tapa/` a ciegas: aceptarla sólo si su fondo es creíble para un mueble de piso, y si no, dejar que gane la pieza de más área con fondo válido (que es lo que ya hace el paso 2).

```js
// lineas.js:163
const FONDO_MIN_CUBIERTA = 300;   // menos de 30 cm no es una cubierta, es un canto
const cand = mayorPor(/cubierta|cubiert|superficie/i)
  || (() => { const t = mayorPor(/tapa/i);
        return t && Math.min(t.largoMM, t.anchoMM) >= FONDO_MIN_CUBIERTA ? t : null; })();
if (cand) return { w: cand.largoMM, d: cand.anchoMM };
```

Con eso la credenza Eclipse cae al paso 2 y sale 2400 × 600 (correcto), las Mox siguen saliendo por su tapa (456 y 460 ≥ 300, correcto) y el ducto Spine cae a 1200 × 380 (correcto).

---

## 5 · GRAVE — `tipoDe` mete cajas eléctricas y ductos en la cuenta de puestos de trabajo

**Qué está mal.** El arreglo de los puestos (contar doble cuando el fondo ≥ 1000 mm) **es correcto y hay que reconocerlo**: en el navegador, con dos bancas dobles de 10 usuarios, el panel dice **20 puestos** donde antes decía 10. Pero sigue siendo una estimación geométrica sobre un nombre que ya trae el número escrito, y arrastra un error más viejo: `tipoDe` clasifica como `escritorio` cualquier cosa cuya ruta diga `via`, `rio`, `app`… o cuyo nombre diga `ducto`.

**Dónde.** `src/componentes/Acomodo.jsx:515-520` (el contador) · `src/datos/espacio.js:53-56` (`tipoDe`).

**Cómo lo reproduje.** Réplica exacta de la fórmula de `Acomodo.jsx:515-520` sobre la salida real de los generadores:

```
producto                                       huella        dice real
Eclipse Escritorio Qvadrat 1.80 m              1800x1800     2    1   <<< DE MÁS
Vía · Caja eléctrica sin cablear (VIMOSOCUSAC) 392x190       1    0   <<< DE MÁS
Spine · Ducto individual 1.20 m                1200x137      1    0   <<< DE MÁS
Banca sencilla APP LT 1.05 · 8 usuarios        8400x600      6    8   <<< DE MENOS
Banca sencilla APP LT 1.80 · 8 usuarios        14400x600     10   8   <<< DE MÁS
Banca doble APP LT 1.50 · 10 usuarios          7500x1200     10   10  ✓
Banca doble APP LT 1.20 · 4 usuarios           2400x1200     4    4   ✓
Escritorio APP LT 1.50 × 0.75                  1500x750      1    1   ✓
Cirque · Banca sencilla 6 puestos · 1.20×0.60  7200x600      5    6   <<< DE MENOS
```

**5 de 9 mal.** Una caja eléctrica de 39 × 19 cm cuenta como un puesto de trabajo. Un escritorio Qvadrat de una persona cuenta como dos (porque su fondo de 1.80 m dispara la regla del "bench doble"). Una banca sencilla de 8 usuarios cuenta 6 o 10 según el largo del módulo.

**Por qué importa.** Los "N puestos · X m² por persona" es el número con el que el proyectista decide si todavía caben más estaciones, y el que se le dice al cliente. Con 7 cajas eléctricas en la cotización sube 7 puestos que no existen y el m²/persona cae al rango "vas apretado" sin motivo. Y el dato bueno ya está escrito en el nombre del mueble: se está estimando algo que no hace falta estimar.

**Parche (no aplicado).** Leer los usuarios del nombre (es la misma expresión de `huellaReal`, `espacio.js:101`) y dejar la geometría sólo como último recurso; y sacar de la cuenta lo que no es un puesto:

```js
// Acomodo.jsx — sustituye el reduce de 515-520
const NO_ES_PUESTO = /caja el[eé]ctrica|ducto|canaleta|soporte|portamonitor|multicontacto/i;
const usuariosDe = (p) => {
  if (NO_ES_PUESTO.test(p.nombre || '')) return 0;
  const s = (p.nombre || '').toLowerCase();
  const m = /(\d+)\s*(?:puesto|plaza|persona|posicion|usuario)s?\b/.exec(s) || /(\d+)\s*u\b(?!\w)/.exec(s);
  if (m) return Math.max(1, +m[1]);                       // el nombre ya lo dice
  const largo = Math.max(p.w, p.d), fondo = Math.min(p.w, p.d);
  return Math.max(1, Math.round(largo / 1500)) * (fondo >= 1000 && largo >= 2500 ? 2 : 1);
};
const puestos = piezas.filter((p) => p.tipo === 'escritorio' && colocadasIds.has(p.id))
  .reduce((n, p) => n + usuariosDe(p), 0);
```

(El `&& largo >= 2500` es lo que evita que un Qvadrat cuadrado de una persona cuente doble.)

---

## 6 · GRAVE — Sigue abierto: la revalidación tras mover sólo ve el rectángulo, y cuenta nombres en vez de piezas

**Confirmado sin cambios** desde la auditoría anterior. `src/componentes/Acomodo.jsx:486-532`:

- línea 497 — `b.x1 > a.ancho + tol` → la **caja** del cuarto, nunca `a.poly`;
- líneas 499-503 — sólo pares mueble-mueble;
- línea 505 — `[...new Set(fuera)]` → ocho piezas fuera con tres nombres distintos siguen contando **3**;
- no hay comprobación contra `a.obstaculos` ni contra `a.puertas`.

Se ve en la prueba del hallazgo 2: las dos bancas encimadas produjeron **un solo** renglón "Encimado", no dos. En una planta orgánica (el caso que motivó `planoLeido.js`) el hueco de la L y el patio caen dentro de la caja envolvente: ahí se puede soltar media oficina en el vacío y la app calla. **Mismo parche que el hallazgo 2**: una sola `revisarAcomodo()` que sustituya al `chequeo` actual y use `dentroPoly` (ya exportada en `malla.js:51`).

---

## 7 · GRAVE — Sigue abierto: cuarto dentro de cuarto → el mueble se guarda en el cuarto equivocado

**Confirmado sin cambios.** `src/componentes/PlanoAcomodo.jsx:170-176`:

```js
function areaDe(x, y) {
  for (let i = 0; i < areas.length; i++) { ... if (dentro de la caja) return i; }
  return null;
}
```

Sigue devolviendo la **primera** caja que contiene el punto, sin polígono y sin preferir la más chica. La mesa de consejo soltada en la sala circular que está en medio del open space se dibuja bien pero se registra en el open space, y de ahí sale el resumen por área de la propuesta (`src/datos/resumen.js:44-51`): el cliente recibe una cotización que le cobra la mesa y las 12 sillas dentro de "Open space" y la sala de juntas aparece vacía. **Es un error que se ve en el papel que firma el cliente.** El parche propuesto en la auditoría anterior sigue vigente palabra por palabra.

---

## 8 · MEDIO — Sigue abierto: las puertas que dibuja el proyectista se tiran

**Confirmado sin cambios.** `grep -n "puertas" src/componentes/DibujarPlano.jsx` no devuelve nada; sólo sobrevive el conteo (`DibujarPlano.jsx:182` → `doors: doors.length`) para el prompt del render. `Acomodo.jsx:234-250` (`usarDibujo`) tampoco las pasa.

El efecto se midió en el hallazgo 3: con la malla corriendo sin puertas, la auditoría escupe

```
✓ Puertas libres · el plano no traía puertas
✓ Se llega caminando desde la puerta · sin puertas en el plano, no se pudo comprobar
```

dos palomitas verdes por dos cosas que no se revisaron. Sin puertas mueren tres capacidades que ya están escritas y probadas en `malla.js`: la orientación del escritorio (`malla.js:341`), el BFS de "se llega caminando" (`malla.js:365-399`) y el barrido de la hoja. **El camino que Rodrigo pensó como el más fácil —"dibuja tu oficina"— es justo el que deja al motor ciego.** Parche: el de la auditoría anterior (repartir cada puerta al cuarto cuyo muro toca, ~6 líneas).

Nota: sí hay una vía viva — el menú *Poner en el plano → Puerta* de `Acomodo.jsx:317-338` guarda `a.puertas` correctamente, y `aMM` (`Acomodo.jsx:61`) las manda al motor. Pero eso obliga a re-dibujar a mano puertas que el proyectista ya había puesto en el lienzo.

---

## 9 · MEDIO — Sigue abierto: reglas escritas que nadie aplica

**Confirmado.** El motor sigue leyendo **tres** claves:

```
$ grep -rn "regla(" src --include="*.js" --include="*.jsx" | grep -v datos/reglas.js | grep -v pdfPropuesta
src/datos/planner.js:77:  const CIRC = regla('circulacion_min') ?? 900;
src/datos/planner.js:127:    const circulacion = regla('circulacion_min') ?? 900;
src/datos/malla.js:36:  const circ = regla('circulacion_min');
src/datos/malla.js:37:  if (tipo === 'juntas') return regla('holgura_juntas');
src/datos/malla.js:38:  if (tipo === 'guarda') return regla('holgura_guarda');
```

Siguen muertas `l_contra_muro`, `sillas_visita_privado`, `pasillo_principal`, `barrido_puerta` (duplicada a mano en `planoLeido.js:38`) y `escritorio_ve_a_puerta` (el número se ignora; `mirandoA` se llama siempre).

**Avance real que hay que anotar:** `reglasTexto()` ya se usa — `src/nube.js:148` le inyecta `reglasTexto('cotizacion')` al cotizador. Falta el ámbito de acomodo: los prompts de `acomodarEspacio` y `leerPlano` siguen sin recibir `reglasTexto('acomodo')`.

Sigue en pie la queja de fondo: la pantalla *Lo que Voni sabe* enseña reglas que Voni no sabe. Rodrigo puede editar "2 sillas de visita por privado", verla en verde, y el plano no cambia.

---

## 10 · MEDIO — Sigue abierto: cambiar el ancho del cuarto no re-acomoda; y topes silenciosos de 60/30

- **Re-acomodo.** `Acomodo.jsx:123-137` (`setArea`) toca `areas` y nada más. Corregir la medida al recibir el levantamiento real es lo primero que hace un proyectista, y la app no reacciona. Parche de la auditoría anterior (ofrecer un botón "Volver a acomodar", no imponerlo).
- **Topes.** `src/datos/espacio.js:129` (`tope = 60`) y `:141` (`Math.min(pt.cantidad || 1, 30)`) siguen recortando sin avisar. Un proyecto grande —donde el acomodo vale más— se acomoda a medias y la pantalla dice "Ya acomodamos los 60 muebles de tu cotización" (`Acomodo.jsx:546`).
- **Áreas perdidas en silencio.** `planoLeido.js:148` y `:212` conservan el mismo `.filter((r) => r.pts && r.pts.length >= 3)` sin reportar los descartados. No hay `sinUbicar` en el archivo.

---

# LO QUE SÍ FUNCIONA (y no hay que romper)

- **El acomodo a mano está completo y sólido.** Probado en el navegador con `PointerEvent` reales y medido por geometría del SVG:
  `colocar` (la banca aparece en `@0,1400`) · `girar` (**`7500x1200` → `1200x7500`**, la huella sí cambia) · `quitar` (`2 en el plano` → `1`) · `Vaciar el plano` (`0 en el plano · 17 por poner`) · **`Deshacer`** (regresa exacto: `1200x7500` vuelve a aparecer y el contador vuelve a `2 en el plano`). El candado de 400 ms contra el doble toque funciona.
- **El contador de puestos ya no se queda a la mitad** en el caso que lo motivó: dos bancas dobles de 10 usuarios dan **20 puestos · 6.6 m² por persona** (antes 10).
- **`chequeo` sí detecta el traslape real** al mover a mano ("Encimado: Banca doble…"). El problema no es que no mida: es que el panel de al lado lo desmiente.
- **`footprintDe` sí cerró el caso principal.** La mesa de juntas App LT sale `1800×1200` (no 152 mm) y la credenza Cirque sale `2400×600` correctamente, ganándole al "Cuerpo credenza" de 2400×1500. 113 de 118 productos resuelven bien.
- **Las bancas largas no son un bug.** 8.40 m para 8 usuarios a 1.05 y 9.00 m para 12 dobles a 1.50 son las medidas reales del bloque.
- **El margen de 100 mm contra muro es oficio, no descuido** (`ZOCALO`, `malla.js:22`).
- **La malla sigue siendo lo mejor del motor**: respeta polígono, esquiva columnas con 0.25 m de paso, centra la mesa de juntas y orienta el escritorio a la puerta. Todo eso sigue intacto.
- **El guardado solo y la restauración del acomodo previo** siguen funcionando (`Acomodo.jsx:161, 170-181`).

---

# LAS 5 MEJORAS QUE HARÍAN EL ACOMODO CONFIABLE
*(ordenadas por esfuerzo/beneficio)*

### 1. Arreglar `GX` y poner la primera prueba de `acomodarLocal` — **15 minutos**
Cuatro líneas en `planner.js:120-134` (hallazgo 1) más un `planner.test.js` de diez renglones. Sin esto no hay pantalla de acomodo que auditar: hoy el flujo por omisión está caído. Es lo único de esta lista que hay que hacer **hoy**.

### 2. Una sola función `revisarAcomodo()` que reemplace a `plan.auditoria` **y** a `chequeo` — **un día**
Resuelve de un golpe los hallazgos 2, 6 y la mitad del 3: mata los nueve `ok:true` literales, mide contra el **polígono** y no contra la caja, ve obstáculos y barrido de puerta, cuenta piezas y no nombres, y se recalcula con cada movimiento porque es un `useMemo`. Regla de casa que hay que dejar escrita: **ningún renglón de la auditoría puede ser un literal `true`; lo que no se midió se pinta gris, no verde.** Es el cambio que convierte la herramienta de "bonita" a "firmable".

### 3. Que los números vengan del dato, no de la geometría — **medio día**
`usuariosDe()` leyendo los puestos del nombre (hallazgo 5) y el candado `FONDO_MIN_CUBIERTA` en `footprintDe` (hallazgo 4). Son las dos cifras que salen impresas: los puestos que se le prometen al cliente y el fondo del mueble que va a llegar a obra. Ambos parches son de menos de diez líneas y ambos dejan de adivinar algo que la app ya sabe.

### 4. Conectar las puertas y el cuarto correcto — **un día**
Las seis líneas de `DibujarPlano.jsx` que reparten las puertas por cuarto (hallazgo 8) y el `areaDe` que prefiere el área **más chica** y respeta el polígono (hallazgo 7). La primera enciende tres capacidades que ya están escritas y probadas en `malla.js` y hoy están apagadas; la segunda arregla el resumen por área de la propuesta, que es dinero mal atribuido en el papel que firma el cliente.

### 5. Que la tabla de reglas mande de verdad — **dos días**
Aplicar `pasillo_principal`, `barrido_puerta`, `sillas_visita_privado`, `l_contra_muro` y `escritorio_ve_a_puerta` (hallazgo 9), y pasarle `reglasTexto('acomodo')` a los prompts de `acomodarEspacio` y `leerPlano`. Va al final porque es el más caro, pero es el que cierra la promesa del proyecto: *"Rodrigo dicta una regla una vez y el sistema la usa sin que nadie se acuerde de copiarla."* Mientras no esté, la pantalla *Lo que Voni sabe* es una lista de buenas intenciones — y una pantalla que promete y no cumple hace más daño que no tenerla.
