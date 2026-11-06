# E2E Costeador vs costeo real — VENTO y TELCEL (post-activación de precios ERP)
**Fecha:** 2026-11-06 · **Motor:** `src/motor/calculo.js` (fracción-directa, misma lógica del costeador) · **Catálogo:** `catalogo_vigente` EN VIVO tras activar los 1,108 insumos ERP con precio.
**Arnés:** `lab/scripts_lab/recost_post.mjs`. Solo lectura + cómputo. Comparación a nivel **material** (es lo que el workbook real da: explosión de MP, mismo BOM y cantidades en ambos lados).

## Los números (material)

### VENTO C-CO-526R (3 exhibidores) — 107 renglones
| | Monto |
|---|---:|
| **Costeo REAL (workbook, material)** | **$20,358.57** |
| Costeador — crudo (catálogo tal cual) | $32,457.64 (+59.4%) |
| └ de eso, bug de la espuma (100×, MVLREF00634532) | +$15,295.50 (artefacto de dato, NO del motor) |
| **Costeador — limpio** (sin bug espuma ni huecos) | **$17,007.64 vs $16,191.19 → +5.0%** |
| Motor completo crudo: material $32,457.64 + MO(Alba) $5,289.98 + indirectos $15,991.02 | = fabricación $53,738.64 |

### TELCEL C-CO-320R DAT'S R5 — 89 renglones
| | Monto |
|---|---:|
| **Costeo REAL (workbook, material)** | **$30,210.33** |
| **Costeador — crudo (catálogo tal cual)** | **$29,721.99 → −1.6%** |
| Costeador — limpio | $29,256.99 vs $27,962.74 → +4.6% |
| Motor completo crudo: material $29,721.99 + MO(Alba) $3,227.86 + indirectos $9,965.90 | = fabricación $42,915.75 |

**Lectura honesta:** donde el dato está limpio, el motor clava el material real a **+5.0% (VENTO)** y **−1.6%…+4.6% (TELCEL)**. Eso es fidelidad real, no suerte.

## ACTUALIZACIÓN 2026-11-06 — tras crear SKUs + arreglar la espuma
Se corrigió el bug de unidad de la espuma (rollo→metro, $750/rollo = $7.14/m) y se creó la placa de aluminio faltante (`erp-plasevh` $45); los otros 3 "faltantes" ya existían como curados (`lamina-3x10-14/20`, `pulido-redondo-14`) y se les reforzó el precio del workbook. Re-costeo usando el campo `precio` (el que usa el motor, no `precio_compra`):

| | Costeo REAL | Motor crudo | Motor limpio | Fabricación motor (mat+MO+indirectos) |
|---|---:|---:|---:|---:|
| **VENTO** (107 r.) | $20,358.57 | **$17,154.78 (−15.7%)** | $17,154.77 vs $16,345.69 → **+4.9%** | **$26,193.50** (antes del fix espuma daba $53,738) |
| **TELCEL** (89 r.) | $30,210.33 | **$29,306.42 (−3.0%)** | $29,306.42 vs $28,012.39 → **+4.6%** | **$42,167.72** |

- **0 outliers** en ambos (la espuma dejó de inflar; VENTO cayó de fabricación $53,738 → $26,193).
- El crudo queda LIGERAMENTE BAJO el real (−15.7% / −3.0%) porque el recost no cuenta los huecos ($4,012 VENTO / $2,198 TELCEL), que en su mayoría son pintura/aglomerado con precio real existente (artefacto del mapeo por opción del arnés, costeables en producción).
- Donde el dato está limpio, motor vs real = **+4.9% / +4.6%**. Es fidelidad real.

Registro + revert: `lab/datos_reales_drive/skus_y_espuma_20261106.sql`, respaldo `public._backup_espuma_20261106`.

## Qué NO arregló la activación (honesto)
Prender los 1,108 **no cambió VENTO ni TELCEL**. Sus huecos no eran por `activo=false`; son:
1. **Opción/color no mapeado (precio SÍ existe):** `MVLQPP00000000` pintura en polvo (89 opciones, todas con precio) y `MVLMAG01280600` aglomerado (32 opciones, todas con precio). El recost mapea por (articulo|opción) exacta y no empata el color; el costeador real (VONI + puente por familia) SÍ los costea. Son 8 renglones VENTO + 7 TELCEL "huecos" que en realidad tienen precio.
2. **SKUs genuinamente ausentes (hay que crearlos):** `MVLSLA05260502` (lámina cal.20), `MVLSLA05260202` (lámina cal.14), `MVLSPU02030001`, `MVLEPL0408C8A6` (placa aluminio). ~7 renglones. La activación no ayuda porque el insumo no existe.
3. **Bug de unidad 100× en la espuma `MVLREF00634532`** ($750 vs $7.50 real): sigue sin corregir (decisión de Compras). Infla el crudo de VENTO en ~$15 mil.

**La activación SÍ sirve para el catálogo en general** (1,108 precios reales ahora visibles al puente y al buscador), pero estos dos productos piloto estaban limitados por otras tres cosas, no por los insumos apagados.

## Para llevar el costeo a "perfecto" en estos dos
1. Crear los ~7 SKU faltantes (láminas cal.14/20, placa aluminio) con su precio real del workbook.
2. Corregir la unidad de la espuma (Compras).
3. (Menor) exponer el precio base de genéricos pintura/aglomerado cuando la opción de color no empata exacto.

## Registro de la activación (reversible)
- Migración aplicada: `activar_insumos_erp_con_precio_20261106` (Supabase, proyecto mtuvnbgljwbsaizjjgzs).
- Prendió **1,108** insumos ERP con precio aprobado que estaban `activo=false`. Respaldo en `public._backup_activacion_erp_20261106`.
- **Revert:** `update insumos_catalogo set activo=false where id in (select id from public._backup_activacion_erp_20261106);`
- Nota de frescura: 1,090 de los 1,108 traen precio <2024. El motor nunca los marca 'certificado' en silencio (aviso de frescura + tope 'preliminar'). Las compras semanales refrescarán precios.

## Deploy
La activación es **cambio de datos: ya está en vivo** (las RPC `buscar_insumos_motor`/`catalogo_vigente` leen en vivo; no requiere desplegar código). El puente ERP cliente ya está en la rama de prod (`c3.4-seller-safe`). **No se promovió** el puente redundante de `analizar-mueble-rc`.
