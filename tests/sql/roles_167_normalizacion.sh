#!/bin/bash
# Ejecuta tests/sql/roles_157_normalizacion.sql sustituyendo '-- INCLUDE157' por la migración 163 (solo base LOCAL, ROLLBACK).
cd "$(dirname "$0")/../.." || exit 2
awk -v f="supabase/migrations/163_normalizacion_roles_existentes.sql" '$0=="-- INCLUDE157"{while((getline l < f)>0) print l; close(f); next} {print}' tests/sql/roles_157_normalizacion.sql \
  | docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off
