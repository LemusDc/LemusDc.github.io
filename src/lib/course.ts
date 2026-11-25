import sqlRepaso from "../../bd2/sql/01_repaso_joins.sql?raw";
import sqlVistas from "../../bd2/sql/02_vistas.sql?raw";
import sqlJoins from "../../bd2/sql/03_joins.sql?raw";
import sqlOperadores from "../../bd2/sql/04_operadores_case_antijoin.sql?raw";
import plBloques from "../../bd2/plsql/01_bloques_anonimos.sql?raw";
import plTypes from "../../bd2/plsql/02_type_rowtype.sql?raw";
import plFuncion from "../../bd2/plsql/03_funcion_entre_fechas.sql?raw";
import plCursor from "../../bd2/plsql/04_cursor_parametrizado.sql?raw";

import mqlFind from "../../bd2/nosql/01_consultas_find.js?raw";
import mqlAgg from "../../bd2/nosql/02_agregacion.js?raw";
import mqlIdx from "../../bd2/nosql/03_escritura_e_indices.js?raw";
import mqlModelado from "../../bd2/nosql/04_modelado_patrones.md?raw";

export const repoBase = "https://github.com/LemusDc/LemusDc.github.io";

export const course = {
  name: "Bases de Datos 2",
  period: "Agosto – Noviembre 2026",
  university: "Universidad El Bosque",
  description:
    "Curso de bases de datos avanzado: SQL avanzado y optimización, transacciones y concurrencia, programación en PL/SQL sobre Oracle, y NoSQL con MongoDB para terminar integrando todo en una arquitectura políglota. Este portafolio reúne lo visto en clase, el código que escribí y los trabajos entregados durante el semestre.",
  stack: ["Oracle", "SQL Developer", "PL/SQL", "PostgreSQL", "MongoDB", "Node.js"],
};

export type Activity = {
  name: string;
  start: string; // ISO
  end: string; // ISO
  type: string;
  kind: "portafolio" | "quiz" | "taller" | "parcial" | "proyecto";
  highlight?: boolean;
};

export const activities: Activity[] = [
  { name: "Portafolio académico digital del curso", start: "2026-08-03", end: "2026-08-16", type: "Individual", kind: "portafolio" },
  { name: "Quiz presencial 1. SQL avanzado: JOIN, subconsultas, CTE y funciones analíticas", start: "2026-08-24", end: "2026-08-24", type: "Individual – Presencial", kind: "quiz" },
  { name: "Taller aplicado 1. SQL avanzado + optimización básica de consultas", start: "2026-09-02", end: "2026-09-02", type: "Individual o en parejas", kind: "taller" },
  { name: "Quiz presencial 2. Transacciones, ACID, concurrencia y bloqueos", start: "2026-09-09", end: "2026-09-09", type: "Individual – Presencial", kind: "quiz" },
  { name: "Parcial 1. SQL avanzado + transacciones + concurrencia", start: "2026-09-16", end: "2026-09-16", type: "Individual – Presencial", kind: "parcial", highlight: true },
  { name: "Taller aplicado 2. PL/SQL: procedimientos, funciones, cursores y excepciones", start: "2026-09-30", end: "2026-09-30", type: "Individual o en parejas", kind: "taller" },
  { name: "Taller aplicado 3. PL/SQL avanzado: paquetes, triggers y auditoría", start: "2026-10-19", end: "2026-10-19", type: "Individual o en parejas", kind: "taller" },
  { name: "Parcial 2. PL/SQL aplicado: lectura, desarrollo, depuración y solución de problemas", start: "2026-10-21", end: "2026-10-21", type: "Individual – Presencial", kind: "parcial", highlight: true },
  { name: "Laboratorio aplicado. MongoDB: documentos, consultas, agregaciones e índices", start: "2026-11-04", end: "2026-11-04", type: "Individual o en parejas", kind: "taller" },
  { name: "Taller aplicado 4. Arquitectura políglota + integración SQL/NoSQL + ETL/ELT", start: "2026-11-09", end: "2026-11-09", type: "Individual o en parejas", kind: "taller" },
  { name: "Proyecto integrador final. Solución SQL + NoSQL + integración", start: "2026-11-11", end: "2026-11-11", type: "Grupal", kind: "proyecto", highlight: true },
  { name: "Sustentación / defensa técnica del proyecto", start: "2026-11-11", end: "2026-11-25", type: "Grupal con componente individual", kind: "proyecto", highlight: true },
];

