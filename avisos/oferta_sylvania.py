"""Aviso de liquidación del stock Sylvania, con el sistema visual de PANA.

Los precios y las cantidades salen de `Oferta_Sylvania.xlsx`, que es la planilla de venta.
El PDF `lamparas.pdf` trae otros números —son los de costo— y sólo se usa para las fotos.

Sale en A4 vectorial y también en JPG, porque un aviso de oferta se manda por WhatsApp y
ahí el PDF no muestra vista previa.
"""
import base64
import io
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / "flyers"))
from flyer_common import ARCHIVO, CHROME  # noqa: E402

BASE = pathlib.Path(__file__).parent
FOTOS = BASE / "fotos"
LOGOS = BASE.parent / "flyers" / "logos"

TITULO = "Liquidación"
BAJADA = "Productos Sylvania · primera calidad"
SELLO = "Hasta agotar stock"

# tal como figuran en Oferta_Sylvania.xlsx
PRODUCTOS = [
    ("Dicroica Led GU10 6W 36°", "6500K", 1000, 590, "dicroica_gu10.png"),
    ("PLL 2G11 36W", "4000K", 1600, 7500, "pll_2g11.png"),
    ("Sodio 70W Super E27", "2000K", 1300, 4900, "sodio_70w.png"),
    ("Mercurio de alta presión 400W", "E40", 300, 6500, "halogenuros_400w.png"),
]

VENTAS = "11 6288-3659"
MAIL = "panailuminacion@gmail.com"
HORARIO = "Lunes a viernes de 9:30 a 16:30"
NOTA = "Precios por unidad, en pesos, sin IVA · Stock sujeto a disponibilidad"

HUESO, NEGRO, CLARO, AMARILLO = "#F0EEE6", "#131313", "#F4F3F1", "#FFCE1F"
FILETE, GRIS = "#D6D2CA", "#8A8884"


def miles(n):
    return f"{n:,}".replace(",", ".")


def uri(ruta, ancho=760):
    from PIL import Image
    im = Image.open(ruta)
    if im.width > ancho:
        im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


tarjetas = "".join(f"""
  <article class="producto">
    <div class="foto"><img src="{uri(FOTOS / foto)}" alt="{nombre}"></div>
    <div class="ficha">
      <h2>{nombre}</h2>
      <div class="temp">{temp}</div>
      <div class="pie">
        <div class="stock"><span>Stock</span><b>{miles(stock)} u.</b></div>
        <div class="precio">$ {miles(precio)}<span>+ IVA</span></div>
      </div>
    </div>
  </article>""" for nombre, temp, stock, precio, foto in PRODUCTOS)

