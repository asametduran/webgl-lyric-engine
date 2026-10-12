"""assets/*.jpg (Wikimedia Commons plates) -> archive/frames/<set>_NN.png (cropped Muybridge frames, grayscale) + archive/plates/*.jpg (industrial,
grayscale, hot steel tinted caution yellow) + archive/manifest.json. Usage: python tools/prep_archive.py"""
import json, os
import numpy as np
from PIL import Image, ImageOps

A, OUT = "assets", "archive"
os.makedirs(f"{OUT}/frames", exist_ok=True); os.makedirs(f"{OUT}/plates", exist_ok=True)
YELLOW = np.array([255, 196, 0], dtype=np.float32)
INK = np.array([11, 11, 12], dtype=np.float32); BONE = np.array([237, 232, 220], dtype=np.float32)
def tone(g):  # g: HxW uint8-like -> HxWx3 float in INK..BONE
    g = np.asarray(g).astype(np.float32)[..., None] / 255.0
    return INK + (BONE - INK) * g


def gray_contrast(im, cut=1.5, gamma=1.0):
    g = ImageOps.autocontrast(im.convert("L"), cutoff=cut)
    if gamma != 1.0: g = Image.eval(g, lambda v: int(255 * (v / 255) ** gamma))
    return g

def row(x0, step, w, y, h, n): return [(round(x0 + i * step), y, w, h) for i in range(n)]

SETS = {
  "run":    ("leap_run_hi.jpg", [(560,438,172,206),(810,438,166,206),(1037,438,166,206),(1263,438,168,206),(560,662,170,206),(797,662,170,206),
                              (1033,662,170,206),(1265,662,168,206),(771,885,170,206),(1060,885,170,206)]),
  "hurdle": ("leap_high_hi.jpg", [(640,430,205,200),(928,430,205,200),(1220,430,205,200),(635,655,205,200),(928,655,205,200),(1217,655,205,200),
                               (635,880,205,200),(928,878,205,200),(1217,878,205,200)]),
  "jump":   ("man_run_hi.jpg", row(282, 113.2, 106, 530, 160, 12)),
  "jump2":  ("man_run_hi.jpg", row(282, 113.2, 106, 710, 160, 12)),
  "horse":  ("horse_hi.jpg", [(388,425,130,262),(518,425,128,262),(647,425,125,262),(776,425,143,262),(923,425,143,262),(1070,425,150,262),(1226,425,150,262),(1383,425,153,262)]),
  "horse2": ("horse_hi.jpg", [(388,713,130,255),(518,713,128,255),(647,713,125,255),(776,713,143,255),(923,713,143,255),(1070,713,150,255),(1226,713,150,255),(1383,713,153,255)]),
}
manifest = {"sets": {}, "plates": {}}
for name, (src, rects) in SETS.items():
    im = Image.open(f"{A}/{src}").convert("RGB")
    sc = im.width / 1920            # crop rects below are in 1920px-wide plate coordinates
    sizes = []
    for i, (x, y, w, h) in enumerate(rects):
        f = gray_contrast(im.crop((round(x * sc), round(y * sc), round((x + w) * sc), round((y + h) * sc))), 1.0)
        f = f.resize((round(f.width * 560 / f.height), 560), Image.LANCZOS)
        Image.fromarray(tone(f).astype(np.uint8)).save(f"{OUT}/frames/{name}_{i:02d}.png"); sizes.append([f.width, f.height])
    manifest["sets"][name] = {"n": len(rects), "size": sizes}

def plate(name, src, hot=False, w=1600):
    im = Image.open(f"{A}/{src}").convert("RGB"); im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    g = np.asarray(gray_contrast(im, 0.8, 1.15)).astype(np.float32)[..., None]
    out = tone(g[..., 0])
    if hot:   # glowing steel -> caution yellow (dark-to-bright mapped through yellow)
        r, gg, b = a[..., 0], a[..., 1], a[..., 2]
        m = np.clip(((r - b) - 70) / 80, 0, 1) * np.clip((r - 150) / 60, 0, 1)
        out = out * (1 - m[..., None]) + (YELLOW * (0.6 + 0.4 * (g / 255))) * m[..., None]
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f"{OUT}/plates/{name}.jpg", quality=90)
    manifest["plates"][name] = [w, round(im.height)]

plate("hammer_santafe", "hammer_santafe.jpg", hot=True)
plate("hammer_full", "hammer_full.jpg")
plate("billet", "billet.jpg")
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=1)
print({k: v["n"] for k, v in manifest["sets"].items()}, list(manifest["plates"]))
