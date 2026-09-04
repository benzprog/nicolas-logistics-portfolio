"""Reflow completo del catálogo: sin medias páginas vacías (caso real 2026: 20 -> 19).

Sirve de plantilla para reordenar una sección entera. Ajustá SRC/OUT, los PLAN_* y los
números del índice.

Las fichas no se rehacen: cada slot se mueve entero con un Form XObject recortado y
trasladado, así conservan su tipografía, fotos y chips exactamente como estaban. Solo dos
fichas cambian de formato y para esas se traslada el bloque de texto y se recoloca la foto:

  TUBO T5        página completa -> media ficha, emparejado con el BULBO
  ESTACA SOLAR   media ficha     -> página completa (cierra ARTEFACTOS)
"""
import sys

import pikepdf
from pikepdf import Dictionary, Name, Stream

sys.path.insert(0, "/home/user/nicolas-logistics-portfolio/.claude/skills/catalogo-tenaruz/scripts")
from catalog import BOTTOM, TOP, Catalog  # noqa: E402

import simplefont  # noqa: E402

W = "."   # ajustá a la carpeta de trabajo
SRC = f"{W}/output/CATALOGO_TENARUZ_2026_ARTEFACTOS.pdf"
OUT = f"{W}/output/CATALOGO_TENARUZ_2026_REFLOW.pdf"

cat = Catalog(SRC)
pdf = cat.pdf

TAB = (581.04, 1.8, 30.6, 30.6)   # medido sobre una página sin tocar
TAB_CX, TAB_Y = 596.5, 14.61
FULL_SHIFT = 257.02        # del slot inferior al bloque de texto de página completa
CAPTION = ("/F11", 5.19, 1.596)

PANELS = {                 # (x, y, w, h) por slot
    "T": {"white": (0, 396, 306, 396), "dark": (306, 396, 306, 396)},
    "B": {"white": (306, 0, 306, 396), "dark": (0, 0, 306, 396)},
}

# ─────────────────────────── plan de reubicación ──────────────────────────────
# (página nueva) -> {"T": (página origen, slot origen), "B": ...}
PLAN_LAMPARAS = [
    {"T": (4, "T"), "B": (4, "B")},      # DICROICA / MINIDICRO
    {"T": (5, "T"), "B": (6, "T")},      # MR16 / AR111
    {"T": (6, "B"), "B": (7, "T")},      # PLL / PLD
    {"T": (7, "B"), "B": (8, "T")},      # LED STICK / BIPIN COB G4
    {"T": (8, "B"), "B": (9, "T")},      # BIPIN LED G4 / BIPIN COB G9
    {"T": (9, "B"), "B": (10, "T")},     # BIPIN LED G9 / GOTA
    {"T": (10, "B"), "B": "TUBO"},       # BULBO / TUBO T5 (reformateado)
]
PLAN_ARTEFACTOS = [
    {"T": (13, "T"), "B": (13, "B")},    # SPOT FIJO / SPOT MÓVIL
    {"T": (14, "T"), "B": (15, "T")},    # SPOT / SPOT MINI
    {"T": (15, "B"), "B": (16, "T")},    # REFLECTOR / APLIQUE CURVO
    {"T": (16, "B"), "B": (17, "T")},    # APLIQUE RECTO / ESTACA ALUMINIO
    "ESTACA_SOLAR",                      # página completa
]

# ───────────────────────────── infraestructura ────────────────────────────────
forms = {}


def form_for(page_1based):
    if page_1based not in forms:
        f = pikepdf.Page(pdf.pages[page_1based - 1]).as_form_xobject()
        forms[page_1based] = pdf.make_indirect(f)
    return forms[page_1based]


def blank_page(xobjects):
    obj = pdf.make_indirect(Dictionary(
        Type=Name.Page, MediaBox=[0, 0, 612, 792],
        Resources=Dictionary(Font=pdf.pages[4]["/Resources"]["/Font"],
                             XObject=Dictionary(**xobjects)),
        Contents=Stream(pdf, b""),
    ))
    return pikepdf.Page(obj)


