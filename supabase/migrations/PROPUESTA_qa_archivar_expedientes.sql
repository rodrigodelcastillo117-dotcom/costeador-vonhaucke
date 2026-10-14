-- ============================================================================
--  PROPUESTA · Operación 9.5 punto 21 · ETIQUETAR (no borrar) los expedientes creados por la cuenta QA.
--  ⚠️ PROPUESTA, NO MIGRACIÓN. No aplicar sin autorización expresa de Dirección.
--
--  Medido 14-oct-2026 (solo lectura): 157 expedientes; 154 creados por qa-direccion@vonhaucke.mx (ids 4–159 salvo 14 y
--  15); 27 de ellos sin "LAB/PRUEBA/QA/TEST" en el nombre. md5(ids separados por coma) = b5c880f6918ea06c112c001c936bbf11.
--  Qué hace: agrega la etiqueta 'qa-archivado' a EXACTAMENTE esos 154 ids. No toca nombre, BOM, costo, revisiones ni
--  renders; no borra nada. La biblioteca ya oculta por omisión lo etiquetado (src/datos/expedientesPrueba.js).
--  Aborta si: algún id del manifest no existe, no es de una cuenta qa-*, o la huella del manifest no coincide.
--  Idempotente (no duplica la etiqueta). Rollback: quitar la etiqueta a esos mismos ids.
-- ============================================================================
begin;
do $$
declare
  v_manifest bigint[] := '{4,5,6,7,8,9,10,11,12,13,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159}';
  v_huella text := md5(array_to_string(v_manifest, ','));
  v_vivos int;
begin
  if v_huella <> 'b5c880f6918ea06c112c001c936bbf11' or cardinality(v_manifest) <> 154 then
    raise exception 'manifest alterado (huella %, % ids): abortado', v_huella, cardinality(v_manifest);
  end if;
  select count(*) into v_vivos from public.expedientes where id = any(v_manifest) and creado_por ilike 'qa-%';
  if v_vivos <> 154 then
    raise exception 'sólo % de 154 ids del manifest existen y son de QA: abortado sin cambios', v_vivos;
  end if;
  update public.expedientes
     set etiquetas = array_append(etiquetas, 'qa-archivado')
   where id = any(v_manifest) and not ('qa-archivado' = any(etiquetas));
end $$;
commit;

-- ROLLBACK:
-- RB update public.expedientes set etiquetas = array_remove(etiquetas, 'qa-archivado') where id = any('{4,5,6,7,8,9,10,11,12,13,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159}'::bigint[]);
