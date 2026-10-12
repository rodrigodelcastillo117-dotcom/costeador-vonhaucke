# OPERACIÓN RESCATE NOCTURNO · Von Haucke · 2026-10-12/13

Rama RC: `claude/costing-app-architecture-psf02g` · Producción auditada: `766df46` (Vercel READY, Supabase `mtuvnbgljwbsaizjjgzs`).
**Sin merge, sin deploy, sin migraciones aplicadas, sin cambios de precios/permisos/datos históricos.**

Numeración: esta matriz usa los IDs del mandato nocturno (VH-090…VH-107). Los IDs usados en RC-1 (`3b0020c`)
se citan como alias (p. ej. `VH-093-rc1 asientos` → ahora parte de VH-098; `VH-094-rc1 mensajes` → VH-093/VH-097;
`VH-095-rc1 mampara` → VH-094; `VH-097-rc1 unidades` → VH-099; `VH-098-rc1 fuente` → VH-101).

## FASE CERO · estado real (05:25 UTC)

| Qué | Valor |
|---|---|
| HEAD rama | `0e155a8` (5 commits sobre `cc1dc80` = producción + ledger) |
| Diff vs producción | 33 archivos, +1,074 / −55 (sin cambios de esquema aplicados) |
| Sin commit | 0 archivos |
| Edges en producción | costear-servidor v8 · cotizar-servidor v8 · acomodar-espacio-recovery v8 · leer-plano v11 · leer-plano-core v4 · analizar-mueble v34 · generar-render v30 · voni-council v12 |
| Edges con cambios en RC sin desplegar | costear-servidor, acomodar-espacio-recovery (kit-solver, opciones), leer-plano, leer-plano-core |
| Migraciones en repo NO aplicadas | `20261012060000_vh099_dimensiones_catalogo` (dimensiones PRELIMINAR) · `20261012061000_vh100_cargar_costos_oficiales` (economía por clave Intelisis) |
| Migración en repo sin registro en BD | `20261010170000_actualizar_cotizacion_preserva_economia` (ver nota abajo) |
| Suite | vitest 2,088/2,088 · Playwright local 28 PASS / 14 omitidos sin credenciales (+2 con credenciales: programaP01, programaVH090 PASS) · build PASS |
| Pasada en vivo (producción, QA) | 9 PASS / 2 FAIL por test (corregidos VH-096-rc1); re-corrida en curso |

Reproducido con evidencia (no hipótesis): VH-090, VH-091, VH-092, VH-093, VH-094 (cotización 757 real en BD + plano ARQ-01),
VH-099 (motor, prueba), VH-100 (SQL), VH-101 (código), VH-103 (cotizar-servidor en vivo), VH-097 (captura + código).
Hipótesis sin reproducir todavía: VH-096 (reparaciones del solver), VH-098 (PDF escaneado), VH-102 (BOM completo por tipología),
VH-105 (render al reabrir Cocrear), VH-106, VH-107.

## MATRIZ (se actualiza por bloque)

