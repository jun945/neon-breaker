// NEON PULSE - deterministic game rules. No browser API, no wall clock: every random draw comes
// from the injected generator, so a fixed seed reproduces an identical simulation.
import {
  FIELD, STEP, PLAYER, LIVES, NODE, HAZARD, LEVEL, COMBO, OVERDRIVE,
  POOL_SIZE, PARTICLES, SHAKE_DECAY,
} from './config.js';

export const KIND_HAZARD = 0;
export const KIND_NODE = 1;
export const EVENT_NODE = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_LEVEL = 8;

const PLAY_TOP = 120;
const PLAY_BOTTOM = FIELD.groundY;

function overlaps(a, b) {
  return Math.abs(a.x - b.x) * 2 < (a.width + b.width) &&
         Math.abs(a.y - b.y) * 2 < (a.height + b.height);
}

export function createWorld(random) {
  const items = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    items.push({ active: false, kind: 0, x: 0, y: 0, width: 0, height: 0, speed: 0, spin: 0, drift: 0 });
  }
  const particles = [];
  for (let i = 0; i < PARTICLES; i++) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, hue: 0, size: 0 });
  }
  let particleCursor = 0;

  const state = {
    player: { x: FIELD.width / 2, y: PLAY_BOTTOM - 60, width: PLAYER.width, height: PLAYER.height,
              invulnerable: 0, vx: 0, vy: 0 },
    items, particles,
    score: 0, lives: LIVES, level: 1, elapsed: 0,
    nodeTimer: 0, hazardTimer: 0,
    combo: 0, bestCombo: 0, multiplier: 1,
    overdrive: false, overdriveTimer: 0,
    shake: 0, flash: 0, pulse: 0,
  };

  function freeItem() {
    for (let i = 0; i < items.length; i++) if (!items[i].active) return items[i];
    return null;
  }
  function spawnNode() {
    const it = freeItem();
    if (!it) return;
    const size = NODE.size;
    it.active = true; it.kind = KIND_NODE;
    it.width = size; it.height = size;
    it.x = 60 + random() * (FIELD.width - 120);
    it.y = PLAY_TOP - 20;
    it.speed = NODE.speed + (state.level - 1) * NODE.speedPerLevel;
    it.drift = (random() - 0.5) * 90;
    it.spin = random() * Math.PI * 2;
  }
  function spawnHazard() {
    const it = freeItem();
    if (!it) return;
    const size = HAZARD.size;
    it.active = true; it.kind = KIND_HAZARD;
    it.width = size; it.height = size;
    it.x = 60 + random() * (FIELD.width - 120);
    it.y = PLAY_TOP - 40;
    it.speed = HAZARD.speed + (state.level - 1) * HAZARD.speedPerLevel + (random() - 0.5) * HAZARD.speedJitter;
    it.drift = (random() - 0.5) * 130;
    it.spin = random() * Math.PI * 2;
  }
  function burst(x, y, hue, count, speed) {
    for (let n = 0; n < count; n++) {
      const p = particles[particleCursor];
      particleCursor = (particleCursor + 1) % particles.length;
      const a = random() * Math.PI * 2;
      const s = speed * (0.4 + random() * 0.8);
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.maxLife = 0.35 + random() * 0.5; p.life = p.maxLife;
      p.hue = hue; p.size = 2 + random() * 4;
    }
  }
  function nodeInterval() {
    return Math.max(NODE.minInterval, NODE.interval - (state.level - 1) * 0.05) + random() * NODE.intervalJitter;
  }
  function hazardInterval() {
    return Math.max(HAZARD.minInterval, HAZARD.interval * Math.pow(HAZARD.intervalScale, state.level - 1));
  }

  function reset() {
    const p = state.player;
    p.x = FIELD.width / 2; p.y = PLAY_BOTTOM - 60;
    p.invulnerable = 0; p.vx = 0; p.vy = 0;
    for (const it of items) it.active = false;
    for (const pt of particles) pt.active = false;
    state.score = 0; state.lives = LIVES; state.level = 1; state.elapsed = 0;
    state.nodeTimer = 0.4; state.hazardTimer = 1.2;
    state.combo = 0; state.bestCombo = 0; state.multiplier = 1;
    state.overdrive = false; state.overdriveTimer = 0;
    state.shake = 0; state.flash = 0; state.pulse = 0;
  }

  // direction: {x:-1|0|1, y:-1|0|1}; harmless:true = demo background (no collisions, no score).
  function step(dt, direction, harmless) {
    let events = 0;
    const p = state.player;
    const dx = (direction && direction.x) || 0;
    const dy = (direction && direction.y) || 0;
    const len = Math.hypot(dx, dy) || 1;
    p.vx = (dx / len) * PLAYER.speed;
    p.vy = (dy / len) * PLAYER.speed;
    p.x = Math.min(FIELD.width - p.width / 2, Math.max(p.width / 2, p.x + p.vx * dt));
    p.y = Math.min(PLAY_BOTTOM - p.height / 2, Math.max(PLAY_TOP + p.height / 2, p.y + p.vy * dt));

    state.elapsed += dt;
    state.pulse += dt * (state.overdrive ? 5.5 : 2.6);
    state.shake = Math.max(0, state.shake - SHAKE_DECAY * dt);
    state.flash = Math.max(0, state.flash - 2.2 * dt);
    if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);

    const prevLevel = state.level;
    state.level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (state.level !== prevLevel) events |= EVENT_LEVEL;

    if (state.overdrive) {
      state.overdriveTimer -= dt;
      if (state.overdriveTimer <= 0) { state.overdrive = false; state.combo = 0; state.multiplier = 1; }
    }

    if (!harmless) {
      state.nodeTimer -= dt;
      if (state.nodeTimer <= 0) { spawnNode(); state.nodeTimer = nodeInterval(); }
      state.hazardTimer -= dt;
      if (state.hazardTimer <= 0) { spawnHazard(); state.hazardTimer = hazardInterval(); }
    } else {
      state.nodeTimer -= dt;
      if (state.nodeTimer <= 0) { spawnNode(); state.nodeTimer = nodeInterval(); }
    }

    for (const it of items) {
      if (!it.active) continue;
      it.y += it.speed * dt;
      it.x += it.drift * dt;
      it.spin += dt * (it.kind === KIND_NODE ? 2.2 : 1.3);
      if (it.x < 30 || it.x > FIELD.width - 30) it.drift *= -1;
      if (it.y > FIELD.height + 40) { it.active = false; continue; }
      if (harmless) continue;
      if (!overlaps(p, it)) continue;
      if (it.kind === KIND_NODE) {
        it.active = false;
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.multiplier = Math.min(COMBO.max, 1 + Math.floor(state.combo / COMBO.step));
        const gain = NODE.points * state.multiplier * (state.overdrive ? 2 : 1);
        state.score += gain;
        state.pulse += 0.35;
        state.flash = Math.min(0.5, state.flash + 0.18);
        burst(it.x, it.y, 150, 8, 150);
        events |= EVENT_NODE;
        if (!state.overdrive && state.combo >= OVERDRIVE.combo) {
          state.overdrive = true;
          state.overdriveTimer = OVERDRIVE.seconds;
          burst(p.x, p.y, 280, 26, 260);
        }
      } else if (p.invulnerable <= 0) {
        it.active = false;
        state.lives -= 1;
        state.combo = 0; state.multiplier = 1;
        state.overdrive = false; state.overdriveTimer = 0;
        p.invulnerable = PLAYER.invulnerable;
        state.shake = 1; state.flash = 0.8;
        burst(p.x, p.y, 330, 22, 260);
        events |= EVENT_HIT;
        if (state.lives <= 0) { events |= EVENT_OVER; }
      }
    }

    for (const pt of particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) { pt.active = false; continue; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.96; pt.vy *= 0.96;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
