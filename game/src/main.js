import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { makeShotWorld } from './shots.js';
import { VIEW } from './config.js';
import { World } from './world.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam >>> 0 : (Date.now() >>> 0);

const audio = new AudioEngine();
const world = shot ? makeShotWorld(shot, seed) : new World({ seed, audio });
if (shot) world.frozen = true;
const renderer = new Renderer(canvas);
const input = new Input(canvas, VIEW);
let lastTime = performance.now();
let started = false;

const beginRun = () => {
  audio.sfx('ui');
  world.startGame();
  world.launch();
};

const handlePrimary = () => {
  if (world.state === 'title') {
    beginRun();
    return true;
  }
  if (world.state === 'gameover' || world.state === 'victory') {
    beginRun();
    return true;
  }
  if (world.state === 'paused') {
    world.togglePause();
    audio.sfx('ui');
    return true;
  }
  if (world.state === 'playing' && world.balls.some((ball) => ball.stuck)) {
    world.launch();
    return true;
  }
  return false;
};

const frame = (now) => {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (input.take('KeyM')) {
    world.muted = !world.muted;
    audio.setMuted(world.muted);
    audio.sfx('ui');
  }

  const pausePressed = input.take('KeyP') || input.take('Escape');
  if (pausePressed && (world.state === 'playing' || world.state === 'paused')) {
    audio.sfx('ui');
    world.togglePause();
  }

  const primary = input.take('Space') || input.take('Enter') || input.take('Pointer');
  if (primary) handlePrimary();

  world.update(dt, world.state === 'playing' ? input : null);
  renderer.draw(world);

  if (!started) {
    started = true;
    document.documentElement.dataset.ready = 'true';
    document.getElementById('boot')?.remove();
  }

  input.endFrame();
  requestAnimationFrame(frame);
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden && world.state === 'playing') world.togglePause();
});

window.addEventListener('blur', () => {
  if (world.state === 'playing') world.togglePause();
});

window.__NEON_BREAKER__ = { world, renderer, audio, input };
requestAnimationFrame(frame);
