-- Holdout v3 · modelos de IA que resolvió la corrida (SOLO LECTURA). Sustituir :desde/:hasta por la ventana de la corrida.
-- Salida → modelos_<fecha>.json (arreglo de {fn, modo, model_id}) para `congelar_holdout.mjs --verificar --modelos`.
select coalesce(json_agg(json_build_object('fn', fn, 'modo', modo, 'model_id', model_id) order by fn, modo, model_id), '[]'::json) as modelos
from (select distinct fn, modo, model_id from public.ai_eventos
       where fn = 'analizar-mueble-rc' and created_at between :'desde'::timestamptz and :'hasta'::timestamptz) x;
