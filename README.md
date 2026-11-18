# NEON PULSE

A neon synthwave arcade survival game. Steer the glowing pulse core, collect green energy nodes, dodge pink disturbance blocks. Chain pickups to build a combo multiplier and trigger **OVERDRIVE** for double points. Pure static HTML5 canvas — no build step, no dependencies, runs offline.

[![Play on make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/c/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/jun945/neon-pulse/rank.svg)](https://make.fun/c/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/jun945/neon-pulse/reward.svg)](https://make.fun/c/best-game-01)

## Play

Open `game/index.html` in a browser, or serve the folder:

```sh
node serve.ts          # http://localhost:8080
```

Controls: **Arrow keys / WASD** to move, **Space / Enter / click** to start & restart, **P / Esc** to pause.

## How it works

- `game/src/world.js` — deterministic seeded rules (pickups, hazards, combo, overdrive, levels).
- `game/src/render.js` — neon canvas renderer with synthwave backdrop, grid floor and HUD.
- `game/src/input.js` — keyboard + pointer input.
- `game/src/shots.js` — deterministic shot staging for `?shot=` screenshots.
- `main.ts` — copies `game/` + `screenshots/` to `/output` and writes `dossier.json` via `vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE).
