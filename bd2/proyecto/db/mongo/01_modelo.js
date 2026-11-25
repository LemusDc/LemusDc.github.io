// =====================================================================
// Proyecto Final Bases de Datos 2 - Tienda de Ropa
// Archivo : 01_modelo.js  (ejecutar con mongosh)
// Autores : Juan Diego Mateus, Diego Lemus
// Fecha   : 2026-11-04
// Descripcion: modelo documental en MongoDB. Crea la base, las colecciones
//   con validacion de esquema ($jsonSchema) y los indices.
//
// Que va en MongoDB y por que (resumen; ver documento de modelo documental):
//   catalogo_productos : atributos que cambian segun la categoria (esquema
//                        flexible), guia de tallas e imagenes embebidas.
//   resenas            : texto libre, fotos y respuestas; lectura masiva por producto.
//   eventos_app        : bitacora de navegacion; escritura de alto volumen,
//                        sin relaciones, con expiracion automatica (TTL).
//   carritos           : datos temporales y mutables que no requieren ACID.
//   imagenes (GridFS)  : archivos binarios del catalogo y de las resenas.
// Lo transaccional y monetario (pedidos, pagos, inventario, clientes)
// permanece en PostgreSQL, donde se garantizan ACID e integridad referencial.
//
// Uso: mongosh "mongodb://localhost:27017" --file 01_modelo.js
// =====================================================================
const bd = db.getSiblingDB('tienda_ropa_nosql');
bd.dropDatabase();

// ---------------------------------------------------------------------
// catalogo_productos: un documento por producto de PostgreSQL
// ---------------------------------------------------------------------
bd.createCollection('catalogo_productos', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['id_producto', 'nombre', 'categoria', 'marca', 'atributos', 'imagenes', 'actualizado'],
    properties: {
      id_producto: { bsonType: 'number', minimum: 1, description: 'Referencia a producto.id_producto en PostgreSQL' },
      nombre:      { bsonType: 'string', minLength: 2 },
      categoria:   { bsonType: 'string' },
      marca:       { bsonType: 'string' },
      genero:      { enum: ['MUJER', 'HOMBRE', 'NINA', 'NINO', 'UNISEX'] },
      atributos:   { bsonType: 'object', description: 'Estructura variable segun la categoria' },
      guia_tallas: { bsonType: 'object',
                     properties: { unidad: { enum: ['cm', 'in'] }, medidas: { bsonType: 'array' } } },
      imagenes:    { bsonType: 'array',
                     items: { bsonType: 'object', required: ['archivo_id', 'color', 'tipo'],
                              properties: { archivo_id: { bsonType: 'objectId' }, color: { bsonType: 'string' },
                                            tipo: { enum: ['principal', 'detalle', 'modelo'] },
                                            orden: { bsonType: 'number' }, alt: { bsonType: 'string' } } } },
      etiquetas:   { bsonType: 'array', items: { bsonType: 'string' } },
      destacado:   { bsonType: 'bool' },
      actualizado: { bsonType: 'date' }
    } } },
  validationLevel: 'strict', validationAction: 'error'
});
bd.catalogo_productos.createIndex({ id_producto: 1 }, { unique: true, name: 'uq_catalogo_producto' });
bd.catalogo_productos.createIndex({ categoria: 1, marca: 1 }, { name: 'idx_catalogo_categoria_marca' });
bd.catalogo_productos.createIndex({ 'atributos.material': 1 }, { name: 'idx_catalogo_material' });
bd.catalogo_productos.createIndex({ nombre: 'text', etiquetas: 'text', 'atributos.estilo': 'text' },
                                 { name: 'txt_catalogo', default_language: 'spanish', weights: { nombre: 10, etiquetas: 5 } });

