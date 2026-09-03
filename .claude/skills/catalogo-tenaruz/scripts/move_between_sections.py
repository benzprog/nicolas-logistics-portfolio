"""Caso real: mover la ficha SPOT de LÁMPARAS a ARTEFACTOS, junto a los demás spots.

Sirve de plantilla para cualquier movimiento entre secciones: muestra el orden de los
pasos y cómo quedan índice, portadillas y numeración.

Cambios:
  pág 3  portadilla LÁMPARAS: saca AR70 de la lista, 31 -> 30 CÓDIGOS
  pág 5  queda solo MR16: la mitad inferior pasa a ser continuación de sus paneles
  pág 12 portadilla ARTEFACTOS: agrega SPOT a la lista, 17 -> 18 CÓDIGOS
  pág 2  índice: SPOT pasa de LÁMPARAS a ARTEFACTOS y se renumera lo que corre
  nueva pág 14: la ficha SPOT, justo detrás de los spots de embutir
  págs 14-19 viejas -> 15-20 (se repinta el recuadro de numeración)
"""
import sys

import pikepdf
from PIL import Image
from pikepdf import Dictionary, Name, Stream

sys.path.insert(0, "/home/user/nicolas-logistics-portfolio/.claude/skills/catalogo-tenaruz/scripts")
from build_product_page import ESTILOS, PRODUCTO, build  # noqa: E402
from catalog import TOP, Catalog  # noqa: E402

W = "/tmp/claude-0/-home-user-nicolas-logistics-portfolio/66a49b79-0302-5de9-8277-30d625b04b95/scratchpad/work"
SRC = f"{W}/output/CATALOGO_TENARUZ_2026_FINAL.pdf"
OUT = f"{W}/output/CATALOGO_TENARUZ_2026_ARTEFACTOS.pdf"

cat = Catalog(SRC)
pdf = cat.pdf

TAB = (581.0, 0.0, 31.0, 25.2)
TAB_CENTER = 596.5
TAB_TEXT_Y = 14.61

# estilo de las listas de las portadillas de sección
DIV_STYLE = ("/F11", 6.92, 0.594, (92, 92, 92))
DIV_PITCH = 13.83
COUNT_COLOR = (154, 154, 154)


def tab(numero):
    return [cat.rect(*TAB, cat.TITLE),
            cat.show_center(numero, "/F11", 6.34, TAB_CENTER, TAB_TEXT_Y, 0.0, cat.WHITE)]


# ───────────────────────── pág 3: portadilla LÁMPARAS ─────────────────────────
# La lista arranca en y=446.81 con paso 13.83. Sale AR70 (4º) y sube lo de abajo.
LAMPARAS = ["DICROICA LED · GU10 7W", "MINIDICRO LED · GU10 3W", "MR16 LED · 12V 5W",
            "AR111 LED · GU10 15W", "PLL LED · 2G11 18W", "PLD LED · G24D 9W",
            "LED STICK T45 · E27 12W", "BIPIN COB · G4 12V 2W", "BIPIN LED · G4 12V 4W",
            "BIPIN COB · G9 220V 3W", "BIPIN LED · G9 220V 6W", "GOTA LED · E27 5W",
            "BULBO LED A60 · E27 12W DIMERIZABLE", "TUBO T5 LED · 18W 1149 mm"]
res, size, trk, color = DIV_STYLE
f3 = [cat.rect(60, 215, 400, 245, cat.CREAM)]          # borra lista y contador viejos
for i, linea in enumerate(LAMPARAS):
    f3.append(cat.show(linea, res, size, 68.03, 446.81 - i * DIV_PITCH, trk, color))
f3.append(cat.show("30 CÓDIGOS", res, size, 68.03, 446.81 - 15 * DIV_PITCH, trk, COUNT_COLOR))
cat.append(pdf.pages[2], "\n".join(f3))

# ───────────────────── pág 5: MR16 se queda solo en la página ─────────────────
# El slot superior tiene el panel blanco a la izquierda; se continúan esos paneles
# hacia abajo para que la página se lea como una ficha de página completa.
f5 = [cat.rect(0, 0, 306, 396, cat.WHITE),
      cat.rect(306, 0, 306, 396, cat.DARK)] + tab("5")
cat.append(pdf.pages[4], "\n".join(f5))

