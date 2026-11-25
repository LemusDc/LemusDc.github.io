-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 02_funciones.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: funciones de negocio (calculo de descuentos, stock,
--              envio, fidelizacion, ventas netas, autenticacion).
-- =====================================================================
\set ON_ERROR_STOP on
SET search_path = tienda, extensiones;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: nivel de fidelizacion segun los puntos acumulados.
--   Es IMMUTABLE porque solo depende de su argumento.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_nivel_fidelizacion(p_puntos integer)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE WHEN p_puntos >= 3000 THEN 'ORO'
                WHEN p_puntos >= 1000 THEN 'PLATA'
                ELSE 'BASICO' END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: validacion simple de formato de correo electronico.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_email_valido(p_email text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
    SELECT p_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$';
$$;

-- ---------------------------------------------------------------------
-- NOTA DE SEGURIDAD: las funciones que leen tablas (fn_descuento_unitario, fn_stock_disponible,
-- fn_total_pedido, fn_ventas_netas, fn_top_productos) son SECURITY DEFINER de solo lectura con
-- search_path fijo, para que las vistas y la aplicacion puedan usarlas sin tener acceso a las tablas.

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: descuento en pesos por unidad de un producto en una fecha.
--   Si hay varias promociones vigentes se aplica la mejor (no se
--   acumulan). El descuento nunca supera el precio base.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_descuento_unitario(p_id_producto integer, p_fecha date DEFAULT current_date)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
    SELECT COALESCE(MAX(LEAST(p.precio_base,
               CASE pr.tipo_descuento
                    WHEN 'PORCENTAJE' THEN round(p.precio_base * pr.valor / 100, -2)
                    ELSE pr.valor
               END)), 0)
      FROM producto p
      JOIN promocion_producto pp ON pp.id_producto = p.id_producto
      JOIN promocion pr          ON pr.id_promocion = pp.id_promocion
     WHERE p.id_producto = p_id_producto
       AND pr.activa
       AND p_fecha BETWEEN pr.fecha_inicio AND pr.fecha_fin;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: unidades disponibles de una variante en una sucursal.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_stock_disponible(p_id_sucursal integer, p_id_variante integer)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
    SELECT COALESCE((SELECT stock FROM inventario
                      WHERE id_sucursal = p_id_sucursal AND id_variante = p_id_variante), 0);
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: costo de envio. Solo los pedidos a domicilio pagan envio;
--   es gratis desde $199.900 de subtotal con descuento aplicado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_costo_envio(p_subtotal_neto numeric, p_tipo_entrega text)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE WHEN p_tipo_entrega <> 'DOMICILIO' THEN 0
                WHEN p_subtotal_neto >= 199900     THEN 0
                ELSE 12000 END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: total de un pedido calculado desde sus lineas mas el envio.
--   Devuelve NULL si el pedido no existe.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_total_pedido(p_id_pedido integer)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
    SELECT COALESCE((SELECT SUM(d.subtotal_linea) FROM detalle_pedido d
                      WHERE d.id_pedido = p.id_pedido), 0) + p.costo_envio
      FROM pedido p
     WHERE p.id_pedido = p_id_pedido;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: ventas netas en un rango de fechas = lineas de pedidos
--   ENTREGADOS menos devoluciones (cada devolucion se imputa a su propia
--   fecha). Se agrega cada hecho por separado antes de combinarlos para
--   no multiplicar filas (granularidades distintas).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_ventas_netas(p_desde date, p_hasta date, p_id_sucursal integer DEFAULT NULL)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
    SELECT COALESCE((SELECT SUM(d.subtotal_linea)
                       FROM pedido p JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
                      WHERE p.estado = 'ENTREGADO'
                        AND p.fecha_pedido >= p_desde AND p.fecha_pedido < p_hasta + 1
                        AND (p_id_sucursal IS NULL OR p.id_sucursal = p_id_sucursal)), 0)
         - COALESCE((SELECT SUM(dv.monto_reembolsado)
                       FROM devolucion dv JOIN pedido p ON p.id_pedido = dv.id_pedido
                      WHERE dv.fecha_devolucion >= p_desde AND dv.fecha_devolucion < p_hasta + 1
                        AND (p_id_sucursal IS NULL OR p.id_sucursal = p_id_sucursal)), 0);
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: Top-N de productos mas vendidos (unidades) en un periodo.
--   ROW_NUMBER con desempate por id_producto para devolver exactamente N.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_top_productos(p_desde date, p_hasta date, p_n integer DEFAULT 10)
RETURNS TABLE (puesto integer, id_producto integer, nombre varchar, unidades bigint, ingresos numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
    WITH ventas AS (
        SELECT v.id_producto, SUM(d.cantidad) AS unidades, SUM(d.subtotal_linea) AS ingresos
          FROM pedido p
          JOIN detalle_pedido d     ON d.id_pedido = p.id_pedido
          JOIN variante_producto v  ON v.id_variante = d.id_variante
         WHERE p.estado = 'ENTREGADO'
           AND p.fecha_pedido >= p_desde AND p.fecha_pedido < p_hasta + 1
         GROUP BY v.id_producto
    )
    SELECT (ROW_NUMBER() OVER (ORDER BY ve.unidades DESC, ve.id_producto))::integer,
           ve.id_producto, pr.nombre, ve.unidades, ve.ingresos
      FROM ventas ve JOIN producto pr ON pr.id_producto = ve.id_producto
     ORDER BY 1
     LIMIT p_n;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: SKU legible: P + id de producto (4 digitos) - color(3) - talla.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generar_sku(p_id_producto integer, p_talla text, p_color text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
    SELECT 'P' || lpad(p_id_producto::text, 4, '0') || '-' ||
           upper(left(translate(p_color, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), 3)) || '-' || upper(p_talla);
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Diego Lemus
-- Descripcion: autentica un usuario del sistema comparando el hash bcrypt.
--   SECURITY DEFINER: la aplicacion no necesita acceso a la tabla de
--   usuarios; solo ejecuta esta funcion. Registra el ultimo acceso.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_autenticar(p_username text, p_password text)
RETURNS TABLE (out_id_empleado integer, out_nombre text, out_rol text, out_id_sucursal integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = tienda, extensiones, pg_temp
AS $$
DECLARE
    v_id integer;
BEGIN
    SELECT u.id_empleado INTO v_id
      FROM usuario_sistema u
     WHERE u.username = p_username
       AND u.activo
       AND u.password_hash = crypt(p_password, u.password_hash);

    IF v_id IS NULL THEN
        RETURN;                       -- credenciales invalidas: cero filas
    END IF;

    UPDATE usuario_sistema SET ultimo_acceso = now() WHERE id_empleado = v_id;

    RETURN QUERY
        SELECT e.id_empleado, (e.nombres || ' ' || e.apellidos)::text, u.rol::text, e.id_sucursal
          FROM empleado e JOIN usuario_sistema u ON u.id_empleado = e.id_empleado
         WHERE e.id_empleado = v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- Fecha: 2026-11-04 | Autor: Juan Diego Mateus
-- Descripcion: normaliza un texto para buscar sin importar mayusculas ni
--   tildes. Envuelve extensiones.unaccent para que los usuarios de la
--   aplicacion no necesiten acceso al esquema de extensiones.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_normalizar(p_texto text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = tienda, extensiones, pg_temp
AS $$
    SELECT lower(unaccent(p_texto));
$$;
