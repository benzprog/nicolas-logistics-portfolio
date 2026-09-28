"""Flyer mensual de la lista de precios, con la identidad visual actual de PANA.

El sistema sale del plan de contenidos de Instagram (`PANA_PLAN_SETIEMBRE`), que es la
pieza más reciente de la marca. De ahí salen, medidos y no estimados:

- **Archivo** como tipografía, no Poppins.
- Paleta de cuatro valores: hueso `#F0EEE6`, negro `#131313`, claro `#F4F3F1` y un único
  amarillo `#FFCE1F`. No hay cobre ni dorado: los ámbar que parecen otro color son el mismo
  amarillo antialiasado sobre negro.
- **El amarillo ocupa el 3% de la pieza.** Es el dato más importante del sistema: funciona
  como señal —el botón, un filete, un chip— y nunca como plano de fondo.
- Componentes: barra superior con el logo y un rótulo espaciado a la derecha, titular corto
  y contundente, filas separadas por filetes finos, tarjeta negra, y una barra amarilla de
  llamada a la acción con el texto a la izquierda y el dato a la derecha.
- Esquinas vivas en todo. Nada redondeado.

El logo de PANA ya es el real, extraído del propio plan (1186 x 371 con alfa), no el
rescate de 172 px del mail viejo.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from flyer_common import ARCHIVO, logo, render  # noqa: E402

# ── contenido del envío ──────────────────────────────────────────────────────
MES, ANIO = "Octubre", "2026"
BAJADA = "Lista mayorista vigente desde el 1 de octubre."
FILAS = [
    ("Precios", "Sin cambios respecto de septiembre"),
    ("Entrega", "15 días lo que no está en stock"),
    ("Financiación", "30 · 45 · 60 días con echeq"),
    ("Condición", "USD sin IVA · bulto cerrado · TC oficial BNA"),
    ("Catálogo", "26 productos · 62 códigos"),
]
CIERRE = "¿Comprás iluminación para tu negocio o proyecto?"
PUBLICO = ["Casas de electricidad", "Constructoras y obra",
           "Distribuidores", "Estudios y comercios"]
CTA, CTA_DATO = "Descargar la lista", "11 6288-3659"
CONTACTO = "Consultas 11 4176-4205 · panailuminacion@gmail.com · Lunes a viernes de 9:30 a 16:30"

HUESO = "#F0EEE6"
NEGRO = "#131313"
CLARO = "#F4F3F1"
AMARILLO = "#FFCE1F"
FILETE = "#D6D2CA"
FILETE_OSCURO = "#333331"
GRIS = "#8A8884"

filas_html = "".join(
    f'<div class="fila"><span class="rot">{r}</span><span class="val">{v}</span></div>'
    for r, v in FILAS)
publico_html = "".join(f'<div class="seg">{t}</div>' for t in PUBLICO)

HTML = f"""<!doctype html><html lang="es"><meta charset="utf-8"><style>
{ARCHIVO}
@page {{ size: A4; margin: 0 }}
*{{ margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased }}
body {{ width:210mm; height:297mm; background:{HUESO}; color:{NEGRO};
        font-family:'Archivo',sans-serif; display:flex; flex-direction:column;
        padding:17mm 18mm 0; overflow:hidden }}

/* rótulos espaciados: el recurso que ordena todas las piezas del plan */
.rotulo {{ font-size:7pt; font-weight:500; letter-spacing:.3em; text-transform:uppercase;
           color:{GRIS}; text-indent:.3em }}

.barra {{ display:flex; align-items:center; justify-content:space-between;
          padding-bottom:5mm; border-bottom:.7pt solid {FILETE} }}
.barra img {{ width:33mm; display:block }}

.hero {{ padding:17mm 0 0 }}
.hero .mes {{ font-size:50pt; font-weight:700; letter-spacing:-.022em; line-height:.96 }}
.hero .anio {{ font-weight:600 }}
.hero .filete {{ width:17mm; height:3.2pt; background:{AMARILLO}; margin:7mm 0 0 }}
.hero .bajada {{ margin-top:6mm; font-size:11pt; font-weight:400; color:#4A4844 }}

.filas {{ margin-top:15mm }}
.fila {{ display:flex; justify-content:space-between; align-items:baseline;
         padding:5.2mm 0; border-bottom:.7pt solid {FILETE} }}
.fila:first-child {{ border-top:.7pt solid {FILETE} }}
.fila .rot {{ font-size:7pt; font-weight:500; letter-spacing:.3em; text-transform:uppercase;
              color:{GRIS}; text-indent:.3em }}
.fila .val {{ font-size:10.5pt; font-weight:500; text-align:right }}

/* la tarjeta negra, calcada del POST 08 del plan */
.tarjeta {{ margin-top:auto; background:{NEGRO}; color:{CLARO}; padding:11mm 11mm 0 }}
.tarjeta .tapa {{ display:flex; align-items:center; justify-content:space-between }}
.tarjeta .tapa img {{ width:30mm; display:block }}
.tarjeta h2 {{ margin-top:9.5mm; font-size:17pt; font-weight:600; letter-spacing:-.012em;
               line-height:1.22; max-width:118mm }}
.segmentos {{ display:grid; grid-template-columns:1fr 1fr; margin-top:8mm }}
.seg {{ font-size:9pt; font-weight:400; color:#C9C7C3; padding:4.4mm 0;
        border-top:.7pt solid {FILETE_OSCURO} }}
.seg:nth-child(odd) {{ padding-right:8mm }}
.seg:nth-child(even) {{ padding-left:8mm; border-left:.7pt solid {FILETE_OSCURO} }}

.cta {{ margin:9mm -11mm 0; background:{AMARILLO}; color:{NEGRO};
        display:flex; align-items:center; justify-content:space-between;
        padding:5.4mm 11mm }}
.cta .texto {{ font-size:9pt; font-weight:600; letter-spacing:.24em;
               text-transform:uppercase; text-indent:.24em }}
.cta .dato {{ font-size:12pt; font-weight:700; letter-spacing:-.01em }}

.pie {{ padding:6mm 0 7mm; text-align:center; font-size:7.6pt; font-weight:400;
        color:{GRIS} }}
</style>

<div class="barra">
  <img src="{logo('pana_negro.png')}" alt="PANA iluminación">
  <div class="rotulo">Lista de precios</div>
</div>

<div class="hero">
  <div class="mes">{MES} <span class="anio">{ANIO}</span></div>
  <div class="filete"></div>
  <p class="bajada">{BAJADA}</p>
</div>

<div class="filas">{filas_html}</div>

<div class="tarjeta">
  <div class="tapa">
    <img src="{logo('tenaruz_blanco_vector.png')}" alt="TENARUZ">
    <div class="rotulo" style="color:#7C7A76">Canal mayorista</div>
  </div>
  <h2>{CIERRE}</h2>
  <div class="segmentos">{publico_html}</div>
  <div class="cta">
    <span class="texto">{CTA}</span>
    <span class="dato">{CTA_DATO}</span>
  </div>
</div>

<div class="pie">{CONTACTO}</div>
</html>"""

if __name__ == "__main__":
    render(HTML, f"PANA_lista_{MES.lower()}_{ANIO}")
