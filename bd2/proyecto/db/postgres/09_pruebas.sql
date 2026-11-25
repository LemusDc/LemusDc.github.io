-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 09_pruebas.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: pruebas funcionales de procedimientos, funciones y
--   triggers, incluidos los casos de error. Sirve como evidencia para
--   el video y la sustentacion. Se ejecuta DESPUES de 05_insercion.sql.
--   Uso: psql -d tienda_ropa -f 09_pruebas.sql
-- =====================================================================
SET search_path = tienda, extensiones;
\pset null '(null)'
\set QUIET on

\echo '=== Preparacion: variantes y clientes de prueba ==='
SELECT v.id_variante AS v1, pr.precio_base AS precio_v1
  FROM variante_producto v JOIN producto pr USING (id_producto)
 WHERE pr.nombre = 'Camiseta básica cuello redondo' AND v.talla = 'M' ORDER BY v.id_variante LIMIT 1 \gset
SELECT v.id_variante AS v2
  FROM variante_producto v JOIN producto pr USING (id_producto)
 WHERE pr.nombre = 'Jean slim' AND v.talla = '32' ORDER BY v.id_variante LIMIT 1 \gset
SELECT id_empleado AS emp1 FROM empleado WHERE id_sucursal = 1 AND cargo = 'VENDEDOR' ORDER BY 1 LIMIT 1 \gset
SELECT id_categoria AS cat_camisetas FROM categoria WHERE nombre = 'Camisetas' \gset
SELECT id_categoria AS cat_jeans FROM categoria WHERE nombre = 'Jeans' \gset
SELECT id_categoria AS cat_abrigos FROM categoria WHERE nombre = 'Abrigos' \gset
SELECT id_categoria AS cat_gabardinas FROM categoria WHERE nombre = 'Gabardinas y Paños' \gset
SELECT id_categoria AS cat_ropa FROM categoria WHERE nombre = 'Ropa' \gset
SELECT id_marca AS marca_urbano FROM marca WHERE nombre = 'Urbano 57' \gset
UPDATE inventario SET stock = 5 WHERE id_sucursal = 1 AND id_variante IN (:v1, :v2);
UPDATE inventario SET stock = 40 WHERE id_sucursal = 6 AND id_variante IN (:v1, :v2);
\echo 'Variantes de prueba:' :v1 ',' :v2

\echo
\echo '=== 1. sp_registrar_cliente ==='
\echo '-- 1.1 cliente nuevo (esperado codigo 0)'
CALL sp_registrar_cliente('CC', '1098765432', 'Ana María', 'Pérez Ríos', 'ANA.PEREZ@correo.com', '3001234567', NULL, NULL, NULL);
\echo '-- 1.2 documento duplicado (esperado codigo 4)'
CALL sp_registrar_cliente('CC', '1098765432', 'Otra', 'Persona', 'otra@correo.com', NULL, NULL, NULL, NULL);
\echo '-- 1.3 correo invalido (esperado codigo 5)'
CALL sp_registrar_cliente('CC', '1098765433', 'Luis', 'Soto', 'correo-sin-arroba', NULL, NULL, NULL, NULL);
SELECT id_cliente AS c_nuevo FROM cliente WHERE documento = '1098765432' \gset
SELECT email, (SELECT nivel FROM perfil_fidelizacion WHERE id_cliente = :c_nuevo) AS nivel_inicial FROM cliente WHERE id_cliente = :c_nuevo;

\echo
\echo '=== 2. sp_crear_pedido ==='
\echo '-- 2.1 venta ONLINE a domicilio, 2 productos (esperado codigo 0)'
INSERT INTO direccion_cliente (id_cliente, alias, direccion, id_ciudad, es_principal)
VALUES (:c_nuevo, 'Casa', 'Calle 100 # 15-20', 1, true);
SELECT id_direccion AS dir1 FROM direccion_cliente WHERE id_cliente = :c_nuevo \gset
CALL sp_crear_pedido(:c_nuevo, 6, NULL, 'ONLINE', 'DOMICILIO', :dir1,
     ('[{"id_variante":' || :v1 || ',"cantidad":2},{"id_variante":' || :v2 || ',"cantidad":1}]')::jsonb,
     'PSE', NULL, NULL, NULL);
