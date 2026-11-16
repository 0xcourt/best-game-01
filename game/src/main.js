// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, shift clear and game over.
//
// ?seed=N fixes the city, the passengers and the traffic. ?shot=start|play|
// play2|end (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, SHIFTS, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_ANGRY,
  EVENT_BEEP,
  EVENT_BOARD,
  EVENT_CLEAR,
  EVENT_CRASH,
  EVENT_FARE,
  EVENT_HORN,
  EVENT_OVER,
  EVENT_REFUEL,
  createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_HORN, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  BUTTONS,
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  createRenderer,
} from './render.js';
import { autopilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// A handle for play-testing from the console or a driver: read-only state.
window.__angkot = { world, seed };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function inside(click, rect) {
  return click !== null && click.x >= rect.x && click.x <= rect.x + rect.w && click.y >= rect.y && click.y <= rect.y + rect.h;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, false, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let hornQueued = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce('Main. Antar penumpang, capai setoran sebelum waktu habis.');
  }

  function nextShift() {
    world.startShift(world.state.shift + 1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.click();
    announce(`Shift ${world.state.shift + 1}. Target baru menanti.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      world.state.over.won
        ? `Menang! Skor ${world.state.score}. Terbaik ${best}.`
        : `Kalah: ${world.state.over.reason}. Skor ${world.state.score}. Terbaik ${best}.`,
    );
  }

  function toggleMute() {
    muted = !muted;
    audio.setMuted(muted);
  }

  function handleActions() {
    const click = input.takeClick();
    let actions = input.takeActions();
    // A tap on the speaker toggles sound and never counts as a confirm.
    if (click !== null && inside(click, BUTTONS.mute)) {
      toggleMute();
      actions &= ~ACTION_CONFIRM;
    }
    if (actions & ACTION_MUTE) toggleMute();
    if (actions & ACTION_HORN) hornQueued = true;
    if (actions & ACTION_CONFIRM) audio.unlock();

    if (screen === SCREEN_TITLE && actions & ACTION_CONFIRM) startGame();
    else if (screen === SCREEN_PLAY && actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    } else if (screen === SCREEN_PAUSED && actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = SCREEN_PLAY;
      announce('Lanjut main.');
    } else if (screen === SCREEN_CLEAR && actions & ACTION_CONFIRM) {
      nextShift();
    } else if (screen === SCREEN_OVER && actions & ACTION_CONFIRM) {
      startGame();
    }
  }

  function handleEvents(events) {
    if (events & EVENT_BOARD) audio.pop();
    if (events & EVENT_FARE) audio.coin();
    if (events & EVENT_ANGRY) audio.sigh();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_REFUEL) audio.coin();
    if (events & EVENT_BEEP) audio.beep();
    if (events & EVENT_HORN) audio.horn();
    if (events & EVENT_CLEAR) {
      audio.jingle();
      if (world.state.over === null) {
        screen = SCREEN_CLEAR;
        announce(`Shift ${world.state.shift + 1} selesai!`);
      }
    }
    if (events & EVENT_OVER) {
      if (world.state.over.won) audio.jingle();
      else audio.descend();
      endGame();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, autopilot(world), true);
      return;
    }
    const control = {
      gas: input.gas(),
      brake: input.brake(),
      handbrake: input.handbrake(),
      steer: input.steer(),
      horn: hornQueued,
    };
    hornQueued = false;
    const events = world.step(STEP, control, false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.engine(screen === SCREEN_PLAY ? world.state.angkot.speed / 430 : 0);
    renderer.draw(world, screen, best, muted, input.steer());
  }

  // Leaving the tab pauses a running game rather than letting the clock run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('ANGKOT RUSH. Tekan Spasi atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
