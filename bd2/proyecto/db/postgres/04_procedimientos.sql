-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 04_procedimientos.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: procedimientos almacenados. Convencion de retorno:
--   p_codigo  0  operacion exitosa
--             1  validacion de negocio (dato inexistente o no permitido)
--             2  stock insuficiente
--             3  estado del pedido no permite la operacion
--             4  registro duplicado
--             5  dato invalido o violacion de integridad
--             6  conflicto de concurrencia (reintentar)
--             7  devolucion invalida
--            99  error inesperado
--   p_mensaje descripcion legible para el usuario.
-- Codigos SQLSTATE propios adicionales: TR007 validacion de negocio,
--   TR008 ajuste de precios fuera de rango.
-- Todas las fallas se registran en bitacora_operacion.
-- =====================================================================
\set ON_ERROR_STOP on
SET search_path = tienda, extensiones;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: escribe una fila en la bitacora de operaciones.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_registrar_bitacora(
    p_procedimiento text, p_parametros jsonb, p_codigo integer, p_mensaje text, p_sqlstate text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
BEGIN
    INSERT INTO bitacora_operacion (procedimiento, parametros, codigo, mensaje, sqlstate_error)
    VALUES (p_procedimiento, p_parametros, p_codigo, p_mensaje, left(p_sqlstate, 5));
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: registra un cliente y su perfil de fidelizacion (1:1) en
--   una sola unidad atomica: o se crean ambos o ninguno.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_registrar_cliente(
    p_tipo_documento text, p_documento text, p_nombres text, p_apellidos text,
    p_email text, p_telefono text,
    OUT p_codigo integer, OUT p_mensaje text, OUT p_id_cliente integer)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_state text;
BEGIN
    p_codigo := 0; p_mensaje := 'Cliente registrado correctamente'; p_id_cliente := NULL;
    BEGIN
        INSERT INTO cliente (tipo_documento, documento, nombres, apellidos, email, telefono)
        VALUES (p_tipo_documento, p_documento, p_nombres, p_apellidos, p_email, p_telefono)
        RETURNING id_cliente INTO p_id_cliente;

        INSERT INTO perfil_fidelizacion (id_cliente) VALUES (p_id_cliente);
    EXCEPTION
        WHEN unique_violation THEN
            p_codigo := 4; p_mensaje := 'Ya existe un cliente con ese documento o correo electronico';
            v_state := SQLSTATE;
        WHEN SQLSTATE 'TR004' THEN
            p_codigo := 5; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN
            p_codigo := 5; p_mensaje := 'Datos del cliente invalidos: ' || SQLERRM; v_state := SQLSTATE;
        WHEN OTHERS THEN
            p_codigo := 99; p_mensaje := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE;
    END;

    IF p_codigo <> 0 THEN
        p_id_cliente := NULL;
        CALL sp_registrar_bitacora('sp_registrar_cliente',
             jsonb_build_object('documento', p_documento, 'email', p_email), p_codigo, p_mensaje, v_state);
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: crea un pedido completo (encabezado, lineas, descuento,
--   envio, pago, descuento de inventario) de forma ATOMICA.
--   Concurrencia: cada fila de inventario se bloquea con SELECT ... FOR
--   UPDATE en orden ascendente de id_variante (evita deadlocks entre
--   pedidos simultaneos y evita vender dos veces la ultima unidad).
--   Manejo de errores: el bloque BEGIN..EXCEPTION abre un subtransaccion;
--   ante cualquier falla se deshace todo lo hecho dentro del bloque.
--   p_items: arreglo JSON [{"id_variante":10,"cantidad":2}, ...]
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_crear_pedido(
    p_id_cliente integer, p_id_sucursal integer, p_id_empleado integer,
    p_canal text, p_tipo_entrega text, p_id_direccion integer,
    p_items jsonb, p_metodo_pago text,
    OUT p_codigo integer, OUT p_mensaje text, OUT p_id_pedido integer)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_item      record;
    v_n         integer := 0;
    v_stock     integer;
    v_precio    numeric;
    v_producto  integer;
    v_desc      numeric;
    v_neto      numeric;
    v_total     numeric;
    v_state     text;
BEGIN
    p_codigo := 0; p_mensaje := 'Pedido creado correctamente'; p_id_pedido := NULL;
    BEGIN
        -- 1. Validaciones de negocio
        IF NOT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = p_id_cliente AND activo) THEN
            RAISE EXCEPTION 'El cliente % no existe o esta inactivo', p_id_cliente USING ERRCODE = 'TR007';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM sucursal WHERE id_sucursal = p_id_sucursal AND activa) THEN
            RAISE EXCEPTION 'La sucursal % no existe o esta inactiva', p_id_sucursal USING ERRCODE = 'TR007';
        END IF;
        IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
            RAISE EXCEPTION 'El pedido debe tener al menos un producto' USING ERRCODE = 'TR007';
        END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) e
                    WHERE (e->>'cantidad') IS NULL OR (e->>'cantidad')::integer <= 0
                       OR (e->>'id_variante') IS NULL) THEN
            RAISE EXCEPTION 'Cada producto requiere id_variante y una cantidad mayor que cero' USING ERRCODE = 'TR007';
        END IF;
        IF p_tipo_entrega = 'RECOGER_EN_TIENDA'
           AND NOT EXISTS (SELECT 1 FROM sucursal WHERE id_sucursal = p_id_sucursal AND tipo = 'FISICA') THEN
            RAISE EXCEPTION 'Para recoger en tienda la sucursal debe ser fisica' USING ERRCODE = 'TR007';
        END IF;

        -- 2. Encabezado (las restricciones CHECK/FK validan canal, entrega y direccion)
        INSERT INTO pedido (id_cliente, id_sucursal, id_empleado, canal, tipo_entrega, id_direccion_envio)
        VALUES (p_id_cliente, p_id_sucursal, p_id_empleado, p_canal, p_tipo_entrega, p_id_direccion)
        RETURNING id_pedido INTO p_id_pedido;

        -- 3. Lineas: se agrupan variantes repetidas y se recorren en orden de id
        PERFORM set_config('tienda.motivo_mov', 'SALIDA_VENTA', true);
        FOR v_item IN
            SELECT (e->>'id_variante')::integer AS id_variante, SUM((e->>'cantidad')::integer)::integer AS cantidad
              FROM jsonb_array_elements(p_items) e
             GROUP BY 1 ORDER BY 1
        LOOP
            v_n := v_n + 1;

            SELECT i.stock INTO v_stock
              FROM inventario i
             WHERE i.id_sucursal = p_id_sucursal AND i.id_variante = v_item.id_variante
               FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'La variante % no se maneja en la sucursal %', v_item.id_variante, p_id_sucursal
                      USING ERRCODE = 'TR007';
            END IF;
            IF v_stock < v_item.cantidad THEN
                RAISE EXCEPTION 'Stock insuficiente para la variante % (disponible %, solicitado %)',
                      v_item.id_variante, v_stock, v_item.cantidad USING ERRCODE = 'TR001';
            END IF;

            SELECT pr.precio_base, pr.id_producto INTO v_precio, v_producto
              FROM variante_producto v JOIN producto pr ON pr.id_producto = v.id_producto
             WHERE v.id_variante = v_item.id_variante AND v.activa AND pr.activo;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'La variante % no existe o esta inactiva', v_item.id_variante USING ERRCODE = 'TR007';
            END IF;

            v_desc := fn_descuento_unitario(v_producto);

            INSERT INTO detalle_pedido (id_pedido, num_linea, id_variante, cantidad, precio_unitario, descuento_unitario)
            VALUES (p_id_pedido, v_n, v_item.id_variante, v_item.cantidad, v_precio, v_desc);

            UPDATE inventario SET stock = stock - v_item.cantidad
             WHERE id_sucursal = p_id_sucursal AND id_variante = v_item.id_variante;
        END LOOP;
        PERFORM set_config('tienda.motivo_mov', '', true);

        -- 4. Envio y pago (los triggers recalculan subtotal y total)
        SELECT subtotal - descuento_total INTO v_neto FROM pedido WHERE id_pedido = p_id_pedido;
        UPDATE pedido SET costo_envio = fn_costo_envio(v_neto, p_tipo_entrega) WHERE id_pedido = p_id_pedido;
        SELECT total INTO v_total FROM pedido WHERE id_pedido = p_id_pedido;

        INSERT INTO pago (id_pedido, metodo, monto, estado, referencia_externa)
        VALUES (p_id_pedido, p_metodo_pago, v_total, 'APROBADO', 'SIM-' || p_id_pedido);

        UPDATE pedido SET estado = 'PAGADO' WHERE id_pedido = p_id_pedido;
        IF p_canal = 'TIENDA' THEN
            UPDATE pedido SET estado = 'ENTREGADO' WHERE id_pedido = p_id_pedido;   -- venta de mostrador
        END IF;

        p_mensaje := 'Pedido ' || p_id_pedido || ' creado. Total: ' || v_total;
    EXCEPTION
        WHEN SQLSTATE 'TR001' THEN
            p_codigo := 2; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN SQLSTATE 'TR007' THEN
            p_codigo := 1; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN SQLSTATE 'TR002' OR SQLSTATE 'TR003' OR SQLSTATE 'TR005' THEN
            p_codigo := 3; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN unique_violation THEN
            p_codigo := 4; p_mensaje := 'Registro duplicado: ' || SQLERRM; v_state := SQLSTATE;
        WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
            p_codigo := 5; p_mensaje := 'Datos invalidos: ' || SQLERRM; v_state := SQLSTATE;
        WHEN deadlock_detected OR serialization_failure OR lock_not_available THEN
            p_codigo := 6; p_mensaje := 'Conflicto de concurrencia, intente de nuevo'; v_state := SQLSTATE;
        WHEN OTHERS THEN
            p_codigo := 99; p_mensaje := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE;
    END;

    IF p_codigo <> 0 THEN
        p_id_pedido := NULL;
        CALL sp_registrar_bitacora('sp_crear_pedido',
             jsonb_build_object('id_cliente', p_id_cliente, 'id_sucursal', p_id_sucursal,
                                'canal', p_canal, 'items', p_items),
             p_codigo, p_mensaje, v_state);
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: cambia el estado de un pedido. La validez de la
--   transicion la garantiza el trigger trg_pedido_transicion. Al
--   cancelar se devuelve el stock y se reembolsa el pago.
--   El pedido se bloquea (FOR UPDATE) para evitar dos cambios a la vez.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_cambiar_estado_pedido(
    p_id_pedido integer, p_nuevo_estado text,
    OUT p_codigo integer, OUT p_mensaje text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_sucursal integer;
    v_anterior text;
    v_state    text;
BEGIN
    p_codigo := 0; p_mensaje := 'Estado actualizado';
    BEGIN
        SELECT id_sucursal, estado INTO v_sucursal, v_anterior
          FROM pedido WHERE id_pedido = p_id_pedido FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El pedido % no existe', p_id_pedido USING ERRCODE = 'TR007';
        END IF;

        IF v_anterior = p_nuevo_estado THEN
            RAISE EXCEPTION 'El pedido % ya se encuentra en estado %', p_id_pedido, v_anterior USING ERRCODE = 'TR002';
        END IF;

        UPDATE pedido SET estado = p_nuevo_estado WHERE id_pedido = p_id_pedido;   -- valida el trigger

        IF p_nuevo_estado = 'CANCELADO' THEN
            PERFORM set_config('tienda.motivo_mov', 'ANULACION_PEDIDO', true);
            UPDATE inventario i
               SET stock = i.stock + x.cant
              FROM (SELECT id_variante, SUM(cantidad) AS cant
                      FROM detalle_pedido WHERE id_pedido = p_id_pedido GROUP BY id_variante) x
             WHERE i.id_sucursal = v_sucursal AND i.id_variante = x.id_variante;
            PERFORM set_config('tienda.motivo_mov', '', true);
            UPDATE pago SET estado = 'REEMBOLSADO' WHERE id_pedido = p_id_pedido AND estado = 'APROBADO';
        END IF;

        p_mensaje := 'Pedido ' || p_id_pedido || ': ' || v_anterior || ' -> ' || p_nuevo_estado;
    EXCEPTION
        WHEN SQLSTATE 'TR007' THEN
            p_codigo := 1; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN SQLSTATE 'TR002' OR SQLSTATE 'TR003' OR SQLSTATE 'TR005' THEN
            p_codigo := 3; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN check_violation THEN
            p_codigo := 5; p_mensaje := 'Estado invalido: ' || p_nuevo_estado; v_state := SQLSTATE;
        WHEN OTHERS THEN
            p_codigo := 99; p_mensaje := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE;
    END;

    IF p_codigo <> 0 THEN
        CALL sp_registrar_bitacora('sp_cambiar_estado_pedido',
             jsonb_build_object('id_pedido', p_id_pedido, 'nuevo_estado', p_nuevo_estado),
             p_codigo, p_mensaje, v_state);
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: registra la devolucion de una linea de pedido. El trigger
--   valida la cantidad y calcula el monto; aqui se decide si la prenda
--   vuelve al inventario (las prendas con DEFECTO no reingresan).
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_registrar_devolucion(
    p_id_pedido integer, p_num_linea integer, p_cantidad integer, p_motivo text,
    OUT p_codigo integer, OUT p_mensaje text, OUT p_id_devolucion integer)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_reingresa boolean := (p_motivo <> 'DEFECTO');
    v_sucursal  integer;
    v_variante  integer;
    v_monto     numeric;
    v_state     text;
BEGIN
    p_codigo := 0; p_mensaje := 'Devolucion registrada'; p_id_devolucion := NULL;
    BEGIN
        INSERT INTO devolucion (id_pedido, num_linea, cantidad, motivo, reingresa_stock)
        VALUES (p_id_pedido, p_num_linea, p_cantidad, p_motivo, v_reingresa)
        RETURNING id_devolucion, monto_reembolsado INTO p_id_devolucion, v_monto;

        IF v_reingresa THEN
            SELECT p.id_sucursal, d.id_variante INTO v_sucursal, v_variante
              FROM pedido p JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
             WHERE p.id_pedido = p_id_pedido AND d.num_linea = p_num_linea;
            PERFORM set_config('tienda.motivo_mov', 'DEVOLUCION_CLIENTE', true);
            UPDATE inventario SET stock = stock + p_cantidad
             WHERE id_sucursal = v_sucursal AND id_variante = v_variante;
            PERFORM set_config('tienda.motivo_mov', '', true);
        END IF;
        p_mensaje := 'Devolucion ' || p_id_devolucion || ' registrada. Reembolso: ' || v_monto;
    EXCEPTION
        WHEN SQLSTATE 'TR006' THEN
            p_codigo := 7; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN SQLSTATE 'TR007' THEN
            p_codigo := 1; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN check_violation OR not_null_violation THEN
            p_codigo := 5; p_mensaje := 'Datos invalidos: ' || SQLERRM; v_state := SQLSTATE;
        WHEN OTHERS THEN
            p_codigo := 99; p_mensaje := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE;
    END;

    IF p_codigo <> 0 THEN
        p_id_devolucion := NULL;
        CALL sp_registrar_bitacora('sp_registrar_devolucion',
             jsonb_build_object('id_pedido', p_id_pedido, 'num_linea', p_num_linea, 'cantidad', p_cantidad),
             p_codigo, p_mensaje, v_state);
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: entrada de mercancia o ajuste manual de inventario. Crea
--   la fila si la variante aun no existe en la sucursal. El CHECK
--   stock >= 0 impide dejar el inventario negativo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_ajustar_stock(
    p_id_sucursal integer, p_id_variante integer, p_delta integer, p_tipo text,
    OUT p_codigo integer, OUT p_mensaje text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_state text;
    v_stock integer;
BEGIN
    p_codigo := 0; p_mensaje := 'Inventario actualizado';
    BEGIN
        IF p_tipo NOT IN ('ENTRADA_COMPRA', 'AJUSTE') THEN
            RAISE EXCEPTION 'Tipo de movimiento invalido: %', p_tipo USING ERRCODE = 'TR007';
        END IF;
        IF p_delta = 0 THEN
            RAISE EXCEPTION 'La cantidad del ajuste no puede ser cero' USING ERRCODE = 'TR007';
        END IF;

        PERFORM set_config('tienda.motivo_mov', p_tipo, true);
        UPDATE inventario SET stock = stock + p_delta
         WHERE id_sucursal = p_id_sucursal AND id_variante = p_id_variante
        RETURNING stock INTO v_stock;

        IF NOT FOUND THEN
            IF p_delta < 0 THEN
                RAISE EXCEPTION 'No hay inventario de la variante % en la sucursal % para descontar',
                      p_id_variante, p_id_sucursal USING ERRCODE = 'TR007';
            END IF;
            INSERT INTO inventario (id_sucursal, id_variante, stock)
            VALUES (p_id_sucursal, p_id_variante, p_delta) RETURNING stock INTO v_stock;
        END IF;
        PERFORM set_config('tienda.motivo_mov', '', true);
        p_mensaje := 'Stock actual: ' || v_stock;
    EXCEPTION
        WHEN SQLSTATE 'TR007' THEN
            p_codigo := 1; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN check_violation THEN
            p_codigo := 5; p_mensaje := 'El ajuste dejaria el stock en negativo'; v_state := SQLSTATE;
        WHEN foreign_key_violation THEN
            p_codigo := 1; p_mensaje := 'Sucursal o variante inexistente'; v_state := SQLSTATE;
        WHEN OTHERS THEN
            p_codigo := 99; p_mensaje := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE;
    END;

    IF p_codigo <> 0 THEN
        CALL sp_registrar_bitacora('sp_ajustar_stock',
             jsonb_build_object('sucursal', p_id_sucursal, 'variante', p_id_variante, 'delta', p_delta),
             p_codigo, p_mensaje, v_state);
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: transfiere unidades entre sucursales. Bloquea las dos
--   filas de inventario SIEMPRE en el mismo orden (id_sucursal asc) para
--   que dos transferencias cruzadas (A->B y B->A) no se bloqueen entre si.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_transferir_stock(
    p_origen integer, p_destino integer, p_id_variante integer, p_cantidad integer,
    OUT p_codigo integer, OUT p_mensaje text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_stock_origen integer;
    v_state        text;
BEGIN
    p_codigo := 0; p_mensaje := 'Transferencia realizada';
    BEGIN
        IF p_origen = p_destino THEN
            RAISE EXCEPTION 'La sucursal de origen y destino deben ser distintas' USING ERRCODE = 'TR007';
        END IF;
        IF p_cantidad <= 0 THEN
            RAISE EXCEPTION 'La cantidad a transferir debe ser mayor que cero' USING ERRCODE = 'TR007';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM sucursal WHERE id_sucursal = p_destino AND activa) THEN
            RAISE EXCEPTION 'La sucursal destino % no existe o esta inactiva', p_destino USING ERRCODE = 'TR007';
        END IF;

        -- bloqueo ordenado de las filas existentes
        PERFORM 1 FROM inventario
         WHERE id_variante = p_id_variante AND id_sucursal IN (p_origen, p_destino)
         ORDER BY id_sucursal FOR UPDATE;

        SELECT stock INTO v_stock_origen FROM inventario
         WHERE id_sucursal = p_origen AND id_variante = p_id_variante;
        IF v_stock_origen IS NULL THEN
            RAISE EXCEPTION 'La variante % no tiene inventario en la sucursal origen %', p_id_variante, p_origen
                  USING ERRCODE = 'TR007';
        END IF;
        IF v_stock_origen < p_cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente en origen (disponible %, solicitado %)', v_stock_origen, p_cantidad
                  USING ERRCODE = 'TR001';
        END IF;

        PERFORM set_config('tienda.motivo_mov', 'TRANSFERENCIA_SALIDA', true);
        UPDATE inventario SET stock = stock - p_cantidad
         WHERE id_sucursal = p_origen AND id_variante = p_id_variante;

        PERFORM set_config('tienda.motivo_mov', 'TRANSFERENCIA_ENTRADA', true);
        INSERT INTO inventario (id_sucursal, id_variante, stock)
        VALUES (p_destino, p_id_variante, p_cantidad)
        ON CONFLICT (id_sucursal, id_variante) DO UPDATE SET stock = inventario.stock + EXCLUDED.stock;
        PERFORM set_config('tienda.motivo_mov', '', true);

        p_mensaje := 'Se transfirieron ' || p_cantidad || ' unidades de la sucursal ' || p_origen || ' a la ' || p_destino;
    EXCEPTION
        WHEN SQLSTATE 'TR001' THEN
            p_codigo := 2; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN SQLSTATE 'TR007' THEN
            p_codigo := 1; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN deadlock_detected OR serialization_failure THEN
            p_codigo := 6; p_mensaje := 'Conflicto de concurrencia, intente de nuevo'; v_state := SQLSTATE;
        WHEN foreign_key_violation OR check_violation THEN
            p_codigo := 5; p_mensaje := 'Datos invalidos: ' || SQLERRM; v_state := SQLSTATE;
        WHEN OTHERS THEN
            p_codigo := 99; p_mensaje := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE;
    END;

    IF p_codigo <> 0 THEN
        CALL sp_registrar_bitacora('sp_transferir_stock',
             jsonb_build_object('origen', p_origen, 'destino', p_destino,
                                'variante', p_id_variante, 'cantidad', p_cantidad),
             p_codigo, p_mensaje, v_state);
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: crea un producto y todas sus variantes (talla x color),
--   con SKU automatico e inventario inicial en cero en todas las
--   sucursales activas. Todo en una sola unidad atomica.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_crear_producto(
    p_nombre text, p_descripcion text, p_id_categoria integer, p_id_marca integer,
    p_genero text, p_precio numeric, p_tallas text[], p_colores text[],
    OUT p_codigo integer, OUT p_mensaje text, OUT p_id_producto integer)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_variantes integer;
    v_state     text;
BEGIN
    p_codigo := 0; p_mensaje := 'Producto creado'; p_id_producto := NULL;
    BEGIN
        IF COALESCE(array_length(p_tallas, 1), 0) = 0 OR COALESCE(array_length(p_colores, 1), 0) = 0 THEN
            RAISE EXCEPTION 'Debe indicar al menos una talla y un color' USING ERRCODE = 'TR007';
        END IF;

        INSERT INTO producto (nombre, descripcion, id_categoria, id_marca, genero, precio_base)
        VALUES (p_nombre, p_descripcion, p_id_categoria, p_id_marca, p_genero, p_precio)
        RETURNING id_producto INTO p_id_producto;

        INSERT INTO variante_producto (id_producto, talla, color, sku)
        SELECT p_id_producto, t.talla, c.color, fn_generar_sku(p_id_producto, t.talla, c.color)
          FROM unnest(p_tallas) AS t(talla) CROSS JOIN unnest(p_colores) AS c(color);
        GET DIAGNOSTICS v_variantes = ROW_COUNT;

        INSERT INTO inventario (id_sucursal, id_variante, stock)
        SELECT s.id_sucursal, v.id_variante, 0
          FROM sucursal s CROSS JOIN variante_producto v
         WHERE s.activa AND v.id_producto = p_id_producto;

        p_mensaje := 'Producto ' || p_id_producto || ' creado con ' || v_variantes || ' variantes';
    EXCEPTION
        WHEN SQLSTATE 'TR007' THEN
            p_codigo := 1; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN unique_violation THEN
            p_codigo := 4; p_mensaje := 'Tallas o colores repetidos para el producto'; v_state := SQLSTATE;
        WHEN foreign_key_violation THEN
            p_codigo := 1; p_mensaje := 'Categoria o marca inexistente'; v_state := SQLSTATE;
        WHEN check_violation OR not_null_violation THEN
            p_codigo := 5; p_mensaje := 'Datos invalidos: ' || SQLERRM; v_state := SQLSTATE;
        WHEN OTHERS THEN
            p_codigo := 99; p_mensaje := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE;
    END;

    IF p_codigo <> 0 THEN
        p_id_producto := NULL;
        CALL sp_registrar_bitacora('sp_crear_producto',
             jsonb_build_object('nombre', p_nombre, 'precio', p_precio), p_codigo, p_mensaje, v_state);
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: cambia el precio de un producto (el trigger audita).
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_actualizar_precio(
    p_id_producto integer, p_nuevo_precio numeric,
    OUT p_codigo integer, OUT p_mensaje text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_state text;
BEGIN
    p_codigo := 0; p_mensaje := 'Precio actualizado';
    BEGIN
        UPDATE producto SET precio_base = p_nuevo_precio WHERE id_producto = p_id_producto;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto % no existe', p_id_producto USING ERRCODE = 'TR007';
        END IF;
    EXCEPTION
        WHEN SQLSTATE 'TR007' THEN
            p_codigo := 1; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN check_violation THEN
            p_codigo := 5; p_mensaje := 'El precio debe ser mayor que cero'; v_state := SQLSTATE;
        WHEN OTHERS THEN
            p_codigo := 99; p_mensaje := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE;
    END;
    IF p_codigo <> 0 THEN
        CALL sp_registrar_bitacora('sp_actualizar_precio',
             jsonb_build_object('id_producto', p_id_producto, 'precio', p_nuevo_precio),
             p_codigo, p_mensaje, v_state);
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: ajuste porcentual de precios de una categoria y todas sus
--   subcategorias (CTE recursivo). USA CONTROL EXPLICITO DE
--   TRANSACCIONES: aplica el cambio, verifica la regla de negocio (ningun
--   precio puede quedar sobre $1.500.000) y entonces COMMIT o ROLLBACK.
--   Debe invocarse FUERA de un bloque BEGIN/COMMIT del cliente.
--   Es SECURITY INVOKER a proposito: PostgreSQL no permite COMMIT/ROLLBACK
--   dentro de procedimientos SECURITY DEFINER ni con clausula SET. Por eso
--   solo lo ejecuta un rol con permisos de escritura (rol_admin_tienda; la
--   aplicacion usa el usuario app_admin) y TODOS los objetos se califican
--   con el esquema tienda.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_ajuste_masivo_precios(
    p_id_categoria integer, p_porcentaje numeric,
    OUT p_codigo integer, OUT p_mensaje text, OUT p_afectados integer)
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_permitido constant numeric := 1500000;
    v_error         text;
    v_state         text;
BEGIN
    p_codigo := 0; p_mensaje := ''; p_afectados := 0;

    BEGIN
        IF NOT EXISTS (SELECT 1 FROM tienda.categoria WHERE id_categoria = p_id_categoria) THEN
            RAISE EXCEPTION 'La categoria % no existe', p_id_categoria USING ERRCODE = 'TR007';
        END IF;

        WITH RECURSIVE arbol AS (
            SELECT id_categoria FROM tienda.categoria WHERE id_categoria = p_id_categoria
            UNION ALL
            SELECT c.id_categoria FROM tienda.categoria c JOIN arbol a ON c.id_categoria_padre = a.id_categoria
        )
        UPDATE tienda.producto
           SET precio_base = round(precio_base * (1 + p_porcentaje / 100), -2)
         WHERE id_categoria IN (SELECT id_categoria FROM arbol);
        GET DIAGNOSTICS p_afectados = ROW_COUNT;
    EXCEPTION
        WHEN SQLSTATE 'TR007' THEN v_error := SQLERRM; v_state := SQLSTATE; p_codigo := 1;
        WHEN check_violation  THEN v_error := 'El ajuste dejaria un precio menor o igual a cero'; v_state := SQLSTATE; p_codigo := 5;
        WHEN OTHERS           THEN v_error := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE; p_codigo := 99;
    END;

    -- Regla de negocio verificada DESPUES del UPDATE: aqui el ROLLBACK es real
    -- (deshace el UPDATE ya aplicado en la transaccion en curso).
    IF v_error IS NULL AND EXISTS (SELECT 1 FROM tienda.producto WHERE precio_base > v_max_permitido) THEN
        v_error := 'El ajuste dejaria precios por encima de ' || v_max_permitido; p_codigo := 5; v_state := 'TR008';
    END IF;

    IF v_error IS NOT NULL THEN
        ROLLBACK;
        p_afectados := 0;
        p_mensaje := v_error;
        CALL tienda.sp_registrar_bitacora('sp_ajuste_masivo_precios',
             jsonb_build_object('id_categoria', p_id_categoria, 'porcentaje', p_porcentaje),
             p_codigo, p_mensaje, v_state);
        COMMIT;
    ELSE
        COMMIT;
        p_mensaje := 'Se ajustaron ' || p_afectados || ' productos en ' || p_porcentaje || '%';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: repone las variantes con stock bajo de una sucursal
--   transfiriendo desde la sucursal origen (bodega). Usa un CURSOR
--   explicito y delega cada movimiento en sp_transferir_stock, de modo
--   que una falla en una variante no detiene las demas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_reponer_stock_bajo(
    p_id_destino integer, p_id_origen integer,
    OUT p_codigo integer, OUT p_mensaje text, OUT p_transferidas integer)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    cur_bajo CURSOR FOR
        SELECT i.id_variante, (i.stock_minimo * 3 - i.stock) AS faltante
          FROM inventario i
         WHERE i.id_sucursal = p_id_destino AND i.stock <= i.stock_minimo
         ORDER BY i.id_variante;
    v_fila    record;
    v_cod     integer;
    v_msg     text;
    v_cant    integer;
    v_fallidas integer := 0;
BEGIN
    p_codigo := 0; p_transferidas := 0;
    OPEN cur_bajo;
    LOOP
        FETCH cur_bajo INTO v_fila;
        EXIT WHEN NOT FOUND;
        v_cant := LEAST(v_fila.faltante, fn_stock_disponible(p_id_origen, v_fila.id_variante));
        CONTINUE WHEN v_cant <= 0;
        CALL sp_transferir_stock(p_id_origen, p_id_destino, v_fila.id_variante, v_cant, v_cod, v_msg);
        IF v_cod = 0 THEN p_transferidas := p_transferidas + 1; ELSE v_fallidas := v_fallidas + 1; END IF;
    END LOOP;
    CLOSE cur_bajo;

    p_mensaje := p_transferidas || ' variantes repuestas, ' || v_fallidas || ' con error';
    IF v_fallidas > 0 THEN p_codigo := 1; END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: agrega una direccion de entrega a un cliente. Si es la
--   primera direccion, o se pide como principal, pasa a ser la principal
--   y la anterior deja de serlo (el indice unico parcial exige una sola).
--   Las dos operaciones son atomicas dentro del mismo bloque.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_agregar_direccion(
    p_id_cliente integer, p_alias text, p_direccion text, p_id_ciudad integer,
    p_es_principal boolean, p_telefono text,
    OUT p_codigo integer, OUT p_mensaje text, OUT p_id_direccion integer)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_principal boolean;
    v_state     text;
BEGIN
    p_codigo := 0; p_mensaje := 'Direccion agregada'; p_id_direccion := NULL;
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = p_id_cliente AND activo) THEN
            RAISE EXCEPTION 'El cliente % no existe o esta inactivo', p_id_cliente USING ERRCODE = 'TR007';
        END IF;

        v_principal := COALESCE(p_es_principal, false)
                       OR NOT EXISTS (SELECT 1 FROM direccion_cliente WHERE id_cliente = p_id_cliente);
        IF v_principal THEN
            UPDATE direccion_cliente SET es_principal = false WHERE id_cliente = p_id_cliente AND es_principal;
        END IF;

        INSERT INTO direccion_cliente (id_cliente, alias, direccion, id_ciudad, es_principal, telefono_contacto)
        VALUES (p_id_cliente, p_alias, p_direccion, p_id_ciudad, v_principal, p_telefono)
        RETURNING id_direccion INTO p_id_direccion;
    EXCEPTION
        WHEN SQLSTATE 'TR007' THEN
            p_codigo := 1; p_mensaje := SQLERRM; v_state := SQLSTATE;
        WHEN foreign_key_violation THEN
            p_codigo := 1; p_mensaje := 'La ciudad indicada no existe'; v_state := SQLSTATE;
        WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN
            p_codigo := 5; p_mensaje := 'Datos de la direccion invalidos: ' || SQLERRM; v_state := SQLSTATE;
        WHEN OTHERS THEN
            p_codigo := 99; p_mensaje := 'Error inesperado: ' || SQLERRM; v_state := SQLSTATE;
    END;

    IF p_codigo <> 0 THEN
        p_id_direccion := NULL;
        CALL sp_registrar_bitacora('sp_agregar_direccion',
             jsonb_build_object('id_cliente', p_id_cliente, 'alias', p_alias), p_codigo, p_mensaje, v_state);
    END IF;
END;
$$;
