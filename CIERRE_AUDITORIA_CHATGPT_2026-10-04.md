# Cierre de auditoría (ChatGPT + Claude) — Von Haucke · 2026-10-04 (noche)

> Trabajo autónomo nocturno. Prioridad #1 de Rodrigo: **que costeo y cotización sean
> CORRECTOS**. Frontera de seguridad respetada: **no se tocó nada que pueda romper
> login/demo** (edge functions de auth, borrado de contraseñas, REVOKE/RLS de auth,
> promoción a producción). Esos hallazgos server-side quedan **verificados y con el
> fix exacto listo** para tu "va", no ejecutados a ciegas.

## Identidad del sistema (verificado)
- **Repo/rama:** `costeador-vonhaucke`, rama `c3.4-seller-safe` (NO main).
- **SHA al cerrar:** visible ahora en la app (`v1.0.0 · <sha>` en el Login).
- **Supabase (prod, único):** `mtuvnbgljwbsaizjjgzs`.
- **Vercel producción:** `costeador-vonhaucke.vercel.app` — **INTACTA** (nunca se le desplegó).
- **Release candidate:** `vonhaucke-rc.vercel.app` — aquí está TODO este trabajo.
- **Nota sobre "muchos deployments más nuevos que prod":** es **por diseño**. Los candados
  prohíben deploy a producción; cada avance va a la preview `vonhaucke-rc`. No es un bug.

## VEREDICTO DEL MÉTODO DE COSTEO/COTIZACIÓN (lo que más te importa)
**El método es correcto.** Evidencia:
- El **cálculo** vive en `src/motor/calculo.js`, cubierto por pruebas **golden al centavo**
  (Alpura, Alba/bench, cutover). 603/603 pruebas verdes.
- El **costeo LIVE es client-side** (motor en el navegador) con los **92 insumos curados de
  `config`** y **fail-closed** cuando falta material (bloquea emisión, no inventa $0 válido).
- **Producto nuevo** (Costear especial) usa **Alba V1** (el calibrado), no los factores viejos.
- `catalogo_vigente` (254) tiene sólo **30 aprobado/certificable**; **no** pisa a `config` (el
  motor no lo usa como fuente). No hay "precio propuesto convertido en oficial" en el camino vivo.
- Las **variables de línea** (producto, medidas, color, acabado, biombo, casillas) mueven el
  costo correctamente y **lo que se resalta = lo que se cotiza** (verificado en vivo:
  App LT, color ivory→Black bajó costo $4,299→$4,175).

Riesgo real NO es "precio incorrecto en el demo"; es **deuda arquitectónica** (una sola
autoridad de costo cuando el flujo migre a servidor) y **seguridad del path server** (abajo).

---

## TABLA DE HALLAZGOS

