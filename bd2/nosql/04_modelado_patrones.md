# Taller MQL · Parte D – Modelado con patrones de diseño


## Caso 1 – Plataforma de domicilios


**Colecciones**

restaurantes, reseñas, productos, clientes, repartidores, pedidos

**Patrones aplicados, justificación y qué pasaría sin ellos**

| **Patrón** | **Dónde se aplica** | **Justificación** | **Si NO se aplica** |
| --- | --- | --- | --- |
| Extended Reference | pedidos.cliente, pedidos.restaurante, pedidos.items | Se copian nombre y precio del plato al momento de la compra; el historial no cambia si cambia el menú y se evita $lookup. | El pedido mostraría el precio nuevo (dato histórico incorrecto) y cada consulta haría $lookup a varias colecciones. |
| Subset | restaurantes.resenasRecientes (10) + colección resenas | La pantalla solo muestra las 10 reseñas más recientes. | Embeber 50.000 reseñas acerca el documento al límite de 16 MB y cada lectura trae datos innecesarios. |
| Computed | calificacion.promedio / totalResenas; pedidos.total | El promedio se lee muchísimo más de lo que se escribe; se actualiza con $inc al crear una reseña. | Habría que calcular $avg sobre miles de reseñas en cada visita. |
| Attribute | productos.atributos [{k, v}] | Cada producto tiene atributos distintos (tamaño, picante, vegano…) y un solo índice los cubre. | Un campo por atributo: esquema disperso y un índice por cada atributo. |

**Índices propuestos**

- pedidos: { "cliente.clienteId": 1, fecha: -1 }  → pregunta (a)
- restaurantes: { ciudad: 1, "calificacion.promedio": -1 }  → pregunta (b)
- productos: { "atributos.k": 1, "atributos.v": 1 }
- resenas: { restauranteId: 1, fecha: -1 }

**Consulta (a) Pedidos de un cliente en el último mes con el total pagado**

```js
db.pedidos.find(
  { "cliente.clienteId": ObjectId("665f00000000000000000001"),
    fecha: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  { _id: 1, fecha: 1, "restaurante.nombre": 1, total: 1, estado: 1 }
).sort({ fecha: -1 });

db.pedidos.aggregate([
  { $match: { "cliente.clienteId": ObjectId("665f00000000000000000001"),
              fecha: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
  { $group: { _id: "$cliente.clienteId", numPedidos: { $sum: 1 }, totalPagado: { $sum: "$total" } } }
]);
```


**Consulta (b) Top 5 restaurantes mejor calificados de una ciudad**

```js
db.restaurantes.find(
  { ciudad: "Bogotá", "calificacion.totalResenas": { $gte: 20 } },
  { nombre: 1, "calificacion.promedio": 1, "calificacion.totalResenas": 1 }
).sort({ "calificacion.promedio": -1 }).limit(5);
```


## Caso 2 – Monitoreo de calidad del aire en Bogotá (IoT)


**Colecciones**

sensores, lecturas_hora (bucket), alertas

**Patrones aplicados, justificación y qué pasaría sin ellos**

| **Patrón** | **Dónde se aplica** | **Justificación** | **Si NO se aplica** |
| --- | --- | --- | --- |
| Bucket | lecturas_hora: 1 doc = 1 sensor × 1 hora (60 lecturas) | 280.000 lecturas/día pasan a ~4.800 documentos/día; índices mucho más pequeños. | Unos 100 millones de documentos al año, índices enormes y consultas lentas. |
| Computed | lecturas_hora.resumen (suma, conteo, max) y numAlertas | El promedio horario es suma/conteo sin recorrer las lecturas; se actualiza con $inc/$max. | El tablero tendría que hacer $unwind de millones de lecturas en cada refresco. |
| Schema Versioning | campo schemaVersion en sensores y lecturas | Conviven documentos con y sin CO₂; la aplicación lee según la versión. | Habría que migrar todo el histórico o quedarían datos inconsistentes. |

