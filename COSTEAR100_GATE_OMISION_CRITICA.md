# COSTEAR 100 · Gate de omisión funcional crítica (FASE 11/22 → estado de costo) · 2026-11-03

## Qué se conectó
El detector de omisiones ya marcaba `bloquea_certificacion=true` para una **omisión funcional crítica** (hoy: LED sin
driver/fuente — una iluminación no funciona sin alimentación). Hasta ahora era sólo un aviso en pantalla. Ahora
**bloquea el estado de costo**: `clasificarCosto` (la máquina de estado VALIDADO/PRELIMINAR/BLOQUEADO) recibe esas
omisiones como *duros* → el costo queda **BLOQUEADO** y no puede marcarse como oficial hasta resolverla.

## Por qué es seguro (endurece, no relaja)
- Es **fail-closed**: añade un motivo de bloqueo; nunca sube un estado ni abre un gate. Alineado con "nunca relajar gates".
- Parámetro **opcional** `omisionesCriticas=[]`: todos los llamadores/tests existentes que no lo pasan **no cambian**
  (68 pruebas del gate y sus vecinos en verde, incluida la retrocompatibilidad explícita).
- Se evalúa sobre el **BOM real** que se costea (`b.componentes`), no sobre el despiece crudo de la IA.
- Hoy sólo una regla marca crítico (LED sin driver); un mueble sin LED **no se ve afectado**. El servidor sigue siendo
  la autoridad última de certificación; esto es una compuerta adicional del cliente, no un reemplazo.

## Dónde
- `src/datos/estadoCosto.js`: `clasificarCosto({ ..., omisionesCriticas })` → cada omisión crítica es un *duro*
  ("Omisión funcional crítica: …") → BLOQUEADO.
- `src/componentes/AsistenteEspecial.jsx`: computa las omisiones críticas del BOM real (`detectarOmisiones`) y las pasa
  al gate (memoizado por `b.componentes`/`insumos`).

## Validación (RED→GREEN): `estadoCosto.test.js`
- Omisión crítica (LED sin driver) con servidor "certificado" + todo lo demás limpio → **BLOQUEADO** (fail-closed).
- Sin `omisionesCriticas` → estado idéntico al anterior (VALIDADO). Retrocompatible.
- `vite build` OK; 68 pruebas del gate + componentes en verde.

## Efecto en el piloto
Un mueble con iluminación pero sin driver ya **no podrá marcarse como costo oficial** hasta que se agregue el driver
(o se descarte la regla con confirmación). Es exactamente la "ventaja competitiva" de la directiva: detectar lo que
falta y **no dejar pasar** un costo funcionalmente incompleto.
