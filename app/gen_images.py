"""Genera las imágenes de los animales. Por defecto GRATIS: Pollinations.ai (Flux, sin clave) + rembg para quitar el fondo.
Opcional: IMG_PROVIDER=openai con OPENAI_API_KEY.
Uso: python app/gen_images.py "tiranosaurio-rex,smilodon"   (o "faltantes" / "todos")
Necesita OPENAI_API_KEY. Guarda img/<slug>.webp (256px) y actualiza la lista IMG en game.html."""
import base64, csv, io, json, os, random, re, sys, time, urllib.parse, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROVIDER = os.environ.get("IMG_PROVIDER", "pollinations")
MODEL = os.environ.get("IMG_MODEL", "gpt-image-1")
QUALITY = os.environ.get("IMG_QUALITY", "medium")
which = (sys.argv[1] if len(sys.argv) > 1 else "faltantes").strip()

rows = list(csv.DictReader(open(os.path.join(ROOT, "app/prompts-animales.csv"), encoding="utf-8")))
for r in rows: r["slug"] = r["archivo"].rsplit(".", 1)[0]
os.makedirs(os.path.join(ROOT, "img"), exist_ok=True)
have = lambda s: os.path.exists(os.path.join(ROOT, "img", s + ".webp"))
if which == "todos": todo = rows
elif which == "faltantes": todo = [r for r in rows if not have(r["slug"])]
else:
    want = {w.strip() for w in which.split(",") if w.strip()}
    todo = [r for r in rows if r["slug"] in want]
    missing = want - {r["slug"] for r in todo}
    if missing: sys.exit("No existen estos animales: " + ", ".join(sorted(missing)))
print(f"Generando {len(todo)} imágenes con {PROVIDER}")
if PROVIDER == "pollinations":
    from rembg import remove, new_session
    SESSION = new_session("isnet-general-use")

def gen_pollinations(prompt):
    p = prompt.replace("isolated on a fully transparent background", "isolated on a plain solid white background")
    url = ("https://image.pollinations.ai/prompt/" + urllib.parse.quote(p) +
           f"?width=1024&height=1024&model=flux&nologo=true&private=true&seed={random.randint(1, 10**6)}")
    req = urllib.request.Request(url, headers={"User-Agent": "furia-animal-generator"})
    with urllib.request.urlopen(req, timeout=300) as r:
        raw = r.read()
    return remove(raw, session=SESSION)

def gen(prompt):
    if PROVIDER == "pollinations":
        return gen_pollinations(prompt)
    body = json.dumps({"model": MODEL, "prompt": prompt, "size": "1024x1024", "quality": QUALITY,
                       "background": "transparent", "output_format": "png", "n": 1}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=body,
        headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return base64.b64decode(json.load(r)["data"][0]["b64_json"])

fails = []
for i, r in enumerate(todo, 1):
    for attempt in range(3):
        try:
            png = gen(r["prompt"])
            im = Image.open(io.BytesIO(png)).convert("RGBA")
            bbox = im.getbbox()
            if bbox: im = im.crop(bbox)
            side = max(im.size); canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
            canvas.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, "img", r["slug"] + ".webp"), "WEBP", quality=88, method=6)
            print(f"[{i}/{len(todo)}] ok  {r['animal']}")
            if PROVIDER == "pollinations": time.sleep(16)  # límite del servicio gratis
            break
        except Exception as e:
            print(f"[{i}/{len(todo)}] intento {attempt+1} falló {r['animal']}: {e}")
            time.sleep(20 * (attempt + 1))
    else:
        fails.append(r["animal"])

# Activa en el juego todas las imágenes presentes
slugs = sorted(f[:-5] for f in os.listdir(os.path.join(ROOT, "img")) if f.endswith(".webp"))
gp = os.path.join(ROOT, "game.html"); g = open(gp, encoding="utf-8").read()
g = re.sub(r"const IMG=new Set\(\[[^\]]*\]\);", "const IMG=new Set(" + json.dumps(slugs) + ");", g)
m = re.search(r"const VERSION='v(\d+)';", g)
g = g.replace(m.group(0), f"const VERSION='v{int(m.group(1))+1}';")
open(gp, "w", encoding="utf-8").write(g)
print(f"Imágenes activas: {len(slugs)}. Fallaron: {fails or 'ninguna'}")
