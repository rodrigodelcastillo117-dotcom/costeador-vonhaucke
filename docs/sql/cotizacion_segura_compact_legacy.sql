-- STAGED ONLY — compactación de lectura legacy de cotizaciones.
-- No modifica la fila almacenada. Evita enviar renders base64 gigantes enterrados
-- en partidas al reabrir una cotización antigua.
--
-- Verificado 2026-10-05: el único key >100k chars encontrado en partidas legacy
-- es "render" (8 strings; máximo ~1.73M chars).

create or replace function private_api.cotizacion_segura(p_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  c record;
  v_email text;
  payload jsonb;
  partidas_compactas jsonb;
begin
  v_email := auth.jwt()->>'email';
  select * into c from cotizaciones where id=p_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if not (c.usuario = v_email or puede_editar_config()) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_acceso');
  end if;

  select coalesce(jsonb_agg(
    case
      when jsonb_typeof(e.value)='object'
       and jsonb_typeof(e.value->'render')='string'
       and length(e.value->>'render') > 100000
      then (e.value - 'render') || jsonb_build_object('render_legacy_podado', true)
      else e.value
    end
    order by e.ord
  ), '[]'::jsonb)
  into partidas_compactas
  from jsonb_array_elements(case when jsonb_typeof(c.partidas)='array' then c.partidas else '[]'::jsonb end)
       with ordinality e(value, ord);

  payload := jsonb_build_object(
    'ok', true, 'id', c.id, 'folio', c.folio, 'folio_oficial', c.folio_oficial, 'cliente', c.cliente,
    'estado', c.estado, 'total', c.total, 'piezas', c.piezas, 'activa', c.activa,
    'cliente_id', c.cliente_id, 'contacto_id', c.contacto_id, 'proyecto_id', c.proyecto_id,
    'partidas', partidas_compactas, 'totales', c.totales, 'acomodo', c.acomodo, 'creado', c.creado
  );
  if puede_ver_economia() then return payload; end if;
  return public.jsonb_sin_economia(payload);
end $$;

-- Smoke previo a promoción:
-- 1) misma cantidad/identidad/precio de partidas;
-- 2) render legacy >100k desaparece de la respuesta, no de la tabla;
-- 3) cotización moderna sin render inline queda byte-for-byte equivalente en datos funcionales;
-- 4) vendedor sigue pasando por jsonb_sin_economia().