| ID | Sev | Módulo | Evidencia | Causa raíz | Archivos/RPC | Corrección | Tests | SHA | Estado | Riesgo |
|---|---|---|---|---|---|---|---|---|---|---|
| VH-090 | P0 | Cotizar | cot. 757: 18 partidas, cada mueble ×2 (REFERENCIA programa + FIRME VONI); "18 sillas para 10 puestos" | identidades distintas (`op-8u-…` vs `linea-banca_doble`); conciliación sólo por `bancoId` igual; `juntarIguales` sólo idénticos | `reconciliarPartidas.js`, `confirmarPrograma.js`, `App.jsx`, `Voni.jsx` | conciliación por ROL funcional en ambos sentidos (al agregar y al aplicar/vincular); la persona gana y hereda estructura; duplicados existentes se enseñan antes y se fusionan con el mismo botón; idempotente | `reconciliarPartidas.test.js`(5) `confirmarPrograma.test.js`(+6) `golden757.e2e.js` (navegador: 18 → 12 partidas, 1 ancla por rol, WIN 8, ALPHA 1, sin "sobran", 2ª aplicación sin cambio, recarga igual) | `e561bdf` | **PASS** (G1–G6) | bajo |
| VH-091 | P0 | Cotizar | conflicto `mj-900×900 vs mj-1200×1200`, botón muerto, sin salida | conflicto programa-vs-programa sin acción | `Voni.jsx` (`ConflictoPrograma`), `App.jsx`, `confirmarPrograma.js` | panel por conflicto con tabla lado a lado (producto, identidad, cantidad, medidas, usuarios, precio de lista, dependientes) y TRES decisiones: Conservar / Sustituir / Mantener ambos; nada se sustituye solo; sillas del mismo kit no se duplican | `confirmarPrograma.test.js` (VH-091 ×3) · `programaVH090.e2e.js` (navegador PASS) | `b261830` | **PASS** | bajo |
| VH-092 | P0 | Acomodo | 11 partidas de VONI sin `relation_role` → "sin un mueble que las reciba"; referencias podían entrar como validadas | solver sólo coloca piezas con rol; sin estados de elegibilidad | `espacio.js`, `acomodoPayload.js`, `kit-solver.js`, `AcomodoBase.jsx` | rol inferido + grupo por destino + zona por destino; `elegibilidad` CONFIRMADO/PRELIMINAR/REFERENCIA y `huella_fuente` por pieza; REFERENCIA (sin identidad ni precio) se dibuja pero bloquea VALIDADO; PRELIMINAR etiquetado | `diagnosticoAcomodo.test.js` (VH-092 ×2) `vh092_cotizacion757.test.js` | `b261830` `88d458b` | **PASS** (unit+golden) | bajo |
| VH-093 | P0 | Acomodo | "4 silla de juntass · 21 piezas · capacidad del catálogo" | plural ingenuo; causa genérica; sin rastreo por pieza | `opciones.js`, `diagnosticoAcomodo.js` (nuevo), `AcomodoBase.jsx` | tabla por pieza: mueble, zona, medida + fuente, causa (código) y acción; códigos DUPLICATED_REQUIREMENT / MISSING_ANCHOR / UNKNOWN_FOOTPRINT / UNRESOLVED_PRODUCT / NO_SPACE / COLLISION / CLEARANCE / BLOCKED_DOOR / INCOMPATIBLE_ZONE / DEPENDENCY_MISMATCH; gavetas bajo cubierta no ocupan piso | `diagnosticoAcomodo.test.js` (5) · golden757: las 4 SONATA restantes = MISSING_ANCHOR con acción | `b261830` `88d458b` | **PASS** | nulo |
| VH-094 | P0 | Acomodo | banca 6000×1200 como línea en 2D | `tipoDe` → 'mampara' por "biombo" → `enderezarAlto` 4800×80 | `espacio.js` | esMueble reconoce módulo/operativo; ancla nunca es mampara; traza partida → expandirPiezas → payload (6000×1200) → solver (colocada) → 2D/3D (rect real, captura golden) | `diagnosticoAcomodo.test.js` (VH-094) · golden757 (payload y colocación de `p-1-1` 6000×1200) | `3b0020c` `e561bdf` | **PASS** | bajo |
| VH-095 | P0 | Cotizar | "18 sillas para 10 puestos: sobran 8"; CONCERTO de juntas marcada "en zona equivocada" por su nombre | duplicados + heurística por nombre antes del rol | `entendido.js` (fuente corregida), `floorSpec.js` (`rolDePiezaAcomodo`: `relation_role` manda) | cuentas por función coherentes; validador de zonas usa el rol explícito | `entendido.test.js` (VH-095) · golden757 (sin "sobran", sin "zona equivocada") | `88d458b` `HEAD` | **PASS** | bajo |
| VH-096 | P1 | Acomodo | credenza/archivero (SUPPORT_STORAGE) metidos bajo la mesa de juntas → OVERLAP; visitas sin lugar (escritorio cap 1); OOM al hacer kit propio (mínimo vacío → -Infinity) | adopción indiscriminada; capacidad de escritorio sólo ejecutivo; bug `Math.max(...[])` | `kit-solver.js`, `recovery-core.js`, `acomodoPayload.js` | guarda de piso = kit propio con huella real en su zona; escritorio: ejecutivo + 2 visitas; recepción recibe visitas; invariantes/reparaciones intactas | `bench/acomodo/banco.test.js` (banco local 100 %), `recovery-core.test.js`, golden757: 21/25 sin solapes, 0 issues duros | `88d458b` | **PASS** (sin solapes) · reparación ≤3 intentos ya existente (`acomodoOrquestador`) | medio: cambia dónde caen guardas/visitas |
| VH-097 | P1 | Plano | 5 avisos `[puertas[i]]`; al confirmar se perdían las puertas pendientes | sin agrupación; `aMM/aMetros` descartaban `puertasPendientes` | `floorSpecAvisos.js`, `ConfirmarLectura.jsx`, `planoLeido.js`, `floorPlan.js` | aviso resumido con conteo; panel "Detecté N puertas…" una por renglón (cuarto, posición, vano, motivo); confirmar la lectura NO aprueba el barrido: quedan pendientes y viajan al acomodo | `floorSpecAvisos.test.js` (+2) · `lecturaPlano.e2e.js` (+1 navegador) | `3b0020c` `88d458b` | **PASS** (sin editor gráfico de sentido: se deja pendiente; corregir = dibujar) | nulo |
| VH-098 | P1 | Plano | sala de 10 sillas → mesa de 4; `leer-plano` 29/33 REVIEW_REQUIRED | sólo contaba `puestos`; sin `asientos` | `leer-plano-core`, `leer-plano`, `planoLeido.js`, `programaDelPlano.js`, `floorPlan.js` | `asientos` observados (OBSERVED) mandan sobre la regla de m²; sobreviven la conversión | `programaDelPlano.test.js` (+2) | `3b0020c` `88d458b` | **PARCIAL** (edge sin desplegar; PDF escaneado no probado: BLOCKED sin archivo) | bajo |
| VH-099 | P0 | Costear | `erp-accr348` $1,018.50/hoja sin formato × 0.72 m² = $733.32 | m² × $/unidad sin conversión | `calculo.js` | `incompatibilidadUnidad` → PENDIENTE con motivo (hoja/pza/kg/m sin formato; `hojas` exige formato) | `unidadesErp.test.js` (22: ACCR348, B809/B835, 16/19/28 = ¼ hoja exacto, lámina kg/hoja, herrajes pza/par, 1200×600, 1800×900, >formato, lote) · goldens 240/240 | `3b0020c` | **PASS** cliente · **PARCIAL** servidor (mismo motor, v9 sin desplegar) | bajo |
| VH-100 | P0 | ERP | 1,763 aprobados por qa-direccion; MXN asumido; IVA desconocido; 526 > 12 m; 30 sin hash | carga masiva autorizada verbalmente | — | matriz de verificación (docs/RC_2026-10-12_MATRIZ_P0.md) | SQL | — | BLOCKED (decisión humana) | alto |
| VH-101 | P0 | Costear | `fuenteCosto:"config-legado"` fijo; fallback podía salir certificado | etiqueta fija | `costear-servidor`, `AsistenteEspecial.jsx` | fuente real (`catalogo`/`config-fallback`), tope `preliminar` con respaldo, snapshot con versión/fuente del servidor | contrato + suite | `3b0020c` | **PARCIAL** (edge sin desplegar; paridad al centavo la exige `validarConServidor`) | bajo |
| VH-102 | P1 | Costear | — | — | `src/motor/*` | auditoría: BOM fail-closed ya existente (pieza sin material/precio/consumo ⇒ PENDIENTE, nunca $0), goldens Alba/Intelisis al centavo (`goldenIntelisis` 16, `matrizGolden` 25 familias, `protectedAlbaRafa`, `failClosed` 22), nesting advisory separado del costo oficial (`optimizacionCorte` no altera el costo) | suite 2,099 verde | — | **PASS** (auditoría de cobertura; sin cambios) | — |
| VH-103 | P0 | Cotizar | 1,931 partidas sin economía; `ECONOMICS_INCOMPLETE` en vivo (350/620/1172) | sin vínculo con costo Intelisis | `20261012061000_vh100…sql` (NO aplicada), `emisionUX.js` | RPC de carga con procedencia; UI dice qué falta (costo industrial oficial, lo carga Dirección) y conserva el borrador; gate intacto | `emisionUX.test.js` | `d35481a` `HEAD` | **BLOCKED** (reporte Intelisis + autorización) · UX PASS | medio |
| VH-104 | P1 | Guardado/PDF | — | — | — | e2e existentes: persistencia (6: 100 recargas, 2 pestañas, vendedor/Dirección, otra computadora, sin internet, respaldo) y emisión (5: PDF, bloqueos, aprobación) | Playwright local (ver checkpoint) | — | **PASS** (local, nube falsa) · emisión real en producción no se ejecuta (irreversible) | — |
| VH-105 | P1 | Cocrear | `reabrir` → `setRender(null)`: el render fotográfico no está en el payload `cocrear` | sólo se guardaban specHash/expected; la URL canónica vive en `expedientes.render_aislado_url` (la devuelve `cocrear_seguro`) | `CocrearV3.jsx` | al reabrir se recupera la URL canónica y se muestra; `renderStale` lo marca VENCIDO si las firmas no cuadran (fail-closed) y ofrece regenerar | sin e2e (requiere expediente real con render) | `88d458b` | **PARCIAL** (código; probar con expediente real) | bajo |
| VH-106 | P1 | VONI | — | — | `CocrearV3.jsx`, `voni-council` | auditoría: degradación controlada existente ("Council no pudo responder", cambio aplicado al modelo se conserva); `cotizar-texto` en vivo OK (20 s); no se invierten tokens en más pruebas de IA | pasada en vivo | — | **PASS** (auditoría) | — |
| VH-108 | P1 | Costear/IA | `analizar-mueble` 502 PROVIDER_TIMEOUT en la pasada en vivo (06:40); `ai_eventos` 7 d: 123 ok / 70 PROVIDER_TIMEOUT | latencia del proveedor con PDF/descripciones largas; el edge ya reintenta (attempts) y la UI ofrece "Intenta de nuevo"; sin cola ni degradación a menos hojas automática | `analizar-mueble` (edge) | sin cambio esta noche (requiere decidir presupuesto de tiempo/modelo; no se gastan más llamadas de IA) | pasada en vivo | — | **ABIERTO** (P1, intermitente) | — |
| VH-109 | **P0** | Guardado | ninguna cotización en la nube traía el plan del acomodo (`cotizaciones.acomodo.plan` null / 0 colocadas en TODAS las filas de hoy, aun con "En línea" en el encabezado) | ciclo AcomodoBase → `guardarAcomodo` (App) → AcomodoBase: el guardado automático (600 ms) escribía el MISMO contenido en un objeto nuevo, el componente se re-renderizaba y volvía a guardar cada ~650 ms; el autosave a la nube (1.5 s de calma) nunca se disparaba | `App.jsx` (`guardarAcomodo`), `acomodoEstado.js` (nuevo) | fusión idempotente por contenido: sin cambios ⇒ mismo estado (React no re-renderiza) ⇒ el ciclo se corta ⇒ el autosave sale 1.5 s después (`actualizar_cotizacion_segura` 36 KB con plan) | `acomodoEstado.test.js` (4) · golden757: autosave real → `cotizacion_segura` devuelve 12 partidas y 21 colocadas; reabrir desde el Archivo idéntico | `29522e4` | **PASS** (persistencia real verificada en la nube, filas 802/803) | nulo (sólo evita escrituras idénticas) |
| VH-090b | P0 | Cotizar | release gate: en la 757 la SONATA de la persona NO se fusionaba al APLICAR (sí en el panel): quedaban 2 filas MEETING del programa | al aplicar, `confirmarPrograma` parcha la CONCERTO del programa con `zone_id` y la SONATA queda sin él; el eje de ambigüedad `zona|ancla` las veía como dos zonas aunque cuelgan de la MISMA mesa | `reconciliarPartidas.js`, `Voni.jsx`, `App.jsx` | eje de identidad = ancla/grupo (dependientes) o requerimiento/instancia (anclas); la zona sólo decide sin identidad. Orden: `requirement_id` > decisión explícita de la persona > zona; varias zonas posibles ⇒ **NEEDS_REVIEW** (panel `ambiguas-programa`, se decide por zona), nunca sustitución automática; cantidad parcial ajusta el resto del programa; capacidad distinta se avisa | `reconciliarPartidas.test.js` (14: dos salas ambiguas, zona explícita, decisión explícita, dos despachos mismo rol, dos grupos WIN en zonas distintas, parcial 6 de 8 → restan 2, banca 8 vs módulo 10, `requirement_id` manda sobre zona) · golden757 (≤1 fila MEETING del programa; p-10 hereda MEETING_SEAT + ancla) | `29522e4` | **PASS** | bajo |
| VH-095b | P1 | Acomodo | `planner.stress.test.js`: las WIN 17–20 se sentaban en "Dirección" (violación de zona) al heredar el rol WORK_SEAT explícito | `sentarSillas` traía sillas pendientes a cualquier área con escritorio sin consultar `zonaPermite` | `planner.js` | una silla pendiente sólo se trae a un área donde su rol está permitido; la regla de zonas (`floorSpec.zonaPermite`) se conserva tal cual (silla operativa sólo en Área Operativa) | `planner.stress.test.js`, `floorSpec.test.js`, `planner.test.js` (35) | `29522e4` | **PASS** | bajo |
| VH-107 | P1 | Render | — | — | `AcomodoBase.jsx` | auditoría: el render final queda bloqueado mientras el acomodo no sea PASS/render_ready (gate dura existente, visible en golden: "render bloqueado hasta cerrar el acomodo"); ahora además bloquea con referencias sin identidad | golden757 (captura) | — | **PASS** (auditoría) | — |

