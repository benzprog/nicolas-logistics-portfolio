"""La estaca pasa a nombrar sus dos versiones por la lámpara que llevan: DICRO y MINI DICRO.

"ESTÁNDAR" no decía nada sobre el producto y "MINI" se leía como un tamaño, no como la
lámpara. Los rótulos salen en los dos lugares donde aparecen: el encabezado de las columnas
de la tabla comparativa y el subcódigo bajo cada SKU.

Además se van de la capa de texto los restos de la ficha vieja de una sola columna, que
seguían en el form /S17 debajo de las tapas blancas: buscar "ESTÁNDAR" en el PDF los
encontraba igual.
"""
import re
import sys

import pikepdf

sys.path.insert(0, "/home/user/nicolas-logistics-portfolio/.claude/skills/catalogo-tenaruz/scripts")
from catalog import BOTTOM, Catalog          # noqa: E402
from pdftext import load_fonts               # noqa: E402

SRC, OUT = "BASE.pdf", "CATALOGO_ESTACA.pdf"
cat = Catalog(SRC)
pdf = cat.pdf
F = load_fonts(pdf, 4)
B = BOTTOM

# misma grilla que armó la ficha comparativa
CORRIMIENTO = -11.06
COL1, COL2 = 478.0, B.value_right
Y_ENCABEZADO = B.row_baselines[0] + CORRIMIENTO        # 247.89
Y_SUBCODIGO = (107.36 - 14.4) - 9.36                   # 83.60
X_COD2 = 458.97

DICRO, MINIDICRO = "DICRO", "MINI DICRO"
VIEJOS = {"ESTÁNDAR", "MINI", "PARA MINIDICROICA"}


def texto_de(bloque):
    salida, mapa = [], {}
    for m in re.finditer(r"(/F\d+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj", bloque):
        if m.group(1):
            mapa = F.get(m.group(1), {}).get("cid2uni", {})
        else:
            h = m.group(2)
            for i in range(0, len(h), 4):
                salida.append(mapa.get(int(h[i:i + 4], 16), ""))
    return "".join(salida).replace("\t", " ")


def podar(raw, sobra):
    """Saca del stream los BT..ET cuyo texto decodificado cumple `sobra`."""
    partes, i, fuera = [], 0, []
    for m in re.finditer(r"BT.*?ET", raw, re.S):
        t = texto_de(m.group(0))
        if sobra(t, m.group(0)):
            fuera.append(t)
            partes.append(raw[i:m.start()])
            i = m.end()
    partes.append(raw[i:])
    return "".join(partes), fuera


# ─── 1. los rótulos viejos salen de la capa de corrección de la página 16 ─────
pagina = pdf.pages[15]
datos = pagina.obj["/Contents"]
flujos = list(datos) if isinstance(datos, pikepdf.Array) else [datos]
for n, f in enumerate(flujos):
    raw = f.read_bytes().decode("latin-1")
    nuevo, fuera = podar(raw, lambda t, _b: t in VIEJOS)
    if fuera:
        f.write(nuevo.encode("latin-1"))
        print(f"pág 16 stream[{n}]: fuera {fuera}")

# ─── 2. restos de la ficha vieja de una columna, tapados pero buscables ───────
# /S17 lo comparten las páginas 16 y 17: la 17 pinta la estaca solar, que vive en el
# mismo form con otro cm. Sólo se borran los bloques de la ficha de aluminio vieja,
# que en la 17 caen fuera de la hoja, así que la copia privada no hace falta.
RESTOS = {          # Td y -> textos de la ficha de una sola columna
    "-20867": {"Potencia máx.", "1x7W / 1x3W (mini)"},
    "-20892": {"Zócalo", "GU10"},
    "-20917": {"Lámpara", "Dicroled o minidicroica, no incluida"},
    "-20942": {"Cuerpo", "Aluminio negro"},
    "-20968": {"Clase", "II"},
    "-20993": {"Protección", "IP67"},
    "-21018": {"Tensión", "AC 100-240V"},
    "-21043": {"Cabezal", "Ø60 x 95 mm / Ø42 x 97 mm"},
    "-21068": {"Soporte", "220 mm / 228 mm"},
    "-21111": {"TZ-ESTAL-GU10", "TZ-ESTAL-GU10-MINI"},
    "-21127": {"ESTÁNDAR", "PARA MINIDICROICA"},
    "-21199": {"TZ-ESTAL-GU10"},
}


def resto(t, bloque):
    td = re.search(r"([\d.-]+)\s+([\d.-]+)\s+Td", bloque)
    return bool(td) and t in RESTOS.get(td.group(2), ())


forma = pagina.obj["/Resources"]["/XObject"]["/S17"]
nuevo, fuera = podar(forma.read_bytes().decode("latin-1"), resto)
forma.write(nuevo.encode("latin-1"))
print(f"/S17: {len(fuera)} bloques de la ficha vieja fuera de la capa de texto")

# ─── 3. los rótulos nuevos ────────────────────────────────────────────────────
for t in (DICRO, MINIDICRO):
    assert not cat.check_glyphs(t, "/F11"), t
ancho = cat.advance(MINIDICRO, "/F11", 5.19, 0.895)
assert ancho < COL2 - COL1, f"{ancho:.2f} no entra en la columna"
assert X_COD2 + ancho < 575.28, "el subcódigo se pasa del margen"

frag = [cat.show_right(DICRO, "/F11", 5.19, COL1, Y_ENCABEZADO, 0.895, cat.SUBCODE),
        cat.show_right(MINIDICRO, "/F11", 5.19, COL2, Y_ENCABEZADO, 0.895, cat.SUBCODE),
        cat.show(DICRO, "/F11", 5.19, B.text_x, Y_SUBCODIGO, 0.895, cat.SUBCODE),
        cat.show(MINIDICRO, "/F11", 5.19, X_COD2, Y_SUBCODIGO, 0.895, cat.SUBCODE)]
cat.append(pagina, "\n".join(frag))
print(f"pág 16: {DICRO} / {MINIDICRO} en encabezado y subcódigo ({ancho:.2f} pt de ancho)")

cat.save(OUT)
print("guardado", OUT)
