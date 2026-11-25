-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 01_creacion.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: creacion del esquema relacional (tablas, llaves,
--              restricciones de integridad e indices). 3FN.
-- Motor   : PostgreSQL 16
-- =====================================================================
\set ON_ERROR_STOP on

DROP SCHEMA IF EXISTS tienda CASCADE;
DROP SCHEMA IF EXISTS extensiones CASCADE;
CREATE SCHEMA extensiones;
CREATE SCHEMA tienda;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensiones;   -- bcrypt para contrasenas
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensiones;   -- busquedas sin tildes

SET search_path = tienda, extensiones;

-- ---------------------------------------------------------------------
-- Geografia y organizacion
-- ---------------------------------------------------------------------
CREATE TABLE ciudad (
    id_ciudad     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        varchar(80) NOT NULL,
    departamento  varchar(80) NOT NULL,
    CONSTRAINT uq_ciudad UNIQUE (nombre, departamento)
);

CREATE TABLE sucursal (
    id_sucursal   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        varchar(100) NOT NULL,
    tipo          varchar(10)  NOT NULL,
    direccion     varchar(200),
    id_ciudad     integer      NOT NULL REFERENCES ciudad (id_ciudad),
    telefono      varchar(20),
    activa        boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_sucursal_nombre UNIQUE (nombre),
    CONSTRAINT ck_sucursal_tipo CHECK (tipo IN ('FISICA', 'ONLINE')),
    CONSTRAINT ck_sucursal_direccion CHECK (tipo = 'ONLINE' OR direccion IS NOT NULL)
);

CREATE TABLE empleado (
    id_empleado    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal    integer      NOT NULL REFERENCES sucursal (id_sucursal),
    documento      varchar(20)  NOT NULL,
    nombres        varchar(80)  NOT NULL,
    apellidos      varchar(80)  NOT NULL,
    cargo          varchar(15)  NOT NULL,
    fecha_ingreso  date         NOT NULL DEFAULT current_date,
    activo         boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_empleado_documento UNIQUE (documento),
    CONSTRAINT ck_empleado_cargo CHECK (cargo IN ('GERENTE', 'VENDEDOR', 'CAJERO', 'BODEGUERO', 'ADMIN'))
);

-- Relacion 1:1 con empleado (un empleado tiene como maximo una cuenta)
CREATE TABLE usuario_sistema (
    id_empleado     integer PRIMARY KEY REFERENCES empleado (id_empleado),
    username        varchar(40)  NOT NULL,
    password_hash   text         NOT NULL,
    rol             varchar(15)  NOT NULL,
    ultimo_acceso   timestamptz,
    activo          boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_usuario_username UNIQUE (username),
    CONSTRAINT ck_usuario_rol CHECK (rol IN ('ADMIN', 'VENDEDOR', 'ANALISTA'))
);

-- ---------------------------------------------------------------------
-- Clientes y fidelizacion
-- ---------------------------------------------------------------------
CREATE TABLE cliente (
    id_cliente        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_documento    varchar(3)   NOT NULL,
    documento         varchar(20)  NOT NULL,
    nombres           varchar(80)  NOT NULL,
    apellidos         varchar(80)  NOT NULL,
    email             varchar(120) NOT NULL,
    telefono          varchar(20),
    fecha_registro    timestamptz  NOT NULL DEFAULT now(),
    activo            boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_cliente_documento UNIQUE (tipo_documento, documento),
    CONSTRAINT uq_cliente_email UNIQUE (email),
    CONSTRAINT ck_cliente_tipo_doc CHECK (tipo_documento IN ('CC', 'CE', 'TI', 'PAS', 'NIT'))
);

-- Relacion 1:1 con cliente
CREATE TABLE perfil_fidelizacion (
    id_cliente            integer PRIMARY KEY REFERENCES cliente (id_cliente) ON DELETE CASCADE,
    puntos                integer      NOT NULL DEFAULT 0,
    nivel                 varchar(10)  NOT NULL DEFAULT 'BASICO',
    fecha_actualizacion   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_perfil_puntos CHECK (puntos >= 0),
    CONSTRAINT ck_perfil_nivel CHECK (nivel IN ('BASICO', 'PLATA', 'ORO'))
);

