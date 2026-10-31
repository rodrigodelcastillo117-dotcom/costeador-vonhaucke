# 95_HALLAZGOS_RONDA3 — ledger de la Ronda 3 (cierre funcional/económico/E2E)

**Fecha de apertura:** 2026-10-30. **Rama:** `claude/costing-app-architecture-psf02g`.
**HEAD de trabajo:** `be10782` (árbol idéntico al merge `d19557d` que fue a prod).
Regla: nada se marca "cerrado"/"95" sin evidencia reproducible con `archivo:línea` o traza real.
No se reabren hallazgos cerrados sin evidencia nueva. Se reutiliza evidencia válida (presupuesto de APIs de pago).

---

## FASE 0 — Verdad actual y regresiones (en progreso)

### 0.1 Suite de pruebas — VERIFICADO 2026-10-30
- `npm test` (vitest run) sobre el árbol que se desplegó: **3995 pruebas, 406 archivos, 0 fallos, 0 skips reportados**.
  Duración 188.8 s. Evidencia: ejecución en esta sesión (log en vivo). Esto cubre la red de regresión
  unitaria de BLN-01/04/10, motor, UI de dinero, cocrear, acomodo-recovery, edge imports, etc.
- `vite build`: verde (bundle index `index-BKArznAN.js`).

### 0.2 Manifiesto de producción — versiones DESPLEGADAS hoy (fuente: Supabase list_edge_functions)
Edges PROD (no-rc) activas, con versión:
| Edge | Versión prod | ezbr_sha256 (prefijo) |
|---|---:|---|
| costear-servidor | 18 | 107bd1fa… |
| analizar-mueble | 39 | 6fc1ffcc… |
| cotizar-texto | 19 | 75d012b7… |
| leer-plano-core | 9 | 8137faf6… |
| acomodar-espacio-recovery | 20 | f25b5df2… |
| generar-render | 32 | 73fd1119… |
| cotizar-servidor | 8 | d1aea9e9… |
| voni-council | 14 | 3d47d4c6… |

RC (no servidas por prod salvo CARRIL_RC): costear-servidor-rc v30, analizar-mueble-rc v8, leer-plano-core-rc v5,
acomodar-espacio-recovery-rc v3, generar-render-rc v5, cotizar-texto-rc v1.

> Nota de honestidad: el motor avanzado ya fue promovido a los slots prod (no-rc) en esta ronda previa
> (commit `e1a9449`). Las `-rc` quedan como banco de pruebas, no como ruta viva de prod.

### 0.3 Frontend a producción — merge+deploy ejecutado HOY (autorizado por Dirección)
- Merge `--no-ff` de la rama a `c3.4-seller-safe` → commit `d19557d` (push OK, `fece6c3..d19557d`).
- Delta real de bundle (6 archivos): pantalla Aprobar puentes (B2), BLN-01 fail-closed en `calculo.js`,
  perf de render en `AcomodoBase.jsx`.
- Vercel auto-deploy `dpl_4PPfKgethFsF8cF5Yw8Bg5G5xzpD` (target=production, commit d19557d).
- **Punto de rollback:** deploy `dpl_DuxmoFiMxZscSY1kf4Wv7SiuyMTn` (commit `fece6c3`), `isRollbackCandidate: true`.
- Confirmación de "en vivo" (hash de asset del dominio prod cambia de `index-BDj_J2fL.js`): _verificación en curso_.

