# HOLDOUT INDUSTRIAL - costeo de piezas fabricadas desde materia prima (5 planos)

Metodo: extraer de la capa de texto las piezas "EN LAMINA" con geometria y costearlas con el motor (desarrollo plano -> lamina comercial ERP -> aprovechamiento/merma). PANEL = costeable; CAJA 3D = desarrollo pendiente (CAD). Cobertura parcial donde la capa de texto es jumbled. 2026-11-09.

| Plano | Fab. detectadas | Costeadas (panel) | Pend. desarrollo (3D) | MP lamina (panel) |
|---|---|---|---|---|
| TELSVH120 | 4 | 1 | 3 | $189.39 |
| TELSMG | 0 | 0 | 0 | $0 |
| TEVTSU | 3 | 0 | 3 | $0 |
| TEVHSU | 3 | 1 | 2 | $126.25 |
| TVCAC | 0 | 0 | 0 | $0 |

## Lectura

- El metodo GENERALIZA: donde hay geometria de panel (frente/puerta/placa) se costea la MP de lamina desde su materia prima real, sin tratar la pieza como SKU.
- Las cajas 3D (cuerpo, exhibidor) quedan como DESARROLLO PENDIENTE (requieren despliegue de CAD); no se inventan dimensiones.
- Cobertura limitada por la capa de texto: planos jumbled (TELSMG/TVCAC) detectan menos piezas por parseo, no por el costeo. La lectura multimodal (como en TELSVH120) recupera las que el texto no da.
