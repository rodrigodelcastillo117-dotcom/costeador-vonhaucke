# P0-B · Pruebas de la política ERP_ULTIMA_COMPRA_V1 (VH-147) y del backfill de formato (VH-146) en base aislada (2026-10-13)

Continúa `ERP_PRECIOS_ELEGIBILIDAD.md`. Dirección decidió (Decisión 1) separar **validez histórica** (un precio ERP
documentado nunca caduca ni se vuelve "inventado") de **actualidad para costo certificado** (24 meses desde la última
compra, salvo validación comercial documentada más reciente), y (Decisión 3) completar y auditar el backfill de formato
de hojas. Aquí está lo que se escribió, lo que se probó, con qué números, y lo que falta decidir. **Nada toca
producción**: todo corre en PGlite (PostgreSQL real en WASM, en memoria) con el esquema real copiado del baseline, y las
dos migraciones siguen con prefijo `PROPUESTA_`.

## 1. Archivos

| archivo | qué es | pruebas |
|---|---|---|
| `supabase/migrations/PROPUESTA_vh147_elegibilidad_erp.sql` | SQL real: `private_api.ventana_actualidad_meses()`=24; vista `catalogo_vigente` = producción + 5 columnas; `insumo_motor` y `resolver_costo_insumo` con evidencia extendida; rollback comentado al final | `supabase/tests/erpPolitica.test.js` · **17/17** |
| `supabase/migrations/PROPUESTA_vh146_formato_hojas_erp.sql` | SQL real, idempotente, con tabla de respaldo y rollback comentado | `supabase/tests/formatoHojasErp.test.js` · **28/28** |
| `src/motor/formatoHojaErp.test.js` | efecto del formato en `calcular()` (sin / 4×8 / 5×8 / curados) con cifras | **8/8** |
| `supabase/tests/fixtures/erpBaseAislada.js` | base PGlite: DDL real de `insumos_catalogo` e `insumo_precios` (con CHECK y columna generada), triggers reales, `aprobar_precio` real, vista de producción, `insumo_motor`/`catalogo_motor` de VH-088 | compartido |
| `src/datos/erpCarga.js` (3 líneas) | **VH-146b**: evalúa 5×8 antes que 4×8 (defecto reproducido por prueba, ver § 4.3) | `erpCarga.test.js` 5/5 sigue verde |

Correr: `npx vitest run supabase/tests/erpPolitica.test.js supabase/tests/formatoHojasErp.test.js src/motor/formatoHojaErp.test.js`
(53 pruebas, ~12 s). Suite `src/motor` + `supabase/tests` + ERP: 449/450; la única roja es `gemeloErp.test.js` (VH-152b),
trabajo en curso de otra persona en la rama, falla igual sin mis cambios.

## 2. Política VH-147: qué dice el SQL

```sql
create or replace function private_api.ventana_actualidad_meses() returns integer language sql immutable as $$ select 24 $$;
-- en la vista (CTE `politica`, sobre el mismo `ranked` de producción con rn = 1):
antiguedad_meses = (extract(year from age(current_date, vigente_desde))*12 + extract(month from age(current_date, vigente_desde)))::int
actualidad       = case when vigente_desde >= current_date - make_interval(months => ventana) then 'VIGENTE' else 'ANTIGUO' end   -- inclusive
validez          = case when contract_status='DATA_TRUTH_V1' and source_document<>'' and source_record_id<>'' then 'DOCUMENTADO'
                        when evidence_status in ('documentada','referenciada','concordante') or evidencia<>'' or fuente<>'' then 'REFERENCIADO'
                        else 'SIN_EVIDENCIA' end
certificable     = (estado='aprobado' and not requiere_validacion_compras)
                   or (validez='DOCUMENTADO' and actualidad='VIGENTE' and precio>0 and activo
                       and not requiere_validacion_compras and (MXN o fx_rate/fx_date/fx_source completos) and cost_unit = unidad_costeo)
motivo_no_certificable = null si certificable; si no, en orden: sin evidencia documental (contract, evidence_status) ·
                   requiere validación de Compras · 'última compra YYYY-MM-DD (N meses): fuera de la ventana de actualidad de 24 meses;
                   usable como PRELIMINAR con fecha visible, no certifica costo de reposición sin validación comercial' · precio no positivo ·
                   moneda sin FX · unidad de costo distinta
```

