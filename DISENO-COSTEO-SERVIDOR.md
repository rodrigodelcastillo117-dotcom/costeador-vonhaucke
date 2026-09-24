# Diseño: costeo en servidor y aislamiento de costos (FIX-06 / CST-01)

**Estado: DISEÑO. Nada de esto está desplegado ni activo.** Aprobado por Rodrigo
solo para diseñar (2026-09-24), no para activar. Requiere pruebas con sesiones
reales de los 3 roles antes de tocar producción. Fuera de alcance: contraseñas.

## 1. El problema, verificado (no hipótesis)
RLS real hoy (consultado 2026-09-24):
- `config` (una fila con `insumos` = costos, `parametros` = márgenes/tarifas,
  `finanzas` cifrada) → política `config_leer` = `puede_entrar()`: **cualquier
  usuario autenticado la lee entera**, incluido Ventas.
- `cotizaciones` → cada partida guardada trae `costoUnitario`; un vendedor lee
  sus propias cotizaciones con el costo dentro.

La UI oculta costos a Ventas, pero **la respuesta de red los contiene**. RLS
limita FILAS, no COLUMNAS dentro de un JSON. Ese es el hueco.

## 2. Por qué no es un simple ajuste de RLS
La app **costea en el navegador**: `src/motor/calculo.js` toma los `insumos`
(con costo) del cliente y calcula costo → precio. Si le quitamos los costos a
Ventas, su navegador ya no puede calcular precios. Por eso el arreglo correcto
es **mover el cálculo autoritativo al servidor** y que el cliente de Ventas
reciba SOLO precios, nunca costos ni tarifas.

## 3. Arquitectura objetivo
```
Cliente (Ventas)                Edge Function `costear`         Datos
  config/partidas  ───────────▶  valida identidad+rol
                                 lee costos server-side  ◀────  vista/tabla
                                 corre motor puro (calculo.js)   solo-servidor
  ◀── SOLO precios ────────────  filtra salida por rol           de costos
```
- **El motor ya es JS puro** → el mismo `calcular()`/`precioVenta()` corre en
  Deno (Edge Function) casi sin cambios. Una sola fuente de verdad de cálculo,
  compartida entre build de cliente (para roles con costo) y servidor.
- **Respuesta filtrada por rol**: Ventas recibe `{precioUnitario, precioLista,
  total}`; Diseño/Dirección reciben además `{costoUnitario, desglose, margen}`.
- **Clave de proveedor / datos sensibles**: solo del lado servidor.

## 4. Partición de datos (migración, versionada, reversible)
1. Mantener `config.insumos` como está (no romper nada) pero **quitar el costo
   de la ruta que llega a Ventas**: crear `config_comercial` (vista o tabla) sin
   `precio`/tarifas, con RLS `puede_entrar()`; y dejar `config` (con costos) con
   RLS restringida a `es_direccion() OR es_diseno()`.
2. `cotizaciones`: separar `costoUnitario`/`desglose` a una tabla hija
   `cotizacion_costos` (RLS diseño/dirección) — el JSON que ve Ventas queda con
   precio y cantidad, sin costo.
3. Todo con `apply_migration` (una migración por paso, con su reversa probada en
   un branch de Supabase antes de main).

## 5. Rollout seguro (la parte que HOY bloquea el deploy)
- Crear **branch de Supabase** (aislado) y un **entorno de preview de Vercel**.
- Sembrar 3 usuarios de prueba: Ventas, Diseño, Dirección.
- Batería de pruebas de acceso: con cada sesión, verificar por **red/SQL/export/
  PDF** que Ventas NO recibe costo/tarifa/margen en NINGÚN canal, y que Diseño/
  Dirección sí. (QA-04 del mandato.)
- Recién con esas pruebas verdes: aplicar a producción, con reversa lista.

**Bloqueo real:** no tengo esas 3 sesiones ni el branch sembrado. Sin eso, activar
esto puede dejar sin costear a todo el equipo. Por eso queda diseñado, no activo.

## 6. Compatibilidad y reversibilidad
- Las cotizaciones históricas siguen leyéndose (lectura compatible; el costo
  viejo embebido se migra a la tabla hija sin destruir el JSON original).
- Cada paso es reversible (drop de vista/tabla hija + restaurar RLS previa).
- El build de cliente para roles con costo puede seguir calculando local mientras
  Ventas pasa por el servidor — o unificar todo al servidor en una segunda fase.

## 7. Qué falta para ejecutarlo (checklist para desatorar)
- [ ] Rodrigo/TI: branch de Supabase + preview de Vercel para probar sin riesgo.
- [ ] 3 usuarios de prueba (Ventas/Diseño/Dirección) con datos anonimizados.
- [ ] Confirmar que el motor puro no depende de nada de navegador (revisar
      imports de `calculo.js` y sus dependencias — a primera vista es puro).
- [ ] Definir el contrato exacto de entrada/salida de la función `costear`.
