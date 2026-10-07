// SPDX-License-Identifier: LGPL-2.1-or-later
import { World, PALETTE, raycast } from "./world.js";
import { advance, basis, eye, SPAWN } from "./flight.js";
import { Input } from "./input.js";
import { Renderer } from "./renderer.js";
import { SAVE_KEY, snapshot, validateSave, restore } from "./save.js";
const $ = (s) => document.querySelector(s),
  errors = [];
let world,
  renderer,
  input,
  spec,
  player = { feet: [...SPAWN], yaw: 0, pitch: -0.8, velocity: [0, 0, 0] };
let settings = {
  id: 1,
  rotation: 0,
  sensitivity: 0.16,
  quality: "balanced",
  gentle: false,
};
let ready = false,
  running = false,
  saveBlocked = false,
  storedBackup = null,
  offline = false;
let toastTimer,
  last = 0,
  accumulator = 0,
  frameCount = 0,
  fps = 0,
  fpsTime = 0,
  lastSave = 0,
  lastHud = 0;
let buildInfo = { edition: "browser-solo-v1", revision: "development" };
const panel = $("#panel");
document.body.classList.add("paused");
document.body.classList.toggle(
  "touch",
  matchMedia("(pointer:coarse)").matches || navigator.maxTouchPoints > 0,
);
function message(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2500);
}
function record(error) {
  errors.push(String(error?.message || error));
  errors.splice(0, Math.max(0, errors.length - 30));
}
window.addEventListener("error", (e) => record(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => record(e.reason));
function pause() {
  running = false;
  if (input) {
    input.enabled = false;
    input.reset();
  }
  player.velocity = [0, 0, 0];
  document.exitPointerLock?.();
  document.body.classList.add("paused");
  if (!panel.open) panel.showModal();
  if (ready) save();
}
function save(force = false) {
  if (!ready || saveBlocked) return false;
  try {
    const data = JSON.stringify(snapshot(world, player, settings));
    localStorage.setItem(SAVE_KEY, data);
    storedBackup = data;
    $("#save-status").textContent = offline
      ? "SAVED · OFFLINE READY"
      : "SAVED ON THIS DEVICE";
    return true;
  } catch (e) {
    record(e);
    $("#save-status").textContent = "SAVE FAILED · BACK UP WORLD";
    if (force) message("Safari could not save. Use Back up world.");
    return false;
  }
}
function download(name, data, type = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function syncSettings() {
  $("#sensitivity").value = settings.sensitivity;
  $("#quality").value = settings.quality;
  $("#gentle").checked = settings.gentle;
  $("#rotation").textContent = `${settings.rotation * 90}°`;
  for (const b of $("#palette").children)
    b.classList.toggle("active", Number(b.dataset.id) === settings.id);
}
function rotate() {
  settings.rotation = (settings.rotation + 1) % 4;
  syncSettings();
  save();
  message(`Rotated ${settings.rotation * 90}°`);
}
function command(action, notify = true) {
  const result = world.command(
    action,
    {
      feet: player.feet,
      eye: eye(player.feet),
      direction: basis(player.yaw, player.pitch).forward,
    },
    settings,
    performance.now() / 1000,
  );
  if (result.ok) {
    save(true);
    if (notify)
      message(
        action === "place"
          ? "Block placed"
          : action === "remove"
            ? "Block removed"
            : `${action} complete`,
      );
  } else if (notify) message(result.reason);
  return result;
}
$("#play").addEventListener("click", () => {
  if (!ready) return;
  panel.close();
  document.body.classList.remove("paused");
  running = true;
  input.enabled = true;
  input.reset();
  last = performance.now();
  accumulator = 0;
  $("#play").textContent = "Resume garden";
  $("#play").blur();
});
$("#menu").addEventListener("click", pause);
panel.addEventListener("cancel", (e) => {
  e.preventDefault();
  if (ready) $("#play").click();
});
$("#rotate").addEventListener("click", rotate);
$("#undo").addEventListener("click", () => command("undo"));
$("#redo").addEventListener("click", () => command("redo"));
$("#home").addEventListener("click", () => {
  player.feet = [...SPAWN];
  player.velocity = [0, 0, 0];
  player.yaw = 0;
  player.pitch = -0.8;
  save();
  message("Back at the launch island");
});
$("#export").addEventListener("click", () => {
  if (!ready) {
    message("The garden is still loading.");
    return;
  }
  const data =
    saveBlocked && storedBackup
      ? storedBackup
      : JSON.stringify(snapshot(world, player, settings), null, 2);
  download(`space-garden-${new Date().toISOString().slice(0, 10)}.json`, data);
  message("Backup downloaded. Keep it in Files.");
});
$("#import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pause();
  try {
    if (file.size > 2500000) throw new Error("Backup is too large");
    const raw = validateSave(JSON.parse(await file.text()), spec),
      candidate = new World(spec),
      restored = restore(candidate, raw);
    // Validation completes before any live world/save mutation.
    for (const mesh of renderer.meshes.values())
      renderer.gl.deleteBuffer(mesh.buffer);
    renderer.meshes.clear();
    world = candidate;
    renderer.world = world;
    player = restored.player;
    settings = restored.settings;
    saveBlocked = false;
    syncSettings();
    save(true);
    message("Backup imported. Resume when ready.");
  } catch (error) {
    record(error);
    message(`Import rejected: ${error.message}`);
  } finally {
    e.target.value = "";
  }
});
for (const name of ["sensitivity", "quality", "gentle"])
  $("#" + name).addEventListener("change", (e) => {
    settings[name] =
      name === "gentle"
        ? e.target.checked
        : name === "sensitivity"
          ? Number(e.target.value)
          : e.target.value;
    save();
  });
$("#diagnostics").addEventListener("click", () => {
  const gl = renderer?.gl;
  download(
    "space-diagnostics.json",
    JSON.stringify(
      {
        ...buildInfo,
        userAgent: navigator.userAgent,
        screen: {
          width: innerWidth,
          height: innerHeight,
          pixelRatio: devicePixelRatio,
          touchPoints: navigator.maxTouchPoints,
        },
        graphics: gl
          ? {
              version: gl.getParameter(gl.VERSION),
              renderer: gl.getParameter(gl.RENDERER),
              drawCalls: renderer.drawCalls,
            }
          : null,
        fps,
        voxels: world?.cells.size,
        edits: world?.edits.size,
        offlineReady: offline,
        saveBlocked,
        errors,
      },
      null,
      2,
    ),
  );
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("pagehide", () => save());
function frame(time) {
  requestAnimationFrame(frame);
  if (!ready) return;
  const dt = Math.min(0.1, (time - last) / 1000 || 0);
  last = time;
  frameCount++;
  fpsTime += dt;
  if (fpsTime >= 1) {
    fps = Math.round(frameCount / fpsTime);
    frameCount = 0;
    fpsTime = 0;
  }
  if (running) {
    accumulator += dt;
    const actions = input.actions();
    while (accumulator >= 1 / 120) {
      advance(player, actions, 1 / 120, world, settings.gentle);
      accumulator -= 1 / 120;
    }
    if (actions.place || actions.remove)
      command(actions.remove ? "remove" : "place", false);
    if (time - lastSave > 5000) {
      save();
      lastSave = time;
    }
  }
  const target = raycast(
    world,
    eye(player.feet),
    basis(player.yaw, player.pitch).forward,
  );
  const reason = target
    ? world.validate(
        target.above,
        { feet: player.feet, eye: eye(player.feet) },
        true,
      )
    : "Aim at an island to build";
  renderer.render(player, target, !reason, settings);
  if (time - lastHud > 120) {
    lastHud = time;
    const speed = Math.hypot(...player.velocity);
    $("#speed").textContent =
      `${speed < 0.1 ? "HOVER" : "FLIGHT"} · ${speed.toFixed(1)} m/s`;
    $("#target-status").textContent =
      reason || `${PALETTE[settings.id - 1].title} · ready`;
    $("#target-status").style.color = reason && target ? "#ffb2b2" : "#cce5de";
  }
}
async function start() {
  try {
    const buildResponse = await fetch("build-info.json");
    if (buildResponse.ok) buildInfo = await buildResponse.json();
    const response = await fetch("world_spec.json");
    if (!response.ok) throw new Error("World data could not load");
    spec = await response.json();
    world = new World(spec);
    try {
      storedBackup = localStorage.getItem(SAVE_KEY);
      if (storedBackup) {
        const restored = restore(world, JSON.parse(storedBackup));
        player = restored.player;
        settings = restored.settings;
      }
    } catch (error) {
      saveBlocked = true;
      record(error);
      message(
        "Saved world could not load. Original data is preserved; export a backup.",
      );
      $("#save-status").textContent = "SAVE PRESERVED · IMPORT A VALID BACKUP";
    }
    for (const [i, material] of PALETTE.entries()) {
      const b = document.createElement("button");
      b.dataset.id = i + 1;
      b.title = material.title;
      b.setAttribute("aria-label", material.title);
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = `rgb(${material.color.map((v) => Math.round(v * 255)).join(",")})`;
      b.append(swatch);
      b.addEventListener("click", () => {
        settings.id = i + 1;
        syncSettings();
        save();
        message(material.title);
      });
      $("#palette").append(b);
    }
    renderer = new Renderer($("#view"), world);
    input = new Input(
      $("#view"),
      (dx, dy) => {
        player.yaw =
          (player.yaw + dx * settings.sensitivity * 0.02 + Math.PI * 4) %
          (Math.PI * 2);
        player.pitch = Math.max(
          -1.5,
          Math.min(1.5, player.pitch - dy * settings.sensitivity * 0.02),
        );
      },
      rotate,
      pause,
    );
    $("#view").addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      pause();
      ready = false;
      message("Graphics paused. Your world is saved; reload to resume.");
      $("#play").disabled = true;
    });
    $("#view").addEventListener("webglcontextrestored", () =>
      location.reload(),
    );
    syncSettings();
    ready = true;
    $("#play").disabled = false;
    $("#play").textContent = storedBackup
      ? "Continue your garden"
      : "Enter your garden";
    const versionLabel = document.createElement("p");
    versionLabel.className = "note";
    versionLabel.textContent = `Build ${buildInfo.revision}`;
    panel.append(versionLabel);
    save();
    // Read-only inspection is available only in explicitly requested test mode.
    if (new URLSearchParams(location.search).has("test"))
      window.spaceDebug = () => ({
        feet: [...player.feet],
        velocity: [...player.velocity],
        yaw: player.yaw,
        pitch: player.pitch,
        edits: [...world.edits].map(([p, n]) => ({ p, ...n })),
        target: raycast(
          world,
          eye(player.feet),
          basis(player.yaw, player.pitch).forward,
        ),
        errors: [...errors],
        running,
        fps,
      });
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js");
        await navigator.serviceWorker.ready;
        const worker =
          registration.active ||
          registration.installing ||
          registration.waiting;
        if (worker?.state === "activated") {
          offline = true;
          save();
        } else
          worker?.addEventListener("statechange", () => {
            if (worker.state === "activated") {
              offline = true;
              save();
            }
          });
      } catch (error) {
        record(error);
        message("Offline cache unavailable; online play still works.");
      }
    }
  } catch (error) {
    record(error);
    $("#play").textContent = "Unable to start";
    $("#save-status").textContent = "LOAD FAILED";
    const p = document.createElement("p");
    p.textContent = error.message;
    panel.append(p);
  }
}
requestAnimationFrame(frame);
start();
