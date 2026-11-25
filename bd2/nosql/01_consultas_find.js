/*
Taller MQL - Bases de Datos 2 (Universidad El Bosque)
Base de datos: sample_mflix (MongoDB Atlas)
Autores: Daniel Nieto, Juan Diego Mateus y Diego Rodriguez Lemus
Parte A - Consultas (find)
*/
use("sample_mflix");

// ===== Punto 1 =====
// Películas de Drama (2000-2010) con imdb.rating ≥ 8, proyección title/year/rating sin _id, orden desc, 10 resultados y conteo total.

const filtroP1 = {
  genres: "Drama",
  year: { $gte: 2000, $lte: 2010 },
  "imdb.rating": { $gte: 8 }
};

db.movies.find(filtroP1, { _id: 0, title: 1, year: 1, "imdb.rating": 1 })
  .sort({ "imdb.rating": -1 })
  .limit(10);

db.movies.countDocuments(filtroP1);   // conteo total (sin el limit)

// ===== Punto 2 =====
// Películas en las que actúa Tom Hanks y cuyo director no es Steven Spielberg.

db.movies.find(
  { cast: "Tom Hanks", directors: { $nin: ["Steven Spielberg"] } },
  { _id: 0, title: 1, year: 1, directors: 1 }
).sort({ year: 1 });

db.movies.countDocuments({ cast: "Tom Hanks", directors: { $nin: ["Steven Spielberg"] } });

// ===== Punto 3 =====
// Películas con exactamente 3 géneros que incluyan Comedy y Romance.

db.movies.find(
  { genres: { $size: 3, $all: ["Comedy", "Romance"] } },
  { _id: 0, title: 1, year: 1, genres: 1 }
);

db.movies.countDocuments({ genres: { $size: 3, $all: ["Comedy", "Romance"] } });

// ===== Punto 4 =====
// Películas sin el campo rated o con rated "UNRATED" / "NOT RATED", con conteo.

const filtroP4 = {
  $or: [
    { rated: { $exists: false } },
    { rated: { $in: ["UNRATED", "NOT RATED"] } }
  ]
};

db.movies.find(filtroP4, { _id: 0, title: 1, year: 1, rated: 1 }).limit(10);

db.movies.countDocuments(filtroP4);

// ===== Punto 5 =====
// Títulos que empiezan por "The" y terminan en "Man", sin distinguir mayúsculas.

db.movies.find({ title: { $regex: /^The.*Man$/i } }, { _id: 0, title: 1, year: 1 });

db.movies.countDocuments({ title: { $regex: /^The.*Man$/i } });
