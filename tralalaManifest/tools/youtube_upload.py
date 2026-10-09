"""YouTube auth + resumable upload (YouTube Data API v3).

  python tools/youtube_upload.py auth                      # one-time: prints the OAuth URL, saves token.json
  python tools/youtube_upload.py upload [video] [--privacy unlisted|public|private]

Needs client_secret.json (OAuth client of type "Desktop app", YouTube Data API v3 enabled) next to package.json.
client_secret.json and token.json are secrets: never commit them (they are in .gitignore).
"""
import argparse, os, random, sys, time
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECRET = os.path.join(ROOT, "client_secret.json")
TOKEN = os.path.join(ROOT, "token.json")
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
TITLE = "Manifest - TRALALA (Lyrics) — but the entire MV is code"


def credentials():
    creds = Credentials.from_authorized_user_file(TOKEN, SCOPES) if os.path.exists(TOKEN) else None
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        open(TOKEN, "w").write(creds.to_json())
    if not creds or not creds.valid:
        sys.exit("No valid token.json - run: python tools/youtube_upload.py auth")
    return creds


def auth(port=8765):
    if not os.path.exists(SECRET):
        sys.exit(f"Missing {SECRET}")
    flow = InstalledAppFlow.from_client_secrets_file(SECRET, SCOPES)
    # open_browser=False: the authorisation URL is printed so you can open it yourself; the local server waits for the redirect
    creds = flow.run_local_server(port=port, open_browser=False, access_type="offline", prompt="consent",
                                  authorization_prompt_message="OPEN THIS URL IN YOUR BROWSER:\n{url}\n", success_message="Authorised. You can close this tab.")
    open(TOKEN, "w").write(creds.to_json())
    print("token saved:", TOKEN, flush=True)


def upload(video, privacy="unlisted"):
    desc = open(os.path.join(ROOT, "tools", "description.txt"), encoding="utf-8").read()
    yt = build("youtube", "v3", credentials=credentials())
    body = {
        "snippet": {"title": TITLE, "description": desc, "categoryId": "10", "tags": ["manifest", "TRALALA", "lyrics", "lyric video", "three.js", "code"]},
        "status": {"privacyStatus": privacy, "selfDeclaredMadeForKids": False},
    }
    req = yt.videos().insert(part="snippet,status", body=body, media_body=MediaFileUpload(video, chunksize=8 * 1024 * 1024, resumable=True, mimetype="video/mp4"))
    resp, tries = None, 0
    while resp is None:
        try:
            status, resp = req.next_chunk()
            if status:
                print(f"uploaded {int(status.progress() * 100)}%", flush=True)
        except HttpError as e:
            if e.resp.status in (500, 502, 503, 504) and tries < 10:
                tries += 1; time.sleep(min(60, 2 ** tries + random.random())); continue
            raise
        except (ConnectionError, TimeoutError):
            if tries >= 10: raise
            tries += 1; time.sleep(min(60, 2 ** tries))
    vid = resp["id"]
    print(f"UPLOAD OK https://youtu.be/{vid}  privacy={resp['status']['privacyStatus']} (requested {privacy})", flush=True)
    return vid


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["auth", "upload"])
    ap.add_argument("video", nargs="?", default=os.path.join(ROOT, "tralala-code-mv.mp4"))
    ap.add_argument("--privacy", default="unlisted", choices=["unlisted", "public", "private"])
    a = ap.parse_args()
    auth() if a.cmd == "auth" else upload(a.video, a.privacy)
