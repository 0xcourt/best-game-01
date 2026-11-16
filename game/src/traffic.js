// The other traffic on the loop: cars and the odd motorbike that share the
// road, some going your way and some coming at you. They keep their lane, and
// a car behind you brakes and queues instead of rear-ending you while you
// stop at a halt; hitting one still costs reputation and speed.

import { LOOP, TRAFFIC } from './config.js';
import { loopDistance } from './city.js';
import { pick, range } from './random.js';

export function createTraffic(random) {
  const cars = [];
  let spawnTimer = 1;

  function reset() {
    cars.length = 0;
    spawnTimer = 1;
  }

  /** One car joins the loop, far from the angkot so it never pops in on top of it. */
  function spawn(loop, angkotS, oncomingChance) {
    const oncoming = random() < oncomingChance;
    let s = angkotS + range(random, 500, loop.length - 500);
    if (s >= loop.length) s -= loop.length;
    const speed = range(random, TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
    cars.push({
      s,
      offset: pick(random, [-LOOP.laneOffset, LOOP.laneOffset]),
      speed,
      /** Current speed: it brakes toward the target speed below. */
      v: speed,
      oncoming,
      color: pick(random, TRAFFIC.colours),
      length: range(random, 40, 52),
      width: 26,
      kind: random() < 0.18 ? 'motor' : 'mobil',
      wobble: random() * Math.PI * 2,
    });
  }

  /**
   * Advance every car; a car that laps the loop just keeps going. A car in
   * your lane behind a slow or stopped angkot brakes and queues behind it
   * instead of driving into it — the player is not punished for stopping
   * at a halt to pick passengers up.
   */
  function update(dt, loop, every, max, angkot, oncomingChance) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      if (cars.length < max) spawn(loop, angkot.s, oncomingChance);
      spawnTimer = every;
    }
    for (const car of cars) {
      let target = car.speed;
      // Only brake for an angkot that is slowing or stopped for a halt, and
      // only when close — a car behind a braking angkot should queue, not
      // rear-end it, but it re-accelerates fast so no slow platoon forms.
      if (!car.oncoming && angkot.speed < 80) {
        const ahead = loopDistance(loop, car.s, angkot.s);
        const sameLane = Math.abs(car.offset - angkot.offset) < 30;
        if (sameLane && ahead > 0 && ahead < 300) {
          target = Math.max(0, Math.min(car.speed, (ahead - 100) * 1.5));
        }
      }
      // Queue behind a slow car ahead in the same lane, too, so cars never
      // stack on top of each other behind a stopped angkot.
      for (const other of cars) {
        if (other === car || other.oncoming !== car.oncoming) continue;
        const ahead = loopDistance(loop, car.s, other.s);
        const sameLane = Math.abs(car.offset - other.offset) < 30;
        if (sameLane && ahead > 0 && ahead < 300 && other.v < car.v) {
          target = Math.min(target, Math.max(0, (ahead - 70) * 1.5));
        }
      }
      const accel = target < car.v ? 320 : 250;
      car.v += Math.max(-accel * dt, Math.min(accel * dt, target - car.v));
      car.s = (car.s + (car.oncoming ? -car.v : car.v) * dt) % loop.length;
      if (car.s < 0) car.s += loop.length;
      car.wobble += dt * 2;
    }
  }

  /**
   * The first car overlapping the angkot's box, or null. Two boxes overlap
   * when they are close along the loop and close across it.
   */
  function collision(loop, angkotS, angkotOffset) {
    for (const car of cars) {
      const along = loopDistance(loop, angkotS, car.s);
      const across = Math.abs(angkotOffset - car.offset);
      const reach = (car.length + 54) / 2;
      if (Math.abs(along) < reach && across < (car.width + 30) / 2) return car;
    }
    return null;
  }

  /** The nearest car ahead in the angkot's lane, within `ahead` units, or null. */
  function carAhead(loop, angkotS, angkotOffset, ahead) {
    let best = null;
    let bestDist = ahead;
    for (const car of cars) {
      if (car.oncoming) continue;
      const dist = loopDistance(loop, angkotS, car.s);
      if (dist > 0 && dist < bestDist && Math.abs(angkotOffset - car.offset) < 30) {
        best = car;
        bestDist = dist;
      }
    }
    return best;
  }

  return { cars, reset, update, collision, carAhead };
}
