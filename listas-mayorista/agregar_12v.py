"""Agrega la sección PRODUCTOS 12 VOLTS a la lista mayorista TENARUZ.

Qué hace, en orden:

1. **Página 3** — saca la fila `TZ-SPOT12V-3W-NG-3K` de ARTEFACTOS y sube un
   renglón todo lo que venía debajo, invirtiendo el rayado para que el grupo
   vuelva a arrancar en gris. El hueco que separaba los spots 220V del resto se
   respeta: era un separador de grupo, no un sobrante.
2. **Página 4** — le quita el pie (condiciones, contacto y el botón del catálogo),
   que pasa a ser lo último del documento.
3. **Página 5** — nueva: la sección 12 VOLTS con sus fotos y, debajo, el pie.

No se rehace el documento: se editan los operadores del stream original, de modo
que las cuatro páginas que ya estaban aprobadas quedan intactas salvo en lo que se
toca a propósito. El ida y vuelta del stream se verificó idéntico al pixel.

Nada de lo que se escribe acá se inventa: las medidas salen del propio PDF
(`leer_mayorista.py`) y los datos de producto, de lo que pasó el cliente.
"""
import pathlib
import sys

import pikepdf

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import texto_pdf as T                                        # noqa: E402
from preparar_fotos import preparar                          # noqa: E402

BASE = pathlib.Path(__file__).parent
ORIGEN = BASE / "origen" / "Lista_Mayorista_OCTUBRE.pdf"
CARLITO = pathlib.Path("/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf")
DESTINO = BASE / "Lista_Mayorista_OCTUBRE.pdf"

# ── geometría medida sobre el original ───────────────────────────────────────
TABLA_X, TABLA_W = 109.7, 433.66
FILA_X, FILA_W = 109.7, 405.43                 # fondo de la fila, sin la celda STOCK
STOCK_X, STOCK_W = 515.02, 28.344
ALTO_FILA = 33.48
TECHO = 787.18                                 # borde superior del área de tabla
ALTO_BANDA, ALTO_CABECERA = 27.48, 27.504
BASE_TEXTO = 14.04                             # del piso de la fila a la línea de base
SUBE, BAJA = 5.30, 5.40                        # desplazamiento de las dos líneas
CUERPO = 8.04

CENTRO = {"codigo": 155.80, "desc": 285.35, "bulto": 384.13, "precio": 421.15,
          "x500": 465.94, "iva": 501.72, "stock": 529.19}
ANCHO_DESC = 162.0                             # la línea más larga que ya existe

GRIS = (0.851, 0.851, 0.851)
VERDE_CLARO = (0.0, 1.0, 0.502)                # celda STOCK sobre fila blanca
VERDE_OSCURO = (0.102, 0.847, 0.404)           # celda STOCK sobre fila gris
AMARILLO = (1.0, 1.0, 0.0)
NEGRO = (0.0, 0.0, 0.0)

GUTTER_CENTRO = 80.5                           # columna de fotos, a la izquierda
FOTO_ANCHO, FOTO_ALTO = 52.0, 31.0

R, N = T.REGULAR, T.NEGRITA


class Fila:
    """Una fila de producto de la lista."""

    def __init__(self, codigo, desc, bulto, precio, x500, iva, stock, foto=None):
        self.codigo, self.desc, self.bulto = codigo, desc, bulto
        self.precio, self.x500, self.iva = precio, x500, iva
        self.stock, self.foto = stock, foto

    def falta(self):
        vacios = [c for c, v in (("precio", self.precio), ("x500", self.x500),
                                 ("código", self.codigo), ("bulto", self.bulto),
                                 ("IVA", self.iva), ("stock", self.stock)) if not v]
        return vacios


