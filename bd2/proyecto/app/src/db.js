// Acceso a PostgreSQL y MongoDB. Toda llamada queda registrada en la bitacora de evidencia.
const { Pool } = require('pg');
const { MongoClient, GridFSBucket } = require('mongodb');
const cfg = require('./config');
const evidencia = require('./evidencia');

const pool = new Pool(cfg.pg);
const poolAdmin = new Pool(cfg.pgAdmin);
pool.on('error', (e) => console.error('Error en el pool de PostgreSQL:', e.message));
poolAdmin.on('error', (e) => console.error('Error en el pool administrativo:', e.message));

let clienteMongo; let bd; let bucket;

async function iniciar() {
  clienteMongo = new MongoClient(cfg.mongo.url, { serverSelectionTimeoutMS: 5000 });
  await clienteMongo.connect();
  bd = clienteMongo.db(cfg.mongo.db);
  bucket = new GridFSBucket(bd, { bucketName: 'imagenes' });
  await pool.query('SELECT 1');
  await poolAdmin.query('SELECT 1');
}

const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;

// Consulta parametrizada (SELECT). Los valores NUNCA se concatenan al SQL.
async function consultar(sql, params = [], paramsParaLog = params) {
  const t0 = process.hrtime.bigint();
  try {
    const r = await pool.query(sql, params);
    evidencia.registrar({ motor: 'PostgreSQL', tipo: 'SELECT', sentencia: sql.replace(/\s+/g, ' ').trim(), parametros: paramsParaLog, ms: ms(t0), resultado: `${r.rowCount} fila(s)` });
    return r.rows;
  } catch (e) {
    evidencia.registrar({ motor: 'PostgreSQL', tipo: 'SELECT', sentencia: sql.replace(/\s+/g, ' ').trim(), parametros: paramsParaLog, ms: ms(t0), error: e });
    throw e;
  }
}

// Invoca un procedimiento almacenado. Los parametros OUT se envian como NULL.
// casts: arreglo opcional con el tipo a forzar por parametro (por ejemplo 'jsonb').
async function llamar(nombre, params, nOut = 3, casts = [], conexion = pool) {
  const marcadores = params.map((_, i) => `$${i + 1}${casts[i] ? '::' + casts[i] : ''}`);
  for (let i = 0; i < nOut; i++) marcadores.push('NULL');
  const sql = `CALL ${nombre}(${marcadores.join(', ')})`;
  const t0 = process.hrtime.bigint();
  try {
    const r = await conexion.query(sql, params);
    const fila = r.rows[0] || {};
    evidencia.registrar({ motor: 'PostgreSQL', tipo: 'CALL', sentencia: sql, parametros: params, ms: ms(t0), resultado: fila });
    return fila;
  } catch (e) {
    evidencia.registrar({ motor: 'PostgreSQL', tipo: 'CALL', sentencia: sql, parametros: params, ms: ms(t0), error: e });
    throw e;
  }
}

// Igual que llamar(), pero con el usuario administrativo (app_admin). Se usa solo para
// procedimientos que hacen COMMIT/ROLLBACK, que no pueden ser SECURITY DEFINER.
const llamarAdmin = (nombre, params, nOut = 3, casts = []) => llamar(nombre, params, nOut, casts, poolAdmin);

// Ejecuta una operacion de MongoDB y la registra.
async function mongo(operacion, coleccion, detalle, fn) {
  const t0 = process.hrtime.bigint();
  try {
    const r = await fn(bd.collection(coleccion));
    const resumen = Array.isArray(r) ? `${r.length} documento(s)` : (r && typeof r === 'object' && ('insertedId' in r || 'modifiedCount' in r || 'deletedCount' in r || 'upsertedId' in r)) ? r : (r === null ? 'sin resultado' : 'ok');
    evidencia.registrar({ motor: 'MongoDB', tipo: operacion, sentencia: `db.${coleccion}.${operacion}`, parametros: detalle, ms: ms(t0), resultado: resumen });
    return r;
  } catch (e) {
    evidencia.registrar({ motor: 'MongoDB', tipo: operacion, sentencia: `db.${coleccion}.${operacion}`, parametros: detalle, ms: ms(t0), error: e });
    throw e;
  }
}

// Convierte el codigo de retorno de un procedimiento en un codigo HTTP
const HTTP = { 0: 200, 1: 404, 2: 409, 3: 409, 4: 409, 5: 422, 6: 503, 7: 422, 99: 500 };
function respuestaProcedimiento(fila, extra = {}) {
  const codigo = Number(fila.p_codigo);
  return { status: HTTP[codigo] || 500, cuerpo: { ok: codigo === 0, codigo, mensaje: fila.p_mensaje, ...extra } };
}

module.exports = {
  pool, consultar, llamar, llamarAdmin, mongo, iniciar, respuestaProcedimiento,
  get bd() { return bd; }, get bucket() { return bucket; },
  async cerrar() { await pool.end(); await poolAdmin.end(); if (clienteMongo) await clienteMongo.close(); },
};
