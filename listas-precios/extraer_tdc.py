"""Arma el dataset completo de la lista del proveedor: filas + fotos, listo para maquetar.

Sobre `leer_tdc.py` agrega tres cosas:

- **Clasifica cada banda.** `producto` (tiene precio), `detalle` (renglón de medida o
  terminación, sin precio, que en el original cuelga del producto de arriba) y `rubro`.
  Los rubros no se adivinan por el texto —"ALUMINIO PULIDO" parece un título y no lo es—:
  se reconocen por el **relleno de color** de la banda, que es lo que el proveedor usa para
  marcarlos. Su texto se lee a lo ancho de toda la tabla, porque desborda la columna de
  descripción.
- **Asocia las fotos.** La celda de la foto está combinada sobre varias filas; se calcula
  su tramo con las mismas reglas de la grilla y la foto se cuelga del primer producto del
  tramo, indicando cuántas filas abarca.
- **Exporta las fotos recortadas y apoyadas sobre el fondo de la pieza.** Vienen con borde
  blanco sucio: se recorta el margen y el blanco se reemplaza por el hueso del documento,
  pero **sólo el fondo conectado al borde**. Muchos productos son cromados o blancos y un
  reemplazo de "todo lo casi blanco" les abre agujeros en el medio.

No inventa ni completa nada: una banda sin precio se queda sin precio.
"""
import json
import pathlib
import re
import sys

import numpy as np
import pdfplumber
import pikepdf
from pikepdf import PdfImage
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from leer_tdc import COLS, TOL, celda, cruces, item_y_codigo, plata, texto  # noqa: E402

FOTOS = pathlib.Path("fotos_tdc")
# bandas que son estructura del documento del proveedor, no contenido
DESCARTE = re.compile(r"^(LISTA DE PRECIOS|ITEM|DESCRIPCION|COD CHINA|W\. \+54|DISTRIBUIDORA)", re.I)


HUESO = (240, 238, 230)     # el fondo del documento de PANA


