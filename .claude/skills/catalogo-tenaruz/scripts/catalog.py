"""Primitivas para dibujar contenido nativo sobre el catálogo TENARUZ.

Todo se emite en coordenadas de página (origen abajo a la izquierda, 612x792 pt) usando las
fuentes ya embebidas en el PDF, así el texto nuevo es indistinguible del original.
"""
import io
from dataclasses import dataclass, field

import pikepdf
from pikepdf import Dictionary, Name, Stream

from pdftext import encode, load_fonts, missing_glyphs

PAGE_W, PAGE_H = 612.0, 792.0
PANEL_INSET = 36.84  # margen del contenido respecto de los bordes del panel


@dataclass(frozen=True)
class Slot:
    """Geometría de una de las dos fichas de producto que entran por página.

    Los valores son los medidos sobre la página 5 del catálogo 2026. Para otra página,
    confirmalos con analyze_page.py: la grilla varía sutilmente entre páginas.
    """
    name: str
    dark_panel: tuple      # (x, y, w, h) del panel oscuro
    white_panel: tuple     # (x, y, w, h) del panel blanco
    dark_cover: tuple      # zona del panel oscuro que se puede tapar sin comerse el logo
    text_x: float          # borde izquierdo del texto en el panel blanco
    value_right: float     # borde derecho al que se alinean los valores de la tabla
    title_y: float
    subtitle_y: float
    accent_bar: tuple      # (x, y, w, h) de la barra bajo el subtítulo
    desc_y: float          # línea de base del primer renglón de la descripción
    desc_leading: float
    row_baselines: list
    row_rules: list
    code_y: float
    subcode_y: float
    caption_center_x: float
    caption_y: float
    footer_y: float
    logo_pos: tuple         # (x, y, w, h) del logo TENARUZ en el panel oscuro
    photo_center: tuple = (153.0, 196.0)
    page_tab: tuple = (581.04, 1.8, 30.6, 30.6)   # cuadrado, medido en una página sin tocar
    page_num_center: float = 596.5      # el número va centrado en el recuadro
    page_num_y: float = 14.61


BOTTOM = Slot(
    name="inferior",
    dark_panel=(0, 0, 306, 396),
    white_panel=(306, 0, 306, 396),
    dark_cover=(0, 0, 306, 340),      # el logo vive en y 347-365: no lo toques
    text_x=342.83,
    value_right=575.15,
    title_y=343.66,
    subtitle_y=326.37,
    accent_bar=(342.72, 312.48, 129.96, 1.08),
    desc_y=294.10,
    desc_leading=10.95,
    row_baselines=[258.95, 244.54, 229.56, 215.15, 200.75,
                   186.34, 171.93, 157.53, 143.12, 128.71],
    row_rules=[253.44, 239.04, 224.64, 210.24, 195.84,
               181.44, 167.04, 152.64, 138.24, 123.84],
    code_y=103.93,
    subcode_y=94.14,
    caption_center_x=153.0,
    caption_y=88.37,
    footer_y=30.75,
    logo_pos=(207.72, 347.04, 67.32, 18.0),
)

# La mitad superior espeja los paneles: blanco a la izquierda, oscuro a la derecha.
# Medido sobre la ficha MR16 de la página 5 y verificado píxel a píxel al construir la
# página del SPOT: líneas de tabla, etiquetas y logo caen exactamente donde el original.
TOP = Slot(
    name="superior",
    dark_panel=(306, 396, 306, 396),
    white_panel=(0, 396, 306, 396),
    dark_cover=(306, 396, 306, 340),
    text_x=36.85,
    value_right=269.17,
    title_y=739.56,
    subtitle_y=722.27,
    accent_bar=(36.72, 708.84, 130.30, 1.44),
    desc_y=690.00,
    desc_leading=10.95,
    row_baselines=[643.90, 629.49, 615.08, 600.68, 585.69,
                   571.29, 556.88, 542.47, 528.07, 513.66],
    row_rules=[638.46, 624.06, 609.66, 595.26, 580.86,
               566.46, 552.06, 537.66, 523.26, 508.86],
    code_y=488.88,
    subcode_y=479.66,
    caption_center_x=459.0,
    caption_y=484.37,
    footer_y=426.64,
    photo_center=(459.0, 592.0),
    logo_pos=(513.84, 743.04, 67.32, 18.0),
)


