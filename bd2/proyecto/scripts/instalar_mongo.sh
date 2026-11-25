#!/usr/bin/env bash
# Crea el modelo documental, carga los datos desde PostgreSQL y construye la vista materializada de calificaciones.
# Requiere: mongosh, node (con las dependencias de app/ instaladas) y la base relacional ya instalada.
# Uso: MONGO_URL=mongodb://127.0.0.1:27017 PGHOST=127.0.0.1 PGPORT=5432 scripts/instalar_mongo.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
MONGO_URL="${MONGO_URL:-mongodb://127.0.0.1:27017}"
MONGOSH="${MONGOSH:-mongosh}"
echo ">> 01_modelo.js (colecciones, validacion de esquema, indices)"
"$MONGOSH" --quiet "$MONGO_URL" --file "$RAIZ/db/mongo/01_modelo.js"
echo ">> seed_mongo.js (catalogo, GridFS, resenas, eventos, carritos)"
(cd "$RAIZ/app" && env -u PGUSER MONGO_URL="$MONGO_URL" node seed/seed_mongo.js)
echo ">> resumen_calificaciones (vista materializada con \$merge)"
"$MONGOSH" --quiet "$MONGO_URL/tienda_ropa_nosql" --eval '
db.resenas.aggregate([
  { $group: { _id: "$id_producto", promedio: { $avg: "$calificacion" }, resenas: { $sum: 1 }, ultima: { $max: "$fecha" } } },
  { $project: { promedio: { $round: ["$promedio", 2] }, resenas: 1, ultima: 1 } },
  { $merge: { into: "resumen_calificaciones", on: "_id", whenMatched: "replace", whenNotMatched: "insert" } }]);
print("resumen_calificaciones: " + db.resumen_calificaciones.countDocuments() + " documentos");'
echo "Instalacion de MongoDB completa."
