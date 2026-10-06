-- STAGED ONLY — compactación de lectura legacy de cotizaciones.
-- No modifica filas almacenadas. El objetivo es que abrir una cotización vieja no
-- descargue 2–12 MB de base64 enterrado en partidas/acomodo.
--
-- Hallazgo live 2026-10-05:
--   cotizacion 125: acomodo ~12.05 MB; acomodo.escenas[1..5].img = 2.0–2.6 MB c/u.
--   cotizacion 16: partidas ~9.99 MB.
--
-- Al promover: smoke de identidad/precio/cantidad + seller-safe + tamaño de respuesta.

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
  acomodo_compacto jsonb;
  escenas_compactas jsonb;
begin
  v_email := auth.jwt()->>'email';
  select * into c from cotizaciones where id=p_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if not (c.usuario = v_email or puede_editar_config()) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_acceso');
  end if;

  -- Partidas legacy: poda render inline gigante.
  select coalesce(jsonb_agg(
    case
      when jsonb_typeof(e.value)='object'
       and jsonb_typeof(e.value->'render')='string'
       and length(e.value->>'render') > 100000
      then (e.value - 'render') || jsonb_build_object('render_legacy_podado', true)
      else e.value
    end order by e.ord
  ), '[]'::jsonb)
  into partidas_compactas
  from jsonb_array_elements(case when jsonb_typeof(c.partidas)='array' then c.partidas else '[]'::jsonb end)
       with ordinality e(value, ord);

  -- Acomodo legacy: las escenas pueden tener capturas/render base64 multi-MB.
  acomodo_compacto := c.acomodo;
  if jsonb_typeof(c.acomodo)='object' and jsonb_typeof(c.acomodo->'escenas')='array' then
    select coalesce(jsonb_agg(
      case
        when jsonb_typeof(e.value)='object'
         and jsonb_typeof(e.value->'img')='string'
         and length(e.value->>'img') > 100000
        then (e.value - 'img') || jsonb_build_object('img_legacy_podada', true)
        else e.value
      end order by e.ord
    ), '[]'::jsonb)
    into escenas_compactas
    from jsonb_array_elements(c.acomodo->'escenas') with ordinality e(value, ord);
    acomodo_compacto := jsonb_set(c.acomodo, '{escenas}', escenas_compactas, true);
  end if;

  payload := jsonb_build_object(
    'ok', true, 'id', c.id, 'folio', c.folio, 'folio_oficial', c.folio_oficial, 'cliente', c.cliente,
    'estado', c.estado, 'total', c.total, 'piezas', c.piezas, 'activa', c.activa,
    'cliente_id', c.cliente_id, 'contacto_id', c.contacto_id, 'proyecto_id', c.proyecto_id,
    'partidas', partidas_compactas, 'totales', c.totales, 'acomodo', acomodo_compacto, 'creado', c.creado
  );
  if puede_ver_economia() then return payload; end if;
  return public.jsonb_sin_economia(payload);
end $$;

-- Required promotion checks:
-- 1) row 125 response acomodo is KB, not ~12 MB; escenas retain nombre/m2 but no giant img.
-- 2) row 16 response partidas retains functional fields and prunes giant render.
-- 3) modern quote result is functionally identical.
-- 4) seller still receives zero internal-economy keys.
