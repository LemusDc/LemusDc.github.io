// =====================================================================
// Proyecto Final Bases de Datos 2 - Tienda de Ropa
// Archivo : seed/siluetas.js
// Autores : Juan Diego Mateus, Diego Lemus
// Fecha   : 2026-11-05
// Descripcion: genera las ilustraciones SVG de los productos (una silueta propia
//   por tipo de prenda, pintada con el color de la variante). Son ilustraciones
//   de marcador de posicion: se guardan en MongoDB (GridFS) como si fueran fotos.
//   La silueta se elige segun la categoria y el nombre del producto.
// =====================================================================

// ---- Elige la silueta segun categoria y nombre ----
function tipoSilueta(nombre, categoria) {
  const n = String(nombre || '').toLowerCase();
  switch (categoria) {
    case 'Camisetas': return n.includes('polo') ? 'polo' : 'camiseta';
    case 'Camisas': return 'camisa';
    case 'Blusas': return 'blusa';
    case 'Buzos y Sudaderas': return n.includes('hoodie') ? 'hoodie' : 'buzo';
    case 'Jeans': return 'jean';
    case 'Pantalones': return n.includes('jogger') ? 'jogger' : n.includes('palazzo') ? 'palazzo' : 'pantalon';
    case 'Shorts': return n.includes('bermuda') ? 'bermuda' : 'short';
    case 'Faldas': return 'falda';
    case 'Vestidos y Enterizos': return n.includes('enterizo') ? 'enterizo' : 'vestido';
    case 'Chaquetas': return n.includes('jean') ? 'chaqueta_jean' : 'chaqueta';
    case 'Gabardinas y Paños': return n.includes('abrigo') ? 'abrigo' : 'gabardina';
    case 'Deportiva':
      if (n.includes('legging')) return 'legging';
      if (n.includes('top')) return 'top';
      if (n.includes('pantaloneta')) return 'pantaloneta';
      return 'camiseta';
    case 'Ropa Interior y Dormir': return n.includes('pijama') ? 'pijama' : 'boxer';
    case 'Gorras y Sombreros': return 'gorra';
    case 'Cinturones': return 'cinturon';
    case 'Bolsos': return n.includes('bandolera') ? 'bandolera' : 'tote';
    default: return 'camiseta';
  }
}

// ---- Piezas reutilizables (lienzo de 300 x 380) ----
// Combina atributos por defecto con los extra (los extra ganan) para no repetir atributos en el SVG
function atr(base, extra) {
  const m = new Map(); const rx = /([\w-]+)="([^"]*)"/g; let r;
  for (const txt of [base, extra || '']) while ((r = rx.exec(txt))) m.set(r[1], r[2]);
  return [...m].map(([k, v]) => `${k}="${v}"`).join(' ');
}
const L = (d, extra = '') => `<path d="${d}" ${atr('fill="none" stroke="DET" stroke-width="2" stroke-linecap="round"', extra)}/>`;
const P = (d, extra = '') => `<path d="${d}" ${atr('fill="FILL" stroke="#555" stroke-width="2" stroke-linejoin="round"', extra)}/>`;
const botones = (xs, ys) => ys.map((y) => `<circle cx="${xs}" cy="${y}" r="3" fill="DET"/>`).join('');

function pantalon({ o = 65, i = 8, y0 = 60, y1 = 335, cintura = 95, bolsillos = true, bragueta = true, punos = false } = {}) {
  const xl = 150 - o, xr = 150 + o, il = 150 - i, ir = 150 + i;
  let s = P(`M${cintura} ${y0} L${300 - cintura} ${y0} L${xr} ${y1} L${ir} ${y1} L150 ${y0 + 72} L${il} ${y1} L${xl} ${y1} Z`);
  s += L(`M${cintura} ${y0 + 20} L${300 - cintura} ${y0 + 20}`);
  if (bragueta) s += L(`M150 ${y0 + 20} L150 ${y0 + 72}`);
  if (bolsillos) s += L(`M${cintura + 3} ${y0 + 22} Q${cintura + 22} ${y0 + 55} ${cintura + 38} ${y0 + 30}`) + L(`M${300 - cintura - 3} ${y0 + 22} Q${300 - cintura - 22} ${y0 + 55} ${300 - cintura - 38} ${y0 + 30}`);
  if (punos) s += L(`M${xl} ${y1 - 22} L${il} ${y1 - 22}`) + L(`M${ir} ${y1 - 22} L${xr} ${y1 - 22}`);
  return s;
}

function mangaLarga({ y1 = 335, largo = 275, cuello = 'redondo' } = {}) {
  const cu = cuello === 'v' ? 'L150 95 L200 62' : 'Q150 92 200 62';
  return P(`M100 62 ${cu} L245 82 L272 ${largo} L240 ${largo + 7} L216 150 L216 ${y1} L84 ${y1} L84 150 L60 ${largo + 7} L28 ${largo} L55 82 Z`);
}

