/*
Taller MQL - Bases de Datos 2 (Universidad El Bosque)
Base de datos: sample_mflix (MongoDB Atlas)
Autores: Daniel Nieto, Juan Diego Mateus y Diego Rodriguez Lemus
Parte B - Agregacion (aggregate)
*/
use("sample_mflix");

// ===== Punto 6 =====
// Por género: número de películas, promedio IMDb (2 decimales) y máximo; solo géneros con más de 500 películas, orden por promedio desc.

db.movies.aggregate([
  { $match: { "imdb.rating": { $type: "number" } } },
  { $unwind: "$genres" },
  { $group: {
      _id: "$genres",
      totalPeliculas: { $sum: 1 },
      promedio: { $avg: "$imdb.rating" },
      maximo: { $max: "$imdb.rating" }
  } },
  { $match: { totalPeliculas: { $gt: 500 } } },
  { $project: {
      _id: 0,
      genero: "$_id",
      totalPeliculas: 1,
      promedio: { $round: ["$promedio", 2] },
      maximo: 1
  } },
  { $sort: { promedio: -1 } }
]);

// Lógica: $match con $type "number" descarta los ratings vacíos (""); $unwind separa el arreglo genres; $group cuenta, promedia y saca el máximo por género; el segundo $match funciona como HAVING (> 500); $project redondea con $round y $sort ordena. El $match va antes del $unwind para procesar menos documentos.

// ===== Punto 7 =====
// Top 5 directores con más películas con rating ≥ 7.5 (mínimo 5), con lista de máximo 3 títulos.

db.movies.aggregate([
  { $match: { "imdb.rating": { $type: "number", $gte: 7.5 } } },
  { $unwind: "$directors" },
  { $group: {
      _id: "$directors",
      cantidad: { $sum: 1 },
      titulos: { $push: "$title" }
  } },
  { $match: { cantidad: { $gte: 5 } } },
  { $sort: { cantidad: -1, _id: 1 } },
  { $limit: 5 },
  { $project: {
      _id: 0,
      director: "$_id",
      cantidad: 1,
      titulos: { $slice: ["$titulos", 3] }
  } }
]);

// Lógica: Se filtran las películas con rating ≥ 7.5, $unwind separa directors (una película puede tener varios), $group cuenta y acumula títulos con $push, $match exige mínimo 5, se ordena, $limit deja 5 y $slice recorta la lista a 3 títulos.

// ===== Punto 8 =====
// Número de películas por década desde 1950.

db.movies.aggregate([
  { $match: { year: { $type: "number", $gte: 1950 } } },
  { $group: {
      _id: { $subtract: ["$year", { $mod: ["$year", 10] }] },
      totalPeliculas: { $sum: 1 }
  } },
  { $sort: { _id: 1 } },
  { $project: {
      _id: 0,
      decada: { $concat: [{ $toString: "$_id" }, "s"] },
      totalPeliculas: 1
  } }
]);

// Lógica: Se toman solo los year numéricos ≥ 1950 (algunos vienen como texto). La década se calcula como year − (year mod 10) y se agrupa por ese valor; $concat agrega la "s" para mostrar 1950s, 1960s, etc.

// ===== Punto 9 =====
// Top 10 películas más comentadas: título, año y número de comentarios ($lookup entre comments y movies).

db.comments.aggregate([
  { $group: { _id: "$movie_id", numComentarios: { $sum: 1 } } },
  { $sort: { numComentarios: -1 } },
  { $limit: 10 },
  { $lookup: {
      from: "movies",
      localField: "_id",
      foreignField: "_id",
      as: "pelicula"
  } },
  { $unwind: "$pelicula" },
  { $project: {
      _id: 0,
      titulo: "$pelicula.title",
      anio: "$pelicula.year",
      numComentarios: 1
  } }
]);

// Lógica: Primero se agrupa comments por movie_id y se cuentan los comentarios; se ordena y se limita a 10. Solo después se hace $lookup a movies para traer título y año, así el join se ejecuta 10 veces y no sobre todos los comentarios.

// ===== Punto 10 =====
// Usuarios (email) con más de 250 comentarios, con fecha del primer y último comentario.

db.comments.aggregate([
  { $group: {
      _id: "$email",
      totalComentarios: { $sum: 1 },
      primerComentario: { $min: "$date" },
      ultimoComentario: { $max: "$date" }
  } },
  { $match: { totalComentarios: { $gt: 250 } } },
  { $sort: { totalComentarios: -1 } },
  { $lookup: { from: "users", localField: "_id", foreignField: "email", as: "usuario" } },
  { $project: {
      _id: 0,
      email: "$_id",
      nombre: { $first: "$usuario.name" },
      totalComentarios: 1,
      primerComentario: 1,
      ultimoComentario: 1
  } }
]);

// Lógica: Se agrupa comments por email; $min y $max sobre date dan la primera y la última fecha. $match filtra > 250 y un $lookup opcional a users trae el nombre.
