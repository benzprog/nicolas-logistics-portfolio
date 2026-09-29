"""Reemplaza fotos del proveedor por las de mejor calidad que pasó el cliente.

El destino se identifica por el archivo que `extraer_tdc.py` generó para ese producto, no
por el número de ítem: una misma foto sirve a varias variantes (color, temperatura), así que
reemplazándola se actualizan todas juntas, que es lo que corresponde.

Las que vienen sobre fondo claro se recortan con alfa, igual que el resto. La del artefacto
encendido viene sobre fondo oscuro —y ese fondo es el efecto de la luz, no un fondo que se
pueda sacar— así que se recorta ajustada y se deja opaca.
"""
import pathlib
import sys

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from extraer_tdc import recortar  # noqa: E402

IMG = pathlib.Path("/tmp/claude-0/-home-user-nicolas-logistics-portfolio/"
                   "66a49b79-0302-5de9-8277-30d625b04b95/images")
FOTOS = pathlib.Path("fotos_tdc")

CAMBIOS = [
    ("5.webp", "p5_250.png", True,
     "56 a 56E · aplique lectura / spot móvil (la actual es la variante blanca)"),
    ("6.webp", "p6_373.png", True, "82E y 82F · LED cortesía 0,5W 93*34mm cromado"),
    ("7.webp", "p6_276.png", False, "79 a 82 · LED navegación / cortesía 1,2W"),
    ("8.webp", "p6_123.png", True, "72A · navegación bicolor inox 76*33"),
    ("9.webp", "p6_516.png", True, "S02 y S02B · sumergible inox 316 18W 93*30"),
]


def ajustar(pil, claro):
    if claro:
        return recortar(pil)
    # fondo oscuro: se recorta a la zona con luz para que el tile no sea casi todo negro
    import numpy as np
    a = np.asarray(pil.convert("RGB")).astype(int)
    luz = a.max(axis=2) > 90
    ys, xs = np.where(luz)
    m = 12
    caja = (max(0, xs.min() - m), max(0, ys.min() - m),
            min(a.shape[1], xs.max() + m), min(a.shape[0], ys.max() + m))
    return pil.convert("RGB").crop(caja)


if __name__ == "__main__":
    for origen, destino, claro, que in CAMBIOS:
        pil = Image.open(IMG / origen)
        antes = Image.open(FOTOS / destino).size
        nueva = ajustar(pil, claro)
        nueva.save(FOTOS / destino)
        print(f"{destino:14} {antes[0]}x{antes[1]} -> {nueva.size[0]}x{nueva.size[1]}   {que}")
