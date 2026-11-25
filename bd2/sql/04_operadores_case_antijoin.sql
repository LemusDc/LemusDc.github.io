/*
Clase (19/08) - Operadores, CASE y ANTIJOIN
*/

-- Operadores:  =  >=  <=  >  <  != <>
-- WHERE salary BETWEEN 2000 AND 5000;
-- WHERE department_id IN (80, 90, 15);
-- WHERE department_id = 80 OR department_id = 90 OR department_id = 15;
-- WHERE first_name LIKE 'And%';
-- WHERE commission_pct IS NULL;

-- CASE
SELECT CASE
           WHEN NULL IS NULL     THEN 'TRUE'
           WHEN NULL IS NOT NULL THEN 'FALSE'
           ELSE 'NI UNO NI EL OTRO'
       END AS resultado
FROM hr.employees;

-- ANTIJOIN: departamentos que no tienen empleados
SELECT d.department_name
FROM   hr.departments d
       LEFT JOIN hr.employees e ON e.department_id = d.department_id
WHERE  e.employee_id IS NULL;

-- Tambien vistos: DECODE y COALESCE
