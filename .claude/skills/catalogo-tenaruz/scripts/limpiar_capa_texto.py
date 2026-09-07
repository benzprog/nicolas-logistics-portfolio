"""Borra de la capa de texto los bloques que quedaron tapados por correcciones anteriores.

Tapar un texto con un rectángulo lo saca de la vista pero no del archivo: sigue en la capa
de texto y reaparece al copiar y pegar, al buscar o en cualquier extractor. En la página de
contacto convivían así el número de administración que se había pedido borrar, los teléfonos
viejos, el horario viejo y la razón social en versales; en la portada, la razón social vieja.

Los bloques se borran sólo del stream original de cada página (el índice 2; los siguientes
son las capas de corrección, que son las que hay que conservar). Se decodifica siguiendo el
`/Fxx Tf` vigente: cada subset tiene su propio mapa CID -> unicode y mezclarlos da texto
falso.

Los rectángulos que tapaban se dejan: pintan el color de fondo, así que no cambia nada a la
vista. La verificación es que el render quede idéntico y que los textos viejos ya no salgan
por `pdftotext`.
"""
import re
import sys

import pikepdf

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from pdftext import load_fonts  # noqa: E402

W = "."
SRC, OUT = f"{W}/CATALOGO.pdf", f"{W}/CATALOGO_LIMPIO.pdf"

ORIGINAL = 2        # índice del stream con el contenido original de la página

SOBRAN = {
    1: ["IMPORTA Y DISTRIBUYE · PANA ILUMINACIÓN S.A."],
    19: ["PANA ILUMINACIÓN S.A.",
         "Ventas · WhatsApp 11-4176-4205",
         "Consultas · WhatsApp 11-6288-3659",
         "Administración · (011) 4631-1758",
         "panailuminacion@hotmail.com",
         "Lunes a viernes de 10 a 17 hs"],
}

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
    return "".join(salida).replace("\t", " ")


for num, textos in SOBRAN.items():
    datos = pdf.pages[num - 1].obj["/Contents"]
    flujos = list(datos) if isinstance(datos, pikepdf.Array) else [datos]
    raw = flujos[ORIGINAL].read_bytes().decode("latin-1")
    partes, i, borrados = [], 0, []
    for m in re.finditer(r"BT.*?ET", raw, re.S):
        t = texto_de(m.group(0))
        if t in textos:
            borrados.append(t)
            partes.append(raw[i:m.start()])
            i = m.end()
    partes.append(raw[i:])
    flujos[ORIGINAL].write("".join(partes).encode("latin-1"))
    print(f"pág {num}: {len(borrados)} bloques borrados de la capa de texto")
    for t in borrados:
        print(f"    - {t}")

pdf.save(OUT)
print("guardado", OUT)
