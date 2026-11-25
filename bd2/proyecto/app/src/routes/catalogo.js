// Catalogo: datos transaccionales de PostgreSQL + ficha, resenas e imagenes de MongoDB.
const router = require('express').Router();
const { ObjectId } = require('mongodb');
const multer = require('multer');
const db = require('../db');
const evidencia = require('../evidencia');
const { requiereSesion, requiereRol, asincrono, entero, texto, pagina } = require('../auth');

router.use(requiereSesion);

const GENEROS = ['MUJER', 'HOMBRE', 'NINA', 'NINO', 'UNISEX'];
const POR_PAGINA = 12;
const subidas = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, f, cb) => cb(null, ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(f.mimetype)) });

const idObjeto = (v) => (typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v) ? new ObjectId(v) : null);

// Recalcula el resumen de calificaciones de un producto (vista materializada en MongoDB)
async function recalcularResumen(idProducto) {
  await db.mongo('aggregate', 'resenas', { $match: { id_producto: idProducto }, $merge: 'resumen_calificaciones' }, (c) => c.aggregate([
    { $match: { id_producto: idProducto } },
    { $group: { _id: '$id_producto', promedio: { $avg: '$calificacion' }, resenas: { $sum: 1 }, ultima: { $max: '$fecha' } } },
    { $project: { promedio: { $round: ['$promedio', 2] }, resenas: 1, ultima: 1 } },
    { $merge: { into: 'resumen_calificaciones', on: '_id', whenMatched: 'replace', whenNotMatched: 'insert' } }]).toArray());
  const quedan = await db.bd.collection('resenas').countDocuments({ id_producto: idProducto });
  if (quedan === 0) await db.mongo('deleteOne', 'resumen_calificaciones', { _id: idProducto }, (c) => c.deleteOne({ _id: idProducto }));
}

// Nombre publico de un cliente: "Camila R."
async function nombresPublicos(ids) {
  if (!ids.length) return new Map();
  const filas = await db.consultar('SELECT id_cliente, nombres, apellidos FROM vw_clientes WHERE id_cliente = ANY($1::int[])', [ids]);
  return new Map(filas.map((f) => [f.id_cliente, `${f.nombres.split(' ')[0]} ${f.apellidos.charAt(0)}.`]));
}

router.get('/catalogos', asincrono(async (req, res) => {
  const [sucursales, ciudades, marcas, categorias] = await Promise.all([
    db.consultar('SELECT id_sucursal, nombre, tipo FROM sucursal WHERE activa ORDER BY id_sucursal'),
    db.consultar('SELECT id_ciudad, nombre FROM ciudad ORDER BY nombre'),
    db.consultar('SELECT id_marca, nombre FROM marca ORDER BY nombre'),
    db.consultar('SELECT id_categoria, nombre, nivel, ruta FROM vw_categorias ORDER BY ruta')]);
  res.json({ sucursales, ciudades, marcas, categorias });
}));

