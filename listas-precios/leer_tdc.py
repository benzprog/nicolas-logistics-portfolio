"""Lee la lista del proveedor (exportada de Excel con 'Print To PDF') a filas estructuradas.

La grilla no se deduce del texto sino de los rectángulos finos con los que Excel dibuja los
bordes. Eso importa porque hay celdas combinadas —la foto y la cantidad por bulto abarcan
varias filas— y ahí Excel **no dibuja** el segmento de línea: mirando qué columnas cruza
cada línea se sabe dónde empieza y termina cada celda, sin adivinar.

Tres decisiones que salieron de mirar el archivo:

- **La fila la define la columna de precio, no la de descripción.** Hay descripciones
  combinadas de a dos con un precio por renglón (las BASE REDONDA, por ejemplo): anclando
  en la descripción se juntan dos productos en una fila y se pierde un precio.
- **El código del proveedor y el número de ítem se pisan en x.** El código arranca en x=60,
  fuera de la tabla, y su cola entra en la columna del ítem; el '1' del ítem cae entre dos
  caracteres del código. Lo que sí los separa es la línea de base: vienen de celdas
  distintas de Excel y difieren 0.24 pt. Se agrupan los caracteres por `top` exacto, y el
  grupo que arranca pegado al borde es el código: el número de ítem va centrado en su celda
  y nunca empieza antes de x=85. Hay códigos que además se parten en varios renglones de un
  carácter dentro del margen; ese corte los deja ilegibles y se marcan como rotos en vez de
  recomponerlos a ojo.
- Los códigos **no se ven al imprimir**: quedan tapados por el relleno blanco de la primera
  columna. Están en la capa de texto igual, así que se leen y se devuelven aparte.
"""
import re
import sys
from collections import defaultdict

import pdfplumber

COLS = {"item": (80.6, 104.2), "desc": (104.8, 290.4), "foto": (290.4, 363.1),
        "bulto": (363.1, 426.0), "precio": (426.0, 469.6)}
BORDE_TABLA = 85.0    # el ítem va centrado en su celda; el código desborda pegado a 80.6
TOL = 1.5


def cruces(reglas, x0, x1):
    """Las y en las que una línea cruza esa columna de punta a punta."""
    return sorted(y for y, segs in reglas.items()
                  if any(s0 <= x0 + TOL and s1 >= x1 - TOL for s0, s1 in segs))


def celda(ys, y):
    for a, b in zip(ys, ys[1:]):
        if a - TOL <= y <= b + TOL:
            return a, b
    return None


def texto(palabras, x0, x1, arriba, abajo):
    ws = [w for w in palabras
          if x0 - TOL <= (w["x0"] + w["x1"]) / 2 <= x1 + TOL and arriba - TOL < w["top"] < abajo]
    ws.sort(key=lambda w: (round(w["top"] / 4), w["x0"]))
    return re.sub(r"\s+", " ", " ".join(w["text"] for w in ws)).strip()


def item_y_codigo(chars, arriba, abajo):
    """Separa el número de ítem del código de proveedor por su línea de base."""
    grupos = defaultdict(list)
    for c in chars:
        if c["x0"] < COLS["item"][1] + TOL and arriba - TOL < c["top"] < abajo:
            grupos[round(c["top"], 2)].append(c)
    item, codigo = [], []
    for _, cs in sorted(grupos.items()):
        cs.sort(key=lambda c: c["x0"])
        destino = codigo if cs[0]["x0"] < BORDE_TABLA else item
        destino.append("".join(c["text"] for c in cs).strip())
    return " ".join(item).strip(), " ".join(codigo).strip()


def leer(ruta):
    filas = []
    with pdfplumber.open(ruta) as pdf:
        for n, pag in enumerate(pdf.pages, 1):
            reglas = {}
            for r in pag.rects:
                if r["bottom"] - r["top"] < 3 and r["x1"] - r["x0"] > 1:
                    reglas.setdefault(round(r["top"], 1), []).append((r["x0"], r["x1"]))
            if not reglas:
                continue
            palabras, chars = pag.extract_words(), pag.chars
            ys_precio = cruces(reglas, *COLS["precio"])
            ys_bulto = cruces(reglas, *COLS["bulto"])
            if len(ys_precio) < 3:
                continue

            for arriba, abajo in zip(ys_precio, ys_precio[1:]):
                if abajo - arriba < 3:
                    continue
                pr = texto(palabras, *COLS["precio"], arriba, abajo)
                d = texto(palabras, *COLS["desc"], arriba, abajo)
                it, cod = item_y_codigo(chars, arriba, abajo)
                tramo = celda(ys_bulto, (arriba + abajo) / 2)
                bu = texto(palabras, *COLS["bulto"], *tramo) if tramo else ""
                if not (d or pr):
                    continue
                filas.append({"pagina": n, "y": arriba, "item": it, "codigo": cod,
                              "desc": d, "bulto": bu, "precio": pr})
    return filas


def plata(s):
    m = re.match(r"^\s*\$?\s*([\d][\d.]*)\s*$", (s or "").replace(" ", " ").strip())
    return int(m.group(1).replace(".", "")) if m else None


if __name__ == "__main__":
    fs = leer(sys.argv[1])
    con = [f for f in fs if plata(f["precio"]) is not None]
    print(f"{len(fs)} bandas: {len(con)} con precio, {len(fs)-len(con)} sin precio\n")
    for f in fs:
        marca = " " if plata(f["precio"]) is not None else "·"
        print(f'{marca} p{f["pagina"]} {f["item"]:>5} | {f["desc"][:60]:60} | '
              f'{f["bulto"]:>5} | {f["precio"]:>10} | {f["codigo"][:20]}')
