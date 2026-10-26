# TELCEL_LOAD_PLAN — C-CO-320R

**Rama:** `claude/costing-app-architecture-psf02g`  
**Base de análisis:** HEAD `2bc787b8f214d3c00dbd071930bb37f91052c804`  
**Gap fuente:** `lab/precios_telcel/TELCEL_PARITY_GAP.md`  
**Catálogo fuente:** `lab/precios_telcel/3949cec4_C_CO_320R_DATS_TELCEL_DIV_MATER__cata_mp.csv`

## Regla

Se revisaron únicamente las **51** identidades `FALTA_SKU` y las **7** `UNIDAD_DUDOSA` del gap (58 en total). Un material es **AUTO_CARGABLE** sólo si `cata_mp` contiene el **mismo Artículo + la misma Opción exacta**, con precio numérico positivo y unidad no vacía. Si no aparece la identidad exacta, si cambia la opción, si la unidad no es usable o si no hay precio, se clasifica **NECESITA_HUMANO**. No se usaron matches por descripción, familia o clave parecida.

## Resumen

- **AUTO_CARGABLE: 49**
- **NECESITA_HUMANO: 9**
- **Total revisado: 58**

> “AUTO_CARGABLE” significa que el registro puede cargarse técnicamente desde este `cata_mp` sin inventar identidad/unidad/precio. No significa que el precio quede automáticamente certificado como vigente para emisión comercial.

## AUTO_CARGABLE — lista exacta lista para cargar