# ─────────────────── pág 12: portadilla ARTEFACTOS ────────────────────────────
ARTEFACTOS = ["SPOT FIJO EMBUTIR · COB 3W Ø38 mm", "SPOT MÓVIL EMBUTIR · COB 3W Ø52 mm",
              "SPOT · 12V MÓVIL 3W", "SPOT MINI EMBUTIR · REDONDO PARA MINIDICROICA",
              "REFLECTOR EXTERIOR · LED 12V · IP65", "APLIQUE CURVO · EXTERIOR GU10 · IP65",
              "APLIQUE RECTO · EXTERIOR GU10 · IP65", "ESTACA ALUMINIO · 1 x GU10 · IP67",
              "ESTACA SOLAR LED · 28 LED · IP67"]
f12 = [cat.rect(60, 275, 400, 155, cat.CREAM)]
for i, linea in enumerate(ARTEFACTOS):
    f12.append(cat.show(linea, res, size, 68.03, 415.69 - i * DIV_PITCH, trk, color))
f12.append(cat.show("18 CÓDIGOS", res, size, 68.03, 415.69 - 10 * DIV_PITCH, trk, COUNT_COLOR))
cat.append(pdf.pages[11], "\n".join(f12))

# ───────────────────────────── pág 2: índice ──────────────────────────────────
# Se repinta de la 4ª fila para abajo: SPOT sale de LÁMPARAS y entra en ARTEFACTOS,
# así que el encabezado de sección sube un renglón y cambian los números de página.
ROW0, PITCH = 564.95, 24.0
RULE_OFF, RULE_X = 9.6, (68.04, 543.60)
NUM_RIGHT = 543.55
HEAD_GAP_ARRIBA, HEAD_GAP_ABAJO = 36.88, 23.05

IDX_LAMPARAS = [("DICROICA LED GU10 7W", "4"), ("MINIDICRO LED GU10 3W", "4"),
                ("MR16 LED 12V 5W", "5"), ("AR111 LED GU10 15W", "6"),
                ("PLL LED 2G11 18W", "6"), ("PLD LED G24D 9W", "7"),
                ("LED STICK T45 E27 12W", "7"), ("BIPIN COB G4 12V 2W", "8"),
                ("BIPIN LED G4 12V 4W", "8"), ("BIPIN COB G9 220V 3W", "9"),
                ("BIPIN LED G9 220V 6W", "9"), ("GOTA LED E27 5W", "10"),
                ("BULBO LED A60 E27 12W DIMERIZABLE", "10"),
                ("TUBO T5 LED 18W 1149 mm", "11")]
IDX_ARTEFACTOS = [("SPOT FIJO EMBUTIR COB 3W Ø38 mm", "13"),
                  ("SPOT MÓVIL EMBUTIR COB 3W Ø52 mm", "13"),
                  ("SPOT 12V MÓVIL 3W", "14"),
                  ("SPOT MINI EMBUTIR REDONDO PARA MINIDICROICA", "15"),
                  ("REFLECTOR EXTERIOR LED 12V · IP65", "15"),
                  ("APLIQUE CURVO EXTERIOR GU10 · IP65", "16"),
                  ("APLIQUE RECTO EXTERIOR GU10 · IP65", "16"),
                  ("ESTACA ALUMINIO 1 x GU10 · IP67", "17")]


def fila_indice(texto, numero, y):
    return [cat.show(texto, "/F11", 7.49, 68.03, y, 0.0, cat.BODY),
            cat.show_right(numero, "/F11", 6.34, NUM_RIGHT, y, 0.0, (154, 154, 154)),
            cat.rule(RULE_X[0], RULE_X[1], y - RULE_OFF)]


f2 = [cat.rect(60, 0, 500, 506.5, cat.WHITE)]           # de la 4ª fila para abajo
for i, (texto, num) in enumerate(IDX_LAMPARAS):
    if i < 3:
        continue                                        # las 3 primeras no se movieron
    f2 += fila_indice(texto, num, ROW0 - i * PITCH)
y_head = ROW0 - (len(IDX_LAMPARAS) - 1) * PITCH - HEAD_GAP_ARRIBA
f2.append(cat.show("ARTEFACTOS", "/F20", 6.34, 68.03, y_head, 1.595, cat.BODY))
y_art = y_head - HEAD_GAP_ABAJO
for i, (texto, num) in enumerate(IDX_ARTEFACTOS):
    f2 += fila_indice(texto, num, y_art - i * PITCH)