SELECT max(id_pedido) AS ped1 FROM pedido WHERE id_cliente = :c_nuevo \gset
SELECT id_pedido, estado, subtotal, descuento_total, costo_envio, total, fn_total_pedido(id_pedido) AS total_calculado FROM pedido WHERE id_pedido = :ped1;
SELECT num_linea, id_variante, cantidad, precio_unitario, descuento_unitario, subtotal_linea FROM detalle_pedido WHERE id_pedido = :ped1 ORDER BY 1;
SELECT metodo, monto, estado FROM pago WHERE id_pedido = :ped1;
\echo '-- kardex generado por el trigger (salida de venta):'
SELECT id_sucursal, id_variante, tipo, cantidad, stock_resultante FROM movimiento_inventario
 WHERE id_variante IN (:v1, :v2) AND tipo = 'SALIDA_VENTA' ORDER BY id_movimiento DESC LIMIT 2;

\echo '-- 2.2 stock insuficiente: ATOMICIDAD (esperado codigo 2 y NADA queda guardado)'
SELECT count(*) AS pedidos_antes, (SELECT stock FROM inventario WHERE id_sucursal=1 AND id_variante=:v1) AS stock_v1_antes FROM pedido \gset
CALL sp_crear_pedido(:c_nuevo, 1, :emp1,
     'TIENDA', 'VENTA_MOSTRADOR', NULL,
     ('[{"id_variante":' || :v2 || ',"cantidad":1},{"id_variante":' || :v1 || ',"cantidad":99}]')::jsonb,
     'EFECTIVO', NULL, NULL, NULL);
SELECT count(*) - :pedidos_antes AS pedidos_nuevos,
       (SELECT stock FROM inventario WHERE id_sucursal=1 AND id_variante=:v1) - :stock_v1_antes AS cambio_stock_v1,
       (SELECT stock FROM inventario WHERE id_sucursal=1 AND id_variante=:v2) AS stock_v2_sigue_en_5 FROM pedido;

\echo '-- 2.3 carrito vacio (esperado codigo 1)'
CALL sp_crear_pedido(:c_nuevo, 6, NULL, 'ONLINE', 'DOMICILIO', :dir1, '[]'::jsonb, 'PSE', NULL, NULL, NULL);
\echo '-- 2.4 cliente inexistente (esperado codigo 1)'
CALL sp_crear_pedido(999999, 6, NULL, 'ONLINE', 'DOMICILIO', :dir1, ('[{"id_variante":' || :v1 || ',"cantidad":1}]')::jsonb, 'PSE', NULL, NULL, NULL);
\echo '-- 2.5 domicilio sin direccion (esperado codigo 5: viola CHECK)'
CALL sp_crear_pedido(:c_nuevo, 6, NULL, 'ONLINE', 'DOMICILIO', NULL, ('[{"id_variante":' || :v1 || ',"cantidad":1}]')::jsonb, 'PSE', NULL, NULL, NULL);
\echo '-- 2.6 direccion de OTRO cliente (esperado codigo 5: FK compuesta)'
SELECT min(id_direccion) AS dir_ajena FROM direccion_cliente WHERE id_cliente <> :c_nuevo \gset
CALL sp_crear_pedido(:c_nuevo, 6, NULL, 'ONLINE', 'DOMICILIO', :dir_ajena,
     ('[{"id_variante":' || :v1 || ',"cantidad":1}]')::jsonb, 'PSE', NULL, NULL, NULL);
\echo '-- 2.7 venta de mostrador en tienda (esperado codigo 0, queda ENTREGADO y suma puntos)'
SELECT puntos AS puntos_antes FROM perfil_fidelizacion WHERE id_cliente = :c_nuevo \gset
CALL sp_crear_pedido(:c_nuevo, 1, :emp1,
     'TIENDA', 'VENTA_MOSTRADOR', NULL, ('[{"id_variante":' || :v2 || ',"cantidad":2}]')::jsonb, 'TARJETA_DEBITO', NULL, NULL, NULL);
