// =====================================================================
// Proyecto Final Bases de Datos 2 - Tienda de Ropa
// Archivo : 04_agregaciones.js  (ejecutar con mongosh)
// Autores : Juan Diego Mateus, Diego Lemus
// Fecha   : 2026-11-04
// Descripcion: pipelines de agregacion ($group, $lookup, $unwind, $facet,
//   $bucket, $setWindowFields, $merge).
// =====================================================================
const bd = db.getSiblingDB('tienda_ropa_nosql');
const titulo = (t) => print('\n=== ' + t + ' ===');
const fila = (d) => print(JSON.stringify(d));

titulo('A1. Calificacion promedio por producto (minimo 15 resenas), top 5');
bd.resenas.aggregate([
  { $group: { _id: '$id_producto', promedio: { $avg: '$calificacion' }, resenas: { $sum: 1 } } },
  { $match: { resenas: { $gte: 15 } } },
  { $lookup: { from: 'catalogo_productos', localField: '_id', foreignField: 'id_producto', as: 'p' } },
  { $unwind: '$p' },
  { $project: { _id: 0, producto: '$p.nombre', promedio: { $round: ['$promedio', 2] }, resenas: 1 } },
  { $sort: { promedio: -1, resenas: -1 } }, { $limit: 5 }]).forEach(fila);

titulo('A2. Distribucion de calificaciones');
bd.resenas.aggregate([{ $group: { _id: '$calificacion', cantidad: { $sum: 1 } } }, { $sort: { _id: -1 } },
  { $project: { _id: 0, estrellas: '$_id', cantidad: 1 } }]).forEach(fila);

titulo('A3. Calificacion promedio por categoria ($lookup entre colecciones)');
bd.resenas.aggregate([
  { $lookup: { from: 'catalogo_productos', localField: 'id_producto', foreignField: 'id_producto', as: 'p' } },
  { $unwind: '$p' },
  { $group: { _id: '$p.categoria', promedio: { $avg: '$calificacion' }, resenas: { $sum: 1 } } },
  { $project: { _id: 0, categoria: '$_id', promedio: { $round: ['$promedio', 2] }, resenas: 1 } },
  { $sort: { promedio: -1 } }, { $limit: 5 }]).forEach(fila);

titulo('A4. Recomendacion de talla: productos que "corren pequeno" (mas del 40% de las resenas)');
bd.resenas.aggregate([
  { $group: { _id: '$id_producto', total: { $sum: 1 },
              pequeno: { $sum: { $cond: [{ $eq: ['$ajuste', 'pequeno'] }, 1, 0] } },
              grande: { $sum: { $cond: [{ $eq: ['$ajuste', 'grande'] }, 1, 0] } } } },
  { $match: { total: { $gte: 15 } } },
  { $addFields: { pct_pequeno: { $round: [{ $multiply: [100, { $divide: ['$pequeno', '$total'] }] }, 1] },
                  pct_grande: { $round: [{ $multiply: [100, { $divide: ['$grande', '$total'] }] }, 1] } } },
  { $match: { pct_pequeno: { $gt: 40 } } },
  { $lookup: { from: 'catalogo_productos', localField: '_id', foreignField: 'id_producto', as: 'p' } },
  { $unwind: '$p' }, { $project: { _id: 0, producto: '$p.nombre', pct_pequeno: 1, total: 1 } }, { $sort: { pct_pequeno: -1 } }]).forEach(fila);

titulo('A5. Embudo de conversion: sesiones unicas por etapa y tasa respecto a la etapa anterior');
const orden = ['vista_producto', 'agregar_carrito', 'inicio_checkout', 'pedido_creado'];   // la busqueda es opcional, no es etapa del embudo
const etapas = bd.eventos_app.aggregate([
  { $match: { tipo: { $in: orden } } },
  { $group: { _id: '$tipo', sesiones: { $addToSet: '$sesion_id' } } },
  { $project: { sesiones: { $size: '$sesiones' } } },
  { $addFields: { pos: { $indexOfArray: [orden, '$_id'] } } }, { $sort: { pos: 1 } }]).toArray();
etapas.forEach((e, i) => print(e._id.padEnd(16) + String(e.sesiones).padStart(6) + (i ? '   ' + (100 * e.sesiones / etapas[i - 1].sesiones).toFixed(1) + '% de la etapa anterior' : '')));

