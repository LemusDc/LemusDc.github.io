/*
Autor: Diego Rodriguez Lemus
Fecha: 21/09/2026
Descripcion: atributos de tipo %TYPE y %ROWTYPE
*/
SET SERVEROUTPUT ON;

-- %TYPE: la variable hereda el tipo de una columna
DECLARE
    vvprimernombre      hr.employees.first_name%TYPE;
    vvapellido          hr.employees.last_name%TYPE;
    vnsalario           hr.employees.salary%TYPE;
    vdfechacontratacion hr.employees.hire_date%TYPE;
BEGIN
    SELECT first_name, last_name, salary, hire_date
    INTO   vvprimernombre, vvapellido, vnsalario, vdfechacontratacion
    FROM   hr.employees
    WHERE  employee_id = 100;

    dbms_output.put_line('Los datos del empleado son: nombre: ' || vvprimernombre
        || ', Apellido: ' || vvapellido
        || ', su salario es: ' || vnsalario
        || ' y su fecha de contratacion es: ' || to_char(vdfechacontratacion, 'DD/MM/YYYY'));
END;
/

-- %ROWTYPE: la variable es una fila completa
DECLARE
    vtempleado hr.employees%ROWTYPE;
BEGIN
    SELECT * INTO vtempleado
    FROM   hr.employees
    WHERE  employee_id = 100;

    dbms_output.put_line('Los datos del empleado son: nombre: ' || vtempleado.first_name
        || ', Apellido: ' || vtempleado.last_name
        || ', su salario es: ' || vtempleado.salary
        || ' y su fecha de contratacion es: ' || to_char(vtempleado.hire_date, 'DD/MM/YYYY'));
END;
/