def move_panel(src_name, src_slot, dst_slot, which):
    """Dibuja un panel del slot origen en el slot destino, recortado y trasladado."""
    sx, sy, _sw, _sh = PANELS[src_slot][which]
    dx_, dy_, dw, dh = PANELS[dst_slot][which]
    dx, dy = dx_ - sx, dy_ - sy
    out = [f"q {dx_:.3f} {dy_:.3f} {dw:.3f} {dh:.3f} re W n "
           f"1 0 0 1 {dx:.3f} {dy:.3f} cm {src_name} Do Q"]
    # el recuadro de numeración viaja dentro del panel blanco del slot inferior;
    # si el destino no es abajo a la derecha hay que taparlo
    if src_slot == "B" and which == "white" and (dx, dy) != (0, 0):
        # se tapa con margen: algunas páginas traen el recuadro original (y 1.8..32.4)
        # y encima otro repintado antes con otra geometría (y 0..25.2)
        out.append(cat.rect(579.5 + dx, -1 + dy, 34, 36, cat.WHITE))
    return out


def tab(numero):
    return [cat.rect(*TAB, cat.TITLE),
            cat.show_center(numero, "/F11", 6.34, TAB_CX, TAB_Y, 0.0, cat.WHITE)]


def slot_page(spec, numero):
    """Página de dos fichas armada a partir de slots existentes."""
    used, frag = {}, []
    for dst_slot in ("T", "B"):
        src_page, src_slot = spec[dst_slot]
        name = f"/S{src_page}"
        used[name[1:]] = form_for(src_page)
        for which in ("white", "dark"):
            frag += move_panel(name, src_slot, dst_slot, which)
    page = blank_page(used)
    page.contents_add(Stream(pdf, ("q\n" + "\n".join(frag + tab(numero)) + "\nQ\n")
                             .encode("latin-1")))
    return page


# ───────────────── ficha del TUBO T5 reformateada a media página ──────────────
def tubo_bottom_frag():
    """Bloque de texto trasladado desde la página completa + foto recolocada."""
    src = "/S11"
    dx, dy = 306.0, -FULL_SHIFT
    frag = [cat.rect(0, 0, 306, 396, cat.DARK)]
    # texto: el panel blanco de la página 11 cae justo en el panel blanco del slot inferior
    frag.append(f"q 306 0 306 396 re W n 1 0 0 1 {dx:.3f} {dy:.3f} cm {src} Do Q")
    # foto del tubo (imagen original, sin re-comprimir) y logo del slot inferior
    ph = 250.0
    pw = ph * 102 / 992
    frag.append(cat.place("/ImTubo", 153 - pw / 2, 230 - ph / 2, pw, ph))
    frag.append(cat.place("/ImLogo", *BOTTOM.logo_pos))
    frag.append(cat.show_center("TZ-T5-18W-4K", *CAPTION[:2], BOTTOM.caption_center_x,
                                BOTTOM.caption_y, CAPTION[2], cat.CAPTION))
    return frag


