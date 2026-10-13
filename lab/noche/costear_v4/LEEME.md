# Costear V4/V5 · corridas con hoja de control contra Edge RC (13-oct)

Todas con `analizar-mueble-rc` y `costear-servidor-rc` (`edges: rc=N prod=0 costeo_rc=N costeo_prod=0` al final de `run.log`).

| Corrida | Código | Hoja de control | Paridad | Reabrir | Nota |
|---|---|---|---|---|---|
| `v4_credenza` | `2088691` | 12/12 PASS | $4,546.02 = $4,546.02 | idéntico | transferencia bloqueada: pintura negra y jaladera 300 mm por confirmar |
| `v4_mesa_centro` | `2088691` | FAIL (EcoCrom 0.53 m²) | $3,442.84 = $3,442.84 | idéntico | destapó VH-165 (soldadura → PTR cal. 14) |
| `v4_mesa_trabajo` | `2088691` | — | — | — | la IA devolvió `INVALID_MODEL_SHAPE`; el servidor lo rechazó (guardia VH-162) |
| `v5_mesa_centro` | `8b66e8f` | 3/3 PASS | $3,040.03 = $3,040.03 | idéntico | servidor `incompleto`: 3 precios sin certificar, niveladores por confirmar |
| `v5_mesa_trabajo` | `8b66e8f` | 6/6 PASS | $2,217.79 = $2,217.79 (el lector del lab da `null` porque la venta dice "Pendiente") | idéntico | destapó VH-163b (falso "sin soporte" por plurales) y VH-166 (la tarjeta no decía el motivo) |

Recalcular con la hoja vigente:
`node lab/costear/verificarHoja.mjs lab/costear/hojas_control/mesa_centro.json lab/noche/costear_v4/v5_mesa_centro/8-dto-servidor.json`