router.get('/catalogo', asincrono(async (req, res) => {
  const donde = ['activo']; const p = [];
  const q = texto(req.query.q, 60);
  if (q) { p.push(q); donde.push(`position(fn_normalizar($${p.length}) in fn_normalizar(nombre)) > 0`); }
  const cat = entero(req.query.categoria);
  if (cat) { p.push(cat); donde.push(`id_categoria IN (WITH RECURSIVE a AS (SELECT id_categoria FROM categoria WHERE id_categoria = $${p.length}
     UNION ALL SELECT c.id_categoria FROM categoria c JOIN a ON c.id_categoria_padre = a.id_categoria) SELECT id_categoria FROM a)`); }
  const marca = entero(req.query.marca);
  if (marca) { p.push(marca); donde.push(`id_marca = $${p.length}`); }
  if (GENEROS.includes(req.query.genero)) { p.push(req.query.genero); donde.push(`genero = $${p.length}`); }
  if (req.query.promo === '1') donde.push('descuento_vigente > 0');
  const pag = pagina(req.query.pagina);
  const filtro = donde.join(' AND ');
  const [{ total }] = await db.consultar(`SELECT count(*)::int AS total FROM vw_catalogo WHERE ${filtro}`, p);
  const filas = await db.consultar(`SELECT id_producto, nombre, genero, categoria, marca, precio_base, descuento_vigente, precio_final, num_variantes, stock_total
      FROM vw_catalogo WHERE ${filtro} ORDER BY nombre, id_producto LIMIT ${POR_PAGINA} OFFSET ${(pag - 1) * POR_PAGINA}`, p);
  const ids = filas.map((f) => f.id_producto);
  const [docs, resumenes] = ids.length ? await Promise.all([
    db.mongo('find', 'catalogo_productos', { id_producto: { $in: ids } }, (c) => c.find({ id_producto: { $in: ids } }, { projection: { id_producto: 1, imagenes: { $slice: 1 } } }).toArray()),
    db.mongo('find', 'resumen_calificaciones', { _id: { $in: ids } }, (c) => c.find({ _id: { $in: ids } }).toArray())]) : [[], []];
  const imagen = new Map(docs.map((d) => [d.id_producto, d.imagenes && d.imagenes[0] ? d.imagenes[0].archivo_id : null]));
  const resumen = new Map(resumenes.map((r) => [r._id, r]));
  res.json({ total, pagina: pag, por_pagina: POR_PAGINA,
    productos: filas.map((f) => ({ ...f, imagen_id: imagen.get(f.id_producto) || null,
      promedio: resumen.has(f.id_producto) ? resumen.get(f.id_producto).promedio : null,
      resenas: resumen.has(f.id_producto) ? resumen.get(f.id_producto).resenas : 0 })) });
}));

router.get('/productos/:id', asincrono(async (req, res) => {
  const id = entero(req.params.id); if (!id) return res.status(400).json({ ok: false, mensaje: 'Producto invalido' });
  const [prod] = await db.consultar('SELECT * FROM vw_catalogo WHERE id_producto = $1', [id]);
  if (!prod) return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' });
  const stock = await db.consultar(`SELECT id_variante, sku, talla, color, id_sucursal, sucursal, tipo_sucursal, stock, stock_minimo
      FROM vw_variantes_stock WHERE id_producto = $1 AND activa ORDER BY color, talla, id_sucursal`, [id]);
  const mapa = new Map();
  for (const s of stock) {
    if (!mapa.has(s.id_variante)) mapa.set(s.id_variante, { id_variante: s.id_variante, sku: s.sku, talla: s.talla, color: s.color, total: 0, por_sucursal: [] });
    const v = mapa.get(s.id_variante); v.total += s.stock; v.por_sucursal.push({ id_sucursal: s.id_sucursal, sucursal: s.sucursal, stock: s.stock });
  }
  const [ficha, resumen, resenas] = await Promise.all([
    db.mongo('findOne', 'catalogo_productos', { id_producto: id }, (c) => c.findOne({ id_producto: id })),
    db.mongo('findOne', 'resumen_calificaciones', { _id: id }, (c) => c.findOne({ _id: id })),
    db.mongo('find', 'resenas', { id_producto: id }, (c) => c.find({ id_producto: id }).sort({ fecha: -1 }).limit(5).toArray())]);
  const nombres = await nombresPublicos([...new Set(resenas.map((r) => r.id_cliente))]);
  db.mongo('insertOne', 'eventos_app', { tipo: 'vista_producto', id_producto: id }, (c) => c.insertOne({
    tipo: 'vista_producto', ts: new Date(), sesion_id: req.sessionID, dispositivo: 'escritorio',
    payload: { id_producto: id, origen: 'catalogo', duracion_seg: 0 } })).catch(() => {});
  res.json({ producto: prod, variantes: [...mapa.values()], ficha, resumen,
    resenas: resenas.map((r) => ({ ...r, cliente: nombres.get(r.id_cliente) || 'Cliente' })) });
}));