Dos adiciones conservadoras respecto a la fórmula pedida, para que Dirección las confirme o las quite: la segunda rama
también exige `not requiere_validacion_compras` (si Compras marcó "validar", no certifica solo) y `cost_unit = unidad_costeo`
(ya lo exige el trigger; aquí es cinturón). Se añadió una sexta columna `ventana_actualidad_meses` para que el cliente
pueda escribir "24" sin tener el número duro. **Ningún `UPDATE`**: estados, precios, aprobaciones, fórmulas, márgenes y
listas de precio quedan intactos; la prueba lo comprueba con una fotografía antes/después de la vista y del histograma de `estado`.

Detalle técnico: `CREATE OR REPLACE VIEW` conserva los grants de producción y añade columnas al final (las 17 de
producción siguen en su orden: `costear-servidor` lee por nombre, nada se rompe). La vista es `security_invoker`, así que
quien la lee por REST (`service_role`) necesita `USAGE` en `private_api` y `EXECUTE` en la función: la migración los
concede sólo a `service_role` y revoca a `public/anon/authenticated`. **Abierto**: confirmar en producción si `service_role` ya
tenía `USAGE` en `private_api` (`select has_schema_privilege('service_role','private_api','USAGE')`) — el rollback no revoca por eso.

## 3. Resultados VH-147 (PGlite, esquema real, 2026-10-13)

Muestra: 11 casos nominales + 240 sintéticos (compras cada 7 días hacia atrás, 0–1 673 días; 1 de cada 8 aprobado con
`aprobar_precio` real como rol dirección). Antes = vista de producción; después = PROPUESTA.

| caso | estado | última compra | antes | **después** |
|---|---|---|---|---|
| A · ERP melamina 19 mm 4×8, $306, documentado | propuesto_validado | 2014-08-26 | certificable=false | **false** · DOCUMENTADO · ANTIGUO · 145 meses · motivo "última compra 2014-08-26 (145 meses): fuera de la ventana … 24 meses; usable como PRELIMINAR…" · **precio 306 sigue saliendo** |
| B · ERP MDF 18, $725.40, documentado | propuesto_validado | hace 6 meses | false | **true** (sin cambiar el estado) · VIGENTE · 6 meses · motivo null |
| C · aprobado, compra 2023-01-15 | aprobado | ~44 meses | true | **true** (aprobación = validación comercial) · **ANTIGUO** · 44 meses visibles |
| D · LEGACY_UNMIGRATED, sin_evidencia, compra reciente | propuesto_validado | 30 días | false | **false** · SIN_EVIDENCIA · motivo "sin evidencia documental (LEGACY_UNMIGRATED, sin_evidencia)…" |
| E · LEGACY referenciado (lista Compras) | propuesto | 10 días | false | **false** · REFERENCIADO · precio 437 sigue (PRELIMINAR) |
| F · USD 10 con fx 17.5/DOF/2026-08-10 | propuesto_validado | 40 días | false | **true** · precio **175.00** (= source × fx por `sync_precio_legacy`) · DOCUMENTADO |
| G · USD sin FX | — | — | la tabla lo **rechaza** (`chk_precios_datatruth_contract`) | igual |
| H · documentado reciente, `requiere_validacion_compras` | propuesto_validado | 15 días | false | **false** · VIGENTE · motivo "requiere validación de Compras" |
| I · insumo inactivo (BLOQUEADO ERP) | — | 5 días | fuera de la vista | fuera (regla de producción) |
| J · borde: exactamente 24 meses / 24 meses + 1 día | propuesto_validado | — | false / false | **true** VIGENTE 24 m / **false** ANTIGUO 24 m (inclusive) |
| K · aprobado reciente (los 1 753 reales) | aprobado | 100 días | true | true · VIGENTE |
| L · mismo insumo: aprobado 2022 ($500) + documentado hace 20 días ($560) | — | — | gana el aprobado ($500) | gana el aprobado ($500), certificable, **ANTIGUO** |

