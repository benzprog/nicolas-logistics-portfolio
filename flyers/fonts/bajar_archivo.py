"""Baja Archivo de Google Fonts y la deja como estáticas listas para embeber.

Dos trampas que costaron un render:

1. **La API devuelve varias `@font-face` por peso**, una por rango unicode (vietnamita,
   latin-ext, latin...). Quedarse con la primera da un subset sin las minúsculas ni los
   acentos, y el navegador completa con una fuente del sistema sin avisar: en el PDF
   aparece LiberationSans al lado de Archivo. Hay que elegir el bloque cuyo rango arranca
   en `U+0000-00FF`, que es el latin y trae acentos, `·` y `¿`.
2. **Archivo se sirve variable** (eje wght 100-900). Se instancia a estáticas porque
   Chromium las exporta a PDF de forma más previsible.

    python3 bajar_archivo.py
"""
import re
import subprocess
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/131.0 Safari/537.36")
API = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap"
PESOS = {"Regular": 400, "Medium": 500, "SemiBold": 600, "Bold": 700}
# los caracteres que las piezas usan de verdad; si falta alguno, el render se va a otra fuente
PRUEBA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:·-@?¿áéíóúüñÁÉÍÓÚÑ"
# La flecha del botón (→, U+2192) queda fuera del rango latin. Si hace falta,
# dibujala en SVG: pedir otro subset sólo por ese glifo no vale la pena.


def css():
    r = subprocess.run(["curl", "-sS", "-m", "30", "-A", UA, API],
                       capture_output=True, text=True, check=True)
    return r.stdout


def fuente_latina(hoja):
    """La URL del bloque latin: es el que empieza en U+0000-00FF."""
    for bloque in hoja.split("@font-face")[1:]:
        rango = re.search(r"unicode-range:\s*([^;]+);", bloque)
        if rango and rango.group(1).strip().startswith("U+0000-00FF"):
            return re.search(r"src:\s*url\((https[^)]+)\)", bloque).group(1)
    raise SystemExit("no encontré el bloque latin en la respuesta de Google Fonts")


url = fuente_latina(css())
subprocess.run(["curl", "-sS", "-m", "40", "-A", UA, "-o", "/tmp/archivo_var.bin", url], check=True)

falta_alguno = False
for nombre, peso in PESOS.items():
    f = instancer.instantiateVariableFont(TTFont("/tmp/archivo_var.bin"), {"wght": peso},
                                          updateFontNames=True)
    f.flavor = None
    salida = f"Archivo-{nombre}.ttf"
    f.save(salida)
    faltan = sorted({c for c in PRUEBA if ord(c) not in TTFont(salida).getBestCmap()})
    falta_alguno |= bool(faltan)
    print(f"{salida}: peso {TTFont(salida)['OS/2'].usWeightClass}, "
          f"{len(TTFont(salida).getBestCmap())} glifos"
          + (f"  ¡FALTAN {faltan}!" if faltan else ""))

sys.exit(1 if falta_alguno else 0)
