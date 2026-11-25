#!/usr/bin/env bash
# Deja el sistema como al inicio: reinstala PostgreSQL y vuelve a cargar MongoDB.
# Detenga la aplicacion antes de ejecutarlo (DROP DATABASE falla si hay conexiones abiertas).
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
"$RAIZ/scripts/instalar_bd.sh"
"$RAIZ/scripts/instalar_mongo.sh"
