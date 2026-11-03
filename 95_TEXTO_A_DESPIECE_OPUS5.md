# 95_TEXTO_A_DESPIECE_OPUS5 — interpretación IA real (§3/§4, 2026-11-03)

Presupuesto opus-5 autorizado por Dirección ("sii hazlo", 2026-11-03), gasto ACOTADO. 1 llamada real a `analizar-mueble`
(modo texto, model `claude-opus-5`) con el proyecto EXACTO del directivo §3.

## Entrada (brief §3, verbatim)
"Oficina ejecutiva con escritorio de 180 × 75 × 75 cm, credenza de 160 × 45 × 75 cm, mesa de juntas para seis personas,
seis sillas y almacenamiento. Acabado nogal y estructura metálica negra."
+ catálogo de 6 candidatos REALES de Producto Maestro (App LT escritorio directivo/gerencial, mesas de juntas, archivero).

## Resultado (HTTP 200, 71.6 s)
`ok:true`, `propuesta` con 18 piezas, `design_intent`, `semantic_role` por pieza, `preguntas` (lo que la IA necesita
confirmar), `materiales`, `confianzaGeneral`. Despiece estructurado y realista:

- **Escritorio:** cubierta 1800×750, faldón 1600×300, estructura PTR negro ×8, pintura en polvo negra.
- **Credenza:** cuerpo (laterales/piso/techo/respaldo) ×4, cubierta 1600×450, frentes (puertas/cajones) ×2, entrepaño ×2,
  base metálica ×4.
- **Mesa de juntas:** cubierta 2400×1100 **partida en 2 tramos** (realismo de fabricación: no hay tablero de 2400), bases
  metálicas ×14, caja eléctrica.
- (+ sillas / almacenamiento hasta 18 piezas.)

Interpretó bien: dimensiones (180 cm → 1800 mm), material (nogal → piezas de tablero; metálica negra → PTR + pintura polvo),
roles de oficio (cubierta/faldón/estructura/puerta/entrepaño/pata/herraje), y la realidad de fabricación (cubierta grande = 2 tramos).

## Seller-safe
Las 18 piezas NO llevan economía (ningún `costo`/`precio`/`margen` por pieza). La palabra "costo" aparece sólo en el texto
narrativo del `informe` (contexto Dirección, que SÍ ve costos), no como un valor sobre una pieza. El despiece es la BOM, sin
economía embebida — la economía la pone el motor después, server-side.

## Veredicto §3/§4 (paso de interpretación)
**foto/texto → despiece: PROBADO con opus-5 real.** La IA convierte un brief en lenguaje natural en un despiece estructurado,
dimensionado, con roles y materiales, listo para costear. Éste era el paso bloqueado por presupuesto.

## Lo que sigue para "foto → COSTO completo" (y por qué hoy es fail-closed, correcto)
1. El despiece se normaliza (`mapIaComps`) y cada pieza se **amarra a un insumo del catálogo** por atributos.
2. Se manda a `costear-servidor`, que recostea server-side. **Si un material no está confirmado → `estado:incompleto`,
   `precioVenta:null`** (ya demostrado en `95_P0COSTEO_CONCURRENCIA.md`: el servidor NO inventa precio). Un costo OFICIAL
   exige materiales confirmados por un humano (Compras/Dirección) — ése es el gate, no un defecto.
3. Por eso un "foto → número oficial" de punta a punta depende de la **confirmación humana de materiales** del proyecto,
   que es una decisión de Compras/Dirección, no del agente. La CAPACIDAD de interpretar y costear está probada; el número
   oficial espera la confirmación de materiales.

## Costo de la prueba
1 llamada opus-5 (~72 s). Gasto acotado como se autorizó. No se repitió ni se ejecutó el barrido de 24 proyectos (eso sí
consumiría presupuesto grande; se hace cuando Dirección lo autorice con alcance).
