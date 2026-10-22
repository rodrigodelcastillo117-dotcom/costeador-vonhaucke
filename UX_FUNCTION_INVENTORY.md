# UX_FUNCTION_INVENTORY — Von Haucke

**FASE 0 del pase "Simple afuera, riguroso adentro".** Este documento es el catálogo EXHAUSTIVO de todo lo que un usuario puede ver o tocar hoy en la app, para que cualquier rediseño futuro pueda demostrar, función por función, que **NO SE PERDIÓ NADA**. Es un inventario de solo lectura: **no se cambió ni una línea de código ni de UI para producirlo.**

- **Rama:** `claude/costing-app-architecture-psf02g`
- **HEAD auditado:** `00c32d8`
- **Fecha:** 2026-10-22
- **Método:** 4 exploradores en paralelo (solo lectura) sobre `src/App.jsx` (1,556 líneas) y ~60 componentes. Navegación por estado (`pestania`), no por router de archivos.
- **Alcance:** cada entrada = una función/botón/CTA/menú/input/acción/estado de cara al usuario, con: dónde vive · quién la usa (rol) · qué hace · lugar UX propuesto · visible/secundario/técnico · id de test de paridad.

## Resumen cuantitativo

| Clúster | Entradas de UI catalogadas |
|---|---|
| 1. Navegación, Home y Roles | 116 |
| 2. COSTEAR + ERP/Precios/Catálogo | 98 |
| 3. COTIZAR + Acomodo/Planos/PDF | 128 |
| 4. COCREAR + VONI + Admin/Infra | 129 |
| **TOTAL** | **471** |

Por prominencia propuesta: **279 visibles · 134 secundarias (menú "Más opciones"/"Ver ingeniería") · 58 técnicas ("Ver detalles técnicos")**. Nota honesta: las 471 son *entradas de UI*, no capacidades únicas — varias son puntos de entrada distintos a la misma función (p. ej. una línea de catálogo se alcanza desde Home, buscador, Banco y Catálogo). Eso es deliberado: la paridad tiene que cubrir cada entrada, no solo el destino.

**10 celdas quedaron como `POR DEFINIR`** (todas en el panel legacy `home/cotizar` de `Inicio.jsx`): es la vista de tarjetas vieja que compite con el Home nuevo. Es la primera candidata a consolidarse en el rediseño **sin perder sus destinos** (cada tarjeta ya tiene su test de paridad).

## Roles (de `src/datos/roles.js`)

3 roles canónicos; `normalizarRol()` manda todo lo desconocido a **vendedor** (mínimo privilegio):
- **direccion** — lo ve todo: economía de cotizaciones, costos/BOM, y por su correo: tablero, usuarios, carga/firma ERP, nómina, financieros.
- **diseno** — ve costos/BOM y edita config/reglas; NO ve economía de cotizaciones, nómina, financieros ni tablero.
- **vendedor** — seller-safe: sólo precio recomendado; nunca costo, margen ni economía. Es el fallback de todo rol no reconocido.

## Hallazgos que condicionan el rediseño

1. **Cocrear activo = `CocrearV3`** (por import directo en `Cocrear.jsx`, sin flag). `CocrearV2` es legacy sólo en tests. No tocar V2; el rediseño va sobre V3.
2. **Toda la economía es server-side y seller-safe** (precio del servidor, gate de emisión en el servidor): el rediseño NO puede mover esa lógica, sólo su presentación.
3. **Estados internos mostrados crudos** (la materia prima del mapa "lenguaje humano") están listados al final de la Sección 3: `PRELIMINAR`, `ECONOMICS_INCOMPLETE`, `layoutEstado` (STALE_PROGRAM/PROGRAM_INCOMPLETE/LAYOUT_VALID), gate (ALLOWED/BLOCKED/APPROVAL_REQUIRED), códigos de diagnóstico de acomodo, procedencia (CONFIRMADO/INFERIDO/SUPUESTO), RenderChip, etc. **El estado interno no cambia; sólo su texto.**
4. **Gates y confirmaciones destructivas ya existen y son fail-closed** (sin precio → no agrega; descuento bajo piso → aprobación de Dirección; "empezar de cero" con una confirmación). El rediseño los conserva tal cual.

## Qué sigue (checkpoint)

Esto es sólo FASE 0. **Antes de tocar UI, E2E con IA o screenshots** (las fases que cuestan créditos de IA), se decide con Dirección el alcance del rediseño sobre este inventario. La matriz de paridad 1:1 (`UX_FUNCTION_PARITY.md`) se deriva de estos 471 ids `uxParity-*`.

---

## 1. Navegación, Home y Roles

### Roles (de `src/datos/roles.js`, espejo del servidor)

Hay **3 roles canónicos** que emite el servidor en `permitidos.rol`; `normalizarRol()` reduce cualquier grafía a uno de ellos y manda todo lo desconocido (`ventas`, `cfo`, `costeador`, `admin`, `''`, `null`) a **vendedor** (mínimo privilegio).

- **direccion** — lo ve TODO: economía de cotizaciones/revisiones (`veEconomiaCotizacion` → sólo dirección), costos de insumos/despiece (`veCostosCosteo`), y además lo exclusivo resuelto por su correo: tablero del negocio, usuarios, carga ERP, nómina y estados financieros (bóveda `direccion`).
- **diseno** — ve costos de insumos y despiece (`veCostosCosteo` = `['direccion','diseno']`, también `editaConfig`), puede costear y editar config/reglas; **NO** ve economía de cotizaciones, nómina, financieros ni tablero.
- **vendedor** — mínimo privilegio (`esVendedor`): sólo precio recomendado; nunca costo de fabricación, margen ni economía. Es el fallback de todo rol no reconocido.

Funciones de rol expuestas: `normalizarRol(rol)`, `veEconomiaCotizacion(rol)`, `veCostosCosteo(rol)`/`editaConfig`, `esVendedor(rol)`. En `App.jsx` se derivan `esDireccion`, `esDiseno`, `esVendedor`, `veCostos = esDireccion||esDiseno`, `desbloqueado = esDireccion`. El acceso real a la app lo da la tabla `permitidos` vía `miPermiso(email)` (`src/nube.js`), no la pantalla; `permiso` puede ser `undefined` (revisando), `null` (sin acceso), `'error'` (no se pudo consultar) u `{rol,nombre}`.

### Tabla de funciones

