#!/usr/bin/env bash
# Siembra la base LOCAL de pruebas con datos ficticios (supabase/seed_pruebas.sql).
# La contraseña de las cuentas se genera al azar la primera vez y queda en .credenciales-pruebas.local
# (ignorado por Git: el patrón `.env*` NO lo cubre, por eso está listado aparte en .gitignore). Nunca se imprime.
set -euo pipefail
cd "$(dirname "$0")/../.."
CONTENEDOR="${CONTENEDOR:-supabase_db_stylernow-cierre}"
case "$CONTENEDOR" in *cierre*) ;; *) echo "RECHAZADO: solo el contenedor de pruebas (*cierre*)"; exit 2;; esac
case "$(docker port "$CONTENEDOR" 5432 | head -1)" in *55322*) ;; *) echo "RECHAZADO: no es la base local de pruebas"; exit 2;; esac
ARCH=.credenciales-pruebas.local
if [ ! -f "$ARCH" ]; then
  umask 077
  printf 'PW_PRUEBAS=%s\n' "Pr$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 18)!9" > "$ARCH"
fi
# shellcheck disable=SC1090
. "$ARCH"
tr -d '\r' < supabase/seed_pruebas.sql | docker exec -i "$CONTENEDOR" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -v "pw=$PW_PRUEBAS"
echo "semilla aplicada (credenciales locales en $ARCH, no versionado)"
