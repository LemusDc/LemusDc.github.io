'use strict';
// =====================================================================
// Interfaz de la Tienda de Ropa. Sin frameworks: JavaScript estandar.
// Toda cadena que viene del servidor se escapa con esc() antes de usarse en HTML.
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const dinero = (v) => COP.format(Number(v || 0));
const num = (v) => new Intl.NumberFormat('es-CO').format(Number(v || 0));
const fecha = (v) => (v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '');
const estrellas = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const corto = (s) => String(s || '').replace(/^Tienda /, '');

const estado = { usuario: null, cat: null, vista: null, ultimoEv: 0, evAbierto: false, evTimer: null };
const main = $('#contenido');

// ---------------------------------------------------------------------
// Comunicacion con el servidor
// ---------------------------------------------------------------------
async function api(ruta, { metodo = 'GET', cuerpo, form } = {}) {
  const op = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (form) op.body = form;
  else if (cuerpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(cuerpo); }
  let r;
  try { r = await fetch('/api' + ruta, op); } catch { aviso('No hay conexión con el servidor', 'mal'); return { status: 0, ok: false, datos: {} }; }
  let datos = {}; try { datos = await r.json(); } catch { /* respuesta sin cuerpo */ }
  if (r.status === 401 && estado.usuario) { estado.usuario = null; mostrarLogin(); }
  if (metodo !== 'GET') setTimeout(refrescarEvidencia, 250);
  return { status: r.status, ok: r.ok, datos };
}
function aviso(texto, tipo = 'ok', ms = 7000) {
  const d = document.createElement('div'); d.className = 'aviso ' + tipo; d.textContent = texto;
  $('#avisos').appendChild(d); setTimeout(() => d.remove(), ms);
}
// Resultado de un procedimiento almacenado: muestra el codigo de retorno
function resultado(r) {
  const d = r.datos || {};
  aviso((d.ok ? '' : `Código ${d.codigo ?? r.status}: `) + (d.mensaje || 'Sin respuesta') + (d.advertencia ? ' ' + d.advertencia : ''), d.ok ? 'ok' : 'mal');
  return !!d.ok;
}

// ---------------------------------------------------------------------
// Dialogos
// ---------------------------------------------------------------------
const dlg = $('#dlg'); const dlg2 = document.createElement('dialog'); dlg2.innerHTML = '<div id="dlg2-contenido"></div>'; document.body.appendChild(dlg2);
function abrir(html, en = dlg) { $('div', en).innerHTML = html; if (!en.open) en.showModal(); }
function cerrar(en = dlg) { if (en.open) en.close(); }
const cabecera = (t, extra = '') => `<div class="dlg-cabecera"><h2>${t}</h2><button type="button" data-accion="cerrar">Cerrar</button></div>${extra}`;

