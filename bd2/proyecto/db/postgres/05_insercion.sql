-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 05_insercion.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: datos de prueba. Genera catalogo (46 productos, ~690
--   variantes), 6 sucursales, inventario, 600 clientes, promociones y
--   3.200 pedidos de los ultimos 12 meses con pagos y devoluciones.
--   Los pedidos avanzan de estado con UPDATE para que los triggers
--   (validacion de transiciones, puntos de fidelizacion) se ejecuten de
--   verdad. Credenciales de demostracion al final del archivo.
-- =====================================================================
\set ON_ERROR_STOP on
SET search_path = tienda, extensiones;
SELECT setseed(0.42);

-- ---------------------------------------------------------------------
-- Geografia, sucursales y empleados
-- ---------------------------------------------------------------------
INSERT INTO ciudad (nombre, departamento) VALUES
    ('Bogotá D.C.', 'Cundinamarca'), ('Medellín', 'Antioquia'), ('Cali', 'Valle del Cauca'),
    ('Barranquilla', 'Atlántico'), ('Bucaramanga', 'Santander'), ('Cartagena', 'Bolívar'),
    ('Soacha', 'Cundinamarca'), ('Chía', 'Cundinamarca');

INSERT INTO sucursal (nombre, tipo, direccion, id_ciudad, telefono) VALUES
    ('Tienda Bogotá Norte',      'FISICA', 'Calle 134 # 7B-83',   (SELECT id_ciudad FROM ciudad WHERE nombre = 'Bogotá D.C.'), '601 555 0101'),
    ('Tienda Bogotá Centro',     'FISICA', 'Carrera 7 # 18-45',   (SELECT id_ciudad FROM ciudad WHERE nombre = 'Bogotá D.C.'), '601 555 0102'),
    ('Tienda Medellín Poblado',  'FISICA', 'Carrera 43A # 9-61',  (SELECT id_ciudad FROM ciudad WHERE nombre = 'Medellín'),    '604 555 0103'),
    ('Tienda Cali Sur',          'FISICA', 'Calle 5 # 38-20',     (SELECT id_ciudad FROM ciudad WHERE nombre = 'Cali'),        '602 555 0104'),
    ('Tienda Barranquilla Norte','FISICA', 'Carrera 53 # 82-120', (SELECT id_ciudad FROM ciudad WHERE nombre = 'Barranquilla'),'605 555 0105'),
    ('Tienda Virtual y Bodega Central', 'ONLINE', NULL,           (SELECT id_ciudad FROM ciudad WHERE nombre = 'Bogotá D.C.'), '601 555 0100');

CREATE TEMP TABLE tmp_nombres AS
    SELECT ARRAY['Camila','Valentina','Sofía','Laura','Daniela','Mariana','Juliana','Andrea','Paula','Carolina',
                 'Santiago','Mateo','Sebastián','Daniel','Camilo','Andrés','Felipe','Juan','Nicolás','David'] AS nom,
           ARRAY['Rodríguez','Gómez','Martínez','López','García','Hernández','Ramírez','Torres','Díaz','Vargas',
                 'Castro','Moreno','Ortiz','Rojas','Gutiérrez','Pérez','Suárez','Ríos','Cárdenas','Mejía'] AS ape;

INSERT INTO empleado (id_sucursal, documento, nombres, apellidos, cargo, fecha_ingreso)
SELECT s.id_sucursal,
       '10' || lpad((s.id_sucursal * 10 + k.n)::text, 8, '0'),
       t.nom[1 + (s.id_sucursal * 7 + k.n * 3) % 20],
       t.ape[1 + (s.id_sucursal * 5 + k.n * 11) % 20] || ' ' || t.ape[1 + (s.id_sucursal * 3 + k.n * 7) % 20],
       k.cargo,
       DATE '2023-02-01' + (s.id_sucursal * 37 + k.n * 53) % 600
  FROM sucursal s
 CROSS JOIN (VALUES (1, 'GERENTE'), (2, 'VENDEDOR'), (3, 'VENDEDOR'), (4, 'CAJERO')) AS k(n, cargo)
 CROSS JOIN tmp_nombres t
 WHERE s.tipo = 'FISICA'
