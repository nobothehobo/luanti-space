#!/usr/bin/env python3
"""Package the original game, control profile and installation notes; no engine."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[2]
game = root / "games/luanti_space"
output = root / "build/luanti-space-game.zip"
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for source in sorted(game.rglob("*")):
        if source.is_file() and "__pycache__" not in source.parts:
            archive.write(source, source.relative_to(game.parent))
    archive.write(root / "space/config/client.conf", "space-client.conf")
    archive.writestr("INSTALL.txt", """Luanti Space foundation - requires official Luanti 5.17+.
Copy luanti_space/ into Luanti's games/ directory.
Keep space-client.conf as a separate writable client configuration.
Portable Windows example: bin\\luanti.exe --config space-client.conf
Select Luanti Space, create a world and Play.
This package contains game code/assets, not a standalone engine executable.
Platform notes and source: https://github.com/nobothehobo/luanti-space
""")
print(output)
