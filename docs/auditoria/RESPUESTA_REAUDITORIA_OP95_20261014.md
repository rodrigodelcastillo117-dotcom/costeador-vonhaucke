# Respuesta a la reauditoría externa de la Operación 9.5 (14-oct-2026)

Rango auditado: `b7df139 → 14f8e66`. Este documento dice qué se corrigió, con qué evidencia y dónde la
reauditoría se equivocó. Nada se aplicó en producción. Lo único que se desplegó fue la Edge RC
`costear-servidor-rc`.

## Resumen

| # | Hallazgo | ¿Correcto? | Estado | Evidencia |
|---|---|---|---|---|
| P0-01 | SEG-01b: el `costeoId` se puede reutilizar (replay) porque el `bomHash` viaja con el navegador | **Sí, reproducido.** Con SEG-01b el mismo `costeoId` en otra cotización daba ALLOWED en las dos. | **Corregido en SEG-01c** (PROPUESTA) | `supabase/tests/seguridadGateEmisionSnapshot.test.js`, bloque SEG-01c: 19 pruebas, incluidos dos replays y dos escenarios de frescura |
| P0-02 | Aplicar SEG-01b rompe los especiales de producción (gate estricto antes que productores) | Sí | **Corregido**: modo `preparado` por omisión (no bloquea); `diagnostico_autoridad_costeo`; `estricto` como paso aparte | Prueba "MODO PREPARADO" |
| P1-01 | `vincular_cotizacion` escribe sin versión esperada | Sí | **Corregido (VH-148d)**, más estricto que lo propuesto: ningún cliente ni Edge la llama (verificado en `c8dd2b3` y en HEAD), así que la firma sin versión se retira desde el paso 1 y queda solo la sobrecarga con CAS | Prueba H2b: 42501, 22004, 40001, y la pestaña B no pisa a A |
| P1-02 | El holdout no congela todo, y `--verificar` solo revisa archivos | Sí | **Corregido (holdout v2)** | `huellas_db.sql`, `src/datos/holdoutHuellas.js` (7 pruebas). `--verificar` sin `--db`/`--edges` devuelve exit 2 (NO VERIFICADO) |
| P1-03 | Re-elegir el precio en JS duplica la regla SQL | Sí (hoy coincide; es frágil) | **Corregido (P1-03b, PROPUESTA)**: la vista expone `precio_id` e `insumo_motor` lo entrega como `precioId`; la Edge lo usa | `supabase/tests/precioIdCatalogo.test.js` con la vista de producción, más 3 pruebas JS |
| P1-04 | `certificado` admite costo $0 | Sí | **Corregido**: CHECK en `costeos_servidor` y estado `incompleto` con motivo en el servidor de costeo | Pruebas de CHECK y de estado |
| P1-05 | CI real rojo | **Sí, y fue un error mío de reporte**: dije "suite verde" mirando solo vitest. El E2E fallaba desde **antes** de esta operación (también en `b7df139`) porque el mock simulaba producción sin VH-035c. | **Corregido**: el default del mock pasa a `'vh035c'` (verificado en producción). Además se quitó un script de depuración propio sin aserciones. | CI run 38521195210 (`df9a21a`): verify y E2E **verdes** |
| P1-06 | Medio centavo JS↔SQL | Sí | **Corregido**: el JS redondea el precio final como el SQL desplegado. El `it.fails` pasa a prueba normal. | `emissionExactCentsSql.test.js` |
| P2-01 | `aprobar_precio` sobrescribe `approved_by` | Sí | Pendiente (P2): tabla de aprobaciones append-only | — |
| P2-02 | 118 static guards siguen existiendo | Sí | Pendiente | — |
| P2-03 | 53/53 mutaciones no prueban equivalencia; "mismas salidas" es falso | **Parcialmente equivocado.** `costeoId`, `bomHash` y el mensaje con motivos ya estaban en `App.jsx` de `e549839`, la base del refactor (los agregué en el commit de SEG-01b). Comparar contra `b7df139` mezcla cambios deliberados con la extracción. **Tiene razón en el fondo**: las mutaciones miden la sensibilidad de las pruebas, no la equivalencia, y "refactor puro" no está demostrado. | Se corrige la redacción | — |

## Defecto propio encontrado durante la corrección

El wrapper de emisión de SEG-01c es INVOKER y leía directamente la tabla de política, que no tiene grant para
`authenticated`. En producción **habría tronado la emisión para todos los usuarios**.

- Mi arnés de SEG-01c corre como superusuario y no lo vio.
- El arnés de VH-148b, que ejecuta como `authenticated`, sí lo detectó.
- Corrección: el modo se lee con una función SECURITY DEFINER.
- Prueba nueva: modo estricto evaluado por una sesión real.

## Interacción SEG-01c ↔ VH-148b, prevenida

Vincular un costeo escribe la fila, y con VH-148b eso sube la versión. Sin más, el siguiente guardado del cliente
recibiría un 409 falso. Por eso la RPC devuelve `actualizado` y el cliente lo adopta.

## Orden de aplicación recomendado

Cada paso requiere autorización de Rodrigo:

1. **SEG-01 v1.**
2. **SEG-01c** en modo `preparado`. Crea `cuentas_no_humanas` y `costeos_servidor`; no bloquea nada.
3. **VH-100.** Requiere `cuentas_no_humanas`. Empezar con un lote piloto, no las 1,931 filas.
4. **VH-148b**, paso 1. Es compatible con el cliente `c8dd2b3`.
5. **P1-03b**: `precio_id` en el catálogo.
6. Desplegar la Edge `costear-servidor` nueva y el cliente nuevo. Hacer smoke: Costear → partida → guardar →
   vínculo → reabrir.
7. Revisar `diagnostico_autoridad_costeo` en cotizaciones reales y pasar SEG-01c a `estricto`.
8. Cuando ya no queden clientes viejos: VH-148c (paso 2).

## Lo que sigue sin verificarse

- La espera real en el candado entre dos conexiones, y la selección de sobrecarga de PostgREST real: PGlite tiene
  una sola conexión.
- El primer costo VALIDADO real: requiere a Rodrigo.
- El holdout fuera de muestra: no hay reportes nuevos de Intelisis.
- El Council con los dos proveedores: requiere tocar la Edge de producción.