// ---- Siluetas por tipo ----
const FORMAS = {
  camiseta: () => P('M95 60 L60 85 L30 150 L70 170 L85 140 L85 330 L215 330 L215 140 L230 170 L270 150 L240 85 L205 60 Q150 100 95 60 Z')
    + L('M110 64 Q150 104 190 64'),
  polo: () => FORMAS.camiseta() + P('M100 62 L150 112 L128 80 Z', 'opacity=".9"') + P('M200 62 L150 112 L172 80 Z', 'opacity=".9"')
    + L('M150 112 L150 160') + botones(150, [125, 145]),
  camisa: () => mangaLarga({ cuello: 'v' }) + P('M100 62 L122 100 L150 92 Z') + P('M200 62 L178 100 L150 92 Z')
    + L('M150 92 L150 335') + botones(150, [128, 168, 208, 248, 288])
    + L('M30 262 L62 270') + L('M270 262 L238 270') + L('M96 122 L122 122 L122 148 L96 148 Z'),
  blusa: () => P('M100 62 Q150 96 200 62 L245 82 L272 275 L240 282 L216 150 L226 335 Q150 348 74 335 L84 150 L60 282 L28 275 L55 82 Z')
    + L('M110 64 Q150 100 190 64') + L('M30 262 L62 270') + L('M270 262 L238 270') + L('M92 300 Q150 318 208 300'),
  buzo: () => mangaLarga({ y1: 335, largo: 278 }) + L('M84 312 L216 312') + L('M31 264 L64 273') + L('M269 264 L236 273')
    + L('M106 63 Q150 100 194 63') + L('M112 66 Q150 96 188 66'),
  hoodie: () => mangaLarga({ y1: 335, largo: 278 }) + P('M104 64 Q150 12 196 64 Q150 98 104 64 Z')
    + L('M132 92 L132 140') + L('M168 92 L168 140') + L('M84 314 L216 314')
    + L('M112 238 L188 238 L196 296 L104 296 Z') + L('M31 264 L64 273') + L('M269 264 L236 273'),
  chaqueta: () => mangaLarga({ y1: 330, largo: 280 }) + P('M100 62 L118 52 L150 70 L182 52 L200 62 L184 92 L150 84 L116 92 Z')
    + L('M150 84 L150 330') + L('M84 308 L216 308') + L('M104 230 L104 262') + L('M196 230 L196 262')
    + L('M31 266 L64 275') + L('M269 266 L236 275'),
  chaqueta_jean: () => FORMAS.chaqueta() + L('M100 112 L134 112 L134 142 L100 142 Z') + L('M200 112 L166 112 L166 142 L200 142 Z')
    + L('M90 170 L210 170', 'stroke-dasharray="4 4"') + L('M90 300 L210 300', 'stroke-dasharray="4 4"'),
  gabardina: () => P('M100 56 L55 78 L26 282 L58 290 L82 160 L74 338 L226 338 L218 160 L242 290 L274 282 L245 78 L200 56 L150 108 Z')
    + P('M100 56 L142 200 L118 110 Z') + P('M200 56 L158 200 L182 110 Z') + L('M150 108 L150 338')
    + P('M82 214 L218 214 L218 230 L82 230 Z') + P('M140 211 L160 211 L160 233 L140 233 Z', 'fill-opacity=".4"')
    + L('M32 268 L62 276') + L('M268 268 L238 276'),
  abrigo: () => P('M100 56 L55 78 L26 282 L58 290 L82 160 L74 338 L226 338 L218 160 L242 290 L274 282 L245 78 L200 56 L150 108 Z')
    + P('M100 56 L146 220 L116 112 Z') + P('M200 56 L154 220 L184 112 Z') + L('M150 108 L150 338')
    + botones(136, [190, 240, 290]) + botones(164, [190, 240, 290]) + L('M32 268 L62 276') + L('M268 268 L238 276')
    + L('M96 300 L128 300') + L('M172 300 L204 300'),
  jean: () => pantalon({ o: 62 }) + L('M96 120 L96 330', 'stroke-dasharray="3 5" opacity=".5"'),
  pantalon: () => pantalon({ o: 60 }),
  palazzo: () => pantalon({ o: 98, y1: 340 }),
  jogger: () => pantalon({ o: 58, bragueta: false, punos: true }) + L('M140 82 L160 82'),
  legging: () => pantalon({ o: 48, i: 6, y0: 64, y1: 338, cintura: 100, bolsillos: false, bragueta: false }),
  short: () => P('M95 110 L205 110 L225 250 L158 250 L150 180 L142 250 L75 250 Z') + L('M95 130 L205 130')
    + L('M150 130 L150 180') + L('M98 132 Q116 160 130 140') + L('M202 132 Q184 160 170 140'),
  bermuda: () => P('M92 100 L208 100 L232 280 L158 280 L150 172 L142 280 L68 280 Z') + L('M92 122 L208 122') + L('M150 122 L150 172')
    + L('M84 190 L118 190 L118 232 L84 232 Z') + L('M216 190 L182 190 L182 232 L216 232 Z') + botones(101, [200]) + botones(199, [200]),
  pantaloneta: () => P('M95 105 L205 105 L228 255 L158 255 L150 160 L142 255 L72 255 Z') + L('M95 125 L205 125')
    + L('M142 125 L142 160') + L('M158 125 L158 160') + L('M228 255 L158 255', 'stroke-dasharray="3 4"'),
  falda: () => P('M108 78 L192 78 L252 332 L48 332 Z') + L('M108 98 L192 98')
    + [0, 1, 2, 3, 4, 5, 6].map((k) => L(`M${112 + k * 12} 98 L${70 + k * 26.7} 332`, 'opacity=".55"')).join(''),
  vestido: () => P('M116 54 L132 54 L150 94 L168 54 L184 54 L190 132 L196 168 L258 340 L42 340 L104 168 L110 132 Z')
    + L('M110 168 L190 168') + L('M104 132 L196 132', 'opacity=".5"') + botones(150, [110, 130]),
  enterizo: () => P('M118 54 L132 54 L150 90 L168 54 L182 54 L188 150 L192 172 L228 346 L158 346 L150 232 L142 346 L72 346 L108 172 L112 150 Z')
    + L('M108 172 L192 172') + L('M150 90 L150 232') + L('M110 150 L190 150', 'opacity=".5"'),
  top: () => P('M110 150 L122 112 Q150 140 178 112 L190 150 L186 232 Q150 250 114 232 Z') + L('M122 112 L128 78', 'stroke="#555" stroke-width="5"') + L('M178 112 L172 78', 'stroke="#555" stroke-width="5"')
    + L('M116 232 Q150 252 184 232') + L('M114 196 Q150 212 186 196', 'opacity=".5"'),
  pijama: () => `<g transform="translate(67.5 -5) scale(.55)">${FORMAS.camiseta()}</g><g transform="translate(67.5 157) scale(.55)">${pantalon({ o: 62, bolsillos: false })}</g>`,
  boxer: () => P('M96 150 L204 150 L212 262 L158 262 L150 218 L142 262 L88 262 Z') + P('M96 150 L204 150 L204 170 L96 170 Z')
    + L('M150 170 L150 218'),
  gorra: () => P('M186 248 L242 248 Q284 248 292 270 Q236 284 186 262 Z')
    + P('M58 252 Q56 128 150 124 Q238 128 242 252 Z')
    + L('M150 124 Q118 190 128 252') + L('M150 124 Q182 190 174 252') + `<circle cx="150" cy="124" r="6" fill="FILL" stroke="#555" stroke-width="2"/>`
    + L('M58 252 L242 252'),
  cinturon: () => P('M24 168 L276 168 L276 204 L24 204 Z') + P('M122 150 L182 150 L182 222 L122 222 Z', 'fill="none" stroke-width="4"')
    + L('M140 186 L168 186', 'stroke-width="5"') + [0, 1, 2, 3, 4].map((k) => `<circle cx="${204 + k * 14}" cy="186" r="3.5" fill="DET"/>`).join('')
    + L('M24 186 L110 186', 'stroke-dasharray="4 5" opacity=".5"'),
  tote: () => `<path d="M104 150 Q104 52 150 52 Q196 52 196 150" fill="none" stroke="#555" stroke-width="7" stroke-linecap="round"/>`
    + P('M66 148 L234 148 L252 336 L48 336 Z') + L('M66 168 L234 168', 'opacity=".5"') + L('M90 300 L210 300', 'stroke-dasharray="4 4" opacity=".5"'),
  bandolera: () => `<path d="M82 176 Q66 40 150 40 Q234 40 218 176" fill="none" stroke="#555" stroke-width="6" stroke-linecap="round"/>`
    + P('M70 172 L230 172 L230 304 L70 304 Z') + P('M70 172 L230 172 L150 238 Z') + `<circle cx="150" cy="238" r="7" fill="DET"/>`,
};

