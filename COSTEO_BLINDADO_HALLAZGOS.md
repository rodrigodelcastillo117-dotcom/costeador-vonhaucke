# COSTEO BLINDADO — ledger de hallazgos (auditoría correctiva del costeador)

**Inicio:** 2026-10-30 · Rama `claude/costing-app-architecture-psf02g`. Evidencia primero; corrección localizada; RED→FIX→GREEN. Sin deploy/merge/migración/precio/permiso productivo sin autorización de Dirección.

## Clasificación
BUG CONFIRMADO · RIESGO REPRODUCIDO · RIESGO NO CONFIRMADO · DECISIÓN HUMANA PENDIENTE · NO VERIFICABLE.

---

## FASE 0 — inventario (hecho esta sesión)
- Prod corre el motor avanzado (promovido hoy): `costear-servidor` v18, `analizar-mueble` v39, `cotizar-texto` v19, `acomodar-espacio-recovery` v20, `leer-plano-core` v9, `generar-render` v32. Frontend prod (`fece6c3`) = rama salvo `AcomodoBase.jsx`; contrato de costeo cliente↔edge idéntico (diff vacío).
- Motor: `src/motor/calculo.js` (`calcular`), `src/datos/costeoServidor.js` (`costearConMotor`/`atenderCosteo`), `politicaVH.js`, `formulaAlba.js`, `appltCosto.js`. Dos modelos: clasico (GIF=34% MP-directa o Alba 3×MO) e intelisis (App LT, `parModelo`).
- Compuerta de emisión leída completa: `private_api.evaluar_emision_cotizacion(bigint,jsonb)` — recalcula server-side, NO confía en costo del cliente para partidas con product_version (lee `producto_version_economia`); para partidas sin product_version confía en `costoUnitario`+`costoEstado` del snapshot, que el servidor fija con el gate fuerte.

---

## HALLAZGOS

### BLN-01 — `costoOficial`/`estadoCosto` del motor NO honran todos los bloqueos → **BUG CONFIRMADO (P2) · CORREGIDO**
- **Área:** 1 (aritmética/completitud) + 3 (verdad económica).
- **Evidencia:** `src/motor/calculo.js` (antes) `estadoCosto = componentesIgnorados.length ? 'incompleto':'completo'`; `costoOficial = componentesIgnorados.length ? null : costoUnitario`. Sólo miraban `componentesIgnorados`, no `tarifasFaltantes`/`materialesPorConfirmar`/formato `noCabe`/costo no finito — que sí bloquean en `costeoEmitible` (línea 927).
- **Reproducción:** pieza intelisis con `GIF:carpinteria` faltante → `tarifasFaltantes=['MO:carpinteria','GIF:carpinteria']`, `costeoEmitible=false`, pero `estadoCosto='completo'` y `costoOficial=251.48`. Un consumidor del cliente (p.ej. `src/componentes/Tablero.jsx:59`, que gráfica usando `estadoCosto`) trataría un costo NO emitible como oficial.
- **Resultado anterior:** `estadoCosto='completo'`, `costoOficial=251.48` (no emitible).
- **Resultado corregido:** `estadoCosto='incompleto'`, `costoOficial=null` (alineado con `costeoEmitible`).
- **Fix:** `calcular()` computa `_emitible = costeoEmitible({...}).emitible` y lo usa para `estadoCosto`/`costoOficial`. Localizado, sin tocar fórmulas ni el gate del servidor.
- **Prueba añadida:** `src/motor/failClosed.test.js` → "tarifa faltante ⇒ estadoCosto incompleto y costoOficial null". RED verificado (falló antes), GREEN después.
- **Regresión:** 355/355 verdes (motor + costeoServidor + alba + applt + lineas + estadoCosto + borradorCosteo). El servidor ya usaba el gate fuerte, así que la emisión nunca dependió de este hueco; esto cierra la ruta de los consumidores del cliente.

### BLN-02 — Tarifas MO/GIF en centros activos → **fail-closed CONFIRMADO (no bug)**
- Horas>0 con tarifa 0/ausente en un centro activo (intelisis) ⇒ `tarifasFaltantes` ⇒ no emitible. Reproducido con MO y GIF faltantes; centros inactivos con tarifa 0 no bloquean (correcto). `costoHoraGIF` en ceros del config es inerte (clasico no lo lee; intelisis trae `parModelo`). Ver `95_AUDIT_MO_GIF.md`.