# ── la sección nueva ─────────────────────────────────────────────────────────
# La primera fila es la que se muda desde ARTEFACTOS, copiada palabra por palabra
# del original (incluidas sus negritas y su foto, /Image47). Las otras cinco son
# los productos nuevos: por ahora van con foto y título, y las celdas de código,
# bulto, precio, x500, IVA y stock quedan vacías para completarlas después. Vacío
# es vacío: no se pone un guion ni un "a confirmar" que después haya que cazar.
#
# Las fotos llegaron renombradas 10 a 13 y se perdieron los nombres que las
# identificaban, así que la asignación sale del orden en que se pidieron los
# productos. Dos de las cuatro se confirman solas por lo que se ve: la 11 es el
# único panel chato y redondo, y la 13 es el único óvalo cromado. Eso respalda que
# las otras dos sigan el mismo orden. Los dos "Redondo" comparten foto porque
# tienen exactamente las mismas medidas: es el mismo artefacto con dos títulos.
SECCION = "PRODUCTOS 12 VOLTS"
VACIO = ""
PRODUCTOS = [
    Fila(codigo="TZ-SPOT12V-3W-NG-3K",
         desc=[[("Spot Cabezal ", R), ("12V", N), (" 3W Aluminio Negro ", R),
                ("3000K", N), (" - ", R)],
               [("25x50mm", R)]],
         bulto="400", precio="USD 4,90", x500="USD 4,70", iva="21%",
         stock=["15 ", "DÍAS"], foto="/Image47"),

    Fila(codigo=VACIO,
         desc=[[("Mini Spot 12V TENARUZ", R)]],
         bulto=VACIO, precio=VACIO, x500=VACIO, iva=VACIO, stock=VACIO,
         foto="10.webp"),

    Fila(codigo=VACIO,
         desc=[[("Spot Panel Led Embutir 12V 3W", R)], [("70 x 58 x 12mm", R)]],
         bulto=VACIO, precio=VACIO, x500=VACIO, iva=VACIO, stock=VACIO,
         foto="11.webp"),

    Fila(codigo=VACIO,
         desc=[[("Mini Spot Panel Led Redondo 12V 1W", R)], [("20 x 25 x 15mm", R)]],
         bulto=VACIO, precio=VACIO, x500=VACIO, iva=VACIO, stock=VACIO,
         foto="12.webp"),

    Fila(codigo=VACIO,
         desc=[[("Mini Spot Panel Led Redondo 12V 1W", R)],
               [("Casa Rodante Motorhome - 20 x 25 x 15mm", R)]],
         bulto=VACIO, precio=VACIO, x500=VACIO, iva=VACIO, stock=VACIO,
         foto="12.webp"),

    Fila(codigo=VACIO,
         desc=[[("Luz Led Cortesía 12V 0,5W", R)], [("6x6x3", R)]],
         bulto=VACIO, precio=VACIO, x500=VACIO, iva=VACIO, stock=VACIO,
         foto="13.webp"),
]


def num(v):
    return T.num(v)


def rect(x, y, w, h, color):
    return b"%s %s %s rg\n%s %s %s %s re\nf*\n" % (
        num(color[0]), num(color[1]), num(color[2]), num(x), num(y), num(w), num(h))


def dibujar_fila(fila, piso, gris_fondo):
    """Operadores de una fila completa: fondo, celda de stock y textos."""
    ops = b""
    if gris_fondo:
        ops += rect(FILA_X, piso, FILA_W, ALTO_FILA, GRIS)
    dos_lineas = len(fila.stock) > 1 if isinstance(fila.stock, list) else False
    if fila.stock:
        color_stock = (AMARILLO if dos_lineas else
                       (VERDE_OSCURO if gris_fondo else VERDE_CLARO))
        ops += rect(STOCK_X, piso, STOCK_W, ALTO_FILA, color_stock)

    base = piso + BASE_TEXTO
    for col in ("codigo", "bulto", "precio", "x500", "iva"):
        valor = getattr(fila, col)
        if valor:
            ops += T.centrado([(valor, R)], CENTRO[col], base, CUERPO)

    lineas = fila.desc
    for texto, y in zip(lineas, alturas(base, len(lineas))):
        ops += T.centrado(texto, CENTRO["desc"], y, CUERPO)

    stock = fila.stock if isinstance(fila.stock, list) else (
        [fila.stock] if fila.stock else [])
    for texto, y in zip(stock, alturas(base, len(stock))):
        ops += T.centrado([(texto, R)], CENTRO["stock"], y, CUERPO)
    return ops


