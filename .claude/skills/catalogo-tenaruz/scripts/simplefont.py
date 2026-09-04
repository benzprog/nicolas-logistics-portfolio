"""Embeber una fuente TrueType simple para escribir caracteres que los subsets no traen.

Los subsets del catálogo solo incluyen los glifos ya usados en el documento; la 'w'
minúscula, por ejemplo, no aparece en ninguna parte. Para esos casos se embebe Poppins
Regular completa (la misma familia del diseño) como fuente simple con WinAnsiEncoding.
"""
import pikepdf
from fontTools.ttLib import TTFont
from pikepdf import Array, Dictionary, Name, Stream

FIRST, LAST = 32, 126  # ASCII imprimible alcanza para una URL


def embed(pdf, ttf_path, resource_name="/FWeb"):
    """-> (nombre del recurso, dict {carácter: ancho en unidades de 1000/em})"""
    tt = TTFont(ttf_path)
    upem = tt["head"].unitsPerEm
    cmap = tt.getBestCmap()
    hmtx = tt["hmtx"]
    widths, char_w = [], {}
    for code in range(FIRST, LAST + 1):
        name = cmap.get(code)
        adv = hmtx[name][0] * 1000 / upem if name else 0
        widths.append(round(adv))
        char_w[chr(code)] = adv

    data = open(ttf_path, "rb").read()
    fontfile = Stream(pdf, data)
    fontfile.Length1 = len(data)

    os2, head, post = tt["OS/2"], tt["head"], tt["post"]
    scale = 1000 / upem
    descriptor = pdf.make_indirect(Dictionary(
        Type=Name.FontDescriptor, FontName=Name("/Poppins-Regular"), Flags=32,
        FontBBox=Array([round(head.xMin * scale), round(head.yMin * scale),
                        round(head.xMax * scale), round(head.yMax * scale)]),
        ItalicAngle=post.italicAngle,
        Ascent=round(os2.sTypoAscender * scale), Descent=round(os2.sTypoDescender * scale),
        CapHeight=round(getattr(os2, "sCapHeight", 700) * scale), StemV=80,
        FontFile2=fontfile,
    ))
    font = pdf.make_indirect(Dictionary(
        Type=Name.Font, Subtype=Name.TrueType, BaseFont=Name("/Poppins-Regular"),
        FirstChar=FIRST, LastChar=LAST, Widths=Array(widths),
        Encoding=Name.WinAnsiEncoding, FontDescriptor=descriptor,
    ))
    return resource_name, font, char_w


def advance(text, char_w, size, tracking=0.0):
    return sum(char_w[c] * size / 1000.0 for c in text) + tracking * len(text)


def show_center(text, resource_name, char_w, size, x_center, y, tracking, color):
    w = advance(text, char_w, size, tracking)
    esc = text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    col = " ".join(f"{v / 255:.6f}" for v in color)
    return (f"q {col} rg BT {resource_name} {size:.4f} Tf {tracking:.4f} Tc "
            f"1 0 0 1 {x_center - w / 2:.4f} {y:.4f} Tm ({esc}) Tj ET Q")