SELECT max(id_pedido) AS ped2 FROM pedido WHERE id_cliente = :c_nuevo \gset
SELECT p.id_pedido, p.estado, p.total, f.puntos - :puntos_antes AS puntos_ganados, f.nivel
  FROM pedido p JOIN perfil_fidelizacion f USING (id_cliente) WHERE p.id_pedido = :ped2;

\echo
\echo '=== 3. sp_cambiar_estado_pedido y maquina de estados ==='
\echo '-- 3.1 transicion invalida ENTREGADO -> PAGADO (esperado codigo 3)'
CALL sp_cambiar_estado_pedido(:ped2, 'PAGADO', NULL, NULL);
\echo '-- 3.1b cambiar al mismo estado (esperado codigo 3)'
CALL sp_cambiar_estado_pedido(:ped1, 'PAGADO', NULL, NULL);
\echo '-- 3.2 PAGADO -> ENVIADO se salta un paso (esperado codigo 3)'
CALL sp_cambiar_estado_pedido(:ped1, 'ENVIADO', NULL, NULL);
\echo '-- 3.3 flujo normal PAGADO -> EN_PREPARACION -> ENVIADO -> ENTREGADO (codigo 0 x3)'
CALL sp_cambiar_estado_pedido(:ped1, 'EN_PREPARACION', NULL, NULL);
CALL sp_cambiar_estado_pedido(:ped1, 'ENVIADO', NULL, NULL);
\echo '-- 3.3b con el pedido ENVIADO ya no se pueden tocar sus lineas (trigger, esperado ERROR TR003):'
\set ON_ERROR_STOP off
UPDATE detalle_pedido SET cantidad = 5 WHERE id_pedido = :ped1 AND num_linea = 1;
\set ON_ERROR_STOP on
CALL sp_cambiar_estado_pedido(:ped1, 'ENTREGADO', NULL, NULL);
\echo '-- 3.4 pedido inexistente (esperado codigo 1)'
CALL sp_cambiar_estado_pedido(999999, 'PAGADO', NULL, NULL);
\echo '-- 3.5 trigger directo: UPDATE saltando el procedimiento (esperado ERROR TR002):'
\set ON_ERROR_STOP off
UPDATE pedido SET estado = 'CREADO' WHERE id_pedido = :ped1;
\set ON_ERROR_STOP on

\echo '-- 3.6 cancelar un pedido devuelve el stock y reembolsa el pago'
SELECT stock AS stock_antes FROM inventario WHERE id_sucursal = 6 AND id_variante = :v1 \gset
CALL sp_crear_pedido(:c_nuevo, 6, NULL, 'ONLINE', 'DOMICILIO', :dir1, ('[{"id_variante":' || :v1 || ',"cantidad":3}]')::jsonb, 'NEQUI', NULL, NULL, NULL);
SELECT max(id_pedido) AS ped3 FROM pedido WHERE id_cliente = :c_nuevo \gset
SELECT stock AS stock_vendido FROM inventario WHERE id_sucursal = 6 AND id_variante = :v1 \gset
CALL sp_cambiar_estado_pedido(:ped3, 'CANCELADO', NULL, NULL);
SELECT :stock_antes AS stock_antes, :stock_vendido AS tras_venta,
       (SELECT stock FROM inventario WHERE id_sucursal = 6 AND id_variante = :v1) AS tras_cancelar,
       (SELECT estado FROM pago WHERE id_pedido = :ped3) AS estado_pago,
       (SELECT estado FROM pedido WHERE id_pedido = :ped3) AS estado_pedido;