## CHECKPOINTS

| Hora (UTC) | SHA | Cerrados | Abiertos | Tests | E2E real | Cambios DB | Regresiones | Próximo |
|---|---|---|---|---|---|---|---|---|
| 05:25 | `0e155a8` | VH-090, VH-094, VH-099 (cliente) | resto | vitest 2,088 · PW local 28+2 | prod: 9 PASS, re-corrida en curso | ninguno | ninguna | Bloque A: A2 conflictos con 3 decisiones, A3 elegibilidad, A4 diagnóstico por pieza |
| 06:50 | `561b741` | + VH-095 zonas por rol explícito, VH-103 UX, VH-096-rc1 tests en vivo | VH-098 (edge), VH-100 (decisión), VH-103 (dato), VH-105 (prueba real), VH-108 (proveedor IA) | vitest 2,099 · PW local **44/44** · golden757 PASS · vivo: 4 de 5 caminos (ver tabla) | prod: acomodo 0 colocadas con edge v8 (evidencia "antes"); IA intermitente | ninguno | ninguna nueva | Entrega: reporte ejecutivo y GO/NO-GO |
| 08:50 | `29522e4` | release gate E1+E2: VH-090b (conciliación multi-zona), VH-109 (persistencia del acomodo), VH-095b (planner); golden 757 contra el edge RC bajo Deno con JWT real y persistencia real | VH-098 (edge), VH-100, VH-103, VH-105, VH-108 (sin cambio) | vitest **2,112/2,112** (264 archivos) · golden757 PASS en ambos modos (Node y edge RC Deno) · PW local **44/44** | — | ninguno | ninguna nueva | GO/NO-GO abajo |
| 06:20 | `88d458b` | Bloque A completo (VH-090…096), B (VH-097; VH-098 parcial), C (VH-099 cliente, VH-101 parcial, VH-102 auditado, VH-103 UX), D (VH-105 código, VH-106/107 auditados) | VH-098 (edge), VH-100 (decisión), VH-103 (dato), VH-105 (prueba real) | vitest 2,099/2,099 · build OK · PW: golden757 PASS, programaP01/VH090 PASS, acomodo ×3 PASS, lecturaPlano 5/5 | prod: pasada en vivo re-corrida (resultado abajo) | ninguno | regresión temporal en `bench/acomodo` (visitas en recepción) detectada y corregida en la misma hora; OOM del kit propio detectado por bisección y corregido | Bloque E: suite Playwright completa, reporte ejecutivo |

