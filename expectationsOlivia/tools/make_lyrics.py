"""Builds lyrics.json from the curated reference text + Whisper-derived line timings (words.json, transcribe.log, retry runs).
Skit/host speech is NOT lyrics: it becomes TV chyron / contestant card / scoreboard events under "skits"."""
import json, re
O, C = "olivia", "chappell"
DUET = [O, C]
COLORS = {"olivia": "#8A2BE2", "olivia_dark": "#5B18A7", "chappell": "#FF1493", "chappell_dark": "#E6005C", "gold": "#FFD700", "cyan": "#00F5FF", "bg": "#0F0F14"}
sections = []
def sec(id_, label, lines, chapter, assumed=False): sections.append((id_, label, lines, chapter, assumed))

# (t, end, singers, text) -- t/end from Whisper large-v3 word times; words inside a line are proportional (not forced-aligned)
sec("verse1", "Verse 1", [
 (50.0, 56.4, [O], "I met him at a party, I think he was on drugs"),
 (56.5, 64.5, [O], "He wasn't smart or funny, I convinced myself he was"),
 (64.7, 71.2, [O], "He had a great apartment and a car his parents bought"),
 (71.4, 77.3, [O], "I thought that he was perfect, and now his number's blocked")], 1)
sec("pre1", "Pre-Chorus", [
 (77.5, 79.6, [O], "Took a couple months (Took a couple months)"),
 (79.6, 83.0, [O], "But now I am secure (Now I am secure)"),
 (83.0, 86.4, [O], "I am so evolved (I am so evolved)"),
 (86.5, 92.6, [O], "Now I ask for more and more and more and more and more")], 1, True)
# Chorus 1 is cut by the skit after "passive" -- the two unheard lines are intentionally NOT shown
sec("chorus1", "Chorus", [
 (92.7, 96.6, [O], "I won't settle for a guy with a fake job"),
 (96.9, 100.2, [O], "They seem so desperate for loving, but, baby, I'm not"),
 (100.3, 103.7, [O], "Gave my heart with zero stipulations"),
 (103.8, 106.9, [O], "Now I take careful consideration"),
 (107.0, 111.1, [O], "I'm not kissing any boy that is passive")], 1)
sec("verse2", "Verse 2", [
 (154.3, 160.8, [C], "I took her to a concert, front row, thought it'd be fun"),
 (160.9, 168.0, [C], "Her hand moving up my skirt, new piercing on her tongue"),
 (168.2, 175.9, [C], "She said she'd call me later, that was three weeks ago"),
 (176.2, 181.9, [C], "Classic L.A. behavior, she could've just said no")], 3)
sec("pre2", "Pre-Chorus", [
 (182.2, 185.0, [C], "But in a couple months (In a couple months)"),
 (185.1, 188.8, [C], "This love will be procured (A love will be procured)"),
 (188.9, 190.9, [C], "She will be evolved (She will be evolved)"),
 (191.0, 196.9, [C], "And I will be adored, adored, adored, adored, adored")], 3, True)
sec("chorus2", "Chorus", [
 (197.1, 200.9, [C], "I won't settle for a girl with a fake job"),
 (201.3, 204.7, [C], "They seem so desperate for loving, but, baby, I'm not"),
 (204.9, 208.1, [C], "Gave my heart with zero stipulations"),
 (208.3, 211.3, [C], "Now I take careful consideration"),
 (211.5, 215.4, [C], "I'm not kissing any girl that is passive"),
 (215.6, 219.1, [C], "Their indecision is painfully unattractive"),
 (219.3, 222.4, [C], "Past mistakes are just new information"),
 (222.6, 226.2, [C], "These days, I've got expectations")], 3)
bridge = ["I've got big expectations", "I've got real big expectations", "I've got big expectations", "I've got real big expectations",
          "She's got big expectations", "She's got real big expectations", "She's got big expectations", "She's got real big expectations"]
sec("bridge", "Bridge", [(round(226.4 + 3.6 * i, 2), round(226.4 + 3.6 * i + 3.4, 2), DUET, tx) for i, tx in enumerate(bridge)], 4)
# final chorus: line 1-2 from clip re-run (255.1 / 259.1); rest from the two full-song passes (duet vocals overlap -> assumed)
sec("chorus3", "Final Chorus", [
 (255.1, 258.9, DUET, "I won't settle for a guy with a fake job"),
 (259.1, 263.0, DUET, "They seem so desperate for loving, but, baby, I'm not"),
 (263.2, 266.0, DUET, "Gave my heart with zero stipulations"),
 (266.2, 269.0, DUET, "Now I take careful consideration"),
 (269.2, 274.4, DUET, "I'm not kissing any boy that is passive"),
 (274.5, 276.9, DUET, "Their indecision is painfully unattractive"),
 (277.0, 280.6, DUET, "Past mistakes are just new information"),
 (280.8, 285.6, DUET, "These days, I've got expectations")], 5, True)

