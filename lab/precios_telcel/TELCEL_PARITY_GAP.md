# TELCEL_PARITY_GAP — C-CO-320R

**Snapshot auditado:** `f822958`. La rama avanzó después de ese SHA; para no “ganar paridad” con cambios posteriores, la decisión de existencia/precio/unidad se hace contra el snapshot pedido.

**BOM fuente:** `lab/precios_telcel/3949cec4_C_CO_320R_DATS_TELCEL_DIV_MATER__explo_x_id.csv`.

**Fuentes de catálogo/fixtures revisadas en el snapshot:** `src/datos/insumos.js`, `src/motor/fixtures/intelisis_alba_2026-08-12.json`, `supabase/tests/fixtures/vh146c_catalogo_real_20261014.json`, `supabase/datos/2026-10-12_a11_certificacion_erp.sql`, además de las reglas/migraciones de catálogo de `supabase/` para interpretar unidad/precio. No se consultó DB/Supabase, no se llamó IA, no se desplegó y no se modificó ningún CSV.

## Regla de auditoría

Sólo se marca como existente una identidad exacta `Artículo|Opción` o una clave comercial inequívoca. Una coincidencia de familia, descripción parecida o el mismo artículo base con otra opción **no cuenta**. Si el dato estructurado no está en el repo, se reporta como brecha.

## Universo

El BOM tiene **126 renglones económicos** y **88 identidades únicas Artículo|Opción**. El “~86” era aproximado; se conservan las 88 porque las opciones de un mismo artículo (por ejemplo PPH A529, A10 y sin opción) no son intercambiables.

## Tabla completa

