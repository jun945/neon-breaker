// NEON PULSE - tunable constants. Rule code never reads real screen size.
export const FIELD = { width: 1280, height: 720, groundY: 662 };
export const STEP = 1 / 60;

export const PLAYER = {
  width: 58, height: 58, speed: 640, invulnerable: 1.7,
};
export const LIVES = 3;

// Energy nodes (pickups)
export const NODE = {
  size: 26, speed: 205, speedPerLevel: 15,
  interval: 0.82, intervalJitter: 0.45, minInterval: 0.2, points: 10,
};
// Disturbance blocks (hazards)
export const HAZARD = {
  size: 44, speed: 265, speedPerLevel: 34, speedJitter: 120,
  interval: 0.6, intervalScale: 0.9, minInterval: 0.15,
};

export const LEVEL = { seconds: 15, max: 12 };

// Combo multiplier: 1 + floor(combo / step), capped at max. Overdrive doubles it.
export const COMBO = { step: 3, max: 8 };
export const OVERDRIVE = { combo: 9, seconds: 6 };

export const POOL_SIZE = 96;
export const PARTICLES = 180;
export const SHAKE_DECAY = 3.4;

export const PALETTE = {
  backdrop: '#080b14', sky: '#0d1220', grid: '#16203a', ground: '#1b2742',
  player: '#5ef2ff', playerCore: '#ffffff',
  node: '#5cffb1', nodeCore: '#eafff5',
  hazard: '#ff3d8b', hazardCore: '#ffd0e6',
  text: '#eaf6ff', muted: '#7f93b5', accent: '#ffd166',
  overdrive: '#b26bff', panel: '#0e1628', panelEdge: '#2de2e6',
};
export const FONT = 'ui-monospace, "SFMono-Regular", Consolas, monospace';
export const BEST_KEY = 'neon-pulse.best';
