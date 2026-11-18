// Everything that moves: a player on foot or driving, lane-following traffic, fleeing
// pedestrians, bullets and a bounded particle pool. Factories return plain objects; updates
// advance one fixed step and route every move through the world's wall collision.
import { BULLET, CAR, PARTICLE, PED, PLAYER, TILE, WORLD } from './config.js';
import { blocked, laneDirection, resolve } from './world.js';

export function createPlayer(x, y) {
  return { x, y, radius: PLAYER.radius, angle: 0, health: PLAYER.health, cooldown: 0, car: null, alive: true };
}

export function createCar(x, y, dir, color) {
  return {
    x, y, color, radius: CAR.radius,
    angle: Math.atan2(dir.y, dir.x), speed: CAR.cruise * 0.6,
  };
}

export function createPed(x, y) {
  return { x, y, radius: PED.radius, angle: 0, speed: PED.speed, wander: 0, panic: 0 };
}

export function createBullet(x, y, angle, fromPlayer) {
  return {
    x, y, radius: BULLET.radius, active: true, fromPlayer,
    vx: Math.cos(angle) * BULLET.speed,
    vy: Math.sin(angle) * BULLET.speed,
    life: BULLET.life,
  };
}

export function createParticle(x, y, color, speed, angle, life) {
  return {
    x, y, color, life, maxLife: life, radius: PARTICLE.radius,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
  };
}

/** Add a short spray of sparks, capped at the pool size so particles never grow without bound. */
export function burst(list, x, y, color, count, random) {
  for (let i = 0; i < count && list.length < PARTICLE.pool; i += 1) {
    const angle = random() * Math.PI * 2;
    const speed = PARTICLE.speed * (0.3 + random() * 0.7);
    list.push(createParticle(x, y, color, speed, angle, 0.25 + random() * 0.35));
  }
}

/** Enter or leave the nearest car. Returns the car that was entered, or null when leaving. */
export function toggleVehicle(player, cars, radius = 46) {
  if (player.car) {
    const car = player.car;
    const side = { x: player.x + Math.cos(car.angle + Math.PI / 2) * 34, y: player.y + Math.sin(car.angle + Math.PI / 2) * 34 };
    if (!blocked(side.x, side.y, player.radius)) { player.x = side.x; player.y = side.y; }
    player.car = null;
    return null;
  }
  let best = null;
  let bestDistance = radius * radius;
  for (const car of cars) {
    const distance = (car.x - player.x) ** 2 + (car.y - player.y) ** 2;
    if (distance < bestDistance) { best = car; bestDistance = distance; }
  }
  if (best) player.car = best;
  return best;
}

/**
 * One step for the player. `m` is the normalised input vector and `shoot` is true when the
 * fire action or the mouse button is held; `aim` is a unit vector. Bullets go into `bullets`.
 */