| función actual | dónde vive (componente:línea aprox) | quién la usa (rol) | qué hace (1 frase) | nuevo lugar UX propuesto | visible/secundario/técnico | test de paridad propuesto (nombre) |
|---|---|---|---|---|---|---|
| **PUERTA DE ACCESO Y CHROME** | | | | | | |
| Pantalla "Un momento…" | App.jsx:1243 | todos | Estado de espera mientras se resuelve sesión/permiso (timeout 8 s). | (igual, global) | técnico | `uxParity-gate-cargando` |
| Login (sin sesión) | App.jsx:1246 → Login.jsx | todos (anónimo) | Muestra la puerta de entrada cuando no hay sesión. | (igual) | visible | `uxParity-gate-login` |
| Pantalla "No se pudo verificar tu acceso" (Reintentar / Salir) | App.jsx:1249-1262 | todos con sesión | Falla de consulta de permiso (red/RLS): distinta de "sin acceso". | (igual) | técnico | `uxParity-gate-permiso-error` |
| Pantalla "Todavía no tienes acceso" (Salir) | App.jsx:1264-1273 | correo no autorizado | Dice que el correo no está en `permitidos` y que pida alta a Dirección. | (igual) | visible | `uxParity-gate-sin-acceso` |
| Banner "LINK DE PRUEBA (RC)" | App.jsx:1278-1282 | todos (si `CARRIL_RC`) | Avisa que el motor va en carril de prueba y lo guardado cae en base real. | banner global condicional | técnico | `uxParity-banner-rc` |
| Logo/marca del header (ir al inicio) | App.jsx:1285-1287 | todos | Clic en el logo regresa a Inicio desde cualquier pantalla. | header › logo | visible | `uxParity-header-logo-inicio` |
| Carrito global "Mi cotización" + contador | App.jsx:1290-1294 | todos (si nPartidas>0 y no en cotización) | Salta a la cotización desde cualquier pantalla con el nº de renglones. | header › carrito persistente | visible | `uxParity-header-carrito` |
| Indicador de conexión a la nube (punto + texto) | App.jsx:1295-1298 | todos | Muestra En línea / Sin conexión / No guardada / Guardando… (`data-testid=nube-estado`). | header › estado de guardado | secundario | `uxParity-header-nube-estado` |
| Menú "Cuenta" (dropdown `details`) | App.jsx:1301-1312 | todos | Agrupa lo que no es trabajo (correo, Guía, Usuarios, Contraseña). | header › menú Cuenta | secundario | `uxParity-menu-cuenta-abrir` |
| Menú Cuenta › correo del usuario | App.jsx:1307 | todos | Muestra el correo con que entró. | menú Cuenta › encabezado | técnico | `uxParity-menu-cuenta-correo` |
| Menú Cuenta › "Guía" | App.jsx:1308 | todos | Abre/cierra el manual completo (modal Guía). | menú Cuenta › Guía | secundario | `uxParity-menu-cuenta-guia` |
| Menú Cuenta › "Usuarios" | App.jsx:1309 | **sólo Dirección** | Entra a la pantalla de usuarios y accesos. | menú Cuenta › Usuarios (sólo Dir.) | secundario | `uxParity-menu-cuenta-usuarios` |
| Menú Cuenta › "Contraseña" | App.jsx:1310 | todos | Va a cambiar la propia contraseña (no en modo recuperación). | menú Cuenta › Contraseña | secundario | `uxParity-menu-cuenta-contrasena` |
| Botón "Salir" (header) | App.jsx:1313 | todos | Cierra sesión, borra borrador técnico y datos sensibles de este equipo. | header › Salir | visible | `uxParity-header-salir` |
| Barra "‹ Atrás" | App.jsx:1338 | todos (no en inicio) | Vuelve a la pantalla anterior usando el historial `nav`. | barra contextual superior | visible | `uxParity-barra-atras` |
| Botón "Inicio" secundario (barra) | App.jsx:1339 | todos (no en inicio) | Limpia historial y regresa al Inicio. | barra contextual › Inicio | visible | `uxParity-barra-inicio` |
| Título de vista (NOMBRE_VISTA) | App.jsx:1340 | todos | Rotula la pantalla actual en la barra de atrás. | barra contextual › título | técnico | `uxParity-barra-titulo` |
| Modal Guía (onboarding / manual) | App.jsx:1345-1348 → Guia.jsx | todos (filtrado por rol) | Manual completo con secciones, buscador y demos; se abre la 1ª vez. | POR DEFINIR (overlay Ayuda) | secundario | `uxParity-guia-abrir` |
| Toast "¡Listo!" / avisos | App.jsx:1511 | todos | Mensaje efímero de estado (éxito, nube caída, recuperación). | toast global | secundario | `uxParity-toast-aviso` |
| Botón flotante "Voni" (FAB) | App.jsx:1515-1527 | todos (flag `voni_2`, salvo en contraseña) | Lanza el asistente transversal desde cualquier ruta, con el rol real. | FAB global | visible | `uxParity-voni-fab-abrir` |
| Panel Voni2 (abierto por FAB) | App.jsx:1528-1550 → Voni2.jsx | todos (economía sólo si veCostos) | Asistente que lee el trabajo vivo seller-safe (sin costo/margen al vendedor). | overlay Voni | visible | `uxParity-voni2-panel` |
| Aviso ConflictoGuardado (Ver servidor / Reaplicar) | App.jsx:1321 → ConflictoGuardado.jsx | todos (control optimista) | Otra persona guardó antes: pausa autosave y pide decidir. | overlay de conflicto | técnico | `uxParity-conflicto-guardado` |
| Aviso RespaldoConflicto (Recuperar / Descartar) | App.jsx:1323-1324 → RespaldoConflicto.jsx | todos (control optimista) | Mantiene vivas las dos versiones hasta que la persona elige. | overlay de respaldo | técnico | `uxParity-respaldo-conflicto` |
| Skeleton de carga (Suspense) | App.jsx:1327-1333 | todos | Placeholder mientras cargan vistas diferidas (Tablero, Cocrear…). | loader global | técnico | `uxParity-suspense-skeleton` |
| Error boundary "Esta pantalla se atoró" | App.jsx:1326 → SinPantallaBlanca.jsx | todos | Atrapa un crash de render: Volver/Reintentar/Copiar detalle/Ver técnico. | pantalla de error recuperable | técnico | `uxParity-boundary-error` |
| **PESTAÑAS (estado `pestania`; etiquetas en NOMBRE_VISTA)** | | | | | | |
| `inicio` (Home) | App.jsx:1349 → Inicio.jsx | todos | Pantalla de entrada "¿Qué vas a hacer?". | Home | visible | `uxParity-tab-inicio` |
| `voni` "Voni · asistente de proyecto" | App.jsx:1486 | todos (economía sólo veCostos) | Asistente que arma propuesta/acomodo/PDF desde texto o plano. | Home › Cotizar | visible | `uxParity-tab-voni` |
| `cocrear` "Cocrear · de la idea al producto" | App.jsx:1355-1371 | todos (puente a Costear sólo veCostos) | Estudio de co-diseño; onPasarACostear sólo si ve costos. | Home › Cocrear | visible | `uxParity-tab-cocrear` |
| `asistente` "Cotizar un mueble" | App.jsx:1352 | todos (soloVentas si vendedor) | Cotiza un mueble especial a la medida (camino sin costos). | Home › Cotizar › especial | visible | `uxParity-tab-asistente` |
| `cotizacion` "Mis cotizaciones" | App.jsx:1480 → Cotizacion.jsx | todos (seller-safe; economía veCostos) | Ve/edita renglones, descuentos, emite PDF y pide aprobación. | Proyecto en curso | visible | `uxParity-tab-cotizacion` |
| `cotizarIA` (sin etiqueta en NOMBRE_VISTA) | App.jsx:1481 → CotizadorIA.jsx | todos (soloVentas si vendedor) | Describe varios muebles y la IA los agrega de un jalón. | Home › Cotizar varios con IA | visible | `uxParity-tab-cotizarIA` |
| `acomodo` (sin etiqueta en NOMBRE_VISTA) | App.jsx:1497 → Acomodo.jsx | todos | Dibuja el espacio y acomoda/verifica que los muebles caben. | Proyecto › Acomodo | visible | `uxParity-tab-acomodo` |
| `banco` "Banco de precios" | App.jsx:1372 → Banco.jsx | todos | Agrega productos ya cotizados con su precio real cerrado. | Home › Más herramientas › Banco | visible | `uxParity-tab-banco` |
| `archivo` "Presupuestos que ya hicimos" | App.jsx:1373-1430 → Archivo.jsx | todos (aprobar sólo Dirección; economía veCostos) | Busca, reabre y restaura cotizaciones de todos los aparatos. | Home › Presupuestos anteriores | visible | `uxParity-tab-archivo` |
| `catalogo` "Catálogo" | App.jsx:1479 → Catalogo.jsx | todos (soloVentas si vendedor; entrada soloCostos en Home) | Carga una receta del catálogo en el costeador. | Costear › Otra línea de catálogo | secundario | `uxParity-tab-catalogo` |
| Costeadores de línea (24): `applt, app, eclipse, pebble, privacy4, rio, teamspace2, tetris, arlequin, pac, via, drift, flex, mox, modulor, luna, accents, ergo4, spine, anteo, alba, feather, worklounge, cirque` | App.jsx:1431-1454 → CosteadorLinea.jsx | todos (soloVentas si vendedor; `applt` además add-ons) | Configura un producto de esa línea y lo agrega al proyecto. | Costear/Cotizar de línea › línea | visible | `uxParity-tab-linea-<ruta>` |
| `especial` "Costear desde cero" | App.jsx:1455-1460 → AsistenteEspecial.jsx | **Diseño + Dirección** (veCostos); vendedor ve "es para Diseño y Dirección" | Sube PDF/plano/render y propone despiece; el motor calcula costo. | Home › Costear | visible | `uxParity-tab-especial-gate` |
| `biblioteca` (sin etiqueta) | App.jsx:1461-1464 → Biblioteca.jsx | **Diseño + Dirección** (veCostos); vendedor bloqueado | Biblioteca de productos costeados; abre expedientes en especial. | Costear › Biblioteca | secundario | `uxParity-tab-biblioteca-gate` |
| `costeador` "Modo avanzado" | App.jsx:1469-1478 → Costeador.jsx | **Diseño + Dirección** (veCostos); vendedor ve aviso | Despiece libre a mano; `puedeVerComercial` sólo Dirección. | Costear › Despiece libre | visible | `uxParity-tab-costeador-gate` |
| `precios` "Precios" | App.jsx:1498-1501 → Precios.jsx | **Diseño + Dirección** (veCostos); vendedor bloqueado | Ve/actualiza el costo de cada material. | Costear › Precios de materiales | visible | `uxParity-tab-precios-gate` |
| `reglas` "Lo que Voni sabe" | App.jsx:1506 → Reglas.jsx | lectura todos; **editar sólo veCostos** (`puedeEditar`) | Reglas de oficio (circulación, sillas de visita, margen mínimo). | Home › Lo que Voni sabe | visible | `uxParity-tab-reglas-gate` |
| `comercial` "Comercial · proyectos y propuestas" | App.jsx:1482-1485 → Comercial.jsx | todos (flag `commercial_v2`; si off, aviso); economía veCostos | Superficie comercial (pipeline/proyectos/propuestas). | Home › Comercial · Proyectos | visible | `uxParity-tab-comercial-flag` |
| `tablero` "El negocio" | App.jsx:1465-1468 → Tablero.jsx | **sólo Dirección** (esDireccion); otros ven aviso | Tablero del negocio: márgenes, desperdicio, salud. | Home › Dirección | visible | `uxParity-tab-tablero-gate` |
| `usuarios` "Quién puede entrar" | App.jsx:1502 → Usuarios.jsx | **sólo Dirección** | Alta/baja de personas y su rol. | menú Cuenta/Home › Usuarios | visible | `uxParity-tab-usuarios-gate` |
| `carga-erp` (sin etiqueta) | App.jsx:1503 → CargaERP.jsx | **sólo Dirección** | Carga precios de compras del ERP con documento. | Home › Cargar compras del ERP | secundario | `uxParity-tab-cargaerp-gate` |
| `contrasena` (sin etiqueta) | App.jsx:1496 → CambiarContrasena.jsx | todos | Cambia la propia contraseña (normal o por recuperación). | menú Cuenta › Contraseña | secundario | `uxParity-tab-contrasena` |
| **HOME · vista `home` (Inicio.jsx)** | | | | | | |
| Marca "VH LAB" + título "¿Qué vas a hacer?" + subtítulo | Inicio.jsx:197-201 | todos | Encabezado editorial del Home. | Home › encabezado | técnico | `uxParity-home-encabezado` |
| "Proyecto en curso" (retomar) | Inicio.jsx:205-214 | todos (si nPartidas>0) | Retoma la cotización viva (cliente, piezas, total o precios faltantes). | Home › Proyecto en curso | visible | `uxParity-home-retomar` |
| "Empezar de cero" (descartar proyecto) | Inicio.jsx:215-220 → App.descartarProyecto:238 | todos (si nPartidas>0) | Borra la cotización completa (partidas+acomodo) con UNA confirmación. | Home › Proyecto › Empezar de cero | visible | `uxParity-home-empezar-cero` |
| Camino 01 "Cotizar" | Inicio.jsx:225-234 | todos | Abre Voni para preparar propuesta al cliente. | Home › tarjeta Cotizar | visible | `uxParity-home-cotizar` |
| Camino 02 "Costear" | Inicio.jsx:236-247 | **veCostos** (oculto a vendedor) | Abre especial para costear un producto nuevo. | Home › tarjeta Costear | visible | `uxParity-home-costear` |
| Camino "Cocrear" | Inicio.jsx:249-258 | todos | Abre el estudio de co-diseño. | Home › tarjeta Cocrear | visible | `uxParity-home-cocrear` |
| Atajo "Proyecto actual" | Inicio.jsx:267 | todos (si nPartidas>0) | Ver/imprimir/descargar la cotización. | Home › Más herramientas | secundario | `uxParity-home-proyecto-actual` |
| Atajo "Acomodo" | Inicio.jsx:268 | todos (si nPartidas>0) | Abre el plano y distribución. | Home › Más herramientas › Acomodo | secundario | `uxParity-home-acomodo` |
| Atajo "Cotizar de línea" | Inicio.jsx:269 | todos | Abre la vista de líneas en modo cotizar. | Home › Más herramientas | secundario | `uxParity-home-cotizar-linea` |
| Atajo "Cotizar varios con IA" | Inicio.jsx:270 | todos | Abre CotizadorIA. | Home › Más herramientas | secundario | `uxParity-home-cotizar-ia` |
| Atajo "Costeo manual" | Inicio.jsx:271 | **veCostos** | Abre el costeador de despiece a mano. | Home › Más herramientas (veCostos) | secundario | `uxParity-home-costeo-manual` |
| Atajo "Banco de precios" | Inicio.jsx:272 | todos | Abre el banco de lo ya vendido. | Home › Más herramientas | secundario | `uxParity-home-banco` |
| Atajo "Presupuestos anteriores" | Inicio.jsx:273 | todos | Busca y reabre presupuestos. | Home › Más herramientas | secundario | `uxParity-home-archivo` |
| Atajo "Comercial · Proyectos" | Inicio.jsx:274 | todos (flag `commercial_v2`) | Abre pipeline y propuestas. | Home › Más herramientas (flag) | secundario | `uxParity-home-comercial` |
| Atajo "Lo que Voni sabe" | Inicio.jsx:275 | todos | Abre las reglas de oficio. | Home › Más herramientas | secundario | `uxParity-home-reglas` |
| Atajo "Dirección" | Inicio.jsx:276 | **sólo Dirección** | Abre el tablero del negocio. | Home › Más herramientas (Dir.) | secundario | `uxParity-home-direccion` |
| Atajo "Usuarios y accesos" | Inicio.jsx:277 | **sólo Dirección** | Abre permisos de usuarios. | Home › Más herramientas (Dir.) | secundario | `uxParity-home-usuarios` |
| Atajo "Cargar compras del ERP" | Inicio.jsx:278 | **sólo Dirección** | Abre la carga ERP de precios. | Home › Más herramientas (Dir.) | secundario | `uxParity-home-carga-erp` |
| "Tus líneas más usadas" (favoritas) | Inicio.jsx:282-294 | todos | Chips de las 5 líneas más abiertas (aprendido local, no se comparte). | Home › favoritas | secundario | `uxParity-home-favoritas` |
| **HOME · vista `cotizar` (panel legacy)** | | | | | | |
| BarraVolver "Cotizar" | Inicio.jsx:303 | todos | Regresa al home desde el panel Cotizar. | POR DEFINIR (legacy) | técnico | `uxParity-cotizar-volver` |
| Card "Comercial · Proyectos" | Inicio.jsx:305 | todos (flag) | Entra a la superficie comercial. | POR DEFINIR | secundario | `uxParity-cotizar-comercial` |
| Card "Cotizar con IA" | Inicio.jsx:306 | todos | Entra a CotizadorIA. | POR DEFINIR | secundario | `uxParity-cotizar-ia` |
| Card "Cotizar de línea" | Inicio.jsx:307-309 | todos (icono cambia por veCostos) | Abre la vista de líneas. | POR DEFINIR | secundario | `uxParity-cotizar-linea` |
| Card "Banco de precios" | Inicio.jsx:310 | todos | Abre el banco. | POR DEFINIR | secundario | `uxParity-cotizar-banco` |
| Card "Presupuestos que ya hicimos" | Inicio.jsx:311 | todos | Abre el archivo. | POR DEFINIR | secundario | `uxParity-cotizar-archivo` |
| Card "Cotizar especial (a la medida)" | Inicio.jsx:312 | todos (ruta costeador si veCostos, si no asistente) | Costea/cotiza un especial según rol. | POR DEFINIR | secundario | `uxParity-cotizar-especial` |
| Card "Mis cotizaciones" | Inicio.jsx:313 | todos | Abre la cotización actual. | POR DEFINIR | secundario | `uxParity-cotizar-mis` |
| Card "Acomodo en el espacio (IA)" | Inicio.jsx:314 | todos | Abre el acomodo. | POR DEFINIR | secundario | `uxParity-cotizar-acomodo` |
| **HOME · vista `costear` / `cotizarlinea`** | | | | | | |
| BarraVolver (título según modo) | Inicio.jsx:323-329 | todos | Regresa al home desde Costear/Cotizar de línea. | Costear › volver | técnico | `uxParity-costear-volver` |
| Buscador de producto (input `q`) + limpiar "×" | Inicio.jsx:332-337 | todos | Busca entre 156 productos (líneas + sillería del banco). | Costear › buscador | visible | `uxParity-costear-buscador` |
| Atajo IA "¿Son varios muebles?" | Inicio.jsx:339-347 | todos (sólo en cotizarlinea) | Manda a CotizadorIA para meter varios de un jalón. | Cotizar de línea › atajo IA | secundario | `uxParity-costear-atajo-ia` |
| Card "Costear con IA" | Inicio.jsx:351 | veCostos (modoCostear) | Sube foto/render y la IA arma el despiece. | Costear › Costear con IA | visible | `uxParity-costear-ia` |
| Card "Costear a mano (despiece completo)" | Inicio.jsx:352 | veCostos (modoCostear) | Abre el costeador manual. | Costear › Costear a mano | visible | `uxParity-costear-mano` |
| Resultados hallados (producto/artículo/banco) | Inicio.jsx:357-373 | todos | Agrega artículo con precio real, o abre línea/banco con producto ya elegido. | Costear › resultados | visible | `uxParity-costear-hallados` |
| Empty state "Nada encontrado" | Inicio.jsx:375-376 | todos | Dice que no hubo resultados. | Costear › vacío | técnico | `uxParity-costear-vacio` |
| Tarjetas de líneas filtradas (con imagen) | Inicio.jsx:378-383 | todos | Abre la línea buscada. | Costear › líneas | visible | `uxParity-costear-lineas-filtro` |
| Acordeón por familia + grupo "Herramientas" | Inicio.jsx:385-405 | todos (herramientas soloCostos filtradas) | Expande familias de líneas y herramientas de costos. | Costear › acordeón | visible | `uxParity-costear-acordeon` |
| Herramienta "Otra línea de catálogo" | Inicio.jsx:56 | **veCostos** (soloCostos) | Abre `catalogo`. | Costear › Herramientas | secundario | `uxParity-herr-catalogo` |
| Herramienta "Despiece libre (avanzado)" | Inicio.jsx:57 | **veCostos** (soloCostos) | Abre `costeador`. | Costear › Herramientas | secundario | `uxParity-herr-costeador` |
| Herramienta "Precios de materiales" | Inicio.jsx:58 | **veCostos** (soloCostos) | Abre `precios`. | Costear › Herramientas | secundario | `uxParity-herr-precios` |
| Herramienta "Lo que Voni sabe" | Inicio.jsx:61 | todos | Abre `reglas`. | Costear › Herramientas | secundario | `uxParity-herr-reglas` |
| **LOGIN (Login.jsx)** | | | | | | |
| Carrusel de portadas + "Cocreando tu espacio" | Login.jsx:60-69 | anónimo | Fondo editorial con acercamiento lento (sin video). | Login › arte | técnico | `uxParity-login-portadas` |
| Aviso de enlace de correo (otp_expired) | Login.jsx:79 | anónimo | Explica por qué el enlace de recuperación no sirvió. | Login › alerta enlace | secundario | `uxParity-login-aviso-enlace` |
| Input Correo | Login.jsx:82-85 | anónimo | Captura el correo. | Login › correo | visible | `uxParity-login-correo` |
| Input Contraseña + "Ver contraseña" | Login.jsx:87-93 | anónimo | Captura la clave, con mostrar/ocultar. | Login › contraseña | visible | `uxParity-login-pass` |
| Error de credenciales | Login.jsx:95 | anónimo | Avisa correo/contraseña incorrectos. | Login › error | técnico | `uxParity-login-error` |
| Botón "Entrar" | Login.jsx:98-100 | anónimo | Inicia sesión (`entrar`). | Login › Entrar | visible | `uxParity-login-entrar` |
| "¿Olvidaste tu contraseña?" | Login.jsx:118 | anónimo | Abre el flujo de recuperación. | Login › recuperar | secundario | `uxParity-login-olvide` |
| Recuperar: "Mandarme el enlace" / "Cancelar" | Login.jsx:108-116 | anónimo | Envía el correo de recuperación. | Login › recuperar acciones | secundario | `uxParity-login-recuperar` |
| Confirmación "Te mandamos un correo" | Login.jsx:103-106 | anónimo | Confirma envío del enlace. | Login › confirmación | secundario | `uxParity-login-enviado` |
| Pie "¿No puedes entrar?" | Login.jsx:121 | anónimo | Dice que pida alta a Dirección. | Login › pie | técnico | `uxParity-login-pie` |
| Versión/commit (`__APP_VERSION__`/`__BUILD_SHA__`) | Login.jsx:124-126 | anónimo | Trazabilidad discreta del build. | Login › versión | técnico | `uxParity-login-version` |
| **CAMBIAR CONTRASEÑA (CambiarContrasena.jsx)** | | | | | | |
| Input "Tu contraseña actual" | CambiarContrasena.jsx:104-107 | todos (no en recuperación) | Verifica identidad en equipo compartido. | Contraseña › actual | visible | `uxParity-pass-actual` |
| Input "Nueva contraseña" + medidor de fuerza | CambiarContrasena.jsx:109-118 | todos | Captura la nueva y evalúa fuerza (0-4, bloquea obvias). | Contraseña › nueva | visible | `uxParity-pass-nueva-fuerza` |
| Input "Repite la nueva" + no coincide | CambiarContrasena.jsx:121-125 | todos | Confirma la nueva contraseña. | Contraseña › repetir | visible | `uxParity-pass-repite` |
| Check "Ver lo que escribo" | CambiarContrasena.jsx:127-129 | todos | Muestra/oculta lo tecleado. | Contraseña › ver | secundario | `uxParity-pass-ver` |
| Check "Cerrar mi sesión en los demás dispositivos" | CambiarContrasena.jsx:130-136 | todos | Opcional: expulsa otras sesiones al cambiar clave. | Contraseña › cerrar otras | secundario | `uxParity-pass-cerrar-otras` |
| Botón "Guardar nueva contraseña" | CambiarContrasena.jsx:140-142 | todos | Guarda (verifica actual, cambia, cierra otras si pidió). | Contraseña › guardar | visible | `uxParity-pass-guardar` |
| Estado "Contraseña actualizada" (Volver / Cambiarla otra vez) | CambiarContrasena.jsx:70-89 | todos | Confirma el cambio y qué pasó con otras sesiones. | Contraseña › confirmación | secundario | `uxParity-pass-ok` |
| **GUÍA (Guia.jsx, modal)** | | | | | | |
| Buscador de la guía + limpiar | Guia.jsx:298-302 | todos | Busca en todas las secciones (sin acentos). | Guía › buscador | secundario | `uxParity-guia-buscar` |
| Índice de secciones (tabs filtrados por rol) | Guia.jsx:304-313 | todos (v: todos/costos/direccion) | Navega secciones; a Ventas se le ocultan Costear/Materiales/Dirección. | Guía › índice | visible | `uxParity-guia-indice-rol` |
| Temas en acordeón + marca de "visto" | Guia.jsx:321-356 | todos | Abre/cierra cada tema y recuerda los leídos (localStorage). | Guía › temas | visible | `uxParity-guia-temas` |
| Botones contextuales dentro de temas (Abrir Voni, Ver el banco, Costear desde cero, modo avanzado, precios, tablero, usuarios, acomodo) | Guia.jsx:351 (tabs 87,94,109,152,155,166,178,185) | según rol de la sección | Lleva directo a la pantalla que explica ese tema. | Guía › salto a pantalla | secundario | `uxParity-guia-ir-<tab>` |
| Demos visuales (sellos Firme/Estimado, barra de precio, punto de conexión) | Guia.jsx:30-56 | todos | Muestra el trozo real de UI dentro del tema. | Guía › demos | técnico | `uxParity-guia-demos` |
| Barra de progreso "N de M leídos" | Guia.jsx:359-363 | todos | Cuenta temas leídos sobre el total del rol. | Guía › progreso | secundario | `uxParity-guia-progreso` |
| Botón "Empezar"/"Cerrar" + X + Escape + clic fondo | Guia.jsx:285,293,364 | todos | Cierra la guía (con trampa de foco mientras está abierta). | Guía › cerrar | visible | `uxParity-guia-cerrar` |
| **ERROR BOUNDARY (SinPantallaBlanca.jsx)** | | | | | | |
| Botón "Volver al inicio" | SinPantallaBlanca.jsx:62 | todos | Sale de la pantalla atorada al Inicio. | Error › Volver | visible | `uxParity-boundary-volver` |
| Botón "Reintentar" | SinPantallaBlanca.jsx:63 | todos | Limpia el error y reintenta renderizar. | Error › Reintentar | visible | `uxParity-boundary-reintentar` |
| Botón "Copiar el detalle" | SinPantallaBlanca.jsx:64-66 | todos | Copia el stack para mandarlo a soporte. | Error › Copiar detalle | secundario | `uxParity-boundary-copiar` |
| "Ver el detalle técnico" (`details`) | SinPantallaBlanca.jsx:68-73 | todos | Despliega pantalla, error, stack y componentes. | Error › detalle técnico | técnico | `uxParity-boundary-detalle` |

