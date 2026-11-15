#!/usr/bin/env bash
# ENSAYO de restauración en una base NUEVA dentro del mismo Docker local (nunca sobre la base original ni producción).
# Uso: bash scripts/respaldo/restaurar-prueba.sh <respaldo.tar.gpg>   Mide el tiempo (RTO real) y compara huellas con el origen.
set -euo pipefail
cd "$(dirname "$0")/../.."
C="${CONTENEDOR:-supabase_db_stylernow-cierre}"; ARCH="$1"
case "$C" in supabase_db_*cierre*) ;; *) echo "RECHAZADO: solo el contenedor de pruebas"; exit 2;; esac
w=$(mktemp -d); t0=$(date +%s); db="restauracion_$(date +%H%M%S)"
gpg --batch --quiet --decrypt --passphrase-file .respaldo-clave.local "$ARCH" > "$w/paquete.tar"; tar -xf "$w/paquete.tar" -C "$w"
( cd "$w" && sha256sum -c SHA256SUMS.txt )
docker exec "$C" psql -U postgres -d postgres -qc "create database $db template template0" 
docker exec -i "$C" pg_restore -U postgres -d "$db" --no-owner < "$w/base.dump" 2> "$w/restore.err" || true
t1=$(date +%s)
tr -d '\r' < scripts/respaldo/huella.sql | docker exec -i "$C" psql -U postgres -d "$db" -At > "$w/huella_restaurada.txt"
echo "--- errores de pg_restore (líneas): $(grep -c . "$w/restore.err" || true)"; grep -i "error" "$w/restore.err" | sort | uniq -c | sort -rn | head -8 || true
if diff <(sort "$w/huella.txt") <(sort "$w/huella_restaurada.txt") > "$w/dif.txt"; then echo "HUELLAS IDÉNTICAS (origen = restaurado)"; else echo "HUELLAS DIFIEREN:"; cat "$w/dif.txt"; fi
echo "restauración: $((t1-t0)) s  → base de prueba: $db (se conserva para verificar; bórrala con: docker exec $C psql -U postgres -c 'drop database $db')"
cp "$w/huella_restaurada.txt" "${ARCH%.tar.gpg}.huella_restaurada.txt"; cp "$w/restore.err" "${ARCH%.tar.gpg}.restore.err"
echo "$db" > "${ARCH%.tar.gpg}.dbrestaurada.txt"
rm -rf "$w"