UNION ALL
SELECT s.id_sucursal, '10' || lpad((s.id_sucursal * 10 + k.n)::text, 8, '0'),
       t.nom[1 + (k.n * 9) % 20], t.ape[1 + (k.n * 13) % 20] || ' ' || t.ape[1 + (k.n * 17) % 20],
       k.cargo, DATE '2022-08-01' + k.n * 40
  FROM sucursal s
 CROSS JOIN (VALUES (1, 'ADMIN'), (2, 'BODEGUERO'), (3, 'BODEGUERO')) AS k(n, cargo)
 CROSS JOIN tmp_nombres t
 WHERE s.tipo = 'ONLINE';

-- Usuarios del sistema (contrasenas con bcrypt)
INSERT INTO usuario_sistema (id_empleado, username, password_hash, rol)
SELECT e.id_empleado, 'admin', crypt('Admin2026*', gen_salt('bf', 10)), 'ADMIN'
  FROM empleado e WHERE e.cargo = 'ADMIN';
INSERT INTO usuario_sistema (id_empleado, username, password_hash, rol)
SELECT x.id_empleado, 'vendedor' || x.id_sucursal, crypt('Vende2026*', gen_salt('bf', 10)), 'VENDEDOR'
  FROM (SELECT DISTINCT ON (id_sucursal) id_empleado, id_sucursal
          FROM empleado WHERE cargo = 'VENDEDOR' ORDER BY id_sucursal, id_empleado) x;
INSERT INTO usuario_sistema (id_empleado, username, password_hash, rol)
SELECT e.id_empleado, 'analista', crypt('Analista2026*', gen_salt('bf', 10)), 'ANALISTA'
  FROM empleado e WHERE e.cargo = 'GERENTE' AND e.id_sucursal = 1;

-- ---------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------
INSERT INTO categoria (nombre) VALUES ('Ropa'), ('Accesorios');
INSERT INTO categoria (nombre, id_categoria_padre)
SELECT x.nombre, (SELECT id_categoria FROM categoria WHERE nombre = x.padre)
  FROM (VALUES ('Superiores','Ropa'), ('Inferiores','Ropa'), ('Vestidos y Enterizos','Ropa'), ('Abrigos','Ropa'),
               ('Deportiva','Ropa'), ('Ropa Interior y Dormir','Ropa'),
               ('Gorras y Sombreros','Accesorios'), ('Cinturones','Accesorios'), ('Bolsos','Accesorios')) AS x(nombre, padre);
INSERT INTO categoria (nombre, id_categoria_padre)
SELECT x.nombre, (SELECT id_categoria FROM categoria WHERE nombre = x.padre)
  FROM (VALUES ('Camisetas','Superiores'), ('Camisas','Superiores'), ('Blusas','Superiores'), ('Buzos y Sudaderas','Superiores'),
               ('Jeans','Inferiores'), ('Pantalones','Inferiores'), ('Shorts','Inferiores'), ('Faldas','Inferiores'),
               ('Chaquetas','Abrigos'), ('Gabardinas y Paños','Abrigos')) AS x(nombre, padre);

INSERT INTO marca (nombre) VALUES ('Andina Básicos'), ('Urbano 57'), ('Costa Viva'), ('Norte Denim'),
                                  ('Sierra Kids'), ('Pacífico Sport'), ('Casa Lino');

