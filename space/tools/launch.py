#!/usr/bin/env python3
"""Launch the game with an isolated writable client profile; Python stdlib only."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--engine", default=str(root / "bin" / ("luanti.exe" if os.name == "nt" else "luanti")))
parser.add_argument("--world", type=Path)
parser.add_argument("--address")
args = parser.parse_args()
profile = root / "build/space-user/client.conf"
profile.parent.mkdir(parents=True, exist_ok=True)
if not profile.exists():
    shutil.copyfile(root / "space/config/client.conf", profile)
environment = os.environ.copy()
environment["LUANTI_GAME_PATH"] = str(root / "games")
command = [args.engine, "--config", str(profile)]
if args.world:
    command += ["--go", "--world", str(args.world.resolve()), "--gameid", "luanti_space"]
elif args.address:
    command += ["--go", "--address", args.address]
raise SystemExit(subprocess.call(command, env=environment))