### 0.4 Estado declarado de los BLN previos (a re-confirmar en esta ronda, sin reabrir sin evidencia)
| ID | Qué | Estado entrante | Cómo se re-verifica en R3 |
|---|---|---|---|
| BLN-01 | costo oficial fail-closed | CERRADO (test dedicado, en 3995 verdes) | regresión unitaria ✓; añadir guard-test si falta |
| BLN-02 | MO/GIF sin tarifas omitidas | modelo sólido; hallazgo MG-1 abierto (tarifa metal App LT) | MG-1 es decisión Dirección (B8) |
| BLN-03 | discrepancia App LT | ligado a MG-1 | idem |
| BLN-04 | unidades/cantidades/fracciones | CERRADO (fail-closed unidad incompatible) | regresión unitaria ✓ |
| BLN-05 | paridad cliente-servidor | CERRADO EN VIVO (al centavo, prod v18) | reutilizar evidencia (no re-quemar API) |
| BLN-06 | seguridad cuenta QA | hallazgo abierto (cuenta QA privilegiada) | FASE 9: remediación sin revelar credenciales |
| BLN-07 | foto→despiece | CERRADO EN VIVO (Gemini) | reutilizar evidencia |
| BLN-08 | renders Flash/Pro | CERRADO EN VIVO (generación+guardado) | FASE 7: falta FIDELIDAD industrial |
| BLN-09 | perfil metálico lineal incompatible | ABIERTO (credenza 9/12, 3 metálicos PENDIENTES) | **FASE 1: prioridad #1 de esta ronda** |
| BLN-10 | precio 0 sin bypass | CERRADO (precio-0 conocido, no bypass) | regresión unitaria ✓ |

---

## FASE 1 — BLN-09 (foto→costo del perfil metálico lineal) — **CERRADO 2026-10-30 (reclasificado + hardening)**

### Mapeo del contrato real (archivo:línea)
- `analizar-mueble` (prod v39, `supabase/functions/analizar-mueble/index.ts:40-44,305`) emite cada pieza con
  `forma∈{area,lineal,pieza}`, `largoMM`=largo de UN tramo, `cantidad`=NÚMERO de tramos, `metrosTotales`=total.
  NO existe campo `unidad/formato/perfil/espesorMM` en ese esquema; lineal se distingue por `forma`.
- Normalizador UI `src/datos/mapIaComps.js:84-126`: un lineal se convierte a `cantidad`=metros
  (`largoMM/1000 × piezas`), guarda `largoLinealMM`/`piezasLineales` y **descarta `largoMM`/`anchoMM`**
  (porque `aplicarPoliticaMaterial`, `materialMatch.js:901-926`, devuelve objeto curado sin esas llaves).
  Un lineal con largo×ancho sólo se reclasifica a área si el insumo es material de HOJA (`:93-95`); un PTR
  (tramo) con ancho **sigue siendo lineal**.
- `dtoCosteoServidor` (`src/nube.js:494-516`) y el allowlist `validarIntentCosteo` (`:34-42`) descartan
  `forma`/`metrosTotales`: el servidor NUNCA ve esos campos. El motor `calculo.js` cuesta el lineal por el
  fallback `netoComponente:325` (`cantidad`=metros) con precio $/m y merma D2.
- App LT (`src/datos/applt.js:174 metalLineal`) ya emite perfiles como `cantidad`=metros SIN largoMM/anchoMM
  → el contrato canónico YA existe; el fix NO lo toca ni lo rompe.
- Ambas pantallas del flujo real (`Costeador.jsx:134,157` y `AsistenteEspecial.jsx:652,660,855`) construyen
  sus componentes vía `mapIaComps`. El flujo foto→costo SÍ pasa por el normalizador.

### Verdad con sondeo en vivo (números reales, insumo `ptr` $38.19/m, tramo 6 m, merma D2 6.94%)
- PTR 1×1700 **confirmado** → 1.7 m, materialDirecto **$69.43** (=1.7×$40.84/m → merma aplicada),
  `estadoCosto: completo`, `costoOficial: 124.97`. ✓ Costea.
- PTR 1×1700 **sin `material_confirmado`** → se calcula pero `materialesPorConfirmar:["Base PTR"]` →
  `costoOficial: null`, no emitible. ← **Éste era el "pendiente" de la credenza (BLN-07): falta de
  confirmación humana del material, el gate fail-closed correcto. NO era un bug de unidades.**
- BLN-09 repro (PTR lineal con `anchoMM:50`) → 5.1 m, costeado, `componentesIgnorados: []` (anchoMM descartado). ✓
- `forma=area` sobre PTR (forma genuinamente mala) → rechazado `calculo.js:394` con motivo "largo de cada
  corte", **materialDirecto 0** (sin costo inventado). ✓ El guard de unidad incompatible sigue firme.