Notas para la fusión: (1) `catalogo`, `cotizarIA`, `acomodo`, `biblioteca`, `carga-erp`, `contrasena` e `inicio` son pestañas reales pero NO están en `NOMBRE_VISTA`, así que no muestran título en la barra de atrás. (2) Las pestañas con gate de rol muestran, al vendedor, una tarjeta de aviso en vez de la pantalla (especial, biblioteca, costeador, precios, tablero), excepto `usuarios`/`carga-erp` que sólo se renderizan si `esDireccion`. (3) `comercial` depende del flag `commercial_v2` (hoy `true`); el FAB Voni depende de `voni_2` (hoy `true`). (4) `irA` empuja historial y aprende líneas usadas (`lineasUsadas`, local); `setPestania` directo NO empuja historial.


## 2. COSTEAR + ERP/Precios/Catálogo

> Notas de rol: `veCostosCosteo` = Dirección + Diseño (ven costo/BOM/despiece). `esVendedor` (todo lo demás) entra en modo `soloVentas` (precio autorizado, nunca costo ni margen). La **capa comercial del Costeador avanzado** (margen, precio, cotizar, ficha) y **toda la carga/firma de ERP** son **solo Dirección** (`puedeVerComercial=esDireccion`, `desbloqueado=esDireccion`, tab `carga-erp` gated `esDireccion`).

| función actual | dónde vive (componente:línea aprox) | quién la usa (rol) | qué hace (1 frase) | nuevo lugar UX propuesto | visible/secundario/técnico | test de paridad propuesto (nombre) |
|---|---|---|---|---|---|---|
| **— COSTEADORES DE LÍNEA (23 líneas, pantalla paramétrica única) —** | App.jsx:1431-1454 (applt…cirque → CosteadorLinea) | todos (soloVentas = vendedor) | Una sola pantalla parametriza las 23 líneas; cada tab (`pestania`) pasa sus productos+generador | Configurador › línea | visible | uxParity-linea-ruteo |
| Chips de Producto (cambia variante, resetea medidas/opciones) | CosteadorLinea.jsx:167-170,69-82 | todos | Elige la variante dentro de la línea | Configurador › Producto | visible | uxParity-linea-producto |
| Chips Largo / Fondo / Retorno(lateral) / Diámetro / Usuarios | CosteadorLinea.jsx:183-187 | todos | Fija la medida; realimenta despiece y precio | Configurador › Medidas | visible | uxParity-linea-medidas |
| Chips de `selects` dinámicos (p.ej. Modulor gaveta/cojín) | CosteadorLinea.jsx:188-195 | todos | Opciones específicas de la línea que cambian el BOM | Configurador › Opciones | visible | uxParity-linea-selects |
| Chips Acabado (ABS/chapa/ecolegno…) | CosteadorLinea.jsx:201-208 | todos | Cambia material de recubrimiento y rama de despiece | Configurador › Opciones › Acabado | visible | uxParity-linea-acabado |
| Chips Color melamina (con swatch hex) | CosteadorLinea.jsx:212-227 | todos | Color de melamina (solo si acabado=ABS) | Configurador › Opciones › Color | visible | uxParity-linea-color |
| Chips Biombo (sin / PET9 / cristal6 / melamina9) | CosteadorLinea.jsx:228-238 | todos | Agrega biombo (PET solo App LT) | Configurador › Opciones › Biombo | visible | uxParity-linea-biombo |
| Casillas (`checks`) de extras (cerradura, zoclo…) con default | CosteadorLinea.jsx:239-241,45-46 | todos | Activa/desactiva extras que la línea cobra por default | Configurador › Opciones | visible | uxParity-linea-checks |
| Stepper "Gavetas rodantes MOX" (±, complemento App LT) | CosteadorLinea.jsx:245-256 | todos | Agrega gavetas como partidas aparte a precio de lista | Configurador › Complementos | secundario | uxParity-linea-addons-mox |
| `<details>` "Ver despiece y hoja de costo" (tabla BOM + HojaCosto) | CosteadorLinea.jsx:268-296 | Diseño+Dirección (veCostosCosteo; oculto si soloVentas) | Muestra componentes/cantidades/unidades y hoja de costo técnica | Resultado › Ver ingeniería | técnico | uxParity-linea-ver-ingenieria |
| Stepper Cantidad (±) | CosteadorLinea.jsx:299-306 | todos | Número de piezas de la partida | Resultado › Cantidad | visible | uxParity-linea-cantidad |
| Precio grande + etiqueta de fuente (autorizado/lista real/estimado) + "Ojo: nota" | CosteadorLinea.jsx:307-333 | todos (texto difiere por rol) | Precio de venta; vendedor ve "lista autorizada", costeo ve lista+costo | Resultado › Precio | visible | uxParity-linea-precio-fuente |
| Alerta fail-closed "sin precio autorizado" (soloVentas) | CosteadorLinea.jsx:307-310,145 | vendedor | Bloquea agregar si la config no mapea a artículo autorizado | Resultado › aviso | visible | uxParity-linea-sin-precio-autorizado |
| Lista de add-ons + "Total módulo ×n" | CosteadorLinea.jsx:334-347 | todos | Suma eléctrico/accesorios a lista, evita doble cobro de eléctrico | Resultado › Complementos | secundario | uxParity-linea-addons-total |
| Botón "Agregar a la cotización" | CosteadorLinea.jsx:349,144-152 | todos | Crea partida (vendedor sin costo/margen) y la manda a la cotización | Resultado › CTA principal | visible | uxParity-linea-agregar |
| Botón "Ver mi cotización (n)" | CosteadorLinea.jsx:353 | todos | Navega a la cotización mostrando el contador | Resultado › enlace | visible | uxParity-linea-ir-cotizacion |
| Botón "¿Dónde van? Define el espacio →" (al 1er mueble) | CosteadorLinea.jsx:359-362 | todos | Lleva al Acomodo para validar que caben | Resultado › siguiente paso | secundario | uxParity-linea-ir-acomodo |
| Botón "Ver ficha PDF" | CosteadorLinea.jsx:366,395 | todos | Abre FichaPDF del módulo | Resultado › Exportar | secundario | uxParity-linea-ficha-pdf |
| Barra fija compra (celular): monto, contador, ± cantidad, "Agregar" | CosteadorLinea.jsx:371-393 | todos | Precio+cantidad+agregar sin salir del pliegue | Barra de acción persistente | visible | uxParity-linea-barra-compra |
| **— COSTEADOR AVANZADO (producto nuevo / especial) —** | App.jsx:1469-1477 → Costeador.jsx | Diseño+Dirección (veCostosCosteo); fallback si no | Pantalla de costeo desde cero/IA | Costeo avanzado | visible | uxParity-costeador-acceso |
| Input "Qué estás costeando" (nombre) | Costeador.jsx:360-362 | Diseño+Dirección | Nombra el mueble | Encabezado | visible | uxParity-cost-nombre |
| Textarea "Descríbelo y Voni lo entiende" | Costeador.jsx:369-372 | Diseño+Dirección | Texto libre del mueble para análisis IA | Encabezado › Describir | visible | uxParity-cost-descripcion |
| Botón "🧠 Analizar con Voni" (texto→BOM, pide confirmar si pisa trabajo) | Costeador.jsx:374-378,135-173 | Diseño+Dirección | IA propone piezas/estructura y prellena el despiece | Describir › Analizar | visible | uxParity-cost-analizar-ia |
| Panel "candidatos de línea existentes" (chips) | Costeador.jsx:382-390 | Diseño+Dirección | Sugiere líneas Von Haucke antes de hacer especial | Describir › sugerencias | secundario | uxParity-cost-candidatos-linea |
| Panel "Estructura que entendió Voni" (nodos/relaciones, read-only) | Costeador.jsx:392-421 | Diseño+Dirección | Muestra roles/relaciones/faltantes interpretados | Ver ingeniería › Estructura IA | técnico | uxParity-cost-estructura-voni |
| Stepper "Cuántas piezas" (±) | Costeador.jsx:423-428 | Diseño+Dirección | Tamaño de lote (reparte preparación) | Encabezado › Lote | visible | uxParity-cost-piezas |
| Select "Tipo de producto" (fabricado/compra-venta/servicio…) | Costeador.jsx:433-442 | Diseño+Dirección | Define factores de precio por volumen (T.D.C.) | Encabezado › Tipo | secundario | uxParity-cost-tipo-producto |
| Bench modular: stepper personas (par) | Costeador.jsx:446-457,309-319 | Diseño+Dirección | Rearma receta de bench por nº de personas | Opciones › Bench | secundario | uxParity-cost-bench-personas |
| Despiece: input "Nombre de la pieza" | Costeador.jsx:476-477 | Diseño+Dirección | Etiqueta de cada pieza del BOM | Ver ingeniería › Editar BOM | técnico | uxParity-cost-pieza-nombre |
| Despiece: selector material "¿de qué es?" (optgroups por sección + ERP) | Costeador.jsx:478-491,272-292 | Diseño+Dirección | Asigna insumo a la pieza (elección humana = USER_CONFIRMED) | Ver ingeniería › Editar BOM | técnico | uxParity-cost-pieza-material |
| Alertas de match de material (badge / pendiente / "Usar candidato") | Costeador.jsx:496-518 | Diseño+Dirección | Avisa sustitución/sin precio certificado y permite confirmar candidato | Ver ingeniería › aviso material | técnico | uxParity-cost-material-match |
| Despiece: inputs Largo/Ancho/Cant (material por área) | Costeador.jsx:522-536 | Diseño+Dirección | Medidas netas → m²/fracción de hoja/merma | Ver ingeniería › Editar BOM | técnico | uxParity-cost-medida-area |
| Despiece: input "Fracción de hoja" (tablero/lámina directo) | Costeador.jsx:537-540 | Diseño+Dirección | Captura 0.8 de hoja sin merma | Ver ingeniería › Editar BOM | técnico | uxParity-cost-fraccion-hoja |
| Despiece: input "Cantidad (unidad)" (material por pieza/metro) | Costeador.jsx:541-544,247-251 | Diseño+Dirección | Consumo por unidad del insumo | Ver ingeniería › Editar BOM | técnico | uxParity-cost-cantidad-unidad |
| Subtotal por pieza / "Pendiente" (sin precio) | Costeador.jsx:545,294-306 | Diseño+Dirección | Costo de la pieza; fail-closed si insumo sin precio | Ver ingeniería › BOM | técnico | uxParity-cost-subtotal-pieza |
| Alerta mm/metros + botón "Usar X mm" | Costeador.jsx:559-570,51-53 | Diseño+Dirección | Detecta 1.50 vs 1500 y corrige al salir del campo | Ver ingeniería › aviso medida | técnico | uxParity-cost-mm-metros |
| Alerta "esta pieza no está costando nada" | Costeador.jsx:571-575 | Diseño+Dirección | Avisa pieza en $0 que falsea la cotización | Ver ingeniería › aviso | técnico | uxParity-cost-pieza-cero |
| Botón "×" quitar pieza / "+ Agregar pieza" | Costeador.jsx:492,580,261-266 | Diseño+Dirección | Borra o añade renglón del BOM | Ver ingeniería › Editar BOM | técnico | uxParity-cost-add-quitar-pieza |
| Panel "Desperdicio y lista de compra" (neto, hojas, merma semáforo) | Costeador.jsx:584-620,321-327 | Diseño+Dirección | Qué comprar y cuánto se va a la basura | Ver ingeniería › Compra/merma | técnico | uxParity-cost-lista-compra |
| Botón sugerencia de lote "Cambiar a N" | Costeador.jsx:621-628,120-123 | Diseño+Dirección | Propone nº de piezas que abarata por merma | Ver ingeniería › sugerencia | secundario | uxParity-cost-sugerencia-lote |
| Botón "Usar medida que rinde mejor" | Costeador.jsx:631-641,329-350 | Diseño+Dirección | Cambia medida para caber más por tablero | Ver ingeniería › sugerencia | secundario | uxParity-cost-sugerencia-medida |
| Panel "Confianza del costeo" (% con fuente verificada, read-only) | Costeador.jsx:644,904-930 | Diseño+Dirección | Audita qué parte del costo se para en precios con fuente | Ver ingeniería › Confianza | técnico | uxParity-cost-confianza |
| Toggle Mano de obra "Por horas medidas / Por porcentaje" | Costeador.jsx:649-654 | Diseño+Dirección | Elige modo de MO (horas = simulación no oficial) | Ver ingeniería › Mano de obra | técnico | uxParity-cost-mo-modo |
| Inputs horas por área (AREAS_LABEL) | Costeador.jsx:656-672 | Diseño+Dirección | Horas por área × costo/hora | Ver ingeniería › MO › Horas | técnico | uxParity-cost-mo-horas |
| Slider factor directo + atajos (Muy fácil…Muy difícil) | Costeador.jsx:676-687,35-41 | Diseño+Dirección | Factor % de MO sobre material directo (simulación) | Ver ingeniería › MO › Factor | técnico | uxParity-cost-mo-factor-directo |
| Slider factor indirecto + GuiaManoObra + PuenteModos | Costeador.jsx:689-700,939-989 | Diseño+Dirección | Factor indirecto; guía/puente entre % y horas (botón usar N%) | Ver ingeniería › MO | técnico | uxParity-cost-mo-factor-indirecto |
| Inputs Preparación (horas) / Empaque ($) / Merma proceso (%) | Costeador.jsx:706-718 | Diseño+Dirección | Arranque de lote, empaque y % de reproceso | Ver ingeniería › Prep/empaque | técnico | uxParity-cost-prep-empaque-merma |
| Input "Gastos de fábrica %" | Costeador.jsx:723-728 | Diseño+Dirección | Indirectos de fábrica sobre material directo | Ver ingeniería › Gastos fábrica | técnico | uxParity-cost-gastos-fabrica |
| Botón "Generar/Regenerar/Actualizar render con IA" + Quitar render + MiniRender | Costeador.jsx:749-754,216-231 | Diseño+Dirección | Genera imagen del mueble (marca stale si cambió el BOM) | Resultado › Render | secundario | uxParity-cost-render-ia |
| Panel HojaCosto (técnico+comercial) | Costeador.jsx:761 → HojaCosto.jsx | Diseño+Dirección (comercial solo si `mostrarComercial`=Dirección) | Hoja de costo viva en columna derecha | Resultado › Hoja de costo | técnico | uxParity-cost-hojacosto |
| `<details>` "Así calculé este mueble · auditoría matemática" | Costeador.jsx:763-802,109-112 | Diseño+Dirección | Desglose ecuación/insumos/supuestos/bloqueos | Ver ingeniería › Auditoría | técnico | uxParity-cost-auditoria-mate |
| Panel "VONI · Mejora de fabricación" (advisory, no cambia costo) | Costeador.jsx:804-842,105-108 | Diseño+Dirección | Oportunidades de corte/retazo/repetibilidad | Ver ingeniería › Mejoras | técnico | uxParity-cost-mejora-industrial |
| Banner "SIMULADOR — NO OFICIAL" + botón "Volver al costo oficial (Alba V1)" | Costeador.jsx:847-855,117-119 | Dirección | Marca costeo no certificado y restaura Alba | Resultado › aviso oficial | visible | uxParity-cost-simulador-alba |
| Slider "Cuánto quieres ganar" (margen) | Costeador.jsx:856-861 | **solo Dirección** (puedeVerComercial) | Fija margen → precio de lista | Resultado › Precio › Margen | visible | uxParity-cost-margen |
| Precio grande / "Pendiente" + alertas (no emitible / bajo mínimo) | Costeador.jsx:862-865,91-104 | **solo Dirección** | Precio por pieza; fail-closed con bloqueos técnicos/estructurales | Resultado › Precio | visible | uxParity-cost-precio-bloqueos |
| Botón "Agregar a la cotización" (verifica costo en servidor) | Costeador.jsx:868-870,180-192 | **solo Dirección** | Valida costo autoritativo y emite partida a la cotización | Resultado › CTA principal | visible | uxParity-cost-agregar-verificado |
| Botón "Guardar como pieza" | Costeador.jsx:872,882 | Diseño+Dirección | Guarda el costeo en la biblioteca de piezas | Resultado › Guardar | secundario | uxParity-cost-guardar-pieza |
| Botón "Ver ficha PDF" (bloqueado si simulando/incompleto) | Costeador.jsx:874,887-889 | **solo Dirección** | Ficha oficial del mueble | Resultado › Exportar | secundario | uxParity-cost-ficha-pdf |
| Bloque "Cierre técnico" (sin capa comercial) | Costeador.jsx:876-884 | Diseño (no Dirección) | Diseño solo guarda pieza; precio/margen son de Dirección | Resultado › Cierre técnico | visible | uxParity-cost-cierre-tecnico |
| Barra fija inferior (costo/precio/"No oficial") | Costeador.jsx:892-895 | Diseño+Dirección (precio solo Dirección) | Resumen persistente costo+precio en pantalla angosta | Barra de acción persistente | visible | uxParity-cost-barra-fija |
| **— BUSCADOR DE INSUMO (ERP ~11k, dentro del despiece) —** | BuscadorInsumo.jsx (en Costeador.jsx:494 y AsistenteEspecial) | Diseño+Dirección | Busca y elige a mano un material del catálogo ERP para una pieza | Ver ingeniería › Editar BOM › Buscar material | técnico | uxParity-buscador-insumo |
| Botón "🔎 Buscar en todo el catálogo" (abre) | BuscadorInsumo.jsx:31-33 | Diseño+Dirección | Despliega el buscador ERP inline | Editar BOM › Buscar | técnico | uxParity-buscador-abrir |
| Input de búsqueda (debounce) + estados buscando/error/vacío | BuscadorInsumo.jsx:34-39,18-29 | Diseño+Dirección | Consulta `buscarInsumosMotor` en vivo | Editar BOM › Buscar | técnico | uxParity-buscador-query |
| Lista de resultados con precio/unidad/evidencia + botón "Usar" | BuscadorInsumo.jsx:40-61 | Diseño+Dirección | Elige insumo (sin precio = queda pendiente); viaja a hermanas | Editar BOM › resultado | técnico | uxParity-buscador-usar |
| Botón "Cerrar" | BuscadorInsumo.jsx:62 | Diseño+Dirección | Oculta el buscador | Editar BOM › Buscar | técnico | uxParity-buscador-cerrar |
| **— EDITAR PARTIDA (recotizar un mueble de la cotización) —** | EditarPartida.jsx (abre desde Cotizacion.jsx:475,548,629 lápiz) | todos (soloVentas = vendedor, sin costo) | Reabre un mueble de línea y lo recotiza en vivo | Cotización › partida › Editar | visible | uxParity-editar-abrir |
| Chips Largo/Fondo/Retorno/Diámetro/Usuarios/selects/Acabado/Color/Biombo/Checks | EditarPartida.jsx:124-151 | todos | Mismos controles de la línea; recotiza al cambiar | Editar mueble › opciones | visible | uxParity-editar-opciones |
| Stepper Cantidad (±) | EditarPartida.jsx:153-160 | todos | Cambia cantidad de la partida | Editar mueble › Cantidad | visible | uxParity-editar-cantidad |
| Resumen precio + delta "(+/− por pieza)" | EditarPartida.jsx:164-173,87 | todos | Muestra nuevo precio y la diferencia vs anterior | Editar mueble › resumen | visible | uxParity-editar-delta |
| Botones "Cancelar" / "Guardar cambios" (vía contrato crearPartida) | EditarPartida.jsx:176-177,24-38 | todos | Descarta o reescribe la partida (vendedor sin costo/margen) | Editar mueble › acciones | visible | uxParity-editar-guardar |
| Fallback "No se puede editar" (banco/especial) | EditarPartida.jsx:67-81,19 | todos | Explica que solo se editan muebles de línea | Editar mueble › aviso | secundario | uxParity-editar-no-editable |
| **— PRECIOS (insumos, costo hora, parámetros) —** | App.jsx:1498-1501 → Precios.jsx | Diseño+Dirección (tab); costo hora solo Dirección | Pantalla de precios de material y parámetros de planta | Ajustes › Precios | visible | uxParity-precios-acceso |
| Calculadora costo hora: inputs nómina/operativos/horas-semana/eficiencia | Precios.jsx:85-116,21-43 | **solo Dirección** (desbloqueado) | Calcula hora de taller; locked con nómina oculta para no-Dirección | Ajustes › Costo hora (Dirección) | técnico | uxParity-precios-costo-hora |
| Botón "Usar en los costeos (hora taller)" | Precios.jsx:115 | **solo Dirección** | Fija `costoHora` global para todos los costeos | Ajustes › Costo hora | visible | uxParity-precios-usar-hora |
| Aviso bloqueado "La nómina es solo de Dirección" + "Soy Dirección" | Precios.jsx:75-83 | Diseño (no Dirección) | Oculta nómina, muestra solo la hora en uso | Ajustes › Costo hora (bloqueado) | secundario | uxParity-precios-hora-bloqueada |
| Parámetros de planta: 8 CampoNumero (gastos fábrica, márgenes, anticipo, factores MO, aprovechamiento) | Precios.jsx:121-158 | Diseño+Dirección | Edita parámetros globales de costeo/precio | Ajustes › Parámetros | técnico | uxParity-precios-parametros |
| Botones "Exportar a archivo" / "Importar archivo" / "Restablecer precios de fábrica" | Precios.jsx:160-170,60-70 | Diseño+Dirección | Respaldo/traspaso de precios+piezas+cotizaciones y reset | Ajustes › Respaldo | secundario | uxParity-precios-export-import |
| Aviso "precios desde catálogo certificado (ERP, solo lectura)" | Precios.jsx:172-177,58 | Diseño+Dirección | Marca que los precios vienen del ERP y no se editan a mano | Ajustes › Precios › banner | técnico | uxParity-precios-desde-catalogo |
| Tablas de precios por sección: celda editable (CampoNumero) o solo lectura + semáforos | Precios.jsx:178-218 | Diseño+Dirección | Captura/consulta precio por insumo; alerta fuera de rango/antigüedad | Ajustes › Precios por sección | técnico | uxParity-precios-tabla-insumos |
| **— BANCO DE PRECIOS (productos ya cotizados + catálogo 23 líneas) —** | App.jsx:1372 → Banco.jsx | todos | Busca producto real con precio cerrado y lo mete a la cotización | Catálogo › Banco | visible | uxParity-banco-acceso |
| Input de búsqueda libre | Banco.jsx:67-68,18-48 | todos | Busca por nombre/clave/medidas/línea en banco y catálogo | Banco › Buscar | visible | uxParity-banco-buscar |
| Chips filtro Línea / Tipo de mueble | Banco.jsx:69-82 | todos | Filtra resultados | Banco › filtros | secundario | uxParity-banco-filtros |
| Aviso "ya traen descuento del proyecto" | Banco.jsx:64-66 | todos | Advierte doble descuento | Banco › banner | visible | uxParity-banco-aviso-descuento |
| Item banco: sello "Firme", input cantidad, botón "Agregar" | Banco.jsx:96-126,52-57 | todos | Agrega producto con precio real cerrado a la cotización | Banco › resultado › Agregar | visible | uxParity-banco-agregar |
| Item catálogo 23 líneas: sello Firme/Estimado, precio-rango, botón "Configurar →" | Banco.jsx:128-165 | todos | Lleva a la línea para costear a la medida | Banco › catálogo › Configurar | visible | uxParity-banco-configurar |
| Botón "Ver mi cotización ›" / "Ver todo el banco" (reset) | Banco.jsx:175,180-182 | todos | Navega a cotización / limpia filtros | Banco › navegación | secundario | uxParity-banco-navegar |
| **— CATÁLOGO (familias → muebles → líneas) —** | App.jsx:1479 → Catalogo.jsx | todos (soloVentas = vendedor) | Elige mueble por familia/búsqueda y carga la línea más barata | Catálogo | visible | uxParity-catalogo-acceso |
| Input búsqueda (lista plana) | Catalogo.jsx:85-110 | todos | Busca mueble por nombre o familia | Catálogo › Buscar | visible | uxParity-catalogo-buscar |
| Familias plegables (expandir/colapsar) + "Ver líneas" | Catalogo.jsx:111-135 | todos | Navega por familia a los muebles | Catálogo › familias | visible | uxParity-catalogo-familias |
| Paso 2: líneas ordenadas por precio + etiqueta "MÁS BARATA" | Catalogo.jsx:41-78,21-27 | todos | Lista líneas del mueble; costo (veCostos) o precio recomendado (vendedor) | Catálogo › líneas | visible | uxParity-catalogo-lineas-orden |
| Botón "Usar" / "Configurar →" (carga receta/bench/blanco) | Catalogo.jsx:73,163-218 | todos | Carga el mueble al Costeador o configurador | Catálogo › líneas › CTA | visible | uxParity-catalogo-cargar |
| Botón "‹ Otras opciones" (volver) | Catalogo.jsx:59 | todos | Regresa a la lista de líneas | Catálogo › navegación | secundario | uxParity-catalogo-volver |
| **— CARGA ERP (compras Intelisis) —** | App.jsx:1503 → CargaERP.jsx | **solo Dirección** (tab gated esDireccion) | Sube el reporte Última Compra .xlsx al catálogo del motor | Ajustes › ERP (Dirección) | visible | uxParity-erp-acceso |
| Firma: botón "Firmar precios del ERP" + confirm "Sí, firmar"/Cancelar + resultado | CargaERP.jsx:19-67,44-64 | **solo Dirección** | Firma humana de precios ERP vigentes (≤24m) con la sesión | Ajustes › ERP › Firmar | visible | uxParity-erp-firmar |
| Carga: input archivo .xlsx (valida encabezados) | CargaERP.jsx:127-131,78-95 | **solo Dirección** | Lee el reporte en el navegador y lo prepara | Ajustes › ERP › Subir archivo | visible | uxParity-erp-archivo |
| Carga: tabla resumen (entran/sin costo/certificables/bloqueados) | CargaERP.jsx:133-146 | **solo Dirección** | Previsualiza qué entrará antes de confirmar | Ajustes › ERP › Resumen | técnico | uxParity-erp-resumen |
| Carga: botón "Cargar al catálogo" (por lotes, con avance) | CargaERP.jsx:147,97-121 | **solo Dirección** | Envía catálogo+precios por RPC (no duplica, no inventa $0) | Ajustes › ERP › Cargar | visible | uxParity-erp-cargar |
| Carga: tabla resultado + `<details>` "Ver errores" | CargaERP.jsx:150-169 | **solo Dirección** | Muestra nuevos/certificados/duplicados/errores | Ajustes › ERP › Resultado | técnico | uxParity-erp-resultado |


