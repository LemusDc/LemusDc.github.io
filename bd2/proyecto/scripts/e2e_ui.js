// Prueba de extremo a extremo de la interfaz con un navegador real (Playwright + Chrome).
// Recorre los flujos principales, comprueba resultados y guarda capturas en docs/capturas.
// Uso: BASE_URL=http://localhost:3100 NODE_PATH=/opt/npm-tools/node_modules node scripts/e2e_ui.js
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const CAP = path.join(__dirname, '..', 'docs', 'capturas');
const fallos = []; let pasos = 0;
const ok = (cond, msg) => { pasos++; if (!cond) { fallos.push(msg); console.log('  FALLO:', msg); } else console.log('  ok:', msg); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'es-CO' });
  const page = await ctx.newPage();
  const consola = []; page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consola.push(m.text()); });
  page.on('pageerror', (e) => consola.push('pageerror: ' + e.message));
  const cap = (n) => page.screenshot({ path: path.join(CAP, n + '.png') });

  console.log('Login'); await page.goto(BASE);
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'incorrecta'); await page.click('#form-login button[type=submit]');
  await page.waitForSelector('#login-error:not(:empty)'); ok((await page.textContent('#login-error')).includes('incorrectos'), 'credenciales incorrectas se rechazan');
  await page.fill('input[name=password]', 'Admin2026*'); await page.click('#form-login button[type=submit]');
  await page.waitForSelector('#app:not([hidden])'); ok(true, 'ingreso como administrador');

  console.log('Catálogo'); await page.waitForSelector('.carta'); ok((await page.$$('.carta')).length === 12, 'catalogo muestra 12 productos por pagina');
  await cap('01_catalogo');
  await page.fill('#f-cat input[name=q]', 'jean'); await page.click('#f-cat button[type=submit]'); await page.waitForTimeout(600);
  ok((await page.$$('.carta')).length === 8, 'busqueda "jean" devuelve 8 productos');
  await page.click('.carta >> nth=0'); await page.waitForSelector('#dlg[open] .ficha'); await page.waitForTimeout(500);
  ok((await page.textContent('#dlg')).includes('Ficha técnica'), 'ficha con atributos de MongoDB');
  ok((await page.textContent('#dlg')).includes('Disponibilidad por variante'), 'variantes y stock de PostgreSQL');
  ok((await page.$$('#lista-res .resena')).length >= 1, 'resenas de MongoDB visibles');
  await cap('02_producto'); await page.click('#dlg [data-accion=cerrar]');

  console.log('Nueva venta'); await page.click('[data-ir=venta]'); await page.waitForSelector('#v-buscar');
  await page.fill('#v-buscar input[name=q]', 'ana'); await page.click('#v-buscar button[type=submit]'); await page.waitForSelector('[data-elegir]');
  await page.click('[data-elegir] >> nth=0'); await page.waitForTimeout(500);
  ok((await page.textContent('#v-cliente-sel')).includes('nivel'), 'cliente seleccionado');
  await page.selectOption('#v-canal', 'TIENDA'); await page.fill('#v-prod input[name=q]', 'camiseta basica'); await page.click('#v-prod button[type=submit]');
  await page.waitForSelector('[data-add]');
  const fila = await page.$$eval('#v-prod-res tbody tr', (trs) => trs.findIndex((t) => Number(t.children[5].textContent) >= 3));
  ok(fila >= 0, 'hay una variante con stock suficiente en la sucursal'); await page.click(`#v-prod-res tbody tr >> nth=${fila} >> [data-add]`); await page.waitForTimeout(400);
  ok((await page.$$('#v-carrito tbody tr')).length >= 1, 'producto agregado al carrito (MongoDB)');
  await cap('03_venta');
  await page.click('#v-confirmar'); await page.waitForSelector('#v-resultado p'); await page.waitForTimeout(400);
  const res = await page.textContent('#v-resultado'); ok(res.includes('Código de retorno: 0'), 'sp_crear_pedido devuelve codigo 0: ' + res.trim().slice(0, 80));
  const idPed = (await page.getAttribute('[data-ver-pedido]', 'data-ver-pedido'));

  console.log('Venta rechazada por stock'); await page.fill('#v-prod input[name=q]', 'jean slim'); await page.click('#v-prod button[type=submit]');
  await page.waitForSelector('[data-add]'); for (let i = 0; i < 20; i++) await page.click('[data-add] >> nth=0');
  await page.waitForTimeout(300); await page.click('#v-confirmar'); await page.waitForTimeout(800);
  const res2 = await page.textContent('#v-resultado'); ok(/Código de retorno: 2/.test(res2), 'stock insuficiente devuelve codigo 2');
  await cap('04_venta_error');

  console.log('Pedidos'); await page.click('[data-ir=pedidos]'); await page.waitForSelector('[data-ped]');
  await page.fill('#f-ped input[name=q]', idPed); await page.click('#f-ped button[type=submit]'); await page.waitForTimeout(500);
  await page.click('[data-ped] >> nth=0'); await page.waitForSelector('#dlg[open] #f-estado');
  await page.selectOption('#f-estado select', 'PAGADO'); await page.click('#f-estado button'); await page.waitForTimeout(600);
  ok(/Código 3:/.test(await page.textContent('#avisos')), 'transicion invalida rechazada con codigo 3');
  await cap('05_pedido'); await page.click('#dlg [data-accion=cerrar]');

  console.log('Evidencia'); await page.click('#btn-evidencia'); await page.waitForTimeout(2500);
  const ev = await page.textContent('#ev-lista'); ok(ev.includes('CALL sp_crear_pedido') && ev.includes('MongoDB'), 'panel de evidencia muestra CALL y operaciones de MongoDB');
  await cap('06_evidencia'); await page.click('#btn-evidencia');

  console.log('Inventario / Reportes / Admin');
  await page.click('[data-ir=inventario]'); await page.waitForSelector('#bajo-res table'); await cap('07_inventario');
  await page.click('[data-ir=reportes]'); await page.waitForSelector('.kpi'); await page.waitForTimeout(500); ok((await page.$$('.kpi')).length === 6, 'reportes: 6 indicadores'); await cap('08_reportes');
  await page.click('[data-ir=admin]'); await page.waitForSelector('#f-prod'); await page.waitForTimeout(500);
  await page.selectOption('#f-masivo select', { label: 'Ropa' }); await page.fill('#f-masivo input[name=porcentaje]', '1000'); await page.click('#f-masivo button'); await page.waitForFunction(() => /El ajuste dejaria|Se ajustaron/.test(document.querySelector("#avisos").textContent), null, { timeout: 8000 }).catch(() => {});
  const txt = await page.textContent('#avisos');
  ok(/Código 5: El ajuste dejaria precios/.test(txt), 'ajuste masivo excesivo hace ROLLBACK (codigo 5)' + (/Código 5: El ajuste/.test(txt) ? '' : ' -> avisos: ' + txt.slice(0, 200)));
  await cap('09_admin');

  console.log('Rol vendedor'); await page.click('#btn-salir'); await page.waitForSelector('#form-login');
  await page.fill('input[name=username]', 'vendedor1'); await page.fill('input[name=password]', 'Vende2026*'); await page.click('#form-login button[type=submit]');
  await page.waitForSelector('#app:not([hidden])'); const menu = (await page.textContent('#menu'));
  ok(menu.includes('Pedidos') && !menu.includes('Reportes') && !menu.includes('Administración'), 'el vendedor no ve Reportes ni Administracion');
  await page.click('[data-ir=pedidos]'); await page.waitForSelector('[data-ped]'); await page.waitForTimeout(400);
  const sucursales = await page.$$eval('#ped-res tbody tr td:nth-child(4)', (tds) => [...new Set(tds.map((t) => t.textContent))]);
  ok(sucursales.length === 1, 'el vendedor solo ve pedidos de su sucursal: ' + sucursales.join(','));

  const csp = consola.filter((c) => /Content Security Policy|Refused|pageerror/i.test(c));
  ok(csp.length === 0, 'sin errores de CSP ni de JavaScript' + (csp.length ? ': ' + csp.slice(0, 3).join(' | ') : ''));
  console.log(`\n${pasos - fallos.length}/${pasos} comprobaciones correctas`);
  await browser.close(); process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
