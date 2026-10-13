# Costo contra precio de venta real (2026-10-13)

`margenes.json` sale de `npx vitest run lab/margenes/margenes.test.js`. Recorre los 24 precios reales del price-book
(`PRECIOS_VENTA`, presupuestos cerrados) y los costea con el modelo de la app.

## 1. El único módulo con costo REAL: APP LT banca doble 6U 1200 (pedido 38247) — REGLA OFICIAL

Regla de Dirección (2026-10-13):
- costo = material a costo de compra + horas estándar × mano de obra real por área + **indirectos contados UNA vez**;
- la tarifa de indirectos de planta es 1 / Σ(1/ind_área) = **$82.37/h**: cada área del archivo cargaba el gasto de toda la planta;
- se aplica a las 19.13 h del módulo.

| | Módulo sin biombo | Módulo + 3 biombos satinados |
|---|---:|---:|
| Material | $4,197.59 | $6,757.37 |
| Mano de obra | $1,728.44 | $1,747.19 |
| Indirectos (una vez) | $1,575.94 | $1,595.53 |
| **Costo** | **$7,501.97** | **$10,179.78** (biombo $892.60 c/u) |
| Venta real | $12,380 (lista, pedido 38247) | $17,660 (pedido 38247) · $17,600 (Mixue 226030134) |
| **Margen** | **39.4 %** | **42.4 %** · 42.2 % |
| Mínimo autorizado del catálogo ($9,170) | 18.2 % → **debajo del piso de 25 %** | — |

La tarifa del archivo por área ($5,646.22 de indirectos, costo $11,572.25) inflaba el gasto y queda solo para comparar.

## 2. Qué tan bien costea hoy el modelo de la app (mismo 6U, sin biombo)

| | Modelo de la app | Costo oficial |
|---|---:|---:|
| Material | $2,894.85 (aproximado: PTR/m, melamina por área) | $4,197.59 (−31 %) |
| Mano de obra | $1,187.36 (tarifa estándar ERP) | $1,728.44 |
| Indirectos | $4,426.60 (estándar, suma por área) | $1,575.94 |
| Fabricación | $8,508.81 (**+13 % sobre el oficial**) | $7,501.97 |

Las horas ya son idénticas a las del ERP. No se cambiaron las tarifas del generador: si se corrige solo la tarifa,
el modelo baja a $6,199 (17 % abajo del oficial) porque el material sigue aproximado. Primero hace falta el material real por medida.

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
