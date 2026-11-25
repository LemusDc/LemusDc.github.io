// =====================================================================
// Aplicacion web - Tienda de Ropa (Proyecto Final Bases de Datos 2)
// Autores : Juan Diego Mateus, Diego Lemus
// Descripcion: monolito Node.js/Express. Escribe en PostgreSQL solo por
//   procedimientos almacenados, lee por vistas, y usa MongoDB para
//   catalogo ampliado, resenas, imagenes, carritos y eventos.
// =====================================================================
const path = require('path');
const express = require('express');
const session = require('express-session');
const cfg = require('./config');
const db = require('./db');
const evidencia = require('./evidencia');
const { requiereSesion, asincrono } = require('./auth');

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'" });
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(session({ name: 'tienda.sid', secret: cfg.sesionSecreto, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 } }));
// Contexto por peticion: permite que el registro de evidencia sepa quien ejecuto cada llamada
app.use((req, res, next) => evidencia.contexto.run({ usuario: req.session && req.session.usuario ? req.session.usuario.username : null }, next));

app.use('/api', require('./routes/auth'));
app.get('/api/evidencia', requiereSesion, (req, res) => {
  res.json({ eventos: evidencia.listar(parseInt(req.query.desde, 10) || 0, req.query.procedimientos === '1') });
});
app.use('/api', require('./routes/catalogo'));
app.use('/api', require('./routes/clientes'));
app.use('/api', require('./routes/pedidos'));
app.use('/api', require('./routes/inventario'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/reportes'));
app.use('/api', (req, res) => res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' }));

app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: 0 }));

// Manejador central de errores: no se filtran detalles internos al cliente
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, mensaje: 'JSON invalido' });
  if (err.name === 'MulterError') return res.status(422).json({ ok: false, mensaje: 'Archivo invalido: ' + err.message });
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err.message);
  if (err.code && /^(22|23)/.test(String(err.code))) return res.status(422).json({ ok: false, mensaje: 'Los datos enviados no son validos' });
  res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
});

if (require.main === module) {
  db.iniciar().then(() => {
    app.listen(cfg.puerto, () => console.log(`Tienda de Ropa escuchando en http://localhost:${cfg.puerto}`));
  }).catch((e) => { console.error('No se pudo conectar a las bases de datos:', e.message); process.exit(1); });
}
module.exports = app;