# ─────────────── ficha de la ESTACA SOLAR reformateada a página completa ──────
def estaca_full_page(numero):
    """La ficha de la ESTACA SOLAR pasa a página completa.

    Ojo: esta ficha no usa el panel oscuro sino el crema, y su logo es la versión
    oscura. Por eso el logo y la foto se copian del original en vez de recolocarse
    a mano: la foto además está recortada por una máscara del estado gráfico y
    dibujar el JPEG suelto mostraría su fondo.
    """
    src = "/S17"
    frag = [cat.rect(0, 0, 306, 792, cat.WHITE),
            cat.rect(306, 0, 306, 792, cat.CREAM)]
    # bloque de texto, del slot inferior al alto de página completa
    frag.append(f"q 0 {FULL_SHIFT:.3f} 306 396 re W n "
                f"1 0 0 1 -306 {FULL_SHIFT:.3f} cm {src} Do Q")
    frag.append(cat.rect(579.5 - 306, -1 + FULL_SHIFT, 34, 36, cat.WHITE))
    # logo, copiado 1:1 a la posición de página completa
    lx, ly, lw, lh = TOP.logo_pos
    sx, sy = BOTTOM.logo_pos[0], BOTTOM.logo_pos[1]
    frag.append(f"q {lx:.3f} {ly:.3f} {lw:.3f} {lh:.3f} re W n "
                f"1 0 0 1 {lx - sx:.3f} {ly - sy:.3f} cm {src} Do Q")
    # foto, copiada y ampliada (producto medido en x 90.4..215.6, y 73.1..340.6)
    k = 1.75
    tx, ty = 459 - k * 153, 440 - k * 206.8
    frag.append(f"q 306 190 306 490 re W n {k} 0 0 {k} {tx:.3f} {ty:.3f} cm {src} Do Q")
    frag.append(cat.show_center("TZ-SLS007-3K", *CAPTION[:2], 459, 165,
                                CAPTION[2], (109, 109, 109)))
    return frag + tab(numero)


# ────────────────────────────── construcción ──────────────────────────────────
src_xobj_11 = pdf.pages[10]["/Resources"]["/XObject"]
src_xobj_17 = pdf.pages[16]["/Resources"]["/XObject"]
IM_TUBO, IM_ESTACA, IM_LOGO = src_xobj_11["/Im120"], src_xobj_17["/Im177"], src_xobj_11["/Im9"]

nuevas = []
for i, spec in enumerate(PLAN_LAMPARAS):
    numero = str(4 + i)
    if spec["B"] == "TUBO":
        used = {"S10": form_for(10), "S11": form_for(11),
                "ImTubo": IM_TUBO, "ImLogo": IM_LOGO}
        frag = []
        for which in ("white", "dark"):                       # BULBO: 10B -> 10T
            frag += move_panel("/S10", "B", "T", which)
        frag += tubo_bottom_frag()
        page = blank_page(used)
        page.contents_add(Stream(pdf, ("q\n" + "\n".join(frag + tab(numero)) + "\nQ\n")
                                 .encode("latin-1")))
    else:
        page = slot_page(spec, numero)
    nuevas.append(page)

artefactos = []
for i, spec in enumerate(PLAN_ARTEFACTOS):
    numero = str(12 + i)
    if spec == "ESTACA_SOLAR":
        page = blank_page({"S17": form_for(17), "ImEstaca": IM_ESTACA, "ImLogo": IM_LOGO})
        page.contents_add(Stream(pdf, ("q\n" + "\n".join(estaca_full_page(numero)) + "\nQ\n")
                                 .encode("latin-1")))
    else:
        page = slot_page(spec, numero)
    artefactos.append(page)

# orden final: portada, índice, portadilla, lámparas, portadilla, artefactos,
# portadilla fuentes, fuentes, contacto
viejas = list(pdf.pages)
final = ([viejas[0], viejas[1], viejas[2]] + nuevas + [viejas[11]] + artefactos
         + [viejas[17], viejas[18], viejas[19]])
while len(pdf.pages) > 0:
    del pdf.pages[0]
for p in final:
    pdf.pages.append(p)

# renumerar la portadilla de ARTEFACTOS (era 12, sigue 11) y lo que quedó detrás
cat.append(pdf.pages[10], "\n".join(tab("11")))    # portadilla ARTEFACTOS
cat.append(pdf.pages[16], "\n".join(tab("17")))    # portadilla FUENTES
cat.append(pdf.pages[17], "\n".join(tab("18")))    # fuentes switching

