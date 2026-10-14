-- Holdout v4 · modelos de IA que resolvió la corrida (SOLO LECTURA). Sustituir :requests por el arreglo de request_id que
-- escribió la corrida (ia_requests.json, unión de todas las hojas). Ya no por ventana de tiempo: por request.
-- Salida → modelos_<fecha>.json (arreglo de {fn, modo, model_id, request_id}) para `congelar_holdout.mjs --verificar
-- --modelos <archivo> --requests <ia_requests.json>`.
select coalesce(json_agg(json_build_object('fn', fn, 'modo', modo, 'model_id', model_id, 'request_id', request_id)
                         order by request_id), '[]'::json) as modelos
from public.ai_eventos
where fn = 'analizar-mueble-rc' and request_id = any(:'requests'::text[]);
