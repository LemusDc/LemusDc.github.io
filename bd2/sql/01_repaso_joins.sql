/*
Autor: Diego Rodriguez Lemus
Clase 2 (05/08) - Repaso SQL con el esquema HR
*/

-- Ejercicio 1: empleados del continente Europa (nombre, salario, pais, continente)
SELECT
    concat(e.first_name, e.last_name) AS nombre, -- mejora: e.first_name || ' ' || e.last_name
    e.salary                          AS salario,
    c.country_name                    AS pais,
    r.region_name                     AS continente
FROM
         hr.employees e
    INNER JOIN hr.departments d ON d.department_id = e.department_id
    INNER JOIN hr.locations   l ON l.location_id   = d.location_id
    INNER JOIN hr.countries   c ON c.country_id    = l.country_id
    INNER JOIN hr.regions     r ON r.region_id     = c.region_id
WHERE
    r.region_name = 'Europe';

-- Ejercicio 2: nombres con la letra 'a' en la segunda posicion
SELECT e.first_name AS nombre
FROM   hr.employees e
WHERE  e.first_name LIKE '_a%';

-- Ejercicio 3: cargos que ha tenido cada empleado (historial)
SELECT
    e.first_name AS nombre,
    e.last_name  AS apellido,
    h.start_date AS fecha_inicio,
    j.job_title  AS cargo
FROM
         hr.employees   e
    INNER JOIN hr.job_history h ON e.employee_id = h.employee_id
    INNER JOIN hr.jobs        j ON h.job_id      = j.job_id;