\echo
\echo '=== 4. sp_registrar_devolucion ==='
\echo '-- 4.1 devolver 1 de las 2 unidades del pedido de mostrador (esperado codigo 0)'
CALL sp_registrar_devolucion(:ped2, 1, 1, 'TALLA_INCORRECTA', NULL, NULL, NULL);
\echo '-- 4.2 devolver mas de lo disponible: quedaba 1, se piden 2 (esperado codigo 7)'
CALL sp_registrar_devolucion(:ped2, 1, 2, 'NO_ME_GUSTO', NULL, NULL, NULL);
\echo '-- 4.3 pedido no entregado (esperado codigo 7)'
CALL sp_registrar_devolucion(:ped3, 1, 1, 'OTRO', NULL, NULL, NULL);
\echo '-- 4.4 linea inexistente (esperado codigo 1)'
CALL sp_registrar_devolucion(:ped2, 9, 1, 'OTRO', NULL, NULL, NULL);
\echo '-- 4.5 devolucion por DEFECTO NO reingresa stock'
SELECT stock AS stock_pre FROM inventario WHERE id_sucursal = 1 AND id_variante = :v2 \gset
CALL sp_registrar_devolucion(:ped2, 1, 1, 'DEFECTO', NULL, NULL, NULL);
SELECT stock - :stock_pre AS cambio_stock FROM inventario WHERE id_sucursal = 1 AND id_variante = :v2;
SELECT id_devolucion, cantidad, motivo, monto_reembolsado, reingresa_stock FROM devolucion WHERE id_pedido = :ped2 ORDER BY 1;

\echo
\echo '=== 5. sp_ajustar_stock ==='
\echo '-- 5.1 entrada de mercancia (esperado codigo 0)'
CALL sp_ajustar_stock(2, :v1, 20, 'ENTRADA_COMPRA', NULL, NULL);
\echo '-- 5.2 ajuste que dejaria negativo (esperado codigo 5, el stock no cambia)'
CALL sp_ajustar_stock(2, :v1, -9999, 'AJUSTE', NULL, NULL);
\echo '-- 5.3 tipo invalido (esperado codigo 1)'
CALL sp_ajustar_stock(2, :v1, 1, 'VENTA', NULL, NULL);
SELECT tipo, cantidad, stock_resultante FROM movimiento_inventario WHERE id_sucursal = 2 AND id_variante = :v1 ORDER BY id_movimiento DESC LIMIT 2;

\echo
\echo '=== 6. sp_transferir_stock ==='
\echo '-- 6.1 transferencia valida bodega(6) -> tienda 3 (esperado codigo 0)'
CALL sp_transferir_stock(6, 3, :v1, 10, NULL, NULL);
\echo '-- 6.2 stock insuficiente en origen (esperado codigo 2)'
CALL sp_transferir_stock(3, 6, :v1, 5000, NULL, NULL);
\echo '-- 6.3 origen = destino (esperado codigo 1)'
CALL sp_transferir_stock(3, 3, :v1, 1, NULL, NULL);
SELECT id_sucursal, tipo, cantidad, stock_resultante FROM movimiento_inventario
 WHERE id_variante = :v1 AND tipo LIKE 'TRANSFERENCIA%' ORDER BY id_movimiento DESC LIMIT 2;

\echo
\echo '=== 7. sp_reponer_stock_bajo (cursor explicito) ==='
UPDATE inventario SET stock = stock_minimo + 50 WHERE id_sucursal = 4;      -- ninguna variante en alerta
UPDATE inventario SET stock = 1 WHERE id_sucursal = 4 AND id_variante IN (:v1, :v2);
CALL sp_reponer_stock_bajo(4, 6, NULL, NULL, NULL);
SELECT id_variante, stock, stock_minimo FROM inventario WHERE id_sucursal = 4 AND id_variante IN (:v1, :v2) ORDER BY 1;

\echo
\echo '=== 8. sp_crear_producto y sp_actualizar_precio (+ trigger de auditoria) ==='
\echo '-- 8.1 producto nuevo con 3 tallas x 2 colores = 6 variantes (esperado codigo 0)'
CALL sp_crear_producto('Camiseta prueba entrega', 'Producto de prueba', :cat_camisetas,
     :marca_urbano, 'UNISEX', 45900, ARRAY['S','M','L'], ARRAY['Negro','Blanco'], NULL, NULL, NULL);
