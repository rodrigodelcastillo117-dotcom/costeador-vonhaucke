-- ============================================================================
-- PROPUESTA (NO APLICADA) · Gobernanza de precios tras la auditoría adversarial
-- (VH-A01 140 sin source_document, VH-A02 1,673 abiertos / 111 selección).
-- 2026-11-06. NADA de esto se ejecutó. Requiere revisión de Compras/Dirección.
-- Cada bloque es reversible y debe correrse por separado, revisando su SELECT antes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (0) DIAGNÓSTICO (solo lectura) — correr primero, revisar, decidir.
-- ----------------------------------------------------------------------------
-- 140 certificables sin source_document, separando los que SÍ tienen fuente real:
select case
         when p.fuente ilike '%SEMILLA sin fuente%' or p.fuente ilike '%codigo=nube%' then 'SIN_PROCEDENCIA'
         else 'TIENE_FUENTE_TEXTO' end as clase,
       count(*), min(cv.precio) as precio_min, max(cv.precio) as precio_max
from catalogo_vigente cv join insumo_precios p on p.id=cv.precio_id
where cv.certificable=true and (p.source_document is null or btrim(p.source_document)='')
group by 1;

-- ----------------------------------------------------------------------------
-- (1) VH-A01 · Exigir evidencia documental para certificar.
--     OPCIÓN A (recomendada, mínimo riesgo): NO tocar precios. Cambiar la
--     definición de 'certificable' en la vista catalogo_vigente para exigir
--     además source_document NO vacío. Efecto: los 140 pasan de CERTIFICADO a
--     PRELIMINAR hasta documentarlos — fail-closed, nunca altera un importe.
--     (Requiere editar la vista; revisar impacto en costeos en curso.)
--
--   create or replace view public.catalogo_vigente as ...
--     -- en la columna certificable, AND (source_document is not null and btrim(source_document)<>'')
--     -- o AND contract_status='DATA_TRUTH_V1'  (el contrato ya exige source_document al aprobar)
--
--     OPCIÓN B (backfill): para los que tienen procedencia real en `fuente`
--     (Sonara/Alpura/Compras/ERP), copiar fuente → source_document vía la RPC de
--     aprobación (NO UPDATE directo: el trigger append-only lo bloquea). Dejar
--     SEMILLA/nube como no-certificables hasta cargar su documento real.
--     → Decisión de Compras cuál fuente es "documento" válido.

-- ----------------------------------------------------------------------------
-- (2) VH-A02 · Cerrar filas superseded. EMPEZAR por la basura que yo dejé:
--     espuma erp-espr210518 tiene 2 filas $750/rollo (unidad incorrecta) abiertas
--     además de la buena $7.143/m. Cerrarlas (vigente_hasta) NO cambia el vigente
--     (la vista ya elige $7.143/m) pero quita el riesgo de que reaparezcan.
--     Nota: set vigente_hasta en fila 'aprobado' exige la RPC autorizada
--     (guard_precio_no_autofirma / flag vh.via_rpc_aprobacion). Hacerlo por la
--     vía oficial, no con UPDATE directo. Candidatas:
--   select id, precio, cost_unit, vigente_desde from insumo_precios
--     where insumo_id='erp-espr210518' and vigente_hasta is null and cost_unit='rollo';

-- ----------------------------------------------------------------------------
-- (3) VH-A02 · Conflictos reales (~15-20 melaminas): AUDITAR con Compras ANTES de
--     voltear nada. La vista prioriza confianza sobre fecha; decidir la política:
--     ¿fecha de compra manda sobre confianza histórica? Si sí, ajustar el ORDER BY
--     de la vista (vigente_desde antes que confidence) — pero sólo tras validar
--     caso por caso que el más reciente es el correcto (puede ser carga no
--     autoritativa). NO voltear a ciegas.
--   -- lista de conflictos: ver el SELECT de §3 en AUDITORIA_CHATGPT_RESPUESTA.md

-- ----------------------------------------------------------------------------
-- (4) VH-A03 · Versionado económico del motor (código, no SQL): MOTOR_VERSION
--     debe derivarse de un hash de reglas+parámetros+fórmula efectiva, para que
--     un cambio como "herrajes exentos de MO" cambie la huella aunque la etiqueta
--     manual siga igual. Propuesta en src/motor (fuera de este archivo).
