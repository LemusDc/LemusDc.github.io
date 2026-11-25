-- =====================================================================
-- Proyecto Final Bases de Datos 2 - Tienda de Ropa
-- Archivo : 10_reportes.sql
-- Autores : Juan Diego Mateus, Diego Lemus
-- Fecha   : 2026-11-04
-- Descripcion: documento SQL de reportes gerenciales. Cada reporte indica
--   la pregunta de negocio y las tecnicas SQL usadas. Reglas aplicadas:
--   (1) si dos tablas tienen granularidad distinta (lineas vs
--       devoluciones) se agrega cada una ANTES de unirlas;
--   (2) para conservar filas sin coincidencias se usa LEFT JOIN y
--       COALESCE, nunca un filtro sobre la tabla del lado opcional;
--   (3) para "exactamente N" se usa ROW_NUMBER con desempate; RANK y
--       DENSE_RANK solo cuando se aceptan empates.
-- Uso: psql -d tienda_ropa -f 10_reportes.sql
-- =====================================================================
SET search_path = tienda, extensiones;
\pset null '-'
\pset footer off

\echo '##### R01. Ventas netas mensuales por sucursal con variacion y acumulado #####'
-- Pregunta: como evolucionan las ventas netas (ventas - devoluciones) de cada sucursal?
-- Tecnicas: CTE, FULL OUTER JOIN de dos agregados, LAG, SUM() OVER acumulado, NULLIF.
-- La devolucion se imputa al mes en que ocurre (fecha_devolucion), no al de la venta.
WITH ventas AS (
    SELECT p.id_sucursal, date_trunc('month', p.fecha_pedido)::date AS mes, SUM(d.subtotal_linea) AS vendido
      FROM pedido p JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
     WHERE p.estado = 'ENTREGADO'
     GROUP BY p.id_sucursal, date_trunc('month', p.fecha_pedido)
), devueltas AS (
    SELECT p.id_sucursal, date_trunc('month', dv.fecha_devolucion)::date AS mes, SUM(dv.monto_reembolsado) AS devuelto
      FROM devolucion dv JOIN pedido p ON p.id_pedido = dv.id_pedido
     GROUP BY p.id_sucursal, date_trunc('month', dv.fecha_devolucion)
), neta AS (
    SELECT COALESCE(v.id_sucursal, d.id_sucursal) AS id_sucursal, COALESCE(v.mes, d.mes) AS mes,
           COALESCE(v.vendido, 0) AS vendido, COALESCE(d.devuelto, 0) AS devuelto,
           COALESCE(v.vendido, 0) - COALESCE(d.devuelto, 0) AS venta_neta
      FROM ventas v FULL OUTER JOIN devueltas d ON d.id_sucursal = v.id_sucursal AND d.mes = v.mes
)
SELECT s.nombre AS sucursal, n.mes, n.vendido, n.devuelto, n.venta_neta,
       ROUND(100 * (n.venta_neta - LAG(n.venta_neta) OVER w) / NULLIF(LAG(n.venta_neta) OVER w, 0), 1) AS variacion_pct,
       SUM(n.venta_neta) OVER (PARTITION BY n.id_sucursal ORDER BY n.mes) AS acumulado
  FROM neta n JOIN sucursal s ON s.id_sucursal = n.id_sucursal
WINDOW w AS (PARTITION BY n.id_sucursal ORDER BY n.mes)
 ORDER BY s.nombre, n.mes;

