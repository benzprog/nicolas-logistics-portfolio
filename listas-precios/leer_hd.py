"""Lee la lista de precios TENARUZ HD a filas estructuradas.

La arma wkhtmltopdf y no tiene grilla dibujada, así que las filas se reconocen por tipografía
y posición, que es lo estable:

- **variante**: el renglón que trae un SKU `TZ-HD-…`, su descripción de color y el precio.
  Se chequea primero porque el SKU también va en negrita y si no se confunde con un título.
- **sección** (LUMINARIAS EN 3D, ACCESORIOS…): Poppins-Bold sobre el margen izquierdo.
- **producto** (AURA, HALO…): Poppins-Bold indentado en la columna de contenido.

Una misma descripción de producto puede tener varias variantes; cada una es una fila.
"""
import re
import sys

import pdfplumber

X_CONTENIDO = 120.0        # a la izquierda de esto viven los títulos de sección
SKU = re.compile(r"TZ-HD-[A-Z0-9.\-]+")


def renglones(pag, tol=3.0):
    """Agrupa por cercanía y no por casilleros fijos.

    El SKU va en negrita y su línea de base queda 0.37 pt más abajo que el resto del
    renglón. Redondeando a un casillero fijo caen en dos grupos distintos y el precio se
    separa de su SKU.
    """
    ws = sorted(pag.extract_words(extra_attrs=["fontname", "size"]), key=lambda w: w["top"])
    grupo = []
    for w in ws:
        if grupo and w["top"] - grupo[0]["top"] > tol:
            g = sorted(grupo, key=lambda w: w["x0"])
            yield g, " ".join(x["text"] for x in g)
            grupo = []
        grupo.append(w)
    if grupo:
        g = sorted(grupo, key=lambda w: w["x0"])
        yield g, " ".join(x["text"] for x in g)


def leer(ruta):
    filas, seccion, producto, desc = [], "", "", []
    with pdfplumber.open(ruta) as pdf:
        for n, pag in enumerate(pdf.pages, 1):
            for ws, texto in renglones(pag):
                t = texto.strip()
                if not t or t.startswith("LISTA DE PRECIOS") or re.fullmatch(r"[A-Z ]{6,}\d{4}", t):
                    continue
                negrita = all("Bold" in w["fontname"] for w in ws)
                izq = ws[0]["x0"]

                if (m := SKU.search(t)):
                    resto = t[m.end():].strip()
                    precio = re.search(r"([\d.]+)\s*$", resto)
                    filas.append({
                        "pagina": n, "seccion": seccion, "producto": producto,
                        "sku": m.group(0),
                        "variante": resto[:precio.start()].strip() if precio else resto,
                        "precio": precio.group(1) if precio else "",
                        "descripcion": " ".join(desc),
                    })
                elif negrita and izq < X_CONTENIDO:
                    seccion, producto, desc = t, "", []
                elif negrita:
                    producto, desc = t, []            # empieza un producto nuevo
                elif producto:
                    desc.append(t)
    return filas


if __name__ == "__main__":
    fs = leer(sys.argv[1])
    print(f"{len(fs)} variantes\n")
    for f in fs:
        print(f'p{f["pagina"]:>2} {f["seccion"][:22]:22} | {f["producto"][:12]:12} | '
              f'{f["sku"]:20} | {f["variante"][:40]:40} | {f["precio"]:>9}')