| # | Artículo | Opción | Clave comercial | Precio cata_mp | Unidad | Fecha última compra | Fila cata_mp |
|---:|---|---|---|---:|---|---|---:|
| 1 | `MVLSLA05270402` | — | LN18410 | $751.14 | Hoja | 2024-06-27 00:00:00 | 7799 |
| 2 | `MVLSLA05270202` | — | LN14410 | $1190.49 | Hoja | 2024-06-24 00:00:00 | 7797 |
| 3 | `MVLQPP00000000` | A529 | PPH | $142.51 | Kg | 2020-07-08 00:00:00 | 11128 |
| 4 | `MVLQPP00000000` | A10 | PPH | $207.98 | Kg | 2018-08-28 00:00:00 | 11040 |
| 5 | `MLEMTM01040000` | — | TMP534250 | $47.43 | pieza | 2024-05-31 00:00:00 | 14805 |
| 6 | `MLEMTM01050000` | — | TMP1011425 | $189.75 | pieza | 2024-07-03 00:00:00 | 14804 |
| 7 | `MLEMTM01060000` | — | TMP1034250 | $94.87 | pieza | 2024-07-03 00:00:00 | 14807 |
| 8 | `MVLAJA24Q8G105` | — | NULL | $79.00 | pieza | 2022-02-04 00:00:00 | 7409 |
| 9 | `MVLUTO15171109` | — | TO3812NIC | $40.70 | pieza | 2024-01-31 00:00:00 | 15166 |
| 10 | `MVLABI19000000` | — | BIBI | $12.25 | pieza | 2024-03-05 00:00:00 | 1450 |
| 11 | `MLEQSC00000000` | — | AD-0008 | $78.00 | pieza | 2024-05-24 00:00:00 | 12786 |
| 12 | `MLEAJG130000V0` | — | COEME20N | $92.70 | jgo | 2024-07-08 00:00:00 | 7456 |
| 13 | `MVLEKT03000086` | — | KLED4LUM | $6600.00 | pieza | 2020-02-28 00:00:00 | 7547 |
| 14 | `MVLACE230000V6` | — | CICL100271 | $320.00 | pieza | 2019-03-22 00:00:00 | 2361 |
| 15 | `MLEAPS00A20005` | — | P35CR | $57.11 | pieza | 2024-02-16 00:00:00 | 10401 |
| 16 | `MVLUPI03452101` | — | PITR114 | $0.29 | pieza | 2022-07-14 00:00:00 | 10989 |
| 17 | `MIEEPP03110001` | — | PEPA25 | $38.00 | pieza | 2024-07-08 00:00:00 | 10467 |
| 18 | `MVLREF00634532` | — | ESPR210518 | $1030.00 | rollo | 2024-05-13 00:00:00 | 6332 |
| 19 | `MIEECI00140600` | — | CT48 | $22.00 | pieza | 2024-06-17 00:00:00 | 12431 |
| 20 | `MIMCSQCR010000` | — | EQCAK224180 | $16.00 | pieza | 2023-01-03 00:00:00 | 6460 |
| 21 | `MVLSTU01080501` | — | TC201 | $96.71 | pieza | 2024-05-21 00:00:00 | 15370 |
| 22 | `MVLSLA05270502` | — | LN20410 | $571.52 | Hoja | 2024-06-24 00:00:00 | 7801 |
| 23 | `MVLMMR050000E7` | — | ME258EX | $26.50 | pieza | 2018-10-01 00:00:00 | 8439 |
| 24 | `MVLPAW64823400` | — | ACBL45462447 | $2744.00 | Hoja | 2018-07-18 00:00:00 | 126 |
| 25 | `MVLUTU22550002` | — | TU316HE | $0.16 | pieza | 2022-08-10 00:00:00 | 15538 |
| 26 | `MTLUPE40A87322` | — | TAP1214 | $11.00 | pieza | 2018-07-30 00:00:00 | 10778 |
| 27 | `MLEPRV000700E5` | — | TEVTSU-LOBL | $20.50 | pieza | 2018-10-12 00:00:00 | 11954 |
| 28 | `MVLUTO17110002` | — | TO1412CAPH | $0.85 | pieza | 2023-10-20 00:00:00 | 15116 |
| 29 | `MVLUTO42580002` | — | TO31638CC | $0.28 | pieza | 2018-07-24 00:00:00 | 15121 |
| 30 | `MVLURE28003504` | — | REP46 | $0.31 | pieza | 2024-06-17 00:00:00 | 12190 |
| 31 | `MVLACI060600V1` | — | CIDBM4403 | $50.57 | m | 2018-08-10 00:00:00 | 2770 |
| 32 | `MLECCR06NP07Z3` | — | TEVTSU-CR1 | $403.00 | pieza | 2018-10-19 00:00:00 | 5652 |
| 33 | `MLEAPV63005524` | — | PIVRF50 | $450.43 | jgo | 2018-10-08 00:00:00 | 11410 |
| 34 | `MTLATO55M27928` | — | VVCNITPC | $18.50 | pieza | 2018-07-30 00:00:00 | 14831 |
| 35 | `MVLUPI10350001` | — | PI1015 | $0.50 | pieza | 2023-01-17 00:00:00 | 10937 |
| 36 | `MVLUTO07110002` | — | TO14CG | $0.40 | pieza | 2024-03-05 00:00:00 | 15002 |
| 37 | `MLEPRV000700E4` | — | TEVTSU-LOBF | $20.50 | pieza | 2018-10-12 00:00:00 | 11955 |
| 38 | `MLECCR00NÑ07Z3` | — | TEVTSU-CR3 | $594.21 | pieza | 2018-10-15 00:00:00 | 5677 |
| 39 | `MLECCR00NO060L` | — | TEVHSU-EN | $388.62 | pieza | 2018-11-30 00:00:00 | 4307 |
| 40 | `MVLUTO15175209` | — | TO381CNIC | $12.10 | pieza | 2023-12-01 00:00:00 | 15165 |
| 41 | `MVLABI19008557` | — | BIBIPI | $21.35 | pieza | 2022-10-04 00:00:00 | 1441 |
| 42 | `MVLEKT030000A4` | — | KITTEVTSU | $1488.68 | pieza | 2019-08-15 00:00:00 | 7546 |
| 43 | `MLECCR06NQ07Z3` | — | TEVTSU-CR2 | $406.00 | pieza | 2018-10-19 00:00:00 | 5653 |
| 44 | `MVLATO42480000` | — | BTSJ | $0.97 | pieza | 2022-11-29 00:00:00 | 14819 |
| 45 | `MVLEAN008500A8` | — | TELARNTMVHV | $398.00 | pieza | 2018-10-11 00:00:00 | 969 |
| 46 | `MLEECL000200A9` | — | CC50KIL | $40.00 | pieza | 2018-09-18 00:00:00 | 2137 |
| 47 | `MVLSLA05280402` | — | LN1848 | $585.51 | Hoja | 2017-05-12 00:00:00 | 7809 |
| 48 | `MVLSTU01080401` | — | TC181 | $158.20 | pieza | 2024-06-17 00:00:00 | 15362 |
| 49 | `MLEABD00711611` | — | BRA212 | $40.00 | pieza | 2011-08-15 00:00:00 | 1647 |

