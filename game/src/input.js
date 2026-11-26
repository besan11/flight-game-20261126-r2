// Keyboard (and a little mouse) input. Keys are read as a live set so the
// flight model can blend them every frame; edges (pressed this frame) drive
// menus and the screenshot autopilot.
export const KEYS = {
  ArrowUp: 'pitchDown',
  ArrowDown: 'pitchUp',
  ArrowLeft: 'rollLeft',
  ArrowRight: 'rollRight',
  KeyW: 'throttleUp',
  KeyS: 'throttleDown',
  KeyA: 'rollLeft',
  KeyD: 'rollRight',
  KeyQ: 'yawLeft',
  KeyE: 'yawRight',
  KeyR: 'restart',
  Enter: 'confirm',
  Space: 'brake',
  KeyC: 'camera',
  KeyM: 'mute',
};

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.onKeyDown = (event) => {
      if (event.repeat) return;
      this.down.add(event.code);
      this.pressed.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    };
    this.onKeyUp = (event) => {
      this.down.delete(event.code);
    };
    this.onMouseMove = (event) => {
      this.mouseDX += event.movementX || 0;
      this.mouseDY += event.movementY || 0;
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  /** True while the physical key is held. */
  held(code) {
    return this.down.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Any of the listed codes held. */
  anyHeld(codes) {
    return codes.some((code) => this.down.has(code));
  }

  /** Read a -1..1 axis from a pair of keys. */
  axis(negCodes, posCodes) {
    let value = 0;
    if (this.anyHeld(negCodes)) value -= 1;
    if (this.anyHeld(posCodes)) value += 1;
    return value;
  }

  /** Call at the end of each frame: clears edge presses and mouse deltas. */
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  /** Drive the plane from keys (or from an autopilot object with the same shape). */
  controlAxes() {
    return {
      pitch: this.axis(['ArrowDown'], ['ArrowUp']),
      roll: this.axis(['ArrowRight', 'KeyD'], ['ArrowLeft', 'KeyA']),
      yaw: this.axis(['KeyQ'], ['KeyE']),
      throttle: this.axis(['KeyS'], ['KeyW']),
      brake: this.held('Space'),
    };
  }

  /** Test harness / autopilot: pretend a key is held. */
  setHeld(code, held) {
    if (held) this.down.add(code);
    else this.down.delete(code);
  }
}
