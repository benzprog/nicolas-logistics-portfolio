"""Segundo lote: apliques, fuentes por modelo y la estaca partida en dos.

La estaca de aluminio pasa a mostrar las dos versiones: la foto de la mini debajo de la
estándar y la tabla con una columna por variante. Las dos fotos se achican a 130 pt de
alto, que es la altura a la que trabajan las fotos apareadas del resto de la sección; la
de antes ocupaba el panel entero porque era una sola.
"""
import io
import sys
import zlib

import pikepdf
from pikepdf import Name, Stream
from PIL import Image

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from catalog import BOTTOM, Catalog, TOP  # noqa: E402

W = "."
IMG = "./fotos"
SRC, OUT = f"{W}/CATALOGO_TENARUZ_2026_v2.pdf", f"{W}/CATALOGO_LOTE2.pdf"

cat = Catalog(SRC)
pdf = cat.pdf
paginas = {}


def agregar(p, frag):
    paginas.setdefault(p, []).extend(frag)


# ─── 1. aplique curvo: misma redacción que el recto ───────────────────────────
TEXTO_APLIQUE = ("Línea de apliques de exterior GU10, ideal para fachadas. Al ser de aluminio "
                 "son aptas para intemperie y la lámpara se reemplaza con facilidad. "
                 "Con certificación nacional e internacional.")
B, T = BOTTOM, TOP
lineas = cat.wrap(TEXTO_APLIQUE, "/F11", 6.92, -0.0035, 232.3)
assert len(lineas) == 3, lineas
frag = [cat.rect(B.text_x - 2.5, B.desc_y - 3 * B.desc_leading + B.desc_leading - 3.2,
                 237.3, 3 * B.desc_leading + 5.5, cat.WHITE)]
for i, t in enumerate(lineas):
    frag.append(cat.show(t, "/F11", 6.92, B.text_x, B.desc_y - i * B.desc_leading,
                         -0.0035, cat.BODY))
agregar(15, frag)
print("pág 15: descripción del aplique curvo igualada a la del recto")

# ─── 2. estaca solar: sale el cartel ──────────────────────────────────────────
agregar(17, [cat.rect(34.0, 284.5, 240.0, 11.5, cat.WHITE)])
print("pág 17: sale 'FICHA TÉCNICA AMPLIADA A CONFIRMAR'")

# ─── 3. fuentes: el bulto al lado de cada modelo ──────────────────────────────
BULTOS_12V = [("1A", 200), ("2A", 200), ("3A", 200), ("5A", 200), ("6A", 200),
              ("8.3A", 200), ("10A", 100), ("12A", 100), ("16.6A", 100)]
