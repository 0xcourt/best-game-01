// The city itself: the rounded-rectangle loop the angkot route follows, the six
// halts along it, and the buildings that fill the blocks inside and outside the
// loop. Everything is laid out from the seed, so the same seed builds the same
// city every time.

import { HALTS, LOOP } from './config.js';
import { pick, range } from './random.js';

/** The loop as an evenly spaced polyline, so a distance along it is an index. */
export function buildLoop() {
  const { halfWidth: hx, halfHeight: hy, cornerRadius: r } = LOOP;
  const points = [];
  const spacing = 8;

  function straight(x0, y0, x1, y1) {
    const length = Math.hypot(x1 - x0, y1 - y0);
    const count = Math.max(1, Math.round(length / spacing));
    for (let i = 0; i < count; i += 1) {
      points.push({ x: x0 + ((x1 - x0) * i) / count, y: y0 + ((y1 - y0) * i) / count });
    }
  }

  function arc(cx, cy, fromAngle, toAngle) {
    const sweep = toAngle - fromAngle;
    const length = Math.abs(sweep) * r;
    const count = Math.max(1, Math.round(length / spacing));
    for (let i = 0; i < count; i += 1) {
      const a = fromAngle + (sweep * i) / count;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  }

  // Clockwise, starting at the top edge heading east.
  straight(-hx + r, -hy, hx - r, -hy);
  arc(hx - r, -hy + r, -Math.PI / 2, 0);
  straight(hx, -hy + r, hx, hy - r);
  arc(hx - r, hy - r, 0, Math.PI / 2);
  straight(hx - r, hy, -hx + r, hy);
  arc(-hx + r, hy - r, Math.PI / 2, Math.PI);
  straight(-hx, hy - r, -hx, -hy + r);
  arc(-hx + r, -hy + r, Math.PI, (3 * Math.PI) / 2);

  const length = points.length * spacing;
  return { points, length, spacing };
}

/** Where the loop is at distance `s` along it: position and heading angle. */
export function pointAt(loop, s) {
  const wrapped = ((s % loop.length) + loop.length) % loop.length;
  const index = Math.floor(wrapped / loop.spacing);
  const next = (index + 1) % loop.points.length;
  const frac = wrapped / loop.spacing - index;
  const a = loop.points[index];
  const b = loop.points[next];
  const x = a.x + (b.x - a.x) * frac;
  const y = a.y + (b.y - a.y) * frac;
  return { x, y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** The shortest signed distance from `from` to `to` along the loop: positive ahead. */
export function loopDistance(loop, from, to) {
  const forward = (((to - from) % loop.length) + loop.length) % loop.length;
  return forward > loop.length / 2 ? forward - loop.length : forward;
}

/** The outward direction at a loop point: away from the city centre. */
function outwardAt(point) {
  const length = Math.hypot(point.x, point.y) || 1;
  return { x: point.x / length, y: point.y / length };
}

/** The halts with their world position, heading and platform spot beside the road. */
export function buildHalts(loop) {
  return HALTS.map((halt, index) => {
    const s = halt.at * loop.length;
    const point = pointAt(loop, s);
    const out = outwardAt(point);
    return {
      ...halt,
      index,
      s,
      x: point.x,
      y: point.y,
      angle: point.angle,
      platformX: point.x + out.x * (LOOP.roadWidth / 2 + 58),
      platformY: point.y + out.y * (LOOP.roadWidth / 2 + 58),
    };
  });
}

const BUILDING_COLOURS = ['#e8b4b8', '#f4d35e', '#a8d5ba', '#f7ede2', '#b8c6db', '#e5989b', '#ffd6a5'];
const ROOF_COLOURS = ['#b3402f', '#7a4a2b', '#3e6b48', '#33506b', '#6b3a5d'];

/** The buildings of the city, seeded: blocks inside the loop and streets outside it. */
export function buildCity(random, loop) {
  const buildings = [];
  const margin = LOOP.roadWidth / 2 + 78;

  function farFromRoad(x, y) {
    for (let i = 0; i < loop.points.length; i += 12) {
      const p = loop.points[i];
      if (Math.abs(p.x - x) < margin && Math.abs(p.y - y) < margin) {
        if (Math.hypot(p.x - x, p.y - y) < margin) return false;
      }
    }
    return true;
  }

  for (let gx = -1300; gx <= 1300; gx += 165) {
    for (let gy = -880; gy <= 880; gy += 165) {
      if (random() < 0.22) continue;
      const x = gx + range(random, -28, 28);
      const y = gy + range(random, -28, 28);
      if (!farFromRoad(x, y)) continue;
      const type = pick(random, ['rumah', 'toko', 'kantor', 'warung', 'taman']);
      if (type === 'taman') {
        buildings.push({ x, y, w: 120, h: 100, type, color: '#5d9b4a', roof: '#4a7d3a' });
        continue;
      }
      buildings.push({
        x,
        y,
        w: range(random, 74, 138),
        h: range(random, 62, 118),
        type,
        color: pick(random, BUILDING_COLOURS),
        roof: pick(random, ROOF_COLOURS),
        windows: Math.floor(random() * 100000),
      });
    }
  }
  return buildings;
}
