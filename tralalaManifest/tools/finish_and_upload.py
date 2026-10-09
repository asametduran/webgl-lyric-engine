"""Unattended finisher: wait for the capture to finish -> verify the MP4 -> upload to YouTube -> shutdown (only if everything succeeded).
Run detached:  python tools/finish_and_upload.py [--privacy unlisted] [--no-shutdown]
Log: finish_and_upload.log. Cancel a pending shutdown with:  shutdown /a
"""
import argparse, json, os, subprocess, sys, time, traceback

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
VIDEO = os.path.join(ROOT, "tralala-code-mv.mp4")
LOG = os.path.join(ROOT, "finish_and_upload.log")
EXPECT_DURATION = 229.16  # audio.mp3 duration


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    open(LOG, "a", encoding="utf-8").write(line + "\n")


def ffmpeg_running():
    return "ffmpeg.exe" in subprocess.run(["tasklist", "/FI", "IMAGENAME eq ffmpeg.exe"], capture_output=True, text=True).stdout


def probe():
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height:format=duration,size", "-of", "json", VIDEO], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return json.loads(r.stdout)


def verified():
    p = probe()
    if not p:
        return False, "ffprobe cannot read the file (capture not finished or failed)"
    v = next((s for s in p["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in p["streams"] if s["codec_type"] == "audio"), None)
    dur = float(p["format"]["duration"])
    ok = bool(v and a and v["width"] == 1920 and v["height"] == 1080 and abs(dur - EXPECT_DURATION) < 1.5)
    return ok, f"video={v and (v['codec_name'], v['width'], v['height'])} audio={a and a['codec_name']} duration={dur:.2f}s size={int(p['format']['size'])/1e6:.0f}MB"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--privacy", default="unlisted", choices=["unlisted", "public", "private"])
    ap.add_argument("--no-shutdown", action="store_true")
    a = ap.parse_args()
    log(f"watching for capture to finish (privacy={a.privacy}, shutdown={'no' if a.no_shutdown else 'yes'})")
    try:
        while ffmpeg_running():
            time.sleep(20)
        time.sleep(5)
        ok, info = verified()
        log(f"verify: {ok} {info}")
        if not ok:
            log("NOT uploading: the video failed verification. No shutdown."); return 1
        import youtube_upload
        youtube_upload.credentials()  # fail early if the token is missing/expired
        vid = youtube_upload.upload(VIDEO, a.privacy)
        log(f"uploaded https://youtu.be/{vid}")
    except SystemExit as e:
        log(f"STOPPED: {e}. No shutdown."); return 1
    except Exception:
        log("FAILED:\n" + traceback.format_exc() + "No shutdown."); return 1
    if not a.no_shutdown:
        log("upload done -> shutdown in 60 s (cancel with: shutdown /a)")
        subprocess.run(["shutdown", "/s", "/t", "60"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
