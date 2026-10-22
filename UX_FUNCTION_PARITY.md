# Matriz de paridad de UX — Von Haucke (Costeador)


**Propósito.** Esta matriz prueba, función por función, que las **FUNCIONES ANTES = FUNCIONES DESPUÉS**: el rediseño reubica cada capacidad en un nuevo lugar de la UX, pero **ninguna función se pierde ni queda implícita**. Toda fila del inventario (las 4 secciones de trabajo) aparece aquí con su destino explícito.

**Leyenda de Estado.**
- **PRESENTE** — la función sigue existiendo y es accesible; sólo cambia *dónde* o *cómo* se presenta.
- **PRESENTE · destino por consolidar** — la función se conserva, pero su nuevo lugar UX todavía está por definir (viene del panel legacy de Inicio.jsx); no hay pérdida de función, sólo consolidación pendiente del destino.

Es un rediseño **sin pérdida**: no hay ninguna fila en estado "ELIMINADA" ni "SIN DESTINO". Cada `id uxParity-*` es el ancla de su prueba de paridad.

## 1. Navegación, Home y Roles

| id (uxParity-*) | función | ANTES (dónde vive hoy) | DESPUÉS (nuevo lugar UX) | Estado | rol | visible/secundario/técnico |
|---|---|---|---|---|---|---|
| `uxParity-gate-cargando` | Pantalla "Un momento…" | App.jsx:1243 | (igual, global) | PRESENTE | todos | técnico |
| `uxParity-gate-login` | Login (sin sesión) | App.jsx:1246 → Login.jsx | (igual) | PRESENTE | todos (anónimo) | visible |
| `uxParity-gate-permiso-error` | Pantalla "No se pudo verificar tu acceso" (Reintentar / Salir) | App.jsx:1249-1262 | (igual) | PRESENTE | todos con sesión | técnico |
| `uxParity-gate-sin-acceso` | Pantalla "Todavía no tienes acceso" (Salir) | App.jsx:1264-1273 | (igual) | PRESENTE | correo no autorizado | visible |
| `uxParity-banner-rc` | Banner "LINK DE PRUEBA (RC)" | App.jsx:1278-1282 | banner global condicional | PRESENTE | todos (si `CARRIL_RC`) | técnico |
| `uxParity-header-logo-inicio` | Logo/marca del header (ir al inicio) | App.jsx:1285-1287 | header › logo | PRESENTE | todos | visible |
| `uxParity-header-carrito` | Carrito global "Mi cotización" + contador | App.jsx:1290-1294 | header › carrito persistente | PRESENTE | todos (si nPartidas>0 y no en cotización) | visible |
| `uxParity-header-nube-estado` | Indicador de conexión a la nube (punto + texto) | App.jsx:1295-1298 | header › estado de guardado | PRESENTE | todos | secundario |
| `uxParity-menu-cuenta-abrir` | Menú "Cuenta" (dropdown `details`) | App.jsx:1301-1312 | header › menú Cuenta | PRESENTE | todos | secundario |
| `uxParity-menu-cuenta-correo` | Menú Cuenta › correo del usuario | App.jsx:1307 | menú Cuenta › encabezado | PRESENTE | todos | técnico |
| `uxParity-menu-cuenta-guia` | Menú Cuenta › "Guía" | App.jsx:1308 | menú Cuenta › Guía | PRESENTE | todos | secundario |
| `uxParity-menu-cuenta-usuarios` | Menú Cuenta › "Usuarios" | App.jsx:1309 | menú Cuenta › Usuarios (sólo Dir.) | PRESENTE | **sólo Dirección** | secundario |
| `uxParity-menu-cuenta-contrasena` | Menú Cuenta › "Contraseña" | App.jsx:1310 | menú Cuenta › Contraseña | PRESENTE | todos | secundario |
| `uxParity-header-salir` | Botón "Salir" (header) | App.jsx:1313 | header › Salir | PRESENTE | todos | visible |
| `uxParity-barra-atras` | Barra "‹ Atrás" | App.jsx:1338 | barra contextual superior | PRESENTE | todos (no en inicio) | visible |
| `uxParity-barra-inicio` | Botón "Inicio" secundario (barra) | App.jsx:1339 | barra contextual › Inicio | PRESENTE | todos (no en inicio) | visible |
| `uxParity-barra-titulo` | Título de vista (NOMBRE_VISTA) | App.jsx:1340 | barra contextual › título | PRESENTE | todos | técnico |
| `uxParity-guia-abrir` | Modal Guía (onboarding / manual) | App.jsx:1345-1348 → Guia.jsx | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos (filtrado por rol) | secundario |
| `uxParity-toast-aviso` | Toast "¡Listo!" / avisos | App.jsx:1511 | toast global | PRESENTE | todos | secundario |
| `uxParity-voni-fab-abrir` | Botón flotante "Voni" (FAB) | App.jsx:1515-1527 | FAB global | PRESENTE | todos (flag `voni_2`, salvo en contraseña) | visible |
| `uxParity-voni2-panel` | Panel Voni2 (abierto por FAB) | App.jsx:1528-1550 → Voni2.jsx | overlay Voni | PRESENTE | todos (economía sólo si veCostos) | visible |
| `uxParity-conflicto-guardado` | Aviso ConflictoGuardado (Ver servidor / Reaplicar) | App.jsx:1321 → ConflictoGuardado.jsx | overlay de conflicto | PRESENTE | todos (control optimista) | técnico |
| `uxParity-respaldo-conflicto` | Aviso RespaldoConflicto (Recuperar / Descartar) | App.jsx:1323-1324 → RespaldoConflicto.jsx | overlay de respaldo | PRESENTE | todos (control optimista) | técnico |
| `uxParity-suspense-skeleton` | Skeleton de carga (Suspense) | App.jsx:1327-1333 | loader global | PRESENTE | todos | técnico |
| `uxParity-boundary-error` | Error boundary "Esta pantalla se atoró" | App.jsx:1326 → SinPantallaBlanca.jsx | pantalla de error recuperable | PRESENTE | todos | técnico |
| `uxParity-tab-inicio` | `inicio` (Home) | App.jsx:1349 → Inicio.jsx | Home | PRESENTE | todos | visible |
| `uxParity-tab-voni` | `voni` "Voni · asistente de proyecto" | App.jsx:1486 | Home › Cotizar | PRESENTE | todos (economía sólo veCostos) | visible |
| `uxParity-tab-cocrear` | `cocrear` "Cocrear · de la idea al producto" | App.jsx:1355-1371 | Home › Cocrear | PRESENTE | todos (puente a Costear sólo veCostos) | visible |
| `uxParity-tab-asistente` | `asistente` "Cotizar un mueble" | App.jsx:1352 | Home › Cotizar › especial | PRESENTE | todos (soloVentas si vendedor) | visible |
| `uxParity-tab-cotizacion` | `cotizacion` "Mis cotizaciones" | App.jsx:1480 → Cotizacion.jsx | Proyecto en curso | PRESENTE | todos (seller-safe; economía veCostos) | visible |
| `uxParity-tab-cotizarIA` | `cotizarIA` (sin etiqueta en NOMBRE_VISTA) | App.jsx:1481 → CotizadorIA.jsx | Home › Cotizar varios con IA | PRESENTE | todos (soloVentas si vendedor) | visible |
| `uxParity-tab-acomodo` | `acomodo` (sin etiqueta en NOMBRE_VISTA) | App.jsx:1497 → Acomodo.jsx | Proyecto › Acomodo | PRESENTE | todos | visible |
| `uxParity-tab-banco` | `banco` "Banco de precios" | App.jsx:1372 → Banco.jsx | Home › Más herramientas › Banco | PRESENTE | todos | visible |
| `uxParity-tab-archivo` | `archivo` "Presupuestos que ya hicimos" | App.jsx:1373-1430 → Archivo.jsx | Home › Presupuestos anteriores | PRESENTE | todos (aprobar sólo Dirección; economía veCostos) | visible |
| `uxParity-tab-catalogo` | `catalogo` "Catálogo" | App.jsx:1479 → Catalogo.jsx | Costear › Otra línea de catálogo | PRESENTE | todos (soloVentas si vendedor; entrada soloCostos en Home) | secundario |
| `uxParity-tab-linea-<ruta>` | Costeadores de línea (24): `applt, app, eclipse, pebble, privacy4, rio, teamspace2, tetris, arlequin, pac, via, drift, flex, mox, modulor, luna, accents, ergo4, spine, anteo, alba, feather, worklounge, cirque` | App.jsx:1431-1454 → CosteadorLinea.jsx | Costear/Cotizar de línea › línea | PRESENTE | todos (soloVentas si vendedor; `applt` además add-ons) | visible |
| `uxParity-tab-especial-gate` | `especial` "Costear desde cero" | App.jsx:1455-1460 → AsistenteEspecial.jsx | Home › Costear | PRESENTE | **Diseño + Dirección** (veCostos); vendedor ve "es para Diseño y Dirección" | visible |
| `uxParity-tab-biblioteca-gate` | `biblioteca` (sin etiqueta) | App.jsx:1461-1464 → Biblioteca.jsx | Costear › Biblioteca | PRESENTE | **Diseño + Dirección** (veCostos); vendedor bloqueado | secundario |
| `uxParity-tab-costeador-gate` | `costeador` "Modo avanzado" | App.jsx:1469-1478 → Costeador.jsx | Costear › Despiece libre | PRESENTE | **Diseño + Dirección** (veCostos); vendedor ve aviso | visible |
| `uxParity-tab-precios-gate` | `precios` "Precios" | App.jsx:1498-1501 → Precios.jsx | Costear › Precios de materiales | PRESENTE | **Diseño + Dirección** (veCostos); vendedor bloqueado | visible |
| `uxParity-tab-reglas-gate` | `reglas` "Lo que Voni sabe" | App.jsx:1506 → Reglas.jsx | Home › Lo que Voni sabe | PRESENTE | lectura todos; **editar sólo veCostos** (`puedeEditar`) | visible |
| `uxParity-tab-comercial-flag` | `comercial` "Comercial · proyectos y propuestas" | App.jsx:1482-1485 → Comercial.jsx | Home › Comercial · Proyectos | PRESENTE | todos (flag `commercial_v2`; si off, aviso); economía veCostos | visible |
| `uxParity-tab-tablero-gate` | `tablero` "El negocio" | App.jsx:1465-1468 → Tablero.jsx | Home › Dirección | PRESENTE | **sólo Dirección** (esDireccion); otros ven aviso | visible |
| `uxParity-tab-usuarios-gate` | `usuarios` "Quién puede entrar" | App.jsx:1502 → Usuarios.jsx | menú Cuenta/Home › Usuarios | PRESENTE | **sólo Dirección** | visible |
| `uxParity-tab-cargaerp-gate` | `carga-erp` (sin etiqueta) | App.jsx:1503 → CargaERP.jsx | Home › Cargar compras del ERP | PRESENTE | **sólo Dirección** | secundario |
| `uxParity-tab-contrasena` | `contrasena` (sin etiqueta) | App.jsx:1496 → CambiarContrasena.jsx | menú Cuenta › Contraseña | PRESENTE | todos | secundario |
| `uxParity-home-encabezado` | Marca "VH LAB" + título "¿Qué vas a hacer?" + subtítulo | Inicio.jsx:197-201 | Home › encabezado | PRESENTE | todos | técnico |
| `uxParity-home-retomar` | "Proyecto en curso" (retomar) | Inicio.jsx:205-214 | Home › Proyecto en curso | PRESENTE | todos (si nPartidas>0) | visible |
| `uxParity-home-empezar-cero` | "Empezar de cero" (descartar proyecto) | Inicio.jsx:215-220 → App.descartarProyecto:238 | Home › Proyecto › Empezar de cero | PRESENTE | todos (si nPartidas>0) | visible |
| `uxParity-home-cotizar` | Camino 01 "Cotizar" | Inicio.jsx:225-234 | Home › tarjeta Cotizar | PRESENTE | todos | visible |
| `uxParity-home-costear` | Camino 02 "Costear" | Inicio.jsx:236-247 | Home › tarjeta Costear | PRESENTE | **veCostos** (oculto a vendedor) | visible |
| `uxParity-home-cocrear` | Camino "Cocrear" | Inicio.jsx:249-258 | Home › tarjeta Cocrear | PRESENTE | todos | visible |
| `uxParity-home-proyecto-actual` | Atajo "Proyecto actual" | Inicio.jsx:267 | Home › Más herramientas | PRESENTE | todos (si nPartidas>0) | secundario |
| `uxParity-home-acomodo` | Atajo "Acomodo" | Inicio.jsx:268 | Home › Más herramientas › Acomodo | PRESENTE | todos (si nPartidas>0) | secundario |
| `uxParity-home-cotizar-linea` | Atajo "Cotizar de línea" | Inicio.jsx:269 | Home › Más herramientas | PRESENTE | todos | secundario |
| `uxParity-home-cotizar-ia` | Atajo "Cotizar varios con IA" | Inicio.jsx:270 | Home › Más herramientas | PRESENTE | todos | secundario |
| `uxParity-home-costeo-manual` | Atajo "Costeo manual" | Inicio.jsx:271 | Home › Más herramientas (veCostos) | PRESENTE | **veCostos** | secundario |
| `uxParity-home-banco` | Atajo "Banco de precios" | Inicio.jsx:272 | Home › Más herramientas | PRESENTE | todos | secundario |
| `uxParity-home-archivo` | Atajo "Presupuestos anteriores" | Inicio.jsx:273 | Home › Más herramientas | PRESENTE | todos | secundario |
| `uxParity-home-comercial` | Atajo "Comercial · Proyectos" | Inicio.jsx:274 | Home › Más herramientas (flag) | PRESENTE | todos (flag `commercial_v2`) | secundario |
| `uxParity-home-reglas` | Atajo "Lo que Voni sabe" | Inicio.jsx:275 | Home › Más herramientas | PRESENTE | todos | secundario |
| `uxParity-home-direccion` | Atajo "Dirección" | Inicio.jsx:276 | Home › Más herramientas (Dir.) | PRESENTE | **sólo Dirección** | secundario |
| `uxParity-home-usuarios` | Atajo "Usuarios y accesos" | Inicio.jsx:277 | Home › Más herramientas (Dir.) | PRESENTE | **sólo Dirección** | secundario |
| `uxParity-home-carga-erp` | Atajo "Cargar compras del ERP" | Inicio.jsx:278 | Home › Más herramientas (Dir.) | PRESENTE | **sólo Dirección** | secundario |
| `uxParity-home-favoritas` | "Tus líneas más usadas" (favoritas) | Inicio.jsx:282-294 | Home › favoritas | PRESENTE | todos | secundario |
| `uxParity-cotizar-volver` | BarraVolver "Cotizar" | Inicio.jsx:303 | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos | técnico |
| `uxParity-cotizar-comercial` | Card "Comercial · Proyectos" | Inicio.jsx:305 | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos (flag) | secundario |
| `uxParity-cotizar-ia` | Card "Cotizar con IA" | Inicio.jsx:306 | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos | secundario |
| `uxParity-cotizar-linea` | Card "Cotizar de línea" | Inicio.jsx:307-309 | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos (icono cambia por veCostos) | secundario |
| `uxParity-cotizar-banco` | Card "Banco de precios" | Inicio.jsx:310 | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos | secundario |
| `uxParity-cotizar-archivo` | Card "Presupuestos que ya hicimos" | Inicio.jsx:311 | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos | secundario |
| `uxParity-cotizar-especial` | Card "Cotizar especial (a la medida)" | Inicio.jsx:312 | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos (ruta costeador si veCostos, si no asistente) | secundario |
| `uxParity-cotizar-mis` | Card "Mis cotizaciones" | Inicio.jsx:313 | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos | secundario |
| `uxParity-cotizar-acomodo` | Card "Acomodo en el espacio (IA)" | Inicio.jsx:314 | POR DEFINIR (consolidar panel legacy; destino conservado) | PRESENTE · destino por consolidar | todos | secundario |
| `uxParity-costear-volver` | BarraVolver (título según modo) | Inicio.jsx:323-329 | Costear › volver | PRESENTE | todos | técnico |
| `uxParity-costear-buscador` | Buscador de producto (input `q`) + limpiar "×" | Inicio.jsx:332-337 | Costear › buscador | PRESENTE | todos | visible |
| `uxParity-costear-atajo-ia` | Atajo IA "¿Son varios muebles?" | Inicio.jsx:339-347 | Cotizar de línea › atajo IA | PRESENTE | todos (sólo en cotizarlinea) | secundario |
| `uxParity-costear-ia` | Card "Costear con IA" | Inicio.jsx:351 | Costear › Costear con IA | PRESENTE | veCostos (modoCostear) | visible |
| `uxParity-costear-mano` | Card "Costear a mano (despiece completo)" | Inicio.jsx:352 | Costear › Costear a mano | PRESENTE | veCostos (modoCostear) | visible |
| `uxParity-costear-hallados` | Resultados hallados (producto/artículo/banco) | Inicio.jsx:357-373 | Costear › resultados | PRESENTE | todos | visible |
| `uxParity-costear-vacio` | Empty state "Nada encontrado" | Inicio.jsx:375-376 | Costear › vacío | PRESENTE | todos | técnico |
| `uxParity-costear-lineas-filtro` | Tarjetas de líneas filtradas (con imagen) | Inicio.jsx:378-383 | Costear › líneas | PRESENTE | todos | visible |
| `uxParity-costear-acordeon` | Acordeón por familia + grupo "Herramientas" | Inicio.jsx:385-405 | Costear › acordeón | PRESENTE | todos (herramientas soloCostos filtradas) | visible |
| `uxParity-herr-catalogo` | Herramienta "Otra línea de catálogo" | Inicio.jsx:56 | Costear › Herramientas | PRESENTE | **veCostos** (soloCostos) | secundario |
| `uxParity-herr-costeador` | Herramienta "Despiece libre (avanzado)" | Inicio.jsx:57 | Costear › Herramientas | PRESENTE | **veCostos** (soloCostos) | secundario |
| `uxParity-herr-precios` | Herramienta "Precios de materiales" | Inicio.jsx:58 | Costear › Herramientas | PRESENTE | **veCostos** (soloCostos) | secundario |
| `uxParity-herr-reglas` | Herramienta "Lo que Voni sabe" | Inicio.jsx:61 | Costear › Herramientas | PRESENTE | todos | secundario |
| `uxParity-login-portadas` | Carrusel de portadas + "Cocreando tu espacio" | Login.jsx:60-69 | Login › arte | PRESENTE | anónimo | técnico |
| `uxParity-login-aviso-enlace` | Aviso de enlace de correo (otp_expired) | Login.jsx:79 | Login › alerta enlace | PRESENTE | anónimo | secundario |
| `uxParity-login-correo` | Input Correo | Login.jsx:82-85 | Login › correo | PRESENTE | anónimo | visible |
| `uxParity-login-pass` | Input Contraseña + "Ver contraseña" | Login.jsx:87-93 | Login › contraseña | PRESENTE | anónimo | visible |
| `uxParity-login-error` | Error de credenciales | Login.jsx:95 | Login › error | PRESENTE | anónimo | técnico |
| `uxParity-login-entrar` | Botón "Entrar" | Login.jsx:98-100 | Login › Entrar | PRESENTE | anónimo | visible |
| `uxParity-login-olvide` | "¿Olvidaste tu contraseña?" | Login.jsx:118 | Login › recuperar | PRESENTE | anónimo | secundario |
| `uxParity-login-recuperar` | Recuperar: "Mandarme el enlace" / "Cancelar" | Login.jsx:108-116 | Login › recuperar acciones | PRESENTE | anónimo | secundario |
| `uxParity-login-enviado` | Confirmación "Te mandamos un correo" | Login.jsx:103-106 | Login › confirmación | PRESENTE | anónimo | secundario |
| `uxParity-login-pie` | Pie "¿No puedes entrar?" | Login.jsx:121 | Login › pie | PRESENTE | anónimo | técnico |
| `uxParity-login-version` | Versión/commit (`__APP_VERSION__`/`__BUILD_SHA__`) | Login.jsx:124-126 | Login › versión | PRESENTE | anónimo | técnico |
| `uxParity-pass-actual` | Input "Tu contraseña actual" | CambiarContrasena.jsx:104-107 | Contraseña › actual | PRESENTE | todos (no en recuperación) | visible |
| `uxParity-pass-nueva-fuerza` | Input "Nueva contraseña" + medidor de fuerza | CambiarContrasena.jsx:109-118 | Contraseña › nueva | PRESENTE | todos | visible |
| `uxParity-pass-repite` | Input "Repite la nueva" + no coincide | CambiarContrasena.jsx:121-125 | Contraseña › repetir | PRESENTE | todos | visible |
| `uxParity-pass-ver` | Check "Ver lo que escribo" | CambiarContrasena.jsx:127-129 | Contraseña › ver | PRESENTE | todos | secundario |
| `uxParity-pass-cerrar-otras` | Check "Cerrar mi sesión en los demás dispositivos" | CambiarContrasena.jsx:130-136 | Contraseña › cerrar otras | PRESENTE | todos | secundario |
| `uxParity-pass-guardar` | Botón "Guardar nueva contraseña" | CambiarContrasena.jsx:140-142 | Contraseña › guardar | PRESENTE | todos | visible |
| `uxParity-pass-ok` | Estado "Contraseña actualizada" (Volver / Cambiarla otra vez) | CambiarContrasena.jsx:70-89 | Contraseña › confirmación | PRESENTE | todos | secundario |
| `uxParity-guia-buscar` | Buscador de la guía + limpiar | Guia.jsx:298-302 | Guía › buscador | PRESENTE | todos | secundario |
| `uxParity-guia-indice-rol` | Índice de secciones (tabs filtrados por rol) | Guia.jsx:304-313 | Guía › índice | PRESENTE | todos (v: todos/costos/direccion) | visible |
| `uxParity-guia-temas` | Temas en acordeón + marca de "visto" | Guia.jsx:321-356 | Guía › temas | PRESENTE | todos | visible |
| `uxParity-guia-ir-<tab>` | Botones contextuales dentro de temas (Abrir Voni, Ver el banco, Costear desde cero, modo avanzado, precios, tablero, usuarios, acomodo) | Guia.jsx:351 (tabs 87,94,109,152,155,166,178,185) | Guía › salto a pantalla | PRESENTE | según rol de la sección | secundario |
| `uxParity-guia-demos` | Demos visuales (sellos Firme/Estimado, barra de precio, punto de conexión) | Guia.jsx:30-56 | Guía › demos | PRESENTE | todos | técnico |
| `uxParity-guia-progreso` | Barra de progreso "N de M leídos" | Guia.jsx:359-363 | Guía › progreso | PRESENTE | todos | secundario |
| `uxParity-guia-cerrar` | Botón "Empezar"/"Cerrar" + X + Escape + clic fondo | Guia.jsx:285,293,364 | Guía › cerrar | PRESENTE | todos | visible |
| `uxParity-boundary-volver` | Botón "Volver al inicio" | SinPantallaBlanca.jsx:62 | Error › Volver | PRESENTE | todos | visible |
| `uxParity-boundary-reintentar` | Botón "Reintentar" | SinPantallaBlanca.jsx:63 | Error › Reintentar | PRESENTE | todos | visible |
| `uxParity-boundary-copiar` | Botón "Copiar el detalle" | SinPantallaBlanca.jsx:64-66 | Error › Copiar detalle | PRESENTE | todos | secundario |
| `uxParity-boundary-detalle` | "Ver el detalle técnico" (`details`) | SinPantallaBlanca.jsx:68-73 | Error › detalle técnico | PRESENTE | todos | técnico |