export function updatePlayer(player, dt, m, shoot, aim, bullets) {
  player.cooldown = Math.max(0, player.cooldown - dt);
  const car = player.car;
  if (car) {
    car.angle += m.x * CAR.turn * dt;
    if (m.y !== 0) car.speed += m.y * (m.y > 0 ? CAR.accel : CAR.brake) * dt;
    else car.speed *= Math.max(0, 1 - 1.8 * dt);
    if (m.y < 0 && car.speed < 0) car.speed = Math.max(car.speed, -CAR.reverse);
    car.speed = Math.min(car.speed, CAR.maxSpeed);
    const step = car.speed * dt;
    const moved = resolve(car.x, car.y, Math.cos(car.angle) * step, Math.sin(car.angle) * step, car.radius);
    if (moved.x === car.x && moved.y === car.y) car.speed *= -0.25;
    car.x = moved.x;
    car.y = moved.y;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
  } else {
    const step = PLAYER.speed * dt;
    const moved = resolve(player.x, player.y, m.x * step, m.y * step, player.radius);
    player.x = moved.x;
    player.y = moved.y;
    if (m.x !== 0 || m.y !== 0) player.angle = Math.atan2(m.y, m.x);
  }
  if (shoot && player.cooldown === 0 && player.alive) {
    const direction = aim || { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    const nose = player.radius + BULLET.radius + 2;
    bullets.push(createBullet(
      player.x + direction.x * nose,
      player.y + direction.y * nose,
      Math.atan2(direction.y, direction.x),
      true,
    ));
    player.cooldown = PLAYER.fireDelay;
  }
}

/** Traffic AI: aim for the lane direction of the tile under the car, then accelerate into it. */
export function updateCar(car, dt) {
  const col = Math.floor(car.x / TILE);
  const row = Math.floor(car.y / TILE);
  const lane = laneDirection(col, row);
  if (!lane) return false;
  const target = Math.atan2(lane.y, lane.x);
  const diff = Math.atan2(Math.sin(target - car.angle), Math.cos(target - car.angle));
  car.angle += Math.max(-CAR.turn * dt, Math.min(CAR.turn * dt, diff));
  car.speed = Math.min(CAR.cruise, car.speed + CAR.accel * dt);
  const step = car.speed * dt;
  const moved = resolve(car.x, car.y, Math.cos(car.angle) * step, Math.sin(car.angle) * step, car.radius);
  if (moved.x === car.x && moved.y === car.y) car.speed = 0;
  car.x = moved.x;
  car.y = moved.y;
  return car.x > -TILE && car.y > -TILE && car.x < WORLD.width + TILE && car.y < WORLD.height + TILE;
}

/** Pedestrians wander when calm and run directly away from the player when too close. */
export function updatePed(ped, dt, player, random) {
  const dx = player.x - ped.x;
  const dy = player.y - ped.y;
  if (Math.hypot(dx, dy) < PED.flee) {
    ped.panic = 1;
    ped.angle = Math.atan2(-dy, -dx);
  } else {
    ped.panic = Math.max(0, ped.panic - dt);
    ped.wander -= dt;
    if (ped.wander <= 0) {
      ped.wander = PED.wander * (0.5 + random());
      ped.angle += (random() - 0.5) * Math.PI;
    }
    const ahead = PED.radius * 3;
    if (blocked(ped.x + Math.cos(ped.angle) * ahead, ped.y + Math.sin(ped.angle) * ahead, ped.radius)) {
      ped.angle += Math.PI / 2;
    }
  }
  const step = ped.speed * (ped.panic > 0 ? PED.fleeMul : 1) * dt;
  const moved = resolve(ped.x, ped.y, Math.cos(ped.angle) * step, Math.sin(ped.angle) * step, ped.radius);
  ped.x = moved.x;
  ped.y = moved.y;
}

/** Move one bullet. Returns true when it hit a wall and should be replaced with sparks. */
export function updateBullet(bullet, dt) {
  bullet.life -= dt;
  if (bullet.life <= 0) { bullet.active = false; return false; }
  const dx = bullet.vx * dt;
  const dy = bullet.vy * dt;
  const moved = resolve(bullet.x, bullet.y, dx, dy, bullet.radius);
  if (moved.x !== bullet.x + dx || moved.y !== bullet.y + dy) {
    bullet.active = false;
    return true;
  }
  bullet.x = moved.x;
  bullet.y = moved.y;
  return false;
}

/** Move one particle; returns false once its life is exhausted. */
export function updateParticle(particle, dt) {
  particle.life -= dt;
  if (particle.life <= 0) return false;
  const drag = Math.max(0, 1 - PARTICLE.drag * dt);
  particle.vx *= drag;
  particle.vy = particle.vy * drag + PARTICLE.gravity * dt;
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  return true;
}

/** Apply damage and flip the alive flag at zero health; returns true on the killing blow. */
export function hurtPlayer(player, amount) {
  player.health = Math.max(0, player.health - amount);
  if (player.health === 0) player.alive = false;
  return !player.alive;
}