export const learned = [
  {
    emoji: "🧩",
    title: "SQL avanzado",
    items: [
      "Todos los tipos de JOIN: INNER, LEFT, FULL, CROSS, NATURAL, USING, self join y antijoin",
      "Vistas, CASE, NVL / DECODE / COALESCE y manejo de NULL",
      "Clasificación de sentencias DDL, DML, DCL y TCL",
    ],
  },
  {
    emoji: "⚙️",
    title: "Índices y transacciones",
    items: [
      "Tipos de índice: clúster, no clúster, B-Tree, hash, único, compuesto, full-text y espacial",
      "Propiedades ACID y diferencia de commit entre DML y DDL",
      "Concurrencia y bloqueos",
    ],
  },
  {
    emoji: "🧠",
    title: "PL/SQL",
    items: [
      "Bloques anónimos, tipos de datos, %TYPE y %ROWTYPE",
      "Estructuras de control y funciones almacenadas",
      "Cursores implícitos, explícitos y parametrizados, con sus atributos",
    ],
  },
  {
    emoji: "🍃",
    title: "NoSQL e integración",
    items: [
      "MongoDB: documentos, consultas, agregaciones e índices",
      "Arquitectura políglota y procesos ETL/ELT",
      "Proyecto integrador SQL + NoSQL",
    ],
  },
];

export type NoteFile = { name: string; path: string; code: string };
export type NoteSession = {
  date: string;
  title: string;
  points: string[];
  files?: NoteFile[];
  images?: { src: string; caption: string }[];
};
export type NoteBlock = {
  id: string;
  emoji: string;
  title: string;
  sessions: NoteSession[];
};

const f = (dir: string, name: string, code: string): NoteFile => ({
  name,
  path: `bd2/${dir}/${name}`,
  code,
});

