-- A11 · Certificación con documento · aplicado en producción el 2026-10-12 (sesión Claude, aprobación de Dirección "hazlo todo").
-- Fuente: ERP Intelisis, "Costos de Materia Prima Ultima Compra al 10082026.xlsx" (Drive de Compras), cruce por Artículo|Opción
-- contra `src/datos/insumos.js` (scratch: erp_dl/cruce.mjs). Este archivo es el RASTRO de lo aplicado; NO es una migración
-- re-ejecutable (los hashes de provenance son únicos y los ids 370–480 ya existen).
--
-- Resultado: 110 filas DATA_TRUTH_V1 (ids 370–479). 103 aprobadas vía RPC `aprobar_precio` con sesión de rol dirección
-- (compra ≤ 24 meses). 7 quedaron `propuesto_validado` por compra ANTIGUA (>24 meses): melamina-16/19/28-sand,
-- melamina-28-gris-humo-lm, pintura-polvo-gris-unido-axalta, acrilico-traslucido-3, tubular-redondo-34.
-- Además: VH-075 fila 96 (pintura-polvo 6.69 = USD como MXN) cerrada; VH-082 fila 136 (caja-byrne 167 USD como MXN) cerrada
-- y reemplazada por fila 480 `propuesto` con requiere_validacion_compras=true.

update public.insumo_precios set vigente_hasta = date '2026-10-11' where id = 96  and insumo_id = 'pintura-polvo' and vigente_hasta is null;
update public.insumo_precios set vigente_hasta = date '2026-10-11' where id = 136 and insumo_id = 'caja-byrne'    and vigente_hasta is null;

insert into public.insumo_precios
 (insumo_id, precio, contract_status, source_system, source_document, source_record_id, source_price, source_currency, source_unit, source_units_per_cost_unit, cost_unit, vigente_desde, estado, confidence, evidence_status, evidencia, fuente, creado_por, requiere_validacion_compras)
