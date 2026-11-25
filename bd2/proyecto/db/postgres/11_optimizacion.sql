-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 11_optimizacion.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: evidencia de la utilidad de los indices. Para cada consulta
--   se muestra el plan CON el indice y luego SIN el (DROP INDEX dentro de una
--   transaccion que termina en ROLLBACK, por lo que la base no se altera).
--   Se ejecuta como tienda_owner (dueno de las tablas).
-- =====================================================================
SET search_path = tienda, extensiones;
\pset footer off

\echo '##### O1. Historial de un cliente (idx_pedido_cliente) #####'
\echo '--- CON indice'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT id_pedido, fecha_pedido, total FROM pedido WHERE id_cliente = 100 ORDER BY fecha_pedido DESC;
BEGIN;
DROP INDEX idx_pedido_cliente;
\echo '--- SIN indice'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT id_pedido, fecha_pedido, total FROM pedido WHERE id_cliente = 100 ORDER BY fecha_pedido DESC;
ROLLBACK;

\echo
\echo '##### O2. Alertas de stock bajo de una sucursal (indice parcial idx_inventario_stock_bajo) #####'
\echo '--- CON indice parcial'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT id_variante, stock FROM inventario WHERE stock <= stock_minimo AND id_sucursal = 1;
BEGIN;
DROP INDEX idx_inventario_stock_bajo;
\echo '--- SIN el indice parcial'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT id_variante, stock FROM inventario WHERE stock <= stock_minimo AND id_sucursal = 1;
ROLLBACK;

\echo
\echo '##### O3. Lineas de pedido de una variante (idx_detalle_variante) #####'
\echo '--- CON indice'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT count(*), sum(cantidad) FROM detalle_pedido WHERE id_variante = 50;
BEGIN;
DROP INDEX idx_detalle_variante;
\echo '--- SIN indice'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT count(*), sum(cantidad) FROM detalle_pedido WHERE id_variante = 50;
ROLLBACK;

\echo
\echo '##### O4. Ventas por rango de fechas y sucursal (idx_pedido_fecha / idx_pedido_sucursal_estado) #####'
\echo '--- CON indices'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT count(*) FROM pedido WHERE id_sucursal = 2 AND estado = 'ENTREGADO' AND fecha_pedido >= DATE '2026-10-01';
BEGIN;
DROP INDEX idx_pedido_sucursal_estado; DROP INDEX idx_pedido_fecha;
\echo '--- SIN indices'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT count(*) FROM pedido WHERE id_sucursal = 2 AND estado = 'ENTREGADO' AND fecha_pedido >= DATE '2026-10-01';
ROLLBACK;

\echo
\echo '##### O5. Costo de mantener los indices: tamanos #####'
SELECT relname AS tabla, pg_size_pretty(pg_table_size(c.oid)) AS tabla_tamano, pg_size_pretty(pg_indexes_size(c.oid)) AS indices_tamano
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'tienda' AND c.relkind = 'r' AND relname IN ('pedido', 'detalle_pedido', 'inventario', 'movimiento_inventario', 'producto')
 ORDER BY pg_total_relation_size(c.oid) DESC;