const ORDENES = { recientes: { fecha: -1 }, utiles: { votos_utiles: -1, fecha: -1 }, mejores: { calificacion: -1, fecha: -1 }, peores: { calificacion: 1, fecha: -1 } };
router.get('/productos/:id/resenas', asincrono(async (req, res) => {
  const id = entero(req.params.id); if (!id) return res.status(400).json({ ok: false, mensaje: 'Producto invalido' });
  const pag = pagina(req.query.pagina); const orden = ORDENES[req.query.orden] || ORDENES.recientes;
  const filtro = { id_producto: id }; const estrellas = entero(req.query.estrellas, 1, 5);
  if (estrellas) filtro.calificacion = estrellas;
  const [total, filas] = await Promise.all([
    db.mongo('countDocuments', 'resenas', filtro, (c) => c.countDocuments(filtro)),
    db.mongo('find', 'resenas', { ...filtro, sort: orden, skip: (pag - 1) * 10 }, (c) => c.find(filtro).sort(orden).skip((pag - 1) * 10).limit(10).toArray())]);
  const nombres = await nombresPublicos([...new Set(filas.map((r) => r.id_cliente))]);
  res.json({ total, pagina: pag, resenas: filas.map((r) => ({ ...r, cliente: nombres.get(r.id_cliente) || 'Cliente' })) });
}));

router.post('/productos/:id/resenas', requiereRol('ADMIN', 'VENDEDOR'), asincrono(async (req, res) => {
  const id = entero(req.params.id); const b = req.body || {};
  const idCliente = entero(b.id_cliente); const cal = entero(b.calificacion, 1, 5); const comentario = texto(b.comentario, 1000);
  if (!id || !idCliente || !cal || !comentario || comentario.length < 3) return res.status(422).json({ ok: false, mensaje: 'Cliente, calificacion (1 a 5) y comentario (minimo 3 caracteres) son obligatorios' });
  const compra = await db.consultar(`SELECT p.id_pedido FROM vw_detalle_pedido d JOIN vw_pedidos p ON p.id_pedido = d.id_pedido
      JOIN vw_catalogo c ON c.nombre = d.producto WHERE p.id_cliente = $1 AND c.id_producto = $2 AND p.estado = 'ENTREGADO'
      ORDER BY p.fecha_pedido DESC LIMIT 1`, [idCliente, id]);
  if (!compra.length) return res.status(422).json({ ok: false, mensaje: 'Solo pueden opinar los clientes con una compra ENTREGADA de este producto' });
  const doc = { id_producto: id, id_cliente: idCliente, id_pedido: compra[0].id_pedido, calificacion: cal, comentario, votos_utiles: 0, verificada: true, fecha: new Date() };
  if (texto(b.titulo, 120)) doc.titulo = texto(b.titulo, 120);
  if (texto(b.talla_comprada, 10)) doc.talla_comprada = texto(b.talla_comprada, 10);
  if (['pequeno', 'justo', 'grande'].includes(b.ajuste)) doc.ajuste = b.ajuste;
  try {
    const r = await db.mongo('insertOne', 'resenas', doc, (c) => c.insertOne(doc));
    await recalcularResumen(id);
    db.mongo('insertOne', 'eventos_app', { tipo: 'resena_creada' }, (c) => c.insertOne({ tipo: 'resena_creada', ts: new Date(), sesion_id: req.sessionID,
      id_cliente: idCliente, dispositivo: 'escritorio', payload: { id_producto: id, calificacion: cal } })).catch(() => {});
    res.status(201).json({ ok: true, mensaje: 'Resena publicada', id: r.insertedId });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ ok: false, mensaje: 'Este cliente ya opino sobre el producto' });
    if (e.code === 121) return res.status(422).json({ ok: false, mensaje: 'La resena no cumple el esquema de validacion' });
    throw e;
  }
}));

