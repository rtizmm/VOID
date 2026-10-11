# VOID — Beyond the Observable 🌌

A cinematic Three.js solar system explorer. Includes the Sun and eight planets, procedural planet textures, Saturn rings, selectable destinations, a smooth free-orbit camera, optional cockpit flight, a planetary information panel, speed/pause controls, graphics modes and ambient synthesizer audio.

## Start locally
Node.js 22+ recommended.

```sh
npm install
npm run dev
```

## Publish
Push to `main`; the included GitHub Actions workflow builds the Vite project and deploys `dist`. In GitHub go to **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Website: https://rtizmm.github.io/VOID/

## Controls
- Orbit: left drag to rotate; scroll/pinch to zoom; click a planet to target.
- Cockpit: WASD to move, Q/E for down/up, Shift to boost, drag to look.
- "SWITCH" changes camera modes; "OVERVIEW" resets the scene.
- Ambient sound starts only when the sound button is clicked.

*All orbital distances and visual sizes are stylized, not scientifically to scale. Temperature and moon counts are approximate reference values.*

Next: advanced warp effects, detailed planetary textures, optional cinematic cockpit UI.
