# Voni Spatial Intelligence V1

Estado de diseño: **implementado en rama `voni-spatial-intelligence-v1`; release sólo con gates verdes.**

## Objetivo

Voni no debe responder únicamente “cabe/no cabe”. El pipeline espacial canónico es:

`FloorSpec → ProductRevision.spatial_spec → PlacementSpec → validación determinista → repair-loop → RenderSpec`.

La IA interpreta/proponer; los validadores deterministas deciden si el layout es publicable.

## Invariantes

1. `requested = placed + unplaced + excluded` siempre.
2. QuoteLine fija `producto_version_id`; Placement no usa “latest”.
3. Para una pieza versionada, `spatial_spec` se resuelve server-side desde `producto_versiones.atributos.spatial_spec`. Un payload del navegador no es autoridad.
4. Producto legacy sin `spatial_spec` **no recibe números inventados**. Las reglas genéricas existentes pueden seguir actuando como reglas de oficio, pero no se convierten en evidencia de ProductRevision.
5. Una puerta sin bisagra/sentido/arco verificable queda `UNVERIFIED/REVIEW_REQUIRED`; nunca se inventa el barrido para conseguir verde.
6. Huella física y espacio funcional son cosas distintas. Un mueble puede “caber” y aun así fallar por silla, frente funcional, cajones, circulación o barrido de puerta.
7. Un layout parcial nunca se presenta como terminado; render/PDF oficial sólo con gate espacial válido.
8. Drag/manual edit vuelve a pasar por auditoría espacial; no existe bypass visual.
9. Seller-safe: el cliente/vendedor no recibe costo, margen, proveedor ni `atributos` completos para resolver espacio.

## `SPATIAL_SPEC_V1`

Vive dentro de `producto_versiones.atributos.spatial_spec` y puede contener, de forma incremental:

```json
{
  "version": "SPATIAL_SPEC_V1",
  "clearance_mm": { "top": 0, "right": 150, "bottom": 900, "left": 150 },
  "clearance_must_be_inside": true,
  "anchor": "wall|center|free",
  "prefer_wall": true,
  "prefer_center": false,
  "companion_id": null,
  "max_companion_distance_mm": 1200,
  "source": "USER|PLAN|CATALOG|ENGINEERING|DIRECTION|FACTORY|AI_INFERENCE|RULE",
  "confidence": "alta|media|baja",
  "verified": true
}
```

No todos los campos son obligatorios. Ausencia significa UNKNOWN, no cero confirmado.

## FloorSpec V2 · puertas

Además de `x/y/ancho`, una puerta puede llevar:

- `tieneBarrido`
- `bisagraX / bisagraY`
- `anguloCerradaDeg` (`0=derecha, 90=abajo, 180=izquierda, 270=arriba`)
- `sentido = horario|antihorario|desconocido`
- `barridoDeg`
- `confianza`

`leer-plano-core` sólo marca `tieneBarrido=true` cuando el arco/bisagra/sentido son visibles. El wrapper seguro valida nuevamente esa evidencia.

## PlacementSpec V2

El gate incluye:

- geometría real / contorno
- overlap
- zona semántica
- puertas
- functional clearance
- invariante de cantidades
- `quality.score`
- `product_revision_spatial.versioned_pieces`
- `product_revision_spatial.canonical_specs_resolved`
- `product_revision_spatial.missing_specs`
- autoridad `SERVER_PRODUCT_REVISION`

El score sólo ordena alternativas que ya pasaron los hard constraints; nunca “compensa” una violación dura.

## Repair-loop

Máximo tres intentos. Cada reintento conserva posiciones ya validadas y reposiciona únicamente piezas con violación. No reduce cantidades ni inventa muebles.

## Persistencia seller-safe

La migración `product_revision_spatial_spec_contract` crea:

- `public.spatial_specs_para_versiones(bigint[])`: devuelve exclusivamente `version_id + spatial_spec` y exige usuario permitido.
- trigger `trg_producto_version_spatial_spec`: al registrar una nueva ProductRevision, eleva a canónico sólo un `spatial_spec` explícito con procedencia/confianza válida que ya venga en Cocrear. No genera defaults.

## Release gates

Antes de producción:

- Vitest spatial/door/ProductRevision/hardening PASS.
- Parse TypeScript de las tres edge functions PASS.
- Shadow deploy Supabase PASS.
- Vercel preview READY.
- Golden de plano real y regresiones existentes PASS.
- Después: deploy `leer-plano-core` → `leer-plano` → `acomodar-espacio`, conservando `verify_jwt=true`.
