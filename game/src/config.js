// Shared tuning and palette. Everything is authored in a fixed 1440×900 space;
// the renderer letterboxes and scales it to the browser.

export const VIEW = Object.freeze({ width: 1440, height: 900 });

export const ARENA = Object.freeze({
  x: 126,
  y: 166,
  width: 1188,
  height: 694,
  left: 140,
  right: 1300,
  top: 180,
  bottom: 852,
});

export const PADDLE = Object.freeze({
  y: 801,
  width: 158,
  height: 18,
  speed: 1040,
  wideBonus: 58,
  minX: 152,
  maxX: 1288,
});

export const BALL = Object.freeze({
  radius: 9,
  baseSpeed: 575,
  waveSpeed: 22,
  maxSpeed: 1060,
});

export const BRICKS = Object.freeze({
  left: 164,
  top: 252,
  columns: 11,
  rows: 6,
  width: 92,
  height: 28,
  gapX: 10,
  gapY: 10,
});

export const POWERUP = Object.freeze({
  size: 38,
  fallSpeed: 118,
  dropChance: 0.135,
});

export const COLORS = Object.freeze({
  void: '#05030d',
  deep: '#0b0720',
  ink: '#070713',
  cyan: '#54f7ff',
  cyanSoft: '#8ffcff',
  pink: '#ff2f9e',
  pinkSoft: '#ff8ac7',
  violet: '#a768ff',
  violetSoft: '#d4b5ff',
  lime: '#b9ff67',
  amber: '#ffd166',
  coral: '#ff745c',
  white: '#f7fbff',
  mist: 'rgba(198, 229, 255, 0.62)',
  dim: 'rgba(155, 191, 225, 0.35)',
});

export const ROW_COLORS = Object.freeze([
  COLORS.pink,
  COLORS.violet,
  COLORS.cyan,
  COLORS.lime,
  COLORS.amber,
  COLORS.coral,
]);

export const WAVES = Object.freeze([
  { name: 'SIGNAL', tag: 'FIRST CONTACT', rows: 5, speed: 575 },
  { name: 'PHASE', tag: 'DEAD CHANNEL', rows: 5, speed: 598 },
  { name: 'SHATTER', tag: 'HARD LIGHT', rows: 6, speed: 620 },
  { name: 'VERTEX', tag: 'PRISM EVENT', rows: 6, speed: 645 },
  { name: 'OVERDRIVE', tag: 'RED LINE', rows: 6, speed: 676 },
  { name: 'THE CORE', tag: 'FINAL FIREWALL', rows: 6, speed: 705 },
]);

export const POWERUPS = Object.freeze({
  wide: { label: 'WIDE', glyph: 'W', color: COLORS.cyan, blurb: 'PADDLE AMPLIFIED' },
  multi: { label: 'TRI', glyph: '3', color: COLORS.lime, blurb: 'MULTI-PULSE' },
  slow: { label: 'SLOW', glyph: 'S', color: COLORS.violet, blurb: 'TIME DILATION' },
  shield: { label: 'AEGIS', glyph: 'A', color: COLORS.pink, blurb: 'ONE SAVE' },
  life: { label: 'CORE', glyph: '+', color: COLORS.amber, blurb: 'EXTRA SIGNAL' },
});

export const FONT = Object.freeze({
  ui: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  mono: '"Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  display: '"Arial Black", "Segoe UI Black", Impact, sans-serif',
});

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
export const lerp = (a, b, t) => a + (b - a) * t;
export const padScore = (score) => Math.max(0, Math.floor(score)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
