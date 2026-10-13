# Costo contra precio de venta real (2026-10-13)

`margenes.json` sale de `npx vitest run lab/margenes/margenes.test.js`. Recorre los 24 precios reales del price-book
(`PRECIOS_VENTA`, presupuestos cerrados) y los costea con el modelo de la app.

## 1. El único módulo con costo REAL: APP LT banca doble 6U 1200 (pedido 38247)

Regla de Dirección: material a costo de compra + horas estándar × tarifa real. Los indirectos de la tarifa real se
cobran 2 o 3 veces, según Dirección; el factor exacto está por confirmar.

| Indirectos contados | Módulo sin biombo | Margen a lista $12,380 | Módulo + 3 biombos satinados | Margen a $17,660 (pedido real) | Margen a $17,600 (Mixue 226030134) |
|---|---:|---:|---:|---:|---:|
| 1 vez la tarifa del archivo (inflada) | $11,572.25 | 6.5 % | $14,359.89 | 18.7 % | 18.4 % |
| ÷2 | $8,749.14 | 29.3 % | $11,450.97 | 35.2 % | 34.9 % |
| ÷3 | $7,808.10 | 36.9 % | $10,481.33 | 40.6 % | 40.4 % |

Biombo ATBIOCRS4: material consumido en el pedido $853.26 (cristal $623.23 + 2 soportes) + 0.25 h de acabados a tarifa real.

## 2. Qué tan bien costea hoy el modelo de la app (mismo 6U, sin biombo)

| | Modelo de la app | Costo real (regla Dirección) |
|---|---:|---:|
| Material | $2,894.85 | $4,197.59 (**el modelo va 31 % bajo**) |
| Mano de obra | $1,187.36 (tarifa estándar) | $1,728.44 (tarifa real) |
| Indirectos | $4,426.60 (tarifa estándar) | $5,646.22 ÷ 2 o ÷ 3 |
| Fabricación | $8,508.81 | $8,749.14 (÷2) / $7,808.10 (÷3) |

Las horas ya son idénticas a las del ERP (armado de la guía + horas reales por pieza). **El material del modelo
es aproximado** (PTR por metro y melamina por área); los márgenes de abajo salen **optimistas** en la parte de material.

## 3. Los 24 precios reales contra el costo del MODELO de la app (tarifa estándar, material aproximado)

Ver `margenes.json`. Resumen:

- APP LT: margen sobre fabricación de 39.7 % a 74.4 %. Los más bajos son las bancas dobles de 1200: 10U 39.7 %, 12U 40.8 %, 6U 42.3 %, 8U 43.9 %.
- Río bench curvo 8U: 57.3 %.
- Mox rodante: 60.1 %.
- Modulor archivero: 82–89 %. **No es confiable**: nunca se verificó contra un costo ERP real y probablemente subestima el costo.

## 4. Lo que NO se puede comparar todavía

- El banco tiene 204 productos de 16 líneas, pero solo 24 tienen configuración costeable. Las líneas Ergonova 4, Accents, Alba,
  Eclipse, Pebble, Work Lounge, App, Wand, Cirque y Tetris tienen precio real, pero no un modelo de costo verificado ni un pedido ERP con despiece.
- Para que cualquier línea tenga costo REAL como APP LT hace falta lo mismo que en el pedido 38247:
  el despiece con material consumido, las horas por área y un pedido real de esa línea.
