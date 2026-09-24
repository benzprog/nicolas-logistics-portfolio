"""Lote de correcciones de contenido sobre el catálogo 2026.

Todo se resuelve tapando el bloque viejo y volviendo a componer con las mismas fuentes,
cuerpos, trackings y colores que usa el resto del documento. Las coordenadas salen de la
grilla de `catalog.py`, que está verificada contra las páginas originales.

Las páginas 4 a 11 tienen el texto nativo; de la 13 en adelante vive dentro de Form
XObjects, pero como acá se dibuja por encima a nivel de página, el procedimiento es el
mismo.
"""
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
sys.path.insert(0, ".")
from catalog import BOTTOM, Catalog, TOP  # noqa: E402

W = "."
SRC, OUT = f"{W}/CATALOGO_TENARUZ_2026.pdf", f"{W}/CATALOGO_LOTE.pdf"

ANCHO = 232.3              # ancho de columna del panel blanco
CUERPO_DESC = 6.92
TRACK_DESC = -0.0035
RULE_X = {"TOP": (36.72, 269.28), "BOTTOM": (342.72, 575.28)}

cat = Catalog(SRC)


def slot(nombre):
    return TOP if nombre == "TOP" else BOTTOM


def revisar(texto, res="/F11"):
    faltan = cat.check_glyphs(texto, res)
    if faltan:
        raise SystemExit(f"faltan glifos {faltan} en {texto!r} ({res})")


# ─── descripciones ────────────────────────────────────────────────────────────
def descripcion(pag, nom, texto, viejas, desc_y=None, text_x=None):
    S = slot(nom)
    x = S.text_x if text_x is None else text_x
    y = S.desc_y if desc_y is None else desc_y
    lineas = cat.wrap(texto, "/F11", CUERPO_DESC, TRACK_DESC, ANCHO)
    tope = 4 if nom == "TOP" else 3
    if len(lineas) > tope:
        raise SystemExit(f"pág {pag}/{nom}: {len(lineas)} renglones, entran {tope}")
    for t in lineas:
        revisar(t)
    alto = max(viejas, len(lineas)) * S.desc_leading
    frag = [cat.rect(x - 2.5, y - alto + S.desc_leading - 3.2, ANCHO + 5, alto + 5.5, cat.WHITE)]
    for i, t in enumerate(lineas):
        frag.append(cat.show(t, "/F11", CUERPO_DESC, x, y - i * S.desc_leading,
                             TRACK_DESC, cat.BODY))
    print(f"  pág {pag} {nom}: descripción, {len(lineas)} renglones")
    return frag


# ─── tabla de especificaciones ────────────────────────────────────────────────
def tabla(pag, nom, filas, viejas):
    S = slot(nom)
    x0, x1 = RULE_X[nom]
    tope = S.row_baselines[len(filas) - 1] if filas else S.row_baselines[0]
    borde = S.row_rules[max(len(filas), viejas) - 1]
    frag = [cat.rect(x0 - 1, borde - 4, x1 - x0 + 2,
                     S.row_baselines[0] - borde + 11, cat.WHITE)]
    for i, (etiqueta, valor) in enumerate(filas):
        revisar(etiqueta); revisar(valor, "/F20")
        y = S.row_baselines[i]
        frag.append(cat.show(etiqueta, "/F11", 6.34, S.text_x, y, 0.245, cat.LABEL))
        frag.append(cat.show_right(valor, "/F20", 6.34, S.value_right, y, -0.003, cat.VALUE))
        frag.append(cat.rule(x0, x1, S.row_rules[i]))
    print(f"  pág {pag} {nom}: tabla de {len(filas)} filas (antes {viejas})")
    return frag


# ─── línea suelta (valor de una fila, código, pie) ────────────────────────────
def linea(pag, texto, res, cuerpo, x, y, trk, color, tapa, derecha=False):
    revisar(texto, res)
    frag = [cat.rect(*tapa, cat.WHITE)]
    dibujo = cat.show_right if derecha else cat.show
    frag.append(dibujo(texto, res, cuerpo, x, y, trk, color))
    print(f"  pág {pag}: {texto!r}")
    return frag


def tapar(pag, tapa, detalle=""):
    print(f"  pág {pag}: tapado {detalle}")
    return [cat.rect(*tapa, cat.WHITE)]


# ══════════════════════════════════════════════════════════════════════════════
# La ficha fluye: la tabla arranca después de la descripción y los códigos van
# 24.78 pt debajo de la última fila. Por eso el LED STICK, que tiene tres
# renglones de descripción, lleva toda la tabla 10.95 pt más abajo que la grilla
# estándar, y al pasar de 4 a 10 filas hay que bajar también sus códigos.
DESPLAZADA = -10.95
CODIGO_BAJO_TABLA = 24.78
SUBCODIGO = 9.22

