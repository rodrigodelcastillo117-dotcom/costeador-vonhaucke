# TELCEL-VH-HORIZONTAL — despiece cuantificado EN VIVO (producto_maestro)

Fecha: 2026-11-07 · prod `mtuvnbgljwbsaizjjgzs` · autorizado por Dirección.

## Qué cambió
La clave `TELCEL-VH-HORIZONTAL` pasó de **AGREGADO_HISTORICO** (1 línea, $4,483.13 material sin desglose)
a **BOM_DETALLADO_VERIFICADO** (9 líneas cuantificadas, cada una con `insumoId` al catálogo + consumo real
de explo_x_id). Ahora el motor la cuesta **por material a precio certificado de hoy**.

- Material a precio de hoy: **$4,583.50** (histórico $4,483.13, +2.24%).
- Costo de fabricación (×1.35 factores Telcel 0.10/0.25): **$6,187.73**.
- Estado del contrato (`costearBOM`, verificado): `emitible=true · orientativo=false · certificable=true`,
  9/9 líneas con precio vigente del catálogo, 0 bloqueos.

## Verificación hecha (no en vivo-navegador)
- `costearBOM` de prod corrido con estas 9 líneas + precios reales del catálogo → $4,583.50, certificable.
- Unidad robusta: las 3 tiras de madera van con `unidad:""` porque el catálogo las tiene como `pza`
  (unidad_costeo) y el view como `pieza` (unidad_compra); con unidad vacía el contrato NO bloquea por
  etiqueta y cuesta consumo×precio (dimensión correcta). Probado: `pza` bloquearía 3 líneas; `""` no.
- NO verificado en navegador autenticado (no hay sesión de UI aquí). El dato y el motor sí están probados.

## Honestidad sobre "certificable"
`certificable` aquí = BOM detallado + 9/9 con precio vigente aprobado del catálogo (regla del motor cliente).
PERO 2 líneas (pintura A529/A10) descansan en precio **2018/2020** que Dirección firmó (el view las marca
`PRELIMINAR` por antigüedad). Es certificable por la regla del motor; para que sea además **fresco**,
Compras debe confirmar el precio de la pintura. El resto (láminas, tiras) es 2026.

## Alcance
Sólo Horizontal (100% resuelto). Torre/Isla/Almacén siguen como AGREGADO_HISTORICO (orientativo) porque
tienen líneas sin precio/identidad (ver TELCEL_CCO320R_HANDOFF_CIERRE.md). No se tocaron.

## ROLLBACK (sólo Dirección, si hiciera falta)
```sql
update public.producto_maestro
set lineas = '[{"desc":"Material total (agregado de estimaciones; desglose por línea pendiente)","cantidad":1,"insumoId":null,"esCompraVenta":false,"precioConfirmado":4483.13}]'::jsonb,
    tipo_bom = 'AGREGADO_HISTORICO',
    actualizado_en = now()
where clave = 'TELCEL-VH-HORIZONTAL';
```
(material_real 4483.13, cos_fab_real 6052.22 y factores 0.10/0.25 no se modificaron.)
