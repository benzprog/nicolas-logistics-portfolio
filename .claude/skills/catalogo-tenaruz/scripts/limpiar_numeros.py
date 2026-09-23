"""Deja un solo número de página en la capa de texto de cada página.

Renumerar se hace tapando el recuadro y dibujando el número nuevo encima, así que cada
renumeración deja el anterior debajo. Varias páginas pasaron por dos, y al copiarlas salían
dos o cuatro números seguidos.

Se conserva únicamente el último bloque que dibuja el número correcto —el que está a la
vista— y se borran los demás. El render no cambia: lo que se borra está tapado.

Sólo cuentan los bloques que caen dentro del recuadro de numeración (x>570, y<40). Sin ese
filtro entra también la columna de números del índice, que son 23 y sí se ven.
"""
import re
import sys

import pikepdf

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from pdftext import load_fonts  # noqa: E402

W = "."
SRC, OUT = f"{W}/CATALOGO_TENARUZ_2026.pdf", f"{W}/CATALOGO_TENARUZ_2026_NUM.pdf"

pdf = pikepdf.open(SRC)
FUENTES = load_fonts(pdf, 4)


def texto_de(bloque):
    salida, mapa = [], {}
    for m in re.finditer(r"(/F\d+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj", bloque):
        if m.group(1):
            mapa = FUENTES.get(m.group(1), {}).get("cid2uni", {})
        else:
            h = m.group(2)
            for i in range(0, len(h), 4):
                salida.append(mapa.get(int(h[i:i + 4], 16), ""))
    return "".join(salida).replace("\t", " ").strip()


for idx in range(len(pdf.pages)):
    datos = pdf.pages[idx].obj["/Contents"]
    flujos = list(datos) if isinstance(datos, pikepdf.Array) else [datos]

    # dónde está cada bloque que sólo dibuja un número: (stream, posición)
    numeros = []
    for j, f in enumerate(flujos):
        raw = f.read_bytes().decode("latin-1")
        for m in re.finditer(r"BT.*?ET", raw, re.S):
            b = m.group(0)
            if not texto_de(b).isdigit():
                continue
            pos = re.search(r"([-\d.]+)\s+([-\d.]+)\s+Td", b)
            if pos and float(pos.group(1)) > 570 and float(pos.group(2)) < 40:
                numeros.append((j, m.start(), m.end()))
    if len(numeros) < 2:
        continue

    sobran = numeros[:-1]                      # el último es el que se ve
    for j, f in enumerate(flujos):
        recortes = [(a, b) for k, a, b in sobran if k == j]
        if not recortes:
            continue
        raw = f.read_bytes().decode("latin-1")
        partes, i = [], 0
        for a, b in recortes:
            partes.append(raw[i:a])
            i = b
        partes.append(raw[i:])
        f.write("".join(partes).encode("latin-1"))
    print(f"pág {idx + 1}: {len(sobran)} número(s) viejo(s) borrado(s)")

pdf.save(OUT)
print("guardado", OUT)
