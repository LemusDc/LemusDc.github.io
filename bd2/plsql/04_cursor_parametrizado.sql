/*
Autor: Diego Rodriguez Lemus & Julian Gacha
Fecha: 30/09/2026
Descripcion: cursor explicito con parametro numerico (codigo del dpto)
que muestra nombre del empleado, nombre del manager, salario y
salario + comision, usando LOOP.
*/
SET SERVEROUTPUT ON;

DECLARE
    CURSOR cur_dato (param_departamento NUMBER) IS
        SELECT e.first_name                           AS nombre,
               m.first_name                           AS manager,
               e.salary                               AS salario,
               nvl(e.commission_pct, 0) + e.salary    AS salario_comisiones
               -- nota: commission_pct es un porcentaje; lo correcto seria
               -- e.salary * (1 + nvl(e.commission_pct, 0))
        FROM   hr.employees e
               LEFT JOIN hr.employees m ON e.manager_id = m.employee_id
        WHERE  e.department_id = param_departamento;

    var_nombre             hr.employees.first_name%TYPE;
    var_manager            hr.employees.first_name%TYPE;
    var_salario            hr.employees.salary%TYPE;
    var_salario_comisiones NUMBER;
BEGIN
    OPEN cur_dato(10);               -- ejecuta la consulta
    LOOP
        FETCH cur_dato INTO var_nombre, var_manager, var_salario, var_salario_comisiones;
        EXIT WHEN cur_dato%NOTFOUND; -- fin del cursor

        dbms_output.put_line('Empleado: ' || var_nombre
            || ' | Manager: ' || nvl(var_manager, 'Sin manager')
            || ' | Salario: ' || var_salario
            || ' | Salario + comision: ' || var_salario_comisiones);
    END LOOP;
    CLOSE cur_dato;                  -- los cursores explicitos deben cerrarse
END;
/
