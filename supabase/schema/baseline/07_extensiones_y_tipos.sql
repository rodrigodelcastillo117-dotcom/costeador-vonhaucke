-- ============================================================================
-- Snapshot de SÓLO LECTURA de mtuvnbgljwbsaizjjgzs, 2026-10-10.
-- Generado con SELECTs sobre pg_catalog. NO es una migración: no aplicar.
-- Regenerar al cierre de cada bloque.
-- Archivo: 07_extensiones_y_tipos.sql
-- Contenido: Extensiones instaladas (pg_extension) y tipos personalizados (enum/compuesto/dominio) del esquema public.
-- ============================================================================

-- ===== 1. EXTENSIONES INSTALADAS (pg_extension) =====
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions VERSION '1.7';
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions VERSION '1.11';
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions VERSION '1.3';
CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog VERSION '1.0';
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault VERSION '0.3.1';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions VERSION '1.1';

-- ===== 2. TIPOS PERSONALIZADOS EN public (enum, compuesto, dominio) =====
-- (ninguno: no hay enums, tipos compuestos ni dominios definidos en public)
