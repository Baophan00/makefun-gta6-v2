// The authored city: a 32x18 tile grid of avenues, streets, blocks, a park and a waterfront.
// The map is built once from explicit corridor lists; collision and right-hand lane rules live
// here so cars, pedestrians and bullets all obey the same walls and one-way directions.
import {
  COLS, ROWS, TILE, WORLD,
  TILE_ROAD, TILE_BUILDING, TILE_PARK, TILE_WATER, TILE_SIDEWALK,
} from './config.js';

const AVENUES = [5, 11, 17, 23, 28]; // vertical roads, left to right
const STREETS = [2, 7, 12, 16];      // horizontal roads, top to bottom
const PARK = { c0: 18, c1: 22, r0: 8, r1: 11 };
const WATER = { c0: 24, r0: 13 };

const grid = [];
for (let row = 0; row < ROWS; row += 1) {
  const cells = [];
  for (let col = 0; col < COLS; col += 1) {
    let type = TILE_BUILDING;
    if (AVENUES.includes(col) || STREETS.includes(row)) type = TILE_ROAD;
    if (col >= PARK.c0 && col <= PARK.c1 && row >= PARK.r0 && row <= PARK.r1) type = TILE_PARK;
    if (col >= WATER.c0 && row >= WATER.r0) type = TILE_WATER;
    if (type === TILE_BUILDING
      && col >= PARK.c0 - 1 && col <= PARK.c1 + 1
      && row >= PARK.r0 - 1 && row <= PARK.r1 + 1) type = TILE_SIDEWALK;
    cells.push(type);
  }
  grid.push(cells);
}

/** Read-only tile rows for the renderer; tile ids are the TILE_* constants. */
export const map = grid;

export function tileId(col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return TILE_BUILDING;
  return grid[row][col];
}

export function tileAt(x, y) {
  return tileId(Math.floor(x / TILE), Math.floor(y / TILE));
}

export function center(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

export function isSolid(type) {
  return type === TILE_BUILDING || type === TILE_WATER;
}

export function isRoad(type) {
  return type === TILE_ROAD;
}

/** Right-hand traffic: even-indexed streets run right/down, odd ones run left/up. */
export function laneDirection(col, row) {
  if (tileId(col, row) !== TILE_ROAD) return null;
  const street = STREETS.indexOf(row);
  if (street !== -1) return street % 2 === 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
  const avenue = AVENUES.indexOf(col);
  return avenue % 2 === 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
}

function circleHitsTile(x, y, radius, col, row) {
  const left = col * TILE;
  const top = row * TILE;
  const nx = Math.max(left, Math.min(x, left + TILE));
  const ny = Math.max(top, Math.min(y, top + TILE));
  return (x - nx) ** 2 + (y - ny) ** 2 < radius * radius;
}

/** True when a circle centred at x,y overlaps a solid tile or the world's outer wall. */
export function blocked(x, y, radius) {
  if (x - radius < 0 || y - radius < 0 || x + radius > WORLD.width || y + radius > WORLD.height) return true;
  const c0 = Math.floor((x - radius) / TILE);
  const c1 = Math.floor((x + radius) / TILE);
  const r0 = Math.floor((y - radius) / TILE);
  const r1 = Math.floor((y + radius) / TILE);
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      if (isSolid(tileId(col, row)) && circleHitsTile(x, y, radius, col, row)) return true;
    }
  }
  return false;
}

/** Axis-separated move: slide along a wall instead of stopping dead on impact. */
export function resolve(x, y, dx, dy, radius) {
  let nx = x;
  let ny = y;
  if (!blocked(nx + dx, ny, radius)) nx += dx;
  if (!blocked(nx, ny + dy, radius)) ny += dy;
  return { x: nx, y: ny };
}

/** A walkable, unblocked tile for spawning an actor; falls back to the park's centre. */
export function openSpot(random, radius = 10) {
  for (let tries = 0; tries < 200; tries += 1) {
    const col = 1 + Math.floor(random() * (COLS - 2));
    const row = 1 + Math.floor(random() * (ROWS - 2));
    if (isSolid(tileId(col, row))) continue;
    const spot = center(col, row);
    if (!blocked(spot.x, spot.y, radius)) return spot;
  }
  return center(Math.floor((PARK.c0 + PARK.c1) / 2), Math.floor((PARK.r0 + PARK.r1) / 2));
}

/** A random point on a real road tile, used to place traffic at the start of a run. */
export function roadSpot(random) {
  for (let tries = 0; tries < 200; tries += 1) {
    const col = Math.floor(random() * COLS);
    const row = Math.floor(random() * ROWS);
    if (tileId(col, row) === TILE_ROAD) return { ...center(col, row), col, row };
  }
  return { ...center(AVENUES[0], STREETS[0]), col: AVENUES[0], row: STREETS[0] };
}