| # | SKU / Artículo BOM | Opción | Unidad BOM | Precio BOM | Match exacto en repo | Unidad repo | Precio repo | Categoría | Mapeo/evidencia |
|---:|---|---|---|---:|---|---|---:|---|---|
| 1 | `MVLSLA05260402` | — | Hoja | $571.54 | sí | hoja | $571.540 | **OK** | `MVLSLA05260402` · src/motor/fixtures/intelisis_alba_2026-08-12.json |
| 2 | `MVLSLA05270402` | — | Hoja | $751.14 | no | — | — | **FALTA_SKU** | — |
| 3 | `MVLSLA05270202` | — | Hoja | $1190.49 | no | — | — | **FALTA_SKU** | — |
| 4 | `MVLQPP00000000` | A529 | Kg | $171.01 | no | — | — | **FALTA_SKU** | — |
| 5 | `MVLQPP00000000` | A10 | Kg | $249.58 | no | — | — | **FALTA_SKU** | — |
| 6 | `MLEMTM01040000` | — | pieza | $47.43 | no | — | — | **FALTA_SKU** | — |
| 7 | `MLEMTM01050000` | — | pieza | $189.75 | no | — | — | **FALTA_SKU** | — |
| 8 | `MLEMTM01060000` | — | pieza | $94.87 | no | — | — | **FALTA_SKU** | — |
| 9 | `ADHESIVOUV` | — | pieza | $2169.72 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 10 | `MVLAJA24Q8G105` | — | pieza | $94.80 | no | — | — | **FALTA_SKU** | — |
| 11 | `MVLUTO15171109` | — | pieza | $40.70 | no | — | — | **FALTA_SKU** | — |
| 12 | `MVLUTU22540002` | — | pieza | $0.62 | sí | pieza | $0.390 | **OK** | `MVLUTU22540002` · src/motor/fixtures/intelisis_alba_2026-08-12.json |
| 13 | `MVLABI19000000` | — | pieza | $13.66 | no | — | — | **FALTA_SKU** | — |
| 14 | `CRISTTEMPLAT` | — | pieza | $110.93 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 15 | `CRISTTEMPCUB` | — | pieza | $465.24 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 16 | `CRISTTEMPFRE` | — | pieza | $215.42 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 17 | `CANALUM` | — | pieza | $79.20 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 18 | `MLEQSC00000000` | — | pieza | $139.20 | no | — | — | **FALTA_SKU** | — |
| 19 | `TERMOFORMADO` | — | pieza | $2840.50 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 20 | `MLEAJG130000V0` | — | jgo | $93.60 | no | — | — | **FALTA_SKU** | — |
| 21 | `MVLEKT03000086` | — | pieza | $2535.00 | no | — | — | **FALTA_SKU** | — |
| 22 | `MVLACE230000V6` | — | pieza | $416.00 | no | — | — | **FALTA_SKU** | — |
| 23 | `MLEAPS00A20005` | — | pieza | $57.11 | no | — | — | **FALTA_SKU** | — |
| 24 | `LOGO` | — | pieza | $78.00 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 25 | `PLSERIGRAFIADA` | — | pieza | $54.00 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 26 | `MVLUPI03452101` | — | pieza | $0.29 | no | — | — | **FALTA_SKU** | — |
| 27 | `MIEEPP03110001` | — | pieza | $38.00 | no | — | — | **FALTA_SKU** | — |
| 28 | `MVLREF00634532` | — | rollo | $7.50 | no | — | — | **FALTA_SKU** | — |
| 29 | `MIEECI00140600` | — | pieza | $22.00 | no | — | — | **FALTA_SKU** | — |
| 30 | `MIMCSQCR010000` | — | pieza | $16.00 | no | — | — | **FALTA_SKU** | — |
| 31 | `MVLSLA05260502` | — | Hoja | $428.65 | sí | hoja | $428.650 | **OK** | `lamina-3x10-20` · supabase/datos/2026-10-12_a11_certificacion_erp.sql |
| 32 | `MVLSLA05260202` | — | Hoja | $816.48 | sí | hoja | $816.480 | **OK** | `lamina-3x10-14` · supabase/datos/2026-10-12_a11_certificacion_erp.sql |
| 33 | `MVLSTU01080501` | — | pieza | $96.71 | no | — | — | **FALTA_SKU** | — |
| 34 | `MVLSLA05270502` | — | Hoja | $571.52 | no | — | — | **FALTA_SKU** | — |
| 35 | `MVLMMR050000E7` | — | pieza | $26.50 | no | — | — | **FALTA_SKU** | — |
| 36 | `MVLQPP00000000` | — | Kg | $449.06 | no | — | — | **FALTA_SKU** | — |
| 37 | `MVLPAW64823400` | — | Hoja | $3155.00 | no | — | — | **FALTA_SKU** | — |
| 38 | `MVLUTU22550002` | — | pieza | $0.16 | no | — | — | **FALTA_SKU** | — |
| 39 | `MVLUTU22520002` | — | pieza | $0.30 | sí | pieza | $0.220 | **OK** | `MVLUTU22520002` · src/motor/fixtures/intelisis_alba_2026-08-12.json |
| 40 | `MTLUPE40A87322` | — | pieza | $11.00 | no | — | — | **FALTA_SKU** | — |
| 41 | `MLEPRV000700E5` | — | pieza | $27.30 | no | — | — | **FALTA_SKU** | — |
| 42 | `MVLUTO17110002` | — | pieza | $0.85 | no | — | — | **FALTA_SKU** | — |
| 43 | `MVLUTO42580002` | — | pieza | $0.28 | no | — | — | **FALTA_SKU** | — |
| 44 | `MVLURE28003504` | — | pieza | $0.31 | no | — | — | **FALTA_SKU** | — |
| 45 | `MVLACI060600V1` | — | m | $61.20 | no | — | — | **FALTA_SKU** | — |
| 46 | `MLECCR06NP07Z3` | — | pieza | $525.00 | no | — | — | **FALTA_SKU** | — |
| 47 | `MLEAPV63005524` | — | jgo | $585.00 | no | — | — | **FALTA_SKU** | — |
| 48 | `MTLATO55M27928` | — | pieza | $18.50 | no | — | — | **FALTA_SKU** | — |
| 49 | `MVLUPI10350001` | — | pieza | $0.50 | no | — | — | **FALTA_SKU** | — |
| 50 | `MVLUTO07110002` | — | pieza | $0.40 | no | — | — | **FALTA_SKU** | — |
| 51 | `MLEPRV000700E4` | — | pieza | $27.30 | no | — | — | **FALTA_SKU** | — |
| 52 | `MLECCR00NÑ07Z3` | — | pieza | $772.47 | no | — | — | **FALTA_SKU** | — |
| 53 | `MLECCR00NO060L` | — | pieza | $505.21 | no | — | — | **FALTA_SKU** | — |
| 54 | `MVLUTO15175209` | — | pieza | $12.10 | no | — | — | **FALTA_SKU** | — |
| 55 | `MVLABI19008557` | — | pieza | $21.35 | no | — | — | **FALTA_SKU** | — |
| 56 | `MVLEKT030000A4` | — | pieza | $2500.00 | no | — | — | **FALTA_SKU** | — |
| 57 | `MLECCR06NQ07Z3` | — | pieza | $527.80 | no | — | — | **FALTA_SKU** | — |
| 58 | `MVLATO42480000` | — | pieza | $0.97 | no | — | — | **FALTA_SKU** | — |
| 59 | `MVLEAN008500A8` | — | pieza | $477.60 | no | — | — | **FALTA_SKU** | — |
| 60 | `MLEECL000200A9` | — | pieza | $48.00 | no | — | — | **FALTA_SKU** | — |
| 61 | `MVLSLA05280402` | — | Hoja | $585.51 | no | — | — | **FALTA_SKU** | — |
| 62 | `MVLSTU01080401` | — | pieza | $132.50 | no | — | — | **FALTA_SKU** | — |
| 63 | `MPMTLA01030601` | — | — | $900.38 | no | — | — | **UNIDAD_DUDOSA** | — |
| 64 | `LN1838` | — | — | $722.46 | no | — | — | **UNIDAD_DUDOSA** | — |
| 65 | `LN2038` | — | — | $541.86 | no | — | — | **UNIDAD_DUDOSA** | — |
| 66 | `CRISTREPISA` | — | pieza | $332.55 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 67 | `CRISTLATERAL` | — | pieza | $784.47 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 68 | `CRISTPUERTA` | — | pieza | $784.47 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 69 | `TUB1"CED30` | — | pieza | $346.80 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 70 | `MLEABD00711611` | — | pieza | $48.00 | no | — | — | **FALTA_SKU** | — |
| 71 | `RONPET` | — | pieza | $2.78 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 72 | `CHAPINOX` | — | pieza | $30.00 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 73 | `CERRCRISTAL` | — | pieza | $326.72 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 74 | `LAMPLED` | — | pieza | $20.88 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 75 | `SEPALUM3/4` | — | pieza | $41.42 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 76 | `APAGADOR` | — | pieza | $9.00 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 77 | `CABUSORUDO3X16` | — | pieza | $18.00 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 78 | `CABCAL14` | — | pieza | $6.86 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 79 | `CLAVBLIND` | — | pieza | $76.00 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 80 | `BUJE34MM` | — | pieza | $150.00 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 81 | `ROLDPRES3/8` | — | pieza | $1.24 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 82 | `TORCABHEX3/8` | — | pieza | $7.18 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 83 | `LOCTITE` | — | pieza | $337.16 | no | — | — | **NOMBRE_AMIGABLE** | — |
| 84 | `MVLEPL0408C8A6` | — | pieza | $45.00 | no | — | — | **FALTA_SKU** | — |
| 85 | `BUJES` | — | — | $136.00 | no | — | — | **UNIDAD_DUDOSA** | — |
| 86 | `CILINCHAPITAS` | — | — | $53.27 | no | — | — | **UNIDAD_DUDOSA** | — |
| 87 | `CERRPALETA` | — | — | $43.87 | no | — | — | **UNIDAD_DUDOSA** | — |
| 88 | `JALEMBUTIR` | — | — | $78.00 | no | — | — | **UNIDAD_DUDOSA** | — |

