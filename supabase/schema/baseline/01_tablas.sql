-- ============================================================================
-- Snapshot de SÓLO LECTURA de mtuvnbgljwbsaizjjgzs, 2026-10-10.
-- Generado con SELECTs sobre pg_catalog. NO es una migración: no aplicar.
-- Regenerar al cierre de cada bloque.
-- Archivo: 01_tablas.sql
-- Contenido: CREATE TABLE reconstruidos desde pg_attribute/pg_attrdef (tipo via format_type, NOT NULL, DEFAULT, IDENTITY), constraints desde pg_constraint (pg_get_constraintdef), índices desde pg_indexes, comentarios (obj_description/col_description). Esquema public.
-- ============================================================================

-- ===== 1. TABLAS (columnas + PK / UNIQUE / CHECK / EXCLUDE) =====

-- ---------- TABLA: public.ai_eventos ----------
CREATE TABLE public.ai_eventos (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  request_id uuid NOT NULL,
  fn text NOT NULL,
  email text,
  rol text,
  modo text,
  images_count integer DEFAULT 0,
  payload_bytes bigint DEFAULT 0,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  duration_ms integer,
  status text,
  http_status integer,
  model_status text,
  attempts integer DEFAULT 1,
  error_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  model_id text,
  effort text,
  max_tokens integer,
  user_input_chars integer,
  catalog_count integer,
  catalog_chars integer,
  input_tokens integer,
  output_tokens integer,
  provider_http_status integer,
  provider_duration_ms integer,
  provider_headers_ms integer,
  provider_body_ms integer,
  fallback_used boolean,
  CONSTRAINT ai_eventos_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.aprendizajes ----------
CREATE TABLE public.aprendizajes (
  id bigint NOT NULL DEFAULT nextval('aprendizajes_id_seq'::regclass),
  creado timestamp with time zone NOT NULL DEFAULT now(),
  usuario text,
  tipo text NOT NULL,
  pedido text,
  propuso jsonb,
  quedo jsonb,
  texto text NOT NULL,
  veces integer NOT NULL DEFAULT 1,
  activo boolean NOT NULL DEFAULT true,
  regla_clave text,
  aprobado_para_ia boolean NOT NULL DEFAULT false,
  CONSTRAINT aprendizajes_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.aprobaciones ----------
CREATE TABLE public.aprobaciones (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  cotizacion_id bigint,
  revision_hash text,
  estado text NOT NULL DEFAULT 'PENDIENTE'::text,
  descuento_solicitado numeric,
  motivo text,
  solicitado_por text DEFAULT (auth.jwt() ->> 'email'::text),
  resuelto_por text,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  resuelto_en timestamp with time zone,
  reglas_version integer,
  CONSTRAINT aprobaciones_pkey PRIMARY KEY (id),
  CONSTRAINT aprobaciones_estado_check CHECK (estado = ANY (ARRAY['PENDIENTE'::text, 'APROBADA'::text, 'RECHAZADA'::text, 'CONTRAOFERTA'::text]))
);

-- ---------- TABLA: public.auth_recovery_once ----------
CREATE TABLE public.auth_recovery_once (
  token_hash text NOT NULL,
  user_id uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT auth_recovery_once_pkey PRIMARY KEY (token_hash)
);

-- ---------- TABLA: public.clientes ----------
CREATE TABLE public.clientes (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  nombre_comercial text NOT NULL,
  razon_social text,
  rfc text,
  industria text,
  direccion text,
  notas text,
  activo boolean NOT NULL DEFAULT true,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  actualizado timestamp with time zone NOT NULL DEFAULT now(),
  creado_por text,
  actualizado_por text,
  CONSTRAINT clientes_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.config ----------
CREATE TABLE public.config (
  id text NOT NULL DEFAULT 'vonhaucke'::text,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  actualizado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT config_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.confirmaciones ----------
CREATE TABLE public.confirmaciones (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  confirmado_por text,
  producto text,
  pregunta text,
  respuesta text,
  valor_anterior text,
  afecta text,
  impacto text,
  CONSTRAINT confirmaciones_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.contactos ----------
CREATE TABLE public.contactos (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  cliente_id bigint NOT NULL,
  nombre text NOT NULL,
  puesto text,
  email text,
  telefono text,
  activo boolean NOT NULL DEFAULT true,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  actualizado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contactos_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.cotizaciones ----------
CREATE TABLE public.cotizaciones (
  id bigint NOT NULL DEFAULT nextval('cotizaciones_id_seq'::regclass),
  creado timestamp with time zone NOT NULL DEFAULT now(),
  actualizado timestamp with time zone NOT NULL DEFAULT now(),
  usuario text,
  cliente text,
  folio text,
  estado text NOT NULL DEFAULT 'borrador'::text,
  partidas jsonb NOT NULL DEFAULT '[]'::jsonb,
  acomodo jsonb,
  totales jsonb,
  total numeric NOT NULL DEFAULT 0,
  piezas integer NOT NULL DEFAULT 0,
  huella_mp text,
  activa boolean NOT NULL DEFAULT true,
  folio_oficial text,
  cliente_id bigint,
  contacto_id bigint,
  proyecto_id bigint,
  CONSTRAINT cotizaciones_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.cotizaciones_backup_20261002 ----------
CREATE TABLE public.cotizaciones_backup_20261002 (
  id bigint NOT NULL,
  creado timestamp with time zone,
  actualizado timestamp with time zone,
  usuario text,
  cliente text,
  folio text,
  estado text,
  partidas jsonb,
  acomodo jsonb,
  totales jsonb,
  total numeric,
  piezas integer,
  huella_mp text,
  activa boolean,
  CONSTRAINT cotizaciones_backup_20261002_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.cotizaciones_revisiones ----------
CREATE TABLE public.cotizaciones_revisiones (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  cotizacion_id bigint,
  folio text,
  cliente text,
  revision integer NOT NULL,
  emitida_en timestamp with time zone NOT NULL DEFAULT now(),
  usuario text,
  total numeric,
  hash text NOT NULL,
  snapshot jsonb NOT NULL,
  tipo text NOT NULL DEFAULT 'generado'::text,
  CONSTRAINT cotizaciones_revisiones_pkey PRIMARY KEY (id),
  CONSTRAINT uq_revision_por_cotizacion UNIQUE (cotizacion_id, revision)
);

-- ---------- TABLA: public.cotizaciones_revisiones_backup_20261002 ----------
CREATE TABLE public.cotizaciones_revisiones_backup_20261002 (
  id bigint NOT NULL,
  cotizacion_id bigint,
  folio text,
  cliente text,
  revision integer,
  emitida_en timestamp with time zone,
  usuario text,
  total numeric,
  hash text,
  snapshot jsonb,
  tipo text,
  CONSTRAINT cotizaciones_revisiones_backup_20261002_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.direccion ----------
CREATE TABLE public.direccion (
  id integer NOT NULL DEFAULT 1,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  actualizado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT direccion_pkey PRIMARY KEY (id),
  CONSTRAINT direccion_una_fila CHECK (id = 1)
);

-- ---------- TABLA: public.escenarios ----------
CREATE TABLE public.escenarios (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  proyecto_id bigint,
  cotizacion_id bigint,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'custom'::text,
  total numeric,
  seleccionado boolean NOT NULL DEFAULT false,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  creado_por text DEFAULT (auth.jwt() ->> 'email'::text),
  CONSTRAINT escenarios_pkey PRIMARY KEY (id),
  CONSTRAINT escenarios_tipo_check CHECK (tipo = ANY (ARRAY['esencial'::text, 'recomendada'::text, 'premium'::text, 'custom'::text]))
);

-- ---------- TABLA: public.expediente_revisiones ----------
CREATE TABLE public.expediente_revisiones (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  expediente_id bigint NOT NULL,
  rev integer NOT NULL,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  creado_por text,
  nombre text,
  bom jsonb,
  costo jsonb,
  confirmaciones jsonb,
  materiales text[],
  plano_urls text[],
  render_aislado_url text,
  render_ambiente_url text,
  analysis_hash text,
  cocrear jsonb,
  producto_id bigint,
  producto_version_id bigint,
  CONSTRAINT expediente_revisiones_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.expedientes ----------
CREATE TABLE public.expedientes (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  actualizado timestamp with time zone NOT NULL DEFAULT now(),
  creado_por text,
  actualizado_por text,
  nombre text NOT NULL,
  etiquetas text[] NOT NULL DEFAULT '{}'::text[],
  estado text NOT NULL DEFAULT 'borrador'::text,
  producto_tipo text,
  ancho_mm numeric,
  fondo_mm numeric,
  alto_mm numeric,
  descripcion text,
  materiales text[] NOT NULL DEFAULT '{}'::text[],
  bom jsonb,
  costo jsonb,
  confirmaciones jsonb,
  plano_urls text[] NOT NULL DEFAULT '{}'::text[],
  render_aislado_url text,
  render_ambiente_url text,
  analysis_hash text,
  revision integer NOT NULL DEFAULT 1,
  cocrear jsonb,
  producto_id bigint,
  producto_version_id bigint,
  CONSTRAINT expedientes_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.insumo_mapeos_externos ----------
CREATE TABLE public.insumo_mapeos_externos (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  source_system text NOT NULL,
  external_key text NOT NULL,
  external_option text NOT NULL DEFAULT ''::text,
  insumo_id text NOT NULL,
  identity_status text NOT NULL,
  confidence text NOT NULL,
  evidencia text,
  estado text NOT NULL DEFAULT 'propuesto'::text,
  vigente_desde date NOT NULL,
  vigente_hasta date,
  approved_by text,
  approved_at timestamp with time zone,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  source_document text,
  source_sheet text,
  source_record_id text,
  source_cell text,
  source_hash text,
  CONSTRAINT insumo_mapeos_externos_pkey PRIMARY KEY (id),
  CONSTRAINT no_overlap_mapeo_aprobado EXCLUDE USING gist (source_system WITH =, external_key WITH =, external_option WITH =, daterange(vigente_desde, vigente_hasta, '[)'::text) WITH &&) WHERE (estado = 'aprobado'::text),
  CONSTRAINT insumo_mapeos_externos_estado_check CHECK (estado = ANY (ARRAY['propuesto'::text, 'aprobado'::text, 'retirado'::text])),
  CONSTRAINT insumo_mapeos_externos_identity_status_check CHECK (identity_status = ANY (ARRAY['EXACT_KEY'::text, 'EXACT_ATTRIBUTES'::text, 'EXACT_WITH_CONVERSION'::text]))
);

-- ---------- TABLA: public.insumo_precios ----------
CREATE TABLE public.insumo_precios (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  insumo_id text NOT NULL,
  precio numeric NOT NULL,
  unidad_compra text,
  precio_compra numeric,
  factor_conversion numeric,
  propiedades jsonb,
  proveedor text,
  fuente text,
  evidencia text,
  vigente_desde date,
  vigente_hasta date,
  estado text NOT NULL DEFAULT 'propuesto'::text,
  creado_por text,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  confidence text,
  evidence_status text,
  approved_by text,
  approved_at timestamp with time zone,
  requiere_validacion_compras boolean NOT NULL DEFAULT false,
  contract_status text NOT NULL DEFAULT 'LEGACY_UNMIGRATED'::text,
  source_price numeric,
  source_currency text,
  source_unit text,
  source_units_per_cost_unit numeric,
  fx_rate numeric,
  fx_date date,
  fx_source text,
  cost_unit text,
  source_system text,
  source_document text,
  source_record_id text,
  source_hash text,
  cost_unit_price_mxn numeric GENERATED ALWAYS AS (((source_price * COALESCE(fx_rate, (1)::numeric)) * COALESCE(source_units_per_cost_unit, (1)::numeric))) STORED,
  CONSTRAINT insumo_precios_pkey PRIMARY KEY (id),
  CONSTRAINT chk_precios_contract_status CHECK (contract_status = ANY (ARRAY['LEGACY_UNMIGRATED'::text, 'DATA_TRUTH_V1'::text])),
  CONSTRAINT chk_precios_contrato_v1 CHECK (contract_status = 'LEGACY_UNMIGRATED'::text OR source_price IS NOT NULL AND source_currency IS NOT NULL AND (source_currency = 'MXN'::text OR fx_rate IS NOT NULL AND fx_date IS NOT NULL AND fx_source IS NOT NULL)),
  CONSTRAINT chk_precios_datatruth_contract CHECK (contract_status <> 'DATA_TRUTH_V1'::text OR source_price IS NOT NULL AND source_price > 0::numeric AND source_currency IS NOT NULL AND btrim(source_currency) <> ''::text AND source_unit IS NOT NULL AND btrim(source_unit) <> ''::text AND source_units_per_cost_unit IS NOT NULL AND source_units_per_cost_unit > 0::numeric AND cost_unit IS NOT NULL AND btrim(cost_unit) <> ''::text AND source_system IS NOT NULL AND btrim(source_system) <> ''::text AND source_document IS NOT NULL AND btrim(source_document) <> ''::text AND source_record_id IS NOT NULL AND btrim(source_record_id) <> ''::text AND source_hash IS NOT NULL AND btrim(source_hash) <> ''::text AND vigente_desde IS NOT NULL AND (source_currency = 'MXN'::text OR fx_rate IS NOT NULL AND fx_rate > 0::numeric AND fx_date IS NOT NULL AND fx_source IS NOT NULL AND btrim(fx_source) <> ''::text)),
  CONSTRAINT insumo_precios_aprobado_integridad_chk CHECK (estado <> 'aprobado'::text OR precio > 0::numeric AND unidad_compra IS NOT NULL AND btrim(unidad_compra) <> ''::text AND precio_compra IS NOT NULL AND precio_compra > 0::numeric AND factor_conversion IS NOT NULL AND factor_conversion > 0::numeric AND evidence_status IS NOT NULL AND evidence_status <> 'sin_evidencia'::text AND confidence IS NOT NULL AND confidence <> 'baja'::text AND approved_by IS NOT NULL AND btrim(approved_by) <> ''::text AND approved_at IS NOT NULL AND requiere_validacion_compras = false),
  CONSTRAINT insumo_precios_confidence_chk CHECK (confidence IS NULL OR (confidence = ANY (ARRAY['alta'::text, 'media'::text, 'baja'::text]))),
  CONSTRAINT insumo_precios_estado_chk CHECK (estado = ANY (ARRAY['propuesto'::text, 'propuesto_validado'::text, 'aprobado'::text, 'sustituido'::text])),
  CONSTRAINT insumo_precios_evidence_chk CHECK (evidence_status IS NULL OR (evidence_status = ANY (ARRAY['documentada'::text, 'referenciada'::text, 'concordante'::text, 'sin_evidencia'::text])))
);

-- ---------- TABLA: public.insumos_catalogo ----------
CREATE TABLE public.insumos_catalogo (
  id text NOT NULL,
  nombre text NOT NULL,
  seccion text,
  unidad_costeo text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  clasificacion text NOT NULL DEFAULT 'vigente'::text,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  familia text,
  espesor_mm numeric,
  calibre integer,
  formato text,
  material text,
  atributos jsonb,
  CONSTRAINT insumos_catalogo_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.lista_precio_items ----------
CREATE TABLE public.lista_precio_items (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  lista_precio_id bigint NOT NULL,
  producto_id bigint NOT NULL,
  producto_version_id bigint,
  variante_id bigint,
  precio_lista numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'MXN'::text,
  vigencia_desde date,
  vigencia_hasta date,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  piso_minimo numeric,
  provenance text,
  CONSTRAINT lista_precio_items_pkey PRIMARY KEY (id),
  CONSTRAINT lista_precio_items_precio_lista_check CHECK (precio_lista >= 0::numeric)
);

-- ---------- TABLA: public.listas_precio ----------
CREATE TABLE public.listas_precio (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  moneda text NOT NULL DEFAULT 'MXN'::text,
  vigencia_desde date,
  vigencia_hasta date,
  estado text NOT NULL DEFAULT 'draft'::text,
  aprobado_por text,
  aprobado_en timestamp with time zone,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  fuente text,
  approval_type text,
  CONSTRAINT listas_precio_pkey PRIMARY KEY (id),
  CONSTRAINT listas_precio_estado_check CHECK (estado = ANY (ARRAY['draft'::text, 'approved'::text, 'retired'::text]))
);

-- ---------- TABLA: public.permitidos ----------
CREATE TABLE public.permitidos (
  email text NOT NULL,
  nombre text,
  rol text NOT NULL DEFAULT 'vendedor'::text,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT permitidos_pkey PRIMARY KEY (email)
);

-- ---------- TABLA: public.producto_version_economia ----------
CREATE TABLE public.producto_version_economia (
  producto_version_id bigint NOT NULL,
  costo_oficial_referencia numeric,
  formula_version text,
  fuente text,
  actualizado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT producto_version_economia_pkey PRIMARY KEY (producto_version_id)
);

-- ---------- TABLA: public.producto_versiones ----------
CREATE TABLE public.producto_versiones (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  producto_id bigint NOT NULL,
  etiqueta text,
  dimensiones jsonb,
  acabados_permitidos jsonb,
  atributos jsonb,
  expediente_id bigint,
  bom_hash text,
  estado_tecnico text NOT NULL DEFAULT 'preliminar'::text,
  formula_version text,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  expediente_revision_id bigint,
  CONSTRAINT producto_versiones_pkey PRIMARY KEY (id),
  CONSTRAINT producto_versiones_estado_tecnico_check CHECK (estado_tecnico = ANY (ARRAY['preliminar'::text, 'incompleto'::text, 'aprobado'::text, 'certificado'::text]))
);

-- ---------- TABLA: public.productos ----------
CREATE TABLE public.productos (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  codigo text,
  nombre text NOT NULL,
  familia text,
  descripcion_comercial text,
  source_type text NOT NULL,
  source_ref text,
  estado text NOT NULL DEFAULT 'borrador'::text,
  activo boolean NOT NULL DEFAULT false,
  render_principal_url text,
  ficha_tecnica jsonb,
  version_tecnica_vigente_id bigint,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  actualizado timestamp with time zone NOT NULL DEFAULT now(),
  creado_por text,
  legacy_meta jsonb,
  CONSTRAINT productos_pkey PRIMARY KEY (id),
  CONSTRAINT productos_estado_check CHECK (estado = ANY (ARRAY['borrador'::text, 'activo'::text, 'retirado'::text])),
  CONSTRAINT productos_source_type_check CHECK (source_type = ANY (ARRAY['linea'::text, 'banco'::text, 'expediente'::text]))
);

-- ---------- TABLA: public.proyecto_actividades ----------
CREATE TABLE public.proyecto_actividades (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  proyecto_id bigint NOT NULL,
  tipo text NOT NULL,
  descripcion text,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  creado_por text,
  metadata jsonb,
  CONSTRAINT proyecto_actividades_pkey PRIMARY KEY (id),
  CONSTRAINT proyecto_actividades_tipo_check CHECK (tipo = ANY (ARRAY['NOTA'::text, 'LLAMADA'::text, 'REUNION'::text, 'EMAIL'::text, 'CAMBIO_ETAPA'::text, 'PROXIMA_ACCION'::text, 'COTIZACION'::text, 'PROPUESTA'::text]))
);

-- ---------- TABLA: public.proyectos ----------
CREATE TABLE public.proyectos (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  cliente_id bigint,
  contacto_principal_id bigint,
  vendedor_responsable text NOT NULL,
  ubicacion text,
  brief text,
  presupuesto numeric,
  moneda text NOT NULL DEFAULT 'MXN'::text,
  fecha_objetivo date,
  etapa text NOT NULL DEFAULT 'NUEVO'::text,
  proxima_accion text,
  fecha_proxima_accion date,
  motivo_perdida text,
  competidor text,
  comentario_cierre text,
  fecha_cierre date,
  revision_ganadora_id bigint,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  actualizado timestamp with time zone NOT NULL DEFAULT now(),
  creado_por text,
  total_final numeric,
  CONSTRAINT proyectos_pkey PRIMARY KEY (id),
  CONSTRAINT proyecto_ganada_fecha CHECK (etapa <> 'GANADA'::text OR fecha_cierre IS NOT NULL),
  CONSTRAINT proyecto_perdida_motivo CHECK (etapa <> 'PERDIDA'::text OR motivo_perdida IS NOT NULL),
  CONSTRAINT proyectos_etapa_check CHECK (etapa = ANY (ARRAY['NUEVO'::text, 'LEVANTAMIENTO'::text, 'DISEÑO'::text, 'COTIZANDO'::text, 'APROBACION_INTERNA'::text, 'PROPUESTA_ENVIADA'::text, 'NEGOCIACION'::text, 'GANADA'::text, 'PERDIDA'::text, 'SUSPENDIDA'::text])),
  CONSTRAINT proyectos_motivo_perdida_check CHECK (motivo_perdida IS NULL OR (motivo_perdida = ANY (ARRAY['PRECIO'::text, 'COMPETENCIA'::text, 'PLAZO'::text, 'ESPECIFICACION'::text, 'PRESUPUESTO_CANCELADO'::text, 'PROYECTO_CANCELADO'::text, 'SIN_RESPUESTA'::text, 'OTRO'::text])))
);

-- ---------- TABLA: public.reglas ----------
CREATE TABLE public.reglas (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  ambito text NOT NULL,
  texto text NOT NULL,
  clave text,
  valor numeric,
  unidad text,
  origen text NOT NULL DEFAULT 'rodrigo'::text,
  fuente text,
  activa boolean NOT NULL DEFAULT true,
  creada timestamp with time zone NOT NULL DEFAULT now(),
  actualizada timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reglas_pkey PRIMARY KEY (id),
  CONSTRAINT reglas_ambito_check CHECK (ambito = ANY (ARRAY['acomodo'::text, 'cotizacion'::text, 'precio'::text, 'render'::text, 'plano'::text, 'general'::text])),
  CONSTRAINT reglas_origen_check CHECK (origen = ANY (ARRAY['rodrigo'::text, 'aprendida'::text, 'propuesta'::text]))
);

-- ---------- TABLA: public.reglas_comerciales ----------
CREATE TABLE public.reglas_comerciales (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  version integer NOT NULL,
  descuento_max_sin_aprobacion numeric NOT NULL,
  margen_minimo_pct numeric,
  estado text NOT NULL DEFAULT 'approved'::text,
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  aprobado_por text,
  aprobado_en timestamp with time zone NOT NULL DEFAULT now(),
  fuente text,
  CONSTRAINT reglas_comerciales_pkey PRIMARY KEY (id),
  CONSTRAINT reglas_comerciales_estado_check CHECK (estado = ANY (ARRAY['draft'::text, 'approved'::text, 'retired'::text]))
);

-- ---------- TABLA: public.render_eventos ----------
CREATE TABLE public.render_eventos (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  request_id uuid NOT NULL,
  email text NOT NULL,
  rol text,
  modo text,
  imagenes integer NOT NULL DEFAULT 0,
  bytes bigint NOT NULL DEFAULT 0,
  ok boolean,
  codigo text,
  ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT render_eventos_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.renders ----------
CREATE TABLE public.renders (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  creado_por text,
  producto_nombre text,
  producto_version text,
  prompt_version text,
  categoria text,
  ancho_mm numeric,
  fondo_mm numeric,
  alto_mm numeric,
  modo text,
  storage_path text,
  storage_url text,
  inputs jsonb,
  costo_estado text,
  estado text NOT NULL DEFAULT 'preliminar'::text,
  producto_id bigint,
  producto_version_id bigint,
  expediente_id bigint,
  spec_hash text,
  geometry_hash text,
  geometry_validation text NOT NULL DEFAULT 'NOT_VERIFIED'::text,
  feature_validation text NOT NULL DEFAULT 'NOT_VERIFIED'::text,
  finish_validation text NOT NULL DEFAULT 'NOT_VERIFIED'::text,
  stale boolean NOT NULL DEFAULT false,
  CONSTRAINT renders_pkey PRIMARY KEY (id),
  CONSTRAINT renders_validated_fail_closed_chk CHECK (estado <> 'VALIDATED'::text OR stale = false AND geometry_validation = 'PASS'::text AND feature_validation = 'PASS'::text AND finish_validation = 'PASS'::text)
);

-- ---------- TABLA: public.shadow_costeo ----------
CREATE TABLE public.shadow_costeo (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  rol text,
  input_hash text,
  motor_version text,
  version_catalogo text,
  estado_servidor text,
  http_status integer,
  precio_cliente numeric,
  precio_servidor numeric,
  costo_cliente numeric,
  costo_servidor numeric,
  diff numeric,
  campos_recibidos text[],
  nota text,
  CONSTRAINT shadow_costeo_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.variantes_producto ----------
CREATE TABLE public.variantes_producto (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  producto_version_id bigint NOT NULL,
  codigo text,
  etiqueta text,
  atributos jsonb,
  activa boolean NOT NULL DEFAULT true,
  CONSTRAINT variantes_producto_pkey PRIMARY KEY (id)
);

-- ---------- TABLA: public.voni_council_events ----------
CREATE TABLE public.voni_council_events (
  id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  email text NOT NULL,
  rol text NOT NULL,
  task text NOT NULL,
  providers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  decision text,
  request_hash text,
  latency_ms integer,
  CONSTRAINT voni_council_events_pkey PRIMARY KEY (id)
);

-- ===== 2. FOREIGN KEYS =====
ALTER TABLE public.aprobaciones ADD CONSTRAINT aprobaciones_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id);
ALTER TABLE public.contactos ADD CONSTRAINT contactos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES contactos(id);
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES proyectos(id);
ALTER TABLE public.cotizaciones_revisiones ADD CONSTRAINT cotizaciones_revisiones_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE RESTRICT;
ALTER TABLE public.escenarios ADD CONSTRAINT escenarios_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id);
ALTER TABLE public.escenarios ADD CONSTRAINT escenarios_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES proyectos(id);
ALTER TABLE public.expediente_revisiones ADD CONSTRAINT expediente_revisiones_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE;
ALTER TABLE public.expediente_revisiones ADD CONSTRAINT expediente_revisiones_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public.expediente_revisiones ADD CONSTRAINT expediente_revisiones_producto_version_id_fkey FOREIGN KEY (producto_version_id) REFERENCES producto_versiones(id);
ALTER TABLE public.expedientes ADD CONSTRAINT expedientes_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public.expedientes ADD CONSTRAINT expedientes_producto_version_id_fkey FOREIGN KEY (producto_version_id) REFERENCES producto_versiones(id);
ALTER TABLE public.insumo_mapeos_externos ADD CONSTRAINT insumo_mapeos_externos_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos_catalogo(id);
ALTER TABLE public.insumo_precios ADD CONSTRAINT insumo_precios_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos_catalogo(id) ON DELETE RESTRICT;
ALTER TABLE public.lista_precio_items ADD CONSTRAINT lista_precio_items_lista_precio_id_fkey FOREIGN KEY (lista_precio_id) REFERENCES listas_precio(id) ON DELETE CASCADE;
ALTER TABLE public.lista_precio_items ADD CONSTRAINT lista_precio_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public.lista_precio_items ADD CONSTRAINT lista_precio_items_producto_version_id_fkey FOREIGN KEY (producto_version_id) REFERENCES producto_versiones(id);
ALTER TABLE public.lista_precio_items ADD CONSTRAINT lista_precio_items_variante_id_fkey FOREIGN KEY (variante_id) REFERENCES variantes_producto(id);
ALTER TABLE public.producto_version_economia ADD CONSTRAINT producto_version_economia_producto_version_id_fkey FOREIGN KEY (producto_version_id) REFERENCES producto_versiones(id) ON DELETE CASCADE;
ALTER TABLE public.producto_versiones ADD CONSTRAINT producto_versiones_expediente_revision_id_fkey FOREIGN KEY (expediente_revision_id) REFERENCES expediente_revisiones(id);
ALTER TABLE public.producto_versiones ADD CONSTRAINT producto_versiones_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE;
ALTER TABLE public.productos ADD CONSTRAINT productos_version_vigente_fk FOREIGN KEY (version_tecnica_vigente_id) REFERENCES producto_versiones(id) ON DELETE SET NULL;
ALTER TABLE public.proyecto_actividades ADD CONSTRAINT proyecto_actividades_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE;
ALTER TABLE public.proyectos ADD CONSTRAINT proyectos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE public.proyectos ADD CONSTRAINT proyectos_contacto_principal_id_fkey FOREIGN KEY (contacto_principal_id) REFERENCES contactos(id);
ALTER TABLE public.renders ADD CONSTRAINT renders_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES expedientes(id);
ALTER TABLE public.renders ADD CONSTRAINT renders_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE public.renders ADD CONSTRAINT renders_producto_version_id_fkey FOREIGN KEY (producto_version_id) REFERENCES producto_versiones(id);
ALTER TABLE public.variantes_producto ADD CONSTRAINT variantes_producto_producto_version_id_fkey FOREIGN KEY (producto_version_id) REFERENCES producto_versiones(id) ON DELETE CASCADE;

-- ===== 3. ÍNDICES (los que NO respaldan un constraint; los de PK/UNIQUE/EXCLUDE van implícitos arriba) =====
CREATE INDEX ai_eventos_created_idx ON public.ai_eventos USING btree (created_at DESC);
CREATE INDEX ai_eventos_email_created_idx ON public.ai_eventos USING btree (email, created_at DESC);
CREATE INDEX aprendizajes_recientes ON public.aprendizajes USING btree (activo, creado DESC);
CREATE INDEX idx_aprobaciones_cotizacion_id ON public.aprobaciones USING btree (cotizacion_id);
CREATE INDEX idx_contactos_cliente_id ON public.contactos USING btree (cliente_id);
CREATE UNIQUE INDEX cotizaciones_folio_oficial_uniq ON public.cotizaciones USING btree (folio_oficial) WHERE (folio_oficial IS NOT NULL);
CREATE INDEX cotizaciones_recientes ON public.cotizaciones USING btree (activa, actualizado DESC);
CREATE INDEX cotizaciones_usuario ON public.cotizaciones USING btree (usuario, actualizado DESC);
CREATE INDEX idx_cotizaciones_cliente_id ON public.cotizaciones USING btree (cliente_id);
CREATE INDEX idx_cotizaciones_contacto_id ON public.cotizaciones USING btree (contacto_id);
CREATE INDEX idx_cotizaciones_proyecto_id ON public.cotizaciones USING btree (proyecto_id);
CREATE INDEX idx_revisiones_cotizacion ON public.cotizaciones_revisiones USING btree (cotizacion_id, revision);
CREATE INDEX idx_revisiones_folio ON public.cotizaciones_revisiones USING btree (folio);
CREATE INDEX idx_escenarios_cotizacion_id ON public.escenarios USING btree (cotizacion_id);
CREATE INDEX idx_escenarios_proyecto_id ON public.escenarios USING btree (proyecto_id);
CREATE UNIQUE INDEX expediente_revisiones_expediente_rev_uidx ON public.expediente_revisiones USING btree (expediente_id, rev);
CREATE INDEX expediente_revisiones_producto_version_idx ON public.expediente_revisiones USING btree (producto_version_id);
CREATE INDEX exprev_exp_idx ON public.expediente_revisiones USING btree (expediente_id, rev DESC);
CREATE INDEX idx_expediente_revisiones_producto_id ON public.expediente_revisiones USING btree (producto_id);
CREATE INDEX exp_creado_idx ON public.expedientes USING btree (creado DESC);
CREATE INDEX exp_etiquetas_idx ON public.expedientes USING gin (etiquetas);
CREATE INDEX expedientes_producto_version_idx ON public.expedientes USING btree (producto_version_id);
CREATE INDEX idx_expedientes_producto_id ON public.expedientes USING btree (producto_id);
CREATE UNIQUE INDEX uq_mapeo_source_hash ON public.insumo_mapeos_externos USING btree (source_hash) WHERE (source_hash IS NOT NULL);
CREATE INDEX idx_insumo_precios_insumo ON public.insumo_precios USING btree (insumo_id, estado);
CREATE UNIQUE INDEX uq_precio_source_hash ON public.insumo_precios USING btree (source_hash) WHERE (source_hash IS NOT NULL);
CREATE INDEX idx_lista_precio_items_lista_precio_id ON public.lista_precio_items USING btree (lista_precio_id);
CREATE INDEX idx_lista_precio_items_producto_id ON public.lista_precio_items USING btree (producto_id);
CREATE INDEX idx_lista_precio_items_producto_version_id ON public.lista_precio_items USING btree (producto_version_id);
CREATE INDEX idx_lista_precio_items_variante_id ON public.lista_precio_items USING btree (variante_id);
CREATE INDEX idx_producto_versiones_producto_id ON public.producto_versiones USING btree (producto_id);
CREATE INDEX idx_productos_version_vigente_id ON public.productos USING btree (version_tecnica_vigente_id);
CREATE UNIQUE INDEX productos_fuente_uniq ON public.productos USING btree (source_type, source_ref);
CREATE INDEX idx_proyecto_actividades_proyecto_id ON public.proyecto_actividades USING btree (proyecto_id);
CREATE INDEX idx_proyectos_cliente_id ON public.proyectos USING btree (cliente_id);
CREATE INDEX idx_proyectos_contacto_principal_id ON public.proyectos USING btree (contacto_principal_id);
CREATE INDEX reglas_ambito_idx ON public.reglas USING btree (ambito) WHERE activa;
CREATE UNIQUE INDEX reglas_clave_idx ON public.reglas USING btree (clave) WHERE (clave IS NOT NULL);
CREATE INDEX render_eventos_email_fecha_idx ON public.render_eventos USING btree (email, created_at DESC);
CREATE INDEX render_eventos_fecha_idx ON public.render_eventos USING btree (created_at DESC);
CREATE INDEX idx_renders_producto_id ON public.renders USING btree (producto_id);
CREATE INDEX renders_expediente_idx ON public.renders USING btree (expediente_id);
CREATE INDEX renders_producto_version_idx ON public.renders USING btree (producto_version_id);
CREATE INDEX idx_variantes_producto_producto_version_id ON public.variantes_producto USING btree (producto_version_id);
CREATE INDEX voni_council_events_created_idx ON public.voni_council_events USING btree (created_at DESC);
CREATE INDEX voni_council_events_task_idx ON public.voni_council_events USING btree (task, created_at DESC);

-- ===== 4. COMENTARIOS (obj_description / col_description) =====
COMMENT ON TABLE public.render_eventos IS 'Telemetría/rate-limit de generar-render (gasto de Gemini). RLS sin políticas: solo service_role.';
COMMENT ON COLUMN public.ai_eventos.catalog_chars IS 'Longitud en chars del catálogo inyectado al prompt (peso del catálogo).';
COMMENT ON COLUMN public.ai_eventos.catalog_count IS 'Nº de insumos ofrecidos al modelo.';
COMMENT ON COLUMN public.ai_eventos.effort IS 'output_config.effort usado (low/medium).';
COMMENT ON COLUMN public.ai_eventos.fallback_used IS 'true si se uso fallback de modelo; false en llamadas nuevas (no hay fallback aun); NULL = fila pre-instrumentacion (desconocido).';
COMMENT ON COLUMN public.ai_eventos.input_tokens IS 'data.usage.input_tokens del proveedor (conteo).';
COMMENT ON COLUMN public.ai_eventos.max_tokens IS 'max_tokens enviado al proveedor.';
COMMENT ON COLUMN public.ai_eventos.model_id IS 'Modelo resuelto por la config centralizada (ej. claude-opus-5).';
COMMENT ON COLUMN public.ai_eventos.output_tokens IS 'data.usage.output_tokens del proveedor (conteo).';
COMMENT ON COLUMN public.ai_eventos.provider_body_ms IS 'ms leyendo el body de la respuesta del proveedor.';
COMMENT ON COLUMN public.ai_eventos.provider_duration_ms IS 'ms totales de la(s) llamada(s) al proveedor (vs duration_ms = total nuestro).';
COMMENT ON COLUMN public.ai_eventos.provider_headers_ms IS 'ms hasta recibir los HEADERS HTTP de la respuesta del proveedor (no TTFB de tokens).';
COMMENT ON COLUMN public.ai_eventos.provider_http_status IS 'Status HTTP REAL de Anthropic (distinto de http_status de nuestra fn). NULL si no hubo respuesta (abort/timeout).';
COMMENT ON COLUMN public.ai_eventos.user_input_chars IS 'Longitud del TEXTO del usuario (NO el prompt total, NO el texto).';
COMMENT ON COLUMN public.expedientes.cocrear IS 'Estado estructurado de co-creacion (ProductSpec/intent/dna/historia) — Cocrear Studio. Liviano: sin base64 de render.';