### Reclasificación honesta
BLN-09 **no era pérdida ni bug del motor de dinero**. Por el camino real el perfil lineal se normaliza y
costea bien (merma incluida); el "9/12" venía de (a) materiales sin confirmar y/o (b) una reproducción que
mapeó el `piezas` CRUDO (largoMM×anchoMM) SIN pasar por `mapIaComps`. **Severidad real: P2 (cobertura).**

### Hardening aplicado (RED→FIX→GREEN) — único defecto real encontrado
- **Defecto:** una `cantidad` EXPLÍCITA inválida (negativa o cero) en un lineal se coaccionaba a 1 pieza en
  silencio (`mapIaComps.js:108`), costeando material inventado sin bandera.
- **Fix:** `src/datos/mapIaComps.js` (tras el bloque lineal) marca `iaIncoherencia{campo:'cantidadLineal'}`
  cuando `z.cantidad` es finita y ≤0 (ausente mantiene el default de 1). El validador estructural la bloquea.
  Una cantidad ausente NO se toca. No afecta App LT (usa `metalLineal`, no `mapIaComps`).
- **Regresión:** `src/datos/bln09FotoCostoLineal.test.js` (13 pruebas) — las 10 obligatorias del directivo por
  el camino real: metros correctos, costo correcto, merma aplicada, repro BLN-09 lineal, mixto metal/melamina,
  paridad cliente=servidor, y fail-closed (sin confirmar / forma=area / negativa / cero / ambigua).
- **Suite completa:** 407 archivos, **4008 pruebas verde** (3995 previas + 13), 0 regresiones.
- **Criterio de cierre del directivo cumplido:** el despiece de la IA, por la MISMA normalización de la UI,
  llega al motor y resuelve el metal cuando los datos están completos (incluida `material_confirmado`); si
  falta el dato humano (confirmación de material), queda PENDIENTE documentado.
- **Dato humano que desbloquea:** `material_confirmado` de cada partida metálica (Dirección/Diseño), más la
  tarifa de metal App LT MG-1 (B8) cuando aplique a la ruta intelisis.

---

## FASE 8 — Política de frescura server-side — **VERIFICADO 2026-10-30 (B6 implementada, sin cambio)**

Evidencia leída de las funciones en producción (pg_get_functiondef):
- **`public.resolve_canonical_price(insumo_id, fecha)`** (resolver canónico DATA_TRUTH_V1): filtra
  `estado='aprobado'` + `cost_unit_price_mxn not null` + ventana `vigente_desde ≤ fecha < vigente_hasta`.
  **NO existe filtro de antigüedad/24m.** El único eje temporal es la ventana de **vigencia**. Un aprobado
  con `vigente_hasta` nula/futura es `CERTIFIED_PRICE` cualquiera sea su edad → **confirma B6 en servidor**.
  Devuelve `PENDING_PRICE`(0 filas)/`PRICE_AMBIGUOUS`(>1)/`CERTIFIED_PRICE`(exactamente 1) → fail-closed.
- **`private_api.resolver_costo_insumo(insumo_id)`** (la que consume el motor): guardia seller-safe
  (`puede_editar_config()` → dirección/diseño); `estado_certificacion ∈ {CERTIFICADO, PRELIMINAR, PROPUESTO,
  CONFIG_LEGADO, DESCONOCIDO}`; el config legado se marca **no** certificado (`certificable:false`); DESCONOCIDO
  **no inventa precio**. Expone `vigencia`(fecha) + `fuente` + `evidencia` → fecha y procedencia visibles.
- **`private_api.activar_autoridad_costeo(modo, frescura, version_motor)`**: solo Dirección HUMANA
  (excluye `cuentas_no_humanas`); `frescura ∈ {exigir_vigente, congelar_al_costear}` — **ninguno es corte
  por edad** (vigencia o congelado-al-costear, consistente con B6).

