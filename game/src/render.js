// Drawing only: a camera follows the player, the authored city is painted tile by tile, then
// actors, the mission marker and the HUD. Panels sit on top. No game rules live in here.
import {
  COLS, ROWS, TILE, WORLD, PALETTE, FONT,
  TILE_ROAD, TILE_BUILDING, TILE_PARK, TILE_WATER, TILE_SIDEWALK,
} from './config.js';
import { map } from './world.js';

export const SCREEN_START = 'start';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';

const ZOOM = 1.25;
const INK = 'rgba(10,13,18,0.78)';

export function createRenderer(canvas) {
  const c = canvas.getContext('2d');
  const view = { scale: 1, w: 0, h: 0, x: 0, y: 0 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    view.scale = dpr * ZOOM;
    view.w = canvas.width / view.scale;
    view.h = canvas.height / view.scale;
  }
  resize();
  window.addEventListener('resize', resize);

  function box(x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); }
  function dot(x, y, r, color) { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  function label(value, x, y, size, color, align) {
    c.font = `${size}px ${FONT}`;
    c.fillStyle = color;
    c.textAlign = align || 'left';
    c.fillText(value, x, y);
  }

  function camera(player) {
    view.x = view.w >= WORLD.width ? (WORLD.width - view.w) / 2 : Math.max(0, Math.min(WORLD.width - view.w, player.x - view.w / 2));
    view.y = view.h >= WORLD.height ? (WORLD.height - view.h) / 2 : Math.max(0, Math.min(WORLD.height - view.h, player.y - view.h / 2));
  }

  function tiles() {
    const c0 = Math.max(0, Math.floor(view.x / TILE) - 1);
    const r0 = Math.max(0, Math.floor(view.y / TILE) - 1);
    const c1 = Math.min(COLS - 1, Math.ceil((view.x + view.w) / TILE));
    const r1 = Math.min(ROWS - 1, Math.ceil((view.y + view.h) / TILE));
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        const x = col * TILE;
        const y = row * TILE;
        const type = map[row][col];
        if (type === TILE_ROAD) {
          box(x, y, TILE, TILE, PALETTE.road);
          if (col > 0 && map[row][col - 1] === TILE_ROAD) box(x, y + TILE / 2 - 1, TILE, 2, PALETTE.line);
          else if (col < COLS - 1 && map[row][col + 1] === TILE_ROAD) box(x, y + TILE / 2 - 1, TILE, 2, PALETTE.line);
          if (row > 0 && map[row - 1][col] === TILE_ROAD) box(x + TILE / 2 - 1, y, 2, TILE, PALETTE.line);
          else if (row < ROWS - 1 && map[row + 1][col] === TILE_ROAD) box(x + TILE / 2 - 1, y, 2, TILE, PALETTE.line);
        } else if (type === TILE_BUILDING) {
          box(x, y, TILE, TILE, PALETTE.roof);
          box(x + 3, y + 3, TILE - 6, TILE - 6, PALETTE.building);
          for (let i = 0; i < 4; i += 1) {
            if ((col * 7 + row * 11 + i * 3) % 5 < 2) box(x + 8 + (i % 2) * 15, y + 9 + Math.floor(i / 2) * 16, 7, 8, PALETTE.window);
          }
        } else if (type === TILE_PARK) {
          box(x, y, TILE, TILE, PALETTE.park);
          box(x + 6, y + 8, 12, 12, PALETTE.parkDark);
          box(x + 22, y + 20, 12, 12, PALETTE.parkDark);
        } else if (type === TILE_WATER) {
          box(x, y, TILE, TILE, PALETTE.water);
          box(x + 5, y + 12 + ((col + row) % 3) * 5, 24, 2, PALETTE.wave);
          box(x + 14, y + 26, 18, 2, PALETTE.wave);
        } else if (type === TILE_SIDEWALK) {
          box(x, y, TILE, TILE, PALETTE.sidewalk);
        }
      }
    }
  }

  function actors(state) {
    const marker = state.mission.marker;
    if (marker) {
      const pulse = 16 + Math.sin(state.time * 5) * 4;
      c.strokeStyle = PALETTE.spark;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
      c.stroke();
      label(marker.label, marker.x, marker.y - pulse - 8, 14, PALETTE.hud, 'center');
    }
    for (const ped of state.peds) {
      dot(ped.x, ped.y, ped.radius, PALETTE.ped);
      dot(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 3, PALETTE.blood);
    }
    for (const car of state.cars) {
      c.save();
      c.translate(car.x, car.y);
      c.rotate(car.angle);
      box(-car.radius, -car.radius * 0.62, car.radius * 2, car.radius * 1.24, car.color);
      box(-car.radius * 0.2, -car.radius * 0.45, car.radius * 0.9, car.radius * 0.9, '#202936');
      if (car.police) { box(-4, -3, 8, 6, '#e5534b'); box(-4, -3, 4, 6, '#4fc3f7'); }
      c.restore();
    }
    const player = state.player;
    if (player.car) {
      c.save();
      c.translate(player.x, player.y);
      c.rotate(player.angle);
      box(-player.car.radius, -11, player.car.radius * 2, 22, PALETTE.player);
      box(-2, -8, 14, 16, '#202936');
      c.restore();
    } else if (player.alive) {
      dot(player.x, player.y, player.radius, PALETTE.player);
      c.strokeStyle = PALETTE.hud;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(player.x, player.y);
      c.lineTo(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18);
      c.stroke();
    }
    for (const bullet of state.bullets) dot(bullet.x, bullet.y, bullet.radius, PALETTE.bullet);
    for (const part of state.particles) {
      c.globalAlpha = Math.max(0, part.life / part.maxLife);
      box(part.x - part.radius, part.y - part.radius, part.radius * 2, part.radius * 2, part.color);
    }
    c.globalAlpha = 1;
  }

  function hud(state) {
    const W = canvas.width;
    const H = canvas.height;
    box(16, 16, 320, 108, INK);
    label('WANTED', 28, 42, 14, PALETTE.hud);
    for (let i = 0; i < 5; i += 1) label(i < state.wanted ? '★' : '☆', 104 + i * 24, 46, 22, i < state.wanted ? PALETTE.spark : '#5c6472');
    box(28, 58, 140, 10, '#39404d');
    box(28, 58, 140 * (state.player.health / 100), 10, state.player.health > 30 ? '#57c99a' : PALETTE.blood);
    label(`HP ${Math.ceil(state.player.health)}`, 28, 94, 15, PALETTE.hud);
    label(`AMMO ${Math.floor(state.ammo)}`, 126, 94, 15, PALETTE.hud);
    label(`$${Math.floor(state.money)}`, 244, 94, 19, PALETTE.spark);
    box(W - 372, 16, 356, 74, INK);
    label(state.mission.name, W - 356, 42, 17, PALETTE.hud);
    label(state.mission.objective, W - 356, 70, 15, PALETTE.sidewalk);
    const mw = 190;
    const mh = 108;
    const mx = W - mw - 16;
    const my = H - mh - 16;
    box(mx - 5, my - 5, mw + 10, mh + 10, INK);
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const type = map[row][col];
        if (type === TILE_BUILDING) box(mx + col * TILE * sx, my + row * TILE * sy, TILE * sx, TILE * sy, PALETTE.building);
        else if (type === TILE_WATER) box(mx + col * TILE * sx, my + row * TILE * sy, TILE * sx, TILE * sy, PALETTE.water);
        else if (type === TILE_PARK) box(mx + col * TILE * sx, my + row * TILE * sy, TILE * sx, TILE * sy, PALETTE.park);
      }
    }
    const toMap = (point) => [mx + point.x * sx, my + point.y * sy];
    for (const ped of state.peds) { const [px, py] = toMap(ped); dot(px, py, 1.4, PALETTE.ped); }
    for (const car of state.cars) { const [px, py] = toMap(car); dot(px, py, car.police ? 3 : 2.2, car.police ? '#4fc3f7' : PALETTE.spark); }
    if (state.mission.marker) { const [px, py] = toMap(state.mission.marker); dot(px, py, 4, PALETTE.spark); }
    const [hx, hy] = toMap(state.player);
    dot(hx, hy, 4.5, PALETTE.player);
    if (state.messageTimer > 0) label(state.message, W / 2, H - 44, 22, PALETTE.spark, 'center');
  }

  function panel(title, lines, prompt) {
    const w = 580;
    const h = 128 + lines.length * 36;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    box(x, y, w, h, INK);
    label(title, canvas.width / 2, y + 66, 42, PALETTE.hud, 'center');
    for (let i = 0; i < lines.length; i += 1) label(lines[i], canvas.width / 2, y + 108 + i * 36, 19, PALETTE.sidewalk, 'center');
    label(prompt, canvas.width / 2, y + h - 28, 21, PALETTE.spark, 'center');
  }

  function draw(state, screen) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    box(0, 0, canvas.width, canvas.height, PALETTE.backdrop);
    camera(state.player);
    c.setTransform(view.scale, 0, 0, view.scale, -view.x * view.scale, -view.y * view.scale);
    tiles();
    actors(state);
    c.setTransform(1, 0, 0, 1, 0, 0);
    hud(state);
    if (screen === SCREEN_START) panel('GTA 6-01', ['Deliver, rob, and lose the police.', 'WASD to move, mouse to aim, click or Space to fire.', 'E enters a car, P pauses.'], 'Press Enter to play');
    else if (screen === SCREEN_PAUSE) panel('Paused', ['The city is waiting.'], 'Press P to resume');
    else if (screen === SCREEN_OVER) panel('Busted', [`Money $${Math.floor(state.money)}`, `Best $${Math.floor(state.best)}`], 'Press Enter to play again');
  }

  return { draw, resize };
}
