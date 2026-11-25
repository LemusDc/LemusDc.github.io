// Registro en memoria de las llamadas que la aplicacion hace a PostgreSQL y MongoDB.
// Sirve como evidencia de la interaccion con procedimientos almacenados (panel "Evidencia" de la interfaz).
const { AsyncLocalStorage } = require('async_hooks');

const contexto = new AsyncLocalStorage();
const buffer = [];
let secuencia = 0;
const MAXIMO = 300;

function recortar(valor, largo = 400) {
  let t;
  try { t = typeof valor === 'string' ? valor : JSON.stringify(valor); } catch { t = String(valor); }
  return t && t.length > largo ? t.slice(0, largo) + '…' : t;
}

function registrar({ motor, tipo, sentencia, parametros, ms, resultado, error }) {
  const almacen = contexto.getStore();
  buffer.push({
    id: ++secuencia, ts: new Date().toISOString(), motor, tipo, sentencia,
    parametros: parametros === undefined ? undefined : recortar(parametros),
    ms: Math.round(ms * 10) / 10,
    resultado: resultado === undefined ? undefined : recortar(resultado),
    error: error ? String(error.message || error) : undefined,
    usuario: almacen && almacen.usuario ? almacen.usuario : null,
  });
  if (buffer.length > MAXIMO) buffer.shift();
}

function listar(desde = 0, soloProcedimientos = false) {
  return buffer.filter((e) => e.id > desde && (!soloProcedimientos || e.tipo === 'CALL' || e.motor === 'MongoDB'));
}

module.exports = { contexto, registrar, listar };
