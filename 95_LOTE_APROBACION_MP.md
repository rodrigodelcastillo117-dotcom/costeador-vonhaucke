# 95_LOTE_APROBACION_MP — lote de aprobación de materia prima (para Dirección humana)

**Fecha:** 2026-10-30 · Medición read-only en producción. **El bot NO aprueba** (la RPC exige cuenta humana con rol; `qa-direccion` es no-humana por diseño). Esto es la lista para que **tú** apruebes con tu cuenta `rodrigo.delcastillo@vonhaucke.mx`.

## La verdad de los números (medido hoy)
| Concepto | Cantidad |
|---|---:|
| Precios vigentes **ya aprobados por humano** (`approved_by=rodrigo.delcastillo@vonhaucke.mx`) | **12,971** |
| Precios elegibles **sin aprobar** (DATA_TRUTH_V1 pendientes) | **0** |
| Puentes clave→insumo **propuestos (sin aprobar)** | **42** |

**Conclusión:** "aprobar MP" **no** es re-aprobar precios (ya están 100% aprobados por ti). Lo único pendiente son los **42 puentes clave→insumo**.

## Qué aprobar: los 42 puentes
- Son los mapeos clave Intelisis → insumo del catálogo, todos `EXACT_ATTRIBUTES`, hoy en `propuesto`.
- Entregados en **`PUENTE_CLAVE_INSUMO_aprobar.csv`** (columna `APROBAR_SI_NO`).
- Al aprobarlos, los materiales de esos documentos (incluye los 25 de TELSVH120) quedan con precio real conectado.

## Cómo se aprueban (con rastro humano, no el bot)
- RPC `aprobar_mapeo_externo(p_mapeo_id, p_nota)` — **verificado: tiene guardia de rol**; rechaza cuentas no-humanas (`qa-direccion`). Correcto por diseño.
- Lo ejecuta tu cuenta humana de Dirección (desde la app, o el flujo de aprobación), uno por uno o en lote, con su nota/evidencia.
- **NO lo hago yo con la cuenta QA** (rompería el rastro de auditoría y recrearía el problema P0-03 de aprobaciones no-humanas).

## Lo que NO entra en "aprobar MP" (y por qué)
- **Refrescar 7,102 precios >24 meses:** no es "aprobar", es recotizar; depende de tu **política de frescura** (B6). Esos precios YA están aprobados; si tu política dice "aprobado vale aunque viejo", sirven; si exige ≤24m, Compras los refresca. Tú decides.
- **Certificar versiones de producto (1/1,951):** es otra cosa (certificación de versión, no de precio MP).

## Siguiente paso
Abre `PUENTE_CLAVE_INSUMO_aprobar.csv`, marca los 42 (o los que apruebes) y confírmalos con tu cuenta humana. Con eso los muebles que usan esas claves quedan con precio real conectado.
