#!/usr/bin/env python3
"""Two real headless clients check edit replication and saved-world reload.

Linux run-in-place build required. Test-only CSM observes each client's map and
sends chat commands through the standard protocol. No test code ships in the game.
This does not simulate physical keyboard/touch input or verify rendered visuals.
"""
import argparse
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--engine", type=Path, default=root / "bin/luanti")
args = parser.parse_args()
engine = args.engine.resolve()
if not engine.is_file():
    parser.error("build a client-enabled engine first")
with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as port_probe:
    port_probe.bind(("127.0.0.1", 0))
    port = port_probe.getsockname()[1]
workspace = Path(tempfile.mkdtemp(prefix="space-test-", dir=root / "build"))
print(f"Native integration logs: {workspace}", flush=True)
bundle = workspace / "engine"
(bundle / "bin").mkdir(parents=True)
isolated_engine = bundle / "bin/luanti"
shutil.copy2(engine, isolated_engine)  # isolates RUN_IN_PLACE clientmods from user data
for directory in ("builtin", "client", "textures", "fonts", "locale"):
    if (root / directory).exists():
        (bundle / directory).symlink_to(root / directory, target_is_directory=True)
(bundle / "clientmods").mkdir()
shutil.copytree(root / "space/tests/client", bundle / "clientmods/space_probe")
(bundle / "clientmods/mods.conf").write_text("load_mod_space_probe = true\n")
world = workspace / "world"
shutil.copytree(root / "space/tests/server", world / "worldmods/space_test")
environment = os.environ.copy()
environment["LUANTI_GAME_PATH"] = str(root / "games")
environment["SDL_VIDEODRIVER"] = "dummy"
environment["ALSOFT_DRIVERS"] = "null"
for round_name in ("new", "reload"):
    success = world / "success"
    success.unlink(missing_ok=True)
    configuration = workspace / f"server-{round_name}.conf"
    configuration.write_text(
        (root / "space/config/server.conf").read_text()
        + f"\nport = {port}\nbind_address = 127.0.0.1\nspace_test_round = {round_name}\n"
        + "csm_restriction_flags = 0\nmax_block_send_distance = 4\nnum_emerge_threads = 1\n"
        + "chat_message_limit_per_10sec = 50\n"
    )
    processes, logs = [], []
    try:
        log = open(workspace / f"server-{round_name}.log", "w")
        logs.append(log)
        server = subprocess.Popen([str(isolated_engine), "--server", "--config", str(configuration),
            "--world", str(world), "--gameid", "luanti_space", "--info"], env=environment, stdout=log, stderr=subprocess.STDOUT)
        processes.append(server)
        time.sleep(1)
        for name in ("space_a", "space_b"):
            profile = workspace / f"{name}-{round_name}.conf"
            profile.write_text((root / "space/config/client.conf").read_text()
                + f"\nname = {name}\nremote_port = {port}\nvideo_driver = null\n"
                + "enable_client_modding = true\nenable_sound = false\n"
                + "enable_post_processing = false\n")
            log = open(workspace / f"{name}-{round_name}.log", "w")
            logs.append(log)
            processes.append(subprocess.Popen([str(isolated_engine), "--go", "--config", str(profile),
                "--address", "127.0.0.1", "--password", "space-test-password", "--info"],
                env=environment, stdout=log, stderr=subprocess.STDOUT))
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if (world / "failure").exists():
                raise RuntimeError(f"native {round_name} assertion failed; inspect {workspace}")
            if success.exists():
                server.wait(timeout=10)
                if server.returncode != 0:
                    raise RuntimeError(f"server returned {server.returncode}")
                print(f"PASS two native clients: {round_name}", flush=True)
                break
            if server.poll() is not None:
                raise RuntimeError(f"server exited early: {server.returncode}; inspect {workspace}")
            time.sleep(0.1)
        else:
            raise RuntimeError(f"native {round_name} timed out; inspect {workspace}")
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
        for process in processes:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        for log in logs:
            log.close()
print("PASS native server persistence, two-client edits, rotation and private preview checks")