## REPORTE EJECUTIVO (se cierra al final de la noche; cifras de ejecuciones reales de esta sesión)

1. **P0 cerrados de verdad (reproducidos, corregidos, con prueba dedicada, flujo completo y persistencia):** VH-090, VH-091, VH-092, VH-093, VH-094, VH-095, VH-099 (cliente). **7**.
   P0 parciales (código en RC, falta desplegar edge para verificar en producción): VH-101, VH-099 (servidor).
2. **P1 cerrados:** VH-096, VH-097, VH-102 (auditoría), VH-104 (local), VH-106 y VH-107 (auditoría). Parciales: VH-098 (edge), VH-105 (código, sin expediente real).
3. **BLOCKED y por qué:** VH-103/VH-100-costos (1,931 partidas sin costo industrial oficial: hace falta el reporte de costos Intelisis por clave y aplicar `vh100`), VH-100-precios (1,763 aprobaciones por la cuenta QA: decisión de Dirección: re-firmar, degradar o regla de 12 meses; 30 filas sin hash; IVA/moneda sin columna en el Excel), VH-099-datos (489 insumos ERP «hoja» sin formato: hay que capturar la hoja de referencia), dimensiones de 1,738 PVs (migración `vh099` lista, sin aplicar), PDF escaneado (sin archivo), fixtures `QA_FIXTURE_*` en producción (retiro con firma).
4. **¿Desaparecieron los duplicados WIN/ALPHA/CONCERTO?** Sí. Golden 757 en navegador: 18 → 12 partidas; 1 ancla por rol (banca p-1, Eclipse p-2, mesa p-4, recepción p-11); WIN 8 (una fila), ALPHA 1, sin "sobran"; segunda aplicación sin cambios; recarga idéntica.
5. **¿Puede resolverse el conflicto de las mesas?** Sí: panel con tabla lado a lado y tres decisiones (Conservar / Sustituir / Mantener ambos). Probado en navegador (`programaVH090.e2e.js`): la mesa 900 sale, entra la 1200, las sillas del kit no se duplican.
6. **¿APP LT 6000×1200?** Sí: `tipoDe` ya no la vuelve mampara; llega 6000×1200 al payload, el solver la coloca y el 2D/3D la dibuja a escala (capturas `golden_acomodo*.png`). Topología doble declarada (4+4) sigue dependiendo del perfil del catálogo (no inventada): hoy 8 WIN en una hilera frontal.
7. **Colocadas antes/ahora (caso real):** antes 9 de 34 (producción); ahora **21 de 25** (las 8 gavetas van bajo cubierta y no ocupan piso; las 4 SONATA restantes no caben en una mesa 1.20×1.20 de 4 lugares, diagnosticadas MISSING_ANCHOR con acción).
8. **¿Se identifican todos los no colocados?** Sí: tabla por pieza con zona, medida y su fuente, causa (código) y acción; sin "juntass" ni "capacidad del catálogo".
9. **¿Costear respeta materiales, consumos y unidades?** Sí en cliente (VH-099: 22 pruebas, goldens intactos; precio por hoja/pza/kg/m jamás × m² sin formato). En servidor es el mismo motor, pendiente de desplegar `costear-servidor` v9.
10. **¿Cotizar deja de bloquear indebidamente?** El bloqueo `ECONOMICS_INCOMPLETE` es legítimo (no hay costo oficial): se conserva. Lo que cambió: la UI explica exactamente qué falta y quién lo carga, conserva el borrador, y existe el RPC con procedencia para cargarlo (sin aplicar). El margen 25 % y las aprobaciones no se tocaron.
11. **¿Cocrear conserva productos y renders?** Productos sí (expedientes + revisiones). Render: al reabrir ahora se recupera la URL canónica del expediente y se marca VENCIDO si no cuadra con la revisión (antes se perdía). Sin prueba con expediente real esta noche.
12. **¿VONI y despiece coherentes?** `cotizar-texto` y `analizar-mueble` reales OK en producción; el gate de material (POR CONFIRMAR) explica por qué un costeo queda pendiente; degradación de Council existente.
13. **E2E corridas de verdad:** ver tabla final (unit, Playwright local con nube falsa + credenciales QA, golden 757 con el solver real del edge en Node, pasada en vivo contra producción).
14. **Regresiones detectadas y resueltas:** (a) bench local de acomodo: visitas en recepción sin cupo tras VH-096 → corregido (recepción recibe visitas); (b) OOM del solver al hacer kit propio una guarda (mínimo vacío) → corregido; (c) primera versión de VH-092 excluía del solver fixtures sin identidad → se cambió a "se dibuja, no valida"; (d) tests en vivo con selectores viejos → corregidos.
15. **Para desplegar con seguridad:** ver `DECISIONES_PENDIENTES.md` §E (E1 cliente, E2 edges, E3 dimensiones, E4 costos oficiales, E5 precios ERP). Orden recomendado: E1+E2 juntos (cliente y edges comparten contratos: `relation_role`, `unassigned`, `asientos`), después E3, E4/E5 con datos y firma.

