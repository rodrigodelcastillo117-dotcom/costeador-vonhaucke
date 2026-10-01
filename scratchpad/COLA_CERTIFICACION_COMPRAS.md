# Cola de certificación — Compras (2026-10-01)

Insumos NO certificables (estado ≠ aprobado) que Compras debe documentar (cotización/factura/folio)
para pasar de `propuesto`/`propuesto_validado` → `aprobado`. NO bloquea el desarrollo: el sistema
opera en modo `preliminar` mientras tanto. Fuente: `catalogo_vigente`. Acción = adjuntar evidencia.

Columnas: insumo · precio catálogo · u.compra · u.costeo · fuente · evidence_status · Δ% vs legado · acción.

## P0 — Los 5 grandes (sin evidencia en ningún lado, máximo impacto) — DECIDIR PRIMERO
| insumo | precio | u | fuente | evidence | Δ% legado | acción |
|---|---|---|---|---|---|---|
| cristal-satinado | $2,130 | m² | (código sin fuente) | sin_evidencia | +173% | **Compras: precio real + factura. ¿mismo producto?** |
| cristal-templado-12 | $2,900 | m² | (código sin fuente) | sin_evidencia | +134% | **Compras: precio real + factura** |
| piel-napa | $550 | m² | (código sin fuente) | sin_evidencia | −71% | **Compras: ¿calidad/proveedor? puede ser otro producto** |
| arnes | $440 | pza | (código sin fuente) | sin_evidencia | −70% | **Compras: ¿kit vs componente?** |
| cerradura-electronica | $2,835 | pza | (código sin fuente) | sin_evidencia | +53% | **Compras: precio real StealthLock** |

## P1 — Tableros/melaminas base (unidad canónica OK, precio pendiente de documento)
| insumo | precio | u | fuente | evidence | acción |
|---|---|---|---|---|---|
| melamina-19 | $544 | hoja | Compras lista 2026-08-14 | referenciada | adjuntar factura (unit kg→hoja ya resuelta) |
| melamina-16 | $450 | hoja | Compras lista 2026-08-14 | referenciada | adjuntar factura |
| melamina-28 | $1,335.6 | hoja | ERP última compra | referenciada | adjuntar folio ERP |
| melamina-9 | $648.9 | hoja | (sin fuente) | sin_evidencia | Compras: precio real |
| mdf-16 | $372 | hoja | (sin fuente) | sin_evidencia | Compras: precio real |

## P2 — Láminas metal (modelo kg→hoja; validar $/kg y peso por calibre)
lamina-10/12/14/18/20/22, lamina-3x10-12/14/20: todas `propuesto`/`propuesto_validado`.
Acción: confirmar $/kg de compra y peso_hoja por calibre con una factura reciente.

## P3 — Cantos / acabados / herrajes / tapicería en BOMs modulor y Alpura
tapacanto, canto-abs-22/32, pintura-electrostatica/polvo-negro, ecopiel, tela, espuma,
corredera, jaladera, nivelador/nivelador-plataforma, rodaja, nogal, acrílicos, pulido/tubular.
Acción: adjuntar lista/factura; muchos ya tienen fuente ERP/Compras (solo falta el documento).

## P4 — Variantes de color (melamina-16/19/28 colores, pintura-polvo colores)
~120 insumos `propuesto_validado` con fuente "ERP Costos MP última compra 10082026.xlsx (Luis
Daniel)". Acción de bajo esfuerzo: adjuntar ese mismo archivo ERP como evidencia documental →
suben en bloque a `aprobado`. Impacto individual bajo (variantes), pero cierran mucha cobertura.

## Regla de certificación
Al adjuntar evidencia documental: `update insumo_precios set estado='aprobado',
evidence_status='documentada', confidence='alta', approved_by=<email>, approved_at=now()`
para ese insumo_id vigente. El golden Alpura y el comparador deben re-correr tras cada tanda.

## Nota
- 30/254 ya certificables (concordantes código=nube). Meta: subir cobertura empezando por P0→P1.
- Mientras un BOM use ≥1 insumo no certificable, `costear-servidor` devuelve estado `preliminar`
  (con precio) — nunca lo oculta ni lo pone en $0.
