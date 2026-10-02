# BACKLOG COTIZADOR / SEGURIDAD — Von Haucke (modo nocturno 2026-10-02)

Oportunidades detectadas durante el modo nocturno. **NO construidas**
(instrucción: "NO AGREGAR FEATURES. AFINAR LO EXISTENTE. Si detectas una oportunidad
nueva, anótala en backlog; no la construyas"). Complementa `BACKLOG-COSTEADOR.md`.
Prioridad P0 > P1 > P2 > P3.

---

## P0 — Cierre real de la fuga de costo al vendedor (lo único P0 que queda)

### B-01 · Cutover frontend a precio server-authoritative (C3.4) + corte de `config.insumos`
**Estado:** server listo y verificado; frontend NO cortado; requiere smoke por rol (sesión humana).
**Por qué:** `leerConfig()` (`src/nube.js:28`) entrega `config.datos.insumos` (COSTO de material)
a TODOS los roles incl. vendedor (`src/App.jsx:411-417`; `aplicarCompartido` App.jsx:149-151).
No es sólo pantalla: el vendedor lo tiene en `estado.insumos` (DevTools/network).
**Ya desplegado y verificado:** RPC `config_para_rol()` → config COMPLETO a Dirección/Diseño,
SANITIZADO al vendedor (sin precio/precioBase/proveedor en insumos; sin horas/factores en piezas;
sin costoHora/margen/utilidad/factores en parámetros). Prueba: 92/92 insumos sin costo, 0 keys
económicas recursivas, conserva IVA/descuento/maniobras.
**Falta (gated por smoke humano por rol):**
1. `src/nube.js` `leerConfig()` → `nube.rpc('config_para_rol')`. `suscribirConfig` role-aware.
2. Rerutar el precio del vendedor en las 4 superficies que hoy lo derivan del MOTOR de costo:
   `Asistente.jsx` (:63/:84/:236), `Catalogo.jsx` (:22/:66), `CosteadorLinea.jsx` ruta sin
   presupuesto (`lineas.js:215/:233`), `CotizadorIA.jsx` ítems no-catálogo (`lineas.js:269/:391`).
   Tomar precio AUTORIZADO (precioListaDe/`l`, banco.precio, PRECIOS_VENTA, o cotizar-servidor por
   producto_id) y FALLAR-CERRADO ("sin precio autorizado — requiere costeo"); NUNCA $0.
3. Sólo después: cerrar RLS `config_leer` (`puede_entrar()` → `puede_editar_config()`), rollback listo.
**Riesgo de hacerlo a ciegas:** el motor degrada SILENCIOSO a $0 (`calculo.js:478/591/722`) y los
displays vivos no consultan `costeoEmitible`. Cortar insumos sin reroute => $0 al cliente = fallo
silencioso de dinero (P0). Por eso quedó para smoke por rol.
**Rollback cierre RLS:** `alter policy config_leer on public.config using (puede_entrar());`

### B-02 · Lectura seller-safe de cotizaciones/revisiones por el vendedor (C3.5 lectura)
RLS ya limita a dueño-o-editor, pero las `partidas` del propio vendedor (y 33 legacy) traen
`costoUnitario` en el JSON (la UI lo oculta; el dato llega al browser). Ya existe y verificado:
`cotizacion_segura(id)` + `jsonb_sin_economia` (868 cost-keys → 0 en los 33). Falta: que el vendedor
lea por esa vía (`nube.js`, `cotizaciones.js:listarCotizaciones`, `Archivo.jsx`, `Cotizacion.jsx`).

### B-03 · Emisión server-authoritative de precio (Principio #1 completo) — Línea V2
`emitir_revision` valida consistencia interna + anti-tamper de partidas, pero NO cruza
`precioUnitario` contra el precio AUTORIZADO (resolver/Lista V1). Falta Línea V2 (partidas con
producto_id/producto_version_id/lista_precio_item_id) y que `emitir_revision` revalide cada
precio contra `resolver_precio_autorizado`.

---

## P1 — Hardening de integridad (afinar lo existente)

- **B-10 · Fail-closed en displays vivos del motor:** `CosteadorLinea/Asistente/Catalogo` muestran $0
  cuando `calcular()` ignora componentes por insumo faltante, en vez de consultar `costeoEmitible`.
  Latente hoy (insumos presentes). Fix sólo en displays del cotizador, NO en el motor congelado.
- **B-11 · Emisión/folio detrás de aprobación (Deal Desk):** `asignar_folio_oficial` lo puede llamar
  cualquier `permitido`. Es atómico/idempotente (concurrencia OK), pero la autoridad de emisión
  debería requerir aprobación cuando exista Deal Desk.
- **B-12 · `renders.costo_estado`:** es un ESTADO, no un valor; el vendedor necesita renders.
  Conviene una vista de renders sin esa columna.

---

## P2/P3 — FEATURES NUEVAS DETECTADAS (NO construir; registradas por petición)

Del "MODO AUTÓNOMO NOCTURNO", pero bajo "NO AGREGAR FEATURES":
N3 IA de costeo (piezas inferidas) · N4 planos de costeo · N5 planos de edificio · N6 acomodo ·
N7 editor libre de layout · N8 renders aislado+ambiente/metadata · N10 CRM/Proyecto workspace ·
N11 Voni 2.0 · N12 escenarios (Esencial/Recomendada/Premium) · N13 presupuesto+value engineering ·
N14 Deal Desk/aprobaciones por hash · N15 propuesta/PDF premium desde snapshot · N16 diff de
revisiones · N17/N18 negociación/follow-up/cierre · N19 "Hoy" · N20 Dashboard Dirección ·
WOW Modo Presentación Cliente (client-safe por diseño, 0 keys económicas).

Regla al construirlas: sobre cotizar-servidor + Producto Maestro, una por una, cada una con smoke
por rol; ninguna reintroduce cálculo de dinero en el navegador.
