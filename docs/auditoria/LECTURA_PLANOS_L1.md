# Bloque L1 · Lectura de planos medida contra un corpus (2026-10-13)

Dirección (13-oct): "los planos que se van a subir más son PDF de buena calidad, con geometría curva… quiero 10 de 10".
Antes de tocar nada se construyó una vara de medir: `lab/planos/gen_corpus.py` genera cinco planos PDF A3 con su hoja de
control y `lab/planos/medir.mjs` los manda al lector (producción `leer-plano` o la copia RC `leer-plano-rc`) y compara.
Producción NO se tocó: todo cambio de lector se desplegó como copia RC (`leer-plano-core-rc`, `leer-plano-rc`).

Corpus: C1 recto 20×12 (7 áreas, 6 puertas, 2 columnas) · C2 curvo 24×14 (lobby con muro curvo r 6 m, sala circular,
trapecio, 3 columnas) · C3 sin cotas numéricas, sólo barra gráfica, 6 columnas · C4 dos niveles en dos páginas ·
C5 planta en L con acceso doble.

Columnas de la tabla: áreas leídas / m² (±8 %) / puestos / asientos / tipo / puertas (±0.6 m) / barridos verificados
(máximo = puertas − dobles) / columnas / envolvente / segundos.

## Producción (`leer-plano` v12 + `leer-plano-core` v5)

| plano | áreas | m² | puestos | asientos | tipo | puertas | barridos | columnas | env | s |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 recto | 7/7 | 7/7 | 7/7 | 6/7 | 6/7 | 6/6 | 4/6 | 0/2 | ✓ | 52 |
| C2 curvo | 6/6 | 6/6 | 5/6 | 5/6 | 6/6 | 5/5 | 4/5 | 0/3 | ✓ | 83 |
| C3 barra gráfica | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 4/4 | 3/4 | 0/6 | ✓ | 52 |
| C4 dos niveles | 4/6 | 3/6 | 2/6 | 4/6 | 4/6 | 2/4 | 1/4 | 0/1 | ✓ | 31 |
| C5 planta en L | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 5/6 | 0/2 | ✓ | 56 |

Lectura: geometría recta, curva, circular, trapezoidal y en L: exacta. Escala desde la barra gráfica: exacta. Dos huecos
reales: **columnas nunca se leen** (el esquema no las pedía) y **documentos con varias plantas se mezclan o se pierden**.
(Dos fallos de la primera corrida eran del corpus, no del lector: una mesa con sillas encimadas y un lobby sin escritorio
dibujado; se corrigieron en el generador.)

## RC (mismo modelo; esquema + prompt + validación por nivel)

RC v1 (columnas, niveles, barra, curvas, puerta doble): columnas 2/2 · 2/3 · 6/6 · — · 2/2; C4 rechazado por el wrapper
(sumaba los m² de las dos plantas contra una envolvente).
RC v2 (suma por nivel, conteo de asientos uno por uno): C4 **6/6 en todo** (niveles separados, columna, puertas por página);
C1 perdió los barridos (el modelo se volvió conservador con la bisagra) y C2 fue rechazado por un "marcador auxiliar" sin ancho.
RC v3 (regla del arco: arco dibujado = bisagra y sentido; sin marcadores como puertas; vano sin ancho = aviso, no rechazo):

| plano | áreas | m² | puestos | asientos | tipo | puertas | barridos | columnas | env | s |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 recto | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 6/6 | 5/6 | 2/2 | ✓ | 54 |
| C2 curvo | (pendiente) | | | | | | | | | |
| C3 barra gráfica | (pendiente) | | | | | | | | | |
| C4 dos niveles | (pendiente) | | | | | | | | | |
| C5 planta en L | (pendiente) | | | | | | | | | |

## Cliente (en la rama, sin desplegar)

- Columnas del lector → obstáculo `columna` del cuarto más chico que las contiene (coordenadas locales, clave P1/P2);
  el solver ya respeta obstáculos. La compuerta dice "N columnas estructurales leídas".
- Documentos con varios niveles: cada área lleva `nivel`; la compuerta avisa y se usa el primer nivel (los demás se
  cotizan como otro proyecto hasta que exista selector, Bloque L2).
- `VITE_LEER_PLANO_FN` apunta el cliente local al lector RC para medir; producción sigue en `leer-plano`.
- Verificado de punta a punta con el plano Torre Norte a través del RC: P1 en CIRCULACIÓN y P2 en OPERATIVA llegan como
  obstáculos; D08 confirmada como doble; acomodo 35/39 (igual que antes: el cuello es el programa, Bloque P1).

## Variabilidad

El mismo PDF leído dos veces no da siempre lo mismo (C1: barridos 5/6 → 0/6 → 5/6 entre corridas con prompts casi
iguales). El laboratorio permanente (Bloque M) debe correr cada plano al menos dos veces y reportar el peor caso.

## Promoción a producción

Pendiente de autorización de Dirección: desplegar `leer-plano-core` y `leer-plano` con el contenido de las copias RC
(rollback: v5 / v12) junto con el cliente de la rama.
