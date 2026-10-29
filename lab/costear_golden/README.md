# COSTEAR · Golden PDF/foto/texto → BOM (TELSVH120)

## Qué mide
Qué tan bien el pipeline de COSTEAR deriva el **despiece (BOM)** de un mueble
**nuevo en desarrollo** (sin clave) a partir de la entrada real que da un
vendedor (ficha / foto / texto), comparado contra el despiece que la fábrica
**realmente** produjo.

- **Verdad de manufactura** (`telsvh120_verdad.json`): la Hoja de Manufactura real
  HDM-DOP-DMA-001 de TELSVH120 — 70 renglones: 34 piezas fabricadas (láminas por
  calibre) + 15 capas de proceso (pintura/ensamble) + 21 herrajes/SKU Intelisis.
- **Entrada** (`ficha_telsvh120.txt`): descripción nivel-ficha, **sin clave**, como
  la entrega un vendedor. No contiene el despiece.
- **Scorer** (`scorer.mjs`): empareja por **rol semántico** (no por clave, porque
  un mueble en desarrollo no tiene), con el mismo vocabulario canónico aplicado a
  la verdad y a la extracción. Mide: recall de roles, conteo por rol, **inventadas**,
  y familia de material.

## Framing honesto (leer antes de interpretar el número)
1. **NO es pass/fail.** Es un tablero: mide el GAP y si cada cambio lo acerca o aleja.
2. **El primer número será BAJO, y eso es el punto.** Hoy NO existe un "motor de
   producto" que expanda arquetipo+dimensiones → BOM. La única cosa que produce
   piezas de un mueble sin clave es la extracción del LLM (VONI/analizar-mueble),
   que no tiene plantilla de "vitrina horizontal → 2 omegas, refuerzo tapa, …".
   El número bajo CUANTIFICA cuánto trabajo de motor-de-producto falta para 9.5.
3. **Desde un texto de una línea nadie reproduce 70 renglones** — la info no está en
   la entrada; la diseña ingeniería. Entradas más ricas (ficha con dims/materiales,
   foto, plano) suben el techo recuperable.
4. **Alcance del HDM:** este HDM es la estructura METÁLICA. El `capelo de cristal`
   probablemente no es renglón de este HDM (vive en otro BOM); si la extracción lo
   trae, el scorer lo marca como rol ausente de ESTE HDM (no necesariamente invención).

## Cómo correr
- Auto-test del scorer (determinista, en CI): `npx vitest run lab/costear_golden/scorer.test.js`
- Baseline de extracción: se corre **on-demand** (la extracción es un LLM,
  no-determinista) y su salida se graba como `baseline_extraccion_*.json`; el scoreo
  de esa salida grabada SÍ es determinista. No es gate de CI.

## Pendiente (no hecho aún)
- Grabar una extracción baseline real (edge `analizar-mueble` con auth, o un
  extractor de sala-limpia que no haya visto el HDM) y publicar el primer número.
- Subir de texto → ficha (PDF real) → foto.
- Ampliar a un corpus (5–10 muebles), no un solo mueble.