## Conteo

- **OK: 5**
- **FALTA_PRECIO: 0**
- **FALTA_SKU: 51**
- **NOMBRE_AMIGABLE: 25**
- **UNIDAD_DUDOSA: 7**

## Lista exacta a cargar o mapear

Quedan **83** identidades fuera de `OK` en el snapshot auditado:

- `MVLSLA05270402` — **FALTA_SKU**.
- `MVLSLA05270202` — **FALTA_SKU**.
- `MVLQPP00000000\|A529` — **FALTA_SKU**.
- `MVLQPP00000000\|A10` — **FALTA_SKU**.
- `MLEMTM01040000` — **FALTA_SKU**.
- `MLEMTM01050000` — **FALTA_SKU**.
- `MLEMTM01060000` — **FALTA_SKU**.
- `ADHESIVOUV` — **NOMBRE_AMIGABLE**.
- `MVLAJA24Q8G105` — **FALTA_SKU**.
- `MVLUTO15171109` — **FALTA_SKU**.
- `MVLABI19000000` — **FALTA_SKU**.
- `CRISTTEMPLAT` — **NOMBRE_AMIGABLE**.
- `CRISTTEMPCUB` — **NOMBRE_AMIGABLE**.
- `CRISTTEMPFRE` — **NOMBRE_AMIGABLE**.
- `CANALUM` — **NOMBRE_AMIGABLE**.
- `MLEQSC00000000` — **FALTA_SKU**.
- `TERMOFORMADO` — **NOMBRE_AMIGABLE**.
- `MLEAJG130000V0` — **FALTA_SKU**.
- `MVLEKT03000086` — **FALTA_SKU**.
- `MVLACE230000V6` — **FALTA_SKU**.
- `MLEAPS00A20005` — **FALTA_SKU**.
- `LOGO` — **NOMBRE_AMIGABLE**.
- `PLSERIGRAFIADA` — **NOMBRE_AMIGABLE**.
- `MVLUPI03452101` — **FALTA_SKU**.
- `MIEEPP03110001` — **FALTA_SKU**.
- `MVLREF00634532` — **FALTA_SKU**.
- `MIEECI00140600` — **FALTA_SKU**.
- `MIMCSQCR010000` — **FALTA_SKU**.
- `MVLSTU01080501` — **FALTA_SKU**.
- `MVLSLA05270502` — **FALTA_SKU**.
- `MVLMMR050000E7` — **FALTA_SKU**.
- `MVLQPP00000000` — **FALTA_SKU**.
- `MVLPAW64823400` — **FALTA_SKU**.
- `MVLUTU22550002` — **FALTA_SKU**.
- `MTLUPE40A87322` — **FALTA_SKU**.
- `MLEPRV000700E5` — **FALTA_SKU**.
- `MVLUTO17110002` — **FALTA_SKU**.
- `MVLUTO42580002` — **FALTA_SKU**.
- `MVLURE28003504` — **FALTA_SKU**.
- `MVLACI060600V1` — **FALTA_SKU**.
- `MLECCR06NP07Z3` — **FALTA_SKU**.
- `MLEAPV63005524` — **FALTA_SKU**.
- `MTLATO55M27928` — **FALTA_SKU**.
- `MVLUPI10350001` — **FALTA_SKU**.
- `MVLUTO07110002` — **FALTA_SKU**.
- `MLEPRV000700E4` — **FALTA_SKU**.
- `MLECCR00NÑ07Z3` — **FALTA_SKU**.
- `MLECCR00NO060L` — **FALTA_SKU**.
- `MVLUTO15175209` — **FALTA_SKU**.
- `MVLABI19008557` — **FALTA_SKU**.
- `MVLEKT030000A4` — **FALTA_SKU**.
- `MLECCR06NQ07Z3` — **FALTA_SKU**.
- `MVLATO42480000` — **FALTA_SKU**.
- `MVLEAN008500A8` — **FALTA_SKU**.
- `MLEECL000200A9` — **FALTA_SKU**.
- `MVLSLA05280402` — **FALTA_SKU**.
- `MVLSTU01080401` — **FALTA_SKU**.
- `MPMTLA01030601` — **UNIDAD_DUDOSA**.
- `LN1838` — **UNIDAD_DUDOSA**.
- `LN2038` — **UNIDAD_DUDOSA**.
- `CRISTREPISA` — **NOMBRE_AMIGABLE**.
- `CRISTLATERAL` — **NOMBRE_AMIGABLE**.
- `CRISTPUERTA` — **NOMBRE_AMIGABLE**.
- `TUB1"CED30` — **NOMBRE_AMIGABLE**.
- `MLEABD00711611` — **FALTA_SKU**.
- `RONPET` — **NOMBRE_AMIGABLE**.
- `CHAPINOX` — **NOMBRE_AMIGABLE**.
- `CERRCRISTAL` — **NOMBRE_AMIGABLE**.
- `LAMPLED` — **NOMBRE_AMIGABLE**.
- `SEPALUM3/4` — **NOMBRE_AMIGABLE**.
- `APAGADOR` — **NOMBRE_AMIGABLE**.
- `CABUSORUDO3X16` — **NOMBRE_AMIGABLE**.
- `CABCAL14` — **NOMBRE_AMIGABLE**.
- `CLAVBLIND` — **NOMBRE_AMIGABLE**.
- `BUJE34MM` — **NOMBRE_AMIGABLE**.
- `ROLDPRES3/8` — **NOMBRE_AMIGABLE**.
- `TORCABHEX3/8` — **NOMBRE_AMIGABLE**.
- `LOCTITE` — **NOMBRE_AMIGABLE**.
- `MVLEPL0408C8A6` — **FALTA_SKU**.
- `BUJES` — **UNIDAD_DUDOSA**.
- `CILINCHAPITAS` — **UNIDAD_DUDOSA**.
- `CERRPALETA` — **UNIDAD_DUDOSA**.
- `JALEMBUTIR` — **UNIDAD_DUDOSA**.

