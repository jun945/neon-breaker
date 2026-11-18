// NEON PULSE renderer - synthwave/neon look, logical 1280x720 canvas scaled to viewport.
import { FIELD, PALETTE, FONT, PLAYER } from './config.js';
import { KIND_HAZARD, KIND_NODE } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: FIELD.width, h: FIELD.height };
  const fonts = new Map();
  const labels = new Map();
  let stars = null;

  function font(size, weight) {
    const key = `${weight || ''}${size}`;
    let f = fonts.get(key);
    if (!f) { f = `${weight ? weight + ' ' : ''}${size}px ${FONT}`; fonts.set(key, f); }
    return f;
  }
  function label(prefix, value) {
    const key = prefix + value;
    let l = labels.get(key);
    if (!l) { l = { text: prefix + value, w: 0 }; labels.set(key, l); }
    return l;
  }
  function makeStars() {
    stars = [];
    let s = 1337;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 90; i++) stars.push({ x: rnd() * FIELD.width, y: rnd() * FIELD.height, r: 0.5 + rnd() * 1.6, a: 0.2 + rnd() * 0.5 });
  }
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(w * ratio);
    canvas.height = Math.floor(h * ratio);
    view.scale = Math.min(w / FIELD.width, h / FIELD.height);
    view.x = (w - FIELD.width * view.scale) / 2;
    view.y = (h - FIELD.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);
  if (!stars) makeStars();

  function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function noGlow() { ctx.shadowBlur = 0; }

  function drawBackdrop(state) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, '#0b1024');
    g.addColorStop(0.6, PALETTE.sky);
    g.addColorStop(1, '#141b33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // drifting star field
    for (const s of stars) {
      ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(state.pulse + s.x));
      ctx.fillStyle = '#9fdcff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // perspective grid floor
    const horizon = 150;
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    const scroll = (state.pulse * 26) % 46;
    for (let y = horizon; y < FIELD.height + 46; y += 46) {
      const yy = y - scroll;
      if (yy < horizon) continue;
      ctx.globalAlpha = 0.25 + 0.5 * ((yy - horizon) / (FIELD.height - horizon));
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(FIELD.width, yy); ctx.stroke();
    }
    ctx.globalAlpha = 0.3;
    for (let x = -FIELD.width; x <= FIELD.width * 2; x += 80) {
      ctx.beginPath(); ctx.moveTo(FIELD.width / 2 + (x - FIELD.width / 2) * 0.25, horizon);
      ctx.lineTo(x, FIELD.height); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // horizon sun
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, FIELD.width, horizon); ctx.clip();
    const sun = ctx.createLinearGradient(0, 40, 0, horizon);
    sun.addColorStop(0, '#ff5fa2'); sun.addColorStop(1, '#7a3cff');
    glow('#ff5fa2', 40);
    ctx.fillStyle = sun;
    ctx.beginPath(); ctx.arc(FIELD.width / 2, horizon + 30, 130, 0, Math.PI * 2); ctx.fill();
    noGlow();
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (!blink) {
      const od = state.overdrive;
      glow(od ? PALETTE.overdrive : PALETTE.player, od ? 34 : 22);
      ctx.strokeStyle = od ? PALETTE.overdrive : PALETTE.player;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const r = p.width / 2;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i - Math.PI / 2 + state.pulse * 0.4;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      fillHex(0, 0, r - 7, od ? 'rgba(178,107,255,0.35)' : 'rgba(94,242,255,0.28)');
      glow('#ffffff', 16);
      ctx.fillStyle = PALETTE.playerCore;
      ctx.beginPath(); ctx.arc(0, 0, 7 + Math.sin(state.pulse * 2) * 2, 0, Math.PI * 2); ctx.fill();
      noGlow();
      // motion trail
      if (Math.abs(p.vx) + Math.abs(p.vy) > 10) {
        ctx.strokeStyle = od ? 'rgba(178,107,255,0.4)' : 'rgba(94,242,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(-p.vx * 0.06, -p.vy * 0.06); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function fillHex(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i - Math.PI / 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawItems(state) {
    for (const it of state.items) {
      if (!it.active) continue;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.spin);
      const h = it.width / 2;
      if (it.kind === KIND_NODE) {
        glow(PALETTE.node, 18);
        ctx.strokeStyle = PALETTE.node; ctx.lineWidth = 2.5;
        ctx.strokeRect(-h, -h, it.width, it.height);
        ctx.fillStyle = 'rgba(92,255,177,0.22)';
        ctx.fillRect(-h, -h, it.width, it.height);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = PALETTE.nodeCore; noGlow();
        ctx.fillRect(-5, -5, 10, 10);
      } else {
        glow(PALETTE.hazard, 20);
        ctx.fillStyle = 'rgba(255,61,139,0.28)';
        ctx.fillRect(-h, -h, it.width, it.height);
        ctx.strokeStyle = PALETTE.hazard; ctx.lineWidth = 3;
        ctx.strokeRect(-h, -h, it.width, it.height);
        noGlow();
        ctx.strokeStyle = PALETTE.hazardCore; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-h * 0.45, -h * 0.45); ctx.lineTo(h * 0.45, h * 0.45);
        ctx.moveTo(h * 0.45, -h * 0.45); ctx.lineTo(-h * 0.45, h * 0.45);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      if (!pt.active) continue;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = `hsl(${pt.hue},100%,65%)`;
      glow(`hsl(${pt.hue},100%,60%)`, 10);
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1; noGlow();
  }

  function drawHud2(state, best) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = font(18, '600'); ctx.fillStyle = PALETTE.muted;
    ctx.fillText('SCORE', 32, 24);
    ctx.font = font(44, '700'); ctx.fillStyle = PALETTE.text;
    glow(PALETTE.panelEdge, 14); ctx.fillText(String(state.score).padStart(6, '0'), 30, 42); noGlow();
    ctx.font = font(16, '600'); ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'right'; ctx.fillText('BEST', FIELD.width - 32, 26);
    ctx.font = font(28, '700'); ctx.fillStyle = PALETTE.accent;
    ctx.fillText(String(best), FIELD.width - 32, 46);

    // level + lives center
    ctx.textAlign = 'center';
    ctx.font = font(15, '600'); ctx.fillStyle = PALETTE.muted; ctx.fillText('LEVEL', FIELD.width / 2, 24);
    ctx.font = font(30, '700'); ctx.fillStyle = PALETTE.player; ctx.fillText(String(state.level), FIELD.width / 2, 40);
    ctx.font = font(15, '600'); ctx.fillStyle = PALETTE.muted; ctx.fillText('LIVES', FIELD.width / 2, 82);
    ctx.font = font(22, '700'); ctx.fillStyle = PALETTE.hazard;
    ctx.fillText('◆'.repeat(Math.max(0, state.lives)) + '◇'.repeat(Math.max(0, 3 - state.lives)), FIELD.width / 2, 100);

    // combo meter (left, mid)
    if (state.combo > 0) {
      ctx.textAlign = 'left';
      ctx.font = font(18, '700');
      ctx.fillStyle = state.overdrive ? PALETTE.overdrive : PALETTE.node;
      glow(ctx.fillStyle, 12);
      ctx.fillText(`x${state.multiplier}  COMBO ${state.combo}`, 32, 118);
      noGlow();
    }
    // overdrive banner — right side under BEST, clear of the lives row
    if (state.overdrive) {
      ctx.textAlign = 'right';
      ctx.font = font(20, '800');
      ctx.fillStyle = PALETTE.overdrive;
      glow(PALETTE.overdrive, 18);
      ctx.fillText('OVERDRIVE  x2', FIELD.width - 32, 82);
      noGlow();
    }
  }

  function panel(title, lines, hint, accent) {
    const col = accent || PALETTE.panelEdge;
    ctx.fillStyle = 'rgba(8,12,22,0.82)';
    ctx.fillRect(FIELD.width / 2 - 330, 160, 660, 400);
    ctx.strokeStyle = col; ctx.lineWidth = 2; glow(col, 20);
    ctx.strokeRect(FIELD.width / 2 - 330, 160, 660, 400);
    noGlow();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = font(58, '800'); ctx.fillStyle = PALETTE.text;
    glow(col, 24); ctx.fillText(title, FIELD.width / 2, 232); noGlow();
    ctx.font = font(20, '500'); ctx.fillStyle = PALETTE.muted;
    lines.forEach((ln, i) => ctx.fillText(ln, FIELD.width / 2, 320 + i * 34));
    ctx.font = font(22, '700'); ctx.fillStyle = PALETTE.accent;
    glow(PALETTE.accent, 14); ctx.fillText(hint, FIELD.width / 2, 508); noGlow();
  }

  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake ? (Math.sin(state.pulse * 40) * 8 * state.shake) : 0;
    const shakeY = state.shake ? (Math.cos(state.pulse * 33) * 6 * state.shake) : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale,
      view.x * (window.devicePixelRatio || 1) + shakeX,
      view.y * (window.devicePixelRatio || 1) + shakeY);

    drawBackdrop(state);
    drawItems(state);
    drawParticles(state);
    if (screen !== SCREEN_TITLE) drawPlayer(state);

    if (screen === SCREEN_TITLE) {
      panel('NEON PULSE', [
        'Steer the glowing core. Collect green energy nodes.',
        'Dodge pink disturbances. Chain nodes to build combo.',
        'Reach x9 combo to trigger OVERDRIVE (double points).',
        `BEST  ${best}`,
      ], 'Press SPACE or click to start', PALETTE.panelEdge);
    } else if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud2(state, best);
      if (screen === SCREEN_PAUSED) {
        panel('PAUSED', ['The pulse is holding.'], 'Press P to resume', PALETTE.overdrive);
      }
    } else if (screen === SCREEN_OVER) {
      drawHud2(state, best);
      panel('SIGNAL LOST', [
        `Final score  ${state.score}`,
        `Best combo   x${state.bestCombo >= 0 ? Math.min(8, 1 + Math.floor(state.bestCombo / 3)) : 1}  (${state.bestCombo} nodes)`,
        `Level reached  ${state.level}`,
      ], 'Press SPACE or click to restart', PALETTE.hazard);
    }

    // full-screen flash on hit / pickup
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.35, state.flash * 0.4)})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  return { draw };
}
