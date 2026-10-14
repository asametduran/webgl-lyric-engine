"""words.json + transcribe.log segment starts -> lyrics.json (one line per whisper segment). Usage: python tools/make_lyrics.py"""
import json, re
words = json.load(open("words.json", encoding="utf-8"))["words"]
starts = [float(m.group(1)) for m in re.finditer(r"^\s*([\d.]+)\s", open("transcribe.log", encoding="utf-8").read(), re.M)]
lines = []
for i, s in enumerate(starts):
    e = starts[i + 1] if i + 1 < len(starts) else 1e9
    ws = [w for w in words if s - 0.06 <= w["s"] < e - 0.06]
    if not ws: continue
    lines.append({"t": ws[0]["s"], "end": round(ws[-1]["e"] + 0.3, 2), "text": " ".join(w["w"] for w in ws),
                  "block": f"p{len(lines)+1}"})
json.dump({"_note": "Whisper segment lines (word timings). Text is raw ASR: needs manual cleanup against the official lyrics.",
           "offset": 0, "source": "faster-whisper large-v3, language en", "lines": lines},
          open("lyrics.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(lines), "lines")
