// Every constant for the GTA-style city in one place: the tile grid, the colour set and the
// tuning used by input, world and entities. One tile is 40 logical pixels; the grid is 32x18,
// so the whole city is 1280x720 and every rule below is independent of the window size.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const WORLD = { width: COLS * TILE, height: ROWS * TILE };

/** Fixed simulation step: 60 updates a second whatever the display refresh rate. */
export const STEP = 1 / 60;

// Tile ids. Streets and open ground are walkable; buildings and water are solid.
export const TILE_ROAD = 0;
export const TILE_BUILDING = 1;
export const TILE_PARK = 2;
export const TILE_WATER = 3;
export const TILE_SIDEWALK = 4;

export const PALETTE = {
  backdrop: '#0d1016',
  road: '#333a45',
  line: '#c9c15b',
  building: '#5a6072',
  roof: '#717988',
  window: '#d7c98a',
  park: '#3f7d52',
  parkDark: '#2c5d3b',
  water: '#27627f',
  wave: '#3e90ad',
  sidewalk: '#8a8f9c',
  player: '#4fc3f7',
  car: ['#e5534b', '#f2c94c', '#57c99a', '#b07ce0', '#ecf0f4', '#e88b3a'],
  ped: '#e8d6b0',
  bullet: '#fff2b2',
  spark: '#ffd166',
  blood: '#b6444b',
  hud: '#eef1f5',
  panel: '#1b2029',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'gta6-01.best';

export const PLAYER = {
  radius: 11,
  speed: 210,
  health: 100,
  fireDelay: 0.16,
};

export const CAR = {
  radius: 17,
  cruise: 150,
  maxSpeed: 260,
  accel: 130,
  brake: 240,
  reverse: 70,
  turn: 2.6,
  count: 12,
};

export const PED = {
  radius: 7,
  speed: 52,
  flee: 96,
  fleeMul: 1.9,
  wander: 1.6,
  count: 22,
};

export const BULLET = {
  radius: 3,
  speed: 620,
  life: 1.1,
  damage: 18,
};

export const PARTICLE = {
  radius: 2.5,
  pool: 220,
  speed: 130,
  drag: 2.2,
  gravity: 60,
};