## 2. COSTEAR + ERP/Precios/Catálogo

| id (uxParity-*) | función | ANTES (dónde vive hoy) | DESPUÉS (nuevo lugar UX) | Estado | rol | visible/secundario/técnico |
|---|---|---|---|---|---|---|
| `uxParity-linea-ruteo` | **— COSTEADORES DE LÍNEA (23 líneas, pantalla paramétrica única) —** | App.jsx:1431-1454 (applt…cirque → CosteadorLinea) | Configurador › línea | PRESENTE | todos (soloVentas = vendedor) | visible |
| `uxParity-linea-producto` | Chips de Producto (cambia variante, resetea medidas/opciones) | CosteadorLinea.jsx:167-170,69-82 | Configurador › Producto | PRESENTE | todos | visible |
| `uxParity-linea-medidas` | Chips Largo / Fondo / Retorno(lateral) / Diámetro / Usuarios | CosteadorLinea.jsx:183-187 | Configurador › Medidas | PRESENTE | todos | visible |
| `uxParity-linea-selects` | Chips de `selects` dinámicos (p.ej. Modulor gaveta/cojín) | CosteadorLinea.jsx:188-195 | Configurador › Opciones | PRESENTE | todos | visible |
| `uxParity-linea-acabado` | Chips Acabado (ABS/chapa/ecolegno…) | CosteadorLinea.jsx:201-208 | Configurador › Opciones › Acabado | PRESENTE | todos | visible |
| `uxParity-linea-color` | Chips Color melamina (con swatch hex) | CosteadorLinea.jsx:212-227 | Configurador › Opciones › Color | PRESENTE | todos | visible |
| `uxParity-linea-biombo` | Chips Biombo (sin / PET9 / cristal6 / melamina9) | CosteadorLinea.jsx:228-238 | Configurador › Opciones › Biombo | PRESENTE | todos | visible |
| `uxParity-linea-checks` | Casillas (`checks`) de extras (cerradura, zoclo…) con default | CosteadorLinea.jsx:239-241,45-46 | Configurador › Opciones | PRESENTE | todos | visible |
| `uxParity-linea-addons-mox` | Stepper "Gavetas rodantes MOX" (±, complemento App LT) | CosteadorLinea.jsx:245-256 | Configurador › Complementos | PRESENTE | todos | secundario |
| `uxParity-linea-ver-ingenieria` | `<details>` "Ver despiece y hoja de costo" (tabla BOM + HojaCosto) | CosteadorLinea.jsx:268-296 | Resultado › Ver ingeniería | PRESENTE | Diseño+Dirección (veCostosCosteo; oculto si soloVentas) | técnico |
| `uxParity-linea-cantidad` | Stepper Cantidad (±) | CosteadorLinea.jsx:299-306 | Resultado › Cantidad | PRESENTE | todos | visible |
| `uxParity-linea-precio-fuente` | Precio grande + etiqueta de fuente (autorizado/lista real/estimado) + "Ojo: nota" | CosteadorLinea.jsx:307-333 | Resultado › Precio | PRESENTE | todos (texto difiere por rol) | visible |
| `uxParity-linea-sin-precio-autorizado` | Alerta fail-closed "sin precio autorizado" (soloVentas) | CosteadorLinea.jsx:307-310,145 | Resultado › aviso | PRESENTE | vendedor | visible |
| `uxParity-linea-addons-total` | Lista de add-ons + "Total módulo ×n" | CosteadorLinea.jsx:334-347 | Resultado › Complementos | PRESENTE | todos | secundario |
| `uxParity-linea-agregar` | Botón "Agregar a la cotización" | CosteadorLinea.jsx:349,144-152 | Resultado › CTA principal | PRESENTE | todos | visible |
| `uxParity-linea-ir-cotizacion` | Botón "Ver mi cotización (n)" | CosteadorLinea.jsx:353 | Resultado › enlace | PRESENTE | todos | visible |
| `uxParity-linea-ir-acomodo` | Botón "¿Dónde van? Define el espacio →" (al 1er mueble) | CosteadorLinea.jsx:359-362 | Resultado › siguiente paso | PRESENTE | todos | secundario |
| `uxParity-linea-ficha-pdf` | Botón "Ver ficha PDF" | CosteadorLinea.jsx:366,395 | Resultado › Exportar | PRESENTE | todos | secundario |
| `uxParity-linea-barra-compra` | Barra fija compra (celular): monto, contador, ± cantidad, "Agregar" | CosteadorLinea.jsx:371-393 | Barra de acción persistente | PRESENTE | todos | visible |
| `uxParity-costeador-acceso` | **— COSTEADOR AVANZADO (producto nuevo / especial) —** | App.jsx:1469-1477 → Costeador.jsx | Costeo avanzado | PRESENTE | Diseño+Dirección (veCostosCosteo); fallback si no | visible |
| `uxParity-cost-nombre` | Input "Qué estás costeando" (nombre) | Costeador.jsx:360-362 | Encabezado | PRESENTE | Diseño+Dirección | visible |
| `uxParity-cost-descripcion` | Textarea "Descríbelo y Voni lo entiende" | Costeador.jsx:369-372 | Encabezado › Describir | PRESENTE | Diseño+Dirección | visible |
| `uxParity-cost-analizar-ia` | Botón "🧠 Analizar con Voni" (texto→BOM, pide confirmar si pisa trabajo) | Costeador.jsx:374-378,135-173 | Describir › Analizar | PRESENTE | Diseño+Dirección | visible |
| `uxParity-cost-candidatos-linea` | Panel "candidatos de línea existentes" (chips) | Costeador.jsx:382-390 | Describir › sugerencias | PRESENTE | Diseño+Dirección | secundario |
| `uxParity-cost-estructura-voni` | Panel "Estructura que entendió Voni" (nodos/relaciones, read-only) | Costeador.jsx:392-421 | Ver ingeniería › Estructura IA | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-piezas` | Stepper "Cuántas piezas" (±) | Costeador.jsx:423-428 | Encabezado › Lote | PRESENTE | Diseño+Dirección | visible |
| `uxParity-cost-tipo-producto` | Select "Tipo de producto" (fabricado/compra-venta/servicio…) | Costeador.jsx:433-442 | Encabezado › Tipo | PRESENTE | Diseño+Dirección | secundario |
| `uxParity-cost-bench-personas` | Bench modular: stepper personas (par) | Costeador.jsx:446-457,309-319 | Opciones › Bench | PRESENTE | Diseño+Dirección | secundario |
| `uxParity-cost-pieza-nombre` | Despiece: input "Nombre de la pieza" | Costeador.jsx:476-477 | Ver ingeniería › Editar BOM | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-pieza-material` | Despiece: selector material "¿de qué es?" (optgroups por sección + ERP) | Costeador.jsx:478-491,272-292 | Ver ingeniería › Editar BOM | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-material-match` | Alertas de match de material (badge / pendiente / "Usar candidato") | Costeador.jsx:496-518 | Ver ingeniería › aviso material | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-medida-area` | Despiece: inputs Largo/Ancho/Cant (material por área) | Costeador.jsx:522-536 | Ver ingeniería › Editar BOM | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-fraccion-hoja` | Despiece: input "Fracción de hoja" (tablero/lámina directo) | Costeador.jsx:537-540 | Ver ingeniería › Editar BOM | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-cantidad-unidad` | Despiece: input "Cantidad (unidad)" (material por pieza/metro) | Costeador.jsx:541-544,247-251 | Ver ingeniería › Editar BOM | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-subtotal-pieza` | Subtotal por pieza / "Pendiente" (sin precio) | Costeador.jsx:545,294-306 | Ver ingeniería › BOM | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-mm-metros` | Alerta mm/metros + botón "Usar X mm" | Costeador.jsx:559-570,51-53 | Ver ingeniería › aviso medida | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-pieza-cero` | Alerta "esta pieza no está costando nada" | Costeador.jsx:571-575 | Ver ingeniería › aviso | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-add-quitar-pieza` | Botón "×" quitar pieza / "+ Agregar pieza" | Costeador.jsx:492,580,261-266 | Ver ingeniería › Editar BOM | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-lista-compra` | Panel "Desperdicio y lista de compra" (neto, hojas, merma semáforo) | Costeador.jsx:584-620,321-327 | Ver ingeniería › Compra/merma | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-sugerencia-lote` | Botón sugerencia de lote "Cambiar a N" | Costeador.jsx:621-628,120-123 | Ver ingeniería › sugerencia | PRESENTE | Diseño+Dirección | secundario |
| `uxParity-cost-sugerencia-medida` | Botón "Usar medida que rinde mejor" | Costeador.jsx:631-641,329-350 | Ver ingeniería › sugerencia | PRESENTE | Diseño+Dirección | secundario |
| `uxParity-cost-confianza` | Panel "Confianza del costeo" (% con fuente verificada, read-only) | Costeador.jsx:644,904-930 | Ver ingeniería › Confianza | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-mo-modo` | Toggle Mano de obra "Por horas medidas / Por porcentaje" | Costeador.jsx:649-654 | Ver ingeniería › Mano de obra | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-mo-horas` | Inputs horas por área (AREAS_LABEL) | Costeador.jsx:656-672 | Ver ingeniería › MO › Horas | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-mo-factor-directo` | Slider factor directo + atajos (Muy fácil…Muy difícil) | Costeador.jsx:676-687,35-41 | Ver ingeniería › MO › Factor | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-mo-factor-indirecto` | Slider factor indirecto + GuiaManoObra + PuenteModos | Costeador.jsx:689-700,939-989 | Ver ingeniería › MO | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-prep-empaque-merma` | Inputs Preparación (horas) / Empaque ($) / Merma proceso (%) | Costeador.jsx:706-718 | Ver ingeniería › Prep/empaque | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-gastos-fabrica` | Input "Gastos de fábrica %" | Costeador.jsx:723-728 | Ver ingeniería › Gastos fábrica | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-render-ia` | Botón "Generar/Regenerar/Actualizar render con IA" + Quitar render + MiniRender | Costeador.jsx:749-754,216-231 | Resultado › Render | PRESENTE | Diseño+Dirección | secundario |
| `uxParity-cost-hojacosto` | Panel HojaCosto (técnico+comercial) | Costeador.jsx:761 → HojaCosto.jsx | Resultado › Hoja de costo | PRESENTE | Diseño+Dirección (comercial solo si `mostrarComercial`=Dirección) | técnico |
| `uxParity-cost-auditoria-mate` | `<details>` "Así calculé este mueble · auditoría matemática" | Costeador.jsx:763-802,109-112 | Ver ingeniería › Auditoría | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-mejora-industrial` | Panel "VONI · Mejora de fabricación" (advisory, no cambia costo) | Costeador.jsx:804-842,105-108 | Ver ingeniería › Mejoras | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-cost-simulador-alba` | Banner "SIMULADOR — NO OFICIAL" + botón "Volver al costo oficial (Alba V1)" | Costeador.jsx:847-855,117-119 | Resultado › aviso oficial | PRESENTE | Dirección | visible |
| `uxParity-cost-margen` | Slider "Cuánto quieres ganar" (margen) | Costeador.jsx:856-861 | Resultado › Precio › Margen | PRESENTE | **solo Dirección** (puedeVerComercial) | visible |
| `uxParity-cost-precio-bloqueos` | Precio grande / "Pendiente" + alertas (no emitible / bajo mínimo) | Costeador.jsx:862-865,91-104 | Resultado › Precio | PRESENTE | **solo Dirección** | visible |
| `uxParity-cost-agregar-verificado` | Botón "Agregar a la cotización" (verifica costo en servidor) | Costeador.jsx:868-870,180-192 | Resultado › CTA principal | PRESENTE | **solo Dirección** | visible |
| `uxParity-cost-guardar-pieza` | Botón "Guardar como pieza" | Costeador.jsx:872,882 | Resultado › Guardar | PRESENTE | Diseño+Dirección | secundario |
| `uxParity-cost-ficha-pdf` | Botón "Ver ficha PDF" (bloqueado si simulando/incompleto) | Costeador.jsx:874,887-889 | Resultado › Exportar | PRESENTE | **solo Dirección** | secundario |
| `uxParity-cost-cierre-tecnico` | Bloque "Cierre técnico" (sin capa comercial) | Costeador.jsx:876-884 | Resultado › Cierre técnico | PRESENTE | Diseño (no Dirección) | visible |
| `uxParity-cost-barra-fija` | Barra fija inferior (costo/precio/"No oficial") | Costeador.jsx:892-895 | Barra de acción persistente | PRESENTE | Diseño+Dirección (precio solo Dirección) | visible |
| `uxParity-buscador-insumo` | **— BUSCADOR DE INSUMO (ERP ~11k, dentro del despiece) —** | BuscadorInsumo.jsx (en Costeador.jsx:494 y AsistenteEspecial) | Ver ingeniería › Editar BOM › Buscar material | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-buscador-abrir` | Botón "🔎 Buscar en todo el catálogo" (abre) | BuscadorInsumo.jsx:31-33 | Editar BOM › Buscar | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-buscador-query` | Input de búsqueda (debounce) + estados buscando/error/vacío | BuscadorInsumo.jsx:34-39,18-29 | Editar BOM › Buscar | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-buscador-usar` | Lista de resultados con precio/unidad/evidencia + botón "Usar" | BuscadorInsumo.jsx:40-61 | Editar BOM › resultado | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-buscador-cerrar` | Botón "Cerrar" | BuscadorInsumo.jsx:62 | Editar BOM › Buscar | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-editar-abrir` | **— EDITAR PARTIDA (recotizar un mueble de la cotización) —** | EditarPartida.jsx (abre desde Cotizacion.jsx:475,548,629 lápiz) | Cotización › partida › Editar | PRESENTE | todos (soloVentas = vendedor, sin costo) | visible |
| `uxParity-editar-opciones` | Chips Largo/Fondo/Retorno/Diámetro/Usuarios/selects/Acabado/Color/Biombo/Checks | EditarPartida.jsx:124-151 | Editar mueble › opciones | PRESENTE | todos | visible |
| `uxParity-editar-cantidad` | Stepper Cantidad (±) | EditarPartida.jsx:153-160 | Editar mueble › Cantidad | PRESENTE | todos | visible |
| `uxParity-editar-delta` | Resumen precio + delta "(+/− por pieza)" | EditarPartida.jsx:164-173,87 | Editar mueble › resumen | PRESENTE | todos | visible |
| `uxParity-editar-guardar` | Botones "Cancelar" / "Guardar cambios" (vía contrato crearPartida) | EditarPartida.jsx:176-177,24-38 | Editar mueble › acciones | PRESENTE | todos | visible |
| `uxParity-editar-no-editable` | Fallback "No se puede editar" (banco/especial) | EditarPartida.jsx:67-81,19 | Editar mueble › aviso | PRESENTE | todos | secundario |
| `uxParity-precios-acceso` | **— PRECIOS (insumos, costo hora, parámetros) —** | App.jsx:1498-1501 → Precios.jsx | Ajustes › Precios | PRESENTE | Diseño+Dirección (tab); costo hora solo Dirección | visible |
| `uxParity-precios-costo-hora` | Calculadora costo hora: inputs nómina/operativos/horas-semana/eficiencia | Precios.jsx:85-116,21-43 | Ajustes › Costo hora (Dirección) | PRESENTE | **solo Dirección** (desbloqueado) | técnico |
| `uxParity-precios-usar-hora` | Botón "Usar en los costeos (hora taller)" | Precios.jsx:115 | Ajustes › Costo hora | PRESENTE | **solo Dirección** | visible |
| `uxParity-precios-hora-bloqueada` | Aviso bloqueado "La nómina es solo de Dirección" + "Soy Dirección" | Precios.jsx:75-83 | Ajustes › Costo hora (bloqueado) | PRESENTE | Diseño (no Dirección) | secundario |
| `uxParity-precios-parametros` | Parámetros de planta: 8 CampoNumero (gastos fábrica, márgenes, anticipo, factores MO, aprovechamiento) | Precios.jsx:121-158 | Ajustes › Parámetros | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-precios-export-import` | Botones "Exportar a archivo" / "Importar archivo" / "Restablecer precios de fábrica" | Precios.jsx:160-170,60-70 | Ajustes › Respaldo | PRESENTE | Diseño+Dirección | secundario |
| `uxParity-precios-desde-catalogo` | Aviso "precios desde catálogo certificado (ERP, solo lectura)" | Precios.jsx:172-177,58 | Ajustes › Precios › banner | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-precios-tabla-insumos` | Tablas de precios por sección: celda editable (CampoNumero) o solo lectura + semáforos | Precios.jsx:178-218 | Ajustes › Precios por sección | PRESENTE | Diseño+Dirección | técnico |
| `uxParity-banco-acceso` | **— BANCO DE PRECIOS (productos ya cotizados + catálogo 23 líneas) —** | App.jsx:1372 → Banco.jsx | Catálogo › Banco | PRESENTE | todos | visible |
| `uxParity-banco-buscar` | Input de búsqueda libre | Banco.jsx:67-68,18-48 | Banco › Buscar | PRESENTE | todos | visible |
| `uxParity-banco-filtros` | Chips filtro Línea / Tipo de mueble | Banco.jsx:69-82 | Banco › filtros | PRESENTE | todos | secundario |
| `uxParity-banco-aviso-descuento` | Aviso "ya traen descuento del proyecto" | Banco.jsx:64-66 | Banco › banner | PRESENTE | todos | visible |
| `uxParity-banco-agregar` | Item banco: sello "Firme", input cantidad, botón "Agregar" | Banco.jsx:96-126,52-57 | Banco › resultado › Agregar | PRESENTE | todos | visible |
| `uxParity-banco-configurar` | Item catálogo 23 líneas: sello Firme/Estimado, precio-rango, botón "Configurar →" | Banco.jsx:128-165 | Banco › catálogo › Configurar | PRESENTE | todos | visible |
| `uxParity-banco-navegar` | Botón "Ver mi cotización ›" / "Ver todo el banco" (reset) | Banco.jsx:175,180-182 | Banco › navegación | PRESENTE | todos | secundario |
| `uxParity-catalogo-acceso` | **— CATÁLOGO (familias → muebles → líneas) —** | App.jsx:1479 → Catalogo.jsx | Catálogo | PRESENTE | todos (soloVentas = vendedor) | visible |
| `uxParity-catalogo-buscar` | Input búsqueda (lista plana) | Catalogo.jsx:85-110 | Catálogo › Buscar | PRESENTE | todos | visible |
| `uxParity-catalogo-familias` | Familias plegables (expandir/colapsar) + "Ver líneas" | Catalogo.jsx:111-135 | Catálogo › familias | PRESENTE | todos | visible |
| `uxParity-catalogo-lineas-orden` | Paso 2: líneas ordenadas por precio + etiqueta "MÁS BARATA" | Catalogo.jsx:41-78,21-27 | Catálogo › líneas | PRESENTE | todos | visible |
| `uxParity-catalogo-cargar` | Botón "Usar" / "Configurar →" (carga receta/bench/blanco) | Catalogo.jsx:73,163-218 | Catálogo › líneas › CTA | PRESENTE | todos | visible |
| `uxParity-catalogo-volver` | Botón "‹ Otras opciones" (volver) | Catalogo.jsx:59 | Catálogo › navegación | PRESENTE | todos | secundario |
| `uxParity-erp-acceso` | **— CARGA ERP (compras Intelisis) —** | App.jsx:1503 → CargaERP.jsx | Ajustes › ERP (Dirección) | PRESENTE | **solo Dirección** (tab gated esDireccion) | visible |
| `uxParity-erp-firmar` | Firma: botón "Firmar precios del ERP" + confirm "Sí, firmar"/Cancelar + resultado | CargaERP.jsx:19-67,44-64 | Ajustes › ERP › Firmar | PRESENTE | **solo Dirección** | visible |
| `uxParity-erp-archivo` | Carga: input archivo .xlsx (valida encabezados) | CargaERP.jsx:127-131,78-95 | Ajustes › ERP › Subir archivo | PRESENTE | **solo Dirección** | visible |
| `uxParity-erp-resumen` | Carga: tabla resumen (entran/sin costo/certificables/bloqueados) | CargaERP.jsx:133-146 | Ajustes › ERP › Resumen | PRESENTE | **solo Dirección** | técnico |
| `uxParity-erp-cargar` | Carga: botón "Cargar al catálogo" (por lotes, con avance) | CargaERP.jsx:147,97-121 | Ajustes › ERP › Cargar | PRESENTE | **solo Dirección** | visible |
| `uxParity-erp-resultado` | Carga: tabla resultado + `<details>` "Ver errores" | CargaERP.jsx:150-169 | Ajustes › ERP › Resultado | PRESENTE | **solo Dirección** | técnico |

