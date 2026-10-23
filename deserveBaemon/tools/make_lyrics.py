"""Builds lyrics.json from the user-supplied reference lyrics (tools/lyrics_ref.txt) + Whisper large-v3 line timings (words.json, retry clips).
Line times are Whisper-anchored; word times inside a line are proportional (not forced-aligned). Duet splits marked assumed=True are guesses."""
import json, re
COLORS = {"rora": "#A0C4FF", "chiquita": "#FFC6FF", "ahyeon": "#FFADAD", "pharita": "#FDFFB6", "ruka": "#CAFFBF", "asa": "#9BF6FF"}
RO, CH, AH, PH, RU, AS = "rora", "chiquita", "ahyeon", "pharita", "ruka", "asa"
DURATION = 214.65
sections = []
def sec(id_, label, lines, chapter, assumed=False): sections.append((id_, label, lines, chapter, assumed))
# (t, end, singers, text, romanization|None)

sec("verse1", "Verse 1", [
 (16.6, 20.0, [RO], "오랜만이야 잘 지낸 거니", "Oraenmaniya jal jinaen geoni"),
 (20.2, 24.4, [RO], "여전히 눈이 부셔 넌", "Yeojeonhi nuni busyeo neon"),
 (24.9, 29.3, [RO], "아마도 너는 잘 모를 거야", "Amado neoneun jal moreul geoya"),
 (29.5, 34.6, [RO], "All of the memories, all of the moments come rushing back", None)], 1)

PRE_KR = ("전해 들었어 네 옆엔 아직", "Jeonhae deureosseo ne yeopen ajik"), ("그 사람이 있다고", "Geu sarami itdago")
PRE_EN = "I see it in your eyes that you need me by your side", "And I can't walk away 'cause love ain't supposed to be a riddle"
def pre(s, t0, t, who, asm=False):
    ts = t
    sec(s, "Pre-Chorus", [
     (ts[0], ts[1], [who], *PRE_KR[0]), (ts[1], ts[2], [who], *PRE_KR[1]),
     (ts[3], ts[4], [who], PRE_EN[0], None), (ts[5], ts[6], [who], PRE_EN[1], None)], 2 if s == "pre1" else 5, asm)
pre("pre1", 0, (36.7, 39.9, 43.0, 44.4, 48.9, 49.0, 54.4), CH)

def chorus(s, t, who, chapter, asm=False, label="Chorus"):
    sec(s, label, [
     (t[0], t[1], who[0], "You deserve someone that loves you right", None),
     (t[2], t[3], who[1], "Baby, you deserve better", None),
     (t[4], t[5], who[2], "I could love you 'til the end of time", None),
     (t[6], t[7], who[3], "Baby, you deserve better", None)], chapter, asm)
chorus("chorus1", (54.6, 59.9, 60.4, 62.9, 63.3, 69.6, 70.0, 72.8), [[AH]] * 4, 3)
sec("post1", "Post-Chorus", [
 (73.9, 77.0, [PH], "Better, oh, better", None), (77.4, 81.9, [PH], "Baby, you deserve better", None)], 3)

sec("verse2", "Verse 2", [
 (82.56, 84.9, [RU], "겨울을 덮어준 너의 봄", "Gyeoureul deopeojun neoui bom"),
 (84.96, 87.1, [RU], "여름 바람이 돼주던 너의 손", "Yeoreum barami dwaejudeon neoui son"),
 (87.2, 89.5, [RU], "어부바해서 집까지", "Eobubahaeseo jipkkaji"),
 (89.68, 91.9, [RU], "Butterfly라며 꽃까지", "Butterflyramyeo kkotkkaji"),
 (92.02, 94.2, [AS], "동화 같아 돌아보니까 never", "Donghwa gata dorabonikka never"),
 (94.4, 96.9, [AS], "구름처럼 띄워 줬을까 매번", "Gureumcheoreom ttuiwo jwosseulkka maebeon"),
 (96.96, 98.9, [AS], "결국 비는 내리고 난 우산이 없네", "Gyeolguk bineun naerigo nan usani eomne"),
 (99.08, 101.5, [AS], "찬란했던 계절 속에 빛은 어디로", "Challanhaetdeon gyejeol soge bicheun eodiro")], 4, True)