CREATE TEMP TABLE tmp_prod (n serial, nombre text, categoria text, marca text, genero text, precio numeric, tallas text);
INSERT INTO tmp_prod (nombre, categoria, marca, genero, precio, tallas) VALUES
 ('Camiseta básica cuello redondo',   'Camisetas',          'Andina Básicos', 'MUJER',  39900, 'TOP'),
 ('Camiseta estampada manga corta',   'Camisetas',          'Urbano 57',      'MUJER',  49900, 'TOP'),
 ('Camiseta oversize de algodón',     'Camisetas',          'Costa Viva',     'MUJER',  59900, 'TOP'),
 ('Blusa de lino manga larga',        'Blusas',             'Casa Lino',      'MUJER',  89900, 'TOP'),
 ('Blusa satinada con lazo',          'Blusas',             'Urbano 57',      'MUJER',  79900, 'TOP'),
 ('Jean skinny tiro alto',            'Jeans',              'Norte Denim',    'MUJER', 139900, 'NUMM'),
 ('Jean mom fit',                     'Jeans',              'Norte Denim',    'MUJER', 149900, 'NUMM'),
 ('Jean wide leg',                    'Jeans',              'Norte Denim',    'MUJER', 159900, 'NUMM'),
 ('Pantalón palazzo',                 'Pantalones',         'Casa Lino',      'MUJER', 119900, 'NUMM'),
 ('Short de jean',                    'Shorts',             'Norte Denim',    'MUJER',  79900, 'NUMM'),
 ('Falda midi plisada',               'Faldas',             'Casa Lino',      'MUJER',  99900, 'TOP'),
 ('Vestido camisero',                 'Vestidos y Enterizos','Casa Lino',     'MUJER', 169900, 'TOP'),
 ('Vestido floral largo',             'Vestidos y Enterizos','Costa Viva',    'MUJER', 189900, 'TOP'),
 ('Enterizo de lino',                 'Vestidos y Enterizos','Casa Lino',     'MUJER', 179900, 'TOP'),
 ('Buzo cuello alto tejido',          'Buzos y Sudaderas',  'Andina Básicos', 'MUJER', 109900, 'TOP'),
 ('Hoodie de felpa',                  'Buzos y Sudaderas',  'Urbano 57',      'UNISEX',129900, 'TOP'),
 ('Chaqueta de jean',                 'Chaquetas',          'Norte Denim',    'MUJER', 219900, 'TOP'),
 ('Chaqueta bomber',                  'Chaquetas',          'Urbano 57',      'UNISEX',249900, 'TOP'),
 ('Gabardina clásica',                'Gabardinas y Paños', 'Casa Lino',      'MUJER', 329900, 'TOP'),
 ('Legging deportivo',                'Deportiva',          'Pacífico Sport', 'MUJER',  89900, 'TOP'),
 ('Top deportivo',                    'Deportiva',          'Pacífico Sport', 'MUJER',  59900, 'TOP'),
 ('Pijama dos piezas',                'Ropa Interior y Dormir','Andina Básicos','MUJER', 99900, 'TOP'),
 ('Camiseta básica hombre',           'Camisetas',          'Andina Básicos', 'HOMBRE', 39900, 'TOP'),
 ('Polo piqué',                       'Camisetas',          'Costa Viva',     'HOMBRE', 79900, 'TOP'),
 ('Camisa oxford manga larga',        'Camisas',            'Casa Lino',      'HOMBRE',129900, 'TOP'),
 ('Camisa de lino',                   'Camisas',            'Casa Lino',      'HOMBRE',139900, 'TOP'),
 ('Jean slim',                        'Jeans',              'Norte Denim',    'HOMBRE',149900, 'JEAN'),
 ('Jean recto clásico',               'Jeans',              'Norte Denim',    'HOMBRE',139900, 'JEAN'),
 ('Pantalón chino',                   'Pantalones',         'Costa Viva',     'HOMBRE',129900, 'JEAN'),
 ('Jogger de algodón',                'Pantalones',         'Pacífico Sport', 'HOMBRE', 99900, 'TOP'),
 ('Bermuda cargo',                    'Shorts',             'Costa Viva',     'HOMBRE', 99900, 'JEAN'),
 ('Buzo cuello redondo',              'Buzos y Sudaderas',  'Andina Básicos', 'HOMBRE',109900, 'TOP'),
 ('Chaqueta cortavientos',            'Chaquetas',          'Pacífico Sport', 'HOMBRE',189900, 'TOP'),
 ('Abrigo de paño',                   'Gabardinas y Paños', 'Casa Lino',      'HOMBRE',349900, 'TOP'),
 ('Camiseta deportiva dry-fit',       'Deportiva',          'Pacífico Sport', 'HOMBRE', 69900, 'TOP'),
 ('Pantaloneta deportiva',            'Deportiva',          'Pacífico Sport', 'HOMBRE', 59900, 'TOP'),
 ('Boxer de algodón x3',              'Ropa Interior y Dormir','Andina Básicos','HOMBRE', 59900, 'TOP'),
 ('Camiseta estampada niño',          'Camisetas',          'Sierra Kids',    'NINO',   34900, 'KID'),
 ('Jean niño',                        'Jeans',              'Sierra Kids',    'NINO',   79900, 'KID'),
 ('Buzo niña',                        'Buzos y Sudaderas',  'Sierra Kids',    'NINA',   69900, 'KID'),
 ('Vestido niña',                     'Vestidos y Enterizos','Sierra Kids',   'NINA',   89900, 'KID'),
 ('Sudadera infantil',                'Buzos y Sudaderas',  'Sierra Kids',    'NINO',   64900, 'KID'),
 ('Gorra clásica',                    'Gorras y Sombreros', 'Urbano 57',      'UNISEX', 49900, 'UNICA'),
 ('Cinturón de cuero',                'Cinturones',         'Casa Lino',      'UNISEX', 79900, 'UNICA'),
 ('Bolso tote',                       'Bolsos',             'Costa Viva',     'MUJER', 119900, 'UNICA'),
 ('Bolso bandolera',                  'Bolsos',             'Urbano 57',      'UNISEX', 99900, 'UNICA');

