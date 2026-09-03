"""Ejemplo completo y funcional: reemplazar una ficha de producto por otra.

Es el script real con el que se reemplazó AR70 LED por SPOT en el catálogo 2026. Para un
producto nuevo suele alcanzar con editar PRODUCTO y las rutas, y correrlo.

    python3 build_product_page.py --pdf CATALOGO.pdf --out CATALOGO_NUEVO.pdf \
        --page 5 --photo producto.png

Después verificá siempre:
    python3 verify_page.py CATALOGO.pdf CATALOGO_NUEVO.pdf --page 5
"""
import argparse

from PIL import Image

from catalog import BOTTOM, Catalog

PRODUCTO = {
    "titulo": "SPOT",
    "subtitulo": "12V MÓVIL 3W",
    "descripcion": "Mini spot móvil de 12V para iluminación decorativa de precisión, "
                   "con base giratoria.",
    "filas": [
        ("Potencia", "3W"),
        ("Color de luz", "3000K"),
        ("Tensión", "DC 12V"),
        ("CRI", "≥80 Ra"),
        ("Flujo luminoso", "240 lm"),
        ("Apertura", "30°"),
        ("Protección", "IP20"),
        ("Material", "Aluminio"),
        ("Color", "Negro"),
        ("Medidas", "Ø25 x 50 mm"),
    ],
    "codigo": "TZ-SPOT12V-3W-NG-3K",
    "subcodigo": "3000K · NEGRO",
    "pie": "PRESENTACIÓN: CAJA INDIVIDUAL",
    "numero_pagina": "5",
}

# Recetas tipográficas leídas del content stream original (analyze_page.py).
# Formato: (recurso de fuente, tamaño efectivo, tracking, color)
ESTILOS = {
    "titulo":    ("/F19", 18.44, -0.405, Catalog.TITLE),
    "subtitulo": ("/F20", 6.34, 1.895, Catalog.SUBTITLE),
    "desc":      ("/F11", 6.92, 0.0, Catalog.BODY),
    "etiqueta":  ("/F11", 6.34, 0.245, Catalog.LABEL),
    "valor":     ("/F20", 6.34, 0.0, Catalog.VALUE),
    "codigo":    ("/F20", 5.76, 0.396, Catalog.VALUE),
    "subcodigo": ("/F11", 5.19, 0.895, Catalog.SUBCODE),
    "pie":       ("/F11", 5.76, 1.496, Catalog.FOOTER),
    "epigrafe":  ("/F11", 5.19, 1.596, Catalog.CAPTION),
    "numero":    ("/F11", 6.34, 0.0, Catalog.WHITE),
}


def build(cat, page, slot, prod, photo_path, photo_width=210.0):
    st = ESTILOS
    f = []

    # 1. Tapar la ficha vieja. El panel oscuro se cubre solo hasta dark_cover para no
    #    pisar el logo TENARUZ, que es vectorial y queda perfecto tal como está.
    f.append(cat.rect(*slot.dark_cover, cat.DARK))
    f.append(cat.rect(*slot.white_panel, cat.WHITE))

    # 2. Panel oscuro: foto del producto + código debajo
    if photo_path:
        photo = Image.open(photo_path).convert("RGBA")
        cat.add_image(page, "/ImgProducto", photo, cat.DARK)
        f.append(cat.place("/ImgProducto", *cat.fit(photo, photo_width, slot.photo_center)))
    res, size, trk, color = st["epigrafe"]
    f.append(cat.show_center(prod["codigo"], res, size, slot.caption_center_x,
                             slot.caption_y, trk, color))

    # 3. Panel blanco: título, subtítulo, barra de acento
    f.append(cat.show(prod["titulo"], *st["titulo"][:2], slot.text_x, slot.title_y,
                      st["titulo"][2], st["titulo"][3]))
    f.append(cat.show(prod["subtitulo"], *st["subtitulo"][:2], slot.text_x, slot.subtitle_y,
                      st["subtitulo"][2], st["subtitulo"][3]))
    f.append(cat.rect(*slot.accent_bar, cat.TITLE))

    # 4. Descripción: se corta sola al ancho de la columna
    res, size, trk, color = st["desc"]
    ancho = slot.value_right - slot.text_x
    lineas = cat.wrap(prod["descripcion"], res, size, trk, ancho)
    if len(lineas) > 3:
        raise SystemExit(f"La descripción ocupa {len(lineas)} renglones; entran 3 como "
                         "máximo antes de chocar con la tabla. Acortala.")
    for i, linea in enumerate(lineas):
        f.append(cat.show(linea, res, size, slot.text_x,
                          slot.desc_y - i * slot.desc_leading, trk, color))

    # 5. Tabla de especificaciones
    if len(prod["filas"]) > len(slot.row_baselines):
        raise SystemExit(f"Hay {len(prod['filas'])} filas y la grilla tiene "
                         f"{len(slot.row_baselines)}.")
    for (etiqueta, valor), y, y_line in zip(prod["filas"], slot.row_baselines,
                                            slot.row_rules):
        f.append(cat.show(etiqueta, *st["etiqueta"][:2], slot.text_x, y,
                          st["etiqueta"][2], st["etiqueta"][3]))
        f.append(cat.show_right(valor, *st["valor"][:2], slot.value_right, y,
                                st["valor"][2], st["valor"][3]))
        f.append(cat.rule(slot.text_x - 0.23, slot.value_right + 0.25, y_line))

    # 6. Código, subcódigo y pie
    f.append(cat.show(prod["codigo"], *st["codigo"][:2], slot.text_x, slot.code_y,
                      st["codigo"][2], st["codigo"][3]))
    f.append(cat.show(prod["subcodigo"], *st["subcodigo"][:2], slot.text_x, slot.subcode_y,
                      st["subcodigo"][2], st["subcodigo"][3]))
    f.append(cat.show(prod["pie"], *st["pie"][:2], slot.text_x, slot.footer_y,
                      st["pie"][2], st["pie"][3]))

    # 7. El recuadro con el número de página quedó tapado por el panel blanco
    f.append(cat.rect(*slot.page_tab, cat.TITLE))
    f.append(cat.show_center(prod["numero_pagina"], *st["numero"][:2],
                             slot.page_num_center, slot.page_num_y,
                             st["numero"][2], st["numero"][3]))
    return "\n".join(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--page", type=int, required=True)
    ap.add_argument("--photo")
    ap.add_argument("--photo-width", type=float, default=210.0)
    args = ap.parse_args()

    cat = Catalog(args.pdf)
    page = cat.pdf.pages[args.page - 1]

    # Los subsets solo traen los glifos ya usados en el documento: mejor enterarse ahora.
    for clave, recurso in (("titulo", "/F19"), ("subtitulo", "/F20"),
                           ("descripcion", "/F11"), ("codigo", "/F20"),
                           ("subcodigo", "/F11"), ("pie", "/F11")):
        faltan = cat.check_glyphs(PRODUCTO[clave], recurso)
        if faltan:
            raise SystemExit(f"{recurso} no tiene los glifos {faltan} que pide "
                             f"{clave!r}. Reformulá el texto.")

    cat.append(page, build(cat, page, BOTTOM, PRODUCTO, args.photo, args.photo_width))
    cat.save(args.out)
    print(f"guardado {args.out}\nVerificá: python3 verify_page.py {args.pdf} {args.out} "
          f"--page {args.page}")


if __name__ == "__main__":
    main()
