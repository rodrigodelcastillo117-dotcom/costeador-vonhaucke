# COSTEAR 100 · Laboratorio TELCEL por subsistema (C-CO-320R) — 2026-11-03

Toma los **4 módulos METAL reales** (workbook Von Haucke, mismos datos que el golden `telcelCCO320R`), los clasifica
con el **contrato de subsistemas** (FASE 4/B) y reporta la distribución de material por subsistema y su ubicación
económica. No cambia el motor ni los targets; es análisis con datos reales.

## Distribución de material por subsistema (Σ = target del workbook, al centavo)
| Módulo | target | estructura (fábrica) | panelería/madera (fábrica) | acabados (fábrica) | herrajes (c-v) | embalaje (proyecto) |
|---|---:|---:|---:|---:|---:|---:|
| Horizontal | 4,483.13 | 2,844.20 (63.4%) | 1,225.69 (27.3%) | 413.24 (9.2%) | — | — |
| Torre | 2,966.15 | 2,085.83 (70.3%) | — | 668.32 (22.5%) | — | **212.00 (7.1%)** |
| Isla | 3,297.84 | 1,372.30 (41.6%) | 1,723.75 (52.3%) | 201.79 (6.1%) | — | — |
| Almacenamiento | 3,596.14 | 2,686.39 (74.7%) | 450.00 (12.5%) | 405.11 (11.3%) | 54.64 (1.5%) | — |

Cobertura: **0 líneas sin clasificar** en los 4 módulos; la suma por subsistema reproduce el target al centavo
(la clasificación ni pierde ni duplica dinero). Prueba: `src/datos/telcelSubsistemas.lab.test.js` (8/8).

## Hallazgo del propio laboratorio (mejora aplicada)
El clasificador **no capturaba la madera maciza** ("TIRA DE MADERA DE PINO DE SEGUNDA…"), que pesa **27–52%** del
material en Horizontal e Isla (eran soportes/nailers internos de madera). Antes quedaban como "sin clasificar".
Se agregó madera maciza a panelería/carpintería (`tira de madera|madera de pino|madera maciza|madera solida|duela|
tablón`, sin "madera" a secas para no robarle el embalaje). Economía intacta: panelería es fábrica, igual que antes.

## Hallazgo para Costos/Ingeniería (no es bug del código; es la ubicación económica)
**Torre suma $212 de "MADERA PARA EMBALAJE" DENTRO del material del módulo fabricado.** Por la regla de ubicación
económica inequívoca (FASE 4: no mezclar costo de fábrica con logística), ese embalaje pertenece a la **partida de
proyecto**, no al costo de fábrica del módulo. El contrato de subsistemas lo clasifica en `embalaje_logistica
(proyecto)` y así lo expone. Es ~7% del target de Torre. **Pregunta para Costos:** ¿el embalaje debe salir del
material del módulo y pasar a la partida de proyecto? (Afecta la comparación de "material de fábrica" vs histórico.)

## Observación (no bloqueante)
Las tiras de pino se clasifican como **panelería/carpintería**; físicamente en estos módulos metálicos funcionan como
soportes/nailers internos (más cercano a estructura). La **ubicación económica es la misma (fábrica)**, así que no hay
error económico; es sólo la etiqueta de subsistema. Si Ingeniería prefiere verlas como estructura, es un ajuste de
una línea en el clasificador.

## Estado
- `TELCEL_SUBSISTEMAS_COBERTURA = 4/4 (0 sin clasificar)`
- `TELCEL_SUBSISTEMAS_CONSERVA_MATERIAL = PASS (Σ = target al centavo)`
- `TELCEL_EMBALAJE_EN_FABRICA = HALLAZGO (Torre $212 → debería ser proyecto; decisión de Costos)`
- Paridad de MO/GIF sigue bloqueada por la anomalía Torre (ver `TELCEL_MO_GIF_GAP`), sin cambios.
