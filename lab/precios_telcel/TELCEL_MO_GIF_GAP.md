# TELCEL_MO_GIF_GAP — C-CO-320R

## Objetivo

Determinar si el workbook real de TELCEL permite reproducir **mano de obra (MO)** y **gasto indirecto de fabricación (GIF)** de los cuatro módulos METAL sin inventar una regla.

No modifica el motor. No cambia targets. No deriva una fórmula por conveniencia.

## Targets del workbook

| Módulo METAL | Material | MO | MO / material | GIF | GIF / material | Fabricación |
|---|---:|---:|---:|---:|---:|---:|
| Vitrina Horizontal | $4,483.13 | $448.31 | 10.00% | $1,120.78 | 25.00% | $6,052.22 |
| Vitrina Torre | $2,966.15 | $296.62 | 10.00% | $14.83 | **0.50%** | $3,277.60 |
| Vitrina Isla | $3,297.84 | $329.78 | 10.00% | $824.45 | 25.00% | $4,452.07 |
| Módulo de Almacenamiento | $3,596.14 | $359.61 | 10.00% | $899.03 | 25.00% | $4,854.78 |

Los cuatro cierres de fabricación cuadran aritméticamente con `material + MO + GIF`.

## Política encontrada en el propio workbook

`solicitud.csv` contiene la tabla de Dirección/co-creación por tipo de costo. Entre otras filas:

- `mueble_fabricado`
- `componente_fabricado`
- `mueble_compra_venta`
- `componente_compra_venta`
- `accesorio_compra_venta`
- `servicio_directo`

Los renglones reales de comparación muestran que:

- METAL Horizontal / Isla / Almacenamiento se comportan como **fabricado**: MO=10%, GIF=25%.
- HERRAJES Horizontal se comporta como **compra-venta**: MO=1%, GIF=5%:
  - material $8,677.20
  - MO $86.77
  - GIF $433.86.

Esto confirma que el workbook distingue familia de costo y que METAL/HERRAJES no deben mezclarse.

## Anomalía Torre

Vitrina Torre · METAL:
- material = $2,966.15
- MO = $296.62 = 10.00%
- GIF = $14.83 = **0.50%**

No se encontró una fila de política en `solicitud.csv` que justifique simultáneamente:
- MO 10%
- GIF 0.5%.

Las políticas visibles de fabricado/compra-venta no producen esa combinación.

Por tanto:

`TORRE_GIF_RULE = UNRESOLVED`

No se debe:
- cambiar el motor para obtener $14.83;
- inventar un factor 0.5%;
- aplicar 25% y llamar al workbook incorrecto sin evidencia;
- usar un promedio de los otros módulos.

## Estado de paridad

### Materiales
`PASS 4/4` contra el motor real, tolerancia <= $0.05.

### MO
El patrón histórico es 10% en 4/4 módulos METAL, pero aún debe modelarse sólo si Dirección confirma que ésta es la regla aplicable para este esquema de co-creación. No se cambia el motor en este documento.

### GIF
- Horizontal: patrón 25%.
- Isla: patrón 25%.
- Almacenamiento: patrón 25%.
- Torre: patrón 0.5% sin regla fuente identificada.

`TELCEL_MO_PARITY = EVIDENCE_STRONG_BUT_NOT_IMPLEMENTED`

`TELCEL_GIF_PARITY = BLOCKED_BY_TORRE_ANOMALY`

## Pregunta mínima para cerrar con Dirección/Costos

> En C-CO-320R, ¿el GIF de Vitrina Torre METAL ($14.83 sobre $2,966.15) es intencional, o es una referencia/fórmula anómala del workbook? Los otros tres módulos METAL usan 25% y Torre usa 0.5%.

Hasta responder eso, el golden TELCEL debe certificar materiales, no fabricar una regla falsa de MO/GIF.