INSERT INTO producto (nombre, descripcion, id_categoria, id_marca, genero, precio_base, fecha_creacion)
SELECT p.nombre,
       p.nombre || ' de la línea ' || p.marca || '. Disponible en varias tallas y colores.',
       (SELECT id_categoria FROM categoria WHERE nombre = p.categoria),
       (SELECT id_marca FROM marca WHERE nombre = p.marca),
       p.genero, p.precio,
       TIMESTAMPTZ '2025-06-01 09:00-05' + (p.n * 4) * interval '1 day'
  FROM tmp_prod p ORDER BY p.n;

-- Variantes: talla x color (3 o 4 colores por producto)
INSERT INTO variante_producto (id_producto, talla, color, sku)
SELECT pr.id_producto, t.talla, c.color, fn_generar_sku(pr.id_producto, t.talla, c.color)
  FROM tmp_prod tp
  JOIN producto pr ON pr.nombre = tp.nombre
  JOIN LATERAL unnest(CASE tp.tallas
         WHEN 'TOP'   THEN ARRAY['XS','S','M','L','XL']
         WHEN 'NUMM'  THEN ARRAY['6','8','10','12','14']
         WHEN 'JEAN'  THEN ARRAY['28','30','32','34','36']
         WHEN 'KID'   THEN ARRAY['4','6','8','10','12']
         ELSE ARRAY['U'] END) WITH ORDINALITY AS t(talla, ord) ON true
  JOIN LATERAL (SELECT (ARRAY['Negro','Blanco','Azul','Rojo','Verde','Beige','Gris','Vinotinto','Mostaza','Rosado'])
                        [1 + ((tp.n * 3 + j) % 10)] AS color
                  FROM generate_series(0, 2 + (tp.n % 2)) j) c ON true
 ORDER BY pr.id_producto, c.color, t.ord;

-- ---------------------------------------------------------------------
-- Inventario inicial (el trigger kardex registra INVENTARIO_INICIAL)
-- ---------------------------------------------------------------------
INSERT INTO inventario (id_sucursal, id_variante, stock, stock_minimo)
SELECT s.id_sucursal, v.id_variante,
       CASE WHEN s.tipo = 'ONLINE' THEN 25 + floor(random() * 40)::int
            WHEN random() < 0.07 THEN floor(random() * 4)::int          -- ~7% de variantes en alerta de stock bajo
            ELSE 4 + floor(random() * 12)::int END,
       CASE WHEN s.tipo = 'ONLINE' THEN 10 ELSE 3 END
  FROM sucursal s CROSS JOIN variante_producto v;

