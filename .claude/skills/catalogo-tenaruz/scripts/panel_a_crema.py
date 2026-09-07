"""Pasa los paneles negros de ARTEFACTOS a crema, dejando la foto sobre una placa negra.

En la sección ARTEFACTOS convivían paneles crema y paneles negros. Acá se unifican en
crema. Las fotos de estas fichas están tomadas sobre negro, así que en vez de tirarlas
sobre el crema se conserva su fondo: el contenido del panel (logo, fotos y códigos) queda
dentro de una placa negra centrada, con margen crema alrededor.

No se rehace nada del contenido. La página original se dibuja como Form XObject; encima
va el crema tapando el panel, y después se vuelve a dibujar el original recortado a la
placa. Tipografía, fotos y códigos quedan exactamente como estaban.
"""
import pikepdf
from pikepdf import Dictionary, Name, Stream

W = "."
SRC = f"{W}/CATALOGO.pdf"
OUT = f"{W}/CATALOGO_BEIGE.pdf"

CREMA = (241 / 255, 237 / 255, 232 / 255)
MARGEN = 24.0        # borde crema alrededor de la placa negra

# (índice 0-based, [paneles de producto a convertir])
PANELES = {
    11: [(0.0, 0.0, 306.0, 396.0)],                     # pág 12 · SPOT MÓVIL EMBUTIR
    12: [(306.0, 396.0, 306.0, 396.0),                  # pág 13 · SPOT 12V MÓVIL
         (0.0, 0.0, 306.0, 396.0)],                     # pág 13 · SPOT MINI EMBUTIR
}

pdf = pikepdf.open(SRC)

for idx, paneles in PANELES.items():
    pagina = pdf.pages[idx]
    form = pdf.make_indirect(pikepdf.Page(pagina).as_form_xobject())

    frag = ["q /Orig Do Q"]                             # la página tal cual
    for x, y, w, h in paneles:
        crema = " ".join(f"{v:.6f}" for v in CREMA)
        frag.append(f"q {crema} rg {x} {y} {w} {h} re f Q")
        cx, cy = x + MARGEN, y + MARGEN
        cw, ch = w - 2 * MARGEN, h - 2 * MARGEN
        frag.append(f"q {cx} {cy} {cw} {ch} re W n /Orig Do Q")
        print(f"pág {idx + 1}: panel ({x:.0f},{y:.0f}) -> crema, "
              f"placa {cw:.0f} x {ch:.0f} pt en ({cx:.0f},{cy:.0f})")

    nueva = pdf.make_indirect(Dictionary(
        Type=Name.Page, MediaBox=[0, 0, 612, 792],
        Resources=Dictionary(XObject=Dictionary(Orig=form)),
        Contents=Stream(pdf, ("\n".join(frag) + "\n").encode("latin-1")),
    ))
    pdf.pages[idx] = pikepdf.Page(nueva)

pdf.save(OUT)
print("guardado", OUT)
