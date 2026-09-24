"""Lee una lista de precios TENARUZ (exportada de Excel) a filas estructuradas.

Cada producto ocupa varios renglones: la descripción se parte en dos o tres y el stock
("15 DÍAS") en dos. El renglón que trae el precio es el ancla de la fila; los demás se
asignan al ancla más cercana en vertical, cortando en el punto medio entre anclas. Así no
se mezcla la descripción de un producto con la del siguiente.
"""
import re
import sys

import pdfplumber

CORTES = [("codigo", 0, 205), ("desc", 205, 365), ("bulto", 365, 400),
          ("precio", 400, 450), ("x500", 450, 490), ("iva", 490, 513),
          ("stock", 513, 600)]
SECCIONES = {"LÁMPARAS Y TUBOS LED", "ARTEFACTOS", "FUENTES SWITCHING",
             "ARTEFACTOS DE ILUMINACIÓN"}
ENCABEZADO = {"CÓDIGO", "DESCRIPCIÓN", "BULTO", "PRECIO", "x500", "IVA", "STOCK"}


def columna(x):
    for nom, a, b in CORTES:
        if a <= x < b:
            return nom
    return None


def leer(ruta):
    filas = []
    with pdfplumber.open(ruta) as pdf:
        for pag in pdf.pages:
            bandas = {}
            for w in pag.extract_words():
                if w["top"] > 790:                       # pie "Página N"
                    continue
                bandas.setdefault(round(w["top"] / 3), []).append(w)

            # las secciones y el encabezado marcan dónde empieza cada bloque
            seccion_de = {}
            seccion = None
            for k in sorted(bandas):
                t = " ".join(w["text"] for w in sorted(bandas[k], key=lambda w: w["x0"]))
                if t.strip() in SECCIONES:
                    seccion = t.strip()
                seccion_de[k] = seccion

            anclas = [k for k in sorted(bandas)
                      if any(w["text"] == "USD" and columna((w["x0"] + w["x1"]) / 2) == "precio"
                             for w in bandas[k])]
            if not anclas:
                continue
            cortes = [(anclas[i] + anclas[i + 1]) / 2 for i in range(len(anclas) - 1)]

            def ancla_de(k):
                for i, c in enumerate(cortes):
                    if k < c:
                        return anclas[i]
                return anclas[-1]

            celdas = {a: {} for a in anclas}
            for k in sorted(bandas):
                t = " ".join(w["text"] for w in sorted(bandas[k], key=lambda w: w["x0"]))
                if (t.strip() in SECCIONES or t.startswith("LISTA MAYORISTA")
                        or (set(t.split()) & ENCABEZADO and "USD" not in t)):
                    continue
                a = ancla_de(k)
                titulo = {"LISTA", "MAYORISTA", "2026"} | {m for m in
                         ("ENERO FEBRERO MARZO ABRIL MAYO JUNIO JULIO AGOSTO SEPTIEMBRE "
                          "OCTUBRE NOVIEMBRE DICIEMBRE").split()}
                for w in sorted(bandas[k], key=lambda w: w["x0"]):
                    if w["text"] in titulo and w["top"] < 100:
                        continue
                    c = columna((w["x0"] + w["x1"]) / 2)
                    if c:
                        celdas[a].setdefault(c, []).append(w["text"])

            for a in anclas:
                c = celdas[a]
                filas.append({
                    "seccion": seccion_de[a],
                    "codigo": " ".join(c.get("codigo", [])).strip(),
                    "desc": re.sub(r"\s+", " ", " ".join(c.get("desc", []))).strip(),
                    "bulto": " ".join(c.get("bulto", [])).strip(),
                    "precio": " ".join(c.get("precio", [])).strip(),
                    "x500": " ".join(c.get("x500", [])).strip(),
                    "iva": " ".join(c.get("iva", [])).strip(),
                    "stock": " ".join(c.get("stock", [])).strip(),
                })
    return filas


if __name__ == "__main__":
    for f in leer(sys.argv[1]):
        print(f'{f["codigo"]:22} | {f["desc"][:46]:46} | {f["bulto"]:>4} | '
              f'{f["precio"]:>9} | {f["x500"]:>9} | {f["iva"]:>5} | {f["stock"]}')
