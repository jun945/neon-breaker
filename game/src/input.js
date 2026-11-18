// Keyboard + pointer input, translated into the game's fixed virtual coordinate space.
// `pressed` holds one-shot actions for the current frame; `down` holds held keys.

const BLOCKED = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'Enter',
]);

const ACTION_CODES = new Set([
  'Space',
  'Enter',
  'Escape',
  'KeyP',
  'KeyM',
  'KeyA',
  'KeyD',
  'ArrowLeft',
  'ArrowRight',
]);

export class Input {
  constructor(canvas, view) {
    this.canvas = canvas;
    this.view = view;
    this.down = new Set();
    this.pressed = new Set();
    this.pointerX = view.width / 2;
    this.pointerY = view.height / 2;
    this.pointerActive = false;
    this.pointerMoved = false;

    this._onKeyDown = (event) => {
      if (ACTION_CODES.has(event.code)) event.preventDefault();
      if (!this.down.has(event.code)) this.pressed.add(event.code);
      this.down.add(event.code);
      if (event.code === 'KeyA' || event.code === 'KeyD' || event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        this.pointerActive = false;
      }
    };

    this._onKeyUp = (event) => {
      this.down.delete(event.code);
    };

    this._onPointerMove = (event) => {
      const point = this.toVirtual(event.clientX, event.clientY);
      this.pointerX = point.x;
      this.pointerY = point.y;
      this.pointerActive = true;
      this.pointerMoved = true;
    };

    this._onPointerDown = (event) => {
      if (event.button !== undefined && event.button !== 0 && event.pointerType !== 'touch') return;
      event.preventDefault();
      const point = this.toVirtual(event.clientX, event.clientY);
      this.pointerX = point.x;
      this.pointerY = point.y;
      this.pointerActive = true;
      this.pointerMoved = true;
      this.pressed.add('Pointer');
    };

    this._onBlur = () => {
      this.down.clear();
      this.pointerActive = false;
    };

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  toVirtual(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * this.view.width,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * this.view.height,
    };
  }

  isDown(code) {
    return this.down.has(code);
  }

  take(code) {
    const found = this.pressed.has(code);
    if (found) this.pressed.delete(code);
    return found;
  }

  peek(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.pointerMoved = false;
  }
}
