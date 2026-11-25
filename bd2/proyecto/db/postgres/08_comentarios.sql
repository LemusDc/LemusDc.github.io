-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 08_comentarios.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: comentarios de tablas y columnas (diccionario de datos
--   dentro del catalogo). Generado desde scripts/diccionario.py.
--   Consulta: \d+ tienda.pedido  o  obj_description / col_description.
-- =====================================================================
\set ON_ERROR_STOP on
SET search_path = tienda, extensiones;

COMMENT ON TABLE tienda.ciudad IS 'Ciudades donde hay sucursales o direcciones de clientes.';
COMMENT ON COLUMN tienda.ciudad.id_ciudad IS 'Identificador unico de la ciudad.';
COMMENT ON COLUMN tienda.ciudad.nombre IS 'Nombre de la ciudad.';
COMMENT ON COLUMN tienda.ciudad.departamento IS 'Departamento al que pertenece la ciudad.';

COMMENT ON TABLE tienda.sucursal IS 'Puntos de venta: tiendas fisicas y la tienda virtual con su bodega central.';
COMMENT ON COLUMN tienda.sucursal.id_sucursal IS 'Identificador unico de la sucursal.';
COMMENT ON COLUMN tienda.sucursal.nombre IS 'Nombre comercial de la sucursal (unico).';
COMMENT ON COLUMN tienda.sucursal.tipo IS 'FISICA para tiendas con atencion al publico; ONLINE para la tienda virtual y bodega.';
COMMENT ON COLUMN tienda.sucursal.direccion IS 'Direccion de la tienda fisica; vacia para la tienda virtual.';
COMMENT ON COLUMN tienda.sucursal.id_ciudad IS 'Ciudad donde opera la sucursal.';
COMMENT ON COLUMN tienda.sucursal.telefono IS 'Telefono de contacto.';
COMMENT ON COLUMN tienda.sucursal.activa IS 'Indica si la sucursal esta en operacion.';

COMMENT ON TABLE tienda.empleado IS 'Personal de la tienda asignado a una sucursal.';
COMMENT ON COLUMN tienda.empleado.id_empleado IS 'Identificador unico del empleado.';
COMMENT ON COLUMN tienda.empleado.id_sucursal IS 'Sucursal donde trabaja.';
COMMENT ON COLUMN tienda.empleado.documento IS 'Numero de documento de identidad (unico).';
COMMENT ON COLUMN tienda.empleado.nombres IS 'Nombres del empleado.';
COMMENT ON COLUMN tienda.empleado.apellidos IS 'Apellidos del empleado.';
COMMENT ON COLUMN tienda.empleado.cargo IS 'GERENTE, VENDEDOR, CAJERO, BODEGUERO o ADMIN.';
COMMENT ON COLUMN tienda.empleado.fecha_ingreso IS 'Fecha de vinculacion.';
COMMENT ON COLUMN tienda.empleado.activo IS 'Indica si el empleado sigue vinculado.';

COMMENT ON TABLE tienda.usuario_sistema IS 'Cuenta de acceso al sistema; relacion 1:1 con empleado. La contrasena se guarda cifrada con bcrypt.';
COMMENT ON COLUMN tienda.usuario_sistema.id_empleado IS 'Empleado dueno de la cuenta; es llave primaria y foranea a la vez (relacion 1:1).';
COMMENT ON COLUMN tienda.usuario_sistema.username IS 'Nombre de usuario para iniciar sesion (unico).';
COMMENT ON COLUMN tienda.usuario_sistema.password_hash IS 'Hash bcrypt de la contrasena; nunca se almacena en claro.';
COMMENT ON COLUMN tienda.usuario_sistema.rol IS 'Perfil funcional: ADMIN, VENDEDOR o ANALISTA.';
COMMENT ON COLUMN tienda.usuario_sistema.ultimo_acceso IS 'Fecha y hora del ultimo inicio de sesion exitoso.';
COMMENT ON COLUMN tienda.usuario_sistema.activo IS 'Indica si la cuenta esta habilitada.';

