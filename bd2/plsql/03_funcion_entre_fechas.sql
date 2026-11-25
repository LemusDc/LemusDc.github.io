/*
Autor: Diego Rodriguez Lemus
Fecha: 23/09/2026
Descripcion: funcion que devuelve los dias entre dos fechas (siempre positivo)
*/
CREATE OR REPLACE FUNCTION fnEntreFechas (
    paramFecha1 IN DATE,
    paramFecha2 IN DATE
) RETURN NUMBER
IS
    vnDias NUMBER(38, 2);
BEGIN
    vnDias := paramFecha1 - paramFecha2;
    IF vnDias < 0 THEN
        vnDias := paramFecha2 - paramFecha1;
    END IF;
    RETURN vnDias;
END fnEntreFechas;
/

SELECT fnEntreFechas(
    TO_DATE('23/09/2026', 'DD/MM/YYYY'),
    TO_DATE('29/09/2026', 'DD/MM/YYYY')
) FROM dual;
