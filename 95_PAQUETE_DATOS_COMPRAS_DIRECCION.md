# 95_PAQUETE_DATOS — acciones para DIRECCIÓN y COMPRAS (el muro real de COSTEAR/INSUMOS)

**Fecha:** 2026-10-29. Esto es lo único que sube COSTEAR (~65) e INSUMOS (~70) hacia 95. **No es código** —
son datos y aprobaciones que sólo una persona real de Dirección/Compras puede hacer (la cuenta `qa-direccion`
está bloqueada a propósito por el fix de seguridad; está bien que lo esté).

## A) DIRECCIÓN — aprobar los 42 puentes clave-externa → insumo (hoy 0 aprobados)
Son conexiones ya construidas y verificadas (identidad `EXACT_ATTRIBUTES`), en estado `propuesto`.
Aprobarlas hace que esos materiales **cuenten con precio real** en el costeo. Reversible.

| Documento origen | Puentes | Qué desbloquea |
|---|---:|---|
| `HDM_TELSVH120_20261029` | 23 | Vitrina TELSVH120 (25/29 materiales; faltan los 4 especiales → Compras, abajo) |
| `Alpura_C-CO-517R` | 13 | Proyecto Alpura |
| `APP_LT_Pedido_38247` | 4 | Módulo App LT |
| `Repisa_flotante_40x20` | 2 | Repisa flotante |
| **Total** | **42** | |

**Cómo (persona de Dirección, en sesión real):** por la pantalla de aprobaciones, o vía RPC
`aprobar_mapeo_externo(p_mapeo_id, p_nota)` por cada id. Para sacar los ids por documento:
`select id, external_key, insumo_id from public.insumo_mapeos_externos where estado='propuesto' and source_document='<doc>' order by id;`
La función exige provenance mínima (ya la tienen) y rol `direccion` humano.

## B) COMPRAS — cargar los precios que faltan (por el flujo ERP, no a mano)
### B1 · Los 4 especiales de TELSVH120 (lleva la vitrina de 25/29 a 29/29)
Precios reales ya documentados en `lab/costear_golden/TELSVH120_4_ESPECIALES_PRECIO_REAL.md`:
| Material | Precio real | Clave |
|---|---:|---|
| Cerradura cam-lock | $416 c/u (×2) | CECAM20015 / MLEACE27330000 |
| Kit iluminación LED | ~$2,500 | TELSVH120-KIT / MLEEKT030000F9 |
| Placa serigrafía | ~$50 | TELSVH120-PLA / MLEEPL0409C8G1 |
| Capelo de cristal | ~$900 | TELSVH120-CAP / MLECCP0302072C |

**Cómo:** RPC `cargar_erp_ultima_compra(p_documento, p_catalogo, p_precios)` o `cargar_costos_oficiales`
(ambas rol Dirección, fail-closed). **NO por insert manual** (probado: los triggers lo deforman).

### B2 · Cobertura general del catálogo
Hoy: 10,185 insumos activos, **sólo 30% CERTIFICADO**, 70% PRELIMINAR. Para COSTEAR a 95 por mueble nuevo,
cada material del mueble necesita precio vigente/aprobado. Esto es incremental y medible **por mueble**
(no hay que certificar los 10,185 de golpe): priorizar los materiales de los muebles que de verdad se cotizan.

## C) DIRECCIÓN — fijar la política de frescura (contrato)
Definir los tramos OFICIAL/CERTIFICADO/VIGENTE/ANTIGUO-APROBADO/PRELIMINAR/NECESITA-COMPRAS/SIN-COSTO
(≤24 / 25–60 / 61–120 / >120 meses). La app ya los distingue; falta que Dirección fije la política final.

## Efecto esperado
- Con A + B1: TELSVH120 pasa de "no costeable" a **29/29 con precio real** → COSTEAR de ese mueble a ~95.
- Con B2 incremental: cada mueble cotizado real sube a 95 a medida que entran sus precios.
- INSUMOS sube conforme baja el % PRELIMINAR.
**Sin esto, COSTEAR/INSUMOS NO llegan a 95 — y ningún cambio de código lo sustituye.**
