import { settingsStore } from "./store";

export interface InputState {
  keys: Set<string>;
  mouseDX: number;
  mouseDY: number;
  fireDown: boolean;
  firePressed: boolean;
  altDown: boolean;
  altPressed: boolean;
  wheel: number;
  locked: boolean;
  /** touch virtual stick, -1..1 */
  moveX: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  touchJump: boolean;
}

export const input: InputState = {
  keys: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  fireDown: false,
  firePressed: false,
  altDown: false,
  altPressed: false,
  wheel: 0,
  locked: false,
  moveX: 0,
  moveZ: 0,
  lookX: 0,
  lookY: 0,
  touchJump: false,
};

const pressedThisFrame = new Set<string>();

export function keyPressed(code: string) {
  return pressedThisFrame.has(code);
}
export function keyDown(code: string) {
  return input.keys.has(code);
}
export function actionDown(action: string) {
  const s = settingsStore.get();
  const primary = s.keys[action] ?? "";
  const sec = s.secondaryKeys?.[action] ?? "";
  return (primary !== "" && input.keys.has(primary)) || (sec !== "" && input.keys.has(sec));
}
export function actionPressed(action: string) {
  const s = settingsStore.get();
  const primary = s.keys[action] ?? "";
  const sec = s.secondaryKeys?.[action] ?? "";
  return (primary !== "" && pressedThisFrame.has(primary)) || (sec !== "" && pressedThisFrame.has(sec));
}

export function endFrame() {
  pressedThisFrame.clear();
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.wheel = 0;
  input.firePressed = false;
  input.altPressed = false;
  input.lookX = 0;
  input.lookY = 0;
}

let attached = false;
let canvasEl: HTMLElement | null = null;

export function attachInput(el: HTMLElement) {
  canvasEl = el;
  if (attached) return () => undefined;
  attached = true;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (["Space", "Tab", "ControlLeft", "F1"].includes(e.code)) e.preventDefault();
    input.keys.add(e.code);
    pressedThisFrame.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    input.keys.delete(e.code);
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!input.locked) return;
    input.mouseDX += e.movementX;
    input.mouseDY += e.movementY;
  };
  const onMouseDown = (e: MouseEvent) => {
    if (!input.locked) return;
    if (e.button === 0) {
      input.fireDown = true;
      input.firePressed = true;
    }
    if (e.button === 2) {
      input.altDown = true;
      input.altPressed = true;
    }
  };
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) input.fireDown = false;
    if (e.button === 2) input.altDown = false;
  };
  const onWheel = (e: WheelEvent) => {
    if (!input.locked) return;
    input.wheel += Math.sign(e.deltaY);
  };
  const onContext = (e: Event) => e.preventDefault();
  const onLockChange = () => {
    input.locked = document.pointerLockElement === canvasEl;
    if (!input.locked) {
      input.keys.clear();
      input.fireDown = false;
      input.altDown = false;
    }
  };
  const onBlur = () => {
    input.keys.clear();
    input.fireDown = false;
    input.altDown = false;
    input.lookX = 0;
    input.lookY = 0;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("contextmenu", onContext);
  window.addEventListener("blur", onBlur);
  document.addEventListener("pointerlockchange", onLockChange);

  return () => {
    attached = false;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("contextmenu", onContext);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("pointerlockchange", onLockChange);
  };
}

export function requestLock() {
  canvasEl?.requestPointerLock?.();
}
export function releaseLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

/** Virtual key helper for mobile buttons. */
export function virtualPress(code: string) {
  input.keys.add(code);
  pressedThisFrame.add(code);
  setTimeout(() => input.keys.delete(code), 60);
}

/** Virtual key hold helpers for mobile buttons. */
export function virtualDown(code: string) {
  if (!input.keys.has(code)) pressedThisFrame.add(code);
  input.keys.add(code);
}
export function virtualUp(code: string) {
  input.keys.delete(code);
}
