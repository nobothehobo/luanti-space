// SPDX-License-Identifier: LGPL-2.1-or-later
// Every input source produces the same actions. Pointer capture permits moving,
// looking, ascending and building simultaneously; no mouse-event touch emulation.
export class Input {
  constructor(canvas, look, onRotate, onPause) {
    this.keys = new Set();
    this.held = new Map();
    this.axis = [0, 0];
    this.look = look;
    this.canvas = canvas;
    this.enabled = false;
    this.joystickPointer = null;
    this.lookPointer = null;
    this.lastLook = null;
    document.addEventListener("keydown", (e) => {
      if (!this.enabled || e.target.matches("input,select,textarea")) return;
      if (
        [
          "Space",
          "ControlLeft",
          "ControlRight",
          "ShiftLeft",
          "ShiftRight",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyC",
          "KeyR",
        ].includes(e.code)
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "KeyR" && !e.repeat) onRotate();
      if (e.code === "Escape") onPause();
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.enabled) return;
      if (e.pointerType === "mouse") {
        if (document.pointerLockElement !== canvas) {
          // Safari/iPad can decline pointer lock: drag-to-look remains usable.
          const request = canvas.requestPointerLock?.();
          request?.catch?.(() => {});
          this.lookPointer = e.pointerId;
          this.lastLook = [e.clientX, e.clientY];
          if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
          return;
        }
        this.held.set(e.pointerId, e.button === 2 ? "place" : "remove");
      } else {
        this.lookPointer = e.pointerId;
        this.lastLook = [e.clientX, e.clientY];
        if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
      }
    });
    document.addEventListener("mousemove", (e) => {
      if (this.enabled && document.pointerLockElement === canvas)
        this.look(e.movementX, e.movementY);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (
        this.enabled &&
        e.pointerId === this.lookPointer &&
        this.lastLook &&
        document.pointerLockElement !== canvas
      ) {
        this.look(e.clientX - this.lastLook[0], e.clientY - this.lastLook[1]);
        this.lastLook = [e.clientX, e.clientY];
      }
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      document.addEventListener(name, (e) => {
        this.held.delete(e.pointerId);
        if (e.pointerId === this.lookPointer) {
          this.lookPointer = null;
          this.lastLook = null;
        }
        if (e.pointerId === this.joystickPointer) {
          this.axis = [0, 0];
          this.joystickPointer = null;
          this.knob.style.transform = "translate(-50%,-50%)";
        }
      });
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement !== canvas) this.held.clear();
    });
    window.addEventListener("blur", () => {
      this.reset();
      onPause();
    });
    const stick = document.querySelector("#stick");
    this.knob = stick.querySelector("span");
    const move = (e) => {
      const r = stick.getBoundingClientRect(),
        dx = (e.clientX - r.left - r.width / 2) / (r.width * 0.36),
        dy = (e.clientY - r.top - r.height / 2) / (r.height * 0.36);
      const length = Math.max(1, Math.hypot(dx, dy));
      this.axis = [dx / length, -dy / length];
      this.knob.style.transform = `translate(calc(-50% + ${this.axis[0] * r.width * 0.27}px),calc(-50% + ${-this.axis[1] * r.height * 0.27}px))`;
    };
    stick.addEventListener("pointerdown", (e) => {
      if (!this.enabled || this.joystickPointer !== null) return;
      e.preventDefault();
      this.joystickPointer = e.pointerId;
      if (e.isTrusted) stick.setPointerCapture(e.pointerId);
      move(e);
    });
    stick.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.joystickPointer) move(e);
    });
    for (const button of document.querySelectorAll("[data-hold]"))
      button.addEventListener("pointerdown", (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        if (e.isTrusted) button.setPointerCapture(e.pointerId);
        this.held.set(e.pointerId, button.dataset.hold);
        button.blur();
      });
  }
  reset() {
    this.keys.clear();
    this.held.clear();
    this.axis = [0, 0];
    this.joystickPointer = null;
    this.lookPointer = null;
    this.lastLook = null;
    if (this.knob) this.knob.style.transform = "translate(-50%,-50%)";
  }
  actions() {
    const k = this.keys,
      held = (n) => [...this.held.values()].includes(n);
    return {
      move_forward: Math.max(
        -1,
        Math.min(
          1,
          this.axis[1] + Number(k.has("KeyW")) - Number(k.has("KeyS")),
        ),
      ),
      move_right: Math.max(
        -1,
        Math.min(
          1,
          this.axis[0] + Number(k.has("KeyD")) - Number(k.has("KeyA")),
        ),
      ),
      ascend: k.has("Space") || held("ascend"),
      descend:
        k.has("ControlLeft") ||
        k.has("ControlRight") ||
        k.has("KeyC") ||
        held("descend"),
      boost: k.has("ShiftLeft") || k.has("ShiftRight") || held("boost"),
      place: held("place"),
      remove: held("remove"),
      rotate: k.has("KeyR"),
    };
  }
}
