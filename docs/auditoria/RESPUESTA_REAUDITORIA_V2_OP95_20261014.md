# Respuesta a la reauditoría externa v2 · Operación 9.5 (14-oct-2026)

Head auditado: `4ed8ac6`. Nada se aplicó en producción. Lo único desplegado es la Edge RC `costear-servidor-rc`.
Producción solo se leyó.

## Resumen

| # | Hallazgo | ¿Correcto? | Estado | Evidencia |
|---|---|---|---|---|
| P0-03 | Contraseña de una cuenta Dirección en un repo público | **Sí, verificado.** Repo `public`. La cuenta `qa-direccion` tiene rol `direccion`, **0 factores MFA**, no está bloqueada y tiene 6,266 sesiones. La contraseña estaba literal en `lab/costear/ciego_erp/correr.sh:11` (historial desde el 10-oct). | **Quitada del HEAD** (`70ac719`; el script la lee de `QA_PW`). **NO rotada**: Rodrigo decidió no tocar producción todavía. | Consultas de solo lectura a `auth.users`, `auth.sessions`, `permitidos` y `pg_policies`. Sesiones agrupadas por red: casi todas son runners de GitHub (Azure) y la red de esta sesión. Hay dos orígenes que no puedo atribuir (`90.96.x`, `187.202.x`). **No sé** si alguien ajeno entró: las lecturas no dejan rastro y `auth.audit_log_entries` está vacío. No hay usuarios nuevos desde el 9-oct, `permitidos` solo tiene correos de la empresa y `producto_version_economia` sigue con 12 filas. |
| P0-01 | El costo no queda ligado a la definición de la partida | **Sí.** | **Corregido (SEG-01c rev 2)**: `costeos_servidor.partida_huella` = md5 de `private_api.partida_definicion` (la de VH-035c, ya en producción) menos el render y los enlaces de acomodo. Se calcula sobre la fila **ya guardada** y se exige al emitir. Re-vincular no lava un cambio. | `seg01cVinculoCosteo.test.js`: 5 cambios (nombre, medidas, material, despiece, w), borrar y recrear el mismo id, 2 controles sin falsos positivos y el bloque ANTES (con la rev 1 era ALLOWED). |
| P0-02 | Carrera guardado → vínculo | **Sí.** Y algo más grave que no vio: en producción **nada sube `actualizado`** (solo `default now()`), así que un CAS sin VH-148b no detecta nada. | **Corregido**: `adjuntar_costeo_a_partida(…, p_actualizado_esperado)` (22004/40001). La firma de 3 argumentos desaparece. **SEG-01c aborta si VH-148b no está aplicada.** El cliente encadena la versión y se detiene en 40001. | Pruebas SQL (otra pestaña entre guardado y vínculo; cadena de dos), pruebas del cliente real (`vincularCosteos`) contra el SQL real y la prueba de dependencia. |
| — | **Hueco propio, no reportado**: un especial con `productoId` de texto se saltaba la autoridad | — | **Corregido**: canónica = `producto_id` y `producto_version_id` **numéricos**, igual que el gate de producción. Antes bastaba `productoId: "X"`, que en el cliente es la clave de línea. El cliente tenía el mismo error y ahora vincula esos renglones. | Prueba "HUECO productoId de TEXTO" y su versión ANTES. Producción (borradores): 3,332 partidas legacy con clave de texto y 6,077 especiales sin clave necesitarán costeo del servidor en modo estricto. |
| P1-01 | Frescura incompleta | **Sí.** | **Corregido, con una decisión pendiente.** `base_costo_huella` = md5 de `config.datos.parametros` más `catalogo_motor` de los insumos usados (precio, unidad, formato, atributos). La calcula la misma función SQL en la Edge y en la emisión. También: versión de motor vigente (`version_motor_vigente`) y frescura de precio por `precio_id` exacto (punto 10: otra fila con el mismo importe ya no pasa). Política `frescura`: `exigir_vigente` (por omisión) o `congelar_al_costear`, que es **decisión de Dirección**. | Pruebas: parámetro, formato de hoja, unidad, insumo no usado (no invalida), sin huella, otra versión de motor, política congelar y mismo importe con otro `precio_id`. |
| P1-02 | Holdout sin dependencias transitivas ni modelo congelado | **Sí, y más grande de lo que dijo**: el cierre transitivo agrega unos 70 archivos que la lista a mano no tenía. | **Holdout v3**: cierre de imports, el propio script y `package-lock.json`. `modelosEsperados` por (fn, modo); `--verificar` exige `--modelos` (observados en `ai_eventos`, consulta `modelos_observados.sql`). | `ai_eventos`, 7 días: la Edge RC resolvió `claude-opus-5-5`, `claude-opus-5` y `claude-sonnet-5-5` con el mismo SHA. 10 pruebas. |
| P1-03 | El vínculo puede fallar en silencio | **Sí, y peor**: nadie leía `vinculosFallidos`. | **Corregido**: aviso visible en App.jsx con el motivo (conflicto, partida cambiada u otro). El vínculo se reintenta en el siguiente guardado. | `vinculoCosteo.test.js`. |
| P2-01 | VH-100 sin grant a `service_role` | **ESTÁ EQUIVOCADO respecto a producción.** `pg_default_acl` de `postgres` en `public` da `EXECUTE` a `service_role` en cada función nueva, y el `revoke` solo quita PUBLIC y anon. | Igual se hizo explícito, para no depender del default. | Prueba que falla con el archivo anterior (PGlite no tiene ese default). |
| P2-02 | `motivos_autoridad_costeo` sin control de acceso | Sí (fuga de metadatos). | **Corregido**: solo el dueño de la cotización o quien ve economía; `service_role` (sin sesión) sí. | Prueba con otro vendedor. |
| Orden | "SEG-01c preparado antes que VH-148b" | **ESTÁ EQUIVOCADO**: sin el trigger de VH-148b el CAS del vínculo no detecta nada. | Orden corregido abajo. | — |

