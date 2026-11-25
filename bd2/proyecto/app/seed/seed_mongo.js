// =====================================================================
// Proyecto Final Bases de Datos 2 - Tienda de Ropa
// Archivo : seed/seed_mongo.js
// Autores : Juan Diego Mateus, Diego Lemus
// Fecha   : 2026-11-04
// Descripcion: puebla MongoDB a partir de los datos reales de PostgreSQL:
//   catalogo con atributos variables, imagenes en GridFS, resenas de
//   compras entregadas, eventos de navegacion y carritos.
//   Requiere haber ejecutado antes db/mongo/01_modelo.js y la base relacional.
// Uso: node seed/seed_mongo.js
// =====================================================================
const { Pool } = require('pg');
const { MongoClient, GridFSBucket } = require('mongodb');
const cfg = require('../src/config');
const { svgPrenda } = require('./siluetas');

// Generador pseudoaleatorio determinista (mulberry32) para que los datos sean reproducibles
function prng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = prng(20261104);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const DIA = 86400000;

const COLORES = { Negro: '#2b2b2b', Blanco: '#f1f1ef', Azul: '#2f5d9f', Rojo: '#b3262b', Verde: '#2f7d4f',
                  Beige: '#d8c3a0', Gris: '#8a8f98', Vinotinto: '#6d1f3a', Mostaza: '#d3a22a', Rosado: '#e8a3b5' };

// ---------- Imagenes: ilustraciones SVG por tipo de prenda (ver seed/siluetas.js) ----------

// ---------- Atributos segun la familia de la categoria (esquema flexible) ----------
function atributos(p, idx) {
  const cat = p.categoria, raiz = p.categoria_raiz;
  const cuidados = ['Lavar a maquina con agua fria', 'No usar blanqueador', 'Planchar a temperatura media', 'No secar en secadora'];
  const base = { temporada: pick(['Todo el ano', 'Primavera-Verano', 'Otono-Invierno']), pais_origen: pick(['Colombia', 'Colombia', 'Peru', 'Bangladesh']) };
  if (['Camisetas', 'Camisas', 'Blusas', 'Buzos y Sudaderas'].includes(cat)) {
    const mat = pick([['Algodon', 100], ['Algodon', 95], ['Lino', 100], ['Poliester', 65]]);
    return { ...base, material: mat[0], composicion: [{ fibra: mat[0].toLowerCase(), porcentaje: mat[1] }, ...(mat[1] < 100 ? [{ fibra: 'elastano', porcentaje: 100 - mat[1] }] : [])],
             cuello: pick(['Redondo', 'En V', 'Polo', 'Alto', 'Camisero']), manga: pick(['Corta', 'Larga', 'Sin manga']),
             fit: pick(['Regular', 'Oversize', 'Slim']), estilo: pick(['casual', 'basico', 'urbano']), cuidados: cuidados.slice(0, entre(2, 4)) };
  }
  if (['Jeans', 'Pantalones', 'Shorts', 'Faldas'].includes(cat)) {
    return { ...base, material: pick(['Denim', 'Gabardina', 'Algodon']), tiro: pick(['Alto', 'Medio', 'Bajo']),
             corte: pick(['Skinny', 'Recto', 'Mom', 'Wide leg', 'Slim']), cierre: pick(['Cremallera y boton', 'Elastico']),
             elasticidad: rnd() < 0.6, largo_costura_cm: entre(70, 84), estilo: pick(['casual', 'urbano', 'oficina']), cuidados: cuidados.slice(0, 3) };
  }
  if (cat === 'Vestidos y Enterizos') {
    return { ...base, material: pick(['Lino', 'Viscosa', 'Algodon']), largo: pick(['Corto', 'Midi', 'Largo']),
             estampado: pick(['Liso', 'Floral', 'Rayas']), forro: rnd() < 0.5, manga: pick(['Sin manga', 'Corta', 'Larga']),
             estilo: pick(['casual', 'fiesta', 'oficina']), cuidados: cuidados.slice(0, 3) };
  }
  if (raiz === 'Ropa' && ['Chaquetas', 'Gabardinas y Paños'].includes(cat)) {
    return { ...base, material_exterior: pick(['Denim', 'Poliester', 'Lana', 'Gabardina']), forro: pick(['Algodon', 'Poliester', 'Sin forro']),
             impermeable: rnd() < 0.4, capucha: rnd() < 0.35, bolsillos: entre(2, 5), estilo: pick(['urbano', 'clasico', 'deportivo']), cuidados: cuidados.slice(0, 2) };
  }
  if (cat === 'Deportiva') {
    return { ...base, tecnologia: pick(['dry-fit', 'compresion', 'secado rapido']), nivel_soporte: pick(['bajo', 'medio', 'alto']),
             reflectivo: rnd() < 0.3, costuras_planas: rnd() < 0.5, estilo: 'deportivo', cuidados: cuidados.slice(0, 2) };
  }
  if (['Gorras y Sombreros', 'Cinturones', 'Bolsos'].includes(cat)) {
    return { ...base, material: pick(['Cuero', 'Lona', 'Poliester', 'Algodon']), ajustable: rnd() < 0.7,
             dimensiones_cm: { alto: entre(10, 40), ancho: entre(10, 45), fondo: entre(2, 15) },
             ...(cat === 'Bolsos' ? { capacidad_litros: entre(5, 25), cierre: pick(['Cremallera', 'Iman', 'Abierto']) } : {}),
             estilo: pick(['casual', 'urbano']) };
  }
  return { ...base, material: 'Algodon', paquete: 'x3', estilo: 'basico', cuidados: cuidados.slice(0, 2) };
}