# Pre-chorus 2: KR lines are quiet in the mix; times estimated from Pre-Chorus 1 spacing (+65.8s), English lines are Whisper-anchored
sec("pre2", "Pre-Chorus", [
 (102.0, 105.6, [RO], *PRE_KR[0]), (105.8, 109.6, [RO], *PRE_KR[1]),
 (110.2, 114.95, [RO], PRE_EN[0], None), (115.28, 120.4, [RO], PRE_EN[1], None)], 5, True)

chorus("chorus2", (120.6, 126.0, 126.78, 129.0, 129.16, 135.4, 135.92, 138.6), [[PH]] * 4, 6)
sec("post2", "Post-Chorus", [
 (139.16, 142.8, [AH], "Better, better", None), (144.76, 148.3, [AH], "Baby, you deserve better", None)], 6)

sec("bridge", "Bridge", [
 (149.28, 154.5, [CH], "So, wherever you go, whoever you meet", None),
 (154.88, 156.9, [PH], "Just remember me", None),
 (157.98, 163.8, [CH, PH], "'Cause every time I look into your eyes, my heart won't let me lie", None),
 (163.94, 167.6, [CH, PH], "Oh, baby, one thing I need you to know", None)], 7, True)
sec("postbridge", "Post-Bridge", [(171.0, 173.8, [AH], "Baby, you deserve better", None)], 7)

sec("chorus3", "Final Chorus", [
 (174.98, 179.9, [PH, AH], "You deserve someone (Oh) that loves you right (To love)", None),
 (180.54, 183.2, [PH, AH], "Baby, you deserve better (Ah)", None),
 (183.56, 189.6, [PH, AH], "I could love you (Love you) 'til the end of time ('Til the end of time)", None),
 (189.98, 193.9, [PH, AH], "Baby, you deserve better", None)], 8, True)

chapters = [
 {"name": "HELLO AGAIN", "a": 0.0, "b": 36.5}, {"name": "THE RUMOR", "a": 36.5, "b": 54.5}, {"name": "DESERVE", "a": 54.5, "b": 82.2},
 {"name": "FOUR SEASONS", "a": 82.2, "b": 101.6}, {"name": "THE RIDDLE", "a": 101.6, "b": 120.5}, {"name": "BETTER", "a": 120.5, "b": 149.0},
 {"name": "REMEMBER ME", "a": 149.0, "b": 174.5}, {"name": "FINAL VERDICT", "a": 174.5, "b": 194.0}, {"name": "OUTRO", "a": 194.0, "b": DURATION}]

out, tot = [], {k: 0.0 for k in COLORS}
for id_, label, lines, ch, assumed in sections:
    L = []
    for t, e, who, text, rom in lines:
        toks = text.split()
        wts = [max(1, len(re.sub(r"\W", "", x))) for x in toks]
        tw, c, words = sum(wts), t, []
        for x, wt in zip(toks, wts):
            d = (e - t) * wt / tw
            words.append({"w": x, "s": round(c, 2), "e": round(c + d, 2)}); c += d
        for s in who: tot[s] += (e - t) / len(who)
        L.append({"t": t, "end": e, "singers": who, "text": text, **({"rom": rom} if rom else {}), "words": words})
    out.append({"id": id_, "label": label, "chapter": ch, **({"assumed": True} if assumed else {}), "lines": L})
json.dump({"_note": "Lyrics: user-supplied reference; times: Whisper large-v3 + clip re-runs. Word times proportional. Assumed sections: duet splits and pre-chorus 2 KR lines are guesses.",
           "colors": COLORS, "duration": DURATION, "sections": out, "chapters": chapters},
          open("lyrics.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("lines:", sum(len(s[2]) for s in sections))
for k, v in sorted(tot.items(), key=lambda kv: -kv[1]): print(f"{k:9s} {v:6.1f}s {100*v/DURATION:4.1f}%")
