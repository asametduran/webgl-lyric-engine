"""Builds lyrics.json from the curated reference text (tools/lyrics_ref.txt) + Whisper-derived line timings (words.json, retry runs).
Skit dialogue is NOT lyrics: it becomes cinematic subtitles under "skit". The quiet tail becomes scrolling end credits under "credits"."""
import json, re

COLORS = {"yellow": "#FFE800", "red": "#D00000", "black": "#0D0C0C", "cream": "#F4ECD8"}
sections = []
def sec(id_, label, lines, chapter, assumed=False): sections.append((id_, label, lines, chapter, assumed))

# (t, end, text) -- t/end from Whisper large-v3 word times; words inside a line are proportional (not forced-aligned)
sec("intro", "Intro", [(31.0, 33.4, "Yeah, yeah")], 1, True)
# Chorus 1 vocals are buried in the mix: anchored on Tarantino x2 @49.2 and the Camino tag @58.4 (retry run), rest from chorus 2/3 spacing
CH1 = [
 (36.4, 39.3, "Got my nails really long like the barrel of my gun"),
 (39.5, 42.3, "And my lipstick all over your face"),
 (42.6, 45.4, "I'm a boss, I'm a don when I'm drivin' to the sun"),
 (45.6, 48.9, "It's a movie, baby, come and press play (Press play)"),
 (49.2, 51.9, "Tarantino, Tarantino"),
 (51.9, 55.4, "Got my feet hangin' out the Camino (Oh)"),
 (57.0, 58.4, "Tarantino, Tarantino (Yeah)"),
 (58.4, 61.3, "Got my feet hangin' out the Camino")]
CH2 = [
 (86.4, 89.4, "Got my nails really long like the barrel of my gun"),
 (89.4, 92.2, "And my lipstick all over your face"),
 (92.4, 95.6, "I'm a boss, I'm a don when I'm drivin' to the sun"),
 (95.6, 99.8, "It's a movie, baby, come and press play (Press play)"),
 (100.2, 101.2, "Tarantino, Tarantino"),
 (101.2, 105.6, "Got my feet hangin' out the Camino (Oh)"),
 (106.2, 107.3, "Tarantino, Tarantino (Yeah)"),
 (107.3, 110.3, "Got my feet hangin' out the Camino")]
CH3 = [
 (135.3, 138.3, "Got my nails really long like the barrel of my gun"),
 (138.3, 141.0, "And my lipstick all over your face"),
 (141.3, 144.5, "I'm a boss, I'm a don when I'm drivin' to the sun"),
 (144.5, 147.3, "It's a movie, baby, come and press play (Press play)"),
 (147.3, 150.0, "Tarantino, Tarantino"),
 (150.0, 154.6, "Got my feet hangin' out the Camino (Oh)"),
 (154.9, 156.2, "Tarantino, Tarantino (Yeah)"),
 (156.2, 160.0, "Got my feet hangin' out the Camino")]
sec("chorus1", "Chorus", CH1, 1, True)
sec("verse1", "Verse 1", [
 (61.6, 64.7, "I got Kill Bill demeanor, mustard all on my sneakers"),
 (64.7, 67.9, "Pullin' up to the motel, baby, turn up the speakers"),
 (67.9, 70.8, "Catch me causin' a scene here right outside the convenience"),
 (70.8, 74.0, "Hold my gold chain, baby, you can stay for the teaser")], 2)
PRE = [(0, 3.5, "Death proof, baby, I do all my own stunts"), (3.5, 6.2, "F you, baby, like a razor on my tongue"),
       (6.2, 9.3, "Black suit, fast food, take me out to lunch"), (9.3, 12.4, "At the drive-thru, Thai funk, shakin' out the trunk")]
sec("pre1", "Pre-Chorus", [(74.0 + a, 74.0 + b, x) for a, b, x in PRE], 3)
sec("chorus2", "Chorus", CH2, 4)
sec("verse2", "Verse 2", [
 (110.3, 113.7, "Catch me in a cabana wearin' just a bandana"),
 (113.7, 116.7, "Sippin' juice, silver tooth, shinin' like a katana"),
 (116.7, 120.0, "I'ma chop-chop nonstop, bomb drop, chopper"),
 (120.0, 123.2, "Lookin' out the window at these window shoppers")], 5)
sec("pre2", "Pre-Chorus", [(123.2 + a, 123.2 + b, x) for a, b, x in [(0, 3.3, PRE[0][2]), (3.3, 6.0, PRE[1][2]), (6.0, 9.1, PRE[2][2]), (9.1, 12.1, PRE[3][2])]], 5)
sec("chorus3", "Final Chorus", CH3, 6)
sec("post", "Post-Chorus", [(161.0, 162.8, "Tarantino, Tarantino"), (167.0, 168.8, "Tarantino, Tarantino")], 6)
sec("outro", "Outro", [
 (172.0, 177.4, "Hollywood in your hands and you know how it ends"),
 (177.6, 181.0, "So come on, turn me on, 'cause it ain't gon' last for long"),
 (181.1, 184.2, "I'm a movie, baby, come and press play (Press play)")], 6)