## PRUEBAS EJECUTADAS DE VERDAD (cierre de la noche)

| Suite | Resultado | Dónde |
|---|---|---|
| vitest (unit + goldens + edge JS) | **2,099 / 2,099 PASS** (263 archivos) | `npx vitest run` sobre `HEAD` |
| build Vite | PASS | `npm run build` |
| Playwright local, nube falsa + credenciales QA (todo menos `live-ai`/`vivo`) | **44 / 44 PASS**, 0 omitidos (5.9 min) | `pw_local5.log` |
| Golden 757 · release gate (`29522e4`, edge RC servido con Deno + JWT real, persistencia real en la nube y reapertura desde el Archivo) | PASS 16.8 s: 18→12, 25 al solver, 21 colocadas, 0 `fail`, 4 SONATA MISSING_ANCHOR, fila 803 = 12/21 por RPC y SQL | `e2e/golden757.e2e.js` con `EDGE_RC_URL=http://localhost:8000/` |
| vitest · release gate | **2,112 / 2,112 PASS** (264 archivos) | `npx vitest run` sobre `29522e4` |
| Playwright local · release gate (nube falsa + credenciales QA, sin `live-ai`/`vivo`; incluye golden757 en modo Node) | **44 / 44 PASS** (5.7 min) | `npx playwright test --grep-invert "live-ai|vivo"` sobre `29522e4` |
| Golden 757 (plano ARQ-01 + 18 partidas reales, solver REAL del edge en Node, login real) | PASS: 18→12 partidas, 21/25 colocadas, 0 solapes, diagnóstico por pieza, recarga idéntica | `e2e/golden757.e2e.js`, capturas `golden_acomodo*.png` |
| Pasada en vivo contra producción (`766df46`, cuenta QA) | `auth` 8/8 · `live-ai-smoke` 1/1 · `vivoSombra` PASS (analizar-mueble + costear-servidor reales; costeo pendiente por gate de material, por diseño) | `pw_prod*.log`, `reporte_vivo*.json` |
| `vivo` 5 caminos en producción (06:40 UTC) | login OK · `cotizar-texto` OK (20 s) · `leer-plano` OK real (3 cuartos, 84 m², REVIEW_REQUIRED honesto) · `acomodar-espacio-recovery` 200 pero **0 colocadas** (edge v8 de producción: la partida de VONI no trae rol → evidencia "antes" de VH-092; en RC el mismo caso coloca) · `analizar-mueble` **502 PROVIDER_TIMEOUT** (intermitente: 70 de 193 llamadas en 7 días; una corrida antes había respondido en 40 s) · `generar-render` no se alcanzó (depende del anterior) | `pw_prod5_full.log`, `reporte_vivo5.json` |