# ───────────────────────── índice con la numeración nueva ────────────────────
ROW0, PITCH = 564.95, 24.0
RULE_OFF, RULE_X, NUM_RIGHT = 9.6, (68.04, 543.60), 543.55
HEAD_ARRIBA, HEAD_ABAJO = 36.88, 23.05
IDX_LAMPARAS = [("DICROICA LED GU10 7W", "4"), ("MINIDICRO LED GU10 3W", "4"),
                ("MR16 LED 12V 5W", "5"), ("AR111 LED GU10 15W", "5"),
                ("PLL LED 2G11 18W", "6"), ("PLD LED G24D 9W", "6"),
                ("LED STICK T45 E27 12W", "7"), ("BIPIN COB G4 12V 2W", "7"),
                ("BIPIN LED G4 12V 4W", "8"), ("BIPIN COB G9 220V 3W", "8"),
                ("BIPIN LED G9 220V 6W", "9"), ("GOTA LED E27 5W", "9"),
                ("BULBO LED A60 E27 12W DIMERIZABLE", "10"),
                ("TUBO T5 LED 18W 1149 mm", "10")]
IDX_ARTEFACTOS = [("SPOT FIJO EMBUTIR COB 3W Ø38 mm", "12"),
                  ("SPOT MÓVIL EMBUTIR COB 3W Ø52 mm", "12"),
                  ("SPOT 12V MÓVIL 3W", "13"),
                  ("SPOT MINI EMBUTIR REDONDO PARA MINIDICROICA", "13"),
                  ("REFLECTOR EXTERIOR LED 12V · IP65", "14"),
                  ("APLIQUE CURVO EXTERIOR GU10 · IP65", "14"),
                  ("APLIQUE RECTO EXTERIOR GU10 · IP65", "15"),
                  ("ESTACA ALUMINIO 1 x GU10 · IP67", "15")]


def fila_indice(texto, numero, y):
    return [cat.show(texto, "/F11", 7.49, 68.03, y, 0.0, cat.BODY),
            cat.show_right(numero, "/F11", 6.34, NUM_RIGHT, y, 0.0, (154, 154, 154)),
            cat.rule(RULE_X[0], RULE_X[1], y - RULE_OFF)]


f2 = [cat.rect(60, 0, 500, 506.5, cat.WHITE)]   # de la 4ª fila para abajo
for i, (texto, num) in enumerate(IDX_LAMPARAS):
    if i >= 3:
        f2 += fila_indice(texto, num, ROW0 - i * PITCH)
y_head = ROW0 - (len(IDX_LAMPARAS) - 1) * PITCH - HEAD_ARRIBA
f2.append(cat.show("ARTEFACTOS", "/F20", 6.34, 68.03, y_head, 1.595, cat.BODY))
for i, (texto, num) in enumerate(IDX_ARTEFACTOS):
    f2 += fila_indice(texto, num, y_head - HEAD_ABAJO - i * PITCH)
cat.append(pdf.pages[1], "\n".join(f2))

# ───────────────────────── página de contacto ────────────────────────────────
CONTACTO = ["Ventas · WhatsApp 11-6288-3659",
            "Consultas · WhatsApp 11-4176-4205",
            "panailuminacion@hotmail.com",
            "Lunes a viernes de 9:30 a 16:30 hs"]
WEB = "www.tenaruz.com"
YS = [464.10, 443.93, 423.76, 403.59, 383.42]
GRIS = (210, 210, 210)

contacto = pdf.pages[18]
# la 'w' minúscula no está en ningún subset del catálogo: para la URL se embebe Poppins
res_web, font_web, char_w = simplefont.embed(pdf, f"{W}/fonts/Poppins-Regular.ttf")
contacto["/Resources"]["/Font"][res_web] = font_web

f19 = [cat.rect(0, 374, 612, 104, cat.DARK)]          # borra el bloque viejo
for texto, y in zip(CONTACTO, YS):
    f19.append(cat.show_center(texto, "/F11", 8.07, 306, y, 1.195, GRIS))
f19.append(simplefont.show_center(WEB, res_web, char_w, 8.07, 306, YS[4], 1.195, GRIS))
cat.append(contacto, "\n".join(f19))

cat.save(OUT)
print("guardado", OUT, "-", len(pdf.pages), "páginas")