select v.insumo_id, 0, 'DATA_TRUTH_V1', 'erp_intelisis', 'ERP Intelisis · Costos de Materia Prima Ultima Compra al 10082026.xlsx (Drive, Compras)', v.rec, v.precio, 'MXN', v.src_unit, 1, v.cost_unit, v.fecha::date, v.estado, 'alta', 'documentada', v.evid, 'Compras · ERP Intelisis última compra (corte 2026-08-10)', 'a11-erp-2026-10-12', false
from (values
('melamina-12-antracita-light-tx',739.8,'hoja','hoja','2025-06-17','MVLMAG01280400|B761','propuesto','ERP última compra 2025-06-17 · AME1248 ACABADO MADERA ANTRACITA LIGHT TX'),
('melamina-12-fresno-bruma-tx',575.0,'hoja','hoja','2026-02-09','MVLMAG01280400|B807','propuesto','ERP última compra 2026-02-09 · AME1248 ACABADO MADERA FRESNO BRUMA TX'),
('melamina-16-antracita-light',608.76,'hoja','hoja','2025-07-30','MVLMAG01280500|B799','propuesto','ERP última compra 2025-07-30 · AME1648 ACABADO MADERA ANTRACITA LIGHT'),
('melamina-16-antracita-light-tx',694.8,'hoja','hoja','2026-07-07','MVLMAG01280500|B761','propuesto','ERP última compra 2026-07-07 · AME1648 ACABADO MADERA ANTRACITA LIGHT TX'),
('melamina-16-antracite-oak',822.6,'hoja','hoja','2026-06-25','MVLMAG01280500|B713','propuesto','ERP última compra 2026-06-25 · AME1648 ACABADO MADERA ANTRACITE OAK'),
('melamina-16-antracite-oak-tx',694.8,'hoja','hoja','2026-06-25','MVLMAG01280500|B747','propuesto','ERP última compra 2026-06-25 · AME1648 ACABADO MADERA ANTRACITE OAK TX'),
('melamina-16-black',576.72,'hoja','hoja','2025-09-17','MVLMAG01280500|B721','propuesto','ERP última compra 2025-09-17 · AME1648 ACABADO MADERA BLACK'),
('melamina-16-blanco-absoluto',449.0,'hoja','hoja','2026-07-06','MVLMAG01280500|B809','propuesto','ERP última compra 2026-07-06 · AME1648 ACABADO MADERA BLANCO ABSOLUTO'),
('melamina-16-durango-tx',646.0,'hoja','hoja','2026-02-06','MVLMAG01280500|B835','propuesto','ERP última compra 2026-02-06 · AME1648 ACABADO MADERA DURANGO TX'),
('melamina-16-ebano-indi',646.0,'hoja','hoja','2025-09-22','MVLMAG01280500|B1096','propuesto','ERP última compra 2025-09-22 · AME1648 ACABADO MADERA EBANO INDI'),
('melamina-16-encino-polar-tx',685.0,'hoja','hoja','2026-07-28','MVLMAG01280500|B1054','propuesto','ERP última compra 2026-07-28 · AME1648 ACABADO MADERA ENCINO POLAR TX'),
('melamina-16-fresno-bruma-tx',646.0,'hoja','hoja','2026-02-09','MVLMAG01280500|B807','propuesto','ERP última compra 2026-02-09 · AME1648 ACABADO MADERA FRESNO BRUMA TX'),
('melamina-16-frosty-white',413.0,'hoja','hoja','2026-03-24','MVLMAG01280500|B744','propuesto','ERP última compra 2026-03-24 · AME1648 ACABADO MADERA FROSTY WHITE'),
('melamina-16-ivory',695.7,'hoja','hoja','2026-02-20','MVLMAG01280500|B717','propuesto','ERP última compra 2026-02-20 · AME1648 ACABADO MADERA IVORY'),
('melamina-16-ivory-new',788.4,'hoja','hoja','2025-04-07','MVLMAG01280500|B751','propuesto','ERP última compra 2025-04-07 · AME1648 ACABADO MADERA IVORY NEW'),
('melamina-16-ivory-vanyla',774.9,'hoja','hoja','2026-04-29','MVLMAG01280500|B838','propuesto','ERP última compra 2026-04-29 · AME1648 ACABADO MADERA IVORY VANYLA'),
('melamina-16-latte-tx',685.0,'hoja','hoja','2026-07-22','MVLMAG01280500|B837','propuesto','ERP última compra 2026-07-22 · AME1648 ACABADO MADERA LATTE TX'),
('melamina-16-light-ash-lp',645.0,'hoja','hoja','2025-09-09','MVLMAG01280500|B770','propuesto','ERP última compra 2025-09-09 · AME1648 ACABADO MADERA LIGHT ASH LP'),
('melamina-16-maple-fire',740.7,'hoja','hoja','2025-10-08','MVLMAG01280500|B1094','propuesto','ERP última compra 2025-10-08 · AME1648 ACABADO MADERA MAPLE FIRE'),
('melamina-16-monarca-tx',685.0,'hoja','hoja','2026-06-16','MVLMAG01280500|B836','propuesto','ERP última compra 2026-06-16 · AME1648 ACABADO MADERA MONARCA TX'),
('melamina-16-nogal-neo-tx',665.0,'hoja','hoja','2026-06-04','MVLMAG01280500|B805','propuesto','ERP última compra 2026-06-04 · AME1648 ACABADO MADERA NOGAL NEO TX'),
('melamina-16-roble-merida-tx',685.0,'hoja','hoja','2026-08-04','MVLMAG01280500|B806','propuesto','ERP última compra 2026-08-04 · AME1648 ACABADO MADERA ROBLE MERIDA TX'),
('melamina-16-sand',690.3,'hoja','hoja','2024-09-12','MVLMAG01280500|B743','propuesto_validado','ERP última compra 2024-09-12 · AME1648 ACABADO MADERA SAND · ANTIGUA >24 meses: re-cotizar con Compras antes de certificar'),
('melamina-16-soft-grey',774.9,'hoja','hoja','2026-06-25','MVLMAG01280500|B718','propuesto','ERP última compra 2026-06-25 · AME1648 ACABADO MADERA SOFT GREY'),
('melamina-16-terracota',788.4,'hoja','hoja','2025-09-24','MVLMAG01280500|B839','propuesto','ERP última compra 2025-09-24 · AME1648 ACABADO MADERA TERRACOTA'),
('melamina-16-verde-esmeralda',788.4,'hoja','hoja','2025-09-24','MVLMAG01280500|B840','propuesto','ERP última compra 2025-09-24 · AME1648 ACABADO MADERA VERDE ESMERALDA'),
('melamina-16-walnut',608.76,'hoja','hoja','2025-07-30','MVLMAG01280500|B709','propuesto','ERP última compra 2025-07-30 · AME1648 ACABADO MADERA WALNUT'),
('melamina-16-white-ash',681.13,'hoja','hoja','2026-07-21','MVLMAG01280500|B716','propuesto','ERP última compra 2026-07-21 · AME1648 ACABADO MADERA WHITE ASH'),
('melamina-16-white-ash-tx',827.82,'hoja','hoja','2025-07-07','MVLMAG01280500|B746','propuesto','ERP última compra 2025-07-07 · AME1648 ACABADO MADERA WHITE ASH TX'),
('melamina-19-antracita-light',904.5,'hoja','hoja','2025-08-28','MVLMAG01280600|B799','propuesto','ERP última compra 2025-08-28 · AME1948 ACABADO MADERA ANTRACITA LIGHT'),
('melamina-19-antracita-light-tx',793.8,'hoja','hoja','2026-07-07','MVLMAG01280600|B761','propuesto','ERP última compra 2026-07-07 · AME1948 ACABADO MADERA ANTRACITA LIGHT TX'),
('melamina-19-antracite-oak',936.0,'hoja','hoja','2026-06-30','MVLMAG01280600|B713','propuesto','ERP última compra 2026-06-30 · AME1948 ACABADO MADERA ANTRACITE OAK'),
('melamina-19-antracite-oak-tx',793.8,'hoja','hoja','2026-06-25','MVLMAG01280600|B747','propuesto','ERP última compra 2026-06-25 · AME1948 ACABADO MADERA ANTRACITE OAK TX'),
('melamina-19-black',639.91,'hoja','hoja','2026-07-02','MVLMAG01280600|B721','propuesto','ERP última compra 2026-07-02 · AME1948 ACABADO MADERA BLACK'),
('melamina-19-blanco-absoluto',483.0,'hoja','hoja','2026-04-15','MVLMAG01280600|B809','propuesto','ERP última compra 2026-04-15 · AME1948 ACABADO MADERA BLANCO ABSOLUTO'),
('melamina-19-cerezo-au',677.0,'hoja','hoja','2025-12-18','MVLMAG01280600|B1093','propuesto','ERP última compra 2025-12-18 · AME1948 ACABADO MADERA CEREZO AU'),
('melamina-19-fresno-bruma-tx',718.0,'hoja','hoja','2026-06-16','MVLMAG01280600|B807','propuesto','ERP última compra 2026-06-16 · AME1948 ACABADO MADERA FRESNO BRUMA TX'),
('melamina-19-frosty-white',544.0,'hoja','hoja','2026-07-06','MVLMAG01280600|B744','propuesto','ERP última compra 2026-07-06 · AME1948 ACABADO MADERA FROSTY WHITE'),
('melamina-19-gris-humo-lm',904.5,'hoja','hoja','2025-02-11','MVLMAG01280600|B1095','propuesto','ERP última compra 2025-02-11 · AME1948 ACABADO MADERA GRIS HUMO LM'),
('melamina-19-ivory',904.5,'hoja','hoja','2025-09-23','MVLMAG01280600|B717','propuesto','ERP última compra 2025-09-23 · AME1948 ACABADO MADERA IVORY'),
('melamina-19-ivory-new',904.5,'hoja','hoja','2025-01-07','MVLMAG01280600|B751','propuesto','ERP última compra 2025-01-07 · AME1948 ACABADO MADERA IVORY NEW'),
('melamina-19-ivory-vanyla',904.5,'hoja','hoja','2026-02-24','MVLMAG01280600|B838','propuesto','ERP última compra 2026-02-24 · AME1948 ACABADO MADERA IVORY VANYLA'),
('melamina-19-latte-tx',718.0,'hoja','hoja','2026-07-28','MVLMAG01280600|B837','propuesto','ERP última compra 2026-07-28 · AME1948 ACABADO MADERA LATTE TX'),
('melamina-19-light-ash-lp',644.0,'hoja','hoja','2025-06-24','MVLMAG01280600|B770','propuesto','ERP última compra 2025-06-24 · AME1948 ACABADO MADERA LIGHT ASH LP'),
('melamina-19-monarca-tx',665.0,'hoja','hoja','2026-08-10','MVLMAG01280600|B836','propuesto','ERP última compra 2026-08-10 · AME1948 ACABADO MADERA MONARCA TX'),
('melamina-19-roble-merida-tx',718.0,'hoja','hoja','2026-08-04','MVLMAG01280600|B806','propuesto','ERP última compra 2026-08-04 · AME1948 ACABADO MADERA ROBLE MERIDA TX'),
('melamina-19-sand',792.0,'hoja','hoja','2024-09-12','MVLMAG01280600|B743','propuesto_validado','ERP última compra 2024-09-12 · AME1948 ACABADO MADERA SAND · ANTIGUA >24 meses: re-cotizar con Compras antes de certificar'),
('melamina-19-soft-grey',778.5,'hoja','hoja','2026-07-13','MVLMAG01280600|B718','propuesto','ERP última compra 2026-07-13 · AME1948 ACABADO MADERA SOFT GREY'),
('melamina-19-verde-esmeralda',904.5,'hoja','hoja','2025-12-09','MVLMAG01280600|B840','propuesto','ERP última compra 2025-12-09 · AME1948 ACABADO MADERA VERDE ESMERALDA'),
('melamina-19-walnut',671.95,'hoja','hoja','2025-07-30','MVLMAG01280600|B709','propuesto','ERP última compra 2025-07-30 · AME1948 ACABADO MADERA WALNUT'),
('melamina-19-wengue',660.0,'hoja','hoja','2025-07-23','MVLMAG01280600|B712','propuesto','ERP última compra 2025-07-23 · AME1948 ACABADO MADERA WENGUE'),
('melamina-19-white-ash',778.5,'hoja','hoja','2026-07-02','MVLMAG01280600|B716','propuesto','ERP última compra 2026-07-02 · AME1948 ACABADO MADERA WHITE ASH'),
('melamina-19-white-ash-tx',949.72,'hoja','hoja','2026-01-28','MVLMAG01280600|B746','propuesto','ERP última compra 2026-01-28 · AME1948 ACABADO MADERA WHITE ASH TX'),
('melamina-28-antracita-light',995.91,'hoja','hoja','2025-08-04','MVLMAG01280800|B799','propuesto','ERP última compra 2025-08-04 · AME2848 ACABADO MADERA ANTRACITA LIGHT'),
('melamina-28-antracita-light-tx',1295.1,'hoja','hoja','2026-07-07','MVLMAG01280800|B761','propuesto','ERP última compra 2026-07-07 · AME2848 ACABADO MADERA ANTRACITA LIGHT TX'),
('melamina-28-antracite-oak',1269.9,'hoja','hoja','2026-06-25','MVLMAG01280800|B713','propuesto','ERP última compra 2026-06-25 · AME2848 ACABADO MADERA ANTRACITE OAK'),
('melamina-28-antracite-oak-tx',1295.1,'hoja','hoja','2026-06-26','MVLMAG01280800|B747','propuesto','ERP última compra 2026-06-26 · AME2848 ACABADO MADERA ANTRACITE OAK TX'),
('melamina-28-black',1026.9,'hoja','hoja','2026-07-09','MVLMAG01280800|B721','propuesto','ERP última compra 2026-07-09 · AME2848 ACABADO MADERA BLACK'),
('melamina-28-blanco-absoluto',826.0,'hoja','hoja','2026-08-04','MVLMAG01280800|B809','propuesto','ERP última compra 2026-08-04 · AME2848 ACABADO MADERA BLANCO ABSOLUTO'),
('melamina-28-cerezo-au',1075.0,'hoja','hoja','2026-01-23','MVLMAG01280800|B1093','propuesto','ERP última compra 2026-01-23 · AME2848 ACABADO MADERA CEREZO AU'),
('melamina-28-durango-tx',1107.0,'hoja','hoja','2026-05-07','MVLMAG01280800|B835','propuesto','ERP última compra 2026-05-07 · AME2848 ACABADO MADERA DURANGO TX'),
('melamina-28-ebano-indi',1075.0,'hoja','hoja','2025-09-22','MVLMAG01280800|B1096','propuesto','ERP última compra 2025-09-22 · AME2848 ACABADO MADERA EBANO INDI'),
('melamina-28-encino-polar-tx',1140.0,'hoja','hoja','2026-08-04','MVLMAG01280800|B1054','propuesto','ERP última compra 2026-08-04 · AME2848 ACABADO MADERA ENCINO POLAR TX'),
('melamina-28-fresno-bruma-tx',1075.0,'hoja','hoja','2026-01-22','MVLMAG01280800|B807','propuesto','ERP última compra 2026-01-22 · AME2848 ACABADO MADERA FRESNO BRUMA TX'),
('melamina-28-frosty-white',842.0,'hoja','hoja','2026-08-04','MVLMAG01280800|B744','propuesto','ERP última compra 2026-08-04 · AME2848 ACABADO MADERA FROSTY WHITE'),
('melamina-28-gris-humo-lm',1544.05,'hoja','hoja','2024-09-10','MVLMAG01280800|B1095','propuesto_validado','ERP última compra 2024-09-10 · AME2848 ACABADO MADERA GRIS HUMO LM · ANTIGUA >24 meses: re-cotizar con Compras antes de certificar'),
('melamina-28-ivory',1122.3,'hoja','hoja','2026-04-28','MVLMAG01280800|B717','propuesto','ERP última compra 2026-04-28 · AME2848 ACABADO MADERA IVORY'),
('melamina-28-ivory-new',1332.9,'hoja','hoja','2025-04-11','MVLMAG01280800|B751','propuesto','ERP última compra 2025-04-11 · AME2848 ACABADO MADERA IVORY NEW'),
('melamina-28-ivory-vanyla',1269.9,'hoja','hoja','2026-07-15','MVLMAG01280800|B838','propuesto','ERP última compra 2026-07-15 · AME2848 ACABADO MADERA IVORY VANYLA'),
('melamina-28-latte-tx',1140.0,'hoja','hoja','2026-07-28','MVLMAG01280800|B837','propuesto','ERP última compra 2026-07-28 · AME2848 ACABADO MADERA LATTE TX'),
('melamina-28-light-ash-lp',1075.0,'hoja','hoja','2026-01-21','MVLMAG01280800|B770','propuesto','ERP última compra 2026-01-21 · AME2848 ACABADO MADERA LIGHT ASH LP'),
('melamina-28-maple-fire',1253.7,'hoja','hoja','2026-01-30','MVLMAG01280800|B1094','propuesto','ERP última compra 2026-01-30 · AME2848 ACABADO MADERA MAPLE FIRE'),
('melamina-28-monarca-tx',1056.0,'hoja','hoja','2026-08-04','MVLMAG01280800|B836','propuesto','ERP última compra 2026-08-04 · AME2848 ACABADO MADERA MONARCA TX'),
('melamina-28-nogal-neo-tx',1107.0,'hoja','hoja','2026-06-04','MVLMAG01280800|B805','propuesto','ERP última compra 2026-06-04 · AME2848 ACABADO MADERA NOGAL NEO TX'),
('melamina-28-roble-merida-tx',1140.0,'hoja','hoja','2026-08-04','MVLMAG01280800|B806','propuesto','ERP última compra 2026-08-04 · AME2848 ACABADO MADERA ROBLE MERIDA TX'),
('melamina-28-sand',1170.9,'hoja','hoja','2024-09-23','MVLMAG01280800|B743','propuesto_validado','ERP última compra 2024-09-23 · AME2848 ACABADO MADERA SAND · ANTIGUA >24 meses: re-cotizar con Compras antes de certificar'),
('melamina-28-soft-grey',1269.9,'hoja','hoja','2026-07-13','MVLMAG01280800|B718','propuesto','ERP última compra 2026-07-13 · AME2848 ACABADO MADERA SOFT GREY'),
('melamina-28-verde-esmeralda',1332.9,'hoja','hoja','2025-12-04','MVLMAG01280800|B840','propuesto','ERP última compra 2025-12-04 · AME2848 ACABADO MADERA VERDE ESMERALDA'),
('melamina-28-walnut',1335.6,'hoja','hoja','2026-08-07','MVLMAG01280800|B709','propuesto','ERP última compra 2026-08-07 · AME2848 ACABADO MADERA WALNUT'),
('melamina-28-white-ash',1269.9,'hoja','hoja','2026-08-07','MVLMAG01280800|B716','propuesto','ERP última compra 2026-08-07 · AME2848 ACABADO MADERA WHITE ASH'),
('melamina-28-white-ash-tx',1399.5,'hoja','hoja','2026-01-28','MVLMAG01280800|B746','propuesto','ERP última compra 2026-01-28 · AME2848 ACABADO MADERA WHITE ASH TX'),
('pintura-polvo-aluminio-anodizado',261.21188,'kg','kg','2026-02-10','MVLQPP00000000|A108','propuesto','ERP última compra 2026-02-10 · PPH COLOR METAL ALUMINIO ANODIZADO'),
('pintura-polvo-antracita-tx',231.898146,'kg','kg','2026-08-04','MVLQPP00000000|A105','propuesto','ERP última compra 2026-08-04 · PPH COLOR METAL ANTRACITA TX'),
('pintura-polvo-azul-ral-5010-089-41060',301.303632,'kg','kg','2026-07-31','MVLQPP00000000|A506','propuesto','ERP última compra 2026-07-31 · PPH COLOR METAL AZUL RAL 5010-089/41060'),
('pintura-polvo-basic-white',115.949073,'kg','kg','2026-08-04','MVLQPP00000000|A101','propuesto','ERP última compra 2026-08-04 · PPH COLOR METAL BASIC WHITE'),
('pintura-polvo-black-tx',107.976491,'kg','kg','2026-08-04','MVLQPP00000000|A112','propuesto','ERP última compra 2026-08-04 · PPH COLOR METAL BLACK TX'),
('pintura-polvo-blanco-ral-9016-009-13120',239.37325,'kg','kg','2026-07-08','MVLQPP00000000|A519','propuesto','ERP última compra 2026-07-08 · PPH COLOR METAL BLANCO RAL 9016 009/13120'),
('pintura-polvo-charcoal',170.47305,'kg','kg','2026-08-07','MVLQPP00000000|A118','propuesto','ERP última compra 2026-08-07 · PPH COLOR METAL CHARCOAL'),
('pintura-polvo-gris-light-gray',276.29394,'kg','kg','2025-04-25','MVLQPP00000000|A55','propuesto','ERP última compra 2025-04-25 · PPH COLOR METAL GRIS LIGHT GRAY'),
('pintura-polvo-gris-ral-7036',242.962547,'kg','kg','2024-10-17','MVLQPP00000000|A511','propuesto','ERP última compra 2024-10-17 · PPH COLOR METAL GRIS RAL 7036'),
('pintura-polvo-gris-unido-axalta',171.1,'kg','kg','2024-10-09','MVLQPP00000000|A547','propuesto_validado','ERP última compra 2024-10-09 · PPH COLOR METAL GRIS UNIDO AXALTA · ANTIGUA >24 meses: re-cotizar con Compras antes de certificar'),
('pintura-polvo-ivory',168.56,'kg','kg','2026-02-13','MVLQPP00000000|A102','propuesto','ERP última compra 2026-02-13 · PPH COLOR METAL IVORY'),
('pintura-polvo-negro-mate-45-hnl40205',59.367352,'kg','kg','2025-06-16','MVLQPP00000000|A542','propuesto','ERP última compra 2025-06-16 · PPH COLOR METAL NEGRO MATE 45 HNL40205'),
('pintura-polvo-negro-mate-8-vitracoat',120.677966,'kg','kg','2025-12-10','MVLQPP00000000|A550','propuesto','ERP última compra 2025-12-10 · PPH COLOR METAL NEGRO MATE 8 VITRACOAT'),
('pintura-polvo-pintura-hibrida-pantone-228-c-60-de-brillo',260.2769,'kg','kg','2025-04-25','MVLQPP00000000|A56','propuesto','ERP última compra 2025-04-25 · PPH COLOR METAL PINTURA HIBRIDA PANTONE 228-C 60% DE BRILLO'),
('pintura-polvo-silver',345.61485,'kg','kg','2026-07-14','MVLQPP00000000|A106','propuesto','ERP última compra 2026-07-14 · PPH COLOR METAL SILVER'),
('pintura-polvo-silver-tx',227.37477,'kg','kg','2026-07-27','MVLQPP00000000|A107','propuesto','ERP última compra 2026-07-27 · PPH COLOR METAL SILVER TX'),
('pintura-polvo-solar-black-44-80060-de-tiger',214.150149,'kg','kg','2025-07-11','MVLQPP00000000|A523','propuesto','ERP última compra 2025-07-11 · PPH COLOR METAL SOLAR BLACK 44/80060 DE TIGER'),
('pintura-polvo-warm-grey-tx',167.844288,'kg','kg','2026-03-18','MVLQPP00000000|A104','propuesto','ERP última compra 2026-03-18 · PPH COLOR METAL WARM GREY TX'),
('laminado-walnut',684.36,'hoja','hoja','2026-05-18','MVLMLP00280000|B709','propuesto','ERP última compra 2026-05-18 · FOCH ACABADO MADERA WALNUT'),
('acrilico-cristal-3',900.0,'hoja','hoja','2026-01-13','MLEPAC00711600|','propuesto','ERP última compra 2026-01-13 · ACCR346'),
('acrilico-traslucido-3',964.0,'hoja','hoja','2016-11-09','MLEPAT00641600|','propuesto_validado','ERP última compra 2016-11-09 · ANTIGUA >24 meses: re-cotizar con Compras antes de certificar'),
('tubular-redondo-34',138.4,'pieza','tramo','2021-10-13','MVLSTU02060401|','propuesto_validado','ERP última compra 2021-10-13 · TR1834 · ANTIGUA >24 meses: re-cotizar con Compras antes de certificar'),
('pulido-redondo-14',30.25,'pieza','tramo','2025-07-30','MVLSPU02030001|','propuesto','ERP última compra 2025-07-30 · TRE14PU'),
('lamina-3x10-20',428.65,'hoja','hoja','2026-08-05','MVLSLA05260502|','propuesto','ERP última compra 2026-08-05 · LN20310'),
('lamina-3x10-14',816.48,'hoja','hoja','2026-01-26','MVLSLA05260202|','propuesto','ERP última compra 2026-01-26 · LN14310'),
('lamina-3x10-12',1336.56,'hoja','hoja','2026-07-15','MVLSLA05261002|','propuesto','ERP última compra 2026-07-15 · LN12310'),
('nivelador-plataforma',41.63,'pieza','pza','2026-08-03','MVLUTO15181009|','propuesto','ERP última compra 2026-08-03 · TO381NIC')
) as v(insumo_id, precio, src_unit, cost_unit, fecha, rec, estado, evid)
where not exists (select 1 from public.insumo_precios p where p.insumo_id=v.insumo_id and p.source_system='erp_intelisis' and p.source_record_id=v.rec and p.source_price=v.precio)
returning id, insumo_id, precio, estado;

