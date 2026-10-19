"""Builds lyrics.json from the curated reference text + Whisper-derived line timings (see words.json / retry runs)."""
import json, re
S = {"ahri": "#FF0055", "akali": "#00FF88", "evelynn": "#9D00FF", "kaisa": "#00D4FF", "all": "#FFD700"}
A, K, E_, M = "ahri", "akali", "evelynn", "kaisa"
DUET = [E_, A]
# (t, end, singer(s), text, romanization or None)
def pre(o, ):
    return [
     (129.7-73.3+o, 131.6-73.3+o, [E_], "I'm insane", None),
    ]
sections = []
def sec(name, label, lines, assumed=False): sections.append((name, label, lines, assumed))

sec("intro", "Intro: Sophie Powers", [
 (13.0, 16.9, [E_], "I'm a fire starter, work a little harder", None),
 (17.0, 20.1, [E_], "Got me fired up, I'ma burn it down like", None),
 (20.32, 24.0, [E_], "I'm a fire starter, crazy, out of order", None),
 (24.36, 27.1, [E_], "Got me fired up, I'ma burn it down like (Hey, hey)", None)])
sec("chorus1", "Chorus: Mimi Webb", [
 (27.16, 30.7, [M], "I'ma start a fire, oh, I like a little drama (Yeah, yeah)", None),
 (30.76, 34.4, [M], "Call the fire fighter, call me crazy, call it karma (Hey, yeah)", None),
 (34.48, 38.0, [M], "Got you burnin' so hot, you'll be beggin' for water (Yeah, yeah)", None),
 (38.1, 41.3, [M], "I'ma start a fire, I'm a fire starter (Hey)", None)])
sec("verse1", "Verse 1: SOYEON, Mimi Webb", [
 (41.4, 43.7, [K], "긴 어둠 끝 불을 밝혀", "gin eodum kkeut bureul balkhyeo"),
 (43.8, 45.4, [K], "바람 불어도 (후후), I'm the lighter", "baram bureodo (huhu), I'm the lighter"),
 (45.5, 47.1, [K], "꺾이지 않는 desire", "kkeokkiji annneun desire"),
 (47.2, 49.7, [K], "올라가 펑펑 터져 마치 축제 같지", "ollaga peongpeong teojyeo machi chukje gatji"),
 (49.82, 50.8, [M], "I can be sweet", None),
 (50.86, 52.6, [M], "But I got gold venom on my teeth", None),
 (52.68, 54.4, [M], "I'm only showin' up for a fee", None),
 (54.46, 56.3, [M], "You're only showin' up for the tea", None)])
def prechorus(o, first_extra=""):
    return [
     (56.4+o, 58.4+o, [E_], "I'm insane"+first_extra, None),
     (58.54+o, 61.9+o, [E_], "Yeah, I know you like it that way", None),
     (62.0+o, 64.5+o, [E_], "Chaos runnin' wild in my veins", None),
     (64.62+o, 67.5+o, [A], "느껴봐 차갑던 이 세상을", "neukkyeobwa chagapdeon i sesangeul"),
     (67.58+o, 70.4+o, [A], "붉게 물들일 이 순간", "bulkke muldeuril i sungan")]
sec("prechorus1", "Pre-Chorus: Sophie Powers, MIYEON", prechorus(0))
sec("chorus2", "Chorus: Mimi Webb", [
 (70.7, 74.6, [M], "I'ma start a fire, oh, I like a little drama", None),
 (74.7, 78.4, [M], "Call the fire fighter, call me crazy, call it karma", None),
 (78.5, 82.0, [M], "Got you burnin' so hot, you'll be beggin' for water", None),
 (82.1, 85.8, [M], "I'ma start a fire, I'm a fire starter", None)])
post = lambda o: [
 (86.48+o, 89.6+o, DUET, "I'm a fire starter, work a little harder", None),
 (89.7+o, 92.9+o, DUET, "Got me fired up, I'ma burn it down like (Hey)", None),
 (93.9+o, 96.8+o, DUET, "I'm a fire starter, crazy, out of order", None),
 (97.0+o, 99.9+o, DUET, "I'm a— I'm a— I'm a fire starter (Hey)", None)]