Conteos en los 240 sintéticos: total 240 · aprobados 30 · antiguos (> 24 m) 136 · certificables = **30 + 104** (aprobados +
documentados ≤ 24 m) · 0 sin motivo entre los no certificables · 0 sin precio. Lo único que cambia respecto a producción
son los **104 documentados ≤ 24 m que no estaban aprobados**: pasan a certificar. En la base real de hoy ese conjunto es
**0** (el cargador aprobó todo lo ≤ 24 m), así que **aplicar VH-147 no cambia el número de certificables hoy**: cambia que
los 8 213 antiguos salen con fecha, antigüedad y motivo, y que cargas futuras ≤ 24 m certifican sin `aprobar_precio`.

`insumo_motor` / `catalogo_motor`: el insumo conserva las 17 claves de VH-088 y `evidencia` gana `vigente_desde`,
`antiguedad_meses`, `actualidad`, `validez`, `motivo_no_certificable`. `resolver_costo_insumo`: misma forma + las 5 claves;
`estado_certificacion` = CERTIFICADO cuando la vista dice certificable (B pasa de PRELIMINAR a CERTIFICADO); seller-safe intacto
(vendedor → `no autorizado`). Idempotente (segunda corrida idéntica). **Rollback ejecutado en la prueba**: la vista vuelve a las
17 columnas, `certificable` vuelve a exigir aprobado, `insumo_motor` sin `actualidad`, función de ventana eliminada.

Hallazgo L (no se corrige aquí): el ranking de producción (`estado` primero, fecha después) elige un **aprobado antiguo**
por encima de un **documentado reciente** del mismo insumo. Con la política visible la UI lo mostrará como ANTIGUO; decidir si
una compra documentada más reciente debe desplazar al aprobado (eso sí cambiaría qué precio sale, y es decisión de Dirección).

## 4. Backfill VH-146: SQL, auditoría y números

### 4.1 Qué hace el SQL (idempotente)

Candidatos: `clasificacion='erp'`, `unidad_costeo='hoja'`, `familia ∈ {melamina, mdf, laminado_hpl, chapa_madera, acrilico}`,
sin `atributos.formato` objeto, y nombre que casa (case-insensitive, `\y` = límite de palabra como el `\b` de JS):

- 5×8 primero: `(^|[^0-9])5\s*'?\s*x\s*'?\s*8($|[^0-9])|1\.?525?\y` → `{"tipo":"tablero","nombre":"tablero 1.52 x 2.44","corto":"tablero 5x8","medida":3.721,"largoMM":2440,"anchoMM":1525}`
- 4×8 después: `(^|[^0-9])4\s*'?\s*x\s*'?\s*8($|[^0-9])|1\.?22\y|2\.?44\y` → `{"tipo":"tablero","nombre":"tablero 1.22 x 2.44","corto":"tablero","medida":2.9768,"largoMM":2440,"anchoMM":1220}`

Pasos: (1) `private_api.respaldo_vh146_atributos (id pk, atributos originales, formato_asignado, respaldado_en)` con
`on conflict do nothing` (el original nunca se pisa); (2) `update … set atributos = coalesce(atributos,'{}') || {fraccion:true,
mermaCorte:6, formato}` sólo para respaldados que **siguen** sin formato; (3) dos `select` de verificación: conteo por formato y
la lista de hojas ERP activas que siguen sin formato (para Compras). Rollback comentado: `update … set atributos = r.atributos
from respaldo`. Los dos literales `formato` son byte a byte `TABLERO`/`TABLERO5X8` de `erpCarga.js` y `TABLERO` de `insumos.js`
(la prueba los extrae del SQL y los compara).

### 4.2 Muestra y resultado (PGlite)