## RELEASE GATE E1+E2 · 2026-10-12 08:50 UTC · RC `29522e4` (sin merge, sin deploy)

Revisión independiente de `0ce826e` pidió dos cosas; ambas quedaron con prueba dedicada.

**1. Conciliación en proyectos con varias zonas** (`reconciliarNuevasConPrograma`): respeta `requirement_id`, `zone_id`, ancla, grupo funcional y
confirmaciones explícitas; ambigüedad ⇒ NEEDS_REVIEW (la persona decide por zona en Voni), nunca sustitución automática.

| Caso | Resultado |
|---|---|
| Dos salas con mesas distintas, silla de juntas nueva sin `requirement_id` ni zona | **ambigua** → NEEDS_REVIEW, nada se sustituye |
| Misma silla con `zone_id` explícito | sustituye sólo la sala de esa zona |
| Misma silla con decisión explícita (`decisiones[id] = fila`) | sustituye la fila elegida |
| Dos despachos con escritorio del mismo rol, escritorio nuevo sin identidad | ambigua → NEEDS_REVIEW; con un solo despacho sustituye |
| Dos grupos WIN en zonas distintas, WIN nueva sin zona | ambigua; con zona, sólo ese grupo |
| Cantidad parcial (6 WIN nuevas vs 8 del programa) | sustituye 6 y deja 2 del programa (`cantidadAjustadaPorConciliacion`) |
| Capacidad distinta (banca 8 vs módulo 10) | sustituye y avisa `capacidadDistinta` |
| `requirement_id` presente | manda sobre la zona |
| 757: SONATA de la persona vs CONCERTO+SONATA del programa (misma mesa) | mismo kit ⇒ no es ambigüedad; sustituye la SONATA (mismo modelo) |

