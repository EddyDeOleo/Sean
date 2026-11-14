/**
 * Keyboard and mouse input for the game.
 *
 * `inputFromKeys` is pure so the mapping can be tested. `GameInput` listens to the window while attached and stops listening
 * when detached. Mouse look uses pointer lock when the browser grants it; the arrow keys turn as a complete alternative, so
 * the game is playable with the keyboard alone.
 */

import type { Input } from "./world";

export const KEY_TURN_SPEED = 3.6;
export const MOUSE_SENSITIVITY = 0.0022;

const FORWARD = ["KeyW", "ArrowUp"];
const BACK = ["KeyS", "ArrowDown"];
const STRAFE_LEFT = ["KeyA"];
const STRAFE_RIGHT = ["KeyD"];
const TURN_LEFT = ["ArrowLeft"];
const TURN_RIGHT = ["ArrowRight"];
const SPRINT = ["ShiftLeft", "ShiftRight"];

const any = (keys: ReadonlySet<string>, codes: readonly string[]): boolean => codes.some((c) => keys.has(c));

export function inputFromKeys(keys: ReadonlySet<string>): Input {
  return {
    forward: (any(keys, FORWARD) ? 1 : 0) - (any(keys, BACK) ? 1 : 0),
    strafe: (any(keys, STRAFE_RIGHT) ? 1 : 0) - (any(keys, STRAFE_LEFT) ? 1 : 0),
    turn: ((any(keys, TURN_RIGHT) ? 1 : 0) - (any(keys, TURN_LEFT) ? 1 : 0)) * KEY_TURN_SPEED,
    sprint: any(keys, SPRINT),
  };
}

const HANDLED = new Set([...FORWARD, ...BACK, ...STRAFE_LEFT, ...STRAFE_RIGHT, ...TURN_LEFT, ...TURN_RIGHT, ...SPRINT, "KeyF", "KeyE", "Space"]);

export interface InputHandlers {
  /** While paused, only Escape is handled and no key is blocked, so the menu buttons work with Space and Enter. */
  isPaused(): boolean;
  onFlashlight(): void;
  /** The interact key: hide in, or leave, a hiding place. */
  onInteract(): void;
  onPause(): void;
  /** Mouse movement in pixels, only while the pointer is locked. */
  onLook(dx: number, dy: number): void;
}

export class GameInput {
  private readonly keys = new Set<string>();
  private attached = false;

  constructor(private readonly handlers: InputHandlers, private readonly lockTarget: Element) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener("keydown", this.keydown);
    window.addEventListener("keyup", this.keyup);
    window.addEventListener("blur", this.clear);
    document.addEventListener("mousemove", this.mousemove);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this.keydown);
    window.removeEventListener("keyup", this.keyup);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("mousemove", this.mousemove);
    this.keys.clear();
  }

  read(): Input {
    return inputFromKeys(this.keys);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.lockTarget;
  }

  clear = (): void => {
    this.keys.clear();
  };

  private keydown = (event: KeyboardEvent): void => {
    if (event.code === "Escape") {
      if (!event.repeat) this.handlers.onPause();
      return;
    }
    if (this.handlers.isPaused() || !HANDLED.has(event.code)) return;
    // Space and arrows would scroll the page behind the game.
    event.preventDefault();
    if (event.code === "KeyF") {
      if (!event.repeat) this.handlers.onFlashlight();
      return;
    }
    if (event.code === "KeyE") {
      if (!event.repeat) this.handlers.onInteract();
      return;
    }
    this.keys.add(event.code);
  };

  private keyup = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private mousemove = (event: MouseEvent): void => {
    if (this.locked) this.handlers.onLook(event.movementX, event.movementY);
  };
}