def alturas(base, n):
    """Líneas de base de un bloque de n renglones centrado en la fila."""
    return [base] if n == 1 else [base + SUBE, base - BAJA]


def banda(piso, titulo):
    ops = rect(TABLA_X, piso, TABLA_W, ALTO_BANDA, GRIS)
    ops += T.centrado([(titulo, N)], TABLA_X + TABLA_W / 2, piso + 11.16, 9)
    return ops


def cabecera(piso):
    ops = rect(TABLA_X, piso, TABLA_W, ALTO_CABECERA, NEGRO)
    y = piso + 11.07
    for col, titulo in (("codigo", "CÓDIGO"), ("desc", "DESCRIPCIÓN"),
                        ("bulto", "BULTO"), ("precio", "PRECIO"), ("x500", "x500"),
                        ("iva", "IVA"), ("stock", "STOCK")):
        ops += T.centrado([(titulo, R)], CENTRO[col], y, CUERPO, gris=1.0)
    return ops


# ── edición de los streams que ya existen ────────────────────────────────────
def clasificar_re(ops):
    """Dice de cada `re` si recorta o si pinta; un recorte no se puede mover."""
    tipo = {}
    for i, (_, op) in enumerate(ops):
        if str(op) != "re":
            continue
        for j in range(i + 1, min(i + 8, len(ops))):
            o = str(ops[j][1])
            if o in {"W", "W*"}:
                tipo[i] = "recorte"
                break
            if o in {"f", "f*", "F", "B", "B*", "b", "b*"}:
                tipo[i] = "relleno"
                break
            if o != "re":
                break
        tipo.setdefault(i, "otro")
    return tipo


def numeros(operandos):
    return [float(x) for x in operandos]


def editar(pdf, pagina, *, borrar_y=None, subir_y=None, dy=0.0, borrar_img=(),
           subir_img=(), invertir_stock=False, anular_fondo_y=None, prefijo=b""):
    """Reescribe el stream de una página moviendo, borrando o repintando filas.

    `borrar_y` y `subir_y` son bandas verticales; `dy` es cuánto sube lo que entra
    en `subir_y`. Las fotos van por nombre y no por banda, porque cuelgan fuera de
    su fila (la estaca solar, por ejemplo, baja 70pt por debajo de la suya).
    """
    ops = list(pikepdf.parse_content_stream(pagina.obj))
    tipo = clasificar_re(ops)
    salida, cm_idx, borrando_texto = [], None, False
    clip_idx, clip_movido = None, False
    cuenta = {"borradas": 0, "subidas": 0, "fotos": 0, "textos": 0, "colores": 0}

    def dentro(banda, y):
        return banda is not None and banda[0] <= y < banda[1]

    for i, (operandos, op) in enumerate(ops):
        o = str(op)
        operandos = list(operandos)

        if o == "re":
            x, y, w, h = numeros(operandos)
            fondo_de_fila = abs(x - FILA_X) < 0.5 and abs(w - FILA_W) < 0.5
            if tipo[i] == "relleno":
                if dentro(borrar_y, y) or (dentro(anular_fondo_y, y) and fondo_de_fila):
                    operandos = [0, 0, 0, 0]
                    cuenta["borradas"] += 1
                elif dentro(subir_y, y):
                    operandos = [x, y + dy, w, h]
                    cuenta["subidas"] += 1
                    if invertir_stock and abs(x - STOCK_X) < 0.5:
                        cuenta["colores"] += invertir_color(salida)
            elif tipo[i] == "recorte" and h < 100:
                clip_idx, clip_movido = len(salida), dentro(subir_y, y)
                if clip_movido:
                    operandos = [x, y + dy, w, h]
        elif o == "cm":
            cm_idx = len(salida)
        elif o == "Do":
            nombre = str(operandos[0])
            if nombre in borrar_img:
                cuenta["fotos"] += 1
                continue                        # sin `Do` no se pinta nada
            if nombre in subir_img and cm_idx is not None:
                m = numeros(salida[cm_idx][0])
                m[5] += dy
                salida[cm_idx] = (m, salida[cm_idx][1])
                # cada foto viene con su propio recorte a medida: si no se mueve
                # con ella, la foto aparece cortada (la estaca solar perdía la cabeza)
                if clip_idx is not None and not clip_movido:
                    c = numeros(salida[clip_idx][0])
                    c[1] += dy
                    salida[clip_idx] = (c, salida[clip_idx][1])
                clip_movido = True
        elif o == "Tm":
            m = numeros(operandos)
            borrando_texto = dentro(borrar_y, m[5])
            if dentro(subir_y, m[5]):
                m[5] += dy
                operandos = m
                cuenta["textos"] += 1
        elif o == "ET":
            borrando_texto = False
        elif o in {"Tj", "TJ"} and borrando_texto:
            operandos = [pikepdf.Array([])] if o == "TJ" else [pikepdf.String(b"")]

        salida.append((operandos, op))

    nuevo = prefijo + pikepdf.unparse_content_stream(
        [(pikepdf.Array(o) if isinstance(o, list) else o, p) for o, p in salida])
    pagina.obj["/Contents"] = pdf.make_stream(nuevo)
    return cuenta