\echo
\echo '##### R02. Top 3 categorias por ciudad (venta neta anual) #####'
-- Pregunta: que 3 categorias venden mas en cada ciudad?
-- Tecnicas: agregacion previa por separado, DENSE_RANK por particion, filtro Top-N.
WITH ventas AS (
    SELECT s.id_ciudad, pr.id_categoria, SUM(d.subtotal_linea) AS vendido
      FROM pedido p
      JOIN sucursal s           ON s.id_sucursal = p.id_sucursal
      JOIN detalle_pedido d     ON d.id_pedido = p.id_pedido
      JOIN variante_producto v  ON v.id_variante = d.id_variante
      JOIN producto pr          ON pr.id_producto = v.id_producto
     WHERE p.estado = 'ENTREGADO' AND p.fecha_pedido >= now() - interval '12 months'
     GROUP BY s.id_ciudad, pr.id_categoria
), devueltas AS (
    SELECT s.id_ciudad, pr.id_categoria, SUM(dv.monto_reembolsado) AS devuelto
      FROM devolucion dv
      JOIN pedido p             ON p.id_pedido = dv.id_pedido
      JOIN sucursal s           ON s.id_sucursal = p.id_sucursal
      JOIN detalle_pedido d     ON d.id_pedido = dv.id_pedido AND d.num_linea = dv.num_linea
      JOIN variante_producto v  ON v.id_variante = d.id_variante
      JOIN producto pr          ON pr.id_producto = v.id_producto
     GROUP BY s.id_ciudad, pr.id_categoria
), ranking AS (
    SELECT v.id_ciudad, v.id_categoria, v.vendido - COALESCE(d.devuelto, 0) AS venta_neta,
           DENSE_RANK() OVER (PARTITION BY v.id_ciudad ORDER BY v.vendido - COALESCE(d.devuelto, 0) DESC) AS puesto
      FROM ventas v LEFT JOIN devueltas d ON d.id_ciudad = v.id_ciudad AND d.id_categoria = v.id_categoria
)
SELECT ci.nombre AS ciudad, r.puesto, c.nombre AS categoria, r.venta_neta
  FROM ranking r JOIN ciudad ci ON ci.id_ciudad = r.id_ciudad JOIN categoria c ON c.id_categoria = r.id_categoria
 WHERE r.puesto <= 3
 ORDER BY ci.nombre, r.puesto;

\echo
\echo '##### R03. Ventas acumuladas por rama del arbol de categorias #####'
-- Pregunta: cuanto vende cada categoria incluyendo todas sus subcategorias?
-- Tecnicas: CTE RECURSIVO (clausura del arbol), LEFT JOIN, repeat() para sangria.
-- Un numero fijo de self-joins no sirve: la profundidad podria crecer sin cambiar el SQL.
WITH RECURSIVE cierre AS (
    SELECT id_categoria AS ancestro, id_categoria AS descendiente FROM categoria
    UNION ALL
    SELECT ci.ancestro, h.id_categoria FROM cierre ci JOIN categoria h ON h.id_categoria_padre = ci.descendiente
), venta_directa AS (
    SELECT pr.id_categoria, SUM(d.subtotal_linea) AS venta
      FROM detalle_pedido d
      JOIN pedido p ON p.id_pedido = d.id_pedido
      JOIN variante_producto v ON v.id_variante = d.id_variante
      JOIN producto pr ON pr.id_producto = v.id_producto
     WHERE p.estado = 'ENTREGADO'
     GROUP BY pr.id_categoria
)
SELECT repeat('    ', c.nivel - 1) || c.nombre AS categoria, c.nivel,
       COALESCE(SUM(vd.venta), 0) AS venta_acumulada
  FROM vw_categorias c
  JOIN cierre ON cierre.ancestro = c.id_categoria
  LEFT JOIN venta_directa vd ON vd.id_categoria = cierre.descendiente
 GROUP BY c.id_categoria, c.nombre, c.nivel, c.ruta
 ORDER BY c.ruta;

\echo
\echo '##### R04. Top 10 productos por ingresos con participacion y Pareto #####'
-- Tecnicas: SUM() OVER () para el total, suma acumulada ordenada (curva de Pareto).
WITH ingresos AS (
    SELECT pr.id_producto, pr.nombre, SUM(d.cantidad) AS unidades, SUM(d.subtotal_linea) AS ingresos
      FROM detalle_pedido d
      JOIN pedido p ON p.id_pedido = d.id_pedido
      JOIN variante_producto v ON v.id_variante = d.id_variante
      JOIN producto pr ON pr.id_producto = v.id_producto
     WHERE p.estado = 'ENTREGADO'
     GROUP BY pr.id_producto, pr.nombre
)
SELECT ROW_NUMBER() OVER (ORDER BY ingresos DESC, id_producto) AS puesto, nombre, unidades, ingresos,
       ROUND(100 * ingresos / SUM(ingresos) OVER (), 2) AS participacion_pct,
       ROUND(100 * SUM(ingresos) OVER (ORDER BY ingresos DESC, id_producto) / SUM(ingresos) OVER (), 2) AS acumulado_pct
  FROM ingresos
 ORDER BY puesto
 LIMIT 10;