### BLN-03 (MG-1) — App LT cobra metal a tarifa `otros` ($296/h) y no `pm` ($374/h) → **DECISIÓN HUMANA PENDIENTE (P2)**
- ~$995 menos por banca 6U en MO+GIF del metal. No es $0 ni inventado; es tarifa más barata. Qué tarifa lleva el metal lo decide Dirección/Alba (blocker B8). No se corrige sin esa decisión. Ver `95_AUDIT_MO_GIF.md` / `95_BLOCKERS.md`.

### BLN-04 — Matriz adversarial de cantidades/fracciones → **fail-closed CONFIRMADO (no bug de pérdida)**
- cantidad 0/null/omitida/negativa/"abc"/NaN/Infinity y hojas 0/-0.25 ⇒ todos PENDIENTE, `costoOficial=null`, no emitible. Nunca $0 silencioso, nunca NaN/Infinity emitible.
- Observaciones de dirección SEGURA (sobre-costo, no pérdida): `cantidad:1e9` cuesta finito grande (orden real, no bug); `cantidad:0`+geometría cuesta 1 panel (sobre-costo de input raro) → **RIESGO NO CONFIRMADO / P3**, no se corrige (es dirección segura y desestabilizaría el camino geométrico).
- **Unidad incompatible** (insumo por pza consumido por área m²) ⇒ PENDIENTE con motivo claro ("no se convierte largo×ancho sin conversión documentada"), no emitible. ✓
- **Formato noCabe** (panel 3000×600 o 2500×1220 > tablero 2440×1220) ⇒ `detalleInsumos[].noCabe`, estado=incompleto, `costoOficial=null`, no emitible. ✓ Este caso **valida BLN-01**: antes `noCabe` NO estaba en `componentesIgnorados`, así que `costoOficial` traía número; con el fix ahora es null.

---

### BLN-05 — Paridad cliente↔servidor EN VIVO contra prod v18 → **CONFIRMADA AL CENTAVO (smoke en vivo cerrado)**
- **Método:** login real `qa-direccion@vonhaucke.mx` (rol dirección) → POST a `costear-servidor` v18 de PRODUCCIÓN con la credenza 1.80 (3 puertas) vía el proxy. Sin IA, sin escritura, sin emitir.
- **Resultado:** costoUnitario **$2,575.12**, materialTotal **$1,580.99**, MO **$248.53**, GIF **$745.60** — **idénticos** al motor local; detalle por insumo igual (melamina 1167.40 / canto 185.89 / bisagra 114 / jaladera 113.70). **La prod v18 computa exactamente lo que dice el motor de la rama.**
- **Hallazgo colateral (no bug, es fail-closed CORRECTO):** un despiece con `insumoId` pero **sin `material_solicitado`** (la especificación que manda el selector de la UI) ⇒ el servidor devuelve `estado=incompleto`, $0 y warning "falta material" — **no inventa un costo**. Con `material_solicitado` ⇒ costea pero marca **`preliminar`** (no `certificado`/emitible), porque una spec mandada por el navegador no se auto-certifica (diseño SEG-01: cliente/IA propone, humano con capability confirma). Precio preliminar ofrecido; cada pieza lista "Material propuesto sin confirmar". Correcto.

### BLN-06 — Cuenta QA `qa-direccion@vonhaucke.mx` con rol dirección y contraseña trivial `123456` → **RIESGO (P1 seguridad) · DECISIÓN HUMANA**
- Una cuenta con rol **dirección** y contraseña `123456` en Auth de producción es un riesgo de acceso. Ya estaba señalado en `DECISIONES_PENDIENTES.md` (C3: "cambiar la contraseña trivial de esa cuenta o bajarla a vendedor").
- **Recomendación:** bajar su rol a vendedor, o contraseña fuerte, o deshabilitarla. No lo ejecuto yo (toca Auth/permisos productivos). La contraseña NO se persiste en repo/memoria por seguridad.