cat.append(pdf.pages[1], "\n".join(f2))

# ─────────────────── nueva pág 14: la ficha SPOT en ARTEFACTOS ────────────────
nueva = pdf.make_indirect(Dictionary(
    Type=Name.Page,
    MediaBox=[0, 0, 612, 792],
    Resources=Dictionary(Font=pdf.pages[4]["/Resources"]["/Font"]),
    Contents=Stream(pdf, b""),
))
pdf.pages.insert(13, pikepdf.Page(nueva))
page14 = pdf.pages[13]

logo = Image.open(f"{W}/logo_transparent.png").convert("RGBA")
foto = Image.open(f"{W}/tzspot_imgs/tzspot_product_cutout.png").convert("RGBA")
cat.add_image(page14, "/ImgLogo", logo, cat.DARK)
cat.add_image(page14, "/ImgProducto", foto, cat.DARK)

SPOT = dict(PRODUCTO, numero_pagina="14")
f14 = [cat.rect(0, 0, 306, 792, cat.WHITE),            # panel blanco a la izquierda
       cat.rect(306, 0, 306, 792, cat.DARK),           # panel oscuro a la derecha
       cat.place("/ImgLogo", 513.84, 743.04, 67.32, 18.0)]

# la ficha en sí, con la geometría del slot superior
pw = 210.0
ph = pw * foto.height / foto.width
f14.append(cat.place("/ImgProducto", TOP.photo_center[0] - pw / 2,
                     TOP.photo_center[1] - ph / 2, pw, ph))
f14.append(cat.show_center(SPOT["codigo"], "/F11", 5.19, TOP.caption_center_x, 484.37,
                           1.596, cat.CAPTION))
f14.append(cat.show(SPOT["titulo"], "/F19", 18.44, TOP.text_x, TOP.title_y, -0.405, cat.TITLE))
f14.append(cat.show(SPOT["subtitulo"], "/F20", 6.34, TOP.text_x, TOP.subtitle_y, 1.895,
                    cat.SUBTITLE))
f14.append(cat.rect(36.72, 708.84, 130.30, 1.44, cat.TITLE))
for i, linea in enumerate(cat.wrap(SPOT["descripcion"], "/F11", 6.92, 0.0,
                                  TOP.value_right - TOP.text_x)):
    f14.append(cat.show(linea, "/F11", 6.92, TOP.text_x, TOP.desc_y - i * TOP.desc_leading,
                        0.0, cat.BODY))
RULES_TOP = [638.46, 624.06, 609.66, 595.26, 580.86, 566.46, 552.06, 537.66, 523.26, 508.86]
for (etiqueta, valor), y, y_line in zip(SPOT["filas"], TOP.row_baselines, RULES_TOP):
    f14.append(cat.show(etiqueta, "/F11", 6.34, TOP.text_x, y, 0.245, cat.LABEL))
    f14.append(cat.show_right(valor, "/F20", 6.34, TOP.value_right, y, 0.0, cat.VALUE))
    f14.append(cat.rule(TOP.text_x - 0.23, TOP.value_right + 0.25, y_line))
f14.append(cat.show(SPOT["codigo"], "/F20", 5.76, TOP.text_x, TOP.code_y, 0.396, cat.VALUE))
f14.append(cat.show(SPOT["subcodigo"], "/F11", 5.19, TOP.text_x, TOP.subcode_y, 0.895,
                    cat.SUBCODE))
f14.append(cat.show(SPOT["pie"], "/F11", 5.76, TOP.text_x, TOP.footer_y, 1.496, cat.FOOTER))
f14 += tab("14")
page14.contents_add(Stream(pdf, ("q\n" + "\n".join(f14) + "\nQ\n").encode("latin-1")))

# ──────────────── renumerar las páginas que corrieron (viejas 14-19) ──────────
# la última página (contacto) no lleva recuadro de numeración en el diseño original
for idx in range(14, 19):
    cat.append(pdf.pages[idx], "\n".join(tab(str(idx + 1))))

cat.save(OUT)
print("guardado", OUT, "-", len(pdf.pages), "páginas")
