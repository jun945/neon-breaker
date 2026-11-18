import {
  ARENA,
  BALL,
  BRICKS,
  COLORS,
  PADDLE,
  POWERUP,
  POWERUPS,
  ROW_COLORS,
  VIEW,
  WAVES,
  clamp,
} from './config.js';
import { Rng, deriveSeed } from './random.js';

const SHIELD_Y = 838;
const BEST_KEY = 'neon-breaker.best.v1';
const MAX_PARTICLES = 300;
const COMBO_SECONDS = 3.4;

const safeReadBest = () => {
  try {
    const value = Number(globalThis.localStorage?.getItem(BEST_KEY) ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch {
    return 0;
  }
};

const safeWriteBest = (value) => {
  try {
    globalThis.localStorage?.setItem(BEST_KEY, String(Math.max(0, Math.floor(value))));
  } catch {
    // Storage can be unavailable in private or file contexts; the run still works.
  }
};

export class World {
  constructor({ seed = Date.now(), audio = null } = {}) {
    this.seed = Number.isFinite(seed) ? seed >>> 0 : Date.now() >>> 0;
    this.rng = new Rng(deriveSeed(this.seed, 'live'));
    this.audio = audio;
    this.frozen = false;
    this.muted = false;

    this.state = 'title';
    this.time = 0;
    this.score = 0;
    this.best = safeReadBest();
    this.wave = 1;
    this.lives = 3;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = COLORS.cyan;
    this.shield = 0;
    this.effects = { wide: 0, slow: 0 };
    this.banner = null;
    this.endReason = 'lost';
    this.waveClear = false;
    this.waveClearTimer = 0;
    this.nextBrickId = 1;

    this.paddle = {
      x: VIEW.width / 2,
      y: PADDLE.y,
      w: PADDLE.width,
      h: PADDLE.height,
      vx: 0,
    };
    this.balls = [];
    this.bricks = [];
    this.particles = [];
    this.powerups = [];
    this.floaters = [];
    this.shockwaves = [];

    this.setupAttract();
  }

  get multiplier() {
    return Math.min(8, 1 + Math.floor(this.combo / 4));
  }

  setupAttract() {
    this.wave = 1;
    this.bricks = this.buildBricks(1);
    this.balls = [];
    this.powerups = [];
    this.particles = [];
    this.floaters = [];
    this.shockwaves = [];
    this.combo = 0;
    this.comboTimer = 0;
    this.waveClear = false;
  }

  startGame() {
    this.state = 'playing';
    this.frozen = false;
    this.score = 0;
    this.wave = 1;
    this.lives = 3;
    this.combo = 0;
    this.comboTimer = 0;
    this.shield = 0;
    this.effects = { wide: 0, slow: 0 };
    this.endReason = 'lost';
    this.powerups = [];
    this.particles = [];
    this.floaters = [];
    this.shockwaves = [];
    this.paddle.x = VIEW.width / 2;
    this.paddle.w = PADDLE.width;
    this.waveClear = false;
    this.waveClearTimer = 0;
    this.spawnWave(1, { silent: false });
    this.audio?.sfx('start');
  }

  spawnWave(wave, { silent = false } = {}) {
    this.wave = clamp(wave, 1, WAVES.length);
    this.waveClear = false;
    this.waveClearTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.effects = { wide: 0, slow: 0 };
    this.shield = 0;
    this.powerups = [];
    this.paddle.x = VIEW.width / 2;
    this.paddle.w = PADDLE.width;
    this.paddle.vx = 0;
    this.bricks = this.buildBricks(this.wave);
    this.balls = [this.createBall()];
    const info = WAVES[this.wave - 1];
    this.banner = silent ? null : {
      kind: 'wave',
      title: `WAVE ${String(this.wave).padStart(2, '0')}`,
      subtitle: info.name,
      note: info.tag,
      time: 2.35,
      max: 2.35,
    };
    if (!silent) this.audio?.sfx('wave', { wave: this.wave });
  }

  buildBricks(wave) {
    const layoutRng = new Rng(deriveSeed(this.seed, `layout-${wave}`));
    if (wave === WAVES.length) return this.buildCoreWave(layoutRng);

    const info = WAVES[wave - 1];
    const bricks = [];
    for (let row = 0; row < info.rows; row += 1) {
      for (let col = 0; col < BRICKS.columns; col += 1) {
        let keep = true;
        let hp = 1;

        if (wave === 1) {
          hp = row < 2 ? 1 : row === 4 ? 1 : 2;
        } else if (wave === 2) {
          keep = (row + col) % 3 !== 0;
          hp = 2;
        } else if (wave === 3) {
          keep = (col + row * 2) % 5 !== 0;
          hp = 1 + (row >= 3 ? 1 : 0);
        } else if (wave === 4) {
          keep = Math.abs(col - 5) + Math.abs(row - 2.5) <= 5;
          hp = 2 + (row === 1 || row === 4 ? 1 : 0);
        } else {
          keep = (row * 13 + col * 7) % 11 > 1 || row === 0;
          hp = 2 + ((row + col) % 5 === 0 ? 1 : 0);
        }

        if (!keep) continue;
        bricks.push(this.newBrick({
          x: BRICKS.left + col * (BRICKS.width + BRICKS.gapX),
          y: BRICKS.top + row * (BRICKS.height + BRICKS.gapY),
          w: BRICKS.width,
          h: BRICKS.height,
          hp,
          color: ROW_COLORS[row % ROW_COLORS.length],
          row,
          col,
          phase: layoutRng.float(0, Math.PI * 2),
        }));
      }
    }
    return bricks;
  }

  buildCoreWave(layoutRng) {
    const bricks = [];
    for (let col = 0; col < BRICKS.columns; col += 1) {
      bricks.push(this.newBrick({
        x: BRICKS.left + col * (BRICKS.width + BRICKS.gapX),
        y: 252,
        w: BRICKS.width,
        h: BRICKS.height,
        hp: 2,
        color: col % 2 === 0 ? COLORS.violet : COLORS.pink,
        row: 0,
        col,
        phase: layoutRng.float(0, Math.PI * 2),
      }));
    }

    for (const sideCol of [0, 1, 9, 10]) {
      for (let i = 0; i < 3; i += 1) {
        bricks.push(this.newBrick({
          x: BRICKS.left + sideCol * (BRICKS.width + BRICKS.gapX),
          y: 330 + i * 56,
          w: BRICKS.width,
          h: BRICKS.height,
          hp: 2,
          color: i === 1 ? COLORS.cyan : COLORS.violet,
          row: 1 + i,
          col: sideCol,
          phase: layoutRng.float(0, Math.PI * 2),
        }));
      }
    }

    for (let col = 0; col < BRICKS.columns; col += 1) {
      bricks.push(this.newBrick({
        x: BRICKS.left + col * (BRICKS.width + BRICKS.gapX),
        y: 524,
        w: BRICKS.width,
        h: BRICKS.height,
        hp: 2,
        color: col % 2 === 0 ? COLORS.cyan : COLORS.lime,
        row: 5,
        col,
        phase: layoutRng.float(0, Math.PI * 2),
      }));
    }

    bricks.push(this.newBrick({
      x: VIEW.width / 2 - 176,
      y: 328,
      w: 352,
      h: 158,
      hp: 30,
      color: COLORS.pink,
      row: -1,
      col: -1,
      boss: true,
      phase: 0.4,
    }));
    return bricks;
  }

  newBrick(data) {
    return {
      id: this.nextBrickId++,
      alive: true,
      maxHp: data.hp,
      hitFlash: 0,
      boss: false,
      ...data,
    };
  }

  createBall(offset = 0) {
    return {
      x: this.paddle.x + offset,
      y: this.paddle.y - this.paddle.h / 2 - BALL.radius - 5,
      vx: 0,
      vy: 0,
      r: BALL.radius,
      stuck: true,
      trail: [],
      trailClock: 0,
      dead: false,
    };
  }

  targetBallSpeed() {
    const base = WAVES[this.wave - 1]?.speed ?? BALL.baseSpeed;
    return base * (this.effects.slow > 0 ? 0.72 : 1);
  }

  launch() {
    const stuck = this.balls.filter((ball) => ball.stuck);
    if (stuck.length === 0) return;
    const speed = this.targetBallSpeed();
    stuck.forEach((ball, index) => {
      const spread = stuck.length > 1 ? (index - (stuck.length - 1) / 2) * 0.24 : 0;
      const angle = -Math.PI / 2 + this.rng.float(-0.42, 0.42) + spread;
      ball.stuck = false;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      ball.trail = [];
      this.spawnBurst(ball.x, ball.y, COLORS.cyan, 8, 0.55);
    });
    this.audio?.sfx('launch');
    this.flash = Math.max(this.flash, 0.22);
    this.flashColor = COLORS.cyan;
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      return true;
    }
    if (this.state === 'paused') {
      this.state = 'playing';
      return true;
    }
    return false;
  }

  update(dt, input = null) {
    const step = clamp(dt, 0, 0.034);
    this.time += step;

    if (this.frozen) return;

    this.updateBanner(step);
    if (this.state === 'playing') {
      this.updatePaddle(step, input);
      this.updateEffects(step);
      this.normalizeBallSpeeds();
      this.updateBalls(step);
      this.updatePowerups(step);
      if (this.comboTimer > 0) {
        this.comboTimer -= step;
        if (this.comboTimer <= 0) {
          this.combo = 0;
          this.comboTimer = 0;
        }
      }
      this.updateWaveClear(step);
    }

    for (const brick of this.bricks) {
      if (brick.hitFlash > 0) brick.hitFlash = Math.max(0, brick.hitFlash - step * 3.6);
    }
    this.updateParticles(step);
    this.updateFloaters(step);
    this.updateShockwaves(step);
    this.shake *= Math.exp(-8 * step);
    this.flash *= Math.exp(-9 * step);
    if (this.shake < 0.06) this.shake = 0;
    if (this.flash < 0.006) this.flash = 0;
  }

  updateBanner(dt) {
    if (!this.banner) return;
    this.banner.time -= dt;
    if (this.banner.time <= 0) this.banner = null;
  }

  updatePaddle(dt, input) {
    const paddle = this.paddle;
    const previous = paddle.x;
    const left = input && (input.isDown('ArrowLeft') || input.isDown('KeyA'));
    const right = input && (input.isDown('ArrowRight') || input.isDown('KeyD'));
    const keyboard = (right ? 1 : 0) - (left ? 1 : 0);

    if (keyboard !== 0) {
      paddle.x += keyboard * PADDLE.speed * dt;
      paddle.vx = keyboard * PADDLE.speed;
    } else if (input?.pointerActive) {
      const follow = 1 - Math.exp(-18 * dt);
      paddle.x += (input.pointerX - paddle.x) * follow;
      paddle.vx = (paddle.x - previous) / Math.max(dt, 0.001);
    } else {
      paddle.vx *= Math.exp(-12 * dt);
    }

    const targetWidth = PADDLE.width + (this.effects.wide > 0 ? PADDLE.wideBonus : 0);
    paddle.w += (targetWidth - paddle.w) * (1 - Math.exp(-10 * dt));
    const half = paddle.w / 2;
    paddle.x = clamp(paddle.x, ARENA.left + half + 5, ARENA.right - half - 5);
    paddle.y = PADDLE.y;

    for (const ball of this.balls) {
      if (!ball.stuck) continue;
      ball.x = clamp(paddle.x, ARENA.left + ball.r + 2, ARENA.right - ball.r - 2);
      ball.y = paddle.y - paddle.h / 2 - ball.r - 5;
    }
  }

  updateEffects(dt) {
    if (this.effects.wide > 0) this.effects.wide = Math.max(0, this.effects.wide - dt);
    if (this.effects.slow > 0) {
      this.effects.slow = Math.max(0, this.effects.slow - dt);
    }
  }

  normalizeBallSpeeds() {
    const speed = this.targetBallSpeed();
    for (const ball of this.balls) {
      if (ball.stuck) continue;
      const magnitude = Math.hypot(ball.vx, ball.vy);
      if (magnitude < 0.001) continue;
      ball.vx = (ball.vx / magnitude) * speed;
      ball.vy = (ball.vy / magnitude) * speed;
    }
  }

  updateBalls(dt) {
    for (const ball of this.balls) {
      if (ball.stuck) continue;
      const distance = Math.hypot(ball.vx, ball.vy) * dt;
      const substeps = clamp(Math.ceil(distance / 6), 1, 14);
      const slice = dt / substeps;
      for (let i = 0; i < substeps && !ball.dead; i += 1) {
        this.moveBall(ball, slice);
      }

      ball.trailClock -= dt;
      if (ball.trailClock <= 0) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 18) ball.trail.shift();
        ball.trailClock = 0.013;
      }
    }

    if (this.balls.some((ball) => ball.dead)) {
      this.balls = this.balls.filter((ball) => !ball.dead);
      if (this.balls.length === 0) this.loseLife();
    }
  }

  moveBall(ball, dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < ARENA.left) {
      ball.x = ARENA.left + ball.r;
      ball.vx = Math.abs(ball.vx);
      this.wallSpark(ball.x, ball.y);
    } else if (ball.x + ball.r > ARENA.right) {
      ball.x = ARENA.right - ball.r;
      ball.vx = -Math.abs(ball.vx);
      this.wallSpark(ball.x, ball.y);
    }

    if (ball.y - ball.r < ARENA.top) {
      ball.y = ARENA.top + ball.r;
      ball.vy = Math.abs(ball.vy);
      this.wallSpark(ball.x, ball.y);
    }

    const paddle = this.paddle;
    const paddleTop = paddle.y - paddle.h / 2;
    const paddleBottom = paddle.y + paddle.h / 2;
    if (
      ball.vy > 0
      && ball.y + ball.r >= paddleTop
      && ball.y - ball.r <= paddleBottom
      && ball.x + ball.r >= paddle.x - paddle.w / 2
      && ball.x - ball.r <= paddle.x + paddle.w / 2
    ) {
      const rel = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
      // A small unpredictable english prevents a perfectly centered return from
      // becoming a vertical bounce loop.
      const angle = clamp(rel * 1.02 + this.rng.float(-0.05, 0.05), -1.08, 1.08);
      const speed = this.targetBallSpeed();
      ball.vx = Math.sin(angle) * speed + paddle.vx * 0.07;
      ball.vy = -Math.abs(Math.cos(angle) * speed);
      const magnitude = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = (ball.vx / magnitude) * speed;
      ball.vy = (ball.vy / magnitude) * speed;
      ball.y = paddleTop - ball.r - 0.6;
      this.shake = Math.max(this.shake, 2.8);
      this.spawnBurst(ball.x, paddleTop - 2, COLORS.cyan, 7, 0.58);
      this.audio?.sfx('paddle', { rel });
      return;
    }

    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (
        ball.x + ball.r < brick.x
        || ball.x - ball.r > brick.x + brick.w
        || ball.y + ball.r < brick.y
        || ball.y - ball.r > brick.y + brick.h
      ) continue;

      const nearestX = clamp(ball.x, brick.x, brick.x + brick.w);
      const nearestY = clamp(ball.y, brick.y, brick.y + brick.h);
      const dx = ball.x - nearestX;
      const dy = ball.y - nearestY;
      if (dx * dx + dy * dy > ball.r * ball.r) continue;

      const centerX = brick.x + brick.w / 2;
      const centerY = brick.y + brick.h / 2;
      const overlapX = brick.w / 2 + ball.r - Math.abs(ball.x - centerX);
      const overlapY = brick.h / 2 + ball.r - Math.abs(ball.y - centerY);
      if (overlapX < overlapY) {
        const side = ball.x < centerX ? -1 : 1;
        ball.x += side * overlapX;
        ball.vx = Math.abs(ball.vx) * side;
      } else {
        const side = ball.y < centerY ? -1 : 1;
        ball.y += side * overlapY;
        ball.vy = Math.abs(ball.vy) * side;
      }
      this.damageBrick(brick, nearestX, nearestY);
      break;
    }

    if (this.shield > 0 && ball.vy > 0 && ball.y + ball.r >= SHIELD_Y) {
      ball.y = SHIELD_Y - ball.r;
      ball.vy = -Math.abs(ball.vy);
      this.shield = 0;
      this.shake = Math.max(this.shake, 8);
      this.flash = Math.max(this.flash, 0.5);
      this.flashColor = COLORS.pink;
      this.spawnBurst(ball.x, SHIELD_Y, COLORS.pink, 26, 1.1);
      this.addShockwave(ball.x, SHIELD_Y, COLORS.pink, 160);
      this.addFloater(ball.x, SHIELD_Y - 24, 'AEGIS BROKEN', COLORS.pink, 14);
      this.audio?.sfx('shield');
      return;
    }

    if (ball.y - ball.r > ARENA.bottom + 40) {
      ball.dead = true;
    }
  }

  wallSpark(x, y) {
    this.spawnBurst(x, y, COLORS.cyanSoft, 4, 0.35);
    this.audio?.sfx('wall');
  }

  damageBrick(brick, hitX, hitY) {
    brick.hp -= 1;
    brick.hitFlash = 1;
    this.shake = Math.max(this.shake, brick.boss ? 7 : 2.3);

    if (brick.hp > 0) {
      this.addScore(10 * this.multiplier);
      this.spawnBurst(hitX, hitY, brick.color, brick.boss ? 12 : 5, brick.boss ? 1.1 : 0.55);
      this.audio?.sfx(brick.boss ? 'coreHit' : 'brick', { combo: this.combo, pitch: brick.hp });
      return;
    }

    brick.alive = false;
    brick.hp = 0;
    this.combo += 1;
    this.comboTimer = COMBO_SECONDS;
    const multiplier = this.multiplier;
    const points = brick.boss ? 500 * multiplier : (70 + this.wave * 15) * multiplier;
    this.addScore(points);
    this.spawnBurst(hitX, hitY, brick.color, brick.boss ? 48 : 12, brick.boss ? 1.8 : 0.9);
    this.addFloater(
      hitX + this.rng.float(-8, 8),
      hitY - 8,
      `+${points}`,
      brick.color,
      brick.boss ? 26 : 15,
    );
    this.audio?.sfx(brick.boss ? 'coreBreak' : 'break', { combo: this.combo });

    if (brick.boss) {
      this.flash = Math.max(this.flash, 0.75);
      this.flashColor = brick.color;
      this.shake = Math.max(this.shake, 20);
      this.addShockwave(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 430);
      this.addFloater(VIEW.width / 2, 570, 'CORE PURGED', COLORS.cyan, 30);
    } else if (this.rng.chance(POWERUP.dropChance)) {
      this.dropPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2);
    }

    this.checkWaveClear();
  }

  addScore(points) {
    this.score += Math.max(0, Math.round(points));
    if (this.score > this.best) this.best = this.score;
  }

  loseLife() {
    this.lives -= 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.shield = 0;
    this.powerups = [];
    this.shake = Math.max(this.shake, 17);
    this.flash = Math.max(this.flash, 0.95);
    this.flashColor = COLORS.pink;
    this.audio?.sfx('lose');
    if (this.lives <= 0) {
      this.endGame('lost');
      return;
    }
    this.balls = [this.createBall()];
    this.effects.wide = 0;
    this.effects.slow = 0;
    this.banner = {
      kind: 'life',
      title: 'SIGNAL LOST',
      subtitle: `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} REMAIN`,
      note: 'RELAUNCH WHEN READY',
      time: 1.9,
      max: 1.9,
    };
  }

  endGame(reason) {
    if (this.state === 'gameover' || this.state === 'victory') return;
    this.state = reason === 'won' ? 'victory' : 'gameover';
    this.endReason = reason;
    this.balls = [];
    this.powerups = [];
    this.banner = null;
    this.best = Math.max(this.best, this.score);
    safeWriteBest(this.best);
    this.flash = Math.max(this.flash, reason === 'won' ? 0.4 : 0.85);
    this.flashColor = reason === 'won' ? COLORS.cyan : COLORS.pink;
    this.shake = Math.max(this.shake, reason === 'won' ? 6 : 14);
    this.audio?.sfx(reason === 'won' ? 'victory' : 'gameover');
  }

  checkWaveClear() {
    if (this.waveClear) return;
    if (this.bricks.some((brick) => brick.alive)) return;
    this.waveClear = true;
    this.waveClearTimer = 2.15;
    const bonus = 1250 * this.wave;
    this.addScore(bonus);
    this.addFloater(VIEW.width / 2, 560, `WAVE CLEAR  +${bonus}`, COLORS.cyan, 25);
    this.addShockwave(VIEW.width / 2, 470, COLORS.cyan, 500);
    this.spawnBurst(VIEW.width / 2, 470, COLORS.cyan, 40, 1.7);
    this.audio?.sfx('clear');
    this.banner = {
      kind: 'clear',
      title: 'GRID CLEARED',
      subtitle: `STAGE BONUS +${bonus}`,
      note: this.wave >= WAVES.length ? 'THE GRID IS QUIET' : 'DEPLOYING NEXT WAVE',
      time: 2.15,
      max: 2.15,
    };
  }

  updateWaveClear(dt) {
    if (!this.waveClear) return;
    this.waveClearTimer -= dt;
    if (this.waveClearTimer > 0) return;
    if (this.wave >= WAVES.length) {
      this.addScore(10000);
      this.endGame('won');
    } else {
      this.spawnWave(this.wave + 1);
    }
  }

  dropPowerup(x, y) {
    if (this.powerups.length >= 3) return;
    const roll = this.rng.next();
    let type;
    if (roll < 0.28) type = 'wide';
    else if (roll < 0.5) type = 'multi';
    else if (roll < 0.75) type = 'slow';
    else if (roll < 0.94) type = 'shield';
    else type = 'life';
    if (type === 'life' && this.lives >= 4) type = 'wide';
    const definition = POWERUPS[type];
    this.powerups.push({
      type,
      x,
      y,
      vy: POWERUP.fallSpeed,
      size: POWERUP.size,
      color: definition.color,
      phase: this.rng.float(0, Math.PI * 2),
      born: this.time,
    });
  }

  updatePowerups(dt) {
    const paddleTop = this.paddle.y - this.paddle.h / 2;
    for (let index = this.powerups.length - 1; index >= 0; index -= 1) {
      const pickup = this.powerups[index];
      pickup.y += pickup.vy * dt;
      pickup.phase += dt * 3;
      const caught = (
        pickup.y + pickup.size / 2 >= paddleTop
        && pickup.y - pickup.size / 2 <= this.paddle.y + this.paddle.h / 2
        && Math.abs(pickup.x - this.paddle.x) <= this.paddle.w / 2 + pickup.size / 2
      );
      if (caught) {
        this.powerups.splice(index, 1);
        this.applyPowerup(pickup.type, pickup.x, pickup.y);
        continue;
      }
      if (pickup.y - pickup.size > ARENA.bottom + 20) this.powerups.splice(index, 1);
    }
  }

  applyPowerup(type, x = this.paddle.x, y = this.paddle.y - 40) {
    const definition = POWERUPS[type];
    if (!definition) return;
    if (type === 'wide') {
      this.effects.wide = 14;
    } else if (type === 'slow') {
      this.effects.slow = 9;
    } else if (type === 'shield') {
      this.shield = 1;
    } else if (type === 'life') {
      this.lives = Math.min(4, this.lives + 1);
    } else if (type === 'multi') {
      this.spawnMultiball();
    }
    this.addFloater(x, y - 18, definition.blurb, definition.color, 16);
    this.addShockwave(x, y, definition.color, 120);
    this.spawnBurst(x, y, definition.color, 20, 1.1);
    this.flash = Math.max(this.flash, 0.32);
    this.flashColor = definition.color;
    this.shake = Math.max(this.shake, 5);
    this.audio?.sfx('powerup', { type });
  }

  spawnMultiball() {
    const source = this.balls.find((ball) => !ball.stuck && !ball.dead) ?? this.balls[0];
    if (!source) return;
    const speed = this.targetBallSpeed();
    const baseAngle = Math.atan2(source.vy || -1, source.vx || 0);
    const additions = Math.min(2, 5 - this.balls.length);
    for (let i = 0; i < additions; i += 1) {
      const angle = baseAngle + (i === 0 ? -0.34 : 0.34);
      const ball = this.createBall();
      ball.stuck = false;
      ball.x = source.x;
      ball.y = source.y;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      ball.trail = [];
      this.balls.push(ball);
      this.spawnBurst(ball.x, ball.y, COLORS.lime, 8, 0.6);
    }
  }

  updateParticles(dt) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        this.particles.splice(index, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-1.9 * dt);
      particle.vy = particle.vy * Math.exp(-1.5 * dt) + 78 * dt;
      particle.rotation += particle.spin * dt;
    }
  }

  updateFloaters(dt) {
    for (let index = this.floaters.length - 1; index >= 0; index -= 1) {
      const floater = this.floaters[index];
      floater.life -= dt;
      floater.y -= 32 * dt;
      if (floater.life <= 0) this.floaters.splice(index, 1);
    }
  }

  updateShockwaves(dt) {
    for (let index = this.shockwaves.length - 1; index >= 0; index -= 1) {
      const wave = this.shockwaves[index];
      wave.life -= dt;
      wave.radius += wave.speed * dt;
      if (wave.life <= 0) this.shockwaves.splice(index, 1);
    }
  }

  spawnBurst(x, y, color, count = 10, power = 1) {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const angle = this.rng.float(0, Math.PI * 2);
      const speed = this.rng.float(44, 310) * power;
      const life = this.rng.float(0.24, 0.75);
      this.particles.push({
        x: x + this.rng.float(-4, 4),
        y: y + this.rng.float(-4, 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: this.rng.float(1.2, 4.2) * Math.min(1.6, power + 0.1),
        color,
        rotation: this.rng.float(0, Math.PI * 2),
        spin: this.rng.float(-9, 9),
        shard: this.rng.chance(0.35),
      });
    }
  }

  addFloater(x, y, text, color, size = 16) {
    this.floaters.push({
      x,
      y,
      text,
      color,
      size,
      life: 0.95,
      maxLife: 0.95,
    });
  }

  addShockwave(x, y, color, maxRadius = 150) {
    this.shockwaves.push({
      x,
      y,
      color,
      radius: 8,
      speed: maxRadius * 1.7,
      life: 0.55,
      maxLife: 0.55,
    });
  }
}