sec("postchorus1", "Post-Chorus: Sophie Powers, MIYEON", post(0), True)
sec("verse2", "Verse 2: SOYEON", [
 (100.4, 102.2, [K], "멈추지 않아 월화수목금토일 나를 jealous", "meomchuji anha wolhwasumokgeumtoil nareul jealous"),
 (102.3, 104.0, [K], "근데 영 고갈이 안돼 dreamers (Hey)", "geunde yeong gogari andwae dreamers (Hey)"),
 (104.08, 106.2, [K], "0부터 100까지, 너의 무의식까지", "yeongbuteo baekkkaji, neoui muuisikkaji"),
 (106.28, 107.25, [K], "단숨에 다 퍼져 퍼져 (Hey)", "dansume da peojyeo peojyeo (Hey)"),
 (107.3, 111.0, [K], "Let's go, 삐걱 삐-삐걱, 어느새 lose control (Hey)", "Let's go, ppigeok ppi-ppigeok, eoneusae lose control (Hey)"),
 (111.1, 114.9, [K], "자, beat drop, beat-beat drop, 놀아보자 얼쑤 (얼쑤)", "ja, beat drop, beat-beat drop, noraboja eolssu (eolssu)")])
sec("verse3", "Verse 3: SOYEON, Mimi Webb", [
 (114.94, 116.15, [K], "Ooh, ooh, 불을 지펴라", "Ooh, ooh, bureul jipyeora"),
 (116.22, 118.25, [K], "까마디 까만 이 밤하늘을 달려 (Mm, mm, mm)", "kkamadi kkaman i bamhaneureul dallyeo (Mm, mm, mm)"),
 (118.32, 119.8, [K], "Ooh, ooh, 준비됐어 난", "Ooh, ooh, junbidwaesseo nan"),
 (119.86, 122.0, [K], "Sit back relax, gonna take it, gonna take it, ooh", None),
 (122.04, 123.55, [M], "Ooh, ooh, when I start the fire", None),
 (123.6, 125.45, [M], "Better be ready for when I take it higher", None),
 (125.5, 127.2, [M], "Ooh, ooh, when I start the fire", None),
 (127.26, 129.3, [M], "Better be ready for when I take that, take that", None)], True)
sec("prechorus2", "Pre-Chorus: Sophie Powers, MIYEON", prechorus(73.3, " (I'm insane)"))
sec("chorus3", "Chorus: Mimi Webb", [
 (144.2, 147.9, [M], "I'ma start a fire, oh, I like a little drama (Hey)", None),
 (148.0, 151.6, [M], "Call the fire fighter, call me crazy, call it karma (Woah)", None),
 (151.7, 155.3, [M], "Got you burnin' so hot, you'll be beggin' for water", None),
 (155.4, 158.3, [M], "I'ma start a fire, I'm a fire starter", None),
 (158.4, 162.6, [M], "I'ma start a fire, oh, I like a little drama", None),
 (162.7, 166.3, [M], "Call the fire fighter, call me crazy, call it karma", None),
 (166.4, 169.9, [M], "If you can't take the heat, take it out of the sauna", None),
 (170.0, 174.1, [M], "I'ma start a fire, I'm a fire starter (Hey)", None)])
sec("postchorus2", "Post-Chorus: Sophie Powers, MIYEON", post(174.2-86.48+0) if False else [
 (174.2, 177.3, DUET, "I'm a fire starter, work a little harder", None),
 (177.4, 180.8, DUET, "Got me fired up, I'ma burn it down like (Hey)", None),
 (180.9, 183.9, DUET, "I'm a fire starter, crazy, out of order", None),
 (184.0, 187.8, DUET, "I'm a— I'm a— I'm a fire starter (Hey)", None)], True)

out, tot, cnt = [], {k: 0.0 for k in (A, K, E_, M)}, {k: 0 for k in (A, K, E_, M)}
for name, label, lines, assumed in sections:
    L = []
    for t, e, who, text, rom in lines:
        toks = text.split()
        wts = [max(1, len(re.sub(r"\W", "", x))) for x in toks]
        tw = sum(wts); c = t; words = []
        for x, wt in zip(toks, wts):
            d = (e - t) * wt / tw
            words.append({"w": x, "s": round(c, 2), "e": round(c + d, 2)}); c += d
        L.append({"t": round(t, 2), "end": round(e, 2), "singers": who, "text": text, **({"rom": rom} if rom else {}), "words": words})
        for s in who:
            tot[s] += (e - t) / len(who); cnt[s] += 1 / len(who)
    out.append({"id": name, "label": label, **({"assumed": True} if assumed else {}), "lines": L})
json.dump({"_note": "Text/attribution from user-supplied reference; timings from Whisper large-v3 (+ clip re-runs); word times within a line are proportional (not forced-aligned). assumed=true -> split of singers inside the section is a guess.",
           "colors": S, "duration": 206.46, "sections": out, "stats": {k: {"seconds": round(tot[k], 1), "lines": round(cnt[k], 1)} for k in tot}},
          open("lyrics.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
T = sum(tot.values())
for k in tot: print(f"{k:8s} {tot[k]:6.1f}s {100*tot[k]/T:5.1f}%  {cnt[k]:4.1f} lines")
print("total", round(T, 1))