\echo
\echo '##### R05. Segmentacion RFM de clientes #####'
-- Pregunta: quienes son los mejores clientes y quienes se estan perdiendo?
-- Tecnicas: NTILE(4) para puntuar Recencia, Frecuencia y Monto; CASE para segmentar.
WITH base AS (
    SELECT p.id_cliente, current_date - MAX(p.fecha_pedido)::date AS recencia_dias,
           COUNT(*) AS frecuencia, SUM(p.total) AS monto
      FROM pedido p WHERE p.estado = 'ENTREGADO' GROUP BY p.id_cliente
), puntajes AS (
    SELECT b.*, NTILE(4) OVER (ORDER BY recencia_dias DESC) AS r,
                NTILE(4) OVER (ORDER BY frecuencia)         AS f,
                NTILE(4) OVER (ORDER BY monto)              AS m
      FROM base b
), segmentos AS (
    SELECT *, CASE WHEN r >= 3 AND f >= 3 AND m >= 3 THEN 'Campeones'
                   WHEN r >= 3 AND f >= 2             THEN 'Leales'
                   WHEN r >= 3                        THEN 'Nuevos o recientes'
                   WHEN f >= 3 AND m >= 3             THEN 'En riesgo (eran valiosos)'
                   ELSE 'Dormidos' END AS segmento
      FROM puntajes
)
SELECT segmento, COUNT(*) AS clientes, ROUND(AVG(recencia_dias)) AS recencia_prom_dias,
       ROUND(AVG(frecuencia), 1) AS pedidos_prom, ROUND(AVG(monto)) AS monto_prom
  FROM segmentos GROUP BY segmento ORDER BY clientes DESC;

\echo
\echo '##### R06. Capital inmovilizado: variantes con stock y sin ventas en 90 dias #####'
-- Tecnicas: NOT EXISTS (anti-join), agregacion sobre inventario, TOP-N.
SELECT pr.nombre AS producto, v.talla, v.color, SUM(i.stock) AS unidades,
       SUM(i.stock) * pr.precio_base AS capital_inmovilizado
  FROM variante_producto v
  JOIN producto pr ON pr.id_producto = v.id_producto
  JOIN inventario i ON i.id_variante = v.id_variante
 WHERE NOT EXISTS (SELECT 1 FROM detalle_pedido d JOIN pedido p ON p.id_pedido = d.id_pedido
                    WHERE d.id_variante = v.id_variante AND p.fecha_pedido >= now() - interval '90 days'
                      AND p.estado <> 'CANCELADO')
 GROUP BY pr.nombre, v.talla, v.color, pr.precio_base, v.id_variante
HAVING SUM(i.stock) > 0
 ORDER BY capital_inmovilizado DESC, v.id_variante
 LIMIT 15;

\echo
\echo '##### R07. Plan de reposicion: tiendas con stock bajo y bodega con disponibilidad #####'
-- Tecnicas: autounion de inventario (tienda vs bodega), LEAST, filtros por tipo de sucursal.
SELECT s.nombre AS tienda, pr.nombre AS producto, v.talla, v.color, t.stock AS stock_tienda, t.stock_minimo,
       b.stock AS stock_bodega, LEAST(t.stock_minimo * 3 - t.stock, b.stock) AS unidades_sugeridas
  FROM inventario t
  JOIN sucursal s ON s.id_sucursal = t.id_sucursal AND s.tipo = 'FISICA'
  JOIN inventario b ON b.id_variante = t.id_variante
  JOIN sucursal sb ON sb.id_sucursal = b.id_sucursal AND sb.tipo = 'ONLINE'
  JOIN variante_producto v ON v.id_variante = t.id_variante
  JOIN producto pr ON pr.id_producto = v.id_producto
 WHERE t.stock <= t.stock_minimo AND b.stock >= 20
 ORDER BY t.stock, s.nombre, pr.nombre, v.talla
 LIMIT 15;

