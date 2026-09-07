"""Reconstruye el flyer de precios de Pana Iluminación como PDF vectorial A4.

El original era una imagen: acá el texto es texto de verdad (Poppins embebida) y los
iconos son vectores, así que se puede imprimir, buscar y copiar.
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


def fila_envio(icono, etiqueta, texto, monto):
    return f"""<div class="fila">
      <div class="fila-ico">{svg(icono, 38, AMARILLO, 1.5)}</div>
      <p><b>{etiqueta}</b> {texto} <b>{monto}</b>.</p>
    </div>"""


HTML = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
{FACES}
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ width: 210mm; height: 297mm; background: {NEGRO}; color: #fff;
        font-family: Poppins, sans-serif; -webkit-print-color-adjust: exact; }}
.hoja {{ padding: 18mm 16mm 15mm; height: 100%; display: flex; flex-direction: column; }}

.top {{ display: flex; justify-content: space-between; align-items: flex-start; }}
.marca .nombre {{ font-size: 46px; font-weight: 300; letter-spacing: 15px; line-height: 1; }}
.marca .bajo {{ display: flex; align-items: center; gap: 7px; margin-top: 7px; }}
.marca .puntos {{ display: flex; gap: 7px; }}
.marca .puntos i {{ width: 3.5px; height: 3.5px; border-radius: 50%; background: #cfcfcf; }}
.marca .sub {{ font-size: 12px; font-weight: 300; letter-spacing: 2.5px; color: #cfcfcf; }}
.grilla {{ display: grid; grid-template-columns: repeat(5, 9px); gap: 9px; margin-top: 6px; }}
.grilla i {{ width: 3.5px; height: 3.5px; border-radius: 50%; background: #4a4a4a; }}

h1 {{ font-size: 55px; font-weight: 700; line-height: 1.08; letter-spacing: -0.8px;
      margin-top: 32px; }}
h1 .am {{ color: {AMARILLO}; }}
.barra {{ width: 118px; height: 6px; background: {AMARILLO}; margin-top: 22px; }}

.chapa {{ display: flex; align-items: center; gap: 16px; border: 1.4px solid #3d3d3d;
          border-radius: 10px; padding: 17px 24px; margin-top: 30px; }}
.chapa .aro {{ width: 48px; height: 48px; border: 1.4px solid #6a6a6a; border-radius: 50%;
               display: flex; align-items: center; justify-content: center; flex: none; }}
.chapa span {{ font-size: 27px; font-weight: 700; letter-spacing: 0.6px; }}

.intro {{ display: flex; gap: 22px; align-items: flex-start; margin-top: 30px; }}
.intro p {{ font-size: 19px; line-height: 1.5; color: #f0f0f0; font-weight: 400; }}
.intro p b {{ color: {AMARILLO}; font-weight: 600; }}
.intro .destacado {{ margin-top: 14px; color: {AMARILLO}; font-weight: 700; font-size: 19px;
                     line-height: 1.45; }}
.intro .sello {{ width: 152px; height: 152px; border: 1.4px solid #2e2e2e; border-radius: 50%;
                 display: flex; align-items: center; justify-content: center; flex: none;
                 margin-top: 6px; }}

hr {{ border: 0; border-top: 1px solid #262626; margin: 28px 0 0; }}

.envios {{ display: flex; align-items: center; gap: 16px; margin-top: 26px; }}
.envios .aro {{ width: 48px; height: 48px; border: 1.5px solid {AMARILLO}; border-radius: 50%;
                display: flex; align-items: center; justify-content: center; flex: none; }}
.envios h2 {{ font-size: 32px; font-weight: 700; letter-spacing: 2.5px; }}
.envios .tres {{ display: flex; gap: 7px; margin-left: 4px; }}
.envios .tres i {{ width: 6px; height: 6px; border-radius: 50%; background: {AMARILLO}; }}

.fila {{ display: flex; align-items: center; gap: 18px; padding: 21px 2px;
         border-bottom: 1px solid #242424; }}
.fila:first-of-type {{ border-top: 1px solid #242424; margin-top: 14px; }}
.fila-ico {{ width: 48px; display: flex; justify-content: center; flex: none; }}
.fila p {{ font-size: 18.5px; line-height: 1.45; color: #f0f0f0; }}
.fila p b {{ color: {AMARILLO}; font-weight: 600; }}

.pie {{ display: flex; align-items: center; gap: 14px; background: #161616; border-radius: 9px;
        padding: 19px 24px; margin-top: auto; }}
.pie p {{ font-size: 17px; color: #dcdcdc; }}
.pie .tres {{ display: flex; gap: 6px; margin-left: 2px; }}
.pie .tres i {{ width: 5px; height: 5px; border-radius: 50%; background: {AMARILLO}; }}
</style></head><body><div class="hoja">

  <div class="top">
    <div class="marca">
      <div class="nombre">PANA</div>
      <div class="bajo">
        <div class="puntos"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="sub">iluminación</div>
      </div>
    </div>
    <div class="grilla">{"<i></i>" * 20}</div>
  </div>

  <h1>Conocé nuestros<br>precios <span class="am">de septiembre</span></h1>
  <div class="barra"></div>

  <div class="chapa">
    <div class="aro">{svg("carrito", 24, "#e8e8e8", 1.6)}</div>
    <span>SIN MÍNIMO DE COMPRA</span>
  </div>

  <div class="intro">
    <div>
      <p>En Pana Iluminación acompañamos a nuestros clientes, en especial a quienes
         comercializan y distribuyen nuestra marca <b>Tenaruz</b>.</p>
      <p class="destacado">Por eso trabajamos sin monto mínimo de compra.</p>
    </div>
    <div class="sello">{svg("apreton", 84, "#3d3d3d", 1.4)}</div>
  </div>

  <hr>

  <div class="envios">
    <div class="aro">{svg("camion", 24, AMARILLO, 1.6)}</div>
    <h2>ENVÍOS</h2>
    <div class="tres"><i></i><i></i><i></i></div>
  </div>

  {fila_envio("pin", "CABA:", "sin cargo en compras superiores a", "$400.000 + IVA")}
  {fila_envio("mapa", "AMBA:", "sin cargo en compras superiores a", "$600.000 + IVA")}
  {fila_envio("caja", "Transporte o expreso:", "sin cargo en compras superiores a", "$400.000 + IVA")}

  <div class="pie">
    {svg("chat", 23, "#bdbdbd", 1.6)}
    <p>Consultanos para más información.</p>
    <div class="tres"><i></i><i></i><i></i></div>
  </div>

</div></body></html>"""

(BASE / "flyer.html").write_text(HTML, encoding="utf-8")


def render():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
        pg = b.new_page()
        pg.goto(f"file://{BASE / 'flyer.html'}")
        pg.pdf(path=str(BASE / "PANA_precios_septiembre.pdf"), format="A4",
               print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        b.close()
    print("PDF listo:", BASE / "PANA_precios_septiembre.pdf")


if __name__ == "__main__":
    render()
