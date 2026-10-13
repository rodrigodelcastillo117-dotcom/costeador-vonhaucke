# Informe V2 · Decisiones de Dirección y segunda auditoría (2026-10-13)

**Veredicto: NO-GO a producción.** Nada se fusionó, nada se desplegó a producción y no se aplicó ninguna migración.
Las únicas Edge desplegadas hoy desde esta rama son copias `*-rc` (flujo manual "Deploy edge functions").
Rama `claude/costing-app-architecture-psf02g` · PR borrador #37 (no fusionar) · código revisado en `b4b6ca2`.

## 0. Resumen en una tabla

| Punto pedido | Resultado real | Estado |
|---|---|---|
| 1 · Costear COMPLETO | Ciclo desde cero hasta Cotizar con paridad al centavo **sólo cuando las diferencias de material se aceptan** (corrida 12: $4,345.21 = $4,345.21). Sin aceptarlas, se bloquea honestamente en 2 decisiones de diseño (corrida 14). Nunca llega a "certificado": 6 de 10 insumos sin precio certificado. | PARCIAL · bloqueo exacto identificado |
| 2 · Cotizar a propuesta válida | Acomodo C1 **VALIDADO** por primera vez (sin sillas de 200 mm, topología App LT 12u por receta de catálogo). Propuesta **no emitible**: los 7 productos de catálogo no tienen costeo oficial. | BLOQUEADO por P0-01 (decisión económica) |
| 3 · VH-035b integral | `PROPUESTA_vh035c` + 32 pruebas PGlite: economía anidada, STALE por producto/versión/BOM/material, lote, re-pin, aprobaciones, compuerta de emisión. **No aplicada.** | LISTO EN RC · requiere autorización |
| 4 · Política ERP | `PROPUESTA_vh147` SQL real en PGlite (17 pruebas): validez histórica ≠ actualidad 24 m. `PROPUESTA_vh146` formatos (28 pruebas + 8 del motor). **No aplicadas.** | LISTO EN RC · decisiones abiertas |
| 5 · Pérdida de datos y concurrencia | VH-035c (arriba) + VH-148 control optimista tras bandera: 13 PGlite + 25 unitarias + 4 E2E. | RESUELTO EN PRUEBAS · no desplegado |
| 6 · Renders | Cinco etapas medidas por separado: 4 generadas, 4 validadas, 4 persistidas, 4 reabiertas, PDF con 7 imágenes. | PASS en RC (con variación real del auditor) |
| 7 · Regresiones y pruebas omitidas | Suite 288 archivos / 2,460 pruebas en verde. 1 `it.fails` documentado. E2E rojo sólo en `persistencia.e2e.js:125` (VH-035, visible a propósito). | Ver § 7 |
| 8 · SHA, PR, veredicto | `b4b6ca2`, PR #37 borrador, **NO-GO**. | — |

## 1. COSTEAR (Decisión 5)

Cinco corridas reales desde cero (imagen de credenza 1800×450×750, `analizar-mueble-rc`, cuenta QA, expedientes de laboratorio en
borrador). Evidencia: `lab/noche/costear/corrida11` … `corrida14`.

| Corrida | Qué cambió antes | Cliente | Servidor | Transferencia a Cotizar |
|---|---|---|---|---|
| 10 (antes) | — | $4,410.57 "emitible" | `incompleto` | 0 partidas |
| 11 | VH-152b (gemelo respeta medida/especie) + VH-157 (cliente espeja P0.12) | $3,978.77 | $3,978.77 `preliminar` | 1 partida a $3,978.77 |
| 12 | VH-152c (gemelo MDF 19 mm ya entra) | $4,345.21 | $4,345.21 `preliminar` | 1 partida a $4,345.21 |
| 13 | VH-158 (sin aceptar diferencias en bloque) | Por confirmar | `incompleto` | deshabilitada |
| 14 | VH-158b (18↔19 mm aprobado = regla de casa) | Por confirmar | `incompleto` | deshabilitada |

