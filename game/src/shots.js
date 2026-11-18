// Deterministic shot staging: drive a fresh world through real rules to a fixed scene.
// Same seed => same frame, no wall clock. stageShot returns what the renderer needs.
import { STEP, PLAYER, FIELD } from './config.js';
import { KIND_HAZARD, EVENT_OVER } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 28;
const END_LIMIT_SECONDS = 900;
const HORIZON_PLAY = 0.75;
const HORIZON_END = 0.2;
const SAMPLE = 1 / 30;
const DIRECTIONS = [
  { x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 },
  { x: 0, y: -1 }, { x: 0, y: 1 },
  { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
];
const PLAY_TOP = 120;
const PLAY_BOTTOM = FIELD.groundY;

function timeToHit(state, dir, horizon) {
  const p = state.player;
  const speed = PLAYER.speed;
  const len = Math.hypot(dir.x, dir.y) || 1;
  const vx = (dir.x / len) * speed, vy = (dir.y / len) * speed;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const px = Math.min(FIELD.width - p.width / 2, Math.max(p.width / 2, p.x + vx * t));
    const py = Math.min(PLAY_BOTTOM - p.height / 2, Math.max(PLAY_TOP + p.height / 2, p.y + vy * t));
    for (const it of state.items) {
      if (!it.active || it.kind !== KIND_HAZARD) continue;
      const hy = it.y + it.speed * t;
      const hx = it.x + it.drift * t;
      if (Math.abs(px - hx) * 2 < (p.width + it.width) + 14 &&
          Math.abs(py - hy) * 2 < (p.height + it.height) + 14) return t;
    }
  }
  return Infinity;
}

function autopilot(state, horizon) {
  const p = state.player;
  // target nearest low node
  let target = null, bestD = Infinity;
  for (const it of state.items) {
    if (!it.active || it.kind !== 1) continue;
    const d = (it.y - p.y) + Math.abs(it.x - p.x) * 0.35;
    if (it.y > p.y - 40 && d < bestD) { bestD = d; target = it; }
  }
  let want = { x: 0, y: 0 };
  if (target) {
    if (target.x - p.x > 10) want.x = 1; else if (target.x - p.x < -10) want.x = -1;
    if (target.y - p.y > 10) want.y = 1; else if (target.y - p.y < -10) want.y = -1;
  } else {
    if (p.x < FIELD.width / 2 - 20) want.x = 1; else if (p.x > FIELD.width / 2 + 20) want.x = -1;
  }
  if (timeToHit(state, want, horizon) === Infinity) return want;
  let best = null, bestT = -1;
  for (const d of DIRECTIONS) {
    const t = timeToHit(state, d, horizon);
    if (t > bestT) { bestT = t; best = d; }
  }
  return best;
}

export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i++) world.step(STEP, { x: 0, y: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const horizon = name === 'end' ? HORIZON_END : HORIZON_PLAY;
  for (let i = 0; i < limit / STEP; i++) {
    const dir = autopilot(world.state, horizon);
    if (world.step(STEP, dir, false) & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