| ID | Sev | Hallazgo | Causa raíz | Superficie | Cambio | Prueba | Resultado |
|----|-----|----------|-----------|-----------|--------|--------|-----------|
| C-01 | P0 | Vendedor podía `select * from config` crudo y leer TODOS los costos/márgenes por API/DevTools | RLS `config_leer` = `puede_entrar()` (cualquiera) | DB RLS | `ALTER POLICY config_leer USING (puede_editar_config())` (migración reversible) | Policy verificada = `puede_editar_config`; front lee por RPC, realtime solo veCostos | **CERRADO** |
| C-02 | P0 | Precio no finito podía llegar a UI/emisión (Infinity→JSON null = "válido + precio null") | `precioDe` devolvía Infinity con margen≥100% | motor + totales + senales | margen acotado <100%; costo no-finito→0; totales marca `hayLineaInvalida`; emisión exige `Number.isFinite` | +10 tests `dineroFinito.test.js` | **CERRADO** |
| C-03 | P0 | Veta mal orientada → piezas largas "no caben" y se subcostean | largo de pieza alineado al lado corto del tablero | motor | veta alinea largo∥2440; +2 tests; `MOTOR_VERSION` 2026-10-03 | golden Alpura/Alba intactos | **CERRADO** (sesión previa) |
| C-04 | P0 | App LT cotizaba melamina base ($1,335.6) en vez del ivory verificado ($1,122.3) | UI mandaba `color:null`, anulaba default del generador | `applt.js` + `CosteadorLinea` | `config.color||'ivory'`; chip resalta `colorEfectivo` | caract. 17491.39/8097.86; verificado en vivo | **CERRADO** (sesión previa) |
| C-05 | P0 | Modulor cobraba cerradura/zoclo con casilla desmarcada | default del generador `true`, UI arrancaba {} | `modulor.js`+`CosteadorLinea` | casillas `def:true`, UI arranca desde default | 603/603 | **CERRADO** (sesión previa) |
| C-06 | P0 | Vendedor sin alerta de piso al descontar hasta 60% | piso medido por COSTO (que el vendedor no tiene) | `Cotizacion.jsx`+`CosteadorLinea` | piso por `catalogo.minimo` (precio, seller-safe) | 603/603 | **CERRADO** (sesión previa) |
| C-07 | P0 | Costo/margen/BOM sembrados en el estado del vendedor | se corría el motor y se guardaba economía para `!veCostos` | `App.jsx`+`EditarPartida` | no correr motor ni guardar economía si `!veCostos` | 603/603 | **CERRADO** (sesión previa) |
| C-08 | P1 | Login colgado/parpadeo/enlace caducado mudo | sin timeout/reintento; otp_expired sin mensaje; recuperando pegado | `nube.js`+`App.jsx`+`Login` | timeout 8s, reintento 3×, mensaje otp, limpia recuperando | verificado en vivo (banner+hash limpio) | **CERRADO** (sesión previa) |
| C-09 | P1 | Cierre comercial sumaba TODAS las cotizaciones + inventaba `revision_ganadora_id=1`; botones en silencio | lógica de cierre + sin revisar `{error}` | `ProyectoWorkspace.jsx` | elegir cotización ganadora (total/id real); revisar errores; `resuelto_por`=usuario real | 603/603; schema verificado | **CERRADO** (sesión previa) |
| C-10 | P1 | Motor: lote NaN/negativo, merma≥100% rompían el costo | sin clamps | motor | `Number(piezas)||1`; merma<95% | tests | **CERRADO** (sesión previa) |
| C-11 | P1 | "Lo que Voni sabe" inalcanzable para ventas | sólo en panel Costear | `Inicio.jsx` | enlace en pie del Inicio para todos | humo 54/54 | **CERRADO** (sesión previa) |
| C-12 | P2 | No se sabía qué commit está en vivo | sin trazabilidad de build | `vite.config.js`+`Login` | inyecta `__BUILD_SHA__/DATE/VERSION`, visible en Login | en vivo: `v1.0.0 · 25510cb` | **CERRADO** |

### VERIFICADO y DOCUMENTADO — requiere tu "va" (server-side; no se tocó para no arriesgar el demo)