\echo
\echo '##### R08a. Tasa de devolucion por categoria #####'
-- Regla 1: ventas y devoluciones se agregan por separado (una linea puede tener varias devoluciones).
WITH vendidas AS (
    SELECT pr.id_categoria, SUM(d.cantidad) AS unidades
      FROM detalle_pedido d JOIN pedido p ON p.id_pedido = d.id_pedido
      JOIN variante_producto v ON v.id_variante = d.id_variante JOIN producto pr ON pr.id_producto = v.id_producto
     WHERE p.estado = 'ENTREGADO' GROUP BY pr.id_categoria
), devueltas AS (
    SELECT pr.id_categoria, SUM(dv.cantidad) AS unidades
      FROM devolucion dv JOIN detalle_pedido d ON d.id_pedido = dv.id_pedido AND d.num_linea = dv.num_linea
      JOIN variante_producto v ON v.id_variante = d.id_variante JOIN producto pr ON pr.id_producto = v.id_producto
     GROUP BY pr.id_categoria
)
SELECT c.nombre AS categoria, ve.unidades AS vendidas, COALESCE(de.unidades, 0) AS devueltas,
       ROUND(100.0 * COALESCE(de.unidades, 0) / ve.unidades, 2) AS tasa_devolucion_pct
  FROM vendidas ve JOIN categoria c ON c.id_categoria = ve.id_categoria
  LEFT JOIN devueltas de ON de.id_categoria = ve.id_categoria
 ORDER BY tasa_devolucion_pct DESC, c.nombre;

\echo
\echo '##### R08b. Devoluciones por motivo y canal con subtotales (ROLLUP) #####'
SELECT COALESCE(p.canal, 'TODOS') AS canal, COALESCE(dv.motivo, 'TODOS') AS motivo,
       COUNT(*) AS devoluciones, SUM(dv.monto_reembolsado) AS reembolsado
  FROM devolucion dv JOIN pedido p ON p.id_pedido = dv.id_pedido
 GROUP BY ROLLUP (p.canal, dv.motivo)
 ORDER BY p.canal NULLS LAST, dv.motivo NULLS LAST;

\echo
\echo '##### R09. Comparativo mensual TIENDA vs ONLINE (tabla cruzada con FILTER) #####'
SELECT to_char(date_trunc('month', p.fecha_pedido), 'YYYY-MM') AS mes,
       COUNT(DISTINCT p.id_pedido) FILTER (WHERE p.canal = 'TIENDA') AS pedidos_tienda,
       COUNT(DISTINCT p.id_pedido) FILTER (WHERE p.canal = 'ONLINE') AS pedidos_online,
       SUM(d.subtotal_linea) FILTER (WHERE p.canal = 'TIENDA') AS venta_tienda,
       SUM(d.subtotal_linea) FILTER (WHERE p.canal = 'ONLINE') AS venta_online,
       ROUND(100.0 * SUM(d.subtotal_linea) FILTER (WHERE p.canal = 'ONLINE') / SUM(d.subtotal_linea), 1) AS pct_online
  FROM pedido p JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
 WHERE p.estado = 'ENTREGADO'
 GROUP BY date_trunc('month', p.fecha_pedido)
 ORDER BY 1;

\echo
\echo '##### R10. Efecto de las promociones por mes #####'
-- Lineas vendidas con descuento vs sin descuento y monto total regalado.
SELECT to_char(date_trunc('month', p.fecha_pedido), 'YYYY-MM') AS mes,
       SUM(d.cantidad) FILTER (WHERE d.descuento_unitario > 0) AS unidades_con_descuento,
       SUM(d.cantidad) FILTER (WHERE d.descuento_unitario = 0) AS unidades_sin_descuento,
       SUM(d.cantidad * d.descuento_unitario) AS descuento_otorgado,
       ROUND(100.0 * SUM(d.cantidad * d.descuento_unitario) / SUM(d.cantidad * d.precio_unitario), 2) AS descuento_sobre_bruto_pct
  FROM pedido p JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
 WHERE p.estado = 'ENTREGADO'
 GROUP BY date_trunc('month', p.fecha_pedido)
 ORDER BY 1;

\echo
\echo '##### R11. Ticket promedio y mediana por canal y nivel de fidelizacion #####'
-- Tecnicas: percentile_cont (mediana), AVG con agrupacion por dos dimensiones.
SELECT p.canal, f.nivel, COUNT(*) AS pedidos, ROUND(AVG(p.total)) AS ticket_promedio,
       ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY p.total)::numeric) AS ticket_mediana
  FROM pedido p JOIN perfil_fidelizacion f ON f.id_cliente = p.id_cliente
 WHERE p.estado = 'ENTREGADO'
 GROUP BY p.canal, f.nivel
 ORDER BY p.canal, f.nivel;