COMMENT ON TABLE tienda.cliente IS 'Personas que compran en la tienda, en linea o en mostrador.';
COMMENT ON COLUMN tienda.cliente.id_cliente IS 'Identificador unico del cliente.';
COMMENT ON COLUMN tienda.cliente.tipo_documento IS 'CC, CE, TI, PAS o NIT.';
COMMENT ON COLUMN tienda.cliente.documento IS 'Numero de documento; unico junto con el tipo.';
COMMENT ON COLUMN tienda.cliente.nombres IS 'Nombres del cliente.';
COMMENT ON COLUMN tienda.cliente.apellidos IS 'Apellidos del cliente.';
COMMENT ON COLUMN tienda.cliente.email IS 'Correo electronico en minusculas y con formato validado (unico).';
COMMENT ON COLUMN tienda.cliente.telefono IS 'Telefono celular de contacto.';
COMMENT ON COLUMN tienda.cliente.fecha_registro IS 'Momento en que se registro el cliente.';
COMMENT ON COLUMN tienda.cliente.activo IS 'Indica si el cliente puede comprar.';

COMMENT ON TABLE tienda.perfil_fidelizacion IS 'Puntos y nivel del programa de fidelizacion; relacion 1:1 con cliente.';
COMMENT ON COLUMN tienda.perfil_fidelizacion.id_cliente IS 'Cliente propietario del perfil; llave primaria y foranea (relacion 1:1).';
COMMENT ON COLUMN tienda.perfil_fidelizacion.puntos IS 'Puntos acumulados (1 por cada $1.000 comprados). No puede ser negativo.';
COMMENT ON COLUMN tienda.perfil_fidelizacion.nivel IS 'BASICO, PLATA (desde 1.000 puntos) u ORO (desde 3.000).';
COMMENT ON COLUMN tienda.perfil_fidelizacion.fecha_actualizacion IS 'Ultima vez que cambiaron los puntos.';

COMMENT ON TABLE tienda.direccion_cliente IS 'Direcciones de entrega de un cliente (relacion 1:N con cliente).';
COMMENT ON COLUMN tienda.direccion_cliente.id_direccion IS 'Identificador unico de la direccion.';
COMMENT ON COLUMN tienda.direccion_cliente.id_cliente IS 'Cliente al que pertenece.';
COMMENT ON COLUMN tienda.direccion_cliente.alias IS 'Nombre corto: Casa, Trabajo, etc.';
COMMENT ON COLUMN tienda.direccion_cliente.direccion IS 'Direccion de entrega.';
COMMENT ON COLUMN tienda.direccion_cliente.id_ciudad IS 'Ciudad de la direccion.';
COMMENT ON COLUMN tienda.direccion_cliente.es_principal IS 'Marca la direccion principal; solo puede haber una por cliente.';
COMMENT ON COLUMN tienda.direccion_cliente.telefono_contacto IS 'Telefono de quien recibe.';

COMMENT ON TABLE tienda.categoria IS 'Arbol de categorias de producto (autorrelacion jerarquica).';
COMMENT ON COLUMN tienda.categoria.id_categoria IS 'Identificador unico de la categoria.';
COMMENT ON COLUMN tienda.categoria.nombre IS 'Nombre de la categoria (unico).';
COMMENT ON COLUMN tienda.categoria.id_categoria_padre IS 'Categoria superior; vacia en las categorias raiz.';

COMMENT ON TABLE tienda.marca IS 'Marcas comercializadas.';
COMMENT ON COLUMN tienda.marca.id_marca IS 'Identificador unico de la marca.';
COMMENT ON COLUMN tienda.marca.nombre IS 'Nombre de la marca (unico).';

