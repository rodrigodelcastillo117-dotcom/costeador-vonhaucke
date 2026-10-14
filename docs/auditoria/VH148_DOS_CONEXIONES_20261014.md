# VH-148 · prueba real de dos conexiones (14-oct-2026)

## Resumen

**Resultado:** pasan los 4 casos: 1, 1b, 2 y 3.

**Hallazgo P0 nuevo, corregido en esta ronda.** El conflicto de versión usaba SQLSTATE `40001`. PostgREST **reintenta** la transacción ante `40001`, así que la llamada nunca regresaba y el 409 nunca llegaba al cliente. Ahora el SQL usa **`PT409`**, el código de PostgREST para responder HTTP 409 sin reintentar.

**Producción hoy no está expuesta.** Ninguna migración aplicada levanta `40001`: VH-148, VH-148b y SEG-01c siguen como PROPUESTA.

## Entorno

La creación de una rama de Supabase falló porque el conector pide un ID de confirmación de costo que no expone. Por eso la prueba corre sobre el núcleo de Supabase en local, con binarios oficiales. **No es la nube de Supabase.**

**Versión de PostgREST de la nube: 14.5.** Se leyó en producción, sólo lectura: `pg_stat_activity.application_name = 'PostgREST 14.5'` (7 conexiones de `authenticator`, 14-oct 14:55 UTC). La primera corrida usó la v12.2.3. Por eso se repitió todo con la **v14.5**, el mismo binario oficial que corre la nube (sha256 `39ce04b0…822295a`).

## Repetición con PostgREST 14.5 (la versión de la nube)

| | v12.2.3 (primera corrida) | **v14.5 (= nube)** |
|---|---|---|
| Evidencia | `evidencia_20261014.json` | `evidencia_20261014_pgrst14.json` (14:57:13 UTC) |
| Casos 1, 1b, 2 y 3 | pasan los 4 | **pasan los 4** (`ok: true`, exit 0) |
| 1b · carreras de 10 rondas | 1 ganador y 1 PT409 en cada ronda | 1 ganador y 1 PT409 en cada ronda (A 9, B 1) |
| 3 · adjuntar con versión vieja | 409 PT409, 0 vínculos | 409 PT409, 0 vínculos; huella de la promesa `94c48e66…` (la misma) |
| Medición | `medicion_40001_vs_PT409_20261014.json` | `medicion_40001_vs_PT409_20261014_pgrst14.json` |
| `40001` | sin respuesta en 5 s; 26,461 ejecuciones en 8 s; 6,919 con el cliente ya desconectado | **sin respuesta en 5 s; 19,435 ejecuciones en 8 s; 4,189 con el cliente ya desconectado** |
| `PT409` | 409 en 97 ms, 1 ejecución | **409 en 68 ms, 1 ejecución** |

Conclusión: la 14.5 se comporta igual que la 12.2.3. Reintenta `40001` sin fin y responde `PT409` como HTTP 409 sin reintentar. El cambio a `PT409` es necesario y suficiente en la versión de la nube.

Las tablas de abajo son de la primera corrida (v12.2.3). Las de la v14.5 tienen los mismos pasos y resultados, con otras horas; están en el JSON.

| Componente | Versión |
|---|---|
| Postgres | PostgreSQL 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1) on x86_64-pc-linux-gnu |
| GoTrue (supabase/auth) | v2.178.0 |
| PostgREST | v12.2.3 (primera corrida) y **v14.5** (repetición; = nube) |
| supabase-js | 2.112.3 |

SQL cargado: baseVh148b (producción 14-oct), PROPUESTA_p103b, PROPUESTA_vh148, PROPUESTA_vh148b, PROPUESTA_seg01, PROPUESTA_seg01c (rev4).

Arnés reproducible: `lab/qa/vh148_dos_conexiones/` (ver `LEEME.md`).

### Sesiones

Las tres son sesiones de GoTrue con `signInWithPassword` y JWT propio.

| Correo | uid | Rol |
|---|---|---|
| qa148-direccion@vonhaucke.test | `2af70359-860e-43da-b4b8-eaf95b4c23ba` | direccion |
| qa148-ventas@vonhaucke.test | `2a08188a-643c-47ee-a338-95e17cbbb0df` | vendedor |
| qa148-diseno@vonhaucke.test | `91e09c8c-7c7d-4567-8ebd-60c56dfde24b` | diseno |

## 40001 contra PT409 en PostgREST real

Se usó una RPC mínima que levanta el código indicado y cuenta cada ejecución con una secuencia. La secuencia no es transaccional, así que cuenta aunque la transacción se deshaga.

| SQLSTATE | Respuesta HTTP | Tiempo | Ejecuciones de la RPC en 8 s | Ejecuciones en los 2 s siguientes, con el cliente ya desconectado |
|---|---|---:|---:|---:|
| `40001` | sin respuesta en 5 s (AbortError) | 5002 ms | 26,461 | 6,919 |
| `PT409` | 409 | 97 ms | 1 | 0 |