BULTOS_24V = [("1A", 200), ("2A", 200), ("3A", 200), ("5A", 100), ("8.3A", 100), ("10A", 100)]
REJILLA = {
    "12V": ([505.02, 480.81, 456.61], [36.85, 114.26, 191.68], T.footer_y),
    "24V": ([152.34, 128.14], [342.83, 420.25, 497.66], B.footer_y),
}
for tension, datos in (("12V", BULTOS_12V), ("24V", BULTOS_24V)):
    filas, cols, pie = REJILLA[tension]
    frag = []
    for k, (modelo, bulto) in enumerate(datos):
        y, x = filas[k // 3], cols[k % 3]
        texto = f"{modelo} · BULTO x {bulto}"
        assert not cat.check_glyphs(texto, "/F11"), texto
        assert cat.advance(texto, "/F11", 5.19, 0.889) < 76, texto
        frag += [cat.rect(x - 1.5, y - 2.2, 76.0, 8.2, cat.WHITE),
                 cat.show(texto, "/F11", 5.19, x, y, 0.889, cat.SUBCODE)]
    # el pie resumido ya no hace falta: cada modelo lleva su cantidad
    frag.append(cat.rect(cols[0] - 1.5, pie - 2.5, 235.0, 10.0, cat.WHITE))
    agregar(19, frag)
    print(f"pág 19 {tension}: {len(datos)} modelos con su bulto, pie resumido fuera")


# ─── 4. estaca de aluminio: las dos versiones ─────────────────────────────────
# La ficha pasa a comparar estándar y mini. Nueve filas más una de encabezado entran
# justo en las diez posiciones de la grilla; la tabla ya venía corrida 11.06 pt porque
# la descripción ocupa tres renglones, y al sumar una fila los códigos bajan otros 14.4.
CORRIMIENTO = -11.06
COL1, COL2 = 478.0, B.value_right
ALTO_FOTO = 130.0          # la altura a la que trabajan las fotos apareadas de la sección
CENTRO_FOTO = 152.5

ESTACA = [
    ("Potencia máx.", "1x7W", "1x3W"),
    ("Zócalo", "GU10", "GU10"),
    ("Lámpara, no incluida", "Dicroled", "Minidicroica"),
    ("Cuerpo", "Aluminio negro", "Aluminio negro"),
    ("Clase", "II", "II"),
    ("Protección", "IP67", "IP67"),
    ("Tensión", "AC 100-240V", "AC 100-240V"),
    ("Cabezal", "Ø60 x 95 mm", "Ø42 x 97 mm"),
    ("Soporte", "220 mm", "228 mm"),
]

fila_y = [b + CORRIMIENTO for b in B.row_baselines]
regla_y = [r + CORRIMIENTO for r in B.row_rules]

frag = [cat.rect(341.7, regla_y[9] - 4, 235.0, fila_y[0] - regla_y[9] + 11, cat.WHITE),
        cat.show_right("ESTÁNDAR", "/F11", 5.19, COL1, fila_y[0], 0.895, cat.SUBCODE),
        cat.show_right("MINI", "/F11", 5.19, COL2, fila_y[0], 0.895, cat.SUBCODE),
        cat.rule(342.72, 575.28, regla_y[0])]
for i, (etiqueta, v1, v2) in enumerate(ESTACA, start=1):
    for t, res in ((etiqueta, "/F11"), (v1, "/F20"), (v2, "/F20")):
        assert not cat.check_glyphs(t, res), t
    frag += [cat.show(etiqueta, "/F11", 6.34, B.text_x, fila_y[i], 0.245, cat.LABEL),
             cat.show_right(v1, "/F20", 6.34, COL1, fila_y[i], -0.003, cat.VALUE),
             cat.show_right(v2, "/F20", 6.34, COL2, fila_y[i], -0.003, cat.VALUE),
             cat.rule(342.72, 575.28, regla_y[i])]

# los códigos bajan una fila
y_cod = 107.36 - 14.4
# la tapa arranca por encima de los códigos viejos (107.36) y llega bajo los nuevos
frag += [cat.rect(341.7, y_cod - 14.0, 235.0, 34.0, cat.WHITE),
         cat.show("TZ-ESTAL-GU10", "/F20", 5.76, B.text_x, y_cod, 0.396, cat.TITLE),
         cat.show("ESTÁNDAR", "/F11", 5.19, B.text_x, y_cod - 9.36, 0.895, cat.SUBCODE),
         cat.show("TZ-ESTAL-GU10-MINI", "/F20", 5.76, 458.97, y_cod, 0.396, cat.TITLE),
         cat.show("PARA MINIDICROICA", "/F11", 5.19, 458.97, y_cod - 9.36, 0.895, cat.SUBCODE)]
print(f"pág 16: tabla comparativa de {len(ESTACA)} filas, códigos a y={y_cod:.2f}")

# ── las dos fotos, una sobre otra en el panel crema ──
# Este panel venía en un crema propio, (228,224,218), más oscuro que el (241,237,232) del
# resto de la sección. Se repinta entero con el de la sección —logo incluido, que por eso
# hay que volver a colocar— y las dos fotos se recomponen sobre ese mismo crema.
import numpy as np                                            # noqa: E402
from pikepdf import PdfImage                                  # noqa: E402
from scipy import ndimage                                     # noqa: E402

ALTO_MAX = 1000                # de sobra para 130 pt impresos
pagina = pdf.pages[15]
xo = pagina["/Resources"]["/XObject"]
CREMA = np.array([float(v) for v in cat.CREAM])


def sin_perdida(pil):
    """Flate en vez de JPEG: el fondo es una superficie plana y grande, y con JPEG queda
    a un punto del panel — poco, pero en un plano liso se ve."""
    a = np.asarray(pil.convert("RGB"), dtype=np.uint8)
    im = Stream(pdf, zlib.compress(a.tobytes(), 9))
    im.Type, im.Subtype = Name.XObject, Name.Image
    im.Width, im.Height = pil.size
    im.ColorSpace, im.BitsPerComponent, im.Filter = Name.DeviceRGB, 8, Name.FlateDecode
    return pdf.make_indirect(im)


def achicar(pil):
    if pil.height <= ALTO_MAX:
        return pil
    return pil.resize((round(pil.width * ALTO_MAX / pil.height), ALTO_MAX), Image.LANCZOS)


# estándar: trae su propio crema cocido en el JPEG, hay que recortarlo contra él
std = achicar(PdfImage(xo["/S17"]["/Resources"]["/XObject"]["/Im175"]).as_pil_image().convert("RGB"))
a = np.asarray(std).astype(float)
esq = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3),
                      a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