-- Alias genéricos: comparten registro ERP con su variante; el hash de provenance es único por (sistema, documento, registro, precio…),
-- por eso llevan documento con sufijo "alias genérico de …".
insert into public.insumo_precios
 (insumo_id, precio, contract_status, source_system, source_document, source_record_id, source_price, source_currency, source_unit, source_units_per_cost_unit, cost_unit, vigente_desde, estado, confidence, evidence_status, evidencia, fuente, creado_por, requiere_validacion_compras)
select v.insumo_id, 0, 'DATA_TRUTH_V1', 'erp_intelisis', 'ERP Intelisis · Costos de Materia Prima Ultima Compra al 10082026.xlsx (Drive, Compras) · alias genérico de '||v.alias, v.rec, v.precio, 'MXN', v.src_unit, 1, v.cost_unit, v.fecha::date, 'propuesto', 'alta', 'documentada', v.evid, 'Compras · ERP Intelisis última compra (corte 2026-08-10)', 'a11-erp-2026-10-12', false
from (values
('melamina-28','melamina-28-walnut',1335.6,'hoja','hoja','2026-08-07','MVLMAG01280800|B709','ERP última compra 2026-08-07 · AME2848 ACABADO MADERA WALNUT · el insumo genérico melamina-28 (cubierta APP LT) está definido con el precio Walnut B709 desde el código'),
('pintura-polvo','pintura-polvo-basic-white',115.949073,'kg','kg','2026-08-04','MVLQPP00000000|A101','ERP última compra 2026-08-04 · PPH COLOR METAL BASIC WHITE · el insumo genérico pintura-polvo ES A101 basic white según su nombre; la fila 96 (6.69 = USD guardado como MXN) se cerró el 2026-10-11')
) as v(insumo_id, alias, precio, src_unit, cost_unit, fecha, rec, evid)
where not exists (select 1 from public.insumo_precios p where p.insumo_id=v.insumo_id and p.source_system='erp_intelisis' and p.source_record_id=v.rec);

-- VH-082 caja-byrne
insert into public.insumo_precios (insumo_id, precio, unidad_compra, precio_compra, factor_conversion, fuente, evidencia, vigente_desde, estado, creado_por, confidence, evidence_status, requiere_validacion_compras, contract_status)
values ('caja-byrne', 2894.11, 'pza', 2894.11, 1, 'Compras, lista del 2026-08-14 (167 USD) × TC 17.33 implícito en compra ERP A101 2026-08-04',
 'VH-082: la fila 136 guardaba 167 USD como si fueran MXN (cerrada 2026-10-11). 167 USD × 17.33 = 2,894.11 MXN estimado. Sin código ERP ni factura: Compras debe confirmar precio y moneda antes de certificar.',
 date '2026-10-12', 'propuesto', 'a11-erp-2026-10-12', 'baja', 'referenciada', true, 'LEGACY_UNMIGRATED');

-- Aprobación (una llamada por fila `propuesto` del lote, con JWT de rol dirección; el service role NO puede):
--   select aprobar_precio(<id>, 'A11 certificación con documento ERP Intelisis última compra 2026-08-10');
