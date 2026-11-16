// The game's rules and state, with no drawing and no browser in it: the
// angkot's drive, the halts, the passengers, the fuel, the timer, the money
// and the reputation. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (sounds, announcements)
// without the world knowing about screens or sound.

import { ANGKOT, FUEL, HALTS, LOOP, PASSENGER, REP, SHIFTS, TRAFFIC } from './config.js';
import { buildCity, buildHalts, buildLoop, loopDistance, pointAt } from './city.js';
import { createPassengers } from './passengers.js';
import { createTraffic } from './traffic.js';

export const EVENT_BOARD = 1;
export const EVENT_FARE = 2;
export const EVENT_ANGRY = 4;
export const EVENT_CRASH = 8;
export const EVENT_REFUEL = 16;
export const EVENT_CLEAR = 32;
export const EVENT_OVER = 64;
export const EVENT_BEEP = 128;
export const EVENT_HORN = 256;

export function createWorld(random) {
  const loop = buildLoop();
  const halts = buildHalts(loop);
  const buildings = buildCity(random, loop);
  const passengers = createPassengers(random);
  const traffic = createTraffic(random);
  const haltColors = halts.map((h) => h.color);

  const state = {
    shift: 0,
    money: 0,
    score: 0,
    reputation: REP.start,
    fuel: FUEL.max,
    timeLeft: SHIFTS[0].seconds,
    angkot: { s: 0, offset: -LOOP.laneOffset, speed: 0, stun: 0, invuln: 0, hornCooldown: 0 },
    served: 0,
    angry: 0,
    crashes: 0,
    earned: 0,
    over: null,
    cleared: false,
    floaters: [],
    shake: 0,
    elapsed: 0,
  };
  let fuelWarned = false;
  let fuelGrace = 0;
  let refueledHere = false;
  let boardTimer = 0;

  function angkotPoint() {
    return pointAt(loop, state.angkot.s);
  }

  /** The halt the angkot is stopped beside, or null when it is not at one. */
  function nearestHalt() {
    let best = null;
    let bestDist = ANGKOT.haltZone;
    for (const halt of halts) {
      const dist = Math.abs(loopDistance(loop, state.angkot.s, halt.s));
      if (dist < bestDist) {
        best = halt;
        bestDist = dist;
      }
    }
    return best;
  }

  function addFloater(text, color) {
    const p = angkotPoint();
    // Stack simultaneous floaters so two of them never print on top of
    // each other (a fare and a crash at the same halt, for example).
    const y = p.y - 46 - 20 * state.floaters.length;
    state.floaters.push({
      x: p.x + (random() - 0.5) * 60,
      y,
      text,
      color,
      ttl: 1.5,
    });
  }

  function startShift(index) {
    state.shift = index;
    state.money = 0;
    state.timeLeft = SHIFTS[index].seconds;
    state.fuel = FUEL.max;
    state.angkot.s = 0;
    state.angkot.offset = -LOOP.laneOffset;
    state.angkot.speed = 0;
    state.angkot.stun = 0;
    state.angkot.invuln = 0;
    state.angkot.hornCooldown = 0;
    state.cleared = false;
    state.over = null;
    state.floaters.length = 0;
    state.elapsed = 0;
    fuelWarned = false;
    fuelGrace = 0;
    refueledHere = false;
    boardTimer = 0;
    passengers.reset();
    traffic.reset();
  }

  function reset() {
    state.score = 0;
    state.served = 0;
    state.angry = 0;
    state.crashes = 0;
    state.earned = 0;
    state.reputation = REP.start;
    startShift(0);
  }

  function endShift(won, reason) {
    state.over = { won, reason };
    return EVENT_OVER;
  }

  /**
   * One fixed step. `control` is { gas, brake, handbrake, steer, horn }.
   * With `attract` set (the title screen's backdrop) the angkot drives
   * itself around and passengers come and go, but nothing scores, nothing
   * runs out, and the shift never ends.
   */
  function step(dt, control, attract) {
    let events = 0;
    state.elapsed += dt;
    const angkot = state.angkot;
    const shift = SHIFTS[state.shift];

    if (angkot.invuln > 0) angkot.invuln -= dt;
    if (angkot.hornCooldown > 0) angkot.hornCooldown -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);

    // Drive: gas, brake, handbrake, drag; the steering nudges the lane.
    if (angkot.stun > 0) {
      angkot.stun -= dt;
      angkot.speed *= Math.max(0, 1 - 2.4 * dt);
    } else if (state.fuel > 0 || attract) {
      if (control.gas) angkot.speed += ANGKOT.accel * dt;
      if (control.brake) angkot.speed -= ANGKOT.brake * dt;
      if (control.handbrake) angkot.speed -= ANGKOT.handbrake * dt;
    } else {
      angkot.speed -= ANGKOT.brake * dt;
    }
    angkot.speed -= ANGKOT.drag * (angkot.speed / ANGKOT.maxSpeed) * dt;
    angkot.speed = Math.min(ANGKOT.maxSpeed, Math.max(0, angkot.speed));
    angkot.offset = Math.min(
      LOOP.laneOffset,
      Math.max(-LOOP.laneOffset, angkot.offset + control.steer * 120 * dt),
    );
    angkot.s = (angkot.s + angkot.speed * dt) % loop.length;

    // The horn: the car ahead in your lane pulls aside.
    if (control.horn && angkot.hornCooldown <= 0) {
      angkot.hornCooldown = 3;
      events |= EVENT_HORN;
      const ahead = traffic.carAhead(loop, angkot.s, angkot.offset, 320);
      if (ahead) ahead.offset = -ahead.offset;
    }

    // Fuel drains with the speed; the SPBU refills it for a flat fare.
    if (!attract && angkot.speed > 5) {
      state.fuel -= FUEL.drainPerSecond * (0.4 + (0.6 * angkot.speed) / ANGKOT.maxSpeed) * dt;
      state.fuel = Math.max(0, state.fuel);
    }
    if (!attract && state.fuel < FUEL.warnAt && !fuelWarned) {
      fuelWarned = true;
      events |= EVENT_BEEP;
    }
    if (state.fuel > FUEL.warnAt + 10) fuelWarned = false;
    const halt = nearestHalt();
    if (
      !attract &&
      halt !== null &&
      halt.landmark === 'spbu' &&
      angkot.speed < ANGKOT.stopSpeed &&
      state.fuel < 95 &&
      !refueledHere
    ) {
      refueledHere = true;
      state.money = Math.max(0, state.money - FUEL.refuelCost);
      state.fuel = FUEL.max;
      events |= EVENT_REFUEL;
      addFloater('BENSIN PENUH  -Rp10.000', '#f1c40f');
    }
    if (halt === null || halt.landmark !== 'spbu') refueledHere = false;
    if (!attract && state.fuel <= 0) {
      fuelGrace += dt;
      if (fuelGrace > 3) events |= endShift(false, 'BENSIN HABIS');
    } else {
      fuelGrace = 0;
    }

    // Passengers arrive, wait, board and pay — or give up and walk away.
    passengers.tickSpawn(dt, shift.spawnEvery, HALTS.length, shift.patience, haltColors);
    const angry = passengers.update(dt);
    if (angry > 0 && !attract) {
      state.angry += angry;
      state.reputation = Math.max(0, state.reputation + REP.angry * angry);
      events |= EVENT_ANGRY;
      addFloater('PENUMPANG KABUR!', '#e74c3c');
    }
    if (halt !== null && angkot.speed < ANGKOT.stopSpeed) {
      boardTimer += dt;
      if (boardTimer >= PASSENGER.boardEvery) {
        boardTimer = 0;
        const fares = passengers.alight(halt.index, HALTS.length);
        for (const paid of fares) {
          if (!attract) {
            state.money += paid.fare;
            state.score += paid.fare;
            state.earned += paid.fare;
            state.reputation = Math.min(REP.max, state.reputation + REP.dropoff);
            state.served += 1;
          }
          events |= EVENT_FARE;
          addFloater(`+Rp${paid.fare.toLocaleString('id-ID')}`, '#2ecc71');
        }
        const free = ANGKOT.seats - passengers.aboard.length;
        const boarded = passengers.board(halt.index, free);
        if (boarded > 0) events |= EVENT_BOARD;
      }
    } else {
      boardTimer = 0;
    }

    // Traffic keeps coming; a bump costs reputation and speed, never a life.
    traffic.update(dt, loop, shift.trafficEvery, shift.trafficMax, angkot, 0.3);
    if (!attract && angkot.invuln <= 0) {
      const hit = traffic.collision(loop, angkot.s, angkot.offset);
      if (hit) {
        state.crashes += 1;
        state.reputation = Math.max(0, state.reputation + REP.crash);
        angkot.speed *= TRAFFIC.crashSlow;
        angkot.stun = TRAFFIC.crashStun;
        angkot.invuln = 2;
        state.shake = 1;
        events |= EVENT_CRASH;
        addFloater(`DUAR!  Reputasi ${String(REP.crash).replace('.', ',')}`, '#e74c3c');
      }
    }

    // The clock: reach the setoran and the shift clears at once; run out of
    // time below it and the shift is lost.
    if (!attract && !state.cleared && state.over === null) {
      state.timeLeft -= dt;
      if (state.money >= shift.target) {
        state.cleared = true;
        const bonus = Math.round(state.reputation * 1000 + Math.max(0, state.timeLeft) * 100);
        state.score += bonus;
        events |= EVENT_CLEAR;
        if (state.shift >= SHIFTS.length - 1) events |= endShift(true, 'JUARA SETORAN');
      } else if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        events |= endShift(false, 'WAKTU HABIS');
      }
    }

    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      state.floaters[i].ttl -= dt;
      state.floaters[i].y -= 26 * dt;
      if (state.floaters[i].ttl <= 0) state.floaters.splice(i, 1);
    }

    return events;
  }

  reset();
  return {
    state,
    loop,
    halts,
    buildings,
    passengers,
    traffic,
    reset,
    startShift,
    step,
    angkotPoint,
    nearestHalt,
  };
}
