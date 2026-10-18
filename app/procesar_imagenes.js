// Procesa imágenes de animales con fondo liso (blanco/gris claro, como las de Gemini):
// saca el fondo (si no viene transparente), recorta, centra y guarda <salida>/<slug>.webp de 384x384.
//
// Uso: node app/procesar_imagenes.js <carpeta_salida> <imagen> <slug> [<imagen> <slug> ...]
// Requiere: npm i sharp
const sharp = require('sharp');
const path = require('path');

const SIZE = +(process.env.SIZE || 384), WORK = Math.max(1024, SIZE * 2), FLIP = false; // las de Gemini ya miran a la derecha, que es como las usa el juego
const [outDir, ...pairs] = process.argv.slice(2);
if (!outDir || pairs.length % 2) { console.error('uso: node procesar_imagenes.js <salida> <img> <slug> ...'); process.exit(1); }

async function proc(src, slug) {
  const { data, info } = await sharp(src).resize(WORK, WORK, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = (x, y) => (y * W + x) * 4;

  // si ya viene con transparencia (borde transparente), se respeta tal cual
  let transpBorder = 0, borderN = 0;
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { borderN++; if (data[px(x, y) + 3] < 20) transpBorder++; }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { borderN++; if (data[px(x, y) + 3] < 20) transpBorder++; }
  const alreadyTransparent = transpBorder / borderN > 0.9;

  // color de fondo: promedio del borde
  let r = 0, g = 0, b = 0, n = 0;
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = px(x, y); r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = px(x, y); r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  const bg = [r / n, g / n, b / n];
  const dist = i => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  // sombras grises del piso: claras y casi sin color
  const isShadow = i => { const R = data[i], G = data[i + 1], B = data[i + 2]; const mx = Math.max(R, G, B), mn = Math.min(R, G, B); return mx > 150 && mx - mn < 14; };
  const HARD = 38, SOFT = 70;

  if (!alreadyTransparent) {
  // relleno desde los bordes: todo lo conectado que se parece al fondo es fondo
  const bgMask = new Uint8Array(W * H), stack = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const k = y * W + x; if (bgMask[k]) return; const i = k * 4; if (dist(i) < HARD || isShadow(i)) { bgMask[k] = 1; stack.push(k); } };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) { const k = stack.pop(), x = k % W, y = (k / W) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  // huecos encerrados (entre las patas, bajo la cola): manchas casi idénticas al fondo que no tocan el borde
  for (let k = 0; k < W * H; k++) if (!bgMask[k] && dist(k * 4) < 22) bgMask[k] = 1;

  // alfa: fondo transparente; borde suave en los píxeles del animal que tocan el fondo
  for (let k = 0; k < W * H; k++) {
    const i = k * 4;
    if (bgMask[k]) { data[i + 3] = 0; continue; }
    const x = k % W, y = (k / W) | 0;
    const nearBg = (x > 0 && bgMask[k - 1]) || (x < W - 1 && bgMask[k + 1]) || (y > 0 && bgMask[k - W]) || (y < H - 1 && bgMask[k + W]);
    if (nearBg) { const d = dist(i); if (d < SOFT) data[i + 3] = Math.round(255 * (d - HARD) / (SOFT - HARD)); }
  }

  }

  let img = sharp(data, { raw: { width: W, height: H, channels: 4 } });
  // recorte al animal
  const trimmed = await img.png().toBuffer().then(buf => sharp(buf).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true }));
  let t = sharp(trimmed.data); if (FLIP) t = t.flop();
  const tw = trimmed.info.width, th = trimmed.info.height, side = Math.round(Math.max(tw, th) * 1.02);
  const subject = await t.png().toBuffer();
  const dest = path.join(outDir, slug + '.webp');
  await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: subject, left: Math.round((side - tw) / 2), top: Math.round((side - th) / 2) }])
    .png().toBuffer()
    .then(buf => sharp(buf).resize(SIZE, SIZE).webp({ quality: 88, effort: 6, alphaQuality: 100 }).toFile(dest));
  console.log('ok', slug, '→', dest);
}

(async () => { for (let i = 0; i < pairs.length; i += 2) await proc(pairs[i], pairs[i + 1]); })().catch(e => { console.error(e); process.exit(1); });
