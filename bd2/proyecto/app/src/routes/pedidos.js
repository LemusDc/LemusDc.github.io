// Pedidos: toda escritura pasa por procedimientos almacenados de PostgreSQL
const router = require('express').Router();
const db = require('../db');
const { requiereSesion, requiereRol, asincrono, entero, texto, pagina } = require('../auth');

router.use(requiereRol('ADMIN', 'VENDEDOR'));
const ESTADOS = ['CREADO', 'PAGADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
const METODOS = ['EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'PSE', 'NEQUI', 'TRANSFERENCIA'];
const MOTIVOS = ['TALLA_INCORRECTA', 'DEFECTO', 'NO_ME_GUSTO', 'ERROR_ENVIO', 'OTRO'];
const POR_PAGINA = 15;

// El vendedor solo opera sobre pedidos de su sucursal (misma regla que la politica RLS de la base)
const puedeOperar = (u, pedido) => u.rol === 'ADMIN' || pedido.id_sucursal === u.id_sucursal;

router.get('/pedidos', asincrono(async (req, res) => {
  const u = req.session.usuario; const donde = ['TRUE']; const p = [];
  if (u.rol === 'VENDEDOR') { p.push(u.id_sucursal); donde.push(`id_sucursal = $${p.length}`); }
  else if (entero(req.query.sucursal)) { p.push(entero(req.query.sucursal)); donde.push(`id_sucursal = $${p.length}`); }
  if (ESTADOS.includes(req.query.estado)) { p.push(req.query.estado); donde.push(`estado = $${p.length}`); }
  if (['TIENDA', 'ONLINE'].includes(req.query.canal)) { p.push(req.query.canal); donde.push(`canal = $${p.length}`); }
  const q = texto(req.query.q, 60);
  if (q) { p.push(q); const n = p.length; donde.push(`(position(fn_normalizar($${n}) in fn_normalizar(cliente)) > 0 OR id_pedido::text = $${n})`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || '')) { p.push(req.query.desde); donde.push(`fecha_pedido >= $${p.length}::date`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || '')) { p.push(req.query.hasta); donde.push(`fecha_pedido < $${p.length}::date + 1`); }
  const pag = pagina(req.query.pagina); const filtro = donde.join(' AND ');
  const [{ total }] = await db.consultar(`SELECT count(*)::int AS total FROM vw_pedidos WHERE ${filtro}`, p);
  const pedidos = await db.consultar(`SELECT id_pedido, fecha_pedido, estado, canal, tipo_entrega, cliente, sucursal, total, metodo_pago
      FROM vw_pedidos WHERE ${filtro} ORDER BY fecha_pedido DESC, id_pedido DESC LIMIT ${POR_PAGINA} OFFSET ${(pag - 1) * POR_PAGINA}`, p);
  res.json({ total, pagina: pag, por_pagina: POR_PAGINA, pedidos });
}));

router.get('/pedidos/:id', asincrono(async (req, res) => {
  const id = entero(req.params.id); if (!id) return res.status(400).json({ ok: false, mensaje: 'Pedido invalido' });
  const [pedido] = await db.consultar('SELECT * FROM vw_pedidos WHERE id_pedido = $1', [id]);
  if (!pedido || !puedeOperar(req.session.usuario, pedido)) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });
  const [lineas, pagos] = await Promise.all([
    db.consultar('SELECT * FROM vw_detalle_pedido WHERE id_pedido = $1 ORDER BY num_linea', [id]),
    db.consultar('SELECT metodo, monto, estado, fecha_pago, referencia_externa FROM vw_pagos WHERE id_pedido = $1 ORDER BY id_pago', [id])]);
  res.json({ pedido, lineas, pagos });
}));

