# BUG_LEDGER — Von Haucke Product OS
Formato contrato §89. Nunca borrar entradas; marcar resolved. Estados: FIXED·VERIFIED / FIXED / OPEN / BLOCKED.
SHA de referencia de los fixes: hasta `198920c` (prod).

---
## FIXED · VERIFIED

**VH-023 · P0 · Camino Cocrear→Cotizar MUERTO** (tanda 2026-10-04b). `<Cocrear>` en App.jsx no recibía
`onAgregar` → el botón "Agregar al proyecto" (`{onAgregar && …}`) nunca se renderizaba y `agregarACotizacion`
abortaba. El especial co-diseñado NUNCA podía entrar a Cotizar. Fix: `onAgregar={agregarDesdeAsistente}`
(App.jsx:983). Evidencia E2E en vivo: especial costeable → registra ProductVersion **v1933** → partida en
Cotizar (contador 6→7, costo real $376), con `producto_version_id` fijado. SHA `56f2dcd`.

**VH-024 · P1 · Gate filtraba códigos CRUDOS al usuario** (tanda 2026-10-04b). `cotizacion_emitible` devolvía
`producto_id_invalido` / `costo_especial_desconocido` y el fallback de `textoRazonEmision` se tragaba el
prefijo "Línea N:". Fix: traducción seller-safe (sin cifras) + fallback conserva la línea. Banner 100% humano
verificado en vivo. +3 tests. SHA `56f2dcd`.

**VH-025 · P1 · Estado económico POR LÍNEA ausente** (item 5, tanda 2026-10-04b). El gate solo se veía en un
bloque de texto abajo; ahora cada partida lleva un chip seller-safe (`Falta confirmar` / `Requiere aprobación`)
en las 3 vistas. 9 tests. Verificado en vivo (7/7 líneas). Nunca muestra costo/margen ni unknown como $0.
SHA `b5f3af6`.

**VH-026 · P2 · Imagen canónica del especial no viajaba a la partida** (tanda 2026-10-04b). Al "Agregar al
proyecto" ahora se sube el render canónico y se fija su URL de Storage en `partida.render` (nunca base64 →
regla Bloque 3). `imagenPartida` ya la usa primero → la MISMA imagen co-diseñada aparece en el renglón, la
propuesta y el PDF. E2E: v1934 con `render=https://…/renders/cocrear/…` cargado y visible en propuesta.
SHA `3e100eb`.

**VH-001 · P1 · Login** — rodrigo.delcastillo no entraba.
Causa: contraseña equivocada (cuenta sana). Fix: reset bcrypt a nueva clave (en chat).
Evidencia: `password_coincide=true`; last_sign_in. Tests: n/a (DB).

**VH-002 · P0 · Plano conteo inflado (178 m²/17-18 puestos/17 archiveros)**
Causa: `programaDelPlano` re-estimaba puestos por geometría ignorando el conteo dibujado.
Fix: `leer-plano` v8 devuelve `puestos` por isla; cliente lo respeta (procedencia 'detectado').
Archivos: leer-plano/index.ts, planoLeido.js, programaDelPlano.js. Tests: programaDelPlano.provenance (10).
Evidencia E2E: "8 puestos contados del plano" con el PDF golden. Commit cf7a57c.

**VH-003 · P0 · "Archiveros = 9"** — gavetas+archiveros sumados y mal etiquetados.
Root cause (no síntoma): estado único `guardas`. Fix: campos separados gavetas/archiveros.
Archivos: ProgramaProyecto.jsx, programa.test.js. Evidencia E2E: Gavetas 8 · Archiveros 1. Commit 70a2641.

**VH-004 · P0 · Dos precios misma pieza ($1,433 vs $1,229)** en Costear a mano.
Root cause: HojaCosto usaba `par.margenObjetivo` e ignoraba el slider `margen`. Fix: pasa el margen efectivo.
Archivo: Costeador.jsx. Evidencia: 3 precios coinciden. Commit 66de2e9.

**VH-009 · P1 · Dibujar: texto/cuartos negro-sobre-negro** (tema claro hardcodeado en canvas oscuro).
Fix: texto claro + halo, rejilla translúcida, bordes rojos. Archivo: DibujarPlano.jsx. Evidencia: screenshot. Commit d970100.