-- ---------------------------------------------------------------------
-- Clientes (600), perfiles y direcciones
-- ---------------------------------------------------------------------
INSERT INTO cliente (tipo_documento, documento, nombres, apellidos, email, telefono, fecha_registro)
SELECT CASE WHEN g % 40 = 0 THEN 'CE' ELSE 'CC' END,
       (10000000 + g * 1373)::text,
       t.nom[1 + (g * 7) % 20],
       t.ape[1 + (g * 3) % 20] || ' ' || t.ape[1 + (g * 11 + 5) % 20],
       translate(lower(t.nom[1 + (g * 7) % 20]), 'áéíóúñ', 'aeioun') || '.' ||
       translate(lower(t.ape[1 + (g * 3) % 20]), 'áéíóúñ', 'aeioun') || g || '@' ||
       (ARRAY['gmail.com','hotmail.com','outlook.com','yahoo.es'])[1 + g % 4],
       '3' || lpad(floor(random() * 1000000000)::bigint::text, 9, '0'),
       TIMESTAMPTZ '2025-01-02 10:00-05' + (random() * 300)::int * interval '1 day'
  FROM generate_series(1, 600) g CROSS JOIN tmp_nombres t;

INSERT INTO perfil_fidelizacion (id_cliente) SELECT id_cliente FROM cliente;

INSERT INTO direccion_cliente (id_cliente, alias, direccion, id_ciudad, es_principal, telefono_contacto)
SELECT c.id_cliente, 'Casa',
       (ARRAY['Calle','Carrera','Avenida','Transversal','Diagonal'])[1 + c.id_cliente % 5] || ' ' ||
       (10 + c.id_cliente % 150) || ' # ' || (1 + c.id_cliente % 90) || '-' || (1 + (c.id_cliente * 7) % 99),
       (SELECT id_ciudad FROM ciudad ORDER BY CASE WHEN c.id_cliente % 10 < 5 THEN nombre <> 'Bogotá D.C.' ELSE false END,
                                          (c.id_cliente * 31 + id_ciudad) % 17 LIMIT 1),
       true, c.telefono
  FROM cliente c;
INSERT INTO direccion_cliente (id_cliente, alias, direccion, id_ciudad, es_principal)
SELECT c.id_cliente, 'Trabajo',
       'Carrera ' || (5 + c.id_cliente % 80) || ' # ' || (20 + c.id_cliente % 60) || '-' || (1 + c.id_cliente % 40),
       (SELECT id_ciudad FROM direccion_cliente d WHERE d.id_cliente = c.id_cliente AND d.es_principal), false
  FROM cliente c WHERE c.id_cliente % 3 = 0;

-- ---------------------------------------------------------------------
-- Promociones
-- ---------------------------------------------------------------------
INSERT INTO promocion (nombre, tipo_descuento, valor, fecha_inicio, fecha_fin, activa) VALUES
    ('Jeans de temporada 20%',          'PORCENTAJE', 20,    '2026-10-15', '2026-11-30', true),
    ('Liquidación de abrigos 25%',      'PORCENTAJE', 25,    '2026-10-01', '2026-12-31', true),
    ('Bolsos con $20.000 menos',        'MONTO',      20000, '2026-10-20', '2026-11-15', true),
    ('Viernes de camisetas 30%',        'PORCENTAJE', 30,    '2026-11-20', '2026-11-30', true),
    ('Rebajas de mitad de año 15%',     'PORCENTAJE', 15,    '2026-06-15', '2026-07-15', true);

INSERT INTO promocion_producto (id_promocion, id_producto)
SELECT pr.id_promocion, p.id_producto
  FROM promocion pr
  JOIN producto p ON p.id_categoria IN (
         SELECT id_categoria FROM categoria WHERE nombre =
              CASE pr.nombre WHEN 'Jeans de temporada 20%' THEN 'Jeans'
                             WHEN 'Liquidación de abrigos 25%' THEN 'Gabardinas y Paños'
                             WHEN 'Bolsos con $20.000 menos' THEN 'Bolsos'
                             WHEN 'Viernes de camisetas 30%' THEN 'Camisetas'
                             ELSE 'Pantalones' END
         UNION ALL
         SELECT id_categoria FROM categoria WHERE nombre = 'Chaquetas' AND pr.nombre = 'Liquidación de abrigos 25%');