class Catalog:
    """PDF del catálogo abierto, con las primitivas de dibujo."""

    # colores exactos leídos del content stream original
    TITLE = (26, 26, 26)
    VALUE = (26, 26, 26)
    SUBTITLE = (122, 122, 122)
    BODY = (59, 59, 59)
    LABEL = (129, 129, 129)
    SUBCODE = (141, 141, 141)
    FOOTER = (156, 156, 156)
    CAPTION = (201, 201, 201)
    CHIP = (224, 224, 224)
    VARIANT_LABEL = (154, 154, 154)
    RULE = (237, 237, 237)
    DARK = (30, 30, 30)
    WHITE = (255, 255, 255)
    CREAM = (241, 237, 232)   # fondo de las portadillas de sección (págs 3, 12, 17)
    RULE_W = 0.576

    def __init__(self, path, font_page=4):
        self.pdf = pikepdf.open(path)
        self.fonts = load_fonts(self.pdf, font_page)
        self._font_page = font_page

    # ---------- utilidades ----------
    @staticmethod
    def _col(c):
        return " ".join(f"{v / 255:.6f}" for v in c)

    def check_glyphs(self, text, res):
        """Los subsets solo traen los glifos ya usados en el documento."""
        return missing_glyphs(text, self.fonts[res])

    def ensure_font(self, page, res):
        """Copia el recurso de fuente a una página que no lo tenga (p. ej. la portada)."""
        pres = page["/Resources"]
        if "/Font" not in pres:
            pres["/Font"] = Dictionary()
        if res in pres["/Font"]:
            return
        src = self.pdf.pages[self._font_page]["/Resources"]["/Font"][res]
        pres["/Font"][res] = src

    def advance(self, text, res, size, trk=0.0):
        _, advs = encode(text, self.fonts[res])
        return sum(a * size / 1000.0 for a in advs) + trk * (len(text) - 1)

    # ---------- formas ----------
    def rect(self, x, y, w, h, color):
        return f"q {self._col(color)} rg {x:.3f} {y:.3f} {w:.3f} {h:.3f} re f Q"

    def rule(self, x0, x1, y, color=None, width=None):
        color = self.RULE if color is None else color
        width = self.RULE_W if width is None else width
        return (f"q {self._col(color)} RG {width} w 0 J "
                f"{x0:.3f} {y:.3f} m {x1:.3f} {y:.3f} l S Q")

    # ---------- texto ----------
    def show(self, text, res, size, x, y, trk, color):
        """Un run de texto con posicionamiento por glifo, igual que el original.

        wkhtmltopdf coloca cada glifo con su propio Td en vez de usar Tc; replicarlo es lo
        que hace que el tracking coincida exactamente.
        """
        hexs, advs = encode(text, self.fonts[res])
        out = [f"q {self._col(color)} rg", "BT", f"{res} {size:.4f} Tf",
               "1 0 0 1 0 0 Tm", f"{x:.4f} {y:.4f} Td <{hexs[0]}> Tj"]
        for i in range(1, len(text)):
            out.append(f"{advs[i - 1] * size / 1000.0 + trk:.4f} 0 Td <{hexs[i]}> Tj")
        out += ["ET", "Q"]
        return "\n".join(out)

    def show_right(self, text, res, size, x_right, y, trk, color):
        return self.show(text, res, size, x_right - self.advance(text, res, size, trk),
                         y, trk, color)

    def show_center(self, text, res, size, x_center, y, trk, color):
        return self.show(text, res, size,
                         x_center - self.advance(text, res, size, trk) / 2, y, trk, color)

    def wrap(self, text, res, size, trk, max_w):
        lines, cur = [], ""
        for word in text.split():
            trial = (cur + " " + word).strip()
            if self.advance(trial, res, size, trk) <= max_w:
                cur = trial
            else:
                lines.append(cur)
                cur = word
        if cur:
            lines.append(cur)
        return lines

    # ---------- imágenes ----------
    def add_image(self, page, name, pil_img, bg):
        """Aplana la imagen sobre el color de fondo y la embebe como JPEG."""
        from PIL import Image
        flat = Image.new("RGB", pil_img.size, bg)
        flat.paste(pil_img, (0, 0), pil_img if pil_img.mode == "RGBA" else None)
        buf = io.BytesIO()
        flat.save(buf, "JPEG", quality=94, subsampling=0)
        img = Stream(self.pdf, buf.getvalue())
        img.Type, img.Subtype = Name.XObject, Name.Image
        img.Width, img.Height = flat.size
        img.ColorSpace, img.BitsPerComponent = Name.DeviceRGB, 8
        img.Filter = Name.DCTDecode
        res = page["/Resources"]
        if "/XObject" not in res:
            res["/XObject"] = Dictionary()
        res["/XObject"][name] = img

    @staticmethod
    def place(name, x, y, w, h):
        return f"q {w:.3f} 0 0 {h:.3f} {x:.3f} {y:.3f} cm {name} Do Q"

    def fit(self, pil_img, width, center):
        """-> (x, y, w, h) para centrar una imagen de ancho dado en un punto."""
        h = width * pil_img.height / pil_img.width
        return center[0] - width / 2, center[1] - h / 2, width, h

    # ---------- composición ----------
    def append(self, page, fragment):
        """Dibuja el fragmento encima de la página, con el estado gráfico limpio.

        Los streams originales dejan un clipping path activo al terminar: si agregás
        contenido sin más, se dibuja pero queda recortado e invisible. Envolver el
        contenido original en q/Q descarta ese clip antes de dibujar lo nuevo.
        """
        page.contents_add(Stream(self.pdf, b"q\n"), prepend=True)
        page.contents_add(
            Stream(self.pdf, ("\nQ\nq\n" + fragment + "\nQ\n").encode("latin-1")),
            prepend=False,
        )

    def save(self, path):
        self.pdf.save(path)
        return path

    # ---------- operaciones de página completa ----------
    def replace_index_row(self, texto, y_baseline, page_index=1,
                          x=68.03, band=(60, 475), alto=21):
        """Reemplaza el nombre de una fila del índice dejando intacto su número de página.

        Se tapa solo la banda interior de la fila para no comerse las líneas divisorias,
        que son compartidas entre filas contiguas.
        """
        page = self.pdf.pages[page_index]
        frag = [self.rect(band[0], y_baseline - 7.9, band[1], alto, self.WHITE),
                self.show(texto, "/F11", 7.49, x, y_baseline, 0.0, self.BODY)]
        self.append(page, "\n".join(frag))

    def replace_cover_photo(self, photo, width=380.0, page_index=0,
                            zona=(190.0, 703.0)):
        """Cambia la foto de la portada conservando logo, título y pie.

        `zona` son los límites de la franja libre medidos desde arriba: el subtítulo
        "CATÁLOGO 2026" termina en y≈167 y el pie arranca en y≈713, así que 190–703 es
        seguro. La foto queda centrada en esa franja.
        """
        page = self.pdf.pages[page_index]
        self.add_image(page, "/ImgPortada", photo, self.DARK)
        alto = width * photo.height / photo.width
        top, bottom = zona
        y_desde_arriba = top + ((bottom - top) - alto) / 2
        frag = [self.rect(0, PAGE_H - bottom, PAGE_W, bottom - top, self.DARK),
                self.place("/ImgPortada", (PAGE_W - width) / 2,
                           PAGE_H - (y_desde_arriba + alto), width, alto)]
        self.append(page, "\n".join(frag))
