/*
Taller MQL - Bases de Datos 2 (Universidad El Bosque)
Base de datos: sample_mflix (MongoDB Atlas)
Autores: Daniel Nieto, Juan Diego Mateus y Diego Rodriguez Lemus
Parte C - Escritura e indices (incluye explain ESR)
*/
use("sample_mflix");

// Filtro del Punto 1 (se reutiliza en el Punto 14)
const filtroP1 = {
  genres: "Drama",
  year: { $gte: 2000, $lte: 2010 },
  "imdb.rating": { $gte: 8 }
};

// ===== Punto 11 =====
// Crear peliculas_pareja con $out: películas de 2015 con título, géneros, rating y categoria con $switch.

db.movies.aggregate([
  { $match: { year: 2015, "imdb.rating": { $type: "number" } } },
  { $project: {
      titulo: "$title",
      generos: "$genres",
      rating: "$imdb.rating",
      categoria: {
        $switch: {
          branches: [
            { case: { $gte: ["$imdb.rating", 7.5] }, then: "Alta" },
            { case: { $gte: ["$imdb.rating", 6] },   then: "Media" }
          ],
          default: "Baja"
        }
      }
  } },
  { $out: "peliculas_pareja" }
]);

// Verificación
db.peliculas_pareja.countDocuments();
db.peliculas_pareja.aggregate([{ $group: { _id: "$categoria", total: { $sum: 1 } } }]);
db.peliculas_pareja.find({}, { _id: 0 }).limit(5);

// Lógica: Se filtran las películas de 2015 con rating numérico (en agregación el texto "" es mayor que cualquier número y quedaría como "Alta"). $switch asigna Alta (≥ 7.5), Media (≥ 6) o Baja, y $out escribe el resultado en la nueva colección.

// ===== Punto 12 =====
// updateMany: revisado: true y +0.1 al rating de categoría "Media". Reportar matchedCount y modifiedCount.

const resUpdate = db.peliculas_pareja.updateMany(
  { categoria: "Media" },
  { $set: { revisado: true }, $inc: { rating: 0.1 } }
);
print("matchedCount:", resUpdate.matchedCount, "| modifiedCount:", resUpdate.modifiedCount);

db.peliculas_pareja.find({ categoria: "Media" }, { _id: 0, titulo: 1, rating: 1, revisado: 1 }).limit(5);

// Lógica: $set agrega el campo revisado y $inc suma 0.1 al rating. matchedCount son los documentos que cumplen el filtro y modifiedCount los que realmente cambiaron. La categoría no se recalcula automáticamente.

// ===== Punto 13 =====
// deleteMany de la categoría "Baja" y reportar documentos borrados.

print("Bajas antes de borrar:", db.peliculas_pareja.countDocuments({ categoria: "Baja" }));

const resDelete = db.peliculas_pareja.deleteMany({ categoria: "Baja" });
print("deletedCount:", resDelete.deletedCount);

print("Bajas después de borrar:", db.peliculas_pareja.countDocuments({ categoria: "Baja" }));

// Lógica: deleteMany elimina todos los documentos con categoria "Baja" y deletedCount indica cuántos se borraron. Se verifica contando antes y después.

// ===== Punto 14 – explain() antes y después del índice (ESR) =====
// Ejecutar la consulta del punto 1 con explain("executionStats") antes y después de un índice compuesto que siga la regla ESR; comparar totalDocsExamined, executionTimeMillis y etapa ganadora; eliminar el índice.

// Función auxiliar: busca las etapas del plan ganador (sirve para
// cualquier versión de MongoDB, con o sin motor SBE).
function etapas(plan) {
  const out = [];
  (function rec(n) {
    if (!n || typeof n !== "object") return;
    if (n.stage) out.push(n.stage);
    for (const k of ["inputStage", "queryPlan"]) if (n[k]) rec(n[k]);
    if (Array.isArray(n.inputStages)) n.inputStages.forEach(rec);
  })(plan);
  return out.join(" <- ");
}

function resumenExplain(etiqueta) {
  const exp = db.movies.find(filtroP1, { _id: 0, title: 1, year: 1, "imdb.rating": 1 })
    .sort({ "imdb.rating": -1 })
    .limit(10)
    .explain("executionStats");
  const es = exp.executionStats;
  print("==== " + etiqueta + " ====");
  print("Plan ganador:        ", etapas(exp.queryPlanner.winningPlan));
  print("nReturned:           ", es.nReturned);
  print("totalKeysExamined:   ", es.totalKeysExamined);
  print("totalDocsExamined:   ", es.totalDocsExamined);
  print("executionTimeMillis: ", es.executionTimeMillis);
  return exp;
}

// 14.1 ANTES del índice -> se espera COLLSCAN + SORT en memoria,
//      totalDocsExamined ≈ total de la colección (~21.000)
resumenExplain("ANTES DEL ÍNDICE");

// 14.2 Crear índice compuesto ESR
db.movies.createIndex(
  { genres: 1, "imdb.rating": -1, year: 1 },
  { name: "idx_esr_genres_rating_year" }
);

// 14.3 DESPUÉS del índice -> se espera IXSCAN (sin SORT), docs examinados
//      muy cercanos a los devueltos y menor tiempo
resumenExplain("DESPUÉS DEL ÍNDICE");

// (Opcional para la sustentación) Comparar con un índice que NO sigue ESR:
// db.movies.createIndex({ genres: 1, year: 1, "imdb.rating": -1 }, { name: "idx_no_esr" });
// resumenExplain("ÍNDICE NO ESR");   // aparece etapa SORT en memoria
// db.movies.dropIndex("idx_no_esr");

// 14.4 Eliminar el índice creado
db.movies.dropIndex("idx_esr_genres_rating_year");
db.movies.getIndexes();   // verificar que ya no está

// Lógica: Índice { genres: 1, "imdb.rating": -1, year: 1 }. Regla ESR: genres es la condición de igualdad (E), imdb.rating es el campo de ordenamiento (S) y year es el rango (R). Con este orden el índice entrega los documentos ya ordenados, se elimina el SORT en memoria y el plan pasa de COLLSCAN a IXSCAN, examinando muchos menos documentos.
