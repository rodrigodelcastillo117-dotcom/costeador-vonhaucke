# Ventana etapa 3 · 2026-10-13 · autorizada por Dirección ("sí autorizo todo… hacemos hoy la ventana etapa 3")

Producción antes de la ventana: cliente `c8dd2b3` (Vercel `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3`, candidato de rollback). Última
migración aplicada: `20261012040717 vh089_cargar_erp`. Las funciones a reemplazar tienen la MISMA huella md5 que los fixtures
con los que se probaron las propuestas (`actualizar_cotizacion_segura` 84da6ec…, `cotizacion_segura` fce4c26…,
`private_api.evaluar_emision_cotizacion` 9c660b0…). Las pruebas PGlite siguen vigentes.

## Orden

| # | Paso | Qué cambia | Datos | Prueba | Rollback |
|---|---|---|---|---|---|
| 0 | Respaldo | esquema `respaldo` (no expuesto a la API) con copia de las tablas tocadas + definiciones de todas las funciones `public`/`private_api` | lectura | conteos | n/a |
| 1 | VH-035c | guardado preserva la economía de Dirección; STALE por definición | no reescribe filas | `preservaEconomiaIntegral`, `espejoNubeFalsaVh035c`, `composicionVh035cVh148` | bloque ROLLBACK del archivo |
| 2 | VH-148 | control optimista (versión esperada) | no | `composicionVh035cVh148`, `conflictoGuardado*` | bloque ROLLBACK |
| 3 | SEG-01 | la emisión exige que el snapshot sea la fila guardada | no | `seguridadGateEmisionSnapshot` | bloque ROLLBACK (cuerpo md5 9c660b09) |
| 4 | VH-146 | formato 4×8/5×8 en hojas ERP de tablero | `insumos_catalogo.atributos` con tabla de respaldo propia | `formatoHojasErp` | bloque ROLLBACK (restaura desde su respaldo) |
| 5 | VH-147 | política ERP 24 meses (Decisión 1 de Dirección) | sella evidencias (append-only) | `erpPolitica` | bloque ROLLBACK |
| 6 | VH-147c | vista de auditoría de precios ERP en curados | no | `erpPolitica` | bloque ROLLBACK |
| 7 | VH-099 | función de dimensiones preliminares desde el texto del catálogo | función; la escritura sólo con `p_aplicar` | — | `drop function` |
| 8 | VH-100 | `cargar_costos_oficiales` corregida (extensions.digest, códigos duplicados) | función | `cargarCostosOficiales` | `drop function` |
| 9 | Cocrear | tabla `cocrear_costeo_servidor` + registro desde el servidor | no reescribe filas | `cocrearCostoServidor` | bloque ROLLBACK |
| 10 | Edge | promover `-rc` → producción: costear-servidor, analizar-mueble, acomodar-espacio-recovery, cotizar-texto, generar-render, leer-plano, leer-plano-core | — | suites de cada función | redeploy desde `c8dd2b3` |
| 11 | Cliente | merge PR #37 → `c3.4-seller-safe` → Vercel | — | CI verify verde; E2E: persistencia:125 se vuelve verde con VH-035c | promover `dpl_Bm7FF…` |
| 12 | Certificación | Costear, Cotizar (sin plano/con plano, guardar, reabrir, PDF), Cocrear, acomodo | — | lab en producción con cuenta QA | pasos de rollback en orden inverso |

No se aplican: `20261010170000_actualizar_cotizacion_preserva_economia` (Dirección decidió no aplicarla; recicla costo
viejo; la sustituye VH-035c) ni `PROPUESTA_vh035b` (sustituida por VH-035c).

Carga de costos oficiales APP LT y clave del módulo 12U: después de resolver los códigos duplicados (agente de claves).
Archivo de cotizaciones QA: después de la certificación (respaldo + `activa=false`, sin borrar).