**2. Golden 757 contra el servidor RC real** (`EDGE_RC_URL`): el navegador manda la petición COMPLETA (JWT real de `qa-direccion`,
apikey, cuerpo) al `acomodar-espacio-recovery` del RC servido con Deno 2.9.7 (mismo `index.ts`: autenticación real contra Supabase +
pipeline). Resultado (16.8 s): 18 → **12** partidas, 1 ancla por rol, WIN 8, ALPHA 1; **25** al solver, **21** colocadas, 0 `fail` en
`layoutSpec.validation.issues`; las 4 no colocadas son las **Silla · SONATA** ×4 con causa `MISSING_ANCHOR` (la mesa 1.20×1.20 de la
persona tiene 4 lugares y la ocupan las 4 CONCERTO confirmadas del programa; acción: agregar mesa/lugar o quitar las de más); banca
APP LT `p-1-1` 6000×1200 colocada; sin "juntass"/"capacidad del catálogo". Persistencia REAL: autosave → `actualizar_cotizacion_segura`
(36 KB con plan) → `cotizacion_segura` devuelve las mismas 12 partidas y 21 colocadas (fila 803, verificado también por SQL:
`n_partidas 12 · n_colocadas 21 · n_unassigned 4`) → se vacía el estado local, se recarga y se reabre desde "Presupuestos anteriores":
mismas partidas, mismo acomodo, misma fila (no se reescribe sola). El mismo golden pasa en modo Node (pipeline del edge sin Deno).

