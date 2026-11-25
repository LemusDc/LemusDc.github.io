-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 06_vistas.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: vistas de lectura. La aplicacion web NO consulta las
--   tablas directamente: lee estas vistas y escribe solo mediante
--   procedimientos almacenados.
-- =====================================================================
\set ON_ERROR_STOP on
SET search_path = tienda, extensiones;

CREATE OR REPLACE VIEW vw_categorias AS
WITH RECURSIVE arbol AS (
    SELECT c.id_categoria, c.nombre, c.id_categoria_padre, 1 AS nivel, c.nombre::text AS ruta,
           c.id_categoria AS id_categoria_raiz, c.nombre AS categoria_raiz
      FROM categoria c WHERE c.id_categoria_padre IS NULL
    UNION ALL
    SELECT h.id_categoria, h.nombre, h.id_categoria_padre, a.nivel + 1, a.ruta || ' > ' || h.nombre,
           a.id_categoria_raiz, a.categoria_raiz
      FROM categoria h JOIN arbol a ON h.id_categoria_padre = a.id_categoria
)
SELECT * FROM arbol;

CREATE OR REPLACE VIEW vw_catalogo AS
SELECT p.id_producto, p.nombre, p.descripcion, p.genero, p.precio_base, p.activo,
       c.id_categoria, c.nombre AS categoria, c.ruta AS ruta_categoria, c.categoria_raiz,
       m.id_marca, m.nombre AS marca,
       fn_descuento_unitario(p.id_producto) AS descuento_vigente,
       p.precio_base - fn_descuento_unitario(p.id_producto) AS precio_final,
       (SELECT count(*) FROM variante_producto v WHERE v.id_producto = p.id_producto AND v.activa) AS num_variantes,
       COALESCE((SELECT sum(i.stock) FROM inventario i JOIN variante_producto v USING (id_variante)
                  WHERE v.id_producto = p.id_producto), 0) AS stock_total
  FROM producto p
  JOIN vw_categorias c ON c.id_categoria = p.id_categoria
  JOIN marca m ON m.id_marca = p.id_marca;

CREATE OR REPLACE VIEW vw_variantes_stock AS
SELECT v.id_variante, v.sku, p.id_producto, p.nombre AS producto, v.talla, v.color, v.activa,
       s.id_sucursal, s.nombre AS sucursal, s.tipo AS tipo_sucursal,
       i.stock, i.stock_minimo, (i.stock <= i.stock_minimo) AS stock_bajo, i.ultima_actualizacion
  FROM inventario i
  JOIN variante_producto v ON v.id_variante = i.id_variante
  JOIN producto p ON p.id_producto = v.id_producto
  JOIN sucursal s ON s.id_sucursal = i.id_sucursal;

CREATE OR REPLACE VIEW vw_stock_bajo AS
SELECT * FROM vw_variantes_stock WHERE stock_bajo AND activa AND tipo_sucursal = 'FISICA';

CREATE OR REPLACE VIEW vw_clientes AS
SELECT c.id_cliente, c.tipo_documento, c.documento, c.nombres, c.apellidos,
       c.nombres || ' ' || c.apellidos AS nombre_completo, c.email, c.telefono, c.fecha_registro, c.activo,
       f.puntos, f.nivel,
       (SELECT count(*) FROM pedido p WHERE p.id_cliente = c.id_cliente) AS num_pedidos
  FROM cliente c JOIN perfil_fidelizacion f USING (id_cliente);

CREATE OR REPLACE VIEW vw_pedidos AS
SELECT p.id_pedido, p.fecha_pedido, p.estado, p.canal, p.tipo_entrega,
       p.id_cliente, c.nombres || ' ' || c.apellidos AS cliente,
       p.id_sucursal, s.nombre AS sucursal,
       p.id_empleado, e.nombres || ' ' || e.apellidos AS vendedor,
       p.subtotal, p.descuento_total, p.costo_envio, p.total,
       (SELECT string_agg(DISTINCT pg.metodo, ', ') FROM pago pg WHERE pg.id_pedido = p.id_pedido) AS metodo_pago,
       d.direccion AS direccion_envio
  FROM pedido p
  JOIN cliente c ON c.id_cliente = p.id_cliente
  JOIN sucursal s ON s.id_sucursal = p.id_sucursal
  LEFT JOIN empleado e ON e.id_empleado = p.id_empleado
  LEFT JOIN direccion_cliente d ON d.id_direccion = p.id_direccion_envio;