function guiaTallas(tallas) {
  const top = { XS: [82, 64], S: [88, 70], M: [94, 76], L: [100, 82], XL: [106, 88] };
  if (tallas.every((t) => top[t])) return { unidad: 'cm', medidas: tallas.map((t) => ({ talla: t, pecho: top[t][0], cintura: top[t][1] })) };
  if (tallas.every((t) => /^\d+$/.test(t))) return { unidad: 'cm', medidas: tallas.map((t) => ({ talla: t, cintura: 40 + Number(t) * (Number(t) > 20 ? 1 : 2.4) })) };
  return undefined;
}

// ---------- Textos de resenas ----------
const TITULOS = { 5: ['Excelente', 'Me encanto', 'Muy buena compra', 'Lo recomiendo'], 4: ['Muy bueno', 'Buena calidad', 'Casi perfecto'],
                  3: ['Normal', 'Cumple, nada mas', 'Regular'], 2: ['No era lo esperado', 'Decepcionante'], 1: ['Mala experiencia', 'No lo recomiendo'] };
const COMENT = { 5: ['La tela es suave y el color es igual a la foto.', 'Llego rapido y la calidad es muy buena.', 'Me quedo perfecto, volveria a comprar.'],
                 4: ['Buena calidad por el precio, el color es un poco mas oscuro.', 'Cumple lo prometido, la entrega fue puntual.'],
                 3: ['La tela es delgada pero sirve para el diario.', 'El acabado podria mejorar, por lo demas bien.'],
                 2: ['La costura se solto despues del primer lavado.', 'La talla no corresponde a la guia.'],
                 1: ['Llego con un defecto en la tela.', 'El color es muy distinto al de la pagina.'] };
const NOMBRES = ['Tienda Moda', 'Equipo de servicio'];