**Hallazgo nuevo del gate: VH-109 (P0).** Antes de esta corrección NINGUNA fila de hoy en la nube traía el plan (27 filas del golden,
todas `plan null`/0 colocadas) aunque el encabezado decía "En línea". Causa y corrección en la matriz. Esto afectaba a producción hoy
(el código del ciclo es anterior a esta rama): el acomodo se perdía al cambiar de computadora o reabrir desde el Archivo.

**Pruebas del gate:** vitest 2,112/2,112 (264 archivos) · `reconciliarPartidas.test.js` 14 · `acomodoEstado.test.js` 4 ·
`planner.stress/floorSpec/planner` 35 · golden757 PASS (Node y edge RC Deno) · Playwright local (nube falsa + QA) **44/44**.

**Rollback:** cliente → redeploy de `c3.4-seller-safe` @ `766df46` en Vercel (sin migraciones que revertir: E3/E4 no se aplican);
edges → `deploy-edge` con el código de `766df46` (vuelven `acomodar-espacio-recovery` v8, `costear-servidor` v8, `leer-plano` v11,
`leer-plano-core` v4). Los datos guardados por el RC son compatibles hacia atrás (campos adicionales en JSON; el cliente viejo los ignora).

**Limitaciones que quedan:** (a) el edge RC se certificó bajo Deno local con JWT real, no en la instancia desplegada (el bundler del
workflow es el mismo); (b) `costear-servidor` v9 sólo probado por su motor compartido en Node; (c) el autosave sigue siendo
"1.5 s de calma": si alguien cierra la pestaña antes, se pierde lo último (comportamiento previo, no cambiado); (d) VH-108 IA
intermitente; (e) E3/E4/E5 siguen BLOQUEADAS (sin firma).

**Limpieza:** las 27 filas de prueba del golden en la cuenta QA (`cliente = 'Torre Sur (golden)'`, ids 766–802, borradores de hoy)
quedaron `activa = false` (reversible); la 803 se conserva como evidencia.

## RECOMENDACIÓN GO / NO-GO

**GO para E1+E2 juntos desde `29522e4`** (cliente y edges a la vez; sustituye al GO condicionado desde `561b741`): los contratos cambiaron en ambos lados a la vez
(`relation_role` inferido y `zone_id` por destino en el payload; `unassigned`/`no_cupieron` y guardas sueltas en el edge;
`asientos` en `leer-plano-core`/`leer-plano`). Desplegar sólo el cliente deja el acomodo mejor que hoy (roles inferidos
llegan al edge v8, que ya los coloca) pero sin guardas sueltas ni visitas; desplegar sólo edges no cambia lo que ve la persona.

**NO-GO para:** aplicar migraciones de datos (E3/E4) y cualquier cambio de precios (E5) sin tu firma; retirar `QA_FIXTURE_*`;
rotar la contraseña de `qa-direccion` (rompe el secreto `TEST_PASSWORD` de CI: tú lo actualizas).

Riesgos residuales: (0) VH-109 corregido en cliente: sin E1 el acomodo sigue sin llegar a la nube; (1) VH-108 proveedor de IA intermitente; (2) topología doble de bancas sólo con perfil de catálogo
declarado; (3) 489 insumos ERP «hoja» sin formato quedan PENDIENTE hasta capturar su hoja; (4) 1,931 partidas siguen sin
costo oficial hasta cargar el reporte Intelisis; (5) las correcciones de edges están probadas en Node con el mismo código,
no en Deno desplegado (el workflow `deploy-edge` las bundlea igual que hoy).
