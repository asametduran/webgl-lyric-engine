"""Simple watcher: wait for the capture (ffmpeg) to finish -> verify tralala-code-mv.mp4 -> shutdown /s /t 60.
If verification fails the PC is NOT shut down (so a broken render can be looked at). Cancel a pending shutdown: shutdown /a
Log: finish_and_upload.log
"""
import os, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from finish_and_upload import ffmpeg_running, verified, log

log("shutdown watcher started: waiting for ffmpeg to finish")
while ffmpeg_running():
    time.sleep(20)
time.sleep(5)
ok, info = verified()
log(f"verify: {ok} {info}")
if ok:
    log("render verified -> shutdown in 60 s (cancel with: shutdown /a)")
    subprocess.run(["shutdown", "/s", "/t", "60"])
else:
    log("render NOT verified -> no shutdown")