Con `40001`, PostgREST no deja de reintentar aunque el cliente ya se haya ido: consume CPU de la base sin límite y el usuario nunca ve el aviso de conflicto.

Corrección: `errcode = 'PT409'` en las 7 ocurrencias de las tres propuestas (VH-148, VH-148b y SEG-01c, incluida la línea de rollback de VH-148b).

- El mensaje (`CONFLICTO_VERSION`) y el DETAIL (`actualizado=` / `revision=`) quedan igual.
- El cliente reconoce `PT409` explícitamente (`esConflictoVersion`, `vincularCosteos`) y también por el mensaje. `40001` se sigue aceptando por compatibilidad.
- Las pruebas PGlite que esperaban `40001` ahora esperan `PT409`.

## 1 · cotización: dos sesiones guardan desde la MISMA versión — PASA

| Hora (UTC) | Quién | Acción | Esperado | Real |
|---|---|---|---|---|
| 14:39:58.292 | A y B | leen cotizacion_segura | — | version_A=2026-10-14T14:39:58.261874+00:00; version_B=2026-10-14T14:39:58.261874+00:00 |
| 14:39:58.303 | A | guarda con su versión | ok | HTTP 200; version_nueva=2026-10-14T14:39:58.300073+00:00; ok |
| 14:39:58.308 | B | guarda con la versión VIEJA | PT409 (HTTP 409) CONFLICTO_VERSION | HTTP 409; `PT409` CONFLICTO_VERSION: la cotización cambió en el servidor (2026-10-14T14:39:58.300073+00:00). Recarga antes de gu (DETAIL `actualizado=2026-10-14T14:39:58.300073+00:00`); revision_esperada_por_B=2026-10-14T14:39:58.261874+00:00 |
| 14:39:58.313 | B | guarda sin versión (p_actualizado_esperado = null) | 22004 VERSION_REQUIRED | HTTP 400; `22004` VERSION_REQUIRED: falta p_actualizado_esperado (la versión desde la que editas) |

**Estado final:**

```json
{
 "cliente": "QA-VH148 · editado por A",
 "actualizado": "2026-10-14T14:39:58.300073+00:00"
}
```

## 1b · cotización: A y B guardan al MISMO tiempo desde la misma versión (10 rondas) — PASA

| Ronda | Versión común | Ganó | Ganadores | Conflictos | Código del perdedor | Valor final |
|---:|---|---|---:|---:|---|---|
| 1 | `2026-10-14T14:39:58.315101+00:00` | A | 1 | 1 | PT409 | QA-VH148 carrera 1 · A |
| 2 | `2026-10-14T14:39:58.325367+00:00` | A | 1 | 1 | PT409 | QA-VH148 carrera 2 · A |
| 3 | `2026-10-14T14:39:58.34784+00:00` | B | 1 | 1 | PT409 | QA-VH148 carrera 3 · B |
| 4 | `2026-10-14T14:39:58.36051+00:00` | A | 1 | 1 | PT409 | QA-VH148 carrera 4 · A |
| 5 | `2026-10-14T14:39:58.3737+00:00` | A | 1 | 1 | PT409 | QA-VH148 carrera 5 · A |
| 6 | `2026-10-14T14:39:58.385407+00:00` | A | 1 | 1 | PT409 | QA-VH148 carrera 6 · A |
| 7 | `2026-10-14T14:39:58.396998+00:00` | A | 1 | 1 | PT409 | QA-VH148 carrera 7 · A |
| 8 | `2026-10-14T14:39:58.409198+00:00` | A | 1 | 1 | PT409 | QA-VH148 carrera 8 · A |
| 9 | `2026-10-14T14:39:58.419496+00:00` | B | 1 | 1 | PT409 | QA-VH148 carrera 9 · B |
| 10 | `2026-10-14T14:39:58.432634+00:00` | A | 1 | 1 | PT409 | QA-VH148 carrera 10 · A |

En las 10 rondas las dos sesiones mandaron su guardado al mismo tiempo, desde la misma versión. Siempre ganó exactamente una. El valor final de la fila es siempre el del ganador. No se perdió ninguna escritura sin aviso.

## 2 · expediente: dos sesiones editan la MISMA revisión — PASA

| Hora (UTC) | Quién | Acción | Esperado | Real |
|---|---|---|---|---|
| 14:39:58.464 | A | RPC actualizar_expediente_seguro con revisión 1 | ok (rev 2) | HTTP 200; ok |
| 14:39:58.470 | C | RPC con la revisión VIEJA (1) | PT409 | HTTP 409; `PT409` CONFLICTO_VERSION: el expediente cambió en el servidor (revisión 2) (DETAIL `revision=2`) |
| 14:39:58.477 | C | UPDATE directo por PostgREST con revision = 2 (la que ya escribió A) | PT409 | HTTP 409; `PT409` CONFLICTO_VERSION: el expediente 1 ya está en la revisión 2 (se intentó escribir la 2) (DETAIL `revision=2`) |
| 14:39:58.483 | A y C | carrera simultánea con revisión 2 | uno gana, otro PT409 | A=ok; C=`PT409` |