SELECT max(id_producto) AS prod_nuevo FROM producto \gset
SELECT count(*) AS variantes, count(*) FILTER (WHERE sku LIKE 'P' || lpad(:prod_nuevo::text, 4, '0') || '-%') AS skus_correctos,
       (SELECT count(*) FROM inventario i JOIN variante_producto v USING (id_variante) WHERE v.id_producto = :prod_nuevo) AS filas_inventario
  FROM variante_producto WHERE id_producto = :prod_nuevo;
\echo '-- 8.2 producto repetido: tallas duplicadas (esperado codigo 4 y NO queda producto huerfano)'
SELECT count(*) AS productos_antes FROM producto \gset
CALL sp_crear_producto('Producto duplicado', 'x', :cat_camisetas,
     :marca_urbano, 'UNISEX', 10000, ARRAY['S','S'], ARRAY['Negro'], NULL, NULL, NULL);
SELECT count(*) - :productos_antes AS productos_nuevos FROM producto;
\echo '-- 8.3 categoria inexistente (esperado codigo 1)'
CALL sp_crear_producto('Sin categoria', 'x', 99999, 1, 'UNISEX', 10000, ARRAY['S'], ARRAY['Negro'], NULL, NULL, NULL);
\echo '-- 8.4 cambio de precio y precio invalido'
CALL sp_actualizar_precio(:prod_nuevo, 49900, NULL, NULL);
CALL sp_actualizar_precio(:prod_nuevo, -5, NULL, NULL);
SELECT precio_anterior, precio_nuevo, usuario_bd FROM auditoria_precio WHERE id_producto = :prod_nuevo;

\echo
\echo '=== 9. sp_ajuste_masivo_precios (COMMIT y ROLLBACK explicitos) ==='
SELECT sum(precio_base) AS suma_jeans_antes FROM producto WHERE id_categoria = (SELECT id_categoria FROM categoria WHERE nombre = 'Jeans') \gset
\echo '-- 9.1 +10% a Jeans (esperado codigo 0, COMMIT)'
CALL sp_ajuste_masivo_precios(:cat_jeans, 10, NULL, NULL, NULL);
SELECT round(sum(precio_base) / :suma_jeans_antes, 3) AS razon_despues_antes FROM producto WHERE id_categoria = (SELECT id_categoria FROM categoria WHERE nombre = 'Jeans');
\echo '-- 9.2 +1000% a Abrigos: algun precio superaria $1.500.000 (esperado codigo 5, ROLLBACK)'
SELECT sum(precio_base) AS suma_abrigos_antes FROM producto WHERE id_categoria = (SELECT id_categoria FROM categoria WHERE nombre = 'Gabardinas y Paños') \gset
CALL sp_ajuste_masivo_precios(:cat_abrigos, 1000, NULL, NULL, NULL);
SELECT sum(precio_base) - :suma_abrigos_antes AS cambio_en_abrigos FROM producto WHERE id_categoria = (SELECT id_categoria FROM categoria WHERE nombre = 'Gabardinas y Paños');
\echo '-- 9.3 -100%: precio quedaria en cero, viola CHECK (esperado codigo 5, ROLLBACK)'
CALL sp_ajuste_masivo_precios(:cat_ropa, -100, NULL, NULL, NULL);
\echo '-- 9.4 categoria inexistente (esperado codigo 1)'
CALL sp_ajuste_masivo_precios(99999, 5, NULL, NULL, NULL);

\echo
\echo '=== 10. Funciones ==='
SELECT fn_nivel_fidelizacion(999) AS n999, fn_nivel_fidelizacion(1000) AS n1000, fn_nivel_fidelizacion(3000) AS n3000;
SELECT fn_costo_envio(150000, 'DOMICILIO') AS envio_pagado, fn_costo_envio(200000, 'DOMICILIO') AS envio_gratis, fn_costo_envio(50000, 'RECOGER_EN_TIENDA') AS recoger;
SELECT p.nombre, fn_descuento_unitario(p.id_producto, DATE '2026-11-04') AS descuento_hoy, fn_descuento_unitario(p.id_producto, DATE '2026-11-25') AS descuento_black_friday
  FROM producto p WHERE p.nombre IN ('Jean skinny tiro alto', 'Camiseta básica cuello redondo', 'Bolso tote') ORDER BY p.nombre;