router.post('/resenas/:id/respuesta', requiereRol('ADMIN', 'VENDEDOR'), asincrono(async (req, res) => {
  const oid = idObjeto(req.params.id); const t = texto((req.body || {}).texto, 500);
  if (!oid || !t) return res.status(422).json({ ok: false, mensaje: 'Respuesta invalida' });
  const r = await db.mongo('updateOne', 'resenas', { _id: String(oid), respuesta: t }, (c) => c.updateOne({ _id: oid },
    { $set: { respuesta_tienda: { texto: t, fecha: new Date(), autor: req.session.usuario.nombre } } }));
  if (!r.matchedCount) return res.status(404).json({ ok: false, mensaje: 'Resena no encontrada' });
  res.json({ ok: true, mensaje: 'Respuesta publicada' });
}));

router.delete('/resenas/:id', requiereRol('ADMIN'), asincrono(async (req, res) => {
  const oid = idObjeto(req.params.id); if (!oid) return res.status(422).json({ ok: false, mensaje: 'Identificador invalido' });
  const previa = await db.mongo('findOne', 'resenas', { _id: String(oid) }, (c) => c.findOne({ _id: oid }, { projection: { id_producto: 1 } }));
  if (!previa) return res.status(404).json({ ok: false, mensaje: 'Resena no encontrada' });
  await db.mongo('deleteOne', 'resenas', { _id: String(oid) }, (c) => c.deleteOne({ _id: oid }));
  await recalcularResumen(previa.id_producto);
  res.json({ ok: true, mensaje: 'Resena eliminada' });
}));

// Imagenes en GridFS. Se sirven con CSP "sandbox" para que un SVG nunca ejecute scripts.
router.get('/imagenes/:id', asincrono(async (req, res) => {
  const oid = idObjeto(req.params.id); if (!oid) return res.status(400).end();
  const archivo = await db.bd.collection('imagenes.files').findOne({ _id: oid });
  if (!archivo) return res.status(404).end();
  res.set({ 'Content-Type': (archivo.metadata && archivo.metadata.contentType) || archivo.contentType || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox", 'Cache-Control': 'private, max-age=3600' });
  db.bucket.openDownloadStream(oid).on('error', () => res.end()).pipe(res);
}));

router.post('/productos/:id/imagenes', requiereRol('ADMIN'), subidas.single('imagen'), asincrono(async (req, res) => {
  const id = entero(req.params.id); const color = texto((req.body || {}).color, 30); const tipo = ['principal', 'detalle', 'modelo'].includes(req.body.tipo) ? req.body.tipo : 'principal';
  if (!id || !color) return res.status(422).json({ ok: false, mensaje: 'Producto y color son obligatorios' });
  if (!req.file) return res.status(422).json({ ok: false, mensaje: 'Adjunte una imagen PNG, JPG, WEBP o SVG de maximo 2 MB' });
  const ficha = await db.mongo('findOne', 'catalogo_productos', { id_producto: id }, (c) => c.findOne({ id_producto: id }, { projection: { nombre: 1, imagenes: 1 } }));
  if (!ficha) return res.status(404).json({ ok: false, mensaje: 'El producto no tiene ficha en el catalogo documental' });
  const archivoId = await new Promise((resolve, reject) => {
    const up = db.bucket.openUploadStream(`prod${id}-${color.toLowerCase()}-${tipo}`, { metadata: { contentType: req.file.mimetype, id_producto: id, color, tipo } });
    up.on('finish', () => resolve(up.id)); up.on('error', reject); up.end(req.file.buffer);
  });
  const img = { archivo_id: archivoId, color, tipo, orden: (ficha.imagenes || []).length + 1, alt: `${ficha.nombre} color ${color}` };
  await db.mongo('updateOne', 'catalogo_productos', { id_producto: id, $push: { imagenes: { archivo_id: String(archivoId), color, tipo } } },
    (c) => c.updateOne({ id_producto: id }, { $push: { imagenes: img }, $set: { actualizado: new Date() } }));
  evidencia.registrar({ motor: 'MongoDB', tipo: 'GridFS.upload', sentencia: 'bucket(imagenes).openUploadStream', parametros: { id_producto: id, color, tipo, bytes: req.file.size }, ms: 0, resultado: { archivo_id: String(archivoId) } });
  res.status(201).json({ ok: true, mensaje: 'Imagen guardada en GridFS', archivo_id: archivoId });
}));

module.exports = router;
