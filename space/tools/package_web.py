#!/usr/bin/env python3
"""Package self-contained static browser files; no npm/CDN/runtime dependency."""
# SPDX-License-Identifier: LGPL-2.1-or-later
import json
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "build/space-web"
DEST.mkdir(parents=True, exist_ok=True)
for path in (ROOT / "space/web").rglob("*"):
    if not path.is_file() or "tests" in path.parts or path.name in {"README.md", "package.json"}:
        continue
    target = DEST / path.relative_to(ROOT / "space/web")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
spec = ROOT / "games/luanti_space/mods/space_core/world_spec.json"
assert json.loads(spec.read_text())["generator"] == 1
shutil.copy2(spec, DEST / "world_spec.json")
revision = subprocess.check_output(["git", "rev-parse", "--short=12", "HEAD"], cwd=ROOT, text=True).strip()
(DEST / "build-info.json").write_text(json.dumps({"revision": revision, "edition": "browser-solo-v1"}))
worker = DEST / "sw.js"
worker.write_text(worker.read_text().replace("space-browser-v1-1", f"space-browser-v1-{revision}"))
shutil.copy2(ROOT / "LICENSE.txt", DEST / "LICENSE.txt")
with zipfile.ZipFile(ROOT / "build/space-browser.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(DEST.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(DEST))
print(f"Static game: {DEST}")
