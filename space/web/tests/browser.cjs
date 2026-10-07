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
const server = http.createServer((req, res) => {
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
    await page.waitForFunction(() => window.spaceDebug, { timeout: 30000 });
    await page.click("#play");
    await page.waitForFunction(() => spaceDebug().running);
    const initial = await page.evaluate(() => spaceDebug());
    assert.ok(initial.target, "Initial aim must resolve a surface");
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
        page
          .locator(selector)
          .dispatchEvent(event, {
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
      await sleep(500);
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
      const buttons = await page
        .locator("[data-hold]")
        .evaluateAll((nodes) =>
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
    await sleep(100);
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
    await page.screenshot({ path: path.join(evidence, `${label}-garden.png`) });
    await page.click("#undo");
    assert.equal((await page.evaluate(() => spaceDebug())).edits.length, 0);
    await sleep(180);
    await page.click("#redo");
    assert.equal((await page.evaluate(() => spaceDebug())).edits.length, 1);
    await page.reload();
    await page.waitForFunction(() => window.spaceDebug);
    assert.equal(
      (await page.evaluate(() => spaceDebug())).edits[0].rotation,
      1,
      "Save/reload",
    );
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
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.spaceDebug);
    assert.equal(
      (await page.evaluate(() => spaceDebug())).edits.length,
      1,
      "Offline reload",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual((await page.evaluate(() => spaceDebug())).errors, []);
    console.log(
      `PASS ${label}: input, build/rotate, undo/redo, save/reload, backup, rejected import, offline`,
    );
    await context.close();
  } finally {
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
