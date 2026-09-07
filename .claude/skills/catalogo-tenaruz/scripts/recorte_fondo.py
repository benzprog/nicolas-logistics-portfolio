"""Saca el fondo negro de una foto de producto y la deja sobre el crema del catálogo.

El fondo es un negro plano (#1e1e1e), así que se separa por diferencia contra ese valor.
Dos cuidados que hacen la diferencia:

- **El umbral tiene que ser alto.** El JPEG deja anillos alrededor del contorno; con un
  umbral bajo esos píxeles de fondo entran en la silueta y quedan como dientes negros.
- **La silueta se lima con morfología de disco**, no de cuadrado: un cuadrado deja escalones.
  El radio lo limita la parte más fina de la foto (el cable del spot de 12V, ~7 px), así que
  la apertura va con radio 2.

El producto es macizo: rellenando huecos se recuperan las zonas que coinciden con el fondo,
que es lo que permite recortar un spot negro sobre negro.

La recomposición no promedia nada. Si lo observado es
    obs = producto*a + fondo*(1-a)
sobre el crema queda
    sal = producto*a + crema*(1-a) = obs + (crema - fondo)*(1-a)
que respeta el antialias del borde sin dejar orla oscura.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

FONDO = np.array([30.0, 30.0, 30.0])      # #1e1e1e
CREMA = np.array([241.0, 237.0, 232.0])   # #f1ede8


def disco(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r + 0.5


def silueta(a, umbral=14.0, minimo=0.004, lima=2):
    d = np.abs(a - FONDO).max(axis=2)
    m = ndimage.binary_fill_holes(d > umbral)
    m = ndimage.binary_opening(m, disco(1))
    lab, n = ndimage.label(m)
    if n:
        tam = ndimage.sum(m, lab, range(1, n + 1))
        m = np.isin(lab, [i + 1 for i, t in enumerate(tam) if t > minimo * m.size])
    m = ndimage.binary_closing(m, disco(lima + 1))   # cierra los dientes hacia adentro
    m = ndimage.binary_opening(m, disco(lima))       # y los lima hacia afuera
    return ndimage.binary_fill_holes(m)


def sobre_crema(pil, umbral=14.0, minimo=0.004, lima=2, suave=1.0):
    a = np.asarray(pil.convert("RGB")).astype(float)
    al = ndimage.gaussian_filter(silueta(a, umbral, minimo, lima).astype(float), suave)[..., None]
    sal = a + (CREMA - FONDO) * (1.0 - al)
    return Image.fromarray(np.clip(sal, 0, 255).astype(np.uint8), "RGB"), al[..., 0]
