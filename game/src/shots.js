// The screenshot scenes behind ?shot=start|play|play2|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (slow for halts with waiting passengers, change lane
// for traffic, brake when blocked, refuel when low), so the frame is what a
// short game really looks like and the same seed always gives the same frame.

import { ANGKOT, LOOP, STEP } from './config.js';
import { loopDistance } from './city.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 45;
const PLAY2_SECONDS = 40;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** The autopilot's control for one step: gas, brake, lane and horn. */
export function autopilot(world) {
  const { state } = world;
  const angkot = state.angkot;
  const loop = world.loop;
  const homeLane = -LOOP.laneOffset;

  // The next halt worth stopping at: one with waiting passengers, one where
  // someone aboard gets off, or the SPBU when the tank is low.
  let targetHalt = null;
  let targetDist = Infinity;
  for (const halt of world.halts) {
    const dist = loopDistance(loop, angkot.s, halt.s);
    if (dist < 0 || dist > 620) continue;
    const waiting = world.passengers.waiting.some((p) => p.halt === halt.index);
    const alighting = world.passengers.aboard.some((p) => p.dest === halt.index);
    const refuel = halt.landmark === 'spbu' && state.fuel < 35;
    if ((waiting || alighting || refuel) && dist < targetDist) {
      targetHalt = halt;
      targetDist = dist;
    }
  }

  // Traffic in the way: a car ahead in this lane, or one coming at this lane.
  // Only cars AHEAD count — a car queued behind the angkot is never a reason
  // to slow down (counting it deadlocked the autopilot at halts).
  let blocked = false;
  let blockedDist = Infinity;
  for (const car of world.traffic.cars) {
    const along = loopDistance(loop, angkot.s, car.s);
    const across = Math.abs(angkot.offset - car.offset);
    if (across < 30 && along > 0 && along < 260 && along < blockedDist) {
      blocked = true;
      blockedDist = along;
    }
  }
  // The other lane is free when no car sits in it near the angkot. An
  // oncoming car needs a much bigger gap: it closes the distance fast, and
  // the overtake takes a second or two.
  const otherLaneFree = !world.traffic.cars.some((car) => {
    const along = loopDistance(loop, angkot.s, car.s);
    const gap = car.oncoming ? 450 : 200;
    return Math.abs(angkot.offset + car.offset) < 30 && Math.abs(along) < gap;
  });

  let targetSpeed = ANGKOT.maxSpeed * 0.78;
  let targetOffset = homeLane;
  let horn = false;
  if (targetHalt !== null) {
    // Creep in: the closer the halt, the slower, so the angkot stops on it
    // instead of sailing past it.
    if (targetDist < 30) targetSpeed = 0;
    else if (targetDist < 300) targetSpeed = Math.min(140, targetDist * 1.1);
  }
  if (blocked) {
    if (otherLaneFree && blockedDist > 60) targetOffset = -angkot.offset;
    else if (blockedDist < 150) targetSpeed = 0;
    else targetSpeed = Math.min(targetSpeed, 150);
    if (blockedDist < 120 && !otherLaneFree) horn = true;
  }
  // Abort an overtake: if we are in the oncoming lane and a car is coming
  // at us, get back to the home lane now instead of finishing the pass.
  if (angkot.offset > 0) {
    for (const car of world.traffic.cars) {
      if (!car.oncoming) continue;
      const along = loopDistance(loop, angkot.s, car.s);
      if (along > 0 && along < 400 && Math.abs(car.offset - angkot.offset) < 30) {
        targetOffset = homeLane;
        break;
      }
    }
  }

  const control = { gas: false, brake: false, handbrake: false, steer: 0, horn };
  if (angkot.speed < targetSpeed - 12) control.gas = true;
  else if (angkot.speed > targetSpeed + 12) control.brake = true;
  if (targetSpeed === 0 && angkot.speed > 40) control.handbrake = true;
  const want = targetOffset - angkot.offset;
  control.steer = want > 5 ? 1 : want < -5 ? -1 : 0;
  return control;
}

/**
 * Set `world` to the named scene (start, play, play2 or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'play2' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play2') {
    world.startShift(1);
    world.state.fuel = 24;
    for (let i = 0; i < 8; i += 1) {
      world.passengers.spawn(6, 36, world.halts.map((h) => h.color));
    }
    for (let index = 0; index < PLAY2_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world), false);
      if (world.state.over !== null) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world), false);
    if (name === 'play' && index > PLAY_SECONDS / 3 && world.state.money > 0 && world.passengers.aboard.length > 0) break;
    if (world.state.over !== null || world.state.cleared) break;
    if (name === 'end' && events === 0) {
      // Keep driving until the shift clears or the limit runs out.
    }
  }
  if (world.state.over !== null) return { screen: SCREEN_OVER, best: world.state.score };
  if (world.state.cleared) return { screen: SCREEN_CLEAR, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
