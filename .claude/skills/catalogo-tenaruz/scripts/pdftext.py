"""Decodificación/codificación de las fuentes CID embebidas en el catálogo.

El catálogo usa fuentes Poppins embebidas como subsets con codificación Identity-H: el
texto se guarda como IDs de glifo de 2 bytes, no como ASCII. Para escribir texto nuevo hay
que traducir unicode -> CID usando el CMap ToUnicode del propio archivo, y sacar los anchos
del array /W de la fuente CID descendiente.
"""
import re

import pikepdf


def _parse_tounicode(cmap):
    """CID -> unicode a partir del CMap ToUnicode.

    Soporta las tres formas que aparecen en la práctica: bfchar, bfrange secuencial y
    bfrange con array explícito (que es la que usa este catálogo).
    """
    cid2uni = {}
    for m in re.finditer(r"beginbfchar(.*?)endbfchar", cmap, re.S):
        for src, dst in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", m.group(1)):
            cid2uni[int(src, 16)] = chr(int(dst[:4], 16))
    for m in re.finditer(r"beginbfrange(.*?)endbfrange", cmap, re.S):
        body = m.group(1)
        for lo, _hi, arr in re.findall(
            r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]", body, re.S
        ):
            for k, u in enumerate(re.findall(r"<([0-9A-Fa-f]+)>", arr)):
                cid2uni[int(lo, 16) + k] = chr(int(u[:4], 16))
        rest = re.sub(r"<[0-9A-Fa-f]+>\s*<[0-9A-Fa-f]+>\s*\[.*?\]", "", body, flags=re.S)
        for lo, hi, dst in re.findall(
            r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", rest
        ):
            base = int(dst[:4], 16)
            for k in range(int(lo, 16), int(hi, 16) + 1):
                cid2uni[k] = chr(base + k - int(lo, 16))
    return cid2uni


def load_fonts(pdf, page_index=4):
    """-> {'/F11': {basefont, cid2uni, uni2cid, widths, default_width}, ...}"""
    fonts = {}
    res = pdf.pages[page_index]["/Resources"].get("/Font")
    if res is None:
        return fonts
    for name, font in res.items():
        info = {"basefont": str(font.get("/BaseFont"))}
        cid2uni = (
            _parse_tounicode(font["/ToUnicode"].read_bytes().decode("latin-1"))
            if "/ToUnicode" in font
            else {}
        )
        info["cid2uni"] = cid2uni
        uni2cid = {}
        for c, u in cid2uni.items():
            uni2cid.setdefault(u, c)
        info["uni2cid"] = uni2cid

        widths, dw = {}, 1000.0
        if "/DescendantFonts" in font:
            desc = font["/DescendantFonts"][0]
            dw = float(desc.get("/DW", 1000))
            warr = desc.get("/W")
            if warr is not None:
                items, i = list(warr), 0
                while i < len(items):
                    first, nxt = int(items[i]), items[i + 1]
                    if isinstance(nxt, pikepdf.Array):
                        for j, w in enumerate(nxt):
                            widths[first + j] = float(w)
                        i += 2
                    else:
                        w = float(items[i + 2])
                        for k in range(first, int(nxt) + 1):
                            widths[k] = w
                        i += 3
        info["widths"], info["default_width"] = widths, dw
        fonts[str(name)] = info
    return fonts


def encode(text, fi):
    """texto -> (lista de CIDs en hex, lista de anchos en unidades de 1000/em)."""
    hexs, advs = [], []
    for ch in text:
        cid = fi["uni2cid"].get(ch)
        if cid is None and ch == " ":
            # este documento mapea su glifo de espacio a U+0009, no a U+0020
            cid = fi["uni2cid"].get("\t")
        if cid is None:
            raise KeyError(
                f"falta el glifo {ch!r} (U+{ord(ch):04X}) en {fi['basefont']}: "
                "es un subset, solo trae los caracteres ya usados en el documento"
            )
        hexs.append(f"{cid:04X}")
        advs.append(fi["widths"].get(cid, fi["default_width"]))
    return hexs, advs


def missing_glyphs(text, fi):
    out = []
    for ch in set(text):
        if ch in fi["uni2cid"] or (ch == " " and "\t" in fi["uni2cid"]):
            continue
        out.append(ch)
    return sorted(out)