COMMENT ON TABLE tienda.producto IS 'Articulo del catalogo, sin talla ni color. Las existencias se manejan por variante.';
COMMENT ON COLUMN tienda.producto.id_producto IS 'Identificador unico del producto.';
COMMENT ON COLUMN tienda.producto.nombre IS 'Nombre comercial.';
COMMENT ON COLUMN tienda.producto.descripcion IS 'Descripcion corta.';
COMMENT ON COLUMN tienda.producto.id_categoria IS 'Categoria a la que pertenece.';
COMMENT ON COLUMN tienda.producto.id_marca IS 'Marca del producto.';
COMMENT ON COLUMN tienda.producto.genero IS 'MUJER, HOMBRE, NINA, NINO o UNISEX.';
COMMENT ON COLUMN tienda.producto.precio_base IS 'Precio de lista en pesos colombianos; debe ser mayor que cero.';
COMMENT ON COLUMN tienda.producto.activo IS 'Indica si el producto se puede vender.';
COMMENT ON COLUMN tienda.producto.fecha_creacion IS 'Fecha en que se creo el producto.';

COMMENT ON TABLE tienda.variante_producto IS 'Combinacion de talla y color de un producto; es la unidad que se inventaria y se vende.';
COMMENT ON COLUMN tienda.variante_producto.id_variante IS 'Identificador unico de la variante.';
COMMENT ON COLUMN tienda.variante_producto.id_producto IS 'Producto del que es variante.';
COMMENT ON COLUMN tienda.variante_producto.talla IS 'Talla (XS a XL, numerica o U de unica).';
COMMENT ON COLUMN tienda.variante_producto.color IS 'Color de la prenda.';
COMMENT ON COLUMN tienda.variante_producto.sku IS 'Codigo unico de inventario generado por el sistema.';
COMMENT ON COLUMN tienda.variante_producto.activa IS 'Indica si la variante se puede vender.';

COMMENT ON TABLE tienda.inventario IS 'Existencias de cada variante en cada sucursal (relacion N:M entre sucursal y variante).';
COMMENT ON COLUMN tienda.inventario.id_sucursal IS 'Sucursal donde esta el stock.';
COMMENT ON COLUMN tienda.inventario.id_variante IS 'Variante almacenada.';
COMMENT ON COLUMN tienda.inventario.stock IS 'Unidades disponibles; nunca negativo.';
COMMENT ON COLUMN tienda.inventario.stock_minimo IS 'Umbral para alertar reposicion.';
COMMENT ON COLUMN tienda.inventario.ultima_actualizacion IS 'Ultimo cambio de stock, mantenido por trigger.';

COMMENT ON TABLE tienda.movimiento_inventario IS 'Kardex: historial de entradas y salidas, generado automaticamente por trigger.';
COMMENT ON COLUMN tienda.movimiento_inventario.id_movimiento IS 'Identificador consecutivo del movimiento.';
COMMENT ON COLUMN tienda.movimiento_inventario.id_sucursal IS 'Sucursal afectada.';
COMMENT ON COLUMN tienda.movimiento_inventario.id_variante IS 'Variante afectada.';
COMMENT ON COLUMN tienda.movimiento_inventario.tipo IS 'Causa: INVENTARIO_INICIAL, ENTRADA_COMPRA, SALIDA_VENTA, ANULACION_PEDIDO, DEVOLUCION_CLIENTE, TRANSFERENCIA_ENTRADA, TRANSFERENCIA_SALIDA o AJUSTE.';
COMMENT ON COLUMN tienda.movimiento_inventario.cantidad IS 'Unidades con signo: positivo entra, negativo sale.';
COMMENT ON COLUMN tienda.movimiento_inventario.stock_resultante IS 'Stock de la sucursal despues del movimiento.';
COMMENT ON COLUMN tienda.movimiento_inventario.fecha IS 'Momento del movimiento.';
COMMENT ON COLUMN tienda.movimiento_inventario.usuario_bd IS 'Usuario de base de datos que lo ejecuto.';