export const noteBlocks: NoteBlock[] = [
  {
    id: "sql",
    emoji: "🧩",
    title: "SQL avanzado",
    sessions: [
      {
        date: "5 Ago",
        title: "Repaso de SQL",
        points: [
          "DDL (CREATE, ALTER, DROP, TRUNCATE): define la estructura de tablas y objetos.",
          "DML (SELECT, INSERT, UPDATE, DELETE): consulta y modifica los datos.",
          "DCL (GRANT, REVOKE): permisos de usuarios. TCL (COMMIT, ROLLBACK, SAVEPOINT): control de transacciones.",
          "ACID: Atomicity, Consistency, Isolation, Durability.",
          "Ejercicios con el esquema HR: empleados de Europa, nombres con 'a' en la 2.ª posición e historial de cargos.",
        ],
        files: [f("sql", "01_repaso_joins.sql", sqlRepaso)],
      },
      {
        date: "10 Ago",
        title: "SQL Developer y vistas",
        points: [
          "Primer ingreso a SQL Developer y verificación de permisos de creación de tablas.",
          "Diferencia entre esquema y usuario: un esquema es el usuario con sus tablas creadas.",
          "Una vista es un SELECT almacenado (CREATE OR REPLACE VIEW).",
        ],
        files: [f("sql", "02_vistas.sql", sqlVistas)],
      },
      {
        date: "12 Ago",
        title: "Tipos de JOIN",
        points: [
          "LEFT JOIN para conservar empleados sin departamento y NVL para reemplazar nulos.",
          "FULL OUTER JOIN, CROSS JOIN, NATURAL JOIN y JOIN … USING.",
          "Self join para relacionar empleado con su jefe.",
          "Ejercicio de verificación: la consulta completa debe devolver los 107 empleados, por eso todo va con LEFT JOIN.",
        ],
        files: [f("sql", "03_joins.sql", sqlJoins)],
      },
      {
        date: "19 Ago",
        title: "Operadores, CASE y antijoin",
        points: [
          "Operadores de comparación, BETWEEN, IN, LIKE e IS NULL.",
          "CASE como condicional dentro del SELECT; DECODE y COALESCE.",
          "Antijoin: LEFT JOIN + IS NULL para encontrar registros sin pareja (departamentos sin empleados).",
        ],
        files: [f("sql", "04_operadores_case_antijoin.sql", sqlOperadores)],
      },
    ],
  },
  {
    id: "indices",
    emoji: "⚙️",
    title: "Índices y transacciones",
    sessions: [
      {
        date: "31 Ago",
        title: "Índices",
        points: [
          "Un índice es una estructura independiente que acelera consultas al evitar recorrer la tabla fila por fila.",
          "Clúster (ordena físicamente los datos, solo uno por tabla) vs. no clúster (estructura aparte con punteros).",
          "B-Tree: estándar, sirve para igualdad y rangos. Hash: búsquedas exactas muy rápidas, pero no rangos.",
          "Por función lógica: clave primaria, único, compuesto, full-text y espacial.",
        ],
      },
      {
        date: "7 Sep",
        title: "DML vs. DDL y commit",
        points: [
          "DML (INSERT, UPDATE, DELETE) no hace commit automático.",
          "DDL (CREATE, ALTER, DROP, TRUNCATE) sí hace commit implícito.",
          "TRUNCATE elimina todos los registros de la tabla manteniendo su estructura.",
        ],
      },
    ],
  },
  {
    id: "plsql",
    emoji: "🧠",
    title: "PL/SQL",
    sessions: [
      {
        date: "21 Sep",
        title: "Fundamentos de PL/SQL",
        points: [
          "Estructura de un bloque: DECLARE (opcional), BEGIN … END. Un bloque sin nombre es anónimo.",
          "Unidades léxicas: delimitadores, identificadores, literales, comentarios y directivas PRAGMA.",
          "Hay tipos de datos que existen solo en PL/SQL (PLS_INTEGER, BOOLEAN) y otros solo en SQL.",
          "Convención: v (variable), c (constante), cur (cursor) + tipo: vv, vn, vd, vc.",
          "%TYPE hereda el tipo de una columna; %ROWTYPE de una fila completa.",
          "Todo bloque anónimo lleva encabezado con autor, fecha y descripción.",
        ],
        files: [
          f("plsql", "01_bloques_anonimos.sql", plBloques),
          f("plsql", "02_type_rowtype.sql", plTypes),
        ],
      },
      {
        date: "23 Sep",
        title: "Estructuras de control y funciones",
        points: [
          "IF / ELSIF / ELSE, CASE, LOOP, WHILE, FOR, EXIT y CONTINUE.",
          "Primera función almacenada: calcula los días entre dos fechas sin importar el orden.",
        ],
        files: [f("plsql", "03_funcion_entre_fechas.sql", plFuncion)],
      },
      {
        date: "30 Sep",
        title: "Cursores",
        points: [
          "Un cursor es un espacio en memoria que guarda el resultado de una consulta; todo DML en PL/SQL es un cursor implícito.",
          "Atributos: %FOUND, %NOTFOUND, %ISOPEN y %ROWCOUNT.",
          "Cursor explícito: declarar, OPEN, FETCH y CLOSE (siempre cerrarlo).",
          "Cursores parametrizados: ejercicio en pareja con empleados por departamento.",
        ],
        files: [f("plsql", "04_cursor_parametrizado.sql", plCursor)],
      },
    ],
  },
  {
    id: "nosql",
    emoji: "🍃",
    title: "NoSQL · MongoDB",
    sessions: [
      {
        date: "Nov",
        title: "Taller MQL · Consultas (find)",
        points: [
          "Base de datos de práctica: sample_mflix en MongoDB Atlas, trabajado en equipo con Daniel Nieto y Juan Diego Mateus.",
          "Filtros con $gte/$lte, $nin, $size + $all, $exists, $or y expresiones regulares.",
          "Proyecciones, sort, limit y countDocuments para el conteo total.",
        ],
        files: [f("nosql", "01_consultas_find.js", mqlFind)],
      },
      {
        date: "Nov",
        title: "Taller MQL · Agregaciones",
        points: [
          "Pipelines con $match, $unwind, $group, $project, $sort y $limit.",
          "Un segundo $match después de $group funciona como HAVING; poner el $match antes del $unwind procesa menos documentos.",
          "$lookup entre comments, movies y users, agrupando y limitando antes para que el join se ejecute pocas veces.",
          "Agrupación por década con $subtract/$mod y top de directores con $push + $slice.",
        ],
        files: [f("nosql", "02_agregacion.js", mqlAgg)],
        images: [
          { src: "/img/mql/mql-7.png", caption: "Top de directores con mejor rating" },
          { src: "/img/mql/mql-9.png", caption: "Películas más comentadas ($lookup)" },
        ],
      },
      {
        date: "Nov",
        title: "Taller MQL · Escritura, $out e índices (ESR)",
        points: [
          "$out con $switch para crear la colección peliculas_pareja y categorizar por rating.",
          "updateMany con $set/$inc y deleteMany, verificando matchedCount, modifiedCount y deletedCount.",
          "Índice compuesto siguiendo la regla ESR (Equality, Sort, Range): { genres: 1, imdb.rating: -1, year: 1 }.",
          "Con explain('executionStats') el plan pasó de COLLSCAN + SORT (21.349 documentos examinados) a IXSCAN (10 documentos examinados).",
        ],
        files: [f("nosql", "03_escritura_e_indices.js", mqlIdx)],
        images: [
          { src: "/img/mql/mql-15.png", caption: "explain() antes del índice: COLLSCAN" },
          { src: "/img/mql/mql-16.png", caption: "explain() después del índice: IXSCAN" },
        ],
      },
      {
        date: "Nov",
        title: "Taller MQL · Modelado con patrones de diseño",
        points: [
          "Tres casos: plataforma de domicilios, monitoreo de calidad del aire (IoT) y red social universitaria.",
          "Patrones aplicados: Extended Reference, Subset, Computed, Attribute, Bucket, Schema Versioning, Outlier y Polymorphic, cada uno con su justificación y qué pasaría sin él.",
          "Índices propuestos y consultas de ejemplo para cada caso.",
        ],
        files: [f("nosql", "04_modelado_patrones.md", mqlModelado)],
      },
    ],
  },
];

