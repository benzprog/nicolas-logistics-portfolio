"""Versión B del flyer de precios: fondo claro, titular sobre el beneficio.

Cambia la apuesta respecto de la A. En vez de invitar a conocer los precios,
pone adelante lo que el cliente gana ("sin mínimo de compra"), muestra los
montos de envío como fichas escaneables en vez de párrafos, y cierra con un
pedido de acción concreto. El fondo crema es el mismo de las portadillas del
catálogo TENARUZ, así que sigue leyéndose como la misma marca.
"""
from flyer_common import AMARILLO, FACES, NEGRO, logo, render, svg

SALIDA = "PANA_septiembre_B"

CREMA = "#F1EDE8"          # el crema de las portadillas del catálogo
TINTA = "#2E2A26"          # gris cálido para el cuerpo de texto
APAGADO = "#8A8279"        # etiquetas y aclaraciones
BORDE = "#E2DBD1"


def ficha(icono, zona, monto):
    return f"""<div class="ficha">
      <div class="ficha-ico">{svg(icono, 22, NEGRO, 1.8)}</div>
      <div class="ficha-txt">
        <b>{zona}</b>
        <span>sin cargo en compras superiores a</span>
      </div>
      <div class="ficha-monto">{monto}<i>+ IVA</i></div>
    </div>"""


HTML = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
{FACES}
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ width: 210mm; height: 297mm; background: {CREMA}; color: {NEGRO};
        font-family: Poppins, sans-serif; -webkit-print-color-adjust: exact; }}
.hoja {{ padding: 15mm 14mm 13mm; height: 100%; display: flex; flex-direction: column; }}

.top {{ display: flex; justify-content: space-between; align-items: center; }}
.marca .nombre {{ font-size: 34px; font-weight: 300; letter-spacing: 11px; line-height: 1; }}
.marca .bajo {{ display: flex; align-items: center; gap: 6px; margin-top: 6px; }}
.marca .puntos {{ display: flex; gap: 6px; }}
.marca .puntos i {{ width: 3px; height: 3px; border-radius: 50%; background: {APAGADO}; }}
.marca .sub {{ font-size: 10.5px; font-weight: 300; letter-spacing: 2.2px; color: {APAGADO}; }}
.tz {{ width: 168px; display: block; }}

.kicker {{ font-size: 13.5px; font-weight: 600; letter-spacing: 4.2px; color: {APAGADO};
           margin-top: 52px; }}
h1 {{ font-size: 72px; font-weight: 700; line-height: 1.18; letter-spacing: -2px;
      margin-top: 14px; }}
h1 .marcador {{ background: {AMARILLO}; padding: 0 12px; margin-left: -12px;
                box-decoration-break: clone; -webkit-box-decoration-break: clone; }}

.bajada {{ font-size: 18.5px; line-height: 1.6; color: {TINTA}; max-width: 600px;
           margin-top: 30px; }}
.bajada b {{ font-weight: 600; }}

.envios {{ display: flex; align-items: center; gap: 14px; margin-top: 54px; }}
.envios .aro {{ width: 42px; height: 42px; border-radius: 50%; background: {NEGRO};
                display: flex; align-items: center; justify-content: center; flex: none; }}
.envios h2 {{ font-size: 25px; font-weight: 700; letter-spacing: 1.4px; }}
.envios .linea {{ flex: 1; height: 1.2px; background: {BORDE}; }}

.fichas {{ display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }}
.ficha {{ display: flex; align-items: center; gap: 18px; background: #fff;
          border: 1.2px solid {BORDE}; border-radius: 15px; padding: 24px; }}
.ficha-ico {{ width: 44px; height: 44px; border-radius: 50%; background: {AMARILLO};
              display: flex; align-items: center; justify-content: center; flex: none; }}
.ficha-txt {{ flex: 1; }}
.ficha-txt b {{ display: block; font-size: 22px; font-weight: 700; letter-spacing: -0.2px; }}
.ficha-txt span {{ display: block; font-size: 14px; color: {APAGADO}; margin-top: 2px; }}
.ficha-monto {{ font-size: 26px; font-weight: 700; letter-spacing: -0.6px; text-align: right;
                white-space: nowrap; }}
.ficha-monto i {{ display: block; font-style: normal; font-size: 13px; font-weight: 500;
                  color: {APAGADO}; letter-spacing: 0.4px; margin-top: 1px; }}

.cta {{ display: flex; align-items: center; gap: 16px; background: {NEGRO}; color: #fff;
        border-radius: 15px; padding: 24px 26px; margin-top: auto; }}
.cta .aro {{ width: 44px; height: 44px; border-radius: 50%; border: 1.4px solid #4a4a4a;
             display: flex; align-items: center; justify-content: center; flex: none; }}
.cta p {{ font-size: 19px; font-weight: 500; line-height: 1.4; }}
.cta p span {{ color: {AMARILLO}; font-weight: 700; }}
</style></head><body><div class="hoja">

  <div class="top">
    <div class="marca">
      <div class="nombre">PANA</div>
      <div class="bajo">
        <div class="puntos"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="sub">iluminación</div>
      </div>
    </div>
    <img class="tz" src="{logo('tenaruz_negro.png')}" alt="Tenaruz">
  </div>

  <div class="kicker">PRECIOS DE SEPTIEMBRE 2026</div>
  <h1>Comprá<br><span class="marcador">sin mínimo</span></h1>

  <p class="bajada">En Pana Iluminación acompañamos a quienes comercializan y distribuyen
     nuestra marca <b>Tenaruz</b>. Llevás la cantidad que necesitás: no hay monto mínimo
     de compra.</p>

  <div class="envios">
    <div class="aro">{svg("camion", 22, AMARILLO, 1.8)}</div>
    <h2>ENVÍO SIN CARGO</h2>
    <div class="linea"></div>
  </div>

  <div class="fichas">
    {ficha("pin", "CABA", "$400.000")}
    {ficha("mapa", "AMBA", "$600.000")}
    {ficha("caja", "Transporte o expreso", "$400.000")}
  </div>

  <div class="cta">
    <div class="aro">{svg("chat", 21, AMARILLO, 1.7)}</div>
    <p>Escribinos y te pasamos la <span>lista de septiembre</span>.</p>
  </div>

</div></body></html>"""


if __name__ == "__main__":
    render(HTML, SALIDA)
