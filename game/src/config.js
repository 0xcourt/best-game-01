// Every tuning number, name and colour of ANGKOT RUSH in one place. The game
// draws on a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The city loop the angkot route follows: a rounded rectangle, driven clockwise. */
export const LOOP = {
  halfWidth: 880,
  halfHeight: 540,
  cornerRadius: 250,
  roadWidth: 132,
  laneOffset: 33,
  /** World bounds the camera stays inside (the city stretches past the loop). */
  boundX: 1400,
  boundY: 980,
};

/** The angkot itself: how fast it goes, how it steers, how many seats it has. */
export const ANGKOT = {
  length: 54,
  width: 30,
  maxSpeed: 430,
  accel: 340,
  brake: 620,
  handbrake: 900,
  drag: 60,
  seats: 8,
  /** Speed below which passengers can board or alight at a halt: a slow roll counts. */
  stopSpeed: 60,
  /** How close (along the loop) the angkot must be to a halt to serve it. */
  haltZone: 100,
};

/** The six halts of route 03, in loop order, with their colour and fraction along the loop. */
export const HALTS = [
  { name: 'TERMINAL', short: 'TRM', at: 0.0, color: '#e74c3c', landmark: 'terminal' },
  { name: 'PASAR PAGI', short: 'PSR', at: 0.17, color: '#e67e22', landmark: 'pasar' },
  { name: 'KAMPUS', short: 'KMP', at: 0.34, color: '#3498db', landmark: 'kampus' },
  { name: 'MASJID AGUNG', short: 'MSJ', at: 0.51, color: '#27ae60', landmark: 'masjid' },
  { name: 'STASIUN', short: 'STN', at: 0.68, color: '#8e44ad', landmark: 'stasiun' },
  { name: 'SPBU', short: 'BBM', at: 0.85, color: '#f1c40f', landmark: 'spbu' },
];

/** Money: a ride pays a base fare plus a per-halt rate for the distance travelled. */
export const FARE = { base: 4000, perHalt: 1500 };

/** Fuel: 100 points, drained by driving; refuelling at the SPBU costs this much. */
export const FUEL = { max: 100, drainPerSecond: 0.115, refuelCost: 10000, warnAt: 25 };

/** Reputation in stars (0..5). It feeds the shift-clear bonus, never a sudden death. */
export const REP = { start: 4, dropoff: 0.1, angry: -0.5, crash: -0.25, max: 5 };

/** The three shifts: target setoran, seconds on the clock, and how busy the city gets. */
export const SHIFTS = [
  { target: 60000, seconds: 150, spawnEvery: 4.2, trafficEvery: 2.6, trafficMax: 10, patience: 42 },
  { target: 120000, seconds: 150, spawnEvery: 3.1, trafficEvery: 2.0, trafficMax: 14, patience: 36 },
  { target: 200000, seconds: 180, spawnEvery: 2.3, trafficEvery: 1.5, trafficMax: 18, patience: 30 },
];

/** Traffic cars: speeds, colours, and how long a crash stuns the angkot. */
export const TRAFFIC = {
  minSpeed: 170,
  maxSpeed: 330,
  crashStun: 1.5,
  crashSlow: 0.3,
  colours: ['#c0392b', '#2980b9', '#f39c12', '#7f8c8d', '#16a085', '#d35400'],
};

/** Passengers: how many may wait at one halt, how many in the city, how fast they board. */
export const PASSENGER = { perHaltMax: 4, totalMax: 18, boardEvery: 0.28 };

export const PALETTE = {
  grass: '#79a95b',
  grassDark: '#6b9a4e',
  sidewalk: '#d9cdb2',
  road: '#3b4048',
  roadEdge: '#f5d76e',
  laneDash: '#e8e8e8',
  buildingRoof: '#5d4037',
  panel: 'rgba(18, 22, 32, 0.82)',
  panelEdge: '#f5d76e',
  text: '#f4f1e6',
  muted: '#b9b3a4',
  good: '#2ecc71',
  warn: '#f39c12',
  bad: '#e74c3c',
  angkot: '#0e9aa0',
  angkotStripe: '#f5d76e',
  sky: '#20242e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'angkot-rush.best';