**Lo que la corrida 12 aceptó y no debía.** El botón "Confirmar los 13 propuestos" aceptó una jaladera embutida redonda
(Hafele 151.75.903) para "Jaladeras rectas 300 mm", aunque la fila decía "Variante pedida no está en el nombre del catálogo".
Por eso la paridad de la corrida 12 demuestra la mecánica, **no un costo correcto**. Desde VH-158 el bloque sólo confirma lo que
no difiere de lo pedido; cada diferencia pide "Acepto esta diferencia" fila por fila.

**Bloqueo exacto de la corrida 14 (decisiones de diseño, no del sistema):**
- **Jaladera recta 300 mm.** No existe en el ERP. Las más cercanas son `erp-ja29820ac` (298×20 mm, aluminio) y `erp-ja1039inox` (318 mm, inoxidable).
- **Pintura electrostática negra.** El catálogo sólo tiene "Pintura electrostatica" sin color.

**Por qué VONI usaba curados habiendo ERP exacto.** La IA sólo ve el catálogo curado, por diseño. VH-152 propone el gemelo ERP
certificable cuando el curado no está certificado. Tenía dos falsos gemelos (chapa ENCINO para nogal; jaladera 128 mm para 300 mm),
corregidos en VH-152b. VH-152c deja pasar `erp-mdf19` cuando el curado ya tenía la misma diferencia aprobada (18↔19 mm).

**VH-151 en el prompt RC.** Tres corridas sin piezas con tamaño de hoja, laterales 2/2/2 y chapa por caras. La IA todavía varía
entre corridas: 13 piezas en la 11, 14 en la 12 (aparecen "divisiones verticales"). No sé si se estabiliza más con prompt.

**Lo que el laboratorio sigue simulando.** Las respuestas numéricas salen del plano sintético del fixture (no se inventan para un
cliente real). La confirmación en bloque de materiales sin diferencia la hace la cuenta QA. Ninguna es una aprobación económica.

**Hallazgo abierto.** El curado `chapa-walnut` es "Chapa Walnut Burl (poro sellado)". Burl es nogal de raíz, no nogal natural liso.
No modifiqué el catálogo.

## 2. COTIZAR y renders (Decisión 6)

Evidencia: `lab/noche/cotizar_c1/corrida2`, `corrida3`, `lab/noche/render_v2`.

| Corrida C1 | Solver | Veredicto | Detalle |
|---|---|---|---|
| 1 (antes) | producción | REVISIÓN | 2 sillas de juntas con 200 mm de acceso; 12u sin topología |
| 2 | `acomodar-espacio-recovery-rc` | REVISIÓN | sillas resueltas; 12u seguía sin topología |
| 3 | RC + VH-153b | **VALIDADO** | 25 colocados; 12u con 6+6 sillas; juntas 3+3+2 cabeceras; 0 de 21 sillas con acceso estrecho |

La corrida 2 destapó VH-153b: la partida real trae `productoId` = 1898 (id de base), sin categoría ni medidas, y la regla sólo
probaba el primer id. La topología sale de la receta App LT (`applt.js`: fondo 1200 = cubierta de banca doble), no de inferencia.

**Bloqueo exacto de la propuesta.** "No se puede emitir todavía: 7 cosas necesitan corregirse." Los 7 productos de catálogo no
tienen costeo oficial (P0-01, 1,931 partidas en el sistema). Es política económica: requiere costos de Compras/Dirección.

**Renders en cinco etapas** (misma propuesta reabierta, `generar-render-rc`):

| Etapa | Corrida v3 | Corrida v4 |
|---|---|---|
| Generadas | 4 | 4 |
| Validadas por el auditor | 2 | 4 |
| Persistidas (URL de Storage) | 2 | 4 |
| Reabiertas y cargadas en el navegador | 2 presentes, medición defectuosa | 4 |
| Imágenes en el PDF | 5 | 7 |