LED_STICK = [
    ("Potencia", "12W"), ("Rosca", "E27"), ("Temperatura", "6000K"),
    ("Flujo luminoso", "950 lm"), ("Apertura", "270°"), ("Vida útil", "14.999 hs"),
    ("Corriente", "74 mA"), ("Tensión", "220V ~50/60Hz"), ("Dimerizable", "NO"),
    ("Medidas", "130 x Ø45 mm"),
]
BULBO_A60 = [
    ("Potencia", "12W"), ("Rosca", "E27"), ("Temperatura", "3000K"),
    ("Flujo luminoso", "1100 lm"), ("Apertura", "270°"), ("Vida útil", "14.999 hs"),
    ("Corriente", "74 mA"), ("Tensión", "220V ~50/60Hz"), ("Dimerizable", "SÍ"),
    ("Medidas", "120 x Ø60 mm"),
]

paginas = {}


def agregar(pag, frag):
    paginas.setdefault(pag, []).extend(frag)


print("descripciones")
agregar(4, descripcion(4, "TOP",
    "Dicroica LED de alta potencia, reemplazo directo de la halógena de 50W. "
    "Con lente que evita encandilamiento.", 3))
agregar(4, descripcion(4, "BOTTOM",
    "Reemplaza a la minidicroica halógena y sirve para instalaciones nuevas. "
    "Ideal para uso decorativo e iluminación puntual.", 2))
agregar(5, descripcion(5, "TOP",
    "Reemplazo de la dicroica halógena de 12V. Funciona con corriente alterna y continua, "
    "apta para instalaciones a 12V. (paneles solares, embarcaciones, motorhome)", 3))
agregar(6, descripcion(6, "BOTTOM",
    "Reemplazo directo de la Dulux Fluorescente de 36W, con conexión directa a 220V. "
    "Zócalo 2G11 de cuatro pines y cuerpo de vidrio opalino.", 2))
agregar(8, descripcion(8, "TOP",
    "Reemplaza una halógena con tamaño reducido de 12V 20W. "
    "Es apto para artefactos pequeños.", 3))
agregar(8, descripcion(8, "BOTTOM",
    "Reemplazo de las halógenas de 12V 50W. Sistema No Flicker, que elimina el parpadeo "
    "molesto de algunas lámparas LED.", 2))
agregar(9, descripcion(9, "TOP",
    "El LED COB da una luz más uniforme. Reemplaza una halógena de 30W en un tamaño "
    "similar al de la halógena tradicional.", 2))
agregar(9, descripcion(9, "BOTTOM",
    "El G9 de 6W SMD es un clásico: el reemplazo natural del G9 de 50W, tan difundido "
    "en Argentina.", 2))
agregar(14, descripcion(14, "TOP",
    "Mini cabezal orientable de 12V para iluminación decorativa de precisión, "
    "con articulación.", 2))
agregar(14, descripcion(14, "BOTTOM",
    "Embutido de tamaño reducido, aro orientable, antideslumbrante recedido apto para "
    "lámpara intercambiable. Para uso residencial y comercial donde se busca confort visual.", 3))
agregar(16, descripcion(16, "TOP",
    "Línea de apliques de exterior GU10, ideal para fachadas. Al ser de aluminio son aptas "
    "para intemperie y la lámpara se reemplaza con facilidad. Con certificación nacional "
    "e internacional.", 3))
# la ESTACA SOLAR está en una página de ficha única: el bloque va más arriba
agregar(17, descripcion(17, "TOP",
    "Estaca solar autónoma, no necesita conexión a 220V. Cuerpo en ABS+PC apto intemperie, "
    "para jardines, senderos y canteros.", 2, desc_y=550.72))
for nom, v in (("TOP", "12V"), ("BOTTOM", "24V")):
    agregar(19, descripcion(19, nom,
        f"Fuente metálica slim con bornera apta para tiras LED y luminarias de {v}. "
        "Cuerpo compacto compatible con perfiles y cielorrasos.", 2))

print("tablas técnicas")
S = BOTTOM
agregar(7, [cat.rect(341.7, 108.0, 235.0, 148.0, cat.WHITE)])      # tabla + códigos viejos
for i, (etiqueta, valor) in enumerate(LED_STICK):
    y = S.row_baselines[i] + DESPLAZADA
    agregar(7, [cat.show(etiqueta, "/F11", 6.34, S.text_x, y, 0.245, cat.LABEL),
                cat.show_right(valor, "/F20", 6.34, S.value_right, y, -0.003, cat.VALUE),
                cat.rule(*RULE_X["BOTTOM"], S.row_rules[i] + DESPLAZADA)])
y_cod = S.row_baselines[9] + DESPLAZADA - CODIGO_BAJO_TABLA
agregar(7, [cat.show("TZ-STICKE27-12W-6K", "/F20", 5.76, S.text_x, y_cod, 0.396, cat.TITLE),
            cat.show("6000K FRÍO", "/F11", 5.19, S.text_x, y_cod - SUBCODIGO, 0.894, cat.SUBCODE)])
print(f"  pág 7 BOTTOM: tabla de 10 filas, códigos a y={y_cod:.2f}")

