// Everything on the screen: the city, the road, the angkot, the traffic, the
// passengers, the HUD and the title, pause, clear and game-over screens. The
// camera follows the angkot (north-up, never rotating), so the road bends
// under a steady view; the HUD is drawn in screen space on top.

import { ANGKOT, FIELD, FONT, HALTS, LOOP, PALETTE } from './config.js';
import { pointAt } from './city.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_CLEAR = 3;
export const SCREEN_OVER = 4;

/** The clickable buttons, in logical pixels, for the menu hit-testing. */
export const BUTTONS = {
  start: { x: 490, y: 566, w: 300, h: 64 },
  next: { x: 490, y: 520, w: 300, h: 64 },
  again: { x: 490, y: 520, w: 300, h: 64 },
  mute: { x: 1224, y: 12, w: 44, h: 44 },
};

/** Indonesian rupiah, e.g. 60000 -> "Rp60.000". */
export function rupiah(value) {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

function mmss(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'left', weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = Math.max(2, size / 7);
    ctx.strokeStyle = 'rgba(10, 12, 18, 0.85)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function button(rect, label, accent) {
    ctx.fillStyle = accent;
    roundRect(rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 9, 26, '#14202a', 'center', 800);
  }

  function drawGround(world) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(-1600, -1100, 3200, 2200);
    // Mown stripes so the grass is not one flat colour.
    ctx.fillStyle = PALETTE.grassDark;
    for (let y = -1000; y < 1000; y += 160) ctx.fillRect(-1600, y, 3200, 80);
  }

  function drawBuildings(world) {
    for (const b of world.buildings) {
      if (b.type === 'taman') {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3f7a34';
        ctx.beginPath();
        ctx.arc(b.x - 28, b.y - 12, 16, 0, Math.PI * 2);
        ctx.arc(b.x + 22, b.y + 8, 19, 0, Math.PI * 2);
        ctx.arc(b.x + 4, b.y - 26, 13, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x - b.w / 2 + 5, b.y - b.h / 2 + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, 12);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      // Windows in a seeded pattern, some lit.
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor((b.h - 20) / 26));
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const lit = (b.windows + r * 7 + c * 13) % 5 === 0;
          ctx.fillStyle = lit ? '#ffe08a' : 'rgba(20, 28, 40, 0.55)';
          ctx.fillRect(b.x - b.w / 2 + 10 + c * 26, b.y - b.h / 2 + 20 + r * 26, 14, 14);
        }
      }
    }
  }

  function drawRoad(world) {
    const { points } = world.loop;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = PALETTE.sidewalk;
    ctx.lineWidth = LOOP.roadWidth + 16;
    ctx.stroke();
    ctx.strokeStyle = PALETTE.road;
    ctx.lineWidth = LOOP.roadWidth;
    ctx.stroke();
    ctx.strokeStyle = PALETTE.laneDash;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawLandmark(halt) {
    // The landmark stands beyond the platform, away from the road, so it
    // never covers the halt-name sign (which sits on the road side).
    const dx = halt.platformX - halt.x;
    const dy = halt.platformY - halt.y;
    const len = Math.hypot(dx, dy) || 1;
    const x = halt.platformX + (dx / len) * 78;
    const y = halt.platformY + (dy / len) * 78;
    ctx.save();
    ctx.translate(x, y);
    if (halt.landmark === 'masjid') {
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(-34, -8, 68, 34);
      ctx.beginPath();
      ctx.arc(0, -8, 22, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-30, -34, 5, 26);
      ctx.fillRect(25, -34, 5, 26);
      ctx.beginPath();
      ctx.arc(-27, -36, 4, 0, Math.PI * 2);
      ctx.arc(27, -36, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (halt.landmark === 'spbu') {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-40, -26, 80, 12);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-34, -14, 12, 40);
      ctx.fillRect(22, -14, 12, 40);
      ctx.fillStyle = '#fff';
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SPBU', 0, -30);
    } else if (halt.landmark === 'pasar') {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-38, -20, 76, 12);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i += 1) ctx.fillRect(-38 + i * 20, -20, 10, 12);
      ctx.fillStyle = '#8e44ad';
      ctx.fillRect(-30, -8, 60, 34);
    } else if (halt.landmark === 'stasiun') {
      ctx.fillStyle = '#8e44ad';
      ctx.fillRect(-36, -22, 72, 48);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, -8, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, -16);
      ctx.moveTo(0, -8);
      ctx.lineTo(7, -5);
      ctx.stroke();
    } else if (halt.landmark === 'kampus') {
      ctx.fillStyle = '#3498db';
      ctx.fillRect(-34, -16, 68, 42);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-34, -16, 68, 8);
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.lineTo(0, -16);
      ctx.lineTo(26, -32);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(-40, -18, 80, 44);
      ctx.fillStyle = '#2c3e50';
      ctx.font = `800 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('TERMINAL', 0, -22);
    }
    ctx.restore();
  }

  function drawHalts(world) {
    for (const halt of world.halts) {
      // Platform beside the road.
      ctx.fillStyle = PALETTE.sidewalk;
      roundRect(halt.platformX - 64, halt.platformY - 26, 128, 52, 10);
      ctx.fill();
      ctx.strokeStyle = halt.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Sign post with the halt name, on the road side of the platform
      // (toward the road, never toward the landmark beyond the platform).
      const odx = halt.platformX - halt.x;
      const ody = halt.platformY - halt.y;
      const olen = Math.hypot(odx, ody) || 1;
      const ox = odx / olen;
      const oy = ody / olen;
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(halt.platformX - ox * 26, halt.platformY - oy * 26);
      ctx.lineTo(halt.platformX - ox * 62, halt.platformY - oy * 62);
      ctx.stroke();
      const signX = halt.platformX - ox * 75;
      const signY = halt.platformY - oy * 75;
      ctx.fillStyle = halt.color;
      roundRect(signX - 52, signY - 13, 104, 26, 6);
      ctx.fill();
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(halt.name, signX, signY + 5);
      drawLandmark(halt);
      // Waiting passengers, each with a ring in the colour of their destination.
      const waiting = world.passengers.waiting.filter((p) => p.halt === halt.index);
      waiting.forEach((person, i) => {
        const px = halt.platformX - 44 + (i % 4) * 30;
        const py = halt.platformY + 6 + Math.floor(i / 4) * 22 + Math.sin(person.bob + world.state.elapsed * 3) * 2;
        ctx.fillStyle = person.color;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#14202a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#f4d7b0';
        ctx.beginPath();
        ctx.arc(px, py - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        // Patience ring.
        ctx.strokeStyle = person.patience / person.maxPatience > 0.35 ? '#2ecc71' : '#e74c3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 13, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * person.patience) / person.maxPatience);
        ctx.stroke();
      });
    }
  }

  function drawVehicle(x, y, angle, length, width, body, stripe, label) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, length / 2 + 2, width / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    roundRect(-length / 2, -width / 2, length, width, 7);
    ctx.fill();
    ctx.fillStyle = stripe;
    ctx.fillRect(-length / 2 + 4, -width / 2 + 3, length - 8, 5);
    ctx.fillStyle = 'rgba(200, 225, 255, 0.9)';
    roundRect(length / 2 - 14, -width / 2 + 6, 10, width - 12, 3);
    ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(length / 2 - 1, -width / 2 + 5, 2.5, 0, Math.PI * 2);
    ctx.arc(length / 2 - 1, width / 2 - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (label) {
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 0, 4);
    }
    ctx.restore();
  }

  function drawTraffic(world) {
    for (const car of world.traffic.cars) {
      const p = pointAt(world.loop, car.s);
      if (car.kind === 'motor') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(car.oncoming ? p.angle + Math.PI : p.angle);
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4d7b0';
        ctx.beginPath();
        ctx.arc(-2, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawVehicle(p.x, p.y, car.oncoming ? p.angle + Math.PI : p.angle, car.length, car.width, car.color, 'rgba(255,255,255,0.25)', '');
      }
    }
  }

  function drawAngkot(world, steer) {
    const { state } = world;
    const p = pointAt(world.loop, state.angkot.s);
    const bob = Math.sin(state.elapsed * 9) * (state.angkot.speed / ANGKOT.maxSpeed) * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(p.angle + steer * 0.05);
    // Wheels.
    ctx.fillStyle = '#14181f';
    ctx.fillRect(-18, -ANGKOT.width / 2 - 3, 12, 5);
    ctx.fillRect(8, -ANGKOT.width / 2 - 3, 12, 5);
    ctx.fillRect(-18, ANGKOT.width / 2 - 2, 12, 5);
    ctx.fillRect(8, ANGKOT.width / 2 - 2, 12, 5);
    // Body.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(2, 4, ANGKOT.length / 2 + 2, ANGKOT.width / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.angkot;
    roundRect(-ANGKOT.length / 2, -ANGKOT.width / 2, ANGKOT.length, ANGKOT.width, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.angkotStripe;
    ctx.fillRect(-ANGKOT.length / 2 + 3, -ANGKOT.width / 2 + 4, ANGKOT.length - 6, 6);
    ctx.fillRect(-ANGKOT.length / 2 + 3, ANGKOT.width / 2 - 10, ANGKOT.length - 6, 6);
    // Windshield and side windows.
    ctx.fillStyle = 'rgba(200, 228, 255, 0.95)';
    roundRect(ANGKOT.length / 2 - 13, -ANGKOT.width / 2 + 6, 9, ANGKOT.width - 12, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 32, 42, 0.75)';
    ctx.fillRect(-14, -ANGKOT.width / 2 + 7, 20, 5);
    ctx.fillRect(-14, ANGKOT.width / 2 - 12, 20, 5);
    // Route sign on the roof.
    ctx.fillStyle = '#fff';
    ctx.font = `800 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('03', 0, 4);
    // Headlights.
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(ANGKOT.length / 2 - 1, -ANGKOT.width / 2 + 6, 2.5, 0, Math.PI * 2);
    ctx.arc(ANGKOT.length / 2 - 1, ANGKOT.width / 2 - 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFloaters(world) {
    for (const f of world.state.floaters) {
      const alpha = Math.min(1, f.ttl / 0.6);
      ctx.globalAlpha = alpha;
      text(f.text, f.x, f.y, 20, f.color, 'center', 800);
      ctx.globalAlpha = 1;
    }
  }

  function drawMinimap(world) {
    const box = { x: 1024, y: 556, w: 244, h: 152 };
    panel(box.x, box.y, box.w, box.h);
    text('RUTE 03', box.x + 12, box.y + 20, 12, PALETTE.muted, 'left', 800);
    const scale = Math.min((box.w - 24) / (2 * (LOOP.halfWidth + LOOP.cornerRadius)), (box.h - 34) / (2 * (LOOP.halfHeight + LOOP.cornerRadius)));
    const ox = box.x + box.w / 2;
    const oy = box.y + 22 + (box.h - 22) / 2;
    ctx.strokeStyle = '#f5d76e';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    world.loop.points.forEach((p, i) => {
      const x = ox + p.x * scale;
      const y = oy + p.y * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    for (const halt of world.halts) {
      ctx.fillStyle = halt.color;
      ctx.beginPath();
      ctx.arc(ox + halt.x * scale, oy + halt.y * scale, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#14202a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    for (const car of world.traffic.cars) {
      const p = pointAt(world.loop, car.s);
      ctx.fillStyle = '#ff6b5e';
      ctx.fillRect(ox + p.x * scale - 1.5, oy + p.y * scale - 1.5, 3, 3);
    }
    const ap = pointAt(world.loop, world.state.angkot.s);
    ctx.save();
    ctx.translate(ox + ap.x * scale, oy + ap.y * scale);
    ctx.rotate(ap.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHUD(world, muted) {
    const { state } = world;
    const shift = world.state.shift;
    const target = [60000, 120000, 200000][shift];
    // Setoran progress, top left.
    panel(12, 12, 336, 88);
    text(`SETORAN  •  SHIFT ${shift + 1}/3`, 28, 38, 15, PALETTE.muted, 'left', 800);
    text(`${rupiah(state.money)} / ${rupiah(target)}`, 28, 66, 24, '#fff', 'left', 800);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(28, 76, 304, 12, 6);
    ctx.fill();
    ctx.fillStyle = state.money >= target ? '#2ecc71' : '#f5d76e';
    roundRect(28, 76, 304 * Math.min(1, state.money / target), 12, 6);
    ctx.fill();
    // Timer, top centre.
    const low = state.timeLeft <= 30;
    panel(520, 12, 240, 64);
    text(mmss(state.timeLeft), 640, 58, 38, low ? '#ff6b5e' : '#fff', 'center', 800);
    // Fuel and reputation, top right.
    panel(1000, 12, 212, 88);
    text('BENSIN', 1016, 38, 15, PALETTE.muted, 'left', 800);
    text(`${Math.round(state.fuel)}%`, 1196, 38, 15, state.fuel < 25 ? '#ff6b5e' : '#fff', 'right', 800);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(1016, 46, 180, 12, 6);
    ctx.fill();
    ctx.fillStyle = state.fuel < 25 ? '#e74c3c' : state.fuel < 50 ? '#f39c12' : '#2ecc71';
    roundRect(1016, 46, 180 * (state.fuel / 100), 12, 6);
    ctx.fill();
    const stars = Math.round(state.reputation * 2) / 2;
    let starText = '';
    for (let i = 0; i < 5; i += 1) starText += i < Math.floor(stars) ? '★' : stars - i >= 0.5 ? '⯨' : '☆';
    text(starText, 1016, 88, 20, '#f5d76e', 'left', 700);
    // Mute button.
    ctx.fillStyle = muted ? '#e74c3c' : PALETTE.panel;
    roundRect(BUTTONS.mute.x, BUTTONS.mute.y, BUTTONS.mute.w, BUTTONS.mute.h, 10);
    ctx.fill();
    ctx.strokeStyle = '#f5d76e';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(muted ? '✕' : '♪', BUTTONS.mute.x + 22, BUTTONS.mute.y + 31, 24, '#fff', 'center', 800);
    // Passengers aboard and speed, bottom left.
    panel(12, 640, 320, 68);
    text(`PENUMPANG  ${world.passengers.aboard.length}/${8}`, 28, 666, 16, PALETTE.muted, 'left', 800);
    world.passengers.aboard.forEach((rider, i) => {
      ctx.fillStyle = rider.color;
      ctx.beginPath();
      ctx.arc(34 + i * 22, 690, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#14202a';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    text(`${Math.round(state.angkot.speed * 0.35)} km/jam`, 316, 694, 18, '#fff', 'right', 800);
    // Minimap, bottom right.
    drawMinimap(world);
    // Controls hint, bottom centre.
    text('H KLAKSON  •  P JEDA  •  M SUARA', 640, 700, 13, 'rgba(244,241,230,0.75)', 'center', 700);
  }

  function drawTitle(best, muted) {
    ctx.fillStyle = 'rgba(10, 14, 22, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // The logo, two words side by side: ANGKOT in teal, RUSH in gold.
    ctx.font = `900 92px ${FONT}`;
    const w1 = ctx.measureText('ANGKOT ').width;
    const w2 = ctx.measureText('RUSH').width;
    const x0 = 640 - (w1 + w2) / 2;
    ctx.textAlign = 'left';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(10, 12, 18, 0.9)';
    ctx.strokeText('ANGKOT ', x0, 148);
    ctx.fillStyle = '#0e9aa0';
    ctx.fillText('ANGKOT ', x0, 148);
    ctx.strokeText('RUSH', x0 + w1, 148);
    ctx.fillStyle = '#f5d76e';
    ctx.fillText('RUSH', x0 + w1, 148);
    text('ANTAR PENUMPANG  •  KEJAR SETORAN', 640, 196, 24, '#f4f1e6', 'center', 800);
    panel(340, 226, 600, 96);
    text('RUTE 03', 640, 258, 20, '#f5d76e', 'center', 800);
    text('TERMINAL • PASAR • KAMPUS • MASJID • STASIUN • SPBU', 640, 290, 17, '#fff', 'center', 700);
    panel(340, 338, 600, 148);
    text('↑ / W  GAS      ↓ / S  REM      ← →  PINDAH JALUR', 640, 372, 18, '#fff', 'center', 700);
    text('SPASI  REM TANGAN      H  KLAKSON      P  JEDA      M  SUARA', 640, 402, 18, '#fff', 'center', 700);
    text('Berhenti pelan di halte: penumpang naik, sampai tujuan dibayar.', 640, 436, 16, PALETTE.muted, 'center', 700);
    text('Isi bensin di SPBU. Tabrakan & penumpang kabur merusak reputasi.', 640, 462, 16, PALETTE.muted, 'center', 700);
    if (best > 0) text(`SKOR TERBAIK: ${rupiah(best)}`, 640, 522, 20, '#f5d76e', 'center', 800);
    button(BUTTONS.start, '▶  MULAI', '#f5d76e');
    text('atau tekan SPASI', 640, 660, 16, PALETTE.muted, 'center', 700);
    // Mute button on the title screen too.
    ctx.fillStyle = muted ? '#e74c3c' : PALETTE.panel;
    roundRect(BUTTONS.mute.x, BUTTONS.mute.y, BUTTONS.mute.w, BUTTONS.mute.h, 10);
    ctx.fill();
    ctx.strokeStyle = '#f5d76e';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(muted ? '✕' : '♪', BUTTONS.mute.x + 22, BUTTONS.mute.y + 31, 24, '#fff', 'center', 800);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 14, 22, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('JEDA', 640, 340, 64, '#fff', 'center', 900);
    text('Tekan P atau klik untuk lanjut', 640, 392, 20, PALETTE.muted, 'center', 700);
  }

  function drawClear(world) {
    const { state } = world;
    const target = [60000, 120000, 200000][state.shift];
    ctx.fillStyle = 'rgba(10, 14, 22, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(340, 190, 600, 300);
    text(`SHIFT ${state.shift + 1} SELESAI!`, 640, 258, 44, '#f5d76e', 'center', 900);
    text('Target setoran tercapai. Penumpang senang, dompet tebal.', 640, 300, 19, '#fff', 'center', 700);
    text(`Setoran: ${rupiah(state.money)} / ${rupiah(target)}`, 640, 348, 20, '#fff', 'center', 700);
    text(`Penumpang diantar: ${state.served}   •   Tabrakan: ${state.crashes}`, 640, 382, 20, '#fff', 'center', 700);
    text(`Skor sementara: ${rupiah(state.score)}`, 640, 416, 22, '#2ecc71', 'center', 800);
    button(BUTTONS.next, state.shift + 1 < 3 ? `LANJUT  →  SHIFT ${state.shift + 2}` : 'LIHAT HASIL', '#2ecc71');
    text('atau tekan SPASI', 640, 626, 16, PALETTE.muted, 'center', 700);
  }

  function drawOver(world, best) {
    const { state } = world;
    const over = state.over;
    ctx.fillStyle = 'rgba(10, 14, 22, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(340, 170, 600, 330);
    if (over.won) {
      text('JUARA SETORAN!', 640, 240, 48, '#f5d76e', 'center', 900);
      text('Semua shift selesai. Kamu supir terbaik di kota!', 640, 284, 19, '#fff', 'center', 700);
    } else {
      text(over.reason, 640, 240, 48, '#ff6b5e', 'center', 900);
      text('Setoran tidak tercapai. Besok coba lagi, supir!', 640, 284, 19, '#fff', 'center', 700);
    }
    text(`Skor akhir: ${rupiah(state.score)}`, 640, 332, 24, '#2ecc71', 'center', 800);
    text(`Penumpang diantar: ${state.served}   •   Tabrakan: ${state.crashes}`, 640, 368, 20, '#fff', 'center', 700);
    const stars = Math.round(state.reputation * 2) / 2;
    let starText = '';
    for (let i = 0; i < 5; i += 1) starText += i < Math.floor(stars) ? '★' : stars - i >= 0.5 ? '⯨' : '☆';
    text(starText, 640, 408, 30, '#f5d76e', 'center', 700);
    if (state.score > best) text('SKOR TERBAIK BARU!', 640, 448, 20, '#f5d76e', 'center', 800);
    button(BUTTONS.again, over.won ? 'MAIN LAGI' : 'COBA LAGI', '#f5d76e');
    text('atau tekan SPASI', 640, 626, 16, PALETTE.muted, 'center', 700);
  }

  function draw(world, screen, best, muted, steer) {
    const { state } = world;
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    const p = pointAt(world.loop, state.angkot.s);
    const shake = state.shake;
    const shakeX = shake > 0 ? Math.sin(state.elapsed * 47) * shake * 9 : 0;
    const shakeY = shake > 0 ? Math.cos(state.elapsed * 39) * shake * 9 : 0;
    // Camera follows the angkot, zoomed in a little so the van and the road
    // read at a glance, and stays inside the drawn ground
    // (ground spans x -1600..1600, y -1100..1100).
    const zoom = 1.25;
    const halfW = FIELD.width / 2 / zoom;
    const halfH = FIELD.height / 2 / zoom;
    const camX = Math.min(
      1600 - halfW,
      Math.max(-1600 + halfW, p.x - halfW + shakeX),
    );
    const camY = Math.min(
      1100 - halfH,
      Math.max(-1100 + halfH, p.y - halfH + shakeY),
    );
    ctx.save();
    ctx.translate(FIELD.width / 2, FIELD.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX - halfW, -camY - halfH);
    drawGround(world);
    drawBuildings(world);
    drawRoad(world);
    drawHalts(world);
    drawTraffic(world);
    drawAngkot(world, steer);
    drawFloaters(world);
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(world, muted);
    if (screen === SCREEN_TITLE) drawTitle(best, muted);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_CLEAR) drawClear(world);
    else if (screen === SCREEN_OVER) drawOver(world, best);
  }

  return {
    ctx,
    roundRect,
    text,
    panel,
    button,
    drawGround,
    drawBuildings,
    drawRoad,
    drawHalts,
    drawTraffic,
    drawAngkot,
    drawFloaters,
    draw,
  };
}
