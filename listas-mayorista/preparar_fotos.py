"""Recorta y normaliza las fotos nuevas para la sección 12 VOLTS.

Las fotos vienen con mucho aire alrededor; si se insertan tal cual, el producto
queda diminuto al lado de los que ya están en la lista. Se recorta al objeto —
contra el fondo real de cada imagen, no contra un umbral fijo de "casi blanco",
que le haría agujeros a los productos cromados— y se exporta en JPEG sobre blanco,
igual que las fotos del PDF original.
"""
import pathlib
import sys

from PIL import Image

BASE = pathlib.Path(__file__).parent
FOTOS = BASE / "fotos"
PPP = 300          # las fotos del original rondan los 200 ppi; se gana un poco
MARGEN = 0.02      # aire que se deja alrededor del recorte, en proporción


def recortar(im):
    """Devuelve la imagen recortada a la caja del producto."""
    if im.mode == "RGBA":
        alfa = im.getchannel("A")
        caja = alfa.point(lambda v: 255 if v > 8 else 0).getbbox()
        if caja and (caja[2] - caja[0]) < im.width * 0.99:
            return im.crop(caja)
        im = Image.alpha_composite(Image.new("RGBA", im.size, "white"), im)
    im = im.convert("RGB")
    # el fondo es el valor del borde: se compara contra eso y no contra el blanco
    borde = [im.getpixel(p) for p in
             [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]]
    fondo = tuple(sorted(c[i] for c in borde)[len(borde) // 2] for i in range(3))
    gris = Image.new("L", im.size)
    pix = im.load()
    out = gris.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = pix[x, y]
            d = abs(r - fondo[0]) + abs(g - fondo[1]) + abs(b - fondo[2])
            out[x, y] = 255 if d > 24 else 0
    caja = gris.getbbox()
    return im.crop(caja) if caja else im


def preparar(nombre, ancho_pt, alto_pt):
    """Recorta, ajusta a la caja en puntos y guarda el JPEG listo para incrustar."""
    im = recortar(Image.open(FOTOS / nombre))
    escala = min(ancho_pt / im.width, alto_pt / im.height)
    px = (max(1, round(im.width * escala * PPP / 72)),
          max(1, round(im.height * escala * PPP / 72)))
    im = im.convert("RGB").resize(px, Image.LANCZOS)
    salida = FOTOS / f"{pathlib.Path(nombre).stem}_lista.jpg"
    im.save(salida, "JPEG", quality=88, optimize=True, subsampling=0)
    return salida, round(im.width * 72 / PPP, 2), round(im.height * 72 / PPP, 2)


if __name__ == "__main__":
    for n in sys.argv[1:]:
        print(preparar(n, 52.0, 31.0))