| nombre ERP (patrón real) | familia | resultado |
|---|---|---|
| `MDF … HOJA 4' X 8' ESPESOR 18 mm` | mdf | **4×8** |
| `AGLOMERADO MELAMINA DOS CARAS HOJA 4 X 8 ESPESOR 19 mm` | melamina | **4×8** |
| `… HOJA 5 X 8 ESPESOR 28 mm` | melamina | **5×8** |
| `… 1.22 X 2.44 M …` / `MDF NATURAL 2.44 X 1.22 …` | melamina / mdf | **4×8** |
| `… 1.52 X 2.44 …` / `… 1.525 X 2.44 M …` | melamina | **5×8** |
| `LAMINADO PLASTICO HPL 4X8 …` / `CHAPA DE MADERA ENCINO 4'X8'` | laminado_hpl / chapa_madera | **4×8** |
| `MELAMINA DOS CARAS 4 X 8 …` con `atributos` NULL | melamina | **4×8** (atributos se crean) |
| `MDF NATURAL 4 X 8 …` con `activo=false` | mdf | **4×8** (el formato es del material; el estatus no se filtra) |
| `ACRILICO … DE 2400 X 1200 mm …` · `… 2440 X 1220 mm …` | acrilico | sin cambio (mm no es 4×8 ni 1.22/2.44) |
| `LAMINA NEGRA 3 X 10 CAL 20` · `LAMINA NEGRA 4 X 8 CAL 18` | metal_lamina | sin cambio (familia fuera: su medida es kg/hoja) |
| `MELAMINA 14 X 8 …` · `MELAMINA 4 X 80 cm …` · `TAPA MELAMINA 4 X 8` (pza) · `TABLERO … 4 X 8` sin familia | — | sin cambio |
| hoja ERP que **ya** tenía formato · curado `melamina-16` | — | sin cambio, byte a byte |

11 respaldadas (8 de 4×8, 3 de 5×8); lo demás intacto. Segunda corrida: 0 cambios, respaldo igual. Rollback: los 21
`atributos` vuelven al original (incluido el NULL); re-aplicar da lo mismo. Paridad SQL ↔ JS: el patrón del SQL (extraído del
archivo) decide igual que `RE_HOJA_5X8`/`RE_HOJA_4X8` en los 21 nombres.

### 4.3 Defecto encontrado y corregido en el cargador (VH-146b)

`prepararCargaErp` probaba 4×8 antes que 5×8; una hoja 5×8 descrita en metros (`… 1.52 X 2.44 …`) casa con `2\.?44\b` y
recibía el tablero de 2.9768 m² en vez de 3.721 m² (−20 % de material en cada costeo). Reproducido en
`formatoHojasErp.test.js` ("el cargador asigna 5×8 a una hoja 1.52 X 2.44"), corregido invirtiendo el orden en
`src/datos/erpCarga.js:81-84` (un 4×8 nunca trae `5 X 8` ni `1.52`). Las pruebas previas de VH-146 siguen verdes. El SQL ya
evaluaba 5×8 primero. No sé cuántas filas reales tienen ese patrón: la verificación del SQL lo dirá al aplicarlo.

## 5. Efecto en el motor (`src/motor/formatoHojaErp.test.js`, `calcular()` con `PARAMETROS_DEFAULT`)

Orden: cubierta 650×450 mm ×2 + costado 1800×450 mm ×1 (neto 1.395 m²). Rejilla 2440×1220, kerf 6, recorte 10.

| insumo | hojas | m² cargados | costo material | método |
|---|---|---|---|---|
| (i) ERP $306/hoja **sin formato** | — | — | **$0 · PENDIENTE** ×2: "precio por hoja sin formato del material…" (P0-02), `estadoCosto=incompleto`, `costoOficial=null` | bloqueado |
| (ii) mismo ERP **con 4×8** (`fraccion:true, mermaCorte:6`) | **0.8333** (= 2/6 por rejilla + ½ hoja regla Producción para el 1800×450) | 2.4807 | **$255.00** · scrap 43.8 % | RENDIMIENTO_GEOMETRICO |
| (iii) ERP 5×8 $645.37/hoja | 0.8333 | 3.1008 | $537.81 · 55.0 % | idem |
| (iii) ERP 5×8 a $306 (aislar formato) | 0.8333 | 3.1008 | $255.00 (= 4×8) | idem |
| (iii) ERP 5×8 a $306 con `tableroAnchoMM:1525` | **0.7000** (2/10 + ½) | 2.6047 | **$214.20** | idem |
| curado `melamina-16` $450 / `mdf` $437 | 0.8333 | 2.4807 | $375.00 / $364.17 | idem (misma fracción, mismo `formato`, costo = fracción × precio) |
| ERP 4×8 con `fraccion:false` | 2 hojas | 5.9536 | **$1,821.80** (m² × $/hoja) | FORMATO_COMPLETO |

