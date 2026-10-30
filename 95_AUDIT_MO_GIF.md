# 95_AUDIT_MO_GIF — auditoría de Mano de Obra e Indirectos de Fábrica

**Fecha:** 2026-10-30 · Alcance: cómo el motor calcula MO (mano de obra) y GIF (indirectos de
fabricación), si hay sub-costeo silencioso, y cierre de la "anomalía GIF Torre" que quedó abierta.
**Método:** lectura de código + **ejecución real** del motor (no sólo lectura). 57/57 pruebas del
motor (calculo, intelisis, App LT, Alba) verdes.

---

## Veredicto corto
**El modelo MO/GIF es sólido y NO sub-costea en silencio.** El `costoHoraGIF` en ceros del config
vivo es **inerte** (no es la fuente operativa en ningún camino real). La "anomalía Torre" era un
**falso positivo**: "Torre Norte/Sur" son nombres de proyecto/lab, no un producto con bug de GIF.

**PERO** encontré **una discrepancia real, cuantificada y reproducida** en App LT (abajo, hallazgo
MG-1): la ruta viva cobra las horas de metal a una tarifa más barata que la tarifa real del pedido
38247. No es GIF=$0, pero sí es un **sub-cobro sistemático** del centro de metal. Es una decisión de
calibración de Dirección/Alba, no un error de lógica. Severidad **P2** (acotada, un solo carril).

---

## 1. Cómo se calcula MO/GIF (las tres fuentes y quién manda)

El motor (`src/motor/calculo.js`) tiene **dos modelos**, elegibles por pieza o por config global:

### (A) `modeloCosteo = 'clasico'` — el DEFAULT vivo (config `vonhaucke` dice `"modeloCosteo":"clasico"`)
- **MO** = `materialDirecto × factorManoObraDirecta%` (+ parte indirecta). En **estimación pura**
  (sin horas ni factores a mano) usa la **fórmula de Alba**: MO% por tipo de material (cubierta 15%,
  cristal 1%, resto 20%).
- **GIF** = en estimación pura, `giAlba` = **3×MO** por tipo de material (5% del material en cristal);
  con factores a mano, `materialDirecto × 34%`.
- **Verificado al centavo** contra la T.D.C. real de Alba (copete id_01: material 460.57 → MO 92.11 →
  indirecto 276.33 → costo fab 829.01). Ver `src/datos/politicaVH.js`.
- **GIF nunca es 0** salvo material 0. **No lee `costoHoraGIF`.**

### (B) `modeloCosteo = 'intelisis'` — SÓLO App LT lo activa (`src/datos/applt.js:374`)
- **MO** = `Σ horas_centro × costoHoraArea_centro`. **GIF** = `Σ horas_centro × costoHoraGIF_centro`.
- Las tarifas **NO** salen del config en ceros: la pieza App LT inyecta `parModelo: APPLT_RATES`
  (tarifas reales de planta), y el motor las **fusiona sobre el config** (`calculo.js:1094`,
  probado en `calculo.test.js:530`). Verificado corriendo el motor: GIF real, no cero.

### Por qué el `costoHoraGIF` en ceros del config NO es un bug activo
1. El default vivo es **clásico**, que no lee `costoHoraGIF`.
2. El único camino que lo leería (intelisis) recibe tarifas reales por `parModelo`.
3. Si alguna vez corriera intelisis **sin** `parModelo`, la compuerta `tarifasFaltantesIntelisis`
   (`calculo.js:610`) marca `GIF:<área>` para cada centro con horas y sin tarifa → la emisión cae en
   `ECONOMICS_INCOMPLETE`. **Fail-closed, no $0 silencioso.**
4. `parModelo` está en la lista PROHIBIDOS de intents de cliente (`validarIntentCosteo`): **el cliente
   no puede inyectar tarifas falsas.** Es server/receta únicamente.

---

## 2. Hallazgo MG-1 (CONFIRMADO, P2): App LT cobra el metal a tarifa de "otros", no de "pm"

App LT tiene **dos implementaciones de costeo** que **no concuerdan en el centro de metal**:

| Ruta | ¿Viva? | Horas de metal del módulo 6U | Tarifa que aplica | MO+GIF de ese bloque |
|---|---|---|---|---|
| `generarAppLT` → motor (`APPLT_RATES`) | **SÍ** (App.jsx:1499, lineas.js:46) | 12.776 h → centro **`otros`** | MO $61.98 + GIF $234.39 = **$296.37/h** | **$3,786.6** |
| `costoOficialModuloAppLT` (pedido 38247) | NO (sólo pruebas) | 12.776 h → centro **`pm`** | MO $92.38 + GIF $281.87 = **$374.25/h** | **$4,781.5** |

**Mismas 12.776 horas, tarifa distinta.** La ruta viva es **$77.88/h más barata → ~$995 menos por
banca 6U** en MO+GIF del metal (≈21% de ese bloque; el bloque de metal es ~30% del módulo, probado:
módulo A118B770C770 = MP $4,197.59 + MO $1,728.44 + GIF $1,575.94 = $7,501.97, con pm=2,232.66 de eso).

Causa: en `APPLT_RATES` (`applt.js:185-186`) el centro `pm` está en 0 y las horas de metal se
reclasifican a `otros`; en `TARIFA_REAL_APPLT` (`appltCosto.js:24-29`) el metal está en `pm` con su
tarifa real del pedido. Reproducido corriendo `generarAppLT` y `costoOficialModuloAppLT`.

**Qué NO afirmo:** no probé el costo TOTAL vivo de App LT contra un presupuesto real end-to-end (la
nota del código dice "calibrado MAE ~4%", lo tomo del código, no lo re-verifiqué). El hallazgo firme
es la **inconsistencia entre las dos implementaciones** y que la viva es la **más barata** en metal.

**Decisión que NO tomo yo (Dirección/Alba):** ¿la hora de metal de App LT debe costar la tarifa `pm`
real del pedido 38247 ($374.25/h) o la de `otros` ($296.37/h)? Lo seguro-hacia-arriba es `pm`.
**Fix cuando Dirección decida:** poblar `APPLT_RATES.costoHoraArea.pm`/`costoHoraGIF.pm` con la tarifa
real y enrutar las horas de metal a `pm` (o documentar explícitamente por qué van a `otros`), + un
test que fije el número. Es un cambio de datos+1 test, no de arquitectura.

---

## 3. Cierre de la "anomalía GIF Torre"
Buscado en código y en cotizaciones. "Torre Norte" / "Torre Sur" son **nombres de proyecto/lab**
(mesa de juntas Torre Norte, plano ejecutivo Torre Sur), y "torre" como producto es un mueble guarda
de la línea Modulor. **No existe un producto "Torre" con bug de GIF.** El término venía de notas de
lab, no de un defecto. Queda **cerrado como falso positivo.**

---

## 4. Qué sube/queda en el scorecard
- **COSTEAR:** el modelo MO/GIF deja de ser incógnita — está verificado y es fail-closed. Sube la
  confianza del motor; el tope sigue siendo **datos** (puentes/precios) + MG-1 (tarifa metal App LT).
- **No sube a 95** por: (a) MG-1 pendiente de decisión de Dirección; (b) el pipeline profundo
  texto→costo contra `-rc` sigue sin E2E limpio (arnés holdout).
