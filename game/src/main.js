// NEON PULSE entry: fixed-step loop, four screens, deterministic shot mode.
import { STEP, BEST_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_NODE, EVENT_OVER, EVENT_LEVEL } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const input = createInput(canvas);

let screen = SCREEN_TITLE;
let best = readBest();
let scoreSaved = false;

function readBest() {
  try { return Math.max(0, Number(window.localStorage.getItem(BEST_KEY)) || 0); }
  catch { return 0; }
}
function saveBest(v) {
  try { window.localStorage.setItem(BEST_KEY, String(v)); } catch { /* session-only */ }
}
function announce(text) {
  if (status) status.textContent = text;
}

function startGame() {
  world.reset();
  screen = SCREEN_PLAY;
  scoreSaved = false;
  announce('Game started. Collect energy, dodge hazards.');
}
function endGame() {
  screen = SCREEN_OVER;
  if (!scoreSaved) {
    scoreSaved = true;
    if (world.state.score > best) { best = world.state.score; saveBest(best); }
  }
  announce(`Signal lost. Score ${world.state.score}. Best ${best}. Press space to restart.`);
}

function handleActions() {
  const a = input.takeActions();
  if (a & ACTION_CONFIRM) {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }
  if (a & ACTION_PAUSE) {
    if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Resumed.'); }
  }
}

function step() {
  const dir = input.direction();
  if (screen === SCREEN_TITLE) {
    world.step(STEP, { x: 0, y: 0 }, true);
  } else if (screen === SCREEN_PLAY) {
    const events = world.step(STEP, dir, false);
    if (events & EVENT_LEVEL) announce(`Level ${world.state.level}.`);
    if (events & EVENT_NODE && world.state.overdrive) announce('Overdrive! Double points.');
    if (events & EVENT_HIT) announce(`Hit. ${world.state.lives} lives left.`);
    if (events & EVENT_OVER) endGame();
  }
}

function runGame() {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (acc >= STEP) {
      step();
      acc -= STEP;
    }
    renderer.draw(world.state, screen, best);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function runShot(name) {
  const scene = stageShot(name, world);
  best = Math.max(best, scene.best);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === SCREEN_PLAY) {
    screen = SCREEN_PAUSED;
    announce('Paused (window hidden).');
  }
});

if (shot) runShot(shot);
else runGame();
