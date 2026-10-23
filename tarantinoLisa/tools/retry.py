"""Re-transcribe selected clips: python tools/retry.py lang start end [prompt] -> prints word timings"""
import sys, os
from faster_whisper import WhisperModel
lang, a, b = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
prompt = sys.argv[4] if len(sys.argv) > 4 else None
m = WhisperModel("large-v3", device="cpu", compute_type="int8")
segs, _ = m.transcribe("audio.mp3", language=lang, word_timestamps=True, vad_filter=True, clip_timestamps=[a, b],
                       initial_prompt=prompt, condition_on_previous_text=False, beam_size=5, no_speech_threshold=0.95)
for s in segs:
    print(f"{s.start:6.2f}-{s.end:6.2f} {s.text}")
    print("   ", " ".join(f"{w.word.strip()}@{w.start:.2f}" for w in s.words))