\echo
\echo '##### R12. Top 3 pedidos de mayor valor por cliente, con numero de devoluciones #####'
-- Reporte tipo quiz. Defectos que se evitan: (a) filtrar la tabla opcional en WHERE elimina los
-- pedidos sin devoluciones; (b) unir devolucion solo por id_pedido mezcla lineas; (c) unir antes de
-- sumar multiplica el valor; (d) RANK puede devolver mas de 3 filas con empates -> ROW_NUMBER.
WITH valor AS (
    SELECT p.id_cliente, p.id_pedido, p.fecha_pedido, SUM(d.subtotal_linea) AS valor_pedido
      FROM pedido p JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
     WHERE p.estado = 'ENTREGADO' AND p.fecha_pedido >= DATE '2026-01-01' AND p.fecha_pedido < DATE '2027-01-01'
     GROUP BY p.id_cliente, p.id_pedido, p.fecha_pedido
), devs AS (
    SELECT id_pedido, COUNT(*) AS num_devoluciones FROM devolucion WHERE motivo <> 'ERROR_ENVIO' GROUP BY id_pedido
), ranking AS (
    SELECT v.*, COALESCE(dv.num_devoluciones, 0) AS num_devoluciones,
           ROW_NUMBER() OVER (PARTITION BY v.id_cliente ORDER BY v.valor_pedido DESC, v.id_pedido) AS puesto
      FROM valor v LEFT JOIN devs dv ON dv.id_pedido = v.id_pedido
)
SELECT c.nombres || ' ' || c.apellidos AS cliente, r.puesto, r.id_pedido, r.fecha_pedido::date AS fecha,
       r.valor_pedido, r.num_devoluciones
  FROM ranking r JOIN cliente c ON c.id_cliente = r.id_cliente
 WHERE r.puesto <= 3 AND r.id_cliente <= 4
 ORDER BY r.id_cliente, r.puesto;

\echo
\echo '##### R13. Mapa de calor: pedidos por dia de la semana y franja horaria #####'
SELECT (ARRAY['Lun','Mar','Mie','Jue','Vie','Sab','Dom'])[EXTRACT(isodow FROM p.fecha_pedido)::int] AS dia,
       COUNT(*) FILTER (WHERE EXTRACT(hour FROM p.fecha_pedido) BETWEEN 9  AND 12) AS manana,
       COUNT(*) FILTER (WHERE EXTRACT(hour FROM p.fecha_pedido) BETWEEN 13 AND 16) AS tarde,
       COUNT(*) FILTER (WHERE EXTRACT(hour FROM p.fecha_pedido) BETWEEN 17 AND 21) AS noche
  FROM pedido p WHERE p.estado <> 'CANCELADO'
 GROUP BY EXTRACT(isodow FROM p.fecha_pedido)
 ORDER BY EXTRACT(isodow FROM p.fecha_pedido);

\echo
\echo '##### R14. Clientes valiosos en riesgo de fuga (PLATA/ORO sin compras en 120 dias) #####'
SELECT c.id_cliente, c.nombres || ' ' || c.apellidos AS cliente, f.nivel, f.puntos,
       (SELECT MAX(p.fecha_pedido)::date FROM pedido p WHERE p.id_cliente = c.id_cliente AND p.estado = 'ENTREGADO') AS ultima_compra
  FROM cliente c JOIN perfil_fidelizacion f ON f.id_cliente = c.id_cliente
 WHERE f.nivel IN ('PLATA', 'ORO')
   AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.id_cliente = c.id_cliente
                      AND p.fecha_pedido >= now() - interval '120 days' AND p.estado <> 'CANCELADO')
 ORDER BY f.puntos DESC, c.id_cliente
 LIMIT 10;

\echo
\echo '##### R15. Conciliacion de inventario: stock vs suma del kardex (debe devolver 0 filas) #####'
-- Control de integridad: cada unidad de inventario debe poder explicarse con movimientos.
SELECT i.id_sucursal, i.id_variante, i.stock, COALESCE(m.suma, 0) AS suma_kardex
  FROM inventario i
  LEFT JOIN (SELECT id_sucursal, id_variante, SUM(cantidad) AS suma
               FROM movimiento_inventario GROUP BY id_sucursal, id_variante) m
         ON m.id_sucursal = i.id_sucursal AND m.id_variante = i.id_variante
 WHERE i.stock <> COALESCE(m.suma, 0);

\echo
\echo '##### R16. Verificacion cruzada: el total del pedido coincide con la suma de sus lineas (debe devolver 0 filas) #####'
SELECT p.id_pedido, p.total, fn_total_pedido(p.id_pedido) AS recalculado
  FROM pedido p WHERE p.total IS DISTINCT FROM fn_total_pedido(p.id_pedido);