// ---------------------------------------------------------------------
// resenas: opiniones de clientes (id_cliente e id_pedido referencian PostgreSQL)
// ---------------------------------------------------------------------
bd.createCollection('resenas', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['id_producto', 'id_cliente', 'calificacion', 'comentario', 'fecha'],
    properties: {
      id_producto:  { bsonType: 'number', minimum: 1 },
      id_cliente:   { bsonType: 'number', minimum: 1 },
      id_pedido:    { bsonType: 'number', minimum: 1 },
      calificacion: { bsonType: 'number', minimum: 1, maximum: 5, description: 'Entero de 1 a 5' },
      titulo:       { bsonType: 'string', maxLength: 120 },
      comentario:   { bsonType: 'string', minLength: 3, maxLength: 1000 },
      talla_comprada: { bsonType: 'string' },
      ajuste:       { enum: ['pequeno', 'justo', 'grande'] },
      fotos:        { bsonType: 'array', items: { bsonType: 'objectId' } },
      votos_utiles: { bsonType: 'number', minimum: 0 },
      verificada:   { bsonType: 'bool', description: 'true si proviene de una compra entregada' },
      respuesta_tienda: { bsonType: 'object', required: ['texto', 'fecha'],
                          properties: { texto: { bsonType: 'string' }, fecha: { bsonType: 'date' }, autor: { bsonType: 'string' } } },
      fecha:        { bsonType: 'date' }
    } } },
  validationLevel: 'strict', validationAction: 'error'
});
bd.resenas.createIndex({ id_producto: 1, fecha: -1 }, { name: 'idx_resenas_producto_fecha' });
bd.resenas.createIndex({ id_producto: 1, calificacion: -1 }, { name: 'idx_resenas_producto_calificacion' });
bd.resenas.createIndex({ id_cliente: 1, id_producto: 1 }, { unique: true, name: 'uq_resena_cliente_producto' });

// ---------------------------------------------------------------------
// eventos_app: bitacora de eventos de la tienda en linea (TTL de 400 dias)
// ---------------------------------------------------------------------
bd.createCollection('eventos_app', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['tipo', 'ts', 'sesion_id'],
    properties: {
      tipo: { enum: ['busqueda', 'vista_producto', 'agregar_carrito', 'inicio_checkout', 'pedido_creado',
                     'error_pago', 'login', 'resena_creada'] },
      ts:        { bsonType: 'date' },
      sesion_id: { bsonType: 'string' },
      id_cliente: { bsonType: 'number' },
      dispositivo: { enum: ['movil', 'escritorio', 'tablet'] },
      payload:   { bsonType: 'object', description: 'Contenido distinto segun el tipo de evento' }
    } } },
  validationLevel: 'strict', validationAction: 'error'
});
bd.eventos_app.createIndex({ ts: 1 }, { name: 'ttl_eventos_ts', expireAfterSeconds: 400 * 24 * 3600 });
bd.eventos_app.createIndex({ tipo: 1, ts: -1 }, { name: 'idx_eventos_tipo_ts' });
bd.eventos_app.createIndex({ 'payload.id_producto': 1, ts: -1 }, { name: 'idx_eventos_producto_ts', sparse: true });
bd.eventos_app.createIndex({ sesion_id: 1, ts: 1 }, { name: 'idx_eventos_sesion' });

// ---------------------------------------------------------------------
// carritos: un carrito activo por cliente; expira a los 30 dias sin actividad
// ---------------------------------------------------------------------
bd.createCollection('carritos', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['id_cliente', 'items', 'actualizado'],
    properties: {
      id_cliente: { bsonType: 'number', minimum: 1 },
      items: { bsonType: 'array',
               items: { bsonType: 'object', required: ['id_variante', 'cantidad'],
                        properties: { id_variante: { bsonType: 'number', minimum: 1 },
                                      cantidad: { bsonType: 'number', minimum: 1, maximum: 20 },
                                      sku: { bsonType: 'string' }, nombre: { bsonType: 'string' },
                                      precio_ref: { bsonType: 'number' } } } },
      actualizado: { bsonType: 'date' }
    } } },
  validationLevel: 'strict', validationAction: 'error'
});
bd.carritos.createIndex({ id_cliente: 1 }, { unique: true, name: 'uq_carrito_cliente' });
bd.carritos.createIndex({ actualizado: 1 }, { name: 'ttl_carrito', expireAfterSeconds: 30 * 24 * 3600 });

print('Base tienda_ropa_nosql creada con colecciones: ' + bd.getCollectionNames().join(', '));
