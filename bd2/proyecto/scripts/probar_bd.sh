#!/usr/bin/env bash
# Crea una copia de la base (tienda_ropa_pruebas), ejecuta las pruebas funcionales y de
# concurrencia, guarda la evidencia en docs/evidencia y elimina la copia.
set -euo pipefail
SUPER="${PSQL_SUPER:-psql}"   # en Ubuntu: PSQL_SUPER="sudo -u postgres psql"
export PGCLIENTENCODING=UTF8
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$RAIZ/docs/evidencia"
$SUPER -X -q -d postgres -c "DROP DATABASE IF EXISTS tienda_ropa_pruebas" -c "CREATE DATABASE tienda_ropa_pruebas TEMPLATE tienda_ropa OWNER tienda_owner"
$SUPER -X -d tienda_ropa_pruebas -f - < "$RAIZ/db/postgres/09_pruebas.sql" > "$RAIZ/docs/evidencia/pruebas_funcionales.txt" 2>&1
PGDATABASE=tienda_ropa_pruebas "$RAIZ/scripts/prueba_concurrencia.sh" | tee "$RAIZ/docs/evidencia/pruebas_concurrencia.txt"
$SUPER -X -q -d postgres -c "DROP DATABASE tienda_ropa_pruebas"
