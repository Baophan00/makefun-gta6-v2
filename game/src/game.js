// Simulation and boot: fixed-step updates, wanted level with police pursuit, mission rewards,
// localStorage saves, and the ?shot=... screenshot path. index.html imports boot() from here.
import { PALETTE, STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_ENTER, ACTION_PAUSE, ACTION_SHOOT, ACTION_START } from './input.js';
import { laneDirection, resolve, roadSpot } from './world.js';
import {
  burst, createCar, hurtPlayer, toggleVehicle, updateBullet, updateCar,
  updateParticle, updatePed, updatePlayer,
} from './entities.js';
import { beginMission, DONE, MISSION_LOSE, MISSION_TOTAL, PICKED, updateMission, WANTED } from './mission.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_START } from './render.js';
import { makeState, stageShot } from './shots.js';

const SAVE_KEY = 'gta6-01.save';
function loadSave() {
  try { return JSON.parse(window.localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch { return {}; }
}
function writeSave(data) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage disabled */ }
}

export function boot(canvas) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
  const seed = Number.isInteger(seedParam) ? seedParam : Date.now() >>> 0;
  const renderer = createRenderer(canvas);
  if (shot) {
    const scene = stageShot(shot, seed);
    let painted = 0;
    function paint() {
      renderer.draw(scene.state, scene.screen);
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else window.__shotReady = true;
    }
    requestAnimationFrame(paint);
    return;
  }
  const audio = createAudio();
  const random = createRandom(seed);
  const state = makeState(random);
  const input = createInput(canvas);
  const stored = loadSave();
  let screen = SCREEN_START;
  let accumulator = 0, last = performance.now(), pendingShoot = false;
  let heat = 0, wantedTimer = 0, saveTimer = 0;
  state.money = Number(stored.money) || 0;
  state.best = Number(stored.best) || 0;
  state.mission.index = Number(stored.mission) || 0;

  function persist() {
    const data = { money: Math.floor(state.money), best: Math.floor(state.best), mission: state.mission.index };
    writeSave(data);
    Object.assign(stored, data);
  }
  function say(message) { state.message = message; state.messageTimer = 2.6; }
  function startGame() {
    Object.assign(state, makeState(random));
    state.money = Number(stored.money) || 0;
    state.best = Number(stored.best) || 0;
    state.mission.index = Number(stored.mission) || 0;
    heat = 0; wantedTimer = 0; pendingShoot = false; accumulator = 0;
    screen = SCREEN_PLAY;
    audio.resume();
    say('Go. Press Enter for a mission.');
  }

  function handleActions() {
    const pressed = input.takeActions();
    if (pressed & ACTION_SHOOT) pendingShoot = true;
    if (pressed & ACTION_START) {
      if (screen === SCREEN_START || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PLAY && !state.mission.active) {
        if (state.mission.index % MISSION_TOTAL === MISSION_LOSE && state.wanted === 0) say('Get a wanted level first');
        else {
          beginMission(state.mission, state.player);
          say(state.mission.name);
          audio.cash();
        }
      }
    }
    if (pressed & ACTION_ENTER && screen === SCREEN_PLAY && toggleVehicle(state.player, state.cars)) say('Driving');
    if (pressed & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) screen = SCREEN_PAUSE;
      else if (screen === SCREEN_PAUSE) screen = SCREEN_PLAY;
    }
  }

  function trafficAndPolice(dt) {
    const target = Math.min(5, state.wanted);
    let police = 0;
    for (const car of state.cars) if (car.police) police += 1;
    while (police < target) {
      const spot = roadSpot(random);
      const car = createCar(spot.x, spot.y, laneDirection(spot.col, spot.row) || { x: 1, y: 0 }, '#3d6fe0');
      car.police = true;
      car.hits = 0;
      car.speed = 120;
      state.cars.push(car);
      police += 1;
    }
    for (let i = state.cars.length - 1; i >= 0 && police > target; i -= 1) {
      if (state.cars[i].police) { state.cars.splice(i, 1); police -= 1; }
    }
    for (const car of state.cars) {
      if (!car.police) { updateCar(car, dt); continue; }
      const desired = Math.atan2(state.player.y - car.y, state.player.x - car.x);
      const diff = Math.atan2(Math.sin(desired - car.angle), Math.cos(desired - car.angle));
      car.angle += Math.max(-2 * dt, Math.min(2 * dt, diff));
      car.speed = Math.min(220, car.speed + 180 * dt);
      const step = car.speed * dt;
      const moved = resolve(car.x, car.y, Math.cos(car.angle) * step, Math.sin(car.angle) * step, car.radius);
      if (moved.x === car.x && moved.y === car.y) car.speed = 40;
      car.x = moved.x;
      car.y = moved.y;
      if (state.hurtTimer <= 0 && Math.hypot(car.x - state.player.x, car.y - state.player.y) < car.radius + state.player.radius + 2) {
        hurtPlayer(state.player, 14);
        state.hurtTimer = 0.9;
        audio.hit();
        say('Officer hit you');
      }
    }
  }

  function projectiles(dt) {
    for (const bullet of state.bullets) {
      if (!bullet.active) continue;
      const wall = updateBullet(bullet, dt);
      if (wall) { burst(state.particles, bullet.x, bullet.y, PALETTE.spark, 5, random); continue; }
      for (let i = 0; i < state.cars.length; i += 1) {
        const car = state.cars[i];
        if (Math.hypot(bullet.x - car.x, bullet.y - car.y) >= car.radius) continue;
        bullet.active = false;
        burst(state.particles, bullet.x, bullet.y, PALETTE.spark, 6, random);
        if (car.police && ++car.hits >= 3) {
          state.cars.splice(i, 1);
          state.money += 150;
          audio.cash();
          say('Cop car down +$150');
        } else audio.crash();
        break;
      }
      if (!bullet.active) continue;
      for (let i = state.peds.length - 1; i >= 0; i -= 1) {
        const ped = state.peds[i];
        if (Math.hypot(bullet.x - ped.x, bullet.y - ped.y) >= ped.radius + 2) continue;
        bullet.active = false;
        state.peds.splice(i, 1);
        burst(state.particles, ped.x, ped.y, PALETTE.blood, 8, random);
        state.wanted = Math.min(5, state.wanted + 1);
        wantedTimer = 0;
        audio.hit();
        break;
      }
    }
    state.bullets = state.bullets.filter((bullet) => bullet.active);
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      if (!updateParticle(state.particles[i], dt)) state.particles.splice(i, 1);
    }
  }

  function step(dt) {
    state.time += dt;
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    state.hurtTimer = Math.max(0, state.hurtTimer - dt);
    const shoot = (pendingShoot || input.firing()) && state.ammo > 0 && state.player.alive;
    const before = state.bullets.length;
    updatePlayer(state.player, dt, input.move(), shoot, input.aim(state.player.x, state.player.y), state.bullets);
    pendingShoot = false;
    if (state.bullets.length > before) {
      state.ammo = Math.max(0, state.ammo - 1);
      heat += 1;
      audio.shoot();
    } else if (!shoot) state.ammo = Math.min(60, state.ammo + dt * 5);
    trafficAndPolice(dt);
    for (const ped of state.peds) updatePed(ped, dt, state.player, random);
    projectiles(dt);
    if (heat >= 8) { state.wanted = Math.min(5, state.wanted + 1); wantedTimer = 0; heat = 0; }
    else heat = Math.max(0, heat - dt * 0.7);
    if (state.wanted > 0 && (wantedTimer += dt) > 18) { state.wanted -= 1; wantedTimer = 0; }
    const events = updateMission(state.mission, { player: state.player, wanted: state.wanted, dt });
    if (events & DONE) {
      state.money += state.mission.reward;
      say(`Mission complete +$${state.mission.reward}`);
      audio.mission();
      persist();
    }
    if (events & WANTED) { state.wanted = Math.max(state.wanted, 2); wantedTimer = 0; say('Wanted: 2 stars'); }
    if (events & PICKED) { audio.cash(); say('Package collected'); }
    if ((saveTimer += dt) > 5) { saveTimer = 0; persist(); }
    audio.engine(state.player.car ? state.player.car.speed : 0, !!state.player.car);
    audio.siren(state.wanted);
    if (!state.player.alive) {
      screen = SCREEN_OVER;
      state.best = Math.max(state.best, Math.floor(state.money));
      persist();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, 0.25);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) { step(STEP); accumulator -= STEP; }
    } else accumulator = 0;
    renderer.draw(state, screen);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSE;
  });
  frame(last);
}
