"""Pasa el logo TENARUZ de .ai a PNG listo para subir a MercadoLibre.

El .ai es un PDF por dentro, así que se rasteriza del vector: nada de escalar un bitmap.

El arte viene en una mesa de trabajo cuadrada de 425 pt con el logo —que es apaisado, casi
4:1— flotando en el medio y muchísimo aire arriba y abajo: la tinta ocupa el 3% del lienzo.
Subido tal cual, en la miniatura de MercadoLibre el logo se vería diminuto. Por eso se
recorta a la tinta y se recompone centrado en un cuadrado, ocupando el 90% del ancho.

Se rasteriza directo al tamaño final en vez de achicar un render grande: el trazo del logo
es fino y cada reescalado de más lo ensucia.
"""
import subprocess

import numpy as np
from PIL import Image

SRC = "logo_src.pdf"
LADO = 1200           # MercadoLibre pide imágenes cuadradas; 1200 es el tamaño con el que
                      # funciona el zoom sin que la foto se vea interpolada
OCUPACION = 0.90      # del ancho del cuadro
PAGINA_PT = 425.197


def render(alto_px, salida):
    subprocess.run(["pdftocairo", "-png", "-transp", "-singlefile",
                    "-scale-to", str(alto_px), SRC, salida], check=True)
    return Image.open(salida + ".png").convert("RGBA")


def caja_de_tinta(img):
    alfa = np.asarray(img)[..., 3]
    ys, xs = np.where(alfa > 8)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


# primero medimos la proporción tinta/página con un render de referencia
ref = render(2000, "logo_out/_ref")
x0, y0, x1, y1 = caja_de_tinta(ref)
proporcion = (x1 - x0) / ref.width          # ancho de la tinta respecto de la página

# y con eso rasterizamos a la escala en la que la tinta mide justo lo que queremos
objetivo = round(LADO * OCUPACION / proporcion)
alta = render(objetivo, "logo_out/_alta")
x0, y0, x1, y1 = caja_de_tinta(alta)
tinta = alta.crop((x0, y0, x1, y1))
print(f"página rasterizada a {objetivo} px; tinta {tinta.width} x {tinta.height} px")

# ── 1. el cuadrado con fondo blanco, que es el que va a MercadoLibre ──
ml = Image.new("RGB", (LADO, LADO), (255, 255, 255))
ml.paste(tinta, ((LADO - tinta.width) // 2, (LADO - tinta.height) // 2), tinta)
ml.save("logo_out/TENARUZ_ML_1200x1200.png", optimize=True)

# ── 2. el mismo cuadrado en JPG, por si prefiere subirlo así ──
ml.save("logo_out/TENARUZ_ML_1200x1200.jpg", quality=95, subsampling=0)

# ── 3. recorte al ras con transparencia, para todo lo demás ──
grande = render(round(2400 / proporcion), "logo_out/_grande")
x0, y0, x1, y1 = caja_de_tinta(grande)
grande.crop((x0, y0, x1, y1)).save("logo_out/TENARUZ_transparente.png", optimize=True)

for n, f in (("ML PNG", "logo_out/TENARUZ_ML_1200x1200.png"),
             ("ML JPG", "logo_out/TENARUZ_ML_1200x1200.jpg"),
             ("transparente", "logo_out/TENARUZ_transparente.png")):
    im = Image.open(f)
    import os
    print(f"{n:14} {im.size[0]} x {im.size[1]}  {im.mode}  {os.path.getsize(f)/1024:.0f} KB")