## 3. COTIZAR + Acomodo/Planos/PDF

| función actual | dónde vive (componente:línea aprox) | quién la usa (rol) | qué hace (1 frase) | nuevo lugar UX propuesto | visible/secundario/técnico | test de paridad propuesto (nombre) |
|---|---|---|---|---|---|---|
| Elegir cómo empezar: subir plano / dibujar / solo m² | EmpezarEspacio.jsx:116-127 | vendedor, diseno, direccion | Tres caminos ordenados por valor (plano real → dibujo → metros) para arrancar un espacio | Paso 1 "¿Dónde va?" como bifurcación grande con jerarquía plano>dibujo>m² | visible | uxParity-empezar-tres-caminos |
| Subir plano del cliente (PDF/foto/DWG/DXF) | EmpezarEspacio.jsx:116 · AcomodoBase.jsx:1379,1450-1453 | vendedor, diseno, direccion | Abre selector de archivo y manda el plano a lectura por IA | Dropzone en paso Espacio con estados subiendo/leyendo | visible | uxParity-subir-plano |
| Elegir m² típicos (50…400) | EmpezarEspacio.jsx:134-137 | vendedor, diseno, direccion | Botones de metraje típico de una llamada | Chips rápidos de metraje | visible | uxParity-m2-tipicos |
| Barra de m² (range) | EmpezarEspacio.jsx:144 | vendedor, diseno, direccion | Slider que fija m² por piso sin poder salirse de min/max | Slider con lectura viva | secundario | uxParity-m2-slider |
| Escribir m² exacto (CampoM2) | EmpezarEspacio.jsx:28-51,150 | vendedor, diseno, direccion | Campo de texto que guarda lo tecleado y acota al salir (no se inventa piso de 20) | Input numérico con validación al blur | secundario | uxParity-m2-exacto |
| Elegir número de pisos (medio…4) | EmpezarEspacio.jsx:155-159 | vendedor, diseno, direccion | Cada piso entra como espacio aparte con su acomodo | Selector de plantas | visible | uxParity-pisos |
| Programa de cuartos: privados ± y m² por privado | EmpezarEspacio.jsx:172-189 | vendedor, diseno, direccion | Define cuántas oficinas cerradas y de qué tamaño (son parte del espacio, no muebles) | Editor de programa-espacio con steppers | visible | uxParity-espacio-privados |
| Salas de juntas ± y pax | EmpezarEspacio.jsx:190-207 | vendedor, diseno, direccion | Cuenta de salas y para cuántas personas (deriva m²) | Steppers + chips de capacidad | visible | uxParity-espacio-juntas |
| Recepción / Break room (checkbox) | EmpezarEspacio.jsx:208-209 | vendedor, diseno, direccion | Marca cuartos de servicio del espacio | Toggles de cuartos | secundario | uxParity-espacio-servicios |
| Aviso de cancelería/puertas WAND propuesta | EmpezarEspacio.jsx:232-245 | vendedor, diseno, direccion | Calcula m lineales de cancel y lo PROPONE (nunca lo agrega solo; paño a la medida) | Tarjeta de sugerencia no-destructiva | secundario | uxParity-cancel-propuesto |
| Avisos apretado / sobrado vs m² que necesita | EmpezarEspacio.jsx:100-106,255-267 | vendedor, diseno, direccion | Compara metraje contra lo cotizado y avisa (no bloquea) | Banner de holgura de espacio | visible | uxParity-espacio-apretado-sobrado |
| Empezar con N m² → | EmpezarEspacio.jsx:270-273 | vendedor, diseno, direccion | Cierra captura y crea las áreas/cuartos | CTA primario del paso | visible | uxParity-empezar-listo |
| Escribir/pegar pedido del cliente (texto libre) | CotizadorIA.jsx:262-268 | vendedor, diseno, direccion | Textarea que Claude mapea a renglones reales de las 24 líneas | Entrada conversacional del cotizador | visible | uxParity-ia-texto |
| Ejemplos de pedido (chips) | CotizadorIA.jsx:32-36,269-273 | vendedor, diseno, direccion | Precarga un pedido tipo nombrado por proyecto | Chips de plantilla de pedido | secundario | uxParity-ia-ejemplos |
| Armar la lista / Volver a interpretar | CotizadorIA.jsx:78-204,275-277 | vendedor, diseno, direccion | Interpreta, cuesta cada mueble y REEMPLAZA el lote anterior (no duplica) | CTA "Interpretar" con estado de lote | visible | uxParity-ia-interpretar |
| Resultado "Agregué N muebles" + resumen | CotizadorIA.jsx:285-299 | vendedor, diseno, direccion | Confirma cuántos entraron y manda a revisar en la lista real | Tarjeta de resultado con conteo vivo | visible | uxParity-ia-resultado |
| Preguntas de afinación + responder/rehacer | CotizadorIA.jsx:213-227,344-358 | vendedor, diseno, direccion | Voni pregunta, el vendedor contesta; la aclaración se pega al pedido y Voni aprende | Hilo de aclaraciones persistente | visible | uxParity-ia-aclaracion |
| Avisos IA: no-catálogo / material especial / sin costear / sin precio autorizado / sugerencias descartadas | CotizadorIA.jsx:315-343 | vendedor, diseno, direccion | Dice qué no entró y por qué (fail-closed: nunca $0) | Lista de advertencias clasificadas | visible | uxParity-ia-avisos |
| Prefill de programa desde el plano + avisos largo/sala | ProgramaProyecto.jsx:125-175 | vendedor, diseno, direccion | Llena el cuestionario con lo que leyó el plano (islas, privados, salas) y avisa si no cuadra | Cuestionario autollenado del plano | visible | uxParity-programa-prefill |
| Operativos ± (+ largo puesto, línea, silla) | ProgramaProyecto.jsx:177-189 | vendedor, diseno, direccion | Define puestos bench y su estilo en 3 decisiones, no 90 | Editor de programa por botones | visible | uxParity-programa-operativos |
| Privados ± (escritorio, línea, silla directiva, silla visita, credenza) | ProgramaProyecto.jsx:192-211 | vendedor, diseno, direccion | Arma las oficinas cerradas con su mobiliario y sillas | Bloque privados del programa | visible | uxParity-programa-privados |
| Sala de juntas ± + silla | ProgramaProyecto.jsx:213-222 | vendedor, diseno, direccion | Pide mesa y sillas de visita por sala | Bloque juntas del programa | visible | uxParity-programa-juntas |
| Gavetas ± / Archiveros ± (muebles distintos) | ProgramaProyecto.jsx:224-232 | vendedor, diseno, direccion | Pedestal rodante (1/puesto) vs archivero (1/privado) por separado | Steppers de guarda | secundario | uxParity-programa-guardas |
| Recepción (checkbox) | ProgramaProyecto.jsx:234-237 | vendedor, diseno, direccion | Agrega recepción con mostrador a la frase | Toggle | secundario | uxParity-programa-recepcion |
| Resumen "N personas" + frase | ProgramaProyecto.jsx:85-123,239-244 | vendedor, diseno, direccion | Arma la frase que se le entrega a Voni y muestra personas | Vista previa de la frase | secundario | uxParity-programa-frase |
| Armar el proyecto → | ProgramaProyecto.jsx:246-249 | vendedor, diseno, direccion | Entrega la frase a CotizadorIA para costear | CTA del programa | visible | uxParity-programa-armar |
| "Esto entendí": lista corregible por grupos + titular + avisos | EstoEntendi.jsx:57-90 | vendedor, diseno, direccion | Muestra en español lo leído, agrupado, con lo que no cuadra arriba | Pantalla de revisión pre-acomodo | visible | uxParity-esto-entendi |
| Cantidad ± por partida (Esto entendí) | EstoEntendi.jsx:132-136 | vendedor, diseno, direccion | Cambia la cantidad real de la partida | Stepper por renglón | visible | uxParity-ee-cantidad |
| Quitar partida (Esto entendí) | EstoEntendi.jsx:143 | vendedor, diseno, direccion | Elimina el renglón del proyecto | Acción quitar | visible | uxParity-ee-quitar |
| Editar partida (lápiz, Esto entendí) | EstoEntendi.jsx:138-142 | vendedor, diseno, direccion | Abre edición de medidas/acabado/cantidad | Editar inline | secundario | uxParity-ee-editar |
| Elegir variante/terminación de catálogo | EstoEntendi.jsx:116-130 | vendedor, diseno, direccion | Muestra variantes con precio real; Voni no elige por el vendedor | Selector de terminación con precio | visible | uxParity-ee-variantes |
| Badges de sello/sugerido/confianza/procedencia | EstoEntendi.jsx:66-73,100-105 | vendedor, diseno, direccion | Marca de dónde salió cada pieza y su confianza | Chips de procedencia (ver crudos) | secundario | uxParity-ee-procedencia |
| Confirmar lectura del plano (áreas, m², puestos, confianza) | ConfirmarLectura.jsx:31-62 | vendedor, diseno, direccion | Enseña lo interpretado y NADA se usa hasta confirmar | Compuerta de confirmación de lectura | visible | uxParity-lectura-confirmar |
| Problemas a revisar de la lectura | ConfirmarLectura.jsx:69-73 | vendedor, diseno, direccion | Lista lo dudoso que la IA detectó | Banner de problemas | visible | uxParity-lectura-problemas |
| Estructura leída: columnas / niveles | ConfirmarLectura.jsx:63-68 | vendedor, diseno, direccion | Avisa columnas (se respetan) y que solo usa el 1er nivel | Nota de estructura | secundario | uxParity-lectura-estructura |
| Confirmar puertas pendientes en la lectura | ConfirmarLectura.jsx:77-90 · PuertaConfirmar.jsx | vendedor, diseno, direccion | Pide confirmar sentido/bisagra de puertas no reconocidas antes de usar el plano | Paso de puertas dentro de la compuerta | visible | uxParity-lectura-puertas |
| "Sí, así es" / "No, lo dibujo yo" / "Volver a subir" | ConfirmarLectura.jsx:93-105 | vendedor, diseno, direccion | Acepta, corrige con dibujo, o reemplaza el plano | Tres CTAs de la compuerta | visible | uxParity-lectura-acciones |
| Puerta: hojas una/doble, bisagra izq/der, abre adentro/afuera | PuertaConfirmar.jsx:24-36 | vendedor, diseno, direccion | Control para fijar apertura de una puerta (no inventa nada hasta confirmar) | Control de puerta reutilizable | visible | uxParity-puerta-confirmar |
| Aviso "Voni detectó el programa del plano" (PROPUESTA) + preview | Acomodo.jsx:263-297 | vendedor, diseno, direccion | Sin partidas reales, muestra programa propuesto de catálogo (no cotiza nada) | Panel de programa detectado | visible | uxParity-acomodo-programa-detectado |
| Select línea operativa + "Aplicar programa detectado" | Acomodo.jsx:284-294 | vendedor, diseno, direccion | Convierte la propuesta en partidas reales (idempotente) | CTA aplicar programa | visible | uxParity-acomodo-aplicar-programa |
| Aviso de faltantes del programa (SUGERIDAS · NO COTIZADAS) | Acomodo.jsx:300-315 | vendedor, diseno, direccion | Propone piezas que faltan sin meterlas al acomodo ni a totales | Banner de faltantes no-cobrables | visible | uxParity-acomodo-faltantes |
| Cartel de estado del espacio 3D (validado / en revisión / falta) | AcomodoBase.jsx:1380-1392 | vendedor, diseno, direccion | Describe honestamente en qué va el acomodo | Encabezado de estado del acomodo | visible | uxParity-acomodo-estado-cartel |
| Aviso piezas truncadas (dibujo recorta, precio no) | AcomodoBase.jsx:1400-1406 | vendedor, diseno, direccion | Avisa que el plano solo dibuja las primeras N piezas | Banner de truncado | secundario | uxParity-acomodo-truncado |
| Editar áreas: nombre / ancho / largo / + agregar / quitar | AcomodoBase.jsx:1422-1432 | vendedor, diseno, direccion | Ajusta las áreas del proyecto a mano | Editor de áreas | visible | uxParity-acomodo-areas |
| Cambiar el espacio (reset a la pregunta inicial) | AcomodoBase.jsx:1438-1448 | vendedor, diseno, direccion | Borra áreas/acomodo/imágenes y vuelve a EmpezarEspacio | Acción "empezar espacio otra vez" | secundario | uxParity-acomodo-cambiar-espacio |
| Dibujar mi oficina / Subir plano (desde acomodo) | AcomodoBase.jsx:1449-1453 | vendedor, diseno, direccion | Entradas alternas al editor de dibujo y al upload | Accesos al plano dentro del acomodo | visible | uxParity-acomodo-entradas-plano |
| Puertas por confirmar en el acomodo | AcomodoBase.jsx:1454-1462 | vendedor, diseno, direccion | Pide apertura de puertas; mientras, el acomodo queda en revisión | Panel de puertas pendientes | visible | uxParity-acomodo-puertas |
| Acomodar (motor) / Con IA | AcomodoBase.jsx:1466-1469 | vendedor, diseno, direccion | Corre el solver de acomodo (bloqueado si el programa no está listo) | CTA primario + alterno IA | visible | uxParity-acomodo-acomodar |
| Plano original vs lo que entendí + nivel confianza | AcomodoBase.jsx:1481-1515 | vendedor, diseno, direccion | Comparación honesta antes de dar por bueno el acomodo | Comparador plano/lectura | visible | uxParity-acomodo-vs-plano |
| Mensaje al vendedor "qué no cupo / por qué / qué hacer" | AcomodoBase.jsx:1520-1532 | vendedor, diseno, direccion | Explica los pendientes del acomodo en lenguaje claro | Tarjeta de pendientes | visible | uxParity-acomodo-msg-vendedor |
| Diagnóstico tabla (mueble/zona/medida/causa/qué hacer) | AcomodoBase.jsx:1533-1555 | diseno, direccion | Por renglón, causa exacta y acción de por qué no quedó colocado | Tabla de diagnóstico (humanizar códigos) | secundario | uxParity-acomodo-diagnostico |
| Amueblar una foto real con IA (staging) | AcomodoBase.jsx:1559-1569 | vendedor, diseno, direccion | Sube foto del espacio y la IA la amuebla con lo cotizado | Staging virtual | visible | uxParity-staging-foto |
| Render de mi oficina (IA) + bloqueo hasta cerrar acomodo | AcomodoBase.jsx:1568-1575 | vendedor, diseno, direccion | Genera render fotorrealista; bloqueado si el layout no está listo | Botón render con gate visible | visible | uxParity-render-oficina-gate |
| Guardar staging en la propuesta | AcomodoBase.jsx:1582-1585 | vendedor, diseno, direccion | Fija la imagen amueblada en el PDF | Guardar imagen a propuesta | visible | uxParity-staging-guardar |
| Chequeo "✓ Todo cabe / faltan N / puestos·m² por persona" | AcomodoBase.jsx:1593-1604 | vendedor, diseno, direccion | Verificación medida (caja contra caja) del acomodo | Resumen de cabida | visible | uxParity-acomodo-chequeo |
| Auditoría "Voni revisó" (medida) + aviso vencida | AcomodoBase.jsx:1612-1631 | diseno, direccion | Checks medidos de encimados/dentro de cuarto; marca la revisión vencida si cambió el proyecto | Panel de auditoría medida | secundario | uxParity-acomodo-auditoria |
| Veredicto por bloques (geometría/colisiones/programa/anclas/semántica/evidencia/publicable) | AcomodoBase.jsx:1633-1647 | diseno, direccion | Dice qué ya pasó y qué falta, sin pintar PASS lo pendiente | Checklist de veredicto | visible | uxParity-acomodo-veredicto |
| Toggle Planta / Vista 3D | AcomodoBase.jsx:1651,1656 | vendedor, diseno, direccion | Cambia entre vista en planta e isométrico | Toggle de vista | visible | uxParity-acomodo-vista |
| Acomodar a mano / Terminar de acomodar | AcomodoBase.jsx:1652-1655 | diseno, direccion | Entra al editor manual del plano | Modo editor manual | visible | uxParity-acomodo-amano |
| Vista preliminar (N pendientes) / Vista realista (IA) | AcomodoBase.jsx:1657-1665 | vendedor, diseno, direccion | Genera render: preliminar si incompleto, realista si listo | Render con estado preliminar | visible | uxParity-acomodo-realista |
| ✨ Propuesta Viva (presentación cinematográfica) | AcomodoBase.jsx:1667-1671,1684-1689 | vendedor, diseno, direccion | Abre presentación al cliente; bloqueada si no es propuesta final | Modo presentación del acomodo | visible | uxParity-propuesta-viva |
| Guardar en la propuesta / Guardar borrador de acomodo | AcomodoBase.jsx:1672-1682 | vendedor, diseno, direccion | Persiste el acomodo; distingue válido vs borrador | Guardar acomodo (dos estados) | visible | uxParity-acomodo-guardar |
| Floor editor: arrastrar / girar / quitar / duplicar muebles | PlanoAcomodo.jsx:139-156,449-482 · AcomodoBase.jsx:1690-1701 | diseno, direccion | Manipulación directa de piezas en el plano (touch+mouse, pan/zoom) | Lienzo editable de acomodo | visible | uxParity-floor-editor-piezas |
| Poner elementos en el plano (puerta/columna/etc.) | AcomodoBase.jsx:1714-1723 | diseno, direccion | Coloca elementos arquitectónicos que el plano no trae | Paleta de elementos | visible | uxParity-floor-elementos |
| Configurar puerta en el plano: abre →↓←↑ (bisagra) | AcomodoBase.jsx:1772-1791 | diseno, direccion | Fija barrido de 90° de la puerta seleccionada | Mini-menú de puerta | visible | uxParity-floor-puerta-barrido |
| Vaciar el plano y acomodar yo | AcomodoBase.jsx:1729-1733 | diseno, direccion | Empieza el acomodo manual en blanco | Acción vaciar | secundario | uxParity-floor-vaciar |
| Que lo acomode Voni otra vez / Acomodar el resto (sin mover lo mío) | AcomodoBase.jsx:1734-1738 | diseno, direccion | Re-corre el motor respetando lo colocado a mano | Reacomodar respetando manual | visible | uxParity-floor-reacomodar |
| Acomodar todo de cero (pierde lo manual) | AcomodoBase.jsx:1741-1750 | diseno, direccion | Re-corre todo el motor con confirmación destructiva | Acción de reset con confirm | secundario | uxParity-floor-de-cero |
| Deshacer / Rehacer | AcomodoBase.jsx:1751-1758 | diseno, direccion | Pila de undo/redo del acomodo manual | Undo/redo | secundario | uxParity-floor-undo |
| + Agregar otro producto (al banco) | AcomodoBase.jsx:1803-1811 | vendedor, diseno, direccion | La paleta solo trae lo cotizado; para algo nuevo manda al banco | Acceso a catálogo desde el editor | secundario | uxParity-floor-agregar-producto |
| Paleta muebles/sillas con conteo decreciente | AcomodoBase.jsx:1817-1843 | diseno, direccion | Agrupa por producto y baja la cuenta conforme colocas (no pasarte) | Paleta de piezas agrupada | visible | uxParity-floor-paleta |
| Oferta "poner todas en este cuarto" | AcomodoBase.jsx:1845-1860 | diseno, direccion | Rellena de golpe las piezas restantes en un área | Sugerencia de relleno | secundario | uxParity-floor-rellenar |
| "Qué va en cada cuarto" (lista por escrito) + copiar | AcomodoBase.jsx:1868-1913 | vendedor, diseno, direccion | Lo del plano en palabras (incluye gavetas y sillas que el dibujo no dice) | Resumen por cuarto copiable | visible | uxParity-por-cuarto |
| Generar imagen por área (escenas IA) + guardar | AcomodoBase.jsx:1945-1988 | vendedor, diseno, direccion | Una foto IA por cuarto con sus muebles y línea, para la propuesta | Galería de escenas por área | visible | uxParity-escenas-area |
| Leyenda de tipos de mueble | AcomodoBase.jsx:1990-1994 | vendedor, diseno, direccion | Color por tipo en el plano | Leyenda del plano | técnico | uxParity-plano-leyenda |
| Herramientas de dibujo (cuarto/trazo/esquina/puerta/columna/escalera/curvo) | DibujarPlano.jsx:360-366 | vendedor, diseno, direccion | Trazar la oficina a escala con distintos modos | Barra de herramientas del editor de plano | visible | uxParity-dibujar-herramientas |
| Plantillas por giro (Corporativo/Legal/Startup/Callcenter) | DibujarPlano.jsx:372-375 | vendedor, diseno, direccion | Un toque deja una planta tipo lista para ajustar | Plantillas de planta | visible | uxParity-dibujar-plantillas |
| Dimensionar a m² | DibujarPlano.jsx:476-480 | vendedor, diseno, direccion | Escala toda la planta (cuartos, puertas, columnas) al metraje real | Acción dimensionar | visible | uxParity-dibujar-dimensionar |
| Cerrar forma / quitar punto / descartar / limpiar | DibujarPlano.jsx:487-494 | vendedor, diseno, direccion | Edición del trazo esquina-por-esquina y limpieza | Controles de forma | secundario | uxParity-dibujar-forma |
| Deshacer / Rehacer (dibujo) | DibujarPlano.jsx:492-493 | vendedor, diseno, direccion | Undo/redo del lienzo de dibujo | Undo/redo editor plano | secundario | uxParity-dibujar-undo |
| Editar cuarto: nombre, medidas, doble altura, tipo, quitar | DibujarPlano.jsx:502-511 | vendedor, diseno, direccion | Ajusta cada cuarto y su tipo (el acomodo reparte por el tipo) | Editor de cuarto | visible | uxParity-dibujar-cuarto |
| Amueblar mi oficina → / Cancelar | DibujarPlano.jsx:521-522 | vendedor, diseno, direccion | Entrega las áreas dibujadas al acomodo | CTA del editor de plano | visible | uxParity-dibujar-listo |
| Ficha PDF de mueble: Guardar/enviar PDF, Cerrar | FichaPDF.jsx:78-93 | vendedor, diseno, direccion | Imprime la ficha de un mueble individual como PDF | Ficha de producto imprimible | visible | uxParity-ficha-pdf-imprimir |
| Ficha PDF: especificación + render/foto + precio/IVA/condiciones | FichaPDF.jsx:20-187 | vendedor, diseno, direccion | Arma la hoja cliente-safe (sin costo) de un mueble | Plantilla de ficha de producto | visible | uxParity-ficha-pdf-contenido |
| Cliente (input) de la cotización | Cotizacion.jsx:444 | vendedor, diseno, direccion | Nombre del cliente que va en portada y PDF | Campo cliente | visible | uxParity-cot-cliente |
| Folio (input) + sugerir folio | Cotizacion.jsx:454-461 | vendedor, diseno, direccion | Folio editable; si se deja vacío sale sin folio | Campo folio con autogenerar | visible | uxParity-cot-folio |
| Estado vacío: Cotizar con IA / Abrir Voni / Del banco | Cotizacion.jsx:516-522 | vendedor, diseno, direccion | Rutas para llenar una propuesta en blanco | Empty state con CTAs | visible | uxParity-cot-vacia |
| Lista de muebles: cantidad ± / editar / quitar (móvil y escritorio) | Cotizacion.jsx:531-558,614-661 | vendedor, diseno, direccion | Edición de partidas en la propuesta | Lista de partidas editable | visible | uxParity-cot-partidas |
| Agregar más muebles / Acomodar en el espacio | Cotizacion.jsx:558-559 | vendedor, diseno, direccion | Saltos a cotizador y a acomodo | Accesos de navegación | visible | uxParity-cot-navegar |
| Tabla interna "Mis números" (precio/costo/utilidad/margen/bajo piso) | Cotizacion.jsx:566-663 | direccion (economía) | Vista económica con costo/utilidad; marca partidas bajo mínimo | Vista interna de economía | secundario | uxParity-cot-mis-numeros |
| Pregúntale a Voni (narración de señales) | Cotizacion.jsx:579-589 | direccion, diseno | Explica con IA las señales económicas (un clic, no automática) | Panel Voni de señales | secundario | uxParity-cot-voni-senales |
| Toggle "Mis números / Como la ve el cliente" | Cotizacion.jsx:915-916 | diseno, direccion | Alterna entre vista interna y vista cliente | Switch de vista | visible | uxParity-cot-toggle-vista |
| Descuento de proyecto (%) + aviso de política + Máx. rentable | Cotizacion.jsx:669-681 | vendedor (aviso), direccion (máx.) | Aplica descuento ENCIMA del precio de lista; avisa política y piso rentable | Control de descuento con guardarraíl | visible | uxParity-cot-descuento |
| Imprevistos de obra (%) / Maniobras (%) / Flete (%) | Cotizacion.jsx:683-695 | vendedor, diseno, direccion | Ajustes porcentuales de la escalera de precio | Controles de ajustes de obra | visible | uxParity-cot-ajustes |
| Alertas bajo piso / requiere aprobación de Dirección | Cotizacion.jsx:662,697 | vendedor, diseno, direccion | Avisa cuando el descuento deja partidas bajo el mínimo | Banner de aprobación requerida | visible | uxParity-cot-bajo-piso |
| Imágenes de propuesta: foto de cada mueble (IA) | Cotizacion.jsx:704-705 | vendedor, diseno, direccion | Genera un render por partida para la propuesta | Generador de renders de mueble | visible | uxParity-cot-render-muebles |
| Una imagen de la oficina completa (IA) | Cotizacion.jsx:707-710 | vendedor, diseno, direccion | Render de la oficina (gated por acomodo válido) | Generador de render de oficina | visible | uxParity-cot-render-oficina |
| Ver el acomodo en 3D | Cotizacion.jsx:711 | vendedor, diseno, direccion | Salta al acomodo desde la propuesta | Acceso al acomodo | visible | uxParity-cot-ver-acomodo |
| Subir / quitar imagen propia de propuesta | Cotizacion.jsx:720-726 | vendedor, diseno, direccion | Reemplaza el render por una imagen subida | Uploader de imagen de propuesta | secundario | uxParity-cot-imagen-propia |
| Aviso "acomodo no certificado para cliente" | Cotizacion.jsx:727-732 | vendedor, diseno, direccion | El plano/3D se omite del PDF hasta validarlo | Banner de acomodo no certificado | visible | uxParity-cot-acomodo-no-cert |
| Propuesta premium cliente (portada/resumen/distribución/totales/condiciones) | Cotizacion.jsx:736-900 | vendedor, diseno, direccion | Documento final cliente-safe que imprime | Documento de propuesta | visible | uxParity-cot-propuesta-premium |
| Escalera de totales cliente (descuento/subtotal/IVA/anticipo/saldo) | Cotizacion.jsx:843-868 | vendedor, diseno, direccion | Totales desde una sola función (misma que PDF y guardado) | Bloque de totales | visible | uxParity-cot-totales |
| Gate de emisión (estado + razones + lenguaje claro) | Cotizacion.jsx:946-981 · emisionUX.js:71-76 | vendedor, diseno, direccion | Explica si se puede emitir y qué falta (server-side, seller-safe) | Panel de estado de emisión | visible | uxParity-cot-gate-emision |
| Solicitar aprobación a Dirección + motivo | Cotizacion.jsx:963-977 | vendedor | Manda la versión exacta a Dirección por descuento/precio bajo piso | Flujo de solicitud de aprobación | visible | uxParity-cot-solicitar-aprobacion |
| Verificar emisión | Cotizacion.jsx:928-930 | vendedor, diseno, direccion | Consulta el gate del servidor bajo demanda | Botón verificar | secundario | uxParity-cot-verificar |
| Guardrail de exclusiones + checkbox obligatorio | Cotizacion.jsx:984-993 | vendedor, diseno, direccion | Confirma que N piezas NO se cotizan (las pone el cliente) antes de emitir | Confirmación de exclusiones | visible | uxParity-cot-excluidas |
| "¿Por qué no puedo emitir?" diagnóstico | Cotizacion.jsx:994-1018 | vendedor, diseno, direccion | Lista bloqueos con por qué y cómo arreglar | Diagnóstico de emisión | visible | uxParity-cot-porque-no-emito |
| Descargar PDF / Descargar BORRADOR | Cotizacion.jsx:294-328,919-921 | vendedor, diseno, direccion | Genera PDF definitivo solo con gate ALLOWED + revisión registrada; si no, borrador | CTA descargar con estado | visible | uxParity-cot-descargar-pdf |
| Imprimir (impresión del navegador) | Cotizacion.jsx:334-357,923 | vendedor, diseno, direccion | Abre impresión; marca BORRADOR si no es definitivo | Acción imprimir | secundario | uxParity-cot-imprimir |
| Confirmar candado (ConfirmarCandado) | Cotizacion.jsx:1019-1025 | vendedor, diseno, direccion | Confirma partidas antes de una acción sensible | Modal de confirmación | secundario | uxParity-cot-candado |
| Tabs Comercial: Hoy / Proyectos / Productos / Dirección | comercial/Comercial.jsx:210-226 | vendedor (todas menos Dirección), direccion/diseno (Dirección) | Sub-navegación de la superficie de venta | Shell comercial con tabs | visible | uxParity-comercial-tabs |
| Hoy: tarjetas que necesitan atención + abrir | comercial/Comercial.jsx:37-69 | vendedor, diseno, direccion | Pendientes reales derivados de proyectos/cotizaciones | Bandeja "Hoy" | visible | uxParity-comercial-hoy |
| Dirección: KPIs, pipeline por etapa, motivos de pérdida | comercial/Comercial.jsx:73-122 | direccion, diseno | Hechos de negocio (ganadas/perdidas/monto), sin estimaciones | Tablero Dirección | secundario | uxParity-comercial-direccion |
| Nuevo proyecto (alta cliente + proyecto) | comercial/Comercial.jsx:125-168 | vendedor, diseno, direccion | Crea cliente y proyecto con brief/presupuesto | Alta de proyecto | visible | uxParity-comercial-nuevo-proyecto |
| Lista de proyectos + abrir | comercial/Comercial.jsx:171-202 | vendedor, diseno, direccion | Lista proyectos y marca los sin próxima acción | Lista de proyectos | visible | uxParity-comercial-lista-proyectos |
| Producto Maestro: buscar + filtrar por fuente | comercial/ProductoMaestro.jsx:51-55 | vendedor, diseno, direccion | Busca los 1931 productos por nombre/código y fuente | Buscador de catálogo | visible | uxParity-producto-buscar |
| Producto Maestro: lista con precio autorizado / no cotizable | comercial/ProductoMaestro.jsx:61-89 | vendedor, diseno, direccion | Muestra precio de lista vigente; marca no cotizable si no hay | Lista de productos con precio | visible | uxParity-producto-precio |
| Workspace proyecto: header + KPIs (total/presupuesto/diferencia/próx. acción) | comercial/ProyectoWorkspace.jsx:54-68 | vendedor, diseno, direccion | Encabezado con cifras del proyecto | Header de workspace | visible | uxParity-ws-header |
| Workspace: Solución (reconciliación/layout/renders) + abrir acomodo | comercial/ProyectoWorkspace.jsx:115-180 | vendedor, diseno, direccion | Reúne alcance por zona, layout y renders del proyecto | Sección Solución | secundario | uxParity-ws-solucion |
| Workspace: cotizaciones del proyecto + abrir | comercial/ProyectoWorkspace.jsx:182-195 | vendedor, diseno, direccion | Lista las cotizaciones ligadas y salta a ellas | Sección Cotización | visible | uxParity-ws-cotizaciones |
| Workspace: Escenarios (esencial/recomendada/premium/custom) + seleccionar | comercial/ProyectoWorkspace.jsx:197-224 | vendedor, diseno, direccion | Crea y selecciona escenarios dentro del mismo proyecto | Sección Escenarios | visible | uxParity-ws-escenarios |
| Workspace: Deal Desk (resolver aprobaciones) | comercial/ProyectoWorkspace.jsx:226-268 | direccion | Aprueba/rechaza solicitudes de descuento (ligadas al hash de revisión) | Sección Deal Desk | secundario | uxParity-ws-dealdesk |
| Workspace: Presupuesto/VE (palancas + ranking) | comercial/ProyectoWorkspace.jsx:270-315 | direccion, diseno | Cuánto falta bajar y dónde rinde; no inventa ahorros | Sección ingeniería de valor | secundario | uxParity-ws-ve |
| Workspace: Revisiones (diff Rev1→Rev2) | comercial/ProyectoWorkspace.jsx:317-352 | direccion, diseno | Compara dos revisiones emitidas (Rev1 inmutable) | Sección Revisiones | secundario | uxParity-ws-diff |
| Workspace: Actividad (próxima acción + nota/timeline) | comercial/ProyectoWorkspace.jsx:354-388 | vendedor, diseno, direccion | Define próxima acción y registra actividad | Sección Actividad | visible | uxParity-ws-actividad |
| Workspace: Cierre ganada/perdida + motivo | comercial/ProyectoWorkspace.jsx:390-464 | direccion, diseno | Cierra el proyecto eligiendo la cotización ganadora o motivo de pérdida | Sección Cierre | visible | uxParity-ws-cierre |
| Presentar al cliente ▸ (5 etapas) | comercial/ProyectoWorkspace.jsx:60 · comercial/PresentarCliente.jsx:70-139 | vendedor, diseno, direccion | Presentación a pantalla completa client-safe (necesidad→inversión) | Modo presentación de proyecto | visible | uxParity-presentar-cliente |
| Presentación: navegación atrás/siguiente/terminar + gate client-safe | comercial/PresentarCliente.jsx:47-67 | vendedor, diseno, direccion | Avanza etapas; bloquea si el payload no es cliente-safe | Navegación de presentación | secundario | uxParity-presentar-nav |

