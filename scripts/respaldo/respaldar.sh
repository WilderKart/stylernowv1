#!/usr/bin/env bash
# Respaldo CIFRADO de una base Postgres de Docker (local de pruebas por defecto). Cubre: datos, esquema (funciones, políticas,
# triggers, índices), Auth (schema auth), roles (globals, sin contraseñas) e inventario de archivos (storage.objects).
# El cifrado es GPG simétrico AES-256 con una clave generada en .respaldo-clave.local (ignorada por Git). Nunca se imprime.
# Producción NO se respalda con este script (requiere una conexión de solo lectura que Wilder debe provisionar).
set -euo pipefail
cd "$(dirname "$0")/../.."
BASE="${BASE:-postgres}"; C="${CONTENEDOR:-supabase_db_stylernow-cierre}"; DESTINO="${DESTINO:-../stylernow-respaldos/db}"
case "$C" in supabase_db_*) ;; *) echo "RECHAZADO: contenedor no válido"; exit 2;; esac
[ -f .respaldo-clave.local ] || { umask 077; head -c 36 /dev/urandom | base64 | tr -d '\n' > .respaldo-clave.local; }
ts=$(date +%Y%m%d-%H%M%S); w=$(mktemp -d); mkdir -p "$DESTINO"; t0=$(date +%s)
docker exec "$C" pg_dump -U postgres -d "$BASE" -Fc > "$w/base.dump"
docker exec "$C" pg_dumpall -U postgres --globals-only --no-role-passwords > "$w/roles.sql"
docker exec "$C" psql -U postgres -d "$BASE" -At -F, -c "select bucket_id, name, coalesce(metadata->>'size',''), coalesce(metadata->>'mimetype',''), coalesce(metadata->>'eTag',''), created_at from storage.objects order by 1,2" > "$w/inventario_archivos.csv"
tr -d '\r' < scripts/respaldo/huella.sql | docker exec -i "$C" psql -U postgres -d "$BASE" -At > "$w/huella.txt"
( cd "$w" && sha256sum base.dump roles.sql inventario_archivos.csv huella.txt > SHA256SUMS.txt && tar -cf "paquete.tar" base.dump roles.sql inventario_archivos.csv huella.txt SHA256SUMS.txt )
gpg --batch --yes --quiet --symmetric --cipher-algo AES256 --passphrase-file .respaldo-clave.local -o "$DESTINO/respaldo-$ts.tar.gpg" "$w/paquete.tar"
t1=$(date +%s); tam=$(stat -c %s "$DESTINO/respaldo-$ts.tar.gpg")
cp "$w/huella.txt" "$DESTINO/respaldo-$ts.huella.txt"
rm -rf "$w"
echo "respaldo: $DESTINO/respaldo-$ts.tar.gpg ($tam bytes, $((t1-t0)) s)"
