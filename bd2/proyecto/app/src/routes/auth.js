const router = require('express').Router();
const db = require('../db');
const { asincrono, texto } = require('../auth');

// Limite simple de intentos de inicio de sesion por IP (memoria del proceso)
const intentos = new Map();
const VENTANA_MS = 10 * 60 * 1000; const MAX_INTENTOS = 10;
function limitar(ip) {
  const ahora = Date.now(); const lista = (intentos.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  lista.push(ahora); intentos.set(ip, lista); return lista.length > MAX_INTENTOS;
}

router.post('/login', asincrono(async (req, res) => {
  if (limitar(req.ip)) return res.status(429).json({ ok: false, mensaje: 'Demasiados intentos. Espere unos minutos.' });
  const username = texto(req.body.username, 40); const password = texto(req.body.password, 100);
  if (!username || !password) return res.status(400).json({ ok: false, mensaje: 'Usuario y contrasena son obligatorios' });
  // la clave viaja a la funcion pero NO queda en el registro de evidencia
  const filas = await db.consultar('SELECT * FROM fn_autenticar($1, $2)', [username, password], [username, '********']);
  const r = { rowCount: filas.length, rows: filas };
  if (r.rowCount === 0) return res.status(401).json({ ok: false, mensaje: 'Usuario o contrasena incorrectos' });
  const u = r.rows[0];
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ ok: false, mensaje: 'No se pudo iniciar la sesion' });
    req.session.usuario = { id: u.out_id_empleado, nombre: u.out_nombre, rol: u.out_rol, id_sucursal: u.out_id_sucursal, username };
    db.mongo('insertOne', 'eventos_app', { tipo: 'login' }, (c) => c.insertOne({
      tipo: 'login', ts: new Date(), sesion_id: req.sessionID, dispositivo: 'escritorio', payload: { metodo: 'usuario_empleado', rol: u.out_rol } })).catch(() => {});
    res.json({ ok: true, usuario: req.session.usuario });
  });
}));

router.post('/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
router.get('/yo', (req, res) => res.json({ ok: !!(req.session && req.session.usuario), usuario: (req.session && req.session.usuario) || null }));

module.exports = router;
