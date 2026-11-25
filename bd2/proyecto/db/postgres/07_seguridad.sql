-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 07_seguridad.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: seguridad. Principio de minimo privilegio:
--   * PUBLIC no tiene acceso a nada del esquema.
--   * app_tienda (la aplicacion): solo lee vistas y ejecuta
--     procedimientos; NO puede insertar, actualizar ni borrar tablas.
--   * rol_vendedor: lectura de pedidos limitada por sucursal (RLS).
--   * rol_analista: solo vistas analiticas, sin datos personales.
--   * rol_admin_tienda: administracion completa.
--   * Contrasenas de usuarios del sistema con bcrypt (pgcrypto).
-- Se ejecuta como tienda_owner. Los roles se crean en 00_crear_base_datos.sql.
-- =====================================================================
\set ON_ERROR_STOP on
SET search_path = tienda, extensiones;

REVOKE ALL ON SCHEMA tienda, extensiones FROM PUBLIC;
REVOKE ALL ON ALL TABLES    IN SCHEMA tienda FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA tienda FROM PUBLIC;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA tienda FROM PUBLIC;

GRANT USAGE ON SCHEMA tienda TO rol_admin_tienda, rol_vendedor, rol_analista, app_tienda;

-- Administrador
GRANT ALL ON ALL TABLES    IN SCHEMA tienda TO rol_admin_tienda;
GRANT ALL ON ALL SEQUENCES IN SCHEMA tienda TO rol_admin_tienda;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA tienda TO rol_admin_tienda;

-- Aplicacion web: lectura de vistas/catalogos y ejecucion de rutinas de negocio
GRANT SELECT ON vw_categorias, vw_catalogo, vw_variantes_stock, vw_stock_bajo, vw_clientes, vw_pedidos,
                vw_detalle_pedido, vw_devoluciones, vw_ventas_diarias, vw_kardex, vw_promociones,
                vw_bitacora, vw_direcciones, vw_auditoria_precio, vw_pagos TO app_tienda;
GRANT SELECT ON sucursal, ciudad, marca, categoria TO app_tienda;
GRANT EXECUTE ON PROCEDURE sp_registrar_cliente, sp_crear_pedido, sp_cambiar_estado_pedido,
                           sp_registrar_devolucion, sp_ajustar_stock, sp_transferir_stock,
                           sp_crear_producto, sp_actualizar_precio,
                           sp_reponer_stock_bajo, sp_agregar_direccion TO app_tienda;
-- sp_ajuste_masivo_precios (usa COMMIT/ROLLBACK) NO se concede a app_tienda: solo a rol_admin_tienda (via app_admin)
GRANT EXECUTE ON FUNCTION fn_autenticar, fn_ventas_netas, fn_top_productos, fn_descuento_unitario,
                          fn_stock_disponible, fn_total_pedido, fn_nivel_fidelizacion, fn_costo_envio, fn_normalizar TO app_tienda;

-- Vendedor: consulta de pedidos (filtrados por RLS), catalogo y operacion de ventas
GRANT SELECT ON pedido, sucursal TO rol_vendedor;
GRANT SELECT ON vw_catalogo, vw_variantes_stock TO rol_vendedor;
GRANT EXECUTE ON PROCEDURE sp_crear_pedido, sp_registrar_cliente, sp_registrar_devolucion, sp_agregar_direccion TO rol_vendedor;
GRANT EXECUTE ON FUNCTION fn_stock_disponible, fn_descuento_unitario TO rol_vendedor;

-- Analista: solo indicadores, sin datos personales
GRANT SELECT ON vw_ventas_diarias, vw_catalogo, vw_stock_bajo TO rol_analista;
GRANT EXECUTE ON FUNCTION fn_ventas_netas, fn_top_productos TO rol_analista;

-- Seguridad por fila: el vendedor solo ve pedidos de la sucursal indicada en la
-- variable de sesion app.id_sucursal. Administrador y aplicacion ven todo.
ALTER TABLE pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_pedido_total ON pedido FOR ALL TO rol_admin_tienda, app_tienda USING (true) WITH CHECK (true);
CREATE POLICY p_pedido_vendedor ON pedido FOR SELECT TO rol_vendedor
    USING (id_sucursal = NULLIF(current_setting('app.id_sucursal', true), '')::integer);