| ID | Sev | Hallazgo (verificado read-only) | Fix listo | Por qué no se ejecutó de noche |
|----|-----|----------------------------------|-----------|------------------------------|
| S-01 | P0 | `generar-render` `verify_jwt=false` y sin validar sesión → cualquiera puede quemar la llave Gemini | Añadir `verify_jwt=true` + `requireUser()`+`requireCapability()`+rate-limit+límites de payload | Redeploy de edge function demo-crítica; si falla, se cae el render EN el demo, y no puedo probar "con JWT válido" sin tu cuenta |
| S-02 | P0 | 9 contraseñas en claro en `credenciales_temporales` | Dejar de escribir `password_temporal` en edge `usuarios`; migrar a invite/reset; limpiar la columna | Rompe el feature "excel de credenciales" que pediste; es decisión tuya (seguridad vs ese excel) |
| S-03 | P0 | `usuarios` `verify_jwt=false` + bootstrap abierto; `crear` puede resetear contraseña de cuenta existente | `verify_jwt=true`, retirar bootstrap, separar crear/invitar/reset/rol, validar rol en `crear`, CHECK de rol en `permitidos` | Toca auth de usuarios reales; un error bloquea accesos; "no cambiar login/usuarios" |
| S-04 | P0 | `app` edge function (`verify_jwt=false`) sirve un **frontend viejo de agosto** desde Storage | Deprecar `app` function tras confirmar 0 callers | Prod; verificar callers primero |
| S-05 | P1 | Emisión LIVE usa `emitir_revision` (legacy, menos estricta); `v2` no revalida piso ni recalcula totales ni exige `producto_id` | Migrar front a `emitir_revision_v2` endurecida (recalcular todo server-side, validar piso+aprobación, exigir identidad), luego REVOKE legacy | Cambia el flujo de emisión; emisión casi no se usa (34 borradores, 0 folios), pero romperla sería grave; necesita pruebas con datos clonados |
| S-06 | P1 | `cotizar-servidor` manda `p_fecha: null` → NULL no dispara DEFAULT CURRENT_DATE; usar business_date MX | Normalizar `fechaEfectiva` server-side (TZ America/Mexico_City) | Edge function (path shadow hoy) |
| S-07 | P1 | `costear-servidor` (SHADOW, no live) pasa `pieza` del cliente al motor; acepta `comp.insumo` inline y `margen` del cliente | DTO allowlist estricto; rechazar props monetarias; margen sólo server-side | Edge function; NO está en el camino vivo (el costeo vivo es client-side), así que no afecta el demo |
| S-08 | P1 | `aprendizajes` UPDATE abierto a cualquier `authenticated` (qual=true) → poisoning interno de Voni | RLS por ownership/moderación (dirección manda) | Prod RLS; riesgo sólo interno (10 usuarios de la casa) |
| S-09 | P1 | `producto_version_economia` vacía → Dirección ve `economia_estado=costo_desconocido` en Producto Maestro | Backfill SÓLO con costo reproducible/certificado; NULL+estado si no | Requiere decidir fuente de costo certificada (no inventar) |
| S-10 | P2 | `bootstrap-temp-claude` ACTIVE (responde 410); 9 FKs sin índice; `auth_rls_initplan`×13; policies permissive duplicadas | Retirar función; crear índices donde EXPLAIN lo justifique; patrón `(select auth.fn())` | Optimización; no bloquea demo |

---

## Resumen ejecutable
- **Cambios aplicados (seguros, reversibles):** 1 migración DB (C-01, reversible), motor
  `calculo.js`, `totales.js`, `senales.js`, `applt.js`, `modulor.js`, `colorMelamina.js`,
  `CosteadorLinea.jsx`, `Cotizacion.jsx`, `EditarPartida.jsx`, `App.jsx`, `nube.js`,
  `Login.jsx`, `Inicio.jsx`, `ProyectoWorkspace.jsx`, `Comercial.jsx`, `PropuestaViva.jsx`,
  `vite.config.js`. Tests nuevos: `dineroFinito.test.js` (+ veta en `calculo.test.js`).
- **Pruebas:** 603/603 vitest. Build OK. Humo 54/54 pantallas montan. **Cero** errores de consola.
- **Migración SQL:** `config_leer_solo_vecostos_cerrar_leak_costo` (reversible con
  `ALTER POLICY config_leer ON public.config USING (puede_entrar());`).
- **Deploy preview:** `vonhaucke-rc.vercel.app` (con `--build-env GIT_SHA=<sha>`).
- **Producción:** sin cambios (rollback = no se tocó).

## VEREDICTO: **NO LISTO PARA CEO — con matices importantes**
El **demo funcional** (login, costear, cotizar de línea con variables, Voni, 3D, Propuesta
Viva) está **sólido y verificado**, y el **método de costeo/cotización es correcto**. PERO,
según los criterios estrictos del audit, quedan **bloqueadores de seguridad server-side** que
yo, de forma responsable, **no ejecuté de madrugada** porque comparten la BD de prod y pueden
romper login/render/emisión sin que tú puedas verificar:

**Bloqueadores concretos restantes (todos con fix listo, requieren tu "va"):**
1. **S-01** `generar-render` sin autenticación (quema de llave Gemini).
2. **S-02** 9 contraseñas en claro (decisión tuya por el "excel de credenciales").
3. **S-03** `usuarios`: bootstrap abierto + reset silencioso de contraseña.
4. **S-05** emisión legacy sin revalidación de piso/totales (si vas a emitir folios en el demo).

**Para el lunes:** si el demo es **mostrar** (costear/cotizar/Voni/render/propuesta) sin emitir
folios oficiales ni exponer el endpoint de render, estás **bien**. Si el demo incluye **emitir
cotizaciones oficiales** o te preocupa el costo de la llave de IA, hay que cerrar S-01 y S-05
antes — dame el "va" y los ejecuto con pruebas sobre datos clonados y rollback listo.
