"""Compara una página editada contra el original midiendo cajas de tinta a 200 dpi.

La verificación que realmente cierra el tema son las cadenas idénticas: palabras que
aparecen en las dos versiones (Potencia, Medidas, CRI, las líneas de la tabla). Si esas no
caen exactamente en el mismo lugar y con el mismo ancho, la tipografía no coincide.

    python3 verify_page.py original.pdf editado.pdf --page 5
    python3 verify_page.py original.pdf editado.pdf --page 5 --half bottom
"""
import argparse
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

DPI = 200
SCALE = DPI / 72.0

# Regiones del slot inferior, en píxeles del recorte de la mitad inferior a 200 dpi.
# (x0, x1, y0, y1, fondo_oscuro)
REGIONS_BOTTOM = {
    "título":            (940, 1400, 95, 160, False),
    "subtítulo":         (940, 1400, 170, 205, False),
    "barra de acento":   (940, 1400, 220, 242, False),
    "descripción l1":    (940, 1650, 258, 298, False),
    "fila 1 etiqueta":   (940, 1200, 356, 394, False),
    "fila 1 valor":      (1450, 1620, 356, 394, False),
    "fila 10 etiqueta":  (940, 1200, 718, 753, False),
    "línea fila 1":      (940, 1620, 392, 399, False),
    "línea fila 10":     (940, 1620, 752, 759, False),
    "código":            (940, 1400, 792, 826, False),
    "subcódigo":         (940, 1400, 828, 872, False),
    "pie":               (940, 1500, 996, 1030, False),
    "epígrafe foto":     (150, 760, 838, 862, True),
}


def render(pdf, page, out_dir, tag):
    subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(DPI),
                    "-png", pdf, str(Path(out_dir) / tag)], check=True)
    hits = sorted(Path(out_dir).glob(f"{tag}-*.png"))
    return Image.open(hits[0])


def bbox(arr, x0, x1, y0, y1, dark_bg):
    r = arr[y0:y1, x0:x1]
    ys, xs = np.where(r > 60) if dark_bg else np.where(r < 245)
    if len(xs) == 0:
        return None
    return (int(x0 + xs.min()), int(y0 + ys.min()), int(x0 + xs.max()), int(y0 + ys.max()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("original")
    ap.add_argument("edited")
    ap.add_argument("--page", type=int, required=True)
    ap.add_argument("--half", choices=["bottom", "top"], default="bottom")
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        a_img = render(args.original, args.page, tmp, "orig")
        b_img = render(args.edited, args.page, tmp, "edit")
        w, h = a_img.size
        box = (0, h // 2, w, h) if args.half == "bottom" else (0, 0, w, h // 2)
        a = np.array(a_img.crop(box).convert("L")).astype(int)
        b = np.array(b_img.crop(box).convert("L")).astype(int)

    print(f"Página {args.page}, mitad {args.half} — original vs editado\n")
    print(f"{'elemento':20} {'original':>24} {'editado':>24}   estado")
    for name, (x0, x1, y0, y1, dark) in REGIONS_BOTTOM.items():
        ba, bb = bbox(a, x0, x1, y0, y1, dark), bbox(b, x0, x1, y0, y1, dark)
        if ba is None or bb is None:
            print(f"{name:20} {'sin tinta' if ba is None else 'ok':>24} "
                  f"{'sin tinta' if bb is None else 'ok':>24}   REVISAR")
            continue
        fa = f"x{ba[0]}..{ba[2]} y{ba[1]}..{ba[3]}"
        fb = f"x{bb[0]}..{bb[2]} y{bb[1]}..{bb[3]}"
        same = ba == bb
        near = all(abs(bb[i] - ba[i]) <= 2 for i in range(4))
        state = "idéntico" if same else ("≈" if near else "DIFIERE")
        print(f"{name:20} {fa:>24} {fb:>24}   {state}")

    print("\nLas diferencias solo son legítimas donde el texto cambió (una Ó con tilde sube "
          "unos px, un texto centrado o alineado a la derecha arranca en otra x).")
    print("Las etiquetas y líneas de la tabla que se repiten en ambas versiones deberían "
          "dar 'idéntico'.")


if __name__ == "__main__":
    main()