**Estado final:**

```json
{
 "expediente": {
  "revision": 3,
  "nombre": "QA-VH148 Credenza · carrera A"
 },
 "historial": [
  {
   "rev": 1,
   "nombre": "QA-VH148 Credenza de prueba"
  },
  {
   "rev": 2,
   "nombre": "QA-VH148 Credenza · A"
  },
  {
   "rev": 3,
   "nombre": "QA-VH148 Credenza · carrera A"
  }
 ]
}
```

## 3 · adjuntar_costeo_a_partida con versión vieja — PASA

| Hora (UTC) | Quién | Acción | Esperado | Real |
|---|---|---|---|---|
| 14:39:58.495 | servidor (service_role) | registra el costeo K | — | K=2a1fb953-bc24-4716-8937-61266fa0355e; promesa_version=v1; promesa_huella=94c48e663bc37ef4e25c1f233e46edba |
| 14:39:58.501 | A | lee la versión tras su guardado | — | version=2026-10-14T14:39:58.496051+00:00 |
| 14:39:58.525 | B | guarda en medio (cambia precio) | — | HTTP 200; version_nueva=2026-10-14T14:39:58.522108+00:00; ok |
| 14:39:58.532 | A | adjunta con la versión VIEJA | PT409 (HTTP 409) y nada vinculado | HTTP 409; `PT409` CONFLICTO_VERSION: la cotización cambió entre tu guardado y el vínculo del costeo (2026-10-14T14:39:58.522108+ (DETAIL `actualizado=2026-10-14T14:39:58.522108+00:00`); revision_esperada_por_A=2026-10-14T14:39:58.496051+00:00; revision_real=2026-10-14T14:39:58.522108+00:00; vinculos_vigentes=0 |
| 14:39:58.537 | A | adjunta sin versión | 22004 | HTTP 400; `22004` VERSION_REQUIRED: falta p_actualizado_esperado (el actualizado que devolvió tu guardado) |
| 14:39:58.552 | A | control: recarga y adjunta con la versión fresca | ok | HTTP 200; ok |
| 14:39:58.580 | A y B | carrera: A adjunta K2 y B guarda, misma versión | uno gana, otro PT409 | A=ok; B=`PT409`; vigente=['2911e18e-a0aa-4a5a-b9b1-1f3ada97a079']; precio_final=9900; costeoId_final=2911e18e-a0aa-4a5a-b9b1-1f3ada97a079 |

**Estado final:**

```json
{
 "actualizado": "2026-10-14T14:39:58.575092+00:00",
 "partida": {
  "d": 600,
  "w": 1200,
  "id": "p1",
  "nombre": "QA-VH148 Escritorio de prueba",
  "piezas": [
   "Cubierta"
  ],
  "bomHash": "qa148",
  "cantidad": 1,
  "costeoId": "2911e18e-a0aa-4a5a-b9b1-1f3ada97a079",
  "materiales": [
   "m16"
  ],
  "cost_status": "UNKNOWN",
  "costoEstado": "certificado",
  "costoUnitario": 6000,
  "precioUnitario": 9900
 },
 "vigente": [
  "2911e18e-a0aa-4a5a-b9b1-1f3ada97a079"
 ]
}
```

## Conclusión

No hay "gana el último que escribe" en ninguna de las tres superficies:

- **Cotización:** RPC con versión vieja → 409; sin versión → 22004; carrera de 10 rondas → siempre un solo ganador.
- **Expediente:** RPC con versión vieja → 409; UPDATE directo por PostgREST con versión vieja → 409; carrera → un solo ganador; historial sin huecos.
- **Vínculo de costeo** (`adjuntar_costeo_a_partida`): con versión vieja → 409 y nada vinculado; sin versión → 22004; con versión fresca → se vincula; carrera contra un guardado → un solo ganador y estado final coherente.

### Límites

1. **No es la nube de Supabase.** Es el núcleo de Supabase en local: los binarios oficiales de GoTrue y PostgREST, con el mismo SQL.
2. **No sé si la nube reintenta igual el `40001`.** La versión de PostgREST de la nube no se pudo leer. Aun así, `PT409` es el mecanismo documentado de PostgREST para responder 409 y no depende de esa versión.

**Siguiente paso:** al aplicar VH-148 en la ventana, el postcheck debe incluir una llamada de conflicto por la API real y verificar que responde **HTTP 409 en menos de 1 s**.
