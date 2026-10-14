# Respuesta a la reauditoría externa v3 · Operación 9.5 (14-oct-2026)

- Head auditado: `d5b45d6`.
- Respuesta: `96bab98` y siguientes.
- Nada se aplicó en producción. Lo único desplegado es la Edge RC `costear-servidor-rc`.

| # | Hallazgo | ¿Correcto? | Estado | Evidencia |
|---|---|---|---|---|
| P0-01 | El primer vínculo podía atar el costeo de A a la partida B | **Sí.** La Edge solo recibía el despiece: no había nada server-side que dijera qué mueble era. | **Corregido (rev 3)**: la identidad (nombre, w, d) viaja en la MISMA solicitud que el despiece. La Edge la guarda en `identidad_origen`, junto con `componentes_costeados`. El primer vínculo exige que la identidad de la partida (nombre, w, d, h, medidas, material, descripción) sea esa misma. Agregar material o medidas que no se declararon también falla. | `seg01cVinculoCosteo.test.js`: "P0-01 v3" (3 casos) y ANTES rev 2 (pasaba ALLOWED). |
| — | Límite que no se puede cerrar con código | — | El servidor no puede saber que un despiece "es" una mesa: la identidad la declara quien costea (Dirección o Diseño). Lavar un costo exige declarar en falso **al costear**, y eso queda registrado con autor y despiece. La arquitectura alternativa ("costear la partida guardada por id") tiene el mismo límite, porque hoy la partida no lleva el despiece. | — |
| P0-02 | Recostear la misma partida era imposible | **Sí, error de diseño mío.** La prueba de idempotencia lo escondía. | **Corregido**: tabla `partida_costeo_vigente`, con una fila por partida. El costeo sigue siendo de un solo uso. K1 queda `reemplazado_por` K2 y no revive. | "P0-02 v3" (base cambiada → K2; mueble cambiado → K2 con la identidad nueva) y ANTES rev 2 (violación del índice único). |
| P1-01 | Traspaso Diseño → Dirección daba "otra persona" | Sí. | **Corregido**: re-vincular el costeo **vigente** sin cambios es idempotente para cualquier Dirección o Diseño con acceso, sin escritura ni cambio de versión. Ser el autor solo se exige para un costeo nuevo. | "P1-01 v3". |
| P1-02 | `modelos=[]` daba OK | **Sí.** | **Corregido**: un arreglo vacío no verifica. `--requests` exige un evento con `model_id` por cada request de IA, y la consulta es por `request_id`, no por ventana de tiempo. Si hay un cambio, el estado es CAMBIO aunque además falte una huella. | `holdoutHuellas.test.js` (12). |
| P1-03 | El runner no garantizaba `costear-servidor-rc` | **Sí.** Sin `VITE_COSTEAR_FN` el cliente caía a la Edge de producción, y el E2E aceptaba cualquier `costear-servidor*`. | **Corregido**: `correr.sh` exige ambas Edge RC exactas. El E2E compara igualdad exacta y falla si se costeó con otra. | `correr.sh`, `e2e/labCostear.e2e.js`. |
| P1-04 | El holdout no estaba atado al binario | Sí. | **Corregido**: árbol limpio, el dev server tiene que ser este checkout (su cwd) y el navegador tiene que mostrar el SHA de HEAD. El SHA se registra en `GIT_SHA` y en `0-binario.json`. | Ídem. **No probado en vivo**: requiere la credencial QA, que está comprometida. |
| P1-05 | `version_motor_vigente` era opcional | Sí. | **Corregido**: CHECK `estricto ⇒ version_motor_vigente`. La RPC `activar_autoridad_costeo` es solo para Dirección humana. | "P1-05 v3". |
| P1-06 | El gate estaba desactualizado y no había preview del head | Sí. | **Corregido**: el gate ya no fija `bf096aa`, y medio centavo y costo $0 pasan a corregidos. Se genera un preview del SHA final (el id va en el paquete). | — |
| P0-03 | Credencial QA | Sí. | **Sin cambios**: la rotación es decisión de Rodrigo, que no ha autorizado tocar producción. | — |

## Lo que sigue sin verificarse

- Concurrencia real entre dos conexiones de PostgREST.
- La corrida del laboratorio con la atadura al binario. Necesita la cuenta QA, que hay que rotar antes de volver a
  usarla.
- La normalización del navegador del vendedor contra la huella. La revela `diagnostico_autoridad_costeo` en modo
  preparado.
