# 95_FOTO_A_DESPIECE_OPUS5 — foto real de mueble → despiece (§3/§4, 2026-11-03)

Camino A, cierre visual. 1 llamada opus-5/visión a `analizar-mueble` (modo imagen) con una **foto real** subida por Dirección:
escritorio directivo en L con credenza, cubierta de nogal, estructura metálica en V, puerta + 2 cajones. Caso DIFÍCIL
(material mixto madera+metal, herrajería, conteo de puertas/cajones) — el de mayor señal.

## Resultado (HTTP 200, 33.7 s)
`ok:true`. Identificación: *"Escritorio directivo en L con credenza lateral — cubierta nogal, cuerpo gris con puerta y 2
cajones, nicho abierto, patas metálicas en V."* (correcto).
Materiales: nogal oscuro, gris grafito, **acero pintado**, herrajes metálicos.

**Despiece: 17 piezas**, con roles de oficio y conteos correctos:
- Cubierta escritorio 1800×800, cubierta credenza 1800×450.
- Laterales/piso/divisiones/repisa credenza (tablero 2440×1220).
- **Frentes puerta + cajones (gris) ×3** (1 puerta + 2 cajones — bien contado), cajas de cajón ×10, paneles de nicho ×2,
  tapacanto ×8.
- **Patas en V ×4 (escritorio) + ×8 (credenza)**, travesaño/estructura ×2, pintura en polvo gris grafito.
- **Herrajes completos:** correderas ×2, bisagras ×2, **jaladeras ×3**, cerradura, niveladores ×8, tornillería.

## Lo decisivo: honestidad sobre lo que NO sabe
- `confianzaGeneral: baja` — no finge certeza con una foto sin escala.
- **Preguntas generadas** para los datos inciertos de mayor impacto: largo escritorio, largo credenza, espesor cubierta;
  cada una con `impacto:alto`, `afecta:costo`, `supuesto:1800`. **No inventó medidas con falsa confianza**: las marcó como
  preguntas que afectan el costo, con su supuesto visible para confirmar. Es la disciplina "nunca afirmar lo que no sabe".

## Seller-safe
Ninguna de las 17 piezas lleva economía (`costo`/`precio`/`margen` por pieza = ninguno). El término "costo" aparece sólo en
los metadatos de las preguntas (`afecta: costo`), no como un valor. El despiece es la BOM, sin economía embebida.

## Veredicto §3/§4 — foto → costo
**foto → despiece: PROBADO con una foto real y difícil.** La IA reconoce el producto, materiales y estructura, cuenta
puertas/cajones/herrajes, y es honesta con su incertidumbre (pregunta medidas, confianza baja) en vez de inventar.
Para el **costo OFICIAL** faltan dos confirmaciones humanas que la propia IA pide: (1) las **medidas** (largo/espesor), (2) la
**confirmación de materiales** contra catálogo. Hasta entonces el servidor devuelve fail-closed (estado incompleto, sin precio),
que es correcto. La CAPACIDAD foto→despiece→costo está probada; el número oficial espera la confirmación que la IA ya solicitó.

## Costo
3 llamadas opus-5 en total esta sesión (texto, plano, foto) — los tres pipelines visuales distintos, con evidencia real,
por el precio de 3 llamadas acotadas en vez de un barrido de 24.
