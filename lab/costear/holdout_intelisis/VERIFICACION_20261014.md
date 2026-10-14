# Holdout v5 · congelamiento y verificación (14-oct-2026)

## Congelamiento

- **Commit congelado:** `2bd5092`. El manifiesto se guardó en `33c2837`.
- **Contenido:** 108 archivos (cierre transitivo de imports, incluido `src/datos/promesaComercial.js`) y `package-lock.json`.
- **Huella total:** `1496aefd3f8d5c47…`
- **Base de datos** (`huellas_db_20261014d.json`):
  - `insumo_precios`: 11,849 filas (incluye los 499 precios `propuesto` de compras 2026);
  - `insumos_catalogo`: 11,294;
  - `config` y definiciones SQL de `catalogo_vigente`, `catalogo_motor` (x2), `insumo_motor` y `buscar_insumos_motor`.
- **Edges** (`edges_20261014d.json`):
  - `costear-servidor-rc` v22, `d97214c7db06…` (despliegue 43, contiene la rev4);
  - `analizar-mueble-rc` v8, `f226b7927d34…`.
- **Modelos esperados:** `analizar-mueble-rc`, con texto → `claude-opus-5`; imagen y revisión → `claude-opus-5-5`.

## Corrida de humo

Es para probar la cadena de verificación. **No** es el lote nuevo de Intelisis.

- **Hoja:** `lab/costear/ciego_erp/hojas/ATPU2M.json`, una hoja ciega ya vista antes, no del holdout.
- **Servida en** `http://localhost:5173/` (Vite con las Edges RC), a las 14:47 UTC, sobre `18088fd`.
  - `0-binario.json` registra `shaApp` = `shaGit` = `18088fd`.
  - Entre `2bd5092` y `18088fd` sólo cambian archivos que no son código (`MANIFIESTO.json`, huellas y `modelos_observados.sql`).
- **Llamadas** (`llamadas.json`):
  - IA: 1 llamada, con `request_id` `bebc8cfa-1194-4c43-904e-4b0ba230ecce` (evento en `ai_eventos`: texto, `claude-opus-5`);
  - costeo: 5 llamadas, todas a `costear-servidor-rc`, ninguna a otra Edge;
  - motivos: ninguno.
- **Después de la corrida**, las huellas de base y de Edges son idénticas a las congeladas.

## Verificación

    node scripts/congelar_holdout.mjs --verificar --db lab/costear/holdout_intelisis/huellas_db_20261014d_post.json \
      --edges lab/costear/holdout_intelisis/edges_20261014d_post.json --modelos lab/costear/holdout_intelisis/modelos_20261014d.json \
      --corrida lab/costear/holdout_intelisis/corrida_humo_20261014
    → OK: 108 archivos, base de datos, Edge, modelos, llamadas y binario idénticos al congelamiento (1496aefd3f8d5c47). exit 0

## Falla cerrado (Q4)

Se corrió la misma verificación sobre copias alteradas de la corrida:

| Caso | Salida | exit |
|---|---|---|
| Una llamada de IA sin `request_id` | `NO VERIFICADO: faltan 1 llamada(s) de IA sin request_id.` | 2 |
| Caso costeable sin llamada a `costear-servidor-rc` | `NO VERIFICADO: faltan 1 caso(s) costeable(s) sin llamada a costear-servidor-rc.` | 2 |
| Una llamada a `costear-servidor`, la de producción | `HOLDOUT INVÁLIDO: cambió costeo con Edge ajena: costear-servidor` | 1 |
| Sin `--corrida` | `NO VERIFICADO: faltan auditoría de la corrida (--corrida).` | 2 |

## Defecto corregido en este paso

`modelos_observados.sql` comparaba `request_id`, que es `uuid`, contra `text[]`, y fallaba con el error 42883. Ahora usa `request_id::text`. Por ese cambio se recongeló sobre `2bd5092`.

## Invalidaciones previstas

El holdout se invalida y hay que congelarlo otra vez antes de ver resultados en dos casos:

- cuando Rodrigo firme los precios del ERP, porque cambian `estado` y `approved_*` en `insumo_precios`;
- ante cualquier cambio de motor, prompts, catálogo, config, precios, matching, estados, Edge o modelo.
