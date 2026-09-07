"""Piezas compartidas por las dos versiones del flyer de Pana Iluminación.

Fuentes embebidas en base64, el set de iconos de línea y el render a PDF + imagen.
Cada versión del flyer arma su propio HTML y lo pasa por `render()`.
"""
import base64
import pathlib

BASE = pathlib.Path(__file__).parent
FONTS = BASE / "fonts"

AMARILLO = "#F4C430"
NEGRO = "#0C0C0C"


def font_face(nombre, archivo, peso):
    b64 = base64.b64encode((FONTS / archivo).read_bytes()).decode()
    return (f"@font-face{{font-family:'{nombre}';font-style:normal;font-weight:{peso};"
            f"src:url(data:font/ttf;base64,{b64}) format('truetype');}}")


FACES = "".join([
    font_face("Poppins", "Poppins-Light.ttf", 300),
    font_face("Poppins", "Poppins-Regular.ttf", 400),
    font_face("Poppins", "Poppins-Medium.ttf", 500),
    font_face("Poppins", "Poppins-SemiBold.ttf", 600),
    font_face("Poppins", "Poppins-Bold.ttf", 700),
])

# ── iconos de línea, en el mismo estilo que el original ───────────────────────
ICONOS = {
    "carrito": """<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>""",
    "camion": """<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
        <path d="M15 18H9"/>
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
        <circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>""",
    "pin": """<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/>
        <circle cx="12" cy="10" r="3"/>""",
    "mapa": """<path d="M18 8c0 3.61-3.87 7.43-5.39 8.8a1 1 0 0 1-1.22 0C9.87 15.43 6 11.61 6 8a6 6 0 0 1 12 0"/>
        <circle cx="12" cy="8" r="2"/>
        <path d="M8.71 14H5a1 1 0 0 0-.95.68l-2 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .95-1.32l-2-6A1 1 0 0 0 19 14h-3.71"/>""",
    "caja": """<path d="m7.5 4.27 9 5.15"/>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>""",
    "chat": """<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
        <circle cx="8" cy="12" r=".9" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/>
        <circle cx="16" cy="12" r=".9" fill="currentColor" stroke="none"/>""",
    "apreton": """<path d="M11 17l2 2a1 1 0 1 0 3-3"/>
        <path d="M14 14l2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/>
        <path d="M21 3l1 11h-2"/>
        <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/>
        <path d="M3 4h8"/>""",
}


def svg(nombre, tam, color, grosor=1.7):
    return (f'<svg viewBox="0 0 24 24" width="{tam}" height="{tam}" fill="none" '
            f'stroke="{color}" stroke-width="{grosor}" stroke-linecap="round" '
            f'stroke-linejoin="round">{ICONOS[nombre]}</svg>')



CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

# A4 en px CSS a 96 dpi. Se captura al triple y después se reduce con Lanczos:
# el texto queda mucho más limpio que dejando que Chromium rasterice al tamaño final.
ANCHO_CSS, ALTO_CSS = 794, 1123
ESCALA = 3
ANCHO_FINAL = 1080          # WhatsApp recomprime a ~1600 px de lado mayor


def render(html, salida):
    """Deja <salida>.jpg, .png y .pdf en esta carpeta. Devuelve el tamaño de la imagen."""
    from playwright.sync_api import sync_playwright

    fuente = BASE / f"_{salida}.html"
    fuente.write_text(html, encoding="utf-8")

    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME)
        pg = b.new_page(viewport={"width": ANCHO_CSS, "height": ALTO_CSS},
                        device_scale_factor=ESCALA)
        pg.goto(f"file://{fuente}")
        pg.pdf(path=str(BASE / f"{salida}.pdf"), format="A4", print_background=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        pg.screenshot(path=str(BASE / "_full.png"), full_page=True)
        b.close()

    from PIL import Image
    grande = Image.open(BASE / "_full.png").convert("RGB")
    alto = round(ANCHO_FINAL * grande.height / grande.width)
    chico = grande.resize((ANCHO_FINAL, alto), Image.LANCZOS)
    # JPEG sin submuestreo de croma: WhatsApp recomprime igual, pero partiendo de
    # una imagen limpia el amarillo no se ensucia contra el fondo.
    chico.save(BASE / f"{salida}.jpg", "JPEG", quality=92, subsampling=0, optimize=True)
    chico.save(BASE / f"{salida}.png", "PNG", optimize=True)
    (BASE / "_full.png").unlink()

    print(f"{salida}: .jpg / .png ({ANCHO_FINAL}x{alto}) + .pdf")
    return ANCHO_FINAL, alto
