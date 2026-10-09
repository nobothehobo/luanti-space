// SPDX-License-Identifier: LGPL-2.1-or-later
import {
  World,
  PALETTE,
  MATERIAL_IDS,
  material,
  raycast,
  overlapsPlayer,
} from "./world.js";
import { Ship } from "./ship.js";
import {
  DESTINATIONS,
  EXPEDITION_SPAWN,
  DOCK_SHIP_POSITION,
  DOCK_VIEW,
} from "./exploration.js";
import { advance, basis, eye } from "./flight.js";
import { Input } from "./input.js";
import { Renderer } from "./renderer.js";
import { SAVE_KEY, snapshot, validateSave, restore } from "./save.js";
const $ = (s) => document.querySelector(s),
  errors = [];
let world,
  renderer,
  input,
  spec,
  ship = new Ship(),
  player = { feet: [...EXPEDITION_SPAWN], ...DOCK_VIEW, velocity: [0, 0, 0] };
ship.position = [...DOCK_SHIP_POSITION];
let settings = {
  id: 1,
  rotation: 0,
  sensitivity: 0.16,
  quality: "balanced",
  gentle: false,
  controls: "auto",
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
let activeDevice =
  matchMedia("(pointer:coarse)").matches || navigator.maxTouchPoints > 0
    ? "touch"
    : "keyboard";
let buildMode = "terrain";
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
    const data = JSON.stringify(snapshot(world, player, settings, ship));
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
  $("#controls").value = settings.controls || "auto";
  document.body.classList.toggle(
    "touch",
    (settings.controls || "auto") === "touch" ||
      ((settings.controls || "auto") === "auto" && activeDevice === "touch"),
  );
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
  if (ship.piloting) {
    if (notify) message("Exit your ship before building");
    return { ok: false, reason: "Piloting" };
  }
  const result = (buildMode === "ship" ? ship : world).command(
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
  $("#play").textContent = "Resume expedition";
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
function pilot() {
  if (!ready) return;
  if (ship.piloting) {
    if (!ship.disembark(player, world)) {
      message("No clear exit. Fly away from terrain first.");
      return;
    }
    message("Ship parked. Switch to Hull to customize it.");
  } else {
    if (!ship.board(player)) {
      message("Fly within 12 m of the ship to board.");
      return;
    }
    message("Piloting · WASD / stick moves · solar chargers refill boost");
  }
  input?.reset();
  save();
}
$("#pilot").addEventListener("click", pilot);
$("#power").addEventListener("click", () => {
  if (Math.hypot(...ship.position.map((v, i) => v - player.feet[i])) > 12) {
    message("Board or approach your ship to change power");
    return;
  }
  ship.mainOn = !ship.mainOn;
  save();
  message(
    ship.mainOn
      ? "Main battery ON · thrust enabled"
      : "Main battery OFF · solar reserve recharges main · thrust disabled",
  );
});
$("#course").addEventListener("click", () => {
  const destination = DESTINATIONS[Number($("#destination").value)];
  const d = destination.center.map((v, i) => v - eye(player.feet)[i]);
  player.yaw = (Math.atan2(d[0], d[2]) + Math.PI * 2) % (Math.PI * 2);
  player.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
  message(
    `Course toward ${destination.name}. Pilot and fly forward; no teleport.`,
  );
});
$("#build-mode").addEventListener("click", () => {
  buildMode = buildMode === "terrain" ? "ship" : "terrain";
  $("#build-mode").textContent = buildMode === "ship" ? "Hull" : "Terrain";
  message(
    buildMode === "ship"
      ? "Hull grid · park and fly alongside your ship"
      : "Terrain grid",
  );
});
$("#starter").addEventListener("click", () => {
  const candidate = new Ship();
  candidate.position = player.feet.map((v, i) => v + (i === 0 ? 7 : 0));
  if (ship.piloting || candidate.collides(world, candidate.position)) {
    message("Leave your ship and find clear space first.");
    return;
  }
  if (
    !confirm(
      "Replace your current ship with the starter blueprint? Back up first to keep a custom hull.",
    )
  )
    return;
  ship = candidate;
  buildMode = "ship";
  $("#build-mode").textContent = "Hull";
  save();
  message("Starter hull pasted beside you");
});
$("#launch").addEventListener("click", () => {
  if (!ready || saveBlocked) return;
  // Explicit relocation preserves the custom hull, battery banks and terrain.
  if (ship.collides(world, DOCK_SHIP_POSITION)) {
    message(
      "Shipyard berth is occupied. Move those blocks before recalling your ship.",
    );
    return;
  }
  ship.position = [...DOCK_SHIP_POSITION];
  ship.velocity = [0, 0, 0];
  ship.piloting = false;
  player.feet = [...EXPEDITION_SPAWN];
  ship.board(player);
  $("#course").click();
  save();
  $("#play").click();
  message(
    "Depart the orbital shipyard · forward to travel · exit to build your hull",
  );
});
$("#home").addEventListener("click", () => {
  player.feet = [...EXPEDITION_SPAWN];
  player.velocity = [0, 0, 0];
  player.yaw = DOCK_VIEW.yaw;
  player.pitch = DOCK_VIEW.pitch;
  ship.piloting = false;
  ship.velocity = [0, 0, 0];
  save();
  message("Back at the orbital shipyard");
});
$("#export").addEventListener("click", () => {
  if (!ready) {
    message("The expedition is still loading.");
    return;
  }
  const data =
    saveBlocked && storedBackup
      ? storedBackup
      : JSON.stringify(snapshot(world, player, settings, ship), null, 2);
  download(
    `space-expedition-${new Date().toISOString().slice(0, 10)}.json`,
    data,
  );
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
    ship = restored.ship;
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
for (const name of ["sensitivity", "quality", "gentle", "controls"])
  $("#" + name).addEventListener("change", (e) => {
    settings[name] =
      name === "gentle"
        ? e.target.checked
        : name === "sensitivity"
          ? Number(e.target.value)
          : e.target.value;
    syncSettings();
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
      ship.tick(actions, 1 / 120, player.yaw, world, player);
      if (!ship.piloting) {
        world.bodyBlocked = (feet) =>
          [...ship.cells.keys()].some((k) =>
            overlapsPlayer(ship.global(k.split(",").map(Number)), feet),
          );
        advance(player, actions, 1 / 120, world, settings.gentle);
      }
      accumulator -= 1 / 120;
    }
    if (actions.place || actions.remove)
      command(actions.remove ? "remove" : "place", false);
    if (time - lastSave > 5000) {
      save();
      lastSave = time;
    }
  }
  const editWorld = buildMode === "ship" ? ship : world;
  const target = ship.piloting
    ? null
    : raycast(
        editWorld,
        buildMode === "ship" ? ship.local(eye(player.feet)) : eye(player.feet),
        basis(player.yaw, player.pitch).forward,
      );
  const reason = target
    ? editWorld.validate(
        target.above,
        buildMode === "ship"
          ? ship.pose({ feet: player.feet, eye: eye(player.feet) })
          : { feet: player.feet, eye: eye(player.feet) },
        true,
      )
    : ship.piloting
      ? "Piloting · exit to explore or edit"
      : buildMode === "ship"
        ? "Aim at your parked hull"
        : "Aim at terrain to build";
  if (target && buildMode === "ship") target.offset = ship.position;
  renderer.render(player, target, !reason, settings, ship);
  if (time - lastHud > 120) {
    lastHud = time;
    const speed = Math.hypot(...player.velocity);
    $("#speed").textContent =
      `${ship.piloting ? "SHIP" : speed < 0.1 ? "HOVER" : "FLIGHT"} · ${speed.toFixed(1)} m/s`;
    $("#power").textContent =
      `Main ${ship.mainOn ? "ON" : "OFF"} · ${Math.round(ship.energy)}/${ship.capacity()} · solar ${Math.round(ship.solar)}`;
    const destination = DESTINATIONS[Number($("#destination").value)];
    const remaining = Math.max(
      0,
      Math.hypot(...player.feet.map((v, i) => v - destination.center[i])) -
        destination.radius,
    );
    $("#navigation").textContent =
      `${destination.name} · ${Math.round(remaining)} m to surface`;
    $("#pilot").textContent = ship.piloting
      ? "Exit ship (V)"
      : "Pilot ship (V)";
    $("#target-status").textContent =
      reason || `${material(settings.id).title} · ${buildMode} ready`;
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
    spec = { ...spec, exploration: 1 };
    world = new World(spec);
    try {
      storedBackup = localStorage.getItem(SAVE_KEY);
      if (storedBackup) {
        const restored = restore(world, JSON.parse(storedBackup));
        player = restored.player;
        settings = restored.settings;
        ship = restored.ship;
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
      b.dataset.id = MATERIAL_IDS[i];
      b.title = material.title;
      b.setAttribute("aria-label", material.title);
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = `rgb(${material.color.map((v) => Math.round(v * 255)).join(",")})`;
      b.append(swatch);
      b.addEventListener("click", () => {
        settings.id = MATERIAL_IDS[i];
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
      (device) => {
        if (activeDevice !== device) {
          activeDevice = device;
          syncSettings();
        }
      },
      pilot,
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
      ? "Continue expedition"
      : "Begin expedition";
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
        ship: ship.data(),
        piloting: ship.piloting,
        buildMode,
        controls: settings.controls || "auto",
      });
    if ("serviceWorker" in navigator) {
      try {
        // Reuse the installed registration offline. The updater can set
        // updateViaCache=none, so register() again may require a network fetch.
        const existing = await navigator.serviceWorker.getRegistration("./");
        const registration =
          existing || (await navigator.serviceWorker.register("./sw.js"));
        if (existing)
          registration.update().catch(() => {
            // An unavailable connection leaves the complete installed shell usable.
          });
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