## Observación nueva (no es de SEG-01c; está en producción)

VH-035c considera un cambio de definición que el **vendedor** guarde un render nuevo o un enlace de acomodo
(`render`, `zone_id`, `instance_id`): le quita a la partida la economía de Dirección y la deja en recosteo pendiente.
Probablemente es un falso positivo de UX que ya existe en producción. Está documentado con una prueba y no lo toqué:
corregirlo requiere una migración de producción.

## Orden de aplicación recomendado (cada paso requiere autorización)

0. **Incidente:** rotar la contraseña de `qa-direccion`, revocar sus sesiones, actualizar el secreto `TEST_PASSWORD`
   del CI y después limpiar el historial. La limpieza no sustituye la rotación.
1. SEG-01 v1.
2. P1-03b: antes de producir costeos nuevos, porque cambia la salida de `catalogo_motor` y con ello la huella de base.
3. VH-148 + VH-148b (paso 1; compatibles con el cliente `c8dd2b3`).
4. SEG-01c rev 2 en modo `preparado`. Aborta si falta VH-148b.
5. VH-100 piloto, con una cuenta humana de Dirección (no la QA).
6. Edge `costear-servidor` y cliente nuevos; smoke Costear → guardar → vincular → reabrir. Fijar `version_motor_vigente`.
7. Prueba de dos conexiones reales (PostgREST).
8. Primer costo VALIDADO real.
9. Decidir `frescura`, revisar `diagnostico_autoridad_costeo` y pasar a `estricto`.
10. VH-148c cuando no queden clientes viejos.

## Lo que sigue sin verificarse

- Concurrencia real entre dos conexiones y la selección de sobrecarga de PostgREST real.
- Normalización del cliente del vendedor (`crearPartida`) contra la huella. Las pruebas cubren el viaje por el
  servidor. Lo que agregue el navegador lo dirá `diagnostico_autoridad_costeo` en modo preparado **antes** de pasar a
  estricto.
- Ventana de milisegundos entre el cálculo del costo y el cálculo de la huella de base en la Edge (un cambio de config
  justo ahí). Riesgo residual aceptado y documentado.
- Si alguien ajeno usó la cuenta QA.