**Las 4 nociones del directivo, formalmente distintas en el esquema/funciones:**
| Noción | Dónde vive | No es… |
|---|---|---|
| Aprobación | `insumo_precios.estado='aprobado'` (firmada por humano) | …vigencia ni certificación |
| Vigencia | ventana `vigente_desde/vigente_hasta` (registro abierto) | …un límite de edad |
| Certificación | `contract_status='DATA_TRUTH_V1'` + `certificable` → CERTIFIED_PRICE | …aprobación a secas |
| Elegibilidad económica | resuelve a **exactamente un** CERTIFIED_PRICE (PENDING/AMBIGUOUS bloquean) | …vigencia a secas |

`firmar_precios_erp_*(p_meses=24)` usan ventana de meses solo como **alcance de la operación de firmado por
lote**, NO como gate de elegibilidad. Precio de insumo aprobado ≠ ProductVersion certificada: la emisión de
líneas product_version pasa por `producto_version_economia` en `evaluar_emision_cotizacion`, separado del
precio de insumo. **Conclusión: el servidor ya aplica B6 (aprobado válido sin importar antigüedad); no se
requiere cambio de código. Alcance = resolución de costo/precio; autoridad = Dirección humana.**

---

## FASE 9 — Seguridad y emisión — **VERIFICADO PARCIAL 2026-10-30 (primitivas server-side) · pentest vivo BLOQUEADO (falta qa-ventas)**

### Seller-safe por DATO (no por ocultar React) — verificado leyendo funciones en producción
- **`public.jsonb_sin_economia(data)`**: stripper RECURSIVO que, normalizando la llave a `[a-z0-9]`, elimina
  toda clave `^(costo.*|cost.*|margen.*|utilidad.*|profit.*|materialtotal|manoobra.*|indirectos.*|overhead.*|
  precioproveedor.*|supplierprice.*|preciocompra.*|precioreal.*|costoderivado.*|internalcost.*|internalmargin.*)$`
  en objetos y arrays anidados. Economía fuera a nivel de datos, no de componente.
- **`public.partidas_vendedor(p)`**: quita `costoUnitario`, `margen`, `costoDerivado`, `precioReal` de cada partida.
- **`public.puede_ver_economia()`**: exige `auth.uid()` y delega a `private_api.puede_ver_economia()` (dirección).
- **`private_api.resolver_costo_insumo`** (FASE 8): lanza excepción si no `puede_editar_config()` antes de
  entregar cualquier costo. El costo de insumo NO viaja a un rol sin economía.

### Cuenta QA (BLN-06 / P0-03)
- `qa-direccion@vonhaucke.mx` (rol `direccion`) **está en `public.cuentas_no_humanas`** (junto con `reconciliacion`).
  `puede_certificar_costo()` excluye no-humanas → qa-direccion **no puede certificar ni aprobar** precios/puentes.
  La autoridad económica ya está cerrada a esta cuenta por diseño (verificado).
- **Riesgo residual (BLN-06):** la contraseña QA es débil/compartida. **Remediación = acción HUMANA**
  (rotar contraseña en el panel de Auth); no se hace desde el repo y no se expone ninguna credencial aquí.
- **No existe `qa-ventas`**: en `permitidos` solo hay `qa-direccion`. El humano debía crear la cuenta de
  ventas para probar el seller-safe en vivo.

### Honestidad del alcance
Las PRIMITIVAS server-side del seller-safe existen y son a nivel de datos (verificado). La **prueba E2E viva
de los 10 ataques** del directivo (leer costos como vendedor, cotizaciones ajenas, cambiar precios desde
cliente, revisiones obsoletas, reutilizar aprobaciones, cambiar identidad de partida, manipular cantidades,
descuentos no autorizados, cambiar snapshots, concurrencia) **está BLOQUEADA** porque falta la cuenta
`qa-ventas` para el rol sin economía, y parte exige correr con datos aislados. Varios de esos vectores ya
tienen cobertura server-side previa (SEG-01 emisión server-side, VH-148 conflicto de versión, PROHIBIDOS en
`validarIntentCosteo`); el pentest vivo completo queda como tarea con `qa-ventas` creada. **No declaro
seller-safe "probado en vivo" sin esa cuenta.**
