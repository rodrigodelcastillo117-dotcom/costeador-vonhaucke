-- ============================================================================
-- MIGRACIÓN B (real) — precios frescos de las OC de OCTUBRE 2026 → catálogo
-- PREPARADA PARA REVISIÓN. **NO EJECUTADA.** Prod requiere tu 'dale' explícito.
-- 67 precios como PRELIMINAR (estado='propuesto_validado' → NO certifica;
-- costea pero bloquea emisión en firme hasta que un humano corra aprobar_precio).
-- Empate EXACTO articulo+opción, fuente = Orden de Compra real, más fresca que el
-- catálogo, magnitud 5–60%. Idempotente. Fuente: lab/.../DIFF_OC_octubre2026.csv
-- ============================================================================
begin;
select public.cargar_erp_ultima_compra(
  'ERP Intelisis · Órdenes de Compra octubre 2026 (migración B PRELIMINAR)',
  '[]'::jsonb,
  $precios$[
 {
  "source_record_id": "MDACRO05050004|",
  "insumo_id": "erp-roscfla60d",
  "source_price": 106.43,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-14",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135093 · CHAPAS Y MADERAS IMPORTADAS SA DE CV · cat 97.2168(2026-08-27) -> 106.43 (+9.5%)"
 },
 {
  "source_record_id": "MDMECO03060000|",
  "insumo_id": "erp-t5633-e",
  "source_price": 546.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-30",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135236 · PROCABLES DE MEXICO · cat 1087.97(2026-05-15) -> 546.0 (-49.8%)"
 },
 {
  "source_record_id": "MDMTTU03000004|",
  "insumo_id": "erp-tubinox6393",
  "source_price": 8500.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-21",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135146 · ACEROS INOXIDABLES ASA SA DE CV · cat 7300.0(2026-06-22) -> 8500.0 (+16.4%)"
 },
 {
  "source_record_id": "MDMUPN02000002|",
  "insumo_id": "erp-pcm8psr",
  "source_price": 10.42875,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-14",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135093 · CHAPAS Y MADERAS IMPORTADAS SA DE CV · cat 9.53(2026-08-27) -> 10.42875 (+9.4%)"
 },
 {
  "source_record_id": "MDESSA01D600D9|J1279L2159",
  "insumo_id": "erp-esp-juliare250em-j1279l2159",
  "source_price": 6568.43,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-27",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135199 · GRUPO REQUIEZ SA DE CV · cat 5838.08(2026-09-21) -> 6568.43 (+12.5%)"
 },
 {
  "source_record_id": "MDQMAD02040000|",
  "insumo_id": "erp-admdh79",
  "source_price": 701.1,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-12",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135059 · MADERAS Y PLASTICOS SA DE CV · cat 650.56(2026-09-22) -> 701.1 (+7.8%)"
 },
 {
  "source_record_id": "MDQMRS01000000|",
  "insumo_id": "erp-resistol353",
  "source_price": 112.5,
  "source_unit": "Pieza",
  "cost_unit": "Pieza",
  "vigente_desde": "2026-10-29",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135218 · FERRETERÍA XALOSTOC S.A. DE C.V. · cat 93.95(2026-09-30) -> 112.5 (+19.7%)"
 },
 {
  "source_record_id": "MECREF00063624|",
  "insumo_id": "erp-eccitp-bes",
  "source_price": 95.18,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-27",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135200 · POLYURETHANE FOAM DE MEXICO, S.A. DE C.V · cat 84.9599(2026-01-27) -> 95.18 (+12.0%)"
 },
 {
  "source_record_id": "MIIEKT17000000|",
  "insumo_id": "erp-tresaba50",
  "source_price": 220.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-14",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135094 · XCREW GRUPO COMERCIAL · cat 246.0(2025-07-01) -> 220.0 (-10.6%)"
 },
 {
  "source_record_id": "MIIPALRE010000|",
  "insumo_id": "erp-alr16",
  "source_price": 35.1,
  "source_unit": "Kg",
  "cost_unit": "Kg",
  "vigente_desde": "2026-10-19",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135120 · FERRETERÍA XALOSTOC S.A. DE C.V. · cat 47.38(2024-06-19) -> 35.1 (-25.9%)"
 },
 {
  "source_record_id": "MIIPDILA040004|",
  "insumo_id": "erp-did2440",
  "source_price": 66.62,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-30",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135226 · EMILY MELISA JIMENEZ MEDINA · cat 73.24(2026-09-22) -> 66.62 (-9.0%)"
 },
 {
  "source_record_id": "MIIPELM1070100|",
  "insumo_id": "erp-gi12841",
  "source_price": 1150.0,
  "source_unit": "pza",
  "cost_unit": "pza",
  "vigente_desde": "2026-10-15",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135107 · ARIANA MENDEZ HERNANDEZ · cat 950.0(2025-08-29) -> 1150.0 (+21.1%)"
 },
 {
  "source_record_id": "MIIPLB00150402|",
  "insumo_id": "erp-lb50",
  "source_price": 20.28,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-13",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135080 · DISTRIBUIDORA MEXICANA AJ Y COMPAÑIA SA  · cat 17.39(2026-08-19) -> 20.28 (+16.6%)"
 },
 {
  "source_record_id": "MIIPLD00140300|",
  "insumo_id": "erp-ld80",
  "source_price": 7.28,
  "source_unit": "pza",
  "cost_unit": "pza",
  "vigente_desde": "2026-10-28",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135207 · EMILY MELISA JIMENEZ MEDINA · cat 10.5(2026-09-22) -> 7.28 (-30.7%)"
 },
 {
  "source_record_id": "MIIPLD00140601|",
  "insumo_id": "erp-ld18",
  "source_price": 6.9,
  "source_unit": "pza",
  "cost_unit": "pza",
  "vigente_desde": "2026-10-28",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135208 · EMILY MELISA JIMENEZ MEDINA · cat 8.7(2026-09-22) -> 6.9 (-20.7%)"
 },
 {
  "source_record_id": "MIIPROFB070003|",
  "insumo_id": "erp-rdfb4144gr",
  "source_price": 1008.13,
  "source_unit": "pza",
  "cost_unit": "pza",
  "vigente_desde": "2026-10-13",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135080 · DISTRIBUIDORA MEXICANA AJ Y COMPAÑIA SA  · cat 873.71(2026-07-27) -> 1008.13 (+15.4%)"
 },
 {
  "source_record_id": "MIIQAD00400000|",
  "insumo_id": "erp-adtglht650",
  "source_price": 260.416666,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-26",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135188 · MADERAS Y PLASTICOS SA DE CV · cat 275.88(2026-07-20) -> 260.416666 (-5.6%)"
 },
 {
  "source_record_id": "MIMCCL00000101|",
  "insumo_id": "erp-cl1cl",
  "source_price": 17.5,
  "source_unit": "pza",
  "cost_unit": "pza",
  "vigente_desde": "2026-10-15",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135106 · ABASTO BASICO · cat 16.5(2026-09-03) -> 17.5 (+6.1%)"
 },
 {
  "source_record_id": "MIMCCM00000101|",
  "insumo_id": "erp-crn400",
  "source_price": 179.0,
  "source_unit": "pza",
  "cost_unit": "pza",
  "vigente_desde": "2026-10-23",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135177 · JOSE FRANCISCO GARFIAS MILLA · cat 130.0(2026-08-05) -> 179.0 (+37.7%)"
 },
 {
  "source_record_id": "MIMCFLCU410203|",
  "insumo_id": "erp-flcu50s",
  "source_price": 143.75,
  "source_unit": "pza",
  "cost_unit": "pza",
  "vigente_desde": "2026-10-26",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135185 · FERRETERÍA XALOSTOC S.A. DE C.V. · cat 165.8(2023-06-26) -> 143.75 (-13.3%)"
 },
 {
  "source_record_id": "MIMCJB00000100|",
  "insumo_id": "erp-jaza400",
  "source_price": 26.5,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-27",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135202 · JOSE FRANCISCO GARFIAS MILLA · cat 24.38(2026-09-03) -> 26.5 (+8.7%)"
 },
 {
  "source_record_id": "MIMCJBLM000000|",
  "insumo_id": "erp-jalm",
  "source_price": 23.15,
  "source_unit": "lt",
  "cost_unit": "lt",
  "vigente_desde": "2026-10-27",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135198 · ABASTO BASICO · cat 30.625(2026-09-25) -> 23.15 (-24.4%)"
 },
 {
  "source_record_id": "MIMCJE00000000|",
  "insumo_id": "erp-jerg",
  "source_price": 285.0,
  "source_unit": "rollo",
  "cost_unit": "rollo",
  "vigente_desde": "2026-10-15",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135106 · ABASTO BASICO · cat 350.0(2026-07-06) -> 285.0 (-18.6%)"
 },
 {
  "source_record_id": "MIMCROPN010000|",
  "insumo_id": "erp-rpn95",
  "source_price": 61.0,
  "source_unit": "Kg",
  "cost_unit": "Kg",
  "vigente_desde": "2026-10-26",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135190 · TOMAS ARTURO MILLAN GUEVARA · cat 58.0(2024-08-26) -> 61.0 (+5.2%)"
 },
 {
  "source_record_id": "MIMCRUFP070006|",
  "insumo_id": "erp-rfp3114oa80",
  "source_price": 227.0,
  "source_unit": "pza",
  "cost_unit": "pza",
  "vigente_desde": "2026-10-13",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135080 · DISTRIBUIDORA MEXICANA AJ Y COMPAÑIA SA  · cat 197.35(2026-07-08) -> 227.0 (+15.0%)"
 },
 {
  "source_record_id": "MIQUADBQ110000|",
  "insumo_id": "erp-au-0250",
  "source_price": 394.6,
  "source_unit": "lt",
  "cost_unit": "lt",
  "vigente_desde": "2026-10-16",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135116 · SAYER LACK MEXICANA SA DE CV · cat 358.8(2026-03-25) -> 394.6 (+10.0%)"
 },
 {
  "source_record_id": "MLEAC0F1P50000|",
  "insumo_id": "erp-cefica2520aus",
  "source_price": 1596.27,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-13",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135080 · DISTRIBUIDORA MEXICANA AJ Y COMPAÑIA SA  · cat 1383.44(2026-07-02) -> 1596.27 (+15.4%)"
 },
 {
  "source_record_id": "MLEARO0016002D|",
  "insumo_id": "erp-ro2hucf",
  "source_price": 73.64,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-02",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 134994 · NUEVAS INDUSTRIAS RODAMEX, SA DE CV · cat 70.0(2026-07-28) -> 73.64 (+5.2%)"
 },
 {
  "source_record_id": "MLEARO89990037|",
  "insumo_id": "erp-ro2hu",
  "source_price": 59.96,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-02",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 134994 · NUEVAS INDUSTRIAS RODAMEX, SA DE CV · cat 57.0(2026-07-28) -> 59.96 (+5.2%)"
 },
 {
  "source_record_id": "MLESLA0026118B|",
  "insumo_id": "erp-la31010ainox",
  "source_price": 7900.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-13",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135086 · ACEROS INOXIDABLES ASA SA DE CV · cat 11100.0(2022-01-14) -> 7900.0 (-28.8%)"
 },
 {
  "source_record_id": "MLESLA05261100|",
  "insumo_id": "erp-ln10310",
  "source_price": 1885.55,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-20",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135138 · GRUPO INDUSTRIAL ACERERO SA DE CV · cat 2380.2(2026-09-08) -> 1885.55 (-20.8%)"
 },
 {
  "source_record_id": "MLESSO03400030|",
  "insumo_id": "erp-so141",
  "source_price": 152.25,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-07",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135032 · GRUPO COLLADO SA DE CV · cat 240.0(2026-08-27) -> 152.25 (-36.6%)"
 },
 {
  "source_record_id": "MLEXSO310000V9|",
  "insumo_id": "erp-sovroad",
  "source_price": 129.76,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-14",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135093 · CHAPAS Y MADERAS IMPORTADAS SA DE CV · cat 111.43(2026-09-22) -> 129.76 (+16.4%)"
 },
 {
  "source_record_id": "MPMASS01010203|",
  "insumo_id": "erp-ss367612bom",
  "source_price": 11265.0,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-09",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135050 · MADERAS, AGLOMERADOS Y TRIPLAY · cat 9797.14(2025-09-04) -> 11265.0 (+15.0%)"
 },
 {
  "source_record_id": "MPMTBA01010001|",
  "insumo_id": "erp-bard58inox",
  "source_price": 800.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-13",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135086 · ACEROS INOXIDABLES ASA SA DE CV · cat 750.0(2026-09-11) -> 800.0 (+6.7%)"
 },
 {
  "source_record_id": "MPMTTU03050304|",
  "insumo_id": "erp-tubi214inox",
  "source_price": 1090.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-13",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135086 · ACEROS INOXIDABLES ASA SA DE CV · cat 850.0(2026-08-28) -> 1090.0 (+28.2%)"
 },
 {
  "source_record_id": "MVLAJA00140027|",
  "insumo_id": "erp-jalhafzi",
  "source_price": 32.17,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-05",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135020 · DISTRIBUIDORA DE HERRAJES TECNICOS Y SIM · cat 61.14(2026-08-26) -> 32.17 (-47.4%)"
 },
 {
  "source_record_id": "MVLEPL06060000|",
  "insumo_id": "erp-prvdstb",
  "source_price": 18.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-01",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 134976 · VARIOS · cat 21.55(2026-01-21) -> 18.0 (-16.5%)"
 },
 {
  "source_record_id": "MVLMAG01280400|B716",
  "insumo_id": "erp-ame1248-b716",
  "source_price": 648.9,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-20",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135132 · MADERAS Y PLASTICOS SA DE CV · cat 575.0(2026-02-05) -> 648.9 (+12.9%)"
 },
 {
  "source_record_id": "MVLMAG01280600|B805",
  "insumo_id": "erp-ame1948-b805",
  "source_price": 718.0,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-05",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135011 · DISTRIBUIDORA DE TABLEROS ARAGON SA DE C · cat 677.0(2026-02-24) -> 718.0 (+6.1%)"
 },
 {
  "source_record_id": "MVLMCC06060000|C809",
  "insumo_id": "erp-ch32pvc-c809",
  "source_price": 2.85,
  "source_unit": "m",
  "cost_unit": "m",
  "vigente_desde": "2026-10-19",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135129 · CANPLAST MEXICO, SA DE CV · cat 2.59(2026-02-17) -> 2.85 (+10.0%)"
 },
 {
  "source_record_id": "MVLMMD02280200|",
  "insumo_id": "erp-mdf55",
  "source_price": 177.9517,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-30",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135228 · MADERAS, AGLOMERADOS Y TRIPLAY · cat 166.31(2026-09-29) -> 177.9517 (+7.0%)"
 },
 {
  "source_record_id": "MVLMMD02280500|",
  "insumo_id": "erp-mdf16",
  "source_price": 398.04,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-30",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135228 · MADERAS, AGLOMERADOS Y TRIPLAY · cat 372.0(2026-10-02) -> 398.04 (+7.0%)"
 },
 {
  "source_record_id": "MVLMMD02280700|",
  "insumo_id": "erp-mdf25",
  "source_price": 839.42,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-30",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135228 · MADERAS, AGLOMERADOS Y TRIPLAY · cat 784.5(2026-10-02) -> 839.42 (+7.0%)"
 },
 {
  "source_record_id": "MVLMSS000404O8|",
  "insumo_id": "erp-ss37dg69",
  "source_price": 9725.07,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-16",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135110 · PORCELANOSA MEXICO SA DE CV · cat 8749.85(2026-07-03) -> 9725.07 (+11.1%)"
 },
 {
  "source_record_id": "MVLMSS000504Q1|",
  "insumo_id": "erp-ss12argt909",
  "source_price": 7679.63,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-12",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135059 · MADERAS Y PLASTICOS SA DE CV · cat 6621.6468(2022-01-26) -> 7679.63 (+16.0%)"
 },
 {
  "source_record_id": "MVLQAD09183912|",
  "insumo_id": "erp-adssgw50b2",
  "source_price": 234.932,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-05",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135017 · FDS · cat 266.0879(2025-04-10) -> 234.932 (-11.7%)"
 },
 {
  "source_record_id": "MVLREF00063402|",
  "insumo_id": "erp-eccitp-be",
  "source_price": 472.94,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-27",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135200 · POLYURETHANE FOAM DE MEXICO, S.A. DE C.V · cat 422.26(2026-01-27) -> 472.94 (+12.0%)"
 },
 {
  "source_record_id": "MVLREF08613530|",
  "insumo_id": "erp-pacsoint-ast",
  "source_price": 414.4,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-27",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135200 · POLYURETHANE FOAM DE MEXICO, S.A. DE C.V · cat 370.0(2026-04-08) -> 414.4 (+12.0%)"
 },
 {
  "source_record_id": "MVLREF08622429|",
  "insumo_id": "erp-pacsoint-rs",
  "source_price": 133.78,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-27",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135200 · POLYURETHANE FOAM DE MEXICO, S.A. DE C.V · cat 119.45(2026-04-08) -> 133.78 (+12.0%)"
 },
 {
  "source_record_id": "MVLRPI00000000|D805",
  "insumo_id": "erp-piel-d805",
  "source_price": 4.79,
  "source_unit": "dm²",
  "cost_unit": "dm²",
  "vigente_desde": "2026-10-09",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135054 · FARFALLA DISEÑO EN PIEL SA DE CV · cat 4.43(2025-11-18) -> 4.79 (+8.1%)"
 },
 {
  "source_record_id": "MVLSLA002605Ñ0|",
  "insumo_id": "erp-li20310",
  "source_price": 1900.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-21",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135146 · ACEROS INOXIDABLES ASA SA DE CV · cat 2850.0(2020-08-20) -> 1900.0 (-33.3%)"
 },
 {
  "source_record_id": "MVLSLA05260302|",
  "insumo_id": "erp-ln16310",
  "source_price": 800.0,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-20",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135138 · GRUPO INDUSTRIAL ACERERO SA DE CV · cat 712.72(2026-07-01) -> 800.0 (+12.2%)"
 },
 {
  "source_record_id": "MVLSLA05260402|",
  "insumo_id": "erp-ln18310",
  "source_price": 615.15,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-20",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135138 · GRUPO INDUSTRIAL ACERERO SA DE CV · cat 571.54(2026-07-29) -> 615.15 (+7.6%)"
 },
 {
  "source_record_id": "MVLSLA05270602|",
  "insumo_id": "erp-ln22410",
  "source_price": 521.55,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-20",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135138 · GRUPO INDUSTRIAL ACERERO SA DE CV · cat 485.406(2026-09-09) -> 521.55 (+7.4%)"
 },
 {
  "source_record_id": "MVLSLA06260403|",
  "insumo_id": "erp-li18310",
  "source_price": 2700.0,
  "source_unit": "Hoja",
  "cost_unit": "Hoja",
  "vigente_desde": "2026-10-21",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135146 · ACEROS INOXIDABLES ASA SA DE CV · cat 2405.0(2026-08-28) -> 2700.0 (+12.3%)"
 },
 {
  "source_record_id": "MVLSPT01044501|",
  "insumo_id": "erp-ptr112r",
  "source_price": 570.71,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-22",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135156 · GRUPO COLLADO SA DE CV · cat 483.0(2025-12-29) -> 570.71 (+18.2%)"
 },
 {
  "source_record_id": "MVLSTU01080501|",
  "insumo_id": "erp-tc201",
  "source_price": 131.64,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-29",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135213 · ACEROS Y TUBERIA INDUSTRIAL CORTES · cat 96.6(2026-08-20) -> 131.64 (+36.3%)"
 },
 {
  "source_record_id": "MVLSTU01110401|",
  "insumo_id": "erp-tc18112",
  "source_price": 241.25,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-22",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135155 · GRUPO COLLADO SA DE CV · cat 200.04(2026-08-20) -> 241.25 (+20.6%)"
 },
 {
  "source_record_id": "MVLSTU01120201|",
  "insumo_id": "erp-tc142",
  "source_price": 409.5,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-22",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135157 · GRUPO COLLADO SA DE CV · cat 369.09(2026-06-09) -> 409.5 (+10.9%)"
 },
 {
  "source_record_id": "MVLSTU02110409|",
  "insumo_id": "erp-tr18112ai",
  "source_price": 550.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-13",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135086 · ACEROS INOXIDABLES ASA SA DE CV · cat 973.0(2021-11-25) -> 550.0 (-43.5%)"
 },
 {
  "source_record_id": "MVLSTU02160301|",
  "insumo_id": "erp-tre163",
  "source_price": 387.5,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-07",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135032 · GRUPO COLLADO SA DE CV · cat 488.11(2026-09-17) -> 387.5 (-20.6%)"
 },
 {
  "source_record_id": "MVLSTU03230409|",
  "insumo_id": "erp-tre2021rein",
  "source_price": 690.0,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-13",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135086 · ACEROS INOXIDABLES ASA SA DE CV · cat 772.8(2024-07-03) -> 690.0 (-10.7%)"
 },
 {
  "source_record_id": "MVLUPI06650053|",
  "insumo_id": "erp-pi1419hg",
  "source_price": 0.5,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-23",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135166 · ALFARO LOPEZ REGINO · cat 0.53(2026-09-10) -> 0.5 (-5.7%)"
 },
 {
  "source_record_id": "MVLUPI10350002|",
  "insumo_id": "erp-pi1015g",
  "source_price": 0.22,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-23",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135166 · ALFARO LOPEZ REGINO · cat 0.25(2026-09-10) -> 0.22 (-12.0%)"
 },
 {
  "source_record_id": "MVLURO26522902|",
  "insumo_id": "erp-ro14ga",
  "source_price": 0.25,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-23",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135166 · ALFARO LOPEZ REGINO · cat 0.21(2026-09-08) -> 0.25 (+19.0%)"
 },
 {
  "source_record_id": "MVLUTO12110041|",
  "insumo_id": "erp-toa1412cbn",
  "source_price": 0.86,
  "source_unit": "pieza",
  "cost_unit": "pieza",
  "vigente_desde": "2026-10-20",
  "estado": "propuesto_validado",
  "evidencia": "OC octubre 2026 · Orden Compra 135143 · ALFARO LOPEZ REGINO · cat 0.6(2026-08-06) -> 0.86 (+43.3%)"
 }
]$precios$::jsonb
) as resultado;
-- Revisa resultado: precios_nuevos=67, duplicados=0, errores=[]. Re-corrida: idempotente.
rollback;  -- cambiar por 'commit;' SÓLO con autorización explícita de Dirección.