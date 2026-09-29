"""Saca de `lamparas.pdf` la mejor foto de cada producto de la oferta.

El PDF trae siete imágenes: algunas son del producto, otras son cajas cerradas o pallets
envueltos. Acá se elige una por producto y se recorta.

Ninguna se recorta contra el fondo: son fotos de depósito, con manos, pallets y plástico de
embalaje. Sacarles el fondo deja restos grises peor que la foto entera, así que van como
recuadro, las cuatro igual, que además es más coherente entre sí.

Illustrator las guardó en CMYK, así que hay que convertirlas antes de tocarlas.
"""
import pathlib
import sys

import numpy as np
import pdfplumber
import pikepdf
from pikepdf import PdfImage
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1] if len(sys.argv) > 1 else "lamparas.pdf"
SALIDA = pathlib.Path(__file__).parent / "fotos"

# imagen del PDF -> (archivo, recorte en fracción del alto/ancho, si hay fondo que sacar)
ELEGIDAS = {
    "Im3": ("pll_2g11.png", (.03, .01, .98, .99), False),   # la lámpara entera con su caja
    "Im6": ("dicroica_gu10.png", (.02, .02, .98, .98), False),   # el blíster
    "Im4": ("sodio_70w.png", (.27, .16, .56, .80), False),       # sólo la lámpara, sin la caja
    "Im5": ("halogenuros_400w.png", (.02, .27, .98, .60), False),  # la etiqueta del bulto
}


def sacar_fondo(pil):
    """Deja transparente el fondo conectado al borde, con el color del marco de referencia."""
    a = np.asarray(pil.convert("RGB")).astype(int)
    marco = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    ref = np.median(marco, axis=0)
    if ref.min() < 150:
        return pil.convert("RGB")
    claro = np.abs(a - ref).max(axis=2) <= 26
    etiq, _ = ndimage.label(claro)
    borde = {*etiq[0], *etiq[-1], *etiq[:, 0], *etiq[:, -1]} - {0}
    exterior = np.isin(etiq, list(borde))
    ys, xs = np.where(~exterior)
    if len(ys):
        a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        exterior = exterior[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    alfa = 1 - ndimage.gaussian_filter(exterior.astype(float), 0.8)
    return Image.fromarray(np.dstack([a, alfa * 255]).astype(np.uint8), "RGBA")


SALIDA.mkdir(parents=True, exist_ok=True)
pdf = pikepdf.open(SRC)
xo = pdf.pages[0].obj["/Resources"]["/XObject"]
with pdfplumber.open(SRC) as d:
    nombres = {im["name"] for im in d.pages[0].images}

for clave, (archivo, caja, quitar) in ELEGIDAS.items():
    assert clave in nombres, f"{clave} no está en el PDF"
    pil = PdfImage(xo[pikepdf.Name("/" + clave)]).as_pil_image().convert("RGB")
    if caja:
        w, h = pil.size
        pil = pil.crop((int(caja[0] * w), int(caja[1] * h), int(caja[2] * w), int(caja[3] * h)))
    pil = sacar_fondo(pil) if quitar else pil
    if pil.width > 900:
        pil = pil.resize((900, round(pil.height * 900 / pil.width)), Image.LANCZOS)
    pil.save(SALIDA / archivo)
    print(f"{clave} -> {archivo}  {pil.size}  {pil.mode}")
