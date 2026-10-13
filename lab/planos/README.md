# Laboratorio de lectura de planos (Bloque L1)

- `gen_corpus.py` genera el corpus sintético (PDF A3 de buena calidad + `control.json` por plano): recto, curvo (muro curvo, sala circular, trapecio), sin cotas con barra gráfica y columnas, dos niveles en dos páginas, planta en L. Requiere `matplotlib`.
- `medir.mjs` manda cada `plano.pdf` al edge `leer-plano` (o `LEER_FN=leer-plano-rc`) con la sesión QA (`TEST_EMAIL`/`TEST_PASSWORD`) y compara contra `control.json`: áreas, m² (±8 %), puestos, asientos, tipo, puertas (±0.6 m), barridos, columnas, envolvente, página/nivel. Imprime una tabla.

```
cd lab/planos && python3 gen_corpus.py
NODE_USE_ENV_PROXY=1 TEST_EMAIL=… TEST_PASSWORD=… CORPUS_DIR=. node medir.mjs            # producción (NODE_USE_ENV_PROXY si hay proxy)
TEST_EMAIL=… TEST_PASSWORD=… CORPUS_DIR=. LEER_FN=leer-plano-rc node medir.mjs   # RC
```
Los PDFs y las lecturas no se versionan (se regeneran). Los planos reales de Dirección se agregan como carpetas con su `control.json`.
