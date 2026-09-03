"""Vuelca cada bloque de texto de una página con su receta tipográfica exacta.

Esta es la fuente de verdad para replicar el diseño: da fuente, tamaño efectivo, tracking,
color y posición reales, en vez de estimaciones sacadas del render.

    python3 analyze_page.py CATALOGO.pdf --page 5
    python3 analyze_page.py CATALOGO.pdf --page 5 --below 400
    python3 analyze_page.py CATALOGO.pdf --page 2 --between 470 530
"""
import argparse
import re

import pikepdf

from pdftext import load_fonts

NUM = r"[-+0-9.eE]+"
TOK = re.compile(
    rf"(?P<cm>(?P<m0>{NUM})\s+(?P<m1>{NUM})\s+(?P<m2>{NUM})\s+(?P<m3>{NUM})\s+"
    rf"(?P<m4>{NUM})\s+(?P<m5>{NUM})\s+cm)"
    rf"|(?P<q>\bq\b)|(?P<Q>\bQ\b)"
    rf"|(?P<scn>(?P<cr>{NUM})\s+(?P<cg>{NUM})\s+(?P<cb>{NUM})\s+scn)"
    rf"|(?P<BT>\bBT\b)|(?P<ET>\bET\b)"
    rf"|(?P<Tf>/(?P<fname>\w+)\s+(?P<fsize>{NUM})\s+Tf)"
    rf"|(?P<Td>(?P<tdx>{NUM})\s+(?P<tdy>{NUM})\s+Td)"
    rf"|(?P<Tj><(?P<cid>[0-9A-Fa-f]*)>\s*Tj)"
)


def mat_mul(a, b):
    return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
            a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
            a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]]


def read_runs(pdf, page_index):
    fonts = load_fonts(pdf, page_index)
    page = pdf.pages[page_index]
    contents = page.Contents
    raw = (b"".join(s.read_bytes() for s in contents)
           if isinstance(contents, pikepdf.Array) else contents.read_bytes())
    data = raw.decode("latin-1")

    ctm, stack, color, cur, runs = [1, 0, 0, 1, 0, 0], [], (0, 0, 0), None, []
    for m in TOK.finditer(data):
        if m.group("q"):
            stack.append((list(ctm), color))
        elif m.group("Q"):
            if stack:
                ctm, color = stack.pop()
                ctm = list(ctm)
        elif m.group("cm"):
            ctm = mat_mul([float(m.group(g)) for g in ("m0", "m1", "m2", "m3", "m4", "m5")], ctm)
        elif m.group("scn"):
            color = tuple(round(float(m.group(g)) * 255) for g in ("cr", "cg", "cb"))
        elif m.group("BT"):
            cur = {"ctm": list(ctm), "color": color, "glyphs": [], "start": None,
                   "font": None, "size": None, "last_dx": 0.0}
        elif m.group("Tf") and cur is not None:
            cur["font"], cur["size"] = m.group("fname"), float(m.group("fsize"))
        elif m.group("Td") and cur is not None:
            dx, dy = float(m.group("tdx")), float(m.group("tdy"))
            if cur["start"] is None:
                cur["start"] = (dx, dy)
            cur["last_dx"] = dx
        elif m.group("Tj") and cur is not None:
            cur["glyphs"].append((m.group("cid"), cur["last_dx"]))
        elif m.group("ET") and cur is not None:
            if cur["glyphs"] and cur["start"] and cur["font"]:
                runs.append(cur)
            cur = None

    out = []
    for r in runs:
        fi = fonts["/" + r["font"]]
        text = "".join(fi["cid2uni"].get(int(g[0], 16), "?") for g in r["glyphs"])
        text = text.replace("\t", " ")  # el glifo de espacio está mapeado a U+0009
        a, _b, _c, d, e, f = r["ctm"]
        x = a * r["start"][0] + e
        y = d * (-r["start"][1]) + f  # el Tm de este documento invierte la y
        tracks = []
        for i in range(1, len(r["glyphs"])):
            prev = int(r["glyphs"][i - 1][0], 16)
            natural = fi["widths"].get(prev, fi["default_width"]) * r["size"] / 1000.0
            tracks.append(r["glyphs"][i][1] - natural)
        trk = (sum(tracks) / len(tracks) * a) if tracks else 0.0
        out.append({"y": y, "x": x, "text": text, "font": "/" + r["font"],
                    "size": r["size"], "eff": r["size"] * a, "trk": trk, "color": r["color"]})
    out.sort(key=lambda t: (-t["y"], t["x"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--page", type=int, required=True, help="número de página (base 1)")
    ap.add_argument("--below", type=float, help="solo runs con y menor a este valor")
    ap.add_argument("--above", type=float, help="solo runs con y mayor a este valor")
    ap.add_argument("--between", type=float, nargs=2, metavar=("YMIN", "YMAX"))
    args = ap.parse_args()

    runs = read_runs(pikepdf.open(args.pdf), args.page - 1)
    print(f"{len(runs)} bloques de texto en la página {args.page}\n")
    print(f"{'y':>8} {'x':>8}  {'fuente':7} {'tam':>4} {'efect':>7} {'track':>7}  "
          f"{'color':16} texto")
    for r in runs:
        y = r["y"]
        if args.below is not None and y >= args.below:
            continue
        if args.above is not None and y <= args.above:
            continue
        if args.between and not (args.between[0] < y < args.between[1]):
            continue
        rgb = "#%02x%02x%02x" % r["color"]
        print(f"{y:8.2f} {r['x']:8.2f}  {r['font']:7} {r['size']:>4g} {r['eff']:6.2f}pt "
              f"{r['trk']:+7.3f}  {rgb:16} {r['text']!r}")


if __name__ == "__main__":
    main()
