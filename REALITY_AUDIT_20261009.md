# VONHAUCKE — REALITY AUDIT · 2026-10-09

## Veredicto
NO-GO para declarar el costeo de producto nuevo "oficial/autónomo" en producción hoy.

El motor matemático tiene goldens fuertes (incluido Alpura/T.D.C. Alba), pero el E2E vivo puede llegarle con BOM, material, unidad o alcance equivocados. Un motor exacto no corrige una entrada semánticamente falsa.

## Caso real auditado
Mueble exhibidor / mostrador convenience store aeropuerto.

Evidencia viva:
- analizar-mueble recibió catálogo de 259 insumos.
- primera pasada AI OK.
- segunda pasada/revisión llegó a timeout 45 s.
- shadow_costeo id 25: costo cliente 21,954 / precio 36,590 / servidor HTTP 400.
- shadow_costeo id 26: costo cliente 22,152 / precio 36,920 / servidor HTTP 400.
- no hubo costo servidor autoritativo para esas corridas.

### Fallos observados
1. Tapacanto/Canto Walnut se clasificó como Aglomerado.
   - Consecuencia visible: ~45 m lineales se interpretaron como tablero y apareció ~$9,070.
   - Canonical T.D.C.: canto ABS 22 Walnut = $20.64/m.
   - Orden de magnitud correcto para 45 m de MP: $928.80 antes de política de desperdicio, no $9,070.

2. Zócalo de lámina 2400x150:
   - UI multiplicaba 0.36 m2 por precio $/kg y mostraba ~$12.
   - Eso es dimensionalmente inválido.
   - La geometría debe convertirse a kg/hoja según calibre/formato antes del costo.

3. Pintura:
   - pintura electrostática/polvo forma parte del costo Von Haucke sobre metal fabricado.
   - existe precio referenciado real de pintura polvo negro: $120.68/kg (T.D.C. Alpura/Rafa/Alba).
   - runtime legacy tiene genérico $110/m2; no es la misma unidad ni la fuente canónica.
   - regla de taller a validar: referencia 8 m2/kg en plano, menor rendimiento en tubular.

4. Alcance externo:
   - refrigerador: histórico confirmado Cliente.
   - POS/equipo: histórico confirmado Cliente; VH deja cubierta/pasacables/acometida.
   - LED: último histórico confirmado Cliente.
   - gráficas: histórico confirmado Solo montaje.
   - esos elementos no deben aparecer como MP "$0"; deben estar fuera del BOM económico salvo alcance explícito contrario.

5. Producto ya confirmado que Voni volvió a olvidar:
   - frentes inferiores Fijos.
   - PTR cal.12 y posteriormente sección 38x38.
   - MDF + laminado plástico, laminado sólo caras vistas.
   - fondo ranurado 6 mm.
   - repisas ajustables con cremallera.
   - carga de diseño 30 kg + refuerzo metálico cal.18.
   - anclaje a piso.
   - difusor policarbonato.
   Confirmaciones existen en public.confirmaciones, pero analizar-mueble no las recupera como precedente.

## Data truth
- insumos_catalogo activos: 259.
- catalogo_vigente con fila de precio: 254.
- 5 activos sin precio vigente.
- aprobado: 30.
- propuesto_validado: 166.
- propuesto: 58.
- certificable estricto: 30.
- requiere validación Compras: 57.
- evidencia: 1 documentada, 173 referenciada, 30 concordante, 50 sin evidencia.

Coberturas:
- precio vigente: 254/259 = 98.1%.
- aprobado + propuesto_validado: 196/259 = 75.7% del catálogo activo.
- certificable estricto: 30/259 = 11.6%.
- runtime config que hoy gobierna dinero: 92/259 = 35.5% del catálogo activo.

Hallazgo de arquitectura:
costear-servidor todavía calcula dinero desde config-legado. catalogo_vigente se usa para evidencia/certificación, no como proveedor económico principal. Por eso "la BD tiene el precio real" no implica que el motor vivo lo esté usando.

## Golden humano
src/motor/alpuraGolden.test.js:
- T.D.C. Exhibidor Alpura C-CO-517R.
- material humano: $12,315.65.
- fabricación humana: $18,749.37.
- 15 SKUs mapeados conservan precio T.D.C. al centavo.
- diferencia residual se explica íntegramente por 10 líneas sin_match; inexplicada = $0.
Esto demuestra que la fórmula/mapeo CANÓNICO puede reproducir una T.D.C. cuando BOM + unidad + precio son correctos.

## Seller-safe live
Prueba RLS real simulando JWT de vendedor:
- public.config_para_rol devuelve 92 insumos.
- no contiene keys precio.
- no contiene keys margen.

Prueba Dirección:
- sí contiene precio y margen.

Resultado: seller-safe DB PASS para este gate.

## Fixes en RC (NO producción)
Branch: chatgpt/final-audit-20261009
HEAD: ed4e442c24d6357fe51758fe007837562c0d2df4

Fixes:
- separar familias tapacanto / aglomerado / melamina / pintura-polvo.
- regresión: tapacanto jamás cae en aglomerado.
- DTO costear-servidor conserva _match.solicitado/_match.clase para materiales pendientes.
- analyzer schema/prompt separa externos del BOM económico.
- refrigerador/POS/gráficas/letras default cliente/tercero salvo alcance explícito.
- LED sólo entra si VH lo suministra; si no, externo/por definir.
- pintura electrostática/polvo obligatoria para metal fabricado.
- Asistente muestra externos en tarjeta separada.
- lámina conserva geometría y subtotal convierte m2 -> kg.
- móvil: nombre/material en filas legibles; botón quitar aparte.
- FAB global Voni no tapa importes en Costear desde cero.
- "Sin material = $0" reemplazado por mensaje fail-closed.

## Evidencia de tests del RC
- target material/DTO/Alpura: 48/48 PASS.
- suite completa: 259/259 test files PASS.
- tests: 2185/2185 PASS.
- Vite build PASS.
- Preview Vercel READY: dpl_54w7bxcTSiGFp3kKMss58aGkRix4.
- El nuevo código de analizar-mueble todavía NO está desplegado como Edge live; el Preview web sigue llamando a la Edge productiva actual.

## Qué falta antes de producción
1. desplegar/certificar analizar-mueble actualizado en una lane de prueba o con smoke autorizado.
2. hacer cutover económico shadow de config-legado vs catalogo canónico, sin autoaprobar propuestos.
3. importar/conectar el maestro ERP completo que aún no gobierna la app.
4. memoria segura de precedentes: sugerir confirmaciones históricas por identidad de producto; nunca autoaplicar por fuzzy match.
5. benchmark 20–30 órdenes cerradas con consumo/hora/costo real y medir MAPE.

## Cómo se medirá "X% de acierto"
No usar una cifra subjetiva.

Reportar por separado:
- BOM critical precision/recall.
- material identity + unit accuracy.
- price-source validated coverage.
- material cost MAPE.
- fabrication cost MAPE vs costo real cerrado.
- seller-safe/security pass rate.

Gate recomendado para llamarlo costeo autónomo confiable:
- 0 errores críticos de unidad/alcance.
- >=95% identidad crítica BOM/material.
- >=95% seller-safe/security.
- material/fabrication MAPE definido y aceptado contra 20–30 órdenes reales.