COMMENT ON TABLE tienda.auditoria_precio IS 'Historial de cambios de precio, generado por trigger.';
COMMENT ON COLUMN tienda.auditoria_precio.id_auditoria IS 'Identificador consecutivo.';
COMMENT ON COLUMN tienda.auditoria_precio.id_producto IS 'Producto cuyo precio cambio.';
COMMENT ON COLUMN tienda.auditoria_precio.precio_anterior IS 'Precio antes del cambio.';
COMMENT ON COLUMN tienda.auditoria_precio.precio_nuevo IS 'Precio despues del cambio.';
COMMENT ON COLUMN tienda.auditoria_precio.fecha IS 'Momento del cambio.';
COMMENT ON COLUMN tienda.auditoria_precio.usuario_bd IS 'Usuario de base de datos que lo hizo.';

COMMENT ON TABLE tienda.promocion IS 'Campanas de descuento con vigencia.';
COMMENT ON COLUMN tienda.promocion.id_promocion IS 'Identificador unico de la promocion.';
COMMENT ON COLUMN tienda.promocion.nombre IS 'Nombre de la campana.';
COMMENT ON COLUMN tienda.promocion.tipo_descuento IS 'PORCENTAJE (maximo 90) o MONTO fijo en pesos.';
COMMENT ON COLUMN tienda.promocion.valor IS 'Porcentaje o monto del descuento, siempre mayor que cero.';
COMMENT ON COLUMN tienda.promocion.fecha_inicio IS 'Primer dia de vigencia.';
COMMENT ON COLUMN tienda.promocion.fecha_fin IS 'Ultimo dia de vigencia; no puede ser anterior al inicio.';
COMMENT ON COLUMN tienda.promocion.activa IS 'Permite apagar una promocion sin borrarla.';

COMMENT ON TABLE tienda.promocion_producto IS 'Productos incluidos en cada promocion (relacion N:M).';
COMMENT ON COLUMN tienda.promocion_producto.id_promocion IS 'Promocion aplicada.';
COMMENT ON COLUMN tienda.promocion_producto.id_producto IS 'Producto que participa.';

COMMENT ON TABLE tienda.pedido IS 'Encabezado de una venta, ya sea en mostrador o en linea.';
COMMENT ON COLUMN tienda.pedido.id_pedido IS 'Identificador unico del pedido.';
COMMENT ON COLUMN tienda.pedido.id_cliente IS 'Cliente que compra.';
COMMENT ON COLUMN tienda.pedido.id_sucursal IS 'Sucursal que vende o despacha.';
COMMENT ON COLUMN tienda.pedido.id_empleado IS 'Empleado que atendio la venta de mostrador; vacio en pedidos en linea.';
COMMENT ON COLUMN tienda.pedido.canal IS 'TIENDA u ONLINE.';
COMMENT ON COLUMN tienda.pedido.tipo_entrega IS 'VENTA_MOSTRADOR, DOMICILIO o RECOGER_EN_TIENDA.';
COMMENT ON COLUMN tienda.pedido.estado IS 'CREADO, PAGADO, EN_PREPARACION, ENVIADO, ENTREGADO o CANCELADO; las transiciones las valida un trigger.';
COMMENT ON COLUMN tienda.pedido.fecha_pedido IS 'Momento en que se hizo el pedido.';
COMMENT ON COLUMN tienda.pedido.id_direccion_envio IS 'Direccion de entrega; obligatoria solo si es a domicilio y debe ser del mismo cliente.';
COMMENT ON COLUMN tienda.pedido.subtotal IS 'Suma de precio por cantidad, antes de descuentos (calculado por trigger).';
COMMENT ON COLUMN tienda.pedido.descuento_total IS 'Suma de descuentos de las lineas (calculado por trigger).';
COMMENT ON COLUMN tienda.pedido.costo_envio IS 'Valor del envio a domicilio.';
COMMENT ON COLUMN tienda.pedido.total IS 'subtotal - descuento_total + costo_envio (calculado por trigger).';

