"""Agranda las portadillas de sección para que el texto sea acorde a la página.

Las tres portadillas tenían un bloque chico flotando en una página entera. Se reescalan
con un mismo factor (así los tres títulos quedan del mismo tamaño), manteniendo el margen
izquierdo del catálogo y centrando el bloque en vertical.

No se rehace el contenido: se dibuja la página original como Form XObject con una matriz
de escala, así tipografía y espaciados crecen en proporción exacta.
"""
import sys

import pikepdf
from pikepdf import Dictionary, Name, Stream

sys.path.insert(0, "/home/user/nicolas-logistics-portfolio/.claude/skills/catalogo-tenaruz/scripts")
from catalog import Catalog  # noqa: E402

W = "."   # ajustá a la carpeta de trabajo
SRC = f"{W}/output/CATALOGO_TENARUZ_2026_REFLOW.pdf"
OUT = f"{W}/output/CATALOGO_TENARUZ_2026_PORTADILLAS.pdf"

K = 1.9                      # mismo factor en las tres, para que los títulos coincidan
LEFT = 68.0                  # margen izquierdo del catálogo
TAB = (581.04, 1.8, 30.6, 30.6)

# (índice 0-based, número de página, bbox del contenido medido a 200 dpi)
PORTADILLAS = [
    (2, "3", (68.0, 239.8, 267.1, 571.0)),     # LÁMPARAS Y TUBOS LED
    (10, "11", (68.0, 277.9, 280.1, 505.1)),   # ARTEFACTOS
    (16, "17", (68.0, 316.4, 257.4, 481.0)),   # FUENTES SWITCHING
]

cat = Catalog(SRC)
pdf = cat.pdf

for idx, numero, (x0, y0, x1, y1) in PORTADILLAS:
    form = pdf.make_indirect(pikepdf.Page(pdf.pages[idx]).as_form_xobject())
    alto = (y1 - y0) * K
    tx = LEFT - K * x0
    ty = (792 - alto) / 2 - K * y0

    frag = [cat.rect(0, 0, 612, 792, cat.CREAM),
            # se recorta la zona de contenido: así el recuadro de numeración escalado,
            # que se iría fuera de página, no puede colarse
            f"q 30 30 552 732 re W n {K} 0 0 {K} {tx:.3f} {ty:.3f} cm /Src Do Q",
            cat.rect(*TAB, cat.TITLE),
            cat.show_center(numero, "/F11", 6.34, 596.5, 14.61, 0.0, cat.WHITE)]

    nueva = pdf.make_indirect(Dictionary(
        Type=Name.Page, MediaBox=[0, 0, 612, 792],
        Resources=Dictionary(Font=pdf.pages[3]["/Resources"]["/Font"],
                             XObject=Dictionary(Src=form)),
        Contents=Stream(pdf, ("q\n" + "\n".join(frag) + "\nQ\n").encode("latin-1")),
    ))
    pdf.pages[idx] = pikepdf.Page(nueva)
    print(f"portadilla pág {numero}: bloque {(x1-x0)*K:.0f} x {alto:.0f} pt, "
          f"márgenes vertical {(792-alto)/2:.0f} pt")

cat.save(OUT)
print("guardado", OUT)
