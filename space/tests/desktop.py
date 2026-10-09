#!/usr/bin/env python3
"""Optional Linux desktop smoke check using Xvfb/xdotool and software OpenGL.

Exercises actual key bindings and local flight (not CSM/chat-simulated movement).
Screenshots and logs remain in build/. Requires a run-in-place client build.
"""
import argparse
import csv
import os
from pathlib import Path
import subprocess
import tempfile
import time

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--engine", type=Path, default=root / "bin/luanti")
parser.add_argument("--xvfb", default="Xvfb")
parser.add_argument("--xdotool", default="xdotool")
parser.add_argument("--display", default=":99")
args = parser.parse_args()
folder = Path(tempfile.mkdtemp(prefix="space-desktop-", dir=root / "build"))
print(f"Desktop evidence: {folder}", flush=True)
probe = folder / "world/worldmods/flight_probe"
probe.mkdir(parents=True)
(probe / "mod.conf").write_text("name = flight_probe\ndepends = space_core\n")
(probe / "init.lua").write_text("""
local elapsed, timer = 0, 0
core.register_on_joinplayer(function(player)
 player:set_pos({x=0,y=50,z=-20}); player:set_look_vertical(0); player:set_look_horizontal(0)
end)
core.register_globalstep(function(dt)
 elapsed=elapsed+dt; timer=timer+dt
 if timer<0.05 then return end; timer=0
 local player=core.get_connected_players()[1]; if not player then return end
 local trigger=io.open(core.get_worldpath()..'/render','r')
 if trigger then
  trigger:close(); os.remove(core.get_worldpath()..'/render')
  player:set_pos({x=0,y=34,z=-6}); player:set_look_vertical(0.9); player:set_look_horizontal(0)
  local session=space.building.session(player); session.material=3; session.rotation=1
 end
 local p=player:get_pos(); local v=player:get_velocity()
 local f=assert(io.open(core.get_worldpath()..'/motion.csv','a'))
 f:write(string.format('%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f\\n',elapsed,p.x,p.y,p.z,v.x,v.y,v.z)); f:close()
end)
""")
profile = folder / "client.conf"
profile.write_text((root / "space/config/client.conf").read_text()
    + f"\nscreen_w = 1280\nscreen_h = 720\nfps_max = 60\nvideo_driver = opengl3\n"
    + f"enable_sound = false\nscreenshot_path = {folder}\n")
environment = os.environ.copy()
environment.update(DISPLAY="localhost" + args.display, LIBGL_ALWAYS_SOFTWARE="true", ALSOFT_DRIVERS="null",
    LUANTI_GAME_PATH=str(root / "games"), XDG_RUNTIME_DIR=str(folder), SDL_VIDEODRIVER="x11")
logs, processes = [], []
def start(command, logfile):
    log = open(folder / logfile, "w")
    logs.append(log)
    process = subprocess.Popen(command, env=environment, stdout=log, stderr=subprocess.STDOUT)
    processes.append(process)
    return process
def xdo(*arguments):
    return subprocess.check_output([args.xdotool, *arguments], env=environment, text=True).strip()
def samples():
    with open(folder / "world/motion.csv") as file:
        return [list(map(float, row)) for row in csv.reader(file) if len(row) == 7]
try:
    display_server = start([args.xvfb, args.display, "-screen", "0", "1280x720x24",
        "-ac", "-nolisten", "unix", "-listen", "tcp"], "xvfb.log")
    time.sleep(1)
    if display_server.poll() is not None:
        raise RuntimeError("virtual display failed; inspect xvfb.log")
    client = start([str(args.engine.resolve()), "--config", str(profile), "--go", "--world",
        str(folder / "world"), "--gameid", "luanti_space", "--info"], "client.log")
    time.sleep(6)
    if client.poll() is not None:
        raise RuntimeError("client exited; inspect client.log")
    window = xdo("search", "--pid", str(client.pid)).splitlines()[-1]
    xdo("windowfocus", window)
    time.sleep(1)
    initial = samples()[-1]
    assert abs(initial[2] - 50) < 0.1, "hover drifts before input"
    for name, keys, component, expected_speed in (
        ("cruise", ["w"], 6, 7), ("ascend", ["space"], 5, 7),
        ("descend", ["Control_L"], 5, -7), ("boost", ["Shift_L", "w"], 6, 18),
    ):
        first = len(samples())
        xdo("keydown", *keys)
        time.sleep(1)
        xdo("keyup", *keys)
        time.sleep(0.8)  # boosted release takes ~18/35s plus pose-report latency
        observed = samples()[first:]
        peak = max(observed, key=lambda row: abs(row[component]))[component]
        assert abs(peak - expected_speed) < 0.4, f"{name}: expected {expected_speed}, got {peak}"
        assert max(abs(value) for value in observed[-1][4:]) < 0.15, f"{name}: did not brake to hover"
        print(f"PASS native key binding: {name}, peak {peak:.2f}, settled hover", flush=True)
    (folder / "world/render").write_text("render fixture\n")
    time.sleep(1)
    xdo("key", "F12")
    time.sleep(2)
    assert list(folder.glob("screenshot_*.png")), "no rendered screenshot"
    print("PASS OpenGL desktop rendering and hover/flight controls", flush=True)
finally:
    for process in reversed(processes):
        if process.poll() is None:
            process.terminate()
    for process in processes:
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    for log in logs:
        log.close()