**Índices propuestos**

- lecturas_hora: { localidad: 1, hora: 1 }  → pregunta (a)
- lecturas_hora: { hora: 1, numAlertas: 1 }  → pregunta (b)
- alertas: { fecha: -1, sensorId: 1 }

**Consulta (a) Promedio horario de PM2.5 de una localidad en un día**

```js
db.lecturas_hora.aggregate([
  { $match: { localidad: "Kennedy",
              hora: { $gte: ISODate("2026-11-09T00:00:00-05:00"),
                      $lt:  ISODate("2026-11-10T00:00:00-05:00") } } },
  { $group: { _id: "$hora",
              sumaPm25: { $sum: "$resumen.pm25.suma" },
              nPm25:    { $sum: "$resumen.pm25.conteo" } } },
  { $project: { _id: 0, hora: "$_id", promedioPm25: { $round: [{ $divide: ["$sumaPm25", "$nPm25"] }, 2] } } },
  { $sort: { hora: 1 } }
]);
```


**Consulta (b) Sensores que generaron alertas en la última semana**

```js
db.lecturas_hora.aggregate([
  { $match: { numAlertas: { $gt: 0 },
              hora: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
  { $group: { _id: "$sensorId", localidad: { $first: "$localidad" },
              totalAlertas: { $sum: "$numAlertas" }, maxPm25: { $max: "$resumen.pm25.max" } } },
  { $sort: { totalAlertas: -1 } }
]);
```


## Caso 3 – Red social universitaria


**Colecciones**

usuarios, seguidores_overflow, publicaciones, comentarios

**Patrones aplicados, justificación y qué pasaría sin ellos**

| **Patrón** | **Dónde se aplica** | **Justificación** | **Si NO se aplica** |
| --- | --- | --- | --- |
| Outlier | usuarios.seguidores + tieneOverflow; colección seguidores_overflow | La mayoría embebe sus seguidores; las cuentas de +100.000 pasan el exceso a bloques de 1.000. | Arreglos de 100.000+ ids hacen documentos gigantes cerca de 16 MB y cada $push reescribe todo. |
| Polymorphic | publicaciones.tipo (texto, imagen, video, encuesta) | Todas las publicaciones en una colección: el feed se resuelve con una consulta y un índice. | 4 colecciones: el feed necesitaría varias consultas o $unionWith y ordenar en la app. |
| Subset | publicaciones.comentariosRecientes + colección comentarios | El feed solo muestra los últimos comentarios. | La publicación crecería sin límite con todos sus comentarios. |
| Computed | publicaciones.stats.interacciones; usuarios.stats | El ranking semanal ordena por un campo ya calculado. | Habría que contar likes y comentarios de todas las publicaciones en cada consulta. |

**Índices propuestos**

- publicaciones: { "autor.usuarioId": 1, fecha: -1 }  → pregunta (a)
- publicaciones: { fecha: -1, "stats.interacciones": -1 }  → pregunta (b)
- comentarios: { publicacionId: 1, fecha: -1 }
- seguidores_overflow: { usuarioId: 1, bloque: 1 }

**Consulta (a) Feed con las 20 publicaciones más recientes de las cuentas que sigue un estudiante**

```js
const yo = db.usuarios.findOne({ _id: ObjectId("665f0000000000000000a001") }, { siguiendo: 1 });
db.publicaciones.find(
  { "autor.usuarioId": { $in: yo.siguiendo } },
  { tipo: 1, "autor.nombre": 1, fecha: 1, texto: 1, "stats.likes": 1 }
).sort({ fecha: -1 }).limit(20);
```


**Consulta (b) Publicaciones con más interacciones de la semana**

```js
db.publicaciones.find(
  { fecha: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  { tipo: 1, "autor.nombre": 1, fecha: 1, "stats.interacciones": 1 }
).sort({ "stats.interacciones": -1 }).limit(10);
```