# skit / host events -> TV graphics.  type: shout|title|chyron|card|survey|standby|signoff
skits = [
 {"id": "intro", "label": "Intro skit", "a": 0.0, "b": 49.7, "mode": "intro", "events": [
  {"t": 0.0, "end": 3.3, "type": "chyron", "text": "OLIVIA DOES REMIXES NOW", "sub": "SPECIAL PRESENTATION"},
  {"t": 3.4, "end": 4.7, "type": "shout", "text": "SETTLE DOWN, FOLKS"},
  {"t": 4.8, "end": 9.6, "type": "title", "text": "THE BIG EXPECTATIONS SHOW"},
  {"t": 9.7, "end": 12.7, "type": "chyron", "text": "WITH YOUR HOST", "sub": "JOHNNY JOHNSON"},
  {"t": 12.8, "end": 15.5, "type": "shout", "text": "TONIGHT'S CONTESTANTS"},
  {"t": 15.6, "end": 23.7, "type": "card", "num": 1, "text": "OLIVIA RODRIGO"},
  {"t": 17.8, "end": 23.7, "type": "card", "num": 2, "text": "OLIVIA RODRIGO"},
  {"t": 20.5, "end": 23.7, "type": "card", "num": 3, "text": "OLIVIA RODRIGO"},
  {"t": 23.8, "end": 31.2, "type": "chyron", "text": "NOW, YOUR HOST", "sub": "JOHNNY JOHNSON"},
  {"t": 31.3, "end": 33.4, "type": "shout", "text": "SETTLE DOWN, FOLKS"},
  {"t": 33.5, "end": 38.0, "type": "title", "text": "THE BIG EXPECTATIONS SHOW"},
  {"t": 38.1, "end": 41.1, "type": "chyron", "text": "I'M YOUR HOST", "sub": "JOHNNY JOHNSON"},
  {"t": 41.2, "end": 44.1, "type": "shout", "text": "MEET OUR CONTESTANTS"},
  {"t": 44.2, "end": 49.7, "type": "chyron", "text": "OLIVIA, HOW'D YOU GET HERE?", "sub": "CONTESTANT #1 · OLIVIA RODRIGO"}]},
 {"id": "squabble", "label": "Interlude skit", "a": 111.2, "b": 154.2, "mode": "break", "events": [
  {"t": 111.2, "end": 121.9, "type": "standby", "text": "PLEASE STAND BY", "sub": "WE ARE EXPERIENCING TECHNICAL DIFFICULTIES"},
  {"t": 122.0, "end": 129.7, "type": "title", "text": "SISTER SQUABBLE", "sub": "AND WE'RE BACK WITH ANOTHER SPECIAL EPISODE"},
  {"t": 129.8, "end": 139.8, "type": "chyron", "text": "REIGNING CHAMPS: THE RODRIGOS", "sub": "HEART-TO-HEART WITH THE ROANS"},
  {"t": 139.9, "end": 143.1, "type": "shout", "text": "CONTESTANTS, COME ON UP!"},
  {"t": 143.2, "end": 146.6, "type": "shout", "text": "ALL RIGHT. HERE WE GO."},
  {"t": 146.7, "end": 154.2, "type": "survey", "text": "WE SURVEYED 100 PEOPLE IN THE ROOM", "sub": "PLACES YOU SHOULD TAKE HER", "q": 150.9}]},
 {"id": "outro", "label": "Sign-off", "a": 285.9, "b": 292.7, "mode": "outro", "events": [
  {"t": 286.0, "end": 292.7, "type": "signoff", "text": "CAN WE DO ALL THAT AGAIN?", "sub": "THANKS FOR PLAYING"}]},
]
chapters = [
 {"name": "SIGNAL", "a": 0.0, "b": 49.7}, {"name": "AUDITION", "a": 49.7, "b": 111.2}, {"name": "SISTER SQUABBLE", "a": 111.2, "b": 154.2},
 {"name": "THE REPLY", "a": 154.2, "b": 226.4}, {"name": "BIG EXPECTATIONS", "a": 226.4, "b": 255.0}, {"name": "FINAL ROUND", "a": 255.0, "b": 285.9},
 {"name": "SIGN-OFF", "a": 285.9, "b": 292.7}]

out, tot = [], {O: 0.0, C: 0.0}
for id_, label, lines, ch, assumed in sections:
    L = []
    for t, e, who, text in lines:
        toks = text.split()
        wts = [max(1, len(re.sub(r"\W", "", x))) for x in toks]
        tw, c, words = sum(wts), t, []
        for x, wt in zip(toks, wts):
            d = (e - t) * wt / tw
            words.append({"w": x, "s": round(c, 2), "e": round(c + d, 2)}); c += d
        L.append({"t": t, "end": e, "singers": who, "text": text, "words": words})
        for s in who: tot[s] += (e - t) / len(who)
    out.append({"id": id_, "label": label, "chapter": ch, **({"assumed": True} if assumed else {}), "lines": L})
json.dump({"_note": "Lyrics: user-supplied reference; times: Whisper large-v3 (+ clip re-run 246-264). Word times within a line are proportional. Chorus 1 stops at 'passive' because the skit cuts in. Host speech -> skits[].events (TV graphics).",
           "colors": COLORS, "duration": 292.63, "sections": out, "skits": skits, "chapters": chapters},
          open("lyrics.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({k: round(v, 1) for k, v in tot.items()}, "lines:", sum(len(s[2]) for s in sections))
