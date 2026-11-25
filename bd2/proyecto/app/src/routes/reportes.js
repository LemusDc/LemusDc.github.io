// Reportes: indicadores de PostgreSQL combinados con analitica de MongoDB
const router = require('express').Router();
const db = require('../db');
const { requiereRol, asincrono, entero } = require('../auth');

router.use(requiereRol('ADMIN', 'ANALISTA'));

router.get('/reportes/resumen', asincrono(async (req, res) => {
  const [[v], [ped], [bajo], [oro], rating, sesiones] = await Promise.all([
    db.consultar('SELECT fn_ventas_netas(current_date - 29, current_date) AS actual, fn_ventas_netas(current_date - 59, current_date - 30) AS anterior'),
    db.consultar("SELECT count(*)::int AS n FROM vw_pedidos WHERE fecha_pedido >= now() - interval '30 days' AND estado <> 'CANCELADO'"),
    db.consultar('SELECT count(*)::int AS n FROM vw_stock_bajo'),
    db.consultar("SELECT count(*)::int AS n FROM vw_clientes WHERE nivel = 'ORO'"),
    db.mongo('aggregate', 'resenas', { $group: { _id: null, promedio: { $avg: '$calificacion' }, resenas: { $sum: 1 } } },
      (c) => c.aggregate([{ $group: { _id: null, promedio: { $avg: '$calificacion' }, resenas: { $sum: 1 } } }]).toArray()),
    db.mongo('aggregate', 'eventos_app', { $match: 'ultimos 30 dias', $group: 'sesion_id' }, (c) => c.aggregate([
      { $match: { ts: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: '$sesion_id' } }, { $count: 'sesiones' }]).toArray())]);
  const actual = Number(v.actual); const anterior = Number(v.anterior);
  res.json({ ventas_30d: actual, ventas_30d_anterior: anterior, variacion_pct: anterior ? Math.round(1000 * (actual - anterior) / anterior) / 10 : null,
    pedidos_30d: ped.n, variantes_stock_bajo: bajo.n, clientes_oro: oro.n,
    calificacion_promedio: rating[0] ? Math.round(rating[0].promedio * 100) / 100 : null, resenas: rating[0] ? rating[0].resenas : 0,
    sesiones_web_30d: sesiones[0] ? sesiones[0].sesiones : 0 });
}));

router.get('/reportes/ventas-mensuales', asincrono(async (req, res) => {
  const filas = await db.consultar(`SELECT to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes, canal, sum(venta_neta) AS venta, sum(pedidos)::int AS pedidos
      FROM vw_ventas_diarias WHERE fecha >= date_trunc('month', current_date) - interval '11 months' GROUP BY 1, 2 ORDER BY 1, 2`);
  res.json({ filas });
}));

router.get('/reportes/sucursales', asincrono(async (req, res) => {
  const dias = entero(req.query.dias, 1, 365) || 30;
  const filas = await db.consultar(`SELECT sucursal, sum(venta_neta) AS venta, sum(pedidos)::int AS pedidos, sum(unidades)::int AS unidades
      FROM vw_ventas_diarias WHERE fecha >= current_date - $1::int GROUP BY sucursal ORDER BY venta DESC`, [dias]);
  res.json({ dias, filas });
}));

router.get('/reportes/top-productos', asincrono(async (req, res) => {
  const dias = entero(req.query.dias, 1, 730) || 90;
  const filas = await db.consultar('SELECT * FROM fn_top_productos(current_date - $1::int, current_date, 10)', [dias]);
  res.json({ dias, filas });
}));

router.get('/reportes/web', asincrono(async (req, res) => {
  const orden = ['vista_producto', 'agregar_carrito', 'inicio_checkout', 'pedido_creado'];
  const [embudo, busquedas, horas, mejores] = await Promise.all([
    db.mongo('aggregate', 'eventos_app', { embudo: 'sesiones por etapa' }, (c) => c.aggregate([
      { $match: { tipo: { $in: orden } } }, { $group: { _id: '$tipo', sesiones: { $addToSet: '$sesion_id' } } },
      { $project: { sesiones: { $size: '$sesiones' } } }, { $addFields: { pos: { $indexOfArray: [orden, '$_id'] } } }, { $sort: { pos: 1 } }]).toArray()),
    db.mongo('aggregate', 'eventos_app', { busquedas: 'top 8' }, (c) => c.aggregate([
      { $match: { tipo: 'busqueda' } }, { $group: { _id: '$payload.termino', veces: { $sum: 1 }, sin_resultados: { $sum: { $cond: [{ $eq: ['$payload.resultados', 0] }, 1, 0] } } } },
      { $sort: { veces: -1 } }, { $limit: 8 }]).toArray()),
    db.mongo('aggregate', 'eventos_app', { trafico: 'por hora Bogota' }, (c) => c.aggregate([
      { $match: { tipo: 'vista_producto' } }, { $group: { _id: { $dateToString: { format: '%H', date: '$ts', timezone: 'America/Bogota' } }, vistas: { $sum: 1 } } },
      { $sort: { _id: 1 } }]).toArray()),
    db.mongo('aggregate', 'resumen_calificaciones', { mejores: 'minimo 15 resenas' }, (c) => c.aggregate([
      { $match: { resenas: { $gte: 15 } } }, { $sort: { promedio: -1, resenas: -1 } }, { $limit: 5 },
      { $lookup: { from: 'catalogo_productos', localField: '_id', foreignField: 'id_producto', as: 'p' } }, { $unwind: '$p' },
      { $project: { _id: 0, producto: '$p.nombre', promedio: 1, resenas: 1 } }]).toArray())]);
  let anterior = null;
  const etapas = embudo.map((e) => { const r = { etapa: e._id, sesiones: e.sesiones, pct_etapa_anterior: anterior ? Math.round(1000 * e.sesiones / anterior) / 10 : null }; anterior = e.sesiones; return r; });
  res.json({ embudo: etapas, busquedas: busquedas.map((b) => ({ termino: b._id, veces: b.veces, sin_resultados: b.sin_resultados })),
    trafico_por_hora: horas.map((h) => ({ hora: h._id, vistas: h.vistas })), mejores_calificados: mejores });
}));

module.exports = router;