### Estados internos mostrados crudos (materia prima del mapa "lenguaje humano")
- **PRELIMINAR** (badge de acomodo borrador) — AcomodoBase.jsx:1596; también AsistenteEspecial.jsx:1303.
- **Diagnóstico `codigo`** del motor (causa de no-colocación) como `<code>` + **huella_fuente** (fuente de la medida) — AcomodoBase.jsx:1545-1546.
- **Veredicto del acomodo**: `data-estado` = PASS/FALLA/PARCIAL y `data-bloque` = geometria/colisiones/programa/anclas/semantica/evidencia/publicable (títulos humanizados, pero el código va en los atributos) — AcomodoBase.jsx:1635-1641.
- **layoutEstado**: STALE_PROGRAM / PROGRAM_INCOMPLETE / LAYOUT_VALID (se guarda y viaja al PDF/gate) — Acomodo.jsx:117,193; AcomodoBase.jsx:382,1158,1195,1204.
- **Gate de emisión**: ALLOWED / BLOCKED / APPROVAL_REQUIRED / ECONOMICS_INCOMPLETE / DESCONOCIDO (títulos humanizados en ESTADO_EMISION, pero el código es el que manda) — Cotizacion.jsx:950 · emisionUX.js:71-76.
- **Motivos de gate crudos** tipo `partidas_no_corresponden`, `sin_guardar` (pueden llegar sin traducir a `gateRazones`) — Cotizacion.jsx:957-960 (visto en Cotizacion.estadoLinea.test.js:43).
- **RenderChip** (interno Dirección): VIGENTE / PENDIENTE_VALIDACION / STALE ("histórico (stale)") / SIN_RENDER_VALIDO / SIN_VERSION — Cotizacion.jsx:95-99,127.
- **Procedencia de partida**: CONFIRMADO / INFERIDO / SUPUESTO / SUGERIDO / REQUIERE_DESARROLLO (se humaniza, pero son estados del motor) — EstoEntendi.jsx:66-73.
- **Nivel de lectura**: alta / media / baja / **nula** + `data-estado` = `resumen.servidor.estado` del request de lectura — ConfirmarLectura.jsx:26,40.
- **plan.estado NO_EVALUABLE** y `motivo PRESUPUESTO_DESCONOCIDO` (ingeniería de valor) — comercial/ProyectoWorkspace.jsx:288-289.
- **Estado de aprobación crudo** ("Aprobación #id · {a.estado}") — comercial/ProyectoWorkspace.jsx:255.
- **Tipo de atención crudo** SIN_PROXIMA_ACCION (solo con `replaceAll('_',' ')`) — comercial/Comercial.jsx:59-60.
- **Etapa de proyecto cruda** GANADA / PERDIDA — comercial/ProyectoWorkspace.jsx:424-426.
- **source_type** linea/banco/expediente (humanizado a Línea/Banco/Expediente/Catálogo) — comercial/ProductoMaestro.jsx:13-15.


