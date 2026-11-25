-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 00_crear_base_datos.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: infraestructura. Se ejecuta como SUPERUSUARIO (postgres)
--   conectado a la base "postgres". Crea los roles del cluster y la base
--   de datos con un dueno SIN privilegios de superusuario (tienda_owner),
--   de modo que los procedimientos SECURITY DEFINER corran con los
--   privilegios minimos del dueno y no con los de postgres.
-- Contrasenas de demostracion: CAMBIARLAS antes de un uso real.
-- =====================================================================
\set ON_ERROR_STOP on

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tienda_owner') THEN
        CREATE ROLE tienda_owner LOGIN PASSWORD 'Owner2026*';
    END IF;
    -- roles de grupo (sin login): definen los permisos por perfil
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_admin_tienda') THEN CREATE ROLE rol_admin_tienda NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_vendedor')     THEN CREATE ROLE rol_vendedor NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_analista')     THEN CREATE ROLE rol_analista NOLOGIN; END IF;
    -- usuario con el que se conecta la aplicacion web
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tienda') THEN
        CREATE ROLE app_tienda LOGIN PASSWORD 'App2026*';
    END IF;
    -- usuario administrativo: la aplicacion solo lo usa para operaciones con COMMIT/ROLLBACK explicitos,
    -- que PostgreSQL no permite dentro de procedimientos SECURITY DEFINER
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
        CREATE ROLE app_admin LOGIN PASSWORD 'AppAdmin2026*' IN ROLE rol_admin_tienda;
    END IF;
    -- usuarios de demostracion para probar permisos y seguridad por fila
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demo_vendedor') THEN
        CREATE ROLE demo_vendedor LOGIN PASSWORD 'Demo2026*' IN ROLE rol_vendedor;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demo_analista') THEN
        CREATE ROLE demo_analista LOGIN PASSWORD 'Demo2026*' IN ROLE rol_analista;
    END IF;
END
$$;

DROP DATABASE IF EXISTS tienda_ropa;
CREATE DATABASE tienda_ropa
    WITH OWNER = tienda_owner ENCODING = 'UTF8' TEMPLATE = template0;
COMMENT ON DATABASE tienda_ropa IS 'Sistema de informacion de una tienda de ropa con venta fisica y en linea';

REVOKE ALL ON DATABASE tienda_ropa FROM PUBLIC;
GRANT CONNECT ON DATABASE tienda_ropa TO tienda_owner, app_tienda, rol_admin_tienda, rol_vendedor, rol_analista;

-- Ruta de busqueda por defecto de los usuarios de aplicacion y demostracion
ALTER ROLE app_tienda     IN DATABASE tienda_ropa SET search_path = tienda;
ALTER ROLE app_admin      IN DATABASE tienda_ropa SET search_path = tienda;
ALTER ROLE demo_vendedor  IN DATABASE tienda_ropa SET search_path = tienda;
ALTER ROLE demo_analista  IN DATABASE tienda_ropa SET search_path = tienda;
ALTER ROLE tienda_owner   IN DATABASE tienda_ropa SET search_path = tienda, extensiones;
