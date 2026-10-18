// Genera imágenes de animales con Cloudflare Workers AI (Leonardo Lucid Origin, plan gratis).
// Credenciales en ~/.furia-animal-tools/cloudflare.env (CF_ACCOUNT_ID, CF_API_TOKEN).
// Uso: node app/gen_cloudflare.js <carpeta_salida> <slug> [<slug> ...]
// Toma el prompt de app/prompts-gemini.txt y guarda <slug>.png (fondo blanco, para procesar después).
const fs = require('fs'), path = require('path'), os = require('os');

const env = Object.fromEntries(fs.readFileSync(path.join(os.homedir(), '.furia-animal-tools/cloudflare.env'), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const [outDir, ...slugs] = process.argv.slice(2);
if (!outDir || !slugs.length) { console.error('uso: node gen_cloudflare.js <salida> <slug> ...'); process.exit(1); }

const txt = fs.readFileSync(path.join(__dirname, 'prompts-gemini.txt'), 'utf8');
const prompts = {};
for (const block of txt.split(/\n(?=#\d+ )/)) {
  const m = block.match(/guardar como: ([a-z0-9-]+)\.png\s*\nCreate an image: ([\s\S]+)/);
  if (m) prompts[m[1]] = m[2].trim();
}

// descripciones más precisas para animales raros (el modelo los inventa si no)
const EXTRA = {
  'megacerops': 'Megacerops brontothere, prehistoric mammal like a giant bulky horse-rhino hybrid. Distinctive feature: on the end of its snout grows ONE wide flat blunt bony plate that forks into TWO short rounded prongs, like a slingshot or a letter Y. It has NO sharp pointed horn at all. Grey wrinkled hide',
  'arctodus': 'Arctodus simus, the giant short-faced bear of the Ice Age: very long legs, short broad snout, dark brown shaggy fur',
  'rinoceronte-lanudo': 'Woolly rhinoceros of the Ice Age: thick long reddish-brown shaggy fur all over, two horns, the front horn very long and curved forward',
  'arsinoiterio': 'Arsinoitherium, prehistoric mammal from Egypt. Distinctive feature: TWO huge thick conical horns growing side by side (left and right, parallel, like a pair) from above its nose, pointing forward and up, plus two tiny horns behind them. Not a rhino: no single horn on the tip of the nose. Grey-brown skin',
  'uintaterio': 'Uintatherium, large prehistoric mammal with three pairs of knobby bony bumps on its head and two long saber-like tusks hanging from its upper jaw, grey hide',
  'sivatherium': 'Sivatherium, prehistoric giraffe relative with a short neck, stocky ox-like body and broad flat moose-like horns on its head, spotted tan coat',
  'astrapoterio': 'Astrapotherium, strange South American prehistoric mammal with a long body, short trunk and four forward-pointing tusks, brown skin',
  'dinocrocuta': 'Dinocrocuta, giant prehistoric hyena-like predator with massive bone-crushing jaws, spotted brown fur',
  'megalictis': 'Megalictis, giant prehistoric wolverine-like weasel, dark brown fur with lighter stripe on its side, short legs, sharp teeth',
  'sivapithecus': 'Sivapithecus, prehistoric ape similar to an orangutan, long reddish-brown hair, long arms',
  'harpagolestes': 'Harpagolestes, prehistoric predatory mammal that looks like a big heavy wolf with a long powerful furry snout and strong jaws with thick teeth, small hooves instead of paws, shaggy grey-brown fur, living animal with normal furry face and eyes',
  'anthracoterio': 'Anthracotherium, prehistoric hippo-like mammal with a long snout and visible tusks, bristly grey-brown skin',
  'bisonte-gigante': 'Bison latifrons, giant Ice Age bison with enormous horns spanning over 2 meters, shaggy dark brown fur and big hump'
};
const URL = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/@cf/leonardo/lucid-origin`;
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const slug of slugs) {
    const p = prompts[slug];
    if (!p) { console.log('SIN PROMPT', slug); continue; }
    const desc = (EXTRA[slug] || p.split('. Single animal')[0]);
    const prompt = desc + '. Single animal, full body, three-quarter side view facing right, fierce and powerful, mouth open roaring. Stylized 3D game character render like Clash Royale or a Pixar movie, detailed fur and textures, accurate anatomy, vibrant colors, soft studio lighting, centered, plain solid white background, no text.';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, steps: 8 }) });
        const j = await r.json();
        if (!j.success) throw new Error(JSON.stringify(j.errors));
        fs.writeFileSync(path.join(outDir, slug + '.png'), Buffer.from(j.result.image, 'base64'));
        console.log('ok', slug); break;
      } catch (e) { console.log('intento', attempt, slug, String(e).slice(0, 200)); }
    }
  }
})();