-- ---------------------------------------------------------------------
-- Pedidos historicos (3.200)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE tmp_var AS
    SELECT id_producto, min(id_variante) AS primero, count(*)::int AS cuantas
      FROM variante_producto GROUP BY id_producto;

-- Encabezados. TIENDA: venta de mostrador en una sucursal fisica.
-- ONLINE: 75% a domicilio desde la bodega virtual, 25% para recoger en tienda.
CREATE TEMP TABLE tmp_enc AS
SELECT g,
       1 + floor(random() * 600)::int                   AS id_cliente,
       random() < 0.55                                  AS es_tienda,
       1 + floor(random() * 5)::int                     AS suc_fisica,
       random() < 0.75                                  AS domicilio,
       TIMESTAMPTZ '2025-11-05 09:00-05' + (random() * 363)::int * interval '1 day'
                  + floor(random() * 12) * interval '1 hour' + floor(random() * 60) * interval '1 minute' AS fecha
  FROM generate_series(1, 3200) g;

INSERT INTO pedido (id_cliente, id_sucursal, id_empleado, canal, tipo_entrega, fecha_pedido, id_direccion_envio)
SELECT e.id_cliente,
       CASE WHEN NOT e.es_tienda AND e.domicilio THEN (SELECT id_sucursal FROM sucursal WHERE tipo = 'ONLINE')
            ELSE e.suc_fisica END,
       CASE WHEN e.es_tienda THEN
            (SELECT id_empleado FROM empleado em
              WHERE em.id_sucursal = e.suc_fisica AND em.cargo IN ('VENDEDOR', 'CAJERO')
              ORDER BY id_empleado OFFSET e.g % 3 LIMIT 1) END,
       CASE WHEN e.es_tienda THEN 'TIENDA' ELSE 'ONLINE' END,
       CASE WHEN e.es_tienda THEN 'VENTA_MOSTRADOR' WHEN e.domicilio THEN 'DOMICILIO' ELSE 'RECOGER_EN_TIENDA' END,
       e.fecha,
       CASE WHEN NOT e.es_tienda AND e.domicilio THEN
            (SELECT d.id_direccion FROM direccion_cliente d WHERE d.id_cliente = e.id_cliente AND d.es_principal) END
  FROM tmp_enc e ORDER BY e.g;

-- Lineas: 1 a 4 por pedido; los productos mas bajos del catalogo se venden mas (distribucion sesgada)
INSERT INTO detalle_pedido (id_pedido, num_linea, id_variante, cantidad, precio_unitario, descuento_unitario)
SELECT x.id_pedido, x.num_linea, x.id_variante, x.cantidad, x.precio, 
       CASE WHEN x.r_desc < 0.2 THEN round(x.precio * 0.10, -2) ELSE 0 END
  FROM (
    SELECT p.id_pedido, l AS num_linea,
           tv.primero + floor(random() * tv.cuantas)::int AS id_variante,
           CASE WHEN random() < 0.8 THEN 1 WHEN random() < 0.7 THEN 2 ELSE 3 END AS cantidad,
           pr.precio_base AS precio, random() AS r_desc
      FROM pedido p
      CROSS JOIN LATERAL generate_series(1, 1 + floor(random() * random() * 4)::int + (p.id_pedido % 2)) l
      CROSS JOIN LATERAL (SELECT 1 + floor(power(random(), 1.5) * 46)::int AS id_producto
                           WHERE l > 0 AND p.id_pedido > 0) sel
      JOIN tmp_var tv ON tv.id_producto = sel.id_producto
      JOIN producto pr ON pr.id_producto = sel.id_producto
  ) x;

-- Costo de envio (los triggers recalculan el total)
UPDATE pedido SET costo_envio = fn_costo_envio(subtotal - descuento_total, tipo_entrega);

