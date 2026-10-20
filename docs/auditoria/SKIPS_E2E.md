# Inventario de los 12 "skipped" del E2E (auditoría ChatGPT 2026-10-19)

CI de `b4cb532`: 112 tests en 37 archivos → **100 passed, 12 skipped**. Los secretos `TEST_EMAIL`/`TEST_PASSWORD`
sí están en CI (golden757 autenticado corre). Los 12 saltados son los que, además de la cuenta, piden **su propio
insumo** y gastan IA/renders contra producción. No son pruebas del CI: son laboratorios y pasadas en vivo.

Desde esta rama, `playwright.config.js` **no los carga** salvo que quien los corra los pida con su variable
(`A_PEDIDO` / `pidioAPedido`). Resultado esperado del CI: **100 tests en 25 archivos, 0 skipped**. Con cualquier
`LAB_*` vuelven los 112.

| # | spec | test | razón exacta del skip en CI | ¿esperado? | ¿se elimina? | dónde corre de verdad |
|---|------|------|-----------------------------|-----------|--------------|------------------------|
| 1 | `cocrearExpediente.e2e.js:17` | COCREAR · expediente QA: reabrir → guardar → render → recargar | falta `COCREAR_QA=1` (abre un expediente QA fijo y genera render con costo) | sí | ya no aparece en CI (a pedido) | a mano, `COCREAR_QA=1` |
| 2 | `labCocrear.e2e.js:96` | COCREAR real: brief → concepto → ajustes → guardar → reabrir | falta `LAB_COC_BRIEF` | sí | ídem | certificación `cocrear-<n>` (lab/noche/cocrear10/correr.sh) |
| 3 | `labConcurrencia.e2e.js:42` | dos pestañas editan la misma cotización | falta `LAB_CLIENTE` (cotización real a editar) | sí | ídem | a mano; la regla está cubierta sin red en `concurrenciaOptimista.e2e.js` |
| 4 | `labCostear.e2e.js:50` | COSTEAR real: imagen → BOM → ERP → costo → sombra → reabrir | falta `LAB_COSTEAR_IMG` (o `LAB_HOJA`) | sí | ídem | certificación `costear-<hoja>` |
| 5 | `labCotizarFlujo.e2e.js:22` | COTIZAR real por texto o manual | falta `LAB_MODO` + `LAB_TEXTO`/`LAB_BUSCAR` | sí | ídem | certificación `texto` / `manual` |
| 6 | `labPdfReabrir.e2e.js:7` | reabrir y descargar PDF | falta `LAB_CLIENTE` | sí | ídem | a mano |
| 7 | `labRender.e2e.js:10` | reabrir y generar renders por área | falta `LAB_CLIENTE` (renders cuestan) | sí | ídem | a mano |
| 8 | `labTorreNorte.e2e.js:23` | plano: lectura → programa → acomodo → guardar → PDF → reabrir | falta `LAB_PLANO` | sí | ídem | certificación `plano-<Cn>`, `rodrigo` |
| 9 | `live-ai-smoke.e2e.js:24` | Costear llama analizar-mueble real | falta `LIVE_AI=1` (llamada de IA con costo) | sí | ídem | a mano |
| 10 | `renderEscenas.e2e.js:17` | renders por cuarto en producción | falta `RENDER_PROD=1` | sí | ídem | a mano |
| 11 | `vivo.e2e.js:38` | cinco caminos contra el servidor real | falta `VIVO=1` | sí | ídem | a mano |
| 12 | `vivoSombra.e2e.js:12` | Costear con IA → sombra contra costear-servidor | falta `VIVO=1` | sí | ídem | a mano |

Ninguno de los 12 era un test del CI que fallara y se escondiera: los 100 del CI siguen corriendo igual.
Los laboratorios con IA corren en `.github/workflows/certificacion.yml` (etiqueta `certificar`), un job por caso,
con evidencia como artefacto.
