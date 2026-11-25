// Administracion: productos (PostgreSQL + ficha en MongoDB), precios, bitacora y auditoria
const router = require('express').Router();
const db = require('../db');
const { requiereRol, asincrono, entero, texto, pagina } = require('../auth');

router.use(requiereRol('ADMIN'));
const GENEROS = ['MUJER', 'HOMBRE', 'NINA', 'NINO', 'UNISEX'];

// Solo claves simples y valores escalares o listas de texto: evita inyectar operadores ($) o estructuras profundas
function limpiarAtributos(a) {
  const salida = {};
  if (!a || typeof a !== 'object' || Array.isArray(a)) return salida;
  for (const [k, v] of Object.entries(a).slice(0, 20)) {
    if (!/^[a-z][a-z0-9_]{0,29}$/.test(k)) continue;
    if (typeof v === 'string' && v.length <= 100) salida[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) salida[k] = v;
    else if (typeof v === 'boolean') salida[k] = v;
    else if (Array.isArray(v) && v.length <= 10 && v.every((x) => typeof x === 'string' && x.length <= 100)) salida[k] = v;
  }
  return salida;
}
const listaTexto = (v, maxItems, maxLargo) => (Array.isArray(v) && v.length > 0 && v.length <= maxItems && v.every((x) => typeof x === 'string' && x.trim() && x.length <= maxLargo)
  ? [...new Set(v.map((x) => x.trim()))] : null);

router.post('/admin/productos', asincrono(async (req, res) => {
  const b = req.body || {};
  const tallas = listaTexto(b.tallas, 12, 10); const colores = listaTexto(b.colores, 12, 30);
  const precio = Number(b.precio);
  if (!texto(b.nombre, 120) || !entero(b.id_categoria) || !entero(b.id_marca) || !GENEROS.includes(b.genero) || !tallas || !colores || !(precio > 0 && precio < 100000000))
    return res.status(422).json({ ok: false, mensaje: 'Nombre, categoria, marca, genero, precio, tallas y colores son obligatorios' });

  const f = await db.llamar('sp_crear_producto', [texto(b.nombre, 120), texto(b.descripcion, 500), entero(b.id_categoria), entero(b.id_marca), b.genero, precio, tallas, colores], 3, { 6: 'numeric', 7: 'text[]', 8: 'text[]' });
  const { status, cuerpo } = db.respuestaProcedimiento(f, { id_producto: f.p_id_producto });
  if (!cuerpo.ok) return res.status(status).json(cuerpo);

  // Segundo paso (MongoDB): ficha documental. Si falla, el producto ya existe en PostgreSQL y se avisa
  // para completarla despues (consistencia eventual; ver documento de decisiones tecnicas).
  try {
    const [{ categoria, marca }] = await db.consultar('SELECT categoria, marca FROM vw_catalogo WHERE id_producto = $1', [f.p_id_producto]);
    const ficha = { id_producto: f.p_id_producto, nombre: texto(b.nombre, 120), descripcion: texto(b.descripcion, 500) || '', categoria, marca, genero: b.genero,
      atributos: limpiarAtributos(b.atributos), imagenes: [], colores_disponibles: colores, tallas_disponibles: tallas,
      etiquetas: [categoria.toLowerCase(), marca.toLowerCase(), b.genero.toLowerCase()], destacado: false, actualizado: new Date() };
    await db.mongo('insertOne', 'catalogo_productos', { id_producto: f.p_id_producto }, (c) => c.insertOne(ficha));
    cuerpo.ficha = true;
  } catch (e) {
    cuerpo.ficha = false;
    cuerpo.advertencia = 'El producto se creo en PostgreSQL, pero su ficha documental no se pudo guardar: ' + e.message;
  }
  res.status(status).json(cuerpo);
}));

router.put('/admin/productos/:id/precio', asincrono(async (req, res) => {
  const id = entero(req.params.id); const precio = Number((req.body || {}).precio);
  const f = await db.llamar('sp_actualizar_precio', [id, Number.isFinite(precio) ? precio : null], 2, { 1: 'numeric' });
  const { status, cuerpo } = db.respuestaProcedimiento(f);
  if (cuerpo.ok) db.mongo('updateOne', 'catalogo_productos', { id_producto: id }, (c) => c.updateOne({ id_producto: id }, { $set: { actualizado: new Date() } })).catch(() => {});
  res.status(status).json(cuerpo);
}));

router.post('/admin/precios/ajuste-masivo', asincrono(async (req, res) => {
  const b = req.body || {}; const pct = Number(b.porcentaje);
  if (!entero(b.id_categoria) || !Number.isFinite(pct)) return res.status(422).json({ ok: false, mensaje: 'Categoria y porcentaje son obligatorios' });
  const f = await db.llamarAdmin('sp_ajuste_masivo_precios', [entero(b.id_categoria), pct], 3, { 1: 'numeric' });
  const { status, cuerpo } = db.respuestaProcedimiento(f, { afectados: f.p_afectados });
  res.status(status).json(cuerpo);
}));

router.get('/admin/bitacora', asincrono(async (req, res) => {
  const pag = pagina(req.query.pagina);
  const [{ total }] = await db.consultar('SELECT count(*)::int AS total FROM vw_bitacora');
  const filas = await db.consultar(`SELECT id_bitacora, fecha, procedimiento, codigo, mensaje, sqlstate_error, usuario_bd FROM vw_bitacora
      ORDER BY id_bitacora DESC LIMIT 20 OFFSET ${(pag - 1) * 20}`);
  res.json({ total, pagina: pag, filas });
}));

router.get('/admin/auditoria-precios', asincrono(async (req, res) => {
  const filas = await db.consultar('SELECT fecha, producto, precio_anterior, precio_nuevo, variacion_pct, usuario_bd FROM vw_auditoria_precio ORDER BY id_auditoria DESC LIMIT 30');
  res.json({ filas });
}));

router.get('/admin/promociones', asincrono(async (req, res) => {
  res.json({ filas: await db.consultar('SELECT * FROM vw_promociones ORDER BY fecha_inicio DESC') });
}));

module.exports = router;