CREATE TABLE direccion_cliente (
    id_direccion      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente        integer      NOT NULL REFERENCES cliente (id_cliente) ON DELETE CASCADE,
    alias             varchar(40)  NOT NULL,
    direccion         varchar(200) NOT NULL,
    id_ciudad         integer      NOT NULL REFERENCES ciudad (id_ciudad),
    es_principal      boolean      NOT NULL DEFAULT false,
    telefono_contacto varchar(20),
    -- permite la llave foranea compuesta desde pedido (la direccion debe ser del mismo cliente)
    CONSTRAINT uq_direccion_cliente UNIQUE (id_direccion, id_cliente)
);
CREATE UNIQUE INDEX uq_direccion_principal ON direccion_cliente (id_cliente) WHERE es_principal;

-- ---------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------
CREATE TABLE categoria (
    id_categoria        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre              varchar(80) NOT NULL,
    id_categoria_padre  integer REFERENCES categoria (id_categoria),
    CONSTRAINT uq_categoria_nombre UNIQUE (nombre),
    CONSTRAINT ck_categoria_no_propia CHECK (id_categoria_padre IS NULL OR id_categoria_padre <> id_categoria)
);

CREATE TABLE marca (
    id_marca  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre    varchar(80) NOT NULL,
    CONSTRAINT uq_marca_nombre UNIQUE (nombre)
);

CREATE TABLE producto (
    id_producto     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          varchar(120)  NOT NULL,
    descripcion     varchar(500),
    id_categoria    integer       NOT NULL REFERENCES categoria (id_categoria),
    id_marca        integer       NOT NULL REFERENCES marca (id_marca),
    genero          varchar(10)   NOT NULL,
    precio_base     numeric(12,2) NOT NULL,
    activo          boolean       NOT NULL DEFAULT true,
    fecha_creacion  timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT ck_producto_genero CHECK (genero IN ('MUJER', 'HOMBRE', 'NINA', 'NINO', 'UNISEX')),
    CONSTRAINT ck_producto_precio CHECK (precio_base > 0)
);

CREATE TABLE variante_producto (
    id_variante  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto  integer      NOT NULL REFERENCES producto (id_producto),
    talla        varchar(10)  NOT NULL,
    color        varchar(30)  NOT NULL,
    sku          varchar(40)  NOT NULL,
    activa       boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_variante_sku UNIQUE (sku),
    CONSTRAINT uq_variante_combinacion UNIQUE (id_producto, talla, color)
);

-- Relacion N:M entre sucursal y variante_producto
CREATE TABLE inventario (
    id_sucursal           integer      NOT NULL REFERENCES sucursal (id_sucursal),
    id_variante           integer      NOT NULL REFERENCES variante_producto (id_variante),
    stock                 integer      NOT NULL DEFAULT 0,
    stock_minimo          integer      NOT NULL DEFAULT 3,
    ultima_actualizacion  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (id_sucursal, id_variante),
    CONSTRAINT ck_inventario_stock CHECK (stock >= 0),
    CONSTRAINT ck_inventario_minimo CHECK (stock_minimo >= 0)
);

CREATE TABLE movimiento_inventario (
    id_movimiento     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal       integer      NOT NULL,
    id_variante       integer      NOT NULL,
    tipo              varchar(25)  NOT NULL,
    cantidad          integer      NOT NULL,
    stock_resultante  integer      NOT NULL,
    fecha             timestamptz  NOT NULL DEFAULT now(),
    usuario_bd        varchar(60)  NOT NULL DEFAULT current_user,
    FOREIGN KEY (id_sucursal, id_variante) REFERENCES inventario (id_sucursal, id_variante),
    CONSTRAINT ck_mov_tipo CHECK (tipo IN ('INVENTARIO_INICIAL', 'ENTRADA_COMPRA', 'SALIDA_VENTA',
        'ANULACION_PEDIDO', 'DEVOLUCION_CLIENTE', 'TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SALIDA', 'AJUSTE')),
    CONSTRAINT ck_mov_cantidad CHECK (cantidad <> 0)
);