CREATE OR REPLACE VIEW vw_detalle_pedido AS
SELECT d.id_pedido, d.num_linea, d.id_variante, v.sku, pr.nombre AS producto, v.talla, v.color,
       d.cantidad, d.precio_unitario, d.descuento_unitario, d.subtotal_linea,
       COALESCE((SELECT sum(dv.cantidad) FROM devolucion dv
                  WHERE dv.id_pedido = d.id_pedido AND dv.num_linea = d.num_linea), 0) AS cantidad_devuelta
  FROM detalle_pedido d
  JOIN variante_producto v ON v.id_variante = d.id_variante
  JOIN producto pr ON pr.id_producto = v.id_producto;

CREATE OR REPLACE VIEW vw_devoluciones AS
SELECT dv.id_devolucion, dv.fecha_devolucion, dv.id_pedido, dv.num_linea, pr.nombre AS producto, v.talla, v.color,
       dv.cantidad, dv.motivo, dv.monto_reembolsado, dv.reingresa_stock,
       c.nombres || ' ' || c.apellidos AS cliente
  FROM devolucion dv
  JOIN detalle_pedido d ON d.id_pedido = dv.id_pedido AND d.num_linea = dv.num_linea
  JOIN variante_producto v ON v.id_variante = d.id_variante
  JOIN producto pr ON pr.id_producto = v.id_producto
  JOIN pedido p ON p.id_pedido = dv.id_pedido
  JOIN cliente c ON c.id_cliente = p.id_cliente;

CREATE OR REPLACE VIEW vw_ventas_diarias AS
SELECT p.fecha_pedido::date AS fecha, p.canal, p.id_sucursal, s.nombre AS sucursal,
       count(DISTINCT p.id_pedido) AS pedidos,
       sum(d.cantidad) AS unidades,
       sum(d.cantidad * d.precio_unitario) AS venta_bruta,
       sum(d.cantidad * d.descuento_unitario) AS descuentos,
       sum(d.subtotal_linea) AS venta_neta
  FROM pedido p
  JOIN sucursal s ON s.id_sucursal = p.id_sucursal
  JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
 WHERE p.estado = 'ENTREGADO'
 GROUP BY p.fecha_pedido::date, p.canal, p.id_sucursal, s.nombre;

CREATE OR REPLACE VIEW vw_kardex AS
SELECT m.id_movimiento, m.fecha, m.tipo, m.cantidad, m.stock_resultante, m.usuario_bd,
       s.nombre AS sucursal, v.sku, pr.nombre AS producto, v.talla, v.color
  FROM movimiento_inventario m
  JOIN sucursal s ON s.id_sucursal = m.id_sucursal
  JOIN variante_producto v ON v.id_variante = m.id_variante
  JOIN producto pr ON pr.id_producto = v.id_producto;

CREATE OR REPLACE VIEW vw_promociones AS
SELECT pr.id_promocion, pr.nombre, pr.tipo_descuento, pr.valor, pr.fecha_inicio, pr.fecha_fin, pr.activa,
       (pr.activa AND current_date BETWEEN pr.fecha_inicio AND pr.fecha_fin) AS vigente_hoy,
       (SELECT count(*) FROM promocion_producto pp WHERE pp.id_promocion = pr.id_promocion) AS productos
  FROM promocion pr;

CREATE OR REPLACE VIEW vw_bitacora AS
SELECT id_bitacora, fecha, procedimiento, codigo, mensaje, sqlstate_error, usuario_bd, parametros
  FROM bitacora_operacion;

CREATE OR REPLACE VIEW vw_direcciones AS
SELECT d.id_direccion, d.id_cliente, d.alias, d.direccion, ci.nombre AS ciudad, d.es_principal
  FROM direccion_cliente d JOIN ciudad ci USING (id_ciudad);

CREATE OR REPLACE VIEW vw_auditoria_precio AS
SELECT a.id_auditoria, a.fecha, a.id_producto, p.nombre AS producto, a.precio_anterior, a.precio_nuevo,
       ROUND(100 * (a.precio_nuevo - a.precio_anterior) / a.precio_anterior, 2) AS variacion_pct, a.usuario_bd
  FROM auditoria_precio a JOIN producto p ON p.id_producto = a.id_producto;

CREATE OR REPLACE VIEW vw_pagos AS
SELECT id_pago, id_pedido, metodo, monto, estado, fecha_pago, referencia_externa FROM pago;
