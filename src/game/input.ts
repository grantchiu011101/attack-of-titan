export interface InputState {
  moveX: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  hookL: boolean;
  hookR: boolean;
  gas: boolean;
  jump: boolean;
  slash: boolean;
  slashPressed: boolean;
  pausePressed: boolean;
}

export class Input {
  readonly state: InputState = {
    moveX: 0,
    moveZ: 0,
    lookX: 0,
    lookY: 0,
    hookL: false,
    hookR: false,
    gas: false,
    jump: false,
    slash: false,
    slashPressed: false,
    pausePressed: false,
  };

  sensitivity = 0.0022;
  invertY = false;
  pointerLocked = false;

  private keys = new Set<string>();
  private slashWas = false;
  private pauseWas = false;
  private lookAccX = 0;
  private lookAccY = 0;
  private joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private lookTouch = { active: false, id: -1, lx: 0, ly: 0 };

  attach(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    window.addEventListener('blur', () => this.keys.clear());

    const left = document.getElementById('joy-pad');
    const right = document.getElementById('look-pad');
    left?.addEventListener('touchstart', (e) => this.joyStart(e), { passive: false });
    left?.addEventListener('touchmove', (e) => this.joyMove(e), { passive: false });
    left?.addEventListener('touchend', (e) => this.joyEnd(e));
    right?.addEventListener('touchstart', (e) => this.lookStart(e), { passive: false });
    right?.addEventListener('touchmove', (e) => this.lookMove(e), { passive: false });
    right?.addEventListener('touchend', () => {
      this.lookTouch.active = false;
    });

    this.bindHold('btn-hook-l', 'hookL');
    this.bindHold('btn-hook-r', 'hookR');
    this.bindHold('btn-gas', 'gas');
    this.bindHold('btn-jump', 'jump');
    const slashBtn = document.getElementById('btn-slash');
    slashBtn?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.state.slash = true;
    });
    slashBtn?.addEventListener('touchend', () => {
      this.state.slash = false;
    });
  }

  requestLock(canvas: HTMLCanvasElement): void {
    if (!this.pointerLocked) void canvas.requestPointerLock();
  }

  consumeLook(): { x: number; y: number } {
    const x = this.lookAccX;
    const y = this.lookAccY;
    this.lookAccX = 0;
    this.lookAccY = 0;
    return { x, y };
  }

  beginFrame(): void {
    const k = this.keys;
    const joyX = this.joy.active ? this.joy.x : 0;
    const joyY = this.joy.active ? this.joy.y : 0;
    this.state.moveX = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + joyX;
    this.state.moveZ = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - joyY;
    this.state.moveX = Math.max(-1, Math.min(1, this.state.moveX));
    this.state.moveZ = Math.max(-1, Math.min(1, this.state.moveZ));
    this.state.hookL = k.has('KeyQ') || this.held.hookL;
    this.state.hookR = k.has('KeyE') || this.held.hookR;
    this.state.gas = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('Space') || this.held.gas;
    this.state.jump = k.has('Space') || this.held.jump;
    const slash = k.has('Mouse0') || this.state.slash;
    this.state.slashPressed = slash && !this.slashWas;
    this.slashWas = slash;
    const pause = k.has('Escape') || k.has('KeyP');
    this.state.pausePressed = pause && !this.pauseWas;
    this.pauseWas = pause;
    this.state.lookX = 0;
    this.state.lookY = 0;
  }

  private held = { hookL: false, hookR: false, gas: false, jump: false };

  private bindHold(id: string, key: keyof typeof this.held): void {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e: Event) => {
      e.preventDefault();
      this.held[key] = true;
    };
    const up = () => {
      this.held[key] = false;
    };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.keys.add('Mouse0');
    if (e.button === 2) this.keys.add('Mouse2');
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.keys.delete('Mouse0');
    if (e.button === 2) this.keys.delete('Mouse2');
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.lookAccX += e.movementX * this.sensitivity;
    this.lookAccY += e.movementY * this.sensitivity * (this.invertY ? 1 : -1);
  };

  private joyStart(e: TouchEvent): void {
    e.preventDefault();
    const t = e.changedTouches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.joy = { active: true, id: t.identifier, ox: rect.left + rect.width / 2, oy: rect.top + rect.height / 2, x: 0, y: 0 };
  }

  private joyMove(e: TouchEvent): void {
    e.preventDefault();
    const t = [...e.touches].find((x) => x.identifier === this.joy.id);
    if (!t) return;
    const dx = (t.clientX - this.joy.ox) / 48;
    const dy = (t.clientY - this.joy.oy) / 48;
    const mag = Math.hypot(dx, dy) || 1;
    const s = Math.min(1, mag) / mag;
    this.joy.x = dx * s;
    this.joy.y = dy * s;
    const knob = document.getElementById('joy-knob');
    if (knob) {
      knob.style.transform = `translate(${this.joy.x * 28}px, ${this.joy.y * 28}px)`;
    }
  }

  private joyEnd(e: TouchEvent): void {
    if (![...e.changedTouches].some((t) => t.identifier === this.joy.id)) return;
    this.joy.active = false;
    this.joy.x = 0;
    this.joy.y = 0;
    const knob = document.getElementById('joy-knob');
    if (knob) knob.style.transform = 'translate(0,0)';
  }

  private lookStart(e: TouchEvent): void {
    e.preventDefault();
    const t = e.changedTouches[0];
    this.lookTouch = { active: true, id: t.identifier, lx: t.clientX, ly: t.clientY };
  }

  private lookMove(e: TouchEvent): void {
    e.preventDefault();
    const t = [...e.touches].find((x) => x.identifier === this.lookTouch.id);
    if (!t || !this.lookTouch.active) return;
    this.lookAccX += (t.clientX - this.lookTouch.lx) * this.sensitivity * 1.4;
    this.lookAccY += (t.clientY - this.lookTouch.ly) * this.sensitivity * (this.invertY ? 1.4 : -1.4);
    this.lookTouch.lx = t.clientX;
    this.lookTouch.ly = t.clientY;
  }
}
