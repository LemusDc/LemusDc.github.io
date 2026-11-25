// Configuracion de la aplicacion. Todo se puede sobrescribir con variables de entorno
// o con un archivo .env (ver .env.example).
require('dotenv').config();

module.exports = {
  puerto: parseInt(process.env.PORT || '3000', 10),
  sesionSecreto: process.env.SESSION_SECRET || 'cambiar-este-secreto-en-produccion',
  pg: {
    host: process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'app_tienda',
    password: process.env.PGPASSWORD || 'App2026*',
    database: process.env.PGDATABASE || 'tienda_ropa',
    max: 10,
  },
  // Usuario administrativo, solo para operaciones con COMMIT/ROLLBACK explicitos (ajuste masivo de precios)
  pgAdmin: {
    host: process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGADMIN_USER || 'app_admin',
    password: process.env.PGADMIN_PASSWORD || 'AppAdmin2026*',
    database: process.env.PGDATABASE || 'tienda_ropa',
    max: 2,
  },
  mongo: {
    url: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017',
    db: process.env.MONGO_DB || 'tienda_ropa_nosql',
  },
};
