import { BALL, COLORS, PADDLE, POWERUPS, POWERUP } from './config.js';
import { World } from './world.js';

function makePowerup(type, x, y, phase = 0) {
  return {
    type,
    x,
    y,
    vy: POWERUP.fallSpeed,
    size: POWERUP.size,
    color: POWERUPS[type].color,
    phase,
    born: 0,
  };
}

function makeBall(x, y, vx, vy, colorIndex = 0) {
  const magnitude = Math.hypot(vx, vy) || 1;
  const trail = [];
  for (let i = 14; i >= 0; i -= 1) {
    trail.push({
      x: x - (vx / magnitude) * i * 13,
      y: y - (vy / magnitude) * i * 13,
    });
  }
  return {
    x,
    y,
    vx,
    vy,
    r: BALL.radius,
    stuck: false,
    trail,
    trailClock: 0.013,
    dead: false,
    colorIndex,
  };
}

function stagePlay(world) {
  world.state = 'playing';
  world.spawnWave(4, { silent: true });
  world.banner = null;
  world.waveClear = false;
  world.waveClearTimer = 0;
  world.score = 128450;
  world.best = 174920;
  world.lives = 3;
  world.combo = 17;
  world.comboTimer = 2.65;
  world.effects.wide = 9.2;
  world.effects.slow = 0;
  world.shield = 1;
  world.paddle.x = 765;
  world.paddle.w = PADDLE.width + PADDLE.wideBonus;
  world.paddle.y = PADDLE.y;
  world.time = 21.7;
  world.flash = 0.08;
  world.flashColor = COLORS.violet;
  world.shake = 1.8;
  world.powerups = [
    makePowerup('multi', 1046, 624, 1.7),
    makePowerup('wide', 432, 548, 3.9),
  ];

  const removed = [];
  world.bricks.forEach((brick, index) => {
    if (brick.alive && index % 9 === 4) {
      brick.alive = false;
      removed.push(brick);
    }
    if (brick.alive && (index === 2 || index === 18)) brick.hitFlash = 0.82;
  });

  removed.slice(0, 5).forEach((brick, index) => {
    world.spawnBurst(
      brick.x + brick.w / 2,
      brick.y + brick.h / 2,
      index % 2 === 0 ? COLORS.pink : COLORS.cyan,
      8,
      0.95,
    );
  });
  world.spawnBurst(862, 392, COLORS.violet, 25, 1.15);
  world.spawnBurst(1118, 356, COLORS.lime, 18, 0.95);
  world.addShockwave(862, 392, COLORS.violet, 180);
  world.addShockwave(460, 470, COLORS.cyan, 140);
  world.addFloater(878, 350, '+760', COLORS.lime, 17);
  world.addFloater(486, 438, 'CHAIN x5', COLORS.cyan, 13);

  world.balls = [
    makeBall(918, 470, 434, -318, 0),
    makeBall(378, 598, -286, -438, 1),
  ];
}

function stageEnd(world) {
  world.spawnWave(5, { silent: true });
  world.state = 'gameover';
  world.endReason = 'lost';
  world.wave = 5;
  world.score = 96840;
  world.best = 174920;
  world.lives = 0;
  world.combo = 0;
  world.comboTimer = 0;
  world.shield = 0;
  world.effects.wide = 0;
  world.effects.slow = 0;
  world.banner = null;
  world.powerups = [];
  world.balls = [];
  world.paddle.x = 948;
  world.paddle.y = PADDLE.y;
  world.time = 18.4;
  world.shake = 0;
  world.flash = 0;

  const broken = [];
  world.bricks.forEach((brick, index) => {
    if (brick.alive && index % 3 !== 1) {
      brick.alive = false;
      if (index % 6 === 0) broken.push(brick);
    }
    if (brick.alive && index % 8 === 0) brick.hitFlash = 0.7;
  });
  for (const [index, brick] of broken.slice(0, 7).entries()) {
    world.spawnBurst(
      brick.x + brick.w / 2,
      brick.y + brick.h / 2,
      index % 2 === 0 ? COLORS.pink : COLORS.coral,
      4,
      0.55,
    );
  }
  world.addShockwave(788, 522, COLORS.pink, 240);
}

function stageStart(world) {
  world.state = 'title';
  world.score = 0;
  world.best = 174920;
  world.lives = 3;
  world.wave = 1;
  world.combo = 0;
  world.time = 7.4;
  world.banner = null;
  world.balls = [];
  world.powerups = [];
  world.paddle.x = 720;
  world.paddle.w = PADDLE.width;
}

export function makeShotWorld(kind, seed = 1) {
  const numericSeed = Number(seed);
  const world = new World({ seed: Number.isFinite(numericSeed) ? numericSeed : 1 });
  world.frozen = true;
  if (kind === 'play') stagePlay(world);
  else if (kind === 'end') stageEnd(world);
  else stageStart(world);
  return world;
}