def invertir_color(salida):
    """Cambia el verde de la última celda STOCK por el del rayado opuesto."""
    for j in range(len(salida) - 1, max(-1, len(salida) - 6), -1):
        if str(salida[j][1]) == "rg":
            c = tuple(round(float(v), 3) for v in salida[j][0])
            if c == tuple(round(v, 3) for v in VERDE_CLARO):
                salida[j] = (list(VERDE_OSCURO), salida[j][1])
                return 1
            if c == tuple(round(v, 3) for v in VERDE_OSCURO):
                salida[j] = (list(VERDE_CLARO), salida[j][1])
                return 1
            return 0
    return 0


# ── fuentes e imágenes nuevas ────────────────────────────────────────────────
def incrustar_ttf(pdf, ruta, nombre):
    """Incrusta un TTF completo como fuente simple WinAnsi.

    Se usa el Roboto real de Google en vez del subset del Excel porque ese subset
    no trae, por ejemplo, la í de «Cortesía»: su cmap está recortado. Las métricas
    del TTF se verificaron idénticas a las del subset, así que la tipografía de la
    página nueva es la misma que la de las otras cuatro.
    """
    import io

    from fontTools import subset
    from fontTools.ttLib import TTFont

    # se recorta a Latin-1: el Roboto completo son 3387 glifos y el archivo
    # terminaba pesando el triple que el original por tres fuentes enteras
    tt = TTFont(ruta)
    recortador = subset.Subsetter(subset.Options(layout_features=[], notdef_outline=True))
    recortador.populate(unicodes=range(32, 256))
    recortador.subset(tt)
    buffer = io.BytesIO()
    tt.save(buffer)
    datos = buffer.getvalue()
    tt = TTFont(io.BytesIO(datos))
    upem = tt["head"].unitsPerEm
    cmap, hmtx = tt.getBestCmap(), tt["hmtx"]
    anchos = []
    for codigo in range(32, 256):
        ch = bytes([codigo]).decode("cp1252", "replace")
        g = cmap.get(ord(ch))
        anchos.append(round(hmtx[g][0] * 1000 / upem) if g else 0)

    archivo = pikepdf.Stream(pdf, datos)
    archivo.Length1 = len(datos)
    cabeza = tt["head"]
    desc = pikepdf.Dictionary(
        Type=pikepdf.Name.FontDescriptor, FontName=pikepdf.Name("/" + nombre), Flags=32,
        FontBBox=[round(v * 1000 / upem) for v in
                  (cabeza.xMin, cabeza.yMin, cabeza.xMax, cabeza.yMax)],
        ItalicAngle=0, Ascent=round(tt["hhea"].ascent * 1000 / upem),
        Descent=round(tt["hhea"].descent * 1000 / upem),
        CapHeight=round(tt["OS/2"].sCapHeight * 1000 / upem), StemV=80,
        FontFile2=pdf.make_indirect(archivo))
    fuente = pikepdf.Dictionary(
        Type=pikepdf.Name.Font, Subtype=pikepdf.Name.TrueType,
        BaseFont=pikepdf.Name("/" + nombre), FirstChar=32, LastChar=255,
        Widths=anchos, Encoding=pikepdf.Name.WinAnsiEncoding,
        FontDescriptor=pdf.make_indirect(desc))
    return pdf.make_indirect(fuente)