CREATE TABLE auditoria_precio (
    id_auditoria     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto      integer       NOT NULL REFERENCES producto (id_producto),
    precio_anterior  numeric(12,2) NOT NULL,
    precio_nuevo     numeric(12,2) NOT NULL,
    fecha            timestamptz   NOT NULL DEFAULT now(),
    usuario_bd       varchar(60)   NOT NULL DEFAULT current_user
);

-- ---------------------------------------------------------------------
-- Promociones (N:M con producto)
-- ---------------------------------------------------------------------
CREATE TABLE promocion (
    id_promocion    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          varchar(100)  NOT NULL,
    tipo_descuento  varchar(10)   NOT NULL,
    valor           numeric(12,2) NOT NULL,
    fecha_inicio    date          NOT NULL,
    fecha_fin       date          NOT NULL,
    activa          boolean       NOT NULL DEFAULT true,
    CONSTRAINT ck_promocion_tipo CHECK (tipo_descuento IN ('PORCENTAJE', 'MONTO')),
    CONSTRAINT ck_promocion_valor CHECK (valor > 0 AND (tipo_descuento <> 'PORCENTAJE' OR valor <= 90)),
    CONSTRAINT ck_promocion_fechas CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE promocion_producto (
    id_promocion  integer NOT NULL REFERENCES promocion (id_promocion) ON DELETE CASCADE,
    id_producto   integer NOT NULL REFERENCES producto (id_producto),
    PRIMARY KEY (id_promocion, id_producto)
);

-- ---------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------
CREATE TABLE pedido (
    id_pedido           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente          integer       NOT NULL REFERENCES cliente (id_cliente),
    id_sucursal         integer       NOT NULL REFERENCES sucursal (id_sucursal),
    id_empleado         integer       REFERENCES empleado (id_empleado),
    canal               varchar(10)   NOT NULL,
    tipo_entrega        varchar(20)   NOT NULL,
    estado              varchar(15)   NOT NULL DEFAULT 'CREADO',
    fecha_pedido        timestamptz   NOT NULL DEFAULT now(),
    id_direccion_envio  integer,
    subtotal            numeric(14,2) NOT NULL DEFAULT 0,
    descuento_total     numeric(14,2) NOT NULL DEFAULT 0,
    costo_envio         numeric(12,2) NOT NULL DEFAULT 0,
    total               numeric(14,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (id_direccion_envio, id_cliente) REFERENCES direccion_cliente (id_direccion, id_cliente),
    CONSTRAINT ck_pedido_canal CHECK (canal IN ('TIENDA', 'ONLINE')),
    CONSTRAINT ck_pedido_estado CHECK (estado IN ('CREADO', 'PAGADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO')),
    CONSTRAINT ck_pedido_entrega CHECK (
        (canal = 'TIENDA' AND tipo_entrega = 'VENTA_MOSTRADOR')
        OR (canal = 'ONLINE' AND tipo_entrega IN ('DOMICILIO', 'RECOGER_EN_TIENDA'))),
    CONSTRAINT ck_pedido_direccion CHECK ((tipo_entrega = 'DOMICILIO') = (id_direccion_envio IS NOT NULL)),
    CONSTRAINT ck_pedido_empleado CHECK (canal = 'ONLINE' OR id_empleado IS NOT NULL),
    CONSTRAINT ck_pedido_montos CHECK (subtotal >= 0 AND descuento_total >= 0 AND costo_envio >= 0 AND total >= 0)
);

CREATE TABLE detalle_pedido (
    id_pedido           integer       NOT NULL REFERENCES pedido (id_pedido) ON DELETE CASCADE,
    num_linea           integer       NOT NULL,
    id_variante         integer       NOT NULL REFERENCES variante_producto (id_variante),
    cantidad            integer       NOT NULL,
    precio_unitario     numeric(12,2) NOT NULL,
    descuento_unitario  numeric(12,2) NOT NULL DEFAULT 0,
    subtotal_linea      numeric(14,2) GENERATED ALWAYS AS (cantidad * (precio_unitario - descuento_unitario)) STORED,
    PRIMARY KEY (id_pedido, num_linea),
    CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_detalle_precio CHECK (precio_unitario >= 0 AND descuento_unitario >= 0 AND descuento_unitario <= precio_unitario)
);

CREATE TABLE pago (
    id_pago            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido          integer       NOT NULL REFERENCES pedido (id_pedido),
    metodo             varchar(20)   NOT NULL,
    monto              numeric(14,2) NOT NULL,
    estado             varchar(12)   NOT NULL DEFAULT 'APROBADO',
    fecha_pago         timestamptz   NOT NULL DEFAULT now(),
    referencia_externa varchar(60),
    CONSTRAINT ck_pago_metodo CHECK (metodo IN ('EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'PSE', 'NEQUI', 'TRANSFERENCIA')),
    CONSTRAINT ck_pago_estado CHECK (estado IN ('APROBADO', 'RECHAZADO', 'REEMBOLSADO')),
    CONSTRAINT ck_pago_monto CHECK (monto > 0)
);

CREATE TABLE devolucion (
    id_devolucion       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido           integer       NOT NULL,
    num_linea           integer       NOT NULL,
    cantidad            integer       NOT NULL,
    motivo              varchar(20)   NOT NULL,
    fecha_devolucion    timestamptz   NOT NULL DEFAULT now(),
    monto_reembolsado   numeric(14,2) NOT NULL,
    reingresa_stock     boolean       NOT NULL DEFAULT true,
    FOREIGN KEY (id_pedido, num_linea) REFERENCES detalle_pedido (id_pedido, num_linea),
    CONSTRAINT ck_devolucion_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_devolucion_motivo CHECK (motivo IN ('TALLA_INCORRECTA', 'DEFECTO', 'NO_ME_GUSTO', 'ERROR_ENVIO', 'OTRO')),
    CONSTRAINT ck_devolucion_monto CHECK (monto_reembolsado >= 0)
);

-- ---------------------------------------------------------------------
-- Bitacora de operaciones (manejo de excepciones en la capa de datos)
-- ---------------------------------------------------------------------
CREATE TABLE bitacora_operacion (
    id_bitacora    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha          timestamptz  NOT NULL DEFAULT now(),
    procedimiento  varchar(80)  NOT NULL,
    parametros     jsonb,
    codigo         integer      NOT NULL,
    mensaje        text         NOT NULL,
    sqlstate_error varchar(5),
    usuario_bd     varchar(60)  NOT NULL DEFAULT current_user
);

-- ---------------------------------------------------------------------
-- Indices (justificacion en el documento de decisiones tecnicas)
-- ---------------------------------------------------------------------
CREATE INDEX idx_empleado_sucursal        ON empleado (id_sucursal);
CREATE INDEX idx_direccion_cliente        ON direccion_cliente (id_cliente);
CREATE INDEX idx_cliente_apellidos        ON cliente (lower(apellidos), lower(nombres));
CREATE INDEX idx_categoria_padre          ON categoria (id_categoria_padre);
CREATE INDEX idx_producto_categoria       ON producto (id_categoria);
CREATE INDEX idx_producto_marca           ON producto (id_marca);
CREATE INDEX idx_producto_nombre          ON producto (lower(nombre) text_pattern_ops);
CREATE INDEX idx_variante_producto        ON variante_producto (id_producto);
CREATE INDEX idx_inventario_variante      ON inventario (id_variante);
CREATE INDEX idx_inventario_stock_bajo    ON inventario (id_sucursal) WHERE stock <= stock_minimo;
CREATE INDEX idx_movimiento_variante      ON movimiento_inventario (id_variante, fecha DESC);
CREATE INDEX idx_movimiento_sucursal      ON movimiento_inventario (id_sucursal, fecha DESC);
CREATE INDEX idx_pedido_cliente           ON pedido (id_cliente);
CREATE INDEX idx_pedido_fecha             ON pedido (fecha_pedido);
CREATE INDEX idx_pedido_sucursal_estado   ON pedido (id_sucursal, estado);
CREATE INDEX idx_detalle_variante         ON detalle_pedido (id_variante);
CREATE INDEX idx_pago_pedido              ON pago (id_pedido);
CREATE INDEX idx_devolucion_linea         ON devolucion (id_pedido, num_linea);
CREATE INDEX idx_promocion_vigencia       ON promocion (fecha_inicio, fecha_fin) WHERE activa;
CREATE INDEX idx_promocion_producto_prod  ON promocion_producto (id_producto);
CREATE INDEX idx_bitacora_fecha           ON bitacora_operacion (fecha DESC);
