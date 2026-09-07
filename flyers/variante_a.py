"""Versión A del flyer de precios: fondo oscuro, titular sobre el mes.

Es la reconstrucción del flyer original que venía como imagen. Se apoya en la
curiosidad ("conocé los precios") y deja el beneficio más abajo.
"""
import pana_logo
from flyer_common import AMARILLO, FACES, NEGRO, logo, render, svg

SALIDA = "PANA_septiembre_A"


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

.top {{ display: flex; justify-content: space-between; align-items: center; }}
.tz {{ width: 168px; display: block; }}

h1 {{ font-size: 55px; font-weight: 700; line-height: 1.08; letter-spacing: -0.8px;
      margin-top: 38px; }}
h1 .am {{ color: {AMARILLO}; }}
.barra {{ width: 118px; height: 6px; background: {AMARILLO}; margin-top: 22px; }}

.chapa {{ display: flex; align-items: center; gap: 16px; border: 1.4px solid #3d3d3d;
          border-radius: 10px; padding: 17px 24px; margin-top: 36px; }}
.chapa .aro {{ width: 48px; height: 48px; border: 1.4px solid #6a6a6a; border-radius: 50%;
               display: flex; align-items: center; justify-content: center; flex: none; }}
.chapa span {{ font-size: 27px; font-weight: 700; letter-spacing: 0.6px; }}

.intro {{ margin-top: 38px; }}
.intro p {{ font-size: 19px; line-height: 1.5; color: #f0f0f0; font-weight: 400; }}
.intro p b {{ color: {AMARILLO}; font-weight: 600; }}
.intro .destacado {{ margin-top: 14px; color: {AMARILLO}; font-weight: 700; font-size: 19px;
                     line-height: 1.45; }}

hr {{ border: 0; border-top: 1px solid #262626; margin: 36px 0 0; }}

.envios {{ display: flex; align-items: center; gap: 16px; margin-top: 34px; }}
.envios .aro {{ width: 48px; height: 48px; border: 1.5px solid {AMARILLO}; border-radius: 50%;
                display: flex; align-items: center; justify-content: center; flex: none; }}
.envios h2 {{ font-size: 32px; font-weight: 700; letter-spacing: 2.5px; }}
.envios .tres {{ display: flex; gap: 7px; margin-left: 4px; }}
.envios .tres i {{ width: 6px; height: 6px; border-radius: 50%; background: {AMARILLO}; }}

.fila {{ display: flex; align-items: center; gap: 18px; padding: 26px 2px;
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
    {pana_logo.svg("#FFFFFF", 62)}
    <img class="tz" src="{logo('tenaruz_blanco.png')}" alt="Tenaruz">
  </div>

  <h1>Conocé nuestros<br>precios <span class="am">de septiembre</span></h1>
  <div class="barra"></div>

  <div class="chapa">
    <div class="aro">{svg("carrito", 24, "#e8e8e8", 1.6)}</div>
    <span>SIN MÍNIMO DE COMPRA</span>
  </div>

  <div class="intro">
      <p>En Pana Iluminación acompañamos a nuestros clientes, en especial a quienes
         comercializan y distribuyen nuestra marca <b>Tenaruz</b>.</p>
      <p class="destacado">Por eso trabajamos sin monto mínimo de compra.</p>
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



if __name__ == "__main__":
    render(HTML, SALIDA)