propio = np.median(esq, axis=0)
d = np.abs(a - propio).max(axis=2)
m = ndimage.binary_opening(ndimage.binary_fill_holes(d > 40), np.ones((3, 3)))
lab, n = ndimage.label(m)
if n:
    tam = ndimage.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, t in enumerate(tam) if t > 0.002 * m.size])
alfa = ndimage.gaussian_filter(m.astype(float), 0.8)[..., None]
xo["/EstacaStd"] = sin_perdida(Image.fromarray(
    np.clip(a + (CREMA - propio) * (1 - alfa), 0, 255).astype(np.uint8), "RGB"))
print(f"pág 16: foto estándar recortada de su crema {tuple(int(v) for v in propio)}")

# mini: viene con alfa, se aplana sobre el crema de la sección
mini = Image.open(f"{IMG}/2.png").convert("RGBA")
al = np.asarray(mini)[..., 3]
ys, xs = np.where(al > 40)
mini = achicar(mini.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
base = Image.new("RGB", mini.size, tuple(int(v) for v in cat.CREAM))
base.paste(mini, (0, 0), mini)
xo["/EstacaMini"] = sin_perdida(base)

# el logo oscuro, que se va con el repintado del panel
xo["/EstacaLogo"] = xo["/S17"]["/Resources"]["/XObject"]["/Im134"]

def foto(nombre, ancho_px, alto_px, y0, leyenda, y_leyenda):
    w = ALTO_FOTO * ancho_px / alto_px
    return [cat.place(nombre, CENTRO_FOTO - w / 2, y0, w, ALTO_FOTO),
            cat.show_center(leyenda, "/F11", 5.19, CENTRO_FOTO, y_leyenda, 0.896, (109, 109, 109))]

frag.append(cat.rect(0, 0, 306, 396, cat.CREAM))          # el panel entero, tono de la sección
frag.append(cat.place("/EstacaLogo", *B.logo_pos))
frag += foto("/EstacaStd", int(xo["/EstacaStd"].Width), int(xo["/EstacaStd"].Height), 200.0,
             "TZ-ESTAL-GU10", 188.0)
frag += foto("/EstacaMini", base.width, base.height, 45.0,
             "TZ-ESTAL-GU10-MINI", 33.0)
agregar(16, frag)
print(f"pág 16: dos fotos de {ALTO_FOTO:.0f} pt de alto, estándar arriba y mini abajo")

for p, f in sorted(paginas.items()):
    cat.append(pdf.pages[p - 1], "\n".join(f))
cat.save(OUT)
print("\nguardado", OUT)
