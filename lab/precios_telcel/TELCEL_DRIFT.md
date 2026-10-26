# TELCEL_DRIFT — C-CO-320R · METAL

**Rama:** `claude/costing-app-architecture-psf02g`  
**Base:** HEAD `8575539fa6c42fde62b69d2f63cb34d4ea901dd9`  
**BOM histórico:** `lab/precios_telcel/3949cec4_C_CO_320R_DATS_TELCEL_DIV_MATER__explo_x_id.csv`  
**Precios actuales:** `cata_mp`, usando identidad exacta `Artículo|Opción` y el criterio de `TELCEL_LOAD_PLAN.md`.

## Método

- **Histórico:** suma de `costo_unitario` de cada línea METAL del BOM. Esto preserva el redondeo del workbook.
- **Actual conocido:** `consumo_unitario × costo_última_compra` de `cata_mp`, sólo cuando existe identidad exacta y precio/unidad utilizables.
- **Pendiente:** cualquier línea que dependa de un `NECESITA_HUMANO`, carezca de Artículo exacto o no tenga precio/unidad utilizables. No se infiere ni sustituye por familia, descripción o opción parecida.
- **Cobertura:** costo histórico de las líneas con precio actual conocido ÷ costo histórico total del módulo.
- **Delta comparable:** actual conocido − histórico de esas mismas líneas cubiertas. Si la cobertura no es 100%, **no se presenta un delta total completo**, porque sería mezclar un subtotal actual con un total histórico.

## Resumen por módulo

| Módulo METAL | Histórico total | Histórico cubierto | Histórico pendiente | Cobertura | Actual conocido | Delta comparable $ | Delta comparable % | Delta total |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Vitrina Horizontal | $4,483.13 | $4,483.13 | $0.00 | 100.00% | $4,414.28 | $-68.85 | -1.54% | $-68.85 / -1.54% |
| Vitrina Torre | $2,966.15 | $2,460.06 | $506.09 | 82.94% | $2,433.02 | $-27.04 | -1.10% | **PENDIENTE** |
| Vitrina Isla | $3,297.84 | $2,783.13 | $514.71 | 84.39% | $2,820.17 | $37.04 | 1.33% | **PENDIENTE** |
| Módulo de Almacenamiento | $3,596.14 | $2,423.68 | $1,172.46 | 67.40% | $2,350.53 | $-73.15 | -3.02% | **PENDIENTE** |
| **TOTAL 4 módulos** | **$14,343.26** | **$12,150.00** | **$2,193.26** | **84.71%** | **$12,018.00** | **$-132.00** | **-1.09%** | **PENDIENTE** |

## Lectura

- El costo histórico METAL de los cuatro módulos suma **$14,343.26**.
- Las líneas con identidad/precio actual exactos representan **$12,150.00** del histórico, equivalente a **84.71%** de cobertura.
- Quedan **$2,193.26** de costo histórico (**15.29%**) sin precio actual autorizado.
- Sobre el tramo comparable cubierto, el costo pasa de **$12,150.00** histórico a **$12,018.00** actual: **$-132.00 (-1.09%)**.
- Ese **-$132.00** no debe interpretarse todavía como ahorro total del proyecto: falta resolver el tramo pendiente.

## Pendientes exactos que afectan METAL

| Módulo | Artículo | Opción | Línea / descripción | Costo histórico de la línea | Motivo |
|---|---|---|---|---:|---|
| Vitrina Torre | `MVLQPP00000000` | — | PINTURA EN POLVO / PPH sin opción | $506.09 | TELCEL_LOAD_PLAN: NECESITA_HUMANO; la opción vacía no puede sustituirse por A10/A529. |
| Vitrina Isla | `MPMTLA01030601` | — | LN4814ACE | $18.01 | NECESITA_HUMANO; identidad exacta sin unidad usable en el BOM y sin match exacto cargable. |
| Vitrina Isla | `LN1838` | — | Lámina negra 3×8 cal.18 | $361.23 | NECESITA_HUMANO; no aparece identidad exacta cargable. |
| Vitrina Isla | `LN2038` | — | Lámina negra 3×8 cal.20 | $135.47 | NECESITA_HUMANO; no aparece identidad exacta cargable. |
| Módulo de Almacenamiento | `(vacío)` | — | Lámina negra 3×8 cal.18 — descripción LN1838 | $722.46 | La línea no tiene Artículo; aunque la descripción diga LN1838, la regla dura impide asignar identidad por parecido. |
| Módulo de Almacenamiento | `(vacío)` | — | Cubierta MDF 12 mm / PVC termoformado cristal White | $450.00 | La línea no tiene Artículo exacto; no existe mapeo autorizable en TELCEL_LOAD_PLAN. |

## Cobertura por módulo

- **Vitrina Horizontal:** 100.00%. No tiene línea METAL pendiente bajo estas reglas. El drift total sí es calculable: **$-68.85 (-1.54%)**.
- **Vitrina Torre:** 82.94%. Falta el `MVLQPP00000000` sin opción; no se usa A10 ni A529 como sustituto.
- **Vitrina Isla:** 84.39%. Quedan pendientes `MPMTLA01030601`, `LN1838` y `LN2038`.
- **Módulo de Almacenamiento:** 67.40%. Hay dos líneas históricas sin Artículo exacto: la lámina descrita como LN1838 y la cubierta MDF/PVC. No se les asigna SKU por descripción.

## Integridad

Este archivo no modifica precios, catálogo, BOM, motor ni base de datos. Es únicamente una reconstrucción comparativa de los bloques **METAL** `id_01`, `id_02`, `id_03` e `id_04` a partir de los CSV originales y las reglas de carga ya auditadas.

La comparación deliberadamente deja huecos donde falta identidad exacta. **No se inventó ningún precio actual.**
