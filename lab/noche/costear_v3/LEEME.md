# Costear V3 · corridas con hoja de control (13-oct)

- `v3_credenza_1`, `v3_credenza_2`: el servidor de desarrollo se había caído y Playwright levantó uno sin
  `VITE_ANALIZAR_MUEBLE_FN`: usaron la Edge de PRODUCCIÓN `analizar-mueble`. La 2 destapó VH-162 (12 → 2 renglones).
- Las demás usaron `analizar-mueble-rc` (`edges: rc=N prod=0` al final de `run.log`).
- `9-hoja-control.json`: comparación del DTO real enviado a costear-servidor contra
  `lab/costear/hojas_control/<mueble>.json` (`e2e/hojaControl.js`). Para recalcular con la hoja vigente:
  `node lab/costear/verificarHoja.mjs lab/costear/hojas_control/credenza.json lab/noche/costear_v3/v3_credenza_4/8-dto-servidor.json`
