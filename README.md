# Portafolio · Bases de Datos 2

Portafolio académico de **Diego Rodríguez Lemus** (Universidad El Bosque, 2026-2).
Sitio: https://lemusdc.github.io

Hecho con [Astro](https://astro.build), React, Tailwind y Framer Motion.

## Contenido

| Carpeta | Qué hay |
| --- | --- |
| `bd2/sql` | SQL avanzado: JOINs, vistas, CASE, antijoin (esquema HR de Oracle) |
| `bd2/plsql` | PL/SQL: bloques anónimos, %TYPE/%ROWTYPE, funciones, cursores |
| `bd2/nosql` | Taller MQL en MongoDB: consultas, agregaciones, índices (ESR) y modelado |
| `bd2/proyecto` | Proyecto integrador *Tienda de Ropa* (PostgreSQL + MongoDB + Node.js), con código y documentación |

Los scripts (`.sql`, `.js`, `.md`) también se muestran en la página (sección *Cuaderno de clase*).

## Editar el contenido

Todo el contenido del curso vive en `src/lib/course.ts` (actividades, apuntes, proyecto)
y los datos personales en `src/lib/data.ts`.

## Correr en local

```bash
bun install   # o npm install
bun run dev   # o npm run dev
```

## Despliegue

Cada push a `main` despliega a GitHub Pages con `.github/workflows/deploy.yml`
(en el repo: Settings → Pages → Source: **GitHub Actions**).