titulo('A6. Trafico por hora del dia (hora de Bogota) y dispositivo');
bd.eventos_app.aggregate([
  { $match: { tipo: 'vista_producto' } },
  { $group: { _id: { hora: { $dateToString: { format: '%H', date: '$ts', timezone: 'America/Bogota' } }, dispositivo: '$dispositivo' }, vistas: { $sum: 1 } } },
  { $group: { _id: '$_id.hora', total: { $sum: '$vistas' }, por_dispositivo: { $push: { k: '$_id.dispositivo', v: '$vistas' } } } },
  { $project: { _id: 0, hora: '$_id', total: 1, por_dispositivo: { $arrayToObject: '$por_dispositivo' } } },
  { $sort: { total: -1 } }, { $limit: 4 }]).forEach(fila);

titulo('A7. Terminos de busqueda mas frecuentes y promedio de resultados');
bd.eventos_app.aggregate([{ $match: { tipo: 'busqueda' } },
  { $group: { _id: '$payload.termino', veces: { $sum: 1 }, resultados_prom: { $avg: '$payload.resultados' } } },
  { $project: { _id: 0, termino: '$_id', veces: 1, resultados_prom: { $round: ['$resultados_prom', 1] } } },
  { $sort: { veces: -1 } }, { $limit: 5 }]).forEach(fila);

titulo('A8. Productos con mas vistas y su tasa de "agregar al carrito"');
bd.eventos_app.aggregate([
  { $match: { tipo: { $in: ['vista_producto', 'agregar_carrito'] } } },
  { $group: { _id: '$payload.id_producto', vistas: { $sum: { $cond: [{ $eq: ['$tipo', 'vista_producto'] }, 1, 0] } },
              agregados: { $sum: { $cond: [{ $eq: ['$tipo', 'agregar_carrito'] }, 1, 0] } } } },
  { $match: { vistas: { $gt: 0 } } }, { $sort: { vistas: -1 } }, { $limit: 5 },
  { $lookup: { from: 'catalogo_productos', localField: '_id', foreignField: 'id_producto', as: 'p' } }, { $unwind: '$p' },
  { $project: { _id: 0, producto: '$p.nombre', vistas: 1, agregados: 1, tasa_pct: { $round: [{ $multiply: [100, { $divide: ['$agregados', '$vistas'] }] }, 1] } } }]).forEach(fila);

titulo('A9. $unwind de etiquetas: cuantos productos tiene cada etiqueta');
bd.catalogo_productos.aggregate([{ $unwind: '$etiquetas' }, { $group: { _id: '$etiquetas', productos: { $sum: 1 } } },
  { $sort: { productos: -1, _id: 1 } }, { $limit: 5 }]).forEach(fila);

titulo('A10. $facet: tres analisis en una sola pasada sobre las resenas');
printjson(bd.resenas.aggregate([{ $facet: {
  general: [{ $group: { _id: null, promedio: { $avg: '$calificacion' }, resenas: { $sum: 1 } } }, { $project: { _id: 0, promedio: { $round: ['$promedio', 2] }, resenas: 1 } }],
  con_foto: [{ $match: { fotos: { $exists: true } } }, { $count: 'resenas' }],
  por_ajuste: [{ $group: { _id: '$ajuste', n: { $sum: 1 } } }, { $sort: { n: -1 } }] } }]).toArray()[0]);

titulo('A11. $bucket: reseñas agrupadas por rango de votos utiles');
bd.resenas.aggregate([{ $bucket: { groupBy: '$votos_utiles', boundaries: [0, 1, 5, 10, 100], default: '100+', output: { resenas: { $sum: 1 } } } }]).forEach(fila);

titulo('A12. $setWindowFields: promedio movil de 3 meses de la calificacion');
bd.resenas.aggregate([
  { $group: { _id: { $dateTrunc: { date: '$fecha', unit: 'month' } }, promedio: { $avg: '$calificacion' }, resenas: { $sum: 1 } } },
  { $setWindowFields: { sortBy: { _id: 1 }, output: { promedio_movil_3m: { $avg: '$promedio', window: { documents: [-2, 0] } } } } },
  { $project: { _id: 0, mes: { $dateToString: { format: '%Y-%m', date: '$_id' } }, resenas: 1, promedio: { $round: ['$promedio', 2] }, promedio_movil_3m: { $round: ['$promedio_movil_3m', 2] } } },
  { $sort: { mes: 1 } }, { $limit: 5 }]).forEach(fila);

titulo('A13. $merge: vista materializada resumen_calificaciones (la usa la aplicacion web)');
bd.resenas.aggregate([
  { $group: { _id: '$id_producto', promedio: { $avg: '$calificacion' }, resenas: { $sum: 1 }, ultima: { $max: '$fecha' } } },
  { $project: { promedio: { $round: ['$promedio', 2] }, resenas: 1, ultima: 1 } },
  { $merge: { into: 'resumen_calificaciones', on: '_id', whenMatched: 'replace', whenNotMatched: 'insert' } }]);
print('documentos en resumen_calificaciones: ' + bd.resumen_calificaciones.countDocuments());