La medición anterior decía "0 persistidas" por un defecto del laboratorio, no de la app: pulsaba el "Guardar en la propuesta" de
áreas/plan y buscaba el campo equivocado. El conteo del PDF son objetos imagen del archivo: sube de 5 a 7 al pasar de 2 a 4 escenas.
La cuarta área llega sin referencias de producto.

## 3. VH-035c · integridad económica (Decisión 2)

`supabase/migrations/PROPUESTA_vh035c_preserva_economia_integral.sql` y `supabase/tests/preservaEconomiaIntegral.test.js`.
Detalle: `docs/auditoria/VH035C_INTEGRAL.md`.
- Economía anidada re-pegada recursivamente por id/clave; reordenar no es cambio.
- STALE por producto, versión, `bom_hash` o huella de material a cualquier profundidad. La economía previa queda en `cost_stale` para auditoría.
- Costo por lote marca STALE al cambiar cantidad (sólo si la línea lo declara; ver decisión c abajo).
- Re-pin de producto en línea existente: rechazo 42501.
- Aprobaciones y estado de costo nunca escribibles por rol no económico.
- Hallazgo: la compuerta de emisión de producción **no lee** `cost_status`; vh035c la envuelve para bloquear recosteo pendiente.

32 de 32 pruebas en PGlite con los cuerpos reales de las funciones de emisión. `preservaEconomia.test.js` sigue igual (23 + 1 `it.fails`).

## 4. ERP: política y formatos (Decisiones 1 y 3)

Detalle: `docs/auditoria/ERP_POLITICA_PRUEBAS.md`.
- Precio documentado de 2014: `certificable=false`, `ANTIGUO`, 145 meses, motivo con fecha. El precio sigue disponible para PRELIMINAR.
- Documentado de ≤24 meses: certificable. Límite de 24 meses inclusivo.
- Ninguna fila cambia de estado ni de precio (instantánea antes/después igual). Rollback probado.
- `erpCarga.js`: 5×8 se detecta antes que 4×8 (un "1.52 × 2.44" recibía el formato de 4×8).

**Hallazgos del motor sobre formatos** (sin tocar `calculo.js`):
- `mermaCorte` no interviene cuando `fraccion=true`: 0 % y 6 % dan el mismo costo. El 6 % es la semilla de los tableros curados, sin fuente de Producción.
- `fraccion=false` cobraría m² × precio por hoja ($1,821.80 en vez de $255.00): `fraccion=true` es obligatorio.
- Una hoja 5×8 se costea con la rejilla del 4×8 (0.8333 hojas) porque el motor lee los parámetros globales, no el formato del insumo. Sobrecostea.

## 5. VH-148 · control optimista (Decisión 4)

`PROPUESTA_vh148_control_optimista_cotizacion.sql`, `src/datos/conflictoGuardado.js`, `src/componentes/ConflictoGuardado.jsx`.
Detalle: `docs/auditoria/VH148_CONTROL_OPTIMISTA.md`.
La segunda pestaña recibe 40001, la fila del servidor queda intacta, el autosave se pausa, el trabajo local se respalda y la persona
elige "Ver la versión del servidor" o "Volver a aplicar mis cambios". Con la bandera apagada el comportamiento es el de hoy.
Falta la pantalla para restaurar el respaldo local.

**Riesgo de orden de aplicación.** vh148 redefine la función de guardado con 3 argumentos. Si vh035b/c se aplican después, recrean
la de 2 argumentos sin el bloque de vh148, o la vuelven ambigua. Deben aplicarse en un orden definido o fusionarse.

## 6. Revisión de integración del PR #37

