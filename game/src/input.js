// Keyboard/pointer input. Held direction is polled; confirm/pause are one-shot actions.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

export function createInput(target) {
  const held = { left: false, right: false, up: false, down: false };
  let actions = 0;
  const isTyping = () => {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  };
  const onKey = (down) => (event) => {
    if (isTyping()) return;
    const c = event.code;
    let used = true;
    if (c === 'ArrowLeft' || c === 'KeyA') held.left = down;
    else if (c === 'ArrowRight' || c === 'KeyD') held.right = down;
    else if (c === 'ArrowUp' || c === 'KeyW') held.up = down;
    else if (c === 'ArrowDown' || c === 'KeyS') held.down = down;
    else if (down && (c === 'Space' || c === 'Enter') && !event.repeat) actions |= ACTION_CONFIRM;
    else if (down && (c === 'KeyP' || c === 'Escape') && !event.repeat) actions |= ACTION_PAUSE;
    else used = false;
    if (used) event.preventDefault();
  };
  const keyDown = onKey(true);
  const keyUp = onKey(false);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', () => {
    held.left = held.right = held.up = held.down = false;
  });
  target.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    actions |= ACTION_CONFIRM;
  });
  return {
    direction() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      return { x, y };
    },
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
  };
}
