-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 03_triggers.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: triggers que garantizan integridad y automatizan reglas
--              de negocio en la capa de datos.
-- Codigos de error propios (SQLSTATE):
--   TR001 stock insuficiente          TR002 transicion de estado invalida
--   TR003 pedido cerrado (no editable) TR004 correo electronico invalido
--   TR005 pago insuficiente           TR006 devolucion invalida
--   TR007 validacion de negocio (dato inexistente o no permitido)
-- =====================================================================
\set ON_ERROR_STOP on
SET search_path = tienda, extensiones;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: normaliza nombres y correo del cliente y valida el formato
--   del correo antes de guardar.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_cliente_normalizar() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
BEGIN
    NEW.nombres   := btrim(NEW.nombres);
    NEW.apellidos := btrim(NEW.apellidos);
    NEW.email     := lower(btrim(NEW.email));
    IF NOT fn_email_valido(NEW.email) THEN
        RAISE EXCEPTION 'Correo electronico invalido: %', NEW.email USING ERRCODE = 'TR004';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cliente_normalizar
    BEFORE INSERT OR UPDATE ON cliente
    FOR EACH ROW EXECUTE FUNCTION fn_trg_cliente_normalizar();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: actualiza la marca de tiempo del inventario en cada cambio.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_inventario_fecha() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
BEGIN
    NEW.ultima_actualizacion := now();
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_inventario_fecha
    BEFORE UPDATE ON inventario
    FOR EACH ROW EXECUTE FUNCTION fn_trg_inventario_fecha();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: kardex automatico. Cada cambio de stock genera un
--   movimiento con la cantidad firmada y el stock resultante. El tipo de
--   movimiento lo informa el procedimiento con la variable de sesion
--   tienda.motivo_mov (SET LOCAL); si no existe se registra como AJUSTE.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_kardex() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_motivo text := NULLIF(current_setting('tienda.motivo_mov', true), '');
    v_delta  integer;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_delta := NEW.stock;
        v_motivo := COALESCE(v_motivo, 'INVENTARIO_INICIAL');
    ELSE
        v_delta := NEW.stock - OLD.stock;
        v_motivo := COALESCE(v_motivo, 'AJUSTE');
    END IF;

    IF v_delta <> 0 THEN
        INSERT INTO movimiento_inventario (id_sucursal, id_variante, tipo, cantidad, stock_resultante)
        VALUES (NEW.id_sucursal, NEW.id_variante, v_motivo, v_delta, NEW.stock);
    END IF;
    RETURN NULL;
END;
$$;
CREATE TRIGGER trg_kardex
    AFTER INSERT OR UPDATE OF stock ON inventario
    FOR EACH ROW EXECUTE FUNCTION fn_trg_kardex();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: auditoria de cambios de precio de productos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_auditoria_precio() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
BEGIN
    INSERT INTO auditoria_precio (id_producto, precio_anterior, precio_nuevo)
    VALUES (NEW.id_producto, OLD.precio_base, NEW.precio_base);
    RETURN NULL;
END;
$$;
CREATE TRIGGER trg_auditoria_precio
    AFTER UPDATE OF precio_base ON producto
    FOR EACH ROW WHEN (OLD.precio_base IS DISTINCT FROM NEW.precio_base)
    EXECUTE FUNCTION fn_trg_auditoria_precio();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: el total del pedido siempre es subtotal - descuento + envio.
--   Se recalcula ante cualquier cambio de esos tres campos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_pedido_total() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
BEGIN
    NEW.total := NEW.subtotal - NEW.descuento_total + NEW.costo_envio;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pedido_total
    BEFORE INSERT OR UPDATE OF subtotal, descuento_total, costo_envio ON pedido
    FOR EACH ROW EXECUTE FUNCTION fn_trg_pedido_total();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: mantiene subtotal y descuento del pedido a partir de sus
--   lineas (insercion, cambio o borrado de una linea).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_detalle_recalcular() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_id integer := COALESCE(NEW.id_pedido, OLD.id_pedido);
BEGIN
    UPDATE pedido p
       SET subtotal        = s.bruto,
           descuento_total = s.desc_total
      FROM (SELECT COALESCE(SUM(cantidad * precio_unitario), 0)    AS bruto,
                   COALESCE(SUM(cantidad * descuento_unitario), 0) AS desc_total
              FROM detalle_pedido WHERE id_pedido = v_id) s
     WHERE p.id_pedido = v_id;
    RETURN NULL;
END;
$$;
CREATE TRIGGER trg_detalle_recalcular
    AFTER INSERT OR UPDATE OR DELETE ON detalle_pedido
    FOR EACH ROW EXECUTE FUNCTION fn_trg_detalle_recalcular();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: impide modificar las lineas de un pedido enviado,
--   entregado o cancelado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_detalle_bloqueo() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_estado text;
BEGIN
    SELECT estado INTO v_estado FROM pedido
     WHERE id_pedido = COALESCE(NEW.id_pedido, OLD.id_pedido);
    IF v_estado IN ('ENVIADO', 'ENTREGADO', 'CANCELADO') THEN
        RAISE EXCEPTION 'El pedido % esta % y sus lineas no se pueden modificar',
              COALESCE(NEW.id_pedido, OLD.id_pedido), v_estado USING ERRCODE = 'TR003';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_detalle_bloqueo
    BEFORE INSERT OR UPDATE OR DELETE ON detalle_pedido
    FOR EACH ROW EXECUTE FUNCTION fn_trg_detalle_bloqueo();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: maquina de estados del pedido. Solo se permiten:
