// Middleware de autenticacion y autorizacion por rol
function requiereSesion(req, res, next) {
  if (!req.session || !req.session.usuario) return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesion' });
  next();
}
function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesion' });
    if (!roles.includes(req.session.usuario.rol)) return res.status(403).json({ ok: false, mensaje: 'Su perfil no tiene permiso para esta operacion' });
    next();
  };
}
// Envoltura para rutas async: cualquier excepcion llega al manejador de errores
const asincrono = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Validadores de entrada
const entero = (v, min = 1, max = 2147483647) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const texto = (v, max = 200) => (typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v.trim() : null);
const pagina = (v) => Math.max(1, entero(v, 1, 100000) || 1);

module.exports = { requiereSesion, requiereRol, asincrono, entero, texto, pagina };
