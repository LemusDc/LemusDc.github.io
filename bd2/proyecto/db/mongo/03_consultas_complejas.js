// =====================================================================
// Proyecto Final Bases de Datos 2 - Tienda de Ropa
// Archivo : 03_consultas_complejas.js  (ejecutar con mongosh)
// Autores : Juan Diego Mateus, Diego Lemus
// Fecha   : 2026-11-04
// Descripcion: consultas complejas con operadores logicos, de arreglo,
//   de texto, de fecha y analisis del plan de ejecucion.
// =====================================================================
const bd = db.getSiblingDB('tienda_ropa_nosql');
const titulo = (t) => print('\n=== ' + t + ' ===');
const nombres = (cur) => cur.toArray().map((d) => d.nombre).join(' | ');

titulo('Q1. Prendas de algodon con corte oversize ($and sobre campos anidados)');
print(nombres(bd.catalogo_productos.find({ 'atributos.material': 'Algodon', 'atributos.fit': 'Oversize' }, { nombre: 1 })));

titulo('Q2. Abrigos impermeables CON capucha, o cualquier gabardina ($or + $and)');
print(nombres(bd.catalogo_productos.find({ $or: [
  { categoria: 'Chaquetas', 'atributos.impermeable': true, 'atributos.capucha': true },
  { categoria: 'Gabardinas y Paños' }] }, { nombre: 1 })));

titulo('Q3. Busqueda de texto en espanol con relevancia: "jean"');
bd.catalogo_productos.find({ $text: { $search: 'jean' } }, { nombre: 1, _id: 0, puntaje: { $meta: 'textScore' } })
  .sort({ puntaje: { $meta: 'textScore' } }).limit(5).forEach((d) => print(d.puntaje.toFixed(2) + '  ' + d.nombre));

titulo('Q4. $elemMatch en arreglo de documentos: composicion con al menos 3% de elastano');
print(nombres(bd.catalogo_productos.find({ 'atributos.composicion': { $elemMatch: { fibra: 'elastano', porcentaje: { $gte: 3 } } } }, { nombre: 1 })));

titulo('Q5. $all: disponibles en Vinotinto Y en Negro');
print(nombres(bd.catalogo_productos.find({ colores_disponibles: { $all: ['Vinotinto', 'Negro'] } }, { nombre: 1 })));

titulo('Q6. $expr con $size: productos con 5 o mas tallas y como maximo 3 colores');
print(nombres(bd.catalogo_productos.find({ $expr: { $and: [{ $gte: [{ $size: '$tallas_disponibles' }, 5] }, { $lte: [{ $size: '$colores_disponibles' }, 3] }] } }, { nombre: 1 })));

titulo('Q7. Resenas negativas verificadas SIN respuesta de la tienda ($exists), mas recientes primero');
bd.resenas.find({ calificacion: { $lte: 2 }, verificada: true, respuesta_tienda: { $exists: false } },
  { _id: 0, id_producto: 1, calificacion: 1, comentario: 1, fecha: 1 }).sort({ fecha: -1 }).limit(3).forEach((d) => print(d.fecha.toISOString().slice(0, 10) + '  prod ' + d.id_producto + '  (' + d.calificacion + ' estrellas) ' + d.comentario));

titulo('Q8. Busquedas sin resultados en los ultimos 90 dias (oportunidades de catalogo)');
const desde = new Date(Date.now() - 90 * 86400000);
bd.eventos_app.aggregate([{ $match: { tipo: 'busqueda', 'payload.resultados': 0, ts: { $gte: desde } } },
  { $group: { _id: '$payload.termino', veces: { $sum: 1 } } }, { $sort: { veces: -1 } }, { $limit: 5 }]).forEach((d) => print(d._id + ': ' + d.veces));

titulo('Q9. Busqueda con expresion regular: nombres que empiezan por "Camis"');
print(nombres(bd.catalogo_productos.find({ nombre: /^Camis/i }, { nombre: 1 })));

titulo('Q10. Plan de ejecucion: la consulta por producto y fecha usa el indice (IXSCAN)');
const idp = bd.catalogo_productos.findOne().id_producto;
const plan = bd.resenas.find({ id_producto: idp }).sort({ fecha: -1 }).explain('executionStats');
const etapa = (p) => (p.inputStage ? p.stage + ' > ' + etapa(p.inputStage) : p.stage);
print('Etapas: ' + etapa(plan.queryPlanner.winningPlan.queryPlan || plan.queryPlanner.winningPlan));
print('Documentos examinados: ' + plan.executionStats.totalDocsExamined + ' | devueltos: ' + plan.executionStats.nReturned + ' | indice: ' + (plan.executionStats.executionStages.inputStage || plan.executionStats.executionStages).indexName);
const planSin = bd.resenas.find({ comentario: /tela/ }).explain('executionStats');
print('Sin indice util (filtro por texto del comentario): documentos examinados = ' + planSin.executionStats.totalDocsExamined + ' de ' + bd.resenas.countDocuments());
