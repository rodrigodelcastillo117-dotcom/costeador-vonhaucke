# 95_POSTDEPLOY_FASE2 — validación del reconocimiento de producto de LÍNEA (COSTEAR) · 2026-11-03

Objetivo: antes del piloto, probar el emparejador foto/texto → SKU de línea contra el catálogo **real completo**
(`PRECIOS_LINEA`, 1,717 artículos, 15 líneas), no una lista de juguete. El riesgo más caro: (a) costear un producto de
línea desde cero al precio equivocado, o (b) **afirmar** que un mueble custom "es de línea" a precio de catálogo.

## Casos probados contra el pool real (`sugerirLineaParaCosteo(propuesta, candidatosDePreciosLinea())`)
| Caso | Entrada (estilo IA) | Resultado | Veredicto |
|---|---|---|---|
| A | Foto Eclipse Drift, 1 puerta/2 cajones/1800/nogal, **familia nombrada** | SKU `EDCZAE61P2CCH` $33,270 · ALTA | ✓ TP, material y precio correctos |
| B | Eclipse Drift 2100, 3 puertas/4 cajones, **chapa madera** | `EDCZAD73P4CCH` $41,930 · ALTA | ✓ gana a melamina ($28,090): discrimina material (+$13,840) |
| C | Eclipse Drift 1800, 4 puertas/0 cajones, melamina | `EDCZAD64PTABS` $22,630 · ALTA | ✓ discrimina config (4P vs 1P/3P) |
| D | ALBA escritorio 1200, 1 cajón (producto a-config) | BAJA, **no dispara banner** | ✓ aceptable: no afirma lo que no sabe |
| E | **Custom** "a la medida" 1P/2C/1800 melamina, **sin familia** | `EDCZAE61P2CABS` $19,240 · **MEDIA** | ✓ tras fix (antes ALTA — ver abajo) |
| F | Recepción curva 3200 ecopiel (claramente custom) | `NINGUNA`, sin sugerencia | ✓ TN |

## Hallazgo real + fix (RED→GREEN): confianza sobre-afirmada sin familia
**Antes:** el caso E (un mueble que el cliente pidió *a la medida*, sin nombrar familia) salía **ALTA** como
`EDCZAE61P2CABS $19,240`, sólo por coincidencia de forma (config + dimensiones + material). Muchos custom comparten esa
silueta → un vendedor podía tratar un mueble custom como SKU de catálogo a precio de catálogo.

**Fix (`emparejarLinea.js`):** `ALTA` ahora **exige señal de familia** (la familia nombrada/leída en el texto). Un match
sólo por forma se queda en **MEDIA** ("podría ser de línea — confírmalo"). El banner sigue mostrando el SKU y su precio para
que el humano decida; sólo deja de sobre-afirmar. Reversible (3 líneas en `conf()`).

- Prueba RED→GREEN en `emparejarLinea.test.js`: misma config con familia → ALTA; sin familia → **NO ALTA** (MEDIA/BAJA).
- La foto real (la IA de visión no "ve" el nombre del modelo) caerá en **MEDIA** — que es la confianza honesta: inferimos
  por silueta, no por el nombre del modelo. El banner ya dice "Esto **se parece a**… (confianza X). Confírmalo con Dirección."

## Estado: FASE 2 cerrada. Reconocimiento validado contra el catálogo real; 1 mejora de honestidad de confianza aplicada.
No se tocó precio alguno (sólo apunta a precios ya documentados). No auto-selecciona: siempre pide confirmación humana.