const ESC = (t) => String(t).replace(/&/g, 'y').replace(/</g, '').replace(/>/g, '');

function svgPrenda(nombre, color, tipo, categoria, colorHex) {
  const fondo = colorHex || '#cccccc';
  const claro = ['Blanco', 'Beige', 'Rosado', 'Mostaza'].includes(color);
  const det = claro ? '#222222' : '#ffffff';
  const silueta = (FORMAS[tipoSilueta(nombre, categoria)] || FORMAS.camiseta)().replace(/FILL/g, fondo).replace(/DET/g, det);
  const lupa = tipo === 'detalle'
    ? `<defs><pattern id="h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${det}" stroke-width="2" opacity=".6"/></pattern></defs>`
      + `<circle cx="240" cy="92" r="40" fill="${fondo}" stroke="#555" stroke-width="2"/><circle cx="240" cy="92" r="40" fill="url(#h)"/>`
      + `<text x="240" y="150" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="#555">tejido</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 380" width="300" height="380">
<rect width="300" height="380" fill="#f5f5f5"/>
${silueta}
${lupa}
<text x="150" y="364" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#333">${ESC(nombre).slice(0, 34)}</text>
<text x="150" y="24" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#666">${color} - ${tipo}</text>
</svg>`;
}

module.exports = { svgPrenda, tipoSilueta, FORMAS };
