// Deterministic screenshot scenes. ?shot=start|street|chase|mission&seed=N builds a fresh,
// fixed state from the seeded generator (no browser, no timing), so the same seed paints the
// same frame every time. game.js uses makeState for the real run as well.
import { CAR, PED, PALETTE } from './config.js';
import { createRandom } from './random.js';
import { laneDirection, openSpot, roadSpot } from './world.js';
import { createCar, createParticle, createPed, createPlayer } from './entities.js';
import { beginMission, createMission } from './mission.js';
import { SCREEN_PLAY, SCREEN_START } from './render.js';

/** Build a complete, playable state with traffic and pedestrians placed from `random`. */
export function makeState(random) {
  const start = openSpot(random, 16);
  const state = {
    player: createPlayer(start.x, start.y),
    cars: [], peds: [], bullets: [], particles: [],
    wanted: 0, money: 0, best: 0, ammo: 60, time: 0,
    message: '', messageTimer: 0, hurtTimer: 0,
    mission: createMission(random),
  };
  for (let index = 0; index < CAR.count; index += 1) {
    const spot = roadSpot(random);
    state.cars.push(createCar(
      spot.x, spot.y,
      laneDirection(spot.col, spot.row) || { x: 1, y: 0 },
      PALETTE.car[index % PALETTE.car.length],
    ));
  }
  for (let index = 0; index < PED.count; index += 1) {
    const spot = openSpot(random, PED.radius + 3);
    state.peds.push(createPed(spot.x, spot.y));
  }
  return state;
}

/** Return { state, screen, best } for one of the four staged scenes. */
export function stageShot(name, seed = 2026) {
  const random = createRandom(seed);
  const state = makeState(random);
  let screen = SCREEN_PLAY;
  if (name === 'start') {
    screen = SCREEN_START;
    state.money = 0;
  } else if (name === 'chase') {
    state.wanted = 3;
    state.message = 'POLICE IN PURSUIT';
    state.messageTimer = 2;
    for (let index = 0; index < 3; index += 1) {
      const spot = roadSpot(random);
      const car = createCar(spot.x, spot.y, { x: 1, y: 0 }, '#3d6fe0');
      car.police = true;
      car.hits = 0;
      car.speed = 160;
      state.cars.push(car);
    }
  } else if (name === 'mission') {
    beginMission(state.mission, state.player);
    state.money = 640;
    state.ammo = 42;
    state.message = `New mission: ${state.mission.name}`;
    state.messageTimer = 2;
  } else {
    state.money = 120;
    for (let index = 0; index < 10; index += 1) {
      state.particles.push(createParticle(
        state.player.x + (random() - 0.5) * 60,
        state.player.y + (random() - 0.5) * 60,
        PALETTE.spark, 40, random() * Math.PI * 2, 0.6,
      ));
    }
  }
  return { state, screen, best: state.money };
}
