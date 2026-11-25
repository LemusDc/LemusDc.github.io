// Clientes, direcciones y carrito (el carrito vive en MongoDB; el cliente y sus direcciones en PostgreSQL)
const router = require('express').Router();
const db = require('../db');
const { requiereSesion, requiereRol, asincrono, entero, texto, pagina } = require('../auth');

router.use(requiereRol('ADMIN', 'VENDEDOR'));
const POR_PAGINA = 15;

router.get('/clientes', asincrono(async (req, res) => {
  const q = texto(req.query.q, 60); const pag = pagina(req.query.pagina); const p = []; let donde = 'TRUE';
  if (q) { p.push(q); donde = `(position(fn_normalizar($1) in fn_normalizar(nombre_completo)) > 0 OR documento = $1 OR position(fn_normalizar($1) in fn_normalizar(email)) > 0)`; }
  const [{ total }] = await db.consultar(`SELECT count(*)::int AS total FROM vw_clientes WHERE ${donde}`, p);
  const clientes = await db.consultar(`SELECT id_cliente, tipo_documento, documento, nombre_completo, email, telefono, puntos, nivel, num_pedidos, activo
      FROM vw_clientes WHERE ${donde} ORDER BY nombre_completo, id_cliente LIMIT ${POR_PAGINA} OFFSET ${(pag - 1) * POR_PAGINA}`, p);
  res.json({ total, pagina: pag, por_pagina: POR_PAGINA, clientes });
}));

router.get('/clientes/:id', asincrono(async (req, res) => {
  const id = entero(req.params.id); if (!id) return res.status(400).json({ ok: false, mensaje: 'Cliente invalido' });
  const [cliente] = await db.consultar('SELECT * FROM vw_clientes WHERE id_cliente = $1', [id]);
  if (!cliente) return res.status(404).json({ ok: false, mensaje: 'Cliente no encontrado' });
  const [direcciones, pedidos, carrito] = await Promise.all([
    db.consultar('SELECT id_direccion, alias, direccion, ciudad, es_principal FROM vw_direcciones WHERE id_cliente = $1 ORDER BY es_principal DESC, id_direccion', [id]),
    db.consultar('SELECT id_pedido, fecha_pedido, estado, canal, total FROM vw_pedidos WHERE id_cliente = $1 ORDER BY fecha_pedido DESC LIMIT 8', [id]),
    db.mongo('findOne', 'carritos', { id_cliente: id }, (c) => c.findOne({ id_cliente: id }))]);
  res.json({ cliente, direcciones, pedidos, carrito });
}));

router.post('/clientes', requiereRol('ADMIN', 'VENDEDOR'), asincrono(async (req, res) => {
  const b = req.body || {};
  const f = await db.llamar('sp_registrar_cliente', [texto(b.tipo_documento, 3), texto(b.documento, 20), texto(b.nombres, 80), texto(b.apellidos, 80),
    texto(b.email, 120), texto(b.telefono, 20)], 3);
  const { status, cuerpo } = db.respuestaProcedimiento(f, { id_cliente: f.p_id_cliente });
  res.status(status).json(cuerpo);
}));

router.post('/clientes/:id/direcciones', requiereRol('ADMIN', 'VENDEDOR'), asincrono(async (req, res) => {
  const id = entero(req.params.id); const b = req.body || {};
  const f = await db.llamar('sp_agregar_direccion', [id, texto(b.alias, 40), texto(b.direccion, 200), entero(b.id_ciudad), b.es_principal === true, texto(b.telefono, 20)], 3);
  const { status, cuerpo } = db.respuestaProcedimiento(f, { id_direccion: f.p_id_direccion });
  res.status(status).json(cuerpo);
}));

// ---- Carrito (MongoDB) ----
router.get('/clientes/:id/carrito', asincrono(async (req, res) => {
  const id = entero(req.params.id); if (!id) return res.status(400).json({ ok: false, mensaje: 'Cliente invalido' });
  const carrito = await db.mongo('findOne', 'carritos', { id_cliente: id }, (c) => c.findOne({ id_cliente: id }));
  res.json({ carrito: carrito || { id_cliente: id, items: [] } });
}));

router.put('/clientes/:id/carrito', requiereRol('ADMIN', 'VENDEDOR'), asincrono(async (req, res) => {
  const id = entero(req.params.id); const items = (req.body || {}).items;
  if (!id || !Array.isArray(items) || items.length > 30) return res.status(422).json({ ok: false, mensaje: 'Carrito invalido' });
  const limpios = items.map((i) => ({ id_variante: entero(i.id_variante), cantidad: entero(i.cantidad, 1, 20) }));
  if (limpios.some((i) => !i.id_variante || !i.cantidad)) return res.status(422).json({ ok: false, mensaje: 'Cada item requiere variante y cantidad entre 1 y 20' });
  const [cli] = await db.consultar('SELECT 1 FROM vw_clientes WHERE id_cliente = $1', [id]);
  if (!cli) return res.status(404).json({ ok: false, mensaje: 'Cliente no encontrado' });
  if (limpios.length === 0) {
    await db.mongo('deleteOne', 'carritos', { id_cliente: id }, (c) => c.deleteOne({ id_cliente: id }));
    return res.json({ ok: true, carrito: { id_cliente: id, items: [] } });
  }
  const ids = [...new Set(limpios.map((i) => i.id_variante))];
  const info = await db.consultar('SELECT DISTINCT id_variante, sku, producto FROM vw_variantes_stock WHERE id_variante = ANY($1::int[])', [ids]);
  const mapa = new Map(info.map((v) => [v.id_variante, v]));
  if (ids.some((v) => !mapa.has(v))) return res.status(422).json({ ok: false, mensaje: 'Alguna variante no existe' });
  const doc = { items: limpios.map((i) => ({ ...i, sku: mapa.get(i.id_variante).sku, nombre: mapa.get(i.id_variante).producto })), actualizado: new Date() };
  await db.mongo('updateOne', 'carritos', { id_cliente: id, upsert: true }, (c) => c.updateOne({ id_cliente: id }, { $set: doc }, { upsert: true }));
  db.mongo('insertOne', 'eventos_app', { tipo: 'agregar_carrito' }, (c) => c.insertOne({ tipo: 'agregar_carrito', ts: new Date(), sesion_id: req.sessionID,
    id_cliente: id, dispositivo: 'escritorio', payload: { items: doc.items.length } })).catch(() => {});
  res.json({ ok: true, carrito: { id_cliente: id, ...doc } });
}));

module.exports = router;