router.post('/pedidos', requiereRol('ADMIN', 'VENDEDOR'), asincrono(async (req, res) => {
  const b = req.body || {}; const u = req.session.usuario;
  const canal = ['TIENDA', 'ONLINE'].includes(b.canal) ? b.canal : null;
  const tipo = ['VENTA_MOSTRADOR', 'DOMICILIO', 'RECOGER_EN_TIENDA'].includes(b.tipo_entrega) ? b.tipo_entrega : null;
  const metodo = METODOS.includes(b.metodo_pago) ? b.metodo_pago : null;
  const idCliente = entero(b.id_cliente);
  let idSucursal = entero(b.id_sucursal);
  if (u.rol === 'VENDEDOR' && canal === 'TIENDA') idSucursal = u.id_sucursal;
  if (!canal || !tipo || !metodo || !idCliente || !idSucursal) return res.status(422).json({ ok: false, mensaje: 'Cliente, sucursal, canal, tipo de entrega y metodo de pago son obligatorios' });

  let items = b.items;
  if (b.desde_carrito === true) {
    const carrito = await db.mongo('findOne', 'carritos', { id_cliente: idCliente }, (c) => c.findOne({ id_cliente: idCliente }));
    items = carrito ? carrito.items.map((i) => ({ id_variante: i.id_variante, cantidad: i.cantidad })) : [];
  }
  if (!Array.isArray(items) || items.length > 30) return res.status(422).json({ ok: false, mensaje: 'El pedido debe tener entre 1 y 30 productos' });
  items = items.map((i) => ({ id_variante: entero(i.id_variante), cantidad: entero(i.cantidad, 1, 20) }));
  if (items.some((i) => !i.id_variante || !i.cantidad)) return res.status(422).json({ ok: false, mensaje: 'Cada producto requiere variante y cantidad entre 1 y 20' });

  const f = await db.llamar('sp_crear_pedido', [idCliente, idSucursal, canal === 'TIENDA' ? u.id : null, canal, tipo, entero(b.id_direccion),
    JSON.stringify(items), metodo], 3, { 6: 'jsonb' });
  const { status, cuerpo } = db.respuestaProcedimiento(f, { id_pedido: f.p_id_pedido });
  if (cuerpo.ok) {
    await db.mongo('deleteOne', 'carritos', { id_cliente: idCliente }, (c) => c.deleteOne({ id_cliente: idCliente }));
    const [ped] = await db.consultar('SELECT total FROM vw_pedidos WHERE id_pedido = $1', [f.p_id_pedido]);
    db.mongo('insertOne', 'eventos_app', { tipo: 'pedido_creado' }, (c) => c.insertOne({ tipo: 'pedido_creado', ts: new Date(), sesion_id: req.sessionID,
      id_cliente: idCliente, dispositivo: 'escritorio', payload: { id_pedido: f.p_id_pedido, valor_estimado: Number(ped.total), canal } })).catch(() => {});
  }
  res.status(status).json(cuerpo);
}));

async function pedidoOperable(req, res) {
  const id = entero(req.params.id);
  if (!id) { res.status(400).json({ ok: false, mensaje: 'Pedido invalido' }); return null; }
  const [ped] = await db.consultar('SELECT id_pedido, id_sucursal FROM vw_pedidos WHERE id_pedido = $1', [id]);
  if (!ped || !puedeOperar(req.session.usuario, ped)) { res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' }); return null; }
  return id;
}

router.post('/pedidos/:id/estado', requiereRol('ADMIN', 'VENDEDOR'), asincrono(async (req, res) => {
  const id = await pedidoOperable(req, res); if (!id) return;
  const estado = ESTADOS.includes((req.body || {}).estado) ? req.body.estado : null;
  if (!estado) return res.status(422).json({ ok: false, mensaje: 'Estado invalido' });
  const f = await db.llamar('sp_cambiar_estado_pedido', [id, estado], 2);
  const { status, cuerpo } = db.respuestaProcedimiento(f);
  res.status(status).json(cuerpo);
}));

router.post('/pedidos/:id/devoluciones', requiereRol('ADMIN', 'VENDEDOR'), asincrono(async (req, res) => {
  const id = await pedidoOperable(req, res); if (!id) return;
  const b = req.body || {}; const motivo = MOTIVOS.includes(b.motivo) ? b.motivo : null;
  if (!motivo || !entero(b.num_linea) || !entero(b.cantidad)) return res.status(422).json({ ok: false, mensaje: 'Linea, cantidad y motivo son obligatorios' });
  const f = await db.llamar('sp_registrar_devolucion', [id, entero(b.num_linea), entero(b.cantidad), motivo], 3);
  const { status, cuerpo } = db.respuestaProcedimiento(f, { id_devolucion: f.p_id_devolucion });
  res.status(status).json(cuerpo);
}));

module.exports = router;
