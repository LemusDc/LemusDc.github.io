// Inventario, kardex y operaciones de stock (procedimientos almacenados)
const router = require('express').Router();
const db = require('../db');
const { requiereSesion, requiereRol, asincrono, entero, texto } = require('../auth');

router.use(requiereSesion);

router.get('/inventario/buscar', asincrono(async (req, res) => {
  const q = texto(req.query.q, 60); const suc = entero(req.query.sucursal); const p = []; const donde = ['activa'];
  if (q) { p.push(q); donde.push(`position(fn_normalizar($${p.length}) in fn_normalizar(sku || ' ' || producto || ' ' || color)) > 0`); }
  if (suc) { p.push(suc); donde.push(`id_sucursal = $${p.length}`); }
  const filas = await db.consultar(`SELECT v.id_variante, v.sku, v.producto, v.talla, v.color, v.id_sucursal, v.sucursal, v.stock, v.stock_minimo, v.stock_bajo, c.precio_final
      FROM vw_variantes_stock v JOIN vw_catalogo c ON c.id_producto = v.id_producto WHERE ${donde.join(' AND ').replace(/\b(activa|sku|producto|color|id_sucursal)\b/g, 'v.$1')}
      ORDER BY v.producto, v.color, v.talla, v.id_sucursal LIMIT 60`, p);
  res.json({ filas });
}));

router.get('/inventario/bajo', asincrono(async (req, res) => {
  const suc = entero(req.query.sucursal); const p = []; let donde = 'TRUE';
  if (suc) { p.push(suc); donde = 'id_sucursal = $1'; }
  const [{ total }] = await db.consultar(`SELECT count(*)::int AS total FROM vw_stock_bajo WHERE ${donde}`, p);
  const filas = await db.consultar(`SELECT id_variante, sku, producto, talla, color, id_sucursal, sucursal, stock, stock_minimo
      FROM vw_stock_bajo WHERE ${donde} ORDER BY stock, sucursal, producto LIMIT 50`, p);
  res.json({ total, filas });
}));

router.get('/kardex', asincrono(async (req, res) => {
  const sku = texto(req.query.sku, 40); if (!sku) return res.status(422).json({ ok: false, mensaje: 'Indique el SKU' });
  const filas = await db.consultar(`SELECT fecha, sucursal, tipo, cantidad, stock_resultante, usuario_bd FROM vw_kardex WHERE sku = $1
      ORDER BY id_movimiento DESC LIMIT 40`, [sku]);
  res.json({ filas });
}));

router.post('/inventario/ajuste', requiereRol('ADMIN'), asincrono(async (req, res) => {
  const b = req.body || {};
  const delta = Number.isInteger(b.delta) ? b.delta : null;
  const f = await db.llamar('sp_ajustar_stock', [entero(b.id_sucursal), entero(b.id_variante), delta, texto(b.tipo, 20)], 2);
  const { status, cuerpo } = db.respuestaProcedimiento(f); res.status(status).json(cuerpo);
}));

router.post('/inventario/transferencia', requiereRol('ADMIN'), asincrono(async (req, res) => {
  const b = req.body || {};
  const f = await db.llamar('sp_transferir_stock', [entero(b.origen), entero(b.destino), entero(b.id_variante), entero(b.cantidad)], 2);
  const { status, cuerpo } = db.respuestaProcedimiento(f); res.status(status).json(cuerpo);
}));

router.post('/inventario/reposicion', requiereRol('ADMIN'), asincrono(async (req, res) => {
  const b = req.body || {};
  const f = await db.llamar('sp_reponer_stock_bajo', [entero(b.destino), entero(b.origen)], 3);
  const { status, cuerpo } = db.respuestaProcedimiento(f, { transferidas: f.p_transferidas }); res.status(status).json(cuerpo);
}));

module.exports = router;