## 3. COTIZAR + Acomodo/Planos/PDF

| id (uxParity-*) | función | ANTES (dónde vive hoy) | DESPUÉS (nuevo lugar UX) | Estado | rol | visible/secundario/técnico |
|---|---|---|---|---|---|---|
| `uxParity-empezar-tres-caminos` | Elegir cómo empezar: subir plano / dibujar / solo m² | EmpezarEspacio.jsx:116-127 | Paso 1 "¿Dónde va?" como bifurcación grande con jerarquía plano>dibujo>m² | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-subir-plano` | Subir plano del cliente (PDF/foto/DWG/DXF) | EmpezarEspacio.jsx:116 · AcomodoBase.jsx:1379,1450-1453 | Dropzone en paso Espacio con estados subiendo/leyendo | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-m2-tipicos` | Elegir m² típicos (50…400) | EmpezarEspacio.jsx:134-137 | Chips rápidos de metraje | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-m2-slider` | Barra de m² (range) | EmpezarEspacio.jsx:144 | Slider con lectura viva | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-m2-exacto` | Escribir m² exacto (CampoM2) | EmpezarEspacio.jsx:28-51,150 | Input numérico con validación al blur | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-pisos` | Elegir número de pisos (medio…4) | EmpezarEspacio.jsx:155-159 | Selector de plantas | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-espacio-privados` | Programa de cuartos: privados ± y m² por privado | EmpezarEspacio.jsx:172-189 | Editor de programa-espacio con steppers | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-espacio-juntas` | Salas de juntas ± y pax | EmpezarEspacio.jsx:190-207 | Steppers + chips de capacidad | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-espacio-servicios` | Recepción / Break room (checkbox) | EmpezarEspacio.jsx:208-209 | Toggles de cuartos | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-cancel-propuesto` | Aviso de cancelería/puertas WAND propuesta | EmpezarEspacio.jsx:232-245 | Tarjeta de sugerencia no-destructiva | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-espacio-apretado-sobrado` | Avisos apretado / sobrado vs m² que necesita | EmpezarEspacio.jsx:100-106,255-267 | Banner de holgura de espacio | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-empezar-listo` | Empezar con N m² → | EmpezarEspacio.jsx:270-273 | CTA primario del paso | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ia-texto` | Escribir/pegar pedido del cliente (texto libre) | CotizadorIA.jsx:262-268 | Entrada conversacional del cotizador | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ia-ejemplos` | Ejemplos de pedido (chips) | CotizadorIA.jsx:32-36,269-273 | Chips de plantilla de pedido | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-ia-interpretar` | Armar la lista / Volver a interpretar | CotizadorIA.jsx:78-204,275-277 | CTA "Interpretar" con estado de lote | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ia-resultado` | Resultado "Agregué N muebles" + resumen | CotizadorIA.jsx:285-299 | Tarjeta de resultado con conteo vivo | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ia-aclaracion` | Preguntas de afinación + responder/rehacer | CotizadorIA.jsx:213-227,344-358 | Hilo de aclaraciones persistente | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ia-avisos` | Avisos IA: no-catálogo / material especial / sin costear / sin precio autorizado / sugerencias descartadas | CotizadorIA.jsx:315-343 | Lista de advertencias clasificadas | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-programa-prefill` | Prefill de programa desde el plano + avisos largo/sala | ProgramaProyecto.jsx:125-175 | Cuestionario autollenado del plano | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-programa-operativos` | Operativos ± (+ largo puesto, línea, silla) | ProgramaProyecto.jsx:177-189 | Editor de programa por botones | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-programa-privados` | Privados ± (escritorio, línea, silla directiva, silla visita, credenza) | ProgramaProyecto.jsx:192-211 | Bloque privados del programa | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-programa-juntas` | Sala de juntas ± + silla | ProgramaProyecto.jsx:213-222 | Bloque juntas del programa | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-programa-guardas` | Gavetas ± / Archiveros ± (muebles distintos) | ProgramaProyecto.jsx:224-232 | Steppers de guarda | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-programa-recepcion` | Recepción (checkbox) | ProgramaProyecto.jsx:234-237 | Toggle | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-programa-frase` | Resumen "N personas" + frase | ProgramaProyecto.jsx:85-123,239-244 | Vista previa de la frase | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-programa-armar` | Armar el proyecto → | ProgramaProyecto.jsx:246-249 | CTA del programa | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-esto-entendi` | "Esto entendí": lista corregible por grupos + titular + avisos | EstoEntendi.jsx:57-90 | Pantalla de revisión pre-acomodo | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ee-cantidad` | Cantidad ± por partida (Esto entendí) | EstoEntendi.jsx:132-136 | Stepper por renglón | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ee-quitar` | Quitar partida (Esto entendí) | EstoEntendi.jsx:143 | Acción quitar | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ee-editar` | Editar partida (lápiz, Esto entendí) | EstoEntendi.jsx:138-142 | Editar inline | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-ee-variantes` | Elegir variante/terminación de catálogo | EstoEntendi.jsx:116-130 | Selector de terminación con precio | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ee-procedencia` | Badges de sello/sugerido/confianza/procedencia | EstoEntendi.jsx:66-73,100-105 | Chips de procedencia (ver crudos) | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-lectura-confirmar` | Confirmar lectura del plano (áreas, m², puestos, confianza) | ConfirmarLectura.jsx:31-62 | Compuerta de confirmación de lectura | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-lectura-problemas` | Problemas a revisar de la lectura | ConfirmarLectura.jsx:69-73 | Banner de problemas | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-lectura-estructura` | Estructura leída: columnas / niveles | ConfirmarLectura.jsx:63-68 | Nota de estructura | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-lectura-puertas` | Confirmar puertas pendientes en la lectura | ConfirmarLectura.jsx:77-90 · PuertaConfirmar.jsx | Paso de puertas dentro de la compuerta | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-lectura-acciones` | "Sí, así es" / "No, lo dibujo yo" / "Volver a subir" | ConfirmarLectura.jsx:93-105 | Tres CTAs de la compuerta | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-puerta-confirmar` | Puerta: hojas una/doble, bisagra izq/der, abre adentro/afuera | PuertaConfirmar.jsx:24-36 | Control de puerta reutilizable | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-programa-detectado` | Aviso "Voni detectó el programa del plano" (PROPUESTA) + preview | Acomodo.jsx:263-297 | Panel de programa detectado | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-aplicar-programa` | Select línea operativa + "Aplicar programa detectado" | Acomodo.jsx:284-294 | CTA aplicar programa | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-faltantes` | Aviso de faltantes del programa (SUGERIDAS · NO COTIZADAS) | Acomodo.jsx:300-315 | Banner de faltantes no-cobrables | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-estado-cartel` | Cartel de estado del espacio 3D (validado / en revisión / falta) | AcomodoBase.jsx:1380-1392 | Encabezado de estado del acomodo | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-truncado` | Aviso piezas truncadas (dibujo recorta, precio no) | AcomodoBase.jsx:1400-1406 | Banner de truncado | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-acomodo-areas` | Editar áreas: nombre / ancho / largo / + agregar / quitar | AcomodoBase.jsx:1422-1432 | Editor de áreas | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-cambiar-espacio` | Cambiar el espacio (reset a la pregunta inicial) | AcomodoBase.jsx:1438-1448 | Acción "empezar espacio otra vez" | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-acomodo-entradas-plano` | Dibujar mi oficina / Subir plano (desde acomodo) | AcomodoBase.jsx:1449-1453 | Accesos al plano dentro del acomodo | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-puertas` | Puertas por confirmar en el acomodo | AcomodoBase.jsx:1454-1462 | Panel de puertas pendientes | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-acomodar` | Acomodar (motor) / Con IA | AcomodoBase.jsx:1466-1469 | CTA primario + alterno IA | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-vs-plano` | Plano original vs lo que entendí + nivel confianza | AcomodoBase.jsx:1481-1515 | Comparador plano/lectura | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-msg-vendedor` | Mensaje al vendedor "qué no cupo / por qué / qué hacer" | AcomodoBase.jsx:1520-1532 | Tarjeta de pendientes | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-diagnostico` | Diagnóstico tabla (mueble/zona/medida/causa/qué hacer) | AcomodoBase.jsx:1533-1555 | Tabla de diagnóstico (humanizar códigos) | PRESENTE | diseno, direccion | secundario |
| `uxParity-staging-foto` | Amueblar una foto real con IA (staging) | AcomodoBase.jsx:1559-1569 | Staging virtual | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-render-oficina-gate` | Render de mi oficina (IA) + bloqueo hasta cerrar acomodo | AcomodoBase.jsx:1568-1575 | Botón render con gate visible | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-staging-guardar` | Guardar staging en la propuesta | AcomodoBase.jsx:1582-1585 | Guardar imagen a propuesta | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-chequeo` | Chequeo "✓ Todo cabe / faltan N / puestos·m² por persona" | AcomodoBase.jsx:1593-1604 | Resumen de cabida | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-auditoria` | Auditoría "Voni revisó" (medida) + aviso vencida | AcomodoBase.jsx:1612-1631 | Panel de auditoría medida | PRESENTE | diseno, direccion | secundario |
| `uxParity-acomodo-veredicto` | Veredicto por bloques (geometría/colisiones/programa/anclas/semántica/evidencia/publicable) | AcomodoBase.jsx:1633-1647 | Checklist de veredicto | PRESENTE | diseno, direccion | visible |
| `uxParity-acomodo-vista` | Toggle Planta / Vista 3D | AcomodoBase.jsx:1651,1656 | Toggle de vista | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-amano` | Acomodar a mano / Terminar de acomodar | AcomodoBase.jsx:1652-1655 | Modo editor manual | PRESENTE | diseno, direccion | visible |
| `uxParity-acomodo-realista` | Vista preliminar (N pendientes) / Vista realista (IA) | AcomodoBase.jsx:1657-1665 | Render con estado preliminar | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-propuesta-viva` | ✨ Propuesta Viva (presentación cinematográfica) | AcomodoBase.jsx:1667-1671,1684-1689 | Modo presentación del acomodo | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-acomodo-guardar` | Guardar en la propuesta / Guardar borrador de acomodo | AcomodoBase.jsx:1672-1682 | Guardar acomodo (dos estados) | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-floor-editor-piezas` | Floor editor: arrastrar / girar / quitar / duplicar muebles | PlanoAcomodo.jsx:139-156,449-482 · AcomodoBase.jsx:1690-1701 | Lienzo editable de acomodo | PRESENTE | diseno, direccion | visible |
| `uxParity-floor-elementos` | Poner elementos en el plano (puerta/columna/etc.) | AcomodoBase.jsx:1714-1723 | Paleta de elementos | PRESENTE | diseno, direccion | visible |
| `uxParity-floor-puerta-barrido` | Configurar puerta en el plano: abre →↓←↑ (bisagra) | AcomodoBase.jsx:1772-1791 | Mini-menú de puerta | PRESENTE | diseno, direccion | visible |
| `uxParity-floor-vaciar` | Vaciar el plano y acomodar yo | AcomodoBase.jsx:1729-1733 | Acción vaciar | PRESENTE | diseno, direccion | secundario |
| `uxParity-floor-reacomodar` | Que lo acomode Voni otra vez / Acomodar el resto (sin mover lo mío) | AcomodoBase.jsx:1734-1738 | Reacomodar respetando manual | PRESENTE | diseno, direccion | visible |
| `uxParity-floor-de-cero` | Acomodar todo de cero (pierde lo manual) | AcomodoBase.jsx:1741-1750 | Acción de reset con confirm | PRESENTE | diseno, direccion | secundario |
| `uxParity-floor-undo` | Deshacer / Rehacer | AcomodoBase.jsx:1751-1758 | Undo/redo | PRESENTE | diseno, direccion | secundario |
| `uxParity-floor-agregar-producto` | + Agregar otro producto (al banco) | AcomodoBase.jsx:1803-1811 | Acceso a catálogo desde el editor | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-floor-paleta` | Paleta muebles/sillas con conteo decreciente | AcomodoBase.jsx:1817-1843 | Paleta de piezas agrupada | PRESENTE | diseno, direccion | visible |
| `uxParity-floor-rellenar` | Oferta "poner todas en este cuarto" | AcomodoBase.jsx:1845-1860 | Sugerencia de relleno | PRESENTE | diseno, direccion | secundario |
| `uxParity-por-cuarto` | "Qué va en cada cuarto" (lista por escrito) + copiar | AcomodoBase.jsx:1868-1913 | Resumen por cuarto copiable | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-escenas-area` | Generar imagen por área (escenas IA) + guardar | AcomodoBase.jsx:1945-1988 | Galería de escenas por área | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-plano-leyenda` | Leyenda de tipos de mueble | AcomodoBase.jsx:1990-1994 | Leyenda del plano | PRESENTE | vendedor, diseno, direccion | técnico |
| `uxParity-dibujar-herramientas` | Herramientas de dibujo (cuarto/trazo/esquina/puerta/columna/escalera/curvo) | DibujarPlano.jsx:360-366 | Barra de herramientas del editor de plano | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-dibujar-plantillas` | Plantillas por giro (Corporativo/Legal/Startup/Callcenter) | DibujarPlano.jsx:372-375 | Plantillas de planta | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-dibujar-dimensionar` | Dimensionar a m² | DibujarPlano.jsx:476-480 | Acción dimensionar | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-dibujar-forma` | Cerrar forma / quitar punto / descartar / limpiar | DibujarPlano.jsx:487-494 | Controles de forma | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-dibujar-undo` | Deshacer / Rehacer (dibujo) | DibujarPlano.jsx:492-493 | Undo/redo editor plano | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-dibujar-cuarto` | Editar cuarto: nombre, medidas, doble altura, tipo, quitar | DibujarPlano.jsx:502-511 | Editor de cuarto | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-dibujar-listo` | Amueblar mi oficina → / Cancelar | DibujarPlano.jsx:521-522 | CTA del editor de plano | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ficha-pdf-imprimir` | Ficha PDF de mueble: Guardar/enviar PDF, Cerrar | FichaPDF.jsx:78-93 | Ficha de producto imprimible | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ficha-pdf-contenido` | Ficha PDF: especificación + render/foto + precio/IVA/condiciones | FichaPDF.jsx:20-187 | Plantilla de ficha de producto | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-cliente` | Cliente (input) de la cotización | Cotizacion.jsx:444 | Campo cliente | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-folio` | Folio (input) + sugerir folio | Cotizacion.jsx:454-461 | Campo folio con autogenerar | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-vacia` | Estado vacío: Cotizar con IA / Abrir Voni / Del banco | Cotizacion.jsx:516-522 | Empty state con CTAs | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-partidas` | Lista de muebles: cantidad ± / editar / quitar (móvil y escritorio) | Cotizacion.jsx:531-558,614-661 | Lista de partidas editable | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-navegar` | Agregar más muebles / Acomodar en el espacio | Cotizacion.jsx:558-559 | Accesos de navegación | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-mis-numeros` | Tabla interna "Mis números" (precio/costo/utilidad/margen/bajo piso) | Cotizacion.jsx:566-663 | Vista interna de economía | PRESENTE | direccion (economía) | secundario |
| `uxParity-cot-voni-senales` | Pregúntale a Voni (narración de señales) | Cotizacion.jsx:579-589 | Panel Voni de señales | PRESENTE | direccion, diseno | secundario |
| `uxParity-cot-toggle-vista` | Toggle "Mis números / Como la ve el cliente" | Cotizacion.jsx:915-916 | Switch de vista | PRESENTE | diseno, direccion | visible |
| `uxParity-cot-descuento` | Descuento de proyecto (%) + aviso de política + Máx. rentable | Cotizacion.jsx:669-681 | Control de descuento con guardarraíl | PRESENTE | vendedor (aviso), direccion (máx.) | visible |
| `uxParity-cot-ajustes` | Imprevistos de obra (%) / Maniobras (%) / Flete (%) | Cotizacion.jsx:683-695 | Controles de ajustes de obra | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-bajo-piso` | Alertas bajo piso / requiere aprobación de Dirección | Cotizacion.jsx:662,697 | Banner de aprobación requerida | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-render-muebles` | Imágenes de propuesta: foto de cada mueble (IA) | Cotizacion.jsx:704-705 | Generador de renders de mueble | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-render-oficina` | Una imagen de la oficina completa (IA) | Cotizacion.jsx:707-710 | Generador de render de oficina | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-ver-acomodo` | Ver el acomodo en 3D | Cotizacion.jsx:711 | Acceso al acomodo | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-imagen-propia` | Subir / quitar imagen propia de propuesta | Cotizacion.jsx:720-726 | Uploader de imagen de propuesta | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-cot-acomodo-no-cert` | Aviso "acomodo no certificado para cliente" | Cotizacion.jsx:727-732 | Banner de acomodo no certificado | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-propuesta-premium` | Propuesta premium cliente (portada/resumen/distribución/totales/condiciones) | Cotizacion.jsx:736-900 | Documento de propuesta | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-totales` | Escalera de totales cliente (descuento/subtotal/IVA/anticipo/saldo) | Cotizacion.jsx:843-868 | Bloque de totales | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-gate-emision` | Gate de emisión (estado + razones + lenguaje claro) | Cotizacion.jsx:946-981 · emisionUX.js:71-76 | Panel de estado de emisión | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-solicitar-aprobacion` | Solicitar aprobación a Dirección + motivo | Cotizacion.jsx:963-977 | Flujo de solicitud de aprobación | PRESENTE | vendedor | visible |
| `uxParity-cot-verificar` | Verificar emisión | Cotizacion.jsx:928-930 | Botón verificar | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-cot-excluidas` | Guardrail de exclusiones + checkbox obligatorio | Cotizacion.jsx:984-993 | Confirmación de exclusiones | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-porque-no-emito` | "¿Por qué no puedo emitir?" diagnóstico | Cotizacion.jsx:994-1018 | Diagnóstico de emisión | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-descargar-pdf` | Descargar PDF / Descargar BORRADOR | Cotizacion.jsx:294-328,919-921 | CTA descargar con estado | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-cot-imprimir` | Imprimir (impresión del navegador) | Cotizacion.jsx:334-357,923 | Acción imprimir | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-cot-candado` | Confirmar candado (ConfirmarCandado) | Cotizacion.jsx:1019-1025 | Modal de confirmación | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-comercial-tabs` | Tabs Comercial: Hoy / Proyectos / Productos / Dirección | comercial/Comercial.jsx:210-226 | Shell comercial con tabs | PRESENTE | vendedor (todas menos Dirección), direccion/diseno (Dirección) | visible |
| `uxParity-comercial-hoy` | Hoy: tarjetas que necesitan atención + abrir | comercial/Comercial.jsx:37-69 | Bandeja "Hoy" | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-comercial-direccion` | Dirección: KPIs, pipeline por etapa, motivos de pérdida | comercial/Comercial.jsx:73-122 | Tablero Dirección | PRESENTE | direccion, diseno | secundario |
| `uxParity-comercial-nuevo-proyecto` | Nuevo proyecto (alta cliente + proyecto) | comercial/Comercial.jsx:125-168 | Alta de proyecto | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-comercial-lista-proyectos` | Lista de proyectos + abrir | comercial/Comercial.jsx:171-202 | Lista de proyectos | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-producto-buscar` | Producto Maestro: buscar + filtrar por fuente | comercial/ProductoMaestro.jsx:51-55 | Buscador de catálogo | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-producto-precio` | Producto Maestro: lista con precio autorizado / no cotizable | comercial/ProductoMaestro.jsx:61-89 | Lista de productos con precio | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ws-header` | Workspace proyecto: header + KPIs (total/presupuesto/diferencia/próx. acción) | comercial/ProyectoWorkspace.jsx:54-68 | Header de workspace | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ws-solucion` | Workspace: Solución (reconciliación/layout/renders) + abrir acomodo | comercial/ProyectoWorkspace.jsx:115-180 | Sección Solución | PRESENTE | vendedor, diseno, direccion | secundario |
| `uxParity-ws-cotizaciones` | Workspace: cotizaciones del proyecto + abrir | comercial/ProyectoWorkspace.jsx:182-195 | Sección Cotización | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ws-escenarios` | Workspace: Escenarios (esencial/recomendada/premium/custom) + seleccionar | comercial/ProyectoWorkspace.jsx:197-224 | Sección Escenarios | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ws-dealdesk` | Workspace: Deal Desk (resolver aprobaciones) | comercial/ProyectoWorkspace.jsx:226-268 | Sección Deal Desk | PRESENTE | direccion | secundario |
| `uxParity-ws-ve` | Workspace: Presupuesto/VE (palancas + ranking) | comercial/ProyectoWorkspace.jsx:270-315 | Sección ingeniería de valor | PRESENTE | direccion, diseno | secundario |
| `uxParity-ws-diff` | Workspace: Revisiones (diff Rev1→Rev2) | comercial/ProyectoWorkspace.jsx:317-352 | Sección Revisiones | PRESENTE | direccion, diseno | secundario |
| `uxParity-ws-actividad` | Workspace: Actividad (próxima acción + nota/timeline) | comercial/ProyectoWorkspace.jsx:354-388 | Sección Actividad | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-ws-cierre` | Workspace: Cierre ganada/perdida + motivo | comercial/ProyectoWorkspace.jsx:390-464 | Sección Cierre | PRESENTE | direccion, diseno | visible |
| `uxParity-presentar-cliente` | Presentar al cliente ▸ (5 etapas) | comercial/ProyectoWorkspace.jsx:60 · comercial/PresentarCliente.jsx:70-139 | Modo presentación de proyecto | PRESENTE | vendedor, diseno, direccion | visible |
| `uxParity-presentar-nav` | Presentación: navegación atrás/siguiente/terminar + gate client-safe | comercial/PresentarCliente.jsx:47-67 | Navegación de presentación | PRESENTE | vendedor, diseno, direccion | secundario |

