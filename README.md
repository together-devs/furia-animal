# Furia Animal

Juego de peleas de animales para Tino. Online: https://together-devs.github.io/furia-animal/

## Correrlo en VS Code

1. Abrí esta carpeta en VS Code.
2. Instalá la extensión recomendada **Live Server** (VS Code la sugiere al abrir).
3. Abrí `game.html` y tocá **Go Live** (abajo a la derecha) → se abre en http://localhost:5500/game.html y se recarga solo al guardar.

Alternativa sin extensión: `npm start` y abrí http://localhost:5500/game.html
Para depurar con breakpoints: Run and Debug → **Jugar en Chrome (debug)**.

Probar en inglés: `game.html?lang=en`

## Archivos
- `game.html` — todo el juego (HTML + CSS + JS en un archivo).
- `index.html` — cargador sin caché que baja siempre el último `game.html` (es lo que abre la URL pública).
- `stats.html` — tablero privado de estadísticas (Firebase).
- `img/` — imágenes de animales (`<slug>.webp`, 384px). `app/procesar_imagen.py` saca fondo y las optimiza.
- `app/` — prompts para generar imágenes y generador automático.
- `.github/workflows/` — compilación iOS (TestFlight) y generador de imágenes.

## Publicar
Cada `git push` a `main` publica en GitHub Pages en ~30 s. Subí `VERSION` en `game.html` para ver qué versión tiene cada celular.
