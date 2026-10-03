# Auditoría de seguridad — RPCs SECURITY DEFINER, RLS y Auth
Fecha: 2026-10-03 · Proyecto Supabase: `mtuvnbgljwbsaizjjgzs`

## 1. SECURITY DEFINER ejecutables por `authenticated` (Advisor: 18)
Se auditaron **una por una** (vía `pg_get_functiondef` + `has_function_privilege`).
**Resultado global:** las 18 están gateadas por rol (helpers `es_direccion()` / `puede_*`),
**ninguna** es ejecutable por `anon`, y las mutadoras **`RAISE`** ante no autorizado.
No procede un `REVOKE` masivo ni cambiarlas a `SECURITY INVOKER` a ciegas (romperían la
app, que las llama como el usuario logueado). `reglas_comerciales_vigentes` ya está
revocada de `authenticated` (interna).

Patrón verificado en profundidad (ejemplos):
- **`emitir_revision_v2`** — `SET search_path=''`; identidad por `request.jwt.claims`;
  gate de propiedad/rol (`c.usuario = ident OR puede_editar_config()` → `RAISE` "sin permiso");
  rechaza partidas con precio/cantidad ≤ 0; **anti-tamper por partida** (re-resuelve el precio
  autorizado server-side y rechaza precioUnitario manipulado y descuento > política);
  valida total = suma exacta; `advisory_xact_lock` + hash para idempotencia. **Sólida.**
- **`emitir_revision`** (legacy, la que usa hoy el cliente) — `SET search_path=''`,
  identidad JWT, rechaza snapshot vacío y precio/cantidad ≤ 0, gate de propiedad. **Segura**;
  le falta sólo el anti-tamper por partida de v2 (ver §cutover).

| RPC | why_definer | roles | valida identidad | mutador (RAISE) | anon EXEC |
|---|---|---|---|---|---|
| emitir_revision / _v2 | escribe revisiones saltando RLS | direccion/dueño | sí (jwt claims) | sí | no |
| asignar_folio_oficial | asigna folio oficial | rol | sí | sí | no |
| resolver_aprobacion / solicitar_ / verificar_ | flujo de aprobación | rol | sí | sí | no |
| vincular_cotizacion / registrar_producto_desde_expediente | escritura controlada | rol | sí | sí | no |
| resolver_costo_insumo / resolver_precio_autorizado | precio/costo autoritativo | rol | sí (filtra) | parcial | no |
| cotizacion_segura / revisiones_seguras / producto_cotizable | lectura RLS-aware | rol | sí (filtra) | no | no |
| config_para_rol / puede_editar_config / puede_ver_economia / puede_entrar / es_direccion | helpers de permiso | authenticated | sí (auth.uid) | no | no |

**Acción:** documentado; sin cambios a ciegas. Pendiente fino: evaluar si
`resolver_costo_insumo` / `resolver_precio_autorizado` se llaman sólo server-side (de ser
así, revocar `EXECUTE` de `authenticated`) — requiere confirmar que el cliente no los invoca.

## 2. RLS habilitada sin policy (Advisor: 4) — intención documentada
- **`render_eventos`** → `SERVER_ONLY_TABLE` (telemetría de `generar-render`, service_role).
  **Acción aplicada:** `REVOKE ALL FROM anon, authenticated` (tenían hasta TRUNCATE, que NO
  lo gobierna RLS → un anónimo podía truncar). RLS sin policy = denegar cliente (correcto).
  No se agrega SELECT policy sólo para silenciar el advisor.
- **`ai_eventos`** (NUEVA, telemetría/rate-limit de `analizar-mueble`) → igual: `SERVER_ONLY`,
  RLS on, sin grants de cliente.
- **`cotizaciones_backup_20261002`, `cotizaciones_revisiones_backup_20261002`** → sin grants
  de cliente (no expuestas por Data API). Correcto dejarlas inaccesibles.
- **`auth_recovery_once`** → sin grants de cliente. Correcto.

## 3. `credenciales_temporales` (passwords en claro, 9 filas legacy)
RLS on + policy `ALL` gateada por `es_direccion()` (sólo Dirección lee/escribe por Data API).
**Hallazgo:** `anon`/`authenticated` tenían grants NO gobernados por RLS (TRUNCATE/REFERENCES/
TRIGGER). **Acción aplicada:** `REVOKE ALL FROM anon`; `REVOKE TRUNCATE,REFERENCES,TRIGGER
FROM authenticated` (se conserva SELECT para el Excel de Dirección). No se borraron datos.
**Pendiente arquitectónico (ver REFACTOR_USUARIOS):** dejar de PERSISTIR passwords nuevos.

## 4. Leaked Password Protection — `BLOCKED_EXTERNALLY`
Advisor: deshabilitada. No hay herramienta de API/MCP en esta sesión para cambiar la config
de Auth. **Instrucción exacta (manual, 1 clic):**
Dashboard Supabase → Authentication → Policies / Password → **Enable "Leaked password
protection" (HaveIBeenPwned)** → Save. (No requiere cambios de código; no rompe auth.)

## 5. verify_jwt=false — `app` y `usuarios`
- `usuarios` usa `verify_jwt=false` por la rama **bootstrap** (crea la 1ª Dirección sin
  sesión). El resto de acciones ya exige sesión + `es_direccion` internamente. Endurecerlo
  (bootstrap one-shot irreversible + verify_jwt) va en REFACTOR_USUARIOS (necesita prueba
  humana del login/alta; no se cambia en caliente con el equipo fuera).
- `app` v4 `verify_jwt=false`: auditar su propósito antes de tocar (pendiente).