HTML = f"""<!doctype html><html lang="es"><meta charset="utf-8"><title>Oferta Sylvania</title><style>
{ARCHIVO}
@page {{ size: A4; margin: 0 }}
*{{ margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased }}
html, body {{ background:{HUESO} }}
body {{ width:210mm; height:297mm; padding:15mm 14mm 0; color:{NEGRO};
        font-family:'Archivo',sans-serif; display:flex; flex-direction:column;
        overflow:hidden }}

.rotulo {{ font-size:6.6pt; font-weight:500; letter-spacing:.3em; text-transform:uppercase;
           color:{GRIS}; text-indent:.3em }}
.barra {{ display:flex; align-items:center; justify-content:space-between;
          padding-bottom:5mm; border-bottom:.7pt solid {FILETE} }}
.barra img {{ width:33mm; display:block }}

.encabezado {{ margin-top:12mm; display:flex; align-items:flex-end;
               justify-content:space-between }}
h1 {{ font-size:52pt; font-weight:700; letter-spacing:-.028em; line-height:.94 }}
.bajada {{ margin-top:5mm; font-size:11pt; font-weight:500; color:#4A4844 }}
/* el sello es el único amarillo de la mitad de arriba: la urgencia va ahí */
.sello {{ background:{AMARILLO}; color:{NEGRO}; font-size:9pt; font-weight:700;
          letter-spacing:.2em; text-transform:uppercase; padding:3.4mm 7mm;
          text-indent:.2em; white-space:nowrap; margin-bottom:2mm }}
.filete {{ width:17mm; height:3.2pt; background:{NEGRO}; margin:7mm 0 0 }}

/* alto fijo por tarjeta: con `flex:1` las fotos con max-height:100% crecían sin tope y
   la pieza se iba a dos hojas */
.grilla {{ margin-top:9mm; display:grid; grid-template-columns:1fr 1fr; gap:6mm }}
.producto {{ height:64mm }}
.producto {{ display:flex; background:{CLARO}; border:.7pt solid {FILETE};
             overflow:hidden }}
.producto .foto {{ width:33mm; flex:none; padding:3.5mm; display:flex; align-items:center;
                   justify-content:center; background:#FFFFFF;
                   border-right:.7pt solid {FILETE} }}
.producto .foto img {{ max-width:100%; max-height:56mm; display:block }}
.ficha {{ flex:1; min-width:0; padding:4.5mm 4.5mm 4mm; display:flex; flex-direction:column }}
.ficha h2 {{ font-size:11pt; font-weight:700; letter-spacing:-.012em; line-height:1.18 }}
.ficha .temp {{ margin-top:1.6mm; font-size:7pt; font-weight:600; letter-spacing:.2em;
                text-transform:uppercase; color:{GRIS}; text-indent:.2em }}
.ficha .pie {{ margin-top:auto; padding-top:4mm; display:flex; align-items:flex-end;
               justify-content:space-between; border-top:.7pt solid {FILETE} }}
.stock span {{ display:block; font-size:6.2pt; font-weight:600; letter-spacing:.24em;
               text-transform:uppercase; color:{GRIS}; text-indent:.24em }}
.stock b {{ display:block; margin-top:1mm; font-size:9pt; font-weight:600;
            white-space:nowrap }}
.precio {{ font-size:16pt; font-weight:700; letter-spacing:-.025em; white-space:nowrap;
           text-align:right; line-height:1 }}
.precio span {{ display:block; margin-top:1mm; font-size:6.4pt; font-weight:600;
                letter-spacing:.2em; text-transform:uppercase; color:{GRIS};
                text-indent:.2em }}

.nota {{ margin-top:4mm; margin-bottom:6mm; font-size:7.2pt; font-weight:400; color:#8C8A85 }}

.tarjeta {{ margin-top:auto; background:{NEGRO}; color:{CLARO}; padding:9mm 10mm 0 }}
.tarjeta h3 {{ font-size:14pt; font-weight:600; line-height:1.25 }}
.via {{ margin-top:6mm }}
.via span {{ display:block; font-size:6.4pt; font-weight:500; letter-spacing:.28em;
             color:{AMARILLO}; text-transform:uppercase; text-indent:.28em }}
.via b {{ display:block; margin-top:1.5mm; font-size:13pt; font-weight:700 }}
.cta {{ margin:7mm -10mm 0; background:{AMARILLO}; color:{NEGRO}; display:flex;
        justify-content:space-between; padding:4.2mm 10mm; font-size:8pt; font-weight:600;
        letter-spacing:.22em; text-transform:uppercase }}
.categorias {{ padding:4mm 0 6mm; text-align:center; font-size:7.2pt; font-weight:600;
               letter-spacing:.24em; text-transform:uppercase; color:#7C7A75;
               text-indent:.24em }}
</style>

<div class="barra">
  <img src="{uri(LOGOS / 'pana_negro.png', 900)}" alt="PANA iluminación">
  <div class="rotulo">Oferta especial</div>
</div>

<div class="encabezado">
  <div>
    <h1>{TITULO}</h1>
    <p class="bajada">{BAJADA}</p>
  </div>
  <div class="sello">{SELLO}</div>
</div>
<div class="filete"></div>

<div class="grilla">{tarjetas}</div>
<p class="nota">{NOTA}</p>

<div class="tarjeta">
  <h3>Consultanos disponibilidad y cerramos la operación.</h3>
  <div class="via"><span>Ventas · WhatsApp</span><b>{VENTAS}</b></div>
  <div class="cta"><span>{MAIL}</span><span>{HORARIO}</span></div>
</div>
<div class="categorias">Hogar / Náutica / Embarcaciones / Motorhome / Campers / y más…</div>
</html>"""

if __name__ == "__main__":
    from playwright.sync_api import sync_playwright
    from PIL import Image

    fuente = BASE / "_oferta.html"
    fuente.write_text(HTML, encoding="utf-8")
    pdf = BASE / "PANA_OFERTA_SYLVANIA.pdf"
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME)
        pg = b.new_page(viewport={"width": 794, "height": 1123}, device_scale_factor=3)
        pg.goto(f"file://{fuente}")
        pg.pdf(path=str(pdf), format="A4", print_background=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        pg.screenshot(path=str(BASE / "_full.png"))
        b.close()
    grande = Image.open(BASE / "_full.png").convert("RGB")
    chico = grande.resize((1080, round(1080 * grande.height / grande.width)), Image.LANCZOS)
    chico.save(BASE / "PANA_OFERTA_SYLVANIA.jpg", "JPEG", quality=92, subsampling=0,
               optimize=True)
    (BASE / "_full.png").unlink()
    print(f"{len(PRODUCTOS)} productos · {pdf.name} + .jpg ({chico.width}x{chico.height})")