## 4. COCREAR + VONI + Admin/Infra

| id (uxParity-*) | función | ANTES (dónde vive hoy) | DESPUÉS (nuevo lugar UX) | Estado | rol | visible/secundario/técnico |
|---|---|---|---|---|---|---|
| `uxParity-cocrearIdeaTextarea` | Textarea "¿Qué quieres crear?" | CocrearV3.jsx:539 | Cocrear · pantalla de entrada, campo grande centrado | PRESENTE | todos | visible |
| `uxParity-cocrearEjemplos` | Chips de ejemplos (prefill) | CocrearV3.jsx:539 | debajo del textarea | PRESENTE | todos | secundario |
| `uxParity-cocrearAnalizarIdea` | "Crear conceptos con VONI →" | CocrearV3.jsx:539,254 (analizarIdea) | botón primario entrada | PRESENTE | todos | visible |
| `uxParity-cocrearDesdeCero` | "Empezar desde cero" | CocrearV3.jsx:539,293 (desdeCero) | botón secundario entrada | PRESENTE | todos | secundario |
| `uxParity-cocrearReferenciaImagen` | Subir imagen de referencia | CocrearV3.jsx:110,351 (onReferencia) | zona de carga en entrada y studio | PRESENTE | todos | visible |
| `uxParity-cocrearReabrirGuardada` | Lista "Guardadas" + reabrir | CocrearV3.jsx:539,436 (reabrir) | galería de tarjetas | PRESENTE | todos | visible |
| `uxParity-cocrearGuardadasReintento` | Reintentar carga de guardadas | CocrearV3.jsx:539 | inline en error | PRESENTE | todos | secundario |
| `uxParity-cocrearAlcanceProyecto` | Aviso "es un PROYECTO" → Cotizador por plano | CocrearV3.jsx:541 (detectarAlcanceCocrear) | banner superior conceptos | PRESENTE | todos | visible |
| `uxParity-cocrearResumenIdea` | Panel "Lo que entendimos" | CocrearV3.jsx:541 (resumenIdeaCocrear) | columna izq conceptos | PRESENTE | todos | visible |
| `uxParity-cocrearCouncilTexto` | Análisis VONI Council | CocrearV3.jsx:541,64 (councilText) | debajo del resumen | PRESENTE | todos | secundario |
| `uxParity-cocrearCandidatosCatalogo` | Candidatos de catálogo "¿ya existe en Von Haucke?" | CocrearV3.jsx:541 | tarjeta sobre los conceptos | PRESENTE | todos | visible |
| `uxParity-cocrearElegirConcepto` | Elegir concepto (3 tarjetas "Desarrollar →") | CocrearV3.jsx:541,286 (elegirConcepto) | 3 tarjetas | PRESENTE | todos | visible |
| `uxParity-cocrearReset` | "‹ Nueva idea" (reset) | CocrearV3.jsx:541,203 | encabezado | PRESENTE | todos | secundario |
| `uxParity-cocrearTipologia` | Cambiar tipología (select familia) | CocrearV3.jsx:546,295 (setFamilia) | panel Diseño izq | PRESENTE | todos | visible |
| `uxParity-cocrearCapacidad` | Personas/puestos (capacidad) | CocrearV3.jsx:546,296 (setCap) | panel Diseño | PRESENTE | todos | visible |
| `uxParity-cocrearMedidas` | Medidas ancho/fondo/alto | CocrearV3.jsx:546,294 (setDim) | panel Diseño | PRESENTE | todos | visible |
| `uxParity-cocrearMaterial` | Material (botones) | CocrearV3.jsx:546,297 (setMaterial) | panel Diseño | PRESENTE | todos | visible |
| `uxParity-cocrearTono` | Tono (claro/natural/oscuro) | CocrearV3.jsx:546,298 (setTone) | panel Diseño | PRESENTE | todos | visible |
| `uxParity-cocrearFunciones` | Funciones (toggle features) | CocrearV3.jsx:546,299 (toggleFeature) | panel Diseño | PRESENTE | todos | visible |
| `uxParity-cocrearRenderIA` | Render IA generar/regenerar | CocrearV3.jsx:560,227 (generarPara) | centro studio | PRESENTE | todos | visible |
| `uxParity-cocrearRenderStale` | Aviso render VENCIDO (stale) | CocrearV3.jsx:560,167 (rStale) | banda sobre el render | PRESENTE | todos | visible |
| `uxParity-cocrearVisual3D` | Modelo canónico 3D (Concepto/Despiece/4D + slider) | CocrearVisual.jsx:97,122,136; Orbit3D | centro studio | PRESENTE | todos | visible |
| `uxParity-orbit3DControles` | Girar/zoom/restablecer 3D | Orbit3D.jsx:54-73 | sobre el visor 3D | PRESENTE | todos | visible |
| `uxParity-cocrearHistorialRev` | Historial de revisiones (R1,R2…) | CocrearV3.jsx:560 | tira bajo el render | PRESENTE | todos | secundario |
| `uxParity-cocrearCompararAB` | Comparar A/B | CocrearV3.jsx:544,548,178 (compararVariantesProducto) | centro studio, modo A/B | PRESENTE | todos (Δcosto sólo veCostos) | secundario |
| `uxParity-cocrearGuardar` | Guardar co-creación | CocrearV3.jsx:544,435 (guardar) | encabezado studio | PRESENTE | todos | visible |
| `uxParity-cocrearVoniCodisenador` | VONI Co-diseñador (cambio en lenguaje natural) | CocrearV3.jsx:562,409 (pedirVoni) | columna der studio | PRESENTE | todos | visible |
| `uxParity-cocrearDesarrolloIndustrial` | VONI Industrial · desarrollo (diagnóstico) | CocrearV3.jsx:563,170 (diagnosticoDesarrolloProducto) | columna der | PRESENTE | todos | secundario |
| `uxParity-cocrearBajarLinea` | Bajar a BOM · A: escalar mueble de línea | CocrearV3.jsx:596-601,312 (bajarDesdeLinea) | columna der, "Bajar a BOM" | PRESENTE | todos | visible |
| `uxParity-cocrearPasarACostear` | Bajar a BOM · B: Pasar a Costear (mueble nuevo) | CocrearV3.jsx:603-606,322 (pasarACostear) | columna der | PRESENTE | Diseño/Dirección | visible |
| `uxParity-cocrearQuitarBom` | Quitar BOM | CocrearV3.jsx:585,592,319 (quitarBom) | con BOM cargado | PRESENTE | todos | secundario |
| `uxParity-cocrearAfinarCostear` | Afinar en Costear (con BOM) | CocrearV3.jsx:592,322 | con BOM cargado | PRESENTE | Diseño/Dirección | secundario |
| `uxParity-cocrearDificultad` | Dificultad de fabricación (Alba V1) | CocrearV3.jsx:610-612,320 (setDificultad) | columna der | PRESENTE | todos | visible |
| `uxParity-cocrearVerdadIndustrial` | Panel "Verdad industrial" (costo/estado/servidor) | CocrearV3.jsx:614 | columna der | PRESENTE | todos (costo sólo veCostos) | visible |
| `uxParity-cocrearCostearServidor` | Costear en el servidor | CocrearV3.jsx:615,391 (costearEnServidor) | columna der | PRESENTE | todos | visible |
| `uxParity-cocrearExplicacionCosteo` | "Cómo llegó VONI a este costo" (explicación) | CocrearV3.jsx:617,28 (explicarCosteo) | details plegable | PRESENTE | Diseño/Dirección | secundario |
| `uxParity-cocrearValidarIngenieria` | Validar ingeniería de esta revisión | CocrearV3.jsx:639,453 (validarIngenieria) | columna der | PRESENTE | Diseño/Dirección | visible |
| `uxParity-cocrearEstimadoDiseno` | Estimado de diseño (evidencia parcial) | CocrearV3.jsx:641,169 (estimadoDisenoCocrear) | columna der | PRESENTE | Diseño/Dirección | secundario |
| `uxParity-cocrearReferenciaComercial` | Referencia comercial real (precios comparables) | CocrearV3.jsx:643,168 (formatearReferenciaCocrear) | columna der | PRESENTE | todos | secundario |
| `uxParity-cocrearDebajoDelPadre` | Aviso "precio por DEBAJO del padre" | CocrearV3.jsx:590,475 (referenciaPadre) | panel BOM | PRESENTE | todos | secundario |
| `uxParity-cocrearConvertirPartida` | Convertir en partida | CocrearV3.jsx:645,492 (agregarCotizacion) | columna der, botón final | PRESENTE | todos (precio del servidor) | visible |
| `uxParity-cocrearV2Legacy` | CocrearV2 (variante legacy) | CocrearV2.jsx:45 | n/a | PRESENTE | — (no montado) | técnico |
| `uxParity-miniRenderIsometrico` | MiniRender (render isométrico por tipo) | MiniRender.jsx:141 | n/a a Cocrear | PRESENTE | Diseño/Dirección | técnico |
| `uxParity-propuestaVivaPresentacion` | PropuestaViva (presentación cliente) | PropuestaViva.jsx:44 | n/a a Cocrear | PRESENTE | todos | visible |
| `uxParity-voniCliente` | Nombre del cliente | Voni.jsx:313 | encabezado Voni | PRESENTE | todos | visible |
| `uxParity-voniPasos` | Navegación de 4 pasos (Espacio/Muebles/Acomodo/Propuesta) | Voni.jsx:45,318 (Pasos) | barra de pasos | PRESENTE | todos | visible |
| `uxParity-voniSubirPlano` | Paso 1 · subir plano | Voni.jsx:333,149 (subirPlanoAqui) | paso 1 | PRESENTE | todos | visible |
| `uxParity-voniConfirmarLectura` | Paso 1 · confirmar lectura del plano | Voni.jsx:346,157 (confirmarLectura) | compuerta ConfirmarLectura | PRESENTE | todos | visible |
| `uxParity-voniEmpezarEspacio` | Paso 1 · EmpezarEspacio (dibujar/listo/omitir) | Voni.jsx:352,359 | paso 1 | PRESENTE | todos | visible |
| `uxParity-voniDescribir` | Paso 2 · describir con CotizadorIA | Voni.jsx:487 | paso 2 (formulario) | PRESENTE | todos | visible |
| `uxParity-voniProgramaDetectado` | Paso 2 · Programa detectado del plano (aplicar) | Voni.jsx:388,466 | tarjeta programa | PRESENTE | todos | visible |
| `uxParity-voniRecomendacionesCasa` | Recomendaciones de casa (agregar) | Voni.jsx:402 | tarjeta programa | PRESENTE | todos | secundario |
| `uxParity-voniDuplicados` | Fusionar duplicados del programa | Voni.jsx:414 | tarjeta programa | PRESENTE | todos | secundario |
| `uxParity-voniAmbiguas` | Ambiguas: decidir zona / repartir | Voni.jsx:422 | tarjeta programa | PRESENTE | todos | visible |
| `uxParity-voniConflictoPrograma` | Conflicto de programa (conservar/sustituir/ambos) | Voni.jsx:85,454 (ConflictoPrograma) | tabla comparativa | PRESENTE | todos | visible |
| `uxParity-voniPilotoAutomatico` | Piloto automático (aviso) | Voni.jsx:260,383 | banner paso 2 | PRESENTE | todos | secundario |
| `uxParity-voniEstoEntendi` | Revisar "esto entendí" (cantidad/quitar/editar/variante) | Voni.jsx:532 (EstoEntendi) | paso 2 (revisar) | PRESENTE | todos | visible |
| `uxParity-voniVaciar` | Vaciar proyecto | Voni.jsx:516,186 | paso 2 | PRESENTE | todos | secundario |
| `uxParity-voniEditarPartida` | Editar partida | Voni.jsx:591 (EditarPartida) | modal | PRESENTE | todos | visible |
| `uxParity-voniCandadoAvanzar` | Candado cantidad/usuarios al avanzar | Voni.jsx:294,583 (ConfirmarCandado) | modal | PRESENTE | todos | visible |
| `uxParity-voniAcomodo` | Paso 3 · Acomodo | Voni.jsx:611 (Acomodo) | paso 3 | PRESENTE | todos | visible |
| `uxParity-voniPropuesta` | Paso 4 · Propuesta | Voni.jsx:629 (Cotizacion) | paso 4 | PRESENTE | todos | visible |
| `uxParity-voni2Fab` | FAB "Voni" (abrir panel) | App.jsx:1515-1527 (flag `voni_2`) | esquina flotante | PRESENTE | todos | visible |
| `uxParity-voni2Preguntar` | Preguntar (campo + enviar) | Voni2.jsx:69,39 (preguntar) | panel lateral | PRESENTE | todos (respeta rol) | visible |
| `uxParity-voni2Sugerencias` | Sugerencias (chips) | Voni2.jsx:74,36 | panel lateral | PRESENTE | todos | secundario |
| `uxParity-voni2GuiaRuta` | Guía de ruta | Voni2.jsx:63,37 (guiaRuta) | panel lateral | PRESENTE | todos | secundario |
| `uxParity-voni2Respuesta` | Respuesta (estado/pendientes/acción/evidencia/confianza) | Voni2.jsx:81-137 | panel lateral | PRESENTE | todos | visible |
| `uxParity-voni2Cerrar` | Cerrar (Esc / botón) | Voni2.jsx:51,60 | panel lateral | PRESENTE | todos | secundario |
| `uxParity-voniAvatar` | VoniAvatar (personaje) | VoniAvatar.jsx:12 | varios | PRESENTE | todos | técnico |
| `uxParity-asistenteFlujoPasos` | Flujo 6 pasos familia→mueble→opción→cantidad→precio→listo | Asistente.jsx:16,147 | pantalla única por pasos | PRESENTE | Diseño/Dirección | visible |
| `uxParity-asistenteEscoger` | Escoger familia/mueble/línea | Asistente.jsx:93-102 | pasos 1-3 | PRESENTE | Diseño/Dirección | visible |
| `uxParity-asistenteCantidad` | Cantidad / personas (bench) | Asistente.jsx:215,104 | paso 4 | PRESENTE | Diseño/Dirección | visible |
| `uxParity-asistenteMargen` | Margen (Poco/Normal/Bueno/Mucho) | Asistente.jsx:249 | paso 5 | PRESENTE | Diseño/Dirección | visible |
| `uxParity-asistenteVerDetalle` | Ver detalle (HojaCosto) | Asistente.jsx:275 | paso 5 | PRESENTE | Diseño/Dirección | secundario |
| `uxParity-asistenteAgregar` | Agregar a la cotización | Asistente.jsx:282,117 | paso 5 | PRESENTE | Diseño/Dirección | visible |
| `uxParity-asistenteFichaPDF` | Ver ficha PDF | Asistente.jsx:284 (FichaPDF) | paso 5 | PRESENTE | Diseño/Dirección | secundario |
| `uxParity-asistenteSellerSafe` | Redirección seller-safe a Voni | Asistente.jsx:134 | pantalla completa | PRESENTE | vendedor | visible |
| `uxParity-especialDescribir` | ¿Qué vas a costear? (describir) | AsistenteEspecial.jsx:1040,1059 | pantalla costear | PRESENTE | Diseño/Dirección | visible |
| `uxParity-especialSubirAnalizar` | Subir render o plano (PDF) → analizar IA | AsistenteEspecial.jsx:1044-1049,882 | atajo de carga | PRESENTE | Diseño/Dirección | visible |
| `uxParity-especialCantidad` | ¿Cuántas piezas iguales? | AsistenteEspecial.jsx:1084 | formulario | PRESENTE | Diseño/Dirección | visible |
| `uxParity-especialMateriales` | ¿De qué está hecho? (materiales) | AsistenteEspecial.jsx:1096 | formulario | PRESENTE | Diseño/Dirección | visible |
| `uxParity-especialPreguntasIA` | Centro de preguntas IA (responder / No sé) | AsistenteEspecial.jsx:1166-1230,801 (responderDespiece) | tarjeta de preguntas | PRESENTE | Diseño/Dirección | visible |
| `uxParity-especialCosto` | Costo del motor + por confirmar | AsistenteEspecial.jsx:1452 | panel de costo | PRESENTE | Diseño/Dirección | visible |
| `uxParity-especialValidarServidor` | Precios por aprobar (validar con servidor) | AsistenteEspecial.jsx:1521,1524,399 | panel precios | PRESENTE | Dirección | visible |
| `uxParity-especialAprobarPrecios` | Aprobar precios como Dirección | AsistenteEspecial.jsx:1537-1547,1542 (aprobarPrecio) | panel precios | PRESENTE | Dirección | visible |
| `uxParity-especialPreciosCompras` | Precios que requieren Compras (no aprobable) | AsistenteEspecial.jsx:1553 | aviso panel precios | PRESENTE | Compras | secundario |
| `uxParity-especialGenerarRender` | Generar render (aislado + ambiente) | AsistenteEspecial.jsx:1564,1583 (generarRenders) | sección render | PRESENTE | Diseño/Dirección | visible |
| `uxParity-especialGuardarBiblioteca` | Guardar / actualizar / duplicar en biblioteca | AsistenteEspecial.jsx:1601,1634,1636 | sección biblioteca | PRESENTE | Diseño/Dirección | visible |
| `uxParity-especialAprobarExpediente` | Aprobar expediente (validar servidor) | AsistenteEspecial.jsx:1618-1630 | sección biblioteca | PRESENTE | Dirección | visible |
| `uxParity-especialVerDetalleCosteador` | Ver detalle completo (Alba V1) → Costeador | AsistenteEspecial.jsx:1650 (onVerDetalle) | botón final | PRESENTE | Diseño/Dirección | visible |
| `uxParity-informeIAtablero` | InformeIA (tablero de secciones) | AsistenteEspecial.jsx:1281; InformeIA.jsx:49 | panel informe | PRESENTE | Diseño/Dirección | secundario |
| `uxParity-especialDesdeCocrear` | "Viene de Cocrear": analizar imagen de referencia | AsistenteEspecial.jsx:1027-1030,549 | banner superior | PRESENTE | Diseño/Dirección | visible |
| `uxParity-especialVolverCocrear` | Regresar a Cocrear con el despiece | AsistenteEspecial.jsx:563 (onVolverCocrear) | botón volver | PRESENTE | Diseño/Dirección | visible |
| `uxParity-bibliotecaBuscar` | Buscar biblioteca | Biblioteca.jsx:47,20 (recargar) | buscador | PRESENTE | Diseño/Dirección | visible |
| `uxParity-bibliotecaAbrir` | Abrir expediente | Biblioteca.jsx:29,65 | tarjeta | PRESENTE | Diseño/Dirección | visible |
| `uxParity-bibliotecaNuevo` | + Nuevo producto | Biblioteca.jsx:49 | botón | PRESENTE | Diseño/Dirección | visible |
| `uxParity-bibliotecaMostrarPruebas` | Mostrar pruebas (QA/RC) | Biblioteca.jsx:53 | checkbox | PRESENTE | Diseño/Dirección | secundario |
| `uxParity-bibliotecaInicio` | Ir a inicio | Biblioteca.jsx:42 | botón | PRESENTE | Diseño/Dirección | secundario |
| `uxParity-archivoDescargarRespaldo` | Descargar respaldo local | Archivo.jsx:85,40 (exportarRespaldo) | tarjeta respaldo | PRESENTE | todos (contenido por rol) | visible |
| `uxParity-archivoRestaurarRespaldo` | Restaurar respaldo | Archivo.jsx:87,46 (restaurarRespaldo) | tarjeta respaldo | PRESENTE | todos | visible |
| `uxParity-archivoBuscar` | Buscar presupuestos | Archivo.jsx:99,72 | buscador | PRESENTE | todos | visible |
| `uxParity-archivoAbrir` | Abrir presupuesto | Archivo.jsx:145 (onAbrir→App:1394) | tarjeta | PRESENTE | todos | visible |
| `uxParity-archivoSacarLista` | Sacar de la lista (archivar) | Archivo.jsx:147 | tarjeta | PRESENTE | todos | secundario |
| `uxParity-archivoMpCambio` | Aviso "la MP cambió" | Archivo.jsx:136 (mpCambio) | tarjeta | PRESENTE | todos | secundario |
| `uxParity-archivoEmisionesPDF` | Ver emisiones + PDF de una revisión | Archivo.jsx:167,192 | tarjeta expandible | PRESENTE | todos | visible |
| `uxParity-tableroKPIs` | Franja de KPIs | Tablero.jsx:80 | encabezado tablero | PRESENTE | Dirección | visible |
| `uxParity-tableroAlertas` | Alertas (bajo margen / precios viejos) | Tablero.jsx:66-95 | tablero | PRESENTE | Dirección | visible |
| `uxParity-tableroGraficas` | Gráficas (composición/desperdicio/lote) | Tablero.jsx:104,126,143 | tablero | PRESENTE | Dirección | visible |
| `uxParity-tableroUltimasPiezas` | Tabla últimas piezas | Tablero.jsx:159 | tablero | PRESENTE | Dirección | secundario |
| `uxParity-tableroSaludNegocio` | Salud del negocio (financieros) | Tablero.jsx:186 | tablero | PRESENTE | Dirección | visible |
| `uxParity-reglasLista` | Lista de reglas por ámbito | Reglas.jsx:148 | lista por secciones | PRESENTE | lectura: todos | visible |
| `uxParity-reglasEditar` | Enseñar / cambiar / quitar regla | Reglas.jsx:84,167,182 (Editor) | editor | PRESENTE | Diseño/Dirección | visible |
| `uxParity-reglasAprendido` | "Lo que ha aprendido sola" | Reglas.jsx:93 | lista | PRESENTE | lectura: todos | secundario |
| `uxParity-reglasAprobarLeccion` | Aprobar / descartar lecciones pendientes | Reglas.jsx:101-116 | tarjeta pendientes | PRESENTE | Diseño/Dirección | visible |
| `uxParity-reglasConvertirOlvidar` | Convertir lección en regla / que la olvide | Reglas.jsx:128-139 | acciones por lección | PRESENTE | Diseño/Dirección | secundario |
| `uxParity-usuariosAlta` | Dar de alta a alguien | Usuarios.jsx:109,35 (agregar) | formulario | PRESENTE | Dirección | visible |
| `uxParity-usuariosPasswordUnaVez` | Contraseña de una sola vez | Usuarios.jsx:131 | tarjeta ámbar | PRESENTE | Dirección | visible |
| `uxParity-usuariosCambiarRol` | Cambiar rol | Usuarios.jsx:167,64 (cambiarRol) | select en tabla | PRESENTE | Dirección | visible |
| `uxParity-usuariosQuitar` | Quitar usuario | Usuarios.jsx:176,81 (eliminar) | tabla + diálogo | PRESENTE | Dirección | visible |
| `uxParity-usuariosLista` | Lista de acceso | Usuarios.jsx:151 | tabla | PRESENTE | Dirección | visible |
| `uxParity-aprobacionesPendientes` | Lista + aprobar/rechazar | AprobacionesPendientes.jsx:41,23 | tarjeta (dentro de Archivo) | PRESENTE | Dirección | visible |
| `uxParity-conflictoVerServidor` | "Ver la versión del servidor" | ConflictoGuardado.jsx:35; App.jsx:644 | banner superior | PRESENTE | todos | visible |
| `uxParity-conflictoReaplicar` | "Volver a aplicar mis cambios" | ConflictoGuardado.jsx:38; App.jsx:733 | banner superior | PRESENTE | todos | visible |
| `uxParity-respaldoDiferencias` | Diferencias respaldo vs servidor | RespaldoConflicto.jsx:40 | banner persistente | PRESENTE | todos | visible |
| `uxParity-respaldoRecuperar` | "Recuperar mis cambios" | RespaldoConflicto.jsx:64; App.jsx:678 | banner persistente | PRESENTE | todos | visible |
| `uxParity-respaldoDescartar` | "Descartar mi respaldo" | RespaldoConflicto.jsx:67; App.jsx:717 | banner persistente | PRESENTE | todos | secundario |
| `uxParity-confirmarCandado` | Confirmar candado usuarios/cantidad | ConfirmarCandado.jsx:59 | modal | PRESENTE | todos | visible |
| `uxParity-cargandoLoader` | Loader de marca (Cargando) | Cargando.jsx:16 | overlay | PRESENTE | todos | técnico |
| `uxParity-analisisEstructural` | Análisis estructural IA (checklist + diff) | AnalisisEstructural.jsx:29; Costeador.jsx:357 (flag `costing_ai_v2`) | panel plegable en Costeador | PRESENTE | Diseño/Dirección | secundario |

## Resumen de paridad

- **Total de funciones inventariadas:** 471
  - Clúster 1 (Navegación, Home y Roles): 116
  - Clúster 2 (Costear + ERP/Precios/Catálogo): 98
  - Clúster 3 (Cotizar + Acomodo/Planos/PDF): 128
  - Clúster 4 (Cocrear + Voni + Admin/Infra): 129
- **PRESENTE (destino definido):** 461
- **PRESENTE · destino por consolidar (panel legacy Inicio.jsx):** 10
- **FUNCTION_LOSS = 0** — ninguna función desaparece; el rediseño sólo reubica, nunca elimina.
