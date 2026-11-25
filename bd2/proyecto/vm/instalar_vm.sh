#!/usr/bin/env bash
# Instalación del stack en Ubuntu Server 24.04 LTS (kernel 6.8).
# Se ejecuta desde la carpeta del proyecto ya descomprimida, con un usuario con sudo:
#     cd ~/tienda-ropa && bash vm/instalar_vm.sh
# ADVERTENCIA: verifique el repositorio de MongoDB contra la documentación oficial si cambia la versión.
set -euo pipefail
DESTINO="$(cd "$(dirname "$0")/.." && pwd)"
KERNEL="$(uname -r)"
echo "Proyecto en: $DESTINO  |  Kernel: $KERNEL"

# MongoDB 8 no arranca con kernel >= 6.19 (SERVER-121912). Ubuntu 24.04 trae 6.8.
MAYOR="${KERNEL%%.*}"; RESTO="${KERNEL#*.}"; MENOR="${RESTO%%.*}"
if [ "$MAYOR" -gt 6 ] || { [ "$MAYOR" -eq 6 ] && [ "$MENOR" -ge 19 ]; }; then
  echo "AVISO: kernel $KERNEL; MongoDB 8 no arranca en kernel 6.19 o superior. Use Ubuntu Server 24.04." >&2
  exit 1
fi

echo "== Paquetes base y cortafuegos"
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y unzip curl gnupg ufw postgresql postgresql-contrib
sudo ufw allow OpenSSH && sudo ufw allow 3000/tcp && sudo ufw --force enable

echo "== MongoDB 8 (repositorio oficial para Ubuntu 24.04 'noble')"
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl enable --now mongod
sleep 3; systemctl is-active --quiet mongod || { echo "mongod no arrancó: revise 'sudo journalctl -u mongod -n 30'" >&2; exit 1; }

echo "== Node.js 22 y mongosh"
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
command -v mongosh >/dev/null || sudo npm install -g mongosh   # mongodb-org ya incluye mongosh

echo "== Base relacional, dependencias y carga de MongoDB"
cd "$DESTINO"
chmod +x scripts/*.sh
sudo systemctl enable --now postgresql
PSQL_SUPER="sudo -u postgres psql" PGHOST=127.0.0.1 scripts/instalar_bd.sh
(cd app && npm ci --omit=dev)
PGHOST=127.0.0.1 MONGO_URL=mongodb://127.0.0.1:27017 scripts/instalar_mongo.sh

echo "== Servicio systemd (cambie antes las claves en /etc/tienda-ropa.env)"
sudo cp app/.env.example /etc/tienda-ropa.env && sudo chmod 600 /etc/tienda-ropa.env
sed "s#User=tienda#User=$USER#; s#/home/tienda/tienda-ropa#$DESTINO#" vm/tienda-ropa.service | sudo tee /etc/systemd/system/tienda-ropa.service >/dev/null
sudo systemctl daemon-reload && sudo systemctl enable --now tienda-ropa
sleep 3
IP="$(hostname -I | awk '{print $1}')"
echo "Listo. Abra http://$IP:3000  (usuario admin / clave de demostración; cámbiela)."
echo "Siguiente paso: cambie las contraseñas de app_tienda y app_admin (documento 07, sección 6.2) y reinicie el servicio."