SELECT fn_ventas_netas(DATE '2026-10-01', DATE '2026-10-31') AS ventas_netas_octubre,
       fn_ventas_netas(DATE '2026-10-01', DATE '2026-10-31', 1) AS octubre_sucursal1;
SELECT * FROM fn_top_productos(DATE '2026-01-01', DATE '2026-10-31', 5);
\echo '-- autenticacion:'
SELECT out_nombre, out_rol FROM fn_autenticar('admin', 'Admin2026*');
SELECT count(*) AS filas_con_clave_incorrecta FROM fn_autenticar('admin', 'incorrecta');

\echo
\echo '=== 11. Bitacora de errores generados en esta corrida ==='
SELECT procedimiento, codigo, left(mensaje, 70) AS mensaje, sqlstate_error FROM bitacora_operacion ORDER BY id_bitacora;

\echo
\echo '=== 11b. sp_agregar_direccion ==='
\echo '-- la primera direccion queda como principal; una segunda marcada principal desplaza a la anterior'
CALL sp_registrar_cliente('CC', '1077777777', 'Direcciones', 'Prueba', 'direcciones@correo.com', NULL, NULL, NULL, NULL);
SELECT id_cliente AS c_dir FROM cliente WHERE documento = '1077777777' \gset
CALL sp_agregar_direccion(:c_dir, 'Casa', 'Calle 1 # 2-3', 1, false, NULL, NULL, NULL, NULL);
CALL sp_agregar_direccion(:c_dir, 'Oficina', 'Carrera 4 # 5-6', 1, true, NULL, NULL, NULL, NULL);
SELECT alias, es_principal FROM direccion_cliente WHERE id_cliente = :c_dir ORDER BY id_direccion;
\echo '-- cliente inexistente (esperado codigo 1) y ciudad inexistente (esperado codigo 1)'
CALL sp_agregar_direccion(999999, 'X', 'Y', 1, false, NULL, NULL, NULL, NULL);
CALL sp_agregar_direccion(:c_dir, 'X', 'Y', 9999, false, NULL, NULL, NULL, NULL);