Documento: `docs/auditoria/INTEGRACION_PR37.md` (revisó `a9fbe39`; lo posterior está en este informe).
- **CI `verify` estaba rojo en `a9fbe39`** (3 pruebas), aunque el informe anterior decía verde. Corregido en `a9ddd80`.
- **Overrides de Edge en `nube.js`.** Una `VITE_*_FN` en Vercel podía repuntar producción a una Edge RC. Desde `b4b6ca2` sólo valen en desarrollo; verificado en el build.
- **Migración `20261010170000`** sigue en la ruta ordenada (viene de la base, no de este PR) y no está aplicada. Ningún workflow ejecuta `db push`, pero un `db push` manual la aplicaría. Recomiendo renombrarla a `PROPUESTA_`.
- **`lab-planos.yml`** gastaría IA contra `leer-plano` de producción cada día hábil si se fusiona.
- `src/motor/` no cambia en todo el PR.

## 7. Regresiones y pruebas omitidas

- **Vitest:** 288 archivos, 2,460 pruebas en verde (local, `b4b6ca2`).
- **`it.fails` (1):** `preservaEconomia.test.js:357`, defecto STALE conocido de `20261010170000`. Se mantiene para que el defecto siga visible.
- **E2E locales:** persistencia, emisión y concurrencia optimista: 14 pasan, 1 falla en `persistencia.e2e.js:125` (VH-035, a propósito).
- **Omisiones condicionales:** labs y pruebas autenticadas se saltan sin credenciales. No hay omisiones incondicionales.
- **Expectativas que cambié (no relajadas):**
  - `bench/acomodo-calidad/productoTopologiaE2E.test.js`: el operativo 8u fondo 1200 pasa de PARCIAL a ENCONTRADO por la receta App LT. El caso PARCIAL se conserva con el módulo 1u fondo 600 y se añade la aserción de evidencia.
  - `recoveryLane.test.js` y `recoverySource.test.js`: la guardia verifica la constante y su restricción al carril recovery, y ahora también que el override sólo valga en desarrollo. Sigue prohibiendo la Edge productiva sin sufijo.
  - `materialMatch.test.js`: "Solicitado 18 → 19 mm" deja de ser diferencia porque el par está aprobado por negocio desde el 2026-10-08.

## 8. Decisiones que quedan para Dirección

1. **Jaladera recta 300 mm.** Elegir entre `erp-ja29820ac` (298 mm) y `erp-ja1039inox` (318 mm), o dar de alta la correcta.
2. **Pintura electrostática negra.** Aceptar la pintura genérica o dar de alta el color.
3. **Costeo oficial de los 7 productos de C1 (P0-01).** Sin eso ninguna propuesta de catálogo se puede emitir.
4. **Orden de aplicación de vh035c y vh148,** y si se reemplaza `20261010170000` por vh035c.
5. **VH-035c:** confirmar rechazo de re-pin y si Diseño puede ligar productos. Decidir si la huella de material incluye dimensiones y color. `App.jsx` debe marcar `costo_por_lote` para que la regla de lote aplique a líneas costeadas por el motor.
6. **VH-147:** confirmar los dos requisitos extra de certificable (sin `requiere_validacion`, unidad de costo = unidad de costeo) y si el cargador deja de auto-aprobar precios de ≤24 meses.
7. **Motor y 5×8:** leer `insumo.formato` en `calculo.js` requiere subir la versión del motor. Hoy un 5×8 se sobrecostea.
8. **`chapa-walnut` es Walnut Burl.** Confirmar si es el curado correcto para "nogal natural".

## 9. Calificación honesta

| Área | Nota | Motivo |
|---|---|---|
| Costear | 6/10 | Mecánica cerrada y paridad al centavo, pero ningún costo certificado y dos materiales sin resolver. |
| Cotizar (acomodo) | 8/10 | C1 validado con evidencia de catálogo; un solo plano. |
| Cotizar (propuesta) | 3/10 | Bloqueada por falta de costeo oficial; no depende del código. |
| Renders | 7/10 | Cinco etapas pasan; el auditor rechaza a veces (2 de 4 en una corrida). |
| Integridad y concurrencia | 7/10 en RC | Probado en PGlite y E2E con simulador; nada aplicado en la base real. |
