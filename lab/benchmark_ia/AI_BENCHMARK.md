# AI_BENCHMARK — corpus y protocolo (§15–§18 / §84)

> **Honesto sobre el alcance (§5):** el corpus está en mano y el protocolo está listo. **La corrida
> a métricas reales NO se puede hacer desde la sesión de agente**: necesita una sesión autenticada
> (JWT de Dirección/Diseño) que invoque las Edge de IA (`analizar-mueble`, `leer-plano`,
> `costear-servidor`) y **gasta créditos de IA**. Esto queda para una corrida viva (la app logueada,
> o un arnés con credenciales), autorizada por Dirección. No se fingen métricas.

## Corpus (Google Drive, subido por Rodrigo 2026-10-28)

Son **despieces de ingeniería reales** (BOM con `Clave PDM` + cantidad por pieza), vitrinas TELCEL/SAMS:

| Archivo | Producto | Identidad | Qué es |
|---|---|---|---|
| `TEVHSU (1).pdf` | Vitrina HORIZONTAL 1200×1030×600 | `TEVHSU` | 25 piezas: cuerpo/frente/puertas en lámina, 4 cristales templados, KITTEVHSU (iluminación), cerraduras, niveladores, remaches, vinil logo. |
| `TEVTSU (2).pdf` | Vitrina VERTICAL 600×2295×600 | `TEVTSU` | 27 piezas: cuerpo/copete/soporte en lámina+tubular, 8 cristales, KITTEVTSU, paneles acrílico, cintas, cerraduras. |
| `TELSVH120.pdf` | Vitrina HORIZONTAL 1200×1150×600 (SAMS) | `TELSVH120` (plano usa TEVHSU) | 20 piezas: cuerpo/frente/puertas en lámina, capelo de cristal, caja de luz termoformada acrílico, TELSVH120-KIT. |
| `TELSMG.pdf` | (TELCEL/SAMS; pendiente de leer a detalle) | — | plano con BOM. |
| `TVCAC (1).pdf` | (benchmark **sparse**; pendiente de leer a detalle) | — | plano con información parcial (caso sparse §17). |
| `C-CO-320R …DIV-MATERIALES.xlsx` | módulos METAL (ya usado) | C-CO-320R | explosión `explo_x_id` + `cata_mp` (consumos + precios). Fuente del golden METAL vigente y del paquete de carga de 49 precios. |
| `TELSVH120 (2).xlsx` | explosión de TELSVH120 | — | consumos por pieza (para costear TELSVH120 al centavo, como C-CO-320R). |

## Por qué el plano solo no basta para costear (y qué prueba cada cosa)

- El plano da **geometría + BOM con claves**; NO da **consumos de materia prima** (cuántas hojas/kg por pieza fabricada). Eso vive en la **explosión xlsx**. Por eso el golden determinista se arma del xlsx (C-CO-320R ya lo hace al centavo), no del PDF.
- Las piezas `*-CUE/-CF/-P` ("EN LAMINA") son **fabricadas**, no SKU comprable → el motor las cuesta por **consumo de lámina**, no buscando una clave en catálogo. Las comerciales (`TO381CNIC`, `REP46`, `BIBIPI`, `KITTEVHSU`, `PI1015`, `TO1412CAPH`, cristales `*-CR*`, etc.) sí son insumos de catálogo.
- El **benchmark de IA** mide que, al leer el plano, la IA: (a) no **invente** un precio/SKU que no observó, (b) no presente un valor **propuesto** como **observado**, (c) marque lo que no sabe como PENDIENTE (Unknown≠$0).

## Protocolo (§15–§17)

1. **TEVHSU/TEVTSU — FULL:** se le da el plano completo (BOM con claves + dimensiones). Métrica: el despiece de la IA reproduce el BOM real (piezas, claves, cantidades) sin inventar; el costeo que NO tenga consumo/precio real sale PENDIENTE, no $0.
2. **TEVHSU/TEVTSU — BLIND:** se oculta el BOM/costeo conocido; sólo vistas/descripción. Métrica clave: `PROPOSED_AS_OBSERVED=0` — la IA no puede afirmar como "observado" lo que infirió. Lo inferido va marcado INFERIDO/SUPUESTO.
3. **TVCAC — SPARSE:** información parcial. Métrica: la IA pide/mancha lo que falta en vez de rellenar con invención.

### Métricas de aceptación (todas = 0)
- `PRICE_INVENTED_CONFIRMED = 0` — ningún precio presentado como real sin fuente.
- `SKU_INVENTED_CONFIRMED = 0` — ninguna clave comercial inventada (sólo claves observadas en el plano o resueltas contra el catálogo).
- `PROPOSED_AS_OBSERVED = 0` — nada propuesto/inferido etiquetado como observado.

## Cómo correrlo (vivo, con credenciales)

1. App logueada como Dirección/Diseño → **Costear** → subir cada PDF → revisar lectura (despiece por pieza, evidencia OBSERVED/INFERRED) → costear en servidor.
2. Comparar el despiece de la IA contra el BOM real del plano (este documento lista la verdad por archivo).
3. Para paridad al centavo: usar la explosión xlsx (`TELSVH120 (2).xlsx`) y extender el golden determinista como el de C-CO-320R (`src/motor/telcelCCO320R.golden.test.js`) — **esto SÍ corre en CI sin IA** y es el siguiente paso verificable cuando se extraiga la explosión.

## Estado
- Corpus: ✅ en Drive, legible. 3/5 planes leídos en detalle (TEVHSU/TEVTSU/TELSVH120); TELSMG/TVCAC pendientes de lectura fina.
- Protocolo + métricas: ✅ definidos.
- Corrida viva a métricas: ⛔ requiere auth + créditos (Dirección). No se finge.
- Golden determinista de TELSVH120 desde su xlsx: 🟡 siguiente paso verificable en CI (sin IA).
