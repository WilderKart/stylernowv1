#!/usr/bin/env bash
# Verifica que supabase/scripts/hotfix_2026_11_12_autorizacion_staff_nulo.sql corrige la falla P0
# sobre la versión vulnerable (la que hoy está en producción). Solo base LOCAL; todo termina en ROLLBACK.
#   bash tests/sql/hotfix_staff_nulo_verificacion.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
cat tests/sql/hotfix_staff_nulo_previo.sql \
    supabase/scripts/hotfix_2026_11_12_autorizacion_staff_nulo.sql \
    tests/sql/hotfix_staff_nulo_posterior.sql \
  | docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
