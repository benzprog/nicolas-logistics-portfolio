"""Pasa a crema los paneles negros de ARTEFACTOS, con las fotos recortadas del fondo.

No se dibuja ninguna placa: el panel queda crema y el producto va recortado encima, como
en el resto de la sección. Para eso hay que tocar tres cosas dentro de cada Form XObject:

  1. el relleno del panel               #1e1e1e -> #f1ede8
  2. el gris de los códigos de la foto  #c9c9c9 -> #6d6d6d   (el que usan los paneles crema)
  3. el logo TENARUZ                    versión blanca -> versión oscura

y reemplazar cada foto por su versión recortada sobre crema (`recorte.py`).

S15 lo comparten las páginas 13 y 14, así que la 13 se lleva una copia propia: si se
editara en el lugar, cambiaría también la ficha del reflector.
"""
import io
import sys

import pikepdf
from pikepdf import Name, PdfImage, Stream
from PIL import Image

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from recorte_fondo import CREMA, sobre_crema  # noqa: E402

W = "."
SRC, OUT = f"{W}/CATALOGO.pdf", f"{W}/CATALOGO_CREMA.pdf"

# (viejo, nuevo) con las dos escrituras que usa el documento: 9 y 6 decimales
COLORES = [
    ("0.117647058 0.117647058 0.117647058", "0.945098039 0.929411764 0.909803921"),
    ("0.117647 0.117647 0.117647", "0.945098 0.929412 0.909804"),
    ("0.788235294 0.788235294 0.788235294", "0.427450980 0.427450980 0.427450980"),
    ("0.788235 0.788235 0.788235", "0.427451 0.427451 0.427451"),
]

pdf = pikepdf.open(SRC)


def jpeg(pil, calidad=95):
    buf = io.BytesIO()
    pil.save(buf, "JPEG", quality=calidad, subsampling=0)
    im = Stream(pdf, buf.getvalue())
    im.Type, im.Subtype = Name.XObject, Name.Image
    im.Width, im.Height = pil.size
    im.ColorSpace, im.BitsPerComponent, im.Filter = Name.DeviceRGB, 8, Name.DCTDecode
    return pdf.make_indirect(im)


def logo_oscuro_plano(ob, tam):
    """El logo oscuro (con alfa) aplanado sobre crema, para donde no se usa SMask."""
    rgb = PdfImage(ob).as_pil_image().convert("RGB")
    al = PdfImage(ob["/SMask"]).as_pil_image().convert("L").resize(rgb.size)
    fondo = Image.new("RGB", rgb.size, tuple(int(v) for v in CREMA))
    fondo.paste(rgb, (0, 0), al)
    return fondo.resize(tam, Image.LANCZOS)


def preparar(form):
    """Copia el form y su Resources para no pisar lo que comparte con otras páginas."""
    # los kwargs de Stream() vuelven a anteponer "/", así que las claves se copian después
    nuevo = pdf.make_indirect(Stream(pdf, form.read_bytes()))
    for k, v in form.items():
        if str(k) not in ("/Length", "/Filter", "/DecodeParms"):
            nuevo[str(k)] = v
    nuevo["/Resources"] = pdf.make_indirect(form["/Resources"].copy())
    nuevo["/Resources"]["/XObject"] = pdf.make_indirect(form["/Resources"]["/XObject"].copy())
    return nuevo


def recolorear(form):
    raw = form.read_bytes().decode("latin-1")
    for viejo, nuevo in COLORES:
        if viejo in raw:
            print(f"      color {viejo.split()[0]} -> {nuevo.split()[0]}  x{raw.count(viejo)}")
            raw = raw.replace(viejo, nuevo)
    form.write(raw.encode("latin-1"))


TRABAJO = [
    (11, "/S13", ["/Im140", "/Im142"], ("/Im9", "/Im134")),   # pág 12 · SPOT MÓVIL
    (12, "/S14", ["/ImgProducto"], ("/ImgLogo", None)),        # pág 13 · SPOT 12V
    (12, "/S15", ["/Im149", "/Im151"], ("/Im9", "/Im134")),    # pág 13 · SPOT MINI
]

for pag, nombre, fotos, (logo_blanco, logo_oscuro) in TRABAJO:
    print(f"pág {pag + 1} {nombre}:")
    form = preparar(pdf.pages[pag]["/Resources"]["/XObject"][nombre])
    pdf.pages[pag]["/Resources"]["/XObject"][nombre] = form
    xo = form["/Resources"]["/XObject"]

    for f in fotos:
        pil = PdfImage(xo[f]).as_pil_image()
        recortada, alfa = sobre_crema(pil)
        xo[f] = jpeg(recortada)
        print(f"      {f}: recortada, producto {alfa.mean() * 100:.0f}% del cuadro")

    if logo_oscuro:
        xo[logo_blanco] = xo[logo_oscuro]
        print(f"      logo {logo_blanco} -> versión oscura")
    else:
        ref = pdf.pages[11]["/Resources"]["/XObject"]["/S13"]["/Resources"]["/XObject"]["/Im134"]
        actual = PdfImage(xo[logo_blanco]).as_pil_image()
        xo[logo_blanco] = jpeg(logo_oscuro_plano(ref, actual.size), 96)
        print(f"      logo {logo_blanco} -> versión oscura aplanada sobre crema")

    recolorear(form)

pdf.save(OUT)
print("guardado", OUT)
