-- ============================================================================
-- MIGRACIÓN B — carga de precios reales "frescos" al catálogo del motor
-- Estado: PREPARADA PARA REVISIÓN. **NO EJECUTADA EN PRODUCCIÓN.**
-- Ejecutar en prod requiere autorización explícita por separado (constraint dura).
-- Rama: claude/costing-app-architecture-psf02g
-- Proyecto Supabase: mtuvnbgljwbsaizjjgzs
-- ============================================================================
--
-- QUÉ HACE
--   Propone precios como PRELIMINAR (estado='propuesto_validado',
--   requiere_validacion_compras=false pero NO 'aprobado' => NO certificable
--   => costea pero bloquea emisión en firme hasta que un humano corra
--   aprobar_precio). Idempotente (dedup por source_record_id+source_price+fecha).
--   No toca precios existentes; agrega una propuesta nueva por insumo.
--
-- POR QUÉ SÓLO 5 FILAS (y no las 34/36 del diff v2)
--   El diff Paso A v2 (DIFF_pasoA_v2_cambios.csv) tiene 36 filas. Al validarlas
--   contra el catálogo real, se cayeron por tres defectos — ver
--   MIGRACION_B_triage.md:
--     · 10 FALSOS POSITIVOS: el join por clave_comercial empató DOS artículos
--       ERP distintos (p.ej. MDF 1-cara vs 2-caras). Cargarlos corrompería
--       un precio correcto. => RECHAZADAS, hay que arreglar el matcher.
--     · 8 ERRORES DE UNIDAD: +900 % (perno ×10) y un clúster de 6 eléctricos
--       "BE52…" con ratio idéntico 0.05605 (≈1/17.8) + 1 lapicera −94.2 %.
--       => RECHAZADAS (nunca inventar precio).
--     · 13 MISMO-AÑO: empate correcto pero la fuente real es del MISMO año que
--       el precio de catálogo => no puedo probar automáticamente cuál es más
--       fresco. => NECESITA_HUMANO (incluye MP real: tubular, minifix).
--   Quedan 5 que pasan TODOS los filtros automáticos (empate exacto de
--   artículo + fuente de año estrictamente posterior + magnitud 13–22 %).
--   ADVERTENCIA HONESTA: las 5 son sillas de oficina y su "precio real" viene
--   de un archivo de COSTO PROMEDIO (Sillas_CostoPromedio_2024, ultimo_costo),
--   NO de una OC. Valor bajo para el costeo de muebles fabricados. Cargarlas es
--   opcional; el trabajo que mueve la aguja es arreglar el matcher y mandar las
--   13 MISMO-AÑO (OC reales) a Compras.
--
-- EVIDENCIA (precio y fecha exactos, sin redondear, del master real):
--   lab/datos_reales_drive/precios_vigentes_master.csv
-- ============================================================================

begin;

-- Corre como Dirección (la función exige puede_certificar_costo()).
-- NO usar cuentas QA para certificar; esto NO certifica, sólo propone PRELIMINAR.

select public.cargar_erp_ultima_compra(
  'Sillas_CostoPromedio_2024 (Drive) · Migración B precios frescos (PRELIMINAR)',
  '[]'::jsonb,                      -- p_catalogo vacío: los 5 insumos ya existen;
                                    -- el loop de precios resuelve por
                                    -- atributos->erp->articulo (y fallback insumo_id).
  $precios$[
    {
      "source_record_id": "MBLXSN1205D856|",
      "insumo_id": "erp-bedambmpem",
      "source_price": 5820.17,
      "source_unit": "pza",
      "cost_unit": "pza",
      "vigente_desde": "2021-07-06",
      "estado": "propuesto_validado",
      "evidencia": "Sillas_CostoPromedio_2024 · ultimo_costo n_fuentes=3 · SILLON Berlin director (cat 2019-09-30 $4977.80 -> real 2021 $5820.17, +16.9%)"
    },
    {
      "source_record_id": "MBLXSN1206E458|",
      "insumo_id": "erp-bevbmbrem",
      "source_price": 1928.29,
      "source_unit": "pza",
      "cost_unit": "pza",
      "vigente_desde": "2023-10-04",
      "estado": "propuesto_validado",
      "evidencia": "Sillas_CostoPromedio_2024 · ultimo_costo n_fuentes=3 · SILLON Berlin visitas (cat 2019-09-30 $1703.94 -> real 2023 $1928.29, +13.2%)"
    },
    {
      "source_record_id": "MTHXSA12B5V500|",
      "insumo_id": "erp-sanfordem",
      "source_price": 678.94,
      "source_unit": "pza",
      "cost_unit": "pza",
      "vigente_desde": "2023-05-02",
      "estado": "propuesto_validado",
      "evidencia": "Sillas_CostoPromedio_2024 · ultimo_costo n_fuentes=3 · SILLA Sandford (cat 2018-01-29 $599.18 -> real 2023 $678.94, +13.3%)"
    },
    {
      "source_record_id": "MBLXSA1295R600|",
      "insumo_id": "erp-skate-rbebrmtmem",
      "source_price": 3573.63,
      "source_unit": "pza",
      "cost_unit": "pza",
      "vigente_desde": "2023-10-24",
      "estado": "propuesto_validado",
      "evidencia": "Sillas_CostoPromedio_2024 · ultimo_costo n_fuentes=3 · SILLA operativo mesh (cat 2019-08-23 $2927.25 -> real 2023 $3573.63, +22.1%)"
    },
    {
      "source_record_id": "MZAXBC06060000|",
      "insumo_id": "erp-zauber-toolem",
      "source_price": 891.73,
      "source_unit": "pza",
      "cost_unit": "pza",
      "vigente_desde": "2021-03-23",
      "estado": "propuesto_validado",
      "evidencia": "Sillas_CostoPromedio_2024 · ultimo_costo n_fuentes=3 · BANCO ajuste altura (cat 2017-06-14 $781.75 -> real 2021 $891.73, +14.1%)"
    }
  ]$precios$::jsonb
) as resultado;

-- Revisa 'resultado': precios_nuevos debe ser 5 (primera corrida),
-- precios_duplicados=0, errores=[]. En re-corrida: precios_nuevos=0,
-- precios_duplicados=5 (idempotente).

-- ⬇⬇⬇  DEJAR EN ROLLBACK HASTA AUTORIZACIÓN EXPLÍCITA DE PROD  ⬇⬇⬇
rollback;
-- commit;   -- <- cambiar rollback por commit SÓLO con tu "dale" explícito.

-- ============================================================================
-- ROLLBACK POST-COMMIT (si ya se hizo commit y hay que revertir):
--   delete from public.insumo_precios
--   where source_system = 'erp_intelisis'
--     and estado = 'propuesto_validado'
--     and source_document = 'ERP Intelisis · Sillas_CostoPromedio_2024 (Drive) · Migración B precios frescos (PRELIMINAR)'
--     and source_record_id in
--       ('MBLXSN1205D856|','MBLXSN1206E458|','MTHXSA12B5V500|','MBLXSA1295R600|','MZAXBC06060000|');
-- (source_document lo arma la función como 'ERP Intelisis · ' || p_documento.)
-- ============================================================================
