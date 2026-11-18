# NEON BREAKER

A synthwave brick-breaker built for the edge of the grid. Steer the pulse paddle, keep the ball alive, chain brick breaks into a rising multiplier, catch powerups, and break through six waves to reach **THE CORE**.

Pure static HTML5 canvas — no build step, no dependencies, no network. Runs offline.

[![Play on make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/c/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/jun945/neon-breaker/rank.svg)](https://make.fun/c/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/jun945/neon-breaker/reward.svg)](https://make.fun/c/best-game-01)

## Play

Open `game/index.html` in a browser, or serve the folder:

```sh
node serve.ts          # http://localhost:8080
```

- **Mouse / touch, A / D, or arrow keys** — move the paddle
- **Space / Enter / click** — launch, start, and restart
- **P / Esc** — pause
- **M** — mute

## The run

- Six hand-tuned wave layouts, ending in a 30-hit boss core.
- Break bricks back-to-back to build a chain. Every four links raises the score multiplier, up to ×8.
- Four powerups plus a rare extra life: **WIDE** paddle, **TRI** multiball, **SLOW** time, and the one-use **AEGIS** barrier.
- A local best score survives reloads. Audio is synthesized live with Web Audio — no sound files.
- `?shot=start`, `?shot=play`, and `?shot=end` stage deterministic scenes for screenshots.

## Build the entry

```sh
node main.ts                         # writes /output
# Windows local check:
$env:OUTPUT_DIR = "out"; node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory and writes `dossier.json` with `vendor/makefun-game.ts`.

## Structure

- `game/index.html` — shell and styling
- `game/src/main.js` — boot, input actions, and the frame loop
- `game/src/world.js` — seeded simulation: physics, bricks, combos, powerups, waves
- `game/src/render.js` — neon canvas renderer, synthwave backdrop, HUD, title and end screens
- `game/src/audio.js` — procedural Web Audio sound effects and pulse track
- `game/src/input.js` — keyboard and pointer controls
- `game/src/shots.js` — deterministic screenshot staging
- `game/src/config.js` — tuning constants and palette
- `game/src/random.js` — seeded PRNG helpers

## License

MIT — see [LICENSE](LICENSE).
