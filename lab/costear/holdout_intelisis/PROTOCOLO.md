# Holdout Intelisis: protocolo de prueba fuera de muestra (14-oct-2026)

## Por qué

La prueba ciega r2 **no es predicción**. Las correcciones se hicieron después de ver r1 sobre **los mismos 15
componentes**, así que mide ajuste. Para saber si Costear acierta con muebles que no conoce hacen falta muebles
**nuevos**: de 10 a 15 reportes del cotizador Intelisis que nadie del equipo de la app haya visto. **No existen
todavía**: los debe entregar Compras.

## Reglas (se fijan ANTES de ver los datos)

1. **Congelamiento v2** (reauditoría externa 14-oct, P1-02). Congelado el 14-oct con la huella `21538b2b527cc2f1…`.
   - **Código:** sha256 de 39 archivos (motor, estado, materiales, Edge RC de costeo y de análisis con su prompt,
     laboratorio, métricas, comparador y la propia consulta de huellas).
   - **Base de datos** (`huellas_db.sql` → `huellas_db_20261014.json`):
     - `insumo_precios` con TODAS las columnas que mueven la selección o la certificación: precio, estado,
       confidence, vigencias, aprobador, fecha, documento, unidad, factor, contrato, hash;
     - `insumos_catalogo` con nombre, familia, clasificación, sección, atributos, unidad y activo;
     - `config`;
     - md5 de `catalogo_vigente`, `catalogo_motor` (pública y privada), `insumo_motor` y `buscar_insumos_motor`.
   - **Edge desplegadas** (`edges_20261014.json`): `costear-servidor-rc` v17 y `analizar-mueble-rc` v8, con versión
     y `ezbr_sha256`.
2. **Antes de correr:** se vuelven a medir las huellas (`huellas_db.sql` con solo lectura, y la lista de Edge) y se
   ejecuta:
   `node scripts/congelar_holdout.mjs --verificar --db <huellas_hoy.json> --edges <edges_hoy.json>`
   - **exit 0 (OK):** se puede correr.
   - **exit 1 (cambió algo):** la corrida **no cuenta**.
   - **exit 2 (faltan huellas):** **no hay verificación**. Correr `--verificar` sin `--db`/`--edges` ya no puede
     decir OK.
   - **Modelo de IA:** el `model_id` que resolvió la Edge queda en `ai_eventos` por llamada. La corrida lo extrae y
     lo reporta. No se congela el comportamiento del proveedor: cualquier cambio de modelo se ve en el reporte.
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