# skit dialogue (0:00-0:29) -> cinematic subtitles.  who: a = yellow, b = cream.  "dinner" in the first line is a guess (Whisper: "dialing")
skit = [
 (0.0, 3.3, "a", "Remember, dinner's at 5:30. Flight at 8."), (3.4, 5.4, "b", "Hang on, I thought my flight was at 10."),
 (5.5, 8.4, "a", "That's when you get in. I couldn't get anything later."), (8.5, 9.0, "b", "Oh."), (9.1, 10.8, "b", "Wait, what about Tarantino?"),
 (10.9, 13.9, "a", "Yes, your favorite director is still at the hotel tonight."), (14.0, 14.9, "b", "He's still here?"),
 (15.0, 16.9, "a", "Till tomorrow. Same room number."), (17.0, 19.7, "a", "Just go give him your letter. I'll send security up."),
 (19.8, 20.4, "b", "What time?"), (20.5, 22.4, "a", "Don't be up too late."), (22.5, 24.3, "b", "Okay. I'm gonna do it."),
 (24.4, 26.8, "a", "Remember, your flight's at 8."), (26.9, 28.2, "b", "Got it."), (28.3, 29.3, "b", "I'll call you after.")]
credits = [
 ("big", "TARANTINO"), ("small", "A FAN-MADE CODE MV · ALL CODE · NO FOOTAGE"), ("gap", ""),
 ("role", "THE BOSS"), ("name", "LISA"), ("gap", ""),
 ("role", "NAILS"), ("name", "REALLY LONG"), ("gap", ""),
 ("role", "KILL BILL DEMEANOR"), ("name", "MUSTARD ON THE SNEAKERS"), ("gap", ""),
 ("role", "STUNTS"), ("name", "ALL HER OWN"), ("gap", ""),
 ("role", "DRIVER"), ("name", "FEET OUT THE CAMINO"), ("gap", ""),
 ("role", "CATERING"), ("name", "FAST FOOD, DRIVE-THRU"), ("gap", ""),
 ("role", "WARDROBE"), ("name", "BLACK SUIT · GOLD CHAIN · SILVER TOOTH"), ("gap", ""),
 ("small", "SONG BY LISA · MUSIC AND LYRICS BELONG TO THEIR OWNERS"), ("small", "NO AUDIO OR VIDEO FILES SHIPPED IN THE REPO")]
chapters = [
 {"name": "REEL ONE", "a": 0.0, "b": 29.5}, {"name": "TITLE SEQUENCE", "a": 29.5, "b": 61.5}, {"name": "KILL BILL", "a": 61.5, "b": 74.0},
 {"name": "DEATH PROOF", "a": 74.0, "b": 86.4}, {"name": "PRESS PLAY", "a": 86.4, "b": 110.3}, {"name": "CABANA / KATANA", "a": 110.3, "b": 135.3},
 {"name": "HOLLYWOOD", "a": 135.3, "b": 184.5}, {"name": "END CREDITS", "a": 184.5, "b": 217.04}]

out = []
for id_, label, lines, ch, assumed in sections:
    L = []
    for t, e, text in lines:
        toks = text.split()
        wts = [max(1, len(re.sub(r"\W", "", x))) for x in toks]
        tw, c, words = sum(wts), t, []
        for x, wt in zip(toks, wts):
            d = (e - t) * wt / tw
            words.append({"w": x, "s": round(c, 2), "e": round(c + d, 2)}); c += d
        L.append({"t": t, "end": e, "singers": ["lisa"], "text": text, "words": words})
    out.append({"id": id_, "label": label, "chapter": ch, **({"assumed": True} if assumed else {}), "lines": L})
json.dump({"_note": "Lyrics: user-supplied reference; times: Whisper large-v3 (+ clip re-runs). Word times within a line are proportional. Chorus 1 (36-61s) and the intro ad-lib are estimated from chorus 2/3 spacing. Skit dialogue -> skit[] subtitles, tail -> credits[].",
           "colors": COLORS, "duration": 217.04, "sections": out,
           "skit": {"a": 0.0, "b": 29.5, "lines": [{"t": a, "end": b, "who": w, "text": x} for a, b, w, x in skit]},
           "credits": {"a": 184.5, "scrollEnd": 210.8, "fin": 211.4, "lines": [{"k": k, "text": x} for k, x in credits]},
           "chapters": chapters},
          open("lyrics.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("lines:", sum(len(s[2]) for s in sections), "skit:", len(skit), "credits:", len(credits))