## 4. COCREAR + VONI + Admin/Infra

> **Versión activa de Cocrear: CocrearV3.** `src/componentes/Cocrear.jsx` es una sola línea de re-export (`export { default } from './CocrearV3.jsx'`, Cocrear.jsx:1) y `App.jsx:19` hace `lazy(() => import('./componentes/Cocrear.jsx'))`. **No hay flag** que elija versión de Cocrear: `src/datos/flags.js` no define ninguna bandera `cocrear_*`; las banderas relacionadas (`render_v2`, `voni_2`, `costing_ai_v2`, `plan_reader_v2`) no cambian la versión de Cocrear. Por tanto la selección es por import directo, codificada, no por flag.
> **Variantes (NO montadas hoy):** `CocrearV2.jsx` = variante legacy (sólo referenciada en tests, nunca importada por App). `CocrearVisual.jsx` + `Orbit3D.jsx` = sub-componentes **VIVOS** que CocrearV3 usa para el 3D (CocrearV3:20,548,560). `MiniRender.jsx` y `PropuestaViva.jsx` = usados por Costeador/AsistenteEspecial/FichaPDF y por AcomodoBase respectivamente — **no por Cocrear**.
> **Exclusivo de Dirección:** Tablero (financieros), Usuarios, Aprobaciones pendientes, CargaERP, aprobar precios. **Diseño+Dirección (`veCostos`):** Costear desde cero (`especial`), Biblioteca, editar Reglas, ver costos en Cocrear/Costeador, "Pasar/Afinar a Costear", validar ingeniería. **Compras:** ciertos precios de insumo marcados "requieren Compras" NO se pueden aprobar en la app (AsistenteEspecial:1553). **Vendedor:** Cocrear y Voni sí (seller-safe, sin costo/margen); el Asistente de costeo por pieza lo redirige a Voni.