Dónde entra cada cosa (`calculo.js`, `comprarInsumo` :356-492):

- **`mermaCorte`** → `factorMerma` (:358) sólo alimenta `conCorte` (:389), que sólo se usa en la rama FORMATO COMPLETO / sin
  formato (:486-487). En la rama de **fracción** (`formato && fraccion`, :454-467) **no entra**: probado 0 % vs 6 % → mismo costo.
  Igual en `comprar()` 6.2 (:153-160). Así que el `mermaCorte:6` del backfill es **inerte** para estas hojas.
- **`aprovechamientoCorte`** (80, :102) sólo pesa sobre consumo **sin medida** (`netoSinMedida`, :455-457): 0.5 m² sueltos
  → 0.21 hojas con 80 % vs 0.168 con 100 %. Las piezas con largo×ancho cobran su fracción real de rejilla (:418) o la regla
  ½/1 hoja de Producción (:396-398), nunca el 80 %.
- **`formato.medida`** convierte hojas ↔ m² (:458) y da el $/m² equivalente. **`formato.largoMM/anchoMM` no los lee la rejilla**:
  `piezasPorTablero` (:200-205) usa `par.tableroLargoMM/AnchoMM` (2440×1220); sólo el optimizador advisory (:646) lee el formato.
  **Hallazgo**: una hoja 5×8 cobra la misma fracción que una 4×8 (0.8333) salvo que los parámetros del tablero digan
  2440×1525 (entonces 0.70). Es conservador (cobra más), no subcostea; corregirlo (que la rejilla lea `insumo.formato`) es
  cambio de fórmula en `calculo.js` (sólo lectura aquí) y pide decisión + bump de `MOTOR_VERSION`.
- **`fraccion:true` es obligatorio** para precio por hoja: con `fraccion:false` la rama FORMATO_COMPLETO hace `costo = comprado(m²) ×
  precio` (:490) y multiplica m² por $/hoja → $1,821.80 (7×). El motor no valida esa combinación; el backfill la fija bien.

**Sobre el 6 %**: es el valor que `tablero()` (`insumos.js:64-65`) pone a **todos** los tableros curados (láminas 8, PTR 5,
tapacanto 4); el encabezado de `insumos.js` los llama "datos semilla" y no cita fuente de Producción. `politicaMerma.js`
(Rogelio, 2026-10-12) fija ½/1 hoja por pieza grande, 8 m²/kg de pintura y tramos de 6 m, pero **no** un % de merma de
corte. Conclusión: el 6 se copia **por paridad con el catálogo curado**, no por evidencia técnica, y no mueve el costo de estas
hojas; dejarlo en 0 daría el mismo resultado. Queda documentado así en el SQL.

## 6. Rollback (resumen; el texto exacto está al final de cada archivo, entre `>>> ROLLBACK` y `<<< FIN ROLLBACK`)

- **VH-147**: `drop function private_api.insumo_motor(insumos_catalogo, catalogo_vigente)` (depende del tipo de la vista) →
  `drop view catalogo_vigente` → recrear la vista de producción (copia literal) + sus dos `GRANT` → recrear `insumo_motor`
  (VH-088) y `resolver_costo_insumo` (baseline) → `drop function ventana_actualidad_meses`. Probado en la prueba.
- **VH-146**: `update insumos_catalogo set atributos = r.atributos from private_api.respaldo_vh146_atributos r`. La tabla queda
  como rastro (su `drop` está doblemente comentado). Probado byte a byte.

## 7. Cambios de cliente necesarios para mostrar fecha + aviso de antigüedad (sugerencias, **no implementadas**)

Todos leen lo que ya trae `insumo_motor` tras VH-147: `insumo.actualizado` (= `vigente_desde`) y
`insumo.evidencia.{actualidad, antiguedad_meses, validez, motivo_no_certificable, certificable}`.

