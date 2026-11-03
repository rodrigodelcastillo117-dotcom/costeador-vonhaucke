# 95_SELLERSAFE_UI_NAVEGADOR — seller-safe en el DOM renderizado real (2026-11-03)

E2E en navegador (Playwright + Chromium headless por el proxy del contenedor, sin desactivar TLS). Contra prod
`costeador-vonhaucke.vercel.app`, footer `v1.0.0 · 2b78f57` (commit desplegado confirmado). **Lectura pura: no se creó,
modificó ni emitió nada.** Login real de los dos roles. Cierra el hueco que la certificación por API/datos no cubría:
¿la UI React *renderiza* algún costo/margen a un vendedor?

## Método
Scripts: `scratchpad/sellersafe_ui.mjs` (login + enumerar menú + escanear léxico) y `sellersafe_nav.mjs` (entrar a las
pantallas de datos del vendedor). Léxico sensible escaneado en `document.body.innerText`:
`margen, utilidad, ganancia, costo unitario, costo total, costo de, precio de compra, proveedor, insumo, despiece, merma,
mano de obra, hora-hombre`.

## Resultado — contraste de roles (evidencia visual: `ui_vendedor_home.png`, `ui_direccion_home.png`)

| | Vendedor (`ventasprueba`, rol vendedor) | Dirección (`qa-direccion`, solo lectura de UI) |
|---|---|---|
| Flujos principales | 01 COTIZAR · 03 COCREAR | 01 COTIZAR · **02 COSTEAR** · 03 COCREAR |
| Herramientas | Cotizar de línea, Cotizar varios IA, Banco de precios, Presupuestos anteriores, Comercial·Proyectos, Lo que Voni sabe | + **Costeo manual, Materiales, Dirección·ver el negocio, Usuarios y accesos, Cargar compras del ERP** |
| Manual (temas por rol) | 31 · Ventas | 46 · Dirección |
| Léxico de costo en DOM | **ninguno** (`lexiconHits: []`) | `despiece` (esperado: describe la tarjeta Costear) |

**Borde seller-safe = exactamente la diferencia de menú.** El vendedor NO tiene ruta a: Costear (02), Costeo manual,
Materiales, Dirección (ver el negocio), Usuarios y accesos, Cargar compras del ERP. Comparten: Cotizar, Banco de precios
(precios de **venta**, permitido a ventas), Presupuestos, Comercial, Lo que Voni sabe.

### Pantallas de datos del vendedor (entradas reales, lectura)
Navegadas como vendedor; léxico de costo en cada una = **[]**:
- "Presupuestos que ya hicimos" (Presupuestos anteriores) → sin léxico de costo.
- "Banco de precios" → sin léxico de costo (son precios de venta).
- "Comercial · proyectos y propuestas" → sin léxico de costo.

La app se autodocumenta el modelo en su propio manual: **"Ventas ve precios. Diseño ve costos. Dirección ve todo."**

## Veredicto
**Seller-safe confirmado también en la capa de UI renderizada**, no solo en datos/API. El vendedor no tiene ruta a ninguna
pantalla de costeo y su DOM no contiene léxico económico sensible en home ni en sus 3 pantallas de datos. Esto se suma a la
certificación previa server-side (RPCs de costo → 400; tablas de economía → 42501; `partidas_vendedor` hace strip recursivo
de economía) del `95_SEGURIDAD_EMISION_QA.md`.

## Residual honesto (lo que ESTE test no probó)
- Las 3 pantallas de datos del vendedor pueden estar vacías para `ventasprueba` (no posee propuestas), así que se probó
  "no fuga + no ruta de costo", no "una propuesta POBLADA abierta por el vendedor oculta las columnas de costo". Ese caso
  está cubierto por el strip server-side `partidas_vendedor` (ya certificado), pero no se re-verificó con una propuesta
  poblada abierta en el navegador por el vendedor.
- No es un pentest de red (no se interceptó el tráfico XHR del vendedor para ver si el backend le manda costo que la UI
  esconde). El seller-safe por DATOS ya cubre eso: el backend no le devuelve economía (RPCs 400 / tablas 42501).
- `qa-direccion` se usó SOLO para leer la UI (enumerar menú). No se aprobó, certificó ni emitió nada con esa cuenta.
