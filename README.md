# Neon Arena — FPS

A browser-based first-person shooter built with Three.js.

## How to play

- **WASD** — Move  
- **Mouse** — Look around  
- **Left click** — Shoot  
- **Space** — Jump  

Survive as long as you can. Red enemies spawn and chase you; get close and they deal damage. Shoot them for 100 points each. Ammo slowly regenerates.

## Run locally

ES modules require a local server. Options:

**Option 1 — Python**
```bash
cd fps-game
python -m http.server 8080
```
Then open http://localhost:8080

**Option 2 — Node (npx)**
```bash
cd fps-game
npx serve .
```
Then open the URL shown (e.g. http://localhost:3000)

**Option 3 — VS Code**  
Use the "Live Server" extension and open `index.html`.

Click **ENTER ARENA** and allow pointer lock when prompted so the mouse controls the view.
