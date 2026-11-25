#!/usr/bin/env bash
# Instala la base de datos completa desde cero (destruye y recrea tienda_ropa).
#   Paso 00 (roles y base): superusuario  -> variable PSQL_SUPER (por defecto: psql)
#   Pasos 01-08: dueno tienda_owner, por TCP/socket segun PGHOST, con la clave TIENDA_OWNER_PASSWORD
# Ejemplos:
#   Desarrollo (autenticacion trust):  PGHOST=/tmp PGPORT=5433 PGUSER=postgres scripts/instalar_bd.sh
#   Ubuntu con autenticacion peer:     PSQL_SUPER="sudo -u postgres psql" PGHOST=127.0.0.1 scripts/instalar_bd.sh
set -euo pipefail
export PGCLIENTENCODING=UTF8
DIR="$(cd "$(dirname "$0")/../db/postgres" && pwd)"
SUPER="${PSQL_SUPER:-psql}"
$SUPER -X -q -v ON_ERROR_STOP=1 -d postgres -f - < "$DIR/00_crear_base_datos.sql"
for f in 01_creacion 02_funciones 03_triggers 04_procedimientos 05_insercion 06_vistas 07_seguridad 08_comentarios; do
  [ -f "$DIR/$f.sql" ] || { echo "Falta $f.sql (omitido)"; continue; }
  echo ">> $f.sql"
  PGPASSWORD="${TIENDA_OWNER_PASSWORD:-Owner2026*}" psql -X -q -v ON_ERROR_STOP=1 -U tienda_owner -d tienda_ropa -f "$DIR/$f.sql" > /dev/null
done
echo "Instalacion completa."
