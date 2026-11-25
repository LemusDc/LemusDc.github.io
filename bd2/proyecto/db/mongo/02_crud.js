// =====================================================================
// Proyecto Final Bases de Datos 2 - Tienda de Ropa
// Archivo : 02_crud.js  (ejecutar con mongosh)
// Autores : Juan Diego Mateus, Diego Lemus
// Fecha   : 2026-11-04
// Descripcion: operaciones CRUD sobre las colecciones. El script es
//   re-ejecutable: elimina al final todo lo que crea.
// Uso: mongosh "mongodb://localhost:27017/tienda_ropa_nosql" --file 02_crud.js
// =====================================================================
const bd = db.getSiblingDB('tienda_ropa_nosql');
const titulo = (t) => print('\n=== ' + t + ' ===');

// ---------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------
titulo('C1. insertOne: una resena nueva');
const idProd = bd.catalogo_productos.findOne({}, { id_producto: 1 }).id_producto;
let r = bd.resenas.insertOne({
  id_producto: idProd, id_cliente: 99001, id_pedido: 1, calificacion: 5, titulo: 'Prueba CRUD',
  comentario: 'Resena creada desde el script de CRUD.', talla_comprada: 'M', ajuste: 'justo',
  votos_utiles: 0, verificada: false, fecha: new Date() });
print('insertedId: ' + r.insertedId);

titulo('C2. insertMany: tres eventos de navegacion');
r = bd.eventos_app.insertMany([
  { tipo: 'busqueda', ts: new Date(), sesion_id: 'ses-demo', dispositivo: 'movil', payload: { termino: 'camiseta roja', resultados: 3 } },
  { tipo: 'vista_producto', ts: new Date(), sesion_id: 'ses-demo', dispositivo: 'movil', payload: { id_producto: idProd, origen: 'busqueda', duracion_seg: 42 } },
  { tipo: 'agregar_carrito', ts: new Date(), sesion_id: 'ses-demo', id_cliente: 99001, dispositivo: 'movil', payload: { id_producto: idProd, id_variante: 1, cantidad: 1 } }]);
print('insertados: ' + Object.keys(r.insertedIds).length);

titulo('C3. La validacion de esquema rechaza datos invalidos (calificacion = 7)');
try {
  bd.resenas.insertOne({ id_producto: idProd, id_cliente: 99002, calificacion: 7, comentario: 'invalida', fecha: new Date() });
  print('ERROR: debio fallar');
} catch (e) { print('Rechazado (codigo ' + e.code + '): ' + e.message.slice(0, 70)); }

titulo('C4. El indice unico impide dos resenas del mismo cliente al mismo producto');
try {
  bd.resenas.insertOne({ id_producto: idProd, id_cliente: 99001, calificacion: 3, comentario: 'duplicada', fecha: new Date() });
  print('ERROR: debio fallar');
} catch (e) { print('Rechazado (codigo ' + e.code + '): ' + e.message.slice(0, 70)); }

// ---------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------
titulo('R1. findOne por clave de negocio (id_producto) con proyeccion');
printjson(bd.catalogo_productos.findOne({ id_producto: idProd }, { _id: 0, id_producto: 1, nombre: 1, categoria: 1, 'atributos.material': 1, colores_disponibles: 1 }));

titulo('R2. find con filtro, orden y limite: 3 resenas mas utiles del producto');
bd.resenas.find({ id_producto: idProd, calificacion: { $gte: 4 } }, { _id: 0, calificacion: 1, titulo: 1, votos_utiles: 1 })
  .sort({ votos_utiles: -1 }).limit(3).forEach(printjson);

titulo('R3. countDocuments y distinct');
print('Resenas del producto: ' + bd.resenas.countDocuments({ id_producto: idProd }));
print('Categorias del catalogo: ' + bd.catalogo_productos.distinct('categoria').join(', '));

// ---------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------
titulo('U1. updateOne con $set e $inc (un voto util mas)');
r = bd.resenas.updateOne({ id_cliente: 99001, id_producto: idProd }, { $set: { titulo: 'Prueba CRUD (editada)' }, $inc: { votos_utiles: 1 } });
print('coincidencias: ' + r.matchedCount + ', modificados: ' + r.modifiedCount);

titulo('U2. $addToSet agrega una etiqueta sin duplicarla; $push agrega al arreglo');
bd.catalogo_productos.updateOne({ id_producto: idProd }, { $addToSet: { etiquetas: 'prueba-crud' } });
bd.catalogo_productos.updateOne({ id_producto: idProd }, { $addToSet: { etiquetas: 'prueba-crud' } });
print('etiquetas: ' + bd.catalogo_productos.findOne({ id_producto: idProd }).etiquetas.join(', '));

titulo('U3. upsert del carrito: crea si no existe, actualiza si existe');
bd.carritos.updateOne({ id_cliente: 99001 },
  { $set: { actualizado: new Date() }, $push: { items: { id_variante: 1, cantidad: 2, sku: 'DEMO-1', nombre: 'Prueba' } } }, { upsert: true });
bd.carritos.updateOne({ id_cliente: 99001 },
  { $set: { actualizado: new Date() }, $push: { items: { id_variante: 2, cantidad: 1, sku: 'DEMO-2', nombre: 'Prueba 2' } } }, { upsert: true });
print('items en el carrito: ' + bd.carritos.findOne({ id_cliente: 99001 }).items.length);

titulo('U4. updateOne con operador posicional: cambiar la cantidad de un item del carrito');
bd.carritos.updateOne({ id_cliente: 99001, 'items.id_variante': 2 }, { $set: { 'items.$.cantidad': 5 } });
printjson(bd.carritos.findOne({ id_cliente: 99001 }, { _id: 0, items: 1 }).items.map((i) => i.id_variante + 'x' + i.cantidad));

titulo('U5. updateMany: marcar con una bandera de demostracion los productos con 4+ colores');
r = bd.catalogo_productos.updateMany({ $expr: { $gte: [{ $size: '$colores_disponibles' }, 4] } }, { $set: { marca_demo_crud: true } });
print('productos actualizados: ' + r.modifiedCount);

titulo('U6. findOneAndUpdate: responder una resena y obtener el documento resultante');
const res = bd.resenas.findOneAndUpdate({ id_cliente: 99001, id_producto: idProd },
  { $set: { respuesta_tienda: { texto: 'Gracias por tu opinion.', fecha: new Date(), autor: 'Equipo de servicio' } } }, { returnDocument: 'after' });
print('respuesta guardada: ' + res.respuesta_tienda.texto);

// ---------------------------------------------------------------------
// DELETE (limpieza: deja la base como estaba)
// ---------------------------------------------------------------------
titulo('D1. deleteOne / deleteMany');
print('resenas borradas: ' + bd.resenas.deleteOne({ id_cliente: 99001 }).deletedCount);
print('eventos borrados: ' + bd.eventos_app.deleteMany({ sesion_id: 'ses-demo' }).deletedCount);
print('carritos borrados: ' + bd.carritos.deleteOne({ id_cliente: 99001 }).deletedCount);
bd.catalogo_productos.updateOne({ id_producto: idProd }, { $pull: { etiquetas: 'prueba-crud' } });
print('banderas de demostracion retiradas: ' + bd.catalogo_productos.updateMany({ marca_demo_crud: true }, { $unset: { marca_demo_crud: '' } }).modifiedCount);