COMMENT ON TABLE tienda.detalle_pedido IS 'Lineas de un pedido (entidad debil: depende de pedido).';
COMMENT ON COLUMN tienda.detalle_pedido.id_pedido IS 'Pedido al que pertenece la linea.';
COMMENT ON COLUMN tienda.detalle_pedido.num_linea IS 'Numero de linea dentro del pedido.';
COMMENT ON COLUMN tienda.detalle_pedido.id_variante IS 'Variante vendida.';
COMMENT ON COLUMN tienda.detalle_pedido.cantidad IS 'Unidades vendidas; mayor que cero.';
COMMENT ON COLUMN tienda.detalle_pedido.precio_unitario IS 'Precio de lista vigente al momento de la venta.';
COMMENT ON COLUMN tienda.detalle_pedido.descuento_unitario IS 'Descuento por unidad aplicado; no puede superar el precio.';
COMMENT ON COLUMN tienda.detalle_pedido.subtotal_linea IS 'cantidad x (precio_unitario - descuento_unitario); columna generada.';

COMMENT ON TABLE tienda.pago IS 'Pagos asociados a un pedido (relacion 1:N).';
COMMENT ON COLUMN tienda.pago.id_pago IS 'Identificador unico del pago.';
COMMENT ON COLUMN tienda.pago.id_pedido IS 'Pedido que se paga.';
COMMENT ON COLUMN tienda.pago.metodo IS 'EFECTIVO, TARJETA_CREDITO, TARJETA_DEBITO, PSE, NEQUI o TRANSFERENCIA.';
COMMENT ON COLUMN tienda.pago.monto IS 'Valor pagado; mayor que cero.';
COMMENT ON COLUMN tienda.pago.estado IS 'APROBADO, RECHAZADO o REEMBOLSADO.';
COMMENT ON COLUMN tienda.pago.fecha_pago IS 'Momento del pago.';
COMMENT ON COLUMN tienda.pago.referencia_externa IS 'Referencia del medio de pago o pasarela.';

COMMENT ON TABLE tienda.devolucion IS 'Devoluciones de prendas de una linea de pedido entregado.';
COMMENT ON COLUMN tienda.devolucion.id_devolucion IS 'Identificador unico de la devolucion.';
COMMENT ON COLUMN tienda.devolucion.id_pedido IS 'Pedido de la linea devuelta (forma parte de la llave foranea compuesta).';
COMMENT ON COLUMN tienda.devolucion.num_linea IS 'Linea devuelta (forma parte de la llave foranea compuesta).';
COMMENT ON COLUMN tienda.devolucion.cantidad IS 'Unidades devueltas; el trigger impide superar lo vendido.';
COMMENT ON COLUMN tienda.devolucion.motivo IS 'TALLA_INCORRECTA, DEFECTO, NO_ME_GUSTO, ERROR_ENVIO u OTRO.';
COMMENT ON COLUMN tienda.devolucion.fecha_devolucion IS 'Momento de la devolucion.';
COMMENT ON COLUMN tienda.devolucion.monto_reembolsado IS 'Valor a reembolsar; lo calcula el trigger con el precio neto de la linea.';
COMMENT ON COLUMN tienda.devolucion.reingresa_stock IS 'Indica si la prenda vuelve al inventario vendible (no si tiene defecto).';

COMMENT ON TABLE tienda.bitacora_operacion IS 'Registro de fallas de los procedimientos almacenados para diagnostico.';
COMMENT ON COLUMN tienda.bitacora_operacion.id_bitacora IS 'Identificador consecutivo.';
COMMENT ON COLUMN tienda.bitacora_operacion.fecha IS 'Momento de la falla.';
COMMENT ON COLUMN tienda.bitacora_operacion.procedimiento IS 'Procedimiento que la reporto.';
COMMENT ON COLUMN tienda.bitacora_operacion.parametros IS 'Parametros relevantes en formato JSON.';
COMMENT ON COLUMN tienda.bitacora_operacion.codigo IS 'Codigo de retorno del procedimiento (ver cabecera de 04_procedimientos.sql).';
COMMENT ON COLUMN tienda.bitacora_operacion.mensaje IS 'Mensaje entregado al usuario.';
COMMENT ON COLUMN tienda.bitacora_operacion.sqlstate_error IS 'Codigo SQLSTATE del error original.';
COMMENT ON COLUMN tienda.bitacora_operacion.usuario_bd IS 'Usuario de base de datos que ejecuto la operacion.';
