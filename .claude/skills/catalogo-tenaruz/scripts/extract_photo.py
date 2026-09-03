"""Extrae la foto de producto del PDF de diseño del packaging.

Dos cosas que siempre salen mal si se hacen de memoria:

1. Las fotos vienen en JPEG CMYK con marcador Adobe, así que hay que invertir los canales
   al convertir a RGB; si no, se ven con los colores dados vuelta.
2. La transparencia viene como una imagen aparte en escala de grises (SMask), que
   pdfimages guarda como archivo separado del mismo tamaño.

    python3 extract_photo.py TZSPOT_design.pdf --out producto.png
    python3 extract_photo.py TZSPOT_design.pdf --list
"""
import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops


def extract(pdf, workdir):
    subprocess.run(["pdfimages", "-all", pdf, str(Path(workdir) / "img")], check=True)
    return sorted(Path(workdir).glob("img-*"))


def to_rgb(path):
    im = Image.open(path)
    if im.mode == "CMYK" and im.info.get("adobe"):
        return ImageChops.invert(im.convert("CMYK")).convert("RGB")
    return im.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--out", default="producto.png")
    ap.add_argument("--list", action="store_true",
                    help="lista las imágenes con tamaño y modo, y guarda un contact sheet")
    ap.add_argument("--index", type=int,
                    help="índice de la imagen a usar (según --list)")
    ap.add_argument("--mask-index", type=int,
                    help="índice de la máscara en escala de grises que le corresponde")
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        files = extract(args.pdf, tmp)
        if args.list:
            sheet, thumbs = None, []
            for i, f in enumerate(files):
                im = Image.open(f)
                print(f"[{i:2d}] {f.name:16} {im.size[0]}x{im.size[1]:<5} {im.mode}")
                t = to_rgb(f)
                t.thumbnail((140, 140))
                thumbs.append(t)
            cols = 6
            rows = (len(thumbs) + cols - 1) // cols
            sheet = Image.new("RGB", (cols * 150, rows * 150), "white")
            for i, t in enumerate(thumbs):
                sheet.paste(t, ((i % cols) * 150, (i // cols) * 150))
            sheet.save("contact_sheet.png")
            print("\nContact sheet en contact_sheet.png — elegí el índice y volvé a correr "
                  "con --index (y --mask-index si hace falta recortar el fondo).")
            return

        if args.index is None:
            raise SystemExit("Indicá --index (usá --list para verlos).")

        rgb = to_rgb(files[args.index])
        if args.mask_index is not None:
            mask = Image.open(files[args.mask_index]).convert("L")
            if mask.size != rgb.size:
                mask = mask.resize(rgb.size)
            out = rgb.convert("RGBA")
            out.putalpha(mask)
        else:
            out = rgb
        out.save(args.out)
        print(f"guardado {args.out} ({out.size[0]}x{out.size[1]}, {out.mode})")


if __name__ == "__main__":
    main()