// Formulario emergente generico: devuelve un objeto con los valores o null si se cancela
function pedirDatos(titulo, campos, boton = 'Aceptar', nota = '') {
  return new Promise((resolver) => {
    const html = campos.map((c) => {
      const base = `name="${esc(c.name)}" ${c.required === false ? '' : 'required'} ${c.max ? `maxlength="${c.max}"` : ''}`;
      if (c.type === 'select') return `<label>${esc(c.label)}<select ${base}>${c.options.map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(c.value) ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select></label>`;
      if (c.type === 'textarea') return `<label>${esc(c.label)}<textarea ${base} rows="3"></textarea></label>`;
      if (c.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${esc(c.name)}"> ${esc(c.label)}</label>`;
      return `<label>${esc(c.label)}<input type="${c.type || 'text'}" ${base} ${c.min !== undefined ? `min="${c.min}"` : ''} ${c.step ? `step="${c.step}"` : ''} value="${esc(c.value ?? '')}"></label>`;
    }).join('');
    $('#dlg2-contenido').innerHTML = `<form class="formulario">${cabecera(esc(titulo))}${nota ? `<p class="suave">${nota}</p>` : ''}<div class="dos">${html}</div><div class="fila"><button type="submit" class="primario">${esc(boton)}</button><button type="button" data-cancelar>Cancelar</button></div></form>`;
    let hecho = false;
    const f = $('form', dlg2);
    f.addEventListener('submit', (e) => { e.preventDefault(); hecho = true; const v = {};
      for (const c of campos) { const el = f.elements[c.name]; v[c.name] = c.type === 'checkbox' ? el.checked : el.value; } dlg2.close(); resolver(v); });
    $('[data-cancelar]', f).addEventListener('click', () => dlg2.close());
    $('[data-accion="cerrar"]', f).addEventListener('click', () => dlg2.close());
    dlg2.addEventListener('close', () => { if (!hecho) resolver(null); }, { once: true });
    dlg2.showModal();
  });
}

// ---------------------------------------------------------------------
// Utilidades de interfaz
// ---------------------------------------------------------------------
function paginacion(total, pagina, porPagina) {
  const n = Math.max(1, Math.ceil(total / porPagina));
  return `<div class="paginacion"><button type="button" data-pag="${pagina - 1}" ${pagina <= 1 ? 'disabled' : ''}>Anterior</button><span>Página ${pagina} de ${n} &middot; ${num(total)} registros</span><button type="button" data-pag="${pagina + 1}" ${pagina >= n ? 'disabled' : ''}>Siguiente</button></div>`;
}
function enlazarPaginacion(raiz, cargar) {
  $$('.paginacion', raiz).forEach((p) => p.addEventListener('click', (e) => { const b = e.target.closest('[data-pag]'); if (b && !b.disabled) cargar(Number(b.dataset.pag)); }));
}
const opciones = (lista, v, t, vacio) => (vacio ? `<option value="">${esc(vacio)}</option>` : '') + lista.map((x) => `<option value="${esc(x[v])}">${esc(x[t])}</option>`).join('');
const etiquetaEstado = (e) => `<span class="etiqueta ${{ ENTREGADO: 'ok', CANCELADO: 'mal', CREADO: 'aviso' }[e] || ''}">${esc(e.replace('_', ' '))}</span>`;
const formDatos = (f) => Object.fromEntries(new FormData(f).entries());
const barras = (filas, etiqueta, valor, formato = num) => {
  const max = Math.max(1, ...filas.map((f) => Number(f[valor])));
  return filas.map((f) => `<div class="barra-fila"><span>${esc(f[etiqueta])}</span><div class="barra-h" data-w="${(100 * Number(f[valor]) / max).toFixed(1)}"></div><span class="num">${esc(formato(f[valor]))}</span></div>`).join('');
};
function aplicarAnchos(raiz) { $$('[data-w]', raiz).forEach((e) => { e.style.width = e.dataset.w + '%'; }); }
const tabla = (cab, filas, vacio = 'Sin resultados') => filas.length
  ? `<div class="tabla-caja"><table><thead><tr>${cab.map((c) => `<th ${c.num ? 'class="num"' : ''}>${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`
  : `<div class="vacio">${esc(vacio)}</div>`;

// ---------------------------------------------------------------------
// Sesion y navegacion
// ---------------------------------------------------------------------
const SECCIONES = [
  { id: 'catalogo', texto: 'Catálogo', roles: ['ADMIN', 'VENDEDOR', 'ANALISTA'] },
  { id: 'venta', texto: 'Nueva venta', roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'pedidos', texto: 'Pedidos', roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'clientes', texto: 'Clientes', roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'inventario', texto: 'Inventario', roles: ['ADMIN', 'VENDEDOR', 'ANALISTA'] },
  { id: 'reportes', texto: 'Reportes', roles: ['ADMIN', 'ANALISTA'] },
  { id: 'admin', texto: 'Administración', roles: ['ADMIN'] },
];
const VISTAS = {};
function mostrarLogin() { $('#app').hidden = true; $('#pantalla-login').hidden = false; detenerEvidencia(); }
async function iniciarApp(usuario) {
  estado.usuario = usuario;
  const c = await api('/catalogos'); estado.cat = c.datos;
  $('#pantalla-login').hidden = true; $('#app').hidden = false;
  $('#usuario-info').textContent = `${usuario.nombre} (${usuario.rol})`;
  const permitidas = SECCIONES.filter((s) => s.roles.includes(usuario.rol));
  $('#menu').innerHTML = permitidas.map((s) => `<button type="button" data-ir="${s.id}">${esc(s.texto)}</button>`).join('');
  ir(location.hash.slice(1) && permitidas.some((s) => s.id === location.hash.slice(1)) ? location.hash.slice(1) : permitidas[0].id);
}
function ir(id) {
  estado.vista = id; location.hash = id;
  $$('#menu button').forEach((b) => b.setAttribute('aria-current', b.dataset.ir === id ? 'page' : 'false'));
  main.innerHTML = '<p class="vacio">Cargando...</p>';
  VISTAS[id]().catch((e) => { console.error(e); main.innerHTML = '<p class="error">No se pudo cargar la sección.</p>'; });
}

// ---------------------------------------------------------------------
// Panel de evidencia (registro de llamadas a las bases de datos)
// ---------------------------------------------------------------------
async function refrescarEvidencia() {
  if (!estado.evAbierto) return;
  const solo = $('#ev-todo').checked ? '0' : '1';
  const r = await fetch(`/api/evidencia?desde=${estado.ultimoEv}&procedimientos=${solo}`, { credentials: 'same-origin' });
  if (!r.ok) return; const { eventos } = await r.json();
  if (!eventos.length) return;
  const lista = $('#ev-lista');
  for (const e of eventos) {
    estado.ultimoEv = Math.max(estado.ultimoEv, e.id);
    const div = document.createElement('div'); div.className = 'ev';
    const motor = e.motor === 'PostgreSQL' ? 'pg' : 'mg';
    div.innerHTML = `<span class="ms">${esc(new Date(e.ts).toLocaleTimeString('es-CO'))} ${e.ms} ms${e.usuario ? ' [' + esc(e.usuario) + ']' : ''}</span> <span class="${motor}">${esc(e.motor)}</span> ${esc(e.sentencia)}` +
      (e.parametros ? `\n  parámetros: ${esc(e.parametros)}` : '') + (e.resultado ? `\n  resultado: ${esc(e.resultado)}` : '') + (e.error ? `\n  <span class="er">ERROR: ${esc(e.error)}</span>` : '');
    lista.prepend(div);
  }
  while (lista.children.length > 150) lista.lastChild.remove();
}
function detenerEvidencia() { estado.evAbierto = false; clearInterval(estado.evTimer); $('#panel-evidencia').hidden = true; }

// ---------------------------------------------------------------------
// Eventos globales (delegacion)
// ---------------------------------------------------------------------
$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault(); const f = formDatos(e.target); $('#login-error').textContent = '';
  const r = await api('/login', { metodo: 'POST', cuerpo: { username: f.username, password: f.password } });
  if (!r.ok) { $('#login-error').textContent = r.datos.mensaje || 'No se pudo iniciar sesión'; return; }
  e.target.reset(); iniciarApp(r.datos.usuario);
});
$('#btn-salir').addEventListener('click', async () => { await api('/logout', { metodo: 'POST' }); estado.usuario = null; mostrarLogin(); });
$('#btn-evidencia').addEventListener('click', () => {
  estado.evAbierto = !estado.evAbierto; $('#panel-evidencia').hidden = !estado.evAbierto;
  clearInterval(estado.evTimer);
  if (estado.evAbierto) { estado.ultimoEv = 0; $('#ev-lista').innerHTML = ''; refrescarEvidencia(); estado.evTimer = setInterval(refrescarEvidencia, 2000); }
});
$('#ev-cerrar').addEventListener('click', () => $('#btn-evidencia').click());
$('#ev-limpiar').addEventListener('click', () => { $('#ev-lista').innerHTML = ''; });
$('#ev-todo').addEventListener('change', () => { estado.ultimoEv = 0; $('#ev-lista').innerHTML = ''; refrescarEvidencia(); });
document.addEventListener('click', (e) => {
  const m = e.target.closest('[data-ir]'); if (m) ir(m.dataset.ir);
  if (e.target.closest('dialog [data-accion="cerrar"]')) { const d = e.target.closest('dialog'); d.close(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dlg2.open) dlg2.close(); });

// =====================================================================
// CATALOGO (PostgreSQL + MongoDB)
// =====================================================================
const GENEROS = [['MUJER', 'Mujer'], ['HOMBRE', 'Hombre'], ['NINA', 'Niña'], ['NINO', 'Niño'], ['UNISEX', 'Unisex']];
VISTAS.catalogo = async () => {
  const c = estado.cat;
  main.innerHTML = `<h2>Catálogo</h2>
    <form id="f-cat" class="fila tarjeta">
      <label>Buscar <input name="q" maxlength="60" placeholder="nombre del producto"></label>
      <label>Categoría <select name="categoria"><option value="">Todas</option>${c.categorias.map((x) => `<option value="${x.id_categoria}">${'&nbsp;&nbsp;'.repeat(x.nivel - 1)}${esc(x.nombre)}</option>`).join('')}</select></label>
      <label>Marca <select name="marca">${opciones(c.marcas, 'id_marca', 'nombre', 'Todas')}</select></label>
      <label>Género <select name="genero"><option value="">Todos</option>${GENEROS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="promo" value="1"> Solo en promoción</label>
      <button class="primario" type="submit">Buscar</button></form>
    <div id="cat-res"></div>`;
  const cargar = async (pag = 1) => {
    const p = new URLSearchParams(formDatos($('#f-cat'))); p.set('pagina', pag);
    const r = await api('/catalogo?' + p); const d = r.datos; const caja = $('#cat-res');
    if (!d.productos || !d.productos.length) { caja.innerHTML = '<div class="vacio">No hay productos con esos filtros</div>'; return; }
    caja.innerHTML = `<div class="rejilla">${d.productos.map((x) => `
      <button type="button" class="carta" data-producto="${x.id_producto}">
        ${x.imagen_id ? `<img src="/api/imagenes/${esc(x.imagen_id)}" alt="${esc(x.nombre)}" loading="lazy">` : '<div class="vacio">Sin imagen</div>'}
        <span class="cuerpo"><strong>${esc(x.nombre)}</strong><span class="suave">${esc(x.marca)} &middot; ${esc(x.categoria)}</span>
          <span>${Number(x.descuento_vigente) > 0 ? `<span class="tachado">${dinero(x.precio_base)}</span> ` : ''}<strong>${dinero(x.precio_final)}</strong></span>
          <span class="suave">${x.promedio ? `${estrellas(x.promedio)} ${x.promedio} (${x.resenas})` : 'Sin reseñas'} &middot; ${num(x.stock_total)} uds</span></span></button>`).join('')}</div>
      ${paginacion(d.total, d.pagina, d.por_pagina)}`;
    enlazarPaginacion(caja, cargar);
  };
  $('#f-cat').addEventListener('submit', (e) => { e.preventDefault(); cargar(1); });
  $('#cat-res').addEventListener('click', (e) => { const b = e.target.closest('[data-producto]'); if (b) abrirProducto(Number(b.dataset.producto)); });
  cargar(1);
};

function filasAtributos(a) {
  return Object.entries(a || {}).map(([k, v]) => {
    let t;
    if (Array.isArray(v)) t = v.map((x) => (typeof x === 'object' ? `${x.fibra} ${x.porcentaje}%` : x)).join(', ');
    else if (v && typeof v === 'object') t = Object.entries(v).map(([a2, b2]) => `${a2}: ${b2}`).join(', ');
    else t = v === true ? 'Sí' : v === false ? 'No' : v;
    return `<tr><th>${esc(k.replace(/_/g, ' '))}</th><td>${esc(t)}</td></tr>`;
  }).join('');
}
const htmlResena = (r, rol) => `<div class="resena" data-id="${esc(r._id)}">
  <strong>${estrellas(r.calificacion)}</strong> ${esc(r.titulo || '')} <span class="suave">&middot; ${esc(r.cliente)} &middot; ${esc(fecha(r.fecha).split(',')[0])}${r.verificada ? ' &middot; compra verificada' : ''}${r.talla_comprada ? ` &middot; talla ${esc(r.talla_comprada)} (${esc(r.ajuste || 'sin dato')})` : ''}</span>
  <div>${esc(r.comentario)}</div>
  ${r.respuesta_tienda ? `<div class="respuesta"><strong>Respuesta de la tienda:</strong> ${esc(r.respuesta_tienda.texto)}</div>` : ''}
  <div class="suave">${r.votos_utiles} personas lo encontraron útil ${rol !== 'ANALISTA' ? `&middot; <button type="button" class="enlace" data-accion="responder">Responder</button>` : ''} ${rol === 'ADMIN' ? `&middot; <button type="button" class="enlace" data-accion="borrar-resena">Eliminar</button>` : ''}</div></div>`;

async function abrirProducto(id) {
  const r = await api('/productos/' + id); if (!r.ok) { aviso(r.datos.mensaje || 'No se pudo abrir el producto', 'mal'); return; }
  const { producto: p, variantes, ficha, resumen, resenas } = r.datos; const rol = estado.usuario.rol;
  const imgs = (ficha && ficha.imagenes) || [];
  const colores = [...new Set(imgs.map((i) => i.color))];
  const guia = ficha && ficha.guia_tallas;
  const cols = guia ? [...new Set(guia.medidas.flatMap((m) => Object.keys(m)))] : [];
  abrir(`${cabecera(esc(p.nombre))}
    <div class="ficha">
      <div><img id="img-prod" src="${imgs[0] ? '/api/imagenes/' + esc(imgs[0].archivo_id) : ''}" alt="${esc(p.nombre)}">
        <div class="colores" id="chips">${colores.map((c, i) => `<button type="button" data-color="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join('')}</div>
        ${rol === 'ADMIN' ? `<form id="f-img" class="fila"><label>Agregar imagen (GridFS)<input type="file" name="imagen" accept="image/png,image/jpeg,image/webp,image/svg+xml" required></label>
          <label>Color<select name="color">${(ficha ? ficha.colores_disponibles : []).map((c) => `<option>${esc(c)}</option>`).join('')}</select></label><button type="submit">Subir</button></form>` : ''}</div>
      <div>
        <p class="suave">${esc(p.marca)} &middot; ${esc(p.ruta_categoria)} &middot; ${esc(p.genero)}</p>
        <p>${Number(p.descuento_vigente) > 0 ? `<span class="tachado">${dinero(p.precio_base)}</span> ` : ''}<strong>${dinero(p.precio_final)}</strong>
           ${Number(p.descuento_vigente) > 0 ? `<span class="etiqueta ok">promoción vigente</span>` : ''}</p>
        <p>${resumen ? `${estrellas(resumen.promedio)} <strong>${resumen.promedio}</strong> (${resumen.resenas} reseñas)` : 'Aún sin reseñas'}</p>
        <p>${esc(p.descripcion || '')}</p>
        <h3>Ficha técnica <span class="suave">(MongoDB)</span></h3>
        ${ficha ? `<div class="tabla-caja"><table><tbody>${filasAtributos(ficha.atributos)}</tbody></table></div>` : '<p class="suave">Sin ficha documental</p>'}
        ${guia ? `<h3>Guía de tallas (${esc(guia.unidad)})</h3>${tabla(cols.map((c) => ({ t: c })), guia.medidas.map((m) => `<tr>${cols.map((c) => `<td>${esc(m[c] ?? '')}</td>`).join('')}</tr>`))}` : ''}
      </div>
    </div>
    <h3>Disponibilidad por variante <span class="suave">(PostgreSQL)</span></h3>
    ${tabla([{ t: 'SKU' }, { t: 'Color' }, { t: 'Talla' }, { t: 'Stock total', num: true }, { t: 'Por sucursal' }],
      variantes.map((v) => `<tr><td>${esc(v.sku)}</td><td>${esc(v.color)}</td><td>${esc(v.talla)}</td><td class="num">${v.total}</td><td class="suave">${v.por_sucursal.map((s) => `${esc(corto(s.sucursal).replace('Virtual y Bodega Central', 'Bodega'))}: ${s.stock}`).join(' &middot; ')}</td></tr>`))}
    <h3>Reseñas <span class="suave">(MongoDB)</span></h3>
    <div class="fila"><label>Ordenar <select id="ord-res"><option value="recientes">Más recientes</option><option value="utiles">Más útiles</option><option value="mejores">Mejor calificadas</option><option value="peores">Peor calificadas</option></select></label></div>
    <div id="lista-res">${resenas.map((x) => htmlResena(x, rol)).join('') || '<p class="suave">Sin reseñas</p>'}</div>
    <div class="paginacion"><button type="button" id="mas-res">Ver más reseñas</button></div>
    ${rol !== 'ANALISTA' ? `<h3>Registrar reseña</h3><form id="f-res" class="fila">
      <label>ID de cliente<input name="id_cliente" type="number" min="1" required></label>
      <label>Calificación<select name="calificacion"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>
      <label>Título<input name="titulo" maxlength="120"></label>
      <label>Ajuste de talla<select name="ajuste"><option value="justo">Justo</option><option value="pequeno">Pequeño</option><option value="grande">Grande</option></select></label>
      <label class="ancho">Comentario<input name="comentario" required maxlength="1000"></label><button type="submit" class="primario">Publicar</button></form>
      <p class="suave">Solo pueden opinar clientes con una compra entregada de este producto (se valida en PostgreSQL).</p>` : ''}`);

  $('#chips') && $('#chips').addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (!b) return;
    $$('#chips button').forEach((x) => x.setAttribute('aria-pressed', x === b)); const im = imgs.find((i) => i.color === b.dataset.color); if (im) $('#img-prod').src = '/api/imagenes/' + im.archivo_id; });
  let pagRes = 1;
  const recargarRes = async (reiniciar) => {
    if (reiniciar) { pagRes = 1; $('#lista-res').innerHTML = ''; } else pagRes += 1;
    const q = await api(`/productos/${id}/resenas?pagina=${pagRes}&orden=${$('#ord-res').value}`);
    $('#lista-res').insertAdjacentHTML('beforeend', (q.datos.resenas || []).map((x) => htmlResena(x, rol)).join(''));
    $('#mas-res').hidden = pagRes * 10 >= (q.datos.total || 0);
  };
  $('#ord-res').addEventListener('change', () => recargarRes(true));
  $('#mas-res').addEventListener('click', () => recargarRes(false));
  $('#lista-res').addEventListener('click', async (e) => {
    const a = e.target.closest('[data-accion]'); if (!a) return; const rid = e.target.closest('.resena').dataset.id;
    if (a.dataset.accion === 'responder') { const v = await pedirDatos('Responder reseña', [{ name: 'texto', label: 'Respuesta', type: 'textarea', max: 500 }], 'Publicar');
      if (v && resultado(await api(`/resenas/${rid}/respuesta`, { metodo: 'POST', cuerpo: { texto: v.texto } }))) abrirProducto(id); }
    if (a.dataset.accion === 'borrar-resena' && resultado(await api('/resenas/' + rid, { metodo: 'DELETE' }))) abrirProducto(id);
  });
  const fr = $('#f-res'); if (fr) fr.addEventListener('submit', async (e) => { e.preventDefault(); const f = formDatos(fr);
    const q = await api(`/productos/${id}/resenas`, { metodo: 'POST', cuerpo: { id_cliente: Number(f.id_cliente), calificacion: Number(f.calificacion), titulo: f.titulo, ajuste: f.ajuste, comentario: f.comentario } });
    aviso(q.datos.mensaje || 'Error', q.ok ? 'ok' : 'mal'); if (q.ok) abrirProducto(id); });
  const fi = $('#f-img'); if (fi) fi.addEventListener('submit', async (e) => { e.preventDefault(); const q = await api(`/productos/${id}/imagenes`, { metodo: 'POST', form: new FormData(fi) });
    aviso(q.datos.mensaje || 'Error', q.ok ? 'ok' : 'mal'); if (q.ok) abrirProducto(id); });
}

// =====================================================================
// NUEVA VENTA (cliente y pedido en PostgreSQL, carrito en MongoDB)
// =====================================================================
VISTAS.venta = async () => {
  const c = estado.cat; const u = estado.usuario;
  const fisicas = c.sucursales.filter((s) => s.tipo === 'FISICA'); const online = c.sucursales.find((s) => s.tipo === 'ONLINE');
  const v = { cliente: null, direcciones: [], items: [], precios: new Map() };
  main.innerHTML = `<h2>Nueva venta</h2>
  <div class="dos">
    <section class="tarjeta"><h3>1. Cliente</h3>
      <form id="v-buscar" class="fila"><label>Buscar por nombre, documento o correo<input name="q" maxlength="60" required></label><button type="submit">Buscar</button><button type="button" id="v-nuevo">Nuevo cliente</button></form>
      <div id="v-clientes"></div><div id="v-cliente-sel" class="suave">Ningún cliente seleccionado</div></section>
    <section class="tarjeta"><h3>2. Datos del pedido</h3>
      <div class="fila"><label>Canal<select id="v-canal"><option value="TIENDA">Tienda (mostrador)</option><option value="ONLINE">En línea</option></select></label>
        <label>Entrega<select id="v-entrega"></select></label>
        <label>Sucursal<select id="v-sucursal"></select></label></div>
      <div class="fila" id="v-fila-dir"><label>Dirección de envío<select id="v-dir"></select></label><button type="button" id="v-nueva-dir">Agregar dirección</button></div>
      <div class="fila"><label>Método de pago<select id="v-pago"><option value="EFECTIVO">Efectivo</option><option value="TARJETA_DEBITO">Tarjeta débito</option><option value="TARJETA_CREDITO">Tarjeta crédito</option><option value="PSE">PSE</option><option value="NEQUI">Nequi</option><option value="TRANSFERENCIA">Transferencia</option></select></label></div></section>
  </div>
  <section class="tarjeta"><h3>3. Productos</h3>
    <form id="v-prod" class="fila"><label>Buscar variante (nombre, color o SKU)<input name="q" maxlength="60" required></label><button type="submit">Buscar en la sucursal elegida</button></form>
    <div id="v-prod-res"></div></section>
  <section class="tarjeta"><h3>4. Carrito <span class="suave">(se guarda en MongoDB)</span></h3><div id="v-carrito"></div>
    <div class="fila"><button type="button" class="primario" id="v-confirmar">Confirmar pedido (CALL sp_crear_pedido)</button></div>
    <div id="v-resultado" role="status"></div></section>`;

  const ajustarCampos = () => {
    const canal = $('#v-canal').value;
    $('#v-entrega').innerHTML = canal === 'TIENDA' ? '<option value="VENTA_MOSTRADOR">Venta de mostrador</option>' : '<option value="DOMICILIO">A domicilio</option><option value="RECOGER_EN_TIENDA">Recoger en tienda</option>';
    const dom = $('#v-entrega').value === 'DOMICILIO';
    $('#v-fila-dir').hidden = !dom;
    const lista = dom ? [online] : fisicas;
    $('#v-sucursal').innerHTML = lista.map((s) => `<option value="${s.id_sucursal}">${esc(s.nombre)}</option>`).join('');
    if (u.rol === 'VENDEDOR' && canal === 'TIENDA') { $('#v-sucursal').value = u.id_sucursal; $('#v-sucursal').disabled = true; } else $('#v-sucursal').disabled = dom;
  };
  $('#v-canal').addEventListener('change', ajustarCampos); $('#v-entrega').addEventListener('change', ajustarCampos); ajustarCampos();

  const pintarCliente = () => {
    $('#v-cliente-sel').innerHTML = v.cliente ? `<strong>${esc(v.cliente.nombre_completo)}</strong> &middot; doc. ${esc(v.cliente.documento)} &middot; nivel ${esc(v.cliente.nivel)} (${num(v.cliente.puntos)} puntos)` : 'Ningún cliente seleccionado';
    $('#v-dir').innerHTML = v.direcciones.length ? v.direcciones.map((d) => `<option value="${d.id_direccion}">${esc(d.alias)}: ${esc(d.direccion)} (${esc(d.ciudad)})</option>`).join('') : '<option value="">(sin direcciones)</option>';
  };
  const pintarCarrito = () => {
    $('#v-carrito').innerHTML = v.items.length ? tabla([{ t: 'SKU' }, { t: 'Producto' }, { t: 'Cantidad', num: true }, { t: '' }],
      v.items.map((i, k) => `<tr><td>${esc(i.sku)}</td><td>${esc(i.nombre)}</td><td class="num"><input type="number" min="1" max="20" value="${i.cantidad}" data-cant="${k}" class="mini"></td><td><button type="button" data-quitar="${k}">Quitar</button></td></tr>`))
      : '<div class="vacio">El carrito está vacío</div>';
  };
  const guardarCarrito = async () => {
    if (!v.cliente) return;
    const r = await api(`/clientes/${v.cliente.id_cliente}/carrito`, { metodo: 'PUT', cuerpo: { items: v.items.map((i) => ({ id_variante: i.id_variante, cantidad: i.cantidad })) } });
    if (!r.ok) aviso(r.datos.mensaje || 'No se pudo guardar el carrito', 'mal');
  };
  const elegirCliente = async (id) => {
    const r = await api('/clientes/' + id); if (!r.ok) return;
    v.cliente = r.datos.cliente; v.direcciones = r.datos.direcciones; v.items = (r.datos.carrito && r.datos.carrito.items) || [];
    pintarCliente(); pintarCarrito(); $('#v-clientes').innerHTML = '';
  };
  $('#v-buscar').addEventListener('submit', async (e) => { e.preventDefault();
    const r = await api('/clientes?q=' + encodeURIComponent(formDatos(e.target).q)); const cl = r.datos.clientes || [];
    $('#v-clientes').innerHTML = cl.length ? tabla([{ t: 'Cliente' }, { t: 'Documento' }, { t: 'Nivel' }, { t: '' }], cl.slice(0, 6).map((x) => `<tr><td>${esc(x.nombre_completo)}</td><td>${esc(x.documento)}</td><td>${esc(x.nivel)}</td><td><button type="button" data-elegir="${x.id_cliente}">Elegir</button></td></tr>`)) : '<div class="vacio">Sin coincidencias</div>'; });
  $('#v-clientes').addEventListener('click', (e) => { const b = e.target.closest('[data-elegir]'); if (b) elegirCliente(b.dataset.elegir); });
  $('#v-nuevo').addEventListener('click', async () => { const id = await nuevoCliente(); if (id) elegirCliente(id); });
  $('#v-nueva-dir').addEventListener('click', async () => { if (!v.cliente) return aviso('Primero elija un cliente', 'mal'); if (await nuevaDireccion(v.cliente.id_cliente)) elegirCliente(v.cliente.id_cliente); });

  $('#v-prod').addEventListener('submit', async (e) => { e.preventDefault();
    const r = await api(`/inventario/buscar?q=${encodeURIComponent(formDatos(e.target).q)}&sucursal=${$('#v-sucursal').value}`); const fs = r.datos.filas || [];
    fs.forEach((f) => v.precios.set(f.id_variante, f.precio_final));
    $('#v-prod-res').innerHTML = tabla([{ t: 'SKU' }, { t: 'Producto' }, { t: 'Color' }, { t: 'Talla' }, { t: 'Precio', num: true }, { t: 'Stock aquí', num: true }, { t: '' }],
      fs.map((f) => `<tr><td>${esc(f.sku)}</td><td>${esc(f.producto)}</td><td>${esc(f.color)}</td><td>${esc(f.talla)}</td><td class="num">${dinero(f.precio_final)}</td><td class="num">${f.stock}</td>
        <td><button type="button" data-add="${f.id_variante}" data-sku="${esc(f.sku)}" data-nombre="${esc(f.producto + ' ' + f.color + ' ' + f.talla)}">Agregar</button></td></tr>`), 'Sin resultados en esta sucursal'); });
  $('#v-prod-res').addEventListener('click', async (e) => { const b = e.target.closest('[data-add]'); if (!b) return;
    if (!v.cliente) return aviso('Primero elija un cliente', 'mal');
    const id = Number(b.dataset.add); const ex = v.items.find((i) => i.id_variante === id);
    if (ex) ex.cantidad = Math.min(20, ex.cantidad + 1); else v.items.push({ id_variante: id, sku: b.dataset.sku, nombre: b.dataset.nombre, cantidad: 1 });
    pintarCarrito(); guardarCarrito(); });
  $('#v-carrito').addEventListener('click', (e) => { const b = e.target.closest('[data-quitar]'); if (b) { v.items.splice(Number(b.dataset.quitar), 1); pintarCarrito(); guardarCarrito(); } });
  $('#v-carrito').addEventListener('change', (e) => { const i = e.target.closest('[data-cant]'); if (i) { v.items[Number(i.dataset.cant)].cantidad = Math.max(1, Math.min(20, Number(i.value) || 1)); guardarCarrito(); } });

  $('#v-confirmar').addEventListener('click', async () => {
    if (!v.cliente) return aviso('Primero elija un cliente', 'mal');
    await guardarCarrito();
    const dom = $('#v-entrega').value === 'DOMICILIO';
    const r = await api('/pedidos', { metodo: 'POST', cuerpo: { id_cliente: v.cliente.id_cliente, id_sucursal: Number($('#v-sucursal').value), canal: $('#v-canal').value,
      tipo_entrega: $('#v-entrega').value, id_direccion: dom ? Number($('#v-dir').value) || null : null, metodo_pago: $('#v-pago').value, desde_carrito: true } });
    const d = r.datos; const ok = !!d.ok;
    $('#v-resultado').innerHTML = `<p class="${ok ? 'ok' : 'error'}"><strong>Código de retorno: ${esc(d.codigo ?? r.status)}</strong> &mdash; ${esc(d.mensaje || '')}</p>` + (ok ? `<p><button type="button" class="enlace" data-ver-pedido="${d.id_pedido}">Ver pedido ${d.id_pedido}</button></p>` : '');
    if (ok) { v.items = []; pintarCarrito(); elegirCliente(v.cliente.id_cliente); }
  });
  $('#v-resultado').addEventListener('click', (e) => { const b = e.target.closest('[data-ver-pedido]'); if (b) abrirPedido(Number(b.dataset.verPedido)); });
  pintarCliente(); pintarCarrito();
};

async function nuevoCliente() {
  const v = await pedirDatos('Nuevo cliente', [
    { name: 'tipo_documento', label: 'Tipo de documento', type: 'select', options: ['CC', 'CE', 'TI', 'PAS', 'NIT'].map((x) => ({ v: x, t: x })) },
    { name: 'documento', label: 'Documento', max: 20 }, { name: 'nombres', label: 'Nombres', max: 80 }, { name: 'apellidos', label: 'Apellidos', max: 80 },
    { name: 'email', label: 'Correo electrónico', type: 'email', max: 120 }, { name: 'telefono', label: 'Teléfono', max: 20, required: false }],
    'Registrar (CALL sp_registrar_cliente)');
  if (!v) return null;
  const r = await api('/clientes', { metodo: 'POST', cuerpo: v }); return resultado(r) ? r.datos.id_cliente : null;
}
async function nuevaDireccion(idCliente) {
  const v = await pedirDatos('Nueva dirección', [
    { name: 'alias', label: 'Alias (Casa, Trabajo...)', max: 40 }, { name: 'direccion', label: 'Dirección', max: 200 },
    { name: 'id_ciudad', label: 'Ciudad', type: 'select', options: estado.cat.ciudades.map((x) => ({ v: x.id_ciudad, t: x.nombre })) },
    { name: 'telefono', label: 'Teléfono de contacto', max: 20, required: false }, { name: 'es_principal', label: 'Es la dirección principal', type: 'checkbox' }],
    'Guardar (CALL sp_agregar_direccion)');
  if (!v) return false;
  return resultado(await api(`/clientes/${idCliente}/direcciones`, { metodo: 'POST', cuerpo: { alias: v.alias, direccion: v.direccion, id_ciudad: Number(v.id_ciudad), telefono: v.telefono, es_principal: v.es_principal } }));
}

// =====================================================================
// PEDIDOS
// =====================================================================
const ESTADOS = ['CREADO', 'PAGADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
const SIGUIENTE = { CREADO: 'PAGADO', PAGADO: 'EN_PREPARACION', EN_PREPARACION: 'ENVIADO', ENVIADO: 'ENTREGADO' };
VISTAS.pedidos = async () => {
  const c = estado.cat; const admin = estado.usuario.rol === 'ADMIN';
  main.innerHTML = `<h2>Pedidos</h2>
    <form id="f-ped" class="fila tarjeta">
      <label>Cliente o número<input name="q" maxlength="60"></label>
      <label>Estado<select name="estado"><option value="">Todos</option>${ESTADOS.map((e) => `<option>${e}</option>`).join('')}</select></label>
      <label>Canal<select name="canal"><option value="">Todos</option><option>TIENDA</option><option>ONLINE</option></select></label>
      ${admin ? `<label>Sucursal<select name="sucursal">${opciones(c.sucursales, 'id_sucursal', 'nombre', 'Todas')}</select></label>` : ''}
      <label>Desde<input type="date" name="desde"></label><label>Hasta<input type="date" name="hasta"></label>
      <button class="primario" type="submit">Filtrar</button></form>
    <div id="ped-res"></div>`;
  const cargar = async (pag = 1) => {
    const p = new URLSearchParams(Object.entries(formDatos($('#f-ped'))).filter(([, x]) => x)); p.set('pagina', pag);
    const d = (await api('/pedidos?' + p)).datos;
    $('#ped-res').innerHTML = tabla([{ t: 'No.' }, { t: 'Fecha' }, { t: 'Cliente' }, { t: 'Sucursal' }, { t: 'Canal' }, { t: 'Estado' }, { t: 'Pago' }, { t: 'Total', num: true }],
      (d.pedidos || []).map((x) => `<tr class="clic" data-ped="${x.id_pedido}"><td>${x.id_pedido}</td><td>${esc(fecha(x.fecha_pedido))}</td><td>${esc(x.cliente)}</td><td>${esc(corto(x.sucursal))}</td><td>${esc(x.canal)}</td><td>${etiquetaEstado(x.estado)}</td><td>${esc(x.metodo_pago || '')}</td><td class="num">${dinero(x.total)}</td></tr>`), 'No hay pedidos con esos filtros')
      + (d.total ? paginacion(d.total, d.pagina, d.por_pagina) : '');
    enlazarPaginacion($('#ped-res'), cargar);
  };
  $('#f-ped').addEventListener('submit', (e) => { e.preventDefault(); cargar(1); });
  $('#ped-res').addEventListener('click', (e) => { const t = e.target.closest('[data-ped]'); if (t) abrirPedido(Number(t.dataset.ped), cargar); });
  cargar(1);
};

async function abrirPedido(id, alCambiar) {
  const r = await api('/pedidos/' + id); if (!r.ok) return aviso(r.datos.mensaje || 'No se encontró el pedido', 'mal');
  const { pedido: p, lineas, pagos } = r.datos;
  const sig = SIGUIENTE[p.estado] || 'CANCELADO';
  abrir(`${cabecera('Pedido ' + p.id_pedido + ' ' + etiquetaEstado(p.estado))}
    <div class="dos"><div class="tarjeta"><p><strong>${esc(p.cliente)}</strong><br><span class="suave">${esc(fecha(p.fecha_pedido))} &middot; ${esc(p.sucursal)}</span></p>
      <p>Canal: ${esc(p.canal)} &middot; Entrega: ${esc(p.tipo_entrega)}${p.direccion_envio ? `<br>Dirección: ${esc(p.direccion_envio)}` : ''}${p.vendedor ? `<br>Atendió: ${esc(p.vendedor)}` : ''}</p></div>
      <div class="tarjeta"><p>Subtotal: ${dinero(p.subtotal)}<br>Descuentos: ${dinero(p.descuento_total)}<br>Envío: ${dinero(p.costo_envio)}<br><strong>Total: ${dinero(p.total)}</strong></p>
      ${pagos.map((x) => `<p class="suave">${esc(x.metodo)} ${dinero(x.monto)} <span class="etiqueta">${esc(x.estado)}</span></p>`).join('')}</div></div>
    <h3>Líneas</h3>
    ${tabla([{ t: '#' }, { t: 'Producto' }, { t: 'Talla' }, { t: 'Color' }, { t: 'Cant.', num: true }, { t: 'Precio', num: true }, { t: 'Desc.', num: true }, { t: 'Subtotal', num: true }, { t: 'Devueltas', num: true }, { t: '' }],
      lineas.map((l) => `<tr><td>${l.num_linea}</td><td>${esc(l.producto)}</td><td>${esc(l.talla)}</td><td>${esc(l.color)}</td><td class="num">${l.cantidad}</td><td class="num">${dinero(l.precio_unitario)}</td><td class="num">${dinero(l.descuento_unitario)}</td><td class="num">${dinero(l.subtotal_linea)}</td><td class="num">${l.cantidad_devuelta}</td>
        <td>${p.estado === 'ENTREGADO' ? `<button type="button" data-devolver="${l.num_linea}">Devolver</button>` : ''}</td></tr>`))}
    <h3>Cambiar estado</h3>
    <form id="f-estado" class="fila"><label>Nuevo estado<select name="estado">${ESTADOS.map((e) => `<option ${e === sig ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
      <button type="submit" class="primario">Aplicar (CALL sp_cambiar_estado_pedido)</button></form>
    <p class="suave">Si elige una transición no permitida (por ejemplo ENTREGADO a PAGADO) el trigger de la base la rechaza y el procedimiento devuelve el código 3.</p>`);
  $('#f-estado').addEventListener('submit', async (e) => { e.preventDefault();
    if (resultado(await api(`/pedidos/${id}/estado`, { metodo: 'POST', cuerpo: { estado: formDatos(e.target).estado } }))) { abrirPedido(id, alCambiar); if (alCambiar) alCambiar(1); } });
  dlg.onclick = async (e) => { const b = e.target.closest('[data-devolver]'); if (!b) return; const linea = lineas.find((l) => l.num_linea === Number(b.dataset.devolver));
    const v = await pedirDatos('Registrar devolución', [{ name: 'cantidad', label: `Cantidad (vendidas: ${linea.cantidad}, devueltas: ${linea.cantidad_devuelta})`, type: 'number', min: 1, value: 1 },
      { name: 'motivo', label: 'Motivo', type: 'select', options: ['TALLA_INCORRECTA', 'DEFECTO', 'NO_ME_GUSTO', 'ERROR_ENVIO', 'OTRO'].map((x) => ({ v: x, t: x })) }], 'Registrar (CALL sp_registrar_devolucion)',
      'Una prenda devuelta por DEFECTO no vuelve al inventario vendible.');
    if (v && resultado(await api(`/pedidos/${id}/devoluciones`, { metodo: 'POST', cuerpo: { num_linea: linea.num_linea, cantidad: Number(v.cantidad), motivo: v.motivo } }))) abrirPedido(id, alCambiar); };
}

// =====================================================================
// CLIENTES
// =====================================================================
VISTAS.clientes = async () => {
  main.innerHTML = `<h2>Clientes</h2><form id="f-cli" class="fila tarjeta"><label>Buscar<input name="q" maxlength="60" placeholder="nombre, documento o correo"></label>
    <button type="submit" class="primario">Buscar</button><button type="button" id="cli-nuevo">Nuevo cliente</button></form><div id="cli-res"></div>`;
  const cargar = async (pag = 1) => {
    const d = (await api(`/clientes?q=${encodeURIComponent(formDatos($('#f-cli')).q)}&pagina=${pag}`)).datos;
    $('#cli-res').innerHTML = tabla([{ t: 'Cliente' }, { t: 'Documento' }, { t: 'Correo' }, { t: 'Nivel' }, { t: 'Puntos', num: true }, { t: 'Pedidos', num: true }],
      (d.clientes || []).map((c) => `<tr class="clic" data-cli="${c.id_cliente}"><td>${esc(c.nombre_completo)}</td><td>${esc(c.tipo_documento)} ${esc(c.documento)}</td><td>${esc(c.email)}</td><td>${esc(c.nivel)}</td><td class="num">${num(c.puntos)}</td><td class="num">${c.num_pedidos}</td></tr>`))
      + (d.total ? paginacion(d.total, d.pagina, d.por_pagina) : '');
    enlazarPaginacion($('#cli-res'), cargar);
  };
  $('#f-cli').addEventListener('submit', (e) => { e.preventDefault(); cargar(1); });
  $('#cli-nuevo').addEventListener('click', async () => { const id = await nuevoCliente(); if (id) { cargar(1); abrirCliente(id); } });
  $('#cli-res').addEventListener('click', (e) => { const t = e.target.closest('[data-cli]'); if (t) abrirCliente(Number(t.dataset.cli)); });
  cargar(1);
};
async function abrirCliente(id) {
  const r = await api('/clientes/' + id); if (!r.ok) return; const { cliente: c, direcciones, pedidos, carrito } = r.datos;
  abrir(`${cabecera(esc(c.nombre_completo))}
    <div class="dos"><div class="tarjeta"><p>${esc(c.tipo_documento)} ${esc(c.documento)}<br>${esc(c.email)}<br>${esc(c.telefono || 'Sin teléfono')}<br><span class="suave">Cliente desde ${esc(fecha(c.fecha_registro).split(',')[0])}</span></p></div>
      <div class="tarjeta"><p><strong>Fidelización:</strong> nivel ${esc(c.nivel)}<br>${num(c.puntos)} puntos (1 punto por cada $1.000 entregados)</p></div></div>
    <h3>Direcciones</h3>${tabla([{ t: 'Alias' }, { t: 'Dirección' }, { t: 'Ciudad' }, { t: '' }], direcciones.map((d) => `<tr><td>${esc(d.alias)}</td><td>${esc(d.direccion)}</td><td>${esc(d.ciudad)}</td><td>${d.es_principal ? '<span class="etiqueta ok">principal</span>' : ''}</td></tr>`), 'Sin direcciones')}
    <div class="fila"><button type="button" id="cl-dir">Agregar dirección</button></div>
    <h3>Últimos pedidos</h3>${tabla([{ t: 'No.' }, { t: 'Fecha' }, { t: 'Canal' }, { t: 'Estado' }, { t: 'Total', num: true }], pedidos.map((p) => `<tr class="clic" data-ped="${p.id_pedido}"><td>${p.id_pedido}</td><td>${esc(fecha(p.fecha_pedido))}</td><td>${esc(p.canal)}</td><td>${etiquetaEstado(p.estado)}</td><td class="num">${dinero(p.total)}</td></tr>`), 'Sin pedidos')}
    <h3>Carrito activo <span class="suave">(MongoDB)</span></h3>${carrito && carrito.items.length ? tabla([{ t: 'SKU' }, { t: 'Producto' }, { t: 'Cant.', num: true }], carrito.items.map((i) => `<tr><td>${esc(i.sku)}</td><td>${esc(i.nombre)}</td><td class="num">${i.cantidad}</td></tr>`)) : '<p class="suave">Sin carrito activo</p>'}`);
  $('#cl-dir').addEventListener('click', async () => { if (await nuevaDireccion(id)) abrirCliente(id); });
  dlg.onclick = (e) => { const t = e.target.closest('[data-ped]'); if (t) abrirPedido(Number(t.dataset.ped)); };
}

// =====================================================================
// INVENTARIO (PostgreSQL)
// =====================================================================
VISTAS.inventario = async () => {
  const c = estado.cat; const admin = estado.usuario.rol === 'ADMIN'; const online = c.sucursales.find((s) => s.tipo === 'ONLINE');
  main.innerHTML = `<h2>Inventario</h2>
    <form id="f-inv" class="fila tarjeta"><label>Buscar variante (nombre, color o SKU)<input name="q" maxlength="60"></label>
      <label>Sucursal<select name="sucursal">${opciones(c.sucursales, 'id_sucursal', 'nombre', 'Todas')}</select></label><button class="primario" type="submit">Buscar</button></form>
    <div id="inv-res"></div>
    <h3>Alertas de stock bajo</h3>
    <div class="fila"><label>Sucursal<select id="bajo-suc">${opciones(c.sucursales.filter((s) => s.tipo === 'FISICA'), 'id_sucursal', 'nombre', 'Todas las tiendas')}</select></label>
      ${admin ? '<button type="button" id="btn-reponer">Reponer desde la bodega (CALL sp_reponer_stock_bajo)</button>' : ''}</div>
    <div id="bajo-res"></div>`;
  const filaInv = (f, acciones) => `<tr><td>${esc(f.sku)}</td><td>${esc(f.producto)}</td><td>${esc(f.color)}</td><td>${esc(f.talla)}</td><td>${esc(corto(f.sucursal))}</td>
      <td class="num">${f.stock}${f.stock <= f.stock_minimo ? ' <span class="etiqueta mal">bajo</span>' : ''}</td><td class="num">${f.stock_minimo}</td>
      <td>${acciones ? `<button type="button" data-aj="${f.id_variante}|${f.id_sucursal}" data-etq="${esc(f.sku)}">Ajustar</button> <button type="button" data-tr="${f.id_variante}|${f.id_sucursal}" data-etq="${esc(f.sku)}">Transferir</button> ` : ''}<button type="button" data-kx="${esc(f.sku)}">Kardex</button></td></tr>`;
  const cab = [{ t: 'SKU' }, { t: 'Producto' }, { t: 'Color' }, { t: 'Talla' }, { t: 'Sucursal' }, { t: 'Stock', num: true }, { t: 'Mínimo', num: true }, { t: '' }];
  const buscar = async () => { const f = formDatos($('#f-inv')); const d = (await api(`/inventario/buscar?q=${encodeURIComponent(f.q)}&sucursal=${f.sucursal}`)).datos;
    $('#inv-res').innerHTML = tabla(cab, (d.filas || []).map((x) => filaInv(x, admin)), 'Escriba un término de búsqueda'); };
  const bajo = async () => { const d = (await api('/inventario/bajo?sucursal=' + $('#bajo-suc').value)).datos;
    $('#bajo-res').innerHTML = `<p class="suave">${num(d.total || 0)} variantes en alerta (se muestran las 50 con menos stock)</p>` + tabla(cab, (d.filas || []).map((x) => filaInv(x, admin)), 'Sin alertas'); };
  $('#f-inv').addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
  $('#bajo-suc').addEventListener('change', bajo);
  main.addEventListener('click', async (e) => {
    const aj = e.target.closest('[data-aj]'); const tr = e.target.closest('[data-tr]'); const kx = e.target.closest('[data-kx]');
    if (aj) { const [vid, sid] = aj.dataset.aj.split('|').map(Number);
      const v = await pedirDatos('Ajustar inventario ' + aj.dataset.etq, [{ name: 'delta', label: 'Cambio (positivo suma, negativo resta)', type: 'number', value: 10 },
        { name: 'tipo', label: 'Tipo', type: 'select', options: [{ v: 'ENTRADA_COMPRA', t: 'Entrada de compra' }, { v: 'AJUSTE', t: 'Ajuste manual' }] }], 'Aplicar (CALL sp_ajustar_stock)');
      if (v && resultado(await api('/inventario/ajuste', { metodo: 'POST', cuerpo: { id_sucursal: sid, id_variante: vid, delta: Number(v.delta), tipo: v.tipo } }))) { buscar(); bajo(); } }
    if (tr) { const [vid, sid] = tr.dataset.tr.split('|').map(Number);
      const v = await pedirDatos('Transferir ' + tr.dataset.etq, [{ name: 'destino', label: 'Sucursal destino', type: 'select', options: c.sucursales.filter((s) => s.id_sucursal !== sid).map((s) => ({ v: s.id_sucursal, t: s.nombre })) },
        { name: 'cantidad', label: 'Cantidad', type: 'number', min: 1, value: 1 }], 'Transferir (CALL sp_transferir_stock)', `Origen: ${esc(corto((c.sucursales.find((s) => s.id_sucursal === sid) || {}).nombre))}`);
      if (v && resultado(await api('/inventario/transferencia', { metodo: 'POST', cuerpo: { origen: sid, destino: Number(v.destino), id_variante: vid, cantidad: Number(v.cantidad) } }))) { buscar(); bajo(); } }
    if (kx) { const d = (await api('/kardex?sku=' + encodeURIComponent(kx.dataset.kx))).datos;
      abrir(cabecera('Kardex ' + esc(kx.dataset.kx)) + tabla([{ t: 'Fecha' }, { t: 'Sucursal' }, { t: 'Movimiento' }, { t: 'Cantidad', num: true }, { t: 'Stock resultante', num: true }, { t: 'Usuario BD' }],
        (d.filas || []).map((m) => `<tr><td>${esc(fecha(m.fecha))}</td><td>${esc(corto(m.sucursal))}</td><td>${esc(m.tipo)}</td><td class="num">${m.cantidad}</td><td class="num">${m.stock_resultante}</td><td>${esc(m.usuario_bd)}</td></tr>`))
        + '<p class="suave">Cada fila la genera un trigger al cambiar el stock.</p>'); } });
  const rep = $('#btn-reponer'); if (rep) rep.addEventListener('click', async () => {
    const dest = Number($('#bajo-suc').value); if (!dest) return aviso('Elija una tienda concreta para reponer', 'mal');
    if (resultado(await api('/inventario/reposicion', { metodo: 'POST', cuerpo: { destino: dest, origen: online.id_sucursal } }))) bajo(); });
  bajo();
};

// =====================================================================
// REPORTES (PostgreSQL + MongoDB)
// =====================================================================
VISTAS.reportes = async () => {
  const [res, mes, suc, top, web] = await Promise.all([api('/reportes/resumen'), api('/reportes/ventas-mensuales'), api('/reportes/sucursales?dias=30'), api('/reportes/top-productos?dias=90'), api('/reportes/web')]);
  const k = res.datos; const w = web.datos;
  const meses = {}; for (const f of mes.datos.filas || []) { (meses[f.mes] = meses[f.mes] || { mes: f.mes, total: 0 }).total += Number(f.venta); meses[f.mes][f.canal] = Number(f.venta); }
  main.innerHTML = `<h2>Reportes</h2>
    <div class="kpis">
      <div class="kpi"><div class="suave">Ventas netas, 30 días</div><div class="valor">${dinero(k.ventas_30d)}</div><div class="nota">${k.variacion_pct === null ? '' : `${k.variacion_pct > 0 ? '+' : ''}${k.variacion_pct}% vs 30 días previos`}</div></div>
      <div class="kpi"><div class="suave">Pedidos, 30 días</div><div class="valor">${num(k.pedidos_30d)}</div><div class="nota">PostgreSQL</div></div>
      <div class="kpi"><div class="suave">Variantes con stock bajo</div><div class="valor">${num(k.variantes_stock_bajo)}</div><div class="nota">en tiendas físicas</div></div>
      <div class="kpi"><div class="suave">Calificación promedio</div><div class="valor">${k.calificacion_promedio ?? '-'}</div><div class="nota">${num(k.resenas)} reseñas (MongoDB)</div></div>
      <div class="kpi"><div class="suave">Sesiones web, 30 días</div><div class="valor">${num(k.sesiones_web_30d)}</div><div class="nota">MongoDB</div></div>
      <div class="kpi"><div class="suave">Clientes nivel ORO</div><div class="valor">${num(k.clientes_oro)}</div><div class="nota">fidelizacion</div></div></div>
    <div class="dos">
      <section class="tarjeta"><h3>Ventas netas por mes</h3>${barras(Object.values(meses), 'mes', 'total', dinero) || '<p class="suave">Sin datos</p>'}</section>
      <section class="tarjeta"><h3>Ventas por sucursal (30 días)</h3>${tabla([{ t: 'Sucursal' }, { t: 'Pedidos', num: true }, { t: 'Unidades', num: true }, { t: 'Venta', num: true }], (suc.datos.filas || []).map((f) => `<tr><td>${esc(corto(f.sucursal))}</td><td class="num">${f.pedidos}</td><td class="num">${f.unidades}</td><td class="num">${dinero(f.venta)}</td></tr>`))}</section>
      <section class="tarjeta"><h3>Top 10 productos (90 días)</h3>${tabla([{ t: '#' }, { t: 'Producto' }, { t: 'Unidades', num: true }, { t: 'Ingresos', num: true }], (top.datos.filas || []).map((f) => `<tr><td>${f.puesto}</td><td>${esc(f.nombre)}</td><td class="num">${f.unidades}</td><td class="num">${dinero(f.ingresos)}</td></tr>`))}</section>
      <section class="tarjeta"><h3>Embudo de conversión web <span class="suave">(sesiones)</span></h3>${barras(w.embudo || [], 'etapa', 'sesiones')}
        <p class="suave">${(w.embudo || []).filter((e) => e.pct_etapa_anterior !== null).map((e) => `${esc(e.etapa)}: ${e.pct_etapa_anterior}% de la etapa anterior`).join(' &middot; ')}</p></section>
      <section class="tarjeta"><h3>Búsquedas más frecuentes</h3>${tabla([{ t: 'Término' }, { t: 'Veces', num: true }, { t: 'Sin resultados', num: true }], (w.busquedas || []).map((b) => `<tr><td>${esc(b.termino)}</td><td class="num">${b.veces}</td><td class="num">${b.sin_resultados}</td></tr>`))}</section>
      <section class="tarjeta"><h3>Mejor calificados <span class="suave">(mínimo 15 reseñas)</span></h3>${tabla([{ t: 'Producto' }, { t: 'Promedio', num: true }, { t: 'Reseñas', num: true }], (w.mejores_calificados || []).map((m) => `<tr><td>${esc(m.producto)}</td><td class="num">${m.promedio}</td><td class="num">${m.resenas}</td></tr>`))}</section>
      <section class="tarjeta"><h3>Tráfico por hora (hora de Bogotá)</h3>${barras(w.trafico_por_hora || [], 'hora', 'vistas')}</section>
    </div>`;
  aplicarAnchos(main);
};

// =====================================================================
// ADMINISTRACION
// =====================================================================
VISTAS.admin = async () => {
  const c = estado.cat; const hojas = c.categorias.filter((x) => x.nivel >= 2);
  main.innerHTML = `<h2>Administración</h2>
    <div class="dos">
      <section class="tarjeta"><h3>Crear producto</h3><p class="suave">Crea el producto y todas sus variantes en PostgreSQL (CALL sp_crear_producto) y su ficha en MongoDB.</p>
        <form id="f-prod" class="fila"><label class="ancho">Nombre<input name="nombre" required maxlength="120"></label>
          <label>Categoría<select name="id_categoria">${hojas.map((x) => `<option value="${x.id_categoria}">${esc(x.ruta)}</option>`).join('')}</select></label>
          <label>Marca<select name="id_marca">${opciones(c.marcas, 'id_marca', 'nombre')}</select></label>
          <label>Género<select name="genero">${GENEROS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
          <label>Precio (COP)<input name="precio" type="number" min="1000" step="100" required></label>
          <label class="ancho">Tallas (separadas por coma)<input name="tallas" required value="S,M,L"></label>
          <label class="ancho">Colores (separados por coma)<input name="colores" required value="Negro,Blanco"></label>
          <label>Material<input name="material" maxlength="60"></label><label>Estilo<input name="estilo" maxlength="60"></label>
          <label class="ancho">Descripción<input name="descripcion" maxlength="500"></label>
          <button class="primario" type="submit">Crear producto</button></form></section>
      <section class="tarjeta"><h3>Precios</h3>
        <form id="f-precio" class="fila"><label>ID de producto<input name="id" type="number" min="1" required></label><label>Nuevo precio<input name="precio" type="number" step="100" required></label>
          <button type="submit">Actualizar (CALL sp_actualizar_precio)</button></form>
        <form id="f-masivo" class="fila"><label>Categoría (incluye subcategorías)<select name="id_categoria">${c.categorias.map((x) => `<option value="${x.id_categoria}">${'&nbsp;&nbsp;'.repeat(x.nivel - 1)}${esc(x.nombre)}</option>`).join('')}</select></label>
          <label>Porcentaje<input name="porcentaje" type="number" step="0.5" required value="5"></label>
          <button type="submit">Ajuste masivo (CALL sp_ajuste_masivo_precios)</button></form>
        <p class="suave">El ajuste masivo usa COMMIT y ROLLBACK explícitos: si algún precio supera $1.500.000, o queda en cero, se deshace todo.</p></section>
    </div>
    <div class="dos"><section><h3>Promociones</h3><div id="ad-promo"></div></section><section><h3>Auditoría de precios <span class="suave">(trigger)</span></h3><div id="ad-aud"></div></section></div>
    <h3>Bitácora de errores de procedimientos</h3><div id="ad-bit"></div>`;
  $('#f-prod').addEventListener('submit', async (e) => { e.preventDefault(); const f = formDatos(e.target); const lista = (t) => t.split(',').map((x) => x.trim()).filter(Boolean);
    const atributos = {}; if (f.material) atributos.material = f.material; if (f.estilo) atributos.estilo = f.estilo;
    const r = await api('/admin/productos', { metodo: 'POST', cuerpo: { nombre: f.nombre, descripcion: f.descripcion, id_categoria: Number(f.id_categoria), id_marca: Number(f.id_marca), genero: f.genero,
      precio: Number(f.precio), tallas: lista(f.tallas), colores: lista(f.colores), atributos } });
    if (resultado(r)) e.target.reset(); cargarBit(1); });
  $('#f-precio').addEventListener('submit', async (e) => { e.preventDefault(); const f = formDatos(e.target);
    resultado(await api(`/admin/productos/${Number(f.id)}/precio`, { metodo: 'PUT', cuerpo: { precio: Number(f.precio) } })); cargarAud(); cargarBit(1); });
  $('#f-masivo').addEventListener('submit', async (e) => { e.preventDefault(); const f = formDatos(e.target);
    resultado(await api('/admin/precios/ajuste-masivo', { metodo: 'POST', cuerpo: { id_categoria: Number(f.id_categoria), porcentaje: Number(f.porcentaje) } })); cargarAud(); cargarBit(1); });
  const cargarAud = async () => { const d = (await api('/admin/auditoria-precios')).datos; $('#ad-aud').innerHTML = tabla([{ t: 'Fecha' }, { t: 'Producto' }, { t: 'Antes', num: true }, { t: 'Después', num: true }, { t: '%', num: true }],
    (d.filas || []).slice(0, 8).map((a) => `<tr><td>${esc(fecha(a.fecha))}</td><td>${esc(a.producto)}</td><td class="num">${dinero(a.precio_anterior)}</td><td class="num">${dinero(a.precio_nuevo)}</td><td class="num">${a.variacion_pct}</td></tr>`), 'Sin cambios de precio registrados'); };
  const cargarBit = async (pag = 1) => { const d = (await api('/admin/bitacora?pagina=' + pag)).datos; $('#ad-bit').innerHTML = tabla([{ t: 'Fecha' }, { t: 'Procedimiento' }, { t: 'Código', num: true }, { t: 'Mensaje' }, { t: 'SQLSTATE' }, { t: 'Usuario BD' }],
    (d.filas || []).map((b) => `<tr><td>${esc(fecha(b.fecha))}</td><td>${esc(b.procedimiento)}</td><td class="num">${b.codigo}</td><td>${esc(b.mensaje)}</td><td>${esc(b.sqlstate_error || '')}</td><td>${esc(b.usuario_bd)}</td></tr>`), 'Sin errores registrados')
    + (d.total ? paginacion(d.total, d.pagina, 20) : ''); enlazarPaginacion($('#ad-bit'), cargarBit); };
  const pr = (await api('/admin/promociones')).datos; $('#ad-promo').innerHTML = tabla([{ t: 'Promoción' }, { t: 'Descuento' }, { t: 'Vigencia' }, { t: 'Estado' }],
    (pr.filas || []).map((p) => `<tr><td>${esc(p.nombre)} <span class="suave">(${p.productos} prod.)</span></td><td>${p.tipo_descuento === 'PORCENTAJE' ? Number(p.valor) + '%' : dinero(p.valor)}</td><td>${esc(p.fecha_inicio.slice(0, 10))} a ${esc(p.fecha_fin.slice(0, 10))}</td><td>${p.vigente_hoy ? '<span class="etiqueta ok">vigente</span>' : '<span class="etiqueta">fuera de fecha</span>'}</td></tr>`));
  cargarAud(); cargarBit(1);
};

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------
(async () => {
  const r = await api('/yo');
  if (r.datos.ok) iniciarApp(r.datos.usuario); else mostrarLogin();
})();