## NECESITA_HUMANO

| # | Artículo | Opción | Categoría previa | Motivo exacto |
|---:|---|---|---|---|
| 1 | `MVLQPP00000000` | — | FALTA_SKU | No aparece la identidad exacta Artículo\|Opción en cata_mp. |
| 2 | `MPMTLA01030601` | — | UNIDAD_DUDOSA | No aparece la identidad exacta Artículo\|Opción en cata_mp. |
| 3 | `LN1838` | — | UNIDAD_DUDOSA | No aparece la identidad exacta Artículo\|Opción en cata_mp. |
| 4 | `LN2038` | — | UNIDAD_DUDOSA | No aparece la identidad exacta Artículo\|Opción en cata_mp. |
| 5 | `MVLEPL0408C8A6` | — | FALTA_SKU | La identidad exacta aparece, pero no tiene precio positivo y unidad usable. |
| 6 | `BUJES` | — | UNIDAD_DUDOSA | No aparece la identidad exacta Artículo\|Opción en cata_mp. |
| 7 | `CILINCHAPITAS` | — | UNIDAD_DUDOSA | No aparece la identidad exacta Artículo\|Opción en cata_mp. |
| 8 | `CERRPALETA` | — | UNIDAD_DUDOSA | No aparece la identidad exacta Artículo\|Opción en cata_mp. |
| 9 | `JALEMBUTIR` | — | UNIDAD_DUDOSA | No aparece la identidad exacta Artículo\|Opción en cata_mp. |

### Evidencia de los casos humanos

- `MVLQPP00000000`: No aparece la identidad exacta Artículo|Opción en cata_mp.
- `MPMTLA01030601`: No aparece la identidad exacta Artículo|Opción en cata_mp.
- `LN1838`: No aparece la identidad exacta Artículo|Opción en cata_mp.
- `LN2038`: No aparece la identidad exacta Artículo|Opción en cata_mp.
- `MVLEPL0408C8A6`: La identidad exacta aparece, pero no tiene precio positivo y unidad usable. En cata_mp aparece en fila 11436 con unidad `pieza`, precio `vacío` y fecha `vacía`.
- `BUJES`: No aparece la identidad exacta Artículo|Opción en cata_mp.
- `CILINCHAPITAS`: No aparece la identidad exacta Artículo|Opción en cata_mp.
- `CERRPALETA`: No aparece la identidad exacta Artículo|Opción en cata_mp.
- `JALEMBUTIR`: No aparece la identidad exacta Artículo|Opción en cata_mp.

## Resultado operativo

Con este cruce estricto, **49 de las 58 brechas seleccionadas pueden alimentarse desde el propio catálogo histórico `cata_mp` sin inventar identidad**, mientras que **9 deben quedar bloqueadas para revisión humana**. La carga posterior debe conservar `Artículo`, `Opción`, unidad, precio, fecha y provenance del CSV; no debe sustituir automáticamente una opción por otra ni usar un material “equivalente” de la misma familia.
