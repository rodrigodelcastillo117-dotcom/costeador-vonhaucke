-- Safe P1 quote retry idempotency. No updates to legacy quotes.
BEGIN;
CREATE TABLE IF NOT EXISTS private_api.cotizacion_idempotencia (
  actor_email text NOT NULL,
  request_key text NOT NULL,
  cotizacion_id bigint NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  payload_hash text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_email,request_key)
);
REVOKE ALL ON TABLE private_api.cotizacion_idempotencia FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private_api.crear_cotizacion_segura(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := auth.jwt()->>'email';
  v_role text;
  v_owner text;
  v_id bigint;
  v_partidas jsonb := coalesce(p_payload->'partidas','[]'::jsonb);
  v_acomodo jsonb := p_payload->'acomodo';
  v_totales jsonb := p_payload->'totales';
  v_total numeric := 0;
  v_piezas integer := 0;
  v_activa boolean := true;
  v_cliente_id bigint;
  v_contacto_id bigint;
  v_proyecto_id bigint;
  v_idempotency_key text := nullif(btrim(coalesce(p_payload->>'_idempotency_key','')), '');
  v_payload_hash text;
  v_prev_quote_id bigint;
  v_prev_payload_hash text;
begin
  if v_email is null or not public.puede_entrar() then
    raise exception 'no autorizado';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload invalido';
  end if;

  select lower(p.rol) into v_role
  from public.permitidos p
  where lower(p.email)=lower(v_email)
  limit 1;
  if v_role not in ('direccion','diseno','vendedor') then
    raise exception 'rol sin permiso';
  end if;

  if jsonb_typeof(v_partidas) <> 'array' then
    raise exception 'partidas debe ser arreglo';
  end if;
  if v_acomodo is not null and jsonb_typeof(v_acomodo) not in ('array','object') then
    raise exception 'acomodo invalido';
  end if;
  if v_totales is not null and jsonb_typeof(v_totales) <> 'object' then
    raise exception 'totales invalido';
  end if;

  -- El dueño nunca lo decide un vendedor. Diseño/Dirección pueden asignar una cotización
  -- a un usuario permitido; en ausencia de asignación, queda a nombre del caller.
  v_owner := v_email;
  if v_role in ('direccion','diseno') and nullif(trim(p_payload->>'usuario'),'') is not null then
    select p.email into v_owner
    from public.permitidos p
    where lower(p.email)=lower(trim(p_payload->>'usuario'))
    limit 1;
    if v_owner is null then raise exception 'usuario propietario invalido'; end if;
  end if;

  begin v_total := coalesce(nullif(p_payload->>'total','')::numeric,0); exception when others then raise exception 'total invalido'; end;
  begin v_piezas := coalesce(nullif(p_payload->>'piezas','')::integer,0); exception when others then raise exception 'piezas invalido'; end;
  begin if p_payload ? 'activa' then v_activa := (p_payload->>'activa')::boolean; end if; exception when others then raise exception 'activa invalida'; end;
  begin if nullif(p_payload->>'cliente_id','') is not null then v_cliente_id := (p_payload->>'cliente_id')::bigint; end if; exception when others then raise exception 'cliente_id invalido'; end;
  begin if nullif(p_payload->>'contacto_id','') is not null then v_contacto_id := (p_payload->>'contacto_id')::bigint; end if; exception when others then raise exception 'contacto_id invalido'; end;
  begin if nullif(p_payload->>'proyecto_id','') is not null then v_proyecto_id := (p_payload->>'proyecto_id')::bigint; end if; exception when others then raise exception 'proyecto_id invalido'; end;

  if v_total < 0 then raise exception 'total no puede ser negativo'; end if;
  if v_piezas < 0 then raise exception 'piezas no puede ser negativo'; end if;
  -- Estado emitido/folio oficial sólo se obtienen por la compuerta de emisión.
  if p_payload ? 'estado' and lower(coalesce(p_payload->>'estado','borrador')) <> 'borrador' then
    raise exception 'estado protegido; use el flujo de emision';
  end if;
  if nullif(p_payload->>'folio_oficial','') is not null then
    raise exception 'folio_oficial protegido; use el flujo de emision';
  end if;

  -- Serialize retries of the SAME create operation, never dedupe by content.
  IF v_idempotency_key IS NOT NULL THEN
    IF length(v_idempotency_key)<10 OR length(v_idempotency_key)>100
       OR v_idempotency_key !~ '^[a-zA-Z0-9_-]+$' THEN
      RAISE EXCEPTION 'idempotency key invalid';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(lower(v_email)),hashtext(v_idempotency_key));
    v_payload_hash := md5((p_payload - '_idempotency_key')::text);
    SELECT i.cotizacion_id, i.payload_hash INTO v_prev_quote_id,v_prev_payload_hash
      FROM private_api.cotizacion_idempotencia i
      WHERE i.actor_email=lower(v_email) AND i.request_key=v_idempotency_key;
    IF FOUND THEN
      IF v_prev_payload_hash IS DISTINCT FROM v_payload_hash THEN
        RAISE EXCEPTION 'idempotency key reused with different payload';
      END IF;
      RETURN public.cotizacion_segura(v_prev_quote_id);
    END IF;
  END IF;

  insert into public.cotizaciones(
    usuario,cliente,folio,estado,partidas,acomodo,totales,total,piezas,
    huella_mp,activa,cliente_id,contacto_id,proyecto_id
  ) values (
    v_owner,
    nullif(p_payload->>'cliente',''),
    nullif(p_payload->>'folio',''),
    'borrador',
    v_partidas,
    v_acomodo,
    v_totales,
    v_total,
    v_piezas,
    nullif(p_payload->>'huella_mp',''),
    v_activa,
    v_cliente_id,
    v_contacto_id,
    v_proyecto_id
  ) returning id into v_id;

  IF v_idempotency_key IS NOT NULL THEN
    INSERT INTO private_api.cotizacion_idempotencia
      (actor_email,request_key,cotizacion_id,payload_hash)
    VALUES (lower(v_email),v_idempotency_key,v_id,v_payload_hash);
  END IF;

  return public.cotizacion_segura(v_id);
end;
$function$

COMMIT;