export const project = {
  name: "Tienda de Ropa",
  subtitle: "Proyecto integrador final · PostgreSQL + MongoDB + Node.js",
  team: "Juan Diego Mateus y Diego Lemus",
  video: "https://youtu.be/6VmBEApvuOw",
  description:
    "Sistema de información para una cadena de tiendas de ropa con venta física y en línea. PostgreSQL guarda lo transaccional y ejecuta la lógica de negocio; MongoDB guarda lo flexible (ficha técnica, reseñas, imágenes en GridFS, carritos y eventos); una aplicación Node.js/Express integra ambos y todo se despliega en Ubuntu Server 24.04 LTS.",
  stack: ["PostgreSQL 16", "MongoDB 8", "Node.js 22", "Express", "Ubuntu Server 24.04"],
  highlights: [
    { label: "tablas", value: "21" },
    { label: "triggers", value: "11" },
    { label: "procedimientos", value: "12" },
    { label: "reportes", value: "16" },
  ],
  features: [
    "Funciones, triggers, procedimientos almacenados, excepciones y transacciones en PostgreSQL",
    "Descuento de inventario atómico y prueba de concurrencia para evitar la sobreventa",
    "Seguridad con permisos mínimos y seguridad por fila",
    "Modelo documental en MongoDB con CRUD, consultas complejas y agregaciones",
    "Aplicación web que integra las dos bases de datos",
    "Optimización de consultas comparando planes con y sin índice",
  ],
  docs: [
    ["01_Propuesta_y_Supuestos.pdf", "Propuesta y supuestos"],
    ["02_Modelado_de_Datos.pdf", "Modelado de datos"],
    ["03_Diccionario_de_Datos.pdf", "Diccionario de datos"],
    ["04_Reportes_SQL.pdf", "Reportes SQL"],
    ["05_Gestion_del_Proyecto.pdf", "Gestión del proyecto"],
    ["06_Seleccion_SO_y_RDBMS.pdf", "Selección de SO y RDBMS"],
    ["07_Guia_Despliegue_VM.pdf", "Guía de despliegue en VM"],
    ["08_Modelo_Documental_MongoDB.pdf", "Modelo documental MongoDB"],
    ["09_Arquitectura_y_Decisiones_Tecnicas.pdf", "Arquitectura y decisiones técnicas"],
    ["10_Informe_Ejecutivo.pdf", "Informe ejecutivo"],
  ] as [string, string][],
};