1. `src/componentes/Costeador.jsx:880-905` `ConfianzaCosteo`: junto al bloque "SIN fuente", un bloque ámbar con los materiales
   cuyo `insumos[d.insumoId].evidencia?.actualidad === 'ANTIGUO'`: "N materiales con última compra de hace más de 24 meses
   (nombre · fecha · N meses): el costo sale PRELIMINAR" usando `evidencia.motivo_no_certificable` como tooltip.
2. `src/datos/senales.js:99-117` `senalesInsumos`: nueva señal `precio-antiguo` (cuenta `evidencia.actualidad==='ANTIGUO'`,
   texto con la fecha más antigua y `evidencia.ventana`/24); hoy sólo hay "sin fuente" y "$0".
3. `src/componentes/BuscadorInsumo.jsx:44-53`: ya imprime `ev.certificable ? 'certificado' : ev.estado` y `ins.actualizado`;
   añadir `ev.actualidad === 'ANTIGUO' ? ' · ANTIGUO (N meses)' : ''` y `title={ev.motivo_no_certificable}`.
4. `src/componentes/Precios.jsx:192-209`: la columna "actualizado/días" ya existe (semáforo ámbar por `diasDesde`); alinear el
   umbral al `ventana_actualidad_meses` del servidor y mostrar `evidencia.validez` (DOCUMENTADO vs SIN_EVIDENCIA) en el `title`
   que hoy sólo trae `evidencia.estado` (:205).
5. `src/datos/materialMatch.js:739`: el texto "Última compra certificada por Compras" se dispara con `certificable`; con la
   política, un documentado ≤ 24 m certifica sin aprobación → distinguir por `evidencia.estado==='aprobado'` ("aprobada por
   Dirección") vs "última compra documentada ≤ 24 m". `:615/:636` ya ordenan por `actualizado`; nada que cambiar.
6. `src/datos/gemeloErp.js:17,38`: `esCertificable` seguirá siendo correcto; considerar preferir `evidencia.actualidad==='VIGENTE'`
   al elegir gemelo cuando hay varios certificables.
7. `supabase/functions/costear-servidor/index.ts:168-169`: añadir `actualidad, antiguedad_meses, vigente_desde,
   motivo_no_certificable` al `select` de `catalogo_vigente`; `:178-190` un warning "Costo preliminar — N insumo(s) con última
   compra > 24 meses: nombre (fecha)"; `:258-261` incluir `vigente_desde/actualidad/motivo` en `detalleInsumos` para Diseño y
   Dirección (nunca en la salida de Ventas).
8. `src/componentes/CargaERP.jsx:87-88` y `src/datos/erpCarga.js:17,96`: el resumen dice "Compra ≤ 24 meses (se certifican) /
   más antigua (preliminares)" y la evidencia "ANTIGUA >24 meses: re-cotizar con Compras antes de certificar"; con VH-147 el
   texto exacto debería ser "documentada, fuera de la ventana de actualidad: PRELIMINAR con fecha visible". `MESES_CERTIFICABLE`
   duplica el parámetro del servidor: leerlo de `ventana_actualidad_meses` (vía `catalogo_motor`) o dejar nota de que deben coincidir.

## 8. Decisiones abiertas para Dirección

1. Confirmar la fórmula de `certificable` con las dos adiciones conservadoras (§ 2) o pedir la literal.
2. Con VH-147, ¿debe el cargador (`vh089`) **dejar de auto-aprobar** lo ≤ 24 m (así `aprobado` vuelve a significar validación
   humana explícita y lo reciente certifica por documento)? Hoy ambas rutas certifican igual.
3. Hallazgo L (§ 3): aprobado antiguo vs documentado reciente del mismo insumo — ¿quién manda?
4. Rejilla 5×8 (§ 5): aceptar el sobre-costo conservador o autorizar que `piezasPorTablero` lea `insumo.formato` (cambio de
   fórmula, `MOTOR_VERSION`).
5. Aplicar VH-146 (241 filas estimadas; la verificación del SQL imprime el conteo real y las hojas que siguen sin formato para
   Compras) y, aparte, VH-146b ya corregido en el cargador para cargas futuras.
6. Permisos: verificar `has_schema_privilege('service_role','private_api','USAGE')` en producción antes de aplicar VH-147.
