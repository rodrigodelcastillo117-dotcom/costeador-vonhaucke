# HOLDOUT - exactitud de materiales en 5 planos reales (independiente)

Protocolo: BOM impreso extraido de la CAPA DE TEXTO del PDF (verdad de referencia, no la lectura visual) y resuelto contra el ERP real (catalogo_vigente) por el mismo criterio del motor (clave exacta, fail-closed). Fecha 2026-11-09.

| Plano | Materiales | Resueltos n=1 | Ambiguos n>=2 | Pendientes (no en ERP) | Ruido/codigo | Tasa resol. | Piso material* |
|---|---|---|---|---|---|---|---|
| TELSVH120 | 20 | 8 | 0 | 12 | 5 | 40% | $4,362.49 |
| TELSMG | 9 | 7 | 0 | 2 | 0 | 78% | $901.16 |
| TEVTSU | 13 | 7 | 2 | 4 | 5 | 54% | $1,069.44 |
| TEVHSU | 14 | 8 | 1 | 5 | 4 | 57% | $1,088.99 |
| TVCAC | 0 | 0 | 0 | 0 | 1 | - | $0 |

*Piso material = suma de precios ERP de las claves resueltas n=1 (no incluye fabricadas sin precio, ni consumos de lamina, ni MO). Es una COTA, no el costo del producto.

## Hallazgo sistemico (holdout)

- Las **piezas fabricadas de lamina** (cuerpo/frente/puertas/paneles: -CUE, -CF, -P, -PC, -SOC, -SOM, -PA1..4, -BEXL2, -BX2) dan **0 candidatos en TODOS los planos**: el ERP NO tiene las piezas hechas en casa. Hueco ESTRUCTURAL: todo mueble nuevo lo tendra -> necesita consumo de lamina (geometria) + routing, no un precio de catalogo.
- Herrajes/consumibles/cristales/maquila (REP46, TO*, AD-0008, CR*, -CAP, -BAA) resuelven bien y consistente entre planos.
- Claves ambiguas (CR1/CR2/CR3 a secas, 9-19 candidatos) quedan SIN resolver por diseno (fail-closed): el motor no adivina variante.
- TVCAC: la capa de texto no trae BOM (plano tipo imagen) -> 0 materiales extraibles; requiere lectura visual (multimodal) como TELSVH120.