def incrustar_jpg(pdf, ruta):
    from PIL import Image

    im = Image.open(ruta)
    x = pikepdf.Stream(pdf, ruta.read_bytes())
    x.Type, x.Subtype = pikepdf.Name.XObject, pikepdf.Name.Image
    x.Width, x.Height = im.width, im.height
    x.ColorSpace, x.BitsPerComponent = pikepdf.Name.DeviceRGB, 8
    x.Filter = pikepdf.Name.DCTDecode
    return pdf.make_indirect(x)


def pie_de_pagina(modelo_pag4):
    """Reconstruye el pie (condiciones, contacto y botón) en las mismas coordenadas.

    Se vuelve a dibujar en vez de copiarse en crudo porque en el stream original
    está intercalado con la tabla. Las coordenadas, los cuerpos y las negritas son
    las que se leyeron del archivo; no cambia ni una palabra.
    """
    ops = b""
    for r in sorted(modelo_pag4["rellenos"], key=lambda r: -r["y"]):
        if 25 < r["y"] < 419:
            ops += rect(r["x"], r["y"], r["w"], r["h"], r["color"])
    for t in sorted(modelo_pag4["textos"], key=lambda t: -t["y"]):
        if 25 < t["y"] < 419:
            recurso = T.FOLIO if t["fuente"].startswith("Calibri") else (
                N if "Bold" in t["fuente"] else R)
            ops += T.mostrar(t["texto"], t["x"], t["y"], t["cuerpo"], recurso)
    return ops


def filas_de_banda(modelo, y0, y1):
    """Pisos y altos de las filas de una banda, leídos de las celdas de STOCK."""
    filas = [(r["y"], r["h"]) for r in modelo["rellenos"]
             if abs(r["x"] - STOCK_X) < 0.5 and y0 <= r["y"] < y1]
    return sorted(filas, reverse=True)


def construir_pagina5(pdf, modelo_pag4, fotos):
    """Arma la página nueva: sección 12 VOLTS arriba y el pie del documento abajo."""
    piso_banda = TECHO - ALTO_BANDA
    piso_cab = piso_banda - ALTO_CABECERA
    ops = banda(piso_banda, SECCION) + cabecera(piso_cab)

    piso = piso_cab
    for i, fila in enumerate(PRODUCTOS):
        piso -= ALTO_FILA
        ops += dibujar_fila(fila, piso, gris_fondo=(i % 2 == 0))
    ops += rect(TABLA_X, piso - 0.36, TABLA_W, 0.96, NEGRO)

    # las fotos van en la calle de la izquierda, centradas sobre su fila
    piso = piso_cab
    for fila in PRODUCTOS:
        piso -= ALTO_FILA
        if not fila.foto:
            continue
        nombre, ancho, alto = fotos[fila.foto]
        x = GUTTER_CENTRO - ancho / 2
        y = piso + (ALTO_FILA - alto) / 2
        ops += b"q\n%s 0 0 %s %s %s cm\n%s Do\nQ\n" % (
            num(ancho), num(alto), num(x), num(y), nombre.encode("ascii"))

    ops += pie_de_pagina(modelo_pag4)
    ops += T.mostrar("Página 5", 278.21, 16.80, 11.04, T.FOLIO)
    return b"/Artifact BMC\n" + ops + b"EMC\n"


