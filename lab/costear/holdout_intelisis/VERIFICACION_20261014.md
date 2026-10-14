# Holdout v5 · congelamiento y verificación (14-oct-2026)

> **Vigente: v5.1** (sección siguiente). Las secciones "v5" de más abajo quedan como historia: aquel congelamiento sobre
> `2bd5092` ya no vale, porque el verificador cambió.

## v5.1 · el verificador ya no confía en el resumen de llamadas

**Hallazgo propio.** Al armar los casos de Q4 encontré un falso OK. Un `llamadas.json` con `porFn: {"costear-servidor": 1}` y `ajenas: []` daba **OK**: el verificador leía `ajenas` y `rc` del resumen tal cual, y la Edge esperada del propio archivo.

**Corrección** (`fcfedc2`):

- `unirCorrida` deriva las Edges ajenas de `porFn` **y** de las llamadas crudas (`edges.json`).
- La RC esperada (`costear-servidor-rc`) está fija en el verificador.
- Cada hoja necesita su `edges.json`. Si el resumen no cuadra con las crudas, la corrida no verifica. Cuadrar quiere decir: mismo número de llamadas de IA, mismo `porFn`, mismos `request_id` y mismo `rc`.
- El E2E guarda el `request_id` de cada llamada de IA aparte en `edges.json`. Antes el body se recortaba a 6000 caracteres y se perdía.

Pruebas: 5 nuevas (D–H) en `src/datos/holdoutHuellas.test.js`. Las 5 **fallan con el código anterior** (16 pasan y 5 fallan sobre `5057d61`).

### Congelamiento v5.1

- Congelado sobre `fcfedc2`; manifiesto en `1f7608c`.
- 108 archivos; huella `1dfa826a60726887…`.
- Base idéntica a la del congelamiento anterior (`huellas_db_20261014e.json`):
  - `insumo_precios`: 11,849 filas, md5 `6d9863e8…`;
  - `insumos_catalogo`: 11,294 filas, md5 `7a278b5b…`;
  - config y las 5 definiciones SQL iguales.
- Edges: `costear-servidor-rc` v22 `d97214c7…` y `analizar-mueble-rc` v8 `f226b792…`.

### Corrida de humo v5.1

Es la prueba de la cadena de verificación, **no** el lote nuevo de Intelisis.

- **Carpeta:** `corrida_humo_20261014b/ATPU2M` (hoja ciega ya vista).
- **Servida en** `http://localhost:5173/`, con Vite y las Edges RC, a las 15:23 UTC.
- **`0-binario.json`:** `shaApp` = `shaGit` = `1f7608c`.
- **IA:** 1 llamada, `request_id` `0b9a6d30-3ee1-4325-8f92-bcbb3fab443d`. Su evento en `ai_eventos` es `analizar-mueble-rc`/texto/`claude-opus-5`, el modelo esperado.
- **Costeo:** 5 llamadas, todas a `costear-servidor-rc`; 0 a producción.
- **Después de la corrida,** base y Edges idénticas (`*_20261014e_post.json`).

El costo de esta corrida ($571.59) no es comparable con el de la corrida anterior ($527.50). La IA propuso otro despiece, y la hoja ciega no tiene esperados. Esta corrida no mide precisión.

Hubo además una primera corrida a las 15:21 que se lanzó sin `LAB_GIT_SHA`, así que su `0-binario.json` quedó con `shaGit: null`. Se descartó y es el último caso de la tabla de abajo.

    node scripts/congelar_holdout.mjs --verificar --db lab/costear/holdout_intelisis/huellas_db_20261014e_post.json \
      --edges lab/costear/holdout_intelisis/edges_20261014e_post.json --modelos lab/costear/holdout_intelisis/modelos_20261014e.json \
      --corrida lab/costear/holdout_intelisis/corrida_humo_20261014b
    → OK: 108 archivos, base de datos, Edge, modelos, llamadas y binario idénticos al congelamiento (1dfa826a60726887). exit 0

### Falla cerrado (Q4), reproducible

Comando: `node lab/costear/holdout_intelisis/casos_falla_cerrada.mjs lab/costear/holdout_intelisis/corrida_humo_20261014b lab/costear/holdout_intelisis/huellas_db_20261014e_post.json lab/costear/holdout_intelisis/edges_20261014e_post.json lab/costear/holdout_intelisis/modelos_20261014e.json`

El script copia la corrida real, la altera y corre el verificador sobre cada copia.

| Caso | exit | Salida |
|---|---|---|
| corrida real, sin alterar | 0 | OK: 108 archivos, base de datos, Edge, modelos, llamadas y binario idénticos al congelamiento (1dfa826a60726887). |
| una llamada de IA sin request_id | 2 | NO VERIFICADO: faltan 1 llamada(s) de IA sin request_id. |
| caso costeable sin ninguna llamada a costear-servidor-rc | 2 | NO VERIFICADO: faltan 1 caso(s) costeable(s) sin llamada a costear-servidor-rc. |
| una llamada a costear-servidor (producción), resumen honesto | 1 | HOLDOUT INVÁLIDO: cambió costeo con Edge ajena: costear-servidor |
| producción en porFn pero ajenas [] en el resumen | 1 | HOLDOUT INVÁLIDO: cambió costeo con Edge ajena: costear-servidor |
| producción en las crudas, resumen "limpio" de otra corrida | 1 | HOLDOUT INVÁLIDO: cambió costeo con Edge ajena: costear-servidor |
| resumen con 2 llamadas de IA y 1 request_id | 2 | NO VERIFICADO: faltan request_id (1) ≠ llamadas de IA (2) y 1 hoja(s) cuyo llamadas.json no cuadra con sus llamadas crudas (edges.json). |
| hoja sin edges.json (sólo el resumen) | 2 | NO VERIFICADO: faltan 1 hoja(s) sin llamadas crudas (edges.json). |
| 0-binario.json sin SHA de git | 1 | HOLDOUT INVÁLIDO: cambió binario: el navegador sirvió 1f7608c y git era sin SHA |
| sin --corrida | 2 | NO VERIFICADO: faltan auditoría de la corrida (--corrida). |

Los casos "producción en porFn pero ajenas []" y "producción en las crudas, resumen limpio" daban **OK** con la v5.

## v5 (historia)


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
