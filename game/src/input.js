// Keyboard and pointer input for the city. Held keys produce a movement vector; one-shot
// presses are queued as bit flags so a press between two frames is never lost or counted twice.
// The pointer gives an aim point in world pixels, used for shooting while on foot or in a car.
import { WORLD } from './config.js';

export const ACTION_SHOOT = 1;
export const ACTION_ENTER = 2;
export const ACTION_START = 4;
export const ACTION_PAUSE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SHOOT = new Set(['Space']);
const ENTER = new Set(['KeyE']);
const START = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const HANDLED = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, ...SHOOT, ...ENTER, ...START, ...PAUSE]);

export function createInput(canvas) {
  const held = new Set();
  const pointer = { x: WORLD.width / 2, y: WORLD.height / 2, down: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (!HANDLED.has(event.code)) return;
    event.preventDefault();
    if (!event.repeat) {
      if (SHOOT.has(event.code)) actions |= ACTION_SHOOT;
      else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
      else if (START.has(event.code)) actions |= ACTION_START;
      else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    }
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  // Keys released while the tab is hidden never send keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    pointer.down = false;
  });

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    pointer.x = Math.max(0, Math.min(WORLD.width, (event.clientX - rect.left) * sx));
    pointer.y = Math.max(0, Math.min(WORLD.height, (event.clientY - rect.top) * sy));
  }
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    pointer.down = true;
    actions |= ACTION_SHOOT;
  });
  window.addEventListener('pointerup', () => { pointer.down = false; });

  const vector = { x: 0, y: 0 };
  const aim = { x: 0, y: 0 };

  return {
    /** Normalised -1..1 movement vector from WASD or the arrow keys; zero when still. */
    move() {
      let x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      let y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      const length = Math.hypot(x, y);
      if (length > 0) { x /= length; y /= length; }
      vector.x = x;
      vector.y = y;
      return vector;
    },
    /** World-pixel aim point: a held mouse position, or straight ahead when untouched. */
    aim(x, y) {
      const dx = pointer.x - x;
      const dy = pointer.y - y;
      const length = Math.hypot(dx, dy) || 1;
      aim.x = dx / length;
      aim.y = dy / length;
      return aim;
    },
    /** True while the mouse button is held down (automatic fire). */
    firing() {
      return pointer.down;
    },
    /** One-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
