"""Arma las fotos que van a las fichas AR111 y AR70.

Las dos fotos estaban cruzadas: la lámpara blanca y ancha es la AR111 (Ø111 mm) y la
plateada es la AR70 (Ø70 mm). La plateada ya viene en 3000K y 4000K, así que se usa tal
cual para la AR70. De la blanca hay una sola toma y sin halo, con la lámpara ocupando todo
el cuadro, así que hay que recomponerla en el mismo formato que usa la ficha AR111.

El halo se replica del original en vez de inventarlo. Midiendo el realce de luminancia por
distancia al contorno de la lámpara plateada da una caída exponencial de constante ~35 px:
+13 pegado al contorno en el 3000K y +23 en el 4000K, con dominante cálida y neutra fría
respectivamente. Se reconstruye con esa fórmula sobre la transformada de distancia.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from recorte_fondo import silueta  # noqa: E402

# Cada ficha tiene su propio formato de foto, y hay que respetarlo: el hueco del PDF está
# en puntos, así que una imagen con otra proporción sale estirada.
#   AR111: dos fotos de 577x621 (una por temperatura), lámpara al 57% del cuadro, fondo 26
#   AR70:  una sola foto de 598x555, más grande en la página, fondo 30 como el panel
FORMATOS = {
    "ar111": dict(lienzo=(577, 621), centro=(288, 310), alto=353, fondo=26.0, umbral=14),
    "ar70": dict(lienzo=(598, 555), centro=(299, 277), alto=430, fondo=30.0, umbral=45),
}

# medidos sobre las fotos originales: (tinte normalizado, realce pegado al contorno)
HALO = {
    "3000K": (np.array([1.00, 0.52, 0.12]), 30.0),
    "4000K": (np.array([0.92, 0.96, 1.00]), 50.0),
}
TAU = 55.0                 # px de caída del halo hacia afuera
# La AR111 llena mucho más el cuadro que la plateada, así que queda menos fondo donde se
# vea el halo y a tamaño de página las dos temperaturas se confundían: se sube el realce y
# se ensancha la caída. Además la luz rebota en el cuerpo de la lámpara, y ese rebote no es
# parejo — se concentra en el borde y se apaga hacia adentro, así que se calcula con la
# distancia hacia el interior de la silueta. Plano quedaba como un filtro de color encima.
SOBRE_LAMPARA = 0.55
TAU_INTERIOR = 22.0        # px de caída del rebote hacia adentro


def recortar(f, umbral):
    """La foto de origen plateada ya trae halo: con umbral alto sale sólo la lámpara."""
    a = np.asarray(Image.open(f).convert("RGB")).astype(float)
    al = ndimage.gaussian_filter(silueta(a, umbral=umbral).astype(float), 1.0)
    return a, al


def componer(foto, tinte, formato):
    W, H = formato["lienzo"]
    CENTRO, ALTO_LAMPARA = formato["centro"], formato["alto"]
    FONDO = np.full(3, formato["fondo"])
    a, al = recortar(foto, formato["umbral"])
    # la silueta manda: la lámpara se escala por su alto real, no por el del archivo
    ys = np.where(al.max(axis=1) > 0.5)[0]
    xs = np.where(al.max(axis=0) > 0.5)[0]
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    al = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    escala = ALTO_LAMPARA / a.shape[0]
    nw, nh = int(round(a.shape[1] * escala)), ALTO_LAMPARA
    rgb = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((nw, nh), Image.LANCZOS)).astype(float)
    alf = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)).astype(float) / 255

    x0, y0 = CENTRO[0] - nw // 2, CENTRO[1] - nh // 2
    mascara = np.zeros((H, W))
    mascara[y0:y0 + nh, x0:x0 + nw] = alf

    dist = ndimage.distance_transform_edt(mascara < 0.5)
    color, pico = HALO[tinte]
    capa = pico * np.exp(-dist / TAU)
    lienzo = FONDO + capa[..., None] * color

    trozo = lienzo[y0:y0 + nh, x0:x0 + nw]
    lienzo[y0:y0 + nh, x0:x0 + nw] = rgb * alf[..., None] + trozo * (1 - alf[..., None])
    # el rebote de la luz sobre el cuerpo, concentrado en el borde
    adentro = ndimage.distance_transform_edt(mascara > 0.5)
    rebote = mascara * pico * SOBRE_LAMPARA * np.exp(-adentro / TAU_INTERIOR)
    lienzo += rebote[..., None] * color
    return Image.fromarray(np.clip(lienzo, 0, 255).astype(np.uint8), "RGB")


if __name__ == "__main__":
    # la lámpara blanca (la AR111 de verdad) va a las dos temperaturas de la ficha AR111
    for t in ("3000K", "4000K"):
        im = componer("src_p5Im12.png", t, FORMATOS["ar111"])
        im.save(f"ar111_{t}.png")
        print(f"ar111_{t}.png  {im.size}")
    # la plateada (la AR70) va a la única foto de la ficha AR70
    im = componer("src_p6Im55.png", "3000K", FORMATOS["ar70"])
    im.save("ar70_3000K.png")
    print(f"ar70_3000K.png  {im.size}")