## Notas de integridad

- **OK** exige identidad, unidad y precio utilizables en el repo. Que el precio difiera del workbook no se oculta ni se corrige: el reporte muestra ambos.
- **FALTA_PRECIO** significa que la identidad aparece en catálogo/fixture, pero el snapshot no demuestra precio utilizable.
- **FALTA_SKU** significa que no se demostró la identidad exacta en las fuentes del motor revisadas; no se sustituyó por un material de la misma familia.
- **NOMBRE_AMIGABLE** cubre etiquetas de proyecto o claves legibles como `CRISTTEMPCUB`, `LAMPLED` y `LOGO`. Sólo se propone una clave real cuando el repo contiene una correspondencia inequívoca.
- **UNIDAD_DUDOSA** tiene prioridad cuando el BOM trae unidad vacía. No se convierte “HOJA” o “pieza” inferida desde la descripción en un dato estructurado sin evidencia explícita.

## Contexto del golden METAL ya demostrado

El trabajo previo en esta rama ya reconstruyó desde consumo × precio del workbook los cuatro subtotales METAL: Vitrina Horizontal **$4,483.13**, Vitrina Torre **$2,966.15**, Vitrina Isla **$3,297.84** y Módulo de almacenamiento **$3,596.14**. Eso demuestra la aritmética cuando el motor recibe el BOM correcto; este reporte identifica la brecha de catálogo necesaria para hacerlo de punta a punta sin inventar identidades.

## Conclusión

A `f822958`, el cuello de botella para TELCEL completo no es “hacer que el total cuadre”: es **cargar o mapear con trazabilidad las identidades faltantes, conservar las opciones y resolver las unidades vacías**. Ninguna brecha de esta tabla debe cerrarse por parecido de nombre o familia.
