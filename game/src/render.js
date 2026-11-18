import {
  ARENA,
  COLORS,
  FONT,
  PADDLE,
  POWERUPS,
  VIEW,
  WAVES,
  clamp,
  padScore,
} from './config.js';
import { Rng } from './random.js';

const TAU = Math.PI * 2;
const COMBO_SECONDS = 3.4;
const colorCache = new Map();

function withAlpha(color, alpha) {
  if (typeof color !== 'string' || !color.startsWith('#') || color.length !== 7) return color;
  const key = `${color}:${Math.round(alpha * 1000)}`;
  const cached = colorCache.get(key);
  if (cached) return cached;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const out = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  colorCache.set(key, out);
  return out;
}

function roundedPath(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function trackedText(ctx, text, x, y, spacing, align = 'left') {
  const characters = Array.from(text);
  let width = 0;
  const widths = characters.map((character) => {
    const measured = ctx.measureText(character).width;
    width += measured;
    return measured;
  });
  width += spacing * Math.max(0, characters.length - 1);
  let cursor = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  const originalAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  characters.forEach((character, index) => {
    ctx.fillText(character, cursor, y);
    cursor += widths[index] + spacing;
  });
  ctx.textAlign = originalAlign;
}

function setFont(ctx, size, family = FONT.mono, weight = '600') {
  ctx.font = `${weight} ${size}px ${family}`;
}

function diamond(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
}

function drawLifeIcon(ctx, x, y, size, active, color, t) {
  ctx.save();
  if (active) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + Math.sin(t * 3 + x * 0.01) * 3;
    ctx.fillStyle = withAlpha(color, 0.94);
    diamond(ctx, x, y, size);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = withAlpha(COLORS.white, 0.75);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = withAlpha(COLORS.white, 0.9);
    diamond(ctx, x, y, size * 0.34);
    ctx.fill();
  } else {
    ctx.strokeStyle = withAlpha(color, 0.24);
    ctx.lineWidth = 1.4;
    diamond(ctx, x, y, size);
    ctx.stroke();
  }
  ctx.restore();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.scale = 1;
    this.stars = [];
    this.dust = [];
    this.buildAtmosphere();
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  buildAtmosphere() {
    const rng = new Rng(0x0badf00d);
    for (let i = 0; i < 150; i += 1) {
      this.stars.push({
        x: rng.float(0, VIEW.width),
        y: rng.float(0, VIEW.height * 0.9),
        size: rng.float(0.5, 2.1),
        phase: rng.float(0, TAU),
        speed: rng.float(0.15, 0.85),
        tint: rng.chance(0.22) ? (rng.chance(0.5) ? COLORS.pink : COLORS.cyan) : '#dcecff',
      });
    }
    for (let i = 0; i < 28; i += 1) {
      this.dust.push({
        x: rng.float(0, VIEW.width),
        y: rng.float(180, VIEW.height),
        radius: rng.float(12, 60),
        speed: rng.float(2, 9),
        alpha: rng.float(0.012, 0.04),
        color: rng.chance(0.5) ? COLORS.cyan : COLORS.pink,
      });
    }
  }

  resize() {
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    const cssWidth = Math.max(1, Math.floor(VIEW.width * scale));
    const cssHeight = Math.max(1, Math.floor(VIEW.height * scale));
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    const width = Math.floor(VIEW.width * dpr);
    const height = Math.floor(VIEW.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.dpr = dpr;
    this.scale = scale;
  }

  draw(world) {
    const ctx = this.ctx;
    const t = world.time;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    this.drawBackdrop(ctx, t, world.state);
    if (world.state === 'title') {
      this.drawTitle(ctx, world, t);
    } else {
      this.drawGame(ctx, world, t);
    }
    this.drawPost(ctx, t, world);
  }

  drawBackdrop(ctx, t, state) {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    sky.addColorStop(0, '#03020a');
    sky.addColorStop(0.44, '#0a061b');
    sky.addColorStop(0.72, '#110820');
    sky.addColorStop(1, '#05030d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const leftGlow = ctx.createRadialGradient(160, 790, 20, 160, 790, 540);
    leftGlow.addColorStop(0, 'rgba(44, 227, 255, 0.10)');
    leftGlow.addColorStop(0.45, 'rgba(20, 112, 170, 0.035)');
    leftGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const rightGlow = ctx.createRadialGradient(1310, 210, 10, 1310, 210, 500);
    rightGlow.addColorStop(0, 'rgba(255, 47, 158, 0.09)');
    rightGlow.addColorStop(1, 'rgba(255, 47, 158, 0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const star of this.stars) {
      const twinkle = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase));
      ctx.fillStyle = withAlpha(star.tint, 0.15 + twinkle * 0.55);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * (0.7 + twinkle * 0.4), 0, TAU);
      ctx.fill();
      if (star.size > 1.5) {
        ctx.fillStyle = withAlpha(star.tint, twinkle * 0.13);
        ctx.fillRect(star.x - 5, star.y - 0.5, 10, 1);
        ctx.fillRect(star.x - 0.5, star.y - 5, 1, 10);
      }
    }
    ctx.restore();

    this.drawSun(ctx, t, state);

    const horizon = 585;
    ctx.save();
    ctx.lineWidth = 1;
    for (let index = -14; index <= 14; index += 1) {
      const bottomX = VIEW.width / 2 + index * 132;
      ctx.strokeStyle = withAlpha(index % 2 === 0 ? COLORS.cyan : COLORS.violet, 0.055);
      ctx.beginPath();
      ctx.moveTo(VIEW.width / 2, horizon);
      ctx.lineTo(bottomX, VIEW.height);
      ctx.stroke();
    }
    const offset = (t * 0.08) % 1;
    for (let index = 0; index < 18; index += 1) {
      const p = (index + offset) / 18;
      const y = horizon + p ** 2.25 * (VIEW.height - horizon);
      ctx.strokeStyle = withAlpha(COLORS.cyan, 0.018 + p * 0.055);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const mote of this.dust) {
      const x = ((mote.x + t * mote.speed) % (VIEW.width + 160)) - 80;
      const gradient = ctx.createRadialGradient(x, mote.y, 0, x, mote.y, mote.radius);
      gradient.addColorStop(0, withAlpha(mote.color, mote.alpha));
      gradient.addColorStop(1, withAlpha(mote.color, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x - mote.radius, mote.y - mote.radius, mote.radius * 2, mote.radius * 2);
    }
    ctx.restore();
  }

  drawSun(ctx, t, state) {
    const x = VIEW.width / 2;
    const y = 548;
    const radius = state === 'title' ? 228 : 206;
    const strength = state === 'title' ? 1 : 0.66;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius * 2.1);
    halo.addColorStop(0, `rgba(255, 47, 158, ${0.13 * strength})`);
    halo.addColorStop(0.5, `rgba(169, 71, 255, ${0.055 * strength})`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - radius * 2.2, y - radius * 2.2, radius * 4.4, radius * 4.4);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.clip();
    const sun = ctx.createLinearGradient(0, y - radius, 0, y + radius);
    sun.addColorStop(0, `rgba(255, 209, 102, ${0.58 * strength})`);
    sun.addColorStop(0.36, `rgba(255, 123, 84, ${0.56 * strength})`);
    sun.addColorStop(0.64, `rgba(255, 47, 158, ${0.55 * strength})`);
    sun.addColorStop(1, `rgba(104, 34, 146, ${0.24 * strength})`);
    ctx.fillStyle = sun;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    const phase = (t * 7) % 16;
    for (let lineY = y + 12 + phase; lineY < y + radius; lineY += 16) {
      const height = 2 + ((lineY - y) / radius) * 5;
      ctx.fillStyle = `rgba(6, 4, 16, ${0.58 * strength})`;
      ctx.fillRect(x - radius, lineY, radius * 2, height);
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 47, 158, ${0.2 * strength})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = `rgba(84, 247, 255, ${0.26 * strength})`;
    ctx.beginPath();
    ctx.moveTo(0, 585);
    ctx.lineTo(VIEW.width, 585);
    ctx.stroke();
    ctx.restore();
  }

  drawGame(ctx, world, t) {
    const shakeX = Math.sin(t * 91) * world.shake;
    const shakeY = Math.cos(t * 73) * world.shake * 0.58;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawArena(ctx, world, t, false);
    ctx.restore();

    this.drawHud(ctx, world, t);
    this.drawRunStatus(ctx, world, t);
    if (world.flash > 0) {
      ctx.fillStyle = withAlpha(world.flashColor, Math.min(0.32, world.flash * 0.26));
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    this.drawBanner(ctx, world, t);

    if (world.state === 'paused') this.drawPause(ctx, world, t);
    if (world.state === 'gameover') this.drawEnd(ctx, world, t, 'lost');
    if (world.state === 'victory') this.drawEnd(ctx, world, t, 'won');
  }

  drawArena(ctx, world, t, ghost) {
    const { x, y, width, height, left, right, top, bottom } = ARENA;
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.34;

    const glass = ctx.createLinearGradient(x, y, x, y + height);
    glass.addColorStop(0, 'rgba(10, 8, 30, 0.72)');
    glass.addColorStop(0.45, 'rgba(6, 5, 21, 0.52)');
    glass.addColorStop(1, 'rgba(11, 6, 28, 0.48)');
    roundedPath(ctx, x, y, width, height, 22);
    ctx.fillStyle = glass;
    ctx.fill();

    const edgeGlow = ctx.createLinearGradient(x, y, x + width, y);
    edgeGlow.addColorStop(0, withAlpha(COLORS.cyan, 0.12));
    edgeGlow.addColorStop(0.5, withAlpha(COLORS.violet, 0.04));
    edgeGlow.addColorStop(1, withAlpha(COLORS.pink, 0.12));
    ctx.strokeStyle = edgeGlow;
    ctx.lineWidth = 1.4;
    roundedPath(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 22);
    ctx.stroke();

    ctx.save();
    roundedPath(ctx, x + 1, y + 1, width - 2, height - 2, 21);
    ctx.clip();
    this.drawFieldGrid(ctx, t);
    this.drawShield(ctx, world, t);
    for (const brick of world.bricks) {
      if (!brick.alive) continue;
      if (brick.boss) this.drawBoss(ctx, brick, t);
      else this.drawBrick(ctx, brick, t);
    }
    this.drawPowerups(ctx, world, t);
    this.drawBalls(ctx, world, t);
    this.drawPaddle(ctx, world, t);
    this.drawParticles(ctx, world);
    this.drawShockwaves(ctx, world);
    this.drawFloaters(ctx, world);
    ctx.restore();

    this.drawFrameAccents(ctx, t, world);

    ctx.restore();
  }

  drawFieldGrid(ctx, t) {
    ctx.save();
    const { left, right, top, bottom } = ARENA;
    for (let x = left + 72; x < right; x += 96) {
      ctx.strokeStyle = 'rgba(112, 160, 210, 0.026)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for (let y = top + 64; y < bottom; y += 76) {
      ctx.strokeStyle = 'rgba(112, 160, 210, 0.022)';
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    const centerGlow = ctx.createLinearGradient(0, top, 0, top + 150);
    centerGlow.addColorStop(0, 'rgba(84, 247, 255, 0.05)');
    centerGlow.addColorStop(1, 'rgba(84, 247, 255, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(left, top, right - left, 150);
    ctx.strokeStyle = 'rgba(255, 47, 158, 0.065)';
    ctx.setLineDash([2, 10]);
    ctx.beginPath();
    ctx.moveTo(VIEW.width / 2, top + 22);
    ctx.lineTo(VIEW.width / 2, bottom - 34);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawFrameAccents(ctx, t, world) {
    const { x, y, width, height } = ARENA;
    const pulse = 0.55 + 0.22 * Math.sin(t * 2.1);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = withAlpha(COLORS.cyan, 0.55);
    ctx.beginPath();
    ctx.moveTo(x, y + 42);
    ctx.lineTo(x, y + 18);
    ctx.quadraticCurveTo(x, y, x + 18, y);
    ctx.lineTo(x + 52, y);
    ctx.moveTo(x + width - 52, y);
    ctx.lineTo(x + width - 18, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + 18);
    ctx.lineTo(x + width, y + 42);
    ctx.stroke();

    ctx.strokeStyle = withAlpha(COLORS.pink, 0.4);
    ctx.beginPath();
    ctx.moveTo(x, y + height - 42);
    ctx.lineTo(x, y + height - 18);
    ctx.quadraticCurveTo(x, y + height, x + 18, y + height);
    ctx.lineTo(x + 52, y + height);
    ctx.moveTo(x + width - 52, y + height);
    ctx.lineTo(x + width - 18, y + height);
    ctx.quadraticCurveTo(x + width, y + height, x + width, y + height - 18);
    ctx.lineTo(x + width, y + height - 42);
    ctx.stroke();

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = withAlpha(COLORS.cyan, 0.11 * pulse);
    ctx.fillRect(x + 7, y + 110, 1, 180);
    ctx.fillStyle = withAlpha(COLORS.pink, 0.09 * pulse);
    ctx.fillRect(x + width - 8, y + 300, 1, 200);

    const danger = world.lives === 1 && world.state === 'playing';
    if (danger) {
      const glow = 0.16 + 0.13 * Math.sin(t * 5);
      const gradient = ctx.createLinearGradient(0, ARENA.bottom - 24, 0, ARENA.bottom);
      gradient.addColorStop(0, withAlpha(COLORS.pink, 0));
      gradient.addColorStop(1, withAlpha(COLORS.pink, glow));
      ctx.fillStyle = gradient;
      ctx.fillRect(ARENA.left, ARENA.bottom - 24, ARENA.right - ARENA.left, 24);
    }
    ctx.restore();
  }

  drawBrick(ctx, brick, t) {
    const flash = clamp(brick.hitFlash, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.8 + brick.phase);
    const x = brick.x;
    const y = brick.y;
    const w = brick.w;
    const h = brick.h;
    const color = brick.color;

    ctx.save();
    roundedPath(ctx, x, y, w, h, 5);
    ctx.strokeStyle = withAlpha(color, 0.1 + pulse * 0.035);
    ctx.lineWidth = 6;
    ctx.stroke();

    const fill = ctx.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, withAlpha(color, 0.18 + (brick.hp / brick.maxHp) * 0.08));
    fill.addColorStop(0.52, withAlpha(color, 0.075));
    fill.addColorStop(1, withAlpha(color, 0.035));
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.strokeStyle = withAlpha(color, 0.66 + pulse * 0.18);
    ctx.lineWidth = 1.35;
    ctx.stroke();

    const sheen = ctx.createLinearGradient(x, y, x + w, y);
    sheen.addColorStop(0, withAlpha(color, 0.12));
    sheen.addColorStop(0.5, withAlpha(COLORS.white, 0.34));
    sheen.addColorStop(1, withAlpha(color, 0.12));
    ctx.fillStyle = sheen;
    ctx.fillRect(x + 7, y + 2, w - 14, 1);

    ctx.fillStyle = withAlpha(color, 0.55);
    ctx.fillRect(x + 7, y + h - 4, 18 + (brick.hp / brick.maxHp) * (w - 28), 1);

    if (brick.hp > 1) {
      for (let i = 0; i < brick.hp; i += 1) {
        ctx.fillStyle = withAlpha(color, 0.88);
        ctx.beginPath();
        ctx.arc(x + w - 9 - i * 7, y + 7, 1.55, 0, TAU);
        ctx.fill();
      }
    }

    if (flash > 0) {
      roundedPath(ctx, x, y, w, h, 5);
      ctx.fillStyle = withAlpha(COLORS.white, flash * 0.5);
      ctx.fill();
      ctx.strokeStyle = withAlpha(COLORS.white, flash * 0.85);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBoss(ctx, brick, t) {
    const x = brick.x;
    const y = brick.y;
    const w = brick.w;
    const h = brick.h;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.7);
    const danger = 0.5 + 0.5 * Math.sin(t * 4.2 + 1.2);
    const ratio = brick.hp / brick.maxHp;

    ctx.save();
    roundedPath(ctx, x, y, w, h, 12);
    ctx.strokeStyle = withAlpha(COLORS.pink, 0.14);
    ctx.lineWidth = 16;
    ctx.stroke();

    const fill = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.66);
    fill.addColorStop(0, withAlpha(COLORS.pink, 0.22 + pulse * 0.08));
    fill.addColorStop(0.58, 'rgba(74, 10, 54, 0.46)');
    fill.addColorStop(1, 'rgba(10, 5, 24, 0.72)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = withAlpha(COLORS.pink, 0.78);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.save();
    roundedPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 11);
    ctx.clip();
    for (let ring = 0; ring < 3; ring += 1) {
      const spin = t * (0.18 + ring * 0.08) * (ring % 2 === 0 ? 1 : -1);
      ctx.strokeStyle = withAlpha(ring === 1 ? COLORS.violet : COLORS.pink, 0.18 + ring * 0.035);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = spin + (i / 6) * TAU;
        const radius = 42 + ring * 16;
        const px = x + w / 2 + Math.cos(angle) * radius;
        const py = y + h / 2 + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'lighter';
    const coreGlow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 80);
    coreGlow.addColorStop(0, withAlpha(COLORS.white, 0.2 + pulse * 0.12));
    coreGlow.addColorStop(0.25, withAlpha(COLORS.pink, 0.18 + pulse * 0.08));
    coreGlow.addColorStop(1, 'rgba(255, 47, 158, 0)');
    ctx.fillStyle = coreGlow;
    ctx.fillRect(x + w / 2 - 84, y + h / 2 - 84, 168, 168);

    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(Math.PI / 4 + Math.sin(t * 0.6) * 0.04);
    ctx.strokeStyle = withAlpha(COLORS.pinkSoft, 0.66 + danger * 0.2);
    ctx.lineWidth = 2;
    ctx.strokeRect(-31, -31, 62, 62);
    ctx.strokeStyle = withAlpha(COLORS.white, 0.72);
    ctx.lineWidth = 1;
    ctx.strokeRect(-18, -18, 36, 36);
    ctx.fillStyle = withAlpha(COLORS.white, 0.82);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.rotate(-(Math.PI / 4 + Math.sin(t * 0.6) * 0.04));
    ctx.globalCompositeOperation = 'source-over';

    ctx.textAlign = 'center';
    setFont(ctx, 9, FONT.mono, '700');
    ctx.fillStyle = withAlpha(COLORS.pinkSoft, 0.8);
    ctx.fillText('THE CORE', 0, 51);

    ctx.fillStyle = 'rgba(4, 3, 12, 0.72)';
    ctx.fillRect(-105, 66, 210, 6);
    const integrity = ctx.createLinearGradient(-105, 0, 105, 0);
    integrity.addColorStop(0, COLORS.pink);
    integrity.addColorStop(0.7, COLORS.violet);
    integrity.addColorStop(1, COLORS.cyan);
    ctx.fillStyle = integrity;
    ctx.fillRect(-105, 66, 210 * ratio, 6);
    ctx.strokeStyle = withAlpha(COLORS.white, 0.22);
    ctx.lineWidth = 1;
    ctx.strokeRect(-105.5, 65.5, 211, 7);

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = withAlpha(COLORS.cyan, 0.35 + danger * 0.18);
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      const lx = -w / 2 + 18 + i * 26;
      const ly = h / 2 - 22;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 12, ly);
      ctx.stroke();
    }
    ctx.restore();

    if (brick.hitFlash > 0) {
      roundedPath(ctx, x, y, w, h, 12);
      ctx.fillStyle = withAlpha(COLORS.white, brick.hitFlash * 0.34);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPowerups(ctx, world, t) {
    for (const pickup of world.powerups) {
      const definition = POWERUPS[pickup.type];
      if (!definition) continue;
      const size = pickup.size;
      const bob = Math.sin(t * 3.1 + pickup.phase) * 2.2;
      const y = pickup.y + bob;
      const color = definition.color;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(0, y - 90, 0, y + 26);
      beam.addColorStop(0, withAlpha(color, 0));
      beam.addColorStop(0.75, withAlpha(color, 0.09));
      beam.addColorStop(1, withAlpha(color, 0.22));
      ctx.fillStyle = beam;
      ctx.fillRect(pickup.x - 13, y - 90, 26, 118);
      ctx.restore();

      ctx.save();
      ctx.translate(pickup.x, y);
      ctx.rotate(Math.sin(t * 2.2 + pickup.phase) * 0.065);
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      roundedPath(ctx, -size / 2, -size / 2, size, size, 9);
      ctx.fillStyle = 'rgba(7, 5, 20, 0.92)';
      ctx.fill();
      ctx.strokeStyle = withAlpha(color, 0.92);
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = withAlpha(COLORS.white, 0.35);
      ctx.lineWidth = 1;
      roundedPath(ctx, -size / 2 + 4, -size / 2 + 4, size - 8, size - 8, 6);
      ctx.stroke();
      ctx.fillStyle = withAlpha(color, 0.96);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      setFont(ctx, definition.glyph.length > 1 ? 10 : 17, FONT.display, '900');
      ctx.fillText(definition.glyph, 0, 1);
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'center';
      setFont(ctx, 8, FONT.mono, '700');
      ctx.fillStyle = withAlpha(color, 0.7);
      ctx.fillText(definition.label, pickup.x, y + size / 2 + 12);
      ctx.restore();
    }
  }

  drawBalls(ctx, world, t) {
    const colors = [COLORS.cyan, COLORS.pink, COLORS.lime, COLORS.violet, COLORS.amber];
    world.balls.forEach((ball, index) => {
      const color = colors[index % colors.length];
      const trail = ball.trail.length > 0 ? [...ball.trail, { x: ball.x, y: ball.y }] : [{ x: ball.x, y: ball.y }];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i += 1) {
          const progress = i / trail.length;
          ctx.strokeStyle = withAlpha(color, progress * progress * 0.42);
          ctx.lineWidth = Math.max(0.7, progress * 10);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.stroke();
        }
      }

      const halo = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.r * 4.2);
      halo.addColorStop(0, withAlpha(color, 0.36));
      halo.addColorStop(0.36, withAlpha(color, 0.16));
      halo.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r * 4.2, 0, TAU);
      ctx.fill();

      ctx.fillStyle = withAlpha(COLORS.white, 0.96);
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r * 0.72, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = withAlpha(color, 0.82);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r + 1.5, 0, TAU);
      ctx.stroke();

      const glint = ball.r * 0.35;
      ctx.fillStyle = withAlpha(COLORS.white, 0.85);
      ctx.beginPath();
      ctx.arc(ball.x - glint, ball.y - glint, 2, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }

  drawPaddle(ctx, world, t) {
    const paddle = world.paddle;
    const x = paddle.x;
    const y = paddle.y;
    const w = paddle.w;
    const h = paddle.h;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const under = ctx.createRadialGradient(x, y + 16, 6, x, y + 16, w * 0.7);
    under.addColorStop(0, withAlpha(COLORS.cyan, 0.2));
    under.addColorStop(0.55, withAlpha(COLORS.violet, 0.08));
    under.addColorStop(1, withAlpha(COLORS.cyan, 0));
    ctx.fillStyle = under;
    ctx.beginPath();
    ctx.ellipse(x, y + 15, w * 0.67, 30, 0, 0, TAU);
    ctx.fill();

    for (const side of [-1, 1]) {
      const trailX = x + side * w * 0.34;
      const gradient = ctx.createLinearGradient(0, y, 0, y + 42);
      gradient.addColorStop(0, withAlpha(COLORS.cyan, 0.16));
      gradient.addColorStop(1, withAlpha(COLORS.cyan, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(trailX - 7, y + 7);
      ctx.lineTo(trailX + 7, y + 7);
      ctx.lineTo(trailX + 1, y + 42);
      ctx.lineTo(trailX - 1, y + 42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 24;
    roundedPath(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    const body = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
    body.addColorStop(0, withAlpha(COLORS.violet, 0.82));
    body.addColorStop(0.22, withAlpha(COLORS.cyanSoft, 0.98));
    body.addColorStop(0.5, COLORS.white);
    body.addColorStop(0.78, withAlpha(COLORS.cyanSoft, 0.98));
    body.addColorStop(1, withAlpha(COLORS.violet, 0.82));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = withAlpha(COLORS.white, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = withAlpha(COLORS.pink, 0.92);
    roundedPath(ctx, x - w * 0.24, y - 1.5, w * 0.48, 3, 1.5);
    ctx.fill();

    for (const side of [-1, 1]) {
      ctx.fillStyle = withAlpha(COLORS.deep, 0.55);
      ctx.beginPath();
      ctx.arc(x + side * w * 0.39, y, 3.1, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = withAlpha(COLORS.cyan, 0.9);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = withAlpha(COLORS.white, 0.18 + 0.08 * Math.sin(t * 4));
    roundedPath(ctx, x - w * 0.45, y - h / 2 + 1, w * 0.9, 2, 1);
    ctx.fill();
    ctx.restore();
  }

  drawShield(ctx, world, t) {
    if (!world.shield) return;
    const y = 838;
    const { left, right } = ARENA;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createLinearGradient(left, 0, right, 0);
    glow.addColorStop(0, withAlpha(COLORS.pink, 0));
    glow.addColorStop(0.18, withAlpha(COLORS.pink, 0.18));
    glow.addColorStop(0.5, withAlpha(COLORS.pink, 0.3));
    glow.addColorStop(0.82, withAlpha(COLORS.pink, 0.18));
    glow.addColorStop(1, withAlpha(COLORS.pink, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(left, y - 12, right - left, 24);
    ctx.strokeStyle = withAlpha(COLORS.pinkSoft, 0.78);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([22, 10]);
    ctx.lineDashOffset = -t * 34;
    ctx.beginPath();
    ctx.moveTo(left + 18, y);
    ctx.lineTo(right - 18, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    setFont(ctx, 8, FONT.mono, '700');
    ctx.fillStyle = withAlpha(COLORS.pinkSoft, 0.66);
    trackedText(ctx, 'AEGIS // ARMED', VIEW.width / 2, y - 10, 2, 'center');
    ctx.restore();
  }

  drawParticles(ctx, world) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of world.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = withAlpha(particle.color, alpha * 0.9);
      if (particle.shard) {
        const size = particle.size * (0.5 + alpha * 0.7);
        ctx.fillRect(-size / 2, -size / 2, size, size * 0.45);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size * alpha + 0.3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawShockwaves(ctx, world) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const wave of world.shockwaves) {
      const alpha = clamp(wave.life / wave.maxLife, 0, 1);
      ctx.strokeStyle = withAlpha(wave.color, alpha * 0.48);
      ctx.lineWidth = 1 + alpha * 2.2;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(COLORS.white, alpha * 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, Math.max(0, wave.radius - 6), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFloaters(ctx, world) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const floater of world.floaters) {
      const alpha = clamp(floater.life / floater.maxLife, 0, 1);
      ctx.font = `800 ${floater.size}px ${FONT.mono}`;
      ctx.fillStyle = withAlpha(floater.color, alpha);
      ctx.shadowColor = floater.color;
      ctx.shadowBlur = 12 * alpha;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
  }

  drawHud(ctx, world, t) {
    const score = padScore(world.score);
    const best = padScore(world.best);
    const waveInfo = WAVES[world.wave - 1];
    const right = ARENA.x + ARENA.width;

    ctx.save();
    setFont(ctx, 9, FONT.mono, '600');
    ctx.fillStyle = withAlpha(COLORS.cyan, 0.7);
    trackedText(ctx, 'SCORE // RUN 01', ARENA.x, 52, 2.4);
    setFont(ctx, 37, FONT.display, '900');
    ctx.fillStyle = COLORS.white;
    ctx.shadowColor = withAlpha(COLORS.cyan, 0.5);
    ctx.shadowBlur = 18;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(score, ARENA.x, 86);
    ctx.shadowBlur = 0;

    const underline = ctx.createLinearGradient(ARENA.x, 0, ARENA.x + 260, 0);
    underline.addColorStop(0, withAlpha(COLORS.cyan, 0.7));
    underline.addColorStop(1, withAlpha(COLORS.cyan, 0));
    ctx.fillStyle = underline;
    ctx.fillRect(ARENA.x, 108, 250, 1);

    ctx.textAlign = 'center';
    setFont(ctx, 9, FONT.mono, '600');
    ctx.fillStyle = withAlpha(COLORS.violetSoft, 0.72);
    trackedText(ctx, 'GRID SECTOR', VIEW.width / 2, 44, 3.2, 'center');
    setFont(ctx, 22, FONT.display, '800');
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`WAVE ${String(world.wave).padStart(2, '0')}`, VIEW.width / 2 - 54, 76);
    setFont(ctx, 12, FONT.mono, '700');
    ctx.fillStyle = withAlpha(COLORS.pinkSoft, 0.94);
    ctx.fillText(waveInfo.name, VIEW.width / 2 + 73, 76);
    ctx.strokeStyle = withAlpha(COLORS.pink, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(VIEW.width / 2 + 22, 61);
    ctx.lineTo(VIEW.width / 2 + 22, 85);
    ctx.stroke();

    const segments = WAVES.length;
    const segmentWidth = 26;
    const gap = 7;
    const total = segments * segmentWidth + (segments - 1) * gap;
    for (let i = 0; i < segments; i += 1) {
      const x = VIEW.width / 2 - total / 2 + i * (segmentWidth + gap);
      const active = i + 1 === world.wave;
      const complete = i + 1 < world.wave;
      ctx.fillStyle = active
        ? withAlpha(COLORS.pink, 0.9)
        : complete
          ? withAlpha(COLORS.cyan, 0.5)
          : withAlpha(COLORS.dim, 0.24);
      ctx.fillRect(x, 98, segmentWidth, 3);
      if (active) {
        ctx.fillStyle = withAlpha(COLORS.pink, 0.18);
        ctx.fillRect(x - 2, 95, segmentWidth + 4, 9);
      }
    }

    ctx.textAlign = 'right';
    setFont(ctx, 9, FONT.mono, '600');
    ctx.fillStyle = withAlpha(world.lives === 1 ? COLORS.pinkSoft : COLORS.cyan, 0.7);
    trackedText(ctx, 'SIGNAL', right, 48, 2.8, 'right');
    const iconCount = Math.max(3, world.lives);
    for (let i = 0; i < iconCount; i += 1) {
      const x = right - 11 - i * 27;
      drawLifeIcon(ctx, x, 75, 8.2, i < world.lives, i < world.lives ? (world.lives === 1 ? COLORS.pink : COLORS.cyan) : COLORS.dim, t);
    }
    setFont(ctx, 9, FONT.mono, '500');
    ctx.fillStyle = withAlpha(COLORS.mist, 0.48);
    ctx.fillText(`BEST ${best}`, right, 110);

    const line = ctx.createLinearGradient(ARENA.x, 0, right, 0);
    line.addColorStop(0, 'rgba(84, 247, 255, 0.01)');
    line.addColorStop(0.28, 'rgba(84, 247, 255, 0.18)');
    line.addColorStop(0.5, 'rgba(167, 104, 255, 0.08)');
    line.addColorStop(0.76, 'rgba(255, 47, 158, 0.16)');
    line.addColorStop(1, 'rgba(255, 47, 158, 0.01)');
    ctx.fillStyle = line;
    ctx.fillRect(ARENA.x, 128, ARENA.width, 1);
    ctx.restore();
  }

  drawRunStatus(ctx, world, t) {
    const chips = [];
    if (world.effects.wide > 0) chips.push({ label: 'WIDE', value: `${Math.ceil(world.effects.wide)}s`, color: COLORS.cyan });
    if (world.effects.slow > 0) chips.push({ label: 'SLOW', value: `${Math.ceil(world.effects.slow)}s`, color: COLORS.violet });
    if (world.shield > 0) chips.push({ label: 'AEGIS', value: '1', color: COLORS.pink });

    ctx.save();
    let chipX = ARENA.left + 18;
    const chipY = ARENA.top + 18;
    for (const chip of chips) {
      setFont(ctx, 8, FONT.mono, '700');
      const labelWidth = ctx.measureText(chip.label).width;
      const width = labelWidth + 48;
      roundedPath(ctx, chipX, chipY, width, 22, 5);
      ctx.fillStyle = withAlpha(chip.color, 0.08);
      ctx.fill();
      ctx.strokeStyle = withAlpha(chip.color, 0.32);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = withAlpha(chip.color, 0.86);
      ctx.fillText(chip.label, chipX + 9, chipY + 14);
      ctx.textAlign = 'right';
      ctx.fillStyle = withAlpha(COLORS.white, 0.55);
      ctx.fillText(chip.value, chipX + width - 8, chipY + 14);
      chipX += width + 7;
    }

    if (world.combo > 0) {
      const x = ARENA.right - 204;
      const y = ARENA.top + 18;
      const width = 186;
      const ratio = clamp(world.comboTimer / COMBO_SECONDS, 0, 1);
      const hot = world.multiplier >= 4;
      const color = hot ? COLORS.pink : COLORS.cyan;
      roundedPath(ctx, x, y, width, 54, 6);
      ctx.fillStyle = 'rgba(5, 4, 17, 0.62)';
      ctx.fill();
      ctx.strokeStyle = withAlpha(color, hot ? 0.42 : 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'left';
      setFont(ctx, 8, FONT.mono, '700');
      ctx.fillStyle = withAlpha(COLORS.mist, 0.58);
      trackedText(ctx, 'CHAIN', x + 11, y + 17, 2);
      setFont(ctx, 23, FONT.display, '800');
      ctx.fillStyle = COLORS.white;
      ctx.fillText(String(world.combo), x + 11, y + 40);
      ctx.textAlign = 'right';
      setFont(ctx, 9, FONT.mono, '700');
      ctx.fillStyle = withAlpha(color, 0.92);
      ctx.fillText(`x${world.multiplier}`, x + width - 11, y + 20);
      setFont(ctx, 8, FONT.mono, '500');
      ctx.fillStyle = withAlpha(COLORS.mist, 0.4);
      ctx.fillText('MULTIPLIER', x + width - 11, y + 35);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(x + 11, y + 46, width - 22, 2);
      ctx.fillStyle = withAlpha(color, hot ? 0.9 : 0.6);
      ctx.fillRect(x + 11, y + 46, (width - 22) * ratio, 2);
    }
    ctx.restore();
  }

  drawBanner(ctx, world, t) {
    const banner = world.banner;
    if (!banner) return;
    const elapsed = banner.max - banner.time;
    const alpha = clamp(Math.min(elapsed / 0.16, banner.time / 0.3), 0, 1);
    if (alpha <= 0) return;
    const isClear = banner.kind === 'clear';
    const isLife = banner.kind === 'life';
    const color = isClear ? COLORS.cyan : isLife ? COLORS.pink : COLORS.violet;
    const y = 354;

    ctx.save();
    ctx.globalAlpha = alpha;
    const band = ctx.createLinearGradient(0, y - 85, VIEW.width, y + 72);
    band.addColorStop(0, withAlpha(color, 0));
    band.addColorStop(0.32, withAlpha(color, 0.09));
    band.addColorStop(0.5, withAlpha(color, 0.14));
    band.addColorStop(0.68, withAlpha(color, 0.09));
    band.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = band;
    ctx.fillRect(0, y - 75, VIEW.width, 145);

    ctx.strokeStyle = withAlpha(color, 0.42);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(420, y - 52);
    ctx.lineTo(1020, y - 52);
    ctx.moveTo(500, y + 46);
    ctx.lineTo(940, y + 46);
    ctx.stroke();

    ctx.textAlign = 'center';
    setFont(ctx, 9, FONT.mono, '700');
    ctx.fillStyle = withAlpha(color, 0.86);
    trackedText(ctx, banner.note, VIEW.width / 2, y - 67, 3.1, 'center');
    setFont(ctx, 56, FONT.display, '900');
    ctx.fillStyle = withAlpha(COLORS.white, 0.95);
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    ctx.fillText(banner.title, VIEW.width / 2, y + 8);
    ctx.shadowBlur = 0;
    setFont(ctx, 13, FONT.mono, '700');
    ctx.fillStyle = withAlpha(color, 0.94);
    trackedText(ctx, banner.subtitle, VIEW.width / 2, y + 31, 3.6, 'center');
    ctx.restore();
  }

  drawPause(ctx, world, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 2, 10, 0.68)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const x = VIEW.width / 2;
    const y = 430;
    ctx.textAlign = 'center';
    setFont(ctx, 10, FONT.mono, '700');
    ctx.fillStyle = withAlpha(COLORS.cyan, 0.8);
    trackedText(ctx, 'TRANSMISSION HELD', x, y - 54, 4, 'center');
    setFont(ctx, 54, FONT.display, '900');
    ctx.fillStyle = COLORS.white;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 26;
    ctx.fillText('SIGNAL PAUSED', x, y + 6);
    ctx.shadowBlur = 0;
    setFont(ctx, 11, FONT.mono, '600');
    ctx.fillStyle = withAlpha(COLORS.mist, 0.68);
    ctx.fillText('PRESS P OR ESC TO RESUME', x, y + 48);
    ctx.restore();
  }

  drawEnd(ctx, world, t, kind) {
    const won = kind === 'won';
    const accent = won ? COLORS.cyan : COLORS.pink;
    const title = won ? 'GRID PURGED' : 'SIGNAL LOST';
    const subtitle = won
      ? 'ALL SIX SECTORS CLEARED // THE CORE IS SILENT'
      : 'THE GRID HELD THE LINE // REBOOT TO RETRY';
    const cardWidth = 650;
    const cardHeight = 430;
    const x = VIEW.width / 2 - cardWidth / 2;
    const y = 236;

    ctx.save();
    const dim = ctx.createRadialGradient(VIEW.width / 2, 470, 80, VIEW.width / 2, 470, 700);
    dim.addColorStop(0, 'rgba(4, 3, 13, 0.58)');
    dim.addColorStop(0.6, 'rgba(3, 2, 10, 0.82)');
    dim.addColorStop(1, 'rgba(2, 1, 7, 0.94)');
    ctx.fillStyle = dim;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    ctx.shadowColor = accent;
    ctx.shadowBlur = 42;
    roundedPath(ctx, x, y, cardWidth, cardHeight, 18);
    const card = ctx.createLinearGradient(x, y, x, y + cardHeight);
    card.addColorStop(0, 'rgba(15, 9, 33, 0.97)');
    card.addColorStop(1, 'rgba(6, 4, 18, 0.98)');
    ctx.fillStyle = card;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = withAlpha(accent, 0.66);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const topGlow = ctx.createLinearGradient(x, y, x + cardWidth, y);
    topGlow.addColorStop(0, withAlpha(accent, 0));
    topGlow.addColorStop(0.5, withAlpha(accent, 0.72));
    topGlow.addColorStop(1, withAlpha(accent, 0));
    ctx.fillStyle = topGlow;
    ctx.fillRect(x + 40, y, cardWidth - 80, 1.5);

    ctx.strokeStyle = withAlpha(accent, 0.6);
    ctx.lineWidth = 2;
    const corners = [
      [x + 24, y + 24, 1, 1],
      [x + cardWidth - 24, y + 24, -1, 1],
      [x + 24, y + cardHeight - 24, 1, -1],
      [x + cardWidth - 24, y + cardHeight - 24, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * 20);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * 20, cy);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    setFont(ctx, 9, FONT.mono, '700');
    ctx.fillStyle = withAlpha(accent, 0.84);
    trackedText(ctx, won ? 'RUN COMPLETE // SYSTEM REPORT' : 'RUN TERMINATED // SYSTEM REPORT', VIEW.width / 2, y + 46, 3.1, 'center');
    setFont(ctx, 53, FONT.display, '900');
    ctx.fillStyle = COLORS.white;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 30;
    ctx.fillText(title, VIEW.width / 2 - 2, y + 107);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = withAlpha(accent, 0.65);
    ctx.fillText(title, VIEW.width / 2 + 3, y + 107);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    const bar = ctx.createLinearGradient(x + 98, 0, x + cardWidth - 98, 0);
    bar.addColorStop(0, withAlpha(accent, 0));
    bar.addColorStop(0.5, withAlpha(accent, 0.35));
    bar.addColorStop(1, withAlpha(accent, 0));
    ctx.fillStyle = bar;
    ctx.fillRect(x + 98, y + 136, cardWidth - 196, 1);

    setFont(ctx, 10, FONT.mono, '500');
    ctx.fillStyle = withAlpha(COLORS.mist, 0.55);
    ctx.fillText(subtitle, VIEW.width / 2, y + 164);

    const stats = won
      ? [
          ['SCORE', padScore(world.score)],
          ['BEST', padScore(world.best)],
          ['WAVES', `${WAVES.length}/${WAVES.length}`],
        ]
      : [
          ['SCORE', padScore(world.score)],
          ['BEST', padScore(world.best)],
          ['REACHED', `WAVE ${String(world.wave).padStart(2, '0')}`],
        ];
    const column = (cardWidth - 96) / 3;
    for (let i = 0; i < stats.length; i += 1) {
      const cx = x + 48 + column * i + column / 2;
      if (i > 0) {
        ctx.fillStyle = withAlpha(COLORS.dim, 0.18);
        ctx.fillRect(x + 48 + column * i, y + 202, 1, 62);
      }
      setFont(ctx, 9, FONT.mono, '600');
      ctx.fillStyle = withAlpha(COLORS.mist, 0.42);
      trackedText(ctx, stats[i][0], cx, y + 212, 2.4, 'center');
      setFont(ctx, 27, FONT.display, '800');
      ctx.fillStyle = i === 1 ? accent : COLORS.white;
      ctx.fillText(stats[i][1], cx, y + 248);
    }

    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    roundedPath(ctx, VIEW.width / 2 - 198, y + 302, 396, 54, 8);
    ctx.fillStyle = withAlpha(accent, 0.06 + pulse * 0.03);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.46 + pulse * 0.2);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    setFont(ctx, 13, FONT.mono, '700');
    ctx.fillStyle = withAlpha(COLORS.white, 0.92);
    trackedText(ctx, won ? 'PRESS ENTER TO RUN IT BACK' : 'PRESS ENTER TO REBOOT', VIEW.width / 2, y + 335, 2.6, 'center');
    setFont(ctx, 8, FONT.mono, '500');
    ctx.fillStyle = withAlpha(COLORS.mist, 0.38);
    ctx.fillText('SPACE / CLICK ALSO WORKS', VIEW.width / 2, y + 379);
    ctx.restore();
  }

  drawTitle(ctx, world, t) {
    this.drawArena(ctx, world, t, true);

    ctx.save();
    setFont(ctx, 9, FONT.mono, '600');
    ctx.fillStyle = withAlpha(COLORS.cyan, 0.66);
    trackedText(ctx, 'NB-06 // SYNTH ARCADE', ARENA.x, 52, 2.6);
    ctx.textAlign = 'right';
    ctx.fillStyle = withAlpha(COLORS.mist, 0.43);
    trackedText(ctx, 'LOCAL BEST', ARENA.right, 52, 2.4, 'right');
    setFont(ctx, 13, FONT.mono, '700');
    ctx.fillStyle = withAlpha(COLORS.white, 0.78);
    ctx.fillText(padScore(world.best), ARENA.right, 76);

    ctx.fillStyle = withAlpha(COLORS.cyan, 0.16);
    ctx.fillRect(ARENA.x, 94, 1, 22);
    ctx.fillRect(ARENA.x + 6, 94, 42, 1);
    ctx.fillStyle = withAlpha(COLORS.pink, 0.28);
    ctx.fillRect(ARENA.right - 1, 94, 1, 22);
    ctx.fillRect(ARENA.right - 48, 94, 42, 1);

    ctx.textAlign = 'center';
    setFont(ctx, 10, FONT.mono, '600');
    ctx.fillStyle = withAlpha(COLORS.violetSoft, 0.72);
    trackedText(ctx, 'AN ARCADE TRANSMISSION FROM THE OUTER GRID', VIEW.width / 2, 216, 3.15, 'center');

    ctx.strokeStyle = withAlpha(COLORS.pink, 0.24);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(382, 216);
    ctx.lineTo(552, 216);
    ctx.moveTo(888, 216);
    ctx.lineTo(1058, 216);
    ctx.stroke();

    const drift = Math.sin(t * 1.15) * 2;
    const neonFont = 188;
    setFont(ctx, neonFont, FONT.display, '900');
    const titleGradient = ctx.createLinearGradient(430, 250, 1010, 430);
    titleGradient.addColorStop(0, COLORS.cyan);
    titleGradient.addColorStop(0.32, '#e9fbff');
    titleGradient.addColorStop(0.64, COLORS.white);
    titleGradient.addColorStop(1, COLORS.pink);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText('NEON', VIEW.width / 2 - 6 + drift, 374);
    ctx.fillStyle = COLORS.pink;
    ctx.fillText('NEON', VIEW.width / 2 + 6 - drift, 374);
    ctx.globalAlpha = 1;
    ctx.fillStyle = titleGradient;
    ctx.shadowColor = withAlpha(COLORS.pink, 0.7);
    ctx.shadowBlur = 44;
    ctx.fillText('NEON', VIEW.width / 2, 374);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = withAlpha(COLORS.white, 0.34);
    ctx.lineWidth = 1.2;
    ctx.strokeText('NEON', VIEW.width / 2, 374);

    setFont(ctx, 96, FONT.display, '900');
    ctx.fillStyle = COLORS.white;
    ctx.shadowColor = COLORS.pink;
    ctx.shadowBlur = 32;
    const breakerGradient = ctx.createLinearGradient(450, 468, 990, 540);
    breakerGradient.addColorStop(0, COLORS.pinkSoft);
    breakerGradient.addColorStop(0.42, COLORS.pink);
    breakerGradient.addColorStop(0.78, COLORS.violet);
    breakerGradient.addColorStop(1, COLORS.cyan);
    ctx.fillStyle = breakerGradient;
    trackedText(ctx, 'BREAKER', VIEW.width / 2, 498, 7.5, 'center');
    ctx.shadowBlur = 0;
    ctx.fillStyle = withAlpha(COLORS.white, 0.22);
    trackedText(ctx, 'BREAKER', VIEW.width / 2 - 1, 496, 7.5, 'center');

    setFont(ctx, 11, FONT.mono, '600');
    ctx.fillStyle = withAlpha(COLORS.mist, 0.66);
    trackedText(ctx, 'SMASH THE GRID  /  CHASE THE CHAIN  /  OUTRUN THE CORE', VIEW.width / 2, 555, 2.1, 'center');

    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    const ctaX = VIEW.width / 2 - 204;
    const ctaY = 608;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 26 + pulse * 18;
    roundedPath(ctx, ctaX, ctaY, 408, 56, 8);
    const ctaFill = ctx.createLinearGradient(ctaX, ctaY, ctaX + 408, ctaY);
    ctaFill.addColorStop(0, 'rgba(6, 8, 24, 0.9)');
    ctaFill.addColorStop(0.5, 'rgba(12, 20, 42, 0.95)');
    ctaFill.addColorStop(1, 'rgba(6, 8, 24, 0.9)');
    ctx.fillStyle = ctaFill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = withAlpha(COLORS.cyan, 0.46 + pulse * 0.34);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = withAlpha(COLORS.cyan, 0.7);
    ctx.fillRect(ctaX + 10, ctaY + 8, 3, 40);
    ctx.fillRect(ctaX + 395, ctaY + 8, 3, 40);
    ctx.textAlign = 'center';
    setFont(ctx, 14, FONT.mono, '700');
    ctx.fillStyle = withAlpha(COLORS.white, 0.94);
    trackedText(ctx, 'PRESS SPACE TO INITIALIZE', VIEW.width / 2, ctaY + 32, 2.6, 'center');
    setFont(ctx, 8, FONT.mono, '500');
    ctx.fillStyle = withAlpha(COLORS.cyan, 0.52);
    ctx.fillText('CLICK / TAP ALSO WORKS  ·  HEADPHONES RECOMMENDED', VIEW.width / 2, ctaY + 78);

    const controlsY = 742;
    const controls = [
      ['MOVE', 'MOUSE  /  A  D'],
      ['LAUNCH', 'SPACE  /  CLICK'],
      ['SYSTEM', 'P PAUSE  ·  M MUTE'],
    ];
    ctx.strokeStyle = withAlpha(COLORS.dim, 0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(336, controlsY - 36);
    ctx.lineTo(1104, controlsY - 36);
    ctx.stroke();
    controls.forEach(([label, value], index) => {
      const cx = 432 + index * 288;
      setFont(ctx, 8, FONT.mono, '600');
      ctx.fillStyle = withAlpha(COLORS.cyan, 0.48);
      trackedText(ctx, label, cx, controlsY, 2.4, 'center');
      setFont(ctx, 11, FONT.mono, '600');
      ctx.fillStyle = withAlpha(COLORS.white, 0.7);
      trackedText(ctx, value, cx, controlsY + 23, 1.2, 'center');
      if (index < controls.length - 1) {
        ctx.fillStyle = withAlpha(COLORS.dim, 0.18);
        ctx.fillRect(cx + 144, controlsY - 5, 1, 26);
      }
    });

    ctx.textAlign = 'left';
    setFont(ctx, 8, FONT.mono, '500');
    ctx.fillStyle = withAlpha(COLORS.mist, 0.28);
    ctx.fillText('OFFLINE ARCADE BUILD  //  NO QUARTERS REQUIRED', ARENA.x, 858);
    ctx.textAlign = 'right';
    ctx.fillStyle = withAlpha(COLORS.pinkSoft, 0.38);
    ctx.fillText('06 WAVES  /  01 CORE  /  ∞ STYLE', ARENA.right, 858);
    ctx.restore();
  }

  drawPost(ctx, t, world) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.028)';
    for (let y = 0; y < VIEW.height; y += 4) {
      ctx.fillRect(0, y, VIEW.width, 1);
    }
    const vignette = ctx.createRadialGradient(
      VIEW.width / 2,
      VIEW.height / 2,
      VIEW.height * 0.3,
      VIEW.width / 2,
      VIEW.height / 2,
      VIEW.width * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.72, 'rgba(0,0,0,0.24)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.66)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const sweep = ((t * 0.035) % 1) * (VIEW.height + 200) - 100;
    const beam = ctx.createLinearGradient(0, sweep - 70, 0, sweep + 70);
    beam.addColorStop(0, 'rgba(84, 247, 255, 0)');
    beam.addColorStop(0.48, 'rgba(84, 247, 255, 0.012)');
    beam.addColorStop(0.5, 'rgba(255, 255, 255, 0.018)');
    beam.addColorStop(0.52, 'rgba(255, 47, 158, 0.012)');
    beam.addColorStop(1, 'rgba(255, 47, 158, 0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, sweep - 70, VIEW.width, 140);

    if (world.muted) {
      ctx.textAlign = 'left';
      setFont(ctx, 8, FONT.mono, '600');
      ctx.fillStyle = withAlpha(COLORS.mist, 0.42);
      ctx.fillText('AUDIO MUTED', ARENA.x, VIEW.height - 20);
    }
    ctx.restore();
  }
}
