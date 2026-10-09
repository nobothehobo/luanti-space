// SPDX-License-Identifier: LGPL-2.1-or-later
// Real keyboard + PointerEvent flows. WebKit emulation is not iPhone hardware.
const { chromium, webkit, devices } = require(
  process.env.SPACE_PLAYWRIGHT_PATH || "playwright",
);
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve("build/space-web"),
  evidence = path.resolve("build/space-web-evidence");
fs.mkdirSync(evidence, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};
let networkAvailable = true;
let refusedRequests = 0;
const server = http.createServer((req, res) => {
  if (!networkAvailable) {
    refusedRequests++;
    req.socket.destroy();
    return;
  }
  let name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (name.endsWith("/")) name += "index.html";
  const file = path.resolve(root, "." + name);
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.end(data);
  });
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function run(type, options, label) {
  const browser = await type.launch({
    headless: true,
    ...(type === chromium
      ? {
          executablePath: process.env.SPACE_CHROMIUM || undefined,
          args: [
            "--no-sandbox",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        }
      : {}),
  });
  try {
    const context = await browser.newContext({
        ...options,
        acceptDownloads: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?test=1`);
    try {
      await page.waitForFunction(() => window.spaceDebug, null, {
        timeout: 30000,
      });
    } catch (error) {
      console.error(await page.locator("#panel").innerText());
      throw error;
    }
    await page.click("#play");
    await page.waitForFunction(() => spaceDebug().running);
    let initial = await page.evaluate(() => spaceDebug());
    assert.equal(
      initial.piloting,
      true,
      "Fresh expedition begins aboard its ship",
    );
    assert.deepEqual(
      initial.ship.position,
      [218, 117, 104],
      "Fresh expedition uses orbital berth",
    );
    assert.ok(
      initial.feet[0] > 190,
      "Fresh world opens beyond the old islands",
    );
    await page.screenshot({
      path: path.join(evidence, `${label}-orbital-opening.png`),
    });
    assert.equal(
      await page.locator("footer").isVisible(),
      false,
      "Construction toolbar is hidden in flight",
    );
    await page.click("#camera");
    await page.waitForFunction(
      () => document.querySelector("#camera").textContent === "Cockpit view",
    );
    await page.screenshot({
      path: path.join(evidence, `${label}-cockpit.png`),
    });
    await page.click("#camera");
    await page.click("#menu");
    await page.click("#home");
    await page.click("#play");
    initial = await page.evaluate(() => spaceDebug());
    assert.ok(initial.target, "Shipyard build view resolves a surface");
    if (label === "desktop") {
      await page.keyboard.down("Space");
      await sleep(500);
      await page.keyboard.up("Space");
      await sleep(400);
      const moved = await page.evaluate(() => spaceDebug());
      assert.ok(moved.feet[1] > initial.feet[1] + 1, "Actual keyboard ascend");
      await page.click("#menu");
      await page.click("#home");
      await page.click("#play");
    } else {
      // Capture multi-touch with different pointer IDs, not synthesized mouse clicks.
      const pointer = async (selector, event, id, x, y) =>
        page.locator(selector).dispatchEvent(event, {
          pointerId: id,
          pointerType: "touch",
          isPrimary: id === 1,
          clientX: x,
          clientY: y,
          bubbles: true,
        });
      const stick = await page.locator("#stick").boundingBox();
      await pointer(
        "#stick",
        "pointerdown",
        1,
        stick.x + stick.width / 2,
        stick.y + stick.height * 0.2,
      );
      await pointer("[data-hold=ascend]", "pointerdown", 2, 50, 100);
      await page.waitForFunction(
        (start) =>
          spaceDebug().feet[1] > start[1] + 0.8 &&
          spaceDebug().feet[2] > start[2] + 0.8,
        initial.feet,
        { timeout: 15000 },
      );
      await pointer("#stick", "pointerup", 1, stick.x, stick.y);
      await pointer("[data-hold=ascend]", "pointerup", 2, 50, 100);
      await sleep(400);
      const moved = await page.evaluate(() => spaceDebug());
      assert.ok(moved.feet[1] > initial.feet[1] + 0.8, "Touch ascend");
      assert.ok(moved.feet[2] > initial.feet[2] + 0.8, "Touch stick");
      const yaw = moved.yaw;
      await pointer("#view", "pointerdown", 3, 250, 180);
      await pointer("#view", "pointermove", 3, 290, 180);
      await pointer("#view", "pointerup", 3, 290, 180);
      assert.notEqual(
        (await page.evaluate(() => spaceDebug())).yaw,
        yaw,
        "Touch swipe look",
      );
      await page.click("#menu");
      await page.click("#home");
      await page.click("#play");
      const buttons = await page.locator("[data-hold]").evaluateAll((nodes) =>
        nodes.map((n) => ({
          w: n.getBoundingClientRect().width,
          h: n.getBoundingClientRect().height,
        })),
      );
      assert.ok(
        buttons.every((b) => b.w >= 44 && b.h >= 44),
        "Comfortable touch button minimums",
      );
    }
    await page.locator('#palette button[data-id="3"]').click();
    await page.click("#rotate");
    // Touch and mouse both use the visible Build control when available.
    await page.evaluate(() => document.body.classList.add("touch"));
    const build = page.locator("[data-hold=place]");
    await build.dispatchEvent("pointerdown", {
      pointerId: 8,
      pointerType: "touch",
      bubbles: true,
    });
    await page.waitForFunction(() => spaceDebug().edits.length >= 1);
    await build.dispatchEvent("pointerup", {
      pointerId: 8,
      pointerType: "touch",
      bubbles: true,
    });
    await sleep(200);
    let state = await page.evaluate(() => spaceDebug());
    assert.equal(state.edits.length, 1);
    assert.equal(state.edits[0].id, 3);
    assert.equal(state.edits[0].rotation, 1);
    await page.screenshot({
      path: path.join(evidence, `${label}-shipyard.png`),
    });
    await page.click("#undo");
    assert.equal((await page.evaluate(() => spaceDebug())).edits.length, 0);
    await sleep(180);
    await page.click("#redo");
    assert.equal((await page.evaluate(() => spaceDebug())).edits.length, 1);
    await sleep(250);
    const remove = page.locator("[data-hold=remove]");
    await remove.dispatchEvent("pointerdown", {
      pointerId: 9,
      pointerType: "touch",
      bubbles: true,
    });
    await page.waitForFunction(() => spaceDebug().edits.length === 0);
    await remove.dispatchEvent("pointerup", {
      pointerId: 9,
      pointerType: "touch",
      bubbles: true,
    });
    await sleep(250);
    await page.click("#undo");
    assert.equal(
      (await page.evaluate(() => spaceDebug())).edits.length,
      1,
      "Undo removal",
    );
    await page.reload();
    await page.waitForFunction(() => window.spaceDebug);
    assert.equal(
      (await page.evaluate(() => spaceDebug())).edits[0].rotation,
      1,
      "Save/reload",
    );
    // Exercise the public expedition controls, not a debug movement shortcut.
    await page.click("#play");
    await page.keyboard.press("KeyV");
    await page.waitForFunction(() => spaceDebug().piloting);
    const shipStart = await page.evaluate(() => spaceDebug().ship.position);
    await page.keyboard.down("KeyW");
    await page.waitForFunction(
      (start) =>
        Math.hypot(...spaceDebug().ship.position.map((v, i) => v - start[i])) >
        2,
      shipStart,
    );
    await page.keyboard.up("KeyW");
    await page.waitForFunction(
      () => Math.hypot(...spaceDebug().velocity) < 0.1,
    );
    await page.click("#power");
    assert.equal((await page.evaluate(() => spaceDebug())).ship.mainOn, false);
    const parked = await page.evaluate(() => spaceDebug().ship.position);
    await page.keyboard.down("KeyW");
    await sleep(500);
    await page.keyboard.up("KeyW");
    assert.deepEqual(
      (await page.evaluate(() => spaceDebug())).ship.position,
      parked,
      "Main OFF prevents thrust",
    );
    await page.click("#power");
    await page.keyboard.press("KeyV");
    await page.waitForFunction(() => !spaceDebug().piloting);
    // Test the no-pointer-lock adapter explicitly (the path used on iPad).
    await page.evaluate(() => {
      const canvas = document.querySelector("#view");
      canvas.requestPointerLock = () => {
        throw Error("Pointer lock unavailable in this test");
      };
    });
    const beforeDrag = await page.evaluate(() => spaceDebug().yaw);
    await page.locator("#view").dispatchEvent("pointerdown", {
      pointerType: "mouse",
      pointerId: 30,
      button: 0,
      clientX: 200,
      clientY: 180,
      bubbles: true,
    });
    await page.locator("#view").dispatchEvent("pointermove", {
      pointerType: "mouse",
      pointerId: 30,
      clientX: 240,
      clientY: 180,
      bubbles: true,
    });
    await page.locator("#view").dispatchEvent("pointerup", {
      pointerType: "mouse",
      pointerId: 30,
      clientX: 240,
      clientY: 180,
      bubbles: true,
    });
    assert.notEqual(
      (await page.evaluate(() => spaceDebug())).yaw,
      beforeDrag,
      "Unlocked trackpad drag changes view",
    );
    assert.equal(
      await page.locator("body").evaluate((n) => n.classList.contains("touch")),
      false,
      "Keyboard/trackpad hides touch in auto mode",
    );
    await sleep(180); // Allow the throttled HUD to reflect exit/power state.
    await page.screenshot({
      path: path.join(evidence, `${label}-expedition.png`),
    });
    // Look up into empty sky, then turn via the actual unlocked mouse adapter.
    const drag = async (dx, dy, id) => {
      await page
        .locator("#view")
        .dispatchEvent("pointerdown", {
          pointerType: "mouse",
          pointerId: id,
          button: 0,
          clientX: 200,
          clientY: 180,
          bubbles: true,
        });
      await page
        .locator("#view")
        .dispatchEvent("pointermove", {
          pointerType: "mouse",
          pointerId: id,
          clientX: 200 + dx,
          clientY: 180 + dy,
          bubbles: true,
        });
      await page
        .locator("#view")
        .dispatchEvent("pointerup", {
          pointerType: "mouse",
          pointerId: id,
          clientX: 200 + dx,
          clientY: 180 + dy,
          bubbles: true,
        });
      await sleep(180);
    };
    await drag(0, -600, 31);
    const skyBefore = await page.screenshot({
      path: path.join(evidence, `${label}-sky-before.png`),
    });
    await drag(240, 0, 32);
    const skyAfter = await page.screenshot({
      path: path.join(evidence, `${label}-sky-after.png`),
    });
    assert.notDeepEqual(
      skyBefore,
      skyAfter,
      "Rendered sky responds to looking around",
    );
    await page.click("#menu");
    if (label === "desktop") {
      await page.click("#play");
      await page.keyboard.press("KeyV");
      await page.waitForFunction(() => spaceDebug().piloting);
      await page.click("#menu");
      await page.selectOption("#destination", "2");
      await page.click("#course");
      await page.click("#play");
      await page.keyboard.down("KeyW");
      await page.keyboard.down("ShiftLeft");
      // Boost is a short burst, not free unlimited travel. Cruise uses less power.
      await page.waitForFunction(() => spaceDebug().ship.energy < 65);
      await page.keyboard.up("ShiftLeft");
      await page.waitForFunction(
        () => {
          const p = spaceDebug().ship.position;
          return Math.hypot(p[0] - 650, p[1] - 130, p[2] + 200) < 138;
        },
        null,
        { timeout: 65000 },
      );
      await page.keyboard.up("KeyW");
      await page.keyboard.up("ShiftLeft");
      await page.waitForFunction(
        () => Math.hypot(...spaceDebug().velocity) < 0.1,
      );
      await page.keyboard.press("KeyV");
      await page.waitForFunction(() => !spaceDebug().piloting);
      await sleep(250);
      await page.screenshot({
        path: path.join(evidence, "desktop-aster-arrival.png"),
      });
      await page.click("#menu");
    }
    if (label === "desktop") {
      const beforeRecall = await page.evaluate(() => spaceDebug().ship);
      await page.click("#launch");
      await page.waitForFunction(
        () => spaceDebug().piloting && spaceDebug().running,
      );
      const recalled = await page.evaluate(() => spaceDebug().ship);
      assert.deepEqual(
        recalled.cells,
        beforeRecall.cells,
        "Recall preserves the custom hull",
      );
      assert.equal(
        recalled.energy,
        beforeRecall.energy,
        "Recall preserves main charge",
      );
      assert.equal(
        recalled.solar,
        beforeRecall.solar,
        "Recall preserves solar charge",
      );
      assert.deepEqual(recalled.position, [218, 117, 104]);
      await page.click("#menu");
    }
    const updater = await context.newPage();
    await updater.goto(`http://127.0.0.1:${server.address().port}/update.html`);
    await updater.click("#update");
    await updater.locator("#return").waitFor({ state: "visible" });
    await updater.close();
    const persistedShip = await page.evaluate(() => spaceDebug().ship);
    const download = page.waitForEvent("download");
    await page.click("#export");
    const backup = await download;
    await backup.saveAs(path.join(evidence, `${label}-backup.json`));
    // A bad import must preserve the live world and its save.
    await page.setInputFiles("#import", {
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":999}'),
    });
    await page.waitForFunction(() =>
      document
        .querySelector("#toast")
        .textContent.startsWith("Import rejected"),
    );
    assert.equal((await page.evaluate(() => spaceDebug())).edits.length, 1);
    await page.waitForFunction(
      () =>
        document
          .querySelector("#save-status")
          .textContent.includes("OFFLINE READY"),
      { timeout: 15000 },
    );
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    // Playwright WebKit's setOffline rejects even literal SW responses (#42775).
    // Cut the real origin connection instead; do not skip cached offline reload.
    const beforeOutage = refusedRequests;
    networkAvailable = false;
    assert.ok(
      await page.evaluate(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          await fetch("offline-probe.txt", {
            cache: "no-store",
            signal: controller.signal,
          });
          return false;
        } catch {
          return true;
        } finally {
          clearTimeout(timeout);
        }
      }),
      "Uncached request must fail during the outage",
    );
    await page.reload();
    await page.waitForFunction(() => window.spaceDebug);
    assert.equal(
      (await page.evaluate(() => spaceDebug())).edits.length,
      1,
      "Offline reload",
    );
    assert.deepEqual(
      (await page.evaluate(() => spaceDebug())).ship,
      persistedShip,
      "Hull, arrival pose and battery banks survive offline reload",
    );
    assert.ok(
      refusedRequests > beforeOutage,
      "Origin was actually unreachable",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual((await page.evaluate(() => spaceDebug())).errors, []);
    console.log(
      `PASS ${label}: input/trackpad, build/remove/rotate, ship/power, undo/redo, save/reload, backup, rejected import, offline${label === "desktop" ? ", streamed Aster arrival" : ""}`,
    );
    await context.close();
  } finally {
    networkAvailable = true;
    await browser.close();
  }
}
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(chromium, { viewport: { width: 1280, height: 720 } }, "desktop");
    await run(
      chromium,
      { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
      "phone",
    );
    await run(
      chromium,
      { ...devices["iPhone 13 landscape"] },
      "phone-landscape",
    );
    if (process.env.SPACE_TEST_WEBKIT === "1")
      await run(webkit, { ...devices["iPhone 13"] }, "webkit-phone");
  } finally {
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
