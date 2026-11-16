// Keyboard and pointer input. Held keys give gas, brake and steering; one-shot
// presses (confirm, pause, horn, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted
// twice. A pointer tap anywhere counts as a confirm, and its position is kept
// so the menus can tell which button was tapped.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_HORN = 4;
export const ACTION_MUTE = 8;

const GAS = new Set(['ArrowUp', 'KeyW']);
const BRAKE = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const HANDBRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const HORN = new Set(['KeyH']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let gas = false;
  let brake = false;
  let handbrake = false;
  let left = false;
  let right = false;
  let actions = 0;
  let lastClick = null;

  window.addEventListener('keydown', (event) => {
    if (GAS.has(event.code)) gas = true;
    else if (BRAKE.has(event.code)) brake = true;
    else if (HANDBRAKE.has(event.code)) {
      handbrake = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (HORN.has(event.code)) {
      if (!event.repeat) actions |= ACTION_HORN;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (GAS.has(event.code)) gas = false;
    else if (BRAKE.has(event.code)) brake = false;
    else if (HANDBRAKE.has(event.code)) handbrake = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    gas = false;
    brake = false;
    handbrake = false;
    left = false;
    right = false;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    lastClick = {
      x: (event.clientX - rect.left) * (target.width / rect.width),
      y: (event.clientY - rect.top) * (target.height / rect.height),
    };
    actions |= ACTION_CONFIRM;
  });

  return {
    /** True while the gas pedal is held. */
    gas() { return gas; },
    /** True while the brake pedal is held. */
    brake() { return brake; },
    /** True while the handbrake is held: stops the angkot fast. */
    handbrake() { return handbrake; },
    /** -1 for left, 1 for right, 0 for neither or both. */
    steer() { return (right ? 1 : 0) - (left ? 1 : 0); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The most recent tap's canvas coordinates, or null when there was none. */
    takeClick() {
      const click = lastClick;
      lastClick = null;
      return click;
    },
  };
}
