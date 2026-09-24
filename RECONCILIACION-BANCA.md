# Conciliación banca C-CO-510R (Aeropuerto CDMX) — app vs T.D.C. real

Criterio de aceptación del mandato. Reproducible: `node scratchpad/costea_banca_app.mjs`
(usa los insumos y el motor REALES de la app, no números a mano).

## Antes y después
| | Costo de fabricar |
|---|---|
| App **antes** de la calibración | **$26,811** (2.17× el real) |
| App **hoy** (desplegado) | **$10,380** |
| T.D.C. real (Alba/Producción) | **$12,341.88** |

El sobrecosto de 2.17× se eliminó. Hoy la app queda **−16% (por debajo)** del real
— del lado seguro (nunca sobrecotiza). El hueco restante NO está escondido en un
porcentaje: se ve y se atribuye abajo.

## Material — por insumo (app) vs total real
| Insumo | App | Merma |
|---|---:|---:|
| Lámina de acero cal. 10 (3×10) | $1,816 | $0 |
| Multicontactos Bari | $1,774 | $0 |
| Chapa de madera (sábana natural) | $1,080 | $0 |
| Perfil cuadrado 4" cal. 14 | $980 | $0 |
| MDF 19 mm | $874 | $0 |
| Tubo redondo 4" cal. 14 | $340 | $0 |
| Pegado de chapa (operación) | $300 | $0 |
| Acero inoxidable 304 cal. 20 | $290 | $0 |
| Nivelador cónico cromado 3/8 | $71 | $0 |
| Pintura en polvo A101 | $32 | $0 |
| **Material total** | **$7,557** | **$0** |

**Real: $7,585.92.** Diferencia **−$29 (−0.4%)** → material esencialmente exacto,
y **$0 desperdicio** (antes la app inventaba $10,648 de merma, más que TODO el
material real). Esto se logró costeando el metal por **fracción de hoja que rinde**
con el **tamaño de hoja correcto** (3×10), no forzando una hoja 4×8 + nesteo.

## Conciliación completa — cada peso explicado
| Concepto | App | Real | Δ | A qué se debe |
|---|---:|---:|---:|---|
| Material | $7,557 | $7,586 | −$29 | redondeo; exacto |
| Desperdicio | $0 | ~$0 | $0 | fracción de hoja |
| Mano de obra | $893 | $1,180 | **−$287** | la app quitó el 55% fijo; hoy estima por factor, no por **horas medidas** (faltan tiempos del ERP) |
| Indirectos | $1,931 | $3,576 | **−$1,645** | la app usa **34% plano global**; el real trae otra base. **NO se ajusta** el % a este caso (escondería el error en el siguiente mueble) |
| **Costo fabricar** | **$10,380** | **$12,342** | **−$1,962 (−16%)** | |

## Qué cierra el −16% restante (y por qué no lo forcé)
El 96% del hueco son **MO + indirectos**, y ambos dependen de datos que no puedo
inventar sin volver a meter error oculto:
- **MO (−$287):** requiere **horas reales por operación/centro** del ERP para pasar
  de factor a medición. (El 55% fijo ya se eliminó.)
- **Indirectos (−$1,645):** requiere la **base y política real de indirectos** que
  aprueba Finanzas. Tunear el 34% a esta banca haría cuadrar ESTE total y
  descuadraría el resto del catálogo (26 líneas comparten ese factor).

Con esos dos datos, el mismo caso se vuelve a correr y se cierra la diferencia con
evidencia. Ancla de regresión: `src/datos/banca.caracterizacion.test.js`.