--   CREADO>PAGADO|CANCELADO, PAGADO>EN_PREPARACION|CANCELADO,
--   EN_PREPARACION>ENVIADO|CANCELADO, ENVIADO>ENTREGADO.
--   Para pasar a PAGADO debe existir pago aprobado por el total.
--   Los pedidos de mostrador (venta directa) pueden pasar de PAGADO a
--   ENTREGADO sin preparacion ni envio.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_pedido_transicion() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_ok     boolean;
    v_pagado numeric;
BEGIN
    v_ok := CASE OLD.estado
        WHEN 'CREADO'         THEN NEW.estado IN ('PAGADO', 'CANCELADO')
        WHEN 'PAGADO'         THEN NEW.estado IN ('EN_PREPARACION', 'CANCELADO')
                                   OR (NEW.estado = 'ENTREGADO' AND NEW.tipo_entrega = 'VENTA_MOSTRADOR')
        WHEN 'EN_PREPARACION' THEN NEW.estado IN ('ENVIADO', 'CANCELADO')
        WHEN 'ENVIADO'        THEN NEW.estado = 'ENTREGADO'
        ELSE false
    END;

    IF NOT v_ok THEN
        RAISE EXCEPTION 'Transicion de estado no permitida: % -> % (pedido %)',
              OLD.estado, NEW.estado, OLD.id_pedido USING ERRCODE = 'TR002';
    END IF;

    IF NEW.estado = 'PAGADO' THEN
        SELECT COALESCE(SUM(monto), 0) INTO v_pagado
          FROM pago WHERE id_pedido = NEW.id_pedido AND estado = 'APROBADO';
        IF v_pagado < NEW.total OR NEW.total = 0 THEN
            RAISE EXCEPTION 'Pago insuficiente para el pedido %: pagado % de %',
                  NEW.id_pedido, v_pagado, NEW.total USING ERRCODE = 'TR005';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pedido_transicion
    BEFORE UPDATE OF estado ON pedido
    FOR EACH ROW WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
    EXECUTE FUNCTION fn_trg_pedido_transicion();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: suma puntos de fidelizacion (1 por cada $1.000) cuando el
--   pedido pasa a ENTREGADO y recalcula el nivel del cliente.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_puntos_entrega() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
BEGIN
    UPDATE perfil_fidelizacion
       SET puntos = puntos + floor(NEW.total / 1000)::integer,
           nivel  = fn_nivel_fidelizacion(puntos + floor(NEW.total / 1000)::integer),
           fecha_actualizacion = now()
     WHERE id_cliente = NEW.id_cliente;
    RETURN NULL;
END;
$$;
CREATE TRIGGER trg_puntos_entrega
    AFTER UPDATE OF estado ON pedido
    FOR EACH ROW WHEN (NEW.estado = 'ENTREGADO' AND OLD.estado IS DISTINCT FROM 'ENTREGADO')
    EXECUTE FUNCTION fn_trg_puntos_entrega();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: valida una devolucion (pedido entregado y cantidad que no
--   exceda lo vendido menos lo ya devuelto) y calcula el monto a
--   reembolsar con el precio y descuento de la linea original.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_devolucion_validar() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_estado     text;
    v_vendida    integer;
    v_devuelta   integer;
    v_neto_unit  numeric;
BEGIN
    SELECT p.estado, d.cantidad, d.precio_unitario - d.descuento_unitario
      INTO v_estado, v_vendida, v_neto_unit
      FROM detalle_pedido d JOIN pedido p ON p.id_pedido = d.id_pedido
     WHERE d.id_pedido = NEW.id_pedido AND d.num_linea = NEW.num_linea
       FOR SHARE OF d;           -- bloquea la linea mientras se valida

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La linea % del pedido % no existe', NEW.num_linea, NEW.id_pedido USING ERRCODE = 'TR007';
    END IF;
    IF v_estado IS DISTINCT FROM 'ENTREGADO' THEN
        RAISE EXCEPTION 'Solo se pueden devolver productos de pedidos ENTREGADOS (pedido % esta %)',
              NEW.id_pedido, COALESCE(v_estado, 'inexistente') USING ERRCODE = 'TR006';
    END IF;

    SELECT COALESCE(SUM(cantidad), 0) INTO v_devuelta
      FROM devolucion WHERE id_pedido = NEW.id_pedido AND num_linea = NEW.num_linea;

    IF NEW.cantidad > v_vendida - v_devuelta THEN
        RAISE EXCEPTION 'Cantidad a devolver (%) supera lo disponible (%) en la linea % del pedido %',
              NEW.cantidad, v_vendida - v_devuelta, NEW.num_linea, NEW.id_pedido USING ERRCODE = 'TR006';
    END IF;

    NEW.monto_reembolsado := COALESCE(NEW.monto_reembolsado, NEW.cantidad * v_neto_unit);
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_devolucion_validar
    BEFORE INSERT ON devolucion
    FOR EACH ROW EXECUTE FUNCTION fn_trg_devolucion_validar();

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: descuenta los puntos ganados por una compra devuelta.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_devolucion_puntos() RETURNS trigger
LANGUAGE plpgsql SET search_path = tienda, extensiones, pg_temp
AS $$
BEGIN
    UPDATE perfil_fidelizacion f
       SET puntos = GREATEST(0, f.puntos - floor(NEW.monto_reembolsado / 1000)::integer),
           nivel  = fn_nivel_fidelizacion(GREATEST(0, f.puntos - floor(NEW.monto_reembolsado / 1000)::integer)),
           fecha_actualizacion = now()
      FROM pedido p
     WHERE p.id_pedido = NEW.id_pedido AND f.id_cliente = p.id_cliente;
    RETURN NULL;
END;
$$;
CREATE TRIGGER trg_devolucion_puntos
    AFTER INSERT ON devolucion
    FOR EACH ROW EXECUTE FUNCTION fn_trg_devolucion_puntos();
