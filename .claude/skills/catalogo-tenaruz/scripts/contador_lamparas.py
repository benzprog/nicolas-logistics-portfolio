"""La portadilla de LÁMPARAS decía 31 códigos y en la sección hay 29.

El original traía 30, pero uno de esos —TZ-SPOT12V-3W-NG-3K, el spot de 12V— es un
artefacto y se mudó a su sección al rearmar el catálogo: LÁMPARAS quedó en 29 y
ARTEFACTOS pasó de 17 a 18, que es lo que dice su portadilla. El 31 quedó mal de
cuando se repuso la AR70.

El número vive dentro del form /Src, que en esta página se pinta con un cm de 1.9,
así que el cuerpo es de 13.139 pt y no de 12. Se borra el bloque del form —borrarlo
y no taparlo, para que no quede en la capa de texto— y se redibuja en coordenadas de
página sobre la misma línea de base.
"""
import re
import sys

import pikepdf

sys.path.insert(0, "/home/user/nicolas-logistics-portfolio/.claude/skills/catalogo-tenaruz/scripts")
from catalog import Catalog        # noqa: E402
from pdftext import load_fonts     # noqa: E402

SRC, OUT = "CATALOGO_ESTACA.pdf", "CATALOGO_TENARUZ_2026_NUEVO.pdf"
PRUEBA = "--prueba" in sys.argv        # redibuja el 31 para validar la posición

cat = Catalog(SRC)
pdf = cat.pdf
F = load_fonts(pdf, 4)
mapa = F["/F11"]["cid2uni"]

ESCALA_FORM = 0.768361587
CM_PAG = (1.9, -60.592, -361.530)       # el cm con que la página 3 pinta /Src
GRIS = (154, 154, 154)                  # 0.603921568, el mismo scn del bloque

forma = pdf.pages[2].obj["/Resources"]["/XObject"]["/Src"]
raw = forma.read_bytes().decode("latin-1")
cms = list(re.finditer(r"0\.768361587 0 0 0\.768361587 ([-\d.]+) ([-\d.]+) cm", raw))

objetivo = None
for m in re.finditer(r"BT\n/F11 ([\d.]+) Tf 1 0 0 -1 0 0 Tm\n([\s\S]*?)ET", raw):
    texto = "".join(mapa.get(int(c, 16), "")
                    for c in re.findall(r"<([0-9A-Fa-f]{4})>", m.group(2))).replace("\t", " ")
    if "CÓDIGOS" in texto:
        objetivo = (m, texto, float(m.group(1)))
assert objetivo, "no aparece el contador en /Src"
m, viejo, cuerpo_form = objetivo

s, tx, ty = CM_PAG
prev = [c for c in cms if c.start() < m.start()][-1]   # el cm interno que rige el bloque
e, f = float(prev.group(1)), float(prev.group(2))
a, b = (float(v) for v in re.match(r"\s*([\d.-]+) ([\d.-]+) Td", m.group(2)).groups())

FACTOR = s * 0.75 * ESCALA_FORM                       # form -> página
x = s * 0.75 * (ESCALA_FORM * a + e) + tx
y = s * (-0.75 * (-ESCALA_FORM * b + f) + 792) + ty
tamano = cuerpo_form * s * 0.576271

# el tracking sale del propio run: cada Td es avance + tracking, en unidades del form
pasos = [float(v) for v in re.findall(r"([\d.-]+) 0 Td", m.group(2))]
trks = [p - cat.advance(viejo[i], "/F11", cuerpo_form) for i, p in enumerate(pasos)]
trk = sum(trks) / len(trks) * FACTOR        # el mismo tracking, en puntos de página

nuevo = viejo if PRUEBA else "29 CÓDIGOS"
assert not cat.check_glyphs(nuevo, "/F11"), nuevo
print(f"{viejo!r} -> {nuevo!r}  cuerpo={tamano:.4f} pt  base=({x:.4f}, {y:.4f})  trk={trk:.4f}")

# fuera del form: tapar lo dejaría en la capa de texto
forma.write((raw[:m.start()] + raw[m.end():]).encode("latin-1"))
cat.append(pdf.pages[2], cat.show(nuevo, "/F11", tamano, x, y, trk, GRIS))
cat.save(OUT)
print("guardado", OUT)
