# Holdout Intelisis: protocolo de prueba fuera de muestra (14-oct-2026)

## Por qué

La prueba ciega r2 **no es predicción**. Las correcciones se hicieron después de ver r1 sobre **los mismos 15
componentes**, así que mide ajuste. Para saber si Costear acierta con muebles que no conoce hacen falta muebles
**nuevos**: de 10 a 15 reportes del cotizador Intelisis que nadie del equipo de la app haya visto. **No existen
todavía**: los debe entregar Compras.

## Reglas (se fijan ANTES de ver los datos)

1. **Congelamiento.**
   - `node scripts/congelar_holdout.mjs` escribe `MANIFIESTO.json` con el sha256 de los 37 archivos que influyen
     en el costo: motor, estado del costo, reconciliación de material, Edge RC de costeo y de análisis, laboratorio
     y métricas.
   - El manifiesto también guarda el md5 de los precios (11,350 filas), del catálogo (11,223) y de la config.
   - Huella actual: `c3db350fde005186…`.
2. **Antes de correr**, `node scripts/congelar_holdout.mjs --verificar` debe decir OK. También hay que volver a
   medir las tres huellas de base de datos con las consultas del manifiesto y deben coincidir. Si algo cambió, la
   corrida **no cuenta** como holdout: se re-congela, se documenta el motivo y se empieza de nuevo.
3. **Entrada.**
   - Solo la descripción comercial y, si existe, el plano.
   - El despiece del ERP **no** se da a la app.
   - Las respuestas a preguntas de la IA se toman de la evidencia del plano. Sin evidencia: "sin responder".
4. **Prohibido** cambiar código, prompts, precios o factores entre el congelamiento y la publicación de resultados.
   Un defecto encontrado se anota y se corrige **después**. Esos mismos muebles ya no sirven como holdout para la
   corrección.
5. **Todo mueble cuenta.** Si la app no lo puede costear, se reporta en `noCosteados`; nunca se excluye.
6. **Métricas** (`src/datos/metricasHoldout.js`, probadas):
   - MAE en pesos y MAPE;
   - sesgo con signo;
   - porcentaje de muebles dentro de ±5, ±10 y ±20 %;
   - global y por familia;
   - por componente: MP, MO, GIF y total.
   Un componente sin dato no cuenta como 0.
7. **Separación.** Quien elige los muebles (Compras) no le pasa al equipo de la app ni las claves ni los reportes
   antes de la corrida.

## Línea base in-sample (r2, 15 componentes App LT): NO es predicción

`linea_base_r2_IN_SAMPLE.json`:

| | n | MAE | MAPE | Sesgo | ±5 % | ±10 % | ±20 % |
|---|---|---|---|---|---|---|---|
| Total de fabricación | 15 | $260.52 | 33.2 % | **+18.9 %** | 13.3 % | 26.7 % | 40.0 % |
| Materia prima | 15 | $126.85 | 33.1 % | **+28.5 %** | 0 % | 6.7 % | 20.0 % |
| MO / GIF | 0 | — | — | — | — | — | — |

MO y GIF no se pueden medir con la extracción actual del reporte ERP, porque no trae esos campos por mueble. Para el
holdout hay que extraerlos del reporte. Si el reporte no los separa, se dice "no medible": **no se infiere**.

## Umbral de aceptación: decisión de Dirección (no la invento)

Propuesta para que Dirección la acepte o la cambie: MAPE del total ≤ 10 %, sesgo dentro de ±5 % y al menos 80 % de
los muebles dentro de ±10 %. Con la línea base actual **no se cumple ni in-sample**. Hoy Costear sirve para
presupuesto preliminar con revisión de Diseño, no para costo oficial sin revisión.