\echo
\echo '=== 12. Seguridad: permisos por rol (se ejecuta como superusuario con SET ROLE) ==='
\set ON_ERROR_STOP off
\echo '-- 12.1 la aplicacion (app_tienda) puede leer vistas'
SET ROLE app_tienda;
SELECT count(*) AS productos_en_catalogo FROM vw_catalogo;
\echo '-- 12.1b las vistas que invocan funciones tambien funcionan (precio_final usa fn_descuento_unitario)'
SELECT nombre, precio_base, descuento_vigente, precio_final FROM vw_catalogo WHERE descuento_vigente > 0 ORDER BY id_producto LIMIT 2;
SELECT fn_ventas_netas(DATE '2026-10-01', DATE '2026-10-31') > 0 AS ventas_netas_ok, (SELECT count(*) FROM fn_top_productos(DATE '2026-01-01', DATE '2026-10-31', 3)) AS top3_filas;
\echo '-- 12.2 la aplicacion NO puede escribir directamente en tablas (esperado: permission denied)'
INSERT INTO cliente (tipo_documento, documento, nombres, apellidos, email) VALUES ('CC', '1', 'x', 'y', 'x@y.com');
UPDATE producto SET precio_base = 1;
DELETE FROM pedido;
\echo '-- 12.3 la aplicacion NO puede leer usuarios ni hashes (esperado: permission denied)'
SELECT * FROM usuario_sistema;
\echo '-- 12.4 pero SI puede operar mediante procedimientos (SECURITY DEFINER)'
CALL sp_registrar_cliente('CC', '1055555555', 'Prueba', 'Seguridad', 'seguridad@correo.com', NULL, NULL, NULL, NULL);
\echo '-- 12.4b TODOS los procedimientos se ejecutan correctamente con el usuario de la aplicacion'
SELECT id_cliente AS c_app FROM vw_clientes WHERE documento = '1055555555' \gset
SELECT id_pedido AS ped_app FROM vw_pedidos WHERE estado = 'ENTREGADO' ORDER BY id_pedido LIMIT 1 \gset
CALL sp_agregar_direccion(:c_app, 'Casa', 'Calle 9 # 8-7', 1, true, NULL, NULL, NULL, NULL);
SELECT id_direccion AS dir_app FROM vw_direcciones WHERE id_cliente = :c_app LIMIT 1 \gset
CALL sp_crear_pedido(:c_app, 6, NULL, 'ONLINE', 'DOMICILIO', :dir_app, ('[{"id_variante":' || :v1 || ',"cantidad":1}]')::jsonb, 'PSE', NULL, NULL, NULL);
SELECT max(id_pedido) AS ped_app2 FROM vw_pedidos WHERE id_cliente = :c_app \gset
CALL sp_cambiar_estado_pedido(:ped_app2, 'EN_PREPARACION', NULL, NULL);
CALL sp_registrar_devolucion(:ped_app, 1, 1, 'OTRO', NULL, NULL, NULL);
CALL sp_ajustar_stock(2, :v2, 5, 'ENTRADA_COMPRA', NULL, NULL);
CALL sp_transferir_stock(6, 2, :v2, 1, NULL, NULL);
CALL sp_crear_producto('Producto desde app', 'x', :cat_camisetas, :marca_urbano, 'UNISEX', 30000, ARRAY['M'], ARRAY['Negro'], NULL, NULL, NULL);
SELECT max(id_producto) AS prod_app FROM vw_catalogo \gset
CALL sp_actualizar_precio(:prod_app, 31000, NULL, NULL);
CALL sp_reponer_stock_bajo(4, 6, NULL, NULL, NULL);
\echo '-- 12.4c el ajuste masivo (COMMIT/ROLLBACK) NO esta concedido a app_tienda (esperado: permission denied) pero SI a app_admin'
CALL sp_ajuste_masivo_precios(:cat_gabardinas, 1, NULL, NULL, NULL);
RESET ROLE;
SET ROLE app_admin;
CALL sp_ajuste_masivo_precios(:cat_gabardinas, 1, NULL, NULL, NULL);
CALL sp_ajuste_masivo_precios(:cat_abrigos, 1000, NULL, NULL, NULL);
RESET ROLE;
SET ROLE app_tienda;
\echo '-- 12.5 no puede ejecutar la rutina interna de bitacora (esperado: permission denied)'
CALL sp_registrar_bitacora('x', NULL, 0, 'x', NULL);
RESET ROLE;

\echo '-- 12.6 seguridad por fila (RLS): el vendedor solo ve pedidos de su sucursal'
SET ROLE demo_vendedor;
SET app.id_sucursal = '1';
SELECT 'sucursal 1' AS sesion, count(*) AS pedidos_visibles, count(DISTINCT id_sucursal) AS sucursales_distintas FROM pedido;
SET app.id_sucursal = '3';
SELECT 'sucursal 3' AS sesion, count(*) AS pedidos_visibles, count(DISTINCT id_sucursal) AS sucursales_distintas FROM pedido;
RESET app.id_sucursal;
SELECT 'sin sucursal' AS sesion, count(*) AS pedidos_visibles FROM pedido;
\echo '-- 12.7 el vendedor no puede borrar ni leer clientes (esperado: permission denied)'
DELETE FROM pedido;
SELECT * FROM cliente LIMIT 1;
RESET ROLE;

\echo '-- 12.8 el analista solo ve indicadores, no datos personales'
SET ROLE demo_analista;
SELECT count(*) > 0 AS ve_ventas_diarias FROM vw_ventas_diarias;
SELECT * FROM vw_clientes LIMIT 1;
SELECT * FROM cliente LIMIT 1;
RESET ROLE;

\echo '-- 12.9 las contrasenas estan cifradas con bcrypt (no se almacenan en claro)'
SELECT username, left(password_hash, 7) AS prefijo_hash, length(password_hash) AS longitud FROM usuario_sistema ORDER BY 1 LIMIT 3;
\set ON_ERROR_STOP on