(async () => {
  const pg = new Pool(cfg.pg);
  const mongo = new MongoClient(cfg.mongo.url);
  await mongo.connect();
  const bd = mongo.db(cfg.mongo.db);
  const bucket = new GridFSBucket(bd, { bucketName: 'imagenes' });

  // limpieza previa para poder repetir el seed
  await Promise.all(['catalogo_productos', 'resenas', 'eventos_app', 'carritos'].map((c) => bd.collection(c).deleteMany({})));
  await bd.collection('imagenes.files').deleteMany({}); await bd.collection('imagenes.chunks').deleteMany({});

  const { rows: productos } = await pg.query('SELECT id_producto, nombre, genero, categoria, categoria_raiz, marca, descripcion FROM vw_catalogo ORDER BY id_producto');
  const { rows: vars } = await pg.query("SELECT DISTINCT id_variante, sku, id_producto, producto, talla, color FROM vw_variantes_stock WHERE tipo_sucursal = 'ONLINE' ORDER BY id_variante");
  const porProducto = new Map();
  for (const v of vars) { if (!porProducto.has(v.id_producto)) porProducto.set(v.id_producto, []); porProducto.get(v.id_producto).push(v); }

  // ---- Catalogo + imagenes ----
  const imagenesPorProducto = new Map();
  const docsCatalogo = [];
  for (const [i, p] of productos.entries()) {
    const vs = porProducto.get(p.id_producto) || [];
    const colores = [...new Set(vs.map((v) => v.color))];
    const tallas = [...new Set(vs.map((v) => v.talla))];
    const imagenes = [];
    for (const [k, color] of colores.entries()) {
      for (const tipo of (k === 0 ? ['principal', 'detalle'] : ['principal'])) {
        const id = await new Promise((resolve, reject) => {
          const up = bucket.openUploadStream(`prod${p.id_producto}-${color.toLowerCase()}-${tipo}.svg`,
            { metadata: { contentType: 'image/svg+xml', id_producto: p.id_producto, color, tipo } });
          up.on('finish', () => resolve(up.id)); up.on('error', reject);
          up.end(Buffer.from(svgPrenda(p.nombre, color, tipo, p.categoria, COLORES[color])));
        });
        imagenes.push({ archivo_id: id, color, tipo, orden: imagenes.length + 1, alt: `${p.nombre} color ${color}` });
      }
    }
    imagenesPorProducto.set(p.id_producto, imagenes);
    const doc = {
      id_producto: p.id_producto, nombre: p.nombre, descripcion: p.descripcion, categoria: p.categoria, marca: p.marca, genero: p.genero,
      atributos: atributos(p, i), imagenes, colores_disponibles: colores, tallas_disponibles: tallas,
      etiquetas: [p.categoria.toLowerCase(), p.marca.toLowerCase(), p.genero.toLowerCase()],
      destacado: rnd() < 0.15, actualizado: new Date(Date.now() - entre(1, 60) * DIA),
    };
    const g = guiaTallas(tallas); if (g) doc.guia_tallas = g;
    docsCatalogo.push(doc);
  }
  await bd.collection('catalogo_productos').insertMany(docsCatalogo);

  // ---- Resenas: solo de lineas de pedidos ENTREGADOS (compra verificada) ----
  const { rows: lineas } = await pg.query(`
    SELECT p.id_pedido, p.id_cliente, p.fecha_pedido, c.id_producto, d.talla
      FROM vw_detalle_pedido d JOIN vw_pedidos p ON p.id_pedido = d.id_pedido
      JOIN vw_catalogo c ON c.nombre = d.producto
     WHERE p.estado = 'ENTREGADO' ORDER BY p.id_pedido, d.num_linea`);
  const factorProd = new Map(productos.map((p) => [p.id_producto, 0.55 + rnd() * 0.45]));      // calidad percibida del producto
  const sesgoTalla = new Map(productos.map((p) => [p.id_producto, rnd() < 0.2 ? 'pequeno' : rnd() < 0.15 ? 'grande' : 'justo']));
  const vistos = new Set(); const resenas = [];
  for (const l of lineas) {
    if (rnd() > 0.27 || new Date(l.fecha_pedido).getTime() > Date.now() - 8 * DIA) continue;
    const clave = l.id_cliente + '-' + l.id_producto; if (vistos.has(clave)) continue; vistos.add(clave);
    const q = factorProd.get(l.id_producto) + (rnd() - 0.5) * 0.5;
    const cal = q > 0.8 ? 5 : q > 0.62 ? 4 : q > 0.48 ? 3 : q > 0.36 ? 2 : 1;
    const ajuste = rnd() < 0.55 ? 'justo' : sesgoTalla.get(l.id_producto);
    const fecha = new Date(Math.min(new Date(l.fecha_pedido).getTime() + entre(3, 40) * DIA, Date.now() - DIA));
    const r = { id_producto: l.id_producto, id_cliente: l.id_cliente, id_pedido: l.id_pedido, calificacion: cal,
                titulo: pick(TITULOS[cal]), comentario: pick(COMENT[cal]), talla_comprada: l.talla, ajuste,
                votos_utiles: Math.floor(rnd() * rnd() * 25), verificada: true, fecha };
    if (rnd() < 0.1) r.fotos = [imagenesPorProducto.get(l.id_producto)[0].archivo_id];
    if (cal <= 2 && rnd() < 0.6) r.respuesta_tienda = { texto: 'Lamentamos lo ocurrido. Escribanos para gestionar el cambio o la devolucion.', fecha: new Date(fecha.getTime() + DIA), autor: pick(NOMBRES) };
    resenas.push(r);
  }
  await bd.collection('resenas').insertMany(resenas, { ordered: false });

  // ---- Eventos de navegacion (embudo de conversion) ----
  const eventos = []; const pesos = productos.map((p, i) => ({ id: p.id_producto, nombre: p.nombre, w: Math.pow(rnd(), 1.5) }));
  const idsProd = productos.map((p) => p.id_producto);
  const termino = ['jean', 'camiseta', 'vestido', 'chaqueta', 'blusa', 'buzo', 'bolso', 'falda', 'short', 'gabardina', 'ropa deportiva', 'regalo'];
  const origenes = ['busqueda', 'categoria', 'recomendado', 'promocion'];
  const fin = Date.now();
  for (let s = 0; s < 6000; s++) {
    const sesion = 'ses-' + (100000 + s);
    const horaPico = () => { const x = rnd(); const h = x < 0.35 ? 13 + (rnd() + rnd() + rnd() - 1.5) * 3 : x < 0.8 ? 20.5 + (rnd() + rnd() + rnd() - 1.5) * 3 : rnd() * 24;
                             return ((Math.floor(h) % 24) + 24) % 24; };
    const d0 = new Date(fin - rnd() * 360 * DIA); d0.setUTCHours((horaPico() + 5) % 24, entre(0, 59), entre(0, 59), 0);
    let t = d0.getTime() > fin ? d0.getTime() - DIA : d0.getTime(); const dispositivo = rnd() < 0.62 ? 'movil' : rnd() < 0.87 ? 'escritorio' : 'tablet';
    const cli = rnd() < 0.6 ? entre(1, 600) : undefined;
    const ev = (tipo, payload) => { t += entre(5, 90) * 1000; const e = { tipo, ts: new Date(t), sesion_id: sesion, dispositivo, payload }; if (cli) e.id_cliente = cli; eventos.push(e); };
    if (cli && rnd() < 0.5) ev('login', { metodo: pick(['correo', 'correo', 'google']) });
    const q = pick(termino); if (rnd() < 0.7) ev('busqueda', { termino: q, resultados: entre(0, 40) });
    const vistas = entre(1, 4); const idsVistos = [];
    for (let v = 0; v < vistas; v++) {
      const id = idsProd[Math.floor(Math.pow(rnd(), 1.6) * idsProd.length)]; idsVistos.push(id);
      ev('vista_producto', { id_producto: id, origen: pick(origenes), duracion_seg: entre(5, 180) });
    }
    if (rnd() < 0.34) {
      const id = pick(idsVistos); const vs = porProducto.get(id);
      ev('agregar_carrito', { id_producto: id, id_variante: pick(vs).id_variante, cantidad: rnd() < 0.85 ? 1 : 2 });
      if (rnd() < 0.5) {
        ev('inicio_checkout', { metodo_pago: pick(['PSE', 'TARJETA_CREDITO', 'NEQUI', 'TRANSFERENCIA']) });
        if (rnd() < 0.15) ev('error_pago', { codigo: pick(['FONDOS_INSUFICIENTES', 'TARJETA_RECHAZADA', 'TIEMPO_AGOTADO']) });
        else if (rnd() < 0.78) ev('pedido_creado', { valor_estimado: entre(40, 600) * 1000 });
      }
    }
  }
  for (let i = 0; i < eventos.length; i += 5000) await bd.collection('eventos_app').insertMany(eventos.slice(i, i + 5000));

  // ---- Carritos activos ----
  const carritos = []; const clientes = new Set();
  while (carritos.length < 25) {
    const c = entre(1, 600); if (clientes.has(c)) continue; clientes.add(c);
    const items = [...new Set(Array.from({ length: entre(1, 3) }, () => pick(vars)))].map((v) => ({ id_variante: v.id_variante, sku: v.sku, nombre: v.producto, cantidad: entre(1, 2) }));
    carritos.push({ id_cliente: c, items, actualizado: new Date(Date.now() - entre(0, 20) * DIA) });
  }
  await bd.collection('carritos').insertMany(carritos);

  console.log(JSON.stringify({ catalogo: docsCatalogo.length, imagenes: await bd.collection('imagenes.files').countDocuments(),
    resenas: resenas.length, eventos: eventos.length, carritos: carritos.length }));
  await mongo.close(); await pg.end();
})().catch((e) => { console.error(e); process.exit(1); });
