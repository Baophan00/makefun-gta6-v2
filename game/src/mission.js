// Three short missions with markers, progress and rewards. Missions own their objectives;
// the game loop owns money, wanted level and the save file. updateMission returns event bits.
import { roadSpot } from './world.js';

export const MISSION_DELIVER = 0;
export const MISSION_ROB = 1;
export const MISSION_LOSE = 2;
export const MISSION_TOTAL = 3;
export const NAMES = ['Deliver the package', 'Rob the store', 'Lose the police'];

export const DONE = 1;
export const PICKED = 2;
export const WANTED = 4;

function farSpot(random, from, minimum = 380) {
  let best = roadSpot(random);
  for (let tries = 0; tries < 24; tries += 1) {
    const candidate = roadSpot(random);
    if (Math.hypot(candidate.x - from.x, candidate.y - from.y) >= minimum) return candidate;
    if (Math.hypot(candidate.x - from.x, candidate.y - from.y) > Math.hypot(best.x - from.x, best.y - from.y)) best = candidate;
  }
  return best;
}

export function createMission(random) {
  return {
    random, index: 0, kind: MISSION_DELIVER, active: false, stage: 0, hold: 0,
    marker: null, pickup: null, dropoff: null, reward: 0, name: NAMES[0],
    objective: 'Press Enter to start a mission',
  };
}

/** Lay out the current mission's locations around the player. */
export function beginMission(mission, player) {
  mission.active = true;
  mission.stage = 0;
  mission.hold = 0;
  mission.kind = mission.index % MISSION_TOTAL;
  mission.name = NAMES[mission.kind];
  if (mission.kind === MISSION_DELIVER) {
    mission.pickup = farSpot(mission.random, player, 120);
    mission.dropoff = farSpot(mission.random, mission.pickup);
    mission.marker = { x: mission.pickup.x, y: mission.pickup.y, label: 'PACKAGE' };
    mission.objective = 'Pick up the package';
    mission.reward = 250;
  } else if (mission.kind === MISSION_ROB) {
    const store = farSpot(mission.random, player, 160);
    mission.marker = { x: store.x, y: store.y, label: 'STORE' };
    mission.objective = 'Hold still at the store to rob it';
    mission.reward = 400;
  } else {
    mission.marker = null;
    mission.objective = 'Lose the police: reach 0 stars';
    mission.reward = 300;
  }
  return mission;
}

function finish(mission) {
  mission.active = false;
  mission.marker = null;
  mission.stage = 0;
  mission.hold = 0;
  mission.index = (mission.index + 1) % MISSION_TOTAL;
  mission.objective = 'Press Enter for the next mission';
}

/** Advance an active mission. ctx must provide { player, wanted, dt }. */
export function updateMission(mission, ctx) {
  if (!mission.active) return 0;
  const { player, dt, wanted } = ctx;
  const here = (spot, radius) => Math.hypot(player.x - spot.x, player.y - spot.y) < radius;
  let events = 0;
  if (mission.kind === MISSION_DELIVER) {
    const target = mission.stage === 0 ? mission.pickup : mission.dropoff;
    if (target && here(target, 34)) {
      if (mission.stage === 0) {
        mission.stage = 1;
        mission.marker = { x: mission.dropoff.x, y: mission.dropoff.y, label: 'DROP OFF' };
        mission.objective = 'Deliver the package to the drop-off';
        events |= PICKED;
      } else {
        events |= DONE;
        finish(mission);
      }
    }
  } else if (mission.kind === MISSION_ROB) {
    if (mission.marker && here(mission.marker, 42)) {
      mission.hold += dt;
      mission.objective = `Robbing... ${Math.max(0, 2.5 - mission.hold).toFixed(1)}s left`;
      if (mission.hold >= 2.5) {
        events |= DONE | WANTED;
        finish(mission);
      }
    } else {
      mission.hold = Math.max(0, mission.hold - dt * 0.5);
    }
  } else if (mission.kind === MISSION_LOSE) {
    if (wanted <= 0) {
      events |= DONE;
      finish(mission);
    } else {
      mission.objective = `Lose the police: ${wanted} stars`;
    }
  }
  return events;
}