def main():
    from leer_mayorista import leer

    modelo = leer(ORIGEN)
    pdf = pikepdf.open(ORIGEN)

    # El folio y el botón del catálogo están en Calibri, pero el subset que trae
    # el archivo sólo tiene los dígitos 1 a 4: la página 5 saldría con un cuadrito
    # en lugar del número. Se incrusta Carlito, que es el clon métrico de Calibri.
    carlito = incrustar_ttf(pdf, CARLITO, "Carlito")
    T.registrar(T.FOLIO, T.anchos_ttf(CARLITO))

    # ── 1. página 3: sacar la fila 12V y subir un renglón lo que venía debajo
    filas = filas_de_banda(modelo[2], 281.0, 653.0)
    dy = 687.094 - 653.59                      # el alto exacto de la fila que se va
    grises = b"".join(rect(FILA_X, piso + dy, FILA_W, alto, GRIS)
                      for i, (piso, alto) in enumerate(filas) if i % 2 == 0)
    cuenta = editar(
        pdf, pdf.pages[2], borrar_y=(653.0, 688.0), subir_y=(281.0, 653.0), dy=dy,
        anular_fondo_y=(281.0, 653.0), borrar_img={"/Image47"},
        subir_img={"/Image48", "/Image49", "/Image50", "/Image51", "/Image52",
                   "/Image57", "/Image58", "/Image59"},
        invertir_stock=True, prefijo=b"/Artifact BMC\nq\n" + grises + b"Q\nEMC\n")
    print(f"página 3: {cuenta}  (filas corridas: {len(filas)}, grises nuevos: "
          f"{sum(1 for i in range(len(filas)) if i % 2 == 0)})")

    # ── 2. página 4: el pie se va al final del documento
    cuenta = editar(pdf, pdf.pages[3], borrar_y=(25.0, 419.0))
    enlaces = list(pdf.pages[3].obj.get("/Annots", []))
    if "/Annots" in pdf.pages[3].obj:
        del pdf.pages[3].obj["/Annots"]
    print(f"página 4: {cuenta}  (enlaces mudados: {len(enlaces)})")

    # ── 3. página 5
    fuentes = {"/F1": carlito,
               "/F4": incrustar_ttf(pdf, T.FUENTES / "Roboto-Regular.ttf", "Roboto"),
               "/F5": incrustar_ttf(pdf, T.FUENTES / "Roboto-Bold.ttf", "Roboto-Bold")}
    xobjects, fotos = {}, {}
    for fila in PRODUCTOS:
        if not fila.foto:
            continue
        if fila.foto in fotos:
            continue                            # dos filas pueden compartir foto
        if fila.foto.startswith("/Image"):      # foto que ya estaba en el documento
            fuente = pdf.pages[2].obj["/Resources"]["/XObject"][fila.foto]
            xobjects[fila.foto] = fuente
            fotos[fila.foto] = (fila.foto, 42.72, 33.264)
        else:
            ruta, ancho, alto = preparar(fila.foto, FOTO_ANCHO, FOTO_ALTO)
            nombre = "/Foto" + pathlib.Path(ruta).stem.split("_")[0]
            xobjects[nombre] = incrustar_jpg(pdf, ruta)
            fotos[fila.foto] = (nombre, ancho, alto)

    contenido = construir_pagina5(pdf, modelo[3], fotos)
    pagina = pikepdf.Dictionary(
        Type=pikepdf.Name.Page, MediaBox=pdf.pages[3].obj["/MediaBox"],
        Group=pdf.pages[3].obj["/Group"], Tabs=pikepdf.Name.S,
        Contents=pdf.make_stream(contenido),
        Resources=pikepdf.Dictionary(Font=pikepdf.Dictionary(**{k[1:]: v for k, v in fuentes.items()}),
                                     XObject=pikepdf.Dictionary(**{k[1:]: v for k, v in xobjects.items()})))
    if enlaces:
        pagina["/Annots"] = pikepdf.Array(enlaces)
    pdf.pages.append(pikepdf.Page(pdf.make_indirect(pagina)))

    pdf.save(DESTINO)
    print(f"-> {DESTINO} ({len(pdf.pages)} páginas, {DESTINO.stat().st_size // 1024} KB)")
    for fila in PRODUCTOS:
        if fila.falta():
            titulo = " ".join(t for t, _ in fila.desc[0])
            print(f"   pendiente · {titulo}: {', '.join(fila.falta())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
