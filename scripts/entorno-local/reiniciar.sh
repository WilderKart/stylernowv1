#!/usr/bin/env bash
# Reconstruye DESDE CERO la base local de pruebas (proyecto Docker `stylernow-cierre`, puertos 553xx):
#   1) borra SOLO el volumen de ese proyecto  2) arranca vacío  3) aplica las migraciones  4) paridad de privilegios con producción
#   5) datos amplios + cuentas de prueba.   No toca el stack `stylernow` (543xx) ni ningún otro proyecto.
set -euo pipefail
cd "$(dirname "$0")/../.."
supabase stop --no-backup >/dev/null 2>&1 || true
supabase start -x studio,imgproxy,vector,logflare,edge-runtime,supavisor >/dev/null 2>&1
bash scripts/entorno-local/aplicar-migraciones.sh
C=supabase_db_stylernow-cierre
tr -d '\r' < supabase/scripts/paridad_privilegios_produccion.sql | docker exec -i $C psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q 2>/dev/null
# 139 es posterior a la instantánea de privilegios de producción (que es previa a 139): se reaplica (idempotente) para que la base local refleje «producción + 139».
for m in 139_endurecimiento_fase1b 140_oferta_negocio_porcentaje_maximo 141_quitar_truncate_y_trigger_a_roles_publicos 142_registrar_evento_fraude_acotado; do tr -d '\r' < supabase/migrations/$m.sql | docker exec -i $C psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q 2>/dev/null; done
# Base `limpia`: migraciones + privilegios, SIN datos. Las suites tests/sql/*.sql suponen base vacía (p. ej. solo cabe un Super Admin, 136).
docker exec $C psql -U postgres -d postgres -qc "drop database if exists limpia" -c "create database limpia template template0"
docker exec $C pg_dump -U postgres -d postgres -Fc | docker exec -i $C pg_restore -U postgres -d limpia --no-owner 2>/dev/null || true
# Base `postgres`: datos amplios y cuentas de prueba (HTTP, matriz de aislamiento, E2E).
tr -d '\r' < supabase/seed_datos_ricos.sql | docker exec -i $C psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
bash scripts/entorno-local/sembrar.sh
# Una fila representativa del negocio B en las tablas multi-tenant que la semilla amplia no cubre (Fase 1A · D). Registra el resultado en public._sembrado.
tr -d '\r' < supabase/seed_tablas_sin_datos.sql | docker exec -i $C psql -U postgres -d postgres -q -A > /dev/null
docker exec $C psql -U postgres -d postgres -Atc "select 'tablas sembradas: '||count(*) filter (where resultado='OK')||' OK, '||count(*) filter (where resultado<>'OK')||' con error' from public._sembrado"
echo "entorno listo"
