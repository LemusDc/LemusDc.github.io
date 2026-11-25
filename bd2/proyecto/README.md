# Tienda de Ropa — Proyecto Final de Bases de Datos 2

Universidad El Bosque · Ingeniería de Sistemas · Docente: Christian Felipe Duarte
Integrantes: Juan Diego Mateus y Diego Lemus

Sistema de información para una tienda de ropa con venta física y en línea. **PostgreSQL 16** guarda lo transaccional y ejecuta la lógica de negocio (procedimientos, funciones, triggers, excepciones y transacciones); **MongoDB 8** guarda lo flexible o temporal (ficha técnica, reseñas, imágenes en GridFS, carritos y eventos); una aplicación **Node.js / Express** los integra; todo se despliega en **Ubuntu Server 24.04 LTS**.

## Estructura

```
db/postgres/    Scripts SQL numerados (00 a 11)
db/mongo/       Modelo, CRUD, consultas complejas y agregaciones (mongosh)
app/            Aplicación web (src/ servidor, public/ interfaz, seed/ carga de MongoDB)
scripts/        Instaladores, pruebas
vm/             Script de instalación y servicio systemd para la máquina virtual
```

## Scripts de PostgreSQL (`db/postgres`)

| Archivo | Contenido |
|---|---|
| `00_crear_base_datos.sql` | Roles del cluster y base de datos (se ejecuta como superusuario) |
| `01_creacion.sql` | 21 tablas, restricciones e índices |
| `02_funciones.sql` | Funciones de negocio |
| `03_triggers.sql` | 11 triggers |
| `04_procedimientos.sql` | 12 procedimientos almacenados |
| `05_insercion.sql` | Datos de prueba (600 clientes, 46 productos, 3.200 pedidos...) |
| `06_vistas.sql` | Vistas de lectura |
| `07_seguridad.sql` | Permisos mínimos y seguridad por fila |
| `08_comentarios.sql` | Diccionario de datos dentro de la base (`COMMENT ON`) |
| `09_pruebas.sql` | Pruebas funcionales (éxito y error) |
| `10_reportes.sql` | 16 reportes gerenciales |
| `11_optimizacion.sql` | Planes con y sin índice |

## Instalación rápida (entorno de desarrollo)

Requisitos: PostgreSQL 16, MongoDB 8, `mongosh`, Node.js 22.

```bash
# 1. Base de datos relacional (destruye y recrea tienda_ropa)
PGHOST=127.0.0.1 PGUSER=postgres scripts/instalar_bd.sh
#    En Ubuntu con autenticación "peer": PSQL_SUPER="sudo -u postgres psql" PGHOST=127.0.0.1 scripts/instalar_bd.sh

# 2. Aplicación y base documental
cd app && npm ci && cd ..
PGHOST=127.0.0.1 MONGO_URL=mongodb://127.0.0.1:27017 scripts/instalar_mongo.sh

# 3. Ejecutar
cd app && cp .env.example .env && npm start        # http://localhost:3000
```

Para dejar todo como al inicio: detener la aplicación y ejecutar `scripts/reiniciar_demo.sh`.

**Usuarios de demostración** (cámbielos en un uso real): `admin / Admin2026*`, `vendedor1 / Vende2026*`, `analista / Analista2026*`. Roles de base de datos: `app_tienda / App2026*`, `app_admin / AppAdmin2026*`, `tienda_owner / Owner2026*`.

## Pruebas

```bash
scripts/probar_bd.sh                  # funcionales + concurrencia sobre una copia de la base
PGDATABASE=tienda_ropa_pruebas scripts/prueba_concurrencia.sh   # (lo invoca probar_bd.sh)
mongosh tienda_ropa_nosql --file db/mongo/02_crud.js            # y 03_consultas_complejas.js, 04_agregaciones.js
NODE_PATH=<ruta a playwright> BASE_URL=http://localhost:3000 node scripts/e2e_ui.js   # interfaz con un navegador real
```

## Documentos (`docs/`, en PDF)

01 Propuesta y supuestos · 02 Modelado de datos · 03 Diccionario de datos · 04 Reportes SQL · 05 Gestión del proyecto · 06 Selección de SO y RDBMS · 07 Guía de despliegue en la VM · 08 Modelo documental MongoDB · 09 Arquitectura y decisiones técnicas · 10 Informe ejecutivo.

## Qué está verificado y qué no

- **Verificado** en un entorno Linux de desarrollo con PostgreSQL 16 y MongoDB 8: todos los scripts SQL y de MongoDB, la aplicación, las pruebas funcionales, de concurrencia y de interfaz (resultados descritos en los documentos).
- **No verificado en una VM propia:** la instalación en Ubuntu Server (guía y `vm/instalar_vm.sh`). El equipo debe crear la máquina virtual, seguir la guía y adjuntar las capturas (documento 07, sección 9).
- Los modelos en Crow's Foot están generados con Graphviz desde el catálogo; para la entrega con la herramienta exigida (Data Modeler o Workbench) siga la sección 9 del documento 02.
- Pagos simulados, sesiones en memoria, instancia única de cada motor (ver limitaciones en el documento 09).