agregar(10, [cat.rect(341.7, 120.0, 235.0, 145.0, cat.WHITE)])
for i, (etiqueta, valor) in enumerate(BULBO_A60):
    y = S.row_baselines[i]
    agregar(10, [cat.show(etiqueta, "/F11", 6.34, S.text_x, y, 0.245, cat.LABEL),
                 cat.show_right(valor, "/F20", 6.34, S.value_right, y, -0.003, cat.VALUE),
                 cat.rule(*RULE_X["BOTTOM"], S.row_rules[i])])
agregar(10, [cat.show("TZ-A60E27-12W-DIM-3K", "/F20", 5.76, S.text_x, S.code_y, 0.396, cat.TITLE),
             cat.show("3000K DIMERIZABLE", "/F11", 5.19, S.text_x, S.subcode_y, 0.895, cat.SUBCODE)])
print("  pág 10 BOTTOM: tabla de 10 filas, códigos en la grilla estándar")

print("carteles que salen")
agregar(7, tapar(7, (341.7, 25.0, 235.0, 11.5), "FICHA TÉCNICA AMPLIADA A CONFIRMAR"))
agregar(10, tapar(10, (341.7, 25.0, 235.0, 11.5), "FICHA TÉCNICA AMPLIADA A CONFIRMAR"))
agregar(11, tapar(11, (34.0, 288.0, 80.0, 20.0), "LIQUIDACIÓN"))

cat_frag = paginas


print("apliques")
# El pie del catálogo lleva mucho tracking, así que las dos cantidades no entran en un
# renglón. Se parte en dos, como ya hace la ficha del LED STICK: el segundo renglón va
# 12.67 pt debajo del primero.
PIE_APLIQUE = ("BULTO CERRADO UNIDIRECCIONAL x 24", "BULTO CERRADO BIDIRECCIONAL x 20")
SALTO_PIE = 12.67
PIE_SPOTMINI = ("BULTO CERRADO x 100", "PRESENTACIÓN: CAJA INDIVIDUAL, SIN ZÓCALO")
for t in PIE_APLIQUE + PIE_SPOTMINI:
    ancho = cat.advance(t, "/F11", 5.76, 1.496)
    if ancho > ANCHO:
        raise SystemExit(f"el pie no entra ({ancho:.1f} > {ANCHO}): {t!r}")
    print(f"  pie de {ancho:6.1f} pt: {t}")


def pie_doble(pag, S, textos, x_tapa):
    """Pie de dos renglones: el primero sube un escalón y el segundo ocupa su lugar."""
    frag = [cat.rect(x_tapa, S.footer_y - 3.0, 235.0, SALTO_PIE + 11.0, cat.WHITE)]
    for i, t in enumerate(textos):
        frag.append(cat.show(t, "/F11", 5.76, S.text_x, S.footer_y + (1 - i) * SALTO_PIE,
                             1.496, cat.FOOTER))
    print(f"  pág {pag}: pie en dos renglones")
    return frag

# APLIQUE CURVO — slot inferior de la pág 15.
# Esta ficha tiene tres renglones de descripción, así que la tabla y los códigos bajan un
# escalón respecto de la grilla estándar. Medido sobre la página: primera fila en 247.89 y
# códigos en 107.36, contra 258.95 y 103.93 del slot sin correr.
B = BOTTOM
FILA0_P15, CODIGO_P15 = 247.89, 107.36
agregar(15, linea(15, "1x7W / 2x7W", "/F20", 6.34, B.value_right, FILA0_P15, -0.003,
                  cat.VALUE, (500.0, FILA0_P15 - 2.5, 76.0, 9.5), derecha=True))
agregar(15, linea(15, "TZ-K2CURVN-2GU10", "/F20", 5.76, 458.97, CODIGO_P15, 0.396,
                  cat.TITLE, (457.0, CODIGO_P15 - 2.2, 118.0, 9.0)))
agregar(15, [cat.rect(108.0, 72.5, 90.0, 8.5, cat.CREAM),
             cat.show_center("TZ-K2CURVN-2GU10", "/F11", 5.19, 152.1, 75.24, 0.896, (109, 109, 109))])
print("  pág 15: leyenda de la foto -> TZ-K2CURVN-2GU10")
agregar(15, pie_doble(15, B, PIE_APLIQUE, 341.7))

# APLIQUE RECTO — slot superior de la pág 16
T = TOP
agregar(16, linea(16, "1x7W / 2x7W", "/F20", 6.34, T.value_right, T.row_baselines[0], -0.003,
                  cat.VALUE, (194.0, T.row_baselines[0] - 2.5, 76.0, 9.5), derecha=True))
agregar(16, pie_doble(16, T, PIE_APLIQUE, 35.7))

# SPOT MINI EMBUTIR — pie con la presentación
agregar(14, pie_doble(14, B, PIE_SPOTMINI, 341.7))

for pag, frag in sorted(paginas.items()):
    cat.append(cat.pdf.pages[pag - 1], "\n".join(frag))
cat.save(OUT)
print("\nguardado", OUT)
