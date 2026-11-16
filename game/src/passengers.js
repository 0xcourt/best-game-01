// The passengers: they wait at halts with a destination and a patience meter,
// board when the angkot stops beside them, ride to their halt, and pay a fare
// on the way out. One who waits too long storms off angry.

import { FARE, PASSENGER } from './config.js';

/** How many halts forward the ride runs from `from` to `to` (1..5). */
export function haltSteps(from, to, haltCount) {
  return ((to - from) % haltCount + haltCount) % haltCount || haltCount;
}

/** The fare for a ride from halt `from` to halt `to`. */
export function fareFor(from, to, haltCount) {
  return FARE.base + FARE.perHalt * haltSteps(from, to, haltCount);
}

export function createPassengers(random) {
  const waiting = [];
  const aboard = [];
  let spawnTimer = 1.5;

  function reset() {
    waiting.length = 0;
    aboard.length = 0;
    spawnTimer = 1.5;
  }

  /** One new passenger appears at a random halt, heading somewhere else. */
  function spawn(haltCount, patienceMax, haltColors) {
    if (waiting.length >= PASSENGER.totalMax) return;
    const origin = Math.floor(random() * haltCount);
    const atHalt = waiting.filter((p) => p.halt === origin).length;
    if (atHalt >= PASSENGER.perHaltMax) return;
    let dest = Math.floor(random() * haltCount);
    if (dest === origin) dest = (dest + 1) % haltCount;
    waiting.push({
      halt: origin,
      dest,
      patience: patienceMax,
      maxPatience: patienceMax,
      color: haltColors[dest],
      bob: random() * Math.PI * 2,
    });
  }

  /** Patience runs down; the ones who run out leave angry. Returns how many left. */
  function update(dt) {
    let angry = 0;
    for (let i = waiting.length - 1; i >= 0; i -= 1) {
      waiting[i].patience -= dt;
      if (waiting[i].patience <= 0) {
        waiting.splice(i, 1);
        angry += 1;
      }
    }
    return angry;
  }

  /** Board up to `seats` waiting passengers at `haltIndex`. Returns how many boarded. */
  function board(haltIndex, seats) {
    let boarded = 0;
    for (let i = waiting.length - 1; i >= 0 && boarded < seats; i -= 1) {
      if (waiting[i].halt !== haltIndex) continue;
      aboard.push({ origin: waiting[i].halt, dest: waiting[i].dest, color: waiting[i].color });
      waiting.splice(i, 1);
      boarded += 1;
    }
    return boarded;
  }

  /**
   * Alight everyone aboard whose destination is `haltIndex`. Returns the fares
   * paid, one per passenger, in riding order.
   */
  function alight(haltIndex, haltCount) {
    const fares = [];
    for (let i = aboard.length - 1; i >= 0; i -= 1) {
      if (aboard[i].dest !== haltIndex) continue;
      const rider = aboard.splice(i, 1)[0];
      fares.push({ fare: fareFor(rider.origin, rider.dest, haltCount), color: rider.color });
    }
    return fares;
  }

  return {
    waiting,
    aboard,
    reset,
    spawn,
    update,
    board,
    alight,
    /** The spawn timer, advanced by the world. */
    tickSpawn(dt, every, haltCount, patienceMax, haltColors) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn(haltCount, patienceMax, haltColors);
        spawnTimer = every;
      }
    },
  };
}