def recortar(pil, fondo=HUESO):
    """Recorta el marco y apoya la foto sobre el fondo del documento.

    Sólo se reemplaza el blanco **conectado al borde**: si se cambiara todo lo casi blanco,
    los productos cromados y los blancos quedarían agujereados por dentro.
    """
    a = np.asarray(pil.convert("RGB")).astype(int)
    # el fondo no siempre es blanco: hay fotos sobre gris o crema. Se toma el color del
    # propio borde como referencia en vez de un umbral fijo.
    marco = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    ref = np.median(marco, axis=0)
    claro = np.abs(a - ref).max(axis=2) <= 16
    if not claro.any() or ref.min() < 150:      # borde oscuro: no hay fondo que sacar
        claro = (a > 232).all(axis=2)

    filas, cols = ~claro.all(axis=1), ~claro.all(axis=0)
    if filas.any() and cols.any():
        ys, xs = np.where(filas)[0], np.where(cols)[0]
        a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        claro = claro[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

    etiq, _ = ndimage.label(claro)
    borde = set(etiq[0]) | set(etiq[-1]) | set(etiq[:, 0]) | set(etiq[:, -1])
    borde.discard(0)
    exterior = np.isin(etiq, list(borde))
    # un desvanecido de un píxel para que el recorte no quede dentado
    alfa = ndimage.gaussian_filter(exterior.astype(float), 0.6)[..., None]
    a = a * (1 - alfa) + np.array(fondo) * alfa
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def extraer(ruta):
    FOTOS.mkdir(exist_ok=True)
    pdf_img = pikepdf.open(ruta)
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
            bandas_color = [(r["top"], r["bottom"]) for r in pag.rects
                            if r["x1"] - r["x0"] > 150 and r["bottom"] - r["top"] > 5
                            and (c := r.get("non_stroking_color")) and c != 1
                            and tuple(c) not in ((1, 1, 1), (1, 1, 0), (0, 0, 0))]
            ys_precio = cruces(reglas, *COLS["precio"])
            ys_bulto = cruces(reglas, *COLS["bulto"])
            ys_foto = cruces(reglas, *COLS["foto"])
            if len(ys_precio) < 3:
                continue

            # las fotos de la página, por el tramo de celda que ocupan
            xobj = pdf_img.pages[n - 1].obj["/Resources"]["/XObject"]
            fotos = {}
            for im in pag.images:
                if not (COLS["foto"][0] - 8 < (im["x0"] + im["x1"]) / 2 < COLS["foto"][1] + 8):
                    continue
                tramo = celda(ys_foto, (im["top"] + im["bottom"]) / 2)
                if tramo:
                    fotos.setdefault(tramo, []).append(im)

            guardadas = {}
            for tramo, ims in fotos.items():
                im = max(ims, key=lambda i: (i["x1"] - i["x0"]) * (i["bottom"] - i["top"]))
                nombre = f"p{n}_{int(tramo[0])}.png"
                try:
                    pil = PdfImage(xobj[pikepdf.Name("/" + im["name"])]).as_pil_image()
                    recortar(pil).save(FOTOS / nombre)
                    guardadas[tramo] = nombre
                except Exception as e:                       # imagen rara: se sigue sin foto
                    print(f"  aviso: {nombre} no se pudo extraer ({e})")

            # los rubros salen de las bandas de color, no de la grilla: alguno cae arriba
            # de la primera línea de la tabla y si no, se perdería
            for t, b in bandas_color:
                dentro = [w for w in palabras if t - 1 < w["top"] < b and w["x0"] > COLS["desc"][0] - 5]
                renglones = {}
                for w in sorted(dentro, key=lambda w: (round(w["top"] / 4), w["x0"])):
                    renglones.setdefault(round(w["top"] / 4), []).append(w["text"])
                for k, ws in sorted(renglones.items()):
                    # el proveedor deja precios ocultos bajo el relleno de estas bandas
                    txt = re.sub(r"\s*\$\s*[\d.]+\s*$", "", " ".join(ws)).strip()
                    if txt:
                        filas.append({"pagina": n, "orden": k * 4, "tipo": "rubro", "item": "",
                                      "desc": txt, "bulto": "", "costo": None,
                                      "foto": "", "abarca": 0})

            for arriba, abajo in zip(ys_precio, ys_precio[1:]):
                if abajo - arriba < 3:
                    continue
                d = texto(palabras, *COLS["desc"], arriba, abajo)
                pr = texto(palabras, *COLS["precio"], arriba, abajo)
                it, cod = item_y_codigo(chars, arriba, abajo)
                if not (d or pr) or DESCARTE.match(d):
                    continue

                medio = (arriba + abajo) / 2
                if any(t - 1 < medio < b + 1 for t, b in bandas_color):
                    continue                      # ya se emitió como rubro más arriba

                tb = celda(ys_bulto, (arriba + abajo) / 2)
                bu = texto(palabras, *COLS["bulto"], *tb) if tb else ""
                tf = celda(ys_foto, (arriba + abajo) / 2)
                monto = plata(pr)

                # el proveedor marca "REEMP. 47A" en vez de precio: discontinuado. Se
                # conserva marcado —y no se le inventa precio— para poder sacarlo junto con
                # sus renglones de detalle, que si no quedan colgando.
                if re.search(r"REEMP", pr, re.I):
                    tipo = "descontinuado"
                else:
                    tipo = "producto" if monto is not None else "detalle"

                filas.append({"pagina": n, "orden": arriba, "tipo": tipo, "item": it, "desc": d,
                              "bulto": bu, "costo": monto,
                              "celda": f"p{n}_{int(tf[0])}" if tf else "",
                              "foto": guardadas.get(tf, "")})
    filas.sort(key=lambda f: (f["pagina"], f["orden"]))
    return filas


if __name__ == "__main__":
    fs = extraer(sys.argv[1])
    pathlib.Path("tdc_datos.json").write_text(
        json.dumps(fs, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    c = Counter(f["tipo"] for f in fs)
    print("bandas por tipo:", dict(c))
    print("fotos asociadas :", sum(1 for f in fs if f["foto"]))
    print("archivos de foto:", len(list(FOTOS.glob('*.png'))))
    print("suma de costos  :", f"{sum(f['costo'] for f in fs if f['costo']):,}".replace(",", "."))