| función actual | dónde vive (componente:línea aprox) | quién la usa (rol) | qué hace (1 frase) | nuevo lugar UX propuesto | visible/secundario/técnico | test de paridad propuesto (nombre) |
|---|---|---|---|---|---|---|
| **COCREAR — fase inicio** | | | | | | |
| Textarea "¿Qué quieres crear?" | CocrearV3.jsx:539 | todos | Describe en texto la idea/problema a cocrear | Cocrear · pantalla de entrada, campo grande centrado | visible | uxParity-cocrearIdeaTextarea |
| Chips de ejemplos (prefill) | CocrearV3.jsx:539 | todos | Rellenan el textarea con briefs de muestra | debajo del textarea | secundario | uxParity-cocrearEjemplos |
| "Crear conceptos con VONI →" | CocrearV3.jsx:539,254 (analizarIdea) | todos | Manda el brief a VONI Council y genera 3 conceptos | botón primario entrada | visible | uxParity-cocrearAnalizarIdea |
| "Empezar desde cero" | CocrearV3.jsx:539,293 (desdeCero) | todos | Entra al studio con base libre sin conceptos IA | botón secundario entrada | secundario | uxParity-cocrearDesdeCero |
| Subir imagen de referencia | CocrearV3.jsx:110,351 (onReferencia) | todos | Carga foto/boceto/render del cliente (viaja a Costear y se guarda) | zona de carga en entrada y studio | visible | uxParity-cocrearReferenciaImagen |
| Lista "Guardadas" + reabrir | CocrearV3.jsx:539,436 (reabrir) | todos | Lista co-creaciones guardadas y reabre su expediente | galería de tarjetas | visible | uxParity-cocrearReabrirGuardada |
| Reintentar carga de guardadas | CocrearV3.jsx:539 | todos | Reintenta listar co-creaciones tras error de red | inline en error | secundario | uxParity-cocrearGuardadasReintento |
| **COCREAR — fase conceptos** | | | | | | |
| Aviso "es un PROYECTO" → Cotizador por plano | CocrearV3.jsx:541 (detectarAlcanceCocrear) | todos | Detecta alcance de proyecto completo y ofrece ir al Cotizador IA | banner superior conceptos | visible | uxParity-cocrearAlcanceProyecto |
| Panel "Lo que entendimos" | CocrearV3.jsx:541 (resumenIdeaCocrear) | todos | Resume necesidad/tipología/capacidad/claves interpretadas | columna izq conceptos | visible | uxParity-cocrearResumenIdea |
| Análisis VONI Council | CocrearV3.jsx:541,64 (councilText) | todos | Muestra la síntesis multi-lente del Council | debajo del resumen | secundario | uxParity-cocrearCouncilTexto |
| Candidatos de catálogo "¿ya existe en Von Haucke?" | CocrearV3.jsx:541 | todos | Chips con líneas/productos reales que podrían resolver el brief | tarjeta sobre los conceptos | visible | uxParity-cocrearCandidatosCatalogo |
| Elegir concepto (3 tarjetas "Desarrollar →") | CocrearV3.jsx:541,286 (elegirConcepto) | todos | Fija el concepto A/B/C, entra al studio y genera render | 3 tarjetas | visible | uxParity-cocrearElegirConcepto |
| "‹ Nueva idea" (reset) | CocrearV3.jsx:541,203 | todos | Descarta todo y vuelve a la entrada | encabezado | secundario | uxParity-cocrearReset |
| **COCREAR — fase studio** | | | | | | |
| Cambiar tipología (select familia) | CocrearV3.jsx:546,295 (setFamilia) | todos | Cambia familia del producto y medidas por defecto | panel Diseño izq | visible | uxParity-cocrearTipologia |
| Personas/puestos (capacidad) | CocrearV3.jsx:546,296 (setCap) | todos | Ajusta capacidad para tipología operativa colaborativa | panel Diseño | visible | uxParity-cocrearCapacidad |
| Medidas ancho/fondo/alto | CocrearV3.jsx:546,294 (setDim) | todos | Edita dimensiones mm (crea revisión, invalida render) | panel Diseño | visible | uxParity-cocrearMedidas |
| Material (botones) | CocrearV3.jsx:546,297 (setMaterial) | todos | Elige material primario del producto | panel Diseño | visible | uxParity-cocrearMaterial |
| Tono (claro/natural/oscuro) | CocrearV3.jsx:546,298 (setTone) | todos | Fija el tono del material | panel Diseño | visible | uxParity-cocrearTono |
| Funciones (toggle features) | CocrearV3.jsx:546,299 (toggleFeature) | todos | Agrega/quita características (jardinera, acústica, electrif.) | panel Diseño | visible | uxParity-cocrearFunciones |
| Render IA generar/regenerar | CocrearV3.jsx:560,227 (generarPara) | todos | Genera render fotográfico usando el 3D canónico como referencia de geometría | centro studio | visible | uxParity-cocrearRenderIA |
| Aviso render VENCIDO (stale) | CocrearV3.jsx:560,167 (rStale) | todos | Marca el render como desactualizado cuando cambia la revisión | banda sobre el render | visible | uxParity-cocrearRenderStale |
| Modelo canónico 3D (Concepto/Despiece/4D + slider) | CocrearVisual.jsx:97,122,136; Orbit3D | todos | Visor 3D conceptual/técnico explotado/secuencia 4D de la revisión | centro studio | visible | uxParity-cocrearVisual3D |
| Girar/zoom/restablecer 3D | Orbit3D.jsx:54-73 | todos | Arrastra para girar, rueda para zoom, botones −/+/↺ | sobre el visor 3D | visible | uxParity-orbit3DControles |
| Historial de revisiones (R1,R2…) | CocrearV3.jsx:560 | todos | Vuelve a ver una revisión pasada (invalida render) | tira bajo el render | secundario | uxParity-cocrearHistorialRev |
| Comparar A/B | CocrearV3.jsx:544,548,178 (compararVariantesProducto) | todos (Δcosto sólo veCostos) | Compara dos variantes lado a lado (piezas/material/costo Δ) | centro studio, modo A/B | secundario | uxParity-cocrearCompararAB |
| Guardar co-creación | CocrearV3.jsx:544,435 (guardar) | todos | Guarda el expediente (sube render/referencia a Storage) | encabezado studio | visible | uxParity-cocrearGuardar |
| VONI Co-diseñador (cambio en lenguaje natural) | CocrearV3.jsx:562,409 (pedirVoni) | todos | Pide un cambio en texto; si es determinista cambia el modelo canónico | columna der studio | visible | uxParity-cocrearVoniCodisenador |
| VONI Industrial · desarrollo (diagnóstico) | CocrearV3.jsx:563,170 (diagnosticoDesarrolloProducto) | todos | Métricas de repetibilidad/estandarización y oportunidades (hipótesis) | columna der | secundario | uxParity-cocrearDesarrolloIndustrial |
| Bajar a BOM · A: escalar mueble de línea | CocrearV3.jsx:596-601,312 (bajarDesdeLinea) | todos | Parte de un producto de catálogo y escala su despiece a las medidas | columna der, "Bajar a BOM" | visible | uxParity-cocrearBajarLinea |
| Bajar a BOM · B: Pasar a Costear (mueble nuevo) | CocrearV3.jsx:603-606,322 (pasarACostear) | Diseño/Dirección | Lleva semilla (nombre/medidas/materiales/imagen) al asistente de Costear y regresa con despiece | columna der | visible | uxParity-cocrearPasarACostear |
| Quitar BOM | CocrearV3.jsx:585,592,319 (quitarBom) | todos | Elimina el despiece; vuelve a "pendiente de BOM" | con BOM cargado | secundario | uxParity-cocrearQuitarBom |
| Afinar en Costear (con BOM) | CocrearV3.jsx:592,322 | Diseño/Dirección | Reabre el despiece existente en Costear | con BOM cargado | secundario | uxParity-cocrearAfinarCostear |
| Dificultad de fabricación (Alba V1) | CocrearV3.jsx:610-612,320 (setDificultad) | todos | Fija multiplicador de dificultad (radiogroup) | columna der | visible | uxParity-cocrearDificultad |
| Panel "Verdad industrial" (costo/estado/servidor) | CocrearV3.jsx:614 | todos (costo sólo veCostos) | Muestra costo local preview, estado motor, estado servidor, precio sugerido, ingeniería | columna der | visible | uxParity-cocrearVerdadIndustrial |
| Costear en el servidor | CocrearV3.jsx:615,391 (costearEnServidor) | todos | Guarda la revisión y pide al servidor el costo/precio oficial | columna der | visible | uxParity-cocrearCostearServidor |
| "Cómo llegó VONI a este costo" (explicación) | CocrearV3.jsx:617,28 (explicarCosteo) | Diseño/Dirección | Desglose material/MO/GI/merma/insumos del costo | details plegable | secundario | uxParity-cocrearExplicacionCosteo |
| Validar ingeniería de esta revisión | CocrearV3.jsx:639,453 (validarIngenieria) | Diseño/Dirección | Pide al servidor validar ingeniería (rol, costo emitible, estructura, misma revisión) | columna der | visible | uxParity-cocrearValidarIngenieria |
| Estimado de diseño (evidencia parcial) | CocrearV3.jsx:641,169 (estimadoDisenoCocrear) | Diseño/Dirección | Estima costo parcial por partidas cuando no hay costo cierto | columna der | secundario | uxParity-cocrearEstimadoDiseno |
| Referencia comercial real (precios comparables) | CocrearV3.jsx:643,168 (formatearReferenciaCocrear) | todos | Muestra rango de precios de productos comparables vigentes | columna der | secundario | uxParity-cocrearReferenciaComercial |
| Aviso "precio por DEBAJO del padre" | CocrearV3.jsx:590,475 (referenciaPadre) | todos | Advierte si el especial queda bajo el precio de lista del padre | panel BOM | secundario | uxParity-cocrearDebajoDelPadre |
| Convertir en partida | CocrearV3.jsx:645,492 (agregarCotizacion) | todos (precio del servidor) | Registra el producto canónico y lo agrega como partida a la cotización | columna der, botón final | visible | uxParity-cocrearConvertirPartida |
| CocrearV2 (variante legacy) | CocrearV2.jsx:45 | — (no montado) | Studio A/B simplificado anterior; sólo vive en tests | n/a | técnico | uxParity-cocrearV2Legacy |
| MiniRender (render isométrico por tipo) | MiniRender.jsx:141 | Diseño/Dirección | Dibuja mueble isométrico paramétrico (Costeador/AsistenteEspecial/FichaPDF, no Cocrear) | n/a a Cocrear | técnico | uxParity-miniRenderIsometrico |
| PropuestaViva (presentación cliente) | PropuestaViva.jsx:44 | todos | Vista pantalla completa de la propuesta (usada por AcomodoBase, no Cocrear) | n/a a Cocrear | visible | uxParity-propuestaVivaPresentacion |
| **VONI — asistente de proyecto (pestaña `voni`)** | | | | | | |
| Nombre del cliente | Voni.jsx:313 | todos | Captura el cliente del proyecto | encabezado Voni | visible | uxParity-voniCliente |
| Navegación de 4 pasos (Espacio/Muebles/Acomodo/Propuesta) | Voni.jsx:45,318 (Pasos) | todos | Stepper que marca hecho sólo lo realizado y permite saltar | barra de pasos | visible | uxParity-voniPasos |
| Paso 1 · subir plano | Voni.jsx:333,149 (subirPlanoAqui) | todos | Lee plano PDF/imagen/dwg y saca áreas | paso 1 | visible | uxParity-voniSubirPlano |
| Paso 1 · confirmar lectura del plano | Voni.jsx:346,157 (confirmarLectura) | todos | La persona confirma/corrige áreas detectadas antes de usarlas | compuerta ConfirmarLectura | visible | uxParity-voniConfirmarLectura |
| Paso 1 · EmpezarEspacio (dibujar/listo/omitir) | Voni.jsx:352,359 | todos | Dibujar espacio a mano, continuar, o empezar por muebles | paso 1 | visible | uxParity-voniEmpezarEspacio |
| Paso 2 · describir con CotizadorIA | Voni.jsx:487 | todos | Describe en palabras qué muebles lleva y VONI arma renglones | paso 2 (formulario) | visible | uxParity-voniDescribir |
| Paso 2 · Programa detectado del plano (aplicar) | Voni.jsx:388,466 | todos | Propone productos reales del catálogo según el plano; agrega sólo lo que falta | tarjeta programa | visible | uxParity-voniProgramaDetectado |
| Recomendaciones de casa (agregar) | Voni.jsx:402 | todos | Sugiere por regla de casa (visitas, credenzas) sin agregarlas solas | tarjeta programa | secundario | uxParity-voniRecomendacionesCasa |
| Fusionar duplicados del programa | Voni.jsx:414 | todos | Une muebles descritos con el genérico del programa (no duplica) | tarjeta programa | secundario | uxParity-voniDuplicados |
| Ambiguas: decidir zona / repartir | Voni.jsx:422 | todos | La persona decide a qué lugar va un mueble que cubre varios | tarjeta programa | visible | uxParity-voniAmbiguas |
| Conflicto de programa (conservar/sustituir/ambos) | Voni.jsx:85,454 (ConflictoPrograma) | todos | Resuelve choque entre mueble existente y el que propone el plano | tabla comparativa | visible | uxParity-voniConflictoPrograma |
| Piloto automático (aviso) | Voni.jsx:260,383 | todos | Fusiona/vincula lo no aditivo del plano automáticamente y lo avisa | banner paso 2 | secundario | uxParity-voniPilotoAutomatico |
| Revisar "esto entendí" (cantidad/quitar/editar/variante) | Voni.jsx:532 (EstoEntendi) | todos | Lista editable de muebles entendidos con cantidad, variante y precio | paso 2 (revisar) | visible | uxParity-voniEstoEntendi |
| Vaciar proyecto | Voni.jsx:516,186 | todos | Borra todos los muebles y el acomodo (con confirmación) | paso 2 | secundario | uxParity-voniVaciar |
| Editar partida | Voni.jsx:591 (EditarPartida) | todos | Abre el editor de una partida | modal | visible | uxParity-voniEditarPartida |
| Candado cantidad/usuarios al avanzar | Voni.jsx:294,583 (ConfirmarCandado) | todos | Pide confirmación si una cantidad/usuarios es ambigua antes de avanzar | modal | visible | uxParity-voniCandadoAvanzar |
| Paso 3 · Acomodo | Voni.jsx:611 (Acomodo) | todos | Acomoda cada mueble en el espacio | paso 3 | visible | uxParity-voniAcomodo |
| Paso 4 · Propuesta | Voni.jsx:629 (Cotizacion) | todos | Muestra la cotización lista para el cliente | paso 4 | visible | uxParity-voniPropuesta |
| **VONI 2.0 — panel global** | | | | | | |
| FAB "Voni" (abrir panel) | App.jsx:1515-1527 (flag `voni_2`) | todos | Botón flotante en cualquier ruta que abre el panel global | esquina flotante | visible | uxParity-voni2Fab |
| Preguntar (campo + enviar) | Voni2.jsx:69,39 (preguntar) | todos (respeta rol) | Pregunta determinista sobre readiness/gaps del proyecto | panel lateral | visible | uxParity-voni2Preguntar |
| Sugerencias (chips) | Voni2.jsx:74,36 | todos | Atajos de preguntas frecuentes según contexto/ruta | panel lateral | secundario | uxParity-voni2Sugerencias |
| Guía de ruta | Voni2.jsx:63,37 (guiaRuta) | todos | Explica qué hacer en la pantalla actual | panel lateral | secundario | uxParity-voni2GuiaRuta |
| Respuesta (estado/pendientes/acción/evidencia/confianza) | Voni2.jsx:81-137 | todos | Tarjeta de veredicto con bloqueos, siguiente paso y evidencia | panel lateral | visible | uxParity-voni2Respuesta |
| Cerrar (Esc / botón) | Voni2.jsx:51,60 | todos | Cierra el panel | panel lateral | secundario | uxParity-voni2Cerrar |
| VoniAvatar (personaje) | VoniAvatar.jsx:12 | todos | Imagen oficial de Voni (cara/cuerpo, anim bob) | varios | técnico | uxParity-voniAvatar |
| **ASISTENTE — cotizar un mueble** | | | | | | |
| Flujo 6 pasos familia→mueble→opción→cantidad→precio→listo | Asistente.jsx:16,147 | Diseño/Dirección | Cotiza una pieza guiado paso a paso con botones grandes | pantalla única por pasos | visible | uxParity-asistenteFlujoPasos |
| Escoger familia/mueble/línea | Asistente.jsx:93-102 | Diseño/Dirección | Selecciona qué mueble y de qué línea (precio por línea) | pasos 1-3 | visible | uxParity-asistenteEscoger |
| Cantidad / personas (bench) | Asistente.jsx:215,104 | Diseño/Dirección | Fija cantidad o personas del bench | paso 4 | visible | uxParity-asistenteCantidad |
| Margen (Poco/Normal/Bueno/Mucho) | Asistente.jsx:249 | Diseño/Dirección | Escoge cuánto ganar sobre el costo | paso 5 | visible | uxParity-asistenteMargen |
| Ver detalle (HojaCosto) | Asistente.jsx:275 | Diseño/Dirección | Despliega de dónde sale el precio | paso 5 | secundario | uxParity-asistenteVerDetalle |
| Agregar a la cotización | Asistente.jsx:282,117 | Diseño/Dirección | Agrega la pieza con su precio (fail-closed sin precio) | paso 5 | visible | uxParity-asistenteAgregar |
| Ver ficha PDF | Asistente.jsx:284 (FichaPDF) | Diseño/Dirección | Genera ficha PDF de la pieza | paso 5 | secundario | uxParity-asistenteFichaPDF |
| Redirección seller-safe a Voni | Asistente.jsx:134 | vendedor | Bloquea costeo por pieza y manda al vendedor a Voni | pantalla completa | visible | uxParity-asistenteSellerSafe |
| **ASISTENTE ESPECIAL — costear desde cero/PDF** | | | | | | |
| ¿Qué vas a costear? (describir) | AsistenteEspecial.jsx:1040,1059 | Diseño/Dirección | Nombre + descripción del mueble para alimentar IA y render | pantalla costear | visible | uxParity-especialDescribir |
| Subir render o plano (PDF) → analizar IA | AsistenteEspecial.jsx:1044-1049,882 | Diseño/Dirección | Sube imagen/PDF y la IA propone despiece | atajo de carga | visible | uxParity-especialSubirAnalizar |
| ¿Cuántas piezas iguales? | AsistenteEspecial.jsx:1084 | Diseño/Dirección | Fija cantidad de piezas idénticas | formulario | visible | uxParity-especialCantidad |
| ¿De qué está hecho? (materiales) | AsistenteEspecial.jsx:1096 | Diseño/Dirección | Selecciona materiales/acabado del producto | formulario | visible | uxParity-especialMateriales |
| Centro de preguntas IA (responder / No sé) | AsistenteEspecial.jsx:1166-1230,801 (responderDespiece) | Diseño/Dirección | Contesta preguntas de la IA para afinar y re-costear el despiece | tarjeta de preguntas | visible | uxParity-especialPreguntasIA |
| Costo del motor + por confirmar | AsistenteEspecial.jsx:1452 | Diseño/Dirección | Muestra costo calculado y materiales por confirmar | panel de costo | visible | uxParity-especialCosto |
| Precios por aprobar (validar con servidor) | AsistenteEspecial.jsx:1521,1524,399 | Dirección | Revalida con el servidor si el costo es emitible/aprobable | panel precios | visible | uxParity-especialValidarServidor |
| Aprobar precios como Dirección | AsistenteEspecial.jsx:1537-1547,1542 (aprobarPrecio) | Dirección | Aprueba precios exactos con nombre y fecha | panel precios | visible | uxParity-especialAprobarPrecios |
| Precios que requieren Compras (no aprobable) | AsistenteEspecial.jsx:1553 | Compras | Marca precios que sólo Compras puede aprobar | aviso panel precios | secundario | uxParity-especialPreciosCompras |
| Generar render (aislado + ambiente) | AsistenteEspecial.jsx:1564,1583 (generarRenders) | Diseño/Dirección | Genera render del producto definido; marca DESACTUALIZADO si cambia el BOM | sección render | visible | uxParity-especialGenerarRender |
| Guardar / actualizar / duplicar en biblioteca | AsistenteEspecial.jsx:1601,1634,1636 | Diseño/Dirección | Guarda el expediente (plano/BOM/costo/render) y permite duplicar | sección biblioteca | visible | uxParity-especialGuardarBiblioteca |
| Aprobar expediente (validar servidor) | AsistenteEspecial.jsx:1618-1630 | Dirección | Valida con el servidor y marca el expediente aprobado | sección biblioteca | visible | uxParity-especialAprobarExpediente |
| Ver detalle completo (Alba V1) → Costeador | AsistenteEspecial.jsx:1650 (onVerDetalle) | Diseño/Dirección | Abre el costeo en el Modo avanzado (Costeador) | botón final | visible | uxParity-especialVerDetalleCosteador |
| InformeIA (tablero de secciones) | AsistenteEspecial.jsx:1281; InformeIA.jsx:49 | Diseño/Dirección | Presenta el informe IA como tarjetas + cifras del motor | panel informe | secundario | uxParity-informeIAtablero |
| "Viene de Cocrear": analizar imagen de referencia | AsistenteEspecial.jsx:1027-1030,549 | Diseño/Dirección | Analiza la imagen que llegó de Cocrear (puente) | banner superior | visible | uxParity-especialDesdeCocrear |
| Regresar a Cocrear con el despiece | AsistenteEspecial.jsx:563 (onVolverCocrear) | Diseño/Dirección | Devuelve el BOM a Cocrear como revisión nueva | botón volver | visible | uxParity-especialVolverCocrear |
| **BIBLIOTECA — productos ya costeados** | | | | | | |
| Buscar biblioteca | Biblioteca.jsx:47,20 (recargar) | Diseño/Dirección | Busca expedientes por nombre/etiqueta | buscador | visible | uxParity-bibliotecaBuscar |
| Abrir expediente | Biblioteca.jsx:29,65 | Diseño/Dirección | Abre el expediente en Costear para ver/editar/re-costear | tarjeta | visible | uxParity-bibliotecaAbrir |
| + Nuevo producto | Biblioteca.jsx:49 | Diseño/Dirección | Entra a Costear desde cero | botón | visible | uxParity-bibliotecaNuevo |
| Mostrar pruebas (QA/RC) | Biblioteca.jsx:53 | Diseño/Dirección | Muestra/oculta expedientes de prueba | checkbox | secundario | uxParity-bibliotecaMostrarPruebas |
| Ir a inicio | Biblioteca.jsx:42 | Diseño/Dirección | Regresa al inicio | botón | secundario | uxParity-bibliotecaInicio |
| **ARCHIVO — presupuestos que ya hicimos** | | | | | | |
| Descargar respaldo local | Archivo.jsx:85,40 (exportarRespaldo) | todos (contenido por rol) | Exporta a JSON lo abierto (con/sin economía según rol) | tarjeta respaldo | visible | uxParity-archivoDescargarRespaldo |
| Restaurar respaldo | Archivo.jsx:87,46 (restaurarRespaldo) | todos | Reemplaza la cotización actual con un respaldo (pregunta antes) | tarjeta respaldo | visible | uxParity-archivoRestaurarRespaldo |
| Buscar presupuestos | Archivo.jsx:99,72 | todos | Busca por cliente/folio/mueble entre todas las cotizaciones | buscador | visible | uxParity-archivoBuscar |
| Abrir presupuesto | Archivo.jsx:145 (onAbrir→App:1394) | todos | Trae la cotización completa al proyecto actual | tarjeta | visible | uxParity-archivoAbrir |
| Sacar de la lista (archivar) | Archivo.jsx:147 | todos | Marca inactiva la cotización (no la borra) | tarjeta | secundario | uxParity-archivoSacarLista |
| Aviso "la MP cambió" | Archivo.jsx:136 (mpCambio) | todos | Advierte re-costear si subió la materia prima | tarjeta | secundario | uxParity-archivoMpCambio |
| Ver emisiones + PDF de una revisión | Archivo.jsx:167,192 | todos | Lista emisiones conservadas y reimprime el PDF desde su snapshot | tarjeta expandible | visible | uxParity-archivoEmisionesPDF |
| **ADMIN · TABLERO (Dirección)** | | | | | | |
| Franja de KPIs | Tablero.jsx:80 | Dirección | Costeado, margen prom., desperdicio, costo hora | encabezado tablero | visible | uxParity-tableroKPIs |
| Alertas (bajo margen / precios viejos) | Tablero.jsx:66-95 | Dirección | Alertas accionables (abrir precios) | tablero | visible | uxParity-tableroAlertas |
| Gráficas (composición/desperdicio/lote) | Tablero.jsx:104,126,143 | Dirección | Visualiza composición del costo, desperdicio y curva por lote | tablero | visible | uxParity-tableroGraficas |
| Tabla últimas piezas | Tablero.jsx:159 | Dirección | Costo/precio/margen de las últimas piezas | tablero | secundario | uxParity-tableroUltimasPiezas |
| Salud del negocio (financieros) | Tablero.jsx:186 | Dirección | Margen bruto y utilidad de operación (de `direccion`) | tablero | visible | uxParity-tableroSaludNegocio |
| **ADMIN · REGLAS (lo que Voni sabe)** | | | | | | |
| Lista de reglas por ámbito | Reglas.jsx:148 | lectura: todos | Muestra reglas de oficio que el motor/Voni aplican | lista por secciones | visible | uxParity-reglasLista |
| Enseñar / cambiar / quitar regla | Reglas.jsx:84,167,182 (Editor) | Diseño/Dirección | Dicta, edita o borra una regla (con clave/valor opcional) | editor | visible | uxParity-reglasEditar |
| "Lo que ha aprendido sola" | Reglas.jsx:93 | lectura: todos | Muestra lecciones aprendidas de proyectos | lista | secundario | uxParity-reglasAprendido |
| Aprobar / descartar lecciones pendientes | Reglas.jsx:101-116 | Diseño/Dirección | Aprueba o descarta lo que un vendedor anotó antes de que Voni lo use | tarjeta pendientes | visible | uxParity-reglasAprobarLeccion |
| Convertir lección en regla / que la olvide | Reglas.jsx:128-139 | Diseño/Dirección | Promueve una lección a regla o la elimina | acciones por lección | secundario | uxParity-reglasConvertirOlvidar |
| **ADMIN · USUARIOS (Dirección)** | | | | | | |
| Dar de alta a alguien | Usuarios.jsx:109,35 (agregar) | Dirección | Crea usuario con nombre/correo/contraseña/rol | formulario | visible | uxParity-usuariosAlta |
| Contraseña de una sola vez | Usuarios.jsx:131 | Dirección | Muestra la contraseña una vez para compartirla (no se guarda) | tarjeta ámbar | visible | uxParity-usuariosPasswordUnaVez |
| Cambiar rol | Usuarios.jsx:167,64 (cambiarRol) | Dirección | Cambia el rol (abre/cierra datos) sin dar de baja | select en tabla | visible | uxParity-usuariosCambiarRol |
| Quitar usuario | Usuarios.jsx:176,81 (eliminar) | Dirección | Da de baja el acceso (con confirmación) | tabla + diálogo | visible | uxParity-usuariosQuitar |
| Lista de acceso | Usuarios.jsx:151 | Dirección | Tabla de quién puede entrar y con qué rol | tabla | visible | uxParity-usuariosLista |
| **ADMIN · APROBACIONES (Dirección)** | | | | | | |
| Lista + aprobar/rechazar | AprobacionesPendientes.jsx:41,23 | Dirección | Aprueba/rechaza la versión exacta que un vendedor pidió | tarjeta (dentro de Archivo) | visible | uxParity-aprobacionesPendientes |
| **INFRA no destructiva · Conflicto de guardado** | | | | | | |
| "Ver la versión del servidor" | ConflictoGuardado.jsx:35; App.jsx:644 | todos | Respalda lo local y carga la versión del servidor | banner superior | visible | uxParity-conflictoVerServidor |
| "Volver a aplicar mis cambios" | ConflictoGuardado.jsx:38; App.jsx:733 | todos | Re-guarda lo local completo encima de la versión del servidor | banner superior | visible | uxParity-conflictoReaplicar |
| **INFRA · Respaldo de conflicto** | | | | | | |
| Diferencias respaldo vs servidor | RespaldoConflicto.jsx:40 | todos | Tabla campo por campo de lo que difiere | banner persistente | visible | uxParity-respaldoDiferencias |
| "Recuperar mis cambios" | RespaldoConflicto.jsx:64; App.jsx:678 | todos | Relee el servidor y aplica tus campos encima (fusión 3 vías, pide confirmación) | banner persistente | visible | uxParity-respaldoRecuperar |
| "Descartar mi respaldo" | RespaldoConflicto.jsx:67; App.jsx:717 | todos | Borra el respaldo local (con confirmación) | banner persistente | secundario | uxParity-respaldoDescartar |
| **INFRA · otros** | | | | | | |
| Confirmar candado usuarios/cantidad | ConfirmarCandado.jsx:59 | todos | Modal que pide confirmar una cantidad/usuarios ambigua | modal | visible | uxParity-confirmarCandado |
| Loader de marca (Cargando) | Cargando.jsx:16 | todos | Spinner con avatar/logo y mensajes rotatorios durante esperas IA | overlay | técnico | uxParity-cargandoLoader |
| Análisis estructural IA (checklist + diff) | AnalisisEstructural.jsx:29; Costeador.jsx:357 (flag `costing_ai_v2`) | Diseño/Dirección | Checklist de componentes y PROPUESTA_DIFF contra el BOM (no modifica) | panel plegable en Costeador | secundario | uxParity-analisisEstructural |