**VH-010 · P1 · Texto claro sobre fondo claro (varias pantallas)** — barra Dibujar, **panel Voni (#fff)**, Reglas, fila bajo-mínimo, 5 clases CSS.
Fix: clase `.nota-clara` + color oscuro. Archivos: estilos.css, DibujarPlano, Voni2, Reglas, Cotizacion. Evidencia: screenshot barra crema legible. Commit f1fb4d3.

**VH-012 · P1 · Seguridad: `anon` podía EXECUTE RPCs de aprobación** (solicitar_aprobacion_snapshot escribe).
Causa: EXECUTE heredado vía PUBLIC. Fix: REVOKE de PUBLIC + GRANT authenticated/service_role.
Evidencia SQL: anon_exec=false. Migración: revoke_public_execute_aprobacion_rpcs.

**VH-013 · P0 · `analizar-mueble` fail-open SILENCIOSO a catálogo legacy** (#8 del review/§31/§76).
Fix: `console.error` + campo `catalogoFuente` ('canonico'|'cliente-fallback') + aviso ámbar en UI.
Archivos: analizar-mueble/index.ts (v23 ACTIVE), AsistenteEspecial.jsx. Smoke: 401 (carga OK). Commit 198920c.

**VH-014 · P0(feature) · Compuerta dura: render/propuesta oficial con layout roto** (#8/#16/#54).
Fix: `floorSpec.estadoLayout` cablea bloqueo de vistaRealista/renderOficina si hay sin-colocar/encimadas/fuera; 2D/3D editable sigue libre.
Archivo: Acomodo.jsx. Tests: floorSpec.test.js. Commit 896dc6f.

---
## FIXED (sin verificación visual E2E independiente aún)

**VH-005 · P1** VE botón muerto → panel útil (ProyectoWorkspace.jsx). Commit 1cb615b.
**VH-006 · P1** Autosave bóveda Dirección tragaba error → refleja sin-conexión (App.jsx). Commit 1cb615b.
**VH-007 · P2** leerPlanoDeArchivo tragaba error → log + mensaje útil. Commit 1cb615b.
**VH-008 · P2** AsistenteEspecial catch vacío del re-costeo → warn. Commit 1cb615b.
**VH-011 · P2** Desperdicio etiqueta "hoja"→"m²" (matemática ya correcta). Commit 8ac11c2.

---
## OPEN (P0/P1 — pendientes, confirmados con evidencia)

**VH-015 · P0 · Acomodo coloca por "cabe" no por "pertenece"** (#7/§53). Mesa de juntas en CEO, recepción en operativa.
→ **FIXED · VERIFIED** (commit f73e5e3). Validador determinista `floorSpec.violacionesSemanticas` + compuerta dura
(1c5abc9) MÁS el MOTOR corregido: `planner.js` ahora consulta el MISMO validador (`zonaAceptaPieza` =
`zonaPermite(rolDePiezaAcomodo, zonaSemantica)`) como filtro DURO en la 1ª pasada (`candidatos.find`) y la 2ª
(`permite`). Antes la 1ª pasada era preferencia blanda y caía a "donde quepa" (recepción→operativa). Ahora un rol
duro que no cabe en zona permitida SOBRA (honesto), no aterriza mal. Además `rolDePiezaAcomodo` dejó de marcar
'mesa' genérica como TABLE (evita falso positivo de mesa de lounge, §3-G). 9 tests (6 validador + 3 motor↔validador:
sin consejo→sobra, sin recepción→sobra, plano completo→0 violaciones con mesa en juntas y recep en recep). 820 verdes.

**VH-016 · P0 · Acomodo deja piezas sin colocar (48→23)** (#6/§52). Invariante requested=placed+unplaced+excluded.
Estado: contador en vivo consistente + "revisión vencida"; pero el MOTOR aún no coloca todo. Falta mejora de placement.

**VH-017 · P0 · `costoUnitario = 0` persistido = "gratis" vs "desconocido"** (#10/§25). Cot.58: 7/12 líneas, $152,062.
→ **FIXED (cliente)**: `precioUsable()` en `calculo.js` distingue ZERO declarado (§7) de UNKNOWN (ausente). Un insumo
presente-sin-precio entra a `componentesIgnorados` → `costeoEmitible` incompleto → `costoTotal=null` → emisión
bloqueada (misma infra que material faltante). UI por-renglón muestra "Pendiente", no $0. 4 tests (824 verdes), prod.
→ **Paridad edge HECHA**: `costear-servidor` importa el MISMO `calculo.js`; redeployado (CLI, bundlea calculo.js con `precioUsable`) → un insumo sin precio deja `componentesIgnorados` → `estado=incompleto` → sin precio. Smoke 401 (vivo, fail-closed). Cliente+edge con el mismo fail-closed.

**VH-018 · P1 · Descuento a PÉRDIDA** (#11/§36). Gate exige aprobación solo >40% (política plana); rentabilidad puede ser 13%.
Trigger verificado (41/60% → requiere aprobación). Falta: gate de pérdida (margen<mínimo), no solo política.

**VH-019 · P1 · Margen disperso** (#12/§97). Canónico=`margenObjetivo` (motor 50), servidor autoritativo; semilla cliente 30 y fallbacks 40/50.
Falta: una sola regla; quitar `??40` muerto del servidor; cliente lee el parámetro.

**VH-020 · P2 · Pluralización** ("1 oficinas/1 sillas") en frase. Falta: capa de presentación (NO tocar contrato IA, §114).

**VH-021 · P2 · PROD footer "v1.0.0 · desconocido"** (build CLI no inyecta git SHA).

---
**VH-022 · P0 · Seller economics leak en `cotizaciones` (DB)** (§35). MEDIDO 2026-10-04:
RLS `cotizaciones_lee` deja al dueño leer su fila RAW (`usuario = jwt.email OR puede_editar_config()`).
El write-path YA despoja economía para vendedores (`partidaDeCosteo`: `costo=null` si `!veCostos`), PERO
hay **5 cotizaciones de vendedor con 17 partidas con `costoUnitario`≠0 y 5 con `margen`** (legacy/previas al
strip). Un vendedor que lea su fila ve esa economía. ESTADO: **OPEN**. Remediación correcta SIN mutar datos
(restricción dura "no alterar históricos"): RPC `security definer` seller-safe que devuelva partidas sin
economía + restringir SELECT base de `cotizaciones`/`cotizaciones_revisiones` a Dirección + recablear la
lectura del cliente del vendedor a la RPC. Es un refactor en tabla viva → bloque propio con smoke/rollback
(no se hace a medias). NO limpiar los 5 rows (dato histórico).

## NO-ES-BUG (investigado, descartado)
- "FIRME/CALIBRADO" NO es "producto confirmado": es confianza de PRECIO, interna, no se imprime (confianza.js). Correcto.
- 403 de `catalogo_vigente`/`reglas_comerciales_vigentes` desde cliente: son **server-only por diseño** (service_role). No tocar.
- **`crm.js:59 aprobaciones.select('*')` — FLAG CERRADO 2026-10-04b.** Columnas de `aprobaciones`: id, cotizacion_id,
  revision_hash, estado, `descuento_solicitado`, motivo, solicitado_por, resuelto_por, creado, resuelto_en,
  reglas_version. **NO hay costo/margen/profit/precio_proveedor.** `descuento_solicitado` es el % que el PROPIO
  vendedor pidió (no es economía que no deba ver). Lo consumen ProyectoWorkspace y Voni (`proveedorReal.get_approvals`);
  ambos seller-safe. No es fuga.
- **Auditoría seller-safe de lecturas RAW (2026-10-04b):** TODAS las lecturas de `cotizaciones`/`cotizaciones_revisiones`
  alcanzables por vendedor van por RPC seguro (`cotizaciones_mias`, `cotizacion_segura`, `cotizacion_revisiones_seguras`,
  `revisiones_seguras`) o seleccionan SOLO metadata sin economía (`crm.js` folio/cliente/estado/total/acomodo;
  `revisiones.js:102` fallback folio = id/revision/emitida_en/usuario/total/folio/cliente). `voniContext` gatea
  costo/margen por rol (`ve_costo`/`ve_margen` solo Dirección). Las lecturas RAW de `expedientes` (nube.js) son del
  AsistenteEspecial legacy (herramienta de Diseño/Dirección), NO del camino Cocrear ni del vendedor. El corte final de
  RLS base de `cotizaciones` sigue siendo de ChatGPT (VH-022 OPEN) — el wiring seguro ya está demostrado.
