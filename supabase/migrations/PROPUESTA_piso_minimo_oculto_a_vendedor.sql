-- ============================================================================
--  piso_minimo OCULTO AL VENDEDOR (cierra el hallazgo de certificación 2026-10-29).
--  APLICADA en producción (mtuvnbgljwbsaizjjgzs) el 2026-10-29 por instrucción de Dirección
--  ("sí a todo en prod"). Verificada en vivo (abajo).
--
--  Problema: la política RLS de SELECT de lista_precio_items es USING(true) para el rol
--  `authenticated`, y el grant era a nivel tabla, así que un vendedor con su token podía leer
--  `piso_minimo` (el piso interno) de TODOS los SKUs vía API directa
--  (/rest/v1/lista_precio_items?select=piso_minimo). La app nunca lo muestra (ProductoMaestro y
--  cocrearReferencias piden listas explícitas con precio_lista, nunca piso_minimo ni select *),
--  pero la fuga por API existía. El costo crudo (producto_version_economia) ya estaba protegido.
--
--  Fix: revocar SELECT de tabla y re-otorgar SELECT por COLUMNA en todas menos piso_minimo.
--  Las escrituras (INSERT/UPDATE/DELETE) quedan intactas y siguen gateadas por RLS
--  (puede_ver_economia()), así que Compras/Dirección siguen gestionando el piso por los
--  caminos server-side (edges / SECURITY DEFINER). Los edges usan service_role (no les afecta).
--
--  Verificado en prod tras aplicar:
--   - column_privileges: piso_minimo ya NO tiene SELECT para authenticated; precio_lista sí.
--   - set role authenticated + consulta exacta del cliente (precio_lista, ...) ⇒ devuelve fila.
--   - set role authenticated + select piso_minimo ⇒ ERROR 42501 permission denied (correcto).
--
--  REVERSIBLE: grant select on public.lista_precio_items to authenticated;
-- ============================================================================
begin;
revoke select on public.lista_precio_items from authenticated;
grant select (id, lista_precio_id, producto_id, producto_version_id, variante_id, precio_lista, moneda, vigencia_desde, vigencia_hasta, creado, provenance)
  on public.lista_precio_items to authenticated;
commit;

-- ROLLBACK:
-- begin; grant select on public.lista_precio_items to authenticated; commit;
