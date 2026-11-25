/*
Clase 4 (12/08) - Tipos de JOIN
*/

-- 1. Empleados sin departamento (NULL)
SELECT COUNT(1)
FROM   hr.employees
WHERE  department_id IS NULL;

-- 2. Todos los empleados, incluso sin dpto (LEFT JOIN + NVL)
SELECT
    e.employee_id AS id,
    e.first_name  AS nombre,
    e.last_name   AS apellido,
    nvl(d.department_name, 'Este empleado no tiene dpto') AS dpto
FROM
    hr.employees e
    LEFT JOIN hr.departments d ON d.department_id = e.department_id;

-- 3. Todos los empleados y todos los dptos (FULL OUTER JOIN)
SELECT
    e.employee_id     AS id,
    e.first_name      AS nombre,
    e.last_name       AS apellido,
    d.department_name AS dpto
FROM
    hr.departments d
    FULL OUTER JOIN hr.employees e ON d.department_id = e.department_id;

-- 4. Empleados y su jefe (SELF JOIN)
SELECT
    e.employee_id                    AS id,
    e.first_name || ' ' || e.last_name AS empleado,
    m.first_name || ' ' || m.last_name AS jefe
FROM
    hr.employees e
    LEFT JOIN hr.employees m ON e.manager_id = m.employee_id;

-- 5. Empleados x departamentos (CROSS JOIN)
SELECT e.first_name AS empleado, d.department_name AS depto
FROM   hr.employees e
       CROSS JOIN hr.departments d;

-- 6. NATURAL JOIN
SELECT e.employee_id AS id, e.first_name AS empleado, d.department_name AS depto
FROM   hr.employees e
       NATURAL JOIN hr.departments d;

-- 7. Consulta completa que trae los 107 empleados (todo con LEFT JOIN)
SELECT
    e.employee_id,
    e.first_name,
    e.last_name,
    d.department_name,
    j.job_title,
    m.first_name || ' ' || m.last_name manager,
    l.city,
    c.country_name
FROM
         hr.employees   e
    LEFT JOIN hr.departments d ON e.department_id = d.department_id
    LEFT JOIN hr.jobs        j ON e.job_id        = j.job_id
    LEFT JOIN hr.employees   m ON e.manager_id    = m.employee_id
    LEFT JOIN hr.locations   l ON d.location_id   = l.location_id
    LEFT JOIN hr.countries   c ON l.country_id    = c.country_id;

-- 8. JOIN con USING
SELECT
    e.employee_id AS id, e.first_name AS nombre,
    e.last_name AS apellido, d.department_name AS dpto
FROM
    hr.departments d
    JOIN hr.employees e USING (department_id);
