#!/usr/bin/env bash
# Pruebas de concurrencia sobre la base indicada en PGDATABASE (por defecto tienda_ropa_pruebas).
# 1) No sobreventa: 10 sesiones simultaneas compran la misma prenda con solo 3 unidades.
# 2) Sin deadlocks: transferencias cruzadas A->B y B->A ejecutadas en paralelo.
set -uo pipefail
export PGCLIENTENCODING=UTF8
DB="${PGDATABASE:-tienda_ropa_pruebas}"
Q="${PSQL_SUPER:-psql} -X -At -d $DB"
TMP="$(mktemp -d)"

echo "=== Prueba 1: 10 compradores simultaneos, 3 unidades en stock ==="
VAR=$($Q -c "SELECT id_variante FROM tienda.variante_producto ORDER BY id_variante LIMIT 1 OFFSET 100")
EMP=$($Q -c "SELECT id_empleado FROM tienda.empleado WHERE id_sucursal=1 AND cargo='VENDEDOR' ORDER BY 1 LIMIT 1")
$Q -c "UPDATE tienda.inventario SET stock=3 WHERE id_sucursal=1 AND id_variante=$VAR" > /dev/null
for i in $(seq 1 10); do
  ( $Q -c "CALL tienda.sp_crear_pedido($i, 1, $EMP, 'TIENDA', 'VENTA_MOSTRADOR', NULL, '[{\"id_variante\":$VAR,\"cantidad\":1}]'::jsonb, 'EFECTIVO', NULL, NULL, NULL)" > "$TMP/c$i.txt" 2>&1 ) &
done
wait
EXITOS=$(cat "$TMP"/c*.txt | grep -c '^0|')
SIN_STOCK=$(cat "$TMP"/c*.txt | grep -c '^2|')
STOCK=$($Q -c "SELECT stock FROM tienda.inventario WHERE id_sucursal=1 AND id_variante=$VAR")
echo "Compras exitosas (codigo 0): $EXITOS (esperado 3)"
echo "Rechazadas por stock insuficiente (codigo 2): $SIN_STOCK (esperado 7)"
echo "Stock final: $STOCK (esperado 0, nunca negativo)"
[ "$EXITOS" = 3 ] && [ "$SIN_STOCK" = 7 ] && [ "$STOCK" = 0 ] && echo "RESULTADO: OK" || echo "RESULTADO: FALLO"

echo
echo "=== Prueba 2: 40 transferencias cruzadas en paralelo (sucursales 1 y 2) ==="
$Q -c "UPDATE tienda.inventario SET stock=100 WHERE id_variante=$VAR AND id_sucursal IN (1,2)" > /dev/null
ANTES=$($Q -c "SELECT sum(stock) FROM tienda.inventario WHERE id_variante=$VAR AND id_sucursal IN (1,2)")
for i in $(seq 1 20); do
  ( $Q -c "CALL tienda.sp_transferir_stock(1, 2, $VAR, 1, NULL, NULL)" > "$TMP/t1_$i.txt" 2>&1 ) &
  ( $Q -c "CALL tienda.sp_transferir_stock(2, 1, $VAR, 1, NULL, NULL)" > "$TMP/t2_$i.txt" 2>&1 ) &
done
wait
OK=$(cat "$TMP"/t*.txt | grep -c '^0|')
DEAD=$(cat "$TMP"/t*.txt | grep -c '^6|')
DESPUES=$($Q -c "SELECT sum(stock) FROM tienda.inventario WHERE id_variante=$VAR AND id_sucursal IN (1,2)")
echo "Transferencias exitosas: $OK (esperado 40)  |  Conflictos/deadlock (codigo 6): $DEAD (esperado 0)"
echo "Unidades antes: $ANTES  despues: $DESPUES (deben ser iguales: no se crean ni pierden unidades)"
[ "$OK" = 40 ] && [ "$DEAD" = 0 ] && [ "$ANTES" = "$DESPUES" ] && echo "RESULTADO: OK" || echo "RESULTADO: FALLO"
rm -rf "$TMP"
