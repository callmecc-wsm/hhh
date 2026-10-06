#!/usr/bin/env python3
"""Restyle dark course figures to light theme WITHOUT redesigning.

Preserves every pixel of information (labels, numbers, arrows, caveats)
by alpha-aware recomposition against a light canvas.

Usage:
  /tmp/figvenv/bin/python scripts/restyle-figures-light.py \
      --src /workspace/hhh-redesign-shots/figures-old-master \
      --dst model-academy/public/course/figures
"""
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image
import numpy as np

BG_LIGHT = (247, 248, 250)

def dark_to_light(im: Image.Image, bg_light=BG_LIGHT) -> Image.Image:
    rgb = np.asarray(im.convert('RGB')).astype(np.float64)
    h, w, _ = rgb.shape
    corners = np.concatenate([
        rgb[:48, :48].reshape(-1, 3),
        rgb[:48, -48:].reshape(-1, 3),
        rgb[-48:, :48].reshape(-1, 3),
        rgb[-48:, -48:].reshape(-1, 3),
    ], 0)
    B = corners.mean(axis=0)
    diff = rgb - B
    dist = np.linalg.norm(diff, axis=-1)
    alpha = np.clip((dist - 5) / 26.0, 0, 1)
    a = alpha[..., None]
    F = np.where(a > 0.02, B + diff / np.maximum(a, 0.02), B)

    Fr, Fg, Fb = F[:,:,0], F[:,:,1], F[:,:,2]
    mx = np.maximum(np.maximum(Fr, Fg), Fb)
    mn = np.minimum(np.minimum(Fr, Fg), Fb)
    chroma = mx - mn
    lum = 0.2126*Fr + 0.7152*Fg + 0.0722*Fb
    Fp = F.copy()
    # Treat pale blue-white text and muted blue-gray caveats as ink.
    # Low-luminance warm fills stay colored so table highlights remain pale.
    ach = (chroma < 22) | ((chroma < 65) & ((lum > 90) | (Fb > Fr)))

    light_text = ach & (lum > 150)
    t = np.clip((lum[light_text] - 150) / 105.0, 0, 1)
    v = 55 - t * 30
    Fp[light_text, 0] = v
    Fp[light_text, 1] = v + 2
    Fp[light_text, 2] = v + 4

    mid = ach & (lum <= 150) & (lum > 55)
    t = (lum[mid] - 55) / 95.0
    v = 80 - t * 25  # Darker caveats: 80 to 55
    Fp[mid, 0] = v
    Fp[mid, 1] = v + 3
    Fp[mid, 2] = v + 6

    dark_a = ach & (lum <= 55)
    # Pale panels preserve contrast with the darkened text.
    Fp[dark_a] = np.clip(220 + Fp[dark_a] * 0.15, 215, 235)
    # Very muted labels (e.g. inactive experts) must remain visible.
    muted_ink = dark_a & (lum > 40)
    Fp[muted_ink] = (100, 105, 112)

    chrom = ~ach
    dark_c = chrom & (lum < 90)
    Fp[dark_c] = np.clip(F[dark_c] * 0.25 + 185, 0, 255)
    bright_c = chrom & (lum >= 90)
    Fp[bright_c] = np.clip(F[bright_c] * 0.60, 0, 255)

    BL = np.array(bg_light, dtype=np.float64)
    out = a * Fp + (1 - a) * BL
    out = np.clip(out, 0, 255).astype(np.uint8)
    out[alpha < 0.035] = np.array(bg_light, dtype=np.uint8)
    return Image.fromarray(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', type=Path, required=True)
    ap.add_argument('--dst', type=Path, required=True)
    args = ap.parse_args()
    args.dst.mkdir(parents=True, exist_ok=True)
    files = sorted(args.src.glob('*.webp'))
    assert len(files) == 72, f'expected 72, got {len(files)}'
    for p in files:
        out = dark_to_light(Image.open(p))
        dest = args.dst / p.name
        out.save(dest, 'WEBP', quality=92, method=6)
        print('wrote', dest.name, flush=True)
    print('DONE', len(files), flush=True)

if __name__ == '__main__':
    main()
