// Tarea automática: busca PNG nuevos o actualizados de animales en la carpeta compartida,
// los procesa (procesar_imagenes.js), los activa en el juego, sube la versión y hace push.
// La corre launchd cada 5 minutos (ver app/com.togetherdevs.furia-animal.autosubir.plist).
//
// Solo toma archivos <slug>.png cuyo slug es un animal del juego (ej. gorila.png). Ignora JPG y otros.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const SRC = process.env.FURIA_SRC || '/Volumes/Descargas Windows/Downloads';
const IMG = path.join(REPO, 'img');
const log = (...a) => console.log(new Date().toISOString(), ...a);

if (!fs.existsSync(SRC)) { log('carpeta compartida no montada, salteo'); process.exit(0); }

const git = (...a) => execFileSync('git', a, { cwd: REPO, stdio: 'inherit' });
git('pull', '--rebase', '--autostash', '-q');
const game = fs.readFileSync(path.join(REPO, 'game.html'), 'utf8');
const slug = n => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const animals = new Set([...game.matchAll(/\['[chfpmr]','([^']+)'/g)].map(m => slug(m[1])));

const todo = [];
for (const f of fs.readdirSync(SRC)) {
  if (!/\.png$/i.test(f)) continue;
  const k = f.slice(0, -4).toLowerCase();
  if (!animals.has(k)) continue;
  const src = path.join(SRC, f), dst = path.join(IMG, k + '.webp');
  const srcT = fs.statSync(src).mtimeMs;
  if (!fs.existsSync(dst) || srcT > fs.statSync(dst).mtimeMs) todo.push([src, k]);
}
if (!todo.length) { log('nada nuevo'); process.exit(0); }

log('procesando', todo.map(t => t[1]).join(', '));
execFileSync(process.execPath, [path.join(__dirname, 'procesar_imagenes.js'), IMG, ...todo.flat()], { stdio: 'inherit' });

// activa todas las imágenes presentes y sube la versión
let g = fs.readFileSync(path.join(REPO, 'game.html'), 'utf8');
const slugs = fs.readdirSync(IMG).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)).sort();
g = g.replace(/const IMG=new Set\(\[[^\]]*\]\);/, 'const IMG=new Set(' + JSON.stringify(slugs) + ');');
const v = +g.match(/const VERSION='v(\d+)';/)[1] + 1;
g = g.replace(/const VERSION='v\d+';/, `const VERSION='v${v}';`);
fs.writeFileSync(path.join(REPO, 'game.html'), g);

git('add', 'img', 'game.html');
git('commit', '-q', '-m', `Imágenes automáticas: ${todo.map(t => t[1]).join(', ')} (${slugs.length} en total)\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`);
git('push', '-q');
log(`subido v${v}: ${todo.length} nuevas, ${slugs.length} animales con imagen`);
