"""Lee la lista mayorista TENARUZ (export de Excel) y la convierte en un modelo de datos.

El PDF no se puede editar a mano: las filas son rectángulos sueltos, las fotos van
flotando por encima y el pie de página vive mezclado con la última tabla. Pero el
stream es extremadamente regular, así que en lugar de adivinar se lee:

- cada relleno `re f*` con su color,
- cada foto con su matriz `cm` exacta,
- cada corrida de texto con su `Tm`, su fuente y su cuerpo.

Con eso se arma una tabla de filas (código, descripción, bulto, precio, x500, IVA,
stock) que después se vuelve a componer. Nada se estima: las coordenadas salen del
propio archivo.
"""
import json
import pathlib
import re
import sys

import pikepdf

COLUMNAS = {            # x0 de cada columna, medido en el stream
    "codigo": 109.7,
    "desc": 269.0,
    "bulto": 441.0,
    "precio": 466.0,
    "x500": 497.0,
    "iva": 0.0,
    "stock": 515.02,
}


def decodificar(obj, fuentes):
    """Devuelve los tokens del stream: rellenos, imágenes y corridas de texto."""
    rellenos, imagenes, textos = [], [], []
    color = (0, 0, 0)
    ctm = [1, 0, 0, 1, 0, 0]
    pila = []
    tm = None
    fuente = cuerpo = None
    piezas = []

    def mul(a, b):
        return [a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3],
                a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3],
                a[4]*b[0]+a[5]*b[2]+b[4], a[4]*b[1]+a[5]*b[3]+b[5]]

    for operandos, op in pikepdf.parse_content_stream(obj):
        o = str(op)
        v = [float(x) for x in operandos if isinstance(x, (int, float, pikepdf.Object))
             and not isinstance(x, (pikepdf.Name, pikepdf.String))] if o in {
                 "re", "cm", "rg", "g", "Tm", "Tf", "Td", "TL"} else None
        if o == "q":
            pila.append((list(ctm), color))
        elif o == "Q" and pila:
            ctm, color = pila.pop()
            ctm = list(ctm)
        elif o == "cm":
            ctm = mul([float(x) for x in operandos], ctm)
        elif o == "rg":
            color = tuple(round(float(x), 4) for x in operandos)
        elif o == "g":
            gr = round(float(operandos[0]), 4)
            color = (gr, gr, gr)
        elif o == "re":
            x, y, w, h = (float(n) for n in operandos)
            rellenos.append({"x": x, "y": y, "w": w, "h": h, "color": color, "pintado": False})
        elif o in {"f", "f*", "F"}:
            for r in rellenos:
                if not r["pintado"]:
                    r["pintado"] = True
                    r["color"] = color
        elif o in {"W", "W*", "n"}:
            # recorte: descarta el rectángulo que acaba de entrar sin pintar
            while rellenos and not rellenos[-1]["pintado"]:
                rellenos.pop()
        elif o == "Do":
            imagenes.append({"nombre": str(operandos[0]), "x": ctm[4], "y": ctm[5],
                             "w": ctm[0], "h": ctm[3]})
        elif o == "BT":
            tm = [1, 0, 0, 1, 0, 0]
        elif o == "Tf":
            fuente, cuerpo = str(operandos[0]), float(operandos[1])
        elif o == "Tm":
            tm = [float(x) for x in operandos]
        elif o == "Td" and tm:
            tm = mul([1, 0, 0, 1, float(operandos[0]), float(operandos[1])], tm)
        elif o in {"Tj", "TJ"} and tm:
            txt = ""
            partes = operandos[0] if o == "TJ" else [operandos[0]]
            for p in partes:
                if isinstance(p, pikepdf.String):
                    txt += bytes(p).decode("cp1252", "replace")
            if txt.strip():
                piezas.append({"x": round(tm[4], 2), "y": round(tm[5], 2),
                               "fuente": fuentes.get(fuente, fuente),
                               "cuerpo": round(cuerpo * tm[0], 2), "texto": txt})
        elif o == "ET":
            textos.extend(piezas)
            piezas = []
            tm = None
    return [r for r in rellenos if r["pintado"]], imagenes, textos


def leer(ruta):
    pdf = pikepdf.open(ruta)
    paginas = []
    for pag in pdf.pages:
        fuentes = {str(k): str(v.get("/BaseFont")).split("+")[-1]
                   for k, v in pag.obj["/Resources"]["/Font"].items()}
        r, i, t = decodificar(pag.obj, fuentes)
        paginas.append({"rellenos": r, "imagenes": i, "textos": t})
    return paginas


if __name__ == "__main__":
    ruta = sys.argv[1]
    paginas = leer(ruta)
    salida = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
    for n, p in enumerate(paginas, 1):
        print(f"--- página {n}: {len(p['rellenos'])} rellenos, "
              f"{len(p['imagenes'])} fotos, {len(p['textos'])} textos")
    if salida:
        salida.write_text(json.dumps(paginas, ensure_ascii=False, indent=1))
        print("->", salida)