-- Pagos aprobados por el total de cada pedido
INSERT INTO pago (id_pedido, metodo, monto, estado, fecha_pago, referencia_externa)
SELECT p.id_pedido,
       CASE WHEN p.canal = 'TIENDA' THEN (ARRAY['EFECTIVO','TARJETA_DEBITO','TARJETA_CREDITO','NEQUI'])[1 + p.id_pedido % 4]
            ELSE (ARRAY['PSE','TARJETA_CREDITO','NEQUI','TRANSFERENCIA'])[1 + p.id_pedido % 4] END,
       p.total, 'APROBADO', p.fecha_pedido + interval '3 minutes', 'HIST-' || p.id_pedido
  FROM pedido p WHERE p.total > 0;

-- Estado final de cada pedido
CREATE TEMP TABLE tmp_destino AS
SELECT p.id_pedido, p.canal, p.tipo_entrega,
       CASE
         WHEN p.fecha_pedido < now() - interval '15 days' THEN
              CASE WHEN p.canal = 'ONLINE' AND random() < 0.08 THEN 'CANCELADO' ELSE 'ENTREGADO' END
         ELSE (ARRAY['PAGADO','EN_PREPARACION','ENVIADO','ENTREGADO','ENTREGADO'])[1 + floor(random() * 5)::int]
       END AS final
  FROM pedido p;
UPDATE tmp_destino SET final = 'ENTREGADO' WHERE canal = 'TIENDA';

UPDATE pedido SET estado = 'PAGADO'         WHERE id_pedido IN (SELECT id_pedido FROM tmp_destino);
UPDATE pedido SET estado = 'EN_PREPARACION' WHERE id_pedido IN (SELECT id_pedido FROM tmp_destino WHERE final IN ('EN_PREPARACION','ENVIADO','ENTREGADO') AND canal = 'ONLINE');
UPDATE pedido SET estado = 'ENVIADO'        WHERE id_pedido IN (SELECT id_pedido FROM tmp_destino WHERE final IN ('ENVIADO','ENTREGADO') AND canal = 'ONLINE');
UPDATE pedido SET estado = 'ENTREGADO'      WHERE id_pedido IN (SELECT id_pedido FROM tmp_destino WHERE final = 'ENTREGADO');
UPDATE pedido SET estado = 'CANCELADO'      WHERE id_pedido IN (SELECT id_pedido FROM tmp_destino WHERE final = 'CANCELADO');
UPDATE pago   SET estado = 'REEMBOLSADO'    WHERE id_pedido IN (SELECT id_pedido FROM tmp_destino WHERE final = 'CANCELADO');

-- Devoluciones: ~7% de las lineas entregadas. Los triggers validan la
-- cantidad, calculan el reembolso y descuentan puntos de fidelizacion.
INSERT INTO devolucion (id_pedido, num_linea, cantidad, motivo, fecha_devolucion, reingresa_stock)
SELECT d.id_pedido, d.num_linea, 1,
       (ARRAY['TALLA_INCORRECTA','TALLA_INCORRECTA','DEFECTO','NO_ME_GUSTO','ERROR_ENVIO','OTRO'])[1 + floor(random() * 6)::int],
       LEAST(p.fecha_pedido + (3 + floor(random() * 15)::int) * interval '1 day', now()),
       true
  FROM detalle_pedido d JOIN pedido p ON p.id_pedido = d.id_pedido
 WHERE p.estado = 'ENTREGADO' AND random() < 0.07;
UPDATE devolucion SET reingresa_stock = false WHERE motivo = 'DEFECTO';

DROP TABLE tmp_nombres, tmp_prod, tmp_var, tmp_enc, tmp_destino;

ANALYZE pedido; ANALYZE detalle_pedido; ANALYZE inventario; ANALYZE producto; ANALYZE variante_producto;
ANALYZE cliente; ANALYZE pago; ANALYZE devolucion; ANALYZE movimiento_inventario;

-- ---------------------------------------------------------------------
-- Credenciales de demostracion (cambiar en produccion):
--   admin       / Admin2026*      (rol ADMIN)
--   vendedor1.. / Vende2026*      (rol VENDEDOR, uno por sucursal fisica)
--   analista    / Analista2026*   (rol ANALISTA)
-- ---------------------------------------------------------------------
