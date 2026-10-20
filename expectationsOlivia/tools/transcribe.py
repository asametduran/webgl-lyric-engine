"""audio.mp3 -> words.json (word-level timings) with faster-whisper. Usage: python tools/transcribe.py [model] [lang]"""
import json, sys
from faster_whisper import WhisperModel

model_name = sys.argv[1] if len(sys.argv) > 1 else "large-v3"
lang = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "auto" else None
import os
# CPU by default (cuBLAS DLLs are often missing on Windows); set WHISPER_DEVICE=cuda to use the GPU
dev = os.environ.get("WHISPER_DEVICE", "cpu")
model = WhisperModel(model_name, device=dev, compute_type="int8_float16" if dev == "cuda" else "int8")
segs, info = model.transcribe("audio.mp3", language=lang, word_timestamps=True, vad_filter=False, no_speech_threshold=0.9, log_prob_threshold=-1.5, initial_prompt="Song lyrics, Olivia Rodrigo and Chappell Roan, expectations. Fake job, passive, stipulations, unattractive.",
                              condition_on_previous_text=False, beam_size=5)
words = []
for s in segs:
    for w in s.words or []:
        words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)})
    print(f"{s.start:6.1f} {s.text}", flush=True)
json.dump({"duration": info.duration, "words": words}, open("words.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("done", len(words), "words")
