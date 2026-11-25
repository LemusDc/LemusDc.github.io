/*
Autor: Diego Rodriguez Lemus
Fecha: 21/09/2026
Descripcion: primeros bloques anonimos PL/SQL
*/
SET SERVEROUTPUT ON;

-- Hola mundo
BEGIN
    dbms_output.put_line('hola mundo');
END;
/

-- DECLARE + SELECT INTO
DECLARE
    fecha TIMESTAMP;
BEGIN
    SELECT sysdate INTO fecha FROM dual;
    dbms_output.put_line('la fecha es: ' || fecha);
END;
/

-- Variables con convencion de nombres (v = variable, vv = varchar, vn = numero)
DECLARE
    primerNombre    VARCHAR2(50);
    segundoNombre   VARCHAR2(50);
    primerApellido  VARCHAR2(50);
    segundoApellido VARCHAR2(50);
BEGIN
    SELECT 'Diego', 'Camilo', 'Rodriguez', 'Lemus'
    INTO   primerNombre, segundoNombre, primerApellido, segundoApellido
    FROM   dual;

    dbms_output.put_line('mi nombre es: ' || primerNombre || ' ' || segundoNombre
                         || ' ' || primerApellido || ' ' || segundoApellido);
END;
/