### BLN-07 — Foto→despiece EN VIVO (analizar-mueble v39 prod, Gemini) → **CERTIFICADO (interpretación) con autorización de Gemini**
- Foto `lab/costear/credenza_nogal.png` → `analizar-mueble` v39 prod con login QA. Resultado: producto "Credenza 3 puertas nogal 1800 mm con base PTR", **16 piezas** con `material_solicitado` + `insumoId` mapeado a catálogo + `material_match` (EXACT/SUBSTITUTE_SUGGESTED) + `confianza` por pieza.
- **Fail-closed correcto:** "Respaldo MDF 9 mm" no está en catálogo → `insumoId` vacío, `SUBSTITUTE_SUGGESTED`, y **pregunta** al usuario (no inventa el material). 4 preguntas estructuradas (impacto/afecta/supuesto). No presenta inferencia como certeza.
- Costo: 1 llamada (~22k in / 6.6k out tokens), 99s. Dentro de la autorización de Gemini.

### GOV-01 — "Aprobar todas las materias primas" → **RECHAZADO por diseño (no lo ejecuto), decisión humana real**
- La cuenta `qa-direccion` es NO-humana (excluida de certificar precios por diseño: `puede_certificar_costo_excluye_no_humanas`). Aprobar precios con ella = recrear el problema P0-03 (aprobaciones no-humanas) y romper el rastro de auditoría. Aprobar "todas" a ciegas convierte precios viejos/orientativos en falsos-certificados → destruye la confianza del costeo.
- **Camino correcto:** preparar el lote de precios ELEGIBLES (procedencia completa + frescura según política de Dirección) y que **un humano de Dirección** (cuenta real `rodrigo.delcastillo@vonhaucke.mx`) los apruebe (`preciosCertificables` / `firma_precios_erp_lote`). No lo hace el bot ni la cuenta QA.

### BLN-08 — Renders EN VIVO (generar-render v32 prod, Gemini) → **CERTIFICADO (pipeline + velocidad + auditoría)**
- Credenza: render **flash** (default) `gemini-3.1-flash-image` 16s + render **pro** (`pro:true`) `gemini-3-pro-image` 22s (imagen 2K, 2.1MB). Ambos `ok:true`, guardados a Storage (url, no base64), **auditoría `pass:true`** los dos. Confirma el pipeline, la mejora flash-default (antes ~90s) y que el pro-opcional funciona.
- Residuo QA a limpiar: 2 objetos de render en Storage de `qa-direccion` (como ya anotó `DECISIONES_PENDIENTES` C3). No es bug; limpieza pendiente.

### GOV-01 (ampliado) — Lote de aprobación MP → **los precios YA están 100% aprobados por humano; solo faltan 42 puentes**
- Medición read-only: `precios_elegibles_no_aprobados = 0`; `precios_ya_aprobados_vigentes = 12,971` (todos `approved_by = rodrigo.delcastillo@vonhaucke.mx`, humano); `bridges_propuestos = 42`.
- Es decir, "aprobar MP" = **aprobar los 42 puentes clave→insumo** (ya entregados en `PUENTE_CLAVE_INSUMO_aprobar.csv`), NO re-aprobar precios.
- `aprobar_mapeo_externo(p_mapeo_id,p_nota)` **tiene guardia de rol** (verificado por definición) → la cuenta QA no-humana NO puede aprobar. Se aprueba con la cuenta humana de Dirección. No lo ejecuta el bot. Detalle en `95_LOTE_APROBACION_MP.md`.

## LÍMITE HONESTO DE ESTA SESIÓN
- **Ataques de emisión EN VIVO (Fase 4) y seller-safe/RLS por REST (Fase 5):** requieren un JWT de cuenta de prueba que **no tengo en esta sesión**. Hice revisión ESTÁTICA del gate (`evaluar_emision_cotizacion` completo: recomputa server-side, identidad por línea, campos que no corresponden, especial/reventa, margen mínimo, aprobación por hash) y la separación seller-safe en `costeoServidor.js`. La reproducción VIVA de los 20 ataques y de IDOR por REST queda **NO VERIFICABLE desde aquí** hasta tener credenciales de QA o que Dirección las corra. La prueba viva de seller-safe por JWT simulado (SQL, ROLLBACK) sí se hizo antes (ver `95_SCORECARD.md`).
