/*
Clase 3 (10/08) - SQL Developer, permisos y vistas
Una vista es un SELECT almacenado.
*/

-- Tabla de prueba para validar permisos de creacion
CREATE TABLE prueba (
    id   INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- Validacion de acceso al esquema HR
SELECT * FROM hr.jobs;
SELECT * FROM hr.employees;

-- Vista
CREATE OR REPLACE VIEW vw_empleados AS
    SELECT *
    FROM   hr.employees
    WHERE  department_id IN (80, 90, 100)
      AND  salary >= 5000;

SELECT * FROM vw_empleados;
