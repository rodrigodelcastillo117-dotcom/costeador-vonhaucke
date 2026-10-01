# Reconciliación catálogo — Paso B (2026-10-01)

NO toca `config` (sigue siendo el maestro de producción). Tablas versionadas paralelas.

## Migraciones aplicadas (Supabase proyecto mtuvnbgljwbsaizjjgzs, vía MCP)
1. `catalogo_confianza_evidencia`: +columnas `confidence`, `evidence_status`, `approved_by`,
   `approved_at`, `requiere_validacion_compras` en `insumo_precios`; CHECK de vocabulario en
   `estado` (propuesto | propuesto_validado | aprobado | sustituido), `confidence` (alta|media|baja),
   `evidence_status` (documentada|referenciada|concordante|sin_evidencia).
2. `catalogo_vigente_view`: vista `catalogo_vigente` = un precio vigente por insumo + `certificable`.

## Regla de confianza (ChatGPT, aprobada por Rodrigo)
Ningún precio del código/nube tiene EVIDENCIA DOCUMENTAL adjunta (solo etiquetas de origen:
"ERP última compra", "Compras lista", "T.D.C. …", "Rodrigo"). Por tanto:
- código con fuente + nube sin fuente -> `propuesto_validado`, evidence_status `referenciada`,
  confidence `media` (sin PDF NO sube a `aprobado` ni `alta`).
- nadie con fuente -> `propuesto`, `sin_evidencia`, `baja`, `requiere_validacion_compras=true`.
- código=nube concordante -> `aprobado`, `concordante`, `media` (único tier certificable).
- unidad en conflicto -> unidad canónica del código aprobada, PRECIO pendiente (`propuesto`, flag).

## Estado del catálogo (254 insumos = todo el código)
- 30 aprobado (concordante)  -> CERTIFICABLE
- 166 propuesto_validado     -> preliminar (con fuente, falta documento)
- 58 propuesto (bloqueadores)-> requiere Compras (42 de los 47 sin fuente + 15 unidad + 1 curvado)
- Vista: 254 vigentes, 30 certificables, 224 preliminares.

## Los 5 grandes (sin fuente en ninguno) — NO decididos, bloqueadores
cristal-templado-12 (2900 vs 1240), cristal-satinado (2130 vs 780),
piel-napa (550 vs 1900), arnes (440 vs 1450), cerradura-electronica (2835 vs 1850).

## Clasificación de los 162 solo-código (automática)
39 vigente (usados en modelos src) + 123 nuevo (98 ERP + 18 Alpura/TDC + 7 Compras) +
0 revisar. No hubo huérfanos sin procedencia -> decisión humana = 0.

## Pendiente
- Compras: documentar precio real de los 58 bloqueadores (empezar por los 5 grandes).
- costear-servidor: leer de `catalogo_vigente` tras el corte; devolver "preliminar" si el BOM
  usa algún insumo no certificable. Comparador $0.00 (motor cliente vs servidor) con Alpura.
- Corte (cerrar config RLS) solo tras validación. Config NO tocado.
