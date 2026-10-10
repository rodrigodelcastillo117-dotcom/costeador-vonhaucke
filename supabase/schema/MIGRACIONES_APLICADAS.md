# Migraciones aplicadas en producción (`mtuvnbgljwbsaizjjgzs`) · leídas el 2026-10-10

203 versiones. Las 70 `app_temp_write_open*/close*` del 12–19 de agosto son aperturas y
cierres temporales de escritura para publicar la app por Storage (ver `deploy.sh`): no
cambian el modelo pero sí cuentan como historia.

Nota: `p0_quote_learning_enforcement_20261010`, `quote_creation_idempotency_20261010` y
`harden_invoker_trigger_paths_20261010` se aplicaron el mismo 2026-10-10, antes de este
snapshot, fuera de este repo. Hay que recuperar su SQL y meterlo a `supabase/migrations/`.

| Versión | Nombre |
|---|---|
