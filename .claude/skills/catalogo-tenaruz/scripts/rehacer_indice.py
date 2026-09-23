"""Rehace el índice completo para la paginación con la AR70 de vuelta.

La página venía con tres capas encimadas: el índice original, las correcciones de la
primera edición y las de la segunda, cada una tapando la anterior con un rectángulo. En vez
de sumar una capa más se borra todo el bloque de la lista y se vuelve a dibujar entero.

Ahora lista las 26 fichas: el índice original se quedaba sin lugar y dejaba afuera la
ESTACA SOLAR y las dos fuentes. Con el paso de 24.01 pt no entran, así que el bloque
arranca un poco más arriba, el salto entre secciones se achica y el paso se reparte entre
las filas que hay. Queda en 19.4 pt, que con cuerpo 7.49 sigue siendo cómodo de leer.
"""
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from catalog import Catalog  # noqa: E402

W = "."
SRC, OUT = f"{W}/CATALOGO_TENARUZ_2026.pdf", f"{W}/CATALOGO_TENARUZ_2026_IDX.pdf"

# medido sobre el índice original
X_TITULO = 68.03
X_NUMERO = 543.55          # borde derecho, los números van alineados a la derecha
RULE_X = (68.04, 543.60)
RULE_DY = 9.47             # la divisoria va debajo de cada línea de base
Y_INICIO = 604.00          # línea de base del primer encabezado de sección
Y_FINAL = 24.98            # línea de base de la última fila
SALTO_ENCABEZADO = 23.05   # encabezado -> primera fila
SALTO_SECCION = 32.00      # última fila -> encabezado siguiente

SECCIONES = [
    ("LÁMPARAS Y TUBOS LED", [
        ("DICROICA LED GU10 7W", 4),
        ("MINIDICRO LED GU10 3W", 4),
        ("MR16 LED 12V 5W", 5),
        ("AR70 LED GU10 7W DIMERIZABLE", 5),
        ("AR111 LED GU10 15W", 6),
        ("PLL LED 2G11 18W", 6),
        ("PLD LED G24D 9W", 7),
        ("LED STICK T45 E27 12W", 7),
        ("BIPIN COB G4 12V 2W", 8),
        ("BIPIN LED G4 12V 4W", 8),
        ("BIPIN COB G9 220V 3W", 9),
        ("BIPIN LED G9 220V 6W", 9),
        ("GOTA LED E27 5W", 10),
        ("BULBO LED A60 E27 12W DIMERIZABLE", 10),
        ("TUBO T5 LED 18W 1149 mm", 11),
    ]),
    ("ARTEFACTOS", [
        ("SPOT FIJO EMBUTIR COB 3W Ø38 mm", 13),
        ("SPOT MÓVIL EMBUTIR COB 3W Ø52 mm", 13),
        ("SPOT 12V MÓVIL 3W", 14),
        ("SPOT MINI EMBUTIR REDONDO PARA MINIDICROICA", 14),
        ("REFLECTOR EXTERIOR LED 12V · IP65", 15),
        ("APLIQUE CURVO EXTERIOR GU10 · IP65", 15),
        ("APLIQUE RECTO EXTERIOR GU10 · IP65", 16),
        ("ESTACA ALUMINIO 1 x GU10 · IP67", 16),
        ("ESTACA SOLAR LED 28 LED · IP67", 17),
    ]),
    ("FUENTES SWITCHING", [
        ("FUENTE SWITCHING METÁLICA SLIM 12V", 19),
        ("FUENTE SWITCHING METÁLICA SLIM 24V", 19),
    ]),
]

cat = Catalog(SRC)
pagina = cat.pdf.pages[1]

filas = sum(len(f) for _, f in SECCIONES)
saltos = filas - len(SECCIONES)          # saltos entre filas de una misma sección
fijo = SALTO_ENCABEZADO * len(SECCIONES) + SALTO_SECCION * (len(SECCIONES) - 1)
paso = (Y_INICIO - Y_FINAL - fijo) / saltos
print(f"{filas} filas en {len(SECCIONES)} secciones -> paso {paso:.2f} pt (antes 24.01)")

for texto, res in ([(t, "/F20") for t, _ in SECCIONES]
                   + [(t, "/F11") for _, f in SECCIONES for t, _ in f]):
    faltan = cat.check_glyphs(texto, res)
    if faltan:
        raise SystemExit(f"faltan glifos {faltan} en {res} para {texto!r}")

frag = [cat.rect(60.0, 0.0, 552.0, 606.0, cat.WHITE)]    # borra el bloque entero
y = Y_INICIO
for i, (encabezado, items) in enumerate(SECCIONES):
    if i:
        y -= SALTO_SECCION
    frag.append(cat.show(encabezado, "/F20", 6.34, X_TITULO, y, 1.595, cat.BODY))
    frag.append(cat.rule(*RULE_X, y - RULE_DY))
    y -= SALTO_ENCABEZADO
    for j, (titulo, num) in enumerate(items):
        if j:
            y -= paso
        frag.append(cat.show(titulo, "/F11", 7.49, X_TITULO, y, -0.004, cat.BODY))
        frag.append(cat.show_right(str(num), "/F11", 6.34, X_NUMERO, y, 0.0, (154, 154, 154)))
        frag.append(cat.rule(*RULE_X, y - RULE_DY))
# la tapa llega hasta abajo y se come el recuadro del número de página: se repinta
frag.append(cat.rect(581.04, 1.8, 30.6, 30.6, cat.TITLE))
frag.append(cat.show_center("2", "/F11", 6.34, 596.5, 14.61, 0.0, cat.WHITE))
print(f"última línea de base: {y:.2f} (objetivo {Y_FINAL})")

cat.append(pagina, "\n".join(frag))
cat.save(OUT)
print("guardado", OUT)
